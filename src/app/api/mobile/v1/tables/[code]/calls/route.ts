import type { NextRequest } from "next/server";

import { clientIpFrom } from "@/lib/admin/rate-limit";
import {
  TABLE_CALL_MESSAGES,
  parseTableCallBody,
  toMobileTableCall,
} from "@/lib/admin/table-calls-core";
import { requireMobileCustomer } from "@/lib/mobile/auth";
import { readJsonBody, routeFailure } from "@/lib/mobile/http";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { requestTableCall } from "@/lib/mobile/table-calls";
import { TABLE_MESSAGES } from "@/lib/mobile/tables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * `POST /api/mobile/v1/tables/{code}/calls` - "Garson çağır" from the table
 * whose QR the member scanned (docs/API-MOBILE.md §22.1; the steps are in
 * src/lib/mobile/table-calls.ts). Bearer required.
 *
 * Body exactly `{ "reason": "waiter" | "water" | "napkin" }`.
 *
 *   201 `{ call }`                      a new call; the panel rings
 *   200 `{ call }`                      this table already has an open call
 *                                       for this reason: that one, nothing new
 *   400 `invalid_json` / `invalid_body`
 *   401 / 403 / 503                     the bearer's usual answers
 *   404 `table_not_found`, 410 `table_inactive`   as `GET /tables/{code}`
 *   409 `calls_unavailable`             `tableEnabled` or `tableCallsEnabled` off
 *   429 `rate_limited` + `Retry-After`  the table-code miss counter, or the
 *                                       member's one-a-minute / ten-an-hour
 *
 * `Cache-Control: private, no-store` on every answer.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;

    const body = await readJsonBody(request);
    if (!body.ok) return body.response;
    const parsed = parseTableCallBody(body.value);
    if (!parsed.ok) return apiError(400, "invalid_body", parsed.message);

    const { code } = await params;
    const result = await requestTableCall({
      code,
      reason: parsed.reason,
      ip: clientIpFrom(request.headers),
      customer: { id: auth.customer.id, email: auth.customer.email },
    });
    if (result.ok) {
      return apiJson(
        { call: toMobileTableCall(result.call, Date.now()) },
        { status: result.created ? 201 : 200, private: true },
      );
    }
    switch (result.reason) {
      case "unavailable":
        return apiError(
          409,
          "calls_unavailable",
          TABLE_CALL_MESSAGES.unavailable,
        );
      case "missing":
        return apiError(404, "table_not_found", TABLE_MESSAGES.missing);
      case "inactive":
        return apiError(410, "table_inactive", TABLE_MESSAGES.inactive);
      case "limited": {
        const seconds = Math.max(1, Math.ceil(result.retryAfterSeconds));
        return apiError(
          429,
          "rate_limited",
          result.limit === "lookup"
            ? TABLE_MESSAGES.limited(seconds)
            : TABLE_CALL_MESSAGES.limited(seconds),
          { "Retry-After": String(seconds) },
        );
      }
    }
  } catch (err) {
    return routeFailure(err, "api/mobile/v1/tables/[code]/calls");
  }
}
