import { NextResponse } from "next/server";

import { readPosOrdersMarker } from "@/lib/admin/change-marker";
import { rememberedRead } from "@/lib/admin/remembered-read";
import {
  countPanelAwaitingPaymentOrders,
  listPanelOpenOrderRows,
} from "@/lib/admin/store";
import { listOpenTableCalls } from "@/lib/admin/table-calls";
import { toPanelTableCalls } from "@/lib/admin/table-calls-core";
import { TAG_ORDERS } from "@/lib/cache/tags";
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
 * A quiet bar screen is remembered for LafPOS (22 Kas 2026,
 * src/lib/admin/remembered-read.ts): its 15-minute safety pull woke the
 * database four times an hour for as long as its business day was open.
 * When the last read under the current `live:orders` marker found nothing
 * at all (no row, none awaiting payment, no call), the same empty answer
 * is given without the database until a write to `orders` or `table_calls`
 * moves the marker, with one live read an hour as the net. Every bound of
 * the read is a lower one (paid, due, opened or called since), so with no
 * write an empty read can only stay empty. A read that found anything is
 * never remembered: it changes with the clock alone. The panel's key
 * (Tuzla) reads live on every ask, as before: `awaitingPayment` can rise
 * on a reopened checkout, which writes `payment_transactions` only, and
 * the panel polls on it; LafPOS does not read it and hears of the payment
 * by its version signal.
 *
 * `src/proxy.ts` lets every `/api/*` path through untouched.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** The panel, and LafPOS with its own key. */
const CALLERS: readonly SignedCaller[] = ["panel", "lafpos"];

/** What one ask reads: the three reads of the bar screen. */
interface LiveRead {
  awaiting: number;
  rows: Awaited<ReturnType<typeof listPanelOpenOrderRows>>;
  calls: Awaited<ReturnType<typeof listOpenTableCalls>>;
}

/** Nothing read at all: no row, none awaiting payment, no call. */
const QUIET: LiveRead = { awaiting: 0, rows: [], calls: [] };

function isQuiet(live: LiveRead): boolean {
  return (
    live.awaiting === 0 && live.rows.length === 0 && live.calls.length === 0
  );
}

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
  const readLive = async (): Promise<LiveRead> => {
    // The count first, then the list, one after the other: an order only
    // goes from waiting to paid, so one paid in between is in the list (at
    // worst in both), never in neither. Read the other way round, a payment
    // landing between the two reads left the order out of both and the
    // panel saw "0 waiting" with no new order. The pool is one connection,
    // so this costs no time.
    const awaiting = await countPanelAwaitingPaymentOrders(
      panelAwaitingPaymentSince(now),
      branch,
    );
    const rows = await listPanelOpenOrderRows(
      panelOrdersSince(now),
      limit,
      panelOrdersLiveSince(now),
      branch,
    );
    const calls = await listOpenTableCalls(now, undefined, branch);
    return { awaiting, rows, calls };
  };
  let live: LiveRead;
  try {
    if (caller === "lafpos") {
      // The marker before the read (remembered-read.ts).
      const marker = await readPosOrdersMarker();
      const read = await rememberedRead({
        name: "panel-orders-quiet",
        scope: branch,
        marker,
        tags: [TAG_ORDERS],
        nowMs: now.getTime(),
        read: readLive,
        remember: (l) => (isQuiet(l) ? { quiet: true } : null),
      });
      live = read.from === "database" ? read.live : QUIET;
    } else {
      live = await readLive();
    }
  } catch (err) {
    console.error("[panel-orders] orders could not be read", err);
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers: NO_STORE },
    );
  }
  const { awaiting, rows, calls } = live;

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
