import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dayAnchor } from "@/lib/admin/day-close-core";
import { createDb, type Executor } from "@/lib/db/client";
import { signedHeaders } from "@/lib/panel/karaoke-sync-core";
import {
  buildPanelSales,
  inPanelSalesRange,
  orderKeptKdv,
  PANEL_SALES_MAX_DAYS,
  PANEL_SALES_MAX_ORDERS,
  panelSalesClosed,
  panelSalesReadBounds,
  parsePanelSalesRange,
  type PanelSalesBookingRow,
  type PanelSalesOrderRow,
} from "@/lib/panel/sales-export-core";

/**
 * The online sales a period hands the köşk panel's P&L and till report
 * (src/lib/panel/sales-export-core.ts, src/app/api/panel/sales/route.ts,
 * docs/PANEL-SALES.md). What is pinned: the period and its Istanbul days,
 * the same money Raporlar and Gün sonu count (orders by `createdAt`,
 * refunds per order, karaoke by its payment day), manual orders apart, the
 * invoice's KDV (a reward coupon at full price), the café lines the panel
 * maps to its products, and a route that answers only a signed request and
 * never a short P&L.
 */

const exec: Executor = async () => ({ rows: [], rowCount: 0 });
vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

const mocks = vi.hoisted(() => ({
  orders: vi.fn(),
  bookings: vi.fn(),
  coupons: vi.fn(),
}));
vi.mock("@/lib/admin/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/store")>()),
  listPanelSalesOrderRows: mocks.orders,
  listPanelSalesBookingRows: mocks.bookings,
}));
vi.mock("@/lib/customer/coupons", () => ({
  couponSourcesForOrders: mocks.coupons,
}));

const store = await import("@/lib/admin/store");

const OCTOBER = { from: "2026-10-01", to: "2026-10-31" };
const MID_OCTOBER = new Date("2026-10-20T09:00:00.000Z");

type Item = NonNullable<PanelSalesOrderRow["items"]>[number];
const line = (over: Partial<Item>): Item => ({
  productName: "Latte",
  qty: 1,
  unitPriceMinor: 12_000,
  status: "pending",
  menuItemId: "mnu-0003",
  size: "M",
  taxRatePct: 10,
  ...over,
});

function order(over: Partial<PanelSalesOrderRow>): PanelSalesOrderRow {
  const items = over.items ?? [line({})];
  const subtotal = items.reduce((s, it) => s + it.unitPriceMinor * it.qty, 0);
  const discount = over.discountMinor ?? 0;
  const shipping = over.shippingMinor ?? 0;
  return {
    orderNo: 10_001,
    status: "completed",
    kind: "cafe",
    source: "",
    createdAt: "2026-10-03T10:00:00.000Z",
    subtotalMinor: subtotal,
    discountMinor: discount,
    shippingMinor: shipping,
    totalMinor: subtotal - discount + shipping,
    shippingTaxRatePct: shipping > 0 ? 20 : null,
    promoCode: "",
    refunds: [],
    ...over,
    items,
  };
}

