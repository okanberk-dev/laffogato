#!/usr/bin/env node
/**
 * public/icon-192.png and public/icon-512.png - the JSON-LD logo
 * (src/lib/seo/structured-data.ts). The PWA manifest installs the app's own
 * icon from public/brand since 25 Eyl 2026; these two are the same picture,
 * flat: the L'Af mark in cream (#fbf8f4) with its bean in brass (#e8c877)
 * on the house green (#1d6d56) - lafmobil's icon, and globals.css :root
 * since the site took the app's palette. They used to be the cream mark on
 * the Köşk green #143d2b.
 *
 * The ground is full bleed and the mark sits inside the maskable safe zone
 * (a centred circle whose diameter is 80% of the icon), so a launcher that
 * crops the square to a circle or a squircle never cuts a letter.
 *
 * Source: the vector mark in public/brand (laf-letters.svg + laf-bean.svg,
 * the two layers <LafMark> paints), so the icons stay sharp at any size and
 * match the header exactly.
 *
 * Run: node scripts/gen-icons.mjs   (sharp ships with next; no extra install)
 * tests/brand-theme.test.ts reads the committed PNGs' pixels, so a stale or
 * hand-edited icon fails there.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

const ROOT = process.cwd();
const BRAND = join(ROOT, "public", "brand");

/** --green / --brand in globals.css. */
const GROUND = "#1d6d56";
/** The mark's cream (the app icon's letters). */
const INK = "#fbf8f4";
/** --gold-soft, the brass bean. */
const BEAN = "#e8c877";

/** The one path out of each layer file. */
function pathOf(file) {
  const svg = readFileSync(join(BRAND, file), "utf8");
  const d = /\sd="([^"]+)"/.exec(svg)?.[1];
  if (!d) throw new Error(`no path in ${file}`);
  const box = /viewBox="([^"]+)"/.exec(svg)?.[1];
  return { d, box };
}

/**
 * The mark's width as a share of the icon. The maskable safe zone is a
 * circle of radius 0.4 * size; the mark's box (1035 x 846) has to fit
 * inside it, which caps the width near 0.62. 0.56 leaves a margin.
 */
const MARK_WIDTH = 0.56;

async function icon(size) {
  const letters = pathOf("laf-letters.svg");
  const bean = pathOf("laf-bean.svg");
  const [, , vbW, vbH] = letters.box.split(/\s+/).map(Number);
  const w = size * MARK_WIDTH;
  const h = (w * vbH) / vbW;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="100%" height="100%" fill="${GROUND}"/>
  <svg x="${(size - w) / 2}" y="${(size - h) / 2}" width="${w}" height="${h}" viewBox="${letters.box}">
    <path fill-rule="evenodd" fill="${INK}" d="${letters.d}"/>
    <path fill-rule="evenodd" fill="${BEAN}" d="${bean.d}"/>
  </svg>
</svg>`;
  const out = join(ROOT, "public", `icon-${size}.png`);
  await sharp(Buffer.from(svg), { density: 72 })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`wrote ${out} (mark ${Math.round(w)}x${Math.round(h)})`);
}

await icon(192);
await icon(512);
