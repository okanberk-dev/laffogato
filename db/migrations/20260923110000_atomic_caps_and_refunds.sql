-- Counters that were decided in JavaScript, moved into the database
-- (docs/AUDIT.md §8, "Açık" 6; CLAUDE.md rule 20).
--
-- Each of these was read → decide (JS) → write. Two requests arriving
-- together both read the old state, both decided "fine", both wrote:
--
--   · refunds          two refunds of one order could together exceed what
--                      was paid — and each one had already moved money;
--   · app pending cap  MAX_OPEN_ORDERS (3) unpaid app orders per member;
--   · karaoke cap      KARAOKE_OPEN_CAP (2) open bookings per member;
--   · till QR tokens   10 issued per member per minute.
--
-- The JS checks stay as the friendly early answer. What is added here is the
-- guard that holds under concurrency. The caps are BEFORE INSERT triggers:
-- the trigger takes a transaction-scoped advisory lock on the member, so two
-- inserts for the same member run one after the other, and the count taken
-- after the lock (a fresh snapshot per statement under READ COMMITTED) sees
-- the row the other one committed. A refused insert raises a named P0001 the
-- application maps to the same answer its own check gives.
--
-- The numbers are repeated from the TypeScript constants on purpose (one
-- literal each, next to the name it mirrors); tests/atomic-caps-sql.test.ts
-- fails if they drift apart.

-- ── Refunds ─────────────────────────────────────────────────────────────
-- Appends a refund entry only while it fits in what is left of the order, in
-- ONE UPDATE: the row lock makes a concurrent second refund wait, and Postgres
-- re-evaluates the WHERE (sum included) against the first one's result. Called
-- BEFORE the POS is asked for money; `drop_order_refund` takes the entry back
-- if the POS then refuses. Returns the new refunds array, or NULL when refused.
create or replace function public.reserve_order_refund(
  p_order_id text,
  p_refund   jsonb
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
     and o."totalMinor" - coalesce((
           select sum((r ->> 'amountMinor')::int)
             from jsonb_array_elements(coalesce(o.refunds, '[]'::jsonb)) r
         ), 0) >= (p_refund ->> 'amountMinor')::int
  returning o.refunds into out_refunds;
  return out_refunds;
end;
$$;

create or replace function public.drop_order_refund(
  p_order_id  text,
  p_refund_id text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.orders o
     set refunds = coalesce((
           select jsonb_agg(e.r order by e.n)
             from jsonb_array_elements(coalesce(o.refunds, '[]'::jsonb))
                  with ordinality as e(r, n)
            where e.r ->> 'id' is distinct from p_refund_id
         ), '[]'::jsonb)
   where o.id = p_order_id;
end;
$$;

-- ── App orders: MAX_OPEN_ORDERS unpaid per member ───────────────────────
-- Mirrors src/lib/mobile/orders.ts: pending_payment orders of the member (any
-- channel) younger than PENDING_ORDER_TTL_MINUTES (45) count; only a NEW app
-- order is refused, never a web one or an admin's manual order.
create or replace function public.app_pending_order_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  since      text;
  open_count int;
begin
  if coalesce(new.channel, '') <> 'app' or new.status <> 'pending_payment' then
    return new;
  end if;
  perform pg_advisory_xact_lock(
    hashtext('app-pending-cap:' || lower(new."customerEmail")));
  since := to_char((now() - interval '45 minutes') at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  select count(*) into open_count
    from public.orders
   where lower("customerEmail") = lower(new."customerEmail")
     and status = 'pending_payment'
     and "createdAt" >= since;
  if open_count >= 3 then  -- MAX_OPEN_ORDERS
    raise exception 'TOO_MANY_PENDING_ORDERS' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists app_pending_order_cap on public.orders;
create trigger app_pending_order_cap
  before insert on public.orders
  for each row execute function public.app_pending_order_cap();

-- ── Karaoke: KARAOKE_OPEN_CAP open bookings per member ──────────────────
-- Mirrors src/lib/mobile/karaoke.ts: bookings that are not cancelled, from
-- today on (Europe/Istanbul) count.
create or replace function public.karaoke_open_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  today      text;
  open_count int;
begin
  if new.status = 'cancelled' then
    return new;
  end if;
  perform pg_advisory_xact_lock(
    hashtext('karaoke-open-cap:' || lower(new."customerEmail")));
  today := to_char((now() at time zone 'Europe/Istanbul')::date, 'YYYY-MM-DD');
  select count(*) into open_count
    from public.karaoke_reservations
   where lower("customerEmail") = lower(new."customerEmail")
     and status <> 'cancelled'
     and date >= today;
  if open_count >= 2 then  -- KARAOKE_OPEN_CAP
    raise exception 'TOO_MANY_OPEN_RESERVATIONS' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists karaoke_open_cap on public.karaoke_reservations;
create trigger karaoke_open_cap
  before insert on public.karaoke_reservations
  for each row execute function public.karaoke_open_cap();

-- ── Till QR tokens: MAX_ISSUES_PER_WINDOW per ISSUE_WINDOW_MS ───────────
-- Mirrors src/lib/mobile/counter.ts: 10 tokens per member per 60 seconds.
create or replace function public.counter_token_issue_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  at_ts  timestamptz;
  since  text;
  issued int;
begin
  perform pg_advisory_xact_lock(
    hashtext('counter-issue-cap:' || lower(new."customerEmail")));
  at_ts := coalesce(nullif(new."createdAt", '')::timestamptz, now());
  since := to_char((at_ts - interval '60 seconds') at time zone 'UTC',
                   'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  select count(*) into issued
    from public.counter_tokens
   where "customerEmail" = new."customerEmail"
     and "createdAt" >= since;
  if issued >= 10 then  -- MAX_ISSUES_PER_WINDOW
    raise exception 'COUNTER_RATE_LIMITED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists counter_token_issue_cap on public.counter_tokens;
create trigger counter_token_issue_cap
  before insert on public.counter_tokens
  for each row execute function public.counter_token_issue_cap();
