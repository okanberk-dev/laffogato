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
 *
 * A slug with no active product is a 404, as the page is, kept an hour like
 * a card (see below). A database that cannot answer is an error, not a
 * stand-in card: on revalidation the last good card keeps being served
 * instead of a fallback kept for an hour.
 */
export const runtime = "nodejs";
export const revalidate = 3600;

export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}
/**
 * One sentence for every product (Next takes `alt` from this file, not per
 * slug), so it claims only what every card shows: a product of the shop. A
 * card can lack a photo (the coffee bag) or a price (a product priced 0).
 */
export const alt = `${SITE.name} mağazasından bir ürün`;
export const size = OG_SIZE;
export const contentType = OG_JPEG;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const card = await productCard(slug);
  // A returned 404, not `notFound()`: Next keeps a route's thrown 404 in the
  // incremental cache with no revalidation (it skips the segment's
  // `revalidate`; the answer went out with `s-maxage=31536000`), so a product
  // activated after its link was first fetched kept a 404 preview until the
  // next deploy. A returned 404 is kept an hour, as the card is.
  if (!card) return new Response(null, { status: 404 });
  return ogJpeg(card);
}
