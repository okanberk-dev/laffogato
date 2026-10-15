/**
 * Sitedeki kart formunun girdisi - doğrulama ve biçim.
 *
 * Operatör kararı (15 Eki 2026): müşteri kartını sitenin kendi ödeme
 * sayfasında (`/odeme/paynkolay`) girer ve doğrudan bankanın 3D ekranına
 * gider; PayNkolay'ın ortak ödeme sayfası araya girmez. Kart bu sunucudan
 * YALNIZCA PayNkolay'a iletilmek için geçer (docs/PAYNKOLAY.md §15):
 *
 * - Bu modül saftır: veritabanına, loga, ağa dokunmaz. Kart burada yalnızca
 *   biçimlenir ve doğrulanır; çağıran onu tek bir isteğe koyar ve bırakır.
 * - Hiçbir hata mesajı kart numarasını ya da CVV'yi taşımaz; formun yeniden
 *   çizilmesi de onları geri basmaz (`tests/saved-cards.test.ts`).
 *
 * Sunucu doğrulaması istemcininkinin yerini tutmaz, onu tekrarlar: sayfadaki
 * betik yalnızca kolaylıktır, betiksiz form da aynı kurallardan geçer.
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
