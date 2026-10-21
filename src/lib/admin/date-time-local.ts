// Client-safe, no imports: the value of an `<input type="datetime-local">`
// as the panel's forms post it, `YYYY-MM-DDTHH:mm`, the Istanbul wall clock
// with no offset (publish-window.ts reads it back: `parsePublishInstant`
// takes a bare value as Istanbul time, `toDateTimeLocalInput` writes one).
//
// DateTimeField (components/admin/ui/date-time-field.tsx) reads and writes
// the value through this: the React Aria widget works in its own date
// objects, but what the form posts is this string, in this shape, whichever
// control drew it (tests/admin-date-time-local.test.ts holds the round
// trip). No library here: src/lib stays free of the UI packages.

export interface LocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const SHAPE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

/**
 * A `datetime-local` value as its parts, or null for anything that is not a
 * real minute on a real day (a native box never posts one; a `min` or a
 * stored value might be). Seconds, which the box drops when they are zero,
 * are ignored.
 */
export function parseLocalDateTime(value: string): LocalDateTime | null {
  const m = SHAPE.exec(value.trim());
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1, 6).map(Number);
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return null;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > last) return null;
  return { year, month, day, hour, minute };
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** The parts as the box writes them: `YYYY-MM-DDTHH:mm`, no seconds. */
export function formatLocalDateTime(p: LocalDateTime): string {
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}
