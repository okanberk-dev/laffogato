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
  ulaşılamadı; fiyat değişmedi"): iki yer hiçbir an ayrışmaz, çakışma ve
  "hangisi yeni" sorusu doğmaz.
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
    paylaşır: birini menüden kaldırmak kalemi sitede gizler, sonraki çekmede
    öbür satır da `showOnMenu = false` olur. Boy boy satış durumu sitede yok.
- **L fiyatı silinirse** (`priceMinorL = 0`) panelde `L` yuvasına bağlı satır
  "bağlantı kopuk" olarak işaretlenir, fiyatına dokunulmaz.
- **Kalem sitede silinirse** panel o satırların bağlantısını kaldırır ve
  eşitleme durumunda söyler.

## Uçlar

Hepsi karaoke bağlantısının imzasını kullanır (`x-laf-timestamp`,
`x-laf-signature: v1=<hex>`, `src/lib/panel/karaoke-sync-core.ts`; ortak
anahtar `KARAOKE_SYNC_SECRET`, adı tarihsel: sitenin panelle **bütün**
bağlantısının anahtarıdır). Anahtar yoksa uçlar 503 döner, ping gitmez.

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
   ```

   ```json
   {
     "version": 1,
     "now": "2026-10-21T10:00:00.000Z",
     "items": [
       {
         "id": "mnu-0011",
         "name": "Espresso Macchiato",
         "categoryKey": "espresso",
         "categoryLabel": "Espresso",
         "priceMinor": 14000,
         "priceMinorL": 0,
         "isActive": true,
         "sortOrder": 6,
         "updatedAt": "2026-10-20T08:00:00.000Z"
       }
     ]
   }
   ```

   Bütün kalemler, satışta olmayanlar da (panel bağlıyı gizlemek için onu da
   görmeli). `Cache-Control: no-store`. Site veritabanından yalnız yanıtın
   sekiz sütununu okur (`listMenuItemsForPanel`; `categoryLabel` sitenin
   kendi etiketidir), fotoğrafları (`image`, kalem başına 2 MB'a kadar data
   URL) hiç okumaz; yazma ucu da öyle.

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
   kullanıcısının adıdır (en çok 80 karakter), sitenin olay kaydına
   "Panel · Selin" diye düşer. Yanıt kalemin yeni hâli (`{"item": {...}}`,
   okumadaki biçim). Hatalar:

   | Durum | Gövde                         | Ne zaman                                 |
   | ----- | ----------------------------- | ---------------------------------------- |
   | 400   | `{"error":"invalid","field"}` | Alan kurala uymuyor ya da hiçbiri yok    |
   | 401   | `{"error":"unauthorized"}`    | İmza yok, yanlış ya da 5 dakikadan eski  |
   | 404   | `{"error":"not_found"}`       | Kalem sitede yok (silinmiş)              |
   | 413   | `{"error":"too_large"}`       | Gövde 4 KB'tan büyük                     |
   | 503   | `{"error":"not_configured"}`  | Anahtar yok; ya da veritabanı okunamadı  |

   Site yazımı yalnız bu üç sütuna yapar (`setMenuItemSaleFields`, tek UPDATE),
   olay kaydına yazar ve `pub:menu` önbelleğini düşürür: sitenin menüsü,
   `/masa` QR menüsü ve uygulama (CDN'de en çok 5 dakika) yeni fiyatı gösterir.
   Yazım ping de üretir; panel çektiğinde değerler zaten aynıdır, döngü olmaz.

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
  (`docs/API-MOBILE.md`) değiştirir.
