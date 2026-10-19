import { describe, expect, it } from "vitest";

import { piiLike } from "@/lib/admin/pii-like";

/**
 * `piiLike` (lib/admin/pii-like.ts): does a search text look like it names
 * a person? The palette's route, its recents and the saved list views ask
 * it before a text goes anywhere that outlives the request.
 */

describe("piiLike: does the text look like it names a person?", () => {
  it("an e-mail: anything with an @", () => {
    for (const s of ["a@b.co", "eda@example.com", "@", "eda@", " x@y "]) {
      expect(piiLike(s), s).toBe(true);
    }
    // Full-width, as a phone keyboard may paste it.
    expect(piiLike("eda＠example.com")).toBe(true);
  });

  it("a phone: seven digits or more once spaces, dots, dashes, brackets and + go", () => {
    for (const s of [
      "0532 123 45 67",
      "+90 (532) 123-45-67",
      "532.123.45.67",
      "5321234567",
      "1234567",
      "12 34 56 7",
      "0532 123 45 67",
      "0532‑123‑45‑67",
      "０５３２１２３",
      "Eda 05321234567",
      // A date in digits counts too: the rule is loose on purpose.
      "2026-10-19",
    ]) {
      expect(piiLike(s), s).toBe(true);
    }
  });

  it("an order number, a booking code, a product: no", () => {
    for (const s of [
      "",
      "latte",
      "Fındık 250 g",
      "10234",
      "#10234",
      "123456",
      "KRK-00042",
      "krk42",
      "SKU-1234",
      "İsmail",
    ]) {
      expect(piiLike(s), s).toBe(false);
    }
  });

  it("is a pure, client-safe module", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/lib/admin/pii-like.ts", "utf8");
    expect(source).not.toMatch(/^import /m);
    expect(source).not.toMatch(/["']server-only["']/);
  });
});
