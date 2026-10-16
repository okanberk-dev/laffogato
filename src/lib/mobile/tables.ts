import "server-only";

import {
  resolveActiveTable,
  type PublicCafeTable,
} from "@/lib/admin/cafe-tables";
import { checkLoginLimit, reserveLoginAttempt } from "@/lib/admin/rate-limit";

/**
 * A table code from outside - `GET /tables/{code}` and the `table` order path
 * (docs/API-MOBILE.md §3, §22) - resolved behind the miss counter.
 *
 * A code is 50 random bits, so guessing one is hopeless on its own; the
 * counter is there so nobody gets to find that out at line rate. Only a code
 * that names NOTHING is counted (a real QR always resolves, an inactive table
 * is a real table), per address, reserved before the answer goes out so a
 * parallel burst cannot outrun it - the promo-preview pattern (WS1-03). While
 * the address is locked out even a real code answers "limited", so the
 * limiter itself never says which guesses were right.
 */

export type TableLookup =
  | { ok: true; table: PublicCafeTable }
  | { ok: false; reason: "missing" | "inactive" }
  | { ok: false; reason: "limited"; retryAfterSeconds: number };

const PURPOSE = "table-lookup" as const;

export async function lookupTableLimited(
  raw: unknown,
  ip: string,
): Promise<TableLookup> {
  const before = await checkLoginLimit(PURPOSE, ip, "");
  if (before.blocked) {
    return {
      ok: false,
      reason: "limited",
      retryAfterSeconds: before.retryAfterSeconds,
    };
  }
  const found = await resolveActiveTable(raw);
  if (found === null) {
    const gate = await reserveLoginAttempt(PURPOSE, ip, "");
    if (gate.blocked) {
      return {
        ok: false,
        reason: "limited",
        retryAfterSeconds: gate.retryAfterSeconds,
      };
    }
    return { ok: false, reason: "missing" };
  }
  const after = await checkLoginLimit(PURPOSE, ip, "");
  if (after.blocked) {
    return {
      ok: false,
      reason: "limited",
      retryAfterSeconds: after.retryAfterSeconds,
    };
  }
  return found === "inactive"
    ? { ok: false, reason: "inactive" }
    : { ok: true, table: found };
}

export const TABLE_MESSAGES = {
  missing: "Masa bulunamadı. Masadaki QR kodunu yeniden okut.",
  inactive: "Bu masa şu an siparişe kapalı. Bir görevliye sorabilirsin.",
  limited: (seconds: number) =>
    `Çok fazla bulunamayan masa kodu denendi. ${Math.max(1, Math.ceil(seconds / 60))} dakika sonra tekrar dene.`,
} as const;

/** The refusal a failed lookup becomes on the order endpoints (§3). */
export function tableLookupFailure(
  lookup: Exclude<TableLookup, { ok: true }>,
): {
  status: number;
  code: string;
  message: string;
  headers?: Record<string, string>;
} {
  switch (lookup.reason) {
    case "missing":
      return {
        status: 400,
        code: "invalid_table",
        message: TABLE_MESSAGES.missing,
      };
    case "inactive":
      return {
        status: 409,
        code: "table_inactive",
        message: TABLE_MESSAGES.inactive,
      };
    case "limited": {
      const seconds = Math.max(1, Math.ceil(lookup.retryAfterSeconds));
      return {
        status: 429,
        code: "rate_limited",
        message: TABLE_MESSAGES.limited(seconds),
        headers: { "Retry-After": String(seconds) },
      };
    }
  }
}
