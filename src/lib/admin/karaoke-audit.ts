import "server-only";

import { getDb, TABLES } from "@/lib/db";
import { raiseDbError } from "@/lib/db/health";

import {
  staffReleasedIds,
  unverifiedReleaseIds,
  type KaraokeAuditRow,
} from "./karaoke-panel";

/**
 * The karaoke panel's reads of the audit log: one booking's history (its
 * page's Timeline) and what became of the released holds (the list).
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

/** What the audit log says about released holds (`cancelled` + `expired`). */
export interface KaraokeReleasedHolds {
  /** A panel user let it go. */
  staff: Set<string>;
  /** Let go while the POS could not say whether it was paid (rule 29). */
  unverified: Set<string>;
}

/**
 * Of these released holds, the ones a panel user let go and the ones let go
 * without the POS's answer; the rest lapsed on their own and the list hides
 * them. Read in chunks, one after the other, so a long history does not
 * take the pool.
 */
export async function listReleasedHolds(
  ids: readonly string[],
): Promise<KaraokeReleasedHolds> {
  const out: KaraokeReleasedHolds = { staff: new Set(), unverified: new Set() };
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    const res = await getDb()
      .from(TABLES.auditLogs)
      .select("entityId, action, payload")
      .eq("entity", ENTITY)
      // `transition`: a panel cancel; `update`: alertMoney's money alerts.
      .in("action", ["transition", "update"])
      .in("entityId", chunk);
    if (res.error) {
      raiseDbError("karaoke.listReleasedHolds", res.error, res.status);
    }
    const rows = (res.data ?? []) as Array<
      Pick<KaraokeAuditRow, "entityId" | "action" | "payload">
    >;
    for (const id of staffReleasedIds(rows)) out.staff.add(id);
    for (const id of unverifiedReleaseIds(rows)) out.unverified.add(id);
  }
  return out;
}
