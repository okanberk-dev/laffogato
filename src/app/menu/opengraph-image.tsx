import { OG_JPEG, OG_SIZE, ogJpeg } from "@/lib/seo/og-card";
import { menuCard } from "@/lib/seo/og-pages";
import { SITE } from "@/lib/seo/site";

/** /menu's link preview: the signature cup, photographed at the köşk. Drawn at build time; no database. */
export const runtime = "nodejs";
export const alt = `${SITE.name} menüsü: yenilebilir kupada gelato ve espresso`;
export const size = OG_SIZE;
export const contentType = OG_JPEG;

export default async function Image() {
  return ogJpeg(await menuCard());
}
