-- L'Affogato — initial Supabase (Postgres) schema.
--
-- Mirrors the former MongoDB document model 1:1: camelCase quoted columns,
-- JSONB for nested arrays/objects, ISO-8601 text timestamps (so existing
-- string ordering / `new Date(...)` parsing keeps working unchanged).
--
-- All access is server-side through the service-role key. RLS is enabled on
-- every table with NO public policies, so the anon / publishable key can read
-- nothing — the service role bypasses RLS, the app keeps working.

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

revoke execute on function public.next_seq(text) from public, anon, authenticated;
grant execute on function public.next_seq(text) to service_role;

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
