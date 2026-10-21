// Client-safe (no server-only): the one shape a panel action answers with, so
// a modal, a toast and an inline line can all read it the same way.
//
// Today half the actions return `{}` on success and the other half return
// nothing at all; the operator cannot tell "saved" from "nothing happened".
// An action built for ActionModal / ConfirmButton returns an ActionResult.

/**
 * What a panel action answers.
 *
 * - `{ ok: true, message }`: done. `tone: "warning"` when it is done but
 *   something needs a look (the mail could not be sent); the toast then stays
 *   until closed instead of fading after 5 s.
 * - `{ ok: false, error }`: nothing was written (or the write was refused).
 *   `fieldErrors` maps a form field's `name` to its message.
 */
export type ActionResult =
  | { ok: true; message: string; tone?: "success" | "warning" }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** A success answer. */
export function actionOk(
  message: string,
  tone: "success" | "warning" = "success",
): ActionResult {
  return { ok: true, message, tone };
}

/** A refusal; `fieldErrors` are shown under the matching form fields. */
export function actionError(
  error: string,
  fieldErrors?: Record<string, string>,
): ActionResult {
  return fieldErrors && Object.keys(fieldErrors).length > 0
    ? { ok: false, error, fieldErrors }
    : { ok: false, error };
}

/**
 * Zod-style issues as `fieldErrors`: the first message per top-level field.
 * Structural on purpose, so this file does not pull zod into the client.
 */
export function fieldErrorsFromIssues(
  issues: ReadonlyArray<{
    path: ReadonlyArray<PropertyKey>;
    message: string;
  }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const head = issue.path[0];
    if (head === undefined || typeof head === "symbol") continue;
    const key = String(head);
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/**
 * How a customer mail went: `OrderNoticeOutcome` from
 * lib/email/order-notices.ts, or the plain boolean the karaoke notifier
 * returns. Repeated here (not imported) because that module is server-only.
 */
export type MailOutcome =
  "sent" | "failed" | "duplicate" | "not_due" | boolean | null | undefined;

/**
 * The mail half of a result message, so the operator knows whether to call
 * the customer. Empty when no mail was due.
 *
 * `who` is the recipient in the dative ("müşteriye", "üyeye").
 */
export function noticeSentence(
  outcome: MailOutcome,
  who: string = "müşteriye",
): string {
  if (outcome === "sent" || outcome === true) {
    return `${capitalise(who)} e-posta gönderildi.`;
  }
  if (outcome === "failed" || outcome === false) {
    return `E-posta GÖNDERİLEMEDİ, ${who} kendin ulaş.`;
  }
  if (outcome === "duplicate") return "E-posta daha önce gönderilmişti.";
  return "";
}

/**
 * A success answer with the mail sentence appended; a failed mail turns it
 * into a warning so the toast waits for the operator.
 */
export function okWithNotice(
  message: string,
  outcome: MailOutcome,
  who?: string,
): ActionResult {
  const notice = noticeSentence(outcome, who);
  const failed = outcome === "failed" || outcome === false;
  return actionOk(
    notice ? `${message} ${notice}` : message,
    failed ? "warning" : "success",
  );
}

function capitalise(word: string): string {
  return word ? word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1) : "";
}
