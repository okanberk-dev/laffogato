# Veritabanı — Neon (serverless Postgres)

Proje **Neon** üzerinde çalışır. Daha önce Supabase kullanılıyordu; Supabase'in
ücretsiz planı organizasyon başına **2 aktif proje** ile sınırlı olduğu ve iki
slot da başka projelerde dolu olduğu için Laffogato'nun projesi kaldırılmıştı —
canlı sitedeki toplu HTTP 500'lerin sebebi buydu.

Neon'un ücretsiz planı **proje başına** kota verir ve limitlere takılmak veriyi
silmez (Neon'un kendi ifadesiyle: _"None of these limits delete your data."_),
yani aynı arıza tekrarlanamaz.

## Kurulum (tek seferlik)

> **Sıra önemli: önce şemayı kur, sonra `DATABASE_URL`'i Vercel'e ekle.**
> Uygulama "tablo yok" hatasını (SQLSTATE `42P01`) *gerçek* bir hata sayar ve
> haklı olarak 500 döndürür — bu bilinçli bir tercih, çünkü şema hatasını
> yedek veriyle gizlemek işi daha da kötüleştirir. Boş bir veritabanına
> bağlanmak siteyi bozar; hiç bağlanmamak bozmaz (pakete düşer). Yani şema
> hazır olmadan env değişkenini eklemeyin.

1. **Neon projesi aç** — <https://neon.com> → yeni proje.
   - **Bölge olarak bir AWS bölgesi seç** (ör. `AWS us-east-2` ya da
     `eu-central-1`). Bu önemli: Neon'un kullanımdan kaldırılan Azure
     bölgelerinde 90 gün hareketsiz kalan ücretsiz projeler silinebiliyor; AWS
     bölgeleri bu politikanın dışında.

2. **Connection string'i kopyala** — Neon panelinde *Connection Details*.
   Sonu `-pooler` ile biten **pooled** endpoint'i kullan; serverless
   fonksiyonlar için doğru olan odur.

3. **Şemayı kur.** İki yol var, ikisi de aynı sonucu verir:

   **a) Komut satırından (tercih edilen):**

   ```bash
   DATABASE_URL='postgresql://...-pooler.../neondb?sslmode=require' npm run db:migrate
   ```

   `db/migrations/*.sql` dosyalarını sırayla, her dosyayı tek transaction içinde
   uygular ve uygulananları `_migrations` tablosunda tutar. Tekrar çalıştırmak
   güvenlidir.

   **b) Neon SQL Editor'dan:** `db/schema.sql` dosyasının tamamını kopyalayıp
   Neon panelindeki SQL Editor'a yapıştır ve çalıştır. Bu dosya tüm
   migration'ların sıralı birleşimidir ve uygulananları `_migrations`'a
   yazdığı için sonradan `npm run db:migrate` çalıştırmak sorunsuzdur.
   (Dosya üretilir: `npm run db:bundle`.)

   Ağ kısıtı olan bir ortamdan Neon'a erişemiyorsanız (b) yolunu kullanın.

4. **Vercel'de env değişkenini ayarla** — Vercel → proje → Settings →
   Environment Variables:

   | Değişken | Değer | Ortam |
   |----------|-------|-------|
   | `DATABASE_URL` | Neon pooled connection string | Production + Preview |

   Eski `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY` değişkenlerini **sil** —
   artık okunmuyorlar.

5. **Yeniden deploy et.** İlk istekte tablolar boşsa uygulama kendini idempotent
   şekilde seed eder. Sitedeki "canlı verilere ulaşamıyoruz" bandı kaybolursa
   bağlantı çalışıyor demektir.

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

## Veritabanı ulaşılamazsa ne oluyor

Eski davranış: tek bir bağlantı hatası **her sayfayı HTTP 500** yapıyordu.
Üretimde bu bir ay sürdü. Artık genel (public) sayfalar pakette gelen içerikle
ayakta kalır; ticari yollar ise sesli şekilde başarısız olur.

Ayrım `src/lib/db/health.ts` içinde yapılır ve tek bir sinyale dayanır:
Postgres'e ulaşan her hata bir **SQLSTATE** taşır. SQLSTATE yoksa istek hiç
ulaşmamıştır (`status: 0`, boş `code`) — yalnız bu durum bozulmaya (degrade)
uygundur. Hatalı kolon, kısıt ihlali, kimlik doğrulama reddi gibi gerçek hatalar
**maskelenmez**, eskisi gibi hata verir.

| Alan | Ulaşılamazken |
|------|---------------|
| Ana sayfa, hikaye, ziyaret, reels | Pakette gelen içerikle render edilir |
| Kafe menüsü | Yapı gösterilir, **fiyatlar `—`** (bayat fiyat göstermek yerine) |
| Mağaza | **Boş** — asla paketteki kurgusal ürünlere düşmez |
| Ürün detay | "Şu an gösteremiyoruz" (404 değil — gerçek URL'ler deindekslenmesin) |
| Yasal metinler | Paketteki asıl metin (DB yalnız override tutar) |
| Ayarlar | Varsayılanlar, **`isShopOpen: false`** |
| Ödeme | "Şu an sipariş alamıyoruz" kapısı |
| Üye oturumu | Çıkış yapmış sayılır (fail-closed) |
| Admin panel, tüm mutasyonlar, webhook | **Hata verir** — bozulma yok |

Ziyaretçiye durumu açıklayan bir bant gösterilir; ayrıca her düşüş
`[db-degraded]` etiketiyle sunucu loglarına yazılır, böylece arıza görünmez
kalmaz.

**Bu davranışı genişletirken kural:** `publicRead()` yalnızca salt-okunur,
sunumsal veriler için kullanılır. Bir fiyat, stok, yetki ya da siparişin
verilebilir olup olmadığı **asla** yedek veriden karar bağlanmaz.

Seed yardımcıları artık reddedilen promise'i önbelleğe almıyor
(`memoizeUntilRejected`): eskiden tek bir hata o sunucu örneğini kalıcı olarak
bozuyor, düzelme için yeniden deploy gerekiyordu.
