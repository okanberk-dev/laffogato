import { readFileSync } from "node:fs";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * The menu-photos migration in a real Postgres (17 Oct 2026): it fills only
 * an empty photo on a row that still has the name the photo was chosen for,
 * and only on its first run, because the bundle re-runs every migration
 * whenever a deploy adds one. Each test runs in a transaction that is rolled
 * back, so the shared menu rows stay as they were. Skipped without a
 * database:
 *
 *   TEST_DATABASE_URL=postgres://user@host:5432/db npm test
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

const FILE = "20261017120000_menu_photos.sql";
const MIGRATION = readFileSync(`db/migrations/${FILE}`, "utf8");
const OPERATOR_PHOTO = "data:image/webp;base64,T1BFUkFUT1I=";

maybe("the menu-photos migration in a real Postgres", () => {
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

  /** Runs `body` in a transaction that is always rolled back. */
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

  async function put(
    db: pg.PoolClient,
    id: string,
    name: string,
    image: string,
    cutout = false,
  ) {
    await db.query(
      `insert into public.menu_items (id, "categoryKey", name, image, "photoCutout")
       values ($1, 'espresso', $2, $3, $4)
       on conflict (id) do update
         set name = excluded.name, image = excluded.image,
             "photoCutout" = excluded."photoCutout"`,
      [id, name, image, cutout],
    );
  }

  async function photo(db: pg.PoolClient, id: string) {
    const { rows } = await db.query(
      `select image, "photoCutout" as cutout from public.menu_items where id = $1`,
      [id],
    );
    return rows[0];
  }

  it("fills an empty photo, keeps the operator's, skips a renamed or deleted row", async () => {
    await inRollback(async (db) => {
      // The database as it was before this file ran.
      await db.query(`delete from public._migrations where name = $1`, [FILE]);
      await put(db, "mnu-0019", "Türk Kahvesi", "", true);
      await put(db, "mnu-0004", "L'Affogato", OPERATOR_PHOTO);
      await put(db, "mnu-0005", "Espresso (çift)", "");
      await put(db, "mnu-0001", "Matcha Latte", "/menu/matcha-latte.webp");
      await put(db, "mnu-0041", "Salep", "");
      await db.query(`delete from public.menu_items where id = 'mnu-0006'`);

      await db.query(MIGRATION);

      expect(await photo(db, "mnu-0019")).toEqual({
        image: "/menu/turkish-coffee.webp",
        cutout: false,
      });
      expect((await photo(db, "mnu-0004")).image).toBe(OPERATOR_PHOTO);
      expect((await photo(db, "mnu-0005")).image).toBe("");
      expect((await photo(db, "mnu-0001")).image).toBe(
        "/menu/matcha-latte.webp",
      );
      // Salep has no acceptable photo: the migration does not list it.
      expect((await photo(db, "mnu-0041")).image).toBe("");
      // A deleted item is not brought back.
      expect(await photo(db, "mnu-0006")).toBeUndefined();
    });
  });

  it("does nothing once recorded: a photo the operator removed stays removed", async () => {
    await inRollback(async (db) => {
      await db.query(
        `insert into public._migrations (name) values ($1)
         on conflict (name) do nothing`,
        [FILE],
      );
      await put(db, "mnu-0019", "Türk Kahvesi", "");

      await db.query(MIGRATION);

      expect((await photo(db, "mnu-0019")).image).toBe("");
    });
  });

  // 18 Oct 2026 (OP-MENU-PHOTOS): eight of those photos contradict the item.
  const OFF_FILE = "20261018210000_menu_photos_mismatch.sql";
  const OFF_MIGRATION = readFileSync(`db/migrations/${OFF_FILE}`, "utf8");

  it("empties the eight only while they carry the path the first migration wrote", async () => {
    await inRollback(async (db) => {
      await db.query(`delete from public._migrations where name = $1`, [
        OFF_FILE,
      ]);
      await put(
        db,
        "mnu-0074",
        "Rosbeef Sandviç",
        "/menu/roast-beef-sandwich.webp",
      );
      await put(
        db,
        "mnu-0082",
        "Alternatif Süt",
        "/menu/alternative-milk.webp",
      );
      // The operator's own photo on one of the eight, and a stock photo
      // that is not among them.
      await put(db, "mnu-0073", "Karabuğday Simit", OPERATOR_PHOTO);
      await put(db, "mnu-0072", "Tiramisu", "/menu/tiramisu.webp");

      await db.query(OFF_MIGRATION);

      expect((await photo(db, "mnu-0074")).image).toBe("");
      expect((await photo(db, "mnu-0082")).image).toBe("");
      expect((await photo(db, "mnu-0073")).image).toBe(OPERATOR_PHOTO);
      expect((await photo(db, "mnu-0072")).image).toBe("/menu/tiramisu.webp");
    });
  });

  it("does nothing once recorded: a stock path linked again by hand stays", async () => {
    await inRollback(async (db) => {
      await db.query(
        `insert into public._migrations (name) values ($1)
         on conflict (name) do nothing`,
        [OFF_FILE],
      );
      await put(
        db,
        "mnu-0074",
        "Rosbeef Sandviç",
        "/menu/roast-beef-sandwich.webp",
      );

      await db.query(OFF_MIGRATION);

      expect((await photo(db, "mnu-0074")).image).toBe(
        "/menu/roast-beef-sandwich.webp",
      );
    });
  });
});
