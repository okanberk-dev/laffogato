import "server-only";

import { revalidateTag } from "next/cache";
import { after } from "next/server";

import type { TABLES } from "@/lib/db";
import type { WriteTarget } from "@/lib/db/client";

/**
 * Which cached reads a database write makes stale.
 *
 * The site caches presentation reads (src/lib/cache/presentation.ts) and the
 * panel's change markers (src/lib/admin/change-marker.ts) in the Next Data
 * Cache, with no short time limit: an entry stays good until a write says
 * otherwise. That only holds if EVERY write says so, so the data layer does
 * it, not the callers: `getDb()` hands each insert, upsert, update,
 * delete and rpc it sent to `tagsForWrite`, failed ones too (a commit whose
 * reply was lost looks like a failure), and `expireTags` expires the answer
 * (src/lib/db/index.ts).
 *
 * Four tags:
 * - `pub:catalog`: products, categories, menu items (the shop and the menu).
 * - `pub:site`: settings and every panel-edited text, slide and legal
 *   override the public pages print, and the venue's live status.
 * - `live:orders`: orders (the new-order bell and the panel's counts).
 * - `live:karaoke`: karaoke bookings (the nav badge).
 *
 * Every table and every SQL function is listed here on purpose, tagged or
 * not, and tests/cache-write-tags.test.ts fails on one that is not: a new
 * table cannot be cached silently stale. A function missing from the map
 * expires all four tags, because expiring too much only costs a read.
 */

export const TAG_CATALOG = "pub:catalog";
export const TAG_SITE = "pub:site";
export const TAG_ORDERS = "live:orders";
export const TAG_KARAOKE = "live:karaoke";

export const ALL_CACHE_TAGS = [
  TAG_CATALOG,
  TAG_SITE,
  TAG_ORDERS,
  TAG_KARAOKE,
] as const;

export type CacheTag = (typeof ALL_CACHE_TAGS)[number];

type TableName = (typeof TABLES)[keyof typeof TABLES];

const NONE: readonly CacheTag[] = [];
const CATALOG: readonly CacheTag[] = [TAG_CATALOG];
const SITE: readonly CacheTag[] = [TAG_SITE];
/** Stock moves with an order: the shop's stock and the order both change. */
const STOCK_AND_ORDERS: readonly CacheTag[] = [TAG_CATALOG, TAG_ORDERS];

/** Every table in `TABLES`, with the tags a write to it expires. */
export const TABLE_TAGS: Record<TableName, readonly CacheTag[]> = {
  products: CATALOG,
  categories: CATALOG,
  menu_items: CATALOG,

  settings: SITE,
  site_content: SITE,
  press: SITE,
  story_timeline: SITE,
  shop_hero_slides: SITE,
  home_hero_slides: SITE,
  app_posts: SITE,
  app_hero_slides: SITE,
  app_announcements: SITE,
  legal_docs: SITE,
  venue_status: SITE,

  orders: [TAG_ORDERS],
  karaoke_reservations: [TAG_KARAOKE],

  // Read live wherever they are read: nothing caches them.
  promos: NONE,
  stock_moves: NONE,
  audit_logs: NONE,
  customers: NONE,
  customer_coupons: NONE,
  customer_milestone_rewards: NONE,
  feature_consents: NONE,
  fal_readings: NONE,
  fal_reports: NONE,
  counters: NONE,
  payment_transactions: NONE,
  wallet_transactions: NONE,
  newsletter_subscribers: NONE,
  legal_override_history: NONE,
  admin_2fa: NONE,
  auth_attempts: NONE,
  loyalty_stamps: NONE,
  invites: NONE,
  admin_users: NONE,
  counter_tokens: NONE,
  staff_members: NONE,
  campaign_emails: NONE,
  campaign_email_sends: NONE,
  email_suppressions: NONE,
  customer_consents: NONE,
  order_notice_emails: NONE,
  cafe_tables: NONE,
  // Written by a trigger on every price change; read live by the panel's
  // discount check, never cached.
  product_price_history: NONE,
};

/**
 * Every function in db/schema.sql, with the tags a call expires. Trigger
 * functions and read-only helpers are listed too, so the test can tell a
 * function nobody classified from one that writes nothing cached.
 */
