-- Karaoke: the köşk's late cancel is made good, and an hour cancelled late
-- and sold again refunds the share kept for it.
--
-- OP-KARAOKE-GOODWILL (18 Eki 2026; Haksız Şartlar Yön. EK-1 (ç)): when the
-- köşk has to cancel after the guest's own free moment, for a reason that is
-- not force majeure, and the booking keeps a share on a late cancel, the
-- guest gets that share again as a make-good on top of the full refund: an
-- hour of the same length for free (booked within 6 months) or the amount
-- paid to their own bank account. One of the two; the other then closes.
--
-- ASK-OTH-3-CFG (18 Eki 2026; TBK m.325/2 kıyasen): an hour a guest
-- cancelled late (a late share of 1..99 %) that is sold again refunds the
-- share kept for it. Each hour once, to the booking that last cancelled it
-- late; the hours already counted are kept on that booking.
--
-- karaoke_reservations, on the cancelled booking:
--   "makeGoodUntil"      the last day (YYYY-MM-DD, Istanbul) the free hour
--                        can be booked: the cancel day plus 6 months
--   "makeGoodMinor"      the make-good, kuruş (the share a late cancel keeps)
--   "makeGoodUsedAt"     when it was used (ISO): an hour given or the money
--                        paid; NULL while open
--   "makeGoodPaidMinor"  paid by bank transfer: the amount, kuruş
--   "makeGoodPaidOn"     and the day of the transfer (YYYY-MM-DD). The IBAN
--                        is never written here; the receipt stays with the
--                        accounts.
--   "resoldHours"        hours (start hours, jsonb array) already refunded
--                        because they were sold again
--   "resaleRefundMinor"  the part of "refundMinor" owed or refunded for them
--   "refundSettledMinor" the part of "refundMinor" that had already gone back
--                        (recorded by hand) when the booking was owed money
--                        again because one of its hours was sold again: the
--                        step under way asks for "refundMinor" minus this,
--                        and on a 'refunded' row the last step was that much
--                        (the Gün sonu sheet dates it by "refundedAt")
-- on the free hour itself:
--   "makeGoodFor"        the booking it makes good. Total 0, paid nothing
--                        (paymentStatus 'none'), made by the staff
--                        (channel 'staff'); at most one live per booking.
--
-- karaoke_open_cap: a free hour the staff give is not one of the guest's own
-- open bookings, so it neither hits nor uses up the cap.
--
-- karaoke_charge_resold_hours: counts sold-again hours on a late-cancelled
-- booking under its row lock (rule 20: two payments for different hours of
-- the same evening must not lose each other's count, and the same hour
-- reported twice is counted once).
--
-- karaoke_give_make_good_hour: "Telafi saati ver" in one statement: the
-- make-good is claimed and the free hour written together, under the made
-- good booking's row lock, so a free hour that cannot be written (its hour
-- taken, 23P01) leaves the make-good open, and the claim never survives
-- without its hour.
--
-- karaoke_release_make_good_hour: the free hour cancelled, and (before it
-- began) its make-good open again, in one statement: the guest never loses
-- the make-good to a cancel whose second write did not happen.
--
-- Safe on a live table: nullable columns, checks every existing row
-- satisfies (all NULL), a partial unique index over no rows yet.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.karaoke_reservations add column if not exists "makeGoodUntil"     text;
alter table public.karaoke_reservations add column if not exists "makeGoodMinor"     integer;
alter table public.karaoke_reservations add column if not exists "makeGoodUsedAt"    text;
alter table public.karaoke_reservations add column if not exists "makeGoodPaidMinor" integer;
alter table public.karaoke_reservations add column if not exists "makeGoodPaidOn"    text;
alter table public.karaoke_reservations add column if not exists "makeGoodFor"       text;
alter table public.karaoke_reservations add column if not exists "resoldHours"       jsonb;
alter table public.karaoke_reservations add column if not exists "resaleRefundMinor" integer;
alter table public.karaoke_reservations add column if not exists "refundSettledMinor" integer;

