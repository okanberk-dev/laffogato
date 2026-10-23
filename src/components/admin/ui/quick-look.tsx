"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";

import { QUICK_LOOK_PARAM, sameListAddress } from "@/lib/admin/quick-look-core";

import { AdminIcon } from "./icons";
import { ToastScope } from "./toast";

/**
 * Where the last quick look was opened from by a click on this page: the
 * list's address then, and the link pressed. Set by QuickLookOpener's
 * listener, read once by the drawer when it closes.
 */
let openedFrom: { list: string; link: HTMLAnchorElement } | null = null;

/** A plain left click on a link that opens a quick look on this list. */
function quickLookLink(e: globalThis.MouseEvent): HTMLAnchorElement | null {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return null;
  }
  const link = (e.target as Element | null)?.closest?.("a[href]");
  if (!(link instanceof HTMLAnchorElement) || link.target) return null;
  const to = new URL(link.href, window.location.href);
  if (to.origin !== window.location.origin) return null;
  if (to.pathname !== window.location.pathname) return null;
  return to.searchParams.has(QUICK_LOOK_PARAM) ? link : null;
}

/**
 * Notes, on a list that has a quick look, which row's link opened it: the
 * drawer gives that link its focus back when it closes, and closes with the
 * browser's Back (the open pushed the drawer's address, so Back is the list
 * as it was, its scroll and all). Renders nothing.
 */
export function QuickLookOpener() {
  useEffect(() => {
    const onClick = (e: globalThis.MouseEvent) => {
      const link = quickLookLink(e);
      if (!link) return;
      const here = new URL(window.location.href);
      // A row of a list whose drawer is already open (behind the modal
      // there is none to press): the list is the address without it.
      here.searchParams.delete(QUICK_LOOK_PARAM);
      openedFrom = { list: `${here.pathname}${here.search}`, link };
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      // Off the list: nothing it noted holds anywhere else.
      openedFrom = null;
    };
  }, []);
  return null;
}

/** The first link on the page, visible, that opens `href`'s quick look. */
function rowLinkFor(href: string): HTMLAnchorElement | null {
  const want = new URL(href, window.location.href);
  for (const a of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (a.closest("dialog")) continue;
    const to = new URL(a.href, window.location.href);
    if (
      to.pathname === want.pathname &&
      to.searchParams.get(QUICK_LOOK_PARAM) ===
        want.searchParams.get(QUICK_LOOK_PARAM) &&
      a.getClientRects().length > 0
    ) {
      return a;
    }
  }
  return null;
}

/**
 * A record beside its list (Innex's right drawer, innex-15; 23 Eki 2026):
 * 420 px from the right edge (the whole screen on a phone), a title row
 * with the close button, a body that scrolls, and a bottom bar with the
 * record's primary step on the right.
 *
 * Drawn open by the server (it shows without JavaScript), then made modal:
 * focus stays inside, Esc and a click on the dimmed list close it, the list
 * behind is inert. Closing goes back to the list: with the browser's Back
 * when a row on this page opened it (the open pushed its address), else by
 * replacing the address with the list's. The row that opened it gets the
 * focus back.
 */
