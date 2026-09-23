import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The five SPA pages used to share one 2,568-line module, so a visit to any
 * route downloaded all five. Each page is now its own file and app.tsx loads
 * only the one the route shows (next/dynamic). The split is silent to undo:
 * one static `import { PageShop } from "./shop-page"` anywhere puts that page
 * back into every route's first-load JS, and nothing else would fail.
 */

const DIR = "src/components/laffogato";
const PAGES = {
  home: "PageHome",
  menu: "PageMenu",
  shop: "PageShop",
  story: "PageStory",
  visit: "PageVisit",
} as const;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("SPA pages ship as one chunk each", () => {
  const app = readFileSync(`${DIR}/app.tsx`, "utf8");

  it.each(Object.entries(PAGES))(
    "app.tsx loads %s-page through next/dynamic",
    (file, component) => {
      expect(app).toMatch(
        new RegExp(
          `const ${component} = dynamic\\(\\(\\) =>\\s*import\\("\\./${file}-page"\\)\\.then\\(\\(m\\) => m\\.${component}\\)`,
        ),
      );
    },
  );

  it("no module imports a page statically", () => {
    const offenders = sourceFiles("src").filter((path) =>
      /^import\s+(?!type\b)[^;]*?from\s+["'][^"']*\/(home|menu|shop|story|visit)-page["']/m.test(
        readFileSync(path, "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("keeps the server render and gives no page a loading fallback", () => {
    // `ssr: false` would send an empty <main> to crawlers and to the first
    // paint; a `loading` fallback would wrap the page in a Suspense boundary
    // that can blank <main> during a client-side navigation.
    expect(app).not.toMatch(/ssr\s*:\s*false/);
    expect(app).not.toMatch(/loading\s*:/);
  });

  it("the old all-pages module is gone", () => {
    expect(() => statSync(`${DIR}/pages.tsx`)).toThrow();
  });
});
