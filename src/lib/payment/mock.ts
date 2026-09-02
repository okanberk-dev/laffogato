import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";

import type {
  CheckoutInput,
  CheckoutSession,
  PaymentProvider,
  RefundResult,
  WebhookEvent,
} from "./provider";

/**
 * Geliştirme ortamında kullanılan sahte sağlayıcı. Gerçek sanal POS entegrasyonu
 * eklenene kadar `PAYMENT_PROVIDER=mock` ile aktif olur ve `?status=success|failed`
 * query param'ı ile sonucu zorlamaya olanak verir.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  private readonly webhookSecret: string;

  constructor(webhookSecret: string) {
    this.webhookSecret = webhookSecret;
  }

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession> {
    const providerRef = `mock_${randomUUID()}`;
    const url = new URL(input.successUrl);
    url.searchParams.set("orderId", input.orderId);
    url.searchParams.set("providerRef", providerRef);
    url.searchParams.set("status", "success");

    return {
      providerRef,
      redirectUrl: url.toString(),
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    };
  }

  async verifyWebhook(req: Request): Promise<WebhookEvent> {
    const signature = req.headers.get("x-signature");
    if (!signature) {
      throw new Error("missing_signature");
    }

    const rawBody = await req.text();
    const expected = createHmac("sha256", this.webhookSecret)
      .update(rawBody)
      .digest("hex");

    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new Error("invalid_signature");
    }

    const payload = JSON.parse(rawBody) as {
      type: WebhookEvent["type"];
      orderId: string;
      providerRef: string;
      amountMinor: number;
      currency: WebhookEvent["currency"];
      occurredAt?: string;
    };

    return {
      type: payload.type,
      orderId: payload.orderId,
      providerRef: payload.providerRef,
      amountMinor: payload.amountMinor,
      currency: payload.currency,
      raw: payload,
      occurredAt: payload.occurredAt ?? new Date().toISOString(),
    };
  }

  async refund(
    providerRef: string,
    amountMinor?: number,
  ): Promise<RefundResult> {
    return {
      providerRef,
      amountMinor: amountMinor ?? 0,
      status: "succeeded",
    };
  }
}
