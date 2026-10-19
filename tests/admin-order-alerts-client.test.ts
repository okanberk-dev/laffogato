import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OrderAlertController,
  displayedAlerts,
  type AlertEnv,
} from "@/components/admin/order-alert-controller";
import {
  electLeader,
  type LocksLike,
} from "@/components/admin/order-alert-leader";
import {
  POLL_FETCH_INIT,
  WORKER_SOURCE,
  fetchPollOnce,
  interpretPoll,
  nextCursor,
  pollUrl,
  startAlertPoller,
  type WorkerLike,
} from "@/components/admin/order-alert-poller";
import {
  RING_CHAIN,
  createRinger,
  scheduleRing,
  type AudioLike,
} from "@/components/admin/order-alert-sound";
import {
  SOUND_KEY,
  markOrderAlertsMounted,
  orderAlertsMounted,
  parseSoundPref,
  readSoundPref,
  shouldListBeep,
  writeSoundPref,
} from "@/components/admin/sound-pref";
import {
  BELL_PARTIALS,
  ORDER_ALERT_ACK_KEY,
  RING_CYCLE_MS,
  ringMotif,
  ringMotifLength,
  titleWithAlerts,
  toOrderAlert,
  type OrderAlert,
  type OrderAlertRow,
} from "@/lib/admin/order-alerts-core";

