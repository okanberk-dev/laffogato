import { describe, it, expect } from "vitest";

import type { LegalDoc } from "@/lib/legal/documents";
import { sectionsToMarkdown } from "@/lib/legal/markdown";

const doc: LegalDoc = {
  slug: "ornek",
  title: "Örnek Belge",
  shortTitle: "Örnek",
  updatedAt: "26 Mayıs 2026",
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

describe("sectionsToMarkdown (legal editor prefill)", () => {
  const md = sectionsToMarkdown(doc);

  it("serializes headings as ## blocks", () => {
    expect(md).toContain("## 1. Giriş");
    expect(md).toContain("## 2. Maddeler");
  });

  it("keeps paragraphs as separate blocks", () => {
    expect(md).toContain("Birinci paragraf.");
    expect(md).toContain("İkinci paragraf.");
    // blocks are separated by a blank line
    expect(md).toMatch(/Birinci paragraf\.\n\nİkinci paragraf\./);
  });

  it("serializes bullets, ordered lists and tables", () => {
    expect(md).toContain("- madde a");
    expect(md).toContain("- madde b");
    expect(md).toContain("1. sıralı bir");
    expect(md).toContain("2. sıralı iki");
    expect(md).toContain("- **Unvan:** L'Affogato");
  });
});
