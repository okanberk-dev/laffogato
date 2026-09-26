-- Karaoke: who to reach about a booking, and their permission to be reached.
--
-- The operator asked (26 Eyl 2026) that a web booking carry a name, an
-- e-mail and a phone, with the member's consent to be contacted about it:
-- a cancelled or moved evening has to reach someone. The account's own
-- e-mail stays in "customerEmail" (it scopes "my reservations" and the
-- two-open-bookings cap); these are the contact details given on the form.
--
-- Empty on rows written before this and on bookings from the app, which does
-- not send them (the mobile contract is unchanged).
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.karaoke_reservations add column if not exists "contactEmail"     text not null default '';
alter table public.karaoke_reservations add column if not exists "contactPhone"     text not null default '';
alter table public.karaoke_reservations add column if not exists "contactConsentAt" text not null default '';
