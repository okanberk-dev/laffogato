# Online satışlar ↔ yönetim paneli: kâr-zarar ve kasa raporu

Köşkün iç panelinin (ladmin.laffogato.net, `RiosenBeq/lafmaliyet`) cirosu
kasanınkidir: ModPOS'un aylık ürün satışları panele yapıştırılır, kâr-zarar
(Genel Maliyet) ve tutarlılık ekranı oradan hesaplanır. Sitenin aldığı
para - uygulama ve web kafe siparişleri, mağaza kolileri, ön ödemeli
karaoke - kasadan geçmediği için panelin hiçbir rakamında yoktu; uygulama
siparişinin harcadığı süt ve kahve de tüketim kontrolünde eksik kalıyordu.

`GET /api/panel/sales` bir dönemin online satışını panele verir. Panel
bunu ayrı gelir satırları olarak kâr-zararına, kafe satırlarını menü
bağlantısıyla kendi ürünlerine eşleyerek tüketimine, günlük toplamı da
kasa raporuna ("bugün online: …, kasadan geçmez") ekler.

## Rakamlar Raporlar'ınkiyle aynı

Site kendi Raporlar ve Gün sonu ekranlarıyla aynı kuralla sayar
(`src/lib/panel/sales-export-core.ts`):

- **Sipariş**, ödenmiş ve sonrası (`isReportableOrder`: `pending_payment`
  ve `cancelled` sayılmaz) ve dönemin bir İstanbul gününde **verilmişse**
  (`createdAt`) sayılır. İadeler siparişin kendi netinden düşer, sipariş
  başına toplamıyla sınırlı (`headlineFrom`). Sonradan gelen iade, siparişin
  verildiği ayın netini düşürür: panel kapanmış ayı da yeniden çekebilir.
- **Karaoke**, parasının alındığı gün (`paidAt`) sayılır; köşkte kalan,
  geç iptalin iade edilmeyen payı dahil (`karaokeMoneyOf`,
  `karaokeRevenueFrom` ile aynı fonksiyon). İadesi başlamış ama dönmemiş
  para kalanın içindedir ve ayrıca söylenir (`refundPendingMinor`).
- **Panelden elle girilen sipariş** (`source: "manual"`, telefonla alınıp
  kasada ödenen) kasanın cirosunda zaten var: `cafe` ve `shop`'a girmez,
  yalnız `manual` altında sayılır.
- **Kasada kapatılan uygulama / web siparişi** (`counter`, 23 Eki 2026):
  kart ödemesi düşen sipariş panelde "Ödendi olarak işaretle" ile nakit ya
  da kasadaki kart cihazıyla kapatılınca kaynağı `app` / `web` kalır ama
  parası kasadan (ModPOS; geçişten sonra LafPOS) geçmiştir (fişi kasanın ÖKC
  fişidir). Siparişin başarılı ödeme kayıtları (`payment_transactions`,
  e-Arşiv planının okuduğu `paymentsFor`) arasında `manual:nakit` ya da
  `manual:kart` varsa sipariş `cafe`, `shop` ve `cafe.lines`'a girmez, yalnız
  `counter` altında sayılır (`paidAtTill`). Kart ödemesinin başarısız
  denemesi bunu değiştirmez.
  - `manual:havale` (havale / EFT) **online** kalır: para bankaya gelir,
    kasadan geçmez, kasada (ModPOS; geçişten sonra LafPOS) yoktur; faturası
    da e-postayla gider (`receiptInvoiceNote`). `cafe` / `shop` ve satırlarda
    sayılır.
  - `manual:diger` de **online** kalır: panel bu yolu adlandırmaz, kasada
    olduğunu bilemeyiz; kasaya girmesi gereken para "Nakit" ya da "Kasadaki
    kart cihazı" ile işaretlenir. Kasada alınıp "Diğer" seçilirse çift
    sayılır ve işaret sonradan değiştirilemez (ödeme kaydı yazıldığı gibi
    kalır, "Ödendi" geri alınmaz): seçim işaretlerken doğru yapılmalı.
  - Panelden elle girilen sipariş hangi yolla ödenirse ödensin `manual`'da
    kalır (önceki kural, değişmedi).
- Gün sınırı köşkün gece yarısıdır (CLAUDE.md kural 22).

Raporlar ve Gün sonu bu ayrımı yapmaz: `cafe + shop + manual + counter`
onların rakamıdır. `tests/panel-sales-export.test.ts` aynı veride
Raporlar'ın aylık rakamı ve Gün sonu'nun günlük rakamıyla bu eşitliği
sabitler.

## KDV

Tutarlar KDV dahildir. `kdvMinor`, ödenen ve köşkte kalan tutarın içindeki
**faturanın** KDV'sidir:

