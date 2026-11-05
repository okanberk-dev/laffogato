import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  MARINA_BRANCH,
  OTHER_BRANCHES,
  branchAddressLines,
  branchMapUrl,
  branchTel,
  type SiteBranch,
} from "@/lib/seo/branches";

/**
 * The site's other branches (operator, 5 Kas 2026: L'Affogato Marina opened,
 * "yalnız sitede"). Marina's address, phone and hours were known nowhere on
 * that day, so the record is the name and the fact that it opened; every
 * empty field must stay off the page instead of printing a blank or a guess.
 */
const blank: SiteBranch = { ...MARINA_BRANCH };

describe("site branches", () => {
  it("lists Marina under lafmaliyet's id, open", () => {
    expect(OTHER_BRANCHES.map((b) => b.id)).toEqual(["marina"]);
    expect(MARINA_BRANCH.name).toBe("L'Affogato Marina");
    expect(MARINA_BRANCH.status).toBe("open");
  });

  it("prints no address, dials nothing and maps nothing while they are unknown", () => {
    const empty = {
      ...blank,
      streetAddress: "",
      localityLine: " ",
      phone: "",
      mapsQuery: "",
    };
    expect(branchAddressLines(empty)).toEqual([]);
    expect(branchTel(empty)).toBeNull();
    expect(branchMapUrl(empty)).toBeNull();
  });

  it("prints exactly the fields that are filled", () => {
    const filled = {
      ...blank,
      streetAddress: "Cadde No: 1",
      localityLine: "34940 Tuzla / İstanbul",
      phone: "+90 216 000 00 00",
      mapsQuery: "L'Affogato Marina",
    };
    expect(branchAddressLines(filled)).toEqual([
      "Cadde No: 1",
      "34940 Tuzla / İstanbul",
    ]);
    expect(branchTel(filled)).toBe("+902160000000");
    expect(branchMapUrl(filled)).toBe(
      "https://www.google.com/maps/search/?api=1&query=L'Affogato%20Marina",
    );
  });

  it("places Marina at Tuzla Marina and guesses nothing else (5 Kas 2026)", () => {
    // Operator: "Marina tuzla marinada", then "açılış 10 kapanış 2300". No
    // unit, postal code, phone or days were given, so none is printed.
    expect(branchAddressLines(MARINA_BRANCH)).toEqual([
      "Tuzla Marina",
      "Tuzla / İstanbul",
    ]);
    expect(MARINA_BRANCH.localityLine).not.toMatch(/\d/);
    expect(branchMapUrl(MARINA_BRANCH)).toBe(
      "https://www.google.com/maps/search/?api=1&query=Tuzla%20Marina%2C%20Tuzla%2C%20%C4%B0stanbul",
    );
    expect(branchTel(MARINA_BRANCH)).toBeNull();
    expect(MARINA_BRANCH.hoursLabel).toBe("10:00 - 23:00");
    // Kural: tek çizgi tire.
    expect(MARINA_BRANCH.hoursLabel).not.toMatch(/[\u2013\u2014]/);
  });

  it("never maps a branch whose address is not known", () => {
    // A map pin without an address is a guess at where the branch is.
    for (const b of OTHER_BRANCHES) {
      if (branchAddressLines(b).length === 0) expect(b.mapsQuery).toBe("");
    }
  });

  it("is shown on /ziyaret and in the footer, with the app's limit said", () => {
    const visit = readFileSync(
      "src/components/laffogato/visit-page.tsx",
      "utf8",
    );
    expect(visit).toContain("OTHER_BRANCHES.map");
    expect(visit).toContain("Yeni şubemiz açıldı");
    // The app, the table QR and the karaoke room serve the Tuzla köşk only.
    expect(visit).toContain("Tuzla köşkü içindir");
    const chrome = readFileSync("src/components/laffogato/chrome.tsx", "utf8");
    expect(chrome).toContain("OTHER_BRANCHES.map");
  });

  it("publishes no structured data for a branch", () => {
    // No LocalBusiness without a street address; the Tuzla köşk stays the
    // only place in JSON-LD until the operator gives Marina's.
    const ld = readFileSync("src/lib/seo/structured-data.ts", "utf8");
    expect(ld).not.toMatch(/branches|MARINA_BRANCH/);
  });
});
