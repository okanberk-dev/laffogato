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
import { getSiteContent } from "@/lib/admin/site-content";
import { getActiveCustomer } from "@/lib/customer/auth";
import { isDegradedRequest } from "@/lib/db/health";

/**
 * Everything the customer shell renders from, loaded once.
 *
 * The home page built this inline and `renderSectionPage` built a smaller
 * version of its own, missing `visit`, `press`, `storyTimeline` and `content`.
 * Those are exactly the pages that display them: /ziyaret fell back to the
 * bundled address, phone and opening hours, so an owner who changed the
 * closing time in Ayarlar saw the home page and the footer update while the
 * contact page kept the old number — and /hikayemiz ignored the press quotes
 * and the timeline the admin panel exists to edit.
 */
export async function loadAppProps() {
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
    listActiveShopHeroSlides(),
    listActivePress(),
    listActiveStoryEvents(),
    getSiteContent(),
  ]);

  // Computed on the server so it is stable across hydration.
  const todayKey = DAYS_OF_WEEK[(new Date().getDay() + 6) % 7];
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
        addressLines: settings.address
          .split(/[\n,/]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        phone: settings.phone,
        email: settings.email,
        todayHours: todayH.closed
          ? "Bugün kapalı"
          : `${todayH.open} — ${todayH.close}`,
        hours: DAYS_OF_WEEK.map((d) => {
          const h = settings.weeklyHours[d];
          return [
            DAY_LABELS[d],
            h.closed ? "Kapalı" : `${h.open} — ${h.close}`,
          ] as [string, string];
        }),
      },
    },
  };
}
