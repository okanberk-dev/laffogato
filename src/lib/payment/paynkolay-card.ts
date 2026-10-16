/**
 * Sitedeki kart formunun girdisi - doğrulama ve biçim.
 *
 * Operatör kararları: kart sitenin kendi sayfasında girilir ve müşteri
 * doğrudan bankanın 3D ekranına gider (15 Eki 2026); kart artık ödeme
 * sayfasının ta kendisinde, `/odeme`'de girilir (16 Eki 2026, "kart
 * girerken başka sayfaya vs atmasın"). Uygulamanın açtığı ayrı sayfa
 * (`/odeme/paynkolay`) aynen durur. Kart bu sunucudan YALNIZCA PayNkolay'a
 * iletilmek için geçer (docs/PAYNKOLAY.md §15):
 *
 * - Bu modül saftır: veritabanına, loga, ağa dokunmaz; import'u yok, bu
 *   yüzden tarayıcıda da çalışır. Kart burada yalnızca biçimlenir ve
 *   doğrulanır; çağıran onu tek bir isteğe koyar ve bırakır.
 * - Hiçbir hata mesajı kart numarasını ya da CVV'yi taşımaz; formun yeniden
 *   çizilmesi de onları geri basmaz (`tests/saved-cards.test.ts`).
 *
 * Sunucu doğrulaması istemcininkinin yerini tutmaz, onu tekrarlar:
 * `/odeme`'deki form ve ayrı sayfanın betiği yalnızca kolaylıktır. Formun
 * kuralı (`cardFieldErrors`) sunucununkinden gevşek olamaz: formun kabul
 * ettiği kart `parseCardForm`'dan da geçer (testte kanıtlı).
 */

export interface CardInput {
  /** Kart üzerindeki ad, boşlukları sadeleştirilmiş. */
  holderName: string;
  /** Yalnızca rakamlar, 12-19 hane, Luhn'dan geçmiş. */
  number: string;
  /** `MM` */
  expMonth: string;
  /** `YYYY` */
  expYear: string;
  /** 3-4 rakam. */
  cvv: string;
}

export type CardField = "holderName" | "number" | "expiry" | "cvv";

export type CardCheck =
  | { ok: true; card: CardInput }
  | { ok: false; field: CardField; message: string };

/** Formdaki alan adları. Rota ve sayfa aynı sabiti kullanır. */
export const CARD_FORM_FIELDS = {
  holderName: "cardHolderName",
  number: "cardNumber",
  expiry: "cardExpiry",
  cvv: "cardCvv",
} as const;

/** Geleceğe en fazla kaç yıl son kullanma tarihi kabul edilir. */
const MAX_YEARS_AHEAD = 20;

