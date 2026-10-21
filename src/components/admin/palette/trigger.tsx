"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { adminPortalRoot } from "@/components/admin/ui/toast";
import type { PaletteNavGroup } from "@/lib/admin/palette-core";
import {
  isApplePlatform,
  isPaletteShortcut,
  mayOpenPage,
  PALETTE_FALLBACK_HREF,
  PALETTE_OPEN_EVENT,
  paletteShortcutLabel,
  paletteViewOf,
  type PaletteEntry,
  type PaletteView,
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

/**
 * The list once its chunk is here (preloaded on hover or focus, or opened
 * before): drawn straight away. Through next/dynamic alone even a loaded
 * chunk showed Yükleniyor… for a moment, as React holds a Suspense
 * fallback about 300 ms before it reveals what came.
 */
let loadedPalette: (typeof import("./palette"))["Palette"] | null = null;

const takePalette = (m: typeof import("./palette")) => {
  loadedPalette = m.Palette;
  return m.Palette;
};

const loadPalette = () => import("./palette").then(takePalette);

/**
 * Starts loading the list's chunk, for another control that opens the
 * palette (the sidebar's ⌘K box): the trigger's own preload, shared.
 */
export function preloadPalette(): void {
  void loadPalette().catch(() => {
    // The open loads it again; PaletteBoundary says so if that fails.
  });
}

const LazyPalette = dynamic(() => import("./palette").then(takePalette), {
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

/**
 * The list could not load (a deploy replaced its chunk, the köşk lost the
 * network) or broke while drawing. Caught here, inside the dialog: the
 * shell is above the panel's own error screen, so an error that left the
 * dialog took the whole panel down to the site's error page. The results
 * page still works, and a fresh load brings the new chunk.
 */
export class PaletteBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="px-4 py-4 text-sm text-[var(--admin-text)]">
        <p>Arama yüklenemedi. Sayfayı yenileyip yeniden dene.</p>
        <a
          href={PALETTE_FALLBACK_HREF}
          className="inline-flex min-h-11 items-center font-medium text-[var(--admin-primary)] underline underline-offset-4"
        >
          Arama sayfasını aç
        </a>
      </div>
    );
  }
}

/** The magnifier: the trigger's, and the palette's box (shared, no second copy). */
export function SearchIcon() {
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
  /** "Ayarlar içinde": the layout's settings deep links for the role. */
  settings?: PaletteEntry[];
}

export function PaletteTrigger(props: PaletteTriggerProps) {
  const { accountKey } = props;
  const pathname = usePathname();
  const router = useRouter();
  const label = useShortcutLabel();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const [view, setView] = useState<PaletteView>("all");
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const preload = useCallback(() => {
    void loadPalette().catch(() => {
      // The click loads it again; PaletteBoundary says so if that fails.
    });
  }, []);

  const show = useCallback(
    (as: PaletteView = "all") => {
      if (otherDialogOpen(dialogRef.current)) return;
      preload();
      setSession((n) => n + 1);
      setView(as);
      setOpen(true);
    },
    [preload],
  );

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

  // The single keys (shortcuts.tsx): `/` with no search box on the page,
  // `n` with no "Yeni" link (then on Oluştur alone).
  useEffect(() => {
    const onOpen = (e: Event) => {
      if (dialogRef.current?.open) return;
      show(paletteViewOf((e as CustomEvent).detail));
    };
    window.addEventListener(PALETTE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(PALETTE_OPEN_EVENT, onOpen);
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

  // An entry opens its page from here, not from the list: a form with
  // unsaved changes asks first (mayOpenPage, answered by
  // components/admin/ui/unsaved-guard.ts); on a no the dialog stays open.
  const navigate = (href: string) => {
    if (!mayOpenPage(href)) return;
    dialogRef.current?.close();
    router.push(href);
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
        title={label ? `Ara (${label})` : "Ara"}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-soft)] transition-colors duration-200 hover:border-[var(--admin-border-strong)] hover:text-[var(--admin-text)]"
      >
        <SearchIcon />
      </a>
      {open
        ? createPortal(
            <PaletteDialog
              key={session}
              dialogRef={dialogRef}
              onClosed={onClosed}
              {...props}
              pathname={pathname}
              view={view}
              navigate={navigate}
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
  view,
  navigate,
  ...palette
}: PaletteTriggerProps & {
  dialogRef: RefObject<HTMLDialogElement | null>;
  onClosed: () => void;
  pathname: string;
  view: PaletteView;
  navigate: (href: string) => void;
}) {
  const downOnBackdrop = useRef(false);

  // Modal at once, then the box focused by hand. When the list's chunk is
  // already here (preloaded on hover or focus) the list mounts in this
  // same commit, and its autofocus runs before this effect, on a field
  // inside a dialog that is not open yet: the focus is lost and
  // showModal() then focuses the dialog itself (seen in the browser
  // pass). When the chunk comes later, the list's own autofocus does it.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    dialog?.querySelector<HTMLInputElement>("input")?.focus();
  }, [dialogRef]);

  const close = useCallback(() => dialogRef.current?.close(), [dialogRef]);
  // Chosen once per opening. Read on every render, a list that came
  // through next/dynamic turned into the loaded component at the shell's
  // next render (a badge count changing): a new list, the text typed so
  // far and its hits gone.
  const [Body] = useState(() => loadedPalette ?? LazyPalette);

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
      className="fixed inset-x-0 top-3 bottom-auto mx-auto my-0 max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-0 text-[var(--admin-text)] shadow-[0_12px_40px_rgba(0,0,0,0.14)] backdrop:bg-[rgba(23,23,23,0.32)] open:flex sm:top-[12vh] sm:max-h-[min(76dvh,640px)] print:hidden"
      style={{ fontFamily: "var(--font-geist-sans), var(--sans)" }}
    >
      <PaletteBoundary>
        <Body {...palette} view={view} close={close} navigate={navigate} />
      </PaletteBoundary>
    </dialog>
  );
}
