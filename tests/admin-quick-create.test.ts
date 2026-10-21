import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
  }) => createElement("a", { href, ...rest }, children),
}));

const { QuickCreate, quickCreateEntries } =
  await import("@/components/admin/dashboard/quick-create");
const { CREATE_ENTRIES } = await import("@/lib/admin/palette-core");

/**
 * Genel bakış's "Hızlı ekle" (21 Eki 2026): the role's "Yeni …" pages, one
 * tap from the landing page, from the palette's own list (one list, so the
 * two never disagree), each gated by the section its page asks for.
 */
describe("Hızlı ekle", () => {
  it("gives the owner every page that starts a record, and nothing else", () => {
    const hrefs = quickCreateEntries("owner").map((e) => e.href);
    expect(hrefs).toEqual(
      CREATE_ENTRIES.filter((e) => e.href.endsWith("/yeni")).map((e) => e.href),
    );
    expect(hrefs).not.toContain("/admin/urunler/ice-aktar");
    expect(hrefs).not.toContain("/admin/masalar/yazdir");
  });

  it("follows the roles: staff a new order only, the cashier nothing", () => {
    expect(quickCreateEntries("staff").map((e) => e.href)).toEqual([
      "/admin/siparisler/yeni",
    ]);
    expect(quickCreateEntries("cashier")).toEqual([]);
    const manager = quickCreateEntries("manager").map((e) => e.href);
    expect(manager).toContain("/admin/menu/yeni");
    expect(manager).toContain("/admin/promosyon/yeni");
  });

  it("names each chip by its record, and its link by the whole action", () => {
    const html = renderToStaticMarkup(
      createElement(QuickCreate, { entries: quickCreateEntries("owner") }),
    );
    // "Yeni Sipariş" to a screen reader, with the visible word in it (WCAG
    // 2.5.3): no aria-label that would hide the word a voice command says.
    expect(html).toContain('<span class="sr-only">Yeni </span>Sipariş</span>');
    expect(html).not.toContain("aria-label=");
    expect(html).toContain(">Menü kalemi<");
    expect(html).toContain(">Uygulama slaytı<");
    expect(html).toContain('href="/admin/masalar/yeni"');
  });

  it("keeps the chips' screen-reader words inside the phone's scroll box", () => {
    // The sr-only "Yeni " is absolute: without a positioned scroll box it
    // hung past the screen from the last chips and the phone zoomed the
    // whole dashboard out.
    const html = renderToStaticMarkup(
      createElement(QuickCreate, { entries: quickCreateEntries("owner") }),
    );
    const list = /<ul class="([^"]*)"/.exec(html)![1];
    expect(list).toContain("overflow-x-auto");
    expect(list.split(" ")).toContain("relative");
  });

  it("draws nothing for a role with no new page", () => {
    expect(
      renderToStaticMarkup(createElement(QuickCreate, { entries: [] })),
    ).toBe("");
  });
});
