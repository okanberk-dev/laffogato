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
const templateFiles = readdirSync(
  join(process.cwd(), "src/lib/email/templates"),
)
  .filter((f) => f.endsWith(".html"))
  .map((f) => [f, read(join("src/lib/email/templates", f))] as const);
const emails = [
  read("src/lib/email/send.ts"),
  ...templateFiles.map(([, source]) => source),
].join("\n");

/**
 * The tricolore's bordo as the site paints it: accent / deep / soft. Until
 * 8 Eyl 2026 these were also lafmobil's accent.burgundy / burgundyDeep /
 * bg.accentSubtle, verbatim — see the note on the phone below.
 */
const SITE_BORDO = ["#84233C", "#4A0F1E", "#F6E9EC"] as const;

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
 * Note on the phone: the 2 Eyl swap existed to make site and app read alike,
 * the 5 Eyl redesign broke that, and the 7 Eyl accent restored the bordo — for
 * a day. On 8 Eyl 2026 the operator moved the app to a Starbucks-ID palette
 * (green #29623F, accent gold #D1C59B, cream #FAF2DF — lafmobil's
 * src/theme/tokens.ts, karar 23), so site and app no longer share a palette
 * BY DECISION, not by drift. This file therefore guards the site alone;
 * whether the site follows the app one day (karar 31) is an open operator
 * question tracked in lafmobil's docs/SITE-PALETTE-SYNC.md, and the e-mails
 * stay on the site's tokens because the site sends them and their links land
 * here. Contrast is a separate guard in contrast.test.ts.
 */
describe("palette follows the Köşk redesign", () => {
  it("paints the house green", () => {
    expect(css).toContain("--brand: #143d2b");
    expect(css).toContain("--bg-espresso: #143d2b");
    expect(css).toContain("--matcha: #1e7c4b");
  });

  it("uses the tricolore's bordo as the accent, not the retired terracotta", () => {
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

  it("keeps one bordo, not a second one near it", () => {
    // Two burgundies one hex apart is exactly the drift this file exists to
    // stop, so all three shades are pinned as literals.
    //
    // Until 8 Eyl 2026 this test also opened ../lafmobil/src/theme/tokens.ts
    // when it was checked out beside this repo and required the same three
    // hexes there. The app has since moved to its Starbucks-ID palette by
    // operator decision (accent gold #D1C59B, green #29623F), so that half
    // would now fail for a reason that is not a defect — and in CI the app
    // was never there anyway. Only the site side remains.
    for (const hex of SITE_BORDO) expect(css).toContain(hex.toLowerCase());
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

  it("hosts the mail imagery on the site, under public/email", () => {
    // A mail client cannot tint a mask or read a relative path, so every
    // template points at an absolute https://laffogato.net/email/… PNG, and
    // the files themselves ship with the site. A typo'd filename here would
    // reach the inbox as a broken image, which no other test would see.
    const ASSET = /https:\/\/laffogato\.net\/email\/([A-Za-z0-9/_.-]+)/g;
    for (const [file, source] of templateFiles) {
      const refs = [...new Set([...source.matchAll(ASSET)].map((m) => m[1]))];
      expect(refs.length, `${file} references no hosted asset`).toBeGreaterThan(
        0,
      );
      for (const rel of refs) {
        expect(
          existsSync(join(process.cwd(), "public", "email", rel)),
          `${file} → public/email/${rel} is missing`,
        ).toBe(true);
      }
    }
    // The lockup: the L'Af letterforms at 200 px, no frame around them
    // (operator, 8 Sep 2026 evening; source logos/2.png). Three files carry
    // it — the espresso PNG for a light card, the cream PNG the dark-mode
    // media query swaps in, and the GIF whose gold glint runs once over the
    // deep-green band. The GIF's first frame is the plain cream mark, which
    // is what Outlook renders.
    for (const file of [
      "logo-laf-espresso.png",
      "logo-laf-cream.png",
      "logo-laf-glint.gif",
    ]) {
      expect(
        existsSync(join(process.cwd(), "public", "email", file)),
        `public/email/${file} is missing`,
      ).toBe(true);
    }
    // Every template shows the lockup, and never the retired badge.
    for (const [file, source] of templateFiles) {
      expect(
        /logo-laf-(espresso|cream|glint)/.test(source),
        `${file} shows no lockup`,
      ).toBe(true);
      expect(source, `${file} still points at the retired badge`).not.toContain(
        "logo-laf.png",
      );
    }
  });
});
