import Image from "next/image";
import type { Metadata } from "next";

import { PageHero } from "@/components/laffogato/page-hero";
import Link from "@/components/link";
import { guideHubLd } from "@/lib/seo/guide-structured-data";
import { GUIDES } from "@/lib/seo/guides";
import { SITE } from "@/lib/seo/site";
import { JsonLd } from "@/lib/seo/json-ld";

const TITLE = "Rehber - Kahve, Matcha, Tiramisu ve Tatlı Tarifleri";
const DESCRIPTION =
  "Tiramisu tarifi, cold brew ve frappe nedir, spanish latte, chai latte, matcha ve affogato: Tuzla'daki barın mutfağından adım adım Türkçe rehberler.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/rehber" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/rehber",
    type: "website",
    siteName: SITE.name,
    locale: SITE.locale,
    // No `images`: /rehber draws its own card (opengraph-image.tsx).
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function GuideHubPage() {
  return (
    <div className="guide-page guide-page-hub">
      <JsonLd data={guideHubLd(GUIDES)} />

      {/* The opener spans the page; the breadcrumb and the cards under it
          share the site's content width. */}
      <PageHero
        image={{ src: "/rehber/espresso-cesitleri.webp" }}
        title="Rehber"
        lede="Bir affogato neden hemen içilir, matcha neden kaynar suyla acılaşır, tiramisu kaç saat dinlenir, cold brew neden saatlerce demlenir: hepsi tek tek, uygulanabilir biçimde."
      />

      <div className="wrap guide-hub">
        <nav className="guide-breadcrumb" aria-label="breadcrumb">
          <Link href="/">Ana Sayfa</Link>
          <span aria-hidden>/</span>
          <span>Rehber</span>
        </nav>

        <h2 className="t-display guide-hub-title">
          Barın arkasında öğrendiklerimiz
        </h2>
        <ul className="guide-hub-grid" role="list">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link href={`/rehber/${g.slug}`} className="guide-hub-card">
                <span className="t-display guide-hub-name">{g.title}</span>
                {g.image ? (
                  <span className="media ratio-6-5">
                    <Image
                      src={g.image.src}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 360px"
                    />
                  </span>
                ) : (
                  <span />
                )}
                <span className="t-small">{g.excerpt}</span>
                <span className="t-label">{g.readingMinutes} dk okuma</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
