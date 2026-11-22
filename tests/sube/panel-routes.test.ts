import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { istanbulDayOf, signedHeaders } from "@/lib/panel/karaoke-sync-core";

// İmzalı uçlar şubeye göre (docs/LAFPOS.md "Şube"). Veri katmanı taklit:
// uçların hangi şube adına okuduğu ve yazdığı denetlenir.

const store = vi.hoisted(() => ({
  countPanelAwaitingPaymentOrders: vi.fn(),
  listPanelOpenOrderRows: vi.fn(),
  getOrder: vi.fn(),
  transitionOrder: vi.fn(),
  getMenuItemForPanel: vi.fn(),
  listMenuItemsForPanel: vi.fn(),
  setMenuItemSaleFields: vi.fn(),
  markMenuPricesChanged: vi.fn(),
  MENU_CATEGORY_KEYS: ["espresso", "dessert"],
  MENU_CATEGORY_LABELS: { espresso: "Espresso", dessert: "Tatlılar" },
}));
const calls = vi.hoisted(() => ({
  listOpenTableCalls: vi.fn(),
  ackTableCall: vi.fn(),
}));
const availability = vi.hoisted(() => ({
  getBranchAvailability: vi.fn(),
  listBranchAvailability: vi.fn(),
  writeBranchAvailability: vi.fn(),
}));
const tables = vi.hoisted(() => ({ importCafeTables: vi.fn() }));
const karaoke = vi.hoisted(() => ({ listReservationsForAdmin: vi.fn() }));
const audit = vi.hoisted(() => ({ safeAudit: vi.fn() }));

vi.mock("@/lib/admin/store", () => store);
vi.mock("@/lib/admin/table-calls", () => calls);
vi.mock("@/lib/admin/menu-availability", () => availability);
vi.mock("@/lib/admin/cafe-tables", () => tables);
vi.mock("@/lib/mobile/karaoke", () => karaoke);
vi.mock("@/lib/admin/audit", () => audit);

const PANEL_KEY = "panel-key-for-tests-0123456789-abcdefghij";
const LAFPOS_KEY = "lafpos-key-for-tests-0123456789-abcdefghij";
const BASE = "https://laffogato.net";

type Who = "panel" | "lafpos";

function signed(
  who: Who,
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: object,
): Request {
  const url = new URL(path, BASE);
  const raw = body === undefined ? "" : JSON.stringify(body);
  const key = who === "panel" ? PANEL_KEY : LAFPOS_KEY;
  return new Request(url, {
    method,
    headers: {
      ...signedHeaders(key, method, url, raw),
      ...(raw ? { "content-type": "application/json" } : {}),
    },
    ...(raw ? { body: raw } : {}),
  });
}

const env = { ...process.env };

beforeEach(() => {
  process.env.KARAOKE_SYNC_SECRET = PANEL_KEY;
  process.env.LAFPOS_SYNC_SECRET = LAFPOS_KEY;
  delete process.env.LAFPOS_BRANCHES;
  delete process.env.SITE_BRANCHES;
  for (const group of [store, calls, availability, tables, karaoke, audit]) {
    for (const fn of Object.values(group)) {
      if (typeof fn === "function" && "mockReset" in fn) fn.mockReset();
    }
  }
  store.countPanelAwaitingPaymentOrders.mockResolvedValue(0);
  store.listPanelOpenOrderRows.mockResolvedValue([]);
  calls.listOpenTableCalls.mockResolvedValue([]);
  availability.listBranchAvailability.mockResolvedValue(new Map());
  availability.getBranchAvailability.mockResolvedValue(null);
});

afterEach(() => {
  process.env = { ...env };
});

describe("GET /api/panel/orders", () => {
  it("Marina'nın kasası yalnız Marina'nın siparişini ve çağrısını okur", async () => {
    const { GET } = await import("@/app/api/panel/orders/route");
    const res = await GET(signed("lafpos", "GET", "/api/panel/orders"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branch).toBe("marina");
    expect(store.listPanelOpenOrderRows).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Number),
      expect.any(Object),
      "marina",
    );
    expect(store.countPanelAwaitingPaymentOrders).toHaveBeenCalledWith(
      expect.any(String),
      "marina",
    );
    expect(calls.listOpenTableCalls).toHaveBeenCalledWith(
      expect.any(Date),
      undefined,
      "marina",
    );
  });

  it("köşkün paneli (şube söylemeden) Tuzla'nınkini okur: eski panel aynen", async () => {
    const { GET } = await import("@/app/api/panel/orders/route");
    const res = await GET(signed("panel", "GET", "/api/panel/orders"));
    expect((await res.json()).branch).toBe("tuzla");
    expect(store.listPanelOpenOrderRows.mock.calls[0][3]).toBe("tuzla");
  });

  it("Marina'nın kasası Tuzla'yı isteyemez: 403, hiçbir şey okunmaz", async () => {
    const { GET } = await import("@/app/api/panel/orders/route");
    const res = await GET(
      signed("lafpos", "GET", "/api/panel/orders?branch=tuzla"),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden", field: "branch" });
    expect(store.listPanelOpenOrderRows).not.toHaveBeenCalled();
  });
});

