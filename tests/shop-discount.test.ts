import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { AdminProduct } from "@/lib/admin/store";

import { productFormSchema } from "@/lib/admin/product-schema";
import {
  planProductImport,
  COMPARE_AT_CSV_ERROR,
  compareAtPriceFloorError,
} from "@/lib/admin/product-import";
import { toMobileShopProduct } from "@/lib/mobile/menu-mapper";
import {
  DISCOUNT_DATES_REQUIRED_ERROR,
  DISCOUNT_END_BEFORE_START_ERROR,
  DISCOUNT_NOT_ABOVE_ERROR,
  DISCOUNT_START_FUTURE_ERROR,
  DISCOUNT_START_PAST_ERROR,
  DISCOUNT_VARIANTS_ERROR,
  discountInstants,
  discountNotice,
  discountRefusal,
  discountShortLabel,
  earliestStartDay,
  liveCompareAtMinor,
  lowestPriceIn,
  type DiscountCheck,
} from "@/lib/shop/discount";

/**
 * X-DISCOUNT, decision OP-COMPARE-AT (19 Oct 2026): a discount names the
 * price before it and its first and last day (Ticari Reklam Yön. m.14/1);
 * that price is the lowest one applied in the ten days before the start
 * (m.14/3), in the online channel's own history (m.14/5). The panel took
 * any "Eski fiyat", with no date and no record, and the page, the shop and
 * the app showed it as "%25 indirim" with no end.
 */

// 19 Oct 2026, 15:00 in Tuzla.
const NOW = new Date("2026-10-19T12:00:00.000Z");

/** The 750 TL chasen, 999 TL until the morning of 14 Oct. */
const HISTORY = [
  { priceMinor: 99_900, startedAt: "2026-09-01T09:00:00.000Z" },
  { priceMinor: 75_000, startedAt: "2026-10-19T11:59:00.000Z" },
];

function check(over: Partial<DiscountCheck> = {}): DiscountCheck {
  return {
    priceMinor: 75_000,
    compareAtPriceMinor: 99_900,
    startDay: "2026-10-19",
    endDay: "2026-10-31",
    hasPricedVariants: false,
    history: HISTORY,
    stored: {
      compareAtPriceMinor: 0,
      discountStartsAt: null,
      discountEndsAt: null,
    },
    now: NOW,
    ...over,
  };
}

