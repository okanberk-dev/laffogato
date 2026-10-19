import "server-only";

import { cache } from "react";

import {
  HOME_SLIDES,
  type HomeSlide,
  type MenuCategory,
  type Product,
} from "@/components/laffogato/data";
import { homeSlidesInWindow, toHomeSlide } from "@/lib/admin/home-hero-core";
import { listHomeHeroSiteRowsLive } from "@/lib/admin/home-hero";
import { isPublishWindowOpen } from "@/lib/admin/publish-window";
import { contentDefaults, getSiteContentLive } from "@/lib/admin/site-content";
import {
  getSettings,
  listActiveAppPosts,
  listActivePressLive,
  listActiveShopHeroSlidesLive,
  listActiveStoryLive,
  listAppPosts,
  listMenuForCustomerLive,
  listProducts,
  listShopListingsLive,
  menuWithoutPrices,
  pressFallback,
  publicSettingsFallback,
  shopProductAt,
  storyFallback,
  type AdminAppPost,
  type AdminPress,
  type AdminSettings,
  type AdminShopHeroSlide,
  type AdminStoryEvent,
  type ShopCategoryId,
} from "@/lib/admin/store";
import { presentationCache } from "@/lib/cache/presentation";
import { TAG_CATALOG, TAG_SITE } from "@/lib/cache/tags";
import { isDegradedRequest, publicRead } from "@/lib/db/health";
import { CHECKOUT_CONSENT_DOCS, KARAOKE_CONSENT_DOCS } from "@/lib/legal/meta";
import {
  getPublishedLegalOverride,
  getPublishedLegalOverrideLive,
  type LegalDocOverride,
} from "@/lib/legal/store";

/**
 * What the public pages print, read through the Data Cache
 * (src/lib/cache/presentation.ts) so a page view does not wake the database.
 *
 * Every reader here is `publicRead(label, fallback, cached)`: the cache is
 * the INNER call, so a database outage returns the bundled fallback (and
 * marks the request degraded) but never stores it. A write expires the
 * entries it touches at once (src/lib/cache/tags.ts), so what a visitor
 * sees is what the panel saved.
 *
 * Display only. The readers in src/lib/admin/store.ts keep their names and
 * read live: checkout, karaoke, the app's API, the e-mails, the consent
 * versions and every admin page use those, and decide prices, stock and
 * orderability there (CLAUDE.md "Veritabanı Kesintisinde Davranış";
 * tests/site-data-cache.test.ts keeps those paths off this file).
 *
 * Nothing that depends on the hour is cached: today's hours, publish
 * windows and the home hero's slides are worked out per request from the
 * cached rows.
 */

// ── Settings ─────────────────────────────────────────────────────────────

/**
 * The settings as the public pages use them (footer, hours, contact, SEO
 * switch, app links). The staff notification recipients are blanked before
 * the entry is stored: no public page prints them, so they are not copied
 * into the cache.
 */
export function withoutRecipients(settings: AdminSettings): AdminSettings {
  return {
    ...settings,
    notificationEmail: "",
    orderNotifyEmails: "",
    orderNotifyRoles: [],
    karaokeNotifyEmail: "",
  };
}

const cachedSettings = presentationCache(
  "site-settings",
  async () => withoutRecipients(await getSettings()),
  [TAG_SITE],
);

/**
 * `getPublicSettings` for presentation, cached. Memoised per request: a
 * page's metadata, layout and body all ask.
 */
export const getSiteSettings = cache(async (): Promise<AdminSettings> =>
  publicRead("getSiteSettings", publicSettingsFallback(), () =>
    cachedSettings(),
  ),
);

// ── Shop ─────────────────────────────────────────────────────────────────

/**
 * The active products as the shop lists them (`ShopListing`): the mapped
 * product, never the raw row (that carries base64 photos, far past an
 * entry's size limit), and the discount's fields. The "was" price is
 * worked out per request (`shopProductAt`), so a discount appears and goes
 * on its own days however long the entry is kept. Memoised per request, so
 * a product page's metadata, body and related products ask the cache once
 * and see the same minute.
 */
const cachedListings = presentationCache("site-shop", listShopListingsLive, [
  TAG_CATALOG,
]);

