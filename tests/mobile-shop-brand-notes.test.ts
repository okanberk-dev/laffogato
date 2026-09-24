import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { AdminProduct } from "@/lib/admin/store";

import {
  PRODUCT_NOTE_MAX_LENGTH,
  PRODUCT_NOTES_MAX,
  parseProductNotes,
  productFormSchema,
} from "@/lib/admin/product-schema";
import { toMobileShopProduct } from "@/lib/mobile/menu-mapper";

/**
 * lafmobil W2 - the brand eyebrow ("SIRENA") and the tasting-note chips
 * ("Kakao · Kuru incir · Esmer şeker") on the app's product page. Both are
 * additive fields on `GET /shop` (contract §2) that stay empty until the
 * operator fills them, and empty means "draw the description as today".
 */

const SITE_URL = "https://laffogato.net";

function product(over: Partial<AdminProduct> = {}): AdminProduct {
  return {
    id: "prd-0001",
    name: "Sirena - Espresso Harmanı",
    slug: "sirena-espresso-harmani",
    sku: "SIRE-00001",
    tag: "Çekirdek · 250 g",
    priceMinor: 32000,
    compareAtPriceMinor: 0,
    costMinor: 0,
    desc: "Bologna kavurma profili. Nara'dan.",
    cat: "beans",
    img: "caramel",
    images: [],
    tags: [],
    brand: "",
    notes: [],
    backdrop: null,
    backdropSource: "auto",
    backdropHex: null,
    photoCutout: false,
    vessel: null,
    stock: 12,
    lowStockThreshold: 3,
    weightGrams: 250,
    featured: false,
    isNew: false,
    isActive: true,
    seoTitle: "",
    seoDescription: "",
    variants: [],
    updatedAt: "2026-09-23T09:00:00.000Z",
    ...over,
  };
}

function form(overrides: Record<string, string> = {}) {
  return {
    name: "Sirena Espresso",
    tag: "Çekirdek · 250 g",
    desc: "Bologna kavurma profili.",
    cat: "beans",
    price: "320",
    ...overrides,
  };
}

describe("GET /shop: brand and notes (contract §2, additive)", () => {
  it("is always present, empty until the operator fills it", () => {
    const out = toMobileShopProduct(product(), SITE_URL);
    expect(out.brand).toBe("");
    expect(out.notes).toEqual([]);
  });

  it("publishes the operator's words as written, only trimmed", () => {
    const out = toMobileShopProduct(
      product({ brand: " Sirena ", notes: [" Kakao", "Kuru incir ", "Esmer şeker"] }),
      SITE_URL,
    );
    expect(out.brand).toBe("Sirena");
    expect(out.notes).toEqual(["Kakao", "Kuru incir", "Esmer şeker"]);
  });

  it("never splits the description into chips", () => {
    // The reason the fields exist: "Nara'dan." is a sentence, not a note.
    const out = toMobileShopProduct(product(), SITE_URL);
    expect(out.notes).toEqual([]);
    expect(out.description).toBe("Bologna kavurma profili. Nara'dan.");
  });

  it("degrades to empty values while the migration has not run", () => {
    const { brand: _b, notes: _n, ...beforeMigration } = product();
    const out = toMobileShopProduct(beforeMigration as AdminProduct, SITE_URL);
    expect(out.brand).toBe("");
    expect(out.notes).toEqual([]);
  });

  it("drops a non-string or blank note rather than publishing it", () => {
    const out = toMobileShopProduct(
      product({ notes: ["Kakao", "  ", 7 as unknown as string] }),
      SITE_URL,
    );
    expect(out.notes).toEqual(["Kakao"]);
  });

  it("copies rather than aliases the row's array", () => {
    const row = product({ notes: ["Kakao"] });
    const out = toMobileShopProduct(row, SITE_URL);
    out.notes.push("Fındık");
    expect(row.notes).toEqual(["Kakao"]);
  });
});

