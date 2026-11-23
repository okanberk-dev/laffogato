# Siparişler ↔ yönetim paneli: bar ekranı

Köşkün iç paneli (ladmin.laffogato.net, `RiosenBeq/lafmaliyet`) barda hep
açık duran bir ekrandır: karaoke odasını sayar ve yeni rezervasyonda çalar
(`docs/PANEL-KARAOKE.md`). Operatörün isteği (22 Eki 2026): _"laffogato
admin ile lafmaliyette paralel çalışabilecek neler varsa ... beraber
çalışsın"_. Uygulamadan (ve web'den) gelen, ödenmiş kafe siparişi de bu
ekrana düşer: barista siparişi orada görür, ekran çalar ve siparişi tek
dokunuşla ilerletir ("Hazırlanıyor", "Hazır"; operatör, 22 Eki 2026:
_"bar ekranından tek dokunuşla Hazır"_).

## Kural: sipariş makinesi sitede kalır

- Sipariş verisinin tek kaynağı sitedir (`orders`). Panel kopya tutmaz,
  her çekmede açık siparişlerin listesini baştan alır.
- Panel siparişi **kendisi yazmaz**. Bar ekranındaki düğme siteye ne
  dokunulduğunu söyler (`POST /api/panel/orders/stage`, aşağıda "Aşama");
  site hareketi kendi `transitionOrder`'ıyla yapar: stok, sadakat,
  e-postalar ve üyenin telefon bildirimi (`docs/API-MOBILE.md` §23) bu
  paneldeki "Hazırlanıyor" / "Teslime hazır" ile birebir aynı yürür. Yalnız
  üç ileri adım vardır; iptal, iade ve geri alma yalnız bu panelde
  (`/admin/siparisler/<id>`) yapılır, ekran her siparişte oraya giden
  bağlantıyı (`path`) taşır.
- Kasada (ModPOS; geçişten sonra LafPOS) bu siparişler **çalınmaz**: parası
  sanal POS'tan (PayNkolay) ya da cüzdandan alınmıştır. Kasanın cirosu ile
  sitenin cirosu ayrı kalır; panel ikisini `docs/PANEL-SALES.md` ile toplar.

## Ekrana ne düşer

| Aşama (`stage`) | Sipariş durumu           | Ne zaman ekrandan kalkar                    |
| --------------- | ------------------------ | ------------------------------------------- |
| `new`           | `paid`                   | Biri "Hazırlanıyor" deyince aşama değişir   |
| `preparing`     | `preparing`              | Masaya / kuryeye gidince ya da tamamlanınca |
| `ready`         | `shipped`, yalnız gel-al | Tamamlanınca                                |

Yalnız **kafe** siparişi (`kind: "cafe"`); mağaza kolisi, panelden elle
girilen sipariş (`source: "manual"`: kasada zaten çalındı), ödenmemiş,
iptal, iade ve tamamlanmış sipariş gelmez. Masaya götürülmüş ya da kuryeye
verilmiş sipariş (`shipped`, masa / kurye) bar için bitmiştir, gelmez.
İptal edilen satırlar (`items[].status = "cancelled"`) listeden düşer;
kalanların konumu (`lines[].index`) değişmez. Ekrandan çıkan sipariş son 48
saat boyunca yanıtın `closed` listesinde nedeniyle (tamamlandı, iptal, iade)
adıyla geçer (aşağıda "Okuma").

**Unutulmuş sipariş.** Vaktinden (planlı saati, yoksa ödeme anı) 24 saat
geçmiş ve hâlâ ilerletilmemiş sipariş, ya da 12 saattir "teslime hazır"
bekleyen gel-al, ekrandan kalkar; sitenin sipariş listesinde durur. Planlı
sipariş en çok 7 gün önceden ödenebildiği için okuma ödeme anından 8 gün
geriye bakar. Bu kural sorgunun kendisindedir
(`panelOrdersLiveSince`, 23 Eki 2026): kimsenin "Teslim edildi"ye basmadığı
yüzlerce eski sipariş okumanın sınırını doldurup bugünün kartlarını
gizleyemez.

