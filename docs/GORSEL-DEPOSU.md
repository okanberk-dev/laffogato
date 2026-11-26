# Görsel deposu: fotoğraflar Cloudflare R2'de (26 Kas 2026)

## Neden

Panelden yüklenen fotoğraflar satırların içinde base64 `data:image/...`
olarak duruyordu. Neon ücretsiz planının aylık 5 GB veri transferi kotası
bu yüzden aşıldı (5,5 GB) ve site yaklaşık iki gün veritabanısız kaldı.
26 Kas 2026 ölçümü: `menu_items.image` 25 değer / 4,1 MB (en büyüğü
195 kB), `products.images` 15 değer / 2,4 MB. Fotoğraflar artık bir kovada
durur, satırda yalnız herkese açık URL'i.

## Nasıl çalışır

| Parça                                                        | Dosya                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Ortak kurallar (sıkıştırma, anahtar, SigV4 imzası, PUT/HEAD) | `src/lib/images/store-core.mjs`                                                 |
| URL'in "bizim kovamız" olup olmadığı (istemciye de güvenli)  | `src/lib/images/url-core.mjs`, `src/lib/images/public.ts`                       |
| Sunucu tarafı: yükleme, geri okuma, yeni data URL'i reddetme | `src/lib/images/store.ts`                                                       |
| Yükleme ucu (yönetici oturumu + rol + aynı köken)            | `src/app/admin/gorsel-yukle/route.ts`                                           |
| Panelin yükleyicisi                                          | `src/lib/admin/image-upload-client.ts`, `image-upload.tsx`, mağaza slaytı formu |
| Eski data URL'leri taşıyan betik                             | `scripts/images-to-r2.mjs`                                                      |

- **Sıkıştırma (tek kural, betik ve panel aynı):** `sharp().rotate()` (EXIF
  yönü), 1600 × 1600'e sığdır (büyütme yok), WebP kalite 80, metadata yok
  (sharp istenmedikçe yazmaz). WebP orijinalden büyükse orijinal bayt ve
  biçim korunur. Saydam fotoğraf (dekupe) WebP'de saydamlığını korur.
- **Anahtar:** `img/<sha256 ilk 16 hex>.webp`. Aynı içerik aynı anahtara
  düşer, bir kez yüklenir (önce HEAD). Her nesne
  `Cache-Control: public, max-age=31536000, immutable` ile yazılır.
- **Panel:** tarayıcı dosyayı yine 1600 px'e küçültür (tek istek 4,5 MB
  sınırının çok altında kalsın diye), sonra `/admin/gorsel-yukle`'ye tek
  başına gönderir; sunucu aynı kuralla yeniden sıkıştırır, R2'ye yükler ve
  URL'i döner. Form yalnız URL'i kaydeder. Bu yüzden ön imzalı (presigned)
  doğrudan yükleme kullanılmadı: sıkıştırma sunucuda olmalıydı ve tek
  fotoğraflık istek Vercel'in 4,5 MB sınırına zaten takılmıyor.
- **Depo ayarlı değilken** (beş değişkenden biri eksik) uç 503
  `unconfigured` döner ve yükleyici eskisi gibi data URL saklar: değişkenler
  girilmeden yapılan bir deploy yüklemeyi bozmaz.
