# Anahtar değişimi testleri

27 Kasım 2026'da LafPOS'un site anahtarının değişimi için eklendi
(`docs/LAFPOS.md` "Anahtarı değiştirmek"). 26 Kasım'da anahtar panelden
kasaya dağıtıldı, kasa onu gün sonunda uyguladı, sitede ise eski değer
duruyordu: kasanın her isteği reddedildi. Site artık değişim boyunca önceki
değeri de (`LAFPOS_SYNC_SECRET_ONCEKI`) kabul eder. 16 Kasım 2026'da
kaldırılan `tests/` klasörünün geri gelmesi değildir, yalnız bu değişikliği
tutar (`tests/sube/` gibi). CI'da koşmaz. Veritabanı ve ağ yok.

```bash
npm run test:anahtar
```

| Dosya                     | Ne tutar                                                                                                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signed-callers.test.ts`  | Önceki değer bugünkünün kurallarıyla (kırpma, 32 karakter, panelinkiyle aynıysa yok); yalnız bugünkü sayılırken sayılır; iki değerle imzalı istek de LafPOS'un; bayat ve başka yola atılmış imza geçmez; her anahtar denenir |
| `rotation-routes.test.ts` | Sürüm ucu değişimin her adımında (olayın kendisi, iki değer, önceki silinince, panelin anahtarı önceki diye girilince, yalnız önceki kalınca 503); önceki değerle menü, karaoke, Gördüm ve siparişler LafPOS'un yetkisiyle   |
