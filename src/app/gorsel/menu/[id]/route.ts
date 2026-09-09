import { getMenuItem } from "@/lib/admin/store";
import { imageResponse } from "@/lib/admin/image-response";

export const runtime = "nodejs";

/**
 * Serves an uploaded menu-item photo. See the product route for the why, and
 * `image-url.ts` for what the `?v=` stamp buys.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = await getMenuItem(id);
  return imageResponse(request, item?.image);
}
