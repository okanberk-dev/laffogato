import type { AdminOrderStatus } from "@/lib/admin/store";
import { orderFulfillment, orderKind } from "@/lib/admin/order-channel";
import { stageBody } from "@/lib/mobile/order-stage-text";

/**
 * Phone notifications for an order's stages (docs/API-MOBILE.md §23).
 *
 * Pure: which move earns a notification, what it says, and the Expo Push
 * API message it becomes. The sender (order-push.ts) reads the member's
 * devices and switch; nothing here touches the database.
 *
 * Which moves, and why only these:
 * - a café order starts being made ("Hazırlanıyor");
 * - a pickup order is ready at the counter: the one the member is waiting
 *   for ("Siparişin hazır");
 * - a courier order leaves with the köşk's courier ("Yolda");
 * - a shop parcel is handed to the carrier ("Kargoda");
 * - a paid order is cancelled.
 * A table order carried to the table is not told: the member is sitting
 * there. "Ödemen alındı" is not either: the member is looking at the
 * payment screen when it happens. Orders typed in at the till
 * (`source: manual`) are told nothing: their customer is at the counter.
 *
 * Transactional only. Nothing here is, or may become, a commercial message:
 * that would need its own consent and İYS (6563), and the app's legal texts
 * say marketing push is not done (açık rıza metni R8).
 */

export type OrderPushKind =
  | "preparing"
  | "ready"
  | "on_the_way"
  | "shipped"
  | "cancelled";

export interface OrderPush {
  kind: OrderPushKind;
  title: string;
  body: string;
  /** The app route a tap opens: the order's tracking screen. */
  url: string;
  /** How long the push service may hold it for an offline phone. */
  ttlSeconds: number;
}

export interface OrderPushSource {
  id: string;
  orderNo: number;
  kind?: string;
  fulfillment?: string;
  source?: string;
}

const HOUR = 60 * 60;

/**
 * A stale "hazır" delivered the next morning is worse than none, so the
 * café's moves expire within the hour or two they mean anything; a parcel
 * or a cancellation is news for a day.
 */
const TTL: Record<OrderPushKind, number> = {
  preparing: HOUR,
  ready: 2 * HOUR,
  on_the_way: 2 * HOUR,
  shipped: 24 * HOUR,
  cancelled: 24 * HOUR,
};

/** The app's order screen for a tap; the app accepts only this shape. */
export function orderPushUrl(orderId: string): string {
  return `/siparis/${encodeURIComponent(orderId)}/takip`;
}

/**
 * The notification a status move earns, or null. `from` is the status the
 * order left; a cancelled order that was never paid (the 45-minute sweep,
 * an abandoned card form) has nothing to tell.
 */
export function orderPushFor(
  order: OrderPushSource,
  from: AdminOrderStatus,
  to: AdminOrderStatus,
): OrderPush | null {
  if (order.source === "manual") return null;
  if (from === to) return null;
  const kind = orderKind(order);
  const fulfillment = orderFulfillment(order);
  const no = order.orderNo;
  const make = (
    pushKind: OrderPushKind,
    title: string,
    body: string,
  ): OrderPush => ({
    kind: pushKind,
    title,
    body,
    url: orderPushUrl(order.id),
    ttlSeconds: TTL[pushKind],
  });

  if (to === "preparing") {
    if (kind !== "cafe") return null;
    return make(
      "preparing",
      "Siparişin hazırlanıyor",
      stageBody("preparing", no, fulfillment),
    );
  }
  if (to === "shipped") {
    if (kind === "cafe") {
      if (fulfillment === "pickup") {
        return make(
          "ready",
          "Siparişin hazır",
          stageBody("shipped", no, fulfillment),
        );
      }
      if (fulfillment === "delivery") {
        return make(
          "on_the_way",
          "Siparişin yolda",
          stageBody("shipped", no, fulfillment),
        );
      }
      return null;
    }
    if (fulfillment === "shipping") {
      return make(
        "shipped",
        "Siparişin kargoda",
        stageBody("shipped", no, fulfillment),
      );
    }
    return null;
  }
  if (to === "cancelled") {
    if (from === "pending_payment") return null;
    return make(
      "cancelled",
      "Siparişin iptal edildi",
      `#${no} numaralı siparişin iptal edildi. Ayrıntılar sipariş sayfasında.`,
    );
  }
  return null;
}

