import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminOrder } from "@/lib/admin/store";

/**
 * "CSV indir" on the order list: the same parser and query as the page,
 * every page of it, Excel-friendly, formula-safe, behind the session and
 * the role (a route handler is not behind requireRole).
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
  });

  beforeEach(() => {
    session.value = null;
    listOrdersFiltered.mockReset();
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
    expect(listOrdersFiltered).toHaveBeenCalledTimes(2);
    expect(listOrdersFiltered.mock.calls[0][0]).toMatchObject({
      page: 1,
      pageSize: 500,
      query: { statuses: ["paid"], search: { pattern: "%eda%" } },
    });
  });
});

