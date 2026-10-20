// Client-safe: the phone's bottom bar (admin UI v2, UI-7, design §5). Which
// pages it holds for a role, which one it lights, and when it steps out of
// the way. The bar itself is ui/bottom-bar.tsx; the room it takes at the
// bottom of the screen is one variable on the admin root, set in the
// layout's shell class (`--admin-bottom-inset`), which the toasts, the bulk
// bar, the order alert sheet and the sticky save bars read.

import { activeNavPlace, hasNavChrome } from "./nav-match";

/** At most five slots: a thumb's reach, and 78 px each on a 390 px phone. */
export const BOTTOM_BAR_MAX = 5;

/** The last slot when the role has more pages than fit: opens the drawer. */
export const BOTTOM_BAR_MORE_LABEL = "Tümü";

/** A nav item, as far as the bar cares. */
export interface BottomBarItem {
  href: string;
  label: string;
  section: string;
  icon?: string;
}

export type BottomBarSlot<I extends BottomBarItem = BottomBarItem> =
  | {
      kind: "link";
      item: I;
      /** Where the slot goes: the item's page, or the list its badge counts. */
      href: string;
    }
  | { kind: "more" };

function pathOf(href: string): string {
  const cut = href.search(/[?#]/);
  return cut === -1 ? href : href.slice(0, cut);
}

/**
 * The bar's slots for a role's nav (visibleNav's output, so every slot is a
 * page the role may open). None for a role without nav chrome: the
 * cashier's one page has nowhere to go.
 *
 * The role's own landing page leads, the dashboard goes last when it is
 * not that page (for Personel it is not a shift task, decision D2), and
 * the rest keep the nav's order. Everything fits: every item. Otherwise
 * the first four and "Tümü", which opens the drawer with the full nav.
 *
 *   owner, manager  Genel bakış · Siparişler · Karaoke · Kasa · Tümü
 *   staff           Siparişler · Karaoke · Kasa · Stok · Genel bakış
 *   staff + venue   Siparişler · Karaoke · Kasa · Canlı durum · Tümü
 *
 * `hrefs` sends a slot somewhere else than its item: the sidebar's badge
 * links (the orders badge counts the Açık tab, so the slot that carries it
 * opens that tab, admin audit ORD-21).
 */
export function bottomBarSlots<I extends BottomBarItem>(
  groups: readonly { items: readonly I[] }[],
  landingPath: string,
  hrefs: Readonly<Record<string, string>> = {},
): BottomBarSlot<I>[] {
  if (!hasNavChrome(groups)) return [];
  const items = groups.flatMap((g) => g.items);
  const landing = activeNavPlace(pathOf(landingPath), items)?.item ?? null;
  const rank = (item: I) =>
    item === landing ? 0 : item.section === "dashboard" ? 2 : 1;
  const ordered = items
    .map((item, at) => ({ item, at }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.at - b.at)
    .map(({ item }) => item);
  const link = (item: I): BottomBarSlot<I> => ({
    kind: "link",
    item,
    href: hrefs[item.section] ?? item.href,
  });
  if (ordered.length <= BOTTOM_BAR_MAX) return ordered.map(link);
  return [...ordered.slice(0, BOTTOM_BAR_MAX - 1).map(link), { kind: "more" }];
}

/**
 * The slot to light, given the nav item the current page belongs to
 * (activeNavPlace over the whole nav): that item's slot, else "Tümü" (the
 * page was reached through the drawer: Kategoriler, Raporlar, 2FA), else
 * none (-1).
 */
export function activeBottomSlot(
  slots: readonly BottomBarSlot[],
  activeItemHref: string | null,
): number {
  const at = slots.findIndex(
    (s) => s.kind === "link" && s.item.href === activeItemHref,
  );
  if (at !== -1) return at;
  return slots.findIndex((s) => s.kind === "more");
}

/**
 * When the bar is not drawn. Each a Tailwind class, so the rule holds
 * before hydration and costs no listener:
 *  - from `lg` up, where the sidebar is;
 *  - on paper;
 *  - while the bulk bar is up: it takes the bar's place (bulk.tsx);
 *  - while any dialog is open (the drawer, a confirm, the palette): the
 *    page behind is inert anyway, and a sheet would sit on the bar;
 *  - while a text field has focus on a touch screen: the keyboard is up,
 *    and the bar would ride on top of it. A text field is any input but
 *    the ones that open a picker or nothing (checkbox, date, file...), a
 *    text area, or editable text. Not a select: iOS keeps a select
 *    focused after its wheel closes, and the bar would stay away until
 *    the next tap.
 */
export const BOTTOM_BAR_HIDE = [
  "lg:hidden",
  "print:hidden",
  "[:root:has([data-admin-bulk-bar])_&]:hidden",
  "[:root:has(dialog[open])_&]:hidden",
  "pointer-coarse:[:root:has(:is(input:not([type=checkbox],[type=radio],[type=button],[type=submit],[type=reset],[type=range],[type=color],[type=file],[type=image],[type=date],[type=datetime-local],[type=time],[type=month],[type=week]),textarea,[contenteditable]:not([contenteditable=false])):focus)_&]:hidden",
] as const;
