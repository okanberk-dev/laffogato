import Link from "next/link";

import type { FaqEntry } from "@/lib/seo/faq";
import { GUIDE_LINKS } from "@/lib/seo/guide-nav";
import { SITE } from "@/lib/seo/site";

/**
 * Server-rendered FAQ + rich content block.
 *
 * Lives at the bottom of the home page. Two reasons it exists:
 *
 * 1. **SEO/GEO** — search engines and LLM crawlers see semantic
 *    `<section>/<h2>/<details>` markup with all the brand-defining facts
 *    (location, hours, signature item, heritage) on a single HTML page.
 *    Hash-routed SPA sections (`#menu`, `#shop`, ...) don't get indexed
 *    independently, so the canonical answer set must live on `/`.
 *
 * 2. **Accessibility** — users hitting "find on page" (Cmd-F) for
 *    "rezervasyon", "saat", "vegan" land on a single block of answers
 *    instead of bouncing through tabs.
 *
 * Styling stays minimal/inline so this component is self-contained and
 * doesn't need new entries in globals.css.
 */
export function SeoContent({ faq }: { faq: FaqEntry[] }) {
  return (
    <section
      id="sss"
      aria-labelledby="sss-heading"
      style={{
        background: "var(--bg-cream)",
        color: "var(--ink)",
        padding: "clamp(56px, 7vw, 88px) 24px",
        borderTop: "1px solid var(--ink-line)",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Sıkça Sorulan Sorular · FAQ
        </div>
        {/* `.section-title`, not `.h1`: at clamp(36px, 5vw, 56px) this h2 was
            set LARGER than the page's own h1 sitting above it. */}
        <h2 id="sss-heading" className="section-title">
          L&rsquo;Affogato hakkında merak edilenler.
        </h2>
        <p
          style={{
            maxWidth: 640,
            color: "var(--ink-soft)",
            lineHeight: 1.7,
            margin: "14px 0 40px",
            fontSize: 16,
          }}
        >
          Tuzla&rsquo;daki kafe, menü, yenilebilir kup, rezervasyon ve online
          sipariş hakkında en çok sorulan soruların yanıtları.
        </p>

        <div className="seo-faq" style={{ display: "grid", gap: 12 }}>
          {/* Show a concise, minimal set on-page; full set still feeds FAQ JSON-LD. */}
          {faq.slice(0, 6).map((entry, idx) => (
            <details
              key={idx}
              style={{
                background: "var(--bg)",
                borderRadius: "var(--r-lg)",
                border: "1px solid var(--ink-line)",
                padding: "18px 22px",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {/* `listStyle: none` removed the disclosure triangle and put
                  nothing back, so a closed row gave no sign it could open.
                  The marker is drawn in CSS (`.seo-faq summary::after`) and
                  rotates with `[open]`. The face is the site's one family —
                  this was still asking for the retired Playfair. */}
              <summary
                className="seo-faq-q"
                style={{
                  fontSize: 18,
                  lineHeight: 1.45,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                {entry.q}
              </summary>
              <p
                style={{
                  marginTop: 12,
                  color: "var(--ink-soft)",
                  lineHeight: 1.7,
                  fontSize: 15,
                }}
              >
                {entry.a}
              </p>
            </details>
          ))}
        </div>

        <hr
          style={{
            border: 0,
            borderTop: "1px solid var(--ink-line)",
            margin: "56px 0 40px",
          }}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 32,
          }}
        >
          <div>
            <h3 className="eyebrow" style={{ marginBottom: 10 }}>
              Adres
            </h3>
            <address
              style={{ fontStyle: "normal", lineHeight: 1.6, fontSize: 14 }}
            >
              {SITE.address.venue}
              <br />
              {SITE.address.streetAddress}
              <br />
              {SITE.address.postalCode} {SITE.address.addressLocality},{" "}
              {SITE.address.addressRegion}
              <br />
              Türkiye
            </address>
          </div>
          <div>
            <h3 className="eyebrow" style={{ marginBottom: 10 }}>
              İletişim
            </h3>
            <div style={{ lineHeight: 1.6, fontSize: 14 }}>
              <a href={`tel:${SITE.phoneE164}`} style={{ color: "inherit" }}>
                {SITE.phone}
              </a>
              <br />
              <a href={`mailto:${SITE.email}`} style={{ color: "inherit" }}>
                {SITE.email}
              </a>
            </div>
          </div>
          <div>
            <h3 className="eyebrow" style={{ marginBottom: 10 }}>
              Saatler
            </h3>
            <div style={{ lineHeight: 1.6, fontSize: 14 }}>
              Her gün: 09:00 - 01:00
            </div>
          </div>
          <div>
            <h3 className="eyebrow" style={{ marginBottom: 10 }}>
              Ulaşım
            </h3>
            <div style={{ lineHeight: 1.6, fontSize: 14 }}>
              Marmaray Tuzla · 6 dk
              <br />
              E-5 / TEM Tuzla · 4 dk
              <br />
              Sabiha Gökçen · 15 dk
              <br />
              Ücretsiz vale
            </div>
          </div>
        </div>

        {/* Internal links into the rehber hub. This block renders on the home
            page and on every menu and shop category page, so the guides — which
            are the pages built to earn search traffic — are reachable from the
            site's highest-traffic surfaces rather than the footer alone. */}
        <div style={{ marginTop: 48 }}>
          <h3 className="eyebrow" style={{ marginBottom: 14 }}>
            Daha fazlası - Rehber
          </h3>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {GUIDE_LINKS.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/rehber/${g.slug}`}
                  style={{
                    display: "inline-block",
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: "1px solid rgba(20, 61, 43, 0.14)",
                    background: "#fff",
                    fontSize: 13.5,
                    color: "var(--ink-soft, rgba(20,61,43,0.72))",
                    textDecoration: "none",
                  }}
                >
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div
          style={{
            marginTop: 48,
            padding: 24,
            background: "rgba(20, 61, 43, 0.04)",
            borderRadius: 16,
            fontSize: 13,
            color: "rgba(20, 61, 43, 0.6)",
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: "rgba(20, 61, 43, 0.85)" }}>
            L&rsquo;Affogato Italia · sede principale
          </strong>{" "}
          - {SITE.parent.address}. İstanbul Tuzla şubesi, 1987&rsquo;de
          Bologna&rsquo;da kurulan markanın İtalya dışındaki ilk şubesidir. Tüm
          kahve, Bologna&rsquo;da Mancuso ailesi tarafından haftalık olarak
          kavrulur; matcha Japonya Uji bölgesinden, pistacchio Sicilya
          Bronte&rsquo;dan, fındık IGP Piemonte&rsquo;den, çikolata Sicilya
          Modica&rsquo;dan tedarik edilir.
        </div>
      </div>
    </section>
  );
}
