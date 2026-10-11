import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

const css = read("src/app/globals.css");
const manifest = read("src/app/manifest.ts");
const slidePreview = read("src/app/admin/magaza-hero/slide-form.tsx");
const ogImage = read("src/app/opengraph-image.tsx");
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
 * The site's palette is the app's porcelain, since 25 Eyl 2026.
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
 * is the e-mails: their bands, glint GIF and badges are rasters with the
 * Köşk green #143d2b baked in, so the HTML cannot change colour without the
 * images being redrawn with it (see the mail block below).
 * Contrast is a separate guard in contrast.test.ts.
 */
describe("palette follows the app's porcelain", () => {
  it("paints the app's structure green", () => {
    expect(css).toContain("--brand: #1d6d56");
    expect(css).toContain("--bg-espresso: #1d6d56");
    expect(css).toContain("--matcha: #1d6d56");
    expect(css).toContain("--green: #1d6d56");
  });

  it("uses the app's bordo as the accent", () => {
    expect(css).toContain("--accent: #9d2543");
    expect(css).toContain("--accent-deep: #520f1f");
    expect(css).toContain("--accent-soft: #f9e6ea");
  });

  it("keeps brass as a fill and a darker gold for text", () => {
    // The app's brass (#E8C877) is a surface: ink sits on it, it never
    // carries text on porcelain. goldFg #765923 is the text gold.
    expect(css).toContain("--gold-soft: #e8c877");
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

  it("sits on the app's porcelain, with white kept for cards", () => {
    expect(css).toContain("--bg: #f7f3ed");
    expect(css).toContain("--bg-warm: #fbf8f4");
    expect(css).toContain("--surface: #ffffff");
    // The retired grounds: the app's old canvas and the heritage köşk cream.
    expect(css).not.toContain("#f9f8f7");
    expect(css).not.toContain("#f7f3ea");
  });

  it("is not Starbucks' own green - the theme is derived, not copied", () => {
    expect(css).not.toContain("#00754a");
    expect(css).not.toContain("#005c3a");
  });

  it("tints its shadows with the app's warm earth", () => {
    // lafmobil shadows are #3B2A1E (59,42,30) at no more than 12 %. Every
    // earlier shadow colour - the espresso brown, the app's older dark green
    // and the Köşk house green - is gone.
    expect(css).toContain("rgba(59, 42, 30,");
    expect(css).not.toContain("rgba(20, 61, 43,");
    expect(css).not.toContain("rgba(74, 52, 22,");
    expect(css).not.toContain("rgba(18, 41, 31,");
  });

  it("speaks in one voice, Poppins, and no retired one", () => {
    // Operator, 11 Eki 2026: "sitede poppins fontu olsun". Poppins used to
    // display and Inter to read (the app's pair, BRAND-IDENTITY §2); the site
    // now reads in Poppins too, with ExtraBold for its display moments.
    const layout = read("src/app/layout.tsx");
    expect(layout).toMatch(/import \{ Poppins \} from "next\/font\/google"/);
    expect(layout).toMatch(
      /weight: \["300", "400", "500", "600", "700", "800"\]/,
    );
    expect(css).toContain('"Poppins"');
    // Every historical token resolves to the one family...
    expect(cssCode).toContain("--sans: var(--display);");
    // ...and the second voice is gone from the stylesheet and the loader,
    // not merely unused: a stray "Inter" in a font stack would quietly
    // become the reading face again wherever Poppins is missing a glyph.
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
    expect(manifest).toContain('background_color: "#f7f3ed"');
    expect(manifest).toContain('theme_color: "#fbf8f4"');
    expect(read("src/app/layout.tsx")).toContain('themeColor: "#fbf8f4"');
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
   * The link preview and the PayNkolay bridge moved with the site. The mail
   * templates are on the Köşk green (#143d2b) still, knowingly: their dark
   * band, the logo glint GIF (whose first frame is what Outlook shows) and
   * the badges are rasters with that green baked in, so the HTML can only
   * move together with redrawn images. When they move, these pins move too.
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
    // it - the espresso PNG for a light card, the cream PNG the dark-mode
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
    // app's green since 25 Eyl 2026 - the Köşk green is gone from it.
    const bridge = read("src/app/odeme/paynkolay/route.ts");
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