const cachedShop = cache(async (): Promise<Product[]> => {
  const listings = await cachedListings();
  const now = new Date();
  return listings.map((l) => shopProductAt(l, now));
});

/**
 * `listShopProducts`, cached. An outage shows an empty shop, never bundled
 * products: a seed price is fiction (the same rule as the live reader).
 */
export async function listSiteShopProducts(): Promise<Product[]> {
  return publicRead("listSiteShopProducts", [] as Product[], () =>
    cachedShop(),
  );
}

/**
 * The shop list as this request may show it. A request that has already
 * seen the database down (a live read in it fell back: the signed-in
 * member's account, a cache miss) shows the empty shop the outage rule asks
 * for (CLAUDE.md "Veritabanı Kesintisinde Davranış"), even when the list
 * came from the cache: a member is the one visitor who could try to buy,
 * and the checkout is closed. Call it once the request's reads have
 * settled. A request that read nothing live cannot know and shows the last
 * real list; /odeme then closes on its own live read (docs/DATABASE.md
 * "Kesinti davranışına etkisi").
 */
export function shopForRequest(products: Product[]): Product[] {
  return isDegradedRequest() ? [] : products;
}

/**
 * One active product by slug, for the product page, from the cached list:
 * an unknown slug costs no query. Display only: checkout re-reads the
 * price and claims the stock in SQL.
 */
export const getSiteProductBySlug = cache(
  async (slug: string): Promise<Product | null> =>
    publicRead("getSiteProductBySlug", null, () =>
      getSiteProductBySlugStrict(slug),
    ),
);

/**
 * The same without the outage fallback: an unreachable database throws.
 * For the product's link-preview card, kept an hour, where a fallback
 * stored during a blip would outlive it.
 */
export async function getSiteProductBySlugStrict(
  slug: string,
): Promise<Product | null> {
  return (await cachedShop()).find((p) => p.slug === slug) ?? null;
}

/** Up to `limit` other active products of the category (cross-sell). */
export async function listSiteRelatedProducts(
  cat: ShopCategoryId,
  excludeId: string,
  limit = 4,
): Promise<Product[]> {
  return publicRead("listSiteRelatedProducts", [] as Product[], async () =>
    (await cachedShop())
      .filter((p) => p.cat === cat && p.id !== excludeId)
      .slice(0, limit),
  );
}

/** One product as the sitemap lists it. */
export interface SitemapProduct {
  slug: string;
  /** ISO text, "" when the row has none. */
  updatedAt: string;
  /** http(s) URLs and site paths only: no base64. */
  images: string[];
}

/**
 * The sitemap's product rows, cached. No fallback: the sitemap leaves the
 * products out when this throws, as it did.
 */
