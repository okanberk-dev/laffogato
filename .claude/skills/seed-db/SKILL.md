---
name: seed-db
description: Seed or reset the Laffogato Postgres database with test data (categories, products, cafe settings). Use when the user wants to "seed", "test verisi ekle", "ürünleri yükle", or set up a fresh dev environment.
---

# Veritabanını Seed Et

Uygulama **kendi kendini seed eder**: `src/lib/admin/store.ts` içindeki
`ensureSeed()` / `ensureShopHeroSeed()` / içerik seed'i, ilgili tablo boşsa ilk
istekte `SEED_*` sabitlerini idempotent şekilde (`ON CONFLICT DO NOTHING`) yazar.
Yani çoğu durumda ayrı bir seed adımı **gerekmez**.

## Sıfırdan bir ortam

1. Neon projesi + `DATABASE_URL` hazır olmalı (`docs/DATABASE.md`).
2. Şemayı kur:
   ```bash
   DATABASE_URL='postgres://...' npm run db:migrate
   ```
3. `npm run dev` ile siteyi aç - ilk istek tabloları doldurur.

## Seed verisini değiştirmek

Seed sabitleri `src/lib/admin/store.ts` içinde (`SEED_PRODUCTS`,
`SEED_CATEGORIES`, `SEED_MENU`, `SEED_SHOP_HERO_SLIDES`, `defaultSettings()`).
Tasarımın orijinal statik verisi ise `src/components/laffogato/data.ts`.

## Bir tabloyu yeniden seed etmek

Seed yalnızca tablo **boşken** çalışır. Yeniden çalıştırmak için önce tabloyu
boşalt - bunu yapmadan önce **kullanıcıya sor**, canlı veri kaybı olabilir:

```sql
truncate table products;   -- örnek; siparişler/müşteriler için ASLA
```

`orders`, `customers`, `payment_transactions`, `audit_logs` gerçek kayıt tutar;
bunları temizleme.
