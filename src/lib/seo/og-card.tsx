import "server-only";

import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";

import { ImageResponse } from "next/og";
import type { ReactElement, ReactNode } from "react";

import {
  LAF_BEAN_PATH,
  LAF_LETTERS_PATH,
  LAF_VIEWBOX,
} from "@/components/laffogato/laf-paths";
import { SITE } from "@/lib/seo/site";

/**
 * The link-preview cards (Open Graph and X), one system for every page.
 *
 * The root card (`src/app/opengraph-image.tsx`) is the house look: the app
 * icon's radial green, the L'Af mark in cream with its bean in brass, a
 * tricolore rule, the domain in the footer. A page card keeps all of it and
 * says which page it is: the mark shrinks to a lockup, the page's own line
 * becomes the headline, and a photograph or a drawing takes the right side.
 *
 * Each segment draws its card with an `opengraph-image.tsx` next to its
 * `page.tsx`. Next only lets that file speak when the page's own `openGraph`
 * leaves `images` out (resolve-metadata `mergeStaticMetadata`), so those
 * pages spread `openGraphBase()`, not `openGraphDefaults()`.
 *
 * Text is set in next/og's bundled face (Geist), the same as the root card,
 * with its kerning hidden (`withoutKerning`). It covers Turkish but not the
 * lira sign: a glyph it lacks makes next/og fetch a fallback font from
 * Google at render time, so prices read "TL" and `ogText()` strips what
 * would trigger a fetch.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/**
 * next/og rasterises on the server, where CSS variables do not resolve, so
 * the palette is spelled out - the app icon's own (globals.css :root since 25
 * Eyl 2026): the radial house green #23876a → #1d6d56 → #0c3b2d, the mark in
 * cream #fbf8f4 with its bean in brass #e8c877.
 */
export const OG_INK = {
  greenLight: "#23876a",
  green: "#1d6d56",
  greenDeep: "#0c3b2d",
  cream: "#fbf8f4",
  brass: "#e8c877",
  /** --gold, the text gold: espresso in the drawings. */
  gold: "#765923",
  mint: "#d3e2d9",
  mist: "#e6efe9",
  rose: "#f6e9ec",
} as const;

export const OG_GROUND = `radial-gradient(circle at 30% 20%, ${OG_INK.greenLight} 0%, ${OG_INK.green} 45%, ${OG_INK.greenDeep} 100%)`;

