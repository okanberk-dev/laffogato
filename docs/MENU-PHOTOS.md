# Menü fotoğrafları

> **Durum (24 Kas 2026):** 103 kalemin 78'inde operatörün kendi görsel seti
> (`public/menu/studio/`, aşağıda "Operatörün seti"). Önceki stok fotoğraf
> bölümleri (17-18 Eki 2026) tarihçedir: o kalemlerde canlı veritabanı artık
> yeni seti taşır.

> **Eski durum (18 Eki 2026):** 82 kalemin 68'inde stok fotoğraf.

Operatör, 17 Eki 2026: _"menüdeki ürünlere telifsiz görseller bularak hem site
hem uygulama tarafında yükle"_.

## Nasıl bağlı

- Dosyalar `public/menu/<ad>.webp`. `menu_items.image` site-göreli yolu taşır
  (`/menu/<ad>.webp`), Ağustos'taki üç fotoğrafla aynı biçimde.
- Canlı veritabanına `db/migrations/20261017120000_menu_photos.sql` yazar. Bir
  satıra yalnız üçü birden tutarsa dokunur: fotoğrafı yok (`image = ''`), adı
  fotoğrafın seçildiği ad, dosya daha önce çalışmamış (kendi `_migrations`
  kaydına bakar). Panelden yüklenmiş ya da bağlanmış bir fotoğraf değişmez;
  panelden kaldırılan bir fotoğraf sonraki deploy'da geri gelmez (paket her
  yeni migration'da bütün migration'ları yeniden çalıştırır).
- İçeriği tutmayan on fotoğrafı `db/migrations/20261018210000_menu_photos_mismatch.sql`
  boşaltır: yalnız satır hâlâ eski migration'ın yazdığı yolu taşıyorsa ve dosya
  daha önce çalışmamışsa. Panelden yüklenmiş başka bir fotoğrafa dokunmaz.
  Dosyalar `public/menu`'da kalır (eski migration onlara yol veriyor).
- Boş bir veritabanı (yeni ortam, CI) fotoğrafları paketteki tohumdan alır:
  `src/components/laffogato/data.ts` aynı yolları taşır. Veritabanına
  ulaşılamadığında gösterilen menü de bu tohumdur.
- Uygulama aynı `GET /api/mobile/v1/menu`'dan okur (`image` mutlak adres olarak
  gelir, `https://laffogato.net/menu/<ad>.webp`) ve fotoğrafı kare bir karoda,
  küçük önizlemelerde daire içinde gösterir: `photoCutout` false, bu
  fotoğraflar dekupe değil, kare. Sözleşme değişmedi, yalnız değerler.
- Sahne rengi (`backdrop`, `backdropHex`) yazılmadı. Site-göreli bir fotoğrafın
  sahnesini `scripts/backfill-backdrops.mjs` seçer (önce kuru koşu, sonra
  `--apply`); Ağustos'taki üç fotoğrafın da seçimi henüz yok. Çalışana dek
  uygulama sahneyi bugünkü gibi `hue`'dan çizer.
- Sitede "Görseller temsilidir" notu (`menu-photo-note.tsx`): menü ızgarasının
  altında (`/menu`, `/menu/<kategori>` ve `/masa/<kod>`, hepsi `PageMenu`) ve
  ana sayfadaki "Şimdi barda olanlar" şeridinin altında. Ekranda en az bir
  fotoğraf varken çizilir.

## Operatörün seti (24 Kas 2026)

Operatör, 24 Kas 2026: _"ekteki görselleri ilgili ürünlere yükle ve diğer
bağlantılı platformlara da gittiğinden emin olup maine gönder lafmobil ladmin
lafpos vs. gibi"_. Set 85 görseldir (1280x720, L'Af baskılı bardak, kılıf ve
kutular; üretim betiği ve istemleri zip'te `_tools/` altındaydı, repoya
alınmadı).

- **Dosyalar:** `public/menu/studio/<ad>.webp`, ortadan (ürüne göre
  kaydırılarak) 720x720 kare kırpılmış WebP, ortalama 51 KB. Adlar yeni:
  site-göreli fotoğrafın menü uçunda damgası yoktur ve uygulamanın disk
  önbelleği adrese bağlıdır; eski bir adı yeniden kullanmak telefonlarda eski
  fotoğrafı bırakırdı.
