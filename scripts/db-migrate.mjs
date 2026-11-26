#!/usr/bin/env node
/**
 * Applies db/migrations/*.sql to the database in DATABASE_URL, in filename
 * order, exactly once each.
 *
 * Applied files are recorded in a `_migrations` table, so the script is safe to
 * re-run and safe to run against a database that is already partly migrated.
 * Each file runs inside one transaction: a file either lands completely or not
 * at all.
 *
 * Usage:  DATABASE_URL=postgres://... npm run db:migrate
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import {
  databaseUrlFrom,
  isDatabaseUrlMissing,
} from "../src/lib/db/database-url.mjs";
// The app's own TLS rules (src/lib/db/index.ts poolConfig): one file, so the
// first live step of a move (migrating the new host) cannot drift from what
// the site will do. It also takes `sslmode` out of the string: `pg` lets the
// parsed URL override the `ssl` object, which dropped DATABASE_SSL_CA here.
import { sslConfigFor } from "../src/lib/db/ssl-config.mjs";

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "db",
  "migrations",
);

async function main() {
  // The app's own rule, from the one file both share: DATABASE_URL and
  // nothing else. POSTGRES_URL is never a fallback here either: it is what
  // Supabase's Vercel integration writes, and migrating that database by
  // accident is how an empty schema would appear next to the real one.
  let url;
  try {
    url = databaseUrlFrom(process.env);
  } catch (err) {
    if (!isDatabaseUrlMissing(err)) throw err;
    console.error(
      `${err.message}\nÖrnek:\n  DATABASE_URL='postgres://...' npm run db:migrate`,
    );
    process.exit(1);
  }

  const { connectionString, ssl } = sslConfigFor(url, process.env);
  const client = new pg.Client({ connectionString, ssl });
  await client.connect();

  try {
    await client.query(
      `create table if not exists public._migrations (
         name       text primary key,
         applied_at timestamptz not null default now()
       )`,
    );

    const applied = new Set(
      (await client.query("select name from public._migrations")).rows.map(
        (r) => r.name,
      ),
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`− ${file} (zaten uygulanmış)`);
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      // One transaction per file, so a failure cannot leave it half-applied.
      // The whole file goes in a single simple-protocol query, which keeps
      // PL/pgSQL bodies intact without any statement splitting.
      await client.query("begin");
      try {
        await client.query(sql);
        // `on conflict`: a file may record itself (20261124150000 does, so
        // the bundle's re-run sees it); a plain insert then broke the whole
        // run on an empty database at that file.
        await client.query(
          "insert into public._migrations (name) values ($1) on conflict (name) do nothing",
          [file],
        );
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw new Error(`${file}: ${err.message}`);
      }
      console.log(`✓ ${file}`);
      ran += 1;
    }

    console.log(
      ran === 0
        ? "Veritabanı zaten güncel."
        : `${ran} migration uygulandı, veritabanı hazır.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration başarısız:", err.message);
  process.exit(1);
});
