import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Executor } from "@/lib/db/client";
import { toPanelOrder } from "@/lib/panel/orders-feed-core";
import {
  buildPanelSales,
  panelSalesReadBounds,
} from "@/lib/panel/sales-export-core";

import { applyBundledSchema } from "./_support/apply-schema";
import {
  holdSharedDatabase,
  SUITE_LOCK_WAIT_MS,
} from "./_support/db-suite-lock";

/**
 * The köşk panel's two reads against a real Postgres, with the real query
 * layer (docs/PANEL-ORDERS.md, docs/PANEL-SALES.md):
 *
 * - `listPanelOpenOrderRows`: paid, preparing and ready-for-pickup café
 *   orders, never a manual one, a shop parcel or a table order that left
 *   the counter, with the columns `toPanelOrder` reads;
 * - `listPanelSalesOrderRows` / `listPanelSalesBookingRows`: the counted
 *   orders of a period with its margin, and every booking whose money
 *   reached the POS, with the rate it was sold at.
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

const NOW = new Date("2026-10-22T12:00:00.000Z");
const minutesAgo = (m: number) =>
  new Date(NOW.getTime() - m * 60_000).toISOString();

maybe("the köşk panel's order and sales reads in a real Postgres", () => {
  let release: (() => Promise<void>) | undefined;
  let pool: pg.Pool | null = null;
  let store: typeof import("@/lib/admin/store");

  const q = (text: string, params: unknown[] = []) =>
    holder.client!.query(text, params);

  async function insertOrder(
    id: string,
    orderNo: number,
    f: {
      status: string;
      kind?: string;
      source?: string;
      fulfillment?: string;
      paidAt?: string;
      shippedAt?: string;
      createdAt?: string;
      totalMinor?: number;
      refunds?: unknown[];
    },
  ) {
    const items = [
      {
        productName: "Latte",
        qty: 1,
        unitPriceMinor: f.totalMinor ?? 12_000,
        status: "pending",
        menuItemId: "mnu-0003",
        size: "M",
        detail: "M · yulaf",
        options: {
          milk: "oat",
          roast: "intense",
          sugar: 0,
          syrup: "none",
          extraShot: false,
          note: "",
        },
        taxRatePct: 10,
      },
    ];
    await q(
      `insert into public.orders (id, "orderNo", status, kind, source,
         fulfillment, items, refunds, "subtotalMinor", "totalMinor",
         "customerName", "customerEmail", "customerPhone", "shippingAddress",
         "deliveryNote", "createdAt", "paidAt", "shippedAt")
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $9,
         'Ayşe Yılmaz', 'ayse@example.com', '+905551112233', 'Postane Mah.',
         'Kapı kodu 4821', $10, $11, $12)`,
      [
        id,
        orderNo,
        f.status,
        f.kind ?? "cafe",
        f.source ?? "",
        f.fulfillment ?? "pickup",
        JSON.stringify(items),
        JSON.stringify(f.refunds ?? []),
        f.totalMinor ?? 12_000,
        f.createdAt ?? minutesAgo(30),
        f.paidAt ?? minutesAgo(20),
        f.shippedAt ?? "",
      ],
    );
  }

  beforeAll(async () => {
    release = await holdSharedDatabase(URL_!);
    pool = new pg.Pool({ connectionString: URL_, max: 2 });
    await applyBundledSchema(pool);
    holder.client = await pool.connect();
    await q("begin");
    await q("delete from public.orders");
    await q("delete from public.karaoke_reservations");

    await insertOrder("ord-pf-01", 90_001, { status: "paid" });
    await insertOrder("ord-pf-02", 90_002, { status: "preparing" });
    await insertOrder("ord-pf-03", 90_003, {
      status: "shipped",
      shippedAt: minutesAgo(5),
    });
    // Left the counter: done for the bar.
    await insertOrder("ord-pf-04", 90_004, {
      status: "shipped",
      fulfillment: "delivery",
      shippedAt: minutesAgo(5),
    });
    // Typed into the panel; a shop parcel; unpaid; over.
    await insertOrder("ord-pf-05", 90_005, {
      status: "paid",
      source: "manual",
    });
    await insertOrder("ord-pf-06", 90_006, {
      status: "paid",
      kind: "shop",
      fulfillment: "shipping",
    });
    await insertOrder("ord-pf-07", 90_007, {
      status: "pending_payment",
      paidAt: "",
    });
    await insertOrder("ord-pf-08", 90_008, { status: "completed" });
    // Paid long before the screen's window.
    await insertOrder("ord-pf-09", 90_009, {
      status: "paid",
      paidAt: "2026-10-01T10:00:00.000Z",
      createdAt: "2026-10-01T09:55:00.000Z",
    });
    // October's sales, and one from November 1 in Tuzla.
    await insertOrder("ord-pf-10", 90_010, {
      status: "refunded",
      createdAt: "2026-10-05T10:00:00.000Z",
      refunds: [{ amountMinor: 12_000 }],
    });
    await insertOrder("ord-pf-11", 90_011, {
      status: "completed",
      createdAt: "2026-10-31T21:30:00.000Z",
    });

    const booking = (
      id: string,
      date: string,
      status: string,
      paymentStatus: string,
      paidMinor: number,
      paidAt: string,
      taxRatePct: number | null,
    ) =>
      q(
        `insert into public.karaoke_reservations (id, "customerEmail",
           "customerName", date, "startHour", hours, status, "paymentStatus",
           "paidMinor", "paidAt", "taxRatePct", "createdAt", "updatedAt")
         values ($1, $1 || '@example.com', 'Deniz', $2, 20, 2, $3, $4, $5,
           $6, $7, '2026-10-01T09:00:00.000Z', '2026-10-01T09:00:00.000Z')`,
        [id, date, status, paymentStatus, paidMinor, paidAt, taxRatePct],
      );
    await booking(
      "krk-pf-1",
      "2026-10-24",
      "confirmed",
      "paid",
      100_000,
      "2026-10-05T17:00:00.000Z",
      20,
    );
    await booking(
      "krk-pf-2",
      "2026-10-25",
      "cancelled",
      "refunded",
      50_000,
      "2026-10-06T17:00:00.000Z",
      20,
    );
    await booking("krk-pf-3", "2026-10-26", "requested", "pending", 0, "", 20);
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

  it("reads the open café orders the bar screen shows, and no other", async () => {
    const rows = await store.listPanelOpenOrderRows(
      "2026-10-14T12:00:00.000Z",
      50,
    );
    expect(rows.map((r) => r.id).sort()).toEqual([
      "ord-pf-01",
      "ord-pf-02",
      "ord-pf-03",
    ]);
    const shown = rows
      .map((r) => toPanelOrder(r, NOW))
      .filter((o) => o !== null);
    expect(shown.map((o) => [o.id, o.stage, o.firstName])).toEqual([
      ["ord-pf-01", "new", "Ayşe"],
      ["ord-pf-02", "preparing", "Ayşe"],
      ["ord-pf-03", "ready", "Ayşe"],
    ]);
    const text = JSON.stringify(shown);
    for (const leak of [
      "Yılmaz",
      "example.com",
      "5551112233",
      "Postane",
      "4821",
    ]) {
      expect(text).not.toContain(leak);
    }
  });

  it("reads a period's counted orders with its margin, and the paid bookings", async () => {
    const range = { from: "2026-10-01", to: "2026-10-31" };
    const { since, until } = panelSalesReadBounds(range);
    const orders = await store.listPanelSalesOrderRows(since, until, 100);
    // pending_payment is not read; the margin brings Nov 1 in, the period
    // then leaves it out.
    expect(orders.map((o) => o.orderNo)).not.toContain(90_007);
    expect(orders.map((o) => o.orderNo)).toContain(90_011);
    expect(orders[0].orderNo).toBeGreaterThan(
      orders[orders.length - 1].orderNo,
    );
    const bookings = await store.listPanelSalesBookingRows();
    expect(
      bookings.map((b) => [b.paymentStatus, b.paidMinor, b.taxRatePct]).sort(),
    ).toEqual([
      ["paid", 100_000, 20],
      ["refunded", 50_000, 20],
    ]);
    const sales = buildPanelSales({
      range,
      now: NOW,
      orders,
      bookings,
      couponSourceOf: () => null,
    });
    // ord-pf-01..03 and 08 (12 000 each), the refunded 10 (0 kept); the
    // manual 05 apart; the shop 06 in shop; 04 counted too (delivered).
    expect(sales.cafe.orders).toBe(7);
    expect(sales.cafe.netMinor).toBe(6 * 12_000);
    expect(sales.manual).toEqual({
      orders: 1,
      grossMinor: 12_000,
      netMinor: 12_000,
    });
    expect(sales.shop.orders).toBe(1);
    // The options come back from the jsonb: every Latte made was an oat one.
    const latte = sales.cafe.lines.find((l) => l.menuItemId === "mnu-0003");
    expect(latte?.qty).toBe(6);
    expect(latte?.milks).toEqual({ oat: 6 });
    expect(latte).not.toHaveProperty("syrups");
    expect(sales.karaoke).toMatchObject({
      bookings: 1,
      collectedMinor: 150_000,
      netMinor: 100_000,
      kdvMinor: 16_667,
    });
  });
});