export const RPC_TAGS: Record<string, readonly CacheTag[]> = {
  // Stock, orders and refunds.
  claim_order_stock: STOCK_AND_ORDERS,
  release_order_stock: STOCK_AND_ORDERS,
  adjust_product_stock: STOCK_AND_ORDERS,
  adjust_variant_stock: STOCK_AND_ORDERS,
  credit_product_stock: STOCK_AND_ORDERS,
  restock_order_lines: STOCK_AND_ORDERS,
  release_order_inventory: STOCK_AND_ORDERS,
  save_product_variants: STOCK_AND_ORDERS,
  record_stock_move: STOCK_AND_ORDERS,
  set_order_item_status: STOCK_AND_ORDERS,
  reserve_order_refund: STOCK_AND_ORDERS,
  reserve_order_refund_once: STOCK_AND_ORDERS,
  drop_order_refund: STOCK_AND_ORDERS,
  wallet_place_order: STOCK_AND_ORDERS,

  // Legal overrides the /hukuk pages print.
  legal_doc_save: SITE,
  legal_doc_reset: SITE,

  // Counters, sign-in limits, promos, campaigns, wishlists, fal: nothing
  // cached reads them.
  next_seq: NONE,
  raise_counter: NONE,
  record_auth_failure: NONE,
  reserve_auth_attempt: NONE,
  redeem_promo: NONE,
  release_promo_usage: NONE,
  increment_promo_usage: NONE,
  toggle_wishlist: NONE,
  campaign_email_claim: NONE,
  campaign_email_enqueue: NONE,
  campaign_email_mark: NONE,
  campaign_email_audience: NONE,
  campaign_email_audience_count: NONE,
  birthday_greeting_audience: NONE,
  email_suppression_record: NONE,
  reserve_fal_reading: NONE,
  customer_consents_retention: NONE,

  // Read-only helpers.
  admin_customer_counts: NONE,
  admin_customer_page: NONE,
  admin_customer_rows: NONE,
  admin_fold_tr: NONE,
  admin_sort_tr: NONE,
  variant_stock_total: NONE,
  product_variant_list: NONE,

  // Trigger functions: they run inside a write the table already names.
  app_pending_order_cap: NONE,
  audit_logs_append_only: NONE,
  karaoke_open_cap: NONE,
  counter_token_issue_cap: NONE,
  customer_consents_append_only: NONE,
  legal_override_history_append_only: NONE,
  // Writes product_price_history inside the products write that fired it.
  record_product_price: NONE,
};

/** The tags a write expires. Unknown names expire everything. */
export function tagsForWrite(target: WriteTarget): readonly CacheTag[] {
  const tags =
    "table" in target
      ? (TABLE_TAGS as Record<string, readonly CacheTag[] | undefined>)[
          target.table
        ]
      : RPC_TAGS[target.fn];
  return tags ?? ALL_CACHE_TAGS;
}

function note(tag: string, err: unknown): void {
  if (process.env.NODE_ENV !== "production") return;
  console.warn(
    `[cache-tags] ${tag} not expired: ${err instanceof Error ? err.message : String(err)}`,
  );
}

/**
 * Expires `tags` at once: the next read of anything tagged with one waits
 * for fresh data, nothing stale is served (`{ expire: 0 }`, the two-argument
 * form Next 16 asks for; node_modules/next/dist/docs/01-app/03-api-reference/
 * 04-functions/revalidateTag.md).
 *
 * Next refuses a revalidation during a render (error E7: a page that writes
 * while it renders, such as /odeme/basarili settling a payment). Those tags
 * go to `after()` instead, which runs once the response is out and flushes
 * what it revalidated. Outside a request (a script, a plain test) there is
 * nothing to expire and this does nothing. It never throws: a write that
 * succeeded must not fail over its cache.
 */
export function expireTags(tags: readonly string[]): void {
  const later: string[] = [];
  for (const tag of tags) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch {
      later.push(tag);
    }
  }
  if (later.length === 0) return;
  try {
    after(() => {
      for (const tag of later) {
        try {
          revalidateTag(tag, { expire: 0 });
        } catch (err) {
          note(tag, err);
        }
      }
    });
  } catch (err) {
    for (const tag of later) note(tag, err);
  }
}
