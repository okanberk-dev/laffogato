"use client";

import Image from "next/image";

import { canOptimizeImage } from "./local-image";

/*
 * Product and menu media. A photo when the panel has one; otherwise the
 * plain ground the card stands on (`.media-empty`), with no drawing. The
 * drawn stand-ins of the earlier looks (cups, bags, scenes) were removed
 * with the rest of that design on 21 Kas 2026.
 */

/** Admin-uploaded product cover (/gorsel or a panel URL) or nothing. */
export function ProductSurface({
  label,
  images,
  priority = false,
}: {
  /** Kept for call sites: the product's category and tint. Unused. */
  cat?: string;
  tone?: string;
  label?: string;
  sub?: string;
  /** Admin-uploaded image URLs; the first non-empty one is shown. */
  images?: string[];
  /** Above-the-fold (LCP) image: eager, high fetch priority. */
  priority?: boolean;
}) {
  const cover = images?.find((u) => typeof u === "string" && u.length > 0);
  if (!cover) return <span className="media-empty" aria-hidden="true" />;
  if (canOptimizeImage(cover)) {
    // A photo in our store (R2): next/image sends the width the card needs,
    // and Vercel's image cache stands in front of the bucket.
    return (
      <Image
        className="media-img"
        src={cover}
        alt={label ?? "Ürün görseli"}
        fill
        sizes="(max-width: 760px) 50vw, (max-width: 1200px) 33vw, 25vw"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
      />
    );
  }
  return (
    // A pasted link on some other host: next/image cannot whitelist it.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="media-img"
      src={cover}
      alt={label ?? "Ürün görseli"}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
    />
  );
}

/** A menu item's photo (a cutout or an opaque square) or nothing. The
 *  card names the item, so the photo is decorative (alt=""). */
export function MenuPlate({
  image,
  sizes = "(max-width: 760px) 50vw, (max-width: 1200px) 33vw, 25vw",
}: {
  /** Kept for call sites: the item's tint and category. Unused. */
  hue?: string;
  cat?: string;
  name?: string;
  image?: string;
  sizes?: string;
}) {
  if (!image) return <span className="media-empty" aria-hidden="true" />;
  if (canOptimizeImage(image)) {
    // The site's own photos (900-1024 px squares) and the photos in our
    // store (R2, up to 1600 px): next/image sends the width the card needs
    // instead of the whole file.
    return (
      <Image
        className="media-img media-img--contain"
        src={image}
        alt=""
        fill
        sizes={sizes}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="media-img media-img--contain"
      src={image}
      alt=""
      loading="lazy"
      decoding="async"
    />
  );
}
