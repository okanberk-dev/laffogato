import type { NextRequest } from "next/server";

import {
  optionalMobileCustomer,
  readJsonBody,
  routeFailure,
} from "@/lib/mobile/http";
import { previewAppOrder } from "@/lib/mobile/orders";
import {
  firstIssueMessage,
  previewOrderBodySchema,
} from "@/lib/mobile/order-schema";
import { apiError, apiJson } from "@/lib/mobile/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * `POST /api/mobile/v1/orders/preview` — the basket as checkout will price
 * it (docs/API-MOBILE.md §3). Public; a bearer token, when present and valid,
 * lets the member's personal coupons be tried.
 */
export async function POST(request: NextRequest) {
  try {
    const who = await optionalMobileCustomer(request);
    if (!who.ok) return who.response;

    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = previewOrderBodySchema.safeParse(body.value);
    if (!parsed.success) {
      return apiError(400, "invalid_body", firstIssueMessage(parsed.error));
    }

    const result = await previewAppOrder(parsed.data, who.customer);
    if (!result.ok) {
      const { status, code, message } = result.failure;
      return apiError(status, code, message);
    }
    // Private even though the bearer is optional: when one is present the
    // member's own coupons are tried, so the same basket prices differently
    // per member (docs/API-MOBILE.md §0).
    return apiJson(result.preview, { private: true });
  } catch (err) {
    return routeFailure(err, "api/mobile/v1/orders/preview");
  }
}
