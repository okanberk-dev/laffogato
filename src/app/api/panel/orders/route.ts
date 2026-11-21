import { NextResponse } from "next/server";

import {
  countPanelAwaitingPaymentOrders,
  listPanelOpenOrderRows,
} from "@/lib/admin/store";
import { listOpenTableCalls } from "@/lib/admin/table-calls";
import { toPanelTableCalls } from "@/lib/admin/table-calls-core";
import {
  PANEL_ORDERS_MAX,
  PANEL_ORDERS_VERSION,
  panelAwaitingPaymentCount,
  panelAwaitingPaymentSince,
  panelOrderRowsComplete,
  panelOrdersLiveSince,
  panelOrdersSince,
  sortForPanelOrders,
  toPanelOrder,
  type PanelOrder,
} from "@/lib/panel/orders-feed-core";
import { chooseBranch } from "@/lib/panel/branches";
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
 * Beside the list, `awaitingPayment` (added 28 Eki 2026; an older reader
 * ignores it): how many café orders for the screen still wait for a
 * payment on a checkout opened in the last 30 minutes (the order's own, or
 * a reopened one). A number only, no order: the panel polls a little while
 * it is above zero, so a payment whose ping was lost still reaches the bar
 * within minutes.
 *
 * Beside them, `calls` (added 6 Kas 2026; an older reader ignores it,
 * `version` stays 1): the open table calls ("Garson çağır" from the app,
 * src/lib/admin/table-calls-core.ts), oldest first, `{id, tableCode, label,
 * reason, createdAt}` and nothing about the guest; always present, `[]`
 * when none. The bar screen answers one with `POST /api/panel/calls/ack`.
 *
 * One branch's (21 Kas 2026, src/lib/panel/branches.ts): `?branch=`, else
 * the caller's own (the panel Tuzla, LafPOS its `LAFPOS_BRANCHES`, default
 * Marina). Orders, `awaitingPayment` and `calls` are that branch's alone
 * (a table order and a call carry their table's branch; gel-al and kurye
 * are Tuzla's), and the answer says which (`branch`). Before, both keys
 * got every order: Marina's till rang and moved Tuzla's paid orders.
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
  // One over the cap tells a full screen from a cut one.
  const limit = PANEL_ORDERS_MAX + 1;
  let rows: Awaited<ReturnType<typeof listPanelOpenOrderRows>>;
  let awaiting: number;
  let calls: Awaited<ReturnType<typeof listOpenTableCalls>>;
  try {
    // The count first, then the list, one after the other: an order only
    // goes from waiting to paid, so one paid in between is in the list (at
    // worst in both), never in neither. Read the other way round, a payment
    // landing between the two reads left the order out of both and the
    // panel saw "0 waiting" with no new order. The pool is one connection,
    // so this costs no time.
    awaiting = await countPanelAwaitingPaymentOrders(
      panelAwaitingPaymentSince(now),
      branch,
    );
    rows = await listPanelOpenOrderRows(
      panelOrdersSince(now),
      limit,
      panelOrdersLiveSince(now),
      branch,
    );
    calls = await listOpenTableCalls(now, undefined, branch);
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
      branch,
      // A read that came back full may have left rows out, however many
      // of the rows it did bring stay on the screen.
      complete:
        panelOrderRowsComplete(rows, limit) &&
        orders.length <= PANEL_ORDERS_MAX,
      orders: orders.slice(0, PANEL_ORDERS_MAX),
      awaitingPayment: panelAwaitingPaymentCount(awaiting),
      calls: toPanelTableCalls(calls, now.getTime()),
    },
    { headers: NO_STORE },
  );
}
