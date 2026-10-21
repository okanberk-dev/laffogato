import { readFileSync } from "node:fs";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * Seeds decided once per database, against a real Postgres
 * (20261017200100_seed_markers.sql, admin audit CAT-04, CON-01, D17):
 * raise_counter never lowers a counter, and a database already in use gets
 * a `seed:<table>` marker for every seeded table, once, so a table the
 * operator emptied is not seeded again. The suite leaves the markers as it
 * found them. Skipped without TEST_DATABASE_URL.
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

const MIGRATION = "20261017200100_seed_markers.sql";
const MARKERS = [
  "seed:products",
  "seed:categories",
  "seed:menu_items",
  "seed:shop_hero_slides",
  "seed:story_timeline",
  "seed:press",
  "seed:app_hero_slides",
  "seed:app_announcements",
  "seed:app_posts",
];
const RUN = Date.now().toString(36);
const KEY = `seedtest-${RUN}`;

let pool: pg.Pool | null = null;

async function markers(): Promise<string[]> {
  const { rows } = await pool!.query(
    `select id from public.counters where id like 'seed:%' order by id`,
  );
  return rows.map((r: { id: string }) => r.id);
}

maybe("seed markers in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;
  let before: string[] = [];

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 2 });
    await applyBundledSchema(pool);
    await applyBundledSchema(pool);
    before = await markers();
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    try {
      await pool?.query(`delete from public.counters where id = $1`, [KEY]);
      // Back to the markers the suite found: a table no other suite has
      // read yet must still seed in this database.
      await pool?.query(
        `delete from public.counters where id like 'seed:%' and not (id = any($1))`,
        [before],
      );
      await pool?.query(
        `insert into public.counters (id, seq) select unnest($1::text[]), 1 on conflict (id) do nothing`,
        [before],
      );
    } finally {
      await pool?.end();
      pool = null;
      await release?.();
    }
  });

  it("raise_counter sets a counter to at least the value, never lower", async () => {
    const raise = async (n: number) =>
      Number(
        (await pool!.query(`select public.raise_counter($1, $2) as v`, [KEY, n]))
          .rows[0].v,
      );
    expect(await raise(10)).toBe(10);
    expect(await raise(5)).toBe(10);
    expect(await raise(12)).toBe(12);
    const next = await pool!.query(`select public.next_seq($1) as v`, [KEY]);
    expect(Number(next.rows[0].v)).toBe(13);
  });

  it("a database in use gets every marker, once", async () => {
    await pool!.query(
      `insert into public.settings (id) values ('main') on conflict (id) do nothing`,
    );
    const sql = readFileSync(`db/migrations/${MIGRATION}`, "utf8");
    const client = await pool!.connect();
    try {
      await client.query("begin");
      await client.query(`delete from public.counters where id like 'seed:%'`);
      await client.query(`delete from public._migrations where name = $1`, [MIGRATION]);
      await client.query(sql);
      await client.query(`insert into public._migrations (name) values ($1)`, [MIGRATION]);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
    expect(await markers()).toEqual([...MARKERS].sort());

    // A later replay of the bundle does not write a marker again: one the
    // store has not written yet stays unwritten.
    await pool!.query(`delete from public.counters where id = 'seed:press'`);
    await applyBundledSchema(pool!);
    expect(await markers()).not.toContain("seed:press");
  });
});
