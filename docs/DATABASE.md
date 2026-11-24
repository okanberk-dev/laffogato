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
   Sekiz etiket: `pub:catalog` (ürün ve kategori: mağaza, ürün kartları,
   site haritası), `pub:menu` (menü kalemleri; mağazanın stok hareketi
   menüyü düşürmesin diye ayrı), `pub:site` (ayarlar,
   site metinleri, basın, hikaye, vitrin ve ana sayfa slaytları, uygulama
   içerikleri, hukuk override'ları), `live:venue` (canlı durum,
   `venue_status`: yalnız zilin yoğunluk penceresi okur (panelin köşk
   çipi 21 Kas 2026'da kalktı); 22 Eki 2026'ya kadar `pub:site` altındaydı ve çipe her dokunuş
   genel sayfaların bütün önbelleğini boşaltıyordu), `live:orders`,
   `live:karaoke`, `live:invoices` (e-Arşiv faturaları: yalnız panelin
   Faturalar rozetinin işareti taşır, 23 Eki 2026), `live:access` (panel
   hesapları, `admin_users`: önbellekte okunan bir şey yok, yalnız panelin
   değişiklik işaretleri taşır; madde 3).
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
   belgesi, `/masa/<kod>`'un menü kısmı, ana sayfanın karaoke bandındaki
   "bugün boş saatler" (22 Kas 2026: `getSiteKaraokeDay`, `live:karaoke` +
   `pub:site`; önceden tarayıcı her ana sayfa görüntülemesinde uygulamanın
   `/api/mobile/v1/karaoke/availability` ucunu çağırıyor, her seferinde
   veritabanını uyandırıp ikinci bir fonksiyon çalıştırıyordu; geçmiş
   saatler istek başına köşkün saatiyle kapanır). `/karaoke`'nin kendisi
   rezervasyon yolu olduğu için canlı okur. Saate bağlı her şey (bugünün
   saatleri, yayın aralıkları, ana sayfa slaytı, mağazadaki indirimin "eski
   fiyatı": önbellekte indirimin günleri durur, gösterilip gösterilmeyeceği
   her istekte `liveDiscount` ile karar bağlanır) istek başına hesaplanır.
   Ayarlar önbelleğe personel bildirim alıcıları boşaltılarak yazılır.
   Şubenin kendi fiyatı (23 Kas 2026, `menu_item_branch_prices`,
   `docs/PANEL-MENU.md` "Şube fiyatı") anı gelince hiçbir şey yazılmadan
   geçerli olur, etiket düşmez: Tuzla dışındaki bir şubenin `/masa/<kod>`
   menüsünün kaydı o şubenin geçmiş son fiyat anıyla anahtarlanır
   (`listSiteMenu`; anlar da `pub:menu` altında önbellekte), an geçince ilk
   görüntüleme menüyü bir kez canlı okur. Tuzla'nın sayfalarının anahtarı
   değişmedi.

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
   vercel cache dangerously-delete --tag pub:catalog,pub:menu,pub:site,live:venue,live:orders,live:karaoke,live:invoices,live:access --yes
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
   Neon'u bütün gece uyanık tutmaz. Üst çubuğun köşk çipi (UI-13, 20 Eki
   2026) de aynı düzende yoklardı; 21 Kas 2026'da kalktı (köşkün açık/kapalısı
   artık saatlerden gelir, `docs/ADMIN-STORAGEBOX.md`), yoklaması da onunla.

