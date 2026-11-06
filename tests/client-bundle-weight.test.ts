import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * WP1: what a "use client" module imports is what the visitor downloads.
 *
 * /karaoke shipped all of Zod (~390 KB raw, ~85 KB gzip - 892 KB first-load
 * JS against ~590 KB for every other storefront page) because the booking
 * form imported two arithmetic helpers from `karaoke-core.ts`, which builds
 * Zod schemas at load time; a module with top-level side effects cannot be
 * tree-shaken away. Validation belongs on the server, where the action and
 * the mobile endpoint already parse with Zod.
 *
 * This walks the static (non-type) import graph from every client entry and
 * fails if a package on the deny list is reachable. `"use server"` modules
 * are a boundary: the client gets a reference to them, not their code.
 */

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/**
 * Packages the storefront must never pull into a first-load bundle. three.js
 * is allowed in the browser only through `import()` (the home page's valley,
 * home-valley.tsx -> valley-scene.ts, fetched after load and idle); a static
 * import would put ~135 KB gzip in front of the home page's first paint.
 */
const DENIED = [
  "zod",
  "pg",
  "bcryptjs",
  "server-only",
  "@supabase/supabase-js",
  "three",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

function directive(src: string): "client" | "server" | null {
  const head = src.replace(/^(\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, "");
  if (/^["']use client["']/.test(head)) return "client";
  if (/^["']use server["']/.test(head)) return "server";
  return null;
}

/** Value imports and re-exports; `import type` / `export type` are erased. */
function specifiers(src: string): string[] {
  const out: string[] = [];
  const re =
    /(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']/g;
  for (const m of src.matchAll(re)) out.push(m[1]);
  // Lazy `import("...")` is a separate chunk, loaded on demand: not counted.
  return out;
}

function resolveLocal(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? join(SRC, spec.slice(2))
    : join(dirname(from), spec);
  for (const cand of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

function packageName(spec: string): string {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/** Every denied package reachable from `entry`, with the path that reaches it. */
function deniedReach(entry: string): string[] {
  const hits: string[] = [];
  const seen = new Set<string>();
  const stack: { file: string; trail: string[] }[] = [
    { file: entry, trail: [relative(ROOT, entry)] },
  ];
  while (stack.length > 0) {
    const { file, trail } = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    if (file !== entry && directive(src) === "server") continue;
    for (const spec of specifiers(src)) {
      if (spec.startsWith(".") || spec.startsWith("@/")) {
        const next = resolveLocal(file, spec);
        if (next)
          stack.push({ file: next, trail: [...trail, relative(ROOT, next)] });
      } else if (DENIED.includes(packageName(spec))) {
        hits.push(`${[...trail, spec].join(" -> ")}`);
      }
    }
  }
  return hits;
}

/**
 * Storefront and member client modules. The admin panel is left out on
 * purpose: its app-settings form validates against the same Zod schema the
 * save action uses (`app-config.ts`), it is loaded by a handful of operators,
 * and it never reaches a visitor's page.
 */
const clientEntries = walk(SRC).filter(
  (f) =>
    !relative(SRC, f).startsWith("app/admin/") &&
    !relative(SRC, f).startsWith("components/admin/") &&
    directive(readFileSync(f, "utf8")) === "client",
);

describe("client bundles stay free of server-only weight", () => {
  it("finds the client entries it is meant to guard", () => {
    const rel = clientEntries.map((f) => relative(ROOT, f));
    expect(rel).toContain("src/components/laffogato/karaoke-booking.tsx");
    expect(rel.length).toBeGreaterThan(20);
  });

  it("the karaoke booking form does not reach Zod", () => {
    expect(
      deniedReach(join(SRC, "components/laffogato/karaoke-booking.tsx")),
    ).toEqual([]);
  });

  it("no storefront client module reaches a denied package", () => {
    const hits = clientEntries.flatMap(deniedReach);
    expect(hits).toEqual([]);
  });

  it("the quote helpers still agree with the server's", async () => {
    const core = await import("@/lib/mobile/karaoke-core");
    const quote = await import("@/lib/mobile/karaoke-quote");
    for (const tier of ["oro", "argento", null]) {
      expect(quote.quoteKaraoke(3, 40_000, tier, 15)).toEqual(
        core.quoteReservation(3, 40_000, tier, 15),
      );
      expect(quote.karaokeDiscountPctFor(tier, 20)).toBe(
        core.karaokeDiscountPct(tier, 20),
      );
    }
  });
});
