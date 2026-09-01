-- Manual stock adjustment, made atomic.
--
-- `adjustStock` read the row, added the delta in JavaScript and wrote the sum
-- back. Two adjustments in flight at once — or one racing a customer's order,
-- which decrements under a row lock — lost one of the two writes. The lost one
-- was always the smaller change, so the stock count drifted upward, which is
-- the direction that oversells.
--
-- Returns the new stock, or -1 when the product does not exist and -2 when the
-- adjustment would take it below zero, so the caller can tell the two apart
-- without a second read.
create or replace function public.adjust_product_stock(
  p_product_id text,
  p_delta      int,
  p_now        text
)
returns int
language plpgsql
set search_path = ''
as $$
declare
  new_stock int;
  exists_id text;
begin
  update public.products
    set stock = stock + p_delta,
        "updatedAt" = p_now
    where id = p_product_id
      and stock + p_delta >= 0
    returning stock into new_stock;

  if found then
    return new_stock;
  end if;

  select id into exists_id from public.products where id = p_product_id;
  if exists_id is null then
    return -1;
  end if;
  return -2;
end;
$$;
