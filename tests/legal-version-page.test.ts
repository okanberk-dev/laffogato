import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findLegalDoc } from "@/lib/legal/documents";
import { CHECKOUT_CONSENT_DOCS } from "@/lib/legal/meta";
import {
  codedVersionDoc,
  legalVersionOf,
  overrideVersionDoc,
} from "@/lib/legal/version-core";

/**
 * /hukuk/<slug>?surum=<prefix> (decision ASK-DURABLE): the stored version,
 * read-only, from `legal_doc_versions`. The confirmation mails link it.
 *
 * Two things are proven here. The page WITHOUT the parameter reads what it
 * always read (the cached override, the coded document) and never the
 * version table: the public pages must not wake the database (Neon,
 * tests/public-pages-cached-reads.test.ts). And WITH it, the parameter is
 * checked before anything is read, a prefix that names nothing is the
 * normal not-found page, and the value is never printed.
 */

const h = vi.hoisted(() => ({
  findLegalVersionByPrefix: vi.fn(),
  getSiteLegalOverride: vi.fn(),
  liveLegalDoc: vi.fn(),
}));

vi.mock("@/lib/legal/versions", () => ({
  findLegalVersionByPrefix: h.findLegalVersionByPrefix,
}));
vi.mock("@/lib/seo/site-data", () => ({
  getSiteLegalOverride: h.getSiteLegalOverride,
}));
vi.mock("@/lib/legal/karaoke-doc", () => ({ liveLegalDoc: h.liveLegalDoc }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: Record<string, unknown>) =>
    createElement("a", { href, ...rest }, children as never),
}));

const page = await import("@/app/hukuk/[slug]/page");

const MSS = CHECKOUT_CONSENT_DOCS[1];
const PREFIX = "0123456789abcdef";

const params = (slug: string) => Promise.resolve({ slug });
const query = (q: Record<string, string | string[] | undefined>) =>
  Promise.resolve(q);

/** The page's element, rendered through its async children. */
async function render(el: ReactElement): Promise<string> {
  const type = el.type as unknown;
  if (typeof type === "function") {
    const out = await (type as (p: unknown) => unknown)(el.props);
    return renderToStaticMarkup(out as ReactElement);
  }
  return renderToStaticMarkup(el);
}

beforeEach(() => {
  vi.clearAllMocks();
  h.getSiteLegalOverride.mockResolvedValue(null);
  h.liveLegalDoc.mockImplementation(async (slug: string) => findLegalDoc(slug));
  h.findLegalVersionByPrefix.mockResolvedValue(null);
});

describe("/hukuk/<slug> without ?surum= reads what it always read", () => {
  it.each([
    ["no query at all", undefined],
    ["an empty query", {}],
    ["other parameters", { utm_source: "mail", q: "x" }],
  ])(
    "%s: the cached override and the coded text, never the version table",
    async (_, q) => {
      const el = (await page.default({
        params: params(MSS),
        searchParams: q === undefined ? undefined : query(q),
      })) as ReactElement;
      const html = renderToStaticMarkup(el);
      expect(h.liveLegalDoc).toHaveBeenCalledWith(MSS);
      expect(h.getSiteLegalOverride).toHaveBeenCalledWith(MSS);
      expect(h.findLegalVersionByPrefix).not.toHaveBeenCalled();
      expect(html).toContain(findLegalDoc(MSS)!.title);
      expect(html).not.toContain("tarihli sürümdür");

      const meta = await page.generateMetadata({
        params: params(MSS),
        searchParams: q === undefined ? undefined : query(q),
      });
      expect(meta.robots).toEqual({ index: true, follow: true });
      expect(h.findLegalVersionByPrefix).not.toHaveBeenCalled();
    },
  );
});

