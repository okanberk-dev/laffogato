import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildBundle,
  buildModule,
  BUNDLE_PATH,
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
      expect(bundle).toContain(`insert into public._migrations (name) values ('${name}')`);
    }
  });

  it("stays in sync with the TypeScript module the app bootstraps from", () => {
    // src/lib/db/schema-sql.ts ships the schema inside the serverless bundle so
    // the app can create it against an empty database. If it drifts from the
    // migrations, a self-bootstrapped database is silently wrong.
    const onDisk = readFileSync(MODULE_PATH, "utf8");
    expect(onDisk).toBe(buildModule(buildBundle()));
  });

  it("carries the atomic stock function intact", () => {
    const bundle = buildBundle();
    expect(bundle).toContain("claim_order_stock");
    expect(bundle).toContain("INSUFFICIENT_STOCK");
  });
});
