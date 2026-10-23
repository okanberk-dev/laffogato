import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The kit's FilterBar (admin audit SHE-07, ORD-08, KAR-10; Innex, 22 Eki
 * 2026): the orders filter was an always-open 658 px form on a phone, so
 * the first order started 1.3 screens down, and a 220 px card at 1440 px.
 * Now it is one toolbar row at every width: the search box, "Filtreler
 * (n)" and "Uygula"; the dropdowns and dates open under it, open when one
 * of them is set. One or two dropdowns alone stay in the row. And "Uygula"
 * says it is working while the list loads (ORD-17).
 */

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
    prefetch?: boolean;
  }) => createElement("a", { href, ...rest }, children),
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  unstable_rethrow: vi.fn(),
}));

const {
  FilterBar,
  compactAllLabel,
  foldedFiltersLabel,
  foldsInline,
  openFromMd,
  splitFilterFields,
} = await import("@/components/admin/ui/filter-bar");
const { ORDER_FILTER_FIELDS } = await import("@/lib/admin/order-filters");
const { AUDIT_FILTER_FIELDS } = await import("@/lib/admin/audit-view");
const { parseFilters } = await import("@/lib/admin/list-params");

const PATH = "/admin/siparisler";
const render = (sp: Record<string, string>) =>
  renderToStaticMarkup(
    createElement(FilterBar, {
      fields: ORDER_FILTER_FIELDS,
      searchParams: sp,
      values: parseFilters(sp, ORDER_FILTER_FIELDS),
      pathname: PATH,
      label: "Sipariş filtreleri",
    }),
  );
/** The markup of the folded group, from <details to </details>. */
const folded = (html: string) => {
  const start = html.indexOf("<details");
  return start < 0 ? "" : html.slice(start, html.indexOf("</details>") + 10);
};

describe("which fields fold on a phone", () => {
  it("the first search box stays out, everything else folds", () => {
    const { lead, folded: rest } = splitFilterFields(ORDER_FILTER_FIELDS, []);
    expect(lead?.type).toBe("search");
    expect(rest).toHaveLength(ORDER_FILTER_FIELDS.length - 1);
    expect(rest).not.toContain(lead);
    // The audit log has two search boxes: only the first stays out.
    const audit = splitFilterFields(AUDIT_FILTER_FIELDS, []);
    expect(audit.lead).toBe(AUDIT_FILTER_FIELDS[0]);
    expect(audit.folded.filter((f) => f.type === "search")).toHaveLength(1);
  });

  it("counts only the folded filters that are set, a date range once", () => {
    const keys = ["q", "kanal", "bas|bit", "unknown"];
    const { foldedActive } = splitFilterFields(ORDER_FILTER_FIELDS, keys);
    expect(foldedActive).toBe(2);
    expect(foldedFiltersLabel(0)).toBe("Filtreler");
    expect(foldedFiltersLabel(2)).toBe("Filtreler (2)");
  });

  it("a bar with no dropdown has nothing to fold", () => {
    const only = splitFilterFields(
      [{ type: "search", name: "q", label: "Ara" }],
      ["q"],
    );
    expect(only.folded).toEqual([]);
    expect(only.foldedActive).toBe(0);
  });
});

