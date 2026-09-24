#!/usr/bin/env node
/**
 * Picks the scene family (`backdrop`) and the cutout flag (`photoCutout`) for
 * photos that were stored before the panel picked them on upload (glass
 * round, docs/API-MOBILE.md §1 "backdrop · photoCutout · vessel").
 *
 * A dry run by default: it reads every menu item and shop product that has a
 * photo, runs the same pick the panel runs (`src/lib/backdrop/pick.ts`, with
 * the row's own `hue` / `img` as the prior) and prints what it would write.
 * Nothing is written without `--apply`. A row whose scene the operator chose
 * by hand (`"backdropSource" = 'manual'`) is never touched, not even its
 * cutout flag: the panel measures that on every save.
 *
 *   DATABASE_URL=postgres://... node scripts/backfill-backdrops.mjs
 *   DATABASE_URL=postgres://... node scripts/backfill-backdrops.mjs --apply
 *
 * Photos are read from the row itself (uploaded data URLs) or from this
 * checkout's `public/` (a site-relative path such as `/menu/x.webp`). An
 * admin-pasted `https://` photo is skipped unless `--remote` is given; then
 * it is downloaded (15 s and 5 MB at most each).
 *
 * `updatedAt` is left alone: this is not an edit of the item, and the menu's
 * own ETag already changes with the body. The app sees the new fields within
 * the menu's CDN window (300 s, §1).
 */

import { build } from "esbuild";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import pg from "pg";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = join(ROOT, "public");

const REMOTE_TIMEOUT_MS = 15_000;
const REMOTE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * The pick and the connection rules are TypeScript with path aliases, and
 * this repo has no TS script runner: they are bundled to a temp module and
 * imported, as `legal-export.mjs` does. Sharing `poolConfig` keeps the TLS
 * rules in one place instead of a third copy (db-migrate.mjs has the second).
 */
async function loadModules() {
  const outfile = join(ROOT, ".backfill-backdrops.tmp.mjs");
  await build({
    stdin: {
      contents: [
        'export { poolConfig } from "@/lib/db";',
        'export { backdropFromImage } from "@/lib/backdrop/from-image";',
        'export { BACKDROP_ALGO_VERSION } from "@/lib/backdrop/families";',
      ].join("\n"),
      resolveDir: ROOT,
      sourcefile: "backfill-entry.ts",
      loader: "ts",
    },
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
    alias: { "@": join(ROOT, "src") },
    // Native and driver packages load from node_modules as they are.
    external: ["sharp", "pg"],
    plugins: [
      {
        // `server-only` throws outside a React server build; a script is a
        // server, so it becomes an empty module here.
        name: "server-only-stub",
        setup(b) {
          b.onResolve({ filter: /^server-only$/ }, () => ({
            path: "server-only",
            namespace: "stub",
          }));
          b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
            contents: "export {};",
          }));
        },
      },
    ],
  });
  try {
    return await import(pathToFileURL(outfile).href);
  } finally {
    rmSync(outfile, { force: true });
  }
}

/**
 * A site-relative photo path → the file under `public/`, or null when it is
 * missing or would resolve outside `public/`.
 */
