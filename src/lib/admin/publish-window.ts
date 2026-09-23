// Publish-window arithmetic - NO "server-only": the three /admin/mobil forms
// are client components and need the same offset rule the store applies when
// it reads what they submitted.

// Türkiye has kept UTC+3 all year since 2016, so a wall-clock time typed in
// the panel converts with one fixed offset and no DST table.
const ISTANBUL_OFFSET = "+03:00";
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Reads a publish-window field as an instant.
 *
 * A value with its own offset (or a `Z`) is taken as written; a bare
 * `2026-09-30T23:59` is what a manager types meaning Istanbul midnight, and
 * parsing it as server-local time - UTC on Vercel - dropped the post three
 * hours late. Anything else is not a time at all.
 */
export function parsePublishInstant(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  const bare = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(value);
  const at = Date.parse(
    bare ? `${value.replace(" ", "T")}${ISTANBUL_OFFSET}` : value,
  );
  return Number.isFinite(at) ? at : null;
}

/**
 * Stores a publish-window field as a UTC instant.
 *
 * Kept as ISO-8601 with a `Z` so `isPublishWindowOpen` and the app read the
 * same moment whatever the server's own timezone is (docs/API-MOBILE.md §1).
 * Text that is not a time is stored as typed - `isPublishWindowOpen` then
 * refuses to publish the row, so the manager sees their typo instead of a card
 * that never expires.
 */
export function normalizePublishInstant(raw: string): string {
  const at = parsePublishInstant(raw);
  return at === null ? raw.trim().slice(0, 40) : new Date(at).toISOString();
}

/**
 * The stored instant as `<input type="datetime-local">` wants it: the Istanbul
 * wall clock, `YYYY-MM-DDTHH:mm`, no offset.
 *
 * The inverse of `parsePublishInstant`'s bare-value branch, so what the form
 * shows is what the panel would store again untouched. Text that is not a time
 * comes back as "" - the input cannot display it, and the field is optional.
 */
export function toDateTimeLocalInput(raw: string): string {
  const at = parsePublishInstant(raw);
  if (at === null) return "";
  return new Date(at + ISTANBUL_OFFSET_MS).toISOString().slice(0, 16);
}

/**
 * True when now falls inside the row's optional window.
 *
 * Fails closed on an unparsable bound. `Date.parse` returns NaN for
 * "30.09.2026", and NaN compares false both ways, so a mistyped Bitiş used to
 * read as "no end date" and left the campaign live forever.
 */
export function isPublishWindowOpen(
  row: { startsAt: string; endsAt: string },
  now: number = Date.now(),
): boolean {
  if (row.startsAt.trim()) {
    const from = parsePublishInstant(row.startsAt);
    if (from === null || from > now) return false;
  }
  if (row.endsAt.trim()) {
    const to = parsePublishInstant(row.endsAt);
    if (to === null || to < now) return false;
  }
  return true;
}
