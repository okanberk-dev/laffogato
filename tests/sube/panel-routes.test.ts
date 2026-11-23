import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { istanbulDayOf, signedHeaders } from "@/lib/panel/karaoke-sync-core";

// İmzalı uçlar şubeye göre (docs/LAFPOS.md "Şube"). Veri katmanı taklit:
// uçların hangi şube adına okuduğu ve yazdığı denetlenir.

const store = vi.hoisted(() => ({
  countPanelAwaitingPaymentOrders: vi.fn(),
  listPanelOpenOrderRows: vi.fn(),
  listPanelClosedOrderRows: vi.fn(),
  listPanelTillPaidOrderIds: vi.fn(),
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
  store.listPanelClosedOrderRows.mockResolvedValue([]);
  store.listPanelTillPaidOrderIds.mockResolvedValue(new Set());
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
    expect(store.listPanelClosedOrderRows).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      200,
      "marina",
    );
    expect(body.closed).toEqual([]);
  });

  it("kasada ödenen, satırın konumu ve akıştan çıkanların sonucu (23 Kas 2026)", async () => {
    const paidAt = new Date(Date.now() - 10 * 60_000).toISOString();
    const order = {
      id: "ord-0301",
      orderNo: 301,
      status: "paid",
      kind: "cafe",
      source: "app",
      fulfillment: "table",
      tableCode: "M4R1N4T4BL",
      tableName: "M2",
      customerName: "Ada Yılmaz",
      scheduledFor: "",
      paidAt,
      shippedAt: "",
      deliveryNote: "",
      totalMinor: 30000,
      items: [
        { productName: "Latte", qty: 1, status: "cancelled" },
        { productName: "Affogato", qty: 2 },
      ],
    };
    store.listPanelOpenOrderRows.mockResolvedValue([order]);
    store.listPanelTillPaidOrderIds.mockResolvedValue(new Set(["ord-0301"]));
    const closed = (id: string, status: string, extra: object = {}) => ({
      id,
      status,
      kind: "cafe",
      source: "",
      fulfillment: "table",
      paidAt,
      ...extra,
    });
    store.listPanelClosedOrderRows.mockResolvedValue([
      closed("ord-0302", "completed"),
      closed("ord-0303", "shipped"),
      closed("ord-0304", "cancelled"),
      closed("ord-0305", "refunded"),
      // Gel-al "Hazır": hâlâ ekranda, sonucu yok.
      closed("ord-0306", "shipped", { fulfillment: "pickup" }),
      // Ödenmeden iptal: ekrana hiç düşmedi.
      closed("ord-0307", "cancelled", { paidAt: "" }),
      // Panelden elle girilen ve mağaza kolisi: ekranın değil.
      closed("ord-0308", "completed", { source: "manual" }),
      closed("ord-0309", "completed", { fulfillment: "shipping" }),
      // İki okuma arasında kapandı: açık listede, `closed`'da değil.
      closed("ord-0301", "completed"),
    ]);
    const { GET } = await import("@/app/api/panel/orders/route");
    const res = await GET(signed("lafpos", "GET", "/api/panel/orders"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(store.listPanelTillPaidOrderIds).toHaveBeenCalledWith(["ord-0301"]);
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0].paidAtTill).toBe(true);
    // İptal edilen satır düşer, kalanın konumu `items`'taki yeridir.
    expect(body.orders[0].lines).toEqual([
      expect.objectContaining({ name: "Affogato", qty: 2, index: 1 }),
    ]);
    expect(body.closed).toEqual([
      { id: "ord-0302", outcome: "completed" },
      { id: "ord-0303", outcome: "completed" },
      { id: "ord-0304", outcome: "cancelled" },
      { id: "ord-0305", outcome: "refunded" },
    ]);
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

  it("Marina'nın kendi masa siparişi ilerler; yanıt ekranın biçiminde", async () => {
    store.listPanelTillPaidOrderIds.mockResolvedValue(new Set(["ord-0101"]));
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
    expect(store.listPanelTillPaidOrderIds).toHaveBeenCalledWith(["ord-0101"]);
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
