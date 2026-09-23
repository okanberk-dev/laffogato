// Deep links back into the mobile app (docs/API-MOBILE.md §3). Pure; shared
// by the payment return handler and the failure page.

export const APP_SCHEME = "laffogato://";

export type PaymentReturnStatus = "success" | "failed";

/** Only the store's own id shape rides into a URL the phone will open. */
const ORDER_ID_RE = /^[a-z0-9-]{1,40}$/i;

export function isSafeOrderId(orderId: string): boolean {
  return ORDER_ID_RE.test(orderId);
}

/** `laffogato://siparis/ord-0284?status=success` - the app's order screen. */
export function appOrderDeepLink(
  orderId: string,
  status: PaymentReturnStatus,
): string {
  if (!isSafeOrderId(orderId)) return APP_SCHEME;
  return `${APP_SCHEME}siparis/${encodeURIComponent(orderId)}?status=${status}`;
}
