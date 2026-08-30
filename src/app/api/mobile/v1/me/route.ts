import { requireMobileCustomer } from "@/lib/mobile/auth";
import { buildMe, deleteMe, updateMe } from "@/lib/mobile/me";
import { mePatchSchema } from "@/lib/mobile/me-schema";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { parseJsonBody, routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** `GET /me` — profile, loyalty, invite summary and the usual (§4). */
export async function GET(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    return apiJson(await buildMe(auth.customer), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return routeFailure("api/mobile/v1/me GET", err);
  }
}

/** `PATCH /me` — partial profile update; returns the fresh `/me` body. */
export async function PATCH(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const body = await parseJsonBody(request, mePatchSchema);
    if (!body.ok) return body.response;

    const result = await updateMe(auth.customer, body.data);
    if (!result.ok) {
      if (result.error === "unknown_menu_item") {
        return apiError(
          400,
          "unknown_menu_item",
          "Seçtiğin ürün artık menüde yok.",
        );
      }
      return apiError(404, "not_found", "Hesap bulunamadı.");
    }
    return apiJson(await buildMe(result.customer), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return routeFailure("api/mobile/v1/me PATCH", err);
  }
}

/** `DELETE /me` — anonymises the member row and closes the account. */
export async function DELETE(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    await deleteMe(auth.customer);
    return apiJson({ ok: true as const });
  } catch (err) {
    return routeFailure("api/mobile/v1/me DELETE", err);
  }
}
