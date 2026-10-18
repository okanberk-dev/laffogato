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
