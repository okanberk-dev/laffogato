-- Variant stock, kept in step with the product's total (admin audit CAT-03,
-- CAT-14, decision D16, 17 Oct 2026).
--
-- A product with variants keeps two counts: each variant's own stock inside
-- products.variants (jsonb) and the product's total in products.stock.
-- claim_order_stock needs both to cover a variant line and takes the units
-- from both; credit_product_stock gives them back to both. Nothing else kept
-- the two together:
--   - the product form wrote both from the values it read when it was
--     opened, so an order taken meanwhile was undone on save, and no stock
--     move was written (CAT-03);
--   - the total started at 0 while every variant had stock, so the product
--     read "Stoksuz" and its order failed at the claim (CAT-14);
--   - no screen could correct one variant's stock.
--
-- From here on, under the product's row lock like the claim:
--   variant_stock_total     what the total of a product with variants is
--                           made of: the stock of its active variants.
--   adjust_variant_stock    the Stok screen's correction of one variant. The
--                           variant moves by the delta, the total by the same
--                           delta when the variant is active.
--   save_product_variants   the product form's save of price, variants and
--                           stock. Each variant moves by its change since the
--                           form was opened, never to the opened value.
--   adjust_product_stock    now refuses (-3) a product with variants: its
--                           total follows the variants, it is not set alone.
-- Every change writes its stock move in the same transaction.
--
-- The total moves by deltas instead of being recomputed as the sum: the
-- shop card's quick add can still sell a product with variants without a
-- variant, which takes a unit from the total only, and a recomputed sum
-- would hand that unit back for sale. The one exception is a product getting
-- its first variants: then the total is their sum.
--
-- Re-runnable: the bundle replays every migration when a deploy adds one.
-- The data step at the end runs once (guarded on _migrations).
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- The variant list as an array, whatever the column holds.
create or replace function public.product_variant_list(p_variants jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
           when jsonb_typeof(p_variants) = 'array' then p_variants
           else '[]'::jsonb
         end
$$;

-- The stock of the active variants, summed. Active means `isActive` is true,
-- as resolveOrderLines reads it: a variant without the key is not sold.
create or replace function public.variant_stock_total(p_variants jsonb)
returns int
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(greatest(0, coalesce((v ->> 'stock')::int, 0))), 0)::int
    from jsonb_array_elements(public.product_variant_list(p_variants)) as v
   where coalesce((v ->> 'isActive')::boolean, false)
$$;

