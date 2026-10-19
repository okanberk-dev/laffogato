import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The pre-contract information and the contracts read at 16px or more
 * (operator decision ASK-OTH-2, 18 Eki 2026): Mesafeli Sözleşmeler
 * Yönetmeliği m.6/1 asks for at least twelve points, and 12 pt is 16 CSS px
 * (1 pt = 1/72 in, 1 px = 1/96 in). On the payment step (the notes, the
 * consent boxes, "Siparişin", "Cayma hakkın", the documents' panel) and on
 * /hukuk, at every screen width.
 */

const css = readFileSync("src/app/globals.css", "utf8");

/** Every leaf rule of the stylesheet, media queries included. */
const RULES = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selectors: m[1]
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(",")
    .map((s) => s.trim().replace(/\s+/g, " ")),
  body: m[2],
}));

/** The px font-sizes any rule sets on `selector`, alone or as a descendant. */
function fontSizes(selector: string): number[] {
  return RULES.filter((r) =>
    r.selectors.some((s) => s === selector || s.endsWith(` ${selector}`)),
  ).flatMap((r) =>
    [...r.body.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1])),
  );
}

describe("16px: the pre-contract texts (MSY m.6/1, 12 pt = 16 CSS px)", () => {
  it.each([
    // The payment step.
    ".co-docs",
    ".co-docs-seller",
    ".checkout-consent label",
    ".checkout-consent-note",
    ".co-ship-method-meta",
    ".co-accepted",
    ".co-docpanel-body",
    ".co-docpanel-meta",
    // /hukuk, and the same text in the panel.
    ".legal-section p",
    ".legal-bullets li",
    ".legal-ordered li",
    ".legal-table",
    ".legal-table th",
  ])("%s, in every rule that sizes it", (selector) => {
    const sizes = fontSizes(selector);
    expect(sizes.length, `${selector} has a px font-size`).toBeGreaterThan(0);
    for (const size of sizes) expect(size, selector).toBeGreaterThanOrEqual(16);
  });

  it("the new blocks and nothing smaller inside them", () => {
    expect(fontSizes(".co-brief")).toEqual([16]);
    expect(fontSizes(".co-withdrawal")).toEqual([16]);
    for (const cls of [
      "co-brief",
      "co-withdrawal",
      "co-facts",
      "co-docpanel-body",
    ]) {
      for (const rule of RULES.filter((r) =>
        r.selectors.some((s) => s.includes(`.${cls}`)),
      )) {
        for (const m of rule.body.matchAll(/font-size:\s*([\d.]+)px/g)) {
          expect(
            Number(m[1]),
            rule.selectors.join(", "),
          ).toBeGreaterThanOrEqual(16);
        }
      }
    }
  });
});
