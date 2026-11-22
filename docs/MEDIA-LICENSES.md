# Medya lisansları

> **Durum (22 Kas 2026):** 21 Kas 2026'daki yeni tasarım depoya 16 medya
> dosyası ekledi: anasayfa filminin altı klibi ve altı afişi
> (`public/video/hero-*`) ile dört sayfa açılış fotoğrafı
> (`public/photos/hero-*`). Hepsi Mixkit'ten, hepsi **"Mixkit Stock Video
> Free License"** altında; hiçbiri bizim çekimimiz değil. Bu belge her
> dosyanın kaynağını, lisansını, nasıl kesilip kodlandığını ve kodda nerede
> kullanıldığını kaydeder. Köşkün kendi fotoğrafları, menü kareleri ve rehber
> fotoğrafları başka belgelerde kayıtlı (en altta "Diğer kayıtlar").

Operatör, 21 Kas 2026: _"burdaki herodaki videoyu birebir çek kullan
https://goodboybob.com/"_ ve _"bize uygun olan görselleri de çek marka
belirtilmeyen premiuum olsun"_ (sözlerin tamamı `docs/BRAND.md` §0.6).
Good Boy Bob'un filmi sahibinindir; o yüzden hero'nun biçimi ve davranışı
alındı, filmin yerine lisanslı stok klipler kondu. "Marka belirtilmeyen"
isteği de böyle karşılandı: kliplerde ve karelerde başka bir markanın adı ya
da logosu görünmez (22 Kas 2026'da afişler ve her klipten iki saniyede bir
alınan karelerle bakıldı; tanınabilir kişi yok, yalnız `hero-story`'de bir
elin bir kısmı).

## Kaynak ve lisans

