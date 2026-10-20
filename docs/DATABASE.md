# Veritabanı - Postgres (Neon)

> **Durum (23 Eyl 2026):** canlı veri **Neon**'dadır ve varsayılan orada
> kalmaktır. 30 Ağu 2026'da veriyi mobil uygulamanın kimlik için kullandığı
> Supabase projesine taşıma hedefi yazılmıştı; 2 Eyl 2026'dan beri iki depo
> da Supabase'i **yalnız kimlik** için kullanır ve veri kararı "Neon, tek
> kaynak"tır (lafmobil `docs/INFRA.md` §1). Taşıma yalnız operatör açıkça
> isterse ve aşağıdaki ön koşul (ücretli plan ya da kalıcı proje slotu)
> yazılı olarak doğrulanırsa yapılır; çalıştırılabilir yordam
> **[SUPABASE-GECIS.md](SUPABASE-GECIS.md)**. Hukuki belgeler gerçeği söyler:
> `dbProvider` bugün `"Neon"` (aşağıda "Sağlayıcı adı" bölümü).

Proje **yönetilen bir Postgres** üzerinde çalışır. Kodda sağlayıcıya özel
bağımlılık yoktur; taşınma bağlantı dizesini değiştirmekten ibarettir.

## ⚠️ Sağlayıcı geçmişi - okumadan taşıma yapma

Bu proje **daha önce Supabase'deydi ve oradan taşındı.** Sebep bir tercih
değil, bir kesintiydi:

> Supabase'in ücretsiz planı organizasyon başına **2 aktif proje** ile
> sınırlıdır. İki slot da başka projelerle doluyken L'Affogato'nun projesi
> kaldırıldı; canlı sitedeki toplu HTTP 500'lerin ve **bir aylık kesintinin**
> sebebi buydu.

Neon'un ücretsiz planı **proje başına** kota verir ve limitlere takılmak veriyi
silmez (Neon'un kendi ifadesiyle: _"None of these limits delete your data."_),
yani aynı veri kaybı Neon'da tekrarlanamaz. **Ama erişim kesilebilir:** Free
planda proje başına ayda 100 CU-saat hesaplama var; dolunca compute bir sonraki
fatura dönemine kadar askıya alınır (https://neon.com/docs/introduction/plans).
19 Eki 2026 ölçümü: 1-19 Ekim arası 70,2 CU-saat, yani ay sonu tahmini ~117;
açık bir admin sekmesi (yeni sipariş zili) Neon'u açılış saatlerinde uyanık
tutuyor ve Neon 5 dakikalık boşta kalmadan önce uyumadığı için yoklama aralığını
uzatmak bunu çözmüyor. Eylül'de veritabanı 29 Eyl 22:21 UTC'den 1 Eki 00:00
UTC'ye kadar kapalı kaldı (büyük ihtimalle aynı kota). Kalıcı çözüm Neon'un
kullanım başına ücretli planı (Launch, aylık asgari ücret yok; azami ölçek
0,25 CU ile ayda ~15-20 $).

**Supabase'e geri dönmek isteniyorsa** - ki mobil uygulamayla ortak kimlik için
iyi bir sebep var - geçişten önce şunun yazılı olarak doğrulanması gerekir:

1. Hedef Supabase organizasyonu **ücretli planda** mı, yoksa
2. Ücretsiz plandaysa, o organizasyonda **boş proje slotu** var mı ve
   L'Affogato'nun projesi başka bir proje uğruna kaldırılmayacak mı?

Bu doğrulanmadan taşıma, siteyi bir kez daha aynı şekilde kapatır. Karar
operatöründür; bu belge yalnızca bedelin ne olduğunu kayda geçirir.

## Önizleme deployment'ları kapalı (19 Eki 2026)

Vercel'deki Neon entegrasyonu her önizleme deployment'ı için `preview/<dal>`
adında bir Neon dalı açıyor ve deployment'ı o dalın bağlantısıyla bir kez daha
tetikliyordu. Ücretsiz planlarda bu iki sınırı birden dolduruyordu: Neon'da
proje başına 10 dal, Vercel Hobby'de günde 100 deployment (19 Eki 2026'da
doldu; kota dolunca `main`'in production deployment'ı da bekler). Bu yüzden
`vercel.json` `git.deploymentEnabled` iş dallarını (`feat/**`, `fix/**`,
`docs/**`, `chore/**`, `test/**`, `refactor/**`, `claude/**`) deploy etmez;
yalnız `main` production'a gider. Bir dalın önizlemesi gerekirse
`vercel deploy` ile elle açılır ve işi bitince `preview/*` Neon dalı silinir
(`production` ve `vercel-dev` dalına dokunulmaz).

## Uyanmalar ve önbellek (19 Eki 2026)

**Ölçülen sebep.** Neon Free planda compute 5 dakika boşta kalınca uyur ve
her istek onu yeniden uyandırır; uyanık geçen her dakika CU-saat yazar.
1-19 Ekim: 70,2 CU-saat (19 Eki 15:05 UTC), günde ~92 uyanma, compute
zamanın ~%57-59'unda açık (12-19 Ekim ortalaması günde ~14,7 saat) ve
dağılım 24 saate neredeyse düz yayılmış: Tuzla saatiyle 02:00-08:00 arası
günde ~2,4 saat açık, bu uyanmaların %67-77'si tek istekli (biri gelir,
compute 5 dakika açık kalır, kimse gelmez). Gece müşteri yok; uyandıran
tarayıcılar ve botlar. Her genel sayfa `force-dynamic` ve her görüntüleme
ayarları, menüyü, ürünleri veritabanından okuyordu. Gündüz ayrıca açık bir
panel sekmesi (yeni sipariş zili 10 sn'de bir, kenar çubuğu rozetleri
60 sn'de bir, sipariş listesi 30 sn'de bir) Neon'u açık tutuyor; 5 dakikanın
altındaki her aralık aynı sonucu verir. Production endpoint'i
(`ep-plain-cake-ay3dvcuq`) 19 Eki'de 0,25 CU'ya sabitlendi (min = max).
İstek dökümü doğrulanamadı: Vercel Hobby istek logu tutmaz.

