import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PRODUCTS, STORY } from "@/components/laffogato/data";

/**
 * One dash only (operator's rule, 22 Sep 2026). The ten long dashes the live
 * endpoints still served on 23 Sep came from database rows; the data
 * migration replaces them, keyed on the row AND its exact measured value,
 * and the seeds a fresh install would load are hyphenated with it.
 */

const LONG_DASH = /[\u2013\u2014]/;
const FILE = "db/migrations/20260923230500_hyphen_only_live_text.sql";
const sql = readFileSync(FILE, "utf8");
const statements = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe(FILE, () => {
  it("never records itself in _migrations", () => {
    expect(statements).not.toContain("insert into public._migrations");
  });

  it("carries only hyphens itself: the old values are spelled with chr()", () => {
    expect(LONG_DASH.test(sql)).toBe(false);
    expect(statements).toContain("chr(8212)");
    expect(statements).toContain("chr(8211)");
  });

  it("changes ten rows, each only while it still holds the measured value", () => {
    const updates = statements.split(/;\s*/).filter((s) => /update /.test(s));
    expect(updates).toHaveLength(10);
    for (const u of updates) {
      // A key AND the old value: a row the operator already edited stays.
      expect(u, u).toMatch(/where (id = '[a-z0-9-]+'|btrim\(year\) = '2008')/);
      expect(u, u).toMatch(/\n\s+and (btrim\()?(name|"desc"|title|body)\)? = '/);
      expect(u, u).toMatch(/chr\(821[12]\)/);
    }
  });

  it("targets the seven shop names, the Cappuccino, the 2008 milestone and the morning post", () => {
    const ids = [...statements.matchAll(/where id = '([a-z0-9-]+)'/g)].map(
      (m) => m[1],
    );
    expect(ids).toEqual([
      "prd-0001",
      "prd-0002",
      "prd-0003",
      "prd-0004",
      "prd-0005",
      "prd-0006",
      "prd-0011",
      "mnu-0010",
      "apost-001",
    ]);
    expect(statements).toContain("update public.story_timeline");
  });
});

describe("the seeds a fresh install loads", () => {
  it("name every shop product with a hyphen", () => {
    for (const p of PRODUCTS) {
      expect(LONG_DASH.test(p.name), p.name).toBe(false);
    }
  });

  it("title every story milestone with a hyphen", () => {
    for (const e of STORY.heritage) {
      expect(LONG_DASH.test(e.t), e.t).toBe(false);
    }
  });

  it("keep the panel's seed orders and posts hyphen-only", () => {
    const store = readFileSync("src/lib/admin/store.ts", "utf8");
    for (const m of store.matchAll(/(?:productName|body|title): "([^"]*)"/g)) {
      expect(LONG_DASH.test(m[1]), m[1]).toBe(false);
    }
  });
});
