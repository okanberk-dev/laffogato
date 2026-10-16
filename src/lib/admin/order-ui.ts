// Client-safe (no server-only): how the panel names and colours an order's
// status. One map instead of the four copies the list, the detail page, the
// customer page and the dashboard used to carry - which disagreed ("İptal" vs
// "İptal edildi") and called every shipped order "Kargoda".

import { orderFulfillment, shippedStatusLabel } from "./order-channel";
import type { AdminOrderStatus } from "./store";
import type { AdminTone } from "./tone";

/** Every status, in the order the machine moves through them. */
export const ORDER_STATUSES: readonly AdminOrderStatus[] = [
  "pending_payment",
  "paid",
  "preparing",
  "shipped",
  "completed",
  "cancelled",
  "refunded",
];

/**
 * The status on its own, for places with no single order in hand: tabs,
 * filters, the bulk dropdown. `shipped` names both meanings here; with an
 * order in hand use `orderStatusLabel(order)`, which says which one it is.
 */
export const ORDER_STATUS_LABELS: Record<AdminOrderStatus, string> = {
  pending_payment: "Ödeme bekleniyor",
  paid: "Ödendi",
  preparing: "Hazırlanıyor",
  shipped: "Kargoda / Hazır",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
  refunded: "İade edildi",
};

/** The badge tone of each status (Badge `tone`). */
export const ORDER_STATUS_TONES: Record<AdminOrderStatus, AdminTone> = {
  pending_payment: "warning",
  paid: "info",
  preparing: "accent",
  shipped: "primary",
  completed: "success",
  cancelled: "neutral",
  refunded: "danger",
};

/** True for a string the order machine knows (e.g. a `?durum=` value). */
export function isOrderStatus(value: unknown): value is AdminOrderStatus {
  return (
    typeof value === "string" &&
    (ORDER_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * The status of THIS order, in its own words: a shipped pickup order is
 * "Hazır", a courier order "Kuryede", a table order "Masada" and only a shop
 * parcel "Kargoda" (`shippedStatusLabel`).
 */
export function orderStatusLabel(order: {
  status: AdminOrderStatus;
  fulfillment?: string;
}): string {
  if (order.status === "shipped") {
    return shippedStatusLabel(orderFulfillment(order));
  }
  return ORDER_STATUS_LABELS[order.status] ?? order.status;
}

/** The badge tone of this order's status; `neutral` for an unknown one. */
export function orderStatusTone(order: {
  status: AdminOrderStatus;
}): AdminTone {
  return ORDER_STATUS_TONES[order.status] ?? "neutral";
}
