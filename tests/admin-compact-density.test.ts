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
      "min-height: calc(var(--spacing) * 9)",
      "min-width: calc(var(--spacing) * 9)",
      "height: calc(var(--spacing) * 9)",
      "width: calc(var(--spacing) * 9)",
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

  it("DataTable cells: py-3 stays, py-2 under compact (the row-action cell was py-2 already)", () => {
    const out = table({ rowActions: () => "⋯" });
    const th = classOf(out, /<th scope="col"[^>]*>/);
    const td = classOf(out, /<td class="[^"]*px-4 py-3[^"]*">/);
    expect(defaults(th)).toBe("px-4 py-3 whitespace-nowrap text-left");
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
        /<t[hd] [^>]*class="([^"]*px-4 py-3[^"]*)"/g,
      ),
    ].map((m) => m[1].replaceAll("&amp;", "&"));
    expect(cells).toHaveLength(4);
    for (const cell of cells) expect(compact(cell)).toEqual([COMPACT.py2]);
  });

  it("Section and Card: p-4 sm:p-6 stays, p-4 under compact; a section's header follows its body", () => {
    const section = html(withKids(ui.Section, { title: "Kalemler" }, "x"));
    const header = classOf(section, /<header class="[^"]*"/);
    expect(defaults(header)).toBe(
      "flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-0 sm:px-6 sm:pt-5",
    );
    expect(compact(header)).toEqual([COMPACT.px4, COMPACT.py2]);
    const body = classOf(section, /<div class="p-4 sm:p-6[^"]*"/);
    expect(defaults(body)).toBe("p-4 sm:p-6");
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
      "rounded-3xl bg-[var(--admin-panel)] p-4 sm:p-6 print:border print:border-[var(--admin-border-strong)] print:bg-white",
    );
    expect(compact(card)).toEqual([COMPACT.p4]);
  });

  it("controls stay 44 px and drop to 36 px under compact: buttons, icon buttons, menu rows, the ⋯, fields, boxes, pages, tabs", () => {
    for (const key of Object.keys(BUTTON) as Array<keyof typeof BUTTON>) {
      expect(BUTTON[key], key).toContain("min-h-[44px]");
      expect(compact(BUTTON[key]), key).toContain(COMPACT.minH9);
    }
    expect(BUTTON.icon).toContain("h-11 w-11");
    expect(compact(BUTTON.icon)).toEqual([
      COMPACT.minH9,
      COMPACT.h9,
      COMPACT.w9,
    ]);
    const control = (el: unknown, tag: RegExp) => classOf(html(el), tag);
    const buttons = [
      forms.PrimaryButton,
      forms.GhostButton,
      forms.DangerButton,
    ];
    for (const Button of buttons) {
      const cls = control(createElement(Button, null, "x"), /<button[^>]*>/);
      expect(cls).toContain("min-h-[44px]");
      expect(compact(cls)).toEqual([COMPACT.minH9]);
    }
    const box = control(
      createElement(forms.Checkbox, { label: "Aç", name: "a" }),
      /<label[^>]*>/,
    );
    expect(box).toContain("min-h-[44px]");
    expect(compact(box)).toEqual([COMPACT.minH9]);
    const field = control(
      createElement(forms.TextInput, { name: "a" }),
      /<input[^>]*>/,
    );
    expect(field).toContain("py-2.5");
    expect(compact(field)).toEqual([COMPACT.fieldPy]);
    const menu = control(
      createElement(ui.ActionMenu, null, "x"),
      /<summary[^>]*>/,
    );
    expect(menu).toContain("min-h-[44px] min-w-[44px]");
    expect(compact(menu)).toEqual([COMPACT.minH9, COMPACT.minW9]);
    const page = control(
      createElement(ui.Pagination, {
        page: 2,
        pageSize: 10,
        total: 50,
        pathname: "/l",
      }),
      /<a [^>]*h-11 min-w-11[^>]*>/,
    );
    expect(compact(page)).toEqual([COMPACT.h9, COMPACT.minW9]);
    const status = control(
      createElement(ui.StatusTabs, {
        tabs: [{ value: null, label: "Tümü" }],
        current: null,
        pathname: "/l",
      }),
      /<a [^>]*>/,
    );
    expect(status).toContain("min-h-[40px]");
    expect(compact(status)).toEqual([COMPACT.minH9]);
    const strip = control(
      createElement(SectionTabs, {
        label: "x",
        tabs: [{ href: "/a", label: "A" }],
        activeHref: "/a",
      }),
      /<a [^>]*>/,
    );
    expect(strip).toContain("min-h-11");
    expect(compact(strip)).toEqual([COMPACT.minH9]);
  });
});
