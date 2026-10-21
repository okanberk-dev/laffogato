import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

import { maskCardLikeDigits, type CardInput } from "./paynkolay-card";
import {
  PaymentRefusedError,
  type CheckoutInput,
  type CheckoutSession,
  type PaymentProvider,
  type RefundHint,
  type RefundResult,
  type ReturnConfirmation,
  type WebhookEvent,
} from "./provider";

/**
 * PayNkolay sanal POS sağlayıcısı.
 *
 * Sözleşmenin tamamı `docs/PAYNKOLAY.md`'de; buradaki `§` göndermeleri o
 * belgenin bölümleridir. Doğrulanamamış her nokta orada işaretli ve §12'de
 * "canlı testte ölçülecek" listesinde.
 *
 * İki ödeme modu var (`PAYNKOLAY_CHECKOUT_MODE`, §15):
 *
 * - `direct` (operatör kararı, 15 Eki 2026): kart sitenin kendi ödeme
 *   sayfasında girilir, bu sunucu onu `/Vpos/v1/Payment`'a iletir ve dönen
 *   banka 3D formunu müşteriye verir - müşteri doğrudan bankanın ekranına
 *   gider. Kart SAKLANMAZ: ne veritabanına ne loga yazılır, yalnız o tek
 *   isteğin gövdesinde durur (kural 28, `tests/saved-cards.test.ts`).
 * - `hosted`: kart PayNkolay'ın ortak ödeme sayfasında girilir; PAN bu
 *   sunucuya hiç girmez. Değişken tanımsızsa bu mod çalışır.
 *
 * İki modda da kart saklama kapalıdır: `customerKey` boş gider ve kart
 * numarası alan saklama uçları (`CardStorageCardRegister`) kullanılmaz (§0).
 *
 * Akış:
 *   1. `createCheckoutSession` → PayNkolay'a POST edilecek form alanları (§9)
 *      ve istek hash'i (§10) üretilir. PayNkolay bir yönlendirme URL'si
 *      vermez - form POST ister - bu yüzden alanlar imzalanıp kendi
 *      `/odeme/paynkolay` ara sayfamıza taşınır; uygulama ve tarayıcı tek bir
 *      URL görür (`CheckoutSession.redirectUrl`). `direct` modda o sayfa kart
 *      formunu gösterir, `startDirectPayment` kartı aynı imzalı alanlarla
 *      POS'a iletir.
 *   2. Müşteri 3D akışını bitirir → PayNkolay MÜŞTERİNİN TARAYICISINI
 *      `successUrl`/`failUrl`'e form-POST eder (§1). Bu POST müşterinin
 *      elinden geçer; delil sayılmaz.
 *   3. `confirmReturn` yanıt hash'iyle ucuz bir ön eleme yapar, sonra
 *      İşlem Doğrulama Servisi'ne (§2) sunucudan sunucuya sorar. Sipariş
 *      yalnızca sorgunun `STATUS = SUCCESS` demesiyle ödendi sayılır ve tutar
 *      sorgunun kendi `AUTHORIZATION_AMOUNT`'undan okunur.
 *   4. `refund` → `POST /Vpos/v1/CancelRefundPayment` (§3). Aynı gün
 *      `cancel`, sonrası `refund`; kısmi iade v1'de reddedilir (§3.2).
 *   5. `verifyWebhook` → PayNkolay webhook GÖNDERMEZ (§4); metot her zaman
 *      hata fırlatır.
 *
 * Tek sır `merchantSecretKey`'dir: hiçbir isteğe, hiçbir URL'ye, hiçbir loga
 * girmez; yalnızca hash hesabına girer (§7).
 */

const DEFAULT_BASE_URL = "https://paynkolay.nkolayislem.com.tr";
/** `lookupPayment`'in siparişten sonra taradığı gün sayısı (servis ≤ 1 ay). */
const LOOKUP_WINDOW_DAYS = 3;

/** TRY. Gönderilmese TL varsayılıyor; yine de açıkça yazılır (§9). */
const CURRENCY_CODE = "949";

/**
 * PayNkolay bir oturum ömrü vermiyor (§11). Bu süre bizim uydurduğumuz ve
 * yalnızca uygulamaya "bu ekranı ne kadar açık tutayım" demek için kullandığı
 * değerdir; POS tarafında hiçbir karşılığı yoktur.
 */
const CHECKOUT_TTL_MS = 20 * 60_000;

/**
 * Sitedeki kart formunun bir ödeme yükünü kabul ettiği en uzun süre.
 * Uygulamaya söylenen ömrün (`CHECKOUT_TTL_MS`) üstünde, 45 dakikalık
 * süpürmenin (`expireStalePendingOrders`) altında: süpürülmüş bir siparişe
 * kart çekilmesin, ama formu açık bırakıp birkaç dakika geç gönderen müşteri
 * de geri çevrilmesin.
 */
export const DIRECT_FORM_MAX_AGE_MS = 30 * 60_000;

/**
 * Ara sayfamızın yolu: `direct` modda sitenin kart formu, `hosted` modda
 * PayNkolay'ın ortak ödeme sayfasına kendiliğinden giden form (§15).
 */
export const PAYNKOLAY_BRIDGE_PATH = "/odeme/paynkolay";

/** Kartın sitede alındığı API ucu (§15). Canlı istek sunucudan gitmeli. */
const DIRECT_PAYMENT_PATH = "/Vpos/v1/Payment";

/**
 * PayNkolay çağrılarının üst süresi (ms). Kart listesi kart sayfası çizilirken
 * beklenir, bu yüzden kısa; 3D başlatma bankaya kadar gidip döndüğü için
 * uzun. Süre dolarsa istek iptal edilir ve hata fırlar.
 */
const POS_TIMEOUT_MS = {
  default: 15_000,
  payment: 25_000,
  cardList: 8_000,
  cardDelete: 10_000,
  // İade yarıda kesilirse sonucu belirsiz kalır (para dönmüş olabilir);
  // bekleme payı geniş tutulur.
  refund: 30_000,
} as const;

export type PaynkolayCheckoutMode = "hosted" | "direct";

/** İmzanın hangi amaçla üretildiğini sabitler (alan ayrımı). */
const BRIDGE_DOMAIN = "paynkolay-bridge-v1";

/**
 * `direct` modda yük şifrelenir; bu önek şifreli yükü düz yükten ayırır.
 *
 * Düz yük tarayıcıya `sx` ile geçerli bir `hashDataV2` veriyor. Ortak ödeme
 * sayfasında bu kaçınılmaz (tarayıcı alanları POS'a kendisi POST ediyor) ve
 * o uç kartı PayNkolay'ın kendi sayfasında alıyor. Ama `direct` modda üye
 * işyerinin "API ile ödeme" yetkisi açık: aynı ikili `/Vpos/v1/Payment`'a
 * doğrudan gönderilip kart listesi bizim deneme sınırlarımızdan geçmeden
 * sınanabilirdi. Şifreli yükte tarayıcı hiçbir şey okuyamaz; POS'a tek yol
 * bizim formumuzdur.
 */
const SEALED_PREFIX = "e1.";

/**
 * İade için işlemi geriye doğru ararken kaç aylık pencere taranır.
 *
 * Raporlama servisi tek sorguda bir aydan uzun aralık kabul etmiyor (§2).
 * Ödeme satırı `TRX_DATE`'i `payment_transactions."trxDate"` kolonunda
 * tutuyor ve iade önce onu okuyor; bu arama yalnız o kolonun boş olduğu
 * eski satırlar için yedektir. On üç ay, kart kurallarının pratikte izin
 * verdiği en uzun iade penceresinden geniştir.
 */
const REFUND_LOOKBACK_MONTHS = 13;

const DAY_MS = 24 * 60 * 60_000;

