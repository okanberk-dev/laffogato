import "server-only";

import type { PublicCustomer } from "@/lib/customer/store";
import type { DbError } from "@/lib/db";

import { getSettings } from "@/lib/admin/store";
import { getDb, TABLES } from "@/lib/db";
import { nextSeq } from "@/lib/db/counters";
import { raiseDbError } from "@/lib/db/health";

import { istanbulClock } from "./venue";
import {
  buildSlots,
  holdsSlot,
  KARAOKE_OPEN_CAP,
  karaokeDiscountPct,
  quoteReservation,
  rangeConflicts,
  validateReservationRequest,
  type KaraokeAvailability,
  type KaraokeReservation,
  type KaraokeReservationStatus,
} from "./karaoke-core";

/**
 * Karaoke room reservations (docs/API-MOBILE.md §7) — the database-backed
 * half.
 *
 * One room, booked by the hour. The app asks which hours of a day are free,
 * the member requests a block, the staff confirm or cancel it from
 * /admin/mobil/karaoke. Money is computed here from
 * `settings.karaokeHourlyMinor` — no caller ever sends a price — and ORO
 * members get their discount at the moment of booking.
 *
 * Opening hour, closing hour, longest block, booking window and the ORO
 * percentage are business rules the staff edit at /admin/mobil/ayarlar
 * (`settings.mobileApp.karaoke`, docs/API-MOBILE.md §10). The pure helpers in
 * `karaoke-core.ts` take those rules as an argument so the browser, the tests
 * and the admin panel can reason about them without a database; the entry
 * points below read the live config through `getSettings()`.
 *
 * Two callers, one set of rules: `POST /api/mobile/v1/karaoke/reservations`
 * (Supabase bearer token, the phone) and `bookKaraokeAction` (bcrypt cookie
 * session, the web) both land on `createReservation`.
 */

/** Re-exported so every existing importer of this module keeps working. */
export * from "./karaoke-core";

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
  const rules = settings.mobileApp.karaoke;
  return {
    date,
    slots: buildSlots(
      bookings,
      clock.date === date ? clock.minutes : undefined,
      rules,
    ),
    hourlyMinor: settings.karaokeHourlyMinor,
    capacity: settings.karaokeCapacity,
    oroDiscountPct: rules.oroDiscountPct,
    firstHour: rules.firstHour,
    closeHour: rules.closeHour,
    maxHours: rules.maxHours,
    bookingWindowDays: rules.bookingWindowDays,
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
 * The conflict check reads before it writes. The window between the two is
 * closed by `karaoke_reservations_no_overlap` (an exclusion constraint over
 * date × hour range, cancelled rows excluded): the JS check answers with a
 * message the member can act on, the constraint is what makes it true when
 * two people tap the same free hour in the same second.
 */
export async function createReservation(
  customer: Pick<PublicCustomer, "email" | "name">,
  input: unknown,
  now: Date = new Date(),
): Promise<CreateReservationResult> {
  const settings = await getSettings();
  const rules = settings.mobileApp.karaoke;
  const clock = istanbulClock(now);
  const validated = validateReservationRequest(input, {
    today: clock.date,
    capacity: settings.karaokeCapacity,
    nowMinutes: clock.minutes,
    rules,
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
  const quote = quoteReservation(
    req.hours,
    settings.karaokeHourlyMinor,
    tier,
    rules.oroDiscountPct,
  );
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
  const ins = await sb.from(TABLES.karaokeReservations).insert(reservation);
  // 23P01: the exclusion constraint caught a booking that landed between our
  // read and our write. Same answer as the read-side check.
  if (ins.error?.code === "23P01") {
    return {
      ok: false,
      status: 409,
      error: "slot_taken",
      message: "Seçtiğin saatler dolu. Başka bir saat dene.",
    };
  }
  check(ins, "karaoke.createReservation");
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

/**
 * Why a status change did not happen. The panel showed one combined sentence
 * listing every possibility because this used to answer a bare `null`; each
 * reason needs a different thing from the staff member, so each is named.
 */
export type SetReservationStatusFailure =
  /** No row with that id — deleted, or a stale page. */
  | "not_found"
  /** The row has already moved somewhere this transition cannot start from. */
  | "wrong_status"
  /** Another confirmed booking already holds the hour. */
  | "slot_taken"
  /** Someone else changed it between the read and the write. */
  | "raced";

export type SetReservationStatusResult =
  | { ok: true; reservation: KaraokeReservation }
  | { ok: false; reason: SetReservationStatusFailure };

export async function setReservationStatus(
  id: string,
  status: KaraokeReservationStatus,
  now: Date = new Date(),
): Promise<SetReservationStatusResult> {
  const existing = await getReservation(id);
  if (!existing) return { ok: false, reason: "not_found" };
  if (!RESERVATION_TRANSITIONS[status].includes(existing.status)) {
    return { ok: false, reason: "wrong_status" };
  }

  // Confirming takes the hour: refuse if another confirmed booking has it.
  if (status === "confirmed") {
    const sameDay = await listByDate(existing.date);
    const clash = rangeConflicts(
      existing.startHour,
      existing.hours,
      sameDay.filter((r) => r.id !== existing.id && r.status === "confirmed"),
    );
    if (clash) return { ok: false, reason: "slot_taken" };
  }

  const sb = getDb();
  const updated = rows<{ id: string }>(
    await sb
      .from(TABLES.karaokeReservations)
      .update({ status, updatedAt: now.toISOString() })
      .eq("id", id)
      // The status guard is what makes the write lose the race rather than
      // overwrite it: the row has moved on since `existing` was read.
      .eq("status", existing.status)
      .select("id"),
    "karaoke.setReservationStatus",
  );
  if (updated.length === 0) return { ok: false, reason: "raced" };
  return {
    ok: true,
    reservation: { ...existing, status, updatedAt: now.toISOString() },
  };
}
