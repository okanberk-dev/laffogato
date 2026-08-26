import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

import { createDb, type Db, type Executor } from "./client";
import type { CompiledQuery } from "./sql";

export { type Db, type DbError, type DbResult } from "./client";

/**
 * Server-side database access (Neon serverless Postgres over HTTP).
 *
 * Lazy global singleton: the connection is NOT resolved at module load, so
 * `next build` can collect page data without live credentials. It is created on
 * first `getDb()` call and cached on `globalThis` to survive dev hot-reloads and
 * warm serverless invocations.
 *
 * The HTTP driver issues one request per query with no connection pool to
 * exhaust, which is what a serverless deployment wants. Every caller is
 * "server-only" — the connection string must never reach the client.
 */
declare global {
  var __laffogatoDb: Db | undefined;
}

function resolveConnectionString(): string {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.NEON_DATABASE_URL ??
    "";
  if (!url) {
    throw new Error(
      "Veritabanı bağlantı dizesi yok — DATABASE_URL (veya POSTGRES_URL) set edilmeli.",
    );
  }
  return url;
}

function createExecutor(): Executor {
  let sql: NeonQueryFunction<false, true> | undefined;

  return async (query: CompiledQuery) => {
    // Resolved on first use, not at module load, so a build without
    // credentials still succeeds.
    sql ??= neon(resolveConnectionString(), { fullResults: true });
    const result = await sql.query(query.text, query.params as unknown[]);
    return {
      rows: (result.rows ?? []) as Record<string, unknown>[],
      rowCount: result.rowCount ?? 0,
    };
  };
}

export function getDb(): Db {
  if (!global.__laffogatoDb) {
    global.__laffogatoDb = createDb(createExecutor());
  }
  return global.__laffogatoDb;
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
  customerCoupons: "customer_coupons",
  counters: "counters",
  shopHeroSlides: "shop_hero_slides",
  paymentTransactions: "payment_transactions",
  reels: "reels",
  press: "press",
  storyTimeline: "story_timeline",
  siteContent: "site_content",
  newsletterSubscribers: "newsletter_subscribers",
  legalDocs: "legal_docs",
} as const;
