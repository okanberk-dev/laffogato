import { join, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { nextValues, publicFile } from "../scripts/backfill-backdrops.mjs";

/**
 * The backfill writes to production rows, so its two decisions are pinned:
 * which file a stored path may read, and when a row is written at all.
 */

const PUBLIC = join(process.cwd(), "public");

function found(family: string | null, hex: string | null, cutout: boolean) {
  return {
    photoCutout: cutout,
    pick: { family, hex, distance: 0, reason: "nearest" },
    version: "v1",
  };
}

describe("publicFile", () => {
  it("maps a site-relative photo under public/, without its query", () => {
    expect(publicFile("/menu/matcha-latte.webp?v=1", PUBLIC)).toBe(
      join(PUBLIC, "menu", "matcha-latte.webp"),
    );
  });

  it("never leaves public/", () => {
    for (const path of ["/menu/../../package.json", "/../.env", "/..", "/"]) {
      const file = publicFile(path, PUBLIC);
      expect(file === null || file.startsWith(PUBLIC + sep)).toBe(true);
      if (file) expect(file).not.toBe(PUBLIC);
    }
    expect(publicFile("/menu/../../package.json", PUBLIC)).toBeNull();
  });

  it("reads only site-relative paths", () => {
    expect(publicFile("https://cdn.example/a.webp", PUBLIC)).toBeNull();
    expect(publicFile("data:image/png;base64,AAAA", PUBLIC)).toBeNull();
    expect(publicFile("menu/a.webp", PUBLIC)).toBeNull();
  });
});

describe("nextValues", () => {
  const row = {
    source: "auto",
    backdrop: null,
    hex: null,
    cutout: false,
  };

  it("writes a new pick on an automatic row", () => {
    expect(nextValues(row, found("caramel", "#B87333", true))).toEqual({
      backdrop: "caramel",
      hex: "#B87333",
      cutout: true,
    });
  });

  it("never touches a row the operator chose by hand", () => {
    expect(
      nextValues(
        { ...row, source: "manual", backdrop: "berry" },
        found("caramel", "#B87333", true),
      ),
    ).toBeNull();
  });

  it("writes nothing when nothing changes or the photo could not be read", () => {
    expect(
      nextValues(
        { ...row, backdrop: "caramel", hex: "#B87333", cutout: true },
        found("caramel", "#B87333", true),
      ),
    ).toBeNull();
    expect(nextValues(row, null)).toBeNull();
  });

  it("clears a stale automatic pick the photo no longer supports", () => {
    expect(
      nextValues(
        { ...row, backdrop: "latte", hex: "#D9B98C" },
        found(null, "#00C800", false),
      ),
    ).toEqual({ backdrop: null, hex: "#00C800", cutout: false });
  });
});
