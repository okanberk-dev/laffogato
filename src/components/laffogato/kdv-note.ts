import { priceLabel } from "@/lib/utils/format";
import { isTaxRate, kdvOfGross, kdvRateLabel } from "@/lib/utils/kdv";

/**
 * The quiet note under a KDV-included total (operator, 18 Eki 2026: "kdv
 * dahil olan kısımda kdv miktarı otomatik yazsın"): the rate and the KDV
 * inside the amount, "%20 KDV dahil (KDV 58,33₺)".
 *
 * Client-safe and pure, so the karaoke booking, the booking's own page and
 * the checkout can print the same words. The amount is the total's own KDV
 * (`kdvOfGross`: gross × r / (100 + r), to the kuruş); nothing here changes
 * what is paid. The rate always comes from the server (the karaoke
 * availability, the booking's snapshot) and is never assumed: without one
 * the note says only "KDV dahil".
 */
export interface KdvIncludedParts {
  /** "%20 KDV dahil", "%0 KDV", or "KDV dahil" without a rate. */
  rate: string;
  /** "KDV 58,33₺"; null when there is no amount to name. */
  amount: string | null;
}

/** The note in its two halves, for a line that may break between them. */
export function kdvIncludedParts(
  totalMinor: number,
  ratePct: number | null | undefined,
): KdvIncludedParts {
  if (!isTaxRate(ratePct)) return { rate: "KDV dahil", amount: null };
  // A zero rate carries no KDV to name; "dahil" would promise one.
  if (ratePct === 0) return { rate: `${kdvRateLabel(0)} KDV`, amount: null };
  const taxMinor = kdvOfGross(totalMinor, ratePct);
  return {
    rate: `${kdvRateLabel(ratePct)} KDV dahil`,
    amount: taxMinor > 0 ? `KDV ${priceLabel(taxMinor)}` : null,
  };
}

export function kdvIncludedNote(
  totalMinor: number,
  ratePct: number | null | undefined,
): string {
  const { rate, amount } = kdvIncludedParts(totalMinor, ratePct);
  return amount ? `${rate} (${amount})` : rate;
}
