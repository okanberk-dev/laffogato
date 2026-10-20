import "server-only";

import { cache } from "react";

import { getDb, TABLES } from "@/lib/db";
import { publicRead, raiseDbError } from "@/lib/db/health";

import { consentVersionFrom } from "./consent-version";
import {
  CHECKOUT_CONSENT_DOCS,
  KARAOKE_CONSENT_DOCS,
  KARAOKE_LEGAL_UPDATED,
} from "./meta";

/**
 * Admin overrides for the coded legal documents. A published override with a
 * non-empty bodyMarkdown replaces the rich coded default on the public page;
 * otherwise the coded default renders. Keyed by the document slug.
 */
export interface LegalDocOverride {
  slug: string;
  title: string;
  summary: string;
  effectiveDate: string;
  bodyMarkdown: string;
  isPublished: boolean;
  updatedAt: string;
}

export interface LegalDocInput {
  title: string;
  summary: string;
  effectiveDate: string;
  bodyMarkdown: string;
  isPublished: boolean;
}

/**
 * A published, non-empty override for the public /hukuk/<slug> page, or null.
 *
 * Memoised per request (WP1): the page's metadata and body both ask.
 */
export const getPublishedLegalOverride = cache(
  async (slug: string): Promise<LegalDocOverride | null> =>
    // Degrades to "no override", which renders the document bundled in
    // src/lib/legal/documents.ts. That text is the authoritative default the
    // site ships with - the database only ever holds edits on top of it - so
    // an outage shows the real policy, never a fabricated one.
    publicRead("getPublishedLegalOverride", null, () =>
      getPublishedLegalOverrideLive(slug),
    ),
);

/**
 * `getPublishedLegalOverride` without the outage fallback (throws instead).
 * The cached display reader (src/lib/seo/site-data.ts) stores it; the
 * consent versions below keep reading live.
 */
export async function getPublishedLegalOverrideLive(
  slug: string,
): Promise<LegalDocOverride | null> {
  const sb = getDb();
  const { data, error, status } = await sb
    .from(TABLES.legalDocs)
    .select("*")
    .eq("slug", slug)
    .eq("isPublished", true)
    .maybeSingle();
  if (error) raiseDbError("getPublishedLegalOverride", error, status);
  const row = (data as LegalDocOverride | null) ?? null;
  if (!row || !row.bodyMarkdown.trim()) return null;
  return row;
}

/**
 * The version a checkout consent records right now (`legalConsent.version`):
 * `LEGAL_UPDATED`, moved forward by a published override of either checkout
 * document (`consentVersionFrom`). Both checkout paths, the web action and
 * the app's `POST /orders`, call this so one order format reads one rule.
 *
 * Degrades like the public page: with the overrides unreadable, /hukuk shows
 * the coded text, and the coded version is what this records.
 */
export async function checkoutConsentVersion(): Promise<string> {
  const rows = await Promise.all(
    CHECKOUT_CONSENT_DOCS.map((slug) => getPublishedLegalOverride(slug)),
  );
  const bySlug: Record<string, LegalDocOverride | null> = {};
  CHECKOUT_CONSENT_DOCS.forEach((slug, i) => {
    bySlug[slug] = rows[i];
  });
  return consentVersionFrom(bySlug);
}

/**
 * The version a paid karaoke booking's consent records: the karaoke
 * document's own revision, moved forward by a published override of it -
 * the checkout's rule, applied to the karaoke document.
 */
export async function karaokeConsentVersion(): Promise<string> {
  const rows = await Promise.all(
    KARAOKE_CONSENT_DOCS.map((slug) => getPublishedLegalOverride(slug)),
  );
  const bySlug: Record<string, LegalDocOverride | null> = {};
  KARAOKE_CONSENT_DOCS.forEach((slug, i) => {
    bySlug[slug] = rows[i];
  });
  return consentVersionFrom(
    bySlug,
    KARAOKE_CONSENT_DOCS,
    KARAOKE_LEGAL_UPDATED,
  );
}

