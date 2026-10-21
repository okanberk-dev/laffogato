/**
 * Today's karaoke room, as the home page's band tells it (operator, 17 Eki
 * 2026: "sitede anasayfada da karaokeyi vurgula").
 *
 * Pure and client-safe: no store, no Zod (karaoke-core builds schemas at
 * load, see tests/client-bundle-weight.test.ts). The band's facts come from
 * the panel's settings on the server; the free hours come from the public
 * availability endpoint after hydration (use-karaoke-today.ts), so the home
 * page's server render never waits on the calendar.
 */

/** The room as the panel sets it (Ayarlar, /admin/mobil/ayarlar). */
export interface KaraokeFacts {
  /** `settings.karaokeCapacity`. */
  capacity: number;
  /** `settings.karaokeHourlyMinor`, kuruş. */
  hourlyMinor: number;
  /** `mobileApp.karaoke.closeHour`: 24 closes the evening at midnight. */
  closeHour: number;
  /** `mobileApp.karaoke.oroDiscountPct`: the top tier's discount, 0 = none. */
  rubyDiscountPct: number;
  /** The top tier's name, `TIER_LABELS.oro` ("RUBY"). */
  rubyLabel: string;
  /** `settings.karaokePrepay`: paid online and confirmed at once. */
  prepay: boolean;
}

/** The part of `GET /api/mobile/v1/karaoke/availability` (§7) the band reads. */
export interface KaraokeDay {
  date: string;
  slots: ReadonlyArray<{ startHour: number; available: boolean }>;
}

/** At most this many free hours are offered as chips. */
export const MAX_KARAOKE_CHIPS = 3;

export interface KaraokeChip {
  hour: number;
  label: string;
  href: string;
}

/**
 * What the live line says. `loading` and `error` show nothing: the band's
 * facts and its button stand on their own, and a calendar that cannot be read
 * never shows every hour as free.
 */
export type KaraokeToday =
  | { kind: "loading" }
  | { kind: "error" }
  /** `free` counts every free hour left today; `chips` offers the first three. */
  | { kind: "open"; date: string; free: number; chips: KaraokeChip[] }
  /** Hours are left today but every one is booked. */
  | { kind: "full"; date: string; tomorrowHref: string }
  /** The last hour has started: today is over for the room. */
  | { kind: "closed"; date: string; tomorrowHref: string };

/** `20` → "20:00"; midnight closes the evening as 24:00. */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

// The "-e" ending a clock hour takes follows its LAST spoken word: sıfır, bir,
// iki, üç, dört, beş, altı, yedi, sekiz, dokuz; then on, yirmi (karaoke-format
// does the same for "-den").
// prettier-ignore
const ONES_TO = ["a", "e", "ye", "e", "e", "e", "ya", "ye", "e", "a"];
const TENS_TO = ["", "a", "ye"];

/** `24` → "24:00’e", `22` → "22:00’ye", `20` → "20:00’ye". */
export function hourToLabel(hour: number): string {
  const h = Math.abs(Math.trunc(hour)) % 100;
  const ending =
    h % 10 !== 0 || h === 0 ? ONES_TO[h % 10] : (TENS_TO[h / 10] ?? "e");
  return `${hourLabel(h)}’${ending}`;
}

/**
 * The karaoke door's line on the home page: how many hours are still free
 * today once the calendar has answered, the room's size and closing hour
 * until then (and when it could not answer, or nothing is free). Without the
 * panel's facts it names no number at all rather than a typed-in one.
 */
export function karaokeDoorLine(
  today: KaraokeToday,
  facts: KaraokeFacts | undefined,
): string {
  if (today.kind === "open") return `Bugün ${today.free} boş saat`;
  return facts
    ? `${facts.capacity} kişiye kadar · ${hourToLabel(facts.closeHour)}`
    : "Saatini seç";
}

/** The booking page for `date`, with `hour` preselected when given. */
export function karaokeHref(date: string, hour?: number): string {
  return hour === undefined
    ? `/karaoke?tarih=${date}`
    : `/karaoke?tarih=${date}&saat=${hour}`;
}

/** "2026-10-17" → "2026-10-18", on the calendar (no time zone involved). */
export function nextCalendarDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * `?saat=` on /karaoke: "21" or "21:00" → 21. Anything else is null, and the
 * booking form falls back to the first free hour. Whether the hour is free is
 * the calendar's call, not this one's.
 */
export function parseSaatParam(
  raw: string | string[] | undefined,
): number | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{1,2})(?::00)?$/.exec(raw.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  return hour >= 0 && hour <= 23 ? hour : null;
}

/**
 * The live line from one day's slots and the köşk's clock (minutes since
 * midnight, Istanbul): up to three free hours that have not started yet.
 * The server already closes the hours behind its own clock; the visitor's
 * clock drops any that started while the page sat open.
 */
export function readKaraokeDay(
  day: KaraokeDay,
  nowMinutes: number,
): Exclude<KaraokeToday, { kind: "loading" } | { kind: "error" }> {
  const ahead = day.slots.filter((s) => s.startHour * 60 > nowMinutes);
  const free = ahead.filter((s) => s.available);
  if (free.length > 0) {
    return {
      kind: "open",
      date: day.date,
      free: free.length,
      chips: free.slice(0, MAX_KARAOKE_CHIPS).map((s) => ({
        hour: s.startHour,
        label: hourLabel(s.startHour),
        href: karaokeHref(day.date, s.startHour),
      })),
    };
  }
  const tomorrowHref = karaokeHref(nextCalendarDay(day.date));
  return ahead.length > 0
    ? { kind: "full", date: day.date, tomorrowHref }
    : { kind: "closed", date: day.date, tomorrowHref };
}

/** Whether a JSON body has the shape `readKaraokeDay` needs. */
export function isKaraokeDay(body: unknown): body is KaraokeDay {
  if (typeof body !== "object" || body === null) return false;
  const { date, slots } = body as { date?: unknown; slots?: unknown };
  return (
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Array.isArray(slots) &&
    slots.every(
      (s) =>
        typeof s === "object" &&
        s !== null &&
        Number.isInteger((s as { startHour?: unknown }).startHour) &&
        typeof (s as { available?: unknown }).available === "boolean",
    )
  );
}

/** Minutes since midnight on the köşk's clock (rule 22: never `getHours()`). */
export function istanbulMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === t)?.value ?? "", 10) || 0;
  return get("hour") * 60 + get("minute");
}

/** The public calendar (docs/API-MOBILE.md §7): no date means today, Tuzla. */
export const KARAOKE_AVAILABILITY_URL = "/api/mobile/v1/karaoke/availability";

/**
 * One reading of today's calendar: `error` for a 503 (the database is away),
 * any other non-2xx, a network failure or a body of the wrong shape - never
 * a guess. Rejects only when `signal` aborted it.
 */
export async function loadKaraokeToday(
  fetchImpl: typeof fetch,
  now: () => Date,
  signal?: AbortSignal,
): Promise<KaraokeToday> {
  let body: unknown;
  try {
    const res = await fetchImpl(KARAOKE_AVAILABILITY_URL, {
      signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { kind: "error" };
    body = await res.json();
  } catch (err) {
    if (signal?.aborted) throw err;
    return { kind: "error" };
  }
  return isKaraokeDay(body)
    ? readKaraokeDay(body, istanbulMinutes(now()))
    : { kind: "error" };
}
