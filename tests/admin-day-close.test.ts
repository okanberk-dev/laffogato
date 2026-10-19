import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";
import {
  DAY_CLOSE_ENTRY,
  DAY_CLOSE_PATH,
  dayCloseHref,
  dayCloseLabel,
  inIstanbulDay,
  istanbulDayBounds,
  istanbulToday,
  parseDayCloseDay,
} from "@/lib/admin/day-close-core";
import { breadcrumbTrail } from "@/lib/admin/nav-match";
import {
  ADMIN_ROLES,
  canAccess,
  deniedPathFor,
  type AdminRole,
} from "@/lib/admin/roles";

/**
 * Gün sonu (admin UI v2, UI-18): the day closed on one printable page.
 *
 * - Owner and manager only: it carries the day's revenue (`reports`).
 * - The day is the köşk's: at 00:30 in Tuzla (21:30 UTC) the sheet is the
 *   new day's, not the server's UTC yesterday (CLAUDE.md rule 22).
 * - Its money is Raporlar's: the same day reads the same figures from the
 *   report functions, never a second count.
 * - On paper only the sheet prints (`[data-print-receipt]`), and it names
 *   no customer.
 */

interface Rows {
  orders: Record<string, unknown>[];
  refunded: Record<string, unknown>[];
  bookings: Record<string, unknown>[];
  karaokeMoney: Record<string, unknown>[];
  stamps: Record<string, unknown>[];
  stockMoves: Record<string, unknown>[];
}

const seen: { text: string; params: readonly unknown[] }[] = [];
let data: Rows;
const exec: Executor = async ({ text, params }) => {
  seen.push({ text, params });
  const answer = (rows: Record<string, unknown>[]) => ({
    rows,
    rowCount: rows.length,
  });
  if (/FROM "orders"/.test(text)) {
    return answer(/"refunds" <>/.test(text) ? data.refunded : data.orders);
  }
  if (/FROM "karaoke_reservations"/.test(text)) {
    return answer(/"date" =/.test(text) ? data.bookings : data.karaokeMoney);
  }
  if (/FROM "loyalty_stamps"/.test(text)) return answer(data.stamps);
  if (/FROM "stock_moves"/.test(text)) return answer(data.stockMoves);
  return answer([]);
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

const store = await import("@/lib/admin/store");
type DayCloseRows = import("@/lib/admin/store").DayCloseRows;
const dayClose = await import("@/lib/admin/day-close");

/** 00:30 on Monday 19 Oct 2026 in Tuzla. */
const AT_0030 = new Date("2026-10-18T21:30:00.000Z");
/** 22:30 the same day in Tuzla. */
const AT_2230 = new Date("2026-10-19T19:30:00.000Z");
const DAY = "2026-10-19";

const refund = (
  amountMinor: number,
  createdAt: string,
  destination?: string,
) => ({
  id: `rf-${createdAt}`,
  amountMinor,
  reason: "",
  createdAt,
  destination,
});

function order(over: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "ord-x",
    orderNo: 10000,
    status: "paid",
    createdAt: "2026-10-19T08:00:00.000Z",
    totalMinor: 10_000,
    refunds: [],
    channel: "web",
    kind: "shop",
    source: "",
    ...over,
  };
}

function emptyRows(): Rows {
  return {
    orders: [],
    refunded: [],
    bookings: [],
    karaokeMoney: [],
    stamps: [],
    stockMoves: [],
  };
}

