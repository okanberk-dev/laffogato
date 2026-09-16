import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

/**
 * The gate every cron route opens with.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` itself once the variable
 * exists; anyone else has to know the secret. The comparison is constant-time,
 * and an unset secret is a 503 rather than an open door — these routes send
 * commercial mail and write coupons, so "no secret configured" must never mean
 * "anyone may run it".
 *
 * Lives beside the routes rather than in `src/lib` because it is nothing but
 * the routes' shared preamble. Next.js only treats `route.ts` as an endpoint,
 * so a plain module in this folder is just a module.
 */

export const NO_STORE = { "Cache-Control": "no-store" } as const;

function authorized(request: Request): boolean | "unset" {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!secret) return "unset";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * `null` when the caller may proceed; otherwise the response to return as it
 * is. Written this way so a route cannot accidentally carry on after a failed
 * check — there is no boolean to forget to negate.
 */
export function cronGate(request: Request): NextResponse | null {
  const auth = authorized(request);
  if (auth === "unset") {
    return NextResponse.json(
      { error: "cron_secret_unset", message: "CRON_SECRET tanımlı değil." },
      { status: 503, headers: NO_STORE },
    );
  }
  if (!auth) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }
  return null;
}
