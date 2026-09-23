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

-- ─────────────────────────────────────────────────────────────────────
-- 20260905120000_mobile_app_config.sql
-- ─────────────────────────────────────────────────────────────────────
-- Mobile app configuration edited at /admin/mobil/ayarlar (docs/API-MOBILE.md §10).
-- One jsonb document; keys are normalised with defaults in src/lib/mobile/app-config.ts,
-- so an older row that lacks a key reads the default rather than undefined.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.settings add column if not exists "mobileApp" jsonb not null default '{}'::jsonb;

insert into public._migrations (name) values ('20260905120000_mobile_app_config.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260905140000_karaoke_no_overlap.sql
-- ─────────────────────────────────────────────────────────────────────
-- Karaoke room: one booking per hour, enforced by the database.
--
-- `createReservation` reads the day's bookings, checks the overlap in JS and
-- then inserts. Two members tapping the same free hour in the same second both
-- got through that window and the staff had to cancel one by hand. An
-- exclusion constraint closes it; the insert path maps SQLSTATE 23P01 back to
-- the 409 `slot_taken` the app already shows.
--
-- A cancelled booking does not hold its hour, so it stays out of the index.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

create extension if not exists btree_gist;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'karaoke_reservations_no_overlap'
      and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    -- If this fails with 23P01 the table already holds a double booking made
    -- before the guard existed: cancel one of the two rows and re-run.
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_no_overlap
      exclude using gist (
        date with =,
        int4range("startHour", "startHour" + hours) with &&
      ) where (status <> 'cancelled');
  end if;
end $$;

insert into public._migrations (name) values ('20260905140000_karaoke_no_overlap.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260905150000_order_idempotency_and_wishlist.sql
-- ─────────────────────────────────────────────────────────────────────
-- Two writes that had no protection against being done twice.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- ── orders."clientOrderId" ────────────────────────────────────────────────
-- The app's own id for ONE checkout attempt (docs/API-MOBILE.md §3).
--
-- POST /orders could not tell a retry from a second order: the phone gives up
-- on a slow response while the server is still mailing the confirmation and
-- opening the checkout session, and the member taps "Tekrar dene". That left
-- two pending orders, two e-mails, two held stock claims — and, after three
-- tries, a 429 lock-out for the rest of the expiry window.
--
-- The index is partial and per member: '' (web, admin, older app builds) is
-- exempt, and one client's id can never collide with another member's.
alter table public.orders
  add column if not exists "clientOrderId" text not null default '';

create unique index if not exists orders_client_order_id_key
  on public.orders (lower("customerEmail"), "clientOrderId")
  where "clientOrderId" <> '';

-- ── toggle_wishlist ───────────────────────────────────────────────────────
-- Adds or drops one product id in customers.wishlist, in one statement.
--
-- The site and the app edit the same list, and the toggle used to be a
-- read-modify-write in JavaScript: two surfaces toggling at the same moment
-- each wrote a whole array computed from the state before the other's write,
-- so one of the two toggles was lost. The row is locked here instead.
--
-- An id that names no product is refused rather than stored: /me/favorites
-- validated nothing, so any 64-character string ended up in the list and the
-- app had to filter it out on every render. Removal is never refused, so a
-- product deleted from the catalogue can still be taken off the list.
--
-- Returns 'added' | 'removed' | 'full' | 'not_found' (no such product) |
-- 'no_customer'.
create or replace function public.toggle_wishlist(
  p_email text,
  p_product_id text,
  p_now text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  current  jsonb;
  next_val jsonb;
  outcome  text;
begin
  select wishlist into current
    from public.customers
    where email = p_email
    for update;

  if current is null then
    return 'no_customer';
  end if;

  if current ? p_product_id then
    next_val := current - p_product_id;
    outcome := 'removed';
  elsif not exists (
    select 1 from public.products where id = p_product_id
  ) then
    return 'not_found';
  elsif jsonb_array_length(current) >= 200 then
    return 'full';
  else
    next_val := current || to_jsonb(p_product_id);
    outcome := 'added';
  end if;

  update public.customers
    set wishlist = next_val,
        "updatedAt" = p_now
    where email = p_email;

  return outcome;
end;
$$;

insert into public._migrations (name) values ('20260905150000_order_idempotency_and_wishlist.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260905160000_order_stage_instants.sql
-- ─────────────────────────────────────────────────────────────────────
-- Per-stage instants for an order.
--
-- `orders` recorded when a row was created, paid and shipped. "Hazırlanıyor"
-- and "Teslim edildi" had no instant of their own, so both the app's timeline
-- and the notification inbox fell back to `paidAt` for them: a gift box paid
-- on the 1st and delivered on the 20th told the member it was delivered on the
-- 1st, and — because the inbox only keeps 30 days per stage — a stage reached
-- today could be filtered out as if it were a month old.
--
-- `shippedAt` already existed but was written only by the shipping form, which
-- asks for a carrier and a tracking number. A pickup or courier order never
-- goes through that form, so its third timeline step stayed blank; the same
-- transition now stamps it.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.orders add column if not exists "preparingAt" text not null default '';
alter table public.orders add column if not exists "completedAt" text not null default '';

insert into public._migrations (name) values ('20260905160000_order_stage_instants.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260905200000_admin_users_and_counter_tokens.sql
-- ─────────────────────────────────────────────────────────────────────
-- Panel-managed admin users + the single-use token scanned at the till.
--
-- Admin users live only in the ADMIN_USERS environment variable today, so
-- adding one cashier means editing env on Vercel and redeploying. The roster
-- moves into the database; the env entry stays as the EMERGENCY LOGIN so
-- nobody can lock themselves out of the panel.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- Panel-managed admin users. The env ADMIN_USERS roster remains as an
-- emergency login; these rows are added to it and win on a clash.
create table if not exists public.admin_users (
  email          text primary key,
  "passwordHash" text    not null,
  role           text    not null default 'cashier',
  name           text    not null default '',
  "isActive"     boolean not null default true,
  "createdAt"    text    not null default '',
  "updatedAt"    text    not null default '',
  "createdBy"    text    not null default ''
);
alter table public.admin_users enable row level security;

-- The single-use token scanned at the till. The raw token is NOT stored, only
-- its sha256: whoever can read this table still cannot produce a QR that scans.
create table if not exists public.counter_tokens (
  "tokenHash"     text primary key,
  "customerEmail" text not null,
  code            text not null,
  "expiresAt"     text not null,
  "usedAt"        text not null default '',
  "usedBy"        text not null default '',
  "createdAt"     text not null default ''
);
create index if not exists counter_tokens_email_idx on public.counter_tokens (lower("customerEmail"));
create index if not exists counter_tokens_code_idx  on public.counter_tokens (code) where "usedAt" = '';
create index if not exists counter_tokens_expiry_idx on public.counter_tokens ("expiresAt");
alter table public.counter_tokens enable row level security;

insert into public._migrations (name) values ('20260905200000_admin_users_and_counter_tokens.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260908090000_settings_email_sender.sql
-- ─────────────────────────────────────────────────────────────────────
-- Transactional e-mail sender, edited at /admin/ayarlar → E-posta.
--
-- Resend delivers only from a domain verified on its account, and that
-- verification lives in DNS — outside this codebase, moved by someone adding a
-- record. So the sender is a settings row rather than a constant, and the
-- panel can follow it without a deploy (docs/EMAIL-RESEND.md §2).
--
-- These three arrived in the AdminSettings type and in defaultSettings()
-- without this file, which made `updateSettings` compile an INSERT naming
-- columns Postgres does not have (42703) — so pressing Kaydet threw, and on an
-- empty database ensureSeed() threw with it, taking the first request that
-- touched the store.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.settings add column if not exists "emailFromName"    text not null default '';
alter table public.settings add column if not exists "emailFromAddress" text not null default '';
alter table public.settings add column if not exists "emailReplyTo"     text not null default '';

-- ── customers."passwordMirroredAt" ────────────────────────────────────────
--
-- Site and app share one membership but keep two copies of the password: this
-- database's bcrypt hash and the Supabase identity. Both can now change - the
-- app grew a reset screen - so a login that finds them disagreeing has to know
-- WHICH is stale, and that is not derivable from the two values.
--
-- This is the answer. It holds the instant a password written HERE was
-- confirmed written to Supabase, and is emptied when that mirror did not
-- happen. Non-empty therefore means "Supabase is at least as new as this row",
-- which is what makes it safe to take Supabase's word on a disagreement - and
-- what makes it unsafe to fall back to the bcrypt copy for a password Supabase
-- has just refused.
alter table public.customers add column if not exists "passwordMirroredAt" text not null default '';

insert into public._migrations (name) values ('20260908090000_settings_email_sender.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260908150000_campaign_emails.sql
-- ─────────────────────────────────────────────────────────────────────
-- Campaign e-mail: the audience rule, the queue and the send log.
--
-- Commercial mail (6563) needed three things the schema did not have: a way
-- for a MEMBER to unsubscribe without logging in (only newsletter_subscribers
-- carried a token), a record of which campaign went to whom (so a retry can
-- never mail anyone twice), and the audience predicate in ONE place — a
-- jsonb filter over a table the JavaScript query builder can neither join
-- nor filter by jsonb key without paging every member row through Node.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- ── customers."unsubToken" ────────────────────────────────────────────────
-- Bearer token for the one-click unsubscribe link (RFC 8058) in every
-- campaign mail to a member. Same shape and the same caveat as the subscriber
-- token: the worst a leaked one can do is unsubscribe an address that asked
-- to be unsubscribed. Minted lazily — by campaign_email_enqueue for the whole
-- audience, or by ensureCustomerUnsubToken() for a single link — so existing
-- rows need no backfill.
alter table public.customers
  add column if not exists "unsubToken" text not null default '';

create unique index if not exists customers_unsub_token_idx
  on public.customers ("unsubToken")
  where "unsubToken" <> '';

-- ── app_posts."emailCampaignId" ───────────────────────────────────────────
-- The campaign_emails row a published post was mailed as. Set once, never
-- cleared: a later save of the same post must not mail the members again.
alter table public.app_posts
  add column if not exists "emailCampaignId" text not null default '';

-- ── campaign_emails ───────────────────────────────────────────────────────
-- One row per campaign the panel composes. `fields` holds the template's
-- [ALAN] values. `status` walks draft → queued → sending → sent | failed
-- (or cancelled). `audience` names the consent store(s) the recipients come
-- from: marketing (members), newsletter (subscribers), both.
create table if not exists public.campaign_emails (
  id             text    primary key,
  template       text    not null,
  status         text    not null default 'draft',
  audience       text    not null default 'marketing',
  subject        text    not null default '',
  fields         jsonb   not null default '{}'::jsonb,
  "sourcePostId" text    not null default '',
  "createdBy"    text    not null default '',
  "createdAt"    text    not null default '',
  "queuedAt"     text    not null default '',
  "sentAt"       text    not null default '',
  total          integer not null default 0,
  "sentCount"    integer not null default 0,
  "failedCount"  integer not null default 0,
  "lastError"    text    not null default ''
);
create index if not exists campaign_emails_status_idx
  on public.campaign_emails (status);
alter table public.campaign_emails enable row level security;

-- ── campaign_email_sends ──────────────────────────────────────────────────
-- One row per (campaign, recipient). Unique on the pair, so re-queueing a
-- campaign adds newcomers and never duplicates anyone. `batchNo` is fixed at
-- enqueue: the provider idempotency key is `cmp-<campaignId>-b<batchNo>`, so a
-- retried batch is the same request with the same addresses and Resend
-- dedupes it within 24 hours. `status`: queued → sending → sent | failed |
-- skipped (no provider key, dry run, preview host — never attempted, so a
-- re-queue puts skipped rows back in the queue; sent and failed are final).
create table if not exists public.campaign_email_sends (
  id              bigint  generated always as identity primary key,
  "campaignId"    text    not null,
  email           text    not null,
  "recipientKind" text    not null default 'customer',
  name            text    not null default '',
  "unsubUrl"      text    not null default '',
  "batchNo"       integer not null default 0,
  status          text    not null default 'queued',
  "providerId"    text    not null default '',
  error           text    not null default '',
  "claimedAt"     text    not null default '',
  "createdAt"     text    not null default '',
  "sentAt"        text    not null default ''
);
create unique index if not exists campaign_email_sends_recipient_key
  on public.campaign_email_sends ("campaignId", email);
create index if not exists campaign_email_sends_batch_idx
  on public.campaign_email_sends ("campaignId", status, "batchNo");
alter table public.campaign_email_sends enable row level security;

-- ── campaign_email_audience ───────────────────────────────────────────────
-- THE audience rule. Everything that decides who may receive a commercial
-- mail is in this one query, and both the dry count the panel shows before
-- "Gönder" and the enqueue below read it, so the two can never disagree.
--
--   marketing  → members: active, e-mail verified, the named preference on,
--                and — for the `marketing` preference — an explicit consent
--                stamp. Guest checkouts (@laffogato.local) and closed
--                accounts (@anon.local) are out even if a flag is stale.
--   newsletter → subscribers: active, with a consent record and a token
--                (no token = no unsubscribe link = no mail, 6563).
--   both       → the union, one row per address; the member row wins so the
--                unsubscribe link switches off the account's preferences.
--
-- A member's token may still be '' here; campaign_email_enqueue mints it
-- before it reads this.
create or replace function public.campaign_email_audience(
  p_audience text,
  p_pref text
)
returns table (email text, name text, kind text, token text)
language plpgsql
set search_path = ''
as $$
begin
  return query
    with members as (
      select lower(c.email)     as email,
             c.name             as name,
             'customer'::text   as kind,
             c."unsubToken"     as token
        from public.customers c
       where p_audience in ('marketing', 'both')
         and c."isActive"
         and c."emailVerified"
         and coalesce(c."notificationPrefs" ->> p_pref, 'false') = 'true'
         and (p_pref <> 'marketing' or c."marketingConsentAt" <> '')
         and c.email not like '%@laffogato.local'
         and c.email not like '%@anon.local'
    ),
    news as (
      select lower(s.email)     as email,
             s.name             as name,
             'subscriber'::text as kind,
             s."unsubToken"     as token
        from public.newsletter_subscribers s
       where p_audience in ('newsletter', 'both')
         and s."isActive"
         and s."consentAt" <> ''
         and s."unsubToken" <> ''
    ),
    everyone as (
      select m.email, m.name, m.kind, m.token from members m
      union all
      select n.email, n.name, n.kind, n.token from news n
    )
    select distinct on (e.email) e.email, e.name, e.kind, e.token
      from everyone e
     order by e.email, (e.kind = 'customer') desc;
end;
$$;

-- Dry count for the confirmation dialog: "Bu kampanya N adrese gidecek."
create or replace function public.campaign_email_audience_count(
  p_audience text,
  p_pref text
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  n integer;
begin
  select count(*) into n
    from public.campaign_email_audience(p_audience, p_pref) a;
  return coalesce(n, 0);
end;
$$;

-- ── campaign_email_enqueue ────────────────────────────────────────────────
-- Materialises the audience into campaign_email_sends and marks the campaign
-- queued. Returns the number of rows added. Safe to call again: existing
-- recipients are left alone (on conflict do nothing), skipped rows go back
-- to the queue, and newcomers are numbered AFTER the last existing batch —
-- a batch number is part of the idempotency key, and a key already sent for
-- one set of addresses must never be reused for another set.
create or replace function public.campaign_email_enqueue(
  p_campaign text,
  p_audience text,
  p_pref text,
  p_now text,
  p_unsub_base text
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  inserted   integer := 0;
  next_batch integer := 0;
  total_rows integer := 0;
begin
  if p_audience not in ('marketing', 'newsletter', 'both') then
    raise exception 'campaign_email_enqueue: unknown audience %', p_audience;
  end if;

  -- Members get their unsubscribe token here, before the audience is read,
  -- so every row inserted below carries a working link. pgcrypto is not
  -- assumed: two uuids give 256 random bits in core Postgres.
  if p_audience in ('marketing', 'both') then
    update public.customers c
       set "unsubToken" = replace(gen_random_uuid()::text, '-', '')
                       || replace(gen_random_uuid()::text, '-', '')
     where c."unsubToken" = ''
       and c."isActive"
       and c."emailVerified"
       and coalesce(c."notificationPrefs" ->> p_pref, 'false') = 'true'
       and (p_pref <> 'marketing' or c."marketingConsentAt" <> '')
       and c.email not like '%@laffogato.local'
       and c.email not like '%@anon.local';
  end if;

  -- A row that never had an attempt goes back in the queue; sent and failed
  -- rows are final.
  update public.campaign_email_sends s
     set status = 'queued', error = '', "claimedAt" = ''
   where s."campaignId" = p_campaign
     and s.status = 'skipped';

  select coalesce(max(s."batchNo"), -1) + 1 into next_batch
    from public.campaign_email_sends s
   where s."campaignId" = p_campaign;

  insert into public.campaign_email_sends
    ("campaignId", email, "recipientKind", name, "unsubUrl", "batchNo",
     status, "createdAt")
  select p_campaign,
         a.email,
         a.kind,
         a.name,
         p_unsub_base || a.token,
         next_batch + ((row_number() over (order by a.email)) - 1) / 100,
         'queued',
         p_now
    from public.campaign_email_audience(p_audience, p_pref) a
   where a.token <> ''
     and not exists (
       select 1
         from public.campaign_email_sends s
        where s."campaignId" = p_campaign
          and s.email = a.email
     )
  on conflict ("campaignId", email) do nothing;
  get diagnostics inserted = row_count;

  select count(*) into total_rows
    from public.campaign_email_sends s
   where s."campaignId" = p_campaign;

  update public.campaign_emails c
     set status      = 'queued',
         total       = total_rows,
         "queuedAt"  = p_now,
         "lastError" = ''
   where c.id = p_campaign;

  return inserted;
end;
$$;

-- ── campaign_email_claim ──────────────────────────────────────────────────
-- Hands one batch (≤ 100 rows, by construction) to the runner: the lowest
-- batch that still has queued rows — or rows a runner claimed and then died
-- on, i.e. still 'sending' with a claimedAt older than p_stale_before. The
-- rows are flipped to 'sending' in the same statement, under
-- `for update skip locked`, so two runners (the panel's after() and the cron)
-- never take the same batch.
--
-- Returns the rows as a jsonb array ordered by e-mail. The query builder's
-- rpc() reads a single `result` cell, which is why this is jsonb and not
-- `setof campaign_email_sends`.
create or replace function public.campaign_email_claim(
  p_campaign text,
  p_stale_before text,
  p_now text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  target  integer;
  claimed jsonb;
begin
  select min(s."batchNo") into target
    from public.campaign_email_sends s
   where s."campaignId" = p_campaign
     and (s.status = 'queued'
          or (s.status = 'sending' and s."claimedAt" < p_stale_before));
  if target is null then
    return '[]'::jsonb;
  end if;

  with picked as (
    select s.id
      from public.campaign_email_sends s
     where s."campaignId" = p_campaign
       and s."batchNo" = target
       and (s.status = 'queued'
            or (s.status = 'sending' and s."claimedAt" < p_stale_before))
     order by s.email
       for update skip locked
  ),
  marked as (
    update public.campaign_email_sends s
       set status = 'sending', "claimedAt" = p_now
      from picked
     where s.id = picked.id
    returning s.*
  )
  select coalesce(jsonb_agg(to_jsonb(m) order by m.email), '[]'::jsonb)
    into claimed
    from marked m;

  return claimed;
end;
$$;

-- ── campaign_email_mark ───────────────────────────────────────────────────
-- Settles a claimed batch in one statement rather than a hundred updates on
-- a max:1 pool: every row still 'sending' in that batch becomes p_status.
-- p_ids is the provider's id list in the batch's e-mail order (the order the
-- claim returned and the runner posted), so element i lands on row i. On a
-- failure p_ids is empty and p_error is written to every row. The campaign's
-- counters are refreshed from the table so they cannot drift.
create or replace function public.campaign_email_mark(
  p_campaign text,
  p_batch integer,
  p_status text,
  p_ids jsonb,
  p_error text,
  p_now text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  with ordered as (
    select s.id,
           (row_number() over (order by s.email)) - 1 as idx
      from public.campaign_email_sends s
     where s."campaignId" = p_campaign
       and s."batchNo" = p_batch
       and s.status = 'sending'
  )
  update public.campaign_email_sends s
     set status       = p_status,
         "providerId" = coalesce(p_ids ->> (o.idx)::int, ''),
         error        = coalesce(p_error, ''),
         "sentAt"     = case when p_status = 'sent' then p_now else '' end
    from ordered o
   where s.id = o.id;

  update public.campaign_emails c
     set "sentCount"   = (select count(*)
                            from public.campaign_email_sends s
                           where s."campaignId" = p_campaign
                             and s.status = 'sent'),
         "failedCount" = (select count(*)
                            from public.campaign_email_sends s
                           where s."campaignId" = p_campaign
                             and s.status in ('failed', 'skipped'))
   where c.id = p_campaign;
end;
$$;

insert into public._migrations (name) values ('20260908150000_campaign_emails.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260908170000_campaign_email_reconsent.sql
-- ─────────────────────────────────────────────────────────────────────
-- Campaign e-mail, second pass: consent is re-read when a batch is CLAIMED,
-- not only when the campaign was queued; a batch handed to the provider is
-- recorded as posted BEFORE the POST, so a batch whose answer was never
-- written down is not posted a second time once the provider's idempotency
-- window has closed; a member reaches the bulletin only with a consent
-- record behind the flag; claims are serialised per campaign, so two
-- runners never split one batch under one provider key; a mark settles only
-- the rows of its own claim; and a skipped row that comes back to the queue
-- gets a NEW batch number, never the number of a batch that was posted.
--
-- Three of the five functions from 20260908150000_campaign_emails.sql are
-- replaced here (campaign_email_audience, campaign_email_enqueue,
-- campaign_email_claim) and campaign_email_mark gains a seventh argument;
-- campaign_email_audience_count is unchanged. The old signatures of the
-- claim and the mark stay for ONE release (see the end of the file).
-- Reviewed 8 Sep 2026 (web review, findings "consent is never re-checked
-- between enqueue and send", "double-send path", "member audience for the
-- bulletin needs no consent record", "two concurrent claims split one
-- batch", "a re-queued row rejoins its original batch").
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- ── campaign_email_sends."postedAt" ──────────────────────────────────────
-- The instant the runner handed this row's batch to the provider — written
-- BEFORE the POST, cleared only by a re-queue. A row still 'sending' with a
-- postedAt may have been delivered: the runner never learned the answer.
-- Within the provider's 24-hour idempotency window the same key may be posted
-- again and is deduped upstream; after it, the row is settled as failed for a
-- person to look at rather than mailed a second time.
alter table public.campaign_email_sends
  add column if not exists "postedAt" text not null default '';

-- ── campaign_email_audience ───────────────────────────────────────────────
-- THE audience rule, as before, with one change: the `newsletter` preference
-- of a member is worth nothing on its own. `customers` carries no consent
-- stamp for the bulletin (only `marketingConsentAt`, for the marketing
-- preference), and the consent register for the bulletin is
-- newsletter_subscribers (consentAt · consentIp · consentText) — the row the
-- site's account page and the app's PATCH /me both write when the toggle goes
-- on. A member with the flag but no such row (an app subscriber from before
-- that write existed) is out until they toggle again. 6563 puts the burden of
-- proving consent on the sender; a bare boolean does not carry it.
--
--   marketing  → members: active, e-mail verified, the named preference on,
--                and a consent record — `marketingConsentAt` for the
--                `marketing` preference, an active consented
--                newsletter_subscribers row for `newsletter`. Guest checkouts
--                (@laffogato.local) and closed accounts (@anon.local) are out.
--   newsletter → subscribers: active, with a consent record and a token.
--   both       → the union, one row per address; the member row wins.
create or replace function public.campaign_email_audience(
  p_audience text,
  p_pref text
)
returns table (email text, name text, kind text, token text)
language plpgsql
set search_path = ''
as $$
begin
  return query
    with members as (
      select lower(c.email)     as email,
             c.name             as name,
             'customer'::text   as kind,
             c."unsubToken"     as token
        from public.customers c
       where p_audience in ('marketing', 'both')
         and c."isActive"
         and c."emailVerified"
         and coalesce(c."notificationPrefs" ->> p_pref, 'false') = 'true'
         and (case p_pref
                when 'marketing' then c."marketingConsentAt" <> ''
                else exists (
                  select 1
                    from public.newsletter_subscribers n
                   where lower(n.email) = lower(c.email)
                     and n."isActive"
                     and n."consentAt" <> ''
                )
              end)
         and c.email not like '%@laffogato.local'
         and c.email not like '%@anon.local'
    ),
    news as (
      select lower(s.email)     as email,
             s.name             as name,
             'subscriber'::text as kind,
             s."unsubToken"     as token
        from public.newsletter_subscribers s
       where p_audience in ('newsletter', 'both')
         and s."isActive"
         and s."consentAt" <> ''
         and s."unsubToken" <> ''
    ),
    everyone as (
      select m.email, m.name, m.kind, m.token from members m
      union all
      select n.email, n.name, n.kind, n.token from news n
    )
    select distinct on (e.email) e.email, e.name, e.kind, e.token
      from everyone e
     order by e.email, (e.kind = 'customer') desc;
end;
$$;

-- ── campaign_email_enqueue ────────────────────────────────────────────────
-- As before — mint member tokens, put skipped rows back, add newcomers after
-- the last batch — with two changes. A skipped row goes back in the queue
-- only for a recipient the audience rule still names, and as the rule names
-- them NOW: kind, name and the unsubscribe link are re-read from the
-- audience, so a token spent and re-minted in the meantime is not sent out
-- dead; a skipped row the rule no longer names stays skipped and says why.
-- And a row that comes back gets a NEW batch number, after the last one in
-- use. A batch number is part of the provider key, and now that the claim
-- skips a single row for consent (below), a 'skipped' row may belong to a
-- batch that WAS posted for the others: put back under that number it would
-- go up under a used key with a different address set — refused by the
-- provider inside its window (the row failed for nothing), delivered as a
-- new request outside it. Newcomers continue after the rows that came back.
create or replace function public.campaign_email_enqueue(
  p_campaign text,
  p_audience text,
  p_pref text,
  p_now text,
  p_unsub_base text
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  inserted   integer := 0;
  next_batch integer := 0;
  total_rows integer := 0;
begin
  if p_audience not in ('marketing', 'newsletter', 'both') then
    raise exception 'campaign_email_enqueue: unknown audience %', p_audience;
  end if;

  -- Members get their unsubscribe token here, before the audience is read,
  -- so every row inserted below carries a working link. pgcrypto is not
  -- assumed: two uuids give 256 random bits in core Postgres. Same predicate
  -- as the audience function's members branch.
  if p_audience in ('marketing', 'both') then
    update public.customers c
       set "unsubToken" = replace(gen_random_uuid()::text, '-', '')
                       || replace(gen_random_uuid()::text, '-', '')
     where c."unsubToken" = ''
       and c."isActive"
       and c."emailVerified"
       and coalesce(c."notificationPrefs" ->> p_pref, 'false') = 'true'
       and (case p_pref
              when 'marketing' then c."marketingConsentAt" <> ''
              else exists (
                select 1
                  from public.newsletter_subscribers n
                 where lower(n.email) = lower(c.email)
                   and n."isActive"
                   and n."consentAt" <> ''
              )
            end)
       and c.email not like '%@laffogato.local'
       and c.email not like '%@anon.local';
  end if;

  -- Rows that come back start after the last batch number in use — read
  -- BEFORE the re-queue, so no row returns to its old batch.
  select coalesce(max(s."batchNo"), -1) + 1 into next_batch
    from public.campaign_email_sends s
   where s."campaignId" = p_campaign;

  -- A row that never had an attempt goes back in the queue — re-read from
  -- the audience as it stands now, under a fresh batch number, a hundred to
  -- a batch in e-mail order. Sent and failed rows are final.
  with back as (
    select s.id,
           a.kind,
           a.name,
           a.token,
           row_number() over (order by s.email) as rn
      from public.campaign_email_sends s
      join public.campaign_email_audience(p_audience, p_pref) a
        on a.email = s.email
     where s."campaignId" = p_campaign
       and s.status = 'skipped'
       and a.token <> ''
  )
  update public.campaign_email_sends s
     set status          = 'queued',
         error           = '',
         "claimedAt"     = '',
         "postedAt"      = '',
         "recipientKind" = back.kind,
         name            = back.name,
         "unsubUrl"      = p_unsub_base || back.token,
         "batchNo"       = next_batch + (back.rn - 1) / 100
    from back
   where s.id = back.id;

  -- Whoever is still skipped is no longer in the audience.
  update public.campaign_email_sends s
     set error = 'onay geri çekildi ya da kitle dışına çıktı'
   where s."campaignId" = p_campaign
     and s.status = 'skipped';

  -- Newcomers continue after the rows that came back.
  select coalesce(max(s."batchNo"), -1) + 1 into next_batch
    from public.campaign_email_sends s
   where s."campaignId" = p_campaign;

  insert into public.campaign_email_sends
    ("campaignId", email, "recipientKind", name, "unsubUrl", "batchNo",
     status, "createdAt")
  select p_campaign,
         a.email,
         a.kind,
         a.name,
         p_unsub_base || a.token,
         next_batch + ((row_number() over (order by a.email)) - 1) / 100,
         'queued',
         p_now
    from public.campaign_email_audience(p_audience, p_pref) a
   where a.token <> ''
     and not exists (
       select 1
         from public.campaign_email_sends s
        where s."campaignId" = p_campaign
          and s.email = a.email
     )
  on conflict ("campaignId", email) do nothing;
  get diagnostics inserted = row_count;

  select count(*) into total_rows
    from public.campaign_email_sends s
   where s."campaignId" = p_campaign;

  update public.campaign_emails c
     set status      = 'queued',
         total       = total_rows,
         "queuedAt"  = p_now,
         "lastError" = ''
   where c.id = p_campaign;

  return inserted;
end;
$$;

-- ── campaign_email_claim ──────────────────────────────────────────────────
-- Hands one batch (≤ 100 rows) to the runner, as before — the lowest batch
-- that still has queued rows, or rows a runner claimed and then died on
-- ('sending', claimedAt older than p_stale_before), flipped to 'sending'
-- under `for update skip locked`. Three things happen first, every time:
--
--   0. The campaign's own row is locked (`for update`) and stays locked to
--      the end of this statement's transaction, so claims on one campaign
--      run one after another. Two runners DO call this at once — the panel's
--      after() and the 06:00 cron overlap, and "Gönder" is safe to press
--      twice — and without the lock both read the same lowest batch, `skip
--      locked` hands each the rows the other had not reached, and both post
--      cmp-<id>-b<n> with half the addresses: the provider refuses the second
--      (same key, different payload) and its rows are failed for nothing, or
--      the first's mark settles rows the second never delivered. With the
--      lock the second claim waits, then reads the first's fresh 'sending'
--      rows and takes the NEXT batch. `skip locked` stays as a belt.
--   1. A stale 'sending' row whose batch was POSTED (postedAt set) earlier
--      than p_posted_before — the provider's idempotency window has closed —
--      is settled as 'failed' with the reason. It may have been delivered;
--      a retry could deliver it twice; a person decides. A posted row inside
--      the window is reclaimed like any other: the same key goes up again and
--      the provider dedupes it.
--   2. Every queued (or stale, unposted) row is checked against the audience
--      rule AS IT STANDS NOW: the recipient must still be named by
--      campaign_email_audience for their own store (members against
--      'marketing', subscribers against 'newsletter', both with the
--      campaign's preference), with a token, and the token in the row's
--      stored link must still be the current one — a spent link is a dead
--      link. Rows that fail are 'skipped' with the reason; a re-queue puts
--      them back only if the rule names them again. "Now" is this
--      statement's snapshot (read committed): a withdrawal that commits
--      while the claim is running is honoured by the next claim, not this
--      one — the seconds between the claim and the POST are not covered.
--
-- The signature gained p_posted_before. The old three-argument form is kept
-- one release as a wrapper (below), for a runner of the previous build still
-- mid-send when this file lands.
create or replace function public.campaign_email_claim(
  p_campaign text,
  p_stale_before text,
  p_posted_before text,
  p_now text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_audience text;
  v_pref     text;
  settled    integer := 0;
  dropped    integer := 0;
  target     integer;
  claimed    jsonb;
begin
  -- 0. One claim at a time per campaign: the row lock is held until this
  --    statement's transaction ends, and the next claim starts from what
  --    this one committed.
  select c.audience,
         case when c.template = 'bulten-kampanya' then 'newsletter'
              else 'marketing' end
    into v_audience, v_pref
    from public.campaign_emails c
   where c.id = p_campaign
     for update;
  if v_audience is null then
    return '[]'::jsonb;
  end if;

  -- 1. Posted, never settled, window closed: failed, not re-posted.
  update public.campaign_email_sends s
     set status = 'failed',
         error  = 'sağlayıcı yanıtı teyit edilemedi'
   where s."campaignId" = p_campaign
     and s.status = 'sending'
     and s."claimedAt" < p_stale_before
     and s."postedAt" <> ''
     and s."postedAt" < p_posted_before;
  get diagnostics settled = row_count;

  -- 2. Consent, re-read now. A row already handed to the provider is left
  --    alone here: it is reclaimed (same key) or settled above, never mailed
  --    afresh.
  with ok as (
    select a.email, a.kind, a.token
      from public.campaign_email_audience('marketing', v_pref) a
    union all
    select a.email, a.kind, a.token
      from public.campaign_email_audience('newsletter', v_pref) a
  )
  update public.campaign_email_sends s
     set status      = 'skipped',
         error       = 'onay geri çekildi ya da kitle dışına çıktı',
         "claimedAt" = ''
   where s."campaignId" = p_campaign
     and s."postedAt" = ''
     and (s.status = 'queued'
          or (s.status = 'sending' and s."claimedAt" < p_stale_before))
     and not exists (
       select 1
         from ok
        where ok.email = s.email
          and ok.kind  = s."recipientKind"
          and ok.token <> ''
          and right(s."unsubUrl", length(ok.token)) = ok.token
     );
  get diagnostics dropped = row_count;

  if settled + dropped > 0 then
    update public.campaign_emails c
       set "sentCount"   = (select count(*)
                              from public.campaign_email_sends s
                             where s."campaignId" = p_campaign
                               and s.status = 'sent'),
           "failedCount" = (select count(*)
                              from public.campaign_email_sends s
                             where s."campaignId" = p_campaign
                               and s.status in ('failed', 'skipped'))
     where c.id = p_campaign;
  end if;

  select min(s."batchNo") into target
    from public.campaign_email_sends s
   where s."campaignId" = p_campaign
     and (s.status = 'queued'
          or (s.status = 'sending' and s."claimedAt" < p_stale_before));
  if target is null then
    return '[]'::jsonb;
  end if;

  with picked as (
    select s.id
      from public.campaign_email_sends s
     where s."campaignId" = p_campaign
       and s."batchNo" = target
       and (s.status = 'queued'
            or (s.status = 'sending' and s."claimedAt" < p_stale_before))
     order by s.email
       for update skip locked
  ),
  marked as (
    update public.campaign_email_sends s
       set status = 'sending', "claimedAt" = p_now
      from picked
     where s.id = picked.id
    returning s.*
  )
  select coalesce(jsonb_agg(to_jsonb(m) order by m.email), '[]'::jsonb)
    into claimed
    from marked m;

  return claimed;
end;
$$;

-- ── campaign_email_claim(text, text, text) — one release of compatibility ─
-- A runner of the previous build still inside after() when this file lands
-- (up to 240 s) calls the three-argument claim; dropped, it would fail with
-- 42883 and its campaign would be patched 'failed' for a person to re-send
-- by hand. So the old signature stays for one release, as a wrapper. It
-- passes '' as p_posted_before: no timestamp sorts below '', so it settles
-- nothing as unconfirmed — the old runner never wrote postedAt, and a row
-- posted by the new build cannot have outlived the provider's window while
-- this file is fresh. Drop it in the next migration.
create or replace function public.campaign_email_claim(
  p_campaign text,
  p_stale_before text,
  p_now text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  return public.campaign_email_claim(p_campaign, p_stale_before, '', p_now);
end;
$$;

-- ── campaign_email_mark ───────────────────────────────────────────────────
-- As before — settles a claimed batch in one statement, p_ids in the batch's
-- e-mail order, counters refreshed from the rows — but only the rows of the
-- caller's OWN claim: p_claimed_at is the claimedAt the claim stamped, read
-- by the runner off the rows it was handed. A runner that stalled past the
-- stale window and whose batch was reclaimed by another finds nothing to
-- mark here; it can no longer settle rows another runner holds, nor mark as
-- sent rows it never delivered. The six-argument form from 20260908150000
-- stays one release for a runner of the previous build; drop it in the next
-- migration.
create or replace function public.campaign_email_mark(
  p_campaign text,
  p_batch integer,
  p_status text,
  p_ids jsonb,
  p_error text,
  p_now text,
  p_claimed_at text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  with ordered as (
    select s.id,
           (row_number() over (order by s.email)) - 1 as idx
      from public.campaign_email_sends s
     where s."campaignId" = p_campaign
       and s."batchNo" = p_batch
       and s.status = 'sending'
       and s."claimedAt" = p_claimed_at
  )
  update public.campaign_email_sends s
     set status       = p_status,
         "providerId" = coalesce(p_ids ->> (o.idx)::int, ''),
         error        = coalesce(p_error, ''),
         "sentAt"     = case when p_status = 'sent' then p_now else '' end
    from ordered o
   where s.id = o.id;

  update public.campaign_emails c
     set "sentCount"   = (select count(*)
                            from public.campaign_email_sends s
                           where s."campaignId" = p_campaign
                             and s.status = 'sent'),
         "failedCount" = (select count(*)
                            from public.campaign_email_sends s
                           where s."campaignId" = p_campaign
                             and s.status in ('failed', 'skipped'))
   where c.id = p_campaign;
end;
$$;

insert into public._migrations (name) values ('20260908170000_campaign_email_reconsent.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260916120000_product_allergen_tags.sql
-- ─────────────────────────────────────────────────────────────────────
-- Shop products: the allergen column the cafe menu already had.
--
-- `menu_items.tags` carries the cafe's item tags, and one of them — `nuts` —
-- is an ALLERGEN the app is required to surface (lafmobil rule 4: "Alerjen
-- bilgisi gizlenmez"). `products` had no counterpart, so `GET /shop` could not
-- publish one and the app drew no warning on a shop product. A pistachio
-- biscotti (prd-0011, "Cantucci — Bronte Pistachio") sits on that shelf.
--
-- Same name, same type, same default and same vocabulary as `menu_items.tags`
-- so the wire field is literally the same field on both surfaces and the app
-- reads it with the code it already has.
--
-- Additive and idempotent: existing rows get `[]`, which is what they
-- effectively published before. Marking the products that do carry an allergen
-- is data work, done in /admin/urunler.
--
-- Rollback (nothing else reads the column):
--   alter table public.products drop column if exists tags;

alter table public.products
  add column if not exists tags jsonb not null default '[]'::jsonb;

insert into public._migrations (name) values ('20260916120000_product_allergen_tags.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260916140000_birthday_mail_and_scheduled_campaigns.sql
-- ─────────────────────────────────────────────────────────────────────
-- Doğum günü maili ve zamanlanmış kampanya — iki eksik tetikleyicinin şeması.
--
-- 1) `campaign_emails."scheduledAt"` — kampanya maili bugüne kadar yalnız
--    operatör panelde "Gönder"e bastığında gidiyordu: Anneler Günü, yılbaşı,
--    köşkün yıldönümü hep o sabah masa başında olmayı gerektiriyordu. Tek
--    kolon yetiyor; ayrı bir "özel günler" tablosu icat edilmiyor — eksik
--    olan kampanya değil, ZAMANLAMA idi.
--
-- 2) `birthday_greeting_audience` — o günün doğum günü sahiplerini tek
--    sorguda veren kural. Kampanya kitlesinde olduğu gibi jsonb bir tercih
--    alanının üstünde süzme gerekiyor; JavaScript sorgu katmanı ne jsonb
--    anahtarına göre süzebiliyor ne de `right(birthday, 5)` hesaplayabiliyor,
--    yoksa her üye satırı Node'dan geçerdi.
--
-- Kupon ile MAİL aynı şey değildir, bu yüzden fonksiyon ikisini ayırır:
--   • kupon bir hesap hakkıdır, ileti değildir → izin süzgeci YOK,
--     aktif + e-postası doğrulanmış her üye alır;
--   • kutlama maili kupon teklifi taşır → 6563 anlamında TİCARİ'dir →
--     `marketing` sütunu true olanlara gider (pazarlama tercihi açık VE
--     `marketingConsentAt` kayıtlı), `List-Unsubscribe` ile.
-- Satır başına tek `marketing` bayrağı, iki ayrı sorgu yerine.
--
-- NOT: burada `insert into public._migrations` YOK. scripts/db-migrate.mjs
-- onu aynı işlemin içinde kendisi yazar.
--
-- Geri alma (ikisi de bağımsız):
--   drop function if exists public.birthday_greeting_audience(jsonb);
--   drop index if exists public.campaign_emails_scheduled_idx;
--   alter table public.campaign_emails drop column if exists "scheduledAt";

-- ── campaign_emails."scheduledAt" ─────────────────────────────────────────
-- Boş dize = zamanlama yok (bugüne kadarki tek davranış). Dolu olduğunda
-- ISO-8601 UTC bir an: saatlik cron, zamanı gelmiş TASLAK kampanyaları
-- `queueCampaignEmail` ile kuyruğa alır ve gerisi kurulu boru hattıdır.
-- Kuyruğa alındıktan sonra alan olduğu gibi kalır — kampanyanın ne zaman
-- gitmesinin istendiği kaydıdır, bir daha okunmaz (durum artık 'draft'
-- değildir, kısmi indeks de onu düşürür).
alter table public.campaign_emails
  add column if not exists "scheduledAt" text not null default '';

-- Cron'un her saat sorduğu tek soru: zamanı gelmiş taslak var mı? Kısmi
-- indeks yalnız onları tutar, gönderilmiş yüzlerce kampanyayı değil.
create index if not exists campaign_emails_scheduled_idx
  on public.campaign_emails ("scheduledAt")
  where status = 'draft' and "scheduledAt" <> '';

-- ── birthday_greeting_audience ────────────────────────────────────────────
-- p_month_days: ["AA-GG", …] — İstanbul takvimine göre bugünün ay-günü.
-- Neredeyse her zaman tek eleman; artık olmayan bir yılın 1 Mart'ında
-- ["03-01", "02-29"] gelir, 29 Şubat doğumlular yılda bir kez kutlansın diye
-- (çağıran taraf karar verir, tarih bilgisi orada).
--
-- `right(birthday, 5)` iki biçimi de karşılar: "YYYY-AA-GG" ve "AA-GG"
-- (`birthdayMonth` de ikisini kabul ediyor). Doğum günü hiç girilmemiş üye
-- (boş dize) hiçbir zaman eşleşmez.
--
-- Misafir siparişi (@laffogato.local) ve kapatılmış hesap (@anon.local)
-- kitlenin dışındadır — campaign_email_audience ile aynı iki satır.
create or replace function public.birthday_greeting_audience(
  p_month_days jsonb
)
returns table (email text, name text, marketing boolean)
language plpgsql
set search_path = ''
as $$
begin
  return query
    select lower(c.email) as email,
           c.name         as name,
           (coalesce(c."notificationPrefs" ->> 'marketing', 'false') = 'true'
            and c."marketingConsentAt" <> '') as marketing
      from public.customers c
     where c."isActive"
       and c."emailVerified"
       and length(c.birthday) >= 5
       and right(c.birthday, 5) in (
             select jsonb_array_elements_text(p_month_days)
           )
       and c.email not like '%@laffogato.local'
       and c.email not like '%@anon.local'
     order by lower(c.email);
end;
$$;

insert into public._migrations (name) values ('20260916140000_birthday_mail_and_scheduled_campaigns.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260916150000_retention_sweep_indexes.sql
-- ─────────────────────────────────────────────────────────────────────
-- Periodic destruction (KVKK) — the indexes the retention sweep needs.
--
-- The published Veri Saklama ve İmha Politikası promises periodic destruction
-- and a retention period per data category; src/lib/retention.ts is the job
-- that finally carries it out, and /api/cron/retention runs it daily. Each
-- rule is `where <timestamp column> < cutoff`, and two of the four tables had
-- no index on that column, so the sweep would have been a sequential scan of
-- the two tables most likely to be large.
--
-- Nothing here changes a row, a column or a constraint: two indexes, both
-- `if not exists`, both droppable. Rolling back is
--   drop index if exists public.auth_attempts_updated_idx;
--   drop index if exists public.campaign_email_sends_created_idx;
-- and the application keeps working — the sweep merely gets slow again.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- ── auth_attempts."updatedAt" ─────────────────────────────────────────────
-- The retention rule with the shortest period (a week) and the table with the
-- most personal key: `<purpose>::<IP>::<e-mail>`. It is also the only rule
-- expected to match rows on an ordinary day.
create index if not exists auth_attempts_updated_idx
  on public.auth_attempts ("updatedAt");

-- ── campaign_email_sends."createdAt" ──────────────────────────────────────
-- One row per (campaign, recipient) and it never shrank: the three-year
-- commercial-mail record from the Ticari İletişim Yönetmeliği is the biggest
-- table the sweep touches. Existing indexes are on ("campaignId", email) and
-- ("campaignId", status, "batchNo"); neither helps an age cutoff.
create index if not exists campaign_email_sends_created_idx
  on public.campaign_email_sends ("createdAt");

insert into public._migrations (name) values ('20260916150000_retention_sweep_indexes.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260922100000_order_shipment_milestones.sql
-- ─────────────────────────────────────────────────────────────────────
-- Orders: where the PARCEL is, as distinct from where the order is.
--
-- The app retired its live-tracking map (lafmobil, 22 Eyl 2026). The map drew
-- a line that came from no feed at all, which promised a position the köşk
-- cannot offer: it runs no couriers whose phones it can read, and it buys
-- carriage from cargo firms through Geliver. What a carrier publishes is a
-- handful of milestones, so that is what the phone now shows — "Yola çıktı →
-- Yolda → Teslim edildi" (docs/API-MOBILE.md §3.1).
--
-- `orders.status` cannot carry it. That column is where the order stands in
-- the köşk's own machine and the shop owner drives it; a parcel is
-- `in_transit` for two days while the order sits at `shipped`, and collapsing
-- the two would make one of them lie. Hence a second, carrier-owned column.
--
-- `shipmentStatus` holds one of:
--   preparing | shipped | in_transit | delivered | returned | failed
-- and "" while no webhook has ever fired for the order. It is left as free
-- text rather than an enum for the same reason `status` is: a new Geliver
-- value must not be able to fail an INSERT. The mapper validates against the
-- contract's list and ignores anything else.
--
-- Until the Geliver account exists every row keeps "" and the mobile mapper
-- derives what it can from the panel's own shipping form (carrier + tracking
-- number + the order's status), so the band works on the day this ships.
--
-- Additive, idempotent, and safe to run before or after the deploy: a row
-- written by the old code simply has the defaults, and the app reads an absent
-- field as "not shipped" rather than as an error.
--
-- Rollback (nothing else reads these columns):
--   alter table public.orders drop column if exists "shipmentStatus";
--   alter table public.orders drop column if exists "trackingUrl";
--   alter table public.orders drop column if exists "shipmentUpdatedAt";

alter table public.orders
  add column if not exists "shipmentStatus"    text not null default '',
  add column if not exists "trackingUrl"       text not null default '',
  add column if not exists "shipmentUpdatedAt" text not null default '';

-- The Geliver webhook finds an order by the carrier's tracking number, which
-- is the only identifier both sides share.
create index if not exists orders_tracking_number_idx
  on public.orders ("trackingNumber")
  where "trackingNumber" <> '';

insert into public._migrations (name) values ('20260922100000_order_shipment_milestones.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260922120000_turkish_catalogue_names.sql
-- ─────────────────────────────────────────────────────────────────────
-- Katalog adları Türkçe — mağaza ürünleri ve kafe kalemleri.
--
-- Operatörün kararı (22 Eyl 2026): *"uygulamamız da türkçe tamamen buna
-- uygun yap ve türkçe olmayan ifadeleri de türkçeleştir."* Canlı `/shop` on
-- bir ürünün adını ve etiketini İngilizce yayımlıyordu ("Whole Bean · 250g",
-- "Porcelain Cup Set", "Heavyweight canvas") ve `/menu` on üç kalemi
-- ("Iced Americano", "Hot Chocolate", "Extra Shot"). Hepsi tohumdan gelen
-- satırlar; `/admin/urunler` ve `/admin/menu` onları düzenleyebilir ama on
-- birini elle düzeltmek yerine bir kez, tutarlı ve geri alınabilir biçimde
-- burada düzeltiliyor.
--
-- İLKE: uluslararası içecek ve yöntem adları KALIR — Espresso, Latte, Mocha,
-- Americano, Cold Brew, Affogato, Biscotti, Cantucci. İngilizce SIFATLAR
-- Türkçeleşir — Iced → Buzlu, Hot Chocolate → Sıcak Çikolata, Whole Bean →
-- Çekirdek, Gift Box → Hediye kutusu. Marka adları (Sirena, Notturna, Uji,
-- Bialetti) ve İtalyanca ürün adları dokunulmadan duruyor.
--
-- GÜVENLİ ve İDEMPOTENT: her satır yalnız `id` VE hâlâ eski İngilizce adı
-- taşıyorsa güncellenir (iki tire biçimi de tanınır — tohum düz tire yazıyor,
-- canlı satırlar uzun tire). Operatörün zaten yeniden adlandırdığı bir ürün
-- olduğu gibi kalır; ikinci koşuda hiçbir şey eşleşmez. `slug` ve `sku`
-- DEĞİŞMEZ — adresler ve kasa kayıtları aynı kalsın.
--
-- Uygulamanın ve sitenin tohumları (`catalog.seed.json`, `laffogato/data.ts`)
-- aynı haritayla aynı gün güncellendi; taze bir kurulum bu satırlarla aynı
-- adları üretir.
--
-- Rollback: aynı satırları ters yönde güncelleyen bir migration yazılır;
-- burada geri alınacak bir şema yok.

update public.products
   set name = 'Sirena — Espresso Harmanı',
       tag  = case when tag = 'Whole Bean · 250g' then 'Çekirdek · 250 g' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0001'
   and name in ('Sirena — Espresso Blend', 'Sirena - Espresso Blend');

update public.products
   set name = 'Notturna — Filtre Lotu',
       tag  = case when tag = 'Whole Bean · 200g' then 'Çekirdek · 200 g' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0002'
   and name in ('Notturna — Filter Lot', 'Notturna - Filter Lot');

update public.products
   set name = 'Yenilebilir Kup — 6''lı Kutu',
       tag  = case when tag = 'Waffle Vessels' then 'Waffle kupları' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0003'
   and name in ('Edible Cups — 6 Box', 'Edible Cups - 6 Box');

update public.products
   set name = 'Affogato Seti — İki Kişilik',
       tag  = case when tag = 'Gift Box' then 'Hediye kutusu' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0004'
   and name in ('Affogato Kit — For Two', 'Affogato Kit - For Two');

update public.products
   set name = 'Uji Matcha — Seremoni Sınıfı',
       tag  = case when tag = 'Tin · 40g' then 'Teneke kutu · 40 g' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0005'
   and name in ('Uji Matcha — Ceremonial', 'Uji Matcha - Ceremonial');

update public.products
   set name = 'Moka — Bialetti × L''Affogato',
       tag  = case when tag = '3-cup, brushed aluminium' then '3 fincanlık, fırçalanmış alüminyum' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0006'
   and name in ('Moka — Bialetti × L''Affogato', 'Moka - Bialetti × L''Affogato');

update public.products
   set name = 'Porselen Fincan Seti',
       tag  = case when tag = 'Espresso · Set of 2' then 'Espresso · 2''li set' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0007'
   and name in ('Porcelain Cup Set', 'Porcelain Cup Set');

update public.products
   set name = 'Pamuk Önlük',
       tag  = case when tag = 'Heavyweight canvas' then 'Kalın kanvas' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0009'
   and name in ('Cotton Apron', 'Cotton Apron');

update public.products
   set name = 'Emaye Bardak',
       tag  = case when tag = '350ml, double wall' then '350 ml, çift cidarlı' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0010'
   and name in ('Enamel Tumbler', 'Enamel Tumbler');

update public.products
   set name = 'Cantucci — Bronte Pistachio',
       tag  = case when tag = 'Biscotti · 180g' then 'Biscotti · 180 g' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0011'
   and name in ('Cantucci — Bronte Pistachio', 'Cantucci - Bronte Pistachio');

update public.menu_items
   set name = 'Buzlu Americano'
 where id = 'mnu-0022'
   and name = 'Iced Americano';

update public.menu_items
   set name = 'Buzlu Caffè Latte'
 where id = 'mnu-0023'
   and name = 'Iced Caffè Latte';

update public.menu_items
   set name = 'Buzlu Caffè Mocha'
 where id = 'mnu-0024'
   and name = 'Iced Caffè Mocha';

update public.menu_items
   set name = 'Buzlu Beyaz Çikolatalı Mocha'
 where id = 'mnu-0025'
   and name = 'Iced White Ch. Mocha';

update public.menu_items
   set name = 'Buzlu Tuzlu Karamel Latte'
 where id = 'mnu-0026'
   and name = 'Iced Salted Caramel Latte';

update public.menu_items
   set name = 'Buzlu Toffeenut Latte'
 where id = 'mnu-0027'
   and name = 'Iced Toffeenut Latte';

update public.menu_items
   set name = 'Buzlu Balkabağı Latte'
 where id = 'mnu-0028'
   and name = 'Iced Pumpkin Spice Latte';

update public.menu_items
   set name = 'Buzlu İspanyol Latte'
 where id = 'mnu-0029'
   and name = 'Iced Spanish Latte';

update public.menu_items
   set name = 'Sıcak Çikolata'
 where id = 'mnu-0038'
   and name = 'Hot Chocolate';

update public.menu_items
   set name = 'Beyaz Sıcak Çikolata'
 where id = 'mnu-0039'
   and name = 'White Hot Chocolate';

update public.menu_items
   set name = 'Karamelli Sıcak Çikolata'
 where id = 'mnu-0040'
   and name = 'Caramel Hot Chocolate';

update public.menu_items
   set name = 'Ekstra Shot'
 where id = 'mnu-0081'
   and name = 'Extra Shot';

insert into public._migrations (name) values ('20260922120000_turkish_catalogue_names.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260922130000_turkish_menu_names_pass2.sql
-- ─────────────────────────────────────────────────────────────────────
-- Menü adları Türkçe — ikinci geçiş: sıcak kardeşler, meyveler, kategoriler.
--
-- 22 Eyl'deki ilk geçiş yalnız "Iced …" kalemlerini ve sıcak çikolataları
-- çevirmişti; kardeşleri İngilizce kaldı ("Salted Caramel Latte" ile "Buzlu
-- Tuzlu Karamel Latte" aynı vitrinde). Bu geçiş aynı ilkeyi bütün karta
-- uygular: uluslararası içecek/yöntem adı KALIR (Cold Brew, Flat White,
-- Cortado, Frappe, Smoothie, Cheesecake, Tiramisu), İngilizce SIFAT ve
-- KISALTMA Türkçeleşir (Salted Caramel → Tuzlu Karamel, Esp. → Espresso,
-- White Choc. → Beyaz Çikolatalı), meyve adları Türkçe (Blueberry → Yaban
-- Mersini). Kategori başlıkları da: "Espresso Based" → "Espresso",
-- "Ice Coffee" → "Soğuk Kahve", "Ice Tea" → "Soğuk Çay".
--
-- İDEMPOTENT ve GÜVENLİ: her satır `id` VE hâlâ eski adı taşıyorsa güncellenir;
-- operatörün zaten değiştirdiği bir satır olduğu gibi kalır. Uygulamanın ve
-- sitenin tohumları aynı haritayla aynı gün güncellendi.
--
-- Rollback: aynı satırları ters yönde güncelleyen bir migration; şema yok.

update public.menu_items set name = 'Çilekli Matcha' where id = 'mnu-0002' and name = 'Strawberry Matcha';
update public.menu_items set name = 'Espresso Macchiato' where id = 'mnu-0011' and name = 'Esp. Macchiato';
update public.menu_items set name = 'İspanyol Latte' where id = 'mnu-0012' and name = 'Spanish Latte';
update public.menu_items set name = 'Beyaz Çikolatalı Mocha' where id = 'mnu-0014' and name = 'White Choc. Mocha';
update public.menu_items set name = 'Karamel Latte' where id = 'mnu-0015' and name = 'Caramel Latte';
update public.menu_items set name = 'Tuzlu Karamel Latte' where id = 'mnu-0016' and name = 'Salted Caramel Latte';
update public.menu_items set name = 'Balkabağı Latte' where id = 'mnu-0018' and name = 'Pumpkin Spice Latte';
update public.menu_items set name = 'Buzlu Chai' where id = 'mnu-0021' and name = 'Chai Tea';
update public.menu_items set name = 'Sürpriz İçecek' where id = 'mnu-0032' and name = 'Surprise Drink';
update public.menu_items set name = 'Chai Latte' where id = 'mnu-0037' and name = 'Chai Tea Latte';
update public.menu_items set name = 'Çay' where id = 'mnu-0042' and name = 'Tea';
update public.menu_items set name = 'Karamel Frappe' where id = 'mnu-0046' and name = 'Caramel Frappe';
update public.menu_items set name = 'Yaban Mersini' where id = 'mnu-0047' and name = 'Blueberry';
update public.menu_items set name = 'Elma' where id = 'mnu-0049' and name = 'Apple';
update public.menu_items set name = 'Çilek' where id = 'mnu-0051' and name = 'Strawberry';
update public.menu_items set name = 'Frambuaz' where id = 'mnu-0052' and name = 'Raspberry';
update public.menu_items set name = 'Çarkıfelek' where id = 'mnu-0053' and name = 'Passionfruit';
update public.menu_items set name = 'Ananas' where id = 'mnu-0054' and name = 'Pineapple';
update public.menu_items set name = 'Limonlu Soğuk Çay' where id = 'mnu-0055' and name = 'Lemon Tea';
update public.menu_items set name = 'Şeftalili Soğuk Çay' where id = 'mnu-0056' and name = 'Peach Tea';
update public.menu_items set name = 'Donostia (L''Af Özel)' where id = 'mnu-0057' and name = 'Donostia (L''Af Special)';
update public.menu_items set name = 'Yaban Mersinli San Sebastian' where id = 'mnu-0059' and name = 'Blueberry San Sebastian';
update public.menu_items set name = 'L''Af Kahve' where id = 'mnu-0061' and name = 'L''Af Coffee';
update public.menu_items set name = 'Çıtır Granola Bar (Kenya)' where id = 'mnu-0076' and name = 'Crunchy Granola Bar (Kenya)';
update public.menu_items set name = 'Şurup' where id = 'mnu-0080' and name = 'Syrup';

update public.categories set label = 'Espresso' where (id = 'espresso' or slug = 'espresso') and label = 'Espresso Based';
update public.categories set label = 'Soğuk Kahve' where (id = 'ice-coffee' or slug = 'ice-coffee') and label = 'Ice Coffee';
update public.categories set label = 'Soğuk İçecekler' where (id = 'cold' or slug = 'cold') and label = 'Cold Drinks';
update public.categories set label = 'Sıcak İçecekler' where (id = 'hot' or slug = 'hot') and label = 'Hot Drinks';
update public.categories set label = 'Soğuk Çay' where (id = 'ice-tea' or slug = 'ice-tea') and label = 'Ice Tea';
update public.categories set label = 'Ekstralar' where (id = 'extras' or slug = 'extras') and label = 'Extras';

insert into public._migrations (name) values ('20260922130000_turkish_menu_names_pass2.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260923100000_admin_auth_hardening.sql
-- ─────────────────────────────────────────────────────────────────────
-- Admin authentication hardening (docs/AUDIT.md §8, "Açık" 1).
--
-- A TOTP code stays valid for its whole 30-second step (and, with the ±1 step
-- drift tolerance, for up to 90 seconds). Nothing remembered that a code had
-- already been accepted, so one read over a shoulder — or out of a proxy log —
-- could be replayed within that window. `lastStep` is the time step of the
-- last code this admin used; a code is accepted only for a LATER step, and the
-- check-and-set is one conditional UPDATE, so two concurrent submissions of
-- the same code cannot both pass.
--
-- Additive and idempotent: a nullable-free column with a default every
-- existing row satisfies (0 = no code used yet).
alter table public.admin_2fa
  add column if not exists "lastStep" bigint not null default 0;

-- ── reserve_auth_attempt ────────────────────────────────────────────────
-- Counts an authentication attempt BEFORE the credential is checked and says
-- whether it may go ahead. The old sequence was check (JS) → verify → record
-- a failure (SQL): a burst sent in parallel passed the check all at once, so
-- every guess in it was verified whatever the counter said.
--
-- One statement, one transaction, the key's row locked for its duration:
--   · locked out now            → refused, NOT counted (the lockout does not
--                                  grow while someone hammers it);
--   · window expired / first    → count restarts at 1;
--   · this attempt reaches cap  → allowed (it is the last permitted one), the
--                                  lockout starts and the count resets;
--   · otherwise                 → allowed, count + 1.
-- A success clears the key from the application (`clearLoginLimit`).
--
-- Returns jsonb {allowed, remaining, lockedUntil}: rpc() reads one cell, and
-- `remaining` is how many attempts are left if this one fails.
create or replace function public.reserve_auth_attempt(
  p_key        text,
  p_now        text,
  p_window_ms  bigint,
  p_max_fails  int,
  p_lockout_ms bigint
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  now_ts timestamptz := p_now::timestamptz;
  r      public.auth_attempts%rowtype;
  cnt    int;
  until  text;
begin
  insert into public.auth_attempts (key, "failedCount", "firstFailedAt", "lockedUntil", "updatedAt")
    values (p_key, 0, '', '', p_now)
  on conflict (key) do nothing;

  select * into r from public.auth_attempts where key = p_key for update;

  if r."lockedUntil" <> '' and r."lockedUntil"::timestamptz > now_ts then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'lockedUntil', r."lockedUntil");
  end if;

  if r."firstFailedAt" = ''
     or extract(epoch from (now_ts - r."firstFailedAt"::timestamptz)) * 1000 > p_window_ms then
    cnt := 1;
    update public.auth_attempts
       set "failedCount" = 1, "firstFailedAt" = p_now, "updatedAt" = p_now
     where key = p_key;
  else
    cnt := r."failedCount" + 1;
    update public.auth_attempts
       set "failedCount" = cnt, "updatedAt" = p_now
     where key = p_key;
  end if;

  if cnt >= p_max_fails then
    until := to_char(
      (now_ts + (p_lockout_ms || ' milliseconds')::interval) at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    update public.auth_attempts
       set "lockedUntil" = until, "failedCount" = 0, "firstFailedAt" = ''
     where key = p_key;
    return jsonb_build_object('allowed', true, 'remaining', 0, 'lockedUntil', until);
  end if;

  return jsonb_build_object('allowed', true, 'remaining', p_max_fails - cnt, 'lockedUntil', '');
end;
$$;

insert into public._migrations (name) values ('20260923100000_admin_auth_hardening.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260923110000_atomic_caps_and_refunds.sql
-- ─────────────────────────────────────────────────────────────────────
-- Counters that were decided in JavaScript, moved into the database
-- (docs/AUDIT.md §8, "Açık" 6; CLAUDE.md rule 20).
--
-- Each of these was read → decide (JS) → write. Two requests arriving
-- together both read the old state, both decided "fine", both wrote:
--
--   · refunds          two refunds of one order could together exceed what
--                      was paid — and each one had already moved money;
--   · app pending cap  MAX_OPEN_ORDERS (3) unpaid app orders per member;
--   · karaoke cap      KARAOKE_OPEN_CAP (2) open bookings per member;
--   · till QR tokens   10 issued per member per minute.
--
-- The JS checks stay as the friendly early answer. What is added here is the
-- guard that holds under concurrency. The caps are BEFORE INSERT triggers:
-- the trigger takes a transaction-scoped advisory lock on the member, so two
-- inserts for the same member run one after the other, and the count taken
-- after the lock (a fresh snapshot per statement under READ COMMITTED) sees
-- the row the other one committed. A refused insert raises a named P0001 the
-- application maps to the same answer its own check gives.
--
-- The numbers are repeated from the TypeScript constants on purpose (one
-- literal each, next to the name it mirrors); tests/atomic-caps-sql.test.ts
-- fails if they drift apart.

-- ── Refunds ─────────────────────────────────────────────────────────────
-- Appends a refund entry only while it fits in what is left of the order, in
-- ONE UPDATE: the row lock makes a concurrent second refund wait, and Postgres
-- re-evaluates the WHERE (sum included) against the first one's result. Called
-- BEFORE the POS is asked for money; `drop_order_refund` takes the entry back
-- if the POS then refuses. Returns the new refunds array, or NULL when refused.
create or replace function public.reserve_order_refund(
  p_order_id text,
  p_refund   jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  out_refunds jsonb;
begin
  update public.orders o
     set refunds = coalesce(o.refunds, '[]'::jsonb) || jsonb_build_array(p_refund)
   where o.id = p_order_id
     and (p_refund ->> 'amountMinor')::int > 0
     and o."totalMinor" - coalesce((
           select sum((r ->> 'amountMinor')::int)
             from jsonb_array_elements(coalesce(o.refunds, '[]'::jsonb)) r
         ), 0) >= (p_refund ->> 'amountMinor')::int
  returning o.refunds into out_refunds;
  return out_refunds;
end;
$$;

create or replace function public.drop_order_refund(
  p_order_id  text,
  p_refund_id text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.orders o
     set refunds = coalesce((
           select jsonb_agg(e.r order by e.n)
             from jsonb_array_elements(coalesce(o.refunds, '[]'::jsonb))
                  with ordinality as e(r, n)
            where e.r ->> 'id' is distinct from p_refund_id
         ), '[]'::jsonb)
   where o.id = p_order_id;
end;
$$;

-- ── App orders: MAX_OPEN_ORDERS unpaid per member ───────────────────────
-- Mirrors src/lib/mobile/orders.ts: pending_payment orders of the member (any
-- channel) younger than PENDING_ORDER_TTL_MINUTES (45) count; only a NEW app
-- order is refused, never a web one or an admin's manual order.
create or replace function public.app_pending_order_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  since      text;
  open_count int;
begin
  if coalesce(new.channel, '') <> 'app' or new.status <> 'pending_payment' then
    return new;
  end if;
  perform pg_advisory_xact_lock(
    hashtext('app-pending-cap:' || lower(new."customerEmail")));
  since := to_char((now() - interval '45 minutes') at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  select count(*) into open_count
    from public.orders
   where lower("customerEmail") = lower(new."customerEmail")
     and status = 'pending_payment'
     and "createdAt" >= since;
  if open_count >= 3 then  -- MAX_OPEN_ORDERS
    raise exception 'TOO_MANY_PENDING_ORDERS' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists app_pending_order_cap on public.orders;
create trigger app_pending_order_cap
  before insert on public.orders
  for each row execute function public.app_pending_order_cap();

-- ── Karaoke: KARAOKE_OPEN_CAP open bookings per member ──────────────────
-- Mirrors src/lib/mobile/karaoke.ts: bookings that are not cancelled, from
-- today on (Europe/Istanbul) count.
create or replace function public.karaoke_open_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  today      text;
  open_count int;
begin
  if new.status = 'cancelled' then
    return new;
  end if;
  perform pg_advisory_xact_lock(
    hashtext('karaoke-open-cap:' || lower(new."customerEmail")));
  today := to_char((now() at time zone 'Europe/Istanbul')::date, 'YYYY-MM-DD');
  select count(*) into open_count
    from public.karaoke_reservations
   where lower("customerEmail") = lower(new."customerEmail")
     and status <> 'cancelled'
     and date >= today;
  if open_count >= 2 then  -- KARAOKE_OPEN_CAP
    raise exception 'TOO_MANY_OPEN_RESERVATIONS' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists karaoke_open_cap on public.karaoke_reservations;
create trigger karaoke_open_cap
  before insert on public.karaoke_reservations
  for each row execute function public.karaoke_open_cap();

-- ── Till QR tokens: MAX_ISSUES_PER_WINDOW per ISSUE_WINDOW_MS ───────────
-- Mirrors src/lib/mobile/counter.ts: 10 tokens per member per 60 seconds.
create or replace function public.counter_token_issue_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  at_ts  timestamptz;
  since  text;
  issued int;
begin
  perform pg_advisory_xact_lock(
    hashtext('counter-issue-cap:' || lower(new."customerEmail")));
  at_ts := coalesce(nullif(new."createdAt", '')::timestamptz, now());
  since := to_char((at_ts - interval '60 seconds') at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  select count(*) into issued
    from public.counter_tokens
   where "customerEmail" = new."customerEmail"
     and "createdAt" >= since;
  if issued >= 10 then  -- MAX_ISSUES_PER_WINDOW
    raise exception 'COUNTER_RATE_LIMITED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists counter_token_issue_cap on public.counter_tokens;
create trigger counter_token_issue_cap
  before insert on public.counter_tokens
  for each row execute function public.counter_token_issue_cap();

insert into public._migrations (name) values ('20260923110000_atomic_caps_and_refunds.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260923120000_newsletter_double_opt_in.sql
-- ─────────────────────────────────────────────────────────────────────
-- Bulletin double opt-in (6563; docs/AUDIT.md §8, "Açık" 3).
--
-- The footer form wrote an ACTIVE subscriber for whatever address was typed:
-- anyone could sign anyone up, including someone who had opted out, and the
-- "consent" record then carried the stranger's IP. A request from an address
-- whose owner has not proven it is now stored inactive with a confirmation
-- token; it becomes a subscriber (isActive, consentAt) only when the owner
-- confirms — from the mail (footer) or by verifying their account (register /
-- account toggle). The campaign audience already requires isActive AND
-- consentAt, so a pending row is never mailed.
--
-- `confirmRequestedAt` / `confirmRequestIp` keep the REQUEST half of the
-- evidence; `consentAt` / `consentIp` are written at confirmation.
-- Additive: three text columns with '' defaults every existing row satisfies.
alter table public.newsletter_subscribers
  add column if not exists "confirmToken"       text not null default '',
  add column if not exists "confirmRequestedAt" text not null default '',
  add column if not exists "confirmRequestIp"   text not null default '';

create index if not exists newsletter_subscribers_confirm_token_idx
  on public.newsletter_subscribers ("confirmToken")
  where "confirmToken" <> '';

insert into public._migrations (name) values ('20260923120000_newsletter_double_opt_in.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260923130000_invite_reward_progress.sql
-- ─────────────────────────────────────────────────────────────────────
-- Which of an invite's two free-drink coupons were already granted
-- (docs/AUDIT.md §8, "Açık" 10).
--
-- rewardInviteOnFirstPaidOrder grants the invitee's coupon, then the
-- inviter's. When the second grant threw, the invite went back to `pending`
-- so that a retry would settle it — and the retry granted the invitee a
-- SECOND coupon. Each grant now records the coupon it produced on the invite;
-- a retry grants only what is still missing.
-- Additive: two text columns with '' defaults every existing row satisfies.
alter table public.invites
  add column if not exists "inviteeCouponId" text not null default '',
  add column if not exists "inviterCouponId" text not null default '';

insert into public._migrations (name) values ('20260923130000_invite_reward_progress.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260923140000_mark_nut_allergens.sql
-- ─────────────────────────────────────────────────────────────────────
-- Mark the two nut allergens that were never marked (lafmobil rule 4:
-- "Alerjen bilgisi gizlenmez").
--
-- 20260916120000_product_allergen_tags.sql gave `products` the `tags` column
-- the cafe menu already had and left the marking to /admin/urunler. Nobody
-- marked anything: on 23 Sep 2026 `GET /shop` published `tags: []` for all
-- eleven products, so the app drew no warning on the pistachio biscotti - its
-- AllergenPill is drawn from `tags.includes("nuts")` and nothing else.
--
-- The menu had the same hole in one row: "Alternatif Süt" is "Yulaf, badem
-- veya laktozsuz süt seçeneği" - almond is a tree nut - and it carried no tag.
-- Tagging the item that CAN contain nuts is the safe reading: the warning has
-- to reach the member who picks almond, and the menu line cannot know which
-- milk will be chosen.
--
-- IDEMPOTENT and SAFE: each row is matched by id AND by what it is, and only
-- gains the tag if it does not already carry it. An operator who has already
-- marked (or renamed) the row is left alone. The seeds were changed the same
-- day, so a fresh database starts marked.
--
-- Rollback: the same rows with `tags - 'nuts'`; no schema change.

update public.products
   set tags = tags || '["nuts"]'::jsonb
 where id = 'prd-0011'
   and name ilike '%pistachio%'
   and not (tags @> '["nuts"]'::jsonb);

update public.menu_items
   set tags = tags || '["nuts"]'::jsonb
 where id = 'mnu-0082'
   and name = 'Alternatif Süt'
   and not (tags @> '["nuts"]'::jsonb);

insert into public._migrations (name) values ('20260923140000_mark_nut_allergens.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260923141000_retire_placeholder_press.sql
-- ─────────────────────────────────────────────────────────────────────
-- Take the four placeholder press quotes off the site and the app.
--
-- "Monocle", "Cereal", "Time Out İstanbul" and "Condé Nast Traveler" were
-- written into `data.ts` on 26 May 2026 by the first design implementation
-- (33635fd) - mock-up copy, later seeded into `press` by the panel resource
-- (cfc6ac5). Nothing shows any of them was ever said: they attribute praise
-- to real publications, and one quotes a price ("130₺") the menu no longer
-- charges. A quote from a publication that never gave it is a false
-- endorsement, on the page and in the app's story screen alike.
--
-- DEACTIVATED, NOT DELETED. The rows stay in /admin/basin, switched off, so
-- the operator can switch a genuine one back on (with its source) in one
-- click. Deleting them would also empty the table, and the panel resource
-- re-seeds an empty table on first read. `data.ts` no longer seeds them.
--
-- IDEMPOTENT and SAFE: only the seeded ids, only while they still carry the
-- seeded outlet name - a row the operator replaced is left alone.
--
-- Rollback: set "isActive" = true on the same ids.

update public.press
   set "isActive" = false,
       "updatedAt" = to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
 where id in ('press-001', 'press-002', 'press-003', 'press-004')
   and name in ('Monocle', 'Cereal', 'Time Out İstanbul', 'Condé Nast Traveler')
   and "isActive" = true;

insert into public._migrations (name) values ('20260923141000_retire_placeholder_press.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260923200000_customer_milestone_rewards.sql
-- ─────────────────────────────────────────────────────────────────────
-- Milestone gifts (karar 175): 10 lifetime stamps -> a Filtre Kahve, 20 -> an
-- Americano, 30 and 40 -> a drink or dessert picked at random from the menu.
--
-- One row per member and milestone. The primary key is the guard: the grant
-- writes its row FIRST and only then mints the coupon, so two paid orders
-- landing at the same moment cannot both give the tenth-stamp gift. The row
-- then records what was given - the coupon, the item and its value at the
-- time - so a random pick is on the record, not only in a log.
-- Same conventions as the rest of the schema: camelCase-quoted columns,
-- ISO-8601 text dates, integer minor units.
create table if not exists public.customer_milestone_rewards (
  "customerEmail" text    not null,
  milestone       integer not null,
  "couponId"      text    not null default '',
  "menuItemId"    text    not null default '',
  "itemName"      text    not null default '',
  "valueMinor"    integer not null default 0,
  "createdAt"     text    not null default '',
  primary key ("customerEmail", milestone)
);

insert into public._migrations (name) values ('20260923200000_customer_milestone_rewards.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260923210000_fal_ai_consent_and_usage.sql
-- ─────────────────────────────────────────────────────────────────────
-- fA'L read by AI (karar 177): the member's explicit consent and the usage
-- record the daily limit counts. Nothing here holds a photo or a reading.
--
-- feature_consents: one row per member and feature. The row IS the proof of
-- consent KVKK asks the data controller to keep - who, which text version,
-- when - so a withdrawal stamps "revokedAt" rather than deleting it.
--
-- fal_readings: one row per AI reading - the Istanbul day, whether a cup was
-- seen, the model. Swept after ninety days (src/lib/retention.ts), as the
-- R12 text promises.
--
-- Same conventions as the rest of the schema: camelCase-quoted columns,
-- ISO-8601 text dates; RLS on with no policies (the server's own role
-- bypasses it).
create table if not exists public.feature_consents (
  "customerEmail" text not null,
  feature         text not null,
  version         text not null default '',
  "grantedAt"     text not null default '',
  "revokedAt"     text not null default '',
  primary key ("customerEmail", feature)
);
alter table public.feature_consents enable row level security;

create table if not exists public.fal_readings (
  id              bigserial primary key,
  "customerEmail" text    not null,
  day             text    not null,
  "createdAt"     text    not null default '',
  model           text    not null default '',
  "cupSeen"       boolean not null default false
);
create index if not exists fal_readings_member_day on public.fal_readings ("customerEmail", day);
create index if not exists fal_readings_created on public.fal_readings ("createdAt");
alter table public.fal_readings enable row level security;

insert into public._migrations (name) values ('20260923210000_fal_ai_consent_and_usage.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260923220000_product_brand_notes.sql
-- ─────────────────────────────────────────────────────────────────────
-- Shop products: the maker's name and the tasting notes, as their own fields.
--
-- The app's product page (lafmobil screen 13) draws a brand eyebrow above the
-- name ("SIRENA") and a row of tasting-note chips ("Kakao · Kuru incir ·
-- Esmer şeker"). Neither could be derived from what `products` held: the
-- brand is not a column, and the notes cannot be split out of `desc` without
-- turning a sentence ("Nara'dan.") into a chip. Until now both screens printed
-- the whole description instead (lafmobil W2).
--
-- brand  text  - the maker, as the operator writes it; '' = no eyebrow.
-- notes  jsonb - an array of short strings; '[]' = no chips.
--
-- Additive and idempotent: existing rows get the empty values, which the app
-- reads as "draw the description as today", so nothing changes on any screen
-- until the operator fills a product in /admin/urunler.
--
-- Rollback (only GET /shop and the product form read them):
--   alter table public.products drop column if exists brand;
--   alter table public.products drop column if exists notes;

alter table public.products
  add column if not exists brand text not null default '';

alter table public.products
  add column if not exists notes jsonb not null default '[]'::jsonb;

insert into public._migrations (name) values ('20260923220000_product_brand_notes.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260923221000_fal_reports.sql
-- ─────────────────────────────────────────────────────────────────────
-- fA'L: "Bu yorumu bildir" - a member reports an AI reading (Google Play's
-- AI-generated content policy wants an in-app way to flag one before the
-- feature is switched on).
--
-- One row per report: the member (for the daily cap and the account-deletion
-- sweep), the Istanbul day, the reason from a closed list, the reading's own
-- words as the member saw them, and the model that wrote it. NEVER the photo:
-- the photo is not kept anywhere, and a report does not change that.
--
-- Swept ninety days after it is made (src/lib/retention.ts, rule
-- `fal-reports`), as the Veri Saklama ve İmha Politikası publishes. On
-- DELETE /me the member's address is replaced with the closed account's
-- placeholder (ANON_SWEEPS); the report itself stays until the sweep.
--
-- Same conventions as fal_readings: camelCase-quoted columns, ISO-8601 text
-- dates, RLS on with no policies (the server's own role bypasses it).
create table if not exists public.fal_reports (
  id              bigserial primary key,
  "customerEmail" text not null,
  day             text not null,
  reason          text not null default 'other',
  text            text not null default '',
  model           text not null default '',
  "createdAt"     text not null default ''
);
create index if not exists fal_reports_member_day on public.fal_reports ("customerEmail", day);
create index if not exists fal_reports_created on public.fal_reports ("createdAt");
alter table public.fal_reports enable row level security;

insert into public._migrations (name) values ('20260923221000_fal_reports.sql')
  on conflict (name) do nothing;
