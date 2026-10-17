// Pure toast rules (no React), shared by ui/toast.tsx and its tests.

import type { ActionResult } from "@/lib/admin/action-result";
import type { AdminFlash } from "@/lib/admin/flash-core";

export type ToastTone = "success" | "info" | "warning" | "danger";

export interface ToastInput {
  message: string;
  /** Default `success`. */
  tone?: ToastTone;
  /** Optional bold first line. */
  title?: string;
}

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
  title?: string;
}

/** A success or info toast fades after this long; nothing else does. */
export const TOAST_AUTO_HIDE_MS = 5_000;
/** At most this many on screen; the oldest fading one goes first. */
export const MAX_TOASTS = 4;

/**
 * How long a toast stays: success and info fade after 5 s; a warning or an
 * error waits for the operator, because it asks them to do something ("call
 * the customer") and a message that vanished while they looked away is a
 * message they never got.
 */
export function toastAutoHideMs(tone: ToastTone): number | null {
  return tone === "success" || tone === "info" ? TOAST_AUTO_HIDE_MS : null;
}

/** The list with `toast` added: a repeated id is ignored, the cap holds. */
export function addToast(
  list: readonly Toast[],
  toast: Toast,
  max: number = MAX_TOASTS,
): Toast[] {
  if (list.some((t) => t.id === toast.id)) return [...list];
  const next = [...list, toast];
  while (next.length > Math.max(1, max)) {
    // Drop the oldest toast that would have faded anyway; only when every
    // one is sticky does the oldest sticky one go.
    const fading = next.findIndex((t) => toastAutoHideMs(t.tone) !== null);
    next.splice(fading >= 0 && fading < next.length - 1 ? fading : 0, 1);
  }
  return next;
}

export function removeToast(list: readonly Toast[], id: string): Toast[] {
  return list.filter((t) => t.id !== id);
}

/** What an ActionResult says as a toast. */
export function toastFromResult(result: ActionResult): ToastInput {
  if (result.ok) {
    return { message: result.message, tone: result.tone ?? "success" };
  }
  return { message: result.error, tone: "danger" };
}

/** A flash cookie (lib/admin/flash-core.ts) as a toast, keeping its id. */
export function toastFromFlash(flash: AdminFlash): Toast {
  return { id: `flash-${flash.id}`, message: flash.message, tone: flash.tone };
}

/** Read before the message by a screen reader. */
export const TOAST_TONE_LABEL: Record<ToastTone, string> = {
  success: "Tamam",
  info: "Bilgi",
  warning: "Dikkat",
  danger: "Hata",
};
