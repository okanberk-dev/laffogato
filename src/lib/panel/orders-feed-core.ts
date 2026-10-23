import { orderAlertLabel } from "@/lib/admin/order-alerts-core";
import { orderFulfillment, orderKind } from "@/lib/admin/order-channel";

import { firstNameOf } from "./karaoke-sync-core";

/**
 * The open café orders on the köşk panel's bar screen (ladmin.laffogato.net,
 * the `lafmaliyet` project): an app order paid at a table, for pickup or
 * for a courier appears there within seconds, rings, and leaves when the
 * staff move it on here (docs/PANEL-ORDERS.md).
 *
 * The link is the karaoke one (src/lib/panel/karaoke-sync-core.ts): a write
 * that expires `live:orders` pings the panel (orders-ping.ts), the panel
 * pulls `GET /api/panel/orders` signed with the shared secret. The panel
 * writes no order: its one-tap buttons ask `POST /api/panel/orders/stage`
 * (orders-stage-core.ts), and this site moves the order itself.
 *
 * What leaves: what the barista needs to make and hand over the order - the
 * lines with their options, where it goes ("Masa 4", "Gel-al", "Kurye"),
 * the planned time, the customer's first name. Never a surname, e-mail,
 * phone, address, courier note (a door code) or payment reference, and no
 * manual order (typed into this panel at the counter, rung on the till).
 *
 * Deliberately pure (no `server-only`, no database): the route and the
 * tests share it.
 */

export const PANEL_ORDERS_VERSION = 1;

/**
 * How far back an open order is read, by its payment: a planned order may
 * be paid up to seven days before its time (`SCHEDULE_MAX_DAYS`), and a day
 * more covers the night it falls on.
 */
export const PANEL_ORDERS_LOOKBACK_DAYS = 8;

/** Orders one pull returns at most; `complete` says whether more existed. */
export const PANEL_ORDERS_MAX = 200;

/**
 * An order not moved on this long after it was due (its planned time, or
 * its payment) is a forgotten one, not the barista's next job: it stays in
 * this panel's order list and leaves the bar screen.
 */
export const PANEL_ORDER_STALE_MS = 24 * 60 * 60_000;

/** A pickup order ready this long and not handed over leaves the screen. */
export const PANEL_ORDER_READY_STALE_MS = 12 * 60 * 60_000;

/** The statuses the route reads; `toPanelOrder` decides which stay. */
export const PANEL_ORDER_READ_STATUSES = [
  "paid",
  "preparing",
  "shipped",
] as const;

/**
 * Where the order is for the barista: `new` (paid, nobody has started),
 * `preparing`, `ready` (a pickup order at the counter, waiting for its
 * customer).
 */
export type PanelOrderStage = "new" | "preparing" | "ready";

export type PanelOrderFulfillment = "table" | "pickup" | "delivery";

export type PanelOrderLineSize = "M" | "L" | "single";

export interface PanelOrderLine {
  /** The menu item (`mnu-0011`), "" for a line without one. */
  menuItemId: string;
  /** The name the line was sold under. */
  name: string;
  size: PanelOrderLineSize;
  /** The options in words, "M · yulaf · +1 shot"; "" for none. */
  detail: string;
  qty: number;
}

export interface PanelOrder {
  id: string;
  orderNo: number;
  stage: PanelOrderStage;
  fulfillment: PanelOrderFulfillment;
  /** "Masa 4", "Gel-al", "Kurye": where it goes, in the counter's words. */
  label: string;
  /** The customer's first name, to call a pickup; "" when unknown. */
  firstName: string;
  /** The planned time (ISO); "" = as soon as possible. */
  scheduledFor: string;
  paidAt: string;
  /** The lines to make, the cancelled ones left out. */
  lines: PanelOrderLine[];
  totalMinor: number;
  /** The order in this site's panel, "/admin/siparisler/ord-0042". */
  path: string;
}

/** The order columns the route reads. */
export interface PanelOrderSourceRow {
  id: string;
  orderNo: number;
  status: string;
  kind?: string;
  source?: string;
  fulfillment?: string;
  tableCode?: string;
  tableName?: string;
  customerName?: string;
  scheduledFor?: string;
  paidAt?: string;
  shippedAt?: string;
  totalMinor: number;
  items?: ReadonlyArray<{
    productName?: string;
    qty?: number;
    status?: string;
    menuItemId?: string;
    size?: string;
    detail?: string;
  }> | null;
}

/** The instant the route reads open orders from (ISO, `paidAt` sorts). */
export function panelOrdersSince(now: Date): string {
  return new Date(
    now.getTime() - PANEL_ORDERS_LOOKBACK_DAYS * 24 * 60 * 60_000,
  ).toISOString();
}

