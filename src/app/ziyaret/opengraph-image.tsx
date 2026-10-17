import { OG_JPEG, OG_SIZE, ogJpeg } from "@/lib/seo/og-card";
import { visitCard } from "@/lib/seo/og-pages";
import { SITE } from "@/lib/seo/site";

/** /ziyaret's link preview: the köşk at night, the hours and the address. Drawn at build time; no database. */
export const runtime = "nodejs";
export const alt = `${SITE.name} Tuzla: 200 yıllık köşkün akşam görünümü`;
export const size = OG_SIZE;
export const contentType = OG_JPEG;

export default async function Image() {
  return ogJpeg(await visitCard());
}
