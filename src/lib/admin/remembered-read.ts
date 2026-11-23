import "server-only";

import { unstable_cache } from "next/cache";

import {
  presentationCacheEnabled,
  presentationCacheKey,
} from "@/lib/cache/presentation";
import type { CacheTag } from "@/lib/cache/tags";

import {
  ORDER_ALERT_FULL_REFRESH_MS,
  ORDER_ALERT_MARKER_SETTLE_MS,
  markerMadeAt,
} from "./order-alerts-core";

/**
 * "The last read under this change marker came back as X", kept in the Data
 * Cache so that a caller with no cursor of its own is answered without the
 * database while nothing has been written.
 *
 * The panel's own polls carry a cursor (order-alerts-core "The cheap
 * answer"). The till (LafPOS) and the app do not: the till's 15-minute
 * safety pull of `GET /api/panel/orders` and its 15-minute menu poll each
 * woke the database (Neon sleeps after five idle minutes), eight wakes an
 * hour for as long as a business day was open (docs/DATABASE.md
 * "Uyanmalar", madde 5). Here the route keeps the cursor's place itself.
 *
 * The rules are the cursor's:
 *
 * - The marker is read by the caller BEFORE the database, and is part of
 *   the key. A write that lands during or after the read expires the tag,
 *   the next ask reads a new marker, and whatever was stored under the old
 *   one is never looked up again.
 * - A read made within `ORDER_ALERT_MARKER_SETTLE_MS` of the marker's
 *   making vouches for nothing (the marker may have been stored just after
 *   a write it did not see): it is answered live and nothing is kept.
 * - One live read at least every `ORDER_ALERT_FULL_REFRESH_MS` (the round
 *   in the key), the net under a write whose tag expiry was lost. Unless
 *   `hourly: false`: for an answer that is only a digest of the database
 *   under the marker, standing in for the marker itself (LafPOS's
 *   per-branch version signal, change-marker.ts `readBranchMarker`). A lost
 *   expiry leaves the marker unmoved as well, so the net would add nothing
 *   the marker had, and an hourly read would wake the database all night.
 * - No marker (the cache is off, failing, or under test): live, as before.
 *   So is every failure of the cache itself: more database time, never a
 *   wrong answer.
 *
 * `remember` picks what is kept (plain JSON, no personal data) or null to
 * keep nothing: an answer that changes with the clock alone (an order that
 * ages off the bar screen) must not be remembered, only one that stays
 * true until a write.
 */
export type RememberedRead<L, R> =
  { from: "database"; live: L } | { from: "memory"; remembered: R };

class NothingToRemember extends Error {}

export async function rememberedRead<L, R>(opts: {
  /** Names the entry (with the deployment and the newest migration). */
  name: string;
  /** What else the answer is for, besides the marker (a branch), or "". */
  scope: string;
  /** Read before this call; null always reads the database. */
  marker: string | null;
  /** The tags every write that could change the answer expires. */
  tags: readonly CacheTag[];
  nowMs: number;
  read: () => Promise<L>;
  remember: (live: L) => R | null;
  /** One live read an hour at least (the default); see above. */
  hourly?: boolean;
}): Promise<RememberedRead<L, R>> {
  const { marker, nowMs } = opts;
  const made = marker ? markerMadeAt(marker) : null;
  if (
    !presentationCacheEnabled() ||
    !marker ||
    made === null ||
    nowMs < made + ORDER_ALERT_MARKER_SETTLE_MS
  ) {
    return { from: "database", live: await opts.read() };
  }

  const round =
    opts.hourly === false
      ? "-"
      : String(Math.floor((nowMs - made) / ORDER_ALERT_FULL_REFRESH_MS));
  const run: { started: boolean; live: { value: L } | null } = {
    started: false,
    live: null,
  };
  const cached = unstable_cache(
    async (): Promise<R> => {
      run.started = true;
      const value = await opts.read();
      run.live = { value };
      const kept = opts.remember(value);
      // A throw stores nothing; the read itself is handed back below.
      if (kept === null) throw new NothingToRemember();
      return kept;
    },
    [
      ...presentationCacheKey(`laf-remembered-${opts.name}`),
      opts.scope,
      marker,
      round,
    ],
    { tags: [...opts.tags] },
  );
  try {
    const remembered = await cached();
    if (run.live) return { from: "database", live: run.live.value };
    return { from: "memory", remembered };
  } catch (err) {
    if (run.live) return { from: "database", live: run.live.value };
    // The read failed: the caller's error, as without the cache.
    if (run.started) throw err;
    if (process.env.NODE_ENV === "production") {
      console.warn(
        `[data-cache] ${opts.name} uncached: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return { from: "database", live: await opts.read() };
  }
}