/** Luhn (mod 10) - yazım hatasını POS'a gitmeden yakalar. */
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Sabit UTC+3 (CLAUDE.md kural 22): kartın ayı İstanbul'da biter. */
function istanbulYearMonth(now: Date): { year: number; month: number } {
  const shifted = new Date(now.getTime() + 3 * 60 * 60_000);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

/**
 * `AA/YY`, `AA/YYYY`, `AA YY`, `AAYY` - müşterinin yazabileceği biçimler.
 * Okunamazsa `null`.
 */
export function parseExpiry(
  raw: string,
): { month: number; year: number } | null {
  const text = raw.replace(/\s+/g, "");
  const m =
    /^(\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text) ??
    /^(\d{2})(\d{2}|\d{4})$/.exec(text);
  if (!m) return null;
  const month = Number(m[1]);
  const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { month, year };
}

/**
 * Kart sahibinin adı: harf (Türkçe dahil), boşluk, nokta, kesme, tire.
 * Bankalar adı kart üzerindekiyle karşılaştırmaz ama PayNkolay boş ya da
 * anlamsız adı reddediyor; burada yakalamak müşteriye bir tur kazandırır.
 */
function normalizeHolderName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 60) return null;
  if (!/^[\p{L}][\p{L} .'-]*$/u.test(name)) return null;
  return name;
}

/**
 * Formdan gelen alanları doğrular. İlk hatalı alanı ve müşteriye gösterilecek
 * Türkçe mesajı döndürür; mesajlarda girilen değer YOKTUR.
 */
export function parseCardForm(
  read: (name: string) => string | null | undefined,
  now: Date = new Date(),
): CardCheck {
  const holderName = normalizeHolderName(
    String(read(CARD_FORM_FIELDS.holderName) ?? ""),
  );
  if (!holderName) {
    return {
      ok: false,
      field: "holderName",
      message: "Kart üzerindeki adı yaz.",
    };
  }

  const number = String(read(CARD_FORM_FIELDS.number) ?? "").replace(
    /[\s-]/g,
    "",
  );
  if (!/^\d{12,19}$/.test(number) || !luhnValid(number)) {
    return {
      ok: false,
      field: "number",
      message: "Kart numarası geçerli görünmüyor; kontrol edip yeniden yaz.",
    };
  }

  const expiry = parseExpiry(String(read(CARD_FORM_FIELDS.expiry) ?? ""));
  const today = istanbulYearMonth(now);
  if (
    !expiry ||
    expiry.year < today.year ||
    (expiry.year === today.year && expiry.month < today.month) ||
    expiry.year > today.year + MAX_YEARS_AHEAD
  ) {
    return {
      ok: false,
      field: "expiry",
      message: "Son kullanma tarihini AA/YY olarak yaz (ör. 08/29).",
    };
  }

  const cvv = String(read(CARD_FORM_FIELDS.cvv) ?? "").trim();
  if (!/^\d{3,4}$/.test(cvv)) {
    return {
      ok: false,
      field: "cvv",
      message: "Kartın arkasındaki 3 haneli güvenlik kodunu (CVV) yaz.",
    };
  }

  return {
    ok: true,
    card: {
      holderName,
      number,
      expMonth: String(expiry.month).padStart(2, "0"),
      expYear: String(expiry.year),
      cvv,
    },
  };
}

/**
 * Dışarıdan gelen bir metinde kart numarasına benzeyen her rakam dizisini
 * maskeler. POS'un hata metni müşteriye gösterilir ve loga yazılır; o metnin
 * bir gün girdiyi yankılaması ihtimaline karşı.
 */
export function maskCardLikeDigits(text: string): string {
  return text.replace(/\d(?:[ -]?\d){11,18}/g, "****");
}

// ── /odeme'deki form için yardımcılar (tarayıcıda çalışır) ─────────────────

/** Kart şeması - yalnız numaranın başından okunur, kart için gösterim. */
export type CardBrand = "visa" | "mastercard" | "amex" | "troy" | "unknown";

/**
 * Numaranın ilk hanelerinden şema: Visa `4`, Mastercard `51-55` ve
 * `2221-2720`, American Express `34`/`37`, Troy `9792`, `2205` ve `65`. Belirsiz başlangıç
 * `unknown` kalır; şema yalnız alandaki işaret ve gruplama içindir, kart
 * onunla doğrulanmaz.
 */
export function cardBrand(value: string): CardBrand {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("4")) return "visa";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^5[1-5]/.test(digits)) return "mastercard";
  if (digits.length >= 4) {
    const head = Number(digits.slice(0, 4));
    if (head >= 2221 && head <= 2720) return "mastercard";
    if (head === 9792) return "troy";
    // Troy's other issuer ranges (BKM): 2205 and 65xx. Checked after the
    // other schemes, so a prefix that is theirs stays theirs.
    if (head === 2205) return "troy";
  }
  if (digits.startsWith("65")) return "troy";
  return "unknown";
}

/** Şemanın kartında en çok kaç hane olur. */
export function cardNumberMaxDigits(brand: CardBrand): number {
  return brand === "amex" ? 15 : 19;
}

/** Güvenlik kodunun hane sayısı: American Express'te 4, ötekilerde 3. */
export function cvvLength(brand: CardBrand): number {
  return brand === "amex" ? 4 : 3;
}

