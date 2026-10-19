import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";
import type { AdminProduct, ProductInput } from "@/lib/admin/store";

/**
 * The store half of X-TGK-SHOP and X-DISCOUNT (19 Oct 2026): the label
 * fields and the dated compare-at price as the product save writes them
 * and the web shop reads them. The store runs on the real query builder
 * with a fake executor, so what is asserted is the SQL that would run.
 */

const seen: { text: string; params: readonly unknown[] }[] = [];
let productRows: Record<string, unknown>[] = [];
let historyRows: Record<string, unknown>[] = [];

const exec: Executor = async ({ text, params }) => {
  seen.push({ text, params });
  if (/count\(\*\)/i.test(text)) return { rows: [{ count: 3 }], rowCount: 1 };
  if (/^SELECT "?(next_seq|raise_counter)"?\(/.test(text)) {
    return { rows: [{ result: 41 }], rowCount: 1 };
  }
  if (/^SELECT "save_product_variants"\(/.test(text)) {
    return {
      rows: [
        { result: { stockBefore: 5, stockAfter: 5, variants: [], moves: 0 } },
      ],
      rowCount: 1,
    };
  }
  if (/FROM "product_price_history"/.test(text)) {
    return { rows: historyRows, rowCount: historyRows.length };
  }
  if (/^UPDATE "products"/.test(text)) {
    return { rows: [{ id: "prd-0008" }], rowCount: 1 };
  }
  if (/^SELECT .* FROM "products"/.test(text) && /"slug" =/.test(text)) {
    return { rows: [], rowCount: 0 };
  }
  if (/^SELECT .* FROM "products"/.test(text)) {
    return { rows: productRows, rowCount: productRows.length };
  }
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

const store = await import("@/lib/admin/store");

const STORED: AdminProduct = {
  id: "prd-0008",
  name: "Bambu Chasen",
  slug: "bambu-chasen",
  sku: "BAMB-00008",
  tag: "Ekipman",
  priceMinor: 99_900,
  compareAtPriceMinor: 0,
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
  taxRatePct: null,
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
};

function input(over: Partial<ProductInput> = {}): ProductInput {
  const { id: _id, updatedAt: _u, ...rest } = STORED;
  return { ...rest, stockAtOpen: 5, ...over } as ProductInput;
}

function updateSql(): { text: string; params: readonly unknown[] } | undefined {
  return seen.find((q) => /^UPDATE "products"/.test(q.text));
}

/** The value an UPDATE binds to a column. */
function boundTo(
  q: { text: string; params: readonly unknown[] },
  column: string,
) {
  const m = new RegExp(`"${column}" = \\$(\\d+)`).exec(q.text);
  return m ? q.params[Number(m[1]) - 1] : undefined;
}

beforeEach(() => {
  seen.length = 0;
  productRows = [{ ...STORED }];
  historyRows = [{ priceMinor: 99_900, startedAt: "2026-09-01T09:00:00.000Z" }];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T12:00:00.000Z"));
});

describe("updateProduct: the compare-at price is checked before any write", () => {
  it("refuses one above the ten-day lowest and writes nothing", async () => {
    const saved = await store.updateProduct(
      "prd-0008",
      input({
        priceMinor: 75_000,
        compareAtPriceMinor: 120_000,
        discountStartsOn: "2026-10-19",
        discountEndsOn: "2026-10-31",
      }),
    );
    expect(
      saved && "discountRefusal" in saved && saved.discountRefusal.field,
    ).toBe("compareAtPrice");
    expect(seen.some((q) => /FROM "product_price_history"/.test(q.text))).toBe(
      true,
    );
    expect(updateSql()).toBeUndefined();
    expect(
      seen.some((q) => q.text.startsWith('SELECT "save_product_variants"(')),
    ).toBe(false);
  });

  it("writes the days as instants once the history allows the price", async () => {
    const saved = await store.updateProduct(
      "prd-0008",
      input({
        priceMinor: 75_000,
        compareAtPriceMinor: 99_900,
        discountStartsOn: "2026-10-19",
        discountEndsOn: "2026-10-31",
      }),
    );
    expect(saved && "discountRefusal" in saved).toBe(false);
    const q = updateSql()!;
    expect(boundTo(q, "compareAtPriceMinor")).toBe(99_900);
    expect(boundTo(q, "discountStartsAt")).toBe("2026-10-18T21:00:00.000Z");
    expect(boundTo(q, "discountEndsAt")).toBe("2026-10-31T20:59:59.999Z");
  });

  it("clears the days with the compare-at price, without reading the history", async () => {
    await store.updateProduct("prd-0008", input({ compareAtPriceMinor: 0 }));
    expect(seen.some((q) => /FROM "product_price_history"/.test(q.text))).toBe(
      false,
    );
    const q = updateSql()!;
    expect(boundTo(q, "discountStartsAt")).toBeNull();
    expect(boundTo(q, "discountEndsAt")).toBeNull();
  });
});

describe("updateProduct: the label fields", () => {
  it("writes the fields the form sent, tidied, and keeps the absent ones", async () => {
    await store.updateProduct(
      "prd-0008",
      input({
        ingredients: "  Matcha  tozu\r\n\r\n%100  ",
        netQuantity: "30 g",
        allergens: ["sut", "gluten", "sut"] as never,
      }),
    );
    const q = updateSql()!;
    expect(boundTo(q, "ingredients")).toBe("Matcha tozu\n%100");
    expect(boundTo(q, "netQuantity")).toBe("30 g");
    expect(JSON.parse(String(boundTo(q, "allergens")))).toEqual([
      "gluten",
      "sut",
    ]);
    // Not sent: not written, so an older form keeps what is stored.
    expect(q.text).not.toMatch(/"nutrition" =/);
    expect(q.text).not.toMatch(/"producer" =/);
  });

  it("leaves the allergens alone when the form had no boxes", async () => {
    await store.updateProduct("prd-0008", input());
    expect(updateSql()!.text).not.toMatch(/"allergens" =/);
  });
});

describe("createProduct", () => {
  it("starts with no compare-at price, no label and the groups not entered", async () => {
    const created = await store.createProduct(
      input({
        compareAtPriceMinor: 99_900,
        discountStartsOn: "2026-10-19",
        discountEndsOn: "2026-10-31",
        netQuantity: " 250 g ",
      }),
    );
    expect(created).toMatchObject({
      compareAtPriceMinor: 0,
      discountStartsAt: null,
      discountEndsAt: null,
      allergens: null,
      netQuantity: "250 g",
      ingredients: "",
    });
    expect(created).not.toHaveProperty("discountStartsOn");
  });
});

describe("the web shop reads the same rules (toDesignProduct)", () => {
  const dated = {
    priceMinor: 75_000,
    compareAtPriceMinor: 99_900,
    discountStartsAt: "2026-10-18T21:00:00.000Z",
    discountEndsAt: "2026-10-31T20:59:59.999Z",
  };

  it("shows a compare-at price only between its days, with them", () => {
    const during = store.toDesignProduct(
      { ...STORED, ...dated },
      new Date("2026-10-20T09:00:00.000Z"),
    );
    expect(during).toMatchObject({
      compareAtPrice: "999₺",
      compareAtPriceMinor: 99_900,
      discountStartsAt: dated.discountStartsAt,
      discountEndsAt: dated.discountEndsAt,
    });
    for (const at of ["2026-10-18T20:00:00.000Z", "2026-11-01T09:00:00.000Z"]) {
      const out = store.toDesignProduct({ ...STORED, ...dated }, new Date(at));
      expect(out.compareAtPrice).toBeUndefined();
      expect(out.compareAtPriceMinor).toBeUndefined();
      expect(out).not.toHaveProperty("discountStartsAt");
    }
    // Dateless, as the chasen stood on 18 Oct.
    const dateless = store.toDesignProduct({
      ...STORED,
      priceMinor: 75_000,
      compareAtPriceMinor: 99_900,
    });
    expect(dateless.compareAtPrice).toBeUndefined();
  });

  it("passes the label, the allergens, the brand and the notes that are entered", () => {
    const out = store.toDesignProduct({
      ...STORED,
      cat: "pantry",
      brand: " Sirena ",
      notes: ["Kakao", " "],
      ingredients: "Un, şeker",
      netQuantity: "",
      allergens: [],
    });
    expect(out).toMatchObject({
      brand: "Sirena",
      notes: ["Kakao"],
      ingredients: "Un, şeker",
      allergens: [],
    });
    expect(out).not.toHaveProperty("netQuantity");
    // A row from before the migration has none of the keys.
    const old = store.toDesignProduct(STORED);
    expect(old).not.toHaveProperty("allergens");
    expect(old).not.toHaveProperty("ingredients");
  });
});

describe("the five places a product field lives (CLAUDE.md)", () => {
  it("store type, seed, ProductInput, schema and wizard all carry the new fields", () => {
    const storeSrc = readFileSync("src/lib/admin/store.ts", "utf8");
    expect(storeSrc).toMatch(
      /interface AdminProduct extends BackdropColumns, ProductFoodLabel/,
    );
    expect(storeSrc).toMatch(
      /interface ProductInput extends BackdropColumns, ProductFoodLabel/,
    );
    expect(storeSrc).toContain("discountStartsOn?: string | null;");
    // The seed: nothing guessed.
    expect(storeSrc).toMatch(
      /allergens: null,\s+\.\.\.EMPTY_FOOD_LABEL,\s+discountStartsAt: null,/,
    );
    const schema = readFileSync("src/lib/admin/product-schema.ts", "utf8");
    expect(schema).toContain("...foodLabelShape,");
    expect(schema).toContain("discountStartsOn: discountDay,");
    const wizard = readFileSync(
      "src/components/admin/product-wizard.tsx",
      "utf8",
    );
    expect(wizard).toContain("FOOD_LABEL_FIELDS.map((f) => (");
    expect(wizard).toContain("name={DISCOUNT_START_FIELD}");
    expect(wizard).toContain("name={DISCOUNT_END_FIELD}");
  });
});
