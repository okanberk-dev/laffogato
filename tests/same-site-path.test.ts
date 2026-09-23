import { describe, expect, it } from "vitest";

import { sameSitePath } from "@/lib/http/same-site-path";

describe("sameSitePath", () => {
  it("follows a path on this site, query string and all", () => {
    expect(sameSitePath("/odeme")).toBe("/odeme");
    expect(sameSitePath("/karaoke?tarih=2026-09-23")).toBe(
      "/karaoke?tarih=2026-09-23",
    );
    expect(sameSitePath("/magaza#shop")).toBe("/magaza#shop");
  });

  it("refuses anything that leaves the site", () => {
    for (const raw of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "evil.example",
      "",
      "/ok\nLocation: https://evil.example",
    ]) {
      expect(sameSitePath(raw), raw).toBeNull();
    }
  });

  it("refuses what is not a string, and absurdly long paths", () => {
    expect(sameSitePath(null)).toBeNull();
    expect(sameSitePath(undefined)).toBeNull();
    expect(sameSitePath("/" + "a".repeat(400))).toBeNull();
  });
});
