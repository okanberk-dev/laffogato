import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MIGRATION_NAMES } from "@/lib/db/schema-sql";

import {
  buildBundle,
  buildModule,
  BUNDLE_PATH,
  migrationNames,
  MODULE_PATH,
} from "../scripts/db-bundle.mjs";

describe("db/schema.sql", () => {
  it("matches the migrations it is generated from", () => {
    // The bundle is the fallback path for applying the schema by hand, so it
    // going stale would quietly ship an out-of-date database. Regenerate with
    // `npm run db:bundle`.
    const onDisk = readFileSync(BUNDLE_PATH, "utf8");
    expect(onDisk).toBe(buildBundle());
  });

  it("records every migration so a later db:migrate skips them", () => {
    const bundle = buildBundle();
    expect(bundle).toContain("create table if not exists public._migrations");
    for (const name of [
      "20260601120000_initial_schema.sql",
      "20260620120000_customer_coupons.sql",
    ]) {
      expect(bundle).toContain(
        `insert into public._migrations (name) values ('${name}')`,
      );
    }
  });

  it("stays in sync with the TypeScript module the app bootstraps from", () => {
    // src/lib/db/schema-sql.ts ships the schema inside the serverless bundle so
    // the app can create it against an empty database. If it drifts from the
    // migrations, a self-bootstrapped database is silently wrong.
    const onDisk = readFileSync(MODULE_PATH, "utf8");
    expect(onDisk).toBe(buildModule(buildBundle()));
  });

  it("ships the migration list the app checks the database against", () => {
    // bootstrap.ts compares MIGRATION_NAMES to public._migrations to decide
    // whether a deploy still owes the database a migration. A stale list would
    // report an out-of-date database as up to date.
    expect(MIGRATION_NAMES).toEqual(migrationNames());
    expect(MIGRATION_NAMES.length).toBeGreaterThan(0);
    for (const name of MIGRATION_NAMES) {
      expect(buildBundle()).toContain(
        `insert into public._migrations (name) values ('${name}')`,
      );
    }
  });

  it("carries the atomic stock function intact", () => {
    const bundle = buildBundle();
    expect(bundle).toContain("claim_order_stock");
    expect(bundle).toContain("INSUFFICIENT_STOCK");
  });
});

describe("_migrations RLS migration paketi", () => {
  it("paket, _migrations'a RLS açan ifadeyi taşıyor", () => {
    const sql = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf-8");
    expect(sql).toContain(
      "alter table public._migrations enable row level security",
    );
    // Neon'da anon/authenticated yoktur; korumasız revoke migration'ı düşürür.
    expect(sql).toMatch(
      /if exists \(select 1 from pg_roles where rolname = 'anon'\)/,
    );
  });
});
