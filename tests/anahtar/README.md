# Anahtar değişimi testleri

27 Kasım 2026'da LafPOS'un site anahtarının değişimi için eklendi
(`docs/LAFPOS.md` "Anahtarı değiştirmek"). 26 Kasım'da anahtar panelden
kasaya dağıtıldı, kasa onu gün sonunda uyguladı, sitede ise eski değer
duruyordu: kasanın her isteği reddedildi. Site artık değişim boyunca önceki
değeri de (`LAFPOS_SYNC_SECRET_ONCEKI`) kabul eder ve her 2xx yanıtta hangi
değerin tuttuğunu söyler (`x-laf-anahtar: simdiki | onceki`). 16 Kasım 2026'da
kaldırılan `tests/` klasörünün geri gelmesi değildir, yalnız bu değişikliği
tutar (`tests/sube/` gibi). CI'da koşmaz. Veritabanı ve ağ yok.

```bash
npm run test:anahtar
```

| Dosya                     | Ne tutar                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signed-callers.test.ts`  | Önceki değer bugünkünün kurallarıyla (kırpma, 32 karakter, panelinkiyle aynıysa yok); yalnız bugünkü sayılırken sayılır; iki değerle imzalı istek de LafPOS'un; bayat ve başka yola atılmış imza geçmez; her anahtar denenir; hangi değerin tuttuğu (`signedBy`: bugünkü `simdiki`, önceki `onceki`, panelinki `simdiki`) ve başlığın yalnız adı taşıdığı                                                                    |
| `rotation-routes.test.ts` | Sürüm ucu değişimin her adımında (olayın kendisi, iki değer, önceki silinince, panelin anahtarı önceki diye girilince, yalnız önceki kalınca 503); önceki değerle menü, karaoke, Gördüm ve siparişler LafPOS'un yetkisiyle; `x-laf-anahtar`: sürüm ucunda eski değer `onceki`, yeni `simdiki`, 401 ve 503'te yok, LafPOS'un yedi ucunun 2xx'inde `onceki`, 4xx'te yok, panelin karaoke yazımında ve şube fiyatında `simdiki` |
