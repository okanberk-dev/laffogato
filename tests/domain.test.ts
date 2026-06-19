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

  it("legal entity contact e-mail uses the laffogato.net domain", () => {
    expect(LEGAL_ENTITY.legalEmail).toBe("kvkk@laffogato.net");
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
