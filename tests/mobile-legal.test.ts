import { describe, expect, it, vi } from "vitest";

import { LEGAL_DOCS, LEGAL_UPDATED } from "@/lib/legal/documents";
import { CHECKOUT_CONSENT_DOCS } from "@/lib/legal/meta";
import type { LegalDocOverride } from "@/lib/legal/store";
import {
  applyLegalOverride,
  legalDocFrom,
  legalIndex,
  legalIndexFrom,
} from "@/lib/mobile/legal";

/**
 * The app shows these contracts at the moment a customer consents, and the
 * order records which revision they agreed to. The endpoint therefore has to
 * serve the site's own document - not a summary, not an older copy.
 *
 * The coded cases go through the pure `…From` builders with no overrides;
 * that is exactly what the live functions compute when the database holds
 * none, without needing one in the test.
 */
const NO_OVERRIDES = {} as const;

function override(
  slug: string,
  patch: Partial<LegalDocOverride> = {},
): LegalDocOverride {
  return {
    slug,
    title: "Yeni Başlık",
    summary: "Yeni özet.",
    effectiveDate: "5 Eylül 2026",
    bodyMarkdown: "## 1. Amaç\n\nYeni metin.\n\n- madde",
    isPublished: true,
    updatedAt: "2026-09-05T10:00:00.000Z",
    ...patch,
  };
}

describe("legal index", () => {
  it("lists every published contract, each with its own date", () => {
    const index = legalIndexFrom(NO_OVERRIDES);
    expect(index.docs).toHaveLength(LEGAL_DOCS.length);
    // The set's label is the checkout version; a row's date is the day that
    // document last changed, which the site prints on /hukuk too.
    expect(index.updatedAt).toBe(LEGAL_UPDATED);
    for (const doc of index.docs) {
      const coded = LEGAL_DOCS.find((d) => d.slug === doc.slug)!;
      expect(doc.updatedAt, doc.slug).toBe(coded.updatedAt);
      expect(doc.slug).toBeTruthy();
      expect(doc.title).toBeTruthy();
      expect(doc.category).toBeTruthy();
    }
  });

  it("names the documents checkout must show, and they exist", () => {
    const index = legalIndexFrom(NO_OVERRIDES);
    expect(index.consentDocs).toEqual([...CHECKOUT_CONSENT_DOCS]);
    for (const slug of index.consentDocs) {
      expect(legalDocFrom(slug, null), slug).not.toBeNull();
    }
  });

  it("carries no document body - the index is meant to stay small", () => {
    const bytes = JSON.stringify(legalIndexFrom(NO_OVERRIDES)).length;
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
      expect(legalDocFrom(slug, null), slug).not.toBeNull();
    }
  });

  it("reflects a published override's title, summary and date in the list", () => {
    const index = legalIndexFrom({
      "iade-ve-cayma": override("iade-ve-cayma"),
    });
    const row = index.docs.find((d) => d.slug === "iade-ve-cayma")!;
    expect(row.title).toBe("Yeni Başlık");
    expect(row.summary).toBe("Yeni özet.");
    expect(row.updatedAt).toBe("5 Eylül 2026");
    // The revision label of the set is unchanged; the rest of the list too:
    // each keeps its own coded day (the stamp programme carries its own since
    // 21 Ekim 2026, the cookie policy the set's).
    expect(index.updatedAt).toBe(LEGAL_UPDATED);
    const coded = (slug: string) =>
      LEGAL_DOCS.find((d) => d.slug === slug)!.updatedAt;
    for (const slug of ["odul-programi", "cerez-politikasi"]) {
      const other = index.docs.find((d) => d.slug === slug)!;
      expect(other.updatedAt, slug).toBe(coded(slug));
    }
    expect(coded("cerez-politikasi")).toBe(LEGAL_UPDATED);
  });

  it("moves the set's label with a later override of a checkout document", () => {
    // The label is the version an order placed now records (API-13), so it
    // follows a published override of the text checkout shows.
    const index = legalIndexFrom({
      "mesafeli-satis-sozlesmesi": override("mesafeli-satis-sozlesmesi", {
        effectiveDate: "2 Kasım 2026",
      }),
    });
    expect(index.updatedAt).toBe("2 Kasım 2026");
    expect(index.consentDocs).toEqual([...CHECKOUT_CONSENT_DOCS]);
  });

  it("without a database, the live index is the coded one", async () => {
    // No DATABASE_URL in the test run: the override read fails and the index
    // must still answer with the documents the site ships with.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const index = await legalIndex();
      expect(index).toEqual(legalIndexFrom(NO_OVERRIDES));
    } finally {
      spy.mockRestore();
    }
  });
});

