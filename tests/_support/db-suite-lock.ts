import pg from "pg";

const KEY = "hashtext('laffogato-tests:suite')";

/**
 * How long a database suite may wait for the others to finish: the five
 * suites together take a few seconds, so this is only a ceiling for a slow CI
 * runner. It is passed to `beforeAll` because the default hook timeout (10s)
 * is shorter than a queue of suites can be.
 */
export const SUITE_LOCK_WAIT_MS = 120_000;

/**
 * Lets one database suite at a time use the shared test database.
 *
 * Vitest runs test files in parallel, and the tests/db-integration*.test.ts
 * suites share one database and clean it with broad deletes: the payment
 * sweep clears every pending order in the table before each test, and when
 * that landed in the middle of the audit suite's concurrency test, a fourth
 * and fifth app order got past the cap of three (measured: 16 failures in 25
 * runs of the database suites alone). A session advisory lock held for the
 * whole file serialises the database suites among themselves; the unit files
 * still run beside them.
 *
 * The key differs from applyBundledSchema's, which each suite takes again, on
 * another connection, while holding this one. A suite that crashes releases
 * the lock with its connection.
 */
export async function holdSharedDatabase(
  connectionString: string,
): Promise<() => Promise<void>> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  await client.query(`select pg_advisory_lock(${KEY})`);
  return async () => {
    try {
      await client.query(`select pg_advisory_unlock(${KEY})`);
    } finally {
      await client.end();
    }
  };
}
