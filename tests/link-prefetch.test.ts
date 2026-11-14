import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * No link asks the server for a page before someone means to open it
 * (14 Kas 2026). Vercel paused the account for going over the Hobby plan's
 * usage; next/link's default prefetch turned one visit to the home page into
 * 11-12 extra renders of dynamic pages (and as many proxy runs). Every link
 * goes through src/components/link.tsx, which prefetches only on hover or
 * touch.
 */

const seen: Array<{ prefetch: unknown }> = [];

vi.mock("next/link", () => ({
  default: (props: { prefetch?: unknown; children?: ReactNode }) => {
    seen.push({ prefetch: props.prefetch });
    return createElement("a", null, props.children);
  },
}));

const ROOT = join(__dirname, "..");
const WRAPPER = "src/components/link.tsx";

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(tsx?|mjs|jsx?)$/.test(name)) out.push(path);
  }
  return out;
}

describe("links do not prefetch on sight", () => {
  it("every file takes Link from the wrapper, not from next/link", () => {
    const offenders = sourceFiles(join(ROOT, "src"))
      .map((path) => relative(ROOT, path))
      .filter((path) => path !== WRAPPER)
      .filter((path) => {
        const src = readFileSync(join(ROOT, path), "utf8");
        // `import { useLinkStatus } from "next/link"` is fine: it reads the
        // context the wrapper's NextLink provides. A default import (or a
        // re-export, or a dynamic import) is the component itself.
        return (
          /import\s+\w+\s*(,\s*\{[^}]*\})?\s*from\s*["']next\/link["']/.test(
            src,
          ) ||
          /export\s+\{[^}]*default[^}]*\}\s*from\s*["']next\/link["']/.test(
            src,
          ) ||
          /import\(\s*["']next\/link["']\s*\)/.test(src)
        );
      });
    expect(offenders).toEqual([]);
  });

  it("the wrapper brings nothing but react and next/link", () => {
    // Every page loads it; tests/admin-saved-views-bar.test.ts and
    // tests/admin-wizards.test.ts count on it staying this small.
    const src = readFileSync(join(ROOT, WRAPPER), "utf8");
    expect(src.startsWith('"use client";')).toBe(true);
    const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect([...new Set(imports)].sort()).toEqual(["next/link", "react"]);
  });

  it("a link without its own choice does not prefetch", async () => {
    const { default: Link } = await import("@/components/link");
    seen.length = 0;
    renderToStaticMarkup(createElement(Link, { href: "/menu" }, "Menü"));
    expect(seen).toEqual([{ prefetch: false }]);
  });

  it("a link that chooses keeps its choice", async () => {
    const { default: Link } = await import("@/components/link");
    seen.length = 0;
    renderToStaticMarkup(
      createElement(Link, { href: "/menu", prefetch: true }, "Menü"),
    );
    renderToStaticMarkup(
      createElement(Link, { href: "/menu", prefetch: null }, "Menü"),
    );
    expect(seen).toEqual([{ prefetch: true }, { prefetch: null }]);
  });
});
