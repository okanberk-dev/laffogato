# LafPOS ↔ site: kafenin kasası

LafPOS (`RiosenBeq/lafpos`) kafenin içinde çalışan yerel kasa sunucusudur.
Menüyü siteden alır, ürünü kasada Tükendi / Satışta yapar, uygulamadan ve
web'den gelen online siparişleri (masa, gel-al, kurye) bar ekranında ve masa
planında gösterir, aşamasını geri yazar; karaoke odasının sitedeki
rezervasyonlarını okur; masa kartlarını kendisi basar ve kodlarını siteye
bildirir (aşağıda "Masa kodları"). Bunun için köşkün panelinin imzalı uçlarını kullanır
(`docs/PANEL-MENU.md`, `docs/PANEL-ORDERS.md`, `docs/PANEL-KARAOKE.md`), ama
**kendi anahtarıyla**: operatör panelin anahtarının (`KARAOKE_SYNC_SECRET`)
kafedeki makinede durmasını istemedi. İki anahtar ayrı ayrı döndürülür.
Sözleşmenin LafPOS tarafı: lafpos `docs/03-ENTEGRASYON.md` §2.3.

## İş bölümü (26 Ekim 2026)

LafPOS ile site **tek sistem, iki yüz** düzeninde çalışır (karar ve gerekçe: lafpos `docs/06-TEK-SISTEM.md`;
ModPOS, NarPOS, Toast, Square ve Lightspeed'deki düzen):

- **Ürünlerin tek kaynağı bu panel.** Ad, fiyat, boy, KDV ve fotoğraf burada değişir; site, uygulama ve kasa
  aynı menüyü okur. LafPOS'ta Yönetim › Ürünler'deki "Sitede ürün ekle" bu panelin `/admin/menu/yeni`
  sayfasını açar; LafPOS menüyü kendisi çeker ve değişikliği uygulamadan önce gösterir.
- **Kasaya özgü alanlar LafPOS'ta** (istasyon, kısa ad, porsiyon, seçenek grubu); site bunları bilmez.
- **Yalnız kafede satılan hizmetler** (karaoke odasının saatlik ücreti, etkinlik ücreti) LafPOS'ta yerel ürün;
  buraya girmez.
- **Karaoke rezervasyonu sitede alınır** (`/karaoke` ve uygulama; ön ödemesi de sitede). LafPOS onu
  `GET /api/panel/karaoke`'tan okur: oda sitede rezerveyken kasada boş görünmesin, sitede ödenmiş saat kasada
  yeniden ücretlenmesin (sitede ödenen rezervasyon online karaoke cirosudur, `docs/PANEL-SALES.md`). Rezervasyonu
  LafPOS yazmaz, değiştirmez, iptal etmez; bunlar bu panelde kalır.
- **Tükendi** kasadan ya da bar ekranından işaretlenince `POST /api/panel/menu` ile burada da tükenir
  (LafPOS'ta `urun.tukendi` yetkisi; kasiyer ve bar rolünde varsayılan açık).
- Şema değişmedi. Bu değişiklik yalnız LafPOS'un ayrı imza anahtarını (`LAFPOS_SYNC_SECRET`) ve sipariş
  sürüm sinyalini ekler; anahtar Vercel'e girilene dek LafPOS'un imzalı çağrıları reddedilir, site etkilenmez.
  Karaoke okuması ve sürüm yanıtındaki `karaoke` işareti (26 Ekim 2026) de aynı anahtarla açılır; şema yine
  değişmedi.

## Varsayılan kapalı

Sahip, 26 Ekim 2026: _"lafposu tüm hepsinde aktif edince kullanmaya başlayayım, hemen aktif olmasın ki şu anki
sistem bozulmasın"_. Sitede bunun anlamı `LAFPOS_SYNC_SECRET`'ın yokluğudur: anahtar girilene dek LafPOS'un her
imzalı isteği reddedilir (sürüm ucu 503, panel uçları 401; panelin anahtarı da yoksa 503), site, uygulama ve
panel bugünkü gibi çalışır. Kod yayına girince hiçbir şey açılmaz; açan yalnız anahtardır.

Açılış sırası (anahtarlar → deneme gönderimi → lafmaliyet'te LafPOS'a geçiş günü) tek liste olarak lafmaliyet
`docs/LAFPOS.md` ve lafpos `docs/03-ENTEGRASYON.md` › "Açılış sırası" içinde durur. Sitenin anahtarı o listenin 1.
adımına (anahtarlar) aittir, lafmaliyet'in anahtarıyla aynı oturumda ama ondan ayrı girilir. Sitenin payı:

1. Yeni bir değer üretin: `openssl rand -base64 48`. Panelin `KARAOKE_SYNC_SECRET`'ından da lafmaliyet'in
   `LAFPOS_SYNC_SECRET`'ından da farklı olsun (aşağıda "Anahtar").
2. laffogato'nun Vercel projesinde Production'a `LAFPOS_SYNC_SECRET` adıyla "Sensitive" olarak ekleyin ve siteyi
   yeniden yayımlayın: değişken yalnız yeni yayında okunur.
3. LafPOS'un `.env`'ine `LAFFOGATO_URL=https://laffogato.net` ve aynı değerle `LAFFOGATO_SYNC_SECRET` yazın, LafPOS
   sunucusunu yeniden başlatın.
4. Denetleyin: aşağıdaki "Elle denemek", `SECRET`'ı LafPOS'un `.env`'indeki `LAFFOGATO_SYNC_SECRET`'tan kopyalayarak
   (böylece iki taraf birlikte sınanır), 200 ve `{"version":"…","karaoke":"…"}` döner. 503 `not_configured`: sitede
   anahtar yok, 32 karakterden kısa, panelinkiyle aynı ya da site yeniden yayımlanmadı. 401: iki taraftaki değer
   farklı ya da saat 5 dakikadan fazla kaymış.

Listenin deneme gönderimi yalnız lafmaliyet'e gidişi sınar; sitenin bağlantısını 4. madde sınar. Bu adım atlanırsa
geçiş gününden sonra sitede ödenmiş karaoke saati LafPOS'un oda kutusunda boş görünür ve kasada yeniden ücretlenir,
uygulama ve web siparişleri bar ekranına düşmez, kasada işaretlenen Tükendi siteye ulaşmaz.

## Şube (21 Kasım 2026)

İlk LafPOS kasası Marina'dadır (lafmaliyet `docs/SUBE.md`: `LAFPOS_BRANCH_ID = "marina"`; Tuzla ModPOS'ta
kalır). Site o güne dek şube bilmiyordu: LafPOS'un anahtarı da panelinki gibi bütün açık siparişleri, masa
çağrılarını ve karaoke rezervasyonlarını alıyordu ve "Satışta / Tükendi" kalem başına tekti. Marina'nın kasasına
anahtar girildiği an Tuzla'da masadan verilip sitede ödenmiş sipariş Marina'nın bar ekranında çalar, Marina'da
basılan "Hazırlanıyor" / "Gördüm" Tuzla'nın kaydını sitede ilerletip kapatır, Tuzla'nın Tükendi'si Marina'nın
kasasında ürünü kilitler, Marina'nın porsiyonu biten ürünü Tuzla'nın uygulamasından kalkardı. Artık:

- **Şubeler.** Kimlik lafmaliyet'in kuralı (harfle başlar, küçük harf / rakam / tire, 2-24). Site `tuzla` ve
  `marina`'yı bilir (`SITE_BRANCHES`, virgüllü; eklemek için yayın gerekmez). Şubesiz her şey (bu değişiklikten
  önce yazılanlar; gel-al, kurye, kargo; karaoke) **Tuzla**'nındır: uygulama ve web Tuzla köşküne hizmet eder.
