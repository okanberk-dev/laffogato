import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The contract exists twice, and its own header says the two must match.
 *
 * They did not. The site's copy grew `qrModules` / `qrQuietZone` when the QR
 * was rebuilt; the app repo's copy stayed behind — while the app's own card
 * screen already read both fields. A contract that disagrees with itself is
 * worse than one that is merely out of date, because each side can cite it.
 */
const APP_COPY = "../lafmobil/docs/API-MOBILE.md";

describe("docs/API-MOBILE.md", () => {
  it("is byte-identical in both repositories", () => {
    // The app repo is not always checked out beside this one (CI clones one).
    if (!existsSync(APP_COPY)) return;
    expect(readFileSync(APP_COPY, "utf8")).toBe(
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
