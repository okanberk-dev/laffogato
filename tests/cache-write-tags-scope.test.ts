import { describe, expect, it, vi } from "vitest";

/**
 * Outside a Next request (a script, a plain test, a database integration
 * test) there is nothing to expire: the real `revalidateTag` and `after`
 * refuse, and `expireTags` must swallow both, or every write made outside
 * a request would throw after it committed. No mock of next/cache here on
 * purpose.
 */

const { expireTags, ALL_CACHE_TAGS } = await import("@/lib/cache/tags");

describe("expireTags outside a request", () => {
  it("does nothing and throws nothing with the real next/cache", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => expireTags([...ALL_CACHE_TAGS])).not.toThrow();
    // Quiet outside production.
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("logs [cache-tags] in production, still without throwing", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => expireTags(["pub:site"])).not.toThrow();
    expect(warn.mock.calls[0]?.[0]).toMatch(/^\[cache-tags\] pub:site/);
    warn.mockRestore();
    vi.unstubAllEnvs();
  });
});
