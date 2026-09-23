import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The contract exists twice, and its own header says the two must match.
 *
 * They did not. The site's copy grew `qrModules` / `qrQuietZone` when the QR
 * was rebuilt; the app repo's copy stayed behind - while the app's own card
 * screen already read both fields. A contract that disagrees with itself is
 * worse than one that is merely out of date, because each side can cite it.
 *
 * Where the app repo lives varies: `LAFMOBIL_DIR` wins, then a sibling
 * `../lafmobil` (a plain clone), then `../lafmobil-main` (a GitHub zip). The
 * test used to look only at `../lafmobil`, so on a machine with the zip it
 * skipped in silence and the drift it exists to catch went unseen.
 */
function appCopy(): { path: string | null; tried: string[] } {
  const dirs = [
    process.env.LAFMOBIL_DIR?.trim() || "",
    "../lafmobil",
    "../lafmobil-main",
  ].filter(Boolean);
  const tried = dirs.map((dir) => resolve(join(dir, "docs/API-MOBILE.md")));
  return { path: tried.find((p) => existsSync(p)) ?? null, tried };
}

describe("docs/API-MOBILE.md", () => {
  it("is byte-identical in both repositories", () => {
    const { path, tried } = appCopy();
    if (!path) {
      // CI clones one repository; say so instead of passing in silence.
      console.info(
        `[api-contract-parity] skipped: no app copy at ${tried.join(", ")}`,
      );
      return;
    }
    console.info(`[api-contract-parity] compared with ${path}`);
    expect(readFileSync(path, "utf8")).toBe(
      readFileSync("docs/API-MOBILE.md", "utf8"),
    );
  });

  it("documents the fields the app reads that the drift had left out", () => {
    const doc = readFileSync("docs/API-MOBILE.md", "utf8");
    for (const field of ["qrModules", "qrQuietZone", "appStoreUrl"]) {
      expect(doc).toContain(field);
    }
  });
});
