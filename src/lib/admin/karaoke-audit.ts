import "server-only";

import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import { staffReleasedIds, type KaraokeAuditRow } from "./karaoke-panel";

/**
 * The karaoke panel's reads of the audit log: one booking's history (its
 * page's Timeline) and which released holds a panel user let go (the list).
 * Both filter on `entity` + `entityId`, so they read a handful of rows, not
 * the whole log the Olay kaydı page pages through.
 */

const ENTITY = "karaoke_reservation";

/** How many ids one `in (...)` read carries. */
const ID_CHUNK = 500;

/** One booking's audit rows, newest first. */
export async function listKaraokeAudit(
  id: string,
  limit = 200,
): Promise<KaraokeAuditRow[]> {
  const res = await getDb()
    .from(TABLES.auditLogs)
    .select("id, entityId, actor, action, payload, createdAt")
    .eq("entity", ENTITY)
    .eq("entityId", id)
    .order("createdAt", { ascending: false })
    .limit(limit);
  if (res.error) {
    raiseDbError("karaoke.listKaraokeAudit", res.error, res.status);
  }
  return (res.data ?? []) as KaraokeAuditRow[];
}

/**
 * Of these released holds (`cancelled` + `expired`), the ones a panel user
 * let go; the rest lapsed on their own and the list hides them. Read in
 * chunks, one after the other, so a long history does not take the pool.
 */
export async function listStaffReleasedHolds(
  ids: readonly string[],
): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    const res = await getDb()
      .from(TABLES.auditLogs)
      .select("entityId, action, payload")
      .eq("entity", ENTITY)
      .eq("action", "transition")
      .in("entityId", chunk);
    if (res.error) {
      raiseDbError("karaoke.listStaffReleasedHolds", res.error, res.status);
    }
    const found = staffReleasedIds(
      (res.data ?? []) as Array<
        Pick<KaraokeAuditRow, "entityId" | "action" | "payload">
      >,
    );
    for (const id of found) out.add(id);
  }
  return out;
}
