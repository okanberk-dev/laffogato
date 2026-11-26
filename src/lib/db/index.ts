import "server-only";

import { Pool, type PoolClient, type PoolConfig } from "pg";

import {
  ensureSchema,
  ensureSchemaFresh,
  isSchemaGap,
  schemaIsFresh,
} from "./bootstrap";
import {
  expireTags,
  TAG_KARAOKE,
  TAG_MENU,
  TAG_ORDERS,
  tagsForWrite,
} from "@/lib/cache/tags";
import { pingPanelKaraoke } from "@/lib/panel/karaoke-ping";
import { pingPanelMenu } from "@/lib/panel/menu-ping";
import { pingPanelOrders } from "@/lib/panel/orders-ping";

import { createDb, type Db, type Executor } from "./client";
import { databaseUrlFrom, isDatabaseUrlMissing } from "./database-url.mjs";
import { sslConfigFor } from "./ssl-config.mjs";
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

/** Whether this instance has already said that DATABASE_URL is missing. */
let missingUrlLogged = false;

/**
 * DATABASE_URL, and nothing else (`./database-url.mjs`, shared with the two
 * scripts that open the same database). There used to be a chain to
 * POSTGRES_URL and SUPABASE_DB_URL; Supabase's Vercel integration writes the
 * first into Production, so a lost DATABASE_URL would have connected the site
 * to an empty database and bootstrapped it there.
 *
 * Without it every query fails with `DatabaseUrlMissingError` before any
 * connection is made, and degrades exactly like an unreachable database
 * (`toDbError`, `raiseDbError`): bundled content on the public pages, 503 on
 * the app's API. It stays nameable: the message names the variable, and
 * `/api/health` says `unconfigured` instead of `down`. Called on the first
 * query, never at import, so `next build` (which has no database and reads
 * none) is unaffected. Logged once per instance; the value never is.
 */
function resolveConnectionString(): string {
  try {
    return databaseUrlFrom(process.env);
  } catch (err) {
    if (isDatabaseUrlMissing(err) && !missingUrlLogged) {
      missingUrlLogged = true;
      console.error(`[db] ${(err as Error).message}`);
    }
    throw err;
  }
}

/**
 * The pool's settings for one connection string. The TLS rules (when TLS is
 * on, `DATABASE_SSL_CA` on every host next to the system roots, full
 * verification always) live in `./ssl-config.mjs`, shared with the scripts
 * that open the same database.
 */
