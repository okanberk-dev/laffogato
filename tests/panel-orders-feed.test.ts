import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TAG_ORDERS, tagsForWrite } from "@/lib/cache/tags";
import {
  SIGNATURE_HEADER,
  signedHeaders,
  TIMESTAMP_HEADER,
  verifySignature,
} from "@/lib/panel/karaoke-sync-core";
import {
  PANEL_AWAITING_PAYMENT_WINDOW_MS,
  PANEL_ORDER_FULFILLMENTS,
  PANEL_ORDER_LINE_NOTE_MAX,
  PANEL_ORDER_NOTE_MAX,
  PANEL_ORDER_READY_STALE_MS,
  PANEL_ORDER_STALE_MS,
  PANEL_ORDERS_LOOKBACK_DAYS,
  isBarScreenOrder,
  panelAwaitingPaymentCount,
  panelAwaitingPaymentSince,
  panelOrderRowsComplete,
  panelOrdersLiveSince,
  panelOrdersSince,
  sortForPanelOrders,
  toPanelOrder,
  type PanelOrderSourceRow,
} from "@/lib/panel/orders-feed-core";

/**
 * The open café orders on the köşk panel's bar screen
 * (src/lib/panel/orders-feed-core.ts, src/app/api/panel/orders/route.ts,
 * docs/PANEL-ORDERS.md). What is pinned: only the whitelisted fields leave
 * (a first name, never the rest of the customer; the member's note on a
 * table or gel-al order, never a courier order's), only paid app and web
 * café orders in an open stage are on the screen, a forgotten one leaves
 * it, the route answers only a signed request, and every order write pings
 * the panel from the write hook. Beside the list, `awaitingPayment` is a
 * number and nothing else (which orders it counts against a real Postgres:
 * tests/db-integration-panel-feeds.test.ts).
 */

const NOW = new Date("2026-10-22T12:00:00.000Z");
const HOUR = 60 * 60_000;

function row(over: Partial<PanelOrderSourceRow> = {}): PanelOrderSourceRow {
  return {
    id: "ord-0042",
    orderNo: 10042,
    status: "paid",
    kind: "cafe",
    source: "",
    fulfillment: "pickup",
    tableCode: "",
    tableName: "",
    customerName: "Ayşe Yılmaz",
    scheduledFor: "",
    paidAt: new Date(NOW.getTime() - 5 * 60_000).toISOString(),
    shippedAt: "",
    deliveryNote: "  Fındık alerjim var ",
    totalMinor: 24000,
    items: [
      {
        productName: "Latte",
        qty: 2,
        status: "pending",
        menuItemId: "mnu-0003",
        size: "M",
        detail: "M · yulaf · +1 shot",
        options: { milk: "oat", extraShot: true, note: " şurupsuz lütfen " },
      },
      {
        productName: "Cheesecake",
        qty: 1,
        status: "pending",
        menuItemId: "mnu-0020",
        size: "single",
        detail: "",
      },
    ],
    ...over,
  };
}

