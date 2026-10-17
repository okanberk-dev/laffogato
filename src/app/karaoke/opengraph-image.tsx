import { OG_JPEG, OG_SIZE, ogJpeg } from "@/lib/seo/og-card";
import { karaokeCard } from "@/lib/seo/og-pages";
import { SITE } from "@/lib/seo/site";

/** /karaoke's link preview: the room's drawing beside its line. Drawn at build time; no database. */
export const runtime = "nodejs";
export const alt = `${SITE.name} karaoke odası, köşkün üst katı: sahnede bir mikrofon`;
export const size = OG_SIZE;
export const contentType = OG_JPEG;

export default async function Image() {
  return ogJpeg(await karaokeCard());
}
