import { describe, it, expect } from "vitest";

import {
  consentSaveRefusal,
  consentScope,
  EFFECTIVE_DATE_FORMAT_ERROR,
  legalDocSchema,
  recordedConsentVersion,
  resolveEffectiveDate,
  type ConsentSaveCheck,
} from "@/lib/admin/legal-schema";
import { canAccess } from "@/lib/admin/roles";
import type { ConsentOverride } from "@/lib/legal/consent-version";
import {
  CHECKOUT_CONSENT_DOCS,
  KARAOKE_CONSENT_DOCS,
  KARAOKE_LEGAL_UPDATED,
  LEGAL_UPDATED,
} from "@/lib/legal/meta";

describe("legalDocSchema", () => {
  it("parses a draft and maps isPublished checkbox", () => {
    const r = legalDocSchema.safeParse({
      title: "Gizlilik Politikası",
      summary: "Kısa özet",
      effectiveDate: "26 Mayıs 2026",
      bodyMarkdown: "## Başlık\n\nParagraf.",
      // isPublished absent → draft
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.isPublished).toBe(false);
    expect(r.data.title).toBe("Gizlilik Politikası");
  });

  it("requires real body content to publish", () => {
    const r = legalDocSchema.safeParse({
      title: "Bir Belge",
      bodyMarkdown: "kısa",
      isPublished: "on",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues.some((i) => i.path[0] === "bodyMarkdown")).toBe(true);
  });

  it("rejects a too-short title", () => {
    expect(legalDocSchema.safeParse({ title: "A" }).success).toBe(false);
  });

  function issue(input: Record<string, string>, field: string) {
    const r = legalDocSchema.safeParse({ title: "Bir Belge", ...input });
    if (r.success) return null;
    return r.error.issues.find((i) => i.path[0] === field)?.message ?? null;
  }

  it("takes the effective date only as 'D Ay YYYY', or blank (CON-30)", () => {
    expect(issue({ effectiveDate: "" }, "effectiveDate")).toBeNull();
    expect(
      issue({ effectiveDate: "26 Mayıs 2026" }, "effectiveDate"),
    ).toBeNull();
    expect(
      issue({ effectiveDate: "26 mayıs 2026" }, "effectiveDate"),
    ).toBeNull();
    // Shown on the page as typed, while the consent recorded the save day.
    for (const typed of [
      "26.05.2026",
      "2026-05-26",
      "Mayıs 2026",
      "31 Şubat 2026",
    ]) {
      expect(issue({ effectiveDate: typed }, "effectiveDate"), typed).toBe(
        EFFECTIVE_DATE_FORMAT_ERROR,
      );
    }
  });

  it("refuses over-long fields with a Turkish message per field (CON-22)", () => {
    expect(issue({ title: "x".repeat(201) }, "title")).toMatch(/200 karakter/);
    expect(issue({ summary: "x".repeat(601) }, "summary")).toMatch(
      /600 karakter/,
    );
    expect(issue({ effectiveDate: "1".repeat(61) }, "effectiveDate")).toBe(
      EFFECTIVE_DATE_FORMAT_ERROR,
    );
    expect(issue({ bodyMarkdown: "x".repeat(60_001) }, "bodyMarkdown")).toMatch(
      /60\.000 karakter/,
    );
  });
});

describe("resolveEffectiveDate", () => {
  // 23:30 in Istanbul on 19 Oct is 20:30 UTC: still the 19th there.
  const NOW = "2026-10-19T20:30:00.000Z";

  it("keeps what was typed", () => {
    expect(resolveEffectiveDate(" 5 Kasım 2026 ", true, NOW)).toBe(
      "5 Kasım 2026",
    );
  });

  it("dates a text going live with no date by the Istanbul day of the save", () => {
    expect(resolveEffectiveDate("", true, NOW)).toBe("19 Ekim 2026");
    expect(resolveEffectiveDate("", true, "2026-10-19T21:30:00.000Z")).toBe(
      "20 Ekim 2026",
    );
  });

  it("leaves a draft's blank date blank", () => {
    expect(resolveEffectiveDate("", false, NOW)).toBe("");
  });
});

describe("consentSaveRefusal (CON-M01, D25)", () => {
  const [ONB, MSS] = CHECKOUT_CONSENT_DOCS;
  const KARAOKE = KARAOKE_CONSENT_DOCS[0];
  // Far past any coded revision, so the cases hold when LEGAL_UPDATED moves.
  const LATER = "10 Mart 2030";
  const LATEST = "11 Mart 2030";

  function text(patch: Partial<ConsentOverride> = {}): ConsentOverride {
    return {
      isPublished: true,
      bodyMarkdown: "## 1. Taraflar\n\nBirinci metin.",
      effectiveDate: LATER,
      updatedAt: "2030-03-10T09:00:00.000Z",
      ...patch,
    };
  }

  function check(patch: Partial<ConsentSaveCheck>): string | null {
    return consentSaveRefusal({
      slug: MSS,
      before: null,
      after: text(),
      overrides: {},
      archived: [],
      ...patch,
    });
  }

  it("only checks the documents a consent records", () => {
    expect(consentScope("kvkk-aydinlatma-metni")).toBeNull();
    expect(consentScope(ONB)?.base).toBe(LEGAL_UPDATED);
    expect(consentScope(KARAOKE)?.base).toBe(KARAOKE_LEGAL_UPDATED);
    expect(
      check({
        slug: "kvkk-aydinlatma-metni",
        after: text({ effectiveDate: LEGAL_UPDATED }),
      }),
    ).toBeNull();
  });

  it("lets a draft and an unpublished save through", () => {
    expect(
      check({ after: text({ isPublished: false, effectiveDate: "" }) }),
    ).toBeNull();
  });

  it("refuses a rewritten text published under the coded revision's date", () => {
    // The editor used to prefill this date; orders then recorded the same
    // version for the coded and the rewritten contract.
    const refusal = check({ after: text({ effectiveDate: LEGAL_UPDATED }) });
    expect(refusal).toMatch(/^Metin değişti: yürürlük tarihini güncelle\./);
    expect(refusal).toContain(`"${LEGAL_UPDATED}"`);
    expect(check({ after: text({ effectiveDate: LATER }) })).toBeNull();
  });

  it("refuses a changed body with its date unchanged", () => {
    const before = text();
    expect(
      check({
        before,
        after: text({ bodyMarkdown: "## 1. Taraflar\n\nİkinci metin." }),
        overrides: { [MSS]: before },
      }),
    ).toMatch(/^Metin değişti/);
    expect(
      check({
        before,
        after: text({
          bodyMarkdown: "## 1. Taraflar\n\nİkinci metin.",
          effectiveDate: LATEST,
        }),
        overrides: { [MSS]: before },
      }),
    ).toBeNull();
  });

  it("lets a save with the same body and date through (a title fix)", () => {
    const before = text();
    expect(
      check({ before, after: text(), overrides: { [MSS]: before } }),
    ).toBeNull();
  });

  it("counts the other checkout document: both share one version", () => {
    // The Ön Bilgilendirme override is live at LATER; a Mesafeli Satış text
    // going live at LATER too would leave orders on the same label.
    const onb = text({ effectiveDate: LATER });
    expect(check({ overrides: { [ONB]: onb } })).toMatch(/^Metin değişti/);
    expect(
      check({
        after: text({ effectiveDate: LATEST }),
        overrides: { [ONB]: onb },
      }),
    ).toBeNull();
    // The karaoke contract is its own scope.
    expect(check({ slug: KARAOKE, overrides: { [ONB]: onb } })).toBeNull();
  });

  it("refuses a live override dated at or before the coded revision, even unchanged", () => {
    const before = text({ effectiveDate: KARAOKE_LEGAL_UPDATED });
    expect(
      check({
        slug: KARAOKE,
        before,
        after: before,
        overrides: { [KARAOKE]: before },
      }),
    ).toContain(KARAOKE_LEGAL_UPDATED);
  });

  it("refuses a date an earlier published text of the document used", () => {
    const old = text({
      bodyMarkdown: "## 1. Taraflar\n\nArşivdeki metin.",
      effectiveDate: LATEST,
    });
    expect(
      check({ after: text({ effectiveDate: LATEST }), archived: [old] }),
    ).toMatch(/önceki bir metninde kullanıldı/);
    // The same text coming back under its own date is fine (a restore).
    expect(check({ after: { ...old }, archived: [old] })).toBeNull();
    // A draft in the archive never reached an order.
    expect(
      check({
        after: text({ effectiveDate: LATEST }),
        archived: [{ ...old, isPublished: false }],
      }),
    ).toBeNull();
  });

  it("names the version orders record now", () => {
    expect(recordedConsentVersion("kvkk-aydinlatma-metni", {})).toBeNull();
    expect(recordedConsentVersion(MSS, {})).toBe(LEGAL_UPDATED);
    expect(recordedConsentVersion(MSS, { [ONB]: text() })).toBe(LATER);
    expect(recordedConsentVersion(KARAOKE, {})).toBe(KARAOKE_LEGAL_UPDATED);
  });
});

describe("RBAC - new sections", () => {
  it("legal editing is owner-only", () => {
    expect(canAccess("legal", "owner")).toBe(true);
    expect(canAccess("legal", "manager")).toBe(false);
    expect(canAccess("legal", "staff")).toBe(false);
  });

  it("newsletter + leads are owner/manager, not staff", () => {
    for (const s of ["newsletter", "leads"] as const) {
      expect(canAccess(s, "owner")).toBe(true);
      expect(canAccess(s, "manager")).toBe(true);
      expect(canAccess(s, "staff")).toBe(false);
    }
  });
});
