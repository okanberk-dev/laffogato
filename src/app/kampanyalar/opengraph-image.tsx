import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/seo/og-card";
import { campaignsCard } from "@/lib/seo/og-pages";
import { SITE } from "@/lib/seo/site";

/** /kampanyalar's link preview: two tickets, an offer and an evening. Drawn at build time; no database. */
export const runtime = "nodejs";
export const alt = `${SITE.name} kampanyaları ve etkinlikleri`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage(campaignsCard());
}
