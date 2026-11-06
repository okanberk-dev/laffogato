import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Product } from "@/components/laffogato/data";
import {
  HomeTakeHome,
  pickTakeHomeProduct,
  takeHomeDetails,
} from "@/components/laffogato/home-take-home";

/**
 * "Evde L'Affogato" on the home page (owner's brief, 6 Kas 2026): one bag
 * of coffee from the live shop. Nothing on it is typed by hand - the name,
 * price, photo and stock are the product row's - and a page without a bag
 * in stock shows no section rather than a made-up one.
 */

const bag = (over: Partial<Product> = {}): Product => ({
  id: "prd-0001",
  slug: "sirena-espresso-blend",
  name: "Sirena - Espresso Harmanı",
  tag: "Çekirdek · 250 g",
  price: "320₺",
  priceMinor: 32000,
  desc: "Brezilya doğal + Etiyopya yıkanmış. Kakao, kuru incir, esmer şeker.",
  cat: "beans",
  img: "caramel",
  images: ["https://example.com/sirena.jpg"],
  ...over,
});

describe("which bag the home page puts forward", () => {
  const filter = bag({
    id: "prd-0002",
    slug: "notturna-filter-lot",
    name: "Notturna - Filtre Lotu",
  });

  it("takes the panel's featured coffee first", () => {
    const featured = { ...filter, featured: true };
    expect(pickTakeHomeProduct([bag(), featured])).toBe(featured);
  });

  it("then the espresso blend, then the first coffee in stock", () => {
    const sirena = bag();
    expect(pickTakeHomeProduct([filter, sirena])).toBe(sirena);
    expect(pickTakeHomeProduct([filter])).toBe(filter);
  });

  it("never a sold-out bag, a non-coffee or the seed without a slug", () => {
    expect(pickTakeHomeProduct([bag({ stock: 0 })])).toBeNull();
    expect(pickTakeHomeProduct([bag({ cat: "gift" })])).toBeNull();
    expect(pickTakeHomeProduct([bag({ slug: undefined })])).toBeNull();
    expect(pickTakeHomeProduct(undefined)).toBeNull();
  });
});

describe("the card", () => {
  it("lists only what the product row says, plus the shop's roast line", () => {
    expect(takeHomeDetails(bag())).toEqual([
      "Brezilya doğal + Etiyopya yıkanmış",
      "Kakao, kuru incir, esmer şeker",
      "Bologna'da haftalık kavrulur",
    ]);
    expect(
      takeHomeDetails(bag({ desc: "", notes: ["Kakao"], origin: "Brezilya" })),
    ).toEqual([
      "Notlar: Kakao",
      "Menşei: Brezilya",
      "Bologna'da haftalık kavrulur",
    ]);
  });

  it("prices from the minor units and links to the product page", () => {
    const html = renderToStaticMarkup(
      createElement(HomeTakeHome, { product: bag({ priceMinor: 34500 }) }),
    );
    expect(html).toContain("Sirena - Espresso Harmanı");
    expect(html).toContain("345");
    expect(html).toContain('href="/magaza/urun/sirena-espresso-blend"');
    expect(html).toContain('href="/magaza/cekirdek"');
    expect(html).toContain('src="https://example.com/sirena.jpg"');
  });

  it("is placed on the home page from the live products", () => {
    const home = readFileSync("src/components/laffogato/home-page.tsx", "utf8");
    expect(home).toContain("pickTakeHomeProduct(products)");
    expect(home).toContain("<HomeTakeHome product={takeHome} />");
  });
});
