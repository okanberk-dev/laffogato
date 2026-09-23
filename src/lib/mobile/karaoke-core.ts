import { z } from "zod";

import { DEFAULT_MOBILE_APP_CONFIG, type MobileAppConfig } from "./app-config";

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
}

export function toReservationJson(
  r: KaraokeReservation,
): KaraokeReservationJson {
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
  return tier === "oro" ? oroDiscountPct : 0;
}

export interface KaraokeQuote {
  priceMinor: number;
  discountMinor: number;
  totalMinor: number;
}

/** hours × hourly, minus the tier discount, all in kuruş. */
export function quoteReservation(
  hours: number,
  hourlyMinor: number,
  tier: string | null | undefined,
  oroDiscountPct: number = ORO_DISCOUNT_PCT,
): KaraokeQuote {
  const priceMinor = Math.max(0, Math.round(hours * hourlyMinor));
  const discountMinor = Math.round(
    (priceMinor * karaokeDiscountPct(tier, oroDiscountPct)) / 100,
  );
  return { priceMinor, discountMinor, totalMinor: priceMinor - discountMinor };
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
  | { ok: false; message: string };

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
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "İstek geçersiz.",
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
