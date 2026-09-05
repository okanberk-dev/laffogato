import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

const css = read("src/app/globals.css");
const manifest = read("src/app/manifest.ts");
const slidePreview = read("src/app/admin/magaza-hero/slide-form.tsx");
const ogImage = read("src/app/opengraph-image.tsx");
const emails = read("src/lib/email/send.ts");

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

  it("tints its shadows with the app's shadow colour, not the espresso brown", () => {
    // tokens.ts light.shadow #12291F = 18,41,31. The old rgba(74,52,22,…) was
    // the last surface still lit by the retired köşk palette.
    expect(css).toContain("rgba(18, 41, 31,");
    expect(css).not.toContain("rgba(74, 52, 22,");
  });
});

/**
 * The palette is not only globals.css.
 *
 * The PWA manifest paints the install splash and the Android status bar, and
 * the hero preview is what an operator picks a text theme against — both sat
 * on the retired cream/espresso set long after the site itself moved.
 */
describe("surfaces outside globals.css follow the same palette", () => {
  it("installs the PWA on the app's canvas and night, matching layout.tsx", () => {
    expect(manifest).toContain('background_color: "#f9f8f7"');
    expect(manifest).toContain('theme_color: "#12291f"');
    for (const hex of ["#FBF4E6", "#2C1D11"]) {
      expect(manifest, `${hex} belongs to the old köşk palette`).not.toContain(
        hex,
      );
    }
  });

  it("previews the shop hero without the köşk cream and terracotta", () => {
    for (const hex of ["#6E4220", "#2F1F10", "#F5E6D3", "#E6D4B0", "#8A6332"]) {
      expect(
        slidePreview,
        `${hex} belongs to the old köşk palette`,
      ).not.toContain(hex);
    }
  });

  /**
   * next/og and e-mail HTML are rasterised or inlined where CSS variables do
   * not resolve, so both spell the palette out. That is the only reason they
   * kept the retired one long after globals.css moved.
   */
  it("shares the link preview on the app's espresso green, not the brown", () => {
    expect(ogImage).toContain("#12291f"); // --bg-espresso
    expect(ogImage).toContain("#f9f8f7"); // --bg
    expect(ogImage).toContain("#e8c877"); // --gold-soft
    for (const hex of ["#14100B", "#1F1813", "#2D2418", "#FAF6EE", "#C9A05A"]) {
      expect(ogImage, `${hex} belongs to the old köşk palette`).not.toContain(
        hex,
      );
    }
  });

  it("sends transactional mail in the app's ink, green and gold", () => {
    expect(emails).toContain("background:#235347"); // --brand, the button
    expect(emails).toContain("color:#1d1c1c"); // --ink
    for (const hex of [
      "#3A2A20",
      "#F6EFE4",
      "#C49A5A",
      "#8a7a6c",
      "#a89a8c",
      "#8a6a3c",
      "#e7ddcf",
    ]) {
      expect(emails, `${hex} belongs to the old köşk palette`).not.toContain(
        hex,
      );
    }
  });
});
