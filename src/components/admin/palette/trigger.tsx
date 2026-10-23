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
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { adminPortalRoot } from "@/components/admin/ui/toast";
import { cx } from "@/components/laffogato/cx";
import type { PaletteNavGroup } from "@/lib/admin/palette-core";
import {
  isPaletteShortcut,
  mayOpenPage,
  PALETTE_FALLBACK_HREF,
  PALETTE_OPEN_EVENT,
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

/**
 * Where the search field sits, so the results open from it (Innex, 22 Eki
 * 2026: the operator wanted the search "different from Ctrl K, nice"). In
 * CSS pixels from the viewport's top and right edges.
 */
export interface PaletteAnchor {
  top: number;
  right: number;
  width: number;
}

/** The trigger's place, from `lg` and while it is on screen; else null. */
export function paletteAnchorOf(
  rect: Pick<DOMRect, "top" | "bottom" | "right" | "width">,
  viewport: { width: number; height: number },
): PaletteAnchor | null {
  if (viewport.width < 1024 || rect.width === 0) return null;
  if (rect.top < 0 || rect.bottom > viewport.height) return null;
  return {
    top: Math.round(rect.top),
    right: Math.max(0, Math.round(viewport.width - rect.right)),
    width: Math.round(rect.width),
  };
}

/** The visible name of the search, the field's text and its label alike. */
export const SEARCH_LABEL = "Sipariş, müşteri ya da sayfa ara";

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
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const [view, setView] = useState<PaletteView>("all");
  const [anchor, setAnchor] = useState<PaletteAnchor | null>(null);
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
      const trigger = triggerRef.current;
      setAnchor(
        trigger
          ? paletteAnchorOf(trigger.getBoundingClientRect(), {
              width: document.documentElement.clientWidth,
              height: window.innerHeight,
            })
          : null,
      );
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
        // The same words as the field shows from `lg`: a phone's square
        // says them too (WCAG 2.5.3, label in name). The keys still work;
        // the bar no longer prints them (operator: not "Ctrl K").
        aria-label={SEARCH_LABEL}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        data-admin-palette-trigger=""
        className={cx(
          "group/search grid shrink-0 place-items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-soft)] transition-colors duration-150 hover:border-[var(--admin-border-strong)] hover:text-[var(--admin-text)] max-lg:size-11 max-lg:pointer-fine:size-9",
          // From `lg` a real search field, Innex's: a pale box with the
          // magnifier and the words, the results open from it.
          // 44 px on touch (an iPad in landscape is `lg` too), 36 with a
          // mouse.
          "lg:flex lg:h-11 lg:w-72 lg:justify-start lg:gap-2 lg:bg-[var(--admin-surface-2)] lg:px-3 lg:text-[var(--admin-text-mute)] lg:hover:bg-[var(--admin-surface)] xl:w-96 lg:pointer-fine:h-9",
          // Under the open results, transparent, never `invisible`: a
          // hidden field cannot take the focus back when they close, and
          // it fell to <body> (review of #231).
          open && "lg:opacity-0",
        )}
      >
        <SearchIcon />
        <span className="hidden truncate text-sm lg:inline">
          {SEARCH_LABEL}
        </span>
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
              anchor={anchor}
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
  anchor,
  ...palette
}: PaletteTriggerProps & {
  dialogRef: RefObject<HTMLDialogElement | null>;
  onClosed: () => void;
  pathname: string;
  view: PaletteView;
  navigate: (href: string) => void;
  /** The search field's place: the results open from it, from `lg`. */
  anchor: PaletteAnchor | null;
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
      data-anchored={anchor ? "" : undefined}
      className={cx(
        "fixed inset-x-0 top-3 bottom-auto mx-auto my-0 max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-0 text-[var(--admin-text)] shadow-[0_12px_40px_rgba(12,14,27,0.14)] backdrop:bg-[rgba(12,14,27,0.2)] open:flex sm:top-[12vh] sm:max-h-[min(76dvh,640px)] print:hidden",
        // Opened from the top bar's field: the results grow out of it,
        // over a barely dimmed page, instead of a box in the middle.
        anchor &&
          "lg:top-[var(--palette-top)] lg:right-[var(--palette-right)] lg:left-auto lg:mx-0 lg:max-h-[min(70dvh,560px)] lg:w-[max(var(--palette-width),36rem)] lg:max-w-[calc(100vw-2rem)] lg:shadow-[0_16px_48px_rgba(12,14,27,0.16)] lg:backdrop:bg-[rgba(12,14,27,0.06)]",
      )}
      style={
        {
          fontFamily: "var(--font-admin-sans), var(--sans)",
          ...(anchor
            ? {
                "--palette-top": `${anchor.top}px`,
                "--palette-right": `${anchor.right}px`,
                "--palette-width": `${anchor.width}px`,
              }
            : null),
        } as CSSProperties
      }
    >
      <PaletteBoundary>
        <Body {...palette} view={view} close={close} navigate={navigate} />
      </PaletteBoundary>
    </dialog>
  );
}
