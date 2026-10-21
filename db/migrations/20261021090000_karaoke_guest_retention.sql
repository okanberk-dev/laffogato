-- Karaoke bookings: the guest's identity and every contact detail go three
-- years after the booking day, the booking itself after eleven (decision
-- ASK-RETENTION, legal programme of 18 Oct 2026; KVKK m.4/2-d and m.7/1;
-- Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi
-- Hakkında Yönetmelik m.11: at the first periodic destruction once the
-- period is over).
--
-- The Veri Saklama ve İmha Politikası gave a booking made without an account
-- no period at all: the name, e-mail and phone a guest typed stayed for ever,
-- and so did the contact address, phone and note of every booking. The
-- policy now publishes two periods (src/lib/legal/content.ts) and
-- src/lib/retention.ts runs them, daily, through the two functions below:
--
--   karaoke_guest_retention        3 x 366 days after "date". On a guest
--                                  booking the name goes and "customerEmail"
--                                  becomes 'anon-<id>@anon.local'. On every
--                                  booking "contactEmail", "contactPhone" and
--                                  note go, and the consent record keeps its
--                                  time, documents and version but loses
--                                  "ip" and "userAgent" (a NULL record stays
--                                  NULL). The member's own name and address
--                                  stay: the membership keeps them, and
--                                  account deletion clears them.
--   karaoke_reservation_retention  11 x 366 days after "date": the row goes.
--                                  Payment and refund records are kept ten
--                                  years from the end of their calendar year
--                                  (TTK m.82/5-6), so eleven 366-day years
--                                  never take one early.
--
-- Both skip a booking whose money is still open ('pending': a hold the POS
-- has not settled; 'refunding': a refund the POS has not confirmed; neither
-- is finished, CLAUDE.md rule 29) and one under a hold:
--
--   "retentionHold"  '' (the default): nothing stops the destruction.
--                    Otherwise the reason the row is kept past its period: a
--                    dispute, a complaint or an official request ("Hakkında
--                    uyuşmazlık bulunan kayıt, uyuşmazlık kesin olarak
--                    sonuçlanana kadar saklanır"). Written and cleared by
--                    hand in SQL; nothing in the app writes it, and no API
--                    response carries it.
--
-- "date" is the köşk's calendar day ("YYYY-MM-DD", Europe/Istanbul), compared
-- as text with the first ten characters of p_cutoff, which retention.ts
-- writes on the köşk's clock (+03:00, CLAUDE.md rule 22). Two guards keep a
-- bad value from destroying early: a cutoff that is not a day, or that lies
-- after today, raises (22007) instead of matching; a row whose "date" is not
-- in that shape is never in scope (a malformed day can sort before any
-- cutoff).
--
-- The guest placeholder never collides with account deletion's
-- 'deleted-<customer id>@anon.local' (src/lib/mobile/me.ts): another prefix
-- and the booking's own id, so it is unique per row. Account deletion only
-- rewrites member rows (guest = false), so it never meets one.
--
-- A row already cleared is not counted again: the guest function counts and
-- updates only rows that still hold something to clear, so a second run with
-- the same cutoff answers 0. p_apply false only counts and writes nothing.
-- Both return integer (one cell), so retention.ts calls them through rpc(),
-- never rpcRows() (CLAUDE.md rule 23).
--
-- Safe on a live table: one column with a default every row satisfies, and
-- two functions. Undo:
--   drop function if exists public.karaoke_guest_retention(text, boolean);
--   drop function if exists public.karaoke_reservation_retention(text, boolean);
--   alter table public.karaoke_reservations drop column if exists "retentionHold";
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.karaoke_reservations
  add column if not exists "retentionHold" text not null default '';

-- ── karaoke_guest_retention ─────────────────────────────────────────────
create or replace function public.karaoke_guest_retention(
  p_cutoff text,
  p_apply boolean
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  cutoff_day text := left(p_cutoff, 10);
  affected   integer := 0;
begin
  if cutoff_day is null
     or cutoff_day !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or cutoff_day > to_char((now() at time zone 'Europe/Istanbul')::date,
                             'YYYY-MM-DD') then
    raise exception 'karaoke_guest_retention: cutoff % is not a past day', p_cutoff
      using errcode = '22007';
  end if;

  if p_apply then
    update public.karaoke_reservations r
       set "customerName"  = case when r.guest then '' else r."customerName" end,
           "customerEmail" = case when r.guest
                                  then 'anon-' || r.id || '@anon.local'
                                  else r."customerEmail" end,
           "contactEmail"  = '',
           "contactPhone"  = '',
           note            = '',
           "legalConsent"  = case when jsonb_typeof(r."legalConsent") = 'object'
                                  then r."legalConsent" - 'ip' - 'userAgent'
                                  else r."legalConsent" end
     where r.date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       and r.date < cutoff_day
       and r."paymentStatus" not in ('pending', 'refunding')
       and r."retentionHold" = ''
       and (
         (r.guest and (r."customerName" <> ''
                       or r."customerEmail" <> ('anon-' || r.id || '@anon.local')))
         or r."contactEmail" <> ''
         or r."contactPhone" <> ''
         or r.note <> ''
         or (jsonb_typeof(r."legalConsent") = 'object'
             and ((r."legalConsent" ? 'ip') or (r."legalConsent" ? 'userAgent')))
       );
    get diagnostics affected = row_count;
  else
    select count(*) into affected
      from public.karaoke_reservations r
     where r.date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       and r.date < cutoff_day
       and r."paymentStatus" not in ('pending', 'refunding')
       and r."retentionHold" = ''
       and (
         (r.guest and (r."customerName" <> ''
                       or r."customerEmail" <> ('anon-' || r.id || '@anon.local')))
         or r."contactEmail" <> ''
         or r."contactPhone" <> ''
         or r.note <> ''
         or (jsonb_typeof(r."legalConsent") = 'object'
             and ((r."legalConsent" ? 'ip') or (r."legalConsent" ? 'userAgent')))
       );
  end if;
  return affected;
end;
$$;

-- ── karaoke_reservation_retention ───────────────────────────────────────
create or replace function public.karaoke_reservation_retention(
  p_cutoff text,
  p_apply boolean
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  cutoff_day text := left(p_cutoff, 10);
  affected   integer := 0;
begin
  if cutoff_day is null
     or cutoff_day !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or cutoff_day > to_char((now() at time zone 'Europe/Istanbul')::date,
                             'YYYY-MM-DD') then
    raise exception 'karaoke_reservation_retention: cutoff % is not a past day', p_cutoff
      using errcode = '22007';
  end if;

  if p_apply then
    delete from public.karaoke_reservations r
     where r.date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       and r.date < cutoff_day
       and r."paymentStatus" not in ('pending', 'refunding')
       and r."retentionHold" = '';
    get diagnostics affected = row_count;
  else
    select count(*) into affected
      from public.karaoke_reservations r
     where r.date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       and r.date < cutoff_day
       and r."paymentStatus" not in ('pending', 'refunding')
       and r."retentionHold" = '';
  end if;
  return affected;
end;
$$;