/**
 * The new-order alert in the browser, without a browser: this suite has
 * no DOM (and the project ships no jsdom), so the component is a thin
 * wire-up over seams that run here with fakes - the controller (what
 * rings, notifies and titles), the Web Locks leader election, the Worker
 * poll and its main-thread twin, the Web Audio schedule - and its markup
 * renders as the server renders it.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/siparisler",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: {
    href: string;
    children?: ReactNode;
    prefetch?: boolean;
  }) => createElement("a", { href, ...rest }, children),
  useLinkStatus: () => ({ pending: false }),
}));
vi.mock("@/app/admin/siparisler/actions", () => ({
  transitionOrderAction: vi.fn(),
  openOrderCountAction: vi.fn(async () => null),
}));

const NOW = Date.parse("2026-10-18T18:00:00.000Z");

function alert(over: Partial<OrderAlertRow> = {}): OrderAlert {
  return toOrderAlert({
    id: "ord-1",
    orderNo: 10234,
    status: "paid",
    kind: "cafe",
    fulfillment: "table",
    tableCode: "T4",
    tableName: "4",
    paidAt: new Date(NOW - 60_000).toISOString(),
    totalMinor: 18_500,
    items: [
      { productName: "Latte", qty: 2 },
      { productName: "Su", qty: 1 },
    ],
    ...over,
  });
}

// ── The controller ───────────────────────────────────────────────────────

function harness() {
  const log = {
    rings: [] as number[],
    notified: [] as string[],
    closed: [] as string[],
    shared: [] as { ids: string[]; locked: boolean }[],
    claims: 0,
    title: "Admin · Siparişler",
  };
  const state = {
    acks: null as string | null,
    unlocked: true,
    sound: true,
  };
  const timers = new Map<number, () => void>();
  let next = 1;
  const env: AlertEnv = {
    now: () => NOW,
    readAcks: () => state.acks,
    writeAcks: (raw) => {
      state.acks = raw;
    },
    soundOn: () => state.sound,
    audioUnlocked: () => state.unlocked,
    ring: (level) => void log.rings.push(level),
    notify: (a) => {
      log.notified.push(a.id);
      return { close: () => void log.closed.push(a.id) };
    },
    setTitleCount: (n) => {
      log.title = titleWithAlerts(log.title, n);
    },
    share: (alerts, locked) =>
      void log.shared.push({ ids: alerts.map((a) => a.id), locked }),
    claimLead: () => {
      log.claims += 1;
    },
    setInterval: (fn, ms) => {
      expect(ms).toBe(RING_CYCLE_MS);
      const id = next++;
      timers.set(id, fn);
      return id;
    },
    clearInterval: (h) => void timers.delete(h as number),
  };
  const tick = () => {
    for (const fn of [...timers.values()]) fn();
  };
  return { env, log, state, timers, tick };
}

describe("the controller: the leader tab", () => {
  it("rings at once and every three seconds, notifies once per order, counts in the title", () => {
    const h = harness();
    const c = new OrderAlertController(h.env);
    c.setLeader(true);
    c.receive([alert()]);
    expect(h.log.rings).toEqual([1]);
    expect(h.timers.size).toBe(1);
    expect(h.log.notified).toEqual(["ord-1"]);
    expect(h.log.title).toBe("(1) Yeni sipariş · Admin · Siparişler");
    expect(c.getSnapshot().pending.map((a) => a.id)).toEqual(["ord-1"]);
    h.tick();
    h.tick();
    expect(h.log.rings).toEqual([1, 1, 1]);
    // The next poll with the same order: no second notification, no second loop.
    c.receive([alert()]);
    expect(h.log.notified).toEqual(["ord-1"]);
    expect(h.timers.size).toBe(1);
    // Followers hear the list and whether this tab can ring.
    expect(h.log.shared.at(-1)).toEqual({ ids: ["ord-1"], locked: false });
  });

  it("rings a gel-al alone a little quieter than a table order", () => {
    const h = harness();
    const c = new OrderAlertController(h.env);
    c.setLeader(true);
    c.receive([alert({ id: "p", fulfillment: "pickup", tableCode: "" })]);
    expect(h.log.rings).toEqual([0.8]);
  });

  it("Gördüm stops the ring, closes the notification, gives the title back and tells the other tabs", () => {
    const h = harness();
    const c = new OrderAlertController(h.env);
    c.setLeader(true);
    c.receive([alert()]);
    c.acknowledge("ord-1");
    expect(h.timers.size).toBe(0);
    expect(h.log.closed).toEqual(["ord-1"]);
    expect(h.log.title).toBe("Admin · Siparişler");
    expect(c.getSnapshot().pending).toEqual([]);
    expect(JSON.parse(h.state.acks!)).toEqual({ "ord-1": NOW });
    h.tick();
    expect(h.log.rings).toEqual([1]);
    // Still in the poll (it is still `paid`): acknowledged, so silent.
    c.receive([alert()]);
    expect(h.log.rings).toEqual([1]);
    expect(h.log.notified).toEqual(["ord-1"]);
  });

  it("an order that leaves the poll (started on another device) stops ringing", () => {
    const h = harness();
    const c = new OrderAlertController(h.env);
    c.setLeader(true);
    c.receive([alert({ id: "a" }), alert({ id: "b", orderNo: 10235 })]);
    expect(h.log.title).toMatch(/^\(2\) /);
    c.receive([alert({ id: "b", orderNo: 10235 })]);
    expect(h.log.closed).toEqual(["a"]);
    expect(h.timers.size).toBe(1);
    expect(h.log.title).toMatch(/^\(1\) /);
    c.receive([]);
    expect(h.timers.size).toBe(0);
    expect(h.log.closed).toEqual(["a", "b"]);
    expect(h.log.title).toBe("Admin · Siparişler");
  });

  it("an acknowledgement written by another tab (storage event) stops it here", () => {
    const h = harness();
    const c = new OrderAlertController(h.env);
    c.setLeader(true);
    c.receive([alert()]);
    c.acksChanged(JSON.stringify({ "ord-1": NOW - 5_000 }));
    expect(h.timers.size).toBe(0);
    expect(c.getSnapshot().pending).toEqual([]);
    h.tick();
    expect(h.log.rings).toEqual([1]);
  });

  it("reads the acknowledgements already stored when it starts", () => {
    const h = harness();
    h.state.acks = JSON.stringify({ "ord-1": NOW - 60_000 });
    const c = new OrderAlertController(h.env);
    c.setLeader(true);
    c.receive([alert()]);
    expect(h.log.rings).toEqual([]);
    expect(h.log.notified).toEqual([]);
  });

  it("with the sound off it shows and notifies but does not ring; on again, it rings", () => {
    const h = harness();
    h.state.sound = false;
    const c = new OrderAlertController(h.env);
    c.setLeader(true);
    c.receive([alert()]);
    expect(h.log.rings).toEqual([]);
    expect(h.log.notified).toEqual(["ord-1"]);
    expect(c.getSnapshot().needsUnlock).toBe(false);
    h.state.sound = true;
    c.refresh();
    expect(h.log.rings).toEqual([1]);
    h.state.sound = false;
    h.tick();
    expect(h.timers.size).toBe(0);
  });

  it("before the first gesture it asks for a tap, and rings once audio is unlocked", () => {
    const h = harness();
    h.state.unlocked = false;
    const c = new OrderAlertController(h.env);
    c.setLeader(true);
    c.receive([alert()]);
    expect(h.log.rings).toEqual([]);
    expect(c.getSnapshot().needsUnlock).toBe(true);
    expect(h.log.shared.at(-1)?.locked).toBe(true);
    h.state.unlocked = true;
    c.refresh();
    expect(h.log.rings).toEqual([1]);
    expect(c.getSnapshot().needsUnlock).toBe(false);
  });

  it("losing the lead closes its notifications and stops ringing; dispose gives the title back", () => {
    const h = harness();
    const c = new OrderAlertController(h.env);
    c.setLeader(true);
    c.receive([alert()]);
    c.setLeader(false);
    expect(h.timers.size).toBe(0);
    expect(h.log.closed).toEqual(["ord-1"]);
    // A follower ignores a poll answer (it does not poll).
    c.receive([alert({ id: "x" })]);
    c.dispose();
    expect(h.log.title).toBe("Admin · Siparişler");
  });
});

describe("the controller: a follower tab", () => {
  it("shows the leader's list and the title, never rings or notifies", () => {
    const h = harness();
    const c = new OrderAlertController(h.env);
    c.setLeader(false);
    c.receiveShared([alert()], false);
    expect(c.getSnapshot().pending).toHaveLength(1);
    expect(h.log.title).toMatch(/^\(1\) /);
    expect(h.log.rings).toEqual([]);
    expect(h.log.notified).toEqual([]);
    expect(h.log.claims).toBe(0);
    c.acknowledge("ord-1");
    expect(h.log.title).toBe("Admin · Siparişler");
  });

  it("takes the lead (once) when it can ring and the leader cannot", () => {
    const h = harness();
    const c = new OrderAlertController(h.env);
    c.setLeader(false);
    c.receiveShared([alert()], true);
    c.receiveShared([alert()], true);
    expect(h.log.claims).toBe(1);
    expect(c.getSnapshot().needsUnlock).toBe(false);
  });

  it("asks for a tap when neither it nor the leader can ring", () => {
    const h = harness();
    h.state.unlocked = false;
    const c = new OrderAlertController(h.env);
    c.receiveShared([alert()], true);
    expect(c.getSnapshot().needsUnlock).toBe(true);
    expect(h.log.claims).toBe(0);
  });
});

describe("the stack holds still under the cursor", () => {
  const a = alert({ id: "a" });
  const b = alert({ id: "b", orderNo: 10235 });
  const c = alert({ id: "c", orderNo: 10236 });

  it("is just the waiting list when nobody holds it", () => {
    expect(displayedAlerts(null, [a, b])).toEqual([
      { alert: a, done: false },
      { alert: b, done: false },
    ]);
  });

  it("keeps a card that left in its place and adds a new one at the end", () => {
    // `a` was started on another device and `c` arrived (a table order the
    // free stack would have put first): neither moves `b`.
    expect(
      displayedAlerts([a, b], [c, b]).map((d) => [d.alert.id, d.done]),
    ).toEqual([
      ["a", true],
      ["b", false],
      ["c", false],
    ]);
  });

  it("shows the newest data for a card still waiting", () => {
    const b2 = { ...b, itemCount: 9 };
    expect(displayedAlerts([a, b], [a, b2])[1].alert.itemCount).toBe(9);
  });
});

// ── One tab leads: Web Locks ─────────────────────────────────────────────

interface Req {
  cb: () => Promise<void>;
  resolve: () => void;
  reject: (e: unknown) => void;
}

/** Enough of the Web Locks semantics: a queue, abort, steal. */
class FakeLocks implements LocksLike {
  holder: Req | null = null;
  queue: Req[] = [];
  request(
    _name: string,
    opts: { steal?: boolean; signal?: AbortSignal },
    cb: () => Promise<void>,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const req: Req = { cb, resolve: () => resolve(undefined), reject };
      opts.signal?.addEventListener("abort", () => {
        const i = this.queue.indexOf(req);
        if (i >= 0) {
          this.queue.splice(i, 1);
          reject(new DOMException("aborted", "AbortError"));
        }
      });
      if (opts.steal) {
        const old = this.holder;
        this.holder = null;
        old?.reject(new DOMException("stolen", "AbortError"));
        this.grant(req);
      } else if (!this.holder) {
        this.grant(req);
      } else {
        this.queue.push(req);
      }
    });
  }
  private grant(req: Req) {
    this.holder = req;
    void req.cb().then(() => {
      if (this.holder !== req) return;
      this.holder = null;
      req.resolve();
      const nextReq = this.queue.shift();
      if (nextReq) this.grant(nextReq);
    });
  }
}

