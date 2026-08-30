-- GENERATED FILE — do not edit by hand.
-- Regenerate with: npm run db:bundle
--
-- Every migration in db/migrations, concatenated in order. Apply this in a
-- SQL console when the machine running `npm run db:migrate` cannot reach the
-- database. Running it twice is safe, and `db:migrate` will skip anything
-- recorded here.

create table if not exists public._migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────
-- 20260601120000_initial_schema.sql
-- ─────────────────────────────────────────────────────────────────────
-- L'Affogato — initial Postgres schema.
--
-- Mirrors the former MongoDB document model 1:1: camelCase quoted columns,
-- JSONB for nested arrays/objects, ISO-8601 text timestamps (so existing
-- string ordering / `new Date(...)` parsing keeps working unchanged).
--
-- All access is server-side through a single owner connection. RLS is enabled
-- on every table with no policies as defence in depth; the owner role bypasses
-- it, so the app is unaffected.

-- ── counters (atomic sequence generator) ──────────────────────────────────
create table if not exists public.counters (
  id  text primary key,
  seq bigint not null default 0
);

create or replace function public.next_seq(counter_key text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v bigint;
begin
  insert into public.counters (id, seq) values (counter_key, 1)
  on conflict (id) do update set seq = public.counters.seq + 1
  returning seq into v;
  return v;
end;
$$;

-- ── products ──────────────────────────────────────────────────────────────
create table if not exists public.products (
  id                    text primary key,
  name                  text    not null default '',
  slug                  text    not null,
  sku                   text    not null default '',
  tag                   text    not null default '',
  "priceMinor"          integer not null default 0,
  "compareAtPriceMinor" integer not null default 0,
  "costMinor"           integer not null default 0,
  "desc"                text    not null default '',
  cat                   text    not null default 'beans',
  img                   text    not null default '',
  images                jsonb   not null default '[]'::jsonb,
  stock                 integer not null default 0,
  "lowStockThreshold"   integer not null default 0,
  "weightGrams"         integer not null default 0,
  featured              boolean not null default false,
  "isNew"               boolean not null default false,
  "isActive"            boolean not null default true,
  "seoTitle"            text    not null default '',
  "seoDescription"      text    not null default '',
  variants              jsonb   not null default '[]'::jsonb,
  "updatedAt"           text    not null default ''
);
create unique index if not exists products_slug_key on public.products (slug);
create index if not exists products_cat_idx on public.products (cat);
create index if not exists products_active_idx on public.products ("isActive");

-- ── categories ────────────────────────────────────────────────────────────
create table if not exists public.categories (
  id          text primary key,
  slug        text    not null,
  label       text    not null default '',
  icon        text    not null default '',
  "sortOrder" integer not null default 0
);

-- ── menu_items ────────────────────────────────────────────────────────────
create table if not exists public.menu_items (
  id            text primary key,
  "categoryKey" text    not null,
  name          text    not null default '',
  "desc"        text    not null default '',
  "priceMinor"  integer not null default 0,
  hue           text    not null default '',
  tags          jsonb   not null default '[]'::jsonb,
  "isActive"    boolean not null default true,
  "sortOrder"   integer not null default 0,
  "updatedAt"   text    not null default ''
);
create index if not exists menu_items_cat_idx on public.menu_items ("categoryKey");

-- ── orders ────────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id                text primary key,
  "orderNo"         integer not null,
  "customerName"    text    not null default '',
  "customerEmail"   text    not null default '',
  "customerPhone"   text    not null default '',
  "shippingAddress" text    not null default '',
  "internalNote"    text    not null default '',
  status            text    not null default 'pending_payment',
  items             jsonb   not null default '[]'::jsonb,
  "subtotalMinor"   integer not null default 0,
  "discountMinor"   integer not null default 0,
  "promoCode"       text    not null default '',
  "shippingMinor"   integer not null default 0,
  "totalMinor"      integer not null default 0,
  refunds           jsonb   not null default '[]'::jsonb,
  "createdAt"       text    not null default ''
);
create unique index if not exists orders_orderno_key on public.orders ("orderNo");
create index if not exists orders_email_idx on public.orders (lower("customerEmail"));
create index if not exists orders_status_idx on public.orders (status);

-- ── stock_moves ───────────────────────────────────────────────────────────
create table if not exists public.stock_moves (
  id            text primary key,
  "productId"   text    not null,
  "productName" text    not null default '',
  delta         integer not null default 0,
  "stockAfter"  integer not null default 0,
  reason        text    not null default 'manual_adjust',
  note          text    not null default '',
  "orderId"     text,
  actor         text    not null default 'system',
  "createdAt"   text    not null default ''
);
create index if not exists stock_moves_product_idx on public.stock_moves ("productId");
create index if not exists stock_moves_reason_idx on public.stock_moves (reason);
create index if not exists stock_moves_created_idx on public.stock_moves ("createdAt" desc);

-- ── promos ────────────────────────────────────────────────────────────────
create table if not exists public.promos (
  id                 text primary key,
  code               text    not null,
  kind               text    not null default 'pct',
  value              integer not null default 0,
  "minSubtotalMinor" integer not null default 0,
  "usageLimit"       integer not null default 0,
  "usageCount"       integer not null default 0,
  "expiresAt"        text    not null default '',
  "isActive"         boolean not null default true,
  "createdAt"        text    not null default '',
  "updatedAt"        text    not null default ''
);
create unique index if not exists promos_code_key on public.promos (code);

-- ── settings (singleton, id = 'main') ─────────────────────────────────────
create table if not exists public.settings (
  id                           text primary key default 'main',
  name                         text    not null default '',
  tagline                      text    not null default '',
  phone                        text    not null default '',
  email                        text    not null default '',
  address                      text    not null default '',
  "openingHours"               text    not null default '',
  "isShopOpen"                 boolean not null default true,
  "heroImageUrl"               text    not null default '',
  "weeklyHours"                jsonb   not null default '{}'::jsonb,
  "taxRatePct"                 integer not null default 0,
  "shippingFlatMinor"          integer not null default 0,
  "shippingFreeThresholdMinor" integer not null default 0,
  "seoTitle"                   text    not null default '',
  "seoOgImageUrl"              text    not null default '',
  "seoIndexable"               boolean not null default true,
  "notificationEmail"          text    not null default ''
);

-- ── audit_logs ────────────────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id          text primary key,
  actor       text  not null default '',
  action      text  not null,
  entity      text  not null,
  "entityId"  text  not null default '',
  payload     jsonb not null default '{}'::jsonb,
  "createdAt" text  not null default ''
);
create index if not exists audit_logs_created_idx on public.audit_logs ("createdAt" desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity);
create index if not exists audit_logs_action_idx on public.audit_logs (action);

