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

  it("react-aria-components is a runtime dependency at 1.21.1, its own halves at the versions it pins", () => {
    // The palette (UI-6) brings it. 1.21.1 is from 4 Sep 2026; it pins
    // react-aria 3.52.1 and react-stately 3.50.0 exactly, so a second copy
    // of either would mean a second widget runtime in the chunk.
    expect(pkg.dependencies[RAC]).toBe("1.21.1");
    expect(lockVersions("react-aria")).toEqual(["3.52.1"]);
    expect(lockVersions("react-stately")).toEqual(["3.50.0"]);
  });

  it("@internationalized/date is a direct dependency at 3.12.4 (UI-14), one copy in the lockfile", () => {
    // Design §1.3: exact pin, published 1 Sep 2026, the version React Aria
    // 1.21.1 asks for (^3.12.4). It was in the lockfile before as React
    // Aria's dependency; the date widgets import it themselves now.
    expect(pkg.dependencies[DATE]).toBe("3.12.4");
    expect(lockVersions(DATE)).toEqual(["3.12.4"]);
    expect(
      (lock.packages[""] as { dependencies?: Record<string, string> })
        .dependencies?.[DATE],
    ).toBe("3.12.4");
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

  it("CLAUDE.md names the libraries that are installed, no more, no fewer", () => {
    // The paragraph lists the three allowed packages; its "Kurulu olanlar"
    // line says which of them package.json carries today, so a reader does
    // not go looking for React Aria before the PR that brings it.
    const doc = read("CLAUDE.md");
    const line = doc.match(/Kurulu olanlar:([\s\S]*?)\.\s/);
    expect(line, "Kurulu olanlar line").not.toBeNull();
    const named = [...line![1].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const installed = UI_LIBRARIES.filter((n) => declared(n) !== undefined);
    expect(named.sort()).toEqual(installed.sort());
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

  it("the date package is imported by the two date widgets alone, and the pop-over mount point by overlay.ts alone", () => {
    // date-range-field and date-time-picker are lazy chunks (the FilterBar
    // and DateTimeField reach them by import(), after a fine pointer has
    // reached the field); no other file needs the date objects.
    const users = sources.filter((f) => usesAny(read(f), [DATE]).length > 0);
    expect(users.sort()).toEqual([
      "src/components/admin/ui/date-range-field.tsx",
      "src/components/admin/ui/date-time-picker.tsx",
    ]);
    // The one prop and the one provider that move a Popover's mount point
    // live in ui/overlay.ts, where a React Aria upgrade changes them (and
    // its switch turns the date widgets off).
    const portalUsers = sources
      .filter((f) => f.startsWith("src/"))
      .filter((f) =>
        /UNSTABLE_portalContainer|UNSAFE_PortalProvider/.test(read(f)),
      );
    expect(portalUsers).toEqual(["src/components/admin/ui/overlay.ts"]);
  });

  it("the date widgets' chunks are reached by import() alone, never by a static import", () => {
    const widgets = [
      "src/components/admin/ui/date-range-field",
      "src/components/admin/ui/date-time-picker",
    ];
    for (const f of sources.filter((f) => inAdminTree(f))) {
      const statics = valueImportsOf(read(f));
      for (const widget of widgets) {
        const name = widget.split("/").pop()!;
        const hit = statics.filter((spec) => spec.endsWith(`/${name}`));
        // Only tests may import them by value; the kit never does.
        expect(hit, `${f} imports ${name} statically`).toEqual([]);
      }
    }
  });

  it("every page's shell reaches React Aria only through the palette's lazy import()", () => {
    // The trigger is in every admin page's bundle (the Kasa's included,
    // whose budget is 0 KB of library code); the list is loaded with
    // import() on the first sign of use. A static value import anywhere on
    // the shell's path would put React Aria on every page.
    const staticReach = (entry: string): string[] => {
      const hits: string[] = [];
      const seen = new Set<string>();
      const stack = [entry];
      while (stack.length > 0) {
        const file = stack.pop()!;
        if (seen.has(file)) continue;
        seen.add(file);
        for (const spec of valueImportsOf(read(file))) {
          if (spec.startsWith(".") || spec.startsWith("@/")) {
            const next = resolveLocal(file, spec);
            if (next) stack.push(next);
          } else if (isPackage(spec, RAC)) hits.push(`${file} -> ${spec}`);
        }
      }
      return hits;
    };
    for (const entry of [
      "src/app/admin/layout.tsx",
      "src/components/admin/admin-sidebar.tsx",
      "src/components/admin/palette/trigger.tsx",
    ]) {
      expect(staticReach(entry), entry).toEqual([]);
    }
    // The checker sees it: the list itself imports React Aria statically.
    expect(staticReach("src/components/admin/palette/palette.tsx")).not.toEqual(
      [],
    );
  });

  it("the server-safe kit files reach neither React Aria nor the date package", () => {
    for (const f of SERVER_SAFE_KIT) {
      expect(isUseClient(read(f)), f).toBe(false);
      expect(serverReach(f, [RAC, DATE]), f).toEqual([]);
    }
    // The walk follows the kit's own imports: data-table reaches React's
    // runtime through a kit file it imports (detail.tsx, forms.tsx).
    const viaKit = serverReach("src/components/admin/ui/data-table.tsx", [
      "react",
    ]);
    expect(viaKit.some((trail) => trail.split(" -> ").length >= 3)).toBe(true);
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
  it("every key draws the named lucide icon of the pinned version, each a different one", async () => {
    const { ADMIN_ICONS } = await import("@/components/admin/ui/icons");
    // lucide names each icon after its canonical name (displayName), so an
    // alias that 1.51.0 dropped or renamed shows up here, not on a screen.
    const names = Object.fromEntries(
      Object.entries(ADMIN_ICONS).map(([key, icon]) => [
        key,
        (icon as { displayName?: string }).displayName,
      ]),
    );
    expect(names).toEqual({
      dashboard: "LayoutGrid",
      orders: "ShoppingBag",
      karaoke: "MicVocal",
      till: "Stamp",
      appLive: "Radio",
      menu: "Coffee",
      products: "Package",
      stock: "Boxes",
      customers: "Users",
      promos: "TicketPercent",
      newsletter: "Mail",
      slides: "GalleryHorizontalEnd",
      content: "FileText",
      mobileApp: "Smartphone",
      appFal: "Flag",
      reports: "ChartColumn",
      tables: "QrCode",
      settings: "Settings",
      adminUsers: "UserCog",
      legal: "Scale",
      audit: "ScrollText",
      search: "Search",
      create: "Plus",
      drawer: "Menu",
      more: "Ellipsis",
      external: "ExternalLink",
      dateRange: "CalendarRange",
      close: "X",
      chevron: "ChevronDown",
      security: "ShieldCheck",
      shortcuts: "Keyboard",
      density: "Rows3",
      logout: "LogOut",
    });
    const icons = Object.values(ADMIN_ICONS);
    for (const [key, icon] of Object.entries(ADMIN_ICONS)) {
      expect(typeof (icon as { render?: unknown }).render, key).toBe(
        "function",
      );
    }
    expect(new Set(icons).size).toBe(icons.length);
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

  it("the kit barrel re-exports the icon types only, never the values", () => {
    // Re-exported as values from ui/index.ts, the icons put lucide's client
    // Icon on every page that imports the kit, drawn or not (+4.4 KB gz on
    // /admin/siparisler, and lucide on /admin/kasa, whose budget is 0 KB).
    // Pages and components import ./icons directly.
    const code = read("src/components/admin/ui/index.ts")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n");
    const fromIcons = (specs: string[]) =>
      specs.filter((s) => /(^|\/)icons$/.test(s));
    expect(fromIcons(valueImportsOf(code))).toEqual([]);
    expect(code).toMatch(
      /export type \{ AdminIconName, AdminIconProps \} from "\.\/icons";/,
    );
    // An inline `export { type X }` would not do: under
    // verbatimModuleSyntax it keeps the module edge.
    expect(code).not.toMatch(/export \{[^}]*\} from "\.\/icons"/);
  });
});