/** FakeLocks granting in a later task, as a browser does. */
class AsyncLocks extends FakeLocks {
  request(
    name: string,
    opts: { steal?: boolean; signal?: AbortSignal },
    cb: () => Promise<void>,
  ): Promise<unknown> {
    return super.request(name, opts, () =>
      new Promise<void>((r) => setTimeout(r, 0)).then(cb),
    );
  }
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("leader election", () => {
  it("hands back a lock granted after it stopped, so another tab can lead", async () => {
    const locks = new AsyncLocks();
    const tabB = electLeader({ locks, name: "x", onChange: () => {} });
    await settle();
    await settle();
    expect(tabB.isLeader()).toBe(true);
    // C's first gesture asks to steal, and C unmounts before the grant.
    const tabC = electLeader({ locks, name: "x", onChange: () => {} });
    tabC.claim();
    tabC.stop();
    for (let i = 0; i < 4; i += 1) await settle();
    expect(tabC.isLeader()).toBe(false);
    expect(tabB.isLeader()).toBe(true);
    // A queued grant that lands in the task after B released it.
    const tabD = electLeader({ locks, name: "x", onChange: () => {} });
    tabB.stop();
    // Granted (D holds it) but its callback has not run yet.
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    expect(locks.holder).not.toBeNull();
    expect(locks.queue).toHaveLength(0);
    tabD.stop();
    for (let i = 0; i < 4; i += 1) await settle();
    const tabE = electLeader({ locks, name: "x", onChange: () => {} });
    for (let i = 0; i < 4; i += 1) await settle();
    expect(tabE.isLeader()).toBe(true);
    tabE.stop();
  });

  it("the first tab leads, the second waits, and takes over when the first goes", async () => {
    const locks = new FakeLocks();
    const a: boolean[] = [];
    const b: boolean[] = [];
    const tabA = electLeader({ locks, name: "x", onChange: (l) => a.push(l) });
    const tabB = electLeader({ locks, name: "x", onChange: (l) => b.push(l) });
    await settle();
    expect(tabA.isLeader()).toBe(true);
    expect(tabB.isLeader()).toBe(false);
    tabA.stop();
    await settle();
    expect(tabB.isLeader()).toBe(true);
    expect(a).toEqual([true]);
    expect(b).toEqual([true]);
    tabB.stop();
  });

  it("a touched tab takes the lead; the one it took it from waits again", async () => {
    const locks = new FakeLocks();
    const a: boolean[] = [];
    const tabA = electLeader({ locks, name: "x", onChange: (l) => a.push(l) });
    const tabB = electLeader({ locks, name: "x", onChange: () => {} });
    await settle();
    tabB.claim();
    await settle();
    expect(tabB.isLeader()).toBe(true);
    expect(tabA.isLeader()).toBe(false);
    expect(a).toEqual([true, false]);
    // B goes away: A, back in the queue, leads again.
    tabB.stop();
    await settle();
    expect(tabA.isLeader()).toBe(true);
    // Claiming while leading changes nothing.
    tabA.claim();
    await settle();
    expect(a).toEqual([true, false, true]);
    tabA.stop();
  });

  it("without Web Locks every tab leads: two ringing tabs beat none", () => {
    const seen: boolean[] = [];
    const tab = electLeader({
      locks: null,
      name: "x",
      onChange: (l) => seen.push(l),
    });
    expect(tab.isLeader()).toBe(true);
    expect(seen).toEqual([true]);
  });
});

// ── The poll ─────────────────────────────────────────────────────────────

describe("what a poll answer means", () => {
  it("alerts on a 200 with the route's shape; stops when signed out or refused; retries the rest", () => {
    const body = { now: "x", alerts: [alert()] };
    expect(interpretPoll({ status: 200, type: "basic", json: body })).toEqual({
      kind: "alerts",
      alerts: [alert()],
    });
    for (const res of [
      { status: 401, type: "basic", json: null },
      // The proxy's 307 to /admin/giris, not followed (redirect: "manual").
      { status: 0, type: "opaqueredirect", json: null },
      { status: 307, type: "basic", json: null },
    ]) {
      expect(interpretPoll(res)).toEqual({
        kind: "stop",
        reason: "signed-out",
      });
    }
    expect(interpretPoll({ status: 403, type: "basic", json: null })).toEqual({
      kind: "stop",
      reason: "forbidden",
    });
    for (const res of [
      { status: 503, type: "basic", json: null },
      { status: 0, type: "error", json: null },
      { status: 200, type: "basic", json: null },
    ]) {
      expect(interpretPoll(res)).toEqual({ kind: "retry" });
    }
  });

  it("asks same-origin with the session cookie, never cached, never following a redirect", () => {
    expect(POLL_FETCH_INIT).toEqual({
      credentials: "same-origin",
      cache: "no-store",
      redirect: "manual",
      headers: { accept: "application/json" },
    });
  });
});

/** Runs WORKER_SOURCE as a worker would, with a fake `self`, fetch and timers. */
function runWorker(
  fetchImpl: (url: string, init: unknown) => Promise<unknown>,
) {
  const posted: unknown[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  const self: {
    postMessage: (m: unknown) => void;
    onmessage?: (e: { data: unknown }) => void;
  } = {
    postMessage: (m) => void posted.push(m),
  };
  new Function("self", "fetch", "setTimeout", "clearTimeout", WORKER_SOURCE)(
    self,
    fetchImpl,
    (fn: () => void, ms: number) => timers.push({ fn, ms }),
    () => {},
  );
  return {
    self,
    posted,
    timers,
    send: (data: unknown) => self.onmessage?.({ data }),
  };
}

describe("the worker", () => {
  it("polls the URL it is given at once and then on its beat, and posts each answer", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 200,
      type: "basic",
      json: async () => ({ now: "n", alerts: [] }),
    }));
    const w = runWorker(fetchImpl);
    w.send({
      type: "start",
      url: "https://laffogato.net/admin/siparisler/uyari",
      every: 10_000,
    });
    await settle();
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://laffogato.net/admin/siparisler/uyari",
      POLL_FETCH_INIT,
    );
    expect(w.posted).toEqual([
      { status: 200, type: "basic", json: { now: "n", alerts: [] } },
    ]);
    expect(w.timers.map((t) => t.ms)).toEqual([10_000]);
    w.timers[0].fn();
    await settle();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    w.send({ type: "stop" });
    w.timers[1].fn();
    await settle();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("posts a redirect, an error status and a network failure without a body", async () => {
    const answers = [
      { status: 0, type: "opaqueredirect", json: async () => ({}) },
      { status: 503, type: "basic", json: async () => ({}) },
    ];
    const fetchImpl = vi.fn(async () => {
      const next = answers.shift();
      if (!next) throw new TypeError("network");
      return next;
    });
    const w = runWorker(fetchImpl);
    w.send({ type: "start", url: "u", every: 10_000 });
    await settle();
    w.send({ type: "poll" });
    await settle();
    w.send({ type: "poll" });
    await settle();
    expect(w.posted).toEqual([
      { status: 0, type: "opaqueredirect", json: null },
      { status: 503, type: "basic", json: null },
      { status: 0, type: "error", json: null },
    ]);
  });

