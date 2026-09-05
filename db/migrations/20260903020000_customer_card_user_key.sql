-- Saved cards: one opaque provider key per member.
--
-- `cardUserKey` is iyzico's identifier for a buyer's stored cards. The card
-- itself — PAN, expiry, CVV — never reaches this database or this codebase:
-- the member types it on iyzico's own hosted form, and all we keep is a key
-- that is meaningless without our merchant credentials. That is the whole
-- point of storing it rather than a card.
--
-- It is server-only. It is never mapped into /me (see toMe), and account
-- deletion clears it along with everything else that identifies the member
-- (see ANON_SWEEPS / deleteMe).
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.customers add column if not exists "cardUserKey" text not null default '';