export function poolConfig(connectionString: string): PoolConfig {
  const { connectionString: cleaned, ssl } = sslConfigFor(
    connectionString,
    process.env,
  );
  return {
    connectionString: cleaned,
    // Serverless invocations are single-threaded and short-lived, so one
    // connection per instance is the right shape. Keep it at one: the
    // self-hosted server (Coolify, 26 Kas 2026) has no pooler in front of it
    // and Postgres' own `max_connections` (100) is the whole budget, shared by
    // every warm instance, the scripts and the backups.
    max: 1,
    idleTimeoutMillis: 10_000,
    // Fail fast rather than holding a request open against a dead host: an
    // unreachable database degrades the public pages, but only once it errors.
    // A cold serverless instance opening a TLS connection to a pooler that is
    // itself waking a suspended compute can take longer than 5s; the first
    // request should wait rather than degrade.
    connectionTimeoutMillis: 15_000,
    ssl,
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

/**
 * The SQLSTATE classes a refused connection carries when the fault is this
 * deployment's own: a wrong role or password (28) or a database that does
 * not exist (3D). Those stay loud, as rejected queries.
 */
const CONNECT_CONFIG_STATE = /^(28|3D)/;

/**
 * A connection the server refused before any query ran is an outage,
 * whatever SQLSTATE it carries. Neon answers a compute that is over its
 * monthly quota (or suspended) with an error during the connection's
 * startup, not by dropping the socket, and a coded error read as a
 * rejected query: every public page returned 500 instead of its bundled
 * content and the app's API 500 instead of 503 (reproduced on a local
 * Postgres refusing with 53300, 23 Eki 2026). Without its code it reads as
 * the transport failure it is (client.ts `toDbError`, health.ts).
 */
export function connectRefusal(err: unknown): unknown {
  const code = (err as { code?: unknown } | null)?.code;
  if (
    typeof code !== "string" ||
    !/^[0-9A-Z]{5}$/.test(code) ||
    CONNECT_CONFIG_STATE.test(code)
  ) {
    return err;
  }
  const message = err instanceof Error ? err.message : String(err);
  return new Error(message || "connection refused");
}

function createExecutor(): Executor {
  // Connect, then query: a refusal at the door is told apart from a query
  // the database rejected (connectRefusal). Released as pool.query does: a
  // client whose query failed is not handed out again.
  const run = async (query: CompiledQuery) => {
    let client: PoolClient;
    try {
      client = await getPool().connect();
    } catch (err) {
      throw connectRefusal(err);
    }
    try {
      const result = await client.query(query.text, query.params as unknown[]);
      client.release();
      return {
        rows: (result.rows ?? []) as Record<string, unknown>[],
        rowCount: result.rowCount ?? 0,
      };
    } catch (err) {
      client.release(err instanceof Error ? err : true);
      throw err;
    }
  };

  return async (query: CompiledQuery) => {
    // Applies anything the database has not recorded yet, once per instance, so
    // a deploy carries its own migrations instead of waiting for a hand-run
    // `db:migrate`. Never throws - see ensureSchemaFresh.
    await ensureSchemaFresh(getPool());
    try {
      return await run(query);
    } catch (err) {
      // The database is behind the migrations - a missing table (DATABASE_URL
      // set before they ran) or a missing column. Apply the schema and retry
      // exactly once; any second failure is real.
      if (!isSchemaGap(err)) throw err;
      await ensureSchema(getPool());
      return await run(query);
    }
  };
}

export type DbHealth = {
  /**
   * `unconfigured`: this deployment has no DATABASE_URL. Not an outage, and
   * not reported as one: the fix is a deploy setting, not waiting.
   */
  db: "up" | "down" | "unconfigured";
  schema: "fresh" | "stale" | "unknown";
};

/**
 * Is this instance actually able to serve, and is its database caught up?
 *
 * It TRIGGERS the migration as well as reporting on it: `ensureSchemaFresh`
 * first, then the question. So hitting `/api/health` after a deploy both
 * applies anything pending and says whether the apply worked - which is the
 * one thing that was invisible before, because the apply path swallows its
 * own failures by design.
 *
 * Never throws: an unreachable database is an answer (`down`), not an error,
 * and so is a deployment without DATABASE_URL (`unconfigured`).
 */
export async function dbHealth(): Promise<DbHealth> {
  try {
    const pool = getPool();
    await ensureSchemaFresh(pool);
    return {
      db: "up",
      schema: (await schemaIsFresh(pool)) ? "fresh" : "stale",
    };
  } catch (err) {
    return {
      db: isDatabaseUrlMissing(err) ? "unconfigured" : "down",
      schema: "unknown",
    };
  }
}

export function getDb(): Db {
  if (!global.__laffogatoDb) {
    global.__laffogatoDb = createDb(createExecutor(), {
      // Every write expires the cached reads it made stale
      // (src/lib/cache/tags.ts), a failed one too: its reply can be lost
      // after the commit. After the statement, never before: each one
      // commits on its own, and the multi-step writes are SQL functions.
      // A karaoke, menu or order write also pings the köşk's panel, after
      // the response (src/lib/panel/ping.ts; docs/PANEL-KARAOKE.md,
      // docs/PANEL-MENU.md, docs/PANEL-ORDERS.md).
      onWrite: (target) => {
        const tags = tagsForWrite(target);
        expireTags(tags);
        if (tags.includes(TAG_KARAOKE)) pingPanelKaraoke();
        if (tags.includes(TAG_MENU)) pingPanelMenu();
        if (tags.includes(TAG_ORDERS)) pingPanelOrders();
      },
    });
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
  siteImages: "site_images",
  homeHeroSlides: "home_hero_slides",
  paymentTransactions: "payment_transactions",
  walletTransactions: "wallet_transactions",
  press: "press",
  storyTimeline: "story_timeline",
  siteContent: "site_content",
  newsletterSubscribers: "newsletter_subscribers",
  legalDocs: "legal_docs",
  legalOverrideHistory: "legal_override_history",
  legalDocVersions: "legal_doc_versions",
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
  adminActivity: "admin_activity",
  counterTokens: "counter_tokens",
  staffMembers: "staff_members",
  campaignEmails: "campaign_emails",
  campaignEmailSends: "campaign_email_sends",
  emailSuppressions: "email_suppressions",
  customerConsents: "customer_consents",
  orderNoticeEmails: "order_notice_emails",
  cafeTables: "cafe_tables",
  productPriceHistory: "product_price_history",
  supabaseKeepalive: "supabase_keepalive",
  customerDevices: "customer_devices",
  orderPushNotices: "order_push_notices",
  iysRecipients: "iys_recipients",
  iysEvents: "iys_events",
  iysState: "iys_state",
  invoices: "invoices",
  invoiceState: "invoice_state",
  invoiceContacts: "invoice_contacts",
  tableCalls: "table_calls",
  cardVaultPurges: "card_vault_purges",
  menuItemAvailability: "menu_item_availability",
  menuItemBranchPrices: "menu_item_branch_prices",
  franchiseApplications: "franchise_applications",
} as const;
