import { z } from "zod";

import { DEFAULT_MOBILE_APP_CONFIG, type MobileAppConfig } from "./app-config";
import {
  karaokeDiscountPctFor,
  quoteKaraoke,
  type KaraokeQuote,
} from "./karaoke-quote";
import {
  isPartialRefund,
  karaokeCancelDeadline,
  karaokeCancelPolicyOf,
  karaokeRulesOf,
  type KaraokeCancelPolicy,
} from "./karaoke-time";
import { isTaxRate } from "@/lib/utils/kdv";

export * from "./karaoke-time";

/**
 * Karaoke reservation rules and pure helpers (docs/API-MOBILE.md §7).
 *
 * Split out of `karaoke.ts` the way `loyalty-core.ts` is split out of the
 * loyalty module, and for the same reason: the web booking form needs the
 * price quote and the slot maths in the browser, and importing them from
 * `karaoke.ts` dragged `server-only`, `pg` and `node:crypto` into the client
 * bundle.
 *
 * Deliberately NO "server-only" and NO database import. Everything here takes
 * the live rules as an argument, so the browser, the server action, the mobile
 * endpoint and the tests all reason about one set of rules; `karaoke.ts` is
 * where those rules are read from `getSettings()`.
 */

export type KaraokeRules = MobileAppConfig["karaoke"];

/**
 * Defaults, kept for tests and back-compat. The live values come from
 * `settings.mobileApp.karaoke`; these only apply when nothing was configured.
 */
export const DEFAULT_KARAOKE_RULES: Readonly<KaraokeRules> =
  DEFAULT_MOBILE_APP_CONFIG.karaoke;

/** First bookable hour of the day (slot "12" = 12:00-13:00). Default. */
export const KARAOKE_FIRST_HOUR = DEFAULT_KARAOKE_RULES.firstHour;
/** The room closes at midnight; the last slot starts at 23. Default. */
export const KARAOKE_CLOSE_HOUR = DEFAULT_KARAOKE_RULES.closeHour;
/** Longest block one reservation may cover, in hours. Default. */
export const KARAOKE_MAX_HOURS = DEFAULT_KARAOKE_RULES.maxHours;
/** How far ahead a member may book, in days (today counts as day 0). Default. */
export const KARAOKE_BOOKING_WINDOW_DAYS =
  DEFAULT_KARAOKE_RULES.bookingWindowDays;
/** ORO tier discount on the room price, in percent. Default. */
export const ORO_DISCOUNT_PCT = DEFAULT_KARAOKE_RULES.oroDiscountPct;

export type KaraokeReservationStatus = "requested" | "confirmed" | "cancelled";

export const KARAOKE_STATUS_LABELS: Record<KaraokeReservationStatus, string> = {
  requested: "Talep",
  confirmed: "Onaylandı",
  cancelled: "İptal",
};

export { isKaraokeRef } from "./karaoke-ref";

/**
 * Where the booking's money stands (16 Eki 2026, `20261016063311_karaoke_
 * prepay.sql` carries the full table). Beside `status`, never instead of it:
 * `requested` is what holds the hour in the overlap constraint and the cap.
 *
 * - `none`: paid at the venue - older rows, the panel's switch off, an app
 *   build that does not opt in to `prepay`.
 * - `pending`: an unpaid hold (always `requested`), until `paymentDueAt`.
 * - `paid`: collected; the booking is confirmed on its own.
 * - `refunding`: a refund was started and is not settled. A POS that did not
 *   answer is not a refund (CLAUDE.md rule 29), so a person settles it.
 * - `refunded`: the money went back (always `cancelled`).
 * - `expired`: the hold lapsed unpaid (always `cancelled`).
 */
export type KaraokePaymentStatus =
  "none" | "pending" | "paid" | "refunding" | "refunded" | "expired";

export const KARAOKE_PAYMENT_STATUSES: readonly KaraokePaymentStatus[] = [
  "none",
  "pending",
  "paid",
  "refunding",
  "refunded",
  "expired",
];

export const KARAOKE_PAYMENT_LABELS: Record<KaraokePaymentStatus, string> = {
  none: "Ödeme mekânda",
  pending: "Ödeme bekleniyor",
  paid: "Ödendi",
  refunding: "İade sonucu bekleniyor",
  refunded: "İade edildi",
  expired: "Ödenmedi, süresi doldu",
};

/** The row's payment state; rows written before the column read `none`. */
export function paymentStatusOf(
  r: Pick<KaraokeReservation, "paymentStatus">,
): KaraokePaymentStatus {
  const s = r.paymentStatus;
  return s && (KARAOKE_PAYMENT_STATUSES as readonly string[]).includes(s)
    ? s
    : "none";
}

