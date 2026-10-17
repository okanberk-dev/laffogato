import { readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Product } from "@/components/laffogato/data";

/**
 * CAT-M01 (admin audit, catalog package 5b; decision D19): the product page
 * and the quick look printed fixed rows per shelf - every gift "Gluten ·
 * süt · soya izi" and "90 gün", every piece of gear "Bialetti × L'Affogato"
 * and a two-year warranty, every coffee Sirena's origin and notes - and
 * "500₺ üzeri ücretsiz kargo" whatever Ayarlar held. The page also promised
 * a "koşulsuz" return the legal pages do not give.
 *
 * No DOM library is installed (and none may be added): pages are read as
 * server markup, closed accordions in the source.
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

const base: Product = {
  id: "prd-0100",
  name: "Bambu Chasen",
  tag: "Ekipman",
  price: "750₺",
  priceMinor: 75000,
  desc: "80 dişli geleneksel bambu chasen, Nara'dan.",
  cat: "gear",
  img: "matcha",
  slug: "bambu-chasen",
  stock: 5,
};

const gift: Product = {
  ...base,
  id: "prd-0003",
  name: "Yenilebilir Kup - 6'lı Kutu",
  cat: "gift",
  slug: "yenilebilir-kup",
};

const beans: Product = {
  ...base,
  id: "prd-0002",
  name: "Notturna - Filtre Lotu",
  desc: "Kenya AA Nyeri.",
  cat: "beans",
  slug: "notturna",
};

const contact = { phone: "+90 536 429 09 19", email: "merhaba@laffogato.net" };

const FIXED_ROWS = [
  "Bialetti",
  "Garanti",
  "2 yıl",
  "Gluten · süt · soya izi",
  "90 gün",
  "Brezilya doğal",
  "Kakao · kuru incir",
  "AeroPress",
  "Edible cup · sleeve",
];
describe("product facts come from the product (CAT-M01, D19)", () => {
  it("prints no fixed row for any shelf", async () => {
    const { productFacts } =
      await import("@/components/laffogato/product-facts");
    for (const cat of ["beans", "gift", "gear", "merch", "pantry"]) {
      const text = JSON.stringify(productFacts({ ...base, cat }));
      for (const fixed of FIXED_ROWS) expect(text, cat).not.toContain(fixed);
    }
  });

  it("shows the product's own brand, notes, SKU and a real weight", async () => {
    const { productFacts } =
      await import("@/components/laffogato/product-facts");
    const rows = productFacts({
      ...beans,
      brand: " Sirena ",
      notes: ["Frenk üzümü", " ", "Bergamot"],
      sku: "NOT-250",
      weightGrams: 250,
    });
    expect(rows).toContainEqual({ k: "Marka", v: "Sirena" });
    expect(rows).toContainEqual({
      k: "Tat notları",
      v: "Frenk üzümü · Bergamot",
    });
    expect(rows).toContainEqual({ k: "SKU", v: "NOT-250" });
    expect(rows).toContainEqual({ k: "Ağırlık", v: "250 g" });

    const bare = productFacts({
      ...base,
      brand: "",
      notes: [],
      weightGrams: 0,
    });
    expect(bare.map((r) => r.k)).not.toContain("Marka");
    expect(bare.map((r) => r.k)).not.toContain("Tat notları");
    expect(bare.map((r) => r.k)).not.toContain("Ağırlık");
  });

  it("keeps the nut allergen and sends food questions to the shop before the order", async () => {
    const { productFacts, NUTS_NOTICE, FOOD_INFO_ASK } =
      await import("@/components/laffogato/product-facts");
    const cantucci = productFacts({ ...base, cat: "pantry", tags: ["nuts"] });
    expect(cantucci).toContainEqual({ k: "Alerjenler", v: NUTS_NOTICE });
    for (const cat of ["beans", "pantry", "gift"]) {
      expect(productFacts({ ...base, cat })).toContainEqual({
        k: "İçindekiler",
        v: FOOD_INFO_ASK,
        ask: true,
      });
    }
    // Gear and clothing are not food.
    for (const cat of ["gear", "merch"]) {
      expect(productFacts({ ...base, cat })).toEqual([]);
    }
  });

  it("prints the free-shipping threshold only when Ayarlar has one", async () => {
    const { freeShippingFrom } =
      await import("@/components/laffogato/product-facts");
    expect(freeShippingFrom(50000)).toBe("500₺");
    expect(freeShippingFrom(49990)).toBe("499,90₺");
    expect(freeShippingFrom(0)).toBeNull();
    expect(freeShippingFrom(undefined)).toBeNull();
    expect(freeShippingFrom(Number.NaN)).toBeNull();
  });
});

describe("the product page (PDP)", () => {
  async function pdp(
    product: Product,
    freeShippingThresholdMinor?: number,
  ): Promise<string> {
    const { ProductDetail } =
      await import("@/components/laffogato/product-detail");
    return renderToStaticMarkup(
      createElement(ProductDetail, {
        product,
        related: [],
        freeShippingThresholdMinor,
        contact,
      }),
    );
  }

  it("draws no Bialetti, warranty or fixed allergen row", async () => {
    for (const p of [base, gift, beans]) {
      const html = await pdp(p, 50000);
      for (const fixed of FIXED_ROWS) expect(html, p.cat).not.toContain(fixed);
    }
  });

  it("draws the product's brand and notes when the product has them", async () => {
    const html = await pdp({
      ...beans,
      brand: "Notturna",
      notes: ["Bergamot"],
    });
    expect(html).toContain("<dt>Marka</dt><dd>Notturna</dd>");
    expect(html).toContain("<dt>Tat notları</dt><dd>Bergamot</dd>");
  });

  it("names the shop's e-mail and phone for food information", async () => {
    const html = await pdp(gift);
    expect(html).toContain("İçindekiler, alerjenler ve saklama koşulu");
    expect(html).toContain('href="mailto:merhaba@laffogato.net"');
    expect(html).toContain('href="tel:+905364290919"');
  });

  it("leaves the details out when the product has none", async () => {
    const html = await pdp({ ...base, sku: "" });
    expect(html).not.toContain("Ürün detayları");
    expect(html).not.toContain("<dt>Kategori</dt>");
  });

  it("takes the free-shipping threshold from Ayarlar and hides it at 0", async () => {
    const on = await pdp(base, 75000);
    expect(on).toContain("750₺ ve üzeri siparişte ücretsiz kargo");
    expect(on).not.toContain("500₺");
    const off = await pdp(base, 0);
    expect(off).not.toContain("ücretsiz kargo");
    expect(off).not.toContain("500₺");
  });

  it("does not promise an unconditional return", async () => {
    const html = await pdp(gift, 50000);
    expect(html).not.toContain("koşulsuz");
    expect(html).toContain("14 gün iade hakkı (istisnalar aşağıda)");
    // The closed accordions are not in the markup: their copy is read in
    // the source. The return text names the regulation's exceptions; no
    // literal threshold is left anywhere.
    const src = readFileSync(
      "src/components/laffogato/product-detail.tsx",
      "utf8",
    );
    expect(src).toContain("cayma hakkı");
    expect(src).toContain("Çabuk bozulabilen");
    expect(src).not.toMatch(/\d+₺ (ve )?üzeri/);
  });
});

describe("the quick look", () => {
  async function modal(product: Product): Promise<string> {
    const { ProductModal } = await import("@/components/laffogato/ui");
    return renderToStaticMarkup(
      createElement(ProductModal, {
        product,
        onClose: () => {},
        addToCart: () => {},
        contact,
      }),
    );
  }

  it("draws the same facts as the product page, no fixed rows", async () => {
    for (const p of [base, gift, beans]) {
      const html = await modal(p);
      for (const fixed of FIXED_ROWS) expect(html, p.cat).not.toContain(fixed);
    }
    const nuts = await modal({ ...gift, tags: ["nuts"] });
    expect(nuts).toContain("Kuruyemiş (sert kabuklu meyve) içerir");
    expect(nuts).toContain('href="mailto:merhaba@laffogato.net"');
    expect(await modal(base)).not.toContain("açılmamış ürünlerde iade");
  });
});

describe("the shop page", () => {
  async function shop(
    products: Product[],
    freeShippingThreshold?: number,
  ): Promise<string> {
    const { PageShop } = await import("@/components/laffogato/shop-page");
    return renderToStaticMarkup(
      createElement(PageShop, {
        navigate: () => {},
        addToCart: () => {},
        openProduct: () => {},
        products,
        freeShippingThreshold,
      }),
    );
  }

  it("takes the free-shipping threshold from Ayarlar and drops it at 0", async () => {
    const on = await shop([base], 750);
    expect(on).toContain("750₺+ ücretsiz kargo");
    expect(on).toContain("750₺ ve üzeri siparişte");
    expect(on).toContain('data-count="4"');
    expect(on).not.toContain("500₺");
    // The return tile names the food exceptions (MSY m.15).
    expect(on).toContain("Gerekçesiz; bazı gıdalar hariç");
    expect(on).not.toContain("Açılmamış üründe kolay iade");
    const off = await shop([base], 0);
    expect(off).not.toContain("ücretsiz kargo");
    expect(off).not.toContain("Ücretsiz kargo");
    expect(off).toContain('data-count="3"');
  });
});
