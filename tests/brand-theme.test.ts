import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/**
 * The site's palette is the mobile app's.
 *
 * Operator instruction, 2 Eyl 2026: the app was built on the Starbucks-derived
 * theme (laffogato-mobil/docs/THEME.md) and the site follows it, so the brand
 * reads the same on both surfaces. This file used to pin the opposite
 * decision — a warm terracotta accent replacing a house green — and is kept,
 * inverted, so the swap cannot be undone by accident.
 *
 * The values are asserted against the app's own tokens; contrast is a separate
 * guard in contrast.test.ts.
 */
describe("palette parity with the mobile app", () => {
  it("paints the house green the app paints", () => {
    // tokens.ts → brand.primary
    expect(css).toContain("--brand: #235347");
    // tokens.ts → state.success, the same green
    expect(css).toContain("--matcha: #235347");
  });

  it("uses the app's burgundy as the accent", () => {
    // tokens.ts → accent.burgundy / accent.burgundyPressed
    expect(css).toContain("--accent: #84233c");
    expect(css).toContain("--accent-deep: #6e1d32");
  });

  it("drops the heritage cream and terracotta set", () => {
    for (const hex of ["#c0643a", "#97461f", "#f7f3ea", "#241c15"]) {
      expect(css, `${hex} belongs to the old köşk palette`).not.toContain(hex);
    }
  });

  it("is not Starbucks' own green — the theme is derived, not copied", () => {
    expect(css).not.toContain("#00754a");
    expect(css).not.toContain("#005c3a");
  });

  it("no longer ships the legacy --green token", () => {
    expect(css).not.toContain("var(--green)");
    expect(css).not.toContain("#2f7a4e");
  });
});
