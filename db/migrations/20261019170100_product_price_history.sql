-- The shop's price history and the dates of a discount (19 Oct 2026,
-- X-DISCOUNT, decision OP-COMPARE-AT).
--
-- An advertisement that says a price is reduced names the price before the
-- discount and the days the discount starts and ends (Ticari Reklam ve
-- Haksız Ticari Uygulamalar Yönetmeliği m.14/1). For goods the price before
-- the discount is the lowest price applied in the ten days before the
-- discount starts (m.14/3), counted in the channel where the discount runs
-- only (m.14/5: the kiosk's shelf price is not the online shop's), and the
-- seller proves it (Fiyat Etiketi Yönetmeliği m.11/1). The panel took any
-- "Eski fiyat" with no date and no record behind it.
--
--   products."discountStartsAt" / "discountEndsAt"
--     text, nullable: ISO-8601 UTC instants. The start is 00:00 and the end
--     23:59:59.999 of the Istanbul days the operator picked (UTC+3, CLAUDE.md
--     rule 22). NULL: no discount. A compare-at price without both dates is
--     never shown (src/lib/shop/discount.ts).
--
--   product_price_history
--     One row each time a product's online sale price ("priceMinor") is
--     set: the price and the instant it started to apply. Written by the
--     trigger below, so every path that sets a price (the product form,
--     the CSV import, a migration) leaves its row; nothing in the app
--     writes it. The panel refuses a compare-at price that is not the
--     lowest of the ten days before the start, and a start whose ten days
--     the history does not reach.
--
-- Each existing product gets one row with its current price from its
-- "updatedAt": every path that sets a price also sets "updatedAt", so the
-- price has applied at least since then. A product never written since
-- the column had no value starts now. The ten days are counted from there:
-- a discount on such a product can start ten days later at the earliest.
--
-- A compare-at price stored before this has no dates, so it can never be
-- shown and would refuse every save of its product: it is set to 0 (the
-- operator's step of 18 Oct 2026 for prd-0008, done for every product).
-- From here on the panel stores a compare-at price only with both dates.
--
-- Re-runnable: the bundle replays every migration when a deploy adds one.
-- The backfill skips a product that already has a row; the clearing finds
-- nothing once every compare-at price carries its dates.
--
-- Rollback (the cleared compare-at prices are not restored: they were
-- shown without the dates the regulation asks for):
--   drop trigger if exists products_price_history on public.products;
--   drop function if exists public.record_product_price();
--   drop table if exists public.product_price_history;
--   alter table public.products drop column if exists "discountStartsAt",
--     drop column if exists "discountEndsAt";

alter table public.products
  add column if not exists "discountStartsAt" text,
  add column if not exists "discountEndsAt" text;

create table if not exists public.product_price_history (
  id           bigserial primary key,
  "productId"  text    not null references public.products (id) on delete cascade,
  "priceMinor" integer not null,
  "startedAt"  text    not null
);
create index if not exists product_price_history_product_idx
  on public.product_price_history ("productId", "startedAt");
alter table public.product_price_history enable row level security;

create or replace function public.record_product_price()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new."priceMinor" is distinct from old."priceMinor" then
    insert into public.product_price_history ("productId", "priceMinor", "startedAt")
    values (
      new.id,
      new."priceMinor",
      to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists products_price_history on public.products;
create trigger products_price_history
  after insert or update of "priceMinor" on public.products
  for each row execute function public.record_product_price();

insert into public.product_price_history ("productId", "priceMinor", "startedAt")
select p.id,
       p."priceMinor",
       coalesce(
         nullif(p."updatedAt", ''),
         to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
       )
  from public.products p
 where not exists (
   select 1 from public.product_price_history h where h."productId" = p.id
 );

update public.products
   set "compareAtPriceMinor" = 0
 where "compareAtPriceMinor" <> 0
   and ("discountStartsAt" is null or "discountEndsAt" is null);
