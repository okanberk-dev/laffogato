"use client";

import { useEffect, type RefObject } from "react";

/**
 * "Leave the page with unsaved changes?" for a long panel form (admin audit
 * CAT-30: the five-step product wizard was lost to one reload, a closed tab
 * or a typed address). The browser's own question on `beforeunload`; a
 * link inside the panel and the palette are client navigations the browser
 * does not ask about: for them the hook holds the panel's shared controller
 * (`hold`, ui/unsaved-guard.ts), which asks with this file's registry.
 *
 * Changed means: the operator typed or picked something in the form (an
 * `input` or `change` event) AND the form's fields now differ from what
 * they were when it opened. So an effect that fills a field by itself
 * does not count, nor a change typed back. A save that succeeds leaves the
 * page by client navigation and unmounts the guard; a refused save stays,
 * still guarded.
 */

/** A form's fields as one comparable string; files by name, size and date. */
export function formSignature(
  entries: Iterable<[string, FormDataEntryValue]>,
): string {
  const parts: string[] = [];
  for (const [name, value] of entries) {
    parts.push(
      typeof value === "string"
        ? `${name}=${value}`
        : `${name}=file:${value.name}:${value.size}:${value.lastModified}`,
    );
  }
  return parts.join("\u0000");
}

/**
 * Said yes to leaving (confirmLeave in ui/unsaved-guard.ts): every
 * `beforeunload` question of the panel stays quiet for a moment, or a link
 * that really unloads the page (a plain anchor) would ask a second time,
 * right after ours. Kept here, next to the registry both guards read, so
 * the wizard's own `beforeunload` hears the yes too.
 */
const LEAVING_MS = 1000;
let leaving = false;

export function markLeaving(): void {
  leaving = true;
  setTimeout(() => {
    leaving = false;
  }, LEAVING_MS);
}

/** Whether the operator has just said yes to leaving (markLeaving). */
export function isLeaving(): boolean {
  return leaving;
}

/** The guard's state, apart from the DOM (exported for tests). */
export function createUnsavedGuard(read: () => string) {
  const initial = read();
  let touched = false;
  return {
    /** The operator typed or picked something. */
    touch() {
      touched = true;
    },
    dirty(): boolean {
      return touched && read() !== initial;
    },
    /**
     * The `beforeunload` listener: asks only when something changed, and
     * not right after a yes to the panel's own question.
     */
    onBeforeUnload(event: { preventDefault(): void; returnValue?: unknown }) {
      if (leaving || !touched || read() === initial) return;
      event.preventDefault();
      // Older Chrome and Safari still want a returnValue set.
      event.returnValue = "";
    },
  };
}

/** The guards mounted now, for a client navigation to ask (hasUnsavedForm). */
const mountedGuards = new Set<{ dirty(): boolean }>();

/** Counts `guard` while its form is mounted; returns the release. */
export function trackUnsavedGuard(guard: { dirty(): boolean }): () => void {
  mountedGuards.add(guard);
  return () => {
    mountedGuards.delete(guard);
  };
}

/**
 * Whether a guarded form on the page has unsaved changes. The browser asks
 * nothing on a client navigation, so the panel's single keys (`g` and a
 * letter, `n`) ask this before they leave the page: a word typed while
 * focus was off the form's fields ("Guatemala") must not drop it.
 */
export function hasUnsavedForm(): boolean {
  for (const guard of mountedGuards) if (guard.dirty()) return true;
  return false;
}

/**
 * Guards `formRef`'s form while it is mounted; `enabled: false` turns it off.
 *
 * `hold` is the panel's shared controller, `acquireLeaveGuard` of
 * ui/unsaved-guard.ts, handed in by the form: that file imports this one,
 * so this one cannot import it (and the single keys' chunk, shortcuts.tsx,
 * loads this file for its registry on every panel page, where the
 * controller has no business). Held for as long as the form is guarded, a
 * link in the panel and the palette ask too; released with it, so the next
 * page is not held back.
 */
export function useUnsavedGuard(
  formRef: RefObject<HTMLFormElement | null>,
  { enabled = true, hold }: { enabled?: boolean; hold?: () => () => void } = {},
): void {
  useEffect(() => {
    const form = formRef.current;
    if (!enabled || !form) return;
    const guard = createUnsavedGuard(() =>
      formSignature(new FormData(form).entries()),
    );
    const touch = () => guard.touch();
    form.addEventListener("input", touch);
    form.addEventListener("change", touch);
    window.addEventListener("beforeunload", guard.onBeforeUnload);
    const untrack = trackUnsavedGuard(guard);
    const release = hold?.();
    return () => {
      untrack();
      release?.();
      form.removeEventListener("input", touch);
      form.removeEventListener("change", touch);
      window.removeEventListener("beforeunload", guard.onBeforeUnload);
    };
  }, [formRef, enabled, hold]);
}
