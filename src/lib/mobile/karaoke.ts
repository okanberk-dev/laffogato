import "server-only";

import { z } from "zod";

import type { PublicCustomer } from "@/lib/customer/store";
import type { DbError } from "@/lib/db";

import { getSettings } from "@/lib/admin/store";
import { getDb, TABLES } from "@/lib/db";
import { nextSeq } from "@/lib/db/counters";
import { raiseDbError } from "@/lib/db/health";

import { istanbulClock } from "./venue";

/**
 * Karaoke room reservations (docs/API-MOBILE.md §7).
 *
 * One room, booked by the hour between 12:00 and 24:00. The app asks which
 * hours of a day are free, the member requests a block, the staff confirm or
 * cancel it from /admin/mobil/karaoke. Money is computed here from
 * `settings.karaokeHourlyMinor` — the app never sends a price — and ORO
 * members get their discount at the moment of booking.
 */

/** First bookable hour of the day (slot "12" = 12:00–13:00). */
export const KARAOKE_FIRST_HOUR = 12;
/** The room closes at midnight; the last slot starts at 23. */
export const KARAOKE_CLOSE_HOUR = 24;
export const KARAOKE_MAX_HOURS = 4;
/** How far ahead a member may book, in days (today counts as day 0). */
export const KARAOKE_BOOKING_WINDOW_DAYS = 60;
export const ORO_DISCOUNT_PCT = 15;

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
}

/** Wire shape of a reservation — an explicit allow-list (§7). */
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
): KaraokeSlot[] {
  const slots: KaraokeSlot[] = [];
  for (let h = KARAOKE_FIRST_HOUR; h < KARAOKE_CLOSE_HOUR; h += 1) {
    const past = nowMinutes !== undefined && h * 60 <= nowMinutes;
    slots.push({
      startHour: h,
      available: !past && !rangeConflicts(h, 1, bookings),
    });
  }
  return slots;
}

