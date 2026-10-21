-- How long a pickup ("Gel-al") order takes to get ready, in minutes
-- (17 Oct 2026).
--
-- The home page's order shortcut said "Gel-al · 15 dk" in the component
-- itself; it now reads this column, edited in Ayarlar → Kargo ve kurye. The
-- default is the 15 the card has always shown, so nothing on the site changes
-- until the operator changes it. Presentation only: no order, price or ETA
-- in the mobile API reads it.
--
-- Additive and idempotent. No `insert into public._migrations`:
-- scripts/db-migrate.mjs records the file itself.

alter table public.settings add column if not exists "pickupReadyMinutes" integer not null default 15;
