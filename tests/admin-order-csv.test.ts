import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";

/**
 * "CSV indir" on the order list: the same parser and query as the page,
 * every page of it, Excel-friendly, formula-safe, behind the session and
 * the role (a route handler is not behind requireRole). Every file that
 * leaves writes an `export` row to Olay kaydı (admin audit ORD-15).
 */

const session = vi.hoisted(() => ({ value: null as null | { email: string; role: string } }));
vi.mock("@/lib/admin/auth", () => ({
  getAdminSession: vi.fn(async () => session.value),
}));
const listOrdersFiltered = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/store", () => ({
  listOrdersFiltered,
  listOrderMoney: vi.fn(async () => new Map()),
}));
// The redeemed member coupon behind each order (ASK-COUPON, 18 Eki 2026).
const couponSourcesForOrders = vi.hoisted(() =>
  vi.fn(async (_orders: unknown) => new Map<number, string>()),
);
vi.mock("@/lib/customer/coupons", () => ({ couponSourcesForOrders }));
const safeAudit = vi.hoisted(() => vi.fn(async (_input: unknown) => true));
vi.mock("@/lib/admin/audit", () => ({ safeAudit }));

const { csvCell, ordersCsv, ORDER_CSV_HEADER } = await import("@/lib/admin/order-csv");

function order(over: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "ord-1",
    orderNo: 10023,
    customerName: "Eda",
    customerEmail: "eda@example.com",
    customerPhone: "",
    shippingAddress: "Tuzla",
    internalNote: "",
    status: "paid",
    items: [
      {
        productName: "Latte",
        detail: "Büyük · yulaf sütü · +1 shot",
        qty: 1,
        unitPriceMinor: 15_000,
        status: "pending",
      },
    ],
    subtotalMinor: 15_000,
    discountMinor: 3_000,
    promoCode: "HOSGELDIN",
    shippingMinor: 0,
    totalMinor: 12_000,
    refunds: [],
    createdAt: "2026-10-17T08:00:00.000Z",
    paidAt: "2026-10-17T08:01:00.000Z",
    channel: "app",
    kind: "cafe",
    fulfillment: "pickup",
    legalConsent: {},
    ...over,
  } as AdminOrder;
}

