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

-- Clear the old menu. Rows carry the retired category keys and prices, so
-- they cannot be migrated in place. ensureSeed() re-seeds the table from
-- SEED_MENU on the next boot because the table is empty.
delete from public.menu_items;
