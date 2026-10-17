-- Menu photos for 75 of the 79 items that had none (17 Oct 2026).
--
-- Operator, 17 Oct 2026: "menüdeki ürünlere telifsiz görseller bularak hem
-- site hem uygulama tarafında yükle". Each photo is a stock photo released as
-- CC0 or marked Public Domain (commercial use, no attribution required),
-- cropped to a 900 px square WebP in public/menu/. Source, creator and licence
-- for every file: docs/MENU-PHOTOS.md. They show the kind of product, not the
-- one served, and the menu says so next to them ("Görseller temsilidir").
--
-- `image` gets a site-relative path, the same form as the three photos the
-- August menu shipped with (20260827124000_menu_two_sizes_and_photos.sql).
-- The web menu and GET /api/mobile/v1/menu both read this column, so the app
-- shows the photos too. "photoCutout" is false: these are opaque squares,
-- which the app shows in a square tile (round in its small thumbnails), never
-- cut free. The scene family (`backdrop`, "backdropHex") is not set here. A
-- site-relative photo gets it from scripts/backfill-backdrops.mjs (dry run
-- first, then --apply), like the three August photos, which have no pick yet
-- either; until it runs, the app keeps drawing the scene from `hue`, as it
-- does today.
--
-- A row is written only when all three hold:
-- - it has no photo (`image = ''`). A photo the operator uploaded or linked is
--   never replaced.
-- - it still has the name the photo was chosen for. A row renamed or reused
--   for another product since keeps the drawn fallback; the operator can add
--   the file by hand in the panel (the field takes /menu/<file>.webp).
-- - this file has not run before. The bundle (db/schema.sql) re-runs every
--   migration whenever a deploy adds a new one, so without this guard a photo
--   the operator removed in the panel would come back on the next deploy.
--   db:migrate and the bundle both record this file in _migrations after the
--   body runs: the same guard as 20260827124000.
--
-- `updatedAt` is left alone: this is not an edit of the item, and the menu's
-- ETag already changes with the body (as in scripts/backfill-backdrops.mjs).
--
-- Rollback (no schema change): set `image` back to '' on the rows that still
-- carry the path given here, e.g.
--   update public.menu_items set image = ''
--    where id = 'mnu-0004' and image = '/menu/affogato.webp';

