# Veritabanı — Neon (serverless Postgres)

Proje **Neon** üzerinde çalışır. Daha önce Supabase kullanılıyordu; Supabase'in
ücretsiz planı organizasyon başına **2 aktif proje** ile sınırlı olduğu ve iki
slot da başka projelerde dolu olduğu için Laffogato'nun projesi kaldırılmıştı —
canlı sitedeki toplu HTTP 500'lerin sebebi buydu.

Neon'un ücretsiz planı **proje başına** kota verir ve limitlere takılmak veriyi
silmez (Neon'un kendi ifadesiyle: _"None of these limits delete your data."_),
yani aynı arıza tekrarlanamaz.

## Kurulum (tek seferlik)

1. **Neon projesi aç** — <https://neon.com> → yeni proje.
   - **Bölge olarak bir AWS bölgesi seç** (ör. `AWS eu-central-1 / Frankfurt`).
     Bu önemli: Neon'un kullanımdan kaldırılan Azure bölgelerinde 90 gün
     hareketsiz kalan ücretsiz projeler silinebiliyor; AWS bölgeleri bu
     politikanın dışında.
   - Postgres 17 varsayılanı uygundur.

2. **Connection string'i kopyala** — Neon panelinde *Connection Details*.
   Sonu `-pooler` ile biten **pooled** endpoint'i kullan; serverless
   fonksiyonlar için doğru olan odur.

3. **Şemayı kur:**

   ```bash
   DATABASE_URL='postgres://...-pooler.../neondb?sslmode=require' npm run db:migrate
   ```

   `db/migrations/*.sql` dosyalarını sırayla, her dosyayı tek transaction içinde
   uygular ve uygulananları `_migrations` tablosunda tutar. Tekrar çalıştırmak
   güvenlidir.

4. **Vercel'de env değişkenini ayarla** — Vercel → proje → Settings →
   Environment Variables:

   | Değişken | Değer | Ortam |
   |----------|-------|-------|
   | `DATABASE_URL` | Neon pooled connection string | Production + Preview |

   Eski `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY` değişkenlerini **sil** —
   artık okunmuyorlar.

5. **Yeniden deploy et.** İlk istekte tablolar boşsa uygulama kendini idempotent
   şekilde seed eder.

Alternatif olarak Vercel Marketplace'teki **Neon** entegrasyonu da kurulabilir;
o `DATABASE_URL`'i otomatik enjekte eder.

## Veri katmanı nasıl çalışıyor

Veri erişimi tamamen **server-only**. Bağlantı `src/lib/db/index.ts` içinde
tembel (lazy) bir singleton olarak kurulur — `next build` canlı kimlik bilgisi
olmadan da çalışır.

Kod, Supabase'in PostgREST sorgu kurucusuna göre yazılmıştı (~122 çağrı noktası,
sipariş/stok/ödeme yolları dahil). Bunları elle SQL'e çevirmek yerine aynı
arayüzü koruyan ince bir uyumluluk katmanı yazıldı:

| Dosya | Sorumluluk |
|-------|-----------|
| `src/lib/db/sql.ts` | Saf SQL derleyici — QuerySpec → parametreli SQL. Tanımlayıcılar katı bir desene karşı doğrulanır, değerler **her zaman** parametre olarak bağlanır. |
| `src/lib/db/client.ts` | `.from().select().eq()...` zinciri, PostgREST sonuç şekliyle (`{ data, error, status, count }`). |
| `src/lib/db/index.ts` | Neon HTTP sürücüsü + `getDb()` + `TABLES`. |
| `src/lib/db/counters.ts` | `next_seq()` ile atomik sıra üretimi. |

Korunan davranışlar (çağrı noktaları bunlara bağlı):

- Hatalar **fırlatılmaz, döndürülür** (`res.error`).
- `error.code` Postgres SQLSTATE'ini taşır — ödeme webhook'undaki ve müşteri/
  kupon kayıtlarındaki `23505` (unique violation) dalları çalışmaya devam eder.
- Mutasyonlar satır döndürmez; yalnız `.select()` zincirlenirse döndürür.
- Ulaşılamayan veritabanı `status: 0` + boş `code` olarak raporlanır — bu,
  "veritabanı kapalı" ile "sorgu reddedildi" ayrımını mümkün kılar.

Bu katmanın tamamı veritabanı olmadan test edilir: `tests/db-sql.test.ts` ve
`tests/db-client.test.ts` (45 test) üretilen SQL'i ve sonuç semantiğini doğrular.

## Yeni migration

`db/migrations/YYYYMMDDHHMMSS_aciklama.sql` oluştur, sonra `npm run db:migrate`.
Detay için `new-migration` skill'i.

## Yedek

Ücretsiz planda otomatik yedek sınırlıdır. Düzenli olarak:

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%F).sql
```
