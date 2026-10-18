import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Two shell guarantees the panel had no test for, both about what the
 * operator sees when something goes wrong or when they change tabs.
 *
 * Source-level assertions on purpose: an error boundary and an unmounted form
 * are both facts about the FILE - which file exists, and whether a tab is
 * rendered conditionally - and neither can be observed from a unit test
 * without rendering Next's router.
 */

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("admin error + 404 boundaries", () => {
  it("has its own error boundary, so a database blip does not drop the operator on the shop", () => {
    const src = read("src/app/admin/error.tsx");
    expect(src).toContain('"use client"');
    // `retry` fetches the page again; `reset` only re-drew the failure.
    expect(src).toContain("retry()");
    // A way back into the panel (the role's landing page), not out to the
    // storefront.
    expect(src).toContain("<PanelHomeLink");
    expect(src).not.toContain('href="/"');
    // The digest is what support asks for.
    expect(src).toContain("digest");
  });

  it("has its own 404, addressed to the operator rather than a customer", () => {
    const src = read("src/app/admin/not-found.tsx");
    expect(src).toContain("<PanelHomeLink");
    expect(src).toContain("Panele dön");
    // The shop's 404 wraps itself in the storefront header and footer.
    expect(src).not.toContain("SiteChrome");
    // Nothing on this page sends the operator to the storefront.
    expect(src).not.toMatch(/href="\/"/);
  });
});

describe("settings tabs keep what was typed", () => {
  // Conditional render unmounts the tab, and every field in these forms is
  // uncontrolled - so switching tabs silently threw the typed values away.
  const CONDITIONAL = /\{tab === "[a-z]+" && </;

  it("does not unmount the mobile app settings tabs", () => {
    expect(read("src/app/admin/mobil/ayarlar/app-config-form.tsx")).not.toMatch(
      CONDITIONAL,
    );
  });

  it("does not unmount the site settings tabs", () => {
    expect(read("src/app/admin/ayarlar/settings-form.tsx")).not.toMatch(
      CONDITIONAL,
    );
  });
});
