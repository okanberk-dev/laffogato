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

-- ─────────────────────────────────────────────────────────────────────
-- 20260923230100_drop_legacy_campaign_email_overloads.sql
-- ─────────────────────────────────────────────────────────────────────
-- Drops the two compatibility overloads 20260908170000_campaign_email_reconsent
-- kept "for one release": the three-argument campaign_email_claim wrapper and
-- the six-argument campaign_email_mark from 20260908150000_campaign_emails.
--
-- They existed only for a runner of the build before 8 Sep 2026 that was still
-- inside after() when the reconsent migration landed. Every build since calls
-- the four-argument claim (p_posted_before) and the seven-argument mark
-- (p_claimed_at) - src/lib/email/campaigns.ts claimBatch / markBatch - so the
-- old signatures have had no caller for many releases.
--
-- The old mark is worse than dead: it settles every 'sending' row of a batch
-- whoever claimed it, so a stalled runner calling it could mark as sent rows
-- another runner is still delivering. Nothing calls it today; dropping it
-- makes sure nothing can.
--
-- Idempotent: `if exists`, and the exact argument types, so the current
-- four- and seven-argument functions are untouched. When the whole bundle is
-- replayed (bootstrap, db/schema.sql by hand) the earlier files re-create the
-- overloads and this file drops them again, so the end state is the same.

drop function if exists public.campaign_email_claim(text, text, text);

drop function if exists public.campaign_email_mark(
  text, integer, text, jsonb, text, text
);

insert into public._migrations (name) values ('20260923230100_drop_legacy_campaign_email_overloads.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260923230200_payment_trx_date.sql
-- ─────────────────────────────────────────────────────────────────────
-- The POS's own calendar day for a payment, on the payment row.
--
-- PayNkolay's cancel/refund service requires the transaction date (trxDate,
-- docs/PAYNKOLAY.md §3) and nothing stored it, so every refund first searched
-- the reporting service month by month, up to 13 windows back, for the
-- REFERENCE_CODE (§14.5). The verification query that settles a payment
-- already returns TRX_DATE; applyPaymentSucceeded now writes it here as
-- `YYYY-MM-DD` and the refund reads it first. '' means "not known": rows
-- written before this file, and providers that report no date. The refund
-- falls back to the search for those, exactly as before.
--
-- Additive and idempotent: a constant default makes the column add a catalog
-- change only, and `if not exists` makes a replay a no-op.

alter table public.payment_transactions
  add column if not exists "trxDate" text not null default '';

