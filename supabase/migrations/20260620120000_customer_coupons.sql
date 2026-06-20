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
