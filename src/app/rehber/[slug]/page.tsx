import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { guideGraphLd, recipeStepId } from "@/lib/seo/guide-structured-data";
import { GUIDES, findGuide, relatedGuides } from "@/lib/seo/guides";
import { SITE, brandedTitle, metaDescription } from "@/lib/seo/site";
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
    title: brandedTitle(guide.metaTitle),
    description: metaDescription(guide.metaDescription),
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
      // No `images`: the guide's own card (opengraph-image.tsx beside this
      // file) fills og:image, and an `images` key here would hide it.
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
    <div className="guide-page">
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
            <time dateTime={guide.updatedAt}>
              {formatGuideDate(guide.updatedAt)}
            </time>
            <span aria-hidden>·</span>
            <span>{guide.readingMinutes} dakikalık okuma</span>
          </div>
        </header>

        {/* The dish, first: the page's largest paint, so it loads eagerly. A
            stock photograph names its photographer, as the Unsplash licence
            asks politely and the house does gladly. */}
        {guide.image && (
          <figure className="guide-hero">
            <Image
              src={guide.image.src}
              alt={guide.image.alt}
              width={guide.image.width}
              height={guide.image.height}
              priority
              sizes="(max-width: 920px) 100vw, 880px"
            />
            <figcaption>
              {guide.image.credit ? (
                <>
                  Fotoğraf:{" "}
                  <a
                    href={guide.image.credit.photoUrl}
                    target="_blank"
                    rel="noopener"
                  >
                    {guide.image.credit.name}
                  </a>
                  {guide.image.credit.source !== guide.image.credit.name &&
                    `, ${guide.image.credit.source}`}
                </>
              ) : (
                <>Fotoğraf: {"L'Affogato"}, Tuzla</>
              )}
            </figcaption>
          </figure>
        )}

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
              {guide.recipe ? (
                <li>
                  <a href="#tarif">Tarif: {guide.recipe.name}</a>
                </li>
              ) : null}
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

        {/* The recipe the page's Recipe JSON-LD describes, printed: structured
            data must describe what a reader can see. Each step carries the id
            its HowToStep `url` points at. */}
        {guide.recipe && (
          <section
            className="guide-recipe"
            id="tarif"
            aria-labelledby="tarif-baslik"
          >
            <div className="eyebrow">Tarif</div>
            <h2 id="tarif-baslik">{guide.recipe.name}</h2>
            <p className="guide-recipe-desc">{guide.recipe.description}</p>
            <dl className="guide-recipe-facts">
              <div>
                <dt>Hazırlık</dt>
                <dd>{guide.recipe.prepMinutes} dakika</dd>
              </div>
              <div>
                <dt>Miktar</dt>
                <dd>{guide.recipe.yield}</dd>
              </div>
            </dl>
            <h3>Malzemeler</h3>
            <ul className="guide-bullets">
              {guide.recipe.ingredients.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <h3>Yapılışı</h3>
            <ol className="guide-ordered">
              {guide.recipe.steps.map((step, i) => (
                <li key={i} id={recipeStepId(i)}>
                  {step}
                </li>
              ))}
            </ol>
          </section>
        )}

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
    </div>
  );
}

/**
 * "2026-09-01" → "1 Eylül 2026". A calendar date, not an instant: it is read
 * as UTC midnight and printed in UTC, so no zone can move it a day.
 */
function formatGuideDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])));
}