/** Kartın üstündeki gibi gruplar: Amex 4-6-5, ötekiler 4-4-4-4(-3). */
export function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  const groups = cardBrand(digits) === "amex" ? [4, 6, 5] : [4, 4, 4, 4, 3];
  const out: string[] = [];
  let at = 0;
  for (const size of groups) {
    if (at >= digits.length) break;
    out.push(digits.slice(at, at + size));
    at += size;
  }
  return out.join(" ");
}

/**
 * Kart numarası alanına yazılanı yeniden biçimler ve imleci aynı hanenin
 * arkasında tutar - ortadan bir hane silmek imleci sona atmasın.
 */
export function reformatCardNumber(
  raw: string,
  caret: number,
): { value: string; caret: number } {
  const before = raw.slice(0, Math.max(0, caret)).replace(/\D/g, "").length;
  const all = raw.replace(/\D/g, "");
  const digits = all.slice(0, cardNumberMaxDigits(cardBrand(all)));
  const value = formatCardNumber(digits);
  const want = Math.min(before, digits.length);
  let pos = 0;
  let seen = 0;
  while (pos < value.length && seen < want) {
    if (value[pos] >= "0" && value[pos] <= "9") seen += 1;
    pos += 1;
  }
  return { value, caret: pos };
}

/**
 * Son kullanma alanına yazılanı `AA/YY` yapar (ayrı sayfanın betiğindeki
 * kuralın aynısı): `/` kendiliğinden gelir, tek haneli aydan sonra yazılan
 * ayraç ya da 2-9 ile başlayan ay başa sıfır koyar, Chrome'un doldurduğu
 * `AA/YYYY` ("08/2029") olduğu gibi kalır, silerken `/` geri eklenmez.
 */
export function formatExpiryInput(raw: string, deleting: boolean): string {
  let digits = raw.replace(/\D/g, "");
  if (/^\d\D/.test(raw)) digits = `0${digits}`;
  if (!deleting && digits.length === 1 && digits > "1") digits = `0${digits}`;
  if (digits.length > 4 && digits.slice(2, 4) === "20") {
    digits = digits.slice(0, 6);
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  digits = digits.slice(0, 4);
  if (deleting && digits.length <= 2) return digits;
  return digits.length >= 2
    ? `${digits.slice(0, 2)}/${digits.slice(2)}`
    : digits;
}

/**
 * `/odeme`'deki formun alan alan kontrolü: alanın altında gösterilecek
 * mesaj, kartın kendisini asla taşımadan. Kurallar `parseCardForm`'un
 * aynısı ya da ondan sıkı (güvenlik kodu şemanın hane sayısında olmalı), yani
 * burada hata yoksa sunucu da kabul eder.
 */
export function cardFieldErrors(
  read: (name: string) => string | null | undefined,
  now: Date = new Date(),
): Partial<Record<CardField, string>> {
  const errors: Partial<Record<CardField, string>> = {};
  if (!normalizeHolderName(String(read(CARD_FORM_FIELDS.holderName) ?? ""))) {
    errors.holderName = "Kart üzerindeki adı yaz.";
  }

  const number = String(read(CARD_FORM_FIELDS.number) ?? "").replace(
    /[\s-]/g,
    "",
  );
  if (!/^\d{12,19}$/.test(number) || !luhnValid(number)) {
    errors.number = "Kart numarası eksik ya da hatalı.";
  }

  const raw = String(read(CARD_FORM_FIELDS.expiry) ?? "");
  const expiry = parseExpiry(raw);
  const today = istanbulYearMonth(now);
  if (!expiry) {
    errors.expiry = "Son kullanma tarihini AA/YY olarak yaz.";
  } else if (
    expiry.year < today.year ||
    (expiry.year === today.year && expiry.month < today.month)
  ) {
    errors.expiry = "Son kullanma tarihi geçmiş.";
  } else if (expiry.year > today.year + MAX_YEARS_AHEAD) {
    errors.expiry = "Son kullanma tarihini kontrol et.";
  }

  const cvv = String(read(CARD_FORM_FIELDS.cvv) ?? "").trim();
  const length = cvvLength(cardBrand(number));
  if (!new RegExp(`^\\d{${length}}$`).test(cvv)) {
    errors.cvv = `Güvenlik kodu ${length} haneli olmalı.`;
  }
  return errors;
}
