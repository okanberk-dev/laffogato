import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * The catalogue seed, admin audit package 5a step 5 (CAT-04, CON-01,
 * decision D17).
 *
 * The store seeded products, categories and the menu whenever a table was
 * empty, once per server instance: clearing the demo catalogue brought 11
 * sellable demo products (stock 25, bundled prices) back on the next
 * deploy, and setCounter put the prd / cat / mnu counters back to the
 * seed's size, so the next new product reused a deleted one's id, which old
 * orders and stock moves still point at. Now:
 *
 * - every seed is decided once per database (`seed:<table>` in counters);
 * - the catalogue is never written by a production build;
 * - setCounter goes through raise_counter, which never lowers a counter.
 *
 * Driven through the real query builder with a fake database that keeps
 * row counts and markers, so a "cold start" (a new module instance) sees
 * what the last one left.
 */

const db = {
  rows: new Map<string, number>(),
  markers: new Set<string>(),
  inserted: [] as string[],
  counters: [] as Array<{ key: unknown; floor: unknown }>,
  counterUpserts: 0,
};

const exec: Executor = async ({ text, params }) => {
  const table = /(?:FROM|INTO) "(\w+)"/.exec(text)?.[1] ?? "";
  if (/count\(\*\)/i.test(text)) {
    return { rows: [{ count: db.rows.get(table) ?? 0 }], rowCount: 1 };
  }
  if (text.startsWith('SELECT "raise_counter"(')) {
    db.counters.push({ key: params[0], floor: params[1] });
    return { rows: [{ result: params[1] }], rowCount: 1 };
  }
  if (table === "counters" && /^SELECT /.test(text)) {
    const hit = db.markers.has(String(params[0]));
    return { rows: hit ? [{ id: params[0] }] : [], rowCount: hit ? 1 : 0 };
  }
  if (table === "counters" && /^INSERT /.test(text)) {
    const id = String(params[0]);
    if (id.startsWith("seed:")) db.markers.add(id);
    else db.counterUpserts += 1;
    return { rows: [], rowCount: 1 };
  }
  if (/^INSERT /.test(text)) {
    db.inserted.push(table);
    db.rows.set(table, (db.rows.get(table) ?? 0) + 1);
    return { rows: [], rowCount: 1 };
  }
  return { rows: [], rowCount: 0 };
};

/** A fresh server instance: the per-instance seed memo starts over. */
async function coldStart() {
  vi.resetModules();
  vi.doMock("@/lib/db", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/lib/db")>();
    const fake = createDb(exec);
    return { ...real, getDb: () => fake };
  });
  return import("@/lib/admin/store");
}

const CATALOG = ["products", "categories", "menu_items"];

beforeEach(() => {
  db.rows.clear();
  db.markers.clear();
  db.inserted = [];
  db.counters = [];
  db.counterUpserts = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CAT-04 / CON-01: the catalogue seed", () => {
  it("a fresh development database gets the catalogue once, with its markers", async () => {
    await (await coldStart()).listProducts();
    for (const table of CATALOG) {
      expect(db.inserted, table).toContain(table);
      expect(db.markers.has(`seed:${table}`), table).toBe(true);
    }
    // The settings row is written whenever it is missing.
    expect(db.inserted).toContain("settings");
  });

  it("deleting every product, category and menu item: the next instance lists nothing", async () => {
    await (await coldStart()).listProducts();
    for (const table of CATALOG) db.rows.set(table, 0);
    db.inserted = [];

    const store = await coldStart();
    expect(await store.listProducts()).toEqual([]);
    expect(await store.listCategories()).toEqual([]);
    expect(await store.listMenuItems()).toEqual([]);
    for (const table of CATALOG) expect(db.inserted, table).not.toContain(table);
  });

  it("a production build never writes the demo catalogue, and decides it once", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await (await coldStart()).listProducts()).toEqual([]);
    for (const table of CATALOG) {
      expect(db.inserted, table).not.toContain(table);
      expect(db.markers.has(`seed:${table}`), table).toBe(true);
    }
    expect(db.counters).toEqual([]);
    // The settings row still is: every page needs it.
    expect(db.inserted).toContain("settings");
  });

  it("the content seeds still run in production, once", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await (await coldStart()).listShopHeroSlides();
    expect(db.inserted).toContain("shop_hero_slides");
    expect(db.markers.has("seed:shop_hero_slides")).toBe(true);
  });

  it("counters are raised, never written back to the seed's size", async () => {
    await (await coldStart()).listProducts();
    expect(db.counters).toEqual(
      expect.arrayContaining([
        { key: "prd", floor: expect.any(Number) },
        { key: "cat", floor: 5 },
        { key: "mnu", floor: expect.any(Number) },
      ]),
    );
    // The old setCounter upserted `seq` as is, lowering a counter that had
    // moved past the seed.
    expect(db.counterUpserts).toBe(0);
  });
});
