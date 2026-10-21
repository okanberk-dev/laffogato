import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The other half of the guard in tests/site-data-cache.test.ts. That one
 * keeps the commercial paths off the presentation cache; this one keeps
 * the public pages off the live readers.
 *
 * A public page is what a crawler renders at 04:00, and the database
 * (Neon, free plan) wakes for every live read (docs/DATABASE.md "Uyanmalar
 * ve önbellek"). The cached readers in src/lib/seo/site-data.ts
 * (`getSiteSettings`, `listSite*`, `getSiteProductBySlug`, ...) and the
 * shells built on them (`loadAppProps`, `renderSectionPage`) read the Data
 * Cache instead. `getPublicSettings()` and the store's `list*` / `get*`
 * readers fall back the same way in an outage but read the database every
 * time: a redesigned page that went back to them would put the night's
 * wake-ups back without any other test noticing.
 *
 * Out of scope on purpose: the panel, the app's API, /odeme, /karaoke,
 * /rezervasyon (they must read live), a member's own pages under
 * /uye/hesap (a signed-in person), the /gorsel image routes (image bytes,
 * kept by the CDN), /dev, and server actions (a person acting).
 */

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

const LIVE_OR_PERSONAL = [
  "src/app/admin/",
  "src/app/api/",
  "src/app/odeme/",
  "src/app/karaoke/",
  "src/app/rezervasyon/",
  "src/app/uye/hesap/",
  "src/app/gorsel/",
  "src/app/dev/",
];

/** Every file a public page view runs, as far as data goes. */
function publicFiles(): string[] {
  return [
    ...sourceFiles("src/app").filter(
      (f) =>
        !LIVE_OR_PERSONAL.some((dir) => f.startsWith(dir)) &&
        !f.endsWith("/actions.ts"),
    ),
    ...sourceFiles("src/components/laffogato"),
    ...sourceFiles("src/components/customer"),
    ...sourceFiles("src/components/uye"),
    "src/lib/seo/app-props.ts",
    "src/lib/seo/section-page.tsx",
  ].sort();
}

/** The modules whose readers query the database on every call. */
const LIVE_MODULE =
  /^(?:@\/lib\/(?:admin\/store|admin\/site-content|admin\/home-hero|legal\/store|legal\/versions|db|db\/client)|(?:\.\.?\/)+(?:[\w-]+\/)*(?:admin\/store|admin\/site-content|admin\/home-hero|legal\/store|legal\/versions|db\/client|db))$/;

/**
 * The one live read a public page may make, and only behind its own
 * parameter: /hukuk/<slug>?surum=<prefix> reads the stored version it names
 * (decision ASK-DURABLE). That address is printed in a customer's
 * confirmation mail, is noindex and is not linked from any page, and
 * without the parameter the page reads exactly what it read before
 * (tests/legal-version-page.test.ts proves both).
 */
const ALLOWED_LIVE_READS: Record<string, readonly string[]> = {
  "src/app/hukuk/[slug]/legal-version.tsx": [
    "findLegalVersionByPrefix from @/lib/legal/versions",
  ],
};

/** A reader, by the store's naming: getX, listX, findX, searchX, countX, loadX. */
const READER = /^(?:get|list|find|search|count|load)[A-Z]/;

/** The live readers `src` imports by value, with where from. */
function liveReadsIn(src: string): string[] {
  const found: string[] = [];
  for (const m of src.matchAll(
    /^\s*import\s+(type\s+)?([^;]*?)\s+from\s+["']([^"']+)["']/gm,
  )) {
    const [, typeOnly, spec, mod] = m;
    if (typeOnly || !LIVE_MODULE.test(mod)) continue;
    const named = /\{([\s\S]*)\}/.exec(spec)?.[1] ?? "";
    for (const raw of named.split(",")) {
      const part = raw.trim();
      if (!part || part.startsWith("type ")) continue;
      const name = part.split(/\s+as\s+/)[0].trim();
      if (READER.test(name)) found.push(`${name} from ${mod}`);
    }
    if (/^\s*\*\s+as\s+/.test(spec)) found.push(`* from ${mod}`);
  }
  for (const m of src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) {
    if (LIVE_MODULE.test(m[1])) found.push(`import(${m[1]})`);
  }
  return found;
}

describe("the parse", () => {
  it.each([
    `import { getPublicSettings } from "@/lib/admin/store";`,
    `import { listShopProducts, type ShopCategoryId } from "@/lib/admin/store";`,
    `import { getSettings as settings } from "../../lib/admin/store";`,
    `import { getPublishedLegalOverride } from "@/lib/legal/store";`,
    `import { getSiteContent } from "@/lib/admin/site-content";`,
    `import * as store from "@/lib/admin/store";`,
    `const { listProducts } = await import("@/lib/admin/store");`,
    `import { getDb } from "@/lib/db";`,
    `import { findLegalVersionByPrefix } from "@/lib/legal/versions";`,
    `import { loadLegalVersions } from "../../lib/legal/versions";`,
  ])("catches %s", (line) => {
    expect(liveReadsIn(line)).not.toEqual([]);
  });

  it.each([
    `import type { ShopCategoryId } from "@/lib/admin/store";`,
    `import { type AdminSettings } from "@/lib/admin/store";`,
    `import { DAYS_OF_WEEK, DAY_LABELS } from "@/lib/admin/store";`,
    `import { getSiteSettings, listSiteMenu } from "@/lib/seo/site-data";`,
    `import { isDegradedRequest } from "@/lib/db/health";`,
    `// getPublicSettings() reads the database every time`,
  ])("leaves %s alone", (line) => {
    expect(liveReadsIn(line)).toEqual([]);
  });
});

describe("public pages read the cached presentation readers", () => {
  it("the scope covers the customer pages and both shells", () => {
    const files = publicFiles();
    for (const f of [
      "src/app/page.tsx",
      "src/app/not-found.tsx",
      "src/app/menu/[kategori]/page.tsx",
      "src/app/magaza/urun/[slug]/page.tsx",
      "src/app/hukuk/[slug]/page.tsx",
      "src/app/sitemap.ts",
      "src/app/uye/giris/page.tsx",
      "src/lib/seo/app-props.ts",
    ]) {
      expect(files).toContain(f);
    }
    expect(files.some((f) => f.startsWith("src/app/odeme/"))).toBe(false);
  });

  it("no public page, shell or customer component imports a live reader", () => {
    const offenders = publicFiles()
      .map((f) => ({
        file: f,
        reads: liveReadsIn(readFileSync(f, "utf8")).filter(
          (r) => !(ALLOWED_LIVE_READS[f] ?? []).includes(r),
        ),
      }))
      .filter((o) => o.reads.length > 0);
    expect(offenders).toEqual([]);
  });

  it("allows the stored-version read in one file only, and it still needs the allowance", () => {
    // The allowance is not dead weight: the file does import the reader...
    for (const [file, reads] of Object.entries(ALLOWED_LIVE_READS)) {
      expect(publicFiles()).toContain(file);
      expect(liveReadsIn(readFileSync(file, "utf8"))).toEqual([...reads]);
    }
    // ...and the page reaches it only through the `?surum=` branch.
    const page = readFileSync("src/app/hukuk/[slug]/page.tsx", "utf8");
    expect(liveReadsIn(page)).toEqual([]);
    expect(page).toContain('import { LegalVersionView } from "./legal-version";');
  });

  /**
   * Review R8 (21 Eki 2026): the allowance names the file that runs the
   * read, and the check above looks only at imports of the live modules, so
   * any other public page could import `LegalVersionView` (which runs the
   * query on every view) without failing it. Only the hukuk page, behind
   * its `?surum=` branch, may.
   */
  it("lets only the hukuk page import the view that runs the read", () => {
    const importers = publicFiles().filter((f) =>
      /\bfrom\s+["'][^"']*legal-version["']|\bimport\(\s*["'][^"']*legal-version["']\s*\)/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(importers).toEqual(["src/app/hukuk/[slug]/page.tsx"]);
  });
});