- Her satır satıldığı oranla (`items[].taxRatePct`), kurye / kargo ücreti
  kendi oranıyla (`shippingTaxRatePct`, %20) ayrılır (`orderKdvBreakdown`).
- **Ödül kuponu iskonto değildir** (damga, kilometre taşı, davet; ya da
  ürünlerin hepsini karşılayan kupon): fatura ürünleri tam fiyatla keser,
  KDV de tam fiyattan doğar (`invoiceKdvBreakdown`, siparişler CSV'sinin
  fatura dökümüyle aynı). Ödül kuponuyla bedava verilen içeceğin KDV'si
  bu yüzden ödenen tutardan büyük olabilir; KDV hariç geliri eksi çıkar,
  bu doğrudur.
- Kısmi iadede KDV, kalan tutar oranında paylaştırılır.
- Satırları oran taşımayan eski sipariş (17 Eki 2026 öncesi) tahmin
  edilmez: neti `unknownKdvNetMinor`'a yazılır, panel kendi varsayılan
  oranıyla ayırır.
- Karaoke rezervasyonunun oranı rezervasyonda saklıdır (`taxRatePct`);
  yoksa aynı şekilde `unknownKdvNetMinor`.

### Kafe satırlarının seçenekleri (23 Eki 2026)

Uygulama siparişinin satırı seçimlerini taşır (`items[].options`,
`docs/API-MOBILE.md` §3, `src/lib/mobile/customization.ts`). Satırlar
yine menü kalemi × boy olarak gruplanır; seçimler satırın içinde, yapılan
adetle çarpılarak sayılır (v1'e ekleme, isteğe bağlı alanlar):

- `extraShots`: `extraShot: true` olan adet. Satırda en çok bir ekstra shot
  seçilir, yani sayı shot sayısıdır.
- `milks`: `lactose-free`, `oat`, `almond`. `normal` sayılmaz: tarifin kendi
  sütüdür, sütsüz içecekte (Americano) de varsayılan odur.
- `syrups`: `vanilla`, `caramel`, `hazelnut`. `none` sayılmaz.

Hiçbiri yoksa alan **hiç yoktur** (boş nesne ya da 0 değil): seçeneksiz
satırın biçimi eskisiyle aynıdır. Kavurma (`roast`), şeker ve not
gönderilmez. Bilinmeyen kimlik sayılmaz.

Panel bu sayıları okur (lafmaliyet #18, `docs/SITE-SATIS.md` ›
Seçenekler) ve kasada ayrı satır olarak çalınan ürünlere verir: `extraShots`
"Extra Shot"a, `syrups` "Syrup"a (önce sitenin `mnu-0081` / `mnu-0080`
kalemine bağlı panel ürünü, yoksa adı tutan ürün), `milks`'in bütün
seçenekleri tek "Alternatif Süt" ürününe. Alternatif süt normal sütü
azaltmaz (kasadaki gibi); ürünü olmayan seçenek panelde "panelde ürünü yok"
diye listelenir. Panel bu alanları **katı** okur: eksi ya da kesirli bir
sayı, 40 karakterden uzun kimlik ya da 20'den fazla seçenek bütün ayın
yanıtını reddettirir; alanı göndermemek her zaman güvenlidir.

## Uç

Karaoke bağlantısının imzası ve ortak anahtarı (`KARAOKE_SYNC_SECRET`,
`docs/PANEL-KARAOKE.md`). Sorgu dizesi imzanın içindedir: imzalanandan
başka bir ay istenemez.

```
GET https://laffogato.net/api/panel/sales?month=2026-10
GET https://laffogato.net/api/panel/sales?from=2026-10-22&to=2026-10-22
```

`month=YYYY-MM` ya da `from` + `to` (İstanbul günleri, ikisi de dahil, en çok
31 gün). İkisi birden, eksik ya da bozuk dönem 400.

```json
{
  "now": "2026-11-02T09:00:00.000Z",
  "version": 1,
  "from": "2026-10-01",
  "to": "2026-10-31",
  "closed": true,
  "cafe": {
    "orders": 412,
    "grossMinor": 6230000,
    "discountMinor": 81000,
    "deliveryMinor": 95000,
    "refundedMinor": 24000,
    "netMinor": 6206000,
    "kdvMinor": 571200,
    "unknownKdvNetMinor": 0,
    "lines": [
      {
        "menuItemId": "mnu-0003",
        "size": "M",
        "name": "Latte",
        "qty": 230,
        "listMinor": 2760000,
        "extraShots": 18,
        "milks": { "oat": 41, "lactose-free": 7 },
        "syrups": { "vanilla": 12 }
      },
      {
        "menuItemId": "mnu-0020",
        "size": "single",
        "name": "Cheesecake",
        "qty": 15,
        "listMinor": 225000
      }
    ]
  },
  "shop": {
    "orders": 9,
    "grossMinor": 449100,
    "discountMinor": 0,
    "deliveryMinor": 44100,
    "refundedMinor": 0,
    "netMinor": 449100,
    "kdvMinor": 44172,
    "unknownKdvNetMinor": 0
  },
  "karaoke": {
    "bookings": 21,
    "collectedMinor": 2150000,
    "refundedMinor": 100000,
    "netMinor": 2050000,
    "refundPendingMinor": 0,
    "kdvMinor": 341667,
    "unknownKdvNetMinor": 0
  },
  "manual": { "orders": 3, "grossMinor": 96000, "netMinor": 96000 },
  "counter": {
    "orders": 2,
    "grossMinor": 36000,
    "discountMinor": 0,
    "deliveryMinor": 0,
    "refundedMinor": 0,
    "netMinor": 36000,
    "kdvMinor": 3273,
    "unknownKdvNetMinor": 0
  }
}
```

| Alan                 | Anlamı                                                                          |
| -------------------- | ------------------------------------------------------------------------------- |
| `closed`             | Dönemin son günü köşkte bitti; rakamlar yalnız sonradan gelen iadeyle değişir   |
| `orders`             | Sayılan sipariş                                                                 |
| `grossMinor`         | Siparişlerin toplamı (KDV dahil), iade düşülmeden                               |
| `discountMinor`      | Promosyon ve kupon indirimi; `grossMinor`'dan zaten düşülmüş                    |
| `deliveryMinor`      | Kurye / kargo ücreti; `grossMinor`'un içinde                                    |
| `refundedMinor`      | İadeler, sipariş başına toplamıyla sınırlı                                      |
| `netMinor`           | `grossMinor − refundedMinor`: köşkte kalan, KDV dahil                           |
| `kdvMinor`           | `netMinor`'un içindeki faturanın KDV'si (oranı bilinen siparişlerden)           |
| `unknownKdvNetMinor` | Oranı saklı olmayan siparişlerin neti                                           |
| `lines`              | Yapılan kafe satırları: iptal edilmeyen, tamamen iade edilmemiş siparişlerin    |
| `lines[].size`       | `L` kalemin L fiyatına (`siteMenuSlot = L`), `M` ve `single` ilk fiyatına (`M`) |
| `lines[].listMinor`  | Birim fiyat (seçenekler dahil) × adet: indirim ve iade düşülmeden, bilgi için   |
| `lines[].extraShots` | Ekstra shot'lı yapılan adet (adet başına bir shot); yoksa alan yok              |
| `lines[].milks`      | Tarifin sütü yerine başka sütle yapılan adet, süt kimliğine göre; yoksa yok     |
| `lines[].syrups`     | Şurupla yapılan adet, şurup kimliğine göre; yoksa alan yok                      |
| `karaoke.bookings`   | Parasının bir kısmı köşkte kalan rezervasyon                                    |
| `counter`            | Kasada nakit ya da kasa kartıyla kapatılan uygulama / web siparişi; satırsız    |

KDV hariç gelir: `netMinor − kdvMinor − unknownKdvNetMinor × r / (100 + r)`
(`r` panelin varsayılan oranı).

`counter` 23 Eki 2026'da eklendi (v1'e ekleme; `version` 1 kalır). Daha
önce bu siparişler `cafe` / `shop`'ta ve `cafe.lines`'ta da sayılıyordu:
para hem kasada (ModPOS) hem "Kafe online"da, KDV iki kez, içecekler
tutarlılıkta iki kez. Artık `cafe` ve `shop` belgelendikleri anlamı
("kasadan geçmez") taşır; panel hiçbir şey çıkarmaz. `counter` bilgi
içindir: kâr-zarara ve tüketime **eklenmez** (kasada, ModPOS'ta; geçişten
sonra LafPOS'ta zaten var). Eski panel alanı tanımaz ve yok sayar; onun
gördüğü düzelme, çift sayımın kalkmasıdır.

### Şube kırılımı (21 Kas 2026)

Sipariş 21 Kasım 2026'dan beri bir şubenindir (`orders.branch`,
`docs/PANEL-ORDERS.md` "Şube"): masa siparişi masanın şubesi (Marina'nın
LafPOS'unun bastığı kartla verilen sipariş Marina'nın parası), öteki her
sipariş Tuzla; karaoke odası Tuzla'nın. v1'e ekleme, `version` 1 kalır:

