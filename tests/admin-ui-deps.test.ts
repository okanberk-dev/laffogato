import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * The admin panel's UI libraries (admin UI v2, UI-1). Three packages may
 * enter the repo, for the panel only: lucide-react (icons),
 * react-aria-components (the lazy palette, date and combobox widgets) and
 * @internationalized/date (their dates). The rules that keep them small and
 * out of the customer site and the server code:
 * - each is an exact pin, with one copy in the lockfile;
 * - only src/components/admin and src/app/admin import them (ESLint says
 *   the same in eslint.config.mjs, this also sees import() and require());
 * - lucide only through ui/icons.tsx, where every icon is named once;
 * - React Aria and the date package only in "use client" files, React Aria
 *   by sub-path (`react-aria-components/ListBox`), never the root barrel;
 * - the server-safe kit files reach neither before a "use client" boundary;
 * - no shadcn components.json: `shadcn add` would write its --accent and
 *   --ring over the brand tokens in globals.css.
 * The React Aria and date rules hold vacuously until a PR installs them;
 * the checker's own test below shows they bite.
 */

const ROOT = process.cwd();
const SELF = "tests/admin-ui-deps.test.ts";
const ADMIN_TREES = ["src/components/admin/", "src/app/admin/"];
const ICONS_FILE = "src/components/admin/ui/icons.tsx";

const LUCIDE = "lucide-react";
const RAC = "react-aria-components";
const DATE = "@internationalized/date";
const UI_LIBRARIES = [LUCIDE, RAC, DATE];
/** React Aria's own halves: one copy each too, or the widgets ship twice. */
const COMPANIONS = ["react-aria", "react-stately"];

/** The kit files a server page renders directly (no hooks, no "use client"). */
const SERVER_SAFE_KIT = [
  "src/components/admin/ui/data-table.tsx",
  "src/components/admin/ui/status-tabs.tsx",
  "src/components/admin/ui/pagination.tsx",
  "src/components/admin/ui/badge.tsx",
  "src/components/admin/ui/detail.tsx",
  "src/components/admin/ui/styles.ts",
  "src/components/admin/forms.tsx",
];

const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const p = `${dir}/${name}`;
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs|mts)$/.test(name)) out.push(p);
  }
  return out;
}

/** Every module specifier a file names: static, type-only, import(), require(). */
function importsOf(src: string): string[] {
  const out: string[] = [];
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?[\w$*{}\s,]+?\s+from\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) for (const m of src.matchAll(re)) out.push(m[1]);
  return out;
}

/** Value imports only: `import type` is erased and loads nothing. */
function valueImportsOf(src: string): string[] {
  const out: string[] = [];
  const re =
    /\b(?:import|export)\s+(?!type\b)(?:[\w$*{}\s,]+?\s+from\s*)?["']([^"']+)["']/g;
  for (const m of src.matchAll(re)) out.push(m[1]);
  return out;
}

const isPackage = (spec: string, pkg: string) =>
  spec === pkg || spec.startsWith(`${pkg}/`);

const usesAny = (src: string, pkgs: string[]) =>
  importsOf(src).filter((s) => pkgs.some((p) => isPackage(s, p)));

