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

/** Statuses on which a stamp has been (or will be) earned. */
const STAMPED: readonly AdminOrderStatus[] = [
  "paid",
  "preparing",
  "shipped",
  "completed",
];

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
 * The best timestamp each step has. The store records when an order was
 * created, paid and shipped; "preparing" and "completed" have no instant of
 * their own, so a done step without one reads `at: null`.
 */
function stepInstant(index: number, order: AdminOrder): string | null {
  switch (index) {
    case 0:
      return order.createdAt || null;
    case 1:
      return order.paidAt || null;
    case 2:
      return order.shippedAt || null;
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
 */
export function etaMinutesFor(order: AdminOrder): number | null {
  const fulfillment = orderFulfillment(order);
  if (fulfillment === "shipping") return null;
  switch (order.status) {
    case "paid":
    case "preparing":
      return fulfillment === "delivery" ? 35 : 15;
    case "shipped":
      return fulfillment === "delivery" ? 10 : 0;
    default:
      return null;
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

export function stampsEarnedFor(order: AdminOrder): number {
  return orderKind(order) === "cafe" &&
    orderChannel(order) === "app" &&
    STAMPED.includes(order.status)
    ? 1
    : 0;
}

export function toMobileOrder(
  order: AdminOrder,
  now: Date = new Date(),
): MobileOrder {
  const etaMinutes = etaMinutesFor(order);
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
    stampsEarned: stampsEarnedFor(order),
    createdAt: order.createdAt,
    paidAt: order.paidAt || null,
  };
}
