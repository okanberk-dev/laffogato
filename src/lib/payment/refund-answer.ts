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
 * answered: a known case in plain Turkish, "" for anything else (the
 * caller's own sentence then stands alone; the raw text is in the log).
 */
export function refundAnswerForStaff(
  message: string | null | undefined,
): string {
  const text = message ?? "";
  if (isAlreadyReversed(text)) {
    return "PayNkolay bu ödemenin daha önce iptal ya da iade edildiğini söylüyor; para ikinci kez gönderilmedi";
  }
  if (/kısmi iade/i.test(text)) {
    return "PayNkolay kısmi iade yapamıyor; tutarı PayNkolay panelinden iade et";
  }
  if (/iadesi zaten başlatılmış/i.test(text)) {
    return "bu ödemenin iadesi zaten başlatılmış, sonucu bekleniyor";
  }
  if (/sağlayıcısı kurulamadı/i.test(text)) {
    return "ödeme sağlayıcısına bağlanılamadı, istek gönderilmedi";
  }
  return "";
}
