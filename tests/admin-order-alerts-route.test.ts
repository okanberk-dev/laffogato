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
  /**
   * What the cookie's signature alone says (undefined: the same as the
   * account). The cheap path reads only this.
   */
  signed: undefined as undefined | null | { email: string; role: string },
}));
const getAdminSession = vi.hoisted(() =>
  vi.fn(async () => {
    if (session.throws) throw session.throws;
    return session.value;
  }),
);
vi.mock("@/lib/admin/auth", () => ({
  ADMIN_COOKIE_NAME: "laffogato_panel_session",
  getAdminSession,
  isAdminSessionUnavailable: (err: unknown) =>
    (err as { code?: string } | null)?.code === "ADMIN_SESSION_UNAVAILABLE",
  readSessionFromCookieValue: (value: string | undefined) =>
    value
      ? session.signed !== undefined
        ? session.signed
        : session.value
      : null,
}));
/** The session cookie the request carries (its value, as the jar has it). */
const cookie = vi.hoisted(() => ({ value: "signed-token" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "laffogato_panel_session" ? { value: cookie.value } : undefined,
  }),
}));
const listOrderAlertRows = vi.hoisted(() => vi.fn());
const getSettings = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/store", () => ({ listOrderAlertRows, getSettings }));
const listOpenTableCalls = vi.hoisted(() =>
  vi.fn(async (): Promise<unknown[]> => []),
);
vi.mock("@/lib/admin/table-calls", () => ({ listOpenTableCalls }));
const venue = vi.hoisted(() => ({ override: "auto" as string, open: true }));
vi.mock("@/lib/mobile/venue", () => ({
  getVenueStatus: vi.fn(async () => ({ manualOverride: venue.override })),
  isCafeOpenNow: vi.fn(() => venue.open),
}));
const marker = vi.hoisted(() => ({
  read: vi.fn(async (): Promise<string | null> => null),
  busy: vi.fn(async () => true),
}));
vi.mock("@/lib/admin/change-marker", () => ({
  readChangeMarker: marker.read,
  cachedBusyWindow: marker.busy,
  busyAt: () => venue.open,
}));

const { GET } = await import("@/app/admin/siparisler/uyari/route");
const { formatOrderAlertCursor, parseOrderAlertCursor } =
  await import("@/lib/admin/order-alerts-core");
const { sessionBinding } = await import("@/lib/admin/poll-binding");

const ROUTE = "https://laffogato.net/admin/siparisler/uyari";
const req = (cursor?: string) =>
  new Request(cursor ? `${ROUTE}?c=${encodeURIComponent(cursor)}` : ROUTE);

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
  cookie.value = "signed-token";
  session.value = null;
  session.throws = null;
  session.signed = undefined;
  getAdminSession.mockClear();
  marker.read.mockReset();
  marker.read.mockResolvedValue(null);
  marker.busy.mockReset();
  marker.busy.mockResolvedValue(true);
  listOrderAlertRows.mockReset();
  listOrderAlertRows.mockResolvedValue([dbRow()]);
  listOpenTableCalls.mockReset();
  listOpenTableCalls.mockResolvedValue([]);
  getSettings.mockReset();
  getSettings.mockResolvedValue({ weeklyHours: {} });
  venue.open = true;
});

