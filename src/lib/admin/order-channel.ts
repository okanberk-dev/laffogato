// Client-safe order channel vocabulary (no server-only). Imported by the
// orders list (a client component) and re-exported from the store for server
// callers, so both read the same defaults for rows written before the columns
// existed. Contract: docs/API-MOBILE.md §3.

/** Where the order came from. Absent on rows written before the app: "web". */
export type OrderChannel = "web" | "app";
/** What the order is: shop goods shipped by courier, or cafe drinks/food. */
export type OrderKind = "shop" | "cafe";
/** How the order reaches the customer. Absent on older rows: "shipping". */
export type OrderFulfillment = "shipping" | "pickup" | "delivery";

export const ORDER_CHANNEL_LABELS: Record<OrderChannel, string> = {
  web: "Web",
  app: "Uygulama",
};

export const ORDER_KIND_LABELS: Record<OrderKind, string> = {
  shop: "Mağaza",
  cafe: "Kafe",
};

export const ORDER_FULFILLMENT_LABELS: Record<OrderFulfillment, string> = {
  shipping: "Kargo",
  pickup: "Gel-al",
  delivery: "Kurye",
};

/** Channel of an order, defaulting rows written before the column existed. */
export function orderChannel(order: { channel?: string }): OrderChannel {
  return order.channel === "app" ? "app" : "web";
}

/** Kind of an order, defaulting rows written before the column existed. */
export function orderKind(order: { kind?: string }): OrderKind {
  return order.kind === "cafe" ? "cafe" : "shop";
}

/** Fulfillment of an order, defaulting rows written before the column existed. */
export function orderFulfillment(order: {
  fulfillment?: string;
}): OrderFulfillment {
  return order.fulfillment === "pickup" || order.fulfillment === "delivery"
    ? order.fulfillment
    : "shipping";
}
