---
name: seed-db
description: Seed the Supabase database with Laffogato test data (categories, products, cafe settings). Use when the user wants to "seed", "test verisi ekle", "ürünleri yükle", or set up a fresh dev environment.
---

# Veritabanını Seed Et

`supabase/seed/seed.sql` dosyasını çalıştırarak kategori, ürün ve kafe ayarlarını test verisiyle doldurur.

## Ön koşullar

- `supabase/migrations/` altındaki migration'lar uygulanmış olmalı (`list_migrations` ile kontrol et).
- Hangi Supabase projesinde çalışacağını kullanıcıya sor — birden fazla proje varsa.

## Adımlar

1. Migration durumunu kontrol et:
   ```
   mcp__32e5c71b-e66a-4a9d-9f63-fe8ba4dfeb40__list_migrations({ project_id: "<ref>" })
   ```

2. `supabase/seed/seed.sql` dosyasını oku.

3. SQL'i MCP ile çalıştır:
   ```
   mcp__32e5c71b-e66a-4a9d-9f63-fe8ba4dfeb40__execute_sql({
     project_id: "<ref>",
     query: "<seed.sql içeriği>"
   })
   ```

4. Doğrulama: Aşağıdaki query'leri çalıştır ve sonuçları kullanıcıya göster:
   ```sql
   select count(*) from public.categories;
   select count(*) from public.products;
   select * from public.cafe_settings;
   ```

## İlk admin kullanıcısı

Seed dosyası admin kullanıcısı oluşturmaz (auth.users'ı doğrudan değiştirmek istenmez). Bunun yerine:

1. Kullanıcıdan `SEED_ADMIN_EMAIL` ve `SEED_ADMIN_PASSWORD` al.
2. Supabase Auth API üzerinden sign-up yap (ya da kullanıcıya manuel sign-up yaptır).
3. Oluşan `user_id`'yi `admin_users` tablosuna `owner` rolüyle ekle:
   ```sql
   insert into public.admin_users (user_id, role)
   values ('<user_id>', 'owner')
   on conflict (user_id) do update set role = excluded.role;
   ```

## Yapma

- Production projesinde seed çalıştırmadan önce **mutlaka** kullanıcıya teyit ettir.
- Seed dosyası `on conflict do update` kullanır — mevcut veriyi siler değil günceller. Buna güvenebilirsin.
