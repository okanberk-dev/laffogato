import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type {
  CheckoutInput,
  CheckoutSession,
  PaymentProvider,
  RefundHint,
  RefundResult,
  ReturnConfirmation,
  WebhookEvent,
} from "./provider";

/**
 * PayNkolay sanal POS sağlayıcısı — barındırılan ödeme formu.
 *
 * Sözleşmenin tamamı `docs/PAYNKOLAY.md`'de; buradaki `§` göndermeleri o
 * belgenin bölümleridir. Doğrulanamamış her nokta orada işaretli ve §12'de
 * "canlı testte ölçülecek" listesinde.
 *
 * Neden barındırılan form: kart numarası, CVV ve son kullanma tarihi
 * PayNkolay'ın kendi sayfasında girilir; PAN hiçbir zaman bu sunucuya
 * girmez, PCI yüzeyimiz iyzico soyutlamasındakiyle aynı kalır. `cardNumber`
 * kabul eden doğrudan uçlar (`CardStorageCardRegister`) bilinçli olarak
 * kullanılmıyor (§0).
 *
 * Akış:
 *   1. `createCheckoutSession` → PayNkolay'a POST edilecek form alanları (§9)
 *      ve istek hash'i (§10) üretilir. PayNkolay bir yönlendirme URL'si
 *      vermez — form POST ister — bu yüzden alanlar imzalanıp kendi
 *      `/odeme/paynkolay` ara sayfamıza taşınır; uygulama ve tarayıcı tek bir
 *      URL görür (`CheckoutSession.redirectUrl`).
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

/** Ara sayfamızın yolu. Ödeme formunu taşıyıp otomatik submit eder. */
export const PAYNKOLAY_BRIDGE_PATH = "/odeme/paynkolay";

/** İmzanın hangi amaçla üretildiğini sabitler (alan ayrımı). */
const BRIDGE_DOMAIN = "paynkolay-bridge-v1";

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
  /** Panel → "sx (Token)" — ödeme formu. */
  sx: string;
  /** Panel → "sx List" — işlem doğrulama ve raporlama. */
  sxList: string;
  /** Panel → "sx İptal" — iptal/iade. */
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
}

/** Ara sayfanın tarayıcıya kurduğu form. */
export interface PaynkolayFormPost {
  action: string;
  fields: Record<string, string>;
}

// ── Saf yardımcılar (test edilebilir; sınıftan bağımsız) ───────────────────

/**
 * Kuruş integer → PayNkolay'ın beklediği tutar dizesi (§5).
 *
 * Ondalık ayracı nokta, daima iki basamak, binlik ayracı yok: `128010` →
 * `"1280.10"`. Kayan noktaya hiç uğramaz — hash ham dize üzerinden
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

/** `DD.MM.YYYY` — doğrulama ve raporlama servislerinin tarih aralığı (§2). */
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
 * `TRX_DATE`'in biçimi dokümanda yazmıyor (§12) — örneklerde `2021-08-27`
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
 * Servis yanıtından işlem satırlarını çıkarır.
 *
 * Doğrulama servisi alanları `UPPER_SNAKE`, raporlama servisi `camelCase`
 * veriyor ve satırların yanıt gövdesinde hangi anahtarın altında durduğu
 * dokümanda yazmıyor (§12). Bu yüzden yanıt üç biçimde de kabul edilir: dizi,
 * içinde dizi taşıyan nesne, ya da tek satırlık nesne.
 */
function extractRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return readField(payload, "REFERENCE_CODE", "referenceCode") ? [payload] : [];
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

  private readonly cfg: Omit<PaynkolayConfig, "baseUrl"> & { baseUrl: string };

  constructor(cfg: PaynkolayConfig) {
    this.cfg = {
      ...cfg,
      baseUrl: (cfg.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
    };
  }

  // ── Ara sayfa ────────────────────────────────────────────────────────────

  /**
   * Ara sayfanın taşıdığı yükü imzalar.
   *
   * Form alanlarının çoğu zaten `hashDataV2` ile korunuyor: tutarı ya da
   * `clientRefCode`'u değiştiren müşteriye PayNkolay hash uyuşmazlığı döner.
   * Ama `currencyCode`, `transactionType` ve `use3D` o hash'in DIŞINDA — yani
   * yükü imzalamazsak müşteri `use3D`'yi boşaltıp 3D'siz ödeyebilir ya da
   * `transactionType`'ı `PRESALES` yapıp tahsilatı askıda bırakabilirdi.
   */
  private signBridge(payload: string): string {
    return createHmac("sha256", this.cfg.merchantSecretKey)
      .update(`${BRIDGE_DOMAIN}|${payload}`, "utf8")
      .digest("base64url");
  }

  /**
   * Ara sayfanın URL'den okuduğu yükü çözer ve doğrular. Uymayan her şeyde
   * `null` — sayfa o zaman form kurmaz, müşteriyi hata ekranına gönderir.
   */
  readBridgePost(data: string, signature: string): PaynkolayFormPost | null {
    if (!data || !signature) return null;
    if (!safeEqual(this.signBridge(data), signature)) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
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
    return { action: parsed.action, fields };
  }

  private paymentFormAction(): string {
    return `${this.cfg.baseUrl}/Vpos`;
  }

  // ── HTTP ─────────────────────────────────────────────────────────────────

  /** Servis çağrıları `multipart/form-data` ister (§2, §3). */
  private async postForm(
    path: string,
    fields: Record<string, string>,
  ): Promise<unknown> {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, value);

    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
      method: "POST",
      body,
      // Ödeme çağrıları asla önbelleğe alınmaz.
      cache: "no-store",
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
    return extractRows(
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

  /** Raporlama Servisi (§2.1) — `referenceCode` ile arayabilen tek uç. */
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

    const payload = Buffer.from(
      JSON.stringify({ action: this.paymentFormAction(), fields }),
      "utf8",
    ).toString("base64url");
    const bridge = new URL(PAYNKOLAY_BRIDGE_PATH, successUrl);
    bridge.searchParams.set("d", payload);
    bridge.searchParams.set("s", this.signBridge(payload));

    return {
      // İade PayNkolay'ın `REFERENCE_CODE`'unu ister; o kod ancak ödeme
      // bittiğinde doğuyor. Burada elimizdeki tek kalıcı referans bizim
      // `clientRefCode`'umuz — `confirmReturn` onu `REFERENCE_CODE` ile
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
      "paynkolay: sunucudan sunucuya bildirim (webhook) yoktur — " +
        "sonuç yalnızca /odeme/donus dönüşünden ve İşlem Doğrulama " +
        "Servisi'nden okunur (docs/PAYNKOLAY.md §4). Bu uca gelen istek " +
        "sahtedir ya da yanlış yapılandırmadır.",
    );
  }

  /**
   * Tarayıcı dönüşünü gerçek bir ödemeye çevirir.
   *
   * Dönen parametreler müşterinin tarayıcısından geliyor; hiçbiri delil
   * sayılmaz. Sıra: (1) üye işyeri numarası bizimki mi, (2) yanıt hash'i tutuyor
   * mu — tutmuyorsa yalnızca uyarı, çünkü formülün `CURRENCY_CODE` alanı henüz
   * ölçülmedi (§1.3) ve tek başına ret gerçek ödemeleri de reddederdi, (3)
   * PayNkolay'a sor. Karar üçüncü adımdan çıkar.
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
      raw: { source: "paynkolay_return", reason, params },
    });

    const merchantNo = (params.MERCHANT_NO ?? "").trim();
    if (merchantNo && merchantNo !== this.cfg.merchantNo) {
      return failed("merchant_no_mismatch");
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
      raw: { source: "paynkolay_return", hashOk, params, transaction: row },
      ...transactionDay(row),
    };
  }

  /**
   * Siparişin POS'ta başarılı bir işlemi var mı — tarayıcı dönüşü olmadan.
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
    // birkaç günle sınırlı — servis bir aydan uzun aralık kabul etmiyor (§2).
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
      raw: { source: "paynkolay_lookup", transaction: row },
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
    const referenceCode = providerRef.trim();
    if (!referenceCode) throw new Error("paynkolay: REFERENCE_CODE boş");

    const tx =
      storedTransaction(hint) ??
      (await this.findTransactionByReference(referenceCode));
    if (!tx) {
      throw new Error(
        `paynkolay: ${referenceCode} referanslı işlem son ${REFUND_LOOKBACK_MONTHS} ayda bulunamadı; iade edilemez`,
      );
    }
    if (amountMinor != null && amountMinor !== tx.amountMinor) {
      // §3.2: kısmi iadenin `type=refund` küçük tutarla mı yoksa
      // `type=refundp` ile mi yapıldığı doğrulanamadı. Yanlış tutarı sessizce
      // iade etmektense reddediyoruz.
      throw new Error(
        "paynkolay: kısmi iade desteklenmiyor (docs/PAYNKOLAY.md §3.2); " +
          `işlem tutarı ${tx.amountMinor} kuruş, istenen ${amountMinor} kuruş`,
      );
    }

    // İptal yalnızca aynı gün yapılan işlemler için; sonrası iade (§3.1).
    const type = tx.dayKey === istanbulDayKey(new Date()) ? "cancel" : "refund";
    const amount = minorToPaynkolayAmount(tx.amountMinor);
    const res = await this.postForm("/Vpos/v1/CancelRefundPayment", {
      sx: this.cfg.sxCancel,
      referenceCode,
      type,
      amount,
      trxDate: tx.trxDate,
      hashDatav2: paynkolayHash(
        [this.cfg.sxCancel, referenceCode, type, amount, tx.trxDate],
        this.cfg.merchantSecretKey,
      ),
    });

    const code = isRecord(res)
      ? readField(res, "responseCode", "RESPONSE_CODE")
      : "";
    if (code !== "2") {
      const message = isRecord(res)
        ? readField(res, "responseData", "RESPONSE_DATA")
        : "";
      throw new Error(
        `paynkolay ${type} reddedildi: responseCode=${code || "?"} ${message}`.trim(),
      );
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
 * tarayıcının getirdiği `REFERENCE_CODE`'a eşit olandır — eşleşme yoksa
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
