# Menü ↔ yönetim paneli bağlantısı

Kafe menüsü iki yerde yaşıyor: sitedeki **Kafe menüsü** (`menu_items`,
`/admin/menu`; site, `/masa/<kod>` QR menüsü ve uygulama buradan okur) ve
köşkün iç panelindeki ürünler (ladmin.laffogato.net, `RiosenBeq/lafmaliyet`,
`products`; maliyet, reçete, zayi/ikram ve panelin kendi QR menüsü buradan
okur). Operatörün isteği (21 Eki 2026): _"bir yerden pasif yapınca veya fiyat
değişince diğer yerlerden de değişsin"_.

## Kural: tek doğru kaynak sitedir

- Bir kalemin **satış fiyatı** ve **menüde görünüp görünmediği** sitede
  tutulur. Panel, siteye **bağlı** ürünlerinde bu iki bilginin kopyasını
  taşır ve kendi hesaplarında (maliyet yüzdesi, ikram değeri, QR menü) onu
  kullanır.
- Panelde bağlı bir ürünün fiyatı ya da menü durumu değişince panel değişikliği
  **önce siteye** gönderir, site kabul edince kendisi yazar. Site
  ulaşılamazsa panel değişikliği kaydetmez ve bunu söyler ("Siteye
  ulaşılamadı; fiyat değişmedi"): iki yer kalıcı olarak ayrışmaz.
- Ama iki yer **aynı anda** değişebilir: panelin kopyası bir ping kaçınca
  eskir, sitenin formu da başka bir sekme ya da panel değiştirdikten sonra
  açık kalmış olabilir. Eski görüntüden yapılan yazım yenisini ezmesin diye
  iki yol da gördüğünü taşır ve site yalnız o hâlâ geçerliyse yazar: panel
  `expect` gönderir (aşağıda "Çakışma: `expect` ve 409 `stale`"), sitenin
  formu yüklediği değerleri ("Sitenin formu"). Bağlantıların kısa haritası:
  `docs/PANEL-SENKRON.md`.
- Sitede değişen bir kalem panele **ping** ile bildirilir, panel yeni
  değerleri **çeker** (karaoke bağlantısıyla aynı düzen,
  `docs/PANEL-KARAOKE.md`).
- Ad, açıklama, kategori, sıra, görsel, alerjen sitede; reçete, maliyet,
  fire panelde kalır: **eşitlenmez** (iki tarafın adları bilerek farklı:
  site müşteriye Türkçe yazar, panel tedarik ve kasa adlarını kullanır).

## Eşleştirme panelde tutulur

İki tarafın modeli farklı: sitede bir kalem iki boy fiyatı taşır
(`priceMinor` = M ya da tek fiyat, `priceMinorL` = L, `0` tek boy demek),
panelde her boy ayrı bir satırdır (ad + boy benzersiz). Bu yüzden eşleştirme
panelin ürün satırında durur:

| Panel `products` sütunu | Anlamı                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `siteMenuId`            | Sitedeki kalemin kimliği (`mnu-0011`), bağlı değilse `null`                                |
| `siteMenuSlot`          | Bu satır sitedeki hangi fiyat: `M` = `priceMinor` (tek boyda tek fiyat), `L` = `priceMinorL` |

`(siteMenuId, siteMenuSlot)` panelde benzersizdir. Bağlı olmayan ürün yalnız
paneldedir (Su, Damla Soda gibi), sitede olup panelde bağlısı olmayan kalem
yalnız sitededir. Yeni kalem iki yanda da elle açılır: bağlantı ürün
**oluşturmaz**, panelin eşleştirme ekranı iki yandaki eşsizleri listeler.

Bağlama anında sitedeki değer geçerli olur (panel ürünün fiyatını ve menü
durumunu sitedekine çeker). Panelin fiyatı istenirse bağladıktan sonra panelde
fiyat değiştirilir; değişiklik siteye gider.

## Değerlerin karşılığı

- **Fiyat:** site kuruş tamsayı, panel TL. Panel → site: `Math.round(TL * 100)`;
  site → panel: `kuruş / 100`. İkisi de KDV dahil.
- **Menüde mi:** sitede `isActive` ("Satışta" / "Tükendi"). Panelde iki bayrak
  var: `active` (ürün yaşıyor; kapalıysa maliyet analizinden, reçete
  defterinden ve zayi ekranından da düşer) ve `showOnMenu` (QR menüde göster).
  - Site → panel: `isActive = false` panelde `showOnMenu = false` yapar,
    `active`'e **dokunmaz** (tükenen kalem geçicidir, analizden düşmemeli).
    `isActive = true` panelde `showOnMenu = true` ve `active = true` yapar
    (sitede satılan şey panelde emekli olamaz).
  - Panel → site: `active && showOnMenu` sitede `isActive` olur. Ürünü
    panelde "pasif" yapmak da, QR menüden kaldırmak da sitede "Tükendi"dir.
  - Bir site kalemine bağlı iki panel satırı (M ve L) aynı `isActive`'i
    paylaşır: birini menüden kaldırmak kalemi sitede gizler; panel öbür
    satırı aynı yazımda, sitenin yanıtındaki kalemle `showOnMenu = false`
    yapar (lafmaliyet `applyPushed`). Boy boy satış durumu sitede yok.
- **L fiyatı silinirse** (`priceMinorL = 0`) panelde `L` yuvasına bağlı satır
  "bağlantı kopuk" olarak işaretlenir, fiyatına dokunulmaz.
- **Kalem sitede silinirse** panel o satırların bağlantısını kaldırır ve
  eşitleme durumunda söyler.
- **Menü kimlikleri yeniden kullanılmaz.** `mnu-NNNN` atomik sayaçtan gelir
  (`createMenuItem` → `next_seq('mnu')`); silinen kalemin numarası bir daha
  verilmez. Panelin bağı, satış listesindeki satırlar ve LafPOS'un ürünü
  kimlikle durur: yeniden kullanılan bir kimlik eski bağı habersizce başka
  bir içeceğe bağlardı. Kalemi silip aynı adla yeniden açmak yeni kimlik
  verir; panelde bağ elle yeniden kurulur.

## Uçlar

Hepsi karaoke bağlantısının imzasını kullanır (`x-laf-timestamp`,
`x-laf-signature: v1=<hex>`, `src/lib/panel/karaoke-sync-core.ts`; ortak
anahtar `KARAOKE_SYNC_SECRET`, adı tarihsel: sitenin panelle **bütün**
bağlantısının anahtarıdır). Anahtar yoksa uçlar 503 döner, ping gitmez.

Kafenin kasası LafPOS okuma ve yazma uçlarını kendi anahtarıyla (`LAFPOS_SYNC_SECRET`) kullanır, yazımları olay kaydına `lafpos:<ad>` diye düşer; LafPOS'un anahtarı yalnız satış durumunu (`isActive`) yazar, fiyat yazımı 403 `forbidden`: `docs/LAFPOS.md`.

1. **Ping (site → panel).** `pub:menu` etiketini düşüren her yazım
   (`menu_items`) yanıttan sonra panele imzalı tek bir istek gönderir:

   ```
   POST https://ladmin.laffogato.net/api/menu/ping
   {"event":"menu.changed","at":"2026-10-21T10:00:00.000Z"}
   ```

   Gövdede kalem yok. Aynı istekteki ardışık yazımlar tek pinge biner, panel
   ulaşılamazsa bir kez daha denenir, yazım bundan asla etkilenmez.

2. **Okuma (panel → site).**

   ```
   GET https://laffogato.net/api/panel/menu
   GET https://laffogato.net/api/panel/menu?branch=marina
   ```

   ```json
   {
     "version": 1,
     "now": "2026-10-21T10:00:00.000Z",
     "branch": "tuzla",
     "items": [
       {
         "id": "mnu-0011",
         "name": "Espresso Macchiato",
         "categoryKey": "espresso",
         "categoryLabel": "Espresso",
         "priceMinor": 14000,
         "priceMinorL": 0,
         "isActive": true,
         "onMenu": true,
         "sortOrder": 6,
         "updatedAt": "2026-10-20T08:00:00.000Z"
       }
     ],
     "writes": { "expect": true, "branch": true }
   }
   ```

   21 Kasım 2026'dan beri okuma **bir şubenindir** (aşağıda "Şube"):
   `isActive` o şubede satılıyor mu, `onMenu` sitenin kendi "Menüde" bayrağı
   (her şube), `updatedAt` kalemin ve şubenin kendi damgasından geç olanı;
   `branch` hangi şube olduğunu söyler. `?branch=` yoksa çağıranın şubesi:
   panel Tuzla, LafPOS `LAFPOS_BRANCHES` (varsayılan Marina).

   Bütün kalemler, satışta olmayanlar da (panel bağlıyı gizlemek için onu da
   görmeli). `writes` yazma ucunun ilk sürümden sonra kabul ettiği isteğe
   bağlı alanların duyurusudur (yetenek bayrağı, 28 Eki 2026): yazma şeması
   katı olduğundan bilinmeyen alan 400'dür, panel `expect`'i ancak son
   çekmesinde `writes.expect` gördüyse gönderir. Yeni bir isteğe bağlı alan
   aynı değişiklikte buraya eklenir; `version` değişmez. `Cache-Control: no-store`. Site veritabanından yalnız yanıtın
   sekiz sütununu okur (`listMenuItemsForPanel`; `categoryLabel` sitenin
   kendi etiketidir), fotoğrafları (`image`, kalem başına 2 MB'a kadar data
   URL) hiç okumaz; yazma ucu da öyle. `now` okumadan **önce** alınır
   (sipariş ucu gibi): okuma sürerken başlayan bir yazımın `updatedAt`'i
   `now`'dan sonra düşer, liste o yazımdan yeni sayılmaz. Pencere daralır ama
   kapanmaz: `updatedAt` yazım veritabanına gitmeden sunucuda damgalanır;
   `now`'dan hemen önce damgalanıp okumadan sonra işlenen bir yazım
   (milisaniyeler) listede eski değeriyle görünebilir, panelin sonraki
   çekmesi düzeltir.

3. **Yazma (panel → site).**

   ```
   POST https://laffogato.net/api/panel/menu
   {"id":"mnu-0011","priceMinor":14500,"actor":"Selin"}
   ```

   `priceMinor`, `priceMinorL`, `isActive` alanlarından en az biri; olmayana
   dokunulmaz. Kurallar sitenin kendi formununkiyle aynı
   (`src/lib/panel/menu-link-core.ts`): fiyatlar kuruş tamsayı, M fiyatı
   0'dan büyük (0 ₺ bedava kahve demek), L `0` ise kalem tek boydur; üst
   sınır katalogunki (`CATALOG_MONEY_MAX_MINOR`). `actor` panel
   kullanıcısının adıdır (en çok 80 karakter), olay kaydına `panel:Selin`
   diye yazılır ve "Yönetim paneli · Selin" diye görünür (LafPOS'unki
   `lafpos:Selin`, "LafPOS · Selin"). İsteğe bağlı `expect` için aşağıdaki
   "Çakışma" bölümüne bak. Yanıt kalemin yeni hâli (`{"item": {...}}`,
   okumadaki biçim). Hatalar:

   | Durum | Gövde                            | Ne zaman                                                                   |
   | ----- | -------------------------------- | -------------------------------------------------------------------------- |
   | 400   | `{"error":"invalid","field"}`    | Alan kurala uymuyor ya da hiçbiri yok (`expect` bozuksa `field: "expect"`) |
   | 401   | `{"error":"unauthorized"}`       | İmza yok, yanlış ya da 5 dakikadan eski                                    |
   | 400   | `{"error":"invalid","field":"branch"}` | `branch` bozuk ya da sitenin bilmediği bir şube                      |
   | 403   | `{"error":"forbidden","field"}`  | LafPOS'un anahtarıyla fiyat yazımı (`docs/LAFPOS.md`); `field: "branch"`: anahtarın şubesi değil |
   | 404   | `{"error":"not_found"}`          | Kalem sitede yok (silinmiş)                                                |
   | 409   | `{"error":"single_size"}`        | Kalem tek boy, istek L fiyatı veriyor                                      |
   | 409   | `{"error":"stale","item":{...}}` | `expect` tutmuyor: alan sitede bu arada değişti; `item` güncel             |
   | 409   | `{"error":"site_closed","item":{...}}` | LafPOS menüden kalkmış (`onMenu: false`) kalemi açmak istedi; hiçbir şey yazılmadı |
   | 413   | `{"error":"too_large"}`          | Gövde 4 KB'tan büyük                                                       |
   | 503   | `{"error":"not_configured"}`     | Anahtar yok                                                                |
   | 503   | `{"error":"unavailable"}`        | Veritabanı okunamadı ya da yazılamadı                                      |

   **L boyunu yalnız site açar** (23 Eki 2026). Kalem sitede tek boyken
   (`priceMinorL` 0) `priceMinorL > 0` taşıyan istek 409 `single_size` ile
   reddedilir ve hiçbir alanı yazılmaz (aynı istekteki M fiyatı da): panelin
   kopyası bayatken işletmecinin sitede kapattığı L boyu panelden yeniden
   açılamaz. `priceMinorL` göndermeyen ya da `0` gönderen istek, L'si açık
   kalemin L fiyatını değiştiren istek eskisi gibi geçer; işletmeci L'yi bu
   arada sitede açtıysa istek de geçer. Panel 2xx dışı her yanıtı ret sayar
   ve değişikliği kaydetmez; sonraki çekmede L yuvası "bağlantı kopuk" olur.

   Site yazımı yalnız bu üç sütuna yapar (`setMenuItemSaleFields`, tek UPDATE),
   olay kaydına yazar ve `pub:menu` önbelleğini düşürür: sitenin menüsü ve
   `/masa` QR menüsü yeni fiyatı hemen gösterir; uygulamanın menü yanıtı
   CDN'de en çok 2 dakika eski kalır (`s-maxage=60`,
   `stale-while-revalidate=60`, 6 Kas 2026; üstüne uygulamanın kendi önbelleği,
   `docs/API-MOBILE.md` "Tazelik penceresi"). Yazım ping de üretir; panel
   çektiğinde değerler zaten aynıdır, döngü olmaz.

