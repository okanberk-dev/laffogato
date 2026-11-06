-- "Garson çağır" from the table's QR (6 Nov 2026; docs/API-MOBILE.md §22.1,
-- docs/PANEL-ORDERS.md "Masa çağrıları", src/lib/admin/table-calls*.ts).
--
-- A member at a table taps "Garson", "Su" or "Peçete" in the app
-- (POST /api/mobile/v1/tables/{code}/calls). The call rings the site panel's
-- order alert and shows on the köşk panel's bar screen (the signed
-- GET /api/panel/orders feed, `calls`) until someone answers "Gördüm"
-- (here, or POST /api/panel/calls/ack). An unanswered call stops showing
-- after 15 minutes; the row stays until the retention sweep.
--
--   table_calls   one row per call: the table's code and name as they were
--                 (snapshots, like orders."tableCode"/"tableName"), the
--                 reason, who asked (the member's e-mail, lower case: the
--                 only member reference, anonymised on account closure like
--                 every other e-mail-keyed table), when, and who answered.
--                 Minimal by design (KVKK m.4/2-d): no name, no device, no
--                 IP. Deleted 30 days after the call by the daily retention
--                 run (src/lib/retention.ts, rule `table-calls`).
--
-- Writes to this table expire `live:orders`, so each one pings the panel
-- (`orders.changed`) and moves the order alert's change marker
-- (src/lib/cache/tags.ts).
--
-- New table only; nothing existing changes. Re-runnable.
--
-- Rollback (nothing else reads it):
--   drop table if exists public.table_calls;

create table if not exists public.table_calls (
  id              text primary key,
  "tableCode"     text not null,
  "tableName"     text not null default '',
  reason          text not null,
  "customerEmail" text not null default '',
  "createdAt"     text not null,
  "ackedAt"       text not null default '',
  "ackedBy"       text not null default '',
  constraint table_calls_reason_check
    check (reason in ('waiter', 'water', 'napkin')),
  constraint table_calls_email_lower
    check ("customerEmail" = lower("customerEmail"))
);

-- The open calls of a table (dedupe) and of the whole köşk (feed, alert).
create index if not exists table_calls_open_idx
  on public.table_calls ("createdAt")
  where "ackedAt" = '';
create index if not exists table_calls_table_idx
  on public.table_calls ("tableCode", reason, "createdAt");

-- Row level security on, no policy, like every other table: the app's
-- single owner connection bypasses it.
alter table public.table_calls enable row level security;

-- NOTE: no insert into `_migrations` (scripts/db-migrate.mjs does it).