  it("the main-thread twin answers the same", async () => {
    const ok = vi.fn(async () => ({
      status: 200,
      type: "basic",
      json: async () => ({ alerts: [] }),
    }));
    await expect(
      fetchPollOnce(ok as unknown as typeof fetch, "u"),
    ).resolves.toEqual({
      status: 200,
      type: "basic",
      json: { alerts: [] },
    });
    expect(ok).toHaveBeenCalledWith("u", POLL_FETCH_INIT);
    const html = vi.fn(async () => ({
      status: 200,
      type: "basic",
      json: async () => {
        throw new SyntaxError("<");
      },
    }));
    await expect(
      fetchPollOnce(html as unknown as typeof fetch, "u"),
    ).resolves.toEqual({ status: 200, type: "basic", json: null });
    const down = vi.fn(async () => {
      throw new TypeError("offline");
    });
    await expect(
      fetchPollOnce(down as unknown as typeof fetch, "u"),
    ).resolves.toEqual({ status: 0, type: "error", json: null });
  });
});

describe("the poller", () => {
  function fakeWorker() {
    const sent: unknown[] = [];
    const w: WorkerLike & { sent: unknown[]; terminated: boolean } = {
      sent,
      terminated: false,
      postMessage: (m) => void sent.push(m),
      terminate() {
        w.terminated = true;
      },
      onmessage: null,
      onerror: null,
    };
    return w;
  }

  it("runs in a worker: start, poll now, stop", () => {
    const w = fakeWorker();
    const seen: unknown[] = [];
    const p = startAlertPoller({
      url: "https://laffogato.net/admin/siparisler/uyari",
      intervalMs: 10_000,
      onResponse: (r) => void seen.push(r),
      createWorker: () => w,
    });
    expect(p.mode()).toBe("worker");
    expect(w.sent).toEqual([
      {
        type: "start",
        url: "https://laffogato.net/admin/siparisler/uyari",
        every: 10_000,
      },
    ]);
    w.onmessage?.({ data: { status: 200, type: "basic", json: null } });
    expect(seen).toHaveLength(1);
    p.pollNow();
    expect(w.sent.at(-1)).toEqual({ type: "poll" });
    p.stop();
    expect(w.sent.at(-1)).toEqual({ type: "stop" });
    expect(w.terminated).toBe(true);
    w.onmessage?.({ data: {} });
    expect(seen).toHaveLength(1);
  });

  it("waits as long as the server says: hourly when the köşk is closed", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 200,
      type: "basic",
      json: async () => ({ now: "", alerts: [], pollAfterMs: 3_600_000 }),
    }));
    const timers: number[] = [];
    const p = startAlertPoller({
      url: "u",
      intervalMs: 10_000,
      onResponse: () => {},
      createWorker: () => null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      setTimer: (_fn, ms) => timers.push(ms),
      clearTimer: () => {},
    });
    await settle();
    expect(timers).toEqual([3_600_000]);
    p.stop();
  });

  it("the worker source follows pollAfterMs within 5 s and 2 h", () => {
    expect(WORKER_SOURCE).toContain("pollAfterMs");
    expect(WORKER_SOURCE).toContain("Math.min(7200000, Math.max(5000");
  });

  it("falls back to a main-thread timer when the worker cannot start or fails to load", async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 503,
      type: "basic",
      json: async () => null,
    }));
    const timers: number[] = [];
    const seen: unknown[] = [];
    const p = startAlertPoller({
      url: "u",
      intervalMs: 10_000,
      onResponse: (r) => void seen.push(r),
      createWorker: () => {
        throw new Error("blob: refused");
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      setTimer: (_fn, ms) => timers.push(ms),
      clearTimer: () => {},
    });
    expect(p.mode()).toBe("timer");
    await settle();
    expect(seen).toEqual([{ status: 503, type: "basic", json: null }]);
    expect(timers).toEqual([10_000]);
    p.stop();

    const w = fakeWorker();
    const fetch2 = vi.fn(async () => ({
      status: 200,
      type: "basic",
      json: async () => ({ alerts: [] }),
    }));
    const p2 = startAlertPoller({
      url: "u",
      intervalMs: 10_000,
      onResponse: () => {},
      createWorker: () => w,
      fetchImpl: fetch2 as unknown as typeof fetch,
      setTimer: () => 0,
      clearTimer: () => {},
    });
    w.onerror?.(new Event("error"));
    expect(w.terminated).toBe(true);
    expect(p2.mode()).toBe("timer");
    await settle();
    expect(fetch2).toHaveBeenCalledTimes(1);
    p2.stop();
  });
});

