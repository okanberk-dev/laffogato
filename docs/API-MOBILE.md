# API-MOBILE — laffogato.net ↔ uygulama sözleşmesi (v1)

> Bu belge iki deponun ortak sözleşmesidir. Site tarafı `RiosenBeq/laffogato`
> (`src/app/api/mobile/v1/**`), uygulama tarafı **`RiosenBeq/lafmobil`**
> (`src/data/http.ts` + `src/data/queries.ts`) bu belgeye göre yazılır.
> **Belge önce, kod sonra.** Kopyası site deposunda `docs/API-MOBILE.md`
> olarak durur; ikisi aynı olmalı.
>
> **v1 kırılmaz.** Uygulama mağazadan yayınlanmış sürümlerle sahada; eski
> sürümler güncellenmeden aynı uçlara istek atar. Alan silme/yeniden
> adlandırma, tip değiştirme, zorunlu yeni istek alanı ve kimlik yöntemi
> değişikliği yok — yalnız ekleme. Kırıcı değişiklik gerekiyorsa `/v2` açılır.
>
> **Web ile ortak iş mantığı uçtan değil kütüphaneden paylaşılır.** Web'in
> kimliği bcrypt çerez oturumu, uygulamanınki Supabase bearer token'ı; web bir
> mobil ucu HTTP ile çağıramaz. Saf kuralları `*-core` modülünde tut, iki yüzey
> de aynı fonksiyonu çağırsın — bkz. §7 karaoke (`karaoke-core.ts`, web
> `/karaoke` sayfası ile `POST /karaoke/reservations` aynı
> `createReservation`'a iner).

Kaynak tasarım: operatörün Claude Design belgesi "Laffogato App v2" (28 ekran).
Karar kayıtları: `docs/DESIGN-UYGULAMA.md`.

---

## 0. Genel kurallar

| Kural        | Değer                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Taban        | `https://www.laffogato.net/api/mobile/v1`. Apex (`laffogato.net`) **308** ile www'ye yönlenir; `EXPO_PUBLIC_API_BASE_URL` yalnız **origin** tutar (`https://www.laffogato.net`), yolu `src/data/api.ts` ekler. |
| Para         | **Her zaman kuruş integer** (`priceMinor: 19500`). Dize fiyat yok.                                                                                                 |
| Zaman        | ISO-8601 (UTC, `Z`)                                                                                                                                                |
| Kimlik       | `Authorization: Bearer <Supabase access JWT>`. Sunucu `supabase.auth.getUser(jwt)` ile doğrular, `user.email` → Neon `customers` satırı (yoksa **oluşturur**).     |
| Hata gövdesi | `{ "error": "<kod>", "message": "<Türkçe, kullanıcıya gösterilebilir>" }`                                                                                          |
| HTTP         | 200/201 · 400 geçersiz istek · 401 kimlik yok/geçersiz · 403 e-posta doğrulanmamış (sipariş) · 404 · 409 çakışma (stok/kapalı) · 429 · 503 veritabanı ulaşılamıyor |
| Runtime      | Her route: `export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 15;`                                               |
| Sızıntı      | Store satırı doğrudan JSON'a **yayılmaz**; her uç açık izin-listesi eşleyici kullanır.                                                                             |
| Fiyat        | **İstemciden fiyat alınmaz.** Sipariş tutarı sunucuda DB fiyatı + seçenek fiyatından hesaplanır.                                                                   |
| Sürüm        | Yol ile (`/v1/`). v1 içinde yalnız ekleme yapılır.                                                                                                                 |

Kimlik yardımcısı (site): `src/lib/mobile/auth.ts` →
`requireMobileCustomer(request): Promise<{ customer: PublicCustomer; supabaseUserId: string } | NextResponse>`.
`customers` satırı e-postayla eşleşir; yoksa `name = user.user_metadata.full_name ?? ""`,
`emailVerified = !!user.email_confirmed_at`, `passwordHash = ""` (parolasız; site
girişi Supabase üzerinden yapılır) ile oluşturulur. Site tarafında aynı e-posta
zaten varsa o satır kullanılır (**tek üyelik**).

---

> **Uygulama notu (site, 30 Ağu 2026).** `requireMobileCustomer` ayrıştırılmış
> birlik döner: `{ ok: true, customer, user, supabaseUserId } | { ok: false, response }`
> (route: `if (!auth.ok) return auth.response`). Kimlik hataları: **401** `unauthorized`
> (başlık yok / bozuk / geçersiz / süresi dolmuş) · **403** `account_disabled` ·
> **503** `auth_unavailable` (Supabase'e ulaşılamadı) · **503** `unavailable` (bu
> veritabanına ulaşılamadı). Ortak kodlar: **400** `invalid_json` (gövde JSON değil),
> Zod reddi **400** `invalid_body` (sipariş/promo uçları) ya da `invalid_request`
> (me/adres/davet/karaoke uçları); beklenmeyen hata **500** `internal`. Kimlik
> gerektiren uçlar `Cache-Control: private, no-store` döner. Ayrıntı: `docs/AUTH-BRIDGE.md`.

## 1. `GET /menu` — kafe menüsü (herkese açık)

```jsonc
{
  "categories": [
    {
      "key": "espresso",
      "title": "Espresso Based",
      "subtitle": "…",
      "italian": "…",
      "note": "…",
      "items": [
        {
          "id": "mnu-0007", // menu_items.id — sipariş bu id ile verilir
          "categoryKey": "espresso",
          "name": "Cappuccino",
          "description": "…",
          "priceMinor": 19500, // M (ya da tek boy)
          "priceLargeMinor": 21000, // L; tek boy ise null
          "tags": ["signature"], // signature | new | iced | nuts
          "hue": "caramel",
          "image": "https://laffogato.net/gorsel/menu/mnu-0007", // ya da null
        },
      ],
    },
  ],
  "customization": {
    // sunucu sabiti: src/lib/mobile/customization.ts
    "milks": [
      { "id": "normal", "label": "Normal", "priceMinor": 0 },
      { "id": "lactose-free", "label": "Laktozsuz", "priceMinor": 0 },
      { "id": "oat", "label": "Yulaf", "priceMinor": 2500 },
      { "id": "almond", "label": "Badem", "priceMinor": 2500 },
    ],
    "roasts": [
      { "id": "intense", "label": "Yoğun" },
      { "id": "light", "label": "Hafif" },
    ],
    "syrups": [
      { "id": "none", "label": "Şurup yok", "priceMinor": 0 },
      {
        "id": "vanilla",
        "label": "Vanilya",
        "priceMinor": 5000,
        "allergens": [],
      },
      {
        "id": "caramel",
        "label": "Karamel",
        "priceMinor": 5000,
        "allergens": [],
      },
      {
        "id": "hazelnut",
        "label": "Fındık",
        "priceMinor": 5000,
        "allergens": ["nuts"],
      },
    ],
    "extraShotMinor": 5000,
    "sugarMax": 3,
  },
  "updatedAt": "2026-08-30T…Z",
}
```

Cache: `public, s-maxage=300, stale-while-revalidate=3600`.
Uygulama boyları **veriden** çizer: `priceLargeMinor === null` → tek boy; değilse M/L.
(Tasarımdaki S/M/L üçlüsü katalogda yok — karar kaydı 6.)

## 2. `GET /shop` — mağaza ürünleri (herkese açık)

```jsonc
{ "products": [ {
  "id": "prd-0001", "slug": "sirena-espresso-blend", "name": "Sirena — Espresso Blend",
  "tag": "Çekirdek · 250g", "description": "…", "priceMinor": 32000, "compareAtPriceMinor": 0,
  "category": "beans",                // beans | gift | gear | merch | pantry
  "hue": "caramel", "image": "https://…" | null,
  "inStock": true,
  "variants": [ { "id": "var-…", "name": "250 g", "priceMinor": 32000, "inStock": true }, { "id": "var-…", "name": "1 kg", "priceMinor": 109000, "inStock": true } ],
  "grinds": [ "Çekirdek", "Espresso", "Filtre", "French Press" ]   // yalnız category === "beans"
} ], "shippingFlatMinor": 4900, "shippingFreeThresholdMinor": 50000 }
```

`variants[].priceMinor` = `product.priceMinor + variant.priceDeltaMinor` (sunucu hesaplar).
Öğütüm seçimi sipariş satırında `note` olarak taşınır; fiyata etkisi yok.
Abonelik ("2 haftada bir, %10") **v1'de yok**: tekrarlı ödeme alan bir sağlayıcı
yok. Uygulama artık "yakında" diyen bir anahtar da **çizmez** (karar 20 — sunucusu
olmayan teklif reklam edilmez). `campaignCards.subscription` sözleşmede kalır ama
hiçbir kartı açıp kapatmaz; sunucu göndermeye devam edebilir.

> **Uygulama notu.** `GET /shop` Cache-Control `public, s-maxage=60,
stale-while-revalidate=300` (stok bayrağı taşır); `GET /bootstrap` menü ile aynı
> (`300 / 3600`). `grinds` anahtarı yalnız `category === "beans"` ürünlerde **vardır**,
> diğerlerinde hiç yoktur (uygulama tipi `grinds?: string[]`). Menü/shop/bootstrap DB
> ulaşılamazsa paket verisine düşmez, **503** `unavailable` döner (fiyat taşıdıkları için).

## 3. Siparişler (kimlik gerekli)

### `POST /orders` → 201

```jsonc
{
  "kind": "cafe",                          // cafe | shop
  "fulfillment": "delivery",               // cafe: pickup | delivery · shop: shipping
  "lines": [
    { "menuItemId": "mnu-0007", "qty": 1, "size": "M",            // cafe satırı; size: "M" | "L" | "single"
      "options": { "milk": "oat", "roast": "intense", "sugar": 0, "syrup": "none", "extraShot": true, "note": "" } },
    { "productId": "prd-0001", "variantId": "var-…", "qty": 1, "note": "Öğütüm: Espresso" }  // shop satırı
  ],
  "address": { "id": "adr-…" } | { "title": "Evim", "fullName": "…", "phone": "…", "city": "İstanbul", "district": "Tuzla", "neighbourhood": "Postane Mah.", "line": "…", "note": "Kapı kodu 4821" } | null,  // pickup'ta null
  "scheduledFor": null | "2026-08-30T17:00:00Z",  // null = en kısa sürede
  "promoCode": "" ,
  "note": "",
  "legalConsent": true                     // Ön Bilgilendirme + Mesafeli Satış onayı (zorunlu)
}
```

Yanıt:

```jsonc
{
  "order": { …Order… },
  "payment": { "redirectUrl": "https://…", "expiresAt": "…" } | null,   // null yalnız totalMinor === 0
  "promoDropped": false
}
```

Kurallar:

- `customers.emailVerified` yoksa **403** `email_unverified`.
- Kafe satırları `menu_items` (aktif) ile, mağaza satırları `products` ile çözülür; **fiyat DB'den**.
- Seçenek fiyatları `customization` sabitinden; `size: "L"` → `priceMinorL`, yoksa **400**.
- `kind: "cafe"`: stok yok; `kind: "shop"`: mevcut `placeOrder` stok/claim mantığı **aynen** kullanılır.
- Kargo/kurye: `pickup` → 0; `delivery` → `settings.courierFeeMinor` (varsayılan 5500); `shipping` → mevcut `computeOrderTotals`.
- `kind: "shop"` ve `settings.isShopOpen === false` → **409** `shop_closed`. Bu anahtar **yalnızca kargolu mağaza** siparişlerini durdurur. Kafe siparişi için köşk kapalıysa (`live-status.isOpen === false`) **409** `cafe_closed`.
- Sipariş satırı `orders` tablosuna **mevcut şekliyle** yazılır; ek sütunlar: `channel = "app"`, `kind`, `fulfillment`, `scheduledFor`, `deliveryNote`. Satır `items[]` öğesine `menuItemId`, `size`, `options` eklenir (jsonb — geriye uyumlu).
- Ödeme: mevcut `getPaymentProvider().createCheckoutSession()`; `successUrl = https://laffogato.net/odeme/donus?app=1`, `failureUrl = https://laffogato.net/odeme/app-hata`. Uygulama `redirectUrl`'i `expo-web-browser` ile açar; dönüş sayfası **`laffogato://siparis/<id>`** derin bağlantısına yönlendirir (sayfa `app=1` görünce).
- Sadakat: sipariş **`paid`** olunca (`applyPaymentSucceeded`) `channel === "app" && kind === "cafe"` ise **+1 damga** (`loyalty_stamps`, kind `earn`, `orderId` benzersiz → idempotent).

> **Uygulama notu (POST /orders).**
>
> - Hata kodları — 400: `invalid_json`, `invalid_body` (Zod), `invalid_address`,
>   `invalid_line` (L boyu yok / bilinmeyen seçenek / pasif ürün), `line_not_found`,
>   `qty_too_high` (satır başına en fazla 99, en fazla 30 satır), `empty_cart`,
>   `fulfillment_unavailable` (kafe siparişinde seçilen `delivery`/`pickup` panelden kapatılmış —
>   `mobileApp.ordering.deliveryEnabled` / `pickupEnabled`; mesaj "Bu teslimat seçeneği şu an kapalı.");
>   403: `email_unverified`; 409: `shop_closed`, `cafe_closed`, `out_of_stock`,
>   `ordering_closed` (kafe siparişi ve `mobileApp.ordering.cafeEnabled === false`, ya da kurye ve
>   gel-al birlikte kapalı; mesaj = `ordering.closedMessage`). `ordering_closed` ve
>   `fulfillment_unavailable` hem `POST /orders` hem `POST /orders/preview` için geçerlidir.
> - `shop_closed` **yalnızca** `kind: "shop"` siparişlerinde döner ("Online mağaza açık",
>   /admin/ayarlar). Kafe siparişi bu anahtara bakmaz; onu `mobileApp.ordering.cafeEnabled`
>   ile köşkün saatleri yönetir → `ordering_closed` / `cafe_closed`. Kontrol `scheduledFor`
>   varsa o anda, yoksa şimdi; manuel override her durumda geçerli.
>   (Eskiden `shop_closed` kafe siparişlerine de uygulanıyordu: tatil için mağaza kapatılınca
>   köşk açık göründüğü hâlde her gel-al siparişi reddediliyordu.)
> - `totalMinor === 0` (kupon toplamı sıfırladı) → sipariş sunucuda anında `paid`
>   (`payment_transactions.provider = "free"`), `payment: null`.
> - `scheduledFor`: geçmiş (5 dk tolerans) ve 7 günden ileri → 400. `""`/`null` = en kısa sürede.
> - Kafe + mağaza karışık sepet → 400 (teslimat türü ikisini birden karşılayamaz).
> - Mağaza satırındaki `note` (öğütüm) `items[].detail` alanında taşınır.
> - `items[].options` sunucuda tam `LineOptions` nesnesi (varsayılanlarla) olarak döner.
> - `timeline` anahtarları teslimata göre: delivery `received/preparing/on_the_way/delivered`
>   · pickup `received/preparing/ready/picked_up` · shipping `received/preparing/shipped/delivered`.
> - `timeline[].at` her adımın **kendi** sütunundan gelir: `createdAt` · `preparingAt` ·
>   `shippedAt` · `completedAt`. Bu sütunlar yoktan önce yazılmış siparişlerde boş olabilir;
>   o durumda tamamlanmış bir adım `at: null` döner (sonraki bir anı ödünç almaz).
>   `statusLabel` bu adımdan gelir (pickup + shipped → "Hazır — gel al").
> - `etaMinutes`: delivery paid/preparing 35, shipped 10 · pickup 15 / 0 · shipping null.
> - Dönüş sayfası `/odeme/donus` app siparişini `app=1` parametresine ek olarak
>   `orders.channel === "app"` ile de tanır (sağlayıcının callback URL'i sabittir);
>   `laffogato://siparis/<id>?status=success|failed` derin bağlantısına 303 ile yönlendirir.
>   Başarısız ödeme `/odeme/app-hata?orderId=…` sayfasına iner, o da aynı derin bağlantıyı verir.

> **429 `too_many_pending`.** Üye başına en fazla **3** açık `pending_payment` sipariş
> (`MAX_OPEN_ORDERS`). Bir tane daha `POST /orders` 429 ile reddedilir. Bu bir bağlantı
> hatası değil: uygulama "Tekrar dene" göstermez — dördüncü siparişi yaratır — sunucunun
> kendi Türkçesini ve "Siparişlerime git" eylemini gösterir (`src/app/odeme.tsx`).

### `GET /orders` → `{ "orders": [ …Order… ] }` (en yeni önce, en fazla 50)

### `GET /orders/{id}` → `{ "order": …Order… }` (yalnız sahibi; aksi 404)

`Order`:

```jsonc
{
  "id": "ord-0284", "orderNo": 284, "status": "preparing",
  // pending_payment | paid | preparing | shipped | completed | cancelled | refunded
  "statusLabel": "Hazırlanıyor",
  "timeline": [ { "key": "received", "label": "Sipariş alındı", "at": "…", "done": true },
                { "key": "preparing", "label": "Hazırlanıyor", "at": "…", "done": true },
                { "key": "on_the_way", "label": "Kuryede", "at": null, "done": false },   // pickup: "Hazır — gel al"
                { "key": "delivered", "label": "Kapında", "at": null, "done": false } ],
  "channel": "app", "kind": "cafe", "fulfillment": "delivery",
  "items": [ { "name": "Cappuccino", "detail": "M · yulaf · +1 shot", "qty": 1, "unitPriceMinor": 24500, "menuItemId": "mnu-0007", "productId": null, "variantId": null, "size": "M", "options": { … } } ],
  "subtotalMinor": 83500, "discountMinor": 0, "shippingMinor": 5500, "totalMinor": 89000,
  "promoCode": "", "address": "Evim — …", "scheduledFor": null, "etaMinutes": 35, "etaAt": "…",
  "stampsEarned": 1, "createdAt": "…", "paidAt": "…" | null
  // stampsEarned = loyalty_stamps LEDGER'ından okunur: siparişin `earn` satırı
  // varsa ve `reversal` ile geri alınmamışsa 1, aksi hâlde 0. Duruma bakıp
  // "ödendiyse damga vardır" DEMEZ — onOrderPaid best-effort'tur ve iade
  // edilen siparişin damgası geri alınır.
}
```

### `POST /orders/preview` → sepet hesabı (kimlik gerekli değil ama varsa kupon denenir)

Gövde `POST /orders` ile aynı (legalConsent hariç). Yanıt:
`{ "lines": [ { "name", "detail", "qty", "unitPriceMinor", "lineTotalMinor" } ], "subtotalMinor", "discountMinor", "shippingMinor", "totalMinor", "promo": { "code", "ok": true } | { "code", "ok": false, "message" } | null, "stampsToEarn": 1 }`

> **Uygulama notu (preview).** `promoCode` verilmişse `promo-preview` hız sınırı burada da
> uygulanır (**429** `rate_limited` + `Retry-After`). Mağaza satırlarında stok kontrolü
> yapılır ama stok **ayrılmaz**. `stampsToEarn` kafe sepetinde 1, mağazada 0.

## 4. `GET /me` · `PATCH /me` (kimlik gerekli)

```jsonc
{
  "customer": { "id": "cst-…", "email": "…", "name": "Eda Mancuso", "phone": "+90 …", "emailVerified": true,
                "birthday": "", "memberSince": "2026-05-01T…Z",
                "notificationPrefs": { "orderUpdates": true, "marketing": false, "newsletter": false },
                "addresses": [ { "id", "title", "fullName", "phone", "city", "district", "neighbourhood", "line", "note", "isDefault" } ] },
  "loyalty": {
    "stamps": 4,                 // dolu damga (0–stampTarget-1); hedefe ulaşan damga ödüle dönüşür
    "stampTarget": 6,            // = settings.mobileApp.loyalty.stampTarget (§10, /admin/mobil/ayarlar → Sadakat)
    "rewardsReady": 1,           // kullanılmayı bekleyen ücretsiz içecek sayısı
    "lifetimeStamps": 22,
    "tier": "oro",               // verde (0–11 ödenmiş sipariş / 365 gün) | argento (12+) | oro (36+)
    "tierLabel": "ORO",
    "ordersLast365": 41,
    "badges": [ { "id": "first-affogato", "label": "İlk affogato", "earned": true }, { "id": "streak-10", "label": "10 gün üst üste", "earned": false }, { "id": "early-bird", "label": "Erken kuş", "earned": true }, { "id": "matcha-fan", "label": "Matcha meraklısı", "earned": false }, { "id": "bean-subscriber", "label": "Çekirdek abonesi", "earned": false }, { "id": "orders-50", "label": "50 sipariş", "earned": false } ]
  },
  "invite": { "code": "LAF-EDA24", "invited": 3, "joined": 2, "earned": 2,
              "people": [ { "name": "Selin K.", "status": "joined" | "pending", "at": "…" } ] },
  "usual": { "menuItemId": "mnu-0007", "size": "M", "options": { … } } | null
}
```

`PATCH /me` gövdesi: `{ name?, phone?, birthday?, notificationPrefs?, usual? }` → güncel `/me`.
Adresler: `POST /me/addresses` (gövde adres) · `PATCH /me/addresses/{id}` · `DELETE /me/addresses/{id}` · `POST /me/addresses/{id}/default` → hepsi güncel `addresses[]` döner.
Hesap silme: `DELETE /me` → Neon satırı anonimleştirilir, Supabase kimliği silinir (service role varsa) + oturum istemcide kapatılır (mağaza zorunluluğu). Devam eden sipariş varsa **409** `orders_in_progress`.

> **Uygulama notu (§4).** `PATCH /me` 400 `unknown_menu_item` (usual pasif/yok) ·
> `invalid_request` · `invalid_json`. Adres uçları: `POST /me/addresses` **201**, hata
> 404 `address_not_found` · 400 `invalid_address`. `DELETE /me` → **200** `{ "ok": true }`;
> Neon satırı anonimleştirilir (`deleted-<id>@anon.local`, kişisel alanlar boş,
> `isActive=false`, davet kodu serbest), üyenin adresi siparişlerde/ledger'da/kupon
> ve davet kayıtlarında yer tutucuya çevrilir, bülten kaydı ile `auth_attempts`
> satırları silinir ve `payment_transactions.raw` boşaltılır (mutabakat için
> `provider`/`providerRef`/`status`/`amountMinor` kalır). Supabase kullanıcısı
> `SUPABASE_SERVICE_ROLE_KEY` varsa **silinir**; yoksa kapalı satırda kalan
> `supabaseUserId`, o kimliğin bir daha üyelik açmasını engeller (403
> `account_disabled`). Oturumu uygulama kapatır. **409** `orders_in_progress`:
> `pending_payment`/`paid`/`preparing`/`shipped` bir sipariş varken hesap
> kapatılmaz (Üyelik Sözleşmesi §14) — sipariş bitince tekrar denenir.
> `neighbourhood` sütunu yoktur: `line1`'e
> `"<mahalle>, <satır>"` olarak katlanır, okurken `Mah.`/`Mahallesi`/`Mh.` sonekiyle ayrıştırılır.
> `loyalty.badges` ve `tier` yalnız `paid/preparing/shipped/completed` siparişleri sayar
> (ödenmemiş/iptal/iade sayılmaz).

## 5. Sadakat

- `POST /loyalty/redeem` → `stampTarget` damga (varsayılan 6) → **ücretsiz içecek kuponu** (`customer_coupons`, `source: "loyalty"`, `kind: "fixed"`, `value: loyalty.rewardValueMinor` (28000), `title: loyalty.rewardTitle` ("Ücretsiz içecek"), `loyalty.rewardTtlDays` gün (90)). Dördü de `/admin/mobil/ayarlar` → Sadakat'tan (§10 `settings.mobileApp.loyalty`); `stampTarget` ve `rewardTitle` uygulamaya `bootstrap.app.loyalty` ile de gider, kupon değeri/süresi sunucuda kalır. Yanıt `{ "coupon": { "code", "title", "expiresAt" }, "loyalty": { … } }`. Damga yoksa **409** `not_enough_stamps`.
- `GET /coupons` → `{ "coupons": [ { "id", "code", "title", "body", "kind", "value", "minSpendMinor", "expiresAt", "usedAt" } ] }` (mevcut `listCustomerCoupons`).
- `POST /promo/preview { "code", "subtotalMinor" }` → `{ "ok": true, "code", "discountMinor" } | { "ok": false, "message" }` (mevcut `previewPromoAction` mantığı; hız sınırı `promo-preview`).
- Davet: `POST /invite/claim { "code" }` (kimlik gerekli; yalnız hiç siparişi olmayan hesap) → `{ "ok": true }`. Davet eden, davetlinin **ilk ödenmiş siparişinde** +1 ücretsiz içecek kuponu alır; davetli de ilk siparişinde alır (`invites` tablosu: `code, inviterEmail, inviteeEmail, status: pending|joined|rewarded, createdAt, rewardedAt`).

> **Uygulama notu (§5).** `/loyalty/redeem` kupon `expiresAt` boşsa `null`; damga bakiyesi her
> zaman ledger'dan hesaplanır (`available = earn − stampTarget·redeem`), redeem satırı
> `loyalty_stamps.source = "app"`. Redeem satırları **o anki** hedefle çarpılır: panelde
> hedef değişirse geçmiş kartlar da yeni hedefle okunur (ledger'da hedef saklanmaz). `/invite/claim` hataları: **404** `invite_not_found` ·
> **400** `own_invite` · **409** `invite_already_claimed` · **409** `invite_not_eligible`
> (siparişi olan hesap). `invites.status` `joined` hiç yazılmaz: claim → `pending`, davetlinin
> ilk ödenmiş siparişi → `rewarded` (iki tarafa panelde tanımlı ücretsiz içecek kuponu —
> `rewardTitle` / `rewardValueMinor` / `rewardTtlDays`, varsayılan 280₺ · 90 gün — `source: "invite"`).
> `/me.invite.joined` = pending olmayan satır sayısı, `earned` = rewarded sayısı.

## 6. Canlı durum — `GET /live-status` (herkese açık)

```jsonc
{ "isOpen": true, "openLabel": "Şu an açık", "updatedAt": "…", "updatedAgoMinutes": 2,
  "freeTables": 9, "totalTables": 20, "wifi": "stable" | "slow" | "down", "noise": "low" | "medium" | "high",
  "power": true, "note": "Çalışmaya uygun — priz var, gürültü düşük",
  "hours": { "weekday": "09:00 - 01:00", "weekend": "09:00 - 01:00" },
  "karaoke": { "available": true, "label": "Rezervasyonla" } }
```

Kaynak: `venue_status` tablosu (tek satır `main`), `/admin/mobil/canli-durum` panelinden düzenlenir; `isOpen` = `manualOverride` (`"auto" | "open" | "closed"`) + `settings.weeklyHours`.
Cache: `public, s-maxage=30, stale-while-revalidate=120`.

> **Uygulama notu (§6).** Saat mantığı Europe/Istanbul; `09:00 - 01:00` gece yarısından sonra
> önceki günün kuyruğu olarak **açık** sayılır. DB ulaşılamazsa uydurma "açık" dönmez, **503**.

## 7. Karaoke

- `GET /karaoke/availability?date=YYYY-MM-DD` → `{ "date", "slots": [ { "startHour": 16, "available": true } ], "hourlyMinor": 90000, "capacity": 8, "oroDiscountPct": 15, "firstHour": 12, "closeHour": 24, "maxHours": 4, "bookingWindowDays": 60 }` (`slots` `firstHour`..`closeHour-1`; fiyat `settings.karaokeHourlyMinor`, kapasite `settings.karaokeCapacity`; `firstHour/closeHour/maxHours/bookingWindowDays/oroDiscountPct` `/admin/mobil/ayarlar` → Karaoke kuralları, §10 `settings.mobileApp.karaoke`).
- `POST /karaoke/reservations { "date", "startHour", "hours", "guests", "note" }` (kimlik) → 201 `{ "reservation": { "id", "date", "startHour", "hours", "guests", "status": "requested", "priceMinor", "discountMinor", "totalMinor", "createdAt" } }`. Çakışma **409** `slot_taken`. Tablo `karaoke_reservations`; panel `/admin/mobil/karaoke` (onayla/iptal).
- `GET /karaoke/reservations` → benimkiler.
- **409 `too_many_reservations`**: aynı anda en fazla **2** açık (`requested`/`confirmed`)
  rezervasyon (`KARAOKE_OPEN_CAP`). `slot_taken` gibi bu da kurala dayalı bir ret;
  uygulama sunucunun mesajını gösterir, tekrar denemeyi önermez.

> **Uygulama notu (§7).** `date` verilmezse İstanbul'a göre bugün; biçim bozuksa 400
> `invalid_request`. Kurallar (varsayılanlar parantezde, tümü panelden değişir):
> tarih bugün..+`bookingWindowDays` gün (60), `startHour` `firstHour`..`closeHour-1` (12–23),
> `hours` 1..`maxHours` (1–4), **`startHour + hours ≤ closeHour`** (24), `guests` 1..`capacity`,
> `note` ≤ 200 karakter. Sunucu her isteği o anki config'e göre doğrular; uygulama seçiciyi
> availability yanıtındaki alanlarla kurar, kural değişince yanıt önbelleksiz olduğu için hemen
> görür. Gövde JSON değilse 400 `invalid_request`. `requested` ve `confirmed` slotu bloke eder,
> `cancelled` etmez. Çakışma kontrolü oku-sonra-yaz (SQL kilidi yok): aynı saniyede iki istek
> ikisi de `requested` olabilir; panelde görünür, personel birini iptal eder. ORO indirimi
> (`oroDiscountPct`, %15) `/me.loyalty.tier`'dan; rezervasyon anındaki yüzde kaydedilir, sonraki
> değişiklik eski kayıtları etkilemez. Panel onay/iptali `audit_logs`'a `karaoke_reservation`
> olarak düşer.

## 8. Bildirimler — `GET /notifications` (kimlik)

`{ "items": [ { "id", "kind": "order" | "reward" | "campaign" | "announcement", "title", "body", "at", "orderId": "…" | null } ] }` — sunucu **türetir**: son 30 günün sipariş durum değişiklikleri + aktif duyurular + ödül hazırsa bir kayıt. Okundu durumu **cihazda** tutulur (`laf.notifications.readAt`).

`at` her çağrıda **aynı** anı vermek zorundadır; cihaz okundu/okunmadı kararını bu anı
`readAt` ile karşılaştırarak verir, dolayısıyla `now` yazmak kaydı sonsuza dek okunmamış
bırakır. Sipariş kayıtlarında `at` adımın kendi sütunudur (`paidAt` · `preparingAt` ·
`shippedAt` · `completedAt`), ödülde kartı dolduran damganın anıdır. 30 günlük pencere
**adım başına** uygulanır: 40 gün önce ödenip bugün teslim edilen bir sipariş bugün
kutuya "Teslim edildi" olarak düşer.

> **Uygulama notu (§8).** Sipariş için yalnız güncel durum değil, ulaşılan **her aşama**
> (paid → preparing → shipped → completed) ayrı kayıttır; id `order-<id>-<aşama>`, ödül
> kaydı `reward-ready`. `pending_payment/cancelled/refunded` sessizdir. Aşama zamanı en iyi
> bilinen an (`paidAt`/`shippedAt`/`createdAt`). Duyuru `kind: campaign` → `campaign`,
> diğerleri → `announcement`.

## 9. `GET /app-content` — mevcut (slaytlar · duyurular · gönderiler). Değişmez.

> **Uygulama notu (§9) — slayt `ctaRoute` sözlüğü.** Bir slaytın hedefi panelde
> yazılır, yani bundle dışından uygulamaya giren tek yol dizesidir; olduğu gibi
> **push edilmez**. Uygulama sabit bir izin listesiyle eşler
> (`src/lib/slide-route.ts`, `SLIDE_ROUTE_KEYS`); listede olmayan bir değer —
> yazım hatası, bu sürümde olmayan bir ekran, daha yeni bir panelden gelen bir
> yol — `null`'a düşer ve slayt eylem çağrısı olmadan çizilir.
>
> Bu sürümün anladığı 11 anahtar (panelin kendi yazımıyla):
> `/menu` · `/magaza` · `/kart` · `/hesabim` · `/oduller` · `/kampanyalar` ·
> `/karaoke` · `/canli-durum` · `/davet` · `/ziyaret` · `/hikaye`.
> (`/kart` → 15 Üyelik Kartı, `/hesabim` → Profil sekmesi; kalanlar aynı adlı ekran.)
> Baştaki/sondaki boşluk ve sondaki `/` bağışlanır; önek eşleşmesi, query dizesi
> ve dış URL yoktur.
>
> **Site tarafı kural:** panelin sunduğu `APP_SLIDE_ROUTES` bu listenin **alt
> kümesi** kalmalıdır. Panele yeni bir yol eklemek uygulamada karşılığı
> olmadan slaytı sessizce eylemsiz bırakır; önce uygulama sürümü çıkar.

## 10. `GET /bootstrap` (herkese açık)

Uygulamanın açılışta okuduğu tek belge. Mevcut alanlar **korunur** (geri uyum);
`venue.*` genişletildi ve `app` eklendi. Kaynak: `settings` satırı (Ayarlar) +
`settings."mobileApp"` jsonb belgesi (**/admin/mobil/ayarlar**, `src/lib/mobile/app-config.ts`).
Önbellek: `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600` —
panelde yapılan değişiklik uygulamaya en geç 5 dakikada ulaşır.

```jsonc
{
  "minSupportedAppVersion": "1.0.0",           // = app.minSupportedAppVersion (eski alan, korunur)
  "venue": {
    "name": "L'Affogato",
    "shortName": "Tuzla · İstanbul",             // config.venue.shortName
    "addressLines": ["Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1", "34940 Tuzla / İstanbul"],
    "landmark": "Menemenci Cumhur’un yanı",      // config.venue.landmark
    "mapsQuery": "L'Affogato, Atatürk Cad. …",   // config.venue.mapsQuery — "Yol tarifi al" bunu harita uygulamasına verir
    "phone": "+90 536 429 09 19", "email": "…", "lat": 40.8, "lng": 29.3,
    "hours": [ { "label": "Pazartesi", "value": "09:00 - 01:00" }, … ],   // 7 satır, pazartesiden pazara; kapalı gün → "Kapalı"; ardışık aynı saatler GRUPLANMAZ (uygulama gruplar)
    "opensAt": "09:00", "closesAt": "01:00"      // bugünün (Europe/Istanbul) satırı; kapalıysa "" ""
  },
  "hoursLabel": "Her gün 09:00 - 01:00",        // eski alan, korunur
  "courierFeeMinor": 5500,                        // eski alan (Ayarlar → Kargo → Kurye ücreti)
  "courierEtaMinutes": [25, 35],                  // = app.ordering.courierEtaMinutes (eski alan, korunur)
  "happyHour": null,                              // panelden açılana kadar null (Mobil Uygulama → Ayarlar → Mutlu saatler); indirim kasada elle uygulanır
  "app": {                                        // MobileAppConfig'in uygulamaya açık kısmı
    "minSupportedAppVersion": "1.0.0",            // semver; uygulama kendi sürümünü karşılaştırır, küçükse zorunlu güncelleme
    "maintenance": { "enabled": false, "title": "Kısa bir mola", "message": "Uygulama bakımda. Birazdan yine buradayız." },
    "ordering": {
      "cafeEnabled": true,                        // false → "Sepete ekle" kapalı; sunucu 409 ordering_closed
      "deliveryEnabled": true, "pickupEnabled": true,   // false → ilgili teslimat seçeneği gizli; sunucu 400 fulfillment_unavailable
      "courierEtaMinutes": [25, 35],
      "closedMessage": "Uygulamadan sipariş şu an kapalı. Köşkte görüşürüz."
    },
    "loyalty": { "stampTarget": 6, "rewardTitle": "Ücretsiz içecek" },   // kupon değeri/süresi sunucuda kalır
    "reminders": {
      "enabled": true,                            // false → uygulama hatırlatma anahtarını gizler, planlananları iptal eder
      "items": [ { "id": "morning", "hour": 10, "minute": 0, "title": "Günaydın ☕", "body": "Sabah kahven köşkte hazır. Bugün ne içiyoruz?" } ]   // 0..4 öğe; fiyat/indirim/aciliyet dili yok
    },
    "campaignCards": { "loyalty": true, "invite": true, "subscription": true },  // Kampanyalar ekranındaki sabit kartlar; "subscription" artık hiçbir kartı çizmez (karar 20)
    "store": { "appStoreUrl": "", "playStoreUrl": "" }   // /admin/mobil/ayarlar → Mağaza. Zorunlu güncelleme ekranındaki düğme buraya gider; boşken düğme çizilmez. Yalnız listeleme adresleri — imza parmak izleri sitenin işidir, uygulamaya gitmez
  }
}
```

- `addressLines` **iki satırdır**: sokak, sonra ilçe. Ayarlar'daki adres tek bir
  dizedir ve sokak, çevre tarifi ve ilçeyi birlikte taşır, o yüzden sitenin
  footer'ıyla aynı ayırıcıdan geçer (`addressLines()`): parantez içi düşer,
  virgül ve satır sonlarından bölünür, `/` bölmez. İkinci satır her zaman
  künyeden gelir (`34940 Tuzla / İstanbul`), böylece posta kodu hep vardır ve
  ilçe iki kez yazılmaz. Adres **vergi levhasındaki** adrestir (tasarımdaki
  "29 Ekim Cad." eskidir).
- `app` **karaoke** kurallarını ve `venue`'yü taşımaz: karaoke alanları
  `GET /karaoke/availability` ile (§7), köşk alanları `venue.*` ile gelir.
- Uygulama tarafı: `app` ya da yeni `venue` alanları eksik gelirse (eski
  dağıtım) her alan kendi varsayılanına düşer; `app` hiç yoksa tümü varsayılan.

---

## 11. Veritabanı ekleri (site: `db/migrations/20260902*.sql`)

Ev stili: `text` id, çift tırnaklı camelCase, kuruş integer, ISO text, RLS açık, **`_migrations` insert'i YAZILMAZ**.

```sql
alter table public.orders   add column if not exists channel        text not null default 'web';
alter table public.orders   add column if not exists kind           text not null default 'shop';
alter table public.orders   add column if not exists fulfillment    text not null default 'shipping';
alter table public.orders   add column if not exists "scheduledFor" text not null default '';
alter table public.orders   add column if not exists "deliveryNote" text not null default '';
alter table public.orders   add column if not exists "paidAt"       text not null default '';
alter table public.settings add column if not exists "courierFeeMinor"     integer not null default 5500;
alter table public.settings add column if not exists "karaokeHourlyMinor"  integer not null default 90000;
alter table public.settings add column if not exists "karaokeCapacity"     integer not null default 8;
alter table public.customers add column if not exists "supabaseUserId" text not null default '';
alter table public.customers add column if not exists "inviteCode"     text not null default '';
alter table public.customers add column if not exists "invitedBy"      text not null default '';
alter table public.customers add column if not exists usual           jsonb not null default 'null'::jsonb;
create unique index if not exists customers_invite_code_key on public.customers ("inviteCode") where "inviteCode" <> '';

create table if not exists public.loyalty_stamps ( id text primary key, "customerEmail" text not null, kind text not null, -- earn | redeem
  delta integer not null, source text not null default 'order', -- order | counter | invite | admin
  "orderId" text not null default '', note text not null default '', actor text not null default '', "createdAt" text not null default '' );
create index if not exists loyalty_stamps_email_idx on public.loyalty_stamps (lower("customerEmail"));
create unique index if not exists loyalty_stamps_order_key on public.loyalty_stamps ("orderId") where "orderId" <> '' and kind = 'earn';
alter table public.loyalty_stamps enable row level security;

create table if not exists public.invites ( id text primary key, code text not null, "inviterEmail" text not null, "inviteeEmail" text not null,
  status text not null default 'pending', "createdAt" text not null default '', "rewardedAt" text not null default '' );
create unique index if not exists invites_invitee_key on public.invites (lower("inviteeEmail"));
alter table public.invites enable row level security;

create table if not exists public.venue_status ( id text primary key default 'main', "manualOverride" text not null default 'auto',
  "freeTables" integer not null default 0, "totalTables" integer not null default 20, wifi text not null default 'stable',
  noise text not null default 'medium', power boolean not null default true, note text not null default '', "updatedAt" text not null default '' );
alter table public.venue_status enable row level security;

create table if not exists public.karaoke_reservations ( id text primary key, "customerEmail" text not null, "customerName" text not null default '',
  date text not null, "startHour" integer not null, hours integer not null default 1, guests integer not null default 2,
  status text not null default 'requested', -- requested | confirmed | cancelled
  "priceMinor" integer not null default 0, "discountMinor" integer not null default 0, "totalMinor" integer not null default 0,
  note text not null default '', "createdAt" text not null default '', "updatedAt" text not null default '' );
create index if not exists karaoke_reservations_date_idx on public.karaoke_reservations (date);
alter table public.karaoke_reservations enable row level security;
```

> **Uygulama notu (§11).** Migration `db/migrations/20260902100000_mobile_orders_loyalty_venue.sql`;
> ek olarak `customers."supabaseLinkAttemptedAt"`, `customers_supabase_user_idx` ve
> `karaoke_reservations_email_idx`. `loyalty_stamps.source` değer sözlüğüne `app` eklendi;
> `customer_coupons.source` `invite` değerini alır (sütun serbest metin, DDL değişikliği yok).
> `audit_logs.entity` iki yeni değer: `venue_status`, `karaoke_reservation`.
> 5 Eyl 2026: `db/migrations/20260905120000_mobile_app_config.sql` →
> `settings."mobileApp" jsonb not null default '{}'` (§10; anahtarlar
> `src/lib/mobile/app-config.ts` ile varsayılana tamamlanır) ve `audit_logs.entity`
> değeri `mobile_app_config` (`entityId` = kaydedilen bölüm).

## 12. Uygulama tarafı eşleme (özet)

| Ekran                                      | Uç                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 03 Ana Sayfa                               | `/app-content` · `/menu` · `/live-status` · `/me` · `/orders` (reorder) · `/shop` (beans) · `/bootstrap` |
| 04–07 Menü→Sepet                           | `/menu` (+customization) · sepet **cihazda** (`laf.cart.v1`)                                             |
| 08 Sepet · 09 Ödeme                        | `/orders/preview` · `/promo/preview` · `/me` (adresler) · `POST /orders` → `expo-web-browser`            |
| 10–11 Sipariş No · Takip                   | `/orders/{id}` (15 sn'de bir yenile, `completed`'da durur)                                               |
| 12–13 Mağaza                               | `/shop`                                                                                                  |
| 14 Ödüller · 15 Kart · 20 Pasaport         | `/me.loyalty` · `/loyalty/redeem` · `/coupons`                                                           |
| 16 Profil · 24 Bildirimler · 25 Adreslerim | `/me` · `PATCH /me` · `/me/addresses*` · `/notifications`                                                |
| 17 Canlı Durum                             | `/live-status` · `/bootstrap`                                                                            |
| 18 Kampanyalar                             | `/app-content.posts` (kind campaign) + sabit kartlar (`/bootstrap.app.campaignCards`) · `/promo/preview` |
| 19 Davet                                   | `/me.invite` · `Share`                                                                                   |
| 21 Sipariş Geçmişi                         | `/orders`                                                                                                |
| 22 Cüzdan · 23 Hediye Kartı                | **Yazılmadı** (karar 20) — uç yok; ekran da "yakında" düğmesi de çizilmez                                |
| 26 Karaoke                                 | `/karaoke/availability` (kurallar dahil) · `POST /karaoke/reservations`                                  |
| 27 Ziyaret                                 | `/bootstrap.venue` (adres, yer tarifi, harita sorgusu, 7 günlük saat tablosu) — seed yedek               |
| 28 Hikâye                                  | `/story` (§16) — seed yedek                                                                              |
| Kök yerleşim (bakım · zorunlu güncelleme)  | `/bootstrap.app.maintenance` · `/bootstrap.app.minSupportedAppVersion` — bootstrap gelmezse kapı açık    |
| Hatırlatmalar (cihaz bildirimi)            | `/bootstrap.app.reminders` — `enabled=false` → anahtar gizli, planlananlar iptal                         |

## 13. Hukuki belgeler — `GET /legal` · `GET /legal/{slug}` (herkese açık)

Uygulama kendi sözleşme kopyasını yazmaz. Sipariş kaydı sitenin sözleşme
revizyonuna rıza kaydeder; iki taraf farklı metin gösterirse o kayıt anlamsız
kalır. Bu yüzden tek kaynak `src/lib/legal/content.ts`'tir ve mobil onu okur.

**`GET /api/mobile/v1/legal`** — 24 belgelik dizin.

```json
{
  "updatedAt": "1 Eylül 2026",
  "consentDocs": ["on-bilgilendirme-formu", "mesafeli-satis-sozlesmesi"],
  "docs": [
    {
      "slug": "...",
      "title": "...",
      "shortTitle": "...",
      "category": "Sipariş",
      "summary": "..."
    }
  ]
}
```

**`GET /api/mobile/v1/legal/{slug}`** — tek belgenin tam metni; bilinmeyen slug
`404 not_found`. İkisi de `force-dynamic` ve `public, s-maxage=300,
stale-while-revalidate=3600` ile yayınlanır (bootstrap ile aynı pencere);
kimlik istemez.

### Panel geçersiz kılması (`/admin/hukuk`)

Sitede `/hukuk/<slug>` ne gösteriyorsa uygulama da onu gösterir: panelden
**yayınlanmış ve gövdesi dolu** bir geçersiz kılma varsa `title`, `summary`,
`updatedAt` (= panel "yürürlük tarihi", boşsa `LEGAL_UPDATED`) ve `sections`
oradan gelir; dizin de aynı başlık/özet/tarihi yansıtır (`consentDocs` ve üst
`updatedAt` revizyon etiketi değişmez). Taslak ya da boş geçersiz kılma
sayılmaz; slug kümesi her zaman kodlu kayıttır (panel yeni belge üretmez).
Gövde Markdown'dır ve `src/lib/mobile/legal-markdown.ts` bölümlere çevirir:
`## ` / `### ` → `heading`, `- ` / `* ` → `bullets`, `1. ` / `1) ` →
`ordered`, diğer satırlar → `paragraphs` (ardışık satırlar birleşir, boş satır
paragrafı kapatır), `**kalın**` işaretleri düşer, ilk başlıktan önceki metin
`shortTitle` başlığı altında toplanır; `references` düşer. Veritabanına
ulaşılamazsa iki uç da kodlu belgeye döner — 5xx vermez.

### Çevrimdışı taban

`npm run legal:export` (site deposu) `scripts/legal-export.mjs`'yi çalıştırıp
`laffogato-mobil/src/data/legal.seed.json` üretir: 24 belgelik dizin + **14
belgenin tam metni** (`BUNDLED_SLUGS`). Paketlenen 14, uygulamanın içeriden
bağlandığı belgelerdir — ağ yokken de açılabilmeleri gerekir:

| Nerede bağlanır        | Belge                                                  |
| ---------------------- | ------------------------------------------------------ |
| Kayıt onay kutusu      | `uyelik-sozlesmesi` · `kvkk-aydinlatma-metni`          |
| Kayıt, ileti onayı     | `ticari-elektronik-ileti`                              |
| Ödeme onay satırı      | `on-bilgilendirme-formu` · `mesafeli-satis-sozlesmesi` |
| Ödeme, cayma bildirimi | `iade-ve-cayma`                                        |
| Ürün detayı, alerjen   | `gida-guvenligi-ve-alerjen`                            |

Sözleşme metni sitede değiştiğinde `npm run legal:export` yeniden çalıştırılır
ve mobil depoya ayrı bir commit olarak girer. Seed dosyası **elle
düzenlenmez**.

### Rıza kaydı (kayıt akışı)

Uygulama hesabı oluştururken onay kutusunun işaretlendiği anı Supabase
kullanıcı meta verisine yazar: `terms_accepted_at`, `marketing_consent_at`
(ISO-8601, işaretlenmediyse boş). `planCustomerLink` bu iki alanı
`customers.termsAcceptedAt` / `marketingConsentAt` sütunlarına kopyalar.
**Meta veri yoksa sütun boş kalır** — sunucu artık "hesap açıldığına göre
sözleşme kabul edilmiştir" varsayımını yapmaz. Ticari ileti onayı ayrıdır ve
`notificationPrefs.marketing` anahtarını da o belirler.

## 14. `POST /me/favorites` (kimlik) — favori aç/kapat

Sitede `/uye/hesap/favorilerim` sayfası ve `customers.wishlist` sütunu vardı;
mobil sözleşme bunu hiç taşımıyordu. Sonuç: laffogato.net'te kalbe bastığın
ürün uygulamada görünmüyordu, uygulamadaki "Favorilerim" ise yalnızca
"yakında" diyordu — tek üye, iki cevap.

**`GET /me`** artık `customer.wishlist: string[]` içeriyor (ürün id'leri).

**`POST /api/mobile/v1/me/favorites`**

```json
{ "productId": "prd-0001" }
```

Yanıt: `{ "productId": "prd-0001", "isFavorite": true }`.
`Cache-Control: private, no-store`. Bilinmeyen üye → `404 not_found`.

**Neden toggle, neden liste yazımı değil:** site aynı listeyi aynı yardımcıdan
(`toggleWishlist`) düzenliyor. İki yüzey aynı anda dokunduğunda her biri tek
kalemi değiştirir; liste yazımı olsaydı biri diğerinin listesini ezerdi.
Yanıt hangi yöne gittiğini söylüyor, böylece uygulama varsaymak yerine
doğruluyor (iyimser güncelleme yanlış çıkarsa önbellek düzeltiliyor).

## 15. Kayıtlı kart — kart **bizde durmaz**; v1'de hiçbir yerde durmaz

Operatör talimatı (3 Eyl): _"Kart bizim sistemde kaydedilmesin, ödeme
sağlayıcıda kaydedilecek."_ Uygulama da site de tam olarak böyle çalışır.

**Kartın gitmediği yerler:** uygulama paketi, uygulamanın belleği, kafenin
sunucusu, Neon veritabanı, loglar. Kart numarası (PAN), son kullanma tarihi ve
CVV **sağlayıcının kendi barındırdığı ödeme sayfasında** girilir ve orada
kalır. Uygulama o sayfayı `expo-web-browser` ile açar; formun HTML'i bize ait
değildir. Sağlayıcının adı burada bilerek geçmiyor: hangi PSP'nin kullanıldığı
sunucu ayarıdır (`PAYMENT_PROVIDER`) ve bir kez zaten değişti.

**v1'de kart saklama KAPALI.** Üretimdeki sağlayıcıda (PayNkolay) kart saklama
kapsam dışı bırakıldı: alan adının üç ayrı yazımı dokümante edilmiş ve saklanan
kartın anahtarının yanıtta hangi alanla döndüğü hiçbir sayfada yazmıyor (web
`docs/PAYNKOLAY.md` §9.1). Bu yüzden ödeme formuna `customerKey` **boş dize**
gider ve `confirmReturn` `cardUserKey` **döndürmez** — yani üye her siparişte
kart bilgisini yeniden girer. Uygulama metinleri bunu böyle söylüyor
(`checkout.cardHint`, `addresses.cardNotStored`); "sonraki siparişte kartın
hazır gelir" cümlesi tutulamayacağı için kaldırıldı.

**Mekanizma duruyor, beslenmiyor.** `customers."cardUserKey"` sütunu ve onu
yazan/okuyan yol yerinde: sağlayıcı bir gün anahtar döndürdüğünde tablo
aşağıdaki gibi işler, o güne kadar hiçbir satırda anahtar oluşmaz.

| Adım                     | Ne olur                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Ödeme açılır             | Elimizde anahtar varsa sağlayıcıya gönderilir; form üyenin daha önce kaydettiği kartları listeler.                  |
| Üye "kartımı kaydet" der | Kartı sağlayıcı saklar. Biz görmeyiz.                                                                               |
| Ödeme döner              | `confirmReturn` yanıtında `cardUserKey` gelir; `rememberCardUserKey` onu satıra yazar.                              |
| Üye kutuyu işaretlemez   | Yanıtta anahtar gelmez. **Boş anahtar, kayıtlı anahtarı asla silmez** — yoksa üye eski kartlarını kaybederdi.       |
| Hesap silinir            | `cardUserKey` boşaltılır (`deleteMe`). Adres yeniden kayda açıldığında sonraki kişi öncekinin kartlarını devralmaz. |

**`/me` bu anahtarı taşımaz** ve `PublicCustomer` tipinde yer almaz — sunucunun
ihtiyacı olan bir değer istemciye verilmez. `tests/saved-cards.test.ts` bunların
hepsini sabitler: `/me` çıktısında anahtar yok, tipte yok, silmede boşalıyor,
şemada kart alanı (`cardNumber`, `cvv`, `cvc`, `expiryMonth`) yok.

Anahtar oluştuğu gün hem uygulamada hem sitede aynısı kullanılır: tek üye, tek
kart seti.

## 16. `GET /story` — hikâye (herkese açık)

Uygulamanın Hikâye ekranı kurucu satırını, zaman çizelgesini ve basın
alıntılarını kendi içinde taşıyordu; üçü de sitede düzenleniyor (Site
Metinleri · /admin/hikaye · /admin/basin), bir yıl değişince iki yüzey ayrıştı.
Tek kaynak site; uygulama paketlenmiş kopyayı yalnız çevrimdışı yedek olarak
tutar (API-first, seed yedek).

```jsonc
{
  "founder": { "name": "Eda Mancuso", "role": "Founder & Roaster", "bio": "…" },
  "milestones": [{ "year": "1897", "title": "Bologna · 1897", "body": "…" }],
  "press": [{ "name": "Monocle", "quote": "…" }],
}
```

| Alan         | Kaynak                                                                                                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `founder`    | `site_content` → `story.founder.name` · `story.founder.role` · `story.founder.bio` (Site Metinleri, grup **Hikaye**); yoksa `content-fields.ts` varsayılanı = `STORY.founder` |
| `milestones` | `listActiveStoryEvents()` — yalnız aktif satırlar, `sortOrder` sırasıyla; `id/isActive/sortOrder/createdAt/updatedAt` **yayılmaz**                                            |
| `press`      | `listActivePress()` — aynı kural                                                                                                                                              |

Runtime `nodejs` · `force-dynamic` · `maxDuration 15`. Kimlik istemez.
Cache: `public, s-maxage=300, stale-while-revalidate=3600` — panel değişikliği
en geç 5 dakikada ulaşır. Site: `src/lib/mobile/story.ts` (`buildStory` saf eşleyici,
`getStory` yükleyici), `src/app/api/mobile/v1/story/route.ts`, `tests/mobile-story.test.ts`.

> **Uygulama notu (§16).** Metinler kırpılmış (`trim`) döner; boş alan `""`, boş liste
> `[]` (asla `null`). Veritabanı ulaşılamazsa zaman çizelgesi ve basın seed'e, kurucu
> metinleri varsayılana düşer (`publicRead` / `getSiteContent` davranışı); yalnız
> beklenmedik bir bağlantı hatası **503** `unavailable` olur. Boş `milestones` gelirse
> uygulama paketlenmiş zaman çizelgesini gösterir.

## 17. `POST /me/counter-token` — kasada okutulan QR (kimlik)

Üye QR'ı **gösterir**, kasiyer okutur. Tersi (kafede asılı sabit bir QR'ı üye
okutur) kasadan geçmeden damga kazanmaya açıktır: duvardaki kodun fotoğrafı
evden okutulur. Üye kimliğinden türetilen sabit bir barkod da aynı sebeple
yok — bir kez fotoğraflandığında süresiz damga üretir. Bu uç, **dönerli,
kısa ömürlü ve tek kullanımlık** bir değer üretir.

`GET` yoktur: jeton üretmek satır yazar, önceki kodları düşürür ve üyenin hız
bütçesinden düşer; hiçbiri tarayıcının ya da bir vekilin kendiliğinden
tekrarlayabileceği bir metodun arkasında durmamalı.

```jsonc
// 201 · Cache-Control: private, no-store
{
  "code": "K7P42M9X", // 8 karakter; kamera çalışmazsa kasiyer yazar
  "token": "…", // QR'ın içeriği; ham hâli YALNIZ burada döner
  "expiresAt": "2026-09-05T18:12:30.000Z",
  "ttlSeconds": 120,
  "qrSvg": "<svg …/>", // sunucu çizer (qrcode); uygulama yeni bağımlılık almaz
  "qrModules": 25, // kodun kenarındaki modül sayısı (sessiz alan hariç)
  "qrQuietZone": 4, // her kenardaki boş modül sayısı
}
```

| Kural          | Değer                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| TTL            | **120 sn**                                                                                               |
| Aynı anda      | Üye başına en fazla **3 açık jeton**; yenisi istenince eskilerin ömrü o an biter                         |
| Saklama        | Ham jeton **saklanmaz**; `counter_tokens."tokenHash"` = `sha256(token)`                                  |
| Jeton alfabesi | `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (Crockford base32), **26 karakter** = 128 bit                         |
| Kod alfabesi   | `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (O/0, I/1/L yok), 8 karakter, yalnız açık jetonlar arasında benzersiz |
| QR             | Sürüm 2, **25×25 modül**, hata düzeltme **Q** (%25), sessiz alan **4 modül**                             |
| Hız sınırı     | Üye başına **dakikada 10 jeton** → **429** `rate_limited` + `Retry-After`                                |
| Doğrulama      | E-posta doğrulanmamışsa **403** `email_unverified` (sipariş kuralıyla aynı)                              |
| Temizlik       | `expiresAt` bir günü geçmiş satırlar kasa akışında fırsatçı olarak silinir — ayrı bir cron yok           |

### Jeton neden base64url değil

QR kodlayıcı, kendisine verilen karakterlere bakarak kip seçer. Base64url
büyük ve küçük harfi karıştırdığı için yük yalnız **byte kipine** girebiliyordu:
karakter başına 8 bit, 43 karakter, hata düzeltme M ile **33×33** modül.

QR'ın *alphanumeric* kipi `0-9 A-Z` ile dokuz simgeyi kapsar ve iki karakteri
11 bite sığdırır. Entropiyi o alfabede harcamak taramaya aynı anda iki şey
kazandırır — ölçüm `qrcode` kütüphanesinin kendisinden, tahmin değil:

| Yük                 | Hata düzeltme | Sürüm | Modül     | Kurtarılabilir |
| ------------------- | ------------- | ----- | --------- | -------------- |
| 43 karakter base64url | M           | 4     | **33×33** | %15            |
| 26 karakter base32    | Q           | 2     | **25×25** | %25            |

Aynı boyutta çizilen karede daha az modül, fiziksel olarak **daha büyük**
modül demektir; kameranın en çok önemsediği şey budur. Boşalan kapasite de
doğrudan hata düzeltmeye gider — telefon ekranındaki parlama ve parmak izini
kaldıran şey odur. 32 yerine 16 bayt: bu, üye başına hız sınırının arkasında
120 saniye yaşayan tek kullanımlık bir değer, yani 128 bit kendi ömrü içinde
tahmin edilebilecek her şeyin çok ötesinde.

Jetonun **şeklini kimse okumaz** — uygulama SVG'yi çizer, kasa çözdüğü diziyi
olduğu gibi gönderir, sunucu `sha256` karşılaştırır. Bu yüzden eski sürümün
ürettiği jetonlar kendi süreleri dolana kadar çalışmaya devam eder.

`qrModules` ve `qrQuietZone` **eklemedir**: eski bir yapı ikisini de yok sayar
ve SVG'yi seçtiği boyutta çizmeye devam eder. Yeni yapı, çizim boyutunu
`(qrModules + 2 × qrQuietZone)` katına yuvarlayarak modül kenarlarının
kesirli piksele düşmesini ve bulanıklaşmasını önler.

Hatalar: **401** `unauthorized` · **403** `email_unverified` · **429**
`rate_limited` · **503** `unavailable`.

### Kasa tarafı (panel, `/admin/kasa`)

Okutma bir API ucu değil, `redeemCounterTokenAction` sunucu eylemidir
(`requireRole("till")` hem sayfada hem eylemde). Üç yol — kamera · kod ·
e-posta — aynı eylemde birleşir ve `stamps` (1–5) kadar `loyalty_stamps`
satırı yazar (`source: "counter"`, not `Kasa · QR` / `Kasa · kod` /
`Kasa · e-posta`).

| Sonuç            | Türkçe karşılık                                            |
| ---------------- | ---------------------------------------------------------- |
| `expired`        | "Bu kodun süresi doldu. Üyeden yeni QR göstermesini iste." |
| `already_used`   | "Bu kod kullanıldı. Aynı QR ikinci kez damga vermez."      |
| `not_found`      | "Kod bulunamadı. Kodu kontrol et ya da e-posta ile ara."   |
| `invalid_email`  | "Geçerli bir üye e-postası gir."                           |
| `invalid_stamps` | "Damga sayısı 1 ile 5 arasında olmalı."                    |

Kamera her tarayıcıda çalışır. Tercih sırası `BarcodeDetector` (Chrome/Edge,
donanım hızlandırmalı) → **jsQR** (saf JavaScript, yalnız ilki yoksa dinamik
olarak yüklenir). İkincisi olmadan Safari — yani bir iPad kasa — "bu cihaz QR
okumayı desteklemiyor" diyor ve kasiyeri her üye için 8 karakter yazmaya
bırakıyordu. Kod çözme, nişangâhın gösterdiği **merkez kareye** (kısa kenarın
%78'i) kırpılıp 480 px'e indirilerek yapılır; kare, `requestVideoFrameCallback`
varsa kameranın ürettiği her karede okunur.

Aynı QR saniyede onlarca kare boyunca lensin önünde durur, bu yüzden okuma
kapısı üç durumu ayırır: **bekleme** (aynı değer 2,5 sn boyunca yeniden
gönderilmez), **harcandı** (sunucu jetonu tükettiyse o değer bir daha asla
gönderilmez — tek kullanımlık bir kodu tekrar göndermek başarılı bir okumaya
"bu kod kullanıldı" yanıtı verdirirdi) ve **başarısız** (ağ hatası; değer
hemen yeniden okunabilir).

Tek kullanım koşullu UPDATE ile sağlanır (`where "usedAt" = ''`): aynı QR'ı
aynı saniyede okutan iki kasa da ayrı bir okuma kontrolünden geçer, ama
yalnız biri satırı günceller — 0 satır dönen `already_used` olur ve damga
yazılmaz. Kasiyer üyenin e-postasının tamamını **görmez** (`e***@ornek.com`);
e-posta yolunda adresi zaten kendisi yazdığı için maskeleme uygulanmaz.

> **Uygulama notu (§17).** `token` yalnız yanıt gövdesinde bulunur, uygulama
> onu saklamaz; süre dolmadan ~10 sn önce yeni jeton istenir. 429 gelirse
> `Retry-After` kadar beklenir, elde eski bir QR varsa **gösterilmez** — süresi
> dolmuş bir kod kasada "süresi doldu" der ve kuyruğu yavaşlatır.
