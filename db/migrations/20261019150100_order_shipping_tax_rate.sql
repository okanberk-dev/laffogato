-- The shipping or courier fee's own KDV rate on every order (18 Oct 2026).
--
-- Operator decision, 18 Oct 2026 (ASK-Y2-2; basis in src/lib/utils/kdv.ts
-- and docs/LEGAL-REDLINES-2026-09.md §16.4): the fee is shown on its own
-- line and an outside firm carries the parcel, so on the invoice it is a
-- transport service at the general rate, 20% (GİB özelge 32391, 28945,
-- 32558; KDV K. m.24/a folds it into the goods only inside one price). It
-- used to follow the rate of the goods it carried.
--
--   orders."shippingTaxRatePct"  the fee's rate when the order was written
--                                (settings."taxRates".shipping), stamped by
--                                the store on the web, app (the wallet's
--                                wallet_place_order inserts the same row)
--                                and manual paths. NULL on every order
--                                written before this; the code reads NULL
--                                as 20, because the rule applies to them
--                                too: the invoice is cut at dispatch and no
--                                e-Arşiv invoice was cut before 18 Oct 2026.
--
-- Old rows are not rewritten. Totals do not change.
--
-- Safe on a live table: a nullable column without a default changes only
-- the catalogue (no rewrite), and the check is added NOT VALID (every
-- existing value is NULL, which passes anyway; the table is not scanned
-- under the lock). Re-runnable: the bundle replays every migration when a
-- deploy adds one.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs and
-- the bundle do that themselves, right after the file.

alter table public.orders add column if not exists "shippingTaxRatePct" integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'orders_shipping_tax_rate_pct_check'
       and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_shipping_tax_rate_pct_check
      check ("shippingTaxRatePct" is null or "shippingTaxRatePct" between 0 and 100) not valid;
  end if;
end $$;
