"use client";

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
import { useToast } from "@/components/admin/ui/toast";
import { activeNavHref } from "@/lib/admin/nav-match";

export interface AdminNavItem {
  href: string;
  label: string;
  section: string;
  /** An icon of its own, where entries share a section (ICONS key). */
  icon?: string;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

/* Compact line-icon set, 24×24 stroke icons: one per section, and one per
   nav entry where entries share a section (NavItemDef `icon` in the admin
   layout; the six Mobil Uygulama entries all drew the phone, SHE-18). */
const ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  menu: (
    <>
      <path d="M5 8h12v4a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Z" />
      <path d="M17 9h2.5a2 2 0 0 1 0 4H17" />
      <path d="M8 3v2M12 3v2" />
    </>
  ),
  products: (
    <>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" />
      <path d="M3 7.5 12 12l9-4.5M12 12v9" />
    </>
  ),
  categories: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </>
  ),
  shopHero: (
    <>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m21 15-5-5L5 18" />
    </>
  ),
  press: (
    <>
      <path d="M5 5h12v14H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z" />
      <path d="M17 9h3v8a2 2 0 0 1-2 2" />
      <path d="M8 9h6M8 12h6M8 15h4" />
    </>
  ),
  story: (
    <>
      <path d="M5 4a1 1 0 0 1 1-1h12v15H6a2 2 0 0 0-2 2V5a1 1 0 0 1 1-1Z" />
      <path d="M4 18a2 2 0 0 0 2 2h12" />
    </>
  ),
  content: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  orders: (
    <>
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </>
  ),
  // Kasa · damga: the counter's register.
  till: (
    <>
      <rect x="3" y="10" width="18" height="10" rx="2" />
      <path d="M7 10V5h10v5" />
      <path d="M7 14h2M11 14h2M15 14h2M7 17h10" />
    </>
  ),
  // Masalar · QR: a café table.
  tables: (
    <>
      <path d="M3 8.5h18" />
      <path d="M6 8.5V20M18 8.5V20M6 14h12" />
      <path d="M9 4.5h6" />
    </>
  ),
  // Uygulama ayarları (and any Mobil Uygulama entry without its own).
  mobileApp: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),
  karaoke: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21M9 21h6" />
    </>
  ),
  // Kullanıcılar: a person with a shield (who may open the panel).
  adminUsers: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M18 10.5 21 11.7V14c0 2-1.3 3.4-3 4-1.7-.6-3-2-3-4v-2.3l3-1.2Z" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5M20.5 20a5.5 5.5 0 0 0-3.5-5.1" />
    </>
  ),
  promos: (
    <>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h15A1.5 1.5 0 0 1 21 8.5a2 2 0 0 0 0 4 1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 12.5a2 2 0 0 0 0-4Z" />
      <path d="M14 7.5v9" />
    </>
  ),
  newsletter: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  leads: (
    <>
      <path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="3.2" />
      <path d="M19 8v6M22 11h-6" />
    </>
  ),
  legal: (
    <>
      <path d="M12 3v17M7 20h10" />
      <path d="M5 7h14l-3 1.5L12 7 8 8.5 5 7Z" />
      <path d="m5 7-2.2 5.5a3 3 0 0 0 5.4 0L6 7" />
      <path d="m19 7-2.2 5.5a3 3 0 0 0 5.4 0L20 7" />
    </>
  ),
  stock: (
    <>
      <path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z" />
      <path d="m3 12 9 4.5L21 12M3 16.5 12 21l9-4.5" />
    </>
  ),
  reports: (
    <>
      <path d="M3 21h18" />
      <rect x="5" y="11" width="3.2" height="7" rx="0.5" />
      <rect x="10.4" y="6" width="3.2" height="12" rx="0.5" />
      <rect x="15.8" y="13" width="3.2" height="5" rx="0.5" />
    </>
  ),
  audit: (
    <>
      <path d="M12 3 20 6v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
  // Anasayfa slaytları: the home page.
  homeSlides: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5h13V10" />
      <path d="M9.5 19.5v-5h5v5" />
    </>
  ),
  // Kampanya e-postası: a mail sent out.
  campaign: (
    <>
      <path d="M21 3 10 14" />
      <path d="M21 3 14.5 21 10 14 3 9.5 21 3Z" />
    </>
  ),
  // Slaytlar: a stack of cards.
  appSlides: (
    <>
      <rect x="3" y="7" width="14" height="12" rx="2" />
      <path d="M7 4h12a2 2 0 0 1 2 2v10" />
    </>
  ),
  // Duyurular: a megaphone.
  appAnnouncements: (
    <>
      <path d="M3 10.5v3a1 1 0 0 0 1 1h2.5L15 19V5L6.5 9.5H4a1 1 0 0 0-1 1Z" />
      <path d="M6.5 14.5 8 20h2.5l-1-4.2" />
      <path d="M18 9.5a3 3 0 0 1 0 5" />
    </>
  ),
  // Gönderiler: a post.
  appPosts: (
    <>
      <path d="M4 5h16v11H9l-5 4V5Z" />
      <path d="M8 9h8M8 12.5h5" />
    </>
  ),
  // Canlı durum: on air.
  appLive: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" />
    </>
  ),
  // fA'L bildirimleri: a flagged reading.
  appFal: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </>
  ),
  // Güvenlik / 2FA in the account block.
  security: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5v-3a4 4 0 0 1 8 0v3" />
      <path d="M12 14.5v2" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </>
  ),
};

function NavIcon({ name }: { name: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {ICONS[name] ?? ICONS.dashboard}
    </svg>
  );
}

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

/**
 * The sidebar's contents: the logo, the nav and the account block. Drawn
 * twice (the desktop column and the phone's drawer), so ids take a prefix.
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
  const activeHref = activeNavHref(
    pathname,
    groups.flatMap((g) => g.items.map((i) => i.href)),
  );
  const activeGroup =
    groups.find((g) => g.items.some((i) => i.href === activeHref))?.title ??
    null;
  const securityActive = pathname === "/admin/2fa-kurulum";
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
        {groups.map((group, gi) => {
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
                {group.items.map((item) => {
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
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Account: who is signed in, their 2FA, sign out. Every role sees
          the 2FA link here; the dashboard's quick link was the only one,
          and a cashier never sees the dashboard (SHE-25). */}
      <section
        aria-label="Hesap"
        className="border-t border-[var(--admin-border)] px-3 py-3"
      >
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
          <NavIcon name="security" />
          <span className="truncate">Güvenlik / 2FA</span>
        </Link>
        <form action={logout}>
          <button type="submit" className={`${ROW} ${ROW_IDLE} w-full`}>
            <NavIcon name="logout" />
            Çıkış
          </button>
        </form>
      </section>
    </div>
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

  return (
    <>
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
          // role with neither search nor controls (Kasiyer, one page) has
          // nothing to put there.
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
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link
          href={props.landingPath}
          className="flex min-h-11 items-center gap-2 lg:hidden"
          aria-label="L'Affogato Admin"
        >
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
        </Link>
        <Breadcrumbs items={navLinks} className="hidden flex-1 lg:block" />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {props.canSearch && <TopBarSearch />}
          <div data-admin-topbar-actions="" className="flex items-center gap-2">
            {props.actions}
          </div>
        </div>
      </header>
      <Breadcrumbs
        items={navLinks}
        className="px-4 pt-3 sm:px-6 lg:hidden print:hidden"
      />

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
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
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
