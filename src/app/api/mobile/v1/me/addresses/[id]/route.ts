import {
  deleteCustomerAddress,
  updateCustomerAddress,
} from "@/lib/customer/store";
import { requireMobileCustomer } from "@/lib/mobile/auth";
import { fromMeAddress, toMeAddresses } from "@/lib/mobile/me-mapper";
import { addressInputSchema } from "@/lib/mobile/me-schema";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { parseJsonBody, routeFailure } from "@/lib/mobile/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

type Context = { params: Promise<{ id: string }> };

const NOT_FOUND = () => apiError(404, "address_not_found", "Adres bulunamadı.");

/** `PATCH /me/addresses/{id}` → the member's full address list (§4). */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    if (!auth.customer.addresses.some((a) => a.id === id)) return NOT_FOUND();

    const body = await parseJsonBody(request, addressInputSchema);
    if (!body.ok) return body.response;

    const result = await updateCustomerAddress(
      auth.customer.email,
      id,
      fromMeAddress(body.data),
    );
    if (!result.ok) return apiError(400, "invalid_address", result.error);
    return apiJson(
      { addresses: toMeAddresses(result.customer.addresses) },
      { private: true },
    );
  } catch (err) {
    return routeFailure("api/mobile/v1/me/addresses/[id] PATCH", err);
  }
}

/** `DELETE /me/addresses/{id}` → the member's remaining addresses (§4). */
export async function DELETE(request: Request, { params }: Context) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    if (!auth.customer.addresses.some((a) => a.id === id)) return NOT_FOUND();

    const result = await deleteCustomerAddress(auth.customer.email, id);
    if (!result.ok) return apiError(400, "invalid_address", result.error);
    return apiJson(
      { addresses: toMeAddresses(result.customer.addresses) },
      { private: true },
    );
  } catch (err) {
    return routeFailure("api/mobile/v1/me/addresses/[id] DELETE", err);
  }
}
