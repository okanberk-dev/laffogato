// Client-safe and pure: who is in the panel now (Kullanıcılar, Innex's
// "Şu an aktif / 3 saat önce", recipe §3.9; 23 Eki 2026). The record is
// written by activity.ts; these are its clock rules.

/** A request seen this recently means the person is in the panel now. */
export const ACTIVE_NOW_MS = 5 * 60_000;

/**
 * How often one server instance writes an address's activity: a page view,
 * an action and the badges' polls each ask for the session, one write a
 * minute is enough for a five-minute window.
 */
export const ACTIVITY_WRITE_EVERY_MS = 60_000;

/**
 * True when `lastSeenAt` (ISO) is within ACTIVE_NOW_MS of `now`. A time
 * from the future (another instance's clock a little ahead) counts as now;
 * an unreadable one never does.
 */
export function isActiveNow(lastSeenAt: string, now: Date): boolean {
  const at = Date.parse(lastSeenAt);
  if (!Number.isFinite(at)) return false;
  return now.getTime() - at < ACTIVE_NOW_MS;
}

/**
 * "Şu an aktif" for a listed account: seen within ACTIVE_NOW_MS, and none
 * of what ends its sessions since. A deactivated account, one whose
 * password, role or access changed after it was seen (`changedAt`, its
 * `updatedAt`; rule 30 signs it out on its next request), and one that
 * pressed Çıkış after it was seen (`signedOutAt`, the newest logout in the
 * audit log) read as not in the panel, whatever the record's age (review
 * of #234: "Pasif" stood beside "Şu an aktif" for five minutes).
 */
export function inPanelNow(
  account: {
    lastSeenAt: string;
    isActive: boolean;
    changedAt: string;
    signedOutAt: string;
  },
  now: Date,
): boolean {
  const { lastSeenAt, isActive, changedAt, signedOutAt } = account;
  if (!isActive || !isActiveNow(lastSeenAt, now)) return false;
  return lastSeenAt > changedAt && lastSeenAt > signedOutAt;
}

/**
 * Whether this instance should write `email`'s activity at `nowMs`, given
 * when it last did (`written`, which it updates). Pure but for the map the
 * caller owns.
 */
export function shouldWriteActivity(
  written: Map<string, number>,
  email: string,
  nowMs: number,
): boolean {
  const last = written.get(email);
  if (last !== undefined && nowMs - last < ACTIVITY_WRITE_EVERY_MS) {
    return false;
  }
  written.set(email, nowMs);
  // A long-lived instance sees each address once a minute at most; the map
  // forgets the quiet ones rather than growing with every address ever
  // signed in.
  if (written.size > 200) {
    for (const [key, at] of written) {
      if (nowMs - at >= ACTIVITY_WRITE_EVERY_MS) written.delete(key);
    }
  }
  return true;
}
