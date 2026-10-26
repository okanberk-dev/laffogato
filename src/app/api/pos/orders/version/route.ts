import { NextResponse } from "next/server";

import {
  newChangeMarker,
  readPosKaraokeMarker,
  readPosOrdersMarker,
} from "@/lib/admin/change-marker";
import {
  signedCaller,
  signedCallerKeys,
  type SignedCaller,
} from "@/lib/panel/signed-callers";

/**
 * `GET /api/pos/orders/version` - LafPOS, the till server inside the café,
 * asking whether the online orders changed (docs/LAFPOS.md). It asks every
 * 20 seconds and pulls `GET /api/panel/orders` only when the answer differs
 * from the last one, so an app order reaches the bar screen within half a
 * minute while the database (Neon, free plan) still sleeps between orders.
 *
 * `{ "version": "<text>" }` is a change marker (src/lib/admin/change-marker.ts):
 * a random token kept in the Next Data Cache under `live:orders`. Nothing
 * here reads the database: a cache miss makes a new token, and every write
 * that expires `live:orders` (the data layer's write hook,
 * src/lib/db/index.ts) makes the next ask a miss, so the version moves when
 * an order is placed, paid, moved on or refunded. It carries no data and
 * means only "same as before" or "not".
 *
 * `karaoke` beside it is the same kind of marker under `live:karaoke`
 * alone: it moves when a karaoke booking is made, paid, confirmed, moved or
 * cancelled, and LafPOS then pulls `GET /api/panel/karaoke` for its room
 * box. An order does not move it, a booking does not move `version`. Added
 * to the answer, not swapped in: a LafPOS that reads only `version` is
 * unchanged.
 *
 * When the cache cannot say (`LAF_DATA_CACHE=off`, a failing cache, or off
 * under test), every answer is a new token: LafPOS then pulls on every ask.
 * A broken cache costs reads, never a missed order, the trade the panel's
 * own markers make.
 *
 * Signed like the panel routes (karaoke-sync-core.ts), with
 * `LAFPOS_SYNC_SECRET` only: the panel's key gets 401 here. No LafPOS key:
 * 503 `not_configured`. Bad, missing or stale signature: 401, nothing more
 * said. `src/proxy.ts` lets every `/api/*` path through untouched.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** LafPOS alone: the panel hears of orders by its ping. */
const CALLERS: readonly SignedCaller[] = ["lafpos"];

export async function GET(request: Request) {
  const keys = signedCallerKeys(process.env, CALLERS);
  if (!keys) {
    return NextResponse.json(
      { error: "not_configured" },
      { status: 503, headers: NO_STORE },
    );
  }
  const url = new URL(request.url);
  if (!signedCaller(keys, request, "GET", url, "")) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }
  const [orders, karaoke] = await Promise.all([
    readPosOrdersMarker(),
    readPosKaraokeMarker(),
  ]);
  return NextResponse.json(
    {
      version: orders ?? newChangeMarker(),
      karaoke: karaoke ?? newChangeMarker(),
    },
    { headers: NO_STORE },
  );
}
