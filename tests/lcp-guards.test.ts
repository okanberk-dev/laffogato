import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The paint-time decisions behind the site's Largest Contentful Paint.
 *
 * Measured on a throttled phone (26 Eyl 2026): first paint went from ~2.2 s
 * to ~1.0 s and the menu / shop / product LCP from ~3 s to ~1 s once these
 * were in place. Each one is a single line that a later tidy-up could undo
 * without anything else failing.
 */

const CSS = readFileSync("src/app/globals.css", "utf8");
const LAYOUT = readFileSync("src/app/layout.tsx", "utf8");
const CONSENT = readFileSync(
  "src/components/laffogato/cookie-consent.tsx",
  "utf8",
);

function keyframes(name: string): string {
  const at = CSS.indexOf(`@keyframes ${name} {`);
  expect(at).toBeGreaterThan(-1);
  return CSS.slice(at, CSS.indexOf("\n}", at));
}

describe("LCP guards", () => {
  it("does not fade the page in from opacity 0", () => {
    const rule = CSS.match(/\n\.page \{\n\s*animation: ([\w-]+)/);
    expect(rule).not.toBeNull();
    expect(keyframes(rule![1])).not.toMatch(/opacity/);
  });

  it("does not preload the web fonts ahead of the stylesheet", () => {
    const preloads = LAYOUT.match(/preload: false/g) ?? [];
    expect(preloads.length).toBe(2);
  });

  it("server-renders the cookie banner and hides it pre-paint for a visitor who decided", () => {
    expect(CONSENT).toMatch(/decided === null \|\|/);
    expect(LAYOUT).toMatch(/data-consent/);
    expect(CSS).toMatch(
      /html\[data-consent="set"\] \.cookie-banner\[data-pending\]/,
    );
  });
});
