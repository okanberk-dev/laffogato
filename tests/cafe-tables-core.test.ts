import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  createCafeTableSchema,
  setCafeTableActiveSchema,
  updateCafeTableSchema,
} from "@/lib/admin/cafe-table-schema";
import {
  generateTableCode,
  normalizeTableCode,
  normalizeTableName,
  TABLE_CODE_ALPHABET,
  TABLE_CODE_LENGTH,
  tableUrl,
} from "@/lib/admin/cafe-tables-core";

/**
 * The code printed on a table. It is laminated and cannot be recalled, so the
 * rules that make it unguessable, readable and stable are pinned here.
 */

describe("generateTableCode", () => {
  it("draws ten Crockford base32 symbols", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateTableCode();
      expect(code).toHaveLength(TABLE_CODE_LENGTH);
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);
    }
  });

  it("never uses the look-alike letters I, L, O or U", () => {
    expect(TABLE_CODE_ALPHABET).toHaveLength(32);
    for (const ch of "ILOU") expect(TABLE_CODE_ALPHABET).not.toContain(ch);
  });

  it("maps each byte onto the alphabet without bias", () => {
    // 32 divides 256, so every byte is fair: byte b -> symbol b % 32.
    const bytes = Uint8Array.from([0, 31, 32, 255, 1, 2, 3, 4, 5, 6]);
    const code = generateTableCode(() => bytes);
    expect(code[0]).toBe(TABLE_CODE_ALPHABET[0]);
    expect(code[1]).toBe(TABLE_CODE_ALPHABET[31]);
    expect(code[2]).toBe(TABLE_CODE_ALPHABET[0]);
    expect(code[3]).toBe(TABLE_CODE_ALPHABET[31]);
  });

  it("does not repeat itself", () => {
    const seen = new Set(
      Array.from({ length: 500 }, () => generateTableCode()),
    );
    expect(seen.size).toBe(500);
  });
});

describe("normalizeTableCode", () => {
  it("accepts what a person types off a card", () => {
    expect(normalizeTableCode(" abcd-efgh 23 ")).toBe("ABCDEFGH23");
    expect(normalizeTableCode("abcde-fghjk")).toBe("ABCDEFGHJK");
  });

  it("folds Crockford's aliases: O to 0, I and L to 1", () => {
    expect(normalizeTableCode("O0IL1ABCDE")).toBe("00111ABCDE");
    expect(normalizeTableCode("oilOILabcd")).toBe("011011ABCD");
  });

  it("refuses anything that is not exactly ten symbols", () => {
    expect(normalizeTableCode("ABCDEFGH2")).toBeNull();
    expect(normalizeTableCode("ABCDEFGH234")).toBeNull();
    expect(normalizeTableCode("")).toBeNull();
    expect(normalizeTableCode("ABCDEFGHU2")).toBeNull(); // U is not in it
    expect(normalizeTableCode("ABCD/FGH23")).toBeNull();
    expect(normalizeTableCode("../../etc1")).toBeNull();
    expect(normalizeTableCode(42)).toBeNull();
    expect(normalizeTableCode(null)).toBeNull();
  });
});

describe("tableUrl", () => {
  it("is the apex host, never www or the deployment's own URL", () => {
    expect(tableUrl("ABCDEFGH23")).toBe(
      "https://laffogato.net/masa/ABCDEFGH23",
    );
    expect(tableUrl("X")).not.toContain("www.");
  });
});

describe("table names", () => {
  it("trims, collapses spaces and keeps 1-40 characters", () => {
    expect(normalizeTableName("  Bahçe   3 ")).toBe("Bahçe 3");
    expect(normalizeTableName("")).toBeNull();
    expect(normalizeTableName("   ")).toBeNull();
    expect(normalizeTableName("x".repeat(40))).toHaveLength(40);
    expect(normalizeTableName("x".repeat(41))).toBeNull();
  });

  it("is enforced by the panel forms too", () => {
    expect(createCafeTableSchema.safeParse({ name: " " }).success).toBe(false);
    expect(createCafeTableSchema.safeParse({ name: "Bahçe 3" }).success).toBe(
      true,
    );
    expect(
      updateCafeTableSchema.safeParse({
        id: "tbl-0001",
        name: "x".repeat(41),
        sortOrder: "1",
      }).success,
    ).toBe(false);
  });

  it("only accepts table ids and explicit states from the panel", () => {
    expect(
      updateCafeTableSchema.safeParse({
        id: "ord-0001",
        name: "Bahçe 3",
        sortOrder: "1",
      }).success,
    ).toBe(false);
    expect(
      setCafeTableActiveSchema.safeParse({ id: "tbl-0002", isActive: "yes" })
        .success,
    ).toBe(false);
    expect(
      setCafeTableActiveSchema.safeParse({ id: "tbl-0002", isActive: "false" })
        .success,
    ).toBe(true);
  });
});

describe("storage", () => {
  const BUNDLE = readFileSync("db/schema.sql", "utf8");
  const STORE = readFileSync("src/lib/admin/cafe-tables.ts", "utf8");

  it("keeps the code unique, the table behind RLS and the order snapshot columns", () => {
    expect(BUNDLE).toMatch(/create table if not exists public\.cafe_tables \(/);
    expect(BUNDLE).toMatch(/code\s+text\s+not null unique/);
    expect(BUNDLE).toContain(
      "alter table public.cafe_tables enable row level security;",
    );
    expect(BUNDLE).toContain(
      `alter table public.orders add column if not exists "tableCode" text not null default '';`,
    );
    expect(BUNDLE).toContain(
      `alter table public.orders add column if not exists "tableName" text not null default '';`,
    );
  });

  it("reads nothing but the label and the state for a public lookup", () => {
    const resolve = STORE.slice(
      STORE.indexOf("export async function resolveActiveTable"),
    );
    expect(resolve).toContain('.select("code, name, isActive")');
    expect(resolve).not.toContain('select("*")');
  });

  it("never deletes a table", () => {
    expect(STORE).not.toMatch(/\.delete\(/);
  });
});
