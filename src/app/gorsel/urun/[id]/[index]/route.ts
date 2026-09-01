import { NextResponse } from "next/server";

import { getProduct } from "@/lib/admin/store";
import { decodeDataImage, IMAGE_CACHE_CONTROL } from "@/lib/admin/image-bytes";

export const runtime = "nodejs";

/**
 * Serves one uploaded product image.
 *
 * Uploaded images live in the row as base64 data URLs. Inlining those into the
 * page meant every product listing shipped megabytes of base64 that no browser
 * could cache. Behind this route the payload carries a short path instead and
 * the bytes are cached normally.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index } = await params;
  const slot = Number(index);
  if (!Number.isInteger(slot) || slot < 0 || slot > 7) {
    return new NextResponse("Not found", { status: 404 });
  }

  const product = await getProduct(id);
  const image = decodeDataImage(product?.images?.[slot]);
  if (!image) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(image.body), {
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.body.length),
      "Cache-Control": IMAGE_CACHE_CONTROL,
      // The bytes are public product photography, but they came out of the
      // database — never let a response of theirs be sniffed as something else.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
