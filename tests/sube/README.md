# Şube ve sözleşme testleri

21 Kasım 2026'da LafPOS ile sözleşme uyumu için eklendi (şube; seçenek
fiyatları S8). 16 Kasım 2026'da kaldırılan `tests/` klasörünün geri gelmesi
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
| `panel-routes.test.ts`      | İmzalı uçlar (veri katmanı taklit): siparişler, aşama, Gördüm, karaoke, masalar, menü; hangi şube adına okur / yazar                                                                |
| `db.test.ts`                | `TEST_DATABASE_URL` varsa: şubenin satırı (koşullu yazım), sipariş fiyatı şubede ve S8, masa listesi, bar okuması ve çağrılar                                                       |
| `pre-branch-data.test.ts`   | `TEST_DATABASE_URL` varsa: şubelerden önce LafPOS'un gönderdiği masa kodları Marina'ya geçer (açık sipariş ve çağrılarıyla), eski Tükendi'ler şubenin satırına iner; Tuzla değişmez |
