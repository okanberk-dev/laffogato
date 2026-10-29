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
 * The member may cancel on their own within this many hours AFTER the booking
 * is made (and before the start), and gets the whole payment back (operator,
 * 28 Eki 2026: "karaoke için 2 saat içinde iptal etmezse iade olamaz"). Until
 * then the window was counted back from the start, which refunded a cancel
 * made five hours after booking for an evening days away. Later, or not
 * turning up, refunds nothing. The DEFAULT of the panel's policy (Ayarlar >
 * Karaoke, `settings."karaokeFreeCancelHours"`, 18 Eki 2026). A booking made
 * before the policy was snapshotted (NULL = 2 / 0) keeps the rule it was
 * shown: its window ends 2 hours BEFORE its start (`karaokeCancelDeadline`).
 */
export const KARAOKE_FREE_CANCEL_HOURS = 2;
/**
 * The panel's floor for the window. The window runs from the booking, and a
 * prepaid booking may be paid up to 75 minutes after it is made (a payment
 * page reopened at minute 30 lives 30 more, and the bank's step has its 15
 * minutes of grace; see below): under two hours a booking could be paid
 * after its own free moment had passed (tests/karaoke-cancel-policy.test.ts).
 */
export const KARAOKE_FREE_CANCEL_HOURS_MIN = 2;

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

// ─── The cancellation policy (P2a, operator 17 Eki 2026) ──────────────────

/**
 * The two numbers a booking's cancellation rule is made of (operator, 17 Eki
 * 2026: "para tutarı iade edilir kısmını da panelden ayarla"). A cancel
 * inside the window always refunds the whole payment; that part is not
 * configurable. Not turning up never refunds (MSY m.15/1-g leaves no
 * withdrawal right to fall back on).
 */
export interface KaraokeCancelPolicy {
  /**
   * For how many hours AFTER the booking is made a member's own cancel
   * refunds in full, 2..72 (operator, 28 Eki 2026). The window ends at the
   * latest the minute before the start: a booking made closer to its start
   * than this is free to cancel until then.
   */
  freeCancelHours: number;
  /**
   * The share of the payment (whole %, 0..100) a member's cancel AFTER the
   * window refunds, while the start has not come. 0: such a cancel is
   * refused, as before the policy existed.
   */
  lateRefundPercent: number;
}

/** 2 hours / 0 %: the rule before the panel had one, and every legacy row. */
export const DEFAULT_KARAOKE_CANCEL_POLICY: Readonly<KaraokeCancelPolicy> =
  Object.freeze({
    freeCancelHours: KARAOKE_FREE_CANCEL_HOURS,
    lateRefundPercent: 0,
  });

/** The panel's ceiling for the free window, in hours. */
export const KARAOKE_FREE_CANCEL_HOURS_MAX = 72;

function wholeIn(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : null;
}

/**
 * The policy a booking was made under, from its snapshot. A row written before
 * the snapshot (both columns NULL), or a value out of range (a 0 from the
 * days when 0 meant "free until the start"), reads as the default for that
 * number: the rule those bookings were shown.
 */
export function karaokeCancelPolicyOf(r: {
  freeCancelHours?: number | null;
  lateRefundPercent?: number | null;
}): KaraokeCancelPolicy {
  return {
    freeCancelHours:
      wholeIn(
        r.freeCancelHours,
        KARAOKE_FREE_CANCEL_HOURS_MIN,
        KARAOKE_FREE_CANCEL_HOURS_MAX,
      ) ?? DEFAULT_KARAOKE_CANCEL_POLICY.freeCancelHours,
    lateRefundPercent:
      wholeIn(r.lateRefundPercent, 0, 100) ??
      DEFAULT_KARAOKE_CANCEL_POLICY.lateRefundPercent,
  };
}

/** Same two numbers. */
export function samePolicy(
  a: KaraokeCancelPolicy,
  b: KaraokeCancelPolicy,
): boolean {
  return (
    a.freeCancelHours === b.freeCancelHours &&
    a.lateRefundPercent === b.lateRefundPercent
  );
}

/**
 * A short stamp of the two sentences a form printed (FNV-1a, 32 bits, as 8
 * hex digits). The web form echoes it with the booking, and a booking whose
 * page printed other sentences than a booking made now gets is refused even
 * when the two numbers match: on 28 Eki 2026 the 2 h / 0 % rule kept its
 * numbers and changed its meaning, and a page drawn before the deploy would
 * otherwise have booked under sentences it never showed. A change detector,
 * not a secret.
 */
