// Client-safe (no server-only), pure, always loaded: the panel's two view
// preferences (admin UI v2, UI-9, design 3.6). The laptop rail folds the
// sidebar to 64 px of icons; "Sıkı görünüm" tightens the kit's rows and
// cards for a pointer that can aim. Both are per browser, client-only
// (localStorage), so the server and the first paint always draw the
// expanded, comfortable default; the shell applies the stored choice right
// after hydration (components/admin/view-prefs.tsx). Nothing here touches
// the DOM except the three tooltip helpers, which take what they use as
// arguments so the node tests can hand them fakes.

import type { AdminRole } from "./roles";

/** The rail, per browser: "collapsed" or "expanded" (anything else: expanded). */
export const RAIL_PREF_KEY = "laf_admin_rail_v1";
/** The density, per browser: "compact" or "comfortable" (anything else: comfortable). */
export const DENSITY_PREF_KEY = "laf_admin_density_v1";

/** Whether the stored value says the rail is folded. Unreadable: expanded. */
export function parseRailPref(raw: string | null | undefined): boolean {
  return raw === "collapsed";
}

/** Whether the stored value says compact. Unreadable: comfortable. */
export function parseDensityPref(raw: string | null | undefined): boolean {
  return raw === "compact";
}

export const railPrefValue = (collapsed: boolean): string =>
  collapsed ? "collapsed" : "expanded";

export const densityPrefValue = (compact: boolean): string =>
  compact ? "compact" : "comfortable";

/**
 * What the shell writes on the admin root (`[data-admin-root]`). The kit's
 * compact classes (ui/styles.ts COMPACT) and the layout's `--admin-side`
 * read them. Absent means the default: the attribute is added only for a
 * stored choice.
 */
export const RAIL_ATTR = "data-admin-rail";
export const RAIL_ATTR_VALUE = "on";
export const DENSITY_ATTR = "data-admin-density";
export const DENSITY_ATTR_VALUE = "compact";

/**
 * The roles with the two preferences: those with nav chrome (a sidebar to
 * fold, a user menu to hold the switch). Not the cashier, whose shell is one
 * page and a top bar and runs none of this. A role added later gets neither
 * until it is named here.
 */
export function viewPrefsForRole(
  role: AdminRole | null | undefined,
): role is AdminRole {
  return role === "owner" || role === "manager" || role === "staff";
}

/**
 * The palette's "Sıkı görünüm" asks the shell to flip the density with this
 * event (palette-shell.ts runPaletteCommand), as "Klavye kısayolları" asks
 * for the sheet: the list's chunk is at its budget and holds no more code.
 */
export const DENSITY_TOGGLE_EVENT = "admin:density-toggle";

/**
 * What the toast says after the palette flipped the density. A pointer that
 * cannot aim (a touch screen) keeps the 44 px targets whatever is stored,
 * and the line says so.
 */
export function densityMessage(compact: boolean, pointerFine: boolean): string {
  const state = compact ? "Sıkı görünüm açık." : "Sıkı görünüm kapalı.";
  return compact && !pointerFine
    ? `${state} Dokunmatik ekranda uygulanmaz.`
    : state;
}

// ── The rail's tooltips ───────────────────────────────────────────────────
// A rail control names itself with `aria-label` and a CSS tooltip (a child
// the classes show on hover and focus-visible). The tooltip is `fixed`, so
// the nav's own scrolling cannot clip it; where it sits vertically is the
// control's centre, written here as `--tip-y` when the pointer or the focus
// arrives. Esc hides the tooltip of whatever is hovered or focused
// (WCAG 1.4.13) until the pointer or the focus leaves it.

export const RAIL_LINK_ATTR = "data-rail-link";
export const TIP_OFF_ATTR = "data-tip-off";
export const TIP_Y_VAR = "--tip-y";

/** The part of an element these helpers read and write. */
interface TipTarget {
  getBoundingClientRect(): { top: number; height: number };
  style: { setProperty(name: string, value: string): void };
  removeAttribute(name: string): void;
}

/** The pointer or the focus arrived: put the tooltip level with the control. */
export function placeRailTip(el: TipTarget): void {
  const box = el.getBoundingClientRect();
  el.style.setProperty(TIP_Y_VAR, `${Math.round(box.top + box.height / 2)}px`);
  el.removeAttribute(TIP_OFF_ATTR);
}

/** The pointer or the focus left: the next visit shows the tooltip again. */
export function releaseRailTip(el: Pick<TipTarget, "removeAttribute">): void {
  el.removeAttribute(TIP_OFF_ATTR);
}

/** Esc: every rail control under the pointer or holding keyboard focus hides its tooltip. */
export function dismissRailTips(root: {
  querySelectorAll(selector: string): Iterable<{
    setAttribute(name: string, value: string): void;
  }>;
}): void {
  for (const el of root.querySelectorAll(
    `[${RAIL_LINK_ATTR}]:is(:hover, :focus-visible)`,
  )) {
    el.setAttribute(TIP_OFF_ATTR, "");
  }
}
