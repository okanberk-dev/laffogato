import { getAdminSession, isAdminSessionUnavailable } from "@/lib/admin/auth";
import { canAccess, type AdminSection } from "@/lib/admin/roles";
import { isDbUnreachable } from "@/lib/db/health";
import {
  ImageUploadError,
  imageStoreConfigured,
  uploadImage,
} from "@/lib/images/store";
import { IMAGE_MAX_UPLOAD_BYTES } from "@/lib/images/store-core.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** The panel areas that upload photos (products, menu, slides, site images). */
const UPLOAD_SECTIONS: readonly AdminSection[] = [
  "products",
  "menu",
  "shopHero",
  "content",
];

/**
 * `POST /admin/gorsel-yukle` - one photo from the panel's uploader into the
 * photo store (Cloudflare R2, 26 Kas 2026; `src/lib/images/store.ts`).
 *
 * The body is the image itself (`Content-Type: image/*`), already shrunk by
 * the browser to 1600 px (`image-encode.ts`), so it stays well under the
 * platform's 4.5 MB request ceiling. Here it is compressed again with the
 * store's one rule (sharp: EXIF orientation, 1600 px, WebP 80, no
 * metadata), named by its content and uploaded once. The answer is
 * `{ url }`; the form then posts only that URL, never the bytes.
 *
 * Without a configured store: 503 `{ error: "unconfigured" }`, and the
 * uploader keeps the data URL as before (a deploy that lands before the
 * variables does not take uploads away).
 *
 * A route handler is not behind `requireRole` and `proxy.ts` only redirects
 * page views, so the session, the role and the origin are checked here.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return answer({ error: "forbidden" }, 403);

  let session;
  try {
    session = await getAdminSession();
  } catch (err) {
    if (!isAdminSessionUnavailable(err) && !isDbUnreachable(err)) throw err;
    return answer({ error: "unavailable" }, 503);
  }
  if (!session) return answer({ error: "unauthorized" }, 401);
  if (!UPLOAD_SECTIONS.some((s) => canAccess(s, session.role))) {
    return answer({ error: "forbidden" }, 403);
  }
  if (!imageStoreConfigured()) {
    return answer({ error: "unconfigured" }, 503);
  }

  const type = request.headers.get("content-type") ?? "";
  if (!/^image\/(jpeg|png|webp|avif|gif)\b/i.test(type)) {
    return answer(
      { error: "unsupported", message: "JPEG, PNG ya da WebP yükle." },
      415,
    );
  }
  const bytes = await readBody(request, IMAGE_MAX_UPLOAD_BYTES);
  if (!bytes) {
    return answer(
      { error: "too_large", message: "Dosya 12 MB'ı aşıyor." },
      413,
    );
  }

  try {
    const url = await uploadImage(bytes);
    return answer({ url }, 200);
  } catch (err) {
    if (err instanceof ImageUploadError) {
      return answer({ error: "failed", message: err.message }, err.status);
    }
    console.error(
      "[admin/gorsel-yukle] upload failed:",
      err instanceof Error ? err.name : "unknown",
    );
    return answer({ error: "failed", message: "Görsel yüklenemedi." }, 500);
  }
}

function answer(body: object, status: number): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

/**
 * Only the panel's own page: Sec-Fetch-Site "same-origin", or on an older
 * browser an Origin whose host is ours (as `/admin/ara/sonuc`).
 */
function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin";
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host.toLowerCase();
  } catch {
    return false;
  }
}

/** The body, or null when it passes `limit` bytes (counted as it streams). */
async function readBody(
  request: Request,
  limit: number,
): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > limit) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
