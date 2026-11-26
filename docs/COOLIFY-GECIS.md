# Neon → Coolify (Vultr Frankfurt) geçişi: çalıştırılabilir yordam

> **Durum (26 Kas 2026):** kod hazır, geçiş **yapılmadı**. Veri Neon'da
> (`misty-cell-35394291`, AWS us-east-2, Postgres 18.7), Neon Launch
> planında. Hedef Coolify'da kurulu ve sağlıklı ama SSL kapalı, dışa kapalı.
> `dbProvider` hâlâ `"Neon"`: veri taşınmadan değişmez.
> Önce [DATABASE.md](DATABASE.md) "Sağlayıcı geçmişi" bölümünü oku.

## Neden

Neon ücretsiz planının aylık 5 GB veri transferi kotası aşıldı (5,5 GB);
site yaklaşık iki gün veritabanısız kaldı. Transferin büyük kısmı base64
fotoğraflardı (onlar [GORSEL-DEPOSU.md](GORSEL-DEPOSU.md) ile R2'ye
gidiyor). Veritabanı kendi sunucumuza taşınınca transfer kotası ve
uyku / kota kesintisi riski kalkar; yerine sunucunun bakımı, yedeği ve tek
makine riski gelir (aşağıda "Yedek" ve "Riskler").

## Hedef

|                        |                                                    |
| ---------------------- | -------------------------------------------------- |
| Coolify projesi        | `Laffogato`                                        |
| Veritabanı             | `laffogato-pg`, UUID `yyabtxbgmir17mxdsqwzwtfe`    |
| İmaj                   | `postgres:18-alpine` (Neon ile aynı ana sürüm)     |
| Kullanıcı / veritabanı | `laffogato` / `laffogato` (şifreyi Coolify üretti) |
| Sunucu                 | Vultr Frankfurt, `199.247.6.54`                    |
| Bellek sınırı          | 1 GB                                               |

Site Vercel'de (fra1) kalır; bağlantı yalnız `DATABASE_URL`'den kurulur
(`src/lib/db/database-url.mjs`). Frankfurt sunucusu fra1'e Ohio'dan çok daha
yakındır: sorgu gecikmesi düşer.

## Koddaki değişiklikler (26 Kas 2026, yapıldı)

1. **`DATABASE_SSL_CA` her host'ta** (`src/lib/db/ssl-config.mjs`): tanımlıysa
   sistem köklerinin **yanına** eklenir, yerine değil. Böylece Coolify'ın
   kendi CA'sıyla imzalı sertifika doğrulanır ve `DATABASE_URL` Neon'a geri
   alınınca (CA hâlâ tanımlıyken) bağlantı yine kurulur. Tam doğrulama her
   zaman açık; `rejectUnauthorized: false` yolu yok.
   `DATABASE_SSL_SERVERNAME` (isteğe bağlı): sertifikanın taşıdığı ad
   URL'deki host değilse (IP ile bağlanılıyor, sertifika başka bir adla
   imzalı) beklenen ad. Doğrulama gevşemez. Uygulama, `db:migrate` ve
   betikler aynı dosyayı kullanır.
2. **`db:migrate` düzeltmeleri:** (a) `sslmode` artık URL'den çıkarılıp
   `ssl` açıkça verilir; önceden `pg` URL'deki `sslmode`'u `ssl` nesnesinin
   üstüne yazdığı için özel CA migrate'e hiç ulaşmıyordu. (b) Boş bir
   veritabanında `20261124150000_menu_studio_photos.sql`'de çöküyordu (dosya
   kendi `_migrations` satırını yazıyor, betik ikinci kez yazıyordu); kayıt
   artık `on conflict do nothing`.
3. **Havuz:** `max: 1` (örnek başına tek bağlantı) kalır. Coolify'ın önünde
   pooler yok; Postgres'in `max_connections`'ı (varsayılan 100) bütün sıcak
   Vercel örnekleri, betikler ve yedek arasında paylaşılır.
4. **Neon kullanım kartı:** `NEON_API_KEY` / `NEON_PROJECT_ID` yokken
   `off` (gri, `neutral`) döner ve panoda hiç çizilmez (`neonAlarm` yalnız
   turuncu / kırmızıda). Geçişten sonra iki değişken Vercel'den silinir.

## Yordam

### 1. Sunucuyu aç (operatör ya da Coolify)

Coolify → `laffogato-pg`:

- **SSL'i aç** (Enable SSL, mod `verify-full`). Coolify sunucu sertifikasını
  kendi CA'sıyla imzalar; CA sunucuda `/data/coolify/ssl/` altında
  (`coolify-ca.crt`). Bu dosyanın PEM içeriği `DATABASE_SSL_CA` olur.
- **Standart dışı bir portta dışa aç** (Make it publicly available, ör.
  `5433` değil, tahmin edilmesi zor bir port). Coolify'ın "public port
  timeout"ı 3600 sn: kalıcı bağlantı için sıfırla ya da kaldır.
