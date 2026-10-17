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
 * The panel's search against a real Postgres: the `foldLike` SQL
 * (`lower(translate(...))` on both sides) finds every spelling of the
 * Turkish I family that ILIKE misses, a phone in any punctuation, an order
 * by its number, and a karaoke booking by its code. Skipped without
 * TEST_DATABASE_URL, like the other db-integration suites.
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

const { parseSearch, searchAdmin } = await import("@/lib/admin/search");

const search = async (text: string, role: "owner" | "staff" = "owner") => {
  const groups = await searchAdmin(parseSearch(text)!, role);
  return Object.fromEntries(
    groups.map((g) => [g.section, g.hits.map((h) => h.title)]),
  );
};

maybe("admin search, in SQL", () => {
  let release: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 4 });
    await applyBundledSchema(pool);
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool?.end();
    pool = null;
    await release?.();
  });

  beforeEach(async () => {
    const p = pool!;
    await p.query(
      "delete from public.orders where id like 'srch-%'; " +
        "delete from public.customers where id like 'srch-%'; " +
        "delete from public.products where id like 'srch-%'; " +
        "delete from public.menu_items where id like 'srch-%'; " +
        "delete from public.karaoke_reservations where id = 'krk-99042'",
    );
    await p.query(
      `insert into public.orders (id, "orderNo", "customerName", "customerEmail", "customerPhone", "createdAt")
       values ('srch-1', 990001, 'İsmail Işık', 'ismail@example.com', '+90 (532) 123-45-67', '2026-10-17T10:00:00.000Z'),
              ('srch-2', 990002, 'IRMAK ÇELİK', 'irmak@example.com', '', '2026-10-17T11:00:00.000Z'),
              ('srch-3', 990003, 'Zeynep', 'z@example.com', '0544 000 00 00', '2026-10-17T12:00:00.000Z')`,
    );
    await p.query(
      `insert into public.customers (id, email, name, phone)
       values ('srch-c1', 'ilkay@example.com', 'İlkay Öztürk', '05321112233'),
              ('srch-c2', 'deleted-srch-c2@anon.local', '', '')`,
    );
    await p.query(
      `insert into public.products (id, slug, name, sku)
       values ('srch-p1', 'srch-findik', 'Fındık Ezmesi', 'FND-1')`,
    );
    await p.query(
      `insert into public.menu_items (id, "categoryKey", name)
       values ('srch-m1', 'kahve', 'İtalyan Kavrum')`,
    );
    await p.query(
      `insert into public.karaoke_reservations (id, "customerEmail", "customerName", date, "startHour")
       values ('krk-99042', 'k@example.com', 'Deniz', '2031-01-07', 20)`,
    );
  });

  it("finds İsmail for ismail and IRMAK for ırmak, both ways", async () => {
    expect((await search("ismail")).orders).toEqual(["#990001 · İsmail Işık"]);
    expect((await search("ISMAIL")).orders).toEqual(["#990001 · İsmail Işık"]);
    expect((await search("ışık")).orders).toEqual(["#990001 · İsmail Işık"]);
    expect((await search("ırmak çelik")).orders).toEqual([
      "#990002 · IRMAK ÇELİK",
    ]);
    expect((await search("findik")).products).toEqual(["Fındık Ezmesi"]);
    expect((await search("italyan")).menu).toEqual(["İtalyan Kavrum"]);
    expect((await search("ilkay")).customers).toEqual(["İlkay Öztürk"]);
  });

  it("finds an order by its number and a phone in any punctuation", async () => {
    expect((await search("#990003", "staff")).orders).toEqual([
      "#990003 · Zeynep",
    ]);
    expect((await search("0532 123 45 67", "staff")).orders).toEqual([
      "#990001 · İsmail Işık",
    ]);
    expect((await search("5321112233")).customers).toEqual(["İlkay Öztürk"]);
  });

  it("treats LIKE's wildcards as text", async () => {
    expect((await search("%%")).orders).toEqual([]);
    expect((await search("_s")).orders).toEqual([]);
  });

  it("finds a karaoke booking by its code, and never a closed account", async () => {
    expect((await search("KRK-99042")).karaoke).toEqual(["KRK-99042 · Deniz"]);
    expect((await search("anon.local")).customers).toEqual([]);
  });
});
