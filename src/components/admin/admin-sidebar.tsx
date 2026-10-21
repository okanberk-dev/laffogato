"use client";

import dynamic from "next/dynamic";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ComponentType,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";

import { karaokeTodaySignalAction } from "@/app/admin/mobil/karaoke/actions";
import { openOrderSignalAction } from "@/app/admin/siparisler/actions";
import {
  readSignalAnswer,
  type PanelSignalAnswer,
} from "@/lib/admin/panel-signal-core";
import { forgetRecents } from "@/components/admin/palette/recents";
import {
  PaletteTrigger,
  preloadPalette,
  SearchIcon,
} from "@/components/admin/palette/trigger";
import {
  useShortcutPref,
  writeShortcutPref,
} from "@/components/admin/shortcut-pref";
import { ADMIN_CHANGED_EVENT } from "@/components/admin/ui/admin-changed";
import { BottomBar } from "@/components/admin/ui/bottom-bar";
import { Breadcrumbs } from "@/components/admin/ui/breadcrumbs";
import {
  GROUP_HUE,
  HUE_DOT,
  HUE_INK,
  HUE_SOFT,
  HUE_TILE,
  type AdminHue,
} from "@/components/admin/ui/hues";
import { SectionTabs } from "@/components/admin/ui/section-tabs";
import { SwitchMark } from "@/components/admin/ui/switch-mark";
import { useToast } from "@/components/admin/ui/toast";
import {
  ViewPrefs,
  useDensityPref,
  useRailPref,
  writeDensityPref,
  writeRailPref,
} from "@/components/admin/view-prefs";
import { cx } from "@/components/laffogato/cx";
import { activeBottomSlot, bottomBarSlots } from "@/lib/admin/bottom-bar-core";
import {
  activeNavPlace,
  hasNavChrome,
  navIsFlat,
  sectionTabsFor,
  type NavTab,
} from "@/lib/admin/nav-match";
import {
  isApplePlatform,
  openPalette,
  PALETTE_FALLBACK_HREF,
  paletteShortcutLabel,
  type PaletteEntry,
} from "@/lib/admin/palette-shell";
import type { AdminRole } from "@/lib/admin/roles";
import { singleKeysForRole } from "@/lib/admin/shortcut-roles";
import {
  RAIL_LINK_ATTR,
  placeRailTip,
  releaseRailTip,
} from "@/lib/admin/view-prefs-core";

export interface AdminNavItem {
  href: string;
  label: string;
  section: string;
  /** Its icon: an ADMIN_ICONS key (ui/icons.tsx); else the section's. */
  icon?: string;
  /** Old names and synonyms (the palette's; the sidebar draws none). */
  keywords?: readonly string[];
  /** Other pages this item owns, drawn as a strip on their own pages. */
  tabs?: readonly NavTab[];
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

/* The nav's icons are lucide's (ui/icons.tsx ADMIN_ICONS), drawn by
   nav-icon.tsx in a chunk of its own. This file is in every admin page's
   bundle, the Kasa included, and the panel puts no library code there
   (CLAUDE.md): only the full nav asks for the chunk, and a cashier's
   one-page shell never draws it. No `loading`: the server waits for the
   module and renders the icons, and hydration keeps them while the chunk
   (preloaded) arrives, so nothing pops in. */
const NavIcon = dynamic(() =>
  import("@/components/admin/nav-icon").then((m) => m.NavIcon),
);

const MONO = { fontFamily: "var(--mono), monospace" } as const;

interface SidebarProps {
  groups: AdminNavGroup[];
  email: string;
  roleLabel: string;
  /** The role's landing page (landingPathFor): /admin/kasa for a cashier. */
  landingPath: string;
  logout: () => void;
  /** Whether this role's search covers anything (lib/admin/search.ts). */
  canSearch?: boolean;
  /**
   * The ⌘K palette's inputs (admin UI v2, UI-6): the role, for its Oluştur
   * list and to ask each recent page again, and the account's opaque key
   * (an HMAC the layout computes; never the e-mail). Without it, or
   * without `canSearch`, the top bar has no search at all (the cashier).
   * `settings` (UI-12): the role's "Ayarlar içinde" entries, built by the
   * layout and drawn by the list as they come.
   */
  palette?: {
    role: AdminRole;
    accountKey: string;
    settings?: PaletteEntry[];
  };
  /**
   * Controls at the right end of the top bar, after the search, at every
   * width. Rendered once, so a panel-wide control mounted here (the new
   * order alert) runs once per tab.
   */
  actions?: ReactNode;
}

/** How often the nav re-counts its badges. Slower than the lists' own polls. */
export const NAV_BADGE_POLL_MS = 60_000;

/**
 * One badge's poll: now, then every `intervalMs` while the tab is visible,
 * and again at once whenever the panel announces a change
 * (`admin:changed`, fired by the kit after a successful action). Actions
 * revalidate their own page but stay on the same path, so without the
 * event the badge kept the old count for up to a minute after the operator
 * cancelled tonight's booking (admin audit KAR-23). A change that lands
 * while a read is out is read again once that read is back: the read in
 * flight may have started before the change. Returns the stop function.
 *
 * Each answer carries a cursor (panel-signal-core.ts) that the next read
 * sends back; while nothing was written the answer is `{ unchanged: true }`,
 * read without the database, and the badge keeps its number.
 * `admin:changed` drops the cursor, so the read after an action is a full
 * one; a new poll (the effect restarting on navigation) starts without one.
 */
export function startNavCountPoll({
  read,
  onCount,
  intervalMs = NAV_BADGE_POLL_MS,
  target = window,
  isVisible = () => document.visibilityState === "visible",
}: {
  read: (cursor: string) => Promise<PanelSignalAnswer>;
  onCount: (count: number | null) => void;
  intervalMs?: number;
  target?: Pick<EventTarget, "addEventListener" | "removeEventListener">;
  isVisible?: () => boolean;
}): () => void {
  let stopped = false;
  let busy = false;
  let again = false;
  let cursor = "";
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function tick() {
    timer = undefined;
    if (stopped) return;
    if (isVisible()) {
      busy = true;
      try {
        const answer = readSignalAnswer(await read(cursor));
        if (!stopped && !("unchanged" in answer)) {
          // A change landed while this read was out: the next read is a
          // full one, whatever this answer's cursor says.
          cursor = again ? "" : answer.cursor;
          onCount(answer.count);
        }
      } catch {
        // Never let a background count take the panel down.
      } finally {
        busy = false;
      }
      if (stopped) return;
      if (again) {
        again = false;
        void tick();
        return;
      }
    }
    timer = setTimeout(tick, intervalMs);
  }

  const onChanged = () => {
    if (stopped) return;
    cursor = "";
    if (busy) {
      again = true;
      return;
    }
    if (timer) clearTimeout(timer);
    void tick();
  };

  target.addEventListener(ADMIN_CHANGED_EVENT, onChanged);
  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    target.removeEventListener(ADMIN_CHANGED_EVENT, onChanged);
  };
}

