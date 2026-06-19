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
import {
  getSettings,
  listActiveShopHeroSlides,
  listMenuForCustomer,
  listShopProducts,
} from "@/lib/admin/store";
import { getActiveCustomer } from "@/lib/customer/auth";
import { PAGE_SEO } from "@/lib/seo/pages";
import { SITE } from "@/lib/seo/site";
import {
  breadcrumbLd,
  localBusinessLd,
  menuLd,
} from "@/lib/seo/structured-data";

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
      // openGraph is shallow-merged across segments: re-declare the layout's
      // siteName/locale/image so they are not dropped on section pages.
      siteName: SITE.name,
      locale: SITE.locale,
      images: [
        {
          url: SITE.ogImage,
          width: SITE.ogImageWidth,
          height: SITE.ogImageHeight,
        },
      ],
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

  // Route-specific entity schema so each indexable URL carries the relevant
  // JSON-LD (not only the home page): the CafeOrCoffeeShop entity on /ziyaret,
  // the full Menu on /menu. Shared @ids let Google treat these as one entity.
  const extraLd: object[] = [];
  if (route === "visit") extraLd.push(localBusinessLd());
  if (route === "menu") extraLd.push(menuLd(menu));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      {extraLd.map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}
      <LaffogatoApp
        initialRoute={route}
        products={products}
        settings={{
          phone: settings.phone,
          email: settings.email,
          address: settings.address,
        }}
        menu={menu}
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
      />
    </>
  );
}
