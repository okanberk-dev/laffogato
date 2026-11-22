@AGENTS.md

# Laffogato — Kafe + E-ticaret Platformu

Bu dosya, Claude Code'un bu projede tutarlı çalışması için gerekli bağlamı
içerir. Next.js'in bu sürümüne özgü kurallar için `AGENTS.md`'yi de oku.

> **Test verisi kaldırıldı (16 Kas 2026, operatör: _"laffogato reposundaki tüm
> test verilerini kaldır ve maine gönder"_).** Repodan çıkanlar: `tests/`
> klasörü (558 dosya, Vitest) ve `vitest.config.mts`; sahte ödeme sağlayıcısı
> (`MockPaymentProvider`, `/odeme/donus` GET'indeki sahte onay);
> `SEED_DEMO_ORDERS` demo siparişleri; paketteki ürün (`PRODUCTS`), menü
> kalemi (`MENU[*].items`), mağaza hero, uygulama slayt / duyuru / gönderi
> seed'leri. **Kalanlar** test verisi sayılmadı: kategori kabukları (menü
> başlıkları, beş mağaza kategorisi), `HOME_SLIDES`, `STORY`, `LOCATION`,
> `BRAND` (site metni ve kimliği). Bu dosyanın aşağısındaki `tests/*.test.ts`
> atıfları ve "testi tutar" cümleleri **tarihçedir**: kontrat koruması artık
> CI'da koşmaz; form sözleşmesi, mobil v1 sözleşmesi, kontrast ve hukuk metni
> kuralları elle ve kod incelemesiyle korunur. Eski testler
> `git show 5d777bb:tests/<dosya>` ile okunur. Canlı veritabanındaki test
> satırlarına dokunulmadı: `docs/TEST-VERISI-TEMIZLIK.md`. `vitest` hâlâ
> `package.json`'da (kilit dosyası yeniden üretilmesin diye); kaldırmak ayrı
> bir iştir. **İstisna (20 Kas 2026, operatör):** kayıtlı kartın testleri
> `tests/saved-cards/`'ta, `npm run test:saved-cards` ile yerel Postgres ve
> PayNkolay taklidine karşı koşar (CI'da değil; `tests/saved-cards/README.md`).

## Proje Özeti

**Laffogato** (marka: **L'Affogato**) İstanbul Tuzla'da açılan kafenin kurumsal
web sitesi + online mağazasıdır. Müşteri menüye bakar, ürün satın alır, ödeme
yapar; admin paneli üzerinden ürün / menü / sipariş / içerik yönetimi tek yerden
yapılır.

- **Stack:** Next.js 16 (App Router + Turbopack) · React 19 · Tailwind v4 ·
  TypeScript · Zod
- **Deploy hedefi:** Vercel
- **Veri:** **Postgres**, `pg` sürücüsüyle. Veri **Neon'da** kalır, Supabase yalnız kimliktir (19 Eki 2026 incelemesi, docs/DATABASE.md; taşıma yordamı docs/SUPABASE-GECIS.md hazır ama uygulanmadı) ve koda
  özgü bir bağımlılık yok — bağlantı dizesi değişince başka bir Postgres'e
  taşınır. **Taşımadan önce `docs/DATABASE.md`'deki sağlayıcı geçmişi uyarısını
  oku:** proje bir kez Supabase'den taşındı ve sebebi bir aylık kesintiydi.
  Sağlayıcının adı 35 hukuki pasajda geçer ve `{{DB_PROVIDER}}` token'ıyla tek
  kaynaktan gelir (`src/lib/legal/entity.ts`).
- **Adres:** Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1 (Menemenci
  Cumhur'un yanı), 34940 Tuzla / İstanbul — vergi levhasıyla doğrulandı
- **Auth:** Admin için env-credentialed imzalı cookie (`ADMIN_EMAIL` +
  `ADMIN_PASSWORD` + HMAC SHA256) ve TOTP 2FA. Müşteri için bcrypt hesap
- **Ödeme:** Sağlayıcı bağımsız soyutlama (`src/lib/payment/`). Sanal POS
  **PayNkolay**; kart web'de **checkout sayfasının kendisinde** (`/odeme`,
  iki adım: Teslimat → Ödeme), uygulamada `/odeme/paynkolay`'da girilir,
  sunucu onu yalnızca PayNkolay'a iletir ve müşteri doğrudan bankanın
  3D ekranına gider (`PAYNKOLAY_CHECKOUT_MODE=direct`). **Kart saklanmaz**:
  kural 28, `docs/PAYNKOLAY.md` §15. Sahte sağlayıcı yok (16 Kas 2026): geliştirmede
  de PayNkolay test hostu (`PAYNKOLAY_BASE_URL`).
  iyzico 15 Eki 2026'da koddan kaldırıldı; hukuki metinler 16 Eki 2026'da
  PayNkolay'a çevrildi (`docs/LEGAL-REDLINES-2026-09.md` başındaki durum
  tablosu; `tests/legal-docs.test.ts` metinde iyzico, uzun tire, "kart
  sunucumuza uğramaz" ve cüzdan / hediye çeki sözü kalmadığını tutar). Masa ve
  grup rezervasyonu yok (17 Eki 2026): rezervasyon yalnız karaoke odası için,
  metinler masa rezervasyonu vaat etmez (aynı test; LEGAL-REDLINES §17). Metinler
  avukat okumasını bekler
- **Dil:** Arayüz **Türkçe**. Kod, dosya adı, identifier, commit mesajı
  **İngilizce**

## Mobil Uygulama — `RiosenBeq/lafmobil`

Bu site tek başına değil. **Aynı markanın mobil uygulaması `RiosenBeq/lafmobil`
deposunda yaşıyor** (Expo / React Native) ve verisini bu depodaki
`src/app/api/mobile/v1/**` uçlarından alıyor. İki depo tek bir sözleşmeye
bakar: `docs/API-MOBILE.md` — kopyası her iki depoda durur ve **ikisi aynı
olmalıdır**.

> **`/api/mobile/v1` sözleşmesini BOZMA.** Uygulama mağazadan yayınlanmış
> sürümlerle sahada; eski sürümler güncellenmeden aynı uçlara istek atmaya
> devam eder. v1 içinde **yalnız ekleme** yapılır:
>
> - Alan **silme**, **yeniden adlandırma**, tip değiştirme yok.
> - Zorunlu yeni istek alanı yok (yeni alan opsiyonel + varsayılanlı olmalı).
> - Hata kodları, HTTP durum kodları ve kimlik doğrulama yöntemi
>   (`Authorization: Bearer <Supabase JWT>`) değişmez.
> - Kırıcı bir değişiklik gerekiyorsa `/v2` açılır; v1 ayakta kalır.
> - Uç davranışını değiştiren her PR'da `docs/API-MOBILE.md` **aynı PR'da**
>   güncellenir ve `lafmobil` tarafına haber verilir.

**Paralellik nasıl korunur (ve nasıl kontrol edilir).**

- `docs/API-MOBILE.md` iki depoda **bayt bayt aynı**. `lafmobil`
  `src/data/contract-sync.test.ts` belgenin SHA-256'sını kilitler; bu depodaki
  `tests/api-contract-parity.test.ts` `../lafmobil` yanında klonluysa iki kopyayı
  karşılaştırır (CI'da tek depo olduğu için atlanır). **Buradaki belgeye
  dokunan her değişiklik aynı oturumda `lafmobil`'e kopyalanır ve oradaki
  `RECONCILED` hash'i güncellenir** (ayrı PR) — yoksa iki taraf da kendi
  kopyasını gösterip haklı çıkar.
- Belge değil **kod** esastır. Paralelliği kontrol ederken `lafmobil`
  `src/data/http.ts` (uygulamanın her yanıtı nasıl okuduğu) ile buradaki
  `src/lib/mobile/*-mapper.ts` / `*-schema.ts` alan alan karşılaştırılır:
  uygulamanın okuduğu ama sunucunun göndermediği alan (23 Eyl: `cafeOnly`),
  panelin kabul edip uygulamanın düşürdüğü değer (23 Eyl: hatırlatma saati
  08–21) ve uygulamanın dallandığı hata kodları.
- Uygulama bir alanı zaten okuyorsa onu sunucuya eklemek v1 içinde güvenlidir
  (yalnız ekleme). Uygulamanın bir değeri sessizce düşürdüğü yerde panel aynı
  sınırı **mesajla** zorlar (`APP_CONFIG_LIMITS`).

**fA'L uygulamadan kalktı (27 Ekim 2026).** App Review iOS gönderimini
Guideline 4.3(b) (fal, astroloji) ve 5.1.1(v) (kayıtta zorunlu telefon) ile
reddetti. Uygulama fA'L'ı ve yapay zekâ yorumunu kaldırdı (lafmobil karar
330); yerine **Kahve Modu** geldi: üye günün kahve modunu (herkese aynı) ya
da seçtiği başka bir modu kendi içecek fotoğrafına yazdırıp Story olarak
paylaşır ya da cihazına kaydeder. Fotoğrafa bakılmaz, yalnız telefonda
işlenir; uygulama onu L'Affogato'ya ya da başka bir yere göndermez. Yapay
zekâ, tahmin ya da okuma yok. Kayıtta telefon artık isteğe bağlı (lafmobil
karar 329). Sitede bunun anlamı:

- Müşteriye görünen hiçbir metin (hukuk metinleri, `public/llms*.txt`, SSS
  ve SEO, e-posta şablonları, sayfa metadatası, panelden yazılan slayt,
  kampanya ve gönderiler) fA'L'ı, fal, burç, kehanet ya da yapay zekâ
  yorumunu uygulamanın bir özelliği olarak anlatmaz; Kahve Modu "eğlence
  amaçlı" diye de anlatılmaz ve cihaz için "saklanmaz" denmez, "gönderilmez"
  denir. Rehberlerdeki "telve" (demlemede kahve posası) bu kuralın konusu
  değildir.
- `/api/mobile/v1/fal*` uçları ve `bootstrap.app.fal` v1 gereği kalır (yalnız
  ekleme); karar 330'dan sonraki uygulama derlemeleri onları çağırmaz ve
  okumaz. `FAL_AI_ENABLED` hiçbir ortamda tanımlanmaz.
- İş listesi ve önerilen hukuk cümleleri lafmobil
  `docs/site-handoff/APP-TO-SITE-2026-10-27.md`; reddin kaydı lafmobil
  `docs/APP-REVIEW-2026-10-27.md`. Bu depodaki fA'L geçen eski kayıtlar
  (`docs/AUDIT.md` düzeltme satırları, `docs/handoff/**`) tarihçedir.

**İş mantığını web ile paylaşırken uçtan değil kütüphaneden geç.** Web'in
kimliği bcrypt çerez oturumu, uygulamanınki Supabase bearer token'ı — web bir
mobil ucu HTTP ile çağıramaz. Doğru desen: ortak kuralları saf bir `*-core`
modülünde tut, veritabanına dokunan yarıyı ayrı dosyada bırak, iki yüzey de
aynı fonksiyonu çağırsın. Örnekler: `src/lib/mobile/karaoke-core.ts` ↔
`karaoke.ts` (web `/karaoke` sayfası ile mobil uç aynı `createReservation`'a
iner), `loyalty-core.ts` ↔ `loyalty.ts`.

**Site görünümü 21 Kas 2026'dan beri Blue Bottle'ın dilinde; anasayfa bir
filmle açılır.** Operatör önce eski görünümü sildirdi (_"sitedeki tüm ölü
cssleri sil ... tüm tasarım dosyalarını vs. temizle sna yeni tasarım örneği
atacağım site ordan tek tek çekeceksin"_; seçtiği yol "Sıfırla, iskelet
kalsın"), sonra iki referans verdi: _"burdaki herodaki videoyu birebir çek
kullan https://goodboybob.com/ ve bu site tasarımını da birebir al bize uygun
olan görselleri de çek marka belirtilmeyen premiuum olsun her şeyi birebir
uyarla ve bizde olan özellikleri de bu tasarımlara göre yap
https://bluebottlecoffee.com/us/eng ... karaoke sayfasının wizardını falan ona
göre ayarla ve mobil versiyonlarına da aşırı dikkat et."_ Ardından: _"sen
benim yaptığımı sil sana verdiğim sitelerdeki ile birebir git 1:1 lütfen
bendeki her tasarımı sil elementi verdiklerimden al ve onlarla uyumlu git
olmayanlrı da sana attığım bluebotter sitesi ile uyumlu oluştur."_
Unutulmaması gerekenler:

- **Alınan dildir.** bluebottlecoffee.com'dan düzen, yazı ölçeği ve işlenişi,
  boşluklar, bileşenler ve etkileşimler (fareyle açılan menü paneli, sağdan
  sepet ve filtre çekmecesi, üstten arama paneli); goodboybob.com'dan
  anasayfanın tam ekran filmi (sol altta küçük başlık, sağ altta alt çizgili
  bağlantı). Onlarda olmayan özelliklerimiz (kafe menüsü, karaoke sihirbazı,
  kampanyalar, rehberler, masa sayfası, ödeme, üye alanı) aynı dille yazıldı.
- **Varlıkları alınmadı, onlarındır:** Good Boy Bob'un filmleri; Blue
  Bottle'ın fotoğrafları, logosu ve şişe işareti, lisanslı yazı tipleri
  (Dinamo'nun ABC Marfa ve ABC Diatype'ı, ticari lisans). Yerlerinde aynı
  yapıda açık yüzler (Archivo, Geist), sitede zaten olan fotoğraflar (köşk,
  menü, rehber) ve lisanslı stok film ve kareler (Mixkit); kaynaklar ve
  lisanslar `docs/MEDIA-LICENSES.md`. Operatör hero'daki videoyu da birebir
  istedi: film Good Boy Bob'un eseri olduğu için hero'nun biçimi ve davranışı
  alındı, filmin yerine stok klipler kondu. Roast (referanstan yalnız
  oranlar) ve yolculuk (promptun son karesi başka bir firmanın logosu olan
  sahnesi alınmadı) da bu ilkeyle yapılmıştı.
- **Değerler** (`src/styles/foundation.css :root`, kurallar aşağıda "Tasarım
  Sistemi"): beyaz sayfa, `#f6f6f3` bant (`--band`), siyah mürekkep, gri
  `#6c6864` (`--muted`), her dolu kontrol ve footer için **tek kömür**
  `#333333` (`--charcoal`), çizgi `#dcdcd6`. Başlık, gezinme, fiyat ve etiket
  Archivo'yla: geniş (`"wdth" 118`), 400, büyük harf, 1.6px aralıklı; cümle
  ve kontroller Geist. Kare köşe; gölge, bulanıklık ve degrade yok (filmin
  alt gölgesi dışında). Düğme 48px, 1px kömür kenar; çağrı düğmesi 350px,
  telefonda tam satır.
- **Krom** (`chrome.tsx`): bantta duyuru satırı ("Her siparişte damga topla |
  Kampanyalar") ve yapışkan çubuk: solda dört büyük harf bağlantı (Menü,
  Mağaza, Karaoke, Ziyaret & keşfet; üçü fareyle tam genişlik panel açar),
  ortada L'Af, sağda arama, hesap, sepet. 1280px altında menü düğmesi ve tam
  boy panel, 1024px altında hızlı bağlantı çipleri. Kampanyalar ana menüden
  çıktı (duyuru satırında, ziyaret panelinde, çiplerde ve footer'da). Footer
  kömür blok: dört sütun (Keşfet, Ziyaret, Üyelik, Kurumsal), bülten
  (`email`, `consent`; kutu işaretsiz), şirket satırları. Buzlu ya da saydam
  çubuk, yüzen sipariş düğmesi (`.frap`) ve telefon sekme çubuğu yok.
- **CSS `src/styles/`'ta.** `globals.css` yalnız içe aktarır (Tailwind, sonra
  sayfa sırasıyla `foundation`, `chrome`, `sections`, `home`, `catalog`,
  `pages`, `karaoke`, `checkout`, `account`) ve panelin geri alma ve baskı
  kurallarını taşır. Ödeme ve üye alanının kuralları eski dosyadan düzeniyle
  taşındı, görünüşü yeniden yazıldı; karaoke sihirbazında yalnız CSS değişti
  (alan adları aynı); gerisi sıfırdan yazıldı. Hukuki asgariler
  `foundation.css`'te durur: sözleşme ve ön bilgilendirme metinleri 16px (MSY
  m.6/1, 12 pt), iOS için 16px alanlar, karar vermiş ziyaretçide çerez
  kartının hidrasyondan önce gizlenmesi.
- **Kaldırılanlar:** yolculuk (aşağıda); three.js bantları (`roast-stage.tsx`,
  `roast-scene.ts`; `three` `package.json`'da kullanılmadan duruyor, kilit
  dosyası yeniden üretilmesin diye: `vitest` gibi ayrı iş); `reveal-text`,
  `scramble-text`, `reveal-motion`; çizimler (`illustration.tsx`,
  `menu-visuals.tsx`, `payments-art.tsx`, `public/illustrations/`'tan 30 SVG;
  `karaoke-room.webp` ve `karaoke-mic-cut.webp` kaldı, `home-hero-core.ts` ve
  `og-pages.tsx` okur); `footer-night.tsx`; `docs/REDESIGN-ROAST.md`,
  `docs/JOURNEY.md`, `docs/journey/`.
- **Değişmeyenler:** arka yüz (`src/lib`, `src/app/api`, action'lar,
  route'lar, `src/proxy.ts`, `db`, `scripts`); panel (`/admin`); logo L'Af
  (`public/brand/`, `<LafMark>`; uygulama ikonu da odur). Bağlantı
  önizlemesi (OG kartları), ikonlar ve PayNkolay köprüsü eski (porselen, logo
  yeşili) palette kaldı. Tasarım kaydı `docs/BRAND.md`.
- **E-postalar 22 Kas 2026'dan beri sitenin dilinde, markanın yeşiliyle**
  (operatör: _"mail tasarımlarını da siteyle aynı yap ... estetik yap
  mailleri de öyle"_, ardından _"renkleri de yeşilimsi yap bizim renkler
  gibi"_; kapsam yalnız e-postalar ve /franchise): adaçayı `#f2f5f1` dış
  zemin, çerçevesiz beyaz kart, tepede derin orman yeşili `#173f35` başlık
  bandı ve ortasında kutusuz L'Af işareti (`laf-mark-white.png`, saydam,
  yalnız yeşil zeminde; operatör: _"logomuzu daha estetik yerleştir"_; yeşil
  kartta bandı ince bir çizgi kapatır), Archivo yığınıyla
  yeşil, büyük harf aralıklı başlık ve etiket, Geist yığınıyla `#1e2a25`
  cümle, kare yeşil düğme (cümle düzeninde etiket, tek çağrı 350px), yeşil
  açılış, bilet ve footer, üstünde pirinç `#cba258` etiket, uygulama şeridi
  adaçayı bantta. Web fontu yüklenmez. Açık ve koyu modda okunur. Token'lar
  `foundation.css :root` `--forest*`, `--sage*`, `--brass`; değerler,
  sınıflar ve ölçülmüş oranlar `src/lib/email/templates/README.md` "Palet"
  ve `docs/BRAND.md` §10; görseller `scripts/gen-email-assets.mjs`.
  Supabase'in dört giriş e-postası `docs/email/`'da aynı tasarımla durur ve
  **panele elle yapıştırılır** (site deploy edildikten sonra: görseller
  oradan gelir). Panelden ya da koddan gelen düğme yazısı cümle düzeninde
  yazılır ("Panelde aç").

Aşağıdaki üç paragraf tarihçedir:

**Tarihçe: Roast (11-21 Kas 2026; operatör: _"siteyi tamamen
https://coffee-beans-swart.vercel.app/ bu sitedeki gibi ... yap, three js vs.
ne varsa kullan ... bize uyarlayarak yap"_).** Krem zemin `#faf7f2`, tek
espresso `#23120b`, amber ve karamel vurgu, Abril Fatface ile Plus Jakarta
Sans, hap düğme, buzlu üst çubuk, iki three.js bandı; 17 Kas 2026'dan sonra
anasayfa yolculukla açıldı. Kaydı `git show 4962da2:docs/REDESIGN-ROAST.md`,
değerleri `git show 4962da2:docs/BRAND.md` (§0).

**Tarihçe: kafe-perakende düzeni (5-11 Kas 2026; operatör: _"starbucks tarzı
istiyorum ... ama panel değil"_).** Krem zemin `#f2f0eb`, logo yeşilinden
dört yeşil (brand `#1d6d56`, cta `#1f7a5c`, house `#173f35`, uplift
`#2a5a4d`), 6 Kas 2026'dan sonra gece espressosu footer (`--night`
`#181412`), pirinç `#cba258` yalnız ödülde, tek ses Poppins, 12px kart, 50px
hap düğme, yüzen sipariş düğmesi (`.frap`). Aşağıdaki uygulama paritesinden
bilinçli ayrışmaydı; değerleri `git show 4962da2:docs/BRAND.md` (§9).

**Tarihçe: tasarım paritesi (25 Eyl - 5 Kas 2026), kaynak uygulamaydı.**
Operatör (25 Eyl 2026): _"lafmobil ... tasarımı apple'a uygun, sen de site
tasarımını buna uygun olarak güncelle"_ (lafmobil karar 31, seçenek c). Site
uygulamanın porselen paletini (`lafmobil/src/theme/tokens.ts`, DESIGN-GLASS
§13), cam malzeme dilini (kapsül düğme, cam kart, yüzen cam krom) ve
Poppins'i aldı; başlık ve gösterim rakamları operatörün isteğiyle (11 ve 14
Eki 2026) Gabarito'ydu (istediği Biennale lisanssızdı). Değerler: porselen
zemin `#f7f3ed`, yapı yeşili `#1d6d56`, bordo `#9d2543`, pirinç `#e8c877`,
altın metin `#765923`. E-postalar 15 Eki 2026'da bu palete geçti ve orada
kaldı (yukarıda "Değişmeyenler"). Uygulamanın paletini izleme kuralı
(lafmobil `docs/SITE-PALETTE-SYNC.md`) 5 Kas 2026'daki ayrışmayla bitti.

**Anasayfanın girişi: film (21 Kas 2026; operatör: _"burdaki herodaki
videoyu birebir çek kullan https://goodboybob.com/"_).** 17 Kas 2026'dan beri
anasayfayı açan yolculuk 21 Kas 2026'da kaldırıldı. Anasayfa, çubuğun altında
ekranın kalanını dolduran tam genişlik bir filmle açılır (`home-hero.tsx`,
stili `src/styles/home.css`): üç klip sırayla oynar; sol altta klibin
başlığı, sağ altta bağlantısı ve 01/02/03 sayfalayıcı (telefonda alt
alta). Filmin altında `home-page.tsx`'in bölümleri gelir:
Şimdi barda (canlı menüden dört kalem, fotoğraflılar önce), imza içeceği,
Kategoriler, Evde L'Affogato, karaoke (ayarlardan ve bugünün boş
saatlerinden), uygulama, Bizi ziyaret edin, Rehberler (`home-app-intro`,
`home-take-home` ve `home-karaoke` buraya katıldı). Unutulmaması gerekenler:

- **Film lisanslı stok, bizim çekimimiz değil.** Üç Mixkit klibi, sessiz
  H.264, `faststart`: `public/video/hero-{1,2,3}-{wide,tall}.mp4` ve her
  kesimin ilk karesinden `.webp` afiş. Geniş kesim 1920px; dik kesim
  720×1280, telefon (`max-width: 767px`) onu alır. Klipler, kesim noktaları
  ve lisans `docs/MEDIA-LICENSES.md`. Başlıklar ve bağlantılar koddadır
  (`HERO_SLIDES`); panelin anasayfa slaytları (`/admin/anasayfa-hero`)
  yolculuk döneminde olduğu gibi sayfada değil (`page.tsx` okumaz).
- **Ne zaman oynar.** Sunucu afişleri çizer: ilk afiş (`fetchpriority="high"`)
  sayfanın en büyük boyamasıdır, ekran hiç boş kalmaz. Film hidrasyondan
  sonra, yalnız azaltılmış hareket ve Save-Data yokken başlar; hero en az %15
  ekrandayken ve sekme görünürken oynar, değilse durur. Azaltılmış harekette
  ve Save-Data'da `<video>` hiç çizilmez: klip inmez, afiş kalır. Durdur /
  oynat düğmesi yok (operatör, 22 Kas 2026: _"slider durdur devam ettir
  gibi şeyler ekleme"_; mağaza slaytları da öyle, onlar fare ya da klavye
  üstündeyken durur). Bu WCAG 2.2.2'den bilinçli bir ayrılıştır; hareketi
  istemeyen ziyaretçi için azaltılmış hareket ayarı filmi hiç başlatmaz.
  Tarayıcı otomatik oynatmayı reddederse (düşük güç modu) afiş kalır.
- **Ne zaman iner.** Üç afiş ilk boyamada iner (pasif slayt yalnız
  saydamdır, `loading="lazy"` onu bekletmez). İlk klibin kaynağı
  hidrasyondan sonra verilir (`preload="auto"`); sıradaki, çalan klibin
  yarısı geçince (geçişte boşluk olmasın diye), sayfalayıcıdan seçilen hemen.
  Rakamlar aşağıda "Vercel kullanım sınırı".
- **Yolculuktan bir şey kalmadı:** kare paketleri (`journey/frames/*.bin`),
  WebGL derinlik ve yanma çizicileri, ön yükleyici, halka imleç, cam kartlar,
  Instrument Sans / Serif istisnası ve üst çubuğun `data-journey*` hâlleri
  silindi. Kaydı ve Blender betikleri git'te:
  `git show 4962da2:docs/JOURNEY.md`,
  `git show 4962da2:docs/journey/scene.py` (yanında `grade.py`, `pack.py`).

**Gri kömür zemine yazılmaz** (21 Kas 2026; 21 Kas'a kadar "karamel ile
espresso", 11 Kas'a kadar "bordo ile yeşil"). `--muted` `#6c6864` beyazda
5.5:1, bantta 5.1:1 tutar, kömürde 2.3:1'de kalır. Koyu zeminde (kömür blok,
footer, film) yazı `--on-dark` (beyaz, kömürde 12.6:1) ya da
`--on-dark-muted` (%72 beyaz, kömürde 7.4:1) olur; `data-ground="dark"` ya
da `.on-dark` klavye odağını da beyaza çevirir. Filmin üstündeki beyaz yazıyı
alt gölge (`.hero-film-shade`) tutar; oran kareye göre değişir. Bu oranları
tutan test artık koşmuyor (en üstteki not): token değişince elle ölçülür
(aşağıda "Tasarım Sistemi").

## Site görselleri panelden (22 Kas 2026)

Operatör: _"sitedeki görselleri panelden de yönetebiliyor olalım ... karaoke
fotoğrafı admin panelden değiştirilebilir olsun"_. **Site metinleri ›
Görseller** (`/admin/gorseller`, `content` bölümü): 19 alan (sayfa
açılışları, karaoke açılışı ve odası, anasayfa bölümleri, ziyaret ve hikâye
kartları, franchise sayfasının iki fotoğrafı;
`src/lib/admin/site-images-core.ts`). Yüklenen fotoğraf
`site_images`'ta durur, `/gorsel/site/<key>?v=<damga>` ile sunulur; sayfalar
haritayı `getSiteImages()` ile önbellekten okur (`pub:site`; `loadAppProps`
→ `images`, karaoke ve kampanya rotaları doğrudan). Yüklenen görsel
`next/image`'da `unoptimized` çizilir (Next 16 yerel `?v=` adresini
`localPatterns` olmadan optimize etmez); paketteki fotoğraflar optimize
edilir. Yeni bir alan: önce sayfada okunan yere bağla, sonra listeye ekle
(okunmayan alan panelde boşuna durur). Karaoke sayfasında sihirbazla SSS
arasında kömür "sahne" bandı odanın fotoğrafını (`karaoke.room`) ve panelin
üç rakamını gösterir.

## Franchise başvurusu (22 Kas 2026)

Operatör: _"franchise bölümü ekle form doldurulan ve açılır sectionlar
dahil tasarım metriklerine uyumlu olsun estetik yap"_. **`/franchise`**
(`src/app/franchise/page.tsx`, gövdesi `franchise-page.tsx`, formu
`franchise-form.tsx`, stili `src/styles/pages.css` "Franchise"): sayfa
açılışı, bantta konsept bölmesi, solda başlık sağda akordeon ("Neler
sunuyoruz", "Sık sorulan sorular"; `<details>`, Archivo büyük harf, çizilmiş
artı), derin yeşil bantta çizgili satırlarla beş adım, adaçayı bantta beyaz
panelde başvuru formu.
Sayfa markanın yeşilini giyer (operatör: _"renkleri de yeşilimsi yap bizim
renkler gibi"_; sitede yalnız bu sayfa): kökteki `.theme-forest` sitenin
token'larını `--forest`, `--sage` ailesine bağlar, süreç bandı derin yeşil
(beyaz başlık, pirinç rakam); footer kömürde kalır (`docs/BRAND.md` §10).
Bağlantılar: footer'ın Kurumsal sütunu, Ziyaret & keşfet panelinin Keşfet
sütunu (telefon paneli de), site haritası. Görüntüleme veritabanını
uyandırmaz (`getSiteSettings`, `getSiteImages`; fotoğraflar `hero.franchise`
ve `franchise.concept`).

- **Metin söz vermez:** franchise bedeli, royalti, yatırım tutarı, getiri ya
  da şube sayısı yazılmaz; "görüşmede yazılı olarak paylaşırız" denir.
  Başvuru ücretsizdir ve SSS bunu söyler (hukuk metinleri, "Kurumsal Satış
  ve Basın İletişimi": şirket adına başvuru ücreti isteyen şirkete ait
  değildir). Uygulama, damga ve masadan sipariş bugün yalnız Tuzla köşkü
  içindir; sayfa yeni şubeye açılmayı söz olarak yazmaz.
- **Form** (`submitFranchiseApplicationAction`, alanlar
  `docs/FRONTEND-SINIR.md` §2): Zod (`src/lib/franchise/franchise-core.ts`,
  istemciyle ortak etiketler), tuzak alan `website` (doluysa "teşekkürler",
  kayıt ve e-posta yok), bağlantı başına günde 5 başvuru
  (`franchise-apply-ip`), satır `franchise_applications`'a (`frn-0001`;
  aydınlatma kutusu işaretsiz başlar, onay `{at, ip, userAgent, version}`
  olarak saklanır). Ekibe `operasyon-bildirim` e-postası `after()` ile
  gider (`src/lib/franchise/notify.ts`, alıcı Ayarlar › Bildirimler'in
  operasyon adresi, yoksa Ayarlar e-postası; yanıtla başvurana yazar),
  başvurana `franchise-basvuru` ("Başvurunu aldık": gönderdiği yanıtlar,
  başvurunun ücretsiz olduğu, saklama süresi; işlemsel, çıkış satırı yok;
  yalnız ilk adı yazar). İkisi birbirinden bağımsızdır ve başvuruyu
  bozamaz. Form elle gönderilir (yanlış alanda yazılanlar
  kalır); JavaScript'siz de aynı action çalışır.
- **Panel:** Pazarlama › **Franchise** (`/admin/franchise`, bölüm `leads`:
  sahip + yönetici): Yeni / Görüşüldü / Arşiv sekmeleri, başvuru sayfası
  (iletişim, yanıtlar, aydınlatma onayı), durum düğmeleri ve onaylı "Sil";
  her yazım olay kaydına (`franchise_application`) düşer.
- **Saklama:** başvurudan 12 ay sonra günlük imha işi siler
  (`src/lib/retention.ts`, kural `franchise-applications`; yayımlanmış
  dayanak "İş birliği ve tedarik teklifleri" satırının iki yıllık tavanı).
  Politika franchise başvurusunu henüz adıyla anmaz: anılması bir hukuk
  revizyonudur (`LEGAL_UPDATED`), operatörün kararı.

## Ön yüz ↔ Arka yüz Sınırı

> **Müşteri arayüzü yeniden tasarlanacak; arka yüz bundan etkilenmemeli.**
> Tam sınır, alan tabloları ve kontrol listesi: **`docs/FRONTEND-SINIR.md`**.
> Ön yüz işine başlarken skill: **`frontend-redesign`**.

- **Ön yüz (serbest):** `src/components/laffogato/**`, `src/components/uye/**`,
  `src/components/customer/**`, `src/app/globals.css`, `src/styles/**`,
  müşteri `page.tsx` / `*-form.tsx` dosyalarının **işaretlemesi**,
  `public/**`.
- **Arka yüz (ön yüz PR'ında değişmez):** `src/lib/**`,
  `src/app/**/actions.ts`, `src/app/**/route.ts`, `src/app/api/**`
  (özellikle `api/mobile/v1` — sahadaki uygulama), `src/proxy.ts`, `db/**`,
  `scripts/**`, `next.config.ts`, `vercel.json`, `docs/API-MOBILE.md`,
  `src/app/admin/**`. Gerçekten gerekiyorsa **ayrı PR**.
- **Aradaki sözleşme** (TypeScript ve build bunları görmez; testler görür):
  1. Form `name`'leri = action'ın `formData.get(...)` adları —
     `tests/frontend-form-contract.test.ts`. Form başka dosyaya taşınınca
     yalnız testteki `forms` yolu güncellenir, alan listesi değil.
  2. Onay kutuları (`legalConsent`, `acceptedTerms`, `marketing`,
     `newsletter`, `consent`) işaretsiz başlar — aynı test.
  3. Sepet: `localStorage["laffogato_cart_v1"]` ve `items` JSON biçimi
     (`productId, variantId, name, price, qty`; fiyat yalnız gösterim).
  4. Action'ların yönlendirmeleri sayfada karşılanır: `/?cart=…`,
     `/?hesap=silindi`, `/odeme?error=consent|payment`, `/uye/giris?next=…`,
     `/bulten/onay?sonuc=…`, `/bulten/cikis?sonuc=…`. Bülten onayı ve çıkışı
     **düğmedir** (POST) — e-posta tarayıcıları bağlantıları açar.
  5. Dışarıdan çağrılan yollar yeniden adlandırılmaz: e-posta linkleri,
     `/odeme/donus`, `/gorsel/**`, `/hukuk/[slug]`, `/bulten/cikis`,
     `/bulten/onay`, `/masa/[code]` (masalardaki basılı QR), `/api/**`.
  6. Genel sayfa veriyi `loadAppProps()` ya da `src/lib/seo/site-data.ts`'in
     önbellekli okuyucularıyla (`getSiteSettings`, `listSite*`,
     `getSiteProductBySlug`, ...) okur: sayfa görüntülemesi veritabanını
     uyandırmaz. `getPublicSettings()` ve `store.ts`'in `list*` / `get*`
     okuyucuları her seferinde veritabanına gider; ödeme, karaoke, uygulama
     API'si ve üyenin kendi sayfaları içindir
     (`tests/public-pages-cached-reads.test.ts`). Bileşende `@/lib/db` yok;
     istemci bileşeni `server-only` modül import edemez (saf mantık için
     `*-core.ts` / `*-utils.ts`).
- **Ön yüz PR'ı bitmeden:** `git diff --stat origin/main -- src/lib src/app/api
  db scripts src/proxy.ts 'src/app/**/actions.ts' 'src/app/**/route.ts'`
  **boş** dönmeli.

## Klasör Yapısı

```
src/
  app/
    page.tsx                 → Müşteri SPA entrysi (hash router: #home, #menu, ...)
    layout.tsx               → next/font ile iki ses (Archivo başlık, değişken
                               genişlik ve kalınlık; Geist metin) + Consent
                               Mode bootstrap (GTM'den önce) + GTM
    globals.css              → Tailwind + src/styles/*.css (sayfa sırasıyla)
                               + panelin geri alma ve baskı kuralları; site
                               stili ve token'lar src/styles/'ta
    menu/ magaza/ hikayemiz/ → Müşteri rotaları (SPA içeriğinin SEO'lu karşılıkları)
    ziyaret/ hukuk/
    odeme/                   → Tek sayfa checkout (checkout.tsx + kartın yerli
                               formu card-payment.tsx) + startCheckoutAction +
                               /basarili
    uye/                     → Müşteri hesabı (giriş, kayıt, sipariş geçmişi,
                               adresler, favoriler, promosyonlar, bildirimler)
    admin/                   → Admin panel (proxy korumalı)
      urunler/ kategoriler/  → Shop ürünleri (wizard, ice-aktar: CSV) +
                               kategoriler
      menu/                  → Kafe menüsü
      siparisler/            → Sipariş listesi + detay + manuel sipariş
      masalar/               → Masalar · QR (sahip + yönetici): ad, QR, yazdır,
                               pasifleştir, kodu yenile
      musteriler/            → CRM-lite
      promosyon/ raporlar/   → Promosyon kodları · ciro raporları
      stok-hareketleri/      → Stok audit + manuel düzeltme
      olay-kaydi/            → Mutasyon audit log (owner-only)
      icerik/ hikaye/ basin/ → Site içeriği, hikaye zaman çizelgesi, basın
      magaza-hero/           → Mağaza hero slaytları
    hukuk/ bulten/ ayarlar/→ Hukuki metinler · bülten · ayarlar
      giris/ iki-asama/      → Login + 2FA akışı
      2fa-kurulum/
    masa/[code]/             → Masadaki QR'ın açtığı salt görüntüleme menü +
                               masa adı (noindex, sitemap'te yok)
    rehber/                  → SEO rehber hub'ı + /rehber/[slug] (Article +
                               FAQPage + Recipe yapısal verisi)
    api/webhooks/payment/    → Sunucudan sunucuya ödeme bildirimi (HMAC)
    api/panel/karaoke/       → Köşkün panelinin imzalı karaoke okuması
                               (HMAC, docs/PANEL-KARAOKE.md)
    api/panel/menu/          → Köşkün panelinin imzalı menü okuması ve
                               fiyat / satış durumu yazımı (docs/PANEL-MENU.md)
    api/panel/orders/        → Köşkün bar ekranına açık kafe siparişleri
                               (imzalı okuma) + stage/ (tek dokunuş aşama;
                               docs/PANEL-ORDERS.md)
    api/panel/sales/         → Köşkün kâr-zararına ve kasa raporuna dönemin
                               online satışı (imzalı; docs/PANEL-SALES.md)
    api/mobile/v1/           → Mobil uygulama API'si (docs/API-MOBILE.md):
                               menu · shop · bootstrap · live-status ·
                               karaoke/* (herkese açık) · me/* · orders/* ·
                               loyalty/redeem · coupons · invite/claim ·
                               tables/{code} (herkese açık, masa QR'ı) ·
                               notifications (Bearer Supabase JWT) · app-content
    odeme/app-hata/          → Uygulama ödemesi başarısız → derin bağlantı
    odeme/donus/             → Sanal POS'un MÜŞTERİYİ POST ettiği dönüş
                               (PAYNKOLAY_SUCCESS_URL + _FAIL_URL burayı göstermeli)
    gorsel/                  → Yüklenen görsellerin önbelleklenebilir servisi
    bulten/cikis/            → Tek tıkla bülten aboneliğinden çıkış (6563)
  proxy.ts                   → (src/ kökünde) Supabase oturum yenileme +
                               cookie-tabanlı admin guard
  components/
    laffogato/               → Müşteri SPA
      app.tsx                → Shell (cart, route, notice, settings)
      chrome.tsx             → Duyuru satırı + Nav (paneller, telefon paneli,
                               hızlı bağlantı çipleri) + Footer
      home-page.tsx · menu-page.tsx · shop-page.tsx ·
      story-page.tsx · visit-page.tsx
                             → Sayfa gövdeleri; app.tsx her birini
                               next/dynamic ile ayrı chunk olarak yükler
                               (statik import etme - spa-page-chunks testi)
      home-hero.tsx          → Anasayfanın filmi: üç klip, afişler,
                               sayfalayıcı (public/video)
      page-hero.tsx          → <PageHero>: anasayfa dışındaki sayfaların
                               açılışı (geniş fotoğraf, başlık, paragraf)
      page-shared.ts         → PageProps + MENU_TAG_LABELS
      ui.tsx                 → ProductCard, CartDrawer, ProductModal, ...
      visuals.tsx            → ProductSurface + MenuPlate: fotoğraf ya da
                               bandın düz zemini (çizim yok)
      scenes.ts              → Sahne pigmentleri: sitede çizilmez, yalnız
                               panelin anasayfa slaytları okur
      product-detail.tsx     → Ürün detay (PDP)
      shop-hero-slider.tsx   → Mağaza hero karuseli
      data.ts                → Statik seed (MENU, PRODUCTS, LOCATION, ...)
    admin/                   → Admin form primitives + liste/form bileşenleri
      forms.tsx              → Field, TextInput, Select, Button, Card, ...
      product-wizard.tsx     → 5 adımlı ürün sihirbazı (yeni + düzenle)
  styles/                    → Müşteri sitesinin stili (21 Kas 2026)
    foundation.css           → Token'lar (:root), taban, yazı, kontroller,
                               düzen, medya, hukuki asgari (16px), eski adlar
    chrome.css               → İşaret, duyuru satırı, çubuk ve paneli,
                               telefon paneli, footer, çerez şeridi
    sections.css             → Ortak bölümler: sayfa açılışı, bölme, kart
                               satırları, döşemeler, çizgili liste, galeri
    home.css                 → Anasayfa filmi + yalnız anasayfanın bölümleri
    catalog.css              → Mağaza ve menü koleksiyonu, filtre çekmecesi,
                               sepet, hızlı bakış, ürün sayfası, arama
    pages.css                → Hikaye, ziyaret, kampanyalar, rehberler, hukuk,
                               404 ve hata, küçük sayfalar (bülten, masa)
    karaoke.css              → Karaoke sihirbazı ve rezervasyon görünümü
    checkout.css             → /odeme, başarılı ve uygulama hatası sayfaları
    account.css              → Üye alanı (/uye/*)
  lib/
    admin/                   → auth · store (veri katmanı) · audit · roles ·
                               product-schema (Zod)
    customer/                → Müşteri hesapları, kuponlar, auth
                               supabase-bridge.ts + supabase-link-plan.ts
                               (Supabase kullanıcısı ↔ customers satırı) ·
                               member-orders.ts (sipariş geçmişi — yalnız
                               doğrulanmış e-postaya)
    supabase/                → config · anon (bearer doğrulama) · server ·
                               client · proxy (oturum yenileme) — YALNIZ kimlik
    mobile/                  → Mobil API iş mantığı: auth (requireMobileCustomer) ·
                               respond · menu(-mapper) · customization ·
                               orders · order-{schema,pricing,mapper,address} ·
                               me(-mapper/-schema) · loyalty(-core) · invite(-code) ·
                               venue · karaoke · notifications · deep-link
    panel/                   → Köşkün paneliyle bağlantı: imza, pencere,
                               beyaz liste (karaoke-sync-core) · ortak ping
                               (ping.ts; karaoke-, menu-, orders-ping) · menü
                               (menu-link-core) · bar ekranı (orders-feed-core)
                               · online satış (sales-export-core)
    payment/                 → PaymentProvider arayüzü + Mock/PayNkolay sağlayıcıları ·
                               paynkolay-card (kart doğrulama) · paynkolay-page
                               (ödeme sayfaları + kendi CSP'leri)
    legal/                   → entity.ts (yasal kimlik TEK KAYNAK + {{TOKEN}}) ·
                               content.ts (sözleşme metinleri, ham veri) ·
                               documents.ts (token doldurma + LEGAL_DOCS) ·
                               nav.ts (footer linkleri) · markdown.tsx · store.ts
    db/                      → index.ts (pg havuzu + getDb + TABLES) ·
                               client.ts (sorgu kurucu) · sql.ts (SQL derleyici) ·
                               health.ts (bozulma sınıflandırması) · counters.ts
    seo/                     → site.ts (NAP + sabitler) · structured-data ·
                               section-page · pages.ts (route SEO) · faq.ts ·
                               guides.ts + guide-content.ts (rehber içeriği) ·
                               guide-structured-data.ts · guide-nav.ts ·
                               og-card · og-pages · og-drawings · og-product
                               (paylaşım kartları, docs/SEO.md §2)
    consent/                 → cookie.ts (rıza durumu) · script.ts (Consent Mode v2)
    newsletter/              → store.ts (6563 onay kaydı + tek tıkla çıkış)
    utils/                   → commerce.ts (kargo) · kdv.ts (ürüne göre KDV
                               oranı ve oran oran döküm) · format.ts (priceLabel,
                               parseMoneyInput — admin tutar girişi)
    http/                    → etag.ts · same-site-path.ts (yönlendirme hedefi)
db/
  migrations/                → SQL migration'lar (`npm run db:migrate`)
  schema.sql                 → Üretilen tek dosyalık şema (`npm run db:bundle`)
scripts/                     → db-migrate.mjs · db-bundle.mjs
docs/                        → BRAND.md (marka kimliği, tasarım kaydı) ·
                               MEDIA-LICENSES.md (film ve fotoğraf kaynakları)
                               · DATABASE.md · SEO.md · PROMPT.md · AUDIT.md ·
                               API-MOBILE.md (mobil sözleşme) · AUTH-BRIDGE.md ·
                               SUPABASE-GECIS.md · PAYNKOLAY.md · GELIVER.md ·
                               EMAIL-RESEND.md · FRONTEND-SINIR.md (ön yüz ↔
                               arka yüz sınırı) · ADMIN-INNEX.md (panelin
                               tasarım tarifi)
```

## Kayıt doğrulaması uygulamada, seçenekler ve fiyat tazeliği (5 Kas 2026)

- **Doğrulama bağlantısı:** Supabase "Confirm signup" şablonu
  (`docs/email/supabase-confirm-signup.html`, panele elle yapıştırılır)
  `https://laffogato.net/uygulama/dogrula?token_hash=…&type=email`'e gider ve
  6 haneli kodu yazar. Site sayfası (`src/app/uygulama/dogrula/`) jetonu
  proxy'de çereze taşır, düğmeyle (POST) doğrular, kimseyi içeri almaz.
  AASA `/uygulama/*`'ı yalnız panelin en düşük sürümü 1.1.1 olunca talep eder
  (`src/lib/mobile/app-links.ts`; 1.1.0'da o ekran yok). Uygulama tarafı
  lafmobil `docs/AUTH.md` §5d.
- **Seçenekler:** süt üç (Normal, Laktozsuz, Badem; yulaf kalktı, "oat"
  kimliği eski siparişler için tanınır ama yeni satırda reddedilir). Menü
  kalemi `optionGroups` taşır (`optionGroupsFor`, sözleşme §1): soda, smoothie
  ve frozen'da hiçbir seçenek, espressoda süt yok. Yalnız çizimi daraltır,
  siparişi reddetmez.
- **Fiyat tazeliği:** fiyatın tek kaynağı `menu_items`; site paneli,
  lafmaliyet ve LafPOS oraya yazar. 6 Kas 2026'dan beri `/menu` CDN'de 60 +
  60 sn (`s-maxage=60, stale-while-revalidate=60`) ve uygulama menüyü 2
  dakika tutar: fiyat ve fotoğraf en kötü ~4 dakikada görünür (sözleşme §1
  "Tazelik penceresi"; fotoğraf URL'si içerikten damgalı).

## Google ile giriş (8 Kas 2026)

Operatör: _"uygulamaya google ile giriş alt yapısı yap hazırla ve diğer site
repolarıyla da bağlantılı hale getir"_. Google, ortak Supabase projesinin bir
sağlayıcısıdır; site oturumu, mobil API'nin bearer doğrulaması ve
`customers` eşlemesi (e-postayla, tek üyelik) değişmedi.

- **Anahtar:** Mobil → Ayarlar → Giriş yöntemleri
  (`mobileApp.signIn.google`, varsayılan kapalı; `bootstrap.app.signIn`,
  `docs/API-MOBILE.md` §10). Site `/uye/giris` ve `/uye/kayit`'ta "Google
  ile devam et"i hemen çizer; uygulama yalnız bu özelliği taşıyan derlemede
  ve iOS'ta Apple ile giriş yanındayken (App Store 4.8).
- **Akış:** `GET /uye/google` (PKCE, düz bağlantı: CSP `form-action 'self'`
  form yönlendirmesini keser) → Google → `GET /uye/google/donus` (ortak giriş
  bütçesi, kod değişimi, köprü, sitenin çerezi). Yeni üye
  `/uye/google/onay`'da sözleşmeyi onaylamadan satır açılmaz; onay anları
  Supabase metadata'sına (`terms_accepted_at`, `marketing_consent_at`) yazılır,
  uygulama da aynı anahtarları yazar.
- **Açmadan önce (operatör):** Google Cloud OAuth istemcisi, Supabase'de
  Google sağlayıcısı ve yönlendirme adresleri, hukuk metinlerinde Google'ın
  kimlik sağlayıcısı olarak anılması. Sıra ve ekran ekran adımlar lafmobil
  `docs/GOOGLE-GIRIS.md`; tasarım `docs/AUTH-BRIDGE.md` §7.

## Marina şubesi: yalnız sitede (5 Kas 2026)

Operatör: _"Laffogato Marina şubesi ... açıldı olarak göster"_, kapsam
**yalnız site**. Kayıt `src/lib/seo/branches.ts` (`MARINA_BRANCH`, kimliği
lafmaliyet'in şube kütüğüyle aynı: `marina`); `/ziyaret`'te kart ve footer'da
bir satır. Adres, telefon ve saat o gün hiçbir yerde yoktu: alanlar boş, boş
alan basılmaz, adres girilene kadar harita bağlantısı ve JSON-LD yok
(`tests/site-branches.test.ts`). Aynı gün operatör: _"Marina tuzla
marinada"_; saat _"açılış 10 kapanış 2300"_ ile "10:00 - 23:00" (gün
söylenmedi, "Her gün" yazılmaz). 22 Kas 2026: _"Marinadaki adrese tuzla
viaport marina adresi yazabilirsin"_: kart "Viaport Marina Tuzla, Cami Mah.
/ 34940 Tuzla / İstanbul" yazar, haritayı "Viaport Marina Tuzla, Tuzla,
İstanbul" aramasıyla açar (marinanın sokak adresinde kaynaklar ayrışıyor,
sokak yazılmaz). Marinadaki birim ve telefon hâlâ boş; kart yalnız eksik
olanı "çok yakında" diye söyler (`branchPending`). Aynı gün: _"Marinadaki
karaoke rezervasyonlu değil ... marinada aktif değil henüz"_: metinler
Marina'da karaokenin henüz aktif olmadığını ve başladığında rezervasyonla
çalışmayacağını söyler; rezervasyonlu oda yalnız Tuzla'nın. Şubeler için JSON-LD hiç basılmaz (`structured-data.ts`). Uygulama, sipariş, damga, masa QR'ı ve karaoke
yalnız Tuzla köşküne hizmet eder; kart bunu yazar. (21 Kas 2026'dan beri tek
istisna Marina'nın LafPOS'unun bastığı masa kartlarıdır: o masadan verilen
sipariş ve çağrı Marina'nındır; aşağıda "Şubeler".) Hukuk metinlerinde 12 belge
(ÖBF ve MSS dahil) hâlâ "tek şube bulunduğundan konuma bağlı bir işlev yoktur"
der: düzeltilmesi onay sürümünü (`LEGAL_UPDATED`) taşır, ayrı bir hukuk
revizyonudur ve operatörün onayını bekler.

## Kafede yalnız gel-al, kurye şimdilik kapalı (5 Kas 2026)

Operatör: _"kahvelerde sadece gel al yap ayrıca kurye olmasın şimdilik"_.
Anahtar koddaki bir sabit değil, panelin kendisidir: **Mobil → Ayarlar →
Kurye kapalı** (`mobileApp.ordering.deliveryEnabled = false`). `POST /orders`
kurye siparişini `400 fulfillment_unavailable` ile reddeder, uygulama (1.1.0
dahil) ödeme sayfasında yalnız "Gel al"ı çizer; masaya sipariş (QR) kendi
anahtarıyla açık kalır. Sitenin kurye satırları (Ana Sayfa'nın sipariş kapısı
ve uygulama maddesi, `/ziyaret`'in kurye kutusu) aynı anahtarı okur
(`app-props.ts` → `courierEnabled`) ve kapalıyken gel-al süresini yazar
(`tests/site-settings-reach.test.ts`). `public/llms.txt` sabittir: kurye geri
gelince elle düzeltilir. Hukuk metinleri kuryeyi bir seçenek olarak anlatır ve
değişmedi (seçeneğin kapalı olması metni yanlış yapmaz).

## Masalar (QR) ve "yeni sipariş" e-postası (15 Eki 2026)

- **Masa = ad + rastgele kod.** `public.cafe_tables`; kod 10 karakter Crockford
  base32 (`cafe-tables-core.ts`, sunucu üretir, sıralı değil), QR içeriği hep
  `https://laffogato.net/masa/<kod>` (apex, sabit - laminasyonlu kart).
  Silinmez, pasifleşir; kart kötüye kullanılırsa "Kodu yenile". Panel
  `/admin/masalar` (`tables` bölümü: sahip + yönetici); SVG indirme route
  handler'ı (`/admin/masalar/[id]/qr`) oturumu ve rolü **kendisi** denetler.
- **Masaya sipariş yalnız uygulamadan** (`fulfillment: "table"` + `tableCode`,
  kafe; adres yok, planlı saat yok, pasif masaya yok) ve **ön ödemeli** (kart
  PayNkolay, cüzdan ya da sıfır tutar) - kasada ödeme yok. Masa kodu ve adı
  siparişe anlık görüntü olarak yazılır (`orders."tableCode"`, `"tableName"`).
  Herkese açık arama (`GET /api/mobile/v1/tables/{code}`, `/masa/[code]`, sipariş
  yolu) yalnız `{code, name}` verir; bulunamayan kod üye + IP (oturum yoksa IP)
  başına sayılır (`table-lookup`). Sözleşme: `docs/API-MOBILE.md` §3 ve §22.
  **5 Kas 2026'dan beri** (lafmobil 1.1.0 App Store'da, masa ekranıyla) AASA
  `/masa/*`'ı talep eder: uygulaması kurulu iPhone kartı kamerayla okutunca
  uygulama o masayla açılır; uygulaması olmayana `/masa` sayfası "siparişini
  uygulamadan ver" der (`table-banner.tsx`). Android `/masa/` öneki lafmobil
  `app.json`'ında, ilk Play derlemesiyle gelir. Kod yenilenince eski kart
  hemen masadan kaldırılmalı.
- **Masadan garson çağırma** (6 Kas 2026): uygulamadaki "Garson çağır"
  (`waiter` / `water` / `napkin`) `POST /api/mobile/v1/tables/{code}/calls`
  ile `table_calls`'a yazılır (masa kodu ve adı anlık görüntü, üyenin
  e-postası yalnız sitede; 30 gün sonra imha, hesap kapanınca anonim).
  Aynı masanın aynı sebepli açık çağrısı (15 dakika) yenisini açmaz; üye
  dakikada 1, saatte 10 çağrı (`table-call`, `table-call-hour`). Yazım
  `live:orders`'ı düşürür: sitenin sipariş zili "Masa 4 · Su istiyor" diye
  çalar, `/admin/siparisler` üstte "Masa çağrıları" gösterir, bar ekranı
  `GET /api/panel/orders` `calls`'tan alır ve imzalı `POST
  /api/panel/calls/ack` ile yanıtlar. Anahtar: Uygulama ayarları › Sipariş
  (`tableCallsEnabled`, `tableEnabled` ile birlikte). Sözleşme
  `docs/API-MOBILE.md` §22.1, panel `docs/PANEL-ORDERS.md` "Masa çağrıları".
- **LafPOS'un bastığı kart** (28 Eki 2026): kasa masa kodunu kendisi üretir ve
  imzalı `PUT /api/panel/tables` ile buraya yazar (`importCafeTables`: yeni
  kod eklenir, var olanın adı ve etkinliği güncellenir, listede olmayan masaya
  dokunulmaz; `docs/LAFPOS.md` "Masa kodları").
- **Personel e-postası:** `applyPaymentSucceeded` siparişi gerçekten `paid`'e
  taşıdığında `after()` ile, sipariş başına **bir kez** (`order_notice_emails`,
  kind `staff-new`), tek batch isteğinde, 429/5xx'te kısa yeniden denemeyle
  gider (ayrıntı `docs/EMAIL-RESEND.md` "Yeni sipariş bildirimi")
  (`src/lib/email/staff-order-notice{,-core}.ts`, `operasyon-bildirim`
  şablonu). Alıcılar Ayarlar → Bildirimler: roller, ek adresler, operasyon
  adresi. İçerik müşterinin **yalnız adını** taşır; telefon, e-posta, adres,
  soyad ve kurye notu (kapı kodu) yazılmaz. Ödemeyi bekletmez, bozamaz.

## Köşkün paneli: karaoke bağlantısı (21 Eki 2026)

Köşkün iç paneli (ladmin.laffogato.net, `RiosenBeq/lafmaliyet`) bardaki hep
açık ekranda karaoke odasını sayar ve yeni rezervasyonda çalar. `live:karaoke`
etiketini düşüren her yazım, yazım kancasından (`src/lib/db/index.ts`
`onWrite`) yanıttan sonra panele içeriksiz, imzalı bir ping atar
(`src/lib/panel/karaoke-ping.ts`); panel pencerenin rezervasyonlarını imzalı
`GET /api/panel/karaoke`'tan çeker. Paylaşılan anahtar `KARAOKE_SYNC_SECRET`
(iki projede aynı); yoksa ping gitmez ve çekme ucu panele kapalıdır; LafPOS'un
anahtarı (`LAFPOS_SYNC_SECRET`) tanımlıysa uç yalnız LafPOS'a, dünden yarına
açıktır (`docs/LAFPOS.md`). Panele yalnız ad, saat, kişi
sayısı, durumlar, not, tutar ve iptalde iade tutarı (`refundMinor`; 0 = iade
yok) gider; e-posta, telefon, soyad, ödeme referansı asla
(`toPanelReservation` beyaz listesi). İmza kuralları
`src/lib/panel/karaoke-sync-core.ts`'te ve panelde bayt bayt aynı; iki tarafın
testleri aynı vektörleri sabitler. Ping yazımı asla bozmaz. Ayrıntı:
`docs/PANEL-KARAOKE.md`.

**Elle rezervasyon ve kapalı saat (22 Kas 2026).** Operatör: _"laffogato
admin panelinden veya ladmin panelinden de manuel rezervasyon alınsın,
oradan dolu yapılabilsin ki insanlar siteden bakınca görsünler"_. Panelde
Karaoke › **Elle ekle** (telefon / kasa rezervasyonu ya da "Saati kapat"),
ladmin ve LafPOS için imzalı `POST /api/panel/karaoke` (`create` / `cancel`,
`actor` zorunlu). Tek kural `src/lib/mobile/karaoke-desk.ts`: satır
`channel: "desk"`, `confirmed`, `paymentStatus: "none"` (ödeme köşkte;
online satışa ve e-Arşiv'e girmez), e-postasız satır
`desk-<id>@laffogato.invalid` taşır ve ona e-posta gitmez
(`isDeskPlaceholderEmail`). Panelin satırında `desk: true` (ekleme).
Ayrıntı `docs/PANEL-KARAOKE.md` "Elle rezervasyon ve kapalı saat".

## Karaoke iptal ve iade penceresi (28-29 Eki 2026)

Operatör: _"karaoke için 2 saat içinde iptal etmezse iade olamaz; e-ticaret
için de manuel işlem olsun, iade otomatik işlemesin"_. Üyenin ücretsiz iptal
penceresi **rezervasyonun yapıldığı andan** itibaren `freeCancelHours` (2) saat,
en geç rezervasyon saatinden bir dakika önce biter (`karaokeDeadlineFor`:
`min(yapıldığı an + 2 saat, başlangıçtan 1 dakika önce)`, son dakika dahil;
sayfalar son anı dakikasıyla yazar); dışında iade yok, rezervasyon durur. İki
cümle: "Rezervasyonu yaptığın andan itibaren 2 saat içinde, rezervasyon saati
gelmeden iptal edersen ödediğin tutarın tamamı kartına iade edilir." /
"Rezervasyonu yaptığın andan 2 saat geçtikten sonra yapılan iptallerde ve
rezervasyona gelinmediğinde ücret iadesi yapılmaz." (ikincisi `too_late`'te
tek başına yazılır). Her satır son anını ve iki cümlesini saklar; 28 Eki'den
önce yapılanlar eski kuralı (başlangıçtan 2 saat önce) korur, saat
değiştirilince de (`karaokeMovedDeadline`). Köşkün kendi iptali yine tam iade,
"Yine de tamamını iade et" durur; panelde 2-72 saat (ön ödeme rezervasyondan
75 dakika sonrasına kadar gelebilir). Web formu bastığı iki cümlenin
damgasını gönderir (`karaokeRulesStamp`): sayıları aynı, cümleleri farklı bir
sayfa `policy_changed` alır (yayın anı, LEGAL-REDLINES §37.7).
Sipariş iadesi **elle**: "İptal et" para iade etmez; yalnız "İade başlat" ya
da PayNkolay'da iade edip kaydeden düğmeler.

**Kararlar (29 Eki 2026, avukat yerine operatörün talimatıyla; LEGAL-REDLINES
§37.8).** %0 kuralında misafir pencereden sonra ama rezervasyon saatinden
önce köşke gelemeyeceğini bildirirse ("Misafir iptal istedi") rezervasyon
iade olmadan iptal edilir ve saati satışa açılır (`releaseLateBooking`;
`refunded` + `refundMinor` 0, `keptWholeOnLateCancel`); saat başka bir
misafire satılırsa o saatin tutarı yeniden satış yoluyla elle iade edilir;
bir satış alıcının kendi ücretsiz penceresi kapanınca sayılır (günlük iş
`karaoke-resale`, `chargeSettledResales`).
Üyenin kendi geç iptali (site, uygulama) yine `too_late`. Köşkün geç
iptalindeki telafi her işletme iptalinde doğar ve öyle kalır. Ücretsiz
telafi saati kendi kuralını taşır (`KARAOKE_MAKE_GOOD_POLICY` 2 / 0,
panelden bağımsız): başlangıcına 2 saatten fazla varken bırakılır, geç
verilmişse verildikten sonra 2 saat (`karaokeMakeGoodDeadline`), kendi iki
cümlesiyle (`karaokeMakeGoodRules`); koşullar §7, §8 ve Ödeme Koşulları §21
bunu yazar (29 Eki 2026). Ayrıntı: `docs/API-MOBILE.md` §7.1,
`docs/LEGAL-REDLINES-2026-09.md` §37.

## Köşkün paneli: menü bağlantısı (22 Eki 2026)

Operatör: _"bir yerden pasif yapınca veya fiyat değişince diğer yerlerden de
değişsin"_. Kalemin **satış fiyatı** ve **menüde olup olmadığı**nın tek
kaynağı sitedir (`menu_items`). Panel, ürün satırını sitedeki kaleme
bağlar (`products.siteMenuId` + `siteMenuSlot` M/L, panelde) ve:

- **okur:** imzalı `GET /api/panel/menu`;
- **değiştirir:** imzalı `POST /api/panel/menu`, menü formunun kurallarıyla.
  Site yalnız o sütunları yazar (`setMenuItemSaleFields`), olay kaydına
  "Yönetim paneli · <ad>" düşer, panel ancak 2xx'ten sonra kendi kopyasını
  yazar;
- **haber alır:** `pub:menu`'yu düşüren her yazım panele `menu.changed`
  pingi atar (`menu-ping.ts`).

Eski görüntüden yapılan yazım yenisini ezmez (28 Eki 2026): GET
`writes: {expect: true}` duyurur, panel yazdığı alanların gördüğü değerini
`expect` olarak gönderir, tutmazsa 409 `stale` (güncel kalemle); sitenin
menü formu yalnız dokunulan satış sütununu, yüklendiği değere koşullu yazar
(`menu-sale-guard.ts`). Üç deponun bağlantı haritası: `docs/PANEL-SENKRON.md`.

Anahtar karaoke'ninki (`KARAOKE_SYNC_SECRET`). Ad, açıklama, kategori, görsel
ve alerjen eşitlenmez. Kafenin kasası LafPOS menüyü ve fiyatı buradan çeker
(aşağıda); geçiş bitene dek ModPOS'un fiyatı elle değişir.

Fiyat listesi tarihini bağlantı değiştirmez (OP-PRICE-LISTS). Her fiyat
değişikliği `settings."menuPricesChangedAt"`'i yazar; Kafe menüsü, girilen
gün daha eskiyse uyarır. Ayrıntı: `docs/PANEL-MENU.md`.

## Kafenin kasası: LafPOS (26 Eki 2026)

Kafede ModPOS'un yerine geçen kasa `RiosenBeq/lafpos`: kafedeki bilgisayarda yerel
sunucu, kasa ekranı Chrome'da açık. **Tek sistem, iki yüz:** ürün yalnız bu panelde
eklenir ve değişir (ad, fiyat, boy, KDV, görsel); LafPOS menüyü herkese açık menü
ucundan (ETag) çeker, kasaya özgü alanları (istasyon, kısa ad, porsiyon) ve yalnız
kafede satılan hizmetleri (karaoke odası saatlik ücreti) kendisi tutar. Panelin imzalı
uçlarını (`/api/panel/menu`, `/api/panel/orders`, `/api/panel/karaoke`,
`/api/pos/orders/version`, `/api/panel/tables`) **kendi anahtarıyla** çağırır: `LAFPOS_SYNC_SECRET`
(`src/lib/panel/signed-callers.ts`; `KARAOKE_SYNC_SECRET`'e eşitse kapalı sayılır;
lafmaliyet'teki aynı adlı anahtardan ayrı değer). Anahtar yokken LafPOS'un imzalı her
isteği reddedilir (sahip, 26 Eki 2026: varsayılan kapalı); açılışta sitenin adımı
`docs/LAFPOS.md` "Varsayılan kapalı". LafPOS fiyat yazamaz (403), yalnız
Tükendi / Satışta; karaokeyi yalnız dünden yarına okur (daha genişi 403); olay kaydında
`lafpos:<ad>`. Maliyet ve muhasebe lafmaliyet'te
kalır, LafPOS gün sonunu oraya iter. Ayrıntı: `docs/LAFPOS.md`.

## Şubeler: sipariş, masa, çağrı ve Satışta / Tükendi (21 Kas 2026)

İlk LafPOS kasası Marina'da (Tuzla ModPOS'ta kalır). Site şube bilmediği için
Marina'nın kasası Tuzla'nın ödenmiş siparişlerini, çağrılarını ve karaokesini
kendi işi sayacak, tek "Satışta / Tükendi" bayrağıyla iki şube birbirinin
ürününü kapatacaktı. Artık (`src/lib/panel/branches.ts`, göç
`20261121150719_branches.sql`):

- `orders.branch`, `cafe_tables.branch`, `table_calls.branch` (varsayılan
  `tuzla`). Masa siparişi ve çağrısı masanın şubesi (anlık görüntü); gel-al,
  kurye, kargo ve karaoke Tuzla'nın. Sitenin panelinde Masalar › Düzenle ›
  Şube.
- İmzalı her uç bir şube adınadır: `?branch=` ya da gövdede `branch`; yoksa
  panelin anahtarı Tuzla (her şube adına konuşabilir), LafPOS'unki
  `LAFPOS_BRANCHES` (varsayılan `marina`). Başka şubenin siparişi / çağrısı
  409 `wrong_branch`, başka şubenin masa kodu `PUT /api/panel/tables`'ta 409
  `wrong_branch`, karaoke başka şube adına boş.
- "Satışta / Tükendi" şubeye göre: `menu_items."isActive"` menüde mi (her
  şube; sitenin formu), `menu_item_availability` şubenin kendi Tükendi'si.
  İmzalı yazım yalnız şubenin satırını yazar; LafPOS menüden kalkmışı açamaz
  (409 `site_closed`). Site ve uygulama Tuzla'nınkini, `/masa/<kod>` masanın
  şubesininkini gösterir; sipariş siparişin şubesinde denetlenir.
- `GET /api/panel/sales`'a `&branch=` ve `byBranch`.
- Seçenek ücreti (ekstra shot, şurup, ücretli süt) menü kalemlerinin
  fiyatından (S8: `mnu-0081`, `mnu-0080`, `mnu-0082`), sabit yedek.
- Testler `tests/sube/` (`npm run test:sube`; `TEST_DATABASE_URL` ile gerçek
  Postgres'e karşı da), CI'da değil. Ayrıntı `docs/LAFPOS.md` "Şube",
  `docs/PANEL-MENU.md` "Şube" ve "Seçenek fiyatları", `docs/PANEL-ORDERS.md`
  "Şube", `docs/PANEL-SALES.md` "Şube kırılımı".

## Köşkün paneli: bar ekranı ve online satış (22 Eki 2026)

Operatör: _"laffogato admin ile lafmaliyette paralel çalışabilecek neler
varsa ... beraber çalışsın"_. Aynı imza, aynı anahtar, aynı ping
(`src/lib/panel/ping.ts`; `live:orders`'ı düşüren her yazım panele
`orders.changed` atar):

- **Bar ekranı:** imzalı `GET /api/panel/orders` ödenmiş,
  hazırlanan ve gel-al'da teslim bekleyen **kafe** siparişlerini verir
  (`toPanelOrder` beyaz listesi: satırlar, seçenekleri ve satır notu, "Masa
  4" / "Gel-al" / "Kurye", planlı saat, **yalnız ad**, masa ve gel-al
  siparişinde üyenin notu (kuryede hiç: kapı kodu), sitedeki sayfasının
  yolu). Panelden
  elle girilen sipariş, mağaza kolisi, masaya / kuryeye gitmiş sipariş ve
  24 saattir ilerlemeyen gelmez. Barista siparişi bar ekranından tek
  dokunuşla ilerletir (22 Eki 2026): imzalı `POST /api/panel/orders/stage`
  `{id, action, from, actor}`, yalnız üç ileri adım (Hazırlanıyor, Hazır /
  Masaya götürüldü / Kuryeye verildi, Teslim edildi); hareketi site kendi
  `transitionOrder`'ıyla, kartın aşamasına koşullu yapar (stok, sadakat,
  e-posta, telefon bildirimi aynen; eski dokunuş 409). İptal ve iade yalnız
  bu panelde. Ayrıntı: `docs/PANEL-ORDERS.md`.
- **Telefon bildirimi (22 Eki 2026):** uygulama izin verilince Expo push
  jetonunu `POST /api/mobile/v1/devices`'a bildirir (`customer_devices`);
  kafe siparişi hazırlanınca, gel-al hazır olunca, kurye çıkınca, koli
  kargoya verilince ve ödenmiş sipariş iptal edilince `transitionOrder`
  `after()` ile bir kez (`order_push_notices`) gönderir
  (`src/lib/push/*`, `docs/API-MOBILE.md` §23). Yalnız işlemsel; üyenin
  "Sipariş durumu" anahtarı (`orderUpdates`) kapatır. Gel-al hazır olup
  hiçbir telefona ulaşmadıysa "Siparişin hazır" e-postası gider.
- **Online satış:** imzalı `GET /api/panel/sales?month=YYYY-MM` (ya da
  `from`/`to`, en çok 31 gün) kafe, mağaza ve karaoke parasını, faturanın
  KDV'sini (ödül kuponu tam fiyatla) ve kafe satırlarını menü kalemi × boy
  olarak verir. Rakamlar Raporlar'ın ve Gün sonu'nunkiyle aynı kuralla
  sayılır (sipariş `createdAt` gününe, karaoke ödeme gününe;
  `karaokeMoneyOf` üçünün ortak fonksiyonu); elle girilen sipariş kasada
  çalındığı için yalnız `manual`, kasada nakit ya da kasa kartıyla
  "Ödendi" işaretlenen uygulama / web siparişi yalnız `counter` altında
  (havale ve "Diğer" online kalır). Müşteri ve sipariş numarası gitmez.
  Panel bunu kâr-zararda üç satır (kafe online, mağaza, karaoke; KDV hariç)
  ve "TOPLAM CİRO" olarak, tutarlılıkta ayrı tüketim kaynağı olarak ve kasa
  raporunda bilgi satırı olarak gösterir. Ayrıntı: `docs/PANEL-SALES.md`.

## e-Arşiv fatura, Paraşüt üzerinden (22 Eki 2026)

- Site keser (`src/lib/invoice/`, runbook `docs/EARSIV.md`); **varsayılan
  kapalı**: `EARSIV_MODE` off | draft | live; `EARSIV_START_AT` (gün,
  İstanbul saatiyle başı; üretimde `15.10.2026`, PayNkolay'ın canlı günü)
  yoksa hiçbir şey yapılmaz, öncesinde ödenen sipariş elle kesilmiştir.
  **draft = her fatura operatörün onayıyla** (22 Eki 2026): site Paraşüt'te
  taslak hazırlar, kart taslağı satır satır gösterir, "Faturayı
  kesinleştir" o taslağı resmileştirip PDF'i yollar (`runInvoiceRow`,
  `claimRow`); onay yalnız görülen taslağa, eski tarihli ya da Paraşüt'te
  tutarı değişmiş taslak kesinleşmez ve silinmez ("Taslağı yenile"). live =
  kendiliğinden. Koli "Kargoya ver"de
  (çıktısı pakete, sipariş sayfasında "Faturayı yazdır / indir"), kafe
  siparişi teslimde (yoksa ödemeden 3 saat sonra), karaoke saat bitince;
  son gün teslim + 7 gün (VUK 231/5), Faturalar ve Genel bakış uyarır.
- Kancalar (`scheduleInvoiceWork`, `after()`; ödeme, geçiş, iade), günlük
  cron'un kendi `step`'i ve "Şimdi çalıştır". Her Paraşüt kimliği alındığı
  anda yazılır, satır `invoice_claim` (FOR UPDATE SKIP LOCKED, 15 dk) ile
  tek çalıştırmaya verilir; yanıtı kaybolan istekten sonra önce aranır.
  Paraşüt toplamı 0,01 TL'den fazla tutmazsa taslak silinir, kayıt elle.
- **Siparişten fatura sihirbazı** (22 Eki 2026, `docs/EARSIV.md` §8):
  sipariş kartındaki "Fatura oluştur" → `/admin/siparisler/[id]/fatura`
  (Alıcı → Adres → Satırlar → Özet → Paraşüt taslağı). Kurumsal alıcı:
  unvan, 10 haneli VKN (kontrol hanesi), vergi dairesi; TCKN alınmaz.
  `EARSIV_START_AT`'ten önce ödenen sipariş de kesilir (`requestedBy`).
  Kesinleştirirken VKN Paraşüt'e sorulur (`e_invoice_inboxes`): GİB'de
  kayıtlıysa **e-Fatura** (TEMELFATURA, bizim e-postamız gitmez), değilse
  e-Arşiv. Bireysele hep e-Arşiv.
- Elle kalır: panel siparişi (ÖKC), şahıs şirketi (TCKN'li fatura; yönetici
  "elle kesilecek" işaretler), cüzdan / ödemesiz / ödül kuponu, kesimden
  önce iade, listede VKN'si olmayan kargo firması. Kesilmiş faturaya
  dokunulmaz: sonraki iade `invoice_refund` dikkat işareti. Telefon ve TCKN
  Paraşüt'e gitmez; PDF saklanmaz, üye sipariş sayfasından indirir.

## KDV (17 Eki 2026; oranlar ve kargo 18 Eki 2026)

- **Fiyatlar KDV dahil; oran tutarı değiştirmez.** Oran yalnız fiyatın ne
  kadarının KDV olduğunu söyler (fiş, panel, CSV, uygulama). Hiçbir toplam
  orandan hesaplanmaz (`computeOrderTotals`'ta KDV yok).
- **Oran ürüne göre** (`src/lib/utils/kdv.ts`): ürünün / menü kaleminin kendi
  `"taxRatePct"`'i, yoksa Ayarlar → Vergi varsayılanı (`settings."taxRates"`:
  menü %10, karaoke %20, `beans`/`pantry` %10, `gift`/`gear`/`merch` %20,
  `shipping` %20). Köşk kafeterya işletmesi: sattığı bütün gıda %10, kargoyla
  gönderilen paket kahve dahil (KDV GUT III/B-2.4.1); %1 hiçbir üründe
  kullanılmaz. Oran malın cinsine bağlıdır, rafına değil: yenilebilir kup
  kutusu (`prd-0003`, `gift`) ve pamuk önlük (`prd-0009`, `merch`) kendi
  oranıyla %10; gıda ile gıda dışını tek fiyatla birleştiren set %20. Tam
  sayı 0-100; kesir reddedilir. Ürün ürün karar ve dayanak:
  `docs/LEGAL-REDLINES-2026-09.md` §16.3-§16.4.
- **Satış anındaki oran saklanır.** Sipariş satırı `items[].taxRatePct`,
  siparişin kargo / kurye oranı `"shippingTaxRatePct"` (yoksa %20), karaoke
  rezervasyonu `"taxRatePct"`; panelde sonradan değişen oran eski fişi
  değiştirmez. Oranı olmayan eski sipariş döküm göstermez (tahmin yok).
- **Kargo / kurye ücreti faturada ayrı kalem, kendi oranıyla** (taşıma
  hizmeti, %20; KDV K. m.24/a, GİB özelge 32391, 28945): `kdvBreakdown`
  ücreti satırlara paylaştırmaz. İndirim satırlara orantılı dağıtılır.
- **Ödül kuponu iskonto değildir** (damga, kilometre taşı, davet; ya da
  ürünlerin tamamını karşılayan kupon): panel sipariş sayfası ve CSV fatura
  dökümünü (`invoiceKdvBreakdown`, ürünler tam fiyatla) gösterir; fiş ve
  uygulamanın `taxBreakdown`'ı ödenen tutarın içindeki KDV'dir.
- Hukuk metinleri oran saymaz, kuralı yazar (`src/lib/legal/content.ts`);
  ödeme belgelerinde değişiklik `LEGAL_UPDATED`'ı taşır.

## Meta Pixel (25 Ekim 2026)

Operatör: karaoke rezervasyonlarını ölçmek ve Meta reklamlarını gerçek
rezervasyona göre optimize etmek. Tam anlatım: `docs/META-PIXEL.md`.

- **Yalnız pazarlama rızasıyla.** Piksel ("LAF Pixel", `NEXT_PUBLIC_META_PIXEL_ID`,
  yoksa koddaki kimlik; **boş değer kapatır**) yalnız `marketing === true` olan
  ziyaretçide, yalnız `laffogato.net` / `www.laffogato.net`'te yüklenir; `/admin`
  ve `/odeme` (tam yol) belgelerinde hiç. Onay yokken Meta'ya istek gitmez, betik
  bile inmez. Tek kapı `trackPixel` (`src/lib/consent/meta-pixel.ts`); olaylar
  oradan geçmeden `fbq` çağrılmaz, parametrelerde kişisel veri olmaz.
- **Rıza sürümü etiketin şekline bağlı** (`consentVersionFor(google, meta)`:
  1 yok, 2 Meta, 3 Google, 4 ikisi). Yeni bir etiket eklenirse yeni numara;
  bir numara hiçbir zaman başka şekil için yeniden kullanılmaz.
- **Hukuki metinler TASLAK** (avukat okuması bekliyor, LEGAL-REDLINES §35).
  `META_PIXEL_IN_LEGAL_TEXTS` (`src/lib/legal/meta.ts`) bayrağı metinler
  pikseli anlatmadıkça pikseli kapalı tutar. Dört belge kendi gününü
  (`META_PIXEL_LEGAL_UPDATED`) taşır, `LEGAL_UPDATED` taşınmadı.
- **Karaoke `InitiateCheckout`** için `bookKaraokeAction` izinli ziyaretçiye
  yönlendirme yerine `checkout` durumu döner (`BookKaraokeState.checkout`);
  izinsiz ziyaretçi eskisi gibi `redirect` edilir.

## Vercel kullanım sınırı ve bağlantılar (14 Kas 2026)

Site 14 Kas 2026'da kapandı, kod çökmemişti: Vercel, Hobby planının kullanım
sınırı aşılınca hesaptaki **bütün** projeleri durdurdu (laffogato.net "This
deployment is temporarily paused", dağıtım adresleri `402
DEPLOYMENT_DISABLED`; lafmaliyet ve gnbsite de). Son dağıtım `READY`'di.
Hobby planında aşım siteyi durdurur ve plan ticari kullanım için değildir;
ödeme alan bir site Pro'da durur (aşım faturalanır, site açık kalır).
Pro'da Spend Management'ın "projeleri durdur" seçeneği aynı kapanmayı geri
getirir: orada yalnız bildirim. Sorun Vercel'deyse ilk bakılacak yer
Usage sayfası ve dağıtım adresinin `x-vercel-error` başlığı.

- **Bağlantılar görünürken önceden yüklemez.** `next/link` doğrudan import
  edilmez; her bağlantı `@/components/link`'ten gelir. O, bağlantıyı
  ekrana girdiğinde değil, fare üstüne gelince ya da parmak dokununca
  önceden yükler; `prefetch`'i kendisi seçen bağlantı seçimini korur.
  Sayfaların neredeyse hepsi dinamik (`ƒ`) olduğu için varsayılan prefetch
  anasayfanın bir ziyaretini 12-13 sunucu çizimine (her biri bir fonksiyon
  ve bir proxy çalışması) çeviriyordu; şimdi belge ve karaoke uygunluğu, 2
  istek. Panelin kenar çubuğu da aynısını kendi sayfalarıyla yapıyordu.
  `useLinkStatus` yine `next/link`'ten gelir. `tests/link-prefetch.test.ts`
  tutar.
- **Anasayfanın filmi en çok 6 dosyadır** (21 Kas 2026; yerini aldığı
  yolculuğun filmi 5 paketti): ilk boyamada üç afiş (geniş ekranda toplam
  172 KB, telefonda 75 KB), hidrasyondan sonra ilk klip (1.29 MB, telefonda
  0.98 MB), çalan klibin yarısında sıradaki; üç klip birden geniş ekranda
  3.54 MB, telefonda 1.87 MB. Azaltılmış harekette ve Save-Data'da yalnız
  afişler iner. İlk klip yolculuğun bütün filminden küçük, üçü birden ondan
  büyüktür (geniş ekranda iki katından fazla). Dosyalar `public/video`'dan
  gelir: proxy çalışmaz (matcher `.mp4` ve `.webp`'yi dışarıda bırakır), ama
  adları içerik damgalı değildir ve `next.config.ts`'in günlük önbellek
  kuralı (`brand|photos|menu|illustrations`) onları kapsamaz: `max-age=0`,
  her ziyarette yeniden doğrulanır. Bir klip tarayıcıya göre birden fazla
  aralık (`Range`) isteğiyle gelebilir. Klip eklemeden, süresini ya da
  çözünürlüğünü artırmadan önce bu rakamlara bak.
- Sayfa yüküne yeni bir istek ya da yeni bir yoklama (polling) eklerken
  Vercel çağrısını say: panelin yoklamaları kapalı saatte seyrelir
  (`ORDER_ALERT_IDLE_POLL_MS`), yenisi de öyle yazılır.

## Geliştirme Komutları

```bash
npm run dev          # Geliştirme sunucusu
npm run build        # Production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run format       # prettier yaz
npm run db:migrate   # Migration'ları uygula (DATABASE_URL gerekir)
npm run db:bundle    # db/schema.sql'i yeniden üret
```

CI her PR'da ve `main`'e doğrudan yapılan her push'ta `npm run typecheck` +
`npm run lint -- --max-warnings=0` + `npm run build` koşar (test adımı yok:
`tests/` kaldırıldı); başlığında "(#N)" olan squash merge push'unda koşmaz
(o ağaç PR'da `main` güncelken zaten denendi; Actions ücretsiz kotası 19 Eki
2026'da bu yüzden doldu). GitHub Actions çalışmıyorsa (kota, ödeme) aynı
adımlar yerelde koşturulur: typecheck, lint `--max-warnings=0`,
`npm run build` (Turbopack symlink'li `node_modules`'ta çöker: APFS kopyası
`cp -cR` kullan). Bu ortamda `NODE_ENV=development` tanımlıysa build
`/_global-error` prerender'ında düşer; yerelde
`NODE_ENV=production npm run build` kullan (CI değişkeni hiç set etmez).

## Env Variables

`.env.example` referans. Local için `.env.local` doldur:

| Değişken                         | Amaç                                                      |
| -------------------------------- | --------------------------------------------------------- |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin giriş kimliği                                       |
| `ADMIN_SESSION_SECRET`           | Cookie HMAC anahtarı (≥32 karakter)                       |
| `PAYMENT_PROVIDER`               | `paynkolay` (her ortamda zorunlu)                         |
| `PAYMENT_WEBHOOK_SECRET`         | Webhook HMAC anahtarı                                     |
| `DATABASE_URL`                   | Postgres bağlantı dizesi (sağlayıcının pooled endpoint'i) |
| `NEXT_PUBLIC_SITE_URL`           | metadataBase                                              |

**NODE_ENV asla manuel set edilmez.** Next.js kendi yönetir.

## Data Mimarisi

Tüm veri erişimi `src/lib/db` üzerinden, tamamen server-side. `index.ts` bir `pg`
havuzu kurar (lazy — `next build` veritabanına bağlanmaz), `client.ts` zincirlenen
sorgu arayüzünü (`.from().select().eq()`) sunar, `sql.ts` bunu parametreli SQL'e
derler. Tanımlayıcılar `sql.ts`'te doğrulanır, değerler orada parametrelenir.

Şema eski doküman modelini korur: **camelCase quoted kolonlar**, iç içe alanlar
(`variants`, `items`, `refunds`, `addresses`, `weeklyHours`) **JSONB**, tarihler
**ISO-8601 metin** (string sıralaması = kronolojik). Sıralı ID'ler (`prd-0001`,
`orderNo` 10001+) `next_seq()` ile **atomik**. Paketten ürün, menü kalemi,
sipariş ya da panel içeriği seed'lenmez; yalnız beş mağaza kategorisinin
kabuğu (geliştirmede) ve tek `settings` satırı ilk istekte yazılır.

Tablolar ve SQL fonksiyonları `db/schema.sql`'de (tek kaynak; sayıyı buraya
yazma, eskiyor). Sayaç fonksiyonları: `next_seq` / `claim_order_stock` /
`release_order_stock` / `redeem_promo` / `release_promo_usage` /
`increment_promo_usage` / `adjust_product_stock` / `record_auth_failure` /
`reserve_auth_attempt` / `reserve_order_refund` / `drop_order_refund` /
`toggle_wishlist` / `campaign_email_claim` / `reserve_fal_reading`, ve üye başına tavanları tutan
tetikleyiciler (`app_pending_order_cap`, `karaoke_open_cap`,
`counter_token_issue_cap`). Her biri, JavaScript'te yapılan bir
oku-değiştir-yaz'ın eşzamanlılık altında kaybettiği yazımlar yüzünden var. Şema yoksa uygulama onu ilk sorguda kendisi kurar
(`src/lib/db/bootstrap.ts` → `src/lib/db/schema-sql.ts`, `npm run db:bundle`
ile üretilir), böylece `DATABASE_URL`'i migration'lardan önce tanımlamak siteyi
düşürmez. Erişim tek bir owner bağlantısı üzerinden olduğu için RLS
satırları işlevsizdir (owner rolü RLS'i baypas eder) — savunma katmanı olarak
bırakıldı.

## Veritabanı Kesintisinde Davranış

Genel sayfalar DB'ye ulaşılamazsa pakette gelen içerikle ayakta kalır; ticari
yollar sesli başarısız olur. Ayrım `src/lib/db/health.ts`'te: SQLSTATE taşıyan
her hata gerçek hatadır ve maskelenmez, yalnız bağlantının hiç kurulamadığı
durum bozulmaya uygundur.

- `publicRead()` **yalnızca** salt-okunur sunum verisi içindir.
- Fiyat, stok, yetki ya da siparişin verilebilirliği **asla** yedek veriden
  karar bağlanmaz — `getSettings()` (throw eden) ticari yollarda kalır,
  `getPublicSettings()` yalnız sunum içindir. Genel sayfaların sunumu
  önbellekten gelir (`getSiteSettings` ve `site-data.ts`'in diğer
  okuyucuları, `docs/DATABASE.md` "Uyanmalar ve önbellek"); ticari yollar
  önbellekten hiçbir şey okumaz (`tests/site-data-cache.test.ts`).
- Mağaza bozulmada **boş** kalır, paketteki kurgusal ürünlere düşmez.

## Tasarım Sistemi

> Tam kılavuz ve tasarım kaydı: **`docs/BRAND.md`** (token'lar, ölçülmüş
> kontrast, yazı ölçeği, bileşen dili, referanslardan alınan ve alınmayan).

- **Renk:** `src/styles/foundation.css :root` tek kaynak (`globals.css` token
  taşımaz); site uygulamanın paletini izlemez. Zemin beyaz (`--bg`,
  `--surface`) ve dönüşümlü bant `--band` `#f6f6f3` (bölüm bandı, üst çubuk,
  ürün fotoğrafının zemini, sepet çekmecesi). Mürekkep `--ink` siyah, ikincil
  satır `--muted` `#6c6864`. **Tek kömür** `--charcoal` `#333333` her dolu
  kontrolün, koyu bandın (`.section--dark`) ve footer'ın zeminidir (üstüne
  gelince `--charcoal-deep` `#1f1f1f`); üstünde `--on-dark` ve
  `--on-dark-muted`. Çizgi `--line` `#dcdcd6`, kontrol kenarı `--line-strong`.
  Vurgu rengi yok: renk yalnız durum söyler (`--error` `#b42318`, `--success`
  `#1f6b4a`, bekleyen adım `--warn` `#8a5a00`; açık noktası) ya da logonun pirinç
  çekirdeğidir; ödeme sayfasının kart şeması işaretleri kendi renklerindedir
  (`--scheme-*`). Emekli adlar (`--green-*`, `--accent*`, `--amber`,
  `--matcha`, `--rose`, `--gold*`, `--bg-*`, `--frost*`, `--glass-*`)
  tanımsızdır; satır içi stil de yalnız bu token'ları kullanır.
- **Yazı:** iki ses, istisna yok. Başlık, gezinme, fiyat ve etiket Archivo
  (`--headline`): geniş (`"wdth" 118`, `--headline-wdth`), başlık ve
  etiketlerde **hep 400**, **hep büyük harf** (`text-transform: uppercase`;
  Türkçe büyük harf `lang="tr"`'den), aralık 1.6px (`--track`). Cümle,
  kontrol ve rakam Geist (`--sans`; `--display` ve `--serif` ona çözülür,
  `--mono` sistemin eş genişliklisi). Ölçek: bölüm başlığı `.t-display` 24/32
  (telefonda 20/28), kart başlığı `.t-title` ve gezinme `.t-nav` 16/22,
  etiket `.t-label` / `.t-kicker` 12/24, fiyat `.t-price` 14/20; gövde
  `.t-body` 16/22, küçük satır `.t-small` 14/20 (gri `.t-muted`), mikro
  `.t-micro` 12/16. Eski sınıflar (`.h1`, `.h2`, `.section-title`, `.h3`,
  `.eyebrow`, `.lede`) aynı seslere çözülür. `next/font` değişken adları
  değişmedi (`--font-display` Geist, `--font-headline` Archivo): panelin site
  önizlemesi onları okur, panel kendi kökünde yazı token'larını Inter'e
  çevirir. Düğme etiketinde ok yok (`.btn .arrow` gizli).
- **Malzeme:** kare köşe (yarıçap 0); gölge, bulanıklık ve degrade yok (tek
  istisna filmin alt gölgesi). Hap yalnız çiplerde (`.chip`: telefonun hızlı
  bağlantıları, kategori çipleri) ve küçük sayaçlarda, noktalar yuvarlak;
  satır arası 1px `--line`. Düğme `.btn`: en az 48px, iç boşluk 12px 36px,
  1px kömür kenar, etiket Geist 16px ve cümle düzeninde; dolu `.btn-dark`
  karar verilmiş eylemdir (eski `.btn-primary`, `.btn-ink`, `.btn-amber` ona
  çözülür), kenarlı düğme üstüne gelince dolar, basınca küçülmez; çağrı
  `.btn-wide` 350px, telefonda tam satır; ayrıca `.btn-block`, koyu zeminde
  `.btn-light`, `.btn-sm`. Kare filtre etiketi `.tag`, ikon düğmesi
  `.icon-btn` 44px (`.icon-btn--boxed` 32px), alt çizgili küçük bağlantı
  `.link-u`, alanlar `.input` / `.select` / `.textarea` 48px ve 16px (iOS
  yakınlaşmasın). Ürün fotoğrafı `.media` kutusunda, bant zemininde durur.
  Düzen: `--gutter` `clamp(20px, 4.2vw, 60px)`, `--section-y`
  `clamp(56px, 6.7vw, 96px)`, `--content` 1320px; çubuk 84px (1024px altında
  56px), üstünde 32px duyuru satırı.
- **Sahneler** (`scenes.ts`) sitede artık çizilmez: ürün ve menü görseli
  fotoğraftır ya da bandın düz zemini (`visuals.tsx`: `ProductSurface`,
  `MenuPlate`, `.media-empty`); HUES adları ve çizimler kalktı. Dosya yalnız
  panelin anasayfa slaytları için durur: slayt düzenleyicisi
  (`/admin/anasayfa-hero`) önizleme ışığını `SCENES`'ten,
  `src/lib/admin/home-hero-core.ts` ve `data.ts` (`HOME_SLIDES`) `SceneKey`'i
  okur.
- **Kontrast** (WCAG, ölçülmüş): siyah beyazda 21:1, bantta 19.4:1;
  `--muted` beyazda 5.5:1, bantta 5.1:1, kömürde 2.3:1 (orada kullanılmaz);
  beyaz kömürde 12.6:1, `--charcoal-deep`'te 16.5:1; `--on-dark-muted`
  kömürde 7.4:1; `--error` beyazda 6.6:1, `--success` 6.4:1. Klavye odağı 2px
  siyah çizgi, koyu zeminde beyaz. Kontrast testi (`tests/contrast.test.ts`)
  artık koşmuyor: token değiştiren bu oranları yeniden ölçer, buraya ve
  `docs/BRAND.md`'ye yazar (peş peşe üç "sadeleştirme" geçişi oranları bir
  kez sessizce AA altına düşürmüştü).
- **Hareket:** sitenin tek sürekli hareketi anasayfa filmidir (yukarıda:
  ekran dışında ve gizli sekmede durur, azaltılmış harekette ve Save-Data'da
  hiç başlamaz; durdur düğmesi yok). Kaydırmayla açılan bölüm, harf harf
  yükselen başlık, çözülen etiket ve three.js yok. Geçişler kısa (`--dur`
  0.2s, renk ve kenar), film slaytları 0.9s'de yer değiştirir, ürün
  fotoğrafı üstüne gelince %3 büyür; `prefers-reduced-motion` altında
  `foundation.css` bütün geçişleri kapatır (`transition: none`; 0.01ms'lik
  süre, ilk değeri `all` olan geçiş özelliğiyle her öğenin her özelliğini
  geçişe sokuyor ve açılan çekmeceye odağın girmesini engelliyordu) ve
  animasyonları tek kareye indirir.
- **Admin paneli görünümü** (21 Kas 2026, operatör: _"laffogato admin
  panelini madamecoco reposundaki admin panel ile aynı tarz tasarımda
  yap"_): `/admin`, Madame Coco Kenya panelinin StorageBox dilini izler;
  tarif ve kararlar `docs/ADMIN-STORAGEBOX.md`, token'lar
  `src/app/admin/admin-theme.css` (`[data-admin-root]`, yalnız açık tema).
  Açık gri dış zemin (`#fafafa`), kenar çubuğu çerçeveli beyaz kart, sayfa
  `#f7f7f7` kanvas çerçeve; üstünde çok açık çizgili beyaz kartlar (köşe
  24; panelde `rounded-xl` 24'e, `rounded-lg` 16'ya çevrilir), her kontrol
  hap (düğme, alan, rozet, sekme), mürekkep `#1F212D`, tek mavi birincil
  `#122AFF`, etkin menü satırı / sekme / adım koyu hap (`--admin-inverse`),
  bekleyen iş kırmızı hap (`--admin-count`). Başlık, kart başlığı ve büyük
  rakam DM Sans 400 (`.admin-display`, `CARD_TITLE`, `FIGURE`), gerisi
  Inter; ikisi de yalnız admin layout'ta. Rozet zemini kaynağın açık tonu,
  yazısı koyusu (AA). Pano rakamları ayrı kartlarda, öncü rakam (bugünün
  net cirosu) iki kart genişliğinde (`KpiStrip lead`). Menünün beş grup
  rengi (`src/components/admin/ui/hues.ts`) yalnız rakam kartlarının
  yuvarlak ikonlarında. Tutar ve kodlar `NUMERIC_STYLE` (Inter tablo
  rakamı), karakter karakter okunan kimlik ve Markdown `CODE_STYLE`.
  Düzenler Innex döneminden kaldı (`docs/ADMIN.md` "Innex düzenleri";
  Innex tarifi `docs/ADMIN-INNEX.md` artık tarihçe). Üst çubukta köşk çipi
  yok: köşkün açık/kapalısı Ayarlar → Saatler'den kendiliğinden gelir
  (Canlı durum yalnız gösterir; `manualOverride` hep `auto`); boş masa da
  sayılmaz, `live-status.freeTables` hep `null` (22 Kas 2026, sözleşme §6). Arama sade
  bir kutudur ("Ara"), komut / asistan dili yok. Yukarıdaki site kuralları
  panele uygulanmaz, panel de siteyi değiştirmez (`docs/BRAND.md` "Admin
  paneli görünümü").
- **Admin arayüz kütüphaneleri:** panel yalnız üç paket kullanabilir, yalnız
  `src/components/admin/**` ve `src/app/admin/**` içinde:
  `lucide-react` (ikonlar), `react-aria-components` ve
  `@internationalized/date` (palet, tarih alanı, combobox gibi yalnız
  etkileşimde yüklenen yaprak bileşenler). Kurulu olanlar: `lucide-react`,
  `react-aria-components`, `@internationalized/date`. Tarih paketi tarih
  alanlarıyla geldi (UI-14): React Aria onu kilit dosyasına zaten dolaylı
  getiriyordu, artık doğrudan bağımlılık. Takvim ve saat pencereleri
  `ui/overlay.ts`'in kapsayıcısına çizilir (açık diyalog ya da panelin portal
  düğümü); `UNSTABLE_portalContainer` ve `UNSAFE_PortalProvider` yalnız orada
  geçer, oradaki anahtar bozulursa yerel tarih kutuları kalır. Her biri
  `package.json`'da tam sürüme sabit (`^` yok), kilit dosyasında tek kopya;
  yükseltme ayrı bir PR'dır ve sürüm en az 14 günlük olur. İkonları yalnız `ui/icons.tsx`
  import eder: her ikon orada bir kez adlandırılır, `AdminIcon` 18 px, 1.75
  çizgi, `aria-hidden` çizer; sayfa onu `@/components/admin/ui/icons`'tan
  alır, kit'in `ui/index.ts`'inden değil (oradan her sayfaya lucide girer).
  React Aria ve tarih paketi yalnız `"use client"` dosyalarda, React Aria alt
  yoldan (`react-aria-components/ListBox`). Sunucuda çizilen kit dosyaları
  (`data-table`, `status-tabs`, `pagination`, `badge`, `detail`, `styles`,
  `forms.tsx`) bunlara uzanmaz; `/admin/kasa`'ya kütüphane kodu girmez, her
  admin rotasına en fazla 8 KB gz eklenir (ölçüm PR gövdesinde). Radix, cmdk
  ve shadcn yok: `components.json` silindi, `shadcn add` `globals.css`'teki
  marka token'larının üstüne yazardı. Bekçiler: ESLint
  `no-restricted-imports` ve `tests/admin-ui-deps.test.ts`.

## Güvenlik Kuralları

1. **Admin cookie:** HMAC SHA256 imzalı, httpOnly, `sameSite=lax`, 7 gün TTL
2. **Kimlik karşılaştırması constant-time** (`crypto.timingSafeEqual`)
3. **Server-side validation Zod ile** — parse edilmeden mutation yok
4. **Tüm mutation'lar server action** (`"use server"`), FormData üzerinden
5. **revalidatePath** her mutation sonrası
6. **Ödeme tutarı asla client'tan gelmez** — backend DB fiyatından doğrular
7. **Webhook'lar** `x-signature` → HMAC SHA256 timing-safe compare
8. **Idempotency:** `payment_transactions.provider_ref` unique constraint
9. **PII:** Logging'de email/telefon maskelenmeli
10. **`DATABASE_URL` SADECE server-side** — asla `NEXT_PUBLIC_*` ile expose edilmez
11. **Veri erişimi yalnız `src/lib/db` üzerinden** — ham SQL'i çağrı noktalarına yayma
12. **Mesafeli satış onayı zorunlu.** Ödeme adımındaki onay kutusu ön işaretli olamaz; `startCheckoutAction` onaysız siparişi reddeder ve onayı (tarih, IP, tarayıcı, belge sürümü) `orders."legalConsent"` JSONB kolonuna yazar — sanal POS / chargeback delili
13. **Yasal kimlik uydurulmaz.** `src/lib/legal/entity.ts` içinde MERSİS / ticaret sicil / KEP / IBAN bilinmiyorsa **boş bırakılır**; boş token içeren tablo satırı render edilmeden düşürülür. Sahte numara yazmak yerine satırı gizle
14. **NACE / faaliyet kodu sitede yayımlanmaz** — yalnızca iç kayıt
15. **SEO içeriği veriye dayanır.** Yeni bir rehber/landing sayfası açmadan önce
    Semrush (TR veritabanı) ile hacim ve zorluk doğrulanır; hedef küme
    `docs/SEO.md` tablosuna işlenir. Hacimsiz sayfa açılmaz
16. **JSON-LD tek yerden basılır** — `<JsonLd>` (`src/lib/seo/json-ld.tsx`).
    `JSON.stringify` `<` karakterini kaçırmaz; veritabanından gelen bir ürün
    adı script etiketini kapatabilir. Ham `dangerouslySetInnerHTML` ile ld+json
    yazma
17. **Ödeme sağlayıcısı fail-closed** — `PAYMENT_PROVIDER` hiçbir ortamda
    varsayılana düşmez; tanımsızsa ya da `paynkolay` dışında bir değerse
    `getPaymentProvider()` fırlatır (sahte sağlayıcı kaldırıldı)
18. **Rıza olmadan ölçüm yok** — Consent Mode v2 varsayılanları GTM'den önce
    basılır, rızaya bağlı her sinyal `denied` başlar. Yeni bir etiket veya
    piksel eklerken bunu baypas etme
19. **Ticari e-posta için açık rıza** (6563) — onay kutusu ön işaretli olamaz,
    onayın tarihi/IP'si/hangi metne verildiği kaydedilir ve her iletide tek
    tıkla çıkış bulunur. İşlemsel e-posta (sipariş, kargo, parola) bu kapsamda
    **değildir**; onlara "abonelikten çık" koymak yanıltıcı olur
20. **Eşzamanlılık altındaki sayaçlar SQL'de artar** — stok, promosyon kullanımı
    ve giriş denemesi. JS'te oku-değiştir-yaz, tam da yarışın olduğu anda yazım
    kaybeder
21. **Gıda işletmesi sağlık iddiası yapamaz** — "zayıflatır", "önler",
    "tedavi eder", "detoks" gibi ifadeler `tests/guides.test.ts` tarafından
    reddedilir. Ölçülü ifade + tıbbi tavsiye olmadığı notu
22. **Saat ve tarih köşkün saatiyle** (`Europe/Istanbul`, sabit UTC+3).
    Sunucu (Vercel) UTC'dir: `getDay()`, `getMonth()`,
    `toISOString().slice(0, 10)` 00:00–03:00 arası **dünü** verir. Kullan:
    `istanbulDay` / `istanbulClock` (`src/lib/mobile/*`), panelden gelen
    `datetime-local` için `parsePublishInstant` / `normalizePublishInstant`
23. **`RETURNS TABLE` / `SETOF` SQL fonksiyonu → `rpcRows()`.** `rpc()` tek
    hücre okur; tablo döndüren fonksiyonda kayıt *dizesi* gelir ve iş sessizce
    boş çalışır (doğum günü cron'u böyle aylarca kimseyi kutlamadı).
    `tests/db-rpc-table-functions.test.ts` tutar
24. **Admin formundan gelen tutar → `parseMoneyInput()`**
    (`src/lib/utils/format.ts`). `parseFloat(s.replace(",", "."))` yasak:
    `"1.250,00"`'ı 1,25 okur
25. **Para hareketinden önce doğrula.** POS'a iade (`provider.refund`) ancak
    `refundRefusal()` boş dönünce çağrılır; defter reddi paradan sonra gelirse
    ikisi kalıcı olarak ayrışır
26. **İstekten gelen yönlendirme hedefi** (`?next=`, `back` alanı) yalnız
    `sameSitePath()`'ten geçerek izlenir
27. **`"use server"` dosyasındaki her `export` herkese açık bir POST ucudur.**
    Oraya yardımcı fonksiyon koyma (2FA'yı kapatan `freshEnrollment` böyle
    açıktaydı); her action kendi oturum + rol kontrolünü yapar — `proxy.ts`
    yalnız sayfa yönlendirmesidir, yetki kontrolü değil
28. **Kart verisi saklanmaz** (operatör kararı, 23 Eyl ve 15 Eki 2026). Kart
    web'de checkout sayfasının kendisinde (`/odeme`) girilir - operatör, 16
    Eki 2026: _"kart girerken başka sayfaya vs atmasın"_; bu, kartın yalnız
    `/odeme/paynkolay`'da girildiği eski kararın bilinçli tersidir
    (`docs/PAYNKOLAY.md` §15.5). Uygulama aynı `/odeme/paynkolay` sayfasını
    açmaya devam eder. Kart `/odeme`'de yerli bir POST formunda
    (`action="/odeme/paynkolay"`), kontrolsüz alanlarda durur: Server
    Action'a, serileşen React state'ine, depolamaya, loga ve adrese girmez;
    sunucu onu aynı istekte yalnızca PayNkolay'a (`/Vpos/v1/Payment`)
    iletir. Veritabanına, loga, dosyaya yazılmaz; hata yanıtı kart
    numarasını ve CVV'yi geri basmaz (`/odeme`'ye yalnız sabit kodla döner).
    `/odeme` belgesi kendi nonce CSP'siyle, GTM'siz ve üçüncü taraf betiksiz
    sunulur (`src/proxy.ts`, `src/lib/security/checkout-csp.ts`). Kart
    alanları yalnız beş dosyada geçer (`paynkolay-card.ts`, `paynkolay.ts`,
    `paynkolay-page.ts`, `odeme/paynkolay/route.ts`, `odeme/card-payment.tsx`)
    ve bu dosyalar DB/store import etmez. Kayıtlı kart **PayNkolay'da** durur
    (operatör, 15 Eki 2026; `docs/PAYNKOLAY.md` §16): biz yalnız rastgele
    11 karakterlik üye anahtarını (`customers."cardUserKey"`) tutarız, token
    tarayıcıya gitmez, kaydetme kutusu işaretsiz gelir, hesap kapanınca
    kartlar POS'tan silinir (POS cevap vermezse anahtar şifreli kuyruğa,
    `card_vault_purges`, günlük iş siler). Üye anahtarı veritabanında
    **AES-256-GCM ile şifreli** durur (19 Kas 2026, `card-vault.ts`;
    anahtar `CARD_VAULT_KEY`, yoksa POS sırrından ayrı etiketle türetilir;
    satır kimliğine bağlı): sütunu yalnız `customer/store.ts`'in üç
    fonksiyonu okur ve yazar, açık metin anahtar ne DB'ye ne loga yazılır.
    Üye kartlarını Hesabım › Kayıtlı kartlarım'da görür ve siler
    (`/uye/hesap/kartlarim`); kart yalnız ödemede, 3D'den geçerek kaydedilir.
    `CardStorageCardRegister` (kart numarasıyla
    ödemesiz saklama) kullanılmaz; ortak ödeme sayfasında `customerKey` boş;
    şemada kart alanı yok; ödeme kaydında kart sahibinin adı tutulmaz. `tests/saved-cards.test.ts` + `tests/paynkolay-card-page.test.ts`
    tutar. Ödeme sayfası sitenin genel CSP'si dışındadır ve kendi, daha dar
    CSP'sini gönderir (üçüncü taraf betik yok, `frame-ancestors 'none'`); kart
    denemesi IP ve sipariş başına sınırlıdır (`card-payment-*`)
29. **Ödenmemiş sipariş POS'a sorulmadan iptal edilmez.** Süpürme ve yeni
    ödemenin eski denemeyi bırakması `cancelUnpaidOrder` → `lookupPayment`
    (`PaymentList`) üzerinden geçer; POS'a ulaşılamaması "ödenmedi" sayılmaz.
    `/odeme/donus`'ta iptal yapılmaz: o POST oturum çerezi taşımaz, herhangi
    bir sipariş kimliği için taklit edilebilir
30. **Giriş denemesi kimlik bilgisi denetlenmeden önce ayrılır**
    (`reserveLoginAttempt` → `reserve_auth_attempt`). "Önce sor, sonra
    doğrula, sonra say" sırası paralel isteklerde tavanı aşar. Admin oturumu
    her istekte hesaptan yeniden okunur (`getAdminSession`); token'daki parmak
    izi parola ya da hesap değişince eski çerezleri geçersiz kılar

## Çalışma Kuralları (Claude için)

- **Dil:** Kullanıcı ile **Türkçe** konuş. Kod ve commit mesajı **İngilizce**.
- **PR akışı:** Her özellik için ayrı PR, draft aç. CI yeşil olmadan merge etme.
- **Admin form akışı:** Yeni ürün → `ProductWizard mode="wizard"`; düzenleme →
  aynı bileşen `mode="tabs"`. Yeni alan eklerken **5 yer** güncellenir:
  `AdminProduct` (store), seed, `ProductInput`, `product-schema.ts`,
  `product-wizard.tsx` (alan `FIELD_STEP`'e de girer, yoksa reddi özet
  adımında açılır; `admin-product-wizard` testi tutar). Alan CSV ile de
  gelecekse `product-import-core.ts` (sütun) ve `product-import.ts` (plan).
  Sihirbaz elle gönderir (`useNoResetSubmit`, `noValidate` + kendi adım
  denetimi); `<form action>`'a geri dönme. Skill: `add-admin-resource`
- **Oluşturma sihirbazları** (22 Eki 2026): yeni kayıt açan uzun formlar
  adım adım (`src/components/admin/ui/wizard.tsx`: `useWizard` +
  `WizardFrame`; `ActionForm` tabanlı formlar için `WizardActionForm`):
  fatura, elle sipariş, promosyon, kampanya e-postası, menü kalemi,
  uygulama gönderisi; düzenleme sayfaları tek sayfa (`mode: "page"`).
  Adımlar aynı formun içindedir (sonrakiler `hidden`), tek gönderim,
  sunucu denetimi değişmez. Yeni bir uzun oluşturma formu da bu kitle
  yazılır; ayrıntı `docs/ADMIN.md` "Oluşturma sihirbazları"
- **Server action pattern:** Zod parse → store call → revalidatePath →
  redirect. Skill: `server-action-pattern`
- **Migration:** `db/migrations/YYYYMMDDHHMMSS_aciklama.sql`, ardından
  **mutlaka** `npm run db:bundle` ve üretilen dosyaları commit'le. Uygulama
  migration'ı kendisi uygular (`ensureSchemaFresh`, her sorgudan önce
  `_migrations`'ı pakete karşı kontrol eder) — ama yalnızca **bundle'daki**
  migration'ları görür. `db:bundle` unutulursa ne uygulama ne CLI onu görür.
  Deploy'da elle `db:migrate` gerekmez. Skill: `new-migration`
- **Para birimleri:** Tüm fiyatlar **minor unit** (kuruş) `priceMinor: number`;
  UI'da `formatTRY()` ile render edilir
- **Görsel değişiklik yaptıysan** sayfaları gerçekten render edip bak; layout
  hataları (çakışma, taşma) gözle yakalanır, testle değil
- **Ön yüz işi** (tasarım, sayfa, bileşen, CSS, form) → skill
  `frontend-redesign` + `docs/FRONTEND-SINIR.md`. Arka yüz dosyasına dokunmak
  gerekiyorsa önce kullanıcıya söyle, ayrı PR aç
- **Skill'ler** `.claude/skills/` altında; liste, kaynak ve lisanslar
  `docs/SKILLS.md`. Dışarıdan alınanlarda (`frontend-design`,
  `frontend-design-principles`, `copywriting`, `cro`, `emails`, `social`,
  `referrals`, `seo-audit`, `design-lab`) başlarındaki "Bu projede" bölümü geçerlidir;
  pazarlama bağlamı `.claude/product-marketing.md`. Panelde yeni bir alan:
  `build-admin-panel` (gerçek tarayıcıyla doğrulama dahil). Panelde bir ekran
  için beş tasarım seçeneği ve operatörün yorumu: `design-lab` (lab
  `/admin/design-lab`, git'e girmez)
- **Açık bulgular** `docs/AUDIT.md` §8 "Açık"ta; biri üzerinde çalışırken
  oradan sil ve "Düzeltilenler" tablosuna testiyle birlikte taşı

## Yapılmayacaklar

- **PayNkolay canlıda (15 Eki 2026).** Anahtarlar Vercel production'da,
  kurulum `docs/PAYNKOLAY.md` §13, sitedeki kart formu §15. §12'deki canlı
  ölçüm listesinin çoğu sandbox'ta kapandı (§12.1); açık kalanlar orada.
  İlk gerçek kartlı ödeme operatörün işidir. Ödeme akışına
  dokunurken iki tuzağı unutma: `PAYNKOLAY_SUCCESS_URL` **ve**
  `PAYNKOLAY_FAIL_URL` ikisi de `/odeme/donus` olmalıdır (PayNkolay sonucu
  form-POST eder), ve `PAYMENT_PROVIDER` her ortamda tanımlı olmalıdır
- **Kartı bizde saklama.** Operatör kararı: kart bilgisi bizde saklanmaz
  (kural 28); kayıtlı kart yalnız PayNkolay'da. Kart numarasını yazan,
  loglayan bir yol, kart alanlarını dört dosyanın dışına taşımak ya da
  `CardStorageCardRegister` bu kararın değişmesini ister, önce kullanıcıya
  sor
- **Canlı anahtarlarla çekim denemesi yapma** — test hostu
  (`PAYNKOLAY_BASE_URL`) dışında gerçek kartla deneme operatörün işidir
- **PayNkolay webhook'u ARAMA.** Sunucudan sunucuya bildirim yok
  (`docs/PAYNKOLAY.md` §4); ödeme kararı `PaymentList` sorgusundan verilir
- **Mail** Resend üzerinden çıkar (`docs/EMAIL-RESEND.md`); gönderen adresi
  panelden değişir, anahtar hiçbir dosyada durmaz. **SMS** hâlâ MVP dışı
- **Ticari e-postayı İYS kapısının dışından gönderme** (22 Eki 2026):
  kampanya ve doğum günü e-postası yalnız İYS'de ONAY görünen adrese ve son
  İYS ret kontrolü 3 iş gününden yeniyken gider (`src/lib/iys`, aktarım elle:
  `/admin/iys`); ayrıntı ve operatör kılavuzu `docs/IYS.md`
- **Multi-language** MVP dışı (sadece TR)
- Auth sağlayıcısını değiştirme işine kullanıcıdan onay almadan başlama
- **`/api/mobile/v1` uçlarının sözleşmesini kırma** — alan silme/yeniden
  adlandırma, zorunlu yeni alan, kimlik yöntemi değişikliği yok. Sahadaki
  `lafmobil` sürümleri bu uçlara bağlı; ayrıntı yukarıda "Mobil Uygulama"
  başlığında

## Sık Karşılaşılan Hatalar

- **`npm ci` lockfile drift:** Yeni paket ekledikten sonra `npm install`
  çalıştır, `package-lock.json` değişikliğini commit et
- **Hash router'da hydration mismatch:** `LaffogatoApp` mount-öncesi
  `PageHome`'u render eder; hash'i `useEffect`'te okur. Bunu bozma
- **Server action'dan client state'e dönüş yok:** Sepet temizleme
  `/odeme/basarili`'deki `ClearCart` component'iyle yapılır
- **Tam sayfa ekran görüntüsü iki yerde yanıltır:** ekrana sabitlenen öğeler
  (çerez şeridi, 960px altında karaoke sihirbazının ve ödemenin alt çubuğu,
  sayfa kaydırılmışken yapışkan üst çubuk) çekim anındaki ekranın yerinde
  basılır ve uzun görüntünün ortasında içeriğin üstünde görünür. Bu çekimin
  yan etkisidir, çakışma değil: şüpheli yeri pencere boyunda, sayfayı oraya
  kaydırarak çekilen görüntüyle doğrula. Tembel yüklenen görseller
  (`loading="lazy"`, `next/image`) de yaklaşılmadan inmez: çekmeden önce
  sayfayı baştan sona gezdir
