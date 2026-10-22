import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { Scanner } from "@tailwindcss/oxide";
import { createElement, type FunctionComponent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";
import { describe, expect, it, vi } from "vitest";

/**
 * "Sıkı görünüm" in the kit (admin UI v2, UI-9, design 3.6): table cells
 * py-3 to py-2, cards and sections p-6 to p-4, controls 36 px. The kit's
 * defaults stay as they were (the 44 px tests hold); the compact classes
 * sit beside them, each behind `pointer-fine:` so a touch screen matches
 * none. Checked as the markup the server draws and as the CSS Tailwind
 * compiles from it (no jsdom).
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

const ui = await import("@/components/admin/ui");
const forms = await import("@/components/admin/forms");
const { COMPACT, BUTTON } = await import("@/components/admin/ui/styles");
const { SectionTabs } = await import("@/components/admin/ui/section-tabs");

const read = (p: string) => readFileSync(p, "utf8");
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) ? [rel] : [];
  });
const PREFIX = "pointer-fine:[[data-admin-density=compact]_&]:";
const tokens = (classes: string) => classes.split(/\s+/).filter(Boolean);
const isCompact = (t: string) => t.includes("data-admin-density=compact");
/** The first class attribute of the first tag matching `tag`, as written. */
const classOf = (html: string, tag: RegExp) =>
  (/class="([^"]*)"/.exec(tag.exec(html)?.[0] ?? "")?.[1] ?? "").replaceAll(
    "&amp;",
    "&",
  );
/** The classes as they were before UI-9: every compact class taken out. */
const defaults = (classes: string) =>
  tokens(classes)
    .filter((t) => !isCompact(t))
    .join(" ");
const compact = (classes: string) => tokens(classes).filter(isCompact);
const html = (el: unknown) => renderToStaticMarkup(el as never);
const withKids = (
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: ReactNode[]
) => createElement(type as FunctionComponent, props, ...children);

