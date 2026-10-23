import { NextResponse, type NextRequest } from "next/server";

import {
  ADMIN_COOKIE_NAME,
  readSessionFromCookieValue,
} from "@/lib/admin/auth";
import {
  encodeListSearch,
  listSearchCookieName,
  listSearchCookieOptions,
  listSearchInAddress,
} from "@/lib/admin/list-search-core";
import {
  ADMIN_PENDING_COOKIE,
  ADMIN_PENDING_MAX_AGE_SECONDS,
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_COOKIE_PATH,
  LEGACY_ADMIN_PENDING_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  adminCookieOptions,
} from "@/lib/admin/session-cookie";
import {
  RESET_PATH,
  RESET_TOKEN_COOKIE,
  RESET_TOKEN_COOKIE_MAX_AGE_SECONDS,
  RESET_TOKEN_MAX_LENGTH,
} from "@/lib/customer/reset-link";
import {
  NEWSLETTER_LINK_COOKIES,
  NEWSLETTER_LINK_COOKIE_MAX_AGE_SECONDS,
  NEWSLETTER_LINK_TOKEN_MAX_LENGTH,
  newsletterLinkPath,
} from "@/lib/newsletter/link-token";
import { adminCsp, isAdminDocumentPath } from "@/lib/security/admin-document";
import { checkoutCsp, newCspNonce } from "@/lib/security/checkout-csp";
import { isCheckoutPath } from "@/lib/security/checkout-document";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Three jobs, in order:
 *
 * 1. Supabase session refresh for every page request (docs/AUTH-BRIDGE.md).
 *    Rotated tokens are written back onto the response so Server Components,
 *    which cannot set cookies themselves, always render with a live session.
 *    `/api/*` is skipped: the mobile API authenticates with a bearer token per
 *    request, the payment webhook with an HMAC, the cron with the bearer
 *    `CRON_SECRET`, and the one-click unsubscribe with the token in its URL -
 *    none has a cookie session to refresh.
 *
 * 2. The checkout's own Content-Security-Policy. The card is typed on
 *    /odeme (docs/PAYNKOLAY.md §15.5), so that one path is outside the site
 *    policy (next.config.ts `CSP_SOURCE`) and gets a strict one here, with a
 *    nonce minted for this request: no `'unsafe-inline'`, no third party
 *    (src/lib/security/checkout-csp.ts). The policy goes on the REQUEST too -
 *    Next.js reads the nonce from the request's `Content-Security-Policy`
 *    header and stamps it on the inline scripts it renders - and on the
 *    response, where the browser enforces it. The page is dynamic
 *    (`force-dynamic`), so every view gets a fresh nonce.
 *
 * 3. The panel's own Content-Security-Policy, the same way: every /admin
 *    response gets a per-request nonce policy with no third party
 *    (src/lib/security/admin-document.ts), on top of the site policy.
 *
 * 4. Admin cookies from before the `/admin` path (lib/admin/session-cookie.ts):
 *    a request to the panel holding the old whole-origin cookie gets it
 *    moved under `/admin` and the old copy expired, so a signed-in admin
 *    stays signed in (`moveLegacyAdminCookies` below).
 *
 * 5. Admin route guard - unchanged. Reads the signed session cookie and
 *    redirects unauthenticated visitors to /admin/giris. The cookie is
 *    verified in full by the admin layout; this only checks for its presence,
 *    which is all that is needed before the render.
 *
 * Before them, three moves of a value out of the address into a cookie
 * scoped to its page, then a reload without it: the password reset token,
 * the newsletter's confirm and unsubscribe tokens
 * (lib/newsletter/link-token.ts), and a panel list's typed search from an
 * old link (`?q=<e-mail>`, lib/admin/list-search-core.ts), which the list
 * now reads from its cookie.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // A backslash in the path (`/karaoke%5C`, `/%5C%5C%5C`) names no page,
  // but on Vercel it reached the pages-router lookup, which tried to
  // require `.next/server/pages/karaoke%5C.js` and answered 500
  // (MODULE_NOT_FOUND, 20 and 21 Eki 2026). Browsers turn a typed `\` into
  // `/` before sending, so only a client that encodes it on purpose (a
  // scanner) gets here: a plain 404 from the proxy, before any routing.
  // Not a redirect to the cleaned path: no visitor needs it, and every
  // cleaning rule would be one more way to build a `//host` location.
  // `/api/*` keeps its own answer: the route handlers reply in their
  // contract's shape (the app reads `{error, message}`, docs/API-MOBILE.md),
  // a plain-text 404 here would change that.
  if (!path.startsWith("/api/") && BACKSLASH_IN_PATH.test(path)) {
    return new NextResponse("Sayfa bulunamadı.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

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

  // The newsletter's confirm and unsubscribe links carry their token the
  // same way, on pages that load the site's tags. Page views only: the
  // button on either page posts a Server Action to the bare path.
  const newsletterPath = newsletterLinkPath(path);
  if (
    newsletterPath &&
    (request.method === "GET" || request.method === "HEAD") &&
    request.nextUrl.searchParams.has("token")
  ) {
    const token = (request.nextUrl.searchParams.get("token") ?? "").trim();
    const url = request.nextUrl.clone();
    url.searchParams.delete("token");
    const moved = NextResponse.redirect(url, 303);
    const name = NEWSLETTER_LINK_COOKIES[newsletterPath];
    if (token && token.length <= NEWSLETTER_LINK_TOKEN_MAX_LENGTH) {
      moved.cookies.set({
        name,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: newsletterPath,
        maxAge: NEWSLETTER_LINK_COOKIE_MAX_AGE_SECONDS,
      });
    } else {
      // An empty or impossible token: the page says "geçersiz", not the
      // previous link's question.
      moved.cookies.delete({ name, path: newsletterPath });
    }
    return moved;
  }

  // A panel list opened from an old link with its search in the address:
  // the text goes into the list's cookie and the list reloads without it,
  // so it leaves the address bar and the history, and neither the page's
  // links nor the sign-in's `next` (below) carry it on. Page views only: a
  // POST here is the list's own form (a Server Action), never moved.
  if (request.method === "GET" || request.method === "HEAD") {
    const found = listSearchInAddress(path, request.nextUrl.searchParams);
    if (found) {
      const url = request.nextUrl.clone();
      url.search = found.rest.toString();
      const moved = NextResponse.redirect(url, 303);
      const name = listSearchCookieName(found.list);
      // The link's search replaces the remembered one; an empty `?q=`
      // forgets it.
      if (Object.keys(found.terms).length > 0) {
        moved.cookies.set({
          name,
          value: encodeListSearch(found.terms),
          ...listSearchCookieOptions(
            path,
            process.env.NODE_ENV === "production",
          ),
        });
      } else {
        moved.cookies.delete({ name, path });
      }
      return moved;
    }
  }

  if (isCheckoutPath(path)) {
    const csp = checkoutCsp(newCspNonce(), {
      development: process.env.NODE_ENV !== "production",
    });
    // Set (not appended): a client cannot choose the nonce by sending its
    // own header. `updateSession` forwards the request's headers - and the
    // cookies it rotates - with every response it builds.
    request.headers.set("content-security-policy", csp);
    const checkout = await updateSession(request);
    checkout.headers.set("Content-Security-Policy", csp);
    return checkout;
  }

  const adminDocument = isAdminDocumentPath(path);
  let finish = (res: NextResponse): NextResponse => res;
  if (adminDocument) {
    const moveCookies = moveLegacyAdminCookies(request);
    const csp = adminCsp(newCspNonce(), {
      development: process.env.NODE_ENV !== "production",
    });
    // On the request for Next's nonce (set, not appended: a client cannot
    // choose it), on the response for the browser.
    request.headers.set("content-security-policy", csp);
    finish = (res) => {
      moveCookies(res);
      res.headers.set("Content-Security-Policy", csp);
      return res;
    };
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
    return finish(response);
  }

  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const session = readSessionFromCookieValue(cookie);

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/giris";
    // The query goes INTO `next`, not along with it: the old clone kept it
    // on the sign-in URL (`/admin/giris?q=<customer e-mail>&next=…`) and
    // dropped it from the way back, so a re-login lost the filters.
    url.search = "";
    url.searchParams.set("next", path + request.nextUrl.search);
    const redirect = NextResponse.redirect(url);
    // Keep any token the refresh above rotated; dropping it would leave the
    // browser holding a refresh token Supabase has already retired.
    for (const c of response.cookies.getAll()) {
      redirect.cookies.set(c);
    }
    return finish(redirect);
  }

  return finish(response);
}

