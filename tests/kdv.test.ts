import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PRODUCTS } from "@/components/laffogato/data";
import {
  allocateMinor,
  invoiceKdvBreakdown,
  invoiceRewardMinor,
  isTaxRate,
  kdvBreakdown,
  kdvOfGross,
  KDV_RATE_CHOICES,
  LEGAL_TAX_RATES,
  menuItemTaxRate,
  normalizeTaxRates,
  orderKdvBreakdown,
  orderShippingTaxRate,
  parseTaxRateInput,
  productTaxRate,
  shippingTaxRate,
  TAX_RATE_KEYS,
  TAX_RATE_LABELS,
  type KdvOrderLike,
} from "@/lib/utils/kdv";

/**
 * KDV per item (operator, 17 Eki 2026): karaoke 20, the cafe menu 10,
 * editable in the panel. 18 Eki 2026 (ASK-Y2-1, ASK-Y2-2, ASK-COUPON): every
 * food the köşk sells is 10% (a kafeterya business, KDV GUT III/B-2.4.1),
 * the shipping or courier fee is its own 20% line, and a reward coupon pays
 * for the goods instead of taking them off the base. Prices are
 * KDV-included, so nothing here may ever move a total: the split only says
 * how much of it is KDV.
 */

describe("the legal defaults", () => {
  it("are the rates the research found", () => {
    expect(LEGAL_TAX_RATES).toEqual({
      menu: 10,
      karaoke: 20,
      // A kafeterya business: its food is 10% even shipped to an address.
      beans: 10,
      pantry: 10,
      gift: 20,
      gear: 20,
      merch: 20,
      // The shipping or courier fee, its own line (a transport service).
      shipping: 20,
    });
    expect(Object.isFrozen(LEGAL_TAX_RATES)).toBe(true);
    expect([...TAX_RATE_KEYS].sort()).toEqual(
      Object.keys(LEGAL_TAX_RATES).sort(),
    );
    expect(KDV_RATE_CHOICES).toEqual([0, 1, 10, 20]);
    // The panel lists the shipping fee last, after the shop categories.
    expect(TAX_RATE_KEYS[TAX_RATE_KEYS.length - 1]).toBe("shipping");
    expect(TAX_RATE_LABELS.shipping).toBe("Kargo ve kurye ücreti");
  });

  it("no default is 1% any more: the köşk sells no food at 1%", () => {
    for (const key of TAX_RATE_KEYS) {
      expect(LEGAL_TAX_RATES[key], key).not.toBe(1);
    }
  });
});

