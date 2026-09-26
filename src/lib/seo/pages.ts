/**
 * Per-route SEO metadata for the SPA section pages (/menu, /magaza, etc.).
 *
 * Each entry feeds the Next.js `Metadata` export of its corresponding
 * `src/app/<path>/page.tsx` file, plus the breadcrumb JSON-LD emitted on
 * that page. The shape mirrors a CMS row so it can be swapped to the database
 * later without touching the route files.
 */

import { ROUTE_PATHS, type Route } from "@/components/laffogato/route-paths";

import { SITE } from "./site";

export interface PageSeo {
  route: Route;
  path: string;
  title: string;
  description: string;
  keywords?: string[];
  breadcrumbLabel: string;
  /** Sitemap priority (0-1). Top-level shopping/menu pages get 0.9; brand
      pages get 0.7; supporting pages get 0.6. */
  priority: number;
  changefreq:
    "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
}

export const PAGE_SEO: Record<Route, PageSeo> = {
  home: {
    route: "home",
    path: ROUTE_PATHS.home,
    title: `${SITE.name} - Caffè · Gelato · Dolci · Tuzla, İstanbul`,
    description: SITE.longDescription,
    breadcrumbLabel: "Ana Sayfa",
    priority: 1.0,
    changefreq: "daily",
  },
  menu: {
    route: "menu",
    path: ROUTE_PATHS.menu,
    title: "Menü - Matcha, Espresso, Buzlu Kahve, Tatlılar",
    description:
      "L'Affogato Tuzla menüsü: matcha bar, espresso, buzlu kahveler, frappe, smoothie, frozen, tatlılar ve atıştırmalıklar - 12 kategori, 82 lezzet.",
    keywords: [
      "Tuzla menü",
      "matcha bar İstanbul",
      "espresso menü",
      "buzlu kahve Tuzla",
      "San Sebastian cheesecake Tuzla",
      "Tuzla kafe fiyat listesi",
    ],
    breadcrumbLabel: "Menü",
    priority: 0.95,
    changefreq: "weekly",
  },
  shop: {
    route: "shop",
    path: ROUTE_PATHS.shop,
    title: "Mağaza - Çekirdek Kahve, Edible Cup, Ekipman",
    description:
      "Çekirdek kahve, yenilebilir kup, moka pot ve hediye setleri L'Affogato online mağazada. Tüm Türkiye'ye hızlı kargo.",
    keywords: [
      "L'Affogato mağaza",
      "çekirdek kahve online",
      "edible cup satın al",
      "moka pot Türkiye",
      "matcha chasen",
      "hediye kahve seti",
    ],
    breadcrumbLabel: "Mağaza",
    priority: 0.95,
    changefreq: "daily",
  },
  story: {
    route: "story",
    path: ROUTE_PATHS.story,
    title: "Hikayemiz - 1897 Italia, 2026 İstanbul",
    description:
      "L'Affogato'nun hikayesi: 1897 Bologna'da Mancuso ailesinin açtığı ilk bardan 2026 İstanbul Tuzla'daki Rum köşküne uzanan dört kuşaklık gelenek.",
    keywords: [
      "L'Affogato hikayesi",
      "İtalyan kafe markası",
      "edible cup tarihi",
      "Mancuso ailesi",
    ],
    breadcrumbLabel: "Hikayemiz",
    priority: 0.7,
    changefreq: "monthly",
  },
  visit: {
    route: "visit",
    path: ROUTE_PATHS.visit,
    title: "Ziyaret - Tuzla, İstanbul",
    description:
      "Tuzla'da 200 yıllık Rum köşkünde kahve barı: Postane Mah. Atatürk Cad. No: 28, Tuzla. Her gün 09:00 - 02:00 açık, karaoke odası ve rezervasyon.",
    keywords: [
      "Tuzla kafe adres",
      "Tuzla affogato yer",
      "Tuzla köşk kafe",
      "kahve rezervasyon Tuzla",
    ],
    breadcrumbLabel: "Ziyaret · Tuzla",
    priority: 0.85,
    changefreq: "monthly",
  },
};

