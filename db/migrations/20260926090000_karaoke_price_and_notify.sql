-- Karaoke: ₺1.000 an hour, and a dedicated address for new requests.
--
-- The operator asked for both on 26 Eyl 2026. The hourly price has always
-- been a settings row (Ayarlar → Karaoke) and stays one; this only moves the
-- live value and the default a fresh database seeds with. Reservations
-- already taken keep the price they were quoted - it is stored on the row.
--
-- "karaokeNotifyEmail" is where `sendKaraokeOperatorEmail` sends a request
-- the moment it is taken, from the app or from the web `/karaoke` form. Until
-- now that notice went to the public contact address (`email`), and only for
-- bookings made in the app. Empty falls back to `email`, so clearing the field
-- in the panel is safe.
--
-- 19 Ekim 2026: the update below runs once. The app replays the whole
-- bundle whenever a deploy adds a migration (src/lib/db/bootstrap.ts), and
-- unguarded it wrote this price and this address back over the panel's
-- values each time. The address itself is cleared by
-- 20261019090000_karaoke_notify_company_mailbox.sql (a personal Gmail inbox
-- abroad, KVKK m.9).
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

alter table public.settings add column if not exists "karaokeNotifyEmail" text not null default '';
alter table public.settings alter column "karaokeHourlyMinor" set default 100000;

update public.settings
   set "karaokeHourlyMinor" = 100000,
       "karaokeNotifyEmail" = 'bizimfutbol9@gmail.com'
 where not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20260926090000_karaoke_price_and_notify.sql'
   );