// ── The ring ─────────────────────────────────────────────────────────────

function fakeAudio(state = "suspended") {
  const calls: string[] = [];
  const oscillators: {
    freq: number;
    startAt: number;
    stopAt: number;
    target: unknown;
  }[] = [];
  const gains: { peak: number; end: number }[] = [];
  const param = (onRamp?: (v: number, at: number) => void) => ({
    value: 0,
    setValueAtTime: () => undefined,
    exponentialRampToValueAtTime: (v: number, at: number) => onRamp?.(v, at),
  });
  const destination = { name: "speakers" };
  const ctx = {
    currentTime: 10,
    state,
    destination,
    resume: vi.fn(async () => {
      ctx.state = "running";
    }),
    createOscillator: () => {
      const o = {
        type: "",
        freq: 0,
        startAt: 0,
        stopAt: 0,
        target: null as unknown,
        frequency: {
          ...param(),
          setValueAtTime: (v: number) => {
            o.freq = v;
          },
        },
        connect: (t: unknown) => {
          o.target = t;
          return t;
        },
        start: (at: number) => {
          o.startAt = at;
        },
        stop: (at: number) => {
          o.stopAt = at;
          oscillators.push(o);
        },
      };
      return o;
    },
    createGain: () => {
      const g = { peak: 0, end: 0 };
      let ramps = 0;
      const node = {
        gain: param((v, at) => {
          ramps += 1;
          if (ramps === 1) g.peak = v;
          else g.end = at;
          if (ramps === 2) gains.push(g);
        }),
        connect: (t: unknown) => {
          calls.push(t === destination ? "gain->speakers" : "gain->node");
          return t;
        },
      };
      return node;
    },
    createDynamicsCompressor: () => ({
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
      connect: (t: unknown) => {
        calls.push(
          t === destination ? "compressor->speakers" : "compressor->node",
        );
        return t;
      },
    }),
  };
  return { ctx, calls, oscillators, gains };
}

describe("the ring through Web Audio", () => {
  it("strikes every partial of every note, each fading fast, all into the output", () => {
    const { ctx, oscillators, gains } = fakeAudio("running");
    const out = { connect: () => undefined };
    scheduleRing(ctx as unknown as AudioLike, out, 1, 100);
    const notes = ringMotif();
    expect(oscillators).toHaveLength(notes.length * BELL_PARTIALS.length);
    expect(oscillators.slice(0, 3).map((o) => Math.round(o.freq))).toEqual([
      1047, 2888, 5651,
    ]);
    expect(oscillators.every((o) => o.startAt >= 100)).toBe(true);
    expect(Math.max(...oscillators.map((o) => o.stopAt))).toBeLessThanOrEqual(
      100 + ringMotifLength(notes) + 0.05,
    );
    expect(gains[0].peak).toBeCloseTo(0.5, 5);
    expect(gains[1].peak).toBeCloseTo(0.5 * 0.4, 5);
    // A lower level scales every peak.
    const quiet = fakeAudio("running");
    scheduleRing(quiet.ctx as unknown as AudioLike, out, 0.8, 0);
    expect(quiet.gains[0].peak).toBeCloseTo(0.4, 5);
  });

  it("stays silent until a gesture unlocks it, then rings through a compressor", async () => {
    const audio = fakeAudio("suspended");
    const make = vi.fn(() => audio.ctx as unknown as AudioLike);
    const ringer = createRinger(make);
    expect(ringer.ring(1)).toBe(false);
    expect(make).not.toHaveBeenCalled();
    await expect(ringer.unlock()).resolves.toBe(true);
    expect(audio.ctx.resume).toHaveBeenCalled();
    expect(audio.calls).toContain("compressor->speakers");
    expect(audio.calls).toContain("gain->node");
    expect(ringer.ring(1)).toBe(true);
    expect(audio.oscillators.length).toBeGreaterThan(0);
  });

  it("is tuned as measured: loud, not clipping", () => {
    expect(RING_CHAIN).toEqual({
      masterGain: 1.7,
      threshold: -9,
      knee: 6,
      ratio: 6,
      attack: 0.002,
      release: 0.2,
    });
  });

  it("a device without audio is quiet, not broken", async () => {
    const ringer = createRinger(() => null);
    await expect(ringer.unlock()).resolves.toBe(false);
    expect(ringer.ring(1)).toBe(false);
  });
});

