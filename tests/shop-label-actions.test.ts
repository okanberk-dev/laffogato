import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import type { AdminCategory, AdminProduct } from "@/lib/admin/store";

/**
 * The product form's save for X-TGK-SHOP and X-DISCOUNT (19 Oct 2026): the
 * fourteen allergen boxes and the `nuts` tag the shipped app reads, the
 * label fields, and the compare-at price a new product cannot have.
 */

const h = vi.hoisted(() => ({
  logAudit: vi.fn(async () => {}),
  setAdminFlash: vi.fn(async () => {}),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  store: {
    bulkUpdateProducts: vi.fn(),
    createProduct: vi.fn(),
    deleteProduct: vi.fn(),
    getProduct: vi.fn(),
    listProductLabels: vi.fn(),
    updateProduct: vi.fn(),
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) =>
    createElement("a", { href }, children),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: h.redirect,
  unstable_rethrow: vi.fn(),
}));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "owner@laffogato.net" })),
}));
vi.mock("@/lib/admin/audit", () => ({
  logAudit: h.logAudit,
  safeAudit: async (input: unknown) => {
    await (h.logAudit as (i: unknown) => Promise<void>)(input);
    return true;
  },
}));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: h.setAdminFlash }));
vi.mock("@/lib/backdrop/scene", () => ({
  sceneColumns: vi.fn(async () => ({
    backdrop: null,
    backdropSource: "auto",
    backdropHex: null,
    photoCutout: false,
    vessel: null,
  })),
}));
vi.mock("@/lib/admin/store", () => ({
  ...h.store,
  slugify: (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
}));

const products = await import("@/app/admin/urunler/actions");
const { ProductWizard } = await import("@/components/admin/product-wizard");
const { MENU_ALLERGEN_NUTS_ERROR } =
  await import("@/lib/admin/menu-allergens-schema");

const VALID = {
  name: "Cantucci Bronte",
  tag: "Biscotti · 180 g",
  desc: "İki kez pişmiş.",
  cat: "pantry",
  price: "180",
};

function form(fields: Record<string, string>, allergens?: string[]): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  if (allergens) {
    fd.set("allergensShown", "1");
    for (const a of allergens) fd.append("allergens", a);
  }
  return fd;
}

const STORED = {
  id: "prd-0011",
  name: "Cantucci Bronte",
  slug: "cantucci-bronte",
  sku: "CANT-00011",
  tag: "Biscotti",
  priceMinor: 18_000,
  compareAtPriceMinor: 0,
  costMinor: 0,
  desc: "İki kez pişmiş.",
  cat: "pantry",
  img: "pistachio",
  images: [],
  tags: ["nuts"],
  brand: "",
  notes: [],
  stock: 9,
  lowStockThreshold: 3,
  weightGrams: 180,
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
} as AdminProduct;

beforeEach(() => {
  for (const fn of Object.values(h.store)) fn.mockReset();
  h.logAudit.mockClear();
  h.redirect.mockClear();
});

