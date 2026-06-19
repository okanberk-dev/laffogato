import { describe, it, expect } from "vitest";

import { FAQ } from "@/lib/seo/faq";

const all = JSON.stringify(FAQ);

describe("Customer FAQ content", () => {
  it("franchise answer no longer hard-codes euro prices (matches 'on request')", () => {
    expect(all).not.toContain("85.000");
    expect(all).not.toContain("140.000");
    expect(all).not.toContain("280.000");
  });

  it("location answer uses the new Tuzla street, never Maltepe", () => {
    expect(all).not.toMatch(/maltepe/i);
    expect(all).toContain("29 Ekim");
  });

  it("every entry has a non-empty question and answer", () => {
    for (const entry of FAQ) {
      expect(entry.q.trim().length).toBeGreaterThan(0);
      expect(entry.a.trim().length).toBeGreaterThan(0);
    }
  });
});