export function QuickLook({
  title,
  eyebrow,
  subtitle,
  closeHref,
  selfHref,
  children,
  footer,
}: {
  title: string;
  /** Above the title: what kind of record ("Mağaza ürünü · Kahve"). */
  eyebrow?: ReactNode;
  /** Under the title: its short line ("3 fincanlık, alüminyum"). */
  subtitle?: ReactNode;
  /** The list as it was: where closing goes. */
  closeHref: string;
  /** This drawer's own address: the row link that opens it has it. */
  selfHref: string;
  children: ReactNode;
  /** The bottom bar; the primary step last (on the right). */
  footer?: ReactNode;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const downOnBackdrop = useRef(false);
  const leaving = useRef(false);
  /** The row link pressed to open it, if this page's click opened it. */
  const opener = useRef<HTMLAnchorElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.matches(":modal")) {
      // Open as drawn, but not modal: closed and opened again as a modal.
      // The `close` this fires is ignored (the dialog is open again by
      // the time it runs).
      if (dialog.open) dialog.close();
      dialog.showModal();
    }
    // The title first: a screen reader starts with what is open.
    headingRef.current?.focus();
    return () => {
      // The row that opened it, once the list is drawn without it.
      requestAnimationFrame(() => {
        const link = opener.current;
        const target =
          link && link.isConnected && link.getClientRects().length > 0
            ? link
            : rowLinkFor(selfHref);
        target?.focus({ preventScroll: true });
      });
    };
  }, [selfHref]);

  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    const from = openedFrom;
    openedFrom = null;
    opener.current = from?.link ?? null;
    // Back only to the list a row of this page left: a link noted on a
    // page left since (the drawer reopened by Back, then closed) is not
    // on the page any more.
    if (
      from &&
      from.link.isConnected &&
      sameListAddress(from.list, closeHref)
    ) {
      router.back();
    } else {
      router.replace(closeHref, { scroll: false });
    }
  };

  const close = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    else leave();
  };

  // A click that both started and ended on the dimmed list closes it; one
  // that started inside (selecting text, then dragging out) does not.
  const onMouseDown = (e: MouseEvent<HTMLDialogElement>) => {
    downOnBackdrop.current = e.target === e.currentTarget;
  };
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (downOnBackdrop.current && e.target === e.currentTarget) close();
    downOnBackdrop.current = false;
  };

  return (
    <dialog
      ref={dialogRef}
      open
      aria-labelledby={titleId}
      onClose={() => {
        // The non-modal open made modal again (see the effect): stay.
        if (dialogRef.current?.open) return;
        leave();
      }}
      onMouseDown={onMouseDown}
      onClick={onClick}
      className="fixed inset-y-0 right-0 left-auto z-40 m-0 hidden h-dvh max-h-none w-full max-w-none flex-col border-0 border-l border-[var(--admin-border)] bg-[var(--admin-surface)] p-0 text-[var(--admin-text)] shadow-[0_12px_40px_rgba(12,14,27,0.18)] transition-[translate,opacity] duration-200 ease-out backdrop:bg-[rgba(12,14,27,0.2)] open:flex motion-reduce:transition-none sm:w-[26.25rem] starting:translate-x-6 starting:opacity-0 print:hidden"
      style={{ fontFamily: "var(--font-admin-sans), var(--sans)" }}
    >
      {/* The drawer's own toasts, above its bottom bar: the panel's stack
          is behind the modal (ToastScope). */}
      <ToastScope className="pointer-events-none absolute inset-x-4 bottom-20 z-10 flex flex-col">
        <div className="flex items-start gap-3 border-b border-[var(--admin-border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <p className="text-xs font-medium text-[var(--admin-text-soft)]">
                {eyebrow}
              </p>
            ) : null}
            <h2
              ref={headingRef}
              id={titleId}
              tabIndex={-1}
              className="mt-0.5 text-lg leading-snug font-semibold break-words text-[var(--admin-text)]"
              // Focused by script for a screen reader, never reached with Tab:
              // no ring (the site's `[tabindex]:focus-visible` draws one).
              style={{ outline: "none", boxShadow: "none" }}
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-[var(--admin-text-soft)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <Link
            href={closeHref}
            scroll={false}
            replace
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)
                return;
              e.preventDefault();
              close();
            }}
            aria-label="Kapat"
            className="-mt-1 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[var(--admin-text-mute)] hover:bg-[var(--admin-panel)] hover:text-[var(--admin-text)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 focus-visible:outline-none pointer-fine:h-9 pointer-fine:w-9"
          >
            <AdminIcon name="close" />
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <div className="flex flex-col gap-6">{children}</div>
        </div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--admin-border)] px-5 py-3">
            {footer}
          </div>
        ) : null}
      </ToastScope>
    </dialog>
  );
}
