-- Studio photographs for 78 cafe menu items (24 Nov 2026).
--
-- Operator, 24 Nov 2026: "ekteki görselleri ilgili ürünlere yükle ve diğer
-- bağlantılı platformlara da gittiğinden emin olup maine gönder lafmobil
-- ladmin lafpos vs. gibi". The pictures are the operator's own set (the
-- L'Af-branded cups, sleeves and boxes), cropped to a 720 px square WebP in
-- public/menu/studio/. Source, mapping, what was not placed and the open
-- legal question about generated pictures: docs/MENU-PHOTOS.md.
--
-- The files are new names, never the old ones. A site-relative photo has no
-- content stamp in the menu API (servedImage passes it through), and the
-- mobile app's disk cache is keyed by URL with no expiry: reusing a name
-- would leave the old picture on every phone that already has it.
--
-- `image` gets a site-relative path, so GET /api/mobile/v1/menu (the app),
-- the public menu the till pulls (LafPOS) and the site read the same value.
-- "photoCutout" is false: opaque squares, shown in the app's square tile.
-- The scene family (`backdrop`) is not touched.
--
-- Unlike 20261017120000 this REPLACES a photo that is already there: the
-- operator asked for the new set to take the place of the old one. A row is
-- written only when both hold:
-- - it still has the name the picture was made for. A row renamed or reused
--   for another product since keeps what it has.
-- - this file has not run before. The bundle (db/schema.sql) re-runs every
--   migration whenever a deploy adds a new one, so without this guard a
--   photo the operator changed in the panel afterwards would be put back on
--   the next deploy. db:migrate and the bundle both record this file in
--   _migrations after the body runs.
--
-- `updatedAt` is left alone: this is not an edit of the item, and the menu's
-- ETag already changes with the body (as in 20261017120000).
--
-- Rollback (no schema change): put the previous photo back in the panel
-- (Menü › the item › Görsel); the old rows held uploaded JPEGs, which this
-- file does not keep.