- Güvenlik duvarı: mümkünse portu yalnız gereken adreslere aç. Vercel
  fonksiyonlarının çıkış IP'si sabit değildir (Pro'da Static IPs ayrı bir
  ürün); bu yüzden asıl koruma güçlü şifre + zorunlu TLS + doğrulanan
  sertifikadır. Şifreyi Coolify üretti; değiştirme.

Sertifikanın adı: bağlanmadan önce bak:

```bash
openssl s_client -starttls postgres -connect 199.247.6.54:<port> -showcerts </dev/null \
  | openssl x509 -noout -subject -ext subjectAltName
```

- SAN'da `IP Address:199.247.6.54` ya da kullanacağın DNS adı varsa ek bir
  şey gerekmez.
- Yoksa (Coolify sertifikayı veritabanının UUID'siyle imzalar):
  `DATABASE_SSL_SERVERNAME=<SAN'daki ad>` (ör. `yyabtxbgmir17mxdsqwzwtfe`).
  Daha temiz yol: `db.laffogato.net` gibi bir A kaydı ve o adı taşıyan bir
  sertifika.

`DATABASE_URL`:

```
postgres://laffogato:<şifre>@199.247.6.54:<port>/laffogato?sslmode=verify-full
```

### 2. Şemayı kur (canlıya dokunmaz)

```bash
DATABASE_URL='<coolify>' DATABASE_SSL_CA="$(cat coolify-ca.crt)" \
  [DATABASE_SSL_SERVERNAME=<ad>] npm run db:migrate
```

İdempotent; `_migrations`'a yazar. CA olmadan "self-signed certificate in
certificate chain" ile düşer: beklenen davranış, şifresiz bağlanmaya düşmez.

### 3. Fotoğrafları önce taşı (önerilir)

[GORSEL-DEPOSU.md](GORSEL-DEPOSU.md) "Taşıma": Neon'a karşı. Dump ~6,5 MB
base64 ve şişkinlik taşımaz.

### 4. Mağazayı durdur (15-20 dk, saati operatör seçer)

Sipariş, karaoke rezervasyonu ve panel yazımları bu aralıkta Neon'a gider
ve kopyaya girmez. Kapalı saatlerde yap; panelde mağaza ve uygulama
siparişini kapat (Mobil → Ayarlar; mağaza için ürünleri pasife almak
yerine bakım duyurusu), ladmin / LafPOS'un yazmadığından emin ol.

### 5. Veriyi kopyala

pg_dump / pg_restore **18** (sunucunun ana sürümü) gerekir:

```bash
pg_dump "$NEON_URL" --data-only --no-owner --no-privileges \
  --exclude-table=_migrations -Fc -f veri.dump
PGSSLROOTCERT=coolify-ca.crt pg_restore --data-only --no-owner \
  --disable-triggers -d "$COOLIFY_URL" veri.dump
```

`--disable-triggers` yabancı anahtar sırasını ve üye başına tavan
tetikleyicilerini (`app_pending_order_cap`, ...) yükleme sırasında
devre dışı bırakır; Coolify'ın `laffogato` kullanıcısı süper kullanıcı
olduğu için yeterlidir. libpq IP ile bağlanınca sertifikada IP SAN arar;
yoksa `$COOLIFY_URL`'de `sslmode=verify-ca` kullan (zincir yine
doğrulanır, yalnız bu tek seferlik komut için).

Sıralar (`next_seq()` sayaçları) tablo verisidir, kopyayla gelir. Ayrıca
Postgres `SEQUENCE` kullanılıyorsa değerlerini kontrol et:

```sql
select sequencename, last_value from pg_sequences where schemaname = 'public';
```

### 6. Satır sayılarını karşılaştır

İki tarafta aynı sorgu:

```sql
select 'orders' t, count(*) from orders union all
select 'order_items (orders.items)', coalesce(sum(jsonb_array_length(items)), 0) from orders union all
select 'customers', count(*) from customers union all
select 'products', count(*) from products union all
select 'menu_items', count(*) from menu_items union all
select 'settings', count(*) from settings union all
select 'karaoke_reservations', count(*) from karaoke_reservations union all
select 'payment_transactions', count(*) from payment_transactions union all
select 'audit_logs', count(*) from audit_logs union all
select 'loyalty_stamps', count(*) from loyalty_stamps
order by 1;
```

Şemada ayrı bir `order_items` tablosu yok: satırlar `orders.items`
JSONB'sindedir, yukarıdaki toplam onları sayar. `loyalty_*` bugün yalnız
`loyalty_stamps` (`\dt loyalty*` ile kontrol et). Ayrıca son yazımları
karşılaştır: `select max("createdAt") from orders;`. Bir fark varsa geçişi
durdur.

### 7. Cutover (tek atomik değişiklik seti)

- Vercel → `DATABASE_URL` = Coolify dizesi, `DATABASE_SSL_CA` = CA PEM,
  gerekiyorsa `DATABASE_SSL_SERVERNAME` (Production, Preview ayrı karar).
- `src/lib/legal/entity.ts`: `dbProvider` ve `dbRecipient` (aşağıda
  "Hukuk metni"), **aynı deploy'da**.
- `DATABASE_URL_UNPOOLED`, `POSTGRES_*` (Neon entegrasyonu yazdıysa) koddan
  okunmaz; kafa karıştırmasın diye cutover'dan bir hafta sonra sil.
