import "server-only";

import { Pool, type PoolConfig } from "pg";

import { ensureSchema, isMissingRelation } from "./bootstrap";
import { createDb, type Db, type Executor } from "./client";
import type { CompiledQuery } from "./sql";

export { type Db, type DbError, type DbResult } from "./client";

/**
 * Server-side database access over the standard Postgres wire protocol.
 *
 * Deliberately a plain driver rather than a vendor SDK. The site was down for a
 * month because its data lived behind one provider's client and one provider's
 * account limit; `pg` talks to Neon's pooled endpoint, to any managed Postgres,
 * and to a local one in tests, so moving hosts is a connection-string change.
 *
 * Lazy global singleton: the pool is NOT created at module load, so `next build`
 * can collect page data without live credentials. It is created on first
 * `getDb()` call and cached on `globalThis` to survive dev hot-reloads and warm
 * serverless invocations.
 */
declare global {
  var __laffogatoDb: Db | undefined;
  var __laffogatoPool: Pool | undefined;
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

export function poolConfig(connectionString: string): PoolConfig {
  let sslmode = "";
  let cleaned = connectionString;
  try {
    const url = new URL(connectionString);
    sslmode = url.searchParams.get("sslmode") ?? "";
    // Hand pg a URL without the SSL params and configure `ssl` explicitly
    // below. pg-connection-string treats sslmode=require as a deprecated alias
    // and warns about it on every cold start, which shows up as an error-level
    // line in the platform logs — noise that hides the entries that matter.
    url.searchParams.delete("sslmode");
    url.searchParams.delete("channel_binding");
    cleaned = url.toString();
  } catch {
    // Not URL-shaped (a key=value DSN); fall back to a substring probe.
    sslmode = /sslmode=([a-z-]+)/.exec(connectionString)?.[1] ?? "";
  }
  const wantsSsl = sslmode !== "" && sslmode !== "disable";

  return {
    connectionString: cleaned,
    // Serverless invocations are single-threaded and short-lived, so one
    // connection per instance is the right shape; the provider's pooler does
    // the real multiplexing.
    max: 1,
    idleTimeoutMillis: 10_000,
    // Fail fast rather than holding a request open against a dead host: an
    // unreachable database degrades the public pages, but only once it errors.
    // A cold serverless instance opening a TLS connection to a pooler that is
    // itself waking a suspended compute can take longer than 5s; the first
    // request should wait rather than degrade.
    connectionTimeoutMillis: 15_000,
    // Full verification: the certificate chain is checked against the system
    // roots, which is what sslmode=verify-full means.
    ssl: wantsSsl ? { rejectUnauthorized: true } : undefined,
  };
}

function getPool(): Pool {
  if (!global.__laffogatoPool) {
    const pool = new Pool(poolConfig(resolveConnectionString()));
    // An idle client erroring (a pooler recycling it) must not take the process
    // down; the next query opens a fresh connection.
    pool.on("error", (err) => {
      console.error(`[db] idle client error: ${err.message}`);
    });
    global.__laffogatoPool = pool;
  }
  return global.__laffogatoPool;
}

function createExecutor(): Executor {
  const run = async (query: CompiledQuery) => {
    const result = await getPool().query(query.text, query.params as unknown[]);
    return {
      rows: (result.rows ?? []) as Record<string, unknown>[],
      rowCount: result.rowCount ?? 0,
    };
  };

  return async (query: CompiledQuery) => {
    try {
      return await run(query);
    } catch (err) {
      // An empty database — DATABASE_URL set before the migrations ran. Create
      // the schema and retry exactly once; any second failure is real.
      if (!isMissingRelation(err)) throw err;
      await ensureSchema(getPool());
      return await run(query);
    }
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
