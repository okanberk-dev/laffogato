import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { splitStatements } from "../scripts/db-migrate.mjs";

const split: (sql: string) => string[] = splitStatements;

describe("splitStatements", () => {
  it("splits ordinary statements on semicolons", () => {
    expect(split("select 1; select 2;")).toEqual(["select 1", "select 2"]);
  });

  it("ignores trailing whitespace and empty statements", () => {
    expect(split("select 1;;\n\n")).toEqual(["select 1"]);
  });

  it("keeps semicolons inside single-quoted strings", () => {
    expect(split("select 'a;b'; select 2")).toEqual([
      "select 'a;b'",
      "select 2",
    ]);
  });

  it("handles doubled quotes inside a string", () => {
    expect(split("select 'it''s; fine'; select 2")).toHaveLength(2);
  });

  it("keeps a dollar-quoted function body intact", () => {
    const sql = `create function f() returns int language plpgsql as $$
begin
  return 1;
end;
$$;
select 2;`;
    const out = split(sql);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("return 1;");
    expect(out[1]).toBe("select 2");
  });

  it("handles tagged dollar quotes", () => {
    const sql = `do $body$ begin perform 1; end $body$; select 2;`;
    expect(split(sql)).toHaveLength(2);
  });

  it("keeps semicolons inside comments attached to their statement", () => {
    const out = split("-- a; b\nselect 1;\nselect 2;");
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("select 1");
  });

  it("splits every real migration without losing a function body", () => {
    // The atomic-stock migration is the one with PL/pgSQL bodies full of
    // semicolons — the case a naive split corrupts.
    const sql = readFileSync(
      "db/migrations/20260601130000_atomic_stock_and_promo.sql",
      "utf8",
    );
    const out = split(sql);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("claim_order_stock");
    expect(out[0]).toContain("INSUFFICIENT_STOCK");
    expect(out[1]).toContain("increment_promo_usage");
  });
});
