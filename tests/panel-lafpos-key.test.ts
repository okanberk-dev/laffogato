import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auditActorLabel } from "@/lib/admin/karaoke-panel";
import { orderTimeline } from "@/lib/admin/order-timeline";
import { signedHeaders } from "@/lib/panel/karaoke-sync-core";
import {
  lafposSyncSecret,
  signedCaller,
  signedCallerKeys,
  type SignedCallerKeys,
} from "@/lib/panel/signed-callers";

/**
 * LafPOS, the café's till server, on the panel's routes with a key of its
 * own (docs/LAFPOS.md): `LAFPOS_SYNC_SECRET` opens the menu read and write,
 * the bar screen's read and stage and the karaoke read beside the panel's
 * `KARAOKE_SYNC_SECRET`, so the panel's key never sits on the café's
 * machine. What is pinned: LafPOS's signature opens each of the five
 * routes, its writes are audited "lafpos:<name>", its karaoke read is the
 * panel's whitelist and nothing more, from Istanbul yesterday to tomorrow
 * only (a wider window is 403 before anything is read), the panel's
 * requests are answered exactly as before, a route with neither key is
 * shut, the panel's value pasted in as LafPOS's opens nothing to LafPOS,
 * the sales route stays the panel's alone, and the table list
 * (`PUT /api/panel/tables`, the codes LafPOS prints) is LafPOS's alone.
 */

const store = vi.hoisted(() => ({
  getMenuItemForPanel: vi.fn(),
  listMenuItemsForPanel: vi.fn(),
  setMenuItemSaleFields: vi.fn(),
  markMenuPricesChanged: vi.fn(),
  listPanelOpenOrderRows: vi.fn(),
  countPanelAwaitingPaymentOrders: vi.fn(),
  getOrder: vi.fn(),
  transitionOrder: vi.fn(),
  listPanelSalesOrderRows: vi.fn(),
  listPanelSalesBookingRows: vi.fn(),
}));
const safeAudit = vi.hoisted(() => vi.fn());
const listReservationsForAdmin = vi.hoisted(() => vi.fn());
const cafeTables = vi.hoisted(() => ({ importCafeTables: vi.fn() }));
vi.mock("@/lib/admin/store", () => ({
  ...store,
  MENU_CATEGORY_KEYS: ["espresso"],
  MENU_CATEGORY_LABELS: { espresso: "Espresso" },
}));
vi.mock("@/lib/admin/audit", () => ({ safeAudit }));
vi.mock("@/lib/admin/cafe-tables", () => cafeTables);
// The feed's table calls (6 Kas 2026): none open here.
vi.mock("@/lib/admin/table-calls", () => ({
  listOpenTableCalls: vi.fn(async () => []),
}));
vi.mock("@/lib/mobile/karaoke", () => ({ listReservationsForAdmin }));
vi.mock("@/lib/customer/coupons", () => ({ couponSourcesForOrders: vi.fn() }));
vi.mock("@/lib/invoice/store", () => ({
  dbInvoiceStore: { paymentsFor: vi.fn() },
}));

const menu = await import("@/app/api/panel/menu/route");
const orders = await import("@/app/api/panel/orders/route");
const stage = await import("@/app/api/panel/orders/stage/route");
const karaoke = await import("@/app/api/panel/karaoke/route");
const sales = await import("@/app/api/panel/sales/route");
const tables = await import("@/app/api/panel/tables/route");

const PANEL = "panel-secret-0123456789-abcdefghijklmnop";
const LAFPOS = "lafpos-secret-0123456789-abcdefghijklmno";

/**
 * The clock the routes read, pinned: 15:00 on 26 October in Tuzla. LafPOS's
 * karaoke reach is counted from today in Istanbul, so the windows below
 * would go stale on a real clock.
 */
const NOW = new Date("2026-10-26T12:00:00.000Z");

/** A request signed with `secret`: a GET, or a POST (or PUT) of `body`. */
function signed(
  path: string,
  secret: string,
  body?: string,
  write: "POST" | "PUT" = "POST",
): Request {
  const url = new URL(path, "https://laffogato.net");
  const method = body === undefined ? "GET" : write;
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...signedHeaders(secret, method, url, body ?? "", Date.now()),
    },
    body,
  });
}

const KARAOKE_WINDOW = "/api/panel/karaoke?from=2026-10-26&to=2026-10-26";