**Kaynak:** Mixkit (mixkit.co, Envato'nun ücretsiz kütüphanesi). Her klibin
sayfası lisansını kendisi söyler; sitede iki video lisansı yan yana durur ve
arama sonuçları ikisini karıştırır.

**"Mixkit Stock Video Free License"** (22 Kas 2026'da mixkit.co/license'tan
okundu; bağlı User Terms "Last revised: October 2, 2025"):

- Ticari ve ticari olmayan projelerde ücretsiz kullanılır. Lisansın kendi
  listesinde "Commercial projects", "Online marketing ads" ve "Social Media
  video posts" var: sitede, uygulamada ve şirket hesaplarında kullanmak
  kapsamdadır.
- İndirme, kopyalama, değiştirme (kesme, kırpma, yeniden kodlama), dağıtma,
  herkese açık gösterme ve yayınlama serbest. Hak münhasır değil, dünya
  çapında, alt lisanslanabilir ve süresiz.
- **Künye zorunlu değil** ("Attribution is not required"); Mixkit mümkün
  olduğunca anılmayı rica eder. Sitede künye basılmıyor; kayıt bu belgedir.
- Sınırlar User Terms'tedir (madde 9 ve 13): klipler olduğu gibi satılamaz,
  başkasına "stok ya da envanter olarak" sunulamaz (ham dosyaları indirme
  sayfası, duvar kâğıdı paketi gibi), insan emeğiyle değiştirilmeden fiziksel
  ya da dijital kopya olarak satılamaz (bir bardağa basmak yeterli değişiklik
  sayılmaz), Mixkit ile rakip bir hizmet kurulamaz, Envato ya da Mixkit adı
  marka olarak kullanılamaz. Bir klipte üçüncü kişiye ait bir bileşen (marka,
  logo) varsa o bileşen için izin bize düşer; bizim kliplerimizde böyle bir
  bileşen yok. Şartlar çiğnenirse Mixkit lisansı sonlandırabilir.
- Klip sayfalarında yapay zekâ işareti yok (22 Kas 2026; yayın tarihleri
  2019-2025, aşağıdaki tabloda). Kural `docs/MENU-PHOTOS.md`'deki yapay zekâ
  kontrolüyle aynıdır.

**"Mixkit Restricted License" kullanılmaz:** yalnız kişisel projeler içindir;
ticari proje, reklam, şirket sosyal medya gönderisi ve YouTube videosu
açıkça yasak. Bir işletmenin satış yapan sitesi ticaridir (aşağıda
"Kullanılmayanlar").

## Anasayfa filmi: `public/video/`

Üç klip sırayla oynar; her klibin iki kesimi (geniş 16:9 ve telefon için dik
9:16) ve her kesimin ilk karesinden bir afişi vardır.

| Klip     | Mixkit | Başlık (sitedeki gibi)                        | Yayın      | Kaynak dosya                   | Kesit           |
| -------- | ------ | --------------------------------------------- | ---------- | ------------------------------ | --------------- |
| `hero-1` | #207   | "Coffee creamer swirling in coffee"           | 7 Kas 2019 | 1920×1080, 23.976 fps, 20.1 sn | 1.0 sn'den 8 sn |
| `hero-2` | #88007 | "Closeup of a espresso coffee machine pour"   | 6 Şub 2019 | 1920×1080, 59.94 fps, 98.4 sn  | 24 sn'den 8 sn  |
| `hero-3` | #1736  | "Latte leaf drawing in a cup, macro close up" | 7 Kas 2019 | 1920×1080, 24 fps, 7.46 sn     | baştan 7.4 sn   |

Sayfalar: `https://mixkit.co/free-stock-video/coffee-creamer-swirling-in-coffee-207/`,
`.../closeup-of-a-espresso-coffee-machine-pour-88007/`,
`.../latte-leaf-drawing-in-a-cup-macro-close-up-1736/`. Kaynaklar 1080p
indirildi, sessizdi.

| Dosya             | Piksel    | CRF | Bayt                | Afiş (`.webp`) |
| ----------------- | --------- | --- | ------------------- | -------------- |
| `hero-1-wide.mp4` | 1920×1080 | 26  | 1 292 391 (1.29 MB) | 22 KB          |
| `hero-1-tall.mp4` | 720×1280  | 24  | 978 597 (0.98 MB)   | 9 KB           |
| `hero-2-wide.mp4` | 1920×1080 | 23  | 1 067 910 (1.07 MB) | 65 KB          |
| `hero-2-tall.mp4` | 720×1280  | 24  | 516 392 (0.52 MB)   | 33 KB          |
| `hero-3-wide.mp4` | 1920×1080 | 23  | 1 180 901 (1.18 MB) | 85 KB          |
| `hero-3-tall.mp4` | 720×1280  | 24  | 377 458 (0.38 MB)   | 32 KB          |

- **Ortak:** H.264 High, `yuv420p`, x264 `-preset slow`, 24 fps, ses izi
  yok, `moov` dosyanın başında (`-movflags +faststart`: tarayıcı dosyanın
  tamamını beklemeden oynatır).
- **Geniş kesim:** kaynak zaten 1920×1080; ölçek değişmedi, yalnız 24 fps'ye
  çevrildi ve kesildi.
- **Dik kesim:** 16:9 karenin tam ortasından 608×1080 (soldan 656 piksel),
  lanczos ile 720×1280.
- **Neden `hero-1` CRF 26:** sürekli dönen krema en ağır kesit; CRF 23'te
  2.36 MB tutuyordu, 26'da 1.29 MB. Diğer iki geniş kesim 23'te bütçenin
  içinde kaldı.
- **Afişler:** her kesimin ilk karesi, WebP q78; geniş 1920×1080, dik
  720×1280.
- Komutlar aşağıda "Kendi filmimizle değiştirmek"te. Aynı komutlar 22 Kas
  2026'da Mixkit kaynaklarından altı mp4'ü bayt bayt yeniden üretti (ffmpeg
  6.1.1, x264 core 164). Afişler aynı ayarla birkaç KB farkla çıkar.

**Kodda nerede.** Yalnız anasayfa (`/`): `src/components/laffogato/home-hero.tsx`,
`home-page.tsx`'in `<HomeHero />`'su. Yollar dosya adı olarak geçmez,
`HERO_SLIDES`'ın `media` alanından kurulur
(`/video/${media}-${tall ? "tall" : "wide"}.${"mp4" | "webp"}`); bu yüzden
`grep "hero-1"` `HERO_SLIDES`'ı bulur, tam yolu değil.

| `media`  | Başlık                   | Bağlantı                          |
| -------- | ------------------------ | --------------------------------- |
| `hero-1` | Tuzla'da İtalyan kahvesi | `/menu` "Menüyü gör"              |
| `hero-2` | Espresso barı            | `/menu/espresso` "Sıcak kahveler" |
| `hero-3` | Kahve evde de bizden     | `/magaza` "Mağazaya git"          |

**Nasıl iner (Vercel trafiği için).**

- Sunucu üç afişi `<picture>` içinde düz `<img>` olarak çizer (`next/image`
  değil, görsel dönüşümü yok); telefon (`max-width: 767px`) dik afişi alır.
  İlk afiş `fetchpriority="high"`, diğer ikisi `loading="lazy"`.
- `<video>` hidrasyondan sonra ve yalnız azaltılmış hareket ve Save-Data
  yokken çizilir; o ikisinde klip hiç inmez, afiş kalır. Başta yalnız ilk
  klibe kaynak verilir (`preload="auto"`), sonraki klip oynayanın yarısında
  istenir. Hero ekranın %15'inden azındayken ya da sekme gizliyken film
  durur.
- **İlk ziyaret:** geniş ekranda ~1.3 MB (ilk klip 1.29 MB + afiş), telefonda
  ~1 MB (0.98 MB + afiş). Üç klibi de izleyen: 3.54 MB geniş, 1.87 MB dik;
  üç afiş birlikte 172 KB geniş, 75 KB dik. Yerini aldığı yolculuk filmi
  1.44 MB ve 1.17 MB idi (tarihçe).
- `.mp4` ve `.webp` istekleri proxy'ye uğramaz (`src/proxy.ts` matcher'ı
  uzantıyla dışlar): film fonksiyon çağrısı saymaz, yalnız bant genişliği.
