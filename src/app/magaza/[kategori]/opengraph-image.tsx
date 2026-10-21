import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/seo/og-card";
import { shopCard, shopCategoryCard } from "@/lib/seo/og-pages";
import { SHOP_CATEGORY_ROUTES } from "@/lib/seo/pages";
import { SITE } from "@/lib/seo/site";

/**
 * A shop shelf's link preview: its name on the house card. The shelves are
 * code (pages.ts), so every card is drawn at build time and an unknown slug
 * is a 404, as the page is.
 */
export const runtime = "nodejs";
export const dynamicParams = false;
export const alt = `${SITE.name} mağazasından bir raf`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return SHOP_CATEGORY_ROUTES.map((c) => ({ kategori: c.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ kategori: string }>;
}) {
  const { kategori } = await params;
  const cat = SHOP_CATEGORY_ROUTES.find((c) => c.slug === kategori);
  return ogImage(cat ? shopCategoryCard(cat) : shopCard());
}
