// Client-safe: which sidebar entry the current path belongs to, and the
// breadcrumb trail built from it.

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

/** A sidebar entry, as far as the breadcrumbs care. */
export interface NavLink {
  href: string;
  label: string;
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
 * belongs to, then "Yeni", "Düzenle" or "Ayrıntı" (a record) for what lies
 * below it. Built from the nav, not from a second list of routes, so a new
 * entry needs no change here. Empty for a path outside the panel's nav.
 *
 *   /admin/siparisler            Siparişler
 *   /admin/siparisler/ord-12     Siparişler / Ayrıntı
 *   /admin/urunler/prd-1/duzenle Ürünler / Ayrıntı / Düzenle
 *   /admin/musteriler/a@b/duzenle Müşteriler / Ayrıntı / Düzenle
 */
export function breadcrumbTrail(
  pathname: string,
  items: readonly NavLink[],
): Crumb[] {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  const base = activeNavHref(
    path,
    items.map((i) => i.href),
  );
  const entry = base ? items.find((i) => i.href === base) : undefined;
  if (!base || !entry) return [];

  const trail: Crumb[] = [{ label: entry.label, href: base }];
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
