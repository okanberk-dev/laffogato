# Karaoke ↔ yönetim paneli bağlantısı

Köşkün iç paneli (ladmin.laffogato.net, `RiosenBeq/lafmaliyet` deposu) bardaki
hep açık ekranda karaoke odasını sayar: yeni rezervasyonda çalar, süre bitince
alarm verir. Bunun için bir karaoke rezervasyonu açılır, ödenir, onaylanır,
iptal edilir ya da saati değişirse panelin **o an** haberi olmalı; siteye her
birkaç saniyede bir sormadan.

## Ne nereye gider

1. **Ping (site → panel).** `live:karaoke` önbellek etiketini düşüren her yazım
   (src/lib/cache/tags.ts: `karaoke_reservations` tablosu ve karaoke SQL
   fonksiyonları) veri katmanının yazım kancasından
   (`src/lib/db/index.ts` → `onWrite`) `pingPanelKaraoke()`'u çağırır. Yanıt
   gittikten sonra (`after()`) panele tek bir imzalı istek gider:

   ```
   POST https://ladmin.laffogato.net/api/karaoke/ping
   {"event":"karaoke.changed","at":"2026-10-21T10:00:00.000Z"}
   ```

   Gövdede rezervasyon yok; yalnız "bir şey değişti". Aynı istekteki ardışık
   yazımlar tek pinge biner. Panel ulaşılamazsa bir kez daha denenir, olmazsa
   tek satır uyarı yazılır; **yazım asla bundan etkilenmez** (rezervasyon panel
   çöktü diye kaybolmaz). Panel, ekranı açıldığında kendisi de eşitlediği için
   kaçan bir ping kalıcı bir kayıp değildir.

2. **Çekme (panel → site).** Panel pinge (ya da eskimiş ekranına) imzalı bir
   okumayla karşılık verir:

   ```
   GET https://laffogato.net/api/panel/karaoke?from=2026-10-20&to=2027-01-18
   ```

   `from` varsayılanı İstanbul'da dün, `to` varsayılanı `from` + 90 gün; en
   geniş pencere 400 gün (LafPOS'un anahtarıyla yalnız dünden yarına,
   aşağıda). Yanıt `{ now, from, to, complete, reservations }`,
   `Cache-Control: no-store`. Her rezervasyon yalnız şunları taşır: kimlik,
   gün, başlangıç saati, süre, başlangıç ve bitiş anı, kişi sayısı, durum,
   ödeme durumu, **yalnız ad** (soyad değil), not (en çok 300 karakter),
   tutar, kanal (`web` / `app`), oluşturma ve güncelleme anı ve iptal
   edilmiş rezervasyonun iade tutarı (`refundMinor`, 29 Ekim 2026, ekleme;
   aşağıda). E-posta, telefon, soyad, iletişim izni, sözleşme kaydı, ödeme
   referansı, iadenin diğer ayrıntıları ve IP **hiç gönderilmez**
   (`toPanelReservation`, beyaz liste).

   `refundMinor` (kuruş ya da `null`): iptal edilmiş rezervasyonda geri
   giden ya da gidecek tutar. `0` hiçbir şey geri gitmedi demektir: %0
   kuralında misafirin geç isteğiyle iade yapılmadan iptal edilip saati
   satışa açılan rezervasyon `paymentStatus: "refunded"` taşır ama para
   hareket etmemiştir (LEGAL-REDLINES §37.8). Ödenenden küçük bir tutar geç
   iptal payı ya da yeniden satılan saatin payıdır; `null` tutarın tamamı
   geri gitti ya da rezervasyon iptal edilmedi demektir. Alanı okumayan bir
   panel eski sözleriyle çalışmaya devam eder; okuyan panel "iade edildi"
   yerine "iade yok" yazar (lafmaliyet bar ekranı).

   Liste günün ve saatin sırasıyladır (erkenden geçe). Pencere 2000 satırı
   aşarsa (tek oda saatlik kiralanınca gerçek bir durum değil) site okumayı
   da erkenden geçe yapar: kesilen pencerenin **uzak ucudur**, bugün ve bu
   hafta hep gelir; `complete: false` listenin kesildiğini söyler.

## Çekme ucunu kim çağırır

| Arayan                               | Anahtar               | Ne zaman çeker                                                                                        |
| ------------------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------- |
| Köşkün paneli (ladmin.laffogato.net) | `KARAOKE_SYNC_SECRET` | Ping gelince ve ekranı eskimiş açılınca (yukarıda)                                                    |
| Kafenin kasası LafPOS (26 Ekim 2026) | `LAFPOS_SYNC_SECRET`  | `GET /api/pos/orders/version` yanıtındaki `karaoke` değişince, oda kutusu açılınca (`docs/LAFPOS.md`) |

- İkisi aynı yanıtı, aynı beyaz listeyi (`toPanelReservation`) ve aynı hata
  kodlarını alır; site isteği hangi anahtarın imzaladığını iki anahtarı da
  deneyerek bulur (`src/lib/panel/signed-callers.ts`).
- **Tek fark pencerededir.** LafPOS'un anahtarı yalnız İstanbul'da dünden
  yarına kadarki günleri okur, iki uç dahil (`withinLafposKaraokeReach`,
  `src/lib/panel/karaoke-sync-core.ts`): kasa bugünün odasını yürütür, anahtarı
  kafedeki makinede durur. Daha geniş, geçmişe ya da ileriye uzanan ya da
  `from`'suz pencere hiçbir şey okunmadan 403 `{"error":"forbidden"}` alır.
  Panelin penceresi değişmez (400 güne kadar, varsayılanı dün + 90 gün).