-- One stock move, numbered like recordStockMove in the store (mov-000123).
create or replace function public.record_stock_move(
  p_product_id   text,
  p_product_name text,
  p_delta        int,
  p_stock_after  int,
  p_note         text,
  p_actor        text,
  p_now          text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  seq     text := public.next_seq('mov')::text;
  move_id text;
begin
  move_id := 'mov-' || case when length(seq) < 6 then lpad(seq, 6, '0') else seq end;
  insert into public.stock_moves
    (id, "productId", "productName", delta, "stockAfter", reason, note, actor, "createdAt")
  values
    (move_id, p_product_id, coalesce(p_product_name, ''), p_delta, p_stock_after,
     'manual_adjust', left(coalesce(p_note, ''), 500), coalesce(p_actor, 'system'), p_now);
  return move_id;
end;
$$;

-- ── adjust_variant_stock ──────────────────────────────────────────────────
-- Moves one variant's stock by p_delta and records the move (named
-- "Ürün · Varyant", stockAfter = the variant's new stock). Returns
--   {"error": "product" | "variant"}             nothing to adjust,
--   {"error": "negative", "variantStock": n}     it would go below zero,
--   {"variantStock", "stock", "stockBefore", "variantName", "productName",
--    "active", "moveId"}                         done.
create or replace function public.adjust_variant_stock(
  p_product_id text,
  p_variant_id text,
  p_delta      int,
  p_note       text,
  p_actor      text,
  p_now        text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  cur_variants jsonb;
  cur_total    int;
  prod_name    text;
  hit          jsonb;
  cur_stock    int;
  next_stock   int;
  active       boolean;
  next_total   int;
  residual     int;
  move_id      text;
begin
  select public.product_variant_list(variants), stock, name
    into cur_variants, cur_total, prod_name
    from public.products
   where id = p_product_id
     for update;
  if not found then
    return jsonb_build_object('error', 'product');
  end if;

  select v into hit
    from jsonb_array_elements(cur_variants) as v
   where v ->> 'id' = p_variant_id
   limit 1;
  if hit is null then
    return jsonb_build_object('error', 'variant');
  end if;

  cur_stock := greatest(0, coalesce((hit ->> 'stock')::int, 0));
  next_stock := cur_stock + p_delta;
  if next_stock < 0 then
    return jsonb_build_object('error', 'negative', 'variantStock', cur_stock);
  end if;
  active := coalesce((hit ->> 'isActive')::boolean, false);
  next_total := case when active then greatest(0, cur_total + p_delta) else cur_total end;

  update public.products
     set variants = (
           select jsonb_agg(
                    case when e.v ->> 'id' = p_variant_id
                      then jsonb_set(e.v, '{stock}', to_jsonb(next_stock))
                      else e.v end
                    order by e.n)
             from jsonb_array_elements(cur_variants) with ordinality as e(v, n)),
         stock = next_total,
         "updatedAt" = p_now
   where id = p_product_id;

  move_id := public.record_stock_move(
    p_product_id, prod_name || ' · ' || coalesce(hit ->> 'name', ''),
    p_delta, next_stock, p_note, p_actor, p_now);
  -- The total stopped at 0 (units sold without a variant had already left
  -- it): the product's own move says by how much less it went down.
  residual := (next_total - cur_total) - case when active then p_delta else 0 end;
  if residual <> 0 then
    perform public.record_stock_move(
      p_product_id, prod_name, residual, next_total,
      coalesce(p_note, '') || ': varyant toplamı', p_actor, p_now);
  end if;

  return jsonb_build_object(
    'variantStock', next_stock,
    'stock', next_total,
    'stockBefore', cur_total,
    'variantName', coalesce(hit ->> 'name', ''),
    'productName', prod_name,
    'active', active,
    'moveId', move_id);
end;
$$;

-- ── save_product_variants ─────────────────────────────────────────────────
-- The product form's save of what has to stay together: the sale price, the
-- variant list and the stock. p_variants is the form's list:
--   [{id, name, priceDeltaMinor, sku, isActive, stockDelta, initialStock}]
-- A variant already stored keeps its stored stock plus `stockDelta` (the
-- change typed since the form was opened); one not stored yet starts at
-- `initialStock`; a stored one missing from the list is removed with its
-- units. p_stock_delta is the change to the product's own stock, used only
-- when the list is empty. The total of a product with variants follows them
-- (see the header); a product getting its first variants takes their sum.
--
-- Every stock change is written as a stock move: one per variant whose
-- stock changed ("Ürün · Varyant", stockAfter = its new stock), and one for
-- the product ("Ürün", stockAfter = the new total) for whatever the variant
-- moves do not explain (a variant switched on or off, the first variants
-- replacing the product's own count, the variants removed).
--
-- Nothing is written when anything is refused. Returns
--   {"error": "product"}                                 the row is gone,
--   {"error": "floor", "variant": name}                  a variant would sell
--                                                        under 1 kuruş,
--   {"error": "negative", "variant"?, "variantId"?, "stock", "variants"}
--                                                        a count would go
--                                                        below zero; "stock"
--                                                        and "variants" are the
--                                                        stored ones now,
--   {"stockBefore", "stockAfter", "variants", "moves"}   saved.
create or replace function public.save_product_variants(
  p_product_id  text,
  p_price_minor int,
  p_variants    jsonb,
  p_stock_delta int,
  p_note        text,
  p_actor       text,
  p_now         text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  cur_variants jsonb;
  cur_total    int;
  prod_name    text;
  inc          jsonb;
  hit          jsonb;
  before_stock int;
  next_stock   int;
  inc_active   boolean;
  next_list    jsonb := '[]'::jsonb;
  changes      jsonb := '[]'::jsonb;
  ch           jsonb;
  explained    int := 0;
  next_total   int;
  moves        int := 0;
begin
  select public.product_variant_list(variants), stock, name
    into cur_variants, cur_total, prod_name
    from public.products
   where id = p_product_id
     for update;
  if not found then
    return jsonb_build_object('error', 'product');
  end if;

  for inc in
    select value from jsonb_array_elements(public.product_variant_list(p_variants))
  loop
    if p_price_minor + coalesce((inc ->> 'priceDeltaMinor')::int, 0) < 1 then
      return jsonb_build_object('error', 'floor', 'variant', coalesce(inc ->> 'name', ''));
    end if;
    inc_active := coalesce((inc ->> 'isActive')::boolean, false);
    hit := null;
    select v into hit
      from jsonb_array_elements(cur_variants) as v
     where v ->> 'id' = inc ->> 'id'
     limit 1;
    if hit is null then
      before_stock := 0;
      next_stock := greatest(0, coalesce((inc ->> 'initialStock')::int, 0));
    else
      before_stock := greatest(0, coalesce((hit ->> 'stock')::int, 0));
      next_stock := before_stock + coalesce((inc ->> 'stockDelta')::int, 0);
      if next_stock < 0 then
        return jsonb_build_object(
          'error', 'negative',
          'variant', coalesce(inc ->> 'name', ''),
          'variantId', inc ->> 'id',
          'stock', cur_total,
          'variants', cur_variants);
      end if;
    end if;
    next_list := next_list || jsonb_build_array(jsonb_build_object(
      'id', inc ->> 'id',
      'name', coalesce(inc ->> 'name', ''),
      'priceDeltaMinor', coalesce((inc ->> 'priceDeltaMinor')::int, 0),
      'stock', next_stock,
      'sku', coalesce(inc ->> 'sku', ''),
      'isActive', inc_active));
    if next_stock <> before_stock then
      changes := changes || jsonb_build_array(jsonb_build_object(
        'name', coalesce(inc ->> 'name', ''),
        'delta', next_stock - before_stock,
        'after', next_stock,
        'counted', inc_active,
        'removed', false));
    end if;
  end loop;

  -- A stored variant the form no longer lists leaves with its units.
  for hit in
    select v
      from jsonb_array_elements(cur_variants) as v
     where not exists (
       select 1 from jsonb_array_elements(next_list) as n where n ->> 'id' = v ->> 'id')
  loop
    before_stock := greatest(0, coalesce((hit ->> 'stock')::int, 0));
    if before_stock <> 0 then
      changes := changes || jsonb_build_array(jsonb_build_object(
        'name', coalesce(hit ->> 'name', ''),
        'delta', -before_stock,
        'after', 0,
        'counted', coalesce((hit ->> 'isActive')::boolean, false),
        'removed', true));
    end if;
  end loop;

  if jsonb_array_length(next_list) = 0 then
    -- No variants (any more): the product's own count, moved by the form.
    next_total := cur_total + coalesce(p_stock_delta, 0);
    if next_total < 0 then
      return jsonb_build_object(
        'error', 'negative', 'stock', cur_total, 'variants', cur_variants);
    end if;
  elsif jsonb_array_length(cur_variants) = 0 then
    next_total := public.variant_stock_total(next_list);
  else
    next_total := greatest(0,
      cur_total
      + public.variant_stock_total(next_list)
      - public.variant_stock_total(cur_variants));
  end if;

  update public.products
     set variants = next_list,
         stock = next_total,
         "priceMinor" = p_price_minor,
         "updatedAt" = p_now
   where id = p_product_id;

  for ch in select value from jsonb_array_elements(changes)
  loop
    perform public.record_stock_move(
      p_product_id,
      prod_name || ' · ' || (ch ->> 'name'),
      (ch ->> 'delta')::int,
      (ch ->> 'after')::int,
      coalesce(p_note, '') || case when (ch ->> 'removed')::boolean then ': varyant silindi' else '' end,
      p_actor,
      p_now);
    moves := moves + 1;
    if (ch ->> 'counted')::boolean then
      explained := explained + (ch ->> 'delta')::int;
    end if;
  end loop;

  if next_total - cur_total <> explained then
    perform public.record_stock_move(
      p_product_id,
      prod_name,
      next_total - cur_total - explained,
      next_total,
      coalesce(p_note, '')
        || case
             when jsonb_array_length(next_list) = 0 and jsonb_array_length(cur_variants) = 0 then ''
             else ': varyant toplamı'
           end,
      p_actor,
      p_now);
    moves := moves + 1;
  end if;

  return jsonb_build_object(
    'stockBefore', cur_total,
    'stockAfter', next_total,
    'variants', next_list,
    'moves', moves);
end;
$$;

-- ── adjust_product_stock ──────────────────────────────────────────────────
-- As in 20260901150000_atomic_stock_adjust.sql, plus -3 for a product with
-- variants: its total follows them, so the Stok screen and the CSV import
-- move a variant instead.
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
  new_stock  int;
  exists_id  text;
  n_variants int;
begin
  update public.products
    set stock = stock + p_delta,
        "updatedAt" = p_now
    where id = p_product_id
      and stock + p_delta >= 0
      and jsonb_array_length(public.product_variant_list(variants)) = 0
    returning stock into new_stock;

  if found then
    return new_stock;
  end if;

  select id, jsonb_array_length(public.product_variant_list(variants))
    into exists_id, n_variants
    from public.products
   where id = p_product_id;
  if exists_id is null then
    return -1;
  end if;
  if n_variants > 0 then
    return -3;
  end if;
  return -2;
end;
$$;

-- ── once: products the form left at 0 ─────────────────────────────────────
-- A product with variants whose total is 0 while its active variants hold
-- stock is the CAT-14 state: the field defaulted to 0 and the operator only
-- filled the variants, so nothing of it could be sold. Its total becomes the
-- sum, with a stock move. Only a product nothing ever moved: no stock move
-- and no order line names it. A total that reached 0 through sales is sold
-- out, not unfilled: units sold without a variant (the shop card's quick
-- add) left the total and not the variants, so the variants still read
-- stock that is gone, and the sum would put it back on sale. Any other
-- total is left as it stands for the same reason. Once only, like every
-- data step the bundle replays.
with fixed as (
  update public.products as p
     set stock = public.variant_stock_total(p.variants),
         "updatedAt" = to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
   where p.stock = 0
     and public.variant_stock_total(p.variants) > 0
     and not exists (
       select 1 from public.stock_moves as m where m."productId" = p.id
     )
     and not exists (
       select 1
         from public.orders as o
        cross join lateral jsonb_array_elements(
                case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end
              ) as line
        where line ->> 'productId' = p.id
     )
     and not exists (
       select 1
         from public._migrations as applied
        where applied.name = '20261017200000_variant_stock_adjust.sql'
     )
  returning p.id, p.name, p.stock, p."updatedAt"
)
select public.record_stock_move(
         f.id, f.name, f.stock, f.stock,
         'Varyant stoklarının toplamı (ürün stoğu 0 kalmıştı)', 'system', f."updatedAt")
  from fixed as f;
