import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { LEGAL_DOCS, findLegalDoc } from "@/lib/legal/documents";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { LegalMarkdown } from "@/lib/legal/markdown";
import { liveLegalDoc } from "@/lib/legal/karaoke-doc";
import { JsonLd } from "@/lib/seo/json-ld";
import { metaDescription, openGraphDefaults } from "@/lib/seo/site";
import { breadcrumbLd } from "@/lib/seo/structured-data";
import { getSiteLegalOverride } from "@/lib/seo/site-data";

import { LegalVersionView } from "./legal-version";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * `?surum=` turns the page into a stored version (./legal-version.tsx); its
 * mere presence does, so a malformed value is the not-found page rather
 * than today's text under an address that promised another one.
 */
async function versionParam(
  searchParams: SearchParams | undefined,
): Promise<{ prefix: string | string[] | undefined } | null> {
  const query = (await searchParams) ?? {};
  return Object.prototype.hasOwnProperty.call(query, "surum")
    ? { prefix: query.surum }
    : null;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: SearchParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = findLegalDoc(slug);
  if (!doc) return {};
  if (await versionParam(searchParams)) {
    // A stored version: never indexed, and nothing read for its head (the
    // body reads the version once).
    return {
      title: doc.title,
      robots: { index: false, follow: false },
    };
  }
  const override = await getSiteLegalOverride(slug);
  const title = override?.title || doc.title;
  const description = metaDescription(override?.summary || doc.summary);
  const url = `/hukuk/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    // Its own og:url - it used to inherit the layout's, so a shared legal
    // page unfurled as the home page.
    openGraph: {
      ...openGraphDefaults(),
      title: `${title} · L'Affogato`,
      description,
      url,
      type: "article",
    },
  };
}

export default async function LegalDocPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: SearchParams;
}) {
  const { slug } = await params;
  const version = await versionParam(searchParams);
  if (version) {
    if (!findLegalDoc(slug)) notFound();
    return <LegalVersionView slug={slug} prefix={version.prefix} />;
  }
  // The karaoke terms are written for the panel's cancellation policy.
  const doc = await liveLegalDoc(slug);
  if (!doc) notFound();

  // Admin override (published + non-empty) replaces the coded default content.
  const override = await getSiteLegalOverride(slug);
  const title = override?.title || doc.title;
  const summary = override?.summary || doc.summary;
  const updatedAt = override?.effectiveDate || doc.updatedAt;

  return (
    <div className="legal-page">
      <JsonLd
        data={breadcrumbLd([
          { name: "Ana Sayfa", url: "/" },
          { name: "Hukuki bilgiler", url: "/hukuk" },
          { name: title, url: `/hukuk/${slug}` },
        ])}
      />
      <div className="legal-wrap legal-wrap-narrow">
        <header className="legal-head">
          <Link
            href="/hukuk"
            className="eyebrow"
            style={{ display: "inline-block", marginBottom: 16 }}
          >
            ← Hukuki bilgiler
          </Link>
          <div
            className="eyebrow"
            style={{ color: "var(--gold-deep)", marginBottom: 12 }}
          >
            {doc.category}
          </div>
          <h1 className="h1" style={{ marginBottom: 18 }}>
            {title}
          </h1>
          <p className="lede">{summary}</p>
          <div className="legal-meta">
            <span className="eyebrow">Son güncelleme</span>
            <span>{updatedAt}</span>
          </div>
        </header>

        {!override && doc.references && doc.references.length > 0 && (
          <aside className="legal-refs">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Yasal dayanaklar
            </div>
            <ul>
              {doc.references.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </aside>
        )}

        {override ? (
          <LegalMarkdown body={override.bodyMarkdown} />
        ) : (
          <article className="legal-article">
            {doc.sections.map((s, i) => (
              <section key={i} className="legal-section">
                <h2>{s.heading}</h2>
                {s.paragraphs?.map((p, j) => (
                  <p key={`p${j}`}>{p}</p>
                ))}
                {s.bullets && (
                  <ul className="legal-bullets">
                    {s.bullets.map((b, j) => (
                      <li key={`b${j}`}>{b}</li>
                    ))}
                  </ul>
                )}
                {s.ordered && (
                  <ol className="legal-ordered">
                    {s.ordered.map((o, j) => (
                      <li key={`o${j}`}>{o}</li>
                    ))}
                  </ol>
                )}
                {s.table && (
                  <div className="legal-table-wrap">
                    <table className="legal-table">
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
        )}

        <footer className="legal-foot">
          <div className="legal-foot-related">
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              Diğer belgeler
            </div>
            <ul>
              {LEGAL_DOCS.filter((d) => d.slug !== slug).map((d) => (
                <li key={d.slug}>
                  <Link href={`/hukuk/${d.slug}`}>{d.title} →</Link>
                </li>
              ))}
            </ul>
          </div>
          <p
            style={{
              marginTop: 28,
              fontSize: 12,
              color: "var(--ink-mute)",
              lineHeight: 1.6,
            }}
          >
            Bu belge bilgilendirme amaçlıdır ve hukuki tavsiye niteliği taşımaz.
            Spesifik bir mesele için lütfen avukatınıza danışın. Belgede güncel
            olmayan veya hata içerdiğini düşündüğünüz bir bilgi varsa{" "}
            <a
              href={`mailto:${LEGAL_ENTITY.email}`}
              style={{
                color: "var(--gold-deep)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              {LEGAL_ENTITY.email}
            </a>{" "}
            adresine yazın.
          </p>
        </footer>
      </div>
    </div>
  );
}
