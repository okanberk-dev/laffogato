import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { istanbulDayOf, signedHeaders } from "@/lib/panel/karaoke-sync-core";

// Anahtar değişimi uç uç (docs/LAFPOS.md "Anahtarı değiştirmek"). 26 Kas
// 2026'da LafPOS'un site anahtarı panelden kasaya dağıtıldı, kasa onu gün
// sonunda uyguladı, sitede ise eski değer duruyordu: kasanın her isteği
// reddedildi. Sitede önceki değer (`LAFPOS_SYNC_SECRET_ONCEKI`) dururken kasa
// değişimin iki yanında da çalışır; önceki değer LafPOS'a başka bir yetki
// vermez. Veri katmanı taklit (tests/sube/panel-routes.test.ts gibi).

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
const branchPrices = vi.hoisted(() => ({
  listBranchPrices: vi.fn(),
  insertBranchPrice: vi.fn(),
  deleteFutureBranchPrice: vi.fn(),
}));
const tables = vi.hoisted(() => ({ importCafeTables: vi.fn() }));
const karaoke = vi.hoisted(() => ({ listReservationsForAdmin: vi.fn() }));
const audit = vi.hoisted(() => ({ safeAudit: vi.fn() }));

vi.mock("@/lib/admin/store", () => store);
vi.mock("@/lib/admin/table-calls", () => calls);
vi.mock("@/lib/admin/menu-availability", () => availability);
vi.mock("@/lib/admin/menu-branch-prices", () => branchPrices);
vi.mock("@/lib/admin/cafe-tables", () => tables);
vi.mock("@/lib/mobile/karaoke", () => karaoke);
vi.mock("@/lib/admin/audit", () => audit);

const PANEL_KEY = "panel-key-for-tests-0123456789-abcdefghij";
const NEW_KEY = "lafpos-new-key-for-tests-0123456789-abcdefghij";
const OLD_KEY = "lafpos-old-key-for-tests-0123456789-abcdefghij";
const BASE = "https://laffogato.net";

function signed(
  key: string,
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: object,
): Request {
  const url = new URL(path, BASE);
  const raw = body === undefined ? "" : JSON.stringify(body);
  return new Request(url, {
    method,
    headers: {
      ...signedHeaders(key, method, url, raw),
      ...(raw ? { "content-type": "application/json" } : {}),
    },
    ...(raw ? { body: raw } : {}),
  });
}