describe("the seeded shop catalogue", () => {
  // The product review of 18 Eki 2026 (LEGAL-REDLINES §16.3, ASK-Y2-3-5):
  // food 10% (a kafeterya business), the cotton apron 10% (a textile
  // garment, list (II) item 5), a set of food and non-food at one price 20%,
  // equipment and the enamel cup 20%. Every seeded product is named here,
  // so a new one has to be given a rate on purpose.
  const EXPECTED: Record<string, number> = {
    "Sirena - Espresso Harmanı": 10,
    "Notturna - Filtre Lotu": 10,
    "Yenilebilir Kup - 6'lı Kutu": 10,
    "Uji Matcha - Seremoni Sınıfı": 10,
    "Cantucci - Bronte Pistachio": 10,
    "Pamuk Önlük": 10,
    "Affogato Seti - İki Kişilik": 20,
    "Moka - Bialetti × L'Affogato": 20,
    "Porselen Fincan Seti": 20,
    "Bambu Chasen": 20,
    "Emaye Bardak": 20,
  };

  it("names every seeded product once", () => {
    expect([...PRODUCTS.map((p) => p.name)].sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
  });

  it("sells every seeded product at its reviewed rate, under the legal defaults", () => {
    for (const p of PRODUCTS) {
      expect(productTaxRate(p, LEGAL_TAX_RATES), p.name).toBe(EXPECTED[p.name]);
    }
  });

  it("keeps the edible cup box and the apron at 10% whatever their category says", () => {
    const cups = PRODUCTS.find((p) => p.name.startsWith("Yenilebilir Kup"))!;
    expect(cups.cat).toBe("gift");
    expect(cups.taxRatePct).toBe(10);
    expect(productTaxRate(cups, { ...LEGAL_TAX_RATES, gift: 20 })).toBe(10);
    const apron = PRODUCTS.find((p) => p.name === "Pamuk Önlük")!;
    expect(apron.cat).toBe("merch");
    expect(apron.taxRatePct).toBe(10);
    expect(productTaxRate(apron, { ...LEGAL_TAX_RATES, merch: 20 })).toBe(10);
  });

  it("the seed writes that rate onto the row, and the migrations onto the live one", () => {
    const store = readFileSync("src/lib/admin/store.ts", "utf8");
    expect(store).toContain(
      'taxRatePct: typeof p.taxRatePct === "number" ? p.taxRatePct : null,',
    );
    const migration = readFileSync(
      "db/migrations/20261019150000_cafe_food_rate_10.sql",
      "utf8",
    );
    expect(migration).toMatch(
      /update public\.products\s+set "taxRatePct" = 10\s+where id = 'prd-0003'\s+and "taxRatePct" = 1/,
    );
    expect(migration).toMatch(
      /update public\.products\s+set "taxRatePct" = 10\s+where id = 'prd-0009'\s+and cat = 'merch'\s+and "taxRatePct" is null/,
    );
    // The Vergi tab's old prefill saved beans 1 and pantry 1 too.
    expect(migration).toMatch(
      /update public\.settings\s+set "taxRates" = "taxRates"[\s\S]*'\{"beans": 10\}'[\s\S]*'\{"pantry": 10\}'/,
    );
    // Once: a rate the operator sets later in the panel stays.
    expect(migration.match(/'20261019150000_cafe_food_rate_10\.sql'/g)).toHaveLength(6);
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

  it("reads a row written before the shipping key existed as 20%", () => {
    // The live settings row has the seven keys of 17 Eki 2026 and no
    // `shipping`: nothing has to be written to it.
    const live = {
      menu: 10,
      karaoke: 20,
      beans: 10,
      pantry: 10,
      gift: 20,
      gear: 20,
      merch: 20,
    };
    expect(normalizeTaxRates(live).shipping).toBe(20);
    expect(normalizeTaxRates({ ...live, shipping: 10 }).shipping).toBe(10);
    expect(shippingTaxRate(undefined)).toBe(20);
    expect(shippingTaxRate({ shipping: 0 })).toBe(0);
    expect(shippingTaxRate({ shipping: 1.5 })).toBe(20);
  });

  it("returns a fresh object every time", () => {
    const a = normalizeTaxRates({});
    a.menu = 99;
    expect(normalizeTaxRates({}).menu).toBe(10);
    expect(LEGAL_TAX_RATES.menu).toBe(10);
  });
});

describe("effective rates", () => {
  // A panel that kept beans at the old 1%: the panel's value wins over the
  // code's default (the operator corrects it at Ayarlar > Vergi).
  const rates = { ...LEGAL_TAX_RATES, beans: 1, gear: 20, menu: 10 };

  it("a product without its own rate takes its category's", () => {
    expect(productTaxRate({ cat: "beans", taxRatePct: null }, rates)).toBe(1);
    expect(productTaxRate({ cat: "gear" }, rates)).toBe(20);
    expect(productTaxRate({ cat: "pantry" }, rates)).toBe(10);
    expect(productTaxRate({ cat: "beans" }, LEGAL_TAX_RATES)).toBe(10);
    // A partial settings object falls back to the legal rate, key by key.
    expect(productTaxRate({ cat: "pantry" }, { gear: 20 })).toBe(10);
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

  it("mixed rates: a 1% line and a grinder at 20%, highest rate first", () => {
    // 1% is still a rate the panel offers (KDV_RATE_CHOICES); the köşk
    // sells nothing at it since 18 Eki 2026, the arithmetic is the same.
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
    // 4000 split 3:1 → 3000 off the 1% line, 1000 off the mug.
    expect(k.rows).toEqual([
      { ratePct: 20, grossMinor: 9000, netMinor: 7500, taxMinor: 1500 },
      { ratePct: 1, grossMinor: 27000, netMinor: 26733, taxMinor: 267 },
    ]);
    expect(k.grossMinor).toBe(36000);
  });

  it("shipping is its own 20% line, not the rate of the goods it carries", () => {
    // 10% food and a 100 TL fee: a 10% row and a 100 TL row at 20%.
    const food = kdvBreakdown({
      lines: [{ grossMinor: 32000, ratePct: 10 }],
      discountMinor: 0,
      shippingMinor: 10000,
    });
    expect(food.rows).toEqual([
      { ratePct: 20, grossMinor: 10000, netMinor: 8333, taxMinor: 1667 },
      { ratePct: 10, grossMinor: 32000, netMinor: 29091, taxMinor: 2909 },
    ]);
    expect(food.grossMinor).toBe(42000);
    // Not the old answer: the fee at the food's 10% (909 kuruş of KDV).
    expect(food.rows[0].taxMinor).not.toBe(kdvOfGross(10000, 10));

    // 20% equipment and the same fee: one 20% row.
    const gear = kdvBreakdown({
      lines: [{ grossMinor: 150000, ratePct: 20 }],
      discountMinor: 0,
      shippingMinor: 10000,
    });
    expect(gear.rows).toEqual([
      { ratePct: 20, grossMinor: 160000, netMinor: 133333, taxMinor: 26667 },
    ]);
  });

  it("the discount is shared over the lines only, never over the fee", () => {
    const k = kdvBreakdown({
      lines: [
        { grossMinor: 30000, ratePct: 10 },
        { grossMinor: 10000, ratePct: 20 },
      ],
      discountMinor: 4000,
      shippingMinor: 4000,
    });
    // 4000 off 3:1, then the whole 4000 fee onto the 20% row.
    expect(k.rows.map((r) => [r.ratePct, r.grossMinor])).toEqual([
      [20, 9000 + 4000],
      [10, 27000],
    ]);
  });

  it("the fee takes the rate it is given", () => {
    const k = kdvBreakdown({
      lines: [{ grossMinor: 32000, ratePct: 10 }],
      discountMinor: 0,
      shippingMinor: 4900,
      shippingRatePct: 10,
    });
    expect(k.rows).toEqual([
      { ratePct: 10, grossMinor: 36900, netMinor: 33545, taxMinor: 3355 },
    ]);
  });

  it("a courier fee still owed after a coupon covered every line stays at its own rate", () => {
    const k = kdvBreakdown({
      lines: [
        { grossMinor: 19500, ratePct: 10 },
        { grossMinor: 8000, ratePct: 10 },
      ],
      discountMinor: 27500,
      shippingMinor: 5500,
    });
    expect(k.rows).toEqual([
      { ratePct: 20, grossMinor: 5500, netMinor: 4583, taxMinor: 917 },
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
        shippingRatePct: rates[rand(rates.length)],
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
  // Coffee beans stamped 10% and a grinder stamped 20%, shipped for 49 TL.
  // No `shippingTaxRatePct`: an order written before the fee's rate was
  // stamped (18 Eki 2026).
  const order: KdvOrderLike = {
    items: [
      { qty: 2, unitPriceMinor: 16000, taxRatePct: 10 },
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
    expect(k.rows.map((r) => r.ratePct)).toEqual([20, 10]);
    // An order from before the fee's rate was stamped: the fee at 20%, on
    // the grinder's row, and none of it on the beans'.
    expect(orderShippingTaxRate(order)).toBe(20);
    expect(k.rows[0].grossMinor).toBe(10000 + 4900);
    expect(k.rows[1].grossMinor).toBe(32000);
  });

  it("splits the fee at the rate stamped on the order", () => {
    const k = orderKdvBreakdown({ ...order, shippingTaxRatePct: 10 })!;
    expect(k.rows.map((r) => [r.ratePct, r.grossMinor])).toEqual([
      [20, 10000],
      [10, 32000 + 4900],
    ]);
    expect(k.grossMinor).toBe(order.totalMinor);
    expect(
      orderKdvBreakdown({ ...order, shippingTaxRatePct: 0 })!.rows.map((r) => [
        r.ratePct,
        r.grossMinor,
      ]),
    ).toEqual([
      [20, 10000],
      [10, 32000],
      [0, 4900],
    ]);
    expect(orderShippingTaxRate({ shippingTaxRatePct: null })).toBe(20);
    expect(orderShippingTaxRate({ shippingTaxRatePct: 150 })).toBe(20);
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
    // A line stamped at a rate no default has today (8%): nothing here can
    // see the panel, the stored line still says 8.
    const k = orderKdvBreakdown({
      ...order,
      items: [
        { qty: 2, unitPriceMinor: 16000, taxRatePct: 8 },
        { qty: 1, unitPriceMinor: 10000, taxRatePct: 20 },
      ],
    })!;
    expect(k.rows.find((r) => r.ratePct === 8)?.grossMinor).toBe(32000);
    expect(k.rows.find((r) => r.ratePct === 10)).toBeUndefined();
  });
});

describe("invoiceKdvBreakdown: a reward coupon pays, it is not a discount", () => {
  // A 150 TL cafe order at 10%.
  const cafe = (discountMinor: number) => ({
    items: [{ qty: 1, unitPriceMinor: 15000, taxRatePct: 10 }],
    subtotalMinor: 15000,
    discountMinor,
    shippingMinor: 0,
    totalMinor: 15000 - discountMinor,
  });

  it("a 120 TL reward coupon: the invoice at 150 TL, the customer's split at 30 TL", () => {
    const order = cafe(12000);
    const reward = invoiceRewardMinor(order, "loyalty");
    expect(reward).toBe(12000);
    expect(invoiceKdvBreakdown(order, reward)!.rows).toEqual([
      { ratePct: 10, grossMinor: 15000, netMinor: 13636, taxMinor: 1364 },
    ]);
    expect(orderKdvBreakdown(order)!.rows).toEqual([
      { ratePct: 10, grossMinor: 3000, netMinor: 2727, taxMinor: 273 },
    ]);
    // The milestone gift and the invite drink are rewards too.
    expect(invoiceRewardMinor(order, "milestone")).toBe(12000);
    expect(invoiceRewardMinor(order, "invite")).toBe(12000);
  });

  it("a 100% gift coupon (HD) covers every line: the invoice at 150 TL, nothing paid", () => {
    const order = cafe(15000);
    const reward = invoiceRewardMinor(order, "manual");
    expect(reward).toBe(15000);
    expect(invoiceKdvBreakdown(order, reward)!.rows).toEqual([
      { ratePct: 10, grossMinor: 15000, netMinor: 13636, taxMinor: 1364 },
    ]);
    expect(orderKdvBreakdown(order)!.rows).toEqual([]);
    // A shared promo code that covers every line is the same.
    expect(invoiceRewardMinor(order, null)).toBe(15000);
  });

  it("a 20% gift coupon is a discount: both splits are the same 120 TL", () => {
    const order = cafe(3000);
    const reward = invoiceRewardMinor(order, "manual");
    expect(reward).toBe(0);
    const invoice = invoiceKdvBreakdown(order, reward)!;
    expect(invoice).toEqual(orderKdvBreakdown(order));
    expect(invoice.grossMinor).toBe(12000);
    for (const source of ["welcome", "birthday", "review", null, undefined]) {
      expect(invoiceRewardMinor(order, source), String(source)).toBe(0);
    }
  });

  it("the reward is never more than the discount, and the fee keeps its own line", () => {
    const order = {
      items: [
        { qty: 1, unitPriceMinor: 19500, taxRatePct: 10 },
        { qty: 1, unitPriceMinor: 8000, taxRatePct: 10 },
      ],
      subtotalMinor: 27500,
      discountMinor: 27500,
      shippingMinor: 5500,
      totalMinor: 5500,
    };
    const invoice = invoiceKdvBreakdown(order, 999999)!;
    expect(invoice.rows).toEqual([
      { ratePct: 20, grossMinor: 5500, netMinor: 4583, taxMinor: 917 },
      { ratePct: 10, grossMinor: 27500, netMinor: 25000, taxMinor: 2500 },
    ]);
    expect(invoice.grossMinor).toBe(order.totalMinor + order.discountMinor);
    expect(invoiceRewardMinor({ discountMinor: 0, subtotalMinor: 0 }, "loyalty")).toBe(0);
  });

  it("is null where the customer's split is null", () => {
    const order = cafe(12000);
    expect(
      invoiceKdvBreakdown({ ...order, items: [{ qty: 1, unitPriceMinor: 15000 }] }, 12000),
    ).toBeNull();
    expect(invoiceKdvBreakdown({ ...order, subtotalMinor: 14000 }, 12000)).toBeNull();
    expect(invoiceKdvBreakdown({ ...order, totalMinor: 2900 }, 12000)).toBeNull();
  });
});
