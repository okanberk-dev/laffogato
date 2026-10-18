"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { transitionOrderAction } from "@/app/admin/siparisler/actions";
import {
  ORDER_ALERT_ACK_KEY,
  ORDER_ALERT_PATH,
  ORDER_ALERT_POLL_MS,
  notificationBody,
  notificationPermissionText,
  notificationTag,
  notificationTitle,
  orderAlertHeading,
  orderAlertTime,
  parseOrderAlertPayload,
  titleWithAlerts,
  type AlertPermission,
  type OrderAlert,
} from "@/lib/admin/order-alerts-core";
import { formatTRYMinor } from "@/lib/utils/commerce";

import {
  EMPTY_ALERT_SNAPSHOT,
  OrderAlertController,
  displayedAlerts,
  type AlertSnapshot,
  type DisplayedAlert,
  type NotificationHandle,
} from "./order-alert-controller";
import {
  electLeader,
  type Leadership,
  type LocksLike,
} from "./order-alert-leader";
import {
  browserPollWorker,
  interpretPoll,
  startAlertPoller,
  type AlertPoller,
} from "./order-alert-poller";
import { browserAudio, createRinger, type Ringer } from "./order-alert-sound";
import {
  markOrderAlertsMounted,
  readSoundPref,
  subscribeSound,
  useSoundPref,
  writeSoundPref,
} from "./sound-pref";
import { announceAdminChange } from "./ui/admin-changed";
import { BUTTON, NUMERIC_STYLE } from "./ui/styles";
import { adminPortalRoot, useToast } from "./ui/toast";

/**
 * The new-order alert: a paid table or gel-al order rings every computer
 * that has the panel open in Chrome, loud and repeating like a delivery
 * platform's partner tablet, until someone answers it (order-alerts-core.ts
 * says which orders). Mounted once, in the top bar's `actions` slot, for
 * roles with Siparişler.
 *
 * - The bell in the top bar is the panel-wide sound switch (the order list
 *   reads the same one, sound-pref.ts) and opens a short menu: "Sesi dene",
 *   desktop notifications and what the browser allows.
 * - While an order waits: the ring every three seconds, one desktop
 *   notification per order, a card stack (top right; a sheet at the bottom
 *   on a phone, above the shared bottom inset) and "(n) Yeni sipariş" in the
 *   tab title.
 * - One tab per browser polls and rings (Web Locks); every tab shows the
 *   cards. "Gördüm" in any tab is "Gördüm" in all of them.
 *
 * Chrome must stay open with the panel in some tab: there is no push when
 * the browser is closed (that needs a service worker and Web Push).
 */

const LOCK_NAME = "laffogato-order-alerts";
const CHANNEL_NAME = "laffogato-order-alerts";

// ── Notification permission, as an external store ────────────────────────

const permissionListeners = new Set<() => void>();

function readPermission(): AlertPermission {
  if (typeof Notification === "undefined") return "unsupported";
  const p = Notification.permission;
  return p === "granted" || p === "denied" ? p : "default";
}

function subscribePermission(onChange: () => void): () => void {
  permissionListeners.add(onChange);
  // Changed in the browser's own settings while the panel was open.
  window.addEventListener("focus", onChange);
  return () => {
    permissionListeners.delete(onChange);
    window.removeEventListener("focus", onChange);
  };
}

/** From a click: the browser asks only in answer to a gesture. */
async function askPermission(): Promise<void> {
  if (typeof Notification === "undefined") return;
  try {
    await Notification.requestPermission();
  } catch {
    /* Refused or unsupported; the text below says what is left. */
  } finally {
    for (const listener of permissionListeners) listener();
  }
}

function showNotification(
  alert: OrderAlert,
  open: (id: string) => void,
): NotificationHandle | null {
  if (readPermission() !== "granted") return null;
  try {
    const note = new Notification(notificationTitle(alert), {
      body: notificationBody(alert),
      tag: notificationTag(alert),
      requireInteraction: true,
    });
    note.onclick = () => {
      window.focus();
      note.close();
      open(alert.id);
    };
    return note;
  } catch {
    // Android Chrome refuses page notifications (service workers only).
    return null;
  }
}

