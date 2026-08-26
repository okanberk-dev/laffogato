/**
 * Client-safe ticaret hesaplamaları — kargo, KDV, para biçimleme.
 *
 * Hem server action'lar (`placeOrder`, checkout actions) hem de client
 * bileşenleri (CartDrawer, CheckoutWizard) buradan okur ki kargo eşiği ve
 * KDV oranı tek bir yerden gelsin. "server-only" YOK — saf fonksiyonlar.
 */

export interface CheckoutConfig {
  /** Eşik altı uygulanan sabit kargo ücreti (kuruş). */
  shippingFlatMinor: number;
  /** Bu net tutarın (indirim sonrası ara toplam) üstünde kargo ücretsiz. 0 = kapalı. */
  shippingFreeThresholdMinor: number;
  /** KDV yüzdesi — fiyatlar KDV DAHİL olduğundan yalnızca bilgi amaçlı ayrıştırma için. */
  taxRatePct: number;
}

export const DEFAULT_CHECKOUT_CONFIG: CheckoutConfig = {
  shippingFlatMinor: 4900,
  shippingFreeThresholdMinor: 50000,
  taxRatePct: 20,
};

/**
 * İndirim sonrası net ara toplama göre kargo ücretini hesaplar.
 * Net 0 ise (boş/sıfır sepet) kargo da 0.
 */
export function computeShippingMinor(
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

/**
 * KDV-dahil bir toplamın içindeki KDV payını çıkarır.
 * Türkiye perakendesinde fiyatlar KDV dahil gösterilir; bu yalnızca
 * "bu fiyatın içinde ₺X KDV var" bilgisini üretmek içindir.
 */
export function extractTaxMinor(
  grossMinor: number,
  taxRatePct: number,
): number {
  if (taxRatePct <= 0 || grossMinor <= 0) return 0;
  const rate = taxRatePct / 100;
  return Math.round(grossMinor - grossMinor / (1 + rate));
}

export interface OrderTotals {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  /** KDV-dahil toplamın içindeki KDV payı (bilgi amaçlı). */
  taxMinor: number;
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
  const taxMinor = extractTaxMinor(totalMinor, cfg.taxRatePct);
  const freeShippingRemainingMinor =
    cfg.shippingFreeThresholdMinor > 0 &&
    netMinor < cfg.shippingFreeThresholdMinor
      ? cfg.shippingFreeThresholdMinor - netMinor
      : 0;
  return {
    subtotalMinor: safeSubtotal,
    discountMinor: safeDiscount,
    shippingMinor,
    taxMinor,
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
