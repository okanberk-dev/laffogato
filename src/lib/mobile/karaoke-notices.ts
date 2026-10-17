/**
 * The one-line results the karaoke booking pages show after an action
 * (profile "Karaoke rezervasyonlarım" and the guest's signed page). The
 * actions redirect with a short code; the page turns it into a sentence.
 * Pure: imported by pages and by the tests.
 */

import { KARAOKE_TOO_LATE_MESSAGE } from "./karaoke-time";

export type KaraokeNoticeTone = "ok" | "warn" | "error";

export const KARAOKE_RESULT_NOTICES: Record<
  string,
  { tone: KaraokeNoticeTone; text: string }
> = {
  "iptal-iade": {
    tone: "ok",
    text: "Rezervasyonun iptal edildi ve ödediğin tutarın tamamı kartına iade edildi. İadenin hesabına yansıması bankana göre birkaç iş günü sürebilir.",
  },
  iptal: { tone: "ok", text: "Rezervasyonun iptal edildi." },
  "gec-iptal": { tone: "error", text: KARAOKE_TOO_LATE_MESSAGE },
  "iade-reddedildi": {
    tone: "error",
    text: "İade şu an yapılamadı, rezervasyonun iptal edilmedi ve olduğu gibi duruyor. Ekibimize haber gitti; istersen bizi ara.",
  },
  "iade-bekleniyor": {
    tone: "warn",
    text: "İade isteğin bankaya iletildi ama sonucu henüz gelmedi. Ekibimiz kontrol edip sana e-postayla dönecek; tekrar denemene gerek yok.",
  },
  "odeme-sorulamadi": {
    tone: "warn",
    text: "Ödemenin durumu şu an doğrulanamadı, bu yüzden iptal yapılmadı. Birkaç dakika sonra yeniden dene.",
  },
  "zaten-iptal": {
    tone: "warn",
    text: "Bu rezervasyon zaten iptal edilmiş ya da iadesi sürüyor.",
  },
  yarisma: {
    tone: "warn",
    text: "Rezervasyon az önce değişti. Sayfadaki son durumu kontrol et.",
  },
  "odeme-yok": {
    tone: "warn",
    text: "Bu rezervasyon için yeni bir ödeme sayfası açılamıyor: ya ödendi ya da ödeme süresi doldu. Süresi dolduysa karaoke sayfasından yeniden rezervasyon yapabilirsin.",
  },
  "odeme-acilamadi": {
    tone: "error",
    text: "Ödeme sayfası şu an açılamadı; kartından para çekilmedi. Birazdan tekrar dene.",
  },
  "odeme-dogrulanamadi": {
    tone: "warn",
    text: "Önceki ödemenin durumu şu an doğrulanamadı, bu yüzden yeni ödeme sayfası açılmadı. Birkaç dakika sonra yeniden dene.",
  },
  "cok-deneme": {
    tone: "error",
    text: "Kısa sürede çok fazla ödeme denemesi oldu. Birkaç dakika sonra yeniden dene.",
  },
  "onay-gerekli": {
    tone: "warn",
    text: "İptal için onay adımını kullan.",
  },
};

/** What the payment return says, before the row is read. */
export const KARAOKE_RETURN_NOTICES: Record<
  string,
  { tone: KaraokeNoticeTone; text: string }
> = {
  basarili: {
    tone: "ok",
    text: "Ödemen alındı, rezervasyonun kesinleşti. Bilgileri e-posta adresine de gönderdik.",
  },
  sonuc: {
    tone: "warn",
    text: "Ödemenin sonucu aşağıda. Ödeme tamamlanmadıysa kartından para çekilmedi ve rezervasyon kesinleşmedi.",
  },
};

/** Cancel failure reason → the code the page reads. */
export function cancelNoticeCode(reason: string): string {
  switch (reason) {
    case "too_late":
      return "gec-iptal";
    case "refund_refused":
      return "iade-reddedildi";
    case "refund_unknown":
      return "iade-bekleniyor";
    case "payment_unknown":
      return "odeme-sorulamadi";
    case "not_cancellable":
      return "zaten-iptal";
    case "raced":
      return "yarisma";
    default:
      return "zaten-iptal";
  }
}

/** Reopen failure reason → the code the page reads. */
export function payNoticeCode(reason: string): string {
  switch (reason) {
    case "rate_limited":
      return "cok-deneme";
    case "payment_unavailable":
      return "odeme-acilamadi";
    case "payment_unknown":
      return "odeme-dogrulanamadi";
    default:
      return "odeme-yok";
  }
}
