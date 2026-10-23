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
  PANEL_ORDER_READY_STALE_MS,
  PANEL_ORDER_STALE_MS,
  PANEL_ORDERS_LOOKBACK_DAYS,
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
 * (a first name, never the rest of the customer), only paid app and web
 * café orders in an open stage are on the screen, a forgotten one leaves
 * it, the route answers only a signed request, and every order write pings
 * the panel from the write hook.
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
    totalMinor: 24000,
    items: [
      {
        productName: "Latte",
        qty: 2,
        status: "pending",
        menuItemId: "mnu-0003",
        size: "M",
        detail: "M · yulaf · +1 shot",
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
          deliveryNote: "Kapı kodu 4821",
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
      firstName: "Ayşe",
      scheduledFor: "",
      paidAt: row().paidAt,
      lines: [
        {
          menuItemId: "mnu-0003",
          name: "Latte",
          size: "M",
          detail: "M · yulaf · +1 shot",
          qty: 2,
        },
        {
          menuItemId: "mnu-0020",
          name: "Cheesecake",
          size: "single",
          detail: "",
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
      "4821",
      "VIP",
    ]) {
      expect(text).not.toContain(leak);
    }
  });

  it("names a table order by its table, as the counter card does", () => {
    const order = toPanelOrder(
      row({ fulfillment: "table", tableCode: "K7Q2M9X4TB", tableName: "4" }),
      NOW,
    );
    expect(order).toMatchObject({ fulfillment: "table", label: "Masa 4" });
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

// ─── The route ─────────────────────────────────────────────────────────────

const storeMock = vi.hoisted(() => ({
  listPanelOpenOrderRows: vi.fn(),
}));
vi.mock("@/lib/admin/store", () => storeMock);

const SECRET = "test-secret-0123456789-abcdefghijklmnop";

function signedGet(path: string, secret = SECRET): Request {
  const url = new URL(path, "https://laffogato.net");
  return new Request(url, {
    headers: signedHeaders(secret, "GET", url, "", Date.now()),
  });
}

describe("GET /api/panel/orders", () => {
  beforeEach(() => {
    vi.stubEnv("KARAOKE_SYNC_SECRET", SECRET);
    storeMock.listPanelOpenOrderRows.mockReset();
    storeMock.listPanelOpenOrderRows.mockResolvedValue([
      row(),
      row({ id: "ord-0001", orderNo: 10001, kind: "shop" }),
    ]);
  });
  afterEach(() => {
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
    const src = readFileSync("src/lib/db/index.ts", "utf8");
    expect(src).toContain("if (tags.includes(TAG_ORDERS)) pingPanelOrders();");
    expect(src.match(/pingPanelOrders\(/g)).toHaveLength(1);
  });
});
