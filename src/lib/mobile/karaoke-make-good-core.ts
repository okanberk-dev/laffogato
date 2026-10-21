import type { KaraokeCancelCause } from "./karaoke-cancel-cause";
import {
  karaokeLateRefundMinor,
  karaokeSelfCancelTerms,
  withinFreeCancel,
} from "./karaoke-time";

/**
 * The köşk's late cancel made good, and the hour cancelled late and sold
 * again (karaoke terms §8, §9; 21 Eki 2026). Pure and dependency-free like
 * karaoke-time.ts: the panel's page, the server and the tests reason about
 * one set of rules; karaoke-payment.ts and karaoke.ts do the writing.
 *
 * ## Make-good (OP-KARAOKE-GOODWILL, Haksız Şartlar Yön. EK-1 (ç))
 *
 * A guest who lets go of a promised hour late keeps no refund for the part
 * the booking's rule keeps. When the köşk lets go of it as late, for its own
 * reason, the guest gets the same value back on top of the full refund:
 * an hour of the same length for free, booked within 6 months, or the
 * amount paid to their own bank account (karaoke terms §8).
 *
 * - Only `ariza`, `kapanis` and `diger`: force majeure frees the köşk (TBK
 *   m.136/2: only what was received goes back), and a guest's own request
 *   or an hour given to another guest is not the köşk's cancel.
 * - Only after the booking's own free moment (`withinFreeCancel`): earlier,
 *   the guest could have cancelled for nothing too, so the full refund is
 *   the whole story.
 * - Only what a late cancel by the guest at that instant would keep
 *   (`karaokeKeptShareMinor`): the whole payment under 2 hours / 0 %, the
 *   rest of the payment under a late share, nothing under 100 %.
 *
 * ## Resale (ASK-OTH-3-CFG, TBK m.325/2 kıyasen)
 *
 * An hour a guest cancelled late and paid a share for, that is then sold to
 * someone else, refunds that share for the hour: each hour once, to the
 * booking that last cancelled it late; an hour a booking was already
 * refunded for is not counted again (`resoldHours`).
 */

/** The köşk's own reasons that make good a late cancel. */
export const KARAOKE_MAKE_GOOD_CAUSES = ["ariza", "kapanis", "diger"] as const;

export type KaraokeMakeGoodCause = (typeof KARAOKE_MAKE_GOOD_CAUSES)[number];

export function isMakeGoodCause(
  cause: KaraokeCancelCause | string | undefined,
): cause is KaraokeMakeGoodCause {
  return cause === "ariza" || cause === "kapanis" || cause === "diger";
}

/** The free hour is booked within this many months of the cancel (§8). */
export const KARAOKE_MAKE_GOOD_MONTHS = 6;

/** The money option is paid within this many days of the bank details. */
export const KARAOKE_MAKE_GOOD_PAY_DAYS = 14;

const HOUR_MS = 60 * 60_000;
/** Türkiye keeps UTC+3 all year (rule 22). */
const ISTANBUL_OFFSET_MS = 3 * HOUR_MS;

