#!/usr/bin/env node
/**
 * Moves every photo stored as a base64 `data:image/...` value out of the
 * database and into the photo store (Cloudflare R2), leaving its public URL
 * in its place (26 Kas 2026; docs/GORSEL-DEPOSU.md).
 *
 * A dry run by default: it scans every text and jsonb column of every table
 * in the `public` schema (inside jsonb: arrays and nested objects too, e.g.
 * `products.images`), compresses each photo the way the store does and
 * reports, per table and column, how many values it found and the size
 * before and after. Nothing is uploaded or written without `--apply`.
 *
 *   DATABASE_URL=postgres://... node scripts/images-to-r2.mjs
 *   DATABASE_URL=postgres://... IMAGES_S3_ENDPOINT=... IMAGES_S3_BUCKET=... \
 *     IMAGES_S3_ACCESS_KEY_ID=... IMAGES_S3_SECRET_ACCESS_KEY=... \
 *     IMAGES_PUBLIC_BASE_URL=https://... node scripts/images-to-r2.mjs --apply
 *
 * Options:
 *   --apply             upload and write (otherwise: report only)
 *   --backup-dir <dir>  where the pre-write dump goes (default: ./backups)
 *   --table <name>      only this table (may repeat)
 *
 * With `--apply`:
 *
 * 1. Every affected table is dumped first (`pg_dump --data-only -t ...`,
 *    custom format) into the backup directory. No dump, no write: the run
 *    stops if pg_dump fails. Restoring one table:
 *    `pg_restore --data-only --clean ...` is NOT what you want (it would
 *    drop); see docs/GORSEL-DEPOSU.md "Geri alma".
 * 2. Every photo is compressed (sharp: EXIF orientation, fits inside
 *    1600 px without enlarging, WebP 80, no metadata; the original is kept
 *    when the WebP would be larger) and uploaded as
 *    `img/<first 16 hex of SHA-256>.webp`. The same photo goes up once.
 * 3. All rows are rewritten in ONE transaction, each only while it still
 *    holds the value that was read (a row the panel saved meanwhile is
 *    listed as skipped and left for the next run).
 *
 * Re-runnable: a value that is already a URL is not a data URL and is never
 * touched; a second run finds nothing, or only what the first one skipped.
 *
 * Afterwards the pages' Data Cache still holds the old values: drop the
 * tags or redeploy (docs/DATABASE.md "Etiket düşürmeyen yazmalar"). The
 * command is printed at the end.
 *
 * Nothing secret is printed: not the connection string, not the keys, not a
 * photo's bytes.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import pg from "pg";
import sharp from "sharp";

import {
  databaseUrlFrom,
  isDatabaseUrlMissing,
} from "../src/lib/db/database-url.mjs";
import { sslConfigFor } from "../src/lib/db/ssl-config.mjs";
import {
  compressImage,
  dataImageBytes,
  imageObjectKey,
  imagePublicUrl,
  imageStoreConfigFrom,
  putImageObject,
} from "../src/lib/images/store-core.mjs";

const DATA_PREFIX = "data:image/";
const TEXT_TYPES = new Set(["text", "character varying", "jsonb", "json"]);
const SKIP_TABLES = new Set(["_migrations"]);

function parseArgs(argv) {
  const out = { apply: false, backupDir: "backups", tables: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--backup-dir") out.backupDir = argv[++i] ?? out.backupDir;
    else if (a === "--table") out.tables.push(argv[++i] ?? "");
    else if (a === "--help" || a === "-h") {
      console.log(
        "Kullanım: DATABASE_URL=... node scripts/images-to-r2.mjs [--apply] [--backup-dir dir] [--table ad]",
      );
      process.exit(0);
    } else {
      console.error(`Bilinmeyen seçenek: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

/** A double-quoted SQL identifier. */
function ident(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function kb(bytes) {
  return `${(bytes / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} kB`;
}

function mb(bytes) {
  return `${(bytes / (1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} MB`;
}

/**
 * Every string inside a JSON value that is a data URL, with a function that
 * returns the value with each replaced (by `map`).
 */
function collectJsonImages(value, found = []) {
  if (typeof value === "string") {
    if (value.startsWith(DATA_PREFIX)) found.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectJsonImages(v, found);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectJsonImages(v, found);
  }
  return found;
}

function replaceJsonImages(value, map) {
  if (typeof value === "string") {
    return value.startsWith(DATA_PREFIX) && map.has(value)
      ? map.get(value)
      : value;
  }
  if (Array.isArray(value)) return value.map((v) => replaceJsonImages(v, map));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, replaceJsonImages(v, map)]),
    );
  }
  return value;
}

