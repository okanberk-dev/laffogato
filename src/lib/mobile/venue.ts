import "server-only";

import type { DbError } from "@/lib/db";

import {
  getSettings,
  type AdminSettings,
  type DayOfWeek,
  type WeeklyHours,
} from "@/lib/admin/store";
import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import { hoursLabelFor } from "./menu-mapper";

/**
 * Live venue status (docs/API-MOBILE.md §6).
 *
 * One row (`venue_status`, id `main`) the staff edit from
 * /admin/mobil/canli-durum; the app's home screen and "Canlı durum" screen
 * read it through GET /api/mobile/v1/live-status. Whether the cafe is open
 * right now is decided here from `settings.weeklyHours` unless the staff
 * override it - a private event closes the house early, a football night
 * keeps it open past the posted hours.
 */

export const VENUE_TIMEZONE = "Europe/Istanbul";

export type VenueManualOverride = "auto" | "open" | "closed";
export type VenueWifi = "stable" | "slow" | "down";
export type VenueNoise = "low" | "medium" | "high";

export const VENUE_OVERRIDES: VenueManualOverride[] = [
  "auto",
  "open",
  "closed",
];
export const VENUE_WIFI_LEVELS: VenueWifi[] = ["stable", "slow", "down"];
export const VENUE_NOISE_LEVELS: VenueNoise[] = ["low", "medium", "high"];

export interface VenueStatus {
  id: string;
  manualOverride: VenueManualOverride;
  freeTables: number;
  totalTables: number;
  wifi: VenueWifi;
  noise: VenueNoise;
  power: boolean;
  note: string;
  /** ISO-8601 instant of the last staff edit; "" when never edited. */
  updatedAt: string;
}

export type VenueStatusInput = Omit<VenueStatus, "id" | "updatedAt">;

/** The wire shape of GET /live-status - an explicit allow-list, never a row. */
export interface LiveStatus {
  isOpen: boolean;
  openLabel: string;
  /** "" until the staff have saved the status even once. */
  updatedAt: string;
  /**
   * `null` means "nobody has ever reported": the app then says nothing about
   * freshness or free tables instead of "Az önce güncellendi · Boş masa 0/20",
   * which is what a never-saved row used to look like on the wire.
   */
  updatedAgoMinutes: number | null;
  freeTables: number | null;
  totalTables: number;
  wifi: VenueWifi;
  noise: VenueNoise;
  power: boolean;
  note: string;
  hours: { weekday: string; weekend: string };
  karaoke: { available: boolean; label: string };
}

export function defaultVenueStatus(): VenueStatus {
  return {
    id: "main",
    manualOverride: "auto",
    freeTables: 0,
    totalTables: 20,
    wifi: "stable",
    noise: "medium",
    power: true,
    note: "",
    updatedAt: "",
  };
}

// ─── Opening hours (pure) ──────────────────────────────────────────────────

const DAY_FROM_SHORT: Record<string, DayOfWeek> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

const DAY_BEFORE: Record<DayOfWeek, DayOfWeek> = {
  mon: "sun",
  tue: "mon",
  wed: "tue",
  thu: "wed",
  fri: "thu",
  sat: "fri",
  sun: "sat",
};

