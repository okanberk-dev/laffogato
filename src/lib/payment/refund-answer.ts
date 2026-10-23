// Pure (no I/O, no "server-only"): a POS refund's failure, in words the
// operator reads.
//
// The provider's own text ("paynkolay refund reddedildi: responseCode=0 Bu
// kayıt daha önce iptal edilmiştir..!") is for the server log and the audit
// row. A message, an alert e-mail or a history line the operator reads gets
// one of the sentences below, or nothing.

/**
 * PayNkolay's answer to a refund of a payment it already cancelled or
 * refunded, from its own panel or an earlier request (22 Eki 2026).
 */
export function isAlreadyReversed(message: string): boolean {
  return /daha önce (iptal|iade)/i.test(message);
}

/**
 * What the operator is told about a refund the POS refused or never
 * answered: each answer the site knows (PayNkolay's, and the site's own
 * from `runRefund` and the karaoke cancel) in plain Turkish, "" for anything
 * else (the caller's own sentence then stands alone; the raw text is in the
 * log). The site's own warnings are kept: a refused retry may follow a
 * refund that went through, and a missing payment row means nothing was
 * sent to the POS.
 */
export function refundAnswerForStaff(
  message: string | null | undefined,
): string {
  const text = message ?? "";
  if (isAlreadyReversed(text)) {
    return "PayNkolay bu ödemenin daha önce iptal ya da iade edildiğini söylüyor; para ikinci kez gönderilmedi";
  }
  if (/ikinci iadeyi reddetti/i.test(text)) {
    return "PayNkolay ikinci iade isteğini reddetti; ilk iade geçmiş olabilir";
  }
  if (/kısmi iade/i.test(text)) {
    return "PayNkolay kısmi iade yapamıyor; tutarı PayNkolay panelinden iade et";
  }
  if (/iadesi zaten başlatılmış/i.test(text)) {
    return "bu ödemenin iadesi zaten başlatılmış, sonucu bekleniyor";
  }
  if (/[öÖ]deme kaydı bulunamadı/.test(text)) {
    return "ödeme kaydı bulunamadı; POS'a iade isteği gönderilmedi";
  }
  if (/işlem son \d+ ayda bulunamadı|REFERENCE_CODE boş/i.test(text)) {
    return "PayNkolay'da bu ödeme bulunamadı; iade isteği gönderilmedi";
  }
  if (/aranamadı, iade denenmedi|sağlayıcısı kurulamadı/i.test(text)) {
    return "ödeme sağlayıcısına bağlanılamadı; iade isteği gönderilmedi";
  }
  return "";
}