describe("CSV export", () => {
  it("defuses a cell a spreadsheet would run as a formula", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+90 536")).toBe("'+90 536");
    expect(csvCell("Ayşe; Can")).toBe('"Ayşe; Can"');
    expect(csvCell("Eda")).toBe("Eda");
  });

  it("opens in Excel with Turkish letters and one row per order", () => {
    const csv = ordersCsv([order()]);
    expect(csv.startsWith("﻿")).toBe(true);
    const [head, row] = csv.slice(1).split("\r\n");
    expect(head).toBe(ORDER_CSV_HEADER.join(";"));
    expect(row).toContain("10023;2026-10-17 11:00;Ödendi;Ödendi;Uygulama;Kafe;Gel-al;Eda;eda@example.com");
    expect(row).toContain(";150,00;30,00;HOSGELDIN;0,00;120,00;0,00;120,00");
    // A line without a stored rate (before 17 Eki 2026): no KDV is guessed.
    expect(row.endsWith(";120,00;;")).toBe(true);
  });

  it("adds the KDV inside the total, per rate, from each line's own rate", () => {
    const csv = ordersCsv([
      order({
        kind: "shop",
        fulfillment: "shipping",
        items: [
          { productName: "Sirena", qty: 1, unitPriceMinor: 32_000, status: "pending", taxRatePct: 10 },
          { productName: "Moka", qty: 1, unitPriceMinor: 120_000, status: "pending", taxRatePct: 20 },
        ],
        subtotalMinor: 152_000,
        discountMinor: 0,
        promoCode: "",
        shippingMinor: 0,
        totalMinor: 152_000,
      }),
    ]);
    const row = csv.slice(1).split("\r\n")[1];
    // 120.000 × 20/120 = 20.000; 32.000 × 10/110 = 2.909,09 → 2.909.
    expect(row.endsWith(";229,09;%20: 200,00 · %10: 29,09")).toBe(true);
  });

  it("puts the shipping fee at its own 20%, not the rate of the beans it carries", () => {
    const csv = ordersCsv([
      order({
        kind: "shop",
        fulfillment: "shipping",
        items: [
          { productName: "Sirena", qty: 1, unitPriceMinor: 32_000, status: "pending", taxRatePct: 10 },
        ],
        subtotalMinor: 32_000,
        discountMinor: 0,
        promoCode: "",
        shippingMinor: 10_000,
        totalMinor: 42_000,
      }),
    ]);
    const row = csv.slice(1).split("\r\n")[1];
    // 100 TL fee × 20/120 = 16,67; 320 TL × 10/110 = 29,09.
    expect(row.endsWith(";45,76;%20: 16,67 · %10: 29,09")).toBe(true);
  });

  it("carries the invoice's split when a reward coupon paid for the goods", () => {
    // A 120 TL stamp-card drink on a 150 TL latte at 10%.
    const reward = order({
      items: [
        { productName: "Latte", qty: 1, unitPriceMinor: 15_000, status: "pending", taxRatePct: 10 },
      ],
      discountMinor: 12_000,
      promoCode: "SD-7K2M9Q",
      totalMinor: 3_000,
    });
    const asReward = ordersCsv([reward], undefined, () => "loyalty")
      .slice(1)
      .split("\r\n")[1];
    // 150 TL × 10/110 = 13,64: the goods at full price.
    expect(asReward.endsWith(";13,64;%10: 13,64")).toBe(true);
    // Read as a plain discount it would be the KDV inside the 30 TL paid.
    const asDiscount = ordersCsv([reward], undefined, () => "welcome")
      .slice(1)
      .split("\r\n")[1];
    expect(asDiscount.endsWith(";2,73;%10: 2,73")).toBe(true);
  });

  beforeEach(() => {
    session.value = null;
    listOrdersFiltered.mockReset();
    couponSourcesForOrders.mockClear();
    safeAudit.mockReset();
    safeAudit.mockResolvedValue(true);
  });

  it("checks the session and the role itself (a route handler is not behind requireRole)", async () => {
    const { GET } = await import("@/app/admin/siparisler/csv/route");
    const req = new Request("https://laffogato.net/admin/siparisler/csv?durum=paid");
    expect((await GET(req)).status).toBe(401);
    session.value = { email: "kasa@laffogato.net", role: "cashier" };
    expect((await GET(req)).status).toBe(403);
    // Staff work the orders on screen; the file is the customer list with
    // every order's money (customers + reports: owner and manager only).
    session.value = { email: "vardiya@laffogato.net", role: "staff" };
    expect((await GET(req)).status).toBe(403);
    expect(listOrdersFiltered).not.toHaveBeenCalled();
    // A refused request exported nothing, so it logs no export.
    expect(safeAudit).not.toHaveBeenCalled();
  });

  it("exports the filtered list, every page of it", async () => {
    session.value = { email: "a@b.c", role: "manager" };
    listOrdersFiltered
      .mockResolvedValueOnce({ orders: Array.from({ length: 500 }, (_, i) => order({ id: `o${i}`, orderNo: i })), total: 501 })
      .mockResolvedValueOnce({ orders: [order({ id: "last", orderNo: 9 })], total: 501 });
    const { GET } = await import("@/app/admin/siparisler/csv/route");
    const res = await GET(new Request("https://laffogato.net/admin/siparisler/csv?durum=paid&q=eda"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="siparisler-\d{4}-\d{2}-\d{2}\.csv"$/);
    const body = await res.text();
    expect(body.trim().split("\r\n")).toHaveLength(502);
    // Every exported order is asked for the coupon it redeemed, once.
    expect(couponSourcesForOrders).toHaveBeenCalledTimes(1);
    expect(couponSourcesForOrders.mock.calls[0][0]).toHaveLength(501);
    expect(listOrdersFiltered).toHaveBeenCalledTimes(2);
    expect(listOrdersFiltered.mock.calls[0][0]).toMatchObject({
      page: 1,
      pageSize: 500,
      query: { statuses: ["paid"], search: { pattern: "%eda%" } },
    });
  });

  it("writes an export row: who, which filters, how many rows (ORD-15)", async () => {
    session.value = { email: "patron@laffogato.net", role: "owner" };
    listOrdersFiltered.mockResolvedValueOnce({
      orders: [order(), order({ id: "ord-2", orderNo: 10024 })],
      total: 2,
    });
    const { GET } = await import("@/app/admin/siparisler/csv/route");
    const res = await GET(
      new Request("https://laffogato.net/admin/siparisler/csv?durum=acik&kanal=web&q=eda"),
    );
    expect(res.status).toBe(200);
    expect(safeAudit).toHaveBeenCalledTimes(1);
    expect(safeAudit).toHaveBeenCalledWith({
      action: "export",
      entity: "order",
      actor: "patron@laffogato.net",
      payload: { filters: { q: "eda", kanal: "web" }, tab: "acik", rows: 2 },
    });
    // The row is a record of the file, not a change to it: header + 2.
    const body = await res.text();
    expect(body.trim().split("\r\n")).toHaveLength(3);
  });

  it("still sends the file when the audit row cannot be written", async () => {
    session.value = { email: "a@b.c", role: "manager" };
    safeAudit.mockResolvedValueOnce(false);
    listOrdersFiltered.mockResolvedValueOnce({ orders: [order()], total: 1 });
    const { GET } = await import("@/app/admin/siparisler/csv/route");
    const res = await GET(new Request("https://laffogato.net/admin/siparisler/csv"));
    expect(res.status).toBe(200);
    expect(safeAudit.mock.calls[0]?.[0]).toMatchObject({
      payload: { filters: {}, rows: 1 },
    });
    expect(safeAudit.mock.calls[0]?.[0]).not.toHaveProperty("payload.tab");
    expect((await res.text()).trim().split("\r\n")).toHaveLength(2);
  });
});