export interface PaynkolayConfig {
  /** Panel → "sx (Token)" - ödeme formu. */
  sx: string;
  /** Panel → "sx List" - işlem doğrulama ve raporlama. */
  sxList: string;
  /** Panel → "sx İptal" - iptal/iade. */
  sxCancel: string;
  /** Panel → "Merchant Secret Key". TEK sır; hiçbir yere gönderilmez (§7). */
  merchantSecretKey: string;
  /** Üye işyeri numarası; yanıt hash'inin ilk alanı (§1.2). */
  merchantNo: string;
  /** Test için https://paynkolaytest.nkolayislem.com.tr */
  baseUrl?: string;
  /**
   * PayNkolay'ın sonucu form-POST edeceği mutlak adresler. İkisi de
   * `/odeme/donus` olmalıdır: POST'u karşılayan tek uç odur ve `confirmReturn`
   * başarısız işlemi de oradan sonuçlandırır.
   */
  successUrl: string;
  failUrl: string;
  /**
   * `direct`: kart sitede alınır, banka 3D sayfasına doğrudan gidilir.
   * `hosted` (varsayılan): PayNkolay'ın ortak ödeme sayfası (§15).
   */
  checkoutMode?: PaynkolayCheckoutMode;
  /**
   * PayNkolay'ın kart saklama hizmeti (§16) üye işyeri için açık mı. Açılması
   * PayNkolay'ın ayrıca yetki vermesine bağlı (16 Eki 2026: operatör yetkiyi
   * istedi). Kapalıyken yüke üye anahtarı girmez: kayıtlı kart listesi,
   * "kartımı kaydet" ve silme hiç sunulmaz, POS'a `cs*` alanı gitmez.
   */
  cardStorage?: boolean;
}

/** Ara sayfanın tarayıcıya kurduğu form. */
export interface PaynkolayFormPost {
  action: string;
  fields: Record<string, string>;
  /**
   * Üyenin kart saklama anahtarı (`csCustomerKey`, §16) - yük yalnızca
   * oturumu doğrulanmış bir üye için açıldıysa vardır. İmzalı yükün içinde
   * taşınır; müşteri başka bir üyenin anahtarını yazamaz.
   */
  member?: string;
}

/**
 * PayNkolay'ın kart saklama anahtarı: en fazla 11 karakter (sandbox:
 * "CS_CUSTOMER_KEY maksimum 11 karakter olmalıdır", CORE0364). Doküman TCKN
 * ya da telefon öneriyor; biz kişisel veri göndermemek için rastgele, opak
 * 11 karakter üretiyoruz ve sandbox bunu kabul etti (§16).
 */
export const PAYNKOLAY_MEMBER_KEY = /^[A-Z0-9]{11}$/;

/** Yeni bir üye kart anahtarı - 36^11 ≈ 1,3e17 olasılık, tahmin edilemez. */
export function newPaynkolayMemberKey(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "";
  for (let i = 0; i < 11; i++) key += alphabet[randomInt(alphabet.length)];
  return key;
}

/** PayNkolay'da saklı bir kart - ekranda gösterilecek kadarı. */
export interface SavedCard {
  /** Ödeme ve silme için PayNkolay'ın token'ı. Tarayıcıya ASLA gitmez. */
  token: string;
  /** Formda kartı seçmek için kullanılan kimlik (`TranId`). */
  tranId: string;
  /** `41556501****6111` */
  maskedPan: string;
  bank: string;
  brand: string;
  alias: string;
}

/** Sitedeki formun POS'a ilettiği ödeme aracı. */
export type DirectPaymentMethod =
  /** Yeni kart; `save` varsa PayNkolay kartı üyenin anahtarıyla saklar. */
  | { card: CardInput; save?: { alias: string } }
  /** Üyenin PayNkolay'da saklı kartı - kart verisi bu sunucudan hiç geçmez. */
  | { savedToken: string };

/** `startDirectPayment`'in sonucu. */
export type DirectPaymentResult =
  /** POS ödemeyi hazırladı; `html` bankanın 3D formudur, müşteriye verilir. */
  | { kind: "3d"; html: string; referenceCode: string }
  /** POS ödemeyi başlatmadı; `message` müşteriye gösterilebilir. */
  | { kind: "declined"; code: string; message: string };

// ── Saf yardımcılar (test edilebilir; sınıftan bağımsız) ───────────────────

/**
 * Kuruş integer → PayNkolay'ın beklediği tutar dizesi (§5).
 *
 * Ondalık ayracı nokta, daima iki basamak, binlik ayracı yok: `128010` →
 * `"1280.10"`. Kayan noktaya hiç uğramaz - hash ham dize üzerinden
 * hesaplandığı için `250.5` ile `250.50` farklı hash üretir ve bir yuvarlama
 * hatası ödemeyi sessizce reddettirir.
 */
export function minorToPaynkolayAmount(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new Error(`paynkolay: geçersiz tutar (kuruş): ${amountMinor}`);
  }
  const lira = Math.trunc(amountMinor / 100);
  const kurus = amountMinor % 100;
  return `${lira}.${String(kurus).padStart(2, "0")}`;
}

/**
 * PayNkolay tutar dizesi → kuruş integer. Okunamayan değer `null` döner;
 * çağıran onu "tutar teyit edilemedi" sayar, sıfır saymaz.
 *
 * Ayrıştırma dize üzerinde integer aritmetiğiyle yapılır: `parseFloat` ile
 * `1280.10` → `128009` yuvarlaması bu koddaki en pahalı hata olurdu.
 */
