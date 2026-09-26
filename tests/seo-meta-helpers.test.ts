import { describe, expect, it } from "vitest";

import { brandedTitle, metaDescription, TITLE_SUFFIX } from "@/lib/seo/site";

describe("brandedTitle", () => {
  it("appends the brand when the whole fits 60 characters", () => {
    expect(brandedTitle("Karaoke")).toEqual({
      absolute: `Karaoke${TITLE_SUFFIX}`,
    });
  });
  it("leaves a long title unbranded rather than cut", () => {
    const long = "Affogato Nedir, Nasıl Yapılır? İtalyan Tatlı Kahvenin Rehberi";
    expect(brandedTitle(long).absolute).toBe(long);
  });
});

describe("metaDescription", () => {
  it("keeps a short text as is", () => {
    expect(metaDescription("Kısa bir açıklama.")).toBe("Kısa bir açıklama.");
  });
  it("cuts a long text at a word boundary within 158 characters", () => {
    const text = "kelime ".repeat(60);
    const out = metaDescription(text);
    expect(out.length).toBeLessThanOrEqual(158);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/);
  });
});
