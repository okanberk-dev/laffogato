import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { MenuCategory } from "@/components/laffogato/data";

/**
 * What /menu, /menu/<kategori> and /masa/<kod> say about the food (18 Oct
 * 2026): each item's allergens once the panel has them (TGK Etiketleme Yön.
 * m.15/5), the KDV line and the day the prices started to apply under the
 * menu (Fiyat Etiketi Yön. m.5/2-c, d), and the cross-contact band with a
 * link to the food safety document. All three routes draw `PageMenu`.
 */

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
    prefetch?: boolean;
  }) => createElement("a", { href, ...rest }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    createElement("img", { src, alt }),
}));

const h = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
}));

vi.mock("@/lib/admin/store", () => ({
  DAYS_OF_WEEK: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  DAY_LABELS: {
    mon: "Pazartesi",
    tue: "Salı",
    wed: "Çarşamba",
    thu: "Perşembe",
    fri: "Cuma",
    sat: "Cumartesi",
    sun: "Pazar",
  },
  getPublicSettings: vi.fn(async () => h.settings),
  listActivePress: vi.fn(async () => []),
  listActiveShopHeroSlides: vi.fn(async () => []),
  listActiveStoryEvents: vi.fn(async () => []),
  listMenuForCustomer: vi.fn(async () => ({})),
  listShopProducts: vi.fn(async () => []),
}));
vi.mock("@/lib/admin/home-hero", () => ({
  listHomeSlidesForSite: vi.fn(async () => null),
}));
vi.mock("@/lib/admin/site-content", () => ({
  getSiteContent: vi.fn(async () => ({})),
}));
vi.mock("@/lib/customer/auth", () => ({
  getActiveCustomer: vi.fn(async () => null),
}));

const { PageMenu } = await import("@/components/laffogato/menu-page");
const { loadAppProps } = await import("@/lib/seo/app-props");

const props = {
  navigate: () => {},
  addToCart: () => {},
  openProduct: () => {},
};

const desserts = (
  items: MenuCategory["items"],
): Record<string, MenuCategory> => ({
  dessert: { title: "Tatlılar", sub: "", italian: "", note: "", items },
});

const ITEMS: MenuCategory["items"] = [
  {
    name: "Tiramisu",
    desc: "Mascarpone ve espresso.",
    price: "240₺",
    hue: "caramel",
    allergens: ["sut", "gluten", "yumurta"],
  },
  { name: "Su", desc: "0,5 lt.", price: "60₺", hue: "stone", allergens: [] },
  { name: "Simit", desc: "Karabuğday unlu.", price: "90₺", hue: "warm" },
];

function render(
  menu: Record<string, MenuCategory>,
  menuPricesEffectiveDate?: string,
) {
  return renderToStaticMarkup(
    createElement(PageMenu, {
      ...props,
      menu,
      settings: { menuPricesEffectiveDate },
    }),
  );
}

/** The card (article) that carries this name. */
function card(html: string, name: string): string {
  const cards = html.match(/<article[\s\S]*?<\/article>/g) ?? [];
  const found = cards.find((c) => c.includes(`>${name}</h3>`));
  expect(found, name).toBeDefined();
  return found!;
}

describe("each item's allergens (TGK m.15/5)", () => {
  it("lists the groups in annex order on the card, or says none", () => {
    const html = render(desserts(ITEMS), "2026-10-18");
    expect(card(html, "Tiramisu")).toContain(
      '<p class="menu-card-allergens"><span class="menu-card-allergens-key">Alerjenler:</span> gluten, yumurta, süt</p>',
    );
    expect(card(html, "Su")).toContain(
      '<span class="menu-card-allergens-key">Alerjenler:</span> yok</p>',
    );
  });

  it("says nothing for an item the panel has not entered yet", () => {
    const html = render(desserts(ITEMS));
    expect(card(html, "Simit")).not.toContain("menu-card-allergens");
  });

  it("shows on a single category page too (/menu/<kategori>)", () => {
    // One category in the menu is what /menu/<kategori> renders.
    const html = render(desserts([ITEMS[0]]), "2026-10-18");
    expect(html).toContain("gluten, yumurta, süt");
    expect(html).toContain("Fiyatların uygulanmaya başladığı tarih");
  });
});

describe("the price list's line under the menu (Fiyat Etiketi Yön. m.5/2)", () => {
  it("names the day under the grid when the panel has one", () => {
    const html = render(desserts(ITEMS), "2026-10-18");
    expect(html).toContain(
      '<p class="menu-price-note">Fiyatlarımıza KDV dahildir · Fiyatların uygulanmaya başladığı tarih: 18 Ekim 2026</p>',
    );
    expect(html.indexOf("menu-price-note")).toBeGreaterThan(
      html.indexOf('class="menu-grid"'),
    );
  });

  it("says only that prices include KDV without a day", () => {
    const html = render(desserts(ITEMS), "");
    expect(html).toContain(
      '<p class="menu-price-note">Fiyatlarımıza KDV dahildir.</p>',
    );
    expect(html).not.toContain("uygulanmaya başladığı");
  });

  it("is not drawn when no item, and so no price, is on screen", () => {
    const html = render(desserts([]), "2026-10-18");
    expect(html).not.toContain("menu-price-note");
  });
});

