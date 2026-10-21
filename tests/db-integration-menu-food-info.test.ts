import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MENU_ALLERGEN_KEYS } from "@/lib/menu/allergens";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * The menu's food information in a real Postgres (18 Oct 2026):
 * `menu_items.allergens` takes NULL (not entered), [] (none) and keys from
 * the closed list only, and `settings."menuPricesEffectiveDate"` starts
 * empty. Each test runs in a transaction that is rolled back. Skipped
 * without a database:
 *
 *   TEST_DATABASE_URL=postgres://user@host:5432/db npm test
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

maybe("menu allergens and the price list day in a real Postgres", () => {
  let pool: pg.Pool;
  let release: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 2 });
    await applyBundledSchema(pool);
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool.end();
    await release?.();
  });

  async function inRollback(body: (db: pg.PoolClient) => Promise<void>) {
    const db = await pool.connect();
    try {
      await db.query("begin");
      await body(db);
    } finally {
      await db.query("rollback");
      db.release();
    }
  }

  /** Writes `value` (JSON text, or null) as the item's allergens. */
  async function write(db: pg.PoolClient, value: string | null) {
    await db.query("savepoint attempt");
    try {
      await db.query(
        `insert into public.menu_items (id, "categoryKey", name, allergens)
         values ('mnu-9001', 'dessert', 'Deneme', $1::jsonb)
         on conflict (id) do update set allergens = excluded.allergens`,
        [value],
      );
      await db.query("release savepoint attempt");
      return "ok";
    } catch (err) {
      await db.query("rollback to savepoint attempt");
      return (err as { code?: string }).code ?? "error";
    }
  }

  it("a new row starts not entered (NULL), not 'none'", async () => {
    await inRollback(async (db) => {
      await db.query(
        `insert into public.menu_items (id, "categoryKey", name)
         values ('mnu-9002', 'dessert', 'Deneme')`,
      );
      const { rows } = await db.query(
        `select allergens from public.menu_items where id = 'mnu-9002'`,
      );
      expect(rows[0].allergens).toBeNull();
    });
  });

  it("takes NULL, [] and keys from the list", async () => {
    await inRollback(async (db) => {
      expect(await write(db, null)).toBe("ok");
      expect(await write(db, "[]")).toBe("ok");
      expect(await write(db, JSON.stringify(MENU_ALLERGEN_KEYS))).toBe("ok");
      expect(await write(db, '["sut", "gluten"]')).toBe("ok");
    });
  });

  it("refuses a key off the list, a non-array and a nested array", async () => {
    await inRollback(async (db) => {
      for (const bad of ['["nuts"]', '"sut"', '{"sut": true}', '[["sut"]]']) {
        // 23514: check_violation.
        expect(await write(db, bad), bad).toBe("23514");
      }
    });
  });

  it("the price list day starts empty on the settings row", async () => {
    await inRollback(async (db) => {
      const { rows } = await db.query(
        `select column_default, is_nullable from information_schema.columns
          where table_schema = 'public' and table_name = 'settings'
            and column_name = 'menuPricesEffectiveDate'`,
      );
      expect(rows[0]).toEqual({
        column_default: "''::text",
        is_nullable: "NO",
      });
    });
  });
});