## Şube (21 Kas 2026)

Site 21 Kasım 2026'ya kadar şube bilmiyordu: iki imzalı çağıran (köşkün
paneli ve LafPOS) bütün açık siparişleri ve çağrıları alıyordu. İlk LafPOS
kasası Marina'ya gidince Marina'nın bar ekranı Tuzla'da masadan verilip
sitede ödenmiş siparişi çalıyor, "Hazırlanıyor" / "Gördüm" Tuzla'nın
kaydını sitede ilerletip kapatıyordu.

- Her kafe siparişinin ve masa çağrısının şubesi vardır (`orders.branch`,
  `table_calls.branch`): masa siparişi ve çağrısı **masanın** şubesi
  (`cafe_tables.branch`, anlık görüntü), gel-al ve kurye siparişi Tuzla
  (uygulama ve web Tuzla köşküne hizmet eder). Bu değişiklikten önce yazılan
  her şey Tuzla'nındır.
- `GET /api/panel/orders` bir şubenin listesidir: `?branch=` (imzalı
  sorgunun parçası) ya da çağıranın şubesi; panelin anahtarı Tuzla (her şube
  adına konuşabilir), LafPOS'unki `LAFPOS_BRANCHES` (varsayılan Marina).
  `orders`, `awaitingPayment` ve `calls` yalnız o şubenin; yanıt hangi şube
  olduğunu söyler (`branch`). Anahtarın konuşamadığı şube 403 `{"error":
  "forbidden","field":"branch"}`, bozuk ya da bilinmeyen 400 `invalid`,
  hiçbir şey okunmadan.
- Aşama ve "Gördüm" gövdesi isteğe bağlı `branch` alabilir (aynı varsayılan);
  başka şubenin siparişi ya da çağrısı 409 `{"error":"wrong_branch"}`,
  hiçbir şey yazılmaz, kaydın içeriği söylenmez.
