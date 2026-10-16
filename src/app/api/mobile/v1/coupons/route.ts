import { listCustomerCoupons } from "@/lib/customer/coupons";
import { requireMobileCustomer } from "@/lib/mobile/auth";
import { toMeCoupon } from "@/lib/mobile/me-mapper";
import { apiJson } from "@/lib/mobile/respond";
import { routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * `GET /coupons` - the member's personal coupons, newest first (§5).
 *
 * A coupon that was taken back (`isActive: false`: the stamps behind a free
 * drink or a milestone gift were refunded, see `settleLoyaltyDebt`) is left
 * out. The wire shape has no status field, so it would otherwise reach the
 * app as unused and unexpired, and the checkout would then refuse it. Left
 * out, it is gone the same way an admin-revoked coupon (a delete) is gone.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const coupons = await listCustomerCoupons(auth.customer.email);
    return apiJson(
      { coupons: coupons.filter((c) => c.isActive).map(toMeCoupon) },
      { private: true },
    );
  } catch (err) {
    return routeFailure("api/mobile/v1/coupons GET", err);
  }
}
