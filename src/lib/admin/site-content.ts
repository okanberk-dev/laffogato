import "server-only";

import { getDb, TABLES } from "@/lib/db";
import { isDbUnreachable, markDegraded, raiseDbError } from "@/lib/db/health";

import { CONTENT_FIELDS, contentDefaults } from "./content-fields";

/**
 * Site content - admin-managed editorial copy as a key → value store.
 *
 * Defaults live in `content-fields.ts` (client-safe); only overridden keys
 * are persisted in the `site_content` table. `getSiteContent()` returns
 * defaults overlaid with the stored overrides, so the customer SPA always
 * has a full map and never shows an empty string.
 */

export {
  CONTENT_FIELDS,
  CONTENT_GROUPS,
  contentDefaults,
} from "./content-fields";
export type { ContentField, ContentKind } from "./content-fields";

const VALID_KEYS = new Set(CONTENT_FIELDS.map((f) => f.key));

/** Defaults overlaid with persisted overrides. Always a full key map. */
export async function getSiteContent(): Promise<Record<string, string>> {
  const out = contentDefaults();
  try {
    const sb = getDb();
    const { data, error, status } = await sb
      .from(TABLES.siteContent)
      .select("key, value");
    if (error) raiseDbError("getSiteContent", error, status);
    for (const row of data ?? []) {
      if (VALID_KEYS.has(row.key) && typeof row.value === "string") {
        out[row.key] = row.value;
      }
    }
  } catch (err) {
    // An unreachable database falls back to the bundled defaults; a rejected
    // query is a bug and must not be swallowed.
    if (!isDbUnreachable(err)) throw err;
    markDegraded();
  }
  return out;
}

/** Upserts the given key→value entries (unknown keys ignored). */
export async function updateSiteContent(
  entries: Record<string, string>,
): Promise<void> {
  const now = new Date().toISOString();
  const rows = Object.entries(entries)
    .filter(([k]) => VALID_KEYS.has(k))
    .map(([key, value]) => ({
      key,
      value: String(value ?? "").slice(0, 2000),
      updatedAt: now,
    }));
  if (rows.length === 0) return;
  const sb = getDb();
  const { error } = await sb
    .from(TABLES.siteContent)
    .upsert(rows, { onConflict: "key" });
  if (error) throw new Error(`updateSiteContent: ${error.message}`);
}