/** A day of everything, with rows the day must leave out. */
function busyDay(): Rows {
  const orders = [
    // 23:59 on 18 Oct in Tuzla: the day before.
    order({
      id: "ord-1",
      orderNo: 10001,
      createdAt: "2026-10-18T20:59:00.000Z",
      totalMinor: 99_000,
    }),
    // 00:00 on 19 Oct in Tuzla: the day's first instant.
    order({
      id: "ord-2",
      orderNo: 10002,
      createdAt: "2026-10-18T21:00:00.000Z",
      totalMinor: 30_000,
    }),
    order({
      id: "ord-3",
      orderNo: 10003,
      channel: "app",
      kind: "cafe",
      totalMinor: 20_000,
      refunds: [refund(5_000, "2026-10-19T10:00:00.000Z", "card")],
    }),
    order({
      id: "ord-4",
      orderNo: 10004,
      source: "manual",
      totalMinor: 7_500,
      status: "completed",
    }),
    // Placed, not money: neither counts as revenue.
    order({
      id: "ord-5",
      orderNo: 10005,
      channel: "app",
      status: "pending_payment",
      totalMinor: 4_000,
    }),
    order({
      id: "ord-6",
      orderNo: 10006,
      status: "cancelled",
      totalMinor: 6_000,
    }),
    // 00:00 on 20 Oct in Tuzla: the next day.
    order({
      id: "ord-7",
      orderNo: 10007,
      createdAt: "2026-10-19T21:00:00.000Z",
      totalMinor: 55_000,
    }),
  ];
  return {
    orders,
    refunded: [
      orders[2],
      // Placed on the 18th, refunded on the 19th by hand (cash).
      {
        id: "ord-1",
        orderNo: 10001,
        refunds: [
          refund(2_500, "2026-10-18T12:00:00.000Z", "card"),
          refund(1_000, "2026-10-19T15:30:00.000Z", "none"),
        ],
      },
    ],
    bookings: [
      {
        id: "krk-00001",
        date: DAY,
        startHour: 18,
        hours: 2,
        status: "confirmed",
        paymentStatus: "paid",
        updatedAt: "2026-10-19T09:00:00.000Z",
      },
      {
        id: "krk-00002",
        date: DAY,
        startHour: 22,
        hours: 2,
        status: "confirmed",
        paymentStatus: "paid",
        updatedAt: "2026-10-19T09:00:00.000Z",
      },
      {
        id: "krk-00003",
        date: DAY,
        startHour: 23,
        hours: 1,
        status: "requested",
        paymentStatus: "none",
        updatedAt: "2026-10-19T09:00:00.000Z",
      },
      // Pay at the venue, written off after its 19:00-20:00 hour (D7).
      {
        id: "krk-00004",
        date: DAY,
        startHour: 19,
        hours: 1,
        status: "cancelled",
        paymentStatus: "none",
        updatedAt: "2026-10-19T17:30:00.000Z",
      },
      // Cancelled in the afternoon, before its evening.
      {
        id: "krk-00005",
        date: DAY,
        startHour: 21,
        hours: 1,
        status: "cancelled",
        paymentStatus: "none",
        updatedAt: "2026-10-19T12:00:00.000Z",
      },
      {
        id: "krk-00006",
        date: DAY,
        startHour: 20,
        hours: 1,
        status: "cancelled",
        paymentStatus: "expired",
        updatedAt: "2026-10-19T12:00:00.000Z",
      },
      {
        id: "krk-00007",
        date: "2026-10-20",
        startHour: 20,
        hours: 1,
        status: "confirmed",
        paymentStatus: "paid",
        updatedAt: "2026-10-19T09:00:00.000Z",
      },
    ],
    karaokeMoney: [
      {
        id: "krk-00001",
        paymentStatus: "paid",
        paidMinor: 80_000,
        refundMinor: null,
        paidAt: "2026-10-19T09:00:00.000Z",
        createdAt: "2026-10-19T08:55:00.000Z",
        refundedAt: null,
      },
      // Paid the day before, half refunded on the day (a late share).
      {
        id: "krk-00010",
        paymentStatus: "refunded",
        paidMinor: 60_000,
        refundMinor: 30_000,
        paidAt: "2026-10-18T10:00:00.000Z",
        createdAt: "2026-10-18T09:55:00.000Z",
        refundedAt: "2026-10-19T11:00:00.000Z",
      },
      // Paid and refunded in full on the day.
      {
        id: "krk-00011",
        paymentStatus: "refunded",
        paidMinor: 40_000,
        refundMinor: null,
        paidAt: "2026-10-19T06:00:00.000Z",
        createdAt: "2026-10-19T05:55:00.000Z",
        refundedAt: "2026-10-19T07:00:00.000Z",
      },
    ],
    stamps: [
      {
        kind: "earn",
        delta: 1,
        source: "counter",
        orderId: "",
        createdAt: "2026-10-19T09:00:00.000Z",
      },
      // One go of two stamps: the till writes a row per stamp.
      {
        kind: "earn",
        delta: 1,
        source: "counter",
        orderId: "",
        createdAt: "2026-10-19T10:00:00.000Z",
      },
      {
        kind: "earn",
        delta: 1,
        source: "counter",
        orderId: "",
        createdAt: "2026-10-19T10:00:00.040Z",
      },
      {
        kind: "earn",
        delta: 3,
        source: "order",
        orderId: "ord-3",
        createdAt: "2026-10-19T10:00:00.000Z",
      },
      {
        kind: "reversal",
        delta: -1,
        source: "admin",
        orderId: "",
        createdAt: "2026-10-19T10:05:00.000Z",
      },
      {
        kind: "reversal",
        delta: -1,
        source: "order",
        orderId: "ord-3",
        createdAt: "2026-10-19T11:00:00.000Z",
      },
      {
        kind: "redeem",
        delta: -8,
        source: "app",
        orderId: "",
        createdAt: "2026-10-19T11:30:00.000Z",
      },
    ],
    stockMoves: [
      {
        productId: "prd-0001",
        productName: "Fincan",
        delta: -1,
        stockAfter: 0,
        reason: "order_placed",
        createdAt: "2026-10-19T07:00:00.000Z",
      },
      {
        productId: "prd-0001",
        productName: "Fincan",
        delta: 5,
        stockAfter: 5,
        reason: "manual_adjust",
        createdAt: "2026-10-19T09:00:00.000Z",
      },
      {
        productId: "prd-0002",
        productName: "Çekirdek · 1 kg",
        delta: -2,
        stockAfter: 0,
        reason: "order_placed",
        createdAt: "2026-10-19T11:05:00.000Z",
      },
      {
        productId: "prd-0003",
        productName: "Kup",
        delta: -1,
        stockAfter: 2,
        reason: "order_placed",
        createdAt: "2026-10-19T11:10:00.000Z",
      },
    ],
  };
}