/**
 * The confirmation a paid booking records before it is made - the same shape
 * as an order's `legalConsent` (`OrderLegalConsent`), so one review reads one
 * format: when, which documents, which revision, and from where.
 */
export interface KaraokeLegalConsent {
  acceptedAt: string;
  documents: string[];
  version: string;
  /**
   * The separate boxes that were ticked, each its own act (operator, 16 Eki
   * 2026): `on-bilgilendirme` (MSY m.7 teyit), `hizmet-sozlesmesi` (the
   * contract accepted) and `kvkk-aydinlatma` - an ACKNOWLEDGEMENT that the
   * privacy notice was read, not a consent (KVKK m.10).
   */
  confirmations?: string[];
  /** `web` or `app`: which surface showed the boxes. */
  surface?: "web" | "app";
  ip?: string;
  userAgent?: string;
}

/** The three boxes a paid booking needs, in the order they are shown. */
export const KARAOKE_CONFIRMATIONS = [
  "on-bilgilendirme",
  "hizmet-sozlesmesi",
  "kvkk-aydinlatma",
] as const;

export interface KaraokeReservation {
  id: string;
  customerEmail: string;
  customerName: string;
  /** YYYY-MM-DD, Istanbul calendar day. */
  date: string;
  startHour: number;
  hours: number;
  guests: number;
  status: KaraokeReservationStatus;
  priceMinor: number;
  discountMinor: number;
  totalMinor: number;
  note: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Contact details from the web form (name goes to `customerName`). Empty
   * on app bookings, which do not send them. `contactConsentAt` is when the
   * member agreed to be reached about this booking.
   */
  contactEmail?: string;
  contactPhone?: string;
  contactConsentAt?: string;
  /**
   * Online prepayment (16 Eki 2026). Optional in the type because a row
   * written before the migration, and a test fixture, may lack them; read
   * the state through `paymentStatusOf`.
   */
  paymentStatus?: KaraokePaymentStatus;
  /** ISO instant the newest payment page stops taking the card; "" if none. */
  paymentDueAt?: string;
  paidAt?: string;
  refundedAt?: string;
  /** What the POS collected for THIS booking, kuruş. 0 until paid. */
  paidMinor?: number;
  /** Provider reference of the payment that paid the row; "" until paid. */
  paymentRef?: string;
  /**
   * Where it was booked; decides where a payment return lands. `staff`: a
   * free hour the köşk gave to make good its own late cancel (`makeGoodFor`).
   */
  channel?: "web" | "app" | "staff" | "";
  legalConsent?: KaraokeLegalConsent | null;
  /**
   * Booked on the web without an account (16 Eki 2026). Never listed for a
   * member, never in an app inbox, never discounted by a member's tier;
   * reached through its signed link (karaoke-link.ts) only.
   */
  guest?: boolean;
  /**
   * The karaoke KDV rate (whole %) the booking was made at, from
   * `settings.taxRates.karaoke`; its total includes it. null (or absent) on
   * bookings made before 20261017150000_kdv_rates.sql.
   */
  taxRatePct?: number | null;
  /**
   * The cancellation policy the booking was made under, and what it showed
   * (20261018130000_karaoke_cancel_policy.sql): every deadline, sentence and
   * refund of the booking reads these, never the panel's current values.
   * NULL on rows made before the snapshot: 2 hours / 0 %, default sentences
   * (`karaokeCancelPolicyOf`, `karaokeRulesOf`).
   */
  freeCancelHours?: number | null;
  lateRefundPercent?: number | null;
  /** The last instant a member's own cancel refunds in full (ISO). */
  cancelDeadline?: string | null;
  /** The two sentences shown at booking, `[refundRule, lateRule]`. */
  cancellationRules?: string[] | null;
  /**
   * Kuruş owed back, or refunded, when it is not the whole payment: a late
   * cancel's share (`round(paid × P / 100)`), plus what an hour cancelled
   * late and sold again gives back (`resaleRefundMinor`). NULL: the whole
   * payment.
   */
  refundMinor?: number | null;
  /**
   * The köşk's late cancel made good (20261019180000_karaoke_make_good.sql,
   * karaoke-make-good-core.ts): the amount, the last day (Istanbul,
   * YYYY-MM-DD) the free hour can be booked, when one of the two options
   * was used, and the bank transfer when the money was chosen. NULL on
   * every booking without one.
   */
  makeGoodUntil?: string | null;
  makeGoodMinor?: number | null;
  makeGoodUsedAt?: string | null;
  makeGoodPaidMinor?: number | null;
  makeGoodPaidOn?: string | null;
  /** On the free hour itself: the booking it makes good. */
  makeGoodFor?: string | null;
  /**
   * Hours (start hours) of a late-cancelled booking already refunded
   * because they were sold again, and the part of `refundMinor` for them.
   */
  resoldHours?: number[] | null;
  resaleRefundMinor?: number | null;
  /**
   * The part of `refundMinor` a person already recorded as refunded by
   * hand: a resale after the late share went back owes only the rest.
   */
  refundSettledMinor?: number | null;
}

