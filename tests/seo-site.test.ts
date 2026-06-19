import { describe, it, expect } from "vitest";

import { SITE } from "@/lib/seo/site";

describe("SITE constants — NAP + lean-SEO fixes", () => {
  it("uses the new Tuzla street address (no Maltepe anywhere)", () => {
    expect(SITE.address.streetAddress).toBe("Postane Mah. 29 Ekim Cad. No:28");
    expect(SITE.address.addressLocality).toBe("Tuzla");
    expect(JSON.stringify(SITE)).not.toMatch(/maltepe/i);
  });

  it("uses the Tuzla contact email", () => {
    expect(SITE.email).toBe("tuzla@laffogato.it");
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
