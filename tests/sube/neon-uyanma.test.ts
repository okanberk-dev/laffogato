import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signedHeaders } from "@/lib/panel/karaoke-sync-core";

// Neon kotası (#229, docs/DATABASE.md "Uyanmalar" madde 5): kasanın (LafPOS)
// 15 dakikalık güvenlik çekimi ve menü yoklaması, hiçbir şey değişmemişken
// veritabanına gitmez. Veri katmanı taklit ve her okuma sayılır; Data Cache
// bellekte bir taklit (etiket düşürme dahil). "Önce" sütunu önbellek
// kapalıyken (`LAF_DATA_CACHE=off`) aynı trafiğin maliyetidir: o yol bu
// değişiklikten önceki davranışın kendisidir.

const store = vi.hoisted(() => ({
  countPanelAwaitingPaymentOrders: vi.fn(),
  listPanelOpenOrderRows: vi.fn(),
  listPanelClosedOrderRows: vi.fn(),
  listPanelTillPaidOrderIds: vi.fn(),
  listMenuItems: vi.fn(),
  listMenuItemsForPanel: vi.fn(),
  getSettings: vi.fn(),
  listOrderAlertRows: vi.fn(),
  MENU_CATEGORY_KEYS: ["espresso", "dessert"],
  MENU_CATEGORY_LABELS: { espresso: "Espresso", dessert: "Tatlılar" },
}));
const calls = vi.hoisted(() => ({ listOpenTableCalls: vi.fn() }));
const availability = vi.hoisted(() => ({
  listBranchAvailability: vi.fn(),
}));
const venue = vi.hoisted(() => ({
  getVenueStatus: vi.fn(),
  isCafeOpenNow: () => true,
}));

const auth = vi.hoisted(() => ({
  ADMIN_COOKIE_NAME: "laf_admin",
  getAdminSession: vi.fn(),
  isAdminSessionUnavailable: () => false,
  readSessionFromCookieValue: () => ({
    email: "bar@example.com",
    role: "staff",
  }),
}));

/** Bellekte Data Cache: anahtar, etiketler, etiket düşürme. */
const cache = vi.hoisted(() => {
  const entries = new Map<string, { body: string; tags: string[] }>();
  return {
    on: true,
    entries,
    expire(tag: string) {
      for (const [key, entry] of entries) {
        if (entry.tags.includes(tag)) entries.delete(key);
      }
    },
    unstable_cache<T>(
      cb: () => Promise<T>,
      keyParts: string[],
      opts?: { tags?: string[] },
    ) {
      return async (): Promise<T> => {
        const key = JSON.stringify(keyParts);
        const hit = entries.get(key);
        if (hit) return JSON.parse(hit.body) as T;
        const value = await cb();
        entries.set(key, {
          body: JSON.stringify(value),
          tags: opts?.tags ?? [],
        });
        return value;
      };
    },
  };
});

vi.mock("next/cache", () => ({ unstable_cache: cache.unstable_cache }));
vi.mock("@/lib/cache/presentation", () => ({
  presentationCacheEnabled: () => cache.on,
  presentationCacheKey: (name: string) => [name, "test"],
  presentationCache:
    <T>(name: string, fn: () => Promise<T>, tags: string[]) =>
    () =>
      cache.on ? cache.unstable_cache(fn, ["pc", name], { tags })() : fn(),
}));
vi.mock("@/lib/admin/store", () => store);
vi.mock("@/lib/admin/table-calls", () => calls);
vi.mock("@/lib/admin/menu-availability", () => availability);
vi.mock("@/lib/mobile/venue", () => venue);
vi.mock("@/lib/admin/auth", () => auth);
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "signed-session-cookie" }) }),
}));

const PANEL_KEY = "panel-key-for-tests-0123456789-abcdefghij";
const LAFPOS_KEY = "lafpos-key-for-tests-0123456789-abcdefghij";
const BASE = "https://laffogato.net";
const MIN = 60_000;
const T0 = Date.parse("2026-11-22T09:00:00.000Z");

function signed(who: "panel" | "lafpos", path: string): Request {
  const url = new URL(path, BASE);
  const key = who === "panel" ? PANEL_KEY : LAFPOS_KEY;
  return new Request(url, { headers: signedHeaders(key, "GET", url, "") });
}