// ── One sound switch, and the list beside the alert ─────────────────────

describe("the sound switch", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is the order list's old key, on unless it was turned off", () => {
    expect(SOUND_KEY).toBe("laffogato.admin.orders.sound");
    expect(parseSoundPref(null)).toBe(true);
    expect(parseSoundPref("1")).toBe(true);
    expect(parseSoundPref("0")).toBe(false);
    expect(readSoundPref()).toBe(true);
    writeSoundPref(false);
    expect(store.get(SOUND_KEY)).toBe("0");
    expect(readSoundPref()).toBe(false);
  });

  it("knows whether the panel-wide alert is mounted", () => {
    expect(orderAlertsMounted()).toBe(false);
    const unmount = markOrderAlertsMounted();
    expect(orderAlertsMounted()).toBe(true);
    unmount();
    unmount();
    expect(orderAlertsMounted()).toBe(false);
  });

  it("the order list beeps as before alone, and only for shop orders beside the alert", async () => {
    const countShop = vi.fn(async () => 1);
    await expect(
      shouldListBeep({
        grew: true,
        soundOn: true,
        alertsMounted: false,
        lastShop: 0,
        countShop,
      }),
    ).resolves.toEqual({ beep: true, shop: null });
    expect(countShop).not.toHaveBeenCalled();
    // A cafe order arrived: the alert rings for it, the list stays quiet.
    countShop.mockResolvedValueOnce(0);
    await expect(
      shouldListBeep({
        grew: true,
        soundOn: true,
        alertsMounted: true,
        lastShop: 0,
        countShop,
      }),
    ).resolves.toEqual({ beep: false, shop: 0 });
    // A shop order arrived.
    await expect(
      shouldListBeep({
        grew: true,
        soundOn: true,
        alertsMounted: true,
        lastShop: 0,
        countShop,
      }),
    ).resolves.toEqual({ beep: true, shop: 1 });
    await expect(
      shouldListBeep({
        grew: false,
        soundOn: true,
        alertsMounted: true,
        lastShop: 0,
        countShop,
      }),
    ).resolves.toEqual({ beep: false, shop: null });
    await expect(
      shouldListBeep({
        grew: true,
        soundOn: false,
        alertsMounted: false,
        lastShop: 0,
        countShop,
      }),
    ).resolves.toEqual({ beep: false, shop: null });
  });
});

// ── The markup ───────────────────────────────────────────────────────────

const { OrderAlertPanel, OrderAlertMenu, OrderAlerts } =
  await import("@/components/admin/order-alerts");

function panel(over: Partial<Parameters<typeof OrderAlertPanel>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(OrderAlertPanel, {
      alerts: displayedAlerts(null, [
        alert(),
        alert({
          id: "ord-2",
          orderNo: 10235,
          fulfillment: "pickup",
          tableCode: "",
        }),
      ]),
      unlock: null,
      mayStartPreparing: true,
      busyId: null,
      errors: {},
      onAck: () => {},
      onAckAll: () => {},
      onStart: () => {},
      onUnlock: () => {},
      ...over,
    }),
  );
}

