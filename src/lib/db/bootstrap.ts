import "server-only";

import type { Pool } from "pg";

import { SCHEMA_SQL } from "./schema-sql";

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

/** SQLSTATE 42P01 — undefined_table. */
export function isMissingRelation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "42P01"
  );
}

let inFlight: Promise<void> | null = null;

export function ensureSchema(pool: Pool): Promise<void> {
  // Memoised per instance, but dropped on failure so the next request retries
  // rather than replaying a cached rejection forever.
  if (!inFlight) {
    inFlight = applySchema(pool).catch((err) => {
      inFlight = null;
      throw err;
    });
  }
  return inFlight;
}

async function applySchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    // Serialise across instances: concurrent CREATE TABLE on the same names can
    // deadlock even with `if not exists`.
    await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);

    // Re-check under the lock — another instance may have just finished.
    const probe = await client.query(
      "select to_regclass('public.products') as present",
    );
    if (probe.rows[0]?.present) return;

    console.warn(
      "[db-bootstrap] veritabanı boş — şema uygulanıyor (db/schema.sql)",
    );
    await client.query(SCHEMA_SQL);
    console.warn("[db-bootstrap] şema uygulandı");
  } finally {
    await client
      .query("select pg_advisory_unlock($1)", [LOCK_KEY])
      .catch(() => {
        // Releasing is best-effort; the lock is session-scoped and the
        // connection closing drops it anyway.
      });
    client.release();
  }
}