describe("POST /api/panel/orders/stage ve /api/panel/calls/ack", () => {
  const tuzlaOrder = {
    id: "ord-0101",
    orderNo: 101,
    status: "paid",
    kind: "cafe",
    source: "",
    fulfillment: "table",
    tableCode: "K7Q2M9X4TB",
    tableName: "S4",
    totalMinor: 13000,
    items: [],
  };

  it("Marina'nın kasası Tuzla'nın siparişini ilerletemez (409 wrong_branch)", async () => {
    store.getOrder.mockResolvedValue(tuzlaOrder);
    const { POST } = await import("@/app/api/panel/orders/stage/route");
    const res = await POST(
      signed("lafpos", "POST", "/api/panel/orders/stage", {
        id: "ord-0101",
        action: "preparing",
        from: "new",
        actor: "Selin",
      }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "wrong_branch" });
    expect(store.transitionOrder).not.toHaveBeenCalled();
  });

  it("Marina'nın kendi masa siparişi ilerler", async () => {
    store.getOrder.mockResolvedValue({ ...tuzlaOrder, branch: "marina" });
    store.transitionOrder.mockResolvedValue({
      ok: true,
      order: { ...tuzlaOrder, branch: "marina", status: "preparing" },
    });
    const { POST } = await import("@/app/api/panel/orders/stage/route");
    const res = await POST(
      signed("lafpos", "POST", "/api/panel/orders/stage", {
        id: "ord-0101",
        action: "preparing",
        from: "new",
        actor: "Selin",
      }),
    );
    expect(res.status).toBe(200);
    expect(store.transitionOrder).toHaveBeenCalledTimes(1);
  });

  it("Gördüm: çağrı Marina adına yanıtlanır; başka şubeninki 409", async () => {
    calls.ackTableCall.mockResolvedValue({
      ok: false,
      reason: "wrong_branch",
    });
    const { POST } = await import("@/app/api/panel/calls/ack/route");
    const res = await POST(
      signed("lafpos", "POST", "/api/panel/calls/ack", {
        id: "call-1",
        actor: "Selin",
      }),
    );
    expect(res.status).toBe(409);
    expect(calls.ackTableCall).toHaveBeenCalledWith(
      "call-1",
      "lafpos:Selin",
      expect.any(Date),
      "marina",
    );
  });
});

describe("GET /api/panel/karaoke", () => {
  it("oda Tuzla'nın: Marina adına okuma boş döner, veritabanına gidilmez", async () => {
    const { GET } = await import("@/app/api/panel/karaoke/route");
    // LafPOS'un anahtarı yalnız dünden yarına okur: bugünün penceresi.
    const today = istanbulDayOf(new Date());
    const res = await GET(
      signed("lafpos", "GET", `/api/panel/karaoke?from=${today}&to=${today}`),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      branch: "marina",
      complete: true,
      reservations: [],
    });
    expect(karaoke.listReservationsForAdmin).not.toHaveBeenCalled();
  });

  it("panel Tuzla adına okur", async () => {
    karaoke.listReservationsForAdmin.mockResolvedValue([]);
    const { GET } = await import("@/app/api/panel/karaoke/route");
    const res = await GET(signed("panel", "GET", "/api/panel/karaoke"));
    expect((await res.json()).branch).toBe("tuzla");
    expect(karaoke.listReservationsForAdmin).toHaveBeenCalledTimes(1);
  });
});

describe("PUT /api/panel/tables", () => {
  const list = {
    tables: [{ code: "K7Q2M9X4TB", name: "S4", active: true }],
    actor: "LafPOS",
  };

  it("liste LafPOS'un şubesine yazılır", async () => {
    tables.importCafeTables.mockResolvedValue({
      count: 1,
      created: [
        {
          id: "tbl-0009",
          code: "K7Q2M9X4TB",
          name: "S4",
          isActive: true,
          branch: "marina",
        },
      ],
      updated: [],
      unchanged: 0,
    });
    const { PUT } = await import("@/app/api/panel/tables/route");
    const res = await PUT(signed("lafpos", "PUT", "/api/panel/tables", list));
    expect(res.status).toBe(200);
    expect((await res.json()).branch).toBe("marina");
    expect(tables.importCafeTables).toHaveBeenCalledWith(list.tables, "marina");
  });

  it("Tuzla'nın masa koduyla gelen liste 409 wrong_branch, hiçbir şey yazılmaz", async () => {
    tables.importCafeTables.mockResolvedValue({
      wrongBranch: { index: 0, code: "K7Q2M9X4TB" },
    });
    const { PUT } = await import("@/app/api/panel/tables/route");
    const res = await PUT(signed("lafpos", "PUT", "/api/panel/tables", list));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "wrong_branch",
      field: "tables[0].code",
    });
    expect(audit.safeAudit).not.toHaveBeenCalled();
  });
});

