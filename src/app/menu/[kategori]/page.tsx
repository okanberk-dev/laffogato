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
import { MENU_CATEGORY_ROUTES } from "@/lib/seo/pages";
import { breadcrumbLd } from "@/lib/seo/structured-data";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ kategori: string }>;
}

export function generateStaticParams() {
  return MENU_CATEGORY_ROUTES.map((c) => ({ kategori: c.slug }));
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { kategori } = await params;
  const cat = MENU_CATEGORY_ROUTES.find((c) => c.slug === kategori);
  if (!cat) return { title: "Menü kategorisi bulunamadı" };
  const path = `/menu/${cat.slug}`;
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

export default async function MenuCategoryPage({ params }: RouteParams) {
  const { kategori } = await params;
  const cat = MENU_CATEGORY_ROUTES.find((c) => c.slug === kategori);
  if (!cat) notFound();

  const [products, settings, fullMenu, customer, heroSlides] =
    await Promise.all([
      listShopProducts(),
      getSettings(),
      listMenuForCustomer(),
      getActiveCustomer(),
      listActiveShopHeroSlides(),
    ]);

  if (!fullMenu[cat.menuKey]) notFound();

  // Render only the chosen category so the page is laser-focused for SEO
  // and users see exactly what the URL promised.
  const filteredMenu = { [cat.menuKey]: fullMenu[cat.menuKey] };

  const breadcrumb = breadcrumbLd([
    { name: "Ana Sayfa", url: "/" },
    { name: "Menü", url: "/menu" },
    { name: cat.breadcrumbLabel, url: `/menu/${cat.slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <LaffogatoApp
        initialRoute="menu"
        products={products}
        settings={{
          phone: settings.phone,
          email: settings.email,
          address: settings.address,
        }}
        menu={filteredMenu}
        seoSlot={<SeoContent faq={FAQ} />}
        wishlist={customer?.wishlist}
        isAuthenticated={!!customer}
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