update public.menu_items as m
   set image = v.image,
       "photoCutout" = false
  from (
    values
    ('mnu-0001', 'Matcha Latte', '/menu/studio/matcha-latte.webp'),
    ('mnu-0002', 'Çilekli Matcha', '/menu/studio/strawberry-matcha.webp'),
    ('mnu-0003', 'Matcha Affogato', '/menu/studio/matcha-affogato.webp'),
    ('mnu-0004', 'L''Affogato', '/menu/studio/affogato.webp'),
    ('mnu-0005', 'Espresso', '/menu/studio/espresso.webp'),
    ('mnu-0006', 'Americano', '/menu/studio/americano.webp'),
    ('mnu-0007', 'Latte', '/menu/studio/latte.webp'),
    ('mnu-0008', 'Flat White', '/menu/studio/flat-white.webp'),
    ('mnu-0009', 'Mocha', '/menu/studio/mocha.webp'),
    ('mnu-0010', 'Cappuccino', '/menu/studio/cappuccino.webp'),
    ('mnu-0011', 'Espresso Macchiato', '/menu/studio/espresso-macchiato.webp'),
    ('mnu-0012', 'İspanyol Latte', '/menu/studio/spanish-latte.webp'),
    ('mnu-0013', 'Cortado', '/menu/studio/cortado.webp'),
    ('mnu-0014', 'Beyaz Çikolatalı Mocha', '/menu/studio/white-chocolate-mocha.webp'),
    ('mnu-0015', 'Karamel Latte', '/menu/studio/caramel-latte.webp'),
    ('mnu-0016', 'Tuzlu Karamel Latte', '/menu/studio/salted-caramel-latte.webp'),
    ('mnu-0017', 'Toffeenut Latte', '/menu/studio/toffee-nut-latte.webp'),
    ('mnu-0018', 'Balkabağı Latte', '/menu/studio/pumpkin-spice-latte.webp'),
    ('mnu-0019', 'Türk Kahvesi', '/menu/studio/turkish-coffee.webp'),
    ('mnu-0020', 'Filtre Kahve', '/menu/studio/filter-coffee.webp'),
    ('mnu-0021', 'Buzlu Chai', '/menu/studio/iced-chai-latte.webp'),
    ('mnu-0022', 'Buzlu Americano', '/menu/studio/iced-americano.webp'),
    ('mnu-0023', 'Buzlu Caffè Latte', '/menu/studio/iced-latte.webp'),
    ('mnu-0024', 'Buzlu Caffè Mocha', '/menu/studio/iced-mocha.webp'),
    ('mnu-0025', 'Buzlu Beyaz Çikolatalı Mocha', '/menu/studio/iced-white-chocolate-mocha.webp'),
    ('mnu-0026', 'Buzlu Tuzlu Karamel Latte', '/menu/studio/iced-salted-caramel-latte.webp'),
    ('mnu-0027', 'Buzlu Toffeenut Latte', '/menu/studio/iced-toffee-nut-latte.webp'),
    ('mnu-0028', 'Buzlu Balkabağı Latte', '/menu/studio/iced-pumpkin-spice-latte.webp'),
    ('mnu-0029', 'Buzlu İspanyol Latte', '/menu/studio/iced-spanish-latte.webp'),
    ('mnu-0030', 'Cold Brew', '/menu/studio/cold-brew.webp'),
    ('mnu-0031', 'Çıtır Latte', '/menu/studio/crunchy-latte.webp'),
    ('mnu-0032', 'Sürpriz İçecek', '/menu/studio/surprise-drink.webp'),
    ('mnu-0033', 'Cool Lime', '/menu/studio/cool-lime.webp'),
    ('mnu-0034', 'L''Af Limon', '/menu/studio/laf-lemonade.webp'),
    ('mnu-0035', 'Soda', '/menu/studio/soda.webp'),
    ('mnu-0036', 'Su', '/menu/studio/water.webp'),
    ('mnu-0037', 'Chai Latte', '/menu/studio/chai-latte.webp'),
    ('mnu-0038', 'Sıcak Çikolata', '/menu/studio/hot-chocolate.webp'),
    ('mnu-0039', 'Beyaz Sıcak Çikolata', '/menu/studio/white-hot-chocolate.webp'),
    ('mnu-0040', 'Karamelli Sıcak Çikolata', '/menu/studio/caramel-hot-chocolate.webp'),
    ('mnu-0041', 'Salep', '/menu/studio/salep.webp'),
    ('mnu-0042', 'Çay', '/menu/studio/tea.webp'),
    ('mnu-0043', 'Frappe', '/menu/studio/frappe.webp'),
    ('mnu-0044', 'Espresso Frappe', '/menu/studio/espresso-frappe.webp'),
    ('mnu-0045', 'Mocha Frappe', '/menu/studio/mocha-frappe.webp'),
    ('mnu-0046', 'Karamel Frappe', '/menu/studio/caramel-frappe.webp'),
    ('mnu-0047', 'Yaban Mersini', '/menu/studio/blueberry-smoothie.webp'),
    ('mnu-0048', 'Mango', '/menu/studio/mango-smoothie.webp'),
    ('mnu-0049', 'Elma', '/menu/studio/apple-smoothie.webp'),
    ('mnu-0050', 'Protein Shake', '/menu/studio/protein-shake.webp'),
    ('mnu-0051', 'Çilek', '/menu/studio/strawberry-frozen.webp'),
    ('mnu-0052', 'Frambuaz', '/menu/studio/raspberry-frozen.webp'),
    ('mnu-0053', 'Çarkıfelek', '/menu/studio/passion-fruit-frozen.webp'),
    ('mnu-0054', 'Ananas', '/menu/studio/pineapple-frozen.webp'),
    ('mnu-0055', 'Limonlu Soğuk Çay', '/menu/studio/lemon-iced-tea.webp'),
    ('mnu-0056', 'Şeftalili Soğuk Çay', '/menu/studio/peach-iced-tea.webp'),
    ('mnu-0057', 'Donostia (L''Af Özel)', '/menu/studio/donostia.webp'),
    ('mnu-0058', 'San Sebastian', '/menu/studio/san-sebastian.webp'),
    ('mnu-0059', 'Yaban Mersinli San Sebastian', '/menu/studio/blueberry-san-sebastian.webp'),
    ('mnu-0060', 'L''Af Mango', '/menu/studio/laf-mango-cake.webp'),
    ('mnu-0061', 'L''Af Kahve', '/menu/studio/laf-coffee-cake.webp'),
    ('mnu-0062', 'L''Af Antep Fıstığı', '/menu/studio/laf-pistachio-cake.webp'),
    ('mnu-0063', 'Çilek Magnolia', '/menu/studio/strawberry-magnolia.webp'),
    ('mnu-0064', 'Muz Magnolia', '/menu/studio/banana-magnolia.webp'),
    ('mnu-0065', 'Lotus Magnolia', '/menu/studio/lotus-magnolia.webp'),
    ('mnu-0068', 'Frambuazlı Cheesecake', '/menu/studio/raspberry-cheesecake.webp'),
    ('mnu-0069', 'Limonlu Cheesecake', '/menu/studio/lemon-cheesecake.webp'),
    ('mnu-0070', 'Brownie', '/menu/studio/brownie.webp'),
    ('mnu-0071', 'Cookie Aşkı (Dondurmalı)', '/menu/studio/cookie-ice-cream.webp'),
    ('mnu-0072', 'Tiramisu', '/menu/studio/tiramisu.webp'),
    ('mnu-0098', 'Velvet Magnolia', '/menu/studio/velvet-magnolia.webp'),
    ('mnu-0100', 'Dubai Magnolia', '/menu/studio/dubai-magnolia.webp'),
    ('mnu-0074', 'Rosbeef Sandviç', '/menu/studio/roast-beef-sandwich.webp'),
    ('mnu-0075', 'Hindi Fümeli Sandviç', '/menu/studio/smoked-turkey-croissant.webp'),
    ('mnu-0076', 'Çıtır Granola Bar (Kenya)', '/menu/studio/granola-bar.webp'),
    ('mnu-0077', 'Hindistan Cevizli Bar', '/menu/studio/coconut-bar.webp'),
    ('mnu-0078', 'Kakao Protein Bar', '/menu/studio/cocoa-protein-bar.webp'),
    ('mnu-0079', 'Koska Fındık', '/menu/studio/hazelnuts.webp')
  ) as v (id, name, image)
 where m.id = v.id
   and m.name = v.name
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261124150000_menu_studio_photos.sql'
   );

insert into public._migrations (name) values ('20261124150000_menu_studio_photos.sql')
  on conflict (name) do nothing;