/** "laffogato.net", or the deployment's host on a preview. */
export const OG_HOST = SITE.url.replace(/^https?:\/\//, "");

/**
 * Text from the database, safe to set: no emoji (next/og would fetch
 * Twemoji), the lira sign as "TL" (Geist has no ₺), one space between words,
 * and at most `max` characters, cut at a word with an ellipsis.
 */
export function ogText(raw: string | undefined | null, max = 90): string {
  const text = (raw ?? "")
    .replace(/\p{Extended_Pictographic}|\u{FE0F}|\u{200D}/gu, "")
    .replace(/\s*₺\s*/g, " TL ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  // A whole last word is kept; a split one goes, unless it is most of the line.
  const space = text[max - 1] === " " ? cut.length : cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * The headline's size for its length, so it holds two lines at the big
 * sizes and three at the smallest. Geist's average advance is about 0.56 em;
 * 0.6 leaves room for where a line breaks.
 */
export function ogTitleSize(title: string, columnWidth: number): number {
  for (const size of [88, 78, 68, 60, 54]) {
    const perLine = Math.floor(columnWidth / (size * 0.6));
    const lines = Math.ceil(title.length / Math.max(1, perLine));
    if (lines <= (size >= 68 ? 2 : 3)) return size;
  }
  return 48;
}

export function OgMark({ height }: { height: number }) {
  const width = Math.round((height * LAF_VIEWBOX.width) / LAF_VIEWBOX.height);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${LAF_VIEWBOX.width} ${LAF_VIEWBOX.height}`}
    >
      <path fillRule="evenodd" fill={OG_INK.cream} d={LAF_LETTERS_PATH} />
      <path fillRule="evenodd" fill={OG_INK.brass} d={LAF_BEAN_PATH} />
    </svg>
  );
}

/** The tricolore, on the dark ground: mint, cream, rose. */
export function OgTricolore() {
  return (
    <div style={{ display: "flex", width: 54, height: 6 }}>
      <div style={{ flex: 1, background: OG_INK.mint, display: "flex" }} />
      <div style={{ flex: 1, background: OG_INK.cream, display: "flex" }} />
      <div style={{ flex: 1, background: OG_INK.rose, display: "flex" }} />
    </div>
  );
}

export function OgFooter({ left, right }: { left: string; right: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 84,
        right: 84,
        bottom: 44,
        display: "flex",
        justifyContent: "space-between",
        fontSize: 20,
        color: OG_INK.mint,
      }}
    >
      <div style={{ display: "flex" }}>{left}</div>
      <div style={{ display: "flex" }}>{right}</div>
    </div>
  );
}

/** next/og's own face, Geist Regular (SIL OFL), where next installs it. */
const GEIST_FILE = join(
  process.cwd(),
  "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf",
);

/**
 * The font's bytes with its GPOS table (where Geist keeps its kerning)
 * renamed, so the font parser skips it.
 *
 * next/og measures a word one glyph at a time but draws it kerned, so every
 * word holding a kerned pair ("mikrofon", "Atatürk", "Köşkün") was followed
 * by a visibly wider space. Without the table the drawn word is exactly as
 * wide as the measured one. Patched in memory; no font file is shipped.
 */
export function withoutKerning(font: Uint8Array): Buffer {
  const out = Buffer.from(font);
  const tables = out.readUInt16BE(4);
  for (let i = 0; i < tables; i++) {
    const at = 12 + i * 16;
    if (out.toString("latin1", at, at + 4) === "GPOS") {
      out.write("XPOS", at, "latin1");
    }
  }
  return out;
}

let unkerned: Promise<Buffer | null> | undefined;

/** Geist without kerning, read once; null if the file is not there. */
function unkernedGeist(): Promise<Buffer | null> {
  unkerned ??= readFile(GEIST_FILE).then(withoutKerning, () => null);
  return unkerned;
}

/**
 * A 1200 x 630 PNG of `card`, in Geist without kerning - or, if the font
 * file cannot be read, in next/og's default (the same Geist, kerned).
 */
export async function ogImage(card: ReactElement): Promise<ImageResponse> {
  const font = await unkernedGeist();
  return new ImageResponse(card, {
    ...OG_SIZE,
    ...(font
      ? { fonts: [{ name: "Geist", data: font, weight: 400, style: "normal" }] }
      : {}),
  });
}

// ─── Photographs ─────────────────────────────────────────────────────────

/**
 * The most pixels a photo may declare before sharp decodes it, as in
 * `src/lib/backdrop/from-image.ts`: the uploader stores at most 1600 px on
 * the long side, so this only stops a hand-made file.
 */
const MAX_INPUT_PIXELS = 4096 * 4096;

/**
 * sharp, loaded on first use: it is native, and a function without its
 * binary should lose only the photo, not the card.
 */
async function loadSharp() {
  try {
    return (await import("sharp")).default;
  } catch {
    return null;
  }
}

/**
 * Photo bytes as a JPEG data URL cut to exactly `width` x `height`, or null
 * when sharp cannot read them. next/og cannot draw WebP (the site's photos
 * and the panel's uploads are WebP), so every photo passes through here.
 */
export async function ogPhoto(
  bytes: Uint8Array,
  width: number,
  height: number,
): Promise<string | null> {
  if (bytes.length === 0) return null;
  const sharp = await loadSharp();
  if (!sharp) return null;
  try {
    const jpeg = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize(width, height, { fit: "cover" })
      .flatten({ background: OG_INK.cream })
      .jpeg({ quality: 84 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

/** The content type of a card that carries a photograph (`ogJpeg`). */
export const OG_JPEG = "image/jpeg";

/**
 * `ogImage`, re-encoded as a JPEG: for the cards that carry a photograph.
 * As PNGs they weighed 0.3-0.6 MB, heavy for a link preview on a phone; as
 * JPEGs at q88 they are 50-90 KB and the text stays clean. The drawn cards
 * stay PNG, around 110 KB.
 *
 * If sharp cannot load, the PNG is served: the route's `contentType` then
 * misnames it, and every client reads the bytes anyway.
 */
export async function ogJpeg(card: ReactElement): Promise<Response> {
  const sharp = await loadSharp();
  const png = await ogImage(card);
  if (!sharp) return png;
  try {
    const bytes = Buffer.from(await png.arrayBuffer());
    const jpeg = await sharp(bytes)
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    const headers = new Headers(png.headers);
    headers.set("content-type", OG_JPEG);
    headers.delete("content-length");
    return new Response(new Uint8Array(jpeg), { headers });
  } catch {
    return ogImage(card);
  }
}

const PUBLIC_DIR = join(process.cwd(), "public");

/**
 * A file the site serves from `public/` (a site-relative path such as
 * "/photos/facade-day.webp"), as `ogPhoto` - or null when it is missing,
 * unreadable or outside `public/`.
 */
export async function ogPublicPhoto(
  sitePath: string,
  width: number,
  height: number,
): Promise<string | null> {
  const file = normalize(join(PUBLIC_DIR, sitePath.split("?")[0]));
  if (!file.startsWith(PUBLIC_DIR + sep)) return null;
  try {
    return await ogPhoto(await readFile(file), width, height);
  } catch {
    return null;
  }
}

// ─── The page card ───────────────────────────────────────────────────────

const PAD_X = 84;
const PAD_RIGHT = 72;
const ART_GAP = 56;

export interface OgPageCardProps {
  /** After the tricolore: which part of the site this is. */
  eyebrow: string;
  /** The page's own line. No final period. */
  title: string;
  /** Brass, under the title. */
  subtitle?: string;
  /** Mist, the smallest line. */
  detail?: string;
  /** Replaces the subtitle with a price block (the product card). */
  price?: ReactNode;
  /** The page's path, printed after the host in the footer. */
  path: string;
  /** The footer's right-hand side. */
  footer?: string;
  /** The right side: `OgFramedPhoto`, `OgBigMark` or a drawing. */
  art: ReactNode;
  /** The art's width, so the text column knows what is left. */
  artWidth: number;
}

export function OgPageCard({
  eyebrow,
  title,
  subtitle,
  detail,
  price,
  path,
  footer = "Tuzla · tarihi köşk",
  art,
  artWidth,
}: OgPageCardProps) {
  const column = OG_SIZE.width - PAD_X - PAD_RIGHT - ART_GAP - artWidth;
  const titleSize = ogTitleSize(title, column);
  // The brass line stays one line: smaller before it wraps.
  const subtitleSize =
    [36, 32, 28].find(
      (size) => (subtitle ?? "").length * size * 0.56 <= column,
    ) ?? 28;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: OG_GROUND,
        color: OG_INK.cream,
        display: "flex",
        position: "relative",
        padding: `52px ${PAD_RIGHT}px 92px ${PAD_X}px`,
      }}
    >
      <div
        style={{
          width: column,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <OgMark height={46} />
          <div
            style={{
              display: "flex",
              fontSize: 30,
              letterSpacing: -0.5,
              color: OG_INK.cream,
            }}
          >
            L&rsquo;Affogato
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 24,
              color: OG_INK.mint,
            }}
          >
            <OgTricolore />
            {eyebrow}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: titleSize,
              lineHeight: 1.04,
              letterSpacing: titleSize >= 68 ? -2.5 : -1.5,
              marginTop: 22,
              // A product name is free text: one very long word breaks
              // rather than running under the photo.
              wordBreak: "break-word",
            }}
          >
            {title}
          </div>
          {price ??
            (subtitle ? (
              <div
                style={{
                  display: "flex",
                  fontSize: subtitleSize,
                  lineHeight: 1.2,
                  marginTop: 22,
                  color: OG_INK.brass,
                }}
              >
                {subtitle}
              </div>
            ) : null)}
          {detail ? (
            <div
              style={{
                display: "flex",
                fontSize: 25,
                lineHeight: 1.4,
                marginTop: 18,
                color: OG_INK.mist,
              }}
            >
              {detail}
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: artWidth,
          marginLeft: ART_GAP,
        }}
      >
        {art}
      </div>

      <OgFooter left={`${OG_HOST}${path}`} right={footer} />
    </div>
  );
}

/** A photograph in a rounded frame with a brass hairline, as a glass card. */
export function OgFramedPhoto({
  src,
  width,
  height,
}: {
  src: string;
  width: number;
  height: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        width,
        height,
        borderRadius: 30,
        overflow: "hidden",
        border: "2px solid rgba(232, 200, 119, 0.7)",
        boxShadow: "0 24px 60px rgba(4, 26, 19, 0.45)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws <img>, not next/image */}
      <img
        src={src}
        width={width - 4}
        height={height - 4}
        alt=""
        style={{ objectFit: "cover" }}
      />
    </div>
  );
}

/** The mark at the root card's size: for pages with no photograph. */
export function OgBigMark() {
  return <OgMark height={300} />;
}

/** Width of `OgBigMark`, for `artWidth`. */
export const OG_BIG_MARK_WIDTH = Math.round(
  (300 * LAF_VIEWBOX.width) / LAF_VIEWBOX.height,
);
