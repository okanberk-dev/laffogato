import { listCustomerCoupons } from "@/lib/customer/coupons";
import { requireMobileCustomer } from "@/lib/mobile/auth";
import { toMeCoupon } from "@/lib/mobile/me-mapper";
import { apiJson } from "@/lib/mobile/respond";
import { routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** `GET /coupons` — the member's personal coupons, newest first (§5). */
export async function GET(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const coupons = await listCustomerCoupons(auth.customer.email);
    return apiJson({ coupons: coupons.map(toMeCoupon) }, { private: true });
  } catch (err) {
    return routeFailure("api/mobile/v1/coupons GET", err);
  }
}
