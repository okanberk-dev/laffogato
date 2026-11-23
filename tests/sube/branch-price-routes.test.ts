import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signedHeaders } from "@/lib/panel/karaoke-sync-core";

// Şube fiyatı uçlarda (docs/PANEL-MENU.md "Şube fiyatı"): imzalı menü okuması
// şubenin şu an geçerli fiyatını verir, köşkün paneli `branchPrice` ile yazar,
// LafPOS yazamaz; uygulamanın menüsü `?branch=` ile şubenin fiyatını okur.
// Veri katmanı taklit.

const store = vi.hoisted(() => ({
  getMenuItemForPanel: vi.fn(),
  listMenuItemsForPanel: vi.fn(),
  setMenuItemSaleFields: vi.fn(),
  markMenuPricesChanged: vi.fn(),
  listMenuItems: vi.fn(),
  getSettings: vi.fn(),
  MENU_CATEGORY_KEYS: ["espresso", "dessert"],
  MENU_CATEGORY_LABELS: { espresso: "Espresso", dessert: "Tatlılar" },
}));
const availability = vi.hoisted(() => ({
  getBranchAvailability: vi.fn(),
  listBranchAvailability: vi.fn(),
  writeBranchAvailability: vi.fn(),
}));
const prices = vi.hoisted(() => ({
  listBranchPrices: vi.fn(),
  insertBranchPrice: vi.fn(),
  deleteFutureBranchPrice: vi.fn(),
}));
const audit = vi.hoisted(() => ({ safeAudit: vi.fn() }));

vi.mock("@/lib/admin/store", () => store);
vi.mock("@/lib/admin/menu-availability", () => availability);
vi.mock("@/lib/admin/menu-branch-prices", () => prices);
vi.mock("@/lib/admin/audit", () => audit);

const PANEL_KEY = "panel-key-for-tests-0123456789-abcdefghij";
const LAFPOS_KEY = "lafpos-key-for-tests-0123456789-abcdefghij";
const BASE = "https://laffogato.net";
const NOW = Date.parse("2026-11-24T09:00:00.000Z");
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

function signed(
  who: "panel" | "lafpos",
  method: "GET" | "POST",
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

const latte = {
  id: "mnu-0007",
  name: "Latte",
  categoryKey: "espresso",
  priceMinor: 13000,
  priceMinorL: 15000,
  isActive: true,
  sortOrder: 1,
  updatedAt: "2026-11-20T08:00:00.000Z",
};
const cake = {
  id: "mnu-0059",
  name: "Cheesecake",
  categoryKey: "dessert",
  priceMinor: 18000,
  priceMinorL: 0,
  isActive: true,
  sortOrder: 1,
  updatedAt: "2026-11-20T08:00:00.000Z",
};

const priceRow = (
  effectiveFrom: string,
  priceMinor: number | null,
  priceMinorL = 0,
  menuItemId = "mnu-0007",
  branch = "marina",
) => ({
  menuItemId,
  branch,
  priceMinor,
  priceMinorL,
  effectiveFrom,
  createdAt: "2026-11-23T10:00:00.000Z",
  createdBy: "panel:Ayşe",
});

/** Marina: latte 145/165 dünden beri, 150/170 yarın; cheesecake satırsız. */
const IN_FORCE = priceRow(iso(NOW - 24 * HOUR), 14500, 16500);
const TOMORROW = priceRow(iso(NOW + 20 * HOUR), 15000, 17000);

/** Panelin gördüğü satır: yazanın adı (`createdBy`) siteden çıkmaz. */
const panelRow = (row: ReturnType<typeof priceRow>) => ({
  id: row.menuItemId,
  branch: row.branch,
  priceMinor: row.priceMinor,
  priceMinorL: row.priceMinorL,
  effectiveFrom: row.effectiveFrom,
  createdAt: row.createdAt,
});

const env = { ...process.env };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  process.env.KARAOKE_SYNC_SECRET = PANEL_KEY;
  process.env.LAFPOS_SYNC_SECRET = LAFPOS_KEY;
  delete process.env.LAFPOS_BRANCHES;
  delete process.env.SITE_BRANCHES;
  for (const group of [store, availability, prices, audit]) {
    for (const fn of Object.values(group)) {
      if (typeof fn === "function" && "mockReset" in fn) fn.mockReset();
    }
  }
  store.listMenuItemsForPanel.mockResolvedValue([latte, cake]);
  store.getMenuItemForPanel.mockImplementation(async (id: string) =>
    id === latte.id ? latte : id === cake.id ? cake : null,
  );
  availability.listBranchAvailability.mockResolvedValue(new Map());
  availability.getBranchAvailability.mockResolvedValue(null);
  prices.listBranchPrices.mockImplementation(
    async (branch?: string, ids?: string[]) =>
      [IN_FORCE, TOMORROW].filter(
        (r) =>
          (branch === undefined || r.branch === branch) &&
          (!ids || ids.includes(r.menuItemId)),
      ),
  );
});