- Kasa bir satırı `status` ile `paymentStatus`'u birlikte okuyarak tartar: oda
  yalnız `requested` / `confirmed` iken tutulu, blok yalnız `cancelled` değilken
  ve `paid` iken önceden ödenmiş; `none` blok `totalMinor`'ını öder (köşkün
  `Telafi: KRK-…` saati 0). Ayrıntı: `docs/LAFPOS.md` "Karaoke satırını kasa
  nasıl okur".
- Ping yalnız panele gider: kafedeki LafPOS'a internetten ulaşılamaz. LafPOS
  değişikliği sürüm yanıtındaki `karaoke` işaretinden öğrenir; o işaret
  `live:karaoke`'yu düşüren aynı yazımlarla değişir ve veritabanına gitmez.
- `LAFPOS_SYNC_SECRET` yoksa, 32 karakterden kısaysa ya da panelin değeriyle
  aynıysa uç yalnız panelindir, bu değişiklikten önceki gibi (LafPOS
  varsayılan kapalı; sahibin 26 Ekim 2026 kararı, `docs/LAFPOS.md`).
- LafPOS rezervasyonu yalnız okur: oda sitede rezerveyken kasada boş
  görünmesin, sitede ödenmiş saat kasada yeniden ücretlenmesin.

## Ortam değişkenleri

| Değişken              | Nerede            | Açıklama                                                                                                                                                                                     |
| --------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KARAOKE_SYNC_SECRET` | site **ve** panel | Ortak gizli anahtar, iki projede **aynı** değer, en az 32 karakter. Yoksa bağlantı kapalı: ping gitmez, çekme ucu 503 döner (LafPOS'un anahtarı da yoksa; varsa uç yalnız LafPOS'a açıktır). |
| `PANEL_URL`           | site              | Panelin adresi. Boşsa `https://ladmin.laffogato.net`. http yalnız localhost için.                                                                                                            |

Üretmek için: `openssl rand -base64 48`. Değeri Vercel'de iki projeye de
"Sensitive" olarak ekleyin, sonra iki projeyi de yeniden yayımlayın.

Aynı anahtar menü bağlantısını (`docs/PANEL-MENU.md`), bar ekranının sipariş
akışını (`docs/PANEL-ORDERS.md`) ve online satış özetini
(`docs/PANEL-SALES.md`) da imzalar: adı tarihsel, sitenin panelle bütün
bağlantısının anahtarıdır. Değiştirirken hepsi birlikte kapanır ve birlikte
açılır.

## Güvenlik

- İki yön de HMAC-SHA256 ile imzalı (CLAUDE.md kural 7):
  `x-laf-timestamp: <unix saniye>` ve `x-laf-signature: v1=<hex>`. İmzalanan
  metin satır satır: zaman damgası, yöntem (`GET`/`POST`), yol, sıralanmış ve
  kodlanmış sorgu, gövdenin SHA-256'sı. Alan adı imzaya girmez (www'den
  yönlenen istek de geçer), yol ve sorgu girer: bir pencereye verilen imza
  başka bir pencereyi açmaz.
- Saat farkı en çok 5 dakika: yakalanan bir istek sonradan yeniden
  oynatılamaz. Karşılaştırma sabit sürelidir (`timingSafeEqual`).
- İmzasız, yanlış, eski ya da bozuk başlıklı istek yalnızca
  `401 {"error":"unauthorized"}` alır; ayrıntı söylenmez.
- Kurallar `src/lib/panel/karaoke-sync-core.ts`'te; panel deposu aynı
  kuralların bayt bayt uyumlu bir kopyasını taşır. İki taraftaki testler aynı
  iki imza vektörünü sabitler: kural bir tarafta değişirse her istek 401 olur.

## Anahtarı değiştirmek

1. Yeni değeri üretin (`openssl rand -base64 48`).
2. Panelde ve sitede `KARAOKE_SYNC_SECRET`'ı aynı anda değiştirip iki projeyi
   de yeniden yayımlayın. Arada geçen birkaç dakikada pingler ve çekmeler 401
   alır; panel ekranı açıldığında yeniden eşitler, rezervasyon kaybolmaz.
3. Anahtarın sızdığından şüpheleniyorsanız hemen değiştirin: eski anahtarla
   imzalanmış istekler yeni dağıtımda geçmez.

## Elle denemek

```bash
SECRET='…'
TS=$(date +%s)
CANON=$(printf '%s\nGET\n/api/panel/karaoke\nfrom=2026-10-20&to=2026-10-31\n%s' \
  "$TS" "$(printf '' | sha256sum | cut -d' ' -f1)")
SIG=$(printf '%s' "$CANON" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')
curl -s "https://laffogato.net/api/panel/karaoke?from=2026-10-20&to=2026-10-31" \
  -H "x-laf-timestamp: $TS" -H "x-laf-signature: v1=$SIG"
```

Sorgu parametreleri imzada **sıralı** yazılır (`from` sonra `to`); adres
satırındaki sıra fark etmez.

Testler: `tests/panel-karaoke-sync-core.test.ts` (imza, pencere, LafPOS'un
penceresi, beyaz liste), `tests/api-panel-karaoke-route.test.ts` (uç),
`tests/panel-karaoke-ping.test.ts` (ping ve yazım kancası),
`tests/panel-lafpos-key.test.ts` (LafPOS'un anahtarı ve dünden yarına sınırı),
`tests/api-pos-orders-version-route.test.ts` (LafPOS'un `karaoke` işareti).
