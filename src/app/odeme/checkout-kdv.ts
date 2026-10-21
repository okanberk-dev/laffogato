import { priceLabel } from "@/lib/utils/format";
import {
  isTaxRate,
  kdvBreakdown,
  kdvOfGross,
  kdvRateLabel,
} from "@/lib/utils/kdv";

/**
 * The KDV inside the checkout's total, rate by rate (operator, 18 Eki 2026:
 * "ödeme esnasında kdv dahil olan kısımda kdv miktarı otomatik yazsın").
 *
 * Shown under "Toplam (KDV dahil)" as one quiet line:
 * "KDV dahil: %10 · 12,73₺, %20 · 8,33₺". Nothing here changes what is paid;
 * the amounts are the ones on screen (the server's quote once it has
 * answered) and each rate is the one the order will stamp on the line
 * (`productTaxRate`, read by the page). A rate that is not known is never
 * guessed: without one for every line the note is left out and the total
 * still says "KDV dahil".
 *
 * Client-safe and pure, like `src/lib/utils/kdv.ts`, whose rules it uses.
 */

/** Per product id, the rate the order line will carry; the shipping fee's own. */
export interface CheckoutKdvRates {
  products: Record<string, number>;
  /**
   * The shipping fee's rate (`settings.taxRates.shipping`, decided 18 Eki
   * 2026: the fee is its own line on the invoice, a separate transport
   * service at the general rate). `null` when it is not known: the fee is
   * then taken at the legal 20%, as the receipt (`orderKdvBreakdown`) takes
   * it, so the checkout never shows a split the order page would not.
   */
  shippingRatePct: number | null;
}

export const NO_CHECKOUT_KDV_RATES: CheckoutKdvRates = {
  products: {},
  shippingRatePct: null,
};

export interface CheckoutKdvInput {
  /** What each line costs before the discount, and its rate if known. */
  lines: ReadonlyArray<{
    grossMinor: number;
    ratePct: number | null | undefined;
  }>;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  totalMinor: number;
  shippingRatePct: number | null;
}

/** One rate in the note: the KDV inside the part of the total at that rate. */
export interface CheckoutKdvRow {
  ratePct: number;
  taxMinor: number;
}

/**
 * The KDV per rate inside `totalMinor`, lowest rate first, or `null` when it
 * cannot be said truthfully: a line without a known rate, or lines that do
 * not add up to the totals shown. A rate that carries no KDV (0%) is left
 * out: there is nothing to name.
 */
export function checkoutKdvRows(
  input: CheckoutKdvInput,
): CheckoutKdvRow[] | null {
  if (input.lines.length === 0) return null;
  if (!input.lines.every((l) => isTaxRate(l.ratePct))) return null;
  const lines = input.lines.map((l) => ({
    grossMinor: Math.max(0, Math.round(l.grossMinor)),
    ratePct: l.ratePct as number,
  }));
  const subtotal = lines.reduce((s, l) => s + l.grossMinor, 0);
  if (subtotal !== input.subtotalMinor) return null;

  // The fee is never shared over the goods: it is its own amount at its own
  // rate (20% when not known) and joins the row of the lines at that rate.
  const split = kdvBreakdown({
    lines,
    discountMinor: input.discountMinor,
    shippingMinor: input.shippingMinor,
    ...(isTaxRate(input.shippingRatePct)
      ? { shippingRatePct: input.shippingRatePct }
      : {}),
  });
  const byRate = new Map<number, number>();
  for (const row of split.rows) byRate.set(row.ratePct, row.grossMinor);
  const gross = [...byRate.values()].reduce((s, g) => s + g, 0);
  if (gross !== input.totalMinor) return null;

  return [...byRate.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ratePct, grossMinor]) => ({
      ratePct,
      taxMinor: kdvOfGross(grossMinor, ratePct),
    }))
    .filter((row) => row.taxMinor > 0);
}

/** "%10 · 12,73₺, %20 · 8,33₺": each rate and its KDV; null when none. */
export function checkoutKdvParts(
  rows: readonly CheckoutKdvRow[] | null,
): string | null {
  if (!rows || rows.length === 0) return null;
  return rows
    .map((r) => `${kdvRateLabel(r.ratePct)} · ${priceLabel(r.taxMinor)}`)
    .join(", ");
}

/** "KDV dahil: %10 · 12,73₺, %20 · 8,33₺", or null when there is none to name. */
export function checkoutKdvNote(
  rows: readonly CheckoutKdvRow[] | null,
): string | null {
  const parts = checkoutKdvParts(rows);
  return parts ? `KDV dahil: ${parts}` : null;
}