### Çakışma: `expect` ve 409 `stale` (28 Eki 2026)

Panelin site kopyası eski olabilir (ping kaçtı, kart çekmeden önce açıldı).
Eski kopyadan yapılan yazım, işletmecinin sitede az önce yaptığı fiyatı ya da
Tükendi'yi geri alırdı. Bu yüzden panel, site `writes.expect` duyurduysa
yazdığı her alanın kopyasındaki değerini `expect` olarak gönderir
(lafmaliyet `src/lib/site-menu/push.ts` `buildPushBody`):

```
POST https://laffogato.net/api/panel/menu
{"id":"mnu-0011","priceMinor":14500,"actor":"Selin","expect":{"priceMinor":14000}}
```

`expect` `{priceMinor?, priceMinorL?, isActive?}`; değerler kuruş tamsayı
(0 dahil: kopyada okunan değerdir, yeni fiyat değil) ve boolean. Site sırayla:

1. Gövdeyi ayrıştırır (bozuk `expect` → 400 `field: "expect"`; panel bunu,
   bayrağı duyurup geri alınmış bir sitenin `field: "body"`'si gibi, bir kez
   `expect`'siz yeniden dener).
2. Kalemi okur (yoksa 404 `not_found`).
3. L boyu açma kuralı (409 `single_size`).
4. Yalnız **değişen** alanları bulur. Değişen alan yoksa bugünkü gibi 200 ve
   kalem (eski `updatedAt`) döner, `expect`'e bakılmaz: panelin "zaten
   tükendi" dalı buna dayanır.
5. Değişen bir alanın `expect`'i sitedekini tutmuyorsa hiçbir şey yazılmaz:
   **409** `{"error":"stale","item":{...}}`, `item` kalemin şimdiki hâli
   (okumadaki biçim). Panel o an menüyü yeniden çeker ve "Bu ürün sitede bu
   arada değişti" der. Yalnız yazılacak alanların `expect`'i denetlenir;
   L okumadaki gibi karşılaştırılır (tek boy 0).
6. Tutuyorsa UPDATE, `expect`'i olan sütunlara koşulludur (okunan değerde
   kaldıysa). Okuma ile yazım arasına başka bir yazım girdiyse satır
   etkilenmez ve yanıt yine 409 `stale` (güncel kalemle); kalem bu arada
   silindiyse 404.

