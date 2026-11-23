import "server-only";

import {
  countPanelAwaitingPaymentOrders,
  listPanelClosedOrderRows,
  listPanelOpenOrderRows,
  listPanelTillPaidOrderIds,
} from "@/lib/admin/store";
import { listOpenTableCalls } from "@/lib/admin/table-calls";
import {
  toPanelTableCalls,
  type PanelTableCall,
  type TableCallRow,
} from "@/lib/admin/table-calls-core";

import {
  PANEL_CLOSED_MAX,
  PANEL_ORDERS_MAX,
  panelAwaitingPaymentCount,
  panelAwaitingPaymentSince,
  panelClosedSince,
  panelOrderRowsComplete,
  panelOrdersLiveSince,
  panelOrdersSince,
  sortForPanelOrders,
  toPanelClosed,
  toPanelOrder,
  type PanelClosedOrder,
  type PanelClosedSourceRow,
  type PanelOrder,
  type PanelOrderSourceRow,
} from "./orders-feed-core";

/**
 * The bar screen's reads for one branch (`GET /api/panel/orders`, and the
 * stage route's answer). Pure shaping is in orders-feed-core.ts.
 */

/** What one read of the bar screen brings back, before it is shaped. */
export interface PanelOrdersRead {
  awaiting: number;
  rows: PanelOrderSourceRow[];
  calls: TableCallRow[];
  closed: PanelClosedSourceRow[];
  /** The ids among `rows` settled at the till. */
  till: string[];
}

/** What `GET /api/panel/orders` answers besides `version`, `now`, `branch`. */
export interface PanelOrdersAnswer {
  complete: boolean;
  orders: PanelOrder[];
  awaitingPayment: number;
  calls: PanelTableCall[];
  closed: PanelClosedOrder[];
}

/** One over the cap tells a full screen from a cut one. */
const READ_LIMIT = PANEL_ORDERS_MAX + 1;

/**
 * Reads the bar screen of `branch`. `awaiting: false` skips the
 * `awaitingPayment` count (LafPOS never reads it): the answer says 0.
 *
 * One read after the other: the pool is one connection, so this costs no
 * time, and the order is part of the answer's meaning.
 * - The count before the list: an order only goes from waiting to paid, so
 *   one paid in between is in the list (at worst in both), never in
 *   neither. Read the other way round, a payment landing between the two
 *   reads left the order out of both and the panel saw "0 waiting" with no
 *   new order.
 * - The open list before `closed`: an order that left the screen in
 *   between is in both (`toPanelClosed` leaves it out of `closed`, the next
 *   pull names it), never in neither (LafPOS would close it with no
 *   outcome).
 */
export async function readPanelOrders(
  branch: string,
  now: Date,
  opts: { awaiting: boolean } = { awaiting: true },
): Promise<PanelOrdersRead> {
  const awaiting = opts.awaiting
    ? await countPanelAwaitingPaymentOrders(
        panelAwaitingPaymentSince(now),
        branch,
      )
    : 0;
  const rows = await listPanelOpenOrderRows(
    panelOrdersSince(now),
    READ_LIMIT,
    panelOrdersLiveSince(now),
    branch,
  );
  const calls = await listOpenTableCalls(now, undefined, branch);
  const closed = await listPanelClosedOrderRows(
    panelOrdersSince(now),
    panelClosedSince(now),
    PANEL_CLOSED_MAX,
    branch,
  );
  // The till's payment row is written before the order is moved to paid
  // (markOrderPaidManually), so an order is never read open without it.
  const till =
    rows.length > 0
      ? [...(await listPanelTillPaidOrderIds(rows.map((r) => r.id)))]
      : [];
  return { awaiting, rows, calls, closed, till };
}

/** The read as the response carries it (the whitelist, the caps). */
export function panelOrdersAnswer(
  read: PanelOrdersRead,
  now: Date,
): PanelOrdersAnswer {
  const till = new Set(read.till);
  const orders = sortForPanelOrders(
    read.rows
      .map((row) => toPanelOrder(row, now, till.has(row.id)))
      .filter((o): o is PanelOrder => o !== null),
  );
  return {
    // A read that came back full may have left rows out, however many of
    // the rows it did bring stay on the screen.
    complete:
      panelOrderRowsComplete(read.rows, READ_LIMIT) &&
      orders.length <= PANEL_ORDERS_MAX,
    orders: orders.slice(0, PANEL_ORDERS_MAX),
    awaitingPayment: panelAwaitingPaymentCount(read.awaiting),
    calls: toPanelTableCalls(read.calls, now.getTime()),
    closed: toPanelClosed(read.closed, new Set(read.rows.map((r) => r.id))),
  };
}
