import { IyzicoPaymentProvider } from "./iyzico";
import { MockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./provider";

let cached: PaymentProvider | null = null;

function required(name: string, provider: string): string {
  const v = process.env[name];
  if (!v)
    throw new Error(`${name} is required when PAYMENT_PROVIDER=${provider}`);
  return v;
}

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;

  const providerName = process.env.PAYMENT_PROVIDER ?? "mock";

  switch (providerName) {
    case "mock": {
      cached = new MockPaymentProvider(
        required("PAYMENT_WEBHOOK_SECRET", "mock"),
      );
      return cached;
    }
    case "iyzico": {
      // Sandbox and production differ only by base URL and key pair, so the
      // URL stays configurable rather than switching on NODE_ENV.
      cached = new IyzicoPaymentProvider({
        apiKey: required("IYZICO_API_KEY", "iyzico"),
        secretKey: required("IYZICO_SECRET_KEY", "iyzico"),
        baseUrl: process.env.IYZICO_BASE_URL,
        webhookSecret: required("PAYMENT_WEBHOOK_SECRET", "iyzico"),
        callbackUrl: required("IYZICO_CALLBACK_URL", "iyzico"),
      });
      return cached;
    }
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER: ${providerName}`);
  }
}

export type { PaymentProvider } from "./provider";
