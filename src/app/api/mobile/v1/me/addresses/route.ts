import { addCustomerAddress } from "@/lib/customer/store";
import { requireMobileCustomer } from "@/lib/mobile/auth";
import { fromMeAddress, toMeAddresses } from "@/lib/mobile/me-mapper";
import { addressInputSchema } from "@/lib/mobile/me-schema";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { parseJsonBody, routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** `POST /me/addresses` → 201 with the member's full address list (§4). */
export async function POST(request: Request) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const body = await parseJsonBody(request, addressInputSchema);
    if (!body.ok) return body.response;

    const result = await addCustomerAddress(
      auth.customer.email,
      fromMeAddress(body.data),
    );
    if (!result.ok) return apiError(400, "invalid_address", result.error);
    return apiJson(
      { addresses: toMeAddresses(result.customer.addresses) },
      { status: 201 },
    );
  } catch (err) {
    return routeFailure("api/mobile/v1/me/addresses POST", err);
  }
}
