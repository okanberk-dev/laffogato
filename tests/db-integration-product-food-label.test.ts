import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Executor } from "@/lib/db/client";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * The packaged food label through the product CSV against a real Postgres
 * (TGK Etiketleme m.9/1, m.17/2-a; columns from
 * 20261019170200_product_food_label.sql): the import's read selects the
 * label, the allergens and the tags; a planned row writes them with the
 * real query layer; the same file a second time changes nothing; a new
 * product opens with its label and the app's `nuts` tag; and the shop's
 * mapping (`toDesignProduct`, what the cached product page reads) carries
 * the entered fields and leaves the empty ones out. Skipped without
 * TEST_DATABASE_URL, like the other tests/db-integration*.test.ts.
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

let pool: pg.Pool | null = null;
const holder = vi.hoisted(() => ({ pool: null as pg.Pool | null }));
const execute: Executor = async (q) => {
  if (!holder.pool) throw new Error("pool not ready");
  const r = await holder.pool.query(q.text, q.params as unknown[]);
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

const RUN = Date.now().toString(36).toUpperCase();
const BEANS = `prd-fl-beans-${RUN}`;
const BEANS_SKU = `FL-BEANS-${RUN}`;
const NEW_SKU = `FL-NEW-${RUN}`;

maybe("the product food label through the CSV import in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;
  let store: typeof import("@/lib/admin/store");
  let imp: typeof import("@/lib/admin/product-import");
  let createdId = "";

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 4 });
    holder.pool = pool;
    await applyBundledSchema(pool);
    // The shared database holds products other suites wrote with fixed ids
    // (schema-objects' prd-0001, -0006, -0011) without moving the counter,
    // so the import's new product could draw a taken id and fail on the
    // primary key. Lift the counter past them, as the app's own seed does
    // (store.ts setCounter, `raise_counter`).
    await pool.query(
      `select public.raise_counter('prd', coalesce(
         (select max(substring(id from '^prd-([0-9]+)$')::bigint) from public.products),
         0))`,
    );
    await pool.query(
      `insert into public.products
         (id, name, slug, sku, tag, img, "priceMinor", "desc", cat, stock, "isActive", tags)
       values ($1, 'FL Çekirdek', $2, $3, 'Çekirdek · 250 g', 'caramel', 32000,
               'Espresso harmanı.', 'beans', 4, true, '[]'::jsonb)`,
      [BEANS, `fl-cekirdek-${RUN.toLowerCase()}`, BEANS_SKU],
    );
    store = await import("@/lib/admin/store");
    imp = await import("@/lib/admin/product-import");
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    try {
      await pool?.query(
        `delete from public.products where id = $1 or sku = $2`,
        [BEANS, NEW_SKU],
      );
    } finally {
      await pool?.end();
      pool = null;
      holder.pool = null;
      await release?.();
    }
  });

  const FILE = [
    "sku;Alerjenler;Net miktar;İçindekiler;Saklama koşulu;Menşe",
    `${BEANS_SKU};Süt, gluten;250 g;"Kahve çekirdeği,\n süt tozu";Serin ve kuru yerde saklayın.;Brezilya`,
  ].join("\r\n");

  it("writes the label and the allergens, and reads them back", async () => {
    const before = (await store.listProductsForImport()).find((p) => p.id === BEANS);
    expect(before).toMatchObject({ allergens: null, ingredients: "", tags: [] });

    const plan = imp.planProductImport(FILE, await imp.loadImportContext());
    if (!plan.ok) throw new Error(plan.error);
    expect(plan.rows[0].view, plan.rows[0].view.messages.join(" | ")).toMatchObject({
      status: "update",
    });
    const out = await imp.applyProductImport(plan, { actor: "owner@laffogato.net" });
    expect(out.updatedIds).toEqual([BEANS]);

    const { rows } = await pool!.query(
      `select allergens, "netQuantity", ingredients, "storageConditions", origin, producer
         from public.products where id = $1`,
      [BEANS],
    );
    expect(rows[0]).toEqual({
      allergens: ["gluten", "sut"],
      netQuantity: "250 g",
      ingredients: "Kahve çekirdeği,\nsüt tozu",
      storageConditions: "Serin ve kuru yerde saklayın.",
      origin: "Brezilya",
      producer: "",
    });

    const again = imp.planProductImport(FILE, await imp.loadImportContext());
    if (!again.ok) throw new Error(again.error);
    expect(again.rows[0].view.status).toBe("unchanged");
  });

  it("the shop's mapping shows what was entered and nothing for the empty fields", async () => {
    const full = await store.getProduct(BEANS);
    const shown = store.toDesignProduct(full!);
    expect(shown).toMatchObject({
      allergens: ["gluten", "sut"],
      netQuantity: "250 g",
      ingredients: "Kahve çekirdeği,\nsüt tozu",
      storageConditions: "Serin ve kuru yerde saklayın.",
      origin: "Brezilya",
    });
    for (const empty of ["producer", "businessRegNo", "nutrition", "usageInstructions"]) {
      expect(shown, empty).not.toHaveProperty(empty);
    }
  });

  it("a new product opens with its label and the app's nut warning", async () => {
    const plan = imp.planProductImport(
      [
        "sku;name;category;price;description;allergens;netQuantity",
        `${NEW_SKU};FL Fıstıklı Kurabiye ${RUN};beans;120;Tereyağlı kurabiye.;Gluten, Sert kabuklu meyveler;180 g`,
      ].join("\r\n"),
      await imp.loadImportContext(),
    );
    if (!plan.ok) throw new Error(plan.error);
    const out = await imp.applyProductImport(plan, { actor: "owner@laffogato.net" });
    expect(out.createdIds).toHaveLength(1);
    createdId = out.createdIds[0];
    const { rows } = await pool!.query(
      `select allergens, tags, "netQuantity", ingredients, "isActive"
         from public.products where id = $1`,
      [createdId],
    );
    expect(rows[0]).toEqual({
      allergens: ["gluten", "sert_kabuklu"],
      tags: ["nuts"],
      netQuantity: "180 g",
      ingredients: "",
      isActive: false,
    });
  });
});