update public.menu_items as m
   set image = v.image,
       "photoCutout" = false
  from (
    values
    ('mnu-0004', 'L''Affogato',                  '/menu/affogato.webp'),
    ('mnu-0005', 'Espresso',                     '/menu/espresso.webp'),
    ('mnu-0006', 'Americano',                    '/menu/americano.webp'),
    ('mnu-0007', 'Latte',                        '/menu/caffe-latte.webp'),
    ('mnu-0008', 'Flat White',                   '/menu/flat-white.webp'),
    ('mnu-0009', 'Mocha',                        '/menu/mocha.webp'),
    ('mnu-0010', 'Cappuccino',                   '/menu/cappuccino.webp'),
    ('mnu-0011', 'Espresso Macchiato',           '/menu/espresso-macchiato.webp'),
    ('mnu-0012', 'İspanyol Latte',               '/menu/spanish-latte.webp'),
    ('mnu-0013', 'Cortado',                      '/menu/cortado.webp'),
    ('mnu-0014', 'Beyaz Çikolatalı Mocha',       '/menu/white-chocolate-mocha.webp'),
    ('mnu-0015', 'Karamel Latte',                '/menu/caramel-latte.webp'),
    ('mnu-0016', 'Tuzlu Karamel Latte',          '/menu/salted-caramel-latte.webp'),
    ('mnu-0017', 'Toffeenut Latte',              '/menu/toffee-nut-latte.webp'),
    ('mnu-0018', 'Balkabağı Latte',              '/menu/pumpkin-latte.webp'),
    ('mnu-0019', 'Türk Kahvesi',                 '/menu/turkish-coffee.webp'),
    ('mnu-0020', 'Filtre Kahve',                 '/menu/filter-coffee.webp'),
    ('mnu-0021', 'Buzlu Chai',                   '/menu/iced-chai.webp'),
    ('mnu-0022', 'Buzlu Americano',              '/menu/iced-americano.webp'),
    ('mnu-0023', 'Buzlu Caffè Latte',            '/menu/iced-caffe-latte.webp'),
    ('mnu-0024', 'Buzlu Caffè Mocha',            '/menu/iced-mocha.webp'),
    ('mnu-0025', 'Buzlu Beyaz Çikolatalı Mocha', '/menu/iced-white-mocha.webp'),
    ('mnu-0026', 'Buzlu Tuzlu Karamel Latte',    '/menu/iced-salted-caramel-latte.webp'),
    ('mnu-0027', 'Buzlu Toffeenut Latte',        '/menu/iced-toffee-nut-latte.webp'),
    ('mnu-0028', 'Buzlu Balkabağı Latte',        '/menu/iced-pumpkin-latte.webp'),
    ('mnu-0029', 'Buzlu İspanyol Latte',         '/menu/iced-spanish-latte.webp'),
    ('mnu-0030', 'Cold Brew',                    '/menu/cold-brew.webp'),
    ('mnu-0031', 'Çıtır Latte',                  '/menu/crunchy-latte.webp'),
    ('mnu-0032', 'Sürpriz İçecek',               '/menu/surprise-drink.webp'),
    ('mnu-0033', 'Cool Lime',                    '/menu/cool-lime.webp'),
    ('mnu-0034', 'L''Af Limon',                  '/menu/lemonade.webp'),
    ('mnu-0035', 'Soda',                         '/menu/soda.webp'),
    ('mnu-0036', 'Su',                           '/menu/water.webp'),
    ('mnu-0037', 'Chai Latte',                   '/menu/chai-latte.webp'),
    ('mnu-0038', 'Sıcak Çikolata',               '/menu/hot-chocolate.webp'),
    ('mnu-0039', 'Beyaz Sıcak Çikolata',         '/menu/white-hot-chocolate.webp'),
    ('mnu-0040', 'Karamelli Sıcak Çikolata',     '/menu/caramel-hot-chocolate.webp'),
    ('mnu-0042', 'Çay',                          '/menu/turkish-tea.webp'),
    ('mnu-0043', 'Frappe',                       '/menu/frappe.webp'),
    ('mnu-0044', 'Espresso Frappe',              '/menu/espresso-frappe.webp'),
    ('mnu-0045', 'Mocha Frappe',                 '/menu/mocha-frappe.webp'),
    ('mnu-0046', 'Karamel Frappe',               '/menu/caramel-frappe.webp'),
    ('mnu-0047', 'Yaban Mersini',                '/menu/blueberry-smoothie.webp'),
    ('mnu-0048', 'Mango',                        '/menu/mango-smoothie.webp'),
    ('mnu-0049', 'Elma',                         '/menu/apple-smoothie.webp'),
    ('mnu-0050', 'Protein Shake',                '/menu/protein-shake.webp'),
    ('mnu-0051', 'Çilek',                        '/menu/strawberry-frozen.webp'),
    ('mnu-0052', 'Frambuaz',                     '/menu/raspberry-frozen.webp'),
    ('mnu-0055', 'Limonlu Soğuk Çay',            '/menu/lemon-iced-tea.webp'),
    ('mnu-0056', 'Şeftalili Soğuk Çay',          '/menu/peach-iced-tea.webp'),
    ('mnu-0057', 'Donostia (L''Af Özel)',        '/menu/donostia-cheesecake.webp'),
    ('mnu-0058', 'San Sebastian',                '/menu/san-sebastian-cheesecake.webp'),
    ('mnu-0059', 'Yaban Mersinli San Sebastian', '/menu/blueberry-san-sebastian.webp'),
    ('mnu-0060', 'L''Af Mango',                  '/menu/mango-cake.webp'),
    ('mnu-0061', 'L''Af Kahve',                  '/menu/coffee-cake.webp'),
    ('mnu-0062', 'L''Af Antep Fıstığı',          '/menu/pistachio-cake.webp'),
    ('mnu-0063', 'Çilek Magnolia',               '/menu/strawberry-magnolia.webp'),
    ('mnu-0064', 'Muz Magnolia',                 '/menu/banana-magnolia.webp'),
    ('mnu-0065', 'Lotus Magnolia',               '/menu/lotus-magnolia.webp'),
    ('mnu-0066', 'Marlenka',                     '/menu/marlenka-honey-cake.webp'),
    ('mnu-0067', 'Klasik Spoonful',              '/menu/classic-spoonful.webp'),
    ('mnu-0068', 'Frambuazlı Cheesecake',        '/menu/raspberry-cheesecake.webp'),
    ('mnu-0069', 'Limonlu Cheesecake',           '/menu/lemon-cheesecake.webp'),
    ('mnu-0070', 'Brownie',                      '/menu/brownie.webp'),
    ('mnu-0071', 'Cookie Aşkı (Dondurmalı)',     '/menu/cookie-ice-cream.webp'),
    ('mnu-0072', 'Tiramisu',                     '/menu/tiramisu.webp'),
    ('mnu-0073', 'Karabuğday Simit',             '/menu/simit.webp'),
    ('mnu-0074', 'Rosbeef Sandviç',              '/menu/roast-beef-sandwich.webp'),
    ('mnu-0075', 'Hindi Fümeli Sandviç',         '/menu/smoked-turkey-sandwich.webp'),
    ('mnu-0076', 'Çıtır Granola Bar (Kenya)',    '/menu/granola-bar.webp'),
    ('mnu-0077', 'Hindistan Cevizli Bar',        '/menu/coconut-bar.webp'),
    ('mnu-0078', 'Kakao Protein Bar',            '/menu/cocoa-protein-bar.webp'),
    ('mnu-0079', 'Koska Fındık',                 '/menu/hazelnuts.webp'),
    ('mnu-0081', 'Ekstra Shot',                  '/menu/extra-shot.webp'),
    ('mnu-0082', 'Alternatif Süt',               '/menu/alternative-milk.webp')
  ) as v (id, name, image)
 where m.id = v.id
   and m.name = v.name
   and m.image = ''
   and not exists (
     select 1
       from public._migrations as applied
      where applied.name = '20261017120000_menu_photos.sql'
   );
