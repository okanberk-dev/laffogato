import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { menuItemFieldsSchema } from "@/lib/admin/menu-item-schema";
import { productFormSchema } from "@/lib/admin/product-schema";
import {
  CATALOG_MONEY_MAX_MINOR,
  MONEY_TOO_LARGE_ERROR,
  parseMoneyInput,
  parseSignedMoneyInput,
  splitSign,
} from "@/lib/utils/format";

/**
 * Catalog prices go through parseMoneyInput (CLAUDE.md rule 24). Products,
 * variants, the wizard's preview and menu items still read a price with
 * `parseFloat(s.replace(",", "."))`: "1.250,00" was saved as 1,25 TL and an
 * unreadable value as 0 TL, without a word.
 */

function product(overrides: Record<string, string> = {}) {
  return {
    name: "Sirena Espresso",
    tag: "Çekirdek · 250g",
    desc: "Espresso harmanı",
    cat: "beans",
    price: "320",
    ...overrides,
  };
}

describe("product prices", () => {
  it("reads the Turkish thousands dot: 1.250,00 is 1250 TL", () => {
    const r = productFormSchema.safeParse(
      product({
        price: "1.250,00",
        compareAtPrice: "1.500",
        cost: "612,5",
        // A compare-at price comes with its days (Ticari Reklam Yön. m.14/1).
        discountStartsOn: "2026-10-19",
        discountEndsOn: "2026-10-31",
      }),
    );
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.priceMinor).toBe(125_000);
    expect(r.data.compareAtPriceMinor).toBe(150_000);
    expect(r.data.costMinor).toBe(61_250);
  });

  it("refuses an unreadable price under its field instead of saving 0 TL", () => {
    const r = productFormSchema.safeParse(product({ price: "1,250.00" }));
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === "price");
    expect(issue?.message).toMatch(/rakamla yaz/i);
  });

  it("keeps an empty optional price at 0", () => {
    const r = productFormSchema.safeParse(product({ cost: "" }));
    expect(r.success && r.data.costMinor).toBe(0);
  });

  it("reads a variant's signed difference, and refuses one it cannot read", () => {
    const variants = (priceDelta: string) =>
      JSON.stringify([{ name: "1kg", priceDelta, stock: "4" }]);
    const up = productFormSchema.safeParse(
      product({ variants: variants("1.000,00") }),
    );
    expect(up.success && up.data.variants[0].priceDeltaMinor).toBe(100_000);
    const down = productFormSchema.safeParse(
      product({ variants: variants("−10,50") }),
    );
    expect(down.success && down.data.variants[0].priceDeltaMinor).toBe(-1050);
    // What the edit form fills in for a stored variant.
    const stored = productFormSchema.safeParse(
      product({ variants: variants("-10.50") }),
    );
    expect(stored.success && stored.data.variants[0].priceDeltaMinor).toBe(
      -1050,
    );
    const bad = productFormSchema.safeParse(
      product({ variants: variants("on lira") }),
    );
    expect(bad.success).toBe(false);
    if (bad.success) return;
    expect(bad.error.issues[0].path[0]).toBe("variants");
    expect(bad.error.issues[0].message).toContain("1kg");
  });
});

