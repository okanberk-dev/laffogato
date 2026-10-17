import { readFileSync } from "node:fs";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Executor } from "@/lib/db/client";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * Product and variant stock against a real Postgres
 * (20261017200000_variant_stock_adjust.sql, admin audit CAT-03, CAT-14):
 * an order claimed while the product form is open survives the save, a
 * variant moves the total only while it is active, a count never goes below
 * zero and a refusal writes nothing, every change leaves a stock move, the
 * product as a whole is not adjusted once it has variants, and the one-time
 * fix of totals left at 0 runs once. Skipped without TEST_DATABASE_URL, like
 * the other tests/db-integration*.test.ts.
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

const MIGRATION = "20261017200000_variant_stock_adjust.sql";

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

const RUN = Date.now().toString(36);
const BEANS = `prd-vs-beans-${RUN}`;
const MOKA = `prd-vs-moka-${RUN}`;
const CUPS = `prd-vs-cups-${RUN}`;

const VARIANTS = [
  { id: "a", name: "250 g", priceDeltaMinor: 0, stock: 6, sku: "", isActive: true },
  { id: "b", name: "1 kg", priceDeltaMinor: 50_000, stock: 4, sku: "", isActive: true },
  { id: "c", name: "Eski", priceDeltaMinor: 0, stock: 3, sku: "", isActive: false },
];

async function row(id: string) {
  const { rows } = await pool!.query(
    `select stock, "priceMinor", name, variants from public.products where id = $1`,
    [id],
  );
  return rows[0] as {
    stock: number;
    priceMinor: number;
    name: string;
    variants: Array<{ id: string; stock: number; isActive: boolean; name: string }>;
  };
}

async function moves(id: string) {
  const { rows } = await pool!.query(
    `select "productName", delta, "stockAfter", note, actor
       from public.stock_moves where "productId" = $1 order by id`,
    [id],
  );
  return rows as Array<{
    productName: string;
    delta: number;
    stockAfter: number;
    note: string;
    actor: string;
  }>;
}

