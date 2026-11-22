import { getSiteImageRow } from "@/lib/admin/site-images";
import { imageResponse } from "@/lib/admin/image-response";

export const runtime = "nodejs";

/** Serves a site photograph uploaded in the panel (Görseller). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const row = await getSiteImageRow(decodeURIComponent(key));
  return imageResponse(request, row?.imageUrl);
}
