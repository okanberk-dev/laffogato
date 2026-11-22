# Senkron: site ↔ köşkün paneli ↔ uygulama (kısa harita)

Sitenin köşkün iç paneliyle (ladmin.laffogato.net, `RiosenBeq/lafmaliyet`) ve
mobil uygulamayla (`RiosenBeq/lafmobil`) paylaştığı bilgilerin tek sayfalık
haritası: hangi bilgi nerede yaşar, öbür yere nasıl gider ve iki yer aynı anda
değişince ne olur. Panel tarafındaki ikizi lafmaliyet `docs/SENKRON.md`;
kararların, envanterin ve görevlerin tamamı lafmaliyet
`docs/planlar/senkron.md` (§3 kararlar, §4 görevler; bu sayfa onun §3'ünün
kısasıdır). Sahibin isteği (24 Eki 2026): _"birinde bir şey değişince diğer
yerlerde de varsa değişsin. Örneğin menü, aktif / pasif ürün."_ Kod esastır:
bu sayfa kodla çelişirse kod haklıdır.

## Ne nerede yaşar

Müşteriye dönük bilgi sitede yaşar, panel ve uygulama okur. Panelin kendi
bilgisi (reçete, maliyet, hammadde, kasa, doluluk, tahmin) panelde kalır ve
siteye gelmez. Panelle bütün istekler aynı anahtarla imzalıdır
(`KARAOKE_SYNC_SECRET`; yoksa bağlantılar kapalı). Kafenin kasası LafPOS ayrı
bir bağlantıdır, kendi anahtarıyla: `docs/LAFPOS.md`.

| Bilgi | Kaynak | Panele nasıl gider | Panel nasıl yazar | Uygulamaya | Ayrıntı |
| --- | --- | --- | --- | --- | --- |
| Menü fiyatı (M / L), Satışta / Tükendi | site (`menu_items`) | `pub:menu`'yu düşüren her yazımda ping (`/api/menu/ping`) → imzalı `GET /api/panel/menu` | Önce site: imzalı `POST /api/panel/menu`, `expect` ile (aşağıda); panel 2xx'ten sonra kendi kopyasını yazar | `GET /api/mobile/v1/menu` (CDN en çok 10 dk + uygulamanın önbelleği) | [PANEL-MENU.md](PANEL-MENU.md) |
| Karaoke rezervasyonları | site | Ping (`/api/karaoke/ping`) → `GET /api/panel/karaoke` | Yazmaz | Karaoke uçları | [PANEL-KARAOKE.md](PANEL-KARAOKE.md) |
| Kafe siparişleri (bar ekranı) | site | Ping (`/api/orders/ping`) → `GET /api/panel/orders`; yanında ödeme bekleyen sayısı (`awaitingPayment`), kaçan ödeme pingi için | Aşama: `POST /api/panel/orders/stage` (karta koşullu; eski dokunuş 409) | Sipariş uçları | [PANEL-ORDERS.md](PANEL-ORDERS.md) |
| Online satış (kâr-zarar, kasa raporu) | site | `GET /api/panel/sales` (panel çeker) | Yazmaz | - | [PANEL-SALES.md](PANEL-SALES.md) |
| Ad, açıklama, kategori, görsel, alerjen, yeni kalem | site | Yalnız ad ve kategori etiketi listede | Yazmaz (bağ ve kalem açma elle) | Menü yanıtı | [PANEL-MENU.md](PANEL-MENU.md) |

