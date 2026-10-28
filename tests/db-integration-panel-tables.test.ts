import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Executor } from "@/lib/db/client";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * LafPOS's table list against a real Postgres, with the real query layer
 * (`importCafeTables`, docs/LAFPOS.md "Masa kodları"):
 *
 * - a code the site does not have becomes a new row with that code, the
 *   name and state given, a `tbl-` id from the counter and no `rotatedAt`;
 * - a code the site has gets its name and state brought up to date, and a
 *   row already as given is not written (its `updatedAt` stays);
 * - a table the list does not name is not touched;
 * - the code then resolves for a QR (`resolveActiveTable`), inactive when
 *   LafPOS retired it.
 *
 * One transaction, rolled back: the shared database keeps its rows. Skipped
 * without TEST_DATABASE_URL, like the other tests/db-integration*.test.ts.
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

const holder = vi.hoisted(() => ({ client: null as pg.PoolClient | null }));
const execute: Executor = async (q) => {
  if (!holder.client) throw new Error("client not ready");
  const r = await holder.client.query(q.text, q.params as unknown[]);
  return {
    rows: (r.rows ?? []) as Record<string, unknown>[],
    rowCount: r.rowCount ?? 0,
  };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const { createDb: create } = await import("@/lib/db/client");
  const db = create((q) => execute(q));
  return { ...real, getDb: () => db };
});

const SITE = "ZZZZZZZZ01"; // the site's own table, never in LafPOS's list
const CODE_A = "K7Q2M9X4TB";
const CODE_B = "ABCDEFGH23";

maybe("LafPOS's table list in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;
  let pool: pg.Pool | null = null;
  let tables: typeof import("@/lib/admin/cafe-tables");

  const q = (text: string, params: unknown[] = []) =>
    holder.client!.query(text, params);
  const row = async (code: string) =>
    (
      await q(
        `select id, code, name, "isActive", "rotatedAt", "updatedAt"
           from public.cafe_tables where code = $1`,
        [code],
      )
    ).rows[0];

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 2 });
    await applyBundledSchema(pool);
    holder.client = await pool.connect();
    await q("begin");
    await q("delete from public.cafe_tables");
    await q(
      `insert into public.cafe_tables
         (id, code, name, "sortOrder", "isActive", "createdAt", "updatedAt", "rotatedAt")
       values ('tbl-t-1', $1, 'Teras', 1, true, '2026-10-01T08:00:00.000Z',
               '2026-10-01T08:00:00.000Z', ''),
              ('tbl-t-2', $2, 'Pencere', 2, true, '2026-10-01T08:00:00.000Z',
               '2026-10-01T08:00:00.000Z', '')`,
      [SITE, CODE_B],
    );
    tables = await import("@/lib/admin/cafe-tables");
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    try {
      await q("rollback");
    } finally {
      holder.client?.release();
      holder.client = null;
      await pool?.end();
      await release?.();
    }
  });

  it("adds a new code as given, brings a known one up to date, leaves the rest", async () => {
    const result = await tables.importCafeTables([
      { code: CODE_A, name: "Bahçe 3", active: true },
      { code: CODE_B, name: "Eski kart", active: false },
    ]);
    expect(result.count).toBe(2);
    expect(result.unchanged).toBe(0);
    expect(result.created.map((t) => [t.code, t.name, t.isActive])).toEqual([
      [CODE_A, "Bahçe 3", true],
    ]);
    expect(result.updated.map((t) => [t.id, t.name, t.isActive])).toEqual([
      ["tbl-t-2", "Eski kart", false],
    ]);
    const added = await row(CODE_A);
    expect(added).toMatchObject({
      code: CODE_A,
      name: "Bahçe 3",
      isActive: true,
      rotatedAt: "",
    });
    expect(added.id).toMatch(/^tbl-\d{4,}$/);
    expect(result.created[0].id).toBe(added.id);
    expect(await row(CODE_B)).toMatchObject({
      id: "tbl-t-2",
      name: "Eski kart",
      isActive: false,
    });
    // The site's own table, not in the list: untouched.
    expect(await row(SITE)).toMatchObject({
      id: "tbl-t-1",
      name: "Teras",
      isActive: true,
      updatedAt: "2026-10-01T08:00:00.000Z",
    });
  });

  it("writes nothing for a list the site already has", async () => {
    const before = await row(CODE_A);
    const result = await tables.importCafeTables([
      { code: CODE_A, name: "Bahçe 3", active: true },
      { code: CODE_B, name: "Eski kart", active: false },
    ]);
    expect(result).toMatchObject({
      count: 2,
      created: [],
      updated: [],
      unchanged: 2,
    });
    expect((await row(CODE_A)).updatedAt).toBe(before.updatedAt);
  });

  it("writes only the field that differs", async () => {
    const result = await tables.importCafeTables([
      { code: CODE_A, name: "Bahçe 4", active: true },
    ]);
    expect(result.updated.map((t) => [t.code, t.name, t.isActive])).toEqual([
      [CODE_A, "Bahçe 4", true],
    ]);
    expect(await row(CODE_A)).toMatchObject({
      name: "Bahçe 4",
      isActive: true,
    });
  });

  it("resolves the code LafPOS printed, inactive once LafPOS retired it", async () => {
    expect(await tables.resolveActiveTable(CODE_A)).toEqual({
      code: CODE_A,
      name: "Bahçe 4",
    });
    expect(await tables.resolveActiveTable(CODE_B)).toBe("inactive");
    await tables.importCafeTables([
      { code: CODE_A, name: "Bahçe 4", active: false },
    ]);
    expect(await tables.resolveActiveTable(CODE_A)).toBe("inactive");
  });

  it("takes an empty list without reading", async () => {
    expect(await tables.importCafeTables([])).toEqual({
      count: 0,
      created: [],
      updated: [],
      unchanged: 0,
    });
  });
});
