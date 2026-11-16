import { SAVED_CARDS_IN_LEGAL_TEXTS } from "@/lib/legal/meta";

import { PaynkolayPaymentProvider } from "./paynkolay";
import type { PaymentProvider } from "./provider";

let cached: PaymentProvider | null = null;

function required(name: string, provider: string): string {
  const v = process.env[name];
  if (!v)
    throw new Error(`${name} is required when PAYMENT_PROVIDER=${provider}`);
  return v;
}

/**
 * `PAYNKOLAY_CHECKOUT_MODE` (docs/PAYNKOLAY.md §15): `direct` = kart sitede
 * alınır, `hosted` ya da boş = PayNkolay'ın ortak ödeme sayfası. Yazım hatası
 * sessizce bir moda düşmez; sağlayıcı açılmaz.
 */
function paynkolayCheckoutMode(): "hosted" | "direct" {
  const raw = (process.env.PAYNKOLAY_CHECKOUT_MODE ?? "").trim().toLowerCase();
  if (raw === "" || raw === "hosted") return "hosted";
  if (raw === "direct") return "direct";
  throw new Error(
    `PAYNKOLAY_CHECKOUT_MODE must be "direct" or "hosted", got "${raw}"`,
  );
}

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;

  // Fail closed: the provider must be named explicitly in every environment.
  // There is no stand-in provider that settles an order without taking money;
  // development uses PayNkolay's test host (PAYNKOLAY_BASE_URL).
  const providerName = process.env.PAYMENT_PROVIDER;
  if (!providerName) {
    throw new Error(
      "PAYMENT_PROVIDER is not set. Set PAYMENT_PROVIDER=paynkolay " +
        "(docs/PAYNKOLAY.md).",
    );
  }

  switch (providerName) {
    case "paynkolay": {
      // Üretim sağlayıcısı (docs/PAYNKOLAY.md). Test ve canlı yalnızca host ve
      // anahtarlarla ayrışıyor, bu yüzden NODE_ENV'e değil PAYNKOLAY_BASE_URL'e
      // bakılır.
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
        checkoutMode: paynkolayCheckoutMode(),
        // Kart saklama iki şart ister: PayNkolay'ın yetkisi (değişken) ve
        // onu anlatan hukuk metni (`SAVED_CARDS_IN_LEGAL_TEXTS`, §16).
        // Değişken tek başına açamaz: metin söylemeden üye anahtarı
        // üretilmez, POS'a `cs*` alanı gitmez.
        cardStorage:
          SAVED_CARDS_IN_LEGAL_TEXTS &&
          ["1", "true", "on"].includes(
            (process.env.PAYNKOLAY_CARD_STORAGE ?? "").trim().toLowerCase(),
          ),
      });
      return cached;
    }
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER: ${providerName}`);
  }
}

export type { PaymentProvider } from "./provider";
