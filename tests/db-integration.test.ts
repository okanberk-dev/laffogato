import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * Exercises the query layer against a REAL Postgres.
 *
 * The unit tests prove the compiler emits the SQL we intend; only this proves
 * Postgres accepts it and returns what the data layer expects - JSONB round
 * trips, ON CONFLICT behaviour, SQLSTATEs, function calls. Skipped unless a
 * database is provided:
 *
 *   TEST_DATABASE_URL=postgres://user@host:5432/db npm test
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

maybe("query layer against a real Postgres", () => {
  let pool: pg.Pool;
  let db: ReturnType<typeof createDb>;
  let release: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 2 });
    const execute: Executor = async (q) => {
      const r = await pool.query(q.text, q.params as unknown[]);
      return {
        rows: (r.rows ?? []) as Record<string, unknown>[],
        rowCount: r.rowCount ?? 0,
      };
    };
    db = createDb(execute);

    await pool.query(`drop table if exists shim_probe`);
    await pool.query(`
      create table shim_probe (
        id           text primary key,
        name         text    not null default '',
        "priceMinor" integer not null default 0,
        images       jsonb   not null default '[]'::jsonb,
        meta         jsonb   not null default '{}'::jsonb,
        "isActive"   boolean not null default true,
        "sortOrder"  integer not null default 0
      )
    `);
    await pool.query(
      `create unique index shim_probe_name_key on shim_probe (name)`,
    );
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool.query(`drop table if exists shim_probe`);
    await pool.end();
    await release?.();
  });

  it("inserts and reads back, including JSONB", async () => {
    const ins = await db.from("shim_probe").insert({
      id: "a",
      name: "Sirena",
      priceMinor: 32000,
      images: ["one.png", "two.png"],
      meta: { roast: "medium", notes: ["cocoa"] },
    });
    expect(ins.error).toBeNull();

    const { data, error } = await db
      .from("shim_probe")
      .select("*")
      .eq("id", "a")
      .maybeSingle();
    expect(error).toBeNull();
    // JSONB must come back as parsed JS values, not strings - the data layer
    // indexes into these directly.
    expect(data.images).toEqual(["one.png", "two.png"]);
    expect(data.meta.notes).toEqual(["cocoa"]);
    expect(data.priceMinor).toBe(32000);
  });

  it("returns rows only when select() is chained onto a mutation", async () => {
    const bare = await db
      .from("shim_probe")
      .update({ priceMinor: 33000 })
      .eq("id", "a");
    expect(bare.data).toBeNull();
    expect(bare.error).toBeNull();

    const withSelect = await db
      .from("shim_probe")
      .update({ priceMinor: 34000 })
      .eq("id", "a")
      .select();
    expect(withSelect.data[0].priceMinor).toBe(34000);
  });

  it("surfaces a unique violation as SQLSTATE 23505", async () => {
    // The payment webhook and the customer/coupon inserts branch on this code.
    const { error } = await db
      .from("shim_probe")
      .insert({ id: "dupe", name: "Sirena" });
    expect(error?.code).toBe("23505");
  });

  it("upserts with ignoreDuplicates as DO NOTHING", async () => {
    const res = await db.from("shim_probe").upsert(
      [
        { id: "a", name: "Sirena", priceMinor: 999 },
        { id: "b", name: "Notturna", priceMinor: 38000 },
      ],
      { onConflict: "id", ignoreDuplicates: true },
    );
    expect(res.error).toBeNull();

    const kept = await db
      .from("shim_probe")
      .select("*")
      .eq("id", "a")
      .maybeSingle();
    // The existing row must be untouched - this is the seed path.
    expect(kept.data.priceMinor).toBe(34000);
  });

  it("upserts without ignoreDuplicates as DO UPDATE", async () => {
    await db
      .from("shim_probe")
      .upsert(
        { id: "a", name: "Sirena", priceMinor: 41000 },
        { onConflict: "id" },
      );
    const row = await db
      .from("shim_probe")
      .select("*")
      .eq("id", "a")
      .maybeSingle();
    expect(row.data.priceMinor).toBe(41000);
  });

  it("filters with in / neq / gte / ilike and orders and limits", async () => {
    await db.from("shim_probe").insert([
      { id: "c", name: "Caffè", priceMinor: 100, sortOrder: 3 },
      { id: "d", name: "Dolce", priceMinor: 200, sortOrder: 1 },
    ]);

    const inList = await db.from("shim_probe").select("*").in("id", ["c", "d"]);
    expect(inList.data).toHaveLength(2);

    const empty = await db.from("shim_probe").select("*").in("id", []);
    expect(empty.data).toHaveLength(0);

    const gte = await db.from("shim_probe").select("*").gte("priceMinor", 200);
    expect(
      gte.data.every((r: { priceMinor: number }) => r.priceMinor >= 200),
    ).toBe(true);

    const like = await db
      .from("shim_probe")
      .select("*")
      .ilike("name", "%olce%");
    expect(like.data[0].name).toBe("Dolce");

    const ordered = await db
      .from("shim_probe")
      .select("id")
      .in("id", ["c", "d"])
      .order("sortOrder", { ascending: true })
      .limit(1);
    expect(ordered.data[0].id).toBe("d");
  });

  it("counts with head:true without returning rows", async () => {
    const { count, data, error } = await db
      .from("shim_probe")
      .select("*", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(data).toBeNull();
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThan(0);
  });

  it("deletes and returns the removed rows", async () => {
    const { data } = await db
      .from("shim_probe")
      .delete()
      .in("id", ["c", "d"])
      .select();
    expect(data).toHaveLength(2);
  });

  it("errors on a missing table with SQLSTATE 42P01 rather than degrading", async () => {
    const { error, status } = await db.from("no_such_table").select("*");
    expect(error?.code).toBe("42P01");
    expect(status).toBe(400);
  });

  it("calls a scalar function and an array-returning function", async () => {
    await pool.query(`
      create or replace function shim_double(n int) returns int
      language sql as $$ select n * 2 $$
    `);
    await pool.query(`
      create or replace function shim_list(p jsonb) returns int[]
      language sql as $$ select array(select (jsonb_array_elements_text(p))::int) $$
    `);

    const scalar = await db.rpc("shim_double", { n: 21 });
    expect(scalar.data).toBe(42);

    // Object/array args are bound as JSON and cast to jsonb - the shape
    // claim_order_stock relies on.
    const arr = await db.rpc("shim_list", { p: [3, 5, 8] });
    expect(arr.data).toEqual([3, 5, 8]);

    await pool.query(`drop function shim_double(int)`);
    await pool.query(`drop function shim_list(jsonb)`);
  });

  it("bootstraps a schema that satisfies the code's table map", async () => {
    // The bundle the app applies to an empty database must cover every table
    // the data layer addresses, or the site self-heals into a different kind
    // of broken.
    const { SCHEMA_SQL } = await import("@/lib/db/schema-sql");
    const { TABLES } = await import("@/lib/db/index");
    for (const table of Object.values(TABLES)) {
      expect(SCHEMA_SQL, `schema must create ${table}`).toContain(
        `create table if not exists public.${table}`,
      );
    }
    // And it must record itself, so a later CLI migration run is a no-op.
    expect(SCHEMA_SQL).toContain("insert into public._migrations");
  });

  it("propagates a raised exception message from a function", async () => {
    await pool.query(`
      create or replace function shim_raise() returns void
      language plpgsql as $$ begin raise exception 'INSUFFICIENT_STOCK:prd-0001'; end $$
    `);
    const { error } = await db.rpc("shim_raise", {});
    // placeOrder parses the product id out of exactly this message.
    expect(/INSUFFICIENT_STOCK:(.*)$/.exec(error?.message ?? "")?.[1]).toBe(
      "prd-0001",
    );
    await pool.query(`drop function shim_raise()`);
  });
});
