import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { TARGETS, writeScene } from "../scripts/backfill-backdrops.mjs";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * The backfill's write in a real Postgres (review L-3, 25 Sep 2026): it lands
 * only on the row as the script read it. When the operator saves the item
 * through the panel in between (another photo, hue or category, or a scene
 * chosen by hand), the panel's values stay. Skipped without a database:
 *
 *   TEST_DATABASE_URL=postgres://user@host:5432/db npm test
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

const MENU_ID = "mnu-t-backfill";
const PRODUCT_ID = "prd-t-backfill";
const OLD = "data:image/webp;base64,T0xE";
const NEW = "data:image/webp;base64,TkVX";
const NEXT = { backdrop: "caramel", hex: "#B87333", cutout: true };

const [MENU, SHOP] = TARGETS;

type Target = (typeof TARGETS)[number];

maybe("the backfill's write in a real Postgres", () => {
  let pool: pg.Pool;
  let release: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 2 });
    await applyBundledSchema(pool);
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool.query(`delete from public.menu_items where id = $1`, [MENU_ID]);
    await pool.query(`delete from public.products where id = $1`, [
      PRODUCT_ID,
    ]);
    await pool.end();
    await release?.();
  });

  beforeEach(async () => {
    await pool.query(`delete from public.menu_items where id = $1`, [MENU_ID]);
    await pool.query(
      `insert into public.menu_items (id, "categoryKey", name, hue, image)
       values ($1, 'frozen', 'Backfill testi', 'rose', $2)`,
      [MENU_ID, OLD],
    );
    await pool.query(`delete from public.products where id = $1`, [
      PRODUCT_ID,
    ]);
    await pool.query(
      `insert into public.products (id, slug, name, cat, img, images)
       values ($1, 'backfill-testi', 'Backfill testi', 'beans', 'caramel', $2::jsonb)`,
      [PRODUCT_ID, JSON.stringify([OLD, NEW])],
    );
  });

  /** The row exactly as the script reads it, through the target's select. */
  async function readAsScript(target: Target, id: string) {
    const { rows } = await pool.query(
      `select * from (${target.select}) as read where id = $1`,
      [id],
    );
    expect(rows).toHaveLength(1);
    return rows[0];
  }

  async function scene(table: string, id: string) {
    const { rows } = await pool.query(
      `select backdrop, "backdropHex" as hex, "photoCutout" as cutout
         from public.${table} where id = $1`,
      [id],
    );
    return rows[0];
  }

  it("writes a row that is still as it was read", async () => {
    const row = await readAsScript(MENU, MENU_ID);
    expect(row.image).toBe(OLD);
    expect(await writeScene(pool, MENU, row, NEXT)).toBe(true);
    expect(await scene("menu_items", MENU_ID)).toEqual({
      backdrop: "caramel",
      hex: "#B87333",
      cutout: true,
    });

    const product = await readAsScript(SHOP, PRODUCT_ID);
    expect(product.image).toBe(OLD);
    expect(await writeScene(pool, SHOP, product, NEXT)).toBe(true);
    expect((await scene("products", PRODUCT_ID)).backdrop).toBe("caramel");
  });

  it("leaves the panel's save alone when a new photo landed in between", async () => {
    const row = await readAsScript(MENU, MENU_ID);
    // The panel saves a new photo while the script decodes the old one.
    await pool.query(
      `update public.menu_items
          set image = $2, backdrop = 'strawberry', "backdropHex" = '#E27D9A',
              "photoCutout" = false
        where id = $1`,
      [MENU_ID, NEW],
    );
    expect(await writeScene(pool, MENU, row, NEXT)).toBe(false);
    expect(await scene("menu_items", MENU_ID)).toEqual({
      backdrop: "strawberry",
      hex: "#E27D9A",
      cutout: false,
    });
  });

  it("leaves a product alone when its first photo changed in between", async () => {
    const product = await readAsScript(SHOP, PRODUCT_ID);
    // Reordered: the same two photos, another one first.
    await pool.query(
      `update public.products set images = $2::jsonb where id = $1`,
      [PRODUCT_ID, JSON.stringify([NEW, OLD])],
    );
    expect(await writeScene(pool, SHOP, product, NEXT)).toBe(false);
    expect((await scene("products", PRODUCT_ID)).backdrop).toBeNull();
  });

  it("leaves the row alone when its hue, category or source changed in between", async () => {
    const changes = [
      `update public.menu_items set hue = 'caramel' where id = $1`,
      `update public.menu_items set "categoryKey" = 'ice-coffee' where id = $1`,
      `update public.menu_items set "backdropSource" = 'manual', backdrop = 'berry' where id = $1`,
    ];
    for (const change of changes) {
      const row = await readAsScript(MENU, MENU_ID);
      await pool.query(change, [MENU_ID]);
      expect(await writeScene(pool, MENU, row, NEXT), change).toBe(false);
      expect((await scene("menu_items", MENU_ID)).backdrop).not.toBe(
        "caramel",
      );
    }
  });
});
