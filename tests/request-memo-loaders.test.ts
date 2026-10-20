import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Executor } from "@/lib/db/client";

/**
 * WP1: presentational loaders that one render asks for twice are memoised per
 * request with `React.cache` (the pattern Next 16 documents for database
 * reads: node_modules/next/dist/docs/01-app/01-getting-started/
 * 06-fetching-data.md, "Reusing data with React.cache").
 *
 * - getPublicSettings: home metadata + body, /odeme and /uye layout + page
 * - getShopProductBySlug: product page metadata + body
 * - getPublishedLegalOverride: /hukuk/[slug] metadata + body
 * - and their cached twins in src/lib/seo/site-data.ts, which the public
 *   pages read (getSiteSettings, getSiteProductBySlug, getSiteLegalOverride)
 *
 * The memo is request-scoped and is a pass-through outside a render, so it
 * can never serve one visitor's read to another or make a commercial path
 * stale. The second half of this file proves the pass-through: two calls
 * outside a render are two queries.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("the double-read loaders are request-memoised", () => {
  it.each([
    ["src/lib/admin/store.ts", "getPublicSettings"],
    ["src/lib/admin/store.ts", "getShopProductBySlug"],
    ["src/lib/legal/store.ts", "getPublishedLegalOverride"],
    // The cached presentation readers the public pages use instead
    // (src/lib/seo/site-data.ts): one Data Cache lookup per request.
    ["src/lib/seo/site-data.ts", "getSiteSettings"],
    ["src/lib/seo/site-data.ts", "getSiteProductBySlug"],
    ["src/lib/seo/site-data.ts", "getSiteLegalOverride"],
  ])("%s: %s", (file, name) => {
    const src = read(file);
    expect(src).toContain('import { cache } from "react";');
    expect(src).toMatch(new RegExp(`export const ${name} = cache\\(`));
  });

  it("the commercial settings read is NOT memoised", () => {
    // getSettings decides tax, shipping and whether an order may be placed;
    // it stays a plain read on every call.
    expect(read("src/lib/admin/store.ts")).toContain(
      "export async function getSettings(): Promise<AdminSettings> {",
    );
  });
});

const seen: string[] = [];
const exec: Executor = async ({ text }) => {
  seen.push(text);
  if (/count\(\*\)/i.test(text)) return { rows: [{ count: 1 }], rowCount: 1 };
  if (/FROM "settings"/.test(text)) {
    return { rows: [{ id: "main", isShopOpen: true }], rowCount: 1 };
  }
  return { rows: [], rowCount: 0 };
};

vi.mock("@/lib/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/db")>();
  const db = createDb(exec);
  return { ...real, getDb: () => db };
});

const store = await import("@/lib/admin/store");

beforeEach(() => {
  seen.length = 0;
});

describe("outside a render the memo is a pass-through", () => {
  it("reads the settings on every call", async () => {
    const reads = () =>
      seen.filter((t) => /^SELECT \* FROM "settings"/.test(t)).length;
    await store.getPublicSettings(); // warms the once-per-instance seed check
    const before = reads();
    await store.getPublicSettings();
    await store.getPublicSettings();
    expect(reads() - before).toBe(2);
  });

  it("still degrades nothing on a healthy database", async () => {
    const s = await store.getPublicSettings();
    expect(s.isShopOpen).toBe(true);
  });
});
