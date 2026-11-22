"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * The behaviour a dialog owes a keyboard or screen-reader user.
 *
 * Closes on Escape, locks background scroll, moves focus into the panel when
 * it opens, keeps Tab inside it while it is open, and returns focus to
 * whatever opened it on close.
 *
 * None of this existed: the modals opened with focus still on the page behind
 * them, so a screen-reader user was told a dialog had appeared and then went
 * on reading the page underneath it, and Tab walked straight out of the panel.
 *
 * The drawer variants stay mounted while closed (they animate out), so the
 * caller must also mark the panel `inert` when `open` is false - otherwise its
 * controls stay in the tab order off-screen.
 */
export function useDialog(
  open: boolean,
  onClose: () => void,
  panelRef: RefObject<HTMLElement | null>,
) {
  const openerRef = useRef<HTMLElement | null>(null);
  // The latest onClose, read when Escape is pressed. Callers pass an inline
  // function; depending on it re-ran the open effect on every render (each
  // cart change), which recorded the opener again and threw focus back to
  // the first control.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const active = document.activeElement as HTMLElement | null;
    openerRef.current = active && !panel?.contains(active) ? active : null;

    // Focus moves in on the next frame: a drawer that is still turning
    // visible (its visibility switch, reduced motion's tiny transition)
    // cannot take focus in the same tick. By then a dialog that closed in
    // the same turn (quick look → cart) has put focus back on its own
    // opener, which is the better place to return to later.
    const raf = requestAnimationFrame(() => {
      const now = document.activeElement as HTMLElement | null;
      if (
        now &&
        now !== document.body &&
        !panel?.contains(now) &&
        !now.closest('[aria-modal="true"]')
      ) {
        openerRef.current = now;
      }
      // Prefer the first real control; fall back to the panel itself, which
      // the caller gives tabIndex={-1} so it can hold focus.
      const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel)?.focus?.({ preventScroll: true });
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus?.({ preventScroll: true });
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstItem || active === panel)) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      } else if (!panel.contains(active)) {
        // Focus had slipped out (a click on the page behind): bring it in.
        e.preventDefault();
        (e.shiftKey ? lastItem : firstItem).focus();
      }
    };

    document.addEventListener("keydown", onKey);
    document.body.classList.add("is-no-scroll");
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("is-no-scroll");
    };
  }, [open, panelRef]);

  // Separate effect so focus is restored after the panel has gone, not while
  // it is still holding focus. When another dialog has already taken focus
  // (the cart opened as the quick look closed), it keeps it.
  useEffect(() => {
    if (open) return;
    const opener = openerRef.current;
    openerRef.current = null;
    if (!opener?.isConnected) return;
    const host = document.activeElement?.closest('[aria-modal="true"]');
    if (host && host !== panelRef.current) return;
    opener.focus({ preventScroll: true });
  }, [open, panelRef]);
}
