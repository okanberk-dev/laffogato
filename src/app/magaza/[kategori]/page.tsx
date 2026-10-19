import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LaffogatoApp } from "@/components/laffogato/app";
import { SeoContent } from "@/components/laffogato/seo-content";
import {
  getPublicSettings,
  listActiveShopHeroSlides,
  listMenuForCustomer,
  listShopProducts,
} from "@/lib/admin/store";
import { getActiveCustomer } from "@/lib/customer/auth";
import { FAQ } from "@/lib/seo/faq";
import { SHOP_CATEGORY_ROUTES } from "@/lib/seo/pages";
import { breadcrumbLd, productListLd } from "@/lib/seo/structured-data";
import { isDegradedRequest } from "@/lib/db/health";
import { JsonLd } from "@/lib/seo/json-ld";
import { openGraphBase } from "@/lib/seo/site";
import { footerSettings, venueContact } from "@/lib/seo/contact";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ kategori: string }>;
}

export function generateStaticParams() {
  return SHOP_CATEGORY_ROUTES.map((c) => ({ kategori: c.slug }));
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { kategori } = await params;
  const cat = SHOP_CATEGORY_ROUTES.find((c) => c.slug === kategori);
  if (!cat) return { title: "Kategori bulunamadı" };
  const path = `/magaza/${cat.slug}`;
  return {
    title: cat.title,
    description: cat.description,
    keywords: cat.keywords,
    alternates: { canonical: path },
    openGraph: {
      ...openGraphBase(),
      title: cat.title,
      description: cat.description,
      url: path,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: cat.title,
      description: cat.description,
    },
  };
}

export default async function MagazaCategoryPage({ params }: RouteParams) {
  const { kategori } = await params;
  const cat = SHOP_CATEGORY_ROUTES.find((c) => c.slug === kategori);
  if (!cat) notFound();

  const [allProducts, settings, menu, customer, heroSlides] = await Promise.all(
    [
      listShopProducts(),
      getPublicSettings(),
      listMenuForCustomer(),
      getActiveCustomer(),
      listActiveShopHeroSlides(),
    ],
  );

  // Pre-filter shop products to the selected category for a focused landing
  // page. PageShop still renders its category sidebar so users can switch.
  const products = allProducts.filter((p) => p.cat === cat.productCat);

  const breadcrumb = breadcrumbLd([
    { name: "Ana Sayfa", url: "/" },
    { name: "Mağaza", url: "/magaza" },
    { name: cat.breadcrumbLabel, url: `/magaza/${cat.slug}` },
  ]);

  // The products this URL actually lists. Without it the category page had
  // only a breadcrumb, so a crawler saw the trail to the page but never what
  // was on it.
  const itemList = productListLd(
    products,
    {
      weeklyHours: settings.weeklyHours,
      shippingFlatMinor: settings.shippingFlatMinor,
      shippingFreeThresholdMinor: settings.shippingFreeThresholdMinor,
    },
    {
      path: `/magaza/${cat.slug}`,
      name: cat.title,
      description: cat.description,
    },
  );

  return (
    <>
      <JsonLd data={breadcrumb} />
      {itemList ? <JsonLd data={itemList} /> : null}
      <LaffogatoApp
        degraded={isDegradedRequest()}
        initialRoute="shop"
        products={products}
        settings={footerSettings(settings)}
        menu={menu}
        seoSlot={<SeoContent faq={FAQ} contact={venueContact(settings)} />}
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