- **Önbellek:** `next.config.ts`'teki günlük `Cache-Control` kuralı
  `/:dir(brand|photos|menu|illustrations)/` içindir, `/video/` yok. Dosyalar
  Next'in `public/` varsayılanıyla (`public, max-age=0`) gider: tarayıcı her
  ziyarette sorar, değişmediyse 304 alır, baytlar yeniden inmez. Bir kural
  eklemek `next.config.ts` değişikliğidir (arka yüz, ayrı PR;
  `docs/FRONTEND-SINIR.md`). Dosya adları içerikten damgalı olmadığı için
  uzun bir önbellek eklenirse yeni film yeni adla gelmelidir (eski adla
  konan film ziyaretçide eskisini gösterir).

## Sayfa açılış fotoğrafları: `public/photos/hero-*.webp`

Mixkit kliplerinden alınmış tek kareler; hepsi 1920×1080, WebP q80.

| Dosya               | Mixkit  | Başlık (sitedeki gibi)            | Yayın      | Kare                                         | Bayt  |
| ------------------- | ------- | --------------------------------- | ---------- | -------------------------------------------- | ----- |
| `hero-menu.webp`    | #88007  | (filmin `hero-2` klibiyle aynı)   | 6 Şub 2019 | 60. sn                                       | 66 KB |
| `hero-shop.webp`    | #100248 | "Creamy Coffee Pour in Glass Mug" | 5 Oca 2025 | 14. sn                                       | 67 KB |
| `hero-story.webp`   | #3576   | "Frothing milk seen in detail."   | 3 Tem 2020 | 5. sn                                        | 30 KB |
| `hero-karaoke.webp` | #2850   | "Microphone viewed closely"       | 6 Ara 2019 | uzunluğunun 5/8'i (~6 sn, 10.08 sn'lik klip) | 59 KB |

