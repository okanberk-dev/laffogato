import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The new-order bell over a Data Cache that stores late and loses an
 * expiry that arrives before it stored (the worst case the platform could
 * be): the route (`/admin/siparisler/uyari`), the change marker and the
 * write hook are the real ones; only the cache, the account and the order
 * rows are stand-ins.
 *
 * What it shows: a marker a request made itself never vouches for the
 * orders it read (the settle rule: its cursor's `fullAt` is before
 * `made + ORDER_ALERT_MARKER_SETTLE_MS`), and a marker read back from the
 * cache was stored before that read, so the orders read after it include
 * every write the late store could have hidden. However late the cache
 * stores, a paid order rings at the next poll. Only a write whose expiries
 * are both lost after the marker was stored waits for the hourly full
 * answer (docs/ADMIN.md "Yeni sipariş uyarısı").
 */

const cache = vi.hoisted(() => {
  const state = {
    /** How long after a miss the cache stores the new value. */
    storeAfterMs: 30_000,
    /** Expiries are dropped (a cache error). */
    dropExpiries: false,
    stored: new Map<string, { value: unknown; tags: string[] }>(),
    pending: [] as Array<{
      key: string;
      value: unknown;
      tags: string[];
      at: number;
    }>,
    /** What is stored by now becomes readable. */
    land() {
      const now = Date.now();
      state.pending = state.pending.filter((p) => {
        if (p.at > now) return true;
        state.stored.set(p.key, { value: p.value, tags: p.tags });
        return false;
      });
    },
  };
  return state;
});

vi.mock("next/cache", () => ({
  unstable_cache:
    (
      fn: (...a: unknown[]) => Promise<unknown>,
      keyParts: string[],
      opts: { tags?: string[] },
    ) =>
    async (...args: unknown[]) => {
      cache.land();
      const key = `${keyParts.join("|")}|${JSON.stringify(args)}`;
      const hit = cache.stored.get(key);
      if (hit) return hit.value;
      const value = await fn(...args);
      cache.pending.push({
        key,
        value,
        tags: opts.tags ?? [],
        at: Date.now() + cache.storeAfterMs,
      });
      return value;
    },
  // Expires what is stored; a value still on its way is not touched and
  // lands afterwards: the lost expiry.
  revalidateTag: (tag: string) => {
    if (cache.dropExpiries) throw new Error("cache service error");
    cache.land();
    for (const [key, entry] of cache.stored) {
      if (entry.tags.includes(tag)) cache.stored.delete(key);
    }
  },
}));
// The second expiry runs at once: the worst case, before the late store too.
vi.mock("next/server", () => ({ after: (task: () => void) => task() }));

const STAFF = { email: "barista@laffogato.net", role: "staff" };
vi.mock("@/lib/admin/auth", () => ({
  ADMIN_COOKIE_NAME: "laffogato_admin_session",
  getAdminSession: vi.fn(async () => STAFF),
  isAdminSessionUnavailable: () => false,
  readSessionFromCookieValue: (v: string | undefined) => (v ? STAFF : null),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "laffogato_admin_session"
        ? { value: "signed-token" }
        : undefined,
  }),
}));
const db = vi.hoisted(() => ({ rows: [] as unknown[], reads: 0 }));
vi.mock("@/lib/admin/store", () => ({
  listOrderAlertRows: vi.fn(async () => {
    db.reads += 1;
    return db.rows;
  }),
  getSettings: vi.fn(async () => ({ weeklyHours: {} })),
}));
vi.mock("@/lib/mobile/venue", () => ({
  getVenueStatus: vi.fn(async () => ({ manualOverride: "auto" })),
  // Open: the busy cadence, ten seconds.
  isCafeOpenNow: vi.fn(() => true),
}));

const { GET } = await import("@/app/admin/siparisler/uyari/route");
const { expireTags, tagsForWrite } = await import("@/lib/cache/tags");
const { ORDER_ALERT_FULL_REFRESH_MS, ORDER_ALERT_POLL_MS } =
  await import("@/lib/admin/order-alerts-core");

