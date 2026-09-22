-- Katalog adları Türkçe — mağaza ürünleri ve kafe kalemleri.
--
-- Operatörün kararı (22 Eyl 2026): *"uygulamamız da türkçe tamamen buna
-- uygun yap ve türkçe olmayan ifadeleri de türkçeleştir."* Canlı `/shop` on
-- bir ürünün adını ve etiketini İngilizce yayımlıyordu ("Whole Bean · 250g",
-- "Porcelain Cup Set", "Heavyweight canvas") ve `/menu` on üç kalemi
-- ("Iced Americano", "Hot Chocolate", "Extra Shot"). Hepsi tohumdan gelen
-- satırlar; `/admin/urunler` ve `/admin/menu` onları düzenleyebilir ama on
-- birini elle düzeltmek yerine bir kez, tutarlı ve geri alınabilir biçimde
-- burada düzeltiliyor.
--
-- İLKE: uluslararası içecek ve yöntem adları KALIR — Espresso, Latte, Mocha,
-- Americano, Cold Brew, Affogato, Biscotti, Cantucci. İngilizce SIFATLAR
-- Türkçeleşir — Iced → Buzlu, Hot Chocolate → Sıcak Çikolata, Whole Bean →
-- Çekirdek, Gift Box → Hediye kutusu. Marka adları (Sirena, Notturna, Uji,
-- Bialetti) ve İtalyanca ürün adları dokunulmadan duruyor.
--
-- GÜVENLİ ve İDEMPOTENT: her satır yalnız `id` VE hâlâ eski İngilizce adı
-- taşıyorsa güncellenir (iki tire biçimi de tanınır — tohum düz tire yazıyor,
-- canlı satırlar uzun tire). Operatörün zaten yeniden adlandırdığı bir ürün
-- olduğu gibi kalır; ikinci koşuda hiçbir şey eşleşmez. `slug` ve `sku`
-- DEĞİŞMEZ — adresler ve kasa kayıtları aynı kalsın.
--
-- Uygulamanın ve sitenin tohumları (`catalog.seed.json`, `laffogato/data.ts`)
-- aynı haritayla aynı gün güncellendi; taze bir kurulum bu satırlarla aynı
-- adları üretir.
--
-- Rollback: aynı satırları ters yönde güncelleyen bir migration yazılır;
-- burada geri alınacak bir şema yok.

update public.products
   set name = 'Sirena — Espresso Harmanı',
       tag  = case when tag = 'Whole Bean · 250g' then 'Çekirdek · 250 g' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0001'
   and name in ('Sirena — Espresso Blend', 'Sirena - Espresso Blend');

update public.products
   set name = 'Notturna — Filtre Lotu',
       tag  = case when tag = 'Whole Bean · 200g' then 'Çekirdek · 200 g' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0002'
   and name in ('Notturna — Filter Lot', 'Notturna - Filter Lot');

update public.products
   set name = 'Yenilebilir Kup — 6''lı Kutu',
       tag  = case when tag = 'Waffle Vessels' then 'Waffle kupları' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0003'
   and name in ('Edible Cups — 6 Box', 'Edible Cups - 6 Box');

update public.products
   set name = 'Affogato Seti — İki Kişilik',
       tag  = case when tag = 'Gift Box' then 'Hediye kutusu' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0004'
   and name in ('Affogato Kit — For Two', 'Affogato Kit - For Two');

update public.products
   set name = 'Uji Matcha — Seremoni Sınıfı',
       tag  = case when tag = 'Tin · 40g' then 'Teneke kutu · 40 g' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0005'
   and name in ('Uji Matcha — Ceremonial', 'Uji Matcha - Ceremonial');

update public.products
   set name = 'Moka — Bialetti × L''Affogato',
       tag  = case when tag = '3-cup, brushed aluminium' then '3 fincanlık, fırçalanmış alüminyum' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0006'
   and name in ('Moka — Bialetti × L''Affogato', 'Moka - Bialetti × L''Affogato');

update public.products
   set name = 'Porselen Fincan Seti',
       tag  = case when tag = 'Espresso · Set of 2' then 'Espresso · 2''li set' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0007'
   and name in ('Porcelain Cup Set', 'Porcelain Cup Set');

update public.products
   set name = 'Pamuk Önlük',
       tag  = case when tag = 'Heavyweight canvas' then 'Kalın kanvas' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0009'
   and name in ('Cotton Apron', 'Cotton Apron');

update public.products
   set name = 'Emaye Bardak',
       tag  = case when tag = '350ml, double wall' then '350 ml, çift cidarlı' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0010'
   and name in ('Enamel Tumbler', 'Enamel Tumbler');

update public.products
   set name = 'Cantucci — Bronte Pistachio',
       tag  = case when tag = 'Biscotti · 180g' then 'Biscotti · 180 g' else tag end,
       "desc" = replace(replace(replace(replace(replace("desc", 'edible kup', 'yenilebilir kup'), 'ceremonial grade', 'seremoni sınıfı'), 'Bone china', 'Kemik porseleni'), '200g Sirena', '200 g Sirena'), '60ml', '60 ml')
 where id = 'prd-0011'
   and name in ('Cantucci — Bronte Pistachio', 'Cantucci - Bronte Pistachio');

update public.menu_items
   set name = 'Buzlu Americano'
 where id = 'mnu-0022'
   and name = 'Iced Americano';

update public.menu_items
   set name = 'Buzlu Caffè Latte'
 where id = 'mnu-0023'
   and name = 'Iced Caffè Latte';

update public.menu_items
   set name = 'Buzlu Caffè Mocha'
 where id = 'mnu-0024'
   and name = 'Iced Caffè Mocha';

update public.menu_items
   set name = 'Buzlu Beyaz Çikolatalı Mocha'
 where id = 'mnu-0025'
   and name = 'Iced White Ch. Mocha';

update public.menu_items
   set name = 'Buzlu Tuzlu Karamel Latte'
 where id = 'mnu-0026'
   and name = 'Iced Salted Caramel Latte';

update public.menu_items
   set name = 'Buzlu Toffeenut Latte'
 where id = 'mnu-0027'
   and name = 'Iced Toffeenut Latte';

update public.menu_items
   set name = 'Buzlu Balkabağı Latte'
 where id = 'mnu-0028'
   and name = 'Iced Pumpkin Spice Latte';

update public.menu_items
   set name = 'Buzlu İspanyol Latte'
 where id = 'mnu-0029'
   and name = 'Iced Spanish Latte';

update public.menu_items
   set name = 'Sıcak Çikolata'
 where id = 'mnu-0038'
   and name = 'Hot Chocolate';

update public.menu_items
   set name = 'Beyaz Sıcak Çikolata'
 where id = 'mnu-0039'
   and name = 'White Hot Chocolate';

update public.menu_items
   set name = 'Karamelli Sıcak Çikolata'
 where id = 'mnu-0040'
   and name = 'Caramel Hot Chocolate';

update public.menu_items
   set name = 'Ekstra Shot'
 where id = 'mnu-0081'
   and name = 'Extra Shot';
