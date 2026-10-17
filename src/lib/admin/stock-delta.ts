import { splitSign } from "@/lib/utils/format";

/**
 * The manual stock adjustment as typed on /admin/stok-hareketleri: "+12",
 * "-3", "−3" (the Unicode minus the form's own hint used), "12".
 *
 * Pure and client-safe so the action and the tests share it. It replaces a
 * `parseInt` behind `pattern="-?\d+"`: the browser refused the placeholder's
 * own "+12", the server refused the hint's "−3", and "1.5" was cut to 1
 * without a word. Stock is counted in whole units, so a decimal is refused
 * rather than rounded, and so is a thousands dot ("1.000" is ambiguous).
 */

/** The largest single adjustment; a bigger one is a typo, not a delivery. */
export const STOCK_DELTA_MAX = 100_000;

export type StockDeltaResult =
  { ok: true; delta: number } | { ok: false; error: string };

export function parseStockDelta(raw: string): StockDeltaResult {
  const { sign, rest } = splitSign(raw);
  if (!rest) {
    return { ok: false, error: "Değişikliği yaz: ör. +12 ya da -3." };
  }
  if (/[.,]/.test(rest)) {
    return {
      ok: false,
      error: "Stok adetle tutulur: nokta ya da virgül olmadan tam sayı yaz.",
    };
  }
  if (!/^\d+$/.test(rest)) {
    return { ok: false, error: "Rakamla yaz: ör. +12 ya da -3." };
  }
  const n = Number(rest);
  if (n === 0) {
    return {
      ok: false,
      error: "0 olamaz: eklenecek ya da düşülecek adedi yaz.",
    };
  }
  if (n > STOCK_DELTA_MAX) {
    return {
      ok: false,
      error: `Tek seferde en fazla ${STOCK_DELTA_MAX.toLocaleString("tr-TR")} adet değişebilir.`,
    };
  }
  return { ok: true, delta: sign * n };
}

/**
 * The total of a product with variants, as `variant_stock_total` (SQL)
 * counts it: the stock of the active variants. A product getting its first
 * variants takes this as its stock; after that the total moves with each
 * variant's change (admin audit CAT-14, D16). Client-safe: the product form
 * shows the same number before it saves.
 */
export function variantStockTotal(
  variants: ReadonlyArray<{ stock: number; isActive: boolean }>,
): number {
  let total = 0;
  for (const v of variants) {
    if (v.isActive === true) total += Math.max(0, Math.trunc(v.stock) || 0);
  }
  return total;
}

/**
 * What the Stok screen's "Ürün" select posts: a product id ("prd-0004"), or
 * a product and one of its variants ("prd-0004#var-2"). Product ids never
 * hold a "#" (`slugifyId`), so the first one splits them.
 */
export function splitStockTarget(raw: string): {
  productId: string;
  variantId: string | null;
} {
  const text = raw.trim();
  const at = text.indexOf("#");
  if (at < 0) return { productId: text, variantId: null };
  const variantId = text.slice(at + 1).trim();
  return { productId: text.slice(0, at).trim(), variantId: variantId || null };
}
