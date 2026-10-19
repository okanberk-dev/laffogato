import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";
import { MIGRATION_NAMES } from "@/lib/db/schema-sql";

/**
 * The public pages' presentation reads go through the Next Data Cache
 * (src/lib/cache/presentation.ts, src/lib/seo/site-data.ts) so a page view
 * does not wake the database (docs/DATABASE.md "Uyanmalar").
 *
 * What must hold:
 * - an outage still shows the bundled fallback, and that fallback is never
 *   stored (publicRead is the OUTER call);
 * - a hit reads nothing from the database;
 * - what is stored survives JSON and carries no base64 photo;
 * - the key names the deployment and the newest migration;
 * - the hour is applied per request, never stored;
 * - checkout, karaoke, the app's API, the e-mails and the consent versions
 *   never read through it.
 *
 * `unstable_cache` is replaced by an in-memory map that stores JSON, as the
 * real one does.
 */

const h = vi.hoisted(() => ({
  entries: new Map<string, string>(),
  made: [] as Array<{
    keyParts: string[];
    tags: string[];
    revalidate: unknown;
  }>,
  cacheBroken: false,
  sql: [] as string[],
  down: false,
  rows: {} as Record<string, Record<string, unknown>[]>,
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (
    fn: (...a: unknown[]) => Promise<unknown>,
    keyParts: string[],
    opts: { tags: string[]; revalidate: unknown },
  ) => {
    h.made.push({ keyParts, tags: opts.tags, revalidate: opts.revalidate });
    return async (...args: unknown[]) => {
      if (h.cacheBroken) throw new Error("Invariant: incrementalCache missing");
      const key = JSON.stringify([keyParts, args]);
      const hit = h.entries.get(key);
      if (hit !== undefined) return JSON.parse(hit);
      const value = await fn(...args);
      h.entries.set(key, JSON.stringify(value));
      return value;
    };
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
vi.mock("@/lib/customer/auth", () => ({
  getActiveCustomer: vi.fn(async () => null),
}));

const site = await import("@/lib/seo/site-data");
const { loadAppProps } = await import("@/lib/seo/app-props");

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const day = (open: string, close: string) => ({ open, close, closed: false });

function seedRows() {
  h.rows = {
    settings: [
      {
        id: "main",
        name: "L'Affogato",
        phone: "0216 000 00 00",
        email: "merhaba@laffogato.net",
        isShopOpen: true,
        notificationEmail: "operasyon@laffogato.net",
        orderNotifyEmails: "barista@laffogato.net",
        orderNotifyRoles: ["owner", "manager"],
        karaokeNotifyEmail: "karaoke@laffogato.net",
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
        images: [PIXEL],
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
      {
        id: "prd-0002",
        name: "Moka",
        slug: "moka",
        sku: "MOK-1",
        tag: "Ekipman",
        priceMinor: 189000,
        compareAtPriceMinor: 0,
        desc: "",
        cat: "beans",
        img: "caramel",
        images: ["https://example.com/moka.webp"],
        tags: [],
        stock: 0,
        lowStockThreshold: 3,
        weightGrams: 900,
        featured: false,
        isNew: true,
        isActive: true,
        seoTitle: "",
        seoDescription: "",
        variants: [],
        updatedAt: "2026-10-17T10:00:00.000Z",
      },
    ],
    menu_items: [
      {
        id: "mnu-0001",
        categoryKey: "espresso",
        name: "Affogato",
        desc: "Gelato ve espresso",
        priceMinor: 18000,
        priceMinorL: 0,
        tags: [],
        allergens: null,
        hue: "caramel",
        image: PIXEL,
        isActive: true,
        sortOrder: 0,
      },
    ],
    shop_hero_slides: [
      {
        id: "shero-1",
        title: "Sonbahar",
        subtitle: "Yeni çekirdekler",
        imageUrl: PIXEL,
        ctaLabel: "Mağaza",
        ctaHref: "/magaza",
        textTheme: "light",
        isActive: true,
        sortOrder: 0,
        createdAt: "2026-10-01T00:00:00.000Z",
      },
    ],
    home_hero_slides: [
      {
        id: "hhero-1",
        sortOrder: 10,
        isActive: true,
        // Only the second Saturday of the test is inside the window.
        startsAt: "2026-10-24T00:00:00.000Z",
        endsAt: "",
        kicker: "Ekim",
        titleLine1: "Sonbahar",
        titleLine2: "Menüsü",
        body: "Balkabağı latte geri döndü.",
        image: PIXEL,
        alt: "Bir latte",
        scene: "spice",
        primaryLabel: "Menü",
        primaryAction: "menu",
        primaryHref: "",
        secondaryLabel: "",
        secondaryAction: "",
        secondaryHref: "",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
      },
    ],
    app_posts: [
      {
        id: "apost-1",
        kind: "event",
        title: "Karaoke gecesi",
        body: "Cuma akşamı.",
        image: "https://example.com/karaoke.webp",
        linkUrl: "",
        linkLabel: "",
        sortOrder: 0,
        isActive: true,
        startsAt: "",
        endsAt: "2026-10-22T00:00:00.000Z",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
      },
    ],
    site_content: [{ key: "home.introTitle", value: "Merhaba" }],
    press: [],
    story_timeline: [],
    legal_docs: [],
  };
}

const MONDAY = Date.parse("2026-10-19T09:00:00.000Z"); // 12:00 in Tuzla
const SATURDAY = Date.parse("2026-10-24T09:00:00.000Z");
const SUNDAY = Date.parse("2026-10-25T09:00:00.000Z");

function caching(on = true) {
  vi.stubEnv("NODE_ENV", on ? "production" : "test");
  vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_test123");
  vi.stubEnv("LAF_DATA_CACHE", "");
}

beforeEach(() => {
  h.entries.clear();
  h.made.length = 0;
  h.sql.length = 0;
  h.down = false;
  h.cacheBroken = false;
  seedRows();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const stored = () => [...h.entries.values()].join("\n");

describe("a database outage", () => {
  it("returns the bundled fallback, stores nothing, and the next call reads again", async () => {
    caching();
    h.down = true;
    const menu = await site.listSiteMenu();
    // The menu without prices: a bundled price is never shown.
    const items = Object.values(menu).flatMap((c) => c.items);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.price === "-")).toBe(true);
    expect(await site.listSiteShopProducts()).toEqual([]);
    const settings = await site.getSiteSettings();
    expect(settings.isShopOpen).toBe(false);
    expect(h.entries.size).toBe(0);

    const before = h.sql.length;
    h.down = false;
    const live = await site.listSiteShopProducts();
    expect(live.map((p) => p.slug)).toEqual(["sirena", "moka"]);
    expect(h.sql.length).toBeGreaterThan(before);
  });
});

describe("a cache hit", () => {
  it("makes no database call", async () => {
    caching();
    await site.listSiteShopProducts();
    await site.listSiteMenu();
    await site.getSiteSettings();
    await site.listSiteHomeSlides(SATURDAY);
    await site.listSiteAppPosts(MONDAY);
    await site.getSiteContentForSite();
    const before = h.sql.length;
    await site.listSiteShopProducts();
    await site.listSiteMenu();
    await site.getSiteSettings();
    await site.listSiteHomeSlides(SATURDAY);
    await site.listSiteAppPosts(MONDAY);
    await site.getSiteContentForSite();
    expect(h.sql.length).toBe(before);
  });

  it("answers an unknown slug from the cached list, with no query", async () => {
    caching();
    expect((await site.getSiteProductBySlug("sirena"))?.id).toBe("prd-0001");
    const before = h.sql.length;
    expect(await site.getSiteProductBySlug("yok-boyle-bir-urun")).toBeNull();
    expect(
      (await site.listSiteRelatedProducts("beans", "prd-0001")).map(
        (p) => p.id,
      ),
    ).toEqual(["prd-0002"]);
    expect(h.sql.length).toBe(before);
  });
});

describe("what is stored", () => {
  it("survives a JSON round trip unchanged and carries no base64", async () => {
    caching();
    const first = {
      shop: await site.listSiteShopProducts(),
      menu: await site.listSiteMenu(),
      shopHero: await site.listSiteShopHeroSlides(),
      home: await site.listSiteHomeSlides(SATURDAY),
      posts: await site.listSiteAppPosts(MONDAY),
      sitemap: await site.listSitemapProducts(),
    };
    const again = {
      shop: await site.listSiteShopProducts(),
      menu: await site.listSiteMenu(),
      shopHero: await site.listSiteShopHeroSlides(),
      home: await site.listSiteHomeSlides(SATURDAY),
      posts: await site.listSiteAppPosts(MONDAY),
      sitemap: await site.listSitemapProducts(),
    };
    expect(again).toEqual(first);
    expect(stored()).not.toContain("data:");
    // The photos are there, as the paths the browser fetches.
    expect(first.shop[0].images?.[0]).toMatch(/^\/gorsel\/urun\/prd-0001\/0/);
    expect(first.home.fromPanel).toBe(true);
    expect(first.home.slides[0].photo).toMatch(/^\/gorsel\/ana-hero\/hhero-1/);
    expect(first.shopHero[0].imageUrl).toMatch(/^\/gorsel\/hero\/shero-1/);
    expect(first.sitemap[0]).toEqual({
      slug: "sirena",
      updatedAt: "2026-10-18T10:00:00.000Z",
      images: [],
    });
  });

  it("the settings entry has no staff recipients", async () => {
    caching();
    const s = await site.getSiteSettings();
    expect(s.phone).toBe("0216 000 00 00");
    expect(s.notificationEmail).toBe("");
    expect(s.orderNotifyEmails).toBe("");
    expect(s.orderNotifyRoles).toEqual([]);
    expect(s.karaokeNotifyEmail).toBe("");
    expect(stored()).not.toMatch(/operasyon@|barista@|karaoke@/);
  });

  it("a post list with a base64 photo is not stored and is read live", async () => {
    caching();
    h.rows.app_posts[0].image = PIXEL;
    const posts = await site.listSiteAppPosts(MONDAY);
    expect(posts[0].image).toBe(PIXEL);
    expect(stored()).not.toContain("data:");
  });
});

describe("the key", () => {
  it("names the deployment and the newest migration, and carries the tags", async () => {
    caching();
    await site.listSiteShopProducts();
    await site.getSiteSettings();
    const head = MIGRATION_NAMES[MIGRATION_NAMES.length - 1];
    const shop = h.made.find((m) => m.keyParts[0] === "site-shop");
    expect(shop?.keyParts).toEqual(["site-shop", "dpl_test123", head]);
    expect(shop?.tags).toEqual(["pub:catalog"]);
    expect(shop?.revalidate).toBe(86_400);
    const settings = h.made.find((m) => m.keyParts[0] === "site-settings");
    expect(settings?.tags).toEqual(["pub:site"]);
  });
});

describe("the switches", () => {
  it("NODE_ENV=test reads the database every time", async () => {
    caching(false);
    await site.listSiteShopProducts();
    const before = h.sql.length;
    await site.listSiteShopProducts();
    expect(h.sql.length).toBeGreaterThan(before);
    expect(h.made).toEqual([]);
  });

  it("LAF_DATA_CACHE=off reads the database every time", async () => {
    caching();
    vi.stubEnv("LAF_DATA_CACHE", "off");
    await site.listSiteMenu();
    const before = h.sql.length;
    await site.listSiteMenu();
    expect(h.sql.length).toBeGreaterThan(before);
    expect(h.entries.size).toBe(0);
  });

  it("a cache that fails before the read runs falls back to the database", async () => {
    caching();
    h.cacheBroken = true;
    const products = await site.listSiteShopProducts();
    expect(products.map((p) => p.slug)).toEqual(["sirena", "moka"]);
  });
});

describe("the hour is applied per request, never stored", () => {
  it("today's hours follow the clock over the same cached settings", async () => {
    caching();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
    const monday = await loadAppProps();
    const before = h.sql.length;
    vi.setSystemTime(SUNDAY);
    const sunday = await loadAppProps();
    expect(h.sql.length).toBe(before);
    expect(monday.appProps.visit.todayHours).toBe("09:00 - 23:00");
    expect(sunday.appProps.visit.todayHours).toBe("11:00 - 20:00");
  });

  it("a discount shows only between its days, over the same cached list", async () => {
    caching();
    h.rows.products[0] = {
      ...h.rows.products[0],
      compareAtPriceMinor: 52000,
      // Istanbul days 21-24 Ekim, as the panel stores them.
      discountStartsAt: "2026-10-20T21:00:00.000Z",
      discountEndsAt: "2026-10-24T20:59:59.999Z",
    };
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
    const before = (await site.listSiteShopProducts())[0];
    const reads = h.sql.length;
    vi.setSystemTime(SATURDAY);
    const during = (await site.getSiteProductBySlug("sirena"))!;
    vi.setSystemTime(SUNDAY);
    const after = (await site.listSiteShopProducts())[0];
    expect(h.sql.length).toBe(reads);
    expect(before.compareAtPrice).toBeUndefined();
    expect(before.compareAtPriceMinor).toBeUndefined();
    expect(during.compareAtPriceMinor).toBe(52000);
    expect(during.discountEndsAt).toBe("2026-10-24T20:59:59.999Z");
    expect(after.compareAtPrice).toBeUndefined();
    expect(after.discountStartsAt).toBeUndefined();
  });

  it("publish windows open and close over the same cached rows", async () => {
    caching();
    const monday = await site.listSiteHomeSlides(MONDAY);
    const postsMonday = await site.listSiteAppPosts(MONDAY);
    const before = h.sql.length;
    const saturday = await site.listSiteHomeSlides(SATURDAY);
    const postsSaturday = await site.listSiteAppPosts(SATURDAY);
    expect(h.sql.length).toBe(before);
    // The slide starts on Saturday: before it, the bundled slides.
    expect(monday.fromPanel).toBe(false);
    expect(saturday.fromPanel).toBe(true);
    // The post ends on Thursday.
    expect(postsMonday.map((p) => p.id)).toEqual(["apost-1"]);
    expect(postsSaturday).toEqual([]);
  });
});

// ── Decision paths never read through the cache ─────────────────────────

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

const CACHED_READERS =
  /@\/lib\/seo\/site-data|@\/lib\/cache\/presentation|\b(getSiteSettings|listSiteShopProducts|getSiteProductBySlug|listSiteMenu|getSiteLegalOverride|presentationCache)\b/;

describe("commercial paths stay live", () => {
  it.each([
    "src/app/odeme",
    "src/app/karaoke",
    "src/app/rezervasyon",
    "src/app/api",
    "src/app/admin",
    "src/lib/mobile",
    "src/lib/email",
    "src/lib/checkout",
    "src/lib/payment",
  ])("nothing under %s reads the presentation cache", (dir) => {
    const offenders = sourceFiles(dir).filter((f) =>
      CACHED_READERS.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("the consent versions and the karaoke terms read live", () => {
    const legal = readFileSync("src/lib/legal/store.ts", "utf8");
    expect(legal).not.toMatch(CACHED_READERS);
    for (const fn of ["checkoutConsentVersion", "karaokeConsentVersion"]) {
      const body = legal.slice(legal.indexOf(`export async function ${fn}`));
      expect(body).toMatch(/getPublishedLegalOverride\(slug\)/);
    }
    expect(readFileSync("src/lib/legal/karaoke-doc.ts", "utf8")).not.toMatch(
      CACHED_READERS,
    );
  });

  it("the store itself never reads through the cache", () => {
    expect(readFileSync("src/lib/admin/store.ts", "utf8")).not.toMatch(
      CACHED_READERS,
    );
  });

  it("getSettings stays a plain read", () => {
    const store = readFileSync("src/lib/admin/store.ts", "utf8");
    expect(store).toContain(
      "export async function getSettings(): Promise<AdminSettings> {",
    );
  });
});
