import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Executor } from "@/lib/db/client";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * The menu link's two writes against a real Postgres, with the real query
 * layer (docs/PANEL-MENU.md):
 *
 * - `setMenuItemSaleFields` writes the prices and the on-menu state alone,
 *   so a name or photo saved meanwhile from the menu form stays;
 * - `markMenuPricesChanged` records the instant in
 *   `settings."menuPricesChangedAt"`, which starts as ''.
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

maybe("the menu link's writes in a real Postgres", () => {
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
    // Seeding decided, and the menu emptied: only this file's row.
    for (const table of [
      "products",
      "categories",
      "shop_hero_slides",
      "menu_items",
    ]) {
      await q(
        `insert into public.counters (id, seq) values ($1, 1)
           on conflict (id) do nothing`,
        [`seed:${table}`],
      );
    }
    await q("delete from public.menu_items");
    await q(
      `insert into public.menu_items
         (id, "categoryKey", name, "desc", image, "priceMinor", "priceMinorL",
          "isActive", "updatedAt")
       values ('mnu-t-9', 'espresso', 'Espresso', 'Tek shot', '/menu/e.webp',
               11000, 14000, true, '2026-10-01T08:00:00.000Z')`,
    );
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

  it("writes the sale fields alone: a name saved meanwhile stays", async () => {
    // The menu form saved a new name after the panel read the item.
    await q(
      `update public.menu_items set name = 'Espresso (yeni)' where id = 'mnu-t-9'`,
    );
    const next = await store.setMenuItemSaleFields("mnu-t-9", {
      priceMinor: 11500,
      isActive: false,
    });
    // The answer is the panel's columns alone: no photo comes back.
    expect(next).toEqual({
      id: "mnu-t-9",
      name: "Espresso (yeni)",
      categoryKey: "espresso",
      priceMinor: 11500,
      priceMinorL: 14000,
      isActive: false,
      sortOrder: 0,
      updatedAt: next!.updatedAt,
    });
    expect(next!.updatedAt > "2026-10-01T08:00:00.000Z").toBe(true);
    const row = (
      await q(
        `select name, "desc", image, "priceMinor", "priceMinorL", "isActive"
           from public.menu_items where id = 'mnu-t-9'`,
      )
    ).rows[0];
    expect(row).toEqual({
      name: "Espresso (yeni)",
      desc: "Tek shot",
      image: "/menu/e.webp",
      priceMinor: 11500,
      priceMinorL: 14000,
      isActive: false,
    });
  });

  it("reads the panel's eight columns, the same values as the full row", async () => {
    const full = await store.getMenuItem("mnu-t-9");
    const narrow = await store.getMenuItemForPanel("mnu-t-9");
    const pick = {
      id: full!.id,
      name: full!.name,
      categoryKey: full!.categoryKey,
      priceMinor: full!.priceMinor,
      priceMinorL: full!.priceMinorL,
      isActive: full!.isActive,
      sortOrder: full!.sortOrder,
      updatedAt: full!.updatedAt,
    };
    expect(narrow).toEqual(pick);
    expect(await store.listMenuItemsForPanel()).toEqual([pick]);
    expect(await store.getMenuItemForPanel("mnu-yok")).toBeNull();
  });

  it("answers null for an item the menu no longer has", async () => {
    expect(
      await store.setMenuItemSaleFields("mnu-yok", { priceMinor: 100 }),
    ).toBeNull();
  });

  it("records the instant of a price change, from an empty start", async () => {
    const before = await store.getSettings();
    expect(before.menuPricesChangedAt).toBe("");
    const at = new Date("2026-10-22T09:15:00.000Z");
    await store.markMenuPricesChanged(at);
    const after = await store.getSettings();
    expect(after.menuPricesChangedAt).toBe(at.toISOString());
    // The day the operator set is untouched (OP-PRICE-LISTS).
    expect(after.menuPricesEffectiveDate).toBe(before.menuPricesEffectiveDate);
  });
});
