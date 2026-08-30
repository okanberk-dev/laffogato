import "server-only";

import {
  LEGAL_DOCS,
  LEGAL_UPDATED,
  type LegalDoc,
} from "@/lib/legal/documents";
import { CHECKOUT_CONSENT_DOCS } from "@/lib/legal/meta";

/**
 * The contracts, for the app (docs/API-MOBILE.md §13).
 *
 * The app used to carry its own abridged copies. That is the one thing a
 * legal document may not be: a customer confirms the Ön Bilgilendirme Formu
 * and the Mesafeli Satış Sözleşmesi at checkout, the order records WHICH
 * revision they agreed to, and the text they were shown has to be that
 * revision. Serving from here makes the site the single source and a stale
 * app impossible.
 *
 * Split in two because the whole set is ~1.25 MB of JSON: a list a phone can
 * fetch in a breath, and one document at a time (largest is ~67 KB).
 */

export interface MobileLegalSummary {
  slug: string;
  title: string;
  shortTitle: string;
  category: string;
  summary: string;
  updatedAt: string;
}

export interface MobileLegalIndex {
  /** Revision label stamped on every document and recorded with consent. */
  updatedAt: string;
  /** Slugs the checkout step must show and record — in the order shown. */
  consentDocs: readonly string[];
  docs: MobileLegalSummary[];
}

function toSummary(doc: LegalDoc): MobileLegalSummary {
  return {
    slug: doc.slug,
    title: doc.title,
    shortTitle: doc.shortTitle,
    category: doc.category,
    summary: doc.summary,
    updatedAt: doc.updatedAt,
  };
}

export function legalIndex(): MobileLegalIndex {
  return {
    updatedAt: LEGAL_UPDATED,
    consentDocs: [...CHECKOUT_CONSENT_DOCS],
    docs: LEGAL_DOCS.map(toSummary),
  };
}

/** One document, whole. `null` when the slug is not a published contract. */
export function legalDoc(slug: string): LegalDoc | null {
  return LEGAL_DOCS.find((d) => d.slug === slug) ?? null;
}