const START = Date.parse("2026-10-19T17:00:00.000Z");
const ROUTE = "https://laffogato.net/admin/siparisler/uyari";

interface Answer {
  unchanged?: true;
  alerts?: Array<{ id: string }>;
  cursor?: string;
}

/** The poller: sends back the last cursor, as the Worker does. */
function poller() {
  let cursor = "";
  return async (): Promise<Answer> => {
    const url = cursor ? `${ROUTE}?c=${encodeURIComponent(cursor)}` : ROUTE;
    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Answer;
    cursor = typeof body.cursor === "string" ? body.cursor : "";
    return body;
  };
}

function at(msFromStart: number) {
  vi.setSystemTime(START + msFromStart);
}

/** A table order is paid: the row, then the write hook's expiry. */
function payOrder() {
  db.rows = [
    {
      id: "ord-7",
      orderNo: 10234,
      status: "paid",
      kind: "cafe",
      source: "",
      fulfillment: "table",
      tableCode: "T4",
      tableName: "4",
      paidAt: new Date().toISOString(),
      totalMinor: 18_500,
      items: [{ productName: "Latte", qty: 2 }],
    },
  ];
  expireTags(tagsForWrite({ table: "orders" }));
}

const rings = (a: Answer) => (a.alerts ?? []).some((x) => x.id === "ord-7");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  at(0);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_slow");
  vi.stubEnv("LAF_DATA_CACHE", "");
  cache.storeAfterMs = 30_000;
  cache.dropExpiries = false;
  cache.stored.clear();
  cache.pending = [];
  db.rows = [];
  db.reads = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("the bell over a cache that stores late", () => {
  it.each([6_000, 12_000, 30_000, 90_000])(
    "stored %i ms late: a payment during the wait rings at the next poll",
    async (late) => {
      cache.storeAfterMs = late;
      const poll = poller();
      expect(rings(await poll())).toBe(false);
      // Paid three seconds later, while the marker is still on its way.
      at(3_000);
      payOrder();
      at(ORDER_ALERT_POLL_MS);
      expect(rings(await poll())).toBe(true);
    },
  );

  it.each([6_000, 30_000])(
    "stored %i ms late: a payment at any later moment rings at the next poll",
    async (late) => {
      cache.storeAfterMs = late;
      const poll = poller();
      for (let t = 0; t <= 120_000; t += ORDER_ALERT_POLL_MS) {
        at(t);
        expect(rings(await poll())).toBe(false);
      }
      at(123_000);
      payOrder();
      at(130_000);
      expect(rings(await poll())).toBe(true);
    },
  );

  it("a cache that stores at once answers unchanged without the orders, and still rings", async () => {
    cache.storeAfterMs = 0;
    const poll = poller();
    for (let t = 0; t <= 60_000; t += ORDER_ALERT_POLL_MS) {
      at(t);
      await poll();
    }
    const reads = db.reads;
    at(70_000);
    expect((await poll()).unchanged).toBe(true);
    expect(db.reads).toBe(reads);
    at(73_000);
    payOrder();
    at(80_000);
    expect(rings(await poll())).toBe(true);
  });

  it("both expiries lost after the marker was stored: the hourly full answer rings", async () => {
    cache.storeAfterMs = 0;
    const poll = poller();
    for (let t = 0; t <= 60_000; t += ORDER_ALERT_POLL_MS) {
      at(t);
      await poll();
    }
    cache.dropExpiries = true;
    at(63_000);
    payOrder();
    let rang = -1;
    for (
      let t = 70_000;
      t <= 60_000 + ORDER_ALERT_FULL_REFRESH_MS + ORDER_ALERT_POLL_MS;
      t += ORDER_ALERT_POLL_MS
    ) {
      at(t);
      if (rings(await poll())) {
        rang = t;
        break;
      }
    }
    expect(rang).toBeGreaterThan(0);
    expect(rang).toBeLessThanOrEqual(
      60_000 + ORDER_ALERT_FULL_REFRESH_MS + ORDER_ALERT_POLL_MS,
    );
  });
});
