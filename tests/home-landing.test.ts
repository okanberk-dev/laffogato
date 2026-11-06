import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { HOME_SLIDES } from "@/components/laffogato/data";
import { splitLead } from "@/components/laffogato/split-lead";
import { openStatusDetail } from "@/components/laffogato/use-open-status";
import { contentDefaults } from "@/lib/admin/content-fields";

/**
 * The landing pass of 11 Eki 2026 (operator: "site landing page tasarımını
 * geliştir ve sitede poppins fontu olsun"). Each guard below is a single line
 * a later tidy-up could undo without anything else failing - the same shape
 * as lcp-guards.test.ts.
 */

const read = (rel: string) => readFileSync(rel, "utf8");
const CSS = read("src/app/globals.css");
const HOME = read("src/components/laffogato/home-page.tsx");
const POUR = read("public/laffogato-pour.js");

/** The rule body for an exact selector, e.g. `rule(".arrow")`. */
function rule(selector: string): string {
  const at = CSS.indexOf(`\n${selector} {`);
  expect(at, `${selector} is missing from globals.css`).toBeGreaterThan(-1);
  return CSS.slice(at, CSS.indexOf("\n}", at));
}

describe("splitLead", () => {
  it("splits the first sentence from the rest", () => {
    expect(splitLead("Bir. İki üç. Dört.")).toEqual(["Bir.", "İki üç. Dört."]);
  });

  it("keeps a single sentence whole", () => {
    expect(splitLead("  Çırpılmış matcha, ipeksi süt ve buz.  ")).toEqual([
      "Çırpılmış matcha, ipeksi süt ve buz.",
      "",
    ]);
  });

  it("does not split inside a number", () => {
    expect(splitLead("Fiyat 1.250 TL oldu. Sonra.")).toEqual([
      "Fiyat 1.250 TL oldu.",
      "Sonra.",
    ]);
  });

  it("gives every hero slide a first sentence a phone can show alone", () => {
    for (const s of HOME_SLIDES) {
      const [lead] = splitLead(s.text);
      expect(lead.length, s.title.join(" ")).toBeGreaterThan(10);
      // Two lines at most on a 390 px phone: the buttons must clear the
      // floating tab bar in the first view.
      expect(lead.length, s.title.join(" ")).toBeLessThanOrEqual(90);
    }
  });

  it("splits the panel's default statement into a lead and a rest", () => {
    const [lead, rest] = splitLead(contentDefaults()["home.hero.lede"]);
    expect(lead).toBe("İtalya’dan ithal kahve barı konsepti.");
    expect(rest.length).toBeGreaterThan(0);
  });
});

describe("openStatusDetail", () => {
  it("names the closing time while open", () => {
    expect(openStatusDetail({ open: true, at: "02:00" })).toBe("Kapanış 02:00");
  });

  it("names today's or the next opening while closed", () => {
    expect(
      openStatusDetail({ open: false, at: "09:00", opensToday: true }),
    ).toBe("Bugün açılış 09:00");
    expect(
      openStatusDetail({ open: false, at: "10:00", opensToday: false }),
    ).toBe("Sonraki açılış 10:00");
  });

  it("says nothing when there is no time to name", () => {
    expect(openStatusDetail({ open: false, at: null })).toBeNull();
  });
});

describe("home hero", () => {
  // Since 6 Kas 2026 the home page opens on the coffee valley alone: the
  // operator's drinks band (home-hero-slider.tsx) is gone, its slides stay
  // in the panel (home-hero-slides.test.ts). The valley's own guards live in
  // home-valley.test.ts.
  it("puts the panel's hero copy in the statement band under the hero", () => {
    expect(HOME).toContain('content?.["home.hero.eyebrow"]');
    expect(HOME).toContain('content?.["home.hero.lede"]');
    expect(HOME).toContain('className="home-intro-lead"');
    expect(rule(".home-intro-text")).toMatch(/font-weight: 300;/);
    expect(rule(".home-intro-lead")).toMatch(/font-weight: 600;/);
  });

  it("keeps its live status motion under five seconds (WCAG 2.2.2)", () => {
    // Two 2 s rings and it settles - never `infinite`.
    expect(rule(".valley-status-dot")).toMatch(
      /animation: valley-live 2s var\(--ease-out\) 2;/,
    );
  });
});

