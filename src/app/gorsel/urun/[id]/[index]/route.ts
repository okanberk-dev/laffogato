import { getProduct } from "@/lib/admin/store";
import { imageResponse } from "@/lib/admin/image-response";

export const runtime = "nodejs";

/**
 * Serves one uploaded product image.
 *
 * Uploaded images live in the row as base64 data URLs. Inlining those into the
 * page meant every product listing shipped megabytes of base64 that no browser
 * could cache. Behind this route the payload carries a short path instead and
 * the bytes are cached normally — forever, when the path carries the content
 * stamp `image-url.ts` describes.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index } = await params;
  const slot = Number(index);
  if (!Number.isInteger(slot) || slot < 0 || slot > 7) {
    return new Response("Not found", { status: 404 });
  }

  const product = await getProduct(id);
  return imageResponse(request, product?.images?.[slot]);
}