export function paynkolayAmountToMinor(
  amount: string | null | undefined,
): number | null {
  const m = /^\s*(\d{1,15})(?:[.,](\d{1,2}))?\s*$/.exec(amount ?? "");
  if (!m) return null;
  const minor = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

/**
 * PayNkolay'ın bütün hash'leri: alanlar `|` ile birleşir, sona
 * `merchantSecretKey` eklenir, SHA-512'nin HAM özeti Base64'lenir (§10).
 *
 * `digest("hex")` değil: doküman ham baytları base64'lüyor.
 */
export function paynkolayHash(
  parts: readonly string[],
  merchantSecretKey: string,
): string {
  return createHash("sha512")
    .update([...parts, merchantSecretKey].join("|"), "utf8")
    .digest("base64");
}

const ISTANBUL = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

interface Clock {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

function istanbulClock(at: Date): Clock {
  const out: Record<string, string> = {};
  for (const part of ISTANBUL.formatToParts(at)) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return out as unknown as Clock;
}

/**
 * `rnd` alanı: `dd.MM.yyyy HH:mm:ss`, Europe/Istanbul (§6).
 *
 * Doküman üç ayrı biçim gösteriyor ve zaman dilimi yazmıyor; alan serbest bir
 * dize ve yalnızca hash'e girdi olduğu için biçim bizim seçimimiz. Örnek
 * formdaki yazım seçildi.
 */
export function formatPaynkolayRnd(at: Date): string {
  const c = istanbulClock(at);
  return `${c.day}.${c.month}.${c.year} ${c.hour}:${c.minute}:${c.second}`;
}

/**
 * `formatPaynkolayRnd`'nin tersi: ödeme yükünün ne zaman üretildiği. Saat
 * köşkün sabit UTC+3'üdür (kural 22). Okunamazsa `null` - çağıran onu
 * "süresi dolmuş" sayar.
 */
export function parsePaynkolayRnd(rnd: string | undefined): Date | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(
    (rnd ?? "").trim(),
  );
  if (!m) return null;
  const [day, month, year, hour, minute, second] = m.slice(1).map(Number);
  const at = new Date(Date.UTC(year, month - 1, day, hour - 3, minute, second));
  return Number.isNaN(at.getTime()) ? null : at;
}

/** `DD.MM.YYYY` - doğrulama ve raporlama servislerinin tarih aralığı (§2). */
export function formatPaynkolayDayDmy(at: Date): string {
  const c = istanbulClock(at);
  return `${c.day}.${c.month}.${c.year}`;
}

/** İstanbul takvim günü, karşılaştırılabilir biçimde. */
function istanbulDayKey(at: Date): string {
  const c = istanbulClock(at);
  return `${c.year}-${c.month}-${c.day}`;
}

/**
 * PayNkolay'ın döndürdüğü tarihi takvim gününe indirger.
 *
 * `TRX_DATE`'in biçimi dokümanda yazmıyor (§12) - örneklerde `2021-08-27`
 * geçiyor, tarih-saat de gelebilir. Gördüğümüz dört yazımı da kabul ediyoruz;
 * hiçbiri tutmazsa `null` döner ve iade yapılmaz. Dize üzerinden çalışır:
 * `new Date(...)` kullanmak, saat dilimi olmayan bir değeri UTC sayıp iadeyi
 * bir gün kaydırırdı.
 */
export function parsePaynkolayDay(text: string | null | undefined): {
  key: string;
  trxDate: string;
} | null {
  const raw = (text ?? "").trim();
  const ymd = /^(\d{4})[.\-/](\d{2})[.\-/](\d{2})/.exec(raw);
  const dmy = /^(\d{2})[.\-/](\d{2})[.\-/](\d{4})/.exec(raw);
  const [year, month, day] = ymd
    ? [ymd[1], ymd[2], ymd[3]]
    : dmy
      ? [dmy[3], dmy[2], dmy[1]]
      : [];
  if (!year) return null;
  // İptal/iade servisi `yyyy.aa.gg` istiyor (§3).
  return { key: `${year}-${month}-${day}`, trxDate: `${year}.${month}.${day}` };
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Dönüş POST'undaki `hashDataV2`yi doğrular (§1.2).
 *
 * Formül `MERCHANT_NO|REFERENCE_CODE|AUTH_CODE|RESPONSE_CODE|USE_3D|RND|
 * INSTALLMENT|AUTHORIZATION_AMOUNT|CURRENCY_CODE|secret`. Son alandan
 * öncesi POST'ta geliyor; `CURRENCY_CODE` gelmiyor (§1.3, §12/1). Gelmediği
 * durumda iki aday denenir: gönderdiğimiz `949` ve boş dize.
 *
 * Dönen `RND` gönderdiğimizle aynı olmayabilir; bu yüzden hash'e daima
 * DÖNEN değer konur.
 */
export function verifyPaynkolayReturnHash(
  params: Record<string, string>,
  merchantSecretKey: string,
): boolean {
  const given = (params.hashDataV2 ?? params.hashDatav2 ?? "").trim();
  if (!given) return false;
  const base = [
    params.MERCHANT_NO ?? "",
    params.REFERENCE_CODE ?? "",
    params.AUTH_CODE ?? "",
    params.RESPONSE_CODE ?? "",
    params.USE_3D ?? "",
    params.RND ?? "",
    params.INSTALLMENT ?? "",
    params.AUTHORIZATION_AMOUNT ?? "",
  ];
  const currencies =
    params.CURRENCY_CODE != null ? [params.CURRENCY_CODE] : [CURRENCY_CODE, ""];
  return currencies.some((currency) =>
    safeEqual(paynkolayHash([...base, currency], merchantSecretKey), given),
  );
}

/** Ödeme formunun istek hash'i (§10). Alan sırası dokümandaki sıradır. */
function checkoutRequestHash(
  fields: Record<string, string>,
  merchantSecretKey: string,
): string {
  return paynkolayHash(
    [
      fields.sx,
      fields.clientRefCode,
      fields.amount,
      fields.successUrl,
      fields.failUrl,
      fields.rnd,
      fields.customerKey,
    ],
    merchantSecretKey,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Servislerin sardığı gövdeyi açar.
 *
 * Canlıda ölçüldü (15 Eki 2026, §12): `PaymentList` yanıtı
 * `{"id":"","result":{…,"LIST":[…]},"error":null}` biçiminde geliyor, yani
 * asıl alanlar `result`'ın altında. Hash hatasında ise `result` bir nesne
 * değil, JSON DİZESİ (`"result":"{\"RESPONSE_CODE\":0,…}"`). Ödeme ucu
 * (`/Vpos/v1/Payment`) ise düz döner. Üçü de buradan geçer.
 */
export function unwrapPaynkolayResult(payload: unknown): unknown {
  let current = payload;
  for (let depth = 0; depth < 3; depth++) {
    if (!isRecord(current) || !("result" in current)) return current;
    const inner = current.result;
    if (typeof inner === "string") {
      try {
        current = JSON.parse(inner) as unknown;
      } catch {
        return current;
      }
    } else if (isRecord(inner) || Array.isArray(inner)) {
      current = inner;
    } else {
      return current;
    }
  }
  return current;
}

/**
 * Servis yanıtından işlem satırlarını çıkarır.
 *
 * Doğrulama servisi alanları `UPPER_SNAKE`, raporlama servisi `camelCase`
 * veriyor. Satırlar canlıda `result.LIST` altında geliyor (§12); yine de yanıt
 * üç biçimde kabul edilir: dizi, içinde dizi taşıyan nesne, ya da tek
 * satırlık nesne. Eskiden yalnız en üst seviyeye bakılıyordu ve gerçek
 * yanıttaki satırlar `result`'ın içinde kaldığı için her ödeme "işlem
 * bulunamadı" sayılırdı.
 */
export function extractRows(payload: unknown): Record<string, unknown>[] {
  const body = unwrapPaynkolayResult(payload);
  if (Array.isArray(body)) return body.filter(isRecord);
  if (!isRecord(body)) return [];
  for (const value of Object.values(body)) {
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return readField(body, "REFERENCE_CODE", "referenceCode") ? [body] : [];
}

/**
 * `PaymentList`'in satırları - ya da yanıt bir liste taşımıyorsa HATA.
 *
 * Boş liste ile okunamayan yanıt aynı şey değildir. Canlıda "kayıt yok"
 * yanıtı `LIST: null` taşıyor (`ERROR_CODE: CORE0305`); yanlış anahtar ise
 * `"API : hashData error"` diyen ve hiç `LIST` alanı olmayan bir gövde.
 * İkincisini "ödeme yok" saymak, süpürmenin parası çekilmiş siparişi iptal
 * etmesine yol açardı (kural 29: POS'a soramamak "ödenmedi" değildir).
 */
function paymentListRows(payload: unknown): Record<string, unknown>[] {
  const rows = extractRows(payload);
  if (rows.length > 0) return rows;
  const body = unwrapPaynkolayResult(payload);
  if (Array.isArray(body)) return [];
  if (isRecord(body)) {
    const message = readField(
      body,
      "RESPONSE_DATA",
      "ERROR_MESSAGE",
      "responseData",
    );
    // Reddedilen anahtar, gövde başka ne taşırsa taşısın "kayıt yok" değildir.
    const refused = paymentListKeyRefusal(message);
    if (refused) throw new Error(refused);
    if (Object.values(body).some(Array.isArray)) return [];
    // `LIST: null` her yanıtta var (çekirdek servisin zarfı); yalnız "kayıt
    // yok" (`CORE0305`) boş liste demektir. Başka bir hata kodu "ödenmedi"
    // değil, "soramadım"dır. Kodsuz yanıt da bir ret taşıyabilir (anahtar
    // reddi canlıda `ERROR_CODE: ""` ile geldi): metni varsa ve "kayıt yok"
    // demiyorsa o da hatadır.
    const errorCode = readField(body, "ERROR_CODE");
    if (
      "LIST" in body &&
      (errorCode === "CORE0305" ||
        (!errorCode && (!message || /kay[ıi]t bulunamad/i.test(message))))
    ) {
      return [];
    }
    throw new Error(
      `paynkolay PaymentList yanıtı işlem listesi taşımıyor${message ? `: ${message}` : ""}`,
    );
  }
  throw new Error("paynkolay PaymentList yanıtı okunamadı");
}

/**
 * `PaymentList`'in anahtar reddi, operatörün bakacağı değişkenin adıyla -
 * ya da başka bir yanıtsa null.
 *
 * Canlıda ölçüldü (17 Eki 2026, §2): yanlış liste `sx`'i
 * "API : clientId veya token hatalı<clientId>", yanlış sır
 * "API : hashData error" döner. İkisi de kesinti değil yapılandırma hatasıdır
 * ve log satırı hangi değişkene bakılacağını söyler. Değişkenin DEĞERİ hiçbir
 * zaman yazılmaz; POS'un metni de yazılmaz (ilki işyerinin kimliğini geri
 * basıyor).
 */
export function paymentListKeyRefusal(message: string): string | null {
  if (/clientId veya token hatal/i.test(message)) {
    return "paynkolay PaymentList liste anahtarını reddetti (clientId veya token hatalı): PAYNKOLAY_SX_LIST değerini kontrol et";
  }
  if (/hashData error/i.test(message)) {
    return "paynkolay PaymentList hash'i reddetti (hashData error): PAYNKOLAY_MERCHANT_SECRET_KEY değerini kontrol et";
  }
  return null;
}

/** Satırdan alan okur; iki servis iki ayrı yazım kullanıyor. */
function readField(row: Record<string, unknown>, ...names: string[]): string {
  for (const name of names) {
    const value = row[name];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

// ── Sağlayıcı ──────────────────────────────────────────────────────────────

export class PaynkolayPaymentProvider implements PaymentProvider {
  readonly name = "paynkolay";

  private readonly cfg: Omit<
    PaynkolayConfig,
    "baseUrl" | "checkoutMode" | "cardStorage"
  > & {
    baseUrl: string;
    checkoutMode: PaynkolayCheckoutMode;
    cardStorage: boolean;
  };

  constructor(cfg: PaynkolayConfig) {
    this.cfg = {
      ...cfg,
      baseUrl: (cfg.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
      checkoutMode: cfg.checkoutMode ?? "hosted",
      cardStorage: cfg.cardStorage ?? false,
    };
  }

  /** Kart saklama açık mı (yetki + `direct` mod). */
  get cardStorageEnabled(): boolean {
    return this.cfg.cardStorage && this.cfg.checkoutMode === "direct";
  }

  /** Ara sayfa kart formunu mu gösterir, ortak ödeme sayfasına mı gönderir. */
  get checkoutMode(): PaynkolayCheckoutMode {
    return this.cfg.checkoutMode;
  }

  // ── Ara sayfa ────────────────────────────────────────────────────────────

  /**
   * Ara sayfanın taşıdığı yükü imzalar.
   *
   * Form alanlarının çoğu zaten `hashDataV2` ile korunuyor: tutarı ya da
   * `clientRefCode`'u değiştiren müşteriye PayNkolay hash uyuşmazlığı döner.
   * Ama `currencyCode`, `transactionType` ve `use3D` o hash'in DIŞINDA - yani
   * yükü imzalamazsak müşteri `use3D`'yi boşaltıp 3D'siz ödeyebilir ya da
   * `transactionType`'ı `PRESALES` yapıp tahsilatı askıda bırakabilirdi.
   */
  private signBridge(payload: string): string {
    return createHmac("sha256", this.cfg.merchantSecretKey)
      .update(`${BRIDGE_DOMAIN}|${payload}`, "utf8")
      .digest("base64url");
  }

  /** AES-256-GCM anahtarı: sırdan, imzadan ayrı bir alan adıyla türetilir. */
  private sealKey(): Buffer {
    return createHash("sha256")
      .update(`paynkolay-bridge-seal-v1|${this.cfg.merchantSecretKey}`, "utf8")
      .digest();
  }

  /** `direct` modda yükü tarayıcının okuyamayacağı hâle getirir. */
  private seal(json: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.sealKey(), iv);
    const body = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
    return (
      SEALED_PREFIX +
      Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64url")
    );
  }

  private unseal(data: string): string | null {
    try {
      const raw = Buffer.from(data.slice(SEALED_PREFIX.length), "base64url");
      if (raw.length < 12 + 16) return null;
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.sealKey(),
        raw.subarray(0, 12),
      );
      decipher.setAuthTag(raw.subarray(raw.length - 16));
      return Buffer.concat([
        decipher.update(raw.subarray(12, raw.length - 16)),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      return null;
    }
  }

  /**
   * Ara sayfanın URL'den okuduğu yükü çözer ve doğrular. Uymayan her şeyde
   * `null` - sayfa o zaman form kurmaz, müşteriyi hata ekranına gönderir.
   * Şifreli yük yalnızca `direct` modda kabul edilir, düz yük yalnızca
   * `hosted` modda: bir moddan diğerine kopyalanan bağlantı açılmaz.
   */
  readBridgePost(data: string, signature: string): PaynkolayFormPost | null {
    if (!data || !signature) return null;
    if (!safeEqual(this.signBridge(data), signature)) return null;

    const sealed = data.startsWith(SEALED_PREFIX);
    if (sealed !== (this.cfg.checkoutMode === "direct")) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        sealed
          ? (this.unseal(data) ?? "")
          : Buffer.from(data, "base64url").toString("utf8"),
      );
    } catch {
      return null;
    }
    if (!isRecord(parsed) || !isRecord(parsed.fields)) return null;
    if (parsed.action !== this.paymentFormAction()) return null;

    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed.fields)) {
      if (typeof value !== "string") return null;
      fields[key] = value;
    }
    // İmza zaten yeterli; hash'i yeniden hesaplamak, imzalama anahtarı bir gün
    // ayrışırsa bozuk bir formun POS'a gitmesini de engeller.
    if (
      fields.hashDataV2 !==
      checkoutRequestHash(fields, this.cfg.merchantSecretKey)
    ) {
      return null;
    }
    const member =
      typeof parsed.member === "string" &&
      PAYNKOLAY_MEMBER_KEY.test(parsed.member)
        ? parsed.member
        : undefined;
    return { action: parsed.action, fields, ...(member ? { member } : {}) };
  }

  private paymentFormAction(): string {
    return `${this.cfg.baseUrl}/Vpos`;
  }

  /**
   * Yük sitedeki kart formu için hâlâ geçerli mi. Yaşı yükün kendi `rnd`'inden
   * okunur - o alan imzalı ve hash'e giriyor, müşteri değiştiremez.
   */
  isBridgeFresh(post: PaynkolayFormPost, now: Date = new Date()): boolean {
    const issued = parsePaynkolayRnd(post.fields.rnd);
    if (!issued) return false;
    const age = now.getTime() - issued.getTime();
    // Bir dakikalık saat kayması payı; gelecekten gelen yük sahtedir.
    return age >= -60_000 && age <= DIRECT_FORM_MAX_AGE_MS;
  }

  /**
   * Sitede alınan kartla ödemeyi başlatır (`POST /Vpos/v1/Payment`, §15).
   *
   * Alanlar ara sayfanın İMZALI yükünden gelir: tutar, sipariş referansı,
   * dönüş adresleri, `rnd` ve hash müşterinin elinde değiştirilemez. Bu uç
   * aynı istek hash'ini kullanıyor (`sx|clientRefCode|amount|successUrl|
   * failUrl|rnd|customerKey|secret`, sandbox'ta ölçüldü), bu yüzden hash
   * yükten yeniden hesaplanır ve yükteki değerle karşılaştırılır.
   *
   * Kart yalnızca bu isteğin gövdesine girer. Fırlatılan hatalar gövdeyi
   * taşımaz (`postForm`), dönen mesaj kart numarasına benzeyen her diziyi
   * maskeler.
   *
   * `use3D` daima `"true"` (§8): yükteki değer başka bir şeyse istek hiç
   * gitmez.
   */
  async startDirectPayment(
    post: PaynkolayFormPost,
    method: DirectPaymentMethod,
    cardHolderIp: string,
  ): Promise<DirectPaymentResult> {
    const f = post.fields;
    if (f.use3D !== "true" || f.transactionType !== "SALES") {
      throw new Error("paynkolay: yük 3D'li satış değil; ödeme başlatılmadı");
    }
    if (checkoutRequestHash(f, this.cfg.merchantSecretKey) !== f.hashDataV2) {
      throw new Error("paynkolay: yükün hash'i tutmuyor; ödeme başlatılmadı");
    }

    // Kart saklama alanları (§16): saklı kartla ödeme ya da "bu kartı kaydet"
    // yalnızca imzalı yükte üye anahtarı varsa. Anahtar gönderildiğinde
    // hash'teki `customerKey` konumuna o girer (Postman: `csCustomerKey`).
    const storage: Record<string, string> = {};
    let cardFields: Record<string, string> = {};
    if ("savedToken" in method) {
      if (!post.member) {
        throw new Error(
          "paynkolay: saklı kart üye anahtarı olmadan kullanılamaz",
        );
      }
      storage.csCustomerKey = post.member;
      storage.csToken = method.savedToken;
    } else {
      cardFields = {
        cardHolderName: method.card.holderName,
        cardNumber: method.card.number,
        month: method.card.expMonth,
        year: method.card.expYear,
        cvv: method.card.cvv,
      };
      if (method.save && post.member) {
        storage.csCustomerKey = post.member;
        storage.csAutoSave = "true";
        storage.csCardAlias = method.save.alias;
      }
    }
    const hash = paynkolayHash(
      [
        f.sx,
        f.clientRefCode,
        f.amount,
        f.successUrl,
        f.failUrl,
        f.rnd,
        storage.csCustomerKey ?? "",
      ],
      this.cfg.merchantSecretKey,
    );

    const response = unwrapPaynkolayResult(
      await this.postForm(
        DIRECT_PAYMENT_PATH,
        {
          sx: f.sx,
          clientRefCode: f.clientRefCode,
          successUrl: f.successUrl,
          failUrl: f.failUrl,
          amount: f.amount,
          // Taksit yok (§9): tek çekim.
          installmentNo: "1",
          ...cardFields,
          use3D: "true",
          transactionType: "SALES",
          rnd: f.rnd,
          // Bu uçta alan adı küçük `v` ile yazılıyor (§11.1, Postman örneği).
          hashDatav2: hash,
          environment: "API",
          currencyNumber: f.currencyCode || CURRENCY_CODE,
          cardHolderIP: cardHolderIp.trim() || f.cardHolderIP || "0.0.0.0",
          ...storage,
        },
        POS_TIMEOUT_MS.payment,
      ),
    );

    const body = isRecord(response) ? response : {};
    const code = readField(body, "RESPONSE_CODE", "responseCode");
    const html = readField(body, "BANK_REQUEST_MESSAGE");
    if (code === "2" && html) {
      return {
        kind: "3d",
        html,
        referenceCode: readField(body, "REFERENCE_CODE", "referenceCode"),
      };
    }
    const message = maskCardLikeDigits(
      readField(
        body,
        "ERROR_MESSAGE",
        "RESPONSE_DATA",
        "BANK_MESSAGE",
        "responseData",
      )
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    ).slice(0, 200);
    return {
      kind: "declined",
      code: readField(body, "ERROR_CODE", "BANK_ERROR_CODE") || code || "?",
      message,
    };
  }

  // ── Kart saklama (§16) ───────────────────────────────────────────────────

  /**
   * Üyenin PayNkolay'da saklı kartları. Kart yoksa boş liste (sandbox:
   * `ProcReturnCode: "02"`, "Gecerli Kart Yok"); başka her hata fırlatır.
   *
   * Yanıt XML'den çevrilmiş gibi derin: `Data.cards.Card.CardFileds.Detail`
   * (yazım PayNkolay'ın). `Detail` tek kartta da dizi geldi; nesne gelirse de
   * okunur.
   */
  async listSavedCards(member: string): Promise<SavedCard[]> {
    if (!PAYNKOLAY_MEMBER_KEY.test(member)) return [];
    const res = await this.postForm(
      "/Vpos/Payment/CardStorageCardList",
      {
        sx: this.cfg.sx,
        customerKey: member,
        hashDatav2: paynkolayHash(
          [this.cfg.sx, member],
          this.cfg.merchantSecretKey,
        ),
      },
      POS_TIMEOUT_MS.cardList,
    );
    const body = unwrapPaynkolayResult(res);
    if (!isRecord(body)) throw new Error("paynkolay kart listesi okunamadı");
    const code = readField(body, "ProcReturnCode");
    if (code === "02") return [];
    if (code !== "00") {
      throw new Error(
        `paynkolay kart listesi: ${code || "?"} ${readField(body, "ErrMsg")}`.trim(),
      );
    }
    let detail: unknown = body.Data;
    for (const key of ["cards", "Card", "CardFileds", "Detail"]) {
      detail = isRecord(detail) ? detail[key] : undefined;
    }
    const rows = Array.isArray(detail)
      ? detail.filter(isRecord)
      : isRecord(detail)
        ? [detail]
        : [];
    return rows
      .map((row) => ({
        token: readField(row, "Token"),
        tranId: readField(row, "TranId"),
        maskedPan: readField(row, "Maskedpan"),
        bank: readField(row, "CARDISSUER"),
        brand: readField(row, "CARDBRAND"),
        alias: readField(row, "CARD_ALIACE"),
      }))
      .filter((card) => card.token && card.tranId);
  }

  /**
   * Saklı kartı siler. Sandbox'ta yalnız `token` ile çalıştı; `tranId` ile
   * silme "Gecersiz Veri" döndü (Postman "biri yeter" diyor) - bu yüzden
   * token gönderilir, `tranId` boş kalır ama hash'teki konumu korunur.
   */
  async deleteSavedCard(member: string, token: string): Promise<void> {
    if (!PAYNKOLAY_MEMBER_KEY.test(member) || !token) {
      throw new Error("paynkolay: silinecek kart belirsiz");
    }
    const tranId = "";
    const res = unwrapPaynkolayResult(
      await this.postForm(
        "/Vpos/Payment/CardStorageCardDelete",
        {
          sx: this.cfg.sx,
          customerKey: member,
          tranId,
          token,
          hashDatav2: paynkolayHash(
            [this.cfg.sx, member, tranId, token],
            this.cfg.merchantSecretKey,
          ),
        },
        POS_TIMEOUT_MS.cardDelete,
      ),
    );
    const code = isRecord(res) ? readField(res, "RESPONSE_CODE") : "";
    if (code !== "2") {
      throw new Error(
        `paynkolay kart silme: ${code || "?"} ${isRecord(res) ? readField(res, "RESPONSE_DATA") : ""}`.trim(),
      );
    }
  }

  /** Hesap kapanırken: üyenin PayNkolay'daki bütün saklı kartları. */
  async deleteAllSavedCards(member: string): Promise<number> {
    const cards = await this.listSavedCards(member);
    for (const card of cards) await this.deleteSavedCard(member, card.token);
    return cards.length;
  }

  // ── HTTP ─────────────────────────────────────────────────────────────────

  /** Servis çağrıları `multipart/form-data` ister (§2, §3). */
  private async postForm(
    path: string,
    fields: Record<string, string>,
    timeoutMs: number = POS_TIMEOUT_MS.default,
  ): Promise<unknown> {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, value);

    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
      method: "POST",
      body,
      // Ödeme çağrıları asla önbelleğe alınmaz.
      cache: "no-store",
      // Yanıt vermeyen POS isteği (ve onu bekleyen sayfayı, hesap kapatmayı)
      // sonsuza dek tutmasın. Zaman aşımı "ödenmedi" demek değildir (kural
      // 29): çağıranlar hatayı "bilinmiyor" diye ele alır.
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`paynkolay ${path} HTTP ${res.status}`);

    const text = await res.text();
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error(`paynkolay ${path} yanıtı JSON değil`);
    }
  }

  /** İşlem Doğrulama Servisi (§2). Karar `STATUS` alanından verilir. */
  private async queryTransactions(
    clientRefCode: string,
    from: Date,
    to: Date,
  ): Promise<Record<string, unknown>[]> {
    const startDate = formatPaynkolayDayDmy(from);
    const endDate = formatPaynkolayDayDmy(to);
    return paymentListRows(
      await this.postForm("/Vpos/Payment/PaymentList", {
        sx: this.cfg.sxList,
        startDate,
        endDate,
        clientRefCode,
        // Alan adı bu uçta küçük `v` ile yazılıyor (§11.1).
        hashDatav2: paynkolayHash(
          [this.cfg.sxList, startDate, endDate, clientRefCode],
          this.cfg.merchantSecretKey,
        ),
      }),
    );
  }

  /** Raporlama Servisi (§2.1) - `referenceCode` ile arayabilen tek uç. */
  private async reportTransactions(
    referenceCode: string,
    from: Date,
    to: Date,
  ): Promise<Record<string, unknown>[]> {
    const startDate = formatPaynkolayDayDmy(from);
    const endDate = formatPaynkolayDayDmy(to);
    // `clientReferenceCode` boş gidiyor ama hash'teki KONUMU korunuyor:
    // atlanan bir alan hash'i sessizce bozar (§9.1).
    const clientReferenceCode = "";
    return extractRows(
      await this.postForm("/Vpos/Payment/PfTransactionReportList", {
        sx: this.cfg.sxList,
        startDate,
        endDate,
        clientReferenceCode,
        referenceCode,
        pageCount: "1",
        pageSize: "50",
        hashDatav2: paynkolayHash(
          [
            this.cfg.sxList,
            startDate,
            endDate,
            clientReferenceCode,
            referenceCode,
          ],
          this.cfg.merchantSecretKey,
        ),
      }),
    );
  }

  // ── PaymentProvider ──────────────────────────────────────────────────────

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession> {
    const clientRefCode = input.orderId.trim();
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(clientRefCode)) {
      // Doküman: Türkçe karakter yok. Sipariş kimliği zaten ASCII; bu, o
      // kuralın bir gün bozulmasına karşı kilit.
      throw new Error(
        `paynkolay: clientRefCode olarak kullanılamaz: ${clientRefCode}`,
      );
    }

    const amount = minorToPaynkolayAmount(input.amountMinor);
    const rnd = formatPaynkolayRnd(new Date());
    // Kart saklama v1 kapsamı dışında (§9.1): boş dize gider, hash'teki konumu
    // korunur.
    const customerKey = "";
    const successUrl = mergeReturnQuery(this.cfg.successUrl, input.successUrl);
    const failUrl = mergeReturnQuery(this.cfg.failUrl, input.failureUrl);

    // Tek değişken: hash'e giren dize ile forma giden dize aynı olmak zorunda
    // (§5). Bu yüzden alanlar önce kurulur, hash sonra onlardan hesaplanır.
    const fields: Record<string, string> = {
      sx: this.cfg.sx,
      clientRefCode,
      amount,
      currencyCode: CURRENCY_CODE,
      successUrl,
      failUrl,
      rnd,
      // Sabit: ters ibraz sorumluluğunun bankaya geçmesi buna bağlı (§8).
      use3D: "true",
      transactionType: "SALES",
      cardHolderIP: input.buyerIp?.trim() || "0.0.0.0",
      customerKey,
    };
    fields.hashDataV2 = checkoutRequestHash(fields, this.cfg.merchantSecretKey);

    // Kart saklama anahtarı formun alanlarına girmez (ortak ödeme sayfasında
    // `customerKey` boş kalır); yalnızca sitedeki kart formu onu kullanır.
    // Anahtar yalnız `direct` modda, şifreli yükte taşınır: `hosted` modda yük
    // düz base64'tür ve adres çubuğunda, geçmişte okunurdu - orada zaten
    // saklı kart sunulmuyor.
    const member =
      this.cardStorageEnabled &&
      PAYNKOLAY_MEMBER_KEY.test(input.cardUserKey ?? "")
        ? input.cardUserKey
        : undefined;
    const json = JSON.stringify({
      action: this.paymentFormAction(),
      fields,
      member,
    });
    const payload =
      this.cfg.checkoutMode === "direct"
        ? this.seal(json)
        : Buffer.from(json, "utf8").toString("base64url");
    const bridge = new URL(PAYNKOLAY_BRIDGE_PATH, successUrl);
    bridge.searchParams.set("d", payload);
    bridge.searchParams.set("s", this.signBridge(payload));

    return {
      // İade PayNkolay'ın `REFERENCE_CODE`'unu ister; o kod ancak ödeme
      // bittiğinde doğuyor. Burada elimizdeki tek kalıcı referans bizim
      // `clientRefCode`'umuz - `confirmReturn` onu `REFERENCE_CODE` ile
      // değiştirir (§11).
      providerRef: clientRefCode,
      redirectUrl: bridge.toString(),
      expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS).toISOString(),
    };
  }

  /**
   * PayNkolay sunucudan sunucuya bildirim göndermez (§4).
   *
   * Sessizce başarılı dönmek, imzasız bir POST'un siparişi kapatmasına izin
   * verirdi; `undefined` bırakmak da arayüzün zorunlu üyesini karşılamıyor.
   * Bu yüzden metot her çağrıda, nedeniyle birlikte patlar.
   */
  async verifyWebhook(_req: Request): Promise<WebhookEvent> {
    throw new Error(
      "paynkolay: sunucudan sunucuya bildirim (webhook) yoktur - " +
        "sonuç yalnızca /odeme/donus dönüşünden ve İşlem Doğrulama " +
        "Servisi'nden okunur (docs/PAYNKOLAY.md §4). Bu uca gelen istek " +
        "sahtedir ya da yanlış yapılandırmadır.",
    );
  }

  /**
   * Tarayıcı dönüşünü gerçek bir ödemeye çevirir.
   *
   * Dönen parametreler müşterinin tarayıcısından geliyor; hiçbiri delil
   * sayılmaz. Sıra: (1) üye işyeri numarası ve (2) yanıt hash'i - ikisi de
   * yalnızca uyarı, (3) PayNkolay'a sor. Karar üçüncü adımdan çıkar.
   *
   * Üye işyeri numarası eskiden ölümcüldü. Ama sorgu bizim `sx List`'imizle
   * yapılıyor ve yalnız BİZİM işlemlerimizi döndürüyor, satır da tarayıcının
   * getirdiği `REFERENCE_CODE`'la eşleşmek zorunda - yani başka bir üye
   * işyerinin dönüşü zaten geçemez. Ölümcül bırakmak tek bir şey
   * sağlıyordu: `PAYNKOLAY_MERCHANT_NO` panele yanlış girilirse (sx'in
   * başındaki sayı üye işyeri numarası DEĞİL; test hesabında `118591467|…`
   * sx'li işyerinin numarası `400000273`, §12) her gerçek ödeme reddedilir,
   * para çekilmiş müşteri "ödeme alınamadı" görürdü. Hash için de aynı
   * gerekçe: `CURRENCY_CODE` alanı henüz ölçülmedi (§1.3).
   */
  async confirmReturn(
    params: Record<string, string>,
  ): Promise<ReturnConfirmation> {
    const orderId = (params.CLIENT_REFERENCE_CODE ?? "").trim();
    if (!orderId) throw new Error("paynkolay: CLIENT_REFERENCE_CODE yok");
    const returnedRef = (params.REFERENCE_CODE ?? "").trim();

    const failed = (reason: string): ReturnConfirmation => ({
      status: "failed",
      orderId,
      providerRef: returnedRef || orderId,
      amountMinor: 0,
      currency: "TRY",
      raw: {
        source: "paynkolay_return",
        reason,
        params: withoutHolderName(params),
      },
    });

    const merchantNo = (params.MERCHANT_NO ?? "").trim();
    if (merchantNo && merchantNo !== this.cfg.merchantNo.trim()) {
      console.warn(
        `[paynkolay] dönüşteki MERCHANT_NO yapılandırmayla uyuşmuyor order=${orderId} — PAYNKOLAY_MERCHANT_NO'yu kontrol edin; karar sorgudan verilecek`,
      );
    }
    const hashOk = verifyPaynkolayReturnHash(
      params,
      this.cfg.merchantSecretKey,
    );
    if (!hashOk) {
      console.warn(
        `[paynkolay] yanıt hash'i doğrulanamadı order=${orderId} — karar sorgudan verilecek`,
      );
    }

    const now = new Date();
    // Gece yarısını geçen bir ödeme dünün gününe düşer; iki gün taranır.
    const rows = await this.queryTransactions(
      orderId,
      new Date(now.getTime() - DAY_MS),
      now,
    );
    const row = pickTransaction(rows, returnedRef);
    if (!row) return failed("transaction_not_found");

    const status = readField(row, "STATUS", "status").toUpperCase();
    // `NEW` = başlatılmış ama tamamlanmamış; para çekilmemiş (§2, §8.1). Bu,
    // AUTOCOMPLETE ayarı yanlışsa ücretsiz sipariş üretmenin önündeki kilit.
    if (status !== "SUCCESS") return failed(`status_${status || "unknown"}`);
    // Aynı gün iptal edilen satış, PaymentList'te AYNI satırın
    // `TRANSACTION_TYPE: "CANCEL"`, `STATUS: "SUCCESS"` olarak yeniden
    // yazılmasıyla görünür (sandbox, 15 Eki 2026). "SUCCESS" iptalin başarısı;
    // para iade edilmiştir. Yalnızca satış ödeme sayılır - `lookupPayment`'ın
    // kuralı.
    const kind = readField(row, "TRANSACTION_TYPE", "transactionType")
      .trim()
      .toLowerCase();
    if (kind && kind !== "sales") return failed(`transaction_${kind}`);

    const settledMinor = paynkolayAmountToMinor(
      readField(row, "AUTHORIZATION_AMOUNT", "authorizationAmount"),
    );
    if (settledMinor === null || settledMinor <= 0) {
      return failed("amount_unreadable");
    }
    // Tarayıcının söylediği tutar ile POS'un söylediği tutar ayrışıyorsa
    // dönüş kurcalanmıştır; ödeme sayılmaz.
    const postedMinor = paynkolayAmountToMinor(params.AUTHORIZATION_AMOUNT);
    if (postedMinor !== null && postedMinor !== settledMinor) {
      return failed("amount_mismatch");
    }

    return {
      status: "succeeded",
      orderId,
      // İade bu kodu ister, bizim `clientRefCode`'umuzu değil (§11).
      providerRef:
        readField(row, "REFERENCE_CODE", "referenceCode") || returnedRef,
      amountMinor: settledMinor,
      currency: "TRY",
      // Dönüş gövdesi de adsız: belgelenen gövde onu taşımıyor, ama
      // taşırsa da `payment_transactions.raw`'a yazılmasın (kural 28).
      raw: {
        source: "paynkolay_return",
        hashOk,
        params: withoutHolderName(params),
        transaction: withoutHolderName(row),
      },
      ...transactionDay(row),
    };
  }

  /**
   * Siparişin POS'ta başarılı bir işlemi var mı - tarayıcı dönüşü olmadan.
   *
   * 45 dakikalık süpürme ve aynı üyenin yeni ödemesi, ödenmemiş görünen bir
   * siparişi iptal etmeden önce buraya sorar. Dönüş hiç gelmediyse (sekme
   * kapandı, bağlantı koptu) para yine de çekilmiş olabilir; eskiden sipariş
   * saate bakılarak iptal ediliyor, stoğu geri veriliyordu (§14.6/2).
   * Karar `confirmReturn`'deki gibi `STATUS` alanından verilir; `NEW` para
   * değildir. Tutar okunamıyorsa fırlatır: "ödenmedi" demek iptale izin
   * verirdi.
   */
  async lookupPayment(
    orderId: string,
    since: Date,
  ): Promise<ReturnConfirmation | null> {
    const id = orderId.trim();
    if (!id) return null;
    const now = new Date();
    const placed = Number.isFinite(since.getTime())
      ? Math.min(since.getTime(), now.getTime())
      : now.getTime();
    // Gece yarısını geçen bir ödeme dünün gününe düşer; bir gün geriden
    // başla. Ödeme siparişin açıldığı oturumda olur, bu yüzden pencere
    // birkaç günle sınırlı - servis bir aydan uzun aralık kabul etmiyor (§2).
    const rows = await this.queryTransactions(
      id,
      new Date(placed - DAY_MS),
      new Date(Math.min(now.getTime(), placed + LOOKUP_WINDOW_DAYS * DAY_MS)),
    );
    const succeeded = rows.filter(
      (r) => readField(r, "STATUS", "status").toUpperCase() === "SUCCESS",
    );
    const kind = (r: Record<string, unknown>) =>
      readField(r, "TRANSACTION_TYPE", "transactionType").toLowerCase();
    // POS panelinden iptal ya da iade edilmiş bir satış artık para değildir.
    if (
      succeeded.some((r) => ["cancel", "refund", "refundp"].includes(kind(r)))
    ) {
      return null;
    }
    const row = succeeded.find((r) => !kind(r) || kind(r) === "sales");
    if (!row) return null;
    const settledMinor = paynkolayAmountToMinor(
      readField(row, "AUTHORIZATION_AMOUNT", "authorizationAmount"),
    );
    if (settledMinor === null || settledMinor <= 0) {
      throw new Error(
        `paynkolay: ${id} için başarılı işlem var ama tutarı okunamadı`,
      );
    }
    return {
      status: "succeeded",
      orderId: id,
      providerRef: readField(row, "REFERENCE_CODE", "referenceCode") || id,
      amountMinor: settledMinor,
      currency: "TRY",
      raw: { source: "paynkolay_lookup", transaction: withoutHolderName(row) },
      ...transactionDay(row),
    };
  }

  /**
   * `POST /Vpos/v1/CancelRefundPayment` (§3).
   *
   * `providerRef` PayNkolay'ın `REFERENCE_CODE`'udur. İptal/iade servisi
   * ayrıca işlemin TARİHİNİ istiyor. Ödeme satırı onu biliyorsa (`hint`:
   * `payment_transactions."trxDate"` ve tahsil edilen tutar) doğrudan o
   * kullanılır; bilmiyorsa (kolondan önce yazılmış satır) işlem raporlama
   * servisinden aranır ve tarihi de tutarı da oradan okunur.
   *
   * Başarısızlıkta döndürmek yerine fırlatır: admin eylemi yalnızca fırlatılan
   * hatayı yakalıyor, `status: "failed"` dönmek "iade edildi" yazan ama parayı
   * göndermemiş bir kayıt üretirdi.
   */
  async refund(
    providerRef: string,
    amountMinor?: number,
    hint?: RefundHint,
  ): Promise<RefundResult> {
    // İade edilmeyeceği KESİN olan her durum `PaymentRefusedError` ile
    // fırlar (para hareket etmedi, çağıran geri alabilir). İade isteği
    // gönderildikten sonra yanıtın gelmemesi ise düz `Error`'dır: iade olmuş
    // olabilir, "iade edilmedi" sayılmaz (kural 29'un iade karşılığı).
    const referenceCode = providerRef.trim();
    if (!referenceCode) {
      throw new PaymentRefusedError("paynkolay: REFERENCE_CODE boş");
    }

    let tx = storedTransaction(hint);
    if (!tx) {
      try {
        tx = await this.findTransactionByReference(referenceCode);
      } catch (err) {
        // Arama iade isteğinden ÖNCE: iade hiç gönderilmedi.
        throw new PaymentRefusedError(
          `paynkolay: ${referenceCode} işlemi aranamadı, iade denenmedi: ${err instanceof Error ? err.message : "bilinmeyen hata"}`,
        );
      }
    }
    if (!tx) {
      throw new PaymentRefusedError(
        `paynkolay: ${referenceCode} referanslı işlem son ${REFUND_LOOKBACK_MONTHS} ayda bulunamadı; iade edilemez`,
      );
    }
    if (amountMinor != null && amountMinor !== tx.amountMinor) {
      // §3.2: kısmi iadenin `type=refund` küçük tutarla mı yoksa
      // `type=refundp` ile mi yapıldığı doğrulanamadı. Yanlış tutarı sessizce
      // iade etmektense reddediyoruz.
      throw new PaymentRefusedError(
        "paynkolay: kısmi iade desteklenmiyor (docs/PAYNKOLAY.md §3.2); " +
          `işlem tutarı ${tx.amountMinor} kuruş, istenen ${amountMinor} kuruş`,
      );
    }

    // İptal yalnızca aynı gün yapılan işlemler için; sonrası iade (§3.1).
    const type = tx.dayKey === istanbulDayKey(new Date()) ? "cancel" : "refund";
    const amount = minorToPaynkolayAmount(tx.amountMinor);
    const res = unwrapPaynkolayResult(
      await this.postForm(
        "/Vpos/v1/CancelRefundPayment",
        {
          sx: this.cfg.sxCancel,
          referenceCode,
          type,
          amount,
          trxDate: tx.trxDate,
          hashDatav2: paynkolayHash(
            [this.cfg.sxCancel, referenceCode, type, amount, tx.trxDate],
            this.cfg.merchantSecretKey,
          ),
        },
        POS_TIMEOUT_MS.refund,
      ),
    );

    const code = isRecord(res)
      ? readField(res, "responseCode", "RESPONSE_CODE")
      : "";
    if (code !== "2") {
      const message = isRecord(res)
        ? readField(res, "responseData", "RESPONSE_DATA")
        : "";
      const text =
        `paynkolay ${type} reddedildi: responseCode=${code || "?"} ${message}`.trim();
      // Kodsuz bir gövde POS'un cevabı sayılmaz: iade olmuş da olabilir.
      throw code ? new PaymentRefusedError(text) : new Error(text);
    }

    return {
      providerRef: referenceCode,
      amountMinor: tx.amountMinor,
      status: "succeeded",
    };
  }

  /** İşlemi referans koduyla geriye doğru, aylık pencerelerle arar. */
  private async findTransactionByReference(referenceCode: string): Promise<{
    amountMinor: number;
    trxDate: string;
    dayKey: string;
  } | null> {
    const now = Date.now();
    for (let back = 0; back < REFUND_LOOKBACK_MONTHS; back++) {
      const to = new Date(now - back * 30 * DAY_MS);
      const from = new Date(to.getTime() - 30 * DAY_MS);
      const rows = await this.reportTransactions(referenceCode, from, to);
      const row = rows.find(
        (r) =>
          readField(r, "REFERENCE_CODE", "referenceCode") === referenceCode,
      );
      if (!row) continue;

      const amountMinor = paynkolayAmountToMinor(
        readField(row, "AUTHORIZATION_AMOUNT", "authorizationAmount"),
      );
      const day = parsePaynkolayDay(readField(row, "TRX_DATE", "trxDate"));
      if (amountMinor === null || amountMinor <= 0 || !day) return null;
      return { amountMinor, trxDate: day.trxDate, dayKey: day.key };
    }
    return null;
  }
}