describe("the gate", () => {
  it("401 without a session, 403 for a role without Siparişler, never cached", async () => {
    let res = await GET(req());
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toContain("no-store");
    session.value = { email: "kasa@laffogato.net", role: "cashier" };
    res = await GET(req());
    expect(res.status).toBe(403);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(listOrderAlertRows).not.toHaveBeenCalled();
  });

  it("503 when the account cannot be read: the poller keeps asking", async () => {
    session.signed = { email: "v@laffogato.net", role: "staff" };
    session.throws = Object.assign(new Error("db"), {
      code: "ADMIN_SESSION_UNAVAILABLE",
    });
    const res = await GET(req());
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("503 when the orders cannot be read, not an error page", async () => {
    session.value = { email: "v@laffogato.net", role: "staff" };
    listOrderAlertRows.mockRejectedValue(new Error("ECONNREFUSED"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req());
    err.mockRestore();
    expect(res.status).toBe(503);
  });
});

describe("the answer", () => {
  it("gives staff the alerts, from four hours back, at most twenty", async () => {
    session.value = { email: "v@laffogato.net", role: "staff" };
    const before = Date.now();
    const res = await GET(req());
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

  it("rings an open table call first, as Masa 4 · Su istiyor, with no guest (6 Kas 2026)", async () => {
    session.value = { email: "v@laffogato.net", role: "staff" };
    const createdAt = new Date(Date.now() - 60_000).toISOString();
    listOpenTableCalls.mockResolvedValue([
      {
        id: "tcl-0123456789abcdef",
        tableCode: "K7Q2M9X4TB",
        tableName: "4",
        reason: "water",
        customerEmail: "eda@example.com",
        createdAt,
        ackedAt: "",
        ackedBy: "",
      },
      {
        // Older than fifteen minutes: no longer rings.
        id: "tcl-zzzzzzzzzzzzzzzz",
        tableCode: "K7Q2M9X4TB",
        tableName: "4",
        reason: "waiter",
        createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
        ackedAt: "",
      },
    ]);
    const res = await GET(req());
    const text = await res.clone().text();
    const body = (await res.json()) as { alerts: Record<string, unknown>[] };
    expect(body.alerts.map((a) => a.id)).toEqual([
      "tcl-0123456789abcdef",
      "ord-7",
    ]);
    expect(body.alerts[0]).toEqual({
      id: "tcl-0123456789abcdef",
      orderNo: 0,
      label: "Masa 4",
      table: true,
      itemCount: 0,
      items: [],
      moreItems: 0,
      totalMinor: 0,
      paidAt: createdAt,
      call: "water",
    });
    expect(text).not.toContain("eda@example.com");
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
    const text = await (await GET(req())).text();
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
    const body = (await (await GET(req())).json()) as {
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
    const body = await (await GET(req())).json();
    expect(body.pollAfterMs).toBe(10_000);
  });

  it("asks hourly when the köşk is closed and nothing waits, so the database can sleep", async () => {
    venue.open = false;
    listOrderAlertRows.mockResolvedValue([]);
    const body = await (await GET(req())).json();
    expect(body.pollAfterMs).toBe(60 * 60_000);
  });

  it("stays fast while an order waits, even when closed", async () => {
    venue.open = false;
    const body = await (await GET(req())).json();
    expect(body.alerts).toHaveLength(1);
    expect(body.pollAfterMs).toBe(10_000);
  });

  it("stays fast when the hours cannot be read", async () => {
    venue.open = false;
    listOrderAlertRows.mockResolvedValue([]);
    getSettings.mockRejectedValue(new Error("down"));
    const body = await (await GET(req())).json();
    expect(body.pollAfterMs).toBe(10_000);
  });
});

describe("the cursor: nothing changed, no database", () => {
  const STAFF = { email: "s@laffogato.net", role: "staff" };
  /** A marker made two hours ago, as change-marker.ts makes them. */
  const M = `${(Date.now() - 2 * 3600_000).toString(36)}-k3j9x0q2`;
  const cursorAt = (fullAt: number, newestPaidAt = 0, m = M) =>
    formatOrderAlertCursor({
      marker: m,
      fullAt,
      newestPaidAt,
      session: sessionBinding("signed-token"),
    });

  beforeEach(() => {
    session.value = STAFF;
    marker.read.mockResolvedValue(M);
  });

  it("answers unchanged without the account, the orders or the settings", async () => {
    marker.busy.mockResolvedValue(true);
    const c = cursorAt(Date.now() - 60_000);
    const res = await GET(req(c));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.json();
    expect(body).toEqual({
      now: expect.any(String),
      unchanged: true,
      cursor: c,
      pollAfterMs: 10_000,
    });
    expect("alerts" in body).toBe(false);
    expect(getAdminSession).not.toHaveBeenCalled();
    expect(listOrderAlertRows).not.toHaveBeenCalled();
    expect(getSettings).not.toHaveBeenCalled();
  });

  it("asks hourly when idle and nothing rings, fast while the last alert still rings", async () => {
    marker.busy.mockResolvedValue(false);
    let body = await (await GET(req(cursorAt(Date.now() - 60_000)))).json();
    expect(body.unchanged).toBe(true);
    expect(body.pollAfterMs).toBe(60 * 60_000);
    body = await (
      await GET(req(cursorAt(Date.now() - 60_000, Date.now() - 120_000)))
    ).json();
    expect(body.unchanged).toBe(true);
    expect(body.pollAfterMs).toBe(10_000);
  });

  it("a bad signature is a 401 before anything is read", async () => {
    session.signed = null;
    const res = await GET(req(cursorAt(Date.now() - 60_000)));
    expect(res.status).toBe(401);
    expect(marker.read).not.toHaveBeenCalled();
    expect(getAdminSession).not.toHaveBeenCalled();
    expect(listOrderAlertRows).not.toHaveBeenCalled();
  });

  it("a token whose role has no Siparişler goes the full way: the account decides", async () => {
    session.signed = { email: "k@laffogato.net", role: "cashier" };
    session.value = { email: "k@laffogato.net", role: "cashier" };
    const res = await GET(req(cursorAt(Date.now() - 60_000)));
    expect(res.status).toBe(403);
    expect(marker.read).not.toHaveBeenCalled();
    expect(getAdminSession).toHaveBeenCalled();
    // Demoted since the cookie was signed: the token says staff, the
    // account says cashier. No unchanged answer either way.
    session.signed = STAFF;
    marker.read.mockResolvedValue(`${Date.now().toString(36)}-moved`);
    expect((await GET(req(cursorAt(Date.now() - 60_000)))).status).toBe(403);
  });

  it("a marker that cannot be read goes the full way, and the answer has no cursor", async () => {
    marker.read.mockResolvedValue(null);
    const res = await GET(req(cursorAt(Date.now() - 60_000)));
    const body = await res.json();
    expect(body.alerts).toHaveLength(1);
    expect(body.cursor).toBeUndefined();
    expect(getAdminSession).toHaveBeenCalled();
  });

  it("a moved marker gets the full answer and a new cursor, read before the orders", async () => {
    const moved = `${(Date.now() - 1000).toString(36)}-n3w`;
    marker.read.mockResolvedValue(moved);
    const before = Date.now();
    const res = await GET(req(cursorAt(Date.now() - 60_000)));
    const body = await res.json();
    expect(body.alerts).toHaveLength(1);
    const next = parseOrderAlertCursor(body.cursor);
    expect(next?.marker).toBe(moved);
    expect(next?.fullAt).toBeGreaterThanOrEqual(before - 1000);
    expect(next?.newestPaidAt).toBe(Date.parse(body.alerts[0].paidAt));
    expect(marker.read.mock.invocationCallOrder[0]).toBeLessThan(
      listOrderAlertRows.mock.invocationCallOrder[0],
    );
  });

  it("without a cursor (an old tab, a poll-now) the full answer reads the marker first too", async () => {
    const res = await GET(req());
    const body = await res.json();
    expect(body.alerts).toHaveLength(1);
    expect(parseOrderAlertCursor(body.cursor)?.marker).toBe(M);
    expect(marker.read).toHaveBeenCalledTimes(1);
    expect(marker.read.mock.invocationCallOrder[0]).toBeLessThan(
      listOrderAlertRows.mock.invocationCallOrder[0],
    );
  });

  it("while busy, a full answer at least every hour; idle, none needed", async () => {
    const old = cursorAt(Date.now() - 61 * 60_000);
    marker.busy.mockResolvedValue(true);
    let body = await (await GET(req(old))).json();
    expect(body.alerts).toHaveLength(1);
    expect(listOrderAlertRows).toHaveBeenCalledTimes(1);
    marker.busy.mockResolvedValue(false);
    body = await (await GET(req(old))).json();
    expect(body.unchanged).toBe(true);
    expect(listOrderAlertRows).toHaveBeenCalledTimes(1);
  });

  it("junk in ?c= is a full answer, never an error", async () => {
    const res = await GET(req("a2.<script>.0.0"));
    expect(res.status).toBe(200);
    expect((await res.json()).alerts).toHaveLength(1);
  });

  it("an a1 cursor from before the session binding gets one full answer", async () => {
    const res = await GET(
      req(`a1.${M}.${(Date.now() - 60_000).toString(36)}.0`),
    );
    const body = await res.json();
    expect(body.alerts).toHaveLength(1);
    expect(parseOrderAlertCursor(body.cursor)?.session).toBe(
      sessionBinding("signed-token"),
    );
  });
});

describe("a session revoked since its cursor (rule 30)", () => {
  const STAFF = { email: "s@laffogato.net", role: "staff" };
  const M = `${(Date.now() - 2 * 3600_000).toString(36)}-k3j9x0q2`;

  beforeEach(() => {
    session.value = STAFF;
    marker.read.mockResolvedValue(M);
  });

  it("a cursor answers unchanged only for the session it was handed to", async () => {
    cookie.value = "token-of-a";
    const first = await (await GET(req())).json();
    expect(first.cursor).toEqual(expect.any(String));
    expect((await (await GET(req(first.cursor))).json()).unchanged).toBe(true);
    // Another cookie, still validly signed, whose account was deactivated
    // before the current marker was made, with the first session's cursor:
    // the account is read, and it says no.
    getAdminSession.mockClear();
    cookie.value = "token-of-b";
    session.signed = STAFF;
    session.value = null;
    const res = await GET(req(first.cursor));
    expect(res.status).toBe(401);
    expect(getAdminSession).toHaveBeenCalled();
    expect(listOrderAlertRows).toHaveBeenCalledTimes(1);
  });

  it("a deactivated, demoted or reset account is refused on the next poll: the account write moved the marker", async () => {
    const first = await (await GET(req())).json();
    // What an admin_users write does (change-marker.ts carries live:access).
    marker.read.mockResolvedValue(`${(Date.now() - 1000).toString(36)}-acct`);
    session.signed = STAFF;
    session.value = null;
    expect((await GET(req(first.cursor))).status).toBe(401);
    session.value = { email: STAFF.email, role: "cashier" };
    expect((await GET(req(first.cursor))).status).toBe(403);
    expect(listOrderAlertRows).toHaveBeenCalledTimes(1);
  });

  it("the marker is read before the account, so a revocation in between moves it", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(marker.read.mock.invocationCallOrder[0]).toBeLessThan(
      getAdminSession.mock.invocationCallOrder[0],
    );
  });
});