describe("the save: a compare-at price is the lowest of the ten days before", () => {
  it("takes the lowest price of the ten Istanbul days before the start", () => {
    expect(discountRefusal(check())).toBeNull();
  });

  it("refuses a compare-at price without both days", () => {
    expect(discountRefusal(check({ startDay: null }))).toEqual({
      field: "discountStartsOn",
      message: DISCOUNT_DATES_REQUIRED_ERROR,
    });
    expect(discountRefusal(check({ endDay: null }))).toEqual({
      field: "discountEndsOn",
      message: DISCOUNT_DATES_REQUIRED_ERROR,
    });
    expect(discountRefusal(check({ endDay: "2026-10-18" }))?.message).toBe(
      DISCOUNT_END_BEFORE_START_ERROR,
    );
    expect(discountRefusal(check({ startDay: "2026-02-30" }))?.field).toBe(
      "discountStartsOn",
    );
  });

  it("refuses a price higher than the lowest, and names the amount", () => {
    // 1.200 TL for a day on 12 Oct: the lowest of the ten days is 999 TL.
    const inflated = [
      { priceMinor: 99_900, startedAt: "2026-09-01T09:00:00.000Z" },
      { priceMinor: 120_000, startedAt: "2026-10-12T09:00:00.000Z" },
      { priceMinor: 75_000, startedAt: "2026-10-19T11:59:00.000Z" },
    ];
    const refused = discountRefusal(
      check({ compareAtPriceMinor: 120_000, history: inflated }),
    );
    expect(refused?.field).toBe("compareAtPrice");
    expect(refused?.message).toContain("999₺");
    expect(discountRefusal(check({ history: inflated }))).toBeNull();
  });

  it("counts a lower price set inside the ten days", () => {
    // 690 TL on 15 Oct for two days: nothing above it may be the old price.
    const dipped = [
      { priceMinor: 99_900, startedAt: "2026-09-01T09:00:00.000Z" },
      { priceMinor: 69_000, startedAt: "2026-10-15T09:00:00.000Z" },
      { priceMinor: 99_900, startedAt: "2026-10-17T09:00:00.000Z" },
    ];
    const refused = discountRefusal(check({ history: dipped }));
    expect(refused?.message).toContain("690₺");
    expect(refused?.message).toContain("indirim gösterilemez");
  });

  it("refuses when the history does not reach ten days back, and says from when", () => {
    const young = [
      { priceMinor: 99_900, startedAt: "2026-10-12T10:00:00.000Z" },
    ];
    const refused = discountRefusal(check({ history: young }));
    expect(refused?.field).toBe("compareAtPrice");
    // From 12 Oct 13:00 in Tuzla: the 23rd is the first start whose ten
    // days are all recorded.
    expect(refused?.message).toContain("23 Ekim 2026");
    expect(earliestStartDay("2026-10-12T10:00:00.000Z")).toBe("2026-10-23");
    expect(earliestStartDay("2026-10-12T21:00:00.000Z")).toBe("2026-10-23");
    expect(discountRefusal(check({ history: [] }))?.message).toContain(
      "fiyat kaydı yok",
    );
  });

  it("starts a new discount today: not earlier, not later", () => {
    expect(discountRefusal(check({ startDay: "2026-10-18" }))?.message).toBe(
      DISCOUNT_START_PAST_ERROR,
    );
    expect(discountRefusal(check({ startDay: "2026-10-25" }))?.message).toBe(
      DISCOUNT_START_FUTURE_ERROR,
    );
    // 00:30 in Tuzla is already the 20th, though the server says the 19th.
    const lateNight = new Date("2026-10-19T21:30:00.000Z");
    expect(
      discountRefusal(check({ startDay: "2026-10-19", now: lateNight }))
        ?.message,
    ).toBe(DISCOUNT_START_PAST_ERROR);
  });

  it("lets a running discount be saved again with its own start", () => {
    const stored = {
      compareAtPriceMinor: 99_900,
      ...discountInstants(99_900, "2026-10-14", "2026-10-31"),
    };
    const history = [
      { priceMinor: 99_900, startedAt: "2026-09-01T09:00:00.000Z" },
      { priceMinor: 75_000, startedAt: "2026-10-14T08:00:00.000Z" },
    ];
    expect(
      discountRefusal(check({ startDay: "2026-10-14", stored, history })),
    ).toBeNull();
    // Moving its start is a new discount.
    expect(
      discountRefusal(check({ startDay: "2026-10-13", stored, history }))
        ?.message,
    ).toBe(DISCOUNT_START_PAST_ERROR);
    // Once it is over, the same days are a new discount too.
    const over = {
      compareAtPriceMinor: 99_900,
      ...discountInstants(99_900, "2026-10-01", "2026-10-10"),
    };
    expect(
      discountRefusal(
        check({ startDay: "2026-10-01", endDay: "2026-10-31", stored: over }),
      )?.message,
    ).toBe(DISCOUNT_START_PAST_ERROR);
  });

  it("refuses a compare-at price not above the price, and beside priced variants", () => {
    expect(
      discountRefusal(check({ compareAtPriceMinor: 75_000 }))?.message,
    ).toBe(DISCOUNT_NOT_ABOVE_ERROR);
    expect(discountRefusal(check({ hasPricedVariants: true }))?.message).toBe(
      DISCOUNT_VARIANTS_ERROR,
    );
  });

  it("asks nothing of a product without a compare-at price", () => {
    expect(
      discountRefusal(
        check({
          compareAtPriceMinor: 0,
          startDay: null,
          endDay: null,
          history: [],
        }),
      ),
    ).toBeNull();
  });

  it("reads the window as [start - 10 days, start)", () => {
    const from = "2026-10-08T21:00:00.000Z";
    const to = "2026-10-18T21:00:00.000Z";
    expect(lowestPriceIn(HISTORY, from, to)).toEqual({
      ok: true,
      lowestMinor: 99_900,
    });
    // A price set exactly at the start is not inside the window.
    expect(
      lowestPriceIn([...HISTORY, { priceMinor: 1, startedAt: to }], from, to),
    ).toEqual({ ok: true, lowestMinor: 99_900 });
  });

  it("stores the start at 00:00 and the end at the last millisecond of its Istanbul day", () => {
    expect(discountInstants(99_900, "2026-10-19", "2026-10-31")).toEqual({
      discountStartsAt: "2026-10-18T21:00:00.000Z",
      discountEndsAt: "2026-10-31T20:59:59.999Z",
    });
    expect(discountInstants(0, "2026-10-19", "2026-10-31")).toEqual({
      discountStartsAt: null,
      discountEndsAt: null,
    });
  });
});

