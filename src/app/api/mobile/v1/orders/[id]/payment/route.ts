import type { NextRequest } from "next/server";

import { requireMobileCustomer } from "@/lib/mobile/auth";
import { routeFailure } from "@/lib/mobile/http";
import { payAppOrder } from "@/lib/mobile/orders";
import { apiError, apiJson } from "@/lib/mobile/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * `POST /api/mobile/v1/orders/{id}/payment` - reopens the checkout of the
 * member's own app order that is still awaiting payment
 * (docs/API-MOBILE.md §3). Same body as a checkout's `{ order, payment }`;
 * a stranger's id is 404 like a missing one, and an order with nothing to pay
 * is 409 `not_payable`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    const result = await payAppOrder(auth.customer, id);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return apiError(404, "not_found", "Sipariş bulunamadı.");
      }
      if (result.reason === "unverified") {
        // The last attempt's outcome could not be read from the POS. A new
        // page now could charge the card a second time; the member tries
        // again in a moment (the same code POST /orders answers when the
        // provider cannot be reached).
        return apiError(
          503,
          "payment_unavailable",
          "Önceki ödemenin durumunu şu an doğrulayamıyoruz. Birkaç dakika sonra tekrar dene.",
        );
      }
      return apiError(409, "not_payable", "Bu sipariş ödeme beklemiyor.");
    }
    return apiJson(
      { order: result.order, payment: result.payment },
      { private: true },
    );
  } catch (err) {
    return routeFailure(err, "api/mobile/v1/orders/[id]/payment");
  }
}
