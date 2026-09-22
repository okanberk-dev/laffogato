import "server-only";

import type { Pool, PoolClient } from "pg";

import { MIGRATION_NAMES, SCHEMA_SQL } from "./schema-sql";

/**
 * Creates the schema when the app finds an empty database.
 *
 * Setting DATABASE_URL before applying the migrations is an easy mistake with a
 * harsh result: the app connects fine, every query fails with `relation ... does
 * not exist`, and because a missing table is a genuine error rather than an
 * outage — it must not be masked, see `health.ts` — the site returns HTTP 500.
 * That is exactly how production broke the first time this variable was set.
 *
 * So the app bootstraps itself instead. This only ever runs when a query has
 * already failed with SQLSTATE 42P01, and the SQL it applies is the same
 * generated bundle `npm run db:migrate` would produce, which is idempotent and
 * records what it applied in `_migrations` — so a later CLI migration run is a
 * no-op rather than a conflict.
 */

/** Arbitrary but fixed key, so every instance contends on the same lock. */
const LOCK_KEY = 0x1af09a70;

function hasSqlState(err: unknown, state: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === state
  );
}

/** SQLSTATE 42P01 — undefined_table. */
export function isMissingRelation(err: unknown): boolean {
  return hasSqlState(err, "42P01");
}

/** SQLSTATE 42703 — undefined_column. */
export function isMissingColumn(err: unknown): boolean {
  return hasSqlState(err, "42703");
}

/**
 * A query that failed because the database is behind the migrations — either a
 * table or a column this build expects does not exist yet.
 */
export function isSchemaGap(err: unknown): boolean {
  return isMissingRelation(err) || isMissingColumn(err);
}

/**
 * Whether the database has recorded every migration this build ships.
 *
 * An empty database has no `_migrations` table at all, which reads as "not up
 * to date" rather than an error.
 */
async function isUpToDate(client: PoolClient): Promise<boolean> {
  try {
    const res = await client.query(
      "select name from public._migrations where name = any($1::text[])",
      [MIGRATION_NAMES],
    );
    return (res.rowCount ?? 0) === MIGRATION_NAMES.length;
  } catch (err) {
    if (isMissingRelation(err)) return false;
    throw err;
  }
}

let freshness: Promise<void> | null = null;

/**
 * Applies any migration the database has not recorded yet, once per instance.
 *
 * The on-error path below only fires when a query actually names something
 * missing, and plenty of migrations are invisible to it — a `select *` never
 * mentions a new column, and a data migration touches no schema at all. Without
 * this check a deploy would keep serving the old data until someone remembered
 * to run `npm run db:migrate` by hand.
 *
 * Failures here are swallowed deliberately: this runs ahead of every query, and
 * an unreachable database has to reach the caller as an ordinary query failure
 * so the degraded-mode fallback can classify it. A genuine gap that slips past
 * is still caught by the retry in `createExecutor`.
 */
export function ensureSchemaFresh(pool: Pool): Promise<void> {
  if (!freshness) {
    freshness = checkFreshness(pool).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[db-bootstrap] şema tazelik kontrolü atlandı: ${message}`);
    });
  }
  return freshness;
}

async function checkFreshness(pool: Pool): Promise<void> {
  const client = await pool.connect();
  let fresh: boolean;
  try {
    fresh = await isUpToDate(client);
  } finally {
    client.release();
  }
  if (!fresh) await ensureSchema(pool);
}

/**
 * Whether the database has recorded every migration this build ships.
 *
 * `ensureSchemaFresh` deliberately SWALLOWS its failures — it runs ahead of
 * every query, and an unreachable database has to reach the caller as an
 * ordinary query failure so the degraded-mode fallback can classify it. The
 * cost of that is silence: a schema apply that fails for a reason of its own
 * (a permission, a lock timeout) leaves nothing but a `console.warn` on an
 * instance nobody is watching.
 *
 * This is the same question asked out loud, for `/api/health` to answer with.
 */
export async function schemaIsFresh(pool: Pool): Promise<boolean> {
  const client = await pool.connect();
  try {
    return await isUpToDate(client);
  } finally {
    client.release();
  }
}

let inFlight: Promise<void> | null = null;

export function ensureSchema(pool: Pool): Promise<void> {
  // Dedupes concurrent callers only — the memo is dropped once settled, on
  // success as well as failure. A cached rejection would replay forever, and a
  // cached success would declare the schema final for the life of the instance,
  // leaving a later gap unhealable.
  if (!inFlight) {
    inFlight = applySchema(pool).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function applySchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    // Everything runs inside ONE transaction, and the lock is the
    // transaction-scoped `pg_advisory_xact_lock` rather than the session-scoped
    // `pg_advisory_lock`.
    //
    // This is not a style preference. Under a transaction-pooling proxy —
    // Supabase's pooler on :6543, PgBouncer in transaction mode, any pooled
    // endpoint — a checked-out client is bound to a server backend only for the
    // duration of a transaction. A session lock taken by one statement can
    // therefore be held on a backend that the NEXT statement does not reach:
    // the mutual exclusion silently stops existing, which is the worst possible
    // failure for the one code path whose entire job is to stop two instances
    // running CREATE TABLE at the same time. A transaction lock is pinned to
    // the transaction, so it is correct on a direct connection and behind any
    // pooler, and it is released by COMMIT/ROLLBACK rather than by a best-effort
    // unlock that may address the wrong backend.
    //
    // Wrapping the bundle also makes the apply atomic: a crash halfway through
    // leaves no half-built schema. Verified transaction-safe — the bundle has no
    // CREATE INDEX CONCURRENTLY / VACUUM, and every `begin` in it is a PL/pgSQL
    // body, not transaction control.
    await client.query("begin");
    try {
      await client.query("select pg_advisory_xact_lock($1)", [LOCK_KEY]);

      // Re-check under the lock — another instance may have just finished.
      if (await isUpToDate(client)) {
        await client.query("commit");
        return;
      }

      console.warn(
        "[db-bootstrap] şema güncel değil — db/schema.sql uygulanıyor",
      );
      await client.query(SCHEMA_SQL);
      await client.query("commit");
      console.warn("[db-bootstrap] şema uygulandı");
    } catch (err) {
      await client.query("rollback").catch(() => {
        // Already aborted or the connection is gone; the transaction — and
        // with it the lock — is finished either way.
      });
      throw err;
    }
  } finally {
    client.release();
  }
}