/** What the web form collects about who to reach for a booking. */
export interface ReservationContact {
  name: string;
  email: string;
  phone: string;
  consentAt: string;
}

/**
 * The web form's contact block, validated. Pure so the form and the action
 * share one set of rules.
 */
export function validateReservationContact(raw: {
  name: string;
  email: string;
  phone: string;
  consent: boolean;
}):
  | { ok: true; value: Omit<ReservationContact, "consentAt"> }
  | { ok: false; message: string } {
  const name = raw.name.replace(/\s+/g, " ").trim();
  if (name.length < 3 || !name.includes(" ") || name.length > 80) {
    return { ok: false, message: "Adını ve soyadını yaz." };
  }
  const email = raw.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    return { ok: false, message: "Geçerli bir e-posta adresi yaz." };
  }
  const phone = normalizeTrPhone(raw.phone);
  if (!phone) {
    return {
      ok: false,
      message: "Geçerli bir cep telefonu yaz (ör. 0532 123 45 67).",
    };
  }
  if (!raw.consent) {
    return {
      ok: false,
      message:
        "Rezervasyonunla ilgili sana ulaşabilmemiz için izin kutusunu işaretle.",
    };
  }
  return { ok: true, value: { name, email, phone } };
}

/** "0532 123 45 67", "+90 532…", "532…" → "+905321234567"; else "". */
export function normalizeTrPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.replace(/^(?:90|0)/, "");
  return /^5\d{9}$/.test(local) ? `+90${local}` : "";
}

export interface KaraokeSlot {
  startHour: number;
  available: boolean;
}

export interface KaraokeAvailability {
  date: string;
  slots: KaraokeSlot[];
  hourlyMinor: number;
  capacity: number;
  oroDiscountPct: number;
  /** Rules from `settings.mobileApp.karaoke`, so the app's picker matches the server. */
  firstHour: number;
  closeHour: number;
  maxHours: number;
  bookingWindowDays: number;
  /**
   * Additive (16 Eki 2026, §7): a new booking is paid online when it is made
   * (`settings.karaokePrepay`). Off, the old request flow, paid at the venue.
   */
  paymentRequired: boolean;
  /**
   * Up to how many hours before the start the member may cancel for a full
   * refund: the policy a booking made NOW gets (Ayarlar > Karaoke). 0: no
   * free window.
   */
  freeCancelHours: number;
  /**
   * Additive (18 Eki 2026, §7.1): the share (whole %) of the payment a
   * cancel inside the window refunds, before the start. 0: refused.
   */
  lateRefundPercent: number;
  /**
   * Additive (16 Eki 2026, §7): the documents a paid booking confirms
   * (`/legal/{slug}`, §13) and the privacy notice it acknowledges - the app
   * shows one unticked box for each, and sends `legalConsent: true` only when
   * every one is ticked.
   */
  consentDocs: string[];
  privacyDoc: string;
  /** The cancellation rule, verbatim, to print above the boxes. */
  cancellationRules: string[];
  /**
   * Additive (17 Eki 2026, §7): the KDV rate (whole %) inside `hourlyMinor`
   * and every total, from Ayarlar > Vergi (`settings.taxRates.karaoke`).
   */
  taxRatePct: number;
}

