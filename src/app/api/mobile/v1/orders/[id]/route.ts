import type { NextRequest } from "next/server";

import { requireMobileCustomer } from "@/lib/mobile/auth";
import { routeFailure } from "@/lib/mobile/http";
import { getAppOrder } from "@/lib/mobile/orders";
import { apiError, apiJson } from "@/lib/mobile/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * `GET /api/mobile/v1/orders/{id}` — one order, only for its owner
 * (docs/API-MOBILE.md §3). Order ids are sequential and guessable, so a
 * stranger's id answers 404 exactly like a missing one: no way to tell.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    const order = await getAppOrder(auth.customer, id);
    if (!order) {
      return apiError(404, "not_found", "Sipariş bulunamadı.");
    }
    return apiJson({ order });
  } catch (err) {
    return routeFailure(err, "api/mobile/v1/orders/[id]");
  }
}