afterEach(() => {
  vi.useRealTimers();
  process.env = { ...env };
});

describe("GET /api/panel/menu şubenin fiyatıyla", () => {
  it("Marina'nın kasası: şu an geçerli fiyat, taban, başlangıç ve sonraki an; satır listesi yok", async () => {
    const { GET } = await import("@/app/api/panel/menu/route");
    const res = await GET(signed("lafpos", "GET", "/api/panel/menu"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.branch).toBe("marina");
    expect(body.writes).toEqual({
      expect: true,
      branch: true,
      branchPrice: true,
    });
    const byId = new Map(
      (body.items as { id: string }[]).map((i) => [i.id, i]),
    );
    expect(byId.get("mnu-0007")).toEqual({
      id: "mnu-0007",
      name: "Latte",
      categoryKey: "espresso",
      categoryLabel: "Espresso",
      priceMinor: 14500,
      priceMinorL: 16500,
      basePriceMinor: 13000,
      basePriceMinorL: 15000,
      priceFrom: IN_FORCE.effectiveFrom,
      isActive: true,
      onMenu: true,
      sortOrder: 1,
      updatedAt: latte.updatedAt,
    });
    expect(byId.get("mnu-0059")).toMatchObject({
      priceMinor: 18000,
      priceMinorL: 0,
      basePriceMinor: 18000,
      basePriceMinorL: 0,
      priceFrom: null,
    });
    expect(body.nextPriceAt).toBe(TOMORROW.effectiveFrom);
    expect(body.branchPrices).toBeUndefined();
    expect(prices.listBranchPrices).toHaveBeenCalledWith("marina");
  });

  it("köşkün paneli şube söylemeden (Tuzla): kalemler aynen taban, yanında bütün şube satırları", async () => {
    const { GET } = await import("@/app/api/panel/menu/route");
    const body = await (
      await GET(signed("panel", "GET", "/api/panel/menu"))
    ).json();
    expect(body.branch).toBe("tuzla");
    const item = (body.items as { id: string }[]).find(
      (i) => i.id === "mnu-0007",
    );
    // Tuzla'nın okuması değişmedi: aynı on alan, taban fiyat.
    expect(item).toEqual({
      id: "mnu-0007",
      name: "Latte",
      categoryKey: "espresso",
      categoryLabel: "Espresso",
      priceMinor: 13000,
      priceMinorL: 15000,
      isActive: true,
      onMenu: true,
      sortOrder: 1,
      updatedAt: latte.updatedAt,
    });
    expect(body).not.toHaveProperty("nextPriceAt");
    // Satırlar beyaz listeden: yazanın adı gitmez.
    expect(body.branchPrices).toEqual([
      {
        id: "mnu-0007",
        branch: "marina",
        priceMinor: 14500,
        priceMinorL: 16500,
        effectiveFrom: IN_FORCE.effectiveFrom,
        createdAt: IN_FORCE.createdAt,
      },
      {
        id: "mnu-0007",
        branch: "marina",
        priceMinor: 15000,
        priceMinorL: 17000,
        effectiveFrom: TOMORROW.effectiveFrom,
        createdAt: TOMORROW.createdAt,
      },
    ]);
    expect(prices.listBranchPrices).toHaveBeenCalledWith();
  });

  it("panel Marina adına okuyunca ikisi birden: şubenin fiyatı ve satırlar", async () => {
    const { GET } = await import("@/app/api/panel/menu/route");
    const body = await (
      await GET(signed("panel", "GET", "/api/panel/menu?branch=marina"))
    ).json();
    expect(body.branch).toBe("marina");
    expect(
      (body.items as { id: string; priceMinor: number }[]).find(
        (i) => i.id === "mnu-0007",
      )?.priceMinor,
    ).toBe(14500);
    expect(body.nextPriceAt).toBe(TOMORROW.effectiveFrom);
    expect(body.branchPrices).toHaveLength(2);
  });

  it("şubenin satırı yoksa sonraki an null", async () => {
    prices.listBranchPrices.mockResolvedValue([]);
    const { GET } = await import("@/app/api/panel/menu/route");
    const body = await (
      await GET(signed("lafpos", "GET", "/api/panel/menu"))
    ).json();
    expect(body.nextPriceAt).toBeNull();
    expect(body.items[0].priceFrom).toBeNull();
  });
});

describe("POST /api/panel/menu branchPrice", () => {
  const at = iso(NOW + 20 * HOUR + 3 * HOUR); // yarın 05:00 İstanbul gibi
  const write = (extra: object = {}) => ({
    id: "mnu-0007",
    branch: "marina",
    actor: "Ayşe",
    branchPrice: { priceMinor: 15500, priceMinorL: 17500, effectiveFrom: at },
    ...extra,
  });

  async function post(who: "panel" | "lafpos", body: object) {
    const { POST } = await import("@/app/api/panel/menu/route");
    const res = await POST(signed(who, "POST", "/api/panel/menu", body));
    return { status: res.status, body: await res.json() };
  }

  function nothingWritten() {
    expect(prices.insertBranchPrice).not.toHaveBeenCalled();
    expect(prices.deleteFutureBranchPrice).not.toHaveBeenCalled();
    expect(store.setMenuItemSaleFields).not.toHaveBeenCalled();
    expect(audit.safeAudit).not.toHaveBeenCalled();
  }

  it("panel Marina'ya yarından geçerli fiyat yazar: satır, olay kaydı, yanıt şubenin görünümü", async () => {
    prices.insertBranchPrice.mockImplementation(async (row: object) => ({
      ok: true,
      row,
    }));
    const res = await post(
      "panel",
      write({
        branchPrice: {
          priceMinor: 15500,
          priceMinorL: 17500,
          // İstanbul saatiyle gelir, UTC saklanır.
          effectiveFrom: "2026-11-25T08:00:00+03:00",
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(prices.insertBranchPrice).toHaveBeenCalledWith({
      menuItemId: "mnu-0007",
      branch: "marina",
      priceMinor: 15500,
      priceMinorL: 17500,
      effectiveFrom: "2026-11-25T05:00:00.000Z",
      createdAt: iso(NOW),
      createdBy: "panel:Ayşe",
    });
    expect(audit.safeAudit).toHaveBeenCalledWith({
      action: "update",
      entity: "menu_item",
      entityId: "mnu-0007",
      actor: "panel:Ayşe",
      payload: {
        name: "Latte",
        branch: "marina",
        branchPrice: {
          cancel: false,
          priceMinor: 15500,
          priceMinorL: 17500,
          effectiveFrom: "2026-11-25T05:00:00.000Z",
        },
        via: "panel",
      },
    });
    // Tabana, Satışta'ya ve fiyat listesi tarihine dokunulmaz.
    expect(store.setMenuItemSaleFields).not.toHaveBeenCalled();
    expect(availability.writeBranchAvailability).not.toHaveBeenCalled();
    expect(store.markMenuPricesChanged).not.toHaveBeenCalled();
    expect(res.body.item).toMatchObject({
      id: "mnu-0007",
      priceMinor: 14500,
      basePriceMinor: 13000,
      priceFrom: IN_FORCE.effectiveFrom,
    });
    expect(res.body.branchPrices).toHaveLength(2);
  });

  it("tabana dönüş (priceMinor null) ve tek boylu kalemde L'siz fiyat", async () => {
    prices.insertBranchPrice.mockImplementation(async (row: object) => ({
      ok: true,
      row,
    }));
    expect(
      (
        await post(
          "panel",
          write({ branchPrice: { priceMinor: null, effectiveFrom: at } }),
        )
      ).status,
    ).toBe(200);
    expect(prices.insertBranchPrice.mock.calls[0][0]).toMatchObject({
      priceMinor: null,
      priceMinorL: 0,
    });
    expect(
      (
        await post(
          "panel",
          write({
            id: "mnu-0059",
            branchPrice: { priceMinor: 19000, effectiveFrom: at },
          }),
        )
      ).status,
    ).toBe(200);
  });

  it("LafPOS fiyat yazamaz: 403, hiçbir şey okunmaz", async () => {
    const res = await post("lafpos", write());
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "forbidden", field: "branchPrice" });
    expect(store.getMenuItemForPanel).not.toHaveBeenCalled();
    nothingWritten();
  });

  it("Tuzla'nın (ana şube) fiyatı kalemin kendisidir: 400 branch", async () => {
    const { branch: _omit, ...noBranch } = write();
    void _omit;
    for (const body of [noBranch, write({ branch: "tuzla" })]) {
      const res = await post("panel", body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "invalid", field: "branch" });
    }
    nothingWritten();
  });

  it("taban fiyat, Satışta ya da expect ile birlikte gelmez", async () => {
    expect((await post("panel", write({ priceMinor: 14000 }))).body).toEqual({
      error: "invalid",
      field: "branchPrice",
    });
    expect((await post("panel", write({ isActive: false }))).body).toEqual({
      error: "invalid",
      field: "branchPrice",
    });
    // Panel `expect`'siz bir kez yeniden dener (PANEL-MENU.md "Çakışma").
    expect(
      (await post("panel", write({ expect: { priceMinor: 13000 } }))).body,
    ).toEqual({ error: "invalid", field: "expect" });
    nothingWritten();
  });

  it("geçmişe fiyat yazılmaz, 90 günden ileri de", async () => {
    for (const effectiveFrom of [
      iso(NOW - 10 * 60_000),
      iso(NOW + 91 * 24 * HOUR),
    ]) {
      const res = await post(
        "panel",
        write({ branchPrice: { priceMinor: 15500, effectiveFrom } }),
      );
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: "invalid",
        field: "branchPrice.effectiveFrom",
      });
    }
    // Saat farkı payı: 3 dakika önce geçer.
    prices.insertBranchPrice.mockResolvedValue({ ok: true, row: {} });
    expect(
      (
        await post(
          "panel",
          write({
            branchPrice: {
              priceMinor: 15500,
              effectiveFrom: iso(NOW - 3 * 60_000),
            },
          }),
        )
      ).status,
    ).toBe(200);
  });

  it("seçenek kalemleri (şurup, ekstra shot, alternatif süt) şubeye göre fiyatlanmaz", async () => {
    const res = await post("panel", write({ id: "mnu-0081" }));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "invalid", field: "id" });
    nothingWritten();
  });

  it("tek boylu kaleme L fiyatı: 409 single_size", async () => {
    const res = await post(
      "panel",
      write({
        id: "mnu-0059",
        branchPrice: {
          priceMinor: 19000,
          priceMinorL: 21000,
          effectiveFrom: at,
        },
      }),
    );
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "single_size" });
    nothingWritten();
  });

  it("aynı anda ikinci satır: 409 stale, kalemin şubedeki hâli", async () => {
    prices.insertBranchPrice.mockResolvedValue({ ok: false, reason: "stale" });
    const res = await post("panel", write());
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("stale");
    expect(res.body.item).toMatchObject({ id: "mnu-0007", priceMinor: 14500 });
    expect(audit.safeAudit).not.toHaveBeenCalled();
  });

  it("sitede olmayan kalem 404", async () => {
    const res = await post("panel", write({ id: "mnu-0999" }));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "not_found" });
    nothingWritten();
  });

  it("iptal: yalnız henüz başlamamış satır silinir", async () => {
    prices.deleteFutureBranchPrice.mockResolvedValue(true);
    const ok = await post(
      "panel",
      write({
        branchPrice: { effectiveFrom: TOMORROW.effectiveFrom, cancel: true },
      }),
    );
    expect(ok.status).toBe(200);
    expect(prices.deleteFutureBranchPrice).toHaveBeenCalledWith(
      "mnu-0007",
      "marina",
      TOMORROW.effectiveFrom,
      new Date(NOW),
    );
    expect(audit.safeAudit.mock.calls[0][0].payload).toMatchObject({
      branch: "marina",
      branchPrice: { cancel: true, effectiveFrom: TOMORROW.effectiveFrom },
    });

    // Yürürlükteki satır geri alınmaz (yerine yenisi yazılır); olmayan da.
    for (const effectiveFrom of [IN_FORCE.effectiveFrom, iso(NOW + 5 * HOUR)]) {
      prices.deleteFutureBranchPrice.mockClear();
      const res = await post(
        "panel",
        write({ branchPrice: { effectiveFrom, cancel: true } }),
      );
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("stale");
      expect(prices.deleteFutureBranchPrice).not.toHaveBeenCalled();
    }
  });

  it("LafPOS'un Satışta yazımının yanıtı da şubenin fiyatını gösterir", async () => {
    availability.writeBranchAvailability.mockResolvedValue({
      ok: true,
      row: {},
    });
    const res = await post("lafpos", {
      id: "mnu-0007",
      isActive: false,
      actor: "Selin",
    });
    expect(res.status).toBe(200);
    expect(res.body.item).toMatchObject({
      priceMinor: 14500,
      basePriceMinor: 13000,
    });
  });
});

