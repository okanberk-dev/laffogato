import "server-only";

import { createPanelPing } from "./ping";

/**
 * Tells the köşk's panel that an order changed, so the bar's screen shows a
 * paid app order (and rings) within seconds, and drops one the staff moved
 * on here (src/lib/panel/orders-feed-core.ts, docs/PANEL-ORDERS.md).
 *
 * Called from the data layer's write hook (src/lib/db/index.ts) for every
 * write that expires `live:orders`: an order placed, paid, moved on,
 * refunded or cancelled, a shop parcel too - the ping does not know which,
 * and a pull that finds nothing new costs the panel one small read. The
 * ping carries no order; the panel reads the open café orders itself,
 * signed. The ping's rules: src/lib/panel/ping.ts.
 */

const orders = createPanelPing({
  path: "/api/orders/ping",
  event: "orders.changed",
  logTag: "panel-orders",
});

export const pingPanelOrders = orders.ping;
export const sendPanelOrdersPing = orders.send;
