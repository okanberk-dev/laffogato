import { CHECKOUT_DOCUMENT_PATH } from "@/lib/security/checkout-document";

/**
 * Why a payment came back to /odeme, as a fixed list of codes.
 *
 * The site's card form posts to /odeme/paynkolay. When that request cannot
 * go on to the bank (the card fails a check, the POS says no or is down, too
 * many tries, the payment page expired) the route answers
 * `303 /odeme?odeme=<code>[&alan=<field>][&dk=<minutes>]` and the checkout
 * shows the copy below. Nothing else rides in the URL: never the POS's own
 * message (free text from outside, phishing material in a link), never a
 * card detail, never the order. `?error=payment` (the bank's 3D step failed,
 * from /odeme/donus) and `?error=consent` keep their old spelling.
 *
 * Pure and client-safe: the payment route writes these codes, the checkout
 * page reads them, `tests/frontend-form-contract.test.ts` pins the list.
 */

export const CHECKOUT_RETURN_CODES = [
  "kart_hatali",
  "reddedildi",
  "cok_deneme",
  "baslatilamadi",
  "sure_doldu",
  "kart_yok",
  "kart_secimi",
] as const;

export type CheckoutReturnCode = (typeof CHECKOUT_RETURN_CODES)[number];

/** The card field a `kart_hatali` points at, in the URL's own words. */
export const CHECKOUT_RETURN_FIELDS = [
  "ad",
  "numara",
  "skt",
  "guvenlik",
] as const;

export type CheckoutReturnField = (typeof CHECKOUT_RETURN_FIELDS)[number];

/** Every reason /odeme can open with: the route's codes and the two old ones. */
export type CheckoutReturnReason = CheckoutReturnCode | "payment" | "consent";

export interface CheckoutReturn {
  reason: CheckoutReturnReason;
  field?: CheckoutReturnField;
  /** Minutes to wait, for `cok_deneme`. */
  minutes?: number;
}

const MAX_MINUTES = 24 * 60;

function clampMinutes(minutes: number): number {
  return Math.min(MAX_MINUTES, Math.max(1, Math.ceil(minutes)));
}

/** `/odeme?odeme=<code>…` - the only shape the payment route sends back. */
export function checkoutReturnPath(
  code: CheckoutReturnCode,
  extra: { field?: CheckoutReturnField; minutes?: number } = {},
): string {
  const query = new URLSearchParams({ odeme: code });
  if (extra.field) query.set("alan", extra.field);
  if (extra.minutes !== undefined && Number.isFinite(extra.minutes)) {
    query.set("dk", String(clampMinutes(extra.minutes)));
  }
  return `${CHECKOUT_DOCUMENT_PATH}?${query.toString()}`;
}

type QueryValue = string | string[] | undefined;

function first(value: QueryValue): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function isOneOf<T extends string>(
  list: readonly T[],
  value: string,
): value is T {
  return (list as readonly string[]).includes(value);
}

/**
 * The reason in /odeme's query string, or `null`. Anything outside the
 * fixed lists is ignored: a hand-made link cannot put its own words on the
 * checkout page.
 */
export function readCheckoutReturn(query: {
  odeme?: QueryValue;
  alan?: QueryValue;
  dk?: QueryValue;
  error?: QueryValue;
}): CheckoutReturn | null {
  const code = first(query.odeme);
  if (isOneOf(CHECKOUT_RETURN_CODES, code)) {
    const out: CheckoutReturn = { reason: code };
    const field = first(query.alan);
    if (code === "kart_hatali" && isOneOf(CHECKOUT_RETURN_FIELDS, field)) {
      out.field = field;
    }
    const minutes = Number(first(query.dk));
    if (
      code === "cok_deneme" &&
      Number.isInteger(minutes) &&
      minutes >= 1 &&
      minutes <= MAX_MINUTES
    ) {
      out.minutes = minutes;
    }
    return out;
  }
  const error = first(query.error);
  if (error === "payment" || error === "consent") return { reason: error };
  return null;
}

export interface CheckoutReturnCopy {
  title: string;
  reason: string;
  /** "Kartından para çekilmedi." is shown only where it is true. */
  notCharged: boolean;
}

const FIELD_HINT: Record<CheckoutReturnField, string> = {
  ad: "Kart üzerindeki adı kontrol et.",
  numara: "Kart numarasını kontrol et.",
  skt: "Son kullanma tarihini kontrol et.",
  guvenlik: "Güvenlik kodunu kontrol et.",
};

/**
 * The copy for each reason. Every one of them is reached before money moves:
 * the route answers these before the POS is asked or after it refused to
 * start the payment, and `?error=payment` is a return the POS's own record
 * says did not succeed (`confirmReturn`). So "no money was taken" is true
 * for all of them; the flag is kept so a future reason has to decide.
 */
export function checkoutReturnCopy(ret: CheckoutReturn): CheckoutReturnCopy {
  switch (ret.reason) {
    case "payment":
      return {
        title: "Ödeme tamamlanmadı",
        reason:
          "Banka ödemeyi onaylamadı ya da 3D Secure doğrulaması tamamlanmadı. Bilgileri kontrol edip yeniden deneyebilir ya da başka bir kart kullanabilirsin.",
        notCharged: true,
      };
    case "consent":
      return {
        title: "Sözleşme onayı gerekli",
        reason:
          "Siparişi tamamlamak için Ön Bilgilendirme Formu'nu ve Mesafeli Satış Sözleşmesi'ni onaylaman gerekiyor. İki kutuyu da işaretleyip yeniden dene.",
        notCharged: true,
      };
    case "kart_hatali":
      return {
        title: "Ödeme tamamlanmadı",
        reason: `Kart bilgilerinden biri hatalı görünüyor. ${ret.field ? FIELD_HINT[ret.field] : "Bilgileri kontrol edip yeniden dene."}`,
        notCharged: true,
      };
    case "reddedildi":
      return {
        title: "Ödeme tamamlanmadı",
        reason:
          "Kartın bu ödemeyi kabul etmedi. Bilgileri kontrol edip yeniden dene ya da başka bir kart kullan.",
        notCharged: true,
      };
    case "cok_deneme":
      return {
        title: "Ödeme tamamlanmadı",
        reason: ret.minutes
          ? `Çok fazla deneme yapıldı. Güvenliğin için ${ret.minutes} dakika sonra yeniden dene.`
          : "Çok fazla deneme yapıldı. Güvenliğin için biraz bekleyip yeniden dene.",
        notCharged: true,
      };
    case "baslatilamadi":
      return {
        title: "Ödeme başlatılamadı",
        reason: "Ödeme şu an başlatılamadı. Birazdan yeniden dene.",
        notCharged: true,
      };
    case "sure_doldu":
      return {
        title: "Ödeme süresi doldu",
        reason:
          "Ödeme sayfasının süresi doldu. Sepetin ve adresin duruyor; yeniden deneyebilirsin.",
        notCharged: true,
      };
    case "kart_yok":
      return {
        title: "Kayıtlı kart bulunamadı",
        reason:
          "Seçtiğin kayıtlı kart bulunamadı. Yeni kartla öde ya da başka bir kart seç.",
        notCharged: true,
      };
    case "kart_secimi":
      return {
        title: "Ödeme tamamlanmadı",
        reason:
          "Yeni bir kart yazdın ama kayıtlı kartın seçiliydi. Yeni kartla ödemek için önce “Yeni kartla öde”yi seç.",
        notCharged: true,
      };
  }
}
