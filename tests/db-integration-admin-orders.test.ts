import pg from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * The order screens' server rules against a real Postgres
 * (db/migrations/20261017100000_admin_order_management.sql): the stock
 * release claimed and credited in ONE function, per-line restocks that can
 * never credit a line twice, the refund cap and one-time token, line status
 * written in place, the manual payment row that turns a late card payment
 * into a flagged duplicate, and the sweep leaving manual orders alone.
 * Skipped without TEST_DATABASE_URL, like the other db-integration suites.
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
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "10.9.8.7" }),
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));
vi.mock("@/lib/email/send", () => ({
  sendOrderPaidEmail: async () => ({ ok: true as const }),
  sendOrderCancelledEmail: async () => ({ ok: true as const }),
  sendOrderShippedEmail: async () => ({ ok: true as const }),
  sendOrderRefundedEmail: async () => ({ ok: true as const }),
}));
vi.mock("@/lib/payment", () => ({
  getPaymentProvider: () => ({
    name: "fakepos",
    lookupPayment: async () => null,
  }),
}));
vi.mock("@/lib/mobile/loyalty", () => ({
  onOrderPaid: async () => {},
  onOrderReversed: async () => {},
  settleLoyaltyDebt: async () => {},
}));

const PREFIX = "ord-adm-";

async function q<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await pool!.query(text, params)).rows as T[];
}

async function product(id: string, stock: number, variants: unknown[] = []) {
  await q(
    `insert into public.products (id, name, slug, stock, variants)
     values ($1, $1, $1, $2, $3::jsonb)`,
    [id, stock, JSON.stringify(variants)],
  );
}

async function insertOrder(
  id: string,
  orderNo: number,
  fields: {
    status?: string;
    items?: unknown[];
    totalMinor?: number;
    source?: string;
    createdAt?: string;
    paidAt?: string;
  } = {},
) {
  await q(
    `insert into public.orders (id, "orderNo", status, items, refunds,
       "totalMinor", "subtotalMinor", source, "createdAt", "paidAt",
       "customerEmail")
     values ($1, $2, $3, $4::jsonb, '[]'::jsonb, $5, $5, $6, $7, $8,
       'panel@laffogato.net')`,
    [
      id,
      orderNo,
      fields.status ?? "paid",
      JSON.stringify(fields.items ?? []),
      fields.totalMinor ?? 5000,
      fields.source ?? "",
      fields.createdAt ?? new Date().toISOString(),
      fields.paidAt ?? "",
    ],
  );
}

async function stockOf(id: string): Promise<number> {
  const rows = await q<{ stock: number }>(
    `select stock from public.products where id = $1`,
    [id],
  );
  return rows[0]?.stock ?? -1;
}

