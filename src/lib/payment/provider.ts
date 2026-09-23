export type Currency = "TRY";

export interface CheckoutCustomer {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
}

export interface CheckoutAddress {
  city: string;
  district: string;
  line1: string;
  line2?: string;
  postalCode?: string;
}

export interface CheckoutItem {
  productId: string;
  variantId?: string;
  name: string;
  unitPriceMinor: number;
  quantity: number;
}

export interface CheckoutInput {
  orderId: string;
  amountMinor: number;
  currency: Currency;
  customer: CheckoutCustomer;
  billingAddress: CheckoutAddress;
  shippingAddress: CheckoutAddress;
  items: CheckoutItem[];
  successUrl: string;
  failureUrl: string;
  /**
   * Buyer's IP as seen by the server. iyzico feeds it into fraud scoring and
   * rejects an obviously bogus value less often than a missing one; empty when
   * the request carries no forwarding header (local dev).
   */
  buyerIp?: string;
  /**
   * The provider's key for this member's stored cards, when we already have
   * one. Passing it makes the hosted form show the cards the member saved
   * last time; leaving it out gives a first-time form.
   *
   * It is a KEY, not a card. The PAN never reaches this codebase - it is
   * typed on the provider's own page - so "saved cards" costs us an opaque
   * string and no PCI surface at all.
   */
  cardUserKey?: string;
}

export interface CheckoutSession {
  providerRef: string;
  redirectUrl: string;
  expiresAt: string;
}

export type WebhookEventType =
  | "payment.succeeded"
  | "payment.failed"
  | "payment.refunded";

export interface WebhookEvent {
  type: WebhookEventType;
  orderId: string;
  providerRef: string;
  amountMinor: number;
  currency: Currency;
  raw: unknown;
  occurredAt: string;
}

export interface RefundResult {
  providerRef: string;
  amountMinor: number;
  status: "succeeded" | "pending" | "failed";
}

/**
 * What a provider tells us when the customer's browser comes back.
 *
 * The browser return carries only a reference; the truth is fetched from the
 * provider with it. That is the whole point - return parameters are under the
 * customer's control, a payment confirmation must never be.
 */
export interface ReturnConfirmation {
  status: "succeeded" | "failed";
  orderId: string;
  providerRef: string;
  amountMinor: number;
  currency: Currency;
  raw: unknown;
  /**
   * Present when the buyer chose to save their card. Persisting it is what
   * lets the NEXT checkout show that card - an opaque key, never a PAN.
   */
  cardUserKey?: string;
  /**
   * The provider's own calendar day for the transaction, `YYYY-MM-DD`, when
   * it reports one. Stored on the payment row (`payment_transactions.
   * "trxDate"`) so a later refund, which needs that date, does not have to
   * search the provider's history for it.
   */
  trxDate?: string;
}

/**
 * What the payment row already knows about the transaction being refunded.
 * A provider may use it to skip looking the transaction up; a hint that is
 * missing or unreadable must fall back to the lookup, never to a guess.
 */
export interface RefundHint {
  /** `payment_transactions."trxDate"`: `YYYY-MM-DD`, '' when unknown. */
  trxDate?: string;
  /** `payment_transactions."amountMinor"`: what the provider collected. */
  paidMinor?: number;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession>;
  verifyWebhook(req: Request): Promise<WebhookEvent>;
  refund(
    providerRef: string,
    amountMinor?: number,
    hint?: RefundHint,
  ): Promise<RefundResult>;
  /**
   * Resolves the browser return into a settled payment, by asking the provider
   * - never by trusting the returned parameters. Providers that settle only
   * through a webhook leave this undefined.
   */
  confirmReturn?(params: Record<string, string>): Promise<ReturnConfirmation>;
  /**
   * Asks the provider whether an order sent to it was paid, with no browser
   * return to go on. Called before an unpaid order is cancelled: the return
   * does not always arrive (a closed tab, a dropped connection, a phone that
   * locked on the bank's 3-D Secure page), and the money may have. Resolves
   * `null` when no successful payment exists; throws when the provider could
   * not be asked - the caller must not read that as "unpaid".
   */
  lookupPayment?(
    orderId: string,
    since: Date,
  ): Promise<ReturnConfirmation | null>;
}