/** Sitenin Vercel'deki değişkenleri; `undefined` silinmiş demek. */
function siteEnv(values: {
  current?: string;
  previous?: string;
  panel?: string;
}) {
  for (const [name, value] of [
    ["LAFPOS_SYNC_SECRET", values.current],
    ["LAFPOS_SYNC_SECRET_ONCEKI", values.previous],
    ["KARAOKE_SYNC_SECRET", values.panel ?? PANEL_KEY],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

const env = { ...process.env };

beforeEach(() => {
  siteEnv({ current: NEW_KEY, previous: OLD_KEY });
  delete process.env.LAFPOS_BRANCHES;
  delete process.env.SITE_BRANCHES;
  for (const group of [
    store,
    calls,
    availability,
    branchPrices,
    tables,
    karaoke,
    audit,
  ]) {
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
  branchPrices.listBranchPrices.mockResolvedValue([]);
});

afterEach(() => {
  process.env = { ...env };
});

async function version(key: string): Promise<number> {
  const { GET } = await import("@/app/api/pos/orders/version/route");
  return (await GET(signed(key, "GET", "/api/pos/orders/version"))).status;
}

describe("GET /api/pos/orders/version: değişimin sırası", () => {
  it("27 Kas 2026: sitede yalnız eski değer varken kasanın yeni değeri 401", async () => {
    siteEnv({ current: OLD_KEY });
    expect(await version(NEW_KEY)).toBe(401);
    expect(await version(OLD_KEY)).toBe(200);
  });

  it("sitede iki değer: kasa gün sonundan önce (eski) de sonra (yeni) da 200", async () => {
    expect(await version(OLD_KEY)).toBe(200);
    expect(await version(NEW_KEY)).toBe(200);
  });

  it("kasa yeni değere geçip önceki değer silinince: yeni 200, eski 401", async () => {
    siteEnv({ current: NEW_KEY });
    expect(await version(NEW_KEY)).toBe(200);
    expect(await version(OLD_KEY)).toBe(401);
  });

  it("panelin anahtarı önceki değer olarak girilse de sürüm ucunu açmaz", async () => {
    siteEnv({ current: NEW_KEY, previous: PANEL_KEY });
    expect(await version(PANEL_KEY)).toBe(401);
    expect(await version(NEW_KEY)).toBe(200);
  });

  it("yalnız önceki değer kalmışsa LafPOS kapalı: 503 not_configured", async () => {
    siteEnv({ previous: OLD_KEY });
    const { GET } = await import("@/app/api/pos/orders/version/route");
    const res = await GET(signed(OLD_KEY, "GET", "/api/pos/orders/version"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
  });
});

describe("önceki değer LafPOS'un yetkisiyle sınırlı", () => {
  it("menü: Tükendi Marina'nın satırına lafpos:<ad> diye yazılır, fiyat 403", async () => {
    store.getMenuItemForPanel.mockResolvedValue({
      id: "mnu-0059",
      name: "Cheesecake",
      categoryKey: "dessert",
      priceMinor: 18000,
      priceMinorL: 0,
      isActive: true,
      sortOrder: 1,
      updatedAt: "2026-11-20T08:00:00.000Z",
    });
    availability.writeBranchAvailability.mockResolvedValue({
      ok: true,
      row: {},
    });
    const { POST } = await import("@/app/api/panel/menu/route");
    const soldOut = await POST(
      signed(OLD_KEY, "POST", "/api/panel/menu", {
        id: "mnu-0059",
        isActive: false,
        actor: "Selin",
      }),
    );
    expect(soldOut.status).toBe(200);
    expect(availability.writeBranchAvailability).toHaveBeenCalledWith(
      "mnu-0059",
      "marina",
      false,
      "lafpos:Selin",
      null,
    );
    const price = await POST(
      signed(OLD_KEY, "POST", "/api/panel/menu", {
        id: "mnu-0059",
        priceMinor: 1,
        actor: "Selin",
      }),
    );
    expect(price.status).toBe(403);
    expect(store.setMenuItemSaleFields).not.toHaveBeenCalled();
  });

  it("karaoke: yalnız dünden yarına, Marina adına; daha geniş pencere 403", async () => {
    const { GET } = await import("@/app/api/panel/karaoke/route");
    const today = istanbulDayOf(new Date());
    const window = await GET(
      signed(OLD_KEY, "GET", `/api/panel/karaoke?from=${today}&to=${today}`),
    );
    expect(window.status).toBe(200);
    expect((await window.json()).branch).toBe("marina");
    const wide = await GET(signed(OLD_KEY, "GET", "/api/panel/karaoke"));
    expect(wide.status).toBe(403);
    expect(karaoke.listReservationsForAdmin).not.toHaveBeenCalled();
  });

  it("Gördüm: çağrı lafpos:<ad> diye, Marina adına yanıtlanır", async () => {
    calls.ackTableCall.mockResolvedValue({
      ok: false,
      reason: "wrong_branch",
    });
    const { POST } = await import("@/app/api/panel/calls/ack/route");
    const res = await POST(
      signed(OLD_KEY, "POST", "/api/panel/calls/ack", {
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

  it("siparişler: önceki değerle okuma Marina'nın", async () => {
    const { GET } = await import("@/app/api/panel/orders/route");
    const res = await GET(signed(OLD_KEY, "GET", "/api/panel/orders"));
    expect(res.status).toBe(200);
    expect((await res.json()).branch).toBe("marina");
  });
});
