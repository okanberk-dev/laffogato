import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

/**
 * Whether the request carries a Supabase auth cookie at all.
 *
 * `@supabase/ssr` names its cookies `sb-<project-ref>-auth-token` (chunked
 * as `.0`, `.1`, … when long). An anonymous visitor has none, and for them
 * there is nothing to refresh - so the proxy skips building a client and
 * touching the auth server on every page view of the marketing site.
 */
/**
 * How long a page render may wait on the identity service.
 *
 * `updateSession` refreshes on every member-page request (`/uye`) that
 * carries a Supabase cookie. Without a bound, an identity service having a bad minute becomes the site
 * having a bad minute: each request sits on `getUser()` until the platform's
 * own timeout. Past this, the request continues with the cookies it already
 * has - the session is refreshed on the next visit instead.
 */
const GET_USER_TIMEOUT_MS = 3000;

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          console.error(
            "[supabase] session refresh timed out; continuing unrefreshed",
          );
          resolve(null);
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function hasSupabaseSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
}

/**
 * Whether a request's path is one where the Supabase cookie session is read:
 * the member pages under `/uye` and the Server Actions they post there - sign
 * in and register (`signInWithPassword`, `signUp`) and sign out from the
 * account pages (src/app/uye/actions.ts, the only cookie-backed client
 * user besides src/lib/customer/supabase-bridge.ts, which those same actions
 * call).
 *
 * Nowhere else reads it. A page's identity is the site's own signed cookie
 * (`getActiveCustomer`), the panel's is its own cookie, and the app's is the
 * bearer token checked per request (`requireMobileCustomer`; `/api/*` never
 * reaches the refresh). Production logged "getUser timed out" 472 times on
 * 9-17 Eki 2026 because every page a signed-in member opened - the home page,
 * the menu, the checkout - waited on the identity service first. Signing out
 * from the header of a public page needs no refresh here either: it is a
 * Server Action, which writes its own cookies and lets supabase-js refresh
 * an expired session itself before it signs out.
 */
export function isSessionRefreshPath(pathname: string): boolean {
  return pathname === "/uye" || pathname.startsWith("/uye/");
}

/**
 * Refreshes the Supabase session on the way into the app and writes the
 * rotated tokens back onto both the forwarded request and the response.
 *
 * This is the piece Supabase's SSR guide calls mandatory: Server Components
 * cannot set cookies, so without a refresh here an expired access token would
 * sit in the browser until a Server Function happened to run. The request
 * cookies are updated too so that the very same render already sees the fresh
 * token, and the response is re-created after that so the two never disagree.
 *
 * Only on the paths that read the Supabase session (`isSessionRefreshPath`);
 * elsewhere the request goes on untouched, as for an anonymous visitor.
 *
 * On a timeout or an unreachable identity service the request goes on with
 * the cookies it came with: nothing is deleted or rewritten, and a refresh
 * that finishes after the bound reaches neither this request nor its
 * response. The member stays signed in (tests/supabase-session-refresh.test.ts).
 *
 * Only the cookie plumbing lives here. Whether a visitor may see a page is
 * decided by the caller (`src/proxy.ts`), never by this helper.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  if (!hasSupabaseSessionCookie(request)) return response;
  if (!isSessionRefreshPath(request.nextUrl.pathname)) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // A response that rotates auth cookies must never be cached by a CDN.
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not drop this call or move logic between it and the return: it is what
  // triggers the refresh. Its result is deliberately unused - identity for a
  // page is re-checked where the page is rendered (the site's own signed
  // cookie, `getActiveCustomer`).
  //
  // `getClaims()`, not `getUser()` (Supabase's SSR guide since asymmetric
  // signing keys): it refreshes an expired session exactly as `getUser()` did,
  // but a still-valid access token is verified against the project's cached
  // public keys instead of a round trip to the auth server on EVERY page view.
  // Production logged "getUser timed out" on every page a signed-in visitor
  // opened, each one held for the full three seconds. On a project still on
  // the legacy shared secret it falls back to `getUser()` - never slower.
  try {
    await withTimeout(supabase.auth.getClaims(), GET_USER_TIMEOUT_MS);
  } catch (err) {
    // Auth server unreachable: the visitor keeps their current cookies and the
    // page renders as it would for a stale session. Never an error page.
    console.error(
      `[supabase] session refresh failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return response;
}
