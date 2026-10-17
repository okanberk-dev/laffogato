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

/**
 * A stock count the form read when it was opened (admin audit CAT-03), or
 * null when it posts none: a new product, a new variant row, a form from
 * before the field. The save moves stock by the difference from this, so
 * only a whole number counts. It is below 0 only when a refusal handed the
 * form a basis net of what its earlier saves moved (a restock of 50 whose
 * answer was lost, then 58 sold: stored 2, basis 2 - 50).
 */
export function parseStockSnapshot(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isSafeInteger(raw) ? raw : null;
  }
  if (typeof raw !== "string" || !/^-?\d{1,9}$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

/** The stock fields of one product form save. */
export interface PostedStock {
  /** The product's own count as typed; null when the form shows the
   * variants' total instead of a field. */
  stock: number | null;
  /** The product's stock when the form was opened; null for a new one. */
  stockAtOpen: number | null;
  variants: Array<{ id: string; stock: number; stockAtOpen: number | null }>;
}

function postedCount(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? "0"), 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/**
 * The stock fields of a product form save (`stock`, `stockAtOpen` and the
 * `variants` JSON), read as productFormSchema reads them. Client-safe: the
 * wizard reads back what it posted when the save is refused.
 */
export function readPostedStock(fields: {
  stock: unknown;
  stockAtOpen: unknown;
  variants: unknown;
}): PostedStock {
  let rows: unknown = [];
  try {
    rows = JSON.parse(
      typeof fields.variants === "string" ? fields.variants : "[]",
    );
  } catch {
    rows = [];
  }
  const variants = (Array.isArray(rows) ? rows : [])
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((v, i) => ({
      id: String(v.id || `var-${i + 1}`),
      stock: postedCount(v.stock),
      stockAtOpen: parseStockSnapshot(v.stockAtOpen),
    }));
  return {
    stock:
      fields.stock === null || fields.stock === undefined
        ? null
        : postedCount(fields.stock),
    stockAtOpen: parseStockSnapshot(fields.stockAtOpen),
    variants,
  };
}

/**
 * The snapshots a product form measures its next save from, after a save
 * refused for stock (admin audit CAT-03). `now` is what the refusal says is
 * stored. Only a count whose typed change would still take it below zero is
 * re-based on the stored one: the operator was told what it is now, and the
 * typed value becomes the count to save. Every other count keeps the
 * snapshot it was opened with, so its next save applies the change typed in
 * it, or none. Re-basing them all turned an untouched variant's next save
 * into "back to the count at open", which put the units sold while the
 * form was open back on sale.
 *
 * With variants the product's own snapshot only feeds the total the form
 * shows (the save does not read it), so it starts from the stored total.
 */
export function rebaseStockSnapshots(
  posted: PostedStock,
  now: { stock: number; variants: Readonly<Record<string, number>> },
): { stock: number | null; variants: Record<string, number> } {
  const variants: Record<string, number> = {};
  for (const v of posted.variants) {
    if (v.stockAtOpen === null) continue;
    const stored = now.variants[v.id];
    variants[v.id] =
      stored !== undefined && stored + (v.stock - v.stockAtOpen) < 0
        ? stored
        : v.stockAtOpen;
  }
  const opened = posted.stockAtOpen;
  let stock = opened;
  if (opened !== null) {
    if (posted.variants.length > 0) {
      stock = now.stock;
    } else if (now.stock + ((posted.stock ?? opened) - opened) < 0) {
      stock = now.stock;
    }
  }
  return { stock, variants };
}