describe("the allergen band", () => {
  it("keeps the cross-contact line and links the food safety document", () => {
    const html = render(desserts(ITEMS));
    const band = html.slice(html.indexOf('data-row="menu-notes"'));
    expect(band).toContain(
      "Mutfağımızda süt, gluten, kuruyemiş ve soya ile çapraz temas olabilir.",
    );
    expect(band).toContain('href="/hukuk/gida-guvenligi-ve-alerjen"');
    // No gluten-free promise the shared kitchen could not keep (food safety
    // document §9: no product is promised free of an allergen).
    expect(band).not.toContain("pirinç bisküvili");
  });

  it("speaks of the product, as the rest of the menu does, not the panel's item", () => {
    const html = render(desserts(ITEMS));
    const band = html.slice(html.indexOf('data-row="menu-notes"'));
    // "Kalem" is the panel's word (and a pen); the menu page says "ürün".
    expect(band).toContain(
      "Ürünün içerdiği alerjenler kartında yazar; yazmıyorsa siparişten önce baristaya sor.",
    );
    expect(band).not.toMatch(/[Kk]alem/);
    const redlines = readFileSync("docs/LEGAL-REDLINES-2026-09.md", "utf8");
    expect(redlines).toContain(
      '"Ürünün içerdiği alerjenler kartında yazar; yazmıyorsa siparişten önce baristaya sor.',
    );
  });
});

describe("the day reaches all three routes", () => {
  it("loadAppProps (/menu, /masa/<kod>) hands it to the pages", async () => {
    h.settings = {
      phone: "",
      email: "",
      address: "",
      courierFeeMinor: 5500,
      pickupReadyMinutes: 15,
      mobileApp: { loyalty: { stampTarget: 8 } },
      shippingFreeThresholdMinor: 50000,
      heroImageUrl: "",
      weeklyHours: Object.fromEntries(
        ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [
          d,
          { open: "09:00", close: "23:00", closed: false },
        ]),
      ),
      menuPricesEffectiveDate: "2026-10-18",
    };
    const { appProps } = await loadAppProps({ withShopHero: false });
    expect(appProps.settings.menuPricesEffectiveDate).toBe("2026-10-18");
  });

  it("the category page passes it from its own settings read", () => {
    const page = readFileSync("src/app/menu/[kategori]/page.tsx", "utf8");
    expect(page).toMatch(
      /menuPricesEffectiveDate: settings\.menuPricesEffectiveDate/,
    );
    // /masa/<kod> renders loadAppProps' props as they are.
    const table = readFileSync("src/app/masa/[code]/page.tsx", "utf8");
    expect(table).toContain("{...appProps}");
    expect(table).toContain('initialRoute="menu"');
  });
});

describe("the food safety document §7 (decision OP-ALLERGEN-BOARD)", () => {
  it("says where each menu item's allergens are written, and only that", async () => {
    const { findLegalDoc, LEGAL_UPDATED } = await import(
      "@/lib/legal/documents"
    );
    const doc = findLegalDoc("gida-guvenligi-ve-alerjen");
    // Its own 19 Ekim 2026 gave way to the set's later revision (20 Ekim
    // 2026, tests/legal-dates.test.ts).
    expect(doc?.updatedAt).toBe(LEGAL_UPDATED);
    const s7 = doc!.sections.find((s) => s.heading.startsWith("7. "));
    const text = (s7?.paragraphs ?? []).join("\n");
    expect(text).toContain(
      "Kafe menüsündeki her kalemin içerdiği alerjen grupları, https://laffogato.net/menu adresindeki menüde kalemin yanında ve köşkte asılı alerjen tablosunda yazılıdır",
    );
    expect(text).toContain(
      "menüde ve köşkte asılı alerjen tablosunda her kalem için yazılı olarak verilir",
    );
    // It used to point at a list on the menu card and the app's item
    // screen that did not exist, and to staff alone as one of the ways.
    expect(text).not.toContain("mobil uygulamanın ürün detay ekranında");
    expect(text).not.toContain("veya personel aracılığıyla");
  });

  it("names the staff's part in a sentence that parses, recorded as it ships", async () => {
    const { LEGAL_CONTENT } = await import("@/lib/legal/content");
    const s7 = LEGAL_CONTENT.find(
      (d) => d.slug === "gida-guvenligi-ve-alerjen",
    )!.sections.find((s) => s.heading.startsWith("7. "))!;
    const paragraphs = s7.paragraphs ?? [];
    // "bu bilgi henüz yazılmamış bir kalemin ... personel bildirir" left the
    // staff without a clause of its own; the item the information is
    // missing for takes the genitive.
    const staff =
      "bu bilginin henüz yazılmadığı bir kalemin alerjenlerini personel siparişten önce bildirir.";
    expect(paragraphs[1]).toContain(staff);
    expect(paragraphs.join("\n")).not.toContain("bu bilgi henüz yazılmamış");
    // LEGAL-REDLINES records the changed text word for word: the first
    // paragraph from its changed sentence on, the second whole.
    const redlines = readFileSync("docs/LEGAL-REDLINES-2026-09.md", "utf8");
    const first = paragraphs[0]!;
    expect(redlines).toContain(
      `"... ${first.slice(first.indexOf("Ambalajsız olarak"))}"`,
    );
    expect(redlines).toContain(`"${paragraphs[1]}"`);
  });
});
