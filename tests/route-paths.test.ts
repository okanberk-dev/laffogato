import { readFileSync } from "node:fs";

import { describe, it, expect } from "vitest";

import { ROUTE_PATHS, productPath } from "@/components/laffogato/route-paths";
import { MENU_CATEGORY_ROUTES, SHOP_CATEGORY_ROUTES } from "@/lib/seo/pages";

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

describe("navigation targets", () => {
  it("only links menu categories that have a route", () => {
    const chrome = readFileSync("src/components/laffogato/chrome.tsx", "utf8");
    // The dropdown must be derived, not hand-listed: a hand-kept copy drifted
    // and shipped two 404s in the header for months.
    expect(chrome).toContain("MENU_CATEGORY_ROUTES.filter");
    expect(chrome).not.toMatch(/slug: "(affogato|gelato)"/);
    const navEntries = MENU_CATEGORY_ROUTES.filter((c) => c.nav);
    expect(navEntries.length).toBeGreaterThan(3);
    for (const entry of navEntries) {
      expect(MENU_CATEGORY_ROUTES.some((c) => c.slug === entry.slug)).toBe(
        true,
      );
    }
  });

  it("only links shop categories that have a route", () => {
    const chrome = readFileSync("src/components/laffogato/chrome.tsx", "utf8");
    const slugs = [...chrome.matchAll(/\{ slug: "([a-z-]+)", label:/g)].map(
      (m) => m[1],
    );
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      expect(SHOP_CATEGORY_ROUTES.some((c) => c.slug === slug)).toBe(true);
    }
  });
});
