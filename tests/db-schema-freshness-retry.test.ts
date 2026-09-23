import type { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `ensureSchemaFresh` runs ahead of every query and swallows its own failure
 * so an outage reaches the caller as an ordinary query error. It also used to
 * REMEMBER that failure for the life of the instance: one connection blip at
 * cold start, and the migrations shipped with that deploy were never applied
 * by it (docs/AUDIT.md §8, "Açık" 10).
 */
describe("ensureSchemaFresh after a failed check", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("tries again once the retry window has passed, not on every query", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T10:00:00Z"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ensureSchemaFresh } = await import("@/lib/db/bootstrap");
    const connect = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const pool = { connect } as unknown as Pool;

    await ensureSchemaFresh(pool);
    await ensureSchemaFresh(pool);
    expect(connect).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-09-23T10:00:10Z"));
    await ensureSchemaFresh(pool);
    expect(connect).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-09-23T10:00:31Z"));
    await ensureSchemaFresh(pool);
    expect(connect).toHaveBeenCalledTimes(2);
  });
});