/**
 * A count for a nav badge, polled.
 *
 * The panel has no other standing surface: every page is `force-dynamic` and
 * dead once rendered, so an order that arrives from the app, or a karaoke
 * booking paid for tonight, while the operator is on Stok changes nothing
 * anywhere. The badges are that one standing surface. Returns null when the
 * section is not in this role's nav (no request at all), for a role the
 * action refuses (it answers null itself) and for a poll that failed; the
 * badge then simply does not render.
 */
function useNavCount(
  pathname: string,
  read: (cursor: string) => Promise<PanelSignalAnswer>,
  enabled: boolean,
): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    return startNavCountPoll({ read, onCount: setCount });
    // Re-read on navigation too: the operator who just completed an order
    // should not wait a minute to watch the badge drop.
  }, [pathname, read, enabled]);

  return enabled ? count : null;
}

/** What each badge counts, for its tooltip. */
const BADGE_TITLES: Record<string, string> = {
  orders:
    "Açık sipariş (ödeme bekleyen · ödenen · hazırlanan · yolda ya da hazır)",
  karaoke: "Bugünkü karaoke rezervasyonu (iptal edilmemiş)",
};

/**
 * A badge that opens the list it counts. The orders badge counts the "Açık"
 * tab and opened "Tümü" (admin audit ORD-21).
 */
export const BADGE_LINKS: Record<string, string> = {
  orders: "/admin/siparisler?durum=acik",
};

/** The nav groups the operator folded away (per browser). */
export const NAV_COLLAPSED_KEY = "laf_admin_nav_collapsed_v1";
const NAV_COLLAPSED_EVENT = "admin:nav-collapsed";
/** Where the choice lives when storage refuses (private window). */
let collapsedFallback = "";

function readCollapsedRaw(): string {
  try {
    return window.localStorage.getItem(NAV_COLLAPSED_KEY) ?? "";
  } catch {
    return collapsedFallback;
  }
}

function writeCollapsedRaw(value: string): void {
  collapsedFallback = value;
  try {
    window.localStorage.setItem(NAV_COLLAPSED_KEY, value);
  } catch {
    // The in-memory copy holds it for this tab.
  }
  window.dispatchEvent(new Event(NAV_COLLAPSED_EVENT));
}

