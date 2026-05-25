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

export interface PaymentProvider {
  readonly name: string;
  createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession>;
  verifyWebhook(req: Request): Promise<WebhookEvent>;
  refund(providerRef: string, amountMinor?: number): Promise<RefundResult>;
}