const MENU_CHANGE = JSON.stringify({
  id: "mnu-0011",
  isActive: false,
  actor: "Selin",
});
const TAP = JSON.stringify({
  id: "ord-0042",
  action: "ready",
  from: "new",
  actor: "Selin",
});

/** The five routes, each as LafPOS (or the panel) calls it. */
const ROUTES = {
  "GET /api/panel/menu": (secret: string) =>
    menu.GET(signed("/api/panel/menu", secret)),
  "POST /api/panel/menu": (secret: string) =>
    menu.POST(signed("/api/panel/menu", secret, MENU_CHANGE)),
  "GET /api/panel/orders": (secret: string) =>
    orders.GET(signed("/api/panel/orders", secret)),
  "POST /api/panel/orders/stage": (secret: string) =>
    stage.POST(signed("/api/panel/orders/stage", secret, TAP)),
  "GET /api/panel/karaoke": (secret: string) =>
    karaoke.GET(signed(KARAOKE_WINDOW, secret)),
};

/** Every read behind the five routes: none may run for a refused request. */
const READS = () => [...Object.values(store), listReservationsForAdmin];

function menuItem(over: Record<string, unknown> = {}) {
  return {
    id: "mnu-0011",
    name: "Espresso Macchiato",
    categoryKey: "espresso",
    priceMinor: 14000,
    priceMinorL: 0,
    isActive: true,
    sortOrder: 6,
    updatedAt: "2026-10-20T08:00:00.000Z",
    ...over,
  };
}

/** A paid web booking, every column the table has (the whitelist narrows). */
function booking(over: Record<string, unknown> = {}) {
  return {
    id: "krk-0007",
    customerEmail: "ayse@example.com",
    customerName: "Ayşe Yılmaz",
    date: "2026-10-26",
    startHour: 20,
    hours: 2,
    guests: 5,
    status: "confirmed",
    priceMinor: 200000,
    discountMinor: 0,
    totalMinor: 200000,
    note: "Doğum günü",
    createdAt: "2026-10-20T09:00:00.000Z",
    updatedAt: "2026-10-20T09:05:00.000Z",
    contactPhone: "+905551112233",
    paymentStatus: "paid",
    paymentRef: "PNK-1",
    channel: "web",
    ...over,
  };
}

