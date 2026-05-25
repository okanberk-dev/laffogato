-- Test verisi. Production'a uygulanmamalı.
-- Çalıştırmadan önce schema migration'ı çalıştırılmış olmalı.

insert into public.cafe_settings (id, name, tagline, phone, email, address, opening_hours, is_shop_open)
values (
  1,
  'Laffogato',
  'Her yudumda bir hikaye',
  '+90 555 000 00 00',
  'merhaba@laffogato.test',
  'Örnek Mah. Kahve Sok. No:1, İstanbul',
  '{"pazartesi":"08:00-22:00","sali":"08:00-22:00","carsamba":"08:00-22:00","persembe":"08:00-22:00","cuma":"08:00-23:00","cumartesi":"09:00-23:00","pazar":"09:00-22:00"}'::jsonb,
  true
)
on conflict (id) do update
set
  name = excluded.name,
  tagline = excluded.tagline,
  phone = excluded.phone,
  email = excluded.email,
  address = excluded.address,
  opening_hours = excluded.opening_hours;

with cats as (
  insert into public.categories (slug, name, description, sort_order)
  values
    ('kahveler',       'Kahveler',       'Demlenmiş ve paketli kahveler', 1),
    ('tatlilar',       'Tatlılar',       'Ev yapımı kek ve tatlılar',     2),
    ('atistirmaliklar','Atıştırmalıklar','Sandviç, kraker, granola',      3),
    ('hediye-setleri', 'Hediye Setleri', 'Özel günler için kahve setleri', 4)
  on conflict (slug) do update set name = excluded.name
  returning id, slug
)
insert into public.products (category_id, slug, name, description, price_minor, image_url, stock, is_active, is_featured)
select c.id, p.slug, p.name, p.description, p.price_minor, p.image_url, p.stock, true, p.is_featured
from (
  values
    -- Kahveler
    ('kahveler',        'espresso-blend-250g',   'Espresso Blend 250g',   'Yoğun kakao ve karamel notaları', 24500, '/products/espresso-blend.jpg', 50, true),
    ('kahveler',        'filtre-kahve-250g',     'Filtre Kahve 250g',     'Yumuşak, dengeli, çiçeksi',       22500, '/products/filter.jpg',        40, false),
    ('kahveler',        'turk-kahvesi-200g',     'Türk Kahvesi 200g',     'Geleneksel orta kavrum',           18500, '/products/turkish.jpg',       60, false),
    -- Tatlılar
    ('tatlilar',        'cookie-kutusu-6li',     'Cookie Kutusu 6''lı',    'Çikolata parçacıklı, ev yapımı',   12500, '/products/cookies.jpg',       30, true),
    ('tatlilar',        'limonlu-kek',           'Limonlu Kek',           'Hafif, ferahlatıcı dilim kek',      8500, '/products/lemon-cake.jpg',    25, false),
    ('tatlilar',        'brownie-kutusu',        'Brownie Kutusu',        'Yoğun çikolatalı, 4''lü kutu',     11500, '/products/brownie.jpg',       20, false),
    -- Atıştırmalıklar
    ('atistirmaliklar', 'granola-300g',          'Granola 300g',          'Bal, yulaf, kuruyemiş',            14500, '/products/granola.jpg',       40, false),
    ('atistirmaliklar', 'sandvic-tavuklu',       'Tavuklu Sandviç',       'Izgara tavuk, marul, domates',      9500, '/products/sandwich.jpg',      15, false),
    ('atistirmaliklar', 'kraker-tuzlu',          'Tuzlu Kraker Kutusu',   '200g tam tahıllı kraker',           7500, '/products/cracker.jpg',       50, false),
    -- Hediye Setleri
    ('hediye-setleri',  'klasik-hediye-seti',    'Klasik Hediye Seti',    'Espresso + filtre + cookie',       49500, '/products/gift-classic.jpg',  10, true),
    ('hediye-setleri',  'tek-kisilik-keyif',     'Tek Kişilik Keyif Seti','Kupa + 100g kahve + cookie',       27500, '/products/gift-solo.jpg',     15, false),
    ('hediye-setleri',  'kurumsal-hediye-seti',  'Kurumsal Hediye Seti',  '3 farklı kahve + özel kutu',       69500, '/products/gift-corporate.jpg', 8, false)
) as p(category_slug, slug, name, description, price_minor, image_url, stock, is_featured)
join cats c on c.slug = p.category_slug
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price_minor = excluded.price_minor,
  stock = excluded.stock;