describe("CSV export: the coupon behind each order reaches the KDV columns", () => {
  beforeEach(() => {
    listOrdersFiltered.mockReset();
    couponSourcesForOrders.mockReset();
  });

  it("a reward coupon read for the order makes its row the invoice's split", async () => {
    session.value = { email: "a@b.c", role: "owner" };
    listOrdersFiltered.mockResolvedValueOnce({
      orders: [
        order({
          items: [
            { productName: "Latte", qty: 1, unitPriceMinor: 15_000, status: "pending", taxRatePct: 10 },
          ],
          discountMinor: 12_000,
          promoCode: "SD-7K2M9Q",
          totalMinor: 3_000,
        }),
      ],
      total: 1,
    });
    couponSourcesForOrders.mockResolvedValueOnce(new Map([[10023, "loyalty"]]));
    const { GET } = await import("@/app/admin/siparisler/csv/route");
    const res = await GET(new Request("https://laffogato.net/admin/siparisler/csv"));
    const row = (await res.text()).trim().split("\r\n")[1];
    expect(row.endsWith(";13,64;%10: 13,64")).toBe(true);
  });

  it("a failed coupon read fails the file rather than hide a reward", async () => {
    session.value = { email: "a@b.c", role: "owner" };
    listOrdersFiltered.mockResolvedValueOnce({ orders: [order()], total: 1 });
    couponSourcesForOrders.mockRejectedValueOnce(new Error("db down"));
    const { GET } = await import("@/app/admin/siparisler/csv/route");
    await expect(
      GET(new Request("https://laffogato.net/admin/siparisler/csv")),
    ).rejects.toThrow("db down");
  });
});
