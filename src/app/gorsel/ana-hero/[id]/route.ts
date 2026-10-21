import { getHomeHeroSlide } from "@/lib/admin/home-hero";
import { imageResponse } from "@/lib/admin/image-response";

export const runtime = "nodejs";

/** Serves a home-hero slide's uploaded picture. See the product route. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const slide = await getHomeHeroSlide(id);
  return imageResponse(request, slide?.image);
}