describe("an amount too big for the price columns", () => {
  // Prices sit in `integer` kuruş columns (max 2.147.483.647 = ~21,4 milyon
  // TL). "25.000.000" read as 2.500.000.000 kuruş, and the insert died with
  // Postgres 22003 (integer out of range): the wizard showed the error page.
  const INT4_MAX = 2_147_483_647;

  it("refuses it under the field instead of crashing the save", () => {
    const r = productFormSchema.safeParse(product({ price: "25.000.000" }));
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === "price");
    expect(issue?.message).toBe(MONEY_TOO_LARGE_ERROR);
  });

  it("refuses it for the was price, the cost and a variant's difference", () => {
    for (const field of ["compareAtPrice", "cost"]) {
      const r = productFormSchema.safeParse(
        product({ [field]: "99.999.999,99" }),
      );
      expect(r.success).toBe(false);
    }
    const variant = productFormSchema.safeParse(
      product({
        variants: JSON.stringify([
          { name: "XL", priceDelta: "-25.000.000", stock: "1" },
        ]),
      }),
    );
    expect(variant.success).toBe(false);
    if (variant.success) return;
    expect(variant.error.issues[0].path[0]).toBe("variants");
  });

  it("refuses it for both menu sizes", () => {
    const r = menuItemFieldsSchema.safeParse({
      name: "Latte",
      price: "25.000.000",
      priceL: "3000000000",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    const by = Object.fromEntries(
      r.error.issues.map((i) => [String(i.path[0]), i.message]),
    );
    expect(by.price).toBe(MONEY_TOO_LARGE_ERROR);
    expect(by.priceL).toBe(MONEY_TOO_LARGE_ERROR);
  });

  it("keeps the ceiling itself, and it fits the columns", () => {
    expect(CATALOG_MONEY_MAX_MINOR).toBeLessThan(INT4_MAX);
    const r = productFormSchema.safeParse(product({ price: "1.000.000" }));
    expect(r.success && r.data.priceMinor).toBe(CATALOG_MONEY_MAX_MINOR);
  });
});

describe("signed amounts", () => {
  it("splits a plus, a hyphen, the Unicode minus and an autocorrected dash", () => {
    expect(splitSign("+12")).toEqual({ sign: 1, rest: "12" });
    expect(splitSign("-3")).toEqual({ sign: -1, rest: "3" });
    expect(splitSign("\u22123")).toEqual({ sign: -1, rest: "3" });
    expect(splitSign("\u2013 3")).toEqual({ sign: -1, rest: "3" });
    expect(splitSign(" 7 ")).toEqual({ sign: 1, rest: "7" });
  });

  it("parseSignedMoneyInput follows parseMoneyInput after the sign", () => {
    expect(parseSignedMoneyInput("-1.250,00")).toBe(-125_000);
    expect(parseSignedMoneyInput("+12,5")).toBe(1250);
    expect(parseSignedMoneyInput("-0")).toBe(0);
    expect(parseSignedMoneyInput("--5")).toBeNull();
    expect(parseSignedMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("-5")).toBeNull();
  });
});

describe("menu item prices", () => {
  const fields = (over: Record<string, string>) =>
    menuItemFieldsSchema.safeParse({
      name: "Çilekli Matcha",
      price: "245",
      priceL: "",
      ...over,
    });

  it("reads 1.250,00 as 1250 TL and an empty L size as one size", () => {
    const r = fields({ price: "1.250,00" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.price).toBe(125_000);
    expect(r.data.priceL).toBe(0);
    const l = fields({ priceL: "275,50" });
    expect(l.success && l.data.priceL).toBe(27_550);
  });

  it("answers under each field: no name, no price, an unreadable L", () => {
    const r = fields({ name: "  ", price: "", priceL: "iki yüz" });
    expect(r.success).toBe(false);
    if (r.success) return;
    const by = Object.fromEntries(
      r.error.issues.map((i) => [String(i.path[0]), i.message]),
    );
    expect(by.name).toBe("Kalemin adını yaz.");
    expect(by.price).toBe("Fiyatı yaz.");
    expect(by.priceL).toMatch(/rakamla yaz/i);
  });
});

describe("no parseFloat left on a catalog price", () => {
  it.each([
    "src/lib/admin/product-schema.ts",
    "src/components/admin/product-wizard.tsx",
    "src/app/admin/menu/actions.ts",
  ])("%s", (file) => {
    // Code only: the comments that explain the old bug may name it.
    const code = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/parseFloat\(/);
  });

  it("the wizard's preview reads the price the way the save does", () => {
    const src = readFileSync("src/components/admin/product-wizard.tsx", "utf8");
    expect(src).toContain("parseMoneyInput(price)");
  });
});