/**
 * The stale limits above as the read's lower bounds (ISO, which sorts as
 * text). An open order is read when its planned time or its payment is at
 * or after `dueSince`, a ready pickup when its readiness or its payment is
 * at or after `readySince`: a superset of `toPanelOrder`'s rule (an order is
 * planned after it is paid and ready after it is paid), which still
 * decides. In the query, so forgotten orders cannot fill the read's limit
 * and hide today's.
 */
export function panelOrdersLiveSince(now: Date): {
  dueSince: string;
  readySince: string;
} {
  return {
    dueSince: new Date(now.getTime() - PANEL_ORDER_STALE_MS).toISOString(),
    readySince: new Date(
      now.getTime() - PANEL_ORDER_READY_STALE_MS,
    ).toISOString(),
  };
}

/**
 * Whether the read brought every row: `listPanelOpenOrderRows` reads open
 * (`paid`, `preparing`) and ready (`shipped`) orders in two reads of `limit`
 * each, and one that came back full may have been cut. Counted on the raw
 * rows, before `toPanelOrder` drops any.
 */
export function panelOrderRowsComplete(
  rows: ReadonlyArray<{ status: string }>,
  limit: number,
): boolean {
  const ready = rows.filter((r) => r.status === "shipped").length;
  return ready < limit && rows.length - ready < limit;
}

function stageOf(row: PanelOrderSourceRow): PanelOrderStage | null {
  if (row.status === "paid") return "new";
  if (row.status === "preparing") return "preparing";
  if (row.status === "shipped" && orderFulfillment(row) === "pickup") {
    return "ready";
  }
  return null;
}

function timeOf(iso: string | undefined): number | null {
  const t = Date.parse(iso ?? "");
  return Number.isFinite(t) ? t : null;
}

/**
 * When the order is due: its planned time, else its payment. What the
 * screen sorts by and what makes an order forgotten.
 */
export function panelOrderDueAt(row: {
  scheduledFor?: string;
  paidAt?: string;
}): number | null {
  return timeOf(row.scheduledFor) ?? timeOf(row.paidAt);
}

const SIZES: readonly string[] = ["M", "L"];

function lineOf(
  item: NonNullable<PanelOrderSourceRow["items"]>[number],
): PanelOrderLine {
  return {
    menuItemId: String(item.menuItemId ?? ""),
    name: String(item.productName ?? "").trim() || "Ürün",
    size: SIZES.includes(String(item.size))
      ? (item.size as PanelOrderLineSize)
      : "single",
    detail: String(item.detail ?? "").trim(),
    qty: Math.max(1, Math.trunc(Number(item.qty) || 1)),
  };
}

/**
 * The panel's view of one order, or null when it is not one for the bar
 * screen: not a café order, typed into this panel, not in an open stage
 * (a table or courier order that left the counter is done for the bar), or
 * forgotten (see the stale limits above).
 */
export function toPanelOrder(
  row: PanelOrderSourceRow,
  now: Date,
): PanelOrder | null {
  if (orderKind(row) !== "cafe") return null;
  if (row.source === "manual") return null;
  const fulfillment = orderFulfillment(row);
  if (fulfillment === "shipping") return null;
  const stage = stageOf(row);
  if (!stage) return null;
  const paidAt = timeOf(row.paidAt);
  if (paidAt === null) return null;
  const nowMs = now.getTime();
  if (stage === "ready") {
    const readyAt = timeOf(row.shippedAt) ?? paidAt;
    if (nowMs - readyAt > PANEL_ORDER_READY_STALE_MS) return null;
  } else {
    const due = panelOrderDueAt(row) ?? paidAt;
    if (nowMs - due > PANEL_ORDER_STALE_MS) return null;
  }
  const lines = (row.items ?? [])
    .filter((item) => item.status !== "cancelled")
    .map(lineOf);
  if (lines.length === 0) return null;
  return {
    id: row.id,
    orderNo: row.orderNo,
    stage,
    fulfillment,
    label: orderAlertLabel({ ...row, items: undefined }),
    firstName: firstNameOf(row.customerName),
    scheduledFor:
      timeOf(row.scheduledFor) === null ? "" : String(row.scheduledFor),
    paidAt: String(row.paidAt),
    lines,
    totalMinor: Math.max(0, Math.round(Number(row.totalMinor) || 0)),
    path: `/admin/siparisler/${encodeURIComponent(row.id)}`,
  };
}

/** The screen's order: the soonest due first, then by order number. */
export function sortForPanelOrders(orders: PanelOrder[]): PanelOrder[] {
  const due = (o: PanelOrder) => panelOrderDueAt(o) ?? 0;
  return [...orders].sort((a, b) => due(a) - due(b) || a.orderNo - b.orderNo);
}