insert into public._migrations (name) values ('20260923230200_payment_trx_date.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260923230300_email_suppressions.sql
-- ─────────────────────────────────────────────────────────────────────
-- Bounce and complaint suppression for commercial mail (docs/AUDIT.md,
-- "İYS kaydı, bounce/şikâyet bastırma listesi ... açık").
--
-- Resend reports a permanent bounce (email.bounced) and a spam complaint
-- (email.complained) over a Svix-signed webhook, POST /api/webhooks/resend.
-- The route records the address here; the campaign audience and the birthday
-- greeting's commercial flag leave it out from then on. Mailing a dead
-- address again hurts the sending domain's reputation for every member, and
-- mailing someone who marked the last campaign as spam is the complaint the
-- law and the inbox providers both punish.
--
-- Scope is COMMERCIAL mail only. Order, shipping and password mail are not
-- read through these functions and are not affected: a person who flagged a
-- campaign still gets their receipt.
--
-- Inert until the operator sets RESEND_WEBHOOK_SECRET and registers the
-- endpoint in the Resend dashboard: with the table empty, both functions
-- below return exactly what they returned before.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- ── email_suppressions ──────────────────────────────────────────────────
-- One row per address (lower-cased). `reason` is the latest event's kind,
-- 'bounced' or 'complained'; either one suppresses. `createdAt` is the first
-- event, `updatedAt` the latest - the retention sweep measures from the
-- latest, so an address that keeps bouncing keeps its row.
create table if not exists public.email_suppressions (
  email             text primary key,
  reason            text not null default '',
  detail            text not null default '',
  "providerEventId" text not null default '',
  "providerEmailId" text not null default '',
  "createdAt"       text not null default '',
  "updatedAt"       text not null default ''
);

create index if not exists email_suppressions_updated_idx
  on public.email_suppressions ("updatedAt");

alter table public.email_suppressions enable row level security;

-- ── email_suppression_record ────────────────────────────────────────────
-- Upsert that keeps the first-seen time. The query builder's upsert writes
-- every column it is given, which would move createdAt on each repeat event.
-- A replayed webhook (same svix-id) changes nothing but updatedAt.
create or replace function public.email_suppression_record(
  p_email text,
  p_reason text,
  p_detail text,
  p_event_id text,
  p_email_id text,
  p_now text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_reason not in ('bounced', 'complained') then
    raise exception 'email_suppression_record: unknown reason %', p_reason;
  end if;
  if coalesce(btrim(p_email), '') = '' then
    return;
  end if;
  insert into public.email_suppressions as x
    (email, reason, detail, "providerEventId", "providerEmailId",
     "createdAt", "updatedAt")
  values
    (lower(btrim(p_email)), p_reason, left(coalesce(p_detail, ''), 300),
     coalesce(p_event_id, ''), coalesce(p_email_id, ''), p_now, p_now)
  on conflict (email) do update
     set reason            = excluded.reason,
         detail            = excluded.detail,
         "providerEventId" = excluded."providerEventId",
         "providerEmailId" = excluded."providerEmailId",
         "updatedAt"       = excluded."updatedAt";
end;
$$;

-- ── campaign_email_audience ─────────────────────────────────────────────
-- THE audience rule from 20260908170000_campaign_email_reconsent, unchanged
-- but for the last line: a suppressed address is not named. The count, the
-- enqueue and the claim all read this function, so a suppression that lands
-- after a campaign was queued is honoured when its batch is claimed (the row
-- is skipped with the usual "kitle dışına çıktı" reason).
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
     where not exists (
       select 1
         from public.email_suppressions x
        where x.email = e.email
     )
     order by e.email, (e.kind = 'customer') desc;
end;
$$;

-- ── birthday_greeting_audience ──────────────────────────────────────────
-- As in 20260916140000_birthday_mail_and_scheduled_campaigns, but the
-- `marketing` flag (= "may be sent the greeting mail") is false for a
-- suppressed address. The coupon is an account right, not a message, and is
-- still granted: the row stays in the result.
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
            and c."marketingConsentAt" <> ''
            and not exists (
              select 1
                from public.email_suppressions x
               where x.email = lower(c.email)
            )) as marketing
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

insert into public._migrations (name) values ('20260923230300_email_suppressions.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260923230400_customer_consents.sql
-- ─────────────────────────────────────────────────────────────────────
-- An append-only ledger of a member's commercial-message consent.
--
-- `customers."notificationPrefs"` (+ `marketingConsentAt`) is the READ model:
-- what the member wants now, and what the campaign audience reads. It keeps
-- no history. Switching `marketing` off cleared `marketingConsentAt`, so a
-- withdrawal left no record at all, and a grant recorded neither where it
-- came from nor the request's IP. The published Veri Saklama ve İmha
-- Politikası promises both: the consent record for three years after it
-- stops being valid, and the "ret kaydı" (withdrawal record) for as long, so
-- the same address is not mailed again.
--
-- One row per change of one purpose ('marketing' | 'newsletter'): who (the
-- member's address), what (granted true/false), from where (`source`: the
-- surface that made the change), the request's IP and browser/app string
-- when the member made it, the version of the text the grant refers to, and
-- when - the fields the Ticari Elektronik İleti ve İYS Aydınlatması says are
-- recorded for every consent. Nothing reads it
-- to decide who gets mail - the read model stays the only input to the
-- audience, so no mobile contract changes.
--
-- Rows are never updated (a trigger refuses it). The only delete is the
-- retention sweep, through customer_consents_retention() below.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

create table if not exists public.customer_consents (
  id              bigint generated always as identity primary key,
  "customerEmail" text    not null,
  purpose         text    not null,
  granted         boolean not null,
  source          text    not null default '',
  ip              text    not null default '',
  "userAgent"     text    not null default '',
  "textVersion"   text    not null default '',
  "createdAt"     text    not null default ''
);

create index if not exists customer_consents_member_idx
  on public.customer_consents ("customerEmail", purpose, id);

alter table public.customer_consents enable row level security;

-- ── append-only ─────────────────────────────────────────────────────────
create or replace function public.customer_consents_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'customer_consents is append-only' using errcode = 'P0001';
end;
$$;

drop trigger if exists customer_consents_no_update on public.customer_consents;
create trigger customer_consents_no_update
  before update on public.customer_consents
  for each row execute function public.customer_consents_append_only();

-- ── customer_consents_retention ─────────────────────────────────────────
-- The published period, as a query: "onayın geçerliliğinin sona erdiği
-- tarihten itibaren 3 yıl; onayın geri alınması hâlinde ret kaydı ... bu
-- süre boyunca tutulur". A row's consent ended when a withdrawal for the same
-- address and purpose was appended at or after it (the withdrawal itself
-- included), so a row goes once such a withdrawal is older than p_cutoff.
-- A consent that still stands (no withdrawal after it) is never in scope,
-- however old it is: it is the proof the member's mail rests on.
--
-- `id` orders the ledger (identity, append-only), not `createdAt`: two rows
-- written in the same millisecond still have an order. A withdrawal with no
-- stamp ('' sorts first) never ends anything.
--
-- p_apply false counts only; true deletes and returns how many went.
create or replace function public.customer_consents_retention(
  p_cutoff text,
  p_apply boolean
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  affected integer := 0;
begin
  if p_apply then
    delete from public.customer_consents c
     where exists (
       select 1
         from public.customer_consents w
        where w."customerEmail" = c."customerEmail"
          and w.purpose = c.purpose
          and not w.granted
          and w.id >= c.id
          and w."createdAt" <> ''
          and w."createdAt" < p_cutoff
     );
    get diagnostics affected = row_count;
  else
    select count(*) into affected
      from public.customer_consents c
     where exists (
       select 1
         from public.customer_consents w
        where w."customerEmail" = c."customerEmail"
          and w.purpose = c.purpose
          and not w.granted
          and w.id >= c.id
          and w."createdAt" <> ''
          and w."createdAt" < p_cutoff
     );
  end if;
  return affected;
end;
$$;

insert into public._migrations (name) values ('20260923230400_customer_consents.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260923230500_hyphen_only_live_text.sql
-- ─────────────────────────────────────────────────────────────────────
-- One dash only: the hyphen (operator's rule, 22 Sep 2026).
--
-- The app's own text was swept on 22 Sep; the ten long dashes left on screen
-- came from this database. Re-counted on the live read-only endpoints on
-- 23 Sep 2026: /api/mobile/v1/shop 7 (product names), /menu 1 (the
-- Cappuccino description), /story 1 (the 2008 milestone), /app-content 1
-- (the "Sabah ritüeli" post), /bootstrap 0. The same rows feed the site
-- (/magaza, /menu, /hikayemiz) and the panel.
--
-- Each dash becomes "-" and the spaces around it stay as they are, so
-- "Sirena <em dash> Espresso Harmanı" reads "Sirena - Espresso Harmanı" and
-- "09:00<en dash>11:00" reads "09:00-11:00".
--
-- SAFE and IDEMPOTENT, like 20260922120000_turkish_catalogue_names: a row is
-- changed only when its id (the story row: its year) AND its whole current
-- value are exactly what was measured. A row the operator already edited is
-- left alone; a second run matches nothing. The old values are spelled with
-- chr(8212) (em dash) and chr(8211) (en dash) so this file itself carries
-- only hyphens.
--
-- 20260922120000 renames prd-0006 and prd-0011 to the em-dash spelling when
-- it finds the hyphen one. Only a replay of the whole bundle runs it again
-- (bootstrap, a hand apply of db/schema.sql), and this file runs after it in
-- the same replay, so the end state is the hyphen spelling either way.
--
-- Rollback: a migration that sets the old values back under the same keys.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- ── products.name (7) ───────────────────────────────────────────────────
update public.products
   set name = 'Sirena - Espresso Harmanı'
 where id = 'prd-0001'
   and name = 'Sirena ' || chr(8212) || ' Espresso Harmanı';

update public.products
   set name = 'Notturna - Filtre Lotu'
 where id = 'prd-0002'
   and name = 'Notturna ' || chr(8212) || ' Filtre Lotu';

update public.products
   set name = 'Yenilebilir Kup - 6''lı Kutu'
 where id = 'prd-0003'
   and name = 'Yenilebilir Kup ' || chr(8212) || ' 6''lı Kutu';

update public.products
   set name = 'Affogato Seti - İki Kişilik'
 where id = 'prd-0004'
   and name = 'Affogato Seti ' || chr(8212) || ' İki Kişilik';

update public.products
   set name = 'Uji Matcha - Seremoni Sınıfı'
 where id = 'prd-0005'
   and name = 'Uji Matcha ' || chr(8212) || ' Seremoni Sınıfı';

update public.products
   set name = 'Moka - Bialetti × L''Affogato'
 where id = 'prd-0006'
   and name = 'Moka ' || chr(8212) || ' Bialetti × L''Affogato';

update public.products
   set name = 'Cantucci - Bronte Pistachio'
 where id = 'prd-0011'
   and name = 'Cantucci ' || chr(8212) || ' Bronte Pistachio';

-- ── menu_items."desc" (1) ───────────────────────────────────────────────
update public.menu_items
   set "desc" = 'Espresso, buharlı süt ve bol köpük - eşit üç katman.'
 where id = 'mnu-0010'
   and "desc" = 'Espresso, buharlı süt ve bol köpük ' || chr(8212) || ' eşit üç katman.';

-- ── story_timeline.title (1) ────────────────────────────────────────────
-- The public endpoint does not expose the row id, so the key is the year
-- and the whole title. /story trims both before it answers, so they are
-- compared trimmed here, and only the dash is replaced: whatever spacing
-- the row has is kept.
update public.story_timeline
   set title = replace(title, chr(8212), '-')
 where btrim(year) = '2008'
   and btrim(title) = 'Sicily ' || chr(8212) || ' Bronte pistacchio anlaşması';

-- ── app_posts.body (1) ──────────────────────────────────────────────────
update public.app_posts
   set body = 'Hafta içi 09:00-11:00 arası espresso bazlı içeceklerde ikinci kahve yarı fiyatına.'
 where id = 'apost-001'
   and body = 'Hafta içi 09:00' || chr(8211) || '11:00 arası espresso bazlı içeceklerde ikinci kahve yarı fiyatına.';

insert into public._migrations (name) values ('20260923230500_hyphen_only_live_text.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260923235000_order_notice_emails.sql
-- ─────────────────────────────────────────────────────────────────────
-- Order notices: the one-per-event log behind the shipping, cancellation and
-- refund mails.
--
-- The legal texts promise three transactional mails nothing sent: the
-- tracking number when the parcel is handed to the carrier (Teslimat ve
-- Kargo Politikası m.15, Mesafeli Satış Sözleşmesi), word when the seller
-- cancels an order, and word when money goes back. Each of them can be
-- triggered more than once: the Geliver webhook is retried and replayed, a
-- shop owner saves the tracking form twice, a refund is recorded by the
-- panel and reported again by the provider. A mail that says "your parcel
-- left" must still leave once.
--
-- So every notice first CLAIMS its row here - (order, kind) is the primary
-- key, a second claim is a 23505 and sends nothing - and settles it after
-- the provider answers. A failed delivery releases the claim, so the next
-- trigger may try again; a sent one stays for good.
--
-- `kind` is the event: 'cancelled', 'shipped:<hash>' (the tracking number's
-- SHA-256 prefix, so a corrected number is a new notice while the number
-- itself is not stored twice), 'refund:<refund id>' (each partial refund is
-- its own notice). No address and no message body: the order row already
-- holds who, and the template holds what.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

create table if not exists public.order_notice_emails (
  "orderId"   text not null,
  kind        text not null,
  status      text not null default 'sending',
  error       text not null default '',
  "createdAt" text not null default '',
  "sentAt"    text not null default '',
  primary key ("orderId", kind)
);

alter table public.order_notice_emails enable row level security;

insert into public._migrations (name) values ('20260923235000_order_notice_emails.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260924001000_backdrop_fields.sql
-- ─────────────────────────────────────────────────────────────────────
-- Menu items and shop products: the scene family behind the product, whether
-- its photo is a cutout, and the drawn vessel shape (glass round, 24 Sep 2026).
--
-- The app draws every product on a lit scene whose colour comes from the
-- drink itself (lafmobil docs/DESIGN-GLASS.md §6). Today it can only guess
-- that colour from `hue` and the category. When the operator uploads a photo,
-- the panel now reads the drink's body colour from the pixels and stores the
-- nearest of twelve families here, so the app draws the scene the photo
-- actually shows. The operator can override the pick by hand.
--
-- backdrop          text     - one of the twelve product families
--                              (src/lib/backdrop/families.ts); null = no pick,
--                              the app falls back to `hue`, then the category.
-- "backdropSource"  text     - 'auto' (recomputed on every new photo) or
--                              'manual' (the operator's choice, kept across
--                              uploads).
-- "backdropHex"     text     - the colour the pick was made from (#RRGGBB), for
--                              the panel swatch; null when nothing was read.
-- "photoCutout"     boolean  - the stored photo has transparency (a cutout);
--                              the app then draws it on the scene, not in a tile.
-- vessel            text     - the drawn vessel shape the operator chose for a
--                              photo-less item (tumbler, cup, tulip, cloche,
--                              shot, pack); null = from the category.
--
-- On `products` the fields describe `images[0]`, the photo the app shows.
--
-- No enum or check on `backdrop` and `vessel`: both lists may grow, and the
-- mobile mapper already publishes null for any value it does not know.
--
-- Additive and idempotent: existing rows get null / 'auto' / false, which the
-- app reads as "as today". `scripts/backfill-backdrops.mjs` fills existing
-- photos (dry run by default).
--
-- Rollback (only GET /menu, GET /shop and the panel read them):
--   alter table public.menu_items drop column if exists backdrop;
--   alter table public.menu_items drop column if exists "backdropSource";
--   alter table public.menu_items drop column if exists "backdropHex";
--   alter table public.menu_items drop column if exists "photoCutout";
--   alter table public.menu_items drop column if exists vessel;
--   (the same five for public.products)
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.menu_items
  add column if not exists backdrop text;

alter table public.menu_items
  add column if not exists "backdropSource" text not null default 'auto'
    check ("backdropSource" in ('auto', 'manual'));

alter table public.menu_items
  add column if not exists "backdropHex" text;

alter table public.menu_items
  add column if not exists "photoCutout" boolean not null default false;

alter table public.menu_items
  add column if not exists vessel text;

alter table public.products
  add column if not exists backdrop text;

alter table public.products
  add column if not exists "backdropSource" text not null default 'auto'
    check ("backdropSource" in ('auto', 'manual'));

alter table public.products
  add column if not exists "backdropHex" text;

alter table public.products
  add column if not exists "photoCutout" boolean not null default false;

alter table public.products
  add column if not exists vessel text;

insert into public._migrations (name) values ('20260924001000_backdrop_fields.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260926090000_karaoke_price_and_notify.sql
-- ─────────────────────────────────────────────────────────────────────
-- Karaoke: ₺1.000 an hour, and a dedicated address for new requests.
--
-- The operator asked for both on 26 Eyl 2026. The hourly price has always
-- been a settings row (Ayarlar → Karaoke) and stays one; this only moves the
-- live value and the default a fresh database seeds with. Reservations
-- already taken keep the price they were quoted - it is stored on the row.
--
-- "karaokeNotifyEmail" is where `sendKaraokeOperatorEmail` sends a request
-- the moment it is taken, from the app or from the web `/karaoke` form. Until
-- now that notice went to the public contact address (`email`), and only for
-- bookings made in the app. Empty falls back to `email`, so clearing the field
-- in the panel is safe.
--
-- 19 Ekim 2026: the update below runs once. The app replays the whole
-- bundle whenever a deploy adds a migration (src/lib/db/bootstrap.ts), and
-- unguarded it wrote this price and this address back over the panel's
-- values each time. The address itself is cleared by
-- 20261019160000_karaoke_notify_company_mailbox.sql (a personal Gmail inbox
-- abroad, KVKK m.9).
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.settings add column if not exists "karaokeNotifyEmail" text not null default '';
alter table public.settings alter column "karaokeHourlyMinor" set default 100000;

update public.settings
   set "karaokeHourlyMinor" = 100000,
       "karaokeNotifyEmail" = 'bizimfutbol9@gmail.com'
 where not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20260926090000_karaoke_price_and_notify.sql'
   );

insert into public._migrations (name) values ('20260926090000_karaoke_price_and_notify.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260926100000_clear_default_seo_title.sql
-- ─────────────────────────────────────────────────────────────────────
-- The home page reads settings."seoTitle" first and falls back to its own
-- keyword title ("Tuzla'da İtalyan Kahve, Affogato & Gelato - L'Affogato").
-- The seeded default was the short "L'Affogato - Tuzla", so the fallback was
-- never reached and the home page ranked on an 18-character title. Clear the
-- value only where it is still that untouched default; an operator's own
-- title stays.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

update public.settings
   set "seoTitle" = ''
 where "seoTitle" = 'L''Affogato - Tuzla';

insert into public._migrations (name) values ('20260926100000_clear_default_seo_title.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20260926110000_karaoke_contact_consent.sql
-- ─────────────────────────────────────────────────────────────────────
-- Karaoke: who to reach about a booking, and their permission to be reached.
--
-- The operator asked (26 Eyl 2026) that a web booking carry a name, an
-- e-mail and a phone, with the member's consent to be contacted about it:
-- a cancelled or moved evening has to reach someone. The account's own
-- e-mail stays in "customerEmail" (it scopes "my reservations" and the
-- two-open-bookings cap); these are the contact details given on the form.
--
-- Empty on rows written before this and on bookings from the app, which does
-- not send them (the mobile contract is unchanged).
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.karaoke_reservations add column if not exists "contactEmail"     text not null default '';
alter table public.karaoke_reservations add column if not exists "contactPhone"     text not null default '';
alter table public.karaoke_reservations add column if not exists "contactConsentAt" text not null default '';

insert into public._migrations (name) values ('20260926110000_karaoke_contact_consent.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261014173600_fal_reading_seat.sql
-- ─────────────────────────────────────────────────────────────────────
-- fA'L daily quota: the seat is taken in SQL, under a per-member lock.
--
-- POST /api/mobile/v1/fal counted today's readings, asked the model (a paid
-- OpenAI call, seconds long) and wrote the reading's row only after the
-- answer, so a burst of parallel requests all read "2 of 3" and every one of
-- them was paid for. Ranking an inserted row among the member's rows by id
-- narrowed that window but did not close it: an earlier id can still be
-- uncommitted when a later one ranks itself, and six parallel requests
-- against a real Postgres let a fourth through about once in twenty runs
-- (tests/db-integration-fal-seat.test.ts).
--
-- reserve_fal_reading takes a transaction-level advisory lock on the member
-- and the Istanbul day, counts, and inserts only under the limit, in one
-- statement (CLAUDE.md rules 20 and 30): the next caller for the same member
-- waits for the lock, and its count sees the row this one committed.
-- Returns jsonb {id, used} (rpc() reads one cell; `used` is how many seats
-- were taken before this one), or null when the day's seats are gone.
--
-- Additive and idempotent: a new function, no table change.
create or replace function public.reserve_fal_reading(
  p_email      text,
  p_day        text,
  p_limit      integer,
  p_created_at text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_used integer;
  v_id   bigint;
begin
  perform pg_advisory_xact_lock(hashtext('fal-seat:' || p_email || ':' || p_day));
  select count(*) into v_used
    from public.fal_readings
   where "customerEmail" = p_email
     and day = p_day;
  if v_used >= p_limit then
    return null;
  end if;
  insert into public.fal_readings ("customerEmail", day, "createdAt", model, "cupSeen")
  values (p_email, p_day, p_created_at, '', false)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'used', v_used);
end;
$$;

insert into public._migrations (name) values ('20261014173600_fal_reading_seat.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261014224120_wallet_ledger.sql
-- ─────────────────────────────────────────────────────────────────────
-- Wallet ledger and paying an app order from it (docs/API-MOBILE.md §18).
--
-- §18 promised `POST /orders` with `"payWithWallet": true` - the balance pays
-- the whole order or nothing (409 `insufficient_balance`, no order, no partial
-- charge) - but nothing on the server held a balance at all. This adds the
-- ledger the promise needs and the one function that spends from it.
--
-- The balance is never stored: it is the sum of the member's rows. A stored
-- balance would be a counter updated in JavaScript, which is exactly the
-- read-modify-write that loses writes under concurrency (CLAUDE.md rule 20).
-- `amountMinor` is signed: a top-up or a refund is positive, a spend negative.
--
-- Additive and idempotent: a new table, two partial unique indexes and a new
-- function. No existing table changes.

create table if not exists public.wallet_transactions (
  id              text primary key
                    default ('wtx_' || replace(gen_random_uuid()::text, '-', '')),
  "customerEmail" text   not null,
  kind            text   not null
                    check (kind in ('topup', 'spend', 'refund', 'bonus', 'expiry', 'adjust')),
  "amountMinor"   bigint not null,
  "bonusMinor"    bigint not null default 0,
  title           text   not null default '',
  "orderId"       text   not null default '',
  -- The order's refund ledger entry this row credits back (`orders.refunds[].id`).
  "refundId"      text   not null default '',
  "createdAt"     text   not null default ''
);

create index if not exists wallet_transactions_customer_idx
  on public.wallet_transactions ("customerEmail", "createdAt" desc);

-- One spend per order: a replayed placement can never charge twice.
create unique index if not exists wallet_transactions_order_spend_key
  on public.wallet_transactions ("orderId")
  where kind = 'spend';

-- One credit per refund entry: a retried admin refund credits once.
create unique index if not exists wallet_transactions_refund_key
  on public.wallet_transactions ("orderId", "refundId")
  where kind = 'refund';

alter table public.wallet_transactions enable row level security;

-- Inserts the order AND its spend in ONE transaction, or neither.
--
-- `p_order` is the order row exactly as the store would insert it (camelCase
-- keys = column names). Only the keys present are written, so every other
-- column keeps its default - the same thing the query builder's INSERT does.
-- The amount is the row's own `totalMinor`, never a separate argument, so the
-- spend cannot drift from what the order costs.
--
-- A transaction-level advisory lock on the member serialises two checkouts of
-- the same wallet: the second one waits, and its sum sees the spend the first
-- one committed. Without it both would read the same balance and both spend it.
--
-- Returns true when the order was placed and paid from the wallet, false when
-- the balance does not cover it (nothing is written). Errors from the order
-- insert (the pending-order cap trigger, a duplicate clientOrderId) propagate
-- and roll the whole call back.
create or replace function public.wallet_place_order(
  p_order      jsonb,
  p_title      text,
  p_created_at text
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_email   text   := lower(btrim(coalesce(p_order->>'customerEmail', '')));
  v_order   text   := coalesce(p_order->>'id', '');
  v_amount  bigint := (p_order->>'totalMinor')::bigint;
  v_balance bigint;
  v_cols    text;
begin
  if v_email = '' or v_order = '' or v_amount is null or v_amount <= 0 then
    raise exception 'WALLET_BAD_ORDER';
  end if;

  perform pg_advisory_xact_lock(hashtext('wallet:' || v_email));

  select coalesce(sum("amountMinor"), 0) into v_balance
    from public.wallet_transactions
   where "customerEmail" = v_email;
  if v_balance < v_amount then
    return false;
  end if;

  select string_agg(quote_ident(k), ', ') into v_cols
    from jsonb_object_keys(p_order) as k;
  execute format(
    'insert into public.orders (%1$s) select %1$s from jsonb_populate_record(null::public.orders, $1)',
    v_cols
  ) using p_order;

  insert into public.wallet_transactions
    ("customerEmail", kind, "amountMinor", title, "orderId", "createdAt")
  values
    (v_email, 'spend', -v_amount, coalesce(p_title, ''), v_order, p_created_at);
  return true;
end;
$$;

insert into public._migrations (name) values ('20261014224120_wallet_ledger.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261015050817_staff_members.sql
-- ─────────────────────────────────────────────────────────────────────
-- App members who may stamp at the till from the mobile app (barista).
--
-- The panel's `cashier` role is an admin account: a password, the panel, the
-- till page on a shared device. A barista behind the bar already has the app
-- signed in with their own member account, and scanning the member's QR from
-- that phone needs no second login - only the panel's say-so. This table is
-- that say-so: one row per member address, granted and revoked from
-- /admin/kullanicilar.
--
-- Revoking sets "isActive" = false rather than deleting, so the panel can
-- still show who held the till and who took it away. `role` has one value
-- today; the check keeps a typo from becoming a role nothing understands.
--
-- Additive and idempotent: a new table, no existing table changes.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

create table if not exists public.staff_members (
  -- The member's `customers.email`, lower-cased.
  email       text    primary key,
  role        text    not null default 'barista' check (role in ('barista')),
  "isActive"  boolean not null default true,
  -- The admin who granted (or last re-granted) the row; revocations are in
  -- audit_logs.
  "grantedBy" text    not null default '',
  "grantedAt" text    not null default '',
  "updatedAt" text    not null default ''
);
alter table public.staff_members enable row level security;

insert into public._migrations (name) values ('20261015050817_staff_members.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261015060020_exact_email_indexes.sql
-- ─────────────────────────────────────────────────────────────────────
-- Plain btree indexes for the member lookups that compare the stored e-mail
-- exactly.
--
-- Every one of these tables already has an index on lower(<email column>),
-- but the code reads them with `"col" = $1` (the value is normalised to
-- lower case before the query). Postgres only uses an expression index for
-- the same expression, so each of these reads was a sequential scan of the
-- whole table:
--
--   customers.email          - supabase-bridge fetchRaw, on EVERY bearer
--                              request (requireMobileCustomer -> finishLink),
--                              plus the customer store and the invite names
--   loyalty_stamps           - listStamps: /me, /orders, /notifications
--   customer_coupons         - /coupons, checkout redeem/release
--   counter_tokens           - /me/counter-token (open tokens, issue window)
--   invites."inviterEmail"   - /me invite summary (no index at all before)
--   invites."inviteeEmail"   - invite reward on a member's first paid order
--   newsletter_subscribers   - PATCH /me newsletter toggle, unsubscribe
--
-- Measured on a local Postgres 16 with 20k customers, 200k stamps, 60k
-- coupons, 30k invites, 100k counter tokens (EXPLAIN ANALYZE, one member):
-- see the commit body for the before/after plans.
--
-- Why indexes and not `lower(col) = lower($1)` in the queries: the indexes
-- leave every result exactly as it is today. Switching the predicates would
-- also start matching rows stored with upper-case letters, which changes a
-- member's stamp count or coupon list - a behaviour change, not a speed-up.
--
-- Safe on a live table: `if not exists`, additive, no constraint, so it can
-- never fail on existing data. NOT `concurrently`: both scripts/db-migrate.mjs
-- and the app's self-bootstrap (src/lib/db/bootstrap.ts) run each migration
-- inside a transaction, where CREATE INDEX CONCURRENTLY is refused. These
-- tables are small enough (thousands to low hundreds of thousands of rows)
-- that the brief SHARE lock of a plain build is the lesser cost.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

create index if not exists customers_email_exact_idx
  on public.customers (email);

create index if not exists loyalty_stamps_owner_created_idx
  on public.loyalty_stamps ("customerEmail", "createdAt");

create index if not exists customer_coupons_owner_created_idx
  on public.customer_coupons ("customerEmail", "createdAt");

create index if not exists counter_tokens_owner_created_idx
  on public.counter_tokens ("customerEmail", "createdAt");

create index if not exists invites_inviter_created_idx
  on public.invites ("inviterEmail", "createdAt");

create index if not exists invites_invitee_exact_idx
  on public.invites ("inviteeEmail");

create index if not exists newsletter_subscribers_email_exact_idx
  on public.newsletter_subscribers (email);

insert into public._migrations (name) values ('20261015060020_exact_email_indexes.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261015180437_cafe_tables_and_order_notify.sql
-- ─────────────────────────────────────────────────────────────────────
-- Cafe tables with QR codes, table orders from the app, and the staff
-- "new order" e-mail.
--
-- 1. public.cafe_tables - one row per table in the köşk. `code` is the
--    random 10-character Crockford base32 value printed on the table's QR
--    (https://laffogato.net/masa/<code>); the server generates it, the panel
--    can rotate it ("Kodu yenile", `rotatedAt`) when a card is photographed
--    and abused. Tables are never deleted: `isActive = false` keeps the row,
--    so an old order's snapshot and the audit log still make sense.
--
-- 2. orders."tableCode" / "tableName" - a SNAPSHOT of the table an app cafe
--    order with `fulfillment = 'table'` was placed at. Copied at creation, so
--    renaming or rotating a table later does not rewrite history. '' on every
--    other order.
--
-- 3. settings."orderNotify*" - who is mailed when an order is paid:
--    a switch, the panel roles whose accounts receive it, and free-form
--    extra addresses (comma or newline separated, validated by the panel).
--
-- Additive and idempotent: a new table, new columns with defaults.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

create table if not exists public.cafe_tables (
  id          text    primary key,
  code        text    not null unique,
  name        text    not null,
  "sortOrder" integer not null default 0,
  "isActive"  boolean not null default true,
  "createdAt" text    not null default '',
  "updatedAt" text    not null default '',
  "rotatedAt" text    not null default ''
);
alter table public.cafe_tables enable row level security;

alter table public.orders add column if not exists "tableCode" text not null default '';
alter table public.orders add column if not exists "tableName" text not null default '';

alter table public.settings add column if not exists "orderNotifyEnabled" boolean not null default true;
alter table public.settings add column if not exists "orderNotifyRoles" jsonb not null default '["owner","manager","cashier"]'::jsonb;
alter table public.settings add column if not exists "orderNotifyEmails" text not null default '';

insert into public._migrations (name) values ('20261015180437_cafe_tables_and_order_notify.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261016063311_karaoke_prepay.sql
-- ─────────────────────────────────────────────────────────────────────
-- Karaoke: the room is paid for online when it is booked (PayNkolay).
--
-- Operator, 16 Eki 2026: "Karaokede de ödeme alsın". A web booking, and an
-- app booking that opts in with `prepay: true` (docs/API-MOBILE.md §7), is
-- paid by card the moment it is made, and the payment confirms it on its own.
-- The hour is held while the member pays; an unpaid hold lapses after the POS
-- was asked (`expireUnpaidReservations`, CLAUDE.md rule 29) and frees the hour.
--
-- `status` keeps its three values on purpose. `requested` already holds the
-- hour in the JS check, in `karaoke_reservations_no_overlap` (status <>
-- 'cancelled') and in the `karaoke_open_cap` trigger, and every app build
-- reads an unknown status as "requested". The payment lives beside it:
--
--   "paymentStatus"  none       pay at the venue: rows from before this, the
--                               panel's switch off, app builds that do not
--                               opt in
--                    pending    hold waiting for its payment (status requested)
--                    paid       collected; the booking is then confirmed
--                    refunding  a refund was started and is not settled - a
--                               POS that did not answer is not "refunded"
--                    refunded   the money went back (status cancelled)
--                    expired    the hold lapsed unpaid (status cancelled)
--   "paymentDueAt"   when the newest payment page stops taking the card
--   "paidAt" "refundedAt" "paidMinor"
--   "paymentRef"     the provider reference of THE payment that paid the row.
--                    Any other succeeded payment for the same reservation is
--                    a second charge and is sent back (karaoke-payment.ts).
--   channel          'web' | 'app' ('' on older rows): where the payment
--                    return sends the member - decided by the row, never by a
--                    query string anyone can type
--   "legalConsent"   the pre-information and contract confirmation, in the
--                    shape of orders."legalConsent" (MSY m.7; kept 3 years,
--                    m.20)
--   guest            true for a web booking made without an account
--                    (operator, 16 Eki 2026: "üyeliksiz de yapabilsinler").
--                    "customerEmail" then holds the contact address only so
--                    the per-address cap below covers it; the row never
--                    shows in a member's list, inbox or loyalty tier, and it
--                    is reached through a signed link (karaoke-link.ts).
--
-- Payment rows reuse payment_transactions with "orderId" = the reservation id
-- (the `krk-` namespace, `isKaraokeRef`); that column has no foreign key.
--
-- settings."karaokePrepay" is the panel's switch (Ayarlar → Karaoke). On by
-- default; off brings back the pay-at-the-venue request flow.
--
-- Safe on a live table: every column is added with a default every existing
-- row satisfies, and both checks hold for 'none'.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.karaoke_reservations add column if not exists "paymentStatus" text    not null default 'none';
alter table public.karaoke_reservations add column if not exists "paymentDueAt"  text    not null default '';
alter table public.karaoke_reservations add column if not exists "paidAt"        text    not null default '';
alter table public.karaoke_reservations add column if not exists "refundedAt"    text    not null default '';
alter table public.karaoke_reservations add column if not exists "paidMinor"     integer not null default 0;
alter table public.karaoke_reservations add column if not exists "paymentRef"    text    not null default '';
alter table public.karaoke_reservations add column if not exists channel         text    not null default '';
alter table public.karaoke_reservations add column if not exists "legalConsent"  jsonb;
alter table public.karaoke_reservations add column if not exists guest           boolean not null default false;

-- The six values, and the two facts every payment state implies about the
-- booking: a hold waiting for its money is still a request, and money that
-- lapsed or went back leaves no booking behind. A code path that moved one
-- column without the other would otherwise strand an hour (held but never
-- swept) or keep a slot for a refunded evening.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'karaoke_reservations_payment_status_check'
       and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_payment_status_check
      check ("paymentStatus" in
        ('none', 'pending', 'paid', 'refunding', 'refunded', 'expired'));
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'karaoke_reservations_payment_state_check'
       and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_payment_state_check
      check (
        ("paymentStatus" <> 'pending' or status = 'requested')
        and ("paymentStatus" not in ('expired', 'refunded')
             or status = 'cancelled')
      );
  end if;
end $$;

-- The sweep reads the oldest unpaid holds; the check above makes every
-- pending row a live request, so the predicate needs no status term.
create index if not exists karaoke_reservations_unpaid_hold_idx
  on public.karaoke_reservations ("paymentDueAt")
  where "paymentStatus" = 'pending';

alter table public.settings add column if not exists "karaokePrepay" boolean not null default true;

-- The open-bookings cap, now also per phone number for guest bookings. A
-- guest has no verified address: the same person could otherwise hold the
-- room under a fresh e-mail each time. Same lock-then-count shape as the
-- e-mail branch (20260923110000_atomic_caps_and_refunds.sql), so two guest
-- bookings with one number cannot both pass at the same instant.
--
-- Guest and member rows are counted APART: a guest types an address it
-- does not have to own, and two guest holds under a member's address must
-- not lock that member out of their own two bookings. Member rows (guest =
-- false, which every row before this migration is) count exactly as before.
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
    hashtext('karaoke-open-cap:' || case when new.guest then 'guest:' else '' end
             || lower(new."customerEmail")));
  today := to_char((now() at time zone 'Europe/Istanbul')::date, 'YYYY-MM-DD');
  select count(*) into open_count
    from public.karaoke_reservations
   where lower("customerEmail") = lower(new."customerEmail")
     and guest = new.guest
     and status <> 'cancelled'
     and date >= today;
  if open_count >= 2 then  -- KARAOKE_OPEN_CAP
    raise exception 'TOO_MANY_OPEN_RESERVATIONS' using errcode = 'P0001';
  end if;
  if new.guest and new."contactPhone" <> '' then
    perform pg_advisory_xact_lock(
      hashtext('karaoke-open-cap-phone:' || new."contactPhone"));
    select count(*) into open_count
      from public.karaoke_reservations
     where guest
       and "contactPhone" = new."contactPhone"
       and status <> 'cancelled'
       and date >= today;
    if open_count >= 2 then  -- KARAOKE_OPEN_CAP
      raise exception 'TOO_MANY_OPEN_RESERVATIONS' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

insert into public._migrations (name) values ('20261016063311_karaoke_prepay.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261017100000_admin_order_management.sql
-- ─────────────────────────────────────────────────────────────────────
-- Admin order management (17 Eki 2026): the rules the order screens enforce
-- on the server, and the columns behind the order list's filters.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- ── Indexes the order page reads by ─────────────────────────────────────
-- The order page lists an order's audit rows, stock movements and payment
-- rows. Each of those was a sequential scan of its whole table.
create index if not exists audit_logs_entity_id_idx
  on public.audit_logs (entity, "entityId");
create index if not exists stock_moves_order_idx
  on public.stock_moves ("orderId");
create index if not exists payment_transactions_order_idx
  on public.payment_transactions ("orderId");

-- ── orders.attention ──────────────────────────────────────────────────────
-- Something on the order needs a human:
--   amount_mismatch    the POS collected a different amount
--   order_not_open     a payment landed on a cancelled or refunded order
--   duplicate_payment  a second charge on an order that was already paid
--   refund_due         cancelled after money was taken, and not refunded yet
--   refund_unknown     the POS did not answer a refund: it may have gone through
-- '' = nothing to look at. The first three lived only in an audit row
-- (noteUnreconciledPayment) that nobody opened; the order list's "Dikkat"
-- filter and the red banner on the order page read this column now.
alter table public.orders
  add column if not exists attention text not null default '';
create index if not exists orders_attention_idx
  on public.orders ("orderNo")
  where attention <> '';

-- ── orders.source ─────────────────────────────────────────────────────────
-- 'manual' for an order typed into the panel (createManualOrder), '' for
-- every other order. A manual "Ödeme bekleniyor" order has no POS payment
-- behind it, and the 45-minute sweep used to cancel it and hand its stock
-- back without telling anyone. The sweep skips it now.
alter table public.orders
  add column if not exists source text not null default '';

-- Manual orders written before the column: their creation's audit row says
-- so (createManualOrderAction logs `payload.manual = true`).
update public.orders o
   set source = 'manual'
 where o.source = ''
   and exists (
     select 1
       from public.audit_logs a
      where a.entity = 'order'
        and a.action = 'create'
        and a."entityId" = o.id
        and a.payload ->> 'manual' = 'true'
   );

-- ── credit_product_stock ──────────────────────────────────────────────────
-- Gives `p_qty` units back to a product (and to its variant's JSONB stock).
-- Returns the product's stock after the credit, or NULL when the product row
-- is gone. Shared by the two functions below.
create or replace function public.credit_product_stock(
  p_product_id text,
  p_variant_id text,
  p_qty        int,
  p_now        text
)
returns int
language plpgsql
set search_path = ''
as $$
declare
  new_stock int;
begin
  if coalesce(p_variant_id, '') <> '' then
    update public.products
       set stock = stock + p_qty,
           "updatedAt" = p_now,
           variants = coalesce((
             select jsonb_agg(
               case when v ->> 'id' = p_variant_id
                 then jsonb_set(
                   v, '{stock}', to_jsonb(coalesce((v ->> 'stock')::int, 0) + p_qty))
                 else v end)
               from jsonb_array_elements(variants) v
           ), variants)
     where id = p_product_id
    returning stock into new_stock;
  else
    update public.products
       set stock = stock + p_qty,
           "updatedAt" = p_now
     where id = p_product_id
    returning stock into new_stock;
  end if;
  return new_stock;
end;
$$;

-- ── release_order_inventory ───────────────────────────────────────────────
-- The claim and the stock credit in ONE transaction.
--
-- The store used to flip "stockReleasedAt" with one statement and call
-- release_order_stock with the next. When the second failed, the order was
-- already cancelled and its marker set: the stock was never given back and
-- nothing could retry it. Now either both happen or neither does.
--
-- Every line that took stock is given back what it has not given back yet
-- (`qty` minus `restockedQty`), whatever its line status: a line marked
-- "İptal" on its own changes no stock, so skipping it lost those units for
-- good. Each credited line is stamped `restockedQty = qty`, so a later
-- per-line restock (restock_order_lines) cannot credit it twice.
--
-- `p_restock = false` claims the marker and credits nothing: the operator
-- cancelled a parcel that is already with the carrier.
--
-- Returns NULL when the marker was already set (another call released it),
-- otherwise {"lines": [{index, productId, productName, qty, stockAfter}]}.
create or replace function public.release_order_inventory(
  p_order_id text,
  p_restock  boolean,
  p_now      text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  o_items    jsonb;
  item       jsonb;
  idx        int;
  give       int;
  new_stock  int;
  next_items jsonb := '[]'::jsonb;
  released   jsonb := '[]'::jsonb;
begin
  update public.orders
     set "stockReleasedAt" = p_now
   where id = p_order_id
     and "stockReleasedAt" = ''
  returning coalesce(items, '[]'::jsonb) into o_items;
  if not found then
    return null;
  end if;
  if not p_restock then
    return jsonb_build_object('lines', released);
  end if;

  for item, idx in
    select e.value, (e.n - 1)::int
      from jsonb_array_elements(o_items) with ordinality as e(value, n)
  loop
    give := coalesce((item ->> 'qty')::int, 0)
          - coalesce((item ->> 'restockedQty')::int, 0);
    if coalesce(item ->> 'productId', '') <> '' and give > 0 then
      new_stock := public.credit_product_stock(
        item ->> 'productId', item ->> 'variantId', give, p_now);
      if new_stock is not null then
        item := jsonb_set(item, '{restockedQty}', to_jsonb((item ->> 'qty')::int));
        released := released || jsonb_build_array(jsonb_build_object(
          'index', idx,
          'productId', item ->> 'productId',
          'productName', coalesce(item ->> 'productName', ''),
          'qty', give,
          'stockAfter', new_stock));
      end if;
    end if;
    next_items := next_items || jsonb_build_array(item);
  end loop;

  if jsonb_array_length(released) > 0 then
    update public.orders set items = next_items where id = p_order_id;
  end if;
  return jsonb_build_object('lines', released);
end;
$$;

-- ── restock_order_lines ───────────────────────────────────────────────────
-- Gives chosen lines back to stock: the refund modal's "stoğa geri al".
-- `p_lines` is [{index, qty}]; each line gives at most what it has not given
-- back yet, under the order's row lock, so two refunds of the same line
-- cannot both credit it. Returns NULL for an unknown order, otherwise
-- {"lines": [...]} as release_order_inventory does.
create or replace function public.restock_order_lines(
  p_order_id text,
  p_lines    jsonb,
  p_now      text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  o_items   jsonb;
  req       jsonb;
  idx       int;
  want      int;
  item      jsonb;
  done      int;
  give      int;
  new_stock int;
  released  jsonb := '[]'::jsonb;
begin
  select coalesce(items, '[]'::jsonb) into o_items
    from public.orders
   where id = p_order_id
     for update;
  if not found then
    return null;
  end if;

  for req in select value from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    idx := (req ->> 'index')::int;
    want := coalesce((req ->> 'qty')::int, 0);
    if idx is null or idx < 0 or idx >= jsonb_array_length(o_items) or want <= 0 then
      continue;
    end if;
    item := o_items -> idx;
    done := coalesce((item ->> 'restockedQty')::int, 0);
    give := least(want, coalesce((item ->> 'qty')::int, 0) - done);
    if coalesce(item ->> 'productId', '') = '' or give <= 0 then
      continue;
    end if;
    new_stock := public.credit_product_stock(
      item ->> 'productId', item ->> 'variantId', give, p_now);
    if new_stock is null then
      continue;
    end if;
    o_items := jsonb_set(o_items, array[idx::text, 'restockedQty'], to_jsonb(done + give));
    released := released || jsonb_build_array(jsonb_build_object(
      'index', idx,
      'productId', item ->> 'productId',
      'productName', coalesce(item ->> 'productName', ''),
      'qty', give,
      'stockAfter', new_stock));
  end loop;

  if jsonb_array_length(released) > 0 then
    update public.orders set items = o_items where id = p_order_id;
  end if;
  return jsonb_build_object('lines', released);
end;
$$;

-- ── set_order_item_status ─────────────────────────────────────────────────
-- One line's status, written in place. The panel read the whole items array,
-- changed one line in JavaScript and wrote the array back, so a save that
-- raced a stock release overwrote the release's `restockedQty`. Refused
-- (NULL) for an unknown line, an unknown status, or an order whose status is
-- not in `p_allowed` (a jsonb array of statuses).
create or replace function public.set_order_item_status(
  p_order_id text,
  p_index    int,
  p_status   text,
  p_allowed  jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  out_items jsonb;
begin
  update public.orders o
     set items = jsonb_set(o.items, array[p_index::text, 'status'], to_jsonb(p_status))
   where o.id = p_order_id
     and p_status in ('pending', 'ready', 'cancelled')
     and p_index >= 0
     and p_index < jsonb_array_length(o.items)
     and coalesce(p_allowed, '[]'::jsonb) ? o.status
  returning o.items into out_items;
  return out_items;
end;
$$;

-- ── reserve_order_refund_once ─────────────────────────────────────────────
-- reserve_order_refund with two more guards, in the same single UPDATE:
--
--   · the cap is what was actually collected (`p_cap`), not the order total:
--     a POS that took ₺1 for a ₺500 order must not be asked to refund ₺500;
--   · the refund modal's one-time token (`p_refund ->> 'token'`): a second
--     submit of the same modal - a double click, a retry after a lost
--     answer - finds its token already in the ledger and is refused before
--     the POS is asked again. The entry is only taken back
--     (drop_order_refund) when the POS certainly refunded nothing; one it
--     did not answer for stays, token and amount included.
--
-- Returns the new refunds array, or NULL when refused. The old function
-- stays for the deployment that is still running while this one rolls out.
create or replace function public.reserve_order_refund_once(
  p_order_id text,
  p_refund   jsonb,
  p_cap      int
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
     and least(o."totalMinor", greatest(coalesce(p_cap, 0), 0)) - coalesce((
           select sum((r ->> 'amountMinor')::int)
             from jsonb_array_elements(coalesce(o.refunds, '[]'::jsonb)) r
         ), 0) >= (p_refund ->> 'amountMinor')::int
     and (
       coalesce(p_refund ->> 'token', '') = ''
       or not exists (
         select 1
           from jsonb_array_elements(coalesce(o.refunds, '[]'::jsonb)) r
          where r ->> 'token' = p_refund ->> 'token'
       )
     )
  returning o.refunds into out_refunds;
  return out_refunds;
end;
$$;

insert into public._migrations (name) values ('20261017100000_admin_order_management.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261017120000_menu_photos.sql
-- ─────────────────────────────────────────────────────────────────────
-- Menu photos for 75 of the 79 items that had none (17 Oct 2026).
--
-- Operator, 17 Oct 2026: "menüdeki ürünlere telifsiz görseller bularak hem
-- site hem uygulama tarafında yükle". Each photo is a stock photo released as
-- CC0 or marked Public Domain (commercial use, no attribution required),
-- cropped to a 900 px square WebP in public/menu/. Source, creator and licence
-- for every file: docs/MENU-PHOTOS.md. They show the kind of product, not the
-- one served, and the menu says so next to them ("Görseller temsilidir").
--
-- `image` gets a site-relative path, the same form as the three photos the
-- August menu shipped with (20260827124000_menu_two_sizes_and_photos.sql).
-- The web menu and GET /api/mobile/v1/menu both read this column, so the app
-- shows the photos too. "photoCutout" is false: these are opaque squares,
-- which the app shows in a square tile (round in its small thumbnails), never
-- cut free. The scene family (`backdrop`, "backdropHex") is not set here. A
-- site-relative photo gets it from scripts/backfill-backdrops.mjs (dry run
-- first, then --apply), like the three August photos, which have no pick yet
-- either; until it runs, the app keeps drawing the scene from `hue`, as it
-- does today.
--
-- A row is written only when all three hold:
-- - it has no photo (`image = ''`). A photo the operator uploaded or linked is
--   never replaced.
-- - it still has the name the photo was chosen for. A row renamed or reused
--   for another product since keeps the drawn fallback; the operator can add
--   the file by hand in the panel (the field takes /menu/<file>.webp).
-- - this file has not run before. The bundle (db/schema.sql) re-runs every
--   migration whenever a deploy adds a new one, so without this guard a photo
--   the operator removed in the panel would come back on the next deploy.
--   db:migrate and the bundle both record this file in _migrations after the
--   body runs: the same guard as 20260827124000.
--
-- `updatedAt` is left alone: this is not an edit of the item, and the menu's
-- ETag already changes with the body (as in scripts/backfill-backdrops.mjs).
--
-- Rollback (no schema change): set `image` back to '' on the rows that still
-- carry the path given here, e.g.
--   update public.menu_items set image = ''
--    where id = 'mnu-0004' and image = '/menu/affogato.webp';

update public.menu_items as m
   set image = v.image,
       "photoCutout" = false
  from (
    values
    ('mnu-0004', 'L''Affogato',                  '/menu/affogato.webp'),
    ('mnu-0005', 'Espresso',                     '/menu/espresso.webp'),
    ('mnu-0006', 'Americano',                    '/menu/americano.webp'),
    ('mnu-0007', 'Latte',                        '/menu/caffe-latte.webp'),
    ('mnu-0008', 'Flat White',                   '/menu/flat-white.webp'),
    ('mnu-0009', 'Mocha',                        '/menu/mocha.webp'),
    ('mnu-0010', 'Cappuccino',                   '/menu/cappuccino.webp'),
    ('mnu-0011', 'Espresso Macchiato',           '/menu/espresso-macchiato.webp'),
    ('mnu-0012', 'İspanyol Latte',               '/menu/spanish-latte.webp'),
    ('mnu-0013', 'Cortado',                      '/menu/cortado.webp'),
    ('mnu-0014', 'Beyaz Çikolatalı Mocha',       '/menu/white-chocolate-mocha.webp'),
    ('mnu-0015', 'Karamel Latte',                '/menu/caramel-latte.webp'),
    ('mnu-0016', 'Tuzlu Karamel Latte',          '/menu/salted-caramel-latte.webp'),
    ('mnu-0017', 'Toffeenut Latte',              '/menu/toffee-nut-latte.webp'),
    ('mnu-0018', 'Balkabağı Latte',              '/menu/pumpkin-latte.webp'),
    ('mnu-0019', 'Türk Kahvesi',                 '/menu/turkish-coffee.webp'),
    ('mnu-0020', 'Filtre Kahve',                 '/menu/filter-coffee.webp'),
    ('mnu-0021', 'Buzlu Chai',                   '/menu/iced-chai.webp'),
    ('mnu-0022', 'Buzlu Americano',              '/menu/iced-americano.webp'),
    ('mnu-0023', 'Buzlu Caffè Latte',            '/menu/iced-caffe-latte.webp'),
    ('mnu-0024', 'Buzlu Caffè Mocha',            '/menu/iced-mocha.webp'),
    ('mnu-0025', 'Buzlu Beyaz Çikolatalı Mocha', '/menu/iced-white-mocha.webp'),
    ('mnu-0026', 'Buzlu Tuzlu Karamel Latte',    '/menu/iced-salted-caramel-latte.webp'),
    ('mnu-0027', 'Buzlu Toffeenut Latte',        '/menu/iced-toffee-nut-latte.webp'),
    ('mnu-0028', 'Buzlu Balkabağı Latte',        '/menu/iced-pumpkin-latte.webp'),
    ('mnu-0029', 'Buzlu İspanyol Latte',         '/menu/iced-spanish-latte.webp'),
    ('mnu-0030', 'Cold Brew',                    '/menu/cold-brew.webp'),
    ('mnu-0031', 'Çıtır Latte',                  '/menu/crunchy-latte.webp'),
    ('mnu-0032', 'Sürpriz İçecek',               '/menu/surprise-drink.webp'),
    ('mnu-0033', 'Cool Lime',                    '/menu/cool-lime.webp'),
    ('mnu-0034', 'L''Af Limon',                  '/menu/lemonade.webp'),
    ('mnu-0035', 'Soda',                         '/menu/soda.webp'),
    ('mnu-0036', 'Su',                           '/menu/water.webp'),
    ('mnu-0037', 'Chai Latte',                   '/menu/chai-latte.webp'),
    ('mnu-0038', 'Sıcak Çikolata',               '/menu/hot-chocolate.webp'),
    ('mnu-0039', 'Beyaz Sıcak Çikolata',         '/menu/white-hot-chocolate.webp'),
    ('mnu-0040', 'Karamelli Sıcak Çikolata',     '/menu/caramel-hot-chocolate.webp'),
    ('mnu-0042', 'Çay',                          '/menu/turkish-tea.webp'),
    ('mnu-0043', 'Frappe',                       '/menu/frappe.webp'),
    ('mnu-0044', 'Espresso Frappe',              '/menu/espresso-frappe.webp'),
    ('mnu-0045', 'Mocha Frappe',                 '/menu/mocha-frappe.webp'),
    ('mnu-0046', 'Karamel Frappe',               '/menu/caramel-frappe.webp'),
    ('mnu-0047', 'Yaban Mersini',                '/menu/blueberry-smoothie.webp'),
    ('mnu-0048', 'Mango',                        '/menu/mango-smoothie.webp'),
    ('mnu-0049', 'Elma',                         '/menu/apple-smoothie.webp'),
    ('mnu-0050', 'Protein Shake',                '/menu/protein-shake.webp'),
    ('mnu-0051', 'Çilek',                        '/menu/strawberry-frozen.webp'),
    ('mnu-0052', 'Frambuaz',                     '/menu/raspberry-frozen.webp'),
    ('mnu-0055', 'Limonlu Soğuk Çay',            '/menu/lemon-iced-tea.webp'),
    ('mnu-0056', 'Şeftalili Soğuk Çay',          '/menu/peach-iced-tea.webp'),
    ('mnu-0057', 'Donostia (L''Af Özel)',        '/menu/donostia-cheesecake.webp'),
    ('mnu-0058', 'San Sebastian',                '/menu/san-sebastian-cheesecake.webp'),
    ('mnu-0059', 'Yaban Mersinli San Sebastian', '/menu/blueberry-san-sebastian.webp'),
    ('mnu-0060', 'L''Af Mango',                  '/menu/mango-cake.webp'),
    ('mnu-0061', 'L''Af Kahve',                  '/menu/coffee-cake.webp'),
    ('mnu-0062', 'L''Af Antep Fıstığı',          '/menu/pistachio-cake.webp'),
    ('mnu-0063', 'Çilek Magnolia',               '/menu/strawberry-magnolia.webp'),
    ('mnu-0064', 'Muz Magnolia',                 '/menu/banana-magnolia.webp'),
    ('mnu-0065', 'Lotus Magnolia',               '/menu/lotus-magnolia.webp'),
    ('mnu-0066', 'Marlenka',                     '/menu/marlenka-honey-cake.webp'),
    ('mnu-0067', 'Klasik Spoonful',              '/menu/classic-spoonful.webp'),
    ('mnu-0068', 'Frambuazlı Cheesecake',        '/menu/raspberry-cheesecake.webp'),
    ('mnu-0069', 'Limonlu Cheesecake',           '/menu/lemon-cheesecake.webp'),
    ('mnu-0070', 'Brownie',                      '/menu/brownie.webp'),
    ('mnu-0071', 'Cookie Aşkı (Dondurmalı)',     '/menu/cookie-ice-cream.webp'),
    ('mnu-0072', 'Tiramisu',                     '/menu/tiramisu.webp'),
    ('mnu-0073', 'Karabuğday Simit',             '/menu/simit.webp'),
    ('mnu-0074', 'Rosbeef Sandviç',              '/menu/roast-beef-sandwich.webp'),
    ('mnu-0075', 'Hindi Fümeli Sandviç',         '/menu/smoked-turkey-sandwich.webp'),
    ('mnu-0076', 'Çıtır Granola Bar (Kenya)',    '/menu/granola-bar.webp'),
    ('mnu-0077', 'Hindistan Cevizli Bar',        '/menu/coconut-bar.webp'),
    ('mnu-0078', 'Kakao Protein Bar',            '/menu/cocoa-protein-bar.webp'),
    ('mnu-0079', 'Koska Fındık',                 '/menu/hazelnuts.webp'),
    ('mnu-0081', 'Ekstra Shot',                  '/menu/extra-shot.webp'),
    ('mnu-0082', 'Alternatif Süt',               '/menu/alternative-milk.webp')
  ) as v (id, name, image)
 where m.id = v.id
   and m.name = v.name
   and m.image = ''
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261017120000_menu_photos.sql'
   );

insert into public._migrations (name) values ('20261017120000_menu_photos.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261017150000_kdv_rates.sql
-- ─────────────────────────────────────────────────────────────────────
-- KDV per item, editable in the panel (17 Oct 2026).
--
-- Operator, 17 Oct 2026: "KDV oranlarında da ürünlere özel kdv oranı
-- eklenebilir olsun ... karakoke'de %20 kdv var, menüden sipariş ederlerse %10,
-- ve kahve çekirdeği vs alırlarsa %1 ... panelden düzenlenebilir olsun ve
-- düzenleyince uygulamada da güncellensin". Until now one number,
-- settings."taxRatePct", stood for every sale, and nothing ever showed what
-- it produced. Rules and legal basis: src/lib/utils/kdv.ts.
--
--   settings."taxRates"   jsonb, the default rate per kind of sale:
--                         { menu, karaoke, beans, pantry, gift, gear, merch }.
--                         '{}' reads as the legal defaults (10, 20, 1, 1, 20,
--                         20, 20) key by key, so nothing has to be written
--                         for the live row (normalizeTaxRates).
--   products."taxRatePct"            the product's own rate; NULL = its
--   menu_items."taxRatePct"          category's (menu's) default. Every
--                                    existing row starts NULL, except the
--                                    seeded edible cup box (below).
--   karaoke_reservations."taxRatePct" the karaoke rate the booking was made
--                                    at; NULL on bookings made before this.
--
-- Order lines get their rate inside orders.items (jsonb, `taxRatePct` per
-- line, written by the store when the order is placed), so `orders` itself
-- does not change and neither does wallet_place_order.
--
-- settings."taxRatePct" is no longer read. Kept, like every column: dropping
-- one is never part of a deploy.
--
-- Prices and totals do not change: every price is KDV-included, and the rate
-- only says how much of it is KDV.
--
-- Safe on live tables: nullable columns without a default and a jsonb column
-- with a constant default change only the catalogue (no rewrite). The checks
-- are added NOT VALID: every existing value is NULL, which passes anyway, and
-- the table is not scanned under the lock. Re-runnable: the bundle replays
-- every migration when a deploy adds one.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.settings add column if not exists "taxRates" jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists "taxRatePct" integer;
alter table public.menu_items add column if not exists "taxRatePct" integer;
alter table public.karaoke_reservations add column if not exists "taxRatePct" integer;

-- Whole percentages from 0 to 100 (the panel refuses fractions).
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'products_tax_rate_pct_check'
       and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_tax_rate_pct_check
      check ("taxRatePct" is null or "taxRatePct" between 0 and 100) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'menu_items_tax_rate_pct_check'
       and conrelid = 'public.menu_items'::regclass
  ) then
    alter table public.menu_items
      add constraint menu_items_tax_rate_pct_check
      check ("taxRatePct" is null or "taxRatePct" between 0 and 100) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'karaoke_reservations_tax_rate_pct_check'
       and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_tax_rate_pct_check
      check ("taxRatePct" is null or "taxRatePct" between 0 and 100) not valid;
  end if;
end $$;

-- The edible cup box (prd-0003, seeded under "gift") is boxed waffle cups:
-- bakery goods, GTİP 19.05, list (I) after Karar 5189, so 1%, not the gift
-- default of 20%. Its own rate, so the category default stays as the law
-- has it for non-food gifts. Only the seeded product as the renames left it
-- (20260922120000, 20260923230500), only while it has no rate of its own,
-- and only once: the bundle replays every migration when a deploy adds one,
-- and a rate the operator later clears in the panel must stay cleared. A
-- fresh database gets the same rate from the seed (data.ts).
update public.products
   set "taxRatePct" = 1
 where id = 'prd-0003'
   and cat = 'gift'
   and "taxRatePct" is null
   and (name like 'Yenilebilir Kup%' or tag = 'Waffle kupları')
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261017150000_kdv_rates.sql'
   );

insert into public._migrations (name) values ('20261017150000_kdv_rates.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261017173000_home_hero_slides.sql
-- ─────────────────────────────────────────────────────────────────────
-- The home page hero, editable from the panel (17 Oct 2026).
--
-- Operator, 17 Oct 2026: "site slider alanı, 3-4 kampanya slaytı, panelden
-- tamamen düzenlenebilir olsun". Until now the hero on / was the fixed
-- HOME_SLIDES list in src/components/laffogato/data.ts. One row is one slide,
-- edited at /admin/anasayfa-hero (src/lib/admin/home-hero.ts).
--
-- - Empty table, or no row live right now: the site keeps drawing the bundled
--   HOME_SLIDES, so this migration changes nothing on its own. The panel's
--   "Varsayılanları içe aktar" copies those slides in as editable rows.
-- - "startsAt" / "endsAt": an optional publish window, ISO-8601 UTC text like
--   the app's slides ('' = unbounded; src/lib/admin/publish-window.ts).
-- - image: one of the site's own pictures in public/ (the panel's list in
--   home-hero-core.ts), an uploaded data:image/... (served from
--   /gorsel/ana-hero/<id>), or an https URL.
-- - Each of the two buttons is a label plus EITHER a known action code
--   ("menu", "karaoke", ...) OR a link (a same-site path or an https URL).
--   The panel validates both; the site drops a button whose target does not
--   pass the same check on read.
--
-- Additive and idempotent: the bundle re-runs every migration on a deploy
-- that adds one. No `insert into public._migrations`: scripts/db-migrate.mjs
-- records the file itself.

create table if not exists public.home_hero_slides (
  id                text    primary key,
  "sortOrder"       integer not null default 0,
  "isActive"        boolean not null default true,
  "startsAt"        text    not null default '',
  "endsAt"          text    not null default '',
  kicker            text    not null default '',
  "titleLine1"      text    not null default '',
  "titleLine2"      text    not null default '',
  body              text    not null default '',
  image             text    not null default '',
  alt               text    not null default '',
  scene             text    not null default 'latte',
  "primaryLabel"    text    not null default '',
  "primaryAction"   text    not null default '',
  "primaryHref"     text    not null default '',
  "secondaryLabel"  text    not null default '',
  "secondaryAction" text    not null default '',
  "secondaryHref"   text    not null default '',
  "createdAt"       text    not null default '',
  "updatedAt"       text    not null default ''
);
create index if not exists home_hero_slides_order_idx
  on public.home_hero_slides ("sortOrder");
alter table public.home_hero_slides enable row level security;

insert into public._migrations (name) values ('20261017173000_home_hero_slides.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261017173100_pickup_ready_minutes.sql
-- ─────────────────────────────────────────────────────────────────────
-- How long a pickup ("Gel-al") order takes to get ready, in minutes
-- (17 Oct 2026).
--
-- The home page's order shortcut said "Gel-al · 15 dk" in the component
-- itself; it now reads this column, edited in Ayarlar → Kargo ve kurye. The
-- default is the 15 the card has always shown, so nothing on the site changes
-- until the operator changes it. Presentation only: no order, price or ETA
-- in the mobile API reads it.
--
-- Additive and idempotent. No `insert into public._migrations`:
-- scripts/db-migrate.mjs records the file itself.

alter table public.settings add column if not exists "pickupReadyMinutes" integer not null default 15;

insert into public._migrations (name) values ('20261017173100_pickup_ready_minutes.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261017200000_variant_stock_adjust.sql
-- ─────────────────────────────────────────────────────────────────────
-- Variant stock, kept in step with the product's total (admin audit CAT-03,
-- CAT-14, decision D16, 17 Oct 2026).
--
-- A product with variants keeps two counts: each variant's own stock inside
-- products.variants (jsonb) and the product's total in products.stock.
-- claim_order_stock needs both to cover a variant line and takes the units
-- from both; credit_product_stock gives them back to both. Nothing else kept
-- the two together:
--   - the product form wrote both from the values it read when it was
--     opened, so an order taken meanwhile was undone on save, and no stock
--     move was written (CAT-03);
--   - the total started at 0 while every variant had stock, so the product
--     read "Stoksuz" and its order failed at the claim (CAT-14);
--   - no screen could correct one variant's stock.
--
-- From here on, under the product's row lock like the claim:
--   variant_stock_total     what the total of a product with variants is
--                           made of: the stock of its active variants.
--   adjust_variant_stock    the Stok screen's correction of one variant. The
--                           variant moves by the delta, the total by the same
--                           delta when the variant is active.
--   save_product_variants   the product form's save of price, variants and
--                           stock. Each variant moves by its change since the
--                           form was opened, never to the opened value, and
--                           once per form (product_form_saves). Asked to, it
--                           sets the total to the active variants' sum.
--   adjust_product_stock    now refuses (-3) a product with variants: its
--                           total follows the variants, it is not set alone.
-- Every change writes its stock move in the same transaction.
--
-- The total moves by deltas instead of being recomputed as the sum: the
-- shop card's quick add can still sell a product with variants without a
-- variant, which takes a unit from the total only, and a recomputed sum
-- would hand that unit back for sale. The exceptions: a product getting its
-- first variants takes their sum, and so does a form that asks for it
-- (p_total_from_variants). That is the way back for a total gone apart from
-- its variants: a unit sold without a variant and then corrected on one
-- variant on Stok took the total down twice, and nothing else sets it.
--
-- Re-runnable: the bundle replays every migration when a deploy adds one.
-- The data step at the end runs once (guarded on _migrations).
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- The variant list as an array, whatever the column holds.
create or replace function public.product_variant_list(p_variants jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
           when jsonb_typeof(p_variants) = 'array' then p_variants
           else '[]'::jsonb
         end
$$;

-- The stock of the active variants, summed. Active means `isActive` is true,
-- as resolveOrderLines reads it: a variant without the key is not sold.
create or replace function public.variant_stock_total(p_variants jsonb)
returns int
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(greatest(0, coalesce((v ->> 'stock')::int, 0))), 0)::int
    from jsonb_array_elements(public.product_variant_list(p_variants)) as v
   where coalesce((v ->> 'isActive')::boolean, false)
$$;

-- One stock move, numbered like recordStockMove in the store (mov-000123).
create or replace function public.record_stock_move(
  p_product_id   text,
  p_product_name text,
  p_delta        int,
  p_stock_after  int,
  p_note         text,
  p_actor        text,
  p_now          text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  seq     text := public.next_seq('mov')::text;
  move_id text;
begin
  move_id := 'mov-' || case when length(seq) < 6 then lpad(seq, 6, '0') else seq end;
  insert into public.stock_moves
    (id, "productId", "productName", delta, "stockAfter", reason, note, actor, "createdAt")
  values
    (move_id, p_product_id, coalesce(p_product_name, ''), p_delta, p_stock_after,
     'manual_adjust', left(coalesce(p_note, ''), 500), coalesce(p_actor, 'system'), p_now);
  return move_id;
end;
$$;

-- ── adjust_variant_stock ──────────────────────────────────────────────────
-- Moves one variant's stock by p_delta and records the move (named
-- "Ürün · Varyant", stockAfter = the variant's new stock). Returns
--   {"error": "product" | "variant"}             nothing to adjust,
--   {"error": "negative", "variantStock": n}     it would go below zero,
--   {"variantStock", "stock", "stockBefore", "variantName", "productName",
--    "active", "moveId"}                         done.
create or replace function public.adjust_variant_stock(
  p_product_id text,
  p_variant_id text,
  p_delta      int,
  p_note       text,
  p_actor      text,
  p_now        text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  cur_variants jsonb;
  cur_total    int;
  prod_name    text;
  hit          jsonb;
  cur_stock    int;
  next_stock   int;
  active       boolean;
  next_total   int;
  residual     int;
  move_id      text;
begin
  select public.product_variant_list(variants), stock, name
    into cur_variants, cur_total, prod_name
    from public.products
   where id = p_product_id
     for update;
  if not found then
    return jsonb_build_object('error', 'product');
  end if;

  select v into hit
    from jsonb_array_elements(cur_variants) as v
   where v ->> 'id' = p_variant_id
   limit 1;
  if hit is null then
    return jsonb_build_object('error', 'variant');
  end if;

  cur_stock := greatest(0, coalesce((hit ->> 'stock')::int, 0));
  next_stock := cur_stock + p_delta;
  if next_stock < 0 then
    return jsonb_build_object('error', 'negative', 'variantStock', cur_stock);
  end if;
  active := coalesce((hit ->> 'isActive')::boolean, false);
  next_total := case when active then greatest(0, cur_total + p_delta) else cur_total end;

  update public.products
     set variants = (
           select jsonb_agg(
                    case when e.v ->> 'id' = p_variant_id
                      then jsonb_set(e.v, '{stock}', to_jsonb(next_stock))
                      else e.v end
                    order by e.n)
             from jsonb_array_elements(cur_variants) with ordinality as e(v, n)),
         stock = next_total,
         "updatedAt" = p_now
   where id = p_product_id;

  move_id := public.record_stock_move(
    p_product_id, prod_name || ' · ' || coalesce(hit ->> 'name', ''),
    p_delta, next_stock, p_note, p_actor, p_now);
  -- The total stopped at 0 (units sold without a variant had already left
  -- it): the product's own move says by how much less it went down.
  residual := (next_total - cur_total) - case when active then p_delta else 0 end;
  if residual <> 0 then
    perform public.record_stock_move(
      p_product_id, prod_name, residual, next_total,
      coalesce(p_note, '') || ': varyant toplamı', p_actor, p_now);
  end if;

  return jsonb_build_object(
    'variantStock', next_stock,
    'stock', next_total,
    'stockBefore', cur_total,
    'variantName', coalesce(hit ->> 'name', ''),
    'productName', prod_name,
    'active', active,
    'moveId', move_id);
end;
$$;

-- ── product_form_saves ────────────────────────────────────────────────────
-- What each opened product form has already moved. The form posts a token
-- of its own with every save, and save_product_variants applies a change
-- less what the same token has applied: the same form saved again after an
-- answer that never arrived (a dropped connection, an error after the
-- write) does not move the stock twice, and a count changed again moves by
-- the difference. One row per form and product, kept for two days.
create table if not exists public.product_form_saves (
  "productId" text  not null,
  token       text  not null,
  applied     jsonb not null default '{}'::jsonb,
  "createdAt" text  not null default '',
  primary key ("productId", token)
);
alter table public.product_form_saves enable row level security;

-- ── save_product_variants ─────────────────────────────────────────────────
-- The product form's save of what has to stay together: the sale price, the
-- variant list and the stock. p_variants is the form's list:
--   [{id, name, priceDeltaMinor, sku, isActive, stockDelta, initialStock}]
-- A variant already stored keeps its stored stock plus `stockDelta` (the
-- change typed since the form was opened); one not stored yet starts at
-- `initialStock`; a stored one missing from the list is removed with its
-- units. p_stock_delta is the change to the product's own stock, used only
-- when the list is empty. The total of a product with variants follows them
-- (see the header); a product getting its first variants takes their sum.
-- With p_save_token, what earlier saves of the same form applied
-- (product_form_saves) is taken off each change first. With
-- p_total_from_variants the total of a product with variants becomes the
-- stock of its active variants after the save: the operator counted the
-- shelf and says the variants are right.
--
-- Every stock change is written as a stock move: one per variant whose
-- stock changed ("Ürün · Varyant", stockAfter = its new stock), and one for
-- the product ("Ürün", stockAfter = the new total) for whatever the variant
-- moves do not explain (a variant switched on or off, the first variants
-- replacing the product's own count, the variants removed, the total set
-- to the variants).
--
-- Nothing is written when anything is refused. Returns
--   {"error": "product"}                                 the row is gone,
--   {"error": "floor", "variant": name, "stock", "variants", "applied"}
--                                                        a variant would sell
--                                                        under 1 kuruş,
--   {"error": "negative", "variant"?, "variantId"?, "stock", "variants",
--    "applied"}                                          a count would go
--                                                        below zero;
--   "stock" and "variants" are the stored ones now, "applied" what this
--   form's earlier saves moved ({"stock": n, "variants": {id: n}}),
--   {"stockBefore", "stockAfter", "variants", "moves"}   saved.
--
-- The signatures without the token and without the total's reset came
-- first in this file; they are dropped so a call by name cannot find two.
drop function if exists public.save_product_variants(
  text, integer, jsonb, integer, text, text, text
);
drop function if exists public.save_product_variants(
  text, integer, jsonb, integer, text, text, text, text
);
create or replace function public.save_product_variants(
  p_product_id  text,
  p_price_minor int,
  p_variants    jsonb,
  p_stock_delta int,
  p_note        text,
  p_actor       text,
  p_now         text,
  p_save_token  text default null,
  p_total_from_variants boolean default false
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  cur_variants jsonb;
  cur_total    int;
  prod_name    text;
  prior        jsonb;
  requested    jsonb := '{}'::jsonb;
  inc          jsonb;
  hit          jsonb;
  before_stock int;
  next_stock   int;
  inc_active   boolean;
  next_list    jsonb := '[]'::jsonb;
  changes      jsonb := '[]'::jsonb;
  ch           jsonb;
  explained    int := 0;
  next_total   int;
  moves        int := 0;
begin
  select public.product_variant_list(variants), stock, name
    into cur_variants, cur_total, prod_name
    from public.products
   where id = p_product_id
     for update;
  if not found then
    return jsonb_build_object('error', 'product');
  end if;

  -- Under the product's lock, like every save of it.
  if p_save_token is not null then
    select s.applied into prior
      from public.product_form_saves as s
     where s."productId" = p_product_id
       and s.token = p_save_token;
  end if;
  prior := coalesce(prior, '{}'::jsonb);

  for inc in
    select value from jsonb_array_elements(public.product_variant_list(p_variants))
  loop
    if p_price_minor + coalesce((inc ->> 'priceDeltaMinor')::int, 0) < 1 then
      return jsonb_build_object(
        'error', 'floor',
        'variant', coalesce(inc ->> 'name', ''),
        'stock', cur_total,
        'variants', cur_variants,
        'applied', prior);
    end if;
    inc_active := coalesce((inc ->> 'isActive')::boolean, false);
    hit := null;
    select v into hit
      from jsonb_array_elements(cur_variants) as v
     where v ->> 'id' = inc ->> 'id'
     limit 1;
    if hit is null then
      before_stock := 0;
      next_stock := greatest(0, coalesce((inc ->> 'initialStock')::int, 0));
    else
      before_stock := greatest(0, coalesce((hit ->> 'stock')::int, 0));
      requested := requested || jsonb_build_object(
        inc ->> 'id', coalesce((inc ->> 'stockDelta')::int, 0));
      next_stock := before_stock
        + coalesce((inc ->> 'stockDelta')::int, 0)
        - coalesce((prior -> 'variants' ->> (inc ->> 'id'))::int, 0);
      if next_stock < 0 then
        return jsonb_build_object(
          'error', 'negative',
          'variant', coalesce(inc ->> 'name', ''),
          'variantId', inc ->> 'id',
          'stock', cur_total,
          'variants', cur_variants,
          'applied', prior);
      end if;
    end if;
    next_list := next_list || jsonb_build_array(jsonb_build_object(
      'id', inc ->> 'id',
      'name', coalesce(inc ->> 'name', ''),
      'priceDeltaMinor', coalesce((inc ->> 'priceDeltaMinor')::int, 0),
      'stock', next_stock,
      'sku', coalesce(inc ->> 'sku', ''),
      'isActive', inc_active));
    if next_stock <> before_stock then
      changes := changes || jsonb_build_array(jsonb_build_object(
        'name', coalesce(inc ->> 'name', ''),
        'delta', next_stock - before_stock,
        'after', next_stock,
        'counted', inc_active,
        'removed', false));
    end if;
  end loop;

  -- A stored variant the form no longer lists leaves with its units.
  for hit in
    select v
      from jsonb_array_elements(cur_variants) as v
     where not exists (
       select 1 from jsonb_array_elements(next_list) as n where n ->> 'id' = v ->> 'id')
  loop
    before_stock := greatest(0, coalesce((hit ->> 'stock')::int, 0));
    if before_stock <> 0 then
      changes := changes || jsonb_build_array(jsonb_build_object(
        'name', coalesce(hit ->> 'name', ''),
        'delta', -before_stock,
        'after', 0,
        'counted', coalesce((hit ->> 'isActive')::boolean, false),
        'removed', true));
    end if;
  end loop;

  if jsonb_array_length(next_list) = 0 then
    -- No variants (any more): the product's own count, moved by the form.
    next_total := cur_total
      + coalesce(p_stock_delta, 0)
      - coalesce((prior ->> 'stock')::int, 0);
    if next_total < 0 then
      return jsonb_build_object(
        'error', 'negative', 'stock', cur_total, 'variants', cur_variants,
        'applied', prior);
    end if;
  elsif jsonb_array_length(cur_variants) = 0 or coalesce(p_total_from_variants, false) then
    next_total := public.variant_stock_total(next_list);
  else
    next_total := greatest(0,
      cur_total
      + public.variant_stock_total(next_list)
      - public.variant_stock_total(cur_variants));
  end if;

  update public.products
     set variants = next_list,
         stock = next_total,
         "priceMinor" = p_price_minor,
         "updatedAt" = p_now
   where id = p_product_id;

  for ch in select value from jsonb_array_elements(changes)
  loop
    perform public.record_stock_move(
      p_product_id,
      prod_name || ' · ' || (ch ->> 'name'),
      (ch ->> 'delta')::int,
      (ch ->> 'after')::int,
      coalesce(p_note, '') || case when (ch ->> 'removed')::boolean then ': varyant silindi' else '' end,
      p_actor,
      p_now);
    moves := moves + 1;
    if (ch ->> 'counted')::boolean then
      explained := explained + (ch ->> 'delta')::int;
    end if;
  end loop;

  if next_total - cur_total <> explained then
    perform public.record_stock_move(
      p_product_id,
      prod_name,
      next_total - cur_total - explained,
      next_total,
      coalesce(p_note, '')
        || case
             when jsonb_array_length(next_list) = 0 and jsonb_array_length(cur_variants) = 0 then ''
             else ': varyant toplamı'
           end,
      p_actor,
      p_now);
    moves := moves + 1;
  end if;

  if p_save_token is not null then
    -- This form has now moved each count by what it asked for in all.
    insert into public.product_form_saves as s ("productId", token, applied, "createdAt")
    values (
      p_product_id,
      p_save_token,
      jsonb_build_object('stock', coalesce(p_stock_delta, 0), 'variants', requested),
      p_now)
    on conflict ("productId", token) do update set applied = excluded.applied;
    delete from public.product_form_saves as s
     where s."productId" = p_product_id
       and s."createdAt" < to_char(
             (now() - interval '2 days') at time zone 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  end if;

  return jsonb_build_object(
    'stockBefore', cur_total,
    'stockAfter', next_total,
    'variants', next_list,
    'moves', moves);
end;
$$;

-- ── adjust_product_stock ──────────────────────────────────────────────────
-- As in 20260901150000_atomic_stock_adjust.sql, plus -3 for a product with
-- variants: its total follows them, so the Stok screen and the CSV import
-- move a variant instead.
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
  new_stock  int;
  exists_id  text;
  n_variants int;
begin
  update public.products
    set stock = stock + p_delta,
        "updatedAt" = p_now
    where id = p_product_id
      and stock + p_delta >= 0
      and jsonb_array_length(public.product_variant_list(variants)) = 0
    returning stock into new_stock;

  if found then
    return new_stock;
  end if;

  select id, jsonb_array_length(public.product_variant_list(variants))
    into exists_id, n_variants
    from public.products
   where id = p_product_id;
  if exists_id is null then
    return -1;
  end if;
  if n_variants > 0 then
    return -3;
  end if;
  return -2;
end;
$$;

-- ── once: products the form left at 0 ─────────────────────────────────────
-- A product with variants whose total is 0 while its active variants hold
-- stock is the CAT-14 state: the field defaulted to 0 and the operator only
-- filled the variants, so nothing of it could be sold. Its total becomes the
-- sum, with a stock move. Only a product nothing ever moved: no stock move
-- and no order line names it. A total that reached 0 through sales is sold
-- out, not unfilled: units sold without a variant (the shop card's quick
-- add) left the total and not the variants, so the variants still read
-- stock that is gone, and the sum would put it back on sale. Any other
-- total is left as it stands for the same reason. Once only, like every
-- data step the bundle replays.
with fixed as (
  update public.products as p
     set stock = public.variant_stock_total(p.variants),
         "updatedAt" = to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
   where p.stock = 0
     and public.variant_stock_total(p.variants) > 0
     and not exists (
       select 1 from public.stock_moves as m where m."productId" = p.id
     )
     and not exists (
       select 1
         from public.orders as o
        cross join lateral jsonb_array_elements(
                case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end
              ) as line
        where line ->> 'productId' = p.id
     )
     and not exists (
       select 1
         from public._migrations as applied
        where applied.name = '20261017200000_variant_stock_adjust.sql'
     )
  returning p.id, p.name, p.stock, p."updatedAt"
)
select public.record_stock_move(
         f.id, f.name, f.stock, f.stock,
         'Varyant stoklarının toplamı (ürün stoğu 0 kalmıştı)', 'system', f."updatedAt")
  from fixed as f;

insert into public._migrations (name) values ('20261017200000_variant_stock_adjust.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261017200100_seed_markers.sql
-- ─────────────────────────────────────────────────────────────────────
-- Seeds run once per database, not whenever a table is empty (admin audit
-- CAT-04, CON-01, decision D17, 17 Oct 2026).
--
-- The store seeded a table whenever it found it empty, once per server
-- instance, so every cold start re-checked. Deleting the last product, menu
-- item, category, shop hero slide, story period, press quote, app slide,
-- announcement or post brought the bundled rows back on the next deploy:
-- demo products for sale, a "500₺ üzeri ücretsiz kargo" slide, a weekend
-- closing at 24:00 and a half-price offer the till does not honour, in the
-- app's notification feed too. And setCounter put the id counters back to
-- the seed's size, so the next new row reused a deleted row's id, which old
-- orders and stock moves still point at.
--
-- From here on:
--   counters "seed:<table>"   the marker the store writes the first time it
--                             decides about a table (src/lib/admin/store.ts
--                             seedOnce). With the marker present an empty
--                             table stays empty.
--   raise_counter            what setCounter calls: it sets a counter to at
--                            least the given value and never lowers it.
--
-- A database already in use gets every marker now: its tables were seeded
-- long ago, and one emptied by the operator must stay empty. "In use" is a
-- settings row (written by the first seed) or a table with rows. A fresh
-- database has neither, so the store seeds it as before (the catalogue only
-- outside production). Once only, like every data step the bundle replays.
--
-- To seed a development database again: delete its `seed:%` counters.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

create or replace function public.raise_counter(counter_key text, floor_seq bigint)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v bigint;
begin
  insert into public.counters (id, seq) values (counter_key, floor_seq)
  on conflict (id) do update set seq = greatest(public.counters.seq, excluded.seq)
  returning seq into v;
  return v;
end;
$$;

insert into public.counters (id, seq)
select m.id, 1
  from (values
    ('seed:products',          exists (select 1 from public.products)),
    ('seed:categories',        exists (select 1 from public.categories)),
    ('seed:menu_items',        exists (select 1 from public.menu_items)),
    ('seed:shop_hero_slides',  exists (select 1 from public.shop_hero_slides)),
    ('seed:story_timeline',    exists (select 1 from public.story_timeline)),
    ('seed:press',             exists (select 1 from public.press)),
    ('seed:app_hero_slides',   exists (select 1 from public.app_hero_slides)),
    ('seed:app_announcements', exists (select 1 from public.app_announcements)),
    ('seed:app_posts',         exists (select 1 from public.app_posts))
  ) as m (id, has_rows)
 where (m.has_rows or exists (select 1 from public.settings))
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261017200100_seed_markers.sql'
   )
on conflict (id) do nothing;

insert into public._migrations (name) values ('20261017200100_seed_markers.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261017210000_legal_override_history.sql
-- ─────────────────────────────────────────────────────────────────────
-- Earlier texts of the panel's legal overrides (admin audit CON-02, 17 Oct
-- 2026).
--
-- `legal_docs` holds one override per document and nothing else: "Varsayılana
-- döndür" deleted it on one click, and every save overwrote the text before
-- it. A lawyer-reviewed KVKK or Mesafeli Satış text was then gone for good,
-- and so was the answer to "which text did this order's customer accept":
-- the order records the version label (`legalConsent.version`), the text
-- behind an old label lived nowhere.
--
-- Now every write that replaces or removes an override first copies the row
-- it replaces here, in the same transaction:
--   - legal_doc_save:  a save (or a restore) over a row that differs from
--     what is being written ('replaced');
--   - legal_doc_reset: "Varsayılana döndür" ('reset').
-- The panel lists these rows, previews them and puts one back (a restore is
-- a legal_doc_save of the archived text, so the text it replaces is archived
-- in turn). `updatedAt` is when that text was saved; `archivedAt` and
-- `archivedBy` when and by whom it was replaced.
--
-- Rows are never updated (a trigger refuses it). Only the periodic
-- destruction deletes them (src/lib/retention.ts, "legal-override-history"):
-- eleven years after archivedAt, the published period of the consent record
-- whose version label points at them.
-- Both functions take a per-document advisory lock, so two saves of one
-- document cannot both archive the same row and lose the one in between.
--
-- Additive and idempotent. No `insert into public._migrations`:
-- scripts/db-migrate.mjs records the file itself.

create table if not exists public.legal_override_history (
  id              bigint  generated always as identity primary key,
  slug            text    not null,
  title           text    not null default '',
  summary         text    not null default '',
  "effectiveDate" text    not null default '',
  "bodyMarkdown"  text    not null default '',
  "isPublished"   boolean not null default false,
  "updatedAt"     text    not null default '',
  "archivedAt"    text    not null default '',
  "archivedBy"    text    not null default '',
  reason          text    not null default ''
);

create index if not exists legal_override_history_slug_idx
  on public.legal_override_history (slug, id);

alter table public.legal_override_history enable row level security;

-- ── append-only ─────────────────────────────────────────────────────────
create or replace function public.legal_override_history_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'legal_override_history is append-only' using errcode = 'P0001';
end;
$$;

drop trigger if exists legal_override_history_no_update on public.legal_override_history;
create trigger legal_override_history_no_update
  before update on public.legal_override_history
  for each row execute function public.legal_override_history_append_only();

-- ── legal_doc_save ──────────────────────────────────────────────────────
-- Writes the override of p_slug. When a row is already there and any of its
-- text fields or its published flag differ from what is written, that row is
-- archived first ('replaced'). Returns the archive row's id, or null when
-- nothing was archived (a new override, or a save that changed nothing).
--
-- A save that changes nothing writes nothing, so "updatedAt" stays the
-- moment the text went up: with the archive's "archivedAt" that gives the
-- exact span each text was shown, which is what tells the text behind an
-- order's consent (and the version rule dates an undated live text by it).
create or replace function public.legal_doc_save(
  p_slug           text,
  p_title          text,
  p_summary        text,
  p_effective_date text,
  p_body           text,
  p_published      boolean,
  p_at             text,
  p_by             text
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  prev public.legal_docs%rowtype;
  archived bigint;
begin
  perform pg_advisory_xact_lock(hashtext('legal_doc:' || p_slug));

  select * into prev from public.legal_docs where slug = p_slug for update;
  if found and (prev.title, prev.summary, prev."effectiveDate",
                prev."bodyMarkdown", prev."isPublished")
       is not distinct from (p_title, p_summary, p_effective_date, p_body, p_published)
  then
    return null;
  end if;

  if found then
    insert into public.legal_override_history
      (slug, title, summary, "effectiveDate", "bodyMarkdown", "isPublished",
       "updatedAt", "archivedAt", "archivedBy", reason)
    values
      (prev.slug, prev.title, prev.summary, prev."effectiveDate",
       prev."bodyMarkdown", prev."isPublished", prev."updatedAt",
       p_at, p_by, 'replaced')
    returning id into archived;
  end if;

  insert into public.legal_docs
    (slug, title, summary, "effectiveDate", "bodyMarkdown", "isPublished", "updatedAt")
  values
    (p_slug, p_title, p_summary, p_effective_date, p_body, p_published, p_at)
  on conflict (slug) do update set
    title           = excluded.title,
    summary         = excluded.summary,
    "effectiveDate" = excluded."effectiveDate",
    "bodyMarkdown"  = excluded."bodyMarkdown",
    "isPublished"   = excluded."isPublished",
    "updatedAt"     = excluded."updatedAt";

  return archived;
end;
$$;

-- ── legal_doc_reset ─────────────────────────────────────────────────────
-- "Varsayılana döndür": archives the override of p_slug ('reset') and
-- deletes it, so /hukuk/<slug> shows the coded text again. Returns the
-- archive row's id, or null when the document had no override.
create or replace function public.legal_doc_reset(
  p_slug text,
  p_at   text,
  p_by   text
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  prev public.legal_docs%rowtype;
  archived bigint;
begin
  perform pg_advisory_xact_lock(hashtext('legal_doc:' || p_slug));

  delete from public.legal_docs where slug = p_slug returning * into prev;
  if not found then
    return null;
  end if;

  insert into public.legal_override_history
    (slug, title, summary, "effectiveDate", "bodyMarkdown", "isPublished",
     "updatedAt", "archivedAt", "archivedBy", reason)
  values
    (prev.slug, prev.title, prev.summary, prev."effectiveDate",
     prev."bodyMarkdown", prev."isPublished", prev."updatedAt",
     p_at, p_by, 'reset')
  returning id into archived;

  return archived;
end;
$$;

insert into public._migrations (name) values ('20261017210000_legal_override_history.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261018090000_customer_deletion_request.sql
-- ─────────────────────────────────────────────────────────────────────
-- A member's request to have their account deleted (operator, 18 Oct 2026).
--
-- On the web an account is no longer deleted by the member's own click:
-- /uye/hesap/sil sends a request, the team is mailed, and an owner or
-- manager closes the account from the panel ("Hesabı sil", the same
-- `deleteMe` the app's DELETE /me runs). KVKK m.13/2 and the application
-- Tebliğ m.6/5 give the controller thirty days to answer; the panel counts
-- them from this stamp.
--
--   "deletionRequestedAt"  ISO-8601 instant of the open request; NULL when
--                          there is none. Set only while it is NULL (one
--                          open request per member, a second press keeps
--                          the first date), cleared when the member takes
--                          the request back and when the account is closed.
--   "deletionReason"       the member's optional words, capped in the app
--                          (500 characters); '' when none. Blanked with the
--                          rest of the row when the account is closed.
--
-- The app's in-app deletion (Apple 5.1.1(v), Google Play) is unchanged and
-- never reads these columns.
--
-- Additive and idempotent. No `insert into public._migrations`:
-- scripts/db-migrate.mjs records the file itself.

alter table public.customers
  add column if not exists "deletionRequestedAt" text;

alter table public.customers
  add column if not exists "deletionReason" text not null default '';

-- The panel lists and counts the open requests; almost every row is NULL.
create index if not exists customers_deletion_requested_idx
  on public.customers ("deletionRequestedAt")
  where "deletionRequestedAt" is not null;

insert into public._migrations (name) values ('20261018090000_customer_deletion_request.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261018090100_deletion_request_commercial_mail.sql
-- ─────────────────────────────────────────────────────────────────────
-- No commercial mail to a member who asked for their account to be deleted.
--
-- Until 18 Oct 2026 the site deleted an account on the member's click, and
-- `deleteMe` switched marketing and the bulletin off in the same second. Now
-- /uye/hesap/sil only opens a request (`customers."deletionRequestedAt"`,
-- 20261018090000) and the team closes the account within thirty days (KVKK
-- m.13/2). In that window the campaign audience and the birthday greeting
-- still named the member.
--
-- 6563 m.8/3 has the sender stop within three working days of a refusal,
-- and the site's own İleti onayı text says ending the membership ends the
-- consent with no separate request. A request to delete the account is read
-- as that refusal from the moment it arrives. Reversible: nothing in the
-- consent record changes, so a member who takes the request back
-- (`withdrawDeletionRequest` clears the stamp) is in the audience again.
--
-- Both functions are the 20260923230300_email_suppressions versions, with
-- one more clause each. Subscriber rows under the same address are left out
-- too: the closure deletes that subscription with the account. The coupon
-- stays (an account right, not a message); only the greeting's mail flag
-- turns false. The count, the enqueue and the claim all read the audience,
-- so a request opened after a campaign was queued is honoured when its batch
-- is claimed.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- ── campaign_email_audience ─────────────────────────────────────────────
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
     where not exists (
       select 1
         from public.email_suppressions x
        where x.email = e.email
     )
       and not exists (
         select 1
           from public.customers d
          where d."deletionRequestedAt" is not null
            and lower(d.email) = e.email
       )
     order by e.email, (e.kind = 'customer') desc;
end;
$$;

-- ── birthday_greeting_audience ──────────────────────────────────────────
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
            and c."marketingConsentAt" <> ''
            and c."deletionRequestedAt" is null
            and not exists (
              select 1
                from public.email_suppressions x
               where x.email = lower(c.email)
            )) as marketing
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

insert into public._migrations (name) values ('20261018090100_deletion_request_commercial_mail.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261018130000_karaoke_cancel_policy.sql
-- ─────────────────────────────────────────────────────────────────────
-- Karaoke: the cancellation and refund rule is set from the panel, and each
-- booking keeps the rule it was made under.
--
-- Operator, 17 Eki 2026: "para tutarı iade edilir kısmını da panelden ayarla".
-- Until now the rule was code: a member's cancel more than 2 hours before the
-- start refunds the whole payment, a later one (and not turning up) refunds
-- nothing (src/lib/mobile/karaoke-time.ts).
--
-- settings (Ayarlar > Karaoke, owner only):
--   "karaokeFreeCancelHours"    0..72, default 2. 0: free cancellation
--                               until the start (ASK-OTH-3-CFG, 18 Eki 2026;
--                               it read "every cancel is late" before).
--   "karaokeLateRefundPercent"  0..100, default 0: the share of the payment a
--                               cancel INSIDE the window refunds while the
--                               start has not come. 0 = such a cancel is
--                               refused, as before.
--   "karaokeCancelPolicyAt"     when the two numbers last moved (ISO, '' =
--                               never). The karaoke document's version moves
--                               with it (src/lib/legal/karaoke-doc.ts).
--
-- karaoke_reservations, the snapshot (TKHK m.4/2, MSY m.5/2: the
-- pre-information a consumer confirmed is part of the contract, and the panel
-- must not change it afterwards). Written by createReservation, never later:
--   "freeCancelHours" "lateRefundPercent"  the policy of the booking
--   "cancelDeadline"                       its last full-refund instant (ISO)
--   "cancellationRules"                    the two sentences shown at booking
--   "refundMinor"                          kuruş owed back / refunded when it
--                                          is NOT the whole payment (a late
--                                          cancel's share); NULL = the whole
-- All NULL on every row written before this: such a row reads 2 hours / 0 %,
-- its deadline is computed from the start, its sentences are the defaults,
-- and its refunds are whole.
--
-- Safe on a live table: nullable columns and checks every existing row
-- satisfies; the settings columns have defaults equal to the old rule.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.settings add column if not exists "karaokeFreeCancelHours"   integer not null default 2;
alter table public.settings add column if not exists "karaokeLateRefundPercent" integer not null default 0;
alter table public.settings add column if not exists "karaokeCancelPolicyAt"    text    not null default '';

alter table public.karaoke_reservations add column if not exists "freeCancelHours"   integer;
alter table public.karaoke_reservations add column if not exists "lateRefundPercent" integer;
alter table public.karaoke_reservations add column if not exists "cancelDeadline"    text;
alter table public.karaoke_reservations add column if not exists "cancellationRules" jsonb;
alter table public.karaoke_reservations add column if not exists "refundMinor"       integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'settings_karaoke_cancel_policy_check'
       and conrelid = 'public.settings'::regclass
  ) then
    alter table public.settings
      add constraint settings_karaoke_cancel_policy_check
      check ("karaokeFreeCancelHours" between 0 and 72
             and "karaokeLateRefundPercent" between 0 and 100);
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'karaoke_reservations_cancel_policy_check'
       and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_cancel_policy_check
      check (("freeCancelHours" is null or "freeCancelHours" between 0 and 72)
             and ("lateRefundPercent" is null
                  or "lateRefundPercent" between 0 and 100));
  end if;
  -- A partial refund is a share of what was collected: never more, never
  -- negative.
  if not exists (
    select 1 from pg_constraint
     where conname = 'karaoke_reservations_refund_minor_check'
       and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_refund_minor_check
      check ("refundMinor" is null
             or ("refundMinor" >= 0 and "refundMinor" <= "paidMinor"));
  end if;
end $$;

insert into public._migrations (name) values ('20261018130000_karaoke_cancel_policy.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261018200000_clear_unused_card_user_keys.sql
-- ─────────────────────────────────────────────────────────────────────
-- Card storage never went live: clear the member keys minted for it.
--
-- `customers."cardUserKey"` is the key PayNkolay files a member's saved cards
-- under (docs/PAYNKOLAY.md §16). Card storage was never turned on (rule 28),
-- yet the app order (src/lib/mobile/orders.ts) and the member's karaoke
-- payment (src/lib/mobile/karaoke-payment.ts) minted one for every member
-- who paid there. No card sits under any of them: the key reaches PayNkolay
-- only while card storage is on (`cardStorageEnabled`, paynkolay.ts), and
-- Vercel's environment list (read 18 Ekim 2026) has no PAYNKOLAY_CARD_STORAGE
-- in any environment, so storage was never on in production (OP-28). Since 18 Ekim 2026 the legal texts name no
-- saved card and no path mints a key while storage is off, so a stored key is
-- personal data no notice names (KVKK m.4/2-ç, m.10; Aydınlatma Tebliği
-- m.5/1-j). Cleared here, once.
--
-- Only the key moves; "updatedAt" stays (the code wrote the key, not the
-- member). Once only, like every data step the bundle replays: a key minted
-- after this ran, with card storage and its texts on, must stay.
--
-- Undo: nothing to restore. The key is random; ensureCardUserKey mints a new
-- one at the member's next payment while card storage is on.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

update public.customers
   set "cardUserKey" = ''
 where "cardUserKey" <> ''
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261018200000_clear_unused_card_user_keys.sql'
   );

insert into public._migrations (name) values ('20261018200000_clear_unused_card_user_keys.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261018210000_menu_photos_mismatch.sql
-- ─────────────────────────────────────────────────────────────────────
-- Ten menu photos that show something the item is not (18 Oct 2026).
--
-- Decision OP-MENU-PHOTOS / ASK-OTH-1 (operator, 18 Oct 2026: "avukata sorma,
-- sen karar ver"): "Görseller temsilidir" covers a different glass, garnish
-- or light, never a different product. Seven of the stock photos that
-- 20261017120000_menu_photos.sql wrote show another make-up (a roast beef
-- sandwich with raw onion and no greens or sauce, a biscuit-base tart for a
-- burnt Basque cheesecake, nuts and granola on an item with no nut tag, a
-- photo titled "Iced Mocha" for a pumpkin latte, a mint iced tea for a peach
-- one, a magnolia with no biscuit layer, a white sesame simit for a buckwheat
-- one), and mnu-0082 Alternatif Süt shows hemp milk and hemp seeds, which the
-- bar does not serve. Two more show tree nuts on an item that names and tags
-- none, the criterion that took off mnu-0067: walnuts heaped on the slice
-- for mnu-0061 L'Af Kahve, and an almond and seed bar beside the chocolate
-- ones for mnu-0078 Kakao Protein Bar. A picture that contradicts the item
-- is a misleading advertisement whatever the footnote says (TKHK m.61, m.62,
-- m.8/2; Ticari Reklam Yön. m.7/5-a, m.18/6-7, m.29/2-a). docs/MENU-PHOTOS.md
-- lists each.
--
-- A row is emptied only when both hold:
-- - it still carries the very path the old migration wrote. A photo the
--   operator uploaded or linked since is never touched.
-- - this file has not run before. The bundle (db/schema.sql) re-runs every
--   migration whenever a deploy adds a new one; without this guard a stock
--   path linked again by hand would be emptied on the next deploy.
--   db:migrate and the bundle both record this file in _migrations after the
--   body runs (the guard of 20261017120000).
--
-- The files stay in public/menu: the old migration still names them, and
-- 20261017120000 itself is not edited. The site and the app draw the plate
-- for these items, as they do for the other four without a photo.
--
-- `updatedAt` is left alone, as in 20261017120000: this is not an edit of the
-- item, and the menu's ETag already changes with the body.
--
-- Rollback (no schema change): write the old path back on the rows that are
-- still empty, e.g.
--   update public.menu_items set image = '/menu/simit.webp'
--    where id = 'mnu-0073' and image = '';

update public.menu_items as m
   set image = ''
  from (
    values
    ('mnu-0028', '/menu/iced-pumpkin-latte.webp'),
    ('mnu-0056', '/menu/peach-iced-tea.webp'),
    ('mnu-0059', '/menu/blueberry-san-sebastian.webp'),
    ('mnu-0061', '/menu/coffee-cake.webp'),
    ('mnu-0063', '/menu/strawberry-magnolia.webp'),
    ('mnu-0067', '/menu/classic-spoonful.webp'),
    ('mnu-0073', '/menu/simit.webp'),
    ('mnu-0074', '/menu/roast-beef-sandwich.webp'),
    ('mnu-0078', '/menu/cocoa-protein-bar.webp'),
    ('mnu-0082', '/menu/alternative-milk.webp')
  ) as v (id, image)
 where m.id = v.id
   and m.image = v.image
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261018210000_menu_photos_mismatch.sql'
   );

insert into public._migrations (name) values ('20261018210000_menu_photos_mismatch.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261018210100_menu_item_allergens.sql
-- ─────────────────────────────────────────────────────────────────────
-- The fourteen allergen groups per cafe menu item (18 Oct 2026).
--
-- Decision OP-ALLERGEN-BOARD (operator, 18 Oct 2026: "avukata sorma, sen
-- karar ver"): a place serving unpackaged food shows, for every item, which
-- of the fourteen groups of TGK Gıda Etiketleme Yönetmeliği Ek-1 it contains,
-- on the menu or a board (m.15/5), and before the purchase when it sells at
-- a distance, as the app does (m.17/3). The menu had a general cross-contact
-- line and, in the app, only the `nuts` tag. Keys and labels:
-- src/lib/menu/allergens.ts.
--
--   menu_items.allergens  jsonb, nullable, no default.
--     NULL      not entered yet: nothing is shown next to the item and
--               GET /api/mobile/v1/menu leaves the field out (§1).
--     []        entered: the item contains none of the fourteen.
--     ["sut"]   the groups it contains, keys from the closed list below.
--
-- Every existing row starts NULL: the operator enters the items in
-- /admin/menu from the table of the kiosk's allergen board. Nothing is
-- guessed from the item's name or from the `nuts` tag.
--
-- The check refuses anything that is not an array of known keys, whatever
-- writes it. Added NOT VALID: every existing value is NULL, which passes, and
-- the table is not scanned under the lock. Re-runnable: the bundle replays
-- every migration when a deploy adds one.
--
-- Rollback (nothing else reads the column):
--   alter table public.menu_items drop column if exists allergens;

alter table public.menu_items add column if not exists allergens jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'menu_items_allergens_check'
       and conrelid = 'public.menu_items'::regclass
  ) then
    alter table public.menu_items
      add constraint menu_items_allergens_check
      check (
        allergens is null
        or (
          jsonb_typeof(allergens) = 'array'
          and allergens <@ '["gluten", "kabuklular", "yumurta", "balik",
            "yer_fistigi", "soya", "sut", "sert_kabuklu", "kereviz", "hardal",
            "susam", "sulfit", "aci_bakla", "yumusakcalar"]'::jsonb
        )
      ) not valid;
  end if;
end $$;

insert into public._migrations (name) values ('20261018210100_menu_item_allergens.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261018210200_menu_prices_effective_date.sql
-- ─────────────────────────────────────────────────────────────────────
-- The day the cafe's menu prices started to apply (18 Oct 2026).
--
-- Decision OP-PRICE-LISTS (operator, 18 Oct 2026): a price list carries the
-- all-taxes-included price and the day that price started to apply (Fiyat
-- Etiketi Yönetmeliği m.5/2-c, d). A table's QR code opens /masa/<kod>, the
-- menu, which stands for the table's price list (m.8/2); /menu and the
-- category pages show the same prices. They now print the day under the
-- menu, from Ayarlar > Vergi.
--
--   settings."menuPricesEffectiveDate"  text, the Istanbul calendar day
--                                       "YYYY-MM-DD"; '' = not entered (the
--                                       menu then says only that prices
--                                       include KDV).
--
-- Starts empty: the day the current prices began is the operator's to say
-- (the printed lists at the kiosk carry the same day), not something to
-- guess from a row's updatedAt. Rules: src/lib/menu/price-list.ts.
--
-- Safe on the live table: a constant default changes only the catalogue (no
-- rewrite). Re-runnable: the bundle replays every migration when a deploy
-- adds one.
--
-- Rollback (nothing else reads the column):
--   alter table public.settings drop column if exists "menuPricesEffectiveDate";

alter table public.settings add column if not exists "menuPricesEffectiveDate" text not null default '';

insert into public._migrations (name) values ('20261018210200_menu_prices_effective_date.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261019120000_clear_card_user_keys_again.sql
-- ─────────────────────────────────────────────────────────────────────
-- Card storage never went live: clear the member keys a second time.
--
-- 20261018200000_clear_unused_card_user_keys.sql cleared every
-- `customers."cardUserKey"` once (18 Ekim 2026). From about 22:38 that night
-- until 08:05 on 19 Ekim, laffogato.net was served by an older deployment
-- (feat/home-hero-panel 014d51b, promoted to production by hand) whose app
-- order and member karaoke payment still minted a key for every member who
-- paid. Card storage was never on: Vercel's environment list (read 18 Ekim
-- 2026) has no PAYNKOLAY_CARD_STORAGE in any environment, so no card sits
-- under any key. Current main mints no key while storage is off (#150).
--
-- Only the key moves; "updatedAt" stays. Once only, like every data step the
-- bundle replays: a key minted later, with card storage and its texts on,
-- must stay.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

update public.customers
   set "cardUserKey" = ''
 where "cardUserKey" <> ''
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261019120000_clear_card_user_keys_again.sql'
   );

insert into public._migrations (name) values ('20261019120000_clear_card_user_keys_again.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261019130000_admin_customer_list.sql
-- ─────────────────────────────────────────────────────────────────────
-- Müşteriler as one paged query (admin audit PEO-13, PEO-05; 18 Oct 2026).
--
-- The list read every member row (`select *`, addresses and all) and every
-- order, merged them in JavaScript and wrote the whole result into the page
-- twice (phone cards and the desktop table). With a few thousand members
-- that was one endless, heavy page; and its search lower-cased without the
-- Turkish rules, so "ismail" never found "İsmail".
--
-- Now the database does the merge, the search, the sort and the paging, and
-- the page receives one page of rows plus the tab counts:
--
--   admin_fold_tr(text)       The panel's Turkish search fold, the same
--                             letters as TR_FOLD_SQL_FROM / TR_FOLD_SQL_TO in
--                             src/lib/admin/text-fold.ts (U+0307 written as
--                             chr(775)): İ, I and ı meet as i, the other
--                             Turkish capitals are lowered by translate()
--                             itself, so the "C" collation folds them too.
--                             The search pattern arrives already folded by
--                             foldTr() in TypeScript.
--   admin_sort_tr(text)       A sort key in Turkish alphabet order under the
--                             "C" collation: ç after c, ğ after g, ı between
--                             h and i, ö after o, ş after s, ü after u.
--   admin_customer_rows(...)  One row per customer: a member account and the
--                             roll-up of the orders under the same address,
--                             or the roll-up alone for a guest. The rule is
--                             summarizeCustomers / customerLifetime in
--                             src/lib/admin/store.ts: order count, spend and
--                             refunds leave out abandoned checkouts and
--                             cancelled orders (the reports' rule), the last
--                             order of any status dates the activity, the
--                             newest order's name and phone stand in for a
--                             member's empty ones. A closed account
--                             (`deleted-…@anon.local`, decision D13) and the
--                             till's `guest@laffogato.local` are left out.
--                             Filters: search (folded substring of address,
--                             name or phone, or the phone's digits), the
--                             member's commercial consent and verification.
--                             A member's open web deletion request
--                             ("deletionRequestedAt", /uye/hesap/sil) rides
--                             along, "" when there is none.
--   admin_customer_page(...)  One page of those rows for a tab (all,
--                             members, guests, inactive, deletion), sorted
--                             by last activity, name, order count or spend;
--                             the deletion tab runs oldest request first
--                             whatever the sort (the next one due). The
--                             address breaks ties so a page boundary never
--                             splits or repeats a customer.
--   admin_customer_counts(...) Per tab: customers, paid orders, spend and
--                             refunds under the same filters, for the tab
--                             badges and the summary tiles, and the oldest
--                             open deletion request for the panel's banner.
--
-- A new tab or column later is a new migration that drops and recreates
-- these: RETURNS TABLE cannot change its columns in place. Here they are
-- dropped first for the same reason (a development database may hold an
-- earlier draft of them).
--
-- Read-only, additive and idempotent. No `insert into public._migrations`:
-- scripts/db-migrate.mjs records the file itself.

drop function if exists public.admin_customer_counts(text, text, text, text);
drop function if exists public.admin_customer_page(
  text, text, text, text, text, text, boolean, integer, integer);
drop function if exists public.admin_customer_rows(text, text, text, text);

create or replace function public.admin_fold_tr(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(translate(coalesce(p_text, ''),
                         'İIıÇŞĞÖÜÂÎÛ' || chr(775),
                         'iiiçşğöüâîû'))
$$;

create or replace function public.admin_sort_tr(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select replace(replace(replace(replace(replace(replace(
           lower(translate(coalesce(p_text, ''),
                           'İIÇĞÖŞÜÂÎÛâîû',
                           'iıçğöşüaiuaiu')),
           'ç', 'c~'), 'ğ', 'g~'), 'ı', 'h~'), 'ö', 'o~'), 'ş', 's~'), 'ü', 'u~')
$$;

create or replace function public.admin_customer_rows(
  p_search   text,
  p_digits   text,
  p_consent  text,
  p_verified text
)
returns table (
  email                text,
  name                 text,
  phone                text,
  "isMember"           boolean,
  "isActive"           boolean,
  "emailVerified"      boolean,
  "memberSince"        text,
  "marketingConsent"   boolean,
  "orderCount"         bigint,
  "lifetimeValueMinor" bigint,
  "refundedMinor"      bigint,
  "lastOrderAt"        text,
  "lastActivity"       text,
  "deletionRequestedAt" text
)
language sql
stable
set search_path = ''
as $$
  with ord as (
    select lower(btrim(o."customerEmail")) as key,
           o.status not in ('pending_payment', 'cancelled') as counts,
           o."totalMinor"::bigint as total,
           coalesce((
             select sum(case when jsonb_typeof(r -> 'amountMinor') = 'number'
                             then (r ->> 'amountMinor')::numeric
                             else 0 end)
               from jsonb_array_elements(
                      case when jsonb_typeof(o.refunds) = 'array'
                           then o.refunds
                           else '[]'::jsonb end) as r
           ), 0)::bigint as refunded,
           o."createdAt" as at,
           o."orderNo" as no,
           o."customerName" as cname,
           o."customerPhone" as cphone
      from public.orders o
     where btrim(o."customerEmail") <> ''
       and lower(btrim(o."customerEmail")) <> 'guest@laffogato.local'
       and lower(btrim(o."customerEmail")) not like '%@anon.local'
  ),
  rolled as (
    select ord.key,
           count(*) filter (where ord.counts) as n,
           coalesce(sum(ord.total) filter (where ord.counts), 0)::bigint as v,
           coalesce(sum(ord.refunded) filter (where ord.counts), 0)::bigint
             as refunded,
           max(ord.at) as last_at,
           (array_agg(ord.cname order by ord.at desc, ord.no desc)
              filter (where ord.cname <> ''))[1] as cname,
           (array_agg(ord.cphone order by ord.at desc, ord.no desc)
              filter (where ord.cphone <> ''))[1] as cphone
      from ord
     group by ord.key
  ),
  members as (
    select lower(btrim(c.email)) as key,
           c.email,
           c.name,
           c.phone,
           c."isActive",
           c."emailVerified",
           c."createdAt",
           coalesce(c."deletionRequestedAt", '') as deletion_at,
           (coalesce(c."notificationPrefs" ->> 'marketing', 'false') = 'true'
            and c."marketingConsentAt" <> '') as consent
      from public.customers c
     where lower(btrim(c.email)) not like '%@anon.local'
  ),
  merged as (
    select coalesce(m.email, r.key) as email,
           coalesce(nullif(m.name, ''), r.cname, '') as name,
           coalesce(nullif(m.phone, ''), r.cphone, '') as phone,
           m.key is not null as is_member,
           coalesce(m."isActive", true) as is_active,
           coalesce(m."emailVerified", false) as verified,
           coalesce(m."createdAt", '') as member_since,
           coalesce(m.consent, false) as consent,
           coalesce(r.n, 0)::bigint as n,
           coalesce(r.v, 0)::bigint as v,
           coalesce(r.refunded, 0)::bigint as refunded,
           coalesce(r.last_at, '') as last_at,
           coalesce(nullif(r.last_at, ''), m."createdAt", '') as activity,
           coalesce(m.deletion_at, '') as deletion_at
      from members m
      full outer join rolled r on r.key = m.key
  )
  select x.email,
         x.name,
         x.phone,
         x.is_member,
         x.is_active,
         x.verified,
         x.member_since,
         x.consent,
         x.n,
         x.v,
         x.refunded,
         x.last_at,
         x.activity,
         x.deletion_at
    from merged x
   where (coalesce(p_search, '') = ''
          or public.admin_fold_tr(x.email) like '%' || p_search || '%'
          or public.admin_fold_tr(x.name) like '%' || p_search || '%'
          or public.admin_fold_tr(x.phone) like '%' || p_search || '%'
          or (coalesce(p_digits, '') <> ''
              and regexp_replace(x.phone, '[^0-9]', '', 'g')
                    like '%' || p_digits || '%'))
     and (coalesce(p_consent, '') = ''
          or (x.is_member and x.consent = (p_consent = 'yes')))
     and (coalesce(p_verified, '') = ''
          or (x.is_member and x.verified = (p_verified = 'yes')))
$$;

create or replace function public.admin_customer_page(
  p_search   text,
  p_digits   text,
  p_consent  text,
  p_verified text,
  p_kind     text,
  p_sort     text,
  p_desc     boolean,
  p_limit    integer,
  p_offset   integer
)
returns table (
  email                text,
  name                 text,
  phone                text,
  "isMember"           boolean,
  "isActive"           boolean,
  "emailVerified"      boolean,
  "memberSince"        text,
  "marketingConsent"   boolean,
  "orderCount"         bigint,
  "lifetimeValueMinor" bigint,
  "refundedMinor"      bigint,
  "lastOrderAt"        text,
  "lastActivity"       text,
  "deletionRequestedAt" text
)
language sql
stable
set search_path = ''
as $$
  select r.email,
         r.name,
         r.phone,
         r."isMember",
         r."isActive",
         r."emailVerified",
         r."memberSince",
         r."marketingConsent",
         r."orderCount",
         r."lifetimeValueMinor",
         r."refundedMinor",
         r."lastOrderAt",
         r."lastActivity",
         r."deletionRequestedAt"
    from public.admin_customer_rows(p_search, p_digits, p_consent, p_verified) r
   -- The same tabs as admin_customer_counts.
   where case coalesce(p_kind, '')
           when 'members'  then r."isMember"
           when 'guests'   then not r."isMember"
           when 'inactive' then r."isMember" and not r."isActive"
           when 'deletion' then r."deletionRequestedAt" <> ''
           else true
         end
   order by
     -- Open deletion requests oldest first: the one closest to its thirty
     -- days is the next to do.
     case when p_kind = 'deletion' then r."deletionRequestedAt" end asc,
     -- A row without a name sorts after the named ones, either way.
     case when p_sort = 'name' then r.name = '' end,
     -- In Turkish alphabet order, whatever the database's collation.
     case when p_sort = 'name' and not p_desc
          then public.admin_sort_tr(r.name) collate pg_catalog."C"
     end asc,
     case when p_sort = 'name' and p_desc
          then public.admin_sort_tr(r.name) collate pg_catalog."C"
     end desc,
     case when p_sort = 'orders' and not p_desc then r."orderCount" end asc,
     case when p_sort = 'orders' and p_desc then r."orderCount" end desc,
     case when p_sort = 'value' and not p_desc
          then r."lifetimeValueMinor" end asc,
     case when p_sort = 'value' and p_desc
          then r."lifetimeValueMinor" end desc,
     case when coalesce(p_sort, '') not in ('name', 'orders', 'value')
               and not p_desc
          then r."lastActivity" end asc,
     r."lastActivity" desc,
     lower(r.email) asc
   limit greatest(1, least(coalesce(p_limit, 50), 200))
   offset greatest(0, coalesce(p_offset, 0))
$$;

create or replace function public.admin_customer_counts(
  p_search   text,
  p_digits   text,
  p_consent  text,
  p_verified text
)
returns table (
  kind                 text,
  customers            bigint,
  "orderCount"         bigint,
  "lifetimeValueMinor" bigint,
  "refundedMinor"      bigint,
  "oldestDeletionAt"   text
)
language sql
stable
set search_path = ''
as $$
  with r as (
    select *
      from public.admin_customer_rows(p_search, p_digits, p_consent, p_verified)
  )
  select k.kind,
         count(r.email)::bigint,
         coalesce(sum(r."orderCount"), 0)::bigint,
         coalesce(sum(r."lifetimeValueMinor"), 0)::bigint,
         coalesce(sum(r."refundedMinor"), 0)::bigint,
         coalesce(min(nullif(r."deletionRequestedAt", '')), '')
    from (values ('all'), ('members'), ('guests'), ('inactive'), ('deletion'))
           as k(kind)
    -- The same tabs as admin_customer_page.
    left join r
      on case k.kind
           when 'members'  then r."isMember"
           when 'guests'   then not r."isMember"
           when 'inactive' then r."isMember" and not r."isActive"
           when 'deletion' then r."deletionRequestedAt" <> ''
           else true
         end
   group by k.kind
$$;

insert into public._migrations (name) values ('20261019130000_admin_customer_list.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261019150000_cafe_food_rate_10.sql
-- ─────────────────────────────────────────────────────────────────────
-- KDV: every food the köşk sells is 10%, the cotton apron 10% (18 Oct 2026).
--
-- Operator decision, 18 Oct 2026 (no lawyer or accountant round; research
-- and basis in docs/LEGAL-REDLINES-2026-09.md §16.4 and src/lib/utils/kdv.ts):
-- the köşk is a kafeterya business, and KDV GUT III/B-2.4.1 (Tebliğ Seri
-- No 51, RG 27.04.2024) puts every food sale of such a business at 10%,
-- internet orders sent to an address included. The 1% of list (I) is for a
-- plain retailer. A cotton canvas apron is a textile garment, list (II)
-- item 5: 10%, not the merch default of 20%.
--
-- The code defaults move with this deploy (LEGAL_TAX_RATES beans 10,
-- pantry 10). This file corrects the rows the CODE wrote, nothing an
-- operator chose:
--
--   prd-0003  the edible cup box. 20261017150000_kdv_rates.sql gave it its
--             own 1%; only while it is still that 1.
--   prd-0009  the cotton apron. The seed (data.ts) and the rename of
--             20260922120000 left it with no rate of its own, so it sold at
--             the merch 20%; only while it has none, is still under merch
--             and still the apron.
--   orders.items  every line stamped 1% becomes 10%. The store copied that
--             1 at sale time from the code's default (shopLineItems ->
--             productTaxRate) or from the cup box's row. Prices, totals and
--             the order of the lines do not change: a rate only says how
--             much of a KDV-included price is KDV. Invoices go out through
--             Paraşüt (operator, 19 Oct 2026), so some of these orders may
--             already have an invoice at 1%. The stamp they were sold at is
--             therefore kept: before the rewrite each such order gets one
--             audit row (actor system, event kdv_rate_corrected, orderNo and
--             the lines that were 1). Olay kaydı and the order's Zaman
--             çizelgesi list them; the operator checks those invoices and
--             tells the mali müşavir about any cut at 1% (VUK m.371).
--
--   settings."taxRates"  beans and pantry, each only while it is 1. That
--             1 was the code's too: until this deploy Ayarlar > Vergi
--             prefilled every field from the old default and its save
--             writes every key, so a save of any other field (the menu
--             rate, the price-list date) stored beans 1 and pantry 1. Left
--             there, every new shop food line would be stamped 1 again
--             after this file moved the old stamps. The decision offers 1
--             for no food, so a stored 1 is never the operator's choice of
--             today. Every other key and value stays; a row that never
--             saved a key reads the new default.
--
-- Once only: the bundle replays every migration when a deploy adds one, and
-- a rate the operator sets later in the panel must stay what they set.
-- Each statement checks this file's own `_migrations` record.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs and
-- the bundle do that themselves, right after the file.

update public.products
   set "taxRatePct" = 10
 where id = 'prd-0003'
   and "taxRatePct" = 1
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261019150000_cafe_food_rate_10.sql'
   );

update public.products
   set "taxRatePct" = 10
 where id = 'prd-0009'
   and cat = 'merch'
   and "taxRatePct" is null
   and name like 'Pamuk Önlük%'
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261019150000_cafe_food_rate_10.sql'
   );

update public.settings
   set "taxRates" = "taxRates"
         || case when "taxRates"->'beans' = '1'::jsonb
                 then '{"beans": 10}'::jsonb else '{}'::jsonb end
         || case when "taxRates"->'pantry' = '1'::jsonb
                 then '{"pantry": 10}'::jsonb else '{}'::jsonb end
 where ("taxRates"->'beans' = '1'::jsonb or "taxRates"->'pantry' = '1'::jsonb)
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261019150000_cafe_food_rate_10.sql'
   );

-- The record first: once the stamps move, nothing else says which lines
-- were sold at 1. One row per order, ids from the same `aud` counter
-- logAudit uses, `createdAt` in its ISO-8601 form.
insert into public.audit_logs (id, actor, action, entity, "entityId", payload, "createdAt")
select 'aud-' || lpad(seq::text, greatest(7, length(seq::text)), '0'),
       'system',
       'update',
       'order',
       touched.id,
       jsonb_build_object(
         'event', 'kdv_rate_corrected',
         'migration', '20261019150000_cafe_food_rate_10.sql',
         'orderNo', touched."orderNo",
         'from', 1,
         'to', 10,
         'count', jsonb_array_length(touched.lines),
         'lines', touched.lines
       ),
       to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  from (
    select o.id,
           o."orderNo",
           public.next_seq('aud') as seq,
           (
             select jsonb_agg(
                      jsonb_build_object(
                        'index', pos - 1,
                        'productName', coalesce(line->>'productName', ''),
                        'qty', line->'qty'
                      )
                      order by pos
                    )
               from jsonb_array_elements(o.items) with ordinality as l(line, pos)
              where line->'taxRatePct' = '1'::jsonb
           ) as lines
      from public.orders as o
     where o.items @> '[{"taxRatePct": 1}]'::jsonb
       and not exists (
         select 1
           from public._migrations as applied
          where applied.name = '20261019150000_cafe_food_rate_10.sql'
       )
  ) as touched;

-- Line by line, in the stored order (with ordinality): a line stamped 1
-- becomes 10, every other line and every other key stays as it was.
update public.orders as o
   set items = (
     select jsonb_agg(
              case
                when line->'taxRatePct' = '1'::jsonb
                  then jsonb_set(line, '{taxRatePct}', '10'::jsonb)
                else line
              end
              order by pos
            )
       from jsonb_array_elements(o.items) with ordinality as l(line, pos)
   )
 where o.items @> '[{"taxRatePct": 1}]'::jsonb
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261019150000_cafe_food_rate_10.sql'
   );

insert into public._migrations (name) values ('20261019150000_cafe_food_rate_10.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261019150100_order_shipping_tax_rate.sql
-- ─────────────────────────────────────────────────────────────────────
-- The shipping or courier fee's own KDV rate on every order (18 Oct 2026).
--
-- Operator decision, 18 Oct 2026 (ASK-Y2-2; basis in src/lib/utils/kdv.ts
-- and docs/LEGAL-REDLINES-2026-09.md §16.4): the fee is shown on its own
-- line and an outside firm carries the parcel, so on the invoice it is a
-- transport service at the general rate, 20% (GİB özelge 32391, 28945,
-- 32558; KDV K. m.24/a folds it into the goods only inside one price). It
-- used to follow the rate of the goods it carried.
--
--   orders."shippingTaxRatePct"  the fee's rate when the order was written
--                                (settings."taxRates".shipping), stamped by
--                                the store on the web, app (the wallet's
--                                wallet_place_order inserts the same row)
--                                and manual paths. NULL on every order
--                                written before this; the code reads NULL
--                                as 20, because the rule applies to them
--                                too: the invoice is cut at dispatch and no
--                                e-Arşiv invoice was cut before 18 Oct 2026.
--
-- Old rows are not rewritten. Totals do not change.
--
-- Safe on a live table: a nullable column without a default changes only
-- the catalogue (no rewrite), and the check is added NOT VALID (every
-- existing value is NULL, which passes anyway; the table is not scanned
-- under the lock). Re-runnable: the bundle replays every migration when a
-- deploy adds one.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs and
-- the bundle do that themselves, right after the file.

alter table public.orders add column if not exists "shippingTaxRatePct" integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'orders_shipping_tax_rate_pct_check'
       and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_shipping_tax_rate_pct_check
      check ("shippingTaxRatePct" is null or "shippingTaxRatePct" between 0 and 100) not valid;
  end if;
end $$;

insert into public._migrations (name) values ('20261019150100_order_shipping_tax_rate.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261019160000_karaoke_notify_company_mailbox.sql
-- ─────────────────────────────────────────────────────────────────────
-- Karaoke alerts leave the consumer Gmail inbox (OP-KARAOKE-MAILBOX,
-- 19 Ekim 2026).
--
-- 20260926090000_karaoke_price_and_notify.sql pointed "karaokeNotifyEmail"
-- at a personal Gmail address. Every karaoke alert carries the guest's name,
-- e-mail, phone and note, so that inbox kept customer data on Google's
-- servers abroad with no processor agreement and no KVKK m.9/4 safeguard
-- (KVKK m.9/1, m.12/2; Yurt Dışına Aktarım Rehberi s.16: storage in a
-- provider's cloud abroad is a transfer). Alerts now go to the company's own
-- mailbox, hosted in Türkiye: empty falls back to the contact address
-- (`settings.email`, `karaokeNoticeRecipient` in src/lib/email/send.ts), and
-- the operator may enter a dedicated company address in Ayarlar -> Karaoke.
--
-- Only that literal is cleared; an address the operator typed later stays.
-- Once only, like every data step the bundle replays (the 26 Eyl update is
-- guarded the same way since this day, so a replay no longer writes the
-- Gmail address back).
--
-- Undo: none wanted. The old address must not come back.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

update public.settings
   set "karaokeNotifyEmail" = ''
 where lower(trim("karaokeNotifyEmail")) = 'bizimfutbol9@gmail.com'
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261019160000_karaoke_notify_company_mailbox.sql'
   );

insert into public._migrations (name) values ('20261019160000_karaoke_notify_company_mailbox.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261019170000_audit_logs_append_only.sql
-- ─────────────────────────────────────────────────────────────────────
-- Olay kaydı (audit_logs) becomes append-only in the database, not only in
-- the page's words (admin audit SYS-13, operator decision D30).
--
-- The panel called the log "değiştirilemez" and the published Veri Saklama
-- ve İmha Politikası says "Kayıtlar değiştirilemez (append-only) olarak
-- tutulur", but audit_logs was a plain table: the app connects as the owner
-- role, which bypasses RLS, so any UPDATE or DELETE went through. Now:
--
--   * UPDATE is refused (P0001), like customer_consents.
--   * TRUNCATE is refused (P0001).
--   * DELETE is allowed only for a row whose "createdAt" is a written
--     ISO-8601 instant older than ten years: the policy's minimum. The
--     periodic destruction (src/lib/retention.ts, rule "audit-logs") cuts at
--     10 x 366 days, which is always older than ten calendar years, so every
--     row it removes passes; a younger row, or one with no stamp ('' sorts
--     before every instant), is refused.
--
-- "createdAt" stays text written by the app (`new Date().toISOString()`,
-- "2026-10-19T11:00:00.000Z"): the filters and the ordering compare strings,
-- and the cutoff below is printed in the same shape.
--
-- Idempotent: create or replace + drop trigger if exists. No data changes.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

create or replace function public.audit_logs_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cutoff text;
begin
  if tg_op = 'DELETE' then
    cutoff := to_char(
      (now() at time zone 'UTC') - interval '10 years',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    );
    if old."createdAt" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}'
       and old."createdAt" < cutoff then
      return old;
    end if;
    raise exception 'audit_logs rows are kept for ten years (%)', old.id
      using errcode = 'P0001';
  end if;
  raise exception 'audit_logs is append-only' using errcode = 'P0001';
end;
$$;

drop trigger if exists audit_logs_no_update on public.audit_logs;
create trigger audit_logs_no_update
  before update on public.audit_logs
  for each row execute function public.audit_logs_append_only();

drop trigger if exists audit_logs_retention_delete on public.audit_logs;
create trigger audit_logs_retention_delete
  before delete on public.audit_logs
  for each row execute function public.audit_logs_append_only();

drop trigger if exists audit_logs_no_truncate on public.audit_logs;
create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function public.audit_logs_append_only();

insert into public._migrations (name) values ('20261019170000_audit_logs_append_only.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261019170200_product_food_label.sql
-- ─────────────────────────────────────────────────────────────────────
-- The label of a packaged food in the shop (19 Oct 2026, X-TGK-SHOP).
--
-- Packaged food sold at a distance carries every mandatory label item but
-- the date before the purchase is completed, and all of them at delivery
-- (TGK Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği m.17/2-a,
-- b): the items of m.9/1 are the name, the ingredients, the Ek-1 allergens,
-- the net quantity, special storage or use conditions, the food business
-- operator's name and address, the business registration number, the
-- country of origin, the instructions where needed and the nutrition
-- declaration. The product had a description, a shipping weight and the
-- `nuts` tag; the distance sales pre-information already says the product
-- page carries the rest.
--
--   allergens          jsonb, nullable, no default. The menu's three states
--                      (20261018210100_menu_item_allergens.sql): NULL not
--                      entered, [] none of the fourteen, keys the groups.
--   ingredients        the ingredient list as the label prints it (with
--                      the quantity of a named ingredient, m.9/1-ç)
--   netQuantity        "250 g", "6 adet"
--   storageConditions  special storage conditions
--   usageInstructions  how to use it, where it cannot be used properly
--                      without them
--   producer           the operator's name or trade name and address
--   businessRegNo      işletme kayıt numarası or approval mark (m.12)
--   origin             country of origin
--   nutrition          the nutrition declaration as written on the label
--
-- '' and NULL mean "not entered": nothing is shown on the product page or
-- sent to the app, and a food page keeps naming the free means (ask the
-- shop before the order). Nothing is guessed: every row starts empty and
-- the operator copies the label.
--
-- Re-runnable: the bundle replays every migration when a deploy adds one.
--
-- Rollback (nothing else reads the columns):
--   alter table public.products drop column if exists allergens,
--     drop column if exists ingredients, drop column if exists "netQuantity",
--     drop column if exists "storageConditions",
--     drop column if exists "usageInstructions", drop column if exists producer,
--     drop column if exists "businessRegNo", drop column if exists origin,
--     drop column if exists nutrition;

alter table public.products
  add column if not exists allergens jsonb,
  add column if not exists ingredients text not null default '',
  add column if not exists "netQuantity" text not null default '',
  add column if not exists "storageConditions" text not null default '',
  add column if not exists "usageInstructions" text not null default '',
  add column if not exists producer text not null default '',
  add column if not exists "businessRegNo" text not null default '',
  add column if not exists origin text not null default '',
  add column if not exists nutrition text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'products_allergens_check'
       and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_allergens_check
      check (
        allergens is null
        or (
          jsonb_typeof(allergens) = 'array'
          and allergens <@ '["gluten", "kabuklular", "yumurta", "balik",
            "yer_fistigi", "soya", "sut", "sert_kabuklu", "kereviz", "hardal",
            "susam", "sulfit", "aci_bakla", "yumusakcalar"]'::jsonb
        )
      ) not valid;
  end if;
end $$;

insert into public._migrations (name) values ('20261019170200_product_food_label.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261019170300_product_price_history.sql
-- ─────────────────────────────────────────────────────────────────────
-- The shop's price history and the dates of a discount (19 Oct 2026,
-- X-DISCOUNT, decision OP-COMPARE-AT).
--
-- An advertisement that says a price is reduced names the price before the
-- discount and the days the discount starts and ends (Ticari Reklam ve
-- Haksız Ticari Uygulamalar Yönetmeliği m.14/1). For goods the price before
-- the discount is the lowest price applied in the ten days before the
-- discount starts (m.14/3), counted in the channel where the discount runs
-- only (m.14/5: the kiosk's shelf price is not the online shop's), and the
-- seller proves it (Fiyat Etiketi Yönetmeliği m.11/1). The panel took any
-- "Eski fiyat" with no date and no record behind it.
--
--   products."discountStartsAt" / "discountEndsAt"
--     text, nullable: ISO-8601 UTC instants. The start is 00:00 and the end
--     23:59:59.999 of the Istanbul days the operator picked (UTC+3, CLAUDE.md
--     rule 22). NULL: no discount. A compare-at price without both dates is
--     never shown (src/lib/shop/discount.ts).
--
--   product_price_history
--     One row each time a product's online sale price ("priceMinor") is
--     set: the price and the instant it started to apply. Written by the
--     trigger below, so every path that sets a price (the product form,
--     the CSV import, a migration) leaves its row; nothing in the app
--     writes it. The panel refuses a compare-at price that is not the
--     lowest of the ten days before the start, and a start whose ten days
--     the history does not reach.
--
-- Each existing product gets one row with its current price from its
-- "updatedAt": every path that sets a price also sets "updatedAt", so the
-- price has applied at least since then. A product never written since
-- the column had no value starts now. The ten days are counted from there:
-- a discount on such a product can start ten days later at the earliest.
--
-- A compare-at price stored before this has no dates, so it can never be
-- shown and would refuse every save of its product: it is set to 0 (the
-- operator's step of 18 Oct 2026 for prd-0008, done for every product).
-- From here on the panel stores a compare-at price only with both dates.
--
-- Re-runnable: the bundle replays every migration when a deploy adds one.
-- The backfill skips a product that already has a row; the clearing finds
-- nothing once every compare-at price carries its dates.
--
-- Rollback (the cleared compare-at prices are not restored: they were
-- shown without the dates the regulation asks for):
--   drop trigger if exists products_price_history on public.products;
--   drop function if exists public.record_product_price();
--   drop table if exists public.product_price_history;
--   alter table public.products drop column if exists "discountStartsAt",
--     drop column if exists "discountEndsAt";

alter table public.products
  add column if not exists "discountStartsAt" text,
  add column if not exists "discountEndsAt" text;

create table if not exists public.product_price_history (
  id           bigserial primary key,
  "productId"  text    not null references public.products (id) on delete cascade,
  "priceMinor" integer not null,
  "startedAt"  text    not null
);
create index if not exists product_price_history_product_idx
  on public.product_price_history ("productId", "startedAt");
alter table public.product_price_history enable row level security;

create or replace function public.record_product_price()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new."priceMinor" is distinct from old."priceMinor" then
    insert into public.product_price_history ("productId", "priceMinor", "startedAt")
    values (
      new.id,
      new."priceMinor",
      to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists products_price_history on public.products;
create trigger products_price_history
  after insert or update of "priceMinor" on public.products
  for each row execute function public.record_product_price();

insert into public.product_price_history ("productId", "priceMinor", "startedAt")
select p.id,
       p."priceMinor",
       coalesce(
         nullif(p."updatedAt", ''),
         to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
       )
  from public.products p
 where not exists (
   select 1 from public.product_price_history h where h."productId" = p.id
 );

update public.products
   set "compareAtPriceMinor" = 0
 where "compareAtPriceMinor" <> 0
   and ("discountStartsAt" is null or "discountEndsAt" is null);

insert into public._migrations (name) values ('20261019170300_product_price_history.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261020180000_legal_doc_versions.sql
-- ─────────────────────────────────────────────────────────────────────
-- Every legal text the site has shown, kept by the SHA-256 of the text itself
-- (decisions D-VERSIONS-TABLE and ASK-DURABLE, 20 Oct 2026; LEGAL-REDLINES
-- §25).
--
-- A consent recorded only a version label (`legalConsent.version`, "20 Ekim
-- 2026"), and two different texts could carry the same label: a panel
-- override and the coded text, or two changes merged on one Istanbul day
-- (the D-SAME-DAY rule existed for that). Now every consent also records the
-- hash of each text it confirmed (`legalConsent.textHashes`, { slug: sha256 })
-- and the text behind each hash lives here:
--
--   hash        sha256 (lowercase hex) of `body`, its UTF-8 bytes exactly.
--               The CHECK below makes the database refuse a row whose hash
--               is not the hash of its text: a row is its own proof.
--               Collation "C" so a hex prefix is a plain byte range.
--   slug        the document (`/hukuk/<slug>`).
--   body        the document as /hukuk/<slug> showed it, in the one form its
--               hash is taken of: canonical JSON written by
--               src/lib/legal/version-core.ts (title, summary, date, then the
--               coded sections with their tokens filled, or the panel's
--               Markdown). The database never parses it.
--   "createdAt" when the text was first stored (ISO-8601 UTC). It defaults to
--               the database clock and the app never writes it, so a row's
--               age is the database's word (a direct INSERT could still set
--               it; the app has no such path).
--
-- Writers (INSERT ... ON CONFLICT (hash) DO NOTHING in one statement, never a
-- read-modify-write): the checkout and karaoke consents (the texts they
-- record), the panel's save, reset and restore (the text shown before the
-- change, written before it, and the one shown after, once the change is
-- written), the daily cron (every document as shown that day: a text no
-- consent names is here within a day of the deploy that changed it), and the
-- confirmation mails and the two contract downloads, which store a confirmed
-- text that is still shown but missing. No public page view writes here.
--
-- Readers: /hukuk/<slug>?surum=<prefix> (only with that parameter), the
-- confirmation e-mails' attachment and the member's download.
--
-- Append-only: UPDATE and TRUNCATE are refused (P0001). DELETE passes only
-- for a row whose "createdAt" is a written instant older than eleven years:
-- the periodic destruction (src/lib/retention.ts, rule "legal-doc-versions")
-- cuts at 11 x 366 days through legal_doc_versions_retention below, which
-- also keeps every text a consent of the last eleven years names, every text
-- that was not replaced before the cutoff and every text shown today.
--
-- Idempotent: create if not exists, create or replace, drop trigger if
-- exists. No `insert into public._migrations`: scripts/db-migrate.mjs records
-- the file itself.
--
-- Rollback (loses every stored text; only before the first consent records a
-- hash):
--   drop function if exists public.legal_doc_versions_retention(text, boolean, jsonb);
--   drop table if exists public.legal_doc_versions;
--   drop function if exists public.legal_doc_versions_append_only();

create table if not exists public.legal_doc_versions (
  hash        text collate "C" primary key,
  slug        text not null,
  body        text not null,
  "createdAt" text not null
              default to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  constraint legal_doc_versions_hash_shape
    check (hash ~ '^[0-9a-f]{64}$'),
  constraint legal_doc_versions_hash_of_body
    check (hash = encode(sha256(convert_to(body, 'UTF8')), 'hex')),
  constraint legal_doc_versions_slug_shape
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index if not exists legal_doc_versions_slug_idx
  on public.legal_doc_versions (slug, "createdAt");

alter table public.legal_doc_versions enable row level security;

-- ── append-only ─────────────────────────────────────────────────────────
create or replace function public.legal_doc_versions_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cutoff text;
begin
  if tg_op = 'DELETE' then
    cutoff := to_char(
      (now() at time zone 'UTC') - interval '11 years',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    );
    if old."createdAt" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}'
       and old."createdAt" < cutoff then
      return old;
    end if;
    raise exception 'legal_doc_versions rows are kept for eleven years (%)', old.hash
      using errcode = 'P0001';
  end if;
  raise exception 'legal_doc_versions is append-only' using errcode = 'P0001';
end;
$$;

drop trigger if exists legal_doc_versions_no_update on public.legal_doc_versions;
create trigger legal_doc_versions_no_update
  before update on public.legal_doc_versions
  for each row execute function public.legal_doc_versions_append_only();

drop trigger if exists legal_doc_versions_retention_delete on public.legal_doc_versions;
create trigger legal_doc_versions_retention_delete
  before delete on public.legal_doc_versions
  for each row execute function public.legal_doc_versions_append_only();

drop trigger if exists legal_doc_versions_no_truncate on public.legal_doc_versions;
create trigger legal_doc_versions_no_truncate
  before truncate on public.legal_doc_versions
  for each statement execute function public.legal_doc_versions_append_only();

-- ── legal_doc_versions_retention ────────────────────────────────────────
-- The period as a query. A row is in scope only when ALL of these hold:
--   - it was first stored before p_cutoff;
--   - a later text of the same document was first stored, also before
--     p_cutoff (the text stopped being the newest more than eleven years ago:
--     the newest text of a document is never in scope, however old);
--   - it is not a text shown today (p_keep, a JSON array of hashes the
--     caller works out from the live documents: a text replaced long ago can
--     be shown again, a coded text after a reset, and its row keeps its
--     first "createdAt");
--   - no order and no karaoke booking whose consent was accepted at or after
--     p_cutoff names it in `legalConsent.textHashes`.
-- A text first stored twelve years ago and confirmed by an order last year
-- stays; the contract it proves is still inside its ten years.
--
-- Without p_keep (null, or not an array) nothing is in scope: the caller
-- that cannot say what is shown today removes nothing.
--
-- p_apply false counts only; true deletes and returns how many went.
drop function if exists public.legal_doc_versions_retention(text, boolean);

create or replace function public.legal_doc_versions_retention(
  p_cutoff text,
  p_apply  boolean,
  p_keep   jsonb
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  affected integer := 0;
begin
  if p_keep is null or jsonb_typeof(p_keep) <> 'array' then
    return 0;
  end if;
  if p_apply then
    delete from public.legal_doc_versions v
     where v."createdAt" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
       and v."createdAt" < p_cutoff
       and not (p_keep ? v.hash)
       and exists (
         select 1
           from public.legal_doc_versions w
          where w.slug = v.slug
            and w."createdAt" > v."createdAt"
            and w."createdAt" < p_cutoff
       )
       and not exists (
         select 1
           from public.orders o
          where o."legalConsent" -> 'textHashes' ->> v.slug = v.hash
            and coalesce(o."legalConsent" ->> 'acceptedAt', '') >= p_cutoff
       )
       and not exists (
         select 1
           from public.karaoke_reservations k
          where k."legalConsent" -> 'textHashes' ->> v.slug = v.hash
            and coalesce(k."legalConsent" ->> 'acceptedAt', '') >= p_cutoff
       );
    get diagnostics affected = row_count;
  else
    select count(*) into affected
      from public.legal_doc_versions v
     where v."createdAt" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
       and v."createdAt" < p_cutoff
       and not (p_keep ? v.hash)
       and exists (
         select 1
           from public.legal_doc_versions w
          where w.slug = v.slug
            and w."createdAt" > v."createdAt"
            and w."createdAt" < p_cutoff
       )
       and not exists (
         select 1
           from public.orders o
          where o."legalConsent" -> 'textHashes' ->> v.slug = v.hash
            and coalesce(o."legalConsent" ->> 'acceptedAt', '') >= p_cutoff
       )
       and not exists (
         select 1
           from public.karaoke_reservations k
          where k."legalConsent" -> 'textHashes' ->> v.slug = v.hash
            and coalesce(k."legalConsent" ->> 'acceptedAt', '') >= p_cutoff
       );
  end if;
  return affected;
end;
$$;

insert into public._migrations (name) values ('20261020180000_legal_doc_versions.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261020203619_karaoke_make_good.sql
-- ─────────────────────────────────────────────────────────────────────
-- Karaoke: the köşk's late cancel is made good, and an hour cancelled late
-- and sold again refunds the share kept for it.
--
-- OP-KARAOKE-GOODWILL (18 Eki 2026; Haksız Şartlar Yön. EK-1 (ç)): when the
-- köşk has to cancel after the guest's own free moment, for a reason that is
-- not force majeure, and the booking keeps a share on a late cancel, the
-- guest gets that share again as a make-good on top of the full refund: an
-- hour of the same length for free (booked within 6 months) or the amount
-- paid to their own bank account. One of the two; the other then closes.
--
-- ASK-OTH-3-CFG (18 Eki 2026; TBK m.325/2 kıyasen): an hour a guest
-- cancelled late (a late share of 1..99 %) that is sold again refunds the
-- share kept for it. Each hour once, to the booking that last cancelled it
-- late; the hours already counted are kept on that booking.
--
-- karaoke_reservations, on the cancelled booking:
--   "makeGoodUntil"      the last day (YYYY-MM-DD, Istanbul) the free hour
--                        can be booked: the cancel day plus 6 months
--   "makeGoodMinor"      the make-good, kuruş (the share a late cancel keeps)
--   "makeGoodUsedAt"     when it was used (ISO): an hour given or the money
--                        paid; NULL while open
--   "makeGoodPaidMinor"  paid by bank transfer: the amount, kuruş
--   "makeGoodPaidOn"     and the day of the transfer (YYYY-MM-DD). The IBAN
--                        is never written here; the receipt stays with the
--                        accounts.
--   "resoldHours"        hours (start hours, jsonb array) already refunded
--                        because they were sold again
--   "resaleRefundMinor"  the part of "refundMinor" owed or refunded for them
--   "refundSettledMinor" the part of "refundMinor" that had already gone back
--                        (recorded by hand) when the booking was owed money
--                        again because one of its hours was sold again: the
--                        step under way asks for "refundMinor" minus this
--   "refundSteps"        every refund recorded by hand ("Elle iade edildi"),
--                        each with its own amount and instant (jsonb array of
--                        {"minor", "at"}): a late share refunded one day and
--                        the rest of it, after a resale, another day stay two
--                        refunds on two days (the Gün sonu sheet)
-- on the free hour itself:
--   "makeGoodFor"        the booking it makes good. Total 0, paid nothing
--                        (paymentStatus 'none'), made by the staff
--                        (channel 'staff'); at most one live per booking.
--
-- karaoke_open_cap: a free hour the staff give is not one of the guest's own
-- open bookings, so it neither hits nor uses up the cap.
--
-- karaoke_charge_resold_hours: counts sold-again hours on a late-cancelled
-- booking under its row lock (rule 20: two payments for different hours of
-- the same evening must not lose each other's count, and the same hour
-- reported twice is counted once).
--
-- karaoke_give_make_good_hour: "Telafi saati ver" in one statement: the
-- make-good is claimed and the free hour written together, under the made
-- good booking's row lock, so a free hour that cannot be written (its hour
-- taken, 23P01) leaves the make-good open, and the claim never survives
-- without its hour.
--
-- karaoke_release_make_good_hour: the free hour cancelled, and (before it
-- began) its make-good open again, in one statement: the guest never loses
-- the make-good to a cancel whose second write did not happen.
--
-- Safe on a live table: nullable columns, checks every existing row
-- satisfies (all NULL), a partial unique index over no rows yet.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.karaoke_reservations add column if not exists "makeGoodUntil"     text;
alter table public.karaoke_reservations add column if not exists "makeGoodMinor"     integer;
alter table public.karaoke_reservations add column if not exists "makeGoodUsedAt"    text;
alter table public.karaoke_reservations add column if not exists "makeGoodPaidMinor" integer;
alter table public.karaoke_reservations add column if not exists "makeGoodPaidOn"    text;
alter table public.karaoke_reservations add column if not exists "makeGoodFor"       text;
alter table public.karaoke_reservations add column if not exists "resoldHours"       jsonb;
alter table public.karaoke_reservations add column if not exists "resaleRefundMinor" integer;
alter table public.karaoke_reservations add column if not exists "refundSettledMinor" integer;
alter table public.karaoke_reservations add column if not exists "refundSteps"       jsonb;

do $$
begin
  -- A make-good has an amount and a last day together, is used at most once,
  -- and a transfer has both its amount and its day.
  if not exists (
    select 1 from pg_constraint
     where conname = 'karaoke_reservations_make_good_check'
       and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_make_good_check
      check (
        ("makeGoodUntil" is null) = ("makeGoodMinor" is null)
        and ("makeGoodMinor" is null or "makeGoodMinor" > 0)
        and ("makeGoodUsedAt" is null or "makeGoodUntil" is not null)
        and ("makeGoodPaidMinor" is null) = ("makeGoodPaidOn" is null)
        and ("makeGoodPaidMinor" is null
             or ("makeGoodPaidMinor" > 0 and "makeGoodUsedAt" is not null))
      );
  end if;
  -- The resale part is a part of what goes back: never more, never negative.
  if not exists (
    select 1 from pg_constraint
     where conname = 'karaoke_reservations_resale_refund_check'
       and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_resale_refund_check
      check ("resaleRefundMinor" is null
             or ("resaleRefundMinor" >= 0
                 and "refundMinor" is not null
                 and "resaleRefundMinor" <= "refundMinor"));
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'karaoke_reservations_refund_settled_check'
       and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_refund_settled_check
      check ("refundSettledMinor" is null
             or ("refundSettledMinor" >= 0
                 and "refundMinor" is not null
                 and "refundSettledMinor" <= "refundMinor"));
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'karaoke_reservations_refund_steps_check'
       and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_refund_steps_check
      check ("refundSteps" is null or jsonb_typeof("refundSteps") = 'array');
  end if;
end $$;

-- One live free hour per booking made good: two staff members pressing
-- "Telafi saati ver" at once cannot give two.
create unique index if not exists karaoke_reservations_make_good_once
  on public.karaoke_reservations ("makeGoodFor")
  where "makeGoodFor" is not null and status <> 'cancelled';

-- Same as 20261016063311_karaoke_prepay.sql, plus: a free hour the staff
-- give ("makeGoodFor" set) is neither capped nor counted.
create or replace function public.karaoke_open_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  today      text;
  open_count int;
begin
  if new.status = 'cancelled' or new."makeGoodFor" is not null then
    return new;
  end if;
  perform pg_advisory_xact_lock(
    hashtext('karaoke-open-cap:' || case when new.guest then 'guest:' else '' end
             || lower(new."customerEmail")));
  today := to_char((now() at time zone 'Europe/Istanbul')::date, 'YYYY-MM-DD');
  select count(*) into open_count
    from public.karaoke_reservations
   where lower("customerEmail") = lower(new."customerEmail")
     and guest = new.guest
     and status <> 'cancelled'
     and "makeGoodFor" is null
     and date >= today;
  if open_count >= 2 then  -- KARAOKE_OPEN_CAP
    raise exception 'TOO_MANY_OPEN_RESERVATIONS' using errcode = 'P0001';
  end if;
  if new.guest and new."contactPhone" <> '' then
    perform pg_advisory_xact_lock(
      hashtext('karaoke-open-cap-phone:' || new."contactPhone"));
    select count(*) into open_count
      from public.karaoke_reservations
     where guest
       and "contactPhone" = new."contactPhone"
       and status <> 'cancelled'
       and "makeGoodFor" is null
       and date >= today;
    if open_count >= 2 then  -- KARAOKE_OPEN_CAP
      raise exception 'TOO_MANY_OPEN_RESERVATIONS' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- Hours of a late-cancelled booking that were sold again (`p_hours`, a jsonb
-- array of start hours; those outside the booking and those already counted
-- are ignored). Returns the kuruş this call added to what goes back, 0 when
-- nothing new. The share a late cancel kept is "paidMinor" minus the late
-- refund ("refundMinor" without its resale part); the resale part is
-- round(kept x counted hours / hours) of it, counted as a whole each time
-- (half a kuruş rounds up, numeric round), so the parts add up to exactly
-- what was kept and never more. Money owed again puts the booking back in
-- 'refunding': a person refunds it in PayNkolay's panel (partial refunds are
-- not sent to the POS, docs/PAYNKOLAY.md §3.2). A booking that was
-- 'refunded' keeps what had already gone back in "refundSettledMinor", so
-- the panel asks only for the rest. "updatedAt" is not touched: on a
-- cancelled row it is the cancel instant, which decides the booking that
-- cancelled an hour last.
create or replace function public.karaoke_charge_resold_hours(
  p_id    text,
  p_hours jsonb
)
returns int
language plpgsql
set search_path = ''
as $$
declare
  r       public.karaoke_reservations%rowtype;
  counted jsonb;
  fresh   jsonb;
  before  int;
  share   int;
  kept    int;
  after   int;
begin
  select * into r
    from public.karaoke_reservations
   where id = p_id
     for update;
  if not found
     or r.status <> 'cancelled'
     or r."refundMinor" is null
     or r."paymentStatus" not in ('refunding', 'refunded')
     or r."makeGoodFor" is not null
     or r.hours <= 0 then
    return 0;
  end if;
  counted := coalesce(r."resoldHours", '[]'::jsonb);
  select coalesce(jsonb_agg(h order by h), '[]'::jsonb) into fresh
    from (
      select distinct (value)::int as h
        from jsonb_array_elements_text(coalesce(p_hours, '[]'::jsonb))
    ) asked
   where h >= r."startHour"
     and h < r."startHour" + r.hours
     and not counted @> to_jsonb(h);
  if jsonb_array_length(fresh) = 0 then
    return 0;
  end if;
  before := coalesce(r."resaleRefundMinor", 0);
  share := r."refundMinor" - before;
  kept := r."paidMinor" - share;
  if kept <= 0 then
    return 0;
  end if;
  after := round(
    kept::numeric * (jsonb_array_length(counted) + jsonb_array_length(fresh))
      / r.hours
  )::int;
  update public.karaoke_reservations
     set "resoldHours" = counted || fresh,
         "resaleRefundMinor" = after,
         "refundMinor" = share + after,
         "paymentStatus" = case
           when after > before then 'refunding'
           else "paymentStatus"
         end,
         "refundSettledMinor" = case
           when after > before and r."paymentStatus" = 'refunded'
             then r."refundMinor"
           else r."refundSettledMinor"
         end
   where id = p_id;
  return after - before;
end;
$$;

-- "Telafi saati ver": the free hour of the same length for the guest of a
-- booking the köşk cancelled late, and the make-good used by it, in one
-- statement. 'given'; 'not_open' when the booking has no open make-good
-- (never had one, or its hour or its money was used: the other then
-- closes); 'expired' past the free hour's last day (`p_today`, Istanbul).
-- The hour copies the guest (address, name, contact, guest flag) and the
-- length from the booking; the day, the start, the group and the policy
-- snapshot come from the caller, which checked them against the room
-- (karaoke-payment.ts). The overlap constraint (23P01) and the one live hour
-- per booking (23505) still hold: either error undoes the claim too.
create or replace function public.karaoke_give_make_good_hour(
  p_for                 text,
  p_id                  text,
  p_date                text,
  p_start_hour          integer,
  p_guests              integer,
  p_today               text,
  p_now                 text,
  p_tax_rate_pct        integer,
  p_free_cancel_hours   integer,
  p_late_refund_percent integer,
  p_cancel_deadline     text,
  p_cancellation_rules  jsonb
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  r public.karaoke_reservations%rowtype;
begin
  select * into r
    from public.karaoke_reservations
   where id = p_for
     for update;
  if not found
     or r.status <> 'cancelled'
     or r."makeGoodMinor" is null
     or r."makeGoodUntil" is null
     or r."makeGoodUsedAt" is not null then
    return 'not_open';
  end if;
  if p_today > r."makeGoodUntil" then
    return 'expired';
  end if;
  update public.karaoke_reservations
     set "makeGoodUsedAt" = p_now
   where id = p_for;
  insert into public.karaoke_reservations (
    id, "customerEmail", "customerName", "contactEmail", "contactPhone",
    "contactConsentAt", date, "startHour", hours, guests, status,
    "priceMinor", "discountMinor", "totalMinor", note, "createdAt",
    "updatedAt", "paymentStatus", "paymentDueAt", "paidAt", "refundedAt",
    "paidMinor", "paymentRef", channel, "legalConsent", guest, "taxRatePct",
    "freeCancelHours", "lateRefundPercent", "cancelDeadline",
    "cancellationRules", "refundMinor", "makeGoodFor"
  ) values (
    p_id, r."customerEmail", r."customerName", r."contactEmail",
    r."contactPhone", r."contactConsentAt", p_date, p_start_hour, r.hours,
    p_guests, 'confirmed', 0, 0, 0, 'Telafi: ' || upper(r.id), p_now, p_now,
    'none', '', '', '', 0, '', 'staff', null, r.guest, p_tax_rate_pct,
    p_free_cancel_hours, p_late_refund_percent, p_cancel_deadline,
    p_cancellation_rules, null, r.id
  );
  return 'given';
end;
$$;

-- A free hour let go (the guest on its page or through the app, the köşk in
-- the panel): cancelled while it is still the confirmed free hour it was
-- read as; with `p_reopen` (the caller's clock says the hour has not begun)
-- the make-good it used is open again, unless the money was recorded.
-- 'reopened', 'cancelled', or 'raced' when the hour had moved on (nothing
-- written). "updatedAt" is the cancel instant, as on every cancelled row.
create or replace function public.karaoke_release_make_good_hour(
  p_id     text,
  p_now    text,
  p_reopen boolean
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  hour_for text;
begin
  update public.karaoke_reservations
     set status = 'cancelled',
         "updatedAt" = p_now
   where id = p_id
     and status = 'confirmed'
     and "paymentStatus" = 'none'
     and "makeGoodFor" is not null
  returning "makeGoodFor" into hour_for;
  if not found then
    return 'raced';
  end if;
  if p_reopen then
    update public.karaoke_reservations
       set "makeGoodUsedAt" = null
     where id = hour_for
       and "makeGoodPaidMinor" is null
       and "makeGoodUsedAt" is not null;
    if found then
      return 'reopened';
    end if;
  end if;
  return 'cancelled';
end;
$$;

insert into public._migrations (name) values ('20261020203619_karaoke_make_good.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261021050500_customer_milestone_rewards_rls.sql
-- ─────────────────────────────────────────────────────────────────────
-- Row level security on customer_milestone_rewards (20 Oct 2026).
--
-- Every other table in the schema has RLS on and no policy;
-- customer_milestone_rewards (20260923200000) was the one table created
-- without it. On Neon nothing changes: the app connects as the table's
-- owner, and an owner is not subject to RLS. On a Supabase database the
-- difference is real: every table in `public` is exposed through PostgREST,
-- and without RLS the anon and authenticated roles could read which member
-- got which gift, and write rows that stop a milestone from ever being
-- granted (its primary key is the grant's guard). RLS without a policy
-- closes the table to those roles, as for every other table.
--
-- No policy on purpose, and no grant: the roles above do not exist on Neon,
-- and the app never needs one (docs/SUPABASE-GECIS.md §1).
-- tests/db-rls.test.ts holds RLS on for every table the schema creates.
--
-- Re-runnable (enabling RLS twice is a no-op). Rollback:
--   alter table public.customer_milestone_rewards disable row level security;

alter table public.customer_milestone_rewards enable row level security;

insert into public._migrations (name) values ('20261021050500_customer_milestone_rewards_rls.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261021050600_supabase_keepalive.sql
-- ─────────────────────────────────────────────────────────────────────
-- The daily Supabase keep-alive, made visible (20 Oct 2026).
--
-- /api/cron/daily pings the free-plan Supabase project every morning so it
-- never pauses for inactivity (keepSupabaseAwake, docs/SUPABASE-GECIS.md
-- §0). The result went into the cron's response body and nowhere else, and
-- CRON_SECRET is "sensitive" on Vercel: nobody could see whether the ping
-- still got through. A paused project refuses every sign-in.
--
--   supabase_keepalive
--     One row (id 'supabase'): the latest attempt (its outcome and when)
--     and the latest success. Written by the cron in ONE statement, an
--     upsert that sets "lastSuccessAt" only on an "ok" (CLAUDE.md rule 20:
--     no read-modify-write). Read live by the owner's dashboard
--     (/admin, Genel bakış), never cached.
--
-- A single row rather than a log: the dashboard needs exactly these two
-- facts, a log would grow by a row a day and need a retention rule, and this
-- row holds no personal data, so nothing in the published retention policy
-- applies to it. The checks pin its shape: an outcome word and two
-- ISO-8601 UTC instants. No key, no response body, no member data can be
-- stored here, by mistake or otherwise.
--
-- Row level security on, no policy, like every other table
-- (tests/db-rls.test.ts). Re-runnable. Rollback:
--   drop table if exists public.supabase_keepalive;

create table if not exists public.supabase_keepalive (
  id              text primary key,
  "lastStatus"    text not null,
  "lastAttemptAt" text not null,
  "lastSuccessAt" text not null default '',
  constraint supabase_keepalive_one_row check (id = 'supabase'),
  constraint supabase_keepalive_status
    check ("lastStatus" in ('ok', 'failed', 'skipped')),
  constraint supabase_keepalive_attempt_at
    check ("lastAttemptAt" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'),
  constraint supabase_keepalive_success_at
    check (
      "lastSuccessAt" = ''
      or "lastSuccessAt" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
    )
);

alter table public.supabase_keepalive enable row level security;

insert into public._migrations (name) values ('20261021050600_supabase_keepalive.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261021090000_karaoke_guest_retention.sql
-- ─────────────────────────────────────────────────────────────────────
-- Karaoke bookings: the guest's identity and every contact detail go three
-- years after the booking day, the booking itself after eleven (decision
-- ASK-RETENTION, legal programme of 18 Oct 2026; KVKK m.4/2-d and m.7/1;
-- Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi
-- Hakkında Yönetmelik m.11: at the first periodic destruction once the
-- period is over).
--
-- The Veri Saklama ve İmha Politikası gave a booking made without an account
-- no period at all: the name, e-mail and phone a guest typed stayed for ever,
-- and so did the contact address, phone and note of every booking. The
-- policy now publishes two periods (src/lib/legal/content.ts) and
-- src/lib/retention.ts runs them, daily, through the two functions below:
--
--   karaoke_guest_retention        3 x 366 days after "date". On a guest
--                                  booking the name goes and "customerEmail"
--                                  becomes 'anon-<id>@anon.local'. On every
--                                  booking "contactEmail", "contactPhone" and
--                                  note go, and the consent record keeps its
--                                  time, documents and version but loses
--                                  "ip" and "userAgent" (a NULL record stays
--                                  NULL). The member's own name and address
--                                  stay: the membership keeps them, and
--                                  account deletion clears them.
--   karaoke_reservation_retention  11 x 366 days after the latest of "date",
--                                  "paidAt" and "refundedAt": the row goes.
--                                  Payment and refund records are kept ten
--                                  years from the end of their calendar year
--                                  (TTK m.82/5-6), so eleven 366-day years
--                                  from the last of them never take one early.
--
-- Both skip a booking whose money is still open ('pending': a hold the POS
-- has not settled; 'refunding': a refund the POS has not confirmed; neither
-- is finished, CLAUDE.md rule 29), one the panel still lists as money owed
-- (paid and cancelled, or paid and never confirmed: listKaraokeRefundsOwed,
-- listKaraokeAttention), one with a 'refunding' claim in payment_transactions
-- (a second charge's refund whose answer never came), and one under a hold:
--
--   "retentionHold"  '' (the default): nothing stops the destruction.
--                    Otherwise the reason the row is kept past its period: a
--                    dispute, a complaint or an official request ("Hakkında
--                    uyuşmazlık bulunan kayıt, uyuşmazlık kesin olarak
--                    sonuçlanana kadar saklanır"). Written and cleared by
--                    hand in SQL; nothing in the app writes it, and no API
--                    response carries it.
--
-- "date" is the köşk's calendar day ("YYYY-MM-DD", Europe/Istanbul), compared
-- as text with the first ten characters of p_cutoff, which retention.ts
-- writes on the köşk's clock (+03:00, CLAUDE.md rule 22). Two guards keep a
-- bad value from destroying early: a cutoff that is not a day, or is less
-- than a year back (every period here is years), raises (22007) instead of
-- matching; a row whose "date" is not in that shape is never in scope (a
-- malformed day can sort before any cutoff).
--
-- The guest placeholder never collides with account deletion's
-- 'deleted-<customer id>@anon.local' (src/lib/mobile/me.ts): another prefix
-- and the booking's own id, so it is unique per row. Account deletion only
-- rewrites member rows (guest = false), so it never meets one.
--
-- A row already cleared is not counted again: the guest function counts and
-- updates only rows that still hold something to clear, so a second run with
-- the same cutoff answers 0. p_apply false only counts and writes nothing.
-- Both return integer (one cell), so retention.ts calls them through rpc(),
-- never rpcRows() (CLAUDE.md rule 23).
--
-- Safe on a live table: one column with a default every row satisfies, and
-- two functions. Undo:
--   drop function if exists public.karaoke_guest_retention(text, boolean);
--   drop function if exists public.karaoke_reservation_retention(text, boolean);
--   alter table public.karaoke_reservations drop column if exists "retentionHold";
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.karaoke_reservations
  add column if not exists "retentionHold" text not null default '';

-- ── karaoke_guest_retention ─────────────────────────────────────────────
create or replace function public.karaoke_guest_retention(
  p_cutoff text,
  p_apply boolean
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  cutoff_day text := left(p_cutoff, 10);
  affected   integer := 0;
begin
  if cutoff_day is null
     or cutoff_day !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or cutoff_day > to_char((now() at time zone 'Europe/Istanbul')::date - 365,
                             'YYYY-MM-DD') then
    raise exception 'karaoke_guest_retention: cutoff % is not a day a year or more back', p_cutoff
      using errcode = '22007';
  end if;

  if p_apply then
    update public.karaoke_reservations r
       set "customerName"  = case when r.guest then '' else r."customerName" end,
           "customerEmail" = case when r.guest
                                  then 'anon-' || r.id || '@anon.local'
                                  else r."customerEmail" end,
           "contactEmail"  = '',
           "contactPhone"  = '',
           note            = '',
           "legalConsent"  = case when jsonb_typeof(r."legalConsent") = 'object'
                                  then r."legalConsent" - 'ip' - 'userAgent'
                                  else r."legalConsent" end
     where r.date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       and r.date < cutoff_day
       and r."paymentStatus" not in ('pending', 'refunding')
       -- Money still owed, as the panel reads it (listKaraokeRefundsOwed,
       -- listKaraokeAttention): paid and cancelled, or paid and never
       -- confirmed.
       and not (r."paymentStatus" = 'paid' and r.status in ('requested', 'cancelled'))
       -- A refund claim the POS has not answered, a second charge's included.
       and not exists (
         select 1 from public.payment_transactions t
          where t."orderId" = r.id and t.status = 'refunding'
       )
       and r."retentionHold" = ''
       and (
         (r.guest and (r."customerName" <> ''
                       or r."customerEmail" <> ('anon-' || r.id || '@anon.local')))
         or r."contactEmail" <> ''
         or r."contactPhone" <> ''
         or r.note <> ''
         or (jsonb_typeof(r."legalConsent") = 'object'
             and ((r."legalConsent" ? 'ip') or (r."legalConsent" ? 'userAgent')))
       );
    get diagnostics affected = row_count;
  else
    select count(*) into affected
      from public.karaoke_reservations r
     where r.date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       and r.date < cutoff_day
       and r."paymentStatus" not in ('pending', 'refunding')
       -- Money still owed, as the panel reads it (listKaraokeRefundsOwed,
       -- listKaraokeAttention): paid and cancelled, or paid and never
       -- confirmed.
       and not (r."paymentStatus" = 'paid' and r.status in ('requested', 'cancelled'))
       -- A refund claim the POS has not answered, a second charge's included.
       and not exists (
         select 1 from public.payment_transactions t
          where t."orderId" = r.id and t.status = 'refunding'
       )
       and r."retentionHold" = ''
       and (
         (r.guest and (r."customerName" <> ''
                       or r."customerEmail" <> ('anon-' || r.id || '@anon.local')))
         or r."contactEmail" <> ''
         or r."contactPhone" <> ''
         or r.note <> ''
         or (jsonb_typeof(r."legalConsent") = 'object'
             and ((r."legalConsent" ? 'ip') or (r."legalConsent" ? 'userAgent')))
       );
  end if;
  return affected;
end;
$$;

-- ── karaoke_reservation_retention ───────────────────────────────────────
create or replace function public.karaoke_reservation_retention(
  p_cutoff text,
  p_apply boolean
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  cutoff_day text := left(p_cutoff, 10);
  affected   integer := 0;
begin
  if cutoff_day is null
     or cutoff_day !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or cutoff_day > to_char((now() at time zone 'Europe/Istanbul')::date - 365,
                             'YYYY-MM-DD') then
    raise exception 'karaoke_reservation_retention: cutoff % is not a day a year or more back', p_cutoff
      using errcode = '22007';
  end if;

  if p_apply then
    delete from public.karaoke_reservations r
     where r.date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       and greatest(r.date,
                    left(nullif(r."paidAt", ''), 10),
                    left(nullif(r."refundedAt", ''), 10)) < cutoff_day
       and r."paymentStatus" not in ('pending', 'refunding')
       -- Money still owed, as the panel reads it (listKaraokeRefundsOwed,
       -- listKaraokeAttention): paid and cancelled, or paid and never
       -- confirmed.
       and not (r."paymentStatus" = 'paid' and r.status in ('requested', 'cancelled'))
       -- A refund claim the POS has not answered, a second charge's included.
       and not exists (
         select 1 from public.payment_transactions t
          where t."orderId" = r.id and t.status = 'refunding'
       )
       and r."retentionHold" = '';
    get diagnostics affected = row_count;
  else
    select count(*) into affected
      from public.karaoke_reservations r
     where r.date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       and greatest(r.date,
                    left(nullif(r."paidAt", ''), 10),
                    left(nullif(r."refundedAt", ''), 10)) < cutoff_day
       and r."paymentStatus" not in ('pending', 'refunding')
       -- Money still owed, as the panel reads it (listKaraokeRefundsOwed,
       -- listKaraokeAttention): paid and cancelled, or paid and never
       -- confirmed.
       and not (r."paymentStatus" = 'paid' and r.status in ('requested', 'cancelled'))
       -- A refund claim the POS has not answered, a second charge's included.
       and not exists (
         select 1 from public.payment_transactions t
          where t."orderId" = r.id and t.status = 'refunding'
       )
       and r."retentionHold" = '';
  end if;
  return affected;
end;
$$;

insert into public._migrations (name) values ('20261021090000_karaoke_guest_retention.sql')
  on conflict (name) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- 20261022120000_menu_prices_changed_at.sql
-- ─────────────────────────────────────────────────────────────────────
-- The instant a cafe menu price last changed (22 Oct 2026).
--
-- The köşk's back-office panel (ladmin.laffogato.net) may now change a
-- linked menu item's price through POST /api/panel/menu (docs/PANEL-MENU.md),
-- beside this panel's own menu form. The price list's day under the menu
-- (settings."menuPricesEffectiveDate", Fiyat Etiketi Yönetmeliği m.5/2-d)
-- stays the operator's to set (decision OP-PRICE-LISTS: the printed lists at
-- the kiosk carry the same day, nothing guesses it). What this adds is the
-- other half of the comparison: every price change, from either panel,
-- writes the instant here, and Kafe menüsü says when the day is older.
--
--   settings."menuPricesChangedAt"  text, ISO instant; '' = none recorded
--
-- Never printed on the site; no price is read from it. Safe on the live
-- table: a constant default changes only the catalogue. Re-runnable.
--
-- Rollback (nothing else reads the column):
--   alter table public.settings drop column if exists "menuPricesChangedAt";

alter table public.settings add column if not exists "menuPricesChangedAt" text not null default '';

insert into public._migrations (name) values ('20261022120000_menu_prices_changed_at.sql')
  on conflict (name) do nothing;