/** Any override (published or draft) for the admin editor, or null. */
export async function getLegalDocOverride(
  slug: string,
): Promise<LegalDocOverride | null> {
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.legalDocs)
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getLegalDocOverride: ${error.message}`);
  return (data as LegalDocOverride | null) ?? null;
}

/** Map of slug → override for the admin list (to show customized/published). */
export async function listLegalDocOverrides(): Promise<
  Record<string, LegalDocOverride>
> {
  const sb = getDb();
  const { data, error } = await sb.from(TABLES.legalDocs).select("*");
  if (error) throw new Error(`listLegalDocOverrides: ${error.message}`);
  const out: Record<string, LegalDocOverride> = {};
  for (const row of (data as LegalDocOverride[] | null) ?? []) {
    out[row.slug] = row;
  }
  return out;
}

/** What a save did: the row as written, and the archive row it left. */
export interface LegalSaveResult {
  override: LegalDocOverride;
  /** The replaced text's archive id; null when nothing was replaced. */
  archivedId: string | null;
}

/**
 * Writes the override of `slug`. The row it replaces, when it differs, is
 * archived first in the same transaction (`legal_doc_save`, migration
 * 20261017210000), so a save never destroys the text before it. A save that
 * changes nothing writes nothing: the stored `updatedAt` stays the moment
 * the text went up (the returned row carries the attempt's time). `by` is
 * the admin's address, kept with the archived row.
 */
export async function upsertLegalDoc(
  slug: string,
  input: LegalDocInput,
  { by = "" }: { by?: string } = {},
): Promise<LegalSaveResult> {
  const row: LegalDocOverride = {
    slug,
    title: input.title.trim().slice(0, 200),
    summary: input.summary.trim().slice(0, 600),
    effectiveDate: input.effectiveDate.trim().slice(0, 60),
    bodyMarkdown: input.bodyMarkdown.slice(0, 60_000),
    isPublished: !!input.isPublished,
    updatedAt: new Date().toISOString(),
  };
  const { data, error, status } = await getDb().rpc<string | number | null>(
    "legal_doc_save",
    {
      p_slug: row.slug,
      p_title: row.title,
      p_summary: row.summary,
      p_effective_date: row.effectiveDate,
      p_body: row.bodyMarkdown,
      p_published: row.isPublished,
      p_at: row.updatedAt,
      p_by: by,
    },
  );
  if (error) raiseDbError("upsertLegalDoc", error, status);
  return { override: row, archivedId: data == null ? null : String(data) };
}

/**
 * "Varsayılana döndür": archives the override and removes it, so the public
 * page shows the coded default again (`legal_doc_reset`). Returns the archive
 * id, or null when the document had no override.
 */
export async function resetLegalDoc(
  slug: string,
  { by = "" }: { by?: string } = {},
): Promise<string | null> {
  const { data, error, status } = await getDb().rpc<string | number | null>(
    "legal_doc_reset",
    { p_slug: slug, p_at: new Date().toISOString(), p_by: by },
  );
  if (error) raiseDbError("resetLegalDoc", error, status);
  return data == null ? null : String(data);
}

// ── Archive (legal_override_history) ────────────────────────────────────────

/**
 * A text an override held before a save replaced it or a reset removed it.
 * `updatedAt` is when that text was saved; `archivedAt` when it went.
 */
export interface LegalOverrideArchive extends LegalDocOverride {
  id: string;
  archivedAt: string;
  archivedBy: string;
  /** "replaced" (a later save) or "reset" (Varsayılana döndür). */
  reason: string;
}

/** An archive row without its body, for lists. */
export type LegalOverrideArchiveSummary = Omit<
  LegalOverrideArchive,
  "bodyMarkdown"
>;

const ARCHIVE_LIST_COLUMNS =
  "id, slug, title, summary, effectiveDate, isPublished, updatedAt, archivedAt, archivedBy, reason";

function toArchive<T extends { id: unknown }>(row: T): T & { id: string } {
  return { ...row, id: String(row.id) };
}

/** The newest archive rows, of one document or of all; no bodies. */
export async function listLegalOverrideArchive({
  slug,
  limit = 20,
}: { slug?: string; limit?: number } = {}): Promise<
  LegalOverrideArchiveSummary[]
> {
  let q = getDb()
    .from(TABLES.legalOverrideHistory)
    .select(ARCHIVE_LIST_COLUMNS);
  if (slug) q = q.eq("slug", slug);
  const { data, error, status } = await q
    .order("id", { ascending: false })
    .limit(limit);
  if (error) raiseDbError("listLegalOverrideArchive", error, status);
  return ((data as LegalOverrideArchiveSummary[] | null) ?? []).map(toArchive);
}

/** One archive row with its body, or null. */
export async function getLegalOverrideArchive(
  id: string,
): Promise<LegalOverrideArchive | null> {
  if (!/^\d{1,18}$/.test(id)) return null;
  const { data, error, status } = await getDb()
    .from(TABLES.legalOverrideHistory)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) raiseDbError("getLegalOverrideArchive", error, status);
  return data ? toArchive(data as LegalOverrideArchive) : null;
}

/**
 * Every archived text of `slugs`, drafts included, oldest first: with the
 * rows stored now, when each text of a consent's documents was shown. The
 * editor checks a new effective date against the versions they recorded
 * (`consentSaveRefusal`); the two checkout documents share one version, so
 * it reads both.
 */
export async function listConsentArchive(
  slugs: readonly string[],
): Promise<LegalOverrideArchive[]> {
  const { data, error, status } = await getDb()
    .from(TABLES.legalOverrideHistory)
    .select("*")
    .in("slug", slugs)
    .order("id", { ascending: true });
  if (error) raiseDbError("listConsentArchive", error, status);
  return ((data as LegalOverrideArchive[] | null) ?? []).map(toArchive);
}
