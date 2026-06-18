import type { Metadata } from "next";

import { LaffogatoApp } from "@/components/laffogato/app";
import { SeoContent } from "@/components/laffogato/seo-content";
import {
  getSettings,
  listActiveShopHeroSlides,
  listActiveReels,
  listActivePress,
  listActiveStoryEvents,
  listActiveFranchisePackages,
  listActiveFranchiseSteps,
  listMenuForCustomer,
  listShopProducts,
} from "@/lib/admin/store";
import { DAYS_OF_WEEK, DAY_LABELS } from "@/lib/admin/days";
import { getSiteContent } from "@/lib/admin/site-content";
import { getActiveCustomer } from "@/lib/customer/auth";
import { FAQ } from "@/lib/seo/faq";
import { SITE } from "@/lib/seo/site";
import { siteGraphLd } from "@/lib/seo/structured-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${SITE.name} — Caffè · Gelato · Dolci · Tuzla, İstanbul`,
  description: SITE.longDescription,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.longDescription,
    url: "/",
    type: "website",
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
    reels,
    press,
    storyEvents,
    franchisePackages,
    franchiseSteps,
    content,
  ] = await Promise.all([
    searchParams,
    listShopProducts(),
    getSettings(),
    listMenuForCustomer(),
    getActiveCustomer(),
    listActiveShopHeroSlides(),
    listActiveReels(),
    listActivePress(),
    listActiveStoryEvents(),
    listActiveFranchisePackages(),
    listActiveFranchiseSteps(),
    getSiteContent(),
  ]);

  let notice: string | undefined;
  if (cart === "out_of_stock") {
    const remain = Number(available);
    const tail = Number.isFinite(remain) && remain >= 0 ? ` (kalan: ${remain})` : "";
    notice = `Üzgünüz, "${item ?? "ürün"}" için yeterli stok yok${tail}. Sepetinden adedini azaltıp tekrar dene.`;
  } else if (cart === "empty") {
    notice = "Sepetin boş — bir affogato seçip dene.";
  }

  const graph = siteGraphLd(menu, products);

  // Visit page contact block — driven by admin Ayarlar (settings).
  const visit = {
    addressLines: settings.address
      .split(/[\n,/]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    phone: settings.phone,
    email: settings.email,
    hours: DAYS_OF_WEEK.map((d) => {
      const h = settings.weeklyHours[d];
      return [DAY_LABELS[d], h.closed ? "Kapalı" : `${h.open} — ${h.close}`] as [string, string];
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
      />
      <LaffogatoApp
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
        freeShippingThreshold={Math.round(settings.shippingFreeThresholdMinor / 100)}
        shopHeroSlides={heroSlides.map((s) => ({
          id: s.id,
          title: s.title,
          subtitle: s.subtitle,
          imageUrl: s.imageUrl,
          ctaLabel: s.ctaLabel,
          ctaHref: s.ctaHref,
          textTheme: s.textTheme,
        }))}
        reels={reels.map((r) => ({ caption: r.caption, meta: r.meta, accent: r.accent }))}
        press={press.map((p) => ({ name: p.name, quote: p.quote }))}
        storyTimeline={storyEvents.map((e) => ({ y: e.year, t: e.title, d: e.body }))}
        franchisePackages={franchisePackages.map((p) => ({
          name: p.name,
          area: p.area,
          seats: p.seats,
          invest: p.invest,
          monthly: p.monthly,
          ideal: p.ideal,
          includes: p.includes,
          featured: p.featured,
        }))}
        franchiseSteps={franchiseSteps.map((s) => ({ n: s.step, t: s.title, d: s.body }))}
        content={content}
        visit={visit}
      />
    </>
  );
}
