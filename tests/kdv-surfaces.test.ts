import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type {
  AdminMenuItem,
  AdminOrder,
  AdminProduct,
} from "@/lib/admin/store";
import { menuItemFieldsSchema } from "@/lib/admin/menu-item-schema";
import { productFormSchema } from "@/lib/admin/product-schema";
import {
  toReservationJson,
  type KaraokeReservation,
} from "@/lib/mobile/karaoke-core";
import {
  buildMobileMenuCategories,
  toMobileMenuItem,
  toMobileShopProduct,
} from "@/lib/mobile/menu-mapper";
import { toMobileOrder } from "@/lib/mobile/order-mapper";
import { LEGAL_TAX_RATES, type TaxRates } from "@/lib/utils/kdv";

/**
 * Where a KDV rate leaves the server (docs/API-MOBILE.md §1, §2, §3, §7) and
 * where the panel takes one in. Additive fields only: every price stays what
 * it was, the rate only says how much of it is KDV.
 */

const SITE_URL = "https://laffogato.net";
const PANEL: TaxRates = { ...LEGAL_TAX_RATES, menu: 8, beans: 10, gear: 18 };

function menuItem(over: Partial<AdminMenuItem> = {}): AdminMenuItem {
  return {
    id: "mnu-0007",
    categoryKey: "espresso",
    name: "Cappuccino",
    desc: "",
    priceMinor: 19500,
    priceMinorL: 0,
    hue: "caramel",
    image: "",
    tags: [],
    isActive: true,
    sortOrder: 0,
    backdrop: null,
    backdropSource: "auto",
    backdropHex: null,
    photoCutout: false,
    vessel: null,
    updatedAt: "2026-10-17T10:00:00.000Z",
    ...over,
  };
}

function product(over: Partial<AdminProduct> = {}): AdminProduct {
  return {
    id: "prd-0001",
    name: "Sirena Espresso Blend",
    slug: "sirena-espresso-blend",
    sku: "SIR-250",
    tag: "Çekirdek · 250g",
    priceMinor: 32000,
    compareAtPriceMinor: 0,
    costMinor: 0,
    desc: "",
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
    stock: 3,
    lowStockThreshold: 1,
    weightGrams: 250,
    featured: false,
    isNew: false,
    isActive: true,
    seoTitle: "",
    seoDescription: "",
    variants: [],
    updatedAt: "2026-10-17T10:00:00.000Z",
    ...over,
  };
}