describe("the fourteen groups and the nuts tag", () => {
  it("adds the nuts tag the app reads when tree nuts are ticked", async () => {
    h.store.createProduct.mockResolvedValue({
      id: "prd-0042",
      name: "x",
      sku: "y",
    });
    await expect(
      products.createProductAction({}, form(VALID, ["sert_kabuklu", "gluten"])),
    ).rejects.toThrow("NEXT_REDIRECT");
    const input = h.store.createProduct.mock.calls[0][0];
    expect(input.allergens).toEqual(["gluten", "sert_kabuklu"]);
    expect(input.tags).toContain("nuts");
  });

  it("refuses a nuts tag beside a list without tree nuts, under Alerjen", async () => {
    const res = await products.createProductAction(
      {},
      form({ ...VALID, tags: "nuts" }, ["gluten"]),
    );
    expect(res.fieldErrors?.allergens).toBe(MENU_ALLERGEN_NUTS_ERROR);
    expect(h.store.createProduct).not.toHaveBeenCalled();
  });

  it("keeps the stored groups when the form had no boxes", async () => {
    h.store.getProduct.mockResolvedValue(STORED);
    h.store.updateProduct.mockResolvedValue({ ...STORED });
    await expect(
      products.updateProductAction(
        "prd-0011",
        {},
        form({ ...VALID, tags: "nuts" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    const input = h.store.updateProduct.mock.calls[0][1];
    expect(input).not.toHaveProperty("allergens");
    expect(input.tags).toEqual(["nuts"]);
  });

  it("nothing ticked is not entered, never none", async () => {
    h.store.createProduct.mockResolvedValue({
      id: "prd-0042",
      name: "x",
      sku: "y",
    });
    await expect(
      products.createProductAction({}, form(VALID, [])),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.store.createProduct.mock.calls[0][0].allergens).toBeNull();
  });
});

describe("the label fields", () => {
  it("passes what was typed, tidied, and refuses a text over its cap", async () => {
    h.store.createProduct.mockResolvedValue({
      id: "prd-0042",
      name: "x",
      sku: "y",
    });
    await expect(
      products.createProductAction(
        {},
        form({
          ...VALID,
          netQuantity: " 180  g ",
          origin: "İtalya",
          producer: "",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    const input = h.store.createProduct.mock.calls[0][0];
    expect(input).toMatchObject({
      netQuantity: "180 g",
      origin: "İtalya",
      producer: "",
    });
    // Not posted: left out, so the store keeps the stored text.
    expect(input).not.toHaveProperty("nutrition");

    const res = await products.createProductAction(
      {},
      form({ ...VALID, netQuantity: "x".repeat(61) }),
    );
    expect(res.fieldErrors?.netQuantity).toMatch(/en fazla 60 karakter/);
  });
});

describe("the compare-at price on the save", () => {
  it("is refused for a new product: it has no price history", async () => {
    const res = await products.createProductAction(
      {},
      form({
        ...VALID,
        compareAtPrice: "240",
        discountStartsOn: "2026-10-19",
        discountEndsOn: "2026-10-31",
      }),
    );
    expect(res.fieldErrors?.compareAtPrice).toMatch(/fiyat kaydı yok/);
    expect(h.store.createProduct).not.toHaveBeenCalled();
  });

  it("answers the store's refusal under its field, without an audit row", async () => {
    h.store.getProduct.mockResolvedValue(STORED);
    h.store.updateProduct.mockResolvedValue({
      discountRefusal: { field: "compareAtPrice", message: "Bu tutarı yaz." },
    });
    const res = await products.updateProductAction(
      "prd-0011",
      {},
      form({
        ...VALID,
        compareAtPrice: "240",
        discountStartsOn: "2026-10-19",
        discountEndsOn: "2026-10-31",
      }),
    );
    expect(res.fieldErrors).toEqual({ compareAtPrice: "Bu tutarı yaz." });
    expect(res.error).toMatch(/Kaydedilmedi/);
    expect(h.logAudit).not.toHaveBeenCalled();
    expect(h.redirect).not.toHaveBeenCalled();
    const input = h.store.updateProduct.mock.calls[0][1];
    expect(input).toMatchObject({
      compareAtPriceMinor: 24_000,
      discountStartsOn: "2026-10-19",
      discountEndsOn: "2026-10-31",
    });
  });
});

describe("the audit row of a saved discount", () => {
  it("records the discount the store wrote, not the one the form sent", async () => {
    // The form sent the ended 1-10 Oct discount back; the save cleared it.
    h.store.getProduct.mockResolvedValue(STORED);
    h.store.updateProduct.mockResolvedValue({
      ...STORED,
      compareAtPriceMinor: 0,
      discountStartsAt: null,
      discountEndsAt: null,
    });
    await expect(
      products.updateProductAction(
        "prd-0011",
        {},
        form({
          ...VALID,
          compareAtPrice: "240",
          discountStartsOn: "2026-10-01",
          discountEndsOn: "2026-10-10",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    const payload = (
      h.logAudit.mock.calls[0] as unknown as [
        { payload: Record<string, unknown> },
      ]
    )[0].payload;
    expect(payload).toMatchObject({
      compareAtPriceMinor: 0,
      discountStartsOn: null,
      discountEndsOn: null,
    });
  });
});

describe("the wizard", () => {
  const CATEGORIES: AdminCategory[] = [
    { id: "c1", slug: "pantry", label: "Kiler", icon: "", sortOrder: 0 },
  ];
  const html = (product?: Partial<AdminProduct>) =>
    renderToStaticMarkup(
      createElement(ProductWizard, {
        product: product as AdminProduct | undefined,
        categories: CATEGORIES,
        action: async () => ({}),
        submitLabel: "Ürünü kaydet",
        mode: "tabs",
      }),
    );

  it("draws the fourteen boxes, the none box and every label field", () => {
    const out = html(STORED);
    expect(out.match(/name="allergens"/g)).toHaveLength(15);
    expect(out).toContain('name="allergensShown"');
    for (const key of [
      "netQuantity",
      "ingredients",
      "nutrition",
      "storageConditions",
      "usageInstructions",
      "origin",
      "producer",
      "businessRegNo",
    ]) {
      expect(out, key).toMatch(new RegExp(`name="${key}"`));
    }
    // The groups not entered yet: the stored nut warning stays, and says so.
    expect(out).toContain("uyarı aynen kalır");
    expect(out).toMatch(/<input type="hidden" name="tags" value="nuts"/);
  });

  it("opens an ended discount empty and says when it ended", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T12:00:00.000Z"));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const out = html({
      ...STORED,
      priceMinor: 75_000,
      compareAtPriceMinor: 99_900,
      discountStartsAt: "2026-09-30T21:00:00.000Z",
      discountEndsAt: "2026-10-10T20:59:59.999Z",
    });
    expect(out).not.toContain('value="999.00"');
    expect(out).not.toContain('value="2026-10-01"');
    expect(out).not.toContain('value="2026-10-10"');
    expect(out).toContain("Son indirim 10 Ekim 2026 günü bitti");
  });

  it("asks for both discount days and shows the stored ones", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T12:00:00.000Z"));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const out = html({
      ...STORED,
      priceMinor: 75_000,
      compareAtPriceMinor: 99_900,
      discountStartsAt: "2026-10-18T21:00:00.000Z",
      discountEndsAt: "2026-10-31T20:59:59.999Z",
    });
    expect(out).toMatch(
      /name="discountStartsOn"[^>]*value="2026-10-19"|value="2026-10-19"[^>]*name="discountStartsOn"/,
    );
    expect(out).toMatch(
      /name="discountEndsOn"[^>]*value="2026-10-31"|value="2026-10-31"[^>]*name="discountEndsOn"/,
    );
    expect(out).toContain("19 Ekim 2026 - 31 Ekim 2026");
    expect(out).toContain("10 günde");
  });
});
