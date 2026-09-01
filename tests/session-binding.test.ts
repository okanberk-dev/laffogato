import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { fingerprintOf } from "@/lib/customer/store";

const auth = readFileSync("src/lib/customer/auth.ts", "utf8");

describe("customer session binding", () => {
  it("changes the fingerprint when the password hash changes", () => {
    const a = fingerprintOf("$2a$10$abcdefghijklmnopqrstuv");
    const b = fingerprintOf("$2a$10$abcdefghijklmnopqrstuw");
    expect(a).not.toBe(b);
    expect(a).toHaveLength(16);
    // Non-reversible: it must not contain the hash it came from.
    expect(a).not.toContain("abcdefgh");
  });

  it("is stable for the same hash", () => {
    const h = "$2a$10$zzzzzzzzzzzzzzzzzzzzzz";
    expect(fingerprintOf(h)).toBe(fingerprintOf(h));
  });

  it("checks the fingerprint on every session read", () => {
    expect(auth).toContain("getSessionFingerprint");
    expect(auth).toContain("current !== session.fingerprint");
  });

  it("still honours cookies minted before the fingerprint existed", () => {
    // Otherwise the deploy logs every signed-in member out.
    expect(auth).toContain("parts.length !== 3 && parts.length !== 4");
  });
});
