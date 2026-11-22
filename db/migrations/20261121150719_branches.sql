-- Şubeler (21 Nov 2026; src/lib/panel/branches.ts, docs/LAFPOS.md "Şube").
--
-- The first LafPOS till went to Marina, and the site had no branch: both
-- signed callers (the köşk's panel and LafPOS) read every open order,
-- table call and booking, and one "Satışta / Tükendi" flag per item was
-- written by both. Marina's till would have rung, moved and closed Tuzla's
-- paid orders and calls, and each branch's sold-out mark closed the other
-- branch's item (the owner's decision of 4 Nov 2026: per branch).
--
--   orders.branch       where a café order is made: the table's branch for
--                       a table order, `tuzla` for everything else (the app
--                       and the web serve the Tuzla köşk; gel-al, kurye and
--                       kargo go out from there). Snapshotted like
--                       "tableCode"/"tableName".
--   cafe_tables.branch  where the table stands: LafPOS sends its tables
--                       for its own branch (PUT /api/panel/tables).
--   table_calls.branch  the table's branch when the call was made.
--   menu_item_availability
--                       "Satışta / Tükendi" per branch: one row per item
--                       and branch that has one. An item is sold at a
--                       branch while menu_items."isActive" (on the menu at
--                       all; the site's own form) is true and the branch's
--                       row, if any, is true. "updatedAt" is the branch's
--                       own stamp: the panel's sold-out card keys on it.
--
-- Everything already written is Tuzla's (the default), which is what it
-- was. Karaoke has no column: there is one room, in Tuzla
-- (`KARAOKE_BRANCH`).
--
-- Additive only: three columns with a default and a new table. Re-runnable.
--
-- Rollback (the code reads the columns; roll the code back first):
--   drop table if exists public.menu_item_availability;
--   alter table public.table_calls drop column if exists branch;
--   alter table public.cafe_tables drop column if exists branch;
--   alter table public.orders drop column if exists branch;

alter table public.orders
  add column if not exists branch text not null default 'tuzla';
alter table public.cafe_tables
  add column if not exists branch text not null default 'tuzla';
alter table public.table_calls
  add column if not exists branch text not null default 'tuzla';

-- lafmaliyet's id rule (branches_id_ck there).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_branch_check'
  ) then
    alter table public.orders
      add constraint orders_branch_check
      check (branch ~ '^[a-z][a-z0-9-]{1,23}$');
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'cafe_tables_branch_check'
  ) then
    alter table public.cafe_tables
      add constraint cafe_tables_branch_check
      check (branch ~ '^[a-z][a-z0-9-]{1,23}$');
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'table_calls_branch_check'
  ) then
    alter table public.table_calls
      add constraint table_calls_branch_check
      check (branch ~ '^[a-z][a-z0-9-]{1,23}$');
  end if;
end $$;

create table if not exists public.menu_item_availability (
  "menuItemId" text    not null
    references public.menu_items (id) on delete cascade,
  branch       text    not null,
  "isActive"   boolean not null default true,
  "updatedAt"  text    not null default '',
  "updatedBy"  text    not null default '',
  primary key ("menuItemId", branch),
  constraint menu_item_availability_branch_check
    check (branch ~ '^[a-z][a-z0-9-]{1,23}$')
);

-- A branch's rows (the panel's and LafPOS's reads).
create index if not exists menu_item_availability_branch_idx
  on public.menu_item_availability (branch);

-- Row level security on, no policy, like every other table: the app's
-- single owner connection bypasses it.
alter table public.menu_item_availability enable row level security;

-- NOTE: no insert into `_migrations` (scripts/db-migrate.mjs does it).