describe("GET /api/mobile/v1/menu?branch=", () => {
  const menuItem = (it: typeof latte) => ({
    ...it,
    description: "",
    tags: [],
    allergens: [],
    image: "",
  });

  beforeEach(() => {
    store.listMenuItems.mockResolvedValue([menuItem(latte), menuItem(cake)]);
    store.getSettings.mockResolvedValue({ taxRates: { menu: 10 } });
  });

  async function menu(query = "") {
    const { GET } = await import("@/app/api/mobile/v1/menu/route");
    const res = await GET(new Request(`${BASE}/api/mobile/v1/menu${query}`));
    return { status: res.status, body: await res.json() };
  }

  function latteOf(body: {
    categories: { items: { id: string }[] }[];
  }): Record<string, unknown> | undefined {
    return body.categories
      .flatMap((c) => c.items)
      .find((i) => i.id === "mnu-0007");
  }

  it("şube söylenmezse bugünkü menü (Tuzla), şube fiyatı okunmaz", async () => {
    const res = await menu();
    expect(res.status).toBe(200);
    expect(latteOf(res.body)).toMatchObject({
      priceMinor: 13000,
      priceLargeMinor: 15000,
    });
    expect(prices.listBranchPrices).not.toHaveBeenCalled();
    expect(availability.listBranchAvailability).toHaveBeenCalledWith("tuzla");
  });

  it("?branch=marina: Marina'nın şu anki fiyatı ve Satışta'sı", async () => {
    const res = await menu("?branch=marina");
    expect(res.status).toBe(200);
    expect(latteOf(res.body)).toMatchObject({
      priceMinor: 14500,
      priceLargeMinor: 16500,
    });
    expect(availability.listBranchAvailability).toHaveBeenCalledWith("marina");
    expect(prices.listBranchPrices).toHaveBeenCalledWith("marina");
    // Gövdenin biçimi aynı: yeni alan yok.
    expect(Object.keys(res.body).sort()).toEqual([
      "categories",
      "customization",
      "updatedAt",
    ]);
  });

  it("?branch=tuzla söylenmemişle aynı; bilinmeyen şube 400 invalid_branch", async () => {
    const tuzla = await menu("?branch=tuzla");
    expect(latteOf(tuzla.body)).toMatchObject({ priceMinor: 13000 });
    expect(prices.listBranchPrices).not.toHaveBeenCalled();
    const bad = await menu("?branch=ankara");
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("invalid_branch");
    expect(typeof bad.body.message).toBe("string");
    const malformed = await menu("?branch=Marina!");
    expect(malformed.status).toBe(400);
  });
});
