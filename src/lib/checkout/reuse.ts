import type { AdminOrder } from "@/lib/admin/store";
import { orderChannel } from "@/lib/admin/order-channel";
import { paynkolayAmountToMinor } from "@/lib/payment/paynkolay";

import { checkoutCartKey, type CartKeyInput } from "./cart-key";

/**
 * May this checkout attempt pay for the order an earlier attempt created?
 *
 * The card is typed on /odeme and the first press of "Siparişi onayla ve öde"
 * creates the order (stock and coupon claimed). A
 * declined card or a failed 3D step brings the customer back to /odeme; a
 * second press used to create a second order and a second claim, and gave the card-testing budget per order (`card-payment-order`)
 * a fresh five tries every time. So the browser offers back what it was
 * given - the order id and that order's signed payment payload, with the key
 * of the basket it was created for - and the order is reused only when ALL
 * of these hold. Anything else creates a new order, which supersedes the old
 * one as before (`supersedeUnpaidWebOrders`).
 *
 * Pure: the action reads the payload, the order and the clock, this decides.
 * Each refusal has its own reason so `tests/checkout-reuse.test.ts` can prove
 * every branch.
 */

export type ReuseRefusal =
  /** The browser offered nothing to reuse. */
  | "no_claim"
  /** The payload's signature or seal does not verify (`readBridgePost`). */
  | "bad_payload"
  /** The payload would expire before the card reaches the POS. */
  | "stale_payload"
  /** The payload belongs to another order than the one offered. */
  | "other_order"
  | "no_order"
  /** Not the signed-in member's order. */
  | "not_owner"
  /** Paid, cancelled, refunded - no longer waiting for this payment. */
  | "not_pending"
  /** An app order: it is paid from the app, never from the web checkout. */
  | "not_web"
  /** The order's total is not the amount the payload would charge. */
  | "amount_changed"
  /** The basket, the address, the recipient or the code changed. */
  | "cart_changed";

export type ReuseDecision =
  { reuse: true } | { reuse: false; reason: ReuseRefusal };

export interface ReuseClaim {
  orderId: string;
  /** The key the browser stored with its pending order. */
  cartKey: string;
}

/** The parts of a verified payment payload the decision reads. */
export interface ReusePayload {
  clientRefCode: string;
  amount: string;
}

export type ReuseOrder = Pick<
  AdminOrder,
  | "id"
  | "customerEmail"
  | "customerName"
  | "customerPhone"
  | "shippingAddress"
  | "status"
  | "items"
  | "totalMinor"
  | "promoCode"
  | "channel"
>;

function tidy(text: string | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function lineKey(productId: string, variantId: string | undefined): string {
  return `${productId}::${variantId ?? ""}`;
}

/**
 * Whether the order row says what is being submitted now. The order is the
 * truth - it is what gets shipped and charged - so this is checked against
 * the row, not against anything the browser kept. A line without a product
 * id (a legacy cart matched by name) never matches: guessing is not reuse.
 */
export function orderMatchesSubmission(
  order: ReuseOrder,
  submitted: CartKeyInput,
): boolean {
  const want = new Map<string, number>();
  for (const it of submitted.items) {
    if (!it.productId) return false;
    const key = lineKey(it.productId, it.variantId);
    want.set(key, (want.get(key) ?? 0) + it.qty);
  }
  const have = new Map<string, number>();
  for (const it of order.items) {
    if (!it.productId) return false;
    const key = lineKey(it.productId, it.variantId);
    have.set(key, (have.get(key) ?? 0) + it.qty);
  }
  if (want.size === 0 || want.size !== have.size) return false;
  for (const [key, qty] of want) {
    if (have.get(key) !== qty) return false;
  }
  return (
    tidy(order.shippingAddress) === tidy(submitted.shippingAddress) &&
    tidy(order.customerName) === tidy(submitted.customerName) &&
    tidy(order.customerPhone) === tidy(submitted.customerPhone) &&
    tidy(order.promoCode).toUpperCase() ===
      tidy(submitted.promoCode).toUpperCase()
  );
}

export function reuseDecision(input: {
  claim: ReuseClaim | null;
  /** `null` when `readBridgePost` refused the payload. */
  payload: ReusePayload | null;
  /** The payload is still fresh for long enough to reach the POS. */
  fresh: boolean;
  order: ReuseOrder | null;
  customerEmail: string;
  submitted: CartKeyInput;
}): ReuseDecision {
  const { claim, payload, order } = input;
  if (!claim) return { reuse: false, reason: "no_claim" };
  if (!payload) return { reuse: false, reason: "bad_payload" };
  if (!input.fresh) return { reuse: false, reason: "stale_payload" };
  if (payload.clientRefCode !== claim.orderId) {
    return { reuse: false, reason: "other_order" };
  }
  if (!order || order.id !== claim.orderId) {
    return { reuse: false, reason: "no_order" };
  }
  if (
    tidy(order.customerEmail).toLowerCase() !==
    tidy(input.customerEmail).toLowerCase()
  ) {
    return { reuse: false, reason: "not_owner" };
  }
  if (order.status !== "pending_payment") {
    return { reuse: false, reason: "not_pending" };
  }
  if (orderChannel(order) !== "web") {
    return { reuse: false, reason: "not_web" };
  }
  if (paynkolayAmountToMinor(payload.amount) !== order.totalMinor) {
    return { reuse: false, reason: "amount_changed" };
  }
  if (
    checkoutCartKey(input.submitted) !== claim.cartKey ||
    !orderMatchesSubmission(order, input.submitted)
  ) {
    return { reuse: false, reason: "cart_changed" };
  }
  return { reuse: true };
}

/**
 * How long a reused payload must still be fresh. The card is posted right
 * after the action answers, but the route checks the payload's age when the
 * card ARRIVES (30 minutes, `DIRECT_FORM_MAX_AGE_MS`); five minutes of
 * headroom keeps a slow phone from turning a reuse into "süre doldu". It
 * also keeps the order's age below the 45-minute sweep that cancels unpaid
 * orders: the payload is minted when the order is, and is never re-minted
 * on reuse, so a reused order is at most 25 minutes old.
 */
export const REUSE_HEADROOM_MS = 5 * 60_000;