/**
 * Doğrulama servisinin satırı, kart sahibinin adı çıkarılmış olarak.
 *
 * Satır `payment_transactions.raw`'a yazılıyor ve `CARD_HOLDER_NAME`
 * taşıyor. İade ve itiraz için işlem referansı, maskeli kart ve banka yeter;
 * adı tutmak bir amaca hizmet etmiyordu (KVKK m.4/2-ç veri en aza indirme,
 * hukuki metinler Ö7).
 */
function withoutHolderName(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const copy = { ...row };
  delete copy.CARD_HOLDER_NAME;
  delete copy.cardHolderName;
  return copy;
}

/**
 * Sorgu satırının `TRX_DATE`'i, ödeme satırına yazılacak biçimde
 * (`YYYY-MM-DD`). Okunamıyorsa hiç alan dönmez; kolon boş kalır ve iade eski
 * aramaya düşer.
 */
function transactionDay(row: Record<string, unknown>): { trxDate?: string } {
  const day = parsePaynkolayDay(readField(row, "TRX_DATE", "trxDate"));
  return day ? { trxDate: day.key } : {};
}

/**
 * Ödeme satırının bildikleri, iadenin aramadan gidebileceği kadar tam mı:
 * okunur bir gün ve sıfırdan büyük bir tahsilat. Değilse `null`; çağıran
 * raporlama servisinde arar, tahmin etmez.
 */
