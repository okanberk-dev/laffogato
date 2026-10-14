-- Wallet ledger and paying an app order from it (docs/API-MOBILE.md §18).
--
-- §18 promised `POST /orders` with `"payWithWallet": true` - the balance pays
-- the whole order or nothing (409 `insufficient_balance`, no order, no partial
-- charge) - but nothing on the server held a balance at all. This adds the
-- ledger the promise needs and the one function that spends from it.
--
-- The balance is never stored: it is the sum of the member's rows. A stored
-- balance would be a counter updated in JavaScript, which is exactly the
-- read-modify-write that loses writes under concurrency (CLAUDE.md rule 20).
-- `amountMinor` is signed: a top-up or a refund is positive, a spend negative.
--
-- Additive and idempotent: a new table, two partial unique indexes and a new
-- function. No existing table changes.

create table if not exists public.wallet_transactions (
  id              text primary key
                    default ('wtx_' || replace(gen_random_uuid()::text, '-', '')),
  "customerEmail" text   not null,
  kind            text   not null
                    check (kind in ('topup', 'spend', 'refund', 'bonus', 'expiry', 'adjust')),
  "amountMinor"   bigint not null,
  "bonusMinor"    bigint not null default 0,
  title           text   not null default '',
  "orderId"       text   not null default '',
  -- The order's refund ledger entry this row credits back (`orders.refunds[].id`).
  "refundId"      text   not null default '',
  "createdAt"     text   not null default ''
);

create index if not exists wallet_transactions_customer_idx
  on public.wallet_transactions ("customerEmail", "createdAt" desc);

-- One spend per order: a replayed placement can never charge twice.
create unique index if not exists wallet_transactions_order_spend_key
  on public.wallet_transactions ("orderId")
  where kind = 'spend';

-- One credit per refund entry: a retried admin refund credits once.
create unique index if not exists wallet_transactions_refund_key
  on public.wallet_transactions ("orderId", "refundId")
  where kind = 'refund';

alter table public.wallet_transactions enable row level security;

-- Inserts the order AND its spend in ONE transaction, or neither.
--
-- `p_order` is the order row exactly as the store would insert it (camelCase
-- keys = column names). Only the keys present are written, so every other
-- column keeps its default - the same thing the query builder's INSERT does.
-- The amount is the row's own `totalMinor`, never a separate argument, so the
-- spend cannot drift from what the order costs.
--
-- A transaction-level advisory lock on the member serialises two checkouts of
-- the same wallet: the second one waits, and its sum sees the spend the first
-- one committed. Without it both would read the same balance and both spend it.
--
-- Returns true when the order was placed and paid from the wallet, false when
-- the balance does not cover it (nothing is written). Errors from the order
-- insert (the pending-order cap trigger, a duplicate clientOrderId) propagate
-- and roll the whole call back.
create or replace function public.wallet_place_order(
  p_order      jsonb,
  p_title      text,
  p_created_at text
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_email   text   := lower(btrim(coalesce(p_order->>'customerEmail', '')));
  v_order   text   := coalesce(p_order->>'id', '');
  v_amount  bigint := (p_order->>'totalMinor')::bigint;
  v_balance bigint;
  v_cols    text;
begin
  if v_email = '' or v_order = '' or v_amount is null or v_amount <= 0 then
    raise exception 'WALLET_BAD_ORDER';
  end if;

  perform pg_advisory_xact_lock(hashtext('wallet:' || v_email));

  select coalesce(sum("amountMinor"), 0) into v_balance
    from public.wallet_transactions
   where "customerEmail" = v_email;
  if v_balance < v_amount then
    return false;
  end if;

  select string_agg(quote_ident(k), ', ') into v_cols
    from jsonb_object_keys(p_order) as k;
  execute format(
    'insert into public.orders (%1$s) select %1$s from jsonb_populate_record(null::public.orders, $1)',
    v_cols
  ) using p_order;

  insert into public.wallet_transactions
    ("customerEmail", kind, "amountMinor", title, "orderId", "createdAt")
  values
    (v_email, 'spend', -v_amount, coalesce(p_title, ''), v_order, p_created_at);
  return true;
end;
$$;
