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
  /^(?:@\/lib\/(?:admin\/store|admin\/site-content|admin\/home-hero|legal\/store|db|db\/client)|(?:\.\.?\/)+(?:[\w-]+\/)*(?:admin\/store|admin\/site-content|admin\/home-hero|legal\/store|db\/client|db))$/;

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
      .map((f) => ({ file: f, reads: liveReadsIn(readFileSync(f, "utf8")) }))
      .filter((o) => o.reads.length > 0);
    expect(offenders).toEqual([]);
  });
});
