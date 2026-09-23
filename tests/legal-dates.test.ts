import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { LEGAL_CONTENT } from "@/lib/legal/content";
import { LEGAL_DOCS, findLegalDoc } from "@/lib/legal/documents";
import { CHECKOUT_CONSENT_DOCS, LEGAL_UPDATED } from "@/lib/legal/meta";

/**
 * Every contract used to print "Son güncelleme: 1 Eylül 2026", including the
 * six whose text changed afterwards. The dates below were measured from the
 * history of content.ts and entity.ts, mapping each hunk to its document:
 * five changed on 5 Sep (hesap-silme was written that day), and
 * sirket-bilgileri on 22 Sep, when its {{CAFE_HOURS}} token moved to 02:00.
 */
const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

/** "5 Eylül 2026" -> a sortable number, or NaN when it is not that shape. */
function dayNumber(label: string): number {
  const m = /^(\d{1,2}) (\S+) (\d{4})$/.exec(label);
  if (!m) return Number.NaN;
  const month = MONTHS.indexOf(m[2]);
  if (month === -1) return Number.NaN;
  return Number(m[3]) * 10_000 + (month + 1) * 100 + Number(m[1]);
}

describe("legal document dates", () => {
  it("the measured documents carry the day their text last changed", () => {
    const expected: Record<string, string> = {
      "uyelik-sozlesmesi": "5 Eylül 2026",
      "hesap-silme": "5 Eylül 2026",
      "odul-programi": "5 Eylül 2026",
      "mobil-uygulama-kosullari": "5 Eylül 2026",
      "kafe-hizmet-kosullari": "5 Eylül 2026",
      "sirket-bilgileri": "22 Eylül 2026",
    };
    for (const [slug, date] of Object.entries(expected)) {
      expect(findLegalDoc(slug)?.updatedAt, slug).toBe(date);
    }
    // Every other document still reads the revision it was issued under.
    for (const doc of LEGAL_DOCS) {
      if (doc.slug in expected) continue;
      expect(doc.updatedAt, doc.slug).toBe(LEGAL_UPDATED);
    }
  });

  it("every date is a printable Turkish day, never before the revision", () => {
    const base = dayNumber(LEGAL_UPDATED);
    expect(base).not.toBeNaN();
    for (const doc of LEGAL_DOCS) {
      const day = dayNumber(doc.updatedAt);
      expect(day, `${doc.slug}: ${doc.updatedAt}`).not.toBeNaN();
      expect(day, doc.slug).toBeGreaterThanOrEqual(base);
    }
  });

  it("the checkout documents stay on the consent version", () => {
    // An order records LEGAL_UPDATED as the revision the customer accepted.
    // If one of these documents gets a later date of its own, the recorded
    // version no longer names the text that was shown: move LEGAL_UPDATED
    // instead of dating the document.
    for (const slug of CHECKOUT_CONSENT_DOCS) {
      const src = LEGAL_CONTENT.find((d) => d.slug === slug)!;
      expect(src.updatedAt, slug).toBeUndefined();
      expect(findLegalDoc(slug)!.updatedAt, slug).toBe(LEGAL_UPDATED);
    }
  });

  it("both checkout paths still record LEGAL_UPDATED as the version", () => {
    for (const file of [
      "src/lib/mobile/orders.ts",
      "src/app/odeme/actions.ts",
    ]) {
      expect(readFileSync(file, "utf8"), file).toContain(
        "version: LEGAL_UPDATED",
      );
    }
  });
});
