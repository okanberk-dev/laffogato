import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { findLegalDoc, LEGAL_DOCS } from "@/lib/legal/documents";
import { CHECKOUT_CONSENT_DOCS } from "@/lib/legal/meta";
import {
  codedVersionDoc,
  consentTextHashes,
  isVersionPrefix,
  legalVersionHash,
  legalVersionOf,
  legalVersionPath,
  legalVersionText,
  overrideVersionDoc,
  parseLegalVersionText,
  shownVersionDoc,
  VERSION_LINK_LENGTH,
  type ShownOverride,
} from "@/lib/legal/version-core";

/**
 * Decision D-VERSIONS-TABLE (21 Ekim 2026): every legal text shown is kept
 * by the SHA-256 of one canonical string, and a consent records that hash
 * next to its version label. These pin the string, the hash and the rule
 * that picks what /hukuk/<slug> shows - the hash a checkout records must be
 * the hash of the text the page printed, or the stored copy proves nothing.
 */

const OBF = CHECKOUT_CONSENT_DOCS[0];
const MSS = CHECKOUT_CONSENT_DOCS[1];

function override(patch: Partial<ShownOverride> = {}): ShownOverride {
  return {
    title: "Mesafeli Satış Sözleşmesi (yeni)",
    summary: "Yeni özet",
    effectiveDate: "2 Kasım 2026",
    bodyMarkdown: "## 1. Taraflar\n\nYeni metin.",
    isPublished: true,
    updatedAt: "2026-11-02T09:00:00.000Z",
    ...patch,
  };
}

describe("the canonical text and its hash", () => {
  it("hashes the UTF-8 bytes of the canonical JSON, as Postgres does", () => {
    const doc = findLegalDoc(OBF)!;
    const v = legalVersionOf(codedVersionDoc(doc));
    expect(v.text).toBe(legalVersionText(codedVersionDoc(doc)));
    expect(v.hash).toBe(
      createHash("sha256").update(Buffer.from(v.text, "utf8")).digest("hex"),
    );
    expect(v.hash).toMatch(/^[0-9a-f]{64}$/);
    // Turkish letters are multi-byte in UTF-8: the hash is of the bytes the
    // database's CHECK hashes (sha256(convert_to(body, 'UTF8'))).
    expect(legalVersionHash('{"a":"ğüş"}')).toBe(
      "8877e25d0af990ab6482c906d39be776f0f5d20b9527fe97f97e13fb9ab255b2",
    );
  });

  it("is one string per document, whoever builds it, with its keys in a fixed order", () => {
    const doc = findLegalDoc(MSS)!;
    const a = legalVersionText(codedVersionDoc(doc));
    const b = legalVersionText(
      codedVersionDoc({
        ...doc,
        sections: doc.sections.map((s) => ({ ...s })),
      }),
    );
    expect(a).toBe(b);
    expect(Object.keys(JSON.parse(a))).toEqual([
      "format",
      "slug",
      "source",
      "category",
      "title",
      "summary",
      "updatedAt",
      "references",
      "sections",
    ]);
  });

  it("stores the text as shown: tokens filled, the page's date beside it", () => {
    for (const doc of LEGAL_DOCS) {
      const text = legalVersionText(codedVersionDoc(doc));
      expect(text, doc.slug).not.toContain("{{");
      expect(JSON.parse(text).updatedAt).toBe(doc.updatedAt);
    }
  });

  it("gives a different text a different hash, the date included", () => {
    const doc = findLegalDoc(OBF)!;
    const base = legalVersionOf(codedVersionDoc(doc)).hash;
    expect(
      legalVersionOf(codedVersionDoc({ ...doc, updatedAt: "22 Ekim 2026" }))
        .hash,
    ).not.toBe(base);
    const s0 = doc.sections[0];
    expect(
      legalVersionOf(
        codedVersionDoc({
          ...doc,
          sections: [
            { ...s0, paragraphs: [...(s0.paragraphs ?? []), "Bir cümle."] },
            ...doc.sections.slice(1),
          ],
        }),
      ).hash,
    ).not.toBe(base);
  });
});