describe("the card stack", () => {
  it("shows each order with Hazırlamaya başla, Siparişi aç and Gördüm", () => {
    const html = panel();
    expect(html).toContain('aria-label="Yeni siparişler"');
    expect(html).toContain("Masa 4");
    expect(html).toContain("Gel-al");
    expect(html).toContain("#10234 · 3 ürün · ₺185,00");
    expect(html).toContain("2× Latte, Su");
    expect(html.match(/Hazırlamaya başla/g)).toHaveLength(2);
    expect(html).toContain('href="/admin/siparisler/ord-1"');
    expect(html.match(/>Gördüm</g)).toHaveLength(2);
    expect(html).toContain("Tümünü gördüm");
    expect(html).not.toContain("Sesi açmak için dokun");
    // Nobody's name, e-mail or phone: the alert never had them.
    expect(html).not.toMatch(/@|05\d{2}/);
  });

  it("leaves Hazırlamaya başla out for a role that may not run it", () => {
    expect(panel({ mayStartPreparing: false })).not.toContain(
      "Hazırlamaya başla",
    );
  });

  it("asks for the tap that unlocks the sound, prominently, and keeps its place after it", () => {
    const html = panel({ unlock: "locked" });
    expect(html).toMatch(
      /<button[^>]*class="[^"]*w-full[^"]*"[^>]*>Sesi açmak için dokun<\/button>/,
    );
    // After the tap the slot stays, same height: the operator's first click
    // must not move the cards between its press and its release.
    const after = panel({ unlock: "on" });
    expect(after).not.toContain("Sesi açmak için dokun");
    expect(after).toMatch(
      /role="status" class="[^"]*min-h-\[44px\][^"]*mt-1 mb-2|role="status" class="mt-1 mb-2 [^"]*min-h-\[44px\]/,
    );
    expect(after).toContain("Ses açık.");
    expect(panel({ unlock: "off" })).toContain("Ses kapalı.");
    expect(panel({ unlock: null })).not.toMatch(
      /Sesi açmak|Ses açık|Ses kapalı/,
    );
  });

  it("keeps a card that was taken care of in place, inert, while the stack is held", () => {
    const html = panel({
      alerts: displayedAlerts(
        [alert(), alert({ id: "ord-2", orderNo: 10235 })],
        [alert({ id: "ord-2", orderNo: 10235 })],
      ),
    });
    expect(html.match(/<article/g)).toHaveLength(2);
    expect(html).toMatch(
      /<article aria-label="Alındı: Masa 4, #10234" data-done=""/,
    );
    // Its own buttons are off; the live one's are on; the count is live only.
    const done = /<article[^>]*data-done=""[^]*?<\/article>/.exec(html)![0];
    expect(done.match(/<button[^>]*disabled=""/g)).toHaveLength(2);
    expect(html).toContain("Yeni sipariş <span");
    expect(html).toContain("(1)");
    expect(html).not.toContain("Tümünü gördüm");
  });

  it("folds to its header with Küçült and says Göster", () => {
    const html = panel({ collapsed: true, onCollapse: () => {} });
    expect(html).not.toContain("<article");
    // Folded, only a locked sound still asks for the tap.
    expect(
      panel({ collapsed: true, onCollapse: () => {}, unlock: "on" }),
    ).not.toContain("Ses açık.");
    expect(
      panel({ collapsed: true, onCollapse: () => {}, unlock: "locked" }),
    ).toContain("Sesi açmak için dokun");
    expect(html).toMatch(/aria-expanded="false"[^>]*>Göster</);
    expect(panel({ onCollapse: () => {} })).toMatch(
      /aria-expanded="true"[^>]*>Küçült</,
    );
  });

  it("shows a refused start under its card", () => {
    expect(
      panel({ errors: { "ord-1": "Sipariş artık ödendi değil." } }),
    ).toMatch(/role="alert"[^>]*>Sipariş artık ödendi değil\./);
  });

  it("is a top-right stack from sm up and a bottom sheet above the shared inset on a phone, without motion for reduced motion", () => {
    const html = panel();
    const section = /<section[^>]*>/.exec(html)![0];
    expect(section).toContain("bottom-[var(--admin-bottom-inset,0px)]");
    expect(section).toContain("pb-[max(0.5rem,env(safe-area-inset-bottom))]");
    expect(section).toContain("sm:top-[4.5rem]");
    expect(section).toContain("sm:right-4");
    expect(section).toContain("z-40");
    expect(section).toContain("print:hidden");
    expect(html).toContain("motion-safe:animate-pulse");
    expect(html).not.toMatch(
      /(?<!motion-safe:)animate-(pulse|bounce|ping|spin)/,
    );
    // Every control is a 44 px target.
    for (const b of html.match(/<(?:button|a)\s[^>]*class="[^"]*"/g) ?? []) {
      expect(b, b).toMatch(/min-h-\[44px\]|min-h-11/);
    }
  });
});

describe("the bell's menu", () => {
  const menu = (
    permission: "granted" | "denied" | "default" | "unsupported",
    soundOn = true,
  ) =>
    renderToStaticMarkup(
      createElement(OrderAlertMenu, {
        soundOn,
        permission,
        onToggleSound: () => {},
        onTest: () => {},
        onAskPermission: () => {},
      }),
    );

  it("has the switch, Sesi dene and the permission in plain Turkish", () => {
    const html = menu("default");
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>.*Açık/);
    expect(html).toContain("Sesi dene");
    expect(html).toContain("Masaüstü bildirimlerini aç");
    expect(html).toContain("Masaüstü bildirimleri kapalı.");
    expect(menu("default", false)).toMatch(
      /aria-pressed="false"[^>]*>.*Kapalı/,
    );
  });

  it("tells a blocked browser where to allow it, and offers no button it cannot answer", () => {
    const html = menu("denied");
    expect(html).not.toContain("Masaüstü bildirimlerini aç");
    expect(html).toContain("site ayarları simgesinden");
    expect(html).toContain("Google Chrome");
    expect(menu("granted")).toContain("Masaüstü bildirimleri açık.");
  });
});

describe("the top-bar control", () => {
  it("is a 44 px bell with aria-pressed (sound on by default), and no card stack before a poll", () => {
    const html = renderToStaticMarkup(
      createElement(OrderAlerts, { mayStartPreparing: true }),
    );
    expect(html).toMatch(
      /<button type="button" aria-pressed="true" aria-label="Yeni sipariş sesi"[^>]*class="[^"]*h-11 w-11/,
    );
    expect(html).toContain('aria-label="Sipariş uyarısı ayarları"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("data-order-alerts");
  });

  it("has its live region in the bar before any order, not in the card stack", () => {
    // A live region inserted with its text already in it is read by no
    // screen reader: it must be on the page, empty, when the first order
    // comes in.
    const bar = renderToStaticMarkup(
      createElement(OrderAlerts, { mayStartPreparing: true }),
    );
    expect(bar).toContain('<p class="sr-only" aria-live="assertive"></p>');
    expect(panel()).not.toContain("aria-live");
  });

  it("keeps the acknowledgements under their own key", () => {
    expect(ORDER_ALERT_ACK_KEY).toBe("laffogato.admin.orderAlerts.acks.v1");
  });
});

// ── The engine, wired to a browser without a DOM ─────────────────────────

