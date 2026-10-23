// Client-safe (no server-only): the karaoke page's week calendar (Innex's
// calendar and list on one screen, 22 Eki 2026). Pure, so the week's edges,
// the hours drawn and where a booking sits are tested without the page.

import { DEFAULT_KARAOKE_RULES } from "@/lib/mobile/karaoke-core";

import { KARAOKE_PANEL_PATH } from "./karaoke-panel";

/** `?gorunum=takvim`: the karaoke page's calendar. */
export const KARAOKE_VIEW_PARAM = "gorunum";
export const KARAOKE_CALENDAR_VIEW = "takvim";
/** `?hafta=YYYY-MM-DD`: any day of the week shown (its Monday is used). */
export const KARAOKE_WEEK_PARAM = "hafta";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function toUtc(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The day `n` days after `day` (calendar days; no clock involved). */
export function addDays(day: string, n: number): string {
  const d = toUtc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}

/** The Monday of `day`'s week: the köşk's weeks start on Monday. */
export function weekStart(day: string): string {
  const d = toUtc(day);
  const back = (d.getUTCDay() + 6) % 7;
  return addDays(day, -back);
}

/**
 * The week the address asks for (`?hafta=`, any day of it), else this
 * week. A malformed or impossible date falls back to this week.
 */
export function parseWeekParam(
  value: string | string[] | undefined,
  today: string,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && DAY_RE.test(raw) && isoDay(toUtc(raw)) === raw) {
    return weekStart(raw);
  }
  return weekStart(today);
}

/** The seven days from `monday`, Monday first. */
export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];
const WEEKDAYS_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const WEEKDAYS_LONG = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
];

/** "19 - 25 Ekim 2026", "26 Ekim - 1 Kasım 2026", across a year too. */
export function weekLabel(monday: string): string {
  const a = toUtc(monday);
  const b = toUtc(addDays(monday, 6));
  const am = MONTHS[a.getUTCMonth()];
  const bm = MONTHS[b.getUTCMonth()];
  if (a.getUTCFullYear() !== b.getUTCFullYear()) {
    return `${a.getUTCDate()} ${am} ${a.getUTCFullYear()} - ${b.getUTCDate()} ${bm} ${b.getUTCFullYear()}`;
  }
  if (am !== bm) {
    return `${a.getUTCDate()} ${am} - ${b.getUTCDate()} ${bm} ${b.getUTCFullYear()}`;
  }
  return `${a.getUTCDate()} - ${b.getUTCDate()} ${bm} ${b.getUTCFullYear()}`;
}

/** A column's head: "Pzt" and "19", and the long name for a phone's list. */
export function dayHead(day: string): {
  short: string;
  long: string;
  date: number;
  month: string;
} {
  const d = toUtc(day);
  const i = (d.getUTCDay() + 6) % 7;
  return {
    short: WEEKDAYS_SHORT[i],
    long: WEEKDAYS_LONG[i],
    date: d.getUTCDate(),
    month: MONTHS[d.getUTCMonth()],
  };
}

/** A booking as the calendar needs it. */
export interface CalendarSlot {
  date: string;
  startHour: number;
  hours: number;
}

/**
 * The hours the grid draws: the room's default opening hours, widened to
 * any booking outside them (a rule changed since, or a booking from before
 * it), so no booking is ever cut off.
 */
export function calendarHours(
  slots: readonly CalendarSlot[],
  rules: { firstHour: number; closeHour: number } = DEFAULT_KARAOKE_RULES,
): { first: number; close: number } {
  let first = rules.firstHour;
  let close = rules.closeHour;
  for (const s of slots) {
    first = Math.min(first, s.startHour);
    close = Math.max(close, s.startHour + s.hours);
  }
  return { first: Math.max(0, first), close: Math.min(24, close) };
}

/** The calendar's address for a week (and the list's, without one). */
export function karaokeCalendarHref(monday?: string): string {
  const params = new URLSearchParams({
    [KARAOKE_VIEW_PARAM]: KARAOKE_CALENDAR_VIEW,
  });
  if (monday) params.set(KARAOKE_WEEK_PARAM, monday);
  return `${KARAOKE_PANEL_PATH}?${params.toString()}`;
}

/**
 * Where the "now" line sits in today's column, as a share of the drawn
 * hours (0 at the first hour's top, 1 at closing), or null outside them.
 */
export function nowOffset(
  clock: { hour: number; minute: number },
  hours: { first: number; close: number },
): number | null {
  const at = clock.hour + clock.minute / 60;
  if (at < hours.first || at >= hours.close) return null;
  return (at - hours.first) / (hours.close - hours.first);
}
