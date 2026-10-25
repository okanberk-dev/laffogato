import { OG_JPEG, OG_SIZE, ogJpeg } from "@/lib/seo/og-card";
import { guideCard, guideHubCard } from "@/lib/seo/og-pages";
import { GUIDES, findGuide } from "@/lib/seo/guides";
import { SITE } from "@/lib/seo/site";

/**
 * A guide's link preview: its title, reading time, first sentence and the
 * guide's photograph (a JPEG, like every card that carries a photo). The
 * guides are code, so every card is drawn at build time and an unknown slug
 * is a 404, as the page is.
 */
export const runtime = "nodejs";
export const dynamicParams = false;
export const alt = `${SITE.name} rehberinden bir yazının başlığı ve ilk cümlesi`;
export const size = OG_SIZE;
export const contentType = OG_JPEG;

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
  return ogJpeg(guide ? await guideCard(guide) : guideHubCard());
}
