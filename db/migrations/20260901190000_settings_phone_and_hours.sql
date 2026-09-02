-- Correct the reservation phone and the opening hours on the live settings row.
--
-- Same shape as 20260901180000_settings_identity_backfill.sql, and for the same
-- reason: defaultSettings() only seeds when the table is empty, so an
-- installation seeded earlier keeps the old values forever and goes on serving
-- them in the footer, the contact block and the JSON-LD.
--
-- Two corrections:
--
--   phone        +90 216 459 30 60  →  +90 536 429 09 19
--   weeklyHours  10:00–23:00 (24:00 Fri/Sat)  →  09:00–01:00 every day
--
-- 01:00 is the FOLLOWING morning. schema.org expresses that by letting
-- `closes` be earlier than `opens`, which openingHoursLd() passes through
-- untouched — its "24:00" → "23:59" mapping existed for the 10:00–24:00
-- schedule this replaces.
--
-- Deliberately narrow, exactly like its predecessor: each column is touched
-- only while it still holds the exact superseded value, so anything the owner
-- has since typed in the panel is left alone and running this twice changes
-- nothing.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, with no `on conflict`, inside the same transaction.

update public.settings
  set phone = '+90 536 429 09 19'
  where id = 'main'
    and phone in ('+90 216 459 30 60', '02164593060', '+902164593060');

update public.settings
  set "weeklyHours" = jsonb_build_object(
        'mon', jsonb_build_object('open', '09:00', 'close', '01:00', 'closed', false),
        'tue', jsonb_build_object('open', '09:00', 'close', '01:00', 'closed', false),
        'wed', jsonb_build_object('open', '09:00', 'close', '01:00', 'closed', false),
        'thu', jsonb_build_object('open', '09:00', 'close', '01:00', 'closed', false),
        'fri', jsonb_build_object('open', '09:00', 'close', '01:00', 'closed', false),
        'sat', jsonb_build_object('open', '09:00', 'close', '01:00', 'closed', false),
        'sun', jsonb_build_object('open', '09:00', 'close', '01:00', 'closed', false)
      )
  where id = 'main'
    -- Only while every day still reads exactly as the superseded schedule.
    -- If the owner has edited so much as one day, this leaves the row alone.
    and "weeklyHours" -> 'mon' ->> 'open'  = '10:00'
    and "weeklyHours" -> 'mon' ->> 'close' = '23:00'
    and "weeklyHours" -> 'fri' ->> 'close' = '24:00'
    and "weeklyHours" -> 'sun' ->> 'close' = '23:00';