function order(over: Record<string, unknown> = {}) {
  return {
    id: "ord-0042",
    orderNo: 10234,
    status: "paid",
    kind: "cafe",
    fulfillment: "pickup",
    source: "",
    customerName: "Ayşe Yılmaz",
    paidAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    scheduledFor: "",
    shippedAt: "",
    totalMinor: 18000,
    items: [
      {
        productName: "Latte",
        qty: 1,
        status: "pending",
        menuItemId: "mnu-1",
        size: "M",
        detail: "",
      },
    ],
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("KARAOKE_SYNC_SECRET", PANEL);
  vi.stubEnv("LAFPOS_SYNC_SECRET", LAFPOS);
  vi.stubEnv("PANEL_URL", "");
  for (const fn of [
    ...Object.values(store),
    safeAudit,
    listReservationsForAdmin,
    cafeTables.importCafeTables,
  ]) {
    fn.mockReset();
  }
  cafeTables.importCafeTables.mockResolvedValue({
    count: 1,
    created: [],
    updated: [],
    unchanged: 1,
  });
  store.listMenuItemsForPanel.mockResolvedValue([menuItem()]);
  store.getMenuItemForPanel.mockResolvedValue(menuItem());
  store.setMenuItemSaleFields.mockResolvedValue(menuItem({ isActive: false }));
  store.markMenuPricesChanged.mockResolvedValue(undefined);
  store.listPanelOpenOrderRows.mockResolvedValue([order()]);
  store.countPanelAwaitingPaymentOrders.mockResolvedValue(1);
  listReservationsForAdmin.mockResolvedValue([booking()]);
  store.getOrder.mockResolvedValue(order());
  store.transitionOrder.mockResolvedValue({
    ok: true,
    order: order({ status: "shipped", shippedAt: new Date().toISOString() }),
  });
  safeAudit.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the keys (signed-callers.ts)", () => {
  it("counts LafPOS's key from 32 characters, trimmed; a shorter one is unset", () => {
    const key = "k".repeat(32);
    expect(lafposSyncSecret({})).toBeNull();
    expect(lafposSyncSecret({ LAFPOS_SYNC_SECRET: "" })).toBeNull();
    expect(lafposSyncSecret({ LAFPOS_SYNC_SECRET: "k".repeat(31) })).toBeNull();
    expect(
      lafposSyncSecret({ LAFPOS_SYNC_SECRET: `  ${"k".repeat(31)}  ` }),
    ).toBeNull();
    expect(lafposSyncSecret({ LAFPOS_SYNC_SECRET: ` ${key}\n` })).toBe(key);
  });

  it("gives a route only the keys it names, and none when neither is set", () => {
    const env = { KARAOKE_SYNC_SECRET: PANEL, LAFPOS_SYNC_SECRET: LAFPOS };
    expect(signedCallerKeys(env, ["panel", "lafpos"])).toEqual({
      panel: PANEL,
      lafpos: LAFPOS,
    });
    expect(signedCallerKeys(env, ["lafpos"])).toEqual({ lafpos: LAFPOS });
    expect(
      signedCallerKeys({ KARAOKE_SYNC_SECRET: PANEL }, ["lafpos"]),
    ).toBeNull();
    expect(signedCallerKeys({}, ["panel", "lafpos"])).toBeNull();
  });

  it("counts the panel's key as it always has; PANEL_URL does not touch LafPOS's", () => {
    const env = {
      KARAOKE_SYNC_SECRET: PANEL,
      LAFPOS_SYNC_SECRET: LAFPOS,
      PANEL_URL: "http://ladmin.laffogato.net",
    };
    expect(signedCallerKeys(env, ["panel", "lafpos"])).toEqual({
      lafpos: LAFPOS,
    });
    expect(signedCallerKeys(env, ["panel"])).toBeNull();
  });

  it("does not count LafPOS's key when it is the panel's value pasted in", () => {
    const env = {
      KARAOKE_SYNC_SECRET: PANEL,
      LAFPOS_SYNC_SECRET: ` ${PANEL} `,
      PANEL_URL: "",
    };
    expect(signedCallerKeys(env, ["lafpos"])).toBeNull();
    expect(signedCallerKeys(env, ["panel", "lafpos"])).toEqual({
      panel: PANEL,
    });
    expect(
      signedCallerKeys({ ...env, LAFPOS_SYNC_SECRET: LAFPOS }, ["lafpos"]),
    ).toEqual({ lafpos: LAFPOS });
  });

  it("tells the two callers apart; one value set as both keys is the panel's", () => {
    const keys: SignedCallerKeys = { panel: PANEL, lafpos: LAFPOS };
    const url = new URL("https://laffogato.net/api/panel/menu");
    const ask = (secret: string, k: SignedCallerKeys = keys) =>
      signedCaller(k, signed("/api/panel/menu", secret), "GET", url, "");
    expect(ask(PANEL)).toBe("panel");
    expect(ask(LAFPOS)).toBe("lafpos");
    expect(ask(`${LAFPOS}-other`)).toBeNull();
    expect(ask(PANEL, { lafpos: LAFPOS })).toBeNull();
    expect(ask(LAFPOS, { panel: LAFPOS, lafpos: LAFPOS })).toBe("panel");
  });
});

