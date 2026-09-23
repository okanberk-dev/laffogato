import "server-only";

import { Pool, type PoolConfig } from "pg";

import {
  ensureSchema,
  ensureSchemaFresh,
  isSchemaGap,
  schemaIsFresh,
} from "./bootstrap";
import { createDb, type Db, type Executor } from "./client";
import type { CompiledQuery } from "./sql";

export { type Db, type DbError, type DbResult } from "./client";

/**
 * Server-side database access over the standard Postgres wire protocol.
 *
 * Deliberately a plain driver rather than a vendor SDK. The site was down for a
 * month because its data lived behind one provider's client and one provider's
 * account limit; `pg` talks to Supabase's pooler, to Neon's pooled endpoint, to
 * any managed Postgres, and to a local one in tests, so moving hosts is a
 * connection-string change rather than a rewrite.
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
  // Order matters: the explicit variable wins, then the one Vercel's Postgres
  // integrations (Supabase included) set automatically, then Supabase's own.
  // There is deliberately NO legacy provider variable here: the operator asked
  // for the old host to be gone entirely, production sets DATABASE_URL
  // explicitly, and a dead fallback name is one more place for a stale
  // connection string to hide.
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.SUPABASE_DB_URL ??
    "";
  if (!url) {
    throw new Error(
      "Veritabanı bağlantı dizesi yok — DATABASE_URL (veya POSTGRES_URL) set edilmeli.",
    );
  }
  return url;
}

/**
 * DATABASE_SSL_CA is only usable when it is plainly PEM. A truncated paste
 * would fail the handshake anyway, but with an error that names X.509 innards
 * instead of the actual mistake — this names it once, loudly, at pool startup.
 */
function validCa(): boolean {
  const ca = process.env.DATABASE_SSL_CA;
  if (!ca) return false;
  if (ca.includes("-----BEGIN CERTIFICATE-----")) return true;
  console.error(
    "[db] DATABASE_SSL_CA PEM görünmüyor (BEGIN CERTIFICATE yok) — yok sayılıyor",
  );
  return false;
}

export function poolConfig(connectionString: string): PoolConfig {
  let sslmode = "";
  let cleaned = connectionString;
  let host = "";
  try {
    const url = new URL(connectionString);
    // WHATWG URL, "özel olmayan" şemalarda (postgresql:) host'u KÜÇÜLTMEZ —
    // https: ile küçülen aynı host burada olduğu gibi kalır. Emniyet kilidi
    // harfe duyarlı kalsaydı, büyük harfli bir pooler host'u kilidi atlar ve
    // DNS harfe duyarsız olduğu için bağlantı düz metin olarak BAŞARILI olurdu.
    host = url.hostname.toLowerCase();
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
  // Supabase'in uçları (doğrudan ve Supavisor pooler) TLS'siz oturumu kabul
  // eder ama etmemeli: sslmode'suz bir Supabase dizesi yapıştırıldığında TLS'i
  // kapatmak, üretim trafiğini sessizce düz metne düşürür. Bu satır sağlayıcı
  // bağımlılığı değil, emniyet kilididir — ölçülen davranış için
  // docs/SUPABASE-GECIS.md §2'ye bak.
  const supabaseHost =
    host.endsWith(".supabase.co") || host.endsWith(".pooler.supabase.com");
  const wantsSsl = (sslmode !== "" && sslmode !== "disable") || supabaseHost;

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
    // Full verification, ALWAYS. Supabase's endpoints present a chain rooted
    // in Supabase's own CA (measured: "self signed certificate in certificate
    // chain" against system roots on every pooler endpoint), so a custom root
    // can be supplied as PEM via DATABASE_SSL_CA — verification then runs
    // against that root instead of the system set. What this deliberately does
    // NOT offer is rejectUnauthorized:false: "encrypted but unverified" fails
    // silently in the worst way, and the health layer would mask it as
    // "database unreachable" and serve bundled data instead of erroring.
    // The custom root is applied ONLY on Supabase hosts. Node's `ca` REPLACES
    // the Mozilla roots rather than extending them, so an unscoped CA would
    // break the documented one-step rollback: DATABASE_URL back to the old
    // publicly-signed host while
    // DATABASE_SSL_CA is still set would fail every publicly-signed handshake —
    // and per the health layer, as "empty site", not as a 500.
    ssl: wantsSsl
      ? {
          rejectUnauthorized: true,
          ...(supabaseHost && validCa()
            ? { ca: process.env.DATABASE_SSL_CA }
            : {}),
        }
      : undefined,
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
    // Applies anything the database has not recorded yet, once per instance, so
    // a deploy carries its own migrations instead of waiting for a hand-run
    // `db:migrate`. Never throws — see ensureSchemaFresh.
    await ensureSchemaFresh(getPool());
    try {
      return await run(query);
    } catch (err) {
      // The database is behind the migrations — a missing table (DATABASE_URL
      // set before they ran) or a missing column. Apply the schema and retry
      // exactly once; any second failure is real.
      if (!isSchemaGap(err)) throw err;
      await ensureSchema(getPool());
      return await run(query);
    }
  };
}

export type DbHealth = {
  db: "up" | "down";
  schema: "fresh" | "stale" | "unknown";
};

/**
 * Is this instance actually able to serve, and is its database caught up?
 *
 * It TRIGGERS the migration as well as reporting on it: `ensureSchemaFresh`
 * first, then the question. So hitting `/api/health` after a deploy both
 * applies anything pending and says whether the apply worked — which is the
 * one thing that was invisible before, because the apply path swallows its
 * own failures by design.
 *
 * Never throws: an unreachable database is an answer (`down`), not an error.
 */
export async function dbHealth(): Promise<DbHealth> {
  try {
    const pool = getPool();
    await ensureSchemaFresh(pool);
    return { db: "up", schema: (await schemaIsFresh(pool)) ? "fresh" : "stale" };
  } catch {
    return { db: "down", schema: "unknown" };
  }
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
  customerMilestoneRewards: "customer_milestone_rewards",
  featureConsents: "feature_consents",
  falReadings: "fal_readings",
  falReports: "fal_reports",
  counters: "counters",
  shopHeroSlides: "shop_hero_slides",
  paymentTransactions: "payment_transactions",
  press: "press",
  storyTimeline: "story_timeline",
  siteContent: "site_content",
  newsletterSubscribers: "newsletter_subscribers",
  legalDocs: "legal_docs",
  admin2fa: "admin_2fa",
  authAttempts: "auth_attempts",
  appHeroSlides: "app_hero_slides",
  appAnnouncements: "app_announcements",
  appPosts: "app_posts",
  loyaltyStamps: "loyalty_stamps",
  invites: "invites",
  venueStatus: "venue_status",
  karaokeReservations: "karaoke_reservations",
  adminUsers: "admin_users",
  counterTokens: "counter_tokens",
  campaignEmails: "campaign_emails",
  campaignEmailSends: "campaign_email_sends",
  emailSuppressions: "email_suppressions",
  customerConsents: "customer_consents",
} as const;
