-- Eight menu photos that show something the item is not (18 Oct 2026).
--
-- Decision OP-MENU-PHOTOS / ASK-OTH-1 (operator, 18 Oct 2026: "avukata sorma,
-- sen karar ver"): "Görseller temsilidir" covers a different glass, garnish
-- or light, never a different product. Seven of the stock photos that
-- 20261017120000_menu_photos.sql wrote show another make-up (a roast beef
-- sandwich with raw onion and no greens or sauce, a biscuit-base tart for a
-- burnt Basque cheesecake, nuts and granola on an item with no nut tag, a
-- photo titled "Iced Mocha" for a pumpkin latte, a mint iced tea for a peach
-- one, a magnolia with no biscuit layer, a white sesame simit for a buckwheat
-- one), and mnu-0082 Alternatif Süt shows hemp milk and hemp seeds, which the
-- bar does not serve. A picture that contradicts the item is a misleading
-- advertisement whatever the footnote says (TKHK m.61, m.62, m.8/2; Ticari
-- Reklam Yön. m.7/5-a, m.18/6-7, m.29/2-a). docs/MENU-PHOTOS.md lists each.
--
-- A row is emptied only when both hold:
-- - it still carries the very path the old migration wrote. A photo the
--   operator uploaded or linked since is never touched.
-- - this file has not run before. The bundle (db/schema.sql) re-runs every
--   migration whenever a deploy adds a new one; without this guard a stock
--   path linked again by hand would be emptied on the next deploy.
--   db:migrate and the bundle both record this file in _migrations after the
--   body runs (the guard of 20261017120000).
--
-- The files stay in public/menu: the old migration still names them, and
-- 20261017120000 itself is not edited. The site and the app draw the plate
-- for these items, as they do for the other four without a photo.
--
-- `updatedAt` is left alone, as in 20261017120000: this is not an edit of the
-- item, and the menu's ETag already changes with the body.
--
-- Rollback (no schema change): write the old path back on the rows that are
-- still empty, e.g.
--   update public.menu_items set image = '/menu/simit.webp'
--    where id = 'mnu-0073' and image = '';

update public.menu_items as m
   set image = ''
  from (
    values
    ('mnu-0028', '/menu/iced-pumpkin-latte.webp'),
    ('mnu-0056', '/menu/peach-iced-tea.webp'),
    ('mnu-0059', '/menu/blueberry-san-sebastian.webp'),
    ('mnu-0063', '/menu/strawberry-magnolia.webp'),
    ('mnu-0067', '/menu/classic-spoonful.webp'),
    ('mnu-0073', '/menu/simit.webp'),
    ('mnu-0074', '/menu/roast-beef-sandwich.webp'),
    ('mnu-0082', '/menu/alternative-milk.webp')
  ) as v (id, image)
 where m.id = v.id
   and m.image = v.image
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261018210000_menu_photos_mismatch.sql'
   );
