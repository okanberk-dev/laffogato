"use client";

import { createBrowserClient } from "@supabase/ssr";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

/**
 * Browser-side Supabase client (Client Components only).
 *
 * Shares its session with the server through cookies, so a sign-in performed
 * by a Server Function is visible here and vice versa. Today the website signs
 * members in server-side (`src/app/uye/actions.ts`); this client exists for
 * client-driven flows — e-mail confirmation landings, future OAuth buttons —
 * and reads the same public coordinates as everything else.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
