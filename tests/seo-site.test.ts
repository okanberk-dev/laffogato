import { describe, it, expect } from "vitest";

import { SITE } from "@/lib/seo/site";

describe("SITE constants — NAP + lean-SEO fixes", () => {
  it("uses the Tuzla street address (no Maltepe anywhere)", () => {
    expect(SITE.address.streetAddress).toBe("Postane Mah. 29 Ekim Cd. No: 28");
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

  it("uses the operator's contact email", () => {
    expect(SITE.email).toBe("info@nextgenlab.com.tr");
  });

  it("uses the laffogatto social handles", () => {
    expect(SITE.social.instagram).toBe("https://instagram.com/laffogatto");
    expect(SITE.social.tiktok).toBe("https://tiktok.com/@laffogatto");
    expect(SITE.social.youtube).toBe("https://youtube.com/@laffogatto");
    expect(SITE.twitter).toBe("@laffogatto");
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
