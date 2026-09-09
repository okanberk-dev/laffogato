import { getShopHeroSlide } from "@/lib/admin/store";
import { imageResponse } from "@/lib/admin/image-response";

export const runtime = "nodejs";

/** Serves a shop-hero slide's uploaded background. See the product route. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const slide = await getShopHeroSlide(id);
  return imageResponse(request, slide?.imageUrl);
}
