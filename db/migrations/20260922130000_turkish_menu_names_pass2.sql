-- Menü adları Türkçe — ikinci geçiş: sıcak kardeşler, meyveler, kategoriler.
--
-- 22 Eyl'deki ilk geçiş yalnız "Iced …" kalemlerini ve sıcak çikolataları
-- çevirmişti; kardeşleri İngilizce kaldı ("Salted Caramel Latte" ile "Buzlu
-- Tuzlu Karamel Latte" aynı vitrinde). Bu geçiş aynı ilkeyi bütün karta
-- uygular: uluslararası içecek/yöntem adı KALIR (Cold Brew, Flat White,
-- Cortado, Frappe, Smoothie, Cheesecake, Tiramisu), İngilizce SIFAT ve
-- KISALTMA Türkçeleşir (Salted Caramel → Tuzlu Karamel, Esp. → Espresso,
-- White Choc. → Beyaz Çikolatalı), meyve adları Türkçe (Blueberry → Yaban
-- Mersini). Kategori başlıkları da: "Espresso Based" → "Espresso",
-- "Ice Coffee" → "Soğuk Kahve", "Ice Tea" → "Soğuk Çay".
--
-- İDEMPOTENT ve GÜVENLİ: her satır `id` VE hâlâ eski adı taşıyorsa güncellenir;
-- operatörün zaten değiştirdiği bir satır olduğu gibi kalır. Uygulamanın ve
-- sitenin tohumları aynı haritayla aynı gün güncellendi.
--
-- Rollback: aynı satırları ters yönde güncelleyen bir migration; şema yok.

update public.menu_items set name = 'Çilekli Matcha' where id = 'mnu-0002' and name = 'Strawberry Matcha';
update public.menu_items set name = 'Espresso Macchiato' where id = 'mnu-0011' and name = 'Esp. Macchiato';
update public.menu_items set name = 'İspanyol Latte' where id = 'mnu-0012' and name = 'Spanish Latte';
update public.menu_items set name = 'Beyaz Çikolatalı Mocha' where id = 'mnu-0014' and name = 'White Choc. Mocha';
update public.menu_items set name = 'Karamel Latte' where id = 'mnu-0015' and name = 'Caramel Latte';
update public.menu_items set name = 'Tuzlu Karamel Latte' where id = 'mnu-0016' and name = 'Salted Caramel Latte';
update public.menu_items set name = 'Balkabağı Latte' where id = 'mnu-0018' and name = 'Pumpkin Spice Latte';
update public.menu_items set name = 'Buzlu Chai' where id = 'mnu-0021' and name = 'Chai Tea';
update public.menu_items set name = 'Sürpriz İçecek' where id = 'mnu-0032' and name = 'Surprise Drink';
update public.menu_items set name = 'Chai Latte' where id = 'mnu-0037' and name = 'Chai Tea Latte';
update public.menu_items set name = 'Çay' where id = 'mnu-0042' and name = 'Tea';
update public.menu_items set name = 'Karamel Frappe' where id = 'mnu-0046' and name = 'Caramel Frappe';
update public.menu_items set name = 'Yaban Mersini' where id = 'mnu-0047' and name = 'Blueberry';
update public.menu_items set name = 'Elma' where id = 'mnu-0049' and name = 'Apple';
update public.menu_items set name = 'Çilek' where id = 'mnu-0051' and name = 'Strawberry';
update public.menu_items set name = 'Frambuaz' where id = 'mnu-0052' and name = 'Raspberry';
update public.menu_items set name = 'Çarkıfelek' where id = 'mnu-0053' and name = 'Passionfruit';
update public.menu_items set name = 'Ananas' where id = 'mnu-0054' and name = 'Pineapple';
update public.menu_items set name = 'Limonlu Soğuk Çay' where id = 'mnu-0055' and name = 'Lemon Tea';
update public.menu_items set name = 'Şeftalili Soğuk Çay' where id = 'mnu-0056' and name = 'Peach Tea';
update public.menu_items set name = 'Donostia (L''Af Özel)' where id = 'mnu-0057' and name = 'Donostia (L''Af Special)';
update public.menu_items set name = 'Yaban Mersinli San Sebastian' where id = 'mnu-0059' and name = 'Blueberry San Sebastian';
update public.menu_items set name = 'L''Af Kahve' where id = 'mnu-0061' and name = 'L''Af Coffee';
update public.menu_items set name = 'Çıtır Granola Bar (Kenya)' where id = 'mnu-0076' and name = 'Crunchy Granola Bar (Kenya)';
update public.menu_items set name = 'Şurup' where id = 'mnu-0080' and name = 'Syrup';

update public.categories set label = 'Espresso' where (id = 'espresso' or slug = 'espresso') and label = 'Espresso Based';
update public.categories set label = 'Soğuk Kahve' where (id = 'ice-coffee' or slug = 'ice-coffee') and label = 'Ice Coffee';
update public.categories set label = 'Soğuk İçecekler' where (id = 'cold' or slug = 'cold') and label = 'Cold Drinks';
update public.categories set label = 'Sıcak İçecekler' where (id = 'hot' or slug = 'hot') and label = 'Hot Drinks';
update public.categories set label = 'Soğuk Çay' where (id = 'ice-tea' or slug = 'ice-tea') and label = 'Ice Tea';
update public.categories set label = 'Ekstralar' where (id = 'extras' or slug = 'extras') and label = 'Extras';