-- ── customers ─────────────────────────────────────────────────────────────
create table if not exists public.customers (
  id                  text primary key,
  email               text  not null,
  name                text  not null default '',
  phone               text  not null default '',
  "passwordHash"      text  not null default '',
  birthday            text  not null default '',
  addresses           jsonb not null default '[]'::jsonb,
  wishlist            jsonb not null default '[]'::jsonb,
  "notificationPrefs" jsonb not null default '{}'::jsonb,
  "createdAt"         text  not null default '',
  "updatedAt"         text  not null default ''
);
create unique index if not exists customers_email_key on public.customers (lower(email));

-- ── shop_hero_slides ──────────────────────────────────────────────────────
create table if not exists public.shop_hero_slides (
  id          text primary key,
  title       text    not null default '',
  subtitle    text    not null default '',
  "imageUrl"  text    not null default '',
  "ctaLabel"  text    not null default '',
  "ctaHref"   text    not null default '',
  "textTheme" text    not null default 'light',
  "sortOrder" integer not null default 0,
  "isActive"  boolean not null default true,
  "createdAt" text    not null default '',
  "updatedAt" text    not null default ''
);
create index if not exists shop_hero_slides_order_idx on public.shop_hero_slides ("sortOrder");

-- ── payment_transactions (idempotent webhook log) ─────────────────────────
create table if not exists public.payment_transactions (
  id            bigint generated always as identity primary key,
  "orderId"     text    not null,
  provider      text    not null,
  "providerRef" text    not null,
  status        text    not null,
  "amountMinor" integer not null default 0,
  currency      text    not null default 'TRY',
  raw           jsonb,
  "createdAt"   text    not null default ''
);
create unique index if not exists payment_txn_provider_ref_key
  on public.payment_transactions (provider, "providerRef");

-- ── RLS: enabled everywhere, no public policies (service role bypasses) ────
alter table public.counters             enable row level security;
alter table public.products             enable row level security;
alter table public.categories           enable row level security;
alter table public.menu_items           enable row level security;
alter table public.orders               enable row level security;
alter table public.stock_moves          enable row level security;
alter table public.promos               enable row level security;
alter table public.settings             enable row level security;
alter table public.audit_logs           enable row level security;
alter table public.customers            enable row level security;
alter table public.shop_hero_slides     enable row level security;
alter table public.payment_transactions enable row level security;

