import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

const css = read("src/app/globals.css");
const manifest = read("src/app/manifest.ts");
const slidePreview = read("src/app/admin/magaza-hero/slide-form.tsx");
const ogImage = read("src/app/opengraph-image.tsx");
/**
 * The mail markup used to live in send.ts as template literals; it now sits in
 * src/lib/email/templates/*.html and send.ts only fills the fields. The guard
 * follows the paint — reading both means the retired-colour ban below covers
 * the templates too.
 */
const emails = [
  read("src/lib/email/send.ts"),
  ...readdirSync(join(process.cwd(), "src/lib/email/templates"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => read(join("src/lib/email/templates", f))),
].join("\n");

/** lafmobil's accent.burgundy / burgundyDeep / bg.accentSubtle, verbatim. */
const APP_BURGUNDY = ["#84233C", "#4A0F1E", "#F6E9EC"] as const;

/**
 * The site's palette is the Köşk redesign's, on the tricolore.
 *
 * Operator instruction, 5 Eyl 2026: two homepage studies were drawn (Köşk and
 * Bold), Köşk was picked, then revised onto a white ground in the Starbucks TR
 * mould. Then 7 Eyl: "italya bayrağı renklerini kullan … bunlara yakışan bordo
 * ekle" — keep the green, add the flag's red as a burgundy.
 *
 * This file has now pinned FOUR successive decisions — heritage köşk, the
 * mobile app's tokens (2 Eyl), the Köşk redesign (5 Eyl), and the tricolore
 * accent (7 Eyl) — and is kept, each time inverted, because the failure mode
 * it guards is real: a palette that drifts one hex at a time until half the
 * site is on the previous one. The `not.toContain` assertions are the
 * load-bearing half.
 *
 * Note on the phone: the 2 Eyl swap existed to make site and app read alike;
 * the 5 Eyl redesign broke that and this restores most of it. The greens line
 * up, and the accent is once again `lafmobil`'s accent.burgundy verbatim, so
 * the app's `tricolore` export (['#235347','#FAF9F6','#84233C']) is now the
 * site's green / paper / accent too. What still differs is the ground: the
 * site is white where the app is cream. If the app is re-skinned to match,
 * `lafmobil`'s src/theme/tokens.ts is the file to move. Contrast is a separate
 * guard in contrast.test.ts.
 */
describe("palette follows the Köşk redesign", () => {
  it("paints the house green", () => {
    expect(css).toContain("--brand: #143d2b");
    expect(css).toContain("--bg-espresso: #143d2b");
    expect(css).toContain("--matcha: #1e7c4b");
  });

  it("uses the tricolore's bordo as the accent, not the retired terracotta", () => {
    // The app's own accent.burgundy / burgundyDeep / bg.accentSubtle.
    expect(css).toContain("--accent: #84233c");
    expect(css).toContain("--accent-deep: #4a0f1e");
    expect(css).toContain("--accent-soft: #f6e9ec");
  });

  it("has no retired colour left anywhere, in any notation", () => {
    /**
     * Two holes made the previous version of this test pass over live
     * terracotta:
     *
     * 1. It banned HEX strings, and two survivors were written in decimal —
     *    `rgba(192, 100, 58, 0.22)` in `.open-dot` (inside globals.css, the
     *    one file this test did read) and the same colour in the degraded-auth
     *    notice. A find-and-replace on "#c0643a" cannot see either.
     * 2. It read five files. The retired palette also lives in the shop hero
     *    slider, the error boundaries, the SEO block and browserconfig.xml.
     *
     * So the ban is now on the COLOUR, in both notations, across every file
     * that paints anything.
     */
    const retired: Array<[string, [number, number, number]]> = [
      // The terracotta accent, in every form it took.
      ["#c0643a", [192, 100, 58]],
      ["#97461f", [151, 70, 31]],
      ["#f2e0d5", [242, 224, 213]],
      ["#e6a37a", [230, 163, 122]],
      // The pre-Köşk ink and ground, which outlived two redesigns in the
      // files nobody was reading: browserconfig's tile, the SEO block's
      // decimal rgba(20, 16, 11, …), and both error boundaries.
      ["#14100b", [20, 16, 11]],
    ];
    const painted: Array<[string, string]> = [
      ["globals.css", css],
      ["manifest.ts", manifest],
      ["slide-form.tsx", slidePreview],
      ["opengraph-image.tsx", ogImage],
      ["email/send.ts", emails],
      [
        "degraded-auth-notice.tsx",
        read("src/components/customer/degraded-auth-notice.tsx"),
      ],
      [
        "shop-hero-slider.tsx",
        read("src/components/laffogato/shop-hero-slider.tsx"),
      ],
      ["seo-content.tsx", read("src/components/laffogato/seo-content.tsx")],
      ["error.tsx", read("src/app/error.tsx")],
      ["global-error.tsx", read("src/app/global-error.tsx")],
      ["browserconfig.xml", read("public/browserconfig.xml")],
    ];
    for (const [file, source] of painted) {
      for (const [hex, [r, g, b]] of retired) {
        expect(source.toLowerCase(), `${hex} in ${file}`).not.toContain(hex);
        // …and the same colour spelled as decimal rgb(), with or without
        // spaces, which is how both survivors got through.
        const decimal = new RegExp(`${r}\\s*,\\s*${g}\\s*,\\s*${b}`);
        expect(
          decimal.test(source),
          `rgb(${r}, ${g}, ${b}) — ${hex} in decimal — in ${file}`,
        ).toBe(false);
      }
    }
  });

  it("is the same bordo the phone uses, not a second one near it", () => {
    // Parity is the point: two burgundies one hex apart is exactly the drift
    // this file exists to stop.
    //
    // The app is a separate repository, so this can only be CHECKED when it
    // happens to be checked out beside this one. In CI it is not, and a test
    // that fails on its absence would fail every build for a reason that has
    // nothing to do with the change under test. The site-side half of the
    // assertion always runs; the cross-repo half is a bonus when available.
    for (const hex of APP_BURGUNDY) expect(css).toContain(hex.toLowerCase());

    const appTokens = join(
      process.cwd(),
      "..",
      "lafmobil",
      "src",
      "theme",
      "tokens.ts",
    );
    if (!existsSync(appTokens)) return;
    const tokens = readFileSync(appTokens, "utf8");
    for (const hex of APP_BURGUNDY) {
      expect(
        tokens.includes(hex),
        `${hex} must still be lafmobil's value — the palettes have drifted`,
      ).toBe(true);
    }
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
