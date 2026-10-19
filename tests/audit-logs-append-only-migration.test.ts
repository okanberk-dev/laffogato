import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { RETENTION_RULES } = await import("@/lib/retention");

/**
 * Olay kaydı is append-only in the database (admin audit SYS-13, decision
 * D30): UPDATE and TRUNCATE are refused, DELETE only past the ten-year
 * retention, so the periodic destruction keeps working. What the triggers do
 * in a real Postgres is in tests/db-integration-audit-append-only.test.ts
 * (CI); this file locks the shape of the migration and its bundle.
 */

const FILE = "20261019170000_audit_logs_append_only.sql";
const DIR = join(process.cwd(), "db", "migrations");
const sql = readFileSync(join(DIR, FILE), "utf8");
const bundle = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");

/** The file with its `--` comments removed - the part Postgres runs. */
const statements = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe(FILE, () => {
  it("never records itself in _migrations and touches no row", () => {
    expect(statements).not.toContain("insert into public._migrations");
    expect(statements).not.toMatch(/^\s*(update|delete from|insert into)\s/im);
    expect(statements).not.toMatch(/\balter table\b/i);
  });

  it("refuses UPDATE and TRUNCATE, and guards DELETE, idempotently", () => {
    expect(statements).toMatch(
      /create or replace function public\.audit_logs_append_only\(\)/,
    );
    expect(statements).toMatch(/set search_path = ''/);
    for (const [name, when] of [
      ["audit_logs_no_update", "before update on public.audit_logs\\s+for each row"],
      ["audit_logs_retention_delete", "before delete on public.audit_logs\\s+for each row"],
      ["audit_logs_no_truncate", "before truncate on public.audit_logs\\s+for each statement"],
    ] as const) {
      expect(statements).toContain(
        `drop trigger if exists ${name} on public.audit_logs;`,
      );
      expect(statements).toMatch(
        new RegExp(`create trigger ${name}\\s+${when}\\s+execute function public\\.audit_logs_append_only\\(\\)`),
      );
    }
    expect(statements.match(/errcode = 'P0001'/g)).toHaveLength(2);
  });

  it("lets a DELETE through only for a written stamp older than ten years", () => {
    expect(statements).toContain("interval '10 years'");
    // The cutoff is printed in the shape the app writes createdAt in.
    expect(statements).toContain(`'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`);
    // A row with no stamp ('' sorts before every instant) is not "old".
    expect(statements).toMatch(
      /old\."createdAt" ~ '\^\[0-9\]\{4\}-[^']*'\s+and old\."createdAt" < cutoff/,
    );
    expect(statements).toMatch(/return old;/);
  });

  it("leaves the retention sweep room: it cuts later than ten calendar years", () => {
    const rule = RETENTION_RULES.find((r) => r.id === "audit-logs");
    expect(rule).toBeDefined();
    expect(rule!.table).toBe("audit_logs");
    expect(rule!.column).toBe("createdAt");
    // Ten calendar years are at most 3,653 days; the sweep waits longer, so
    // every row it deletes is older than the trigger's cutoff.
    expect(rule!.days).toBeGreaterThan(3_653);
    expect(rule!.rpc).toBeUndefined();
  });

  it("is in the bundle, after every earlier migration", () => {
    expect(bundle).toContain(`-- ${FILE}`);
    expect(bundle).toContain(
      `insert into public._migrations (name) values ('${FILE}')`,
    );
    const names = readdirSync(DIR)
      .filter((n) => n.endsWith(".sql"))
      .sort();
    expect(names.indexOf(FILE)).toBeGreaterThan(
      names.indexOf("20261019130000_admin_customer_list.sql"),
    );
  });
});
