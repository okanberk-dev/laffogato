import "server-only";

import { LEGAL_DOCS, type LegalDoc } from "@/lib/legal/documents";
import {
  consentVersionFrom,
  isLiveLegalOverride,
} from "@/lib/legal/consent-version";
import { karaokeLegalDocNow, liveLegalDoc } from "@/lib/legal/karaoke-doc";
import { CHECKOUT_CONSENT_DOCS } from "@/lib/legal/meta";
import {
  getPublishedLegalOverride,
  listLegalDocOverrides,
  type LegalDocOverride,
} from "@/lib/legal/store";

import { markdownToSections } from "./legal-markdown";

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
 * "The site" means what /hukuk/<slug> shows, and that is the coded document
 * unless an admin has published an override in /admin/hukuk. So the same
 * rule applies here: a published, non-empty override wins - title, summary,
 * effective date and body - and the coded document is the default under it.
 * The override body is Markdown; `markdownToSections` turns it into the
 * sections the app already renders.
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
  /**
   * The revision the checkout consent records (`legalConsent.version`):
   * `LEGAL_UPDATED`, or a later effective date of a published override on a
   * checkout document (`consentVersionFrom`). Each row in `docs` carries its
   * own date, which can be later.
   */
  updatedAt: string;
  /** Slugs the checkout step must show and record - in the order shown. */
  consentDocs: readonly string[];
  docs: MobileLegalSummary[];
}

/** Published overrides by slug. Empty when there are none - or no database. */
export type LegalOverrideMap = Readonly<Record<string, LegalDocOverride>>;

// ── Pure: coded document + override → what the app sees ─────────────────────

/** The override counts only when published with a body, like on the site. */
function isLive(o: LegalDocOverride | null | undefined): o is LegalDocOverride {
  return isLiveLegalOverride(o);
}

/**
 * The coded document with a live override laid over it. Mirrors the choices
 * /hukuk/<slug> makes: a blank override field keeps the coded value; the
 * references aside is dropped because the override text may no longer cite
 * them; slug, short title and category are identity and never change.
 */
export function applyLegalOverride(
  doc: LegalDoc,
  override: LegalDocOverride | null | undefined,
): LegalDoc {
  if (!isLive(override)) return doc;
  const { references: _references, ...rest } = doc;
  return {
    ...rest,
    title: override.title.trim() || doc.title,
    summary: override.summary.trim() || doc.summary,
    // A blank effective date falls back to the coded document's own date,
    // exactly as /hukuk/<slug> does (`override?.effectiveDate || doc.updatedAt`).
    updatedAt: override.effectiveDate.trim() || doc.updatedAt,
    sections: markdownToSections(override.bodyMarkdown, doc.shortTitle),
  };
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

/**
 * The index built from a known set of overrides - no I/O. `docs`: the coded
 * documents, the karaoke terms as of now (`karaokeLegalDocNow`) in the live
 * index.
 */
export function legalIndexFrom(
  overrides: LegalOverrideMap,
  docs: readonly LegalDoc[] = LEGAL_DOCS,
): MobileLegalIndex {
  return {
    // The same value an order placed now records, so the app can show it.
    updatedAt: consentVersionFrom(overrides),
    consentDocs: [...CHECKOUT_CONSENT_DOCS],
    docs: docs.map((doc) =>
      toSummary(applyLegalOverride(doc, overrides[doc.slug])),
    ),
  };
}

/** One document from a known override - no I/O. `null` for an unknown slug. */
export function legalDocFrom(
  slug: string,
  override: LegalDocOverride | null | undefined,
  docs: readonly LegalDoc[] = LEGAL_DOCS,
): LegalDoc | null {
  const doc = docs.find((d) => d.slug === slug);
  return doc ? applyLegalOverride(doc, override) : null;
}

/** The coded documents with the karaoke terms as a booking made now sees them. */
async function liveDocs(): Promise<LegalDoc[]> {
  const karaoke = await karaokeLegalDocNow();
  return LEGAL_DOCS.map((d) => (d.slug === karaoke.slug ? karaoke : d));
}

// ── Live: read the overrides, then the pure step ────────────────────────────

/**
 * Every published override in one query - the index lists 24 documents and
 * must not cost 24 round trips.
 *
 * Any failure degrades to "no overrides", which serves the coded documents.
 * That is the authoritative text the site ships with; the database only ever
 * holds edits on top of it, so an outage shows the real policy rather than an
 * error. Caught wholesale (not through `publicRead`) because the admin-facing
 * list helper flattens the transport signature into a plain Error, which
 * `publicRead` would rightly refuse to classify as unreachable.
 */
async function publishedOverrides(): Promise<LegalOverrideMap> {
  let rows: Record<string, LegalDocOverride>;
  try {
    rows = await listLegalDocOverrides();
  } catch (err) {
    console.error(
      `[db-degraded] mobileLegalIndex: ${err instanceof Error ? err.message : String(err)}`,
    );
    return {};
  }
  const out: Record<string, LegalDocOverride> = {};
  for (const row of Object.values(rows)) {
    if (isLive(row)) out[row.slug] = row;
  }
  return out;
}

export async function legalIndex(): Promise<MobileLegalIndex> {
  const [overrides, docs] = await Promise.all([
    publishedOverrides(),
    liveDocs(),
  ]);
  return legalIndexFrom(overrides, docs);
}

/**
 * One document, whole. `null` when the slug is not a published contract -
 * decided from the coded registry before any query, so an unknown slug is a
 * 404 whether or not the database answers.
 */
export async function legalDoc(slug: string): Promise<LegalDoc | null> {
  // The karaoke terms are written for the panel's cancellation policy.
  const doc = await liveLegalDoc(slug);
  if (!doc) return null;
  // `getPublishedLegalOverride` already degrades to null when the database is
  // unreachable, which renders the coded document.
  return applyLegalOverride(doc, await getPublishedLegalOverride(slug));
}
