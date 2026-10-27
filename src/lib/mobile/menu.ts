import "server-only";

import {
  getSettings,
  listMenuItems,
  listProducts,
  MENU_CATEGORY_KEYS,
} from "@/lib/admin/store";
import { SITE } from "@/lib/seo/site";

import { CUSTOMIZATION, type Customization } from "./customization";
import { falAiEnabled } from "./fal-core";
import {
  buildBootstrap,
  buildMobileMenuCategories,
  latestUpdatedAt,
  toMobileShopProduct,
  type MobileBootstrap,
  type MobileMenuCategory,
  type MobileShopProduct,
} from "./menu-mapper";

/**
 * Loaders behind the public mobile reads (docs/API-MOBILE.md §1, §2, §10).
 *
 * None of these degrade to bundled data. The menu and the shop carry prices,
 * bootstrap carries the courier fee: a fabricated number on any of them is
 * worse than a 503 the app already knows how to show. An unreachable database
 * therefore throws (`DbUnreachableError`) and the route maps it to 503.
 */

export interface MobileMenu {
  categories: MobileMenuCategory[];
  customization: Customization;
  updatedAt: string;
}

export async function listMenuForMobile(): Promise<MobileMenu> {
  // Settings for the KDV defaults: an item with no rate of its own shows the
  // menu's, and changing it in the panel changes the body (and the ETag).
  const [items, settings] = await Promise.all([listMenuItems(), getSettings()]);
  const active = items.filter((it) => it.isActive);
  return {
    categories: buildMobileMenuCategories(
      active,
      MENU_CATEGORY_KEYS,
      SITE.url,
      settings.taxRates,
    ),
    customization: CUSTOMIZATION,
    updatedAt: latestUpdatedAt(active, new Date().toISOString()),
  };
}

export interface MobileShop {
  products: MobileShopProduct[];
  shippingFlatMinor: number;
  shippingFreeThresholdMinor: number;
}

export async function listShopForMobile(): Promise<MobileShop> {
  const [products, settings] = await Promise.all([
    listProducts(),
    getSettings(),
  ]);
  return {
    products: products
      .filter((p) => p.isActive)
      .map((p) => toMobileShopProduct(p, SITE.url, settings.taxRates)),
    shippingFlatMinor: settings.shippingFlatMinor,
    shippingFreeThresholdMinor: settings.shippingFreeThresholdMinor,
  };
}

export async function getBootstrap(): Promise<MobileBootstrap> {
  const settings = await getSettings();
  // `app.fal.ai`: false since 27 Oct 2026, whatever the environment says
  // (fA'L retired, App Review 4.3(b), lafmobil karar 330). The field stays
  // because v1 only grows.
  return buildBootstrap(settings, SITE, new Date(), falAiEnabled());
}
