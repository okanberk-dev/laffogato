import "server-only";

import {
  getSettings,
  listMenuItems,
  listProducts,
  MENU_CATEGORY_KEYS,
} from "@/lib/admin/store";
import { SITE } from "@/lib/seo/site";

import { CUSTOMIZATION, type Customization } from "./customization";
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
  const items = await listMenuItems();
  const active = items.filter((it) => it.isActive);
  return {
    categories: buildMobileMenuCategories(active, MENU_CATEGORY_KEYS, SITE.url),
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
      .map((p) => toMobileShopProduct(p, SITE.url)),
    shippingFlatMinor: settings.shippingFlatMinor,
    shippingFreeThresholdMinor: settings.shippingFreeThresholdMinor,
  };
}

export async function getBootstrap(): Promise<MobileBootstrap> {
  const settings = await getSettings();
  return buildBootstrap(settings, SITE);
}