describe("the product form", () => {
  it("reads notes separated by commas, the middle dot or new lines", () => {
    expect(parseProductNotes("Kakao, Kuru incir · Esmer şeker\nBal")).toEqual([
      "Kakao",
      "Kuru incir",
      "Esmer şeker",
      "Bal",
    ]);
  });

  it("collapses spaces and keeps a note repeated in another case once", () => {
    expect(parseProductNotes("  Kuru   incir , kuru İNCİR ,, ")).toEqual([
      "Kuru incir",
    ]);
    expect(parseProductNotes(undefined)).toEqual([]);
  });

  it("stores brand and notes, both empty when left blank", () => {
    const blank = productFormSchema.safeParse(form());
    expect(blank.success && blank.data.brand).toBe("");
    expect(blank.success && blank.data.notes).toEqual([]);

    const filled = productFormSchema.safeParse(
      form({ brand: "  Sirena ", notes: "Kakao, Kuru incir" }),
    );
    expect(filled.success && filled.data.brand).toBe("Sirena");
    expect(filled.success && filled.data.notes).toEqual(["Kakao", "Kuru incir"]);
  });

  it("refuses too many notes, or one too long for a chip, with a message", () => {
    const many = productFormSchema.safeParse(
      form({ notes: Array.from({ length: PRODUCT_NOTES_MAX + 1 }, (_, i) => `Not ${i}`).join(", ") }),
    );
    expect(many.success).toBe(false);
    if (!many.success) {
      expect(many.error.issues[0]?.path).toEqual(["notes"]);
      expect(many.error.issues[0]?.message).toContain(`${PRODUCT_NOTES_MAX}`);
    }
    const long = productFormSchema.safeParse(
      form({ notes: "a".repeat(PRODUCT_NOTE_MAX_LENGTH + 1) }),
    );
    expect(long.success).toBe(false);
  });

  it("reports a note too long for a chip under the notes field itself", () => {
    // The product action keys field errors by `issue.path.join(".")` and the
    // wizard shows `fieldError("notes")`. An element-level check reported
    // ["notes", 1] -> "notes.1", which no field reads: the operator saw only
    // the generic banner and no word about which limit was hit.
    const long = productFormSchema.safeParse(
      form({ notes: `Kakao, ${"a".repeat(PRODUCT_NOTE_MAX_LENGTH + 1)}` }),
    );
    expect(long.success).toBe(false);
    if (!long.success) {
      const notesIssues = long.error.issues.filter((i) => i.path[0] === "notes");
      expect(notesIssues.length).toBeGreaterThan(0);
      for (const issue of notesIssues) expect(issue.path).toEqual(["notes"]);
      expect(notesIssues[0]?.message).toContain(`${PRODUCT_NOTE_MAX_LENGTH}`);
    }
    // A note of exactly the limit is still a chip.
    expect(
      productFormSchema.safeParse(
        form({ notes: "a".repeat(PRODUCT_NOTE_MAX_LENGTH) }),
      ).success,
    ).toBe(true);
  });

  it("tells the operator both limits and that the brand is shown as typed", () => {
    const wizard = readFileSync("src/components/admin/product-wizard.tsx", "utf8");
    expect(wizard).toContain('fieldError("notes")');
    expect(wizard).toContain(`en fazla ${PRODUCT_NOTES_MAX} not`);
    expect(wizard).toContain(`en fazla ${PRODUCT_NOTE_MAX_LENGTH} karakter`);
    // The app prints the brand as written (no upper-casing), so the hint must
    // not say it appears in lower case ("küçük harflerle").
    expect(wizard).not.toContain("üstünde küçük harflerle");
    expect(wizard).toContain("otomatik büyütülmez");
  });

  it("refuses a brand too long for the eyebrow", () => {
    expect(productFormSchema.safeParse(form({ brand: "x".repeat(41) })).success).toBe(false);
  });

  it("posts both fields from the wizard under the names the schema reads", () => {
    const wizard = readFileSync("src/components/admin/product-wizard.tsx", "utf8");
    expect(wizard).toContain('name="brand"');
    expect(wizard).toContain('name="notes"');
    const actions = readFileSync("src/app/admin/urunler/actions.ts", "utf8");
    expect(actions).toContain("brand: parsed.brand");
    expect(actions).toContain("notes: parsed.notes");
  });
});

describe("db and contract", () => {
  it("adds both columns with empty defaults, in the bundle the app applies", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    expect(schema).toContain("add column if not exists brand text not null default ''");
    expect(schema).toContain("add column if not exists notes jsonb not null default '[]'::jsonb");
  });

  it("documents both fields in §2", () => {
    const doc = readFileSync("docs/API-MOBILE.md", "utf8");
    const shop = doc.slice(doc.indexOf("## 2. `GET /shop`"), doc.indexOf("## 3. Siparişler"));
    expect(shop).toContain('"brand"');
    expect(shop).toContain('"notes"');
  });
});
