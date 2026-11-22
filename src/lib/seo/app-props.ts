import "server-only";

import { DAYS_OF_WEEK, DAY_LABELS } from "@/lib/admin/store";
import { LOCATION } from "@/components/laffogato/data";
import { addressLines } from "@/lib/utils/format";
import { getActiveCustomer } from "@/lib/customer/auth";
import { isDegradedRequest } from "@/lib/db/health";
import { istanbulDay } from "@/lib/mobile/menu-mapper";
import { footerSettings, venueContact } from "@/lib/seo/contact";
import {
  getSiteContentForSite,
  getSiteSettings,
  listSiteHomeSlides,
  listSiteMenu,
  listSitePress,
  listSiteShopHeroSlides,
  listSiteShopProducts,
  listSiteStory,
  shopForRequest,
} from "@/lib/seo/site-data";

/**
 * Everything the customer shell renders from, loaded once.
 *
 * The home page built this inline and `renderSectionPage` built a smaller
 * version of its own, missing `visit`, `press`, `storyTimeline` and `content`.
 * Those are exactly the pages that display them: /ziyaret fell back to the
 * bundled address, phone and opening hours, so an owner who changed the
 * closing time in Ayarlar saw the home page and the footer update while the
 * contact page kept the old number - and /hikayemiz ignored the press quotes
 * and the timeline the admin panel exists to edit.
 *
 * Read through the Data Cache (src/lib/seo/site-data.ts): a page view by a
 * visitor who is not signed in reads nothing from the database. The member
 * (wishlist, signed-in state) is read live, from the cookie.
 */
export async function loadAppProps({
  // Only the shop page renders the hero carousel. Fetching its slides for
  // /menu, /ziyaret and /hikayemiz was a query and a client payload for
  // something those pages never show.
  withShopHero = true,
  // The same for the home page's hero (/admin/anasayfa-hero): only `/`
  // draws it.
  withHomeHero = false,
  // Whose "Satışta / Tükendi" the menu shows (src/lib/panel/branches.ts):
  // the site's pages are Tuzla's; a table's QR menu (/masa) its table's.
  menuBranch,
}: {
  withShopHero?: boolean;
  withHomeHero?: boolean;
  menuBranch?: string;
} = {}) {
  const [
    cachedProducts,
    settings,
    menu,
    customer,
    heroSlides,
    press,
    story,
    content,
    homeHero,
  ] = await Promise.all([
    listSiteShopProducts(),
    getSiteSettings(),
    listSiteMenu(menuBranch),
    getActiveCustomer(),
    withShopHero ? listSiteShopHeroSlides() : Promise.resolve([]),
    listSitePress(),
    listSiteStory(),
    getSiteContentForSite(),
    withHomeHero ? listSiteHomeSlides() : Promise.resolve(null),
  ]);

  // After every read: the signed-in member's account is read live, so a
  // member's request knows when the database is down and shows the empty
  // shop, cached list or not.
  const products = shopForRequest(cachedProducts);

  // Computed on the server so it is stable across hydration - and at the
  // venue's clock, not the server's. `getDay()` on Vercel is UTC, so from
  // 00:00 to 03:00 in Tuzla the site's "Bugün" row showed yesterday's hours
  // while the app (bootstrap `opensAt`/`closesAt`) already showed today's.
  const todayKey = istanbulDay(new Date());
  const todayH = settings.weeklyHours[todayKey];
  const contact = venueContact(settings);

  return {
    settings,
    contact,
    menu,
    products,
    customer,
    appProps: {
      degraded: isDegradedRequest(),
      products,
      settings: {
        ...footerSettings(settings),
        courierFeeMinor: settings.courierFeeMinor,
        // The panel's courier switch, the one POST /orders enforces: while
        // it is off the home and visit pages offer pickup only.
        courierEnabled: settings.mobileApp.ordering.deliveryEnabled,
        // The home page's order and rewards shortcuts (presentation only).
        pickupReadyMinutes: settings.pickupReadyMinutes,
        stampTarget: settings.mobileApp.loyalty.stampTarget,
        // The day under the menu (Fiyat Etiketi Yön. m.5/2-d).
        menuPricesEffectiveDate: settings.menuPricesEffectiveDate,
      },
      menu,
      wishlist: customer?.wishlist,
      isAuthenticated: !!customer,
      freeShippingThreshold: Math.round(
        settings.shippingFreeThresholdMinor / 100,
      ),
      shopHeroSlides: heroSlides.map((s) => ({
        id: s.id,
        title: s.title,
        subtitle: s.subtitle,
        imageUrl: s.imageUrl,
        ctaLabel: s.ctaLabel,
        ctaHref: s.ctaHref,
        textTheme: s.textTheme,
      })),
      press: press.map((p) => ({ name: p.name, quote: p.quote })),
      storyTimeline: story.map((e) => ({
        y: e.year,
        t: e.title,
        d: e.body,
      })),
      content,
      // The panel's live slides. Undefined while the bundled HOME_SLIDES
      // stand in (home-hero.ts): the client already ships those, so they
      // are not sent twice. Only `/` asks.
      homeSlides: homeHero?.fromPanel ? homeHero.slides : undefined,
      // "Hero görsel URL" replaces the first BUNDLED slide's photo; a slide
      // from the panel carries its own picture.
      heroImageUrl: homeHero?.fromPanel
        ? undefined
        : settings.heroImageUrl || undefined,
      visit: {
        addressLines: addressLines(settings.address, LOCATION.address),
        // A field cleared in the panel falls back to the bundled one, as
        // the footer does: "" printed nothing and dialled nothing.
        phone: contact.phone,
        email: contact.email,
        todayHours: todayH.closed
          ? "Bugün kapalı"
          : `${todayH.open} - ${todayH.close}`,
        hours: DAYS_OF_WEEK.map((d) => {
          const h = settings.weeklyHours[d];
          return [
            DAY_LABELS[d],
            h.closed ? "Kapalı" : `${h.open} - ${h.close}`,
          ] as [string, string];
        }),
      },
    },
  };
}