function isUseClient(src: string): boolean {
  const head = src.replace(/^(\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, "");
  return /^["']use client["']/.test(head);
}

const inAdminTree = (path: string) =>
  ADMIN_TREES.some((tree) => path.startsWith(tree));

function resolveLocal(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? `src/${spec.slice(2)}`
    : relative(ROOT, join(ROOT, dirname(from), spec));
  for (const cand of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ]) {
    if (existsSync(join(ROOT, cand)) && statSync(join(ROOT, cand)).isFile())
      return cand;
  }
  return null;
}

/**
 * The libraries a server-rendered file reaches through its value imports,
 * stopping at "use client" files (the server holds a reference to those,
 * not their code). Outside the admin trees the scope rule already forbids
 * the libraries, so the walk stays inside them.
 */
function serverReach(entry: string, pkgs: string[]): string[] {
  const hits: string[] = [];
  const seen = new Set<string>();
  const stack = [{ file: entry, trail: [entry] }];
  while (stack.length > 0) {
    const { file, trail } = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = read(file);
    if (file !== entry && isUseClient(src)) continue;
    for (const spec of valueImportsOf(src)) {
      if (spec.startsWith(".") || spec.startsWith("@/")) {
        const next = resolveLocal(file, spec);
        if (next && inAdminTree(next))
          stack.push({ file: next, trail: [...trail, next] });
      } else if (pkgs.some((p) => isPackage(spec, p))) {
        hits.push([...trail, spec].join(" -> "));
      }
    }
  }
  return hits;
}

const pkg = JSON.parse(read("package.json")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};
const lock = JSON.parse(read("package-lock.json")) as {
  packages: Record<string, { version?: string }>;
};
const declared = (name: string) =>
  pkg.dependencies[name] ?? pkg.devDependencies[name];
const lockVersions = (name: string) => [
  ...new Set(
    Object.entries(lock.packages)
      .filter(([path]) => path.endsWith(`node_modules/${name}`))
      .map(([, entry]) => entry.version),
  ),
];

const sources = ["src", "tests", "scripts"]
  .flatMap((dir) => walk(dir))
  .filter((f) => f !== SELF);

describe("admin UI libraries: pins and the lockfile", () => {
  it("lucide-react is a runtime dependency, and every library present is an exact pin", () => {
    expect(pkg.dependencies[LUCIDE]).toBeDefined();
    for (const name of UI_LIBRARIES) {
      const range = declared(name);
      if (range === undefined) continue;
      expect(range, name).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("the lockfile holds one copy of each, at the pinned version", () => {
    for (const name of UI_LIBRARIES) {
      const range = declared(name);
      if (range === undefined) continue;
      expect(lockVersions(name), name).toEqual([range]);
    }
    for (const name of COMPANIONS) {
      expect(lockVersions(name).length, name).toBeLessThanOrEqual(1);
    }
  });

  it("the stale shadcn components.json is gone", () => {
    expect(existsSync(join(ROOT, "components.json"))).toBe(false);
  });
});

describe("admin UI libraries: who may import them", () => {
  it("the checker reads every import form and the use client directive", () => {
    const src = [
      '// a comment\n"use client";',
      'import { X } from "lucide-react";',
      'import type { DateValue } from "@internationalized/date";',
      'export { ListBox } from "react-aria-components/ListBox";',
      'const Lazy = import("react-aria-components");',
      'const old = require("lucide-react/dynamic");',
    ].join("\n");
    expect(usesAny(src, UI_LIBRARIES).sort()).toEqual([
      "@internationalized/date",
      "lucide-react",
      "lucide-react/dynamic",
      "react-aria-components",
      "react-aria-components/ListBox",
    ]);
    expect(valueImportsOf(src)).not.toContain("@internationalized/date");
    expect(isUseClient(src)).toBe(true);
    expect(isUseClient('import x from "y";\n"use client";')).toBe(false);
  });

  it("nothing outside src/components/admin and src/app/admin imports them", () => {
    const outside = sources
      .filter((f) => !inAdminTree(f))
      .flatMap((f) => usesAny(read(f), UI_LIBRARIES).map((s) => `${f}: ${s}`));
    expect(outside).toEqual([]);
  });

  it("lucide-react is imported by ui/icons.tsx alone, from the package root", () => {
    const users = sources.filter((f) => usesAny(read(f), [LUCIDE]).length > 0);
    expect(users).toEqual([ICONS_FILE]);
    expect(usesAny(read(ICONS_FILE), [LUCIDE])).toEqual([LUCIDE]);
  });

  it('React Aria and the date package only in "use client" files, React Aria by sub-path', () => {
    const bad: string[] = [];
    for (const f of sources) {
      const src = read(f);
      const specs = usesAny(src, [RAC, DATE]);
      if (specs.length === 0) continue;
      if (!isUseClient(src)) bad.push(`${f}: not a "use client" file`);
      if (specs.includes(RAC)) bad.push(`${f}: imports the ${RAC} barrel`);
    }
    expect(bad).toEqual([]);
  });

  it("the server-safe kit files reach neither React Aria nor the date package", () => {
    for (const f of SERVER_SAFE_KIT) {
      expect(isUseClient(read(f)), f).toBe(false);
      expect(serverReach(f, [RAC, DATE]), f).toEqual([]);
    }
    // The walk follows the kit's own imports: data-table reaches React's
    // runtime only through detail.tsx (its own React import is type-only).
    expect(
      serverReach("src/components/admin/ui/data-table.tsx", ["react"]),
    ).toContain(
      "src/components/admin/ui/data-table.tsx -> src/components/admin/ui/detail.tsx -> react",
    );
  });

  it("ESLint refuses them outside the panel and lets the panel use them", async () => {
    const mod = await import("eslint");
    const ESLint = mod.ESLint ?? mod.default.ESLint;
    const eslint = new ESLint({ cwd: ROOT });
    const code = [
      'import { X } from "lucide-react";',
      'import { ListBox } from "react-aria-components/ListBox";',
      'import { parseDate } from "@internationalized/date";',
      "export const all = [X, ListBox, parseDate];",
      "",
    ].join("\n");
    const ruleHits = async (path: string) => {
      const [result] = await eslint.lintText(code, {
        filePath: join(ROOT, path),
      });
      return result.messages.filter((m) => m.ruleId === "no-restricted-imports")
        .length;
    };
    for (const path of [
      "src/lib/admin/probe.ts",
      "src/components/laffogato/probe.tsx",
      "src/app/api/mobile/v1/probe/route.ts",
      "tests/probe.test.ts",
    ]) {
      expect(await ruleHits(path), path).toBe(3);
    }
    for (const path of [
      "src/components/admin/ui/probe.tsx",
      "src/app/admin/probe/page.tsx",
    ]) {
      expect(await ruleHits(path), path).toBe(0);
    }
  }, 60_000);
});

describe("ui/icons.tsx", () => {
  it("every key draws a lucide icon of the pinned version, each a different one", async () => {
    const { ADMIN_ICONS } = await import("@/components/admin/ui/icons");
    const icons = Object.values(ADMIN_ICONS);
    for (const [key, icon] of Object.entries(ADMIN_ICONS)) {
      expect(icon, key).toBeDefined();
      expect(typeof (icon as { render?: unknown }).render, key).toBe(
        "function",
      );
    }
    expect(new Set(icons).size).toBe(icons.length);
    // The sections that shared a drawn icon before each keep their own.
    for (const key of [
      "till",
      "tables",
      "mobileApp",
      "adminUsers",
      "karaoke",
    ]) {
      expect(ADMIN_ICONS, key).toHaveProperty(key);
    }
  });

  it("draws 18 px with a 1.75 line, hidden from screen readers by default", async () => {
    const { AdminIcon } = await import("@/components/admin/ui/icons");
    const html = renderToStaticMarkup(
      createElement(AdminIcon, { name: "orders" }),
    );
    expect(html).toMatch(/^<svg /);
    expect(html).toContain('width="18"');
    expect(html).toContain('height="18"');
    expect(html).toContain('stroke-width="1.75"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("role=");
    expect(html).toMatch(/class="[^"]*\blucide-shopping-bag\b/);
    expect(html).toMatch(/class="[^"]*\bshrink-0\b/);
  });

  it("a labelled icon is announced as an image, and size and class can change", async () => {
    const { AdminIcon } = await import("@/components/admin/ui/icons");
    const html = renderToStaticMarkup(
      createElement(AdminIcon, {
        name: "search",
        "aria-label": "Ara",
        size: 20,
        className: "text-[var(--admin-text-soft)]",
      }),
    );
    expect(html).toContain('aria-label="Ara"');
    expect(html).toContain('role="img"');
    expect(html).not.toContain("aria-hidden");
    expect(html).toContain('width="20"');
    expect(html).toContain("text-[var(--admin-text-soft)]");
  });

  it("the kit index exports the icon map", async () => {
    const ui = await import("@/components/admin/ui");
    const icons = await import("@/components/admin/ui/icons");
    expect(ui.AdminIcon).toBe(icons.AdminIcon);
    expect(ui.ADMIN_ICONS).toBe(icons.ADMIN_ICONS);
  });
});
