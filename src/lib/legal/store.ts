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

async function getPublishedLegalOverrideLive(
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

export async function upsertLegalDoc(
  slug: string,
  input: LegalDocInput,
): Promise<LegalDocOverride> {
  const sb = getDb();
  const row: LegalDocOverride = {
    slug,
    title: input.title.trim().slice(0, 200),
    summary: input.summary.trim().slice(0, 600),
    effectiveDate: input.effectiveDate.trim().slice(0, 60),
    bodyMarkdown: input.bodyMarkdown.slice(0, 60_000),
    isPublished: !!input.isPublished,
    updatedAt: new Date().toISOString(),
  };
  const { error } = await sb
    .from(TABLES.legalDocs)
    .upsert(row, { onConflict: "slug" });
  if (error) throw new Error(`upsertLegalDoc: ${error.message}`);
  return row;
}

/** Remove the override entirely → the public page reverts to the coded default. */
export async function resetLegalDoc(slug: string): Promise<boolean> {
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.legalDocs)
    .delete()
    .eq("slug", slug)
    .select("slug");
  if (error) throw new Error(`resetLegalDoc: ${error.message}`);
  return ((data as { slug: string }[] | null) ?? []).length > 0;
}
