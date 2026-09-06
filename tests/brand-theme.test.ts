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
 * The site's palette is the Köşk redesign's.
 *
 * Operator instruction, 5 Eyl 2026: two homepage studies were drawn (Köşk and
 * Bold), Köşk was picked, then revised once more onto a white ground in the
 * Starbucks TR mould. The reference is `Laffogato Site.dc.html`.
 *
 * This file has now pinned three successive decisions — heritage köşk, then
 * the mobile app's tokens (2 Eyl), now the Köşk redesign — and is kept, each
 * time inverted, because the failure mode it guards is real: a palette that
 * drifts one hex at a time until half the site is on the previous one. The
 * `not.toContain` assertions are the load-bearing half.
 *
 * Note on the phone: the 2 Eyl swap existed to make site and app read alike,
 * and that parity is now PARTIAL — the greens still line up, the ground moved
 * cream → white and the accent burgundy → terracotta. If the app is re-skinned
 * to match, `lafmobil`'s src/theme/tokens.ts is the file to move. Contrast is a
 * separate guard in contrast.test.ts.
 */
describe("palette follows the Köşk redesign", () => {
  it("paints the house green", () => {
    expect(css).toContain("--brand: #143d2b");
    expect(css).toContain("--bg-espresso: #143d2b");
    expect(css).toContain("--matcha: #1e7c4b");
  });

  it("uses terracotta as the accent, not the app's burgundy", () => {
    expect(css).toContain("--accent: #c0643a");
    expect(css).toContain("--accent-deep: #97461f");
    expect(css).not.toContain("#84233c");
    expect(css).not.toContain("#6e1d32");
  });

  it("sits on a white ground", () => {
    expect(css).toContain("--bg: #ffffff");
    // The retired grounds: the app's canvas and the heritage köşk cream.
    expect(css).not.toContain("#f9f8f7");
    expect(css).not.toContain("#f7f3ea");
  });

  it("is not Starbucks' own green — the theme is derived, not copied", () => {
    expect(css).not.toContain("#00754a");
    expect(css).not.toContain("#005c3a");
  });

  it("tints its shadows with the house green", () => {
    // --bg-espresso #143D2B = 20,61,43. Both earlier shadow colours — the
    // espresso brown and the app's darker green — are gone.
    expect(css).toContain("rgba(20, 61, 43,");
    expect(css).not.toContain("rgba(74, 52, 22,");
    expect(css).not.toContain("rgba(18, 41, 31,");
  });

  it("ships one typeface, and it is not a retired one", () => {
    // Montserrat, set by the operator's reference design (6 Eyl 2026). The
    // reference is drawn in Sofia Pro, which is licensed; Montserrat is the
    // nearest Google Fonts face and matches its width and its circular
    // letterforms, which Plus Jakarta Sans did not.
    expect(css).toContain("Montserrat");
    expect(css).not.toContain("Plus Jakarta Sans");
    expect(css).not.toContain("Hanken Grotesk");
    expect(css).not.toContain("JetBrains Mono");
  });
});

/**
 * The palette is not only globals.css.
 *
 * The PWA manifest paints the install splash and the Android status bar, and
 * the hero preview is what an operator picks a text theme against — both sat
 * on a retired set long after the site itself moved, twice.
 */
describe("surfaces outside globals.css follow the same palette", () => {
  it("installs the PWA on the site's ground and night, matching layout.tsx", () => {
    expect(manifest).toContain('background_color: "#ffffff"');
    expect(manifest).toContain('theme_color: "#143d2b"');
    for (const hex of ["#FBF4E6", "#2C1D11", "#f9f8f7", "#12291f"]) {
      expect(manifest, `${hex} belongs to a retired palette`).not.toContain(
        hex,
      );
    }
  });

  it("previews the shop hero on tokens rather than hexes of its own", () => {
    for (const hex of ["#6E4220", "#2F1F10", "#F5E6D3", "#E6D4B0", "#8A6332"]) {
      expect(slidePreview, `${hex} belongs to a retired palette`).not.toContain(
        hex,
      );
    }
  });

  /**
   * next/og and e-mail HTML are rasterised or inlined where CSS variables do
   * not resolve, so both spell the palette out. That is the only reason they
   * kept a retired one long after globals.css moved.
   */
  it("shares the link preview on the house green", () => {
    expect(ogImage).toContain("#143d2b"); // --bg-espresso
    expect(ogImage).toContain("#ffffff"); // --bg
    expect(ogImage).toContain("#e8d3a4"); // --gold-soft
    for (const hex of ["#14100B", "#1F1813", "#2D2418", "#FAF6EE", "#C9A05A"]) {
      expect(ogImage, `${hex} belongs to a retired palette`).not.toContain(hex);
    }
  });

  it("sends transactional mail in the site's ink, green and gold", () => {
    expect(emails).toContain("background:#143d2b"); // --brand, the button
    expect(emails).toContain("color:#201c17"); // --ink
    // The site dropped its serif; the mail should not still be setting one.
    expect(emails).toContain("Montserrat");
    expect(emails).not.toContain("Times New Roman");
    for (const hex of [
      "#3A2A20",
      "#F6EFE4",
      "#C49A5A",
      "#8a7a6c",
      "#a89a8c",
      "#8a6a3c",
      "#e7ddcf",
      "#235347",
    ]) {
      expect(emails, `${hex} belongs to a retired palette`).not.toContain(hex);
    }
  });
});
