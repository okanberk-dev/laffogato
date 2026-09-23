import { readFileSync } from "node:fs";

import type pg from "pg";

/**
 * Applies the bundled schema to the test database, one suite at a time.
 *
 * Vitest runs test files in parallel, and two suites replaying the same
 * `create or replace function` at once make Postgres answer "tuple
 * concurrently updated". A session advisory lock serialises them; the bundle
 * itself is idempotent, so whichever runs second only confirms it.
 */
export async function applyBundledSchema(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(hashtext('laffogato-tests'))");
    try {
      await client.query(readFileSync("db/schema.sql", "utf8"));
    } finally {
      await client.query(
        "select pg_advisory_unlock(hashtext('laffogato-tests'))",
      );
    }
  } finally {
    client.release();
  }
}
