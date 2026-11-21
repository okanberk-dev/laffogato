import "server-only";

import { normalizeTableCode } from "@/lib/admin/cafe-tables-core";
import { reserveLoginAttempt } from "@/lib/admin/rate-limit";
import { getSettings } from "@/lib/admin/store";
import {
  findOpenTableCall,
  getTableCall,
  insertTableCall,
} from "@/lib/admin/table-calls";
import {
  isTableCallId,
  newTableCallId,
  type TableCallReason,
  type TableCallRow,
} from "@/lib/admin/table-calls-core";

import { lookupTableLimited } from "./tables";

/**
 * "Garson çağır" from the app (docs/API-MOBILE.md §22.1): the member at a
 * table asks for a waiter, water or napkins, and the call rings this
 * panel's order alert and the köşk panel's bar screen until somebody
 * answers it.
 *
 * In this order, each step only when the one before let it through:
 *
 *   1. the switches: `tableEnabled` and `tableCallsEnabled` (Uygulama
 *      ayarları › Sipariş). Off answers `unavailable` for every code, so a
 *      closed feature says nothing about which codes are real;
 *   2. the table, through the same miss counter as `GET /tables/{code}`
 *      (`table-lookup`, the member at this address): a code that names
 *      nothing counts there;
 *   3. an open call of this table for this reason (anyone's, younger than
 *      15 minutes, unanswered) is answered as it is: no new row, no ping,
 *      nothing counted. Two guests at one table asking for water are one
 *      call for the staff;
 *   4. the member's budget, every new call counted (`table-call`: one a
 *      minute; `table-call-hour`: ten an hour; rate-limit.ts);
 *   5. the row. Its write pings the panel (src/lib/cache/tags.ts).
 *
 * Two members pressing the same reason at the same table in the same
 * instant can still make two calls (step 3 is a read): the bar screen then
 * shows the table twice, which one "Gördüm" each settles. One member's
 * double tap cannot: the per-minute budget lets only one of them through.
 */

export type TableCallRequest =
  | { ok: true; call: TableCallRow; created: boolean }
  | { ok: false; reason: "unavailable" | "missing" | "inactive" }
  | {
      ok: false;
      reason: "limited";
      /** Whose limit: the table-code miss counter, or the member's calls. */
      limit: "lookup" | "calls";
      retryAfterSeconds: number;
    };

export async function requestTableCall(input: {
  code: unknown;
  reason: TableCallReason;
  ip: string;
  customer: { id: string; email: string };
  now?: Date;
}): Promise<TableCallRequest> {
  const now = input.now ?? new Date();
  const { ordering } = (await getSettings()).mobileApp;
  if (!ordering.tableEnabled || !ordering.tableCallsEnabled) {
    return { ok: false, reason: "unavailable" };
  }

  const lookup = await lookupTableLimited(
    input.code,
    input.ip,
    input.customer.id,
  );
  if (!lookup.ok) {
    return lookup.reason === "limited"
      ? {
          ok: false,
          reason: "limited",
          limit: "lookup",
          retryAfterSeconds: lookup.retryAfterSeconds,
        }
      : { ok: false, reason: lookup.reason };
  }
  const table = lookup.table;

  const open = await findOpenTableCall(table.code, input.reason, now);
  if (open) return { ok: true, call: open, created: false };

  const email = input.customer.email.trim().toLowerCase();
  for (const purpose of ["table-call", "table-call-hour"] as const) {
    const gate = await reserveLoginAttempt(purpose, "*", email);
    if (gate.blocked) {
      return {
        ok: false,
        reason: "limited",
        limit: "calls",
        retryAfterSeconds: gate.retryAfterSeconds,
      };
    }
  }

  const call = await insertTableCall({
    id: newTableCallId(),
    tableCode: table.code,
    tableName: table.name,
    reason: input.reason,
    customerEmail: email,
    createdAt: now.toISOString(),
    // The table's branch: the call rings that branch's bar alone.
    branch: table.branch,
  });
  return { ok: true, call, created: true };
}

/**
 * A call as `GET /tables/{code}/calls/{id}` may answer it: the id names a
 * call of the table the path names, else null (404 `call_not_found`).
 *
 * Whoever was handed the call by `POST /calls` may follow it: its creator,
 * and a second member at the same table whose identical request was
 * answered with this open call (step 3 above). Both hold the table's code
 * (from the QR on that table) and the call's 80-bit random id, and the
 * answer carries no member at all: the table, the reason and two instants.
 * A code from another table, an unknown id or a malformed one is a 404.
 */
export async function readTableCall(
  rawCode: unknown,
  rawId: unknown,
): Promise<TableCallRow | null> {
  const code = normalizeTableCode(rawCode);
  if (!code || !isTableCallId(rawId)) return null;
  const call = await getTableCall(rawId);
  return call && call.tableCode === code ? call : null;
}