- **Hangi anahtar hangi şube.** Panelin anahtarı her şube adına konuşabilir, söylemezse Tuzla (bugünkü panel
  aynen çalışır). LafPOS'un anahtarı `LAFPOS_BRANCHES`'teki şubeler adına (sitede Vercel değişkeni, virgüllü;
  varsayılan `marina`, ilki varsayılandır). Her LafPOS kurulumu aynı anahtarı paylaştığı için Tuzla da LafPOS'a
  geçince değişken `marina,tuzla` olur ve Tuzla'nın kasası her istekte `branch: "tuzla"` söyler.
- **İstek şubesini nasıl söyler.** GET'te sorguda `branch=<id>`, POST / PUT'ta gövdede `"branch": "<id>"`. İkisi de
  imzanın içindedir. Söylemeyen istek çağıranın varsayılanıdır: bugünkü LafPOS hiçbir şey değiştirmeden Marina
  adına okur ve yazar. Bozuk ya da bilinmeyen şube 400 `{"error":"invalid","field":"branch"}`; anahtarın
  konuşamadığı şube 403 `{"error":"forbidden","field":"branch"}`; ikisinde de hiçbir şey okunmaz, yazılmaz.
- **Siparişler ve çağrılar** (`GET /api/panel/orders`): yalnız o şubenin `orders`, `awaitingPayment` ve `calls`'ı;
  yanıtta `branch`. Masa siparişi ve çağrısı masanın şubesidir (`cafe_tables.branch`, anlık görüntü). Bugün
  Marina'nın masası sitede yoksa Marina'nın listesi boştur: Tuzla'nın siparişi Marina'ya düşmez.
- **Aşama ve "Gördüm"** (`POST /api/panel/orders/stage`, `POST /api/panel/calls/ack`): gövdede isteğe bağlı
  `branch`; başka şubenin kaydı 409 `{"error":"wrong_branch"}`, hiçbir şey yazılmaz. LafPOS kartı düşürmelidir
  (yeniden denemez).
- **Karaoke** (`GET /api/panel/karaoke`): oda tek ve Tuzla'dadır. Başka şube adına okuma veritabanına gitmeden
  `{"branch":"marina","complete":true,"reservations":[]}` döner; Marina'nın kasası Tuzla'nın rezervasyonlarını
  okuyup çalmaz. LafPOS'un dünden yarına penceresi yine geçerlidir (önce o denetlenir).