/** October's orders, newest first as the route reads them. */
const ORDERS: PanelSalesOrderRow[] = [
  // Nov 1, 00:30 in Tuzla: November's.
  order({ orderNo: 10_011, createdAt: "2026-10-31T21:30:00.000Z" }),
  // A cancelled line refunded: the rest was made.
  order({
    orderNo: 10_010,
    createdAt: "2026-10-21T10:00:00.000Z",
    items: [
      line({ status: "cancelled" }),
      line({
        productName: "Mocha",
        unitPriceMinor: 16_000,
        menuItemId: "mnu-0005",
        size: "L",
        status: "ready",
      }),
    ],
    refunds: [{ amountMinor: 12_000 }],
  }),
  // A shop parcel with its shipping fee.
  order({
    orderNo: 10_009,
    kind: "shop",
    status: "shipped",
    createdAt: "2026-10-20T10:00:00.000Z",
    items: [
      line({
        productName: "Kahve çekirdeği 250 g",
        unitPriceMinor: 45_000,
        menuItemId: undefined,
        size: undefined,
      }),
    ],
    shippingMinor: 4_900,
  }),
  // Typed into the panel at the counter: on the till already.
  order({
    orderNo: 10_008,
    source: "manual",
    createdAt: "2026-10-19T10:00:00.000Z",
    items: [line({ unitPriceMinor: 30_000 })],
  }),
  // Never counted: not paid, or cancelled.
  order({
    orderNo: 10_007,
    status: "cancelled",
    createdAt: "2026-10-18T09:00:00.000Z",
  }),
  order({
    orderNo: 10_006,
    status: "pending_payment",
    createdAt: "2026-10-18T09:30:00.000Z",
  }),
  // Placed before lines carried a rate.
  order({
    orderNo: 10_005,
    createdAt: "2026-10-18T10:00:00.000Z",
    items: [line({ taxRatePct: undefined })],
  }),
  // A loyalty drink: the coupon pays for the Espresso, its KDV stands.
  order({
    orderNo: 10_004,
    createdAt: "2026-10-15T10:00:00.000Z",
    items: [
      line({}),
      line({
        productName: "Espresso",
        unitPriceMinor: 9_000,
        menuItemId: "mnu-0001",
        size: "single",
      }),
    ],
    discountMinor: 9_000,
    promoCode: "LAF-ODUL1",
  }),
  // Wholly refunded: no money kept, nothing made.
  order({
    orderNo: 10_003,
    status: "refunded",
    createdAt: "2026-10-12T10:00:00.000Z",
    refunds: [{ amountMinor: 12_000 }],
  }),
  // A courier order with a shared promo code and a partial refund.
  order({
    orderNo: 10_002,
    createdAt: "2026-10-10T10:00:00.000Z",
    items: [
      line({
        productName: "Mocha",
        unitPriceMinor: 16_000,
        menuItemId: "mnu-0005",
        size: "L",
      }),
    ],
    discountMinor: 1_000,
    promoCode: "HOSGELDIN",
    shippingMinor: 5_000,
    refunds: [{ amountMinor: 4_000 }],
  }),
  order({
    orderNo: 10_001,
    createdAt: "2026-10-03T10:00:00.000Z",
    items: [
      line({ qty: 2 }),
      line({
        productName: "Cheesecake",
        unitPriceMinor: 15_000,
        menuItemId: "mnu-0020",
        size: "single",
      }),
    ],
  }),
  // Oct 1, 01:30 in Tuzla: October's.
  order({
    orderNo: 10_000,
    createdAt: "2026-09-30T22:30:00.000Z",
    items: [
      line({
        productName: "Americano",
        unitPriceMinor: 10_000,
        menuItemId: "mnu-0002",
        size: "single",
      }),
    ],
  }),
];

const COUPONS = new Map<number, string>([[10_004, "loyalty"]]);

const booking = (
  over: Partial<PanelSalesBookingRow>,
): PanelSalesBookingRow => ({
  paymentStatus: "paid",
  paidMinor: 100_000,
  refundMinor: null,
  refundSettledMinor: null,
  paidAt: "2026-10-05T17:00:00.000Z",
  createdAt: "2026-10-01T10:00:00.000Z",
  taxRatePct: 20,
  ...over,
});

const BOOKINGS: PanelSalesBookingRow[] = [
  booking({}),
  // A late cancel: half went back, half is revenue (P2a).
  booking({
    paymentStatus: "refunded",
    paidMinor: 60_000,
    refundMinor: 30_000,
    paidAt: "2026-10-06T17:00:00.000Z",
  }),
  // Owed back, not gone yet: still the köşk's, said apart.
  booking({
    paymentStatus: "refunding",
    paidMinor: 80_000,
    paidAt: "2026-10-07T17:00:00.000Z",
    taxRatePct: null,
  }),
  // Wholly refunded.
  booking({
    paymentStatus: "refunded",
    paidMinor: 50_000,
    paidAt: "2026-10-08T17:00:00.000Z",
  }),
  // Sep 30, 23:00 in Tuzla: September's.
  booking({ paidMinor: 25_000, paidAt: "2026-09-30T20:00:00.000Z" }),
  // Oct 1, 00:30 in Tuzla: October's.
  booking({ paidMinor: 40_000, paidAt: "2026-09-30T21:30:00.000Z" }),
  // No money reached the POS.
  booking({ paymentStatus: "pending", paidAt: null }),
];