describe("toPanelOrder", () => {
  it("sends the whitelisted shape, a first name and no other customer field", () => {
    const order = toPanelOrder(
      {
        ...row(),
        // Columns the route never selects, in case one is ever added:
        // none of them may reach the panel.
        ...({
          customerEmail: "ayse@example.com",
          customerPhone: "+905551112233",
          shippingAddress: "Postane Mah.",
          internalNote: "VIP",
        } as object),
      },
      NOW,
    );
    expect(order).toEqual({
      id: "ord-0042",
      orderNo: 10042,
      stage: "new",
      fulfillment: "pickup",
      label: "Gel-al",
      tableCode: "",
      firstName: "Ayşe",
      scheduledFor: "",
      note: "Fındık alerjim var",
      paidAt: row().paidAt,
      lines: [
        {
          menuItemId: "mnu-0003",
          name: "Latte",
          size: "M",
          detail: "M · yulaf · +1 shot",
          note: "şurupsuz lütfen",
          qty: 2,
        },
        {
          menuItemId: "mnu-0020",
          name: "Cheesecake",
          size: "single",
          detail: "",
          note: "",
          qty: 1,
        },
      ],
      totalMinor: 24000,
      path: "/admin/siparisler/ord-0042",
    });
    const text = JSON.stringify(order);
    for (const leak of [
      "Yılmaz",
      "example.com",
      "5551112233",
      "Postane",
      "VIP",
    ]) {
      expect(text).not.toContain(leak);
    }
  });

  it("sends the member's note on a table or gel-al order, never a courier's", () => {
    expect(toPanelOrder(row(), NOW)?.note).toBe("Fındık alerjim var");
    expect(
      toPanelOrder(
        row({ fulfillment: "table", tableCode: "K7Q2M9X4TB", tableName: "4" }),
        NOW,
      )?.note,
    ).toBe("Fındık alerjim var");
    // A courier order's note starts with the address note: a door code.
    const courier = toPanelOrder(
      row({
        fulfillment: "delivery",
        deliveryNote: "Kapı kodu 4821 · Fındık alerjim var",
      }),
      NOW,
    );
    expect(courier?.note).toBe("");
    expect(JSON.stringify(courier)).not.toContain("4821");
    // The line notes are the member's word on the drink: they ride along.
    expect(courier?.lines[0].note).toBe("şurupsuz lütfen");
    expect(toPanelOrder(row({ deliveryNote: undefined }), NOW)?.note).toBe("");
  });

  it("trims the notes and cuts a long one", () => {
    const long = toPanelOrder(
      row({
        deliveryNote: `  ${"ç".repeat(PANEL_ORDER_NOTE_MAX + 50)}  `,
        items: [
          {
            productName: "Latte",
            qty: 1,
            status: "pending",
            options: { note: "😀".repeat(PANEL_ORDER_LINE_NOTE_MAX + 5) },
          },
          {
            productName: "Mocha",
            qty: 1,
            status: "pending",
            options: { note: 42 },
          },
          { productName: "Su", qty: 1, status: "pending", options: null },
        ],
      }),
      NOW,
    )!;
    expect(long.note).toBe("ç".repeat(PANEL_ORDER_NOTE_MAX));
    // Characters, not UTF-16 halves: no broken emoji at the cut.
    expect(Array.from(long.lines[0].note)).toHaveLength(
      PANEL_ORDER_LINE_NOTE_MAX,
    );
    expect(long.lines[0].note).toBe("😀".repeat(PANEL_ORDER_LINE_NOTE_MAX));
    expect(long.lines.slice(1).map((l) => l.note)).toEqual(["", ""]);
  });

  it("names a table order by its table, as the counter card does", () => {
    const order = toPanelOrder(
      row({ fulfillment: "table", tableCode: "K7Q2M9X4TB", tableName: "4" }),
      NOW,
    );
    expect(order).toMatchObject({ fulfillment: "table", label: "Masa 4" });
    // LafPOS matches the order to its table plan by the code it printed
    // (docs/LAFPOS.md "Masa kodları"): the order's snapshot, as stored.
    expect(order?.tableCode).toBe("K7Q2M9X4TB");
    expect(
      toPanelOrder(
        row({
          fulfillment: "table",
          tableCode: " K7Q2M9X4TB ",
          tableName: "4",
        }),
        NOW,
      )?.tableCode,
    ).toBe("K7Q2M9X4TB");
    // Only a table order carries one; a stray value on another kind stays.
    expect(
      toPanelOrder(
        row({ fulfillment: "delivery", tableCode: "K7Q2M9X4TB" }),
        NOW,
      )?.tableCode,
    ).toBe("");
    expect(toPanelOrder(row({ tableCode: undefined }), NOW)?.tableCode).toBe(
      "",
    );
    expect(
      toPanelOrder(
        row({
          fulfillment: "table",
          tableCode: "K7Q2M9X4TB",
          tableName: "Masa Bahçe",
        }),
        NOW,
      )?.label,
    ).toBe("Masa Bahçe");
    expect(toPanelOrder(row({ fulfillment: "delivery" }), NOW)?.label).toBe(
      "Kurye",
    );
  });

  it("maps the status to the barista's stage", () => {
    expect(toPanelOrder(row({ status: "paid" }), NOW)?.stage).toBe("new");
    expect(toPanelOrder(row({ status: "preparing" }), NOW)?.stage).toBe(
      "preparing",
    );
    // A pickup order at the counter, waiting for its customer.
    expect(
      toPanelOrder(
        row({
          status: "shipped",
          shippedAt: new Date(NOW.getTime() - HOUR).toISOString(),
        }),
        NOW,
      )?.stage,
    ).toBe("ready");
  });

  it("leaves out what is not the bar's next job", () => {
    // A table or courier order that left the counter is done for the bar.
    expect(
      toPanelOrder(
        row({ status: "shipped", fulfillment: "table", tableCode: "X1" }),
        NOW,
      ),
    ).toBeNull();
    expect(
      toPanelOrder(row({ status: "shipped", fulfillment: "delivery" }), NOW),
    ).toBeNull();
    for (const status of [
      "pending_payment",
      "completed",
      "cancelled",
      "refunded",
    ]) {
      expect(toPanelOrder(row({ status }), NOW)).toBeNull();
    }
    // Shop parcels, and an order typed into the panel at the counter.
    expect(toPanelOrder(row({ kind: "shop" }), NOW)).toBeNull();
    expect(toPanelOrder(row({ fulfillment: "shipping" }), NOW)).toBeNull();
    expect(toPanelOrder(row({ source: "manual" }), NOW)).toBeNull();
    // Unpaid, or every line cancelled.
    expect(toPanelOrder(row({ paidAt: "" }), NOW)).toBeNull();
    expect(
      toPanelOrder(
        row({
          items: [{ productName: "Latte", qty: 1, status: "cancelled" }],
        }),
        NOW,
      ),
    ).toBeNull();
  });

  it("drops cancelled lines and keeps the rest", () => {
    const order = toPanelOrder(
      row({
        items: [
          { productName: "Latte", qty: 1, status: "cancelled", size: "M" },
          { productName: "Mocha", qty: 1, status: "ready", size: "L" },
        ],
      }),
      NOW,
    );
    expect(order?.lines.map((l) => [l.name, l.size])).toEqual([["Mocha", "L"]]);
  });

  it("lets a forgotten order leave the screen", () => {
    const paidLongAgo = new Date(
      NOW.getTime() - PANEL_ORDER_STALE_MS - 60_000,
    ).toISOString();
    expect(toPanelOrder(row({ paidAt: paidLongAgo }), NOW)).toBeNull();
    // A planned order paid days ago is due by its time, not its payment.
    const planned = toPanelOrder(
      row({
        paidAt: new Date(NOW.getTime() - 3 * 24 * HOUR).toISOString(),
        scheduledFor: new Date(NOW.getTime() + 2 * HOUR).toISOString(),
      }),
      NOW,
    );
    expect(planned?.stage).toBe("new");
    expect(planned?.scheduledFor).toBe(
      new Date(NOW.getTime() + 2 * HOUR).toISOString(),
    );
    // A pickup ready for half a day and never collected.
    expect(
      toPanelOrder(
        row({
          status: "shipped",
          shippedAt: new Date(
            NOW.getTime() - PANEL_ORDER_READY_STALE_MS - 60_000,
          ).toISOString(),
        }),
        NOW,
      ),
    ).toBeNull();
  });

  it("reads back far enough for an order planned a week ahead", () => {
    expect(PANEL_ORDERS_LOOKBACK_DAYS).toBeGreaterThan(7);
    expect(panelOrdersSince(NOW)).toBe(
      new Date(
        NOW.getTime() - PANEL_ORDERS_LOOKBACK_DAYS * 24 * HOUR,
      ).toISOString(),
    );
  });

  it("reads only what is not forgotten, by the same limits", () => {
    expect(panelOrdersLiveSince(NOW)).toEqual({
      dueSince: new Date(NOW.getTime() - PANEL_ORDER_STALE_MS).toISOString(),
      readySince: new Date(
        NOW.getTime() - PANEL_ORDER_READY_STALE_MS,
      ).toISOString(),
    });
  });

  it("calls a read that came back full incomplete, per read", () => {
    const open = (n: number) => Array.from({ length: n }, () => row());
    const ready = (n: number) =>
      Array.from({ length: n }, () => row({ status: "shipped" }));
    expect(panelOrderRowsComplete([...open(200), ...ready(200)], 201)).toBe(
      true,
    );
    expect(panelOrderRowsComplete(open(201), 201)).toBe(false);
    expect(panelOrderRowsComplete([...open(3), ...ready(201)], 201)).toBe(
      false,
    );
  });

  it("sorts the soonest due first", () => {
    const later = toPanelOrder(
      row({
        id: "ord-0050",
        orderNo: 10050,
        paidAt: new Date(NOW.getTime() - 60_000).toISOString(),
      }),
      NOW,
    )!;
    const planned = toPanelOrder(
      row({
        id: "ord-0040",
        orderNo: 10040,
        paidAt: new Date(NOW.getTime() - 2 * HOUR).toISOString(),
        scheduledFor: new Date(NOW.getTime() + HOUR).toISOString(),
      }),
      NOW,
    )!;
    const first = toPanelOrder(row(), NOW)!;
    expect(
      sortForPanelOrders([planned, later, first]).map((o) => o.orderNo),
    ).toEqual([10042, 10050, 10040]);
  });
});