/** Wire shape of a reservation - an explicit allow-list (§7). */
export interface KaraokeReservationJson {
  id: string;
  date: string;
  startHour: number;
  hours: number;
  guests: number;
  status: KaraokeReservationStatus;
  priceMinor: number;
  discountMinor: number;
  totalMinor: number;
  createdAt: string;
  /**
   * Additive (16 Eki 2026, §7). An app build that predates them ignores all
   * three; one that does not opt in to `prepay` only ever sees `none`.
   */
  paymentStatus: KaraokePaymentStatus;
  /** When an unpaid hold's payment page closes (ISO); "" unless `pending`. */
  paymentDueAt: string;
  /**
   * Last moment the member may cancel it themselves for a full refund (ISO):
   * the booking's own snapshot (2 h before the start on older rows).
   */
  cancellableUntil: string;
  /**
   * Additive (17 Eki 2026, §7): the KDV rate the booking was made at; its
   * total includes it. null on bookings made before rates were recorded.
   */
  taxRatePct: number | null;
  /**
   * Additive (18 Eki 2026, §7.1): the booking's own cancellation policy and
   * the two sentences it was shown (2 / 0 and the default pair on older
   * rows), so a screen after the booking prints the rule it was booked under.
   */
  freeCancelHours: number;
  lateRefundPercent: number;
  cancellationRules: string[];
  /**
   * Additive (18 Eki 2026, §7.1): what goes back to the card when it is not
   * the whole payment (a late cancel's share), kuruş; null otherwise.
   */
  refundMinor: number | null;
}

export function toReservationJson(
  r: KaraokeReservation,
): KaraokeReservationJson {
  const paymentStatus = paymentStatusOf(r);
  return {
    id: r.id,
    date: r.date,
    startHour: r.startHour,
    hours: r.hours,
    guests: r.guests,
    status: r.status,
    priceMinor: r.priceMinor,
    discountMinor: r.discountMinor,
    totalMinor: r.totalMinor,
    createdAt: r.createdAt,
    paymentStatus,
    paymentDueAt: paymentStatus === "pending" ? (r.paymentDueAt ?? "") : "",
    cancellableUntil: karaokeCancelDeadline(r).toISOString(),
    taxRatePct: isTaxRate(r.taxRatePct) ? r.taxRatePct : null,
    ...karaokeCancelPolicyOf(r),
    cancellationRules: [...karaokeRulesOf(r)],
    refundMinor: isPartialRefund(r) ? (r.refundMinor ?? null) : null,
  };
}

// ─── Pure: slots, conflicts, price ─────────────────────────────────────────

type Booking = Pick<KaraokeReservation, "startHour" | "hours" | "status">;

/** A reservation still holds its hours unless it was cancelled. */
export function holdsSlot(status: KaraokeReservationStatus | string): boolean {
  return status === "requested" || status === "confirmed";
}

/** Do `[startHour, startHour + hours)` and any active booking overlap? */
export function rangeConflicts(
  startHour: number,
  hours: number,
  bookings: readonly Booking[],
): boolean {
  const end = startHour + hours;
  return bookings.some(
    (b) =>
      holdsSlot(b.status) &&
      startHour < b.startHour + b.hours &&
      b.startHour < end,
  );
}

/** One entry per bookable hour of the day, in order. */
export function buildSlots(
  bookings: readonly Booking[],
  /** Minutes since midnight when the date is today; hours already past close. */
  nowMinutes?: number,
  rules: Pick<KaraokeRules, "firstHour" | "closeHour"> = DEFAULT_KARAOKE_RULES,
): KaraokeSlot[] {
  const slots: KaraokeSlot[] = [];
  for (let h = rules.firstHour; h < rules.closeHour; h += 1) {
    const past = nowMinutes !== undefined && h * 60 <= nowMinutes;
    slots.push({
      startHour: h,
      available: !past && !rangeConflicts(h, 1, bookings),
    });
  }
  return slots;
}

/** Discount for a loyalty tier; only ORO earns one. */
export function karaokeDiscountPct(
  tier: string | null | undefined,
  oroDiscountPct: number = ORO_DISCOUNT_PCT,
): number {
  return karaokeDiscountPctFor(tier, oroDiscountPct);
}

export type { KaraokeQuote };

/**
 * hours × hourly, minus the tier discount, all in kuruş. The arithmetic is in
 * `./karaoke-quote` so the browser can have it without Zod; see there.
 */
export function quoteReservation(
  hours: number,
  hourlyMinor: number,
  tier: string | null | undefined,
  oroDiscountPct: number = ORO_DISCOUNT_PCT,
): KaraokeQuote {
  return quoteKaraoke(hours, hourlyMinor, tier, oroDiscountPct);
}

// ─── Pure: request validation ──────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" that names a real calendar day. */
export function isCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map((s) => parseInt(s, 10));
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map((s) => parseInt(s, 10));
  const [ty, tm, td] = to.split("-").map((s) => parseInt(s, 10));
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
}

export interface ReservationRequest {
  date: string;
  startHour: number;
  hours: number;
  guests: number;
  note: string;
}

/**
 * The schema depends on the configured rules (opening hour, longest block),
 * so it is built per request rather than once at module load - otherwise a
 * change saved in the panel would not apply until the next deploy.
 */
