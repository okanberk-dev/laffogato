import { readFileSync } from "node:fs";
import { join } from "node:path";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { compile, type Filter } from "@/lib/db/sql";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * WP1: the member lookups that compare an e-mail EXACTLY (`.eq(col, email)`
 * compiles to `"col" = $1`) must have an index on the bare column.
 *
 * Each of these tables already had an index on `lower(col)`, which Postgres
 * only uses for the same expression - so every one of these reads, including
 * the `customers` read behind every bearer request, was a sequential scan.
 * Measured with 20k customers / 200k stamps: 1.9 ms -> 0.12 ms for the
 * customer, 20 ms -> 0.16 ms for the stamp ledger.
 *
 * The static half pins the call sites to the indexes, so moving a read to a
 * new column without an index fails here. The database half asks the planner
 * itself, with sequential scans priced out, so it does not depend on how many
 * rows other suites leave in the shared test database.
 */

const LOOKUPS: {
  table: string;
  column: string;
  index: string;
  /** A source file that reads the table with `.eq("<column>", ...)`. */
  reader: string;
}[] = [
  {
    table: "customers",
    column: "email",
    index: "customers_email_exact_idx",
    reader: "src/lib/customer/supabase-bridge.ts",
  },
  {
    table: "loyalty_stamps",
    column: "customerEmail",
    index: "loyalty_stamps_owner_created_idx",
    reader: "src/lib/mobile/loyalty.ts",
  },
  {
    table: "customer_coupons",
    column: "customerEmail",
    index: "customer_coupons_owner_created_idx",
    reader: "src/lib/customer/coupons.ts",
  },
  {
    table: "counter_tokens",
    column: "customerEmail",
    index: "counter_tokens_owner_created_idx",
    reader: "src/lib/mobile/counter.ts",
  },
  {
    table: "invites",
    column: "inviterEmail",
    index: "invites_inviter_created_idx",
    reader: "src/lib/mobile/invite.ts",
  },
  {
    table: "invites",
    column: "inviteeEmail",
    index: "invites_invitee_exact_idx",
    reader: "src/lib/mobile/invite.ts",
  },
  {
    table: "newsletter_subscribers",
    column: "email",
    index: "newsletter_subscribers_email_exact_idx",
    reader: "src/lib/newsletter/store.ts",
  },
];

const schema = readFileSync(join(process.cwd(), "db/schema.sql"), "utf8");

function quoted(column: string): string {
  return column === column.toLowerCase() ? column : `"${column}"`;
}

describe("exact e-mail lookups have a matching plain index", () => {
  for (const { table, column, index, reader } of LOOKUPS) {
    it(`${table}.${column} (${index})`, () => {
      const source = readFileSync(join(process.cwd(), reader), "utf8");
      expect(source).toContain(`.eq("${column}"`);
      // Leading column is the bare column, not lower(...): that is the whole
      // point - the lower() index cannot serve `"col" = $1`.
      const re = new RegExp(
        `create index if not exists ${index}\\s+on public\\.${table} \\(${quoted(
          column,
        ).replace(/"/g, '\\"')}[,)]`,
      );
      expect(schema).toMatch(re);
    });
  }

  it("the builder's eq really is a bare-column comparison", () => {
    const filters: Filter[] = [
      { op: "eq", column: "customerEmail", value: "a@b.co" },
    ];
    const { text } = compile({
      kind: "select",
      table: "loyalty_stamps",
      columns: "*",
      filters,
      orders: [],
      limit: null,
      count: null,
      head: false,
    });
    expect(text).toContain('"customerEmail" = $1');
    expect(text).not.toContain("lower(");
  });
});

const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

maybe("exact e-mail lookups in a real Postgres", () => {
  let pool: pg.Pool;
  let release: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 1 });
    await applyBundledSchema(pool);
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool.end();
    await release?.();
  });

  for (const { table, column, index } of LOOKUPS) {
    it(`plans ${table}.${column} = $1 on ${index}`, async () => {
      const { text, params } = compile({
        kind: "select",
        table,
        columns: "*",
        filters: [{ op: "eq", column, value: "plan-probe@example.com" }],
        orders: [],
        limit: null,
        count: null,
        head: false,
      });
      const client = await pool.connect();
      try {
        await client.query("begin");
        // Price sequential scans out so the answer does not depend on how
        // small the shared test tables happen to be: with an index the
        // planner takes it, without one it is left with the seq scan.
        await client.query("set local enable_seqscan = off");
        const plan = await client.query<{ "QUERY PLAN": string }>(
          `explain ${text}`,
          params as unknown[],
        );
        await client.query("rollback");
        const lines = plan.rows.map((r) => r["QUERY PLAN"]).join("\n");
        expect(lines).toContain(index);
      } finally {
        client.release();
      }
    });
  }
});
