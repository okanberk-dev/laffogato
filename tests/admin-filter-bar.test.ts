import { readFileSync } from "node:fs";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The kit's FilterBar on a phone (admin audit SHE-07, ORD-08, KAR-10): the
 * orders filter was an always-open 658 px form, so the first order started
 * 1.3 screens down. Below md the dropdowns and dates now fold behind
 * "Filtreler (n)", open when one of them is set; from md up the row is
 * unchanged. And "Uygula" says it is working while the list loads (ORD-17).
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

const { FilterBar, foldedFiltersLabel, openFromMd, splitFilterFields } =
  await import("@/components/admin/ui/filter-bar");
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

  it("from md up the group is the old row: always shown, no summary", () => {
    const group = folded(render({}));
    const details = /^<details class="([^"]*)"/.exec(group)?.[1] ?? "";
    expect(details).toContain("md:contents");
    // A closed <details> hides its content in its ::details-content box.
    expect(details).toContain("md:details-content:contents");
    expect(group).toMatch(/<summary class="[^"]*md:hidden/);
    expect(group).toMatch(/<div class="[^"]*md:contents/);
    // A browser without ::details-content gets the group opened instead.
    const src = readFileSync("src/components/admin/ui/filter-bar.tsx", "utf8");
    expect(
      readFileSync("src/components/admin/ui/open-from-md.ts", "utf8"),
    ).toContain('window.matchMedia("(min-width: 48rem)")');
    expect(src).toContain("ref={openFromMd}");
  });

  it("without ::details-content the group is opened from md up, also after a resize", () => {
    // The summary is hidden from md up: a group left closed there (a
    // tablet turned from portrait to landscape) could not be opened.
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
