import "server-only";

import { etagFromDigest, ifNoneMatchHits } from "@/lib/http/etag";

import {
  decodeDataImage,
  imageDigest,
  IMAGE_CACHE_CONTROL,
  IMMUTABLE_IMAGE_CACHE_CONTROL,
  versionMatchesDigest,
} from "./image-bytes";
import { IMAGE_VERSION_PARAM } from "./image-url";

/**
 * The one answer every `/gorsel/**` route gives.
 *
 * Three routes served uploaded bytes with three copies of the same six
 * headers; the stamp, the ETag and the conditional request would have been
 * three copies of the same mistake. They call this instead.
 */

/** The `?v=` the caller asked for, or "" when there is none. */
export function requestedImageVersion(request: Request): string {
  try {
    return (
      new URL(request.url).searchParams.get(IMAGE_VERSION_PARAM)?.trim() ?? ""
    );
  } catch {
    return "";
  }
}

/**
 * Serves one stored image.
 *
 * - No bytes (missing row, or an `https://` value that is not ours to serve) → 404.
 * - `If-None-Match` matching the content → 304 with no body.
 * - `?v=` matching the content → the bytes, cacheable forever.
 * - Anything else → the bytes, cacheable for five minutes.
 */
export function imageResponse(
  request: Request,
  stored: string | undefined,
): Response {
  const image = decodeDataImage(stored);
  if (!image) return new Response("Not found", { status: 404 });

  const digest = imageDigest(stored);
  const etag = etagFromDigest(digest);
  const cacheControl = versionMatchesDigest(
    requestedImageVersion(request),
    digest,
  )
    ? IMMUTABLE_IMAGE_CACHE_CONTROL
    : IMAGE_CACHE_CONTROL;

  const headers: Record<string, string> = {
    "Cache-Control": cacheControl,
    ETag: etag,
    // The bytes are public product photography, but they came out of the
    // database — never let a response of theirs be sniffed as something else.
    "X-Content-Type-Options": "nosniff",
  };

  if (ifNoneMatchHits(request.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(new Uint8Array(image.body), {
    headers: {
      ...headers,
      "Content-Type": image.contentType,
      "Content-Length": String(image.body.length),
    },
  });
}
