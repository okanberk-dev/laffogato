-- Returning what an order took, when the order does not complete.
--
-- Placing an order claims stock, burns a single-use customer coupon and
-- increments a promo's usage count. Cancelling one used to do none of those in
-- reverse, so a cancelled order held its stock forever and the customer's
-- coupon was gone.

-- ── orders."stockReleasedAt" ──────────────────────────────────────────────
-- Idempotency marker: the release path is guarded on this being empty, so a
-- double cancel (or a retried action) cannot credit the stock twice.
alter table public.orders
  add column if not exists "stockReleasedAt" text not null default '';

create index if not exists orders_pending_created_idx
  on public.orders ("createdAt")
  where status = 'pending_payment';

-- ── release_order_stock ───────────────────────────────────────────────────
-- Mirror of claim_order_stock. Adds the quantities back to product stock (and
-- to the chosen variant's JSONB stock) under the same row lock, and returns
-- the post-release product stock per line for stock-movement logging.
--
-- Unlike the claim there is no precondition to fail on: giving stock back can
-- always succeed. A line whose product no longer exists is skipped rather than
-- raising, so one deleted product cannot block the rest of a cancellation.
create or replace function public.release_order_stock(p_lines jsonb, p_now text)
returns int[]
language plpgsql
set search_path = ''
as $$
declare
  line      jsonb;
  qty       int;
  new_stock int;
  result    int[] := '{}';
begin
  for line in select value from jsonb_array_elements(p_lines)
  loop
    qty := (line->>'qty')::int;
    new_stock := null;

    if (line->>'variantId') is not null and (line->>'variantId') <> '' then
      update public.products
        set stock = stock + qty,
            "updatedAt" = p_now,
            variants = (
              select jsonb_agg(
                case when v->>'id' = line->>'variantId'
                  then jsonb_set(v, '{stock}', to_jsonb((v->>'stock')::int + qty))
                  else v end)
              from jsonb_array_elements(variants) v)
        where id = line->>'productId'
        returning stock into new_stock;
    else
      update public.products
        set stock = stock + qty,
            "updatedAt" = p_now
        where id = line->>'productId'
        returning stock into new_stock;
    end if;

    result := array_append(result, coalesce(new_stock, -1));
  end loop;

  return result;
end;
$$;

-- ── redeem_promo ──────────────────────────────────────────────────────────
-- Increment that ENFORCES the usage limit in the same statement.
--
-- increment_promo_usage raised the count unconditionally, and the limit was
-- checked in a separate read beforehand: two checkouts racing on the last use
-- of a code both passed the check and both incremented, so a "50 uses" code
-- could be redeemed 60 times. Returns true only when this call is the one that
-- took a use.
create or replace function public.redeem_promo(promo_code text, p_now text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  taken int;
begin
  update public.promos
    set "usageCount" = "usageCount" + 1,
        "updatedAt" = p_now
    where code = promo_code
      and "isActive" = true
      and ("usageLimit" = 0 or "usageCount" < "usageLimit");
  get diagnostics taken = row_count;
  return taken > 0;
end;
$$;

-- ── release_promo_usage ───────────────────────────────────────────────────
-- Gives a use back when the order it was taken for is cancelled. Floors at 0
-- so a double release cannot drive the count negative.
create or replace function public.release_promo_usage(promo_code text, p_now text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.promos
    set "usageCount" = greatest(0, "usageCount" - 1),
        "updatedAt" = p_now
    where code = promo_code;
end;
$$;
