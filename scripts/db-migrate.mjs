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

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "db",
  "migrations",
);

function sslFor(connectionString) {
  let sslmode = "";
  try {
    sslmode = new URL(connectionString).searchParams.get("sslmode") ?? "";
  } catch {
    sslmode = /sslmode=([a-z-]+)/.exec(connectionString)?.[1] ?? "";
  }
  return sslmode !== "" && sslmode !== "disable"
    ? { rejectUnauthorized: true }
    : undefined;
}

async function main() {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.NEON_DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL yok. Örnek:\n  DATABASE_URL='postgres://...' npm run db:migrate",
    );
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url, ssl: sslFor(url) });
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
        await client.query(
          "insert into public._migrations (name) values ($1)",
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
