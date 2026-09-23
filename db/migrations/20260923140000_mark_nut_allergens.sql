-- Mark the two nut allergens that were never marked (lafmobil rule 4:
-- "Alerjen bilgisi gizlenmez").
--
-- 20260916120000_product_allergen_tags.sql gave `products` the `tags` column
-- the cafe menu already had and left the marking to /admin/urunler. Nobody
-- marked anything: on 23 Sep 2026 `GET /shop` published `tags: []` for all
-- eleven products, so the app drew no warning on the pistachio biscotti - its
-- AllergenPill is drawn from `tags.includes("nuts")` and nothing else.
--
-- The menu had the same hole in one row: "Alternatif Süt" is "Yulaf, badem
-- veya laktozsuz süt seçeneği" - almond is a tree nut - and it carried no tag.
-- Tagging the item that CAN contain nuts is the safe reading: the warning has
-- to reach the member who picks almond, and the menu line cannot know which
-- milk will be chosen.
--
-- IDEMPOTENT and SAFE: each row is matched by id AND by what it is, and only
-- gains the tag if it does not already carry it. An operator who has already
-- marked (or renamed) the row is left alone. The seeds were changed the same
-- day, so a fresh database starts marked.
--
-- Rollback: the same rows with `tags - 'nuts'`; no schema change.

update public.products
   set tags = tags || '["nuts"]'::jsonb
 where id = 'prd-0011'
   and name ilike '%pistachio%'
   and not (tags @> '["nuts"]'::jsonb);

update public.menu_items
   set tags = tags || '["nuts"]'::jsonb
 where id = 'mnu-0082'
   and name = 'Alternatif Süt'
   and not (tags @> '["nuts"]'::jsonb);
