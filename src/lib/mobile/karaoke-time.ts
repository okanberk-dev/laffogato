/**
 * The clock rules of a paid karaoke booking, with no dependencies at all.
 *
 * Kept apart from `karaoke-core.ts` for the reason `karaoke-quote.ts` is: the
 * web booking form (a client component) prints the cancellation deadline and
 * the payment window, and a value import from `karaoke-core` ships all of Zod
 * to the browser. The server, the mobile endpoints and the tests import these
 * through `karaoke-core`, which re-exports them.
 *
 * Every instant here is the köşk's (Europe/Istanbul, fixed UTC+3 - CLAUDE.md
 * rule 22): a booking is a Tuzla calendar day and hour, and the server's own
 * clock is UTC.
 */

const HOUR_MS = 60 * 60_000;
const MINUTE_MS = 60_000;
const ISTANBUL_OFFSET_MS = 3 * HOUR_MS;

/**
 * The member may cancel on their own up to this many hours before the start,
 * and gets the whole payment back (operator, 16 Eki 2026). Later, or not
 * turning up, refunds nothing. PayNkolay refunds whole payments only
 * (docs/PAYNKOLAY.md §3.2), so there is no partial step in between.
 */
export const KARAOKE_FREE_CANCEL_HOURS = 2;

/**
 * How long one payment page takes the card: the site's card form refuses a
 * payload older than this (`DIRECT_FORM_MAX_AGE_MS` in paynkolay.ts, which
 * tests/karaoke-time.test.ts holds equal). The hold's `paymentDueAt` is the
 * newest page's own deadline, so no page outlives the hold it pays for.
 */
export const KARAOKE_PAYMENT_PAGE_MINUTES = 30;

/**
 * A new payment page can be opened for an unpaid hold only this long after
 * the booking was made (a declined card, a closed tab). Past it the member
 * books again: without a ceiling, reopening every half hour would hold an
 * hour for as long as someone cared to keep clicking.
 */
export const KARAOKE_PAYMENT_REOPEN_MINUTES = 30;

/**
 * After the last page closes, the bank's 3-D Secure step may still be under
 * way. The sweep leaves the hold alone for this long more - the same margin
 * the order sweep keeps (45 minutes against a 30-minute form).
 */
export const KARAOKE_PAYMENT_GRACE_MINUTES = 15;

/** The instant `startHour:00` on `date` begins in Tuzla. */
export function karaokeStartInstant(date: string, startHour: number): Date {
  const [y, m, d] = date.split("-").map((s) => parseInt(s, 10));
  return new Date(Date.UTC(y, m - 1, d, startHour) - ISTANBUL_OFFSET_MS);
}

/** The instant the booked block ends in Tuzla (24:00 is the next midnight). */
export function karaokeEndInstant(r: {
  date: string;
  startHour: number;
  hours: number;
}): Date {
  return new Date(
    karaokeStartInstant(r.date, r.startHour).getTime() + r.hours * HOUR_MS,
  );
}

/** The last moment the member may still cancel the booking themselves. */
export function karaokeCancelDeadline(r: {
  date: string;
  startHour: number;
}): Date {
  return new Date(
    karaokeStartInstant(r.date, r.startHour).getTime() -
      KARAOKE_FREE_CANCEL_HOURS * HOUR_MS,
  );
}

/**
 * True while the member may still cancel (and be refunded in full): MORE than
 * two hours before the start - the operator's words are "2 saatten fazla
 * varken", so at exactly two hours the window has closed.
 */
export function withinFreeCancel(
  r: { date: string; startHour: number },
  now: Date,
): boolean {
  return now.getTime() < karaokeCancelDeadline(r).getTime();
}

/**
 * The cancellation rule in the operator's own words (16 Eki 2026: "2 saat
 * sonrası iptalde ücret iadesi yoktur gibisinden de yaz"). Every place the
 * rule appears prints these two sentences verbatim - the pre-payment box
 * (once: the summary card no longer repeats it), the reservation page and its
 * cancel step, the late-cancel refusal (web and API) and the confirmation
 * e-mail - tests/karaoke-prepay-rules.test.ts holds each of them to it.
 */
export const KARAOKE_REFUND_RULE =
  "Rezervasyon saatine 2 saatten fazla varken iptal edersen ödediğin tutarın tamamı kartına iade edilir.";
export const KARAOKE_NO_REFUND_RULE =
  "Rezervasyon saatine 2 saatten az kala yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.";

/** MSY m.15/1-g, stated before the payment (m.5/1-h, m.6/2-a). */
export const KARAOKE_NO_WITHDRAWAL =
  "Belirli bir tarihte sunulan eğlence hizmeti olduğu için cayma hakkı yoktur (MSY m.15/1-g).";

/** MSY m.16/4: the business cancelling refunds everything. */
export const KARAOKE_BUSINESS_CANCEL =
  "Rezervasyonu biz karşılayamazsak ödediğin tutarın tamamını kartına iade ederiz.";

/** The refusal of a self-cancel inside the last two hours. */
export const KARAOKE_TOO_LATE_MESSAGE = `Artık buradan iptal edemezsin. ${KARAOKE_NO_REFUND_RULE}`;

/** `paymentDueAt` for a payment page opened at `issuedAt`. */
export function paymentDueFrom(issuedAt: Date): string {
  return new Date(
    issuedAt.getTime() + KARAOKE_PAYMENT_PAGE_MINUTES * MINUTE_MS,
  ).toISOString();
}

/**
 * The `paymentDueAt` before which the sweep must leave a hold alone: an
 * unpaid hold is swept only once its newest page closed AND the grace for the
 * bank's step has passed.
 */
export function sweepCutoff(now: Date): string {
  return new Date(
    now.getTime() - KARAOKE_PAYMENT_GRACE_MINUTES * MINUTE_MS,
  ).toISOString();
}

/** May a new payment page still be opened for this unpaid hold? */
export function mayReopenPayment(r: { createdAt: string }, now: Date): boolean {
  const made = Date.parse(r.createdAt);
  if (!Number.isFinite(made)) return false;
  return now.getTime() - made < KARAOKE_PAYMENT_REOPEN_MINUTES * MINUTE_MS;
}

/** "20:00" for an ISO instant, on the köşk's clock. */
export function istanbulTimeLabel(iso: string): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const local = new Date(at + ISTANBUL_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}
