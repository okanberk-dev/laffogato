# LafPOS ↔ site: kafenin kasası

LafPOS (`RiosenBeq/lafpos`) kafenin içinde çalışan yerel kasa sunucusudur.
Menüyü siteden alır, ürünü kasada Tükendi / Satışta yapar, uygulamadan ve
web'den gelen online siparişleri (masa, gel-al, kurye) bar ekranında ve masa
planında gösterir, aşamasını geri yazar. Bunun için köşkün panelinin imzalı
uçlarını kullanır (`docs/PANEL-MENU.md`, `docs/PANEL-ORDERS.md`), ama **kendi
anahtarıyla**: operatör panelin anahtarının (`KARAOKE_SYNC_SECRET`) kafedeki
makinede durmasını istemedi. İki anahtar ayrı ayrı döndürülür. Sözleşmenin
LafPOS tarafı: lafpos `docs/03-ENTEGRASYON.md` §2.3.

## İş bölümü (26 Ekim 2026)

LafPOS ile site **tek sistem, iki yüz** düzeninde çalışır (karar ve gerekçe: lafpos `docs/06-TEK-SISTEM.md`;
ModPOS, NarPOS, Toast, Square ve Lightspeed'deki düzen):

- **Ürünlerin tek kaynağı bu panel.** Ad, fiyat, boy, KDV ve fotoğraf burada değişir; site, uygulama ve kasa
  aynı menüyü okur. LafPOS'ta Yönetim › Ürünler'deki "Sitede ürün ekle" bu panelin `/admin/menu/yeni`
  sayfasını açar; LafPOS menüyü kendisi çeker ve değişikliği uygulamadan önce gösterir.
- **Kasaya özgü alanlar LafPOS'ta** (istasyon, kısa ad, porsiyon, seçenek grubu); site bunları bilmez.
- **Yalnız kafede satılan hizmetler** (karaoke odasının saatlik ücreti, etkinlik ücreti) LafPOS'ta yerel ürün;
  buraya girmez.
- **Tükendi** kasadan ya da bar ekranından işaretlenince `POST /api/panel/menu` ile burada da tükenir
  (LafPOS'ta `urun.tukendi` yetkisi; kasiyer ve bar rolünde varsayılan açık).
- Şema değişmedi. Bu değişiklik yalnız LafPOS'un ayrı imza anahtarını (`LAFPOS_SYNC_SECRET`) ve sipariş
  sürüm sinyalini ekler; anahtar Vercel'e girilene dek LafPOS'un imzalı çağrıları reddedilir, site etkilenmez.

## Anahtar

| Değişken                | Nerede        | Açıklama                                                                                            |
| ----------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| `LAFPOS_SYNC_SECRET`    | site (Vercel) | LafPOS'un anahtarı, en az 32 karakter; daha kısası tanımsız sayılır. Yoksa LafPOS kapalı (aşağıda). |
| `LAFFOGATO_SYNC_SECRET` | LafPOS `.env` | Sitedekiyle **aynı** değer.                                                                         |

- Panelin anahtarından **farklı** olmalı. İkisine aynı değer verilirse site
  isteği panelinki sayar (olay kaydına `panel:` düşer) ve anahtarları ayırmanın
  anlamı kalmaz.
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

| Uç                             | Panelin anahtarı | LafPOS'un anahtarı | LafPOS ne için kullanır                                 |
| ------------------------------ | ---------------- | ------------------ | ------------------------------------------------------- |
| `GET /api/panel/menu`          | açar             | açar               | Tükendi kalemleri de görmek (`isActive`)                |
| `POST /api/panel/menu`         | açar             | açar               | Kasada Tükendi / Satışa aç: önce site, 2xx gelince kasa |
| `GET /api/panel/orders`        | açar             | açar               | Online siparişler: bar ekranı ve masa planı             |
| `POST /api/panel/orders/stage` | açar             | açar               | Hazırlanıyor / Hazır / Teslim edildi                    |
| `GET /api/pos/orders/version`  | açmaz (401)      | açar               | Sipariş sürüm sinyali (aşağıda)                         |
| `GET /api/panel/karaoke`       | açar             | açmaz              | LafPOS'un işi değil                                     |
| `GET /api/panel/sales`         | açar             | açmaz              | LafPOS'un işi değil                                     |

- Panel uçlarının yanıt biçimi, `version`'ı, gövde sınırı ve hata kodları kim
  imzalarsa imzalasın aynıdır: `docs/PANEL-MENU.md`, `docs/PANEL-ORDERS.md`.
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
{ "version": "mh7x2k3a-1x9f0c2b7d4e5" }
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
- Panel hesaplarının yazımı (`live:access`) bu değeri değiştirmez; panelin kendi
  işaretleri değişir, LafPOS'unki değil.
- Önbellek kapalıysa (`LAF_DATA_CACHE=off`) ya da okunamıyorsa her yanıt yeni
  bir değerdir: LafPOS her soruda siparişleri çeker. Bozuk önbellek fazladan
  okumaya mal olur, kaçan siparişe değil.
- `Cache-Control: no-store`.

| Durum | Gövde                        | Ne zaman                                                      |
| ----- | ---------------------------- | ------------------------------------------------------------- |
| 200   | `{"version":"…"}`            |                                                               |
| 401   | `{"error":"unauthorized"}`   | İmza yok, yanlış (panelin anahtarı da) ya da 5 dakikadan eski |
| 503   | `{"error":"not_configured"}` | `LAFPOS_SYNC_SECRET` yok ya da 32 karakterden kısa            |

## LafPOS ne zaman çeker

- Sürüm ucunu **20 saniyede bir** sorar; değer bir önceki yanıttakinden farklıysa
  `GET /api/panel/orders`'ı çeker. Böylece uygulamadan gelen sipariş, Neon'u her
  soruda uyandırmadan yarım dakika içinde bar ekranına düşer. Sürüm sorusu
  veritabanına gitmez; sipariş okuması yalnız gerçekten bir şey değişince olur.
- Ayrıca 5 dakikada bir, ekran açılınca ve elle yenileyince çeker.
- Menüyü herkese açık uçtan ETag ile, imzalı uçtan en çok 5 dakikada bir okur
  (lafpos `docs/03-ENTEGRASYON.md` §2.1, §2.3, §5).

## Kişisel veri (KVKK)

LafPOS'a panelin aldığından fazlası gitmez: aynı uçlar, aynı beyaz liste
(`toPanelOrder`: yalnız ad; soyad, e-posta, telefon, adres, kurye notu, ödeme
referansı asla). Sürüm ucu hiç veri taşımaz. Karaoke ve online satış uçları
LafPOS'a kapalıdır.

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
`src/app/api/pos/orders/version/route.ts`, `src/lib/admin/change-marker.ts`.
Testler: `tests/panel-lafpos-key.test.ts` (dört uç, olay kaydı, kapalı uçlar),
`tests/api-pos-orders-version-route.test.ts` (sürüm ucu, veritabanısız).
