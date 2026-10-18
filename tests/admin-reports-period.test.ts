import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * Raporlar reads one period (admin audit SYS-16, decision D31).
 *
 * - The tiles and the top list read every order ever placed beside a
 *   "30 gün" switch: the owner compared this month's chart with the café's
 *   whole history.
 * - The top list was sorted by money and drawn by quantity: row 2 had a 6%
 *   bar under a 69% row 1 and a 100% row 3.
 * - Its money was unit price x quantity of every order, fully refunded ones
 *   included, so it never reconciled with the tiles.
 */

const seen: { text: string; params: readonly unknown[] }[] = [];
let orderRows: Record<string, unknown>[] = [];
const exec: Executor = async ({ text, params }) => {
  seen.push({ text, params });
  if (/FROM "orders"/.test(text)) {
    return { rows: orderRows, rowCount: orderRows.length };
  }
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

const store = await import("@/lib/admin/store");
type Order = Parameters<typeof store.topProductsFrom>[0][number];
type Item = Order["items"][number];

// 17 Oct 2026, 15:00 in Tuzla.
const NOW = new Date("2026-10-17T12:00:00.000Z");

const item = (productName: string, qty: number, unitPriceMinor: number) =>
  ({ productName, qty, unitPriceMinor, status: "active" }) as unknown as Item;

function order(over: Partial<Order>): Order {
  return {
    status: "paid",
    createdAt: "2026-10-10T10:00:00.000Z",
    totalMinor: 10_000,
    refunds: [],
    items: [],
    ...over,
  } as Order;
}

const refund = (amountMinor: number) =>
  ({ amountMinor }) as Order["refunds"][number];

beforeEach(() => {
  seen.length = 0;
  orderRows = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the report period", () => {
  it("is the chart's buckets, cut at the köşk's midnight", () => {
    const inPeriod = store.reportPeriodFilter("day", 30, NOW);
    // The first day of 30 ending 17 Oct is 18 Sep. 00:30 on 18 Sep in Tuzla
    // is 21:30 UTC on 17 Sep: in. 23:30 on 17 Sep in Tuzla: out.
    expect(inPeriod("2026-09-17T21:30:00.000Z")).toBe(true);
    expect(inPeriod("2026-09-17T20:30:00.000Z")).toBe(false);
    expect(inPeriod("2026-10-17T11:00:00.000Z")).toBe(true);
    expect(inPeriod("")).toBe(false);
  });

  it("reads from the database a day before the period, never less", () => {
    // Istanbul midnight of 18 Sep is 21:00 UTC on 17 Sep; one day earlier.
    expect(store.reportPeriodSince("day", 30, NOW)).toBe(
      "2026-09-16T21:00:00.000Z",
    );
    // 12 weeks ending in the week of Mon 12 Oct start on Mon 27 Jul.
    expect(store.reportPeriodSince("week", 12, NOW)).toBe(
      "2026-07-25T21:00:00.000Z",
    );
    // 12 months ending in October start on 1 Nov 2025.
    expect(store.reportPeriodSince("month", 12, NOW)).toBe(
      "2025-10-30T21:00:00.000Z",
    );
    for (const g of ["day", "week", "month"] as const) {
      const first = store.bucketRevenue([], g, g === "day" ? 30 : 12, NOW)[0];
      const since = store.reportPeriodSince(g, g === "day" ? 30 : 12, NOW);
      // The read starts before the first bucket's first instant.
      const inPeriod = store.reportPeriodFilter(g, g === "day" ? 30 : 12, NOW);
      expect(inPeriod(since), `${g} ${first.bucket}`).toBe(false);
    }
  });
});

describe("headline tiles", () => {
  it("count only the period, and net equals the chart's total", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    orderRows = [
      order({ totalMinor: 30_000 }),
      order({ totalMinor: 20_000, refunds: [refund(5_000)] }),
      // Before the 30 days: in the old all-time tiles, not in these.
      order({ totalMinor: 99_000, createdAt: "2026-08-01T10:00:00.000Z" }),
    ];
    const head = await store.analyticsHeadline("day", 30);
    expect(head).toEqual({
      grossRevenueMinor: 50_000,
      netRevenueMinor: 45_000,
      totalOrders: 2,
      averageOrderMinor: 25_000,
      refundedMinor: 5_000,
    });
    const buckets = await store.revenueBuckets("day", 30);
    expect(buckets.reduce((s, b) => s + b.revenueMinor, 0)).toBe(
      head.netRevenueMinor,
    );
    expect(buckets.reduce((s, b) => s + b.orderCount, 0)).toBe(
      head.totalOrders,
    );
    const q = seen.find((s) => /FROM "orders"/.test(s.text))!;
    expect(q.text).toMatch(/WHERE "createdAt" >= \$1/);
    expect(q.params[0]).toBe("2026-09-16T21:00:00.000Z");
  });
});