describe("the engine", () => {
  afterEach(() => vi.unstubAllGlobals());

  function browser(locks: LocksLike, statuses: number[]) {
    vi.stubGlobal("window", {
      location: { origin: "https://laffogato.test" },
      addEventListener: () => {},
      removeEventListener: () => {},
      setInterval: () => 0,
      clearInterval: () => {},
    });
    vi.stubGlobal("document", { title: "Admin", head: {} });
    vi.stubGlobal("navigator", { locks });
    // One channel per tab would need a real BroadcastChannel; not this test.
    vi.stubGlobal("BroadcastChannel", undefined);
    const fetchMock = vi.fn(async () => {
      const status = statuses.shift() ?? 200;
      return {
        status,
        type: "basic",
        json: async () => ({ now: "", alerts: [] }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("a tab signed out while it leads lets the lock go: a tab signed in again leads without a gesture", async () => {
    const locks = new FakeLocks();
    // A leads and is told it is signed out (the cookie expired).
    const fetchMock = browser(locks, [401, 200]);
    const { startEngine } = await import("@/components/admin/order-alerts");
    const tabA = startEngine(
      () => {},
      () => {},
    );
    for (let i = 0; i < 4; i += 1) await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(tabA.engine.controller.isLeader()).toBe(false);
    // The operator signs in again in another tab and leaves it untouched.
    const tabB = startEngine(
      () => {},
      () => {},
    );
    for (let i = 0; i < 4; i += 1) await settle();
    expect(tabB.engine.controller.isLeader()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    tabA.stop();
    tabB.stop();
  });
});

// ── The cursor: "nothing changed" without the database ──────────────────

describe("the cursor", () => {
  const CURSOR = "a1.mgx1k2-abc123.mgx1kz.0";
  const URL_ = "https://laffogato.net/admin/siparisler/uyari";

  it("an unchanged answer keeps the list; anything else as before", () => {
    expect(
      interpretPoll({
        status: 200,
        type: "basic",
        json: {
          now: "2026-10-18T18:00:00.000Z",
          unchanged: true,
          cursor: CURSOR,
        },
      }),
    ).toEqual({ kind: "unchanged", now: "2026-10-18T18:00:00.000Z" });
    // `unchanged` must be true, not merely present.
    expect(
      interpretPoll({ status: 200, type: "basic", json: { unchanged: "yes" } }),
    ).toEqual({ kind: "retry" });
    // A 401 stays a stop even if a body claimed otherwise.
    expect(
      interpretPoll({ status: 401, type: "basic", json: { unchanged: true } }),
    ).toEqual({ kind: "stop", reason: "signed-out" });
  });

  it("pollUrl appends the cursor; nextCursor keeps it across a failure, drops it on a 200 without one", () => {
    expect(pollUrl(URL_, "")).toBe(URL_);
    expect(pollUrl(URL_, CURSOR)).toBe(`${URL_}?c=${CURSOR}`);
    const ok = (json: unknown) => ({ status: 200, type: "basic", json });
    expect(nextCursor(ok({ alerts: [], cursor: "a1.new" }), CURSOR)).toBe(
      "a1.new",
    );
    expect(nextCursor(ok({ alerts: [] }), CURSOR)).toBe("");
    expect(nextCursor({ status: 503, type: "basic", json: null }, CURSOR)).toBe(
      CURSOR,
    );
    expect(nextCursor({ status: 0, type: "error", json: null }, CURSOR)).toBe(
      CURSOR,
    );
    expect(nextCursor(ok({ cursor: "x".repeat(200) }), CURSOR)).toBe("");
  });

  it("the worker sends the cursor back, and a poll-now goes without it", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url);
      return {
        status: 200,
        type: "basic",
        json: async () =>
          calls.length === 1
            ? { now: "n", alerts: [], cursor: CURSOR }
            : { now: "n", unchanged: true, cursor: CURSOR },
      };
    });
    const w = runWorker(fetchImpl);
    w.send({ type: "start", url: URL_, every: 10_000 });
    await settle();
    w.timers[0].fn();
    await settle();
    w.send({ type: "poll" });
    await settle();
    w.timers.at(-1)?.fn();
    await settle();
    expect(calls).toEqual([
      URL_,
      `${URL_}?c=${CURSOR}`,
      URL_,
      `${URL_}?c=${CURSOR}`,
    ]);
  });

  it("a poll-now that lands while an ask is out still goes without the cursor", async () => {
    const calls: string[] = [];
    let release: () => void = () => {};
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url);
      if (calls.length === 2) await new Promise<void>((r) => (release = r));
      return {
        status: 200,
        type: "basic",
        json: async () => ({ now: "n", alerts: [], cursor: CURSOR }),
      };
    });
    const w = runWorker(fetchImpl);
    w.send({ type: "start", url: URL_, every: 10_000 });
    await settle();
    w.timers[0].fn(); // the second ask, with the cursor, hangs
    await settle();
    w.send({ type: "poll" });
    release();
    await settle();
    expect(calls).toEqual([URL_, `${URL_}?c=${CURSOR}`, URL_]);
  });

  it("the main-thread twin does the same", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url);
      return {
        status: 200,
        type: "basic",
        json: async () => ({ now: "n", alerts: [], cursor: CURSOR }),
      };
    });
    const timers: Array<() => void> = [];
    const p = startAlertPoller({
      url: URL_,
      intervalMs: 10_000,
      onResponse: () => {},
      createWorker: () => null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      setTimer: (fn) => timers.push(fn),
      clearTimer: () => {},
    });
    await settle();
    timers.at(-1)?.();
    await settle();
    p.pollNow();
    await settle();
    p.stop();
    expect(calls).toEqual([URL_, `${URL_}?c=${CURSOR}`, URL_]);
  });

  it("the controller keeps what still rings, drops what aged out, and shares it", () => {
    const { env, log } = harness();
    const c = new OrderAlertController(env);
    c.setLeader(true);
    const fresh = alert({
      id: "ord-new",
      paidAt: new Date(NOW - 60_000).toISOString(),
    });
    const old = alert({
      id: "ord-old",
      paidAt: new Date(NOW - 3.9 * 60 * 60_000).toISOString(),
    });
    c.receive([fresh, old]);
    expect(
      c
        .getSnapshot()
        .pending.map((a) => a.id)
        .sort(),
    ).toEqual(["ord-new", "ord-old"]);
    // Twenty minutes later by the server's clock, nothing changed: the
    // older one is past the four hours and goes, the newer one stays.
    c.receiveUnchanged(new Date(NOW + 20 * 60_000).toISOString());
    expect(c.getSnapshot().pending.map((a) => a.id)).toEqual(["ord-new"]);
    expect(log.shared.at(-1)?.ids).toEqual(["ord-new"]);
    // A follower ignores it, as it ignores a poll answer.
    const f = new OrderAlertController(harness().env);
    f.receiveShared([fresh], false);
    f.receiveUnchanged(new Date(NOW + 5 * 60 * 60_000).toISOString());
    expect(f.getSnapshot().pending.map((a) => a.id)).toEqual(["ord-new"]);
  });
});