describe("LafPOS's key on the five routes", () => {
  it.each([
    ["alone", ""],
    ["beside the panel's", PANEL],
  ])("opens each of them, %s", async (_, panelKey) => {
    vi.stubEnv("KARAOKE_SYNC_SECRET", panelKey);
    for (const [route, call] of Object.entries(ROUTES)) {
      const res = await call(LAFPOS);
      expect(res.status, route).toBe(200);
      expect(res.headers.get("cache-control"), route).toBe("no-store");
    }
  });

  it("audits a menu change as lafpos:<name>", async () => {
    const res = await ROUTES["POST /api/panel/menu"](LAFPOS);
    expect(res.status).toBe(200);
    expect(store.setMenuItemSaleFields).toHaveBeenCalledWith("mnu-0011", {
      isActive: false,
    });
    expect(safeAudit).toHaveBeenCalledWith({
      action: "update",
      entity: "menu_item",
      entityId: "mnu-0011",
      actor: "lafpos:Selin",
      payload: { name: "Espresso Macchiato", isActive: false, via: "lafpos" },
    });
  });

  it("moves an order as lafpos:<name>, in the move and in the audit row", async () => {
    const res = await ROUTES["POST /api/panel/orders/stage"](LAFPOS);
    expect(res.status).toBe(200);
    expect(store.transitionOrder).toHaveBeenCalledWith(
      "ord-0042",
      "mark_shipped",
      { actor: "lafpos:Selin", expectStatus: "paid" },
    );
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "transition",
        entity: "order",
        actor: "lafpos:Selin",
        payload: expect.objectContaining({ via: "lafpos" }),
      }),
    );
  });

  it("answers 401 to any other key, before reading anything", async () => {
    for (const [route, call] of Object.entries(ROUTES)) {
      const res = await call(`${LAFPOS}-other`);
      expect(res.status, route).toBe(401);
      expect(await res.json(), route).toEqual({ error: "unauthorized" });
    }
    for (const fn of READS()) expect(fn).not.toHaveBeenCalled();
  });

  it("writes Tükendi / Satışta only: a price is 403 before anything is read", async () => {
    for (const [field, change] of [
      ["priceMinor", { id: "mnu-0011", priceMinor: 1, actor: "x" }],
      ["priceMinorL", { id: "mnu-0011", priceMinorL: 0, actor: "x" }],
      [
        "priceMinor",
        { id: "mnu-0011", isActive: false, priceMinor: 9900, actor: "x" },
      ],
    ] as const) {
      const res = await menu.POST(
        signed("/api/panel/menu", LAFPOS, JSON.stringify(change)),
      );
      expect(res.status, field).toBe(403);
      expect(await res.json(), field).toEqual({ error: "forbidden", field });
    }
    for (const fn of Object.values(store)) expect(fn).not.toHaveBeenCalled();
    expect(safeAudit).not.toHaveBeenCalled();
    // The panel's key still moves a price, as before
    store.setMenuItemSaleFields.mockResolvedValue(
      menuItem({ priceMinor: 15000 }),
    );
    const panel = await menu.POST(
      signed(
        "/api/panel/menu",
        PANEL,
        JSON.stringify({ id: "mnu-0011", priceMinor: 15000, actor: "Selin" }),
      ),
    );
    expect(panel.status).toBe(200);
    expect(store.setMenuItemSaleFields).toHaveBeenCalledWith("mnu-0011", {
      priceMinor: 15000,
    });
  });

  it("is shut out of the five routes once revoked, with the panel's key still set", async () => {
    vi.stubEnv("LAFPOS_SYNC_SECRET", "");
    for (const [route, call] of Object.entries(ROUTES)) {
      const res = await call(LAFPOS);
      expect(res.status, route).toBe(401);
    }
    for (const fn of READS()) expect(fn).not.toHaveBeenCalled();
  });

  it("refuses its own signature once stale (±300 s), on each route", async () => {
    const stale = (path: string, body?: string) => {
      const url = new URL(path, "https://laffogato.net");
      const method = body === undefined ? "GET" : "POST";
      return new Request(url, {
        method,
        headers: {
          "content-type": "application/json",
          ...signedHeaders(
            LAFPOS,
            method,
            url,
            body ?? "",
            Date.now() - 10 * 60_000,
          ),
        },
        body,
      });
    };
    const answers = [
      await menu.GET(stale("/api/panel/menu")),
      await menu.POST(stale("/api/panel/menu", MENU_CHANGE)),
      await orders.GET(stale("/api/panel/orders")),
      await stage.POST(stale("/api/panel/orders/stage", TAP)),
      await karaoke.GET(stale(KARAOKE_WINDOW)),
    ];
    for (const res of answers) expect(res.status).toBe(401);
    for (const fn of READS()) expect(fn).not.toHaveBeenCalled();
  });
});

