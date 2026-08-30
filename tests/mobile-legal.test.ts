import { describe, expect, it } from "vitest";

import { LEGAL_DOCS, LEGAL_UPDATED } from "@/lib/legal/documents";
import { CHECKOUT_CONSENT_DOCS } from "@/lib/legal/meta";
import { legalDoc, legalIndex } from "@/lib/mobile/legal";

/**
 * The app shows these contracts at the moment a customer consents, and the
 * order records which revision they agreed to. The endpoint therefore has to
 * serve the site's own document — not a summary, not an older copy.
 */
describe("legal index", () => {
  it("lists every published contract with the current revision", () => {
    const index = legalIndex();
    expect(index.docs).toHaveLength(LEGAL_DOCS.length);
    expect(index.updatedAt).toBe(LEGAL_UPDATED);
    for (const doc of index.docs) {
      expect(doc.updatedAt).toBe(LEGAL_UPDATED);
      expect(doc.slug).toBeTruthy();
      expect(doc.title).toBeTruthy();
      expect(doc.category).toBeTruthy();
    }
  });

  it("names the documents checkout must show, and they exist", () => {
    const index = legalIndex();
    expect(index.consentDocs).toEqual([...CHECKOUT_CONSENT_DOCS]);
    for (const slug of index.consentDocs) {
      expect(legalDoc(slug), slug).not.toBeNull();
    }
  });

  it("carries no document body — the index is meant to stay small", () => {
    const bytes = JSON.stringify(legalIndex()).length;
    expect(bytes).toBeLessThan(40 * 1024);
  });

  it("the flows the app runs can all reach their document", () => {
    // Sign-up consent, checkout consent, the allergen notice on an item, the
    // stamp programme and the app's own EULA.
    for (const slug of [
      "uyelik-sozlesmesi",
      "kvkk-aydinlatma-metni",
      "on-bilgilendirme-formu",
      "mesafeli-satis-sozlesmesi",
      "gida-guvenligi-ve-alerjen",
      "odul-programi",
      "mobil-uygulama-kosullari",
      "ticari-elektronik-ileti",
      "iade-ve-cayma",
    ]) {
      expect(legalDoc(slug), slug).not.toBeNull();
    }
  });
});

describe("legal document", () => {
  it("returns the whole document, sections and all", () => {
    const doc = legalDoc("mesafeli-satis-sozlesmesi");
    expect(doc).not.toBeNull();
    expect(doc!.sections.length).toBeGreaterThan(5);
    expect(doc!.updatedAt).toBe(LEGAL_UPDATED);
  });

  it("refuses a slug that is not a published contract", () => {
    expect(legalDoc("bilinmeyen-belge")).toBeNull();
    expect(legalDoc("")).toBeNull();
    expect(legalDoc("../../etc/passwd")).toBeNull();
  });
});

describe("cayma hakkı istisnaları", () => {
  /**
   * The app's checkout tells a cafe customer they have no withdrawal right,
   * and makes them accept the Ön Bilgilendirme Formu on the same screen. If
   * that form's exception list does not carry the ground the notice relies
   * on, the app is denying a right the accepted document grants.
   */
  it("the accepted pre-contract form covers prepared food and drink", () => {
    const doc = legalDoc("on-bilgilendirme-formu");
    expect(doc).not.toBeNull();
    const bullets = doc!.sections.flatMap((s) => s.bullets ?? []);
    expect(bullets.some((b) => b.includes("yiyecek-içecek tedariki"))).toBe(
      true,
    );
    expect(
      bullets.some((b) => b.includes("Doğrudan tüketime yönelik olarak")),
    ).toBe(true);
  });

  it("says the same thing as the withdrawal document it sits beside", () => {
    for (const slug of ["on-bilgilendirme-formu", "iade-ve-cayma"]) {
      const bullets = legalDoc(slug)!.sections.flatMap((s) => s.bullets ?? []);
      expect(bullets.some((b) => b.includes("yiyecek-içecek tedariki")), slug).toBe(true);
    }
  });
});
