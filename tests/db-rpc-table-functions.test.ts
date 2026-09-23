import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `rpc()` reads one `result` cell (`SELECT fn(…) AS result`). A function
 * declared `RETURNS TABLE` / `RETURNS SETOF` does not fit that: Postgres hands
 * each row back as an anonymous record, which node-postgres cannot parse, so
 * the caller receives the string `"(a@b.com,Ali,t)"`. That is how the
 * birthday cron ran green every morning with an audience of nobody.
 *
 * Such functions go through `rpcRows()`. This test reads the schema for every
 * one of them and fails if any is still called through `rpc(`.
 */
function tableFunctions(): string[] {
  const schema = readFileSync("db/schema.sql", "utf8");
  const names = new Set<string>();
  const re =
    /create\s+or\s+replace\s+function\s+(?:public\.)?([a-z_]+)\s*\([^)]*\)\s*returns\s+(?:table|setof)\b/gi;
  for (const m of schema.matchAll(re)) names.add(m[1]);
  return [...names];
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

describe("table-returning SQL functions", () => {
  const fns = tableFunctions();

  it("the schema still has the two the app calls", () => {
    expect(fns).toEqual(
      expect.arrayContaining([
        "birthday_greeting_audience",
        "record_auth_failure",
      ]),
    );
  });

  it("are never called through the one-cell rpc()", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles("src")) {
      if (file.endsWith("schema-sql.ts")) continue;
      const src = readFileSync(file, "utf8");
      for (const fn of fns) {
        if (new RegExp(`\\.rpc(?:<[^>]*>)?\\(\\s*["']${fn}["']`).test(src)) {
          offenders.push(`${file}: rpc("${fn}")`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
