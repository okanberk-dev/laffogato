import * as pageStaticInfo from "next/dist/build/analysis/get-page-static-info";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config as proxyConfig } from "@/proxy";

// Exported at runtime, left out of Next's type declarations.
const { getMiddlewareMatchers } = pageStaticInfo as unknown as {
  getMiddlewareMatchers: (
    matcher: unknown,
    nextConfig: object,
  ) => Array<{ regexp: string }>;
};

/**
 * The page proxy's two speed rules (9 Eki 2026). Production logged
 * "[supabase] getUser timed out" on every page a signed-in visitor opened -
 * and on `/laffogato-pour.js`, a static script - each held for the full
 * three-second bound.
 */

describe("the proxy matcher", () => {
  // Next's own compiler for `config.matcher` (the build runs this one), so
  // the `.rsc` / `_next/data` forms are tested as the router sees them.
  const [compiled] = getMiddlewareMatchers(proxyConfig.matcher, {});
  const matcher = new RegExp(compiled.regexp);

  it.each([
    "/",
    "/rehber/matcha-nedir",
    "/menu",
    "/menu.rsc",
    "/uye/hesap",
    "/uye/sifre-sifirla",
    "/odeme",
    "/masa/ABCDEFGHJK",
    "/gorsel/urun/prd-0001",
    "/admin",
    "/admin/siparisler",
    "/admin/siparisler.rsc",
    "/admin/siparisler/csv",
    "/admin/olay-kaydi/csv",
    "/admin/masalar/tbl-1/qr",
  ])("still runs on the page %s", (path) => {
    expect(matcher.test(path)).toBe(true);
  });

  // A file-like address under /admin still renders a panel page (a dynamic
  // `[id]`, the `[...rest]` 404): it keeps the panel CSP and the cookie move.
  it.each([
    "/admin/urunler/x.js",
    "/admin/siparisler/10001.txt",
    "/admin/kategoriler/x.xml",
    "/admin/nope.css",
    "/admin/logo.png",
  ])("keeps the panel address %s, file-like or not", (path) => {
    expect(matcher.test(path)).toBe(true);
  });

  it.each([
    "/laffogato-pour.js",
    "/llms.txt",
    "/robots.txt",
    "/sitemap.xml",
    "/browserconfig.xml",
    "/manifest.webmanifest",
    "/photos/facade-night.webp",
    "/brand/laf.svg",
    "/gorsel/urun/prd-0001.webp",
    "/api/mobile/v1/menu",
    "/_next/static/chunks/main.js",
  ])("leaves the static file %s alone", (path) => {
    expect(matcher.test(path)).toBe(false);
  });
});

const getClaims = vi.fn(async () => ({ data: { claims: {} }, error: null }));
const getUser = vi.fn(async () => ({ data: { user: null }, error: null }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims, getUser } }),
}));

describe("the session refresh", () => {
  afterEach(() => {
    getClaims.mockClear();
    getUser.mockClear();
  });

  it("verifies a signed-in visitor's token locally (getClaims), not with a round trip per page", async () => {
    const { updateSession } = await import("@/lib/supabase/proxy");
    const request = new NextRequest("https://laffogato.net/uye/hesap", {
      headers: { cookie: "sb-wvivcgctebyxojtyidfg-auth-token=base64-abc" },
    });
    await updateSession(request);
    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("asks nothing at all for an anonymous visitor", async () => {
    const { updateSession } = await import("@/lib/supabase/proxy");
    await updateSession(new NextRequest("https://laffogato.net/rehber"));
    expect(getClaims).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("keeps the three-second bound when the identity service hangs", async () => {
    vi.useFakeTimers();
    try {
      getClaims.mockImplementationOnce(() => new Promise(() => {}));
      const { updateSession } = await import("@/lib/supabase/proxy");
      const pending = updateSession(
        new NextRequest("https://laffogato.net/uye/hesap", {
          headers: { cookie: "sb-wvivcgctebyxojtyidfg-auth-token=base64-abc" },
        }),
      );
      await vi.advanceTimersByTimeAsync(3000);
      await expect(pending).resolves.toBeDefined();
      expect(getUser).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
