import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LaffogatoApp } from "@/components/laffogato/app";
import { SeoContent } from "@/components/laffogato/seo-content";
import {
  getSettings,
  listActiveShopHeroSlides,
  listMenuForCustomer,
  listShopProducts,
} from "@/lib/admin/store";
import { getActiveCustomer } from "@/lib/customer/auth";
import { FAQ } from "@/lib/seo/faq";
import { SHOP_CATEGORY_ROUTES } from "@/lib/seo/pages";
import { breadcrumbLd } from "@/lib/seo/structured-data";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ kategori: string }>;
}

export function generateStaticParams() {
  return SHOP_CATEGORY_ROUTES.map((c) => ({ kategori: c.slug }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
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

  const [allProducts, settings, menu, customer, heroSlides] = await Promise.all([
    listShopProducts(),
    getSettings(),
    listMenuForCustomer(),
    getActiveCustomer(),
    listActiveShopHeroSlides(),
  ]);

  // Pre-filter shop products to the selected category for a focused landing
  // page. PageShop still renders its category sidebar so users can switch.
  const products = allProducts.filter((p) => p.cat === cat.productCat);

  const breadcrumb = breadcrumbLd([
    { name: "Ana Sayfa", url: "/" },
    { name: "Mağaza", url: "/magaza" },
    { name: cat.breadcrumbLabel, url: `/magaza/${cat.slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <LaffogatoApp
        initialRoute="shop"
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
