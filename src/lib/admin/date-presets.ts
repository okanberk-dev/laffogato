// Client-safe, no imports: the quick ranges a list's date filter offers as
// links (Bugün, Dün, Son 7 gün, Son 30 gün, Bu ay, Geçen ay; admin UI v2,
// UI-14, design §5 #6). The FilterBar draws one link per preset from this,
// on the server too, so "Geçen ay" is one tap with no JavaScript.
//
// Every day is a day on the köşk's calendar: Europe/Istanbul, fixed UTC+3
// since 2016 (CLAUDE.md rule 22). The server runs on UTC, where 00:00 to
// 03:00 in Tuzla still reads as yesterday, and a laptop's own zone is
// anyone's guess, so nothing here asks the machine for its zone or its
// weekday: the instant is shifted by the offset and read with the UTC
// getters only (tests/admin-date-presets.test.ts runs it under three other
// zones and keeps `istanbulDayOf` equal to day-close-core's `istanbulToday`,
// which this does not import: that module brings the order filters with it,
// and the bar is on most panel pages).
//
// A range is `{ from, to }`, both "YYYY-MM-DD" and both inclusive, as the
// lists read `?bas=` and `?bit=` (list-params.ts, parseFilters).
//
// - Son 7 gün and Son 30 gün end today and count it: today and the six
//   (twenty-nine) days before.
// - Bu ay and Geçen ay are whole calendar months. Bu ay runs to the month's
//   last day, not to today: a booking list (the karaoke panel filters by the
//   booking's day) has this month's later days in it, and an order list has
//   nothing there to lose.

export type DatePresetId =
  "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "lastMonth";

export interface DatePreset {
  id: DatePresetId;
  label: string;
  /** First day, "YYYY-MM-DD". */
  from: string;
  /** Last day (inclusive), "YYYY-MM-DD". */
  to: string;
}

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

/** The köşk's calendar day of an instant, "YYYY-MM-DD". */
export function istanbulDayOf(now: Date): string {
  return new Date(now.getTime() + ISTANBUL_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

const dayParts = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return { y, m, d };
};

const isoOf = (at: Date) => at.toISOString().slice(0, 10);

/** The calendar day `delta` days from `day`. */
function shiftDay(day: string, delta: number): string {
  const { y, m, d } = dayParts(day);
  return isoOf(new Date(Date.UTC(y, m - 1, d + delta)));
}

/** First and last day of the month `monthDelta` months from `day`'s. */
function monthOf(
  day: string,
  monthDelta: number,
): { from: string; to: string } {
  const { y, m } = dayParts(day);
  return {
    from: isoOf(new Date(Date.UTC(y, m - 1 + monthDelta, 1))),
    // Day 0 of the next month is the target month's last day.
    to: isoOf(new Date(Date.UTC(y, m + monthDelta, 0))),
  };
}

/**
 * The six presets for the köşk's today (`now`, the instant the page is
 * drawn at), in the order the bar shows them.
 */
export function datePresets(now: Date = new Date()): DatePreset[] {
  const today = istanbulDayOf(now);
  const yesterday = shiftDay(today, -1);
  return [
    { id: "today", label: "Bugün", from: today, to: today },
    { id: "yesterday", label: "Dün", from: yesterday, to: yesterday },
    { id: "last7", label: "Son 7 gün", from: shiftDay(today, -6), to: today },
    {
      id: "last30",
      label: "Son 30 gün",
      from: shiftDay(today, -29),
      to: today,
    },
    { id: "thisMonth", label: "Bu ay", ...monthOf(today, 0) },
    { id: "lastMonth", label: "Geçen ay", ...monthOf(today, -1) },
  ];
}

/**
 * The preset the filter's current range is exactly, or null: the bar marks
 * that link. A range with one end only is no preset.
 */
export function activeDatePreset(
  presets: readonly DatePreset[],
  from: string | undefined,
  to: string | undefined,
): DatePresetId | null {
  if (!from || !to) return null;
  return presets.find((p) => p.from === from && p.to === to)?.id ?? null;
}
