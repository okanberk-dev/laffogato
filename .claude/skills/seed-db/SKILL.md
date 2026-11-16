---
name: seed-db
description: Seed or reset the Laffogato Postgres database with test data (categories, products, cafe settings). Use when the user wants to "seed", "test verisi ekle", "ürünleri yükle", or set up a fresh dev environment.
---

# Veritabanını Seed Et

**Paketten test verisi yok (16 Kas 2026).** Ürün, menü kalemi, sipariş, mağaza
hero ve uygulama içeriği seed'leri kaldırıldı; boş bir veritabanı boş bir
mağaza ve boş bir menüyle açılır. İlk istek yalnız beş mağaza kategorisinin
kabuğunu (geliştirmede) ve tek `settings` satırını yazar.

## Sıfırdan bir ortam

1. Neon projesi + `DATABASE_URL` hazır olmalı (`docs/DATABASE.md`).
2. Şemayı kur:
   ```bash
   DATABASE_URL='postgres://...' npm run db:migrate
   ```
3. `npm run dev` ile siteyi aç, ürünleri ve menüyü `/admin`'den gir.

## Canlıdaki test kayıtları

Repodaki değişiklik canlı veritabanına dokunmaz. Neon'daki test siparişlerini
ve hesaplarını bulmak ve silmek için `docs/TEST-VERISI-TEMIZLIK.md`.

`orders`, `customers`, `payment_transactions`, `audit_logs` gerçek kayıt tutar;
bunları temizlemeden önce **kullanıcıya sor**.
