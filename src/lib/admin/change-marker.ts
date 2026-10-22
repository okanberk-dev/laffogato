import "server-only";

import { randomBytes } from "node:crypto";

import { unstable_cache } from "next/cache";

import type { WeeklyHours } from "@/lib/admin/days";
import { getSettings } from "@/lib/admin/store";
import {
  presentationCache,
  presentationCacheEnabled,
  presentationCacheKey,
} from "@/lib/cache/presentation";
import {
  TAG_ACCESS,
  TAG_KARAOKE,
  TAG_ORDERS,
  TAG_SITE,
  TAG_VENUE,
} from "@/lib/cache/tags";
import {
  getVenueStatus,
  isCafeOpenNow,
  type VenueManualOverride,
} from "@/lib/mobile/venue";

import {
  ORDER_ALERT_BUSY_OFFSETS_MIN,
  isChangeMarker,
} from "./order-alerts-core";

/**
 * "Has anything changed since you last asked?", answered without the
 * database.
 *
 * The panel's background polls (the new-order bell, the nav badges, the
 * order list's count) asked the database every 10 to 60 seconds, and the
 * database (Neon, free plan) only sleeps after five idle minutes: a panel
 * tab left open kept it awake for the whole opening day, and a till screen
 * for the whole night (docs/DATABASE.md "Uyanmalar"). The top bar's köşk
 * chip (venue-signal.ts) was built on the same markers from the start.
 *
 * A marker is a random token kept in the Data Cache under the table's tag.
 * There is no database read inside: a miss simply makes a new token. Every
 * write to the table expires the tag (src/lib/cache/tags.ts, from the data
 * layer), so the next read makes a new token, and a poll that holds the old
 * one knows to read again. A marker that cannot be read is null, and null
 * always means "read the database": a broken cache costs compute, never a
 * missed order.
 *
 * Markers carry no data. Whatever is read when one moves goes through the
 * normal checks (the account re-read, rule 30). Every marker also sits
 * under `live:access`, which every write to the panel accounts expires: a
 * user deactivated, demoted or given a new password moves it too, so the
 * "nothing changed" answer lasts only while no account changed since the
 * full answer that re-read this session's account (the poll cursors are
 * bound to that session, poll-binding.ts).
 */

export type ChangeMarkerKind = "orders" | "karaoke" | "venue";

const MARKER_TAGS: Record<ChangeMarkerKind, readonly string[]> = {
  orders: [TAG_ORDERS, TAG_ACCESS],
  karaoke: [TAG_KARAOKE, TAG_ACCESS],
  // The köşk chip (venue-signal.ts): `venue_status` (`live:venue`) and the
  // settings (the posted hours, `pub:site`).
  venue: [TAG_SITE, TAG_VENUE, TAG_ACCESS],
};

/** "<now base36>-<64 random bits base36>" (order-alerts-core `isChangeMarker`). */
export function newChangeMarker(now: number = Date.now()): string {
  return `${now.toString(36)}-${randomBytes(8).readBigUInt64BE().toString(36)}`;
}

/** The current marker of `kind`, or null when the cache cannot say. */
export async function readChangeMarker(
  kind: ChangeMarkerKind,
): Promise<string | null> {
  if (!presentationCacheEnabled()) return null;
  try {
    const marker = await unstable_cache(
      async () => newChangeMarker(),
      presentationCacheKey(`laf-marker-${kind}`),
      { tags: [...MARKER_TAGS[kind]] },
    )();
    return isChangeMarker(marker) ? marker : null;
  } catch {
    return null;
  }
}

// ── Is the köşk busy? (only the bell's cadence depends on it) ────────────

/**
 * Open now, within the next hour, or closed under half an hour ago: the
 * override first, the posted hours otherwise (`ORDER_ALERT_BUSY_OFFSETS_MIN`).
 */
export function busyAt(
  hours: WeeklyHours,
  override: VenueManualOverride,
  nowMs: number,
): boolean {
  return ORDER_ALERT_BUSY_OFFSETS_MIN.some((min) =>
    isCafeOpenNow(hours, override, new Date(nowMs + min * 60_000)),
  );
}

const cachedBusyInputs = presentationCache(
  "panel-busy-inputs",
  async (): Promise<{
    weeklyHours: WeeklyHours;
    manualOverride: VenueManualOverride;
  }> => {
    const [settings, venue] = await Promise.all([
      getSettings(),
      getVenueStatus(),
    ]);
    return {
      weeklyHours: settings.weeklyHours,
      manualOverride: venue.manualOverride,
    };
  },
  [TAG_SITE, TAG_VENUE],
);

/**
 * `busyAt` from the cached hours and override, for the "nothing changed"
 * answer. It decides only how soon the bell asks again; whether an app
 * order may be placed is decided live, in `placeAppOrder`. A read that fails
 * answers "busy": a missed sleep costs compute, a missed order costs a guest.
 */
export async function cachedBusyWindow(nowMs: number): Promise<boolean> {
  try {
    const { weeklyHours, manualOverride } = await cachedBusyInputs();
    return busyAt(weeklyHours, manualOverride, nowMs);
  } catch {
    return true;
  }
}
