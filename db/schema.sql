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
