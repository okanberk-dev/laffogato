#!/usr/bin/env node
/**
 * Puts a photograph into a guide in the house look (docs/SEO.md "Rehber
 * fotoğrafları"), so every guide reads as one series whoever took the
 * picture: 3:2 around the point of interest, a gentle S-curve, matte blacks,
 * shadows toned toward the brand's cocoa (rgba(59, 42, 30)), highlights
 * toward the porcelain cream, a soft vignette, WebP. The credit travels
 * inside the file as XMP (IPTC Creator, Credit Line, Web Statement), which
 * Google Images shows next to the picture.
 *
 *   node scripts/guide-photo.mjs <photo> <slug>                        our own photograph
 *   node scripts/guide-photo.mjs <photo> <slug> --unsplash "Ad Soyad"  a stock photograph
 *   node scripts/guide-photo.mjs <photo> <slug> --crop left,top,width,height
 *
 * Writes public/rehber/<slug>.webp: 1600 x 1067, or 1200 x 800 when the
 * photograph (or its crop) is narrower than 1600 px. The guide's `image`
 * keeps the same path; our own photograph drops `credit`.
 */
import sharp from "sharp";

const SHADOW = [59 / 255, 42 / 255, 30 / 255];
const CREAM = [1, 0.965, 0.905];

function usage() {
  console.error(
    'usage: node scripts/guide-photo.mjs <photo> <slug> [--unsplash "Ad Soyad"] [--crop left,top,width,height]',
  );
  process.exit(1);
}

function parseArgs(argv) {
  const [input, slug, ...rest] = argv;
  if (!input || !slug || !/^[a-z0-9-]+$/.test(slug)) usage();
  let unsplash = null;
  let crop = null;
  for (let i = 0; i < rest.length; i += 2) {
    const value = rest[i + 1];
    if (!value) usage();
    if (rest[i] === "--unsplash") unsplash = value;
    else if (rest[i] === "--crop") {
      const n = value.split(",").map(Number);
      if (n.length !== 4 || n.some((x) => !Number.isInteger(x) || x < 0))
        usage();
      crop = { left: n[0], top: n[1], width: n[2], height: n[3] };
    } else usage();
  }
  return { input, slug, unsplash, crop };
}

const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function grade(data, width, height, channels) {
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const v = [0, 0, 0];
  for (let y = 0; y < height; y++) {
    const dy = (y - cy) / cy;
    for (let x = 0; x < width; x++) {
      const dx = (x - cx) / cx;
      const vignette = 1 - 0.11 * smoothstep(0.35, 2, dx * dx + dy * dy);
      const i = (y * width + x) * channels;
      for (let c = 0; c < 3; c++) {
        const p = data[i + c] / 255;
        const s = p + 0.2 * (p * p * (3 - 2 * p) - p);
        v[c] = 0.04 + s * (0.975 - 0.04);
      }
      const lum = 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
      const toShadow = 0.18 * (1 - lum) * (1 - lum);
      const toCream = 0.1 * lum * lum;
      for (let c = 0; c < 3; c++) {
        const o =
          (v[c] + toShadow * (SHADOW[c] - v[c]) + toCream * (CREAM[c] - v[c])) *
          vignette;
        data[i + c] = Math.max(0, Math.min(255, Math.round(o * 255)));
      }
    }
  }
}

const esc = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function xmp(unsplash) {
  const creator = unsplash ?? "L'Affogato";
  const credit = unsplash ? `${unsplash} / Unsplash` : "L'Affogato, Tuzla";
  return [
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    '  <rdf:Description rdf:about=""',
    '    xmlns:dc="http://purl.org/dc/elements/1.1/"',
    '    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"',
    '    xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"',
    unsplash
      ? `    photoshop:Credit="${esc(credit)}"\n    xmpRights:WebStatement="https://unsplash.com/license">`
      : `    photoshop:Credit="${esc(credit)}">`,
    `   <dc:creator><rdf:Seq><rdf:li>${esc(creator)}</rdf:li></rdf:Seq></dc:creator>`,
    ...(unsplash
      ? [
          '   <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">Unsplash License</rdf:li></rdf:Alt></dc:rights>',
        ]
      : []),
    "  </rdf:Description>",
    " </rdf:RDF>",
    "</x:xmpmeta>",
    '<?xpacket end="w"?>',
  ].join("\n");
}

async function main() {
  const { input, slug, unsplash, crop } = parseArgs(process.argv.slice(2));
  let img = sharp(input).rotate();
  if (crop) img = img.extract(crop);
  const sourceWidth = crop?.width ?? (await sharp(input).metadata()).width;
  const [width, height] = sourceWidth >= 1600 ? [1600, 1067] : [1200, 800];

  const { data, info } = await img
    .resize(width, height, { fit: "cover", position: sharp.strategy.attention })
    .modulate({ saturation: 0.96 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  grade(data, info.width, info.height, info.channels);

  const file = `public/rehber/${slug}.webp`;
  const out = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .sharpen({ sigma: 0.6 })
    .withXmp(xmp(unsplash))
    .webp({ quality: 80, effort: 6 })
    .toFile(file);
  console.log(
    `${file}: ${out.width} x ${out.height}, ${Math.round(out.size / 1024)} KB`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
