import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { LEGAL_CONTENT } from "@/lib/legal/content";
import { LEGAL_DOCS, findLegalDoc } from "@/lib/legal/documents";
import {
  CHECKOUT_CONSENT_DOCS,
  KARAOKE_CONSENT_DOCS,
  KARAOKE_LEGAL_UPDATED,
  LEGAL_UPDATED,
} from "@/lib/legal/meta";

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
    // 20 Ekim 2026: the ÖBF and the MSS say the invoice is an e-Arşiv
    // invoice sent by e-mail, the İşlem Rehberi joins the set
    // (LEGAL-REDLINES §24). The consent version moved with the checkout
    // documents, the set with it. (19 Ekim 2026: the KDV rule, §16.4; 18
    // Ekim 2026: the distance-sales rules of 2026.)
    expect(LEGAL_UPDATED).toBe("20 Ekim 2026");
    // The karaoke terms carry their own label: 21 Ekim 2026, §8 makes good
    // a late köşk cancel and §9 refunds a share within 14 days
    // (LEGAL-REDLINES §26). (20 Ekim 2026: §12 says how the advance is
    // invoiced, ASK-KAR-KDV.)
    expect(KARAOKE_LEGAL_UPDATED).toBe("21 Ekim 2026");
  });

  it("a document that changes after the revision carries its own day", () => {
    // Empty on 16, 18 and 20 Ekim 2026: every coded document carries the
    // set's day. On the 20th the invoice wording moved the checkout
    // documents, and with them the revision, past the ten documents that
    // carried 19 Ekim 2026 of their own (the allergen §7, the transfers
    // abroad, the karaoke rules in one source; LEGAL-REDLINES §15.6, §17,
    // §21): a date before the revision is never printed, so they read the
    // set's day again. Add a document here, with its date, when only it
    // changes later.
    const expected: Record<string, string> = {
      // Versioned on its own (KARAOKE_LEGAL_UPDATED, its own consent record):
      // the shop set moving on does not re-date the karaoke contract.
      "karaoke-odasi-rezervasyon": KARAOKE_LEGAL_UPDATED,
      // 21 Ekim 2026: the karaoke make-good named in the privacy texts and
      // its bank details in the retention table (LEGAL-REDLINES §26).
      "gizlilik-politikasi": "21 Ekim 2026",
      "kvkk-aydinlatma-metni": "21 Ekim 2026",
      "veri-saklama-ve-imha-politikasi": "21 Ekim 2026",
      // The make-good's transfer is the third bank-transfer case (§14).
      "odeme-kosullari": "21 Ekim 2026",
      // 21 Ekim 2026: §8 says the durable copy that shipped (the confirmed
      // text attached, downloadable, kept by hash; LEGAL-REDLINES §25). No
      // checkout document changed, so LEGAL_UPDATED did not move.
      "islem-rehberi": "21 Ekim 2026",
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
    const ownVersion = new Set<string>(KARAOKE_CONSENT_DOCS);
    for (const doc of LEGAL_DOCS) {
      const day = dayNumber(doc.updatedAt);
      expect(day, `${doc.slug}: ${doc.updatedAt}`).not.toBeNaN();
      // The karaoke contract carries its own consent version and date
      // (meta.ts); it is checked against KARAOKE_LEGAL_UPDATED above.
      if (ownVersion.has(doc.slug)) continue;
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
      // The label and the hashes from one read (review R4, 21 Eki 2026):
      // `checkoutConsentShown` applies `checkoutConsentVersion`'s rule.
      expect(src, file).toContain("...(await checkoutConsentShown())");
      expect(src, file).not.toContain("version: LEGAL_UPDATED");
    }
  });

  it("both checkout paths and the karaoke booking record the text hashes through one rule", () => {
    // Next to the label and from the same read, the hash of each text shown
    // (D-VERSIONS-TABLE; review R4): the two checkout paths through
    // `checkoutConsentShown`, every karaoke booking (web form and app) in
    // `createReservation` through `karaokeConsentShown`, from the settings
    // that decide its policy.
    for (const file of [
      "src/lib/mobile/orders.ts",
      "src/app/odeme/actions.ts",
    ]) {
      const src = readFileSync(file, "utf8");
      expect(src, file).toContain("...(await checkoutConsentShown())");
      expect(src, file).not.toContain("textHashes:");
    }
    const karaoke = readFileSync("src/lib/mobile/karaoke.ts", "utf8");
    expect(karaoke).toContain("await karaokeConsentShown(settings)");
    expect(karaoke).toContain("textHashes: shown.textHashes");
    expect(karaoke).toContain("shown.version,");
    // The surfaces never compute or pass their own.
    for (const file of [
      "src/app/karaoke/actions.ts",
      "src/app/api/mobile/v1/karaoke/reservations/route.ts",
    ]) {
      expect(readFileSync(file, "utf8"), file).not.toContain("textHashes");
    }
  });
});
