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
 * own (docs/LAFPOS.md): `LAFPOS_SYNC_SECRET` opens the menu read and write
 * and the bar screen's read and stage beside the panel's
 * `KARAOKE_SYNC_SECRET`, so the panel's key never sits on the café's
 * machine. What is pinned: LafPOS's signature opens each of the four
 * routes, its writes are audited "lafpos:<name>", the panel's requests are
 * answered exactly as before, a route with neither key is shut, and the
 * karaoke and sales routes stay the panel's alone.
 */

const store = vi.hoisted(() => ({
  getMenuItemForPanel: vi.fn(),
  listMenuItemsForPanel: vi.fn(),
  setMenuItemSaleFields: vi.fn(),
  markMenuPricesChanged: vi.fn(),
  listPanelOpenOrderRows: vi.fn(),
  getOrder: vi.fn(),
  transitionOrder: vi.fn(),
  listPanelSalesOrderRows: vi.fn(),
  listPanelSalesBookingRows: vi.fn(),
}));
const safeAudit = vi.hoisted(() => vi.fn());
const listReservationsForAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/store", () => ({
  ...store,
  MENU_CATEGORY_KEYS: ["espresso"],
  MENU_CATEGORY_LABELS: { espresso: "Espresso" },
}));
vi.mock("@/lib/admin/audit", () => ({ safeAudit }));
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

const PANEL = "panel-secret-0123456789-abcdefghijklmnop";
const LAFPOS = "lafpos-secret-0123456789-abcdefghijklmno";

/** A request signed with `secret`: a GET, or a POST of `body`. */
function signed(path: string, secret: string, body?: string): Request {
  const url = new URL(path, "https://laffogato.net");
  const method = body === undefined ? "GET" : "POST";
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...signedHeaders(secret, method, url, body ?? "", Date.now()),
    },
    body,
  });
}

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

/** The four routes, each as LafPOS (or the panel) calls it. */
const ROUTES = {
  "GET /api/panel/menu": (secret: string) =>
    menu.GET(signed("/api/panel/menu", secret)),
  "POST /api/panel/menu": (secret: string) =>
    menu.POST(signed("/api/panel/menu", secret, MENU_CHANGE)),
  "GET /api/panel/orders": (secret: string) =>
    orders.GET(signed("/api/panel/orders", secret)),
  "POST /api/panel/orders/stage": (secret: string) =>
    stage.POST(signed("/api/panel/orders/stage", secret, TAP)),
};

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
  vi.stubEnv("KARAOKE_SYNC_SECRET", PANEL);
  vi.stubEnv("LAFPOS_SYNC_SECRET", LAFPOS);
  vi.stubEnv("PANEL_URL", "");
  for (const fn of [
    ...Object.values(store),
    safeAudit,
    listReservationsForAdmin,
  ]) {
    fn.mockReset();
  }
  store.listMenuItemsForPanel.mockResolvedValue([menuItem()]);
  store.getMenuItemForPanel.mockResolvedValue(menuItem());
  store.setMenuItemSaleFields.mockResolvedValue(menuItem({ isActive: false }));
  store.markMenuPricesChanged.mockResolvedValue(undefined);
  store.listPanelOpenOrderRows.mockResolvedValue([order()]);
  store.getOrder.mockResolvedValue(order());
  store.transitionOrder.mockResolvedValue({
    ok: true,
    order: order({ status: "shipped", shippedAt: new Date().toISOString() }),
  });
  safeAudit.mockResolvedValue(true);
});

afterEach(() => {
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

describe("LafPOS's key on the four routes", () => {
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
    for (const fn of Object.values(store)) expect(fn).not.toHaveBeenCalled();
  });
});

describe("the panel's key, unchanged", () => {
  it("opens the four routes beside LafPOS's key and audits panel:<name>", async () => {
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
  });
});

describe("neither key", () => {
  it.each([
    ["unset", ""],
    ["too short to be one", "k".repeat(31)],
  ])(
    "shuts all four with 503 when LafPOS's key is %s and the panel's is unset",
    async (_, lafposKey) => {
      vi.stubEnv("KARAOKE_SYNC_SECRET", "");
      vi.stubEnv("LAFPOS_SYNC_SECRET", lafposKey);
      for (const [route, call] of Object.entries(ROUTES)) {
        const res = await call(LAFPOS);
        expect(res.status, route).toBe(503);
        expect(await res.json(), route).toEqual({ error: "not_configured" });
      }
      for (const fn of Object.values(store)) expect(fn).not.toHaveBeenCalled();
    },
  );
});

describe("the routes LafPOS does not get", () => {
  const pulls = (secret: string) => [
    karaoke.GET(signed("/api/panel/karaoke", secret)),
    sales.GET(signed("/api/panel/sales?month=2026-10", secret)),
  ];

  it("karaoke and sales stay the panel's: LafPOS's key is not theirs", async () => {
    vi.stubEnv("KARAOKE_SYNC_SECRET", "");
    for (const res of await Promise.all(pulls(LAFPOS))) {
      expect(res.status).toBe(503);
    }
    vi.stubEnv("KARAOKE_SYNC_SECRET", PANEL);
    for (const res of await Promise.all(pulls(LAFPOS))) {
      expect(res.status).toBe(401);
    }
    expect(listReservationsForAdmin).not.toHaveBeenCalled();
    expect(store.listPanelSalesOrderRows).not.toHaveBeenCalled();
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
