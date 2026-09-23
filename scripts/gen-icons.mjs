#!/usr/bin/env node
/**
 * public/icon-192.png and public/icon-512.png - the PWA manifest icons
 * (src/app/manifest.ts) and the JSON-LD logo (src/lib/seo/structured-data.ts).
 *
 * Both used to show the retired espresso "L" on cream, long after the nav,
 * the e-mails and the rest of the site moved to the L'Af monogram on the
 * house green. They are now drawn from the monogram's alpha mask, tinted
 * the way the e-mail's dark band shows it: --hero-cream #faf6ee on --brand
 * #143d2b (globals.css; O26 default (a): the site keeps its own palette).
 *
 * The ground is full bleed and the mark sits inside the maskable safe zone
 * (a centred circle whose diameter is 80% of the icon), so a launcher that
 * crops the square to a circle or a squircle never cuts a letter.
 *
 * Mask source: public/email/logo-laf-cream.png - the same letterforms as
 * public/logo-mark.png (the CSS mask) but at 600 px instead of 256, which
 * keeps the 512 icon sharp. Only its alpha channel is used.
 *
 * Run: node scripts/gen-icons.mjs   (sharp ships with next; no extra install)
 * tests/brand-theme.test.ts reads the committed PNGs' pixels, so a stale or
 * hand-edited icon fails there.
 */

import { join } from "node:path";

import sharp from "sharp";

const ROOT = process.cwd();
const MASK = join(ROOT, "public", "email", "logo-laf-cream.png");

/** --brand / --bg-espresso in globals.css. */
const GROUND = { r: 0x14, g: 0x3d, b: 0x2b };
/** --hero-cream in globals.css; the e-mail's cream lockup is this colour. */
const INK = { r: 0xfa, g: 0xf6, b: 0xee };

/**
 * The mark's width as a share of the icon. The maskable safe zone is a
 * circle of radius 0.4 * size; the mark's bounding box (600 x 486) has to
 * fit inside it, which caps the width near 0.62. 0.56 leaves a margin.
 */
const MARK_WIDTH = 0.56;

async function markMask(width) {
  // The lockup's interior alpha is 254, not 255; stretch it so the letters
  // are fully opaque cream rather than 99.6% cream over green.
  return sharp(MASK)
    .ensureAlpha()
    .extractChannel("alpha")
    .resize({ width, kernel: "lanczos3" })
    .linear(255 / 254, 0)
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
}

async function icon(size) {
  const width = Math.round(size * MARK_WIDTH);
  const { data: alpha, info } = await markMask(width);

  // A solid cream plate the size of the mark, cut out by the mask.
  const plate = await sharp({
    create: {
      width: info.width,
      height: info.height,
      channels: 3,
      background: INK,
    },
  })
    .joinChannel(alpha, {
      raw: { width: info.width, height: info.height, channels: 1 },
    })
    .png()
    .toBuffer();

  const out = join(ROOT, "public", `icon-${size}.png`);
  await sharp({
    create: { width: size, height: size, channels: 3, background: GROUND },
  })
    .composite([
      {
        input: plate,
        left: Math.round((size - info.width) / 2),
        top: Math.round((size - info.height) / 2),
      },
    ])
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`wrote ${out} (mark ${info.width}x${info.height})`);
}

await icon(192);
await icon(512);
