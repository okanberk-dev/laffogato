-- Shop products: the allergen column the cafe menu already had.
--
-- `menu_items.tags` carries the cafe's item tags, and one of them — `nuts` —
-- is an ALLERGEN the app is required to surface (lafmobil rule 4: "Alerjen
-- bilgisi gizlenmez"). `products` had no counterpart, so `GET /shop` could not
-- publish one and the app drew no warning on a shop product. A pistachio
-- biscotti (prd-0011, "Cantucci — Bronte Pistachio") sits on that shelf.
--
-- Same name, same type, same default and same vocabulary as `menu_items.tags`
-- so the wire field is literally the same field on both surfaces and the app
-- reads it with the code it already has.
--
-- Additive and idempotent: existing rows get `[]`, which is what they
-- effectively published before. Marking the products that do carry an allergen
-- is data work, done in /admin/urunler.
--
-- Rollback (nothing else reads the column):
--   alter table public.products drop column if exists tags;

alter table public.products
  add column if not exists tags jsonb not null default '[]'::jsonb;
