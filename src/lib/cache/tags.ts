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
 * Eight tags:
 * - `pub:catalog`: products and categories (the shop, its link cards and
 *   the sitemap).
 * - `pub:menu`: menu items (the cafe menu, also the table's QR menu). Apart
 *   from the shop so a shop stock move does not drop the menu.
 * - `pub:site`: settings and every panel-edited text, slide and legal
 *   override the public pages print.
 * - `live:venue`: the venue's live status (Canlı durum, the top bar's köşk
 *   chip). Only the panel caches it: the chip's marker and the bell's busy
 *   window. Apart from `pub:site` so a chip tap does not empty every public
 *   page's cache (docs/AUDIT.md §8, P2).
 * - `live:orders`: orders (the new-order bell and the panel's counts).
 * - `live:karaoke`: karaoke bookings (the nav badge).
 * - `live:invoices`: e-Arşiv invoices (the Faturalar nav badge). Nothing
 *   else caches them; the runner's writes are few.
 * - `live:access`: panel accounts. Nothing cached reads them; every change
 *   marker carries the tag, so a user deactivated, demoted or given a new
 *   password moves every marker and each open panel tab's next poll
 *   re-reads its account (rule 30).
 *
 * Every table and every SQL function is listed here on purpose, tagged or
 * not, and tests/cache-write-tags.test.ts fails on one that is not: a new
 * table cannot be cached silently stale. A function missing from the map
 * expires every tag, because expiring too much only costs a read. A
 * function's tags are those of the tables its body writes, and of the
 * functions it calls; the same test reads db/schema.sql and fails on a
 * function tagged with less (stale data) or more (a wake for nothing).
 */

export const TAG_CATALOG = "pub:catalog";
export const TAG_MENU = "pub:menu";
export const TAG_SITE = "pub:site";
export const TAG_VENUE = "live:venue";
export const TAG_ORDERS = "live:orders";
export const TAG_KARAOKE = "live:karaoke";
export const TAG_INVOICES = "live:invoices";
export const TAG_ACCESS = "live:access";

export const ALL_CACHE_TAGS = [
  TAG_CATALOG,
  TAG_MENU,
  TAG_SITE,
  TAG_VENUE,
  TAG_ORDERS,
  TAG_KARAOKE,
  TAG_INVOICES,
  TAG_ACCESS,
] as const;

export type CacheTag = (typeof ALL_CACHE_TAGS)[number];

type TableName = (typeof TABLES)[keyof typeof TABLES];

const NONE: readonly CacheTag[] = [];
const CATALOG: readonly CacheTag[] = [TAG_CATALOG];
const MENU: readonly CacheTag[] = [TAG_MENU];
const SITE: readonly CacheTag[] = [TAG_SITE];
const ORDERS: readonly CacheTag[] = [TAG_ORDERS];
const KARAOKE: readonly CacheTag[] = [TAG_KARAOKE];
/** Stock moves with an order: the shop's stock and the order both change. */
const STOCK_AND_ORDERS: readonly CacheTag[] = [TAG_CATALOG, TAG_ORDERS];

/** Every table in `TABLES`, with the tags a write to it expires. */
export const TABLE_TAGS: Record<TableName, readonly CacheTag[]> = {
  products: CATALOG,
  categories: CATALOG,
  menu_items: MENU,
  // "Satışta / Tükendi" per branch (20261121150719): the site's menu, the
  // app's /menu and the table's QR menu show the Tuzla row, and a write
  // pings the panel (`menu.changed`) and moves LafPOS's menu marker like an
  // item's own.
  menu_item_availability: MENU,

  settings: SITE,
  site_content: SITE,
  press: SITE,
  story_timeline: SITE,
  shop_hero_slides: SITE,
  // Panel-managed site photographs (Görseller, 22 Kas 2026).
  site_images: SITE,
  home_hero_slides: SITE,
  app_posts: SITE,
  app_hero_slides: SITE,
  app_announcements: SITE,
  legal_docs: SITE,
  venue_status: [TAG_VENUE],

  orders: ORDERS,
  // "Garson çağır" (20261106120000): a call rings the order alert and shows
  // on the köşk panel's bar screen with the orders, so a write moves the
  // alert's change marker and pings the panel (`orders.changed`) like an
  // order's.
  table_calls: ORDERS,
  karaoke_reservations: KARAOKE,
  // Who may still read the panel: the change markers (change-marker.ts).
  admin_users: [TAG_ACCESS],
  // Who is in the panel now (20261023090000): written once a minute per
  // signed-in address, read live by Kullanıcılar only. Never TAG_ACCESS:
  // every write would expire the badges' markers for nothing.
  admin_activity: NONE,

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
  // Every legal text shown, by hash (20261020180000): read live by the
  // ?surum= page and the durable copy, never cached; a text that changes
  // writes a new row, and the pages it is shown on expire with legal_docs.
  legal_doc_versions: NONE,
  admin_2fa: NONE,
  auth_attempts: NONE,
  loyalty_stamps: NONE,
  invites: NONE,
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
  // The daily Supabase ping's last result; read live by the owner's
  // dashboard, never cached.
  supabase_keepalive: NONE,
  // Phone notification tokens and the "once" of each order push
  // (20261022170000): read live by the sender, never cached.
  customer_devices: NONE,
  order_push_notices: NONE,
  // The İYS outbox and its state (20261022180000_iys_consent_sync.sql):
  // read live by /admin/iys, the dashboard and the send gate, never cached.
  iys_recipients: NONE,
  iys_events: NONE,
  iys_state: NONE,
  // e-Arşiv invoices (src/lib/invoice/, docs/EARSIV.md): read live by the
  // panel's Faturalar page, the order and booking pages and the member's
  // order page; only the Faturalar nav badge's marker sits under their tag.
  // The Paraşüt token, product ids and contact cache are read by the
  // invoice runner only. Nothing caches them.
  invoices: [TAG_INVOICES],
  invoice_state: NONE,
  invoice_contacts: NONE,
  // Closed accounts' saved cards still at the POS (20261119175128): read
  // by the daily purge only, never cached.
  card_vault_purges: NONE,
};

/**
 * Every function in db/schema.sql, with the tags a call expires. Trigger
 * functions and read-only helpers are listed too, so the test can tell a
 * function nobody classified from one that writes nothing cached.
 */
export const RPC_TAGS: Record<string, readonly CacheTag[]> = {
  // Stock: they write `products` only.
  claim_order_stock: CATALOG,
  release_order_stock: CATALOG,
  adjust_product_stock: CATALOG,
  adjust_variant_stock: CATALOG,
  credit_product_stock: CATALOG,
  save_product_variants: CATALOG,
  // Stock given back with the order's own row.
  restock_order_lines: STOCK_AND_ORDERS,
  release_order_inventory: STOCK_AND_ORDERS,
  // The order row only: refunds, line status, a wallet order (a cafe
  // order holds no stock; a shop line's claim is its own rpc).
  set_order_item_status: ORDERS,
  reserve_order_refund: ORDERS,
  reserve_order_refund_once: ORDERS,
  drop_order_refund: ORDERS,
  wallet_place_order: ORDERS,
  // The stock_moves ledger: read live by the panel, never cached.
  record_stock_move: NONE,

  // Karaoke bookings only: an hour sold again charged to the booking that
  // cancelled it late, and the köşk's late cancel made good (the free hour
  // given, or let go). 20261020203619_karaoke_make_good.sql.
  karaoke_charge_resold_hours: KARAOKE,
  karaoke_give_make_good_hour: KARAOKE,
  karaoke_release_make_good_hour: KARAOKE,

  // Legal overrides the /hukuk pages print.
  legal_doc_save: SITE,
  legal_doc_reset: SITE,

  // The periodic destruction of karaoke bookings (src/lib/retention.ts):
  // they clear or delete karaoke_reservations rows. Called daily, also to
  // count only; one extra read of the nav badge's marker at most.
  karaoke_guest_retention: [TAG_KARAOKE],
  karaoke_reservation_retention: [TAG_KARAOKE],

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
  // e-Arşiv: the claim of due invoices writes invoices (the Faturalar
  // badge's marker); the Paraşüt token lease writes invoice_state, which
  // nothing caches.
  invoice_claim: [TAG_INVOICES],
  invoice_state_lease: NONE,
  customer_consents_retention: NONE,
  // Writes customer_devices only (20261022170000).
  register_customer_device: NONE,
  // Deletes only legal_doc_versions rows past their eleven years.
  legal_doc_versions_retention: NONE,
  // The İYS outbox: they write iys_* only, which nothing caches.
  iys_reconcile: NONE,
  iys_record_check: NONE,
  iys_settle_export: NONE,
  iys_apply_list: NONE,
  iys_export_events: NONE,
  iys_retention: NONE,

  // Read-only helpers.
  admin_customer_counts: NONE,
  admin_customer_page: NONE,
  admin_customer_rows: NONE,
  admin_fold_tr: NONE,
  admin_sort_tr: NONE,
  iys_add_business_days: NONE,
  variant_stock_total: NONE,
  product_variant_list: NONE,

  // Trigger functions: they run inside a write the table already names.
  app_pending_order_cap: NONE,
  audit_logs_append_only: NONE,
  karaoke_open_cap: NONE,
  counter_token_issue_cap: NONE,
  customer_consents_append_only: NONE,
  legal_override_history_append_only: NONE,
  legal_doc_versions_append_only: NONE,
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
 * The second expiry's profile: the same immediate expiry as `{ expire: 0 }`
 * (Next passes only `expire` on to the cache: revalidation-utils.js
 * `revalidateTags`), but a different profile, so Next sends it as a batch
 * of its own instead of folding it into the first (it tells revalidations
 * apart by tag and profile: `diffRevalidationState`).
 * tests/cache-expire-retry.test.ts runs that against Next's own code.
 */
export const SECOND_EXPIRY = { stale: 0, expire: 0 };

/**
 * Expires `tags` at once: the next read of anything tagged with one waits
 * for fresh data, nothing stale is served (`{ expire: 0 }`, the two-argument
 * form Next 16 asks for; node_modules/next/dist/docs/01-app/03-api-reference/
 * 04-functions/revalidateTag.md).
 *
 * Then once more, from `after()`, which runs once the response is out
 * (`SECOND_EXPIRY`). Next only queues a revalidation and sends the queue
 * when the request ends, and a route handler sends it only when the handler
 * returns a Response or redirects: one that throws (or calls notFound())
 * after a write never sends it (app-route/module.js `do`), and one that
 * returns sends it after the response, where a cache error is not seen by
 * anyone. `after()` runs in both cases (its docs: "even if the response
 * didn't complete successfully"), so a write that marked an order paid
 * still moves the bell's marker. During a render Next refuses the first
 * call (error E7: a page that writes while it renders, such as
 * /odeme/basarili settling a payment) and the second is the only one.
 * Outside a request (a script, a plain test) there is nothing to expire and
 * this does nothing. It never throws: a write that succeeded must not fail
 * over its cache.
 */
export function expireTags(tags: readonly string[]): void {
  if (tags.length === 0) return;
  const refused: string[] = [];
  for (const tag of tags) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch {
      refused.push(tag);
    }
  }
  const again = [...tags];
  try {
    after(() => {
      for (const tag of again) {
        try {
          revalidateTag(tag, SECOND_EXPIRY);
        } catch (err) {
          note(tag, err);
        }
      }
    });
  } catch (err) {
    for (const tag of refused) note(tag, err);
  }
}
