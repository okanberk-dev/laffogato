import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `GET /admin/siparisler/uyari`: the poll behind the panel's new-order
 * alert. Checked on every request (a route handler is not behind
 * requireRole), never cached, and the answer is what the counter needs to
 * start an order, nothing about who ordered it.
 */

const session = vi.hoisted(() => ({
  value: null as null | { email: string; role: string },
  throws: null as unknown,
}));
vi.mock("@/lib/admin/auth", () => ({
  getAdminSession: vi.fn(async () => {
    if (session.throws) throw session.throws;
    return session.value;
  }),
  isAdminSessionUnavailable: (err: unknown) =>
    (err as { code?: string } | null)?.code === "ADMIN_SESSION_UNAVAILABLE",
}));
const listOrderAlertRows = vi.hoisted(() => vi.fn());
const getSettings = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/store", () => ({ listOrderAlertRows, getSettings }));
const venue = vi.hoisted(() => ({ override: "auto" as string, open: true }));
vi.mock("@/lib/mobile/venue", () => ({
  getVenueStatus: vi.fn(async () => ({ manualOverride: venue.override })),
  isCafeOpenNow: vi.fn(() => venue.open),
}));

const { GET } = await import("@/app/admin/siparisler/uyari/route");

const paidAt = () => new Date(Date.now() - 60_000).toISOString();

function dbRow(over: Record<string, unknown> = {}) {
  return {
    id: "ord-7",
    orderNo: 10234,
    status: "paid",
    kind: "cafe",
    source: "",
    fulfillment: "table",
    tableCode: "T4",
    tableName: "4",
    paidAt: paidAt(),
    totalMinor: 18_500,
    items: [
      { productName: "Latte", qty: 2, unitPriceMinor: 9000, productId: "m-1" },
      { productName: "Su", qty: 1, unitPriceMinor: 500 },
    ],
    ...over,
  };
}

beforeEach(() => {
  session.value = null;
  session.throws = null;
  listOrderAlertRows.mockReset();
  listOrderAlertRows.mockResolvedValue([dbRow()]);
  getSettings.mockReset();
  getSettings.mockResolvedValue({ weeklyHours: {} });
  venue.open = true;
});

describe("the gate", () => {
  it("401 without a session, 403 for a role without Siparişler, never cached", async () => {
    let res = await GET();
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toContain("no-store");
    session.value = { email: "kasa@laffogato.net", role: "cashier" };
    res = await GET();
    expect(res.status).toBe(403);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(listOrderAlertRows).not.toHaveBeenCalled();
  });

  it("503 when the account cannot be read: the poller keeps asking", async () => {
    session.throws = Object.assign(new Error("db"), {
      code: "ADMIN_SESSION_UNAVAILABLE",
    });
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("503 when the orders cannot be read, not an error page", async () => {
    session.value = { email: "v@laffogato.net", role: "staff" };
    listOrderAlertRows.mockRejectedValue(new Error("ECONNREFUSED"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET();
    err.mockRestore();
    expect(res.status).toBe(503);
  });
});

describe("the answer", () => {
  it("gives staff the alerts, from four hours back, at most twenty", async () => {
    session.value = { email: "v@laffogato.net", role: "staff" };
    const before = Date.now();
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = (await res.json()) as { now: string; alerts: unknown[] };
    expect(Date.parse(body.now)).toBeGreaterThanOrEqual(before - 1000);
    expect(body.alerts).toEqual([
      {
        id: "ord-7",
        orderNo: 10234,
        label: "Masa 4",
        table: true,
        itemCount: 3,
        items: ["2× Latte", "Su"],
        moreItems: 0,
        totalMinor: 18_500,
        paidAt: expect.any(String),
      },
    ]);
    const [since, limit] = listOrderAlertRows.mock.calls[0];
    expect(limit).toBe(20);
    expect(before - Date.parse(since)).toBeGreaterThanOrEqual(
      4 * 3600_000 - 1000,
    );
    expect(before - Date.parse(since)).toBeLessThanOrEqual(4 * 3600_000 + 1000);
  });

  it("carries no customer details, even when a row has them", async () => {
    session.value = { email: "o@laffogato.net", role: "owner" };
    listOrderAlertRows.mockResolvedValue([
      dbRow({
        customerName: "Eda Yılmaz",
        customerEmail: "eda@example.com",
        customerPhone: "05321234567",
        shippingAddress: "Tuzla",
      }),
    ]);
    const text = await (await GET()).text();
    for (const leak of [
      "Eda",
      "eda@example.com",
      "0532",
      "Tuzla",
      "unitPriceMinor",
      "productId",
    ]) {
      expect(text, leak).not.toContain(leak);
    }
    const alert = (JSON.parse(text) as { alerts: Record<string, unknown>[] })
      .alerts[0];
    expect(Object.keys(alert).sort()).toEqual(
      [
        "id",
        "orderNo",
        "label",
        "table",
        "itemCount",
        "items",
        "moreItems",
        "totalMinor",
        "paidAt",
      ].sort(),
    );
  });

  it("drops a row the rule does not ring for, whatever the query returned", async () => {
    session.value = { email: "m@laffogato.net", role: "manager" };
    listOrderAlertRows.mockResolvedValue([
      dbRow({ id: "manual", source: "manual" }),
      dbRow({ id: "shop", kind: "shop" }),
      dbRow({ id: "prep", status: "preparing" }),
      dbRow({
        id: "old",
        paidAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
      }),
      dbRow({ id: "pickup", fulfillment: "pickup", tableCode: "" }),
    ]);
    const body = (await (await GET()).json()) as {
      alerts: { id: string; label: string }[];
    };
    expect(body.alerts.map((a) => [a.id, a.label])).toEqual([
      ["pickup", "Gel-al"],
    ]);
  });
});

describe("the next poll (pollAfterMs)", () => {
  beforeEach(() => {
    session.value = { email: "s@laffogato.net", role: "staff" };
  });

  it("asks every ten seconds while the köşk is open", async () => {
    listOrderAlertRows.mockResolvedValue([]);
    const body = await (await GET()).json();
    expect(body.pollAfterMs).toBe(10_000);
  });

  it("asks hourly when the köşk is closed and nothing waits, so the database can sleep", async () => {
    venue.open = false;
    listOrderAlertRows.mockResolvedValue([]);
    const body = await (await GET()).json();
    expect(body.pollAfterMs).toBe(60 * 60_000);
  });

  it("stays fast while an order waits, even when closed", async () => {
    venue.open = false;
    const body = await (await GET()).json();
    expect(body.alerts).toHaveLength(1);
    expect(body.pollAfterMs).toBe(10_000);
  });

  it("stays fast when the hours cannot be read", async () => {
    venue.open = false;
    listOrderAlertRows.mockResolvedValue([]);
    getSettings.mockRejectedValue(new Error("down"));
    const body = await (await GET()).json();
    expect(body.pollAfterMs).toBe(10_000);
  });
});