// ── The engine, wired to the browser ─────────────────────────────────────

interface Engine {
  controller: OrderAlertController;
  ringer: Ringer;
  leadership: Leadership;
  pollNow(): void;
}

function readAcks(): string | null {
  try {
    return window.localStorage.getItem(ORDER_ALERT_ACK_KEY);
  } catch {
    return null;
  }
}

function writeAcks(raw: string): void {
  try {
    window.localStorage.setItem(ORDER_ALERT_ACK_KEY, raw);
  } catch {
    /* This tab still stops ringing. */
  }
}

/** The pointer and key events that count as a gesture for audio. */
const GESTURES = ["pointerdown", "pointerup", "keydown", "touchend"] as const;

function startEngine(
  onSnapshot: (snap: AlertSnapshot) => void,
  openOrder: (id: string) => void,
): { engine: Engine; stop: () => void } {
  const unmark = markOrderAlertsMounted();
  const ringer = createRinger(browserAudio);
  const channel =
    typeof BroadcastChannel === "function"
      ? new BroadcastChannel(CHANNEL_NAME)
      : null;
  let poller: AlertPoller | null = null;
  let signedOut = false;
  let titleCount = 0;
  // Set right below; the controller only asks for it after a poll.
  let leadershipRef: Leadership | null = null;

  const applyTitle = () => {
    const next = titleWithAlerts(document.title, titleCount);
    if (document.title !== next) document.title = next;
  };

  const controller = new OrderAlertController({
    now: () => Date.now(),
    readAcks,
    writeAcks,
    soundOn: readSoundPref,
    audioUnlocked: () => ringer.unlocked(),
    ring: (level) => void ringer.ring(level),
    notify: (alert) =>
      showNotification(alert, (id) => {
        controller.acknowledge(id);
        openOrder(id);
      }),
    setTitleCount: (n) => {
      titleCount = n;
      applyTitle();
    },
    share: (alerts, locked) =>
      channel?.postMessage({ type: "alerts", alerts, locked }),
    claimLead: () => leadershipRef?.claim(),
    setInterval: (fn, ms) => window.setInterval(fn, ms),
    clearInterval: (h) => window.clearInterval(h as number),
  });
  const unsubscribe = controller.subscribe(() =>
    onSnapshot(controller.getSnapshot()),
  );

  const stopPolling = () => {
    poller?.stop();
    poller = null;
  };
  const startPolling = () => {
    if (poller || signedOut) return;
    poller = startAlertPoller({
      url: new URL(ORDER_ALERT_PATH, window.location.origin).toString(),
      intervalMs: ORDER_ALERT_POLL_MS,
      createWorker: browserPollWorker,
      onResponse: (res) => {
        const out = interpretPoll(res);
        if (out.kind === "alerts") {
          controller.receive(out.alerts);
        } else if (out.kind === "stop") {
          // Signed out or no longer allowed: the page itself says so on the
          // next navigation; the alert goes quiet now.
          signedOut = true;
          stopPolling();
          controller.receive([]);
        }
      },
    });
  };

  const leadership = electLeader({
    locks: (navigator as Navigator & { locks?: LocksLike }).locks ?? null,
    name: LOCK_NAME,
    onChange: (lead) => {
      controller.setLeader(lead);
      if (lead) startPolling();
      else stopPolling();
    },
  });
  leadershipRef = leadership;

  const onChannel = (e: MessageEvent) => {
    const d = (e.data ?? {}) as {
      type?: string;
      alerts?: unknown;
      locked?: unknown;
    };
    if (d.type === "alerts") {
      const parsed = parseOrderAlertPayload({ alerts: d.alerts });
      if (parsed) controller.receiveShared(parsed.alerts, d.locked === true);
    } else if (d.type === "hello") {
      controller.shareNow();
    } else if (d.type === "poll") {
      poller?.pollNow();
    }
  };
  channel?.addEventListener("message", onChannel);
  // A new tab asks the leader for its list instead of waiting for the poll.
  channel?.postMessage({ type: "hello" });

  const onStorage = (e: StorageEvent) => {
    if (e.key === ORDER_ALERT_ACK_KEY) controller.acksChanged(e.newValue);
    else if (e.key === null) controller.acksChanged(null);
  };
  window.addEventListener("storage", onStorage);
  const unsubscribeSound = subscribeSound(() => controller.refresh());

  // The first gesture in this tab unlocks its audio, and the tab the
  // operator is using becomes the one that rings (order-alert-leader.ts).
  const onGesture = () => {
    if (ringer.unlocked()) return;
    void ringer.unlock().then((ok) => {
      if (!ok) return;
      for (const g of GESTURES) window.removeEventListener(g, onGesture, true);
      controller.refresh();
      leadership.claim();
    });
  };
  for (const g of GESTURES) window.addEventListener(g, onGesture, true);

  // Next sets the title on every navigation; the count goes back on.
  const titleObserver =
    typeof MutationObserver === "function"
      ? new MutationObserver(() => {
          if (titleCount > 0) applyTitle();
        })
      : null;
  titleObserver?.observe(document.head, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  const engine: Engine = {
    controller,
    ringer,
    leadership,
    pollNow: () => {
      if (controller.isLeader()) poller?.pollNow();
      else channel?.postMessage({ type: "poll" });
    },
  };

  return {
    engine,
    stop: () => {
      unmark();
      leadership.stop();
      stopPolling();
      unsubscribe();
      controller.dispose();
      channel?.removeEventListener("message", onChannel);
      channel?.close();
      window.removeEventListener("storage", onStorage);
      unsubscribeSound();
      for (const g of GESTURES) window.removeEventListener(g, onGesture, true);
      titleObserver?.disconnect();
    },
  };
}

// ── The component ────────────────────────────────────────────────────────

export function OrderAlerts({
  mayStartPreparing,
}: {
  /** `orderActions` offers this role "Hazırlamaya başla" on a paid order. */
  mayStartPreparing: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const soundOn = useSoundPref();
  const permission = useSyncExternalStore(
    subscribePermission,
    readPermission,
    () => "default" as AlertPermission,
  );
  const [snap, setSnap] = useState<AlertSnapshot>(EMPTY_ALERT_SNAPSHOT);
  // Where the menu opens (fixed, under the bell); null while it is closed.
  // A portal rather than a child of the top bar: on a phone the bar is its
  // own stacking context (sticky, z-30) and the card sheet would cover it.
  const [menuAt, setMenuAt] = useState<{ top: number; right: number } | null>(
    null,
  );
  const menuOpen = menuAt !== null;
  // The orders on screen when "Küçült" was pressed: a new one opens it again.
  const [collapsedFor, setCollapsedFor] = useState<string[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // The stack as it was when the pointer or focus came into it
  // (displayedAlerts): nothing moves under a cursor. Null when free.
  const [frozen, setFrozen] = useState<OrderAlert[] | null>(null);
  const frozenRef = useRef(false);
  const unfreezeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Once the unlock button was on screen it keeps its place (as "Ses açık"
  // after the tap) until the stack empties: removing it moved every card
  // up between the press and the release of the operator's first click.
  const [unlockSlot, setUnlockSlot] = useState(false);
  const engine = useRef<Engine | null>(null);
  const routerRef = useRef(router);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    const onSnapshot = (next: AlertSnapshot) => {
      setSnap(next);
      if (next.pending.length === 0) {
        setUnlockSlot(false);
        setFrozen(null);
        frozenRef.current = false;
      } else if (next.needsUnlock && !frozenRef.current) {
        setUnlockSlot(true);
      }
    };
    const { engine: started, stop } = startEngine(onSnapshot, (id) =>
      routerRef.current.push(`/admin/siparisler/${id}`),
    );
    engine.current = started;
    return () => {
      engine.current = null;
      if (unfreezeTimer.current) clearTimeout(unfreezeTimer.current);
      stop();
    };
  }, []);

  // The menu closes on a click outside it, on Esc, and when the page moves
  // under it (it is fixed to where the bell was).
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuAt(null);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      const menu = document.getElementById(MENU_ID);
      if (!menuRef.current?.contains(t) && !menu?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menuOpen]);

  const toggleMenu = () => {
    if (menuOpen) {
      setMenuAt(null);
      return;
    }
    const r = menuRef.current?.getBoundingClientRect();
    if (!r) return;
    setMenuAt({
      top: Math.round(r.bottom + 8),
      right: Math.max(8, Math.round(window.innerWidth - r.right)),
    });
  };

  const unlockThen = (then?: (e: Engine) => void) => {
    const e = engine.current;
    if (!e) return;
    void e.ringer.unlock().then((ok) => {
      e.controller.refresh();
      if (ok) e.leadership.claim();
      then?.(e);
    });
  };

  const toggleSound = () => {
    const next = !readSoundPref();
    writeSoundPref(next);
    // The click is also the gesture a browser wants before it plays.
    if (next) unlockThen();
  };

  // One ring at full level, whatever is waiting.
  const testSound = () => unlockThen((e) => void e.ringer.ring(1));

  const acknowledge = (id: string) =>
    engine.current?.controller.acknowledge(id);

  const startPreparing = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setErrors(({ [id]: _drop, ...rest }) => rest);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("transition", "start_preparing");
    try {
      const res = await transitionOrderAction(null, fd);
      if (res.ok) {
        // It left `paid`: the next poll drops it everywhere; this stops it now.
        engine.current?.controller.acknowledge(id);
        toast.fromResult(res);
        announceAdminChange();
        engine.current?.pollNow();
      } else {
        setErrors((prev) => ({ ...prev, [id]: res.error }));
      }
    } catch {
      setErrors((prev) => ({
        ...prev,
        [id]: "Bağlantı kurulamadı. Tekrar dene ya da siparişi aç.",
      }));
    } finally {
      setBusyId(null);
    }
  };

  const pending = snap.pending;
  const collapsed =
    collapsedFor !== null && pending.every((a) => collapsedFor.includes(a.id));
  const shown = displayedAlerts(frozen, pending);

  const freeze = () => {
    if (unfreezeTimer.current) clearTimeout(unfreezeTimer.current);
    unfreezeTimer.current = null;
    if (frozenRef.current) return;
    frozenRef.current = true;
    setFrozen(pending);
  };
  // A moment after the pointer leaves (or focus goes): a second tap right
  // after the first still finds the stack where it was.
  const unfreezeSoon = () => {
    if (unfreezeTimer.current) clearTimeout(unfreezeTimer.current);
    unfreezeTimer.current = setTimeout(() => {
      unfreezeTimer.current = null;
      frozenRef.current = false;
      setFrozen(null);
    }, UNFREEZE_MS);
  };

  return (
    <>
      <div ref={menuRef} className="relative flex items-center print:hidden">
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={soundOn}
          aria-label="Yeni sipariş sesi"
          title={
            soundOn
              ? "Yeni sipariş sesi açık. Kapatmak için bas."
              : "Yeni sipariş sesi kapalı. Açmak için bas."
          }
          className="relative grid h-11 w-11 place-items-center rounded-l-lg border border-[var(--admin-border)] text-[var(--admin-text-soft)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] aria-pressed:text-[var(--admin-primary)]"
        >
          <BellIcon muted={!soundOn} />
          {pending.length > 0 ? (
            <span
              className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--admin-danger)] px-1 text-[11px] leading-none font-semibold text-white"
              aria-hidden="true"
            >
              {pending.length}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={toggleMenu}
          aria-expanded={menuOpen}
          aria-controls={MENU_ID}
          aria-label="Sipariş uyarısı ayarları"
          className="grid h-11 w-8 place-items-center rounded-r-lg border border-l-0 border-[var(--admin-border)] text-[var(--admin-text-soft)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      {menuAt
        ? createPortal(
            <OrderAlertMenu
              style={{ top: menuAt.top, right: menuAt.right }}
              soundOn={soundOn}
              permission={permission}
              onToggleSound={toggleSound}
              onTest={testSound}
              onAskPermission={() => {
                void askPermission().then(() =>
                  engine.current?.controller.refresh(),
                );
              }}
            />,
            adminPortalRoot(),
          )
        : null}
      {pending.length > 0
        ? createPortal(
            <OrderAlertPanel
              alerts={shown}
              collapsed={collapsed}
              held={frozen !== null}
              onHold={freeze}
              onRelease={unfreezeSoon}
              onCollapse={(on) =>
                setCollapsedFor(on ? pending.map((a) => a.id) : null)
              }
              unlock={
                snap.needsUnlock && (unlockSlot || !frozen)
                  ? "locked"
                  : unlockSlot
                    ? soundOn
                      ? "on"
                      : "off"
                    : null
              }
              mayStartPreparing={mayStartPreparing}
              busyId={busyId}
              errors={errors}
              onAck={acknowledge}
              onAckAll={() => engine.current?.controller.acknowledgeAll()}
              onStart={(id) => void startPreparing(id)}
              onUnlock={() => unlockThen()}
            />,
            adminPortalRoot(),
          )
        : null}
    </>
  );
}

function BellIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5a5 5 0 0 0-5 5v3c0 1.2-.5 2.3-1.3 3.2L5 15.5h14l-.7-.8a4.7 4.7 0 0 1-1.3-3.2v-3a5 5 0 0 0-5-5Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
      {muted ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

// ── The bell's menu ──────────────────────────────────────────────────────

const MENU_ID = "order-alert-menu";

/** How long the stack stays put after the pointer leaves it. */
const UNFREEZE_MS = 900;

export function OrderAlertMenu({
  style,
  soundOn,
  permission,
  onToggleSound,
  onTest,
  onAskPermission,
}: {
  /** `top` / `right`, fixed under the bell. */
  style?: CSSProperties;
  soundOn: boolean;
  permission: AlertPermission;
  onToggleSound: () => void;
  onTest: () => void;
  onAskPermission: () => void;
}) {
  return (
    <div
      id={MENU_ID}
      role="group"
      aria-label="Sipariş uyarısı"
      style={style}
      className="fixed z-50 w-[min(20rem,calc(100vw-1rem))] rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 text-sm text-[var(--admin-text)] shadow-[0_8px_24px_rgba(44,29,17,0.14)] print:hidden"
    >
      <p className="font-semibold">Yeni sipariş uyarısı</p>
      <p className="mt-1 text-xs text-[var(--admin-text-soft)]">
        Ödenen masa ve gel-al siparişlerinde çalar, biri &quot;Gördüm&quot;
        diyene ya da hazırlamaya başlayana kadar.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={onToggleSound}
          aria-pressed={soundOn}
          className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] px-4 py-2 text-sm text-[var(--admin-text-soft)] hover:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none"
        >
          <span>Ses</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              soundOn
                ? "bg-[var(--admin-success-soft)] text-[var(--admin-success)]"
                : "bg-[var(--admin-neutral-soft)] text-[var(--admin-text-soft)]"
            }`}
          >
            {soundOn ? "Açık" : "Kapalı"}
          </span>
        </button>
        <button type="button" onClick={onTest} className={BUTTON.ghost}>
          Sesi dene
        </button>
        {permission === "default" ? (
          <button
            type="button"
            onClick={onAskPermission}
            className={BUTTON.ghost}
          >
            Masaüstü bildirimlerini aç
          </button>
        ) : null}
      </div>
      <p
        className={`mt-3 text-xs ${
          permission === "denied"
            ? "text-[var(--admin-danger-ink)]"
            : "text-[var(--admin-text-soft)]"
        }`}
      >
        {notificationPermissionText(permission)}
      </p>
      <p className="mt-2 text-xs text-[var(--admin-text-mute)]">
        Chrome açık ve panel bir sekmede açıkken çalar. Bu tarayıcıda yalnız bir
        sekme çalar.
      </p>
    </div>
  );
}

// ── The card stack ───────────────────────────────────────────────────────

export interface OrderAlertPanelProps {
  alerts: DisplayedAlert[];
  /** "Küçült": only the header bar, until a new order comes in. */
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  /** The pointer or focus came in / went out (the stack holds still). */
  held?: boolean;
  onHold?: () => void;
  onRelease?: () => void;
  /**
   * The audio slot: "locked" shows "Sesi açmak için dokun"; once it was
   * shown it keeps its place with "Ses açık" / "Ses kapalı"; null: none.
   */
  unlock: "locked" | "on" | "off" | null;
  mayStartPreparing: boolean;
  busyId: string | null;
  errors: Record<string, string>;
  onAck: (id: string) => void;
  onAckAll: () => void;
  onStart: (id: string) => void;
  onUnlock: () => void;
}

/**
 * Top right from `sm` up; below it a sheet across the bottom, above
 * `--admin-bottom-inset` (the phone tab bar, when there is one) and the
 * home indicator. z-40: over the top bar and the bulk bar, under the
 * toasts (a result toast stays readable) and the modal dialogs.
 */
export function OrderAlertPanel(props: OrderAlertPanelProps) {
  const { alerts, collapsed = false } = props;
  const live = alerts.filter((d) => !d.done).map((d) => d.alert);
  const first = live[0];
  return (
    <section
      aria-label="Yeni siparişler"
      data-order-alerts=""
      data-collapsed={collapsed ? "" : undefined}
      data-held={props.held ? "" : undefined}
      onPointerEnter={props.onHold}
      onPointerDown={props.onHold}
      onPointerLeave={props.onRelease}
      onFocus={props.onHold}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          props.onRelease?.();
        }
      }}
      className="fixed inset-x-0 bottom-[var(--admin-bottom-inset,0px)] z-40 max-h-[60dvh] overflow-y-auto rounded-t-2xl border-t border-[var(--admin-border-strong)] bg-[var(--admin-bg)] px-3 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[var(--admin-text)] shadow-[0_-8px_24px_rgba(44,29,17,0.18)] sm:inset-x-auto sm:top-[4.5rem] sm:right-4 sm:bottom-auto sm:max-h-[calc(100dvh-6rem)] sm:w-[22rem] sm:rounded-2xl sm:border sm:pb-3 sm:shadow-[0_12px_32px_rgba(44,29,17,0.2)] print:hidden"
    >
      <div className="flex min-h-11 items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Yeni sipariş{" "}
          <span className="text-[var(--admin-text-soft)]">({live.length})</span>
        </h2>
        <div className="flex items-center gap-3">
          {live.length > 1 && !collapsed ? (
            <button
              type="button"
              onClick={props.onAckAll}
              className={BUTTON.link}
            >
              Tümünü gördüm
            </button>
          ) : null}
          {props.onCollapse ? (
            <button
              type="button"
              onClick={() => props.onCollapse?.(!collapsed)}
              aria-expanded={!collapsed}
              className={BUTTON.link}
            >
              {collapsed ? "Göster" : "Küçült"}
            </button>
          ) : null}
        </div>
      </div>
      <p className="sr-only" aria-live="assertive">
        {first ? `${notificationTitle(first)}. ${notificationBody(first)}` : ""}
      </p>
      {props.unlock === "locked" ? (
        <button
          type="button"
          onClick={props.onUnlock}
          className={`${BUTTON.dangerSolid} mt-1 mb-2 w-full`}
        >
          Sesi açmak için dokun
        </button>
      ) : props.unlock && !collapsed ? (
        <p
          role="status"
          className="mt-1 mb-2 flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--admin-surface-2)] px-4 text-sm text-[var(--admin-text-soft)]"
        >
          {props.unlock === "on" ? "Ses açık." : "Ses kapalı."}
        </p>
      ) : null}
      {collapsed ? null : (
        <ul className="mt-1 flex flex-col gap-2">
          {alerts.map(({ alert: a, done }) => (
            <li key={a.id}>
              <OrderAlertCard
                alert={a}
                done={done}
                mayStart={props.mayStartPreparing}
                busy={props.busyId === a.id}
                disabled={done || props.busyId !== null}
                error={props.errors[a.id]}
                onAck={() => props.onAck(a.id)}
                onStart={() => props.onStart(a.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function itemsLine(alert: OrderAlert): ReactNode {
  const shown = alert.items.join(", ");
  return alert.moreItems > 0 ? `${shown} +${alert.moreItems}` : shown;
}

function OrderAlertCard({
  alert,
  done,
  mayStart,
  busy,
  disabled,
  error,
  onAck,
  onStart,
}: {
  alert: OrderAlert;
  /** Taken care of (seen, started, taken elsewhere): same size, inert. */
  done: boolean;
  mayStart: boolean;
  busy: boolean;
  disabled: boolean;
  error?: string;
  onAck: () => void;
  onStart: () => void;
}) {
  return (
    <article
      aria-label={`${done ? "Alındı" : orderAlertHeading(alert)}: ${alert.label}, #${alert.orderNo}`}
      data-done={done ? "" : undefined}
      className={`rounded-xl border border-l-4 bg-[var(--admin-surface)] p-3 shadow-sm ${
        done
          ? "border-[var(--admin-border)] border-l-[var(--admin-border-strong)] opacity-60"
          : alert.table
            ? "border-[var(--admin-border)] border-l-[var(--admin-danger)]"
            : "border-[var(--admin-border)] border-l-[var(--admin-accent)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--admin-accent-ink)]">
            <span
              aria-hidden="true"
              className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                done
                  ? "bg-[var(--admin-text-mute)]"
                  : "bg-[var(--admin-danger)] motion-safe:animate-pulse"
              }`}
            />
            {done ? "Alındı" : orderAlertHeading(alert)}
          </p>
          <p className="truncate text-xl leading-tight font-semibold">
            {alert.label}
          </p>
        </div>
        <span
          className="shrink-0 pt-0.5 text-xs text-[var(--admin-text-soft)]"
          style={NUMERIC_STYLE}
        >
          {orderAlertTime(alert.paidAt)}
        </span>
      </div>
      <p className="mt-1 text-sm text-[var(--admin-text-soft)]">
        #{alert.orderNo} · {alert.itemCount} ürün ·{" "}
        {formatTRYMinor(alert.totalMinor)}
      </p>
      {alert.items.length > 0 ? (
        <p className="mt-0.5 text-sm break-words">{itemsLine(alert)}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-[var(--admin-danger-ink)]">
          {error}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {mayStart ? (
          <button
            type="button"
            onClick={onStart}
            disabled={disabled}
            aria-busy={busy || undefined}
            className={`${BUTTON.primary} w-full`}
          >
            {busy ? "Başlatılıyor…" : "Hazırlamaya başla"}
          </button>
        ) : null}
        <Link
          href={`/admin/siparisler/${alert.id}`}
          onClick={onAck}
          className={`${BUTTON.ghost} flex-1`}
        >
          Siparişi aç
        </Link>
        <button
          type="button"
          onClick={onAck}
          disabled={done}
          className={`${BUTTON.ghost} flex-1`}
        >
          Gördüm
        </button>
      </div>
    </article>
  );
}
