import { readFileSync } from "node:fs";

import { describe, it, expect } from "vitest";

import { SITE } from "@/lib/seo/site";

describe("SITE constants - NAP + lean-SEO fixes", () => {
  it("uses the tax-certificate Tuzla street address (no Maltepe anywhere)", () => {
    expect(SITE.address.streetAddress).toBe(
      "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1",
    );
    expect(SITE.address.addressLocality).toBe("Tuzla");
    expect(SITE.address.postalCode).toBe("34940");
    expect(JSON.stringify(SITE)).not.toMatch(/maltepe/i);
  });

  it("carries the landmark locals navigate by", () => {
    // "Next to Menemenci Cumhur" is how people actually find the place; it is
    // load-bearing wayfinding copy, not decoration.
    expect(SITE.address.landmark).toContain("Menemenci Cumhur");
  });

  it("geo coordinates sit inside Tuzla", () => {
    expect(SITE.geo.latitude).toBeGreaterThan(40.79);
    expect(SITE.geo.latitude).toBeLessThan(40.85);
    expect(SITE.geo.longitude).toBeGreaterThan(29.27);
    expect(SITE.geo.longitude).toBeLessThan(29.35);
  });

  it("uses the corporate contact email", () => {
    expect(SITE.email).toBe("info@nextgenlab.com.tr");
  });

  it("uses the laffogatto social handles", () => {
    expect(SITE.social.handle).toBe("@laffogatto");
    expect(SITE.social.instagram).toBe("https://instagram.com/laffogatto");
    expect(SITE.social.tiktok).toBe("https://tiktok.com/@laffogatto");
    expect(SITE.social.youtube).toBe("https://youtube.com/@laffogatto");
    expect(SITE.social.x).toBe("https://x.com/laffogatto");
    expect(SITE.twitter).toBe("@laffogatto");
    // "laffogato" (single t) must not survive anywhere in a profile URL
    for (const url of Object.values(SITE.social)) {
      expect(url).not.toMatch(/laffogato(?!t)/);
    }
  });

  it("the footer shows the handle, read from SITE, not typed again", () => {
    // The footer used to name the three networks and never the account, so a
    // visitor could not search for it. Reading the constant keeps the footer
    // and the JSON-LD `sameAs` on one spelling of the double t.
    const chrome = readFileSync("src/components/laffogato/chrome.tsx", "utf8");
    const footer = chrome.slice(chrome.indexOf("export function Footer"));
    expect(footer).toContain("{SITE.social.handle}");
    expect(footer).not.toContain('"@laffogatto"');
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain(".footer-social-handle {");
  });

  it("has a lean, de-duplicated keyword set (<= 12, no dupes)", () => {
    const kw = SITE.keywords;
    expect(kw.length).toBeLessThanOrEqual(12);
    expect(new Set(kw).size).toBe(kw.length);
  });

  it("home meta description fits SERP (short, <= 165 chars)", () => {
    expect(SITE.shortDescription.length).toBeLessThanOrEqual(165);
  });

  it("ogImage points to the real dynamic route, not the 404 file", () => {
    expect(SITE.ogImage).toBe("/opengraph-image");
  });

  it("is TR-only (no it_IT/en_US alternate locales)", () => {
    expect([...SITE.alternateLocale]).toEqual([]);
  });
});
