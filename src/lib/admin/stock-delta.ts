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
