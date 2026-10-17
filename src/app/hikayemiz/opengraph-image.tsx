import { OG_JPEG, OG_SIZE, ogJpeg } from "@/lib/seo/og-card";
import { storyCard } from "@/lib/seo/og-pages";
import { SITE } from "@/lib/seo/site";

/** /hikayemiz's link preview: the köşk by day. Drawn at build time; no database. */
export const runtime = "nodejs";
export const alt = `${SITE.name} Tuzla'daki restore köşk`;
export const size = OG_SIZE;
export const contentType = OG_JPEG;

export default async function Image() {
  return ogJpeg(await storyCard());
}