/** The stored titles; anything unreadable is "nothing folded". */
export function parseCollapsedGroups(raw: string): Set<string> {
  try {
    const value: unknown = JSON.parse(raw);
    return new Set(
      Array.isArray(value)
        ? value.filter((t): t is string => typeof t === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

/** The group the current page is in is always open, folded or not. */
export function navGroupOpen(
  title: string,
  collapsed: ReadonlySet<string>,
  activeGroup: string | null,
): boolean {
  return title === activeGroup || !collapsed.has(title);
}

function subscribeCollapsed(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(NAV_COLLAPSED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(NAV_COLLAPSED_EVENT, onChange);
  };
}

/**
 * Folded nav groups, remembered per browser (about 30 entries for the
 * owner, always open, was a long scroll). The server and the first paint
 * show every group open; the stored choice applies right after hydration.
 */
function useCollapsedGroups(): [ReadonlySet<string>, (title: string) => void] {
  const raw = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsedRaw,
    () => "",
  );
  const collapsed = useMemo(() => parseCollapsedGroups(raw), [raw]);
  const toggle = useCallback((title: string) => {
    const next = parseCollapsedGroups(readCollapsedRaw());
    if (next.has(title)) next.delete(title);
    else next.add(title);
    writeCollapsedRaw(JSON.stringify([...next]));
  }, []);
  return [collapsed, toggle];
}

/**
 * A click's answer on a nav entry: a thin bar at the row's left edge while
 * the page loads (admin/loading.tsx draws the skeleton; this marks which
 * entry was clicked). Always there, only its opacity changes, after a
 * short delay so a fast page does not flicker (SHE-12).
 */
function NavPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      data-link-pending={pending ? "" : undefined}
      className={`pointer-events-none absolute inset-y-2 left-0.5 w-0.5 rounded-full bg-current transition-opacity ${
        pending ? "opacity-80 delay-150" : "opacity-0"
      }`}
    />
  );
}

/*
 * The nav's look is AkmanOS's sidebar (lafmaliyet, 21 Eki 2026), softened
 * the same evening (operator: "yumuşat, daha estetik, biraz renklendir"):
 * the rows sit in a white list box on the stone column, each icon in a
 * small tile of its group's pastel colour (ui/hues.ts), and the current
 * page is its row in that colour, with its tile turned white. It was the
 * one black row.
 */
const ROW =
  "group/row relative flex min-h-11 items-center gap-2.5 rounded-xl py-1.5 pr-2.5 pl-1.5 text-sm transition-colors duration-200";
const ROW_IDLE =
  "text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)]";
/** The current row; its ground is the group's colour (HUE_SOFT). */
const ROW_ACTIVE = "font-medium text-[var(--admin-text)]";
/** The current row that belongs to no group (the account's Güvenlik). */
const ROW_ACTIVE_PLAIN = `${ROW_ACTIVE} bg-[var(--admin-primary-soft)]`;
/** The white list box the rows sit in. */
const LIST_BOX = "flex flex-col gap-0.5 rounded-2xl bg-[var(--admin-surface)]";
/** The icon's tile; white, a little raised, in the current row. */
const TILE =
  "grid size-8 shrink-0 place-items-center rounded-lg transition-colors duration-200 group-aria-[current=page]/row:bg-[var(--admin-surface)] group-aria-[current=page]/row:shadow-[0_1px_2px_rgba(28,25,23,0.1)]";
/** The account block's tiles: no group, no colour. */
const TILE_PLAIN = "bg-[var(--admin-panel)] text-[var(--admin-text-soft)]";

function Tile({ name, hue }: { name: string; hue?: AdminHue }) {
  return (
    <span
      aria-hidden="true"
      className={`${TILE} ${hue ? HUE_TILE[hue] : TILE_PLAIN}`}
    >
      <NavIcon name={name} />
    </span>
  );
}

/*
 * The laptop rail (admin UI v2, UI-9, design 3.6): the sidebar folded to 64
 * px of icons, from `lg`, remembered per browser (view-prefs.tsx). Every
 * rail control names itself with `aria-label` and shows a CSS tooltip: a
 * child these classes reveal on hover and on focus-visible (a click's focus
 * is not one), that Esc hides until the pointer or the focus leaves
 * (view-prefs.tsx). The tooltip is `fixed`, so the nav's own scrolling
 * cannot clip it; `--tip-y`, the control's centre, is written when the
 * pointer or the focus arrives (view-prefs-core.ts placeRailTip). Its left
 * padding keeps it a part of the control, so the pointer can cross to it
 * (WCAG 1.4.13). The server and hydration draw the expanded sidebar: none
 * of this is in the first markup.
 */
const SIDE_ID = "admin-side";
const ROW_RAIL =
  "group/tip relative flex h-10 w-full items-center justify-center rounded-xl transition-colors duration-200";
/** The rail's count over the icon; its colour comes from HUE_DOT. */
const BADGE_RAIL =
  "pointer-events-none absolute -top-0.5 -right-0.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-medium text-white ring-2 ring-[var(--admin-surface)]";
const TIP =
  "fixed top-[var(--tip-y,0px)] left-[3.15rem] z-50 hidden -translate-y-1/2 pl-5 group-hover/tip:block group-focus-visible/tip:block group-data-[tip-off]/tip:hidden!";
const TIP_PILL =
  "block rounded-md bg-[var(--admin-primary)] px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-lg";

function RailTip({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className={TIP}>
      <span className={TIP_PILL}>{children}</span>
    </span>
  );
}

const placeTip = (e: SyntheticEvent<HTMLElement>) =>
  placeRailTip(e.currentTarget);
const releaseTip = (e: SyntheticEvent<HTMLElement>) =>
  releaseRailTip(e.currentTarget);

/** What a rail control carries besides its classes: its name, and the tooltip's hooks. */
function railControl(label: string) {
  return {
    "aria-label": label,
    [RAIL_LINK_ATTR]: "",
    onPointerEnter: placeTip,
    onFocus: placeTip,
    onPointerLeave: releaseTip,
    onBlur: releaseTip,
  };
}

/**
 * Folds the sidebar to the rail and back (from `lg`; the phone's drawer has
 * none). The same button in both layouts, so keyboard focus stays on it
 * when it flips. `aria-expanded` is whether the sidebar is wide.
 */
function RailToggle({
  rail,
  onToggle,
}: {
  rail: boolean;
  onToggle: () => void;
}) {
  const label = rail ? "Menüyü genişlet" : "Menüyü daralt";
  return (
    <button
      type="button"
      onClick={(e) => {
        // A keyboard toggle keeps the focus on this button, so no focus
        // event places the rail tooltip: place it once the layout moved.
        const el = e.currentTarget;
        onToggle();
        requestAnimationFrame(() => placeRailTip(el));
      }}
      aria-expanded={!rail}
      aria-controls={SIDE_ID}
      {...(rail ? railControl(label) : { "aria-label": label, title: label })}
      className={cx(
        "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface)] hover:text-[var(--admin-text)]",
        rail ? "group/tip relative" : "mr-2",
      )}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={rail ? "rotate-180" : undefined}
      >
        <path d="m11 17-5-5 5-5" />
        <path d="m18 17-5-5 5-5" />
      </svg>
      {rail ? <RailTip>{label}</RailTip> : null}
    </button>
  );
}

/**
 * The wide ⌘K box at the top of the sidebar (AkmanOS's "Search" row): it
 * opens the same palette as the top bar's trigger (openPalette, heard by
 * PaletteTrigger), and before hydration, or with a modifier key, it is the
 * link to the results page, as the trigger is. The key itself is the
 * trigger's (its aria-keyshortcuts); this box only shows it. Folded, an
 * icon with its tooltip. Only the desktop column draws it: the phone's drawer is a modal
 * the palette would not open over, and its top bar has the trigger.
 */
function SidebarSearch({ rail }: { rail: boolean }) {
  const key = useSyncExternalStore(
    noSubscribe,
    () => paletteShortcutLabel(isApplePlatform(navigator)),
    () => null,
  );
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    openPalette("all");
  };
  if (rail) {
    return (
      <a
        href={PALETTE_FALLBACK_HREF}
        onClick={onClick}
        aria-haspopup="dialog"
        data-admin-side-search=""
        {...railControl("Ara")}
        onPointerEnter={(e) => {
          placeTip(e);
          preloadPalette();
        }}
        className="group/tip relative mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[var(--admin-surface)] text-[var(--admin-text-soft)] shadow-[0_0_0_1px_var(--admin-border)] transition-colors duration-200 hover:text-[var(--admin-text)]"
      >
        <SearchIcon />
        <RailTip>Ara</RailTip>
      </a>
    );
  }
  return (
    <a
      href={PALETTE_FALLBACK_HREF}
      onClick={onClick}
      onPointerEnter={preloadPalette}
      onFocus={preloadPalette}
      aria-label="Ara"
      aria-haspopup="dialog"
      data-admin-side-search=""
      className="flex min-h-11 w-full items-center gap-2.5 rounded-xl bg-[var(--admin-surface)] px-3 text-[var(--admin-text-mute)] shadow-[0_0_0_1px_var(--admin-border)] transition-[color,box-shadow] duration-200 hover:text-[var(--admin-text)] hover:shadow-[0_0_0_1px_var(--admin-border-strong)]"
    >
      <SearchIcon />
      <span className="flex-1 text-left text-sm">Ara</span>
      {key ? (
        <kbd
          className="rounded-md bg-[var(--admin-panel)] px-1.5 py-0.5 text-[11px] leading-4 text-[var(--admin-text-soft)]"
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          }}
        >
          {key}
        </kbd>
      ) : null}
    </a>
  );
}

function BadgeCount({ section, n }: { section: string; n: number }) {
  return (
    <>
      {n > 99 ? "99+" : n}
      <span className="sr-only"> {BADGE_TITLES[section]}</span>
    </>
  );
}

/** A count: white on the group's ink (HUE_DOT), on any row. */
const BADGE_CLASS =
  "min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[10px] leading-4 font-medium text-white";

/** A badge as a name carries it, for a control that shows only the icon (the rail). */
function badgeText(section: string, n: number): string {
  return `${n > 99 ? "99+" : n} ${BADGE_TITLES[section] ?? ""}`.trim();
}

/**
 * The one-time note about the regrouped nav, dismissed per browser. v2
 * since the palette (UI-6): the note now says the old names are found
 * there, news to whoever closed v1.
 */
export const NAV_NOTE_KEY = "laf_admin_nav_note_v2";
const NAV_NOTE_EVENT = "admin:nav-note";
let noteFallback = "";

function readNoteRaw(): string {
  try {
    return window.localStorage.getItem(NAV_NOTE_KEY) ?? "";
  } catch {
    return noteFallback;
  }
}

function dismissNavNote(): void {
  noteFallback = "1";
  try {
    window.localStorage.setItem(NAV_NOTE_KEY, "1");
  } catch {
    // The in-memory copy hides it for this tab.
  }
  window.dispatchEvent(new Event(NAV_NOTE_EVENT));
}

function subscribeNote(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(NAV_NOTE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(NAV_NOTE_EVENT, onChange);
  };
}

/** Whether the note still shows: anything but the stored "1" is unseen. */
export function navNoteVisible(raw: string): boolean {
  return raw !== "1";
}

const noSubscribe = () => () => {};

/**
 * "Menü sadeleşti": the panel's nav moved into five groups, and some
 * pages became an item's tab; the palette still finds every old name.
 * Said once, in the grouped nav's footer (Personel's five items only lost
 * their headers), until dismissed. The server and the first paint draw
 * nothing (no flash for whoever dismissed it); the stored choice, and the
 * keyboard's own ⌘K or Ctrl K, apply after hydration.
 */
