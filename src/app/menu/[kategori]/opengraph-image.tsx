import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/seo/og-card";
import { menuCard, menuCategoryCard } from "@/lib/seo/og-pages";
import { MENU_CATEGORY_ROUTES } from "@/lib/seo/pages";
import { SITE } from "@/lib/seo/site";

/**
 * A menu category's link preview: its name on the house card. The
 * categories are code (pages.ts), so every card is drawn at build time and
 * an unknown slug is a 404, as the page is.
 */
export const runtime = "nodejs";
export const dynamicParams = false;
export const alt = `${SITE.name} menüsünden bir kategori`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return MENU_CATEGORY_ROUTES.map((c) => ({ kategori: c.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ kategori: string }>;
}) {
  const { kategori } = await params;
  const cat = MENU_CATEGORY_ROUTES.find((c) => c.slug === kategori);
  return ogImage(cat ? menuCategoryCard(cat) : await menuCard());
}