describe("top products", () => {
  it("reads the period and nets refunds per order, in proportion", () => {
    const top = store.topProductsFrom(
      [
        order({
          totalMinor: 40_000,
          items: [item("Fincan", 2, 10_000), item("Kup", 4, 5_000)],
        }),
        // A quarter refunded: every line keeps three quarters.
        order({
          totalMinor: 20_000,
          refunds: [refund(5_000)],
          items: [item("Fincan", 2, 10_000)],
        }),
        // Fully refunded: neither money nor units.
        order({
          status: "refunded",
          totalMinor: 30_000,
          refunds: [refund(30_000)],
          items: [item("Kup", 6, 5_000)],
        }),
        // Outside the period, cancelled, and an unpaid checkout.
        order({
          createdAt: "2026-08-01T10:00:00.000Z",
          items: [item("Kup", 50, 5_000)],
        }),
        order({ status: "cancelled", items: [item("Kup", 50, 5_000)] }),
        order({
          status: "pending_payment",
          items: [item("Kup", 50, 5_000)],
        }),
      ],
      "day",
      30,
      NOW,
    );
    expect(top).toEqual([
      { productName: "Fincan", qty: 4, revenueMinor: 35_000 },
      { productName: "Kup", qty: 4, revenueMinor: 20_000 },
    ]);
  });

  it("takes a refund off the line marked İptal before the standing ones", () => {
    const cancelled = (productName: string, qty: number, unit: number) =>
      ({ ...item(productName, qty, unit), status: "cancelled" }) as Item;
    const top = store.topProductsFrom(
      [
        // The cancelled line's ₺100 went back: the Fincan kept its ₺100.
        order({
          totalMinor: 20_000,
          refunds: [refund(10_000)],
          items: [item("Fincan", 1, 10_000), cancelled("Kup", 2, 5_000)],
        }),
        // ₺50 more than the cancelled line went back: off the Fincan.
        order({
          totalMinor: 20_000,
          refunds: [refund(15_000)],
          items: [item("Fincan", 1, 10_000), cancelled("Kup", 2, 5_000)],
        }),
        // Cancelled but not refunded yet: the Fincan is untouched.
        order({
          totalMinor: 20_000,
          items: [item("Fincan", 1, 10_000), cancelled("Kup", 2, 5_000)],
        }),
      ],
      "day",
      30,
      NOW,
    );
    expect(top).toEqual([
      { productName: "Fincan", qty: 3, revenueMinor: 25_000 },
    ]);
  });

  it("is sorted by its revenue, list price, the promo not taken off", () => {
    const top = store.topProductsFrom(
      [
        order({
          totalMinor: 9_000,
          // A 10% promo: the order total is lower, the lines are not.
          items: [item("Hediye kutusu", 1, 7_000), item("Espresso", 20, 150)],
        }),
      ],
      "day",
      30,
      NOW,
    );
    expect(top.map((t) => [t.productName, t.revenueMinor])).toEqual([
      ["Hediye kutusu", 7_000],
      ["Espresso", 3_000],
    ]);
  });

  it("asks the database for the period's orders only", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    orderRows = [order({ items: [item("Fincan", 1, 10_000)] })];
    expect(await store.topProducts("day", 30)).toEqual([
      { productName: "Fincan", qty: 1, revenueMinor: 10_000 },
    ]);
    const q = seen.find((s) => /FROM "orders"/.test(s.text))!;
    expect(q.params[0]).toBe("2026-09-16T21:00:00.000Z");
  });
});

describe("the reports page", () => {
  async function render(
    top: Array<{ productName: string; qty: number; revenueMinor: number }>,
  ) {
    vi.resetModules();
    vi.doMock("next/link", () => ({
      default: ({
        href,
        children,
        ...rest
      }: {
        href: string;
        children?: ReactNode;
      }) => createElement("a", { href, ...rest }, children),
      useLinkStatus: () => ({ pending: false }),
    }));
    vi.doMock("@/lib/admin/auth", () => ({
      requireRole: vi.fn(async () => ({})),
    }));
    const calls: Record<string, unknown[]> = {};
    vi.doMock("@/lib/admin/store", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/admin/store")>()),
      analyticsHeadline: vi.fn(async (...args: unknown[]) => {
        calls.headline = args;
        return {
          grossRevenueMinor: 0,
          netRevenueMinor: 0,
          totalOrders: 0,
          averageOrderMinor: 0,
          refundedMinor: 0,
        };
      }),
      revenueBuckets: vi.fn(async () => []),
      topProducts: vi.fn(async (...args: unknown[]) => {
        calls.top = args;
        return top;
      }),
      karaokeRevenue: vi.fn(async () => ({
        collectedMinor: 0,
        refundedMinor: 0,
        netMinor: 0,
        paidCount: 0,
        refundPendingMinor: 0,
        periodNetMinor: 0,
        periodCount: 0,
      })),
    }));
    const { default: ReportsPage } = await import("@/app/admin/raporlar/page");
    const html = renderToStaticMarkup(
      await ReportsPage({ searchParams: Promise.resolve({ g: "week" }) }),
    );
    return { html, calls };
  }

  it("passes the chosen period to the tiles and the top list", async () => {
    const { calls } = await render([]);
    expect(calls.headline).toEqual(["week", 12]);
    expect(calls.top).toEqual(["week", 12, 5]);
  });

  it("draws each bar by the revenue the list is sorted by, and says it is list price", async () => {
    // The audit's case: row 2 sold few units for a lot of money.
    const { html } = await render([
      { productName: "Çekirdek 1 kg", qty: 70, revenueMinor: 80_000 },
      {
        productName: "Yenilebilir kup 12'li hediye kutusu",
        qty: 6,
        revenueMinor: 52_500,
      },
      { productName: "Espresso", qty: 100, revenueMinor: 20_000 },
    ]);
    const widths = [...html.matchAll(/style="width:(\d+)%"/g)].map((m) =>
      Number(m[1]),
    );
    expect(widths).toEqual([100, 66, 25]);
    expect(html).toContain("liste fiyatıyla");
    expect(html).toContain("iadeler düşülmüş");
  });

  it("has no Dönüşüm card and no promise of one", async () => {
    const { html } = await render([]);
    expect(html).not.toContain("Dönüşüm");
    expect(html).not.toContain("Plausible");
    expect(html).toContain("Bu dönemde satış yok.");
    // The eyebrow names the sidebar's group (SYS-22).
    expect(html).toMatch(/>Satış<\/div>/);
    expect(html).not.toContain("İçgörüler");
  });
});