function NavNote() {
  const raw = useSyncExternalStore(subscribeNote, readNoteRaw, () => "1");
  const key = useSyncExternalStore(
    noSubscribe,
    () => paletteShortcutLabel(isApplePlatform(navigator)),
    () => "⌘K",
  );
  if (!navNoteVisible(raw)) return null;
  return (
    <div
      role="note"
      className="mx-3 mb-2 flex items-start gap-2 rounded-2xl bg-[var(--admin-accent-soft)] py-2 pr-1 pl-3 text-xs leading-5 text-[var(--admin-accent-ink)]"
    >
      <p className="flex-1 pt-0.5">
        Menü sadeleşti: eski adlarla da {key} ile bulursun.
      </p>
      <button
        type="button"
        onClick={dismissNavNote}
        aria-label="Notu kapat"
        className="-my-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--admin-accent-ink)] hover:bg-[var(--admin-surface)]"
      >
        <NavIcon name="close" />
      </button>
    </div>
  );
}

/**
 * "Tek tuş kısayolları" (admin UI v2, UI-8): the single keys' off switch
 * (WCAG 2.1.4), per browser. The server draws it on (the default); a
 * browser that turned it off shows so once hydrated.
 */
function ShortcutSwitch() {
  const on = useShortcutPref();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => writeShortcutPref(!on)}
      className={`${ROW} ${ROW_IDLE} w-full text-left`}
    >
      <Tile name="shortcuts" />
      <span className="min-w-0 flex-1 truncate">Tek tuş kısayolları</span>
      <SwitchMark on={on} />
    </button>
  );
}

/**
 * "Sıkı görünüm" (admin UI v2, UI-9): the kit's rows and cards tighten and
 * its controls drop to 36 px, for a mouse or a trackpad. Per browser; the
 * server draws it off and a browser that turned it on shows so once
 * hydrated. A touch screen keeps the 44 px targets whatever this says, and
 * only there the row says so.
 */
function DensitySwitch() {
  const on = useDensityPref();
  const hint = useId();
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-describedby={hint}
        onClick={() => writeDensityPref(!on)}
        className={`${ROW} ${ROW_IDLE} w-full text-left`}
      >
        <Tile name="density" />
        <span className="min-w-0 flex-1 truncate">Sıkı görünüm</span>
        <SwitchMark on={on} />
      </button>
      <p
        id={hint}
        className="hidden px-3 pb-1 text-[11px] leading-4 text-[var(--admin-text-mute)] pointer-coarse:block"
      >
        Dokunmatik ekranda uygulanmaz.
      </p>
    </>
  );
}

type ShortcutLayerComponent = ComponentType<{ role: AdminRole }>;

/** The layer once its chunk is here: a remount (a new session) draws it at once. */
let loadedShortcutLayer: ShortcutLayerComponent | null = null;

/**
 * The single keys' layer (shortcuts.tsx: the listener, the `?` sheet),
 * fetched after hydration and drawn only for the roles that have them: a
 * chunk of its own, so the cashier's one-page shell never asks for it.
 * Nothing on the server. Without it the panel works as before; ⌘K is the
 * trigger's.
 */
function ShortcutLayer({ role }: { role: AdminRole }) {
  const [Layer, setLayer] = useState(() => loadedShortcutLayer);
  useEffect(() => {
    if (Layer) return;
    let live = true;
    import("@/components/admin/shortcuts").then(
      (m) => {
        loadedShortcutLayer = m.AdminShortcuts;
        if (live) setLayer(() => m.AdminShortcuts);
      },
      () => {
        // No single keys this time (a deploy replaced the chunk); a fresh
        // load brings them back.
      },
    );
    return () => {
      live = false;
    };
  }, [Layer]);
  return Layer ? <Layer role={role} /> : null;
}

/**
 * Who is signed in, their 2FA and Çıkış: the sidebar's footer, and the
 * cashier's account menu. `icons` is off for the cashier, whose shell
 * loads no icon chunk.
 */
function AccountLinks({
  email,
  roleLabel,
  logout,
  pathname,
  onNavigate,
  icons,
  shortcuts = false,
  density = false,
  who = true,
}: Pick<SidebarProps, "email" | "roleLabel" | "logout"> & {
  pathname: string;
  onNavigate?: () => void;
  icons: boolean;
  /** The e-mail and role on top; off where the opening row shows them. */
  who?: boolean;
  /** The single-key switch, for the roles with single keys. */
  shortcuts?: boolean;
  /** The "Sıkı görünüm" switch, for the roles with the full nav. */
  density?: boolean;
}) {
  const securityActive = pathname === "/admin/2fa-kurulum";
  return (
    <>
      {who ? (
        <div className="mb-1.5 min-w-0 px-3">
          <div className="truncate text-[13px] font-medium text-[var(--admin-text)]">
            {email}
          </div>
          <div className="text-[11px] text-[var(--admin-text-mute)]">
            {roleLabel}
          </div>
        </div>
      ) : null}
      <Link
        href="/admin/2fa-kurulum"
        onClick={onNavigate}
        aria-current={securityActive ? "page" : undefined}
        className={`${ROW} ${securityActive ? ROW_ACTIVE_PLAIN : ROW_IDLE}`}
      >
        <NavPending />
        {icons && <Tile name="security" />}
        <span className="truncate">Güvenlik / 2FA</span>
      </Link>
      {shortcuts && <ShortcutSwitch />}
      {density && <DensitySwitch />}
      {/* The palette's recent pages go before the action posts: the next
          person on a shared köşk device must not find them. */}
      <form action={logout} onSubmit={() => forgetRecents()}>
        <button type="submit" className={`${ROW} ${ROW_IDLE} w-full`}>
          {icons && <Tile name="logout" />}
          Çıkış
        </button>
      </form>
    </>
  );
}

/**
 * Scrolls the nav itself (never the page) so its current row is in view,
 * centred when it was out of sight; a row already in view stays put.
 */
function keepActiveRowInView(nav: HTMLElement | null): void {
  const row = nav?.querySelector<HTMLElement>('a[aria-current="page"]');
  if (!nav || !row) return;
  const box = nav.getBoundingClientRect();
  const at = row.getBoundingClientRect();
  if (at.top >= box.top && at.bottom <= box.bottom) return;
  nav.scrollTop += at.top - box.top - (box.height - at.height) / 2;
}

/**
 * The sidebar's contents: the logo, the nav and the account block. Drawn
 * twice (the desktop column and the phone's drawer), so ids take a prefix.
 * Six items or fewer (Personel) are one list without group headers. With
 * `rail` (the desktop column, folded; UI-9) it is the 64 px rail instead:
 * icons only, every group open, the account block behind an initial.
 */