export const listSitemapProducts = presentationCache(
  "site-sitemap",
  async (): Promise<SitemapProduct[]> =>
    (await listProducts())
      .filter((p) => p.isActive)
      .map((p) => ({
        slug: p.slug,
        updatedAt: p.updatedAt ?? "",
        images: (p.images ?? [])
          .map((u) => u.trim())
          .filter((u) => /^https?:\/\//i.test(u) || u.startsWith("/")),
      })),
  [TAG_CATALOG],
);

// ── Menu ─────────────────────────────────────────────────────────────────

const cachedMenu = cache(
  presentationCache("site-menu", listMenuForCustomerLive, [TAG_CATALOG]),
);

/**
 * `listMenuForCustomer`, cached. An outage shows the bundled menu without
 * prices, never a bundled price.
 */
export async function listSiteMenu(): Promise<Record<string, MenuCategory>> {
  return publicRead("listSiteMenu", menuWithoutPrices(), () => cachedMenu());
}

// ── Editorial ────────────────────────────────────────────────────────────

const cachedShopHero = presentationCache(
  "site-shop-hero",
  listActiveShopHeroSlidesLive,
  [TAG_SITE],
);

export async function listSiteShopHeroSlides(): Promise<AdminShopHeroSlide[]> {
  return publicRead("listSiteShopHeroSlides", [] as AdminShopHeroSlide[], () =>
    cachedShopHero(),
  );
}

const cachedPress = presentationCache("site-press", listActivePressLive, [
  TAG_SITE,
]);

export async function listSitePress(): Promise<AdminPress[]> {
  return publicRead("listSitePress", pressFallback(), () => cachedPress());
}

const cachedStory = presentationCache("site-story", listActiveStoryLive, [
  TAG_SITE,
]);

export async function listSiteStory(): Promise<AdminStoryEvent[]> {
  return publicRead("listSiteStory", storyFallback(), () => cachedStory());
}

const cachedContent = presentationCache("site-content", getSiteContentLive, [
  TAG_SITE,
]);

/** `getSiteContent`, cached: the defaults overlaid with the panel's text. */
export async function getSiteContentForSite(): Promise<Record<string, string>> {
  return publicRead("getSiteContentForSite", contentDefaults(), () =>
    cachedContent(),
  );
}

const cachedHomeRows = presentationCache(
  "site-home-hero",
  listHomeHeroSiteRowsLive,
  [TAG_SITE],
);

/**
 * `listHomeSlidesForSite`, from cached rows: the rows are stored with their
 * served picture paths, and the publish window is read at `now`, per
 * request. The bundled slides stand in when none is live, as before.
 */
export async function listSiteHomeSlides(
  now: number = Date.now(),
): Promise<{ slides: HomeSlide[]; fromPanel: boolean }> {
  const rows = await publicRead("listSiteHomeSlides", null, () =>
    cachedHomeRows(),
  );
  const live = rows ? homeSlidesInWindow(rows, now) : [];
  if (live.length === 0) return { slides: HOME_SLIDES, fromPanel: false };
  return {
    slides: live.map((row) => toHomeSlide(row, row.image)),
    fromPanel: true,
  };
}

/** The active posts, and whether one still carries an inline (base64) photo. */
interface CachedPosts {
  posts: AdminAppPost[];
  inline: boolean;
}

const cachedAppPosts = presentationCache(
  "site-app-posts",
  async (): Promise<CachedPosts> => {
    const active = (await listAppPosts()).filter((p) => p.isActive);
    // The panel has taken https links only since September; a post saved
    // before that may still hold a base64 photo. Such a list is not stored:
    // /kampanyalar reads it live, as before.
    return active.some((p) => p.image.startsWith("data:"))
      ? { posts: [], inline: true }
      : { posts: active, inline: false };
  },
  [TAG_SITE],
);

/**
 * `listActiveAppPosts` for /kampanyalar: active rows cached, the publish
 * window read at `now`.
 */
export async function listSiteAppPosts(
  now: number = Date.now(),
): Promise<AdminAppPost[]> {
  const cached = await publicRead(
    "listSiteAppPosts",
    { posts: [], inline: false } as CachedPosts,
    () => cachedAppPosts(),
  );
  if (cached.inline) return listActiveAppPosts();
  return cached.posts.filter((p) => isPublishWindowOpen(p, now));
}

// ── Legal ────────────────────────────────────────────────────────────────

const cachedLegalOverride = presentationCache(
  "site-legal-override",
  getPublishedLegalOverrideLive,
  [TAG_SITE],
);

/**
 * The documents a checkout or a karaoke booking records its consent
 * against (rule 12): their /hukuk pages read the same row the recorded
 * version is worked out from (`checkoutConsentVersion`,
 * `karaokeConsentVersion`), never a cached copy of it. A lost expiry must
 * not let a customer open the contract in a new tab and read an older
 * text than the version their order names. Three pages, mostly opened from
 * the checkout; the karaoke one reads the settings live anyway.
 */
const LIVE_LEGAL_SLUGS: ReadonlySet<string> = new Set([
  ...CHECKOUT_CONSENT_DOCS,
  ...KARAOKE_CONSENT_DOCS,
]);

/**
 * The published override /hukuk/<slug> displays: cached, except for the
 * consent documents above, which read live.
 */
export const getSiteLegalOverride = cache(
  async (slug: string): Promise<LegalDocOverride | null> =>
    LIVE_LEGAL_SLUGS.has(slug)
      ? getPublishedLegalOverride(slug)
      : publicRead("getSiteLegalOverride", null, () =>
          cachedLegalOverride(slug),
        ),
);