describe("/api/panel/menu şubeye göre Satışta / Tükendi", () => {
  const cheesecake = {
    id: "mnu-0059",
    name: "Cheesecake",
    categoryKey: "dessert",
    priceMinor: 18000,
    priceMinorL: 0,
    isActive: true,
    sortOrder: 1,
    updatedAt: "2026-11-20T08:00:00.000Z",
  };

  it("GET: Tuzla'nın Tükendi'si Marina'nın listesinde Satışta kalır (senaryo A)", async () => {
    store.listMenuItemsForPanel.mockResolvedValue([cheesecake]);
    availability.listBranchAvailability.mockImplementation(
      async (branch: string) =>
        branch === "tuzla"
          ? new Map([
              [
                "mnu-0059",
                {
                  menuItemId: "mnu-0059",
                  branch: "tuzla",
                  isActive: false,
                  updatedAt: "2026-11-21T09:00:00.000Z",
                  updatedBy: "panel:Ayşe",
                },
              ],
            ])
          : new Map(),
    );
    const { GET } = await import("@/app/api/panel/menu/route");
    const marina = await (
      await GET(signed("lafpos", "GET", "/api/panel/menu"))
    ).json();
    expect(marina.branch).toBe("marina");
    expect(marina.writes).toEqual({ expect: true, branch: true });
    expect(marina.items[0]).toMatchObject({ isActive: true, onMenu: true });
    const tuzla = await (
      await GET(signed("panel", "GET", "/api/panel/menu"))
    ).json();
    expect(tuzla.items[0]).toMatchObject({
      isActive: false,
      onMenu: true,
      updatedAt: "2026-11-21T09:00:00.000Z",
    });
  });

  it("POST: Marina'nın Tükendi'si yalnız Marina'nın satırını yazar (senaryo B)", async () => {
    store.getMenuItemForPanel.mockResolvedValue(cheesecake);
    availability.writeBranchAvailability.mockResolvedValue({
      ok: true,
      row: {},
    });
    const { POST } = await import("@/app/api/panel/menu/route");
    const res = await POST(
      signed("lafpos", "POST", "/api/panel/menu", {
        id: "mnu-0059",
        isActive: false,
        actor: "Selin",
      }),
    );
    expect(res.status).toBe(200);
    expect(availability.writeBranchAvailability).toHaveBeenCalledWith(
      "mnu-0059",
      "marina",
      false,
      "lafpos:Selin",
      null,
    );
    // Sitenin kendi bayrağına (her şubenin) dokunulmaz.
    expect(store.setMenuItemSaleFields).not.toHaveBeenCalled();
  });

  it("POST: LafPOS menüden kalkanı açamaz (senaryo C, 409 site_closed)", async () => {
    store.getMenuItemForPanel.mockResolvedValue({
      ...cheesecake,
      isActive: false,
    });
    const { POST } = await import("@/app/api/panel/menu/route");
    const res = await POST(
      signed("lafpos", "POST", "/api/panel/menu", {
        id: "mnu-0059",
        isActive: true,
        actor: "Selin",
      }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("site_closed");
    expect(store.setMenuItemSaleFields).not.toHaveBeenCalled();
    expect(availability.writeBranchAvailability).not.toHaveBeenCalled();
  });

  it("POST: panel menüden kalkanı geri koyar (önceki yetkisi)", async () => {
    store.getMenuItemForPanel.mockResolvedValue({
      ...cheesecake,
      isActive: false,
    });
    store.setMenuItemSaleFields.mockResolvedValue({
      ...cheesecake,
      isActive: true,
    });
    const { POST } = await import("@/app/api/panel/menu/route");
    const res = await POST(
      signed("panel", "POST", "/api/panel/menu", {
        id: "mnu-0059",
        isActive: true,
        actor: "Ayşe",
      }),
    );
    expect(res.status).toBe(200);
    expect(store.setMenuItemSaleFields).toHaveBeenCalledWith(
      "mnu-0059",
      { isActive: true },
      { isActive: false },
    );
  });

  it("POST: LafPOS başka şube adına yazamaz, fiyat yazamaz", async () => {
    const { POST } = await import("@/app/api/panel/menu/route");
    const other = await POST(
      signed("lafpos", "POST", "/api/panel/menu", {
        id: "mnu-0059",
        isActive: false,
        actor: "Selin",
        branch: "tuzla",
      }),
    );
    expect(other.status).toBe(403);
    expect(await other.json()).toEqual({ error: "forbidden", field: "branch" });
    const price = await POST(
      signed("lafpos", "POST", "/api/panel/menu", {
        id: "mnu-0059",
        priceMinor: 1,
        actor: "Selin",
      }),
    );
    expect(price.status).toBe(403);
    expect(store.getMenuItemForPanel).not.toHaveBeenCalled();
  });
});
