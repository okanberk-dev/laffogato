import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Executor } from "@/lib/db/client";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * The lists' ↑ / ↓ and one-click "Yayına al" against a real Postgres, with
 * the real query layer (store.ts moveRowInList, setRowActive): a move swaps
 * with the neighbour in the order the panel draws (sortOrder, then
 * createdAt) and renumbers 10, 20, 30, so typed-in ties cannot make the next
 * move a no-op; the switch writes `isActive` alone, so a form open in
 * another tab keeps the fields it is about to save. Everything runs in one
 * transaction that is rolled back: the shared database keeps its rows.
 * Skipped without TEST_DATABASE_URL, like the other
 * tests/db-integration*.test.ts.
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

maybe("ordered lists in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;
  let pool: pg.Pool | null = null;
  let store: typeof import("@/lib/admin/store");

  const q = (text: string, params: unknown[] = []) =>
    holder.client!.query(text, params);

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 2 });
    await applyBundledSchema(pool);
    holder.client = await pool.connect();
    await q("begin");
    // Seeding decided, and the lists emptied: only this file's rows.
    for (const table of ["products", "categories"]) {
      await q(
        `insert into public.counters (id, seq) values ($1, 1)
           on conflict (id) do nothing`,
        [`seed:${table}`],
      );
    }
    for (const table of ["shop_hero_slides", "menu_items"]) {
      await q(
        `insert into public.counters (id, seq) values ($1, 1)
           on conflict (id) do nothing`,
        [`seed:${table}`],
      );
      await q(`delete from public.${table}`);
    }
    const at = (n: number) => `2026-10-0${n}T10:00:00.000Z`;
    for (const [id, n] of [
      ["shero-a", 1],
      ["shero-b", 2],
      ["shero-c", 3],
    ] as const) {
      await q(
        `insert into public.shop_hero_slides
           (id, title, subtitle, "imageUrl", "ctaLabel", "ctaHref", "textTheme",
            "sortOrder", "isActive", "createdAt", "updatedAt")
         values ($1, $2, 'alt', '', '', '', 'light', 0, true, $3, $3)`,
        [id, `Slayt ${id}`, at(n)],
      );
    }
    // Two smoothies typed with the same Sıra, a frozen one with a lower one:
    // the menu draws a category by Sıra, then the name.
    for (const [id, cat, name, sortOrder] of [
      ["mnu-t-1", "smoothie", "Yaban Mersini", 1],
      ["mnu-t-2", "smoothie", "Mango", 1],
      ["mnu-t-3", "smoothie", "Çilek", 2],
      ["mnu-t-4", "frozen", "Frambuaz", 0],
    ] as const) {
      await q(
        `insert into public.menu_items (id, "categoryKey", name, "sortOrder")
         values ($1, $2, $3, $4)`,
        [id, cat, name, sortOrder],
      );
    }
    store = await import("@/lib/admin/store");
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

  const order = async (table: string) =>
    (
      await q(
        `select id, "sortOrder" from public.${table}
           order by "sortOrder", "createdAt"`,
      )
    ).rows as Array<{ id: string; sortOrder: number }>;

  it("moves past a typed-in tie and renumbers the list", async () => {
    // All three typed as 0: the panel draws them by createdAt.
    expect(await store.moveShopHeroSlide("shero-c", "up")).toBe("moved");
    expect(await order("shop_hero_slides")).toEqual([
      { id: "shero-a", sortOrder: 10 },
      { id: "shero-c", sortOrder: 20 },
      { id: "shero-b", sortOrder: 30 },
    ]);
    // The next move is not a no-op on equal numbers.
    expect(await store.moveShopHeroSlide("shero-c", "up")).toBe("moved");
    expect((await order("shop_hero_slides")).map((r) => r.id)).toEqual([
      "shero-c",
      "shero-a",
      "shero-b",
    ]);
  });

  it("answers edge at either end and not_found for a row that is gone", async () => {
    expect(await store.moveShopHeroSlide("shero-c", "up")).toBe("edge");
    expect(await store.moveShopHeroSlide("shero-b", "down")).toBe("edge");
    expect(await store.moveShopHeroSlide("shero-x", "up")).toBe("not_found");
  });

  it("writes isActive alone, and says whether the row was there", async () => {
    await q(
      `update public.shop_hero_slides set title = 'Başka sekmede' where id = 'shero-b'`,
    );
    expect(await store.setShopHeroSlideActive("shero-b", false)).toBe(true);
    const row = (
      await q(
        `select title, "isActive", "updatedAt" from public.shop_hero_slides where id = 'shero-b'`,
      )
    ).rows[0];
    expect(row.title).toBe("Başka sekmede");
    expect(row.isActive).toBe(false);
    expect(row.updatedAt).not.toBe("2026-10-02T10:00:00.000Z");
    expect(await store.setShopHeroSlideActive("shero-x", true)).toBe(false);
  });

  it("moves a menu item within its own category, in the list's order", async () => {
    const smoothies = async () =>
      (
        await q(
          `select id, "sortOrder" from public.menu_items
             where "categoryKey" = 'smoothie' order by "sortOrder", id`,
        )
      ).rows as Array<{ id: string; sortOrder: number }>;
    // Drawn as Mango, Yaban Mersini (tie on 1, by name), then Çilek.
    expect(await store.moveMenuItem("mnu-t-3", "up")).toBe("moved");
    expect(await smoothies()).toEqual([
      { id: "mnu-t-2", sortOrder: 10 },
      { id: "mnu-t-3", sortOrder: 20 },
      { id: "mnu-t-1", sortOrder: 30 },
    ]);
    expect(await store.moveMenuItem("mnu-t-2", "up")).toBe("edge");
    // The other category is not renumbered.
    const frozen = (
      await q(`select "sortOrder" from public.menu_items where id = 'mnu-t-4'`)
    ).rows[0];
    expect(frozen.sortOrder).toBe(0);
    expect(await store.moveMenuItem("mnu-t-x", "up")).toBe("not_found");
  });

  it("numbers a list too long for 10, 20, 30 in ones, every row its own", async () => {
    // The forms take a Sıra of 0-999: a 101-row category at a step of 10
    // left every row from the hundredth on at 999, and a move among them
    // changed nothing.
    for (let i = 1; i <= 101; i++) {
      await q(
        `insert into public.menu_items (id, "categoryKey", name, "sortOrder")
         values ($1, 'long', $2, $3)`,
        [`mnu-l-${String(i).padStart(3, "0")}`, `Kalem ${i}`, i],
      );
    }
    expect(await store.moveMenuItem("mnu-l-101", "up")).toBe("moved");
    const long = (
      await q(
        `select id, "sortOrder" from public.menu_items
           where "categoryKey" = 'long' order by "sortOrder"`,
      )
    ).rows as Array<{ id: string; sortOrder: number }>;
    expect(long.map((r) => r.sortOrder)).toEqual(
      Array.from({ length: 101 }, (_, i) => i + 1),
    );
    expect(long.slice(-2).map((r) => r.id)).toEqual(["mnu-l-101", "mnu-l-100"]);
  });
});
