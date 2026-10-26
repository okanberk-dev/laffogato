import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import {
  SIGNATURE_HEADER,
  signedHeaders,
  TIMESTAMP_HEADER,
} from "@/lib/panel/karaoke-sync-core";

/**
 * `GET /api/pos/orders/version` - LafPOS, the café's till, asking every 20
 * seconds whether the online orders changed before it pulls
 * `/api/panel/orders`, and whether the karaoke bookings changed before it
 * pulls `/api/panel/karaoke` (docs/LAFPOS.md). What is pinned: only
 * LafPOS's own key opens it; the answer is `{version, karaoke}`, never
 * cached on the way; each comes from the Data Cache under its own tag
 * (`live:orders`, `live:karaoke`) and never from the database; `version`
 * moves with an order write and with nothing else, `karaoke` with a
 * booking write and with nothing else; and a cache that cannot say answers
 * "changed" every time.
 */

const h = vi.hoisted(() => ({
  entries: new Map<string, unknown>(),
  /** The tags each entry was stored under, as the Data Cache keeps them. */
  entryTags: new Map<string, string[]>(),
  made: [] as Array<{ keyParts: string[]; tags: string[] }>,
  broken: false,
}));

vi.mock("next/cache", () => ({
  // What an expired tag does: every entry stored under it is gone.
  revalidateTag: vi.fn((tag: string) => {
    for (const [key, tags] of h.entryTags) {
      if (tags.includes(tag)) h.entries.delete(key);
    }
  }),
  unstable_cache: (
    fn: () => Promise<unknown>,
    keyParts: string[],
    opts: { tags: string[] },
  ) => {
    h.made.push({ keyParts, tags: opts.tags });
    return async () => {
      if (h.broken) throw new Error("cache service down");
      const key = keyParts.join("|");
      if (!h.entries.has(key)) {
        h.entries.set(key, await fn());
        h.entryTags.set(key, opts.tags);
      }
      return h.entries.get(key);
    };
  },
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));

// The database's one door (CLAUDE.md rule 11): every store read goes
// through `getDb`, so a route that read anything would call this.
const db = vi.hoisted(() => ({
  getDb: vi.fn(() => {
    throw new Error("the version route must not reach the database");
  }),
}));
vi.mock("@/lib/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db")>()),
  getDb: db.getDb,
}));

const { GET } = await import("@/app/api/pos/orders/version/route");
const { expireTags, tagsForWrite } = await import("@/lib/cache/tags");

const LAFPOS = "lafpos-secret-0123456789-abcdefghijklmno";
const PANEL = "panel-secret-0123456789-abcdefghijklmnop";
const URL_ = "https://laffogato.net/api/pos/orders/version";

/** A request LafPOS would send: signed with `secret` for `path`, at `at`. */
function signed(
  opts: { secret?: string; at?: number; path?: string } = {},
): Request {
  const url = new URL(opts.path ?? URL_);
  return new Request(URL_, {
    headers: signedHeaders(
      opts.secret ?? LAFPOS,
      "GET",
      url,
      "",
      opts.at ?? Date.now(),
    ),
  });
}

async function markers(): Promise<{ version: string; karaoke: string }> {
  const res = await GET(signed());
  expect(res.status).toBe(200);
  const body = await res.json();
  for (const key of ["version", "karaoke"]) {
    expect(typeof body[key], key).toBe("string");
    expect(body[key], key).not.toBe("");
  }
  return body;
}

async function version(): Promise<string> {
  return (await markers()).version;
}

async function karaoke(): Promise<string> {
  return (await markers()).karaoke;
}

beforeEach(() => {
  h.entries.clear();
  h.entryTags.clear();
  h.made.length = 0;
  h.broken = false;
  db.getDb.mockClear();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_pos");
  vi.stubEnv("LAF_DATA_CACHE", "");
  vi.stubEnv("LAFPOS_SYNC_SECRET", LAFPOS);
  vi.stubEnv("KARAOKE_SYNC_SECRET", PANEL);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the gate", () => {
  it.each([
    ["unset", ""],
    ["too short to be one", "k".repeat(31)],
  ])(
    "is shut with 503 while LafPOS's key is %s, the panel's set or not",
    async (_, key) => {
      vi.stubEnv("LAFPOS_SYNC_SECRET", key);
      for (const panelKey of [PANEL, ""]) {
        vi.stubEnv("KARAOKE_SYNC_SECRET", panelKey);
        const res = await GET(signed({ secret: PANEL }));
        expect(res.status).toBe(503);
        expect(res.headers.get("cache-control")).toBe("no-store");
        expect(await res.json()).toEqual({ error: "not_configured" });
      }
      expect(h.made).toEqual([]);
    },
  );

  it("answers 401 to an unsigned, panel-signed, forged, stale or retargeted request", async () => {
    for (const req of [
      new Request(URL_),
      // The panel's key opens the panel routes, never this one.
      signed({ secret: PANEL }),
      signed({ secret: `${LAFPOS}-other` }),
      signed({ at: Date.now() - 6 * 60_000 }),
      signed({ path: "https://laffogato.net/api/panel/orders" }),
      new Request(URL_, {
        headers: {
          [TIMESTAMP_HEADER]: String(Math.floor(Date.now() / 1000)),
          [SIGNATURE_HEADER]: "v1=",
        },
      }),
    ]) {
      const res = await GET(req);
      expect(res.status).toBe(401);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await res.json()).toEqual({ error: "unauthorized" });
    }
    // Refused before the cache is even asked.
    expect(h.made).toEqual([]);
  });
});