/**
 * An Expo push token as the app's `getExpoPushTokenAsync` returns it:
 * `ExponentPushToken[...]` (or the newer `ExpoPushToken[...]`). Anything
 * else is refused at the door: the token is sent on to Expo verbatim.
 */
const EXPO_TOKEN = /^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$/;

export const PUSH_TOKEN_MAX_LENGTH = 220;

export function isExpoPushToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= PUSH_TOKEN_MAX_LENGTH &&
    EXPO_TOKEN.test(value)
  );
}

export type DevicePlatform = "ios" | "android" | "";

/**
 * The platform from the request, not from the body (lafmobil
 * docs/INFRA.md §7): React Native's networking says CFNetwork / Darwin on
 * iOS and okhttp on Android. Unknown stays "", which changes nothing about
 * delivery: the token alone routes the message.
 */
export function platformFromUserAgent(ua: string | null): DevicePlatform {
  const s = ua ?? "";
  if (/CFNetwork|Darwin|iPhone|iPad|iOS/i.test(s)) return "ios";
  if (/okhttp|Android/i.test(s)) return "android";
  return "";
}

/** How many devices one member may have registered; the oldest go first. */
export const MAX_DEVICES_PER_MEMBER = 10;

/** One message per token, as the Expo Push API takes it (≤ 100 per call). */
export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: { type: "order"; orderId: string; url: string; kind: OrderPushKind };
  sound: "default";
  priority: "high";
  channelId: "orders";
  ttl: number;
  collapseId: string;
  tag: string;
}

export function expoMessagesFor(
  tokens: readonly string[],
  orderId: string,
  push: OrderPush,
): ExpoPushMessage[] {
  // One slot per order: "hazır" replaces "hazırlanıyor" on the lock screen
  // instead of stacking under it.
  const slot = `order-${orderId}`;
  return tokens.map((to) => ({
    to,
    title: push.title,
    body: push.body,
    data: { type: "order", orderId, url: push.url, kind: push.kind },
    sound: "default",
    priority: "high",
    channelId: "orders",
    ttl: push.ttlSeconds,
    collapseId: slot,
    tag: slot,
  }));
}

/** A push ticket as Expo answers it, in the order the messages were sent. */
export interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface TicketSummary {
  /** Tokens Expo accepted, with the ticket id to read the receipt by. */
  accepted: { token: string; id: string }[];
  /** Tokens Expo says no longer reach a device: forget them. */
  gone: string[];
  /** Other refusals, for the log (no token in them). */
  errors: string[];
}

export function summariseTickets(
  tokens: readonly string[],
  tickets: readonly ExpoTicket[],
): TicketSummary {
  const out: TicketSummary = { accepted: [], gone: [], errors: [] };
  tokens.forEach((token, i) => {
    const t = tickets[i];
    if (!t) {
      out.errors.push("no ticket");
      return;
    }
    if (t.status === "ok" && typeof t.id === "string" && t.id) {
      out.accepted.push({ token, id: t.id });
      return;
    }
    if (t.details?.error === "DeviceNotRegistered") {
      out.gone.push(token);
      return;
    }
    out.errors.push(t.details?.error || t.message || "error");
  });
  return out;
}

/**
 * Should the pickup "siparişin hazır" go out by e-mail as well? Only when
 * no phone notification was accepted for any of the member's devices: the
 * app polls, but a member who did not allow notifications (or whose app is
 * older than push) would otherwise hear nothing while waiting.
 */
export function readyMailDue(
  push: OrderPush | null,
  acceptedPushes: number,
): boolean {
  return push?.kind === "ready" && acceptedPushes === 0;
}

/** Masks a token for logs: the prefix and the last four characters. */
export function maskPushToken(token: string): string {
  const inner = token.replace(/^Expo(?:nent)?PushToken\[|\]$/g, "");
  return `…${inner.slice(-4)}`;
}
