# LafPOS ↔ site: kafenin kasası

LafPOS (`RiosenBeq/lafpos`) kafenin içinde çalışan yerel kasa sunucusudur.
Menüyü siteden alır, ürünü kasada Tükendi / Satışta yapar, uygulamadan ve
web'den gelen online siparişleri (masa, gel-al, kurye) bar ekranında ve masa
planında gösterir, aşamasını geri yazar; karaoke odasının sitedeki
rezervasyonlarını okur. Bunun için köşkün panelinin imzalı uçlarını kullanır
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

## Anahtar

| Değişken                | Nerede        | Açıklama                                                                                            |
| ----------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| `LAFPOS_SYNC_SECRET`    | site (Vercel) | LafPOS'un anahtarı, en az 32 karakter; daha kısası tanımsız sayılır. Yoksa LafPOS kapalı (aşağıda). |
| `LAFFOGATO_SYNC_SECRET` | LafPOS `.env` | Sitedekiyle **aynı** değer.                                                                         |

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
| `GET /api/panel/menu`          | açar             | açar               | Tükendi kalemleri de görmek (`isActive`)                                                                                                                                                        |
| `POST /api/panel/menu`         | açar             | açar               | Kasada Tükendi / Satışa aç: önce site, 2xx gelince kasa. LafPOS'un anahtarıyla yalnız `isActive`; `priceMinor` ya da `priceMinorL` 403 `forbidden` (çalınan kafe makinesi fiyat değiştiremesin) |
| `GET /api/panel/orders`        | açar             | açar               | Online siparişler: bar ekranı ve masa planı                                                                                                                                                     |
| `POST /api/panel/orders/stage` | açar             | açar               | Hazırlanıyor / Hazır / Teslim edildi                                                                                                                                                            |
| `GET /api/pos/orders/version`  | açmaz (401)      | açar               | Sipariş ve karaoke sürüm sinyali (aşağıda)                                                                                                                                                      |
| `GET /api/panel/karaoke`       | açar             | açar               | Karaoke odası: sitedeki rezervasyonlar (saat, kişi, ad, not, ödeme durumu), `karaoke` değişince. LafPOS'un anahtarıyla yalnız dünden yarına (İstanbul); daha genişi 403 `forbidden`             |
| `GET /api/panel/sales`         | açar             | açmaz              | LafPOS'un işi değil                                                                                                                                                                             |

- Panel uçlarının yanıt biçimi, `version`'ı, gövde sınırı, beyaz listesi ve
  hata kodları kim imzalarsa imzalasın aynıdır: `docs/PANEL-MENU.md`,
  `docs/PANEL-ORDERS.md`, `docs/PANEL-KARAOKE.md`. İki fark yalnız LafPOS'un
  anahtarındadır, ikisi de hiçbir şey okunmadan 403 `forbidden`: menüde fiyat
  yazımı, karaokede dünden yarına dışında kalan pencere (çalınan kafe makinesi
  fiyat değiştiremesin, geçmişin adlarını ve notlarını okuyamasın).
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

## LafPOS ne zaman çeker

- Sürüm ucunu **20 saniyede bir** sorar; değer bir önceki yanıttakinden farklıysa
  `GET /api/panel/orders`'ı çeker. Böylece uygulamadan gelen sipariş, Neon'u her
  soruda uyandırmadan yarım dakika içinde bar ekranına düşer. Sürüm sorusu
  veritabanına gitmez; sipariş okuması yalnız gerçekten bir şey değişince olur.
- Ayrıca 5 dakikada bir, ekran açılınca ve elle yenileyince çeker.
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
  (lafpos `docs/03-ENTEGRASYON.md` §2.1, §2.3, §5).

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
  önerilmez, kasada hiçbir şeye sayılmaz.
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
durum ve ödeme durumu, not, tutar, kanal; soyad, e-posta, telefon, iletişim
izni, sözleşme kaydı, ödeme referansı, iade ayrıntısı ve IP asla). Sürüm ucu
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
`src/lib/admin/change-marker.ts`. Testler: `tests/panel-lafpos-key.test.ts`
(beş uç, karaoke beyaz listesi ve dünden yarına penceresi, olay kaydı, kapalı
uçlar), `tests/panel-karaoke-sync-core.test.ts` (`withinLafposKaraokeReach`),
`tests/api-pos-orders-version-route.test.ts` (sürüm ucu ve karaoke işareti,
veritabanısız).
