import { readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductActionState } from "@/app/admin/urunler/actions";
import type { AdminCategory, AdminProduct } from "@/lib/admin/store";

/**
 * The product wizard and its save, admin audit package 5a (catalog-data),
 * steps 1-3:
 *
 * - CAT-05: a 0 TL price, or a variant cheaper than 1 kuruş, was accepted
 *   and a basket of them settled as paid; a 0 TL menu cup too.
 * - CAT-01 / CAT-02 / CAT-09 / CAT-17: the form posted through `<form
 *   action>` (React reset the selects and boxes after a refusal), the
 *   browser silently dropped a submit whose invalid field sat on a hidden
 *   step, errors looked like hints, and a throw showed the error page.
 * - SYS-M02, CAT-22, CAT-24, CAT-M02, CAT-29, CAT-18, CAT-28, CAT-20.
 *
 * No DOM library is installed (and none may be added), so the wizard is
 * read as server markup, its step check runs on small fake elements, and
 * the form's wiring is checked in the source.
 */

const h = vi.hoisted(() => ({
  state: null as ProductActionState | null,
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

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    // The answer the wizard renders, when a test sets one.
    useActionState: ((reducer: unknown, initial: unknown) =>
      h.state
        ? [h.state, () => {}, false]
        : actual.useActionState(
            reducer as Parameters<typeof actual.useActionState>[0],
            initial as never,
          )) as typeof actual.useActionState,
  };
});
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children?: ReactNode;
    className?: string;
  }) => createElement("a", { href, className }, children),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: h.redirect,
  unstable_rethrow: vi.fn(),
}));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: vi.fn(async () => ({ email: "owner@laffogato.net" })),
}));
vi.mock("@/lib/admin/audit", () => ({ logAudit: h.logAudit }));
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

const {
  ProductWizard,
  FIELD_STEP,
  checkSteps,
  firstErrorStep,
  reportFirstInvalid,
} = await import("@/components/admin/product-wizard");
const { productFormSchema, PRICE_FLOOR_ERROR, PRICE_REQUIRED_ERROR } =
  await import("@/lib/admin/product-schema");
const { menuItemFieldsSchema, MENU_PRICE_ZERO_ERROR } = await import(
  "@/lib/admin/menu-item-schema"
);
const { deriveSku, skuPrefix } = await import("@/lib/admin/sku");
const products = await import("@/app/admin/urunler/actions");

const CATEGORIES: AdminCategory[] = [
  { id: "c1", slug: "beans", label: "Kahve çekirdeği", icon: "", sortOrder: 0 },
  { id: "c2", slug: "gear", label: "Ekipman", icon: "", sortOrder: 1 },
];