Kaynak sayfaları aynı biçimde: `https://mixkit.co/free-stock-video/<başlık>-<numara>/`
(`creamy-coffee-pour-in-glass-mug-100248`, `frothing-milk-seen-in-detail-3576`,
`microphone-viewed-closely-2850`). Kareler 22 Kas 2026'da kaynaklarla
karşılaştırılarak doğrulandı (SSIM).

**Kodda nerede** (`grep -rn "photos/hero-" src`):

| Dosya               | Bileşen                                                             | Sayfa                                      |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------ |
| `hero-menu.webp`    | `menu-page.tsx` `<PageHero>`                                        | `/menu`, `/menu/<kategori>`, `/masa/<kod>` |
| `hero-shop.webp`    | `shop-page.tsx` (yalnız panelde etkin mağaza slaytı yokken)         | `/magaza`, `/magaza/<kategori>`            |
| `hero-story.webp`   | `story-page.tsx` `<PageHero>`                                       | `/hikayemiz`                               |
| `hero-karaoke.webp` | `karaoke-booking.tsx` `<PageHero>` ve `home-page.tsx` karaoke bloğu | `/karaoke` ve `/`                          |

Dördü de `next/image` ile gider (`/_next/image`, önce AVIF;
`next.config.ts` `minimumCacheTTL` bir ay). Hepsi atmosfer resmidir
(`alt=""`), bir ürünün fotoğrafı olarak sunulmaz.

## Kullanılmayanlar (bilerek)

- **Good Boy Bob'un hero filmleri** (goodboybob.com): operatör "birebir"
  istedi; film sahibinin eseridir, indirilmedi, depoda yok. Aynı düzende
  Mixkit klipleri oynar.
- **Blue Bottle'ın fotoğrafları, logosu, şişe işareti ve metinleri**
  (bluebottlecoffee.com): alınmadı. Yalnız tasarım dili alındı (`docs/BRAND.md`
  §0.6).
- **Referansların yazı yüzleri:** Blue Bottle Dinamo'nun ABC Marfa ve ABC
  Diatype yüzlerini ticari lisansla kullanır; sitede yoklar. Yerlerinde
  aynı yapıda açık yüzler var: Archivo ve Geist (SIL Open Font License 1.1),
  `next/font/google` ile sitenin kendisinden sunulur (`src/app/layout.tsx`).
  Ticari bir yüz web lisansı alınmadan ve `docs/BRAND.md` §0.6'ya yazılmadan
  eklenmez.
- **Referans sayfaların ekran görüntüleri** yalnız ölçü almak için oturum
  makinesinde kaldı; depoya girmedi. `git diff 4962da2..HEAD -- public`
  yalnız bu belgedeki 16 dosyayı ekler (ve iki kullanılmayan dosyayı siler:
  `public/photos/affogato-tray.webp`, `public/brand/app-screen-campaigns.webp`).
- **Mixkit "Restricted" klipleri:** #21882 "Mixing the cream on a Latte"
  (film için aday) ve #24621 "Golden glow on a microphone" (karaoke resmi
  için aday). İkisi de "Mixkit Restricted License": yalnız kişisel proje.
  Yeni bir Mixkit klibi indirmeden önce klibin sayfasındaki lisans satırı
  okunur; "Free License" yazmıyorsa kullanılmaz.
- Denenip seçilmeyen: #4632 "Microphone in a party hall" (Free License,
  karaoke resmi için aday; #2850 seçildi). Depoda yok.
