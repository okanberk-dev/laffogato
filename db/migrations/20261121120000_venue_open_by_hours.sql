-- The köşk's open/closed follows the posted hours alone (21 Kas 2026,
-- operator: "köşk açık yoğun vs. durumunu kaldır, belli aralık olan o
-- saatlerde otomatik çeksin"). The panel no longer offers the manual
-- override (the top bar's köşk chip is gone, Canlı durum has no Açık /
-- Kapalı choice, every save writes 'auto'), so a row left on 'open' or
-- 'closed' would have stayed so with no way back: the app would have kept
-- refusing (or taking) café orders against Ayarlar → Saatler.
--
-- The single row is put back on 'auto'. The column stays: GET
-- /api/mobile/v1/live-status and the order check read it (docs/API-MOBILE.md
-- §6, unchanged), and 'auto' is the value they already understand.
--
-- Once only, like 20261027120000_retire_fal_ai_consents.sql: the bundle
-- replays every migration when a deploy adds one, and a later choice must
-- not be undone by a replay.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs and
-- the bundle do that themselves, right after the file.

update public.venue_status
   set "manualOverride" = 'auto'
 where "manualOverride" <> 'auto'
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261121120000_venue_open_by_hours.sql'
   );
