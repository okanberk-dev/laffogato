import { setCustomerDefaultAddress } from "@/lib/customer/store";
import { requireMobileCustomer } from "@/lib/mobile/auth";
import { toMeAddresses } from "@/lib/mobile/me-mapper";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

type Context = { params: Promise<{ id: string }> };

/** `POST /me/addresses/{id}/default` → the member's full address list (§4). */
export async function POST(request: Request, { params }: Context) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    if (!auth.customer.addresses.some((a) => a.id === id)) {
      return apiError(404, "address_not_found", "Adres bulunamadı.");
    }

    const result = await setCustomerDefaultAddress(auth.customer.email, id);
    if (!result.ok) return apiError(400, "invalid_address", result.error);
    return apiJson(
      { addresses: toMeAddresses(result.customer.addresses) },
      { private: true },
    );
  } catch (err) {
    return routeFailure("api/mobile/v1/me/addresses/[id]/default POST", err);
  }
}
