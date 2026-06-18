import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetail } from "@/components/laffogato/product-detail";
import { SiteChrome } from "@/components/laffogato/site-chrome";
import {
  getSettings,
  getShopProductBySlug,
  listRelatedShopProducts,
  type ShopCategoryId,
} from "@/lib/admin/store";
import { breadcrumbLd, singleProductLd } from "@/lib/seo/structured-data";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

const PATH = (slug: string) => `/magaza/urun/${slug}`;

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const product = await getShopProductBySlug(slug);
  if (!product) return { title: "Ürün bulunamadı · L'Affogato" };
  const title = `${product.name} — L'Affogato`;
  const description = product.desc.slice(0, 160);
  const path = PATH(slug);
  const ogImage =
    product.images?.find((u) => /^https?:\/\//i.test(u)) ?? undefined;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "website",
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProductDetailPage({ params }: RouteParams) {
  const { slug } = await params;
  const product = await getShopProductBySlug(slug);
  if (!product) notFound();

  const [related, settings] = await Promise.all([
    listRelatedShopProducts((product.cat as ShopCategoryId) ?? "beans", product.id ?? "", 4),
    getSettings(),
  ]);

  const breadcrumb = breadcrumbLd([
    { name: "Ana Sayfa", url: "/" },
    { name: "Mağaza", url: "/magaza" },
    { name: product.name.split("—")[0].trim(), url: PATH(slug) },
  ]);
  const productJsonLd = singleProductLd(product, PATH(slug));

  return (
    <SiteChrome
      settings={{
        phone: settings.phone,
        email: settings.email,
        address: settings.address,
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <ProductDetail product={product} related={related} />
    </SiteChrome>
  );
}
