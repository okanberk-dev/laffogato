import { describe, expect, it } from "vitest";

import {
  allocateMinor,
  isTaxRate,
  kdvBreakdown,
  kdvOfGross,
  KDV_RATE_CHOICES,
  LEGAL_TAX_RATES,
  menuItemTaxRate,
  normalizeTaxRates,
  orderKdvBreakdown,
  parseTaxRateInput,
  productTaxRate,
  TAX_RATE_KEYS,
} from "@/lib/utils/kdv";

/**
 * KDV per item (operator, 17 Eki 2026): karaoke 20, the cafe menu 10, coffee
 * beans 1, editable in the panel. Prices are KDV-included, so nothing here
 * may ever move a total: the split only says how much of it is KDV.
 */

describe("the legal defaults", () => {
  it("are the rates the research found", () => {
    expect(LEGAL_TAX_RATES).toEqual({
      menu: 10,
      karaoke: 20,
      beans: 1,
      pantry: 1,
      gift: 20,
      gear: 20,
      merch: 20,
    });
    expect(Object.isFrozen(LEGAL_TAX_RATES)).toBe(true);
    expect([...TAX_RATE_KEYS].sort()).toEqual(
      Object.keys(LEGAL_TAX_RATES).sort(),
    );
    expect(KDV_RATE_CHOICES).toEqual([0, 1, 10, 20]);
  });
});

describe("isTaxRate / parseTaxRateInput", () => {
  it("accepts whole numbers from 0 to 100 only", () => {
    for (const ok of [0, 1, 10, 20, 100]) expect(isTaxRate(ok)).toBe(true);
    for (const bad of [-1, 101, 1.5, Number.NaN, "10", null, undefined]) {
      expect(isTaxRate(bad)).toBe(false);
    }
  });

  it("reads empty as 'use the default' and refuses fractions instead of rounding", () => {
    expect(parseTaxRateInput("")).toEqual({ ok: true, value: null });
    expect(parseTaxRateInput("  ")).toEqual({ ok: true, value: null });
    expect(parseTaxRateInput(undefined)).toEqual({ ok: true, value: null });
    expect(parseTaxRateInput(null)).toEqual({ ok: true, value: null });
    expect(parseTaxRateInput("10")).toEqual({ ok: true, value: 10 });
    expect(parseTaxRateInput(" %1 ")).toEqual({ ok: true, value: 1 });
    expect(parseTaxRateInput("0")).toEqual({ ok: true, value: 0 });
    // The old settings action kept "1.5", which the integer column refused.
    expect(parseTaxRateInput("1.5")).toEqual({ ok: false });
    expect(parseTaxRateInput("1,5")).toEqual({ ok: false });
    expect(parseTaxRateInput("-1")).toEqual({ ok: false });
    expect(parseTaxRateInput("101")).toEqual({ ok: false });
    expect(parseTaxRateInput("on")).toEqual({ ok: false });
  });
});

describe("normalizeTaxRates", () => {
  it("fills every missing or broken key with the legal default", () => {
    expect(normalizeTaxRates({})).toEqual(LEGAL_TAX_RATES);
    expect(normalizeTaxRates(null)).toEqual(LEGAL_TAX_RATES);
    expect(normalizeTaxRates("x")).toEqual(LEGAL_TAX_RATES);
    expect(
      normalizeTaxRates({
        menu: 8,
        beans: "1",
        gear: 1.5,
        merch: 200,
        karaoke: 0,
      }),
    ).toEqual({ ...LEGAL_TAX_RATES, menu: 8, karaoke: 0 });
  });

  it("returns a fresh object every time", () => {
    const a = normalizeTaxRates({});
    a.menu = 99;
    expect(normalizeTaxRates({}).menu).toBe(10);
    expect(LEGAL_TAX_RATES.menu).toBe(10);
  });
});

describe("effective rates", () => {
  const rates = { ...LEGAL_TAX_RATES, beans: 1, gear: 20, menu: 10 };

  it("a product without its own rate takes its category's", () => {
    expect(productTaxRate({ cat: "beans", taxRatePct: null }, rates)).toBe(1);
    expect(productTaxRate({ cat: "gear" }, rates)).toBe(20);
    expect(productTaxRate({ cat: "pantry" }, rates)).toBe(1);
    // An unknown category is the general rate, never 0.
    expect(productTaxRate({ cat: "nope" }, rates)).toBe(20);
  });

  it("a product's own rate wins, 0 included", () => {
    expect(productTaxRate({ cat: "beans", taxRatePct: 20 }, rates)).toBe(20);
    expect(productTaxRate({ cat: "gear", taxRatePct: 0 }, rates)).toBe(0);
  });

  it("a menu item takes its own rate, else the menu default", () => {
    expect(menuItemTaxRate({}, rates)).toBe(10);
    expect(menuItemTaxRate({ taxRatePct: null }, { ...rates, menu: 8 })).toBe(
      8,
    );
    expect(menuItemTaxRate({ taxRatePct: 20 }, rates)).toBe(20);
  });
});