- Politika öncekilerle aynıdır (tarihçe): 11 Kas 2026'daki Roast referans
  sayfadan yalnız oranları aldı; 17 Kas 2026'daki yolculuk filmi promptun son
  karesini başka bir firmanın logosu olduğu için kullanmadı.

## Kendi filmimizle değiştirmek

Stok film geçicidir; köşkte çekilmiş bir film her zaman daha iyidir (rehber
fotoğraflarındaki gerekçe aynı: `docs/SEO.md` "Rehber fotoğrafları").

1. **Çekim.** Yatay 16:9, en az 1920×1080, 24 ya da 25 fps; klip başına
   7-8 sn'lik sakin bir kesit. Kadrajda başka bir markanın logosu olmasın
   (operatörün "marka belirtilmeyen" isteği). Tanınabilir bir kişi (müşteri,
   çalışan) varsa yazılı izni alınır.
2. **Dik kesim.** Ya aynı çekimin ortasından kırpılır (özne ortada olmalı)
   ya da telefon için ayrıca dik (9:16) çekilir.
3. **Dosya adları aynı kalırsa kod değişmez:**
   `public/video/hero-{1,2,3}-{wide,tall}.mp4` ve her kesimin yanında aynı
   adlı bir `.webp` afiş (`hero-1-wide.webp`, `hero-1-tall.webp` ...; toplam
   altı klip, altı afiş). Klip sayısı, başlık ya da bağlantı değişecekse
   `HERO_SLIDES` (`src/components/laffogato/home-hero.tsx`; ön yüz dosyası).
4. **Kodlama** (Mixkit kliplerini üreten komutların aynısı; `-ss` kesitin
   başı, `-t` uzunluğu):

   ```bash
   # Geniş kesim (16:9): masaüstü ve tablet
   ffmpeg -ss 1.0 -i kaynak.mp4 -t 8 -an \
     -vf "scale=1920:-2:flags=lanczos,fps=24" \
     -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p \
     -movflags +faststart public/video/hero-1-wide.mp4

   # Dik kesim (9:16): telefon. 1080 satırlık karenin ortasından 608x1080.
   ffmpeg -ss 1.0 -i kaynak.mp4 -t 8 -an \
     -vf "crop=608:1080,scale=720:1280:flags=lanczos,fps=24" \
     -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p \
     -movflags +faststart public/video/hero-1-tall.mp4

   # Afişler: her kesimin ilk karesi
   ffmpeg -i public/video/hero-1-wide.mp4 -frames:v 1 \
     -c:v libwebp -quality 78 public/video/hero-1-wide.webp
   ffmpeg -i public/video/hero-1-tall.mp4 -frames:v 1 \
     -c:v libwebp -quality 78 public/video/hero-1-tall.webp
   ```

   - Kaynak 4K ise dik kesimde `crop=1216:2160` kullan ya da süzgecin başına
     `scale=-2:1080:flags=lanczos,` ekle. Özne ortada değilse
     `crop=608:1080:X:0` (X soldan piksel).
   - Telefon için ayrıca dik çekildiyse: `-vf "scale=720:1280:flags=lanczos,fps=24"`.
   - Ses izi konmaz (`-an`): film sessiz oynar, ses izi yalnız bayt ekler.