maybe("admin order rules, in SQL", () => {
  let release: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 8 });
    await applyBundledSchema(pool);
  }, SUITE_LOCK_WAIT_MS);

  afterAll(async () => {
    await pool?.end();
    pool = null;
    await release?.();
  });

  beforeEach(async () => {
    await q(`delete from public.payment_transactions where "orderId" like '${PREFIX}%'`);
    await q(`delete from public.stock_moves where "orderId" like '${PREFIX}%'`);
    await q(`delete from public.orders where id like '${PREFIX}%'`);
    await q(`delete from public.products where id like 'prd-adm-%'`);
    await q(`drop trigger if exists adm_test_fail on public.products`);
  });

  it("claims and credits in one step, a cancelled line included, once", async () => {
    await product("prd-adm-a", 10);
    await product("prd-adm-b", 5, [{ id: "v1", stock: 3 }]);
    await insertOrder(`${PREFIX}1`, 994001, {
      status: "cancelled",
      items: [
        { productId: "prd-adm-a", productName: "A", qty: 2 },
        // Marked "İptal" on its own earlier: it changed no stock, so the
        // cancel must still give it back (it used to be skipped for good).
        { productId: "prd-adm-b", variantId: "v1", productName: "B", qty: 1, status: "cancelled" },
        { productName: "Latte", qty: 1 },
      ],
    });
    const { rows } = await pool!.query(
      `select public.release_order_inventory($1, true, 'now') as r`,
      [`${PREFIX}1`],
    );
    expect(rows[0].r.lines.map((l: { qty: number }) => l.qty)).toEqual([2, 1]);
    expect(await stockOf("prd-adm-a")).toBe(12);
    expect(await stockOf("prd-adm-b")).toBe(6);
    const [b] = await q<{ variants: Array<{ stock: number }> }>(
      `select variants from public.products where id = 'prd-adm-b'`,
    );
    expect(b.variants[0].stock).toBe(4);
    // A second release finds the marker set and credits nothing.
    const again = await pool!.query(
      `select public.release_order_inventory($1, true, 'later') as r`,
      [`${PREFIX}1`],
    );
    expect(again.rows[0].r).toBeNull();
    expect(await stockOf("prd-adm-a")).toBe(12);
  });

  it("leaves the marker empty when the credit fails, so it can run again", async () => {
    await product("prd-adm-c", 4);
    await insertOrder(`${PREFIX}2`, 994002, {
      status: "cancelled",
      items: [{ productId: "prd-adm-c", productName: "C", qty: 1 }],
    });
    await q(`create or replace function public.adm_test_fail() returns trigger
      language plpgsql as $$ begin raise exception 'shelf jammed'; end; $$`);
    await q(`create trigger adm_test_fail before update on public.products
      for each row when (old.id = 'prd-adm-c') execute function public.adm_test_fail()`);
    await expect(
      pool!.query(`select public.release_order_inventory($1, true, 'now')`, [
        `${PREFIX}2`,
      ]),
    ).rejects.toThrow(/shelf jammed/);
    const [o] = await q<{ stockReleasedAt: string }>(
      `select "stockReleasedAt" from public.orders where id = $1`,
      [`${PREFIX}2`],
    );
    expect(o.stockReleasedAt).toBe("");
    await q(`drop trigger adm_test_fail on public.products`);
    // "Stoğu geri al" on the order page.
    const { retryOrderRelease } = await import("@/lib/admin/store");
    const res = await retryOrderRelease(`${PREFIX}2`, "panel@laffogato.net");
    expect(res).toMatchObject({ ok: true, release: { released: true, units: 1 } });
    expect(await stockOf("prd-adm-c")).toBe(5);
  });

  it("a parcel on the road: the marker is claimed, no unit comes back, a later restock still can", async () => {
    await product("prd-adm-d", 0);
    await insertOrder(`${PREFIX}3`, 994003, {
      status: "cancelled",
      items: [{ productId: "prd-adm-d", productName: "D", qty: 3 }],
    });
    await q(`select public.release_order_inventory($1, false, 'now')`, [`${PREFIX}3`]);
    expect(await stockOf("prd-adm-d")).toBe(0);
    const { rows } = await pool!.query(
      `select public.restock_order_lines($1, '[{"index":0,"qty":5}]'::jsonb, 'n') as r`,
      [`${PREFIX}3`],
    );
    // Capped at the line's own quantity, and only once.
    expect(rows[0].r.lines[0].qty).toBe(3);
    await q(`select public.restock_order_lines($1, '[{"index":0,"qty":1}]'::jsonb, 'n')`, [`${PREFIX}3`]);
    expect(await stockOf("prd-adm-d")).toBe(3);
  });

  it("cancels through the store with the stock decision, logging each move", async () => {
    await product("prd-adm-e", 1);
    await insertOrder(`${PREFIX}4`, 994004, {
      status: "preparing",
      paidAt: new Date().toISOString(),
      items: [{ productId: "prd-adm-e", productName: "E", qty: 2 }],
    });
    const { transitionOrder } = await import("@/lib/admin/store");
    const res = await transitionOrder(`${PREFIX}4`, "cancel", {
      restock: true,
      actor: "panel@laffogato.net",
    });
    expect(res).toMatchObject({ ok: true, release: { released: true, units: 2 } });
    expect(await stockOf("prd-adm-e")).toBe(3);
    const moves = await q<{ delta: number; reason: string; actor: string }>(
      `select delta, reason, actor from public.stock_moves where "orderId" = $1`,
      [`${PREFIX}4`],
    );
    expect(moves).toEqual([
      { delta: 2, reason: "order_cancelled", actor: "panel@laffogato.net" },
    ]);
  });

  it("refunds no more than was collected, and the same token only once", async () => {
    await insertOrder(`${PREFIX}5`, 994005, { status: "cancelled", totalMinor: 50000 });
    const reserve = async (refund: object, cap: number) =>
      (
        await pool!.query(
          `select public.reserve_order_refund_once($1, $2::jsonb, $3) as r`,
          [`${PREFIX}5`, JSON.stringify(refund), cap],
        )
      ).rows[0].r;
    // The POS took ₺100 for a ₺500 order.
    expect(await reserve({ id: "r1", amountMinor: 10001, token: "t1" }, 10000)).toBeNull();
    expect(await reserve({ id: "r1", amountMinor: 6000, token: "t1" }, 10000)).toHaveLength(1);
    // The same modal again: refused, though the amount would fit.
    expect(await reserve({ id: "r2", amountMinor: 1000, token: "t1" }, 10000)).toBeNull();
    expect(await reserve({ id: "r3", amountMinor: 4000, token: "t2" }, 10000)).toHaveLength(2);
    expect(await reserve({ id: "r4", amountMinor: 1, token: "t3" }, 10000)).toBeNull();
  });

  it("writes a line's status in place, and only on a live order", async () => {
    await insertOrder(`${PREFIX}6`, 994006, {
      status: "preparing",
      items: [
        { productName: "Latte", qty: 1, status: "pending" },
        { productName: "Kurabiye", qty: 2, status: "pending", restockedQty: 1 },
      ],
    });
    const { setOrderItemStatus } = await import("@/lib/admin/store");
    const ok = await setOrderItemStatus(`${PREFIX}6`, 1, "ready");
    expect(ok?.items[1]).toMatchObject({ status: "ready", restockedQty: 1 });
    expect(await setOrderItemStatus(`${PREFIX}6`, 9, "ready")).toBeNull();
    await q(`update public.orders set status = 'cancelled' where id = $1`, [`${PREFIX}6`]);
    expect(await setOrderItemStatus(`${PREFIX}6`, 0, "ready")).toBeNull();
  });

  it("a manual 'ödendi' turns a late card payment into a flagged duplicate", async () => {
    await insertOrder(`${PREFIX}7`, 994007, { status: "pending_payment", totalMinor: 5000 });
    const store = await import("@/lib/admin/store");
    const marked = await store.markOrderPaidManually(`${PREFIX}7`, "nakit", "panel@laffogato.net");
    expect(marked).toMatchObject({ ok: true, order: { status: "paid" } });
    const [row] = await q<{ provider: string; amountMinor: number }>(
      `select provider, "amountMinor" from public.payment_transactions where "orderId" = $1`,
      [`${PREFIX}7`],
    );
    expect(row).toEqual({ provider: "manual:nakit", amountMinor: 5000 });
    // A refund has no card to go back to.
    expect(await store.getOrderPaymentRef(`${PREFIX}7`)).toBeNull();
    const order = await store.getOrder(`${PREFIX}7`);
    expect(await store.orderMoney(order!)).toEqual({
      collected: true,
      collectedMinor: 5000,
      destination: "none",
    });
    // The customer was still on the bank's page and paid by card as well.
    const late = await store.applyPaymentSucceeded({
      orderId: `${PREFIX}7`,
      provider: "fakepos",
      providerRef: "LATE-1",
      amountMinor: 5000,
      currency: "TRY",
    });
    expect(late).toEqual({ ok: true, reconcile: "duplicate_payment" });
    const [o] = await q<{ attention: string }>(
      `select attention from public.orders where id = $1`,
      [`${PREFIX}7`],
    );
    expect(o.attention).toBe("duplicate_payment");
    // The card charge is what a refund now goes back through.
    expect(await store.getOrderPaymentRef(`${PREFIX}7`)).toMatchObject({
      provider: "fakepos",
      providerRef: "LATE-1",
    });
  });

  it("the 45-minute sweep leaves a manual unpaid order alone", async () => {
    const old = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    await insertOrder(`${PREFIX}8`, 994008, { status: "pending_payment", source: "manual", createdAt: old });
    await insertOrder(`${PREFIX}9`, 994009, { status: "pending_payment", createdAt: old });
    const { expireStalePendingOrders } = await import("@/lib/admin/store");
    await expireStalePendingOrders();
    const rows = await q<{ id: string; status: string }>(
      `select id, status from public.orders where id in ($1, $2) order by id`,
      [`${PREFIX}8`, `${PREFIX}9`],
    );
    expect(rows).toEqual([
      { id: `${PREFIX}8`, status: "pending_payment" },
      { id: `${PREFIX}9`, status: "cancelled" },
    ]);
  });

  it("searches with % and _ taken literally, and filters on attention", async () => {
    await insertOrder(`${PREFIX}10`, 994010);
    await q(`update public.orders set "customerName" = 'Yüzde 50% Can', attention = 'refund_due' where id = $1`, [`${PREFIX}10`]);
    await insertOrder(`${PREFIX}11`, 994011);
    await q(`update public.orders set "customerName" = 'Yüzde 500 Can' where id = $1`, [`${PREFIX}11`]);
    const { listOrdersFiltered, countOrdersByStatus } = await import("@/lib/admin/store");
    const { parseOrderListParams, withoutStatuses } = await import("@/lib/admin/order-filters");
    const sort = { column: "orderNo" as const, ascending: false };
    const literal = parseOrderListParams({ q: "50%" }).query;
    const found = await listOrdersFiltered({ query: literal, sort, page: 1, pageSize: 50 });
    expect(found.orders.map((o) => o.id)).toEqual([`${PREFIX}10`]);
    expect(found.total).toBe(1);
    const flagged = parseOrderListParams({ q: "Yüzde", dikkat: "1" }).query;
    const att = await listOrdersFiltered({ query: flagged, sort, page: 1, pageSize: 50 });
    expect(att.orders.map((o) => o.id)).toEqual([`${PREFIX}10`]);
    const counts = await countOrdersByStatus(withoutStatuses(parseOrderListParams({ q: "Yüzde" }).query));
    expect(counts.paid).toBe(2);
    const byNo = parseOrderListParams({ q: "#994011" }).query;
    const one = await listOrdersFiltered({ query: byNo, sort, page: 1, pageSize: 50 });
    expect(one.orders.map((o) => o.id)).toEqual([`${PREFIX}11`]);
  });
});