describe("markup", () => {
  it("unfiltered: the search box shows, the rest sits in a closed group", () => {
    const html = render({});
    const group = folded(html);
    expect(group).toMatch(/^<details class="/);
    expect(group).not.toMatch(/^<details[^>]*\sopen=""/);
    expect(group).toContain(">Filtreler<");
    // The search box is outside the group, every other field inside.
    expect(html.indexOf('type="search"')).toBeLessThan(
      html.indexOf("<details"),
    );
    expect(group).not.toContain('type="search"');
    for (const name of [
      "kanal",
      "tur",
      "teslimat",
      "odeme",
      "dikkat",
      "bas",
      "bit",
    ]) {
      expect(group, name).toContain(`name="${name}"`);
    }
  });

  it("a set dropdown or date opens the group and counts in its summary", () => {
    const group = folded(render({ kanal: "app", bas: "2026-10-01" }));
    expect(group).toMatch(/^<details[^>]*\sopen=""/);
    expect(group).toContain(">Filtreler (2)<");
    // A search alone keeps the group closed: it is not inside.
    const searched = folded(render({ q: "ayşe" }));
    expect(searched).not.toMatch(/^<details[^>]*\sopen=""/);
    expect(searched).toContain(">Filtreler<");
  });

  it("is one row at every width: the fields open as a row of their own under it", () => {
    const html = render({});
    const group = folded(html);
    const details = /^<details class="([^"]*)"/.exec(group)?.[1] ?? "";
    // The group is `contents`, so its summary is a button in the toolbar's
    // row and its fields a full-width row under it; a closed group's
    // fields are hidden by their own class (the ::details-content box is
    // `contents` too, which would show them).
    expect(details.split(" ")).toContain("contents");
    expect(details).toContain("details-content:contents");
    expect(details).not.toContain("md:");
    const panel = /<\/summary><div class="([^"]*)"/.exec(group)?.[1] ?? "";
    expect(panel.split(" ")).toEqual(
      expect.arrayContaining(["hidden", "basis-full", "group-open:flex"]),
    );
    expect(group).not.toMatch(/<summary class="[^"]*md:hidden/);
    // No more forced opening from md up: the operator closes it.
    const src = readFileSync("src/components/admin/ui/filter-bar.tsx", "utf8");
    expect(src).not.toContain("ref={openFromMd}");
    // "Uygula" follows the fields when they are open: the order a keyboard
    // reaches them in.
    expect(src).toContain("[:has(>details[open])>&]:order-3");
  });

  it("the lead search box shows a magnifier, its label kept for a screen reader", () => {
    const html = render({});
    const box = html.slice(0, html.indexOf('type="search"'));
    expect(box).toMatch(/<label for="[^"]*" class="sr-only">Ara<\/label>/);
    expect(html).toMatch(/data-admin-search=""/);
  });

  it("the card is the search landmark; the list's controls share its row", () => {
    const html = render({});
    expect(html).toMatch(
      /<div role="search" aria-label="Sipariş filtreleri" class="[^"]*rounded-xl/,
    );
    expect(html).toMatch(/<form class="contents"/);
  });

  it("one or two dropdowns stay in the row, with their name in each choice", () => {
    const select = (name: string) => ({
      type: "select" as const,
      name,
      label: "Kategori",
      options: [{ value: "kiler", label: "Kiler" }],
    });
    expect(foldsInline([select("a")])).toBe(true);
    expect(foldsInline([select("a"), select("b")])).toBe(true);
    expect(foldsInline([select("a"), select("b"), select("c")])).toBe(false);
    expect(
      foldsInline([
        { type: "date-range", label: "Tarih", from: "bas", to: "bit" },
      ]),
    ).toBe(false);
    expect(foldsInline([])).toBe(false);
    expect(compactAllLabel({ label: "Durum" })).toBe("Durum: tümü");
    expect(compactAllLabel({ label: "Dikkat", allLabel: "Hepsi" })).toBe(
      "Dikkat: hepsi",
    );
    expect(
      compactAllLabel({ label: "Kategori", allLabel: "Tüm kategoriler" }),
    ).toBe("Tüm kategoriler");
    const html = renderToStaticMarkup(
      createElement(FilterBar, {
        fields: [
          { type: "search", name: "q", label: "Ara" },
          select("kategori"),
        ],
        searchParams: {},
        pathname: "/admin/urunler",
      }),
    );
    expect(html).not.toContain("<details");
    expect(html).toContain(">Kategori: Kiler</option>");
    expect(html).toMatch(
      /<label for="[^"]*" class="sr-only">Kategori<\/label>/,
    );
  });

  it("openFromMd opens a folded form from md up, also after a resize (the stock correction)", () => {
    // Stok's correction form hides its summary from md up: a group left
    // closed there (a tablet turned from portrait to landscape) could not
    // be opened.
    let wide = false;
    const listeners = new Set<() => void>();
    const media = {
      get matches() {
        return wide;
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    };
    vi.stubGlobal("window", { matchMedia: () => media });
    try {
      const el = { open: false } as HTMLDetailsElement;
      const cleanup = openFromMd(el);
      expect(el.open).toBe(false);
      wide = true;
      for (const fn of listeners) fn();
      expect(el.open).toBe(true);
      // A phone user's own toggle is left alone below md.
      wide = false;
      el.open = false;
      for (const fn of listeners) fn();
      expect(el.open).toBe(false);
      cleanup?.();
      expect(listeners.size).toBe(0);
      // Already wide on mount: open at once.
      wide = true;
      const other = { open: false } as HTMLDetailsElement;
      openFromMd(other)?.();
      expect(other.open).toBe(true);
      expect(openFromMd(null)).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("chips stay; the form posts instead of the old GET", () => {
    const html = render({ kanal: "app", durum: "paid", sayfa: "3" });
    expect(html).toContain('role="search"');
    // The search box's text goes in a post's body (list-search-core.ts):
    // no GET, no URL action.
    expect(html).not.toMatch(/method="get"/i);
    expect(html).not.toMatch(/<form[^>]*\saction="\//);
    expect(html).not.toContain('name="sayfa"');
    expect(html).toContain('aria-label="Etkin filtreler"');
    expect(html).toContain(">Uygula</button>");
    expect(html).not.toContain("aria-busy");
  });

  it("Uygula says it is working until the filtered list is in", () => {
    // The post runs as an action: `pending` holds until the new list
    // renders, and the old list no longer sits there with no sign of it.
    const src = readFileSync("src/components/admin/ui/filter-bar.tsx", "utf8");
    expect(src).toContain("useActionState(postListSearch, null)");
    expect(src).toContain("useNoResetSubmit(dispatch, pending)");
    expect(src).toContain('{pending ? "Uygulanıyor…" : "Uygula"}');
    expect(src).toContain("aria-busy={pending || undefined}");
  });
});
