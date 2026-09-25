import { join, sep } from "node:path";

import { describe, expect, it } from "vitest";

import {
  nextValues,
  publicFile,
  TARGETS,
  writeScene,
} from "../scripts/backfill-backdrops.mjs";

/**
 * The backfill writes to production rows, so its decisions are pinned:
 * which file a stored path may read, when a row is written at all, and that
 * the write lands only on the row as it was read.
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

/**
 * Review L-3 (25 Sep 2026): the operator may save the item through the panel
 * between the script's read and its write (a download alone may take 15 s).
 * The write must then leave the panel's values alone.
 */
describe("writeScene", () => {
  type Query = { text: string; values: unknown[] };

  function fakeDb(rowCount: number) {
    const queries: Query[] = [];
    return {
      queries,
      async query(text: string, values: unknown[]) {
        queries.push({ text, values });
        return { rowCount };
      },
    };
  }

  const [MENU, SHOP] = TARGETS;
  const next = { backdrop: "caramel", hex: "#B87333", cutout: true };
  const menuRow = {
    id: "mnu-0042",
    image: "data:image/webp;base64,QUFB",
    hue: "rose",
    category: "frozen",
  };

  it("writes only while the row is automatic and has the photo, hue and category it was read with", async () => {
    const db = fakeDb(1);
    expect(await writeScene(db, MENU, menuRow, next)).toBe(true);
    const [{ text, values }] = db.queries;
    expect(text).toContain("update public.menu_items");
    expect(text).toContain(`"backdropSource" = 'auto'`);
    expect(text).toContain("image is not distinct from $5");
    expect(text).toContain("hue is not distinct from $6");
    expect(text).toContain(`"categoryKey" is not distinct from $7`);
    expect(values).toEqual([
      "mnu-0042",
      "caramel",
      "#B87333",
      true,
      menuRow.image,
      "rose",
      "frozen",
    ]);
  });

  it("checks a product's FIRST photo, its img and cat", async () => {
    const db = fakeDb(1);
    await writeScene(
      db,
      SHOP,
      {
        id: "prd-0001",
        image: "data:image/png;base64,QkJC",
        hue: "caramel",
        category: "beans",
      },
      next,
    );
    const [{ text, values }] = db.queries;
    expect(text).toContain("update public.products");
    expect(text).toContain("images->>0 is not distinct from $5");
    expect(text).toContain("img is not distinct from $6");
    expect(text).toContain("cat is not distinct from $7");
    expect(values.slice(4)).toEqual([
      "data:image/png;base64,QkJC",
      "caramel",
      "beans",
    ]);
  });

  it("reports a row that changed in between as not written", async () => {
    expect(await writeScene(fakeDb(0), MENU, menuRow, next)).toBe(false);
  });

  it("reads and checks the same three values on both tables", () => {
    for (const target of TARGETS) {
      expect(target.select).toContain(" as category");
      expect(target.select).toMatch(/\bimage\b/);
      expect(target.select).toMatch(/\bhue\b/);
      // The expression the write checks is the one the select reads.
      expect(target.select).toContain(target.photo);
      expect(target.select).toContain(target.category);
    }
  });
});
