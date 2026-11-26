# Görsel deposu ve veritabanı geçişi testleri

26 Kasım 2026'da fotoğrafların Cloudflare R2'ye ve veritabanının Coolify'a
taşınması için eklendi (`docs/GORSEL-DEPOSU.md`, `docs/COOLIFY-GECIS.md`).
16 Kasım 2026'da kaldırılan `tests/` klasörünün geri gelmesi değildir, yalnız
bu değişikliği tutar (`tests/sube/` gibi). CI'da koşmaz. Veritabanı ve ağ
yok: depo sahte `fetch` ile.

```bash
npm run test:gecis
```

| Dosya                 | Ne tutar                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ssl-config.test.ts`  | `DATABASE_SSL_CA` her host'ta, sistem köklerinin yanında; PEM olmayan CA yok sayılır; `rejectUnauthorized` hep `true`; Supabase host'unda TLS zorunlu; `sslmode` dizeden çıkar; `DATABASE_SSL_SERVERNAME`; havuz `max: 1`                                    |
| `image-store.test.ts` | Beş değişken; anahtar `img/<sha256-16>.webp`; yalnız kendi URL'lerimiz; sıkıştırma (EXIF, 1600 px, WebP, metadata yok, saydamlık, büyütme yok); SigV4 imzası botocore ile aynı; tek yükleme; yeni data URL reddi; `/gorsel/**` yönlendirmesi; Neon kartı gri |

`scripts/images-to-r2.mjs` uçtan uca yerel bir Postgres ve sahte bir S3
(https) sunucusuyla elle denendi: kuru çalıştırma raporu, `pg_dump` yedeği
(alınamayınca yazma yok), tek yükleme, jsonb içindeki dış bağlantının
korunması, ikinci çalıştırmada değişiklik olmaması.