/** Wall-clock parts of an instant as seen in Tuzla. */
export function istanbulClock(now: Date): {
  day: DayOfWeek;
  minutes: number;
  date: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: VENUE_TIMEZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  const day = DAY_FROM_SHORT[get("weekday")] ?? "mon";
  const hour = parseInt(get("hour"), 10) || 0;
  const minute = parseInt(get("minute"), 10) || 0;
  return {
    day,
    minutes: hour * 60 + minute,
    date: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

/** "HH:MM" → minutes since midnight; "24:00" is the end of the day. */
export function parseClock(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 24 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Is the cafe open at `now`, going only by the posted hours?
 *
 * A day whose close is not later than its open ("09:00 - 01:00") runs past
 * midnight: the stretch after 00:00 belongs to the PREVIOUS day's entry. So at
 * 00:30 on Tuesday the cafe is open if Monday's hours say so - the room did not
 * empty at the stroke of midnight - and at 08:00 it is closed because neither
 * Monday's overnight tail nor Tuesday's own hours cover it.
 */
export function isOpenByHours(hours: WeeklyHours, now: Date): boolean {
  const { day, minutes } = istanbulClock(now);

  const today = hours[day];
  if (today && !today.closed) {
    const open = parseClock(today.open);
    const close = parseClock(today.close);
    if (open !== null && close !== null) {
      if (close > open) {
        if (minutes >= open && minutes < close) return true;
      } else if (minutes >= open) {
        // Overnight: open from `open` until midnight on this calendar day.
        return true;
      }
    }
  }

  const yesterday = hours[DAY_BEFORE[day]];
  if (yesterday && !yesterday.closed) {
    const open = parseClock(yesterday.open);
    const close = parseClock(yesterday.close);
    if (open !== null && close !== null && close <= open && minutes < close) {
      return true;
    }
  }

  return false;
}

/** Staff override first, posted hours otherwise. */
export function isCafeOpenNow(
  hours: WeeklyHours,
  manualOverride: VenueManualOverride,
  now: Date = new Date(),
): boolean {
  if (manualOverride === "open") return true;
  if (manualOverride === "closed") return false;
  return isOpenByHours(hours, now);
}

/**
 * Whether a café order may be taken for `scheduledAt`, or for now when it
 * is null. The staff override speaks about NOW: Açık keeps the köşk open
 * past its hours tonight, it does not open it at 04:00 on any of the next
 * seven days (docs/AUDIT.md §8, P1). A scheduled order is checked against
 * the posted hours at its time; Kapalı still refuses it, as it always did.
 */
export function isCafeOpenForOrder(
  hours: WeeklyHours,
  manualOverride: VenueManualOverride,
  scheduledAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (scheduledAt === null) return isCafeOpenNow(hours, manualOverride, now);
  if (manualOverride === "closed") return false;
  return isOpenByHours(hours, scheduledAt);
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
/** Turkey has kept UTC+03:00 all year since 2016 (CLAUDE.md rule 22). */
const ISTANBUL_OFFSET_MS = 3 * 60 * MINUTE_MS;

/**
 * The first instant after `now`, and no later than `now + horizonMs`, at
 * which isCafeOpenNow answers otherwise than it does at `now`; null when the
 * answer does not change in that time (an Açık or Kapalı override never
 * does). Pure.
 *
 * The answer can only turn on a posted minute: an open or close time of
 * some day, or midnight, where the day changes and with it the entry that
 * applies (an overnight tail included). Only those instants on the köşk's
 * clock are tried. The top bar's köşk chip (src/lib/admin/venue-signal.ts)
 * uses it to know how long "nothing changed" holds without a write.
 */
export function nextOpenChangeAt(
  hours: WeeklyHours,
  manualOverride: VenueManualOverride,
  now: Date,
  horizonMs: number = DAY_MS,
): Date | null {
  if (manualOverride !== "auto") return null;
  const start = now.getTime();
  const end = start + Math.max(0, horizonMs);

  const minutes = new Set<number>([0]);
  for (const day of Object.values(hours ?? {})) {
    for (const value of [day?.open, day?.close]) {
      const m = typeof value === "string" ? parseClock(value) : null;
      // "24:00" is the next midnight, already tried as 0.
      if (m !== null) minutes.add(m % (24 * 60));
    }
  }

  // Midnight of the köşk's day that `now` falls in, as an instant.
  const dayStart =
    Math.floor((start + ISTANBUL_OFFSET_MS) / DAY_MS) * DAY_MS -
    ISTANBUL_OFFSET_MS;
  const candidates: number[] = [];
  for (let d = 0; dayStart + d * DAY_MS <= end; d++) {
    for (const m of minutes) {
      const t = dayStart + d * DAY_MS + m * MINUTE_MS;
      if (t > start && t <= end) candidates.push(t);
    }
  }
  candidates.sort((a, b) => a - b);

  const openNow = isOpenByHours(hours, now);
  for (const t of candidates) {
    const at = new Date(t);
    if (isOpenByHours(hours, at) !== openNow) return at;
  }
  return null;
}

/** Monday-Friday and Saturday-Sunday, in `DAYS_OF_WEEK` order. */
const WEEKDAYS: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri"];
const WEEKEND_DAYS: DayOfWeek[] = ["sat", "sun"];

function minutesSince(iso: string, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 60_000));
}

/** Composes the §6 payload from the row and the settings. Pure. */
export function toLiveStatus(
  status: VenueStatus,
  settings: Pick<AdminSettings, "weeklyHours" | "karaokeCapacity">,
  now: Date = new Date(),
): LiveStatus {
  const isOpen = isCafeOpenNow(
    settings.weeklyHours,
    status.manualOverride,
    now,
  );
  return {
    isOpen,
    openLabel: isOpen ? "Şu an açık" : "Şu an kapalı",
    updatedAt: status.updatedAt,
    updatedAgoMinutes: minutesSince(status.updatedAt, now),
    // A row nobody has saved carries the defaults, not a count of the room.
    freeTables: status.updatedAt ? status.freeTables : null,
    totalTables: status.totalTables,
    wifi: status.wifi,
    noise: status.noise,
    power: status.power,
    note: status.note,
    // Grouped runs, not Monday and Saturday standing in for the rest: the
    // owner sets each day separately in Ayarlar → Saatler, and a longer Friday
    // used to be invisible here.
    hours: {
      weekday: hoursLabelFor(settings.weeklyHours, WEEKDAYS),
      weekend: hoursLabelFor(settings.weeklyHours, WEEKEND_DAYS),
    },
    karaoke: {
      available: settings.karaokeCapacity > 0,
      label: settings.karaokeCapacity > 0 ? "Rezervasyonla" : "Şu an yok",
    },
  };
}

// ─── Persistence ───────────────────────────────────────────────────────────

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

function pick<T extends string>(raw: unknown, allowed: T[], fallback: T): T {
  return typeof raw === "string" && (allowed as string[]).includes(raw)
    ? (raw as T)
    : fallback;
}

function clampInt(raw: unknown, min: number, max: number, fallback: number) {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Normalises a stored row (or a form input) into the domain shape. */
export function normalizeVenueStatus(
  raw: Record<string, unknown>,
): VenueStatus {
  const d = defaultVenueStatus();
  return {
    id: "main",
    manualOverride: pick(raw.manualOverride, VENUE_OVERRIDES, d.manualOverride),
    freeTables: clampInt(raw.freeTables, 0, 999, d.freeTables),
    totalTables: clampInt(raw.totalTables, 0, 999, d.totalTables),
    wifi: pick(raw.wifi, VENUE_WIFI_LEVELS, d.wifi),
    noise: pick(raw.noise, VENUE_NOISE_LEVELS, d.noise),
    power: typeof raw.power === "boolean" ? raw.power : d.power,
    note: typeof raw.note === "string" ? raw.note.trim().slice(0, 200) : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

/**
 * The single status row, or the defaults when nobody has saved one yet. Throws
 * on a database failure - a fabricated "open" while the database is down
 * would let the app place a cafe order the house cannot see.
 */
export async function getVenueStatus(): Promise<VenueStatus> {
  const sb = getDb();
  const row = one<Record<string, unknown>>(
    await sb
      .from(TABLES.venueStatus)
      .select("*")
      .eq("id", "main")
      .maybeSingle(),
    "getVenueStatus",
  );
  return row ? normalizeVenueStatus(row) : defaultVenueStatus();
}

export async function updateVenueStatus(
  input: VenueStatusInput,
  now: Date = new Date(),
): Promise<VenueStatus> {
  const next = normalizeVenueStatus({ ...input, updatedAt: now.toISOString() });
  const sb = getDb();
  check(
    await sb.from(TABLES.venueStatus).upsert(next, { onConflict: "id" }),
    "updateVenueStatus",
  );
  return next;
}

/**
 * The fields a partial save may write. `totalTables` is not one of them:
 * the table count is the owner's and the manager's (`mobileApp`), and
 * Personel's saves, the köşk chip's included, go through here.
 */
export type VenueStatusPatch = Partial<Omit<VenueStatusInput, "totalTables">>;

/**
 * A patch as the columns it sets, each value normalised the way a stored
 * row is (normalizeVenueStatus). Keys that are not given stay out, so the
 * statement never touches them. Pure.
 */
export function venuePatchColumns(
  patch: VenueStatusPatch,
): Partial<Omit<VenueStatusInput, "totalTables">> {
  const d = defaultVenueStatus();
  const set: Partial<Omit<VenueStatusInput, "totalTables">> = {};
  if (patch.manualOverride !== undefined) {
    set.manualOverride = pick(
      patch.manualOverride,
      VENUE_OVERRIDES,
      d.manualOverride,
    );
  }
  if (patch.freeTables !== undefined) {
    set.freeTables = clampInt(patch.freeTables, 0, 999, d.freeTables);
  }
  if (patch.wifi !== undefined) {
    set.wifi = pick(patch.wifi, VENUE_WIFI_LEVELS, d.wifi);
  }
  if (patch.noise !== undefined) {
    set.noise = pick(patch.noise, VENUE_NOISE_LEVELS, d.noise);
  }
  if (patch.power !== undefined) set.power = patch.power === true;
  if (patch.note !== undefined) {
    set.note = String(patch.note).trim().slice(0, 200);
  }
  return set;
}

/**
 * Writes only the fields in `patch`, in one statement:
 *
 *   UPDATE venue_status SET <given fields>, "updatedAt" = $now
 *   WHERE id = 'main' AND "totalTables" >= $freeTables RETURNING *
 *
 * No read first: a quick "Yoğun" from the top bar must not put back the
 * Wi-Fi or the note a colleague changed a second earlier, which a
 * read-modify-write of the whole row (updateVenueStatus' upsert) would.
 * The free tables are held to the STORED total in the same statement, so
 * a total lowered in between still refuses them.
 *
 * Returns the saved row, or null when the free tables exceed the total
 * (nothing written). A status nobody has saved yet has no row: it is then
 * inserted with the defaults plus the patch, `ON CONFLICT DO NOTHING`, so
 * a row that appeared meanwhile is never overwritten (the UPDATE runs
 * again on it instead).
 */
export async function patchVenueStatus(
  patch: VenueStatusPatch,
  now: Date = new Date(),
): Promise<VenueStatus | null> {
  const set = { ...venuePatchColumns(patch), updatedAt: now.toISOString() };
  const sb = getDb();
  const update = async () => {
    let q = sb.from(TABLES.venueStatus).update(set).eq("id", "main");
    if (set.freeTables !== undefined) q = q.gte("totalTables", set.freeTables);
    return one<Record<string, unknown>>(
      await q.select("*").maybeSingle(),
      "patchVenueStatus",
    );
  };

  const updated = await update();
  if (updated) return normalizeVenueStatus(updated);

  const seed = { ...defaultVenueStatus(), ...set };
  if (seed.freeTables > seed.totalTables) return null;
  const inserted = one<Record<string, unknown>>(
    await sb
      .from(TABLES.venueStatus)
      .upsert(seed, { onConflict: "id", ignoreDuplicates: true })
      .select("*")
      .maybeSingle(),
    "patchVenueStatus",
  );
  if (inserted) return normalizeVenueStatus(inserted);

  // The row was there all along (its total is below the free tables) or
  // arrived between the two statements: one more UPDATE decides.
  const again = await update();
  return again ? normalizeVenueStatus(again) : null;
}

/** Everything GET /live-status needs, in one call. */
export async function getLiveStatus(
  now: Date = new Date(),
): Promise<LiveStatus> {
  const [status, settings] = await Promise.all([
    getVenueStatus(),
    getSettings(),
  ]);
  return toLiveStatus(status, settings, now);
}
