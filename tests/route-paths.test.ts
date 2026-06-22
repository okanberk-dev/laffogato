import { describe, it, expect } from "vitest";

import { ROUTE_PATHS, productPath } from "@/components/laffogato/route-paths";

describe("customer SPA routes", () => {
  it("no longer exposes a franchise route", () => {
    expect(Object.keys(ROUTE_PATHS)).not.toContain("franchise");
    expect(JSON.stringify(ROUTE_PATHS)).not.toMatch(/franchise/i);
  });

  it("keeps the core customer sections", () => {
    expect(ROUTE_PATHS).toMatchObject({
      home: "/",
      menu: "/menu",
      shop: "/magaza",
      story: "/hikayemiz",
      reels: "/reels",
      visit: "/ziyaret",
    });
  });

  it("builds product detail paths under /magaza/urun", () => {
    expect(productPath("sirena-espresso")).toBe("/magaza/urun/sirena-espresso");
  });
});
