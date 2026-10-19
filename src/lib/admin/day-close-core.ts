// Client-safe (no server-only): the Gün sonu sheet's address and its day.
// The figures are drawn on the server (day-close.ts, store.ts
// `dayCloseRows`); this half is what a link, the palette or a test needs
// without the database.

import { istanbulDayStartIso } from "./order-filters";
import type { AdminSection } from "./roles";

/** The sheet, under Raporlar: the same role section (owner and manager). */
export const DAY_CLOSE_PATH = "/admin/raporlar/gun-sonu";

/** `?gun=YYYY-MM-DD`: an earlier day; without it, today. */
export const DAY_CLOSE_PARAM = "gun";

/** How far back the sheet goes: a year of closed days. */
export const DAY_CLOSE_MAX_DAYS_BACK = 366;

/**
 * The palette's "Git" entry for the sheet (admin UI v2, design §4.2): the
 * palette lists every nav item and tab with keywords, and this page is
 * neither. Gated like the page itself (`requireRole("reports")`). The
 * keywords never say "Z raporu": the sheet is not the till's fiscal
 * end-of-day report and must not be found as one.
 */
export const DAY_CLOSE_ENTRY: {
  readonly href: string;
  readonly label: string;
  readonly section: AdminSection;
  readonly keywords: readonly string[];
} = {
  href: DAY_CLOSE_PATH,
  label: "Gün sonu",
  section: "reports",
  keywords: ["gün sonu", "kapanış", "günlük özet", "bugün", "yazdır"],
};

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Today on the köşk's calendar, "YYYY-MM-DD" (fixed UTC+3, CLAUDE.md rule
 * 22). The server runs on UTC: from 00:00 to 03:00 in Tuzla its own date
 * is still yesterday's.
 */
export function istanbulToday(now: Date): string {
  return new Date(now.getTime() + ISTANBUL_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/** The calendar day `delta` days from `day` ("YYYY-MM-DD"). */
export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/**
 * The instants an Istanbul day covers: from its midnight (inclusive) to the
 * next one (exclusive), as UTC ISO strings. "2026-10-19" is
 * 2026-10-18T21:00:00.000Z up to 2026-10-19T21:00:00.000Z.
 */
export function istanbulDayBounds(day: string): { start: string; end: string } {
  return { start: istanbulDayStartIso(day), end: istanbulDayStartIso(day, 1) };
}

/** Whether an instant falls in the Istanbul day. Unreadable: no. */
export function inIstanbulDay(
  iso: string | null | undefined,
  day: string,
): boolean {
  const at = Date.parse(iso ?? "");
  if (!Number.isFinite(at)) return false;
  const { start, end } = istanbulDayBounds(day);
  return at >= Date.parse(start) && at < Date.parse(end);
}

/**
 * An instant inside the day (its noon in Tuzla), for the report functions
 * that cut their period from "now": `reportPeriodFilter("day", 1, anchor)`
 * is then exactly this day, today or an earlier one.
 */
export function dayAnchor(day: string): Date {
  return new Date(Date.parse(istanbulDayStartIso(day)) + DAY_MS / 2);
}

/**
 * The sheet's day from `?gun=`: a real calendar day, not after today and
 * at most a year back. Anything else (a typo, a future day) is today: the
 * sheet never answers for a day that has not happened.
 */
export function parseDayCloseDay(raw: unknown, now: Date): string {
  const today = istanbulToday(now);
  if (typeof raw !== "string") return today;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return today;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return today;
  }
  if (raw > today || raw < shiftDay(today, -DAY_CLOSE_MAX_DAYS_BACK)) {
    return today;
  }
  return raw;
}

/** The sheet's address for a day; today's is the bare path. */
export function dayCloseHref(day: string, now: Date): string {
  return day === istanbulToday(now)
    ? DAY_CLOSE_PATH
    : `${DAY_CLOSE_PATH}?${DAY_CLOSE_PARAM}=${day}`;
}

/** "19 Ekim 2026 Pazartesi": the day as the sheet names it. */
export function dayCloseLabel(day: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).format(dayAnchor(day));
}