describe("the compact classes", () => {
  it("every one begins with pointer-fine: (a touch screen matches none), in the kit and anywhere else", () => {
    const files = [
      ...sourceFiles("src/components/admin"),
      ...sourceFiles("src/app/admin"),
      ...sourceFiles("src/lib/admin"),
    ];
    const found = files.flatMap((f) =>
      (
        read(f).match(/[^\s"'`]*data-admin-density=compact[^\s"'`]*/g) ?? []
      ).map((t) => [f, t] as const),
    );
    // The scan sees the kit's classes (it is not vacuous)...
    expect(found.map(([, t]) => t)).toEqual(
      expect.arrayContaining(Object.values(COMPACT)),
    );
    // ...and none stands without the pointer test in front.
    expect(found.filter(([, t]) => !t.startsWith(PREFIX))).toEqual([]);
    for (const value of Object.values(COMPACT)) {
      expect(value.startsWith(PREFIX), value).toBe(true);
    }
  });

  it("compile to rules inside @media (pointer: fine), under the compact ancestor, and nowhere else", async () => {
    const compiler = await compile(
      "@theme { --breakpoint-lg: 64rem; --spacing: 0.25rem; } @tailwind utilities;",
      {},
    );
    const css = compiler.build(Object.values(COMPACT)).replace(/\s+/g, " ");
    // Everything compact is inside one pointer: fine query.
    const outside = css.replace(/@media \(pointer: fine\) \{.*\}\s*$/, "");
    expect(outside).not.toContain("data-admin-density");
    const rules =
      css.match(/\[data-admin-density=compact\] \.[^{]+\{[^}]+\}/g) ?? [];
    expect(rules).toHaveLength(Object.keys(COMPACT).length);
    for (const declaration of [
      "padding-block: calc(var(--spacing) * 2)",
      "padding-inline: calc(var(--spacing) * 4)",
      "padding: calc(var(--spacing) * 4)",
      "padding-block: calc(var(--spacing) * 1.5)",
      "min-height: calc(var(--spacing) * 8)",
      "min-width: calc(var(--spacing) * 8)",
      "height: calc(var(--spacing) * 8)",
      "width: calc(var(--spacing) * 8)",
    ]) {
      expect(css, declaration).toContain(declaration);
    }
  });

  it("are found in the source by the build's own scanner, written out whole", () => {
    const scanner = new Scanner({
      sources: [
        { base: join(process.cwd(), "src"), pattern: "**/*", negated: false },
      ],
    });
    const candidates = new Set(scanner.scan());
    for (const value of Object.values(COMPACT)) {
      expect(candidates.has(value), value).toBe(true);
    }
  });
});

describe("the kit keeps its comfortable defaults and gains the compact ones beside them", () => {
  const row = { id: "r1", name: "Latte" };
  const table = (props: Record<string, unknown> = {}) =>
    html(
      createElement(ui.DataTable as never, {
        columns: [{ key: "name", header: "Ad", cell: () => row.name }],
        rows: [row],
        rowKey: () => row.id,
        pathname: "/l",
        ...props,
      }),
    );

  it("DataTable cells: py-3 stays (Innex's head py-2.5), py-2 under compact (the row-action cell was py-2 already)", () => {
    const out = table({ rowActions: () => "⋯" });
    const th = classOf(out, /<th scope="col"[^>]*>/);
    const td = classOf(out, /<td class="[^"]*px-4 py-3[^"]*">/);
    expect(defaults(th)).toBe("px-4 py-2.5 whitespace-nowrap text-left");
    expect(defaults(td)).toBe("px-4 py-3 text-[var(--admin-text)] text-left");
    expect(compact(th)).toEqual([COMPACT.py2]);
    expect(compact(td)).toEqual([COMPACT.py2]);
    // The select-all and row-checkbox cells too.
    const selection = {
      selected: new Set<string>(),
      has: () => false,
      toggle: () => {},
      set: () => {},
      clear: () => {},
      count: 0,
      ids: [],
    };
    const cells = [
      ...table({ selection }).matchAll(
        /<t[hd] [^>]*class="([^"]*px-4 py-(?:3|2\.5)[^"]*)"/g,
      ),
    ].map((m) => m[1].replaceAll("&amp;", "&"));
    expect(cells).toHaveLength(4);
    for (const cell of cells) expect(compact(cell)).toEqual([COMPACT.py2]);
  });

  it("Section and Card: Innex's p-4 sm:p-5 stays, p-4 under compact; a section's header follows its body", () => {
    const section = html(withKids(ui.Section, { title: "Kalemler" }, "x"));
    const header = classOf(section, /<header class="[^"]*"/);
    expect(defaults(header)).toBe(
      "flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-0 sm:px-5",
    );
    expect(compact(header)).toEqual([COMPACT.px4, COMPACT.py2]);
    const body = classOf(section, /<div class="p-4 sm:p-5[^"]*"/);
    expect(defaults(body)).toBe("p-4 sm:p-5");
    expect(compact(body)).toEqual([COMPACT.p4]);
    // `flush` still draws no padding at all.
    expect(
      html(withKids(ui.Section, { title: "T", flush: true }, "x")),
    ).toContain("<div>x</div>");
    const card = classOf(
      html(createElement(forms.Card, null, "x")),
      /<div class="[^"]*"/,
    );
    expect(defaults(card)).toBe(
      "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-5 print:border-[var(--admin-border-strong)]",
    );
    expect(compact(card)).toEqual([COMPACT.p4]);
  });

  it("controls stay 44 px on touch, 36 px where the pointer aims, and drop to 32 px under compact: buttons, icon buttons, menu rows, the framed ⋯, fields, boxes, pages, tabs", () => {
    for (const key of Object.keys(BUTTON) as Array<keyof typeof BUTTON>) {
      expect(BUTTON[key], key).toContain("min-h-11");
      expect(BUTTON[key], key).toContain("pointer-fine:min-h-9");
      expect(compact(BUTTON[key]), key).toContain(COMPACT.minH8);
    }
    expect(BUTTON.icon).toContain("h-11 w-11");
    expect(compact(BUTTON.icon)).toEqual([
      COMPACT.minH8,
      COMPACT.h8,
      COMPACT.w8,
    ]);
    const control = (el: unknown, tag: RegExp) => classOf(html(el), tag);
    const buttons = [
      forms.PrimaryButton,
      forms.GhostButton,
      forms.DangerButton,
    ];
    for (const Button of buttons) {
      const cls = control(createElement(Button, null, "x"), /<button[^>]*>/);
      expect(cls).toContain("min-h-11");
      expect(compact(cls)).toEqual([COMPACT.minH8]);
    }
    const box = control(
      createElement(forms.Checkbox, { label: "Aç", name: "a" }),
      /<label[^>]*>/,
    );
    expect(box).toContain("min-h-11");
    expect(compact(box)).toEqual([COMPACT.minH8]);
    const field = control(
      createElement(forms.TextInput, { name: "a" }),
      /<input[^>]*>/,
    );
    expect(field).toContain("py-2.5");
    expect(compact(field)).toEqual([COMPACT.fieldPy]);
    // Framed (a page's, beside its buttons) or labelled, the ⋯ is a
    // button and follows the buttons.
    const looks: Array<{ framed?: boolean; showLabel?: boolean }> = [
      { framed: true },
      { showLabel: true },
    ];
    for (const props of looks) {
      const framed = control(
        createElement(ui.ActionMenu as never, props, "x"),
        /<summary[^>]*>/,
      );
      expect(framed).toContain("min-h-11 min-w-11");
      expect(framed).toContain("border-[var(--admin-border-strong)]");
      expect(compact(framed)).toEqual([COMPACT.minH8, COMPACT.minW8]);
    }
    // On its own (a row's) it is a row control (ROW_CONTROL.more, 21 Oct
    // 2026): 44 px on a touch screen, 32 px where the pointer can aim,
    // compact's own size, so none of its classes.
    const menu = control(
      createElement(ui.ActionMenu, null, "x"),
      /<summary[^>]*>/,
    );
    expect(menu).toContain("min-h-[44px] min-w-[44px]");
    expect(menu).toContain("pointer-fine:min-h-8 pointer-fine:min-w-8");
    expect(menu).not.toContain("border");
    expect(compact(menu)).toEqual([]);
    const page = control(
      createElement(ui.Pagination, {
        page: 2,
        pageSize: 10,
        total: 50,
        pathname: "/l",
      }),
      /<a [^>]*h-11 min-w-11[^>]*>/,
    );
    expect(compact(page)).toEqual([COMPACT.h8, COMPACT.minW8]);
    const status = control(
      createElement(ui.StatusTabs, {
        tabs: [{ value: null, label: "Tümü" }],
        current: null,
        pathname: "/l",
      }),
      /<a [^>]*>/,
    );
    expect(status).toContain("min-h-9");
    expect(compact(status)).toEqual([COMPACT.minH8]);
    const strip = control(
      createElement(SectionTabs, {
        label: "x",
        tabs: [{ href: "/a", label: "A" }],
        activeHref: "/a",
      }),
      /<a [^>]*>/,
    );
    // Innex's underlined tabs fill the top bar's height: 44 px, no compact
    // class (the bar keeps its height either way).
    expect(strip).toContain("min-h-11");
    expect(compact(strip)).toEqual([]);
  });
});