`expect`'siz istek (eski panel, LafPOS) bugünkü gibi koşulsuz yazılır.
Kurallar `staleSaleFields` ve `saleWriteGuard`'da
(`src/lib/panel/menu-link-core.ts`), testleri `tests/panel-menu-link.test.ts`
ve `tests/db-integration-panel-menu.test.ts`.

### Sitenin formu (28 Eki 2026)

`/admin/menu/<id>/duzenle` formu kalemin fiyatlarını ve "Menüde göster"ini
açıldığı andaki değerleriyle taşır (gizli `loadedPriceMinor`,
`loadedPriceMinorL`, `loadedIsActive`; `src/lib/admin/menu-sale-guard.ts`).
Kaydederken (`updateMenuItem`):

- formda **dokunulmayan** satış sütunu UPDATE'e hiç girmez: form açıkken
  panelden, LafPOS'tan ya da başka bir sekmeden yapılan Tükendi ya da fiyat
  değişikliği yerinde kalır;
- **dokunulan** sütun yalnız satır hâlâ yüklenen değeri taşıyorsa yazılır
  (listedeki tek dokunuş ve toplu Tükendi'nin deseni). Taşımıyorsa kayıt
  bütünüyle reddedilir: "Bu kalem bu arada değişti (köşkün paneli, kasa ya
  da başka bir sekme); değişikliklerin kaydedilmedi. Sayfayı yenile."
