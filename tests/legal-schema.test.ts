import { describe, it, expect } from "vitest";

import {
  consentSaveRefusal,
  consentScope,
  EFFECTIVE_DATE_FORMAT_ERROR,
  legalDocSchema,
  recordedConsentStates,
  recordedConsentVersion,
  resolveEffectiveDate,
  type ConsentArchiveRow,
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

  // An archived text, shown from its updatedAt until archivedAt.
  function shown(
    slug: string,
    from: string,
    to: string,
    patch: Partial<ConsentOverride> = {},
  ): ConsentArchiveRow {
    return { ...text(patch), slug, updatedAt: from, archivedAt: to };
  }

  it("refuses a date an earlier published text of the document used", () => {
    const old = shown(
      MSS,
      "2030-03-08T09:00:00.000Z",
      "2030-03-09T09:00:00.000Z",
      {
        bodyMarkdown: "## 1. Taraflar\n\nArşivdeki metin.",
        effectiveDate: LATEST,
      },
    );
    expect(
      check({ after: text({ effectiveDate: LATEST }), archived: [old] }),
    ).toMatch(
      /^"11 Mart 2030" sürümü onaylarda daha önce başka bir metinle kaydedildi/,
    );
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

  // Both checkout documents share one version: a label stands for the pair.
  const ONB_TEXT = "## 1. Taraflar\n\nÖn bilgilendirme metni.";
  const MSS_TEXT = "## 1. Taraflar\n\nMesafeli satış metni.";

  it("refuses the date an archived text of the other checkout document was recorded under", () => {
    // Ön Bilgilendirme went live at LATEST and was reset: orders recorded
    // LATEST for (that text, coded Mesafeli Satış). A Mesafeli Satış text
    // going live at LATEST would put a second pair under the same label.
    const onb = shown(
      ONB,
      "2030-03-08T09:00:00.000Z",
      "2030-03-09T09:00:00.000Z",
      {
        bodyMarkdown: ONB_TEXT,
        effectiveDate: LATEST,
      },
    );
    expect(
      check({
        after: text({ bodyMarkdown: MSS_TEXT, effectiveDate: LATEST }),
        archived: [onb],
      }),
    ).toMatch(/tek sürümü paylaşır/);
    expect(
      check({
        after: text({ bodyMarkdown: MSS_TEXT, effectiveDate: "12 Mart 2030" }),
        archived: [onb],
      }),
    ).toBeNull();
  });

  it("refuses a restore under its old date once the other checkout document changed", () => {
    // Ön Bilgilendirme LATEST was shown with the coded Mesafeli Satış and
    // reset; Mesafeli Satış then went live at LATER. Restoring the
    // Ön Bilgilendirme text under LATEST would record LATEST for a new pair.
    const onb = shown(
      ONB,
      "2030-03-08T09:00:00.000Z",
      "2030-03-09T09:00:00.000Z",
      {
        bodyMarkdown: ONB_TEXT,
        effectiveDate: LATEST,
      },
    );
    const mss = text({
      bodyMarkdown: MSS_TEXT,
      effectiveDate: LATER,
      updatedAt: "2030-03-10T09:00:00.000Z",
    });
    const restored = { ...onb, updatedAt: "2030-03-12T09:00:00.000Z" };
    expect(
      check({
        slug: ONB,
        after: restored,
        overrides: { [MSS]: mss },
        archived: [onb],
      }),
    ).toMatch(/^"11 Mart 2030" sürümü/);
    // Nothing changed beside it: the text comes back under its own label.
    expect(
      check({ slug: ONB, after: restored, overrides: {}, archived: [onb] }),
    ).toBeNull();
  });

  it("refuses moving a live date back onto a label the other document's earlier pair holds", () => {
    // ONB went live at LATER (pair: ONB, coded), MSS at LATEST (pair: ONB,
    // MSS). Re-dating MSS to LATER, body unchanged, would record LATER for
    // (ONB, MSS) as well.
    const onb = text({
      bodyMarkdown: ONB_TEXT,
      effectiveDate: LATER,
      updatedAt: "2030-03-08T09:00:00.000Z",
    });
    const mss = text({
      bodyMarkdown: MSS_TEXT,
      effectiveDate: LATEST,
      updatedAt: "2030-03-09T09:00:00.000Z",
    });
    const overrides = { [ONB]: onb, [MSS]: mss };
    expect(
      check({
        before: mss,
        after: { ...mss, effectiveDate: LATER },
        overrides,
      }),
    ).toMatch(/^"10 Mart 2030" sürümü/);
    // Forward is fine: a new label for the same pair.
    expect(
      check({
        before: mss,
        after: { ...mss, effectiveDate: "12 Mart 2030" },
        overrides,
      }),
    ).toBeNull();
  });

  it("rebuilds the recorded versions from the archive and the stored rows", () => {
    const onb = shown(
      ONB,
      "2030-03-08T09:00:00.000Z",
      "2030-03-09T09:00:00.000Z",
      {
        bodyMarkdown: ONB_TEXT,
        effectiveDate: LATER,
      },
    );
    const mss = text({
      bodyMarkdown: MSS_TEXT,
      effectiveDate: LATEST,
      updatedAt: "2030-03-10T09:00:00.000Z",
    });
    const states = recordedConsentStates(
      { docs: CHECKOUT_CONSENT_DOCS, base: LEGAL_UPDATED },
      [onb],
      { [MSS]: mss },
    );
    const pair = (a: string | null, b: string | null) => JSON.stringify([a, b]);
    expect(states.get(LEGAL_UPDATED)).toEqual(new Set([pair(null, null)]));
    expect(states.get(LATER)).toEqual(new Set([pair(ONB_TEXT, null)]));
    expect(states.get(LATEST)).toEqual(new Set([pair(null, MSS_TEXT)]));
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
