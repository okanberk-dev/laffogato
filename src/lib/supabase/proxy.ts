import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

/**
 * Whether the request carries a Supabase auth cookie at all.
 *
 * `@supabase/ssr` names its cookies `sb-<project-ref>-auth-token` (chunked
 * as `.0`, `.1`, … when long). An anonymous visitor has none, and for them
 * there is nothing to refresh — so the proxy skips building a client and
 * touching the auth server on every page view of the marketing site.
 */
/**
 * How long a page render may wait on the identity service.
 *
 * `updateSession` runs on every HTML request that carries a Supabase cookie.
 * Without a bound, an identity service having a bad minute becomes the site
 * having a bad minute: each request sits on `getUser()` until the platform's
 * own timeout. Past this, the request continues with the cookies it already
 * has — the session is refreshed on the next visit instead.
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
          console.error("[supabase] getUser timed out; continuing unrefreshed");
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
 * Refreshes the Supabase session on the way into the app and writes the
 * rotated tokens back onto both the forwarded request and the response.
 *
 * This is the piece Supabase's SSR guide calls mandatory: Server Components
 * cannot set cookies, so without a refresh here an expired access token would
 * sit in the browser until a Server Function happened to run. The request
 * cookies are updated too so that the very same render already sees the fresh
 * token, and the response is re-created after that so the two never disagree.
 *
 * Only the cookie plumbing lives here. Whether a visitor may see a page is
 * decided by the caller (`src/proxy.ts`), never by this helper.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  if (!hasSupabaseSessionCookie(request)) return response;

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
  // triggers the refresh. Its result is deliberately unused — identity for a
  // page is re-checked where the page is rendered.
  try {
    await withTimeout(supabase.auth.getUser(), GET_USER_TIMEOUT_MS);
  } catch (err) {
    // Auth server unreachable: the visitor keeps their current cookies and the
    // page renders as it would for a stale session. Never an error page.
    console.error(
      `[supabase] session refresh failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return response;
}
