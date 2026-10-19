"use client";

import dynamic from "next/dynamic";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from "react";

import { karaokeTodayCountAction } from "@/app/admin/mobil/karaoke/actions";
import { openOrderCountAction } from "@/app/admin/siparisler/actions";
import { TopBarSearch } from "@/components/admin/admin-search";
import { ADMIN_CHANGED_EVENT } from "@/components/admin/ui/admin-changed";
import { Breadcrumbs } from "@/components/admin/ui/breadcrumbs";
import { SectionTabs } from "@/components/admin/ui/section-tabs";
import { useToast } from "@/components/admin/ui/toast";
import {
  activeNavPlace,
  hasNavChrome,
  navIsFlat,
  sectionTabsFor,
  type NavTab,
} from "@/lib/admin/nav-match";

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
 */
export function startNavCountPoll({
  read,
  onCount,
  intervalMs = NAV_BADGE_POLL_MS,
  target = window,
  isVisible = () => document.visibilityState === "visible",
}: {
  read: () => Promise<number | null>;
  onCount: (count: number | null) => void;
  intervalMs?: number;
  target?: Pick<EventTarget, "addEventListener" | "removeEventListener">;
  isVisible?: () => boolean;
}): () => void {
  let stopped = false;
  let busy = false;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function tick() {
    timer = undefined;
    if (stopped) return;
    if (isVisible()) {
      busy = true;
      try {
        const n = await read();
        if (!stopped) onCount(typeof n === "number" ? n : null);
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
  read: () => Promise<number | null>,
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

const ROW =
  "relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors";
const ROW_IDLE =
  "text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-primary)]";
const ROW_ACTIVE =
  "bg-[var(--admin-primary-soft)] font-medium text-[var(--admin-primary)]";

function BadgeCount({ section, n }: { section: string; n: number }) {
  return (
    <>
      {n > 99 ? "99+" : n}
      <span className="sr-only"> {BADGE_TITLES[section]}</span>
    </>
  );
}

const BADGE_CLASS =
  "min-w-[22px] rounded-full bg-[var(--admin-primary)] px-1.5 py-0.5 text-center text-[10px] leading-4 font-medium text-white";

/** The one-time note about the regrouped nav, dismissed per browser. */
export const NAV_NOTE_KEY = "laf_admin_nav_note_v1";
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

/**
 * "Menü sadeleşti": the panel's nav moved into five groups, and some
 * pages became an item's tab. Said once, in the grouped nav's footer
 * (Personel's five items only lost their headers), until dismissed. The
 * server and the first paint draw nothing (no flash for whoever dismissed
 * it); the stored choice applies after hydration.
 */
function NavNote() {
  const raw = useSyncExternalStore(subscribeNote, readNoteRaw, () => "1");
  if (!navNoteVisible(raw)) return null;
  return (
    <div
      role="note"
      className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-accent-soft)] py-2 pr-1 pl-3 text-xs leading-5 text-[var(--admin-text-soft)]"
    >
      <p className="flex-1 pt-0.5">
        Menü sadeleşti: bazı sayfalar artık sekmede, örneğin Kategoriler
        Ürünler&apos;de.
      </p>
      <button
        type="button"
        onClick={dismissNavNote}
        aria-label="Notu kapat"
        className="-my-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-md text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface)] hover:text-[var(--admin-primary)]"
      >
        <NavIcon name="close" />
      </button>
    </div>
  );
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
}: Pick<SidebarProps, "email" | "roleLabel" | "logout"> & {
  pathname: string;
  onNavigate?: () => void;
  icons: boolean;
}) {
  const securityActive = pathname === "/admin/2fa-kurulum";
  return (
    <>
      <div className="mb-1.5 min-w-0 px-3">
        <div className="truncate text-[13px] font-medium text-[var(--admin-text)]">
          {email}
        </div>
        <div
          className="text-[10px] tracking-[0.18em] text-[var(--admin-text-soft)] uppercase"
          style={MONO}
        >
          {roleLabel}
        </div>
      </div>
      <Link
        href="/admin/2fa-kurulum"
        onClick={onNavigate}
        aria-current={securityActive ? "page" : undefined}
        className={`${ROW} ${securityActive ? ROW_ACTIVE : ROW_IDLE}`}
      >
        <NavPending />
        {icons && <NavIcon name="security" />}
        <span className="truncate">Güvenlik / 2FA</span>
      </Link>
      <form action={logout}>
        <button type="submit" className={`${ROW} ${ROW_IDLE} w-full`}>
          {icons && <NavIcon name="logout" />}
          Çıkış
        </button>
      </form>
    </>
  );
}

/**
 * The sidebar's contents: the logo, the nav and the account block. Drawn
 * twice (the desktop column and the phone's drawer), so ids take a prefix.
 * Six items or fewer (Personel) are one list without group headers.
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
}) {
  const items = groups.flatMap((g) => g.items);
  // Item and tab hrefs alike: /admin/kategoriler lights Ürünler.
  const activeHref = activeNavPlace(pathname, items)?.item.href ?? null;
  const activeGroup =
    groups.find((g) => g.items.some((i) => i.href === activeHref))?.title ??
    null;
  const flat = navIsFlat(groups);

  const row = (item: AdminNavItem) => {
    const active = item.href === activeHref;
    const n = counts[item.section] ?? null;
    const badge = n && n > 0 ? n : null;
    const badgeHref = BADGE_LINKS[item.section];
    return (
      <li key={item.href} className="relative">
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={`${ROW} ${active ? ROW_ACTIVE : ROW_IDLE} ${
            badge !== null && badgeHref ? "pr-12" : ""
          }`}
        >
          <NavPending />
          <NavIcon name={item.icon ?? item.section} />
          <span className="truncate">{item.label}</span>
          {badge !== null && !badgeHref && (
            <span
              className={`ml-auto ${BADGE_CLASS}`}
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
              className={`${BADGE_CLASS} group-hover/badge:bg-[var(--admin-primary-hover)]`}
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
      {/* Brand */}
      <Link
        href={landingPath}
        onClick={onNavigate}
        className="flex items-center gap-2.5 px-5 py-4"
        aria-label="L'Affogato Admin"
      >
        <span
          className="brand-mark h-8"
          style={{ color: "var(--admin-primary)" }}
          aria-hidden="true"
        />
        <span
          className="text-[11px] tracking-[0.26em] text-[var(--admin-text-soft)] uppercase"
          style={MONO}
        >
          Admin
        </span>
      </Link>

      {/* Nav */}
      <nav aria-label="Panel" className="flex-1 overflow-y-auto px-3 pb-4">
        {flat ? (
          <ul id={`${idPrefix}-nav`} className="flex flex-col gap-0.5 pt-2">
            {items.map(row)}
          </ul>
        ) : (
          groups.map((group, gi) => {
            const isActiveGroup = group.title === activeGroup;
            const open = navGroupOpen(group.title, collapsed, activeGroup);
            const listId = `${idPrefix}-nav-${gi}`;
            const titleClass =
              "text-[10px] font-semibold tracking-[0.16em] text-[var(--admin-text-soft)] uppercase";
            return (
              <div key={group.title} className="mb-1">
                {isActiveGroup || !onToggleGroup ? (
                  <div
                    id={`${listId}-title`}
                    className={`px-3 pt-4 pb-1.5 ${titleClass}`}
                  >
                    {group.title}
                  </div>
                ) : (
                  <button
                    type="button"
                    id={`${listId}-title`}
                    aria-expanded={open}
                    aria-controls={listId}
                    onClick={() => onToggleGroup(group.title)}
                    className={`mt-1 flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-3 pt-2 pb-1 text-left hover:text-[var(--admin-primary)] ${titleClass}`}
                  >
                    <span>{group.title}</span>
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
                  className="flex flex-col gap-0.5"
                >
                  {group.items.map(row)}
                </ul>
              </div>
            );
          })
        )}
      </nav>

      {!flat && <NavNote />}

      {/* Account: who is signed in, their 2FA, sign out. Every role sees
          the 2FA link here; the dashboard's quick link was the only one,
          and a cashier never sees the dashboard (SHE-25). */}
      <section
        aria-label="Hesap"
        className="border-t border-[var(--admin-border)] px-3 py-3"
      >
        <AccountLinks
          email={email}
          roleLabel={roleLabel}
          logout={logout}
          pathname={pathname}
          onNavigate={onNavigate}
          icons
        />
      </section>
    </div>
  );
}

