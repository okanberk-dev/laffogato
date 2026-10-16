-- Karaoke: the room is paid for online when it is booked (PayNkolay).
--
-- Operator, 16 Eki 2026: "Karaokede de ödeme alsın". A web booking, and an
-- app booking that opts in with `prepay: true` (docs/API-MOBILE.md §7), is
-- paid by card the moment it is made, and the payment confirms it on its own.
-- The hour is held while the member pays; an unpaid hold lapses after the POS
-- was asked (`expireUnpaidReservations`, CLAUDE.md rule 29) and frees the hour.
--
-- `status` keeps its three values on purpose. `requested` already holds the
-- hour in the JS check, in `karaoke_reservations_no_overlap` (status <>
-- 'cancelled') and in the `karaoke_open_cap` trigger, and every app build
-- reads an unknown status as "requested". The payment lives beside it:
--
--   "paymentStatus"  none       pay at the venue: rows from before this, the
--                               panel's switch off, app builds that do not
--                               opt in
--                    pending    hold waiting for its payment (status requested)
--                    paid       collected; the booking is then confirmed
--                    refunding  a refund was started and is not settled - a
--                               POS that did not answer is not "refunded"
--                    refunded   the money went back (status cancelled)
--                    expired    the hold lapsed unpaid (status cancelled)
--   "paymentDueAt"   when the newest payment page stops taking the card
--   "paidAt" "refundedAt" "paidMinor"
--   "paymentRef"     the provider reference of THE payment that paid the row.
--                    Any other succeeded payment for the same reservation is
--                    a second charge and is sent back (karaoke-payment.ts).
--   channel          'web' | 'app' ('' on older rows): where the payment
--                    return sends the member - decided by the row, never by a
--                    query string anyone can type
--   "legalConsent"   the pre-information and contract confirmation, in the
--                    shape of orders."legalConsent" (MSY m.7; kept 3 years,
--                    m.20)
--   guest            true for a web booking made without an account
--                    (operator, 16 Eki 2026: "üyeliksiz de yapabilsinler").
--                    "customerEmail" then holds the contact address only so
--                    the per-address cap below covers it; the row never
--                    shows in a member's list, inbox or loyalty tier, and it
--                    is reached through a signed link (karaoke-link.ts).
--
-- Payment rows reuse payment_transactions with "orderId" = the reservation id
-- (the `krk-` namespace, `isKaraokeRef`); that column has no foreign key.
--
-- settings."karaokePrepay" is the panel's switch (Ayarlar → Karaoke). On by
-- default; off brings back the pay-at-the-venue request flow.
--
-- Safe on a live table: every column is added with a default every existing
-- row satisfies, and both checks hold for 'none'.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.karaoke_reservations add column if not exists "paymentStatus" text    not null default 'none';
alter table public.karaoke_reservations add column if not exists "paymentDueAt"  text    not null default '';
alter table public.karaoke_reservations add column if not exists "paidAt"        text    not null default '';
alter table public.karaoke_reservations add column if not exists "refundedAt"    text    not null default '';
alter table public.karaoke_reservations add column if not exists "paidMinor"     integer not null default 0;
alter table public.karaoke_reservations add column if not exists "paymentRef"    text    not null default '';
alter table public.karaoke_reservations add column if not exists channel         text    not null default '';
alter table public.karaoke_reservations add column if not exists "legalConsent"  jsonb;
alter table public.karaoke_reservations add column if not exists guest           boolean not null default false;

-- The six values, and the two facts every payment state implies about the
-- booking: a hold waiting for its money is still a request, and money that
-- lapsed or went back leaves no booking behind. A code path that moved one
-- column without the other would otherwise strand an hour (held but never
-- swept) or keep a slot for a refunded evening.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'karaoke_reservations_payment_status_check'
       and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_payment_status_check
      check ("paymentStatus" in
        ('none', 'pending', 'paid', 'refunding', 'refunded', 'expired'));
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'karaoke_reservations_payment_state_check'
       and conrelid = 'public.karaoke_reservations'::regclass
  ) then
    alter table public.karaoke_reservations
      add constraint karaoke_reservations_payment_state_check
      check (
        ("paymentStatus" <> 'pending' or status = 'requested')
        and ("paymentStatus" not in ('expired', 'refunded')
             or status = 'cancelled')
      );
  end if;
end $$;

-- The sweep reads the oldest unpaid holds; the check above makes every
-- pending row a live request, so the predicate needs no status term.
create index if not exists karaoke_reservations_unpaid_hold_idx
  on public.karaoke_reservations ("paymentDueAt")
  where "paymentStatus" = 'pending';

alter table public.settings add column if not exists "karaokePrepay" boolean not null default true;

-- The open-bookings cap, now also per phone number for guest bookings. A
-- guest has no verified address: the same person could otherwise hold the
-- room under a fresh e-mail each time. Same lock-then-count shape as the
-- e-mail branch (20260923110000_atomic_caps_and_refunds.sql), so two guest
-- bookings with one number cannot both pass at the same instant.
--
-- Guest and member rows are counted APART: a guest types an address it
-- does not have to own, and two guest holds under a member's address must
-- not lock that member out of their own two bookings. Member rows (guest =
-- false, which every row before this migration is) count exactly as before.
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
    hashtext('karaoke-open-cap:' || case when new.guest then 'guest:' else '' end
             || lower(new."customerEmail")));
  today := to_char((now() at time zone 'Europe/Istanbul')::date, 'YYYY-MM-DD');
  select count(*) into open_count
    from public.karaoke_reservations
   where lower("customerEmail") = lower(new."customerEmail")
     and guest = new.guest
     and status <> 'cancelled'
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
       and date >= today;
    if open_count >= 2 then  -- KARAOKE_OPEN_CAP
      raise exception 'TOO_MANY_OPEN_RESERVATIONS' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
