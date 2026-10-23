import * as pageStaticInfo from "next/dist/build/analysis/get-page-static-info";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config as proxyConfig, proxy } from "@/proxy";

// Exported at runtime, left out of Next's type declarations.
const { getMiddlewareMatchers } = pageStaticInfo as unknown as {
  getMiddlewareMatchers: (
    matcher: unknown,
    nextConfig: object,
  ) => Array<{ regexp: string }>;
};

/**
 * A backslash in the path answered 500 on Vercel: the pages-router lookup
 * tried to require `.next/server/pages/karaoke%5C.js` (MODULE_NOT_FOUND,
 * ~60 log lines on 20 and 21 Eki 2026). The proxy now answers every such
 * path with a 404 before the router sees it.
 */

// The addresses from the log, plus the corners: lower case, a backslash
// mid-path, under the panel and the API.
const BACKSLASH_PATHS = [
  "/karaoke%5C",
  "/hikayemiz%5C",
  "/ziyaret%5C%5C%5C",
  "/hukuk%5C",
  "/rehber%5C",
  "/kampanyalar%5C",
  "/%5C%5C%5C",
  "/%5C",
  "/%5c",
  "/%5Cevil.example",
  "/%5C%5Cevil.example/x",
  "/rehber%5Cmatcha-nedir",
  "/admin%5C",
  "/admin/siparisler%5C",
];

// `/api/*` keeps the route handlers' own answer (the app reads `{error,
// message}`, docs/API-MOBILE.md): the proxy never answers a backslash there.
const API_BACKSLASH_PATHS = [
  "/api/mobile/v1/menu%5C",
  "/api/mobile/v1/tables/%5C%5C",
  "/api/mobile/v1/menu\\",
  "/api/webhooks/payment%5C",
  "/api/cron/daily%5C",
  "/api/bulten%5C",
];

describe("the proxy matcher and a backslash", () => {
  // Next's own compiler for `config.matcher`; the router tests both the
  // raw and the decoded path against it (resolve-routes.js), so both are
  // tested here.
  const matchers = getMiddlewareMatchers(proxyConfig.matcher, {}).map(
    (m) => new RegExp(m.regexp),
  );
  const reaches = (path: string) => matchers.some((re) => re.test(path));

  it.each([
    ...BACKSLASH_PATHS,
    // Where the first matcher steps aside: static files and Next's assets.
    "/laffogato-pour%5C.js",
    "/brand/laf.svg%5C",
    "/_next/static/%5C",
    // Decoded, as the router also tries it.
    "/karaoke\\",
    "/\\\\\\",
  ])("reaches %s", (path) => {
    expect(reaches(path)).toBe(true);
  });

  // The fast path holds: the second entry only adds backslash paths.
  it.each([
    "/laffogato-pour.js",
    "/brand/laf.svg",
    "/_next/static/chunks/main.js",
    "/api/mobile/v1/menu",
    "/api/webhooks/payment",
    "/api/cron/daily",
    "/api/bulten",
    "/api/mobile/v1/tables/%5Bx%5D",
    ...API_BACKSLASH_PATHS,
  ])("still leaves %s alone", (path) => {
    expect(reaches(path)).toBe(false);
  });
});

describe("the proxy and a backslash", () => {
  it.each(BACKSLASH_PATHS)(
    "answers %s with a 404, no redirect",
    async (path) => {
      for (const method of ["GET", "HEAD", "POST"]) {
        const res = await proxy(
          new NextRequest(`https://laffogato.net${path}?a=1`, { method }),
        );
        expect(res.status).toBe(404);
        expect(res.headers.get("location")).toBeNull();
        expect(res.headers.get("x-middleware-next")).toBeNull();
        expect(res.headers.get("x-middleware-rewrite")).toBeNull();
      }
    },
  );

  it("answers a static file's and an asset's backslash path too", async () => {
    for (const path of ["/_next/static/%5C", "/laffogato-pour%5C.js"]) {
      const res = await proxy(new NextRequest(`https://laffogato.net${path}`));
      expect(res.status).toBe(404);
    }
  });

  it.each([...API_BACKSLASH_PATHS, "/api/panel/menu%5C"])(
    "leaves %s to its route handler (the API's own error shape)",
    async (path) => {
      const res = await proxy(new NextRequest(`https://laffogato.net${path}`));
      expect(res.status).toBe(200);
      expect(res.headers.get("x-middleware-next")).toBe("1");
    },
  );

  it("lets an ordinary API path through as before", async () => {
    const res = await proxy(
      new NextRequest("https://laffogato.net/api/panel/menu"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not mistake a percent-encoded letter for a backslash", async () => {
    const res = await proxy(
      new NextRequest("https://laffogato.net/api/panel/%5Bx%5D"),
    );
    expect(res.status).toBe(200);
  });
});
