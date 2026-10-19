import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * "Mağaza bozulmada boş kalır" (CLAUDE.md "Veritabanı Kesintisinde
 * Davranış") over the Data Cache.
 *
 * A cached product list is real, but a request that has itself seen the
 * database down must still show the empty shop: a signed-in member's
 * account is read live on every page, so a member (the one visitor who
 * could try to buy) learns of the outage and gets the empty shop and the
 * banner, cache hit or not. A request that read nothing live cannot know;
 * it shows the last real list, and the checkout closes on its own live
 * read. Neither path moves money: placeOrder re-reads the price and claims
 * the stock in SQL.
 *
 * React's `cache` is per request in a real render and a pass-through in
 * plain Node, so it is replaced by a memo that `newRequest()` clears.
 */

const h = vi.hoisted(() => ({
  entries: new Map<string, string>(),
  memo: new Map<unknown, Map<string, unknown>>(),
  sql: [] as string[],
  down: false,
  member: false,
  rows: {} as Record<string, Record<string, unknown>[]>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache:
      <A extends unknown[], R>(fn: (...a: A) => R) =>
      (...args: A): R => {
        let byArgs = h.memo.get(fn);
        if (!byArgs) {
          byArgs = new Map();
          h.memo.set(fn, byArgs);
        }
        const key = JSON.stringify(args);
        if (!byArgs.has(key)) byArgs.set(key, fn(...args));
        return byArgs.get(key) as R;
      },
  };
});

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache:
    (fn: (...a: unknown[]) => Promise<unknown>, keyParts: string[]) =>
    async (...args: unknown[]) => {
      const key = JSON.stringify([keyParts, args]);
      const hit = h.entries.get(key);
      if (hit !== undefined) return JSON.parse(hit);
      const value = await fn(...args);
      h.entries.set(key, JSON.stringify(value));
      return value;
    },
}));

const exec: Executor = async ({ text }) => {
  h.sql.push(text);
  if (h.down) {
    throw Object.assign(new Error("connect ECONNREFUSED"), {
      code: "ECONNREFUSED",
    });
  }
  if (/count\(\*\)/i.test(text)) return { rows: [{ count: 1 }], rowCount: 1 };
  const table = /FROM "([a-z_]+)"/.exec(text)?.[1] ?? "";
  const rows = h.rows[table] ?? [];
  return { rows, rowCount: rows.length };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

// The member's account, read live as src/lib/customer/auth.ts reads it.
vi.mock("@/lib/customer/auth", async () => {
  const { publicRead, raiseDbError } = await import("@/lib/db/health");
  const { getDb } = await import("@/lib/db");
  return {
    getActiveCustomer: vi.fn(async () => {
      if (!h.member) return null;
      return publicRead("getActiveCustomer", null, async () => {
        const { data, error, status } = await getDb()
          .from("customers")
          .select("*")
          .eq("email", "uye@example.com")
          .maybeSingle();
        if (error) raiseDbError("getCustomerByEmail", error, status);
        return data as { wishlist: string[] } | null;
      });
    }),
  };
});

const { loadAppProps } = await import("@/lib/seo/app-props");
const { getPublicSettings } = await import("@/lib/admin/store");

const day = (open: string, close: string) => ({ open, close, closed: false });

function seedRows() {
  h.rows = {
    settings: [
      {
        id: "main",
        name: "L'Affogato",
        isShopOpen: true,
        weeklyHours: {
          mon: day("09:00", "23:00"),
          tue: day("09:00", "23:00"),
          wed: day("09:00", "23:00"),
          thu: day("09:00", "23:00"),
          fri: day("09:00", "23:00"),
          sat: day("09:00", "23:00"),
          sun: day("11:00", "20:00"),
        },
      },
    ],
    products: [
      {
        id: "prd-0001",
        name: "Sirena",
        slug: "sirena",
        sku: "SIR-1",
        tag: "Çekirdek",
        priceMinor: 45000,
        compareAtPriceMinor: 0,
        desc: "Espresso harmanı",
        cat: "beans",
        img: "caramel",
        images: ["https://example.com/sirena.webp"],
        tags: [],
        stock: 12,
        lowStockThreshold: 3,
        weightGrams: 250,
        featured: true,
        isNew: false,
        isActive: true,
        seoTitle: "",
        seoDescription: "",
        variants: [],
        updatedAt: "2026-10-18T10:00:00.000Z",
      },
    ],
    menu_items: [],
    customers: [
      { email: "uye@example.com", isActive: true, wishlist: ["prd-0001"] },
    ],
  };
}

/** A new request: React's per-request memo starts empty. */
function newRequest() {
  h.memo.clear();
}

beforeEach(() => {
  h.entries.clear();
  h.memo.clear();
  h.sql.length = 0;
  h.down = false;
  h.member = false;
  seedRows();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_test123");
  vi.stubEnv("LAF_DATA_CACHE", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** A visitor fills the cache while the database is up. */
async function warmCache() {
  newRequest();
  const props = await loadAppProps();
  expect(props.products.map((p) => p.slug)).toEqual(["sirena"]);
}

describe("the shop during an outage, over a cached list", () => {
  it("a member's request shows the empty shop and the banner", async () => {
    await warmCache();
    newRequest();
    h.down = true;
    h.member = true;
    const before = h.sql.length;
    const props = await loadAppProps();
    expect(props.appProps.degraded).toBe(true);
    expect(props.products).toEqual([]);
    expect(props.appProps.products).toEqual([]);
    // Only the member's own read went to the database: the shop, the
    // settings and the menu still came from the cache.
    const tried = h.sql.slice(before);
    expect(tried.length).toBeGreaterThan(0);
    expect(tried.every((q) => q.includes('"customers"'))).toBe(true);
  });

  it("an anonymous request cannot know: the last real list, and the checkout closes on its own read", async () => {
    await warmCache();
    newRequest();
    h.down = true;
    const before = h.sql.length;
    const props = await loadAppProps();
    // The documented deviation (docs/DATABASE.md "Kesinti davranışına
    // etkisi"): real rows, no banner, no database call.
    expect(props.products.map((p) => p.slug)).toEqual(["sirena"]);
    expect(props.appProps.degraded).toBe(false);
    expect(h.sql.length).toBe(before);
    // /odeme reads getPublicSettings first and closes when it is shut
    // ("Şu an sipariş alamıyoruz"): nothing is bought from the cached list.
    newRequest();
    expect((await getPublicSettings()).isShopOpen).toBe(false);
  });

  it("a member's request with the database up shows the shop", async () => {
    await warmCache();
    newRequest();
    h.member = true;
    const props = await loadAppProps();
    expect(props.appProps.degraded).toBe(false);
    expect(props.products.map((p) => p.slug)).toEqual(["sirena"]);
    expect(props.appProps.isAuthenticated).toBe(true);
  });

  it("the category pages apply the same rule after their reads", () => {
    for (const page of [
      "src/app/magaza/[kategori]/page.tsx",
      "src/app/menu/[kategori]/page.tsx",
    ]) {
      const src = readFileSync(page, "utf8");
      expect(src).toMatch(/getActiveCustomer\(\),[\s\S]*\]\);/);
      expect(src).toMatch(/= shopForRequest\(listed\);/);
      expect(src).not.toMatch(/products=\{listed\}/);
    }
  });
});
