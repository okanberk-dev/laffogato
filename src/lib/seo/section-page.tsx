/**
 * Shared rendering shell for SPA section pages (/menu, /magaza, /hikayemiz,
 * /ziyaret).
 *
 * Each `src/app/<section>/page.tsx` is a 5-line file that calls
 * `renderSectionPage("menu")` and exports the metadata from `pageMetadata`.
 * Per-page differences (filters, headings) belong inside the component, not
 * the route file.
 */

import { LaffogatoApp } from "@/components/laffogato/app";
import type { Route } from "@/components/laffogato/chrome";
import { PAGE_SEO } from "@/lib/seo/pages";
import { SITE } from "@/lib/seo/site";
import {
  breadcrumbLd,
  localBusinessLd,
  menuLd,
  productListLd,
} from "@/lib/seo/structured-data";

import type { Metadata } from "next";
import { loadAppProps } from "@/lib/seo/app-props";
import { JsonLd } from "@/lib/seo/json-ld";

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
  const { settings, menu, products, appProps } = await loadAppProps({
    withShopHero: route === "shop",
  });

  const breadcrumb = breadcrumbLd([
    { name: "Ana Sayfa", url: "/" },
    { name: seo.breadcrumbLabel, url: seo.path },
  ]);

  // Route-specific entity schema so each indexable URL carries the relevant
  // JSON-LD (not only the home page): the CafeOrCoffeeShop entity on /ziyaret,
  // the full Menu on /menu. Shared @ids let Google treat these as one entity.
  const extraLd: object[] = [];
  if (route === "visit") extraLd.push(localBusinessLd(settings));
  if (route === "menu") extraLd.push(menuLd(menu));
  // /magaza is the catalogue's own URL. It carried a breadcrumb and nothing
  // else, so the one listing page Google is meant to rank for the shop
  // published no products at all - the ItemList existed only on the home page.
  if (route === "shop") {
    const list = productListLd(products, settings, {
      path: seo.path,
      name: seo.title,
      description: seo.description,
    });
    if (list) extraLd.push(list);
  }

  return (
    <>
      <JsonLd data={breadcrumb} />
      {extraLd.map((ld, i) => (
        <JsonLd key={i} data={ld} />
      ))}
      <LaffogatoApp {...appProps} initialRoute={route} />
    </>
  );
}