/** `\` raw or percent-encoded (`%5C`, `%5c`), anywhere in the path. */
const BACKSLASH_IN_PATH = /\\|%5c/i;

/**
 * Moves the admin cookies of before 21 Eki 2026 (path `/`, the old names)
 * under `/admin` (lib/admin/session-cookie.ts). Called for a request to the
 * panel, before anything reads its cookies.
 *
 * On the request, at once: a live old session becomes this request's panel
 * session (unless it already has one), so the page or action now running
 * sees the person signed in; the old names are taken off the request.
 *
 * On the response, page views (GET, HEAD) only: the old cookies are expired
 * at path `/` and the moved ones written at `/admin`, with the session's own
 * remaining life (the 7 days are not restarted). A POST is a Server Action,
 * which may itself sign in, sign out or finish 2FA; writing the same panel
 * cookie from here too would leave the browser with whichever header came
 * last. Sign-in and sign-out expire the old cookies themselves
 * (lib/admin/auth.ts), and the next page view moves what is left.
 *
 * Only a validly signed, unexpired session is moved; the layout still
 * checks it against the account. A pending-2FA cookie is checked when the
 * code is typed, and lives five minutes whatever is written here.
 */
function moveLegacyAdminCookies(
  request: NextRequest,
): (response: NextResponse) => void {
  const oldSession = request.cookies.get(LEGACY_ADMIN_SESSION_COOKIE)?.value;
  const oldPending = request.cookies.get(LEGACY_ADMIN_PENDING_COOKIE)?.value;
  if (oldSession === undefined && oldPending === undefined) return () => {};

  const moves: Array<{ name: string; value: string; maxAge: number }> = [];
  const now = Date.now();
  const signed = readSessionFromCookieValue(oldSession);
  const remaining = signed ? Math.floor((signed.expiresAt - now) / 1000) : 0;
  if (
    oldSession &&
    remaining > 0 &&
    !request.cookies.has(ADMIN_SESSION_COOKIE)
  ) {
    moves.push({
      name: ADMIN_SESSION_COOKIE,
      value: oldSession,
      maxAge: remaining,
    });
  }
  if (oldPending && !request.cookies.has(ADMIN_PENDING_COOKIE)) {
    moves.push({
      name: ADMIN_PENDING_COOKIE,
      value: oldPending,
      maxAge: ADMIN_PENDING_MAX_AGE_SECONDS,
    });
  }
  request.cookies.delete(LEGACY_ADMIN_SESSION_COOKIE);
  request.cookies.delete(LEGACY_ADMIN_PENDING_COOKIE);
  for (const m of moves) request.cookies.set(m.name, m.value);

  if (request.method !== "GET" && request.method !== "HEAD") return () => {};
  const secure = process.env.NODE_ENV === "production";
  const expire = [
    oldSession !== undefined && LEGACY_ADMIN_SESSION_COOKIE,
    oldPending !== undefined && LEGACY_ADMIN_PENDING_COOKIE,
  ].filter((name): name is string => !!name);
  return (response) => {
    for (const name of expire) {
      response.cookies.delete({ name, path: LEGACY_ADMIN_COOKIE_PATH });
    }
    for (const m of moves) {
      response.cookies.set(
        m.name,
        m.value,
        adminCookieOptions(m.maxAge, secure),
      );
    }
  };
}