describe("the form: a compare-at price comes with its days", () => {
  const base = {
    name: "Bambu Chasen",
    tag: "Ekipman",
    desc: "80 dişli.",
    cat: "gear",
    price: "750",
  };

  it("refuses a compare-at price without days, under the date field", () => {
    const r = productFormSchema.safeParse({ ...base, compareAtPrice: "999" });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(
      r.error.issues.find((i) => i.path[0] === "discountStartsOn")?.message,
    ).toBe(DISCOUNT_DATES_REQUIRED_ERROR);
  });

  it("passes the days on, and drops them with an emptied compare-at price", () => {
    const dated = productFormSchema.parse({
      ...base,
      compareAtPrice: "999",
      discountStartsOn: "2026-10-19",
      discountEndsOn: "2026-10-31",
    });
    expect(dated).toMatchObject({
      compareAtPriceMinor: 99_900,
      discountStartsOn: "2026-10-19",
      discountEndsOn: "2026-10-31",
    });
    const cleared = productFormSchema.parse({
      ...base,
      compareAtPrice: "",
      discountStartsOn: "2026-10-19",
      discountEndsOn: "2026-10-31",
    });
    expect(cleared).toMatchObject({
      compareAtPriceMinor: 0,
      discountStartsOn: null,
      discountEndsOn: null,
    });
  });
});

function product(over: Partial<AdminProduct> = {}): AdminProduct {
  return {
    id: "prd-0008",
    name: "Bambu Chasen",
    slug: "bambu-chasen",
    sku: "BAMB-00008",
    tag: "Ekipman",
    priceMinor: 75_000,
    compareAtPriceMinor: 99_900,
    costMinor: 0,
    desc: "80 dişli.",
    cat: "gear",
    img: "matcha",
    images: [],
    tags: [],
    brand: "",
    notes: [],
    stock: 5,
    lowStockThreshold: 2,
    weightGrams: 0,
    featured: false,
    isNew: false,
    isActive: true,
    seoTitle: "",
    seoDescription: "",
    variants: [],
    updatedAt: "2026-10-01T10:00:00.000Z",
    backdrop: null,
    backdropSource: "auto",
    backdropHex: null,
    photoCutout: false,
    vessel: null,
    ...over,
  };
}

const DATED = discountInstants(99_900, "2026-10-19", "2026-10-31");

describe("every surface shows a compare-at price only between its days", () => {
  it("the shared rule", () => {
    const p = product(DATED);
    expect(liveCompareAtMinor(p, new Date("2026-10-18T20:59:59.999Z"))).toBe(0);
    expect(liveCompareAtMinor(p, new Date("2026-10-18T21:00:00.000Z"))).toBe(
      99_900,
    );
    expect(liveCompareAtMinor(p, new Date("2026-10-31T20:59:59.999Z"))).toBe(
      99_900,
    );
    expect(liveCompareAtMinor(p, new Date("2026-10-31T21:00:00.000Z"))).toBe(0);
    // The chasen as it stood on 18 Oct: 999 TL with no date.
    expect(liveCompareAtMinor(product(), NOW)).toBe(0);
    expect(
      liveCompareAtMinor(product({ ...DATED, priceMinor: 99_900 }), NOW),
    ).toBe(0);
  });

  it("the app: 0 and null outside the days, the number never dropped", () => {
    const dateless = toMobileShopProduct(
      product(),
      "https://laffogato.net",
      undefined,
      NOW,
    );
    expect(dateless).toMatchObject({
      compareAtPriceMinor: 0,
      discountStartsAt: null,
      discountEndsAt: null,
    });
    const after = toMobileShopProduct(
      product(DATED),
      "https://laffogato.net",
      undefined,
      new Date("2026-11-01T09:00:00.000Z"),
    );
    expect(after.compareAtPriceMinor).toBe(0);
    expect(after.discountEndsAt).toBeNull();
    const during = toMobileShopProduct(
      product(DATED),
      "https://laffogato.net",
      undefined,
      NOW,
    );
    expect(during).toMatchObject({
      compareAtPriceMinor: 99_900,
      discountStartsAt: "2026-10-18T21:00:00.000Z",
      discountEndsAt: "2026-10-31T20:59:59.999Z",
    });
  });

  it("the sentence beside the badge names both days", () => {
    expect(discountNotice(DATED.discountStartsAt, DATED.discountEndsAt)).toBe(
      "İndirim 19 Ekim 2026 - 31 Ekim 2026 tarihleri arasında geçerli",
    );
    expect(
      discountShortLabel(DATED.discountStartsAt, DATED.discountEndsAt),
    ).toBe("İndirim 19 Eki - 31 Eki");
    expect(discountNotice(null, DATED.discountEndsAt)).toBeNull();
  });
});

