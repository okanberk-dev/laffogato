import { readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Product } from "@/components/laffogato/data";

/**
 * The shop's product page, quick look and card for X-TGK-SHOP and
 * X-DISCOUNT (19 Oct 2026):
 * - a packaged food's label rows (TGK Etiketleme m.9/1, m.17/2-a), each only
 *   when entered, and the "ask us" row until the ingredients and the
 *   allergens are there;
 * - a struck price only with the sentence naming the discount's first and
 *   last day (Ticari Reklam Yön. m.14/1), and none without them.
 */

vi.mock("@/app/uye/actions", () => ({ toggleWishlistAction: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
  } & Record<string, unknown>) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/magaza",
  useRouter: () => ({ push: () => {} }),
}));

const {
  productFacts,
  FOOD_INFO_ASK,
  FOOD_ALLERGEN_ASK,
  NO_ALLERGENS,
  NUTS_NOTICE,
} = await import("@/components/laffogato/product-facts");
const { ProductDetail } = await import("@/components/laffogato/product-detail");
const { ProductCard, ProductModal } = await import("@/components/laffogato/ui");

const contact = { phone: "+90 536 429 09 19", email: "merhaba@laffogato.net" };

const cantucci: Product = {
  id: "prd-0011",
  name: "Cantucci - Bronte Pistachio",
  tag: "Biscotti · 180 g",
  price: "180₺",
  priceMinor: 18_000,
  desc: "İki kez pişmiş.",
  cat: "pantry",
  img: "pistachio",
  slug: "cantucci",
  stock: 9,
  tags: ["nuts"],
};

const labelled: Product = {
  ...cantucci,
  netQuantity: "180 g",
  ingredients: "Buğday unu, şeker, %20 Antep fıstığı, yumurta",
  allergens: ["gluten", "yumurta", "sert_kabuklu"],
  nutrition: "Enerji: 1950 kJ / 465 kcal\nYağ: 18 g",
  storageConditions: "Serin ve kuru yerde saklayın.",
  origin: "İtalya",
  producer: "Biscottificio Örnek, Via Roma 1, Prato",
  businessRegNo: "TR-34-K-000000",
};

const chasen: Product = {
  id: "prd-0008",
  name: "Bambu Chasen",
  tag: "Ekipman",
  price: "750₺",
  priceMinor: 75_000,
  desc: "80 dişli.",
  cat: "gear",
  img: "matcha",
  slug: "bambu-chasen",
  stock: 5,
};

const discounted: Product = {
  ...chasen,
  compareAtPrice: "999₺",
  compareAtPriceMinor: 99_900,
  discountStartsAt: "2026-10-18T21:00:00.000Z",
  discountEndsAt: "2026-10-31T20:59:59.999Z",
};

const NOTICE = "İndirim 19 Ekim 2026 - 31 Ekim 2026 tarihleri arasında geçerli";

function pdp(product: Product): string {
  return renderToStaticMarkup(
    createElement(ProductDetail, { product, related: [], contact }),
  );
}

describe("label rows: each only when entered", () => {
  it("prints the label in order, the groups as words, no ask row", () => {
    const rows = productFacts(labelled);
    expect(rows.map((r) => r.k)).toEqual([
      "Net miktar",
      "İçindekiler",
      "Alerjenler",
      "Besin değerleri",
      "Saklama koşulu",
      "Menşe",
      "Üretici / ithalatçı",
      "İşletme kayıt no",
    ]);
    expect(rows).toContainEqual({
      k: "Alerjenler",
      v: "Gluten, yumurta, sert kabuklu meyveler",
    });
    expect(rows.some((r) => r.ask)).toBe(false);
  });

  it("keeps the ask row until the ingredients and the groups are entered", () => {
    expect(productFacts(cantucci)).toContainEqual({
      k: "İçindekiler",
      v: FOOD_INFO_ASK,
      ask: true,
    });
    // Ingredients but no groups: the nut tag still speaks, and the rest is asked.
    const half = productFacts({ ...cantucci, ingredients: "Un, fıstık" });
    expect(half).toContainEqual({ k: "Alerjenler", v: NUTS_NOTICE });
    expect(half).toContainEqual({
      k: "Alerjen bilgisi",
      v: FOOD_ALLERGEN_ASK,
      ask: true,
    });
    // Entered as none of the fourteen.
    const none = productFacts({
      ...cantucci,
      tags: [],
      ingredients: "Un",
      allergens: [],
    });
    expect(none).toContainEqual({ k: "Alerjenler", v: NO_ALLERGENS });
    expect(none.some((r) => r.ask)).toBe(false);
  });

  it("draws nothing for a field left empty", () => {
    const rows = productFacts({ ...chasen, netQuantity: " ", origin: "" });
    expect(rows).toEqual([]);
  });

  it("the product page keeps the label's lines", () => {
    const html = pdp(labelled);
    expect(html).toContain("<dt>İçindekiler</dt><dd>Buğday unu");
    expect(html).toContain("Enerji: 1950 kJ / 465 kcal\nYağ: 18 g");
    expect(html).not.toContain(FOOD_INFO_ASK);
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\.pdp-detail-grid dd \{[^}]*white-space: pre-line;/);
  });

  it("the quick look draws the same rows", () => {
    const html = renderToStaticMarkup(
      createElement(ProductModal, {
        product: labelled,
        onClose: () => {},
        addToCart: () => {},
        contact,
      }),
    );
    expect(html).toContain("Net miktar");
    expect(html).toContain("Gluten, yumurta, sert kabuklu meyveler");
    expect(html).toContain("white-space:pre-line");
  });
});

describe("a struck price names the discount's days", () => {
  it("on the product page, next to the badge", () => {
    const html = pdp(discounted);
    expect(html).toContain('<span class="pdp-compare">999₺</span>');
    expect(html).toContain("%25 indirim");
    expect(html).toContain(`<p class="pdp-discount-note">${NOTICE}</p>`);
  });

  it("strikes nothing out without the days", () => {
    const {
      discountStartsAt: _s,
      discountEndsAt: _e,
      ...dateless
    } = discounted;
    const html = pdp(dateless);
    expect(html).not.toContain("pdp-compare");
    expect(html).not.toContain("indirim</span>");
    expect(html).not.toContain("pdp-discount-note");
  });

  it("in the quick look and on the card", () => {
    const modal = renderToStaticMarkup(
      createElement(ProductModal, {
        product: discounted,
        onClose: () => {},
        addToCart: () => {},
        contact,
      }),
    );
    expect(modal).toContain(NOTICE);
    const card = renderToStaticMarkup(
      createElement(ProductCard, { product: discounted, idx: 0 }),
    );
    expect(card).toContain('<span class="was">999₺</span>');
    expect(card).toContain(
      '<span class="product-card-discount">İndirim 19 Eki - 31 Eki</span>',
    );
    const {
      discountStartsAt: _s,
      discountEndsAt: _e,
      ...dateless
    } = discounted;
    const bare = renderToStaticMarkup(
      createElement(ProductCard, { product: dateless, idx: 0 }),
    );
    expect(bare).not.toContain('class="was"');
  });

  it("the shop's featured set and its sale filter read the same rule", () => {
    const src = readFileSync("src/components/laffogato/shop-page.tsx", "utf8");
    expect(src).toContain("test: (p: Product) => productDiscount(p) !== null");
    expect(src).toContain("{featuredDiscount.notice}");
    expect(src).not.toMatch(/featured\.compareAtPrice/);
  });
});
