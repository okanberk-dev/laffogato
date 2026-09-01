import { NextResponse } from "next/server";

import { getShopHeroSlide } from "@/lib/admin/store";
import { decodeDataImage, IMAGE_CACHE_CONTROL } from "@/lib/admin/image-bytes";

export const runtime = "nodejs";

/** Serves a shop-hero slide's uploaded background. See the product route. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const slide = await getShopHeroSlide(id);
  const image = decodeDataImage(slide?.imageUrl);
  if (!image) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(image.body), {
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.body.length),
      "Cache-Control": IMAGE_CACHE_CONTROL,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
