import Link from "next/link";

import type { FaqEntry } from "@/lib/seo/faq";
import { GUIDE_LINKS } from "@/lib/seo/guide-nav";
import { SITE } from "@/lib/seo/site";

/**
 * Server-rendered FAQ + rich content block.
 *
 * Lives at the bottom of the home page. Two reasons it exists:
 *
 * 1. **SEO/GEO** - search engines and LLM crawlers see semantic
 *    `<section>/<h2>/<details>` markup with all the brand-defining facts
 *    (location, hours, signature item, heritage) on a single HTML page.
 *    Hash-routed SPA sections (`#menu`, `#shop`, ...) don't get indexed
 *    independently, so the canonical answer set must live on `/`.
 *
 * 2. **Accessibility** - users hitting "find on page" (Cmd-F) for
 *    "rezervasyon", "saat", "vegan" land on a single block of answers
 *    instead of bouncing through tabs.
 *
 * Styled from globals.css (`.seo-block`): it used to carry its own inline
 * colours, which is how the retired house green outlived two palettes here.
 */
export function SeoContent({ faq }: { faq: FaqEntry[] }) {
  return (
    <section id="sss" aria-labelledby="sss-heading" className="seo-block">
      <div className="seo-block-inner">
        <div className="eyebrow">Sıkça sorulan sorular</div>
        {/* `.section-title`, not `.h1`: at clamp(36px, 5vw, 56px) this h2 was
            set LARGER than the page's own h1 sitting above it. */}
        <h2 id="sss-heading" className="section-title seo-block-title">
          L&rsquo;Affogato hakkında merak edilenler
        </h2>
        <p className="seo-block-lede">
          Tuzla&rsquo;daki kafe, menü, yenilebilir kup, rezervasyon ve online
          sipariş hakkında en çok sorulan soruların yanıtları.
        </p>

        {/* Show a concise set on-page; the full set still feeds FAQ JSON-LD.
            An inset grouped list: one panel, a hairline between questions,
            the disclosure chevron drawn in CSS (`.seo-faq summary::after`). */}
        <div className="seo-faq">
          {faq.slice(0, 6).map((entry, idx) => (
            <details key={idx}>
              <summary className="seo-faq-q">{entry.q}</summary>
              <p>{entry.a}</p>
            </details>
          ))}
        </div>

        <div className="seo-facts">
          <div>
            <h3 className="seo-facts-label">Adres</h3>
            <address>
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
            <h3 className="seo-facts-label">İletişim</h3>
            <p>
              <a href={`tel:${SITE.phoneE164}`}>{SITE.phone}</a>
              <br />
              <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
            </p>
          </div>
          <div>
            <h3 className="seo-facts-label">Saatler</h3>
            <p>Her gün: 09:00 - 02:00</p>
          </div>
          <div>
            <h3 className="seo-facts-label">Ulaşım</h3>
            <p>
              Marmaray Tuzla · 6 dk
              <br />
              E-5 / TEM Tuzla · 4 dk
              <br />
              Sabiha Gökçen · 15 dk
              <br />
              Ücretsiz vale
            </p>
          </div>
        </div>

        {/* Internal links into the rehber hub. This block renders on the home
            page and on every menu and shop category page, so the guides - which
            are the pages built to earn search traffic - are reachable from the
            site's highest-traffic surfaces rather than the footer alone. */}
        <div className="seo-guides">
          <h3 className="seo-facts-label">
            <Link href="/rehber">Daha fazlası - Rehber</Link>
          </h3>
          <ul>
            {GUIDE_LINKS.map((g) => (
              <li key={g.slug}>
                <Link href={`/rehber/${g.slug}`} className="chip-link">
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p className="seo-note">
          <strong>L&rsquo;Affogato Italia · sede principale</strong> -{" "}
          {SITE.parent.address}. İstanbul Tuzla şubesi, 1897&rsquo;de
          Bologna&rsquo;da kurulan markanın İtalya dışındaki ilk şubesidir. Tüm
          kahve, Bologna&rsquo;da Mancuso ailesi tarafından haftalık olarak
          kavrulur; matcha Japonya Uji bölgesinden, pistacchio Sicilya
          Bronte&rsquo;dan, fındık IGP Piemonte&rsquo;den, çikolata Sicilya
          Modica&rsquo;dan tedarik edilir.
        </p>
      </div>
    </section>
  );
}
