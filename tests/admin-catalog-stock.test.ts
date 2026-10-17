import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";
import type {
  AdminCategory,
  AdminProduct,
  ProductInput,
} from "@/lib/admin/store";

/**
 * Product and variant stock, admin audit package 5a step 4 (CAT-03, CAT-14,
 * decision D16).
 *
 * - CAT-03: the product form wrote the stock it read when it was opened, so
 *   an order taken while it was open was undone on save, with no stock move.
 *   Now the save moves stock by what was typed since the form opened, in
 *   SQL (save_product_variants), and price, variants and stock stay as
 *   stored when that change is refused.
 * - CAT-14: a product with variants started at a total of 0 beside stocked
 *   variants (it read "Stoksuz" and failed at the claim), the order check
 *   read the variant alone while the claim needs both, and no screen could
 *   correct a variant.
 *
 * The store runs on the real query builder with a fake executor, so what is
 * asserted is the SQL that would run. The SQL functions themselves are
 * covered against a real Postgres in tests/db-integration-variant-stock.
 */

const seen: { text: string; params: readonly unknown[] }[] = [];
let productRows: Record<string, unknown>[] = [];
let rpcAnswer: unknown = null;

const exec: Executor = async ({ text, params }) => {
  seen.push({ text, params });
  if (/count\(\*\)/i.test(text)) return { rows: [{ count: 3 }], rowCount: 1 };
  if (/^SELECT "?(next_seq|raise_counter)"?\(/.test(text)) {
    return { rows: [{ result: 41 }], rowCount: 1 };
  }
  if (/^SELECT "?\w+"?\(/.test(text)) {
    return { rows: [{ result: rpcAnswer }], rowCount: 1 };
  }
  if (/^UPDATE "products"/.test(text)) {
    return { rows: [{ id: "prd-0007" }], rowCount: 1 };
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
const { variantStockTotal, splitStockTarget } = await import(
  "@/lib/admin/stock-delta"
);
const { productFormSchema, parseStockSnapshot } = await import(
  "@/lib/admin/product-schema"
);

const STORED: AdminProduct = {
  id: "prd-0007",
  name: "Sirena Espresso",
  slug: "sirena-espresso",
  sku: "SIRE-00007",
  tag: "Çekirdek",
  priceMinor: 32_000,
  compareAtPriceMinor: 0,
  costMinor: 0,
  desc: "Espresso harmanı",
  cat: "beans",
  img: "caramel",
  images: [],
  tags: [],
  brand: "",
  notes: [],
  stock: 4,
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
  return { ...rest, ...over } as ProductInput;
}

function updates(): string[] {
  return seen.map((q) => q.text).filter((t) => /^UPDATE "products"/.test(t));
}

function rpcCall(fn: string): Record<string, unknown> | null {
  const q = seen.find((s) => s.text.startsWith(`SELECT "${fn}"(`));
  if (!q) return null;
  const names = [...q.text.matchAll(/"(p_\w+)" => \$(\d+)/g)];
  const out: Record<string, unknown> = {};
  for (const [, name, idx] of names) {
    const raw = q.params[Number(idx) - 1];
    out[name] = typeof raw === "string" && /^[[{]/.test(raw) ? JSON.parse(raw) : raw;
  }
  return out;
}

const SAVED = {
  stockBefore: 4,
  stockAfter: 4,
  variants: [],
  moves: 0,
};

beforeEach(() => {
  seen.length = 0;
  productRows = [{ ...STORED }];
  rpcAnswer = SAVED;
});

describe("CAT-03: the product form moves stock by the change since it opened", () => {
  it("an unchanged form writes no stock, variant stock or price outside the SQL function", async () => {
    const saved = await store.updateProduct("prd-0007", input({ stockAtOpen: 4 }));
    expect(saved).toMatchObject({ id: "prd-0007", stock: 4 });
    const [sql] = updates();
    expect(sql).toBeDefined();
    // The old save wrote the whole row back: the stock it read at open over
    // every order taken since.
    expect(sql).not.toMatch(/"stock" =/);
    expect(sql).not.toMatch(/"variants" =/);
    expect(sql).not.toMatch(/"priceMinor" =/);
    expect(sql).toMatch(/"name" =/);
    expect(rpcCall("save_product_variants")).toMatchObject({
      p_product_id: "prd-0007",
      p_price_minor: 32_000,
      p_variants: [],
      p_stock_delta: 0,
    });
  });

  it("a changed stock moves by the delta, noted as the product form, by the operator", async () => {
    rpcAnswer = { ...SAVED, stockAfter: 7 };
    const saved = await store.updateProduct(
      "prd-0007",
      input({ stock: 9, stockAtOpen: 4 }),
      { actor: "stok@laffogato.net" },
    );
    expect(rpcCall("save_product_variants")).toMatchObject({
      p_stock_delta: 5,
      p_note: "Ürün formu",
      p_actor: "stok@laffogato.net",
    });
    // What the database holds after the change, not what was typed: two
    // units sold while the form was open stay sold.
    expect(saved).toMatchObject({ stock: 7 });
  });

  it("the other fields are written before the stock, so a retry cannot apply it twice", async () => {
    await store.updateProduct("prd-0007", input({ stock: 9, stockAtOpen: 4 }));
    const u = seen.findIndex((q) => /^UPDATE "products"/.test(q.text));
    const r = seen.findIndex((q) => q.text.startsWith('SELECT "save_product_variants"('));
    expect(u).toBeGreaterThanOrEqual(0);
    expect(r).toBeGreaterThan(u);
  });

  it("a variant moves by its own change; a new row starts at what was typed", async () => {
    await store.updateProduct(
      "prd-0007",
      input({
        stock: 0,
        stockAtOpen: 4,
        variants: [
          { id: "var-1", name: "250 g", priceDeltaMinor: 0, stock: 10, sku: "", isActive: true, stockAtOpen: 6 },
          { id: "var-9", name: "1 kg", priceDeltaMinor: 50_000, stock: 3, sku: "", isActive: true, stockAtOpen: null },
        ],
      }),
    );
    const args = rpcCall("save_product_variants")!;
    expect(args.p_variants).toEqual([
      { id: "var-1", name: "250 g", priceDeltaMinor: 0, sku: "", isActive: true, stockDelta: 4, initialStock: 10 },
      { id: "var-9", name: "1 kg", priceDeltaMinor: 50_000, sku: "", isActive: true, stockDelta: 0, initialStock: 3 },
    ]);
    // With variants the product's own count is not moved by the form.
    expect(args.p_stock_delta).toBe(0);
  });

  it("a form without snapshots (opened before this change) moves no stock", async () => {
    await store.updateProduct(
      "prd-0007",
      input({
        stock: 50,
        variants: [],
      }),
    );
    expect(rpcCall("save_product_variants")).toMatchObject({ p_stock_delta: 0 });
  });

  it("a change that would go below zero comes back with the stored counts", async () => {
    rpcAnswer = { error: "negative", stock: 2, variants: [] };
    const saved = await store.updateProduct(
      "prd-0007",
      input({ stock: 0, stockAtOpen: 4 }),
    );
    expect(saved).toEqual({
      refusal: {
        field: "stock",
        message: "Bu arada satış oldu, stok şu an 2 adet. Adedi kontrol edip yeniden kaydet.",
        stockNow: { stock: 2, variants: {} },
      },
    });
  });

  it("names the variant whose change would go below zero", async () => {
    rpcAnswer = {
      error: "negative",
      variant: "250 g",
      variantId: "var-1",
      stock: 3,
      variants: [{ id: "var-1", name: "250 g", stock: 1, isActive: true }],
    };
    const saved = await store.updateProduct(
      "prd-0007",
      input({
        variants: [
          { id: "var-1", name: "250 g", priceDeltaMinor: 0, stock: 0, sku: "", isActive: true, stockAtOpen: 4 },
        ],
      }),
    );
    expect(saved).toMatchObject({
      refusal: {
        field: "variants",
        message: expect.stringContaining('"250 g" stoğu bu arada değişti, şu an 1 adet'),
        stockNow: { stock: 3, variants: { "var-1": 1 } },
      },
    });
  });

  it("answers null when the row went during the save", async () => {
    rpcAnswer = { error: "product" };
    expect(await store.updateProduct("prd-0007", input())).toBeNull();
  });
});

describe("CAT-14: product and variant stock in step", () => {
  it("a new product with variants takes the sum of its active variants as its total", async () => {
    await store.createProduct({
      ...input({
        stock: 0,
        variants: [
          { id: "var-1", name: "250 g", priceDeltaMinor: 0, stock: 6, sku: "", isActive: true, stockAtOpen: null },
          { id: "var-2", name: "1 kg", priceDeltaMinor: 50_000, stock: 4, sku: "", isActive: true, stockAtOpen: null },
          { id: "var-3", name: "Eski", priceDeltaMinor: 0, stock: 9, sku: "", isActive: false, stockAtOpen: null },
        ],
      }),
    });
    const insert = seen.find((q) => /^INSERT INTO "products"/.test(q.text))!;
    const cols = /\(([^)]*)\) VALUES/.exec(insert.text)![1].split(", ");
    const at = (c: string) => insert.params[cols.indexOf(`"${c}"`)];
    expect(at("stock")).toBe(10);
    // The form's snapshot is not a column.
    expect(cols).not.toContain('"stockAtOpen"');
    expect(String(at("variants"))).not.toContain("stockAtOpen");
  });

  it("the order check needs the product's total as well as the variant's stock, as the claim does", async () => {
    productRows = [
      {
        ...STORED,
        stock: 0,
        variants: [
          { id: "var-1", name: "250 g", priceDeltaMinor: 0, stock: 5, sku: "", isActive: true },
        ],
      },
    ];
    const res = await store.previewAppOrderLines(
      [{ productId: "prd-0007", variantId: "var-1", qty: 1 }],
      { menu: 10, karaoke: 20, beans: 1, pantry: 1, gift: 20, gear: 20, merch: 20 },
    );
    expect(res).toMatchObject({
      ok: false,
      result: {
        reason: "out_of_stock",
        productName: "Sirena Espresso · 250 g",
        available: 0,
      },
    });
  });

  it("a product with variants is not adjusted as a whole", async () => {
    rpcAnswer = -3;
    const res = await store.adjustStock({
      productId: "prd-0007",
      delta: 2,
      note: "Sayım",
      actor: "stok@laffogato.net",
    });
    expect(res).toEqual({ ok: false, error: store.VARIANT_PRODUCT_STOCK_ERROR });
  });

  it("a variant is adjusted in SQL, with the note and the operator", async () => {
    rpcAnswer = {
      variantStock: 8,
      stock: 12,
      stockBefore: 10,
      variantName: "250 g",
      productName: "Sirena Espresso",
      active: true,
      moveId: "mov-000041",
    };
    const res = await store.adjustVariantStock({
      productId: "prd-0007",
      variantId: "var-1",
      delta: 2,
      note: " Sayım fazlası ",
      actor: "stok@laffogato.net",
    });
    expect(res).toEqual({
      ok: true,
      label: "Sirena Espresso · 250 g",
      variantStock: 8,
      stock: 12,
    });
    expect(rpcCall("adjust_variant_stock")).toMatchObject({
      p_product_id: "prd-0007",
      p_variant_id: "var-1",
      p_delta: 2,
      p_note: "Sayım fazlası",
      p_actor: "stok@laffogato.net",
    });
  });

  it.each([
    [{ error: "product" }, "Ürün bulunamadı."],
    [{ error: "variant" }, "Varyant bulunamadı; sayfayı yenile."],
    [{ error: "negative", variantStock: 1 }, "Stok eksiye düşemez (mevcut: 1)."],
  ])("a refused variant adjustment answers %j", async (answer, error) => {
    rpcAnswer = answer;
    expect(
      await store.adjustVariantStock({
        productId: "prd-0007",
        variantId: "var-1",
        delta: -3,
        note: "Hasar",
        actor: "x",
      }),
    ).toEqual({ ok: false, error });
  });

  it("refuses a zero or fractional variant change without asking the database", async () => {
    for (const delta of [0, 1.5]) {
      seen.length = 0;
      const res = await store.adjustVariantStock({
        productId: "prd-0007",
        variantId: "var-1",
        delta,
        note: "x",
        actor: "x",
      });
      expect(res.ok).toBe(false);
      expect(rpcCall("adjust_variant_stock")).toBeNull();
    }
  });
});

describe("the pure halves", () => {
  it("variantStockTotal counts the active variants, as the SQL does", () => {
    expect(
      variantStockTotal([
        { stock: 6, isActive: true },
        { stock: 4, isActive: true },
        { stock: 9, isActive: false },
        { stock: -2, isActive: true },
      ]),
    ).toBe(10);
    expect(variantStockTotal([])).toBe(0);
  });

  it("splitStockTarget reads a product or a product and its variant", () => {
    expect(splitStockTarget("prd-0004")).toEqual({ productId: "prd-0004", variantId: null });
    expect(splitStockTarget(" prd-0004#var-2 ")).toEqual({
      productId: "prd-0004",
      variantId: "var-2",
    });
    expect(splitStockTarget("prd-0004#")).toEqual({ productId: "prd-0004", variantId: null });
  });

  it("reads the snapshots the form posts, and nothing else as one", () => {
    expect(parseStockSnapshot("12")).toBe(12);
    expect(parseStockSnapshot(" 0 ")).toBe(0);
    expect(parseStockSnapshot(3)).toBe(3);
    for (const bad of [undefined, null, "", "-1", "1.5", "on iki", 2.5, -1]) {
      expect(parseStockSnapshot(bad), String(bad)).toBeNull();
    }
    const parsed = productFormSchema.parse({
      name: "Sirena",
      tag: "Çekirdek",
      desc: "Espresso",
      price: "320",
      stock: "9",
      stockAtOpen: "4",
      variants: JSON.stringify([
        { id: "var-1", name: "250 g", stock: "10", stockAtOpen: "6", isActive: true },
        { id: "var-2", name: "1 kg", stock: "3", stockAtOpen: null, isActive: true },
      ]),
    });
    expect(parsed.stockAtOpen).toBe(4);
    expect(parsed.variants.map((v) => v.stockAtOpen)).toEqual([6, null]);
    expect(
      productFormSchema.parse({
        name: "Sirena",
        tag: "Çekirdek",
        desc: "Espresso",
        price: "320",
      }).stockAtOpen,
    ).toBeNull();
  });
});

describe("the product form", () => {
  const CATEGORIES: AdminCategory[] = [
    { id: "c1", slug: "beans", label: "Çekirdek", icon: "", sortOrder: 0 },
  ];

  async function render(product?: AdminProduct): Promise<string> {
    vi.doMock("next/link", () => ({
      default: ({ href, children }: { href: string; children?: ReactNode }) =>
        createElement("a", { href }, children),
    }));
    const { ProductWizard } = await import("@/components/admin/product-wizard");
    return renderToStaticMarkup(
      createElement(ProductWizard, {
        product,
        categories: CATEGORIES,
        action: async () => ({}),
        submitLabel: "Kaydet",
        mode: "tabs",
      }),
    );
  }

  function variantsPosted(html: string): Array<Record<string, unknown>> {
    const tag = /<input[^>]*name="variants"[^>]*>/.exec(html)![0];
    const value = /value="([^"]*)"/.exec(tag)![1].replace(/&quot;/g, '"');
    return JSON.parse(value);
  }

  it("posts the stock it was opened with next to the stock field", async () => {
    const html = await render(STORED);
    expect(html).toMatch(/<input[^>]*name="stockAtOpen"[^>]*value="4"/);
    expect(html).toMatch(/<input[^>]*name="stock"[^>]*value="4"/);
    expect(html).toContain("Form açıkken gelen siparişler kaybolmaz");
  });

  it("a new product posts no snapshot", async () => {
    const html = await render();
    expect(html).not.toContain('name="stockAtOpen"');
  });

  it("with variants the total is shown, not typed, and each variant posts its snapshot", async () => {
    const html = await render({
      ...STORED,
      stock: 10,
      variants: [
        { id: "var-1", name: "250 g", priceDeltaMinor: 0, stock: 6, sku: "", isActive: true },
        { id: "var-2", name: "1 kg", priceDeltaMinor: 50_000, stock: 4, sku: "", isActive: true },
      ],
    });
    expect(html).not.toMatch(/<input[^>]*name="stock"[^>]/);
    expect(html).toContain("Toplam stok (adet)");
    expect(html).toMatch(/<input[^>]*readOnly=""[^>]*value="10"|<input[^>]*value="10"[^>]*readOnly=""/);
    expect(html).toContain("10 adet (varyantlardan)");
    expect(variantsPosted(html).map((v) => v.stockAtOpen)).toEqual([6, 4]);
  });
});
