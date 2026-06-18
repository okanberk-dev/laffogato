/**
 * Shared rendering shell for SPA section pages (/menu, /magaza, /hikayemiz,
 * /ziyaret, /franchise, /reels).
 *
 * Each `src/app/<section>/page.tsx` is a 5-line file that calls
 * `renderSectionPage("menu")` and exports the metadata from `pageMetadata`.
 * Per-page differences (filters, headings) belong inside the component, not
 * the route file.
 */

import { LaffogatoApp } from "@/components/laffogato/app";
import type { Route } from "@/components/laffogato/chrome";
import { SeoContent } from "@/components/laffogato/seo-content";
import {
  getSettings,
  listActiveShopHeroSlides,
  listMenuForCustomer,
  listShopProducts,
} from "@/lib/admin/store";
import { getActiveCustomer } from "@/lib/customer/auth";
import { FAQ } from "@/lib/seo/faq";
import { PAGE_SEO } from "@/lib/seo/pages";
import { breadcrumbLd } from "@/lib/seo/structured-data";

import type { Metadata } from "next";

export function pageMetadata(route: Route): Metadata {
  const seo = PAGE_SEO[route];
  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: { canonical: seo.path },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: seo.path,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
    },
  };
}

export async function renderSectionPage(route: Route) {
  const seo = PAGE_SEO[route];
  const [products, settings, menu, customer, heroSlides] = await Promise.all([
    listShopProducts(),
    getSettings(),
    listMenuForCustomer(),
    getActiveCustomer(),
    listActiveShopHeroSlides(),
  ]);

  const breadcrumb = breadcrumbLd([
    { name: "Ana Sayfa", url: "/" },
    { name: seo.breadcrumbLabel, url: seo.path },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <LaffogatoApp
        initialRoute={route}
        products={products}
        settings={{
          phone: settings.phone,
          email: settings.email,
          address: settings.address,
        }}
        menu={menu}
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
      />
    </>
  );
}
