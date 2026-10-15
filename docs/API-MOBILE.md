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
| Taban        | `https://laffogato.net/api/mobile/v1`. Kanonik ad **apex** (22 Eyl 2026): canonical, sitemap ve JSON-LD `@id`ler onu yayımlar; `www` **308** ile apex'e yönlenir. `EXPO_PUBLIC_API_BASE_URL` yalnız **origin** tutar (`https://laffogato.net`), yolu `src/data/api.ts` ekler. **Taban her zaman Vercel'de Production olan host olmalı, yönlendiren değil:** OkHttp ve NSURLSession cross-host 308'de `Authorization`ı düşürür — yönlendiren hosta bağlanan uygulama her yetkili çağrıda sessizce 401 alır. |
| Para         | **Her zaman kuruş integer** (`priceMinor: 19500`). Dize fiyat yok.                                                                                                 |
| Zaman        | ISO-8601 (UTC, `Z`)                                                                                                                                                |
| Kimlik       | `Authorization: Bearer <Supabase access JWT>`. Sunucu `supabase.auth.getUser(jwt)` ile doğrular, `user.email` → Neon `customers` satırı (yoksa **oluşturur**).     |
| Hata gövdesi | `{ "error": "<kod>", "message": "<Türkçe, kullanıcıya gösterilebilir>" }`                                                                                          |
| HTTP         | 200/201 · 400 geçersiz istek · 401 kimlik yok/geçersiz · 403 e-posta doğrulanmamış (sipariş) · 404 · 409 çakışma (stok/kapalı) · 429 · 503 veritabanı ulaşılamıyor |
| Runtime      | Her route: `export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 15;` Tek istisna `POST /fal` (§20): `maxDuration = 30`, çünkü model yorumu 20 saniyeye kadar sürer; uygulama bu uca 30 sn zaman aşımı verir. |
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
> **403** `email_unverified` (e-posta mevcut bir üyeye ait ve Supabase'de henüz
> doğrulanmamış — kimlik katmanında, her kimlikli uçta; satır zaten bu Supabase
> kimliğine bağlıysa — üyenin kendi açtığı satır — reddedilmez, 23 Eyl 2026:
> önceden onaysız yeni üye ikinci istekten itibaren kendi hesabından kilitleniyordu) ·
> **503** `auth_unavailable` (Supabase'e ulaşılamadı; Supabase'in **429**/**408**
> yanıtı da buraya düşer, 23 Eyl 2026 — önceden 401'di ve uygulama üyeyi
> çıkarıyordu) · **503** `unavailable` (bu
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
          // Yüklenen fotoğraf: sürüm damgalı mutlak URL (aşağı bak), ya da null
          "image": "https://laffogato.net/gorsel/menu/mnu-0007?v=6f1c2a9d3b40",
          // 24 Eyl 2026, eklemeli: sahne ailesi, dekupe, kap biçimi (aşağı bak)
          "backdrop": "caramel",
          "photoCutout": false,
          "vessel": null,
        },
      ],
    },
  ],
  "customization": {
    // sunucu sabiti: src/lib/mobile/customization.ts
    "milks": [
      { "id": "normal", "label": "Normal", "priceMinor": 0, "allergens": [] },
      { "id": "lactose-free", "label": "Laktozsuz", "priceMinor": 0, "allergens": [] },
      { "id": "oat", "label": "Yulaf", "priceMinor": 2500, "allergens": [] },
      { "id": "almond", "label": "Badem", "priceMinor": 2500, "allergens": ["nuts"] },
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

**`milks[].allergens` (23 Eyl 2026, yalnız ekleme).** Şuruplardaki alanın aynısı, aynı
sözlük: badem sütü `["nuts"]`, diğerleri `[]`. Önceden süt seçeneklerinde alan yoktu ve
badem sütünü seçen üyeye hiçbir alerjen uyarısı çizilmiyordu (lafmobil kural 4). Eski
sürümler alanı okumaz, bir şey kırılmaz; uygulama alanı **yoksa** `[]` sayar.

### `image` — sürümlü URL (9 Eyl 2026, yalnız ekleme)

`image` **mutlak URL ya da null**; tipi değişmedi, anlamı netleşti.

| Değer | Ne demek |
| --- | --- |
| `https://laffogato.net/gorsel/menu/<id>?v=<12 hex>` | Panelden yüklenmiş fotoğraf. `v`, fotoğrafın kendi baytlarının sha256'sının ilk 12 hanesi. |
| `https://…` (başka host) | Adminin yapıştırdığı dış adres; olduğu gibi geçer, damga yok, önbelleğine o host karar verir. |
| `https://laffogato.net/menu/<dosya>.webp` | Depoyla gelen sabit dosya (`public/`); damga yok, dosya adı zaten sabit. |
| `null` | Fotoğraf yok — uygulama kendi çizimini kullanır. |

**Damganın sözü:** aynı fotoğraf → **aynı URL** (hiçbir şey yeniden inmez);
değişmiş fotoğraf → **daha önce hiçbir önbelleğin görmediği URL** (CDN de,
uygulamanın URL ile anahtarlanan disk önbelleği de anında ıskalar). Damga
`menu_items.updatedAt`'ten değil **içerikten** türer: kalemin adı ya da fiyatı
değiştiğinde fotoğraf yeniden indirilmez.

**Önbellek başlıkları** (`/gorsel/**`):

| İstek | `Cache-Control` |
| --- | --- |
| `?v=` içeriğe uyuyor | `public, max-age=31536000, s-maxage=31536000, immutable` |
| `?v=` yok ya da tutmuyor | `public, max-age=300, s-maxage=300` |

`immutable` burada temenni değil tanım: `v` servis edilen baytların damgasıdır,
o URL başka bayt döndüremez. Uygulama sürümlü URL'yi **süresiz** saklayabilir;
`expo-image` için `cachePolicy="memory-disk"` doğru seçimdir ve `staleTime`
düşürmeye gerek yoktur — URL değişmediyse indirme de yoktur.

Rota `If-None-Match` kabul eder: eşleşirse gövdesiz **304**. `ETag`, fotoğrafın
tam sha256'sıdır (`"<64 hex>"`), `v` onun ilk 12 hanesi.

> **Eski sürümler.** URL'yi sunucu üretir, uygulama kurmaz — sahadaki eski
> uygulama sürümleri de bu yanıttan damgalı URL alır, güncelleme gerekmez.
> Damgasız `/gorsel/menu/<id>` çalışmaya devam eder (5 dk önbellek).

### Tazelik penceresi — fotoğraf ne kadar sürede görünür?

| Adım | Gecikme |
| --- | --- |
| Panel kaydeder → site | anında (`revalidatePath`) |
| Panel kaydeder → `/menu` yanıtı CDN'de | **en çok 300 sn** |
| Yeni `image` URL'si → uygulama fotoğrafı çizer | anında (yeni URL = önbellek ıskası) |

300 sn'yi panel kısaltamaz: `revalidatePath()` Next'in **sunucu** önbelleğini
düşürür, CDN kendi kopyasını `s-maxage` dolana kadar servis etmeye devam eder
(Next 16 `docs/01-app/02-guides/cdn-caching.md`), üstelik bu rota
`force-dynamic` olduğu için düşürülecek bir sunucu kaydı da yok. CDN purge API'si
dağıtım kapsamlı bir sır ister; ayda birkaç kez değişen bir menü için 5 dakikalık
gecikme buna değmez. **Uygulamanın kendi `staleTime`'ı bu pencerenin üstüne
eklenir** — fotoğrafın 5 dakikada görünmesi isteniyorsa menü sorgusunun
`staleTime`'ı da o mertebede olmalı.

`GET /menu` artık `ETag` gönderir (yanıt gövdesinin sha256'sı) ve
`If-None-Match` ile gövdesiz **304** döner. Uygulama daha sık sorabilir:
değişmemiş bir menü artık yalnızca başlık kadar maliyetli.

### `backdrop` · `photoCutout` · `vessel` - sahne ailesi, dekupe ve kap biçimi (24 Eyl 2026, yalnız ekleme)

Uygulama her ürünü, rengi içeceğin kendisinden gelen ışıklı bir sahnenin
önünde çizer (cam turu, uygulama deposu `docs/DESIGN-GLASS.md` §6). Rengi
bugüne kadar yalnız `hue`dan ve kategoriden tahmin edebiliyordu. Panel artık
yüklenen fotoğraftan içeceğin gövde rengini okuyup on iki aileden en yakınını
seçer; operatör seçimi elle değiştirebilir. Üç alan, menü kaleminde ve mağaza
ürününde (§2) aynıdır:

```jsonc
{
  "backdrop": "caramel", // string | null - 12 ürün ailesinden biri; null = seçim yok
  "photoCutout": true,   // boolean - `image` saydam (dekupe) bir fotoğraf
  "vessel": null         // string | null - fotoğrafsız kalemin çizilen kap biçimi; null = kategoriden
}
```

| Alan | Tip | Değerler | Boşken |
| --- | --- | --- | --- |
| `backdrop` | string \| null | `espresso` · `caramel` · `latte` · `cocoa` · `spice` · `citrus` · `matcha` · `pistachio` · `strawberry` · `berry` · `ice` · `gelato` | `null`: uygulama `hue`ya, o da bilinmiyorsa kategoriye, o da yoksa `house`a düşer |
| `photoCutout` | boolean | `true` · `false` | `false`; fotoğraf yoksa (`image: null`) her zaman `false` |
| `vessel` | string \| null | `tumbler` · `cup` · `tulip` · `cloche` · `shot` · `pack` | `null`: biçim kategoriden gelir |

- Üç anahtar da her kalem ve ürün nesnesinde **her zaman vardır**.
- Sunucu listede olmayan bir değeri yayımlamaz, yerine `null` gönderir.
  Uygulama da bilmediği değeri `null` sayar; alan hiç yoksa (eski sunucu,
  tohum katalog) `backdrop: null`, `photoCutout: false`, `vessel: null`.
- `house` ve `velvet` hiçbir zaman sunucudan gelmez: ürün ailesi değil,
  uygulamanın ekran sahneleridir.
- İki liste de sıralıdır ve iki depoda aynıdır: site
  `src/lib/backdrop/families.ts` (`BACKDROP_KEYS`, `VESSEL_KEYS`), uygulama
  `src/theme/backdrops.ts`. İki depoda da bu tabloya karşı testle kilitlidir.
  Yeni bir değer önce bu belgeye, sonra iki listeye aynı sürümde eklenir.
- **Otomatik seçim** sunucuda yapılır (`src/lib/backdrop/pick.ts`, algoritma
  `v1`): fotoğrafın 64 px'lik örneğinden, kalemin `hue`su öncül alınarak.
  Emin olamadığında (iki aile başabaş, ya da hiçbiri yeterince yakın değil)
  seçim yapmaz, `backdrop` `null` kalır. Mağazanın `gear` ve `merch`
  ürünlerinde otomatik seçim hiç yapılmaz (gövde rengi içecek değildir).
- **Elle seçim** yeni fotoğraf yüklense de korunur. `photoCutout` ise her
  yüklemede fotoğrafın kendisinden yeniden hesaplanır. `vessel` yalnız elle
  seçilir.
- `photoCutout` menüde `image`i, mağazada ilk görseli (`images[0]`, yanıttaki
  `image`) anlatır. `backdrop` ve `vessel` fotoğrafsız kalemde de gelebilir
  (operatörün seçimi).
- Kaynak: `menu_items` ve `products` tablolarında `backdrop`,
  `"backdropSource"` (`auto` · `manual`), `"backdropHex"`, `"photoCutout"`,
  `vessel` (`db/migrations/20260924001000_backdrop_fields.sql`).
  `"backdropSource"` ve `"backdropHex"` panelin kaydıdır, yayımlanmaz.
  Migration'dan önce yayına çıkan sunucuda satırda anahtar yoktur; eşleyici o
  durumda da `null` / `false` / `null` yayımlar (`tags`'teki koruma).
- Mevcut fotoğraflar için `scripts/backfill-backdrops.mjs` (varsayılan kuru
  koşu, `--apply` ile yazar, elle seçilmiş satırlara dokunmaz).
- Eski sürümler üç alanı da okumaz; bir şey kırılmaz.

## 2. `GET /shop` — mağaza ürünleri (herkese açık)

```jsonc
{ "products": [ {
  "id": "prd-0001", "slug": "sirena-espresso-blend", "name": "Sirena — Espresso Blend",
  "tag": "Çekirdek · 250g", "description": "…", "priceMinor": 32000, "compareAtPriceMinor": 0,
  "category": "beans",                // beans | gift | gear | merch | pantry
  "tags": ["nuts"],                   // §1 ile AYNI sözlük: signature | new | iced | nuts
  "brand": "Sirena",                  // 23 Eyl 2026, eklemeli: künye (ürünün markası); yoksa ""
  "notes": ["Kakao", "Kuru incir", "Esmer şeker"],   // 23 Eyl 2026, eklemeli: tat notu çipleri; yoksa []
  "hue": "caramel", "image": "https://…?v=<12 hex>" | null,   // §1'deki damga kuralı ürün fotoğrafları için de geçerli
  "backdrop": "espresso", "photoCutout": false, "vessel": null,   // 24 Eyl 2026, eklemeli: §1'deki sahne alanları, ilk görseli anlatır
  "inStock": true,
  "variants": [ { "id": "var-…", "name": "250 g", "priceMinor": 32000, "inStock": true }, { "id": "var-…", "name": "1 kg", "priceMinor": 109000, "inStock": true } ],
  "grinds": [ "Çekirdek", "Espresso", "Filtre", "French Press" ]   // yalnız category === "beans"
} ], "shippingFlatMinor": 4900, "shippingFreeThresholdMinor": 50000 }
```

### `tags` — alerjen (16 Eyl 2026, yalnız ekleme)

`tags` her ürün nesnesinde **her zaman vardır**; alerjeni ya da rozeti olmayan
üründe boş dizidir. Alan adı, tipi ve **sözlüğü** §1'deki `items[].tags` ile
birebir aynıdır (`signature` · `new` · `iced` · `nuts`) — uygulama ikisini de
`tags.includes("nuts")` ile okur, ayrı bir eşleyici yazılmaz.

`nuts` bir **alerjendir** ve gizlenmez (uygulamanın 4. değişmez kuralı): ürün
detayında ve sepet satırında görünür olmalıdır. Sözlük dışı bir değer
gönderilmez — uygulama bilmediği etiketi sessizce atar
(`src/data/types.ts` `toTags`, sözlüğü `ITEM_TAGS`), yani uydurulmuş bir alerjen etiketi hiçbir
müşteriye ulaşmaz. Sözlüğü genişletmek uygulamanın `ItemTag` birleşimini aynı
sürümde genişletmeyi gerektirir.

Kaynak: `products.tags` (jsonb, `db/migrations/20260916120000_product_allergen_tags.sql`),
`menu_items.tags` ile aynı sütun şekli. Panelden `/admin/urunler` → **Temel
bilgi** → *Alerjen* kapalı listesiyle işaretlenir.

### `brand` · `notes` - künye ve tat notları (23 Eyl 2026, yalnız ekleme)

Ekran 13 ürün adının üstünde bir künye ("SIRENA") ve altında tat notu çipleri
("Kakao · Kuru incir · Esmer şeker") çizer. İkisi de `description`'dan
çıkarılamazdı: marka bir sütun değildi, notlar da cümleden ayrılamaz
("Nara'dan." bir çip olurdu). Bu yüzden iki ayrı alan:

| Alan | Tip | Boşken | Uygulama |
| --- | --- | --- | --- |
| `brand` | string | `""` | Doluysa ürün adının üstünde künye olarak çizer; boşsa hiçbir şey. |
| `notes` | string[] | `[]` | Doluysa çipleri çizer; boşsa `description`'ı bugünkü gibi **bütün** basar. |

- İki anahtar da her ürün nesnesinde **her zaman vardır**. Panel doldurana kadar
  boştur, yani ekranda hiçbir şey değişmez.
- Metin operatörün yazdığıdır; sunucu yalnız baştaki/sondaki boşluğu kırpar,
  boş ya da dize olmayan notu düşürür. Uygulama yeniden yazmaz (büyük harfe
  çevirmek gibi biçim işleri çizimdir, metin değil).
- Panel sınırları: marka en fazla 40, not başına en fazla 24 karakter, en fazla
  5 not (`/admin/urunler` → **Temel bilgi** → *Marka (künye)* · *Tat notları*;
  notlar virgül, `·` ya da satır sonuyla ayrılır, aynı not bir kez tutulur).
- Kaynak: `products.brand` (text, varsayılan `''`) ve `products.notes` (jsonb,
  varsayılan `'[]'`), `db/migrations/20260923220000_product_brand_notes.sql`.
  Migration'dan önce yayına çıkan sunucuda satırda anahtar yoktur; eşleyici o
  durumda da `""` / `[]` yayımlar (`tags`'teki koruma).
- Eski sürümler iki alanı da okumaz; bir şey kırılmaz.

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
- Özelleştirilemeyen kategoriler (`dessert` · `snack` · `extras`; uygulamanın `NON_CUSTOMIZABLE`
  listesi) seçenek almaz (14 Eki 2026, yalnız ekleme): bu satırlarda gönderilen `options`
  **yok sayılır** (reddedilmez), satır varsayılan seçeneklerle ve sade fiyatıyla yazılır.
  `/orders/preview` aynı kuralla fiyatlar.
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
> - `payWithWallet: true` (opsiyonel, varsayılan `false`; §18, 14 Eki 2026): bakiye
>   siparişin tamamını öder → **201**, sipariş `paid`, `payment: null`
>   (`payment_transactions.provider = "wallet"`). Bakiye yetmezse ya da cüzdan kapalıysa
>   **409** `insufficient_balance`; sipariş yazılmaz. `/orders/preview` alanı kabul eder ve
>   yok sayar. Yanında opsiyonel `expectedTotalMinor` (kuruş) gönderilebilir; ayrıntı §18.
> - `clientOrderId` (opsiyonel, `/orders` ve `/orders/preview`): aynı üye aynı değerle
>   tekrar gönderirse **aynı sipariş** döner, yenisi açılmaz; hâlâ `pending_payment` ise
>   yeni bir ödeme oturumu açılır. POS o an açılamazsa tekrar da ilk deneme gibi **500**
>   `internal` döner (23 Eyl 2026 — önceden 201 + `payment: null` dönüyor, uygulama ödenmemiş
>   siparişi verilmiş sanıyordu); sonraki deneme yine aynı siparişi açar. Yeniden açılış
  bütçesi aşılınca **429** `rate_limited` + `Retry-After` (15 Eki 2026, yalnız ekleme;
  ayrıntı `POST /orders/{id}/payment` altında).
> - `scheduledFor`: geçmiş (5 dk tolerans) ve 7 günden ileri → 400. `""`/`null` = en kısa sürede.
> - Kafe + mağaza karışık sepet → 400 (teslimat türü ikisini birden karşılayamaz).
> - Mağaza satırındaki `note` (öğütüm) `items[].detail` alanında taşınır.
> - `items[].options` sunucuda tam `LineOptions` nesnesi (varsayılanlarla) olarak döner.
> - `timeline` anahtarları teslimata göre: delivery `received/preparing/on_the_way/delivered`
>   · pickup `received/preparing/ready/picked_up` · shipping `received/preparing/shipped/delivered`.
> - `timeline[].at` her adımın **kendi** sütunundan gelir: `createdAt` · `preparingAt` ·
>   `shippedAt` · `completedAt`. Bu sütunlar yoktan önce yazılmış siparişlerde boş olabilir;
>   o durumda tamamlanmış bir adım `at: null` döner (sonraki bir anı ödünç almaz).
>   `statusLabel` bu adımdan gelir (pickup + shipped → "Hazır - gel al").
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

> **E-postası doğrulanmamış üye (23 Eyl 2026).** Siparişler üyeye yalnız e-postayla
> bağlanır ve admin'in elle girdiği bir satış hiç üye olmamış birinin adresini
> taşıyabilir. Sitedeki sipariş geçmişi gibi, `customer.emailVerified === false`
> iken `GET /orders` **boş liste**, `GET /orders/{id}` **404** döner; `GET
> /notifications` sipariş kayıtlarını listelemez. Biçim değişmedi; doğrulanmamış
> üye zaten sipariş veremez (`POST /orders` → 403 `email_unverified`).

### `POST /orders/{id}/payment` → `{ "order": …Order…, "payment": { "redirectUrl", "expiresAt" } }` (23 Eyl 2026, yeni uç)

POS'ta yarım bırakılmış bir uygulama siparişini **yeniden ödemeye açar**. Gövde yok.
`clientOrderId` tekrarı (§3 yukarıda) aynı şeyi yapıyordu ama uygulama o kimliği ödeme
ekranından çıkınca artık tutmuyor; bu uç aynı tekrarı sipariş kimliğiyle yapar.

- **Aynı sipariş**, yeni bir ödeme oturumu: yeni sipariş açılmaz, e-posta yeniden gitmez,
  stok yeniden ayrılmaz. Oturumun dönüşü `POST /orders`'takiyle aynıdır
  (`laffogato://siparis/<id>?status=…`).
- Yalnız sahibi, e-postası doğrulanmış olarak ve yalnız **uygulama** siparişi
  (`channel: "app"`); aksi hâlde **404** `not_found` (başkasının kimliği eksik bir
  kimlikle aynı cevabı alır). Web siparişinin kendi ödeme akışı vardır.
- `pending_payment` değilse ya da ödenecek tutar yoksa **409** `not_payable`
  ("Bu sipariş ödeme beklemiyor."): uygulama siparişi `GET /orders/{id}` ile yeniden
  çizer.
- POS açılamazsa **500** `internal`; hiçbir şey değişmez, tekrar denenebilir.
- **429** `rate_limited` (15 Eki 2026, yalnız ekleme): var olan bir sipariş için ödeme
  oturumu yeniden açmak (bu uç **ve** `clientOrderId` tekrarı, ikisi aynı bütçeden) üye
  başına sayılır; 5 dakikada 8 açılıştan sonra 10 dakika `Retry-After` ile reddedilir.
  Her açılış ödeme sağlayıcısına bir çağrı ve bir `payment_transactions` satırıydı, tek
  bir ödenmemiş siparişle sınırsız açılabiliyordu. Yeni siparişin ilk oturumu sayılmaz
  (onu `too_many_pending` sınırlar). Uygulama bunu tanımadığı her ret gibi gösterir,
  kendiliğinden tekrar denemez.
- Neden: üç yarım ödeme `too_many_pending` (429) ile üyeyi siparişten kilitliyordu ve
  uygulamada çıkış yolu yoktu.

`Order`:

```jsonc
{
  "id": "ord-0284", "orderNo": 284, "status": "preparing",
  // pending_payment | paid | preparing | shipped | completed | cancelled | refunded
  "statusLabel": "Hazırlanıyor",
  "timeline": [ { "key": "received", "label": "Sipariş alındı", "at": "…", "done": true },
                { "key": "preparing", "label": "Hazırlanıyor", "at": "…", "done": true },
                { "key": "on_the_way", "label": "Kuryede", "at": null, "done": false },   // pickup: "Hazır - gel al"
                { "key": "delivered", "label": "Kapında", "at": null, "done": false } ],
  "channel": "app", "kind": "cafe", "fulfillment": "delivery",
  "items": [ { "name": "Cappuccino", "detail": "M · yulaf · +1 shot", "qty": 1, "unitPriceMinor": 24500, "menuItemId": "mnu-0007", "productId": null, "variantId": null, "size": "M", "options": { … } } ],
  "subtotalMinor": 83500, "discountMinor": 0, "shippingMinor": 5500, "totalMinor": 89000,
  "promoCode": "", "address": "Evim - …", "scheduledFor": null, "etaMinutes": 35, "etaAt": "…",
  "shipment": null,   // yalnız fulfillment === "shipping" → §3.1
  "stampsEarned": 1, "createdAt": "…", "paidAt": "…" | null
  // stampsEarned = loyalty_stamps LEDGER'ından okunur: siparişin `earn` satırı
  // varsa ve `reversal` ile geri alınmamışsa 1, aksi hâlde 0. Duruma bakıp
  // "ödendiyse damga vardır" DEMEZ — onOrderPaid best-effort'tur ve iade
  // edilen siparişin damgası geri alınır.
}
```

### 3.1 `shipment` — kargo (22 Eyl 2026, yalnız ekleme)

**Canlı kurye takibi YOKTUR ve planlanmamaktadır.** Köşk telefonu okunabilen
kurye çalıştırmaz; kargoyu **Geliver** üzerinden satın alır ve bir taşıyıcının
yayımladığı şey konum değil, birkaç kilometre taşıdır. Uygulama bu yüzden
haritayı emekli etti (ekran 11) ve üyeye üç şey söyler: yola çıktı, yolda,
teslim edildi.

`shipment` **yalnız** `fulfillment === "shipping"` siparişlerinde ve **yalnız**
gönderi köşkten çıktıktan sonra doludur. Diğer her durumda `null`'dur — kafe
siparişi, gel-al, ve henüz kargoya verilmemiş mağaza siparişi dâhil.

```jsonc
"shipment": {
  "status": "in_transit",
  // preparing | shipped | in_transit | delivered | returned | failed
  "carrier": "Sürat Kargo",          // teklif kabul edilene kadar null
  "trackingNumber": "1234567890123", // takip kodu üretilene kadar null
  "trackingUrl": "https://…",        // taşıyıcı bir sayfa yayımlıyorsa; yoksa null
  "updatedAt": "2026-09-22T09:00:00Z"
}
```

**Geliver → sözleşme eşlemesi.** Soldaki değerler Geliver'in `statusFilter`
kümesidir (resmî JS SDK'sı); sunucu `TRACK_UPDATED` webhook'unda eşler:

| Geliver | `shipment.status` | Üyenin gördüğü |
|---|---|---|
| `CREATED` · `GOT_OFFERS` · `OFFER_ACCEPTED` · `TRACKING_CODE_CREATED` · `LABEL_PRINTED` | `preparing` | Hazırlanıyor |
| `SHIPPED` | `shipped` | **Yola çıktı** |
| `TRACK_UPDATED` (teslim değil) | `in_transit` | **Yolda** |
| `DELIVERED` | `delivered` | **Teslim edildi** |
| `RETURNED` · `RETURN_SHIPPED` | `returned` | Gönderi iade edildi |
| `CANCELED` · `FAILED` | `failed` | Gönderi teslim edilemedi |

**Kurallar.**

- `trackingUrl` **bütün olarak** gelir; uygulama numara ile alan adını birleştirip
  link KURMAZ. `https://` ile başlamayan değer istemcide düşürülür.
- Bilinmeyen bir `status` istemcide **tüm nesneyi** düşürür (`toShipment`).
  Gönderinin nerede olduğu hakkında hiçbir şey söylememek, yanlış şey
  söylemekten iyidir.
- Alan **hiç yoksa** bu bir hata değildir: sütun migration'dan önce deploy
  edilen bir sunucuda `select("*")` anahtarı hiç döndürmez (karar 61 tuzağı).
- `status` sipariş durumundan (`Order.status`) bağımsızdır: taşıyıcı ne derse
  odur. `delivered` olduğunda siparişi `completed`'a taşımak sunucunun işidir.

### `POST /orders/preview` → sepet hesabı (kimlik gerekli değil ama varsa kupon denenir)

Gövde `POST /orders` ile aynı (legalConsent hariç). Yanıt:
`{ "lines": [ { "name", "detail", "qty", "unitPriceMinor", "lineTotalMinor" } ], "subtotalMinor", "discountMinor", "shippingMinor", "totalMinor", "promo": { "code", "ok": true } | { "code", "ok": false, "message" } | null, "stampsToEarn": 1 }`

> **Uygulama notu (preview).** `promoCode` verilmişse `promo-preview` hız sınırı burada da
> uygulanır; sınıra takılan istek **429 dönmez** — yanıt 200'dür ve `promo`
> `{ "code", "ok": false, "message": "Çok fazla deneme. N saniye sonra tekrar dene." }`
> olur (sepet hesabı hız sınırı yüzünden düşmesin diye). Mağaza satırlarında stok kontrolü
> yapılır ama stok **ayrılmaz**. `stampsToEarn` kafe sepetinde 1, mağazada 0.
> **14 Eki 2026 (yalnız ekleme):** `kind: "shop"` sepeti `settings.isShopOpen === false`
> iken artık fiyatlanmaz; `POST /orders` ile aynı **409** `shop_closed` (aynı mesaj) döner.
> Önceden önizleme kapalı mağazanın sepetini fiyatlıyor, ret yalnız son adımda geliyordu.

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
    "tierLabel": "RUBY",         // görünen ad: L'AF | PEARL | RUBY (kimlik değişmez; 23 Eyl 2026)
    // 23 Eyl 2026, karar 175 (eklemeli): kilometre taşı hediyelerinin yol haritası
    // (ömür boyu damgaya göre) ve her seviyenin YALNIZ sunucunun uyguladığı ayrıcalıkları.
    // `milestones` okunamazsa alan hiç gelmez (/me yine 200); uygulama yol haritasını çizmez.
    "milestones": [ { "at": 10, "title": "Filtre Kahve", "surprise": false, "reached": true, "given": true, "gift": "Filtre Kahve" },
                    { "at": 20, "title": "Americano", "surprise": false, "reached": true, "given": false, "gift": "" },
                    { "at": 30, "title": "Sürpriz: menüden bir içecek ya da tatlı", "surprise": true, "reached": false, "given": false, "gift": "" } ],
    "perksByTier": { "verde": [], "argento": [], "oro": [ "Karaoke odasında %15 indirim" ] },
    "ordersLast365": 41,
    "badges": [ { "id": "first-affogato", "label": "İlk affogato", "earned": true }, { "id": "streak-10", "label": "10 gün üst üste", "earned": false }, { "id": "early-bird", "label": "Erken kuş", "earned": true }, { "id": "matcha-fan", "label": "Matcha meraklısı", "earned": false }, { "id": "bean-subscriber", "label": "Çekirdek abonesi", "earned": false }, { "id": "orders-50", "label": "50 sipariş", "earned": false } ]
  },
  "invite": { "code": "LAF-EDA24", "invited": 3, "joined": 2, "earned": 2,
              "people": [ { "name": "Selin K.", "status": "joined" | "pending", "at": "…", "rewarded": true } ] },
  "usual": { "menuItemId": "mnu-0007", "size": "M", "options": { … } } | null,
  "staff": { "till": false }     // 15 Eki 2026, yalnız ekleme: aşağıya ve §21'e bak
}
```

`invite.people[].rewarded` (yalnız ekleme): bu kişinin daveti davet edene kupon kazandırdı mı. `false` ise ya davetli henüz şartı sağlamadı ya da davet eden 5 ödül tavanını (§5) aşmıştı. Alan gelmezse uygulama `joined` satırını ödüllenmiş sayar (eski sunucu).

`staff.till` (15 Eki 2026, yalnız ekleme): `true` ise panel bu üye hesabına
uygulamadan kasa yetkisi vermiştir (barista, §21); uygulama okutucuyu yalnız o
zaman gösterir. Sunucu alanı her `/me` yanıtında (GET ve PATCH) gönderir; yetki
okunamazsa `false` döner, `/me` bu yüzden hiç başarısız olmaz. Alan **yoksa**
(bu eklemeden önceki sunucu) uygulama `false` sayar. `staff` içinde yalnız
`till` vardır; yetkiyi kimin verdiği uygulamaya gitmez.

`PATCH /me` gövdesi: `{ name?, phone?, birthday?, notificationPrefs?, usual? }` → güncel `/me`. `birthday` `YYYY-AA-GG` biçiminde ve takvimde olan bir gün olmalı (`1990-02-30` 400 `invalid_request`).
Adresler: `POST /me/addresses` (gövde adres) · `PATCH /me/addresses/{id}` · `DELETE /me/addresses/{id}` · `POST /me/addresses/{id}/default` → hepsi güncel `addresses[]` döner.
Hesap silme: `DELETE /me` → Neon satırı anonimleştirilir, Supabase kimliği silinir (service role varsa; sonucu yanıttaki `identity` söyler, aşağıya bak) + oturum istemcide kapatılır (mağaza zorunluluğu). Devam eden sipariş varsa **409** `orders_in_progress`.

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
> **`identity` (23 Eyl 2026, yalnız ekleme):** 200 yanıtı
> `{ "ok": true, "identity": "deleted" | "skipped" | "failed" }` olur; ayrıntı
> aşağıda. `neighbourhood` sütunu yoktur: `line1`'e
> `"<mahalle>, <satır>"` olarak katlanır, okurken `Mah.`/`Mahallesi`/`Mh.` sonekiyle ayrıştırılır.
> **14 Eki 2026 (yalnız ekleme):** uygulamadan yazılan adres mahalleyi ayrıca kendi
> anahtarında da tutar (JSONB, migration yok) ve okurken o tercih edilir; böylece
> sonek taşımayan bir mahalle ("Postane") de `neighbourhood` olarak geri döner. Bu anahtarı
> taşımayan eski satırlar ve sitede düzenlenen adresler yukarıdaki ayrıştırmayla okunur.
> **Telefon (14 Eki 2026, yalnız ekleme):** `PATCH /me` `phone`, adres `phone` ve
> `POST /orders` satır içi adres `phone` doğrulanmadan önce normalleştirilir: Türkiye cep
> numarası hangi yazımla gelirse gelsin (`0532 123 45 67`, `+90 (532) 123-45-67`,
> `5321234567`) `+905321234567` olarak saklanır ve geri döner. Cep olmayan numara (sabit hat,
> yurt dışı) yazıldığı gibi kalır; daha önce kabul edilen hiçbir biçim reddedilmez.
> `loyalty.badges` ve `tier` yalnız `paid/preparing/shipped/completed` siparişleri sayar
> (ödenmemiş/iptal/iade sayılmaz).

### `DELETE /me` → `identity` (23 Eyl 2026, yalnız ekleme)

Yanıt, Supabase giriş kimliğine ne olduğunu söyler. Neon satırı üç durumda da
anonimleştirilmiş ve hesap kapatılmıştır; fark, üyenin e-postasını ve adını
(`user_metadata.full_name`) hâlâ taşıyan giriş kimliğindedir. Uygulama bu
yüzden "kişisel bilgilerin silindi" cümlesini **yalnız** `deleted` gelince
kurar (O28).

| `identity` | Ne oldu | Uygulamanın cümlesi |
| --- | --- | --- |
| `deleted` | Supabase kullanıcısı silindi. | "Hesabın kapatıldı; kişisel bilgilerin silindi." |
| `skipped` | Silme denenmedi: sunucuda `SUPABASE_SERVICE_ROLE_KEY` yok ya da satırda bağlı kimlik kaydı yok. Giriş kimliği Supabase'de durur. | "Hesabın kapatıldı." |
| `failed` | Silme denendi, Supabase reddetti ya da ulaşılamadı (sunucu günlüğüne yazılır). Giriş kimliği Supabase'de durur. | "Hesabın kapatıldı." |

- Alan **yoksa** (bu eklemeden önceki sunucu) ya da bilinmeyen bir değer
  gelirse uygulama bunu `deleted` saymaz; kısa cümleyi kurar.
- `ok: true` aynen durur; alanı okumayan eski sürümler için hiçbir şey
  değişmez.
- Kaynak: `deleteMe` → `deleteSupabaseIdentity` (`src/lib/supabase/admin.ts`,
  `IdentityDeletion`); rota değeri olduğu gibi geçirir, yuvarlamaz.
  `tests/mobile-me-delete-route.test.ts` tutar.

## 5. Sadakat

- `POST /loyalty/redeem` → `stampTarget` damga (varsayılan 6) → **ücretsiz içecek kuponu** (`customer_coupons`, `source: "loyalty"`, `kind: "fixed"`, `value: loyalty.rewardValueMinor` (28000), `title: loyalty.rewardTitle` ("Ücretsiz içecek"), `loyalty.rewardTtlDays` gün (90)). Dördü de `/admin/mobil/ayarlar` → Sadakat'tan (§10 `settings.mobileApp.loyalty`); `stampTarget` ve `rewardTitle` uygulamaya `bootstrap.app.loyalty` ile de gider, kupon değeri/süresi sunucuda kalır. Yanıt `{ "coupon": { "code", "title", "expiresAt" }, "loyalty": { … } }`. Damga yoksa **409** `not_enough_stamps`.
- `GET /coupons` → `{ "coupons": [ { "id", "code", "title", "body", "kind", "value", "minSpendMinor", "expiresAt", "usedAt", "cafeOnly" } ] }` (mevcut `listCustomerCoupons`). `cafeOnly: boolean` (23 Eyl 2026, yalnız ekleme): `true` ise kupon yalnız kafe sepetinde geçer (sadakat ve davet kuponları); mağaza sepetinde sunucu `CAFE_ONLY_COUPON_MESSAGE` ile reddeder. Uygulama bu alanı zaten okuyordu; sunucu göndermediği için hep `false` görünüyordu.
- `POST /promo/preview { "code", "subtotalMinor", "kind"? }` → `{ "ok": true, "code", "discountMinor" } | { "ok": false, "code", "message" }` (mevcut `previewPromoAction` mantığı; hız sınırı `promo-preview`). `kind` (`"cafe" | "shop"`, opsiyonel): verilmezse kafe-yalnız kupon **geçmez** sayılır — söz verip kasada düşürmek yerine.
- Davet: `POST /invite/claim { "code" }` (kimlik gerekli; yalnız hiç siparişi olmayan hesap) → `{ "ok": true }`. Davet eden, davetlinin **ilk ödenmiş siparişinde** +1 ücretsiz içecek kuponu alır; davetli de ilk siparişinde alır (`invites` tablosu: `code, inviterEmail, inviteeEmail, status: pending|joined|rewarded, createdAt, rewardedAt`).

> **Uygulama notu (§5).** `/loyalty/redeem` kupon `expiresAt` boşsa `null`; damga bakiyesi her
> zaman ledger'dan hesaplanır (`available = earn − stampTarget·redeem`), redeem satırı
> `loyalty_stamps.source = "app"`. Redeem satırları **o anki** hedefle çarpılır: panelde
> hedef değişirse geçmiş kartlar da yeni hedefle okunur (ledger'da hedef saklanmaz). `/invite/claim` hataları: **404** `invite_not_found` ·
> **400** `own_invite` · **409** `invite_already_claimed` · **409** `invite_not_eligible`
> (siparişi olan hesap). `invites.status` `joined` hiç yazılmaz: claim → `pending`, davetlinin
> ilk ödenmiş siparişi → `rewarded` (iki tarafa panelde tanımlı ücretsiz içecek kuponu —
> `rewardTitle` / `rewardValueMinor` / `rewardTtlDays`, varsayılan 280₺ · 90 gün — `source: "invite"`).
> Daveti kapatan sipariş yalnız **kafe** siparişidir ve ödenen tutarı (`totalMinor`) en az
> **150₺**'dir (`INVITE_MIN_ORDER_MINOR`); mağaza (kargo) siparişi ve daha küçük kafe siparişi
> daveti açık bırakır. Davet eden en çok **5** davetten ödül alır (`INVITE_REWARD_CAP`).
> `/me.invite.joined` = pending olmayan satır sayısı, `earned` = ödül getiren davet sayısı
> (5 ile sınırlı; tavanı aşan davetlerde `people[].rewarded` `false`).
>
> **Davet ödülü kuralı (14 Eki 2026, operatör kararı; yalnız ekleme).** Ödülü kazandıran,
> davetlinin ilk ödenmiş **kafe** siparişidir (gel-al ya da kurye; mağaza/kargo siparişi
> hiçbir zaman saymaz). Asgari tutar **150,00 TL'lik ürün**dür: indirim düşüldükten sonra
> ödenen ürün tutarı, yani `totalMinor − shippingMinor`; **kurye ücreti sayılmaz** (100 TL'lik
> kahve + 55 TL kurye daveti kapatmaz). Yukarıdaki "ödenen tutarı (`totalMinor`)" ifadesi bu
> kuralla okunur. Davet eden en çok **5** davetten ücretsiz içecek alır
> (`INVITE_REWARD_CAP`); tavandan sonra davetli yine ödülünü alır, davet edene kupon yazılmaz.

## 6. Canlı durum — `GET /live-status` (herkese açık)

```jsonc
{ "isOpen": true, "openLabel": "Şu an açık", "updatedAt": "…", "updatedAgoMinutes": 2,
  "freeTables": 9, "totalTables": 20, "wifi": "stable" | "slow" | "down", "noise": "low" | "medium" | "high",
  "power": true, "note": "Çalışmaya uygun — priz var, gürültü düşük",
  "hours": { "weekday": "09:00 - 01:00", "weekend": "09:00 - 01:00" },
  "karaoke": { "available": true, "label": "Rezervasyonla" } }
```

Kaynak: `venue_status` tablosu (tek satır `main`), `/admin/mobil/canli-durum` panelinden düzenlenir; `isOpen` = `manualOverride` (`"auto" | "open" | "closed"`) + `settings.weeklyHours`.
Cache: `public, s-maxage=30` — `stale-while-revalidate` **yok**: panel personele "uygulama
30 saniyede görür" diyor, iki dakikalık SWR penceresi bunu yalan yapıyordu.

> **Uygulama notu (§6).** Saat mantığı Europe/Istanbul; `09:00 - 01:00` gece yarısından sonra
> önceki günün kuyruğu olarak **açık** sayılır. DB ulaşılamazsa uydurma "açık" dönmez, **503**.

## 7. Karaoke

- `GET /karaoke/availability?date=YYYY-MM-DD` → `{ "date", "slots": [ { "startHour": 16, "available": true } ], "hourlyMinor": 90000, "capacity": 8, "oroDiscountPct": 15, "firstHour": 12, "closeHour": 24, "maxHours": 4, "bookingWindowDays": 60 }` (`slots` `firstHour`..`closeHour-1`; fiyat `settings.karaokeHourlyMinor`, kapasite `settings.karaokeCapacity`; `firstHour/closeHour/maxHours/bookingWindowDays/oroDiscountPct` `/admin/mobil/ayarlar` → Karaoke kuralları, §10 `settings.mobileApp.karaoke`).
- `POST /karaoke/reservations { "date", "startHour", "hours", "guests", "note" }` (kimlik) → 201 `{ "reservation": { "id", "date", "startHour", "hours", "guests", "status": "requested", "priceMinor", "discountMinor", "totalMinor", "createdAt" } }`. Çakışma **409** `slot_taken`. Tablo `karaoke_reservations`; panel `/admin/mobil/karaoke` (onayla/iptal).
- `GET /karaoke/reservations` → benimkiler.
- **409 `too_many_reservations`**: aynı anda en fazla **2** açık (`requested`/`confirmed`)
  rezervasyon (`KARAOKE_OPEN_CAP`). `slot_taken` gibi bu da kurala dayalı bir ret;
  uygulama sunucunun mesajını gösterir, tekrar denemeyi önermez.
- **403 `email_unverified`**: e-postası doğrulanmamış üye rezervasyon yapamaz
  (sipariş kuralıyla aynı; web `/karaoke` formu da aynı kuralı uygular).
- **400 `invalid_request` + `field` (14 Eki 2026, yalnız ekleme):** ret `note` alanından
  geliyorsa (200 karakteri aşan ya da metin olmayan not) gövde
  `{ "error": "invalid_request", "message": "Not en fazla 200 karakter.", "field": "note" }`
  olur; uygulama hatayı not kutusunun altında gösterebilir. Başka 400'lerde `field` yoktur;
  `error` ve `message` değişmez.

> **Uygulama notu (§7).** `date` verilmezse İstanbul'a göre bugün; biçim bozuksa 400
> `invalid_request`. Kurallar (varsayılanlar parantezde, tümü panelden değişir):
> tarih bugün..+`bookingWindowDays` gün (60), `startHour` `firstHour`..`closeHour-1` (12–23),
> `hours` 1..`maxHours` (1–4), **`startHour + hours ≤ closeHour`** (24), `guests` 1..`capacity`,
> `note` ≤ 200 karakter. Sunucu her isteği o anki config'e göre doğrular; uygulama seçiciyi
> availability yanıtındaki alanlarla kurar, kural değişince yanıt önbelleksiz olduğu için hemen
> görür. Gövde JSON değilse 400 `invalid_request`. `requested` ve `confirmed` slotu bloke eder,
> `cancelled` etmez. Çakışmayı veritabanı tutar: `karaoke_reservations_no_overlap` dışlama
> kısıtı aynı saate düşen ikinci kaydı reddeder ve uç bunu **409** `slot_taken` olarak döner
> (aynı saniyede gelen iki istekten yalnız biri yazılır). ORO indirimi
> (`oroDiscountPct`, %15) `/me.loyalty.tier`'dan; rezervasyon anındaki yüzde kaydedilir, sonraki
> değişiklik eski kayıtları etkilemez. Panel onay/iptali `audit_logs`'a `karaoke_reservation`
> olarak düşer.

## 8. Bildirimler — `GET /notifications` (kimlik)

`{ "items": [ { "id", "kind": "order" | "reward" | "campaign" | "announcement" | "reservation", "title", "body", "at", "orderId": "…" | null } ] }` - sunucu **türetir**: son 30 günün sipariş durum değişiklikleri + aktif duyurular + ödül hazırsa bir kayıt + son 30 günün karaoke kararları ve kilometre taşı hediyeleri (23 Eyl 2026, aşağıda). Okundu durumu **cihazda** tutulur (`laf.notifications.readAt`).

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

### Karaoke kararları ve kilometre taşı hediyeleri (23 Eyl 2026, yalnız ekleme)

Kutu iki kaynaktan daha türetilir. Önceden personel bir karaoke saatini
onaylayınca ya da iptal edince üye bunu yalnız e-postadan öğreniyordu, sunucu
bir kilometre taşı hediyesi verdiğinde ise kutuda hiçbir şey görünmüyordu.

| Kaynak | `kind` | `id` | `at` | Başlık |
| --- | --- | --- | --- | --- |
| Personelin onayladığı karaoke rezervasyonu (`karaoke_reservations.status = "confirmed"`) | `reservation` | `karaoke-<rezervasyon id>-confirmed` | onay anı (`updatedAt`) | "Karaoke saatin ayrıldı" |
| Personelin iptal ettiği karaoke rezervasyonu (`"cancelled"`) | `reservation` | `karaoke-<rezervasyon id>-cancelled` | iptal anı (`updatedAt`) | "Karaoke rezervasyonun iptal edildi" |
| Verilmiş kilometre taşı hediyesi (`customer_milestone_rewards`, karar 175) | `reward` | `milestone-<damga sayısı>` | hediyenin verildiği an (`createdAt`) | "<damga sayısı> kahve oldu!" |

Gövdeler: onay `"26 Eylül 2026 · 20:00 - 22:00, 4 kişi. Girişte krk-00042 kodunu
söylemen yeterli."`, iptal `"… rezervasyonun iptal edildi; oda serbest
bırakıldı."` (onay ve iptal e-postalarının kendi cümleleri), hediye
`"Teşekkürümüz: Filtre Kahve kuponlarına eklendi, 30 gün geçerli."` (30 =
`MILESTONE_TTL_DAYS`, kuponun kendi süresi).

- **`at` sabittir.** `karaoke_reservations."updatedAt"`'i yalnız rezervasyonun
  açılışı ve durum değişikliği yazar, yani onaylanmış ya da iptal edilmiş
  satırda o an kararın anıdır. 30 günlük pencere `at`'e uygulanır.
- `requested` sessizdir: talebi üye kendisi yaptı. Onaylanıp sonra iptal edilen
  rezervasyon yalnız iptal kaydıyla, **yeni bir `id`** ile görünür; plan
  değiştiği için okunmamış gelir.
- Kuponu basılmamış kilometre taşı satırı (`couponId` boş: sürmekte olan ya da
  hata sonrası geri alınmış bir hak) kutuya düşmez; olmayan bir kupon
  duyurulmaz. Geçmiş zaman bilerek seçildi: kupon harcandıktan sonra da doğru
  kalır.
- İki kaynakta da `orderId` `null`dur; nesnenin altı anahtarı değişmedi.
- **Eski sürümler.** `reservation` yeni bir `kind`dır. Onu tanımayan sürüm
  bilinmeyen türü `announcement` olarak çizer (uygulama `src/data/http.ts`
  `NOTIFICATION_KINDS`): kayıt kaybolmaz, yalnız duyuru simgesiyle görünür.
  Hediye kaydı zaten bilinen `reward` türündedir.
- Pazarlama izni kapalıyken de listelenirler: ikisi de üyenin kendi işlemidir,
  ticari ileti değildir.
- E-postası doğrulanmamış üyede sipariş kayıtları gibi bunlar da listelenmez
  (üçü de yalnız e-postayla eşleşir).
- Bu iki kaynaktan biri okunamazsa kutu o kayıtlar olmadan 200 döner;
  veritabanına hiç ulaşılamazsa sipariş okuması yüzünden **503** aynen kalır.
- Hesap silinince (`DELETE /me`) kilometre taşı satırlarının e-postası da yer
  tutucuya çevrilir: adresi sonra kaydeden kişi önceki üyenin hediyesini
  duymaz.

Site: `deriveReservationNotifications` · `deriveMilestoneNotifications`
(`src/lib/mobile/notifications.ts`), `listReservationDecisions`
(`src/lib/mobile/karaoke.ts`); `tests/mobile-notifications.test.ts` ve
`tests/mobile-notifications-sources.test.ts` tutar.

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
      "shopEnabled": true,                        // MAĞAZA anahtarı = settings.isShopOpen (/admin/ayarlar). false → kargolu mağaza siparişi kapalı; sunucu 409 shop_closed.
                                                  // Mobil panelin anahtarı DEĞİLDİR: tek gerçeğin ikinci bir kopyası olmasın diye MobileAppConfig'e yazılmaz, yalnız telde görünür.
      "courierEtaMinutes": [25, 35],
      "closedMessage": "Uygulamadan sipariş şu an kapalı. Köşkte görüşürüz."
    },
    "loyalty": { "stampTarget": 6, "rewardTitle": "Ücretsiz içecek" },   // kupon değeri/süresi sunucuda kalır
    "reminders": {
      "enabled": true,                            // false → uygulama hatırlatma anahtarını gizler, planlananları iptal eder
      "items": [ { "id": "morning", "hour": 10, "minute": 0, "title": "Günaydın ☕", "body": "Sabah kahven köşkte hazır. Bugün ne içiyoruz?" } ]   // 0..4 öğe; fiyat/indirim/aciliyet dili yok; "hour" 8..21 (panel dışını kaydetmez, uygulama okurken düşürür)
    },
    "campaignCards": { "loyalty": true, "invite": true, "subscription": true },  // Kampanyalar ekranındaki sabit kartlar; "subscription" artık hiçbir kartı çizmez (karar 20)
    "fal": { "ai": false },   // 23 Eyl 2026, karar 177 (eklemeli): fA'L'ın yapay zekâ yorumu açık mı - OPENAI_API_KEY VE FAL_AI_ENABLED=true; false iken uygulama yalnız cihazda okur (§20)
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
| Sahneler (menü, ürün, mağaza kartları)     | `/menu` · `/shop`: `backdrop` · `photoCutout` · `vessel` (§1); yoksa `hue` → kategori → `house`          |
| 14 Ödüller · 15 Kart · 20 Pasaport         | `/me.loyalty` · `/loyalty/redeem` · `/coupons`                                                           |
| 16 Profil · 24 Bildirimler · 25 Adreslerim | `/me` · `PATCH /me` · `/me/addresses*` · `/notifications`                                                |
| 17 Canlı Durum                             | `/live-status` · `/bootstrap`                                                                            |
| 18 Kampanyalar                             | `/app-content.posts` (kind campaign) + sabit kartlar (`/bootstrap.app.campaignCards`) · `/promo/preview` |
| 19 Davet                                   | `/me.invite` · `Share`                                                                                   |
| 21 Sipariş Geçmişi                         | `/orders`                                                                                                |
| 22 Cüzdan · 23 Hediye Kartı                | Ekranlar yazıldı (lafmobil karar 60), uçlar (§18, §19) henüz yok: uygulama `GET /me/wallet` ve `GET /gift-cards/designs` `enabled: true` döndürmedikçe ikisini de gizler |
| 26 Karaoke                                 | `/karaoke/availability` (kurallar dahil) · `POST /karaoke/reservations`                                  |
| 27 Ziyaret                                 | `/bootstrap.venue` (adres, yer tarifi, harita sorgusu, 7 günlük saat tablosu) — seed yedek               |
| 28 Hikâye                                  | `/story` (§16) — seed yedek                                                                              |
| Kök yerleşim (bakım · zorunlu güncelleme)  | `/bootstrap.app.maintenance` · `/bootstrap.app.minSupportedAppVersion` — bootstrap gelmezse kapı açık    |
| Hatırlatmalar (cihaz bildirimi)            | `/bootstrap.app.reminders` — `enabled=false` → anahtar gizli, planlananlar iptal                         |

## 13. Hukuki belgeler — `GET /legal` · `GET /legal/{slug}` (herkese açık)

Uygulama kendi sözleşme kopyasını yazmaz. Sipariş kaydı sitenin sözleşme
revizyonuna rıza kaydeder; iki taraf farklı metin gösterirse o kayıt anlamsız
kalır. Bu yüzden tek kaynak `src/lib/legal/content.ts`'tir ve mobil onu okur.

**`GET /api/mobile/v1/legal`** — 25 belgelik dizin.

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
      "summary": "...",
      "updatedAt": "5 Eylül 2026"
    }
  ]
}
```

Üst `updatedAt` ödeme onayının kaydettiği sürümdür (`legalConsent.version`).
Her `docs[]` satırı ve tek belge kendi `updatedAt`'ini de
taşır: metnin son değiştiği gün (`content.ts` `updatedAt`, yoksa
`LEGAL_UPDATED`; panelden yayımlanmış bir geçersiz kılma varsa onun yürürlük
tarihi), bu yüzden üst etiketten sonra olabilir. Ödeme belgeleri
(`consentDocs`) kodda üst etiketle aynı tarihtedir, yani kodlu metin
gösterilirken sürüm `LEGAL_UPDATED`'dır. Panelden bir ödeme belgesine
geçersiz kılma yayımlanırsa (23 Eyl 2026, API-13) sürüm, `LEGAL_UPDATED` ile
o geçersiz kılmanın yürürlük tarihinden **hangisi daha yeniyse** odur;
yürürlük tarihi boşsa ya da "5 Eylül 2026" biçiminde değilse geçersiz
kılmanın kaydedildiği İstanbul günü sayılır. Web ve uygulama siparişi aynı
değeri yazar (`checkoutConsentVersion()` → `consentVersionFrom`, `src/lib/legal/`),
bu dizin de aynısını döner. Alan ve tipi değişmedi; yalnız değer, müşterinin
gerçekten gördüğü metnin tarihini izler.

**`GET /api/mobile/v1/legal/{slug}`** — tek belgenin tam metni; bilinmeyen slug
`404 not_found`. İkisi de `force-dynamic` ve `public, s-maxage=300,
stale-while-revalidate=3600` ile yayınlanır (bootstrap ile aynı pencere);
kimlik istemez.

### Panel geçersiz kılması (`/admin/hukuk`)

Sitede `/hukuk/<slug>` ne gösteriyorsa uygulama da onu gösterir: panelden
**yayınlanmış ve gövdesi dolu** bir geçersiz kılma varsa `title`, `summary`,
`updatedAt` (= panel "yürürlük tarihi", boşsa belgenin kodlu tarihi) ve
`sections` oradan gelir; dizin de aynı başlık/özet/tarihi yansıtır
(`consentDocs` değişmez; üst `updatedAt` yalnız geçersiz kılma bir ödeme
belgesindeyse ve daha yeni tarihliyse ilerler, yukarıya bak). Taslak ya da
boş geçersiz kılma sayılmaz; slug kümesi her zaman kodlu kayıttır (panel yeni
belge üretmez).
Gövde Markdown'dır ve `src/lib/mobile/legal-markdown.ts` bölümlere çevirir:
`## ` / `### ` → `heading`, `- ` / `* ` → `bullets`, `1. ` / `1) ` →
`ordered`, diğer satırlar → `paragraphs` (ardışık satırlar birleşir, boş satır
paragrafı kapatır), `**kalın**` işaretleri düşer, ilk başlıktan önceki metin
`shortTitle` başlığı altında toplanır; `references` düşer. Veritabanına
ulaşılamazsa iki uç da kodlu belgeye döner — 5xx vermez.

### Çevrimdışı taban

`npm run legal:export` (site deposu) `scripts/legal-export.mjs`'yi çalıştırıp
`laffogato-mobil/src/data/legal.seed.json` üretir: 25 belgelik dizin + **14
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
| Kod alfabesi   | `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (31 simge; O/0, I/1/L yok), 8 karakter, yalnız açık jetonlar arasında benzersiz. 13 Eki 2026'ya kadar dizide yanlışlıkla `L` vardı; o tarihten önce verilmiş kodlar zaten 120 sn'de biter |
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

---

## 18. Cüzdan — `GET /me/wallet` · `POST /me/wallet/topup` · `PATCH /me/wallet/auto-reload` (kimlik)

> **Karar 60 (9 Eyl 2026, operatör):** karar 20/30/38'in "cüzdan yapılmaz" kısıtı
> **kaldırıldı** — operatör ekranların tam yazılmasını, uçların site tarafında
> kendisince eklenmesini istedi. Ekran, uç gelene kadar `wallet.enabled=false`
> ile **hiç görünmez**; yarım özellik çizilmez (sunucusu olmayan teklif
> kullanıcıya gösterilmez). Uç indiğinde bayrak açılır, ekran kendiliğinden gelir.
>
> **Site tarafına iki not.** (1) Uç **henüz yokken 404** dönmesi beklenen
> durumdur ve uygulama bunu hata saymaz: `fetchWallet` 404'ü "bu kurulumda
> cüzdan yok" diye okur, uygulama tam olarak özellik hiç yokmuş gibi davranır
> (profilde satır yok, rota yok). 401/500/çevrimdışı ise **gerçek hatadır** ve
> hata durumu çizilir — cüzdanı olan bir üyeye sessizce sıfır bakiye
> gösterilmez. (2) `enabled: false` dönen bir uç ile hiç olmayan uç aynı
> anlama gelir, dolayısıyla kademeli açılış için bayrak tek başına yeterlidir.

`GET /me/wallet` → `Cache-Control: private, no-store`

```jsonc
{
  "enabled": true,                    // false ⇒ uygulama cüzdanı hiç çizmez
  "balanceMinor": 124000,             // kuruş; asla dize
  "currency": "TRY",
  "topUpOptions": [                   // tutar ve bonus SUNUCUDAN gelir, istemci hesaplamaz
    { "amountMinor": 25000,  "bonusMinor": 0 },
    { "amountMinor": 50000,  "bonusMinor": 2500 },
    { "amountMinor": 100000, "bonusMinor": 7500 }
  ],
  "minTopUpMinor": 10000,
  "maxBalanceMinor": 500000,          // tedbiri tavan; aşan yükleme 409
  "autoReload": { "enabled": false, "thresholdMinor": 10000, "amountMinor": 50000 },
  "transactions": [                   // en yeni önce, en fazla 50
    { "id": "wtx_…", "kind": "spend", "amountMinor": -89000, "title": "Sipariş #0284",
      "orderId": "ord_…", "createdAt": "2026-09-09T14:52:00Z" },
    { "id": "wtx_…", "kind": "topup", "amountMinor": 52500, "bonusMinor": 2500,
      "title": "Bakiye yükleme", "createdAt": "2026-08-28T09:10:00Z" }
  ]
}
```

`kind`: `topup` · `spend` · `refund` · `bonus` · `expiry` · `adjust` (panel düzeltmesi).

`POST /me/wallet/topup { "amountMinor": 50000 }` → **201**
`{ "payment": { "provider": "paynkolay", "redirectUrl": "…", "reference": "…" } }`

Bakiye **webhook onayından sonra** artar; istemci dönüşte `GET /me/wallet` ile tazeler.
İstemci bonus göndermez ve bakiye yazmaz — ikisi de sunucuda hesaplanır (§0 "fiyat
istemciden alınmaz" kuralının cüzdandaki karşılığı).

`PATCH /me/wallet/auto-reload { "enabled": true, "thresholdMinor": 10000, "amountMinor": 50000 }`
→ `{ "autoReload": { … } }`. Otomatik yükleme kayıtlı kart ister; kart yoksa **409**
`no_saved_card` (§15: kart bizde durmaz — otomatik yükleme ancak sağlayıcı jetonu varsa açılır).

Ödemede cüzdan kullanımı `POST /orders` gövdesine `"payWithWallet": true` ile girer; bakiye
yetmezse **409** `insufficient_balance` ve sipariş **oluşmaz** (kısmi çekim yok).

> **Sunucu (14 Eki 2026, yalnız ekleme).** `payWithWallet` yazıldı. Bakiye
> `wallet_transactions` defterindeki satırların toplamıdır (saklanan bir sayı yok);
> sipariş satırı ve harcama satırı tek SQL işleminde, üye başına kilit altında yazılır
> (`wallet_place_order`), dolayısıyla birlikte bakiyeyi aşan iki eşzamanlı siparişten
> yalnız biri geçer. Başarılı cüzdan siparişi kart ödemesiyle aynı yoldan `paid` olur
> (damga, davet, "ödemen alındı" e-postası) ve yanıt `payment: null` taşır. Cüzdan
> sunucuda `WALLET_ENABLED=true` olmadıkça kapalıdır; kapalıyken `payWithWallet: true`
> **409** `insufficient_balance` döner ve sipariş yazılmaz. Cüzdanla ödenmiş siparişin
> iadesi karta değil **cüzdana** döner (`kind: "refund"`). `GET /me/wallet`, yükleme ve
> otomatik yükleme uçları henüz yok (404, yukarıdaki not).
>
> **`expectedTotalMinor` (opsiyonel, 14 Eki 2026, yalnız ekleme).** Üyenin gördüğü ve
> onayladığı toplam, kuruş tamsayı. **Yalnız `payWithWallet: true` ile birlikte**
> dikkate alınır: kartla ödemede uygulama ödeme sayfası açılmadan önce "Tutar değişti"
> kartını gösterebilir, cüzdan ise anında çeker. Sunucunun hesapladığı toplam (veritabanı
> fiyatları, düşen kupon dahil) bu değerden farklıysa **409** `total_changed` döner, gövdede
> yeni toplam `totalMinor` bulunur (`{ "error": "total_changed", "message": "…",
> "totalMinor": 12500 }`); sipariş yazılmaz, bakiyeden hiçbir şey düşmez, alınan kupon geri
> verilir. Alan yoksa davranış öncekiyle aynıdır. `/orders/preview` alanı kabul eder ve
> yok sayar.

Hatalar: **400** `invalid_amount` (seçenek listesinde yok / min altında) · **409** `balance_cap` ·
**409** `insufficient_balance` · **409** `no_saved_card` · **429** `too_many_topups` ·
**503** `unavailable` · **409** `total_changed` (yalnız `POST /orders` + `payWithWallet` +
`expectedTotalMinor`; gövdede `totalMinor`).

> **Sadakat notu.** Tasarımın "cüzdanla ödeyene +%5 puan" satırı **yazılmadı**: bu uygulamada
> sadakat damgadır, puan yoktur (karar 37) ve ödenmiş kafe siparişi zaten +1 damga verir.
> Cüzdanla ödemeye ek bir damga verilecekse bunu **sunucu** kararlaştırır ve
> `bootstrap.app.loyalty` üzerinden bildirir; uygulama kendi başına bir kural uydurmaz.

> **Mağaza kuralı (Apple).** Bakiye **fiziksel** mal ve hizmet içindir (kafe siparişi, mağaza).
> App Store Guideline 3.1.3(e) uygulama dışında tüketilen mal/hizmet için kendi ödeme akışına
> açıkça izin verir — Starbucks modeli budur. Bakiye dijital içerik satın almakta
> **kullanılamaz**; kullanılırsa 3.1.1 (uygulama içi satın alma zorunluluğu) kapsamına girer.
> Bakiye TL'dir: iade koşulu Üyelik Sözleşmesi'ne bağlanmalı ve `maxBalanceMinor` üst sınırı
> korunmalıdır.

---

## 19. Hediye kartı — `GET /gift-cards/designs` · `POST /gift-cards` · `POST /gift-cards/redeem`

`GET /gift-cards/designs` (herkese açık) →

```jsonc
{ "enabled": true,
  "designs": [ { "key": "classic", "label": "Klasik", "artKey": "gift-classic" }, … ],
  "amountOptions": [ 25000, 50000, 100000 ],
  "minAmountMinor": 10000, "maxAmountMinor": 200000,
  "canSchedule": true, "maxScheduleDays": 90,
  "consentDocs": ["on-bilgilendirme-formu", "mesafeli-satis-sozlesmesi"] }
```

`consentDocs` (yalnız ekleme): satın almadan önce onaylanacak belgelerin `slug`ları (§13).
**Boş ya da eksikse uygulama hediye kartı için ödeme almaz** - ekran açılır ama "Gönder"
etkin olmaz, çünkü onay kutusu olmadan mesafeli satış kurulamaz (lafmobil karar 267).

`artKey` bir **çizim anahtarıdır**, URL değil: kart yüzü uygulamada `src/components/art` ile
çizilir, sunucudan görsel inmez (karar 40 fotoğraf politikası).

`POST /gift-cards` (kimlik) →

```jsonc
{ "designKey": "classic", "amountMinor": 50000,
  "recipient": { "phone": "+905320000000" },   // phone VEYA email, ikisi birden değil
  "message": "Doğum günün kutlu olsun",        // en fazla 140 karakter
  "deliverAt": "2026-09-12T06:00:00Z",        // null ⇒ hemen
  "legalConsent": true }                       // consentDocs onayı (zorunlu, §3'teki gibi)
```

→ **201** `{ "giftCard": { "id", "status": "pending_payment", "amountMinor", "deliverAt" },
"payment": { "provider": "paynkolay", "redirectUrl": "…", "reference": "…" } }`

Kart **ödeme onaylanınca** üretilir ve `deliverAt`'te SMS/e-posta ile gider.
`status`: `pending_payment` · `scheduled` · `delivered` · `redeemed` · `refunded` · `expired`.

`GET /me/gift-cards` (kimlik) → `{ "sent": [ …GiftCard… ], "received": [ …GiftCard… ] }`.

`POST /gift-cards/redeem { "code" }` (kimlik) → kodu **cüzdana** yükler (§18);
yanıt `{ "creditedMinor": 50000, "balanceMinor": 174000 }`. Cüzdan kapalıysa kupon üretir.

Hatalar: **400** `invalid_request` (`legalConsent` yok, §3 siparişiyle aynı `z.literal(true)` kuralı) · **400** `invalid_amount` · **400** `invalid_recipient` (telefon/e-posta biçimi) ·
**400** `message_too_long` · **400** `invalid_schedule` (geçmiş ya da `maxScheduleDays` ötesi) ·
**404** `gift_card_not_found` · **409** `already_redeemed` · **409** `own_card` ·
**429** `too_many_gift_cards` · **503** `unavailable`.

> **KVKK.** Alıcının telefonu/e-postası yalnız teslimat için işlenir, üçüncü tarafa aktarılmaz;
> saklama süresi Aydınlatma Metni'ne eklenmelidir. Alıcı üye değilse hesap **açılmaz** — kod
> bağlantıyla gelir, üyelik yalnız bozdururken istenir.

## 20. fA'L yapay zekâ yorumu - `POST /fal` · `GET|POST|DELETE /fal/consent` (kimlik)

23 Eyl 2026, karar 177, yalnız ekleme. Üye içeceğinin fotoğrafını çeker; açık rızası
(Açık Rıza Metni **R12**, bölüm 15/A) varsa fotoğraf küçültülüp OpenAI'nin Responses
API'sine gider ve eğlence amaçlı bir fal döner. Rıza yoksa, özellik kapalıysa ya da
yorum başarısızsa uygulama falı **cihazda** okur (karar 169); hiçbir hata üyenin
önüne falsız bir ekran koymaz.

**Açık/kapalı.** Yalnız `OPENAI_API_KEY` **ve** `FAL_AI_ENABLED=true` ikisi birden
varsa açıktır (`/bootstrap.app.fal.ai`). Anahtar tek başına açmaz: R12 metni avukat
okumasından ve yurt dışı aktarım için standart sözleşmeden geçmeden açılmamalıdır.
Model `OPENAI_FAL_MODEL` (varsayılan `gpt-5.4-mini`), görüntü `detail: "low"`,
yanıt katı JSON şeması, `store: false`.

`GET /fal/consent` → `{ "enabled": false, "version": "2026-09-23", "granted": false, "doc": "acik-riza-metni" }`

`POST /fal/consent { "version": "2026-09-23" }` → `{ "granted": true, "version": "2026-09-23" }`.
Güncel olmayan sürüm **409** `consent_outdated` (üye yürürlükteki metni görmüş olmalı).
Kayıt `feature_consents` satırıdır (üye, özellik, sürüm, zaman) ve rızanın ispatıdır.

`DELETE /fal/consent` → `{ "granted": false }`; satır silinmez, `revokedAt` yazılır.

`POST /fal { "image": "<base64 JPEG>" }` → **200**

```jsonc
{
  "reading": { "cupSeen": true, "drink": "Americano",
               "symbol": "Köpükte bir kuş kanat açmış.",
               "trait": "Sen yeni başlangıçlara cesaretle yürüyensin.",
               "forecast": "Bu hafta güzel bir sohbet seni bulacak." },
  "ai": true,
  "consentVersion": "2026-09-23",
  "remainingToday": 4,
  "model": "gpt-5.4-mini"   // 23 Eyl 2026, eklemeli: yorumu yazan model; bildirimde geri gönderilir
}
```

Sıra ve hatalar: **401** kimlik · **503** `fal_unavailable` (kapalı) · **403**
`email_unverified` (e-posta doğrulanmamış; 15 Eki 2026, yalnız ekleme: her yorum ücretli
bir model çağrısı, onaysız kayıtlar günlük hakkı adres başına yeniden açıyordu; uygulama
her retteki gibi falı cihazda okur) · **403**
`consent_required` (güncel rıza yok) · **429** `fal_limit` (İstanbul gününde üye başına
5) · **400** `invalid_json` / `invalid_request` / `invalid_image` (JPEG değil ya da
çözülmüş hâli 900 KB'tan büyük) · **502** `fal_failed` (model yanıt vermedi, şemaya
uymadı ya da yanıt bir vaat içeriyordu) · **503** `unavailable` (veritabanı).

> **Gizlilik (R12).** Sunucuya giden: fotoğraf (uygulamada 768 px'e küçültülmüş,
> meta verisiz). Modele giden: fotoğraf ve kimliksiz bir not - seviye adı
> (L'AF/PEARL/RUBY), ziyaret sıklığı kelimesi, varsa "her zamanki" içeceğin adı. Ad,
> e-posta, telefon, üye no **gitmez**. Fotoğraf **saklanmaz**; üretilen metin
> yalnız üye onu bildirirse `fal_reports`'ta 90 gün durur (aşağıda, `POST
> /fal/report`). `fal_readings` yalnız gün, `cupSeen` ve model adını tutar, 90
> günde silinir (`src/lib/retention.ts`).
>
> **Vaat yok (TKHK md. 61).** "indirim · bedava · ücretsiz · hediye · kupon · puan ·
> damga · kampanya" ya da sağlık/yatırım kökü geçen yanıt gösterilmez (502, uygulama
> cihazda okur).

### `POST /fal/report` - "Bu yorumu bildir" (23 Eyl 2026, yalnız ekleme)

Google Play'in yapay zekâ ile üretilen içerik politikası, üyenin bir yapay zekâ
yanıtını uygulamanın içinden bildirebilmesini ister. Yapay zekâ yorumu
açılmadan önce gereken uç budur.

`POST /fal/report { "text": "…", "reason"?: "…", "model"?: "…" }` (kimlik) →
**201** `{ "ok": true }`

| Alan | Kural |
| --- | --- |
| `text` | Üyenin ekranda gördüğü yorumun sözleri (içecek, sembol, kişilik, öngörü; uygulama aralarına ` · ` koyabilir). Boşluklar teke indirilir; boş ya da 800 karakterden uzunsa **400** `invalid_request`. |
| `reason` | Kapalı liste: `offensive` (Kırıcı ya da uygunsuz) · `promise` (Bir şey vaat ediyor) · `sensitive` (Sağlık, para ya da ilişki hakkında) · `other` (Başka bir sebep). Verilmezse ya da bilinmeyen bir değer gelirse `other` kaydedilir. Serbest metin alınmaz: üye oraya kişisel veri yazabilirdi. |
| `model` | `POST /fal` yanıtındaki `model`, olduğu gibi. Yoksa ya da model adına benzemiyorsa boş kaydedilir. |

- **Fotoğraf asla.** Gövdedeki başka alanlar yok sayılır. Fotoğraf zaten hiçbir
  yerde saklanmaz, bildirim bunu değiştirmez; bildirim yapay zekâ hizmet
  sağlayıcısına da gönderilmez.
- **Anahtara ve rızaya bağlı değil (karar).** `FAL_AI_ENABLED` kapalıyken ya da
  üye R12 rızasını geri çektikten sonra da çalışır: ekranda duran bir yapay
  zekâ yorumu bildirilebilir kalmalı. Uygulama bağlantıyı **yalnız** `ai: true`
  gelen yorumun altında gösterir; cihazda okunan fal bu uca hiç gelmez.
- **Sınır:** üye başına İstanbul gününde 10 bildirim (`FAL_REPORT_DAILY_LIMIT`,
  günlük yorum sınırının iki katı) → **429** `fal_report_limit` ("Bugünlük
  bildirim sınırına ulaştın. Teşekkür ederiz; yarın yeniden bildirebilirsin.").
  Aynı gün aynı sözler ikinci kez gelirse yeniden yazılmaz ve **200**
  `{ "ok": true }` döner; uygulama her 2xx yanıtı başarı sayar.
- Hatalar: **401** kimlik · **400** `invalid_json` / `invalid_request` ·
  **429** `fal_report_limit` · **503** `unavailable` (veritabanı).
- **Saklama:** `fal_reports` (üye, gün, sebep, metin, model, zaman) 90 gün sonra
  silinir (`src/lib/retention.ts`, kural `fal-reports`; Veri Saklama ve İmha
  Politikası'ndaki satır). Hesap silinince satırın e-postası yer tutucuya
  çevrilir (`ANON_SWEEPS`). Operatör bildirimleri panelde
  `/admin/mobil/fal-bildirimleri` sayfasında okur; orada üyenin adresi
  gösterilmez.
- Gizlilik Politikası, KVKK Aydınlatma Metni §12, Açık Rıza Metni R12 ve Veri
  Saklama ve İmha Politikası bildirimi, neyi tuttuğunu ve süresini anlatır;
  metinler yapay zekâ açılmadan önceki avukat okumasına dâhildir.
- Site: `src/app/api/mobile/v1/fal/report/route.ts`, `falReport*`
  (`src/lib/mobile/fal-core.ts`), `recordFalReport` (`src/lib/mobile/fal.ts`);
  `tests/mobile-fal-report.test.ts` tutar.

## 21. `POST /staff/stamp` - uygulamadan kasa (barista) (kimlik)

15 Eki 2026, yalnız ekleme. Operatör: *"barista yani kasiyer hesabı da admin
panelden atayabilelim ki qr kodunu okutalım"*. Panelin `cashier` rolü (§17,
`/admin/kasa`) yerinde kalır; bu uç, panele hiç girmeyen bir baristanın **kendi
üye hesabıyla açtığı uygulamadan** üyenin QR'ını okutmasını sağlar.

**Yetki panelde verilir.** `/admin/kullanicilar` → "Uygulamadan kasa
(barista)" (`requireRole("adminUsers")`, yalnız sahip). Yönetici üyenin
e-postasını yazar; adres **var olan ve açık** bir üye hesabına ait olmalıdır,
yoksa panel reddeder ("Bu adrese ait üye hesabı yok..." / "Bu üye hesabı
kapalı..."): kimsenin tutmadığı bir adrese verilen yetki, o adresle ilk kaydolan
kişiye geçerdi. Yetki `staff_members` tablosunda durur (`email`, `role =
'barista'`, `isActive`, `grantedBy`, `grantedAt`, `updatedAt`); kaldırınca satır
silinmez, `isActive = false` olur ve bir sonraki okutma reddedilir. Verme ve
kaldırma `audit_logs`'a `staff_member` olarak yazılır. Üye hesabını silerse
(`DELETE /me`) yetki satırı da silinir; adresi sonra kim alırsa yetkisiz başlar.

```jsonc
// İstek
{ "kind": "token" | "code", "value": "…", "stamps": 1 }   // stamps isteğe bağlı, varsayılan 1

// 200 · Cache-Control: private, no-store - kasanın gördüğü sonucun aynısı
{
  "name": "Eda",                    // üyenin adı; yoksa ""
  "memberLabel": "e***@ornek.com",  // maskeli adres (kasadaki gibi)
  "code": "K7P42M9X",
  "stampsGiven": 1,
  "stamps": 4,                      // üyenin yeni damga durumu (§5)
  "stampTarget": 6,
  "rewardsReady": 0
}
```

| Alan | Kural |
| --- | --- |
| `kind` | `token` (kameranın çözdüğü QR içeriği, olduğu gibi) ya da `code` (8 karakter; boşluk, tire ve küçük harf kasadaki gibi normalleşir). Kasanın üçüncü yolu olan **e-posta yok**: üyenin kendisi olmadan bir üyeyi adıyla damgalamak panel kararıdır. Başka bir değer **400** `invalid_request`. |
| `value` | Boş olamaz, en fazla 200 karakter → aksi **400** `invalid_request`. |
| `stamps` | Tam sayı, verilmezse 1. Aralık (**1-5**) burada değil, kasanın kendi fonksiyonunda denetlenir: dışındaysa **400** `invalid_stamps`. Kırpılmaz. |

**Kurallar kasayla birebir aynı.** Uç, kasanın kullandığı
`redeemCounterToken`'ı (`src/lib/mobile/counter.ts`) çağırır: jeton 120 sn
yaşar, bir jeton bir kez damga verir (koşullu UPDATE), aralık 1-5, damga
`loyalty_stamps`'e `source: "counter"` ile yazılır. Fark iki satırdadır:
`actor` (ve jetonun `usedBy`'ı) baristanın e-postasıdır ve not
`Kasa · QR · Uygulama` / `Kasa · kod · Uygulama` olur. Okutma `audit_logs`'a
`counter_token` olarak, **aktör baristanın e-postasıyla** ve
`payload.via = "app"` ile yazılır; denetim satırı yazılamazsa damga geri
alınmaz ve yanıt yine 200'dür.

**Kendi kodu yok.** Barista kendi QR'ını ya da kodunu okutursa **403**
`self_stamp` ("Kendi koduna damga veremezsin. Damganı başka bir barista ya da
kasa versin."). Ret, jeton yakılmadan önce, yakılacak satırın kendisine bakılarak
verilir; baristanın kodu kullanılmamış kalır ve gerçek kasada çalışır.

**Sıra.** Kimlik → e-posta doğrulanmış mı → yetki (`not_staff`) → gövde → hız
sınırı → okutma. Yetkisi olmayan üye gövdesi okunmadan reddedilir.

| Hata | Ne zaman |
| --- | --- |
| **401** `unauthorized` · **403** `account_disabled` | Kimlik katmanı (§0) |
| **403** `email_unverified` | Baristanın e-postası doğrulanmamış (yetki adrese bağlı olduğu için) |
| **403** `not_staff` | **Yeni.** Bu hesabın açık barista yetkisi yok ya da kaldırıldı. "Bu hesabın kasa yetkisi yok. Yetkiyi panelden yönetici verir." |
| **403** `self_stamp` | **Yeni.** Baristanın kendi kodu (yukarıda) |
| **400** `invalid_json` · `invalid_request` | Gövde JSON değil ya da şemaya uymuyor |
| **400** `invalid_stamps` | Damga sayısı 1-5 dışında (§17'deki kasa sonucu) |
| **404** `not_found` | Kod bulunamadı. "Kod bulunamadı. Üyeden kartını yeniden açmasını iste." |
| **409** `expired` | Kodun 2 dakikası doldu (§17'deki metin) |
| **409** `already_used` | Kod daha önce okutuldu; aynı QR ikinci kez damga vermez (§17'deki metin) |
| **429** `rate_limited` + `Retry-After` | Baristanın 5 dakikada 15 `not_found`'u (`auth_attempts`, amaç `staff-stamp`, IP + barista); 1 dakika kilit. Süresi dolmuş ya da kullanılmış kod sayılmaz: kalabalık bir barda dürüst hatalardır, tahmin `not_found` üretir. |
| **503** `unavailable` | Veritabanına ulaşılamadı |

> **Uygulama notu (§21).** Okutucu yalnız `/me.staff.till === true` iken
> görünür; 403 `not_staff` gelirse uygulama `/me`'yi tazeler ve okutucuyu
> kapatır (yetki bu arada kaldırılmış olabilir). Kasadaki okuma kapısının
> (§17 "Kasa tarafı") üç durumu burada da geçerlidir: aynı değer 2,5 sn içinde
> yeniden gönderilmez, `already_used`/`expired`/`self_stamp` dönen değer bir
> daha gönderilmez, ağ hatasında hemen yeniden okunabilir.

- Site: `src/app/api/mobile/v1/staff/stamp/route.ts`, `staffStampSchema`
  (`src/lib/mobile/staff-schema.ts`), yetki `src/lib/admin/staff-members.ts`,
  panel `src/app/admin/kullanicilar/`; `tests/mobile-staff-stamp-route.test.ts`,
  `tests/admin-staff-actions.test.ts` ve gerçek Postgres'te
  `tests/db-integration-staff-stamp.test.ts` tutar.