describe("LafPOS's karaoke read", () => {
  it("is the panel's whitelist: a first name, the hour, the states, the note, the amount", async () => {
    const res = await ROUTES["GET /api/panel/karaoke"](LAFPOS);
    expect(res.status).toBe(200);
    expect(listReservationsForAdmin).toHaveBeenCalledWith({
      from: "2026-10-26",
      to: "2026-10-26",
      limit: expect.any(Number),
      ascending: true,
    });
    const body = await res.json();
    expect(body).toMatchObject({
      from: "2026-10-26",
      to: "2026-10-26",
      complete: true,
    });
    expect(body.reservations).toEqual([
      {
        id: "krk-0007",
        date: "2026-10-26",
        startHour: 20,
        hours: 2,
        startsAt: "2026-10-26T17:00:00.000Z",
        endsAt: "2026-10-26T19:00:00.000Z",
        guests: 5,
        status: "confirmed",
        paymentStatus: "paid",
        firstName: "Ayşe",
        note: "Doğum günü",
        totalMinor: 200000,
        channel: "web",
        createdAt: "2026-10-20T09:00:00.000Z",
        updatedAt: "2026-10-20T09:05:00.000Z",
        refundMinor: null,
      },
    ]);
    const text = JSON.stringify(body);
    for (const pii of [
      "ayse@example.com",
      "+905551112233",
      "Yılmaz",
      "PNK-1",
    ]) {
      expect(text).not.toContain(pii);
    }
  });

  it("reads Istanbul yesterday to tomorrow, both ends inclusive", async () => {
    const res = await karaoke.GET(
      signed("/api/panel/karaoke?from=2026-10-25&to=2026-10-27", LAFPOS),
    );
    expect(res.status).toBe(200);
    expect(listReservationsForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ from: "2026-10-25", to: "2026-10-27" }),
    );
  });

  it("still gets the till's business day at 00:30, the calendar's yesterday", async () => {
    vi.setSystemTime(new Date("2026-10-26T21:30:00.000Z")); // 00:30 on the 27th
    const res = await karaoke.GET(signed(KARAOKE_WINDOW, LAFPOS));
    expect(res.status).toBe(200);
  });

  it.each([
    ["the day before yesterday", "?from=2026-10-24&to=2026-10-26"],
    ["the day after tomorrow", "?from=2026-10-26&to=2026-10-28"],
    ["a past year", "?from=2025-10-01&to=2026-10-26"],
    ["next month", "?from=2026-11-20&to=2026-11-20"],
    ["no query (yesterday and ninety days on)", ""],
  ])("refuses %s with 403, before reading anything", async (_, query) => {
    const res = await karaoke.GET(signed(`/api/panel/karaoke${query}`, LAFPOS));
    expect(res.status).toBe(403);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(listReservationsForAdmin).not.toHaveBeenCalled();
  });

  it("does not count the panel's value pasted in as LafPOS's", async () => {
    // The panel's link off (a PANEL_URL that is not https): the pasted value
    // is then the only key on offer, and it is not LafPOS's.
    vi.stubEnv("PANEL_URL", "http://ladmin.laffogato.net");
    vi.stubEnv("LAFPOS_SYNC_SECRET", PANEL);
    const pasted = await ROUTES["GET /api/panel/karaoke"](PANEL);
    expect(pasted.status).toBe(503);
    expect(await pasted.json()).toEqual({ error: "not_configured" });
    expect(listReservationsForAdmin).not.toHaveBeenCalled();
    // LafPOS's own value opens it.
    vi.stubEnv("LAFPOS_SYNC_SECRET", LAFPOS);
    expect((await ROUTES["GET /api/panel/karaoke"](LAFPOS)).status).toBe(200);
  });
});

describe("the panel's key, unchanged", () => {
  it("opens the five routes beside LafPOS's key and audits panel:<name>", async () => {
    for (const [route, call] of Object.entries(ROUTES)) {
      expect((await call(PANEL)).status, route).toBe(200);
    }
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "menu_item",
        actor: "panel:Selin",
        payload: { name: "Espresso Macchiato", isActive: false, via: "panel" },
      }),
    );
    expect(store.transitionOrder).toHaveBeenCalledWith(
      "ord-0042",
      "mark_shipped",
      { actor: "panel:Selin", expectStatus: "paid" },
    );
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "order",
        actor: "panel:Selin",
        payload: expect.objectContaining({ via: "panel" }),
      }),
    );
  });

  it("gets the same answers LafPOS gets, version and all", async () => {
    const strip = async (res: Response) => {
      const { now: _now, ...rest } = await res.json();
      return rest;
    };
    for (const route of [
      "GET /api/panel/menu",
      "GET /api/panel/orders",
    ] as const) {
      const panel = await strip(await ROUTES[route](PANEL));
      expect(panel.version, route).toBe(1);
      expect(await strip(await ROUTES[route](LAFPOS)), route).toEqual(panel);
    }
    const route = "GET /api/panel/karaoke";
    const panel = await strip(await ROUTES[route](PANEL));
    expect(panel.reservations, route).toHaveLength(1);
    expect(await strip(await ROUTES[route](LAFPOS)), route).toEqual(panel);
  });

  it("still reads any karaoke window up to 400 days, the ones LafPOS is refused too", async () => {
    for (const [query, from, to] of [
      ["?from=2025-10-01&to=2026-10-26", "2025-10-01", "2026-10-26"],
      ["?from=2026-11-20&to=2026-11-20", "2026-11-20", "2026-11-20"],
      ["", "2026-10-25", "2027-01-23"],
    ]) {
      listReservationsForAdmin.mockClear();
      const res = await karaoke.GET(
        signed(`/api/panel/karaoke${query}`, PANEL),
      );
      expect(res.status, query).toBe(200);
      expect(listReservationsForAdmin, query).toHaveBeenCalledWith(
        expect.objectContaining({ from, to }),
      );
    }
  });

  it("is the only key the karaoke read takes while LafPOS's is unset", async () => {
    vi.stubEnv("LAFPOS_SYNC_SECRET", "");
    expect((await ROUTES["GET /api/panel/karaoke"](PANEL)).status).toBe(200);
    expect((await ROUTES["GET /api/panel/karaoke"](LAFPOS)).status).toBe(401);
  });
});