/** Category sub-routes under /menu - match data.ts MENU keys. */
export interface MenuCategoryRoute {
  slug: string;
  menuKey: string;
  title: string;
  description: string;
  keywords: string[];
  breadcrumbLabel: string;
  /**
   * Presentation for the header dropdown and the footer "Menu" column, set
   * only on the categories that appear there. The navigation is built from
   * this list rather than its own hand-kept copy - the copy had drifted and
   * two of its five entries (`affogato`, `gelato`) pointed at routes that had
   * never existed, so the header's most prominent links returned 404.
   */
  nav?: {
    label: string;
    italian: string;
    hue: "caramel" | "dark" | "cream" | "matcha" | "strawberry" | "pistachio";
  };
}

export const MENU_CATEGORY_ROUTES: MenuCategoryRoute[] = [
  {
    slug: "matcha",
    menuKey: "matcha",
    title: "Matcha Bar - Strawberry Aşkı",
    description:
      "Siparişten sonra çırpılan ceremonial grade matcha. Matcha Latte, Çilekli Matcha ve Matcha Affogato - L'Affogato Tuzla matcha bar menüsü.",
    keywords: [
      "matcha bar Tuzla",
      "strawberry matcha",
      "matcha latte İstanbul",
      "matcha affogato",
      "ceremonial matcha",
    ],
    breadcrumbLabel: "Matcha Bar",
    nav: {
      label: "Matcha Bar",
      italian: "Uji ceremonial grade",
      hue: "matcha",
    },
  },
  {
    slug: "espresso",
    menuKey: "espresso",
    title: "Espresso - Sıcak Kahveler",
    description:
      "L'Affogato, espresso, americano, latte, flat white, cappuccino, mocha, spanish latte, cortado, Türk kahvesi ve filtre kahve. Çoğu M ve L boy servis edilir.",
    keywords: [
      "espresso Tuzla",
      "latte İstanbul",
      "flat white Tuzla",
      "Türk kahvesi Tuzla",
      "filtre kahve İstanbul",
    ],
    breadcrumbLabel: "Espresso",
    nav: {
      label: "Espresso",
      italian: "Dalla macchina",
      hue: "dark",
    },
  },
  {
    slug: "ice-coffee",
    menuKey: "ice-coffee",
    title: "Soğuk Kahveler",
    description:
      "Iced americano, iced caffè latte, iced mocha, iced spanish latte, cold brew ve çıtır latte. Buzlu kahvelerin tamamı M ve L boy hazırlanır.",
    keywords: [
      "buzlu kahve Tuzla",
      "cold brew İstanbul",
      "iced latte Tuzla",
      "iced spanish latte",
      "iced americano",
    ],
    breadcrumbLabel: "Soğuk Kahve",
    nav: {
      label: "Soğuk Kahve",
      italian: "Il banco freddo",
      hue: "caramel",
    },
  },
  {
    slug: "cold",
    menuKey: "cold",
    title: "Soğuk İçecekler",
    description:
      "Kahvesiz serinleticiler: günlük sürpriz karışım, cool lime, ev yapımı L'Af Limon, soda ve su.",
    keywords: [
      "soğuk içecek Tuzla",
      "limonata İstanbul",
      "cool lime",
      "kahvesiz içecek Tuzla",
    ],
    breadcrumbLabel: "Soğuk İçecekler",
    nav: {
      label: "Soğuk İçecekler",
      italian: "Rinfrescanti",
      hue: "strawberry",
    },
  },
  {
    slug: "hot",
    menuKey: "hot",
    title: "Sıcak İçecekler",
    description:
      "Chai tea latte, sıcak çikolata, beyaz sıcak çikolata, karamelli sıcak çikolata, salep ve demlik çay.",
    keywords: [
      "sıcak çikolata Tuzla",
      "salep İstanbul",
      "chai latte Tuzla",
      "kahvesiz sıcak içecek",
    ],
    breadcrumbLabel: "Sıcak İçecekler",
  },
  {
    slug: "frappe",
    menuKey: "frappe",
    title: "Frappe - Buzla Çırpılmış",
    description:
      "Klasik frappe, espresso frappe, mocha frappe ve caramel frappe. Buzla çırpılır, yoğun köpüklü servis edilir.",
    keywords: ["frappe Tuzla", "espresso frappe", "mocha frappe İstanbul"],
    breadcrumbLabel: "Frappe",
  },
  {
    slug: "smoothie",
    menuKey: "smoothie",
    title: "Smoothie - Meyve & Süt",
    description:
      "Blueberry, mango ve apple smoothie ile protein shake. Taze meyve ve sütle çırpılır; alternatif süt talep edilebilir.",
    keywords: ["smoothie Tuzla", "protein shake İstanbul", "mango smoothie"],
    breadcrumbLabel: "Smoothie",
  },
  {
    slug: "frozen",
    menuKey: "frozen",
    title: "Frozen - Meyveli Frozen",
    description:
      "Çilekli, frambuazlı, çarkıfelekli ve ananaslı frozen. Meyve püresi ve buzla hazırlanır; süt içermez.",
    keywords: ["frozen Tuzla", "çilekli frozen", "meyveli frozen İstanbul"],
    breadcrumbLabel: "Frozen",
  },
  {
    slug: "ice-tea",
    menuKey: "ice-tea",
    title: "Buzlu Çay - Limonlu ve Şeftalili",
    description:
      "Limonlu ve şeftalili soğuk çay. Buz ve taze meyve dilimiyle servis edilir.",
    keywords: ["buzlu çay Tuzla", "lemon ice tea", "şeftalili buzlu çay"],
    breadcrumbLabel: "Soğuk Çay",
  },
  {
    slug: "tatlilar",
    menuKey: "dessert",
    title: "Tatlılar - Vitrinden",
    description:
      "San Sebastian cheesecake, Donostia, magnolia çeşitleri, marlenka, brownie, tiramisu ve dondurmalı cookie aşkı. Günlük hazırlanır.",
    keywords: [
      "San Sebastian cheesecake Tuzla",
      "tatlı Tuzla",
      "magnolia İstanbul",
      "tiramisu Tuzla",
      "brownie İstanbul",
    ],
    breadcrumbLabel: "Tatlılar",
    nav: {
      label: "Tatlılar & Gelato",
      italian: "Dal banco",
      hue: "pistachio",
    },
  },
  {
    slug: "atistirmaliklar",
    menuKey: "snack",
    title: "Atıştırmalıklar - Yanında",
    description:
      "Karabuğday simit, rosbeef ve hindi fümeli sandviç, granola bar, hindistan cevizli bar, kakao protein bar ve Koska fındık.",
    keywords: [
      "sandviç Tuzla",
      "atıştırmalık İstanbul",
      "granola bar Tuzla",
      "karabuğday simit",
    ],
    breadcrumbLabel: "Atıştırmalıklar",
    nav: {
      label: "Atıştırmalıklar",
      italian: "Da mangiare",
      hue: "cream",
    },
  },
  {
    slug: "extras",
    menuKey: "extras",
    title: "Extras - Ekstralar",
    description:
      "Her içeceğe eklenebilen aroma şurubu, ekstra espresso shot ve alternatif süt (yulaf, badem, laktozsuz).",
    keywords: ["alternatif süt Tuzla", "yulaf sütü kahve", "extra shot"],
    breadcrumbLabel: "Ekstralar",
  },
];

