import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * Kategoriler → Sil against a real Postgres: two operators deleting the two
 * rows that carry one slug at the same moment. Each check saw the other row
 * and let its delete through, and the products were left with no category;
 * the delete now looks again afterwards and puts its row back. Skipped
 * without TEST_DATABASE_URL, like the other tests/db-integration*.test.ts.
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
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/admin/auth", () => ({
  requireRole: async () => ({ email: "patron@laffogato.net" }),
  getAdminSession: async () => ({ email: "patron@laffogato.net" }),
}));
vi.mock("@/lib/admin/flash", () => ({ setAdminFlash: async () => {} }));

const RUN = Date.now().toString(36);
const SLUG = "gear";
const A = `cat-race-a-${RUN}`;
const B = `cat-race-b-${RUN}`;
const PRODUCT = `prd-race-${RUN}`;

function form(id: string): FormData {
  const fd = new FormData();
  fd.set("id", id);
  return fd;
}

maybe("category delete race (real Postgres)", () => {
  let release: (() => Promise<void>) | undefined;
  let saved: Record<string, unknown>[] = [];

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 6 });
    await applyBundledSchema(pool);
    // Only this suite's two rows carry the slug while it runs.
    saved = (
      await pool.query(`select * from public.categories where slug = $1`, [
        SLUG,
      ])
    ).rows;
    await pool.query(`delete from public.categories where slug = $1`, [SLUG]);
    await pool.query(
      `insert into public.categories (id, slug, label, icon, "sortOrder")
       values ($1, $3, 'Ekipman A', '', 0), ($2, $3, 'Ekipman B', '', 1)`,
      [A, B, SLUG],
    );
    await pool.query(
      `insert into public.products (id, name, slug, cat)
       values ($1, 'Yarış Değirmeni', $1, $2)`,
      [PRODUCT, SLUG],
    );
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    if (pool) {
      await pool.query(`delete from public.products where id = $1`, [
        PRODUCT,
      ]);
      await pool.query(`delete from public.categories where id in ($1, $2)`, [
        A,
        B,
      ]);
      for (const row of saved) {
        await pool.query(
          `insert into public.categories (id, slug, label, icon, "sortOrder")
           values ($1, $2, $3, $4, $5) on conflict (id) do nothing`,
          [row.id, row.slug, row.label, row.icon, row.sortOrder],
        );
      }
      await pool.end();
      pool = null;
    }
    await release?.();
  });

  it("never leaves the slug's products without a category", async () => {
    const { deleteCategoryAction } =
      await import("@/app/admin/kategoriler/actions");
    const results = await Promise.all([
      deleteCategoryAction(null, form(A)),
      deleteCategoryAction(null, form(B)),
    ]);
    const left = await pool!.query(
      `select id from public.categories where slug = $1`,
      [SLUG],
    );
    expect(left.rowCount).toBeGreaterThanOrEqual(1);
    // Whoever lost the race was told why.
    const refused = results.filter((r) => !r.ok);
    expect(refused.length).toBeGreaterThanOrEqual(1);
    for (const r of refused) {
      expect(r.ok ? "" : r.error).toMatch(/Bu kategoride \d+ ürün var/);
    }
  });
});
