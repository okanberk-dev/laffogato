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
 * turning up, refunds nothing. The DEFAULT of the panel's policy (Ayarlar >
 * Karaoke, `settings."karaokeFreeCancelHours"`, 18 Eki 2026) and what every
 * booking made before the policy was snapshotted reads (NULL = 2 / 0).
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

// ─── The cancellation policy (P2a, operator 17 Eki 2026) ──────────────────

/**
 * The two numbers a booking's cancellation rule is made of (operator, 17 Eki
 * 2026: "para tutarı iade edilir kısmını da panelden ayarla"). A cancel
 * before the window always refunds the whole payment; that part is not
 * configurable. Not turning up never refunds (MSY m.15/1-g leaves no
 * withdrawal right to fall back on).
 */
export interface KaraokeCancelPolicy {
  /**
   * Up to how many hours before the start a member's own cancel refunds in
   * full, 0..72. 0: no free window, every cancel after booking is late.
   */
  freeCancelHours: number;
  /**
   * The share of the payment (whole %, 0..100) a member's cancel INSIDE the
   * window refunds, while the start has not come. 0: such a cancel is refused,
   * as before the policy existed.
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
 * the snapshot (both columns NULL), or a value out of range, reads as the
 * default for that number: the rule those bookings were shown.
 */
export function karaokeCancelPolicyOf(r: {
  freeCancelHours?: number | null;
  lateRefundPercent?: number | null;
}): KaraokeCancelPolicy {
  return {
    freeCancelHours:
      wholeIn(r.freeCancelHours, 0, KARAOKE_FREE_CANCEL_HOURS_MAX) ??
      DEFAULT_KARAOKE_CANCEL_POLICY.freeCancelHours,
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
 * The deadline a NEW booking's snapshot stores (`"cancelDeadline"`): the
 * start minus the free window, or the booking instant itself when there is no
 * window (0 hours: every cancel after booking is late).
 */
export function karaokeDeadlineFor(
  policy: KaraokeCancelPolicy,
  r: { date: string; startHour: number },
  bookedAt: Date,
): Date {
  if (policy.freeCancelHours === 0) return new Date(bookedAt.getTime());
  return new Date(
    karaokeStartInstant(r.date, r.startHour).getTime() -
      policy.freeCancelHours * HOUR_MS,
  );
}

/**
 * The last moment the member may still cancel the booking themselves for a
 * full refund: the booking's stored deadline, else (a row from before the
 * snapshot) the start minus its policy's window.
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
  const policy = karaokeCancelPolicyOf(r);
  const made = Date.parse(r.createdAt ?? "");
  // No window and no booking instant to count from (a fixture): the start.
  if (policy.freeCancelHours === 0 && !Number.isFinite(made)) {
    return karaokeStartInstant(r.date, r.startHour);
  }
  return karaokeDeadlineFor(policy, r, new Date(made));
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
 * (docs/API-MOBILE.md) and the terms say "bu an dahil" (ASK-Y3-4): "2 saatten
 * fazla varken" says nothing of exactly two hours, and a term read two ways
 * is read for the consumer (TKHK m.5/4). The sentences stay as they are; only
 * the comparison moved. The start itself is never in the window (a row whose
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
 * - `late`: inside the window, before the start, with a late share above 0:
 *   `percent` of the payment back (100 = all of it);
 * - `refused`: inside the window with no late share, or the start has come
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
 * A late cancel's share is owed or was refunded (less than the payment).
 * Such a refund is never sent to the POS by the code: PayNkolay refunds
 * whole payments only (docs/PAYNKOLAY.md §3.2), so a person refunds the
 * share in PayNkolay's panel and records it (`settleKaraokeRefundByHand`).
 */
export function isPartialRefund(r: {
  paidMinor?: number;
  refundMinor?: number | null;
}): boolean {
  return (
    typeof r.refundMinor === "number" && r.refundMinor < (r.paidMinor ?? 0)
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
  /** What a cancel before the window gets: always the whole payment. */
  refundRule: string;
  /** What a cancel inside the window, and not turning up, gets. */
  lateRule: string;
  /** The refusal of a member's late cancel. */
  tooLateMessage: string;
  /** `[refundRule, lateRule]`: the `cancellationRules` of §7.1. */
  rules: [string, string];
}

/**
 * The two sentences of a policy, and its refusal. With the defaults (2 h, 0 %)
 * the output is byte for byte the operator's wording of 16 Eki 2026, the
 * constants below (tests/karaoke-cancel-policy.test.ts).
 */
export function karaokeCancellationRules(
  policy: KaraokeCancelPolicy,
): KaraokeCancellationText {
  const { freeCancelHours: h, lateRefundPercent: p } = policy;
  const refundRule =
    h > 0
      ? `Rezervasyon saatine ${h} saatten fazla varken iptal edersen ödediğin tutarın tamamı kartına iade edilir.`
      : "Bu rezervasyonda ücretsiz iptal süresi yok; rezervasyonu yaptıktan sonra yapacağın her iptal geç iptal sayılır.";
  const late =
    h > 0
      ? `Rezervasyon saatine ${h} saatten az kala yapılan iptallerde`
      : "Geç iptallerde";
  const lateRule =
    p === 0
      ? `${late} ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.`
      : p === 100
        ? `${late} de ödediğin tutarın tamamı kartına iade edilir; rezervasyona gelinmediğinde ücret iadesi yapılmaz.`
        : `${late} ödediğin tutarın ${percentPossessive(p)} kartına iade edilir; rezervasyona gelinmediğinde ücret iadesi yapılmaz.`;
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
 * accepted (no window, no late share): the confirmation says to call.
 */
export function karaokeVenueCancelUntil(
  policy: KaraokeCancelPolicy,
): string | null {
  if (policy.lateRefundPercent > 0) return "rezervasyon saatinden önce";
  if (policy.freeCancelHours > 0) {
    return `rezervasyon saatine ${policy.freeCancelHours} saatten fazla varken`;
  }
  return null;
}

/**
 * The sentences a booking was shown: its stored snapshot, else (a row from
 * before it) the ones its policy makes, which for those rows are the default
 * pair.
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
  return karaokeCancellationRules(karaokeCancelPolicyOf(r)).rules;
}

/**
 * Why the panel refuses a policy, or null. The ranges, then the fairness
 * limits (Tüketici Sözleşmelerindeki Haksız Şartlar Hakkında Yönetmelik m.5/1
 * and EK (ç), (d); TBK m.182/3): a long window may not keep the whole
 * payment, so with no late refund the window is at most 24 hours, and above
 * 24 hours at least half goes back. 0 hours is the longest window of all
 * (every cancel after booking is late, up to the booking window before the
 * start), so it needs half back as well.
 */
export function karaokeCancelPolicyRefusal(policy: KaraokeCancelPolicy): {
  field: "karaokeFreeCancelHours" | "karaokeLateRefundPercent";
  message: string;
} | null {
  const { freeCancelHours: h, lateRefundPercent: p } = policy;
  if (wholeIn(h, 0, KARAOKE_FREE_CANCEL_HOURS_MAX) === null) {
    return {
      field: "karaokeFreeCancelHours",
      message: `Ücretsiz iptal süresi 0 ile ${KARAOKE_FREE_CANCEL_HOURS_MAX} saat arasında tam sayı olmalı.`,
    };
  }
  if (wholeIn(p, 0, 100) === null) {
    return {
      field: "karaokeLateRefundPercent",
      message: "Geç iptalde iade oranı 0 ile 100 arasında tam sayı olmalı.",
    };
  }
  if (p === 0 && h > 24) {
    return {
      field: "karaokeFreeCancelHours",
      message:
        "Geç iptalde iade %0 iken ücretsiz iptal süresi en fazla 24 saat olabilir: daha uzun bir sürede ödemenin tamamını tutmak tüketici aleyhine haksız şart sayılır.",
    };
  }
  if (h > 24 && p < 50) {
    return {
      field: "karaokeLateRefundPercent",
      message:
        "Ücretsiz iptal süresi 24 saatten uzunsa geç iptalde en az %50 iade edilmeli.",
    };
  }
  if (h === 0 && p < 50) {
    return {
      field: "karaokeLateRefundPercent",
      message:
        "Ücretsiz iptal süresi 0 iken rezervasyondan sonraki her iptal geç iptal sayılır; bu durumda geç iptalde en az %50 iade edilmeli.",
    };
  }
  return null;
}

/**
 * The first lafmobil version that prints the booking's own rule on EVERY
 * karaoke screen (spec §7: the reservation page and its cancel step still
 * print the fixed "2 saat, iade yok" pair in today's builds, and app requests
 * carry no version the server could tell them apart by). Until one is
 * released and set here, and the panel's minimum app version reaches it,
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
    return 'Şimdilik yalnız 2 saat ve %0 kaydedilebilir: uygulamanın yayındaki sürümleri rezervasyon ayrıntısında hâlâ kendi "2 saat, iade yok" kuralını yazıyor. Kuralı sunucudan okuyan uygulama sürümü yayınlanınca diğer değerler açılır.';
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
 * The cancellation rule in the operator's own words (16 Eki 2026: "2 saat
 * sonrası iptalde ücret iadesi yoktur gibisinden de yaz"): the default
 * policy's two sentences. Every booking made under the default prints these
 * verbatim - the pre-payment box, the reservation page and its cancel step,
 * the late-cancel refusal (web and API) and the confirmation e-mail. A booking
 * made under another policy prints its own (`karaokeRulesOf`).
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
