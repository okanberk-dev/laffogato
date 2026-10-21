import "server-only";

import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import {
  isLegalVersionHash,
  isVersionPrefix,
  legalVersionHash,
  parseLegalVersionText,
  type LegalVersion,
} from "./version-core";

/**
 * `legal_doc_versions`: every legal text shown, by the SHA-256 of its
 * canonical string (./version-core.ts; the table and its append-only
 * triggers: db/migrations/20261020180000_legal_doc_versions.sql).
 *
 * Reads and writes only. Which text was shown is decided by the callers
 * (./store.ts for the consents, the panel's actions, the daily cron); no
 * public page view calls the writer, and only /hukuk/<slug>?surum= calls a
 * reader (tests/public-pages-cached-reads.test.ts).
 */

interface VersionRow {
  hash: string;
  slug: string;
  body: string;
  createdAt?: string;
}

/**
 * Hashes this instance has seen in the table. A row is never updated and
 * goes only past its eleven years (the retention rule), so a warm instance
 * need not ask about the same text twice.
 */
const known = new Set<string>();

/** Tests that rewrite the table under one process start from a clean slate. */
export function forgetKnownLegalVersions(): void {
  known.clear();
}

/**
 * Stores each text that is not stored yet. The write is ONE statement,
 * `INSERT ... ON CONFLICT (hash) DO NOTHING`: two requests storing the same
 * text at once both succeed and leave one row, and nothing is ever read,
 * changed and written back. The `select hash` before it only spares
 * resending the ÖBF and the MSS (about 140 KB) on every checkout of a cold
 * instance; it decides nothing the insert does not decide again.
 *
 * Throws on a database error: each caller decides what a failure costs (the
 * panel refuses its save, a consent carries on and the copy is stored later).
 */
export async function recordLegalVersions(
  versions: readonly LegalVersion[],
): Promise<void> {
  const unique = new Map<string, LegalVersion>();
  for (const v of versions) {
    if (!known.has(v.hash)) unique.set(v.hash, v);
  }
  if (unique.size === 0) return;
  const db = getDb();
  const seen = await db
    .from(TABLES.legalDocVersions)
    .select("hash")
    .in("hash", [...unique.keys()]);
  if (seen.error) raiseDbError("recordLegalVersions", seen.error, seen.status);
  for (const row of (seen.data as { hash: string }[] | null) ?? []) {
    known.add(row.hash);
  }
  const missing = [...unique.values()].filter((v) => !known.has(v.hash));
  if (missing.length === 0) return;
  const ins = await db.from(TABLES.legalDocVersions).upsert(
    missing.map((v) => ({ hash: v.hash, slug: v.slug, body: v.text })),
    { onConflict: "hash", ignoreDuplicates: true },
  );
  if (ins.error) raiseDbError("recordLegalVersions", ins.error, ins.status);
  for (const v of missing) known.add(v.hash);
}

/**
 * A stored row as a version, or null when it is not one: its body does not
 * hash to its key (the table's CHECK makes that impossible; a copy restored
 * without the constraint would not be trusted either) or does not parse.
 */
function toVersion(row: VersionRow): LegalVersion | null {
  if (!isLegalVersionHash(row.hash) || typeof row.body !== "string") {
    return null;
  }
  if (legalVersionHash(row.body) !== row.hash) return null;
  const doc = parseLegalVersionText(row.body);
  if (!doc || doc.slug !== row.slug) return null;
  return { hash: row.hash, slug: row.slug, text: row.body, doc };
}

/** The stored texts of `hashes` that exist and verify, by hash. */
export async function loadLegalVersions(
  hashes: readonly string[],
): Promise<Map<string, LegalVersion>> {
  const wanted = [...new Set(hashes.filter(isLegalVersionHash))];
  const out = new Map<string, LegalVersion>();
  if (wanted.length === 0) return out;
  const { data, error, status } = await getDb()
    .from(TABLES.legalDocVersions)
    .select("hash, slug, body")
    .in("hash", wanted);
  if (error) raiseDbError("loadLegalVersions", error, status);
  for (const row of (data as VersionRow[] | null) ?? []) {
    const v = toVersion(row);
    if (v) {
      out.set(v.hash, v);
      known.add(v.hash);
    }
  }
  return out;
}

export interface StoredLegalVersion {
  version: LegalVersion;
  /** When the text was first stored (ISO). */
  createdAt: string;
}

/**
 * The one stored text of `slug` whose hash starts with `prefix`, for
 * /hukuk/<slug>?surum=. Null for a prefix that is not one (see
 * `isVersionPrefix`), that names no text of this document, or that names
 * more than one. The prefix is a byte range on the "C"-collated key, so the
 * lookup walks the primary key, never the table.
 */
export async function findLegalVersionByPrefix(
  slug: string,
  prefix: string,
): Promise<StoredLegalVersion | null> {
  if (!isVersionPrefix(prefix)) return null;
  const { data, error, status } = await getDb()
    .from(TABLES.legalDocVersions)
    .select("hash, slug, body, createdAt")
    .eq("slug", slug)
    .gte("hash", prefix)
    .lt("hash", `${prefix}g`)
    .limit(2);
  if (error) raiseDbError("findLegalVersionByPrefix", error, status);
  const rows = ((data as VersionRow[] | null) ?? []).filter((r) =>
    r.hash.startsWith(prefix),
  );
  if (rows.length !== 1) return null;
  const version = toVersion(rows[0]);
  if (!version) return null;
  return { version, createdAt: String(rows[0].createdAt ?? "") };
}
