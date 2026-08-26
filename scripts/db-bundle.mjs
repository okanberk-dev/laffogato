#!/usr/bin/env node
/**
 * Regenerates db/schema.sql — every migration concatenated in order, ready to
 * paste into a SQL console in one go.
 *
 * `npm run db:migrate` is the normal path. This exists for the case where the
 * machine running the migration cannot reach the database (a locked-down
 * network, a managed console being the only access), so the schema can still be
 * applied by hand.
 *
 * The bundle also records each file in `_migrations`, so a later `db:migrate`
 * against the same database correctly skips everything already applied.
 *
 * Usage:  npm run db:bundle
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(ROOT, "db", "migrations");
export const BUNDLE_PATH = join(ROOT, "db", "schema.sql");

export function buildBundle() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const parts = [
    "-- GENERATED FILE — do not edit by hand.",
    "-- Regenerate with: npm run db:bundle",
    "--",
    "-- Every migration in db/migrations, concatenated in order. Apply this in a",
    "-- SQL console when the machine running `npm run db:migrate` cannot reach the",
    "-- database. Running it twice is safe, and `db:migrate` will skip anything",
    "-- recorded here.",
    "",
    "create table if not exists public._migrations (",
    "  name       text primary key,",
    "  applied_at timestamptz not null default now()",
    ");",
    "",
  ];

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8").trimEnd();
    parts.push(
      `-- ─────────────────────────────────────────────────────────────────────`,
      `-- ${file}`,
      `-- ─────────────────────────────────────────────────────────────────────`,
      sql,
      "",
      `insert into public._migrations (name) values ('${file}')`,
      "  on conflict (name) do nothing;",
      "",
    );
  }

  return parts.join("\n");
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const bundle = buildBundle();
  writeFileSync(BUNDLE_PATH, bundle, "utf8");
  console.log(`db/schema.sql yazıldı (${bundle.split("\n").length} satır).`);
}
