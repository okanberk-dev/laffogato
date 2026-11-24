import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Masanın QR menüsü (/masa/<kod>) önbellekten çizilir (site-data.ts
// `listSiteMenu`, docs/DATABASE.md "Uyanmalar"): kayıt ancak bir yazım
// `pub:menu`'yu düşürünce yenilenir. Şubenin fiyatı ise anı gelince, hiçbir
// şey yazılmadan geçerli olur: önbellek anahtarı şubenin geçmiş son fiyat
// anını taşır, o an geçince ilk görüntüleme menüyü bir kez yeniden okur.

const store = vi.hoisted(() => ({
  listMenuForCustomerLive: vi.fn(),
  menuWithoutPrices: () => ({}),
}));
const prices = vi.hoisted(() => ({ listBranchPrices: vi.fn() }));
const entries = vi.hoisted(() => new Map<string, string>());

// site-data.ts bütün okuyucularını yüklenirken önbelleğe sarar: gerçek
// modülün geri kalanı yerinde, yalnız menü taklit.
vi.mock("@/lib/admin/store", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...store,
}));
vi.mock("@/lib/admin/menu-branch-prices", () => prices);
vi.mock("@/lib/cache/presentation", () => ({
  presentationCacheEnabled: () => true,
  presentationCacheKey: (name: string) => [name, "test"],
  // Argümanlar anahtarın parçası (gerçeğindeki gibi).
  presentationCache:
    <A extends unknown[], T>(name: string, fn: (...a: A) => Promise<T>) =>
    async (...args: A): Promise<T> => {
      const key = JSON.stringify([name, ...args]);
      const hit = entries.get(key);
      if (hit !== undefined) return JSON.parse(hit) as T;
      const value = await fn(...args);
      entries.set(key, JSON.stringify(value));
      return value;
    },
}));

const T0 = Date.parse("2026-11-24T09:00:00.000Z");
const MIN = 60_000;
const AT = new Date(T0 + 30 * MIN).toISOString();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  entries.clear();
  store.listMenuForCustomerLive.mockReset();
  store.listMenuForCustomerLive.mockResolvedValue({});
  prices.listBranchPrices.mockReset();
  prices.listBranchPrices.mockImplementation(async (branch: string) =>
    branch === "marina"
      ? [
          {
            menuItemId: "mnu-0007",
            branch: "marina",
            priceMinor: 14500,
            priceMinorL: 16500,
            effectiveFrom: AT,
            createdAt: new Date(T0).toISOString(),
            createdBy: "panel:Ayşe",
          },
        ]
      : [],
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("listSiteMenu: şubenin fiyat anı önbelleği yeniler", () => {
  it("an gelmeden kayıt kullanılır; an geçince bir kez yeniden okunur, o anın fiyatıyla", async () => {
    const { listSiteMenu } = await import("@/lib/seo/site-data");
    await listSiteMenu("marina");
    expect(store.listMenuForCustomerLive).toHaveBeenCalledTimes(1);
    expect(store.listMenuForCustomerLive).toHaveBeenLastCalledWith(
      "marina",
      "",
    );
    vi.setSystemTime(T0 + 29 * MIN);
    await listSiteMenu("marina");
    expect(store.listMenuForCustomerLive).toHaveBeenCalledTimes(1);

    vi.setSystemTime(T0 + 31 * MIN);
    await listSiteMenu("marina");
    expect(store.listMenuForCustomerLive).toHaveBeenCalledTimes(2);
    expect(store.listMenuForCustomerLive).toHaveBeenLastCalledWith(
      "marina",
      AT,
    );
    vi.setSystemTime(T0 + 45 * MIN);
    await listSiteMenu("marina");
    expect(store.listMenuForCustomerLive).toHaveBeenCalledTimes(2);
  });

  it("sitenin sayfaları (Tuzla) eskisi gibi: şube fiyatı okunmaz, anahtar aynı", async () => {
    const { listSiteMenu } = await import("@/lib/seo/site-data");
    await listSiteMenu();
    await listSiteMenu("tuzla");
    expect(store.listMenuForCustomerLive).toHaveBeenCalledTimes(1);
    expect(store.listMenuForCustomerLive).toHaveBeenLastCalledWith("tuzla");
    expect(prices.listBranchPrices).not.toHaveBeenCalled();
  });
});
