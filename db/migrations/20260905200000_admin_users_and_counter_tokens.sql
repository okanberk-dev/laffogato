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
