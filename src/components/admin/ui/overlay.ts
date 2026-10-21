import { adminPortalRoot } from "./toast";

/*
 * Where the panel's React Aria pop-overs (the date widgets' calendars now,
 * the combobox's list later) are drawn, and the one switch that turns the
 * widgets off (admin UI v2, UI-14, design §1.3 and risk 3).
 *
 * This is the only file that names `UNSTABLE_portalContainer` (a Popover's
 * mount point, deprecated upstream in favour of `UNSAFE_PortalProvider`,
 * which the `react-aria` package exports and the panel does not depend on)
 * or `UNSAFE_PortalProvider`. A React Aria upgrade that moves either
 * changes this file and nothing else, and if it breaks in the browser the
 * switch below draws the native controls everywhere with one line.
 */

// The switch lives in widget-loader.ts, the light module the forms load, so
// that switching it off also keeps the chunks from being downloaded.
export { DATE_WIDGETS_ENABLED } from "./widget-loader";

/**
 * The node a pop-over under `anchor` is mounted in: the nearest open dialog
 * (a modal `<dialog>` puts everything outside itself out of reach, so a
 * calendar drawn in the page behind it could be neither seen nor pressed),
 * otherwise the panel's portal node, which sits inside the admin wrapper so
 * the `--admin-*` tokens and the panel's font still apply.
 */
export function overlayContainer(anchor?: Element | null): HTMLElement {
  return anchor?.closest<HTMLElement>("dialog[open]") ?? adminPortalRoot();
}

/**
 * The Popover props that mount it in `container` (spread them: `<Popover
 * {...popoverPortal(container)} />`). Nothing until there is a container, so
 * a Popover that is not open yet, and the tests, draw as React Aria does.
 */
export function popoverPortal(container: Element | null | undefined): {
  UNSTABLE_portalContainer?: Element;
} {
  return container ? { UNSTABLE_portalContainer: container } : {};
}