async function listColumns(client, onlyTables) {
  const { rows } = await client.query(
    `SELECT c.table_name, c.column_name, c.data_type
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY c.table_name, c.ordinal_position`,
  );
  return rows.filter(
    (r) =>
      TEXT_TYPES.has(r.data_type) &&
      !SKIP_TABLES.has(r.table_name) &&
      (onlyTables.length === 0 || onlyTables.includes(r.table_name)),
  );
}

/** The table's primary-key columns, or [] (then `ctid` identifies the row). */
async function primaryKey(client, table) {
  const { rows } = await client.query(
    `SELECT a.attname
       FROM pg_index i
       JOIN pg_attribute a
         ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
      ORDER BY array_position(i.indkey, a.attnum)`,
    [`public.${ident(table)}`],
  );
  return rows.map((r) => r.attname);
}

/**
 * The rows of one column that hold a data URL: for a text column the value
 * itself, for json(b) any string inside it.
 */
async function findValues(client, col, pk) {
  const keyCols = pk.length ? pk.map(ident).join(", ") : "ctid::text AS ctid";
  const c = ident(col.column_name);
  const isJson = col.data_type === "jsonb" || col.data_type === "json";
  const where = isJson
    ? `${c}::text LIKE '%' || $1 || '%'`
    : `${c} LIKE $1 || '%'`;
  const { rows } = await client.query(
    `SELECT ${keyCols}, ${c}::text AS value FROM public.${ident(col.table_name)} WHERE ${where}`,
    [DATA_PREFIX],
  );
  let embedded = 0;
  if (!isJson) {
    // A text value with a data URL inside it (not the whole value) is not a
    // photo field; it is reported, never rewritten.
    const res = await client.query(
      `SELECT count(*)::int AS n FROM public.${ident(col.table_name)}
        WHERE ${c} LIKE '%' || $1 || '%' AND ${c} NOT LIKE $1 || '%'`,
      [DATA_PREFIX],
    );
    embedded = res.rows[0].n;
  }
  return {
    isJson,
    embedded,
    rows: rows.map((r) => ({
      key: pk.length ? pk.map((k) => r[k]) : [r.ctid],
      value: r.value,
      images: isJson ? collectJsonImages(JSON.parse(r.value)) : [r.value],
    })),
  };
}