- Redeploy (yeni deployment boş Data Cache ile başlar).

### 8. Doğrulama kapısı ("sayfa açılıyor" YETMEZ)

Sağlık katmanı DB hatasında paket veriye düştüğü için site, veritabanına
bağlanamazken de ayakta görünür
([SUPABASE-GECIS.md](SUPABASE-GECIS.md) §4/6):

- Vercel fonksiyon loglarında bağlantı / TLS hatası yok,
- `/api/health` `ok`,
- `/admin/giris` ile giriş yapılabiliyor,
- bir test siparişi `/admin/siparisler`'de görünüyor,
- `/api/mobile/v1/app-content` panelden az önce yapılan bir düzenlemeyi
  yansıtıyor.

Dördü geçmeden Neon'a dokunma. Sonra mağazayı aç.

### 9. Yedek (Coolify, operatör)

Coolify → `laffogato-pg` → Backups: S3 Storages'a `laffogato-yedek`
(R2, özel, yedek anahtarı) ekle; **saatlik** zamanlama (`0 * * * *`),
saklama örn. 48 saatlik + 30 günlük. Bir **geri yükleme testi** yap:
yedeği boş bir Postgres'e (yerel ya da geçici Coolify veritabanı)
`pg_restore` ile yükle ve 6. adımdaki sayıları karşılaştır. Test edilmemiş
yedek yedek değildir.

### 10. Söküm (en az bir hafta sonra)

Neon projesini sil, organizasyonu Free plana indir. `NEON_API_KEY`,
`NEON_PROJECT_ID`, `NEON_CU_HOURS_LIMIT` Vercel'den silinir (kart grileşir
ve panoda çizilmez). Kodda kaldırılacak bir şey yok.

## Geri dönüş

Vercel'de `DATABASE_URL`'i Neon'a geri al ve `dbProvider` / `dbRecipient`'i
geri çevir, redeploy. `DATABASE_SSL_CA`'yı silmek gerekmez (sistem
köklerinin yanına eklenir). Cutover'dan sonra Coolify'a yazılan satırlar
Neon'da yoktur: geri dönüş ilk saatlerde yapılır ya da o satırlar elle
taşınır.

## Hukuk metni (operatör onayı gerekir)

`{{DB_PROVIDER}}` 35 pasajda, `{{DB_RECIPIENT}}` KVKK Aydınlatma §15'te
geçer (`src/lib/legal/entity.ts`). Önerilen değerler (talimat, 26 Kas 2026):

```ts
dbProvider: "Vultr (The Constant Company, LLC, ABD; sunucu: Frankfurt, Almanya)",
dbRecipient: "The Constant Company, LLC (Vultr); ABD; sunucu bölgesi Almanya, Frankfurt",
```

Dikkat:

- `dbProvider` cümle içinde ad olarak geçer ("verileriniz {{DB_PROVIDER}}
  altyapısında..."): parantezli uzun değer bazı cümlelerde ağır okunabilir.
  Kısa ad (`"Vultr"`) + ayrıntının `dbRecipient`'te durması bir seçenek.
  Kesin metni operatör seçer; değiştirmeden önce
  `grep -rn "DB_PROVIDER\|DB_RECIPIENT" src/lib/legal/content.ts` ile her
  pasajı oku.
- Sunucu AB'de (Almanya) olsa da sözleşen şirket ABD'lidir: yurt dışına
  aktarım (KVKK m.9) beyanı kalır, yalnız ülke ve şirket değişir.
- Coolify bir yazılımdır, veri işleyen değildir; alıcı Vultr'dur. Yedekler
  Cloudflare R2'de (`laffogato-yedek`) durursa Cloudflare da bir alıcıdır:
  metinlerde Cloudflare zaten geçiyorsa (CDN / e-posta) kapsamı kontrol et,
  geçmiyorsa ekle. Fotoğraf kovası kişisel veri taşımaz (ürün fotoğrafı).
- Bu bir hukuk revizyonudur: `LEGAL_UPDATED` ve onay sürümü kuralları
  (`docs/LEGAL-REDLINES-2026-09.md`) geçerlidir. Değer, verinin fiilen
  taşındığı deploy'da değişir; önce değil, sonra değil.

## Riskler

- **Tek makine:** disk ya da sunucu arızasında son yedeğe kadar veri gider.
  Saatlik yedek bunu bir saate indirir; Vultr'un sunucu yedeği
  (snapshot) ikinci bir katmandır.
- **Bağlantı sayısı:** bir trafik sıçramasında çok sayıda sıcak Vercel
  örneği `max_connections`'ı doldurabilir. Belirti: "sorry, too many
  clients already" (SQLSTATE 53300; sağlık katmanı bunu kesinti sayar ve
  genel sayfalar paket veriye düşer). Çözüm: Coolify'da PgBouncer
  (transaction mode) ve `DATABASE_URL`'i ona çevirmek.
- **Bakım:** Postgres küçük sürüm güncellemeleri, disk doluluğu ve
  `autovacuum` artık bizim işimiz (Coolify → Server metrics).