describe("neither key", () => {
  it.each([
    ["unset", ""],
    ["too short to be one", "k".repeat(31)],
  ])(
    "shuts all five with 503 when LafPOS's key is %s and the panel's is unset",
    async (_, lafposKey) => {
      vi.stubEnv("KARAOKE_SYNC_SECRET", "");
      vi.stubEnv("LAFPOS_SYNC_SECRET", lafposKey);
      for (const [route, call] of Object.entries(ROUTES)) {
        const res = await call(LAFPOS);
        expect(res.status, route).toBe(503);
        expect(await res.json(), route).toEqual({ error: "not_configured" });
      }
      for (const fn of READS()) expect(fn).not.toHaveBeenCalled();
    },
  );
});

describe("the route LafPOS does not get", () => {
  const pull = (secret: string) =>
    sales.GET(signed("/api/panel/sales?month=2026-10", secret));

  it("sales stays the panel's: LafPOS's key is not its", async () => {
    vi.stubEnv("KARAOKE_SYNC_SECRET", "");
    expect((await pull(LAFPOS)).status).toBe(503);
    vi.stubEnv("KARAOKE_SYNC_SECRET", PANEL);
    expect((await pull(LAFPOS)).status).toBe(401);
    expect(store.listPanelSalesOrderRows).not.toHaveBeenCalled();
    expect(store.listPanelSalesBookingRows).not.toHaveBeenCalled();
  });
});

describe("the route the panel does not get: the table list", () => {
  const TABLES = JSON.stringify({
    tables: [{ code: "K7Q2M9X4TB", name: "Bahçe 3", active: true }],
    actor: "LafPOS",
  });
  const put = (secret: string) =>
    tables.PUT(signed("/api/panel/tables", secret, TABLES, "PUT"));

  it("opens to LafPOS's key alone; the panel's is 401, none is 503", async () => {
    const mine = await put(LAFPOS);
    expect(mine.status).toBe(200);
    expect(await mine.json()).toEqual({
      ok: true,
      count: 1,
      created: 0,
      updated: 0,
      unchanged: 1,
    });
    expect(cafeTables.importCafeTables).toHaveBeenCalledWith([
      { code: "K7Q2M9X4TB", name: "Bahçe 3", active: true },
    ]);
    cafeTables.importCafeTables.mockClear();
    expect((await put(PANEL)).status).toBe(401);
    vi.stubEnv("LAFPOS_SYNC_SECRET", "");
    const shut = await put(LAFPOS);
    expect(shut.status).toBe(503);
    expect(await shut.json()).toEqual({ error: "not_configured" });
    expect(cafeTables.importCafeTables).not.toHaveBeenCalled();
  });
});

describe("how the panel shows a LafPOS change", () => {
  it("reads lafpos:<name> as LafPOS · <name>, on the audit log and the order's timeline", () => {
    expect(auditActorLabel("lafpos:Selin")).toBe("LafPOS · Selin");
    expect(auditActorLabel("panel:Selin")).toBe("Yönetim paneli · Selin");
    const items = orderTimeline(
      {
        createdAt: "2026-10-26T09:00:00.000Z",
        refunds: [],
        fulfillment: "pickup",
        source: "app",
      },
      [
        {
          id: "1",
          actor: "lafpos:Selin",
          action: "transition",
          entity: "order",
          entityId: "ord-0042",
          payload: {
            transition: "mark_shipped",
            from: "paid",
            to: "shipped",
            via: "lafpos",
          },
          createdAt: "2026-10-26T09:05:00.000Z",
        },
      ],
      [],
    );
    expect(items.find((i) => i.id === "aud-1")?.actor).toBe("LafPOS · Selin");
  });
});
