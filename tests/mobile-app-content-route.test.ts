import { beforeEach, describe, expect, it, vi } from "vitest";

import { DbUnreachableError } from "@/lib/db/health";

/**
 * `GET /app-content` answered 503 `unavailable` for ANY throw, with no
 * Turkish `message`. A mapper that trips over one bad row then looks like a
 * database outage: the app retries into its bundled seed and the on-call goes
 * looking at the database instead of the data.
 */

const listActiveAppSlides = vi.fn();
const listActiveAppAnnouncements = vi.fn(async () => []);
const listActiveAppPosts = vi.fn(async () => []);

vi.mock("@/lib/admin/store", () => ({
  listActiveAppSlides,
  listActiveAppAnnouncements,
  listActiveAppPosts,
}));

const { GET } = await import("@/app/api/mobile/v1/app-content/route");

beforeEach(() => {
  listActiveAppSlides.mockReset();
});

describe("app-content failure mapping", () => {
  it("reports an unreachable database as a retryable 503 with a message", async () => {
    listActiveAppSlides.mockRejectedValue(
      new DbUnreachableError("listActiveAppSlides", "ECONNREFUSED"),
    );
    const res = await GET();
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("unavailable");
    expect(body.message.length).toBeGreaterThan(0);
  });

  it("reports a bug as a 500, not as an outage", async () => {
    listActiveAppSlides.mockRejectedValue(
      new TypeError("Cannot read properties of undefined"),
    );
    const res = await GET();
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("internal");
    expect(body.message.length).toBeGreaterThan(0);
  });

  it("keeps the editorial answer publicly cacheable", async () => {
    listActiveAppSlides.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toMatch(/^public, s-maxage=60/);
  });
});
