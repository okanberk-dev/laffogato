-- KDV per item, editable in the panel (17 Oct 2026).
--
-- Operator, 17 Oct 2026: "KDV oranlarında da ürünlere özel kdv oranı
-- eklenebilir olsun ... karakoke'de %20 kdv var, menüden sipariş ederlerse %10,
-- ve kahve çekirdeği vs alırlarsa %1 ... panelden düzenlenebilir olsun ve
-- düzenleyince uygulamada da güncellensin". Until now one number,
-- settings."taxRatePct", stood for every sale, and nothing ever showed what
-- it produced. Rules and legal basis: src/lib/utils/kdv.ts.
--
--   settings."taxRates"   jsonb, the default rate per kind of sale:
--                         { menu, karaoke, beans, pantry, gift, gear, merch }.
--                         '{}' reads as the legal defaults (10, 20, 1, 1, 20,
--                         20, 20) key by key, so nothing has to be written
--                         for the live row (normalizeTaxRates).
--   products."taxRatePct"            the product's own rate; NULL = its
--   menu_items."taxRatePct"          category's (menu's) default. Every
--                                    existing row starts NULL.
--   karaoke_reservations."taxRatePct" the karaoke rate the booking was made
--                                    at; NULL on bookings made before this.
--
-- Order lines get their rate inside orders.items (jsonb, `taxRatePct` per
-- line, written by the store when the order is placed), so `orders` itself
-- does not change and neither does wallet_place_order.
--
-- settings."taxRatePct" is no longer read. Kept, like every column: dropping
-- one is never part of a deploy.
--
-- Prices and totals do not change: every price is KDV-included, and the rate
-- only says how much of it is KDV.
--
-- Safe on live tables: nullable columns without a default and a jsonb column
-- with a constant default change only the catalogue (no rewrite). The checks
-- are added NOT VALID: every existing value is NULL, which passes anyway, and
-- the table is not scanned under the lock. Re-runnable: the bundle replays
-- every migration when a deploy adds one.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.settings add column if not exists "taxRates" jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists "taxRatePct" integer;
alter table public.menu_items add column if not exists "taxRatePct" integer;
alter table public.karaoke_reservations add column if not exists "taxRatePct" integer;

-- Whole percentages from 0 to 100 (the panel refuses fractions).
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'products_tax_rate_pct_check'
       and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_tax_rate_pct_check
      check ("taxRatePct" is null or "taxRatePct" between 0 and 100) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'menu_items_tax_rate_pct_check'
       and conrelid = 'public.menu_items'::regclass
  ) then
    alter table public.menu_items
      add constraint menu_items_tax_rate_pct_check
      check ("taxRatePct" is null or "taxRatePct" between 0 and 100) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'karaoke_reservations_tax_rate_pct_check'
       and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_tax_rate_pct_check
      check ("taxRatePct" is null or "taxRatePct" between 0 and 100) not valid;
  end if;
end $$;