- **Yeni data URL reddi:** depo ayarlıyken bir kayıt satırın zaten
  taşımadığı bir `data:` değeri getirirse kaydedilmez ("Bu fotoğraf eski
  yoldan geldi..."). Satırın kendi eski data URL'i geri gönderilirse kabul
  edilir: düzenleme formları kayıtlı fotoğrafları her kayıtta geri yollar
  ve taşınmamış satırlar düzenlenebilir kalmalı. Beş yer: ürün, menü,
  mağaza slaytı, anasayfa slaytı, site görselleri.
- **Eski okuyucular çalışmaya devam eder:** `/gorsel/**` rotaları data
  URL'i eskisi gibi sunar; değer kovamızdaki bir URL ise oraya 307 ile
  yönlendirir (beş dakika önbellek). Uygulamanın diskindeki, gönderilmiş
  e-postalardaki ya da arama sonuçlarındaki `/gorsel/...` adresleri
  fotoğrafı göstermeye devam eder. `image-bytes.ts` dokunulmadı.
- **Sahne (backdrop, photoCutout):** kaydederken fotoğraf okunur; kovadaki
  bir URL ise herkese açık adresinden geri indirilir (en çok 8 MB, 20 sn).
  Başka host'lardaki bağlantılar yine indirilmez.

## Sunum: next/image ve doğrudan URL

`next.config.ts`, `IMAGES_PUBLIC_BASE_URL`'i derleme anında okur:

- `images.remotePatterns`'a yalnız `<adres>/img/**` eklenir; sitenin
  fotoğraf bileşenleri (`ProductSurface`, `MenuPlate`, sayfa açılışları,
  site görselleri) kovadaki fotoğrafı next/image ile çizer
  (`canOptimizeImage`, `src/components/laffogato/local-image.ts`). Vercel'in
  görsel önbelleği kovanın önünde durur; `r2.dev` adresinin hız sınırına her
  ziyaret takılmaz. Başka host'tan yapıştırılmış bağlantı `unoptimized`
  çizilir (önceden next/image onu reddediyordu).
- `NEXT_PUBLIC_IMAGES_BASE_URL` olarak tarayıcıya da verilir (herkese açık
  bir adres, sır değil).
- **Adres değişince yeniden deploy gerekir.**

next/image'dan geçmeyen yollar doğrudan URL'i kullanır ve `https` olduğu
için çalışır: mobil API (`absoluteImageUrl` https'i olduğu gibi geçirir;
lafmobil her kökenden görsel çizer), kampanya e-postası
(`KAMPANYA_GORSEL_URL` yalnız https kabul eder), karaoke odası ve
kampanyalar sayfasındaki düz `<img>`'ler, üye favorileri. CSP'de
`img-src https:` zaten var (site ve panel).

**Kalıcı öneri:** kovaya Cloudflare'de yönetilen bir alan adından özel alan
adı bağla (ör. `foto.laffogato.net`) ve `IMAGES_PUBLIC_BASE_URL`'i ona
çevir; `r2.dev` Cloudflare'in kendi ifadesiyle üretim için değil, hız
sınırlıdır. Adres değişirse mevcut satırlardaki URL'ler eski adresi
gösterir: ya `r2.dev`'i açık bırak ya da satırları bir `UPDATE ... replace()`
ile çevir (yedekten sonra).

## Taşıma (operatör)

Ön koşul: `laffogato-foto` kovası herkese açık, yalnız iki kovaya yetkili
Object Read & Write anahtarı, beş değişken Vercel'de (Production + Preview)
ve bir deploy.

1. **Kuru çalıştırma** (yazma yok, depo değişkeni gerekmez):

   ```bash
   DATABASE_URL='<canlı>' node scripts/images-to-r2.mjs
   ```

   Tablo ve sütun başına bulunan değer sayısı, veritabanındaki ve dosya
   olarak önceki / sonraki boyut. Bir text değerin **içinde** data URL varsa
   (değerin tamamı değil) ayrıca yazılır ve dokunulmaz.

2. **Uygula:**

   ```bash
   DATABASE_URL='<canlı>' IMAGES_S3_ENDPOINT=... IMAGES_S3_BUCKET=laffogato-foto \
   IMAGES_S3_ACCESS_KEY_ID=... IMAGES_S3_SECRET_ACCESS_KEY=... \
   IMAGES_PUBLIC_BASE_URL=... node scripts/images-to-r2.mjs --apply
   ```

   Önce etkilenen tabloların yedeği (`pg_dump --data-only -Fc -t ...`,
   `./backups/`; yedek alınamazsa hiçbir şey yazılmaz). **pg_dump sürümü
   sunucunun ana sürümünden eski olamaz** (Neon ve Coolify Postgres 18:
   pg_dump 18 gerekir). Sonra yükleme, sonra bütün satırlar **tek
   transaction'da**, her biri yalnız okunduğu değeri hâlâ taşıyorsa
   (bu arada panelden kaydedilen satır atlanır, yeniden çalıştırınca alınır).
   Tekrar çalıştırılabilir: URL olan değere dokunmaz.

3. **Önbellek:** betiğin sonunda yazdığı komutla etiketleri düşür ya da
   yeniden deploy et (`docs/DATABASE.md` "Etiket düşürmeyen yazmalar").

4. **Doğrula:** `/menu`, `/magaza`, bir ürün sayfası, anasayfa ve
   `/api/mobile/v1/menu`'deki `image` alanları `https://.../img/...` olmalı
   ve açılmalı; panelde bir fotoğraf yükle, satırda URL olduğunu gör.

**Sıra önerisi:** bunu veritabanı taşımasından (docs/COOLIFY-GECIS.md)
**önce**, Neon'a karşı çalıştır: dump/restore ~6,5 MB base64 taşımaz.

### Geri alma

Yedek dosyası yalnız etkilenen tabloların verisidir. Bir tabloyu eski
hâline döndürmek için önce o tablonun yeni satırlarını kaybetmeyi göze al:

```bash
pg_restore --list backups/images-to-r2-<zaman>.dump   # içerik
# Tek sütunu geri yazmak en güvenlisi: yedeği geçici bir veritabanına
# yükle, sonra UPDATE ... FROM ile yalnız image / images sütununu geri yaz.
```

Kovadaki nesneler silinmez; geri almak yalnız satırları ilgilendirir.

## Tüketen depolar (26 Kas 2026 kontrolü)

- **lafmaliyet:** menü görseli okumaz (site menüsü şemasında görsel alanı
  yok); etkilenmez.
- **lafmobil:** görseli `/api/mobile/v1/*`'dan alır; sunucu https'i olduğu
  gibi geçirir (önceden `/gorsel/...` yolunu site adresiyle tamamlıyordu).
  Bu oturumda depoya erişim yoktu: `https://pub-....r2.dev/img/...`
  adreslerinin uygulamada çizildiği gerçek cihazda doğrulanmalı.
- **LafPOS:** menüyü herkese açık menü ucundan çeker; aynı alan, aynı
  durum. Bu oturumda depoya erişim yoktu; kasa ekranında doğrulanmalı.
