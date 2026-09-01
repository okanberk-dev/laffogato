import { describe, it, expect } from "vitest";

import {
  CHECKOUT_CONSENT_DOCS,
  LEGAL_CATEGORY_ORDER,
  LEGAL_DOCS,
  findLegalDoc,
} from "@/lib/legal/documents";
import { LEGAL_CONTENT } from "@/lib/legal/content";
import { LEGAL_ENTITY, fillTokens, hasEmptyToken } from "@/lib/legal/entity";
import { FOOTER_LEGAL_DOCS } from "@/lib/legal/nav";

/** Every `{{TOKEN}}` the entity module knows how to fill. */
const KNOWN_TOKENS = new Set([
  "LEGAL_NAME",
  "SHORT_NAME",
  "BRAND",
  "ADDRESS",
  "PHONE",
  "EMAIL",
  "TAX_OFFICE",
  "TAX_NO",
  "TAX_TYPE",
  "STARTED_AT",
  "NACE",
  "MERSIS",
  "TRADE_REGISTRY",
  "KEP",
  "IBAN",
  "BANK",
  "SITE",
  "SITE_URL",
  "HANDLE",
  "IG",
  "TIKTOK",
  "YOUTUBE",
]);

/** Every free-text string in a source document, paired with its locator. */
function sourceStrings(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const doc of LEGAL_CONTENT) {
    out.push([`${doc.slug}.title`, doc.title]);
    out.push([`${doc.slug}.summary`, doc.summary]);
    for (const r of doc.references ?? []) {
      out.push([`${doc.slug}.references`, r]);
    }
    doc.sections.forEach((s, i) => {
      const at = `${doc.slug}#${i + 1}`;
      out.push([`${at}.heading`, s.heading]);
      for (const t of s.paragraphs ?? []) out.push([`${at}.paragraphs`, t]);
      for (const t of s.bullets ?? []) out.push([`${at}.bullets`, t]);
      for (const t of s.ordered ?? []) out.push([`${at}.ordered`, t]);
      for (const r of s.table ?? []) {
        out.push([`${at}.table.key`, r.key]);
        out.push([`${at}.table.value`, r.value]);
      }
    });
  }
  return out;
}

/** Prose strings — everything except a table's `value`, where empty tokens live. */
function proseStrings(): Array<[string, string]> {
  return sourceStrings().filter(([where]) => !where.endsWith(".table.value"));
}

describe("legal document set", () => {
  it("ships every document the checkout and footer link to", () => {
    for (const slug of [
      ...CHECKOUT_CONSENT_DOCS,
      ...FOOTER_LEGAL_DOCS.map((d) => d.slug),
    ]) {
      expect(findLegalDoc(slug), `eksik belge: ${slug}`).toBeDefined();
    }
  });

  it("has unique slugs and a known category for every document", () => {
    const slugs = LEGAL_DOCS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const d of LEGAL_DOCS) {
      expect(
        LEGAL_CATEGORY_ORDER as readonly string[],
        `${d.slug} bilinmeyen kategori: ${d.category}`,
      ).toContain(d.category);
    }
  });

  it("groups documents by category in the canonical order", () => {
    const ranks = LEGAL_DOCS.map((d) =>
      (LEGAL_CATEGORY_ORDER as readonly string[]).indexOf(d.category),
    );
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("renders every document with real content in every section", () => {
    for (const d of LEGAL_DOCS) {
      expect(d.sections.length, `${d.slug} bölümsüz`).toBeGreaterThanOrEqual(8);
      expect(d.summary.length, `${d.slug} özeti kısa`).toBeGreaterThan(60);
      for (const s of d.sections) {
        const filled =
          (s.paragraphs?.length ?? 0) +
          (s.bullets?.length ?? 0) +
          (s.ordered?.length ?? 0) +
          (s.table?.length ?? 0);
        expect(filled, `${d.slug} · "${s.heading}" boş`).toBeGreaterThan(0);
      }
    }
  });
});

describe("legal content — token discipline", () => {
  it("uses only tokens the entity module can fill", () => {
    for (const [where, text] of sourceStrings()) {
      for (const m of text.matchAll(/\{\{([A-Z_]+)\}\}/g)) {
        expect(KNOWN_TOKENS, `${where}: {{${m[1]}}}`).toContain(m[1]);
      }
    }
  });

  it("keeps unknown-value tokens out of prose", () => {
    // MERSİS / sicil / KEP / IBAN are blank; in a sentence they would leave a
    // hole, so they belong only in a table value, where the row is dropped.
    for (const [where, text] of proseStrings()) {
      expect(hasEmptyToken(text), `${where} boş token içeriyor`).toBe(false);
    }
  });

  it("carries no markdown syntax (the renderer emits plain text nodes)", () => {
    for (const [where, text] of sourceStrings()) {
      expect(text, `${where}`).not.toMatch(/\*\*/);
      expect(text, `${where}`).not.toMatch(/^#{1,6}\s/);
    }
  });
});

describe("legal content — identity is the tax certificate, never a placeholder", () => {
  const rendered = JSON.stringify(LEGAL_DOCS);

  it("names the real legal entity and never the old placeholder", () => {
    expect(rendered).toContain(LEGAL_ENTITY.legalName);
    expect(rendered).not.toMatch(/Gıda ve Servis A\.Ş\./);
  });

  it("uses the single contact address everywhere", () => {
    expect(rendered).toContain("info@nextgenlab.com.tr");
    for (const stale of [
      "tuzla@laffogato.it",
      "hello@laffogato.net",
      "kvkk@laffogato.net",
      "operasyon@laffogato.it",
    ]) {
      expect(rendered, `eski adres: ${stale}`).not.toContain(stale);
    }
  });

  it("never invents a registration number, IBAN or KEP address", () => {
    expect(rendered).not.toMatch(/0123-4567-8901-2345/);
    expect(rendered).not.toMatch(/\b1234567890\b/);
    expect(rendered).not.toMatch(/kep\.tr/i);
    expect(rendered).not.toMatch(/\bTR\d{2}[\s\d]{10,}/);
    // A MERSİS number is 16 digits, often dash-grouped. Mentioning MERSİS in
    // prose is fine; printing one we do not have is not.
    expect(rendered).not.toMatch(/\b\d{4}-\d{4}-\d{4}-\d{4}\b/);
    expect(rendered).not.toMatch(/MERSİS[^.\n]{0,20}\b\d{10,}\b/i);
  });

  it("spells every social handle with the double t", () => {
    expect(rendered).not.toMatch(/@laffogato(?!t)/);
  });

  it("drops table rows whose value is an unknown token", () => {
    // The seller-identity table exists but must not carry an empty MERSİS row.
    for (const d of LEGAL_DOCS) {
      for (const s of d.sections) {
        for (const row of s.table ?? []) {
          expect(row.value.trim(), `${d.slug} · ${row.key}`).not.toBe("");
        }
      }
    }
  });
});

describe("fillTokens", () => {
  it("substitutes known tokens and leaves unknown ones untouched", () => {
    expect(fillTokens("{{TAX_NO}}")).toBe("6312110904");
    expect(fillTokens("{{EMAIL}}")).toBe(LEGAL_ENTITY.email);
    expect(fillTokens("{{NOPE}}")).toBe("{{NOPE}}");
  });

  it("reports tokens whose value is unknown", () => {
    expect(hasEmptyToken("MERSİS: {{MERSIS}}")).toBe(true);
    expect(hasEmptyToken("VKN: {{TAX_NO}}")).toBe(false);
    expect(hasEmptyToken("düz metin")).toBe(false);
  });
});
