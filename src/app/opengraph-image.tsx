import { ImageResponse } from "next/og";

import { SITE } from "@/lib/seo/site";

/**
 * Dynamic OpenGraph image for the home page. Rendered at build time via
 * Next.js Image Response — no external image asset required.
 *
 * Output: 1200×630 PNG served at `/opengraph-image`.
 */

export const runtime = "nodejs";
export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #14100B 0%, #1F1813 55%, #2D2418 100%)",
          color: "#FAF6EE",
          display: "flex",
          flexDirection: "column",
          padding: "72px 80px",
          fontFamily: "serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 25% 30%, rgba(184, 138, 74, 0.22), transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(229, 95, 126, 0.12), transparent 55%)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 18,
            letterSpacing: 4,
            textTransform: "uppercase",
            opacity: 0.78,
            position: "relative",
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#C9A05A", display: "flex" }} />
          Italia · 1987 → İstanbul · 2026
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>
          <div style={{ fontSize: 132, lineHeight: 1, fontWeight: 600, letterSpacing: -3, display: "flex" }}>
            L&rsquo;Affogato
          </div>
          <div
            style={{
              fontSize: 56,
              marginTop: 24,
              fontStyle: "italic",
              color: "#C9A05A",
              display: "flex",
            }}
          >
            Drink it. Eat the cup.
          </div>
          <div
            style={{
              fontSize: 26,
              marginTop: 28,
              maxWidth: 820,
              lineHeight: 1.35,
              opacity: 0.86,
              display: "flex",
            }}
          >
            Caffè · Gelato · Dolci · Maltepe Park, İstanbul
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 18,
            opacity: 0.7,
            position: "relative",
          }}
        >
          <div style={{ display: "flex" }}>{SITE.url.replace(/^https?:\/\//, "")}</div>
          <div style={{ display: "flex" }}>Maltepe Park · Açık-hava teras</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
