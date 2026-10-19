"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { adminPortalRoot } from "@/components/admin/ui/toast";
import type { PaletteNavGroup } from "@/lib/admin/palette-core";
import {
  isApplePlatform,
  isPaletteShortcut,
  PALETTE_FALLBACK_HREF,
  paletteShortcutLabel,
} from "@/lib/admin/palette-shell";
import type { AdminRole } from "@/lib/admin/roles";

import { forgetRecents, watchRecentPage } from "./recents";

/*
 * The panel's ⌘K palette, the part every page loads (admin UI v2, UI-6,
 * design §4.1). Small on purpose: the trigger, the key, the native
 * <dialog> and the recents recorder. The list itself (palette.tsx, with
 * React Aria) is a chunk of its own, asked for on the first sign the
 * operator is about to open it: the key, a click, the pointer or focus
 * reaching the trigger, a touch.
 */

const loadPalette = () => import("./palette");

const Palette = dynamic(() => import("./palette").then((m) => m.Palette), {
  ssr: false,
  loading: () => <PaletteLoading />,
});

function PaletteLoading() {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-3">
      <SearchIcon />
      <p role="status" className="text-sm text-[var(--admin-text-mute)]">
        Yükleniyor…
      </p>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </svg>
  );
}

const noSubscribe = () => () => {};

/** ⌘K on Apple keyboards, Ctrl K elsewhere; null until mounted. */
function useShortcutLabel(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => paletteShortcutLabel(isApplePlatform(navigator)),
    () => null,
  );
}

/** Another modal is up (an ActionModal, the phone drawer, the alert). */
function otherDialogOpen(own: HTMLDialogElement | null): boolean {
  return [...document.querySelectorAll("dialog[open]")].some((d) => d !== own);
}

export interface PaletteTriggerProps {
  /** The role's nav, as the sidebar draws it (already filtered). */
  groups: PaletteNavGroup[];
  role: AdminRole;
  /** The layout's opaque per-account key ("" turns the recents off). */
  accountKey: string;
}

export function PaletteTrigger({
  groups,
  role,
  accountKey,
}: PaletteTriggerProps) {
  const pathname = usePathname();
  const label = useShortcutLabel();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const preload = useCallback(() => {
    void loadPalette().catch(() => {
      // The click loads it again; next/dynamic shows the error state then.
    });
  }, []);

  const show = useCallback(() => {
    if (otherDialogOpen(dialogRef.current)) return;
    preload();
    setSession((n) => n + 1);
    setOpen(true);
  }, [preload]);

  // ⌘K / Ctrl+K anywhere in the panel, in a field too. Capture phase: a
  // field's own key handling (React Aria's included) stops propagation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPaletteShortcut(e)) return;
      const own = dialogRef.current;
      if (own?.open) {
        e.preventDefault();
        own.close();
        return;
      }
      if (otherDialogOpen(own)) return;
      e.preventDefault();
      show();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [show]);

  // Son açılanlar: another account's list in this tab goes, and this
  // page is kept when it is a record page the rules allow.
  useEffect(() => {
    forgetRecents(undefined, accountKey);
  }, [accountKey]);
  useEffect(
    () =>
      watchRecentPage({
        pathname,
        accountKey,
        root: () => document.getElementById("admin-main"),
      }),
    [pathname, accountKey],
  );

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // A new tab or window gets the results page, as without JavaScript.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    show();
  };

  const onClosed = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <>
      <a
        ref={triggerRef}
        href={PALETTE_FALLBACK_HREF}
        onClick={onClick}
        onPointerEnter={preload}
        onFocus={preload}
        onTouchStart={preload}
        aria-label="Ara"
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        data-admin-palette-trigger=""
        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[var(--admin-border)] text-[var(--admin-text-soft)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] lg:flex lg:w-72 lg:items-center lg:justify-start lg:gap-2.5 lg:rounded-xl lg:border-[var(--admin-border-field)] lg:bg-[var(--admin-surface)] lg:px-3 xl:w-80"
      >
        <SearchIcon />
        <span className="hidden flex-1 text-left text-sm text-[var(--admin-text-mute)] lg:inline">
          Ara
        </span>
        {label ? (
          <kbd
            className="hidden rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-1.5 py-0.5 text-[11px] leading-4 text-[var(--admin-text-soft)] lg:inline"
            style={{ fontFamily: "inherit" }}
          >
            {label}
          </kbd>
        ) : null}
      </a>
      {open
        ? createPortal(
            <PaletteDialog
              key={session}
              dialogRef={dialogRef}
              onClosed={onClosed}
              groups={groups}
              role={role}
              accountKey={accountKey}
              pathname={pathname}
            />,
            adminPortalRoot(),
          )
        : null}
    </>
  );
}

function PaletteDialog({
  dialogRef,
  onClosed,
  groups,
  role,
  accountKey,
  pathname,
}: PaletteTriggerProps & {
  dialogRef: RefObject<HTMLDialogElement | null>;
  onClosed: () => void;
  pathname: string;
}) {
  const downOnBackdrop = useRef(false);

  // Modal before the list's own effects run: React Aria focuses the box in
  // a passive effect, and a field in a closed dialog cannot take focus.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, [dialogRef]);

  const close = useCallback(() => dialogRef.current?.close(), [dialogRef]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Panelde ara"
      data-admin-palette=""
      onClose={onClosed}
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) close();
        downOnBackdrop.current = false;
      }}
      className="fixed inset-x-0 top-3 bottom-auto mx-auto my-0 max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-0 text-[var(--admin-text)] shadow-[0_24px_64px_rgba(44,29,17,0.28)] backdrop:bg-[rgba(44,29,17,0.45)] open:flex sm:top-[12vh] sm:max-h-[min(76dvh,640px)] print:hidden"
      style={{ fontFamily: "var(--font-poppins), var(--sans)" }}
    >
      <Palette
        groups={groups}
        role={role}
        accountKey={accountKey}
        pathname={pathname}
        close={close}
      />
    </dialog>
  );
}