describe("/hukuk/<slug>?surum=<prefix>", () => {
  const coded = legalVersionOf(codedVersionDoc(findLegalDoc(MSS)!));

  it("renders the stored version read-only with its date, and reads nothing else", async () => {
    h.findLegalVersionByPrefix.mockResolvedValue({
      version: coded,
      createdAt: "2026-10-21T09:00:00.000Z",
    });
    const el = (await page.default({
      params: params(MSS),
      searchParams: query({ surum: PREFIX }),
    })) as ReactElement;
    const html = await render(el);
    expect(h.findLegalVersionByPrefix).toHaveBeenCalledWith(MSS, PREFIX);
    expect(h.getSiteLegalOverride).not.toHaveBeenCalled();
    expect(h.liveLegalDoc).not.toHaveBeenCalled();
    expect(html).toContain(`Bu metin ${coded.doc.updatedAt} tarihli sürümdür.`);
    expect(html).toContain(coded.doc.title);
    expect(html).toContain(`Sürüm kimliği (SHA-256): ${coded.hash}`);
    // The current text is one link away, and nothing can be submitted.
    expect(html).toContain(`href="/hukuk/${MSS}"`);
    expect(html).not.toMatch(/<form|<input|<button/);
  });

  it("is never indexed, and its head reads nothing", async () => {
    const meta = await page.generateMetadata({
      params: params(MSS),
      searchParams: query({ surum: PREFIX }),
    });
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.alternates).toBeUndefined();
    expect(h.getSiteLegalOverride).not.toHaveBeenCalled();
    expect(h.findLegalVersionByPrefix).not.toHaveBeenCalled();
  });

  it("renders a stored panel text as Markdown, escaped", async () => {
    const doc = findLegalDoc(MSS)!;
    const v = legalVersionOf(
      overrideVersionDoc(doc, {
        title: "MSS <script>alert(1)</script>",
        summary: "",
        effectiveDate: "2 Kasım 2026",
        bodyMarkdown: "## 1. Taraflar\n\n<img src=x onerror=alert(1)>",
        isPublished: true,
        updatedAt: "",
      }),
    );
    h.findLegalVersionByPrefix.mockResolvedValue({ version: v, createdAt: "" });
    const html = await render(
      (await page.default({
        params: params(MSS),
        searchParams: query({ surum: PREFIX }),
      })) as ReactElement,
    );
    expect(html).toContain("Bu metin 2 Kasım 2026 tarihli sürümdür.");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it.each([
    ["too short to name one text", "0123456789abcde"],
    ["upper case", "0123456789ABCDEF"],
    ["not hex", "0123456789abcdeg"],
    ["markup", '"><script>alert(1)</script>'],
    ["empty", ""],
    ["longer than a hash", "a".repeat(65)],
  ])(
    "a prefix that is %s is the not-found page, read nothing, echo nothing",
    async (_, surum) => {
      const el = (await page.default({
        params: params(MSS),
        searchParams: query({ surum }),
      })) as ReactElement;
      await expect(render(el)).rejects.toThrow("NEXT_NOT_FOUND");
      expect(h.findLegalVersionByPrefix).not.toHaveBeenCalled();
      expect(h.getSiteLegalOverride).not.toHaveBeenCalled();
    },
  );

  it("a repeated parameter is not a prefix", async () => {
    const el = (await page.default({
      params: params(MSS),
      searchParams: query({ surum: [PREFIX, PREFIX] }),
    })) as ReactElement;
    await expect(render(el)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(h.findLegalVersionByPrefix).not.toHaveBeenCalled();
  });

  it("a prefix that names no stored text of this document (or several) is not found", async () => {
    h.findLegalVersionByPrefix.mockResolvedValue(null);
    const el = (await page.default({
      params: params(MSS),
      searchParams: query({ surum: PREFIX }),
    })) as ReactElement;
    await expect(render(el)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(h.findLegalVersionByPrefix).toHaveBeenCalledWith(MSS, PREFIX);
  });

  it("an unknown document is not found before anything is read", async () => {
    await expect(
      page.default({
        params: params("yok-boyle-bir-belge"),
        searchParams: query({ surum: PREFIX }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(h.findLegalVersionByPrefix).not.toHaveBeenCalled();
  });
});
