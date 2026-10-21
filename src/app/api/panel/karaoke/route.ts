import { NextResponse } from "next/server";

import { listReservationsForAdmin } from "@/lib/mobile/karaoke";
import {
  PANEL_MAX_ROWS,
  panelSyncConfig,
  parsePanelRange,
  SIGNATURE_HEADER,
  sortForPanel,
  TIMESTAMP_HEADER,
  toPanelReservation,
  verifySignature,
  type PanelKaraokeReservation,
} from "@/lib/panel/karaoke-sync-core";

/**
 * `GET /api/panel/karaoke?from=YYYY-MM-DD&to=YYYY-MM-DD` - the köşk's panel
 * (ladmin.laffogato.net) reading the karaoke bookings of a window, after
 * this site pinged it or when its board is opened stale
 * (src/lib/panel/karaoke-sync-core.ts, docs/PANEL-KARAOKE.md).
 *
 * Server to server, no cookie: the panel signs the request with the shared
 * `KARAOKE_SYNC_SECRET` (HMAC-SHA256 over the instant, method, path, query
 * and body, five minutes of clock skew at most; CLAUDE.md rule 7). Unset
 * secret: 503, the link is off. Bad, missing or stale signature: 401, with
 * nothing more said. The answer is the whitelisted shape of
 * `toPanelReservation` - a first name, the hour, the head count, the states;
 * never an e-mail, phone, surname, consent record or payment reference.
 *
 * `src/proxy.ts` lets every `/api/*` path through untouched, so this one
 * gets no session refresh and no page CSP.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(request: Request) {
  const config = panelSyncConfig(process.env);
  if (!config) {
    return NextResponse.json(
      { error: "not_configured" },
      { status: 503, headers: NO_STORE },
    );
  }
  const url = new URL(request.url);
  const signed = verifySignature(config.secret, {
    method: "GET",
    url,
    body: "",
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    signature: request.headers.get(SIGNATURE_HEADER),
  });
  if (!signed) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }
  const now = new Date();
  const range = parsePanelRange(url.searchParams, now);
  if (!range) {
    return NextResponse.json(
      { error: "invalid_range" },
      { status: 400, headers: NO_STORE },
    );
  }

  let rows: Awaited<ReturnType<typeof listReservationsForAdmin>>;
  try {
    rows = await listReservationsForAdmin({
      from: range.from,
      to: range.to,
      // One over the cap tells a full window from a cut one.
      limit: PANEL_MAX_ROWS + 1,
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
  // `complete: false` tells the panel the list was cut.
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
      complete: rows.length <= PANEL_MAX_ROWS,
      reservations,
    },
    { headers: NO_STORE },
  );
}
