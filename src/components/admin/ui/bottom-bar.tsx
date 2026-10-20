"use client";

import dynamic from "next/dynamic";
import Link, { useLinkStatus } from "next/link";
import type { MouseEvent } from "react";

import { cx } from "@/components/laffogato/cx";
import {
  BOTTOM_BAR_HIDE,
  BOTTOM_BAR_MORE_LABEL,
  type BottomBarSlot,
} from "@/lib/admin/bottom-bar-core";

/* Lucide through the nav's own lazy chunk (nav-icon.tsx), as in the
   sidebar: this file is in the shell, and the shell is in every admin
   page's bundle, /admin/kasa included. */
const NavIcon = dynamic(() =>
  import("@/components/admin/nav-icon").then((m) => m.NavIcon),
);

const MONO = { fontFamily: "var(--mono), monospace" } as const;

// 11 px names; 10 px under 360 px, where "Genel bakış" no longer fits a
// fifth of the screen.
const SLOT =
  "relative flex min-h-11 w-full flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] leading-4 transition-colors max-[359px]:text-[10px]";
const SLOT_IDLE =
  "text-[var(--admin-text-soft)] hover:text-[var(--admin-primary)]";
const SLOT_ACTIVE = "font-semibold text-[var(--admin-primary)]";
/** The pill behind the icon; filled on the current page's slot. */
const PILL = "relative grid h-7 w-12 place-items-center rounded-full";

/** A tapped slot's answer while its page loads (the sidebar's NavPending). */
function SlotPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      data-link-pending={pending ? "" : undefined}
      className={cx(
        "pointer-events-none absolute top-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-current transition-opacity",
        pending ? "opacity-80 delay-150" : "opacity-0",
      )}
    />
  );
}

function Badge({ n, title }: { n: number; title?: string }) {
  return (
    <span
      className="absolute -top-1 left-[calc(50%+0.375rem)] min-w-[18px] rounded-full bg-[var(--admin-primary)] px-1 text-center text-[10px] leading-4 font-medium text-white ring-2 ring-white"
      style={MONO}
    >
      {n > 99 ? "99+" : n}
      {title ? <span className="sr-only"> {title}</span> : null}
    </span>
  );
}

export interface BottomBarProps {
  slots: readonly BottomBarSlot[];
  /** The slot to light (activeBottomSlot), or -1. */
  active: number;
  /** The sidebar's badge counts by section: the same polls, not new ones. */
  counts: Readonly<Record<string, number | null>>;
  /** What each badge counts, read after its number. */
  badgeTitles?: Readonly<Record<string, string>>;
  /** "Tümü": opens the shell's drawer; the button gets focus back. */
  onMore: (opener: HTMLButtonElement) => void;
  drawerId: string;
  drawerOpen: boolean;
}

/**
 * The phone's bottom bar (admin UI v2, UI-7): the counter's pages one tap
 * away instead of menu, drawer, item. Below `lg` only, for every role with
 * nav chrome (owner, manager, staff; not the cashier, whose shell has no
 * nav). At most five 44 px slots, each an icon over its name, with the
 * sidebar's badges. Its row is `h-14` over the home indicator; the admin
 * root keeps that much room free at the bottom (`--admin-bottom-inset`,
 * layout.tsx) for the page's end, the toasts and the alert sheet. It
 * steps aside for the bulk bar, an open dialog and a phone's keyboard
 * (BOTTOM_BAR_HIDE).
 */
export function BottomBar({
  slots,
  active,
  counts,
  badgeTitles = {},
  onMore,
  drawerId,
  drawerOpen,
}: BottomBarProps) {
  if (slots.length === 0) return null;
  return (
    <nav
      aria-label="Hızlı menü"
      data-admin-tabbar=""
      className={cx(
        // The top line is a shadow, not a border: the bar is exactly its
        // row and the safe area, the height the root's inset reserves.
        "fixed inset-x-0 bottom-0 z-30 bg-white/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--admin-border)] backdrop-blur",
        ...BOTTOM_BAR_HIDE,
      )}
    >
      {/* On a tablet the five stay together in the middle. */}
      <ul className="mx-auto flex h-14 max-w-xl items-stretch px-1">
        {slots.map((slot, at) => {
          const lit = at === active;
          if (slot.kind === "more") {
            return (
              <li key="more" className="flex min-w-0 flex-1 items-center">
                <button
                  type="button"
                  onClick={(e: MouseEvent<HTMLButtonElement>) =>
                    onMore(e.currentTarget)
                  }
                  aria-haspopup="dialog"
                  aria-expanded={drawerOpen}
                  aria-controls={drawerId}
                  className={cx(SLOT, lit ? SLOT_ACTIVE : SLOT_IDLE)}
                >
                  <span
                    className={cx(
                      PILL,
                      lit && "bg-[var(--admin-primary-soft)]",
                    )}
                  >
                    <NavIcon name="drawer" />
                  </span>
                  <span className="max-w-full truncate">
                    {BOTTOM_BAR_MORE_LABEL}
                  </span>
                </button>
              </li>
            );
          }
          const { item } = slot;
          const n = counts[item.section] ?? null;
          return (
            <li key={item.href} className="flex min-w-0 flex-1 items-center">
              <Link
                href={slot.href}
                aria-current={lit ? "page" : undefined}
                className={cx(SLOT, lit ? SLOT_ACTIVE : SLOT_IDLE)}
              >
                <SlotPending />
                <span
                  className={cx(PILL, lit && "bg-[var(--admin-primary-soft)]")}
                >
                  <NavIcon name={item.icon ?? item.section} />
                  {n !== null && n > 0 ? (
                    <Badge n={n} title={badgeTitles[item.section]} />
                  ) : null}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
