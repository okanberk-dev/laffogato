import { readFileSync } from "node:fs";

import { describe, it, expect } from "vitest";

import {
  CHECKOUT_CONSENT_DOCS,
  LEGAL_CATEGORY_ORDER,
  LEGAL_DOCS,
  findLegalDoc,
} from "@/lib/legal/documents";
import { LEGAL_CONTENT } from "@/lib/legal/content";
import {
  LEGAL_ENTITY,
  LEGAL_TOKEN_NAMES,
  fillTokens,
  hasEmptyToken,
} from "@/lib/legal/entity";
import { FOOTER_LEGAL_DOCS } from "@/lib/legal/nav";

/**
 * Every `{{TOKEN}}` the entity module knows how to fill.
 *
 * Derived from the entity module rather than hand-copied. A copied list is a
 * third place to forget when a token is added, and the point of this test is
 * to check content.ts against the authority - so it must read the authority.
 */
const KNOWN_TOKENS = new Set(LEGAL_TOKEN_NAMES);

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

/** Prose strings - everything except a table's `value`, where empty tokens live. */
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

describe("legal content - token discipline", () => {
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

describe("legal content - identity is the tax certificate, never a placeholder", () => {
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
    // Placeholder shapes that have shown up in draft contracts before.
    expect(rendered).not.toMatch(/0123-4567-8901-2345/);
    expect(rendered).not.toMatch(/\b1234567890\b/);
    expect(rendered).not.toMatch(/\b\d{4}-\d{4}-\d{4}-\d{4}\b/);
    // The company has no KEP address and no published bank account. An
    // invented KEP would say tebligat can be served there; an invented IBAN
    // would say a refund can be sent to it.
    expect(LEGAL_ENTITY.kep).toBe("");
    expect(LEGAL_ENTITY.bank.iban).toBe("");
    expect(rendered).not.toMatch(/kep\.tr/i);
    expect(rendered).not.toMatch(/\bTR\d{2}[\s\d]{10,}/);
  });

  it("prints the real MERSİS number, and no other of its shape", () => {
    expect(LEGAL_ENTITY.mersisNo).toMatch(/^\d{16}$/);
    expect(rendered).toContain(LEGAL_ENTITY.mersisNo);
    for (const found of rendered.match(/\b\d{16}\b/g) ?? []) {
      expect(found).toBe(LEGAL_ENTITY.mersisNo);
    }
    // The trade registry row is withheld, so it must not be rendered at all.
    expect(rendered).not.toMatch(/Ticaret [Ss]icil [Nn]o[^,.\n]{0,12}\d/);
  });

  it("spells every social handle with the double t", () => {
    expect(rendered).not.toMatch(/@laffogato(?!t)/);
  });

  it("keeps the activity code (NACE) off the public site", () => {
    // The tax certificate says 621000 - software. It is an internal record and
    // is deliberately not published alongside the tax office and VKN.
    expect(rendered).not.toMatch(/621000/);
    expect(rendered).not.toMatch(/NACE/i);
    expect(rendered).not.toMatch(/faaliyet kodu/i);
  });

  it("names the infrastructure and payment provider the project actually uses", () => {
    // The virtual POS is PayNkolay. The data layer is {{DB_PROVIDER}} and the
    // member identity is {{AUTH_PROVIDER}}; both names come from the entity
    // module (tests/legal-single-source.test.ts forbids them in the source).
    expect(rendered).toContain("PayNkolay");
    expect(rendered).toContain(LEGAL_ENTITY.dbProvider);
    expect(rendered).toContain(LEGAL_ENTITY.authProvider);
    expect(rendered).not.toMatch(/PayTR/i);
    expect(rendered).not.toMatch(/Stripe/i);
  });

  it("never names the payment provider that was removed from the code", () => {
    // iyzico left the code on 15 Ekim 2026; 264 passages still named it.
    expect(JSON.stringify(LEGAL_CONTENT)).not.toMatch(/iyzico/i);
  });

  it("prints no long dash or en dash in the legal copy", () => {
    // Operator rule (22 Eylül 2026): a single hyphen. The ranges and
    // parentheticals that used U+2014 / U+2013 read " - " now.
    expect(rendered).not.toMatch(/[\u2013\u2014]/);
  });

  it("does not claim that card data stays away from the seller's servers", () => {
    // The card is typed on the site's own payment page and passes through the
    // server once, on its way to PayNkolay; it is not stored or logged. The
    // old sentences said it never reached the seller's servers.
    const claims = [
      /kart[^.]{0,80}(sunucular\w*|sistem\w*)[^.]{0,40}(geçmez|ulaşmaz|uğramaz)/i,
      /satıcı[^.]{0,60}kart[^.]{0,60}(ulaşmaz|görmez|erişemez)/i,
      /ödeme (kuruluşunun|hizmeti sağlayıcısının) (kendi )?(güvenli )?(sayfasında|ortamında)[^.]{0,60}girilir/i,
    ];
    for (const re of claims) {
      expect(rendered, String(re)).not.toMatch(re);
    }
  });

  it("promises no wallet, gift card or points", () => {
    // None exists. Gift vouchers may be mentioned only as not sold; points
    // were replaced by stamps.
    expect(rendered).not.toMatch(/Ödül puanı|puan bakiye|puan kazan/i);
    for (const d of LEGAL_DOCS) {
      for (const s of d.sections) {
        for (const text of [
          ...(s.paragraphs ?? []),
          ...(s.bullets ?? []),
          ...(s.ordered ?? []),
        ]) {
          if (!/hediye (çeki|kartı)|mağaza kredisi/i.test(text)) continue;
          expect(text, `${d.slug}: ${s.heading}`).toMatch(
            /satılmamakta|yapılmamakta|satılmaz|bulunmamakta|yoktur|sunulmamakta|geçerli değildir|uygulanmaz|yürütülmemekte/i,
          );
        }
      }
    }
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
    // KEP is the field that is still blank; MERSİS is now known.
    expect(hasEmptyToken("KEP: {{KEP}}")).toBe(true);
    expect(hasEmptyToken("MERSİS: {{MERSIS}}")).toBe(false);
    expect(hasEmptyToken("VKN: {{TAX_NO}}")).toBe(false);
    expect(hasEmptyToken("düz metin")).toBe(false);
  });
});

describe("legal metadata is separable from the contracts", () => {
  it("keeps the checkout constants out of the 1.5 MB registry", () => {
    // The checkout route imports these; pulling them from `documents.ts` would
    // put every contract into the bundle of the hottest route on the site.
    const meta = readFileSync("src/lib/legal/meta.ts", "utf8");
    expect(meta).not.toContain("./content");
    expect(meta).not.toContain("LEGAL_CONTENT");
    const checkout = readFileSync("src/app/odeme/actions.ts", "utf8");
    expect(checkout).toContain('from "@/lib/legal/meta"');
    expect(checkout).not.toContain('from "@/lib/legal/documents"');
  });

  it("names checkout consent documents that actually exist", () => {
    for (const slug of CHECKOUT_CONSENT_DOCS) {
      expect(LEGAL_DOCS.some((d) => d.slug === slug)).toBe(true);
    }
  });

  it("orders categories by a list that covers every document", () => {
    const known = new Set<string>(LEGAL_CATEGORY_ORDER);
    for (const doc of LEGAL_DOCS) {
      expect(known.has(doc.category)).toBe(true);
    }
  });
});