**Ne değişti.**

1. **Yazma, etkilediği önbelleği hemen düşürür** (`src/lib/cache/tags.ts`).
   Veri katmanı (`getDb()`) gönderdiği her insert, upsert, update, delete
   ve rpc'den sonra ilgili etiketi `revalidateTag(tag, { expire: 0 })` ile
   düşürür: bir sonraki okuma taze veriyi bekler, bayat veri hiç sunulmaz.
   Hata dönen yazma da düşürür: Postgres kaydı işleyip bağlantı cevaptan
   önce koparsa çağıran hata görür ama yeni fiyat tablodadır; fazladan bir
   düşürme bir okuma, eksik bir düşürme bir günlük bayat fiyat demektir.
   Altı etiket: `pub:catalog` (ürün ve kategori: mağaza, ürün kartları,
   site haritası), `pub:menu` (menü kalemleri; mağazanın stok hareketi
   menüyü düşürmesin diye ayrı), `pub:site` (ayarlar,
   site metinleri, basın, hikaye, vitrin ve ana sayfa slaytları, uygulama
   içerikleri, hukuk override'ları, canlı durum), `live:orders`,
   `live:karaoke`, `live:access` (panel hesapları, `admin_users`: önbellekte
   okunan bir şey yok, yalnız panelin değişiklik işaretleri taşır; madde 3).
   Her tablo ve `db/schema.sql`'deki her fonksiyon bu dosyada
   sınıflandırılmıştır; yeni bir tablo ya da fonksiyon
   `tests/cache-write-tags.test.ts`'i kırar, sınıflandırılmamış bir rpc
   bütün etiketleri birden düşürür. Bir fonksiyonun etiketleri gövdesinin
   yazdığı tabloların ve çağırdığı fonksiyonların etiketleridir; aynı test
   `db/schema.sql`'i okur, eksik (bayat veri) ya da fazla (boşuna uyanma)
   etiketi reddeder: iade, satır durumu ve cüzdan siparişi yalnız
   `live:orders`, stok hareketi kaydı (`record_stock_move`) hiçbirini
   düşürmez. Her yazma etiketi bir kez daha, yanıt çıktıktan
   sonra `after()` ile ayrı bir istekle düşürür (`SECOND_EXPIRY`): Next
   düşürmeleri sıraya alır ve sırayı route handler ancak bir Response
   döndürünce ya da yönlendirince gönderir. Yazdıktan sonra hata fırlatan
   bir handler'da (ödeme dönüşü, uygulama ucu, cron) ilk istek hiç gitmez,
   `after()` yine çalışır (`tests/cache-expire-retry.test.ts` bunu Next'in
   kendi koduyla dener). Render sırasında (Next E7) yalnız ikincisi vardır.
2. **Genel sayfaların sunum okumaları Data Cache'ten gelir**
   (`src/lib/cache/presentation.ts`, `src/lib/seo/site-data.ts`;
   `unstable_cache`, Vercel'de bölgesel Runtime Cache). Anahtar deployment'ı
   ve son migration'ı içerir: her deploy boş önbellekle başlar. Kayıt yazma
   gelene kadar geçerlidir; 24 saatlik `revalidate` yalnız görülmemiş bir
   yazmaya karşı emniyet ağıdır. Kapsam: `/`, `/menu`, `/magaza`,
   `/hikayemiz`, `/ziyaret` (`loadAppProps`), `/menu/<kategori>`,
   `/magaza/<kategori>`, `/magaza/urun/<slug>` ve kartı, `/ziyaret` kartı,
   `/kampanyalar`, `/hukuk` ve `/hukuk/<slug>` gösterimi, `/rehber` ve
   `/uye` çerçevesi, 404, `robots.txt`, `sitemap.xml`, iki `.well-known`
   belgesi, `/masa/<kod>`'un menü kısmı. Saate bağlı her şey (bugünün
   saatleri, yayın aralıkları, ana sayfa slaytı, mağazadaki indirimin "eski
   fiyatı": önbellekte indirimin günleri durur, gösterilip gösterilmeyeceği
   her istekte `liveDiscount` ile karar bağlanır) istek başına hesaplanır.
   Ayarlar önbelleğe personel bildirim alıcıları boşaltılarak yazılır.

   **Etiket düşürmeyen yazmalar.** Bu kancayı taşımayan bir koddan gelen her
   yazma: (a) Neon konsolunda elle SQL ve `scripts/*.mjs`; (b) production
   `DATABASE_URL`'iyle çalışan `npm run dev` ya da `vercel dev` (yerel
   sunucu yalnız kendi önbelleğini düşürür); (c) Instant Rollback: geri
   dönülen deployment'ta yapılan kayıtlar "Undo Rollback" ile dönen
   deployment'ın kayıtlarını düşürmeyebilir, bu değişiklikten önceki bir
   deployment hiç düşürmez; (d) bu değişikliğin ilk deploy'unda, promote
   anında eski deployment'ta süren istekler (en uzunu 300 sn: kampanya
   gönderimi, CSV içe aktarma; ödeme dönüşü, stok iadesi). Panelden yapılan
   bir kayıt yalnız kendi etiketini düşürür. Bunlardan sonra (her rollback
   ve undo rollback sonrası, ilk deploy'dan 5 dakika sonra bir kez de)
   bütün etiketleri elle düşür:

   ```bash
   vercel cache dangerously-delete --tag pub:catalog,pub:menu,pub:site,live:orders,live:karaoke,live:access --yes
   ```

   `invalidate` değil: o bayat kaydı bir kez daha sunar. Yeniden deploy da
   yeter (yeni deployment boş önbellekle başlar); `LAF_DATA_CACHE=off` da
   ancak yeni bir deploy'la devreye girer. Aksi halde eski fiyat ve stok
   24 saat, ardından bir istek daha görünür; veritabanı kapalıysa
   yenilenemeyen kayıt kapalı kaldığı sürece görünür.

3. **Yeni sipariş zili değişiklik yokken veritabanına gitmez**
   (`/admin/siparisler/uyari`, `src/lib/admin/change-marker.ts`): her
   `orders` yazması Data Cache'teki bir değişiklik işaretini yeniler; işaret
   aynıyken cevap `{ unchanged: true }`, veri ve veritabanı yok. Köşk açıkken
   en az saatte bir tam cevap. İşaret `admin_users` yazmalarında da
   yenilenir (`live:access`) ve imleç onu alan oturum çerezine bağlıdır:
   pasifleşen, rolü düşen ya da parolası sıfırlanan oturum bir sonraki
   soruda hesabı yeniden okutur ve reddedilir (kural 30). Ayrıntı
   `docs/ADMIN.md` "Yeni sipariş uyarısı".
4. **Panel rozetleri ve sipariş listesinin sayacı da** aynı işaretlerle
   (`orders`, `karaoke_reservations`) değişiklik yokken veritabanına gitmez
   (`src/lib/admin/panel-signal.ts`); görünür bırakılan bir kasa ekranı artık
   Neon'u bütün gece uyanık tutmaz.

**Önbelleğe girmeyenler (bilerek).** Fiyat, stok, yetki ve siparişin
verilebilirliği hiçbir zaman önbellekten karar bağlanmaz: `/odeme` (layout,
sayfa, action'lar), `/karaoke`, `/rezervasyon`, `placeOrder` /
`placeAppOrder`, `/api/mobile/v1/**` (başlıklar ve okuyucular aynı,
`docs/API-MOBILE.md` değişmedi), e-postalar, onay sürümleri
(`checkoutConsentVersion`, `karaokeConsentVersion`), ödeme belgeleri, admin
sayfaları ve admin oturumu canlı okur. Onay alınan üç belgenin `/hukuk`
sayfası da canlıdır (Ön Bilgilendirme Formu, Mesafeli Satış Sözleşmesi,
karaoke odası şartları): siparişin ya da rezervasyonun kaydettiği onay
sürümü hangi satırdan çıkıyorsa yeni sekmede açılan metin de o satırdır;
kaybolmuş bir etiket düşürmesi müşteriye kaydedilenden eski bir metni
gösteremez. `tests/site-data-cache.test.ts` bu yolların önbellek
okuyucularını içe aktarmadığını tutar. `/masa/<kod>`'un
masa araması ve `/api/health` da canlıdır.

**Kesinti davranışına etkisi.** Önbellekte kaydı olan bir sayfa veritabanı
kapalıyken son bilinen gerçek içeriği gösterir ve kesinti bandı çıkmaz;
kaydı olmayan sayfa eskisi gibi paketteki içeriğe düşer (o yedek hiçbir
zaman önbelleğe yazılmaz, `publicRead` dış çağrıdır). Mağaza "bozulmada
boş kalır": isteğin kendisi veritabanını kapalı gördüyse (giriş yapmış
üyenin hesabı her sayfada canlı okunur, ya da önbellekte kaydı olmayan bir
okuma düştü) liste önbellekten gelse de mağaza boş ve bant görünür
(`shopForRequest`; `loadAppProps` ve iki kategori sayfası;
`tests/site-data-outage-shop.test.ts`). Satın alabilecek tek ziyaretçi
üyedir, yani satın almaya çalışan herkes kesintiyi görür. Hiçbir şeyi canlı
okumayan anonim bir istek kesintiyi bilemez: son bilinen gerçek ürünleri
bantsız gösterir. Bu, kuralın harfinden kalan tek ayrışmadır ve
veritabanını uyandırmadan kapatılamaz; ödeme sayfası ayarları canlı okur ve
"Şu an sipariş alamıyoruz" der, ödeme fiyatı veritabanından yeniden okur ve
stoğu SQL'de ayırır, yani kimse bu listeden satın alamaz; ödeme, karaoke ve
uygulama siparişleri yine sesli başarısız olur. Bu kalan ayrışma operatörün
onayına sunulmuştur (CLAUDE.md değiştirilmedi).

**Kapatma anahtarı.** `LAF_DATA_CACHE=off` (Vercel env) her sunum okumasını
eskisi gibi veritabanına gönderir. Önbellek hata verirse ya da kaydı
düşürürse okuma veritabanına gider: daha çok compute, asla yanlış veri.

**Yeniden ölçmek** (salt okunur; `NEON_API_KEY` operatörde):

```bash
# Dönemin toplamları: compute_time_seconds / 3600 = CU-saat,
# active_time_seconds / 3600 = açık saat
npx neonctl projects get misty-cell-35394291 -o json

# Production endpoint'inin uyanmaları, Tuzla saatine göre (son 1000 işlem;
# daha eskisi için yanıttaki pagination.cursor ile ?cursor= ver)
curl -s -H "Authorization: Bearer $NEON_API_KEY" \
  "https://console.neon.tech/api/v2/projects/misty-cell-35394291/operations?limit=1000" |
  jq -r '.operations[]
    | select(.action == "start_compute" and .endpoint_id == "ep-plain-cake-ay3dvcuq")
    | .created_at | sub("\\.[0-9]+"; "") | fromdateiso8601 + 10800 | strftime("%d %H")' |
  sort | uniq -c
```

Hedef (deploy'dan sonraki 48 saat): 02:00-08:00 arası saatte en çok bir
uyanma; günde 9 saatin altında açık kalma (kalan bütçe 29,8 CU-saat / 12
gün, 0,25 CU'da günde ~9,6 saat). Bir panel kaydı bir sonraki sayfa
yüklemesinde görünmelidir. Ölçüm 9 saatin üstünde kalırsa çözüm Neon Launch
planıdır (ayda ~12-15 $).

## Supabase'e geçiş yordamı

Adım adım, ölçülmüş tuzaklarıyla (IPv6-yalnız doğrudan uç, pooler dizesi,
RLS-baypas doğrulaması, bcrypt içe aktarımı): **[SUPABASE-GECIS.md](SUPABASE-GECIS.md)**.

## Sağlayıcı adı hukuki belgelerde geçer

Sağlayıcının adı KVKK aydınlatma metni, gizlilik politikası, çerez politikası
ve veri işleyen listesi dâhil **35 hukuki pasajda** geçer. Bunlar bağlayıcı
beyandır. Bu yüzden ad düz metin değil, `{{DB_PROVIDER}}` token'ıdır ve tek
kaynağı `src/lib/legal/entity.ts` içindeki `dbProvider` alanıdır.

**Bu alan gerçeği izlemelidir.** Veri fiilen taşınmadan değeri değiştirmeyin:
belgede "Supabase" yazarken verinin Neon'da durması yanlış hukuki beyandır.
Taşıma sırasında `dbProvider` ile `DATABASE_URL` **aynı anda** değişir.

## Sürücü seçimi - neden `pg`

Veri katmanı, sağlayıcıya özel bir SDK yerine standart `pg` sürücüsünü
kullanır. Supabase'in Supavisor pooler'ı da, eski sağlayıcının pooled
endpoint'i de normal Postgres wire protokolü konuşur; aynı kod yerel bir
Postgres'te de çalışır.

Bunun iki somut faydası var:

1. **Taşınabilirlik.** Bu sitenin bir ay boyunca kapalı kalmasının sebebi,
   verinin tek bir sağlayıcının istemcisinin ve hesap limitinin arkasında
   olmasıydı. Artık taşınma, bağlantı dizesini değiştirmekten ibaret.
2. **Test edilebilirlik.** Sorgu katmanı gerçek bir Postgres'e karşı
   sınanabiliyor (`tests/db-integration.test.ts`) - JSONB gidiş-dönüşü,
   `on conflict` davranışı, SQLSTATE'ler ve fonksiyon çağrıları dâhil.

## Kurulum (tek seferlik)

> **Hangi sağlayıcı için:** aşağıdaki adımlar Supabase hedefi için
> yazılmıştır (taşıma kararı verilirse). Bugünkü Neon kurulumunda Neon
> panosundaki **pooled** (`-pooler`) bağlantı dizesi `DATABASE_URL`'e konur,
> `DATABASE_SSL_CA` boş kalır (yalnız Supabase host'larında uygulanır); şema
> adımı (4) ve env sırası aynıdır.

> **Sıra önemli: önce şemayı kur, sonra `DATABASE_URL`'i Vercel'e ekle.**
> Uygulama "tablo yok" hatasını (SQLSTATE `42P01`) _gerçek_ bir hata sayar ve
> haklı olarak 500 döndürür - bu bilinçli bir tercih, çünkü şema hatasını
> yedek veriyle gizlemek işi daha da kötüleştirir. Boş bir veritabanına
> bağlanmak siteyi bozar. Yani şema hazır olmadan env değişkenini eklemeyin.
> `DATABASE_URL`'i silmek de bir geri dönüş yolu değildir: değişken yoksa
> site pakete düşmez, yapılandırma hatası verir (aşağıda "Bağlantı dizesi
> yalnız `DATABASE_URL`").

1. **Plan/slot doğrula** - hedef Supabase organizasyonu için
   [SUPABASE-GECIS.md §0](SUPABASE-GECIS.md) ön koşulunu geç. Bu adım
   atlanamaz: aynı sınır bu siteyi bir kez bir ay kapattı.

2. **Transaction pooler dizesini kopyala** - Supabase paneli → Project
   Settings → Database → Connection string → **"Transaction pooler"**
   (`postgresql://postgres.<ref>:<şifre>@aws-0-<bölge>.pooler.supabase.com:6543/postgres?sslmode=require`).

   **"Direct connection" dizesini KULLANMA:** o uç yalnızca IPv6 yayınlıyor ve
   Vercel fonksiyonları IPv6'ya çıkamıyor - hata "yanlış şifre" gibi değil,
   zaman aşımı gibi görünür (ölçüm: SUPABASE-GECIS.md §2).

3. **CA sertifikasını indir** - aynı sayfada SSL Configuration → CA
   certificate. PEM içeriği `DATABASE_SSL_CA` değişkenine konur; Supabase'in
   zinciri kendi köküne dayandığı için bu olmadan bağlantı hiç kurulmaz
   (SUPABASE-GECIS.md §2b).

4. **Şemayı kur.** İki yol var, ikisi de aynı sonucu verir:

   **a) Komut satırından (tercih edilen):**

   ```bash
   DATABASE_SSL_CA="$(cat prod-ca.pem)" \
   DATABASE_URL='postgresql://postgres.<ref>:...@...pooler.supabase.com:6543/postgres?sslmode=require' \
   npm run db:migrate
   ```

   `db/migrations/*.sql` dosyalarını sırayla, her dosyayı tek transaction içinde
   uygular ve uygulananları `_migrations` tablosunda tutar. Tekrar çalıştırmak
   güvenlidir.

   **b) Supabase SQL Editor'dan:** `db/schema.sql` dosyasının tamamını
   kopyalayıp panelin SQL Editor'ına yapıştır ve çalıştır. Bu dosya tüm
   migration'ların sıralı birleşimidir ve uygulananları `_migrations`'a
   yazdığı için sonradan `npm run db:migrate` çalıştırmak sorunsuzdur.
   (Dosya üretilir: `npm run db:bundle`.)

5. **Vercel'de env değişkenlerini ayarla** - Vercel → proje → Settings →
   Environment Variables:

   | Değişken          | Değer                                  | Ortam                |
   | ----------------- | -------------------------------------- | -------------------- |
   | `DATABASE_URL`    | Transaction pooler dizesi (adım 2)     | Production + Preview |
   | `DATABASE_SSL_CA` | CA sertifikasının PEM içeriği (adım 3) | Production + Preview |

   `NEXT_PUBLIC_SUPABASE_*` değişkenleri bu veri katmanının konusu değildir -
   onlar kimlik (Auth) katmanına aittir ve mobil uygulama kullanır; site tarafı
   Supabase Auth'a geçtiğinde siteye de eklenirler.

6. **Yeniden deploy et ve SUPABASE-GECIS.md §4/6'daki doğrulama kapısından
   geç.** "Sayfa açılıyor" yetmez: sağlık katmanı DB hatasında pakete düşer,
   yanlış yapılandırma 500 değil "boş site" olarak görünür.

## Veri katmanı nasıl çalışıyor

Veri erişimi tamamen **server-only**. Bağlantı `src/lib/db/index.ts` içinde
tembel (lazy) bir singleton olarak kurulur - `next build` canlı kimlik bilgisi
olmadan da çalışır (derleme veritabanı okumaz; bağlantı dizesi ilk sorguda
okunur, modül yüklenirken değil).

### Bağlantı dizesi yalnız `DATABASE_URL` (20 Eki 2026)

Uygulama ve veritabanını açan iki betik (`npm run db:migrate`,
`scripts/backfill-backdrops.mjs`) bağlantı dizesini **tek bir dosyadan**
okur: `src/lib/db/database-url.mjs` (düz JavaScript, çünkü betikler
TypeScript içe aktaramaz). Kural tektir: `DATABASE_URL`, başka hiçbir şey.

Eskiden zincir `DATABASE_URL` → `POSTGRES_URL` → `SUPABASE_DB_URL` idi (betikler
`DATABASE_URL` → `POSTGRES_URL`). Supabase'in Vercel entegrasyonu
`POSTGRES_URL`'i Production'a yazar ve o dize kimlik projesinin kendi, bizim
verimizi taşımayan Postgres'ini gösterir. `DATABASE_URL` bir gün kaybolsaydı
site oraya sessizce bağlanır, boş bir şema kurar (`bootstrap.ts`) ve
siparişleri oraya yazardı. `SUPABASE_DB_URL` da taşıma yordamının bir adımı
değildir: [SUPABASE-GECIS.md](SUPABASE-GECIS.md) veriyi `DATABASE_URL`'i
değiştirerek taşır. İkisi de artık okunmaz.

`DATABASE_URL` yoksa (tanımsız, boş ya da yalnız boşluk) bu bir **kesinti
değil, yapılandırma hatasıdır** ve öyle davranır:

- Her sorgu `DATABASE_URL_MISSING` koduyla ve 500 durumuyla döner; veri katmanı
  bunu "ulaşılamıyor" saymaz (`toDbError`), yani `publicRead` paketteki içeriğe
  düşmez, sayfa hata verir. Hata mesajı eksik değişkeni ve tanımlı olup
  okunmayan adları (`POSTGRES_URL`, `SUPABASE_DB_URL`) söyler, değerlerini
  asla. Sunucu günlüğüne örnek başına bir kez `[db] DATABASE_URL tanımlı
  değil` yazılır.
- `/api/health` `db: "unconfigured"` (503) döner; `down` yalnız gerçek
  ulaşılamazlıktır.
- İki betik hiçbir yere bağlanmadan aynı mesajla çıkar (çıkış kodu 1).
- `/api/mobile/v1` bu durumda 503 `unavailable` dalına girmez, gerçek bir
  hata gibi 500 döner (sözleşmenin zaten tanıdığı durum; `docs/API-MOBILE.md`
  değişmedi).

Testler: `tests/db-connection-url.test.ts` aynı on durumu ortak kurala, veri
katmanına ve iki betiğe (gerçekten çalıştırarak; hangi adrese bağlanmaya
çalıştıklarını sayan geçici dinleyicilerle) uygular.

Kod, Supabase'in PostgREST sorgu kurucusuna göre yazılmıştı (~122 çağrı noktası,
sipariş/stok/ödeme yolları dahil). Bunları elle SQL'e çevirmek yerine aynı
arayüzü koruyan ince bir uyumluluk katmanı yazıldı:

| Dosya                    | Sorumluluk                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/db/sql.ts`      | Saf SQL derleyici - QuerySpec → parametreli SQL. Tanımlayıcılar katı bir desene karşı doğrulanır, değerler **her zaman** parametre olarak bağlanır. |
| `src/lib/db/client.ts`   | `.from().select().eq()...` zinciri, PostgREST sonuç şekliyle (`{ data, error, status, count }`).                                                    |
| `src/lib/db/index.ts`    | `pg` bağlantı havuzu + `getDb()` + `TABLES`.                                                                                                        |
| `src/lib/db/counters.ts` | `next_seq()` ile atomik sıra üretimi.                                                                                                               |

Korunan davranışlar (çağrı noktaları bunlara bağlı):

- Hatalar **fırlatılmaz, döndürülür** (`res.error`).
- `error.code` Postgres SQLSTATE'ini taşır - ödeme webhook'undaki ve müşteri/
  kupon kayıtlarındaki `23505` (unique violation) dalları çalışmaya devam eder.
- Mutasyonlar satır döndürmez; yalnız `.select()` zincirlenirse döndürür.
- Ulaşılamayan veritabanı `status: 0` + boş `code` olarak raporlanır - bu,
  "veritabanı kapalı" ile "sorgu reddedildi" ayrımını mümkün kılar.

Bu katmanın tamamı veritabanı olmadan test edilir: `tests/db-sql.test.ts` ve
`tests/db-client.test.ts` (45 test) üretilen SQL'i ve sonuç semantiğini doğrular.

### Tohum (seed) bir veritabanına bir kez yazılır

Store bir tabloyu ancak tablo boşken **ve** `counters` içinde
`seed:<tablo>` işareti yokken tohumlar (`seedOnce`, `src/lib/admin/store.ts`);
ilk karar işareti yazar. Böylece operatörün boşalttığı tablo (son ürün, son
vitrin slaytı, son duyuru) bir sonraki soğuk başlangıçta geri dolmaz (admin
denetimi CAT-04, CON-01, karar D17). Katalog (ürün, kategori, menü) üretim
derlemesinde (Vercel önizlemeleri dahil) hiç tohumlanmaz; ayarlar satırı
eksikse her zaman yazılır. Kullanımdaki her veritabanına işaretleri
`20261017200100_seed_markers.sql` bir kez yazdı. Sayaçlar `raise_counter` ile
yalnız yükselir (`setCounter`), silinmiş bir satırın kimliği yeniden
verilmez.

Bir geliştirme veritabanını yeniden tohumlamak için:
`delete from public.counters where id like 'seed:%';` (ve boşaltılacak
tablolar).

## Yeni migration

`db/migrations/YYYYMMDDHHMMSS_aciklama.sql` oluştur, sonra `npm run db:migrate`.
Detay için `new-migration` skill'i.

## Periyodik imha (KVKK)

Yayımlanan **Veri Saklama ve İmha Politikası** bağlayıcı bir taahhüttür: her
veri kategorisi için bir saklama süresi ve "periyodik imha işlemleri her yıl
Haziran ve Aralık aylarının son iş haftasında gerçekleştirilir" cümlesi. Uzun
süre bunu yapan hiçbir kod yoktu; `auth_attempts` - birincil anahtarı
`<amaç>::<IP>::<e-posta>` olan tablo - amacı beş dakikada tükenen bir sayaç
için sınırsız büyüdü. Bu hem tutulmamış bir taahhüt hem de veri
minimizasyonu ihlaliydi (KVKK m.4/2-d).

| Tablo                  | Sütun       | Süre       | Dayanak                                                                                                                    |
| ---------------------- | ----------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `auth_attempts`        | `updatedAt` | **7 gün**  | "…5651 sayılı Kanun kapsamındaki asgari süreye uygun olarak **1 yıl**…" - bu bir **tavan**; satırın amacı 5 dakikada biter |
| `campaign_email_sends` | `createdAt` | **3 yıl**  | Ticari İletişim Yönetmeliği - gönderim kaydı için **asgari** süre                                                          |
| `customer_consents`    | (fonksiyon) | **3 yıl**  | "onayın geçerliliğinin sona erdiği tarihten itibaren 3 yıl; ... ret kaydı ... bu süre boyunca" - aşağıya bak               |
| `email_suppressions`   | `updatedAt` | **3 yıl**  | Ticari ileti gönderim kaydı ("kayıt tarihinden itibaren 3 yıl"); son bounce/şikâyetten sayılır                            |
| `audit_logs`           | `createdAt` | **10 yıl** | "İşlemin gerçekleştiği tarihten itibaren 10 yıl… (append-only)" - **asgari**                                               |
| `legal_override_history` | `archivedAt` | **11 yıl** | "Sözleşmenin ifasından itibaren 10 yıl…" (Mesafeli satış onay kaydı); ifa arşivden sonra gelir, fazladan yıl onu karşılar |
| `counter_tokens`       | `expiresAt` | **1 gün**  | Jeton süresinin dolmasına bağlı otomatik imha; kalıcı kayıt `loyalty_stamps`'tir                                           |

Süreler **politikadan okunur, uydurulmaz**: `src/lib/retention.ts` içindeki
her kural, geldiği cümleyi `basis` alanında taşır ve
`tests/mobile-retention.test.ts` o cümle `src/lib/legal/content.ts`'ten
kaybolduğunda kırılır. Asgari (zorunlu) sürelerde yıl **366 gün** sayılır -
10 yıllık bir kayıt artık yıllar yüzünden bir gün erken imha edilemez.

`audit_logs` veritabanında da append-only'dir
(`20261019170000_audit_logs_append_only.sql`): UPDATE ve TRUNCATE P0001 ile
reddedilir, DELETE yalnız `createdAt`'i yazılı ve on yıldan eski satırda
geçer. İmha 10 × 366 gün bekler, yani her zaman tetikleyicinin sınırından
sonra keser. Olay kaydından elle satır silmek ya da düzeltmek artık hata
verir; tetikleyici uygulamayı ve kazaları durdurur, tablo sahibini değil
(`alter table ... disable trigger` sahibin elindedir).

### Çalıştırma - varsayılan **rapor modu**

`vercel.json` → `crons`: imha, `/api/cron/daily` içinde **son adım** olarak
koşar, her gün 06:00 UTC'de (09:00 İstanbul), kampanya ve doğum günü
adımlarından sonra: silen tek parça odur, bu yüzden en sonda. Vercel'in Hobby
planı iki cron ve yalnız günlük program verdiği için ayrı
`/api/cron/retention` rotası programda değildir; rota duruyor ve ücretli
planda kendi satırıyla geri konabilir (`docs/EMAIL-RESEND.md` §7). Kimlik
doğrulaması kampanya cron'unun aynısıdır (`CRON_SECRET`, sabit zamanlı
karşılaştırma, tanımsızsa 503).

**İmha geri alınamaz, bu yüzden opt-in'dir.** İş varsayılan olarak yalnızca
sayar ve ne silecek olduğunu kural kural yanıt gövdesinde bildirir. Gerçekten
silmesi için dağıtımda:

```
RETENTION_APPLY=destroy
```

Bu tam değer aranır - `1`, `true`, `yes` açmaz. **Önce birkaç gün kuru
çalıştırma yapın**, `totalMatched` sayılarını okuyun, sonra açın.

Yanıt gövdesi yalnızca **sayı** taşır; hiçbir anahtar, adres ya da IP ne
loglanır ne döndürülür (`auth_attempts.key` üçünü birden içerir).

### Rıza defteri (`customer_consents`)

Üyenin ticari ileti tercihinin (`marketing`, `newsletter`) **geçmişi**. Okuma
modeli yine `customers."notificationPrefs"` + `marketingConsentAt`'tir;
kampanya kitlesi ve `/me` onu okur, defteri hiçbir şey okumaz (mobil sözleşme
değişmedi). Defter, okuma modelinin tutamadığını tutar: her değişiklik bir
satır (adres, amaç, verildi/geri alındı, kaynak, üyenin kendi işlemiyse
isteğin IP'si ve tarayıcı/uygulama bilgisi, verilen onayın atıf yaptığı metin
sürümü, zaman: Ticari Elektronik İleti ve İYS Aydınlatması'nın "her onay
için" kaydedilir dediği alanlar). Eskiden
`marketing` kapatılınca `marketingConsentAt` silinir ve geriye hiçbir ret kaydı
kalmazdı.

Yazanlar (`src/lib/customer/consent-ledger.ts` → `appendConsentChanges`, her
biri kendi yazımı başarılı olduktan sonra): site kaydı (`site-signup`),
uygulamanın ilk girişi (`app-signup`, Supabase meta verisindeki onay), sitenin
hesap sayfası (`site-account`), `PATCH /me` (`app-account`), üye çıkış
bağlantısı (`unsubscribe-link`), üyeyi de kapatan bülten çıkışı
(`newsletter-unsubscribe`), panel müşteri formu (`admin`, IP'siz) ve hesap
kapatma (`account-deletion`, gerçek adresle; hesap-silme §7 "elektronik ileti
onay kayıtları" saklanır der). Defter yazımı **en iyi çaba**dır: tercih
değişikliği o anda yapılmıştır ve bir geri alma, geçmişi yazılamadı diye
başarısız olmamalı; hata maskeli adresle loglanır.

Satır güncellenemez (`customer_consents_no_update` tetikleyicisi). Tek
silme imhadır ve tek bir sütunla ifade edilemez: bir satır, aynı adres ve
amaç için kendisinden sonra (ya da kendisi olan) bir **geri alma** satırı 3
yıldan eskiyse gider (`customer_consents_retention`). Hâlâ geçerli bir onay
ne kadar eski olursa olsun kapsam dışıdır; üyeye giden postanın dayanağı
odur. Testler: `tests/consent-ledger.test.ts`,
`tests/db-integration-consent-ledger.test.ts`.

### Yasal metin arşivi (`legal_override_history`)

Panelin hukuk geçersiz kılmalarının (`legal_docs`, belge başına bir satır)
önceki metinleri. Bir kayıt değişen bir satırın üzerine yazmadan
(`legal_doc_save`, neden `replaced`) ve "Varsayılana döndür" silmeden
(`legal_doc_reset`, neden `reset`) önce eski satır aynı işlemde buraya
kopyalanır; ikisi de belge başına advisory lock alır. Hiçbir şeyi
değiştirmeyen kayıt hiçbir şey yazmaz: `updatedAt` metnin yayına girdiği an
kalır, böylece her metnin gösterildiği aralık `updatedAt` → `archivedAt`
olarak tam bilinir. Panel arşivi listeler,
önizler ve geri yükler (geri yükleme bir `legal_doc_save`'dir, değiştirdiği
metni de arşive alır). Sipariş onayı yalnız sürüm etiketini kaydeder
(`legalConsent.version`); o etiketin arkasındaki metin buradadır. Satır
güncellenemez (`legal_override_history_no_update`); yalnız periyodik imha
siler: `archivedAt`'ten 11 yıl sonra (`legal-override-history` kuralı).
Dayanak, siparişin sürüm etiketinin bağlı olduğu "Mesafeli satış onay kaydı"
satırıdır ("Sözleşmenin ifasından itibaren 10 yıl"): metin `archivedAt`'e
kadar onaylandı, sözleşme ondan sonra ifa edilir, fazladan yıl ifayı karşılar.
Satırdaki tek kişisel veri `archivedBy`, panel kullanıcısının adresidir.
Testler: `tests/db-integration-legal-history.test.ts`,
`tests/admin-legal-actions.test.ts`, `tests/mobile-retention.test.ts`.

### Kapsam dışı - bilerek

`newsletter_subscribers` ret (opt-out) kayıtları **süpürülmez**: onları silmek
aynı adrese yeniden ticari ileti gönderilmesine yol açar, ki Yönetmelik ret
kaydını tam da bunun için 3 yıl tutturur. Sipariş, fatura ve ödeme kayıtları
da kapsam dışıdır (VUK/TTK saklama süreleri).

`supabase_keepalive` (20 Eki 2026) bir günlük değil, tek satırdır: günlük
Supabase yoklamasının son denemesi ve son başarısı, her yoklamada üzerine
yazılır. Kişisel veri taşımaz (bir sonuç kelimesi ve iki ISO zamanı; tablo
kısıtları başka bir şeyi kabul etmez), büyümez, imha kuralı gerekmez.

## Yedek

Ücretsiz planda otomatik yedek sınırlıdır. Düzenli olarak:

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%F).sql
```

## Panel: 2FA'lı telefon kaybolursa

İki adımlı doğrulamayı panelden kapatmak o telefondaki kodu ister. Telefonu
kaybeden kullanıcının 2FA'sını sahip Kullanıcılar'da o hesabın sayfasından
sıfırlar ("2FA'yı sıfırla"); kendi hesabını ve ortam değişkeni (acil durum) hesabını
oradan sıfırlayamaz. Tek sahip telefonunu kaybederse ya da ortam değişkeni
hesabı 2FA kurmuşsa yol veritabanıdır:

```sql
-- Önce oku: doğru adres, tek satır.
select email, enabled, "enrolledAt" from public.admin_2fa where email = 'sahip@ornek.com';
-- Sonra yalnız o satırı sil.
delete from public.admin_2fa where email = 'sahip@ornek.com';
```

Adres küçük harfle ve boşluksuz yazılır (tablonun anahtarı böyle tutulur).
Satır silinince sonraki giriş yalnız şifre ister; girer girmez
`/admin/2fa-kurulum`'dan yeni telefonla yeniden kur. Bu silme olay kaydına
düşmez: kimin, ne zaman ve neden yaptığını ayrıca not al. İkinci bir sahip
hesabı bu yolu gereksiz kılar.

## Veritabanı ulaşılamazsa ne oluyor

Eski davranış: tek bir bağlantı hatası **her sayfayı HTTP 500** yapıyordu.
Üretimde bu bir ay sürdü. Artık genel (public) sayfalar pakette gelen içerikle
ayakta kalır; ticari yollar ise sesli şekilde başarısız olur.

Ayrım `src/lib/db/health.ts` içinde yapılır ve tek bir sinyale dayanır:
Postgres'e ulaşan her hata bir **SQLSTATE** taşır. SQLSTATE yoksa istek hiç
ulaşmamıştır (`status: 0`, boş `code`) - yalnız bu durum bozulmaya (degrade)
uygundur. Hatalı kolon, kısıt ihlali, kimlik doğrulama reddi gibi gerçek hatalar
**maskelenmez**, eskisi gibi hata verir.

| Alan                                  | Ulaşılamazken                                                        |
| ------------------------------------- | -------------------------------------------------------------------- |
| Ana sayfa, hikaye, ziyaret            | Pakette gelen içerikle render edilir                                 |
| Kafe menüsü                           | Yapı gösterilir, **fiyatlar `-`** (bayat fiyat göstermek yerine)     |
| Mağaza                                | **Boş** - asla paketteki kurgusal ürünlere düşmez                    |
| Ürün detay                            | "Şu an gösteremiyoruz" (404 değil - gerçek URL'ler deindekslenmesin) |
| Yasal metinler                        | Paketteki asıl metin (DB yalnız override tutar)                      |
| Ayarlar                               | Varsayılanlar, **`isShopOpen: false`**                               |
| Ödeme                                 | "Şu an sipariş alamıyoruz" kapısı                                    |
| Üye oturumu                           | Çıkış yapmış sayılır (fail-closed)                                   |
| Admin panel, tüm mutasyonlar, webhook | **Hata verir** - bozulma yok                                         |
| Admin oturumu                         | Çıkış sayılmaz: hata ekranı, çerez kalır; env oturumu sürer          |

Ziyaretçiye durumu açıklayan bir bant gösterilir; ayrıca her düşüş
`[db-degraded]` etiketiyle sunucu loglarına yazılır, böylece arıza görünmez
kalmaz. Tablodaki genel sayfa satırları önbellekte kaydı olmayan sayfa
içindir: kaydı olan sayfa, kesintiyi hiçbir canlı okumada görmeyen istekte
son bilinen gerçek içeriği bantsız gösterir; giriş yapmış üyenin isteği
bandı ve boş mağazayı görür (yukarıda "Uyanmalar ve önbellek").

**Bu davranışı genişletirken kural:** `publicRead()` yalnızca salt-okunur,
sunumsal veriler için kullanılır. Bir fiyat, stok, yetki ya da siparişin
verilebilir olup olmadığı **asla** yedek veriden karar bağlanmaz.

**`DATABASE_URL` hiç yoksa bu tablo geçerli değildir.** Ulaşılamayan bir
veritabanı ile tanımlanmamış bir bağlantı dizesi ayrı şeylerdir: ikincisi
yapılandırma hatasıdır, sayfalar pakete düşmez, hata verir (yukarıda
"Bağlantı dizesi yalnız `DATABASE_URL`").

Seed yardımcıları artık reddedilen promise'i önbelleğe almıyor
(`memoizeUntilRejected`): eskiden tek bir hata o sunucu örneğini kalıcı olarak
bozuyor, düzelme için yeniden deploy gerekiyordu.

## Supabase'e taşıma - sırası önemli

Kod hazır (düz `pg`, adsız parametreli sorgular, işlem kapsamlı advisory lock).
Eksik olan tek şey bağlantı dizesi ve verinin kendisi.

1. **Slot/plan doğrula** - yukarıdaki uyarı. Bu adım atlanırsa gerisi anlamsız.
2. **Bağlantı dizesini al** - Supabase panosu → Project Settings → Database →
   Connection string. Pooler (`:6543`, transaction mode) ya da session pooler
   (`:5432`) ikisi de çalışır; şema kurucu artık işlem kapsamlı kilit
   kullandığı için transaction pooler'da da güvenlidir.
3. **Şemayı kur** - `DATABASE_URL='<supabase>' npm run db:migrate`, ya da
   `db/schema.sql` dosyasını Supabase SQL Editor'a yapıştır.
4. **Veriyi taşı** - Neon'dan `pg_dump --data-only --no-owner`, Supabase'e
   `psql`. Sıra: önce şema (3), sonra veri.
5. **Doğrula** - satır sayıları iki tarafta eşit mi? Özellikle `orders`,
   `customers`, `order_items`, `loyalty_*`.
6. **Aynı anda:** `dbProvider` alanını `"Supabase"` yap **ve** Vercel'deki
   `DATABASE_URL`'i değiştir, sonra deploy et.

Kodda sağlayıcıya özel bir değişken yoktur: uygulama da betikler de yalnız
`DATABASE_URL`'i okur (`src/lib/db/database-url.mjs`, yukarıda "Bağlantı
dizesi yalnız `DATABASE_URL`"). Vercel'deki `POSTGRES_URL` (Supabase
entegrasyonu) cutover'da da okunmaz; taşıma `DATABASE_URL`'i değiştirmektir.
Cutover'da kaldırılacak bir yedek dize yok.

Neon projesini **hemen silme.** Birkaç gün elde tut; geri dönmek gerekirse tek
yapılacak şey bağlantı dizesini geri almak olsun.
