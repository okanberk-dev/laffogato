import "server-only";

import { getDb, TABLES } from "@/lib/db";
import { isDbUnreachable, markDegraded, raiseDbError } from "@/lib/db/health";

import {
  CONTENT_FIELDS,
  contentDefaults,
  type ContentSavePlan,
} from "./content-fields";

/**
 * Site content - admin-managed editorial copy as a key → value store.
 *
 * Defaults live in `content-fields.ts` (client-safe); only overridden keys
 * are persisted in the `site_content` table. `getSiteContent()` returns
 * defaults overlaid with the stored overrides, so the customer SPA always
 * has a full map. An empty value reaches it only for a key that allows one
 * (`allowEmpty`: the home intro band's off switch); the panel refuses the
 * rest (`planContentSave`).
 */

export {
  CONTENT_FIELDS,
  CONTENT_GROUPS,
  contentDefaults,
  planContentSave,
} from "./content-fields";
export type {
  ContentField,
  ContentKind,
  ContentSavePlan,
} from "./content-fields";

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

/**
 * Writes a Site Metinleri save: the changed keys are stored, the keys back on
 * their default lose their override row. Unknown keys are ignored. Throws a
 * DbQueryError / DbUnreachableError (raiseDbError), never a message meant
 * for the operator.
 */
export async function saveSiteContent({
  upserts,
  deletes,
}: Pick<ContentSavePlan, "upserts" | "deletes">): Promise<void> {
  const now = new Date().toISOString();
  const rows = Object.entries(upserts)
    .filter(([k]) => VALID_KEYS.has(k))
    .map(([key, value]) => ({ key, value, updatedAt: now }));
  const gone = deletes.filter((k) => VALID_KEYS.has(k));
  const sb = getDb();
  if (rows.length > 0) {
    const { error, status } = await sb
      .from(TABLES.siteContent)
      .upsert(rows, { onConflict: "key" });
    if (error) raiseDbError("saveSiteContent", error, status);
  }
  if (gone.length > 0) {
    const { error, status } = await sb
      .from(TABLES.siteContent)
      .delete()
      .in("key", gone);
    if (error) raiseDbError("saveSiteContent", error, status);
  }
}
