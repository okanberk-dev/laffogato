import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyBundledSchema } from "./_support/apply-schema";

/**
 * What the bundled schema leaves behind in a real Postgres, after the whole
 * bundle has been replayed (the bootstrap path, and a hand apply of
 * db/schema.sql): later files that drop or amend what earlier files create
 * must win. Skipped without a database:
 *
 *   TEST_DATABASE_URL=postgres://user@host:5432/db npm test
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

maybe("bundled schema objects in a real Postgres", () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: URL_, max: 2 });
    await applyBundledSchema(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  async function signatures(name: string): Promise<string[]> {
    const r = await pool.query<{ args: string }>(
      `select pg_get_function_identity_arguments(p.oid) as args
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = $1
        order by 1`,
      [name],
    );
    return r.rows.map((row) => row.args);
  }

  it("keeps only the current campaign claim and mark signatures", async () => {
    expect(await signatures("campaign_email_claim")).toEqual([
      "p_campaign text, p_stale_before text, p_posted_before text, p_now text",
    ]);
    expect(await signatures("campaign_email_mark")).toEqual([
      "p_campaign text, p_batch integer, p_status text, p_ids jsonb, p_error text, p_now text, p_claimed_at text",
    ]);
  });

  it("replays cleanly a second time", async () => {
    await applyBundledSchema(pool);
    expect(await signatures("campaign_email_claim")).toHaveLength(1);
    expect(await signatures("campaign_email_mark")).toHaveLength(1);
  });
});
