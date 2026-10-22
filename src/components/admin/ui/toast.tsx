"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";

import { cx } from "@/components/laffogato/cx";
import type { ActionResult } from "@/lib/admin/action-result";
import {
  clearFlashCookieString,
  type AdminFlash,
} from "@/lib/admin/flash-core";

import { TONE_RULE } from "./tone";
import {
  TOAST_TONE_LABEL,
  addToast,
  removeToast,
  toastAutoHideMs,
  toastFromFlash,
  toastFromResult,
  type Toast,
  type ToastInput,
} from "./toast-core";

export interface ToastApi {
  /** Show a toast; returns its id. */
  show: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
  /** Show what an ActionResult says (success, warning or error). */
  fromResult: (result: ActionResult) => string;
}

// Outside a provider (a test render, a page outside /admin) every call is a
// no-op rather than a crash.
const NOOP: ToastApi = {
  show: () => "",
  dismiss: () => {},
  fromResult: () => "",
};

const ToastContext = createContext<ToastApi>(NOOP);

/** The panel's toasts; ToastProvider is mounted once in app/admin/layout.tsx. */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}

/**
 * Where a portal (ActionModal's dialog) mounts: a node ToastProvider renders
 * INSIDE the admin wrapper, so the `--admin-*` tokens set on that wrapper
 * still apply. document.body as a fallback (outside the panel, in tests).
 */
export function adminPortalRoot(): HTMLElement {
  return (
    document.querySelector<HTMLElement>("[data-admin-portal]") ?? document.body
  );
}

/**
 * Toast stack for the whole panel.
 *
 * - Two live regions, mounted empty so a screen reader is already listening:
 *   errors are `assertive`, everything else `polite`.
 * - Success and info fade after 5 s (paused while hovered or focused);
 *   warnings and errors stay until closed.
 * - Fixed at the bottom; when a sticky bulk bar is on the page
 *   (`data-admin-bulk-bar`, bulk.tsx) the stack sits above it, by the
 *   bar's measured height (`--admin-bulk-space`), so a bulk result is
 *   never hidden behind the bar that triggered it. Above the phone's
 *   bottom bar too: its margin is the shared `--admin-bottom-inset`
 *   (layout.tsx), 0 where there is no bar.
 * - `flash`: the one-shot cookie a redirecting action left
 *   (lib/admin/flash.ts), read by the layout. It is shown once per id and
 *   deleted from the browser as soon as it is on screen.
 */
export function ToastProvider({
  flash = null,
  children,
}: {
  flash?: AdminFlash | null;
  children: ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>(() =>
    flash ? [toastFromFlash(flash)] : [],
  );
  const counter = useRef(0);

  // A new flash (the layout re-rendered after a redirecting action) joins the
  // stack while rendering - React's "adjust state when a prop changes"
  // pattern - so it paints with the page instead of one frame later.
  const flashId = flash?.id ?? null;
  const [seenFlash, setSeenFlash] = useState<string | null>(flashId);
  if (flash && flashId !== seenFlash) {
    setSeenFlash(flashId);
    setToasts((prev) => addToast(prev, toastFromFlash(flash)));
  }

  // One-shot: the cookie goes the moment its toast is on screen.
  useEffect(() => {
    if (flashId) document.cookie = clearFlashCookieString();
  }, [flashId]);

  const api = useMemo<ToastApi>(() => {
    const show = (input: ToastInput) => {
      counter.current += 1;
      const id = `t${counter.current}`;
      const toast: Toast = {
        id,
        message: input.message,
        tone: input.tone ?? "success",
        title: input.title,
      };
      setToasts((prev) => addToast(prev, toast));
      return id;
    };
    return {
      show,
      dismiss: (id) => setToasts((prev) => removeToast(prev, id)),
      fromResult: (result) => show(toastFromResult(result)),
    };
  }, []);

  const urgent = toasts.filter((t) => t.tone === "danger");
  const calm = toasts.filter((t) => t.tone !== "danger");

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div data-admin-portal="" />
      <div
        className={cx(
          "pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col sm:inset-x-auto sm:right-6 sm:w-96",
          "[:root:has([data-admin-bulk-bar])_&]:bottom-[var(--admin-bulk-space,8rem)]",
          "mb-[var(--admin-bottom-inset,0px)]",
        )}
      >
        <ol
          aria-live="assertive"
          aria-atomic="false"
          className={cx(
            "flex flex-col gap-2",
            urgent.length > 0 && calm.length > 0 && "mb-2",
          )}
        >
          {urgent.map((t) => (
            <ToastCard key={t.id} toast={t} dismiss={api.dismiss} />
          ))}
        </ol>
        <ol
          aria-live="polite"
          aria-atomic="false"
          className="flex flex-col gap-2"
        >
          {calm.map((t) => (
            <ToastCard key={t.id} toast={t} dismiss={api.dismiss} />
          ))}
        </ol>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  dismiss,
}: {
  toast: Toast;
  dismiss: (id: string) => void;
}) {
  const [paused, setPaused] = useState(false);
  const ms = toastAutoHideMs(toast.tone);
  const { id } = toast;

  useEffect(() => {
    if (ms === null || paused) return;
    const timer = setTimeout(() => dismiss(id), ms);
    return () => clearTimeout(timer);
  }, [dismiss, id, ms, paused]);

  const onBlur = useCallback((e: FocusEvent<HTMLLIElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setPaused(false);
    }
  }, []);

  const tone = toast.tone;
  return (
    <li
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={onBlur}
      className={cx(
        "pointer-events-auto flex items-start gap-3 rounded-lg border border-l-4 border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 text-sm text-[var(--admin-text)] shadow-[0_8px_24px_rgba(12,14,27,0.14)]",
        TONE_RULE[tone],
      )}
    >
      <div className="min-w-0 flex-1">
        <span className="sr-only">{TOAST_TONE_LABEL[tone]}: </span>
        {toast.title ? (
          <strong className="block font-semibold">{toast.title}</strong>
        ) : null}
        <span className="break-words">{toast.message}</span>
      </div>
      <button
        type="button"
        onClick={() => dismiss(id)}
        aria-label="Bildirimi kapat"
        // 44px, the panel's touch target (it was 32px, SHE-M03); the
        // negative margins keep the card as tall as its text.
        className="-my-2.5 -mr-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-[var(--admin-text-mute)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/45 focus-visible:outline-none pointer-fine:h-9 pointer-fine:w-9"
      >
        <span aria-hidden="true">×</span>
      </button>
    </li>
  );
}
