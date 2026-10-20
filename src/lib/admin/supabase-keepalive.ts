import "server-only";

import { getDb, TABLES } from "@/lib/db";
import { DATABASE_URL_MISSING } from "@/lib/db/database-url.mjs";

import {
  KEEPALIVE_ROW_ID,
  keepaliveRow,
  parseKeepaliveRecord,
  type KeepaliveRead,
  type KeepaliveStatus,
} from "./supabase-keepalive-core";

/**
 * The database half of the Supabase keep-alive record: the daily cron writes
 * each ping's outcome here (`recordSupabaseKeepalive`) and the owner's
 * dashboard reads it back (`loadSupabaseKeepalive`). Our own Postgres, never
 * Supabase: the record must survive the very project it watches pausing.
 * Pure rules: ./supabase-keepalive-core.ts.
 */

/**
 * How long the cron waits for the record. A healthy write takes
 * milliseconds; the cron writes it after its jobs, when the database is
 * already awake, and a database that does not answer must not hold the run.
 */
export const KEEPALIVE_RECORD_TIMEOUT_MS = 5_000;

/** Why a record was not written, in words safe for a log. */
function failureReason(error: { code: string } | null, status: number): string {
  if (!error) return "unknown";
  if (error.code === DATABASE_URL_MISSING) return "DATABASE_URL is not set";
  if (status === 0 && error.code === "") return "database unreachable";
  return `SQLSTATE ${error.code || "?"}`;
}

/**
 * Writes one ping's outcome: one upsert statement on the table's single row,
 * "lastSuccessAt" set only for "ok" (`keepaliveRow`). Returns whether it was
 * written.
 *
 * Never throws and never waits longer than
 * {@link KEEPALIVE_RECORD_TIMEOUT_MS}: it runs inside the daily cron, and a
 * record that could not be written must not fail the run, slow it down or
 * turn a ping that got through into an error. A failure is logged with its
 * class only (SQLSTATE, "unreachable", timeout): never the driver's message,
 * which can carry the database host or user, and there is no key or response
 * body anywhere in this path to log.
 */
export async function recordSupabaseKeepalive(
  status: KeepaliveStatus,
  now: Date = new Date(),
  timeoutMs: number = KEEPALIVE_RECORD_TIMEOUT_MS,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const write = getDb()
      .from(TABLES.supabaseKeepalive)
      .upsert(keepaliveRow(status, now), { onConflict: "id" });
    const res = await Promise.race([
      write,
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), timeoutMs);
      }),
    ]);
    if (res === "timeout") {
      console.error(
        `[cron/daily] keep-alive not recorded: no answer in ${timeoutMs} ms`,
      );
      return false;
    }
    if (res.error) {
      console.error(
        `[cron/daily] keep-alive not recorded: ${failureReason(res.error, res.status)}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      `[cron/daily] keep-alive not recorded: ${err instanceof Error ? err.name : "error"}`,
    );
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The record for the owner's dashboard, read live (never cached). Never
 * throws: one status line must not take the landing page down
 * (`readMailHealth` beside it does the same); a failed read is "unreadable"
 * and the line says so. Call it only through `readKeepaliveFor`, which runs
 * it for the owner alone.
 */
export async function loadSupabaseKeepalive(): Promise<KeepaliveRead> {
  try {
    const res = await getDb()
      .from(TABLES.supabaseKeepalive)
      .select("lastStatus, lastAttemptAt, lastSuccessAt")
      .eq("id", KEEPALIVE_ROW_ID)
      .maybeSingle();
    if (res.error) {
      console.error(
        `[admin] keep-alive record unreadable: ${failureReason(res.error, res.status)}`,
      );
      return { kind: "unreadable" };
    }
    if (!res.data) return { kind: "none" };
    const record = parseKeepaliveRecord(res.data);
    return record ? { kind: "record", record } : { kind: "unreadable" };
  } catch (err) {
    console.error(
      `[admin] keep-alive record unreadable: ${err instanceof Error ? err.name : "error"}`,
    );
    return { kind: "unreadable" };
  }
}
