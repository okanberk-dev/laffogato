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

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const product = await getShopProductBySlug(slug);
  if (!product) return { title: "Ürün bulunamadı · L'Affogato" };
  const SUFFIX = " — L'Affogato";
  const title =
    product.name.length + SUFFIX.length <= 60
      ? `${product.name}${SUFFIX}`
      : product.name.length <= 60
        ? product.name
        : `${product.name.slice(0, 57).trimEnd()}…`;
  const rawDesc = product.desc?.trim() ?? "";
  let description: string;
  if (rawDesc) {
    if (rawDesc.length <= 155) {
      description = rawDesc;
    } else {
      const sliced = rawDesc.slice(0, 155);
      const lastSpace = sliced.lastIndexOf(" ");
      description = `${(lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced).trimEnd()}…`;
    }
  } else {
    description = `${product.name} — L'Affogato mağazasından, Türkiye'ye kargo.`;
  }
  const path = PATH(slug);
  const ogImage =
    product.images?.find((u) => /^https?:\/\//i.test(u)) ?? undefined;
  const ogPrice =
    (product.price ?? "").replace(/[^\d.,]/g, "").replace(",", ".") ||
    undefined;
  const inStock = !(product.stock !== undefined && product.stock <= 0);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "L'Affogato",
      // og:type=product is emitted via `other` (not in Next's OpenGraph union).
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    other: {
      "og:type": "product",
      "product:availability": inStock ? "in stock" : "out of stock",
      ...(ogPrice
        ? {
            "product:price:amount": ogPrice,
            "product:price:currency": "TRY",
            "og:price:amount": ogPrice,
            "og:price:currency": "TRY",
          }
        : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProductDetailPage({ params }: RouteParams) {
  const { slug } = await params;
  const product = await getShopProductBySlug(slug);
  if (!product) notFound();

  const [related, settings] = await Promise.all([
    listRelatedShopProducts(
      (product.cat as ShopCategoryId) ?? "beans",
      product.id ?? "",
      4,
    ),
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
