-- Seeds run once per database, not whenever a table is empty (admin audit
-- CAT-04, CON-01, decision D17, 17 Oct 2026).
--
-- The store seeded a table whenever it found it empty, once per server
-- instance, so every cold start re-checked. Deleting the last product, menu
-- item, category, shop hero slide, story period, press quote, app slide,
-- announcement or post brought the bundled rows back on the next deploy:
-- demo products for sale, a "500₺ üzeri ücretsiz kargo" slide, a weekend
-- closing at 24:00 and a half-price offer the till does not honour, in the
-- app's notification feed too. And setCounter put the id counters back to
-- the seed's size, so the next new row reused a deleted row's id, which old
-- orders and stock moves still point at.
--
-- From here on:
--   counters "seed:<table>"   the marker the store writes the first time it
--                             decides about a table (src/lib/admin/store.ts
--                             seedOnce). With the marker present an empty
--                             table stays empty.
--   raise_counter            what setCounter calls: it sets a counter to at
--                            least the given value and never lowers it.
--
-- A database already in use gets every marker now: its tables were seeded
-- long ago, and one emptied by the operator must stay empty. "In use" is a
-- settings row (written by the first seed) or a table with rows. A fresh
-- database has neither, so the store seeds it as before (the catalogue only
-- outside production). Once only, like every data step the bundle replays.
--
-- To seed a development database again: delete its `seed:%` counters.
--
-- NOTE: no `insert into public._migrations` here. scripts/db-migrate.mjs does
-- that itself, inside the same transaction.

create or replace function public.raise_counter(counter_key text, floor_seq bigint)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v bigint;
begin
  insert into public.counters (id, seq) values (counter_key, floor_seq)
  on conflict (id) do update set seq = greatest(public.counters.seq, excluded.seq)
  returning seq into v;
  return v;
end;
$$;

insert into public.counters (id, seq)
select m.id, 1
  from (values
    ('seed:products',          exists (select 1 from public.products)),
    ('seed:categories',        exists (select 1 from public.categories)),
    ('seed:menu_items',        exists (select 1 from public.menu_items)),
    ('seed:shop_hero_slides',  exists (select 1 from public.shop_hero_slides)),
    ('seed:story_timeline',    exists (select 1 from public.story_timeline)),
    ('seed:press',             exists (select 1 from public.press)),
    ('seed:app_hero_slides',   exists (select 1 from public.app_hero_slides)),
    ('seed:app_announcements', exists (select 1 from public.app_announcements)),
    ('seed:app_posts',         exists (select 1 from public.app_posts))
  ) as m (id, has_rows)
 where (m.has_rows or exists (select 1 from public.settings))
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261017200100_seed_markers.sql'
   )
on conflict (id) do nothing;