- `&branch=tuzla|marina` (imzalı sorgunun parçası) bütün yanıtı o şubenin
  siparişlerine daraltır; mağaza ve karaoke yalnız Tuzla'nın yanıtında.
  Yanıt `branch`'i söyler. Bozuk ya da bilinmeyen şube 400 `{"error":
  "invalid","field":"branch"}`.
- `branch` yoksa toplamlar eskisi gibi **her şubenin**dir (`branch: null`),
  yanında `byBranch`: şube başına `cafe` (satırsız toplamlar), `counter` ve
  `manual`. Eski panel alanı yok sayar; bugün Marina'nın masa siparişi yoksa
  rakamlar değişmez.
- lafmaliyet'in kasa raporundaki "laffogato.net" satırı ve Tuzla kâr-zararı
  `branch=tuzla` istemelidir: Marina'nın QR siparişi Tuzla'ya yazılmasın
  (lafmaliyet `fetchTillOnlineRow`, şubesiz).

```json
{
  "branch": null,
  "byBranch": {
    "tuzla": { "cafe": { "orders": 400, "grossMinor": 6100000, "…": 0 }, "counter": { "…": 0 }, "manual": { "orders": 3, "grossMinor": 45000, "netMinor": 45000 } },
    "marina": { "cafe": { "orders": 12, "grossMinor": 130000, "…": 0 }, "counter": { "…": 0 }, "manual": { "orders": 0, "grossMinor": 0, "netMinor": 0 } }
  }
}
```

| Durum | Gövde                         | Ne zaman                                             |
| ----- | ----------------------------- | ---------------------------------------------------- |
| 400   | `{"error":"invalid_range"}`   | Dönem bozuk, 31 günden geniş, ya da iki biçim birden |
| 400   | `{"error":"invalid","field":"branch"}` | `branch` bozuk ya da bilinmeyen şube        |
| 401   | `{"error":"unauthorized"}`    | İmza yok, yanlış ya da 5 dakikadan eski              |
| 422   | `{"error":"range_too_large"}` | Dönemde 20 000'den çok sipariş: gün gün sorulmalı    |
| 503   | `{"error":"not_configured"}`  | Anahtar yok                                          |
| 503   | `{"error":"unavailable"}`     | Veritabanı okunamadı (sıfırlı bir ay değil)          |

Eksik cevap yoktur: kâr-zararı sessizce eksik bir ay, panelin yeniden sorduğu
bir aydan kötüdür.

## Kişisel veri (KVKK)

Yalnız toplamlar ve ürün satırları: müşteri adı, e-postası, telefonu, adresi,
sipariş numarası gitmez.

## Panel ne yapar

Panel tarafı (`RiosenBeq/lafmaliyet` `docs/SITE-SATIS.md`):

- **Ne zaman:** günlük cron her gün bulunulan ayı ve önceki iki ayı çeker
  (`salesMonthsToPull`; geç iadeler düşsün); Gelir-gider'deki "Siteden
  yenile" aynı üç ayı sorar, daha eskisi için "Başka bir ay". Ay başına tek kayıt (`integration_state`, `site_sales:YYYY-MM`);
  yeniden çekmek üzerine yazar. 422 (`range_too_large`) panelde hata olarak
  görünür, gün gün yeniden sorulmaz.
- **Kâr-zarar:** ModPOS cirosunun altında üç ayrı gelir satırı, KDV hariç:
  "Kafe online (site + uygulama)", "Mağaza (online)", "Karaoke (ön
  ödemeli)"; ardından "TOPLAM CİRO (KDV hariç)" = ModPOS (KDV hariç) +
  online. Kâr / zarar ve oranlar bu toplamla hesaplanır. ModPOS cirosu ve
  POS komisyonu değişmez. Hiç çekilmemiş ay boş kalır, 0 görünmez.
- **Tüketim:** kafe satırları menü bağlantısıyla ürünlere eşlenip
  tutarlılıkta ayrı bir kaynak olarak ("ModPOS · online") tüketime girer
  (satırın `extraShots` / `milks` / `syrups` sayıları yukarıdaki seçenek
  ürünlerine); bağlı ürünü olmayan satır listelenir. Panelin satış raporuna
  (`sales_lines`) yazılmaz.
- **Kasada kapatılan sipariş:** `counter` kâr-zarara, tüketime ve kasa
  raporunun online satırına eklenmez; panel isterse "kasada kapatılan
  online sipariş" olarak bilgi diye gösterir.
- **Kasa raporu:** sayfada ve e-postada bilgi satırı, "Online (site +
  uygulama) … · Karaoke ön ödeme … — kasadan geçmez" (kafe + mağaza netini
  ve karaokeyi KDV dahil gösterir); kasa farkına girmez, saklanmaz. Site
  ulaşılamazsa ya da yavaşsa satır yoktur, rapor beklemez. Sitenin günü
  gece yarısı, kasanınki 05:00'te biter: gece yarısından sonraki sipariş
  ertesi günün satırındadır.
