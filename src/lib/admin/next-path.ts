import { sameSitePath } from "@/lib/http/same-site-path";

const BASE = "https://panel.invalid";

/** The two sign-in steps: never a destination, or a login would loop. */
const SIGN_IN_PATHS = new Set(["/admin/giris", "/admin/iki-asama"]);

/**
 * Where a sign-in may send the operator next (`?next=`, the forms' hidden
 * `next`): a panel page on this site, query included, so an expired session
 * on `/admin/siparisler?durum=acik` comes back to the filtered list. Read
 * through `sameSitePath` (rule 26), then resolved, so `/admin/../uye` is not
 * a panel page. Null for anything else; the caller uses the role's landing
 * page.
 */
export function adminNextPath(raw: unknown): string | null {
  const path = sameSitePath(raw);
  if (!path) return null;
  let url: URL;
  try {
    url = new URL(path, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  const { pathname } = url;
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return null;
  if (SIGN_IN_PATHS.has(pathname)) return null;
  return pathname + url.search;
}
