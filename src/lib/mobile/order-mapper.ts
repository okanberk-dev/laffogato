// Pure wire mapper for `Order` (docs/API-MOBILE.md §3). NO "server-only", NO
// database - unit-tested directly. An explicit allow-list: an `orders` row
// carries the internal note, the consent evidence and the refund ledger, none
// of which belong on a phone.

import {
  orderChannel,
  orderFulfillment,
  orderKind,
  orderTable,
  type OrderChannel,
  type OrderFulfillment,
  type OrderKind,
} from "@/lib/admin/order-channel";
import type {
  AdminOrder,
  AdminOrderItem,
  AdminOrderStatus,
  OrderItemSize,
} from "@/lib/admin/store";

export const ORDER_STATUS_LABELS: Record<AdminOrderStatus, string> = {
  pending_payment: "Ödeme bekleniyor",
  paid: "Sipariş alındı",
  preparing: "Hazırlanıyor",
  shipped: "Yolda",
  completed: "Teslim edildi",
  cancelled: "İptal edildi",
  refunded: "İade edildi",
};

export interface MobileTimelineStep {
  key: string;
  label: string;
  at: string | null;
  done: boolean;
}

export interface MobileOrderItem {
  name: string;
  detail: string;
  qty: number;
  unitPriceMinor: number;
  menuItemId: string | null;
  productId: string | null;
  variantId: string | null;
  size: OrderItemSize | null;
  options: Record<string, unknown> | null;
}

export interface MobileOrder {
  id: string;
  orderNo: number;
  status: AdminOrderStatus;
  statusLabel: string;
  timeline: MobileTimelineStep[];
  channel: OrderChannel;
  kind: OrderKind;
  fulfillment: OrderFulfillment;
  items: MobileOrderItem[];
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  promoCode: string;
  address: string;
  scheduledFor: string | null;
  etaMinutes: number | null;
  etaAt: string | null;
  stampsEarned: number;
  createdAt: string;
  paidAt: string | null;
  /** Kargo - only for `fulfillment: "shipping"`, only after hand-over. §3.1. */
  shipment: MobileShipment | null;
  /**
   * The table a `fulfillment: "table"` order was placed at, as it was named
   * then (15 Eki 2026, yalnız ekleme); null on every other order.
   */
  table: { code: string; name: string } | null;
}

/**
 * The carrier's milestones (docs/API-MOBILE.md §3.1).
 *
 * The app retired its live-tracking map: the köşk runs no couriers whose
 * phones it can read, it buys carriage from cargo firms through Geliver, and
 * a carrier publishes milestones rather than a position. These six values are
 * what the phone draws as "Yola çıktı → Yolda → Teslim edildi".
 */
export type MobileShipmentStatus =
  | "preparing"
  | "shipped"
  | "in_transit"
  | "delivered"
  | "returned"
  | "failed";

export interface MobileShipment {
  status: MobileShipmentStatus;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  updatedAt: string | null;
}

const SHIPMENT_STATUSES: readonly string[] = [
  "preparing",
  "shipped",
  "in_transit",
  "delivered",
  "returned",
  "failed",
];

/**
 * Where the parcel is, from the best signal the row carries.
 *
 * `shipmentStatus` is what the Geliver webhook writes and it wins whenever it
 * is set. Until that account exists the column is empty on every row, so the
 * panel's own shipping form is the only signal there is: the shop owner types
 * a carrier and a tracking number, and `transitionOrder` moves the order to
 * `shipped` and later `completed`. That is three of the six values, honestly
 * derived, rather than a band that stays blank until an integration lands.
 *
 * `null` means nothing has left the köşk, and then there is no `shipment` at
 * all - which is different from a shipment whose status is unknown.
 */
function shipmentStatusFor(order: AdminOrder): MobileShipmentStatus | null {
  const published = String(order.shipmentStatus ?? "").trim();
  if (SHIPMENT_STATUSES.includes(published)) {
    return published as MobileShipmentStatus;
  }
  if (order.status === "completed") return "delivered";
  if (order.status === "shipped") return "shipped";
  // A tracking number without the status move still means it was handed over.
  if (String(order.trackingNumber ?? "").trim()) return "shipped";
  return null;
}