- Ad, açıklama, görsel, etiket ve öteki alanlar bugünkü gibi yazılır.
  "Fiyat değişti" işareti (`menuPricesChangedAt`) yalnız bu kayıt bir fiyatı
  gerçekten yazdıysa düşer.

Bu değişiklik yayına çıkmadan önce açılmış bir sekme gizli alanları
göndermez; onun kaydı eskisi gibi bütün satırı yazar. Kurallar `tests/menu-sale-guard.test.ts`,
gerçek Postgres'e karşı `tests/db-integration-panel-menu.test.ts`.

## Şube: Satışta / Tükendi şubeye göre (21 Kas 2026)

Sahibin 4 Kasım 2026 kararı (lafmaliyet `docs/SUBE.md`): "Satışta / Tükendi"
şubeye göre değişir. Sitede kalem başına tek `isActive` vardı ve iki çağıran da
onu yazıyordu: Tuzla barının lafmaliyet'te "Tükendi"si Marina'nın kasasında
ürünü kilitliyor (LafPOS 403 `site_closed`), Marina'da porsiyonu biten ürün
Tuzla'nın uygulama ve QR menüsünden de kalkıyor, Marina müdürü Tuzla'nın
kapattığını açabiliyordu.

- **İki bayrak.** `menu_items."isActive"` kalemin **menüde** olup olmadığıdır
  (sitenin formu ve listesi yazar, her şube için birden). Şubenin kendi
  "Tükendi"si `menu_item_availability` satırındadır (`menuItemId`, `branch`,
  `isActive`, `updatedAt`, `updatedBy`; satır yoksa "Satışta"). Kalem bir
  şubede, menüdeyken ve o şubenin satırı (varsa) açıkken satılır
  (`src/lib/panel/menu-availability-core.ts`).
