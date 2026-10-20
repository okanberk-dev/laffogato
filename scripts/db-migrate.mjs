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

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "db",
  "migrations",
);

// src/lib/db/index.ts poolConfig() ile AYNI kurallar. Bu betik TS modülünü
// import edemediği için mantık burada tekrarlanır; iki yer ayrışırsa runbook'un
// ilk canlı adımı (pooler'a migrate) sessizce bozulur - değişiklik ikisine
// birden yapılır. (Ölçülmüş gerçek: Supabase uçları kendi kök CA'sını sunar ve
// düz metin oturumu kabul eder; bkz. docs/SUPABASE-GECIS.md §2b.)
function sslFor(connectionString) {
  let sslmode = "";
  let host = "";
  try {
    const url = new URL(connectionString);
    // postgresql: "özel olmayan" şema - WHATWG host'u küçültmez, biz küçültürüz.
    host = url.hostname.toLowerCase();
    sslmode = url.searchParams.get("sslmode") ?? "";
  } catch {
    sslmode = /sslmode=([a-z-]+)/.exec(connectionString)?.[1] ?? "";
  }
  const supabaseHost =
    host.endsWith(".supabase.co") || host.endsWith(".pooler.supabase.com");
  const wantsSsl = (sslmode !== "" && sslmode !== "disable") || supabaseHost;
  if (!wantsSsl) return undefined;
  const ca = process.env.DATABASE_SSL_CA;
  const caOk = ca && ca.includes("-----BEGIN CERTIFICATE-----");
  if (ca && !caOk) {
    console.error("[db:migrate] DATABASE_SSL_CA PEM görünmüyor — yok sayılıyor");
  }
  return {
    rejectUnauthorized: true,
    ...(supabaseHost && caOk ? { ca } : {}),
  };
}

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
