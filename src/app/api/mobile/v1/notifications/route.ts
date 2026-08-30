import { isDbUnreachable } from "@/lib/db/health";
import { requireMobileCustomer } from "@/lib/mobile/auth";
import { deriveNotifications } from "@/lib/mobile/notifications";
import { apiError, apiJson } from "@/lib/mobile/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * GET /api/mobile/v1/notifications — docs/API-MOBILE.md §8.
 *
 * Derived on every call; the app keeps read state on the device. Private to
 * the member because the order items name what they bought.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const items = await deriveNotifications(auth.customer.email);
    return apiJson({ items }, { private: true });
  } catch (err) {
    if (isDbUnreachable(err)) {
      return apiError(
        503,
        "unavailable",
        "Bildirimlere şu an ulaşılamıyor. Kısa süre içinde tekrar dene.",
      );
    }
    console.error("[api/mobile/v1/notifications]", err);
    return apiError(500, "internal", "Beklenmeyen bir hata oluştu.");
  }
}