maybe("variant stock in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;
  let store: typeof import("@/lib/admin/store");

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 4 });
    holder.pool = pool;
    await applyBundledSchema(pool);
    // The bundle replays every migration when a deploy adds one.
    await applyBundledSchema(pool);
    await pool.query(
      `insert into public.products (id, name, slug, "priceMinor", cat, stock, "isActive", variants)
       values ($1, 'VS Sirena', $4, 32000, 'beans', 10, true, $5::jsonb),
              ($2, 'VS Moka', $6, 120000, 'gear', 4, true, '[]'::jsonb),
              ($3, 'VS Kup', $7, 24000, 'gift', 0, true, $8::jsonb)`,
      [
        BEANS,
        MOKA,
        CUPS,
        `vs-sirena-${RUN}`,
        JSON.stringify(VARIANTS),
        `vs-moka-${RUN}`,
        `vs-kup-${RUN}`,
        JSON.stringify([
          { id: "six", name: "6'lı", priceDeltaMinor: 0, stock: 5, sku: "", isActive: true },
          { id: "twelve", name: "12'li", priceDeltaMinor: 0, stock: 2, sku: "", isActive: false },
        ]),
      ],
    );
    store = await import("@/lib/admin/store");
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    try {
      await pool?.query(`delete from public.stock_moves where "productId" = any($1)`, [
        [BEANS, MOKA, CUPS],
      ]);
      await pool?.query(`delete from public.products where id = any($1)`, [
        [BEANS, MOKA, CUPS],
      ]);
    } finally {
      await pool?.end();
      pool = null;
      holder.pool = null;
      await release?.();
    }
  });

  it("a variant moves the total while it is active, and leaves a stock move", async () => {
    const active = await store.adjustVariantStock({
      productId: BEANS,
      variantId: "a",
      delta: -2,
      note: "Hasar",
      actor: "stok@laffogato.net",
    });
    expect(active).toEqual({
      ok: true,
      label: "VS Sirena · 250 g",
      variantStock: 4,
      stock: 8,
    });
    const inactive = await store.adjustVariantStock({
      productId: BEANS,
      variantId: "c",
      delta: 2,
      note: "Sayım",
      actor: "stok@laffogato.net",
    });
    expect(inactive).toMatchObject({ ok: true, variantStock: 5, stock: 8 });
    expect(await moves(BEANS)).toEqual([
      { productName: "VS Sirena · 250 g", delta: -2, stockAfter: 4, note: "Hasar", actor: "stok@laffogato.net" },
      { productName: "VS Sirena · Eski", delta: 2, stockAfter: 5, note: "Sayım", actor: "stok@laffogato.net" },
    ]);
    expect(
      await store.adjustVariantStock({
        productId: BEANS,
        variantId: "a",
        delta: -9,
        note: "x",
        actor: "x",
      }),
    ).toEqual({ ok: false, error: "Stok eksiye düşemez (mevcut: 4)." });
    expect((await row(BEANS)).stock).toBe(8);
  });

  it("the product as a whole is not adjusted once it has variants", async () => {
    expect(
      await store.adjustStock({ productId: BEANS, delta: 5, note: "x", actor: "x" }),
    ).toEqual({ ok: false, error: store.VARIANT_PRODUCT_STOCK_ERROR });
    expect(
      await store.adjustStock({ productId: MOKA, delta: 1, note: "Sayım", actor: "x" }),
    ).toMatchObject({ ok: true, product: { stock: 5 } });
  });

  it("an order claimed while the form is open survives the save (CAT-03)", async () => {
    // The form opens: it reads 8 in all, 4 for 250 g and 4 for 1 kg.
    const opened = await store.getProduct(BEANS);
    expect(opened).toMatchObject({ stock: 8 });
    // A customer buys three of 250 g while it is open.
    const claim = await pool!.query(
      `select public.claim_order_stock($1::jsonb, 'now') as r`,
      [JSON.stringify([{ productId: BEANS, variantId: "a", qty: 3 }])],
    );
    expect(claim.rows[0].r).toEqual([5]);
    // The operator raises 250 g from 4 to 10, renames the product and
    // changes nothing else.
    const typed = opened!.variants.map((v) => ({
      ...v,
      stockAtOpen: v.stock,
      stock: v.id === "a" ? 10 : v.stock,
    }));
    const saved = await store.updateProduct(
      BEANS,
      {
        ...opened!,
        name: "VS Sirena Espresso",
        stockAtOpen: opened!.stock,
        variants: typed,
      },
      { actor: "urun@laffogato.net" },
    );
    // 250 g: 4 - 3 sold + 6 typed = 7; the total: 5 + 6 = 11.
    expect(saved).toMatchObject({ stock: 11 });
    const after = await row(BEANS);
    expect(after.name).toBe("VS Sirena Espresso");
    expect(after.stock).toBe(11);
    expect(after.variants.find((v) => v.id === "a")?.stock).toBe(7);
    expect(after.variants.find((v) => v.id === "b")?.stock).toBe(4);
    expect((await moves(BEANS)).at(-1)).toEqual({
      productName: "VS Sirena Espresso · 250 g",
      delta: 6,
      stockAfter: 7,
      note: "Ürün formu",
      actor: "urun@laffogato.net",
    });
  });

  it("a change below zero is refused with the stored counts, and price, variants and stock stay", async () => {
    const opened = (await store.getProduct(BEANS))!;
    await pool!.query(
      `select public.claim_order_stock($1::jsonb, 'now')`,
      [JSON.stringify([{ productId: BEANS, variantId: "b", qty: 3 }])],
    );
    const res = await store.updateProduct(BEANS, {
      ...opened,
      priceMinor: 1,
      stockAtOpen: opened.stock,
      variants: opened.variants.map((v) => ({
        ...v,
        stockAtOpen: v.stock,
        // 4 at open, set to 0: 1 is left after the sale, 1 - 4 < 0.
        stock: v.id === "b" ? 0 : v.stock,
      })),
    });
    expect(res).toMatchObject({
      refusal: {
        field: "variants",
        stockNow: { stock: 8, variants: { a: 7, b: 1, c: 5 } },
      },
    });
    const after = await row(BEANS);
    expect(after.priceMinor).toBe(32_000);
    expect(after.stock).toBe(8);
    expect(after.variants.find((v) => v.id === "b")?.stock).toBe(1);
  });

  it("a product getting its first variants takes their sum, and the ledger explains it", async () => {
    const opened = (await store.getProduct(MOKA))!;
    const saved = await store.updateProduct(MOKA, {
      ...opened,
      stockAtOpen: opened.stock,
      variants: [
        { id: "red", name: "Kırmızı", priceDeltaMinor: 0, stock: 2, sku: "", isActive: true, stockAtOpen: null },
        { id: "blue", name: "Mavi", priceDeltaMinor: 0, stock: 3, sku: "", isActive: false, stockAtOpen: null },
      ],
    });
    expect(saved).toMatchObject({ stock: 2 });
    const ledger = await moves(MOKA);
    // +1 from the Stok screen, then the form: the variants and the total.
    expect(ledger.slice(-3)).toEqual([
      expect.objectContaining({ productName: "VS Moka · Kırmızı", delta: 2, stockAfter: 2 }),
      expect.objectContaining({ productName: "VS Moka · Mavi", delta: 3, stockAfter: 3 }),
      expect.objectContaining({ productName: "VS Moka", delta: -5, stockAfter: 2, note: "Ürün formu: varyant toplamı" }),
    ]);
  });

  it("the fix of totals left at 0 runs once", async () => {
    // The bundle's own run already fixed nothing of ours (the row came
    // later); replay the migration as a deploy that has not seen it would.
    const sql = readFileSync(`db/migrations/${MIGRATION}`, "utf8");
    const client = await pool!.connect();
    try {
      await client.query("begin");
      await client.query(`delete from public._migrations where name = $1`, [MIGRATION]);
      await client.query(sql);
      await client.query(`insert into public._migrations (name) values ($1)`, [MIGRATION]);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
    expect((await row(CUPS)).stock).toBe(5);
    expect(await moves(CUPS)).toEqual([
      expect.objectContaining({ delta: 5, stockAfter: 5, actor: "system" }),
    ]);
    // A later replay finds it recorded and changes nothing.
    await pool!.query(`update public.products set stock = 0 where id = $1`, [CUPS]);
    await applyBundledSchema(pool!);
    expect((await row(CUPS)).stock).toBe(0);
    expect(await moves(CUPS)).toHaveLength(1);
  });
});