/**
 * `null` for everything that is not a cargo parcel already on its way.
 *
 * The app treats an absent field as "not shipped" rather than an error, so a
 * cafe order, a pickup, and a parcel still on the bench all read the same and
 * none of them draws the band.
 */
export function toMobileShipment(order: AdminOrder): MobileShipment | null {
  if (orderFulfillment(order) !== "shipping") return null;
  const status = shipmentStatusFor(order);
  if (!status) return null;
  const url = String(order.trackingUrl ?? "").trim();
  return {
    status,
    carrier: String(order.carrier ?? "").trim() || null,
    trackingNumber: String(order.trackingNumber ?? "").trim() || null,
    // Whole or not at all, and https only - the phone opens this in the
    // system browser. The app drops anything else again on its side.
    trackingUrl: url.startsWith("https://") ? url : null,
    updatedAt:
      String(order.shipmentUpdatedAt ?? "").trim() ||
      String(order.shippedAt ?? "").trim() ||
      null,
  };
}

/** How far along the four-step timeline each status is. */
const STAGE: Record<AdminOrderStatus, number> = {
  pending_payment: 1,
  paid: 1,
  preparing: 2,
  shipped: 3,
  completed: 4,
  cancelled: 0,
  refunded: 0,
};

interface StepSpec {
  key: string;
  label: string;
}

/**
 * The third and fourth step read differently per fulfillment: a courier is
 * "on the way" and then "at the door", a pickup is "ready" and then
 * "collected", a parcel is "with the carrier" and then "delivered".
 */
function stepsFor(fulfillment: OrderFulfillment): StepSpec[] {
  const head: StepSpec[] = [
    { key: "received", label: "Sipariş alındı" },
    { key: "preparing", label: "Hazırlanıyor" },
  ];
  switch (fulfillment) {
    case "pickup":
      return [
        ...head,
        { key: "ready", label: "Hazır - gel al" },
        { key: "picked_up", label: "Teslim alındı" },
      ];
    case "delivery":
      return [
        ...head,
        { key: "on_the_way", label: "Kuryede" },
        { key: "delivered", label: "Kapında" },
      ];
    case "table":
      return [
        ...head,
        { key: "served", label: "Masana getirildi" },
        { key: "completed", label: "Tamamlandı" },
      ];
    default:
      return [
        ...head,
        { key: "shipped", label: "Kargoda" },
        { key: "delivered", label: "Teslim edildi" },
      ];
  }
}

/**
 * The instant each step was reached, in the order `stepsFor` lists them:
 * alındı · hazırlanıyor · kargoda|hazır|kuryede · teslim edildi.
 *
 * The last three are the per-stage columns `transitionOrder` stamps. An order
 * that finished before those columns existed has "" in them, so each falls
 * back to the closest earlier instant it does have - never a later one, which
 * would date a step before it happened.
 */
function stepInstant(index: number, order: AdminOrder): string | null {
  switch (index) {
    case 0:
      return order.createdAt || null;
    case 1:
      return order.preparingAt || order.paidAt || null;
    case 2:
      return order.shippedAt || null;
    case 3:
      return order.completedAt || null;
    default:
      return null;
  }
}

export function buildTimeline(order: AdminOrder): MobileTimelineStep[] {
  const stage = STAGE[order.status] ?? 0;
  return stepsFor(orderFulfillment(order)).map((spec, i) => {
    const done = i < stage;
    return {
      key: spec.key,
      label: spec.label,
      at: done ? stepInstant(i, order) : null,
      done,
    };
  });
}

/**
 * Minutes until the order is in the customer's hands. Only the live statuses
 * of a cafe order carry one; a parcel's carrier gives its own estimate and a
 * finished or cancelled order has nothing left to wait for.
 *
 * A scheduled order counts down to the time the member picked, not to the
 * "15 dk" an as-soon-as-possible basket gets: a pickup booked for tomorrow
 * 09:00 used to say "Hazır - 15 dk" the evening before, with a countdown that
 * hit zero while the house was closed. Once the requested time has passed the
 * ordinary preparation estimate takes over again.
 */