export const config = {
  matcher: [
    // Everything except: the mobile API, the payment webhook, the cron and
    // the one-click unsubscribe (no cookie session - bearer / HMAC / secret /
    // token), Next's static assets, and static files by extension - images,
    // and since 9 Eki 2026 scripts, styles, fonts and text files too.
    // `/laffogato-pour.js` (the home page's cup) ran the session refresh on
    // every view and waited on the identity service like a page; no file
    // with one of these extensions is a page that renders with a session.
    // Not under `/admin/`: there a file-like address (`/admin/urunler/x.js`)
    // still renders a panel page (a dynamic `[id]`, the `[...rest]` 404),
    // which must get the panel CSP and the cookie move like any other
    // (#100, 21 Eki 2026). The panel's own assets are under `_next/static`.
    "/((?!api/mobile|api/webhooks|api/cron|api/bulten|_next/static|_next/image|favicon.ico|(?!admin/).*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|js|mjs|css|map|woff|woff2|ttf|otf|txt|xml|webmanifest|mp4|webm|pdf)$).*)",
    // And any path with a backslash, raw or encoded, outside `/api/` - with a
    // file extension and under `_next/static` too - so the proxy answers it
    // with a 404 before the router tries to resolve it (above).
    "/((?!api/).*(?:%5[cC]|\\\\).*)",
  ],
};
