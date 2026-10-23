// Client-safe (no server-only): the panel's background counts (the nav
// badges, the order list's "new orders" count) asked the database every 30
// to 60 seconds while a panel page sat visible, so the database (Neon, free
// plan, asleep only after five idle minutes) never slept while a till
// screen was on. Each answer now carries a cursor: the change marker it was
// read under (change-marker.ts), what it counted, and the session it was
// handed to (poll-binding.ts). While the marker and the key are the same,
// for the same session, the action answers `{ unchanged: true }` without
// the database and the badge keeps its number. The marker also moves when
// a panel account is written, so a revoked session is re-read (rule 30).

import {
  ORDER_ALERT_MARKER_SETTLE_MS,
  isChangeMarker,
  isSessionBinding,
  markerMadeAt,
} from "./order-alerts-core";

/** What a signal action answers. */
export type PanelSignalAnswer =
  { unchanged: true } | { count: number | null; cursor: string };

export interface PanelSignalCursor {
  marker: string;
  /** What was counted: the Istanbul day, or since/scope for the list. */
  key: string;
  /** The session it was handed to (poll-binding.ts `sessionBinding`). */
  session: string;
}

const KEY_RE = /^[0-9a-z-]{1,32}$/;
const CURSOR_RE =
  /^s2\.([0-9a-z]{1,12}-[0-9a-z]{1,24})\.([0-9a-z-]{1,32})\.([0-9a-f]{12})$/;
/** Longer than any cursor this file makes; anything longer is junk. */
const MAX_CURSOR_LENGTH = 96;

export function formatSignalCursor(
  marker: string,
  key: string,
  session: string,
): string {
  return isChangeMarker(marker) && KEY_RE.test(key) && isSessionBinding(session)
    ? `s2.${marker}.${key}.${session}`
    : "";
}

/** The cursor sent back, or null for none, junk or an old (`s1`) shape. */
export function parseSignalCursor(raw: unknown): PanelSignalCursor | null {
  if (typeof raw !== "string" || !raw || raw.length > MAX_CURSOR_LENGTH) {
    return null;
  }
  const m = CURSOR_RE.exec(raw);
  return m ? { marker: m[1], key: m[2], session: m[3] } : null;
}

/**
 * The cursor an answer read at `nowMs` under `marker` hands out, or "" when
 * it should not vouch for the marker yet: a marker made moments ago may
 * have been stored just after a write it did not see (the bell's rule,
 * `ORDER_ALERT_MARKER_SETTLE_MS`), so the next ask reads again. `nowMs` is
 * taken before the account and the count are read.
 */
export function signalCursorFor(
  marker: string | null,
  key: string,
  session: string,
  nowMs: number,
): string {
  if (marker === null) return "";
  const made = markerMadeAt(marker);
  if (made === null || nowMs < made + ORDER_ALERT_MARKER_SETTLE_MS) return "";
  return formatSignalCursor(marker, key, session);
}

/**
 * The same marker (no write to the table or to the panel accounts), the
 * same thing counted and the same session: nothing to read.
 */
export function signalUnchanged(
  cursor: PanelSignalCursor | null,
  marker: string | null,
  key: string,
  session: string,
): boolean {
  return (
    cursor !== null &&
    marker !== null &&
    cursor.marker === marker &&
    cursor.key === key &&
    isSessionBinding(session) &&
    cursor.session === session
  );
}

/** The karaoke badge counts today, on the köşk's calendar: "2026-10-19". */
export function karaokeSignalKey(istanbulDate: string): string {
  return KEY_RE.test(istanbulDate) ? istanbulDate : "";
}

/**
 * The Faturalar badge counts by the köşk's day too: a deadline comes near
 * with the clock, not with a write, so a new day reads again. "2026-10-19".
 */
export function invoiceSignalKey(istanbulDate: string): string {
  return karaokeSignalKey(istanbulDate);
}

/** The order list counts above `since`, in its tab: "1042-open". */
export function orderListSignalKey(since: number, scope: string): string {
  const n = Number.isFinite(since) ? Math.max(0, Math.trunc(since)) : 0;
  return `${n}-${scope === "open" ? "open" : "all"}`;
}

/** The answer as the browser trusts it; anything else reads as "no badge". */
export function readSignalAnswer(value: unknown): PanelSignalAnswer {
  if (value && typeof value === "object") {
    const v = value as {
      unchanged?: unknown;
      count?: unknown;
      cursor?: unknown;
    };
    if (v.unchanged === true) return { unchanged: true };
    return {
      count:
        typeof v.count === "number" && Number.isFinite(v.count)
          ? v.count
          : null,
      cursor: typeof v.cursor === "string" ? v.cursor : "",
    };
  }
  return { count: null, cursor: "" };
}
