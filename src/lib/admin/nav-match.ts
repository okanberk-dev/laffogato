// Client-safe: which sidebar entry the current path belongs to.

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
