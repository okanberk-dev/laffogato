import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("brand accent — terracotta replaces the house green", () => {
  it("defines the warm terracotta accent", () => {
    expect(css).toContain("--accent: #c0643a");
    expect(css).toContain("--accent-deep: #97461f");
  });

  it("drops the previous Starbucks-style house green accent", () => {
    expect(css).not.toContain("#00754a");
    expect(css).not.toContain("#005c3a");
  });

  it("no longer ships the legacy --green token or its hex", () => {
    expect(css).not.toContain("var(--green)");
    expect(css).not.toContain("#2f7a4e");
  });
});