describe("legal document", () => {
  it("returns the whole document, sections and all", () => {
    const doc = legalDocFrom("mesafeli-satis-sozlesmesi", null);
    expect(doc).not.toBeNull();
    expect(doc!.sections.length).toBeGreaterThan(5);
    expect(doc!.updatedAt).toBe(LEGAL_UPDATED);
  });

  it("refuses a slug that is not a published contract", () => {
    expect(legalDocFrom("bilinmeyen-belge", null)).toBeNull();
    expect(legalDocFrom("", null)).toBeNull();
    expect(legalDocFrom("../../etc/passwd", null)).toBeNull();
    // Even with an override row for it: the coded registry decides what exists.
    expect(
      legalDocFrom("bilinmeyen-belge", override("bilinmeyen-belge")),
    ).toBeNull();
  });
});

describe("legal override", () => {
  const coded = legalDocFrom("iade-ve-cayma", null)!;

  it("a published, non-empty override replaces title, summary, date and body", () => {
    const doc = applyLegalOverride(coded, override("iade-ve-cayma"));
    expect(doc.title).toBe("Yeni Başlık");
    expect(doc.summary).toBe("Yeni özet.");
    expect(doc.updatedAt).toBe("5 Eylül 2026");
    expect(doc.sections).toEqual([
      { heading: "1. Amaç", paragraphs: ["Yeni metin."], bullets: ["madde"] },
    ]);
    // Identity is the coded document's; the references aside is dropped, as
    // on /hukuk, because the new text may no longer cite them.
    expect(doc.slug).toBe(coded.slug);
    expect(doc.shortTitle).toBe(coded.shortTitle);
    expect(doc.category).toBe(coded.category);
    expect(doc.references).toBeUndefined();
  });

  it("blank override fields keep the coded value, the date included", () => {
    const doc = applyLegalOverride(
      coded,
      override("iade-ve-cayma", {
        title: "  ",
        summary: "",
        effectiveDate: "",
      }),
    );
    expect(doc.title).toBe(coded.title);
    expect(doc.summary).toBe(coded.summary);
    expect(doc.updatedAt).toBe(coded.updatedAt);
  });

  it("a blank override date shows the coded document's own date, as /hukuk does", () => {
    // A document that changed after the set's revision carries its own date
    // (none does on 16 Ekim 2026, when the whole set was rewritten, so the
    // case is built here). Falling back to the set's label would print an
    // older date in the app than the site.
    const programme = {
      ...legalDocFrom("odul-programi", null)!,
      updatedAt: "23 Ekim 2026",
    };
    const doc = applyLegalOverride(
      programme,
      override("odul-programi", { effectiveDate: "  " }),
    );
    expect(doc.updatedAt).toBe("23 Ekim 2026");
  });

  it("a preamble without a heading is headed by the short title", () => {
    const doc = applyLegalOverride(
      coded,
      override("iade-ve-cayma", {
        bodyMarkdown: "Giriş cümlesi.\n\n## 1. Kapsam\n\nMetin.",
      }),
    );
    expect(doc.sections.map((s) => s.heading)).toEqual([
      coded.shortTitle,
      "1. Kapsam",
    ]);
  });

  it("a draft or an empty override does not count", () => {
    expect(
      applyLegalOverride(
        coded,
        override("iade-ve-cayma", { isPublished: false }),
      ),
    ).toBe(coded);
    expect(
      applyLegalOverride(
        coded,
        override("iade-ve-cayma", { bodyMarkdown: "  \n" }),
      ),
    ).toBe(coded);
    expect(applyLegalOverride(coded, null)).toBe(coded);
    // The index applies the same rule.
    const index = legalIndexFrom({
      "iade-ve-cayma": override("iade-ve-cayma", { isPublished: false }),
    });
    expect(index.docs.find((d) => d.slug === "iade-ve-cayma")!.title).toBe(
      coded.title,
    );
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
    const doc = legalDocFrom("on-bilgilendirme-formu", null);
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
      const bullets = legalDocFrom(slug, null)!.sections.flatMap(
        (s) => s.bullets ?? [],
      );
      expect(
        bullets.some((b) => b.includes("yiyecek-içecek tedariki")),
        slug,
      ).toBe(true);
    }
  });
});
