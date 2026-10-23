import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

/**
 * Cookie-backed Supabase client for Server Components, Server Functions and
 * Route Handlers.
 *
 * A new client per request, never shared: the session lives in the visitor's
 * cookies and `@supabase/ssr` reads and writes it through the `next/headers`
 * cookie store. Writing is only possible from a Server Function or a Route
 * Handler - during a Server Component render Next throws on `set`, and that is
 * swallowed here on purpose. The token refresh that would have been written is
 * not lost on the member pages: `src/proxy.ts` (`updateSession`) refreshes the
 * session on the way in under `/uye` only (`isSessionRefreshPath`), the one
 * place that reads it. Anywhere else, call this client from a Server Function
 * (which can write the rotated cookies), never from a Server Component render:
 * there a refresh would rotate the token and lose the new one.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component: cookies are read-only there. Under
          // `/uye` the proxy has already refreshed the session for this request.
        }
      },
    },
  });
}
