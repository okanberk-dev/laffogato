import { z } from "zod";

import { getProduct } from "@/lib/admin/store";
import { toggleWishlist } from "@/lib/customer/store";
import { requireMobileCustomer } from "@/lib/mobile/auth";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { parseJsonBody, routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const bodySchema = z
  .object({
    productId: z
      .string({ error: "Ürün geçersiz." })
      .trim()
      .min(1, { error: "Ürün geçersiz." })
      .max(64, { error: "Ürün geçersiz." }),
  })
  .strict();

/**
 * `POST /api/mobile/v1/me/favorites` — add or drop one product (§4).
 *
 * A toggle, not a whole-list write, and deliberately so: the site edits the
 * same list through the same helper, so two surfaces touching it at once each
 * change one entry instead of overwriting each other's list. The answer says
 * which way it went, so the app can confirm rather than assume.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const body = await parseJsonBody(request, bodySchema);
    if (!body.ok) return body.response;

    const result = await toggleWishlist(
      auth.customer.email,
      body.data.productId,
    );
    if (!result.ok) {
      return apiError(404, "not_found", result.error ?? "Hesap bulunamadı.");
    }
    return apiJson(
      { productId: body.data.productId, isFavorite: !!result.isFavorite },
      { private: true },
    );
  } catch (err) {
    return routeFailure("api/mobile/v1/me/favorites POST", err);
  }
}
