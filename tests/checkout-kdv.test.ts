import { describe, expect, it } from "vitest";

import {
  checkoutKdvNote,
  checkoutKdvRows,
  type CheckoutKdvInput,
} from "@/app/odeme/checkout-kdv";

/**
 * The quiet KDV line under the checkout's "Toplam (KDV dahil)" (operator,
 * 18 Eki 2026): the KDV inside the total, per rate, from the rate each line
 * will be stamped with. Amounts in kuruş; expectations worked out by hand
 * (gross x r / (100 + r), half a kuruş up).
 */

function input(
  lines: [grossMinor: number, ratePct: number | null][],
  extra: Partial<CheckoutKdvInput> = {},
): CheckoutKdvInput {
  const subtotalMinor = lines.reduce((s, [g]) => s + g, 0);
  const discountMinor = extra.discountMinor ?? 0;
  const shippingMinor = extra.shippingMinor ?? 0;
  return {
    lines: lines.map(([grossMinor, ratePct]) => ({ grossMinor, ratePct })),
    subtotalMinor,
    discountMinor,
    shippingMinor,
    totalMinor: Math.max(0, subtotalMinor - discountMinor) + shippingMinor,
    shippingRatePct: null,
    ...extra,
  };
}

const note = (i: CheckoutKdvInput) => checkoutKdvNote(checkoutKdvRows(i));

describe("checkout KDV note", () => {
  it("names the KDV inside a single-rate total", () => {
    // 50,00₺ at 20%: 5000 x 20 / 120 = 833,3 -> 8,33₺.
    expect(note(input([[5000, 20]]))).toBe("KDV dahil: %20 · 8,33₺");
  });

  it("names each rate of a mixed basket, lowest first", () => {
    // 140₺ at 10%: 1272,7 -> 12,73₺. 50₺ at 20%: 8,33₺.
    expect(
      note(
        input([
          [5000, 20],
          [14000, 10],
        ]),
      ),
    ).toBe("KDV dahil: %10 · 12,73₺, %20 · 8,33₺");
  });

  it("joins lines that share a rate and takes the KDV out once", () => {
    // 3 x 33,33₺ at 20% = 99,99₺ -> 1666,5 -> 16,67₺ (not 3 x 5,56₺).
    expect(
      checkoutKdvRows(
        input([
          [3333, 20],
          [3333, 20],
          [3333, 20],
        ]),
      ),
    ).toEqual([{ ratePct: 20, taxMinor: 1667 }]);
  });

  it("takes the discount out of the base, shared over the lines", () => {
    // 100₺ at 1% and 100₺ at 20%, 50₺ off: 75₺ each.
    // 7500 / 101 = 74,3 -> 0,74₺; 7500 x 20 / 120 = 12,50₺.
    expect(
      checkoutKdvRows(
        input(
          [
            [10000, 1],
            [10000, 20],
          ],
          { discountMinor: 5000 },
        ),
      ),
    ).toEqual([
      { ratePct: 1, taxMinor: 74 },
      { ratePct: 20, taxMinor: 1250 },
    ]);
  });

  it("without a known shipping rate, the fee is its own line at the legal 20%, as the receipt splits it", () => {
    // 200₺ at 1% + 100₺ at 20% + 60₺ shipping at 20%:
    // 200₺ at 1% = 198,02 -> 1,98₺; 160₺ at 20% = 26,67₺.
    expect(
      note(
        input(
          [
            [20000, 1],
            [10000, 20],
          ],
          { shippingMinor: 6000 },
        ),
      ),
    ).toBe("KDV dahil: %1 · 1,98₺, %20 · 26,67₺");
  });

  it("with its own rate, the fee is a line of its own (decided 18 Eki 2026, kdv-rates-and-invoice-lines)", () => {
    // 150₺ at 10% + 100₺ shipping at 20%: 13,64₺ and 16,67₺.
    expect(
      checkoutKdvRows(
        input([[15000, 10]], { shippingMinor: 10000, shippingRatePct: 20 }),
      ),
    ).toEqual([
      { ratePct: 10, taxMinor: 1364 },
      { ratePct: 20, taxMinor: 1667 },
    ]);
    // 100₺ at 20% + 100₺ shipping at 20%: one row, 200₺ -> 33,33₺.
    expect(
      checkoutKdvRows(
        input([[10000, 20]], { shippingMinor: 10000, shippingRatePct: 20 }),
      ),
    ).toEqual([{ ratePct: 20, taxMinor: 3333 }]);
  });

  it("a code that covered every line leaves the shipping fee's KDV", () => {
    // Own rate: only the fee is left, 60₺ at 20% = 10₺.
    expect(
      note(
        input([[10000, 10]], {
          discountMinor: 10000,
          shippingMinor: 6000,
          shippingRatePct: 20,
        }),
      ),
    ).toBe("KDV dahil: %20 · 10₺");
    // No known rate: the same, the fee never takes the line's 10%.
    expect(
      note(input([[10000, 10]], { discountMinor: 10000, shippingMinor: 6000 })),
    ).toBe("KDV dahil: %20 · 10₺");
  });

  it("names no KDV at 0% and says nothing for a free order", () => {
    expect(note(input([[5000, 0]]))).toBeNull();
    expect(
      checkoutKdvRows(
        input([
          [5000, 0],
          [5000, 20],
        ]),
      ),
    ).toEqual([{ ratePct: 20, taxMinor: 833 }]);
    expect(note(input([[5000, 20]], { discountMinor: 5000 }))).toBeNull();
  });

  it("never guesses: a line without a known rate leaves the note out", () => {
    expect(
      checkoutKdvRows(
        input([
          [5000, 20],
          [5000, null],
        ]),
      ),
    ).toBeNull();
    expect(checkoutKdvRows(input([[5000, 12.5]]))).toBeNull();
    expect(checkoutKdvRows(input([]))).toBeNull();
    expect(checkoutKdvNote(null)).toBeNull();
  });

  it("says nothing when the lines do not add up to the totals shown", () => {
    // A quote for a different basket: no split that does not match.
    expect(
      checkoutKdvRows({ ...input([[5000, 20]]), subtotalMinor: 6000 }),
    ).toBeNull();
    expect(
      checkoutKdvRows({ ...input([[5000, 20]]), totalMinor: 4000 }),
    ).toBeNull();
  });

  it("is written without long dashes", () => {
    const text = note(
      input([
        [5000, 20],
        [14000, 10],
      ]),
    );
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
