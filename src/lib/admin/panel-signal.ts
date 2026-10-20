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
import { sessionBinding } from "@/lib/admin/poll-binding";
import { canAccess, type AdminSection } from "@/lib/admin/roles";

/** No badge: signed out, not allowed, or the count could not be read. */
const NO_BADGE: PanelSignalAnswer = { count: null, cursor: "" };

/**
 * One background count for the panel (panel-signal-core.ts), behind the
 * Server Actions that poll it. Kept here, not in a "use server" file:
 * every export there is a public endpoint (rule 27).
 *
 * The cheap path reads only the cookie's signature and the change marker:
 * a valid signature of a role with `section`, a cursor handed to this same
 * cookie (poll-binding.ts) for the same marker and the same `key`, and the
 * answer is `{ unchanged: true }` with no data. The marker moves on every
 * write to the table and to the panel accounts (change-marker.ts), so that
 * answer lasts only while this session's account is the one the last count
 * re-read (rule 30). Everything else re-reads the account
 * (`getAdminSession`), checks the section and answers the count with a new
 * cursor; the marker is read BEFORE the account and the count. A bad or
 * missing signature answers "no badge" without the database.
 * `getAdminSession`'s "account unreadable" error propagates as it did (the
 * poll catches it and keeps the old badge); a count that fails is logged
 * and answers "no badge".
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
  let bound = "";
  try {
    const jar = await cookies();
    const token = jar.get(ADMIN_COOKIE_NAME)?.value;
    signed = readSessionFromCookieValue(token);
    bound = sessionBinding(token);
  } catch {
    signed = null;
  }
  if (!signed) return NO_BADGE;

  // Before the account and the count: a write to either after this read
  // moves the marker. A token without the section could never use a
  // cursor: it gets none.
  let marker: string | null = null;
  if (opts.key && canAccess(opts.section, signed.role)) {
    marker = await readChangeMarker(opts.kind);
    const cursor = parseSignalCursor(opts.cursor);
    if (signalUnchanged(cursor, marker, opts.key, bound)) {
      return { unchanged: true };
    }
  }

  const now = Date.now();
  const session = await getAdminSession();
  if (!session || !canAccess(opts.section, session.role)) return NO_BADGE;
  try {
    const count = await opts.read();
    return { count, cursor: signalCursorFor(marker, opts.key, bound, now) };
  } catch (err) {
    // A poll must never turn a working panel into an error boundary.
    console.error(`[admin/panel-signal] ${opts.label}`, err);
    return NO_BADGE;
  }
}
