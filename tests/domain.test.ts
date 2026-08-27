import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

import { SITE } from "@/lib/seo/site";
import { LEGAL_ENTITY } from "@/lib/legal/entity";
import { LEGAL_DOCS } from "@/lib/legal/documents";

describe("Canonical domain — laffogato.net", () => {
  it("SITE.url no longer points at the old .com.tr placeholder", () => {
    expect(SITE.url).not.toMatch(/laffogato\.com\.tr/);
    expect(SITE.url).toMatch(/^https?:\/\//);
  });

  it("legal entity contact e-mail is the operator's single contact address", () => {
    // Deliberately NOT on laffogato.net: the operator consolidated every
    // contact route onto one mailbox. The invariant this test still protects
    // is that the address is a real, configured one — never the .com.tr
    // placeholder the site shipped with.
    expect(LEGAL_ENTITY.legalEmail).toBe("info@nextgenlab.com.tr");
    expect(LEGAL_ENTITY.legalEmail).not.toMatch(/laffogato\.com\.tr/);
  });

  it("legal documents reference laffogato.net, never .com.tr", () => {
    const all = JSON.stringify(LEGAL_DOCS);
    expect(all).not.toMatch(/laffogato\.com\.tr/);
    expect(all).toMatch(/laffogato\.net/);
  });

  it("the public AI-crawler file (llms-full.txt) uses laffogato.net only", () => {
    const txt = readFileSync(
      resolve(process.cwd(), "public/llms-full.txt"),
      "utf8",
    );
    expect(txt).not.toMatch(/laffogato\.com\.tr/);
    expect(txt).toMatch(/laffogato\.net/);
  });
});
