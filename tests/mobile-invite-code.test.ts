import { describe, expect, it } from "vitest";

import {
  abbreviateName,
  asciiLetters,
  fnv1a,
  INVITE_CODE_RE,
  inviteCodeCandidate,
  isInviteCodeShape,
  normalizeInviteCode,
} from "@/lib/mobile/invite-code";

describe("asciiLetters", () => {
  it("drops Turkish diacritics and everything that is not a letter", () => {
    expect(asciiLetters("Şükrü Ökten")).toBe("SUKRUOKTEN");
    expect(asciiLetters("ışık çağla")).toBe("ISIKCAGLA");
    expect(asciiLetters("İrem-3 Güneş!")).toBe("IREMGUNES");
    expect(asciiLetters("")).toBe("");
  });
});

describe("inviteCodeCandidate", () => {
  it("is LAF- + three name letters + two digits", () => {
    const code = inviteCodeCandidate("Eda Mancuso", "cst-1");
    expect(code).toMatch(INVITE_CODE_RE);
    expect(code.startsWith("LAF-EDA")).toBe(true);
  });

  it("upper-cases and strips diacritics from the name", () => {
    expect(inviteCodeCandidate("şule", "cst-2").slice(0, 7)).toBe("LAF-SUL");
  });

  it("pads a short or empty name", () => {
    expect(inviteCodeCandidate("Ed", "cst-3").slice(0, 7)).toBe("LAF-EDL");
    expect(inviteCodeCandidate("", "cst-4").slice(0, 7)).toBe("LAF-LAF");
    expect(inviteCodeCandidate("42", "cst-5").slice(0, 7)).toBe("LAF-LAF");
  });

  it("digits are deterministic per id and change with the attempt", () => {
    const a = inviteCodeCandidate("Eda", "cst-9");
    expect(inviteCodeCandidate("Eda", "cst-9")).toBe(a);
    const digits = new Set(
      Array.from({ length: 25 }, (_, i) =>
        inviteCodeCandidate("Eda", "cst-9", i).slice(-2),
      ),
    );
    // 25 reseeds over a 00–99 space: at least a handful must differ.
    expect(digits.size).toBeGreaterThan(5);
  });

  it("fnv1a is stable", () => {
    expect(fnv1a("")).toBe(0x811c9dc5);
    expect(fnv1a("a")).toBe(0xe40c292c);
  });
});

describe("normalizeInviteCode", () => {
  it("trims, upper-cases and tolerates a missing prefix", () => {
    expect(normalizeInviteCode(" laf-eda24 ")).toBe("LAF-EDA24");
    expect(normalizeInviteCode("eda24")).toBe("LAF-EDA24");
    expect(normalizeInviteCode("LAFEDA24")).toBe("LAF-EDA24");
    expect(normalizeInviteCode("LAF–EDA24")).toBe("LAF-EDA24"); // en dash
    expect(normalizeInviteCode("")).toBe("");
  });

  it("shape check rejects anything but LAF-AAA99", () => {
    expect(isInviteCodeShape("LAF-EDA24")).toBe(true);
    expect(isInviteCodeShape("LAF-ED24")).toBe(false);
    expect(isInviteCodeShape("LAF-EDA2")).toBe(false);
    expect(isInviteCodeShape("LAF-EDA24; drop table")).toBe(false);
  });
});

describe("abbreviateName", () => {
  it("keeps the first name and initials the last", () => {
    expect(abbreviateName("Selin Kaya")).toBe("Selin K.");
    expect(abbreviateName("Ayşe Nur Öztürk")).toBe("Ayşe Nur Ö.");
    expect(abbreviateName("Selin")).toBe("Selin");
    expect(abbreviateName("   ")).toBe("Üye");
  });
});