// ─── Waiting for a payment ─────────────────────────────────────────────────

describe("awaitingPayment", () => {
  it("counts the orders opened in the last 30 minutes, the bound included", () => {
    expect(PANEL_AWAITING_PAYMENT_WINDOW_MS).toBe(30 * 60_000);
    expect(panelAwaitingPaymentSince(NOW)).toBe("2026-10-22T11:30:00.000Z");
  });

  it("counts only what the screen would show once paid: no parcel", () => {
    expect([...PANEL_ORDER_FULFILLMENTS].sort()).toEqual([
      "delivery",
      "pickup",
      "table",
    ]);
    for (const fulfillment of PANEL_ORDER_FULFILLMENTS) {
      expect(toPanelOrder(row({ fulfillment }), NOW)).not.toBeNull();
    }
    expect(toPanelOrder(row({ fulfillment: "shipping" }), NOW)).toBeNull();
  });

  it("counts by the same rule as the screen: a café order for a table, pickup or courier, not typed into the panel", () => {
    for (const kind of ["cafe", "shop", undefined]) {
      for (const source of ["", "manual", "app", undefined]) {
        for (const fulfillment of [
          "table",
          "pickup",
          "delivery",
          "shipping",
          "",
          undefined,
        ]) {
          const r = row({ kind, source, fulfillment });
          expect(isBarScreenOrder(r)).toBe(toPanelOrder(r, NOW) !== null);
        }
      }
    }
    expect(isBarScreenOrder({ kind: "cafe", fulfillment: "table" })).toBe(true);
    expect(
      isBarScreenOrder({ kind: "cafe", source: "manual", fulfillment: "table" }),
    ).toBe(false);
  });

  it("is a whole number, never negative", () => {
    expect(panelAwaitingPaymentCount(3)).toBe(3);
    expect(panelAwaitingPaymentCount("2")).toBe(2);
    expect(panelAwaitingPaymentCount(2.7)).toBe(2);
    expect(panelAwaitingPaymentCount(0)).toBe(0);
    expect(panelAwaitingPaymentCount(-1)).toBe(0);
    expect(panelAwaitingPaymentCount(Number.NaN)).toBe(0);
    expect(panelAwaitingPaymentCount(null)).toBe(0);
    expect(panelAwaitingPaymentCount(undefined)).toBe(0);
  });
});

