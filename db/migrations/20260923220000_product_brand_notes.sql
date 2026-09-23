-- Shop products: the maker's name and the tasting notes, as their own fields.
--
-- The app's product page (lafmobil screen 13) draws a brand eyebrow above the
-- name ("SIRENA") and a row of tasting-note chips ("Kakao · Kuru incir ·
-- Esmer şeker"). Neither could be derived from what `products` held: the
-- brand is not a column, and the notes cannot be split out of `desc` without
-- turning a sentence ("Nara'dan.") into a chip. Until now both screens printed
-- the whole description instead (lafmobil W2).
--
-- brand  text  - the maker, as the operator writes it; '' = no eyebrow.
-- notes  jsonb - an array of short strings; '[]' = no chips.
--
-- Additive and idempotent: existing rows get the empty values, which the app
-- reads as "draw the description as today", so nothing changes on any screen
-- until the operator fills a product in /admin/urunler.
--
-- Rollback (only GET /shop and the product form read them):
--   alter table public.products drop column if exists brand;
--   alter table public.products drop column if exists notes;

alter table public.products
  add column if not exists brand text not null default '';

alter table public.products
  add column if not exists notes jsonb not null default '[]'::jsonb;
