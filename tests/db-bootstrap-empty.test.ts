import { describe, expect, it } from "vitest";

import { ensureSchema } from "@/lib/db/bootstrap";
import { SCHEMA_SQL } from "@/lib/db/schema-sql";

/**
 * The app builds the schema itself on an empty database (CLAUDE.md "Data
 * Mimarisi"). It did not: the re-check under the lock asked `_migrations`
 * inside the transaction, the missing table aborted it (42P01), and the
 * bundle that followed was refused (25P02). Seen on a fresh local database,
 * 23 Eki 2026. This client keeps Postgres's rule: after an error, every
 * statement in the transaction fails until ROLLBACK.
 */

function emptyDatabase() {
  const ran: string[] = [];
  let inTx = false;
  let aborted = false;
  let migrations = false;
  const fail = (code: string, message: string) => {
    if (inTx) aborted = true;
    return Promise.reject(Object.assign(new Error(message), { code }));
  };
  const client = {
    query(text: string) {
      ran.push(text.slice(0, 60));
      if (text === "rollback") {
        inTx = false;
        aborted = false;
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      if (aborted) {
        return fail(
          "25P02",
          "current transaction is aborted, commands ignored until end of transaction block",
        );
      }
      if (text === "begin") inTx = true;
      if (text === "commit") inTx = false;
      if (text.includes("to_regclass('public._migrations')")) {
        return Promise.resolve({
          rows: [{ present: migrations }],
          rowCount: 1,
        });
      }
      // The bundle records itself in _migrations, which it creates first.
      if (text === SCHEMA_SQL) {
        migrations = true;
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      if (text.includes("from public._migrations") && !migrations) {
        return fail("42P01", 'relation "public._migrations" does not exist');
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    },
    release() {},
  };
  const pool = { connect: () => Promise.resolve(client) };
  return { pool, ran, applied: () => migrations };
}

describe("an empty database", () => {
  it("gets the whole schema in one transaction on the first query", async () => {
    const db = emptyDatabase();
    await expect(ensureSchema(db.pool as never)).resolves.toBeUndefined();
    expect(db.applied()).toBe(true);
    expect(db.ran[0]).toBe("begin");
    expect(db.ran.at(-1)).toBe("commit");
    // The missing table is asked about, never selected from.
    expect(db.ran).toContain(
      "select to_regclass('public._migrations') is not null as pres",
    );
    expect(
      db.ran.some((q) => q.startsWith("select name from public._migrations")),
    ).toBe(false);
  });
});
