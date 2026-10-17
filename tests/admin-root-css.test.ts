import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * globals.css resets `a`, `button` and the form fields unlayered, and draws
 * its green focus ring unlayered too: that beats every Tailwind utility (a
 * cascade layer), and the panel is drawn with nothing else. The admin root
 * rolls those resets back, or replaces them where rolling back would be
 * worse (admin audit, 17 Eki 2026: SHE-03, SHE-08, SHE-16, KAR-M01). The
 * pixels were checked in Chrome at 390, 1024 and 1280 px.
 */

const read = (file: string) => readFileSync(file, "utf8");

// The rules as the browser reads them: comments out, whitespace collapsed.
const code = read("src/app/globals.css")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\s+/g, " ")
  .replace(/\( /g, "(")
  .replace(/ \)/g, ")");

/** The rule with exactly this selector: where it starts, and its body. */
function rule(selector: string, from = 0) {
  const at = code.indexOf(`${selector} {`, from);
  const open = at + selector.length + 2;
  return { at, body: at < 0 ? "" : code.slice(open, code.indexOf("}", open)) };
}

/** An at-rule block (the first one holding `containing`): start and end. */
function atBlock(prelude: string, containing = "") {
  let from = 0;
  for (;;) {
    const start = code.indexOf(`${prelude} {`, from);
    if (start < 0) return { start: -1, end: -1, body: "" };
    let depth = 0;
    let end = code.indexOf("{", start);
    for (; end < code.length; end++) {
      if (code[end] === "{") depth++;
      else if (code[end] === "}" && --depth === 0) break;
    }
    const body = code.slice(start, end + 1);
    if (body.includes(containing)) return { start, end, body };
    from = end;
  }
}

const layout = read("src/app/admin/layout.tsx");
const token = (name: string) => {
  const m = new RegExp(`"${name}":\\s*"(#[0-9A-Fa-f]{6})"`).exec(layout);
  if (!m) throw new Error(`${name} not in layout.tsx`);
  return m[1];
};
const luminance = (hex: string) => {
  const c = (i: number) => {
    const v = parseInt(hex.slice(1 + i, 3 + i), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(0) + 0.7152 * c(2) + 0.0722 * c(4);
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe("the panel's buttons keep their Tailwind look", () => {
  it("rolls the site's element resets back inside the admin root", () => {
    // "Uygula" and each modal's submit drew as bare text, the active status
    // tab dark on dark (seen in the browser). Then the font: a <button>
    // took its parent's 16px / 400 instead of text-sm font-medium, so a
    // button and a link with the same classes differed side by side.
    const { at, body } = rule("[data-admin-root] :is(a, button)");
    expect(at).toBeGreaterThan(-1);
    for (const prop of [
      "color",
      "background",
      "border",
      "padding",
      "text-decoration",
      "font",
    ]) {
      expect(body).toContain(`${prop}: revert-layer;`);
    }
    expect(layout.match(/data-admin-root=""/g)).toHaveLength(2);
  });

  it("keeps the pointer, and shows not-allowed on a disabled control", () => {
    // Tailwind 4's preflight sets no cursor on buttons: rolling the cursor
    // back would give every panel button the arrow.
    expect(code).not.toMatch(/cursor: ?revert-layer/);
    const disabled = rule(
      '[data-admin-root] :is(button:disabled, [aria-disabled="true"])',
    );
    expect(disabled.at).toBeGreaterThan(-1);
    expect(disabled.body).toContain("cursor: not-allowed;");
  });
});

describe("the panel's fields keep their size classes", () => {
  it("roll the font back, after the iOS rule, and leave min-width alone", () => {
    const fields = rule("[data-admin-root] :is(input, textarea, select)");
    expect(fields.at).toBeGreaterThan(-1);
    expect(fields.body).toContain("font: revert-layer;");
    expect(fields.body).not.toContain("min-width");
    // The site reset keeps min-width: 0 for every field, the panel's too.
    expect(rule("input, textarea, select").body).toContain("min-width: 0;");
    // `input[type="text"]` in the iOS rule weighs the same as the admin
    // rule (0,1,1): the later one wins, so the admin rule must come after.
    const ios = code.indexOf('.input, .textarea, .select, input[type="text"],');
    expect(ios).toBeGreaterThan(-1);
    expect(fields.at).toBeGreaterThan(ios);
  });

  it("keep the 16px floor below sm, where iOS would zoom", () => {
    const phone = atBlock("@media (width < 40rem)", "[data-admin-root]");
    expect(phone.start).toBeGreaterThan(-1);
    const guard = rule(
      '[data-admin-root] :is(input:not([type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="file"]), textarea, select)',
      phone.start,
    );
    expect(guard.at).toBeGreaterThan(phone.start);
    expect(guard.at).toBeLessThan(phone.end);
    expect(guard.body).toContain("font-size: 16px;");
    expect(guard.at).toBeGreaterThan(
      rule("[data-admin-root] :is(input, textarea, select)").at,
    );
  });
});

describe("the panel draws one focus ring", () => {
  it("an espresso outline, no halo, never the faint gold ring", () => {
    const focus = rule("[data-admin-root] :focus-visible");
    expect(focus.at).toBeGreaterThan(-1);
    expect(focus.body).toContain("outline: 2px solid var(--admin-primary);");
    expect(focus.body).toContain("outline-offset: 2px;");
    expect(focus.body).toContain("box-shadow: none;");
    // Rolling back would bring the kit's gold /45 ring: 1.59:1 on white.
    expect(focus.body).not.toContain("revert-layer");
    // The site's `[tabindex]:focus-visible` weighs the same (0,2,0).
    const site = code.indexOf("[tabindex]:focus-visible {");
    expect(site).toBeGreaterThan(-1);
    expect(focus.at).toBeGreaterThan(site);
  });

  it("clears 3:1 on every ground of the panel (WCAG 1.4.11)", () => {
    const ring = token("--admin-primary");
    for (const ground of [
      "#FFFFFF",
      token("--admin-bg"),
      token("--admin-surface-2"),
      token("--admin-neutral-soft"),
    ]) {
      expect(contrast(ring, ground), ground).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("printing", () => {
  const print = atBlock("@media print", "[data-print-receipt]");

  it("prints the receipt alone only on a page that has one", () => {
    expect(print.start).toBeGreaterThan(-1);
    // Unscoped, `body *` blanked every other page on paper: the dashboard,
    // the reports, the legal texts, the menu.
    expect(print.body).not.toMatch(/[{};] ?body \* \{/);
    expect(print.body).toContain(
      "body:where(:has([data-print-receipt])) * { visibility: hidden; }",
    );
    expect(print.body).toContain(
      "[data-print-receipt], [data-print-receipt] * { visibility: visible; }",
    );
  });

  it("leaves the receipts' own rules the heavier ones", () => {
    // :where keeps the hiding rule at the weight of the old `body *`, and
    // the shared receipt rule stays a bare attribute (0,1,0), so the table
    // cards' `[data-print-receipt].qr-sheet` (0,2,0) still lays its grid.
    expect(print.body).toContain(
      "[data-print-receipt] { display: block !important;",
    );
    const sheet = read("src/app/admin/masalar/yazdir/page.tsx");
    expect(sheet).toContain('data-print-receipt=""');
    expect(sheet).toContain("[data-print-receipt].qr-sheet {");
    expect(read("src/components/admin/order-detail.tsx")).toMatch(
      /data-print-receipt\n/,
    );
  });
});