describe("the period", () => {
  it("is a month or two days, both inclusive", () => {
    const p = (q: string) => parsePanelSalesRange(new URLSearchParams(q));
    expect(p("month=2026-10")).toEqual(OCTOBER);
    expect(p("month=2026-02")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(p("month=2028-02")).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
    expect(p("month=2026-12")).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
    expect(p("from=2026-10-22&to=2026-10-22")).toEqual({
      from: "2026-10-22",
      to: "2026-10-22",
    });
    expect(p(`from=2026-10-01&to=2026-10-31`)).toEqual(OCTOBER);
  });

  it("refuses anything else", () => {
    const p = (q: string) => parsePanelSalesRange(new URLSearchParams(q));
    for (const q of [
      "",
      "month=2026-13",
      "month=2026-1",
      "month=1999-01",
      "month=2026-10&from=2026-10-01&to=2026-10-02",
      "from=2026-10-01",
      "to=2026-10-01",
      "from=2026-10-02&to=2026-10-01",
      "from=2026-02-30&to=2026-03-01",
      "from=0050-01-01&to=0050-01-02",
      // 32 days.
      "from=2026-10-01&to=2026-11-01",
    ]) {
      expect(p(q), q).toBeNull();
    }
    expect(PANEL_SALES_MAX_DAYS).toBe(31);
  });

  it("cuts the days at Tuzla's midnight and reads a day of margin", () => {
    expect(inPanelSalesRange("2026-09-30T21:00:00.000Z", OCTOBER)).toBe(true);
    expect(inPanelSalesRange("2026-09-30T20:59:59.999Z", OCTOBER)).toBe(false);
    expect(inPanelSalesRange("2026-10-31T20:59:59.999Z", OCTOBER)).toBe(true);
    expect(inPanelSalesRange("2026-10-31T21:00:00.000Z", OCTOBER)).toBe(false);
    expect(inPanelSalesRange("", OCTOBER)).toBe(false);
    expect(panelSalesReadBounds(OCTOBER)).toEqual({
      since: "2026-09-29T21:00:00.000Z",
      until: "2026-11-01T21:00:00.000Z",
    });
  });

  it("is closed once its last day is over in Tuzla", () => {
    expect(panelSalesClosed(OCTOBER, MID_OCTOBER)).toBe(false);
    expect(
      panelSalesClosed(OCTOBER, new Date("2026-10-31T20:59:00.000Z")),
    ).toBe(false);
    expect(
      panelSalesClosed(OCTOBER, new Date("2026-10-31T21:00:00.000Z")),
    ).toBe(true);
  });
});

describe("buildPanelSales", () => {
  const sales = buildPanelSales({
    range: OCTOBER,
    now: new Date("2026-11-02T09:00:00.000Z"),
    orders: ORDERS,
    bookings: BOOKINGS,
    couponSourceOf: (no) => COUPONS.get(no) ?? null,
  });

  it("counts the café orders, their refunds and their KDV", () => {
    const { lines, ...cafe } = sales.cafe;
    expect(lines).toBeDefined();
    expect(cafe).toEqual({
      // 10010, 10005, 10004, 10003, 10002, 10001, 10000.
      orders: 7,
      grossMinor: 133_000,
      discountMinor: 10_000,
      deliveryMinor: 5_000,
      refundedMinor: 28_000,
      netMinor: 105_000,
      // 1454 + 1909 + 0 + 1758 + 3545 + 909: the loyalty order at full
      // price (21 000), the courier fee at 20 %.
      kdvMinor: 9_575,
      unknownKdvNetMinor: 12_000,
    });
  });

  it("lists the café lines made, by menu item and size", () => {
    expect(sales.cafe.lines).toEqual([
      {
        menuItemId: "mnu-0003",
        size: "M",
        name: "Latte",
        qty: 4,
        listMinor: 48_000,
      },
      {
        menuItemId: "mnu-0005",
        size: "L",
        name: "Mocha",
        qty: 2,
        listMinor: 32_000,
      },
      {
        menuItemId: "mnu-0002",
        size: "single",
        name: "Americano",
        qty: 1,
        listMinor: 10_000,
      },
      {
        menuItemId: "mnu-0020",
        size: "single",
        name: "Cheesecake",
        qty: 1,
        listMinor: 15_000,
      },
      {
        menuItemId: "mnu-0001",
        size: "single",
        name: "Espresso",
        qty: 1,
        listMinor: 9_000,
      },
    ]);
  });

  it("keeps the shop and the manual orders apart", () => {
    expect(sales.shop).toEqual({
      orders: 1,
      grossMinor: 49_900,
      discountMinor: 0,
      deliveryMinor: 4_900,
      refundedMinor: 0,
      netMinor: 49_900,
      // 45 000 at 10 % (4091) and the 4 900 fee at 20 % (817).
      kdvMinor: 4_908,
      unknownKdvNetMinor: 0,
    });
    expect(sales.manual).toEqual({
      orders: 1,
      grossMinor: 30_000,
      netMinor: 30_000,
    });
  });

  it("counts karaoke on the day it was paid, as Raporlar does", () => {
    expect(sales.karaoke).toEqual({
      bookings: 4,
      collectedMinor: 330_000,
      refundedMinor: 80_000,
      netMinor: 250_000,
      refundPendingMinor: 80_000,
      // 100 000 → 16 667, 30 000 → 5 000, 40 000 → 6 667; the refunding
      // booking has no stored rate.
      kdvMinor: 28_334,
      unknownKdvNetMinor: 80_000,
    });
  });

  it("names the period and says it is over", () => {
    expect(sales).toMatchObject({
      version: 1,
      from: "2026-10-01",
      to: "2026-10-31",
      closed: true,
    });
  });

  it("carries no customer and no order number", () => {
    expect(JSON.stringify(sales)).not.toMatch(/orderNo|customer|email|phone/i);
    expect(Object.keys(sales.cafe.lines[0]).sort()).toEqual([
      "listMinor",
      "menuItemId",
      "name",
      "qty",
      "size",
    ]);
  });
});

describe("the same money as Raporlar and Gün sonu", () => {
  type ReportOrder = Parameters<typeof store.headlineFrom>[0][number];

  it("for a month: the orders' net and the karaoke net", () => {
    const anchor = new Date("2026-10-15T09:00:00.000Z");
    const inMonth = store.reportPeriodFilter("month", 1, anchor);
    const counted = ORDERS.filter((o) => inMonth(o.createdAt));
    const headline = store.headlineFrom(counted as unknown as ReportOrder[]);
    const sales = buildPanelSales({
      range: OCTOBER,
      now: anchor,
      orders: ORDERS,
      bookings: BOOKINGS,
      couponSourceOf: () => null,
    });
    expect(
      sales.cafe.netMinor + sales.shop.netMinor + sales.manual.netMinor,
    ).toBe(headline.netRevenueMinor);
    expect(
      sales.cafe.grossMinor + sales.shop.grossMinor + sales.manual.grossMinor,
    ).toBe(headline.grossRevenueMinor);
    expect(sales.cafe.orders + sales.shop.orders + sales.manual.orders).toBe(
      headline.totalOrders,
    );
    const k = store.karaokeRevenueFrom(BOOKINGS, "month", 1, anchor);
    expect(sales.karaoke.netMinor).toBe(k.periodNetMinor);
    expect(sales.karaoke.bookings).toBe(k.periodCount);
  });

  it("for a day: what the Gün sonu sheet of that day says", () => {
    const day = "2026-10-01";
    const anchor = dayAnchor(day);
    const inDay = store.reportPeriodFilter("day", 1, anchor);
    const headline = store.headlineFrom(
      ORDERS.filter((o) => inDay(o.createdAt)) as unknown as ReportOrder[],
    );
    const sales = buildPanelSales({
      range: { from: day, to: day },
      now: anchor,
      orders: ORDERS,
      bookings: BOOKINGS,
      couponSourceOf: () => null,
    });
    expect(headline.netRevenueMinor).toBe(10_000);
    expect(
      sales.cafe.netMinor + sales.shop.netMinor + sales.manual.netMinor,
    ).toBe(headline.netRevenueMinor);
    expect(sales.karaoke.netMinor).toBe(
      store.karaokeRevenueFrom(BOOKINGS, "day", 1, anchor).periodNetMinor,
    );
    expect(sales.karaoke.netMinor).toBe(40_000);
    expect(sales.closed).toBe(false);
  });
});

describe("orderKeptKdv", () => {
  it("shares the KDV over what a refund left, and keeps a reward's at full price", () => {
    const courier = ORDERS.find((o) => o.orderNo === 10_002)!;
    // 2197 on 20 000, 16 000 kept.
    expect(orderKeptKdv(courier, 16_000, null)).toBe(1_758);
    const loyalty = ORDERS.find((o) => o.orderNo === 10_004)!;
    expect(orderKeptKdv(loyalty, 12_000, "loyalty")).toBe(1_909);
    // The same order with a shared code: the discount comes off the base.
    expect(orderKeptKdv(loyalty, 12_000, null)).toBe(1_091);
    // A coupon that paid for everything: no money, the invoice's KDV.
    const free = order({ discountMinor: 12_000, promoCode: "LAF-HEDIYE" });
    expect(free.totalMinor).toBe(0);
    expect(orderKeptKdv(free, 0, "gift")).toBe(1_091);
    // No stored rate: not known, never guessed.
    expect(
      orderKeptKdv(
        ORDERS.find((o) => o.orderNo === 10_005)!,
        12_000,
        null,
      ),
    ).toBeNull();
  });
});

// ─── The route ─────────────────────────────────────────────────────────────

const SECRET = "test-secret-0123456789-abcdefghijklmnop";

function signedGet(path: string, secret = SECRET): Request {
  const url = new URL(path, "https://laffogato.net");
  return new Request(url, {
    headers: signedHeaders(secret, "GET", url, "", Date.now()),
  });
}

describe("GET /api/panel/sales", () => {
  beforeEach(() => {
    vi.stubEnv("KARAOKE_SYNC_SECRET", SECRET);
    mocks.orders.mockReset().mockResolvedValue(ORDERS);
    mocks.bookings.mockReset().mockResolvedValue(BOOKINGS);
    mocks.coupons.mockReset().mockResolvedValue(COUPONS);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function get(req: Request) {
    const { GET } = await import("@/app/api/panel/sales/route");
    return GET(req);
  }

  it("is off while the link is not configured", async () => {
    vi.stubEnv("KARAOKE_SYNC_SECRET", "");
    expect(
      (await get(signedGet("/api/panel/sales?month=2026-10"))).status,
    ).toBe(503);
    expect(mocks.orders).not.toHaveBeenCalled();
  });

  it("answers nothing unsigned, and a 400 to a period it cannot read", async () => {
    const plain = await get(
      new Request("https://laffogato.net/api/panel/sales?month=2026-10"),
    );
    expect(plain.status).toBe(401);
    // The query is signed: another month than the one signed is refused.
    const url = new URL("https://laffogato.net/api/panel/sales?month=2026-10");
    const headers = signedHeaders(SECRET, "GET", url, "", Date.now());
    const swapped = await get(
      new Request("https://laffogato.net/api/panel/sales?month=2026-09", {
        headers,
      }),
    );
    expect(swapped.status).toBe(401);
    const bad = await get(signedGet("/api/panel/sales?month=2026-13"));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "invalid_range" });
    expect(mocks.orders).not.toHaveBeenCalled();
  });

  it("answers the month, read with its margin, uncached", async () => {
    const res = await get(signedGet("/api/panel/sales?month=2026-10"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body).toMatchObject({
      version: 1,
      from: "2026-10-01",
      to: "2026-10-31",
      cafe: { netMinor: 105_000, kdvMinor: 9_575 },
      karaoke: { netMinor: 250_000 },
    });
    expect(typeof body.now).toBe("string");
    expect(mocks.orders).toHaveBeenCalledWith(
      "2026-09-29T21:00:00.000Z",
      "2026-11-01T21:00:00.000Z",
      PANEL_SALES_MAX_ORDERS + 1,
    );
    expect(mocks.coupons).toHaveBeenCalledWith(ORDERS);
  });

  it("refuses a period it would answer short", async () => {
    mocks.orders.mockResolvedValue(
      Array.from({ length: PANEL_SALES_MAX_ORDERS + 1 }, () => ORDERS[0]),
    );
    const res = await get(signedGet("/api/panel/sales?month=2026-10"));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "range_too_large" });
  });

  it("says the database is down rather than a month of zeros", async () => {
    mocks.coupons.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await get(signedGet("/api/panel/sales?month=2026-10"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });
});
