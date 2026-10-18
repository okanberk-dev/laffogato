import {
  parseOrderAlertPayload,
  type OrderAlert,
} from "@/lib/admin/order-alerts-core";

/**
 * The new-order alert's poll, run from a dedicated Worker.
 *
 * Chrome throttles a hidden tab's main-thread timers (to once a minute after
 * five minutes hidden), and the barista's panel is a hidden tab most of the
 * evening. A dedicated worker's timers are not throttled that way, so the
 * worker asks `/admin/siparisler/uyari` every ten seconds and posts each
 * answer to the page. Where a worker cannot start (an old browser, a policy
 * that refuses blob: workers) a main-thread timer does the same.
 *
 * `redirect: "manual"`: without a session the proxy answers a 307 to the
 * sign-in page, and a followed redirect would be that page's HTML with a
 * 200. A redirect therefore reads as "signed out", like a 401, and the poll
 * stops; a 403 (a role without Siparişler) stops it too. Anything else (a
 * 503, the network) is asked again next time.
 */

/** One answer, as the worker posts it. */
export interface PollResponse {
  status: number;
  /** `Response.type`: "opaqueredirect" for a redirect not followed. */
  type: string;
  json: unknown;
}

export type PollOutcome =
  | { kind: "alerts"; alerts: OrderAlert[] }
  | { kind: "stop"; reason: "signed-out" | "forbidden" }
  | { kind: "retry" };

export function interpretPoll(res: PollResponse): PollOutcome {
  if (
    res.type === "opaqueredirect" ||
    res.status === 401 ||
    (res.status >= 300 && res.status < 400)
  ) {
    return { kind: "stop", reason: "signed-out" };
  }
  if (res.status === 403) return { kind: "stop", reason: "forbidden" };
  if (res.status === 200) {
    const parsed = parseOrderAlertPayload(res.json);
    if (parsed) return { kind: "alerts", alerts: parsed.alerts };
  }
  return { kind: "retry" };
}

/** The fetch the poll makes, in both modes. */
export const POLL_FETCH_INIT: RequestInit = {
  credentials: "same-origin",
  cache: "no-store",
  redirect: "manual",
  headers: { accept: "application/json" },
};

/**
 * The worker, as source. Plain ES2017 with no imports, run from a blob: URL
 * (the CSP's `worker-src 'self' blob:`). The page sends the absolute URL: a
 * blob: worker has no path of its own to resolve "/admin/..." against.
 * Protocol: page -> worker `start {url, every}`, `poll`, `stop`;
 * worker -> page one PollResponse per answer.
 */
export const WORKER_SOURCE = `"use strict";
var url = "", every = 10000, timer = 0, busy = false, again = false, stopped = true;
var init = ${JSON.stringify(POLL_FETCH_INIT)};
function poll() {
  if (stopped) return;
  if (busy) { again = true; return; }
  busy = true;
  clearTimeout(timer);
  fetch(url, init).then(function (res) {
    if (res.status !== 200) return { status: res.status, type: res.type, json: null };
    return res.json().then(
      function (json) { return { status: res.status, type: res.type, json: json }; },
      function () { return { status: res.status, type: res.type, json: null }; }
    );
  }, function () {
    return { status: 0, type: "error", json: null };
  }).then(function (msg) {
    busy = false;
    if (stopped) return;
    self.postMessage(msg);
    if (again) { again = false; poll(); return; }
    timer = setTimeout(poll, every);
  });
}
self.onmessage = function (e) {
  var d = e.data || {};
  if (d.type === "start") { url = String(d.url); every = Number(d.every) || 10000; stopped = false; poll(); }
  else if (d.type === "poll") { poll(); }
  else if (d.type === "stop") { stopped = true; clearTimeout(timer); }
};
`;

/** One poll on the main thread: the same request and the same answer shape. */
export async function fetchPollOnce(
  fetchImpl: typeof fetch,
  url: string,
): Promise<PollResponse> {
  try {
    const res = await fetchImpl(url, POLL_FETCH_INIT);
    if (res.status !== 200) {
      return { status: res.status, type: res.type, json: null };
    }
    try {
      return { status: res.status, type: res.type, json: await res.json() };
    } catch {
      return { status: res.status, type: res.type, json: null };
    }
  } catch {
    return { status: 0, type: "error", json: null };
  }
}

/** The slice of a Worker the poller uses. */
export interface WorkerLike {
  postMessage(msg: unknown): void;
  terminate(): void;
  onmessage: ((e: { data: unknown }) => void) | null;
  onerror: ((e: unknown) => void) | null;
}

export interface AlertPoller {
  readonly mode: () => "worker" | "timer";
  /** Ask now (after "Hazırlamaya başla"), then on the usual beat. */
  pollNow(): void;
  stop(): void;
}

export interface PollerOptions {
  url: string;
  intervalMs: number;
  onResponse: (res: PollResponse) => void;
  /** Null when no worker can be made here. */
  createWorker?: () => WorkerLike | null;
  fetchImpl?: typeof fetch;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

/** Starts polling now; a worker when one starts, a timer otherwise. */
export function startAlertPoller(opts: PollerOptions): AlertPoller {
  const setTimer =
    opts.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer =
    opts.clearTimer ??
    ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let stopped = false;
  let worker: WorkerLike | null = null;
  let mode: "worker" | "timer" = "timer";

  // ── Main-thread fallback ──
  let timer: unknown = null;
  let busy = false;
  let again = false;
  const tick = async () => {
    if (stopped) return;
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    if (timer !== null) clearTimer(timer);
    timer = null;
    const res = await fetchPollOnce(opts.fetchImpl ?? fetch, opts.url);
    busy = false;
    if (stopped) return;
    opts.onResponse(res);
    if (stopped) return;
    if (again) {
      again = false;
      void tick();
      return;
    }
    timer = setTimer(() => void tick(), opts.intervalMs);
  };
  const startTimer = () => {
    mode = "timer";
    void tick();
  };

  // ── Worker ──
  try {
    worker = opts.createWorker?.() ?? null;
  } catch {
    worker = null;
  }
  if (worker) {
    mode = "worker";
    const w = worker;
    w.onmessage = (e) => {
      if (!stopped) opts.onResponse(e.data as PollResponse);
    };
    // The worker did not load (refused by a policy, a script error): the
    // timer takes over, once.
    w.onerror = () => {
      if (stopped || worker !== w) return;
      w.terminate();
      worker = null;
      startTimer();
    };
    w.postMessage({ type: "start", url: opts.url, every: opts.intervalMs });
  } else {
    startTimer();
  }

  return {
    mode: () => mode,
    pollNow() {
      if (stopped) return;
      if (worker) worker.postMessage({ type: "poll" });
      else void tick();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (worker) {
        worker.postMessage({ type: "stop" });
        worker.terminate();
        worker = null;
      }
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
  };
}

/** A dedicated worker from WORKER_SOURCE, or null where none can be made. */
export function browserPollWorker(): WorkerLike | null {
  if (typeof Worker !== "function" || typeof Blob !== "function") return null;
  const blobUrl = URL.createObjectURL(
    new Blob([WORKER_SOURCE], { type: "text/javascript" }),
  );
  try {
    const w = new Worker(blobUrl, { name: "laf-order-alerts" });
    // Revoked once the worker has had time to load it; revoking at once
    // can race the load in some engines.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
    return w as unknown as WorkerLike;
  } catch {
    URL.revokeObjectURL(blobUrl);
    return null;
  }
}
