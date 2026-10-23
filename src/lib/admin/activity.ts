import "server-only";

import { after } from "next/server";

import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import { shouldWriteActivity } from "./activity-core";

// Who is in the panel now (Kullanıcılar: "Şu an aktif", 23 Eki 2026). The
// clock rules are in activity-core.ts; this is the record.

const TABLE = TABLES.adminActivity;

/** This instance's last write per address (activity-core's throttle). */
const written = new Map<string, number>();

const normalize = (email: string) => email.trim().toLowerCase();

/**
 * Notes that `email` was answered just now: one upsert after the response,
 * at most once a minute per address on this instance. Never in the way of
 * the request: outside a request scope it does nothing, and a failed write
 * is logged and dropped (the next minute writes again).
 */
export function noteAdminActivity(email: string, now: Date = new Date()): void {
  const address = normalize(email);
  if (!address) return;
  if (!shouldWriteActivity(written, address, now.getTime())) return;
  try {
    after(async () => {
      try {
        const res = await getDb()
          .from(TABLE)
          .upsert(
            { email: address, lastSeenAt: now.toISOString() },
            { onConflict: "email" },
          );
        if (res.error) {
          raiseDbError("admin.noteAdminActivity", res.error, res.status);
        }
      } catch (err) {
        // The next minute writes again.
        written.delete(address);
        console.error("[admin/activity] etkinlik yazılamadı", err);
      }
    });
  } catch {
    // No request scope (a script, a test): nothing to note.
    written.delete(address);
  }
}

/** The last activity of each address (lower-case), ISO; absent for none. */
export async function lastActivity(
  emails: readonly string[],
): Promise<Map<string, string>> {
  const addresses = [...new Set(emails.map(normalize).filter(Boolean))];
  if (addresses.length === 0) return new Map();
  const res = await getDb()
    .from(TABLE)
    .select("email, lastSeenAt")
    .in("email", addresses);
  if (res.error) raiseDbError("admin.lastActivity", res.error, res.status);
  const out = new Map<string, string>();
  for (const row of (res.data ?? []) as Array<{
    email: string;
    lastSeenAt: string;
  }>) {
    out.set(row.email, row.lastSeenAt);
  }
  return out;
}

/** Drops an address's record: a deleted panel user leaves none behind. */
export async function forgetAdminActivity(email: string): Promise<void> {
  const address = normalize(email);
  written.delete(address);
  const res = await getDb().from(TABLE).delete().eq("email", address);
  if (res.error)
    raiseDbError("admin.forgetAdminActivity", res.error, res.status);
}