export function etaMinutesFor(
  order: AdminOrder,
  now: Date = new Date(),
): number | null {
  const fulfillment = orderFulfillment(order);
  if (fulfillment === "shipping") return null;
  const live =
    order.status === "paid" ||
    order.status === "preparing" ||
    order.status === "shipped";
  if (!live) return null;
  const scheduled = order.scheduledFor ? Date.parse(order.scheduledFor) : NaN;
  if (Number.isFinite(scheduled) && scheduled > now.getTime()) {
    return Math.max(0, Math.round((scheduled - now.getTime()) / 60_000));
  }
  switch (order.status) {
    case "paid":
    case "preparing":
      return fulfillment === "delivery" ? 35 : 15;
    default:
      return fulfillment === "delivery" ? 10 : 0;
  }
}

function toMobileItem(it: AdminOrderItem): MobileOrderItem {
  return {
    name: it.productName,
    detail: it.detail ?? "",
    qty: it.qty,
    unitPriceMinor: it.unitPriceMinor,
    menuItemId: it.menuItemId ?? null,
    productId: it.productId ?? null,
    variantId: it.variantId ?? null,
    size: it.size ?? null,
    options: it.options ?? null,
  };
}

/**
 * The status as the app shows it. A live status reads as its timeline step,
 * so a pickup that is `shipped` says "Hazır - gel al" rather than "Yolda".
 */
export function statusLabelFor(order: AdminOrder): string {
  const stage = STAGE[order.status] ?? 0;
  if (stage >= 2) {
    const step = stepsFor(orderFulfillment(order))[stage - 1];
    if (step) return step.label;
  }
  return ORDER_STATUS_LABELS[order.status] ?? order.status;
}

/** No ledger in hand: nothing is claimed. */
const EMPTY_STAMPED: ReadonlyMap<string, number> = new Map();

/**
 * What the ledger says about the member's orders: how many stamps each one
 * holds (`stampsByOrder`), or - the older shape - the set of orders holding
 * one stamp (`stampedOrderIds`).
 */
export type OrderStampLedger =
  | ReadonlyMap<string, number>
  | ReadonlySet<string>;

/**
 * The stamps this order really holds, read from the loyalty ledger - the
 * delta of its live `earn` row, so ₺700 of goods says 3 (one per started
 * ₺320 from ₺140; operator, 15 Eki 2026).
 *
 * It used to be inferred from the status - a paid app cafe order "must have"
 * earned one. `onOrderPaid` is best-effort, though: when its insert failed
 * (or the order was later refunded and a `reversal` row written), the app
 * still printed "+1 damga" for a stamp the card never got. `stampsByOrder`
 * maps the orders with a live `earn` row to their stamps, so this answers
 * from what happened rather than from what should have.
 *
 * An empty map is the honest default: no ledger in hand means no stamp is
 * claimed. Eligibility itself stays where it is enforced - `onOrderPaid` in
 * `./loyalty.ts` writes the row for an app cafe order and nothing else.
 */
export function stampsEarnedFor(
  order: AdminOrder,
  stamped: OrderStampLedger,
): number {
  if ("get" in stamped) {
    const n = stamped.get(order.id) ?? 0;
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  }
  return stamped.has(order.id) ? 1 : 0;
}

export function toMobileOrder(
  order: AdminOrder,
  now: Date = new Date(),
  stampedOrderIds: OrderStampLedger = EMPTY_STAMPED,
): MobileOrder {
  const etaMinutes = etaMinutesFor(order, now);
  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    statusLabel: statusLabelFor(order),
    timeline: buildTimeline(order),
    channel: orderChannel(order),
    kind: orderKind(order),
    fulfillment: orderFulfillment(order),
    items: (order.items ?? []).map(toMobileItem),
    subtotalMinor: order.subtotalMinor,
    discountMinor: order.discountMinor,
    shippingMinor: order.shippingMinor,
    totalMinor: order.totalMinor,
    promoCode: order.promoCode ?? "",
    address: order.shippingAddress ?? "",
    scheduledFor: order.scheduledFor || null,
    etaMinutes,
    etaAt:
      etaMinutes === null
        ? null
        : new Date(now.getTime() + etaMinutes * 60_000).toISOString(),
    stampsEarned: stampsEarnedFor(order, stampedOrderIds),
    createdAt: order.createdAt,
    paidAt: order.paidAt || null,
    shipment: toMobileShipment(order),
    table: orderTable(order),
  };
}
