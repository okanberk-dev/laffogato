import Link from "next/link";
import { notFound } from "next/navigation";

import type { LegalSection } from "@/lib/legal/documents";
import { LegalMarkdown } from "@/lib/legal/markdown";
import { isVersionPrefix } from "@/lib/legal/version-core";
import { findLegalVersionByPrefix } from "@/lib/legal/versions";

/**
 * `/hukuk/<slug>?surum=<prefix>`: a text as it was shown, from
 * `legal_doc_versions`, read-only (decision ASK-DURABLE). The confirmation
 * mails link it ("Aynı sürüme şu bağlantıdan da ulaşabilirsiniz") and so does
 * the copy they attach.
 *
 * The one branch of the legal pages that reads the database on every view,
 * and only when the parameter is there: /hukuk/<slug> without it reads what
 * it always read (tests/legal-version-page.test.ts,
 * tests/public-pages-cached-reads.test.ts). A prefix that is not lowercase
 * hex of the link's length or more, that names no stored text of THIS
 * document, or that names more than one, is the normal not-found page; the
 * value itself is never printed. The page is not indexed (page.tsx's
 * metadata).
 */
export async function LegalVersionView({
  slug,
  prefix,
}: {
  slug: string;
  prefix: string | string[] | undefined;
}) {
  if (typeof prefix !== "string" || !isVersionPrefix(prefix)) notFound();
  const stored = await findLegalVersionByPrefix(slug, prefix);
  if (!stored) notFound();
  const { doc } = stored.version;

  return (
    <div className="legal-page">
      <div className="legal-wrap legal-wrap-narrow">
        <header className="legal-head">
          <Link
            href={`/hukuk/${slug}`}
            className="eyebrow"
            style={{ display: "inline-block", marginBottom: 16 }}
          >
            ← Belgenin güncel metni
          </Link>
          <div
            className="eyebrow"
            style={{ color: "var(--gold-deep)", marginBottom: 12 }}
          >
            {doc.category}
          </div>
          <h1 className="h1" style={{ marginBottom: 18 }}>
            {doc.title}
          </h1>
          <p className="lede">{doc.summary}</p>
          <div className="legal-meta">
            <span className="eyebrow">Sürüm</span>
            <span>Bu metin {doc.updatedAt} tarihli sürümdür.</span>
          </div>
        </header>

        {doc.source === "coded" && doc.references.length > 0 && (
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

        {doc.source === "override" ? (
          <LegalMarkdown body={doc.bodyMarkdown} />
        ) : (
          <VersionSections sections={doc.sections} />
        )}

        <footer className="legal-foot">
          <p
            style={{
              marginTop: 28,
              fontSize: 14,
              color: "var(--ink-mute)",
              lineHeight: 1.6,
              overflowWrap: "anywhere",
            }}
          >
            Sürüm kimliği (SHA-256): {stored.version.hash}
          </p>
        </footer>
      </div>
    </div>
  );
}

/** The coded sections, in /hukuk/[slug]'s own markup and classes. */
function VersionSections({ sections }: { sections: LegalSection[] }) {
  return (
    <article className="legal-article">
      {sections.map((s, i) => (
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
  );
}
