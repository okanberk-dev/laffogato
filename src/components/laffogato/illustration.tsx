import Image from "next/image";

import { cx } from "./cx";

/**
 * The site's drawings (operator, 17 Eki 2026: "websitesine de birkaç görsel
 * çizip görsel gereken yerlere ekle"), one file each in
 * `public/illustrations/`.
 *
 * They follow the karaoke room drawing: flat fills in the brand's six
 * colours (forest #1E4031, burgundy #6B1A2B, cream #FFF2E4, pink #F59BBE,
 * pistachio #9FCB82, espresso #2E1A12) with a 2 px espresso line, each
 * hand-written SVG under 15 KB, transparent over the porcelain. The colours
 * stay inside the drawings: buttons and text keep the site's tokens
 * (tests/brand-theme.test.ts). The L'Af mark, where a drawing carries it, is
 * printed on a sleeve, a ticket or a label, never inside a circle. No
 * supplier's name and nothing about what a cup is made of.
 *
 * Files rather than inline React: a page pays for the drawings it shows, as
 * cached images, and none of them adds to a client bundle. Always decorative:
 * the heading or sentence beside each one carries its meaning, so every
 * drawing is `alt=""` and `aria-hidden` (tests/site-illustrations.test.ts).
 */
export const ILLUSTRATIONS = {
  /** The karaoke room upstairs (raster, the app's drawing). */
  "karaoke-room": {
    src: "/illustrations/karaoke-room.webp",
    width: 1200,
    height: 1200,
  },
  /** Home, "Köşkte bu ay": a ticket, a strawberry, a matcha whisk. */
  "kosk-ticket": {
    src: "/illustrations/kosk-ticket.svg",
    width: 240,
    height: 160,
  },
  /** Kampanyalar hero: the köşk's string lights with a tag. */
  "kampanya-lights": {
    src: "/illustrations/kampanya-lights.svg",
    width: 200,
    height: 200,
  },
  /** A campaign card with no photo, by kind. */
  "kampanya-campaign": {
    src: "/illustrations/kampanya-campaign.svg",
    width: 360,
    height: 270,
  },
  "kampanya-collab": {
    src: "/illustrations/kampanya-collab.svg",
    width: 360,
    height: 270,
  },
  "kampanya-event": {
    src: "/illustrations/kampanya-event.svg",
    width: 360,
    height: 270,
  },
  /** Kampanyalar with nothing running: an empty stub, a pistachio sprig. */
  "kampanya-empty": {
    src: "/illustrations/kampanya-empty.svg",
    width: 160,
    height: 160,
  },
  /** Hikâye timeline, by year. */
  "story-1897": {
    src: "/illustrations/story-1897.svg",
    width: 120,
    height: 120,
  },
  "story-1994": {
    src: "/illustrations/story-1994.svg",
    width: 120,
    height: 120,
  },
  "story-2008": {
    src: "/illustrations/story-2008.svg",
    width: 120,
    height: 120,
  },
  "story-2026": {
    src: "/illustrations/story-2026.svg",
    width: 120,
    height: 120,
  },
  /** Hikâye closing: the cup with a bite out of its rim. */
  "story-kupa": {
    src: "/illustrations/story-kupa.svg",
    width: 200,
    height: 200,
  },
  /** Hikâye "altı ilke": one line icon per card. */
  "ilke-kapi": { src: "/illustrations/ilke-kapi.svg", width: 48, height: 48 },
  "ilke-fincan": {
    src: "/illustrations/ilke-fincan.svg",
    width: 48,
    height: 48,
  },
  "ilke-hoparlor": {
    src: "/illustrations/ilke-hoparlor.svg",
    width: 48,
    height: 48,
  },
  "ilke-teneke": {
    src: "/illustrations/ilke-teneke.svg",
    width: 48,
    height: 48,
  },
  "ilke-saat": { src: "/illustrations/ilke-saat.svg", width: 48, height: 48 },
  "ilke-laptop": {
    src: "/illustrations/ilke-laptop.svg",
    width: 48,
    height: 48,
  },
  /** Mağaza with no product under the filter: an open, empty bean tin. */
  "magaza-teneke": {
    src: "/illustrations/magaza-teneke.svg",
    width: 140,
    height: 140,
  },
  /** Bülten confirm and unsubscribe: an envelope sealed with a bean. */
  "bulten-zarf": {
    src: "/illustrations/bulten-zarf.svg",
    width: 140,
    height: 140,
  },
  /** Rehber cards, one per guide. */
  "rehber-affogato": {
    src: "/illustrations/rehber-affogato.svg",
    width: 64,
    height: 64,
  },
  "rehber-matcha": {
    src: "/illustrations/rehber-matcha.svg",
    width: 64,
    height: 64,
  },
  "rehber-espresso": {
    src: "/illustrations/rehber-espresso.svg",
    width: 64,
    height: 64,
  },
  "rehber-cheesecake": {
    src: "/illustrations/rehber-cheesecake.svg",
    width: 64,
    height: 64,
  },
  "rehber-kupa": {
    src: "/illustrations/rehber-kupa.svg",
    width: 64,
    height: 64,
  },
  /**
   * Account empty states: the app's spot plates, same 0-100 grid. The orders
   * one is the site's own, a café receipt with a bean on top: a roll of
   * paper read as a toilet roll.
   */
  "spot-siparis": {
    src: "/illustrations/spot-siparis.svg",
    width: 96,
    height: 96,
  },
  "spot-adres": { src: "/illustrations/spot-adres.svg", width: 96, height: 96 },
  "spot-favori": {
    src: "/illustrations/spot-favori.svg",
    width: 96,
    height: 96,
  },
  "spot-kupon": { src: "/illustrations/spot-kupon.svg", width: 96, height: 96 },
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;

/**
 * One drawing at `width` CSS pixels (its own size by default), out of the
 * accessibility tree. `sizes` only matters for the raster room drawing.
 */
export function Illustration({
  name,
  width,
  className,
  sizes,
  priority = false,
}: {
  name: IllustrationName;
  width?: number;
  className?: string;
  sizes?: string;
  /** Above the fold: load it with the page instead of lazily. */
  priority?: boolean;
}) {
  const art = ILLUSTRATIONS[name];
  const w = width ?? art.width;
  return (
    <Image
      src={art.src}
      alt=""
      aria-hidden="true"
      width={w}
      height={Math.round((w * art.height) / art.width)}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      className={cx("illo", className)}
    />
  );
}
