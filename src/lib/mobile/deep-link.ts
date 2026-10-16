// Deep links back into the mobile app (docs/API-MOBILE.md §3, §7). Pure;
// shared by the payment return handler, the payment page and the failure page.

import { isKaraokeRef } from "./karaoke-ref";

export const APP_SCHEME = "laffogato://";

export type PaymentReturnStatus = "success" | "failed";

/** Only the store's own id shape rides into a URL the phone will open. */
const ORDER_ID_RE = /^[a-z0-9-]{1,40}$/i;

export function isSafeOrderId(orderId: string): boolean {
  return ORDER_ID_RE.test(orderId);
}

/**
 * `laffogato://siparis/ord-0284?status=success` - the app's order screen.
 *
 * Never for a karaoke booking: `krk-00042` passes the id shape, and the app
 * would open its order screen on something that is not an order. The callers
 * branch on `isKaraokeRef` first; this refuses it as well.
 */
export function appOrderDeepLink(
  orderId: string,
  status: PaymentReturnStatus,
): string {
  if (!isSafeOrderId(orderId) || isKaraokeRef(orderId)) return APP_SCHEME;
  return `${APP_SCHEME}siparis/${encodeURIComponent(orderId)}?status=${status}`;
}

/**
 * `laffogato://karaoke?status=success&ref=krk-00042` - the app's karaoke
 * screen, after a booking's payment page (§7). The screen is one route with no
 * id in its path on purpose (`PAYMENT_RETURN` in the app's +native-intent.tsx
 * matches `karaoke` exactly), and `status` is only a hint: the app reads the
 * booking back with `GET /karaoke/reservations` before it says "paid".
 */
export function appKaraokeDeepLink(
  ref: string,
  status: PaymentReturnStatus,
): string {
  if (!isKaraokeRef(ref)) return `${APP_SCHEME}karaoke`;
  return `${APP_SCHEME}karaoke?status=${status}&ref=${encodeURIComponent(ref)}`;
}