function backupTables(url, tables, dir) {
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = resolve(dir, `images-to-r2-${stamp}.dump`);
  const args = [
    "--data-only",
    "--no-owner",
    "--no-privileges",
    "-Fc",
    "-f",
    file,
    ...tables.flatMap((t) => ["-t", `public.${ident(t)}`]),
    url,
  ];
  // libpq reads the custom root from a file. Only when one is set: a
  // publicly signed host (Neon) verifies against the system roots
  // (`sslrootcert=system`, which the connection string may carry itself).
  const env = { ...process.env };
  let caFile = null;
  if (process.env.DATABASE_SSL_CA?.includes("-----BEGIN CERTIFICATE-----")) {
    caFile = join(tmpdir(), `images-to-r2-ca-${process.pid}.pem`);
    writeFileSync(caFile, process.env.DATABASE_SSL_CA, { mode: 0o600 });
    env.PGSSLROOTCERT = caFile;
  } else if (
    /sslmode=verify-(full|ca)/.test(url) &&
    !/sslrootcert=/.test(url)
  ) {
    // `verify-*` with libpq's default root file (~/.postgresql) fails; a
    // publicly signed host verifies against the system roots. Only then:
    // `system` makes libpq require TLS.
    env.PGSSLROOTCERT ??= "system";
  }
  try {
    execFileSync("pg_dump", args, {
      stdio: ["ignore", "inherit", "inherit"],
      env,
    });
  } catch (err) {
    rmSync(file, { force: true });
    throw new Error(
      `pg_dump yedeği alınamadı, hiçbir şey yazılmadı (${err instanceof Error ? err.message.split("\n")[0] : "?"}). pg_dump sürümü sunucununkinden eski olamaz.`,
    );
  } finally {
    if (caFile) rmSync(caFile, { force: true });
  }
  return file;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let url;
  try {
    url = databaseUrlFrom(process.env);
  } catch (err) {
    if (!isDatabaseUrlMissing(err)) throw err;
    console.error(err.message);
    process.exit(1);
  }
  const store = imageStoreConfigFrom(process.env);
  if (args.apply && !store) {
    console.error(
      "--apply için görsel deposu gerekli: IMAGES_S3_ENDPOINT, IMAGES_S3_BUCKET, IMAGES_S3_ACCESS_KEY_ID, IMAGES_S3_SECRET_ACCESS_KEY, IMAGES_PUBLIC_BASE_URL.",
    );
    process.exit(1);
  }

  const { connectionString, ssl } = sslConfigFor(url, process.env);
  const client = new pg.Client({ connectionString, ssl });
  await client.connect();

  try {
    const columns = await listColumns(client, args.tables);
    /** @type {Map<string, string[]>} */
    const pks = new Map();
    const found = [];
    for (const col of columns) {
      if (!pks.has(col.table_name)) {
        pks.set(col.table_name, await primaryKey(client, col.table_name));
      }
      const result = await findValues(client, col, pks.get(col.table_name));
      if (result.rows.length || result.embedded) found.push({ col, ...result });
    }

    // Compress every distinct photo once.
    /** @type {Map<string, { body: Buffer, contentType: string, ext: string, key: string, kept: boolean, before: number }>} */
    const compressed = new Map();
    const unreadable = new Set();
    for (const f of found) {
      for (const row of f.rows) {
        for (const value of row.images) {
          if (compressed.has(value) || unreadable.has(value)) continue;
          const bytes = dataImageBytes(value);
          if (!bytes) {
            unreadable.add(value);
            continue;
          }
          try {
            const out = await compressImage(sharp, bytes);
            compressed.set(value, {
              ...out,
              key: imageObjectKey(out.body, out.ext),
              before: bytes.length,
            });
          } catch {
            unreadable.add(value);
          }
        }
      }
    }

    // The report.
    console.log(
      args.apply
        ? "UYGULAMA"
        : "KURU ÇALIŞTIRMA (yazma yok; --apply ile yazar)",
    );
    console.log("");
    let totalBefore = 0;
    let totalAfter = 0;
    let totalValues = 0;
    let totalBytesBefore = 0;
    let totalBytesAfter = 0;
    // Without the store's address the URL's length is estimated (a 40
    // character base, e.g. https://pub-<32 hex>.r2.dev).
    const urlLength = store
      ? (key) => imagePublicUrl(store.publicBaseUrl, key).length
      : (key) => 40 + 1 + key.length;
    for (const f of found) {
      const values = f.rows.reduce((n, r) => n + r.images.length, 0);
      const before = f.rows.reduce(
        (n, r) => n + r.images.reduce((m, v) => m + v.length, 0),
        0,
      );
      const after = f.rows.reduce(
        (n, r) =>
          n +
          r.images.reduce((m, v) => {
            const c = compressed.get(v);
            return m + (c ? urlLength(c.key) : v.length);
          }, 0),
        0,
      );
      const bytesBefore = f.rows.reduce(
        (n, r) =>
          n +
          r.images.reduce((m, v) => m + (compressed.get(v)?.before ?? 0), 0),
        0,
      );
      const bytesAfter = f.rows.reduce(
        (n, r) =>
          n +
          r.images.reduce(
            (m, v) => m + (compressed.get(v)?.body.length ?? 0),
            0,
          ),
        0,
      );
      totalBefore += before;
      totalAfter += after;
      totalValues += values;
      totalBytesBefore += bytesBefore;
      totalBytesAfter += bytesAfter;
      const name = `${f.col.table_name}.${f.col.column_name}`;
      console.log(
        `${name.padEnd(40)} ${String(f.rows.length).padStart(4)} satır ${String(values).padStart(4)} görsel  veritabanında ${mb(before).padStart(9)} → ${kb(after).padStart(9)}   dosya ${mb(bytesBefore)} → ${mb(bytesAfter)}`,
      );
      if (f.embedded) {
        console.log(
          `  ! ${f.embedded} değerin İÇİNDE data:image var (değerin tamamı değil): dokunulmadı, elle bak.`,
        );
      }
    }
    if (found.length === 0) console.log("data:image/ değeri bulunamadı.");
    console.log("");
    console.log(
      `Toplam: ${totalValues} görsel (${compressed.size} farklı), veritabanında ${mb(totalBefore)} → ${kb(totalAfter)}; dosyalar ${mb(totalBytesBefore)} → ${mb(totalBytesAfter)}.`,
    );
    const kept = [...compressed.values()].filter((c) => c.kept).length;
    if (kept)
      console.log(
        `${kept} görselde WebP daha büyük çıktı: orijinal biçim korunur.`,
      );
    if (unreadable.size) {
      console.log(
        `${unreadable.size} değer okunamadı (bozuk ya da desteklenmeyen): dokunulmaz.`,
      );
    }

    if (!args.apply) return;
    const targets = found.filter((f) => f.rows.length > 0);
    if (targets.length === 0) return;

    // 1. Backup.
    const tables = [...new Set(targets.map((f) => f.col.table_name))];
    console.log("");
    console.log(`Yedek: ${tables.join(", ")} ...`);
    const file = backupTables(url, tables, args.backupDir);
    console.log(`Yedek yazıldı: ${file}`);

    // 2. Upload.
    /** @type {Map<string, string>} */
    const urls = new Map();
    let uploaded = 0;
    for (const [value, c] of compressed) {
      const put = await putImageObject(store, c);
      if (put.uploaded) uploaded += 1;
      urls.set(value, put.url);
    }
    console.log(
      `Depo: ${uploaded} dosya yüklendi, ${compressed.size - uploaded} zaten vardı.`,
    );

    // 3. One transaction for every row; a row changed meanwhile is skipped.
    let written = 0;
    let skipped = 0;
    await client.query("BEGIN");
    try {
      for (const f of targets) {
        const pk = pks.get(f.col.table_name);
        const c = ident(f.col.column_name);
        const keyWhere = pk.length
          ? pk.map((k, i) => `${ident(k)}::text = $${i + 3}`).join(" AND ")
          : "ctid::text = $3";
        const cast = f.isJson ? `::${f.col.data_type}` : "";
        for (const row of f.rows) {
          let next;
          if (f.isJson) {
            next = JSON.stringify(
              replaceJsonImages(JSON.parse(row.value), urls),
            );
          } else {
            next = urls.get(row.value);
          }
          if (!next || next === row.value) continue;
          const res = await client.query(
            `UPDATE public.${ident(f.col.table_name)} SET ${c} = $1${cast}
              WHERE ${keyWhere} AND ${c}::text = $2`,
            [next, row.value, ...row.key.map((k) => String(k))],
          );
          if (res.rowCount === 1) written += 1;
          else skipped += 1;
        }
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
    console.log(
      `Yazıldı: ${written} satır.${skipped ? ` ${skipped} satır bu arada değişti, atlandı (yeniden çalıştır).` : ""}`,
    );
    console.log("");
    console.log("Şimdi önbellek etiketlerini düşür (ya da yeniden deploy et):");
    console.log(
      "  vercel cache dangerously-delete --tag pub:catalog,pub:menu,pub:site,live:venue,live:orders,live:karaoke,live:invoices,live:access --yes",
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // The class and message only: a pg error can quote a value, never a photo
  // here (values go as parameters), but the connection string is never in it.
  console.error(
    `[images-to-r2] ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
  );
  process.exit(1);
});
