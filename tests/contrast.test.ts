import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { HUES } from "@/components/laffogato/visuals";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const channel = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Reads a custom property out of :root. */
function token(name: string): string {
  const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`token ${name} not found in globals.css`);
  return m[1];
}

/** Hue angle in degrees — what tells "green" from "red" apart. */
function hue(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  const deg =
    max === r
      ? ((g - b) / d) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return (deg * 60 + 360) % 360;
}

/** Shortest distance between two hue angles. */
function hueGap(a: string, b: string): number {
  const diff = Math.abs(hue(a) - hue(b)) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Midpoint of a two-stop gradient — the value text actually sits on. */
function mix(a: string, b: string): string {
  const part = (h: string, i: number) =>
    parseInt(h.replace("#", "").slice(i, i + 2), 16);
  const avg = (i: number) => Math.round((part(a, i) + part(b, i)) / 2);
  return `#${[0, 2, 4].map((i) => avg(i).toString(16).padStart(2, "0")).join("")}`;
}

const AA = 4.5;

describe("colour contrast", () => {
  // Three successive minimalist passes each quietly cost contrast — the gold
  // family went grey, --ink-mute fell to 3.80:1, badge text dropped below AA.
  // These assertions are the guard rail.
  const bg = token("--bg");

  it("body inks clear AA on the page ground", () => {
    for (const name of ["--ink", "--ink-soft", "--ink-mute"]) {
      expect(
        contrast(token(name), bg),
        `${name} on --bg`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  it("gold carries text on cream rather than being a grey", () => {
    expect(contrast(token("--gold"), bg)).toBeGreaterThanOrEqual(AA);
    // A gold that has lost its saturation is the failure mode to catch.
    const g = token("--gold").replace("#", "");
    const [r, , b] = [0, 2, 4].map((i) => parseInt(g.slice(i, i + 2), 16));
    expect(r - b, "--gold must stay visibly warm").toBeGreaterThan(60);
  });

  it("state colours are distinguishable from each other", () => {
    // "In stock" and "almost gone" must not both be warm red. Hue angle is
    // the right measure here — two colours can be far apart in luminance and
    // still read as the same colour.
    expect(
      hueGap(token("--matcha"), token("--rose")),
      "in-stock and low-stock must not share a hue family",
    ).toBeGreaterThan(60);
    expect(hueGap(token("--matcha"), token("--accent"))).toBeGreaterThan(60);
    expect(contrast(token("--matcha"), bg)).toBeGreaterThanOrEqual(AA);
    expect(contrast(token("--rose"), bg)).toBeGreaterThanOrEqual(3);
  });

  it("white badge text clears AA on every badge fill", () => {
    for (const name of ["--ink", "--gold", "--accent-deep"]) {
      expect(
        contrast("#ffffff", token(name)),
        `white on ${name}`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  it("the paper tints are actually distinguishable from one another", () => {
    const tints = ["--bg", "--bg-warm", "--bg-stone", "--bg-cream"].map(token);
    const unique = new Set(tints);
    expect(unique.size, "each paper tint must be its own value").toBe(
      tints.length,
    );
  });

  it("every HUES ink clears AA against its own gradient", () => {
    for (const [name, h] of Object.entries(HUES)) {
      const worst = Math.min(
        contrast(h.ink, mix(h.from, h.to)),
        contrast(h.ink, h.to),
      );
      expect(worst, `${name} ink on its gradient`).toBeGreaterThanOrEqual(AA);
    }
  });

  it("HUES are twelve different surfaces, not twelve names for one", () => {
    const lights = Object.values(HUES).map((h) => luminance(h.from));
    const spread = Math.max(...lights) - Math.min(...lights);
    expect(spread, "hue set must span a real range").toBeGreaterThan(0.3);
    expect(new Set(Object.values(HUES).map((h) => h.from)).size).toBe(
      Object.keys(HUES).length,
    );
  });
});

describe("small text uses the darker accent", () => {
  // --accent is 3.70:1 on cream: enough for the display-size headings that
  // carry it, below AA for body-size text and links. This catches the next
  // person reaching for the brighter one on a 13px link.
  it("keeps --accent above 3:1 (large text) and --accent-deep above 4.5:1", () => {
    const bg = token("--bg-cream");
    expect(contrast(token("--accent"), bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(token("--accent-deep"), bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("does not colour the map caption link with the light accent", () => {
    const rule = /\.visit-map-caption a \{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(rule).toContain("var(--accent-deep)");
  });
});