function buildRequestSchema(
  rules: Pick<KaraokeRules, "firstHour" | "closeHour" | "maxHours">,
) {
  return z.object({
    date: z
      .string({ error: "Tarih gerekli." })
      .refine(isCalendarDate, "Tarih YYYY-AA-GG biçiminde olmalı."),
    startHour: z
      .number({ error: "Başlangıç saati gerekli." })
      .int("Başlangıç saati tam sayı olmalı.")
      .min(rules.firstHour, `Karaoke en erken ${rules.firstHour}:00'de başlar.`)
      .max(
        rules.closeHour - 1,
        `Son başlangıç saati ${rules.closeHour - 1}:00.`,
      ),
    hours: z
      .number({ error: "Süre gerekli." })
      .int("Süre tam saat olmalı.")
      .min(1, "En az 1 saat.")
      .max(rules.maxHours, `En fazla ${rules.maxHours} saat.`),
    guests: z
      .number({ error: "Kişi sayısı gerekli." })
      .int("Kişi sayısı tam sayı olmalı.")
      .min(1, "En az 1 kişi."),
    note: z.string().trim().max(200, "Not en fazla 200 karakter.").default(""),
  });
}

export type ValidateReservationResult =
  | { ok: true; value: ReservationRequest }
  | {
      ok: false;
      message: string;
      /**
       * The request field the message is about, when the app can point at
       * one (L7-21). Only `note` for now: it is the one free-text box on the
       * booking form, and its 400 used to be indistinguishable from a bad
       * date or hour.
       */
      field?: "note";
    };

/**
 * Shape + business rules of a reservation request. `today` is the Istanbul
 * calendar day so a member booking at 00:30 sees the right "today".
 */
/** Open (requested or confirmed, not yet past) bookings one member may hold. */
export const KARAOKE_OPEN_CAP = 2;

export function validateReservationRequest(
  input: unknown,
  ctx: {
    today: string;
    capacity: number;
    nowMinutes?: number;
    /** Configured rules; the defaults apply when omitted (tests, back-compat). */
    rules?: KaraokeRules;
  },
): ValidateReservationResult {
  const rules = ctx.rules ?? DEFAULT_KARAOKE_RULES;
  const parsed = buildRequestSchema(rules).safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      message: first?.message ?? "İstek geçersiz.",
      ...(first?.path[0] === "note" ? { field: "note" as const } : {}),
    };
  }
  const v = parsed.data;
  const ahead = daysBetween(ctx.today, v.date);
  if (ahead < 0) {
    return { ok: false, message: "Geçmiş bir tarihe rezervasyon yapılamaz." };
  }
  if (
    ahead === 0 &&
    ctx.nowMinutes !== undefined &&
    v.startHour * 60 <= ctx.nowMinutes
  ) {
    return { ok: false, message: "Geçmiş bir saate rezervasyon yapılamaz." };
  }
  if (ahead > rules.bookingWindowDays) {
    return {
      ok: false,
      message: `En fazla ${rules.bookingWindowDays} gün sonrasına rezervasyon yapılabilir.`,
    };
  }
  if (v.startHour + v.hours > rules.closeHour) {
    return {
      ok: false,
      message: `Oda ${rules.closeHour}:00'te kapanır; süreyi kısalt ya da daha erken başla.`,
    };
  }
  if (v.guests > ctx.capacity) {
    return {
      ok: false,
      message: `Oda en fazla ${ctx.capacity} kişi alıyor.`,
    };
  }
  return { ok: true, value: v };
}

/**
 * `expectedCancelPolicy` on a booking request (18 Eki 2026, additive): the
 * cancellation rule the customer was shown before booking - the
 * `freeCancelHours` and `lateRefundPercent` the app read from
 * `GET /karaoke/availability`, or the web form's hidden pair. The way
 * `expectedTotalMinor` guards a wallet order's total, it lets the server
 * refuse a booking whose rule the panel changed while the page was open.
 * Absent (an app build from before it): null, nothing to compare.
 */
const ExpectedCancelPolicySchema = z.object({
  expectedCancelPolicy: z
    .object({
      freeCancelHours: z.number().int(),
      lateRefundPercent: z.number().int(),
    })
    .nullish(),
});

export function readExpectedCancelPolicy(
  input: unknown,
): KaraokeCancelPolicy | null | "invalid" {
  const parsed = ExpectedCancelPolicySchema.safeParse(input);
  if (!parsed.success) return "invalid";
  return parsed.data.expectedCancelPolicy ?? null;
}
