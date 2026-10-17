-- Admin order management (17 Eki 2026): the rules the order screens enforce
-- on the server, and the columns behind the order list's filters.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- ── Indexes the order page reads by ─────────────────────────────────────
-- The order page lists an order's audit rows, stock movements and payment
-- rows. Each of those was a sequential scan of its whole table.
create index if not exists audit_logs_entity_id_idx
  on public.audit_logs (entity, "entityId");
create index if not exists stock_moves_order_idx
  on public.stock_moves ("orderId");
create index if not exists payment_transactions_order_idx
  on public.payment_transactions ("orderId");

-- ── orders.attention ──────────────────────────────────────────────────────
-- Something on the order needs a human:
--   amount_mismatch    the POS collected a different amount
--   order_not_open     a payment landed on a cancelled or refunded order
--   duplicate_payment  a second charge on an order that was already paid
--   refund_due         cancelled after money was taken, and not refunded yet
-- '' = nothing to look at. The first three lived only in an audit row
-- (noteUnreconciledPayment) that nobody opened; the order list's "Dikkat"
-- filter and the red banner on the order page read this column now.
alter table public.orders
  add column if not exists attention text not null default '';
create index if not exists orders_attention_idx
  on public.orders ("orderNo")
  where attention <> '';

-- ── orders.source ─────────────────────────────────────────────────────────
-- 'manual' for an order typed into the panel (createManualOrder), '' for
-- every other order. A manual "Ödeme bekleniyor" order has no POS payment
-- behind it, and the 45-minute sweep used to cancel it and hand its stock
-- back without telling anyone. The sweep skips it now.
alter table public.orders
  add column if not exists source text not null default '';

-- Manual orders written before the column: their creation's audit row says
-- so (createManualOrderAction logs `payload.manual = true`).
update public.orders o
   set source = 'manual'
 where o.source = ''
   and exists (
     select 1
       from public.audit_logs a
      where a.entity = 'order'
        and a.action = 'create'
        and a."entityId" = o.id
        and a.payload ->> 'manual' = 'true'
   );