- **Şube** `src/lib/panel/branches.ts`: imzalı istek `branch` söyleyebilir
  (GET'te sorguda, POST'ta gövdede; ikisi de imzalı). Söylemezse çağıranın
  şubesi: panelin anahtarı Tuzla (her şube adına konuşabilir), LafPOS'unki
  `LAFPOS_BRANCHES` (varsayılan `marina`). Anahtarın konuşamadığı şube 403
  `forbidden` `field: "branch"`, bozuk ya da bilinmeyen 400.
- **Yazım.** `isActive` yalnız o şubenin satırını yazar (koşullu: okunan
  satırda kaldıysa, yoksa 409 `stale`). Fiyatlar her şubenindir, eskisi gibi
  kalemin sütunlarına yazılır. Menüden kalkmış (`onMenu: false`) kalemi açmak:
  panel kalemi menüye geri koyar (önceki yetkisi; şubenin kapalı satırını da
  açar), LafPOS 409 `site_closed` alır, hiçbir şey yazılmaz.
- **Okuma.** `isActive` şubenin gördüğü, `onMenu` sitenin bayrağı. `updatedAt`
  kalemin ve şubenin damgasından geç olanı: başka şubenin değişikliği bu şubenin
  damgasını oynatmaz (lafmaliyet'in Tükenenler kaydı `markerValid` buna bakar).
- **Müşteri yüzleri.** Site sayfaları ve uygulamanın `/menu`'sü Tuzla'nın
  satırını okur (uygulama Tuzla köşküne hizmet eder); `/masa/<kod>` masanın
  şubesininkini. Sipariş anındaki karar her zaman siparişin şubesine göredir:
  masa siparişi masanın şubesi, öteki her sipariş Tuzla (`resolveCafeLines`).
- **Sitenin paneli.** Kafe menüsü listesi menünün bayrağını gösterir ve
  menüdeki kalemin yanına şubelerin kendi Tükendi'sini yazar ("Marina:
  tükendi"). Listedeki tek dokunuşla Tükendi ve form eskisi gibi menünün
  bayrağını (her şube) yazar.
- Satır yazımı `pub:menu`'yu düşürür: ping, LafPOS'un menü işareti ve
  önbellekler kalemin kendi yazımındaki gibi.
- Fiyat hâlâ tek: şubeye göre satış fiyatı (aynı kararın ikinci yarısı) ayrı
  bir iştir; uygulamanın sipariş fiyatı ve sözleşmesi de değişir.

Testler `tests/sube/` (`npm run test:sube`; `TEST_DATABASE_URL` verilirse
gerçek Postgres'e karşı da).

## Seçenek fiyatları menüden (S8, 21 Kas 2026)

Ekstra shot, şurup ve ücretli alternatif süt menüde kalem olarak da durur
("Extra Shot" `mnu-0081`, "Syrup" `mnu-0080`, "Alternatif Süt" `mnu-0082`;
kasada ayrı satır çalınır, lafmaliyet onları ürün olarak fiyatlar ve
maliyetler). Seçenek ücreti ise kod sabitinden geliyordu
(`CUSTOMIZATION`): panelden ya da sitede bu kalemlerin fiyatı değişince
uygulama ve LafPOS eski ücreti almaya devam ediyordu (lafmaliyet
`docs/planlar/senkron.md` S8).

Artık `/api/mobile/v1/menu`'nün `customization`'ı ve sipariş fiyatı
(`resolveOptionPricing`) bu üç kalemin `priceMinor`'ını okur
(`optionPricesFromMenu`, `customizationFor`;
`src/lib/mobile/customization.ts`). "Satışta" okunmaz. Kalem yoksa, iki
boyluysa ya da fiyatı geçersizse (tam kuruş değil, 0, tavanın üstü) o
seçenek sabitine düşer. Normal ve laktozsuz süt, "Şurup yok" 0 kalır; ücretli
süt (badem) `mnu-0082`'nin fiyatını alır. Biçim ve kimlikler aynı; LafPOS
yeni ücreti bir sonraki menü eşitlemesinde alır (`upsertOptionGroups`).

## Panel ne zaman çeker

Pingde, ürünler sayfası açılınca (son çekmeden 5 dakika geçtiyse), günlük
cron'da ve "Siteyle eşitle" düğmesinde. Çekme, panelin karaoke çekmesi gibi
tek işlemde ve danışma kilidiyle yazar; sonucu panelin `integration_state`
tablosunda `menu_sync` anahtarında tutulur (son çekme, kaç satır değişti,
kopuk bağlantılar, son hata).

## Fiyat listesi tarihi

Menünün altındaki "fiyatların uygulanmaya başladığı gün"
(`settings."menuPricesEffectiveDate"`, Fiyat Etiketi Yönetmeliği) operatörün
girdiği gündür; bağlantı onu **değiştirmez** (karar OP-PRICE-LISTS: köşkteki
basılı listeler aynı günü taşır, tahmin edilmez). Bunun yerine her fiyat
değişikliği, siteden ya da panelden, `settings."menuPricesChangedAt"`'i
günceller; Kafe menüsü sayfası, son değişiklik girilen günden yeniyse
"Fiyat değişti, fiyat listesinin tarihini güncelle" der.

## Kapsam dışı - bilerek

- **ModPOS (Patron).** Kasanın kendi ürün listesi ve fiyatları üçüncü bir
  kopyadır; iki depo da ona ulaşamaz. Fiyat değişince kasada elle
  güncellenir. Panelin aylık POS raporu ürünleri POS adıyla eşler
  (`pos_mappings`), bu bağlantıdan etkilenmez.
- **Kalem açmak / silmek, ad ve kategori.** Bilerek elle (yukarıda).
- **Boy boy satış durumu.** Sitede yok; eklenmesi uygulama sözleşmesini
  (`docs/API-MOBILE.md`) değiştirir. Şubeye göre Satışta / Tükendi var
  (yukarıda "Şube"); şubeye göre fiyat yok.
