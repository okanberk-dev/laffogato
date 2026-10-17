import { describe, expect, it } from "vitest";

import { apiError, apiJson } from "@/lib/mobile/respond";

/**
 * docs/API-MOBILE.md §0: everything behind a bearer is `private, no-store`.
 *
 * The success path honoured it, the error path did not, so a 401, a 404
 * "Sipariş bulunamadı" and a 409 went out with Vercel's default
 * `public, max-age=0, must-revalidate`. A proxy that honours `public` can hand
 * one member's error to the next caller of the same URL.
 */
describe("mobile error responses are never cacheable", () => {
  it("marks every apiError private and no-store", () => {
    const res = apiError(404, "order_not_found", "Sipariş bulunamadı.");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("keeps the caller's own headers alongside it", () => {
    const res = apiError(401, "unauthorized", "Giriş yapman gerekiyor.", {
      "WWW-Authenticate": "Bearer",
    });
    expect(res.headers.get("www-authenticate")).toBe("Bearer");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("lets a caller override the header explicitly", () => {
    const res = apiError(429, "rate_limited", "Çok fazla deneme.", {
      "Cache-Control": "public, max-age=5",
    });
    expect(res.headers.get("cache-control")).toBe("public, max-age=5");
  });

  it("leaves a public success answer cacheable", () => {
    const res = apiJson(
      { ok: true },
      { headers: { "Cache-Control": "public, s-maxage=30" } },
    );
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=30");
  });
});

describe("apiError additive fields", () => {
  it("carries documented extras next to error and message", async () => {
    const res = apiError(
      409,
      "total_changed",
      "Sipariş tutarı değişti.",
      undefined,
      { totalMinor: 12500 },
    );
    expect(await res.json()).toEqual({
      error: "total_changed",
      message: "Sipariş tutarı değişti.",
      totalMinor: 12500,
    });
  });

  it("never lets an extra replace error or message", async () => {
    const res = apiError(400, "invalid_request", "Not çok uzun.", undefined, {
      error: "x",
      message: "y",
    });
    expect(await res.json()).toEqual({
      error: "invalid_request",
      message: "Not çok uzun.",
    });
  });
});
