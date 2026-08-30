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
