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

import { neon } from "@neondatabase/serverless";

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "db",
  "migrations",
);

/**
 * Splits a migration file into individual statements.
 *
 * A naive split on ";" corrupts PL/pgSQL bodies, which contain semicolons
 * inside `$$ ... $$`. This tracks dollar-quoted strings, ordinary quotes and
 * comments so function definitions survive intact.
 */
export function splitStatements(sql) {
  const statements = [];
  let current = "";
  let i = 0;

  while (i < sql.length) {
    const rest = sql.slice(i);

    // Line comment
    if (rest.startsWith("--")) {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end + 1;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // Block comment
    if (rest.startsWith("/*")) {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // Single-quoted string
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") break;
        else j += 1;
      }
      current += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    // Dollar-quoted string: $$ ... $$ or $tag$ ... $tag$
    const dollar = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(rest);
    if (dollar) {
      const tag = dollar[0];
      const end = sql.indexOf(tag, i + tag.length);
      const stop = end === -1 ? sql.length : end + tag.length;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }

    if (sql[i] === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      i += 1;
      continue;
    }

    current += sql[i];
    i += 1;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
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

  const sql = neon(url, { fullResults: true });

  await sql.query(
    `create table if not exists public._migrations (
       name       text primary key,
       applied_at timestamptz not null default now()
     )`,
  );

  const applied = new Set(
    (await sql.query("select name from public._migrations")).rows.map(
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
    const statements = splitStatements(
      readFileSync(join(MIGRATIONS_DIR, file), "utf8"),
    );
    // One transaction per file, so a failure cannot leave it half-applied.
    await sql.transaction([
      ...statements.map((s) => sql.query(s)),
      sql.query("insert into public._migrations (name) values ($1)", [file]),
    ]);
    console.log(`✓ ${file} (${statements.length} ifade)`);
    ran += 1;
  }

  console.log(
    ran === 0
      ? "Veritabanı zaten güncel."
      : `${ran} migration uygulandı, veritabanı hazır.`,
  );
}

// Only run when invoked directly, so the splitter stays importable for tests.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  main().catch((err) => {
    console.error("Migration başarısız:", err.message);
    process.exit(1);
  });
}
