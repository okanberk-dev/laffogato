import type { Metadata } from "next";

import { LaffogatoApp } from "@/components/laffogato/app";
import { SeoContent } from "@/components/laffogato/seo-content";
import {
  getSettings,
  listMenuForCustomer,
  listShopProducts,
} from "@/lib/admin/store";
import { FAQ } from "@/lib/seo/faq";
import { SITE } from "@/lib/seo/site";
import { siteGraphLd } from "@/lib/seo/structured-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${SITE.name} — Caffè · Gelato · Dolci · Maltepe Park, İstanbul`,
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
  const [{ cart, item, available }, products, settings, menu] = await Promise.all([
    searchParams,
    listShopProducts(),
    getSettings(),
    listMenuForCustomer(),
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
      />
    </>
  );
}
