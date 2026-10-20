import "server-only";

import { cookies } from "next/headers";

import {
  ADMIN_COOKIE_NAME,
  getAdminSession,
  readSessionFromCookieValue,
} from "@/lib/admin/auth";
import { readChangeMarker } from "@/lib/admin/change-marker";
import {
  parseSignalCursor,
  signalCursorFor,
  signalUnchanged,
} from "@/lib/admin/panel-signal-core";
import { sessionBinding } from "@/lib/admin/poll-binding";
import { canAccess } from "@/lib/admin/roles";
import { getSettings } from "@/lib/admin/store";
import {
  VENUE_SIGNAL_HORIZON_MS,
  venueKeyHolds,
  venueSignalKey,
  type VenueQuickStatus,
  type VenueSignalAnswer,
} from "@/lib/admin/venue-quick-core";
import {
  getVenueStatus,
  isCafeOpenNow,
  nextOpenChangeAt,
} from "@/lib/mobile/venue";

/** No state: signed out, no Canlı durum, or the status could not be read. */
const NO_STATUS: VenueSignalAnswer = { status: null, cursor: "" };

/**
 * The top bar's köşk chip, behind venueQuickSignalAction (the Server Action
 * it polls once a minute while the tab is visible). Kept here, not in the
 * "use server" file: every export there is a public endpoint (rule 27).
 * panelSignal (panel-signal.ts) for a status instead of a count.
 *
 * The cheap path reads only the cookie's signature and the `venue` change
 * marker (change-marker.ts; one Data Cache read, no database): a validly
 * signed session of a role with Canlı durum that sends back a cursor handed
 * to this same cookie (poll-binding.ts) for the same marker, before the
 * minute its key names, gets `{ unchanged: true }`, which carries no data.
 * The marker moves on every write to `venue_status`, to the settings (the
 * hours) and to the panel accounts (`pub:site`, `live:access`), and the
 * key's minute is when the hours next turn the köşk open or closed
 * (nextOpenChangeAt), at most a day ahead. So "unchanged" lasts only while
 * the status, the hours and this session's account (rule 30) are what the
 * last full answer read.
 *
 * Everything else re-reads the account (`getAdminSession`), checks the
 * section and reads the status and the hours live, never from a cache;
 * the marker is read BEFORE them, so a write in between moves it. A
 * signature that is missing, bad, or of a role without Canlı durum (the
 * cashier) answers "no state" without the database. `getAdminSession`'s
 * "account unreadable" error propagates, as panelSignal's does (the chip's
 * poll catches it and keeps what it shows); a status read that fails is
 * logged and answers "no state".
 */
export async function venueSignal(
  cursor: unknown,
  nowMs: number = Date.now(),
): Promise<VenueSignalAnswer> {
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
  if (!signed || !canAccess("venue", signed.role)) return NO_STATUS;

  // Before the account and the status: a write to either after this read
  // moves the marker, so the next poll reads again and sees it.
  const marker = await readChangeMarker("venue");
  const sent = parseSignalCursor(cursor);
  if (
    sent &&
    venueKeyHolds(sent.key, nowMs) &&
    signalUnchanged(sent, marker, sent.key, bound)
  ) {
    return { unchanged: true };
  }

  const session = await getAdminSession();
  if (!session || !canAccess("venue", session.role)) return NO_STATUS;
  try {
    const [status, settings] = await Promise.all([
      getVenueStatus(),
      getSettings(),
    ]);
    const at = new Date(nowMs);
    const chip: VenueQuickStatus = {
      manualOverride: status.manualOverride,
      freeTables: status.freeTables,
      totalTables: status.totalTables,
      isOpen: isCafeOpenNow(settings.weeklyHours, status.manualOverride, at),
      saved: status.updatedAt !== "",
    };
    const turns = nextOpenChangeAt(
      settings.weeklyHours,
      status.manualOverride,
      at,
      VENUE_SIGNAL_HORIZON_MS,
    );
    const until = turns ? turns.getTime() : nowMs + VENUE_SIGNAL_HORIZON_MS;
    return {
      status: chip,
      cursor: signalCursorFor(marker, venueSignalKey(until), bound, nowMs),
    };
  } catch (err) {
    // A background poll must never turn a working panel into an error
    // boundary. The error's name only: nothing of the row or the account.
    console.error(
      "[admin/venue-signal] köşk durumu okunamadı",
      err instanceof Error ? err.name : "error",
    );
    return NO_STATUS;
  }
}
