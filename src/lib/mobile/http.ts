import "server-only";

import type { NextResponse } from "next/server";

import type { PublicCustomer } from "@/lib/customer/store";

import { requireMobileCustomer } from "./auth";
import { apiError } from "./respond";
import { routeFailure as routeFailureByLabel } from "./route-helpers";

/**
 * Small pieces every order route repeats: reading a JSON body, an optional
 * bearer identity, and the shared failure branch. Keeps the handlers at
 * "parse → authorise → call → map" (docs/API-MOBILE.md §0).
 */

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; response: NextResponse };

/** The parsed JSON body, or a 400 the handler returns as-is. */
export async function readJsonBody(request: Request): Promise<JsonBodyResult> {
  try {
    const value: unknown = await request.json();
    return { ok: true, value };
  } catch {
    return {
      ok: false,
      response: apiError(
        400,
        "invalid_json",
        "İstek gövdesi okunamadı (geçerli JSON gönder).",
      ),
    };
  }
}

export type OptionalCustomerResult =
  | { ok: true; customer: PublicCustomer | null }
  | { ok: false; response: NextResponse };

/**
 * Identity for a public endpoint that does more for a member (a basket
 * preview that also tries a personal coupon). No header means a visitor; a
 * token Supabase rejects also means a visitor - the basket must still price
 * for someone whose session just expired - while an outage or a disabled
 * account is reported, because those are not "nobody is signed in".
 */
export async function optionalMobileCustomer(
  request: Request,
): Promise<OptionalCustomerResult> {
  if (!request.headers.get("authorization")) {
    return { ok: true, customer: null };
  }
  const auth = await requireMobileCustomer(request);
  if (auth.ok) return { ok: true, customer: auth.customer };
  if (auth.response.status === 401) return { ok: true, customer: null };
  return { ok: false, response: auth.response };
}

/**
 * The catch-all of a route, kept at this call site's argument order.
 *
 * There were two of these with the arguments the other way round: importing
 * the wrong one silently turned every database outage into a 500, because
 * `isDbUnreachable("api/…")` is false for a string. One implementation now,
 * in route-helpers; this is the adapter the order routes already call.
 */
export function routeFailure(err: unknown, label: string): NextResponse {
  return routeFailureByLabel(label, err);
}
