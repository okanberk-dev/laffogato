-- KDV: every food the köşk sells is 10%, the cotton apron 10% (18 Oct 2026).
--
-- Operator decision, 18 Oct 2026 (no lawyer or accountant round; research
-- and basis in docs/LEGAL-REDLINES-2026-09.md §16.4 and src/lib/utils/kdv.ts):
-- the köşk is a kafeterya business, and KDV GUT III/B-2.4.1 (Tebliğ Seri
-- No 51, RG 27.04.2024) puts every food sale of such a business at 10%,
-- internet orders sent to an address included. The 1% of list (I) is for a
-- plain retailer. A cotton canvas apron is a textile garment, list (II)
-- item 5: 10%, not the merch default of 20%.
--
-- The code defaults move with this deploy (LEGAL_TAX_RATES beans 10,
-- pantry 10). This file corrects the rows the CODE wrote, nothing an
-- operator chose:
--
--   prd-0003  the edible cup box. 20261017150000_kdv_rates.sql gave it its
--             own 1%; only while it is still that 1.
--   prd-0009  the cotton apron. The seed (data.ts) and the rename of
--             20260922120000 left it with no rate of its own, so it sold at
--             the merch 20%; only while it has none, is still under merch
--             and still the apron.
--   orders.items  every line stamped 1% becomes 10%. The store copied that
--             1 at sale time from the code's default (shopLineItems ->
--             productTaxRate) or from the cup box's row. No e-Arşiv invoice
--             was cut before 18 Oct 2026, and the invoices will be cut from
--             these stamps. Prices, totals and the order of the lines do not
--             change: a rate only says how much of a KDV-included price is
--             KDV. If an invoice was nevertheless cut at 1%, the operator
--             tells the mali müşavir, who corrects it.
--
-- settings."taxRates" is NOT touched: a value there was saved in the panel
-- (Ayarlar > Vergi), and the operator sets beans and pantry to 10 there
-- (operator step OP-01). A row that never saved a key reads the new default.
--
-- Once only: the bundle replays every migration when a deploy adds one, and
-- a rate the operator sets later in the panel must stay what they set.
-- Each statement checks this file's own `_migrations` record.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs and
-- the bundle do that themselves, right after the file.

update public.products
   set "taxRatePct" = 10
 where id = 'prd-0003'
   and "taxRatePct" = 1
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261018220000_cafe_food_rate_10.sql'
   );

update public.products
   set "taxRatePct" = 10
 where id = 'prd-0009'
   and cat = 'merch'
   and "taxRatePct" is null
   and name like 'Pamuk Önlük%'
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261018220000_cafe_food_rate_10.sql'
   );

-- Line by line, in the stored order (with ordinality): a line stamped 1
-- becomes 10, every other line and every other key stays as it was.
update public.orders as o
   set items = (
     select jsonb_agg(
              case
                when line->'taxRatePct' = '1'::jsonb
                  then jsonb_set(line, '{taxRatePct}', '10'::jsonb)
                else line
              end
              order by pos
            )
       from jsonb_array_elements(o.items) with ordinality as l(line, pos)
   )
 where o.items @> '[{"taxRatePct": 1}]'::jsonb
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261018220000_cafe_food_rate_10.sql'
   );
