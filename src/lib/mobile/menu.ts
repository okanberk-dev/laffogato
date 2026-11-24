import "server-only";

import {
  getSettings,
  listMenuItems,
  listProducts,
  MENU_CATEGORY_KEYS,
} from "@/lib/admin/store";
import { listBranchAvailability } from "@/lib/admin/menu-availability";
import { listBranchPrices } from "@/lib/admin/menu-branch-prices";
import {
  branchPricesByItem,
  nextPriceAt,
  priceAtBranch,
  type BranchPriceRow,
} from "@/lib/panel/branch-prices-core";
import { HOME_BRANCH } from "@/lib/panel/branches";
import {
  itemsSoldAtBranch,
  laterStamp,
} from "@/lib/panel/menu-availability-core";
import { SITE } from "@/lib/seo/site";

import {
  customizationFor,
  optionPricesFromMenu,
  type Customization,
} from "./customization";
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

/**
 * The app's menu: Tuzla's by default (the app serves the Tuzla köşk; a
 * Marina table's order is still checked against Marina's "Satışta /
 * Tükendi" and priced at Marina's price when it is placed,
 * src/lib/admin/store.ts `resolveCafeLines`). `customization`'s paid
 * options are priced by their menu items (S8, `optionPricesFromMenu`), on
 * the menu or not.
 *
 * `branch` (`GET /menu?branch=`, 23 Kas 2026): the menu as that branch
 * sells it at `now`, its "Satışta / Tükendi" and, at a branch other than
 * home, its own prices (branch-prices-core.ts; the options stay the site's,
 * every branch's). `validUntil`: the branch's next price instant, when the
 * body changes with no write (null at home, or with none ahead). The home
 * branch's menu is read exactly as before: no price rows.
 */
export async function readMobileMenu(
  branch: string,
  now: Date,
): Promise<{ menu: MobileMenu; validUntil: string | null }> {
  const home = branch === HOME_BRANCH;
  // Settings for the KDV defaults: an item with no rate of its own shows the
  // menu's, and changing it in the panel changes the body (and the ETag).
  const [items, settings, availability, prices] = await Promise.all([
    listMenuItems(),
    getSettings(),
    listBranchAvailability(branch),
    home ? Promise.resolve([] as BranchPriceRow[]) : listBranchPrices(branch),
  ]);
  const byItem = branchPricesByItem(prices);
  const since = new Map<string, string>();
  const priced = home
    ? items
    : items.map((it) => {
        const price = priceAtBranch(it, byItem.get(it.id), now);
        if (price.from) since.set(it.id, price.from);
        return {
          ...it,
          priceMinor: price.priceMinor,
          priceMinorL: price.priceMinorL,
        };
      });
  const active = itemsSoldAtBranch(priced, availability);
  return {
    menu: {
      categories: buildMobileMenuCategories(
        active,
        MENU_CATEGORY_KEYS,
        SITE.url,
        settings.taxRates,
      ),
      customization: customizationFor(optionPricesFromMenu(items)),
      // A branch's "Tükendi" moves its own stamp, not the item's; so does
      // the instant its own price took effect.
      updatedAt: latestUpdatedAt(
        active.map((it) => ({
          ...it,
          updatedAt: laterStamp(
            laterStamp(it.updatedAt, availability.get(it.id)?.updatedAt ?? ""),
            since.get(it.id) ?? "",
          ),
        })),
        now.toISOString(),
      ),
    },
    validUntil: home ? null : nextPriceAt(prices, now),
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
