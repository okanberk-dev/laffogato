import Link from "next/link";
import type { Metadata } from "next";

import { JsonLd } from "@/lib/seo/json-ld";
import { breadcrumbLd } from "@/lib/seo/structured-data";
import { PageHero } from "@/components/laffogato/page-hero";
import { LEGAL_CATEGORY_ORDER, LEGAL_DOCS } from "@/lib/legal/documents";
import { openGraphDefaults } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "Hukuki bilgiler",
  description:
    "L'Affogato kullanım şartları, gizlilik politikası, mesafeli satış sözleşmesi, iade hakları ve diğer hukuki belgeler.",
  alternates: { canonical: "/hukuk" },
  openGraph: {
    ...openGraphDefaults(),
    title: "Hukuki bilgiler · L'Affogato",
    description:
      "Kullanım şartları, gizlilik politikası, mesafeli satış sözleşmesi ve iade hakları.",
    url: "/hukuk",
    type: "website",
  },
};

export default function HukukIndexPage() {
  // Seed the map in the canonical category order so the grid reads
  // Sipariş → Ödeme → Veri → Site → Kurumsal regardless of doc order.
  const grouped = new Map<string, typeof LEGAL_DOCS>(
    LEGAL_CATEGORY_ORDER.map((c) => [c, [] as typeof LEGAL_DOCS]),
  );
  for (const d of LEGAL_DOCS) {
    const arr = grouped.get(d.category) ?? [];
    arr.push(d);
    grouped.set(d.category, arr);
  }

  return (
    <div className="legal-page legal-page-index">
      <JsonLd
        data={breadcrumbLd([
          { name: "Ana Sayfa", url: "/" },
          { name: "Hukuki bilgiler", url: "/hukuk" },
        ])}
      />
      {/* The opener spans the page; the index under it keeps its measure. */}
      <PageHero
        scene="porcelain"
        eyebrow="Hukuki belgeler"
        title={["Sözleşmeler", "ve haklarınız"]}
        lede="Sipariş öncesi okumanız gereken sözleşmeler, gizlilik politikamız ve kullanıcı haklarınız. Hepsi Türk mevzuatına göre hazırlandı; soru varsa yazın - birlikte adım atalım."
      >
        <Link href="/" className="page-hero-back">
          ← Anasayfa
        </Link>
      </PageHero>
      <div className="legal-wrap legal-wrap-index">
        <div className="legal-index-grid">
          {[...grouped.entries()]
            .filter(([, docs]) => docs.length > 0)
            .map(([cat, docs]) => (
              <section key={cat} className="legal-index-group">
                <div className="eyebrow" style={{ marginBottom: 18 }}>
                  {cat}
                </div>
                <ul>
                  {docs.map((d) => (
                    <li key={d.slug}>
                      <Link
                        href={`/hukuk/${d.slug}`}
                        className="legal-index-link"
                      >
                        <span className="legal-index-link-title">
                          {d.title}
                        </span>
                        <span className="legal-index-link-summary">
                          {d.summary}
                        </span>
                        <span className="eyebrow muted">
                          Güncel: {d.updatedAt} →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      </div>
    </div>
  );
}
