import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  consentVersionFrom,
  istanbulDayLabel,
  legalDayNumber,
  type ConsentOverride,
} from "@/lib/legal/consent-version";
import { CHECKOUT_CONSENT_DOCS, LEGAL_UPDATED } from "@/lib/legal/meta";

/**
 * API-13 (23 Eyl 2026): an order records WHICH revision of the Ön
 * Bilgilendirme Formu and the Mesafeli Satış Sözleşmesi the customer
 * confirmed. /hukuk/<slug> (and the app) show a published panel override
 * instead of the coded text, so a live override on either document must move
 * the recorded version; before this, every order kept saying LEGAL_UPDATED.
 */

type Row = ConsentOverride & { slug: string; title: string; summary: string };

const rows: Row[] = [];

// Enough of the query builder for getPublishedLegalOverride's one read.
vi.mock("@/lib/db", () => ({
  TABLES: { legalDocs: "legal_docs" },
  getDb: () => ({
    from: () => {
      const filters: Record<string, unknown> = {};
      const api = {
        select: () => api,
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return api;
        },
        maybeSingle: async () => ({
          data:
            rows.find((r) =>
              Object.entries(filters).every(
                ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
              ),
            ) ?? null,
          error: null,
          status: 200,
        }),
      };
      return api;
    },
  }),
}));

function override(patch: Partial<ConsentOverride> = {}): ConsentOverride {
  return {
    isPublished: true,
    bodyMarkdown: "## 1. Taraflar\n\nYeni metin.",
    effectiveDate: "15 Ekim 2026",
    updatedAt: "2026-10-15T09:00:00.000Z",
    ...patch,
  };
}

const [PRE, DISTANCE] = CHECKOUT_CONSENT_DOCS;

describe("legal day labels", () => {
  it("reads the documents' own date shape, month in any case", () => {
    expect(legalDayNumber(LEGAL_UPDATED)).toBe(20260901);
    expect(legalDayNumber("15 Ekim 2026")).toBe(20261015);
    expect(legalDayNumber(" 2 şubat 2027 ")).toBe(20270202);
    expect(legalDayNumber("1 AĞUSTOS 2026")).toBe(20260801);
  });

  it("refuses what is not a real day in that shape", () => {
    for (const label of [
      "",
      "Ekim 2026",
      "2026-10-15",
      "31 Eylül 2026",
      "0 Ekim 2026",
      "15 Octobre 2026",
    ]) {
      expect(legalDayNumber(label), label).toBeNull();
    }
  });

  it("prints an instant as the Istanbul day", () => {
    // 22:30 UTC is already the next day in Tuzla.
    expect(istanbulDayLabel("2026-10-14T22:30:00.000Z")).toBe("15 Ekim 2026");
    expect(istanbulDayLabel("2026-10-14T20:30:00.000Z")).toBe("14 Ekim 2026");
    expect(istanbulDayLabel("")).toBeNull();
  });
});

describe("consentVersionFrom", () => {
  it("is LEGAL_UPDATED while the coded checkout text is shown", () => {
    expect(consentVersionFrom({})).toBe(LEGAL_UPDATED);
  });

  it("follows a later published override of a checkout document", () => {
    expect(consentVersionFrom({ [DISTANCE]: override() })).toBe("15 Ekim 2026");
    expect(consentVersionFrom({ [PRE]: override() })).toBe("15 Ekim 2026");
  });

  it("takes the later of the two checkout overrides", () => {
    expect(
      consentVersionFrom({
        [PRE]: override({ effectiveDate: "3 Kasım 2026" }),
        [DISTANCE]: override({ effectiveDate: "15 Ekim 2026" }),
      }),
    ).toBe("3 Kasım 2026");
  });

  it("ignores drafts, empty bodies and every other document", () => {
    expect(
      consentVersionFrom({ [DISTANCE]: override({ isPublished: false }) }),
    ).toBe(LEGAL_UPDATED);
    expect(
      consentVersionFrom({ [DISTANCE]: override({ bodyMarkdown: "  \n" }) }),
    ).toBe(LEGAL_UPDATED);
    expect(consentVersionFrom({ "gizlilik-politikasi": override() })).toBe(
      LEGAL_UPDATED,
    );
    expect(consentVersionFrom({ [DISTANCE]: null })).toBe(LEGAL_UPDATED);
  });

  it("never moves the version back before LEGAL_UPDATED", () => {
    expect(
      consentVersionFrom({
        [DISTANCE]: override({ effectiveDate: "26 Mayıs 2026" }),
      }),
    ).toBe(LEGAL_UPDATED);
  });

  it("uses the day the override was saved when its date is blank or free text", () => {
    for (const effectiveDate of ["", "Ekim 2026 revizyonu"]) {
      expect(
        consentVersionFrom({
          [DISTANCE]: override({
            effectiveDate,
            updatedAt: "2026-10-14T22:30:00.000Z",
          }),
        }),
        effectiveDate,
      ).toBe("15 Ekim 2026");
    }
  });
});

describe("checkoutConsentVersion", () => {
  beforeEach(() => {
    rows.length = 0;
  });

  it("reads the published overrides of the checkout documents", async () => {
    const { checkoutConsentVersion } = await import("@/lib/legal/store");
    expect(await checkoutConsentVersion()).toBe(LEGAL_UPDATED);

    rows.push({
      slug: DISTANCE,
      title: "",
      summary: "",
      ...override({ isPublished: false }),
    });
    expect(await checkoutConsentVersion()).toBe(LEGAL_UPDATED);

    rows.push({
      slug: PRE,
      title: "",
      summary: "",
      ...override({ effectiveDate: "20 Ekim 2026" }),
    });
    expect(await checkoutConsentVersion()).toBe("20 Ekim 2026");
  });

  it("stays out of the 1.5 MB contract registry", () => {
    // Both checkout paths import it; see tests/legal-docs.test.ts.
    for (const file of [
      "src/lib/legal/consent-version.ts",
      "src/lib/legal/store.ts",
    ]) {
      const src = readFileSync(file, "utf8");
      expect(src, file).not.toContain("./content");
      expect(src, file).not.toContain("./documents");
    }
  });
});
