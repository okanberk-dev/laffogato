import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * docs/API-MOBILE.md §0: an answer that depends on who is asking is
 * `private, no-store`.
 *
 * `apiError` has carried it since tests/mobile-error-cache.test.ts; the 200s
 * relied on each route remembering `{ private: true }`, and two of them had
 * stopped. Both took an OPTIONAL bearer - `/orders/preview` and
 * `/promo/preview` - and both hand the member they read to the pricing code,
 * so the same basket and the same coupon answer differently per member. The
 * leak path was narrow (a POST is not cached by a shared cache without
 * explicit freshness), but the rule eroding file by file is the real damage:
 * whoever writes the next endpoint copies whichever example they open.
 *
 * So this is a source scan, not a response assertion: it holds for endpoints
 * that do not exist yet.
 */

const ROOT = join(process.cwd(), "src/app/api/mobile/v1");

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) routeFiles(p, out);
    else if (entry === "route.ts") out.push(p);
  }
  return out;
}

const routes = routeFiles(ROOT).map((path) => ({
  path: path.slice(ROOT.length + 1),
  source: readFileSync(path, "utf8"),
}));

const identityAware = routes.filter((r) =>
  /\b(requireMobileCustomer|optionalMobileCustomer)\b/.test(r.source),
);

describe("mobile endpoints that read a bearer", () => {
  it("found the routes to check", () => {
    expect(routes.length).toBeGreaterThan(15);
    expect(identityAware.length).toBeGreaterThan(10);
  });

  it("marks every success answer private and no-store", () => {
    for (const route of identityAware) {
      const calls = route.source.match(/apiJson\(/g)?.length ?? 0;
      const privates = route.source.match(/private:\s*true/g)?.length ?? 0;
      expect(
        privates,
        `${route.path}: ${calls} apiJson, ${privates} private`,
      ).toBe(calls);
    }
  });

  it("covers the two endpoints the audit found", () => {
    const paths = identityAware.map((r) => r.path);
    expect(paths).toContain("orders/preview/route.ts");
    expect(paths).toContain("promo/preview/route.ts");
  });
});
