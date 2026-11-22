import { NextResponse } from "next/server";

import { listReservationsForAdmin } from "@/lib/mobile/karaoke";
import {
  PANEL_MAX_ROWS,
  parsePanelRange,
  sortForPanel,
  toPanelReservation,
  withinLafposKaraokeReach,
  type PanelKaraokeReservation,
} from "@/lib/panel/karaoke-sync-core";
import { chooseBranch, KARAOKE_BRANCH } from "@/lib/panel/branches";
import {
  signedCaller,
  signedCallerKeys,
  type SignedCaller,
} from "@/lib/panel/signed-callers";

/**
 * `GET /api/panel/karaoke?from=YYYY-MM-DD&to=YYYY-MM-DD` - the köşk's panel
 * (ladmin.laffogato.net) reading the karaoke bookings of a window, after
 * this site pinged it or when its board is opened stale
 * (src/lib/panel/karaoke-sync-core.ts, docs/PANEL-KARAOKE.md).
 *
 * Server to server, no cookie: the panel signs the request with the shared
 * `KARAOKE_SYNC_SECRET` (HMAC-SHA256 over the instant, method, path, query
 * and body, five minutes of clock skew at most; CLAUDE.md rule 7). LafPOS,
 * the café's till, reads the same window with its own `LAFPOS_SYNC_SECRET`
 * (signed-callers.ts, docs/LAFPOS.md), so a room booked on the site is not
 * free on the till and an hour paid online is not charged again; it pulls
 * when the `karaoke` marker of `/api/pos/orders/version` moves. Neither key
 * set: 503, the link is off; LafPOS's key unset, or the panel's value
 * pasted in as it, leaves this route the panel's alone, as before. Bad,
 * missing or stale signature: 401, with nothing more said. Both callers get
 * the same whitelisted shape of `toPanelReservation` - a first name, the
 * hour, the head count, the states, the note, the amount; never an e-mail,
 * phone, surname, consent record or payment reference.
 *
 * The panel reads any window up to 400 days, as before. LafPOS's key, which
 * sits on the café's machine, reads Istanbul yesterday to tomorrow and no
 * more (`withinLafposKaraokeReach`): a wider window, or one with no `from`,
 * is 403 `forbidden` before anything is read, the way the menu route
 * refuses LafPOS a price.
 *
 * One branch's (21 Kas 2026, src/lib/panel/branches.ts): `?branch=`, else
 * the caller's own (the panel Tuzla, LafPOS its `LAFPOS_BRANCHES`, default
 * Marina). The one karaoke room is the Tuzla köşk's (`KARAOKE_BRANCH`): a
 * caller acting for another branch gets the window with no bookings and
 * nothing is read; the answer says which branch (`branch`). Before, Marina's
 * till read Tuzla's room and rang for its bookings.
 *
 * `src/proxy.ts` lets every `/api/*` path through untouched, so this one
 * gets no session refresh and no page CSP.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** The panel, and LafPOS with its own key. */
const CALLERS: readonly SignedCaller[] = ["panel", "lafpos"];

export async function GET(request: Request) {
  const keys = signedCallerKeys(process.env, CALLERS);
  if (!keys) {
    return NextResponse.json(
      { error: "not_configured" },
      { status: 503, headers: NO_STORE },
    );
  }
  const url = new URL(request.url);
  const caller = signedCaller(keys, request, "GET", url, "");
  if (!caller) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }
  const choice = chooseBranch(
    process.env,
    caller,
    url.searchParams.get("branch"),
  );
  if (!choice.ok) {
    return NextResponse.json(
      { error: choice.error, field: choice.field },
      { status: choice.status, headers: NO_STORE },
    );
  }
  const { branch } = choice;
  const now = new Date();
  const range = parsePanelRange(url.searchParams, now);
  if (!range) {
    return NextResponse.json(
      { error: "invalid_range" },
      { status: 400, headers: NO_STORE },
    );
  }
  // The till runs today's room: a stolen café machine must not page
  // through years of first names and notes (docs/LAFPOS.md).
  if (caller === "lafpos" && !withinLafposKaraokeReach(range, now)) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: 403, headers: NO_STORE },
    );
  }

  // Another branch has no room: nothing to read, nothing to ring for.
  if (branch !== KARAOKE_BRANCH) {
    return NextResponse.json(
      {
        now: now.toISOString(),
        from: range.from,
        to: range.to,
        branch,
        complete: true,
        reservations: [],
      },
      { headers: NO_STORE },
    );
  }

  let rows: Awaited<ReturnType<typeof listReservationsForAdmin>>;
  try {
    rows = await listReservationsForAdmin({
      from: range.from,
      to: range.to,
      // One over the cap tells a full window from a cut one; earliest
      // first, so a cut drops the far end of the window, not today.
      limit: PANEL_MAX_ROWS + 1,
      ascending: true,
    });
  } catch (err) {
    console.error("[panel-karaoke] bookings could not be read", err);
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }

  // A window past the cap is not a real case (one room, booked by the hour:
  // the panel's 90 days hold about a thousand slots); if it ever happens,
  // `complete: false` tells the panel the list was cut (at its far end: the
  // read is earliest first).
  const reservations = sortForPanel(
    rows
      .map(toPanelReservation)
      .filter((r): r is PanelKaraokeReservation => r !== null),
  ).slice(0, PANEL_MAX_ROWS);
  return NextResponse.json(
    {
      now: now.toISOString(),
      from: range.from,
      to: range.to,
      branch,
      complete: rows.length <= PANEL_MAX_ROWS,
      reservations,
    },
    { headers: NO_STORE },
  );
}