/** busyDay() as the store hands it over. */
const sheetRows = () => busyDay() as unknown as DayCloseRows;

beforeEach(() => {
  seen.length = 0;
  data = emptyRows();
});

afterEach(() => {
  vi.useRealTimers();
  vi.doUnmock("@/lib/admin/auth");
  vi.doUnmock("@/lib/admin/store");
  vi.doUnmock("next/link");
});

describe("the köşk's day (rule 22)", () => {
  it("is the new day at 00:30 in Tuzla, 21:30 UTC", () => {
    expect(istanbulToday(AT_0030)).toBe(DAY);
    expect(istanbulToday(new Date("2026-10-18T20:59:59.999Z"))).toBe(
      "2026-10-18",
    );
    expect(istanbulDayBounds(DAY)).toEqual({
      start: "2026-10-18T21:00:00.000Z",
      end: "2026-10-19T21:00:00.000Z",
    });
    expect(inIstanbulDay("2026-10-18T21:00:00.000Z", DAY)).toBe(true);
    expect(inIstanbulDay("2026-10-18T20:59:59.999Z", DAY)).toBe(false);
    expect(inIstanbulDay("2026-10-19T21:00:00.000Z", DAY)).toBe(false);
    expect(inIstanbulDay("", DAY)).toBe(false);
    expect(dayCloseLabel(DAY)).toBe("19 Ekim 2026 Pazartesi");
  });

  it("opens an earlier day from ?gun=, never a later or a made-up one", () => {
    expect(parseDayCloseDay(undefined, AT_0030)).toBe(DAY);
    expect(parseDayCloseDay("2026-10-18", AT_0030)).toBe("2026-10-18");
    expect(parseDayCloseDay("2026-10-20", AT_0030)).toBe(DAY);
    expect(parseDayCloseDay("2026-02-30", AT_0030)).toBe(DAY);
    expect(parseDayCloseDay("19.10.2026", AT_0030)).toBe(DAY);
    expect(parseDayCloseDay("2025-10-17", AT_0030)).toBe(DAY);
    expect(parseDayCloseDay(["2026-10-18"], AT_0030)).toBe(DAY);
    expect(dayCloseHref(DAY, AT_0030)).toBe(DAY_CLOSE_PATH);
    expect(dayCloseHref("2026-10-18", AT_0030)).toBe(
      `${DAY_CLOSE_PATH}?gun=2026-10-18`,
    );
  });

  it("reads that day's rows and no customer column", async () => {
    await dayClose.loadDayClose(DAY, AT_0030);
    const sql = (re: RegExp) => seen.filter((s) => re.test(s.text));
    const [orders] = sql(/FROM "orders"[\s\S]*"createdAt" >=/);
    // A day's margin each side, as the reports read (reportPeriodSince).
    expect(orders.params).toEqual(
      expect.arrayContaining([
        "2026-10-17T21:00:00.000Z",
        "2026-10-20T21:00:00.000Z",
      ]),
    );
    for (const table of ["loyalty_stamps", "stock_moves"]) {
      const [q] = sql(new RegExp(`FROM "${table}"`));
      expect(q.params, table).toEqual([
        "2026-10-18T21:00:00.000Z",
        "2026-10-19T21:00:00.000Z",
      ]);
    }
    const [bookings] = sql(/FROM "karaoke_reservations"[\s\S]*"date" =/);
    expect(bookings.params).toEqual([DAY]);
    // The sheet's tables (ensureSeed may fill an empty catalogue first).
    const mine = sql(
      /"(orders|karaoke_reservations|loyalty_stamps|stock_moves)"/,
    );
    expect(mine).toHaveLength(6);
    const reads = mine.map((s) => s.text).join("\n");
    expect(reads).not.toMatch(
      /customerName|customerEmail|customerPhone|contactEmail|contactPhone|shippingAddress|SELECT \*/,
    );
    // Read-only: nothing is written to them.
    expect(mine.every((s) => /^SELECT/.test(s.text))).toBe(true);
  });
});

