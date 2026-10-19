import "server-only";

import { cookies } from "next/headers";

import {
  ADMIN_COOKIE_NAME,
  getAdminSession,
  readSessionFromCookieValue,
} from "@/lib/admin/auth";
import {
  readChangeMarker,
  type ChangeMarkerKind,
} from "@/lib/admin/change-marker";
import {
  parseSignalCursor,
  signalCursorFor,
  signalUnchanged,
  type PanelSignalAnswer,
} from "@/lib/admin/panel-signal-core";
import { canAccess, type AdminSection } from "@/lib/admin/roles";

/** No badge: signed out, not allowed, or the count could not be read. */
const NO_BADGE: PanelSignalAnswer = { count: null, cursor: "" };

/**
 * One background count for the panel (panel-signal-core.ts), behind the
 * Server Actions that poll it. Kept here, not in a "use server" file:
 * every export there is a public endpoint (rule 27).
 *
 * The cheap path reads only the cookie's signature and the change marker:
 * a valid signature of a role with `section`, a cursor for the same marker
 * and the same `key`, and the answer is `{ unchanged: true }` with no data.
 * Everything else re-reads the account (`getAdminSession`, rule 30), checks
 * the section, reads the marker BEFORE the count, and answers the count with
 * a new cursor. A bad or missing signature answers "no badge" without the
 * database. `getAdminSession`'s "account unreadable" error propagates as it
 * did (the poll catches it and keeps the old badge); a count that fails is
 * logged and answers "no badge".
 */
export async function panelSignal(opts: {
  kind: ChangeMarkerKind;
  section: AdminSection;
  /** What is counted (karaokeSignalKey, orderListSignalKey, or a constant). */
  key: string;
  cursor: unknown;
  read: () => Promise<number>;
  /** For the log line when the count fails. */
  label: string;
}): Promise<PanelSignalAnswer> {
  let signed;
  try {
    const jar = await cookies();
    signed = readSessionFromCookieValue(jar.get(ADMIN_COOKIE_NAME)?.value);
  } catch {
    signed = null;
  }
  if (!signed) return NO_BADGE;

  let marker: string | null = null;
  let markerRead = false;
  const cursor = parseSignalCursor(opts.cursor);
  if (cursor && opts.key && canAccess(opts.section, signed.role)) {
    marker = await readChangeMarker(opts.kind);
    markerRead = true;
    if (signalUnchanged(cursor, marker, opts.key)) return { unchanged: true };
  }

  const session = await getAdminSession();
  if (!session || !canAccess(opts.section, session.role)) return NO_BADGE;
  const now = Date.now();
  try {
    // Before the count: a write after this read moves the marker.
    if (!markerRead) marker = await readChangeMarker(opts.kind);
    const count = await opts.read();
    return { count, cursor: signalCursorFor(marker, opts.key, now) };
  } catch (err) {
    // A poll must never turn a working panel into an error boundary.
    console.error(`[admin/panel-signal] ${opts.label}`, err);
    return NO_BADGE;
  }
}
