-- One dash only: the hyphen (operator's rule, 22 Sep 2026).
--
-- The app's own text was swept on 22 Sep; the ten long dashes left on screen
-- came from this database. Re-counted on the live read-only endpoints on
-- 23 Sep 2026: /api/mobile/v1/shop 7 (product names), /menu 1 (the
-- Cappuccino description), /story 1 (the 2008 milestone), /app-content 1
-- (the "Sabah ritüeli" post), /bootstrap 0. The same rows feed the site
-- (/magaza, /menu, /hikayemiz) and the panel.
--
-- Each dash becomes "-" and the spaces around it stay as they are, so
-- "Sirena <em dash> Espresso Harmanı" reads "Sirena - Espresso Harmanı" and
-- "09:00<en dash>11:00" reads "09:00-11:00".
--
-- SAFE and IDEMPOTENT, like 20260922120000_turkish_catalogue_names: a row is
-- changed only when its id (the story row: its year) AND its whole current
-- value are exactly what was measured. A row the operator already edited is
-- left alone; a second run matches nothing. The old values are spelled with
-- chr(8212) (em dash) and chr(8211) (en dash) so this file itself carries
-- only hyphens.
--
-- 20260922120000 renames prd-0006 and prd-0011 to the em-dash spelling when
-- it finds the hyphen one. Only a replay of the whole bundle runs it again
-- (bootstrap, a hand apply of db/schema.sql), and this file runs after it in
-- the same replay, so the end state is the hyphen spelling either way.
--
-- Rollback: a migration that sets the old values back under the same keys.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

-- ── products.name (7) ───────────────────────────────────────────────────
update public.products
   set name = 'Sirena - Espresso Harmanı'
 where id = 'prd-0001'
   and name = 'Sirena ' || chr(8212) || ' Espresso Harmanı';

update public.products
   set name = 'Notturna - Filtre Lotu'
 where id = 'prd-0002'
   and name = 'Notturna ' || chr(8212) || ' Filtre Lotu';

update public.products
   set name = 'Yenilebilir Kup - 6''lı Kutu'
 where id = 'prd-0003'
   and name = 'Yenilebilir Kup ' || chr(8212) || ' 6''lı Kutu';

update public.products
   set name = 'Affogato Seti - İki Kişilik'
 where id = 'prd-0004'
   and name = 'Affogato Seti ' || chr(8212) || ' İki Kişilik';

update public.products
   set name = 'Uji Matcha - Seremoni Sınıfı'
 where id = 'prd-0005'
   and name = 'Uji Matcha ' || chr(8212) || ' Seremoni Sınıfı';

update public.products
   set name = 'Moka - Bialetti × L''Affogato'
 where id = 'prd-0006'
   and name = 'Moka ' || chr(8212) || ' Bialetti × L''Affogato';

update public.products
   set name = 'Cantucci - Bronte Pistachio'
 where id = 'prd-0011'
   and name = 'Cantucci ' || chr(8212) || ' Bronte Pistachio';

-- ── menu_items."desc" (1) ───────────────────────────────────────────────
update public.menu_items
   set "desc" = 'Espresso, buharlı süt ve bol köpük - eşit üç katman.'
 where id = 'mnu-0010'
   and "desc" = 'Espresso, buharlı süt ve bol köpük ' || chr(8212) || ' eşit üç katman.';

-- ── story_timeline.title (1) ────────────────────────────────────────────
-- The public endpoint does not expose the row id, so the key is the year
-- and the whole title. /story trims both before it answers, so they are
-- compared trimmed here, and only the dash is replaced: whatever spacing
-- the row has is kept.
update public.story_timeline
   set title = replace(title, chr(8212), '-')
 where btrim(year) = '2008'
   and btrim(title) = 'Sicily ' || chr(8212) || ' Bronte pistacchio anlaşması';

-- ── app_posts.body (1) ──────────────────────────────────────────────────
update public.app_posts
   set body = 'Hafta içi 09:00-11:00 arası espresso bazlı içeceklerde ikinci kahve yarı fiyatına.'
 where id = 'apost-001'
   and body = 'Hafta içi 09:00' || chr(8211) || '11:00 arası espresso bazlı içeceklerde ikinci kahve yarı fiyatına.';
