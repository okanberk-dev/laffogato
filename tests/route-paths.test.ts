import { describe, it, expect } from "vitest";

import { ROUTE_PATHS, productPath } from "@/components/laffogato/route-paths";

describe("customer SPA routes", () => {
  it("no longer exposes a franchise or reels route", () => {
    expect(Object.keys(ROUTE_PATHS)).not.toContain("franchise");
    expect(Object.keys(ROUTE_PATHS)).not.toContain("reels");
    expect(JSON.stringify(ROUTE_PATHS)).not.toMatch(/franchise/i);
    expect(JSON.stringify(ROUTE_PATHS)).not.toMatch(/reels/i);
  });

  it("keeps the core customer sections", () => {
    expect(ROUTE_PATHS).toMatchObject({
      home: "/",
      menu: "/menu",
      shop: "/magaza",
      story: "/hikayemiz",
      visit: "/ziyaret",
    });
  });

  it("builds product detail paths under /magaza/urun", () => {
    expect(productPath("sirena-espresso")).toBe("/magaza/urun/sirena-espresso");
  });
});
