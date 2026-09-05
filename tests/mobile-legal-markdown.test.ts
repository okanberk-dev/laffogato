import { describe, expect, it } from "vitest";

import type { LegalDoc } from "@/lib/legal/documents";
import { sectionsToMarkdown } from "@/lib/legal/markdown";
import { markdownToSections } from "@/lib/mobile/legal-markdown";

/**
 * An admin override is Markdown; the app renders structured sections. The
 * bridge has to read exactly the dialect the editor accepts (the same one
 * `LegalMarkdown` renders on /hukuk), so the phone shows what the site shows
 * at the moment of consent.
 */
describe("markdownToSections", () => {
  it("maps ## and ### to section headings", () => {
    const out = markdownToSections(
      "## 1. Taraflar\n\nMetin.\n\n### 1.1 Satıcı\n\nDaha metin.",
      "Belge",
    );
    expect(out.map((s) => s.heading)).toEqual(["1. Taraflar", "1.1 Satıcı"]);
    expect(out[0].paragraphs).toEqual(["Metin."]);
    expect(out[1].paragraphs).toEqual(["Daha metin."]);
  });

  it("reads - and * as bullets, 1. and 1) as ordered items", () => {
    const out = markdownToSections(
      [
        "## Maddeler",
        "- madde a",
        "* madde b",
        "",
        "1. sıralı bir",
        "2) sıralı iki",
      ].join("\n"),
      "Belge",
    );
    expect(out).toHaveLength(1);
    expect(out[0].bullets).toEqual(["madde a", "madde b"]);
    expect(out[0].ordered).toEqual(["sıralı bir", "sıralı iki"]);
    expect(out[0].paragraphs).toBeUndefined();
  });

  it("joins consecutive lines into one paragraph and splits on blank lines", () => {
    const out = markdownToSections(
      "## Giriş\nBirinci satır\nikinci satır.\n\nAyrı paragraf.",
      "Belge",
    );
    expect(out[0].paragraphs).toEqual([
      "Birinci satır ikinci satır.",
      "Ayrı paragraf.",
    ]);
  });

  it("gives text before the first heading the document's short title", () => {
    const out = markdownToSections(
      "Ön söz.\n\n## 1. Amaç\n\nAmaç metni.",
      "Kısa Ad",
    );
    expect(out.map((s) => s.heading)).toEqual(["Kısa Ad", "1. Amaç"]);
    expect(out[0].paragraphs).toEqual(["Ön söz."]);
  });

  it("a body with no headings at all is one section under the short title", () => {
    const out = markdownToSections("Sadece metin.\n- bir madde", "Kısa Ad");
    expect(out).toEqual([
      {
        heading: "Kısa Ad",
        paragraphs: ["Sadece metin."],
        bullets: ["bir madde"],
      },
    ]);
  });

  it("drops **bold** marks — the app renders plain text", () => {
    const out = markdownToSections(
      "## Kimlik\n- **Unvan:** L'Affogato\n\n**Önemli** not.",
      "Belge",
    );
    expect(out[0].bullets).toEqual(["Unvan: L'Affogato"]);
    expect(out[0].paragraphs).toEqual(["Önemli not."]);
  });

  it("tolerates CRLF, stray whitespace and empty headings", () => {
    const out = markdownToSections(
      "## \r\n  ## Başlık  \r\n\r\n  metin  \r\n",
      "Belge",
    );
    expect(out).toEqual([{ heading: "Başlık", paragraphs: ["metin"] }]);
  });

  it("empty input yields no sections", () => {
    expect(markdownToSections("", "Belge")).toEqual([]);
    expect(markdownToSections("\n\n  \n", "Belge")).toEqual([]);
  });

  it("round-trips what the editor is pre-filled with", () => {
    // The admin editor starts from `sectionsToMarkdown(doc)`; publishing it
    // untouched must give the app the same sections back (tables become
    // "Key: value" bullets, the one shape the editor has for them).
    const doc: LegalDoc = {
      slug: "ornek",
      title: "Örnek Belge",
      shortTitle: "Örnek",
      updatedAt: "1 Eylül 2026",
      category: "Test",
      summary: "Özet.",
      sections: [
        {
          heading: "1. Giriş",
          paragraphs: ["Birinci paragraf.", "İkinci paragraf."],
        },
        {
          heading: "2. Maddeler",
          bullets: ["madde a", "madde b"],
          ordered: ["sıralı bir", "sıralı iki"],
          table: [{ key: "Unvan", value: "L'Affogato" }],
        },
      ],
    };
    const out = markdownToSections(sectionsToMarkdown(doc), doc.shortTitle);
    expect(out).toEqual([
      {
        heading: "1. Giriş",
        paragraphs: ["Birinci paragraf.", "İkinci paragraf."],
      },
      {
        heading: "2. Maddeler",
        ordered: ["sıralı bir", "sıralı iki"],
        bullets: ["madde a", "madde b", "Unvan: L'Affogato"],
      },
    ]);
  });
});