function storedTransaction(hint: RefundHint | undefined): {
  amountMinor: number;
  trxDate: string;
  dayKey: string;
} | null {
  if (!hint) return null;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(hint.trxDate ?? "")
    ? parsePaynkolayDay(hint.trxDate)
    : null;
  const paid = hint.paidMinor;
  if (!day || paid === undefined || !Number.isSafeInteger(paid) || paid <= 0) {
    return null;
  }
  return { amountMinor: paid, trxDate: day.trxDate, dayKey: day.key };
}

/**
 * Aynı `clientRefCode` altında birden çok deneme dönebilir (§2). Doğru satır,
 * tarayıcının getirdiği `REFERENCE_CODE`'a eşit olandır - eşleşme yoksa
 * satır yok sayılır: uydurulmuş bir referans başkasının işlemini kapatmasın.
 */
function pickTransaction(
  rows: Record<string, unknown>[],
  referenceCode: string,
): Record<string, unknown> | undefined {
  if (referenceCode) {
    return rows.find(
      (row) =>
        readField(row, "REFERENCE_CODE", "referenceCode") === referenceCode,
    );
  }
  return (
    rows.find(
      (row) => readField(row, "STATUS", "status").toUpperCase() === "SUCCESS",
    ) ?? rows[0]
  );
}

/**
 * Yapılandırılmış dönüş adresine, çağıranın kendi adresindeki sorgu
 * parametrelerini taşır.
 *
 * `successUrl`/`failUrl` env'den gelir çünkü POST'u karşılayan uç sabittir
 * (`/odeme/donus`), ama çağıran o adrese anlamlı bilgi iliştiriyor:
 * `?promo=dropped` müşteriye kuponunun düştüğünü söyleyen tek ipucu.
 * Sonuçta oluşan dize hem forma hem hash'e aynı değişkenden geçtiği için
 * hash bozulmaz.
 */
function mergeReturnQuery(
  configured: string,
  from: string | undefined,
): string {
  if (!from) return configured;
  try {
    const extra = new URL(from).searchParams;
    if ([...extra].length === 0) return configured;
    const url = new URL(configured);
    for (const [key, value] of extra) url.searchParams.set(key, value);
    return url.toString();
  } catch {
    return configured;
  }
}
