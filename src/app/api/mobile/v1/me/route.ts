import { requireMobileCustomer } from "@/lib/mobile/auth";
import { buildMe, deleteMe, updateMe } from "@/lib/mobile/me";
import { mePatchSchema } from "@/lib/mobile/me-schema";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { parseJsonBody, routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** `GET /me` - profile, loyalty, invite summary and the usual (§4). */
export async function GET(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    return apiJson(await buildMe(auth.customer), { private: true });
  } catch (err) {
    return routeFailure("api/mobile/v1/me GET", err);
  }
}

/** `PATCH /me` - partial profile update; returns the fresh `/me` body. */
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
    return apiJson(await buildMe(result.customer), { private: true });
  } catch (err) {
    return routeFailure("api/mobile/v1/me PATCH", err);
  }
}

/**
 * `DELETE /me` - anonymises the member row and closes the account.
 *
 * 409 `orders_in_progress` while an order is still running: Üyelik Sözleşmesi
 * §14 and the `hesap-silme` document both say the closure waits for it, and
 * anonymising the buyer of an order the kitchen is about to hand over would
 * leave the member unable to follow what they already paid for.
 *
 * `identity` (additive, docs/API-MOBILE.md §4) says what happened to the
 * Supabase sign-in identity, which still holds the member's e-mail and name
 * until it is deleted. The app may only say "kişisel bilgilerin silindi" on
 * `deleted`; `skipped` (no service-role key, or no linked identity) and
 * `failed` mean the account is closed and anonymised here but the identity
 * still stands, so the app says the account was closed and nothing more.
 */
export async function DELETE(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const result = await deleteMe(auth.customer);
    if (!result.ok) {
      return apiError(
        409,
        "orders_in_progress",
        "Devam eden siparişin var. Sipariş tamamlandıktan sonra hesabını silebilirsin.",
      );
    }
    return apiJson(
      { ok: true as const, identity: result.identity },
      { private: true },
    );
  } catch (err) {
    return routeFailure("api/mobile/v1/me DELETE", err);
  }
}
