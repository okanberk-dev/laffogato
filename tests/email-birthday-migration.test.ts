import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const FILE = "20260916140000_birthday_mail_and_scheduled_campaigns.sql";
const sql = readFileSync(join(process.cwd(), "db", "migrations", FILE), "utf8");
const bundle = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");

/** The file with its `--` comments removed - the part Postgres actually runs. */
const statements = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe(FILE, () => {
  it("never records itself in _migrations", () => {
    // scripts/db-migrate.mjs inserts the row itself, inside the same
    // transaction. A hand-written insert collides with it (23505) and rolls
    // the WHOLE file back.
    expect(statements).not.toContain("insert into public._migrations");
  });

  it("is in the bundle, so a hand-applied schema has it too", () => {
    expect(bundle).toContain(FILE);
    expect(bundle).toContain("public.birthday_greeting_audience");
  });

  it("re-runs without complaint", () => {
    // Every statement is idempotent: the operator may apply the bundle twice.
    expect(statements).toContain("add column if not exists");
    expect(statements).toContain("create index if not exists");
    expect(statements).toContain("create or replace function");
  });

  it("says how to undo itself", () => {
    expect(sql).toContain("drop function if exists");
    expect(sql).toContain("drop column if exists");
  });

  it("adds the schedule column without disturbing an existing draft", () => {
    // "" is what every row already meant: send it by hand.
    expect(statements).toMatch(
      /alter table public\.campaign_emails\s+add column if not exists "scheduledAt" text not null default ''/,
    );
    // The cron's only question, hourly, and the index that answers it.
    expect(statements).toContain(
      `where status = 'draft' and "scheduledAt" <> ''`,
    );
  });

  describe("the birthday audience rule", () => {
    it("matches AA-GG from either stored birthday form", () => {
      // The mobile schema writes YYYY-AA-GG; `birthdayMonth` also accepts
      // AA-GG, and `right(…, 5)` is both.
      expect(statements).toContain("right(c.birthday, 5)");
      expect(statements).toContain("length(c.birthday) >= 5");
    });

    it("returns the consent verdict per row rather than filtering on it", () => {
      // The coupon is an entitlement (no consent gate); the greeting is a
      // commercial message (consent gate). One query, one flag, two rules.
      expect(statements).toContain("as marketing");
      expect(statements).toContain(
        `coalesce(c."notificationPrefs" ->> 'marketing', 'false') = 'true'`,
      );
      expect(statements).toContain(`c."marketingConsentAt" <> ''`);
    });

    it("keeps guests and closed accounts out, as the campaign rule does", () => {
      expect(statements).toContain(`c.email not like '%@laffogato.local'`);
      expect(statements).toContain(`c.email not like '%@anon.local'`);
      expect(statements).toContain(`c."isActive"`);
      expect(statements).toContain(`c."emailVerified"`);
    });

    it("pins its search_path, like every other function here", () => {
      expect(statements).toContain("set search_path = ''");
    });
  });
});
