import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/seo/og-card";
import { guideCard, guideHubCard } from "@/lib/seo/og-pages";
import { GUIDES, findGuide } from "@/lib/seo/guides";
import { SITE } from "@/lib/seo/site";

/**
 * A guide's link preview: its title, reading time and first sentence. The
 * guides are code, so every card is drawn at build time and an unknown slug
 * is a 404, as the page is.
 */
export const runtime = "nodejs";
export const dynamicParams = false;
export const alt = `${SITE.name} rehberinden bir yazı`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = findGuide(slug);
  return ogImage(guide ? guideCard(guide) : guideHubCard());
}
