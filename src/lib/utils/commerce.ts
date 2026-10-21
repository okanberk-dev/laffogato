/**
 * Client-safe ticaret hesaplamaları - kargo, para biçimleme.
 *
 * Hem server action'lar (`placeOrder`, checkout actions) hem de client
 * bileşenleri (CartDrawer, tek sayfa checkout) buradan okur ki kargo eşiği
 * tek bir yerden gelsin. "server-only" YOK - saf fonksiyonlar.
 *
 * KDV burada yok: fiyatlar KDV dahil, oran da ürüne göre değişir. Oranların
 * dökümü `./kdv.ts`'te (sipariş satırının kendi oranından).
 */

export interface CheckoutConfig {
  /** Eşik altı uygulanan sabit kargo ücreti (kuruş). */
  shippingFlatMinor: number;
  /** Bu net tutarın (indirim sonrası ara toplam) üstünde kargo ücretsiz. 0 = kapalı. */
  shippingFreeThresholdMinor: number;
}

/**
 * İndirim sonrası net ara toplama göre kargo ücretini hesaplar.
 * Net 0 ise (boş/sıfır sepet) kargo da 0.
 */
function computeShippingMinor(
  netSubtotalMinor: number,
  cfg: CheckoutConfig,
): number {
  if (netSubtotalMinor <= 0) return 0;
  if (
    cfg.shippingFreeThresholdMinor > 0 &&
    netSubtotalMinor >= cfg.shippingFreeThresholdMinor
  ) {
    return 0;
  }
  return Math.max(0, cfg.shippingFlatMinor);
}

export interface OrderTotals {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  /** Ücretsiz kargoya kalan tutar (kuruş); 0 ise eşik aşıldı veya kapalı. */
  freeShippingRemainingMinor: number;
}

/**
 * Bir siparişin tüm para kalemlerini tek yerde hesaplar.
 * total = max(0, subtotal − discount) + shipping
 */
export function computeOrderTotals(
  subtotalMinor: number,
  discountMinor: number,
  cfg: CheckoutConfig,
): OrderTotals {
  const safeSubtotal = Math.max(0, Math.round(subtotalMinor));
  const safeDiscount = Math.min(
    Math.max(0, Math.round(discountMinor)),
    safeSubtotal,
  );
  const netMinor = safeSubtotal - safeDiscount;
  const shippingMinor = computeShippingMinor(netMinor, cfg);
  const totalMinor = netMinor + shippingMinor;
  const freeShippingRemainingMinor =
    cfg.shippingFreeThresholdMinor > 0 &&
    netMinor < cfg.shippingFreeThresholdMinor
      ? cfg.shippingFreeThresholdMinor - netMinor
      : 0;
  return {
    subtotalMinor: safeSubtotal,
    discountMinor: safeDiscount,
    shippingMinor,
    totalMinor,
    freeShippingRemainingMinor,
  };
}

/** kuruş → "1.234,56 ₺" (tr-TR, currency). */
export function formatTRYMinor(amountMinor: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}
