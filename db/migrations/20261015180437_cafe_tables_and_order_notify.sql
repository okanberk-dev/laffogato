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
