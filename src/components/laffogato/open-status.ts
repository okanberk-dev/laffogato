/**
 * "Are we open right now?" from the opening-hours rows the visit page
 * already has - worked out on the visitor's clock but in the köşk's time zone.
 *
 * The visit page used to print "Şu an açık" and "Yarın · 27 Mayıs" as fixed
 * text: true for a few hours a day, and a date that was months out of date.
 * This reads the same rows the hours table shows (settings.weeklyHours, via
 * app-props), so the line and the table can never disagree.
 *
 * Pure and client-safe. Istanbul is fixed UTC+3 and the server is UTC (rule
 * 22), so the wall clock comes from Intl with the zone named, never from
 * `getHours()`.
 */

const ZONE = "Europe/Istanbul";

/** Mon = 0 … Sun = 6, the order DAYS_OF_WEEK (and so the rows) use. */
const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export interface OpenStatus {
  open: boolean;
  /** "02:00" - closing time when open, next opening time when closed. */
  at: string | null;
  /** When closed: whether the next opening is today (false = a later day). */
  opensToday?: boolean;
}

interface Span {
  open: number;
  close: number;
  openLabel: string;
  closeLabel: string;
}

function parseSpan(value: string): Span | null {
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const open = Number(m[1]) * 60 + Number(m[2]);
  const close = Number(m[3]) * 60 + Number(m[4]);
  return {
    open,
    close,
    openLabel: `${m[1].padStart(2, "0")}:${m[2]}`,
    closeLabel: `${m[3].padStart(2, "0")}:${m[4]}`,
  };
}

function istanbulNow(now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  return {
    day: WEEKDAY_INDEX[get("weekday")] ?? 0,
    minutes:
      (parseInt(get("hour"), 10) || 0) * 60 +
      (parseInt(get("minute"), 10) || 0),
  };
}

/**
 * `rows` is either seven day rows (Pazartesi … Pazar) or a single "Her gün"
 * row; anything else returns null and the caller shows the table alone.
 */
export function openStatus(
  rows: ReadonlyArray<readonly [string, string]>,
  now: Date = new Date(),
): OpenStatus | null {
  if (rows.length !== 7 && rows.length !== 1) return null;
  const spanFor = (day: number) =>
    parseSpan(rows.length === 1 ? rows[0][1] : rows[day][1]);
  const { day, minutes } = istanbulNow(now);

  // Still inside last night's shift (09:00 - 02:00 is open at 01:15).
  const yesterday = spanFor((day + 6) % 7);
  if (
    yesterday &&
    yesterday.close <= yesterday.open &&
    minutes < yesterday.close
  ) {
    return { open: true, at: yesterday.closeLabel };
  }

  const today = spanFor(day);
  if (today) {
    const overnight = today.close <= today.open;
    if (minutes >= today.open && (overnight || minutes < today.close)) {
      return { open: true, at: today.closeLabel };
    }
    if (minutes < today.open) {
      return { open: false, at: today.openLabel, opensToday: true };
    }
  }

  // Closed for the rest of today: the next day that opens.
  for (let step = 1; step <= 7; step++) {
    const next = spanFor((day + step) % 7);
    if (next) return { open: false, at: next.openLabel, opensToday: false };
  }
  return { open: false, at: null };
}
