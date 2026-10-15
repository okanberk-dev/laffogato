import { NextResponse, type NextRequest } from "next/server";

import {
  ADMIN_COOKIE_NAME,
  readSessionFromCookieValue,
} from "@/lib/admin/auth";
import {
  RESET_PATH,
  RESET_TOKEN_COOKIE,
  RESET_TOKEN_COOKIE_MAX_AGE_SECONDS,
  RESET_TOKEN_MAX_LENGTH,
} from "@/lib/customer/reset-link";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Two jobs, in order:
 *
 * 1. Supabase session refresh for every page request (docs/AUTH-BRIDGE.md).
 *    Rotated tokens are written back onto the response so Server Components,
 *    which cannot set cookies themselves, always render with a live session.
 *    `/api/*` is skipped: the mobile API authenticates with a bearer token per
 *    request, the payment webhook with an HMAC, the cron with the bearer
 *    `CRON_SECRET`, and the one-click unsubscribe with the token in its URL -
 *    none has a cookie session to refresh.
 *
 * 2. Admin route guard - unchanged. Reads the signed session cookie and
 *    redirects unauthenticated visitors to /admin/giris. The cookie is
 *    verified in full by the admin layout; this only checks for its presence,
 *    which is all that is needed before the render.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/api/")) {
    return NextResponse.next();
  }

  // The reset link carries its token in the query string; the page loads
  // GTM, whose tags report the full URL to third parties. Move the token into
  // a cookie scoped to this path and reload without it (lib/customer/reset-link.ts).
  if (path === RESET_PATH && request.nextUrl.searchParams.has("token")) {
    const token = (request.nextUrl.searchParams.get("token") ?? "").trim();
    const url = request.nextUrl.clone();
    url.search = "";
    const moved = NextResponse.redirect(url, 303);
    if (token && token.length <= RESET_TOKEN_MAX_LENGTH) {
      moved.cookies.set({
        name: RESET_TOKEN_COOKIE,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: RESET_PATH,
        maxAge: RESET_TOKEN_COOKIE_MAX_AGE_SECONDS,
      });
    }
    return moved;
  }

  const response = await updateSession(request);

  const isAdminRoute = path.startsWith("/admin");
  // The two steps of signing in. `/admin/iki-asama` is reached holding only
  // the short-lived *pending* cookie - the full session does not exist until
  // the TOTP code is accepted there. Guarding it with the full-session check
  // sent every 2FA-enrolled admin back to /admin/giris, forever: nobody who
  // had turned 2FA on could sign in. The page and its action check the
  // pending cookie themselves (`getPendingSession`, `complete2FA`).
  const isAdminSignIn = path === "/admin/giris" || path === "/admin/iki-asama";

  if (!isAdminRoute || isAdminSignIn) {
    return response;
  }

  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const session = readSessionFromCookieValue(cookie);

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/giris";
    url.searchParams.set("next", path);
    const redirect = NextResponse.redirect(url);
    // Keep any token the refresh above rotated; dropping it would leave the
    // browser holding a refresh token Supabase has already retired.
    for (const c of response.cookies.getAll()) {
      redirect.cookies.set(c);
    }
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except: the mobile API, the payment webhook, the cron and
    // the one-click unsubscribe (no cookie session - bearer / HMAC / secret /
    // token), Next's static assets, and image files.
    "/((?!api/mobile|api/webhooks|api/cron|api/bulten|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
