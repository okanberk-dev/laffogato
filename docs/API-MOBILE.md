# API-MOBILE — laffogato.net ↔ uygulama sözleşmesi (v1)

> Bu belge iki deponun ortak sözleşmesidir. Site tarafı `RiosenBeq/laffogato`
> (`src/app/api/mobile/v1/**`), uygulama tarafı `src/data/http.ts` +
> `src/data/queries.ts` bu belgeye göre yazılır. **Belge önce, kod sonra.**
> Kopyası site deposunda `docs/API-MOBILE.md` olarak durur; ikisi aynı olmalı.

Kaynak tasarım: operatörün Claude Design belgesi "Laffogato App v2" (28 ekran).
Karar kayıtları: `docs/DESIGN-UYGULAMA.md`.

---

## 0. Genel kurallar

| Kural        | Değer                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Taban        | `https://laffogato.net/api/mobile/v1` (`EXPO_PUBLIC_API_BASE_URL`)                                                                                                 |
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
Abonelik ("2 haftada bir, %10") **v1'de yok** — uygulama anahtarı gösterir, "yakında" der (karar 8).

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
- `settings.isShopOpen === false` → **409** `shop_closed`. Kafe siparişi için köşk kapalıysa (`live-status.isOpen === false`) **409** `cafe_closed`.
- Sipariş satırı `orders` tablosuna **mevcut şekliyle** yazılır; ek sütunlar: `channel = "app"`, `kind`, `fulfillment`, `scheduledFor`, `deliveryNote`. Satır `items[]` öğesine `menuItemId`, `size`, `options` eklenir (jsonb — geriye uyumlu).
- Ödeme: mevcut `getPaymentProvider().createCheckoutSession()`; `successUrl = https://laffogato.net/odeme/donus?app=1`, `failureUrl = https://laffogato.net/odeme/app-hata`. Uygulama `redirectUrl`'i `expo-web-browser` ile açar; dönüş sayfası **`laffogato://siparis/<id>`** derin bağlantısına yönlendirir (sayfa `app=1` görünce).
- Sadakat: sipariş **`paid`** olunca (`applyPaymentSucceeded`) `channel === "app" && kind === "cafe"` ise **+1 damga** (`loyalty_stamps`, kind `earn`, `orderId` benzersiz → idempotent).

