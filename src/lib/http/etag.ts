import "server-only";

import { createHash } from "node:crypto";

/**
 * Conditional GET, shared by the image routes and the mobile menu.
 *
 * An ETag is the cheap half of freshness: the URL says *what* to fetch, the
 * ETag says "you already have it". Without one, a cache with an expired copy
 * has to re-download bytes it already holds, and a mobile client on a slow
 * connection pays for a menu it could have skipped.
 */

/** A strong entity-tag for exactly these bytes. */
export function strongEtag(payload: string): string {
  return `"${createHash("sha256").update(payload).digest("hex")}"`;
}

/** Wraps a digest that is already computed (the image routes hold one). */
export function etagFromDigest(digest: string): string {
  return `"${digest}"`;
}

/**
 * RFC 9110 §13.1.2: `If-None-Match` is `*` or a comma-separated list of
 * entity-tags compared with the *weak* comparison function — so `W/"x"` and
 * `"x"` match each other, and both match ours.
 */
export function ifNoneMatchHits(header: string | null, etag: string): boolean {
  if (!header) return false;
  const wanted = etag.replace(/^W\//, "");
  const value = header.trim();
  if (value === "*") return true;
  return value
    .split(",")
    .some((candidate) => candidate.trim().replace(/^W\//, "") === wanted);
}
