/**
 * One tab per browser polls and rings for the new-order alert: the holder
 * of a Web Lock. The other tabs wait in the lock's queue, and when the
 * holder closes (or reloads) the next one takes over by itself.
 *
 * The holder should be a tab that may make a sound. A browser unlocks audio
 * per tab, on a gesture in THAT tab, so a holder that was reloaded and never
 * touched would ring into nothing while the operator works in another tab.
 * `claim()` is called from a tab's first gesture: it takes the lock over
 * (`steal`), and the tab that lost it goes back into the queue.
 *
 * Without `navigator.locks` every tab leads: two tabs ringing beats none.
 */

/** The slice of the Web Locks API this uses (a test passes a fake). */
export interface LocksLike {
  request(
    name: string,
    options: { mode?: "exclusive"; steal?: boolean; signal?: AbortSignal },
    callback: () => Promise<void>,
  ): Promise<unknown>;
}

export interface Leadership {
  /** Take the lead now (this tab was just touched). */
  claim(): void;
  isLeader(): boolean;
  stop(): void;
}

export function electLeader({
  locks,
  name,
  onChange,
}: {
  locks: LocksLike | null | undefined;
  name: string;
  onChange: (leader: boolean) => void;
}): Leadership {
  let leader = false;
  let stopped = false;
  /** Releases the lock this tab holds (resolves the held promise). */
  let release: (() => void) | null = null;
  /** Aborts this tab's place in the queue. */
  let queued: AbortController | null = null;

  const set = (next: boolean) => {
    if (next === leader || stopped) return;
    leader = next;
    onChange(next);
  };

  if (!locks) {
    set(true);
    return {
      claim() {},
      isLeader: () => !stopped && leader,
      stop() {
        stopped = true;
      },
    };
  }

  const held = () =>
    new Promise<void>((resolve) => {
      release = resolve;
      set(true);
    });

  /** The lock is gone from under us (stolen) or never came: wait again. */
  const lost = (attempt: object) => {
    if (stopped || attempt !== current) return;
    release = null;
    set(false);
    queue();
  };

  let current: object = {};

  function queue() {
    if (stopped) return;
    const ac = new AbortController();
    queued = ac;
    const attempt = {};
    current = attempt;
    locks!.request(name, { mode: "exclusive", signal: ac.signal }, held).then(
      () => lost(attempt),
      () => lost(attempt),
    );
  }

  queue();

  return {
    claim() {
      if (stopped || leader) return;
      // Leave the queue, then take the lock from whoever holds it.
      queued?.abort();
      queued = null;
      const attempt = {};
      current = attempt;
      locks.request(name, { mode: "exclusive", steal: true }, held).then(
        () => lost(attempt),
        () => lost(attempt),
      );
    },
    isLeader: () => !stopped && leader,
    stop() {
      if (stopped) return;
      stopped = true;
      queued?.abort();
      queued = null;
      release?.();
      release = null;
      leader = false;
    },
  };
}
