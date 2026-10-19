import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The change markers behind the panel's cheap polls
 * (src/lib/admin/change-marker.ts): a random token in the Data Cache under
 * the table's tag, made without the database, replaced whenever a write
 * expires the tag. Null whenever the cache cannot say, and null means
 * "read the database".
 */

const h = vi.hoisted(() => ({
  entries: new Map<string, unknown>(),
  made: [] as Array<{ keyParts: string[]; tags: string[] }>,
  broken: false,
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (
    fn: () => Promise<unknown>,
    keyParts: string[],
    opts: { tags: string[] },
  ) => {
    h.made.push({ keyParts, tags: opts.tags });
    return async () => {
      if (h.broken) throw new Error("cache service down");
      const key = keyParts.join("|");
      if (!h.entries.has(key)) h.entries.set(key, await fn());
      return h.entries.get(key);
    };
  },
}));
const settings = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/admin/store", () => ({
  getSettings: vi.fn(async () => {
    if (settings.fail) throw new Error("ECONNREFUSED");
    return { weeklyHours: {} };
  }),
}));
vi.mock("@/lib/mobile/venue", () => ({
  getVenueStatus: vi.fn(async () => ({ manualOverride: "closed" })),
  isCafeOpenNow: vi.fn((_h: unknown, override: string) => override === "open"),
}));

const marker = await import("@/lib/admin/change-marker");
const { isChangeMarker, markerMadeAt } =
  await import("@/lib/admin/order-alerts-core");

beforeEach(() => {
  h.entries.clear();
  h.made.length = 0;
  h.broken = false;
  settings.fail = false;
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_marker");
  vi.stubEnv("LAF_DATA_CACHE", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("change markers", () => {
  it("are made in the shape the cursor accepts, stamped with their time", () => {
    const at = Date.parse("2026-10-19T20:00:00.000Z");
    const m = marker.newChangeMarker(at);
    expect(isChangeMarker(m)).toBe(true);
    expect(markerMadeAt(m)).toBe(at);
    expect(marker.newChangeMarker(at)).not.toBe(m);
  });

  it("stay the same until the tag is expired, then change", async () => {
    const first = await marker.readChangeMarker("orders");
    expect(first).not.toBeNull();
    expect(await marker.readChangeMarker("orders")).toBe(first);
    h.entries.clear(); // what an expired tag does to the entry
    const next = await marker.readChangeMarker("orders");
    expect(next).not.toBeNull();
    expect(next).not.toBe(first);
  });

  it("sit under their table's tag, keyed by the deployment", async () => {
    await marker.readChangeMarker("orders");
    await marker.readChangeMarker("karaoke");
    expect(h.made.map((m) => [m.keyParts[0], m.keyParts[1], m.tags])).toEqual([
      ["laf-marker-orders", "dpl_marker", ["live:orders"]],
      ["laf-marker-karaoke", "dpl_marker", ["live:karaoke"]],
    ]);
  });

  it("are null when the cache cannot say: off, switched off, or failing", async () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(await marker.readChangeMarker("orders")).toBeNull();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LAF_DATA_CACHE", "off");
    expect(await marker.readChangeMarker("orders")).toBeNull();
    vi.stubEnv("LAF_DATA_CACHE", "");
    h.broken = true;
    expect(await marker.readChangeMarker("orders")).toBeNull();
  });
});

describe("the busy window from cached inputs", () => {
  it("reads the override and the hours (closed here: not busy)", async () => {
    expect(await marker.cachedBusyWindow(Date.now())).toBe(false);
  });

  it("a read that fails answers busy", async () => {
    settings.fail = true;
    expect(await marker.cachedBusyWindow(Date.now())).toBe(true);
  });
});