-- ── credit_product_stock ──────────────────────────────────────────────────
-- Gives `p_qty` units back to a product (and to its variant's JSONB stock).
-- Returns the product's stock after the credit, or NULL when the product row
-- is gone. Shared by the two functions below.
create or replace function public.credit_product_stock(
  p_product_id text,
  p_variant_id text,
  p_qty        int,
  p_now        text
)
returns int
language plpgsql
set search_path = ''
as $$
declare
  new_stock int;
begin
  if coalesce(p_variant_id, '') <> '' then
    update public.products
       set stock = stock + p_qty,
           "updatedAt" = p_now,
           variants = coalesce((
             select jsonb_agg(
               case when v ->> 'id' = p_variant_id
                 then jsonb_set(
                   v, '{stock}', to_jsonb(coalesce((v ->> 'stock')::int, 0) + p_qty))
                 else v end)
               from jsonb_array_elements(variants) v
           ), variants)
     where id = p_product_id
    returning stock into new_stock;
  else
    update public.products
       set stock = stock + p_qty,
           "updatedAt" = p_now
     where id = p_product_id
    returning stock into new_stock;
  end if;
  return new_stock;
end;
$$;

-- ── release_order_inventory ───────────────────────────────────────────────
-- The claim and the stock credit in ONE transaction.
--
-- The store used to flip "stockReleasedAt" with one statement and call
-- release_order_stock with the next. When the second failed, the order was
-- already cancelled and its marker set: the stock was never given back and
-- nothing could retry it. Now either both happen or neither does.
--
-- Every line that took stock is given back what it has not given back yet
-- (`qty` minus `restockedQty`), whatever its line status: a line marked
-- "İptal" on its own changes no stock, so skipping it lost those units for
-- good. Each credited line is stamped `restockedQty = qty`, so a later
-- per-line restock (restock_order_lines) cannot credit it twice.
--
-- `p_restock = false` claims the marker and credits nothing: the operator
-- cancelled a parcel that is already with the carrier.
--
-- Returns NULL when the marker was already set (another call released it),
-- otherwise {"lines": [{index, productId, productName, qty, stockAfter}]}.
create or replace function public.release_order_inventory(
  p_order_id text,
  p_restock  boolean,
  p_now      text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  o_items    jsonb;
  item       jsonb;
  idx        int;
  give       int;
  new_stock  int;
  next_items jsonb := '[]'::jsonb;
  released   jsonb := '[]'::jsonb;
begin
  update public.orders
     set "stockReleasedAt" = p_now
   where id = p_order_id
     and "stockReleasedAt" = ''
  returning coalesce(items, '[]'::jsonb) into o_items;
  if not found then
    return null;
  end if;
  if not p_restock then
    return jsonb_build_object('lines', released);
  end if;

  for item, idx in
    select e.value, (e.n - 1)::int
      from jsonb_array_elements(o_items) with ordinality as e(value, n)
  loop
    give := coalesce((item ->> 'qty')::int, 0)
          - coalesce((item ->> 'restockedQty')::int, 0);
    if coalesce(item ->> 'productId', '') <> '' and give > 0 then
      new_stock := public.credit_product_stock(
        item ->> 'productId', item ->> 'variantId', give, p_now);
      if new_stock is not null then
        item := jsonb_set(item, '{restockedQty}', to_jsonb((item ->> 'qty')::int));
        released := released || jsonb_build_array(jsonb_build_object(
          'index', idx,
          'productId', item ->> 'productId',
          'productName', coalesce(item ->> 'productName', ''),
          'qty', give,
          'stockAfter', new_stock));
      end if;
    end if;
    next_items := next_items || jsonb_build_array(item);
  end loop;

  if jsonb_array_length(released) > 0 then
    update public.orders set items = next_items where id = p_order_id;
  end if;
  return jsonb_build_object('lines', released);
end;
$$;

-- ── restock_order_lines ───────────────────────────────────────────────────
-- Gives chosen lines back to stock: the refund modal's "stoğa geri al".
-- `p_lines` is [{index, qty}]; each line gives at most what it has not given
-- back yet, under the order's row lock, so two refunds of the same line
-- cannot both credit it. Returns NULL for an unknown order, otherwise
-- {"lines": [...]} as release_order_inventory does.
create or replace function public.restock_order_lines(
  p_order_id text,
  p_lines    jsonb,
  p_now      text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  o_items   jsonb;
  req       jsonb;
  idx       int;
  want      int;
  item      jsonb;
  done      int;
  give      int;
  new_stock int;
  released  jsonb := '[]'::jsonb;
begin
  select coalesce(items, '[]'::jsonb) into o_items
    from public.orders
   where id = p_order_id
     for update;
  if not found then
    return null;
  end if;

  for req in select value from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    idx := (req ->> 'index')::int;
    want := coalesce((req ->> 'qty')::int, 0);
    if idx is null or idx < 0 or idx >= jsonb_array_length(o_items) or want <= 0 then
      continue;
    end if;
    item := o_items -> idx;
    done := coalesce((item ->> 'restockedQty')::int, 0);
    give := least(want, coalesce((item ->> 'qty')::int, 0) - done);
    if coalesce(item ->> 'productId', '') = '' or give <= 0 then
      continue;
    end if;
    new_stock := public.credit_product_stock(
      item ->> 'productId', item ->> 'variantId', give, p_now);
    if new_stock is null then
      continue;
    end if;
    o_items := jsonb_set(o_items, array[idx::text, 'restockedQty'], to_jsonb(done + give));
    released := released || jsonb_build_array(jsonb_build_object(
      'index', idx,
      'productId', item ->> 'productId',
      'productName', coalesce(item ->> 'productName', ''),
      'qty', give,
      'stockAfter', new_stock));
  end loop;

  if jsonb_array_length(released) > 0 then
    update public.orders set items = o_items where id = p_order_id;
  end if;
  return jsonb_build_object('lines', released);
end;
$$;

-- ── set_order_item_status ─────────────────────────────────────────────────
-- One line's status, written in place. The panel read the whole items array,
-- changed one line in JavaScript and wrote the array back, so a save that
-- raced a stock release overwrote the release's `restockedQty`. Refused
-- (NULL) for an unknown line, an unknown status, or an order whose status is
-- not in `p_allowed` (a jsonb array of statuses).
create or replace function public.set_order_item_status(
  p_order_id text,
  p_index    int,
  p_status   text,
  p_allowed  jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  out_items jsonb;
begin
  update public.orders o
     set items = jsonb_set(o.items, array[p_index::text, 'status'], to_jsonb(p_status))
   where o.id = p_order_id
     and p_status in ('pending', 'ready', 'cancelled')
     and p_index >= 0
     and p_index < jsonb_array_length(o.items)
     and coalesce(p_allowed, '[]'::jsonb) ? o.status
  returning o.items into out_items;
  return out_items;
end;
$$;

-- ── reserve_order_refund_once ─────────────────────────────────────────────
-- reserve_order_refund with two more guards, in the same single UPDATE:
--
--   · the cap is what was actually collected (`p_cap`), not the order total:
--     a POS that took ₺1 for a ₺500 order must not be asked to refund ₺500;
--   · the refund modal's one-time token (`p_refund ->> 'token'`): a second
--     submit of the same modal - a double click, a retry after a timeout -
--     finds its token already in the ledger and is refused before the POS
--     is asked again.
--
-- Returns the new refunds array, or NULL when refused. The old function
-- stays for the deployment that is still running while this one rolls out.
create or replace function public.reserve_order_refund_once(
  p_order_id text,
  p_refund   jsonb,
  p_cap      int
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  out_refunds jsonb;
begin
  update public.orders o
     set refunds = coalesce(o.refunds, '[]'::jsonb) || jsonb_build_array(p_refund)
   where o.id = p_order_id
     and (p_refund ->> 'amountMinor')::int > 0
     and least(o."totalMinor", greatest(coalesce(p_cap, 0), 0)) - coalesce((
           select sum((r ->> 'amountMinor')::int)
             from jsonb_array_elements(coalesce(o.refunds, '[]'::jsonb)) r
         ), 0) >= (p_refund ->> 'amountMinor')::int
     and (
       coalesce(p_refund ->> 'token', '') = ''
       or not exists (
         select 1
           from jsonb_array_elements(coalesce(o.refunds, '[]'::jsonb)) r
          where r ->> 'token' = p_refund ->> 'token'
       )
     )
  returning o.refunds into out_refunds;
  return out_refunds;
end;
$$;