describe("GET /menu and GET /shop carry the rate (§1, §2)", () => {
  it("a menu item without its own rate shows the panel's menu default", () => {
    expect(toMobileMenuItem(menuItem(), SITE_URL, PANEL).taxRatePct).toBe(8);
    expect(toMobileMenuItem(menuItem(), SITE_URL).taxRatePct).toBe(10);
  });

  it("a menu item's own rate wins and the price is untouched", () => {
    const out = toMobileMenuItem(menuItem({ taxRatePct: 20 }), SITE_URL, PANEL);
    expect(out.taxRatePct).toBe(20);
    expect(out.priceMinor).toBe(19500);
  });

  it("the loader's rates reach every item of every category", () => {
    const cats = buildMobileMenuCategories(
      [menuItem(), menuItem({ id: "mnu-0008", taxRatePct: 1 })],
      ["espresso"],
      SITE_URL,
      PANEL,
    );
    expect(cats[0].items.map((i) => i.taxRatePct)).toEqual([8, 1]);
  });

  it("a shop product takes its category's default, or its own", () => {
    expect(toMobileShopProduct(product(), SITE_URL).taxRatePct).toBe(1);
    expect(toMobileShopProduct(product(), SITE_URL, PANEL).taxRatePct).toBe(10);
    expect(
      toMobileShopProduct(product({ cat: "gear" }), SITE_URL, PANEL).taxRatePct,
    ).toBe(18);
    expect(
      toMobileShopProduct(product({ cat: "merch" }), SITE_URL).taxRatePct,
    ).toBe(20);
    const own = toMobileShopProduct(
      product({ taxRatePct: 20 }),
      SITE_URL,
      PANEL,
    );
    expect(own.taxRatePct).toBe(20);
    expect(own.priceMinor).toBe(32000);
  });

  it("a row read before the migration (no key) still publishes a rate", () => {
    const before = { ...product() } as Partial<AdminProduct>;
    delete before.taxRatePct;
    expect(
      toMobileShopProduct(before as AdminProduct, SITE_URL).taxRatePct,
    ).toBe(1);
  });

  it("the loaders pass the panel's rates, not the legal fallback", () => {
    const src = readFileSync("src/lib/mobile/menu.ts", "utf8");
    expect(src).toContain("settings.taxRates");
    expect(src).toMatch(
      /buildMobileMenuCategories\([\s\S]*?settings\.taxRates/,
    );
    expect(src).toMatch(
      /toMobileShopProduct\(p, SITE\.url, settings\.taxRates\)/,
    );
  });
});

describe("Order carries the rate it was sold at (§3)", () => {
  function order(over: Partial<AdminOrder> = {}): AdminOrder {
    return {
      id: "ord-0300",
      orderNo: 300,
      customerName: "Eda",
      customerEmail: "eda@example.com",
      customerPhone: "",
      shippingAddress: "",
      internalNote: "",
      status: "paid",
      items: [
        {
          productName: "Sirena 250 g",
          qty: 2,
          unitPriceMinor: 16000,
          status: "pending",
          productId: "prd-0001",
          taxRatePct: 1,
        },
        {
          productName: "Moka pot",
          qty: 1,
          unitPriceMinor: 10000,
          status: "pending",
          productId: "prd-0002",
          taxRatePct: 20,
        },
      ],
      subtotalMinor: 42000,
      discountMinor: 0,
      promoCode: "",
      shippingMinor: 4900,
      totalMinor: 46900,
      refunds: [],
      createdAt: "2026-10-17T10:00:00.000Z",
      kind: "shop",
      fulfillment: "shipping",
      ...over,
    };
  }

  it("each line says its rate and the breakdown adds up to the total", () => {
    const m = toMobileOrder(order(), new Date("2026-10-17T11:00:00.000Z"));
    expect(m.items.map((i) => i.taxRatePct)).toEqual([1, 20]);
    expect(m.taxBreakdown).not.toBeNull();
    expect(m.taxBreakdown!.map((r) => r.ratePct)).toEqual([20, 1]);
    expect(m.taxBreakdown!.reduce((s, r) => s + r.grossMinor, 0)).toBe(46900);
    expect(Object.keys(m.taxBreakdown![0]).sort()).toEqual(
      ["grossMinor", "netMinor", "ratePct", "taxMinor"].sort(),
    );
    // Totals are what was stored, never recomputed.
    expect(m.totalMinor).toBe(46900);
  });

  it("an order from before rates were kept has nulls, never a guessed rate", () => {
    const legacy = order({
      items: order().items.map((it) => {
        const copy = { ...it };
        delete copy.taxRatePct;
        return copy;
      }),
    });
    const m = toMobileOrder(legacy, new Date("2026-10-17T11:00:00.000Z"));
    expect(m.items.map((i) => i.taxRatePct)).toEqual([null, null]);
    expect(m.taxBreakdown).toBeNull();
  });
});

describe("Karaoke carries the booking's rate (§7)", () => {
  function booking(over: Partial<KaraokeReservation> = {}): KaraokeReservation {
    return {
      id: "krk-00042",
      customerEmail: "eda@example.com",
      customerName: "Eda",
      date: "2026-10-30",
      startHour: 20,
      hours: 2,
      guests: 4,
      status: "confirmed",
      priceMinor: 200_000,
      discountMinor: 0,
      totalMinor: 200_000,
      note: "",
      createdAt: "2026-10-17T10:00:00.000Z",
      updatedAt: "2026-10-17T10:00:00.000Z",
      paymentStatus: "paid",
      ...over,
    };
  }

  it("publishes the rate the booking was made at", () => {
    expect(toReservationJson(booking({ taxRatePct: 20 })).taxRatePct).toBe(20);
  });

  it("an older booking says null, and its total is unchanged", () => {
    const json = toReservationJson(booking());
    expect(json.taxRatePct).toBeNull();
    expect(json.totalMinor).toBe(200_000);
    expect(
      toReservationJson(booking({ taxRatePct: null })).taxRatePct,
    ).toBeNull();
  });
});

describe("the panel's rate fields", () => {
  const productForm = (over: Record<string, string> = {}) => ({
    name: "Sirena",
    tag: "Çekirdek · 250g",
    desc: "Açıklama.",
    cat: "beans",
    price: "320",
    ...over,
  });

  it("product: empty is the category default, a whole number is the product's own", () => {
    const empty = productFormSchema.safeParse(productForm({ taxRatePct: "" }));
    expect(empty.success && empty.data.taxRatePct).toBeNull();
    const absent = productFormSchema.safeParse(productForm());
    expect(absent.success && absent.data.taxRatePct).toBeNull();
    const own = productFormSchema.safeParse(productForm({ taxRatePct: "20" }));
    expect(own.success && own.data.taxRatePct).toBe(20);
    const zero = productFormSchema.safeParse(productForm({ taxRatePct: "0" }));
    expect(zero.success && zero.data.taxRatePct).toBe(0);
  });

  it("product: a fraction or text is refused under the field", () => {
    for (const bad of ["1.5", "abc", "-1", "101"]) {
      const r = productFormSchema.safeParse(productForm({ taxRatePct: bad }));
      expect(r.success, bad).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].path).toEqual(["taxRatePct"]);
      }
    }
  });

  it("menu item: the same rule", () => {
    const base = { name: "Latte", price: "195", priceL: "" };
    const empty = menuItemFieldsSchema.safeParse({ ...base, taxRatePct: "" });
    expect(empty.success && empty.data.taxRatePct).toBeNull();
    // Older callers that send no rate field keep working.
    const absent = menuItemFieldsSchema.safeParse(base);
    expect(absent.success && absent.data.taxRatePct).toBeNull();
    const own = menuItemFieldsSchema.safeParse({ ...base, taxRatePct: "20" });
    expect(own.success && own.data.taxRatePct).toBe(20);
    const bad = menuItemFieldsSchema.safeParse({ ...base, taxRatePct: "10,5" });
    expect(bad.success).toBe(false);
  });
});

describe("order lines are stamped where they are written", () => {
  // The store is database-bound; tests/db-integration-kdv.test.ts proves the
  // stamp end to end. This keeps the three writers from drifting apart.
  const store = readFileSync("src/lib/admin/store.ts", "utf8");

  it("shop lines and cafe lines both carry taxRatePct from the effective rate", () => {
    expect(store).toMatch(/taxRatePct: productTaxRate\(line\.product, rates\)/);
    expect(store).toMatch(/taxRatePct: menuItemTaxRate\(item, rates\)/);
  });

  it("every order path hands the panel's defaults to the line builders", () => {
    expect(store).toContain("finalizeOrder(resolved, settings.taxRates, {");
    expect(store).toContain("finalizeOrder(resolved, taxRates, {");
    expect(store).toContain("resolveCafeLines(cafe, settings.taxRates)");
    expect(store).toContain(
      "withShopNotes(shopLineItems(resolved, settings.taxRates), shop)",
    );
  });

  it("no total is computed from a KDV rate any more", () => {
    const commerce = readFileSync("src/lib/utils/commerce.ts", "utf8");
    expect(commerce).not.toMatch(/taxRatePct|taxMinor/);
  });
});
