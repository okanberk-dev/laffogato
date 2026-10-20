"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import {
  useShortcutPref,
  writeShortcutPref,
} from "@/components/admin/shortcut-pref";
import { ShortcutSheet } from "@/components/admin/ui/shortcut-sheet";
import { adminPortalRoot } from "@/components/admin/ui/toast";
import {
  isApplePlatform,
  openPalette,
  paletteShortcutLabel,
  SHORTCUT_SHEET_EVENT,
} from "@/lib/admin/palette-shell";
import type { AdminRole } from "@/lib/admin/roles";
import {
  isTillPath,
  readShortcut,
  SHORTCUT_IDLE,
  shortcutHints,
  singleKeysActive,
  typingTarget,
  type ShortcutCommand,
} from "@/lib/admin/shortcut-core";

/*
 * The panel's single-key shortcuts (admin UI v2, UI-8, design §4.4): one
 * keydown listener for the shell, the `?` sheet, and the
 * `aria-keyshortcuts` of the controls the keys reach. The rules are
 * shortcut-core's; this file only reads the page for them and does what
 * they say. The sidebar loads it after hydration, for the roles with
 * single keys only: the cashier's Kasa never asks for the chunk.
 */

const AT_MAIN = "admin-main";

const anyDialogOpen = () => document.querySelector("dialog[open]") !== null;

function shown(el: Element | null): el is HTMLElement {
  return el instanceof HTMLElement && el.getClientRects().length > 0;
}

/** The list's lead search box (FilterBar's `data-admin-search`), when on screen. */
function listSearch(): HTMLElement | null {
  const box = document.querySelector("[data-admin-search]");
  return shown(box) ? box : null;
}

/**
 * The page's primary when it is a link (PageHeader's `data-admin-new`:
 * the link itself, or the first link in the element's wrapper). A button
 * is never pressed by a single key: a page's primary may be a submit or a
 * print, and a stray `n` must not send a form.
 */
function newLink(): HTMLAnchorElement | null {
  const el = document.querySelector("[data-admin-new]");
  if (!el) return null;
  const link = el.matches("a[href]") ? el : el.querySelector("a[href]");
  return shown(link) ? (link as HTMLAnchorElement) : null;
}

function setHint(el: Element | null, value: string | null) {
  if (!el) return;
  if (value === null) el.removeAttribute("aria-keyshortcuts");
  else if (el.getAttribute("aria-keyshortcuts") !== value) {
    el.setAttribute("aria-keyshortcuts", value);
  }
}

/** Writes (or takes back) the keys on the controls they reach. */
function syncHints(active: boolean) {
  const box = document.querySelector("[data-admin-search]");
  const hasSearch = shown(box);
  const hints = shortcutHints(active, { hasSearch });
  setHint(box, hasSearch ? hints.search : null);
  setHint(newLink(), hints.newLink);
  setHint(
    document.querySelector("[data-admin-palette-trigger]"),
    hints.trigger,
  );
}

const noSubscribe = () => () => {};

export function AdminShortcuts({ role }: { role: AdminRole }) {
  const router = useRouter();
  const pathname = usePathname();
  const enabled = useShortcutPref();
  const active = singleKeysActive({ role, pathname, enabled });
  const [sheetOpen, setSheetOpen] = useState(false);
  const state = useRef(SHORTCUT_IDLE);

  const run = useCallback(
    (command: ShortcutCommand) => {
      if (command.kind === "go") {
        router.push(command.href);
      } else if (command.kind === "sheet") {
        setSheetOpen(true);
      } else if (command.kind === "search") {
        const box = listSearch();
        if (!box) {
          openPalette("all");
          return;
        }
        box.focus();
        if (box instanceof HTMLInputElement) box.select();
      } else {
        const link = newLink();
        if (link) link.click();
        else openPalette("create");
      }
    },
    [router],
  );

  // Bubble phase on window: a control that handles its own key (a menu's
  // arrows, React Aria's list) has had its turn and prevented the default.
  useEffect(() => {
    state.current = SHORTCUT_IDLE;
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const step = readShortcut(
        state.current,
        {
          key: e.key,
          metaKey: e.metaKey,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          altGraph: e.getModifierState?.("AltGraph") ?? false,
          isComposing: e.isComposing,
          repeat: e.repeat,
          defaultPrevented: e.defaultPrevented,
          isTrusted: e.isTrusted,
        },
        {
          role,
          pathname,
          enabled,
          typing:
            typingTarget(e.target as HTMLElement | null) ||
            typingTarget(document.activeElement as HTMLElement | null),
          dialogOpen: anyDialogOpen(),
          now: e.timeStamp,
        },
      );
      state.current = step.state;
      if (step.handled) e.preventDefault();
      if (step.command) run(step.command);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, role, pathname, enabled, run]);

  // The palette's "Klavye kısayolları" opens the sheet, keys on or off.
  useEffect(() => {
    const open = () => setSheetOpen(true);
    window.addEventListener(SHORTCUT_SHEET_EVENT, open);
    return () => window.removeEventListener(SHORTCUT_SHEET_EVENT, open);
  }, []);

  // aria-keyshortcuts follow the page: a list's box remounts with each
  // filter, a page's header with each navigation.
  useEffect(() => {
    syncHints(active);
    const main = document.getElementById(AT_MAIN);
    if (!main) return () => syncHints(false);
    const observer = new MutationObserver(() => syncHints(active));
    observer.observe(main, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      syncHints(false);
    };
  }, [active, pathname]);

  return sheetOpen
    ? createPortal(
        <SheetDialog
          role={role}
          enabled={enabled}
          pausedHere={isTillPath(pathname)}
          onClosed={() => setSheetOpen(false)}
        />,
        adminPortalRoot(),
      )
    : null;
}

/** The sheet, modal at once; focus goes back where it was, or to the palette's trigger. */
function SheetDialog({
  role,
  enabled,
  pausedHere,
  onClosed,
}: {
  role: AdminRole;
  enabled: boolean;
  pausedHere: boolean;
  onClosed: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const back = useRef<Element | null>(null);
  const paletteKey = useSyncExternalStore(
    noSubscribe,
    () => paletteShortcutLabel(isApplePlatform(navigator)),
    () => "⌘K",
  );

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    back.current = document.activeElement;
    dialog.showModal();
  }, []);

  const onClose = () => {
    onClosed();
    const to = back.current;
    // Opened from the palette, focus was in its dialog, now gone.
    if (to instanceof HTMLElement && to.isConnected && !to.closest("dialog")) {
      to.focus();
    } else {
      document
        .querySelector<HTMLElement>("[data-admin-palette-trigger]")
        ?.focus();
    }
  };

  return (
    <ShortcutSheet
      dialogRef={ref}
      role={role}
      paletteKey={paletteKey}
      enabled={enabled}
      pausedHere={pausedHere}
      onToggle={() => writeShortcutPref(!enabled)}
      onClose={onClose}
    />
  );
}
