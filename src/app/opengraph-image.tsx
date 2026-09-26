import { ImageResponse } from "next/og";

import {
  LAF_BEAN_PATH,
  LAF_LETTERS_PATH,
  LAF_VIEWBOX,
} from "@/components/laffogato/laf-paths";
import { SITE } from "@/lib/seo/site";

/**
 * Dynamic OpenGraph image for the home page. Rendered at build time via
 * Next.js Image Response - no external image asset required.
 *
 * Output: 1200×630 PNG served at `/opengraph-image`.
 */

export const runtime = "nodejs";
export const alt = `${SITE.name} - ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  // next/og rasterises this on the server, where CSS variables do not
  // resolve, so the palette is spelled out - the app icon's own (globals.css
  // :root since 25 Eyl 2026): the radial house green #23876a → #1d6d56 →
  // #0c3b2d, the L'Af mark in cream #fbf8f4 with its bean in brass #e8c877.
  const markHeight = 300;
  const markWidth = Math.round(
    (markHeight * LAF_VIEWBOX.width) / LAF_VIEWBOX.height,
  );
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background:
          "radial-gradient(circle at 30% 20%, #23876a 0%, #1d6d56 45%, #0c3b2d 100%)",
        color: "#fbf8f4",
        display: "flex",
        alignItems: "center",
        padding: "72px 84px",
        gap: 72,
        position: "relative",
      }}
    >
      <svg
        width={markWidth}
        height={markHeight}
        viewBox={`0 0 ${LAF_VIEWBOX.width} ${LAF_VIEWBOX.height}`}
      >
        <path fillRule="evenodd" fill="#fbf8f4" d={LAF_LETTERS_PATH} />
        <path fillRule="evenodd" fill="#e8c877" d={LAF_BEAN_PATH} />
      </svg>

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
            color: "#d3e2d9",
          }}
        >
          {/* The tricolore, on the dark ground: mint, cream, rose. */}
          <div style={{ display: "flex", width: 54, height: 6 }}>
            <div style={{ flex: 1, background: "#d3e2d9", display: "flex" }} />
            <div style={{ flex: 1, background: "#fbf8f4", display: "flex" }} />
            <div style={{ flex: 1, background: "#f6e9ec", display: "flex" }} />
          </div>
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
            color: "#e8c877",
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
            color: "#e6efe9",
            display: "flex",
          }}
        >
          Caffè · Gelato · Dolci · Tuzla, İstanbul
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 84,
          right: 84,
          bottom: 44,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 20,
          color: "#d3e2d9",
        }}
      >
        <div style={{ display: "flex" }}>
          {SITE.url.replace(/^https?:\/\//, "")}
        </div>
        <div style={{ display: "flex" }}>Tuzla · tarihi köşk</div>
      </div>
    </div>,
    { ...size },
  );
}