describe("kdvOfGross", () => {
  it("takes KDV out of a KDV-included amount, rounded to the kuruş", () => {
    expect(kdvOfGross(12000, 20)).toBe(2000);
    expect(kdvOfGross(11000, 10)).toBe(1000);
    expect(kdvOfGross(10100, 1)).toBe(100);
    // 32000 × 1/101 = 316.83... → 317
    expect(kdvOfGross(32000, 1)).toBe(317);
    expect(kdvOfGross(19500, 10)).toBe(1773);
    expect(kdvOfGross(0, 20)).toBe(0);
    expect(kdvOfGross(5000, 0)).toBe(0);
  });
});

describe("allocateMinor", () => {
  it("always adds up to the total", () => {
    expect(allocateMinor(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateMinor(1, [3, 3])).toEqual([1, 0]);
    expect(allocateMinor(4900, [32000, 19500])).toEqual([3045, 1855]);
    expect(allocateMinor(0, [5, 5])).toEqual([0, 0]);
    expect(allocateMinor(10, [0, 0])).toEqual([5, 5]);
    expect(allocateMinor(10, [])).toEqual([]);
    for (const total of [1, 7, 99, 4900, 123457]) {
      const parts = allocateMinor(total, [333, 1, 7777, 12]);
      expect(parts.reduce((s, p) => s + p, 0)).toBe(total);
      expect(parts.every((p) => p >= 0)).toBe(true);
    }
  });

  it("stays exact at the panel's largest amounts", () => {
    const big = 100_000_000;
    const parts = allocateMinor(big, [big, big - 1, 3]);
    expect(parts.reduce((s, p) => s + p, 0)).toBe(big);
  });
});

describe("kdvBreakdown", () => {
  it("one rate: the whole total at that rate", () => {
    const k = kdvBreakdown({
      lines: [{ grossMinor: 24000, ratePct: 10 }],
      discountMinor: 0,
      shippingMinor: 0,
    });
    expect(k.rows).toEqual([
      { ratePct: 10, grossMinor: 24000, netMinor: 21818, taxMinor: 2182 },
    ]);
    expect(k.grossMinor).toBe(24000);
    expect(k.taxMinor).toBe(2182);
  });

  it("mixed rates: beans at 1%, a grinder at 20%, highest rate first", () => {
    const k = kdvBreakdown({
      lines: [
        { grossMinor: 32000, ratePct: 1 },
        { grossMinor: 150000, ratePct: 20 },
      ],
      discountMinor: 0,
      shippingMinor: 0,
    });
    expect(k.rows.map((r) => r.ratePct)).toEqual([20, 1]);
    expect(k.rows[0]).toEqual({
      ratePct: 20,
      grossMinor: 150000,
      netMinor: 125000,
      taxMinor: 25000,
    });
    expect(k.rows[1]).toEqual({
      ratePct: 1,
      grossMinor: 32000,
      netMinor: 31683,
      taxMinor: 317,
    });
    // Not the old single-rate answer (20% of the whole basket).
    expect(k.taxMinor).toBe(25317);
    expect(k.taxMinor).not.toBe(kdvOfGross(182000, 20));
  });

  it("shares the discount over the lines before each rate's KDV", () => {
    const k = kdvBreakdown({
      lines: [
        { grossMinor: 30000, ratePct: 1 },
        { grossMinor: 10000, ratePct: 20 },
      ],
      discountMinor: 4000,
      shippingMinor: 0,
    });
    // 4000 split 3:1 → 3000 off the beans, 1000 off the mug.
    expect(k.rows).toEqual([
      { ratePct: 20, grossMinor: 9000, netMinor: 7500, taxMinor: 1500 },
      { ratePct: 1, grossMinor: 27000, netMinor: 26733, taxMinor: 267 },
    ]);
    expect(k.grossMinor).toBe(36000);
  });

  it("shipping follows the goods it carries, in proportion", () => {
    const beansOnly = kdvBreakdown({
      lines: [{ grossMinor: 32000, ratePct: 1 }],
      discountMinor: 0,
      shippingMinor: 4900,
    });
    expect(beansOnly.rows).toEqual([
      { ratePct: 1, grossMinor: 36900, netMinor: 36535, taxMinor: 365 },
    ]);

    const mixed = kdvBreakdown({
      lines: [
        { grossMinor: 30000, ratePct: 1 },
        { grossMinor: 10000, ratePct: 20 },
      ],
      discountMinor: 0,
      shippingMinor: 4000,
    });
    expect(mixed.rows.map((r) => [r.ratePct, r.grossMinor])).toEqual([
      [20, 11000],
      [1, 33000],
    ]);
  });

  it("a courier fee still owed after a coupon covered every line is shared by price", () => {
    const k = kdvBreakdown({
      lines: [
        { grossMinor: 19500, ratePct: 10 },
        { grossMinor: 8000, ratePct: 10 },
      ],
      discountMinor: 27500,
      shippingMinor: 5500,
    });
    expect(k.rows).toEqual([
      { ratePct: 10, grossMinor: 5500, netMinor: 5000, taxMinor: 500 },
    ]);
  });

  it("a free order has no rows and no KDV", () => {
    const k = kdvBreakdown({
      lines: [{ grossMinor: 19500, ratePct: 10 }],
      discountMinor: 19500,
      shippingMinor: 0,
    });
    expect(k.rows).toEqual([]);
    expect(k.taxMinor).toBe(0);
    expect(k.grossMinor).toBe(0);
  });

  it("clamps a discount bigger than the lines, like the order totals do", () => {
    const k = kdvBreakdown({
      lines: [{ grossMinor: 1000, ratePct: 20 }],
      discountMinor: 5000,
      shippingMinor: 0,
    });
    expect(k.grossMinor).toBe(0);
  });

  it("the rows always add up to lines − discount + shipping (randomised)", () => {
    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const rates = [0, 1, 10, 20];
    for (let round = 0; round < 300; round += 1) {
      const lines = Array.from({ length: 1 + rand(6) }, () => ({
        grossMinor: rand(200000),
        ratePct: rates[rand(rates.length)],
      }));
      const subtotal = lines.reduce((s, l) => s + l.grossMinor, 0);
      const discount = rand(subtotal + 1);
      const shipping = rand(3) === 0 ? 0 : rand(10000);
      const k = kdvBreakdown({
        lines,
        discountMinor: discount,
        shippingMinor: shipping,
      });
      expect(k.grossMinor).toBe(subtotal - discount + shipping);
      for (const r of k.rows) {
        expect(r.netMinor + r.taxMinor).toBe(r.grossMinor);
        expect(r.taxMinor).toBe(kdvOfGross(r.grossMinor, r.ratePct));
      }
    }
  });
});

describe("orderKdvBreakdown", () => {
  const order = {
    items: [
      { qty: 2, unitPriceMinor: 16000, taxRatePct: 1 },
      { qty: 1, unitPriceMinor: 10000, taxRatePct: 20 },
    ],
    subtotalMinor: 42000,
    discountMinor: 0,
    shippingMinor: 4900,
    totalMinor: 46900,
  };

  it("splits a stored order by the rate each line was sold at", () => {
    const k = orderKdvBreakdown(order)!;
    expect(k.grossMinor).toBe(order.totalMinor);
    expect(k.rows.map((r) => r.ratePct)).toEqual([20, 1]);
  });

  it("is null for an order placed before lines carried a rate", () => {
    expect(
      orderKdvBreakdown({
        ...order,
        items: [
          { qty: 2, unitPriceMinor: 16000 },
          { qty: 1, unitPriceMinor: 10000, taxRatePct: 20 },
        ],
      }),
    ).toBeNull();
  });

  it("is null when the lines do not add up to what was stored", () => {
    expect(orderKdvBreakdown({ ...order, subtotalMinor: 41000 })).toBeNull();
    expect(orderKdvBreakdown({ ...order, totalMinor: 46000 })).toBeNull();
    expect(orderKdvBreakdown({ ...order, items: [] })).toBeNull();
  });

  it("never reads today's defaults: the line's own rate is the sale's", () => {
    // The same order after the panel moved beans to 10%: nothing here can
    // see that, the stored line still says 1.
    const k = orderKdvBreakdown(order)!;
    expect(k.rows.find((r) => r.ratePct === 1)).toBeDefined();
    expect(k.rows.find((r) => r.ratePct === 10)).toBeUndefined();
  });
});