const MENU_ITEM = {
  id: "mi-1",
  name: "Affogato",
  description: "",
  categoryKey: "espresso",
  priceMinor: 18000,
  priceMinorL: 0,
  isActive: true,
  sortOrder: 1,
  tags: [],
  allergens: [],
  image: "",
  updatedAt: "2026-11-20T10:00:00.000Z",
};

const PAID_ORDER = {
  id: "ord-0201",
  orderNo: 201,
  status: "paid",
  kind: "cafe",
  source: "",
  fulfillment: "table",
  tableCode: "M4R1N4T4BL",
  tableName: "M2",
  customerName: "Ada",
  scheduledFor: "",
  paidAt: new Date(T0 + 20 * MIN).toISOString(),
  shippedAt: "",
  deliveryNote: "",
  totalMinor: 18000,
  items: [{ productName: "Affogato", qty: 1, priceMinor: 18000 }],
};

/** Veritabanına giden her okuma (veri katmanı çağrısı). */
const COUNTED = [
  store.countPanelAwaitingPaymentOrders,
  store.listPanelOpenOrderRows,
  store.listPanelClosedOrderRows,
  store.listPanelTillPaidOrderIds,
  store.listOrderAlertRows,
  store.listMenuItems,
  store.listMenuItemsForPanel,
  store.getSettings,
  calls.listOpenTableCalls,
  availability.listBranchAvailability,
  auth.getAdminSession,
  venue.getVenueStatus,
];

function dbReads(): number {
  return COUNTED.reduce((n, fn) => n + fn.mock.calls.length, 0);
}

/** Sayacı sıfırlar; taklitlerin yanıtları kalır. */
function clearReads(): void {
  for (const fn of COUNTED) fn.mockClear();
}

const env = { ...process.env };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  process.env.KARAOKE_SYNC_SECRET = PANEL_KEY;
  process.env.LAFPOS_SYNC_SECRET = LAFPOS_KEY;
  delete process.env.LAFPOS_BRANCHES;
  delete process.env.SITE_BRANCHES;
  cache.on = true;
  cache.entries.clear();
  for (const fn of COUNTED) {
    fn.mockReset();
  }
  store.countPanelAwaitingPaymentOrders.mockResolvedValue(0);
  store.listPanelOpenOrderRows.mockResolvedValue([]);
  store.listPanelClosedOrderRows.mockResolvedValue([]);
  store.listPanelTillPaidOrderIds.mockResolvedValue(new Set());
  calls.listOpenTableCalls.mockResolvedValue([]);
  store.listMenuItems.mockResolvedValue([MENU_ITEM]);
  store.listMenuItemsForPanel.mockResolvedValue([MENU_ITEM]);
  store.getSettings.mockResolvedValue({ taxRates: { cafe: 10 } });
  availability.listBranchAvailability.mockResolvedValue(new Map());
  store.listOrderAlertRows.mockResolvedValue([]);
  auth.getAdminSession.mockResolvedValue({
    email: "bar@example.com",
    role: "staff",
  });
  venue.getVenueStatus.mockResolvedValue({ manualOverride: null });
});

afterEach(() => {
  vi.useRealTimers();
  process.env = { ...env };
});

async function version(path = "/api/pos/orders/version") {
  const { GET } = await import("@/app/api/pos/orders/version/route");
  const res = await GET(signed("lafpos", path));
  expect(res.status).toBe(200);
  return (await res.json()) as {
    version: string;
    karaoke: string;
    menu?: string;
  };
}

async function pull(who: "panel" | "lafpos" = "lafpos") {
  const { GET } = await import("@/app/api/panel/orders/route");
  const res = await GET(signed(who, "/api/panel/orders"));
  return { status: res.status, body: await res.json() };
}

async function menu(etag?: string) {
  const { GET } = await import("@/app/api/mobile/v1/menu/route");
  const res = await GET(
    new Request(`${BASE}/api/mobile/v1/menu`, {
      headers: etag ? { "if-none-match": etag } : {},
    }),
  );
  return { status: res.status, etag: res.headers.get("etag") ?? "" };
}

/**
 * Açık bir iş gününün `hours` saati, kasanın gözünden: sürüm sinyali 20
 * sn'de bir, sipariş güvenlik çekimi ve menü yoklaması 15 dakikada bir
 * (LafPOS `ORDERS_SAFETY_PULL_MS`, `MENU_SYNC_INTERVAL_MS`). Saat başına
 * veritabanına giden istek ve okuma sayısını döndürür.
 */
