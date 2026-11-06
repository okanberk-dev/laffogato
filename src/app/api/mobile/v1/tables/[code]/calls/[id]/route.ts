import type { NextRequest } from "next/server";

import {
  TABLE_CALL_MESSAGES,
  toMobileTableCall,
} from "@/lib/admin/table-calls-core";
import { requireMobileCustomer } from "@/lib/mobile/auth";
import { routeFailure } from "@/lib/mobile/http";
import { apiError, apiJson } from "@/lib/mobile/respond";
import { readTableCall } from "@/lib/mobile/table-calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * `GET /api/mobile/v1/tables/{code}/calls/{id}` - where a call the app made
 * stands (docs/API-MOBILE.md §22.1): `open`, `acked` (somebody pressed
 * "Gördüm"; `ackedAt` says when) or `expired` (nobody did within 15
 * minutes). Bearer required. The call is answered to whoever `POST /calls`
 * handed it to, under the table it was made at
 * (src/lib/mobile/table-calls.ts `readTableCall`); anything else, an
 * unknown or malformed id included, is 404 `call_not_found`.
 *
 * `Cache-Control: private, no-store`: the app polls it while its "Garson
 * geliyor" card is up.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> },
) {
  try {
    const auth = await requireMobileCustomer(request);
    if (!auth.ok) return auth.response;

    const { code, id } = await params;
    const call = await readTableCall(code, id);
    if (!call) {
      return apiError(404, "call_not_found", TABLE_CALL_MESSAGES.notFound);
    }
    return apiJson(
      { call: toMobileTableCall(call, Date.now()) },
      { private: true },
    );
  } catch (err) {
    return routeFailure(err, "api/mobile/v1/tables/[code]/calls/[id]");
  }
}
