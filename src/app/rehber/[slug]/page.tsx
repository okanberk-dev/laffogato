import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { guideGraphLd } from "@/lib/seo/guide-structured-data";
import { GUIDES, findGuide, relatedGuides } from "@/lib/seo/guides";
import { SITE } from "@/lib/seo/site";
import { JsonLd } from "@/lib/seo/json-ld";

/** Static at build time: the guides are code, not database rows. */
export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) return {};
  const url = `/rehber/${slug}`;
  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    keywords: guide.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: guide.metaTitle,
      description: guide.metaDescription,
      url,
      type: "article",
      siteName: SITE.name,
      locale: SITE.locale,
      publishedTime: guide.updatedAt,
      modifiedTime: guide.updatedAt,
      images: [
        {
          url: SITE.ogImage,
          width: SITE.ogImageWidth,
          height: SITE.ogImageHeight,
          alt: guide.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: guide.metaTitle,
      description: guide.metaDescription,
    },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) notFound();

  const related = relatedGuides(guide);

  return (
    <main className="guide-page">
      <JsonLd data={guideGraphLd(guide)} />

      <div className="guide-wrap">
        <nav className="guide-breadcrumb" aria-label="breadcrumb">
          <Link href="/">Ana Sayfa</Link>
          <span aria-hidden>/</span>
          <Link href="/rehber">Rehber</Link>
          <span aria-hidden>/</span>
          <span>{guide.title}</span>
        </nav>

        <header className="guide-head">
          <h1 className="h1">{guide.title}</h1>
          <p className="lede">{guide.excerpt}</p>
          <div className="guide-meta">
            <span className="eyebrow">Son güncelleme</span>
            <span>{guide.updatedAt}</span>
            <span aria-hidden>·</span>
            <span>{guide.readingMinutes} dakikalık okuma</span>
          </div>
        </header>

        {/* A table of contents doubles as the jump-links Google shows beneath
            a result, so the headings carry ids and this list points at them. */}
        {guide.sections.length > 3 && (
          <nav className="guide-toc" aria-label="İçindekiler">
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              İçindekiler
            </div>
            <ol>
              {guide.sections.map((s, i) => (
                <li key={i}>
                  <a href={`#bolum-${i + 1}`}>{s.heading}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <article className="guide-article">
          {guide.sections.map((s, i) => (
            <section key={i} className="guide-section">
              <h2 id={`bolum-${i + 1}`}>{s.heading}</h2>
              {s.paragraphs?.map((p, j) => (
                <p key={`p${j}`}>{p}</p>
              ))}
              {s.bullets && (
                <ul className="guide-bullets">
                  {s.bullets.map((b, j) => (
                    <li key={`b${j}`}>{b}</li>
                  ))}
                </ul>
              )}
              {s.ordered && (
                <ol className="guide-ordered">
                  {s.ordered.map((o, j) => (
                    <li key={`o${j}`}>{o}</li>
                  ))}
                </ol>
              )}
              {s.table && (
                <div className="guide-table-wrap">
                  <table className="guide-table">
                    <tbody>
                      {s.table.map((row, j) => (
                        <tr key={`t${j}`}>
                          <th scope="row">{row.key}</th>
                          <td>{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </article>

        {guide.faq.length > 0 && (
          <section className="guide-faq">
            <h2>Sık sorulanlar</h2>
            <dl>
              {guide.faq.map((f, i) => (
                <div key={i} className="guide-faq-item">
                  <dt>{f.q}</dt>
                  <dd>{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <footer className="guide-foot">
          {related.length > 0 && (
            <div className="guide-related">
              <div className="eyebrow" style={{ marginBottom: 14 }}>
                Devamı
              </div>
              <ul>
                {related.map((g) => (
                  <li key={g.slug}>
                    <Link href={`/rehber/${g.slug}`}>
                      <span className="guide-related-title">{g.title}</span>
                      <span className="guide-related-excerpt">{g.excerpt}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="guide-cta">
            <p>
              Tuzla&apos;daki köşkte hepsini tadabilirsin - menüye göz at ya da
              çekirdeği eve götür.
            </p>
            <div className="guide-cta-actions">
              <Link href="/menu" className="btn btn-primary btn-sm">
                Menü
              </Link>
              <Link href="/magaza" className="btn btn-ghost btn-sm">
                Mağaza
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