> **Uygulama notu (POST /orders).**
>
> - Hata kodları — 400: `invalid_json`, `invalid_body` (Zod), `invalid_address`,
>   `invalid_line` (L boyu yok / bilinmeyen seçenek / pasif ürün), `line_not_found`,
>   `qty_too_high` (satır başına en fazla 99, en fazla 30 satır), `empty_cart`;
>   403: `email_unverified`; 409: `shop_closed`, `cafe_closed`, `out_of_stock`.
> - `shop_closed` uygulamanın **her** siparişine (kafe dahil) uygulanır; kafe için ayrıca
>   `cafe_closed` — kontrol `scheduledFor` varsa o anda, yoksa şimdi; manuel override her
>   durumda geçerli.
> - `totalMinor === 0` (kupon toplamı sıfırladı) → sipariş sunucuda anında `paid`
>   (`payment_transactions.provider = "free"`), `payment: null`.
> - `scheduledFor`: geçmiş (5 dk tolerans) ve 7 günden ileri → 400. `""`/`null` = en kısa sürede.
> - Kafe + mağaza karışık sepet → 400 (teslimat türü ikisini birden karşılayamaz).
> - Mağaza satırındaki `note` (öğütüm) `items[].detail` alanında taşınır.
> - `items[].options` sunucuda tam `LineOptions` nesnesi (varsayılanlarla) olarak döner.
> - `timeline` anahtarları teslimata göre: delivery `received/preparing/on_the_way/delivered`
>   · pickup `received/preparing/ready/picked_up` · shipping `received/preparing/shipped/delivered`.
>   `statusLabel` bu adımdan gelir (pickup + shipped → "Hazır — gel al").
> - `etaMinutes`: delivery paid/preparing 35, shipped 10 · pickup 15 / 0 · shipping null.
> - Dönüş sayfası `/odeme/donus` app siparişini `app=1` parametresine ek olarak
>   `orders.channel === "app"` ile de tanır (iyzico callback URL'i sabittir);
>   `laffogato://siparis/<id>?status=success|failed` derin bağlantısına 303 ile yönlendirir.
>   Başarısız ödeme `/odeme/app-hata?orderId=…` sayfasına iner, o da aynı derin bağlantıyı verir.

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
    "stamps": 4,                 // dolu damga (0–5); 6. damga ödüle dönüşür
    "stampTarget": 6,
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
Hesap silme: `DELETE /me` → Neon satırı anonimleştirilir + Supabase oturumu istemcide kapatılır (mağaza zorunluluğu).

> **Uygulama notu (§4).** `PATCH /me` 400 `unknown_menu_item` (usual pasif/yok) ·
> `invalid_request` · `invalid_json`. Adres uçları: `POST /me/addresses` **201**, hata
> 404 `address_not_found` · 400 `invalid_address`. `DELETE /me` → **200** `{ "ok": true }`;
> yalnız Neon satırı anonimleştirilir (`deleted-<id>@anon.local`, kişisel alanlar boş,
> `isActive=false`, davet kodu serbest) — Supabase kullanıcısı **silinmez** (service role
> yok), oturumu uygulama kapatır. `neighbourhood` sütunu yoktur: `line1`'e
> `"<mahalle>, <satır>"` olarak katlanır, okurken `Mah.`/`Mahallesi`/`Mh.` sonekiyle ayrıştırılır.
> `loyalty.badges` ve `tier` yalnız `paid/preparing/shipped/completed` siparişleri sayar
> (ödenmemiş/iptal/iade sayılmaz).

## 5. Sadakat

- `POST /loyalty/redeem` → 6 damga → **ücretsiz içecek kuponu** (`customer_coupons`, `source: "loyalty"`, `kind: "fixed"`, `value: 28000`, `title: "Ücretsiz içecek"`, 90 gün). Yanıt `{ "coupon": { "code", "title", "expiresAt" }, "loyalty": { … } }`. Damga yoksa **409** `not_enough_stamps`.
- `GET /coupons` → `{ "coupons": [ { "id", "code", "title", "body", "kind", "value", "minSpendMinor", "expiresAt", "usedAt" } ] }` (mevcut `listCustomerCoupons`).
- `POST /promo/preview { "code", "subtotalMinor" }` → `{ "ok": true, "code", "discountMinor" } | { "ok": false, "message" }` (mevcut `previewPromoAction` mantığı; hız sınırı `promo-preview`).
- Davet: `POST /invite/claim { "code" }` (kimlik gerekli; yalnız hiç siparişi olmayan hesap) → `{ "ok": true }`. Davet eden, davetlinin **ilk ödenmiş siparişinde** +1 ücretsiz içecek kuponu alır; davetli de ilk siparişinde alır (`invites` tablosu: `code, inviterEmail, inviteeEmail, status: pending|joined|rewarded, createdAt, rewardedAt`).

> **Uygulama notu (§5).** `/loyalty/redeem` kupon `expiresAt` boşsa `null`; damga bakiyesi her
> zaman ledger'dan hesaplanır (`available = earn − 6·redeem`), redeem satırı
> `loyalty_stamps.source = "app"`. `/invite/claim` hataları: **404** `invite_not_found` ·
> **400** `own_invite` · **409** `invite_already_claimed` · **409** `invite_not_eligible`
> (siparişi olan hesap). `invites.status` `joined` hiç yazılmaz: claim → `pending`, davetlinin
> ilk ödenmiş siparişi → `rewarded` (iki tarafa 280₺ "Ücretsiz içecek", `source: "invite"`).
> `/me.invite.joined` = pending olmayan satır sayısı, `earned` = rewarded sayısı.

## 6. Canlı durum — `GET /live-status` (herkese açık)

```jsonc
{ "isOpen": true, "openLabel": "Şu an açık", "updatedAt": "…", "updatedAgoMinutes": 2,
  "freeTables": 9, "totalTables": 20, "wifi": "stable" | "slow" | "down", "noise": "low" | "medium" | "high",
  "power": true, "note": "Çalışmaya uygun — priz var, gürültü düşük",
  "hours": { "weekday": "09:00 – 01:00", "weekend": "09:00 – 01:00" },
  "karaoke": { "available": true, "label": "Rezervasyonla" } }
```

Kaynak: `venue_status` tablosu (tek satır `main`), `/admin/mobil/canli-durum` panelinden düzenlenir; `isOpen` = `manualOverride` (`"auto" | "open" | "closed"`) + `settings.weeklyHours`.
Cache: `public, s-maxage=30, stale-while-revalidate=120`.

> **Uygulama notu (§6).** Saat mantığı Europe/Istanbul; `09:00 – 01:00` gece yarısından sonra
> önceki günün kuyruğu olarak **açık** sayılır. DB ulaşılamazsa uydurma "açık" dönmez, **503**.

## 7. Karaoke

- `GET /karaoke/availability?date=YYYY-MM-DD` → `{ "date", "slots": [ { "startHour": 16, "available": true } ], "hourlyMinor": 90000, "capacity": 8, "oroDiscountPct": 15 }` (saatler 12–24, `settings.karaokeHourlyMinor`).
- `POST /karaoke/reservations { "date", "startHour", "hours", "guests", "note" }` (kimlik) → 201 `{ "reservation": { "id", "date", "startHour", "hours", "guests", "status": "requested", "priceMinor", "discountMinor", "totalMinor", "createdAt" } }`. Çakışma **409** `slot_taken`. Tablo `karaoke_reservations`; panel `/admin/mobil/karaoke` (onayla/iptal).
- `GET /karaoke/reservations` → benimkiler.

> **Uygulama notu (§7).** `date` verilmezse İstanbul'a göre bugün; biçim bozuksa 400
> `invalid_request`. Kurallar: tarih bugün..+60 gün, `startHour` 12–23, `hours` 1–4,
> **`startHour + hours ≤ 24`**, `guests` 1..`capacity`, `note` ≤ 200 karakter. Gövde JSON
> değilse 400 `invalid_request`. `requested` ve `confirmed` slotu bloke eder, `cancelled` etmez.
> Çakışma kontrolü oku-sonra-yaz (SQL kilidi yok): aynı saniyede iki istek ikisi de
> `requested` olabilir; panelde görünür, personel birini iptal eder. ORO %15 indirimi
> `/me.loyalty.tier`'dan. Panel onay/iptali `audit_logs`'a `karaoke_reservation` olarak düşer.

## 8. Bildirimler — `GET /notifications` (kimlik)

`{ "items": [ { "id", "kind": "order" | "reward" | "campaign" | "announcement", "title", "body", "at", "orderId": "…" | null } ] }` — sunucu **türetir**: son 30 günün sipariş durum değişiklikleri + aktif duyurular + ödül hazırsa bir kayıt. Okundu durumu **cihazda** tutulur (`laf.notifications.readAt`).

> **Uygulama notu (§8).** Sipariş için yalnız güncel durum değil, ulaşılan **her aşama**
> (paid → preparing → shipped → completed) ayrı kayıttır; id `order-<id>-<aşama>`, ödül
> kaydı `reward-ready`. `pending_payment/cancelled/refunded` sessizdir. Aşama zamanı en iyi
> bilinen an (`paidAt`/`shippedAt`/`createdAt`). Duyuru `kind: campaign` → `campaign`,
> diğerleri → `announcement`.

## 9. `GET /app-content` — mevcut (slaytlar · duyurular · gönderiler). Değişmez.

## 10. `GET /bootstrap` (herkese açık)

`{ "minSupportedAppVersion": "1.0.0", "venue": { "name", "addressLines": [ "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1", "34940 Tuzla / İstanbul" ], "phone", "email", "lat", "lng" }, "hoursLabel": "Her gün 09:00 – 01:00", "courierFeeMinor": 5500, "courierEtaMinutes": [25, 35], "happyHour": { "days": "weekday", "from": "14:00", "to": "17:00", "pct": 25, "categories": ["ice-coffee","cold","frappe","frozen","ice-tea","smoothie"] } }`
Adres **vergi levhasındaki** adrestir (tasarımdaki "29 Ekim Cad." eskidir).

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
| 18 Kampanyalar                             | `/app-content.posts` (kind campaign) + sabit kartlar · `/promo/preview`                                  |
| 19 Davet                                   | `/me.invite` · `Share`                                                                                   |
| 21 Sipariş Geçmişi                         | `/orders`                                                                                                |
| 22 Cüzdan · 23 Hediye Kartı                | **Yakında** (karar 8) — uç yok                                                                           |
| 26 Karaoke                                 | `/karaoke/availability` · `POST /karaoke/reservations`                                                   |

## 13. Hukuki belgeler — `GET /legal` · `GET /legal/{slug}` (herkese açık)

Uygulama kendi sözleşme kopyasını yazmaz. Sipariş kaydı sitenin sözleşme
revizyonuna rıza kaydeder; iki taraf farklı metin gösterirse o kayıt anlamsız
kalır. Bu yüzden tek kaynak `src/lib/legal/content.ts`'tir ve mobil onu okur.

**`GET /api/mobile/v1/legal`** — 24 belgelik dizin.

```json
{
  "updatedAt": "1 Eylül 2026",
  "consentDocs": ["on-bilgilendirme-formu", "mesafeli-satis-sozlesmesi"],
  "docs": [{ "slug": "...", "title": "...", "shortTitle": "...", "category": "Sipariş", "summary": "..." }]
}
```

**`GET /api/mobile/v1/legal/{slug}`** — tek belgenin tam metni; bilinmeyen slug
`404 not_found`. İkisi de `force-static` ve `public, s-maxage=86400,
stale-while-revalidate=604800` ile yayınlanır; kimlik istemez.

### Çevrimdışı taban

`npm run legal:export` (site deposu) `scripts/legal-export.mjs`'yi çalıştırıp
`laffogato-mobil/src/data/legal.seed.json` üretir: 24 belgelik dizin + **14
belgenin tam metni** (`BUNDLED_SLUGS`). Paketlenen 14, uygulamanın içeriden
bağlandığı belgelerdir — ağ yokken de açılabilmeleri gerekir:

| Nerede bağlanır | Belge |
| --- | --- |
| Kayıt onay kutusu | `uyelik-sozlesmesi` · `kvkk-aydinlatma-metni` |
| Kayıt, ileti onayı | `ticari-elektronik-ileti` |
| Ödeme onay satırı | `on-bilgilendirme-formu` · `mesafeli-satis-sozlesmesi` |
| Ödeme, cayma bildirimi | `iade-ve-cayma` |
| Ürün detayı, alerjen | `gida-guvenligi-ve-alerjen` |

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
