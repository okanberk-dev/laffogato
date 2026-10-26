import { NextResponse } from "next/server";

import { listPanelOpenOrderRows } from "@/lib/admin/store";
import {
  PANEL_ORDERS_MAX,
  PANEL_ORDERS_VERSION,
  panelOrderRowsComplete,
  panelOrdersLiveSince,
  panelOrdersSince,
  sortForPanelOrders,
  toPanelOrder,
  type PanelOrder,
} from "@/lib/panel/orders-feed-core";
import {
  signedCaller,
  signedCallerKeys,
  type SignedCaller,
} from "@/lib/panel/signed-callers";

/**
 * `GET /api/panel/orders` - the köşk's panel (ladmin.laffogato.net) reading
 * the open café orders for its bar screen, after this site pinged it
 * (orders-ping.ts) or when the screen is opened stale
 * (src/lib/panel/orders-feed-core.ts, docs/PANEL-ORDERS.md).
 *
 * Server to server, no cookie: signed with the shared `KARAOKE_SYNC_SECRET`
 * like the karaoke route (CLAUDE.md rule 7), or by LafPOS, the café's till,
 * with its own `LAFPOS_SYNC_SECRET` (signed-callers.ts, docs/LAFPOS.md; it
 * pulls when `/api/pos/orders/version` moves). Neither key set: 503. Bad,
 * missing or stale signature: 401, nothing more said. The answer is the
 * whitelisted shape of `toPanelOrder`: the lines to make with their notes,
 * where they go, the planned time, a first name and the member's note on a
 * table or gel-al order; never a surname, e-mail, phone, address, courier
 * note or payment reference. Read only: the bar screen's
 * buttons move an order through `POST /api/panel/orders/stage`.
 *
 * `src/proxy.ts` lets every `/api/*` path through untouched.
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
  if (!signedCaller(keys, request, "GET", url, "")) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  const now = new Date();
  // One over the cap tells a full screen from a cut one.
  const limit = PANEL_ORDERS_MAX + 1;
  let rows: Awaited<ReturnType<typeof listPanelOpenOrderRows>>;
  try {
    rows = await listPanelOpenOrderRows(
      panelOrdersSince(now),
      limit,
      panelOrdersLiveSince(now),
    );
  } catch (err) {
    console.error("[panel-orders] orders could not be read", err);
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }

  const orders = sortForPanelOrders(
    rows
      .map((row) => toPanelOrder(row, now))
      .filter((o): o is PanelOrder => o !== null),
  );
  return NextResponse.json(
    {
      version: PANEL_ORDERS_VERSION,
      now: now.toISOString(),
      // A read that came back full may have left rows out, however many
      // of the rows it did bring stay on the screen.
      complete:
        panelOrderRowsComplete(rows, limit) &&
        orders.length <= PANEL_ORDERS_MAX,
      orders: orders.slice(0, PANEL_ORDERS_MAX),
    },
    { headers: NO_STORE },
  );
}
