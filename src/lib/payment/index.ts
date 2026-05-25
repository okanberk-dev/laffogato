import { MockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./provider";

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;

  const providerName = process.env.PAYMENT_PROVIDER ?? "mock";

  switch (providerName) {
    case "mock": {
      const secret = process.env.PAYMENT_WEBHOOK_SECRET;
      if (!secret) {
        throw new Error(
          "PAYMENT_WEBHOOK_SECRET is required when PAYMENT_PROVIDER=mock",
        );
      }
      cached = new MockPaymentProvider(secret);
      return cached;
    }
    // Gerçek sağlayıcılar buraya eklenecek:
    // case "iyzico": cached = new IyzicoProvider(...); return cached;
    // case "paytr":  cached = new PayTRProvider(...);  return cached;
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER: ${providerName}`);
  }
}

export type { PaymentProvider } from "./provider";
