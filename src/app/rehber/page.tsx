import Link from "next/link";
import type { Metadata } from "next";

import {
  Illustration,
  type IllustrationName,
} from "@/components/laffogato/illustration";
import { PageHero } from "@/components/laffogato/page-hero";
import { guideHubLd } from "@/lib/seo/guide-structured-data";
import { GUIDES } from "@/lib/seo/guides";
import { SITE } from "@/lib/seo/site";
import { JsonLd } from "@/lib/seo/json-ld";

const TITLE = "Rehber - Affogato, Matcha, Espresso ve Tatlılar";
const DESCRIPTION =
  "Affogato nedir, matcha nasıl yapılır, flat white ile cortado farkı, San Sebastian cheesecake tarifi - Tuzla'daki barın mutfağından Türkçe rehberler.";

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

/** Each guide's card leads with a small drawing of its subject. */
const GUIDE_ART: Record<string, IllustrationName> = {
  "affogato-nedir": "rehber-affogato",
  "matcha-nedir": "rehber-matcha",
  "espresso-cesitleri": "rehber-espresso",
  "san-sebastian-cheesecake": "rehber-cheesecake",
  "yenilebilir-kahve-fincani": "rehber-kupa",
};

export default function GuideHubPage() {
  return (
    <div className="guide-page">
      <JsonLd data={guideHubLd(GUIDES)} />

      <div className="guide-wrap">
        <nav className="guide-breadcrumb" aria-label="breadcrumb">
          <Link href="/">Ana Sayfa</Link>
          <span aria-hidden>/</span>
          <span>Rehber</span>
        </nav>

        <PageHero
          scene="matcha"
          eyebrow="Il quaderno"
          title={["Barın arkasında", "öğrendiklerimiz"]}
          lede="Bir affogato neden hemen içilir, matcha neden kaynar suyla acılaşır, cortado ile flat white arasındaki fark nedir - hepsi tek tek, uygulanabilir biçimde."
        />

        <ul className="guide-hub-grid">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link href={`/rehber/${g.slug}`} className="guide-card">
                {GUIDE_ART[g.slug] ? (
                  <Illustration
                    name={GUIDE_ART[g.slug]}
                    className="guide-card-art"
                  />
                ) : null}
                <span className="guide-card-title">{g.title}</span>
                <span className="guide-card-excerpt">{g.excerpt}</span>
                <span className="guide-card-meta eyebrow">
                  {g.readingMinutes} dk okuma →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
