import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Executor } from "@/lib/db/client";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * The catalog lists' reads against a real Postgres (admin audit 5d,
 * CAT-07, CAT-08, CAT-16). The page tests mock the store, so only this
 * file proves the SQL itself: the panel's product read never selects the
 * cost, the photos, the description or the SEO fields; the thumbnails come
 * back as served paths for the ids asked; the ledger's count and its pages
 * agree under a product and a day filter, newest first, with no move twice
 * or missing across pages. Skipped without TEST_DATABASE_URL, like the
 * other tests/db-integration*.test.ts.
 */
const URL_ = process.env.TEST_DATABASE_URL;
const maybe = URL_ ? describe : describe.skip;

let pool: pg.Pool | null = null;
const holder = vi.hoisted(() => ({
  pool: null as pg.Pool | null,
  texts: [] as string[],
}));
const execute: Executor = async (q) => {
  if (!holder.pool) throw new Error("pool not ready");
  holder.texts.push(q.text);
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
const PHOTO = `prd-cl-photo-${RUN}`;
const BARE = `prd-cl-bare-${RUN}`;
const LINKED = `prd-cl-linked-${RUN}`;
const DATA_URL = `data:image/png;base64,${"A".repeat(64)}`;

maybe("catalog lists in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;
  let store: typeof import("@/lib/admin/store");

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 4 });
    holder.pool = pool;
    await applyBundledSchema(pool);
    await pool.query(
      `insert into public.products
         (id, name, slug, "priceMinor", "costMinor", "desc", cat, stock,
          "isActive", images, "seoTitle", variants)
       values
         ($1, 'CL Foto', $4, 32000, 12345, 'Gizli not', 'beans', 5, true,
          $7::jsonb, 'Gizli SEO', '[{"id":"a","name":"250 g","priceDeltaMinor":0,"stock":5,"sku":"V","isActive":true}]'::jsonb),
         ($2, 'CL Yalın', $5, 1000, 0, '', 'gift', 0, false, '[]'::jsonb, '', '[]'::jsonb),
         ($3, 'CL Bağlantı', $6, 2000, 0, '', 'gift', 1, true,
          '["https://ornek.com/a.jpg"]'::jsonb, '', '[]'::jsonb)`,
      [
        PHOTO,
        BARE,
        LINKED,
        `cl-foto-${RUN}`,
        `cl-yalin-${RUN}`,
        `cl-baglanti-${RUN}`,
        JSON.stringify([DATA_URL, DATA_URL]),
      ],
    );
    // 250 moves for PHOTO over three Istanbul days (several sharing one
    // instant, so the page edges need the id tiebreak), and 5 for BARE.
    const values: unknown[] = [];
    const tuples: string[] = [];
    const add = (id: string, productId: string, createdAt: string) => {
      const n = values.length;
      values.push(id, productId, createdAt);
      tuples.push(`($${n + 1}, $${n + 2}, 'order_placed', $${n + 3})`);
    };
    for (let i = 0; i < 250; i += 1) {
      // 1 Oct 2026 21:00Z is 2 Oct 00:00 in Istanbul.
      const day = i < 100 ? "01" : i < 200 ? "02" : "03";
      const clock = i % 10 === 0 ? "20:59:59.000" : "21:30:00.000";
      add(
        `mov-cl-${RUN}-${String(i).padStart(3, "0")}`,
        PHOTO,
        `2026-10-${day}T${clock}Z`,
      );
    }
    for (let i = 0; i < 5; i += 1) {
      add(`mov-cl-${RUN}-b${i}`, BARE, "2026-10-02T21:30:00.000Z");
    }
    await pool.query(
      `insert into public.stock_moves (id, "productId", reason, "createdAt")
       values ${tuples.join(", ")}`,
      values,
    );
    store = await import("@/lib/admin/store");
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    try {
      await pool?.query(
        `delete from public.stock_moves where "productId" = any($1)`,
        [[PHOTO, BARE, LINKED]],
      );
      await pool?.query(`delete from public.products where id = any($1)`, [
        [PHOTO, BARE, LINKED],
      ]);
    } finally {
      await pool?.end();
      pool = null;
      holder.pool = null;
      await release?.();
    }
  });

  it("the panel's product read selects no cost, photos, description or SEO", async () => {
    holder.texts = [];
    const all = await store.listProductsForPanel();
    const mine = all.find((p) => p.id === PHOTO);
    expect(mine).toMatchObject({
      name: "CL Foto",
      stock: 5,
      variants: [expect.objectContaining({ id: "a", stock: 5 })],
    });
    for (const key of [
      "costMinor",
      "images",
      "desc",
      "seoTitle",
      "seoDescription",
    ]) {
      expect(mine, key).not.toHaveProperty(key);
    }
    expect(JSON.stringify(all)).not.toContain("data:image");
    const read = holder.texts.find((t) => t.includes('"lowStockThreshold"'));
    expect(read).toBeDefined();
    expect(read).not.toMatch(/\*|"costMinor"|"images"|"seoTitle"/);
  });

  it("thumbnails are served paths, only for the ids asked", async () => {
    const thumbs = await store.listProductThumbs([PHOTO, BARE, LINKED]);
    expect(thumbs[PHOTO]).toMatch(
      new RegExp(`^/gorsel/urun/${PHOTO}/0\\?v=[0-9a-f]{12}$`),
    );
    expect(thumbs[LINKED]).toBe("https://ornek.com/a.jpg");
    expect(thumbs).not.toHaveProperty(BARE);
    expect(await store.listProductThumbs([])).toEqual({});
    expect(Object.keys(await store.listProductThumbs([LINKED]))).toEqual([
      LINKED,
    ]);
  });

  it("the ledger's count and pages agree, newest first, none twice", async () => {
    expect(await store.countStockMoves({ productId: PHOTO })).toBe(250);
    const seen: string[] = [];
    for (const offset of [0, 100, 200]) {
      const page = await store.listStockMoves({
        productId: PHOTO,
        limit: 100,
        offset,
      });
      seen.push(...page.map((m) => m.id));
    }
    expect(seen).toHaveLength(250);
    expect(new Set(seen).size).toBe(250);
    const stamps = (
      await store.listStockMoves({ productId: PHOTO, limit: 250 })
    ).map((m) => m.createdAt);
    expect([...stamps].sort().reverse()).toEqual(stamps);
  });

  it("an Istanbul day range counts and lists the same moves", async () => {
    const { istanbulDayStartIso } = await import("@/lib/admin/order-filters");
    // 2 Oct in Istanbul: 1 Oct 21:00Z up to 2 Oct 21:00Z.
    const day = {
      fromIso: istanbulDayStartIso("2026-10-02"),
      beforeIso: istanbulDayStartIso("2026-10-02", 1),
    };
    const both = await store.countStockMoves(day);
    const mine = await store.countStockMoves({ ...day, productId: PHOTO });
    const listed = await store.listStockMoves({
      ...day,
      productId: PHOTO,
      limit: 500,
    });
    // Moves 0-99 on 1 Oct: the 90 at 21:30Z fall on 2 Oct. Moves 100-199
    // on 2 Oct: the 10 at 20:59:59Z are 2 Oct too, the 90 at 21:30Z are 3
    // Oct. BARE's five at 2 Oct 21:30Z are 3 Oct.
    expect(mine).toBe(100);
    expect(listed).toHaveLength(100);
    expect(both).toBeGreaterThanOrEqual(mine);
    expect(await store.countStockMoves({ ...day, productId: BARE })).toBe(0);
  });
});
