import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * Raporlar and Müşteriler count money the same way.
 *
 * - Müşteriler summed every order into lifetime value, abandoned checkouts
 *   (`pending_payment`) and cancelled orders included, so it disagreed with
 *   Raporlar, which skips both.
 * - Raporlar said "Net ciro" over a gross figure, with a refund line that
 *   also counted the refunds of orders the gross never counted.
 * - Prepaid karaoke money was in no figure: the reports read only `orders`.
 * - An unknown `?g=` drew the daily chart with no tab marked.
 */

const seen: { text: string; params: readonly unknown[] }[] = [];
let karaokeRows: Record<string, unknown>[] = [];
const exec: Executor = async ({ text, params }) => {
  seen.push({ text, params });
  if (/FROM "karaoke_reservations"/.test(text)) {
    return { rows: karaokeRows, rowCount: karaokeRows.length };
  }
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

const store = await import("@/lib/admin/store");
type Order = Parameters<typeof store.summarizeCustomers>[0][number];

function order(over: Partial<Order>): Order {
  return {
    customerEmail: "ayse@ornek.com",
    customerName: "Ayşe",
    customerPhone: "",
    status: "paid",
    totalMinor: 10_000,
    refunds: [],
    createdAt: "2026-10-01T10:00:00.000Z",
    ...over,
  } as Order;
}

const refund = (amountMinor: number) =>
  ({ amountMinor }) as Order["refunds"][number];

beforeEach(() => {
  seen.length = 0;
  karaokeRows = [];
});

describe("customer lifetime value (Müşteriler)", () => {
  it("skips abandoned checkouts and cancelled orders, like Raporlar", () => {
    const [ayse] = store.summarizeCustomers([
      order({ totalMinor: 30_000 }),
      order({
        status: "completed",
        totalMinor: 20_000,
        refunds: [refund(5_000)],
      }),
      order({ status: "pending_payment", totalMinor: 99_000 }),
      order({
        status: "cancelled",
        totalMinor: 50_000,
        refunds: [refund(50_000)],
        createdAt: "2026-10-05T10:00:00.000Z",
      }),
    ]);
    expect(ayse).toMatchObject({
      orderCount: 2,
      lifetimeValueMinor: 50_000,
      refundedMinor: 5_000,
      // The last attempt still dates the contact.
      lastOrderAt: "2026-10-05T10:00:00.000Z",
    });
  });

  it("keeps someone who only abandoned a checkout, at 0 orders", () => {
    const [only] = store.summarizeCustomers([
      order({ customerEmail: "Can@Ornek.com", status: "pending_payment" }),
    ]);
    expect(only).toMatchObject({
      email: "can@ornek.com",
      orderCount: 0,
      lifetimeValueMinor: 0,
    });
  });

  it("the customer page reads the same rule", () => {
    expect(
      store.customerLifetime([
        order({ totalMinor: 30_000 }),
        order({
          status: "refunded",
          totalMinor: 10_000,
          refunds: [refund(10_000)],
        }),
        order({ status: "pending_payment", totalMinor: 99_000 }),
        order({ status: "cancelled", totalMinor: 40_000 }),
      ]),
    ).toEqual({
      orderCount: 2,
      lifetimeValueMinor: 40_000,
      refundedMinor: 10_000,
    });
  });
});

describe("report headline (Raporlar)", () => {
  it("gross is gross, net is gross minus the counted orders' refunds", () => {
    const head = store.headlineFrom([
      order({ totalMinor: 30_000 }),
      order({
        status: "refunded",
        totalMinor: 20_000,
        refunds: [refund(20_000)],
      }),
      order({
        status: "completed",
        totalMinor: 10_000,
        refunds: [refund(2_500)],
      }),
      // Neither is revenue, and the cancelled order's refund is not either.
      order({ status: "pending_payment", totalMinor: 99_000 }),
      order({
        status: "cancelled",
        totalMinor: 40_000,
        refunds: [refund(40_000)],
      }),
    ]);
    expect(head).toEqual({
      grossRevenueMinor: 60_000,
      netRevenueMinor: 37_500,
      totalOrders: 3,
      averageOrderMinor: 20_000,
      refundedMinor: 22_500,
    });
  });
});

describe("?g= on Raporlar", () => {
  it("falls back to the daily view for anything unknown", () => {
    expect(store.parseGranularity("week")).toBe("week");
    expect(store.parseGranularity("month")).toBe("month");
    expect(store.parseGranularity("year")).toBe("day");
    expect(store.parseGranularity(undefined)).toBe("day");
    expect(store.parseGranularity(["week", "month"])).toBe("day");
  });
});

describe("prepaid karaoke revenue", () => {
  const NOW = new Date("2026-10-17T12:00:00.000Z");
  const row = (paymentStatus: string, paidMinor: number, paidAt: string) => ({
    paymentStatus,
    paidMinor,
    paidAt,
    createdAt: paidAt,
  });

  it("is paid minus refunded; a refund not yet settled still counts", () => {
    const k = store.karaokeRevenueFrom(
      [
        row("paid", 100_000, "2026-10-16T19:00:00.000Z"),
        row("refunding", 50_000, "2026-10-15T19:00:00.000Z"),
        row("refunded", 80_000, "2026-10-14T19:00:00.000Z"),
        // Money that never reached the POS.
        row("pending", 60_000, "2026-10-16T19:00:00.000Z"),
        row("expired", 60_000, "2026-10-16T19:00:00.000Z"),
        row("none", 0, ""),
        // Paid long before the 30 days of the daily view.
        row("paid", 25_000, "2026-08-01T19:00:00.000Z"),
      ],
      "day",
      30,
      NOW,
    );
    expect(k).toEqual({
      collectedMinor: 255_000,
      refundedMinor: 80_000,
      netMinor: 175_000,
      paidCount: 3,
      refundPendingMinor: 50_000,
      periodNetMinor: 150_000,
      periodCount: 2,
    });
  });

  it("a late cancel's share: the part not refunded is revenue (P2a)", () => {
    const paid = row("paid", 200_000, "2026-10-16T19:00:00.000Z");
    const k = store.karaokeRevenueFrom(
      [
        paid,
        // Refunded by hand at the booking's 50 %.
        { ...paid, paymentStatus: "refunded", refundMinor: 100_000 },
        // Refunded in full (no share recorded).
        { ...paid, paymentStatus: "refunded", refundMinor: null },
        // Owed: pending at the share, all of it still in.
        { ...paid, paymentStatus: "refunding", refundMinor: 50_000 },
      ],
      "day",
      30,
      NOW,
    );
    expect(k.collectedMinor).toBe(800_000);
    expect(k.refundedMinor).toBe(300_000);
    expect(k.netMinor).toBe(500_000);
    expect(k.refundPendingMinor).toBe(50_000);
    expect(k.paidCount).toBe(3);
  });

  it("an hour sold again after the share went back: only the rest is pending (resale)", () => {
    const paid = row("paid", 200_000, "2026-10-16T19:00:00.000Z");
    const k = store.karaokeRevenueFrom(
      [
        // 50 % went back by hand; then its two hours were sold again and the
        // rest (100.000) is owed: 100.000 already off, 100.000 pending.
        {
          ...paid,
          paymentStatus: "refunding",
          refundMinor: 200_000,
          refundSettledMinor: 100_000,
        },
        // The same, settled: all of it back.
        {
          ...paid,
          paymentStatus: "refunded",
          refundMinor: 200_000,
          refundSettledMinor: 100_000,
        },
      ],
      "day",
      30,
      NOW,
    );
    expect(k.collectedMinor).toBe(400_000);
    expect(k.refundedMinor).toBe(300_000);
    expect(k.netMinor).toBe(100_000);
    expect(k.refundPendingMinor).toBe(100_000);
    expect(k.paidCount).toBe(1);
  });

  it("books a payment at the köşk's date, not the server's", () => {
    // 01:30 in Tuzla on 1 Sep is 22:30 UTC on 31 Aug: inside a monthly view
    // that starts in September only if read in Istanbul time.
    const k = store.karaokeRevenueFrom(
      [row("paid", 10_000, "2026-08-31T22:30:00.000Z")],
      "month",
      2,
      new Date("2026-10-10T12:00:00.000Z"),
    );
    expect(k.periodNetMinor).toBe(10_000);
  });

  it("reads only the collected rows of karaoke_reservations", async () => {
    karaokeRows = [row("paid", 100_000, "2026-10-16T19:00:00.000Z")];
    const k = await store.karaokeRevenue("day", 30);
    expect(k.netMinor).toBe(100_000);
    const q = seen.find((s) => /FROM "karaoke_reservations"/.test(s.text))!;
    expect(q.text).toMatch(/"paymentStatus" IN/i);
    expect(q.params).toEqual(
      expect.arrayContaining(["paid", "refunding", "refunded"]),
    );
  });
});

describe("the reports page", () => {
  it("labels net and gross, shows karaoke, and marks the daily tab for a bad ?g=", async () => {
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
    vi.doMock("@/lib/admin/store", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/admin/store")>()),
      analyticsHeadline: vi.fn(async () => ({
        grossRevenueMinor: 60_000,
        netRevenueMinor: 37_500,
        totalOrders: 3,
        averageOrderMinor: 20_000,
        refundedMinor: 22_500,
      })),
      revenueBuckets: vi.fn(async () => []),
      topProducts: vi.fn(async () => []),
      karaokeRevenue: vi.fn(async () => ({
        collectedMinor: 255_000,
        refundedMinor: 80_000,
        netMinor: 175_000,
        paidCount: 3,
        refundPendingMinor: 50_000,
        periodNetMinor: 150_000,
        periodCount: 2,
      })),
    }));
    const { default: ReportsPage } = await import("@/app/admin/raporlar/page");
    const html = renderToStaticMarkup(
      await ReportsPage({ searchParams: Promise.resolve({ g: "yil" }) }),
    );
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(text).toMatch(/Net ciro ₺375,00/);
    expect(text).toMatch(/Brüt ciro ₺600,00/);
    expect(text).not.toContain("Toplam ciro");
    // The period's figure first; the all-time one says it is all-time.
    expect(text).toMatch(/Karaoke ön ödemesi Bu dönemde, net ₺1\.500,00/);
    expect(text).toMatch(/Tüm zamanlar: net ₺1\.750,00/);
    expect(text).toContain("sonucu bekleniyor");
    expect(html).toMatch(
      /href="\/admin\/raporlar\?g=day"[^>]*aria-current="page"/,
    );
  });
});
