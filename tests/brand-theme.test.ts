import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

const css = read("src/app/globals.css");
const manifest = read("src/app/manifest.ts");
const slidePreview = read("src/app/admin/magaza-hero/slide-form.tsx");
/**
 * The link preview: the root card and the shared card system every page
 * card is drawn with (palette, mark, drawings), read as one.
 */
const ogImage = [
  "src/app/opengraph-image.tsx",
  "src/lib/seo/og-card.tsx",
  "src/lib/seo/og-drawings.tsx",
  "src/lib/seo/og-pages.tsx",
  "src/lib/seo/og-product.tsx",
]
  .map(read)
  .join("\n");
/**
 * The mail markup used to live in send.ts as template literals; it now sits in
 * src/lib/email/templates/*.html and send.ts only fills the fields. The guard
 * follows the paint - reading both means the retired-colour ban below covers
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
 * The bordo as the site paints it: accent / deep / soft. Since 25 Eyl 2026
 * these are lafmobil's accent.burgundy / burgundyDeep / accentSubtle again,
 * verbatim (src/theme/tokens.ts, karar 149) - see the note on the phone below.
 */
const SITE_BORDO = ["#9D2543", "#520F1F", "#F9E6EA"] as const;

/** Only what the stylesheet paints with - the history notes can name anything. */
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * The site's palette is café retail, since 5 Kas 2026.
 *
 * Operator instruction, 5 Kas 2026: "sitenin görselini ... starbucks tarzı
 * istiyorum ... ama panel değil". A warm cream canvas (#F2F0EB), white
 * cards, a four-tier green system derived from the logo green (brand
 * #1D6D56 for headings and green text, cta #1F7A5C for filled actions, house
 * #173F35 for bands and the footer, uplift #2A5A4D for accents), brass
 * (#CBA258) for the reward moments only, black-alpha layered shadows and a
 * single Poppins voice. That diverges from lafmobil's porcelain (below) by
 * the operator's decision, recorded in docs/BRAND.md.
 *
 * Before that:
 *
 * Operator instruction, 25 Eyl 2026: "lafmobil reposu mobil uygulamanın
 * reposu ve tasarımı apple'a uygun, sen de site tasarımını buna uygun olarak
 * güncelle". That closed lafmobil's karar 31 with option (c): the whole
 * palette, read from lafmobil src/theme/tokens.ts (`porcelain`, DESIGN-GLASS
 * §13) on that day - porcelain ground #F7F3ED, structure green #1D6D56, bordo
 * #9D2543, brass #E8C877 - with the app's two voices, Poppins and Inter.
 *
 * This file has now pinned FIVE successive decisions - heritage köşk, the
 * mobile app's tokens (2 Eyl), the Köşk redesign (5 Eyl), the tricolore
 * accent (7 Eyl) and the app's porcelain (25 Eyl) - and is kept, each time
 * inverted, because the failure mode it guards is real: a palette that
 * drifts one hex at a time until half the site is on the previous one. The
 * `not.toContain` assertions are the load-bearing half.
 *
 * Note on the phone: the app is the source now. When lafmobil's tokens move,
 * the site moves in the same PR series (docs/SITE-PALETTE-SYNC.md in
 * lafmobil holds the value table). The one surface that has NOT moved yet
 * was the e-mails, until 15 Eki 2026: their baked bands and glint GIF went
 * with the light/dark restyle, and the mail is on this palette now (see the
 * mail block below).
 * Contrast is a separate guard in contrast.test.ts.
 */
describe("palette is café retail on the logo's green", () => {
  it("gives each of the four greens one role", () => {
    // brand: headings, green text, the logo; cta: filled actions; house:
    // the deep bands and the footer; uplift: accents inside the band.
    expect(css).toContain("--brand: #1d6d56");
    expect(css).toContain("--green: #1d6d56");
    expect(css).toContain("--matcha: #1d6d56");
    expect(css).toContain("--green-brand: #1d6d56");
    expect(css).toContain("--green-cta: #1f7a5c");
    expect(css).toContain("--green-house: #173f35");
    expect(css).toContain("--green-uplift: #2a5a4d");
    expect(css).toContain("--bg-espresso: #173f35");
    // The filled action is the CTA green. The footer was the house green
    // until 6 Kas 2026; the owner's brief made it a night footer: `--night`,
    // the ink deepened, under an illustrated band whose sky is the house
    // green. The house green keeps its role as the band colour.
    const rule = (selector: string) => {
      const at = cssCode.indexOf(`\n${selector} {`);
      expect(at, `${selector} is missing from globals.css`).toBeGreaterThan(-1);
      return cssCode.slice(at, cssCode.indexOf("\n}", at));
    };
    expect(rule(".btn-primary")).toContain("background: var(--green-cta);");
    expect(rule(".footer")).toContain("background: var(--night);");
    expect(rule(".footer-cta")).toContain("background: var(--green-house);");
    // An espresso, not a black: --ink's warm cast, deepened.
    expect(css).toContain("--night: #181412;");
  });

  it("is colour-block: solid bands, layered shadows, pills that press to 0.95", () => {
    expect(css).toContain("--press-scale: 0.95;");
    expect(css).toContain("--r-card: 12px;");
    expect(css).toContain("--r-btn: 50px;");
    expect(css).toContain("--glass-blur: none;");
    expect(css).toContain(
      "--shadow-card: 0 0 0.5px rgba(0, 0, 0, 0.14), 0 1px 1px rgba(0, 0, 0, 0.24);",
    );
    // The floating order button.
    expect(cssCode).toMatch(
      /\n\.frap \{[^}]*width: 56px;[^}]*background: var\(--green-cta\);/,
    );
    expect(cssCode).toMatch(
      /\n\.frap \{[^}]*box-shadow: var\(--shadow-frap\);/,
    );
  });

  it("uses the app's bordo as the accent", () => {
    expect(css).toContain("--accent: #9d2543");
    expect(css).toContain("--accent-deep: #520f1f");
    expect(css).toContain("--accent-soft: #f9e6ea");
  });

  it("keeps brass as a fill and a darker gold for text", () => {
    // Brass (#CBA258) is the reward fill: ink sits on it, it never carries
    // text on the canvas. #765923 is the text gold.
    expect(css).toContain("--gold-soft: #cba258");
    expect(css).toContain("--gold: #765923");
  });

  it("retires the Köşk values from the stylesheet, not just their names", () => {
    for (const hex of ["#143d2b", "#84233c", "#4a0f1e", "#1e7c4b"]) {
      expect(cssCode.toLowerCase(), `${hex} is the Köşk palette`).not.toContain(
        hex,
      );
    }
    expect(cssCode).not.toMatch(/--bg:\s*#ffffff/i);
  });

  it("has no retired colour left anywhere, in any notation", () => {
    /**
     * Two holes made the previous version of this test pass over live
     * terracotta:
     *
     * 1. It banned HEX strings, and two survivors were written in decimal -
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
      ["opengraph-image.tsx + src/lib/seo/og-*.tsx", ogImage],
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
          `rgb(${r}, ${g}, ${b}) - ${hex} in decimal - in ${file}`,
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
    // hexes there. The app has since moved to a palette of its own by
    // operator decision (lafmobil's src/theme/tokens.ts is its only record),
    // so that half would fail for a reason that is not a defect - and in CI
    // the app was never there anyway. Only the site side remains.
    for (const hex of SITE_BORDO) expect(css).toContain(hex.toLowerCase());
  });

  it("sits on a warm cream canvas, with white kept for cards", () => {
    expect(css).toContain("--bg: #f2f0eb");
    expect(css).toContain("--bg-stone: #edebe9");
    expect(css).toContain("--surface: #ffffff");
    // The retired grounds: the app's porcelain, its old canvas and the
    // heritage köşk cream.
    expect(cssCode).not.toContain("#f7f3ed");
    expect(css).not.toContain("#f9f8f7");
    expect(css).not.toContain("#f7f3ea");
  });

  it("is not Starbucks' own green - the style is borrowed, the colours derived", () => {
    // The structure follows a coffee-retail flagship; the greens come from
    // L'Affogato's logo, never from another brand's storefront.
    for (const hex of ["#00754a", "#005c3a", "#006241", "#1e3932", "#2b5148"]) {
      expect(css.toLowerCase(), `${hex} is someone else's green`).not.toContain(
        hex,
      );
    }
  });

  it("layers black-alpha shadows, never the retired tints", () => {
    // Two or three low-alpha black shadows per elevation. Every earlier
    // shadow colour - the app's warm earth, the espresso brown, the app's
    // older dark green and the Köşk house green - is gone.
    expect(cssCode).toContain("rgba(0, 0, 0, 0.24)");
    expect(cssCode).not.toContain("rgba(59, 42, 30,");
    expect(css).not.toContain("rgba(20, 61, 43,");
    expect(css).not.toContain("rgba(74, 52, 22,");
    expect(css).not.toContain("rgba(18, 41, 31,");
  });

  it("speaks in one voice - Poppins, tracked tight - and no retired one", () => {
    // Operator, 11 Eki 2026: "sitede poppins fontu olsun". The café-retail
    // restyle (5 Kas 2026) sets headlines in the same face as the text, so
    // the hierarchy is weight and colour; Gabarito (14 Eki 2026) is retired.
    const layout = read("src/app/layout.tsx");
    expect(layout).toMatch(/import \{ Poppins \} from "next\/font\/google"/);
    expect(layout).toMatch(
      /weight: \["300", "400", "500", "600", "700", "800"\]/,
    );
    expect(layout).not.toMatch(/\bGabarito\(/);
    expect(layout).not.toContain("--font-headline");
    expect(css).toContain('"Poppins"');
    // Every historical token resolves to the one voice, the headline too.
    expect(cssCode).toContain("--sans: var(--display);");
    expect(cssCode).toContain("--headline: var(--display);");
    expect(cssCode).toContain("--tracking: -0.01em;");
    // The reward serif is system faces only - nothing is downloaded for it.
    expect(cssCode).toMatch(/--reward-serif: "Iowan Old Style"[^;]*serif;/);
    const rule = (selector: string) => {
      const at = cssCode.indexOf(`\n${selector} {`);
      expect(at, `${selector} is missing from globals.css`).toBeGreaterThan(-1);
      return cssCode.slice(at, cssCode.indexOf("\n}", at));
    };
    // Titles and display figures head; controls, names and list prices read.
    for (const heading of [
      ".h-display",
      ".h1",
      ".h2",
      ".h3",
      ".section-title",
      ".stat-n",
      ".pdp-title",
    ]) {
      expect(rule(heading)).toContain("font-family: var(--headline);");
    }
    for (const control of [
      ".btn",
      ".chip-link",
      ".product-card-name",
      ".product-card-price",
      ".home-intro-text",
    ]) {
      expect(rule(control)).toContain("font-family: var(--display);");
    }
    // The retired faces are gone from the stylesheet and the loader, not
    // merely unused: a stray "Inter" in a font stack would quietly become
    // the reading face again wherever Poppins is missing a glyph.
    expect(cssCode).not.toMatch(/\bInter\b/);
    expect(layout).not.toMatch(/import \{[^}]*\bInter\b/);
    expect(layout).not.toMatch(/\bInter\(/);
    expect(layout).not.toContain("--font-text");
    expect(layout).not.toContain("Montserrat");
    expect(css).not.toContain("Montserrat");
    expect(css).not.toContain("Plus Jakarta Sans");
    expect(css).not.toContain("Hanken Grotesk");
    expect(css).not.toContain("JetBrains Mono");
  });
});

/**
 * The palette is not only globals.css.
 *
 * The PWA manifest paints the install splash and the Android status bar, and
 * the hero preview is what an operator picks a text theme against - both sat
 * on a retired set long after the site itself moved, twice.
 */
describe("surfaces outside globals.css follow the same palette", () => {
  it("installs the PWA on the site's ground and chrome, matching layout.tsx", () => {
    expect(manifest).toContain('background_color: "#f2f0eb"');
    expect(manifest).toContain('theme_color: "#ffffff"');
    expect(read("src/app/layout.tsx")).toContain('themeColor: "#ffffff"');
    for (const hex of ["#FBF4E6", "#2C1D11", "#f9f8f7", "#12291f", "#143d2b"]) {
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
   *
   * The link preview and the PayNkolay bridge moved with the site, and the
   * mail followed on 15 Eki 2026: the baked bands became an HTML bar and the
   * logo pair plus the glint GIF one opaque tile, so the HTML could change
   * colour at last.
   */
  it("shares the link preview as the app icon: L'Af on the house green", () => {
    // Moved with the site on 25 Eyl 2026 (opengraph-image.tsx is a front-end
    // file): the icon's radial green, the mark in cream, the bean in brass.
    expect(ogImage).toContain("#1d6d56"); // --green
    expect(ogImage).toContain("#0c3b2d"); // --bg-espresso-deep
    expect(ogImage).toContain("#fbf8f4"); // cream
    expect(ogImage).toContain("#e8c877"); // --gold-soft, brass
    expect(ogImage).toContain("LAF_LETTERS_PATH");
    for (const hex of [
      "#14100B",
      "#1F1813",
      "#2D2418",
      "#FAF6EE",
      "#C9A05A",
      "#143d2b",
      "#e8d3a4",
    ]) {
      expect(ogImage, `${hex} belongs to a retired palette`).not.toContain(hex);
    }
  });

  it("sends transactional mail in the site's ink, green and gold", () => {
    expect(emails).toContain("background:#1d6d56"); // --brand, the button
    expect(emails).toContain("color:#211c18"); // --ink
    expect(emails).toContain("color:#765923"); // --gold, text gold
    // The site's text face; the site dropped its serif long ago.
    expect(emails).toContain("Poppins");
    expect(emails).not.toContain("Montserrat");
    expect(emails).not.toContain("Times New Roman");
    for (const hex of [
      "#143d2b",
      "#201c17",
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
    // The lockup (15 Eki 2026): the app icon as an opaque rounded tile - L'Af
    // in cream on the house green. Opaque on purpose: Gmail's dark mode
    // inverts colours but not images, so a transparent mark (the old
    // espresso/cream pair) vanished on an inverted card. The old files stay
    // in public/email because mails already in inboxes still point at them.
    for (const file of [
      "logo-laf-tile.png",
      "logo-laf-espresso.png",
      "logo-laf-cream.png",
      "logo-laf-glint.gif",
    ]) {
      expect(
        existsSync(join(process.cwd(), "public", "email", file)),
        `public/email/${file} is missing`,
      ).toBe(true);
    }
    // Every template shows the tile, and never the retired badge.
    for (const [file, source] of templateFiles) {
      expect(
        source.includes("logo-laf-tile.png"),
        `${file} shows no lockup`,
      ).toBe(true);
      expect(source, `${file} still points at the retired badge`).not.toContain(
        "logo-laf.png",
      );
    }
  });
});

/**
 * `#235347` is the app's retired structure green (lafmobil karar 61; karar
 * 149 moved the app to `#1D6D56`). It was never a site token, yet five site
 * surfaces painted it as a literal: the e-mail verify page and notice, the
 * order receipt's green row, the shop hero's photo-less slide and the
 * PayNkolay bridge button. They now use the site's own --matcha / --brand.
 *
 * The ban reads CODE only - string, template and JSX text - so the history
 * notes that name the colour in comments (globals.css, the templates README)
 * can stay.
 */
describe("the app's retired green does not paint the site", () => {
  const RETIRED_APP_GREEN = /#235347/i;

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(join(process.cwd(), dir), {
      withFileTypes: true,
    })) {
      const rel = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...sourceFiles(rel));
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
    }
    return out;
  }

  /** Every literal a file can paint with: strings, templates, JSX text. */
  function literals(file: string): string[] {
    const source = ts.createSourceFile(
      file,
      read(file),
      ts.ScriptTarget.Latest,
      false,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const found: string[] = [];
    const visit = (node: ts.Node) => {
      if (
        ts.isStringLiteralLike(node) ||
        ts.isTemplateLiteralToken(node) ||
        ts.isJsxText(node)
      ) {
        found.push(node.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
  }

  it("has no #235347 in any src string, template or JSX text", () => {
    const files = sourceFiles("src");
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.filter((file) =>
      literals(file).some((text) => RETIRED_APP_GREEN.test(text)),
    );
    expect(offenders).toEqual([]);
  });

  it("has none in globals.css outside its comments", () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(RETIRED_APP_GREEN);
  });

  it("keeps the PayNkolay bridge button on --brand, spelled out", () => {
    // Standalone HTML: no stylesheet, so no var(--brand) to lean on. The
    // app's green since 25 Eyl 2026 - the Köşk green is gone from it. The
    // pages moved out of the route into paynkolay-page.ts (15 Eki 2026).
    const bridge = read("src/lib/payment/paynkolay-page.ts");
    expect(bridge).toContain("background:#1d6d56");
    expect(bridge).not.toContain("#143d2b");
  });
});

/**
 * public/icon-192.png and icon-512.png are the JSON-LD logo
 * (structured-data.ts): the brand's face in search results. They kept the
 * retired espresso "L" on cream for weeks after the site moved on, because
 * nothing looked at their pixels. This does: scripts/gen-icons.mjs draws
 * them from the vector mark, and these assertions hold the result to the
 * app icon (25 Eyl 2026: cream L'Af, brass bean, --brand #1d6d56 ground)
 * and to the maskable safe zone.
 */
describe("the JSON-LD icons are the app icon, on the site palette", () => {
  const GROUND = [0x1d, 0x6d, 0x56] as const; // --brand #1d6d56
  const CREAM = [0xfb, 0xf8, 0xf4] as const; // the mark's cream
  const BRASS = [0xe8, 0xc8, 0x77] as const; // --gold-soft, the bean

  async function pixels(file: string) {
    const { default: sharp } = await import("sharp");
    const { data, info } = await sharp(join(process.cwd(), "public", file))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  }

  const near = (
    data: Buffer,
    i: number,
    [r, g, b]: readonly [number, number, number],
    tolerance = 2,
  ) =>
    Math.abs(data[i] - r) <= tolerance &&
    Math.abs(data[i + 1] - g) <= tolerance &&
    Math.abs(data[i + 2] - b) <= tolerance;

  for (const size of [192, 512]) {
    it(`icon-${size}.png: cream L'Af with a brass bean on --brand, inside the safe zone`, async () => {
      const { data, width, height } = await pixels(`icon-${size}.png`);
      expect([width, height]).toEqual([size, size]);

      let cream = 0;
      let brass = 0;
      let outside = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 3;
          if (near(data, i, CREAM, 6)) cream++;
          if (near(data, i, BRASS, 6)) brass++;
          if (near(data, i, GROUND)) continue;
          // Anything that is not ground is the mark; a maskable launcher
          // keeps only the centred circle of radius 0.4 * size.
          const r = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2);
          if (r > size * 0.4) outside++;
        }
      }
      // Full-bleed ground: all four corners are the house green.
      for (const [x, y] of [
        [0, 0],
        [size - 1, 0],
        [0, size - 1],
        [size - 1, size - 1],
      ]) {
        expect(near(data, (y * size + x) * 3, GROUND), `corner ${x},${y}`).toBe(
          true,
        );
      }
      expect(outside, "mark pixels outside the maskable safe zone").toBe(0);
      // The letters are really there, and really cream (the retired icon
      // was brown on cream, so it had no pixel near GROUND at all).
      expect(cream / (size * size)).toBeGreaterThan(0.02);
      // …and the bean is brass, as on the app icon.
      expect(brass / (size * size)).toBeGreaterThan(0.002);
    });
  }
});