const STORED: AdminProduct = {
  id: "prd-0007",
  name: "Moka Pot 3 Cup",
  slug: "moka-pot-3-cup",
  sku: "MOKA-00007",
  tag: "Ekipman",
  priceMinor: 120_000,
  compareAtPriceMinor: 0,
  costMinor: 0,
  desc: "Klasik moka.",
  cat: "gear",
  img: "stone",
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
  isActive: false,
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

function wizard(
  mode: "wizard" | "tabs",
  product?: Partial<AdminProduct>,
): string {
  return renderToStaticMarkup(
    createElement(ProductWizard, {
      product: product as AdminProduct | undefined,
      categories: CATEGORIES,
      action: async () => ({}),
      submitLabel: "Ürünü kaydet",
      mode,
    }),
  );
}

/** The `<input>` tag posting `name` (React orders its attributes freely). */
function inputTag(html: string, name: string): string {
  const tag = html.match(new RegExp(`<input[^>]*\\sname="${name}"[^>]*>`));
  expect(tag, `input ${name}`).not.toBeNull();
  return tag![0];
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const VALID = {
  name: "Sirena Espresso",
  tag: "Çekirdek · 250 g",
  desc: "Espresso harmanı",
  cat: "beans",
  price: "320",
};

beforeEach(() => {
  h.state = null;
  for (const fn of Object.values(h.store)) fn.mockReset();
  h.logAudit.mockClear();
  h.setAdminFlash.mockClear();
  h.redirect.mockClear();
});

describe("CAT-05: price floors", () => {
  it("refuses a 0 TL and an empty sale price under the price field", () => {
    for (const [price, message] of [
      ["0", PRICE_FLOOR_ERROR],
      ["0,00", PRICE_FLOOR_ERROR],
      ["", PRICE_REQUIRED_ERROR],
    ]) {
      const r = productFormSchema.safeParse({ ...VALID, price });
      expect(r.success, price).toBe(false);
      if (r.success) continue;
      const issue = r.error.issues.find((i) => i.path[0] === "price");
      expect(issue?.message).toBe(message);
    }
    const kurus = productFormSchema.safeParse({ ...VALID, price: "0,01" });
    expect(kurus.success && kurus.data.priceMinor).toBe(1);
  });

  it("keeps the optional prices at 0 when empty or 0", () => {
    const r = productFormSchema.safeParse({
      ...VALID,
      compareAtPrice: "0",
      cost: "",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.compareAtPriceMinor).toBe(0);
    expect(r.data.costMinor).toBe(0);
  });

  it("refuses a variant whose price plus difference is under 1 kuruş, by name", () => {
    const variants = (priceDelta: string) =>
      JSON.stringify([{ name: "Mini", priceDelta, stock: "3" }]);
    const below = productFormSchema.safeParse({
      ...VALID,
      variants: variants("-400"),
    });
    expect(below.success).toBe(false);
    if (below.success) return;
    const issue = below.error.issues.find((i) => i.path[0] === "variants");
    expect(issue?.message).toContain('"Mini"');
    expect(issue?.message).toContain("0,01 TL");
    // Exactly 1 kuruş left is a price.
    const edge = productFormSchema.safeParse({
      ...VALID,
      variants: variants("-319,99"),
    });
    expect(edge.success).toBe(true);
  });

  it("refuses a 0 TL menu M price; L may stay empty, '-' or 0", () => {
    const menu = (price: string, priceL: string) =>
      menuItemFieldsSchema.safeParse({ name: "Latte", price, priceL });
    const zero = menu("0", "");
    expect(zero.success).toBe(false);
    if (!zero.success) {
      expect(zero.error.issues[0].path[0]).toBe("price");
      expect(zero.error.issues[0].message).toBe(MENU_PRICE_ZERO_ERROR);
    }
    for (const l of ["", "-", "0"]) {
      const r = menu("245", l);
      expect(r.success && r.data.priceL, l).toBe(0);
    }
  });
});

describe("CAT-29: a variant without a name", () => {
  it("is refused under Varyantlar instead of vanishing", () => {
    const r = productFormSchema.safeParse({
      ...VALID,
      variants: JSON.stringify([
        { name: "250 g", priceDelta: "0", stock: "2" },
        { name: "  ", priceDelta: "40", stock: "5" },
      ]),
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === "variants");
    expect(issue?.message).toBe("2. varyantın adını yaz ya da satırı sil.");
  });

  it("asks for the name in the browser too", () => {
    const html = wizard("tabs", {
      ...STORED,
      variants: [
        { id: "v1", name: "", priceDeltaMinor: 0, stock: 1, sku: "", isActive: true },
      ],
    });
    expect(html).toMatch(/aria-label="1\. varyantın adı"[^>]*required=""/);
  });
});

describe("CAT-18: SKU", () => {
  it("folds Turkish letters into the prefix", () => {
    expect(skuPrefix("Çay Bardağı")).toBe("CAYB");
    expect(skuPrefix("Şeker Kutusu")).toBe("SEKE");
    expect(skuPrefix("İnce Öğütülmüş")).toBe("INCE");
    expect(skuPrefix("ıhlamur")).toBe("IHLA");
    expect(skuPrefix("Ö")).toBe("OXXX");
    expect(deriveSku("Espresso Fincanı", 12)).toBe("ESPR-00012");
    expect(deriveSku("Espresso Blend 1 kg", 13)).toBe("ESPR-00013");
  });

  it("the store derives the code with the shared helper", () => {
    const store = readFileSync("src/lib/admin/store.ts", "utf8");
    expect(store).toContain('import { deriveSku } from "@/lib/admin/sku";');
    expect(store).not.toMatch(/function deriveSku\(/);
  });

  it("starts empty for a new product, with the would-be prefix as placeholder", () => {
    expect(inputTag(wizard("wizard"), "sku")).toContain('value=""');
    const legacy = inputTag(
      wizard("tabs", { ...STORED, name: "Çay Bardağı", sku: "" }),
      "sku",
    );
    expect(legacy).toContain('placeholder="CAYB-00042"');
    expect(legacy).toContain('value=""');
    expect(inputTag(wizard("tabs", STORED), "sku")).toContain(
      'value="MOKA-00007"',
    );
  });

  it("on an edit says an emptied field keeps the stored code, as updateProduct does", () => {
    // The summary renders the state; an edit whose field was emptied reads
    // like a product whose code is "" in the form but stored in the row.
    const edit = wizard("tabs", STORED);
    expect(edit).toContain("Boş bırakırsan kayıtlı kod kalır.");
    expect(edit).not.toContain("Boş bırakırsan kayıtta addan üretilir");
    const legacy = wizard("tabs", { ...STORED, name: "Çay Bardağı", sku: "" });
    expect(legacy).toContain("Boş bırakırsan kayıtta addan üretilir");
    expect(legacy).toContain("Kayıtta üretilir (CAYB-…)");
  });
});

describe("CAT-M02: weight", () => {
  it("is empty for a new product and for a stored 0, kept when set", () => {
    expect(inputTag(wizard("wizard"), "weightGrams")).toContain('value=""');
    expect(inputTag(wizard("tabs", STORED), "weightGrams")).toContain(
      'value=""',
    );
    expect(
      inputTag(wizard("tabs", { ...STORED, weightGrams: 250 }), "weightGrams"),
    ).toContain('value="250"');
  });

  it("says where the weight and the low-stock line show", () => {
    const html = wizard("wizard");
    expect(html).not.toContain("Kargo hesabı için");
    expect(html).toContain("Google");
    expect(html).toContain("Son N adet");
  });
});

describe("SYS-M02: the allergen box", () => {
  it("is a fieldset with a legend, so its hint is not part of a label", () => {
    const html = wizard("wizard");
    const block = html.match(/<fieldset[^>]*>(?:(?!<\/fieldset>)[\s\S])*Alerjen[\s\S]*?<\/fieldset>/);
    expect(block, "Alerjen fieldset").not.toBeNull();
    expect(block![0]).toMatch(/<legend[^>]*>Alerjen<\/legend>/);
    // The hint is tied to the group, outside every label.
    const hint = "Ürün içeriyorsa işaretle.";
    expect(block![0]).toContain(hint);
    const labels = block![0].match(/<label[\s\S]*?<\/label>/g) ?? [];
    for (const label of labels) expect(label).not.toContain(hint);
  });

  it("the Aktif box is in a fieldset too", () => {
    expect(wizard("wizard")).toMatch(
      /<fieldset[^>]*><legend[^>]*>Yayın durumu<\/legend>/,
    );
  });
});

describe("CAT-22 and CAT-24: Vazgeç and copy", () => {
  it("Vazgeç is one link, not a button inside a link", () => {
    for (const mode of ["wizard", "tabs"] as const) {
      const html = wizard(mode, mode === "tabs" ? STORED : undefined);
      expect(html).toMatch(/<a href="\/admin\/urunler" class="[^"]+">Vazgeç<\/a>/);
      expect(html).not.toMatch(/<a [^>]*>\s*<button/);
    }
  });

  it("drops the English and the jargon", () => {
    const html = wizard("tabs", STORED);
    for (const word of [
      "override",
      "was,",
      "(placeholder)",
      "delta",
      "Δ",
      "Pistachio",
      ">Rose<",
      "base64",
      "nesne depolama",
    ]) {
      expect(html, word).not.toContain(word);
    }
    expect(html).toContain("Antep fıstığı");
    expect(html).toContain("fiyat farkı");
  });

  it("the summary names the category, not its slug", () => {
    const html = wizard("tabs", STORED);
    const summary = html.slice(html.indexOf("Özet &amp; onayla"));
    expect(summary).toMatch(/Kategori<\/div><div[^>]*>Ekipman<\/div>/);
  });

  it("adds no long dash", () => {
    const src = readFileSync("src/components/admin/product-wizard.tsx", "utf8");
    expect(src).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("CAT-01 / CAT-02 / CAT-17: how the form posts", () => {
  const src = readFileSync("src/components/admin/product-wizard.tsx", "utf8");

  it("posts by hand with its own check, never through <form action>", () => {
    expect(src).toContain("useNoResetSubmit(formAction, pending, { beforeSubmit })");
    expect(src).toContain("onSubmit={onSubmit}");
    expect(src).not.toMatch(/<form[^>]*\saction=/);
    const html = wizard("wizard");
    const tag = html.match(/<form[^>]*>/)![0];
    expect(tag.toLowerCase()).toContain('novalidate=""');
    expect(tag).not.toContain("action=");
  });

  it("turns a thrown save into an answer in place", () => {
    expect(src).toMatch(/withPanelCatch<ProductActionState>\(action/);
    expect(src).toContain("PANEL_ACTION_FAILED");
  });

  it("renders every step in its own data-step wrapper, the hidden ones hidden", () => {
    const html = wizard("wizard");
    for (const n of [1, 2, 3, 4, 5]) {
      expect(html).toContain(`data-step="${n}"`);
    }
    expect(html).toMatch(/<div data-step="1">/);
    expect(html).toMatch(/<div data-step="2" hidden="">/);
  });

  it("knows the step of every field the schema reads", () => {
    const shape = Object.keys(
      (productFormSchema as unknown as { in: { shape: object } }).in.shape,
    );
    expect(shape.length).toBeGreaterThan(20);
    for (const key of shape) expect(FIELD_STEP[key], key).toBeGreaterThan(0);
    expect(firstErrorStep({ variants: "x", desc: "y" })).toBe(1);
    expect(firstErrorStep({ price: "x", "variants.0": "y" })).toBe(2);
    expect(firstErrorStep({ form: "x" })).toBe(5);
    expect(firstErrorStep({})).toBeNull();
  });
});

/** A control as the step check reads it. */
function control(step: number, valid: boolean, drawn = true) {
  return {
    willValidate: true,
    validity: { valid },
    closest: () => ({ getAttribute: () => String(step) }),
    getClientRects: () => (drawn ? [{}] : []),
    reportValidity: vi.fn(() => valid),
  };
}
function root(controls: ReturnType<typeof control>[]) {
  return { querySelectorAll: () => controls } as unknown as ParentNode;
}

describe("CAT-02: the step check", () => {
  it("finds an invalid field on a hidden step and names its step", () => {
    const check = checkSteps(
      root([control(1, true), control(2, false), control(3, false)]),
    );
    expect(check).toEqual({ ok: false, steps: [2, 3], first: 2 });
    expect(checkSteps(root([control(1, true)]))).toEqual({ ok: true });
  });

  it("shows the message on the copy that is drawn", () => {
    const hidden = control(3, false, false);
    const drawn = control(3, false, true);
    expect(reportFirstInvalid(root([hidden, drawn]))).toBe(true);
    expect(drawn.reportValidity).toHaveBeenCalled();
    expect(hidden.reportValidity).not.toHaveBeenCalled();
    expect(reportFirstInvalid(root([control(1, true)]))).toBe(false);
  });
});

describe("CAT-09: a refusal as the operator sees it", () => {
  it("puts each error under its field in danger ink, announced, and marks the steps", () => {
    h.state = {
      error: "Lütfen formdaki uyarıları gidermeden devam et.",
      fieldErrors: {
        price: "Fiyat en az 0,01 TL olmalı.",
        variants: '"Mini" varyantının fiyatı (satış fiyatı + fark) en az 0,01 TL olmalı.',
      },
    };
    const html = wizard("wizard");
    expect(html).toMatch(
      /<p id="[^"]*-err-price" role="alert" tabindex="-1" class="[^"]*admin-danger-ink[^"]*">Fiyat en az 0,01 TL olmalı\.<\/p>/,
    );
    expect(html).toMatch(/<p id="[^"]*-err-variants" role="alert"/);
    expect(html).toMatch(
      /<div role="alert"[^>]*>Lütfen formdaki uyarıları gidermeden devam et\.<\/div>/,
    );
    expect(html).toContain('aria-label="2. Fiyat ve stok: düzeltilecek alan var"');
    expect(html).toContain('aria-label="3. Varyantlar: düzeltilecek alan var"');
    expect(html).toContain('aria-label="1. Temel bilgi"');
  });

  it("marks the section in the edit form", () => {
    h.state = { error: "x", fieldErrors: { desc: "Açıklama gerekli." } };
    const html = wizard("tabs", STORED);
    const first = html.slice(html.indexOf('data-step="1"'), html.indexOf('data-step="2"'));
    expect(first).toContain("Düzeltilecek alan var");
    const second = html.slice(html.indexOf('data-step="2"'), html.indexOf('data-step="3"'));
    expect(second).not.toContain("Düzeltilecek alan var");
  });
});

describe("CAT-28: saving a product deleted in another tab", () => {
  it("answers that it is gone, writes and audits nothing", async () => {
    h.store.getProduct.mockResolvedValue(null);
    const res = await products.updateProductAction("prd-0007", {}, form(VALID));
    expect(res).toEqual({ error: "Bu ürün silinmiş; listeye dön." });
    expect(h.store.updateProduct).not.toHaveBeenCalled();
    expect(h.logAudit).not.toHaveBeenCalled();
    expect(h.redirect).not.toHaveBeenCalled();
  });

  it("answers the same when the row goes during the save", async () => {
    h.store.getProduct.mockResolvedValue(STORED);
    h.store.updateProduct.mockResolvedValue(null);
    const res = await products.updateProductAction("prd-0007", {}, form(VALID));
    expect(res).toEqual({ error: "Bu ürün silinmiş; listeye dön." });
    expect(h.logAudit).not.toHaveBeenCalled();
  });

  it("still saves, audits and leaves when the product is there", async () => {
    h.store.getProduct.mockResolvedValue(STORED);
    h.store.updateProduct.mockResolvedValue({ ...STORED });
    await expect(
      products.updateProductAction("prd-0007", {}, form(VALID)),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update", entityId: "prd-0007" }),
    );
  });
});

describe("CAT-03: a save refused for stock", () => {
  it("answers under the field with the stored counts, audits the partial save and stays", async () => {
    h.store.getProduct.mockResolvedValue(STORED);
    h.store.updateProduct.mockResolvedValue({
      refusal: {
        field: "stock",
        message: "Bu arada satış oldu, stok şu an 1 adet. Adedi kontrol edip yeniden kaydet.",
        stockNow: { stock: 1, variants: {} },
      },
    });
    const res = await products.updateProductAction(
      "prd-0007",
      {},
      form({ ...VALID, stock: "0", stockAtOpen: "4" }),
    );
    expect(h.store.updateProduct).toHaveBeenCalledWith(
      "prd-0007",
      expect.objectContaining({ stock: 0, stockAtOpen: 4 }),
      { actor: "owner@laffogato.net" },
    );
    expect(res).toEqual({
      error: expect.stringMatching(/Fiyat, stok ve varyantlar kaydedilmedi/),
      fieldErrors: {
        stock: "Bu arada satış oldu, stok şu an 1 adet. Adedi kontrol edip yeniden kaydet.",
      },
      stockNow: { stock: 1, variants: {} },
    });
    expect(h.redirect).not.toHaveBeenCalled();
    expect(h.setAdminFlash).not.toHaveBeenCalled();
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        entityId: "prd-0007",
        payload: expect.objectContaining({ stockRefused: "stock" }),
      }),
    );
  });

  it("re-bases only the counts the refusal is about, from what it posted", () => {
    const src = readFileSync("src/components/admin/product-wizard.tsx", "utf8");
    // Every snapshot moved to the stored count while the typed values
    // stayed, so an untouched variant's next save gave back the units sold
    // while the form was open (rebaseStockSnapshots, admin-catalog-stock).
    expect(src).not.toMatch(/setVariantSnapshots\(next\.stockNow\.variants\)/);
    expect(src).toMatch(
      /rebaseStockSnapshots\(\s*readPostedStock\(\{\s*stock: formData\.get\("stock"\),\s*stockAtOpen: formData\.get\("stockAtOpen"\),\s*variants: formData\.get\("variants"\),\s*\}\),\s*next\.stockNow,\s*\)/,
    );
    expect(src).toMatch(/setStockSnapshot\(rebased\.stock\);\s*setVariantSnapshots\(\(was\) => \(\{ \.\.\.was, \.\.\.rebased\.variants \}\)\);/);
  });
});

describe("CAT-20: bulk audit rows say what they touched", () => {
  it("logs the ids and the names read before a delete", async () => {
    h.store.listProductLabels.mockResolvedValue([
      { id: "prd-0001", name: "Sirena", sku: "SIRE-00001" },
      { id: "prd-0002", name: "Moka", sku: "MOKA-00002" },
    ]);
    h.store.bulkUpdateProducts.mockResolvedValue({ updated: 2 });
    const res = await products.bulkProductsAction(
      {},
      form({ ids: "prd-0001,prd-0002", op: "delete" }),
    );
    expect(res).toEqual({ ok: { op: "delete", updated: 2 } });
    expect(h.store.listProductLabels.mock.invocationCallOrder[0]).toBeLessThan(
      h.store.bulkUpdateProducts.mock.invocationCallOrder[0],
    );
    expect(h.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "bulk_delete",
        payload: expect.objectContaining({
          ids: ["prd-0001", "prd-0002"],
          names: ["Sirena", "Moka"],
          idCount: 2,
        }),
      }),
    );
  });
});
