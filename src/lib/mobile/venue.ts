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

/**
 * Live venue status (docs/API-MOBILE.md §6).
 *
 * One row (`venue_status`, id `main`) the staff edit from
 * /admin/mobil/canli-durum; the app's home screen and "Canlı durum" screen
 * read it through GET /api/mobile/v1/live-status. Whether the cafe is open
 * right now is decided here from `settings.weeklyHours` unless the staff
 * override it — a private event closes the house early, a football night
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

/** The wire shape of GET /live-status — an explicit allow-list, never a row. */
export interface LiveStatus {
  isOpen: boolean;
  openLabel: string;
  updatedAt: string;
  updatedAgoMinutes: number;
  freeTables: number;
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
 * A day whose close is not later than its open ("09:00 – 01:00") runs past
 * midnight: the stretch after 00:00 belongs to the PREVIOUS day's entry. So at
 * 00:30 on Tuesday the cafe is open if Monday's hours say so — the room did not
 * empty at the stroke of midnight — and at 08:00 it is closed because neither
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

function hoursLabel(hours: WeeklyHours, day: DayOfWeek): string {
  const entry = hours[day];
  if (!entry || entry.closed) return "Kapalı";
  return `${entry.open} – ${entry.close}`;
}

function minutesSince(iso: string, now: Date): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
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
    freeTables: status.freeTables,
    totalTables: status.totalTables,
    wifi: status.wifi,
    noise: status.noise,
    power: status.power,
    note: status.note,
    hours: {
      weekday: hoursLabel(settings.weeklyHours, "mon"),
      weekend: hoursLabel(settings.weeklyHours, "sat"),
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
 * on a database failure — a fabricated "open" while the database is down
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
