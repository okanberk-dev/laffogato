import type { ReactNode } from "react";

import type { LegalDoc } from "@/lib/legal/documents";
import { LegalMarkdown } from "@/lib/legal/markdown";
import type { CHECKOUT_CONSENT_DOCS } from "@/lib/legal/meta";
import type { LegalDocOverride } from "@/lib/legal/store";

/**
 * The two documents the payment step asks the customer to confirm, as they
 * open in a panel without leaving the page (ASK-OTH-2 (1) c): the same text
 * /hukuk/<slug> shows, a published panel override when there is one, else
 * the coded document.
 *
 * The page reads them (findLegalDoc + getPublishedLegalOverride, as
 * /hukuk/[slug] does) and renders the body here, on the server: the client
 * receives it as a rendered element, so the 24-contract registry never
 * reaches the browser bundle. No "use client", no I/O.
 */

export type CheckoutDocSlug = (typeof CHECKOUT_CONSENT_DOCS)[number];

export interface CheckoutDocument {
  slug: CheckoutDocSlug;
  title: string;
  /** "18 Ekim 2026": the override's effective date, else the document's. */
  updatedAt: string;
  body: ReactNode;
}

/** The document's text, in /hukuk/[slug]'s own markup and classes. */
export function CheckoutLegalBody({
  doc,
  override,
}: {
  doc: LegalDoc;
  override: LegalDocOverride | null;
}) {
  if (override) return <LegalMarkdown body={override.bodyMarkdown} />;
  return (
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
  );
}

/** One document for the panel, from what /hukuk/[slug] would show. */
export function checkoutDocument(
  slug: CheckoutDocSlug,
  doc: LegalDoc,
  override: LegalDocOverride | null,
): CheckoutDocument {
  return {
    slug,
    title: override?.title || doc.title,
    updatedAt: override?.effectiveDate || doc.updatedAt,
    body: <CheckoutLegalBody doc={doc} override={override} />,
  };
}
