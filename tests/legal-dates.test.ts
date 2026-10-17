import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { LEGAL_CONTENT } from "@/lib/legal/content";
import { LEGAL_DOCS, findLegalDoc } from "@/lib/legal/documents";
import { CHECKOUT_CONSENT_DOCS, LEGAL_UPDATED } from "@/lib/legal/meta";

/**
 * Every contract used to print "Son güncelleme: 1 Eylül 2026", then ten of
 * them carried their own later day (5, 22 and 23 Eylül). On 16 Ekim 2026 the
 * postal code (34940) entered `{{ADDRESS}}`, which every one of the 25
 * documents prints, and the payment, loyalty and data sections of most were
 * rewritten the same day. So the whole set carries one revision again and the
 * per-document dates are gone. A document whose text changes later gets its
 * own `updatedAt` back (see `LegalDocSource.updatedAt`), and the second test
 * below lists it.
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
  it("the revision is the day the set was last rewritten", () => {
    expect(LEGAL_UPDATED).toBe("16 Ekim 2026");
  });

  it("a document that changes after the revision carries its own day", () => {
    // Empty on 16 Ekim 2026: every document changed that day. Add a document
    // here, with its date, when only it changes later.
    const expected: Record<string, string> = {
      // fA'L's AI recipient became Anthropic, PBC (R12 and the two privacy texts).
      "gizlilik-politikasi": "17 Ekim 2026",
      "kvkk-aydinlatma-metni": "17 Ekim 2026",
      "acik-riza-metni": "17 Ekim 2026",
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
    // An order records LEGAL_UPDATED as the revision the customer accepted
    // while the coded text is shown (a panel override moves it, see
    // tests/legal-consent-version.test.ts). If one of these documents gets a
    // later coded date of its own, the recorded version no longer names the
    // text that was shown: move LEGAL_UPDATED instead of dating the document.
    for (const slug of CHECKOUT_CONSENT_DOCS) {
      const src = LEGAL_CONTENT.find((d) => d.slug === slug)!;
      expect(src.updatedAt, slug).toBeUndefined();
      expect(findLegalDoc(slug)!.updatedAt, slug).toBe(LEGAL_UPDATED);
    }
  });

  it("both checkout paths record the version through the one rule", () => {
    // Web and app orders are read in one format by the admin consent card;
    // a path that went back to the bare constant would ignore a published
    // override of the text the customer actually confirmed (API-13).
    for (const file of [
      "src/lib/mobile/orders.ts",
      "src/app/odeme/actions.ts",
    ]) {
      const src = readFileSync(file, "utf8");
      expect(src, file).toContain("version: await checkoutConsentVersion()");
      expect(src, file).not.toContain("version: LEGAL_UPDATED");
    }
  });
});