Saatler, kapanışlar, ayarlar ve tarihli kapanış henüz panele gitmiyor
(planın Faz 2'si).

**Şube (21 Kas 2026).** Siparişler, masa çağrıları, masalar ve Satışta /
Tükendi şubeye göredir; her imzalı uç bir şube adına okur ve yazar
(`?branch=` ya da gövdede `branch`; yoksa panel Tuzla, LafPOS
`LAFPOS_BRANCHES`). Kural `src/lib/panel/branches.ts`; uç uç ayrıntı
[LAFPOS.md](LAFPOS.md) "Şube", [PANEL-ORDERS.md](PANEL-ORDERS.md) "Şube",
[PANEL-MENU.md](PANEL-MENU.md) "Şube", [PANEL-SALES.md](PANEL-SALES.md)
"Şube kırılımı". Seçenek ücreti (ekstra shot, şurup, alternatif süt) menü
kalemlerinin fiyatından gelir (S8, [PANEL-MENU.md](PANEL-MENU.md)).

## Ortak kurallar

- **Yön.** Site yazar, panel okur; panelin siteye yazdığı tek şey menü
  fiyatı ile Satışta / Tükendi ve siparişin aşamasıdır, ikisi de sitenin kendi
  kurallarından geçer. Uygulama yalnız siteden okur.
- **Mekanizma.** İçeriksiz imzalı ping (`{event, at}`), ardından imzalı
  çekme. Yeni bilgi var olan yanıta isteğe bağlı alan olarak eklenir; `version`
  değişmez (panel tanımadığı sürümü reddeder). `/api/mobile/v1` yalnız ekleme
  ile değişir.
- **Yetenek bayrağı.** Sitenin yazma şemaları katıdır (`.strict()`): bilinmeyen
  alan 400'dür. Panelin yazma ucuna eklenen her yeni istek alanı GET yanıtının
  üst düzeyinde duyurulur (`writes: {expect: true}`); panel alanı yalnız son
  çekmede bayrağı gördüyse gönderir, 400 `field` = o alan (ya da `body`) gelirse
  alansız bir kez yeniden dener. Böylece site geri alınsa da yazımlar 400'e
  düşmez.
- **Çakışma.** Eski bir görüntüden yapılan yazım yenisinin üstüne yazılmaz
  (aşağıda). Panelin kendi tuttuğu bir değer sitedekinden farklıysa panel
  uyarır, ezmez.
- **Hata.** Ping her zaman kaybolabilir; her bağlantının yedeği var: panelin
  ilgili ekranının çekmesi, günlük iş, "Bağlantıları sına". Ping yazımı asla
  bozmaz.
- **Bütçe.** Sınırı Neon koyuyor (`docs/DATABASE.md`). 5 dakikadan sık
  periyodik iş yok; sitenin veritabanına giden yeni periyodik çekme ya 304
  işaretinden ya günlük işten geçer; yeni cron yok.
- **KVKK.** Panele müşteri e-postası, telefonu, soyadı, adresi ve ödeme
  referansı gitmez. Beyaz listeler alan alan kodda (`toPanelMenuItem`,
  `toPanelReservation`, `toPanelOrder`), testler anahtar kümesinin tamamını
  sınar.
- **Sözleşme kopyası.** `docs/API-MOBILE.md`'ye dokunan her site PR'ının
  ardından bir lafmobil PR'ı açılır; kopya site PR'ı birleştikten sonra
  sitenin `main`'inden alınır, lafmobil'de `RECONCILED` güncellenir. Yerel
  parite testi `LAFMOBIL_DIR=<lafmobil worktree'si>` ile koşulur
  (`tests/api-contract-parity.test.ts`).
- **İmza vektörleri.** İki taraf aynı vektörleri sabitler (aynı deneme
  anahtarı ve an): sitede karaoke, menü, sipariş (okuma, ping, aşama) ve
  ayın satışı `tests/panel-karaoke-sync-core.test.ts`, panelde menününkiler
  `tests/site-menusu.test.ts` (sipariş ve satışınkileri panel P2'de
  sabitler). Kural değişirse iki taraf aynı gün.
- **Gecikme hedefi.** Site → panel 10 saniye içinde (ping). Site → uygulama:
  menü birkaç dakika içinde (6 Kas 2026'dan beri CDN en çok 2 dk +
  uygulamanın `staleTime`'ı 2 dk; eski sürümlerin `staleTime`'ı 1 saat). Sipariş anındaki
  karar (fiyat, Tükendi, açık / kapalı) her zaman sunucuda, güncel veriyle.

## Çakışma: iki yer aynı anda değişince

Menü fiyatı ve Satışta / Tükendi için üç yazan var: sitenin formu ve listesi,
panel (kart, fiyat hücresi, toplu Fiyatlar, bar ekranının Tükendi'si) ve
LafPOS. Kural: **yazan, gördüğünü taşır; site yalnız o hâlâ geçerliyse yazar.**

1. **Panel → site: `expect`.** Panel yazdığı her alanın kopyasındaki değerini
   `expect` olarak gönderir. Değişecek bir alanın `expect`'i sitedekini
   tutmuyorsa site yazmaz, **409** `{"error":"stale","item"}` döner; panel menüyü
   hemen yeniden okur ve "Bu ürün sitede bu arada değişti" der. Değişecek alan
   yoksa (istenen değer zaten sitedeki) yanıt 200 ve kalemdir, `expect`'e
   bakılmaz. Yazım `expect`'li sütunlara koşulludur: okuma ile yazım arasına
   giren bir yazım da 409 `stale` verir. Sıra ve ayrıntı:
   [PANEL-MENU.md](PANEL-MENU.md) "Çakışma: `expect` ve 409 `stale`".
2. **Sitenin formu: yüklenen değerler.** Düzenleme formu fiyatları ve
   "Menüde göster"i açıldığı andaki değerleriyle taşır. Dokunulmayan satış
   sütunu yazılmaz (panelin Tükendi'si yerinde kalır); dokunulan sütun yalnız
   satır hâlâ yüklenen değeri taşıyorsa yazılır, yoksa "Bu kalem bu arada
   değişti". Listenin tek dokunuşu ve toplu Tükendi zaten koşulludur.
   Ayrıntı: [PANEL-MENU.md](PANEL-MENU.md) "Sitenin formu".
3. **Panelin kendi tarafı.** Panelin açık kalmış ekranı da gördüğünü gönderir
   (`seenPrice`, `seenActive`, `seenShowOnMenu`) ve eski değeri siteye
   göndermez: lafmaliyet `docs/SENKRON.md`.
4. **LafPOS** yalnız Satışta / Tükendi yazar, `expect` göndermez (koşulsuz
   yazım, bugünkü gibi); fiyat yazamaz (403).
5. **Sipariş aşaması** zaten koşulludur: `from` kartın aşamasıdır, eski dokunuş
   409 (`docs/PANEL-ORDERS.md`).

## Durum (28 Ekim 2026)

- **S1 (bu sayfayla):** `POST /api/panel/menu`'ye isteğe bağlı `expect` ve 409
  `stale`, GET'e `writes: {expect: true}`, sitenin formunun koşullu yazımı,
  `/api/mobile/v1/menu`'de `stale-while-revalidate=300`, panelin üç menü imza
  vektörü sitede de. Panel tarafı (P1) denetim B12'yle hazırdı: bayrağı görünce
  `expect` göndermeye başlar.
- **S2:** `GET /api/panel/orders`'a isteğe bağlı `awaitingPayment` (ödemesini
  bekleyen bar ekranı siparişlerinin sayısı, ödeme sayfası son 30 dakikada
  açılmış ya da yeniden açılmış olanlar; yalnız sayı, `version` 1, listeden
  önce okunur), yeniden açılan ödeme sayfasında panele ping ve sipariş
  okuması, sipariş pingi, aşama dokunuşu ve ayın satışı için imza
  vektörleri. Panel tarafı (P2) sayı sıfırdan büyükken kısa süre sık
  çekecek; o gelene dek alan yok sayılır. P2 için: panelin 30 dakikalık
  takibi yalnız 0 → > 0 geçişinde değil, sayı sıfırdan büyükken gelen her
  pingte yeniden başlar (yeniden açılan sayfa ping atar, ama sipariş zaten
  sayılıyorsa sayıyı artırmaz).
- **Sırada (Faz 1):** panelin ödeme takibi (P2), uygulamanın menü ve mağaza
  tazeliği (lafmobil M2). Faz 2:
  panel ayar ucu, 304, ping sınaması, elle kapalı / tarihli kapanış. Hepsi
  planın §4'ünde.
- **S8 (21 Kas 2026):** seçenek fiyatı menüden: `customization` ve sipariş
  fiyatı `mnu-0080` / `mnu-0081` / `mnu-0082`'nin fiyatını okur.
- **Şube (21 Kas 2026):** yukarıda; panel ve LafPOS tarafları kendi
  depolarında (lafmaliyet `planlar/sube.md` Dalga 5, lafpos
  `docs/03-ENTEGRASYON.md` §2.3).