export function AdminSidebarBody({
  groups,
  email,
  roleLabel,
  landingPath,
  logout,
  pathname,
  counts,
  collapsed = new Set<string>(),
  onToggleGroup,
  onNavigate,
  idPrefix,
  shortcuts = false,
  density = false,
  rail = false,
  onToggleRail,
  search = false,
}: Pick<
  SidebarProps,
  "groups" | "email" | "roleLabel" | "landingPath" | "logout"
> & {
  pathname: string;
  counts: Record<string, number | null>;
  collapsed?: ReadonlySet<string>;
  onToggleGroup?: (title: string) => void;
  onNavigate?: () => void;
  idPrefix: string;
  /** The account block's "Tek tuş kısayolları" switch. */
  shortcuts?: boolean;
  /** The account block's "Sıkı görünüm" switch. */
  density?: boolean;
  /** The folded laptop rail (only the desktop column passes it). */
  rail?: boolean;
  /** Folds or unfolds the rail; given, the fold control is drawn. */
  onToggleRail?: () => void;
  /** The ⌘K box under the brand (the desktop column, for a role it covers). */
  search?: boolean;
}) {
  const items = groups.flatMap((g) => g.items);
  // Item and tab hrefs alike: /admin/kategoriler lights Ürünler.
  const activeHref = activeNavPlace(pathname, items)?.item.href ?? null;
  const activeGroup =
    groups.find((g) => g.items.some((i) => i.href === activeHref))?.title ??
    null;
  const flat = navIsFlat(groups);
  // Each row's colour is its group's (ui/hues.ts), in the flat list too.
  const hueOf = new Map(
    groups.flatMap((g) =>
      g.items.map((i) => [i.href, GROUP_HUE[g.title]] as const),
    ),
  );
  const navRef = useRef<HTMLElement>(null);
  // The open page's row stays in sight. The owner's five groups are taller
  // than a laptop's column (1280 x 800-900), so a page under İçerik or
  // Yönetim opened with its row below the fold and nothing showing where it
  // was. A frame later: the drawer's <dialog> opens in the parent's effect.
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      keepActiveRowInView(navRef.current),
    );
    return () => cancelAnimationFrame(frame);
  }, [activeHref, rail]);

  const row = (item: AdminNavItem) => {
    const active = item.href === activeHref;
    const n = counts[item.section] ?? null;
    const badge = n && n > 0 ? n : null;
    const badgeHref = BADGE_LINKS[item.section];
    const hue: AdminHue | undefined = hueOf.get(item.href);
    const current = hue ? `${ROW_ACTIVE} ${HUE_SOFT[hue]}` : ROW_ACTIVE_PLAIN;
    const count = hue ? HUE_DOT[hue] : "bg-[var(--admin-primary)]";
    if (rail) {
      // The icon alone: its name is the label and, with a badge, the count
      // (the pill over the icon is for the eye). One link, not the wide
      // layout's two: a second hit area would sit on the icon.
      return (
        <li key={item.href} className="relative">
          <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`${ROW_RAIL} ${active ? current : ROW_IDLE}`}
            {...railControl(
              badge !== null
                ? `${item.label}, ${badgeText(item.section, badge)}`
                : item.label,
            )}
          >
            <NavPending />
            <span className={hue ? HUE_INK[hue] : undefined}>
              <NavIcon name={item.icon ?? item.section} />
            </span>
            {badge !== null && (
              <span
                aria-hidden="true"
                className={`${BADGE_RAIL} ${count}`}
                style={MONO}
              >
                {badge > 99 ? "99+" : badge}
              </span>
            )}
            <RailTip>{item.label}</RailTip>
          </Link>
        </li>
      );
    }
    return (
      <li key={item.href} className="relative">
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={`${ROW} ${active ? current : ROW_IDLE} ${
            badge !== null && badgeHref ? "pr-12" : ""
          }`}
        >
          <NavPending />
          <Tile name={item.icon ?? item.section} hue={hue} />
          <span className="truncate">{item.label}</span>
          {badge !== null && !badgeHref && (
            <span
              className={`ml-auto ${BADGE_CLASS} ${count}`}
              style={MONO}
              title={BADGE_TITLES[item.section]}
            >
              <BadgeCount section={item.section} n={badge} />
            </span>
          )}
        </Link>
        {badge !== null && badgeHref && (
          // Its own link beside the row (a link cannot hold
          // another): the same pill, in a 24 px hit area.
          <Link
            href={badgeHref}
            onClick={onNavigate}
            title={BADGE_TITLES[item.section]}
            className="group/badge absolute top-1/2 right-2 grid min-h-6 min-w-6 -translate-y-1/2 place-items-center rounded-full px-1"
          >
            <span
              className={`${BADGE_CLASS} ${count} transition-opacity group-hover/badge:opacity-85`}
              style={MONO}
            >
              <BadgeCount section={item.section} n={badge} />
            </span>
          </Link>
        )}
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Brand, and the rail's fold control (the desktop column only). The
          control is the same button folded or not, so focus stays on it. */}
      <div
        className={
          rail ? "flex flex-col items-center pb-2" : "flex items-center"
        }
      >
        <Link
          href={landingPath}
          onClick={onNavigate}
          className={
            rail
              ? "flex items-center justify-center py-4"
              : "flex flex-1 items-center gap-2.5 px-5 py-4"
          }
          aria-label="L'Affogato Admin"
        >
          <span
            className="brand-mark h-8"
            style={{ color: "var(--admin-primary)" }}
            aria-hidden="true"
          />
          {rail ? null : (
            <span className="text-[11px] font-medium text-[var(--admin-text-mute)]">
              Yönetim paneli
            </span>
          )}
        </Link>
        {onToggleRail ? (
          <RailToggle rail={rail} onToggle={onToggleRail} />
        ) : null}
      </div>
      {search ? (
        <div className={rail ? "px-2 pb-1" : "px-3 pb-1"}>
          <SidebarSearch rail={rail} />
        </div>
      ) : null}

      {/* Nav. Folded, its scrollbar goes (it would take a quarter of the
          rail); the wheel and the keys still scroll it. */}
      <nav
        ref={navRef}
        aria-label="Panel"
        className={cx(
          "flex-1 overflow-y-auto pb-4",
          rail
            ? "[scrollbar-width:none] px-2 [&::-webkit-scrollbar]:hidden"
            : "px-3",
        )}
      >
        {flat ? (
          <ul id={`${idPrefix}-nav`} className={`mt-3 ${LIST_BOX} p-1.5`}>
            {items.map(row)}
          </ul>
        ) : (
          groups.map((group, gi) => {
            const isActiveGroup = group.title === activeGroup;
            // The rail has no titles to unfold a group with: all are open.
            const open =
              rail || navGroupOpen(group.title, collapsed, activeGroup);
            const listId = `${idPrefix}-nav-${gi}`;
            // AkmanOS's small capitals: the one place the panel uses them.
            const titleClass =
              "text-[11px] font-medium tracking-wide text-[var(--admin-text-mute)] uppercase";
            // The group's colour, as a dot before its name (ui/hues.ts).
            const groupHue = GROUP_HUE[group.title];
            const dot = groupHue ? (
              <span
                aria-hidden="true"
                className={`size-1.5 shrink-0 rounded-full ${HUE_DOT[groupHue]}`}
              />
            ) : null;
            return (
              <div key={group.title} className="mb-1">
                {rail ? (
                  // A rule between groups; the title stays for screen
                  // readers (the list is labelled by it).
                  <>
                    {gi > 0 ? (
                      <div
                        aria-hidden="true"
                        className="mx-2 my-2 border-t border-[var(--admin-border)]"
                      />
                    ) : null}
                    <div id={`${listId}-title`} className="sr-only">
                      {group.title}
                    </div>
                  </>
                ) : isActiveGroup || !onToggleGroup ? (
                  <div
                    id={`${listId}-title`}
                    className={`flex items-center gap-1.5 px-2 pt-4 pb-1.5 ${titleClass}`}
                  >
                    {dot}
                    {group.title}
                  </div>
                ) : (
                  <button
                    type="button"
                    id={`${listId}-title`}
                    aria-expanded={open}
                    aria-controls={listId}
                    onClick={() => onToggleGroup(group.title)}
                    className={`mt-1 flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2 pt-2 pb-1 text-left hover:text-[var(--admin-text)] ${titleClass}`}
                  >
                    <span className="flex items-center gap-1.5">
                      {dot}
                      {group.title}
                    </span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className={`shrink-0 transition-transform motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                )}
                <ul
                  id={listId}
                  aria-labelledby={`${listId}-title`}
                  hidden={!open}
                  className={`${LIST_BOX} ${rail ? "p-1" : "p-1.5"}`}
                >
                  {group.items.map(row)}
                </ul>
              </div>
            );
          })
        )}
      </nav>

      {/* Account: who is signed in, their 2FA, sign out. Every role sees
          the 2FA link here; the dashboard's quick link was the only one,
          and a cashier never sees the dashboard (SHE-25). Folded, the same
          block opens from the account's initial, beside the rail (and the
          regroup note, which the rail has no room for, is not drawn). */}
      {rail ? (
        <div className="px-2 py-3">
          <AccountMenu
            email={email}
            roleLabel={roleLabel}
            logout={logout}
            pathname={pathname}
            rail
            shortcuts={shortcuts}
            density={density}
          />
        </div>
      ) : (
        <>
          {!flat && <NavNote />}
          {/* One row, lafmaliyet's profile menu (TASARIM.md §3): the
              block took about 300 px and left the nav a third of a laptop
              screen. The row opens the same controls upward. */}
          <div className="px-3 pt-1 pb-3">
            <AccountMenu
              email={email}
              roleLabel={roleLabel}
              logout={logout}
              pathname={pathname}
              side
              onNavigate={onNavigate}
              shortcuts={shortcuts}
              density={density}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** The account's initial on a black tile (the rail's and the profile row's). */
const AVATAR =
  "grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--admin-primary)] text-xs font-semibold text-white";

/**
 * The account menu: the cashier's in the top bar (no sidebar to hold it),
 * the folded rail's, opened from the account's initial, and the wide
 * sidebar's profile row at its foot, which opens upward. A native
 * disclosure, so it opens before hydration too. Esc, a click outside it and
 * a click on its link close it.
 */
function AccountMenu({
  rail = false,
  side = false,
  onNavigate,
  shortcuts = false,
  density = false,
  ...props
}: Pick<SidebarProps, "email" | "roleLabel" | "logout"> & {
  pathname: string;
  /** In the folded rail: an initial that opens the block beside it. */
  rail?: boolean;
  /** At the foot of the wide sidebar: a profile row that opens upward. */
  side?: boolean;
  /** Also run on a link's click (the phone's drawer closes). */
  onNavigate?: () => void;
  shortcuts?: boolean;
  density?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const initial = props.email.trim().charAt(0).toUpperCase() || "?";
  const close = (focusSummary: boolean) => {
    const details = ref.current;
    if (!details?.open) return;
    details.open = false;
    if (focusSummary) details.querySelector("summary")?.focus();
  };

  useEffect(() => {
    if (!open) return;
    // A click outside closes it; focus that was inside goes back to the
    // row (the click then moves it on to whatever it landed on).
    const onPointerDown = (e: PointerEvent) => {
      const details = ref.current;
      if (!details || details.contains(e.target as Node)) return;
      const inside = details.contains(document.activeElement);
      details.open = false;
      if (inside) details.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <details
      ref={ref}
      data-admin-account-menu=""
      className="group/acct relative"
      onToggle={(e) => setOpen(e.currentTarget.open)}
      onKeyDown={(e) => {
        if (e.key === "Escape") close(true);
      }}
    >
      {rail ? (
        <summary
          {...railControl("Hesap")}
          className="group/tip relative mx-auto grid h-11 w-11 cursor-pointer list-none place-items-center rounded-xl select-none hover:bg-[var(--admin-surface)] [&::-webkit-details-marker]:hidden"
        >
          <span aria-hidden="true" className={AVATAR}>
            {initial}
          </span>
          {open ? null : <RailTip>Hesap</RailTip>}
        </summary>
      ) : side ? (
        <summary
          aria-label={`Hesap: ${props.email}, ${props.roleLabel}`}
          className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 rounded-2xl bg-[var(--admin-surface)] py-1.5 pr-2 pl-1.5 transition-colors duration-200 select-none hover:bg-[color-mix(in_srgb,var(--admin-surface)_60%,var(--admin-panel))] [&::-webkit-details-marker]:hidden"
        >
          <span aria-hidden="true" className={AVATAR}>
            {initial}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13px] font-medium text-[var(--admin-text)]">
              {props.email}
            </span>
            <span className="block truncate text-[11px] text-[var(--admin-text-mute)]">
              {props.roleLabel}
            </span>
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="shrink-0 text-[var(--admin-text-mute)] transition-transform duration-200 group-open/acct:rotate-180 motion-reduce:transition-none"
          >
            <path d="m18 15-6-6-6 6" />
          </svg>
        </summary>
      ) : (
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text-soft)] hover:border-[var(--admin-border-strong)] hover:text-[var(--admin-text)] [&::-webkit-details-marker]:hidden">
          Hesap
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="shrink-0"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
      )}
      <section
        aria-label="Hesap"
        className={cx(
          "absolute z-40 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 shadow-[0_12px_40px_rgba(28,25,23,0.14)]",
          rail
            ? "bottom-0 left-full ml-3 w-64 max-w-[calc(100vw-5rem)]"
            : side
              ? "right-0 bottom-full left-0 mb-2"
              : "top-full right-0 mt-2 w-64 max-w-[calc(100vw-2rem)]",
        )}
      >
        <AccountLinks
          {...props}
          onNavigate={() => {
            close(false);
            onNavigate?.();
          }}
          icons={rail || side}
          who={!side}
          shortcuts={shortcuts}
          density={density}
        />
      </section>
    </details>
  );
}

/**
 * The skip link's click once the shell runs: focus the content wrapper
 * instead of jumping to `#admin-main`. The jump adds a history entry with
 * no router state, and the App Router ignores such an entry on Back: Back
 * from the next page left that page on screen under the old address.
 * Without a target the browser's own jump stands; before hydration the
 * href does it.
 */
export function skipToContent(
  event: Pick<Event, "preventDefault">,
  target: Pick<HTMLElement, "focus"> | null,
): void {
  if (!target) return;
  event.preventDefault();
  target.focus();
}

/**
 * "İçeriğe geç" (WCAG 2.4.1): the shell's first link, parked above the
 * screen and slid in on focus. Not `sr-only focus:not-sr-only`: the site's
 * own `.sr-only` in globals.css is unlayered, so it beats the layered
 * `focus:` utilities and the focused link stayed a clipped 32 px sliver.
 */
function SkipLink() {
  return (
    <a
      href="#admin-main"
      onClick={(e) => skipToContent(e, document.getElementById("admin-main"))}
      data-admin-skip-link=""
      className="fixed top-2 left-2 z-50 inline-flex min-h-11 -translate-y-[calc(100%+1rem)] items-center rounded-xl bg-[var(--admin-primary)] px-4 text-sm font-medium whitespace-nowrap text-white transition-transform focus:translate-y-0 motion-reduce:transition-none print:hidden"
    >
      İçeriğe geç
    </a>
  );
}

/** The drawer's `<dialog>`, opened modally and closed with the state. */
export function syncDrawer(
  dialog: Pick<HTMLDialogElement, "open" | "showModal" | "close"> | null,
  open: boolean,
): void {
  if (!dialog) return;
  if (open && !dialog.open) dialog.showModal();
  else if (!open && dialog.open) dialog.close();
}

/** The address bar without `denied`, once its notice is on screen. */
export function withoutDenied(href: string): string {
  const url = new URL(href, "http://panel.invalid");
  url.searchParams.delete("denied");
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * "Bu sayfaya yetkin yok": requireRole sends a role that may not open a
 * page to its landing page with `?denied=1`. Only the dashboard said so;
 * a cashier bounced to /admin/kasa was told nothing (admin audit SHE-25).
 * Here, in the shell, it is said on whichever page the bounce lands, once:
 * the parameter leaves the address so a reload does not repeat it.
 */
function DeniedNotice() {
  const params = useSearchParams();
  const pathname = usePathname();
  const toast = useToast();
  const shown = useRef<string | null>(null);
  const denied = params.get("denied") === "1";

  useEffect(() => {
    if (!denied) return;
    const key = `${pathname}?${params.toString()}`;
    if (shown.current === key) return;
    shown.current = key;
    toast.show({
      tone: "warning",
      title: "Bu sayfaya yetkin yok.",
      message: "Açabildiğin bölümler menüde.",
    });
    window.history.replaceState(null, "", withoutDenied(window.location.href));
  }, [denied, pathname, params, toast]);

  return null;
}

const DRAWER_ID = "admin-nav-drawer";

const LOGO_SMALL = (
  <>
    <span
      className="brand-mark h-7"
      style={{ color: "var(--admin-primary)" }}
      aria-hidden="true"
    />
    {/* The link is named "L'Affogato Admin"; the word goes below 380 px,
        where the top bar's controls did not fit beside it and the page
        scrolled sideways (360 px Android phones). */}
    <span className="text-[11px] font-medium text-[var(--admin-text-mute)] max-[379px]:hidden">
      Yönetim
    </span>
  </>
);

type BodyProps = Omit<
  ComponentProps<typeof AdminSidebarBody>,
  "idPrefix" | "rail" | "onToggleRail" | "search"
>;

/**
 * The laptop sidebar: 17.5rem, or the rail's 4rem once the shell wrote
 * `data-admin-rail` on the admin root (the layout's `--admin-side`; the top
 * bar, the tab strip, the page's left edge and the bulk bar follow the same
 * variable). Its own component, so the cashier's one-page shell never reads
 * the preference. The server and hydration draw it wide.
 */
function DesktopAside({
  body,
  search,
}: {
  body: BodyProps;
  /** The ⌘K box under the brand, for a role the palette covers. */
  search: boolean;
}) {
  const rail = useRailPref();
  return (
    <aside
      id={SIDE_ID}
      className="fixed inset-y-0 left-0 z-30 hidden w-[var(--admin-side,17.5rem)] border-r border-[var(--admin-border)] bg-[var(--admin-panel)] lg:block print:hidden"
    >
      <AdminSidebarBody
        {...body}
        idPrefix="side"
        rail={rail}
        onToggleRail={() => writeRailPref(!rail)}
        search={search}
      />
    </aside>
  );
}

export function AdminSidebar(props: SidebarProps) {
  const pathname = usePathname();
  /* The route the mobile drawer was opened on. Keying the drawer to it
     closes the drawer on navigation without an effect: a new pathname
     simply no longer matches. */
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn !== null && openOn === pathname;
  const setOpen = useCallback(
    (next: boolean) => setOpenOn(next ? pathname : null),
    [pathname],
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  // What opened the drawer (the top bar's button or the bottom bar's
  // "Tümü"): focus goes back there when it closes.
  const openerRef = useRef<HTMLElement | null>(null);
  const downOnBackdrop = useRef(false);
  const [collapsed, toggleGroup] = useCollapsedGroups();

  const has = (section: string) =>
    props.groups.some((g) => g.items.some((i) => i.section === section));
  const openOrders = useNavCount(
    pathname,
    openOrderSignalAction,
    has("orders"),
  );
  const karaokeToday = useNavCount(
    pathname,
    karaokeTodaySignalAction,
    has("karaoke"),
  );
  const counts = { orders: openOrders, karaoke: karaokeToday };
  const navLinks = useMemo(
    () => props.groups.flatMap((g) => g.items),
    [props.groups],
  );
  const chrome = hasNavChrome(props.groups);

  // The drawer is a native modal <dialog> (SHE-13): the page behind it is
  // inert, focus moves in, Esc closes it. The page behind does not scroll.
  useEffect(() => {
    syncDrawer(dialogRef.current, open);
    if (!open) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    // Widened past the phone layout while open: the drawer is hidden there
    // and must not leave the page inert behind it.
    const wide = window.matchMedia("(min-width: 64rem)");
    const onWide = () => {
      if (wide.matches) setOpen(false);
    };
    wide.addEventListener("change", onWide);
    return () => {
      root.style.overflow = before;
      wide.removeEventListener("change", onWide);
    };
  }, [open, setOpen]);

  const palette = props.canSearch ? props.palette : undefined;
  const shortcuts = singleKeysForRole(palette?.role);
  const topBarEnd = (
    <>
      {palette && (
        <PaletteTrigger
          groups={props.groups}
          role={palette.role}
          accountKey={palette.accountKey}
          settings={palette.settings}
        />
      )}
      <div data-admin-topbar-actions="" className="flex items-center gap-2">
        {props.actions}
      </div>
    </>
  );

  if (!chrome) {
    // One page (Kasiyer): no sidebar, no menu button, no drawer. The bar
    // keeps the logo, the page's name and the account menu.
    const title =
      pathname === "/admin/2fa-kurulum"
        ? "Güvenlik / 2FA"
        : (activeNavPlace(pathname, navLinks)?.item.label ?? null);
    return (
      <>
        <SkipLink />
        <Suspense fallback={null}>
          <DeniedNotice />
        </Suspense>
        <header className="sticky top-0 z-30 flex min-h-[60px] items-center gap-3 border-b border-[var(--admin-border)] bg-white/90 px-4 py-2 backdrop-blur-md sm:px-6 lg:bg-[var(--admin-surface)] lg:backdrop-blur-none print:hidden">
          <Link
            href={props.landingPath}
            className="flex min-h-11 shrink-0 items-center gap-2"
            aria-label="L'Affogato Admin"
          >
            {LOGO_SMALL}
          </Link>
          {title && (
            <span className="min-w-0 truncate border-l border-[var(--admin-border)] pl-3 text-sm font-medium text-[var(--admin-text)]">
              {title}
            </span>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {topBarEnd}
            <AccountMenu
              email={props.email}
              roleLabel={props.roleLabel}
              logout={props.logout}
              pathname={pathname}
            />
          </div>
        </header>
      </>
    );
  }

  // A click that both started and ended on the backdrop closes the drawer.
  const onBackdropDown = (e: MouseEvent<HTMLDialogElement>) => {
    downOnBackdrop.current = e.target === e.currentTarget;
  };
  const onBackdropClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (downOnBackdrop.current && e.target === e.currentTarget) setOpen(false);
    downOnBackdrop.current = false;
  };

  const body = {
    groups: props.groups,
    email: props.email,
    roleLabel: props.roleLabel,
    landingPath: props.landingPath,
    logout: props.logout,
    pathname,
    counts,
    collapsed,
    onToggleGroup: toggleGroup,
    shortcuts,
    density: true,
  };
  const strip = sectionTabsFor(pathname, navLinks);
  // The phone's bottom bar (UI-7), past the cashier's return above: a
  // one-page shell runs none of it.
  const slots = bottomBarSlots(props.groups, props.landingPath, BADGE_LINKS);
  const openDrawer = (opener: HTMLElement) => {
    openerRef.current = opener;
    setOpen(true);
  };

  return (
    <>
      <SkipLink />
      <Suspense fallback={null}>
        <DeniedNotice />
      </Suspense>
      {palette && shortcuts && <ShortcutLayer role={palette.role} />}
      {/* The rail and "Sıkı görünüm" (UI-9): past the cashier's return, so
          a one-page shell runs none of it. */}
      <ViewPrefs />

      {/* Desktop sidebar */}
      <DesktopAside body={body} search={Boolean(palette)} />

      {/* Top bar: on a phone the menu button and the logo; on a wide screen
          the breadcrumbs. Then the search and the bar's own controls. */}
      <header
        className={`sticky top-0 z-30 flex min-h-[60px] items-center gap-2 border-b border-[var(--admin-border)] bg-white/90 px-4 py-2 backdrop-blur lg:static lg:ml-[var(--admin-side,17.5rem)] lg:gap-4 lg:bg-[var(--admin-surface)] lg:px-6 lg:backdrop-blur-none print:hidden ${
          // On a wide screen the bar is breadcrumbs, search and controls; a
          // role with neither search nor controls has nothing to put there.
          palette || props.actions ? "" : "lg:hidden"
        }`}
      >
        <button
          ref={toggleRef}
          type="button"
          onClick={(e) => openDrawer(e.currentTarget)}
          aria-label="Menüyü aç"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={DRAWER_ID}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-soft)] hover:border-[var(--admin-border-strong)] hover:text-[var(--admin-text)] lg:hidden"
        >
          <NavIcon name="drawer" />
        </button>
        <Link
          href={props.landingPath}
          className="flex min-h-11 items-center gap-2 lg:hidden"
          aria-label="L'Affogato Admin"
        >
          {LOGO_SMALL}
        </Link>
        <Breadcrumbs items={navLinks} className="hidden flex-1 lg:block" />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {topBarEnd}
        </div>
      </header>
      {/* The phone's trail, under the top bar. Not on a tab's own page,
          where the strip below names the same two places, and not on a
          page with its own "←" link (BackLink, data-admin-back): the
          same way back twice in the first screen (21 Oct 2026). */}
      {strip ? null : (
        <Breadcrumbs
          items={navLinks}
          className="px-4 pt-3 sm:px-6 lg:hidden print:hidden [body:has([data-admin-back])_&]:hidden"
        />
      )}
      {/* An item's tabs, on a tab's own page only (not on /yeni or a
          record below it). */}
      {strip && (
        <SectionTabs
          label={`${strip.item.label} bölümleri`}
          tabs={strip.tabs}
          activeHref={strip.activeHref}
          className="mt-3 lg:mt-0 lg:ml-[var(--admin-side,17.5rem)] print:hidden"
        />
      )}

      {/* Mobile drawer */}
      <dialog
        ref={dialogRef}
        id={DRAWER_ID}
        aria-label="Menü"
        onClose={() => {
          setOpenOn(null);
          (openerRef.current ?? toggleRef.current)?.focus();
          openerRef.current = null;
        }}
        onMouseDown={onBackdropDown}
        onClick={onBackdropClick}
        className="m-0 h-dvh max-h-none w-[80%] max-w-[300px] border-0 border-r border-[var(--admin-border)] bg-[var(--admin-panel)] p-0 text-[var(--admin-text)] shadow-[0_12px_40px_rgba(28,25,23,0.18)] backdrop:bg-[rgba(28,25,23,0.32)] lg:hidden print:hidden"
        style={{ fontFamily: "var(--font-geist-sans), var(--sans)" }}
      >
        {open && (
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Menüyü kapat"
              className="absolute top-2 right-2 z-10 grid h-11 w-11 place-items-center rounded-xl bg-[var(--admin-surface)] text-[var(--admin-text-soft)] hover:text-[var(--admin-text)]"
            >
              <NavIcon name="close" />
            </button>
            <AdminSidebarBody
              {...body}
              idPrefix="drawer"
              onNavigate={() => setOpen(false)}
            />
          </>
        )}
      </dialog>

      {/* Phone bottom bar: the role's first pages and "Tümü" (the
          drawer above), with the same badge counts as the nav. */}
      <BottomBar
        slots={slots}
        active={activeBottomSlot(
          slots,
          activeNavPlace(pathname, navLinks)?.item.href ?? null,
        )}
        counts={counts}
        badgeTitles={BADGE_TITLES}
        onMore={openDrawer}
        drawerId={DRAWER_ID}
        drawerOpen={open}
      />
    </>
  );
}