do $$
begin
  -- A make-good has an amount and a last day together, is used at most once,
  -- and a transfer has both its amount and its day.
  if not exists (
    select 1 from pg_constraint
     where conname = 'karaoke_reservations_make_good_check'
       and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_make_good_check
      check (
        ("makeGoodUntil" is null) = ("makeGoodMinor" is null)
        and ("makeGoodMinor" is null or "makeGoodMinor" > 0)
        and ("makeGoodUsedAt" is null or "makeGoodUntil" is not null)
        and ("makeGoodPaidMinor" is null) = ("makeGoodPaidOn" is null)
        and ("makeGoodPaidMinor" is null
             or ("makeGoodPaidMinor" > 0 and "makeGoodUsedAt" is not null))
      );
  end if;
  -- The resale part is a part of what goes back: never more, never negative.
  if not exists (
    select 1 from pg_constraint
     where conname = 'karaoke_reservations_resale_refund_check'
       and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_resale_refund_check
      check ("resaleRefundMinor" is null
             or ("resaleRefundMinor" >= 0
                 and "refundMinor" is not null
                 and "resaleRefundMinor" <= "refundMinor"));
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'karaoke_reservations_refund_settled_check'
       and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_refund_settled_check
      check ("refundSettledMinor" is null
             or ("refundSettledMinor" >= 0
                 and "refundMinor" is not null
                 and "refundSettledMinor" <= "refundMinor"));
  end if;
end $$;

-- One live free hour per booking made good: two staff members pressing
-- "Telafi saati ver" at once cannot give two.
create unique index if not exists karaoke_reservations_make_good_once
  on public.karaoke_reservations ("makeGoodFor")
  where "makeGoodFor" is not null and status <> 'cancelled';

-- Same as 20261016063311_karaoke_prepay.sql, plus: a free hour the staff
-- give ("makeGoodFor" set) is neither capped nor counted.
create or replace function public.karaoke_open_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  today      text;
  open_count int;
begin
  if new.status = 'cancelled' or new."makeGoodFor" is not null then
    return new;
  end if;
  perform pg_advisory_xact_lock(
    hashtext('karaoke-open-cap:' || case when new.guest then 'guest:' else '' end
             || lower(new."customerEmail")));
  today := to_char((now() at time zone 'Europe/Istanbul')::date, 'YYYY-MM-DD');
  select count(*) into open_count
    from public.karaoke_reservations
   where lower("customerEmail") = lower(new."customerEmail")
     and guest = new.guest
     and status <> 'cancelled'
     and "makeGoodFor" is null
     and date >= today;
  if open_count >= 2 then  -- KARAOKE_OPEN_CAP
    raise exception 'TOO_MANY_OPEN_RESERVATIONS' using errcode = 'P0001';
  end if;
  if new.guest and new."contactPhone" <> '' then
    perform pg_advisory_xact_lock(
      hashtext('karaoke-open-cap-phone:' || new."contactPhone"));
    select count(*) into open_count
      from public.karaoke_reservations
     where guest
       and "contactPhone" = new."contactPhone"
       and status <> 'cancelled'
       and "makeGoodFor" is null
       and date >= today;
    if open_count >= 2 then  -- KARAOKE_OPEN_CAP
      raise exception 'TOO_MANY_OPEN_RESERVATIONS' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- Hours of a late-cancelled booking that were sold again (`p_hours`, a jsonb
-- array of start hours; those outside the booking and those already counted
-- are ignored). Returns the kuruş this call added to what goes back, 0 when
-- nothing new. The share a late cancel kept is "paidMinor" minus the late
-- refund ("refundMinor" without its resale part); the resale part is
-- round(kept x counted hours / hours) of it, counted as a whole each time
-- (half a kuruş rounds up, numeric round), so the parts add up to exactly
-- what was kept and never more. Money owed again puts the booking back in
-- 'refunding': a person refunds it in PayNkolay's panel (partial refunds are
-- not sent to the POS, docs/PAYNKOLAY.md §3.2). A booking that was
-- 'refunded' keeps what had already gone back in "refundSettledMinor", so
-- the panel asks only for the rest. "updatedAt" is not touched: on a
-- cancelled row it is the cancel instant, which decides the booking that
-- cancelled an hour last.
create or replace function public.karaoke_charge_resold_hours(
  p_id    text,
  p_hours jsonb
)
returns int
language plpgsql
set search_path = ''
as $$
declare
  r       public.karaoke_reservations%rowtype;
  counted jsonb;
  fresh   jsonb;
  before  int;
  share   int;
  kept    int;
  after   int;
begin
  select * into r
    from public.karaoke_reservations
   where id = p_id
     for update;
  if not found
     or r.status <> 'cancelled'
     or r."refundMinor" is null
     or r."paymentStatus" not in ('refunding', 'refunded')
     or r."makeGoodFor" is not null
     or r.hours <= 0 then
    return 0;
  end if;
  counted := coalesce(r."resoldHours", '[]'::jsonb);
  select coalesce(jsonb_agg(h order by h), '[]'::jsonb) into fresh
    from (
      select distinct (value)::int as h
        from jsonb_array_elements_text(coalesce(p_hours, '[]'::jsonb))
    ) asked
   where h >= r."startHour"
     and h < r."startHour" + r.hours
     and not counted @> to_jsonb(h);
  if jsonb_array_length(fresh) = 0 then
    return 0;
  end if;
  before := coalesce(r."resaleRefundMinor", 0);
  share := r."refundMinor" - before;
  kept := r."paidMinor" - share;
  if kept <= 0 then
    return 0;
  end if;
  after := round(
    kept::numeric * (jsonb_array_length(counted) + jsonb_array_length(fresh))
      / r.hours
  )::int;
  update public.karaoke_reservations
     set "resoldHours" = counted || fresh,
         "resaleRefundMinor" = after,
         "refundMinor" = share + after,
         "paymentStatus" = case
           when after > before then 'refunding'
           else "paymentStatus"
         end,
         "refundSettledMinor" = case
           when after > before and r."paymentStatus" = 'refunded'
             then r."refundMinor"
           else r."refundSettledMinor"
         end
   where id = p_id;
  return after - before;
end;
$$;

-- "Telafi saati ver": the free hour of the same length for the guest of a
-- booking the köşk cancelled late, and the make-good used by it, in one
-- statement. 'given'; 'not_open' when the booking has no open make-good
-- (never had one, or its hour or its money was used: the other then
-- closes); 'expired' past the free hour's last day (`p_today`, Istanbul).
-- The hour copies the guest (address, name, contact, guest flag) and the
-- length from the booking; the day, the start, the group and the policy
-- snapshot come from the caller, which checked them against the room
-- (karaoke-payment.ts). The overlap constraint (23P01) and the one live hour
-- per booking (23505) still hold: either error undoes the claim too.
create or replace function public.karaoke_give_make_good_hour(
  p_for                 text,
  p_id                  text,
  p_date                text,
  p_start_hour          integer,
  p_guests              integer,
  p_today               text,
  p_now                 text,
  p_tax_rate_pct        integer,
  p_free_cancel_hours   integer,
  p_late_refund_percent integer,
  p_cancel_deadline     text,
  p_cancellation_rules  jsonb
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  r public.karaoke_reservations%rowtype;
begin
  select * into r
    from public.karaoke_reservations
   where id = p_for
     for update;
  if not found
     or r.status <> 'cancelled'
     or r."makeGoodMinor" is null
     or r."makeGoodUntil" is null
     or r."makeGoodUsedAt" is not null then
    return 'not_open';
  end if;
  if p_today > r."makeGoodUntil" then
    return 'expired';
  end if;
  update public.karaoke_reservations
     set "makeGoodUsedAt" = p_now
   where id = p_for;
  insert into public.karaoke_reservations (
    id, "customerEmail", "customerName", "contactEmail", "contactPhone",
    "contactConsentAt", date, "startHour", hours, guests, status,
    "priceMinor", "discountMinor", "totalMinor", note, "createdAt",
    "updatedAt", "paymentStatus", "paymentDueAt", "paidAt", "refundedAt",
    "paidMinor", "paymentRef", channel, "legalConsent", guest, "taxRatePct",
    "freeCancelHours", "lateRefundPercent", "cancelDeadline",
    "cancellationRules", "refundMinor", "makeGoodFor"
  ) values (
    p_id, r."customerEmail", r."customerName", r."contactEmail",
    r."contactPhone", r."contactConsentAt", p_date, p_start_hour, r.hours,
    p_guests, 'confirmed', 0, 0, 0, 'Telafi: ' || upper(r.id), p_now, p_now,
    'none', '', '', '', 0, '', 'staff', null, r.guest, p_tax_rate_pct,
    p_free_cancel_hours, p_late_refund_percent, p_cancel_deadline,
    p_cancellation_rules, null, r.id
  );
  return 'given';
end;
$$;

-- A free hour let go (the guest on its page or through the app, the köşk in
-- the panel): cancelled while it is still the confirmed free hour it was
-- read as; with `p_reopen` (the caller's clock says the hour has not begun)
-- the make-good it used is open again, unless the money was recorded.
-- 'reopened', 'cancelled', or 'raced' when the hour had moved on (nothing
-- written). "updatedAt" is the cancel instant, as on every cancelled row.
create or replace function public.karaoke_release_make_good_hour(
  p_id     text,
  p_now    text,
  p_reopen boolean
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  hour_for text;
begin
  update public.karaoke_reservations
     set status = 'cancelled',
         "updatedAt" = p_now
   where id = p_id
     and status = 'confirmed'
     and "paymentStatus" = 'none'
     and "makeGoodFor" is not null
  returning "makeGoodFor" into hour_for;
  if not found then
    return 'raced';
  end if;
  if p_reopen then
    update public.karaoke_reservations
       set "makeGoodUsedAt" = null
     where id = hour_for
       and "makeGoodPaidMinor" is null
       and "makeGoodUsedAt" is not null;
    if found then
      return 'reopened';
    end if;
  end if;
  return 'cancelled';
end;
$$;
