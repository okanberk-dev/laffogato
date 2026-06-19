import type { FaqEntry } from "@/lib/seo/faq";
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
        background: "var(--bg-warm, #FAF6EE)",
        color: "var(--ink, #14100B)",
        padding: "80px 24px",
        borderTop: "1px solid rgba(20, 16, 11, 0.08)",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Sıkça Sorulan Sorular · FAQ
        </div>
        <h2
          id="sss-heading"
          className="h1"
          style={{ fontSize: "clamp(36px, 5vw, 56px)", marginBottom: 12 }}
        >
          L&rsquo;Affogato hakkında merak edilenler.
        </h2>
        <p
          style={{
            maxWidth: 640,
            color: "rgba(20, 16, 11, 0.7)",
            lineHeight: 1.6,
            marginBottom: 40,
            fontSize: 17,
          }}
        >
          Tuzla&rsquo;daki kafe, menü, yenilebilir kup, rezervasyon, online
          sipariş ve franchise süreçleri hakkında en çok sorulan soruların
          yanıtları.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          {faq.map((entry, idx) => (
            <details
              key={idx}
              style={{
                background: "#FFF",
                borderRadius: 16,
                border: "1px solid rgba(20, 16, 11, 0.08)",
                padding: "18px 22px",
                boxShadow: "0 1px 2px rgba(20, 16, 11, 0.04)",
              }}
            >
              <summary
                style={{
                  fontFamily: "var(--serif-display, Playfair Display, serif)",
                  fontSize: 19,
                  lineHeight: 1.4,
                  cursor: "pointer",
                  listStyle: "none",
                  fontWeight: 500,
                }}
              >
                {entry.q}
              </summary>
              <p
                style={{
                  marginTop: 12,
                  color: "rgba(20, 16, 11, 0.78)",
                  lineHeight: 1.65,
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
            borderTop: "1px solid rgba(20, 16, 11, 0.1)",
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
              Pzt — Per: 10:00 — 23:00
              <br />
              Cum — Cmt: 10:00 — 24:00
              <br />
              Pazar: 10:00 — 23:00
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

        <div
          style={{
            marginTop: 48,
            padding: 24,
            background: "rgba(20, 16, 11, 0.04)",
            borderRadius: 16,
            fontSize: 13,
            color: "rgba(20, 16, 11, 0.6)",
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: "rgba(20, 16, 11, 0.85)" }}>
            L&rsquo;Affogato Italia · sede principale
          </strong>{" "}
          — {SITE.parent.address}. İstanbul Tuzla şubesi, 1987&rsquo;de
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