/** The Istanbul calendar day of an instant, `YYYY-MM-DD`. */
export function istanbulDayOf(at: Date): string {
  return new Date(at.getTime() + ISTANBUL_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * `day` plus `months` calendar months (TBK m.92/3): the day of the last
 * month that answers the first one, or that month's last day when it has
 * none (31 Ağustos + 6 ay = 28 Şubat, or 29 in a leap year).
 */
export function addCalendarMonths(day: string, months: number): string {
  const [y, m, d] = day.split("-").map((s) => parseInt(s, 10));
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** A booking as the money rules read it. */
type Money = Parameters<typeof karaokeSelfCancelTerms>[0] & {
  status: string;
  paidMinor?: number;
  totalMinor: number;
};

function paidOf(r: { paidMinor?: number; totalMinor: number }): number {
  return r.paidMinor && r.paidMinor > 0 ? r.paidMinor : r.totalMinor;
}

/**
 * What a late cancel by the guest at `at` would keep, kuruş: the payment
 * minus what the booking's own rule refunds then. Nothing inside the free
 * window, nothing for a booking the köşk never confirmed (it was never
 * promised: it goes back in full, as `cancelKaraokeReservation` does).
 */
export function karaokeKeptShareMinor(r: Money, at: Date): number {
  if (r.status !== "confirmed") return 0;
  const paid = paidOf(r);
  if (paid <= 0) return 0;
  const terms = karaokeSelfCancelTerms(r, at);
  if (terms.kind === "full") return 0;
  if (terms.kind === "refused") return paid;
  return Math.max(0, paid - karaokeLateRefundMinor(paid, terms.percent));
}

/** A make-good: its amount and the last day the free hour can be booked. */
export interface KaraokeMakeGood {
  /** `YYYY-MM-DD`, Istanbul, inclusive. */
  until: string;
  minor: number;
}

/**
 * The make-good a köşk cancel of a PAID booking at `at` gives, or null.
 * `cause` is the panel's code (karaoke-cancel-cause.ts).
 */
export function karaokeMakeGoodFor(
  r: Money,
  cause: KaraokeCancelCause | undefined,
  at: Date,
): KaraokeMakeGood | null {
  if (!isMakeGoodCause(cause)) return null;
  if (withinFreeCancel(r, at)) return null;
  const minor = karaokeKeptShareMinor(r, at);
  if (minor <= 0) return null;
  return {
    until: addCalendarMonths(istanbulDayOf(at), KARAOKE_MAKE_GOOD_MONTHS),
    minor,
  };
}

/** A cancelled booking's make-good, as the panel and the mails read it. */
export interface MakeGoodRow {
  status: string;
  makeGoodUntil?: string | null;
  makeGoodMinor?: number | null;
  makeGoodUsedAt?: string | null;
  makeGoodPaidMinor?: number | null;
  makeGoodPaidOn?: string | null;
}

/**
 * - `none`: no make-good on this booking;
 * - `open`: neither option used yet (the free hour until `makeGoodUntil`,
 *   the money any time);
 * - `hour`: a free hour was given (the hour itself points back with
 *   `makeGoodFor`);
 * - `paid`: the amount was paid by bank transfer.
 */
export type KaraokeMakeGoodState = "none" | "open" | "hour" | "paid";

export function makeGoodStateOf(r: MakeGoodRow): KaraokeMakeGoodState {
  if (
    r.status !== "cancelled" ||
    !r.makeGoodUntil ||
    typeof r.makeGoodMinor !== "number" ||
    r.makeGoodMinor <= 0
  ) {
    return "none";
  }
  if (!r.makeGoodUsedAt) return "open";
  return typeof r.makeGoodPaidMinor === "number" ? "paid" : "hour";
}

/** May the free hour still be given on `today` (YYYY-MM-DD, Istanbul)? */
export function makeGoodHourOpen(r: MakeGoodRow, today: string): boolean {
  return makeGoodStateOf(r) === "open" && today <= (r.makeGoodUntil ?? "");
}

/**
 * What people put between the groups of a number: spaces of every kind
 * (NBSP, thin, figure: `\s` and `\p{Z}`), dots, slashes, underscores and
 * dashes (`\p{Pd}`, the en dash too), up to three in a row (" / ", " - ").
 * Not ":" or ",": a time or an amount ("14:05", "2.000,00") must not glue
 * the digits around it into one long number.
 */
const SEP = String.raw`[\s\p{Z}._/\\\p{Pd}]{0,3}`;
/** An IBAN as people write it: country, check digits, then groups. */
const IBAN_RE = new RegExp(
  String.raw`\b[A-Z]{2}\d{2}(?:${SEP}[A-Z0-9]){11,30}\b`,
  "giu",
);
/** Sixteen or more digits (a card number, an IBAN without its "TR"). */
const LONG_NUMBER_RE = new RegExp(String.raw`\d(?:${SEP}\d){15,}`, "u");
/** "hesap 12345678", "hesap no: 1234567", "hesabı 123456": an account. */
const ACCOUNT_RE =
  /hesa[pb][a-zçğıöşü]*\s*(?:no|numaras[ıi])?\s*[:.]?\s*\d{6,}/iu;

/**
 * The note as it is matched: compatibility forms folded (full-width
 * digits, ligatures: NFKC) and invisible format characters dropped (zero
 * width space, joiner, soft hyphen: `\p{Cf}`), so they cannot hide a
 * number.
 */
function normalisedNote(text: string): string {
  return text.normalize("NFKC").replace(/\p{Cf}/gu, "");
}

/**
 * Does a note typed with "Telafi ödendi" carry a bank account (an IBAN,
 * with or without its "TR", however its groups are separated, an account
 * number after "hesap") or a card number? The make-good's bank details
 * are used for the transfer and never written into our records (karaoke
 * terms §8, Veri Saklama §8, KVKK m.4/2-ç): the note goes into the audit
 * log, which is kept unchanged for ten years, so such a note is refused. A
 * date, a time, an amount, a phone number or a receipt number of up to 15
 * digits passes.
 */
export function looksLikeBankAccount(text: string): boolean {
  const note = normalisedNote(text);
  for (const m of note.matchAll(IBAN_RE)) {
    if (m[0].replace(/\D/g, "").length >= 12) return true;
  }
  return LONG_NUMBER_RE.test(note) || ACCOUNT_RE.test(note);
}

// ─── Resale ────────────────────────────────────────────────────────────────

/** A cancelled booking as the resale rules read it. */
export interface ResaleCandidate {
  id: string;
  date: string;
  startHour: number;
  hours: number;
  status: string;
  paymentStatus?: string;
  paidMinor?: number;
  totalMinor: number;
  refundMinor?: number | null;
  resaleRefundMinor?: number | null;
  resoldHours?: readonly number[] | null;
  /** On a cancelled row: the instant of the cancel. */
  updatedAt: string;
  makeGoodFor?: string | null;
}

/**
 * What a late cancel kept of a cancelled booking's payment, kuruş: the
 * payment minus the late share refunded (the resale part of `refundMinor`
 * aside). 0 for every booking that went back in full or holds no share.
 */
export function keptShareOfCancelled(r: ResaleCandidate): number {
  if (r.status !== "cancelled") return 0;
  if (r.paymentStatus !== "refunding" && r.paymentStatus !== "refunded") {
    return 0;
  }
  if (typeof r.refundMinor !== "number") return 0;
  const share = r.refundMinor - (r.resaleRefundMinor ?? 0);
  return Math.max(0, paidOf(r) - share);
}

/**
 * The resale part of what goes back once `counted` of the booking's
 * `hours` were sold again: round(kept × counted / hours), so the parts add
 * up to exactly what was kept (karaoke_charge_resold_hours does the same).
 */
export function resaleRefundTotal(
  kept: number,
  hours: number,
  counted: number,
): number {
  if (kept <= 0 || hours <= 0 || counted <= 0) return 0;
  return Math.round((kept * Math.min(counted, hours)) / hours);
}

/**
 * Which late-cancelled booking each hour of a booking just sold counts to:
 * for every hour, the booking that last cancelled it late (latest
 * `updatedAt`), and only if that booking was not already refunded for it.
 * Returns the hours per booking, in order.
 *
 * No sale, no refund: a free hour the köşk gave (`makeGoodFor`), and an
 * hour booked for nothing (a total of 0, a 100 % ORO discount), brought the
 * köşk no money for the hour, so there is no gain to set off against what
 * the late canceller kept (TBK m.325/2 kıyasen; orchestrator decision under
 * the operator's delegation, 21 Ekim 2026). A booking paid at the köşk has
 * a total above 0 and counts.
 */
export function resaleAllocation(
  sold: {
    id: string;
    date: string;
    startHour: number;
    hours: number;
    totalMinor: number;
    makeGoodFor?: string | null;
  },
  sameDay: readonly ResaleCandidate[],
): Array<{ id: string; hours: number[] }> {
  if (sold.makeGoodFor) return [];
  if (!(sold.totalMinor > 0)) return [];
  const late = sameDay.filter(
    (c) =>
      c.id !== sold.id &&
      c.date === sold.date &&
      !c.makeGoodFor &&
      keptShareOfCancelled(c) > 0,
  );
  if (late.length === 0) return [];
  const byId = new Map<string, number[]>();
  for (let h = sold.startHour; h < sold.startHour + sold.hours; h += 1) {
    const covering = late
      .filter((c) => h >= c.startHour && h < c.startHour + c.hours)
      .sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
      );
    const last = covering[0];
    if (!last || (last.resoldHours ?? []).includes(h)) continue;
    byId.set(last.id, [...(byId.get(last.id) ?? []), h]);
  }
  return [...byId].map(([id, hours]) => ({ id, hours }));
}
