import "server-only";

import {
  DAYS_OF_WEEK,
  DAY_LABELS,
  getPublicSettings,
  listActivePress,
  listActiveShopHeroSlides,
  listActiveStoryEvents,
  listMenuForCustomer,
  listShopProducts,
} from "@/lib/admin/store";
import { LOCATION } from "@/components/laffogato/data";
import { addressLines } from "@/lib/utils/format";
import { getSiteContent } from "@/lib/admin/site-content";
import { getActiveCustomer } from "@/lib/customer/auth";
import { isDegradedRequest } from "@/lib/db/health";
import { istanbulDay } from "@/lib/mobile/menu-mapper";

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
 */
export async function loadAppProps({
  // Only the shop page renders the hero carousel. Fetching its slides for
  // /menu, /ziyaret and /hikayemiz was a query and a client payload for
  // something those pages never show.
  withShopHero = true,
}: { withShopHero?: boolean } = {}) {
  const [
    products,
    settings,
    menu,
    customer,
    heroSlides,
    press,
    story,
    content,
  ] = await Promise.all([
    listShopProducts(),
    getPublicSettings(),
    listMenuForCustomer(),
    getActiveCustomer(),
    withShopHero ? listActiveShopHeroSlides() : Promise.resolve([]),
    listActivePress(),
    listActiveStoryEvents(),
    getSiteContent(),
  ]);

  // Computed on the server so it is stable across hydration - and at the
  // venue's clock, not the server's. `getDay()` on Vercel is UTC, so from
  // 00:00 to 03:00 in Tuzla the site's "Bugün" row showed yesterday's hours
  // while the app (bootstrap `opensAt`/`closesAt`) already showed today's.
  const todayKey = istanbulDay(new Date());
  const todayH = settings.weeklyHours[todayKey];

  return {
    settings,
    menu,
    products,
    customer,
    appProps: {
      degraded: isDegradedRequest(),
      products,
      settings: {
        phone: settings.phone,
        email: settings.email,
        address: settings.address,
        courierFeeMinor: settings.courierFeeMinor,
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
      heroImageUrl: settings.heroImageUrl || undefined,
      visit: {
        addressLines: addressLines(settings.address, LOCATION.address),
        phone: settings.phone,
        email: settings.email,
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
