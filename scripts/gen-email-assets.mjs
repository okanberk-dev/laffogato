#!/usr/bin/env node
/**
 * public/email/* - the e-mail templates' fixed images (22 Kas 2026,
 * operator: "mail tasarımlarını da siteyle aynı yap", then "renkleri de
 * yeşilimsi yap bizim renkler gibi").
 *
 * The mails take the site's language (white card, square corners, no
 * gradients) in the brand's colours: a sage band #f2f5f1, deep forest green
 * #173f35 for every filled control and dark block, the logo's brass. Their
 * pictures follow:
 *
 *   laf-mark-white.png      the L'Af mark alone, white with its brass bean
 *                           (#cba258), on transparency: the masthead on
 *                           top of every mail and the footer's mark, both
 *                           on the deep green. It only ever sits on green,
 *                           which no client's dark mode turns light, so it
 *                           needs no ground of its own (and a ground would
 *                           show as a box wherever a client shifts the
 *                           green by a shade).
 *   check-success.png       the payment badge: --success disc, white tick
 *                           (the site's .order-done-badge).
 *   stamp-sq-{full,empty}   the stamp card's cells on a green panel, as
 *                           the account page draws them (.stamp): a sage
 *                           square with the brass bean, or a dashed outline.
 *   icons/<name>-ink.png    a sage square with a green line icon, for light
 *                           surfaces (opaque for the same Gmail reason).
 *   icons/<name>-white.png  a white line icon on transparency, for the green
 *                           blocks and as the dark-mode twin.
 *
 * The icons are Lucide's (ISC, already a dependency through the admin
 * panel), drawn at the site's icon weight (1.3-1.5 stroke on 24).
 * Earlier images (logo-laf-tile, icons/*-{cream,espresso,gold,hero}, beans,
 * stamps, check-badge) stay on disk: e-mails already sent still link them.
 *
 * Run: node scripts/gen-email-assets.mjs   (sharp ships with next)
 */

import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

const ROOT = process.cwd();
const BRAND = join(ROOT, "public", "brand");
const OUT = join(ROOT, "public", "email");
const LUCIDE = join(
  ROOT,
  "node_modules",
  "lucide-react",
  "dist",
  "esm",
  "icons",
);

/** Deep forest green: buttons, dark blocks, footer, the logo tile. */
const GREEN = "#173f35";
/** Sage band: panels and the light icon tiles. */
const BAND = "#f2f5f1";
/** Line icons on light grounds are drawn in the green. */
const INK = GREEN;
const WHITE = "#ffffff";
const SUCCESS = "#1f6b4a";
/** The bean on the green (4.91:1) and on light grounds. */
const BEAN_ON_DARK = "#cba258";
const BEAN_ON_LIGHT = "#b8893a";

function pathOf(file) {
  const svg = readFileSync(join(BRAND, file), "utf8");
  const d = /\sd="([^"]+)"/.exec(svg)?.[1];
  const box = /viewBox="([^"]+)"/.exec(svg)?.[1];
  if (!d || !box) throw new Error(`no path in ${file}`);
  return { d, box };
}

async function png(svg, file, { opaque = true } = {}) {
  let img = sharp(Buffer.from(svg), { density: 72 });
  if (opaque) img = img.removeAlpha();
  await img.png({ compressionLevel: 9 }).toFile(join(OUT, file));
  console.log(`wrote public/email/${file}`);
}

