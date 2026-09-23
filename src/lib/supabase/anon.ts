import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

declare global {
  var __laffogatoSupabaseAnon: SupabaseClient | undefined;
}

/**
 * A stateless Supabase client for verifying bearer tokens.
 *
 * The mobile app sends its own access token in `Authorization: Bearer …`
 * (docs/API-MOBILE.md §0). Checking it means asking Supabase "who is this
 * JWT?" - `supabase.auth.getUser(token)` - and nothing else: no cookies, no
 * stored session, no refresh loop. A single process-wide instance is safe
 * precisely because it never holds a session; the token travels with each
 * call.
 *
 * Do not use this for the website's own sign-in - that goes through the
 * cookie-backed client in `./server.ts`.
 */
export function getSupabaseAnonClient(): SupabaseClient {
  if (!global.__laffogatoSupabaseAnon) {
    global.__laffogatoSupabaseAnon = createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  }
  return global.__laffogatoSupabaseAnon;
}
