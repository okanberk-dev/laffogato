-- fA'L's AI reading is retired (27 Oct 2026). App Review refused the iOS app
-- under Guideline 4.3(b) and fA'L left the app (lafmobil karar 330); the
-- reading is off in code (src/lib/mobile/fal-core.ts falAiEnabled), so the
-- explicit consent it rested on (Açık Rıza Metni R12, feature 'fal-ai') has
-- nothing left to cover.
--
-- Every R12 consent still standing is closed the way a member's own
-- withdrawal closes it (DELETE /fal/consent): "revokedAt" is stamped, the row
-- is NOT deleted. The row is the proof of what was agreed and when; the
-- feature-consents retention rule (src/lib/retention.ts) destroys it three
-- years after this stamp, like any other withdrawal.
--
-- "revokedAt" is ISO-8601 text, '' while the consent stands (not null in
-- this schema; the null test only guards a hand-edited row). A row already
-- withdrawn keeps its own day.
--
-- Once only: the bundle replays every migration when a deploy adds one, and
-- a later row must not be stamped with this day. The statement checks this
-- file's own `_migrations` record, like 20261019150000_cafe_food_rate_10.sql.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs and
-- the bundle do that themselves, right after the file.

update public.feature_consents
   set "revokedAt" = '2026-10-27T00:00:00.000Z'
 where feature = 'fal-ai'
   and ("revokedAt" is null or "revokedAt" = '')
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261027120000_retire_fal_ai_consents.sql'
   );
