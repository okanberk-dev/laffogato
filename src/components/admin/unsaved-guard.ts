"use client";

import { useEffect, type RefObject } from "react";

/**
 * "Leave the page with unsaved changes?" for a long panel form (admin audit
 * CAT-30: the five-step product wizard was lost to one reload, a closed tab
 * or a typed address). The browser's own question on `beforeunload`; a
 * link inside the panel is a client navigation the browser does not ask
 * about, which a generic guard can take on later.
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
    /** The `beforeunload` listener: asks only when something changed. */
    onBeforeUnload(event: { preventDefault(): void; returnValue?: unknown }) {
      if (!touched || read() === initial) return;
      event.preventDefault();
      // Older Chrome and Safari still want a returnValue set.
      event.returnValue = "";
    },
  };
}

/** Guards `formRef`'s form while it is mounted; `enabled: false` turns it off. */
export function useUnsavedGuard(
  formRef: RefObject<HTMLFormElement | null>,
  { enabled = true }: { enabled?: boolean } = {},
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
    return () => {
      form.removeEventListener("input", touch);
      form.removeEventListener("change", touch);
      window.removeEventListener("beforeunload", guard.onBeforeUnload);
    };
  }, [formRef, enabled]);
}
