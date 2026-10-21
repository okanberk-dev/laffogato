import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/seo/og-card";
import { guideHubCard } from "@/lib/seo/og-pages";
import { SITE } from "@/lib/seo/site";

/** /rehber's link preview. Drawn at build time; no database. */
export const runtime = "nodejs";
export const alt = `${SITE.name} rehberi: kahve ve tatlı yazıları`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage(guideHubCard());
}
