// Pure half of the Supabase keep-alive record (no server-only, no database):
// the row the daily cron writes, who may see it, and what the owner's
// dashboard says about it. The database half is ./supabase-keepalive.ts.

import { istanbulToday } from "./day-close-core";
import { canAccess, type AdminRole } from "./roles";
import type { AdminTone } from "./tone";

/**
 * What a ping got (the same three words as `SupabaseKeepalive` in
 * src/lib/supabase/admin.ts, which this module may not import: that one
 * reads the service key).
 */
export type KeepaliveStatus = "ok" | "failed" | "skipped";

const STATUSES: readonly KeepaliveStatus[] = ["ok", "failed", "skipped"];

/** The table's one row (db/migrations/20261021050600_supabase_keepalive.sql). */
export const KEEPALIVE_ROW_ID = "supabase";

/**
 * A free-plan project pauses after 7 quiet days; a last success older than
 * this many Istanbul calendar days turns the dashboard line amber, early
 * enough to fix the key or the cron before the pause.
 */
export const KEEPALIVE_STALE_DAYS = 3;

/** As stored, minus the row id. Dates are ISO-8601 UTC instants. */
export interface KeepaliveRecord {
  lastStatus: KeepaliveStatus;
  lastAttemptAt: string;
  /** "" until the first success. */
  lastSuccessAt: string;
}

/**
 * The row one ping writes. Only the outcome and the instant: no key, no
 * response body, nothing about a member (the table's checks refuse anything
 * else). `lastSuccessAt` is present only for "ok", so the upsert that
 * writes this row leaves the previous success in place on a failure or a
 * skip: one statement, no read first (CLAUDE.md rule 20).
 */
export function keepaliveRow(
  status: KeepaliveStatus,
  at: Date,
): {
  id: string;
  lastStatus: KeepaliveStatus;
  lastAttemptAt: string;
  lastSuccessAt?: string;
} {
  const iso = at.toISOString();
  return status === "ok"
    ? {
        id: KEEPALIVE_ROW_ID,
        lastStatus: status,
        lastAttemptAt: iso,
        lastSuccessAt: iso,
      }
    : { id: KEEPALIVE_ROW_ID, lastStatus: status, lastAttemptAt: iso };
}

/**
 * What a read of the record found. Never null, so that "no record yet"
 * cannot be mistaken for "not read for this role" (`readKeepaliveFor`'s
 * null).
 */
export type KeepaliveRead =
  | { kind: "record"; record: KeepaliveRecord }
  | { kind: "none" }
  | { kind: "unreadable" };

/** A stored row as the dashboard reads it; null for anything else. */
export function parseKeepaliveRecord(row: unknown): KeepaliveRecord | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (!STATUSES.includes(r.lastStatus as KeepaliveStatus)) return null;
  if (typeof r.lastAttemptAt !== "string" || !r.lastAttemptAt) return null;
  return {
    lastStatus: r.lastStatus as KeepaliveStatus,
    lastAttemptAt: r.lastAttemptAt,
    lastSuccessAt: typeof r.lastSuccessAt === "string" ? r.lastSuccessAt : "",
  };
}

/**
 * Who sees the keep-alive line: the people who see the service-key line in
 * Ayarlar (`settings`), the owner alone today. Managers, staff and cashiers
 * get neither the line nor the read behind it (`readKeepaliveFor`);
 * tests/supabase-keepalive-record.test.ts pins the four roles.
 */
export function keepaliveVisibleTo(role: AdminRole): boolean {
  return canAccess("settings", role);
}

/**
 * Runs `read` only for a role that may see the result; null, with `read`
 * never called, for everyone else. The gate is here, on the server, before
 * any query: the markup is not what keeps the data from a manager.
 */
export function readKeepaliveFor<T>(
  role: AdminRole,
  read: () => Promise<T>,
): Promise<T> | null {
  return keepaliveVisibleTo(role) ? read() : null;
}

/** Whole Istanbul calendar days from the day of `iso` to the day of `now`. */
export function istanbulDaysSince(iso: string, now: Date): number | null {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  const day = (d: string) => {
    const [y, m, dd] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, dd);
  };
  return Math.round(
    (day(istanbulToday(now)) - day(istanbulToday(new Date(at)))) / 86_400_000,
  );
}

/**
 * What the dashboard line says, without the wording of dates (the component
 * formats them like the rest of the dashboard).
 *
 * - `none`: no ping recorded yet. Plain, not a warning: the first record
 *   lands with the next morning's cron.
 * - `fresh`: the last success is at most {@link KEEPALIVE_STALE_DAYS}
 *   Istanbul days old and the latest attempt did not fail.
 * - `failed`: the latest attempt failed, however recent the last success.
 * - `stale`: no success in more than {@link KEEPALIVE_STALE_DAYS} days, or
 *   none ever although the cron has tried.
 * - `unreadable`: the record could not be read.
 *
 * Every state but `none` and `fresh` is a warning.
 */
export type KeepaliveState = "none" | "fresh" | "failed" | "stale" | "unreadable";

export interface KeepaliveView {
  state: KeepaliveState;
  tone: AdminTone;
  /** The last success, or "" when there has been none. */
  lastSuccessAt: string;
  /** The latest attempt; absent for `none` and `unreadable`. */
  lastAttempt?: { status: KeepaliveStatus; at: string };
}

export function keepaliveView(read: KeepaliveRead, now: Date): KeepaliveView {
  if (read.kind === "unreadable") {
    return { state: "unreadable", tone: "warning", lastSuccessAt: "" };
  }
  if (read.kind === "none") {
    return { state: "none", tone: "neutral", lastSuccessAt: "" };
  }
  const { record } = read;
  const lastAttempt = { status: record.lastStatus, at: record.lastAttemptAt };
  const base = { lastSuccessAt: record.lastSuccessAt, lastAttempt };
  if (record.lastStatus === "failed") {
    return { ...base, state: "failed", tone: "warning" };
  }
  const days = record.lastSuccessAt
    ? istanbulDaysSince(record.lastSuccessAt, now)
    : null;
  if (days === null || days > KEEPALIVE_STALE_DAYS) {
    return { ...base, state: "stale", tone: "warning" };
  }
  return { ...base, state: "fresh", tone: "neutral" };
}