export function publicFile(stored, publicDir = PUBLIC_DIR) {
  if (typeof stored !== "string" || !stored.startsWith("/")) return null;
  const path = stored.split(/[?#]/)[0];
  const file = normalize(join(publicDir, path));
  if (!file.startsWith(publicDir + sep)) return null;
  return file;
}

/**
 * What to write for one row, or null when nothing changes (or the row must
 * not be touched).
 *
 * `row` is the stored state, `found` what `backdropFromImage` returned.
 */
export function nextValues(row, found) {
  if (row.source !== "auto" || !found) return null;
  const next = {
    backdrop: found.pick.family,
    hex: found.pick.hex,
    cutout: found.photoCutout,
  };
  const same =
    (row.backdrop ?? null) === next.backdrop &&
    (row.hex ?? null) === next.hex &&
    row.cutout === next.cutout;
  return same ? null : next;
}

const TARGETS = [
  {
    label: "menü",
    table: "menu_items",
    select: `select id, name, hue, "categoryKey" as category, image,
                    backdrop, "backdropSource" as source,
                    "backdropHex" as hex, "photoCutout" as cutout
               from public.menu_items
              where image <> ''
              order by id`,
  },
  {
    label: "mağaza",
    table: "products",
    // The product's scene columns describe its first photo.
    select: `select id, name, img as hue, cat as category, images->>0 as image,
                    backdrop, "backdropSource" as source,
                    "backdropHex" as hex, "photoCutout" as cutout
               from public.products
              where jsonb_typeof(images) = 'array'
                and coalesce(images->>0, '') <> ''
              order by id`,
  },
];

async function readPhoto(stored, remote) {
  if (stored.startsWith("data:")) return { bytes: stored };
  if (stored.startsWith("/")) {
    const file = publicFile(stored);
    return file && existsSync(file)
      ? { bytes: readFileSync(file) }
      : { skip: "dosya yok" };
  }
  if (/^https?:\/\//i.test(stored)) {
    if (!remote) return { skip: "dış adres (--remote)" };
    try {
      const res = await fetch(stored, {
        signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS),
      });
      const length = Number(res.headers.get("content-length") ?? 0);
      if (!res.ok || length > REMOTE_MAX_BYTES) {
        return { skip: `indirilemedi (${res.status})` };
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      return bytes.length > REMOTE_MAX_BYTES
        ? { skip: "çok büyük" }
        : { bytes };
    } catch (err) {
      return { skip: `indirilemedi (${err.name})` };
    }
  }
  return { skip: "tanınmayan değer" };
}

const cell = (value, width) => {
  const text = value === null || value === undefined ? "-" : String(value);
  return text.length > width
    ? `${text.slice(0, width - 1)}…`
    : text.padEnd(width);
};

async function main() {
  const apply = process.argv.includes("--apply");
  const remote = process.argv.includes("--remote");
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error(
      "DATABASE_URL yok. Örnek:\n  DATABASE_URL='postgres://...' node scripts/backfill-backdrops.mjs [--apply] [--remote]",
    );
    process.exit(1);
  }

  const { poolConfig, backdropFromImage, BACKDROP_ALGO_VERSION } =
    await loadModules();
  const pool = new pg.Pool(poolConfig(url));

  const counts = { read: 0, change: 0, same: 0, manual: 0, skipped: 0 };
  try {
    console.log(
      `Sahne seçimi, algoritma ${BACKDROP_ALGO_VERSION} - ${apply ? "YAZILIYOR" : "kuru koşu"}\n`,
    );
    console.log(
      [
        cell("tablo", 7),
        cell("id", 10),
        cell("ad", 28),
        cell("hue", 13),
        cell("önce", 11),
        cell("sonra", 11),
        cell("neden", 10),
        cell("renk", 8),
        cell("uzaklık", 8),
        "dekupe",
      ].join(" "),
    );

    for (const target of TARGETS) {
      const { rows } = await pool.query(target.select);
      for (const row of rows) {
        counts.read += 1;
        const base = [
          cell(target.label, 7),
          cell(row.id, 10),
          cell(row.name, 28),
          cell(row.hue, 13),
          cell(row.backdrop, 11),
        ];
        if (row.source !== "auto") {
          counts.manual += 1;
          console.log(
            [...base, cell("elle seçildi, dokunulmadı", 40)].join(" "),
          );
          continue;
        }
        const photo = await readPhoto(row.image, remote);
        const found = photo.bytes
          ? await backdropFromImage(photo.bytes, {
              hue: row.hue,
              category: row.category,
            })
          : null;
        if (!found) {
          counts.skipped += 1;
          console.log(
            [...base, cell(`atlandı: ${photo.skip ?? "okunamadı"}`, 40)].join(
              " ",
            ),
          );
          continue;
        }
        const next = nextValues(row, found);
        console.log(
          [
            ...base,
            cell(found.pick.family, 11),
            cell(found.pick.reason, 10),
            cell(found.pick.hex, 8),
            cell(found.pick.distance?.toFixed(3), 8),
            found.photoCutout ? "evet" : "hayır",
          ].join(" "),
        );
        if (!next) {
          counts.same += 1;
          continue;
        }
        counts.change += 1;
        if (apply) {
          // The source guard is repeated in SQL: an operator who chooses a
          // scene by hand while this runs keeps the choice.
          await pool.query(
            `update public.${target.table}
                set backdrop = $2, "backdropHex" = $3, "photoCutout" = $4
              where id = $1 and "backdropSource" = 'auto'`,
            [row.id, next.backdrop, next.hex, next.cutout],
          );
        }
      }
    }
  } finally {
    await pool.end();
  }

  console.log(
    `\n${counts.read} satır okundu · ${counts.change} ${apply ? "güncellendi" : "değişecek"} · ${counts.same} aynı · ${counts.manual} elle seçilmiş (dokunulmadı) · ${counts.skipped} atlandı`,
  );
  if (!apply && counts.change > 0) {
    console.log("Kuru koşu: hiçbir şey yazılmadı. Yazmak için --apply ekle.");
  }
}

// Run only as a script, so the helpers above can be imported by tests.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((err) => {
    console.error("Sahne seçimi başarısız:", err.message);
    process.exit(1);
  });
}
