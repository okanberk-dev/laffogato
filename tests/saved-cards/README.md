# Kayıtlı kart testleri

Kayıtlı kartın (PayNkolay kart saklama, `docs/PAYNKOLAY.md` §16.3) uçtan uca
testleri. 20 Kas 2026'da operatörün isteğiyle eklendi ("sen ekle ne
gerekiyorsa"); 16 Kas 2026'da kaldırılan `tests/` klasörünün geri gelmesi
değildir, yalnız bu özelliği tutar.

```bash
# Yerel, boş bir Postgres (canlı veritabanı REDDEDİLİR):
docker run -d --name laf-test-db -p 5433:5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16
createdb -h 127.0.0.1 -p 5433 -U postgres laf_test

TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5433/laf_test npm run test:saved-cards
# Derleme zaten varsa: SKIP_BUILD=1 ...
```

`scripts/test-saved-cards.sh` şemayı kurar (`db:migrate`), PayNkolay'ı taklit
eden sunucuyu (`mock-paynkolay.mjs`, imzaları gerçek formülle denetler) ve
uygulamanın derlenmiş hâlini (`next start`) yalnız test anahtarlarıyla açar,
testleri koşar, iki sunucuyu kapatır. CI'da koşmaz (yerel Postgres ve
tarayıcı ister). Tarayıcı testleri Playwright'ı genel kurulumdan yükler
(`helpers.ts` sonu).

| Dosya | Ne tutar |
| --- | --- |
| `0-unit` | Şifreleme (AES-256-GCM, satıra bağlama, kurcalama, anahtar döndürme, eski açık anahtar, kısa anahtar), kart adı temizliği, aynı kart denetimi |
| `1-db` | Anahtar şifreli yazılır ve okunur; 10 eşzamanlı ödeme tek anahtar; açık anahtar ilk okunuşta şifrelenir; başka satıra kopyalanan değer açılmaz; anahtar kaybında üzerine yazılmaz; silme kuyruğu |
| `2-route` | `/odeme/paynkolay`: liste son 4 haneyle, token/BIN/anahtar sayfada yok; kaydet + kart adı; aynı kart iki kez kaydedilmez; 10 kart sınırı; kayıtlı kartla ödemede kart numarası gitmez; başka üyenin kartı seçilemez/silinemez; başka siteden POST reddedilir; logda kart numarası yok |
| `3-account` | Hesabım › Kayıtlı kartlarım (tarayıcı): giriş zorunlu, liste, sorup silme, kurcalanmış `tranId`, PayNkolay kapalı, menü bağlantısı |
| `4-closure` | Hesap kapatma: PayNkolay açıkken kartlar hemen silinir; kapalıyken anahtar şifreli kuyruğa girer, `/api/cron/daily` siler |
| `5-checkout` | `/odeme` (tarayıcı): liste, kart adı alanı, "Siparişi onayla ve öde" → bankanın 3D sayfası, kayıtlı kartla ödeme, sınır notu, silme |
