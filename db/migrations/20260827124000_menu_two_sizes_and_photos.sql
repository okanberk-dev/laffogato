-- Cafe menu: two-size (M/L) pricing, real product photos, and a full reset.
--
-- The 2026 printed menu replaces the previous seed wholesale: the category
-- keys changed (affogato/matcha/espresso/cold/gelato → matcha/espresso/
-- ice-coffee/cold/hot/frappe/smoothie/frozen/ice-tea/dessert/snack/extras)
-- and most drinks are now sold in two sizes.
--
-- `priceMinorL` is the large-size price in kuruş; 0 means the item has a
-- single size, which keeps the column back-compatible with existing rows.
-- `image` is a site-relative path under public/ (e.g. /menu/matcha-latte.webp);
-- empty means the drawn SVG fallback is used.

alter table public.menu_items
  add column if not exists "priceMinorL" integer not null default 0;

alter table public.menu_items
  add column if not exists image text not null default '';

-- Clear the old menu. Those rows carry the retired category keys and prices, so
-- they cannot be migrated in place; ensureSeed() re-seeds the table from
-- SEED_MENU on the next boot because the table is left empty.
--
-- Guarded on this migration's own _migrations row, which db:migrate and the
-- db/schema.sql bundle both insert *after* the body runs. So the delete fires
-- exactly once — on the run that first applies this file — and matches nothing
-- on every re-apply. That matters because db/schema.sql promises running it
-- twice is safe and the app re-applies it to heal a schema gap; an
-- unconditional delete would wipe the live menu each time.
--
-- Filtering by category key cannot do this: matcha, espresso and cold appear in
-- both the old and the new key sets, so the old items under them would survive
-- and leave the table non-empty — which suppresses the re-seed entirely and
-- strands the menu half-migrated.
delete from public.menu_items
where not exists (
  select 1
  from public._migrations
  where name = '20260827124000_menu_two_sizes_and_photos.sql'
);