describe("what /hukuk/<slug> shows", () => {
  const doc = findLegalDoc(MSS)!;

  it("a published override with a body replaces the coded text", () => {
    const shown = shownVersionDoc(doc, override());
    expect(shown).toEqual(overrideVersionDoc(doc, override()));
    expect(shown.source).toBe("override");
    if (shown.source !== "override") return;
    expect(shown.title).toBe("Mesafeli Satış Sözleşmesi (yeni)");
    expect(shown.updatedAt).toBe("2 Kasım 2026");
    expect(shown.bodyMarkdown).toBe("## 1. Taraflar\n\nYeni metin.");
  });

  it("falls back to the coded title, summary and date where the override leaves them blank", () => {
    const shown = shownVersionDoc(
      doc,
      override({ title: "", summary: "", effectiveDate: "" }),
    );
    expect(shown.title).toBe(doc.title);
    expect(shown.summary).toBe(doc.summary);
    expect(shown.updatedAt).toBe(doc.updatedAt);
  });

  it("a draft or an empty override leaves the coded text", () => {
    const coded = legalVersionOf(codedVersionDoc(doc)).hash;
    for (const o of [
      null,
      undefined,
      override({ isPublished: false }),
      override({ bodyMarkdown: "   " }),
    ]) {
      expect(legalVersionOf(shownVersionDoc(doc, o)).hash).toBe(coded);
    }
  });
});

describe("a stored text read back", () => {
  it("round-trips both kinds exactly", () => {
    const doc = findLegalDoc(OBF)!;
    for (const v of [
      codedVersionDoc(doc),
      overrideVersionDoc(doc, override()),
    ]) {
      const text = legalVersionText(v);
      expect(parseLegalVersionText(text)).toEqual(v);
    }
  });

  it("refuses anything this code did not write", () => {
    const doc = findLegalDoc(OBF)!;
    const text = legalVersionText(overrideVersionDoc(doc, override()));
    const o = JSON.parse(text) as Record<string, unknown>;
    for (const bad of [
      "",
      "null",
      "[]",
      "not json",
      JSON.stringify({ ...o, format: 2 }),
      JSON.stringify({ ...o, source: "other" }),
      JSON.stringify({ ...o, title: 7 }),
      JSON.stringify({ ...o, extra: "x" }),
      // Same content, other key order: not the canonical string.
      JSON.stringify({ slug: o.slug, ...o }).replace(/^\{/, "{ "),
      JSON.stringify(Object.fromEntries(Object.entries(o).reverse())),
    ]) {
      expect(parseLegalVersionText(bad), bad.slice(0, 40)).toBeNull();
    }
  });
});

describe("version links and prefixes", () => {
  it("links 16 hex digits of the hash under the document's own path", () => {
    const hash = "a".repeat(64);
    expect(VERSION_LINK_LENGTH).toBe(16);
    expect(legalVersionPath(MSS, hash)).toBe(
      `/hukuk/${MSS}?surum=${"a".repeat(16)}`,
    );
  });

  it("accepts only lowercase hex of the link's length up to a whole hash", () => {
    expect(isVersionPrefix("0123456789abcdef")).toBe(true);
    expect(isVersionPrefix("f".repeat(64))).toBe(true);
    for (const bad of [
      "0123456789abcde", // one short: could name several texts
      "0123456789ABCDEF",
      "0123456789abcdeg",
      "f".repeat(65),
      "<script>alert(1)</script>",
      "",
      ["0123456789abcdef"],
      undefined,
      null,
      42,
    ]) {
      expect(isVersionPrefix(bad), String(bad)).toBe(false);
    }
  });
});

describe("consentTextHashes", () => {
  const h = (c: string) => c.repeat(64);

  it("returns every consented document's hash, or nothing", () => {
    const consent = {
      acceptedAt: "2026-10-21T10:00:00.000Z",
      textHashes: { [OBF]: h("a"), [MSS]: h("b"), extra: h("c") },
    };
    expect(consentTextHashes(consent, CHECKOUT_CONSENT_DOCS)).toEqual({
      [OBF]: h("a"),
      [MSS]: h("b"),
    });
    for (const bad of [
      null,
      {},
      { textHashes: {} },
      { textHashes: { [OBF]: h("a") } },
      { textHashes: { [OBF]: h("a"), [MSS]: "B".repeat(64) } },
      { textHashes: { [OBF]: h("a"), [MSS]: h("b").slice(1) } },
      { textHashes: [h("a"), h("b")] },
    ]) {
      expect(consentTextHashes(bad, CHECKOUT_CONSENT_DOCS)).toBeNull();
    }
  });
});