describe("the version", () => {
  it("is {version, karaoke}, uncached, and the same until an order is written", async () => {
    const res = await GET(signed());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    // `version` as before; `karaoke` is an addition a LafPOS that reads
    // only `version` never sees.
    expect(Object.keys(body)).toEqual(["version", "karaoke"]);
    expect(body.karaoke).not.toBe(body.version);
    expect(await version()).toBe(body.version);

    // An order placed, paid or moved on: what the data layer's write hook
    // expires after it (src/lib/db/index.ts).
    expireTags(tagsForWrite({ table: "orders" }));
    const next = await version();
    expect(next).not.toBe(body.version);
    expect(await version()).toBe(next);

    // A refund or a line's state goes through an rpc tagged the same way.
    expireTags(tagsForWrite({ fn: "set_order_item_status" }));
    expect(await version()).not.toBe(next);
  });

  it("does not move for a write that is not an order's", async () => {
    const first = await version();
    for (const table of [
      "menu_items",
      "karaoke_reservations",
      "settings",
      // A panel account: the panel's own markers move, LafPOS's does not.
      "admin_users",
    ]) {
      expireTags(tagsForWrite({ table }));
      expect(await version(), table).toBe(first);
    }
  });

  it("sits under live:orders alone, apart from the panel's order marker", async () => {
    await version();
    expect(h.made).toContainEqual({
      keyParts: ["laf-marker-pos-orders", "dpl_pos", expect.any(String)],
      tags: ["live:orders"],
    });
  });

  it("is new on every ask when the cache cannot say: LafPOS then pulls every time", async () => {
    vi.stubEnv("LAF_DATA_CACHE", "off");
    expect(await version()).not.toBe(await version());
    expect(await karaoke()).not.toBe(await karaoke());
    vi.stubEnv("LAF_DATA_CACHE", "");
    h.broken = true;
    expect(await version()).not.toBe(await version());
    expect(await karaoke()).not.toBe(await karaoke());
    h.broken = false;
    vi.stubEnv("NODE_ENV", "test");
    expect(await version()).not.toBe(await version());
    expect(await karaoke()).not.toBe(await karaoke());
  });

  it("never reaches the database", async () => {
    // The spy is the module the store reads through, not a stand-in.
    expect((await import("@/lib/db")).getDb).toBe(db.getDb);
    await version();
    expireTags(tagsForWrite({ table: "orders" }));
    expireTags(tagsForWrite({ table: "karaoke_reservations" }));
    await version();
    vi.stubEnv("LAF_DATA_CACHE", "off");
    await version();
    vi.stubEnv("LAF_DATA_CACHE", "");
    h.broken = true;
    await version();
    vi.stubEnv("LAFPOS_SYNC_SECRET", "");
    await GET(signed());
    expect(db.getDb).not.toHaveBeenCalled();
  });
});

describe("the karaoke marker", () => {
  it("stays the same until a karaoke booking is written", async () => {
    const first = await karaoke();
    expect(await karaoke()).toBe(first);

    // A booking made, paid, confirmed, moved or cancelled: the write hook
    // expires `live:karaoke` after it (src/lib/db/index.ts).
    expireTags(tagsForWrite({ table: "karaoke_reservations" }));
    const next = await karaoke();
    expect(next).not.toBe(first);
    expect(await karaoke()).toBe(next);

    // An hour resold or given back goes through an rpc tagged the same way,
    // and so does the nightly retention of old bookings.
    for (const fn of [
      "karaoke_charge_resold_hours",
      "karaoke_give_make_good_hour",
      "karaoke_reservation_retention",
    ]) {
      const before = await karaoke();
      expireTags(tagsForWrite({ fn }));
      expect(await karaoke(), fn).not.toBe(before);
    }
  });

  it("does not move for an order, and a booking does not move the version", async () => {
    const { version: v, karaoke: k } = await markers();
    for (const table of ["orders", "menu_items", "settings", "admin_users"]) {
      expireTags(tagsForWrite({ table }));
      expect(await karaoke(), table).toBe(k);
    }
    const now = await version();
    expect(now).not.toBe(v);
    expireTags(tagsForWrite({ table: "karaoke_reservations" }));
    expect(await version()).toBe(now);
    expect(await karaoke()).not.toBe(k);
  });

  it("sits under live:karaoke alone, apart from the panel's karaoke marker", async () => {
    await karaoke();
    expect(h.made).toEqual([
      {
        keyParts: ["laf-marker-pos-orders", "dpl_pos", expect.any(String)],
        tags: ["live:orders"],
      },
      {
        keyParts: ["laf-marker-pos-karaoke", "dpl_pos", expect.any(String)],
        tags: ["live:karaoke"],
      },
    ]);
  });
});
