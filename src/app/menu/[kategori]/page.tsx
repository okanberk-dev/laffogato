import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LaffogatoApp } from "@/components/laffogato/app";
import { SeoContent } from "@/components/laffogato/seo-content";
import { getActiveCustomer } from "@/lib/customer/auth";
import { FAQ } from "@/lib/seo/faq";
import { MENU_CATEGORY_ROUTES } from "@/lib/seo/pages";
import { breadcrumbLd, menuSectionLd } from "@/lib/seo/structured-data";
import { isDegradedRequest } from "@/lib/db/health";
import { JsonLd } from "@/lib/seo/json-ld";
import { openGraphBase } from "@/lib/seo/site";
import { footerSettings, venueContact } from "@/lib/seo/contact";
import {
  getSiteSettings,
  listSiteMenu,
  listSiteShopHeroSlides,
  listSiteShopProducts,
  shopForRequest,
} from "@/lib/seo/site-data";

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

export default async function MenuCategoryPage({ params }: RouteParams) {
  const { kategori } = await params;
  const cat = MENU_CATEGORY_ROUTES.find((c) => c.slug === kategori);
  if (!cat) notFound();

  const [listed, settings, fullMenu, customer, heroSlides] = await Promise.all([
    listSiteShopProducts(),
    getSiteSettings(),
    listSiteMenu(),
    getActiveCustomer(),
    listSiteShopHeroSlides(),
  ]);

  if (!fullMenu[cat.menuKey]) notFound();
  // Empty when this request saw the database down (the member's account is
  // read live), cached list or not.
  const products = shopForRequest(listed);

  // Render only the chosen category so the page is laser-focused for SEO
  // and users see exactly what the URL promised.
  const filteredMenu = { [cat.menuKey]: fullMenu[cat.menuKey] };

  const breadcrumb = breadcrumbLd([
    { name: "Ana Sayfa", url: "/" },
    { name: "Menü", url: "/menu" },
    { name: cat.breadcrumbLabel, url: `/menu/${cat.slug}` },
  ]);

  // The one section this URL shows. /menu publishes the whole Menu; the
  // category pages published nothing but their breadcrumb, so the items a
  // visitor came for were invisible to structured-data consumers.
  const section = menuSectionLd(
    cat.menuKey,
    fullMenu[cat.menuKey],
    `/menu/${cat.slug}`,
  );

  return (
    <>
      <JsonLd data={breadcrumb} />
      {section ? <JsonLd data={section} /> : null}
      <LaffogatoApp
        degraded={isDegradedRequest()}
        initialRoute="menu"
        products={products}
        settings={{
          ...footerSettings(settings),
          // The day under the menu (Fiyat Etiketi Yön. m.5/2-d).
          menuPricesEffectiveDate: settings.menuPricesEffectiveDate,
        }}
        menu={filteredMenu}
        seoSlot={<SeoContent faq={FAQ} contact={venueContact(settings)} />}
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