async function lafposHours(hours: number) {
  const perHour: { requests: number; reads: number }[] = [];
  let etag = "";
  for (let h = 0; h < hours; h++) {
    const before = dbReads();
    let requests = 0;
    for (let s = 0; s < 3600; s += 20) {
      vi.setSystemTime(T0 + h * 60 * MIN + s * 1000);
      const at = dbReads();
      await version();
      // Sürüm sinyali veritabanına hiç gitmez.
      expect(dbReads()).toBe(at);
      if (s % 900 === 0) {
        const p = await pull();
        expect(p.status).toBe(200);
        expect(p.body.orders).toEqual([]);
        if (dbReads() > at) requests++;
      }
      if (s % 900 === 400) {
        const mid = dbReads();
        const m = await menu(etag || undefined);
        expect([200, 304]).toContain(m.status);
        etag = m.etag;
        if (dbReads() > mid) requests++;
      }
    }
    perHour.push({ requests, reads: dbReads() - before });
  }
  return perHour;
}

describe("ölçüm: açık iş gününde kasanın veritabanını uyandırması", () => {
  it("önce saatte 8 istek ve 28 okuma; sonra (ilk saatten sonra) 2 istek ve 7 okuma", async () => {
    cache.on = false;
    const before = await lafposHours(3);
    // Çekim 4 okuma (sayı, liste, çağrılar, `closed`), menü 3.
    expect(before).toEqual([
      { requests: 8, reads: 28 },
      { requests: 8, reads: 28 },
      { requests: 8, reads: 28 },
    ]);

    cache.on = true;
    vi.setSystemTime(T0);
    clearReads();
    const after = await lafposHours(3);
    // İlk saat: işaret yeni yapılmışken gelen ilk çekim hiçbir şeye kefil
    // olmaz (5 sn kuralı), ikincisi hatırlanır; menüde ilk istek ETag'siz,
    // ikincisi işareti yapar, üçüncüsü hatırlanır.
    expect(after[0]).toEqual({ requests: 5, reads: 17 });
    // Sonra saatte bir canlı okuma (emniyet ağı), uç başına.
    expect(after[1]).toEqual({ requests: 2, reads: 7 });
    expect(after[2]).toEqual({ requests: 2, reads: 7 });
  });
});

/**
 * Açık bir panel sekmesinin zili, köşk açıkken: 10 sn'de bir sorar ve
 * aldığı imleci geri gönderir (order-alert-poller.ts). Saat başına
 * veritabanına giden istek ve okuma sayısı.
 */
async function bellHours(hours: number) {
  const { GET } = await import("@/app/admin/siparisler/uyari/route");
  const perHour: { requests: number; reads: number }[] = [];
  let cursor = "";
  for (let h = 0; h < hours; h++) {
    const before = dbReads();
    let requests = 0;
    for (let s = 0; s < 3600; s += 10) {
      vi.setSystemTime(T0 + h * 60 * MIN + s * 1000);
      const at = dbReads();
      const url = new URL("/admin/siparisler/uyari", BASE);
      if (cursor) url.searchParams.set("c", cursor);
      const res = await GET(new Request(url));
      expect(res.status).toBe(200);
      const json = (await res.json()) as { cursor?: string };
      cursor = typeof json.cursor === "string" ? json.cursor : "";
      if (dbReads() > at) requests++;
    }
    perHour.push({ requests, reads: dbReads() - before });
  }
  return perHour;
}

describe("ölçüm: açık panel sekmesinin yeni sipariş zili (#229)", () => {
  it("önce saatte 360 istek veritabanına gider; sonra ilk saatte 2, sonra saatte 1", async () => {
    cache.on = false;
    expect(await bellHours(2)).toEqual([
      { requests: 360, reads: 1800 },
      { requests: 360, reads: 1800 },
    ]);

    cache.on = true;
    for (const fn of COUNTED) fn.mockClear();
    // İlk iki yanıt tam (ikincisi işarete kefil olur ve yoğunluk
    // penceresini bir kez okur); sonra köşk açıkken saatte bir tam yanıt.
    expect(await bellHours(3)).toEqual([
      { requests: 2, reads: 12 },
      { requests: 1, reads: 5 },
      { requests: 1, reads: 5 },
    ]);
  });
});

