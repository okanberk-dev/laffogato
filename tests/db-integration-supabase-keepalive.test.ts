import pg from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * The Supabase keep-alive record in a real Postgres
 * (20261020175100_supabase_keepalive.sql): the cron's one-statement upsert
 * keeps the last success through failures and skips, concurrent writes
 * leave one row, and the table's checks refuse anything but an outcome word
 * and two ISO instants. Skipped without TEST_DATABASE_URL, like the other
 * db-integration suites.
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

let pool: pg.Pool | null = null;
const execute: Executor = async (q) => {
  if (!pool) throw new Error("pool not ready");
  const r = await pool.query(q.text, q.params as unknown[]);
  return {
    rows: (r.rows ?? []) as Record<string, unknown>[],
    rowCount: r.rowCount ?? 0,
  };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(execute);
  return { ...real, getDb: () => db };
});

const T1 = new Date("2026-10-18T06:00:00.100Z");
const T2 = new Date("2026-10-19T06:00:00.200Z");
const T3 = new Date("2026-10-20T06:00:00.300Z");

maybe("supabase_keepalive in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;
  let store: typeof import("@/lib/admin/supabase-keepalive");

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 4 });
    await applyBundledSchema(pool);
    store = await import("@/lib/admin/supabase-keepalive");
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool?.query("delete from public.supabase_keepalive");
    await pool?.end();
    pool = null;
    await release?.();
  });

  beforeEach(async () => {
    await pool!.query("delete from public.supabase_keepalive");
  });

  async function row() {
    const r = await pool!.query(
      'select id, "lastStatus", "lastAttemptAt", "lastSuccessAt" from public.supabase_keepalive',
    );
    return r.rows;
  }

  it("keeps the last success through a failure and a skip", async () => {
    await expect(store.loadSupabaseKeepalive()).resolves.toEqual({
      kind: "none",
    });
    expect(await store.recordSupabaseKeepalive("skipped", T1)).toBe(true);
    expect(await row()).toEqual([
      {
        id: "supabase",
        lastStatus: "skipped",
        lastAttemptAt: T1.toISOString(),
        lastSuccessAt: "",
      },
    ]);
    expect(await store.recordSupabaseKeepalive("ok", T1)).toBe(true);
    expect(await store.recordSupabaseKeepalive("failed", T2)).toBe(true);
    expect(await store.recordSupabaseKeepalive("skipped", T3)).toBe(true);
    expect(await row()).toEqual([
      {
        id: "supabase",
        lastStatus: "skipped",
        lastAttemptAt: T3.toISOString(),
        lastSuccessAt: T1.toISOString(),
      },
    ]);
    await expect(store.loadSupabaseKeepalive()).resolves.toEqual({
      kind: "record",
      record: {
        lastStatus: "skipped",
        lastAttemptAt: T3.toISOString(),
        lastSuccessAt: T1.toISOString(),
      },
    });
  });

  it("stays one row under concurrent writes", async () => {
    const outcomes = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        store.recordSupabaseKeepalive(
          (["ok", "failed", "skipped"] as const)[i % 3],
          new Date(T1.getTime() + i),
        ),
      ),
    );
    expect(outcomes.every(Boolean)).toBe(true);
    const rows = await row();
    expect(rows).toHaveLength(1);
    expect(rows[0].lastSuccessAt).not.toBe("");
  });

  it("refuses anything but an outcome word, ISO instants and the one row", async () => {
    const insert = (values: unknown[]) =>
      pool!.query(
        'insert into public.supabase_keepalive (id, "lastStatus", "lastAttemptAt", "lastSuccessAt") values ($1, $2, $3, $4)',
        values,
      );
    const iso = T1.toISOString();
    for (const bad of [
      ["supabase", "sb_secret_TESTONLYnotArealKey00000_c0ffee00", iso, ""],
      ["supabase", "ok", '{"users":[{"email":"eda@example.com"}]}', ""],
      ["supabase", "ok", iso, "dün"],
      ["other", "ok", iso, iso],
    ]) {
      await expect(insert(bad)).rejects.toMatchObject({ code: "23514" });
    }
    await expect(insert(["supabase", "ok", iso, iso])).resolves.toBeTruthy();
  });

  it("has row level security on, with no policy", async () => {
    const r = await pool!.query(
      `select c.relrowsecurity,
              (select count(*) from pg_policies p
                where p.schemaname = 'public' and p.tablename = 'supabase_keepalive')::int as policies
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname = 'supabase_keepalive'`,
    );
    expect(r.rows).toEqual([{ relrowsecurity: true, policies: 0 }]);
  });
});
