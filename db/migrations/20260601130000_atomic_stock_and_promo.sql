-- Atomic helpers that the data layer needs but a single-row read-modify-write
-- can't provide safely under concurrency.

-- ── claim_order_stock ─────────────────────────────────────────────────────
-- Atomically check + decrement stock for an ENTIRE cart in one transaction.
-- Each line is `{ "productId": text, "variantId": text|null, "qty": int }`.
-- Product stock (and the chosen variant's JSONB stock) is decremented under a
-- row lock; if ANY line can't be satisfied the whole function raises and rolls
-- back every line — no overselling, all-or-nothing. Returns the post-decrement
-- product stock per line (same order as input) for stock-movement logging.
create or replace function public.claim_order_stock(p_lines jsonb, p_now text)
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

    if (line->>'variantId') is not null and (line->>'variantId') <> '' then
      update public.products
        set stock = stock - qty,
            "updatedAt" = p_now,
            variants = (
              select jsonb_agg(
                case when v->>'id' = line->>'variantId'
                  then jsonb_set(v, '{stock}', to_jsonb(greatest(0, (v->>'stock')::int - qty)))
                  else v end)
              from jsonb_array_elements(variants) v)
        where id = line->>'productId'
          and stock >= qty
          and coalesce((
            select (v->>'stock')::int
            from jsonb_array_elements(variants) v
            where v->>'id' = line->>'variantId'
          ), 0) >= qty
        returning stock into new_stock;
    else
      update public.products
        set stock = stock - qty,
            "updatedAt" = p_now
        where id = line->>'productId' and stock >= qty
        returning stock into new_stock;
    end if;

    if not found then
      raise exception 'INSUFFICIENT_STOCK:%', coalesce(line->>'productId', '');
    end if;

    result := array_append(result, new_stock);
  end loop;

  return result;
end;
$$;

-- ── increment_promo_usage ─────────────────────────────────────────────────
-- Atomic usageCount increment (replaces a non-atomic read-modify-write that
-- could lose concurrent updates).
create or replace function public.increment_promo_usage(promo_code text, p_now text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.promos
    set "usageCount" = "usageCount" + 1,
        "updatedAt" = p_now
    where code = promo_code;
end;
$$;

