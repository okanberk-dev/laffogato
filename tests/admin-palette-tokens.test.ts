import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The panel draws with its own tokens (`--admin-*`, app/admin/layout.tsx):
 * warm stone greys, AA-checked inks. A raw Tailwind palette class (cool
 * `neutral-500`, `red-600`, `amber-800`) slipped past them in the image
 * upload, the product wizard and the shop slide form (21 Oct 2026): cold
 * greys beside warm ones, and inks no test held to AA.
 */

const PALETTE =
  /\b(?:text|bg|border|ring|accent|divide|placeholder|decoration|from|to|via|fill|stroke|outline)-(?:amber|red|rose|emerald|green|blue|sky|zinc|neutral|stone|gray|slate|orange|yellow|lime|teal|cyan|indigo|violet|purple|pink|fuchsia)-\d{2,3}\b/g;

/** Files allowed a palette class, and why. */
const ALLOWED: Record<string, string> = {
  // The printed slip: black on white paper, outside the panel's look.
  "src/components/admin/order-detail.tsx": "print",
  // A slide without a photo shows the site's own warm gradient.
  "src/app/admin/magaza-hero/page.tsx": "site swatch",
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("admin colours come from the panel's tokens", () => {
  it("no raw Tailwind palette class outside the print slip", () => {
    const found: string[] = [];
    for (const file of [
      ...files("src/components/admin"),
      ...files("src/app/admin"),
    ]) {
      if (ALLOWED[file]) continue;
      // Comments may name a palette colour; code may not.
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const m of code.matchAll(PALETTE)) found.push(`${file}: ${m[0]}`);
    }
    expect(found).toEqual([]);
  });
});