describe("the rest of the landing page", () => {
  it("hides a price the outage fallback blanked to a hyphen", () => {
    // store.ts menuWithoutPrices() sends "-" on purpose during an outage.
    expect(HOME).toMatch(/\/\\d\/\.test\(it\.price\)/);
  });

  it("draws the arrow after a label instead of borrowing a glyph", () => {
    // Poppins has no arrows; the "→" used to come from Inter.
    const arrow = rule(".arrow");
    expect(arrow).toMatch(/mask: url\("data:image\/svg\+xml/);
    expect(arrow).toMatch(/background-color: currentColor;/);
    expect(arrow).not.toMatch(/font-family/);
  });

  it("sets the hero titles and the figures in SemiBold - weight, not size, carries the hierarchy", () => {
    // Café-retail restyle, 5 Kas 2026: display moments are 600 in one face;
    // an ExtraBold squeeze is the look this replaced.
    expect(rule(".h-display")).toMatch(/font-weight: 600;/);
    expect(rule(".stat-n")).toMatch(/font-weight: 600;/);
  });
});

describe("the pour widget (public/laffogato-pour.js)", () => {
  it("speaks Poppins, not its old bundled serif", () => {
    // It used to inline ~250 KB of Cormorant Garamond as base64.
    expect(POUR).not.toContain("Cormorant");
    expect(POUR).toContain("var(--font-display,Poppins)");
    expect(POUR).toContain("document.fonts.load('800 112px Poppins'");
  });

  it("stays small enough to be worth lazy-loading", () => {
    expect(Buffer.byteLength(POUR)).toBeLessThan(700_000);
  });

  it("shows its hint with a hyphen, not a long dash", () => {
    expect(POUR).toContain(
      'hint:"basılı tut, espressoyu dök - yeşil bölgede bırak"',
    );
    const copy = POUR.slice(POUR.indexOf("Nt={tagline"));
    expect(copy.slice(0, copy.indexOf("webglError"))).not.toMatch(/[–—]/);
  });
});

/**
 * Poppins sets wider than Inter did, and every flex or grid row whose track
 * could not shrink below its content grew with it: the checkout's promo row
 * pushed the order summary off a phone (471 px of page on a 390 px screen),
 * the footer's card pair spilled past a tablet (740-768 px), the account
 * page's tab strip pushed a 320 px screen sideways, and the home visit
 * block's e-mail address left its card at 700-768 px. All four were found
 * by sweeping 16 widths after the switch.
 */
describe("rows that must give way to the wider face", () => {
  it("lets every form field shrink below its intrinsic width", () => {
    expect(CSS).toMatch(
      /\ninput,\ntextarea,\nselect \{\n\s*font: inherit;\n\s*color: inherit;[\s\S]*?min-width: 0;\n\}/,
    );
  });

  it("sizes the checkout promo row with a shrinkable track", () => {
    expect(rule(".checkout-promo")).toMatch(
      /grid-template-columns: minmax\(0, 1fr\) auto;/,
    );
    expect(rule(".checkout-promo input")).toMatch(/width: 100%;/);
  });

  it("sizes the footer's rows with shrinkable tracks", () => {
    // The card row (.footer-top) went with the night footer (6 Kas 2026);
    // the rows that replaced it keep the rule: minmax(0, …), never a bare
    // `fr` that cannot shrink below the newsletter field.
    expect(rule(".footer-main")).toMatch(
      /grid-template-columns: minmax\(0, 1fr\);/,
    );
    expect(CSS).toMatch(
      /\.footer-main \{\n\s*grid-template-columns: minmax\(0, 1\.15fr\) minmax\(0, 3fr\);/,
    );
    expect(rule(".footer-letter")).toMatch(
      /grid-template-columns: minmax\(0, 1fr\);/,
    );
    expect(CSS).toMatch(
      /\.footer-letter \{\n\s*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1\.1fr\);/,
    );
  });

  it("keeps the account tab strip scrolling inside its column", () => {
    expect(CSS).toMatch(
      /\.account-shell-body \{[\s\S]{0,200}?grid-template-columns: minmax\(0, 1fr\);/,
    );
  });

  it("stacks the visit facts before an address can leave its card", () => {
    expect(rule(".visit-facts")).toMatch(
      /grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 200px\), 1fr\)\);/,
    );
    expect(rule(".visit-fact-body a")).toMatch(/overflow-wrap: anywhere;/);
  });
});
