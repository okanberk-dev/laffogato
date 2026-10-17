import { OG_JPEG, OG_SIZE, ogJpeg } from "@/lib/seo/og-card";
import { productCard } from "@/lib/seo/og-product";
import { SITE } from "@/lib/seo/site";

/**
 * A product's link preview: its photo, name and KDV-included price
 * (src/lib/seo/og-product.tsx).
 *
 * Products are database rows, so no card is drawn at build: each is drawn
 * on its first request and kept for an hour. The empty
 * `generateStaticParams` is what makes that cache exist - without it the
 * route is dynamic and every crawler's request redrew the card (a database
 * read, sharp and a render). A price change reaches new previews within the
 * hour; sites that already fetched the image keep their own copy longer.
 */
export const runtime = "nodejs";
export const revalidate = 3600;

export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}
export const alt = `${SITE.name} mağazasından bir ürün: fotoğrafı, adı ve KDV dahil fiyatı`;
export const size = OG_SIZE;
export const contentType = OG_JPEG;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return ogJpeg(await productCard(slug));
}
