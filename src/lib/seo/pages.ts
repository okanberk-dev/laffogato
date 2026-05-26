/**
 * Per-route SEO metadata for the SPA section pages (/menu, /magaza, etc.).
 *
 * Each entry feeds the Next.js `Metadata` export of its corresponding
 * `src/app/<path>/page.tsx` file, plus the breadcrumb JSON-LD emitted on
 * that page. The shape mirrors a CMS row so it can be swapped to Supabase
 * later without touching the route files.
 */

import type { Route } from "@/components/laffogato/chrome";
import { ROUTE_PATHS } from "@/components/laffogato/chrome";

import { SITE } from "./site";

export interface PageSeo {
  route: Route;
  path: string;
  title: string;
  description: string;
  keywords?: string[];
  breadcrumbLabel: string;
  /** Sitemap priority (0–1). Top-level shopping/menu pages get 0.9; brand
      pages get 0.7; supporting pages get 0.6. */
  priority: number;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
}

export const PAGE_SEO: Record<Route, PageSeo> = {
  home: {
    route: "home",
    path: ROUTE_PATHS.home,
    title: `${SITE.name} — Caffè · Gelato · Dolci · Maltepe Park, İstanbul`,
    description: SITE.longDescription,
    breadcrumbLabel: "Ana Sayfa",
    priority: 1.0,
    changefreq: "daily",
  },
  menu: {
    route: "menu",
    path: ROUTE_PATHS.menu,
    title: "Menü — Affogato, Matcha, Espresso, Gelato",
    description:
      "L'Affogato Maltepe Park menüsü: yenilebilir waffle kupada affogato, Uji ceremonial matcha bar, Sirena espresso, cold brew, fior di latte gelato. 5 kategori, 30+ ürün.",
    keywords: [
      "Maltepe Park menü",
      "affogato menü",
      "matcha bar İstanbul",
      "espresso menü",
      "gelato İstanbul",
      "yenilebilir kup menü",
    ],
    breadcrumbLabel: "Menü",
    priority: 0.95,
    changefreq: "weekly",
  },
  shop: {
    route: "shop",
    path: ROUTE_PATHS.shop,
    title: "Mağaza — Çekirdek Kahve, Edible Cup, Ekipman",
    description:
      "L'Affogato online mağaza: İtalyan kavurma çekirdek kahve, 1994 patentli edible cup, Bialetti × L'Affogato moka pot, bambu chasen, hediye seti. Türkiye'ye 1-3 iş günü kargo.",
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
    title: "Hikayemiz — 1987 Italia, 2026 İstanbul",
    description:
      "Üç kuşaklık aile geleneği: 1987'de Giancarlo Mancuso İtalya'da ilk L'Affogato barını açar; 2026'da Eda Mancuso markayı İstanbul Maltepe Park'a taşır. 1994 patentli edible cup, Bronte pistacchio, Sirena harmanı.",
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
  reels: {
    route: "reels",
    path: ROUTE_PATHS.reels,
    title: "Reels & Film — Bar Ardından",
    description:
      "L'Affogato Maltepe Park bar ardı: affogato hazırlanışı, strawberry matcha latte yapım sahnesi, fior di latte gelato batch, golden hour bar atmosferi. Kısa film arşivi.",
    keywords: [
      "L'Affogato Instagram",
      "affogato yapımı video",
      "matcha latte reels",
      "İstanbul kafe reels",
    ],
    breadcrumbLabel: "Reels",
    priority: 0.65,
    changefreq: "weekly",
  },
  visit: {
    route: "visit",
    path: ROUTE_PATHS.visit,
    title: "Ziyaret — Maltepe Park, İstanbul",
    description:
      "L'Affogato Maltepe Park açık-hava teras kahve barı. Adres: Cevizli Tugay Yolu Caddesi No:67, Maltepe. Her gün 10:00 — 23:00 açık. Tramvay Cevizli 5 dk, Marmaray Maltepe 8 dk. Rezervasyon mümkün.",
    keywords: [
      "Maltepe Park kafe adres",
      "Maltepe affogato yer",
      "Maltepe Park teras kafe",
      "kahve rezervasyon Maltepe",
    ],
    breadcrumbLabel: "Ziyaret · Maltepe Park",
    priority: 0.85,
    changefreq: "monthly",
  },
  franchise: {
    route: "franchise",
    path: ROUTE_PATHS.franchise,
    title: "Franchise — Kiosk, Bottega, Salone",
    description:
      "L'Affogato franchise paketleri: 24-160 m² 6-80 koltuk seçenekleri. Faema espresso makinesi, gelato vitrini, marka rehberi, 2-4 hafta açılış eğitimi dahil. Türkiye ve Avrupa için başvuru.",
    keywords: [
      "kahve franchise",
      "İtalyan kafe franchise",
      "kiosk franchise",
      "L'Affogato bayilik",
      "gelato franchise Türkiye",
    ],
    breadcrumbLabel: "Franchise",
    priority: 0.75,
    changefreq: "monthly",
  },
};

/** Category sub-routes under /menu — match data.ts MENU keys. */
export interface MenuCategoryRoute {
  slug: string;
  menuKey: string;
  title: string;
  description: string;
  keywords: string[];
  breadcrumbLabel: string;
}

export const MENU_CATEGORY_ROUTES: MenuCategoryRoute[] = [
  {
    slug: "affogato",
    menuKey: "affogato",
    title: "Affogato — Yenilebilir Waffle Kupada İmza Ritüeli",
    description:
      "1994 patentli yenilebilir waffle kupada Sirena espresso ve fior di latte gelato. 6 affogato çeşidi: classico, cioccolato, nocciola, pistacchio, matcha, strawberry. Maltepe Park imza menüsü.",
    keywords: [
      "affogato Maltepe Park",
      "yenilebilir kup",
      "edible cup affogato",
      "affogato pistacchio",
      "İtalyan affogato",
    ],
    breadcrumbLabel: "Affogato",
  },
  {
    slug: "matcha",
    menuKey: "matcha",
    title: "Matcha Bar — Uji Ceremonial Grade",
    description:
      "Japonya Uji bahçesi ceremonial grade matcha. Matcha latte, strawberry matcha latte, matcha tonic, matcha affogato, hojicha latte. Bambu chasen ile bar ardı dövülür.",
    keywords: [
      "matcha bar Maltepe",
      "Uji matcha İstanbul",
      "strawberry matcha latte",
      "ceremonial matcha",
      "matcha affogato",
    ],
    breadcrumbLabel: "Matcha Bar",
  },
  {
    slug: "espresso",
    menuKey: "espresso",
    title: "Espresso & Coffee — Sirena Harmanı",
    description:
      "18g in, 36g out, 27 saniye. Tek-origin Sirena harmanı her sabah taze kavrulur. Espresso, americano, cappuccino, latte, mocha, white mocha, filter coffee.",
    keywords: [
      "Sirena espresso",
      "İtalyan espresso Maltepe",
      "cappuccino Maltepe",
      "white mocha İstanbul",
      "filter coffee Maltepe",
    ],
    breadcrumbLabel: "Espresso & Coffee",
  },
  {
    slug: "cold",
    menuKey: "cold",
    title: "Cold Bar — Buzlu İçecekler",
    description:
      "24 saat yavaş demleme cold brew, espresso tonic, iced latte, shakerato, iced strawberry matcha, iced affogato. Mart'tan Ekim'e Maltepe Park terası için yaz menüsü.",
    keywords: [
      "cold brew İstanbul",
      "iced latte Maltepe",
      "shakerato",
      "iced affogato",
      "yaz menüsü Maltepe Park",
    ],
    breadcrumbLabel: "Cold Bar",
  },
  {
    slug: "gelato",
    menuKey: "gelato",
    title: "Gelato & Dolci — Dal Banco",
    description:
      "Her sabah 06:00'da çevrilen taze gelato. Fior di latte, stracciatella, nocciola, pistacchio, fondente, matcha. Tiramisù, bombolone, cannolo siciliano, cantucci & vin santo.",
    keywords: [
      "gelato İstanbul",
      "tiramisu Maltepe",
      "cannolo İstanbul",
      "bombolone",
      "fior di latte gelato",
    ],
    breadcrumbLabel: "Gelato & Dolci",
  },
];

/** Category sub-routes under /magaza — slug ↔ shop product cat mapping. */
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
    title: "Çekirdek Kahve — Sirena & Notturna",
    description:
      "İtalya'da kavrulan tek-origin çekirdek kahve. Sirena espresso blend (Brezilya + Etiyopya), Notturna filter lot (Kenya AA Nyeri). Whole bean, 200-250g paketler.",
    keywords: [
      "çekirdek kahve satın al",
      "İtalyan kavurma çekirdek",
      "Sirena espresso blend",
      "Kenya AA filter",
      "whole bean coffee Türkiye",
    ],
    breadcrumbLabel: "Çekirdek Kahve",
  },
  {
    slug: "hediye",
    productCat: "gift",
    title: "Hediye Seti — Edible Cup & Affogato Kit",
    description:
      "Affogato Kit for Two: 200g Sirena, iki edible kup, porselen kaşık. 6'lı edible waffle cup kutusu. Mekan ritüelini eve taşı — özel kahveseverler için ideal hediye.",
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
    title: "Ekipman — Moka Pot, Chasen, Cup Set",
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
    title: "Giyim — Apron & Tumbler",
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
    title: "Kiler — Matcha & Cantucci",
    description:
      "Japonya Uji ceremonial matcha (40g tin) ve Bronte pistacchio cantucci. Bar menümüzden eve uzanan saklayışlık raf — çekirdek harici tatlar.",
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
  return [...top, ...menuCats, ...shopCats];
}
