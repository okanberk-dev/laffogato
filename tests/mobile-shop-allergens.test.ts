import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { AdminProduct } from "@/lib/admin/store";

import {
  PRODUCT_ALLERGEN_TAGS,
  PRODUCT_TAG_VALUES,
  productFormSchema,
} from "@/lib/admin/product-schema";
import { toMobileShopProduct } from "@/lib/mobile/menu-mapper";

/**
 * Rule 4 of the app's invariants: "Alerjen bilgisi gizlenmez."
 *
 * It held on the cafe menu (`menu_items.tags`) and silently did not hold in
 * the shop: `products` had no tag column, so `GET /shop` published none, and
 * `prd-0011` — "Cantucci — Bronte Pistachio" — sat on the shelf with no
 * warning anywhere in the app. These tests pin the four pieces that close it.
 */

const SITE_URL = "https://www.laffogato.net";

function product(over: Partial<AdminProduct> = {}): AdminProduct {
  return {
    id: "prd-0011",
    name: "Cantucci — Bronte Pistachio",
    slug: "cantucci-bronte-pistachio",
    sku: "CANT-180",
    tag: "Biscotti · 180g",
    priceMinor: 18000,
    compareAtPriceMinor: 0,
    costMinor: 7000,
    desc: "İki kez pişmiş, yavaş fırın.",
    cat: "pantry",
    img: "pistachio",
    images: [],
    tags: [],
    stock: 9,
    lowStockThreshold: 3,
    weightGrams: 180,
    featured: false,
    isNew: false,
    isActive: true,
    seoTitle: "",
    seoDescription: "",
    variants: [],
    updatedAt: "2026-09-16T09:00:00.000Z",
    ...over,
  };
}

function form(overrides: Record<string, string> = {}) {
  return {
    name: "Cantucci Bronte Pistachio",
    tag: "Biscotti · 180g",
    desc: "İki kez pişmiş.",
    cat: "pantry",
    price: "180",
    ...overrides,
  };
}

describe("GET /shop publishes allergens (contract §2)", () => {
  it("carries the tags through, under the same field name as the menu", () => {
    const out = toMobileShopProduct(product({ tags: ["nuts"] }), SITE_URL);
    expect(out.tags).toEqual(["nuts"]);
    // The app reads both surfaces with one expression.
    expect(out.tags.includes("nuts")).toBe(true);
  });

  it("is always present — an empty array, never a missing key", () => {
    const out = toMobileShopProduct(product(), SITE_URL);
    expect(out).toHaveProperty("tags");
    expect(out.tags).toEqual([]);
  });

  it("copies rather than aliases the row's array", () => {
    const row = product({ tags: ["nuts"] });
    toMobileShopProduct(row, SITE_URL).tags.push("signature");
    expect(row.tags).toEqual(["nuts"]);
  });
});

describe("product form tags", () => {
  it("stores a ticked allergen", () => {
    const r = productFormSchema.safeParse(form({ tags: "nuts" }));
    expect(r.success && r.data.tags).toEqual(["nuts"]);
  });

  it("defaults to an empty list when the field is absent", () => {
    const r = productFormSchema.safeParse(form());
    expect(r.success && r.data.tags).toEqual([]);
  });

  it("normalises case and spacing, and de-duplicates", () => {
    const r = productFormSchema.safeParse(form({ tags: " NUTS , nuts " }));
    expect(r.success && r.data.tags).toEqual(["nuts"]);
  });

  it("drops a word outside the shared vocabulary", () => {
    // The app filters against the same list and would drop it anyway; a tag
    // stored here that never reaches a screen reads as coverage that is not
    // there.
    const r = productFormSchema.safeParse(form({ tags: "fıstık, gluten" }));
    expect(r.success && r.data.tags).toEqual([]);
  });

  it("keeps the non-allergen badges the row already carried", () => {
    const r = productFormSchema.safeParse(form({ tags: "nuts, signature" }));
    expect(r.success && r.data.tags).toEqual(["nuts", "signature"]);
  });
});

describe("the vocabulary is the app's, exactly", () => {
  it("matches lafmobil's KNOWN_TAGS / ItemTag union", () => {
    // src/data/types.ts:  export type ItemTag = 'signature' | 'new' | 'iced' | 'nuts';
    // src/data/http.ts:   const KNOWN_TAGS = ['signature', 'new', 'iced', 'nuts'];
    expect([...PRODUCT_TAG_VALUES]).toEqual([
      "signature",
      "new",
      "iced",
      "nuts",
    ]);
  });

  it("offers every allergen in that vocabulary as a closed choice", () => {
    expect(PRODUCT_ALLERGEN_TAGS).toEqual(["nuts"]);
    for (const tag of PRODUCT_ALLERGEN_TAGS) {
      expect(PRODUCT_TAG_VALUES).toContain(tag);
    }
  });

  it("gives the admin form a checkbox for each one — no free text", () => {
    const wizard = readFileSync(
      "src/components/admin/product-wizard.tsx",
      "utf8",
    );
    for (const tag of PRODUCT_ALLERGEN_TAGS) {
      expect(wizard).toContain(`["${tag}", "`);
    }
    expect(wizard).toContain('<input type="hidden" name="tags"');
  });
});

describe("db", () => {
  it("adds products.tags with the same shape as menu_items.tags", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    expect(schema).toContain(
      "add column if not exists tags jsonb not null default '[]'::jsonb",
    );
    // menu_items declares it the same way; the column shapes must not drift.
    expect(schema).toContain(
      "tags          jsonb   not null default '[]'::jsonb",
    );
  });
});

describe("the contract documents it", () => {
  it("names the field and the vocabulary in §2", () => {
    const doc = readFileSync("docs/API-MOBILE.md", "utf8");
    const shop = doc.slice(
      doc.indexOf("## 2. `GET /shop`"),
      doc.indexOf("## 3. Siparişler"),
    );
    expect(shop).toContain('"tags"');
    expect(shop).toContain("nuts");
    expect(shop).toContain("signature");
  });
});
