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
