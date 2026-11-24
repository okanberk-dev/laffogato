# Şube ve sözleşme testleri

21 Kasım 2026'da LafPOS ile sözleşme uyumu için eklendi (şube; seçenek
fiyatları S8; 23 Kasım 2026'da şube fiyatı). 16 Kasım 2026'da kaldırılan `tests/` klasörünün geri gelmesi
değildir, yalnız bu değişikliği tutar (`tests/saved-cards/` gibi). CI'da
koşmaz.

```bash
npm run test:sube
# Gerçek Postgres'e karşı da (yerel, boş; şema kurulu):
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5433/laf_test npm run test:sube
```

| Dosya                       | Ne tutar                                                                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `branches.test.ts`          | Şube kimliği, bilinen şubeler, panelin ve LafPOS'un şubesi, `branch` alanı, 400 / 403                                                                                               |
| `menu-availability.test.ts` | Satışta / Tükendi şubeye göre: görünüm, damga, doğrulayıcının A / B / C senaryoları                                                                                                 |
| `option-prices.test.ts`     | S8: seçenek ücreti menü kalemlerinden, sabite düşme kuralları, laktozsuz 0, sipariş fiyatı                                                                                          |
| `tables-and-sales.test.ts`  | Masa listesi başka şubenin koduyla reddedilir; satışın şube süzgeci ve `byBranch`                                                                                                   |
| `panel-routes.test.ts`      | İmzalı uçlar (veri katmanı taklit): siparişler (`paidAtTill`, `lines[].index`, `closed`), aşama, Gördüm, karaoke, masalar, menü; hangi şube adına okur / yazar                    |
| `branch-prices.test.ts`     | Şube fiyatı çekirdeği: geçerli satır, tabana dönüş, boylar, sonraki an, dönem, anın biçimi ve penceresi, `branchPrice` ayrıştırması, panelin satırı                                   |
| `branch-price-routes.test.ts` | İmzalı menü okuması şubenin fiyatıyla (`basePriceMinor`, `priceFrom`, `nextPriceAt`, panele `branchPrices`), `branchPrice` yazımı ve retleri, uygulamanın `/menu?branch=`'i |
| `site-menu-branch-price.test.ts` | Masanın QR menüsünün önbellek kaydı şubenin fiyat anı geçince bir kez yeniden okunur; Tuzla'nın anahtarı aynı                                                                 |
| `neon-uyanma.test.ts`       | Neon kotası (#229): kasanın güvenlik çekimi ve menü yoklaması değişiklik yokken veritabanına gitmez; önce / sonra saatlik okuma ölçümü; panelin (Tuzla) okuması aynen canlı; şubenin fiyat satırı menü özetini oynatır; `/menu?branch=` `ETag`'i fiyat anına kadar |
| `db.test.ts`                | `TEST_DATABASE_URL` varsa: şubenin satırı (koşullu yazım), sipariş fiyatı şubede ve S8, masa listesi, bar okuması ve çağrılar, `closed` ve kasada ödenen okuması, dizin; şube fiyatı satırları, Marina masasının sipariş fiyatı ve QR menüsü |
| `pre-branch-data.test.ts`   | `TEST_DATABASE_URL` varsa: şubelerden önce LafPOS'un gönderdiği masa kodları Marina'ya geçer (açık sipariş ve çağrılarıyla), eski Tükendi'ler şubenin satırına iner; Tuzla değişmez |