5. **Ağırlık bütçesi.** Klip başına geniş kesim en çok ~1.3 MB, dik kesim
   ~1 MB; üç klip birlikte ~3.5 MB ve ~1.9 MB; afiş 100 KB'ın altında.
   Çözünürlük 1920 ve 720 genişliğin üstüne çıkmaz. Dosya büyük çıkarsa CRF
   1-2 artırılır (x264'te +6 CRF dosyayı kabaca yarıya indirir) ya da kesit
   7 sn'ye kısaltılır. **Neden:** her anasayfa ziyareti en az ilk klibi
   indirir ve film sayfanın en ağır parçasıdır. Vercel'in bant genişliği
   sınırlıdır: site 14 Kas 2026'da Hobby planının kullanım sınırı aşılınca
   durdu (`CLAUDE.md` "Vercel kullanım sınırı"). Klip eklemeden ya da
   kaliteyi artırmadan önce bu rakamlar okunur.
6. **Kontrol.**
   `ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate:format=duration,size -of compact public/video/hero-*.mp4`
   (yalnız `video` akışı, 1920×1080 ve 720×1280, 24/1). Sonra sayfa masaüstü
   ve telefon genişliğinde, bir de azaltılmış hareketle (yalnız afiş) açılıp
   bakılır.
7. **Kayıt.** Aynı PR'da bu belge güncellenir: Mixkit satırları tarihiyle
   "Tarihçe" başlığına taşınır, yeni filmin kim tarafından, ne zaman ve
   nerede çekildiği yazılır; `docs/BRAND.md` §6 "Ağırlık" rakamları da
   düzeltilir.

Sayfa açılış fotoğrafları da aynı yolu izler: aynı adla
(`public/photos/hero-menu.webp` ...) 1920×1080 WebP q80 konur, kod değişmez.
Bir videodan kare alınacaksa:
`ffmpeg -ss 5 -i kaynak.mp4 -frames:v 1 -vf "scale=1920:-2:flags=lanczos" -c:v libwebp -quality 80 public/photos/hero-story.webp`.

## Diğer kayıtlar

- **Köşkün kendi fotoğrafları:** `public/photos/` altındaki diğer sekiz
  dosya (`affogato-cup`, `drinks-tray`, `facade-day`, `facade-night`,
  `interior-chest`, `interior-mirror`, `terrace-canopy`, `terrace-wide`);
  `docs/BRAND.md` §6 "Bizim fotoğraflarımız".
- **Menü kareleri:** `public/menu/*.webp`; her dosyanın kaynağı, yaratıcısı
  ve lisansı (CC0 1.0 / Public Domain Mark) `docs/MENU-PHOTOS.md`.
- **Rehber fotoğrafları:** `public/rehber/*.webp`; künyeleri
  `src/lib/seo/guide-content.ts` (`credit` alanı: Unsplash License ya da
  CC0, fotoğrafçı ve bağlantı), işleniş `docs/SEO.md` "Rehber fotoğrafları".
- **Kalan iki çizim:** `public/illustrations/karaoke-room.webp` ve
  `karaoke-mic-cut.webp`; panelin anasayfa slaytları ve karaoke paylaşım
  kartı okur (`docs/BRAND.md` §6).
- **Uygulama ekranları:** `public/brand/app-screen-home.webp` ve
  `app-screen-menu.webp` (22 Kas 2026) kendi uygulamamızın App Store ekran
  görüntüleridir (`RiosenBeq/lafmobil` `store/screenshots/6.7-inch/`
  `01-ana-sayfa.jpg`, `02-menu.jpg`; 600 × 1300 webp). Anasayfanın uygulama
  bölümündeki masa siparişi ekranı görsel değil, işaretlemedir
  (`src/components/laffogato/app-showcase.tsx`).
- **Yazı yüzleri:** `src/app/layout.tsx` (Archivo, Geist; SIL OFL 1.1).

## Yeni bir medya dosyası eklerken

- Kaynağı, lisansı, kesimi ve kodda nerede kullanıldığı **aynı PR'da** bu
  belgeye (ya da yukarıdaki ilgili kayda) yazılır.
- Mixkit'ten yalnız "Mixkit Stock Video Free License" taşıyan klip.
- Referans sitelerden görsel, film, logo, metin ya da yazı yüzü yok.
- Kadrajda başka bir markanın logosu yok; tanınabilir kişi varsa yazılı izin.
- Yapay zekâ işareti taşıyan görsel yok (`docs/MENU-PHOTOS.md`'deki kontrol).
- Ağırlık bütçesi yukarıda; film ya da fotoğraf büyüdükçe Vercel trafiği
  büyür.