/** The mark centred in a square, `share` of the side wide. */
/** The mark alone, `height` tall, on transparency. */
function markSvg(height, { letters, bean }) {
  const l = pathOf("laf-letters.svg");
  const b = pathOf("laf-bean.svg");
  const [, , vbW, vbH] = l.box.split(/\s+/).map(Number);
  const width = Math.round((height * vbW) / vbH);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${l.box}">
  <path fill-rule="evenodd" fill="${letters}" d="${l.d}"/>
  <path fill-rule="evenodd" fill="${bean}" d="${b.d}"/>
</svg>`;
}

/** Lucide's node list for one icon, as SVG children. */
async function lucideNodes(name) {
  const mod = await import(pathToFileURL(join(LUCIDE, `${name}.mjs`)).href);
  const nodes = mod.__iconData?.node;
  if (!nodes) throw new Error(`no lucide icon ${name}`);
  return nodes
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k]) => k !== "key")
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      return `<${tag} ${a}/>`;
    })
    .join("");
}

function iconSvg(
  size,
  children,
  { ground, stroke, glyph = 0.5, weight = 1.5 },
) {
  const g = size * glyph;
  const off = (size - g) / 2;
  const bg = ground
    ? `<rect width="100%" height="100%" fill="${ground}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  ${bg}
  <svg x="${off}" y="${off}" width="${g}" height="${g}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${weight}" stroke-linecap="square" stroke-linejoin="miter">${children}</svg>
</svg>`;
}

/** File name in the templates -> Lucide icon. */
const ICONS = {
  bell: "bell",
  calendar: "calendar",
  card: "credit-card",
  check: "check",
  clock: "clock",
  cup: "coffee",
  gift: "gift",
  mail: "mail",
  phone: "phone",
  pin: "map-pin",
  qr: "qr-code",
  receipt: "receipt",
  scooter: "scooter",
  star: "star",
  store: "store",
  tag: "tag",
  users: "users",
  mic: "mic-vocal",
};

mkdirSync(join(OUT, "icons"), { recursive: true });

// The masthead and footer mark: 3x of the 44 px height it is printed at
// (54 x 44 in the masthead, 39 x 32 in the footer).
await png(
  markSvg(132, { letters: WHITE, bean: BEAN_ON_DARK }),
  "laf-mark-white.png",
  { opaque: false },
);

// Payment badge: 2x of 56 px, a disc on transparency.
{
  const tick = await lucideNodes("check");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112">
  <circle cx="56" cy="56" r="56" fill="${SUCCESS}"/>
  <svg x="32" y="32" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${WHITE}" stroke-width="2" stroke-linecap="square">${tick}</svg>
</svg>`;
  await png(svg, "check-success.png", { opaque: false });
}

// Stamp cells: 96 px for 40 px, green around so they sit on the panel.
{
  // The bean alone, cropped to its own box (its file shares the mark's
  // viewBox), then set 48 px tall in the middle of a band square.
  const b = pathOf("laf-bean.svg");
  const beanOnly = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1035" height="846" viewBox="${b.box}"><path fill-rule="evenodd" fill="${BEAN_ON_LIGHT}" d="${b.d}"/></svg>`,
    ),
  )
    .trim()
    .resize({ height: 48 })
    .png()
    .toBuffer();
  const meta = await sharp(beanOnly).metadata();
  await sharp({
    create: { width: 96, height: 96, channels: 3, background: BAND },
  })
    .composite([
      {
        input: beanOnly,
        left: Math.round((96 - (meta.width ?? 0)) / 2),
        top: 24,
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, "stamp-sq-full.png"));
  console.log("wrote public/email/stamp-sq-full.png");
  const empty = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">
  <rect width="96" height="96" fill="${GREEN}"/>
  <rect x="2" y="2" width="92" height="92" fill="none" stroke="#8fa89c" stroke-width="3" stroke-dasharray="8 6"/>
</svg>`;
  await png(empty, "stamp-sq-empty.png");
}

for (const [file, lucide] of Object.entries(ICONS)) {
  const nodes = await lucideNodes(lucide);
  await png(
    iconSvg(96, nodes, { ground: BAND, stroke: INK, weight: 1.4 }),
    `icons/${file}-ink.png`,
  );
  await png(
    iconSvg(96, nodes, { ground: null, stroke: WHITE, weight: 1.4 }),
    `icons/${file}-white.png`,
    { opaque: false },
  );
}
