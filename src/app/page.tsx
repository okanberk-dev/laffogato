import type { Metadata } from "next";

import { LaffogatoApp } from "@/components/laffogato/app";
import { SeoContent } from "@/components/laffogato/seo-content";
import {
  getPublicSettings,
  listActiveShopHeroSlides,
  listActivePress,
  listActiveStoryEvents,
  listMenuForCustomer,
  listShopProducts,
} from "@/lib/admin/store";
import { DAYS_OF_WEEK, DAY_LABELS } from "@/lib/admin/days";
import { getSiteContent } from "@/lib/admin/site-content";
import { getActiveCustomer } from "@/lib/customer/auth";
import { FAQ } from "@/lib/seo/faq";
import { SITE, openGraphDefaults } from "@/lib/seo/site";
import { siteGraphLd } from "@/lib/seo/structured-data";
import { isDegradedRequest } from "@/lib/db/health";
import { JsonLd } from "@/lib/seo/json-ld";

export const dynamic = "force-dynamic";

// Keyword-first local title (≤60 chars); `absolute` bypasses the layout title
// template so the brand isn't appended twice. The same string is used for
// og:title and twitter:title — the page used to publish three different
// titles, so a shared link and a search result named different things.
const HOME_TITLE = "Tuzla'da İtalyan Kahve, Affogato & Gelato — L'Affogato";

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: SITE.shortDescription,
  alternates: { canonical: "/" },
  openGraph: {
    ...openGraphDefaults(),
    title: HOME_TITLE,
    description: SITE.shortDescription,
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: SITE.shortDescription,
  },
};

interface PageProps {
  searchParams: Promise<{ cart?: string; item?: string; available?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const [
    { cart, item, available },
    products,
    settings,
    menu,
    customer,
    heroSlides,
    press,
    storyEvents,
    content,
  ] = await Promise.all([
    searchParams,
    listShopProducts(),
    getPublicSettings(),
    listMenuForCustomer(),
    getActiveCustomer(),
    listActiveShopHeroSlides(),
    listActivePress(),
    listActiveStoryEvents(),
    getSiteContent(),
  ]);

  let notice: string | undefined;
  if (cart === "out_of_stock") {
    const remain = Number(available);
    const tail =
      Number.isFinite(remain) && remain >= 0 ? ` (kalan: ${remain})` : "";
    notice = `Üzgünüz, "${item ?? "ürün"}" için yeterli stok yok${tail}. Sepetinden adedini azaltıp tekrar dene.`;
  } else if (cart === "empty") {
    notice = "Sepetin boş — bir affogato seçip dene.";
  } else if (cart === "shop_closed") {
    notice =
      "Mağaza şu an siparişe kapalı. Birazdan tekrar dener misin? Sepetin korunuyor.";
  } else if (cart === "not_found") {
    notice =
      "Sepetindeki bir ürün artık mevcut değil. Sepetini güncelleyip tekrar dene.";
  } else if (cart === "qty_too_high") {
    const max = Number(available);
    const cap = Number.isFinite(max) && max > 0 ? max : 99;
    notice = `"${item ?? "Bir ürün"}" için tek seferde en fazla ${cap} adet sipariş verilebilir. Daha fazlası için bizimle iletişime geç.`;
  }

  const graph = siteGraphLd(menu, products, settings);

  // Visit page contact block — driven by admin Ayarlar (settings).
  // `todayHours` is computed server-side (stable, no hydration mismatch) so the
  // home hero's "Açık" stat reflects the real opening hours for today.
  const todayKey = DAYS_OF_WEEK[(new Date().getDay() + 6) % 7];
  const todayH = settings.weeklyHours[todayKey];
  const todayHours = todayH.closed
    ? "Bugün kapalı"
    : `${todayH.open} — ${todayH.close}`;
  const visit = {
    addressLines: settings.address
      .split(/[\n,/]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    phone: settings.phone,
    email: settings.email,
    todayHours,
    hours: DAYS_OF_WEEK.map((d) => {
      const h = settings.weeklyHours[d];
      return [
        DAY_LABELS[d],
        h.closed ? "Kapalı" : `${h.open} — ${h.close}`,
      ] as [string, string];
    }),
  };

  return (
    <>
      <JsonLd data={graph} />
      <LaffogatoApp
        degraded={isDegradedRequest()}
        products={products}
        settings={{
          phone: settings.phone,
          email: settings.email,
          address: settings.address,
        }}
        menu={menu}
        notice={notice}
        seoSlot={<SeoContent faq={FAQ} />}
        wishlist={customer?.wishlist}
        isAuthenticated={!!customer}
        freeShippingThreshold={Math.round(
          settings.shippingFreeThresholdMinor / 100,
        )}
        shopHeroSlides={heroSlides.map((s) => ({
          id: s.id,
          title: s.title,
          subtitle: s.subtitle,
          imageUrl: s.imageUrl,
          ctaLabel: s.ctaLabel,
          ctaHref: s.ctaHref,
          textTheme: s.textTheme,
        }))}
        press={press.map((p) => ({ name: p.name, quote: p.quote }))}
        storyTimeline={storyEvents.map((e) => ({
          y: e.year,
          t: e.title,
          d: e.body,
        }))}
        content={content}
        visit={visit}
      />
    </>
  );
}
