import {
  RING_CYCLE_MS,
  addAck,
  alertDisplayOrder,
  alertStillRinging,
  parseAcks,
  pendingAlerts,
  ringLevel,
  type OrderAlert,
  type OrderAlertAcks,
} from "@/lib/admin/order-alerts-core";

/**
 * The new-order alert's state, apart from React and the browser: what is
 * waiting, whether this tab rings, which desktop notifications are up and
 * what the tab title says. Everything it touches comes in through `env`, so
 * the whole behaviour runs in a test with fakes (order-alerts.tsx wires
 * the real Web Audio, Notification, localStorage and document.title).
 *
 * - The LEADER tab (order-alert-leader.ts) polls, rings and notifies, and
 *   hands its list to the other tabs (`share`).
 * - Every tab shows the card stack and the title count from that list,
 *   minus what was acknowledged in any tab (`acks`, shared through
 *   localStorage and its `storage` event).
 * - An order that leaves the list (started, cancelled, older than the
 *   window) stops ringing at the next poll, on every device.
 */

export interface AlertSnapshot {
  /** Waiting, in the card stack's order (table orders first). */
  pending: OrderAlert[];
  leader: boolean;
  /** Sound is wanted but the ringing tab has no audio yet: show the button. */
  needsUnlock: boolean;
}

export interface NotificationHandle {
  close(): void;
}

export interface AlertEnv {
  now(): number;
  readAcks(): string | null;
  writeAcks(raw: string): void;
  soundOn(): boolean;
  audioUnlocked(): boolean;
  ring(level: number): void;
  /** One desktop notification for one order; null when none may be shown. */
  notify(alert: OrderAlert): NotificationHandle | null;
  /** The pending count, for the tab title. */
  setTitleCount(count: number): void;
  /** The leader's list for the other tabs (BroadcastChannel). */
  share(alerts: OrderAlert[], audioLocked: boolean): void;
  /** This tab can ring and the leader cannot: take the lead. */
  claimLead(): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export const EMPTY_ALERT_SNAPSHOT: AlertSnapshot = {
  pending: [],
  leader: false,
  needsUnlock: false,
};

export class OrderAlertController {
  private alerts: OrderAlert[] = [];
  private acks: OrderAlertAcks;
  private leader = false;
  /** Followers: the leader said its audio is locked. */
  private leaderLocked = false;
  /** `claimLead` asked once for this locked leader. */
  private claimed = false;
  private ringTimer: unknown = null;
  private readonly notes = new Map<string, NotificationHandle>();
  private readonly listeners = new Set<() => void>();
  private snapshot: AlertSnapshot = EMPTY_ALERT_SNAPSHOT;
  private disposed = false;

  constructor(private readonly env: AlertEnv) {
    this.acks = parseAcks(env.readAcks(), env.now());
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): AlertSnapshot => this.snapshot;

  isLeader(): boolean {
    return this.leader;
  }

  setLeader(on: boolean): void {
    this.leader = on;
    this.claimed = false;
    if (on) this.leaderLocked = false;
    else this.closeAllNotes();
    this.update();
  }

  /** The leader's poll answered. */
  receive(alerts: OrderAlert[]): void {
    if (!this.leader) return;
    this.alerts = alerts;
    this.update();
  }

  /**
   * The leader's poll answered "nothing changed" (the route's cheap
   * answer): the list stays, minus what has aged out of the ring window
   * by the server's clock (`nowIso`; this tab's clock when it is missing):
   * an order after the order window, a table call after its fifteen
   * minutes (`alertStillRinging`). Shared with the other tabs as any
   * answer is.
   */
  receiveUnchanged(nowIso: string): void {
    if (!this.leader) return;
    const parsed = Date.parse(nowIso);
    const now = Number.isFinite(parsed) ? parsed : this.env.now();
    this.alerts = this.alerts.filter((a) => alertStillRinging(a, now));
    this.update();
  }

  /** A follower heard the leader's list. */
  receiveShared(alerts: OrderAlert[], leaderLocked: boolean): void {
    if (this.leader) return;
    this.alerts = alerts;
    if (!leaderLocked) this.claimed = false;
    this.leaderLocked = leaderLocked;
    this.update();
  }

  /** "Gördüm" (or the order was opened or started from the card). */
  acknowledge(id: string): void {
    this.acks = addAck(this.acks, id, this.env.now());
    try {
      this.env.writeAcks(JSON.stringify(this.acks));
    } catch {
      /* This tab still stops; the others follow at their next change. */
    }
    this.update();
  }

