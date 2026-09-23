import { IyzicoPaymentProvider } from "./iyzico";
import { MockPaymentProvider } from "./mock";
import { PaynkolayPaymentProvider } from "./paynkolay";
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

  // Fail closed. The mock provider settles an order as paid without taking any
  // money, so defaulting to it means a forgotten env var on production turns
  // every checkout into a free order. Outside development the provider must be
  // named explicitly.
  const configured = process.env.PAYMENT_PROVIDER;
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "PAYMENT_PROVIDER is not set. Refusing to fall back to the mock " +
          "provider in production - it would mark orders paid without charging.",
      );
    }
    console.warn(
      "[payment] PAYMENT_PROVIDER unset — using the mock provider (development only).",
    );
  }
  const providerName = configured ?? "mock";

  // A production deployment must never run the mock, even if it is named.
  if (providerName === "mock" && process.env.NODE_ENV === "production") {
    throw new Error(
      "PAYMENT_PROVIDER=mock is not allowed in production: the mock settles " +
        "orders as paid without taking payment.",
    );
  }

  switch (providerName) {
    case "mock": {
      cached = new MockPaymentProvider(
        required("PAYMENT_WEBHOOK_SECRET", "mock"),
      );
      return cached;
    }
    case "paynkolay": {
      // Üretim sağlayıcısı (docs/PAYNKOLAY.md). Test ve canlı yalnızca host ve
      // anahtarlarla ayrışıyor, bu yüzden NODE_ENV'e değil PAYNKOLAY_BASE_URL'e
      // bakılır — iyzico'daki desenin aynısı.
      //
      // `merchantSecretKey` hiçbir isteğe girmez, yalnızca hash hesabına
      // katılır (§7); PAYMENT_WEBHOOK_SECRET burada YOK, çünkü PayNkolay
      // webhook göndermiyor (§4) ve o değişkeni istemek olmayan bir güvenliği
      // varmış gibi gösterirdi.
      cached = new PaynkolayPaymentProvider({
        sx: required("PAYNKOLAY_SX", "paynkolay"),
        sxList: required("PAYNKOLAY_SX_LIST", "paynkolay"),
        sxCancel: required("PAYNKOLAY_SX_CANCEL", "paynkolay"),
        merchantSecretKey: required(
          "PAYNKOLAY_MERCHANT_SECRET_KEY",
          "paynkolay",
        ),
        merchantNo: required("PAYNKOLAY_MERCHANT_NO", "paynkolay"),
        baseUrl: process.env.PAYNKOLAY_BASE_URL,
        successUrl: required("PAYNKOLAY_SUCCESS_URL", "paynkolay"),
        failUrl: required("PAYNKOLAY_FAIL_URL", "paynkolay"),
      });
      return cached;
    }
    case "iyzico": {
      // Üretimde kullanılmıyor (PayNkolay seçildi) ama silinmedi: operatör
      // geri dönmek isterse tek bir env değişkeniyle dönebilsin.
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
