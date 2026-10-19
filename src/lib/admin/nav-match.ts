// Client-safe: which sidebar entry the current path belongs to, and the
// breadcrumb trail built from it. Also the nav's shape per role: which
// items and tabs a role sees (admin UI v2, UI-5), whether it gets any nav
// chrome at all, and where the shell draws an item's tab strip.

// Types only: roles.ts imports this file (withDenied), so the role check
// comes in as a predicate (visibleNav) instead of an import back.
import type { AdminSection } from "./roles";

/**
 * The nav entry a path belongs to: the longest href that is the path itself
 * or one of its parents. Only one entry is ever active. A plain prefix test
 * lit up both "Bülten" (/admin/bulten) and "Kampanya e-postası"
 * (/admin/bulten/kampanya) on the campaign page. `/admin` (the dashboard)
 * matches only itself, or every page would light it.
 */
export function activeNavHref(
  pathname: string,
  hrefs: readonly string[],
): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const hit =
      href === "/admin"
        ? pathname === "/admin"
        : pathname === href || pathname.startsWith(`${href}/`);
    if (hit && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

/** One tab of a nav item: another existing page, drawn as a strip. */
export interface NavTab {
  href: string;
  label: string;
}

/**
 * A sidebar entry, as far as the breadcrumbs care. An item may own tabs
 * (other existing URLs); its href is then its first tab's.
 */
export interface NavLink {
  href: string;
  label: string;
  tabs?: readonly NavTab[];
}

/** Where a path is in the nav: the item, and its tab when it has tabs. */
export interface NavPlace<T extends NavLink = NavLink> {
  item: T;
  tab: NavTab | null;
  /** The href that matched (the item's own, or one of its tabs'). */
  href: string;
}

/**
 * The item (and tab) a path belongs to, over item and tab hrefs alike: the
 * longest matching href wins, as in activeNavHref, and a tab lights the
 * item that owns it. On /admin/kategoriler/yeni that is Ürünler, tab
 * Kategoriler.
 */
export function activeNavPlace<T extends NavLink>(
  pathname: string,
  items: readonly T[],
): NavPlace<T> | null {
  const owner = new Map<string, T>();
  for (const item of items) {
    if (!owner.has(item.href)) owner.set(item.href, item);
    for (const tab of item.tabs ?? []) {
      if (!owner.has(tab.href)) owner.set(tab.href, item);
    }
  }
  const href = activeNavHref(pathname, [...owner.keys()]);
  const item = href ? owner.get(href) : undefined;
  if (!href || !item) return null;
  const tab = item.tabs?.find((t) => t.href === href) ?? null;
  return { item, tab, href };
}

/** A path without its trailing slash (but `/` stays `/`). */
function trimSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

/**
 * The tab strip the shell draws for a path: only for an item with two or
 * more tabs, and only on a tab's own page (a tab root). Not on `/yeni` or a
 * record below it, so the strip never pulls the operator away from a form.
 */
export function sectionTabsFor<T extends NavLink>(
  pathname: string,
  items: readonly T[],
): { item: T; tabs: readonly NavTab[]; activeHref: string } | null {
  const path = trimSlash(pathname);
  const place = activeNavPlace(path, items);
  const tabs = place?.item.tabs;
  if (!place || !tabs || tabs.length < 2) return null;
  if (!tabs.some((t) => t.href === path)) return null;
  return { item: place.item, tabs, activeHref: path };
}

/** One step of the trail; `href` is null for the page itself. */
export interface Crumb {
  label: string;
  href: string | null;
}

/** Static path segments below a nav entry that name a page of their own. */
const SEGMENT_LABELS: Record<string, string> = {
  yeni: "Yeni",
  duzenle: "Düzenle",
  yazdir: "Yazdır",
  "ice-aktar": "İçe aktar",
  "gun-sonu": "Gün sonu",
};

/**
 * Lists whose record has a page of its own AND sub-pages under it
 * (`/admin/musteriler/<e-posta>` and `.../duzenle`, a promo code's view
 * page and its edit page; a product's and a menu item's view page since the
 * catalog lists, admin audit P2b). Elsewhere a record id followed by
 * "duzenle" has no page, so the trail skips it
 * instead of linking to a 404.
 */
const DETAIL_BASES: ReadonlySet<string> = new Set([
  "/admin/musteriler",
  "/admin/promosyon",
  "/admin/urunler",
  "/admin/menu",
]);

/**
 * Where the operator is, as links back up: the sidebar entry the path
 * belongs to, its tab when that is not the entry's first, then "Yeni",
 * "Düzenle" or "Ayrıntı" (a record) for what lies below it. Built from the
 * nav, not from a second list of routes, so a new entry needs no change
 * here. Empty for a path outside the panel's nav.
 *
 *   /admin/siparisler            Siparişler
 *   /admin/siparisler/ord-12     Siparişler / Ayrıntı
 *   /admin/urunler/prd-1/duzenle Ürünler / Ayrıntı / Düzenle
 *   /admin/kategoriler/yeni      Ürünler / Kategoriler / Yeni
 *   /admin/musteriler/a@b/duzenle Müşteriler / Ayrıntı / Düzenle
 */
export function breadcrumbTrail(
  pathname: string,
  items: readonly NavLink[],
): Crumb[] {
  const path = trimSlash(pathname);
  const place = activeNavPlace(path, items);
  if (!place) return [];
  const { item, tab, href: base } = place;

  const trail: Crumb[] = [{ label: item.label, href: item.href }];
  // A tab other than the item's first names itself: "Ürünler / Kategoriler
  // / Yeni". On the first tab the item's own name says it: "Ürünler / Yeni".
  if (tab && item.tabs && tab.href !== item.tabs[0]?.href) {
    trail.push({ label: tab.label, href: tab.href });
  }
  const rest =
    path === base
      ? []
      : path
          .slice(base.length + 1)
          .split("/")
          .filter(Boolean);
  let href = base;
  rest.forEach((segment, i) => {
    href = `${href}/${segment}`;
    const last = i === rest.length - 1;
    const named = SEGMENT_LABELS[segment];
    if (named) {
      trail.push({ label: named, href });
      return;
    }
    // A record id (or a step without a page of its own): one "Ayrıntı" for
    // the record, linked only where the record has a page.
    const next = rest[i + 1];
    const recordPage =
      last || (DETAIL_BASES.has(base) && !!next && !!SEGMENT_LABELS[next]);
    if (recordPage) trail.push({ label: "Ayrıntı", href });
  });
  trail[trail.length - 1] = { ...trail[trail.length - 1], href: null };
  return trail;
}

/**
 * `path` with `denied=1` added: where requireRole's refusal lands (the
 * shell's DeniedNotice says it and takes it off again). Joined through
 * URLSearchParams, so a path that already carries a query keeps it
 * instead of growing a second `?`.
 */
export function withDenied(path: string): string {
  const url = new URL(path, "http://panel.invalid");
  url.searchParams.set("denied", "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

/** A nav item's tab as the layout defines it: a page and its section. */
export interface NavTabDef extends NavTab {
  section: AdminSection;
}

/** A nav item as the layout defines it (admin/layout.tsx NAV_GROUPS). */
export interface NavItemDef extends NavLink {
  section: AdminSection;
  /** ADMIN_ICONS key (ui/icons.tsx); the section's own when omitted. */
  icon?: string;
  /** Old names, synonyms and English words the palette also finds it by. */
  keywords?: readonly string[];
  tabs?: readonly NavTabDef[];
}

export interface NavGroupDef<I extends NavItemDef = NavItemDef> {
  title: string;
  items: readonly I[];
}

/**
 * The nav a role sees, given what it may open (`canAccess` for that role):
 * tabs filtered exactly like items, an item kept when any of its tabs is
 * open to the role, with its href and section moved to its first permitted
 * tab, and empty groups dropped. A manager's Ayarlar is then Uygulama
 * ayarları alone, and draws no strip.
 */
export function visibleNav<I extends NavItemDef>(
  groups: readonly NavGroupDef<I>[],
  mayOpen: (section: AdminSection) => boolean,
): Array<{ title: string; items: I[] }> {
  return groups
    .map((group) => ({
      title: group.title,
      items: group.items.flatMap((item): I[] => {
        if (!item.tabs) return mayOpen(item.section) ? [item] : [];
        const tabs = item.tabs.filter((t) => mayOpen(t.section));
        const first = tabs[0];
        if (!first) return [];
        return [{ ...item, href: first.href, section: first.section, tabs }];
      }),
    }))
    .filter((group) => group.items.length > 0);
}

/** At most this many items: one list, no group headers. */
export const NAV_FLAT_MAX = 6;

const itemCount = (groups: readonly { items: readonly unknown[] }[]) =>
  groups.reduce((n, g) => n + g.items.length, 0);

/**
 * Whether the nav is one flat list (Personel's five items). Group headers
 * over one or two items each are only noise.
 */
export function navIsFlat(groups: readonly { items: readonly unknown[] }[]) {
  return itemCount(groups) <= NAV_FLAT_MAX;
}

/**
 * Whether the role gets nav chrome (sidebar, menu button, drawer) at all.
 * A role with one page (Kasiyer: Kasa) has nowhere to go: the top bar
 * keeps the logo, the page's name and the account menu.
 */
export function hasNavChrome(groups: readonly { items: readonly unknown[] }[]) {
  return itemCount(groups) > 1;
}