/** Category sub-routes under /magaza - slug ↔ shop product cat mapping. */
export interface ShopCategoryRoute {
  slug: string;
  productCat: string;
  title: string;
  description: string;
  keywords: string[];
  breadcrumbLabel: string;
}

export const SHOP_CATEGORY_ROUTES: ShopCategoryRoute[] = [
  {
    slug: "cekirdek",
    productCat: "beans",
    title: "Çekirdek Kahve - Sirena & Notturna",
    description:
      "Bologna'da kavrulan tek-origin çekirdek kahve. Sirena espresso blend (Brezilya + Etiyopya), Notturna filter lot (Kenya AA Nyeri). Whole bean, 200-250g paketler.",
    keywords: [
      "çekirdek kahve satın al",
      "Bologna kavurma çekirdek",
      "Sirena espresso blend",
      "Kenya AA filter",
      "whole bean coffee Türkiye",
    ],
    breadcrumbLabel: "Çekirdek Kahve",
  },
  {
    slug: "hediye",
    productCat: "gift",
    title: "Hediye Seti - Edible Cup & Affogato Kit",
    description:
      "Affogato Kit for Two: 200g Sirena, iki edible kup, porselen kaşık. 6'lı edible waffle cup kutusu. Mekan ritüelini eve taşı - özel kahveseverler için ideal hediye.",
    keywords: [
      "kahve hediye seti",
      "affogato kit",
      "edible cup hediye",
      "kahve sevenler için hediye",
    ],
    breadcrumbLabel: "Hediye Seti",
  },
  {
    slug: "ekipman",
    productCat: "gear",
    title: "Ekipman - Moka Pot, Chasen, Cup Set",
    description:
      "Bialetti × L'Affogato 3-cup moka pot, bone china espresso cup seti, Nara'dan 80 dişli bambu chasen. Evde İtalyan ritüeli için seçilmiş ekipman.",
    keywords: [
      "Bialetti moka pot",
      "espresso cup seti",
      "bambu chasen",
      "matcha takımı",
      "kahve ekipmanı",
    ],
    breadcrumbLabel: "Ekipman",
  },
  {
    slug: "giyim",
    productCat: "merch",
    title: "Giyim - Apron & Tumbler",
    description:
      "Ağır kanvas önlük (deri boyun askısı, gravür L'Affogato amblemi), 350ml çift cidarlı emaye tumbler. Bar ekibinden esinlenilmiş günlük parçalar.",
    keywords: [
      "kahve aprons",
      "barista önlüğü",
      "emaye tumbler",
      "L'Affogato merch",
    ],
    breadcrumbLabel: "Giyim",
  },
  {
    slug: "kiler",
    productCat: "pantry",
    title: "Kiler - Matcha & Cantucci",
    description:
      "Japonya Uji ceremonial matcha (40g tin) ve Bronte pistacchio cantucci. Bar menümüzden eve uzanan saklayışlık raf - çekirdek harici tatlar.",
    keywords: [
      "Uji matcha tin",
      "ceremonial matcha satın al",
      "cantucci",
      "İtalyan bisküvi",
      "Bronte pistacchio",
    ],
    breadcrumbLabel: "Kiler",
  },
];