- **Bağlama:** `db/migrations/20261124150000_menu_studio_photos.sql`, 78 satıra
  `image = '/menu/studio/<ad>.webp'` yazar (`photoCutout` false). Satır yalnız
  adı hâlâ migration'daki adsa yazılır; dosya bir kez çalışır (`_migrations`),
  sonradan panelden değiştirilen fotoğraf sonraki deploy'da geri gelmez.
  **Önceki 78 fotoğrafın yerine geçer** (panelden yüklenmiş JPEG'ler dahil),
  eskileri repo tutmaz; geri almak için panelden yeniden yüklenir.
- **Platformlar:** hepsi aynı alanı okur. Site, uygulama (`GET
  /api/mobile/v1/menu`, `image` mutlak adres `https://laffogato.net/menu/studio/...`)
  ve LafPOS (herkese açık menü ucu) değişikliği menünün önbellek penceresinde
  (CDN 60 + 60 sn, uygulama 2 dk) görür. ladmin menüde görsel eşitlemez
  (`docs/PANEL-MENU.md`: ad, açıklama, kategori, görsel ve alerjen eşitlenmez).
  `docs/API-MOBILE.md` değişmedi, yalnız değerler.
- **Eşlenmeyenler:** görsel olup kalemi olmayan yedi dosya yüklenmedi:
  `L'Affogato 2/3/4` (aynı kalemin üç varyantı; `mnu-0004` ilkini taşır),
  `Su (Cam)` (`mnu-0036` "0,5 lt" olduğu için PET), `Fincan Çay` (`mnu-0042`
  "Demlik çay": bardak görseli), `Dana Jambonlu Panini`, `Ekşi Mayalı Salamlı
  Sandviç` (menüde yok). Kalemi olup görseli olmayanlar eski fotoğrafını
  korur (`mnu-0066`, `0067`, `0073`, `0080-0097`, `0099`, `0101-0103`).
  `mnu-0075` "Hindi Fümeli Sandviç" kruvasanlı görseli taşır: kalem metni
  ekmeğin cinsini söylemez, operatör teyit eder.
- **Yapay zekâ üretimi.** Set yapay zekâ ile üretildi (zip'teki `gen.py`).
  Aşağıdaki "Ev kuralı" bunu menü fotoğrafı olarak yasaklıyordu; operatör
  açıkça isteyerek 24 Kas 2026'da bu istisnayı yaptı. Açık kalan: Ticari
  Reklam Yön. m.18/8 (yapay zekâ kullanımının belirtilmesi) ve TKHK m.61-62'ye
  göre üretilmiş görselin ürünü yanıltıp yanıltmadığı avukata sorulur;
  "Görseller temsilidir" notu (`menu-photo-note.tsx`) bunu karşılamaz ve
  "yapay zekâ ile üretilmiştir" ibaresi **eklenmedi**: müşteriye görünen
  metin operatörün kararıdır.

## Lisans

- Kullanımdaki 65 stok fotoğrafın 64'ü **CC0 1.0**, 1'i **Public Domain
  Mark 1.0** (Flickr): ticari kullanım serbest, atıf zorunlu değil, copyleft
  yok. Atıf zorunlu olmasa da her dosyanın kaynağı, yaratıcısı ve orijinal
  adresi aşağıda kayıtlı.
- Hepsi Openverse API'sinden bulundu (`license=cc0,pdm`). Kullanımdakiler:
  rawpixel 22, Wikimedia Commons 15, WordPress Photo Directory 11, Flickr 11,
  StockSnap 6.
- Lisans kullanımdaki 37 dosyada kaynağın kendisinde de doğrulandı: Wikimedia
  Commons'ta Commons API'siyle (hepsi CC0, atıf istemiyor), Flickr ve
  WordPress Photo Directory'de fotoğrafın sayfasında. rawpixel ve StockSnap
  sayfaları bot doğrulamasının arkasında, açılamadı; bu 28 dosyanın lisansı
  Openverse kaydından, iki site de bu koleksiyonları CC0 olarak yayımlıyor
  (StockSnap'in tamamı CC0). İstenirse sayfalar tarayıcıda açılıp bakılabilir.
- Yapay zekâ kontrolü (Ticari Reklam Yön. m.18/8): "AI generated" ya da
  benzeri işaret taşıyan görsel panelden kalkar ve buraya not düşülür.
  Geliştiricinin payı 18 Eki 2026'da yapıldı, 37 kaynağın hiçbirinde işaret
  yok: Wikimedia Commons'taki 15 dosyanın hiçbiri yapay zekâ kategorisinde
  değil (Commons API, kategoriler ve lisans); Flickr'daki 11 fotoğraf
  2007-2018 arasında yüklendi, gerçekçi görüntü üreten araçlardan önce;
  WordPress Photo Directory yalnız fotoğraf kabul ediyor ve her gönderiyi
  denetliyor, 11 sayfanın 8'inde kamera bilgisi (diyafram, ISO) var, mnu-0029,
  mnu-0045 ve mnu-0060'ta yok ama işaret de yok. Kalan 22 rawpixel ve 6
  StockSnap sayfası bot doğrulamasının arkasında: operatör 23 Ekim 2026'ya
  kadar tarayıcıda açar. İşaretsiz yayımlanmış bir yapay zekâ görselini
  tarama yakalamaz: kalıcı çözüm barın kendi fotoğrafları.
- İçerik kontrolü (18 Eki 2026): kalan fotoğraflar kalemlerin metniyle
  yeniden karşılaştırıldı. mnu-0061 ve mnu-0078 kalemde olmayan kuruyemişi
  gösterdiği için kalktı (mnu-0067 ile aynı ölçüt). Kremalı ya da kakao
  serpilmiş süslemeler (ör. mnu-0016, mnu-0026, mnu-0039, frappe'ler) barın
  kendi sunumuna göre kendi fotoğraflarıyla değişirken kontrol edilir.

## Ev kuralı

Bir fotoğraf, kalemde olmayan bir malzemeyi, sosu, katmanı veya süslemeyi
göstermez; kalem metninde adı geçen bir malzemeyi dışarıda bırakmaz ve hiçbir
zaman başka bir ürün türünü göstermez. Yapay zekâ ile üretilmiş ya da kırpma,
ışık ve renk düzeltmesi dışında değiştirilmiş bir görsel menü kalemi
fotoğrafı olarak kullanılmaz (24 Kas 2026 operatör istisnası: yukarıda
"Operatörün seti"). Kalemin tarifi değiştiğinde fotoğrafı yeniden
kontrol edilir. Alerjenler yalnız metinle bildirilir.

"Görseller temsilidir" notu yalnız sunum farkını (bardak, süsleme düzeni,
ışık, porsiyon yerleşimi) karşılar; içeriği kalemle çelişen bir fotoğrafı
hiçbir not kurtarmaz (TKHK m.61, m.62, m.8/2; Ticari Reklam Yön. m.7/5-a,
m.18/6-7, m.29/2-a). Menü dışı bir reklamda yapay zekâ ile üretilmiş ya da
değiştirilmiş bir görsel kullanılırsa hemen yanına, okunur büyüklükte: "Bu
görsel yapay zekâ ile üretilmiştir."

- Unsplash ve Pexels kullanılmadı: ikisi de sayfayı bot doğrulamasının arkasına
  alıyor (Anubis, Cloudflare) ve doğrulamayı aşmak kapsam dışı.
- Elenenler: yüz görünen, başka bir markanın logosu ya da ambalajı olan,
  filigranlı, alkollü ya da ürünü yanlış gösteren (sıcak ürüne buzlu içecek,
  başka bir tatlı) fotoğraflar. Kişi, el, marka ya da yazı kenarda kalıyorsa
  kırpılarak kadraj dışına alındı (aşağıda "Notlar").

## İşleme

Ham dosyalar ayrı bir klasöre indirildi ve yalnız `sips` ile `cwebp` ile
işlendi: sRGB, ürün ortada kare kırpma (uygulama kare karoda ya da daire içinde
gösterir), 900 x 900, WebP kalite 80 (120 KB'a sığmayan birkaçında biraz daha
düşük), alfa yok, EXIF, XMP ve ICC yok. En büyük dosya 113 KB, toplam 3,8 MB.
`tests/menu-photos.test.ts` her dosyanın var, kare WebP ve 150 KB'tan küçük
olduğunu tutar.

## Değiştirmek ya da kaldırmak

- Panelden yeni fotoğraf yüklemek yolu değiştirir; migration bir daha yazmaz.
- Bir dosyayı elle bağlamak için paneldeki fotoğraf alanına `/menu/<ad>.webp`
  yaz.
- Bir dosyanın yerine yenisini koyarken **yeni bir ad** ver: `/menu/*`
  tarayıcıda bir gün, `next/image` çıktısı kenarda bir ay önbellekte kalır.
- Kendi fotoğrafın oldukça önce aşağıdaki "tam eşleşmeyenler" değişmeli;
  barın kendi fotoğrafları 30 Kasım 2026'ya kadar stok fotoğrafların yerini
  alır, fotoğrafı boşalan on kalemden başlayarak.

## Fotoğrafsız kalanlar

| id       | Ad                           | Neden                                                                                                                                                                            |
| -------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mnu-0041 | Salep                        | Bardakta ya da fincanda salep fotoğrafı yok: tek sonuç tarçınlı yüzeyin yakın çekimi, içecek görünmüyor; tarçınlı köpüklü kahve salep değil.                                     |
| mnu-0053 | Çarkıfelek                   | CC0 ya da PDM bir çarkıfelekli frozen ya da içecek fotoğrafı yok: sonuçlar bitki, çiçek ve botanik çizim; tek bardak fotoğrafı (buz ve çekirdek, yakın çekim) ürünü göstermiyor. |
| mnu-0054 | Ananas                       | Ananaslı frozen ya da smoothie yok: sonuçlar kokteyl kadehi (alkol izlenimi), plastik bardakta düşük kaliteli bir meyve suyu ya da bütün ananas.                                 |
| mnu-0080 | Şurup                        | Markasız bir şurup şişesi yok: sonuçlar akçaağaç şurubu, ilaç şişesi, bar şişeleri ya da çizim.                                                                                  |
| mnu-0028 | Buzlu Balkabağı Latte        | Fotoğrafın adı "Iced Mocha": genel bir buzlu mocha, balkabağı yok (18 Eki 2026'da kalktı).                                                                                       |
| mnu-0056 | Şeftalili Soğuk Çay          | Naneli soğuk çay, şeftali yok (18 Eki 2026'da kalktı).                                                                                                                           |
| mnu-0059 | Yaban Mersinli San Sebastian | Bisküvi tabanlı, üstü yanık olmayan bir tart; San Sebastian değil (18 Eki 2026'da kalktı).                                                                                       |
| mnu-0061 | L'Af Kahve                   | Dilimin yanında yığın hâlinde ceviz; kalemde ceviz ya da kuruyemiş etiketi yok (18 Eki 2026'da kalktı).                                                                          |
| mnu-0063 | Çilek Magnolia               | Kadehte krema ve çilek; kalemin bisküvi kırığı yok (18 Eki 2026'da kalktı).                                                                                                      |
| mnu-0067 | Klasik Spoonful              | Kuruyemiş ve granolalı bir parfe; kalemde kuruyemiş yok (18 Eki 2026'da kalktı).                                                                                                 |
| mnu-0073 | Karabuğday Simit             | Beyaz susamlı klasik simit, karabuğdaylı değil (18 Eki 2026'da kalktı).                                                                                                          |
| mnu-0074 | Rosbeef Sandviç              | Rosbif, çiğ soğan ve peynir; kalemin yeşilliği ve sosu yok (18 Eki 2026'da kalktı).                                                                                              |
| mnu-0078 | Kakao Protein Bar            | Kakaolu barların yanında bademli, çekirdekli başka bir bar; kalemde kuruyemiş yok (18 Eki 2026'da kalktı).                                                                       |
| mnu-0082 | Alternatif Süt               | Kenevir sütü ve kenevir tohumu; barda kenevir sütü yok (18 Eki 2026'da kalktı).                                                                                                  |

Site ve uygulama bu kalemlerde bugünkü gibi çizimi gösterir. Başka bir meyvenin
ya da içeceğin fotoğrafı ürünü yanlış gösterirdi. Son onunun fotoğrafı
içeriği kalemle çeliştiği için kalktı (`20261018210000_menu_photos_mismatch.sql`
ve `data.ts`): kalemde olmayanı gösteren ya da kalemin adındaki malzemeyi
dışarıda bırakan bir fotoğrafı "Görseller temsilidir" notu düzeltmez.

## Notlar

Kırpılarak kadraj dışında bırakılanlar:

- mnu-0021 Buzlu Chai: geniş bir kafe çekiminden yalnız bardak.
- mnu-0031 Çıtır Latte: arkada oturan bir kişi. İlk seçimde kremanın üstünde
  muz dilimleri vardı, fotoğraf değiştirildi.
- mnu-0042 Çay: üstteki kişiler.
- mnu-0044 Espresso Frappe: ilk seçimdeki bardakta bir dükkânın baskılı
  amblemi vardı, fotoğraf değiştirildi.
- mnu-0046 Karamel Frappe: bardağın kenarındaki muz dilimi.
- mnu-0057 Donostia: arkadaki barista.
- mnu-0065 Lotus Magnolia: markalı bisküvi.
- mnu-0071 Cookie Aşkı: kenardaki el ve bardak.

Temsilî ama tam eşleşmeyenler (yalnız sunum farkı, not bunları karşılar):

- mnu-0018 Balkabağı Latte: tarçın serpilmiş köpüklü latte, balkabağı
  görünmüyor.
- mnu-0027 Buzlu Toffeenut Latte: genel buzlu latte.

Bu listedeki diğer sekiz kalemin fotoğrafı 18 Ekim'de kalktı ("Fotoğrafsız
kalanlar").

Markaya bağlı ya da genel kalemler, brifteki gibi: mnu-0079 Koska Fındık için
düz fındık (marka görünmez), mnu-0032 Sürpriz İçecek için nötr, renkli buzlu
bir içecek (frambuazlı limonata); Su, Soda (limon dilimli bir bardak maden
suyu) ve Ekstra Shot için genel birer fotoğraf.

## Kalem kalem kaynaklar

Hepsi 17 Eki 2026'da alındı. "Yaratıcı" Openverse kaydındaki addır; rawpixel
kayıtlarında ad yok. Lisansında "(kullanılmaz)" yazan on satırın fotoğrafı 18 Eki
2026'da menüden kalktı; satır kayıt için, dosya eski migration için duruyor.

| id       | Ad                           | Dosya                            | Kaynak sayfa                                                                                | Yaratıcı            | Lisans                       | Alındı     | Orijinal                                                                                                                                                                 |
| -------- | ---------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- | ------------------- | ---------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| mnu-0004 | L'Affogato                   | `affogato.webp`                  | https://www.rawpixel.com/image/3283469/free-photo-image-ice-cream-icecream-food-photography | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYxNzE1Njg0LXdpa2ltZWRpYS1pbWFnZS1rb3diZDkyOS5qcGc.jpg      |
| mnu-0005 | Espresso                     | `espresso.webp`                  | https://www.rawpixel.com/image/3303546/free-photo-image-coffee-bean-plant                   | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA2L3Vwd2s2MTcxNDAxNS13aWtpbWVkaWEtaW1hZ2Uta293cXhkOGkuanBn.jpg                         |
| mnu-0006 | Americano                    | `americano.webp`                 | https://stocksnap.io/photo/black-coffee-16FMJJST6L                                          | Mary Whitney        | CC0 1.0                      | 2026-10-17 | https://cdn.stocksnap.io/img-thumbs/960w/16FMJJST6L.jpg                                                                                                                  |
| mnu-0007 | Latte                        | `caffe-latte.webp`               | https://www.rawpixel.com/image/5908079/image-public-domain-art-coffee                       | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg1NDk2MDMtaW1hZ2Uta3d2dmVpbDguanBn.jpg                         |
| mnu-0008 | Flat White                   | `flat-white.webp`                | https://www.rawpixel.com/image/5907010/photo-image-public-domain-art-coffee                 | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL3B4NjM1MjYxLWltYWdlLWt3dnY4dXdyLmpwZw.jpg                                   |
| mnu-0009 | Mocha                        | `mocha.webp`                     | https://www.rawpixel.com/image/6040245/photo-image-public-domain-coffee-chocolate           | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZyY2FwcHVjY2lub19iZXZlcmFnZV9pbl9tb3JuaW5nXzktaW1hZ2Uta3liZTRidmsuanBn.jpg |
| mnu-0010 | Cappuccino                   | `cappuccino.webp`                | https://stocksnap.io/photo/coffee-cappuccino-UXO5P8KFS5                                     | Hello Goodbye       | CC0 1.0                      | 2026-10-17 | https://cdn.stocksnap.io/img-thumbs/960w/UXO5P8KFS5.jpg                                                                                                                  |
| mnu-0011 | Espresso Macchiato           | `espresso-macchiato.webp`        | https://www.flickr.com/photos/137643065@N06/23699535423                                     | pixellaphoto        | CC0 1.0                      | 2026-10-17 | https://live.staticflickr.com/1569/23699535423_5b31034a02_b.jpg                                                                                                          |
| mnu-0012 | İspanyol Latte               | `spanish-latte.webp`             | https://www.rawpixel.com/image/3303533/free-photo-image-coffee-beverage-brown-background    | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azYxNzEzMjI5LXdpa2ltZWRpYS1pbWFnZS1rb3dxengxcC5qcGc.jpg      |
| mnu-0013 | Cortado                      | `cortado.webp`                   | https://wordpress.org/photos/photo/9196a1515b/                                              | Manjil Aryal        | CC0 1.0                      | 2026-10-17 | https://pd.w.org/2026/05/9196a1515bfebfce0.16586595-1536x2048.jpeg                                                                                                       |
| mnu-0014 | Beyaz Çikolatalı Mocha       | `white-chocolate-mocha.webp`     | https://www.rawpixel.com/image/5916196/image-public-domain-art-coffee                       | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL25zMTM4OTAtaW1hZ2Uta3d2d29qb3kuanBn.jpg                                     |
| mnu-0015 | Karamel Latte                | `caramel-latte.webp`             | https://www.flickr.com/photos/37996646802@N01/26488792749                                   | cogdogblog          | CC0 1.0                      | 2026-10-17 | https://live.staticflickr.com/4470/26488792749_1e52bc5ded_b.jpg                                                                                                          |
| mnu-0016 | Tuzlu Karamel Latte          | `salted-caramel-latte.webp`      | https://www.rawpixel.com/image/5927674/photo-image-public-domain-glass-coffee               | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZnJlZXJhbmdlcGV4ZWxzMDIxOTQtaW1hZ2Uta3d2eWlwZnAuanBn.jpg         |
| mnu-0017 | Toffeenut Latte              | `toffee-nut-latte.webp`          | https://www.rawpixel.com/image/5919178/image-public-domain-coffee-free                      | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL2ZmNDAxOS1pbWFnZS1rd3Z4NGdjdC5qcGc.jpg                                      |
| mnu-0018 | Balkabağı Latte              | `pumpkin-latte.webp`             | https://www.rawpixel.com/image/3303445/free-photo-image-beverage-break-breakfast            | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA0L3Vwd2s2MTcxNDQwNS13aWtpbWVkaWEtaW1hZ2Uta293cXhleWwuanBn.jpg                         |
| mnu-0019 | Türk Kahvesi                 | `turkish-coffee.webp`            | https://stocksnap.io/photo/coffee-cup-3F1F16DEA8                                            | Travel Coffee Book  | CC0 1.0                      | 2026-10-17 | https://cdn.stocksnap.io/img-thumbs/960w/3F1F16DEA8.jpg                                                                                                                  |
| mnu-0020 | Filtre Kahve                 | `filter-coffee.webp`             | https://www.rawpixel.com/image/6042664/photo-image-public-domain-coffee-water               | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmw0Njg2OTI2MDI0NS1pbWFnZS1reWJlaHZsOS5qcGc.jpg                  |
| mnu-0021 | Buzlu Chai                   | `iced-chai.webp`                 | https://commons.wikimedia.org/w/index.php?curid=163369434                                   | Andy Li             | CC0 1.0                      | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/9/9a/Iced_mocha_-_Cafe_Rust_2025-03-31.jpg                                                                                |
| mnu-0022 | Buzlu Americano              | `iced-americano.webp`            | https://www.flickr.com/photos/35034347371@N01/18692822772                                   | roland              | CC0 1.0                      | 2026-10-17 | https://live.staticflickr.com/328/18692822772_d6d46ed350_b.jpg                                                                                                           |
| mnu-0023 | Buzlu Caffè Latte            | `iced-caffe-latte.webp`          | https://wordpress.org/photos/photo/843696866c/                                              | Manjil Aryal        | CC0 1.0                      | 2026-10-17 | https://pd.w.org/2026/01/843696866ce2eafa2.08782363-1536x2048.jpeg                                                                                                       |
| mnu-0024 | Buzlu Caffè Mocha            | `iced-mocha.webp`                | https://commons.wikimedia.org/w/index.php?curid=176047218                                   | Andy Li             | CC0 1.0                      | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/e/e3/Iced_Mocha_-_Caf%C3%A9_des_Couleurs_2025-10-02.jpg                                                                   |
| mnu-0025 | Buzlu Beyaz Çikolatalı Mocha | `iced-white-mocha.webp`          | https://wordpress.org/photos/photo/1696a187d8/                                              | Bijay Karki         | CC0 1.0                      | 2026-10-17 | https://pd.w.org/2026/05/1696a187d8622f477.79668746-1536x2048.jpg                                                                                                        |
| mnu-0026 | Buzlu Tuzlu Karamel Latte    | `iced-salted-caramel-latte.webp` | https://commons.wikimedia.org/w/index.php?curid=173936935                                   | Andy Li             | CC0 1.0                      | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/d/d4/Iced_mocha_-_ease_2025-08-29.jpg                                                                                     |
| mnu-0027 | Buzlu Toffeenut Latte        | `iced-toffee-nut-latte.webp`     | https://www.rawpixel.com/image/5943783/free-public-domain-cc0-photo                         | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHg4NDg4ODUtaW1hZ2Uta3d5b2RnNzQuanBn.jpg                         |
| mnu-0028 | Buzlu Balkabağı Latte        | `iced-pumpkin-latte.webp`        | https://commons.wikimedia.org/w/index.php?curid=151712200                                   | Andy Li             | CC0 1.0 (kullanılmaz)        | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/b/ba/Iced_Mocha_-_Granny%27s_Caf%C3%A9_2024-08-21.jpg                                                                     |
| mnu-0029 | Buzlu İspanyol Latte         | `iced-spanish-latte.webp`        | https://wordpress.org/photos/photo/847631584e/                                              | Enaan Farhan        | CC0 1.0                      | 2026-10-17 | https://pd.w.org/2022/09/847631584e924bcb5.15126133-1536x2048.jpeg                                                                                                       |
| mnu-0030 | Cold Brew                    | `cold-brew.webp`                 | https://commons.wikimedia.org/w/index.php?curid=70273087                                    | Roland Tanglao      | CC0 1.0                      | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/4/4b/Iced_cold_brew_coffee.jpg                                                                                            |
| mnu-0031 | Çıtır Latte                  | `crunchy-latte.webp`             | https://wordpress.org/photos/photo/38678603fa/                                              | Pritam Sonone       | CC0 1.0                      | 2026-10-17 | https://pd.w.org/2025/01/38678603fa8561a1.75647156-1536x2048.jpg                                                                                                         |
| mnu-0032 | Sürpriz İçecek               | `surprise-drink.webp`            | https://www.flickr.com/photos/157635012@N07/43108065435                                     | Artem Beliaikin     | CC0 1.0                      | 2026-10-17 | https://live.staticflickr.com/938/43108065435_92f27fdf66_b.jpg                                                                                                           |
| mnu-0033 | Cool Lime                    | `cool-lime.webp`                 | https://www.flickr.com/photos/29507259@N02/3605879317                                       | D Coetzee           | CC0 1.0                      | 2026-10-17 | https://live.staticflickr.com/2421/3605879317_51fc2f6010_b.jpg                                                                                                           |
| mnu-0034 | L'Af Limon                   | `lemonade.webp`                  | https://www.flickr.com/photos/157635012@N07/44997490262                                     | Artem Beliaikin     | CC0 1.0                      | 2026-10-17 | https://live.staticflickr.com/1908/44997490262_d27d625368_b.jpg                                                                                                          |
| mnu-0035 | Soda                         | `soda.webp`                      | https://www.rawpixel.com/image/5902681/photo-image-public-domain-plant-lemon                | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvc2s4MDQ4LWltYWdlLWt3dnVreG9tLmpwZw.jpg                           |
| mnu-0036 | Su                           | `water.webp`                     | https://commons.wikimedia.org/w/index.php?curid=105399729                                   | Kurt Kaiser         | CC0 1.0                      | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/0/01/Glass_of_water_ouside.jpg                                                                                            |
| mnu-0037 | Chai Latte                   | `chai-latte.webp`                | https://commons.wikimedia.org/w/index.php?curid=171231799                                   | Andy Li             | CC0 1.0                      | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/9/92/Homemade_Chai_Latte_with_Almond_milk_-_Moksha_2025-08-01.jpg                                                         |
| mnu-0038 | Sıcak Çikolata               | `hot-chocolate.webp`             | https://commons.wikimedia.org/w/index.php?curid=150181652                                   | Mx. Granger         | CC0 1.0                      | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/a/a0/Hot_chocolate_from_ChocoVivo.jpg                                                                                     |
| mnu-0039 | Beyaz Sıcak Çikolata         | `white-hot-chocolate.webp`       | https://www.rawpixel.com/image/3283047/free-photo-image-chocolate-coffee-cream              | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvdXB3azU4ODU5NzAzLXdpa2ltZWRpYS1pbWFnZS1rb3diNXpody5qcGc.jpg      |
| mnu-0040 | Karamelli Sıcak Çikolata     | `caramel-hot-chocolate.webp`     | https://commons.wikimedia.org/w/index.php?curid=141601684                                   | Derk29              | CC0 1.0                      | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/d/d3/Hot_Chocolate_drinks.jpg                                                                                             |
| mnu-0042 | Çay                          | `turkish-tea.webp`               | https://wordpress.org/photos/photo/8636890a5e/                                              | Rubel Miah          | CC0 1.0                      | 2026-10-17 | https://pd.w.org/2025/08/8636890a5e8c36c54.45906496-1347x2048.jpg                                                                                                        |
| mnu-0043 | Frappe                       | `frappe.webp`                    | https://commons.wikimedia.org/w/index.php?curid=151464153                                   | Andy Li             | CC0 1.0                      | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/1/10/Vanilla_Frappe_-_Blossom_Cafe_Bar_2024-08-13.jpg                                                                     |
| mnu-0044 | Espresso Frappe              | `espresso-frappe.webp`           | https://www.flickr.com/photos/37996646802@N01/1757655381                                    | cogdogblog          | CC0 1.0                      | 2026-10-17 | https://live.staticflickr.com/2411/1757655381_88c9fb0ae9_b.jpg                                                                                                           |
| mnu-0045 | Mocha Frappe                 | `mocha-frappe.webp`              | https://wordpress.org/photos/photo/6346a2a555/                                              | Tilak Bahadur Karki | CC0 1.0                      | 2026-10-17 | https://pd.w.org/2026/06/6346a2a555ebc0689.18871053-1507x2048.jpg                                                                                                        |
| mnu-0046 | Karamel Frappe               | `caramel-frappe.webp`            | https://wordpress.org/photos/photo/72369d507b/                                              | Uttkrista Chhetri   | CC0 1.0                      | 2026-10-17 | https://pd.w.org/2026/04/72369d507b8cd22a8.95783688-1536x2048.jpeg                                                                                                       |
| mnu-0047 | Yaban Mersini                | `blueberry-smoothie.webp`        | https://www.rawpixel.com/image/5970521/blueberry-smoothie                                   | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvaXMxMDQyOC1pbWFnZS1rd3lzaGRlay5qcGc.jpg                          |
| mnu-0048 | Mango                        | `mango-smoothie.webp`            | https://www.flickr.com/photos/150121377@N03/37763617962                                     | anasegota           | CC0 1.0                      | 2026-10-17 | https://live.staticflickr.com/4471/37763617962_d23c631e19_b.jpg                                                                                                          |
| mnu-0049 | Elma                         | `apple-smoothie.webp`            | https://www.flickr.com/photos/150121377@N03/33508210293                                     | anasegota           | CC0 1.0                      | 2026-10-17 | https://live.staticflickr.com/2839/33508210293_9d1feba773_b.jpg                                                                                                          |
| mnu-0050 | Protein Shake                | `protein-shake.webp`             | https://www.rawpixel.com/image/5970856/banana-smoothie                                      | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvaXMxMTA0NS1pbWFnZS1rd3lzaTYwZC5qcGc.jpg                          |
| mnu-0051 | Çilek                        | `strawberry-frozen.webp`         | https://stocksnap.io/photo/masonjars-jar-GHVUNMPQ3Q                                         | Anastasia Zhenina   | CC0 1.0                      | 2026-10-17 | https://cdn.stocksnap.io/img-thumbs/960w/GHVUNMPQ3Q.jpg                                                                                                                  |
| mnu-0052 | Frambuaz                     | `raspberry-frozen.webp`          | https://stocksnap.io/photo/jar-mug-QRDORARYQV                                               | Anastasia Zhenina   | CC0 1.0                      | 2026-10-17 | https://cdn.stocksnap.io/img-thumbs/960w/QRDORARYQV.jpg                                                                                                                  |
| mnu-0055 | Limonlu Soğuk Çay            | `lemon-iced-tea.webp`            | https://www.flickr.com/photos/38521643@N08/29565815426                                      | Liza Valero         | PDM 1.0 (Public Domain Mark) | 2026-10-17 | https://live.staticflickr.com/8473/29565815426_3220562722_b.jpg                                                                                                          |
| mnu-0056 | Şeftalili Soğuk Çay          | `peach-iced-tea.webp`            | https://stocksnap.io/photo/drinks-tea-OR2IWR4B3S                                            | Sajjad Ghanavati    | CC0 1.0 (kullanılmaz)        | 2026-10-17 | https://cdn.stocksnap.io/img-thumbs/960w/OR2IWR4B3S.jpg                                                                                                                  |
| mnu-0057 | Donostia (L'Af Özel)         | `donostia-cheesecake.webp`       | https://wordpress.org/photos/photo/1846a3cebb/                                              | sujal2003           | CC0 1.0                      | 2026-10-17 | https://pd.w.org/2026/06/1846a3cebb16ce1b1.55257259-2048x2041.jpg                                                                                                        |
| mnu-0058 | San Sebastian                | `san-sebastian-cheesecake.webp`  | https://www.rawpixel.com/image/5917566/image-public-domain-food-free                        | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvaXMxMDc5Mi1pbWFnZS1rd3Z3dmZ0eS5qcGc.jpg                          |
| mnu-0059 | Yaban Mersinli San Sebastian | `blueberry-san-sebastian.webp`   | https://wordpress.org/photos/photo/2726a12c54/                                              | Alina Kakshapati    | CC0 1.0 (kullanılmaz)        | 2026-10-17 | https://pd.w.org/2026/05/2726a12c54ed9c3c5.70069418-2048x1536.jpg                                                                                                        |
| mnu-0060 | L'Af Mango                   | `mango-cake.webp`                | https://wordpress.org/photos/photo/375653a94f/                                              | Shilpa Manoj        | CC0 1.0                      | 2026-10-17 | https://pd.w.org/2023/10/375653a94fe987d28.54130884-2048x922.jpg                                                                                                         |
| mnu-0061 | L'Af Kahve                   | `coffee-cake.webp`               | https://commons.wikimedia.org/w/index.php?curid=185680508                                   | Andy Li             | CC0 1.0 (kullanılmaz)        | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/3/33/A_slice_of_coffee_and_walnut_cake_-_Audit_Room_Caf%C3%A9%2C_Petworth_House.jpg                                       |
| mnu-0062 | L'Af Antep Fıstığı           | `pistachio-cake.webp`            | https://commons.wikimedia.org/w/index.php?curid=156988958                                   | Fumikas Sagisavas   | CC0 1.0                      | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/5/51/Double_crumble_pistachio_cake_%28close-up%29.jpg                                                                     |
| mnu-0063 | Çilek Magnolia               | `strawberry-magnolia.webp`       | https://stocksnap.io/photo/yogurt-parfait-L6ATDVSEMJ                                        | Tim Sullivan        | CC0 1.0 (kullanılmaz)        | 2026-10-17 | https://cdn.stocksnap.io/img-thumbs/960w/L6ATDVSEMJ.jpg                                                                                                                  |
| mnu-0064 | Muz Magnolia                 | `banana-magnolia.webp`           | https://commons.wikimedia.org/w/index.php?curid=102658496                                   | Alabama Extension   | CC0 1.0                      | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/5/5a/Classic_Banana_Pudding.jpg                                                                                           |
| mnu-0065 | Lotus Magnolia               | `lotus-magnolia.webp`            | https://commons.wikimedia.org/w/index.php?curid=138067834                                   | Andy Li             | CC0 1.0                      | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/7/7c/Biscoff_Mousse_-_The_Roundhill_Pub_2023-09-24.jpg                                                                    |
| mnu-0066 | Marlenka                     | `marlenka-honey-cake.webp`       | https://www.rawpixel.com/image/5928292/photo-image-public-domain-food-free                  | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmYxNzg0LWltYWdlLWt3dnltNDJiLmpwZw.jpg                           |
| mnu-0067 | Klasik Spoonful              | `classic-spoonful.webp`          | https://stocksnap.io/photo/parfait-yogurt-EE782F841E                                        | Daria Nepriakhina   | CC0 1.0 (kullanılmaz)        | 2026-10-17 | https://cdn.stocksnap.io/img-thumbs/960w/EE782F841E.jpg                                                                                                                  |
| mnu-0068 | Frambuazlı Cheesecake        | `raspberry-cheesecake.webp`      | https://www.rawpixel.com/image/5924639/photo-image-public-domain-illustration-fruit         | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvcHgxMjgzNDAyLWltYWdlLWt3dnkxOGo0LmpwZw.jpg                       |
| mnu-0069 | Limonlu Cheesecake           | `lemon-cheesecake.webp`          | https://www.rawpixel.com/image/5969178/lemon-cheesecake                                     | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvaXMxODExNy1pbWFnZS1rd3lzOWVxby5qcGc.jpg                          |
| mnu-0070 | Brownie                      | `brownie.webp`                   | https://www.rawpixel.com/image/3338459/free-photo-image-chocolate-cake-animal               | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvd2s2NDQ4MDYxMy1pbWFnZS1rcDZjb2I1Ny5qcGc.jpg                      |
| mnu-0071 | Cookie Aşkı (Dondurmalı)     | `cookie-ice-cream.webp`          | https://commons.wikimedia.org/w/index.php?curid=174028478                                   | RandomKatze         | CC0 1.0                      | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/9/9d/Salted_caramel_cookie_skillet_from_Outback_Steakhouse.jpg                                                            |
| mnu-0072 | Tiramisu                     | `tiramisu.webp`                  | https://wordpress.org/photos/photo/27569f2114/                                              | Uttkrista Chhetri   | CC0 1.0                      | 2026-10-17 | https://pd.w.org/2026/04/27569f2114503a8b2.88800969-1924x2048.jpeg                                                                                                       |
| mnu-0073 | Karabuğday Simit             | `simit.webp`                     | https://commons.wikimedia.org/w/index.php?curid=157208484                                   | Tianadara           | CC0 1.0 (kullanılmaz)        | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/e/ef/Simit%2C_salah_satu_roti_khas_Turki.jpg                                                                              |
| mnu-0074 | Rosbeef Sandviç              | `roast-beef-sandwich.webp`       | https://commons.wikimedia.org/w/index.php?curid=94572842                                    | Daderot             | CC0 1.0 (kullanılmaz)        | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/d/d5/Roast_beef%2C_blue_cheese%2C_and_onion_sandwich_-_Massachusetts.jpg                                                  |
| mnu-0075 | Hindi Fümeli Sandviç         | `smoked-turkey-sandwich.webp`    | https://www.flickr.com/photos/132795455@N08/18691945541                                     | Image Catalog       | CC0 1.0                      | 2026-10-17 | https://live.staticflickr.com/366/18691945541_99a97fd333_b.jpg                                                                                                           |
| mnu-0076 | Çıtır Granola Bar (Kenya)    | `granola-bar.webp`               | https://commons.wikimedia.org/w/index.php?curid=151811897                                   | LironOmri12         | CC0 1.0                      | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/9/97/Granola_bars.jpg                                                                                                     |
| mnu-0077 | Hindistan Cevizli Bar        | `coconut-bar.webp`               | https://commons.wikimedia.org/w/index.php?curid=128465727                                   | Thomson200          | CC0 1.0                      | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/c/ce/Unreal_Coconut_Bars_Feb_2023.jpg                                                                                     |
| mnu-0078 | Kakao Protein Bar            | `cocoa-protein-bar.webp`         | https://commons.wikimedia.org/w/index.php?curid=50486883                                    | Mx. Granger         | CC0 1.0 (kullanılmaz)        | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/c/c3/Three_protein_bars%2C_two_cut_in_half.jpg                                                                            |
| mnu-0079 | Koska Fındık                 | `hazelnuts.webp`                 | https://stocksnap.io/photo/hazelnuts-food-Z7DH3GTP8X                                        | Lukasz Dec          | CC0 1.0                      | 2026-10-17 | https://cdn.stocksnap.io/img-thumbs/960w/Z7DH3GTP8X.jpg                                                                                                                  |
| mnu-0081 | Ekstra Shot                  | `extra-shot.webp`                | https://www.rawpixel.com/image/5928059/photo-image-public-domain-coffee-free                | rawpixel (ad yok)   | CC0 1.0                      | 2026-10-17 | https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmY0MjAwLWltYWdlLWt3dnlsNWtzLmpwZw.jpg                           |
| mnu-0082 | Alternatif Süt               | `alternative-milk.webp`          | https://commons.wikimedia.org/w/index.php?curid=92369340                                    | Mx. Granger         | CC0 1.0 (kullanılmaz)        | 2026-10-17 | https://upload.wikimedia.org/wikipedia/commons/8/86/Hemp_milk_with_hemp_seeds_2.jpg                                                                                      |