describe("GET /api/panel/orders: sessiz ekran hatırlanır, yalnız LafPOS'a", () => {
  /** İşaret yapılır ve oturur; sonraki çekim hatırlanabilir. */
  async function settle() {
    await version();
    vi.setSystemTime(Date.now() + MIN);
    clearReads();
  }

  it("boş ekran ikinci çekimde veritabanına gitmez; yanıt canlı okumayla aynı", async () => {
    await settle();
    const first = await pull();
    const reads = dbReads();
    expect(reads).toBe(4);
    vi.setSystemTime(Date.now() + 15 * MIN);
    const second = await pull();
    expect(dbReads()).toBe(reads);
    expect(second.status).toBe(200);
    expect({ ...second.body, now: "" }).toEqual({ ...first.body, now: "" });
    expect(second.body).toMatchObject({
      branch: "marina",
      complete: true,
      orders: [],
      awaitingPayment: 0,
      calls: [],
      closed: [],
    });
    expect(second.body.now).not.toBe(first.body.now);
  });

  it("sipariş yazılınca (etiket düşer) sıradaki çekim canlıdır ve siparişi getirir", async () => {
    await settle();
    await pull();
    await pull();
    expect(dbReads()).toBe(4);

    // Ödeme geldi: veri katmanı `live:orders`'ı düşürür.
    store.listPanelOpenOrderRows.mockResolvedValue([PAID_ORDER]);
    cache.expire("live:orders");
    vi.setSystemTime(T0 + 21 * MIN);
    const moved = await version();
    const after = await pull();
    // Sayı, liste, çağrılar, `closed` ve kasada ödenen.
    expect(dbReads()).toBe(9);
    expect(after.body.orders).toHaveLength(1);
    expect(after.body.orders[0].orderNo).toBe(201);
    expect(moved.version).toBeTruthy();
  });

  it("ekranda bir şey varken hiçbir şey hatırlanmaz: her çekim canlı", async () => {
    store.listPanelOpenOrderRows.mockResolvedValue([PAID_ORDER]);
    await settle();
    for (let i = 1; i <= 3; i++) {
      vi.setSystemTime(Date.now() + 5 * MIN);
      await pull();
      // Sayı, liste, çağrılar, `closed` ve kasada ödenen.
      expect(dbReads()).toBe(5 * i);
    }
    // Ödeme bekleyen ya da açık çağrı da öyle.
    store.listPanelOpenOrderRows.mockResolvedValue([]);
    store.countPanelAwaitingPaymentOrders.mockResolvedValue(1);
    await pull();
    await pull();
    expect(dbReads()).toBe(23);
    store.countPanelAwaitingPaymentOrders.mockResolvedValue(0);
    calls.listOpenTableCalls.mockResolvedValue([
      {
        id: "call-1",
        tableCode: "M4R1N4T4BL",
        tableName: "M2",
        branch: "marina",
        reason: "waiter",
        createdAt: new Date().toISOString(),
        ackedAt: "",
        ackedBy: "",
      },
    ]);
    await pull();
    await pull();
    expect(dbReads()).toBe(31);
  });

  it("ekran saatle boşalınca (yazma yok) sıradaki canlı okuma hatırlanır", async () => {
    store.listPanelOpenOrderRows.mockResolvedValue([PAID_ORDER]);
    await settle();
    await pull();
    store.listPanelOpenOrderRows.mockResolvedValue([]);
    await pull();
    expect(dbReads()).toBe(9);
    await pull();
    expect(dbReads()).toBe(9);
  });

  it("işaret yeni yapılmışken (5 sn) okunan boş ekran hatırlanmaz", async () => {
    await version();
    clearReads();
    vi.setSystemTime(Date.now() + 1000);
    await pull();
    vi.setSystemTime(Date.now() + 1000);
    await pull();
    expect(dbReads()).toBe(8);
    vi.setSystemTime(Date.now() + 10_000);
    await pull();
    await pull();
    expect(dbReads()).toBe(12);
  });

  it("saatte bir canlı okuma: hatırlanan yanıt bir saatten uzun yaşamaz", async () => {
    await settle();
    await pull();
    vi.setSystemTime(T0 + 59 * MIN);
    await pull();
    expect(dbReads()).toBe(4);
    vi.setSystemTime(T0 + 61 * MIN);
    await pull();
    expect(dbReads()).toBe(8);
  });

  it("köşkün paneli (Tuzla) her soruşta canlı okur: davranışı değişmedi", async () => {
    await settle();
    for (let i = 1; i <= 3; i++) {
      const p = await pull("panel");
      expect(p.body.branch).toBe("tuzla");
      expect(dbReads()).toBe(4 * i);
    }
    // Marina'nın hatırlanan boş ekranı Tuzla'ya yanıt olmaz.
    await pull("lafpos");
    await pull("lafpos");
    expect(dbReads()).toBe(16);
    await pull("panel");
    expect(dbReads()).toBe(20);
  });

  it("önbellek kapalıyken (LAF_DATA_CACHE=off) her çekim canlı", async () => {
    cache.on = false;
    await settle();
    await pull();
    await pull();
    expect(dbReads()).toBe(8);
  });

  it("okuma düşerse 503 ve hiçbir şey hatırlanmaz", async () => {
    await settle();
    store.listPanelOpenOrderRows.mockRejectedValueOnce(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const failed = await pull();
    err.mockRestore();
    expect(failed.status).toBe(503);
    const ok = await pull();
    expect(ok.status).toBe(200);
    // Düşen okumadan sonra canlı okundu: 2 (sayım, liste) + 4.
    expect(dbReads()).toBe(6);
  });
});

describe("GET /api/mobile/v1/menu: 'değişmedi' veritabanına gitmez", () => {
  async function settle() {
    await version();
    vi.setSystemTime(Date.now() + MIN);
    clearReads();
  }

  it("ETag'siz istek her zaman veritabanından okur", async () => {
    await settle();
    expect((await menu()).status).toBe(200);
    expect((await menu()).status).toBe(200);
    expect(dbReads()).toBe(6);
  });

  it("aynı ETag ikinci soruşta veritabanına gitmeden 304 alır", async () => {
    await settle();
    const first = await menu();
    expect(first.etag).toMatch(/^"/);
    // İlk koşullu soru işareti yapar (5 sn kuralı: canlı), sonraki hatırlar.
    expect((await menu(first.etag)).status).toBe(304);
    vi.setSystemTime(Date.now() + MIN);
    expect((await menu(first.etag)).status).toBe(304);
    const reads = dbReads();
    for (let i = 0; i < 4; i++) {
      vi.setSystemTime(Date.now() + 10 * MIN);
      const again = await menu(first.etag);
      expect(again.status).toBe(304);
      expect(again.etag).toBe(first.etag);
    }
    expect(dbReads()).toBe(reads);
  });

  it("fiyat değişince (pub:menu düşer) eski ETag 200 ve yeni menüyü alır", async () => {
    await settle();
    const first = await menu();
    await menu(first.etag);
    vi.setSystemTime(Date.now() + MIN);
    await menu(first.etag);
    const reads = dbReads();

    store.listMenuItems.mockResolvedValue([
      { ...MENU_ITEM, priceMinor: 19000 },
    ]);
    cache.expire("pub:menu");
    const changed = await menu(first.etag);
    expect(changed.status).toBe(200);
    expect(changed.etag).not.toBe(first.etag);
    expect(dbReads()).toBe(reads + 3);
  });

  it("ayarlar değişince (pub:site düşer) de yeniden okunur", async () => {
    await settle();
    const first = await menu();
    await menu(first.etag);
    vi.setSystemTime(Date.now() + MIN);
    await menu(first.etag);
    const reads = dbReads();
    cache.expire("pub:site");
    expect((await menu(first.etag)).status).toBe(304);
    expect(dbReads()).toBe(reads + 3);
  });

  it("hatırlanandan başka bir ETag veritabanından yanıtlanır", async () => {
    await settle();
    const first = await menu();
    await menu(first.etag);
    vi.setSystemTime(Date.now() + MIN);
    await menu(first.etag);
    const reads = dbReads();
    const stale = await menu('"eski-bir-etag"');
    expect(stale.status).toBe(200);
    expect(stale.etag).toBe(first.etag);
    expect(dbReads()).toBe(reads + 3);
  });
});
