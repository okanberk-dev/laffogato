// Client-safe (no server-only): the names of the order mails' rows in
// `order_notice_emails`, shared by the sender (order-notices.ts) and the
// order page, which lists the rows and offers "Yeniden gönder".

export const CANCEL_NOTICE_KIND = "cancelled";

/** One "ödemen alındı" per order, whichever confirmation gets there first. */
export const PAID_NOTICE_KIND = "paid";

/** The resend suffix: `paid#resend-2` is the second resend of `paid`. */
export const RESEND_MARK = "#resend-";

/**
 * The status of a FAILED mail row once "Yeniden gönder" got its copy out.
 * Not `failed` any more, so no later trigger of the same mail takes the row
 * over and sends a second copy; not `sent`, because this one never went.
 */
export const RESENT_STATUS = "resent";

/** The mail a kind is (a resend's kind without its suffix). */
export function baseNoticeKind(kind: string): string {
  const at = kind.indexOf(RESEND_MARK);
  return at === -1 ? kind : kind.slice(0, at);
}

/** Whether `kind` is a resend of another row. */
export function isResendKind(kind: string): boolean {
  return kind.includes(RESEND_MARK);
}

/** The customer mails the order page may send again; the staff mail is not one. */
export function isResendableKind(kind: string): boolean {
  const base = baseNoticeKind(kind);
  return (
    base === PAID_NOTICE_KIND ||
    base === CANCEL_NOTICE_KIND ||
    base.startsWith("shipped:") ||
    base.startsWith("refund:")
  );
}
