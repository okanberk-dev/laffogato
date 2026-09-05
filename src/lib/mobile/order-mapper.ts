// Pure wire mapper for `Order` (docs/API-MOBILE.md §3). NO "server-only", NO
// database — unit-tested directly. An explicit allow-list: an `orders` row
// carries the internal note, the consent evidence and the refund ledger, none
// of which belong on a phone.

import {
  orderChannel,
  orderFulfillment,
  orderKind,
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
        { key: "ready", label: "Hazır — gel al" },
        { key: "picked_up", label: "Teslim alındı" },
      ];
    case "delivery":
      return [
        ...head,
        { key: "on_the_way", label: "Kuryede" },
        { key: "delivered", label: "Kapında" },
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
 * back to the closest earlier instant it does have — never a later one, which
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
 * 09:00 used to say "Hazır — 15 dk" the evening before, with a countdown that
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
 * so a pickup that is `shipped` says "Hazır — gel al" rather than "Yolda".
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
const EMPTY_STAMPED: ReadonlySet<string> = new Set();

/**
 * The stamp this order really holds, read from the loyalty ledger.
 *
 * It used to be inferred from the status — a paid app cafe order "must have"
 * earned one. `onOrderPaid` is best-effort, though: when its insert failed
 * (or the order was later refunded and a `reversal` row written), the app
 * still printed "+1 damga" for a stamp the card never got. `stampedOrderIds`
 * is the set of orders with a live `earn` row, so this answers from what
 * happened rather than from what should have.
 *
 * An empty set is the honest default: no ledger in hand means no stamp is
 * claimed. Eligibility itself stays where it is enforced — `onOrderPaid` in
 * `./loyalty.ts` writes the row for an app cafe order and nothing else.
 */
export function stampsEarnedFor(
  order: AdminOrder,
  stampedOrderIds: ReadonlySet<string>,
): number {
  return stampedOrderIds.has(order.id) ? 1 : 0;
}

export function toMobileOrder(
  order: AdminOrder,
  now: Date = new Date(),
  stampedOrderIds: ReadonlySet<string> = EMPTY_STAMPED,
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
  };
}
