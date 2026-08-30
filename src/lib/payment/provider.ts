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
   * It is a KEY, not a card. The PAN never reaches this codebase — it is
   * typed on the provider's own page — so "saved cards" costs us an opaque
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
 * provider with it. That is the whole point — return parameters are under the
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
   * lets the NEXT checkout show that card — an opaque key, never a PAN.
   */
  cardUserKey?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession>;
  verifyWebhook(req: Request): Promise<WebhookEvent>;
  refund(providerRef: string, amountMinor?: number): Promise<RefundResult>;
  /**
   * Resolves the browser return into a settled payment, by asking the provider
   * — never by trusting the returned parameters. Providers that settle only
   * through a webhook leave this undefined.
   */
  confirmReturn?(params: Record<string, string>): Promise<ReturnConfirmation>;
}
