import {
  OG_CONTENT_TYPE,
  OG_GROUND,
  OG_HOST,
  OG_INK,
  OG_SIZE,
  OgFooter,
  OgMark,
  OgTricolore,
  ogImage,
} from "@/lib/seo/og-card";
import { SITE } from "@/lib/seo/site";

/**
 * Dynamic OpenGraph image for the home page, and for every page that has no
 * card of its own. Rendered at build time via Next.js Image Response - no
 * external image asset required.
 *
 * The palette, the mark and the footer live in `src/lib/seo/og-card.tsx`,
 * which the page cards (karaoke, menu, shop, ...) share; LAF_LETTERS_PATH
 * comes in through `OgMark`.
 *
 * Output: 1200×630 PNG served at `/opengraph-image`.
 */

export const runtime = "nodejs";
export const alt = `${SITE.name} - ${SITE.tagline}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OgImage() {
  return ogImage(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: OG_GROUND,
        color: OG_INK.cream,
        display: "flex",
        alignItems: "center",
        padding: "72px 84px",
        gap: 72,
        position: "relative",
      }}
    >
      <OgMark height={300} />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 24,
            fontWeight: 600,
            color: OG_INK.mint,
          }}
        >
          <OgTricolore />
          Bologna · 1897 → İstanbul · 2026
        </div>
        <div
          style={{
            fontSize: 104,
            lineHeight: 1,
            fontWeight: 700,
            letterSpacing: -3,
            marginTop: 26,
            display: "flex",
          }}
        >
          L&rsquo;Affogato
        </div>
        <div
          style={{
            fontSize: 46,
            marginTop: 20,
            fontWeight: 600,
            color: OG_INK.brass,
            display: "flex",
          }}
        >
          Drink it. Eat the cup.
        </div>
        <div
          style={{
            fontSize: 26,
            marginTop: 26,
            lineHeight: 1.35,
            color: OG_INK.mist,
            display: "flex",
          }}
        >
          Caffè · Gelato · Dolci · Tuzla, İstanbul
        </div>
      </div>

      <OgFooter left={OG_HOST} right="Tuzla · tarihi köşk" />
    </div>,
  );
}
