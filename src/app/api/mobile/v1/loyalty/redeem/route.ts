import { requireMobileCustomer } from "@/lib/mobile/auth";
import { redeemStamps } from "@/lib/mobile/loyalty";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** `POST /loyalty/redeem` — six stamps → a free-drink coupon (§5). */
export async function POST(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;

    const result = await redeemStamps(auth.customer.email);
    if (!result.ok) {
      return apiError(
        409,
        "not_enough_stamps",
        "Ödül için 6 damga gerekiyor. Biraz daha kahve, biraz daha yakın.",
      );
    }
    return apiJson(
      {
        coupon: {
          code: result.coupon.code,
          title: result.coupon.title,
          expiresAt: result.coupon.expiresAt || null,
        },
        loyalty: result.loyalty,
      },
      { private: true },
    );
  } catch (err) {
    return routeFailure("api/mobile/v1/loyalty/redeem POST", err);
  }
}
