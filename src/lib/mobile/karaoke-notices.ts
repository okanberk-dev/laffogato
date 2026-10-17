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
    text: "Rezervasyonun iptal edildi, ödediğin tutarın tamamı kartına iade edildi. Yansıması bankana göre birkaç iş günü sürebilir.",
  },
  iptal: { tone: "ok", text: "Rezervasyonun iptal edildi." },
  "gec-iptal": { tone: "error", text: KARAOKE_TOO_LATE_MESSAGE },
  "iade-reddedildi": {
    tone: "error",
    text: "İade şu an yapılamadı; rezervasyonun olduğu gibi duruyor. Ekibimize haber gitti.",
  },
  "iade-bekleniyor": {
    tone: "warn",
    text: "İade bankaya iletildi, sonucu bekleniyor. Sana e-postayla döneceğiz; yeniden denemene gerek yok.",
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
    text: "Yeni ödeme sayfası açılamıyor: rezervasyon ya ödendi ya süresi doldu. Süresi dolduysa yeniden rezervasyon yap.",
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
    text: "Ödemen alındı, rezervasyonun kesinleşti. Bilgiler e-postanda.",
  },
  sonuc: {
    tone: "warn",
    text: "Ödeme tamamlanmadıysa kartından para çekilmedi ve rezervasyon kesinleşmedi.",
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