/**
 * The cashier's account menu in the top bar (no sidebar to hold it): a
 * native disclosure, so it opens before hydration too. Esc, a click
 * outside it and a click on its link close it.
 */
function AccountMenu(
  props: Pick<SidebarProps, "email" | "roleLabel" | "logout"> & {
    pathname: string;
  },
) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const close = (focusSummary: boolean) => {
    const details = ref.current;
    if (!details?.open) return;
    details.open = false;
    if (focusSummary) details.querySelector("summary")?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const details = ref.current;
      if (details && !details.contains(e.target as Node)) details.open = false;
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <details
      ref={ref}
      data-admin-account-menu=""
      className="relative"
      onToggle={(e) => setOpen(e.currentTarget.open)}
      onKeyDown={(e) => {
        if (e.key === "Escape") close(true);
      }}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-[var(--admin-border)] px-3 text-sm text-[var(--admin-text-soft)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] [&::-webkit-details-marker]:hidden">
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
      <section
        aria-label="Hesap"
        className="absolute top-full right-0 z-40 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 shadow-lg"
      >
        <AccountLinks
          {...props}
          onNavigate={() => close(false)}
          icons={false}
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
      className="fixed top-2 left-2 z-50 inline-flex min-h-11 -translate-y-[calc(100%+1rem)] items-center rounded-lg bg-[var(--admin-primary)] px-4 text-sm font-medium whitespace-nowrap text-white transition-transform focus:translate-y-0 motion-reduce:transition-none print:hidden"
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
    <span
      className="text-[10px] tracking-[0.24em] text-[var(--admin-text-soft)] uppercase"
      style={MONO}
    >
      Admin
    </span>
  </>
);

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
  const downOnBackdrop = useRef(false);
  const [collapsed, toggleGroup] = useCollapsedGroups();

  const has = (section: string) =>
    props.groups.some((g) => g.items.some((i) => i.section === section));
  const openOrders = useNavCount(pathname, openOrderCountAction, has("orders"));
  const karaokeToday = useNavCount(
    pathname,
    karaokeTodayCountAction,
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

  const topBarEnd = (
    <>
      {props.canSearch && <TopBarSearch />}
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
        <header className="sticky top-0 z-30 flex min-h-[60px] items-center gap-3 border-b border-[var(--admin-border)] bg-white/90 px-4 py-2 backdrop-blur sm:px-6 lg:bg-[var(--admin-surface)] lg:backdrop-blur-none print:hidden">
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
  };
  const strip = sectionTabsFor(pathname, navLinks);

  return (
    <>
      <SkipLink />
      <Suspense fallback={null}>
        <DeniedNotice />
      </Suspense>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-[var(--admin-border)] bg-[var(--admin-surface)] lg:block print:hidden">
        <AdminSidebarBody {...body} idPrefix="side" />
      </aside>

      {/* Top bar: on a phone the menu button and the logo; on a wide screen
          the breadcrumbs. Then the search and the bar's own controls. */}
      <header
        className={`sticky top-0 z-30 flex min-h-[60px] items-center gap-2 border-b border-[var(--admin-border)] bg-white/90 px-4 py-2 backdrop-blur lg:static lg:ml-64 lg:gap-4 lg:bg-[var(--admin-surface)] lg:px-6 lg:backdrop-blur-none print:hidden ${
          // On a wide screen the bar is breadcrumbs, search and controls; a
          // role with neither search nor controls has nothing to put there.
          props.canSearch || props.actions ? "" : "lg:hidden"
        }`}
      >
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menüyü aç"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={DRAWER_ID}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[var(--admin-border)] text-[var(--admin-text-soft)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] lg:hidden"
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
      <Breadcrumbs
        items={navLinks}
        className="px-4 pt-3 sm:px-6 lg:hidden print:hidden"
      />
      {/* An item's tabs, on a tab's own page only (not on /yeni or a
          record below it). */}
      {strip && (
        <SectionTabs
          label={`${strip.item.label} bölümleri`}
          tabs={strip.tabs}
          activeHref={strip.activeHref}
          className="mt-3 lg:mt-0 lg:ml-64 print:hidden"
        />
      )}

      {/* Mobile drawer */}
      <dialog
        ref={dialogRef}
        id={DRAWER_ID}
        aria-label="Menü"
        onClose={() => {
          setOpenOn(null);
          toggleRef.current?.focus();
        }}
        onMouseDown={onBackdropDown}
        onClick={onBackdropClick}
        className="m-0 h-dvh max-h-none w-[80%] max-w-[300px] border-0 border-r border-[var(--admin-border)] bg-[var(--admin-surface)] p-0 text-[var(--admin-text)] shadow-xl backdrop:bg-[rgba(44,29,17,0.45)] lg:hidden print:hidden"
        style={{ fontFamily: "var(--font-poppins), var(--sans)" }}
      >
        {open && (
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Menüyü kapat"
              className="absolute top-2 right-2 z-10 grid h-11 w-11 place-items-center rounded-lg text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-primary)]"
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
    </>
  );
}
