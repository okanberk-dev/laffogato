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
İptal edilen satırlar (`items[].status = "cancelled"`) listeden düşer.

**Unutulmuş sipariş.** Vaktinden (planlı saati, yoksa ödeme anı) 24 saat
geçmiş ve hâlâ ilerletilmemiş sipariş, ya da 12 saattir "teslime hazır"
bekleyen gel-al, ekrandan kalkar; sitenin sipariş listesinde durur. Planlı
sipariş en çok 7 gün önceden ödenebildiği için okuma ödeme anından 8 gün
geriye bakar. Bu kural sorgunun kendisindedir
(`panelOrdersLiveSince`, 23 Eki 2026): kimsenin "Teslim edildi"ye basmadığı
yüzlerce eski sipariş okumanın sınırını doldurup bugünün kartlarını
gizleyemez.

## Uçlar

Karaoke bağlantısının imzası (`x-laf-timestamp`,
`x-laf-signature: v1=<hex>`, `src/lib/panel/karaoke-sync-core.ts`) ve ortak
anahtarı (`KARAOKE_SYNC_SECRET`). Anahtar yoksa uç 503 döner, ping gitmez.

Kafenin kasası LafPOS okuma ve aşama uçlarını kendi anahtarıyla (`LAFPOS_SYNC_SECRET`) kullanır, `GET /api/pos/orders/version` değişince çeker: `docs/LAFPOS.md`.

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
   ```

   ```json
   {
     "version": 1,
     "now": "2026-10-22T12:00:00.000Z",
     "complete": true,
     "orders": [
       {
         "id": "ord-0042",
         "orderNo": 10042,
         "stage": "new",
         "fulfillment": "table",
         "label": "Masa 4",
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
             "qty": 2
           }
         ],
         "totalMinor": 24000,
         "path": "/admin/siparisler/ord-0042"
       }
     ]
   }
   ```

   - `fulfillment`: `table` | `pickup` | `delivery`; `label` sayacın dili
     ("Masa 4", "Gel-al", "Kurye"), sitenin sipariş zilindekiyle aynı
     (`orderAlertLabel`).
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
   - `path`: siparişin bu paneldeki sayfası; panel önüne sitenin adresini
     koyar.
   - Sıra: vakti en yakın olan önce (planlı saat, yoksa ödeme), sonra
     sipariş numarası.
   - En çok 200 sipariş; fazlası varsa `complete: false`. `complete`, ekrana
     kalanlardan değil okunan satırlardan sayılır: okuma dolu döndüyse
     (açık ya da teslime hazır siparişlerde 201 satır) `false`.
   - `Cache-Control: no-store`.

   | Durum | Gövde                        | Ne zaman                                |
   | ----- | ---------------------------- | --------------------------------------- |
   | 401   | `{"error":"unauthorized"}`   | İmza yok, yanlış ya da 5 dakikadan eski |
   | 503   | `{"error":"not_configured"}` | Anahtar yok                             |
   | 503   | `{"error":"unavailable"}`    | Veritabanı okunamadı (boş liste değil)  |

## Kişisel veri (KVKK)

Ekrana yalnız siparişi hazırlamak ve teslim etmek için gereken gider:
satırlar, seçenekleri ve satır notları, nereye gideceği, planlı saat,
müşterinin **yalnız adı** (gel-al'da seslenmek için; sitenin personel
e-postası ve karaoke bağlantısı da yalnız adı taşır) ve masa ya da gel-al
siparişinde üyenin notu (alerji, "şurupsuz"; personel e-postası da yalnız
bunu taşır). Soyad, e-posta, telefon, adres, kurye notu (kapı kodu: kurye
siparişinin notu hiç gitmez), ödeme referansı **asla** gitmez: alanlar
beyaz listeyle tek tek kurulur (`toPanelOrder`), tabloya sonradan eklenen
bir sütun kendiliğinden sızamaz. `tests/panel-orders-feed.test.ts` ve
`tests/db-integration-panel-feeds.test.ts` tutar.

## Panel ne zaman çeker

Pingde (geçici bir hatada 4 saniye sonra bir kez daha), ekran açılınca ya
da görünür olunca (son çekmeden 1 dakika geçtiyse), "Yenile" düğmesinde (en
sık 10 saniyede bir) ve ekran görünürken arka planda (ping kaçarsa diye):
sipariş varken 3 dakikada, sakinken saatte bir, son çekme hatalıysa
dakikada bir. Cron yok: siparişler anlıktır.

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

| `action`    | İzinli `from`        | Sipariş hareketi           | Düğme                                                         |
| ----------- | -------------------- | -------------------------- | ------------------------------------------------------------- |
| `preparing` | `new`                | `paid` → `preparing`       | Hazırlanıyor                                                  |
| `ready`     | `new`, `preparing`   | → `shipped`                | gel-al "Hazır", masa "Masaya götürüldü", kurye "Kuryeye verildi" |
| `delivered` | `ready` (yalnız gel-al) | `shipped` → `completed` | Teslim edildi                                                 |

- `from`, kartın gösterdiği aşamadır; hareket ona **koşulludur** (siparişin
  durumu hâlâ o aşamanın durumu olmalı). Eski ekrandan gelen dokunuş, ya da
  imzanın beş dakikası içinde tekrar gönderilen aynı istek, siparişi ikinci
  kez ilerletmez: 409 alır.
- `actor` panel kullanıcısının adıdır (1-80 karakter); sitenin olay
  kaydına ve sipariş zaman çizelgesine "Yönetim paneli · Selin" olarak düşer
  (`panel:Selin`).

| Yanıt                                  | Ne zaman                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------ |
| 200 `{"order": …}`                     | Hareket yapıldı; `order` ekranın biçiminde (`toPanelOrder`), ekrandan kalktıysa `null` |
| 409 `{"error":"stale","order": …}`     | Sipariş bu arada değişti ya da dokunuş aşamasına uymuyor; `order` şimdiki hâli |
| 404 `{"error":"not_found"}`            | Böyle sipariş yok, ya da bar ekranının siparişi değil (mağaza, elle girilen) |
| 400 `{"error":"invalid","field"}`      | Gövde okunamadı ya da bir alan geçersiz                                   |
| 401 · 413 · 503                        | Diğer panel uçlarıyla aynı                                               |

Panele bu uçtan yeni kişisel veri gitmez: yanıt, okuma ucunun beyaz
listesidir (yalnız ad). Site: `src/app/api/panel/orders/stage/route.ts`,
`src/lib/panel/orders-stage-core.ts`; `tests/panel-orders-stage.test.ts`
tutar. Panel: `src/server/actions/site-orders.ts`,
`src/lib/site-orders/stage{,-request}.ts` (lafmaliyet `docs/SITE-SIPARIS.md`).
