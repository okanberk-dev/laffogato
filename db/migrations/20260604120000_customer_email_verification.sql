-- ── Customer e-mail verification ───────────────────────────────────────────
-- Customers must confirm their e-mail before they can place an order.
alter table public.customers
  add column if not exists "emailVerified" boolean not null default false,
  add column if not exists "verifyToken"   text    not null default '',
  add column if not exists "verifyExpires" text    not null default '',
  add column if not exists "verifiedAt"    text    not null default '';

create index if not exists customers_verify_token_idx
  on public.customers ("verifyToken");