describe("the CSV import cannot start a discount", () => {
  const view = {
    id: "prd-0008",
    name: "Bambu Chasen",
    slug: "bambu-chasen",
    sku: "BAMB-00008",
    tag: "Ekipman",
    desc: "80 dişli.",
    cat: "gear" as const,
    img: "matcha",
    priceMinor: 75_000,
    compareAtPriceMinor: 99_900,
    stock: 5,
    taxRatePct: null,
    isActive: true,
    brand: "",
    weightGrams: 0,
    variants: [],
  };
  const ctx = {
    products: [view],
    categories: [
      {
        id: "c",
        slug: "gear" as const,
        label: "Ekipman",
        icon: "",
        sortOrder: 0,
      },
    ],
  };
  const file = (cell: string) => `sku;compareAtPrice\nBAMB-00008;${cell}\n`;

  it("refuses a new compare-at price, for a stored and for a new product", () => {
    const row = planProductImport(file("1.100"), ctx);
    expect(row.ok && row.rows[0].view).toMatchObject({
      status: "error",
      messages: [COMPARE_AT_CSV_ERROR],
    });
    const created = planProductImport(
      "sku;name;category;price;compareAtPrice;description\nN-1;Fincan;gear;450;600;Porselen.\n",
      ctx,
    );
    expect(created.ok && created.rows[0].view.messages).toEqual([
      COMPARE_AT_CSV_ERROR,
    ]);
  });

  it("keeps the stored value written back, and ends the discount with its days", () => {
    const same = planProductImport(file("999"), ctx);
    expect(same.ok && same.rows[0].view.status).toBe("unchanged");
    for (const cell of ["", "0"]) {
      const cleared = planProductImport(file(cell), ctx);
      const action = cleared.ok ? cleared.rows[0].action : null;
      expect(action?.kind === "update" && action.patch).toEqual({
        compareAtPriceMinor: 0,
        discountStartsAt: null,
        discountEndsAt: null,
      });
    }
  });

  it("keeps the price under a stored compare-at unless the row ends the discount", () => {
    // A price lifted over the was-price and lowered again later would bring
    // the old badge and start day back without the ten-day check (the form
    // refuses the lift with DISCOUNT_NOT_ABOVE_ERROR).
    const patchOf = (text: string) => {
      const p = planProductImport(text, ctx);
      const action = p.ok ? p.rows[0].action : null;
      return action?.kind === "update" ? action.patch : null;
    };
    for (const text of [
      "sku;price\nBAMB-00008;1.100\n",
      "sku;price\nBAMB-00008;999\n",
      "sku;price;compareAtPrice\nBAMB-00008;1.100;999\n",
    ]) {
      const p = planProductImport(text, ctx);
      expect(p.ok && p.rows[0].view, text).toMatchObject({
        status: "error",
        messages: [compareAtPriceFloorError(99_900)],
      });
      expect(p.ok && p.rows[0].action, text).toBeNull();
    }
    // Under it the discount runs on, as a form save would.
    expect(patchOf("sku;price\nBAMB-00008;900\n")).toEqual({
      priceMinor: 90_000,
    });
    // Emptying the cell in the same row ends the discount with its days.
    for (const cell of ["", "0"]) {
      expect(
        patchOf(`sku;price;compareAtPrice\nBAMB-00008;1.100;${cell}\n`),
      ).toEqual({
        priceMinor: 110_000,
        compareAtPriceMinor: 0,
        discountStartsAt: null,
        discountEndsAt: null,
      });
    }
    // A product without one is not held back.
    const plain = planProductImport("sku;price\nBAMB-00008;1.100\n", {
      ...ctx,
      products: [{ ...view, compareAtPriceMinor: 0 }],
    });
    const plainAction = plain.ok ? plain.rows[0].action : null;
    expect(plainAction?.kind === "update" && plainAction.patch).toEqual({
      priceMinor: 110_000,
    });
  });
});

describe("the price history", () => {
  const sql = readFileSync(
    "db/migrations/20261019170100_product_price_history.sql",
    "utf8",
  );

  it("is written by a trigger on every price, so no path can skip it", () => {
    expect(sql).toContain(
      "create table if not exists public.product_price_history",
    );
    expect(sql).toMatch(
      /after insert or update of "priceMinor" on public\.products/,
    );
    expect(sql).toContain('new."priceMinor" is distinct from old."priceMinor"');
    // Re-runnable: one backfill row per product, never two.
    expect(sql).toMatch(
      /where not exists \(\s*select 1 from public\.product_price_history/,
    );
  });

  it("clears every compare-at price stored without days", () => {
    expect(sql).toMatch(
      /set "compareAtPriceMinor" = 0\s+where "compareAtPriceMinor" <> 0\s+and \("discountStartsAt" is null or "discountEndsAt" is null\)/,
    );
  });

  it("is in the bundle the app applies", () => {
    const bundle = readFileSync("db/schema.sql", "utf8");
    expect(bundle).toContain("20261019170100_product_price_history");
    expect(bundle).toContain("20261019170000_product_food_label");
  });

  it("adds no long dash", () => {
    for (const file of [
      "src/lib/shop/discount.ts",
      "db/migrations/20261019170100_product_price_history.sql",
    ]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/[\u2013\u2014]/);
    }
  });
});