/** Discount for a loyalty tier; only ORO earns one. */
export function karaokeDiscountPct(tier: string | null | undefined): number {
  return tier === "oro" ? ORO_DISCOUNT_PCT : 0;
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
): KaraokeQuote {
  const priceMinor = Math.max(0, Math.round(hours * hourlyMinor));
  const discountMinor = Math.round(
    (priceMinor * karaokeDiscountPct(tier)) / 100,
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

const requestSchema = z.object({
  date: z
    .string({ error: "Tarih gerekli." })
    .refine(isCalendarDate, "Tarih YYYY-AA-GG biçiminde olmalı."),
  startHour: z
    .number({ error: "Başlangıç saati gerekli." })
    .int("Başlangıç saati tam sayı olmalı.")
    .min(
      KARAOKE_FIRST_HOUR,
      `Karaoke en erken ${KARAOKE_FIRST_HOUR}:00'de başlar.`,
    )
    .max(
      KARAOKE_CLOSE_HOUR - 1,
      `Son başlangıç saati ${KARAOKE_CLOSE_HOUR - 1}:00.`,
    ),
  hours: z
    .number({ error: "Süre gerekli." })
    .int("Süre tam saat olmalı.")
    .min(1, "En az 1 saat.")
    .max(KARAOKE_MAX_HOURS, `En fazla ${KARAOKE_MAX_HOURS} saat.`),
  guests: z
    .number({ error: "Kişi sayısı gerekli." })
    .int("Kişi sayısı tam sayı olmalı.")
    .min(1, "En az 1 kişi."),
  note: z.string().trim().max(200, "Not en fazla 200 karakter.").default(""),
});

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
  ctx: { today: string; capacity: number; nowMinutes?: number },
): ValidateReservationResult {
  const parsed = requestSchema.safeParse(input);
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
  if (ahead > KARAOKE_BOOKING_WINDOW_DAYS) {
    return {
      ok: false,
      message: `En fazla ${KARAOKE_BOOKING_WINDOW_DAYS} gün sonrasına rezervasyon yapılabilir.`,
    };
  }
  if (v.startHour + v.hours > KARAOKE_CLOSE_HOUR) {
    return {
      ok: false,
      message: `Oda ${KARAOKE_CLOSE_HOUR}:00'te kapanır; süreyi kısalt ya da daha erken başla.`,
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

// ─── Loyalty tier (optional dependency) ────────────────────────────────────

/**
 * The member's loyalty tier, or "" when it cannot be determined. The loyalty
 * module is owned by the rewards feature; a failure there must not block a
 * booking — the member simply pays the undiscounted price.
 */
async function resolveLoyaltyTier(email: string): Promise<string> {
  try {
    const mod = (await import("@/lib/mobile/loyalty")) as {
      getLoyalty?: (email: string) => Promise<{ tier?: string } | null>;
    };
    if (typeof mod.getLoyalty !== "function") return "";
    const loyalty = await mod.getLoyalty(email);
    return typeof loyalty?.tier === "string" ? loyalty.tier : "";
  } catch (err) {
    console.error(
      `[karaoke] loyalty tier unavailable: ${err instanceof Error ? err.message : String(err)}`,
    );
    return "";
  }
}

// ─── Persistence ───────────────────────────────────────────────────────────

function rows<T>(
  res: { data: T[] | null; error: DbError | null; status: number },
  ctx: string,
): T[] {
  if (res.error) raiseDbError(ctx, res.error, res.status);
  return res.data ?? [];
}

function one<T>(
  res: { data: T | null; error: DbError | null; status: number },
  ctx: string,
): T | null {
  if (res.error) raiseDbError(ctx, res.error, res.status);
  return res.data;
}

function check(
  res: { error: DbError | null; status: number },
  ctx: string,
): void {
  if (res.error) raiseDbError(ctx, res.error, res.status);
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

async function listByDate(date: string): Promise<KaraokeReservation[]> {
  const sb = getDb();
  return rows<KaraokeReservation>(
    await sb
      .from(TABLES.karaokeReservations)
      .select("*")
      .eq("date", date)
      .order("startHour", { ascending: true }),
    "karaoke.listByDate",
  );
}

export async function getAvailability(
  date: string,
  now: Date = new Date(),
): Promise<KaraokeAvailability> {
  const [settings, bookings] = await Promise.all([
    getSettings(),
    listByDate(date),
  ]);
  const clock = istanbulClock(now);
  return {
    date,
    slots: buildSlots(
      bookings,
      clock.date === date ? clock.minutes : undefined,
    ),
    hourlyMinor: settings.karaokeHourlyMinor,
    capacity: settings.karaokeCapacity,
    oroDiscountPct: ORO_DISCOUNT_PCT,
  };
}

export type CreateReservationResult =
  | { ok: true; reservation: KaraokeReservation }
  | {
      ok: false;
      status: 400 | 409;
      error: "invalid_request" | "slot_taken" | "too_many_reservations";
      message: string;
    };

/**
 * Books the room for a member. Price from settings, discount from the loyalty
 * tier, status `requested` until the staff confirm.
 *
 * The conflict check reads before it writes, so two members racing for the
 * same hour can both get through; the staff see the overlap on the panel and
 * cancel one. A partial unique index on the hour would close that window and
 * is worth adding once bookings are frequent enough for it to matter.
 */
export async function createReservation(
  customer: Pick<PublicCustomer, "email" | "name">,
  input: unknown,
  now: Date = new Date(),
): Promise<CreateReservationResult> {
  const settings = await getSettings();
  const clock = istanbulClock(now);
  const validated = validateReservationRequest(input, {
    today: clock.date,
    capacity: settings.karaokeCapacity,
    nowMinutes: clock.minutes,
  });
  if (!validated.ok) {
    return {
      ok: false,
      status: 400,
      error: "invalid_request",
      message: validated.message,
    };
  }
  const req = validated.value;

  // A member may hold a couple of open bookings, not the whole calendar.
  const mine = await listMine(customer.email);
  const open = mine.filter(
    (r) => r.status !== "cancelled" && r.date >= clock.date,
  ).length;
  if (open >= KARAOKE_OPEN_CAP) {
    return {
      ok: false,
      status: 409,
      error: "too_many_reservations",
      message: `Aynı anda en fazla ${KARAOKE_OPEN_CAP} açık rezervasyonun olabilir.`,
    };
  }

  const bookings = await listByDate(req.date);
  if (rangeConflicts(req.startHour, req.hours, bookings)) {
    return {
      ok: false,
      status: 409,
      error: "slot_taken",
      message: "Seçtiğin saatler dolu. Başka bir saat dene.",
    };
  }

  const tier = await resolveLoyaltyTier(customer.email);
  const quote = quoteReservation(req.hours, settings.karaokeHourlyMinor, tier);
  const seq = await nextSeq("krk");
  const iso = now.toISOString();
  const reservation: KaraokeReservation = {
    id: `krk-${String(seq).padStart(5, "0")}`,
    customerEmail: normalizeEmail(customer.email),
    customerName: customer.name,
    date: req.date,
    startHour: req.startHour,
    hours: req.hours,
    guests: req.guests,
    status: "requested",
    ...quote,
    note: req.note,
    createdAt: iso,
    updatedAt: iso,
  };

  const sb = getDb();
  check(
    await sb.from(TABLES.karaokeReservations).insert(reservation),
    "karaoke.createReservation",
  );
  return { ok: true, reservation };
}

/** The member's own reservations, newest date first. */
export async function listMine(email: string): Promise<KaraokeReservation[]> {
  const needle = normalizeEmail(email);
  if (!needle) return [];
  const sb = getDb();
  const escaped = needle.replace(/[%_]/g, (c) => `\\${c}`);
  const candidates = rows<KaraokeReservation>(
    await sb
      .from(TABLES.karaokeReservations)
      .select("*")
      .ilike("customerEmail", escaped)
      .order("date", { ascending: false })
      .order("startHour", { ascending: false }),
    "karaoke.listMine",
  );
  return candidates.filter((r) => normalizeEmail(r.customerEmail) === needle);
}

// ─── Admin ─────────────────────────────────────────────────────────────────

/** Every reservation from `fromDate` on (default: today), soonest first. */
export async function listReservationsForAdmin(
  fromDate?: string,
): Promise<KaraokeReservation[]> {
  const from = fromDate ?? istanbulClock(new Date()).date;
  const sb = getDb();
  return rows<KaraokeReservation>(
    await sb
      .from(TABLES.karaokeReservations)
      .select("*")
      .gte("date", from)
      .order("date", { ascending: true })
      .order("startHour", { ascending: true }),
    "karaoke.listReservationsForAdmin",
  );
}

export async function getReservation(
  id: string,
): Promise<KaraokeReservation | null> {
  const sb = getDb();
  return one<KaraokeReservation>(
    await sb
      .from(TABLES.karaokeReservations)
      .select("*")
      .eq("id", id)
      .maybeSingle(),
    "karaoke.getReservation",
  );
}

/**
 * Which status a booking may move to, from where.
 *
 * Without this, the confirm action was an unguarded write: a cancelled
 * booking whose hour had since been given to someone else could be confirmed
 * back into a double booking, and a completed evening could be "cancelled"
 * days later. The panel only offers the legal moves; this makes them the
 * only ones the endpoint accepts.
 */
const RESERVATION_TRANSITIONS: Record<
  KaraokeReservationStatus,
  readonly KaraokeReservationStatus[]
> = {
  requested: ["requested"],
  confirmed: ["requested"],
  cancelled: ["requested", "confirmed"],
};

export async function setReservationStatus(
  id: string,
  status: KaraokeReservationStatus,
  now: Date = new Date(),
): Promise<KaraokeReservation | null> {
  const existing = await getReservation(id);
  if (!existing) return null;
  if (!RESERVATION_TRANSITIONS[status].includes(existing.status)) return null;

  // Confirming takes the hour: refuse if another confirmed booking has it.
  if (status === "confirmed") {
    const sameDay = await listByDate(existing.date);
    const clash = rangeConflicts(
      existing.startHour,
      existing.hours,
      sameDay.filter((r) => r.id !== existing.id && r.status === "confirmed"),
    );
    if (clash) return null;
  }

  const sb = getDb();
  const updated = rows<{ id: string }>(
    await sb
      .from(TABLES.karaokeReservations)
      .update({ status, updatedAt: now.toISOString() })
      .eq("id", id)
      .eq("status", existing.status)
      .select("id"),
    "karaoke.setReservationStatus",
  );
  if (updated.length === 0) return null;
  return { ...existing, status, updatedAt: now.toISOString() };
}
