# Siparişler ↔ yönetim paneli: bar ekranı

Köşkün iç paneli (ladmin.laffogato.net, `RiosenBeq/lafmaliyet`) barda hep
açık duran bir ekrandır: karaoke odasını sayar ve yeni rezervasyonda çalar
(`docs/PANEL-KARAOKE.md`). Operatörün isteği (22 Eki 2026): _"laffogato
admin ile lafmaliyette paralel çalışabilecek neler varsa ... beraber
çalışsın"_. Uygulamadan (ve web'den) gelen, ödenmiş kafe siparişi de bu
ekrana düşer: barista siparişi orada görür, ekran çalar, sipariş burada
ilerletilince ekrandan kalkar.

## Kural: salt okuma

- Sipariş verisinin tek kaynağı sitedir (`orders`). Panel kopya tutmaz,
  her çekmede açık siparişlerin listesini baştan alır.
- Panel siparişi **ilerletmez**: "Hazırlanıyor", "Teslime hazır",
  "Tamamlandı" ve iade bu panelde (`/admin/siparisler/<id>`) yapılır; ekran
  her siparişte oraya giden bağlantıyı (`path`) taşır. Geri yazma bilerek
  yok: sipariş makinesi ödeme, stok, sadakat ve e-postayı birlikte yürütür,
  ikinci bir yazan onu bölerdi.
- Kasada (ModPOS) bu siparişler **çalınmaz**: parası sanal POS'tan
  (PayNkolay) ya da cüzdandan alınmıştır. Kasanın cirosu ile sitenin cirosu
  ayrı kalır; panel ikisini `docs/PANEL-SALES.md` ile toplar.

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
geriye bakar.

## Uçlar

Karaoke bağlantısının imzası (`x-laf-timestamp`,
`x-laf-signature: v1=<hex>`, `src/lib/panel/karaoke-sync-core.ts`) ve ortak
anahtarı (`KARAOKE_SYNC_SECRET`). Anahtar yoksa uç 503 döner, ping gitmez.

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
         "paidAt": "2026-10-22T11:55:00.000Z",
         "lines": [
           {
             "menuItemId": "mnu-0003",
             "name": "Latte",
             "size": "M",
             "detail": "M · yulaf · +1 shot",
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
   - `path`: siparişin bu paneldeki sayfası; panel önüne sitenin adresini
     koyar.
   - Sıra: vakti en yakın olan önce (planlı saat, yoksa ödeme), sonra
     sipariş numarası.
   - En çok 200 sipariş; fazlası varsa `complete: false`.
   - `Cache-Control: no-store`.

   | Durum | Gövde                        | Ne zaman                                |
   | ----- | ---------------------------- | --------------------------------------- |
   | 401   | `{"error":"unauthorized"}`   | İmza yok, yanlış ya da 5 dakikadan eski |
   | 503   | `{"error":"not_configured"}` | Anahtar yok                             |
   | 503   | `{"error":"unavailable"}`    | Veritabanı okunamadı (boş liste değil)  |

## Kişisel veri (KVKK)

Ekrana yalnız siparişi hazırlamak ve teslim etmek için gereken gider:
satırlar ve seçenekleri, nereye gideceği, planlı saat ve müşterinin **yalnız
adı** (gel-al'da seslenmek için; sitenin personel e-postası ve karaoke
bağlantısı da yalnız adı taşır). Soyad, e-posta, telefon, adres, kurye
notu (kapı kodu), ödeme referansı **asla** gitmez: alanlar beyaz listeyle
tek tek kurulur (`toPanelOrder`), tabloya sonradan eklenen bir sütun
kendiliğinden sızamaz. `tests/panel-orders-feed.test.ts` ve
`tests/db-integration-panel-feeds.test.ts` tutar.

## Panel ne zaman çeker

Pingde, ekran açılınca ya da görünür olunca (son çekmeden 1 dakika
geçtiyse) ve birkaç dakikada bir arka planda (ping kaçarsa diye). Panel
yeni bir `new` siparişi (`id`'sini daha önce görmediği) çalar; masa
siparişi önce ve daha yüksek sesle (sitenin zil kuralı,
`order-alerts-core.ts`). Panel tarafı: `RiosenBeq/lafmaliyet`
`docs/SITE-SIPARIS.md`.