describe("the figures", () => {
  it("are Raporlar's for the same day", async () => {
    data = busyDay();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT_2230);
    const sheet = await dayClose.loadDayClose(DAY, AT_2230);
    const head = await store.analyticsHeadline("day", 1);
    const [bucket] = await store.revenueBuckets("day", 1);
    const karaoke = await store.karaokeRevenue("day", 1);

    expect(sheet.headline).toEqual(head);
    expect(sheet.headline).toEqual({
      grossRevenueMinor: 57_500,
      netRevenueMinor: 52_500,
      totalOrders: 3,
      averageOrderMinor: 19_167,
      refundedMinor: 5_000,
    });
    expect(bucket.revenueMinor).toBe(sheet.headline.netRevenueMinor);
    expect(bucket.orderCount).toBe(sheet.headline.totalOrders);
    expect(sheet.karaoke.netMinor).toBe(karaoke.periodNetMinor);
    expect(sheet.karaoke.paidCount).toBe(karaoke.periodCount);
    // 800 kept on krk-00001; krk-00011 went back in full on its own day.
    expect(sheet.karaoke.netMinor).toBe(80_000);
  });

  it("split the day's orders by channel and status, summing to the tiles", () => {
    const sheet = dayClose.dayCloseSummary(sheetRows(), DAY, AT_2230);
    expect(sheet.placed).toBe(5);
    expect(
      sheet.channels.map((c) => [c.key, c.placed, c.counted, c.netMinor]),
    ).toEqual([
      ["web", 2, 1, 30_000],
      ["app", 2, 1, 15_000],
      ["manual", 1, 1, 7_500],
    ]);
    const sum = (k: "counted" | "netMinor") =>
      sheet.channels.reduce((s, c) => s + c[k], 0);
    expect(sum("netMinor")).toBe(sheet.headline.netRevenueMinor);
    expect(sum("counted")).toBe(sheet.headline.totalOrders);
    expect(sheet.statuses).toEqual([
      { status: "pending_payment", label: "Ödeme bekleniyor", count: 1 },
      { status: "paid", label: "Ödendi", count: 2 },
      { status: "completed", label: "Tamamlandı", count: 1 },
      { status: "cancelled", label: "İptal edildi", count: 1 },
    ]);
    expect(sheet.channels[2].href).toBe(
      "/admin/siparisler?kanal=manuel&bas=2026-10-19&bit=2026-10-19",
    );
  });

  it("list the refunds made that day, whatever day the order was placed", () => {
    const sheet = dayClose.dayCloseSummary(sheetRows(), DAY, AT_2230);
    expect(
      sheet.refunds.map((r) => [r.time, r.label, r.destination, r.amountMinor]),
    ).toEqual([
      ["10:00", "KRK-00011", "Kart", 40_000],
      ["13:00", "#10003", "Kart", 5_000],
      ["14:00", "KRK-00010", "Kart", 30_000],
      ["18:30", "#10001", "Kayıt: para hareket etmez", 1_000],
    ]);
    expect(sheet.refundTotalMinor).toBe(76_000);
    expect(sheet.refunds[1].href).toBe("/admin/siparisler/ord-3");
    expect(sheet.refunds[0].href).toBe("/admin/mobil/karaoke/krk-00011");
  });

  it("tell the evening's karaoke: done, to come, did not come (D7)", () => {
    const sheet = dayClose.dayCloseSummary(sheetRows(), DAY, AT_2230);
    expect(sheet.karaoke).toMatchObject({
      done: 1,
      doneHours: 2,
      upcoming: 1,
      requested: 1,
      noShow: 1,
      cancelled: 1,
      unpaid: 1,
    });
    // Read the next morning, the 22:00 booking is over too.
    const later = dayClose.dayCloseSummary(
      sheetRows(),
      DAY,
      new Date("2026-10-20T06:00:00.000Z"),
    );
    expect(later.isToday).toBe(false);
    expect(later.karaoke).toMatchObject({ done: 2, doneHours: 4, upcoming: 0 });
  });

  it("count the till's stamps and its corrections, not order stamps", () => {
    const sheet = dayClose.dayCloseSummary(sheetRows(), DAY, AT_2230);
    expect(sheet.stamps).toEqual({ given: 3, corrected: 1 });
  });

  it("give no count of till visits: a row is a stamp, not a go", () => {
    // The till gives N stamps as N calls of addCounterStamp, each a row of
    // delta 1, so counting rows only repeats "Verilen damga" (it read
    // "İşlem 3" for one customer's three stamps).
    const loyalty = readFileSync("src/lib/mobile/loyalty.ts", "utf8");
    const writer = loyalty.slice(
      loyalty.indexOf("export async function addCounterStamp"),
    );
    expect(writer.slice(0, writer.indexOf("insert(row)"))).toMatch(
      /kind: "earn",\s+delta: 1,\s+source: "counter"/,
    );
    expect(readFileSync("src/lib/mobile/counter.ts", "utf8")).toMatch(
      /for \(let i = 0; i < stamps; i \+= 1\) \{\s+await addCounterStamp\(/,
    );
    const rows = sheetRows();
    rows.stamps = [0, 1, 2].map((i) => ({
      kind: "earn",
      delta: 1,
      source: "counter",
      orderId: "",
      createdAt: `2026-10-19T09:00:00.00${i}Z`,
    }));
    const sheet = dayClose.dayCloseSummary(rows, DAY, AT_2230);
    expect(sheet.stamps).toEqual({ given: 3, corrected: 0 });
    expect(Object.keys(sheet.stamps)).toEqual(["given", "corrected"]);
  });

  it("name what went out of stock and whether it is still out", () => {
    const sheet = dayClose.dayCloseSummary(sheetRows(), DAY, AT_2230);
    expect(sheet.soldOut.map((s) => [s.name, s.time, s.stillOut])).toEqual([
      ["Fincan", "10:00", false],
      ["Çekirdek · 1 kg", "14:05", true],
    ]);
  });
});

describe("who opens it", () => {
  it("is owner and manager, as Raporlar; never staff or the cashier", () => {
    const open = ADMIN_ROLES.filter((r) => canAccess("reports", r));
    expect(open).toEqual(["owner", "manager"]);
    expect(DAY_CLOSE_ENTRY).toMatchObject({
      href: DAY_CLOSE_PATH,
      label: "Gün sonu",
      section: "reports",
    });
    expect(DAY_CLOSE_ENTRY.keywords.join(" ")).not.toMatch(/z rapor/i);
  });

  async function render(role: AdminRole, sp: Record<string, string> = {}) {
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
    // requireRole's contract (lib/admin/auth.ts): a role without the
    // section is redirected to its own landing page with ?denied=1.
    const requireRole = vi.fn(async (section: string) => {
      if (!canAccess(section as "reports", role)) {
        throw new Error(`NEXT_REDIRECT ${deniedPathFor(role)}`);
      }
      return { email: "info@laffogato.net", role, expiresAt: 0 };
    });
    vi.doMock("@/lib/admin/auth", () => ({ requireRole }));
    const { default: Page } =
      await import("@/app/admin/raporlar/gun-sonu/page");
    const out = Page({ searchParams: Promise.resolve(sp) });
    return { out, requireRole };
  }

  it("sends staff and the cashier back before anything is read", async () => {
    for (const role of ["staff", "cashier"] as const) {
      seen.length = 0;
      const { out, requireRole } = await render(role);
      await expect(out).rejects.toThrow(`NEXT_REDIRECT ${deniedPathFor(role)}`);
      expect(requireRole).toHaveBeenCalledWith("reports");
      expect(seen, role).toEqual([]);
    }
  });

  it("asks for the role first, in the page itself", () => {
    const src = readFileSync(
      "src/app/admin/raporlar/gun-sonu/page.tsx",
      "utf8",
    );
    const body = src.slice(src.indexOf("export default async function"));
    expect(body.indexOf('await requireRole("reports")')).toBeGreaterThan(0);
    expect(body.indexOf('await requireRole("reports")')).toBeLessThan(
      body.indexOf("await searchParams"),
    );
  });

  it("prints only the sheet, with its own heading and no customer", async () => {
    data = busyDay();
    data.orders = data.orders.map((o) => ({
      ...o,
      customerName: "Ayşe Yılmaz",
      customerEmail: "ayse@ornek.com",
    }));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT_2230);
    const { out } = await render("manager");
    const html = renderToStaticMarkup(await out);
    const start = html.indexOf("<article data-print-receipt=");
    expect(start).toBeGreaterThan(0);
    const sheet = html.slice(start, html.indexOf("</article>", start));
    // Outside the sheet: the page's header, its print button and the day
    // links (hidden on paper by the print rule).
    expect(html.slice(0, start)).toContain(">Yazdır</button>");
    expect(sheet).not.toContain("Yazdır</button>");
    expect(html.slice(0, start)).toContain('aria-label="Gün"');
    expect(sheet).toContain(
      '<header class="hidden print:block"><h2 class="text-lg font-semibold">Gün sonu · 19 Ekim 2026 Pazartesi</h2>',
    );
    for (const title of [
      "Siparişler",
      "İadeler",
      "Karaoke",
      "Kasa damgaları",
      "Stokta biten",
    ]) {
      expect(sheet).toContain(`>${title}</h2>`);
    }
    expect(sheet).toContain(
      "Bu sayfa iç kullanım içindir, mali belge değildir.",
    );
    expect(sheet).toContain("break-inside-avoid");
    expect(sheet).toContain(">Verilen damga</dt>");
    expect(sheet).not.toContain(">İşlem</dt>");
    expect(html).not.toMatch(/Ayşe|ayse@ornek\.com/);
    // Today: no "Bugün" or "Sonraki gün" link, only the day before.
    expect(html).toContain(`href="${DAY_CLOSE_PATH}?gun=2026-10-18"`);
    expect(html).not.toContain(">Sonraki gün</a>");
  });

  it("walks back and forth from an earlier day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT_2230);
    const { out } = await render("owner", { gun: "2026-10-17" });
    const html = renderToStaticMarkup(await out);
    expect(html).toContain("17 Ekim 2026 Cumartesi");
    expect(html).toContain(`href="${DAY_CLOSE_PATH}?gun=2026-10-16"`);
    expect(html).toContain(`href="${DAY_CLOSE_PATH}?gun=2026-10-18"`);
    expect(html).toContain(`href="${DAY_CLOSE_PATH}"`);
  });
});

describe("the way there", () => {
  it("is a Gün sonu button in the Raporlar header", async () => {
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
    const { default: ReportsPage } = await import("@/app/admin/raporlar/page");
    const html = renderToStaticMarkup(
      await ReportsPage({ searchParams: Promise.resolve({}) }),
    );
    const header = html.slice(0, html.indexOf("</header>"));
    expect(header).toMatch(
      new RegExp(`<a href="${DAY_CLOSE_PATH}" class="[^"]*">Gün sonu</a>`),
    );
  });

  it("names the page in the breadcrumbs", () => {
    const trail = breadcrumbTrail(DAY_CLOSE_PATH, [
      { href: "/admin/raporlar", label: "Raporlar" },
    ]);
    expect(trail).toEqual([
      { label: "Raporlar", href: "/admin/raporlar" },
      { label: "Gün sonu", href: null },
    ]);
  });
});
