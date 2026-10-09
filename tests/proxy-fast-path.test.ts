import { readFileSync } from "node:fs";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The page proxy's two speed rules (9 Eki 2026). Production logged
 * "[supabase] getUser timed out" on every page a signed-in visitor opened -
 * and on `/laffogato-pour.js`, a static script - each held for the full
 * three-second bound.
 */

describe("the proxy matcher", () => {
  const source = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
  const pattern = /matcher:\s*\[\s*(?:\/\/.*\n\s*)*"([^"]+)"/.exec(source)?.[1];
  // Next reads the matcher as a path pattern; anchored, it is this regex.
  const matcher = new RegExp(`^${(pattern ?? "").replace(/\\\\/g, "\\")}$`);

  it.each([
    "/",
    "/rehber/matcha-nedir",
    "/menu",
    "/uye/hesap",
    "/admin/siparisler",
    "/odeme",
  ])("still runs on the page %s", (path) => {
    expect(matcher.test(path)).toBe(true);
  });

  it.each([
    "/laffogato-pour.js",
    "/llms.txt",
    "/robots.txt",
    "/sitemap.xml",
    "/browserconfig.xml",
    "/photos/facade-night.webp",
    "/brand/laf.svg",
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
    const request = new NextRequest("https://laffogato.net/", {
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
});