export function karaokeRulesStamp(rules: readonly string[]): string {
  const text = rules.join("\n");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * The deadline a NEW booking's snapshot stores (`"cancelDeadline"`): the
 * booking instant plus the free window, ending at the latest the minute
 * before the start (a booking made closer to its start than the window is
 * free to cancel until then; `karaokeLastMinuteBefore`). Until 28 Eki 2026 it
 * was the start minus the window, which refunded a cancel made hours after
 * booking for an evening days away. A `bookedAt` that cannot be read places
 * no window of its own: the minute before the start.
 */
export function karaokeDeadlineFor(
  policy: KaraokeCancelPolicy,
  r: { date: string; startHour: number },
  bookedAt: Date,
): Date {
  const last = karaokeLastMinuteBefore(r);
  const made = bookedAt.getTime();
  if (!Number.isFinite(made)) return new Date(last);
  return new Date(Math.min(made + policy.freeCancelHours * HOUR_MS, last));
}

/**
 * The cap of a window counted from the booking: the minute before the
 * start. Every page and mail prints the deadline to the minute and the terms
 * count "bu an dâhil" (`karaokeFreeCancelEnd`), so a deadline AT the start
 * would name a minute that is refused (the start is never in the window).
 * Ending at 19:59 for a 20:00 evening, the named minute is free to its end.
 */
function karaokeLastMinuteBefore(r: {
  date: string;
  startHour: number;
}): number {
  return karaokeStartInstant(r.date, r.startHour).getTime() - MINUTE_MS;
}

/**
 * The last moment the member may still cancel the booking themselves for a
 * full refund: the booking's stored deadline, else (a row from before the
 * snapshot, 18 Eki 2026) the rule those rows were shown, the start minus
 * its policy's window. Never the booking-based window for such a row: it
 * was booked under the other sentence (TKHK m.4/2).
 */
export function karaokeCancelDeadline(r: {
  date: string;
  startHour: number;
  freeCancelHours?: number | null;
  lateRefundPercent?: number | null;
  cancelDeadline?: string | null;
  createdAt?: string;
}): Date {
  const stored = Date.parse(r.cancelDeadline ?? "");
  if (Number.isFinite(stored)) return new Date(stored);
  return new Date(
    karaokeStartInstant(r.date, r.startHour).getTime() -
      karaokeCancelPolicyOf(r).freeCancelHours * HOUR_MS,
  );
}

/**
 * Was the booking made under the rule counted BACK from the start (every
 * booking before 28 Eki 2026)? A row with no stored deadline (before the
 * 18 Eki snapshot) always was; a stored deadline that is exactly the start
 * minus its policy's hours was written by that rule. A deadline counted from
 * the booking lands there only if the booking was made exactly twice the
 * window before the start, to the millisecond.
 */
export function karaokeCountsBackFromStart(
  r: Parameters<typeof karaokeCancelDeadline>[0],
): boolean {
  const stored = Date.parse(r.cancelDeadline ?? "");
  if (!Number.isFinite(stored)) return true;
  return (
    stored ===
    karaokeStartInstant(r.date, r.startHour).getTime() -
      karaokeCancelPolicyOf(r).freeCancelHours * HOUR_MS
  );
}

/**
 * The deadline of a booking the panel moves to another day or hour, under
 * the rule it was booked under. Counted from the booking: its making plus
 * its policy's hours, ending at the latest the minute before the new start
 * (moved later, a booking made close to its start gets the rest of its
 * window back; moved earlier, the window ends just before the new start).
 * Counted back from the start (made before 28 Eki 2026): the new start minus
 * its hours, as it was promised; moving it must not take the member's window
 * away. A row whose making cannot be read keeps its deadline, capped at the
 * minute before the new start.
 */
export function karaokeMovedDeadline(
  r: Parameters<typeof karaokeCancelDeadline>[0] & {
    makeGoodFor?: string | null;
  },
  slot: { date: string; startHour: number },
): Date {
  // A free make-good hour keeps its own rule, recounted for the new start
  // from when it was given (an unreadable instant: the start counted back).
  if (r.makeGoodFor) {
    return karaokeMakeGoodDeadline(slot, new Date(Date.parse(r.createdAt ?? "")));
  }
  const policy = karaokeCancelPolicyOf(r);
  const start = karaokeStartInstant(slot.date, slot.startHour).getTime();
  if (karaokeCountsBackFromStart(r)) {
    return new Date(start - policy.freeCancelHours * HOUR_MS);
  }
  const made = Date.parse(r.createdAt ?? "");
  if (Number.isFinite(made)) {
    return karaokeDeadlineFor(policy, slot, new Date(made));
  }
  return new Date(
    Math.min(karaokeCancelDeadline(r).getTime(), start - MINUTE_MS),
  );
}

/**
 * The rule a free make-good hour is written under (karaoke terms §8, 29 Eki
 * 2026), whatever the panel's policy: nothing was paid for it, so there is
 * no late share, and its hours are the window the guest releases it in.
 */
export const KARAOKE_MAKE_GOOD_POLICY: Readonly<KaraokeCancelPolicy> =
  Object.freeze({
    freeCancelHours: KARAOKE_FREE_CANCEL_HOURS,
    lateRefundPercent: 0,
  });

/**
 * Until when the guest may release a free make-good hour and have its
 * make-good open again (karaoke terms §8, 29 Eki 2026): while more than two
 * hours remain to its start, the rule every booking had before 28 Eki 2026.
 * An hour given less than four hours before its start keeps two hours from
 * when it was given, ending at the latest the minute before the start. The
 * make-good is the köşk's answer to its own late cancel; a release window
 * counted from the call that booked the hour would use it up on the clock
 * of that call (docs/LEGAL-REDLINES-2026-09.md §37.5, question 3). An
 * unreadable `givenAt` places no window of its own: the start counted back.
 */
export function karaokeMakeGoodDeadline(
  r: { date: string; startHour: number },
  givenAt: Date,
): Date {
  const back =
    karaokeStartInstant(r.date, r.startHour).getTime() -
    KARAOKE_MAKE_GOOD_POLICY.freeCancelHours * HOUR_MS;
  if (!Number.isFinite(givenAt.getTime())) return new Date(back);
  return new Date(
    Math.max(
      back,
      karaokeDeadlineFor(KARAOKE_MAKE_GOOD_POLICY, r, givenAt).getTime(),
    ),
  );
}

/**
 * The two sentences a free make-good hour stores and prints in place of a
 * paid booking's ("ödediğin tutar" is not true of an hour nobody paid for):
 * counted back from the start, or, for an hour given close to it, from when
 * it was given (`karaokeMakeGoodDeadline`). Each reads alone: a refusal
 * prints the second without the first.
 */
export function karaokeMakeGoodRules(
  r: { date: string; startHour: number },
  deadline: Date,
): [string, string] {
  const h = KARAOKE_MAKE_GOOD_POLICY.freeCancelHours;
  const back =
    karaokeStartInstant(r.date, r.startHour).getTime() - h * HOUR_MS;
  if (deadline.getTime() <= back) {
    return [
      `Bu ücretsiz telafi saatini rezervasyon saatine ${h} saatten fazla varken bırakabilirsin; telafin o zaman yeniden açılır.`,
      `Rezervasyon saatine ${h} saatten az kala bırakılan ya da gelinmeyen ücretsiz telafi saatinde telafi kullanılmış sayılır.`,
    ];
  }
  return [
    `Bu ücretsiz telafi saatini sana ayrıldığı andan itibaren ${h} saat içinde, rezervasyon saati gelmeden bırakabilirsin; telafin o zaman yeniden açılır.`,
    `Ayrıldığı andan ${h} saat geçtikten sonra bırakılan ya da gelinmeyen ücretsiz telafi saatinde telafi kullanılmış sayılır.`,
  ];
}

/**
 * Where the full refund ends, exclusive: the end of the minute the deadline
 * falls in. Every page and e-mail prints the deadline to the minute ("son an:
 * 30 Ekim 2026, 18:00."), and the terms count "bu an" itself (ASK-Y3-4): a
 * member whose clock still reads 18:00 is inside it, whatever the seconds
 * (TKHK m.5/4: a term read two ways is read for the consumer). Istanbul is a
 * whole number of hours from UTC, so its minutes are the epoch's minutes.
 * `cancellableUntil` itself stays the deadline (docs/API-MOBILE.md).
 */
export function karaokeFreeCancelEnd(deadline: Date): number {
  return Math.floor(deadline.getTime() / MINUTE_MS) * MINUTE_MS + MINUTE_MS;
}

/**
 * True while the member may still cancel (and be refunded in full): up to
 * the deadline and through the minute it names (`karaokeFreeCancelEnd`).
 * `cancellableUntil` is "the last moment" of a full refund
 * (docs/API-MOBILE.md) and the terms say "bu an dahil" (ASK-Y3-4): "2 saat
 * içinde" says nothing of the seconds, and a term read two ways is read for
 * the consumer (TKHK m.5/4). The sentences stay as they are; only the
 * comparison moved. The start itself is never in the window (a row whose
 * deadline is its start).
 */
export function withinFreeCancel(
  r: Parameters<typeof karaokeCancelDeadline>[0],
  now: Date,
): boolean {
  const t = now.getTime();
  return (
    t < karaokeFreeCancelEnd(karaokeCancelDeadline(r)) &&
    t < karaokeStartInstant(r.date, r.startHour).getTime()
  );
}

/**
 * What a member's (or a link holder's) own cancel gets right now, under the
 * booking's snapshot:
 *
 * - `full`: before the deadline, the whole payment back;
 * - `late`: after the window, before the start, with a late share above 0:
 *   `percent` of the payment back (100 = all of it);
 * - `refused`: after the window with no late share, or the start has come
 *   (not turning up refunds nothing).
 */
export type KaraokeSelfCancelTerms =
  { kind: "full" } | { kind: "late"; percent: number } | { kind: "refused" };

export function karaokeSelfCancelTerms(
  r: Parameters<typeof karaokeCancelDeadline>[0],
  now: Date,
): KaraokeSelfCancelTerms {
  if (withinFreeCancel(r, now)) return { kind: "full" };
  const { lateRefundPercent } = karaokeCancelPolicyOf(r);
  const started =
    now.getTime() >= karaokeStartInstant(r.date, r.startHour).getTime();
  if (lateRefundPercent > 0 && !started) {
    return { kind: "late", percent: lateRefundPercent };
  }
  return { kind: "refused" };
}

/**
 * What goes back to the card for a booking's refund: its late share
 * (`refundMinor`), or the whole payment (the total for a row that has no
 * `paidMinor` yet).
 */
export function refundAmountOf(r: {
  paidMinor?: number;
  totalMinor: number;
  refundMinor?: number | null;
}): number {
  if (typeof r.refundMinor === "number" && r.refundMinor >= 0) {
    return r.refundMinor;
  }
  return r.paidMinor && r.paidMinor > 0 ? r.paidMinor : r.totalMinor;
}

/**
 * What is still to go back by hand: what goes back (`refundAmountOf`) minus
 * what had already gone back before this step (`refundSettledMinor`, a late
 * share refunded before its hour was sold again). On a `refunded` row: what
 * the last step sent.
 */
export function refundOwedNowOf(r: {
  paidMinor?: number;
  totalMinor: number;
  refundMinor?: number | null;
  refundSettledMinor?: number | null;
}): number {
  return Math.max(0, refundAmountOf(r) - (r.refundSettledMinor ?? 0));
}

/**
 * A late cancel's share is owed or was refunded (less than the payment), or
 * part of what goes back is for an hour cancelled late and sold again
 * (`resaleRefundMinor`, karaoke-make-good-core.ts). Such a refund is never
 * sent to the POS by the code: PayNkolay refunds whole payments only
 * (docs/PAYNKOLAY.md §3.2), so a person refunds it in PayNkolay's panel and
 * records it (`settleKaraokeRefundByHand`). A resale part stays by hand even
 * when the parts add up to the whole payment: some of it may have gone back
 * already, and the POS would send the whole payment again.
 */
export function isPartialRefund(r: {
  paidMinor?: number;
  refundMinor?: number | null;
  resaleRefundMinor?: number | null;
}): boolean {
  if (typeof r.refundMinor !== "number") return false;
  return r.refundMinor < (r.paidMinor ?? 0) || (r.resaleRefundMinor ?? 0) > 0;
}

/**
 * A late cancel that kept the whole payment and put the hours back on sale:
 * a guest's late request under a late share of 0, taken before the start
 * (29 Eki 2026, `releaseLateBooking`). Cancelled, nothing went back and
 * nothing is owed: `refundMinor` 0 on a `refunded` row, so the payment is
 * the share kept (`keptShareOfCancelled`) and an hour of it sold again
 * refunds what was kept for it, by hand. Once one is, the row carries a
 * resale part and reads as any resale refund.
 */
export function keptWholeOnLateCancel(r: {
  status: string;
  paymentStatus?: string;
  paidMinor?: number;
  refundMinor?: number | null;
  resaleRefundMinor?: number | null;
}): boolean {
  return (
    r.status === "cancelled" &&
    r.paymentStatus === "refunded" &&
    r.refundMinor === 0 &&
    (r.resaleRefundMinor ?? 0) === 0 &&
    (r.paidMinor ?? 0) > 0
  );
}

/** The late share of a payment, in kuruş: round(paid × P / 100). */
export function karaokeLateRefundMinor(
  paidMinor: number,
  percent: number,
): number {
  if (paidMinor <= 0 || percent <= 0) return 0;
  return Math.round((paidMinor * percent) / 100);
}

/**
 * "%50'si": a percentage as the possessive of "tutarın" ("ödediğin tutarın
 * %50'si"). Turkish reads "%50" as "yüzde elli", so the suffix follows the
 * last number word: elli-si, otuz-u, kırk-ı, yüz-ü, dört-ü, beş-i.
 */
const ONES_SUFFIX = ["", "i", "si", "ü", "ü", "i", "sı", "si", "i", "u"];
const TENS_SUFFIX = ["", "u", "si", "u", "ı", "si", "ı", "i", "i", "ı"];

export function percentPossessive(percent: number): string {
  const p = Math.trunc(percent);
  const suffix =
    p === 100
      ? "ü"
      : p % 10 !== 0
        ? ONES_SUFFIX[p % 10]
        : TENS_SUFFIX[Math.trunc(p / 10) % 10];
  return `%${p}'${suffix}`;
}

/** The rule's sentences, as the customer reads them. */
export interface KaraokeCancellationText {
  /** What a cancel inside the window gets: always the whole payment. */
  refundRule: string;
  /** What a cancel after the window, and not turning up, gets. */
  lateRule: string;
  /** The refusal of a member's late cancel. */
  tooLateMessage: string;
  /** `[refundRule, lateRule]`: the `cancellationRules` of §7.1. */
  rules: [string, string];
}

/**
 * The two sentences of a policy, and its refusal. With the defaults (2 h, 0 %)
 * the output is byte for byte the constants below
 * (tests/karaoke-cancel-policy.test.ts): the operator's rule of 28 Eki 2026,
 * "2 saat içinde iptal etmezse iade olamaz", counted from the booking.
 */
export function karaokeCancellationRules(
  policy: KaraokeCancelPolicy,
): KaraokeCancellationText {
  const { freeCancelHours: h, lateRefundPercent: p } = policy;
  const refundRule = `Rezervasyonu yaptığın andan itibaren ${h} saat içinde, rezervasyon saati gelmeden iptal edersen ödediğin tutarın tamamı kartına iade edilir.`;
  // The late sentence stands on its own: the API's too_late answer and the
  // app's cancel step print it without the one before it.
  const after = `Rezervasyonu yaptığın andan ${h} saat geçtikten sonra`;
  const lateRule =
    p === 0
      ? `${after} yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.`
      : p === 100
        ? `${after}, rezervasyon saati gelmeden yapılan iptalde de ödediğin tutarın tamamı kartına iade edilir; rezervasyona gelinmediğinde ücret iadesi yapılmaz.`
        : // A share is refunded by hand (PayNkolay refunds whole payments
          // only), within the 14 days of the terms §9, and the hour sold
          // again refunds what was kept for it (§7, ASK-OTH-3-CFG).
          `${after}, rezervasyon saati gelmeden yapılan iptalde ödediğin tutarın ${percentPossessive(p)} en geç 14 gün içinde kartına iade edilir; rezervasyona gelinmediğinde ücret iadesi yapılmaz. Geç iptal ettiğin saat başka bir misafire satılırsa o saat için sende kalan tutar da kartına iade edilir.`;
  // With no late share the refusal repeats the rule; with one, a member's
  // cancel is accepted until the start, so the refusal is the no-show.
  const tooLateMessage =
    p === 0
      ? `Artık buradan iptal edemezsin. ${lateRule}`
      : "Rezervasyon saati geldi; artık buradan iptal edemezsin. Rezervasyona gelinmediğinde ücret iadesi yapılmaz.";
  return {
    refundRule,
    lateRule,
    tooLateMessage,
    rules: [refundRule, lateRule],
  };
}

/**
 * Until when a booking paid at the venue may still be cancelled on its own
 * page, worded to follow "Planın değişirse": no money moves, so a late share
 * above 0 lets it go until the start. Null when no member cancel is ever
 * accepted: the confirmation then says to call. No policy is such a rule
 * (every window is at least two hours); the null stays for the caller's
 * sake.
 */
export function karaokeVenueCancelUntil(
  policy: KaraokeCancelPolicy,
): string | null {
  if (policy.lateRefundPercent > 0) return "rezervasyon saatinden önce";
  return `rezervasyonu yaptıktan sonraki ${policy.freeCancelHours} saat içinde, rezervasyon saati gelmeden`;
}

/**
 * `karaokeVenueCancelUntil` for one booking, in the words of the rule it was
 * made under: a booking counted back from the start
 * (`karaokeCountsBackFromStart`) is told the sentence it was booked with.
 */
export function karaokeVenueCancelUntilOf(
  r: Parameters<typeof karaokeCancelDeadline>[0] & {
    makeGoodFor?: string | null;
  },
): string | null {
  const policy = karaokeCancelPolicyOf(r);
  if (policy.lateRefundPercent > 0) return "rezervasyon saatinden önce";
  if (karaokeCountsBackFromStart(r)) {
    return `rezervasyon saatine ${policy.freeCancelHours} saatten fazla varken`;
  }
  // A free hour the köşk gave was not booked by the guest: its window runs
  // from when it was given.
  if (r.makeGoodFor) {
    return `bu saat ayrıldıktan sonraki ${policy.freeCancelHours} saat içinde, rezervasyon saati gelmeden`;
  }
  return karaokeVenueCancelUntil(policy);
}

/**
 * The two sentences of a policy as they were written while the window was
 * counted back from the start (16 Eki to 28 Eki 2026), verbatim. Every row
 * made then stored its own pair (`cancellationRules`, since 18 Eki 2026);
 * a row from before that stores none and prints this, for its own policy
 * (2 hours / 0 % for every such row, the lock having held it there).
 */
export function legacyKaraokeCancellationRules(
  policy: KaraokeCancelPolicy,
): [string, string] {
  const { freeCancelHours: h, lateRefundPercent: p } = policy;
  const refundRule = `Rezervasyon saatine ${h} saatten fazla varken iptal edersen ödediğin tutarın tamamı kartına iade edilir.`;
  const late = `Rezervasyon saatine ${h} saatten az kala yapılan iptallerde`;
  const lateRule =
    p === 0
      ? `${late} ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.`
      : p === 100
        ? `${late} de ödediğin tutarın tamamı kartına iade edilir; rezervasyona gelinmediğinde ücret iadesi yapılmaz.`
        : `${late} ödediğin tutarın ${percentPossessive(p)} en geç 14 gün içinde kartına iade edilir; rezervasyona gelinmediğinde ücret iadesi yapılmaz. Geç iptal ettiğin saat başka bir misafire satılırsa o saat için sende kalan tutar da kartına iade edilir.`;
  return [refundRule, lateRule];
}

/**
 * The default policy's pair under the rule counted back from the start: the
 * operator's wording of 16 Eki 2026, which every booking made before the
 * snapshot (18 Eki 2026) was shown. Such rows store no sentences and no
 * deadline, and they keep that rule (`karaokeCancelDeadline`), so they
 * print this pair, never the one of 28 Eki 2026.
 */
export const LEGACY_KARAOKE_RULES: readonly [string, string] =
  legacyKaraokeCancellationRules(DEFAULT_KARAOKE_CANCEL_POLICY);

/**
 * The sentences a booking was shown: its stored snapshot, else (a row from
 * before the snapshot) the sentences its policy had then, counted back from
 * the start (`legacyKaraokeCancellationRules`), the rule such a row keeps.
 */
export function karaokeRulesOf(r: {
  freeCancelHours?: number | null;
  lateRefundPercent?: number | null;
  cancellationRules?: readonly string[] | null;
}): [string, string] {
  const stored = r.cancellationRules;
  if (
    Array.isArray(stored) &&
    stored.length === 2 &&
    stored.every((s) => typeof s === "string" && s.trim() !== "")
  ) {
    return [stored[0], stored[1]];
  }
  return legacyKaraokeCancellationRules(karaokeCancelPolicyOf(r));
}

/**
 * The refusal of a member's own late cancel, in the booking's OWN words: its
 * stored late sentence (a row booked under an earlier wording keeps it), or
 * the no-show sentence under a policy whose late share lets a cancel through
 * until the start.
 */
export function karaokeTooLateMessageOf(
  r: Parameters<typeof karaokeRulesOf>[0],
): string {
  if (karaokeCancelPolicyOf(r).lateRefundPercent > 0) {
    return karaokeCancellationRules(karaokeCancelPolicyOf(r)).tooLateMessage;
  }
  return `Artık buradan iptal edemezsin. ${karaokeRulesOf(r)[1]}`;
}

/**
 * Why the panel refuses a policy, or null: the two ranges. The fairness
 * limits that coupled a long window to a late share (Tüketici
 * Sözleşmelerindeki Haksız Şartlar Hakkında Yönetmelik m.5/1 and EK (ç),
 * (d); TBK m.182/3) were written for a window counted back from the start,
 * where a longer window kept the whole payment for longer. Counted from the
 * booking (28 Eki 2026) a longer window is more time to cancel freely, so
 * only the ranges are held here; whether the rule itself keeps the whole
 * payment fairly is a lawyer's question (docs/LEGAL-REDLINES-2026-09.md
 * §37).
 *
 * A share of 1..99 % is open since the hour cancelled late and sold again
 * refunds the share kept for it (karaoke-make-good-core.ts, 21 Eki 2026):
 * the terms §7 promise that refund, and until it was built the panel
 * offered only 0 or 100 (ASK-OTH-3-CFG, D-KAR-1-99).
 */
export function karaokeCancelPolicyRefusal(policy: KaraokeCancelPolicy): {
  field: "karaokeFreeCancelHours" | "karaokeLateRefundPercent";
  message: string;
} | null {
  const { freeCancelHours: h, lateRefundPercent: p } = policy;
  if (
    wholeIn(h, KARAOKE_FREE_CANCEL_HOURS_MIN, KARAOKE_FREE_CANCEL_HOURS_MAX) ===
    null
  ) {
    return {
      field: "karaokeFreeCancelHours",
      message: `Ücretsiz iptal süresi ${KARAOKE_FREE_CANCEL_HOURS_MIN} ile ${KARAOKE_FREE_CANCEL_HOURS_MAX} saat arasında tam sayı olmalı.`,
    };
  }
  if (wholeIn(p, 0, 100) === null) {
    return {
      field: "karaokeLateRefundPercent",
      message: "Geç iptalde iade oranı 0 ile 100 arasında tam sayı olmalı.",
    };
  }
  return null;
}

/**
 * The first lafmobil version that prints the booking's own rule on EVERY
 * karaoke screen (spec §7). Builds before 1.1.0 print their own fixed pair
 * on the reservation page and its cancel step, and app requests carry no
 * version the server could tell them apart by; 1.1.0 (in App Review on
 * 29 Eki 2026, no build released in a store yet) prints the server's
 * `cancellationRules`. Until a version is set here, and the panel's minimum
 * app version reaches it,
 * only the default policy can be saved or take effect: an old build would
 * otherwise show a member a rule different from the one they booked under.
 * null: no such build yet. Opening it also needs the other legal documents
 * that quote the default rule rewritten first, and the site's own karaoke
 * screens (karaoke-booking.tsx, karaoke-reservation-view.tsx) printing the
 * booking's rule instead of the fixed one (tests/karaoke-cancel-policy-
 * doc.test.ts names both checks).
 */
export const KARAOKE_POLICY_APP_VERSION: string | null = null;

/** "1.10.0" > "1.9.3": numeric, part by part; unreadable reads as 0. */
function versionAtLeast(have: string, need: string): boolean {
  const parts = (v: string) =>
    v.split(".").map((n) => (/^\d+$/.test(n) ? Number(n) : 0));
  const a = parts(have);
  const b = parts(need);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}

/**
 * May a policy other than the default take effect? Null when it may; else
 * the sentence the panel shows.
 */
export function karaokePolicyLockReason(
  minSupportedAppVersion: string,
  appVersion: string | null = KARAOKE_POLICY_APP_VERSION,
): string | null {
  if (appVersion === null) {
    return 'Şimdilik yalnız 2 saat ve %0 kaydedilebilir: uygulamanın 1.1.0\'dan eski derlemeleri rezervasyon ayrıntısında kendi sabit "2 saat" kuralını yazıyor. Kuralı sunucudan okuyan uygulama sürümü kodda tanımlanıp en düşük desteklenen sürüm ona çıkınca diğer değerler açılır.';
  }
  if (!versionAtLeast(minSupportedAppVersion, appVersion)) {
    return `Şimdilik yalnız 2 saat ve %0 kaydedilebilir: kuralı sunucudan okuyan uygulama ${appVersion} sürümünden başlıyor. Mobil uygulama ayarlarında en düşük desteklenen sürüm ${appVersion} olunca diğer değerler açılır.`;
  }
  return null;
}

/**
 * The policy a NEW booking gets now: the panel's, while the lock is open; the
 * default otherwise (also when the minimum app version was lowered after a
 * non-default policy was saved).
 */
export function effectiveKaraokeCancelPolicy(
  s: {
    karaokeFreeCancelHours?: number | null;
    karaokeLateRefundPercent?: number | null;
    mobileApp?: { minSupportedAppVersion?: string } | null;
  },
  appVersion: string | null = KARAOKE_POLICY_APP_VERSION,
): KaraokeCancelPolicy {
  if (
    karaokePolicyLockReason(
      s.mobileApp?.minSupportedAppVersion ?? "0.0.0",
      appVersion,
    ) !== null
  ) {
    return { ...DEFAULT_KARAOKE_CANCEL_POLICY };
  }
  const policy = karaokeCancelPolicyOf({
    freeCancelHours: s.karaokeFreeCancelHours,
    lateRefundPercent: s.karaokeLateRefundPercent,
  });
  // A stored pair the panel would refuse today never takes effect.
  return karaokeCancelPolicyRefusal(policy) === null
    ? policy
    : { ...DEFAULT_KARAOKE_CANCEL_POLICY };
}

/**
 * The cancellation rule in the operator's own words (28 Eki 2026: "2 saat
 * içinde iptal etmezse iade olamaz"; the 16 Eki 2026 pair, "2 saat sonrası
 * iptalde ücret iadesi yoktur", had been read as two hours before the
 * start): the default policy's two sentences. Every booking made under the
 * default prints these verbatim - the pre-payment box, the reservation page
 * and its cancel step, the late-cancel refusal (web and API) and the
 * confirmation e-mail. A booking made under another policy prints its own
 * (`karaokeRulesOf`), and one made before 28 Eki 2026 its stored pair.
 */
const DEFAULT_RULES = karaokeCancellationRules(DEFAULT_KARAOKE_CANCEL_POLICY);
export const KARAOKE_REFUND_RULE = DEFAULT_RULES.refundRule;
export const KARAOKE_NO_REFUND_RULE = DEFAULT_RULES.lateRule;

/** MSY m.15/1-g, stated before the payment (m.5/1-h, m.6/2-a). */
export const KARAOKE_NO_WITHDRAWAL =
  "Belirli bir tarihte sunulan eğlence hizmeti olduğu için cayma hakkı yoktur (MSY m.15/1-g).";

/** MSY m.16/4: the business cancelling refunds everything. */
export const KARAOKE_BUSINESS_CANCEL =
  "Rezervasyonu biz karşılayamazsak ödediğin tutarın tamamını kartına iade ederiz.";

/** The refusal of a self-cancel after the window. */
export const KARAOKE_TOO_LATE_MESSAGE = DEFAULT_RULES.tooLateMessage;

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

// ─── A closure the member asked us for (ASK-Y3-4 (d)) ──────────────────────

/** A booking as the closure rules read it. */
type ClosureBooking = Parameters<typeof karaokeCancelDeadline>[0] & {
  status?: string;
};

/**
 * The instant a closure that answers the member's deletion request (the
 * Site's /uye/hesap/sil) judges a booking's cancellation rule at: the
 * request, because our delay must not shorten the member's window (TKHK
 * m.4/2). A booking made after the request is judged at the closure, as
 * without one: the request cannot cover an evening that did not exist yet,
 * and the member could cancel it themselves until the closure (judging it
 * at its making would refund it in full whenever the closure came, the
 * evening sung or not). No usable request: the closure.
 */
export function closureJudgedAt(
  r: { createdAt?: string },
  requestedAt: Date | null | undefined,
  now: Date,
): Date {
  const asked = requestedAt ? requestedAt.getTime() : Number.NaN;
  if (!Number.isFinite(asked) || asked >= now.getTime()) return now;
  const made = Date.parse(r.createdAt ?? "");
  return Number.isFinite(made) && made > asked ? now : new Date(asked);
}

/**
 * The share of a paid booking's payment (whole %) a closure answering the
 * member's request gives back, as `cancelKaraokeReservation` decides it at
 * `closureJudgedAt`: 100 in the free window (and for a booking the köşk
 * never confirmed), the booking's late share inside the window, 0 when its
 * rule refunded nothing then.
 */
export function closureRefundPercent(
  r: ClosureBooking,
  requestedAt: Date | null | undefined,
  now: Date,
): number {
  const terms = karaokeSelfCancelTerms(r, closureJudgedAt(r, requestedAt, now));
  if (terms.kind === "refused") return 0;
  if (terms.kind === "full" || r.status !== "confirmed") return 100;
  return terms.percent;
}

/**
 * A paid booking the member could still have cancelled for a refund when
 * they asked us to close their account, whose start has come before the
 * team closed it. The request fixed the refund (our delay does not shorten
 * the member's window); only a person can say whether the room was used in
 * between.
 */
export function startedSinceRequest(
  r: ClosureBooking,
  requestedAt: Date,
  now: Date,
): boolean {
  return (
    closureRefundPercent(r, requestedAt, now) > 0 &&
    karaokeStartInstant(r.date, r.startHour).getTime() <= now.getTime()
  );
}