/** All sitemap-eligible page paths derived from the per-route SEO config. */
export function allSeoRoutes(): Array<{
  url: string;
  priority: number;
  changefreq: PageSeo["changefreq"];
}> {
  const top = Object.values(PAGE_SEO).map((p) => ({
    url: p.path,
    priority: p.priority,
    changefreq: p.changefreq,
  }));
  // Karaoke is a booking page rather than an SPA section, so it is not in
  // PAGE_SEO (whose entries are keyed by `Route`). It is listed here so the
  // sitemap knows about it. No keyword set is claimed for it: per CLAUDE.md
  // §15 a landing page gets one only after the volume is verified, and this
  // page exists to take bookings, not to rank.
  const karaoke = [
    { url: "/karaoke", priority: 0.7, changefreq: "monthly" as const },
  ];
  // Same reasoning as karaoke: /kampanyalar is a standalone page, not an SPA
  // section, so it has no `Route` key and no keyword claim. `daily` because
  // its contents are whatever the panel is running this week.
  const campaigns = [
    { url: "/kampanyalar", priority: 0.7, changefreq: "daily" as const },
  ];
  const menuCats = MENU_CATEGORY_ROUTES.map((c) => ({
    url: `/menu/${c.slug}`,
    priority: 0.8,
    changefreq: "weekly" as const,
  }));
  const shopCats = SHOP_CATEGORY_ROUTES.map((c) => ({
    url: `/magaza/${c.slug}`,
    priority: 0.8,
    changefreq: "weekly" as const,
  }));
  return [...top, ...karaoke, ...campaigns, ...menuCats, ...shopCats];
}
