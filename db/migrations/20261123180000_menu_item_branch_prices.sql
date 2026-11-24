-- Şube fiyatı (23 Nov 2026; src/lib/panel/branch-prices-core.ts,
-- docs/PANEL-MENU.md "Şube fiyatı").
--
-- The owner's decision of 4 Nov 2026 (lafmaliyet docs/SUBE.md) was that
-- "Satışta / Tükendi" and the selling price vary by branch. The first half
-- came with 20261121150719_branches.sql; this is the second, approved for
-- build on 23 Nov 2026. Until now `menu_items."priceMinor"` /
-- `"priceMinorL"` were every branch's price.
--
--   menu_item_branch_prices
--                       one row per item, branch and instant: from
--                       "effectiveFrom" on, the item sells at that branch
--                       for "priceMinor" (M or the only size) and
--                       "priceMinorL" (L; 0 = the base L). "priceMinor"
--                       null: from then on the base price again. The rows
--                       are append-only (a newer row replaces an older one
--                       from its instant), so the table is its own history;
--                       only a row whose instant is still in the future may
--                       be deleted (the panel's cancel). The base price in
--                       menu_items is unchanged and is still the home
--                       branch's (Tuzla) and every branch's without a row.
--
-- "effectiveFrom" is ISO-8601 UTC as `toISOString()` writes it, so text
-- order is time order (the check below holds every writer to it).
--
-- Additive only: a new table. Re-runnable.
--
-- Rollback (the code reads the table; roll the code back first):
--   drop table if exists public.menu_item_branch_prices;

create table if not exists public.menu_item_branch_prices (
  "menuItemId"    text    not null
    references public.menu_items (id) on delete cascade,
  branch          text    not null,
  "priceMinor"    integer,
  "priceMinorL"   integer not null default 0,
  "effectiveFrom" text    not null,
  "createdAt"     text    not null default '',
  "createdBy"     text    not null default '',
  primary key ("menuItemId", branch, "effectiveFrom"),
  -- lafmaliyet's id rule (branches_id_ck there), as menu_item_availability.
  constraint menu_item_branch_prices_branch_check
    check (branch ~ '^[a-z][a-z0-9-]{1,23}$'),
  constraint menu_item_branch_prices_price_check
    check ("priceMinor" is null or "priceMinor" > 0),
  -- Back to the base price is both sizes: no L of its own.
  constraint menu_item_branch_prices_price_l_check
    check ("priceMinorL" >= 0 and ("priceMinor" is not null or "priceMinorL" = 0)),
  constraint menu_item_branch_prices_from_check
    check ("effectiveFrom" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$')
);

-- A branch's rows (the signed reads, the branch's menu and orders).
create index if not exists menu_item_branch_prices_branch_idx
  on public.menu_item_branch_prices (branch, "effectiveFrom");

-- Row level security on, no policy, like every other table: the app's
-- single owner connection bypasses it.
alter table public.menu_item_branch_prices enable row level security;

-- NOTE: no insert into `_migrations` (scripts/db-migrate.mjs does it).