  acknowledgeAll(): void {
    const now = this.env.now();
    for (const a of pendingAlerts(this.alerts, this.acks)) {
      this.acks = addAck(this.acks, a.id, now);
    }
    try {
      this.env.writeAcks(JSON.stringify(this.acks));
    } catch {
      /* As above. */
    }
    this.update();
  }

  /** Another tab wrote the acknowledgements (`storage` event). */
  acksChanged(raw: string | null): void {
    this.acks = parseAcks(raw, this.env.now());
    this.update();
  }

  /** The sound switch, the audio unlock or the notification permission moved. */
  refresh(): void {
    this.update();
  }

  /** The list the leader would share now (a follower just said hello). */
  shareNow(): void {
    if (this.leader) {
      this.env.share(this.alerts, !this.env.audioUnlocked());
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stopRing();
    this.closeAllNotes();
    this.env.setTitleCount(0);
    this.listeners.clear();
  }

  private pending(): OrderAlert[] {
    return alertDisplayOrder(pendingAlerts(this.alerts, this.acks));
  }

  private update(): void {
    if (this.disposed) return;
    const pending = this.pending();
    const unlocked = this.env.audioUnlocked();
    const sound = this.env.soundOn();

    this.env.setTitleCount(pending.length);

    if (this.leader) {
      this.syncNotes(pending);
      this.env.share(this.alerts, !unlocked);
    }

    const shouldRing = this.leader && sound && unlocked && pending.length > 0;
    if (shouldRing && this.ringTimer === null) {
      this.env.ring(ringLevel(pending));
      this.ringTimer = this.env.setInterval(() => this.cycle(), RING_CYCLE_MS);
    } else if (!shouldRing) {
      this.stopRing();
    }

    if (
      !this.leader &&
      !this.claimed &&
      sound &&
      unlocked &&
      this.leaderLocked &&
      pending.length > 0
    ) {
      this.claimed = true;
      this.env.claimLead();
    }

    const needsUnlock =
      sound &&
      pending.length > 0 &&
      !unlocked &&
      (this.leader || this.leaderLocked);
    this.publish({ pending, leader: this.leader, needsUnlock });
  }

  /** Every RING_CYCLE_MS while something waits: ring again, or stop. */
  private cycle(): void {
    const pending = this.pending();
    if (
      !this.leader ||
      !this.env.soundOn() ||
      !this.env.audioUnlocked() ||
      pending.length === 0
    ) {
      this.update();
      return;
    }
    this.env.ring(ringLevel(pending));
  }

  private stopRing(): void {
    if (this.ringTimer !== null) {
      this.env.clearInterval(this.ringTimer);
      this.ringTimer = null;
    }
  }

  private syncNotes(pending: OrderAlert[]): void {
    const ids = new Set(pending.map((a) => a.id));
    for (const [id, note] of this.notes) {
      if (!ids.has(id)) {
        note.close();
        this.notes.delete(id);
      }
    }
    for (const alert of pending) {
      if (this.notes.has(alert.id)) continue;
      const note = this.env.notify(alert);
      if (note) this.notes.set(alert.id, note);
    }
  }

  private closeAllNotes(): void {
    for (const note of this.notes.values()) note.close();
    this.notes.clear();
  }

  private publish(next: AlertSnapshot): void {
    const prev = this.snapshot;
    if (
      prev.leader === next.leader &&
      prev.needsUnlock === next.needsUnlock &&
      prev.pending.length === next.pending.length &&
      prev.pending.every((a, i) => a === next.pending[i])
    ) {
      return;
    }
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}

// ── What the card stack shows while it is being used ─────────────────────

export interface DisplayedAlert {
  alert: OrderAlert;
  /** Gone from the list (seen, started, taken elsewhere): kept in place, inert. */
  done: boolean;
}

/**
 * The stack while the pointer or focus is in it. A card that leaves stays
 * where it was, inert, and a new one joins at the end, so nothing moves
 * under a cursor: a poll that dropped the card above (started on another
 * device), the unlock button going away, or a double click on "Gördüm"
 * must never land the operator's click on ANOTHER order's button.
 * `frozen` is the stack as it was when the pointer came in; null when free,
 * and then the stack is simply `pending`.
 */
export function displayedAlerts(
  frozen: readonly OrderAlert[] | null,
  pending: readonly OrderAlert[],
): DisplayedAlert[] {
  if (!frozen) return pending.map((alert) => ({ alert, done: false }));
  const live = new Map(pending.map((a) => [a.id, a]));
  const kept = frozen.map((a) => {
    const now = live.get(a.id);
    return now ? { alert: now, done: false } : { alert: a, done: true };
  });
  const known = new Set(frozen.map((a) => a.id));
  const joined = pending
    .filter((a) => !known.has(a.id))
    .map((alert) => ({ alert, done: false }));
  return [...kept, ...joined];
}
