import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const FILE = "20260905200000_admin_users_and_counter_tokens.sql";
const sql = readFileSync(join(process.cwd(), "db", "migrations", FILE), "utf8");
const bundle = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");

/** The file with its `--` comments removed — the part Postgres actually runs. */
const statements = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe(FILE, () => {
  it("never records itself in _migrations", () => {
    // scripts/db-migrate.mjs inserts the row itself, inside the same
    // transaction. A hand-written insert collides with it (23505) and rolls the
    // WHOLE file back — the tables would silently never exist.
    expect(statements).not.toContain("insert into public._migrations");
  });

  it("creates both tables idempotently", () => {
    expect(sql).toContain("create table if not exists public.admin_users");
    expect(sql).toContain("create table if not exists public.counter_tokens");
  });

  it("keeps the raw counter token out of the database", () => {
    // Only the sha256 is stored, so reading the table cannot produce a QR that
    // the till would accept.
    expect(statements).toMatch(/"tokenHash"\s+text\s+primary key/);
    expect(statements).not.toMatch(/^\s*token\s+text/m);
  });

  it("enables row level security on both tables", () => {
    expect(sql).toContain(
      "alter table public.admin_users enable row level security",
    );
    expect(sql).toContain(
      "alter table public.counter_tokens enable row level security",
    );
  });

  it("is carried by the hand-apply bundle", () => {
    expect(bundle).toContain("create table if not exists public.admin_users");
    expect(bundle).toContain(
      `insert into public._migrations (name) values ('${FILE}')`,
    );
  });
});