// ─── The route ─────────────────────────────────────────────────────────────

const storeMock = vi.hoisted(() => ({
  listPanelOpenOrderRows: vi.fn(),
  countPanelAwaitingPaymentOrders: vi.fn(),
}));
vi.mock("@/lib/admin/store", () => storeMock);
const callsMock = vi.hoisted(() => ({ listOpenTableCalls: vi.fn() }));
vi.mock("@/lib/admin/table-calls", () => callsMock);

const SECRET = "test-secret-0123456789-abcdefghijklmnop";

function signedGet(path: string, secret = SECRET): Request {
  const url = new URL(path, "https://laffogato.net");
  return new Request(url, {
    headers: signedHeaders(secret, "GET", url, "", Date.now()),
  });
}

describe("GET /api/panel/orders", () => {
  beforeEach(() => {
    // The route reads the clock; the fixture's orders are paid at NOW.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.stubEnv("KARAOKE_SYNC_SECRET", SECRET);
    storeMock.listPanelOpenOrderRows.mockReset();
    storeMock.listPanelOpenOrderRows.mockResolvedValue([
      row(),
      row({ id: "ord-0001", orderNo: 10001, kind: "shop" }),
    ]);
    storeMock.countPanelAwaitingPaymentOrders.mockReset();
    storeMock.countPanelAwaitingPaymentOrders.mockResolvedValue(0);
    callsMock.listOpenTableCalls.mockReset();
    callsMock.listOpenTableCalls.mockResolvedValue([]);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  async function get(req: Request) {
    const { GET } = await import("@/app/api/panel/orders/route");
    return GET(req);
  }

  it("is off while the link is not configured", async () => {
    vi.stubEnv("KARAOKE_SYNC_SECRET", "");
    const res = await get(signedGet("/api/panel/orders"));
    expect(res.status).toBe(503);
    expect(storeMock.listPanelOpenOrderRows).not.toHaveBeenCalled();
    expect(storeMock.countPanelAwaitingPaymentOrders).not.toHaveBeenCalled();
  });

  it("answers nothing to an unsigned or wrongly signed request", async () => {
    const plain = await get(
      new Request("https://laffogato.net/api/panel/orders"),
    );
    expect(plain.status).toBe(401);
    const wrong = await get(
      signedGet("/api/panel/orders", "another-secret-0123456789-abcdefghij"),
    );
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: "unauthorized" });
    expect(storeMock.listPanelOpenOrderRows).not.toHaveBeenCalled();
    expect(storeMock.countPanelAwaitingPaymentOrders).not.toHaveBeenCalled();
  });

  it("answers the open café orders, uncached", async () => {
    const res = await get(signedGet("/api/panel/orders"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body).toMatchObject({ version: 1, complete: true });
    expect(body.orders.map((o: { id: string }) => o.id)).toEqual(["ord-0042"]);
    const [since, limit, live] = storeMock.listPanelOpenOrderRows.mock.calls[0];
    expect(typeof since).toBe("string");
    expect(limit).toBe(201);
    expect(Object.keys(live).sort()).toEqual(["dueSince", "readySince"]);
  });

  it("says how many café orders wait for their payment, a number and nothing else", async () => {
    storeMock.countPanelAwaitingPaymentOrders.mockResolvedValue(2);
    const res = await get(signedGet("/api/panel/orders"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Added to v1: the version stays, an older panel strips the new key.
    expect(Object.keys(body).sort()).toEqual([
      "awaitingPayment",
      "calls",
      "complete",
      "now",
      "orders",
      "version",
    ]);
    expect(body.version).toBe(1);
    expect(body.awaitingPayment).toBe(2);
    expect(storeMock.countPanelAwaitingPaymentOrders).toHaveBeenCalledTimes(1);
    expect(storeMock.countPanelAwaitingPaymentOrders).toHaveBeenCalledWith(
      "2026-10-22T11:30:00.000Z",
    );
  });

  it("reads the count before the list, so a payment in between is never in neither", async () => {
    // An order only goes from waiting to paid. Counted first, one paid
    // between the two reads is in the list; listed first, it was in
    // neither and the panel read "0 waiting" with no new order.
    let countDone = false;
    let listStartedBeforeCount = false;
    storeMock.countPanelAwaitingPaymentOrders.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      countDone = true;
      return 1;
    });
    storeMock.listPanelOpenOrderRows.mockImplementation(async () => {
      if (!countDone) listStartedBeforeCount = true;
      return [row()];
    });
    const res = await get(signedGet("/api/panel/orders"));
    expect(res.status).toBe(200);
    expect(
      storeMock.countPanelAwaitingPaymentOrders.mock.invocationCallOrder[0],
    ).toBeLessThan(storeMock.listPanelOpenOrderRows.mock.invocationCallOrder[0]!);
    // One after the other, not side by side.
    expect(listStartedBeforeCount).toBe(false);
  });

  it("answers 0, not a missing field, when nothing waits", async () => {
    const body = await (await get(signedGet("/api/panel/orders"))).json();
    expect(body.awaitingPayment).toBe(0);
    // No table call either: an empty list, never a missing field.
    expect(body.calls).toEqual([]);
  });

  it("sends the open table calls, oldest first, with no guest (6 Kas 2026)", async () => {
    const ago = (m: number) =>
      new Date(NOW.getTime() - m * 60_000).toISOString();
    callsMock.listOpenTableCalls.mockResolvedValue([
      {
        id: "tcl-bbbbbbbbbbbbbbbb",
        tableCode: "K7Q2M9X4TB",
        tableName: "4",
        reason: "water",
        customerEmail: "ayse@example.com",
        createdAt: ago(2),
        ackedAt: "",
        ackedBy: "",
      },
      {
        id: "tcl-aaaaaaaaaaaaaaaa",
        tableCode: "AAAAAAAAAA",
        tableName: "Masa 1",
        reason: "waiter",
        customerEmail: "ali@example.com",
        createdAt: ago(9),
        ackedAt: "",
        ackedBy: "",
      },
      {
        // Past the fifteen minutes: no longer on the screen.
        id: "tcl-cccccccccccccccc",
        tableCode: "AAAAAAAAAA",
        tableName: "Masa 1",
        reason: "napkin",
        createdAt: ago(16),
        ackedAt: "",
      },
    ]);
    const body = await (await get(signedGet("/api/panel/orders"))).json();
    expect(body.version).toBe(1);
    expect(body.calls).toEqual([
      {
        id: "tcl-aaaaaaaaaaaaaaaa",
        tableCode: "AAAAAAAAAA",
        label: "Masa 1",
        reason: "waiter",
        createdAt: ago(9),
      },
      {
        id: "tcl-bbbbbbbbbbbbbbbb",
        tableCode: "K7Q2M9X4TB",
        label: "Masa 4",
        reason: "water",
        createdAt: ago(2),
      },
    ]);
    expect(JSON.stringify(body.calls)).not.toContain("example.com");
  });

  it("says the database is down when the calls cannot be read", async () => {
    callsMock.listOpenTableCalls.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await get(signedGet("/api/panel/orders"));
    expect(res.status).toBe(503);
  });

  it("is not complete when the read came back full, whatever it dropped", async () => {
    // 201 rows that all leave the screen: the read may have cut a live one.
    const old = new Date(Date.now() - PANEL_ORDER_STALE_MS - HOUR);
    storeMock.listPanelOpenOrderRows.mockResolvedValue(
      Array.from({ length: 201 }, (_, i) =>
        row({
          id: `ord-${i}`,
          orderNo: 20_000 + i,
          paidAt: old.toISOString(),
        }),
      ),
    );
    const res = await get(signedGet("/api/panel/orders"));
    const body = await res.json();
    expect(body.orders).toEqual([]);
    expect(body.complete).toBe(false);
  });

  it("says the database is down rather than an empty queue", async () => {
    storeMock.listPanelOpenOrderRows.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await get(signedGet("/api/panel/orders"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });

  it("says so too when the count cannot be read, rather than 0 waiting", async () => {
    storeMock.countPanelAwaitingPaymentOrders.mockRejectedValue(
      new Error("down"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await get(signedGet("/api/panel/orders"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
    expect(storeMock.listPanelOpenOrderRows).not.toHaveBeenCalled();
  });
});

// ─── The ping ──────────────────────────────────────────────────────────────

const h = vi.hoisted(() => ({ tasks: [] as (() => unknown)[] }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    h.tasks.push(task);
  },
}));

describe("the ping (orders-ping.ts)", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    h.tasks.length = 0;
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("KARAOKE_SYNC_SECRET", SECRET);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function load() {
    vi.resetModules();
    return import("@/lib/panel/orders-ping");
  }

  it("is one signed POST of no order at all, after the response", async () => {
    const { pingPanelOrders } = await load();
    pingPanelOrders();
    pingPanelOrders();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.tasks).toHaveLength(1);
    await h.tasks[0]();
    const [target, init] = fetchMock.mock.calls[0];
    const url = new URL(String(target));
    expect(url.href).toBe("https://ladmin.laffogato.net/api/orders/ping");
    const body = String(init?.body);
    expect(Object.keys(JSON.parse(body)).sort()).toEqual(["at", "event"]);
    expect(JSON.parse(body).event).toBe("orders.changed");
    const headers = new Headers(init?.headers);
    expect(
      verifySignature(SECRET, {
        method: "POST",
        url,
        body,
        timestamp: headers.get(TIMESTAMP_HEADER),
        signature: headers.get(SIGNATURE_HEADER),
      }),
    ).toBe(true);
  });

  it("does nothing while the link is off", async () => {
    vi.stubEnv("KARAOKE_SYNC_SECRET", "");
    const { pingPanelOrders } = await load();
    pingPanelOrders();
    expect(h.tasks).toHaveLength(0);
  });

  it("rides on every write that expires the orders tag", () => {
    expect(tagsForWrite({ table: "orders" })).toContain(TAG_ORDERS);
    expect(tagsForWrite({ fn: "set_order_item_status" })).toContain(TAG_ORDERS);
    expect(tagsForWrite({ table: "menu_items" })).not.toContain(TAG_ORDERS);
    // A table call made or answered pings the panel too (6 Kas 2026).
    expect(tagsForWrite({ table: "table_calls" })).toContain(TAG_ORDERS);
    const src = readFileSync("src/lib/db/index.ts", "utf8");
    expect(src).toContain("if (tags.includes(TAG_ORDERS)) pingPanelOrders();");
    expect(src.match(/pingPanelOrders\(/g)).toHaveLength(1);
  });
});