5. **Kasanın (LafPOS) çekimleri de değişiklik yokken veritabanına gitmez**
   (22 Kas 2026, #229; `src/lib/admin/remembered-read.ts`). Marina'nın kasası
   gün açıkken 15 dakikada bir sipariş güvenlik çekimi (`GET
   /api/panel/orders`) ve 15 dakikada bir menü yoklaması (`GET
   /api/mobile/v1/menu`, ETag) yapar; ikisi de veritabanını okuyordu:
   saatte 8 uyanma, gün açık kaldığı sürece (kapatılmayan günde bütün gece).
   Şimdi rota, imleci olmayan bu soranlar için imlecin yerini kendisi tutar:
   işaret okumadan ÖNCE okunur ve anahtarın parçasıdır; boş bar ekranı
   (yalnız LafPOS'un anahtarına) ve menünün `ETag`'i işaret değişene kadar
   hatırlanır. Zilin kuralları aynen: yeni yapılmış işaret (5 sn) hiçbir
   şeye kefil olmaz, saatte bir okuma canlıdır, önbellek kapalı ya da
   bozuksa her okuma canlıdır. Ölçüm (`tests/sube/neon-uyanma.test.ts`,
   veri katmanı sayılarak): kasa için saatte veritabanına giden istek 8'den
   2'ye, okuma 28'den 7'ye (23 Kas 2026'dan beri bir çekim `closed` ile dört
   okumadır). Sürüm sinyali (`/api/pos/orders/version`) 23 Kas 2026'dan beri
   şubenin özetini verir: genel işaret değişince şubenin listesi ve menüsü
   bir kez okunur (işaretin ilk sorusu canlı, ikincisi saklanır), işaret
   dururken hiç, saatlik turu yok; okuma bir yazımın hemen ardındandır,
   veritabanı uyanıkken. Şubenin menü özeti 23 Kas 2026'dan beri şubenin
   fiyat satırlarını da okur (aynı istekte, uyanma sayısı aynı; ilk saatte
   okuma 27'den 29'a). Uygulamanın `/menu?branch=<şube>` yanıtının
   `ETag`'i şubenin kapsamında ve yalnız şubenin bir sonraki fiyat anına
   kadar hatırlanır; an geçince bir kez canlı okunur, o anın kapsamında
   yeniden hatırlanır. Açık bir panel sekmesinin zili (madde 3) saatte
   360 istekten 1'e. Uyandırma başına ~5 dakika açık kalma ile kasanın payı
   14 saatlik günde yaklaşık 9,5 saatten 2,5 saate iner (0,25 CU'da günde
   ~2,4 yerine ~0,6 CU-saat). Canlı ölçüm aşağıdaki komutlarla yapılır
   (`NEON_API_KEY` operatörde; Hobby planı istek günlüğü tutmaz).

**Önbelleğe girmeyenler (bilerek).** Fiyat, stok, yetki ve siparişin
verilebilirliği hiçbir zaman önbellekten karar bağlanmaz: `/odeme` (layout,
sayfa, action'lar), `/karaoke`, `/rezervasyon`, `placeOrder` /
`placeAppOrder`, `/api/mobile/v1/**` (başlıklar ve okuyucular aynı,
`docs/API-MOBILE.md` değişmedi; tek istisna madde 5: menünün "değişmedi"
yanıtı, 304, işaretten gelir, gövdesi hiçbir zaman), e-postalar, onay sürümleri
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

### Sistem durumu: Neon işlem süresi (23 Eki 2026)

Aynı ölçüm panelde de durur. `NEON_API_KEY` ve `NEON_PROJECT_ID` Vercel
production ortamında tanımlıysa Ayarlar → Sistem durumu, sahibe bu fatura
döneminin CU-saatini (`compute_time_seconds` / 3600), planın aylık sınırına
göre yüzdesini, bu hızla ne zaman dolacağını ve compute'un günde ortalama kaç
saat uyanık kaldığını (`active_time_seconds`) söyler. Sınır %80'i geçince ya
da bu hız onu dönem bitmeden dolduracaksa satır turuncu olur ve Genel bakış
da aynı cümleyi gösterir; saatler dolunca kırmızı. Sınır `NEON_CU_HOURS_LIMIT`
(boşsa Free planın 100'ü; sınır yerine ücret yazan Launch'ta 0).

- **Veritabanını uyandırmaz:** okuma Neon'un denetim API'sine gider
  (`GET /projects/{id}`). İyi yanıt bir sunucuda 10 dakika tutulur
  (Neon'un sayaçları zaten gecikmeli), dönem bitince hemen yeniden sorulur.
- **Sayfayı bekletmez:** 3 sn'de yanıt yoksa satır "okunamadı" der ve bu
  cevap bir dakika tutulur; aynı anda açılan sayfalar tek soruyu paylaşır.
  Genel bakış uyarıyı ayrı akıtır (`Suspense`), sayfa Neon'u hiç beklemez.
- **Okunamazsa turuncu:** anahtar tanımlıyken Neon yanıt vermiyorsa (anahtar
  değişti, silindi) izleme kördür; satır turuncu olur, kart açılır, Genel
  bakış da söyler.
- **Anahtar:** Neon'da salt okunur anahtar yok. En dar olanı projeye özel
  anahtar: projeyi silemez, ama içindeki dalları ve veritabanlarını
  yönetebilir. Yalnız sunucuda okunur, yalnız Neon'a gider, loglanmaz.
  Anahtarlar proje ayarlarında değil, **Organization → Settings → API
  keys** altında; pencere org geneli ve başka bir projeyle açılabiliyor,
  kapsam ve proje elle seçilir.
- **Yoksa:** anahtar ya da proje kimliği tanımsızken satır gri kalır ve
  nasıl açılacağını söyler; hiçbir istek atılmaz.
- **Vercel kotası** gösterilmez: Vercel'in REST API başvurusunda kullanım
  için belgelenmiş bir uç bulunamadı (23 Eki 2026); Hobby kotası Vercel
  panelinin Usage sekmesinden okunur.

**Üretimde açık (23 Eki 2026).** `NEON_PROJECT_ID` (Config) ve
`NEON_API_KEY` (Secret, projeye özel `laffogato-sistem-durumu`) Vercel
Production'da; satırın ilk okuması: "bu dönem 81,0 / 100 CU-saat (%81); bu
hızla 28 Ekim günü dolar. Compute günde ortalama 13,7 saat uyanık." 1-23
Ekim ortalaması günde ~3,6 CU-saat, ay sonu ~112: kalan 19 saat 8 güne
günde ~2,4 ile yeterdi, yani bu ay kullanımla değil planla çözülür. Neon
Billing'in iki seçeneği: 250 CU-saatlik ek paket (ayda 10 $)
ya da sınır yerine kullanım ücreti yazan Launch (CU-saat 0,106 $; bu hızla
ayda ~12 $). Karar operatörün; seçildikten sonra `NEON_CU_HOURS_LIMIT`
güncellenir (250 ya da 0), yoksa satır 100'e göre ölçmeye devam eder.

Kod: `src/lib/admin/neon-usage{,-core}.ts`, satır
`src/app/admin/ayarlar/database-status.tsx` (yanında şemanın bu sürümle
güncel olup olmadığını söyleyen "Veritabanı" satırı, `/api/health`'in
cevabı), uyarı `src/components/admin/dashboard/neon-status.tsx`. Test:
`tests/admin-neon-usage.test.ts`.

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
> site hiçbir veritabanına bağlanmaz ve kesintideki gibi pakete düşer
> (aşağıda "Bağlantı dizesi yalnız `DATABASE_URL`").

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

`DATABASE_URL` yoksa (tanımsız, boş ya da yalnız boşluk) **hiçbir
veritabanına bağlanılmaz** ve site, veritabanı ulaşılamıyormuş gibi davranır
(aşağıda "Veritabanı ulaşılamazsa ne oluyor"); farkı adını söylemesidir:

- Her sorgu bağlantı kurulmadan `DATABASE_URL_MISSING` koduyla döner;
  `raiseDbError` onu kesintideki aynı `DbUnreachableError`'a çevirir. Genel
  sayfalar, `robots.txt`, `sitemap.xml` ve önbellekli okuyucular paketteki
  içeriğe düşer, `/api/mobile/v1` 503 `unavailable` döner (sözleşme
  değişmedi). Hata mesajı eksik değişkeni ve tanımlı olup okunmayan adları
  (`POSTGRES_URL`, `SUPABASE_DB_URL`) söyler, değerlerini asla. Sunucu
  günlüğüne örnek başına bir kez `[db] DATABASE_URL tanımlı değil` yazılır;
  her düşüş ayrıca `[db-degraded]` satırında bu mesajla görünür.
- `/api/health` `db: "unconfigured"` (503) döner, `down` değil: düzeltme
  beklemek değil, bir dağıtım ayarıdır.
- İki betik hiçbir yere bağlanmadan aynı mesajla çıkar (çıkış kodu 1).
- **Üretim derlemesi kırmızıya döner** (23 Eki 2026): `VERCEL_ENV=production`
  iken `DATABASE_URL` yoksa `scripts/check-build-env.mjs` derlemeyi aynı
  mesajla durdurur, önceki dağıtım yayında kalır. Vercel `npm run build`'i
  değil `vercel.json` `buildCommand`'ı koşar; denetim oradadır (`prebuild`'de
  de). Önizleme, yerel derleme ve CI (`VERCEL_ENV` yok) etkilenmez: statik
  sayfaların prerender okumaları paketteki içeriğe düşer. Değişken
  tanımlıyken üretim derlemesi prerender sırasında veritabanını sorgular
  (ve paketteki migration'ları uygular, `ensureSchemaFresh`). Olay: 15-17 Eki
  2026'da bir dağıtım bağlantı dizesi olmadan `[db-degraded]` ile çalıştı;
  o günün iletisi "DATABASE_URL (veya POSTGRES_URL) set edilmeli" idi, yani
  ikisi de yoktu (`tests/build-env-check.test.ts`).

Testler: `tests/db-connection-url.test.ts` aynı on durumu ortak kurala, veri
katmanına ve iki betiğe (gerçekten çalıştırarak; hangi adrese bağlanmaya
çalıştıklarını sayan geçici dinleyicilerle) uygular;
`tests/db-url-missing-degrades.test.ts` aynı dağıtımın genel okuyucularını
ve uygulama uçlarını `DATABASE_URL`'siz ve ulaşılamayan veritabanıyla yan
yana koşturur, cevapların aynı olduğunu ve `POSTGRES_URL`'e hiç
bağlanılmadığını tutar.

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
| `legal_doc_versions`   | (fonksiyon) | **11 yıl** | Aynı dayanak; metne atıf yapan en yeni onaydan sayılır, belgenin en yeni metni hiç silinmez - aşağıya bak                  |
| `counter_tokens`       | `expiresAt` | **1 gün**  | Jeton süresinin dolmasına bağlı otomatik imha; kalıcı kayıt `loyalty_stamps`'tir                                           |
| `table_calls`          | `createdAt` | **30 gün** | Masadan garson çağrısı (6 Kas 2026). Sunucu ve uygulama logu satırının 1 yıllık **tavanı** altında; çağrı 15 dakikada ekrandan düşer, 30 gün bir şikâyete yanıt payıdır. Hesap kapanınca e-posta hemen anonimleşir. Politika çağrıyı henüz adıyla saymaz (adıyla eklemek `LEGAL_UPDATED`'ı taşıyan bir hukuk revizyonudur) |
| `karaoke_reservations` | `date` (fonksiyon) | **3 yıl** | "rezervasyon tarihinden itibaren 3 yıl sonra, takip eden ilk periyodik imha döneminde silinir" - satır kalır, kişi bilgisi temizlenir (aşağıya bak) |
| `karaoke_reservations` | `date` (fonksiyon) | **11 yıl** | "ödeme işlem kayıtlarının saklama süresince (10 yıl) tutulur ve bu sürenin sonunda rezervasyon kaydı tümüyle silinir" - TTK m.82/6: süre yıl sonundan başlar, 11 × 366 gün hiçbir kaydı erken silmez |

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
loglanır ne döndürülür (`auth_attempts.key` üçünü birden içerir). İki rota da
aynı tek satırı loglar (`retentionLogLine`): `[cron/retention] destroy
matched=<n> destroyed=<n>` ya da `report ...`.

### İmha kaydı (Silme Yönetmeliği m.7/3)

Her **uygulanan** çalıştırma (`RETENTION_APPLY=destroy`) tek bir kalıcı kayıt
bırakır ve kayıt **`audit_logs`** tablosundadır: `actor` `system`, `action`
`bulk_delete`, `entity` `retention`, `entityId` çalıştırmanın ISO anı (UTC),
`payload` `{ at, results: [{ id, table, method, cutoff, matched, destroyed }] }`
(`method`: `delete` satır silindi, `clear` alanlar boşaltıldı).
Yalnız sayı: satır, anahtar, adres ya da hata metni yazılmaz; çalışamayan
kuralın satırında `failed: true` durur. Kaydı `runRetention` yazar
(`src/lib/retention.ts`, `safeAudit` ile: yazılamazsa imha geri alınmaz,
hata `[audit] row not written retention:<an> bulk_delete` diye loglanır ve
yanıttaki `recorded` `false` olur), bu yüzden `/api/cron/daily` de
`/api/cron/retention` da kayıt bırakır. **Rapor modu hiçbir şey yazmaz**:
ne veri ne kayıt.

Yönetmelik m.7/3 imha işlemlerinin kaydının en az üç yıl saklanmasını ister;
`audit_logs` on yıl tutulur (`audit-logs` kuralı) ve append-only'dir.
Panelde: **Olay kaydı** (`/admin/olay-kaydi`, yalnız sahip) → Kayıt türü
"Periyodik imha"; her kural Türkçe adıyla, eşleşen ve imha edilen sayısı ve
sınır anıyla görünür, CSV dışa aktarma da aynı satırları taşır.

### Karaoke rezervasyonları (ASK-RETENTION)

İki SQL fonksiyonu (`20261021090000_karaoke_guest_retention.sql`), ikisi de
`(p_cutoff text, p_apply boolean) returns integer`, `rpc()` ile çağrılır
(kural 23):

- `karaoke_guest_retention` (3 × 366 gün): misafir rezervasyonunda
  `"customerName"` boşalır, `"customerEmail"` `anon-<id>@anon.local` olur
  (hesap kapatmanın `deleted-<müşteri id>@anon.local` yer tutucusuyla
  çakışmaz); **her** rezervasyonda `"contactEmail"`, `"contactPhone"` ve
  `note` boşalır, `"legalConsent"`'ten yalnız `ip` ve `userAgent` çıkar (NULL
  NULL kalır; onayın anı, belgeleri ve sürümü kalır, MSY m.20). Üyenin kendi
  adı ve adresi kalır: onları üyelik tutar, hesap kapatma siler. Satır
  silinmez. Temizlenecek bir şeyi kalmamış satırı saymaz, ikinci çalıştırma 0
  döner.
- `karaoke_reservation_retention` (11 × 366 gün): satırı siler.

İkisi de aynı süzgeci kullanır: `date < left(p_cutoff, 10)` (metin
karşılaştırması; silmede rezervasyon günü, `"paidAt"` ve `"refundedAt"`'in en
geç olanı, TTK m.82/6), `"paymentStatus" not in ('pending', 'refunding')`
(POS'un sonuçlandırmadığı para; kural 29), panelin hâlâ borçlu saydığı
rezervasyon değil (`paid` ve `cancelled` ya da `requested`:
`listKaraokeRefundsOwed`, `listKaraokeAttention`), `payment_transactions`'ta
cevabı gelmemiş `refunding` talebi yok ve `"retentionHold" = ''`. `date` köşkün
takvim günüdür; `retention.ts` bu iki kuralın sınırını İstanbul saatiyle
(`…+03:00`) yazar, böylece ilk on karakter köşkün günüdür (kural 22: UTC
00:00-03:00 arası dünü verir). Biçimi `YYYY-MM-DD` olmayan bir gün hiç
kapsama girmez; gün olmayan ya da bir yıldan yakın bir sınır hata verir
(22007), hiçbir şey yazılmaz.

**Hukuki saklama (`"retentionHold"`).** Boşsa imhayı hiçbir şey durdurmaz.
Uyuşmazlık, şikâyet ya da resmî talep olan rezervasyonda nedeniyle doldurulur
ve iş bitince boşaltılır; uygulama bu sütunu yazmaz, hiçbir yanıtta yoktur:

```sql
update public.karaoke_reservations set "retentionHold" = 'Hakem heyeti 2027/123' where id = 'krk-00042';
update public.karaoke_reservations set "retentionHold" = '' where id = 'krk-00042';
```

`payment_transactions`'taki `krk-` ödeme satırları bu kurallara girmez; onların
kendi kuralı henüz yok (on yıllık asgari süre, en erken 2036'da gerekir).

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
metni de arşive alır). Sipariş onayı 21 Ekim 2026'ya kadar yalnız sürüm
etiketini kaydediyordu (`legalConsent.version`); o etiketin arkasındaki panel
metni buradadır. O günden beri onay her metnin hash'ini de tutar ve metnin
kendisi `legal_doc_versions`'tadır (aşağıda). Satır
güncellenemez (`legal_override_history_no_update`); yalnız periyodik imha
siler: `archivedAt`'ten 11 yıl sonra (`legal-override-history` kuralı).
Dayanak, siparişin sürüm etiketinin bağlı olduğu "Mesafeli satış onay kaydı"
satırıdır ("Sözleşmenin ifasından itibaren 10 yıl"): metin `archivedAt`'e
kadar onaylandı, sözleşme ondan sonra ifa edilir, fazladan yıl ifayı karşılar.
Satırdaki tek kişisel veri `archivedBy`, panel kullanıcısının adresidir.
Testler: `tests/db-integration-legal-history.test.ts`,
`tests/admin-legal-actions.test.ts`, `tests/mobile-retention.test.ts`.

### Gösterilen hukuk metinleri (`legal_doc_versions`, 21 Eki 2026)

`/hukuk/<slug>`'in gösterdiği **her** metin (kodlu metin ya da panelin
yayımladığı metin), kanonik biçimiyle (`src/lib/legal/version-core.ts`:
sabit anahtar sıralı JSON; başlık, özet, "Son güncelleme" tarihi, token'ları
doldurulmuş bölümler ya da panelin Markdown'ı) ve o biçimin SHA-256'sı
anahtarıyla burada durur (karar D-VERSIONS-TABLE). Sipariş ve karaoke onay
kaydı sürüm etiketinin yanında her belgenin hash'ini yazar
(`legalConsent.textHashes`); onay e-postasının eki, üyenin indirdiği dosya ve
`/hukuk/<slug>?surum=<ilk 16 hane>` sayfası metni bu tablodan, hash ile
okur. `legal_override_history` panelin düzenleme kaydı olarak kalır; iki
tablo yan yana durur.

- **Bütünlük:** `hash = encode(sha256(convert_to(body, 'UTF8')), 'hex')`
  CHECK'i: hash'i metnini tutmayan satır yazılamaz. Okuyan kod da hash'i
  yeniden hesaplar ve kanonik biçimden sapan metni yok sayar.
- **Yazanlar** (hepsi `INSERT ... ON CONFLICT (hash) DO NOTHING`, tek ifade):
  web ve uygulama ödeme onayı ile karaoke rezervasyonu (gösterdikleri
  metinler, ilk onayda; yazılamazsa sipariş etkilenmez, loglanır), panelin
  kaydet, varsayılana döndür ve geri yükle işlemleri (önceki metin
  değişiklikten ÖNCE, yazılamazsa değişiklik reddedilir; yeni metin ancak
  değişiklik yazıldıktan SONRA, yazılamazsa loglanır ve ilk onay ya da cron
  yazar), günlük cron (`/api/cron/daily`, "legal-versions": bütün belgelerin
  o günkü metni) ve onay e-postası ile iki indirme yolu (onayda yazılmamış ama
  bugün gösterilen metinle hash'i aynı olan metni; yani bu iki GET de
  yazabilir). Hiçbir genel sayfa görüntülemesi yazmaz; yalnız `?surum=` dalı
  okur.
- **Onayın okumadığı metinler** (KVKK, İşlem Rehberi, alt bilgideki
  politikalar) deploy'dan sonraki ilk okumada değil, **en geç bir gün içinde**
  günlük cron'la ya da o belgeye dokunan panel işlemiyle yazılır. Arada geçen
  sürede o metnin `?surum=` adresi yoktur; hiçbir onay ona bağlı olmadığı için
  hiçbir onay kaydı eksik kalmaz.
- **`createdAt`** veritabanının saatiyle varsayılan olarak dolar; uygulama onu
  hiç yazmaz (doğrudan bir INSERT yazabilirdi, uygulamada öyle bir yol yok).
- **Yalnız eklenir:** UPDATE ve TRUNCATE P0001; DELETE yalnız `createdAt`'i
  on bir yıldan eski satırda geçer (`legal_doc_versions_append_only`).
- **İmha** (`legal-doc-versions`, 11 × 366 gün, `legal_doc_versions_retention`):
  `createdAt` metnin ilk saklandığı andır, son gösterildiği an değil; bu
  yüzden bir satır yalnız (a) kesimden önce saklanmış, (b) belgenin daha yeni
  bir metni de kesimden önce saklanmış, (c) bugün gösterilen metinlerden biri
  değil (`p_keep`: cron'un o gün yazdığı hash'ler; eski bir metin varsayılana
  dönüşle yeniden gösterilebilir ve ilk `createdAt`'ini korur) ve (d)
  kesimden sonra kabul edilmiş hiçbir sipariş ya da karaoke onayı onun
  hash'ini taşımıyorsa gider. Bugün gösterilenler bilinmiyorsa (cron'un
  "legal-versions" adımı düştüyse) kural hiçbir şey saymaz ve silmez.
  Kişisel veri yoktur (metinler kamuya açık).
- **`?surum=` önbelleksizdir** (bilerek, inceleme R7): sürüm sayfası her
  istekte tabloyu okur. Yalnız e-postadaki ve indirilen dosyadaki bağlantı
  oraya gider, arama motoru indekslemez (`noindex`); sürümsüz `/hukuk/<slug>`
  önbellekten okumaya devam eder. Trafik artarsa hash'e göre önbelleğe almak
  güvenlidir (metin hash'iyle değişmez).

Testler: `tests/db-integration-legal-versions.test.ts`,
`tests/legal-version-core.test.ts`, `tests/mobile-retention.test.ts`,
`tests/api-cron-daily.test.ts`.

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

**Kapıda ret de kesintidir (23 Eki 2026).** Sunucu bağlantıyı hiçbir sorgu
gitmeden, el sıkışmada bir hatayla reddederse (Neon aylık işlem kotası dolunca
ya da compute askıdayken böyle yapar) hata bir SQLSTATE taşısa da kesinti
sayılır: yürütücü önce bağlanır, sonra sorgular (`src/lib/db/index.ts`
`connectRefusal`). Yalnız bu kurulumun kendi hatası sesli kalır: kimlik reddi
(28xxx) ve olmayan veritabanı (3D000). Önceden bu ret sorgu hatası sayılıyor,
her genel sayfa 500, uygulamanın API'si 503 yerine 500 dönüyordu (yerel
Postgres'te rolün bağlantı sınırı 0 yapılarak, 53300 ile canlandırıldı).
Test: `tests/db-connect-refusal.test.ts`.

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

**`DATABASE_URL` hiç yoksa da bu tablo geçerlidir:** hiçbir veritabanına
bağlanılmaz ve her alan ulaşılamazken nasıl davranıyorsa öyle davranır;
yalnız `/api/health` `unconfigured` der (yukarıda "Bağlantı dizesi yalnız
`DATABASE_URL`").

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