insert into public._migrations (name) values ('20260601120000_initial_schema.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260601130000_atomic_stock_and_promo.sql
-- ─────────────────────────────────────────────────────────────────────
-- Atomic helpers that the data layer needs but a single-row read-modify-write
-- can't provide safely under concurrency.

-- ── claim_order_stock ─────────────────────────────────────────────────────
-- Atomically check + decrement stock for an ENTIRE cart in one transaction.
-- Each line is `{ "productId": text, "variantId": text|null, "qty": int }`.
-- Product stock (and the chosen variant's JSONB stock) is decremented under a
-- row lock; if ANY line can't be satisfied the whole function raises and rolls
-- back every line — no overselling, all-or-nothing. Returns the post-decrement
-- product stock per line (same order as input) for stock-movement logging.
create or replace function public.claim_order_stock(p_lines jsonb, p_now text)
returns int[]
language plpgsql
set search_path = ''
as $$
declare
  line      jsonb;
  qty       int;
  new_stock int;
  result    int[] := '{}';
begin
  for line in select value from jsonb_array_elements(p_lines)
  loop
    qty := (line->>'qty')::int;

    if (line->>'variantId') is not null and (line->>'variantId') <> '' then
      update public.products
        set stock = stock - qty,
            "updatedAt" = p_now,
            variants = (
              select jsonb_agg(
                case when v->>'id' = line->>'variantId'
                  then jsonb_set(v, '{stock}', to_jsonb(greatest(0, (v->>'stock')::int - qty)))
                  else v end)
              from jsonb_array_elements(variants) v)
        where id = line->>'productId'
          and stock >= qty
          and coalesce((
            select (v->>'stock')::int
            from jsonb_array_elements(variants) v
            where v->>'id' = line->>'variantId'
          ), 0) >= qty
        returning stock into new_stock;
    else
      update public.products
        set stock = stock - qty,
            "updatedAt" = p_now
        where id = line->>'productId' and stock >= qty
        returning stock into new_stock;
    end if;

    if not found then
      raise exception 'INSUFFICIENT_STOCK:%', coalesce(line->>'productId', '');
    end if;

    result := array_append(result, new_stock);
  end loop;

  return result;
end;
$$;

-- ── increment_promo_usage ─────────────────────────────────────────────────
-- Atomic usageCount increment (replaces a non-atomic read-modify-write that
-- could lose concurrent updates).
create or replace function public.increment_promo_usage(promo_code text, p_now text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.promos
    set "usageCount" = "usageCount" + 1,
        "updatedAt" = p_now
    where code = promo_code;
end;
$$;

insert into public._migrations (name) values ('20260601130000_atomic_stock_and_promo.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260602120000_content_tables.sql
-- ─────────────────────────────────────────────────────────────────────
-- ── Editorial content tables (admin-managed) ──────────────────────────────
-- Reels, Press, Story timeline, Franchise packages + process. Mirrors the
-- shop_hero_slides convention: text PK, quoted camelCase columns, RLS on
-- (service role bypasses). Seeded from code on first read when empty.

-- ── reels ──────────────────────────────────────────────────────────────────
create table if not exists public.reels (
  id          text primary key,
  caption     text    not null default '',
  meta        text    not null default '',
  accent      text    not null default 'caramel',
  "videoUrl"  text    not null default '',
  "sortOrder" integer not null default 0,
  "isActive"  boolean not null default true,
  "createdAt" text    not null default '',
  "updatedAt" text    not null default ''
);
create index if not exists reels_order_idx on public.reels ("sortOrder");

-- ── press ────────────────────────────────────────────────────────────────--
create table if not exists public.press (
  id          text primary key,
  name        text    not null default '',
  quote       text    not null default '',
  "sortOrder" integer not null default 0,
  "isActive"  boolean not null default true,
  "createdAt" text    not null default '',
  "updatedAt" text    not null default ''
);
create index if not exists press_order_idx on public.press ("sortOrder");

-- ── story_timeline ──────────────────────────────────────────────────────--
create table if not exists public.story_timeline (
  id          text primary key,
  year        text    not null default '',
  title       text    not null default '',
  body        text    not null default '',
  "sortOrder" integer not null default 0,
  "isActive"  boolean not null default true,
  "createdAt" text    not null default '',
  "updatedAt" text    not null default ''
);
create index if not exists story_timeline_order_idx on public.story_timeline ("sortOrder");

-- ── franchise_packages ────────────────────────────────────────────────────
create table if not exists public.franchise_packages (
  id          text primary key,
  name        text    not null default '',
  area        text    not null default '',
  seats       text    not null default '',
  invest      text    not null default '',
  monthly     text    not null default '',
  ideal       text    not null default '',
  includes    jsonb   not null default '[]'::jsonb,
  featured    boolean not null default false,
  "sortOrder" integer not null default 0,
  "isActive"  boolean not null default true,
  "createdAt" text    not null default '',
  "updatedAt" text    not null default ''
);
create index if not exists franchise_packages_order_idx on public.franchise_packages ("sortOrder");

-- ── franchise_process ──────────────────────────────────────────────────────
create table if not exists public.franchise_process (
  id          text primary key,
  step        text    not null default '',
  title       text    not null default '',
  body        text    not null default '',
  "sortOrder" integer not null default 0,
  "isActive"  boolean not null default true,
  "createdAt" text    not null default '',
  "updatedAt" text    not null default ''
);
create index if not exists franchise_process_order_idx on public.franchise_process ("sortOrder");

-- ── RLS: enabled, no public policies (service role bypasses) ────────────────
alter table public.reels              enable row level security;
alter table public.press              enable row level security;
alter table public.story_timeline     enable row level security;
alter table public.franchise_packages enable row level security;
alter table public.franchise_process  enable row level security;

insert into public._migrations (name) values ('20260602120000_content_tables.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260603120000_site_content.sql
-- ─────────────────────────────────────────────────────────────────────
-- ── site_content (admin-managed editorial copy) ────────────────────────────
-- Simple key → value store for editable marketing/section text (hero,
-- founder bio, franchise pitch & stats, …). Defaults live in code; only
-- overridden keys are persisted here. RLS on (service role bypasses).
create table if not exists public.site_content (
  key         text primary key,
  value       text not null default '',
  "updatedAt" text not null default ''
);
alter table public.site_content enable row level security;

insert into public._migrations (name) values ('20260603120000_site_content.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260604120000_customer_email_verification.sql
-- ─────────────────────────────────────────────────────────────────────
-- ── Customer e-mail verification ───────────────────────────────────────────
-- Customers must confirm their e-mail before they can place an order.
alter table public.customers
  add column if not exists "emailVerified" boolean not null default false,
  add column if not exists "verifyToken"   text    not null default '',
  add column if not exists "verifyExpires" text    not null default '',
  add column if not exists "verifiedAt"    text    not null default '';

create index if not exists customers_verify_token_idx
  on public.customers ("verifyToken");

insert into public._migrations (name) values ('20260604120000_customer_email_verification.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260619120000_order_tracking.sql
-- ─────────────────────────────────────────────────────────────────────
-- Order fulfillment tracking: carrier name, tracking number, and shipped
-- timestamp so the shop owner can record a shipment and the customer can see it.
alter table public.orders add column if not exists "trackingNumber" text not null default '';
alter table public.orders add column if not exists "carrier"        text not null default '';
alter table public.orders add column if not exists "shippedAt"      text not null default '';

insert into public._migrations (name) values ('20260619120000_order_tracking.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260619130000_customer_active.sql
-- ─────────────────────────────────────────────────────────────────────
-- Customer account activation flag: admins can deactivate a member account so
-- it can no longer sign in or place orders, without deleting their data. Existing
-- rows default to active.
alter table public.customers
  add column if not exists "isActive" boolean not null default true;

create index if not exists customers_active_idx on public.customers ("isActive");

insert into public._migrations (name) values ('20260619130000_customer_active.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260619140000_backend_completion.sql
-- ─────────────────────────────────────────────────────────────────────
-- Backend completion: newsletter subscribers, franchise applications, customer
-- consent timestamps, and admin-editable legal documents. All tables RLS-on /
-- deny-all (service-role only), mirroring the rest of the schema.

-- ── Newsletter subscribers (anonymous footer signup + opt-ins) ──────────────
create table if not exists public.newsletter_subscribers (
  id               text    primary key,
  email            text    not null,
  name             text    not null default '',
  -- Where the subscription came from: footer | register | account.
  source           text    not null default 'footer',
  "isActive"       boolean not null default true,
  "createdAt"      text    not null default '',
  "unsubscribedAt" text    not null default ''
);
create unique index if not exists newsletter_subscribers_email_key
  on public.newsletter_subscribers (lower(email));
alter table public.newsletter_subscribers enable row level security;

-- ── Franchise applications (lead capture from the franchise page form) ──────
create table if not exists public.franchise_applications (
  id           text primary key,
  name         text not null default '',
  email        text not null default '',
  phone        text not null default '',
  city         text not null default '',
  experience   text not null default '',
  budget       text not null default '',
  package      text not null default '',
  message      text not null default '',
  -- Pipeline: new | contacted | qualified | rejected | closed.
  status       text not null default 'new',
  "createdAt"  text not null default ''
);
create index if not exists franchise_applications_created_idx
  on public.franchise_applications ("createdAt");
alter table public.franchise_applications enable row level security;

-- ── Customer consent timestamps (KVKK terms + marketing opt-in) ─────────────
alter table public.customers
  add column if not exists "termsAcceptedAt"    text not null default '',
  add column if not exists "marketingConsentAt" text not null default '';

-- ── Admin-editable legal documents (override the code defaults per slug) ────
-- When a row is published with a bodyMarkdown, the public /hukuk/<slug> page
-- renders the override; otherwise it falls back to the rich coded default.
create table if not exists public.legal_docs (
  slug            text    primary key,
  title           text    not null default '',
  summary         text    not null default '',
  "effectiveDate" text    not null default '',
  "bodyMarkdown"  text    not null default '',
  "isPublished"   boolean not null default false,
  "updatedAt"     text    not null default ''
);
alter table public.legal_docs enable row level security;

insert into public._migrations (name) values ('20260619140000_backend_completion.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260620120000_customer_coupons.sql
-- ─────────────────────────────────────────────────────────────────────
-- ── customer_coupons ──────────────────────────────────────────────────────
-- Per-customer, single-use coupons. Distinct from the global `promos` table:
-- every coupon is OWNED by exactly one member (by normalized e-mail) and can be
-- redeemed at most once. Auto-granted (welcome on e-mail verification, birthday)
-- or hand-granted by an admin. Same conventions as the rest of the schema:
-- camelCase-quoted columns, ISO-8601 text dates (empty = none), integer minor
-- units (kuruş). Redemption is a single guarded UPDATE (see redeemCustomerCoupon)
-- so single-use holds under concurrency.
create table if not exists public.customer_coupons (
  id                 text    primary key,
  "customerEmail"    text    not null,
  code               text    not null,
  title              text    not null default '',
  kind               text    not null default 'pct',   -- 'pct' | 'fixed'
  value              integer not null default 0,        -- % (1-100) or minor units
  "minSubtotalMinor" integer not null default 0,
  source             text    not null default 'manual', -- welcome|birthday|loyalty|manual|review
  "expiresAt"        text    not null default '',        -- ISO-8601, '' = never
  "redeemedAt"       text    not null default '',        -- ISO-8601, '' = unused
  "redeemedOrderNo"  integer not null default 0,
  "isActive"         boolean not null default true,
  "createdAt"        text    not null default '',
  "updatedAt"        text    not null default ''
);

-- Coupon codes are globally unique (they share the checkout code input with
-- promos; a personal coupon is tried first, then a global promo).
create unique index if not exists customer_coupons_code_key
  on public.customer_coupons (code);

-- Fast per-member lookup (account page + admin detail + auto-grant idempotency).
create index if not exists customer_coupons_customer_idx
  on public.customer_coupons (lower("customerEmail"));

-- RLS on, no policies → anon/authenticated denied; only the service-role client
-- (server-only data layer) can read/write, exactly like every other table.
alter table public.customer_coupons enable row level security;

insert into public._migrations (name) values ('20260620120000_customer_coupons.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260826120000_drop_franchise_tables.sql
-- ─────────────────────────────────────────────────────────────────────
-- Drop the franchise tables.
--
-- The franchise page and its admin screens were removed from the app; nothing
-- in src/ references these tables any more, so they are schema for a feature
-- that no longer exists. Dropping them keeps the database honest about what
-- the product actually is.
--
-- `if exists` so the migration is safe on a database created after this point,
-- and `cascade` to take the indexes and constraints with them.

drop table if exists public.franchise_applications cascade;
drop table if exists public.franchise_process cascade;
drop table if exists public.franchise_packages cascade;

insert into public._migrations (name) values ('20260826120000_drop_franchise_tables.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260826180000_drop_reels_table.sql
-- ─────────────────────────────────────────────────────────────────────
-- Drop the reels table.
--
-- The Reels section (customer page, home teaser, admin management) was
-- removed from the app; nothing in src/ references this table any more, so
-- it is schema for a feature that no longer exists.
--
-- `if exists` so the migration is safe on a database created after this
-- point, and `cascade` to take the index and RLS policy with it.

drop table if exists public.reels cascade;

insert into public._migrations (name) values ('20260826180000_drop_reels_table.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260827124000_menu_two_sizes_and_photos.sql
-- ─────────────────────────────────────────────────────────────────────
-- Cafe menu: two-size (M/L) pricing, real product photos, and a full reset.
--
-- The 2026 printed menu replaces the previous seed wholesale: the category
-- keys changed (affogato/matcha/espresso/cold/gelato → matcha/espresso/
-- ice-coffee/cold/hot/frappe/smoothie/frozen/ice-tea/dessert/snack/extras)
-- and most drinks are now sold in two sizes.
--
-- `priceMinorL` is the large-size price in kuruş; 0 means the item has a
-- single size, which keeps the column back-compatible with existing rows.
-- `image` is a site-relative path under public/ (e.g. /menu/matcha-latte.webp);
-- empty means the drawn SVG fallback is used.

alter table public.menu_items
  add column if not exists "priceMinorL" integer not null default 0;

alter table public.menu_items
  add column if not exists image text not null default '';

-- Clear the old menu. Those rows carry the retired category keys and prices, so
-- they cannot be migrated in place; ensureSeed() re-seeds the table from
-- SEED_MENU on the next boot because the table is left empty.
--
-- Guarded on this migration's own _migrations row, which db:migrate and the
-- db/schema.sql bundle both insert *after* the body runs. So the delete fires
-- exactly once — on the run that first applies this file — and matches nothing
-- on every re-apply. That matters because db/schema.sql promises running it
-- twice is safe and the app re-applies it to heal a schema gap; an
-- unconditional delete would wipe the live menu each time.
--
-- Filtering by category key cannot do this: matcha, espresso and cold appear in
-- both the old and the new key sets, so the old items under them would survive
-- and leave the table non-empty — which suppresses the re-seed entirely and
-- strands the menu half-migrated.
delete from public.menu_items
where not exists (
  select 1
  from public._migrations
  where name = '20260827124000_menu_two_sizes_and_photos.sql'
);

insert into public._migrations (name) values ('20260827124000_menu_two_sizes_and_photos.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260828120000_mobile_app_content.sql
-- ─────────────────────────────────────────────────────────────────────
-- Mobile app home content, owned by the admin panel at /admin/mobil.
--
-- The mobile app's home screen shows a hero carousel and an announcements
-- strip. Both are editorial and change on a human timescale, so they belong in
-- the panel rather than in a release: swapping a seasonal slide must not need
-- an app store submission.
--
-- These tables are deliberately separate from `shop_hero_slides`. That table
-- drives the website's shop header and carries web-shaped fields (a full-width
-- imageUrl, an absolute ctaHref). The app needs a brand `tone` instead of an
-- image, and a route key the app resolves through an allow-list rather than an
-- arbitrary URL — a CMS-authored URL cannot be allowed to drive native
-- navigation.
--
-- NOTE: no `insert into public._migrations` line here. scripts/db-migrate.mjs
-- performs that insert itself, with no `on conflict`, inside the same
-- transaction — a duplicate from this file would roll the whole migration back.

create table if not exists public.app_hero_slides (
  id           text    primary key,
  eyebrow      text    not null default '',
  title        text    not null default '',
  body         text    not null default '',
  "ctaLabel"   text    not null default '',
  -- Route KEY, not a URL. The app maps it through an allow-list; an unknown
  -- value is a no-op rather than a crash.
  "ctaRoute"   text    not null default '',
  -- 'premium' | 'inverse' | 'brand' | 'paper' — see docs/THEME.md.
  tone         text    not null default 'paper',
  image        text    not null default '',
  "sortOrder"  integer not null default 0,
  "isActive"   boolean not null default true,
  -- ISO-8601; empty string means unbounded, matching the house convention.
  "startsAt"   text    not null default '',
  "endsAt"     text    not null default '',
  "createdAt"  text    not null default '',
  "updatedAt"  text    not null default ''
);

create index if not exists app_hero_slides_active_idx
  on public.app_hero_slides ("isActive", "sortOrder");

create table if not exists public.app_announcements (
  id           text    primary key,
  -- 'info' | 'campaign' | 'hours'
  kind         text    not null default 'info',
  title        text    not null default '',
  body         text    not null default '',
  "sortOrder"  integer not null default 0,
  "isActive"   boolean not null default true,
  "startsAt"   text    not null default '',
  "endsAt"     text    not null default '',
  "createdAt"  text    not null default '',
  "updatedAt"  text    not null default ''
);

create index if not exists app_announcements_active_idx
  on public.app_announcements ("isActive", "sortOrder");

alter table public.app_hero_slides  enable row level security;
alter table public.app_announcements enable row level security;

insert into public._migrations (name) values ('20260828120000_mobile_app_content.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260901120000_order_legal_consent.sql
-- ─────────────────────────────────────────────────────────────────────
-- ── orders."legalConsent" ─────────────────────────────────────────────────
-- Distance-selling consent evidence.
--
-- Mesafeli Sözleşmeler Yönetmeliği requires the seller to prove the consumer
-- was presented with — and confirmed — the Ön Bilgilendirme Formu and the
-- Mesafeli Satış Sözleşmesi *before* the order was placed, and to keep that
-- confirmation on a durable medium. Acquiring banks and payment institutions
-- ask for the same record during a virtual-POS (sanal POS) review and when a
-- chargeback is disputed.
--
-- Shape (JSONB, same nested-document convention as `items` / `refunds`):
--   {
--     "acceptedAt": "2026-09-01T10:15:00.000Z",   -- ISO-8601
--     "documents":  ["on-bilgilendirme-formu", "mesafeli-satis-sozlesmesi"],
--     "version":    "1 Eylül 2026",               -- doc revision shown
--     "ip":         "203.0.113.7",                -- proof of origin
--     "userAgent":  "Mozilla/5.0 …"
--   }
--
-- '{}' = legacy order placed before this column existed (no consent captured).
-- `ip` and `userAgent` are personal data: they exist solely as consent evidence,
-- are disclosed in the KVKK aydınlatma metni, and follow the order's own
-- retention period (see the saklama ve imha politikası).
alter table public.orders
  add column if not exists "legalConsent" jsonb not null default '{}'::jsonb;

comment on column public.orders."legalConsent" is
  'Mesafeli satış onay kanıtı: {acceptedAt, documents[], version, ip, userAgent}. Boş nesne = onay kaydı olmayan eski sipariş.';

-- Orders *with* recorded consent, newest first — the shape an audit or a
-- chargeback dispute queries. Partial so legacy rows cost nothing.
create index if not exists orders_legal_consent_idx
  on public.orders (("legalConsent" ->> 'acceptedAt') desc)
  where "legalConsent" ? 'acceptedAt';

-- RLS is already enabled on public.orders by db/schema.sql; a new column
-- inherits it, so only the server-side data layer can read or write this
-- evidence.

insert into public._migrations (name) values ('20260901120000_order_legal_consent.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260901130000_release_order_inventory.sql
-- ─────────────────────────────────────────────────────────────────────
-- Returning what an order took, when the order does not complete.
--
-- Placing an order claims stock, burns a single-use customer coupon and
-- increments a promo's usage count. Cancelling one used to do none of those in
-- reverse, so a cancelled order held its stock forever and the customer's
-- coupon was gone.

-- ── orders."stockReleasedAt" ──────────────────────────────────────────────
-- Idempotency marker: the release path is guarded on this being empty, so a
-- double cancel (or a retried action) cannot credit the stock twice.
alter table public.orders
  add column if not exists "stockReleasedAt" text not null default '';

create index if not exists orders_pending_created_idx
  on public.orders ("createdAt")
  where status = 'pending_payment';

-- ── release_order_stock ───────────────────────────────────────────────────
-- Mirror of claim_order_stock. Adds the quantities back to product stock (and
-- to the chosen variant's JSONB stock) under the same row lock, and returns
-- the post-release product stock per line for stock-movement logging.
--
-- Unlike the claim there is no precondition to fail on: giving stock back can
-- always succeed. A line whose product no longer exists is skipped rather than
-- raising, so one deleted product cannot block the rest of a cancellation.
create or replace function public.release_order_stock(p_lines jsonb, p_now text)
returns int[]
language plpgsql
set search_path = ''
as $$
declare
  line      jsonb;
  qty       int;
  new_stock int;
  result    int[] := '{}';
begin
  for line in select value from jsonb_array_elements(p_lines)
  loop
    qty := (line->>'qty')::int;
    new_stock := null;

    if (line->>'variantId') is not null and (line->>'variantId') <> '' then
      update public.products
        set stock = stock + qty,
            "updatedAt" = p_now,
            variants = (
              select jsonb_agg(
                case when v->>'id' = line->>'variantId'
                  then jsonb_set(v, '{stock}', to_jsonb((v->>'stock')::int + qty))
                  else v end)
              from jsonb_array_elements(variants) v)
        where id = line->>'productId'
        returning stock into new_stock;
    else
      update public.products
        set stock = stock + qty,
            "updatedAt" = p_now
        where id = line->>'productId'
        returning stock into new_stock;
    end if;

    result := array_append(result, coalesce(new_stock, -1));
  end loop;

  return result;
end;
$$;

-- ── redeem_promo ──────────────────────────────────────────────────────────
-- Increment that ENFORCES the usage limit in the same statement.
--
-- increment_promo_usage raised the count unconditionally, and the limit was
-- checked in a separate read beforehand: two checkouts racing on the last use
-- of a code both passed the check and both incremented, so a "50 uses" code
-- could be redeemed 60 times. Returns true only when this call is the one that
-- took a use.
create or replace function public.redeem_promo(promo_code text, p_now text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  taken int;
begin
  update public.promos
    set "usageCount" = "usageCount" + 1,
        "updatedAt" = p_now
    where code = promo_code
      and "isActive" = true
      and ("usageLimit" = 0 or "usageCount" < "usageLimit");
  get diagnostics taken = row_count;
  return taken > 0;
end;
$$;

-- ── release_promo_usage ───────────────────────────────────────────────────
-- Gives a use back when the order it was taken for is cancelled. Floors at 0
-- so a double release cannot drive the count negative.
create or replace function public.release_promo_usage(promo_code text, p_now text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.promos
    set "usageCount" = greatest(0, "usageCount" - 1),
        "updatedAt" = p_now
    where code = promo_code;
end;
$$;

insert into public._migrations (name) values ('20260901130000_release_order_inventory.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260901140000_auth_durability.sql
-- ─────────────────────────────────────────────────────────────────────
-- Authentication state that must survive a process.
--
-- Both of these lived in module-scoped Maps. On a single long-lived VM that
-- works; on Vercel every serverless instance gets its own empty Map, so:
--
--   * an admin who enrolled in 2FA was asked for a code on one instance and
--     waved straight through on the next — the second factor was, in effect,
--     optional;
--   * the login lockout counted to five per instance, so an attacker got five
--     attempts per cold start rather than five in total.

-- ── admin_2fa ─────────────────────────────────────────────────────────────
-- One enrolled authenticator per admin. `secret` is the TOTP shared secret;
-- it never leaves the server (the QR is rendered from it during enrollment).
create table if not exists public.admin_2fa (
  email        text primary key,
  secret       text not null,
  enabled      boolean not null default false,
  "enrolledAt" text not null default '',
  "updatedAt"  text not null default ''
);

alter table public.admin_2fa enable row level security;

-- ── auth_attempts ─────────────────────────────────────────────────────────
-- Shared failure counter for every credential check: admin login, customer
-- login and TOTP verification. The key is scoped by purpose so the three do
-- not share a budget.
--
-- `firstFailedAt` anchors the sliding window; `lockedUntil` is the instant the
-- key is allowed to try again. Both are ISO-8601 text, like every other
-- timestamp in this schema.
create table if not exists public.auth_attempts (
  key             text primary key,
  "failedCount"   int  not null default 0,
  "firstFailedAt" text not null default '',
  "lockedUntil"   text not null default '',
  "updatedAt"     text not null default ''
);

alter table public.auth_attempts enable row level security;

create index if not exists auth_attempts_locked_idx
  on public.auth_attempts ("lockedUntil");

-- ── record_auth_failure ───────────────────────────────────────────────────
-- Counts one failure and returns the row that resulted, atomically.
--
-- A read-modify-write would lose concurrent failures — exactly the traffic
-- pattern a brute-force attempt produces, so the lost updates would be the
-- attacker's. The window resets when it has expired; reaching the cap sets the
-- lockout and clears the count so it starts fresh afterwards.
create or replace function public.record_auth_failure(
  p_key         text,
  p_now         text,
  p_window_ms   bigint,
  p_max_fails   int,
  p_lockout_ms  bigint
)
returns table ("failedCount" int, "lockedUntil" text)
language plpgsql
set search_path = ''
as $$
declare
  now_ms bigint := (extract(epoch from p_now::timestamptz) * 1000)::bigint;
begin
  insert into public.auth_attempts (key, "failedCount", "firstFailedAt", "lockedUntil", "updatedAt")
    values (p_key, 1, p_now, '', p_now)
  on conflict (key) do update set
    -- Outside the window? Start a new one at 1.
    "failedCount" = case
      when public.auth_attempts."firstFailedAt" = ''
        or (extract(epoch from p_now::timestamptz) * 1000)::bigint
           - (extract(epoch from public.auth_attempts."firstFailedAt"::timestamptz) * 1000)::bigint
           > p_window_ms
      then 1
      else public.auth_attempts."failedCount" + 1
    end,
    "firstFailedAt" = case
      when public.auth_attempts."firstFailedAt" = ''
        or (extract(epoch from p_now::timestamptz) * 1000)::bigint
           - (extract(epoch from public.auth_attempts."firstFailedAt"::timestamptz) * 1000)::bigint
           > p_window_ms
      then p_now
      else public.auth_attempts."firstFailedAt"
    end,
    "updatedAt" = p_now;

  -- Cap reached: lock out and reset the window.
  update public.auth_attempts a
    set "lockedUntil" = to_char(
          (p_now::timestamptz + (p_lockout_ms || ' milliseconds')::interval) at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        "failedCount"  = 0,
        "firstFailedAt" = ''
    where a.key = p_key and a."failedCount" >= p_max_fails;

  return query
    select a."failedCount", a."lockedUntil"
    from public.auth_attempts a
    where a.key = p_key;
end;
$$;

insert into public._migrations (name) values ('20260901140000_auth_durability.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260901150000_atomic_stock_adjust.sql
-- ─────────────────────────────────────────────────────────────────────
-- Manual stock adjustment, made atomic.
--
-- `adjustStock` read the row, added the delta in JavaScript and wrote the sum
-- back. Two adjustments in flight at once — or one racing a customer's order,
-- which decrements under a row lock — lost one of the two writes. The lost one
-- was always the smaller change, so the stock count drifted upward, which is
-- the direction that oversells.
--
-- Returns the new stock, or -1 when the product does not exist and -2 when the
-- adjustment would take it below zero, so the caller can tell the two apart
-- without a second read.
create or replace function public.adjust_product_stock(
  p_product_id text,
  p_delta      int,
  p_now        text
)
returns int
language plpgsql
set search_path = ''
as $$
declare
  new_stock int;
  exists_id text;
begin
  update public.products
    set stock = stock + p_delta,
        "updatedAt" = p_now
    where id = p_product_id
      and stock + p_delta >= 0
    returning stock into new_stock;

  if found then
    return new_stock;
  end if;

  select id into exists_id from public.products where id = p_product_id;
  if exists_id is null then
    return -1;
  end if;
  return -2;
end;
$$;

insert into public._migrations (name) values ('20260901150000_atomic_stock_adjust.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260901160000_customer_password_reset.sql
-- ─────────────────────────────────────────────────────────────────────
-- Password reset.
--
-- Four of the published documents promise it — the Gizlilik Politikası says
-- outright that a forgotten password can only be recovered by "sıfırlama
-- bağlantısı" — and there was no such flow, no column, no page. A member who
-- forgot their password had no way back into their own order history.
--
-- Kept separate from the e-mail verification token: reusing that one would let
-- a pending verification link double as a password reset, and issuing a reset
-- would silently invalidate a verification the member had not finished.
alter table public.customers
  add column if not exists "resetToken"   text not null default '',
  add column if not exists "resetExpires" text not null default '';

-- Partial: only the handful of rows with a live token, and the lookup is
-- always by the token itself.
create unique index if not exists customers_reset_token_idx
  on public.customers ("resetToken")
  where "resetToken" <> '';

insert into public._migrations (name) values ('20260901160000_customer_password_reset.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260901170000_newsletter_consent.sql
-- ─────────────────────────────────────────────────────────────────────
-- Explicit consent for commercial e-mail, and a way out of it.
--
-- 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun requires prior
-- explicit consent before commercial electronic messages, a record of when and
-- how it was given, and a free, always-available way to withdraw it. The
-- footer form took an address and subscribed it, with no consent checkbox, no
-- record, and no unsubscribe route anywhere on the site.
alter table public.newsletter_subscribers
  add column if not exists "consentAt"     text not null default '',
  add column if not exists "consentIp"     text not null default '',
  add column if not exists "consentText"   text not null default '',
  -- Bearer token for the one-click unsubscribe link in every message. Not a
  -- secret worth protecting beyond its purpose: the worst it can do is
  -- unsubscribe an address that asked to be unsubscribed.
  add column if not exists "unsubToken"    text not null default '';

create unique index if not exists newsletter_unsub_token_idx
  on public.newsletter_subscribers ("unsubToken")
  where "unsubToken" <> '';

insert into public._migrations (name) values ('20260901170000_newsletter_consent.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260901180000_settings_identity_backfill.sql
-- ─────────────────────────────────────────────────────────────────────
-- Correct a settings row written before the tax certificate was on hand.
--
-- `defaultSettings()` carries the right contact details, but the seed only
-- writes them when the table is empty — so an installation seeded earlier kept
-- the pre-correction e-mail and street name, and went on serving them in the
-- footer and the contact block of every page while /hukuk (which reads the
-- legal entity, not settings) showed the corrected ones. Two sources, two
-- answers, and the wrong one was the one customers were told to write to.
--
-- Deliberately narrow: each column is only touched while it still holds the
-- exact superseded value, so anything an owner has since typed themselves is
-- left alone, and running this twice changes nothing.

update public.settings
  set email = 'info@nextgenlab.com.tr'
  where id = 'main'
    and email in ('tuzla@laffogato.it', 'merhaba@laffogato.it');

update public.settings
  set address = 'Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1 (Menemenci Cumhur' || chr(8217) || 'un yanı), 34940 Tuzla / İstanbul'
  where id = 'main'
    and address like '%29 Ekim%';

insert into public._migrations (name) values ('20260901180000_settings_identity_backfill.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260901190000_settings_phone_and_hours.sql
-- ─────────────────────────────────────────────────────────────────────
-- Correct the reservation phone and the opening hours on the live settings row.
--
-- Same shape as 20260901180000_settings_identity_backfill.sql, and for the same
-- reason: defaultSettings() only seeds when the table is empty, so an
-- installation seeded earlier keeps the old values forever and goes on serving
-- them in the footer, the contact block and the JSON-LD.
--
-- Two corrections:
--
--   phone        +90 216 459 30 60  →  +90 536 429 09 19
--   weeklyHours  10:00–23:00 (24:00 Fri/Sat)  →  09:00–01:00 every day
--
-- 01:00 is the FOLLOWING morning. schema.org expresses that by letting
-- `closes` be earlier than `opens`, which openingHoursLd() passes through
-- untouched — its "24:00" → "23:59" mapping existed for the 10:00–24:00
-- schedule this replaces.
--
-- Deliberately narrow, exactly like its predecessor: each column is touched
-- only while it still holds the exact superseded value, so anything the owner
-- has since typed in the panel is left alone and running this twice changes
-- nothing.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, with no `on conflict`, inside the same transaction.

update public.settings
  set phone = '+90 536 429 09 19'
  where id = 'main'
    and phone in ('+90 216 459 30 60', '02164593060', '+902164593060');

update public.settings
  set "weeklyHours" = jsonb_build_object(
        'mon', jsonb_build_object('open', '09:00', 'close', '01:00', 'closed', false),
        'tue', jsonb_build_object('open', '09:00', 'close', '01:00', 'closed', false),
        'wed', jsonb_build_object('open', '09:00', 'close', '01:00', 'closed', false),
        'thu', jsonb_build_object('open', '09:00', 'close', '01:00', 'closed', false),
        'fri', jsonb_build_object('open', '09:00', 'close', '01:00', 'closed', false),
        'sat', jsonb_build_object('open', '09:00', 'close', '01:00', 'closed', false),
        'sun', jsonb_build_object('open', '09:00', 'close', '01:00', 'closed', false)
      )
  where id = 'main'
    -- Only while every day still reads exactly as the superseded schedule.
    -- If the owner has edited so much as one day, this leaves the row alone.
    and "weeklyHours" -> 'mon' ->> 'open'  = '10:00'
    and "weeklyHours" -> 'mon' ->> 'close' = '23:00'
    and "weeklyHours" -> 'fri' ->> 'close' = '24:00'
    and "weeklyHours" -> 'sun' ->> 'close' = '23:00';

insert into public._migrations (name) values ('20260901190000_settings_phone_and_hours.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260901200000_mobile_app_posts.sql
-- ─────────────────────────────────────────────────────────────────────
-- Mobile app home "posts": campaigns, collaborations and events.
--
-- The hero carousel is the brand's own voice — a handful of editorial panels in
-- the house tones. This is the other thing a coffee app's home screen carries:
-- a horizontally scrollable strip of image-first cards for a campaign, a
-- collaboration with another brand, or a one-off event.
--
-- Separate from app_hero_slides on purpose. A hero slide has a `tone` and a
-- route KEY and no image; a post is image-first and may point OUTWARD (an
-- Instagram collaboration, a ticket page). Folding both into one table would
-- have meant a nullable half on every row and — worse — one navigation path
-- shared by two very different trust levels.
--
-- `linkUrl` is the only place in the mobile content model where panel-authored
-- text becomes a destination. It is constrained to https at write time by
-- normalizeAppPost(), and the app opens it in an in-app browser rather than
-- resolving it as a native route. See src/lib/admin/store.ts.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, with no `on conflict`, inside the same transaction — a
-- duplicate from this file would roll the whole migration back.

create table if not exists public.app_posts (
  id           text    primary key,
  -- 'campaign' | 'collab' | 'event'
  kind         text    not null default 'campaign',
  title        text    not null default '',
  body         text    not null default '',
  -- Absolute https URL. Empty means the card is drawn on the brand ground.
  image        text    not null default '',
  -- Optional outward link. https only; anything else is stored as ''.
  "linkUrl"    text    not null default '',
  "linkLabel"  text    not null default '',
  "sortOrder"  integer not null default 0,
  "isActive"   boolean not null default true,
  -- ISO-8601; empty string means unbounded, matching the house convention.
  "startsAt"   text    not null default '',
  "endsAt"     text    not null default '',
  "createdAt"  text    not null default '',
  "updatedAt"  text    not null default ''
);

create index if not exists app_posts_active_idx
  on public.app_posts ("isActive", "sortOrder");

alter table public.app_posts enable row level security;

insert into public._migrations (name) values ('20260901200000_mobile_app_posts.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260901210000_migrations_table_rls.sql
-- ─────────────────────────────────────────────────────────────────────
-- _migrations tablosunu istemci rollerinden kapat.
--
-- Şemadaki 27 tablonun hepsi RLS açar; _migrations TEK istisnaydı, çünkü onu
-- uygulama şeması değil migration çalıştırıcısı yaratır ve kimse dönüp ona RLS
-- vermedi. Neon'da bunun önemi yok — istemci rolleri diye bir şey yok. Supabase'de
-- ise public şemadaki her tablo PostgREST üzerinden anon anahtarına görünür ve
-- varsayılan yetkiler anon/authenticated'a verilmiş gelir: yani geçişten sonra
-- uygulanmış migration listesi (sürüm parmak izi) herkese okunur, kötüsü
-- YAZILIR olurdu — _migrations'a eklenen sahte bir satır, o migration'ın bir
-- daha hiç uygulanmamasını sağlar.
--
-- İki katman: RLS (policy'siz = istemci rollerine kapalı) + yetki iptali.
-- Çalıştırıcıyı iki şey birden korur: tabloyu yaratan rol SAHİBİDİR (sahip,
-- kendi tablosunda RLS'ten muaftır) ve Supabase'de postgres/service_role
-- ayrıca bypassrls taşır (pg_roles'tan ölçüldü). Yani bootstrap/migrate hiçbir
-- poolda bu tabloyu "sessiz boş" görmez. Revoke, rol
-- mevcutsa yapılır — Neon'da anon/authenticated YOKTUR ve korumasız bir revoke
-- bugünkü üretimde bu migration'ı patlatırdı.
--
-- NOT: public._migrations'a insert satırı yok; scripts/db-migrate.mjs onu
-- kendisi, aynı işlem içinde ekler.

alter table public._migrations enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public._migrations from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public._migrations from authenticated;
  end if;
end $$;

insert into public._migrations (name) values ('20260901210000_migrations_table_rls.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260902100000_mobile_orders_loyalty_venue.sql
-- ─────────────────────────────────────────────────────────────────────
-- Mobile app v2: order channel/fulfillment, loyalty stamps, invites, live venue
-- status and karaoke reservations. Contract: docs/API-MOBILE.md §11.
--
-- The existing order machine (placeOrder, finalizeOrder, applyPaymentSucceeded,
-- the payment webhook) keeps writing orders exactly as before; every new orders
-- column has a default that describes a web shop order, so a row written by the
-- old path reads as `channel = 'web', kind = 'shop', fulfillment = 'shipping'`.
--
-- customers."supabaseUserId" links a Neon customer row to its Supabase Auth
-- user (identity only — Supabase never holds an order or a price).
-- "supabaseLinkAttemptedAt" records the last time the site tried to link a
-- legacy bcrypt member to a Supabase user, so a failed attempt is not retried
-- on every request.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, with no `on conflict`, inside the same transaction — a
-- duplicate from this file would roll the whole migration back.

-- ── orders: channel / kind / fulfillment ─────────────────────────────────
-- channel: 'web' | 'app' · kind: 'shop' | 'cafe' ·
-- fulfillment: 'shipping' | 'pickup' | 'delivery'
alter table public.orders add column if not exists channel        text not null default 'web';
alter table public.orders add column if not exists kind           text not null default 'shop';
alter table public.orders add column if not exists fulfillment    text not null default 'shipping';
-- ISO-8601; empty means "as soon as possible".
alter table public.orders add column if not exists "scheduledFor" text not null default '';
alter table public.orders add column if not exists "deliveryNote" text not null default '';
-- ISO-8601 instant the payment succeeded; empty while unpaid.
alter table public.orders add column if not exists "paidAt"       text not null default '';

-- ── settings: courier + karaoke pricing (kuruş) ───────────────────────────
alter table public.settings add column if not exists "courierFeeMinor"    integer not null default 5500;
alter table public.settings add column if not exists "karaokeHourlyMinor" integer not null default 90000;
alter table public.settings add column if not exists "karaokeCapacity"    integer not null default 8;

-- ── customers: Supabase identity link, invite code, "the usual" ──────────
alter table public.customers add column if not exists "supabaseUserId"          text  not null default '';
alter table public.customers add column if not exists "supabaseLinkAttemptedAt" text  not null default '';
alter table public.customers add column if not exists "inviteCode"              text  not null default '';
alter table public.customers add column if not exists "invitedBy"               text  not null default '';
-- { menuItemId, size, options } or JSON null when the member has no usual.
alter table public.customers add column if not exists usual                     jsonb not null default 'null'::jsonb;

create unique index if not exists customers_invite_code_key
  on public.customers ("inviteCode") where "inviteCode" <> '';
create index if not exists customers_supabase_user_idx
  on public.customers ("supabaseUserId") where "supabaseUserId" <> '';

-- ── loyalty_stamps ────────────────────────────────────────────────────────
-- Append-only ledger. kind: 'earn' | 'redeem' · source: 'order' | 'counter' |
-- 'invite' | 'admin' | 'app' (a redeem made from the app). One 'earn' row per
-- paid order keeps the webhook idempotent.
-- Note: customer_coupons.source gains the value 'invite' (referral reward);
-- that column is free text, so no DDL change is needed.
create table if not exists public.loyalty_stamps (
  id              text    primary key,
  "customerEmail" text    not null,
  kind            text    not null,
  delta           integer not null,
  source          text    not null default 'order',
  "orderId"       text    not null default '',
  note            text    not null default '',
  actor           text    not null default '',
  "createdAt"     text    not null default ''
);
create index if not exists loyalty_stamps_email_idx
  on public.loyalty_stamps (lower("customerEmail"));
create unique index if not exists loyalty_stamps_order_key
  on public.loyalty_stamps ("orderId") where "orderId" <> '' and kind = 'earn';
alter table public.loyalty_stamps enable row level security;

-- ── invites ───────────────────────────────────────────────────────────────
-- status: 'pending' | 'joined' | 'rewarded'. An address can be invited once.
create table if not exists public.invites (
  id             text primary key,
  code           text not null,
  "inviterEmail" text not null,
  "inviteeEmail" text not null,
  status         text not null default 'pending',
  "createdAt"    text not null default '',
  "rewardedAt"   text not null default ''
);
create unique index if not exists invites_invitee_key
  on public.invites (lower("inviteeEmail"));
alter table public.invites enable row level security;

-- ── venue_status ──────────────────────────────────────────────────────────
-- Single row (id = 'main'), edited from /admin/mobil/canli-durum.
-- manualOverride: 'auto' | 'open' | 'closed' · wifi: 'stable' | 'slow' |
-- 'down' · noise: 'low' | 'medium' | 'high'.
create table if not exists public.venue_status (
  id               text    primary key default 'main',
  "manualOverride" text    not null default 'auto',
  "freeTables"     integer not null default 0,
  "totalTables"    integer not null default 20,
  wifi             text    not null default 'stable',
  noise            text    not null default 'medium',
  power            boolean not null default true,
  note             text    not null default '',
  "updatedAt"      text    not null default ''
);
alter table public.venue_status enable row level security;

-- ── karaoke_reservations ──────────────────────────────────────────────────
-- status: 'requested' | 'confirmed' | 'cancelled'. date is YYYY-MM-DD,
-- startHour 12–24; money in kuruş, computed server-side from settings.
create table if not exists public.karaoke_reservations (
  id              text    primary key,
  "customerEmail" text    not null,
  "customerName"  text    not null default '',
  date            text    not null,
  "startHour"     integer not null,
  hours           integer not null default 1,
  guests          integer not null default 2,
  status          text    not null default 'requested',
  "priceMinor"    integer not null default 0,
  "discountMinor" integer not null default 0,
  "totalMinor"    integer not null default 0,
  note            text    not null default '',
  "createdAt"     text    not null default '',
  "updatedAt"     text    not null default ''
);
create index if not exists karaoke_reservations_date_idx
  on public.karaoke_reservations (date);
create index if not exists karaoke_reservations_email_idx
  on public.karaoke_reservations (lower("customerEmail"));
alter table public.karaoke_reservations enable row level security;

insert into public._migrations (name) values ('20260902100000_mobile_orders_loyalty_venue.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260903020000_customer_card_user_key.sql
-- ─────────────────────────────────────────────────────────────────────
-- Saved cards: one opaque provider key per member.
--
-- `cardUserKey` is iyzico's identifier for a buyer's stored cards. The card
-- itself — PAN, expiry, CVV — never reaches this database or this codebase:
-- the member types it on iyzico's own hosted form, and all we keep is a key
-- that is meaningless without our merchant credentials. That is the whole
-- point of storing it rather than a card.
--
-- It is server-only. It is never mapped into /me (see toMe), and account
-- deletion clears it along with everything else that identifies the member
-- (see ANON_SWEEPS / deleteMe).
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.customers add column if not exists "cardUserKey" text not null default '';

insert into public._migrations (name) values ('20260903020000_customer_card_user_key.sql')
  on conflict (name) do nothing;
