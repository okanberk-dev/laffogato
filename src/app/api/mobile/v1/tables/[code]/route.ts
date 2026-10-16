import type { NextRequest } from "next/server";

import { clientIpFrom } from "@/lib/admin/rate-limit";
import { optionalMobileCustomer, routeFailure } from "@/lib/mobile/http";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { lookupTableLimited, TABLE_MESSAGES } from "@/lib/mobile/tables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * `GET /api/mobile/v1/tables/{code}` - the table a QR names
 * (docs/API-MOBILE.md §22). Public: the app asks before it offers "Masaya
 * sipariş" for the table the member just scanned, signed in or not.
 *
 *   200 `{ table: { code, name } }`        an active table
 *   404 `{ error: "table_not_found" }`     the code names nothing
 *   410 `{ error: "table_inactive" }`      the table is out of service
 *   429 `{ error: "rate_limited" }`        too many misses from this address
 *
 * Never cached anywhere: a rotated or deactivated code must stop resolving
 * the moment the panel says so.
 *
 * A valid bearer is optional and changes one thing: the misses count against
 * that member rather than against the whole address (`tables.ts`), so a
 * café's shared Wi-Fi is not locked out by someone else's misses. A missing,
 * expired or unverifiable token is simply a visitor - never an error here.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const who = await optionalMobileCustomer(request);
    const lookup = await lookupTableLimited(
      code,
      clientIpFrom(request.headers),
      who.ok ? who.customer?.id : null,
    );
    if (lookup.ok) {
      return apiJson(
        { table: { code: lookup.table.code, name: lookup.table.name } },
        { private: true },
      );
    }
    switch (lookup.reason) {
      case "missing":
        return apiError(404, "table_not_found", TABLE_MESSAGES.missing);
      case "inactive":
        return apiError(410, "table_inactive", TABLE_MESSAGES.inactive);
      case "limited": {
        const seconds = Math.max(1, Math.ceil(lookup.retryAfterSeconds));
        return apiError(429, "rate_limited", TABLE_MESSAGES.limited(seconds), {
          "Retry-After": String(seconds),
        });
      }
    }
  } catch (err) {
    return routeFailure(err, "api/mobile/v1/tables/[code]");
  }
}