- **Masa kodları** (`PUT /api/panel/tables`): liste bir şubenindir (gövdede `branch`, yoksa LafPOS'un varsayılanı).
  Yeni masa o şubeye yazılır; sitede başka şubede duran bir kod listeyi bütünüyle reddettirir: 409
  `{"error":"wrong_branch","field":"tables[i].code"}`, hiçbir şey yazılmaz (LafPOS listeyi park eder). Yanlış
  şubeye düşmüş masa sitenin panelinde düzeltilir: Masalar › masa › Düzenle › Şube. 200 yanıtı `branch`'i söyler.
- **Satışta / Tükendi** (`GET` / `POST /api/panel/menu`): şubeye göre (`docs/PANEL-MENU.md` "Şube"). Okumada
  `isActive` o şubede satılıyor mu, `onMenu` sitenin "Menüde" bayrağı (her şube), `updatedAt` kalemin ve şubenin
  damgasından geç olanı; `writes: {"expect": true, "branch": true}`. LafPOS'un `isActive` yazımı yalnız kendi
  şubesinin satırını yazar: Tuzla'nın Tükendi'si Marina'yı kapatmaz, Marina'nınki Tuzla'nın uygulama ve QR
  menüsünü kapatmaz. Menüden kalkmış (`onMenu: false`) kalemi açmak 409 `{"error":"site_closed","item":{…}}`,
  hiçbir şey yazılmaz. LafPOS'un `soldOutBy='site'` kilidi yalnız `onMenu: false` için anlamlıdır; kendi şubesinin
  Tükendi'si kendisinindir. Fiyat hâlâ her şube için tektir ve LafPOS yazamaz.
- **Menünün kendisi** (`GET /api/mobile/v1/menu`, herkese açık): uygulamanındır, Tuzla'nın Satışta'sını gösterir
  (Tuzla'da tükenen kalem yanıtta yoktur). LafPOS Satışta'yı imzalı okumadan alır (`shouldBeActive`: herkese açık
  listede olmayan ama panelde açık kalem kapanmaz), yani Marina'nın Satışta'sı doğru kalır. Tek eksik: Tuzla'da
  tükenmişken **ilk kez** eklenen bir kalem, Tuzla'da açılana dek LafPOS'ta oluşmaz.
- **Satış ucu** (`GET /api/panel/sales`, yalnız panel): `&branch=` ve `byBranch` (`docs/PANEL-SALES.md`).
- **Sürüm sinyali** (`GET /api/pos/orders/version`) şubesizdir: Tuzla'nın siparişi de onu oynatır, LafPOS çeker ve
  boş liste alır. Veritabanına dokunmaz; fazladan çekme bütçe kuralının (5 dakika) içindedir.

Kural `src/lib/panel/branches.ts`; testleri `tests/sube/` (`npm run test:sube`). LafPOS'un kendi tarafındaki
şube bekçisi (sitenin şubesi değilse online siparişi ve karaokeyi hiç çekmemek) sitenin bu değişikliğinden
bağımsız ikinci bir emniyettir: lafpos `docs/03-ENTEGRASYON.md` §2.3.

## Anahtar

| Değişken                | Nerede        | Açıklama                                                                                            |
| ----------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| `LAFPOS_SYNC_SECRET`    | site (Vercel) | LafPOS'un anahtarı, en az 32 karakter; daha kısası tanımsız sayılır. Yoksa LafPOS kapalı (aşağıda). |
| `LAFFOGATO_SYNC_SECRET` | LafPOS `.env` | Sitedekiyle **aynı** değer.                                                                         |
| `LAFPOS_BRANCHES`       | site (Vercel) | LafPOS'un anahtarının konuştuğu şubeler, virgüllü; yoksa `marina`. İlki varsayılan (yukarıda "Şube"). |
| `SITE_BRANCHES`         | site (Vercel) | Sitenin bildiği şubeler, virgüllü; yoksa `tuzla,marina` (Tuzla her zaman listede).                   |

- Panelin anahtarından **farklı** olmalı. İkisine aynı değer verilirse site
  isteği panelinki sayar (olay kaydına `panel:` düşer) ve anahtarları ayırmanın
  anlamı kalmaz.
- **Aynı ad, iki ayrı değer.** lafmaliyet'in (ladmin.laffogato.net) Vercel
  projesinde de `LAFPOS_SYNC_SECRET` adında bir değişken vardır: LafPOS'un gün
  sonunu (`POST /api/pos/gun`) ve maliyet okumasını imzalar; LafPOS `.env`'deki
  karşılığı `LAFMALIYET_SYNC_SECRET`'tır. Sitedeki `LAFPOS_SYNC_SECRET` ile
  lafmaliyet'teki **farklı değerlerdir**: biri sızınca öbürü açık kalmaz, ikisi
  ayrı döndürülür. lafpos `scripts/vercel/baglanti-kur.sh` ikisini ayrı üretir;
  elle girerken birini öbürüne kopyalamayın.
- Üretmek için `openssl rand -base64 48`. Vercel'de Production'a "Sensitive"
  olarak eklenir, site yeniden yayımlanır. Yalnız sunucuda durur, asla
  `NEXT_PUBLIC_*` olmaz.
- İmza panelinkinin aynısıdır (`x-laf-timestamp`, `x-laf-signature: v1=<hex>`;
  imzalanan metin zaman damgası, yöntem, yol, sıralı sorgu ve gövdenin
  SHA-256'sı; saat farkı en çok 5 dakika; karşılaştırma sabit süreli).
  Kurallar `src/lib/panel/karaoke-sync-core.ts`'te, anlatımı
  `docs/PANEL-KARAOKE.md` "Güvenlik"te. İsteği hangi anahtarın imzaladığını
  site iki anahtarı da deneyerek bulur (`src/lib/panel/signed-callers.ts`):
  her istekte ikisi de denenir, yanıtın süresi hangisinin tuttuğunu söylemez.

## Hangi uçlar

| Uç                             | Panelin anahtarı | LafPOS'un anahtarı | LafPOS ne için kullanır                                                                                                                                                                         |
| ------------------------------ | ---------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/panel/menu`          | açar             | açar               | Tükendi kalemleri de görmek (`isActive`, kendi şubesinin; `onMenu` sitenin bayrağı)                                                                                                             |
| `POST /api/panel/menu`         | açar             | açar               | Kasada Tükendi / Satışa aç: önce site, 2xx gelince kasa; yalnız kendi şubesinin satırı. LafPOS'un anahtarıyla yalnız `isActive`; `priceMinor` ya da `priceMinorL` 403 `forbidden` (çalınan kafe makinesi fiyat değiştiremesin); menüden kalkmış kalemi açmak 409 `site_closed` |
| `GET /api/panel/orders`        | açar             | açar               | Online siparişler: bar ekranı ve masa planı (yalnız kendi şubesinin)                                                                                                                            |
| `POST /api/panel/orders/stage` | açar             | açar               | Hazırlanıyor / Hazır / Teslim edildi                                                                                                                                                            |
| `POST /api/panel/calls/ack`    | açar             | açar               | Masadan garson çağrısına "Gördüm" (6 Kas 2026; çağrılar `GET /api/panel/orders`'ın `calls` alanında, `docs/PANEL-ORDERS.md` "Masa çağrıları"); olay kaydında `lafpos:<ad>`                       |
| `GET /api/pos/orders/version`  | açmaz (401)      | açar               | Sipariş ve karaoke sürüm sinyali (aşağıda)                                                                                                                                                      |
| `GET /api/panel/karaoke`       | açar             | açar               | Karaoke odası: sitedeki rezervasyonlar (saat, kişi, ad, not, ödeme durumu), `karaoke` değişince. LafPOS'un anahtarıyla yalnız dünden yarına (İstanbul); daha genişi 403 `forbidden`             |
| `GET /api/panel/sales`         | açar             | açmaz              | LafPOS'un işi değil                                                                                                                                                                             |
| `PUT /api/panel/tables`        | açmaz (401)      | açar               | Masa QR kodları: LafPOS'un bastığı kartların kodunu `cafe_tables`'a ekler ya da adını / etkinliğini günceller (aşağıda "Masa kodları")                                                          |

- Her uç bir şube adınadır (yukarıda "Şube"): LafPOS'un anahtarı varsayılan
  olarak Marina'nın siparişlerini, çağrılarını, masalarını ve Satışta'sını
  okur ve yazar; karaoke okuması Marina adına boştur.
- Panel uçlarının yanıt biçimi, `version`'ı, gövde sınırı, beyaz listesi ve
  hata kodları kim imzalarsa imzalasın aynıdır: `docs/PANEL-MENU.md`,
  `docs/PANEL-ORDERS.md`, `docs/PANEL-KARAOKE.md`. İki fark yalnız LafPOS'un
  anahtarındadır, ikisi de hiçbir şey okunmadan 403 `forbidden`: menüde fiyat
  yazımı, karaokede dünden yarına dışında kalan pencere (çalınan kafe makinesi
  fiyat değiştiremesin, geçmişin adlarını ve notlarını okuyamasın).
  `GET /api/panel/orders` masa siparişinde masanın kodunu da verir
  (`tableCode`, 28 Eki 2026; `docs/PANEL-ORDERS.md`): LafPOS siparişi masa
  planındaki masaya bastığı kodla eşler.
- Panel uçlarından biri, iki anahtardan en az biri tanımlıysa açıktır; ikisi
  de yoksa 503 `not_configured`. `LAFPOS_SYNC_SECRET` yoksa her şey bu
  değişiklikten önceki gibidir: uçlar yalnız panelin anahtarını tanır.
- **Olay kaydı.** LafPOS'un yazımları sitenin olay kaydına ve siparişin zaman
  çizelgesine `lafpos:<ad>` olarak düşer, ekranda "LafPOS · Selin" yazar
  (panelinki `panel:<ad>`, "Yönetim paneli · Selin"); kaydın `via` alanı da
  `lafpos`'tur. `actor` LafPOS kullanıcısının adıdır (1-80 karakter).
- Site LafPOS'a **ping atmaz**: kafedeki sunucu internetten erişilemez. Ping
  (`docs/PANEL-ORDERS.md` "Uçlar" 1) yalnız panele gider; LafPOS'un bir
  siparişi ilerletmesi de panele ping olarak ulaşır.

## Sipariş sürüm sinyali: `GET /api/pos/orders/version`

```
GET https://laffogato.net/api/pos/orders/version
x-laf-timestamp: <unix saniye>
x-laf-signature: v1=<hex>
```

```json
{ "version": "mh7x2k3a-1x9f0c2b7d4e5", "karaoke": "mh7x2k3a-3k8d1q0z9w2a" }
```

- Yalnız `LAFPOS_SYNC_SECRET` ile imzalı istek; panelin anahtarı 401 alır.
  Sorgu ve gövde yok.
- Değer bir **değişim işaretidir** (`src/lib/admin/change-marker.ts`,
  `readPosOrdersMarker`): Next'in veri önbelleğinde `live:orders` etiketiyle
  duran rastgele bir metin. Uç **veritabanına dokunmaz**: önbellekte yoksa yeni
  bir metin üretir. `live:orders`'ı düşüren her yazım (sipariş açıldı, ödendi,
  ilerledi, iade edildi; mağaza kolisi de; `src/lib/db/index.ts` yazım
  kancası) kaydı siler, sonraki soru yeni değeri alır.
- Değer veri taşımaz, biçimine güvenilmez; yalnız bir öncekiyle karşılaştırılır:
  aynıysa yeni bir şey yok, farklıysa siparişler değişti.
- `karaoke` (26 Ekim 2026) aynı türden ikinci bir işarettir
  (`readPosKaraokeMarker`), yalnız `live:karaoke` etiketiyle: karaoke
  rezervasyonu açılınca, ödenince, onaylanınca, saati değişince ya da iptal
  edilince (karaoke SQL fonksiyonları ve eski rezervasyonların gece temizliği
  de) değişir. Sipariş `karaoke`'yi, rezervasyon `version`'ı değiştirmez.
  LafPOS `karaoke` değişince `GET /api/panel/karaoke`'u çeker. Alan eklemedir:
  yalnız `version`'ı okuyan LafPOS etkilenmez. Bu da veritabanına dokunmaz.
- Panel hesaplarının yazımı (`live:access`) bu değerleri değiştirmez; panelin
  kendi işaretleri değişir, LafPOS'unkiler değil.
- Önbellek kapalıysa (`LAF_DATA_CACHE=off`) ya da okunamıyorsa her yanıtta iki
  değer de yenidir: LafPOS her soruda siparişleri (ve karaokeyi) çeker. Bozuk
  önbellek fazladan okumaya mal olur, kaçan siparişe değil.
- `Cache-Control: no-store`.

| Durum | Gövde                           | Ne zaman                                                      |
| ----- | ------------------------------- | ------------------------------------------------------------- |
| 200   | `{"version":"…","karaoke":"…"}` |                                                               |
| 401   | `{"error":"unauthorized"}`      | İmza yok, yanlış (panelin anahtarı da) ya da 5 dakikadan eski |
| 503   | `{"error":"not_configured"}`    | `LAFPOS_SYNC_SECRET` yok ya da 32 karakterden kısa            |

## Masa kodları: `PUT /api/panel/tables` (28 Ekim 2026)

LafPOS masa kartlarını kendisi basar (lafpos `docs/03-ENTEGRASYON.md` §2.3
"Masa QR'ı LafPOS üretir"): masa başına 10 simgelik Crockford kod, sitenin
kuralıyla aynı (`src/lib/admin/cafe-tables-core.ts`), QR içeriği yine
`https://laffogato.net/masa/<kod>`. Kodun sitede ve uygulamada masayı
bulması için (`/masa/[kod]`, `GET /api/mobile/v1/tables/{code}`, masaya
sipariş yolu) LafPOS kod üretince, yenileyince ve QR'lı masanın adı ya da
etkinliği değişince **tam listeyi** gönderir (giden kutusundan, tek kayıt,
son liste geçerli):

```
PUT https://laffogato.net/api/panel/tables
x-laf-timestamp: <unix saniye>
x-laf-signature: v1=<hex>
```

```json
{
  "tables": [
    { "code": "K7Q2M9X4TB", "name": "Bahçe 3", "active": true },
    { "code": "ABCDEFGH23", "name": "Eski kart", "active": false }
  ],
  "actor": "LafPOS",
  "branch": "marina"
}
```

`branch` isteğe bağlıdır (21 Kasım 2026; yoksa LafPOS'un varsayılan şubesi): liste o şubenin masalarıdır, yeni
masa o şubeye yazılır, sitede başka şubede duran kod 409 `wrong_branch` ile bütün listeyi reddettirir (yukarıda
"Şube").

- Yalnız `LAFPOS_SYNC_SECRET` ile imzalı istek; panelin anahtarı 401 alır
  (panel kart basmaz). Anahtar yoksa 503 `not_configured` (yukarıda
  "Varsayılan kapalı"). Gövde en çok 64 KB (413 `too_large`), liste en çok
  200 masa. İmza yöntemi `PUT`'tur: kanonik metnin ikinci satırı `PUT`.
- `code` sitenin kod kuralıyla okunur (`normalizeTableCode`: büyük harf, boşluk
  ve tire düşer, O → 0, I ve L → 1; tam 10 simge). `name` masa formunun
  kuralıyla (1-40 karakter, iç boşluklar tek boşluk). `active` boolean.
  `actor` LafPOS kullanıcısının adı (1-60 karakter). Kurala uymayan alan
  hiçbir şey yazılmadan 400 `{"error":"invalid","field":"tables[2].code"}`
  (`tables[2].name`, `tables[2].active`, `tables` fazla uzunsa, `actor`,
  `body`); aynı kod listede iki kez geçerse de `tables[i].code`.
- **Ne yapar** (`importCafeTables`, `src/lib/admin/cafe-tables.ts`;
  plan `src/lib/panel/tables-link-core.ts`): sitede olmayan kod verilen
  kodla, adla ve etkinlikle **yeni masa** olur (`rotatedAt` boş, `tbl-`
  kimliği ve Sıra'sı sayaçtan); sitede olan kodun adı ve etkinliği
  **değiştiyse** güncellenir (yalnız değişen sütun yazılır); listede olmayan
  sitedeki masaya **dokunulmaz**. LafPOS'un yenilediği eski kod listede
  `active: false` gelir: sitede de kapanır, eski kart `/masa`'da "siparişe
  kapalı" olur. Boş liste geçerlidir: hiçbir şey yazılmaz.
- Masa araması önbelleksizdir (`cafe_tables` hiçbir önbellek etiketini
  taşımaz, `src/lib/cache/tags.ts`; `/masa/[kod]` ve uygulamanın ucu her
  seferinde veritabanına gider): yeni kod yanıt döner dönmez çözülür. Panele
  ping gitmez (panel masa listesi tutmaz).
- **Olay kaydı:** eklenen ve değişen her masa için bir satır, `cafe_table`
  / `create` ya da `update`, aktör `lafpos:<ad>`, yükte ad, kod, etkinlik ve
  `via: lafpos`; panelin kendi Masalar işlemleriyle aynı biçim. Değişmeyen
  masa kayıt düşürmez. Kayıt yazılamazsa yanıt yine 200'dür (yazım bitmiştir).
- Yazımlar satır satır, tek işlem değil: arada kesilen liste yazdığı
  satırları bırakır, LafPOS'un yeniden gönderdiği liste kalanını yazar
  (aynı liste iki kez gelirse ikincisi `unchanged` sayar). Bu arada başka
  yoldan eklenen aynı kod (tekil indeks) reddedilmez, güncellenir.

| Durum | Gövde                                                         | Ne zaman                                                            |
| ----- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| 200   | `{"ok":true,"branch":"marina","count":2,"created":1,"updated":1,"unchanged":0}` | `count` listedeki masa; üçü yazılan ve yazılmayan satırlar          |
| 400   | `{"error":"invalid","field":"…"}`                             | Gövde okunamadı ya da bir alan kurala uymuyor (`branch` dahil); hiçbir şey yazılmadı |
| 403   | `{"error":"forbidden","field":"branch"}`                      | LafPOS'un anahtarı o şube adına konuşamaz (`LAFPOS_BRANCHES`)       |
| 409   | `{"error":"wrong_branch","field":"tables[1].code"}`           | O kod sitede başka şubenin masası; hiçbir şey yazılmadı             |
| 401   | `{"error":"unauthorized"}`                                    | İmza yok, yanlış (panelin anahtarı da), eski ya da gövde değişmiş   |
| 413   | `{"error":"too_large"}`                                       | Gövde 64 KB'tan büyük                                               |
| 503   | `{"error":"not_configured"}`                                  | `LAFPOS_SYNC_SECRET` yok ya da 32 karakterden kısa                  |
| 503   | `{"error":"unavailable"}`                                     | Veritabanı yazılamadı; LafPOS artan beklemeyle yeniden dener        |

LafPOS 404 / 405 / 501'i "site henüz almıyor" sayar ve 6 saatte bir yeniden
dener; 400 / 403 / 409 / 413 / 422'de listeyi park eder (Yönetim ›
Entegrasyon'da görünür, "Şimdi yeniden gönder" ile denenir). Kodu LafPOS
ürettiği için bu paneldeki "Kodu yenile" LafPOS'un bastığı kartı da
öldürür: LafPOS'lu masanın kodu LafPOS'ta yenilenir, panelde değil.
Kişisel veri taşımaz: yalnız masa adı ve kod.

## LafPOS ne zaman çeker

- Sürüm ucunu **20 saniyede bir** sorar; değer bir önceki yanıttakinden farklıysa
  `GET /api/panel/orders`'ı çeker. Böylece uygulamadan gelen sipariş, Neon'u her
  soruda uyandırmadan yarım dakika içinde bar ekranına düşer. Sürüm sorusu
  veritabanına gitmez; sipariş okuması yalnız gerçekten bir şey değişince olur.
- Sinyal çalışırken de gün açıkken **15 dakikada bir** tam çeker (gece çekmez):
  sinyali kaçan bir değişiklik ya da süresi dolup listeden sessizce düşen sipariş
  kalmasın. Sinyal okunamazsa 5 dakikada bir çeker; elle "Yenile" en sık 30
  saniyede bir (lafpos `docs/03-ENTEGRASYON.md` §2.3).
  **Boş ekran hatırlanır (22 Kas 2026, #229):** bu çekim gün açık kaldığı
  sürece Neon'u saatte dört kez uyandırıyordu. Şimdi `live:orders` işareti
  aynıyken ve son okuma hiçbir şey bulmadıysa (sipariş yok, ödeme bekleyen
  yok, çağrı yok) aynı boş yanıt veritabanına gidilmeden verilir; `orders` ya
  da `table_calls` yazılınca işaret değişir ve sıradaki çekim canlıdır.
  Emniyet ağı olarak saatte bir çekim yine canlı okur. Ekranda bir şey varken
  hiçbir şey hatırlanmaz (liste saatle de değişir). Yalnız LafPOS'un
  anahtarına; panelin (Tuzla) okuması eskisi gibi her soruşta canlıdır
  (`src/lib/admin/remembered-read.ts`, `tests/sube/neon-uyanma.test.ts`).
- **Karaoke:** aynı yanıttaki `karaoke` değişince, oda kutusu açılınca ve elle
  yenileyince `GET /api/panel/karaoke?from=<gün>&to=<gün>` (bugünün penceresi;
  rezervasyon en geç 24:00'te biter, gece yarısını aşmaz: `closeHour` en çok
  24). Kendiliğinden çekim en sık 5 dakikada bir (lafpos `AGENTS.md` kural 6).
  Bu okuma veritabanına gider; yalnız rezervasyonlar gerçekten değişince olur.
  Yanıt, panelin aldığıyla aynıdır (`docs/PANEL-KARAOKE.md` "Ne nereye gider"
  madde 2); satırların kasada nasıl okunacağı aşağıda.
- **Karaoke penceresi dünden yarınadır.** LafPOS `from` ve `to`'yu her zaman
  gönderir; anahtarı yalnız İstanbul'da dünden yarına kadarki günleri okur,
  iki uç dahil (`withinLafposKaraokeReach`). Bu, kasanın 05:00'e uzanan iş
  gününü (00:30'da kasa hâlâ dünü sorar) ve gece yarısındaki küçük saat farkını
  içine alır. Daha geniş, geçmişe ya da ileriye uzanan ya da `from`'suz pencere
  (sorgusuz istek dün + 90 gün okurdu) hiçbir şey okunmadan 403
  `{"error":"forbidden"}` alır. Panelin penceresi değişmez: 400 güne kadar.
- Menüyü herkese açık uçtan ETag ile, imzalı uçtan en çok 5 dakikada bir okur
  (lafpos `docs/03-ENTEGRASYON.md` §2.1, §2.3, §5). Gün açıkken 15 dakikada
  bir yaptığı ETag'li soru, menü değişmemişken veritabanına gitmeden 304 alır
  (22 Kas 2026; `docs/API-MOBILE.md` "Tazelik penceresi").

## Karaoke satırını kasa nasıl okur

Okuma penceredeki **bütün** satırları verir, iptal edilenler de gelir (panel
iptali de görmeli). Kasa her satıra iki soru sorar: oda bu saatte tutulu mu,
blok önceden ödenmiş mi. Cevap `status` ile `paymentStatus`'un birlikte
okunmasıdır; tek başına `paymentStatus` yetmez. Kurallar sitenin kendi
kurallarıdır (`holdsSlot`, `src/lib/mobile/karaoke-core.ts`; para:
`karaokeMoneyOf`, `src/lib/admin/karaoke-money.ts`):

- **Oda tutulu** yalnız `status` `requested` ya da `confirmed` iken.
  `cancelled` satır odayı bırakmıştır, ödeme durumu ne olursa olsun (`paid`:
  iadesi henüz yapılmamış iptal; `refunding`: geç iptalin payı ödenecek ya da
  iadesi yolda; `refunded`, `expired`, `none`). İptal satırı "Sayacı başlat"ta
  önerilmez, kasada hiçbir şeye sayılmaz. 29 Ekim 2026'dan beri iptal
  satırında `refunded` hiçbir şeyin geri gitmediği anlamına da gelebilir
  (`refundMinor: 0`: %0 kuralında geç istekle saat satışa açıldı); kasa onu
  yine yalnız "İptal" diye okur, alanı okuması gerekmez.
- **Önceden ödenmiş blok** yalnız `status` `cancelled` değilken ve
  `paymentStatus` `paid` iken. Bloğun parası sitededir (online karaoke cirosu,
  `docs/PANEL-SALES.md`); kasa yalnız bloğu aşan süreyi kendi saat ücretiyle
  alır. `totalMinor` 0 olabilir: ön ödemeli %100 ORO indirimli rezervasyon da
  `paid` yazılır.
- **`none`**: ödemesi köşkte alınacak rezervasyon (panelde ön ödeme kapalıyken
  ya da ön ödeme istemeyen eski bir uygulama sürümünden). Blok kasanın saat
  ücretini değil, satırın `totalMinor`'ını öder: üye indirimi o tutarın
  içindedir. `totalMinor` 0 ve notu `Telafi: KRK-…` olan satır köşkün verdiği
  ücretsiz telafi saatidir (köşkün geç iptal ettiği bir rezervasyonun
  karşılığı; personelin açtığı satır, yanıtta `channel: ""`): hiç ücretlenmez.
- **`pending`**: online ödemesi süren tutma (`status` `requested`). Henüz
  ödenmiş değildir: ödeme gelirse `paid` olur; gelmezse site onu (bir sonraki
  rezervasyonda ya da günlük işte) `cancelled` + `expired` yapar ve oda boşalır.
- **`refunding`, `refunded`, `expired`** hiçbir zaman önceden ödenmiş sayılmaz
  ve "Sayacı başlat"ta önerilmez. `refunding` çoğunlukla iptal satırındadır;
  köşkün iptalinde iade yoldayken satır bir süre `confirmed` + `refunding`
  görünebilir: oda o arada tutulu, blok ödenmiş değil.
- Bilinmeyen bir durum güvenli tarafa okunur (`toPanelReservation`): bilinmeyen
  `status` `requested` (oda tutulu), bilinmeyen `paymentStatus` `none` (blok
  `totalMinor`'ı öder).

## Kişisel veri (KVKK)

LafPOS'a panelin aldığından fazlası gitmez: aynı uçlar, aynı beyaz listeler
(`toPanelOrder`: yalnız ad; soyad, e-posta, telefon, adres, kurye notu, ödeme
referansı asla. `toPanelReservation`: yalnız ad, gün ve saat, kişi sayısı,
durum ve ödeme durumu, not, tutar, kanal, iptalde iade tutarı; soyad,
e-posta, telefon, iletişim izni, sözleşme kaydı, ödeme referansı, iadenin
diğer ayrıntıları ve IP asla). Sürüm ucu
hiç veri taşımaz. Online satış ucu LafPOS'a kapalıdır.

Karaoke okumasıyla rezervasyonun adı ve notu kafedeki makineye de gider. Bu
bilgi barın panel ekranında zaten görünür; LafPOS'a açılması, odayı ücretleyen
kasanın sitede ödenmiş saati görmesi içindir (karar: sahibin LafPOS'u açması,
yukarıda "Varsayılan kapalı"). Anahtar girilmedikçe hiçbir şey gitmez.

LafPOS'un anahtarı yalnız dünden yarına kadarki rezervasyonları okur (en çok
üç gün; panel 400 güne kadar okur, yukarıda "LafPOS ne zaman çeker"). Kafedeki
makine çalınır ya da `.env`'i kopyalanırsa, anahtar değişene dek okunabilecek
olan bu birkaç günün adları ve notlarıdır; sitenin üç yıl tuttuğu geçmiş değil
(`src/lib/retention.ts`, `karaoke-guest-data`). Ölçülülük (KVKK m.4/2-ç):
kasanın işi bugünün odasıdır.

## Anahtarı değiştirmek

1. Yeni değeri üretin (`openssl rand -base64 48`).
2. Sitede `LAFPOS_SYNC_SECRET`'ı (Vercel, Production, Sensitive) ve LafPOS'ta
   `.env`'deki `LAFFOGATO_SYNC_SECRET`'ı aynı değere çevirin; siteyi yeniden
   yayımlayın, LafPOS sunucusunu yeniden başlatın. Arada geçen birkaç dakikada
   LafPOS'un istekleri 401 alır; bar ekranı sonraki çekmede eşitlenir, sipariş
   kaybolmaz (siparişin tek kaynağı sitedir).
3. Panelin anahtarı bundan etkilenmez; o da kendi başına değişir
   (`docs/PANEL-KARAOKE.md` "Anahtarı değiştirmek").
4. Kafedeki makine çalınırsa ya da anahtarın sızdığından şüphelenirseniz hemen
   değiştirin. Sitede değeri silmek LafPOS'u bütünüyle kapatır: sürüm ucu 503,
   panel uçları LafPOS'a 401.
5. LafPOS bu değişiklik yayına girmeden önce geçici olarak panelin anahtarıyla
   çalıştıysa o anahtar kafedeki makinede durmuştur: kendi anahtarına geçince
   panelinkini de değiştirin.

Panelin anahtarını (`KARAOKE_SYNC_SECRET`) `LAFPOS_SYNC_SECRET` olarak yapıştırmak işe yaramaz: aynı değer LafPOS'un
anahtarı sayılmaz (`signedCallerKeys`), `GET /api/pos/orders/version` 503 `not_configured` verir ve karışıklık
hemen görünür. İki anahtar her zaman farklı olmalıdır.

## Elle denemek

```bash
SECRET='…'   # LAFPOS_SYNC_SECRET
TS=$(date +%s)
CANON=$(printf '%s\nGET\n/api/pos/orders/version\n\n%s' \
  "$TS" "$(printf '' | sha256sum | cut -d' ' -f1)")
SIG=$(printf '%s' "$CANON" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')
curl -s "https://laffogato.net/api/pos/orders/version" \
  -H "x-laf-timestamp: $TS" -H "x-laf-signature: v1=$SIG"
```

Sorgu boş olduğu için yolun ardından boş bir satır gelir.

Site: `src/lib/panel/signed-callers.ts` (hangi anahtar kimin),
`src/app/api/pos/orders/version/route.ts`, `src/app/api/panel/karaoke/route.ts`,
`src/app/api/panel/tables/route.ts` ve `src/lib/panel/tables-link-core.ts`
(masa kodları), `src/lib/admin/change-marker.ts`. Testler:
`tests/panel-lafpos-key.test.ts` (beş uç, karaoke beyaz listesi ve dünden
yarına penceresi, olay kaydı, kapalı uçlar, masa listesinin yalnız LafPOS'a
açık olması), `tests/panel-karaoke-sync-core.test.ts`
(`withinLafposKaraokeReach`), `tests/api-pos-orders-version-route.test.ts`
(sürüm ucu ve karaoke işareti, veritabanısız), `tests/panel-tables-link.test.ts`
(liste kuralları, plan, uç; veritabanısız) ve
`tests/db-integration-panel-tables.test.ts` (`importCafeTables`, gerçek
Postgres; `TEST_DATABASE_URL` yoksa atlanır).
