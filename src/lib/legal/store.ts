import "server-only";

import { getDb, TABLES } from "@/lib/db";

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

/** A published, non-empty override for the public /hukuk/<slug> page, or null. */
export async function getPublishedLegalOverride(
  slug: string,
): Promise<LegalDocOverride | null> {
  const sb = getDb();
  const { data, error } = await sb
    .from(TABLES.legalDocs)
    .select("*")
    .eq("slug", slug)
    .eq("isPublished", true)
    .maybeSingle();
  if (error) throw new Error(`getPublishedLegalOverride: ${error.message}`);
  const row = (data as LegalDocOverride | null) ?? null;
  if (!row || !row.bodyMarkdown.trim()) return null;
  return row;
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
