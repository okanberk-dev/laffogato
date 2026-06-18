import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client (service-role). Bypasses RLS — used only from
 * server components, server actions and route handlers (every caller is
 * "server-only").
 *
 * Lazy global singleton: the client is NOT created at module load, so
 * `next build` can collect page data without live credentials. It is created
 * on first `getSupabaseAdmin()` call and cached on `globalThis` to survive
 * dev hot-reloads / serverless warm invocations.
 */
declare global {
  // eslint-disable-next-line no-var
  var __supabaseAdmin: SupabaseClient | undefined;
}

function resolveUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  if (!url) {
    throw new Error(
      "Supabase URL yok — NEXT_PUBLIC_SUPABASE_URL (veya SUPABASE_URL) set edilmeli.",
    );
  }
  return url;
}

function resolveServiceKey(): string {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    "";
  if (!key) {
    throw new Error(
      "Supabase service-role anahtarı yok — SUPABASE_SERVICE_ROLE_KEY (veya SUPABASE_SECRET_KEY) set edilmeli.",
    );
  }
  return key;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!global.__supabaseAdmin) {
    global.__supabaseAdmin = createClient(resolveUrl(), resolveServiceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return global.__supabaseAdmin;
}

/**
 * Postgres table names in one place (mirrors the former Mongo collection map
 * so the rest of the data layer reads the same).
 */
export const TABLES = {
  products: "products",
  categories: "categories",
  orders: "orders",
  menuItems: "menu_items",
  promos: "promos",
  stockMoves: "stock_moves",
  settings: "settings",
  auditLogs: "audit_logs",
  customers: "customers",
  counters: "counters",
  shopHeroSlides: "shop_hero_slides",
  paymentTransactions: "payment_transactions",
} as const;