- LafPOS'un sürüm sinyali (`GET /api/pos/orders/version`, 23 Kas 2026) de
  şubenindir: `version` şubenin bu yanıtının özetidir, başka şubenin
  siparişi ya da çağrısı onu oynatmaz (`docs/LAFPOS.md` "Sipariş sürüm
  sinyali").
- Kural `src/lib/panel/branches.ts`; testleri `tests/sube/`
  (`npm run test:sube`).

## Uçlar

Karaoke bağlantısının imzası (`x-laf-timestamp`,
`x-laf-signature: v1=<hex>`, `src/lib/panel/karaoke-sync-core.ts`) ve ortak
anahtarı (`KARAOKE_SYNC_SECRET`). Anahtar yoksa uç 503 döner, ping gitmez.
Okumanın, pingin, aşama dokunuşunun ve ayın satışının (`docs/PANEL-SALES.md`)
imza vektörleri sitede `tests/panel-karaoke-sync-core.test.ts`'te sabit
(aynı deneme anahtarı ve an); panel aynılarını P2'de kendi testlerinde
sabitleyecek, o güne dek bu dördünü yalnız site tutar. Kural bir tarafta
değişirse bu istekler 401 olur.

Kafenin kasası LafPOS okuma ve aşama uçlarını kendi anahtarıyla (`LAFPOS_SYNC_SECRET`) kullanır, kendi şubesinin `GET /api/pos/orders/version` değeri değişince çeker: `docs/LAFPOS.md`.

1. **Ping (site → panel).** `live:orders` etiketini düşüren her yazım
   (sipariş açıldı, ödendi, ilerledi, iade edildi; mağaza kolisi de) yanıttan
   sonra panele imzalı tek bir istek gönderir:

   ```
   POST https://ladmin.laffogato.net/api/orders/ping
   {"event":"orders.changed","at":"2026-10-22T12:00:00.000Z"}
   ```

   Gövdede sipariş yok. Aynı istekteki ardışık yazımlar tek pinge biner,
   panel ulaşılamazsa bir kez daha denenir, yazım bundan asla etkilenmez
   (`src/lib/panel/ping.ts`). Ping hangi siparişin değiştiğini bilmez;
   yeni bir şey bulmayan çekme panele tek küçük okumaya mal olur.

2. **Okuma (panel → site).**

   ```
   GET https://laffogato.net/api/panel/orders
   GET https://laffogato.net/api/panel/orders?branch=marina
   ```

   ```json
   {
     "version": 1,
     "now": "2026-10-22T12:00:00.000Z",
     "branch": "tuzla",
     "complete": true,
     "orders": [
       {
         "id": "ord-0042",
         "orderNo": 10042,
         "stage": "new",
         "fulfillment": "table",
         "label": "Masa 4",
         "tableCode": "K7Q2M9X4TB",
         "firstName": "Ayşe",
         "scheduledFor": "",
         "note": "Fındık alerjim var",
         "paidAt": "2026-10-22T11:55:00.000Z",
         "lines": [
           {
             "menuItemId": "mnu-0003",
             "name": "Latte",
             "size": "M",
             "detail": "M · yulaf · +1 shot",
             "note": "şurupsuz lütfen",
             "qty": 2,
             "index": 0
           }
         ],
         "totalMinor": 24000,
         "paidAtTill": false,
         "path": "/admin/siparisler/ord-0042"
       }
     ],
     "awaitingPayment": 0,
     "calls": [
       {
         "id": "tcl-3f9a0c4b7d2e1a68",
         "tableCode": "K7Q2M9X4TB",
         "label": "Masa 4",
         "reason": "water",
         "createdAt": "2026-11-06T18:02:11.000Z"
       }
     ],
     "closed": [
       { "id": "ord-0039", "outcome": "completed" },
       { "id": "ord-0040", "outcome": "cancelled" }
     ]
   }
   ```

   - `fulfillment`: `table` | `pickup` | `delivery`; `label` sayacın dili
     ("Masa 4", "Gel-al", "Kurye"), sitenin sipariş zilindekiyle aynı
     (`orderAlertLabel`).
   - `tableCode` (28 Eki 2026, sonradan eklendi; eski panel yok sayar):
     masa siparişinde masanın kodu, siparişin anlık görüntüsünden
     (`orders."tableCode"`; masa sonradan yenilense de siparişinki kalır).
     Gel-al ve kurye siparişinde hep `""`. Kafenin kasası LafPOS siparişi
     masa planındaki masaya bu kodla eşler, kendi bastığı kartın kodunu
     siteye `PUT /api/panel/tables` ile bildirir (`docs/LAFPOS.md` "Masa
     kodları"). Kod kişisel veri değildir: masanın üstünde basılıdır.
   - `size`: `M` | `L` | `single`. `menuItemId` panelin ürününe menü
     bağlantısıyla eşlenir (`docs/PANEL-MENU.md`): ekran içeceğin reçetesini
     gösterebilir.
   - `scheduledFor`: planlı saat (ISO), `""` = hemen.
   - `note` (23 Eki 2026, sonradan eklendi; eski panel yok sayar): üyenin
     sipariş notu (uygulamanın `POST /orders` `note`'u), kırpılmış, en çok
     300 karakter. **Yalnız masa ve gel-al** siparişinde dolar; kurye
     siparişinde hep `""`, çünkü orada alan adres notuyla (kapı kodu) başlar
     (`"[adres notu] · [not]"`). Sitenin personel e-postasındaki "MÜŞTERİNİN
     NOTU" kuralının aynısı. Not yoksa `""`.
   - `lines[].note` (23 Eki 2026, sonradan eklendi): satırın barista notu
     (`items[].options.note`), kırpılmış, en çok 200 karakter; `""` = yok.
     Adres taşımadığı için her teslimat türünde gider.
   - `lines[].index` (23 Kas 2026, sonradan eklendi; eski okuyucu yok sayar,
     `version` 1 kalır): satırın siparişin `items` dizisindeki yeri (0'dan).
     Satırın durumu yerinde yazıldığı için (`set_order_item_status`)
     sabittir: iptal edilen satır listeden düşer, kalanların konumu değişmez
     (ilk satır iptal edilince ikincisi `1` kalır, `0` olmaz). LafPOS
     kalemlerini bununla eşler, konumu listeden kalkan kalemi iptal eder
     (lafpos `docs/03-ENTEGRASYON.md` "Kalem iptali").
   - `paidAtTill` (23 Kas 2026, sonradan eklendi; eski okuyucu yok sayar):
     siparişin ödeme satırlarında başarılı `manual:nakit` ya da
     `manual:kart` varsa `true` (uygulamada kart düştü, müşteri kasada
     ödedi, personel "Ödendi olarak işaretle"); havale ve "Diğer" `false`.
     Kural satış ucununkidir (`paidAtTill`, `docs/PANEL-SALES.md`: böyle
     sipariş `counter` altında sayılır): parası ve mali fişi kasanındır.
     LafPOS onu "sitede ödendi" diye yazmaz, adisyon olarak çalınmasını
     ister (lafpos "Kasada ödenen"). Ödeme yöntemi ve referansı gitmez,
     yalnız bayrak. Aşama ucunun yanıtındaki `order` da taşır. Site:
     `listPanelTillPaidOrderIds`.
   - `path`: siparişin bu paneldeki sayfası; panel önüne sitenin adresini
     koyar.
   - Sıra: vakti en yakın olan önce (planlı saat, yoksa ödeme), sonra
     sipariş numarası.
   - En çok 200 sipariş; fazlası varsa `complete: false`. `complete`, ekrana
     kalanlardan değil okunan satırlardan sayılır: okuma dolu döndüyse
     (açık ya da teslime hazır siparişlerde 201 satır) `false`.
   - `awaitingPayment` (28 Eki 2026, sonradan eklendi; eski panel ve LafPOS
     yok sayar, `version` 1 kalır): hâlâ ödemesini bekleyen
     (`pending_payment`), ödenince bu ekrana düşecek kafe siparişlerinin
     **sayısı** (masa, gel-al ya da kurye), son ödeme sayfası son 30
     dakikada açılmış olanlar (sınır dahil). Ödeme sayfası siparişle açılır
     (`createdAt`); uygulamadaki "Şimdi öde" ya da kaybolan isteğin
     tekrarı onu, siparişin yaşı ne olursa olsun, yeniden açar ve bu
     açılış bekleyen bir ödeme satırı bırakır (`recordPendingCheckout`):
     siparişi 30 dakika daha saydırır ve panele ping atar (ödeme satırı
     `live:orders`'ı düşürmediği için yazım kancası atmazdı). Panelden elle
     girilen sipariş (bar ekranına hiç düşmez: `toPanelOrder` elle girilen
     siparişi göstermez) ve mağaza kolisi sayılmaz. Yalnız sayı gider:
     siparişin kimliği, satırları, müşterisi ve tutarı gitmez. Alan her
     yanıtta vardır, bekleyen yoksa `0`. Sayı listeden **önce**, sırayla
     okunur: sipariş yalnız bekleyenden ödenmişe geçer, iki okuma arasında
     ödenen sipariş listede çıkar (en kötü ikisinde de), hiçbirinde
     kalmaz. Sayı okunamazsa uç 503 `unavailable` döner, `0` denmez.
     Neden: kart ödemesinin pingi kaybolursa ödenmiş sipariş sakin saatte
     panelin saatlik çekmesine kalırdı; panel sayı sıfırdan büyükken
     siparişi kısa bir süre sık çeker (aşağıda "Panel ne zaman çeker").
     Site: `countPanelAwaitingPaymentOrders`, `panelAwaitingPaymentSince`,
     `isBarScreenOrder`.
   - `calls` (6 Kas 2026, sonradan eklendi; eski panel ve LafPOS yok sayar,
     `version` 1 kalır): masadan açık garson çağrıları, en eskisi önce.
     Alan her yanıtta vardır, çağrı yoksa `[]`. Ayrıntı aşağıda "Masa
     çağrıları".
   - `branch` (21 Kas 2026, sonradan eklendi; eski okuyucu yok sayar):
     listenin şubesi (yukarıda "Şube").
   - `closed` (23 Kas 2026, sonradan eklendi; eski okuyucu yok sayar,
     `version` 1 kalır): son 48 saatte ekrandan çıkan, şubenin kafe
     siparişleri ve neden çıktıkları, `[{ "id", "outcome" }]`. LafPOS
     listede artık olmayan siparişi kapatırken sonucunu buradan alır; iptal
     ve iade edileni online toplamına saymaz (lafpos "Kapanış").

     | Sitedeki durum                                            | `outcome`   |
     | --------------------------------------------------------- | ----------- |
     | `completed` (Teslim edildi)                               | `completed` |
     | `shipped`, masa ya da kurye (Masaya götürüldü / Kuryeye verildi) | `completed` |
     | `cancelled` (sonradan iade edilmiş olsa da)               | `cancelled` |
     | `refunded` (tutarın tamamı iade)                          | `refunded`  |

     Gelmeyenler: ekrandaki sipariş (teslime hazır gel-al dahil), unutulmuş
     sipariş (24 saat, hazır gel-al'da 12 saat ilerlemeyen: parası sayılır,
     sonucu bilinmez), bütün satırları iptal edilmiş ama kendisi açık sipariş
     (tutar değişmez), kısmi iade (sipariş açık kalır), ödenmeden iptal
     edilen (ekrana hiç düşmedi), elle girilen sipariş ve mağaza kolisi.
     Pencere: siparişin ödendiği, masaya / kuryeye verildiği, tamamlandığı
     ya da iptal edildiği (stoğun geri verildiği, `stockReleasedAt`) an son
     48 saatte. İptalsiz tam iadenin kendi anı yoktur (iade defterindedir):
     ödendiği, verildiği ya da tamamlandığı an penceredeyse gelir. Okuma
     ekranınkiyle aynı 8 günlük ödeme sınırını taşır. En son ödenen önce, en
     çok 200; yalnız kimlik ve sonuç gider. Alan her yanıtta vardır, yoksa
     `[]`. Liste açık siparişlerden **sonra** okunur: arada kapanan sipariş
     listede kalır, `closed`'da yazmaz (sonraki çekim söyler); hiçbirinde
     olmayan sipariş olmaz. Tek sorgu, `orders_branch_kind_paid_idx`
     dizininde (şube, tür, ödeme anı; göç
     `20261123130144_orders_branch_kind_paid_idx.sql`). LafPOS'un sessiz
     ekranı hatırlanırken `closed` da onunla hatırlanır: liste yalnız
     sipariş yazımıyla büyür (işaret değişir), saatle yalnız kısalır;
     hatırlanan liste en kötü 48 saatini biraz geçmiş bir siparişi de
     söyler, ki o da doğrudur. Site: `listPanelClosedOrderRows`,
     `panelClosedOutcome`, `toPanelClosed`.
   - `Cache-Control: no-store`.

   | Durum | Gövde                        | Ne zaman                                |
   | ----- | ---------------------------- | --------------------------------------- |
   | 400   | `{"error":"invalid","field":"branch"}` | `branch` bozuk ya da bilinmeyen |
   | 401   | `{"error":"unauthorized"}`   | İmza yok, yanlış ya da 5 dakikadan eski |
   | 403   | `{"error":"forbidden","field":"branch"}` | Anahtar o şube adına konuşamaz |
   | 503   | `{"error":"not_configured"}` | Anahtar yok                             |
   | 503   | `{"error":"unavailable"}`    | Veritabanı okunamadı (boş liste değil)  |

## Kişisel veri (KVKK)

Ekrana yalnız siparişi hazırlamak ve teslim etmek için gereken gider:
satırlar, seçenekleri ve satır notları, nereye gideceği, planlı saat,
müşterinin **yalnız adı** (gel-al'da seslenmek için; sitenin personel
e-postası ve karaoke bağlantısı da yalnız adı taşır) ve masa ya da gel-al
siparişinde üyenin notu (alerji, "şurupsuz"; personel e-postası da yalnız
bunu taşır). Soyad, e-posta, telefon, adres, kurye notu (kapı kodu: kurye
siparişinin notu hiç gitmez), ödeme yöntemi ve referansı **asla** gitmez
(`paidAtTill` yalnız bir bayraktır; `closed` yalnız kimlik ve sonuç): alanlar
beyaz listeyle tek tek kurulur (`toPanelOrder`), tabloya sonradan eklenen
bir sütun kendiliğinden sızamaz. `awaitingPayment` yalnız bir sayıdır:
ödeme bekleyen siparişin hiçbir alanı gitmez. `calls` yalnız masayı ve
isteği taşır: çağıran üyenin adı ve e-postası gitmez (`toPanelTableCalls`). `tests/panel-orders-feed.test.ts`
ve `tests/db-integration-panel-feeds.test.ts` tutar.

## Panel ne zaman çeker

Pingde (geçici bir hatada 4 saniye sonra bir kez daha), ekran açılınca ya
da görünür olunca (son çekmeden 1 dakika geçtiyse), "Yenile" düğmesinde (en
sık 10 saniyede bir) ve ekran görünürken arka planda (ping kaçarsa diye):
sipariş varken 3 dakikada, sakinken saatte bir, son çekme hatalıysa
dakikada bir. Cron yok: siparişler anlıktır.

Ödeme bekleyen sipariş (`awaitingPayment` > 0): panel en çok 30 dakika, 3
dakikada bir çeker; böylece ödeme pingi kaybolsa da ödenmiş sipariş birkaç
dakika içinde ekrana gelir. Takibin asıl sınırı sitededir: her sipariş son
ödeme sayfasından 30 dakika sonra sayıdan düşer. Panel kendi 30 dakikasını
tutarsa onu yalnız 0 → > 0 geçişinde değil, sayı sıfırdan büyükken gelen her
pingte yeniden başlatır: yeniden açılan ödeme sayfası ping atar ama sipariş
zaten sayılıyorsa sayıyı artırmaz. Bu, panelin senkron
planındaki P2 görevidir (lafmaliyet `docs/planlar/senkron.md` §3.2
`siparis-bar-liste`); o yayına çıkana dek panel alanı yok sayar ve bugünkü
gibi çeker.

Panel yeni bir `new` siparişi (`id`'sini o cihazın daha önce görmediği)
çalar; ilk çekmede ve ekran yeni açıldığında 2 dakikadan eski siparişler
için çalmaz. Masa siparişinin deseni daha uzun ve ayrıdır (sitenin zil
kuralı gibi önce masa, `order-alerts-core.ts`). Yeni sipariş panelin Web
Push'uyla da (`orders` konusu) gider: personel cihazında varsayılan açık,
yöneticininkinde kapalı; bildirimde müşterinin adı yazmaz.

Panel listeyi `integration_state`'te tek bir kopya olarak tutar (her
çekmede üzerine yazılır, geçmiş yok, `totalMinor` saklanmaz). Panel tarafı:
`RiosenBeq/lafmaliyet` `docs/SITE-SIPARIS.md`.

## Aşama: `POST /api/panel/orders/stage` (22 Eki 2026)

Bar ekranının tek dokunuşluk düğmeleri. İmza ve anahtar yukarıdakiyle aynı;
gövde en çok 1 KB, katı JSON:

```json
{ "id": "ord-0042", "action": "ready", "from": "new", "actor": "Selin" }
```

| `action`    | İzinli `from`           | Sipariş hareketi        | Düğme                                                            |
| ----------- | ----------------------- | ----------------------- | ---------------------------------------------------------------- |
| `preparing` | `new`                   | `paid` → `preparing`    | Hazırlanıyor                                                     |
| `ready`     | `new`, `preparing`      | → `shipped`             | gel-al "Hazır", masa "Masaya götürüldü", kurye "Kuryeye verildi" |
| `delivered` | `ready` (yalnız gel-al) | `shipped` → `completed` | Teslim edildi                                                    |

- `from`, kartın gösterdiği aşamadır; hareket ona **koşulludur** (siparişin
  durumu hâlâ o aşamanın durumu olmalı). Eski ekrandan gelen dokunuş, ya da
  imzanın beş dakikası içinde tekrar gönderilen aynı istek, siparişi ikinci
  kez ilerletmez: 409 alır.
- `actor` panel kullanıcısının adıdır (1-80 karakter); sitenin olay
  kaydına ve sipariş zaman çizelgesine "Yönetim paneli · Selin" olarak düşer
  (`panel:Selin`).

| Yanıt                              | Ne zaman                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| 200 `{"order": …}`                 | Hareket yapıldı; `order` ekranın biçiminde (`toPanelOrder`), ekrandan kalktıysa `null` |
| 409 `{"error":"stale","order": …}` | Sipariş bu arada değişti ya da dokunuş aşamasına uymuyor; `order` şimdiki hâli         |
| 404 `{"error":"not_found"}`        | Böyle sipariş yok, ya da bar ekranının siparişi değil (mağaza, elle girilen)           |
| 409 `{"error":"wrong_branch"}`     | Başka şubenin siparişi (21 Kas 2026); hiçbir şey yapılmadı                             |
| 400 `{"error":"invalid","field"}`  | Gövde okunamadı ya da bir alan geçersiz (`branch` dahil)                               |
| 403 `{"error":"forbidden","field":"branch"}` | Anahtar o şube adına konuşamaz                                               |
| 401 · 413 · 503                    | Diğer panel uçlarıyla aynı                                                             |

Panele bu uçtan yeni kişisel veri gitmez: yanıt, okuma ucunun beyaz
listesidir (yalnız ad). Site: `src/app/api/panel/orders/stage/route.ts`,
`src/lib/panel/orders-stage-core.ts`; `tests/panel-orders-stage.test.ts`
tutar. Panel: `src/server/actions/site-orders.ts`,
`src/lib/site-orders/stage{,-request}.ts` (lafmaliyet `docs/SITE-SIPARIS.md`).

## Masa çağrıları: `calls` ve `POST /api/panel/calls/ack` (6 Kas 2026)

Operatör: masadaki üye uygulamadan garson, su ya da peçete isteyebilsin;
istek sitenin panelinde ve bar ekranında çalsın, biri "Gördüm" diyene kadar
dursun. Üye tarafı `docs/API-MOBILE.md` §22.1 (`POST
/api/mobile/v1/tables/{code}/calls`); açık/kapalı anahtarı Uygulama ayarları
› Sipariş › "Masadan garson çağırma açık" (masaya sipariş de açık olmalı).

**Okuma.** `GET /api/panel/orders`'ın `calls` alanı (yukarıda):

| Alan        | Anlamı                                                                 |
| ----------- | ---------------------------------------------------------------------- |
| `id`        | `tcl-` ve 16 rastgele karakter                                          |
| `tableCode` | Masanın kodu, çağrı anındaki (siparişlerin `tableCode`'u gibi)          |
| `label`     | "Masa 4": siparişlerin `label`'ıyla aynı kural (`tableLabel`)           |
| `reason`    | `waiter` (Garson çağırıyor) · `water` (Su istiyor) · `napkin` (Peçete istiyor) |
| `createdAt` | ISO                                                                    |

Yalnız **açık** çağrılar: yanıtlanmamış ve 15 dakikadan genç; en eskisi
önce, en çok 50. 15 dakikada kimse yanıtlamazsa çağrı kendiliğinden ekrandan
düşer (uygulama onu `expired` görür). Aynı masadan aynı sebeple açık çağrı
varken yeni çağrı açılmaz; site o çağrıyı üyeye geri verir. Çağrının açılması
ve yanıtlanması `live:orders`'ı düşürür: panele `orders.changed` pingi gider,
çağrının şubesindeki LafPOS'un `/api/pos/orders/version`'ı ilerler, sitenin
sipariş zili çalar.

**Yanıtlama.** Bar ekranındaki "Gördüm": imza, anahtar ve başlıklar
`POST /api/panel/orders/stage`'inkiyle aynı (panel ya da LafPOS kendi
anahtarıyla); gövde en çok 1 KB, katı JSON, iki alan (21 Kas 2026'dan beri
isteğe bağlı üçüncüsü `branch`, yukarıda "Şube"):

```json
{ "id": "tcl-3f9a0c4b7d2e1a68", "actor": "Selin" }
```

| Yanıt                                              | Ne zaman                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| 200 `{"ok":true,"call":{"id":"tcl-…","status":"acked"}}` | Yanıtlandı; ya da zaten yanıtlanmıştı (burada, sitede ya da tekrar gönderilen istekle): aynı yanıt, ikinci yazım yok |
| 404 `{"error":"not_found"}`                        | Böyle çağrı yok                                                            |
| 409 `{"error":"wrong_branch"}`                     | Başka şubenin çağrısı (21 Kas 2026); yanıtlanmadı                          |
| 400 `{"error":"invalid","field"}`                  | Gövde okunamadı, bir alan geçersiz ya da fazladan alan var                 |
| 401 · 413 · 503                                    | Aşama ucuyla aynı                                                          |

Site çağrıya `ackedAt` ve `ackedBy` yazar: `panel:<actor>` (LafPOS'un
anahtarıyla `lafpos:<actor>`); sitenin panelinden yanıtlanırsa
`admin:<ad>`. Yanıtlanmamış ama süresi geçmiş çağrı da yanıtlanabilir.

**İmza vektörü** (iki tarafın testi sabitler; sır ve an diğer vektörlerle
aynı: `test-secret-0123456789-abcdefghijklmnop`, `1760000000`): `POST
/api/panel/calls/ack`, gövde
`{"id":"tcl-3f9a0c4b7d2e1a68","actor":"Selin"}` →
`cdda6260245ebae291a8a93e3e691144b393b3fb970335a1133e2b439df6d19a`
(`tests/panel-karaoke-sync-core.test.ts`).

**Sitenin kendi paneli.** Açık çağrı sipariş zilinde yeni sipariş gibi
çalar ("Masa 4 · Su istiyor", kartta "Gördüm") ve `/admin/siparisler`'in
üstünde "Masa çağrıları" listesinde durur; "Gördüm" çağrıyı yanıtlar
(`admin:<ad>`), ekranlardan düşürür.

**Saklama.** `table_calls`, 30 gün sonra günlük imha çalışmasıyla silinir
(`src/lib/retention.ts`, kural `table-calls`); çağıran üyenin e-postası
yalnız sitede durur, hesap kapanınca anonimleşir.

Site: `src/app/api/panel/orders/route.ts` (`calls`),
`src/app/api/panel/calls/ack/route.ts`, `src/lib/panel/calls-ack-core.ts`,
`src/lib/admin/table-calls{,-core}.ts`; `tests/panel-orders-feed.test.ts`,
`tests/panel-calls-ack.test.ts` tutar.
