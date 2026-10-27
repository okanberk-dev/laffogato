@AGENTS.md

# Laffogato — Kafe + E-ticaret Platformu

Bu dosya, Claude Code'un bu projede tutarlı çalışması için gerekli bağlamı
içerir. Next.js'in bu sürümüne özgü kurallar için `AGENTS.md`'yi de oku.

## Proje Özeti

**Laffogato** (marka: **L'Affogato**) İstanbul Tuzla'da açılan kafenin kurumsal
web sitesi + online mağazasıdır. Müşteri menüye bakar, ürün satın alır, ödeme
yapar; admin paneli üzerinden ürün / menü / sipariş / içerik yönetimi tek yerden
yapılır.

- **Stack:** Next.js 16 (App Router + Turbopack) · React 19 · Tailwind v4 ·
  TypeScript · Zod
- **Deploy hedefi:** Vercel
- **Veri:** **Postgres**, `pg` sürücüsüyle. Veri **Neon'da** kalır, Supabase yalnız kimliktir (19 Eki 2026 incelemesi, docs/DATABASE.md; taşıma yordamı docs/SUPABASE-GECIS.md hazır ama uygulanmadı) ve koda
  özgü bir bağımlılık yok — bağlantı dizesi değişince başka bir Postgres'e
  taşınır. **Taşımadan önce `docs/DATABASE.md`'deki sağlayıcı geçmişi uyarısını
  oku:** proje bir kez Supabase'den taşındı ve sebebi bir aylık kesintiydi.
  Sağlayıcının adı 35 hukuki pasajda geçer ve `{{DB_PROVIDER}}` token'ıyla tek
  kaynaktan gelir (`src/lib/legal/entity.ts`).
- **Adres:** Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1 (Menemenci
  Cumhur'un yanı), 34940 Tuzla / İstanbul — vergi levhasıyla doğrulandı
- **Auth:** Admin için env-credentialed imzalı cookie (`ADMIN_EMAIL` +
  `ADMIN_PASSWORD` + HMAC SHA256) ve TOTP 2FA. Müşteri için bcrypt hesap
- **Ödeme:** Sağlayıcı bağımsız soyutlama (`src/lib/payment/`). Sanal POS
  **PayNkolay**; kart web'de **checkout sayfasının kendisinde** (`/odeme`,
  iki adım: Teslimat → Ödeme), uygulamada `/odeme/paynkolay`'da girilir,
  sunucu onu yalnızca PayNkolay'a iletir ve müşteri doğrudan bankanın
  3D ekranına gider (`PAYNKOLAY_CHECKOUT_MODE=direct`). **Kart saklanmaz**:
  kural 28, `docs/PAYNKOLAY.md` §15. Geliştirmede `MockPaymentProvider`.
  iyzico 15 Eki 2026'da koddan kaldırıldı; hukuki metinler 16 Eki 2026'da
  PayNkolay'a çevrildi (`docs/LEGAL-REDLINES-2026-09.md` başındaki durum
  tablosu; `tests/legal-docs.test.ts` metinde iyzico, uzun tire, "kart
  sunucumuza uğramaz" ve cüzdan / hediye çeki sözü kalmadığını tutar). Masa ve
  grup rezervasyonu yok (17 Eki 2026): rezervasyon yalnız karaoke odası için,
  metinler masa rezervasyonu vaat etmez (aynı test; LEGAL-REDLINES §17). Metinler
  avukat okumasını bekler
- **Dil:** Arayüz **Türkçe**. Kod, dosya adı, identifier, commit mesajı
  **İngilizce**

## Mobil Uygulama — `RiosenBeq/lafmobil`

Bu site tek başına değil. **Aynı markanın mobil uygulaması `RiosenBeq/lafmobil`
deposunda yaşıyor** (Expo / React Native) ve verisini bu depodaki
`src/app/api/mobile/v1/**` uçlarından alıyor. İki depo tek bir sözleşmeye
bakar: `docs/API-MOBILE.md` — kopyası her iki depoda durur ve **ikisi aynı
olmalıdır**.

> **`/api/mobile/v1` sözleşmesini BOZMA.** Uygulama mağazadan yayınlanmış
> sürümlerle sahada; eski sürümler güncellenmeden aynı uçlara istek atmaya
> devam eder. v1 içinde **yalnız ekleme** yapılır:
>
> - Alan **silme**, **yeniden adlandırma**, tip değiştirme yok.
> - Zorunlu yeni istek alanı yok (yeni alan opsiyonel + varsayılanlı olmalı).
> - Hata kodları, HTTP durum kodları ve kimlik doğrulama yöntemi
>   (`Authorization: Bearer <Supabase JWT>`) değişmez.
> - Kırıcı bir değişiklik gerekiyorsa `/v2` açılır; v1 ayakta kalır.
> - Uç davranışını değiştiren her PR'da `docs/API-MOBILE.md` **aynı PR'da**
>   güncellenir ve `lafmobil` tarafına haber verilir.

**Paralellik nasıl korunur (ve nasıl kontrol edilir).**

- `docs/API-MOBILE.md` iki depoda **bayt bayt aynı**. `lafmobil`
  `src/data/contract-sync.test.ts` belgenin SHA-256'sını kilitler; bu depodaki
  `tests/api-contract-parity.test.ts` `../lafmobil` yanında klonluysa iki kopyayı
  karşılaştırır (CI'da tek depo olduğu için atlanır). **Buradaki belgeye
  dokunan her değişiklik aynı oturumda `lafmobil`'e kopyalanır ve oradaki
  `RECONCILED` hash'i güncellenir** (ayrı PR) — yoksa iki taraf da kendi
  kopyasını gösterip haklı çıkar.
- Belge değil **kod** esastır. Paralelliği kontrol ederken `lafmobil`
  `src/data/http.ts` (uygulamanın her yanıtı nasıl okuduğu) ile buradaki
  `src/lib/mobile/*-mapper.ts` / `*-schema.ts` alan alan karşılaştırılır:
  uygulamanın okuduğu ama sunucunun göndermediği alan (23 Eyl: `cafeOnly`),
  panelin kabul edip uygulamanın düşürdüğü değer (23 Eyl: hatırlatma saati
  08–21) ve uygulamanın dallandığı hata kodları.
- Uygulama bir alanı zaten okuyorsa onu sunucuya eklemek v1 içinde güvenlidir
  (yalnız ekleme). Uygulamanın bir değeri sessizce düşürdüğü yerde panel aynı
  sınırı **mesajla** zorlar (`APP_CONFIG_LIMITS`).

**fA'L uygulamadan kalktı (27 Ekim 2026).** App Review iOS gönderimini
Guideline 4.3(b) (fal, astroloji) ve 5.1.1(v) (kayıtta zorunlu telefon) ile
reddetti. Uygulama fA'L'ı ve yapay zekâ yorumunu kaldırdı (lafmobil karar
330); yerine **Kahve Modu** geldi: üye günün kahve modunu (herkese aynı) ya
da seçtiği başka bir modu kendi içecek fotoğrafına yazdırıp Story olarak
paylaşır ya da cihazına kaydeder. Fotoğrafa bakılmaz, yalnız telefonda
işlenir; uygulama onu L'Affogato'ya ya da başka bir yere göndermez. Yapay
zekâ, tahmin ya da okuma yok. Kayıtta telefon artık isteğe bağlı (lafmobil
karar 329). Sitede bunun anlamı:

- Müşteriye görünen hiçbir metin (hukuk metinleri, `public/llms*.txt`, SSS
  ve SEO, e-posta şablonları, sayfa metadatası, panelden yazılan slayt,
  kampanya ve gönderiler) fA'L'ı, fal, burç, kehanet ya da yapay zekâ
  yorumunu uygulamanın bir özelliği olarak anlatmaz; Kahve Modu "eğlence
  amaçlı" diye de anlatılmaz ve cihaz için "saklanmaz" denmez, "gönderilmez"
  denir. Rehberlerdeki "telve" (demlemede kahve posası) bu kuralın konusu
  değildir.
- `/api/mobile/v1/fal*` uçları ve `bootstrap.app.fal` v1 gereği kalır (yalnız
  ekleme); karar 330'dan sonraki uygulama derlemeleri onları çağırmaz ve
  okumaz. `FAL_AI_ENABLED` hiçbir ortamda tanımlanmaz.
- İş listesi ve önerilen hukuk cümleleri lafmobil
  `docs/site-handoff/APP-TO-SITE-2026-10-27.md`; reddin kaydı lafmobil
  `docs/APP-REVIEW-2026-10-27.md`. Bu depodaki fA'L geçen eski kayıtlar
  (`docs/AUDIT.md` düzeltme satırları, `docs/handoff/**`) tarihçedir.

**İş mantığını web ile paylaşırken uçtan değil kütüphaneden geç.** Web'in
kimliği bcrypt çerez oturumu, uygulamanınki Supabase bearer token'ı — web bir
mobil ucu HTTP ile çağıramaz. Doğru desen: ortak kuralları saf bir `*-core`
modülünde tut, veritabanına dokunan yarıyı ayrı dosyada bırak, iki yüzey de
aynı fonksiyonu çağırsın. Örnekler: `src/lib/mobile/karaoke-core.ts` ↔
`karaoke.ts` (web `/karaoke` sayfası ile mobil uç aynı `createReservation`'a
iner), `loyalty-core.ts` ↔ `loyalty.ts`.

**Tasarım paritesi VAR (25 Eyl 2026'dan beri) - kaynak uygulamadır.**
Operatör talimatı (25 Eyl 2026): _"lafmobil ... tasarımı apple'a uygun, sen de
site tasarımını buna uygun olarak güncelle"_. Bu, lafmobil karar 31'i (c)
seçeneğiyle kapattı: site uygulamanın bütün paletini (`lafmobil/src/theme/tokens.ts`,
`porcelain`, DESIGN-GLASS §13), iki yazı sesini (Poppins gösterim, Inter
okuma) ve cam malzeme dilini (kapsül düğme, cam kart, yüzen cam krom, sekme
çubuğu) aldı. **Yazıda tek ayrışma (operatör, 11 ve 14 Eki 2026):** site
başlıkları ve gösterim rakamlarını **Gabarito**'yla (`--headline`; operatörün
istediği Biennale'nin lisanssız olduğu için yerine duran serbest akrabası),
gövdeyi, kontrolleri, ürün adlarını ve liste fiyatlarını **Poppins**'le
(`--display`, 300-800) yazar; Inter yok. Uygulama hâlâ Poppins + Inter; onun
izlemesi lafmobil'de ayrı bir karardır (`docs/BRAND.md` §2). Değerler: porselen zemin `#f7f3ed`, yapı yeşili `#1d6d56`,
bordo `#9d2543` / `#520f1f` / `#f9e6ea`, pirinç `#e8c877`, altın metin
`#765923`, gölgeler `rgba(59, 42, 30, …)`. **Logo L'Af** (`public/brand/`,
`<LafMark>`); uygulama ikonu da odur. Uygulamanın paleti değişirse site aynı
PR serisinde izler (değer tablosu lafmobil `docs/SITE-PALETTE-SYNC.md`);
ayrışma operatör kararı ister. **E-postalar da 15 Eki 2026'dan beri bu
palette** ve açık/koyu modda okunur: zemini gömülü bantlar HTML çubuğa,
logo çifti ve glint GIF'i tek opak karoya (`public/email/logo-laf-tile.png`)
döndü; koyu mod sınıf kancalarıyla (`em-card`, `em-t1`… ;
`prefers-color-scheme` + Outlook `[data-ogsc]`/`[data-ogsb]`), ayrıntı
`src/lib/email/templates/README.md` "Palet". Supabase'in dört giriş
e-postası (`docs/email/`) aynı iskelette; panele elle yapıştırılır.
`tests/brand-theme.test.ts` ve `tests/email-templates.test.ts` tutar. Tam
kılavuz ve geçmiş: `docs/BRAND.md`.

**Bordo ile yeşil asla üst üste yazılmaz.** `#9D2543` ile ev yeşili
neredeyse aynı parlaklıkta (`--hero-green` ile 1.21:1). Koyu zeminde
`--accent-on-dark` kullanılır; `.script` bunu `--script-ink` değişkeniyle
kendiliğinden yapar, koyu bir blok yazarken `data-ground="dark"` eklemek
yeterlidir. `tests/contrast.test.ts` her iki kuralı da tutar.

## Ön yüz ↔ Arka yüz Sınırı

> **Müşteri arayüzü yeniden tasarlanacak; arka yüz bundan etkilenmemeli.**
> Tam sınır, alan tabloları ve kontrol listesi: **`docs/FRONTEND-SINIR.md`**.
> Ön yüz işine başlarken skill: **`frontend-redesign`**.

- **Ön yüz (serbest):** `src/components/laffogato/**`, `src/components/uye/**`,
  `src/components/customer/**`, `src/app/globals.css`, müşteri `page.tsx` /
  `*-form.tsx` dosyalarının **işaretlemesi**, `public/**`.
- **Arka yüz (ön yüz PR'ında değişmez):** `src/lib/**`,
  `src/app/**/actions.ts`, `src/app/**/route.ts`, `src/app/api/**`
  (özellikle `api/mobile/v1` — sahadaki uygulama), `src/proxy.ts`, `db/**`,
  `scripts/**`, `next.config.ts`, `vercel.json`, `docs/API-MOBILE.md`,
  `src/app/admin/**`. Gerçekten gerekiyorsa **ayrı PR**.
- **Aradaki sözleşme** (TypeScript ve build bunları görmez; testler görür):
  1. Form `name`'leri = action'ın `formData.get(...)` adları —
     `tests/frontend-form-contract.test.ts`. Form başka dosyaya taşınınca
     yalnız testteki `forms` yolu güncellenir, alan listesi değil.
  2. Onay kutuları (`legalConsent`, `acceptedTerms`, `marketing`,
     `newsletter`, `consent`) işaretsiz başlar — aynı test.
  3. Sepet: `localStorage["laffogato_cart_v1"]` ve `items` JSON biçimi
     (`productId, variantId, name, price, qty`; fiyat yalnız gösterim).
  4. Action'ların yönlendirmeleri sayfada karşılanır: `/?cart=…`,
     `/?hesap=silindi`, `/odeme?error=consent|payment`, `/uye/giris?next=…`,
     `/bulten/onay?sonuc=…`, `/bulten/cikis?sonuc=…`. Bülten onayı ve çıkışı
     **düğmedir** (POST) — e-posta tarayıcıları bağlantıları açar.
  5. Dışarıdan çağrılan yollar yeniden adlandırılmaz: e-posta linkleri,
     `/odeme/donus`, `/gorsel/**`, `/hukuk/[slug]`, `/bulten/cikis`,
     `/bulten/onay`, `/masa/[code]` (masalardaki basılı QR), `/api/**`.
  6. Genel sayfa veriyi `loadAppProps()` ya da `src/lib/seo/site-data.ts`'in
     önbellekli okuyucularıyla (`getSiteSettings`, `listSite*`,
     `getSiteProductBySlug`, ...) okur: sayfa görüntülemesi veritabanını
     uyandırmaz. `getPublicSettings()` ve `store.ts`'in `list*` / `get*`
     okuyucuları her seferinde veritabanına gider; ödeme, karaoke, uygulama
     API'si ve üyenin kendi sayfaları içindir
     (`tests/public-pages-cached-reads.test.ts`). Bileşende `@/lib/db` yok;
     istemci bileşeni `server-only` modül import edemez (saf mantık için
     `*-core.ts` / `*-utils.ts`).
- **Ön yüz PR'ı bitmeden:** `git diff --stat origin/main -- src/lib src/app/api
  db scripts src/proxy.ts 'src/app/**/actions.ts' 'src/app/**/route.ts'`
  **boş** dönmeli.

## Klasör Yapısı

```
src/
  app/
    page.tsx                 → Müşteri SPA entrysi (hash router: #home, #menu, ...)
    layout.tsx               → next/font ile iki ses (Gabarito başlık 600-800,
                               Poppins metin 300-800) + Consent
                               Mode bootstrap (GTM'den önce) + GTM
    globals.css              → Tüm design tokens + müşteri SPA stilleri
    menu/ magaza/ hikayemiz/ → Müşteri rotaları (SPA içeriğinin SEO'lu karşılıkları)
    ziyaret/ hukuk/
    odeme/                   → Tek sayfa checkout (checkout.tsx + kartın yerli
                               formu card-payment.tsx) + startCheckoutAction +
                               /basarili
    uye/                     → Müşteri hesabı (giriş, kayıt, sipariş geçmişi,
                               adresler, favoriler, promosyonlar, bildirimler)
    admin/                   → Admin panel (proxy korumalı)
      urunler/ kategoriler/  → Shop ürünleri (wizard, ice-aktar: CSV) +
                               kategoriler
      menu/                  → Kafe menüsü
      siparisler/            → Sipariş listesi + detay + manuel sipariş
      masalar/               → Masalar · QR (sahip + yönetici): ad, QR, yazdır,
                               pasifleştir, kodu yenile
      musteriler/            → CRM-lite
      promosyon/ raporlar/   → Promosyon kodları · ciro raporları
      stok-hareketleri/      → Stok audit + manuel düzeltme
      olay-kaydi/            → Mutasyon audit log (owner-only)
      icerik/ hikaye/ basin/ → Site içeriği, hikaye zaman çizelgesi, basın
      magaza-hero/           → Mağaza hero slaytları
    hukuk/ bulten/ ayarlar/→ Hukuki metinler · bülten · ayarlar
      giris/ iki-asama/      → Login + 2FA akışı
      2fa-kurulum/
    masa/[code]/             → Masadaki QR'ın açtığı salt görüntüleme menü +
                               masa adı (noindex, sitemap'te yok)
    rehber/                  → SEO rehber hub'ı + /rehber/[slug] (Article +
                               FAQPage + Recipe yapısal verisi)
    api/webhooks/payment/    → Sunucudan sunucuya ödeme bildirimi (HMAC)
    api/panel/karaoke/       → Köşkün panelinin imzalı karaoke okuması
                               (HMAC, docs/PANEL-KARAOKE.md)
    api/panel/menu/          → Köşkün panelinin imzalı menü okuması ve
                               fiyat / satış durumu yazımı (docs/PANEL-MENU.md)
    api/panel/orders/        → Köşkün bar ekranına açık kafe siparişleri
                               (imzalı okuma) + stage/ (tek dokunuş aşama;
                               docs/PANEL-ORDERS.md)
    api/panel/sales/         → Köşkün kâr-zararına ve kasa raporuna dönemin
                               online satışı (imzalı; docs/PANEL-SALES.md)
    api/mobile/v1/           → Mobil uygulama API'si (docs/API-MOBILE.md):
                               menu · shop · bootstrap · live-status ·
                               karaoke/* (herkese açık) · me/* · orders/* ·
                               loyalty/redeem · coupons · invite/claim ·
                               tables/{code} (herkese açık, masa QR'ı) ·
                               notifications (Bearer Supabase JWT) · app-content
    odeme/app-hata/          → Uygulama ödemesi başarısız → derin bağlantı
    odeme/donus/             → Sanal POS'un MÜŞTERİYİ POST ettiği dönüş
                               (PAYNKOLAY_SUCCESS_URL + _FAIL_URL burayı göstermeli)
    gorsel/                  → Yüklenen görsellerin önbelleklenebilir servisi
    bulten/cikis/            → Tek tıkla bülten aboneliğinden çıkış (6563)
  proxy.ts                   → (src/ kökünde) Supabase oturum yenileme +
                               cookie-tabanlı admin guard
  components/
    laffogato/               → Müşteri SPA
      app.tsx                → Shell (cart, route, notice, settings)
      chrome.tsx             → Nav + Footer
      home-page.tsx · menu-page.tsx · shop-page.tsx ·
      story-page.tsx · visit-page.tsx
                             → Sayfa gövdeleri; app.tsx her birini
                               next/dynamic ile ayrı chunk olarak yükler
                               (statik import etme - spa-page-chunks testi)
      page-shared.ts         → PageProps + MENU_TAG_LABELS
      ui.tsx                 → ProductCard, CartDrawer, ProductModal, ...
      visuals.tsx            → SVG illüstrasyonlar + HUES yüzey paleti
      product-detail.tsx     → Ürün detay (PDP)
      shop-hero-slider.tsx   → Mağaza hero karuseli
      reveal-motion.tsx      → Scroll reveal gözlemcisi
      data.ts                → Statik seed (MENU, PRODUCTS, LOCATION, ...)
    admin/                   → Admin form primitives + liste/form bileşenleri
      forms.tsx              → Field, TextInput, Select, Button, Card, ...
      product-wizard.tsx     → 5 adımlı ürün sihirbazı (yeni + düzenle)
  lib/
    admin/                   → auth · store (veri katmanı) · audit · roles ·
                               product-schema (Zod)
    customer/                → Müşteri hesapları, kuponlar, auth
                               supabase-bridge.ts + supabase-link-plan.ts
                               (Supabase kullanıcısı ↔ customers satırı) ·
                               member-orders.ts (sipariş geçmişi — yalnız
                               doğrulanmış e-postaya)
    supabase/                → config · anon (bearer doğrulama) · server ·
                               client · proxy (oturum yenileme) — YALNIZ kimlik
    mobile/                  → Mobil API iş mantığı: auth (requireMobileCustomer) ·
                               respond · menu(-mapper) · customization ·
                               orders · order-{schema,pricing,mapper,address} ·
                               me(-mapper/-schema) · loyalty(-core) · invite(-code) ·
                               venue · karaoke · notifications · deep-link
    panel/                   → Köşkün paneliyle bağlantı: imza, pencere,
                               beyaz liste (karaoke-sync-core) · ortak ping
                               (ping.ts; karaoke-, menu-, orders-ping) · menü
                               (menu-link-core) · bar ekranı (orders-feed-core)
                               · online satış (sales-export-core)
    payment/                 → PaymentProvider arayüzü + Mock/PayNkolay sağlayıcıları ·
                               paynkolay-card (kart doğrulama) · paynkolay-page
                               (ödeme sayfaları + kendi CSP'leri)
    legal/                   → entity.ts (yasal kimlik TEK KAYNAK + {{TOKEN}}) ·
                               content.ts (sözleşme metinleri, ham veri) ·
                               documents.ts (token doldurma + LEGAL_DOCS) ·
                               nav.ts (footer linkleri) · markdown.tsx · store.ts
    db/                      → index.ts (pg havuzu + getDb + TABLES) ·
                               client.ts (sorgu kurucu) · sql.ts (SQL derleyici) ·
                               health.ts (bozulma sınıflandırması) · counters.ts
    seo/                     → site.ts (NAP + sabitler) · structured-data ·
                               section-page · pages.ts (route SEO) · faq.ts ·
                               guides.ts + guide-content.ts (rehber içeriği) ·
                               guide-structured-data.ts · guide-nav.ts ·
                               og-card · og-pages · og-drawings · og-product
                               (paylaşım kartları, docs/SEO.md §2)
    consent/                 → cookie.ts (rıza durumu) · script.ts (Consent Mode v2)
    newsletter/              → store.ts (6563 onay kaydı + tek tıkla çıkış)
    utils/                   → commerce.ts (kargo) · kdv.ts (ürüne göre KDV
                               oranı ve oran oran döküm) · format.ts (priceLabel,
                               parseMoneyInput — admin tutar girişi)
    http/                    → etag.ts · same-site-path.ts (yönlendirme hedefi)
db/
  migrations/                → SQL migration'lar (`npm run db:migrate`)
  schema.sql                 → Üretilen tek dosyalık şema (`npm run db:bundle`)
scripts/                     → db-migrate.mjs · db-bundle.mjs
tests/                       → Vitest (110+ dosya; form sözleşmesi, kontrast,
                               mobil sözleşme, ödeme, DB derleyicisi …)
docs/                        → BRAND.md (marka kimliği) · DATABASE.md ·
                               SEO.md · PROMPT.md · AUDIT.md ·
                               API-MOBILE.md (mobil sözleşme) · AUTH-BRIDGE.md ·
                               SUPABASE-GECIS.md · PAYNKOLAY.md · GELIVER.md ·
                               EMAIL-RESEND.md · FRONTEND-SINIR.md (ön yüz ↔
                               arka yüz sınırı) · ADMIN-INNEX.md (panelin
                               tasarım tarifi)
```

## Masalar (QR) ve "yeni sipariş" e-postası (15 Eki 2026)

- **Masa = ad + rastgele kod.** `public.cafe_tables`; kod 10 karakter Crockford
  base32 (`cafe-tables-core.ts`, sunucu üretir, sıralı değil), QR içeriği hep
  `https://laffogato.net/masa/<kod>` (apex, sabit - laminasyonlu kart).
  Silinmez, pasifleşir; kart kötüye kullanılırsa "Kodu yenile". Panel
  `/admin/masalar` (`tables` bölümü: sahip + yönetici); SVG indirme route
  handler'ı (`/admin/masalar/[id]/qr`) oturumu ve rolü **kendisi** denetler.
- **Masaya sipariş yalnız uygulamadan** (`fulfillment: "table"` + `tableCode`,
  kafe; adres yok, planlı saat yok, pasif masaya yok) ve **ön ödemeli** (kart
  PayNkolay, cüzdan ya da sıfır tutar) - kasada ödeme yok. Masa kodu ve adı
  siparişe anlık görüntü olarak yazılır (`orders."tableCode"`, `"tableName"`).
  Herkese açık arama (`GET /api/mobile/v1/tables/{code}`, `/masa/[code]`, sipariş
  yolu) yalnız `{code, name}` verir; bulunamayan kod üye + IP (oturum yoksa IP)
  başına sayılır (`table-lookup`). Sözleşme: `docs/API-MOBILE.md` §3 ve §22.
  AASA `/masa/*` **talep etmez** ve `/masa` sayfası "uygulamadan sipariş ver"
  demez: masa ekranı olan lafmobil sürümü yayınlanınca ikisi birlikte açılır.
  Kod yenilenince eski kart hemen masadan kaldırılmalı.
- **Personel e-postası:** `applyPaymentSucceeded` siparişi gerçekten `paid`'e
  taşıdığında `after()` ile, sipariş başına **bir kez** (`order_notice_emails`,
  kind `staff-new`), tek batch isteğinde, 429/5xx'te kısa yeniden denemeyle
  gider (ayrıntı `docs/EMAIL-RESEND.md` "Yeni sipariş bildirimi")
  (`src/lib/email/staff-order-notice{,-core}.ts`, `operasyon-bildirim`
  şablonu). Alıcılar Ayarlar → Bildirimler: roller, ek adresler, operasyon
  adresi. İçerik müşterinin **yalnız adını** taşır; telefon, e-posta, adres,
  soyad ve kurye notu (kapı kodu) yazılmaz. Ödemeyi bekletmez, bozamaz.

## Köşkün paneli: karaoke bağlantısı (21 Eki 2026)

Köşkün iç paneli (ladmin.laffogato.net, `RiosenBeq/lafmaliyet`) bardaki hep
açık ekranda karaoke odasını sayar ve yeni rezervasyonda çalar. `live:karaoke`
etiketini düşüren her yazım, yazım kancasından (`src/lib/db/index.ts`
`onWrite`) yanıttan sonra panele içeriksiz, imzalı bir ping atar
(`src/lib/panel/karaoke-ping.ts`); panel pencerenin rezervasyonlarını imzalı
`GET /api/panel/karaoke`'tan çeker. Paylaşılan anahtar `KARAOKE_SYNC_SECRET`
(iki projede aynı); yoksa ping gitmez ve çekme ucu panele kapalıdır; LafPOS'un
anahtarı (`LAFPOS_SYNC_SECRET`) tanımlıysa uç yalnız LafPOS'a, dünden yarına
açıktır (`docs/LAFPOS.md`). Panele yalnız ad, saat, kişi
sayısı, durumlar ve not gider; e-posta, telefon, soyad, ödeme referansı asla
(`toPanelReservation` beyaz listesi). İmza kuralları
`src/lib/panel/karaoke-sync-core.ts`'te ve panelde bayt bayt aynı; iki tarafın
testleri aynı vektörleri sabitler. Ping yazımı asla bozmaz. Ayrıntı:
`docs/PANEL-KARAOKE.md`.

## Köşkün paneli: menü bağlantısı (22 Eki 2026)

Operatör: _"bir yerden pasif yapınca veya fiyat değişince diğer yerlerden de
değişsin"_. Kalemin **satış fiyatı** ve **menüde olup olmadığı**nın tek
kaynağı sitedir (`menu_items`). Panel, ürün satırını sitedeki kaleme
bağlar (`products.siteMenuId` + `siteMenuSlot` M/L, panelde) ve:

- **okur:** imzalı `GET /api/panel/menu`;
- **değiştirir:** imzalı `POST /api/panel/menu`, menü formunun kurallarıyla.
  Site yalnız o sütunları yazar (`setMenuItemSaleFields`), olay kaydına
  "Yönetim paneli · <ad>" düşer, panel ancak 2xx'ten sonra kendi kopyasını
  yazar;
- **haber alır:** `pub:menu`'yu düşüren her yazım panele `menu.changed`
  pingi atar (`menu-ping.ts`).

Anahtar karaoke'ninki (`KARAOKE_SYNC_SECRET`). Ad, açıklama, kategori, görsel
ve alerjen eşitlenmez. Kafenin kasası LafPOS menüyü ve fiyatı buradan çeker
(aşağıda); geçiş bitene dek ModPOS'un fiyatı elle değişir.

Fiyat listesi tarihini bağlantı değiştirmez (OP-PRICE-LISTS). Her fiyat
değişikliği `settings."menuPricesChangedAt"`'i yazar; Kafe menüsü, girilen
gün daha eskiyse uyarır. Ayrıntı: `docs/PANEL-MENU.md`.

## Kafenin kasası: LafPOS (26 Eki 2026)

Kafede ModPOS'un yerine geçen kasa `RiosenBeq/lafpos`: kafedeki bilgisayarda yerel
sunucu, kasa ekranı Chrome'da açık. **Tek sistem, iki yüz:** ürün yalnız bu panelde
eklenir ve değişir (ad, fiyat, boy, KDV, görsel); LafPOS menüyü herkese açık menü
ucundan (ETag) çeker, kasaya özgü alanları (istasyon, kısa ad, porsiyon) ve yalnız
kafede satılan hizmetleri (karaoke odası saatlik ücreti) kendisi tutar. Panelin imzalı
uçlarını (`/api/panel/menu`, `/api/panel/orders`, `/api/panel/karaoke`,
`/api/pos/orders/version`) **kendi anahtarıyla** çağırır: `LAFPOS_SYNC_SECRET`
(`src/lib/panel/signed-callers.ts`; `KARAOKE_SYNC_SECRET`'e eşitse kapalı sayılır;
lafmaliyet'teki aynı adlı anahtardan ayrı değer). Anahtar yokken LafPOS'un imzalı her
isteği reddedilir (sahip, 26 Eki 2026: varsayılan kapalı); açılışta sitenin adımı
`docs/LAFPOS.md` "Varsayılan kapalı". LafPOS fiyat yazamaz (403), yalnız
Tükendi / Satışta; karaokeyi yalnız dünden yarına okur (daha genişi 403); olay kaydında
`lafpos:<ad>`. Maliyet ve muhasebe lafmaliyet'te
kalır, LafPOS gün sonunu oraya iter. Ayrıntı: `docs/LAFPOS.md`.

## Köşkün paneli: bar ekranı ve online satış (22 Eki 2026)

Operatör: _"laffogato admin ile lafmaliyette paralel çalışabilecek neler
varsa ... beraber çalışsın"_. Aynı imza, aynı anahtar, aynı ping
(`src/lib/panel/ping.ts`; `live:orders`'ı düşüren her yazım panele
`orders.changed` atar):

- **Bar ekranı:** imzalı `GET /api/panel/orders` ödenmiş,
  hazırlanan ve gel-al'da teslim bekleyen **kafe** siparişlerini verir
  (`toPanelOrder` beyaz listesi: satırlar, seçenekleri ve satır notu, "Masa
  4" / "Gel-al" / "Kurye", planlı saat, **yalnız ad**, masa ve gel-al
  siparişinde üyenin notu (kuryede hiç: kapı kodu), sitedeki sayfasının
  yolu). Panelden
  elle girilen sipariş, mağaza kolisi, masaya / kuryeye gitmiş sipariş ve
  24 saattir ilerlemeyen gelmez. Barista siparişi bar ekranından tek
  dokunuşla ilerletir (22 Eki 2026): imzalı `POST /api/panel/orders/stage`
  `{id, action, from, actor}`, yalnız üç ileri adım (Hazırlanıyor, Hazır /
  Masaya götürüldü / Kuryeye verildi, Teslim edildi); hareketi site kendi
  `transitionOrder`'ıyla, kartın aşamasına koşullu yapar (stok, sadakat,
  e-posta, telefon bildirimi aynen; eski dokunuş 409). İptal ve iade yalnız
  bu panelde. Ayrıntı: `docs/PANEL-ORDERS.md`.
- **Telefon bildirimi (22 Eki 2026):** uygulama izin verilince Expo push
  jetonunu `POST /api/mobile/v1/devices`'a bildirir (`customer_devices`);
  kafe siparişi hazırlanınca, gel-al hazır olunca, kurye çıkınca, koli
  kargoya verilince ve ödenmiş sipariş iptal edilince `transitionOrder`
  `after()` ile bir kez (`order_push_notices`) gönderir
  (`src/lib/push/*`, `docs/API-MOBILE.md` §23). Yalnız işlemsel; üyenin
  "Sipariş durumu" anahtarı (`orderUpdates`) kapatır. Gel-al hazır olup
  hiçbir telefona ulaşmadıysa "Siparişin hazır" e-postası gider.
- **Online satış:** imzalı `GET /api/panel/sales?month=YYYY-MM` (ya da
  `from`/`to`, en çok 31 gün) kafe, mağaza ve karaoke parasını, faturanın
  KDV'sini (ödül kuponu tam fiyatla) ve kafe satırlarını menü kalemi × boy
  olarak verir. Rakamlar Raporlar'ın ve Gün sonu'nunkiyle aynı kuralla
  sayılır (sipariş `createdAt` gününe, karaoke ödeme gününe;
  `karaokeMoneyOf` üçünün ortak fonksiyonu); elle girilen sipariş kasada
  çalındığı için yalnız `manual`, kasada nakit ya da kasa kartıyla
  "Ödendi" işaretlenen uygulama / web siparişi yalnız `counter` altında
  (havale ve "Diğer" online kalır). Müşteri ve sipariş numarası gitmez.
  Panel bunu kâr-zararda üç satır (kafe online, mağaza, karaoke; KDV hariç)
  ve "TOPLAM CİRO" olarak, tutarlılıkta ayrı tüketim kaynağı olarak ve kasa
  raporunda bilgi satırı olarak gösterir. Ayrıntı: `docs/PANEL-SALES.md`.

## e-Arşiv fatura, Paraşüt üzerinden (22 Eki 2026)

- Site keser (`src/lib/invoice/`, runbook `docs/EARSIV.md`); **varsayılan
  kapalı**: `EARSIV_MODE` off | draft | live; `EARSIV_START_AT` (gün,
  İstanbul saatiyle başı; üretimde `15.10.2026`, PayNkolay'ın canlı günü)
  yoksa hiçbir şey yapılmaz, öncesinde ödenen sipariş elle kesilmiştir.
  **draft = her fatura operatörün onayıyla** (22 Eki 2026): site Paraşüt'te
  taslak hazırlar, kart taslağı satır satır gösterir, "Faturayı
  kesinleştir" o taslağı resmileştirip PDF'i yollar (`runInvoiceRow`,
  `claimRow`); onay yalnız görülen taslağa, eski tarihli ya da Paraşüt'te
  tutarı değişmiş taslak kesinleşmez ve silinmez ("Taslağı yenile"). live =
  kendiliğinden. Koli "Kargoya ver"de
  (çıktısı pakete, sipariş sayfasında "Faturayı yazdır / indir"), kafe
  siparişi teslimde (yoksa ödemeden 3 saat sonra), karaoke saat bitince;
  son gün teslim + 7 gün (VUK 231/5), Faturalar ve Genel bakış uyarır.
- Kancalar (`scheduleInvoiceWork`, `after()`; ödeme, geçiş, iade), günlük
  cron'un kendi `step`'i ve "Şimdi çalıştır". Her Paraşüt kimliği alındığı
  anda yazılır, satır `invoice_claim` (FOR UPDATE SKIP LOCKED, 15 dk) ile
  tek çalıştırmaya verilir; yanıtı kaybolan istekten sonra önce aranır.
  Paraşüt toplamı 0,01 TL'den fazla tutmazsa taslak silinir, kayıt elle.
- **Siparişten fatura sihirbazı** (22 Eki 2026, `docs/EARSIV.md` §8):
  sipariş kartındaki "Fatura oluştur" → `/admin/siparisler/[id]/fatura`
  (Alıcı → Adres → Satırlar → Özet → Paraşüt taslağı). Kurumsal alıcı:
  unvan, 10 haneli VKN (kontrol hanesi), vergi dairesi; TCKN alınmaz.
  `EARSIV_START_AT`'ten önce ödenen sipariş de kesilir (`requestedBy`).
  Kesinleştirirken VKN Paraşüt'e sorulur (`e_invoice_inboxes`): GİB'de
  kayıtlıysa **e-Fatura** (TEMELFATURA, bizim e-postamız gitmez), değilse
  e-Arşiv. Bireysele hep e-Arşiv.
- Elle kalır: panel siparişi (ÖKC), şahıs şirketi (TCKN'li fatura; yönetici
  "elle kesilecek" işaretler), cüzdan / ödemesiz / ödül kuponu, kesimden
  önce iade, listede VKN'si olmayan kargo firması. Kesilmiş faturaya
  dokunulmaz: sonraki iade `invoice_refund` dikkat işareti. Telefon ve TCKN
  Paraşüt'e gitmez; PDF saklanmaz, üye sipariş sayfasından indirir.

## KDV (17 Eki 2026; oranlar ve kargo 18 Eki 2026)

- **Fiyatlar KDV dahil; oran tutarı değiştirmez.** Oran yalnız fiyatın ne
  kadarının KDV olduğunu söyler (fiş, panel, CSV, uygulama). Hiçbir toplam
  orandan hesaplanmaz (`computeOrderTotals`'ta KDV yok).
- **Oran ürüne göre** (`src/lib/utils/kdv.ts`): ürünün / menü kaleminin kendi
  `"taxRatePct"`'i, yoksa Ayarlar → Vergi varsayılanı (`settings."taxRates"`:
  menü %10, karaoke %20, `beans`/`pantry` %10, `gift`/`gear`/`merch` %20,
  `shipping` %20). Köşk kafeterya işletmesi: sattığı bütün gıda %10, kargoyla
  gönderilen paket kahve dahil (KDV GUT III/B-2.4.1); %1 hiçbir üründe
  kullanılmaz. Oran malın cinsine bağlıdır, rafına değil: yenilebilir kup
  kutusu (`prd-0003`, `gift`) ve pamuk önlük (`prd-0009`, `merch`) kendi
  oranıyla %10; gıda ile gıda dışını tek fiyatla birleştiren set %20. Tam
  sayı 0-100; kesir reddedilir. Ürün ürün karar ve dayanak:
  `docs/LEGAL-REDLINES-2026-09.md` §16.3-§16.4.
- **Satış anındaki oran saklanır.** Sipariş satırı `items[].taxRatePct`,
  siparişin kargo / kurye oranı `"shippingTaxRatePct"` (yoksa %20), karaoke
  rezervasyonu `"taxRatePct"`; panelde sonradan değişen oran eski fişi
  değiştirmez. Oranı olmayan eski sipariş döküm göstermez (tahmin yok).
- **Kargo / kurye ücreti faturada ayrı kalem, kendi oranıyla** (taşıma
  hizmeti, %20; KDV K. m.24/a, GİB özelge 32391, 28945): `kdvBreakdown`
  ücreti satırlara paylaştırmaz. İndirim satırlara orantılı dağıtılır.
- **Ödül kuponu iskonto değildir** (damga, kilometre taşı, davet; ya da
  ürünlerin tamamını karşılayan kupon): panel sipariş sayfası ve CSV fatura
  dökümünü (`invoiceKdvBreakdown`, ürünler tam fiyatla) gösterir; fiş ve
  uygulamanın `taxBreakdown`'ı ödenen tutarın içindeki KDV'dir.
- Hukuk metinleri oran saymaz, kuralı yazar (`src/lib/legal/content.ts`);
  ödeme belgelerinde değişiklik `LEGAL_UPDATED`'ı taşır.

## Meta Pixel (25 Ekim 2026)

Operatör: karaoke rezervasyonlarını ölçmek ve Meta reklamlarını gerçek
rezervasyona göre optimize etmek. Tam anlatım: `docs/META-PIXEL.md`.

- **Yalnız pazarlama rızasıyla.** Piksel ("LAF Pixel", `NEXT_PUBLIC_META_PIXEL_ID`,
  yoksa koddaki kimlik; **boş değer kapatır**) yalnız `marketing === true` olan
  ziyaretçide, yalnız `laffogato.net` / `www.laffogato.net`'te yüklenir; `/admin`
  ve `/odeme` (tam yol) belgelerinde hiç. Onay yokken Meta'ya istek gitmez, betik
  bile inmez. Tek kapı `trackPixel` (`src/lib/consent/meta-pixel.ts`); olaylar
  oradan geçmeden `fbq` çağrılmaz, parametrelerde kişisel veri olmaz.
- **Rıza sürümü etiketin şekline bağlı** (`consentVersionFor(google, meta)`:
  1 yok, 2 Meta, 3 Google, 4 ikisi). Yeni bir etiket eklenirse yeni numara;
  bir numara hiçbir zaman başka şekil için yeniden kullanılmaz.
- **Hukuki metinler TASLAK** (avukat okuması bekliyor, LEGAL-REDLINES §35).
  `META_PIXEL_IN_LEGAL_TEXTS` (`src/lib/legal/meta.ts`) bayrağı metinler
  pikseli anlatmadıkça pikseli kapalı tutar. Dört belge kendi gününü
  (`META_PIXEL_LEGAL_UPDATED`) taşır, `LEGAL_UPDATED` taşınmadı.
- **Karaoke `InitiateCheckout`** için `bookKaraokeAction` izinli ziyaretçiye
  yönlendirme yerine `checkout` durumu döner (`BookKaraokeState.checkout`);
  izinsiz ziyaretçi eskisi gibi `redirect` edilir.

## Geliştirme Komutları

```bash
npm run dev          # Geliştirme sunucusu
npm run build        # Production build
npm run typecheck    # tsc --noEmit
npm test             # vitest
npm run lint         # eslint
npm run format       # prettier yaz
npm run db:migrate   # Migration'ları uygula (DATABASE_URL gerekir)
npm run db:bundle    # db/schema.sql'i yeniden üret
```

CI her PR'da ve `main`'e doğrudan yapılan her push'ta `npm run typecheck` +
`npm test` + `npm run build` koşar; başlığında "(#N)" olan squash merge
push'unda koşmaz (o ağaç PR'da `main` güncelken zaten test edildi; Actions
ücretsiz kotası 19 Eki 2026'da bu yüzden doldu). GitHub Actions çalışmıyorsa
(kota, ödeme) aynı adımlar yerelde koşturulur: typecheck, lint
`--max-warnings=0`, `TEST_DATABASE_URL` ile gerçek Postgres 16'ya karşı tam
`vitest run`, `npm run build` (Turbopack symlink'li `node_modules`'ta
çöker: APFS kopyası `cp -cR` kullan). Bu ortamda `NODE_ENV=development` tanımlıysa build
`/_global-error` prerender'ında düşer; yerelde
`NODE_ENV=production npm run build` kullan (CI değişkeni hiç set etmez).

Veritabanına dokunan testler (`tests/db-integration.test.ts`) yalnızca
`TEST_DATABASE_URL` verilince çalışır, aksi hâlde atlanır:

```bash
TEST_DATABASE_URL=postgres://user@host:5432/db npm test
```

## Env Variables

`.env.example` referans. Local için `.env.local` doldur:

| Değişken                         | Amaç                                                      |
| -------------------------------- | --------------------------------------------------------- |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin giriş kimliği                                       |
| `ADMIN_SESSION_SECRET`           | Cookie HMAC anahtarı (≥32 karakter)                       |
| `PAYMENT_PROVIDER`               | `mock` (varsayılan)                                       |
| `PAYMENT_WEBHOOK_SECRET`         | Webhook HMAC anahtarı                                     |
| `DATABASE_URL`                   | Postgres bağlantı dizesi (sağlayıcının pooled endpoint'i) |
| `NEXT_PUBLIC_SITE_URL`           | metadataBase                                              |

**NODE_ENV asla manuel set edilmez.** Next.js kendi yönetir.

## Data Mimarisi

Tüm veri erişimi `src/lib/db` üzerinden, tamamen server-side. `index.ts` bir `pg`
havuzu kurar (lazy — `next build` veritabanına bağlanmaz), `client.ts` zincirlenen
sorgu arayüzünü (`.from().select().eq()`) sunar, `sql.ts` bunu parametreli SQL'e
derler. Tanımlayıcılar `sql.ts`'te doğrulanır, değerler orada parametrelenir.

Şema eski doküman modelini korur: **camelCase quoted kolonlar**, iç içe alanlar
(`variants`, `items`, `refunds`, `addresses`, `weeklyHours`) **JSONB**, tarihler
**ISO-8601 metin** (string sıralaması = kronolojik). Sıralı ID'ler (`prd-0001`,
`orderNo` 10001+) `next_seq()` ile **atomik**. Tablo boşsa ilk istekte
**idempotent seed**.

Tablolar ve SQL fonksiyonları `db/schema.sql`'de (tek kaynak; sayıyı buraya
yazma, eskiyor). Sayaç fonksiyonları: `next_seq` / `claim_order_stock` /
`release_order_stock` / `redeem_promo` / `release_promo_usage` /
`increment_promo_usage` / `adjust_product_stock` / `record_auth_failure` /
`reserve_auth_attempt` / `reserve_order_refund` / `drop_order_refund` /
`toggle_wishlist` / `campaign_email_claim` / `reserve_fal_reading`, ve üye başına tavanları tutan
tetikleyiciler (`app_pending_order_cap`, `karaoke_open_cap`,
`counter_token_issue_cap`). Her biri, JavaScript'te yapılan bir
oku-değiştir-yaz'ın eşzamanlılık altında kaybettiği yazımlar yüzünden var. Şema yoksa uygulama onu ilk sorguda kendisi kurar
(`src/lib/db/bootstrap.ts` → `src/lib/db/schema-sql.ts`, `npm run db:bundle`
ile üretilir), böylece `DATABASE_URL`'i migration'lardan önce tanımlamak siteyi
düşürmez. Erişim tek bir owner bağlantısı üzerinden olduğu için RLS
satırları işlevsizdir (owner rolü RLS'i baypas eder) — savunma katmanı olarak
bırakıldı.

## Veritabanı Kesintisinde Davranış

Genel sayfalar DB'ye ulaşılamazsa pakette gelen içerikle ayakta kalır; ticari
yollar sesli başarısız olur. Ayrım `src/lib/db/health.ts`'te: SQLSTATE taşıyan
her hata gerçek hatadır ve maskelenmez, yalnız bağlantının hiç kurulamadığı
durum bozulmaya uygundur.

- `publicRead()` **yalnızca** salt-okunur sunum verisi içindir.
- Fiyat, stok, yetki ya da siparişin verilebilirliği **asla** yedek veriden
  karar bağlanmaz — `getSettings()` (throw eden) ticari yollarda kalır,
  `getPublicSettings()` yalnız sunum içindir. Genel sayfaların sunumu
  önbellekten gelir (`getSiteSettings` ve `site-data.ts`'in diğer
  okuyucuları, `docs/DATABASE.md` "Uyanmalar ve önbellek"); ticari yollar
  önbellekten hiçbir şey okumaz (`tests/site-data-cache.test.ts`).
- Mağaza bozulmada **boş** kalır, paketteki kurgusal ürünlere düşmez.

## Tasarım Sistemi

> Tam marka kılavuzu: **`docs/BRAND.md`** — her token, ölçülmüş kontrast
> oranları, tipografi ölçeği, bileşen dili ve değiştirme kuralları.

- **Renk:** `globals.css :root` tek kaynak, değerleri uygulamanın
  (`lafmobil/src/theme/tokens.ts`). Porselen zeminler (`--bg`, `--bg-warm`,
  `--bg-stone`, `--bg-cream`), beyaz yüzey (`--surface`), cam jetonları
  (`--glass*`, `--rim`), mürekkep ailesi, yeşil (`--green` = karar/birincil
  eylem), **bordo** `--accent` (ekran başına bir imza yüzeyi), pirinç
  `--gold-soft` (dolgu) ve `--gold` (metin), durum renkleri `--matcha`
  (olumlu), `--rose` (uyarı — marka değil) ve `--info` (kobalt).
- **Yazı:** iki ses. Başlık ve gösterim rakamı Gabarito (`--headline`: 600
  kart başlığı, 700 başlık, 800 gösterim - hero, `.h-display`, büyük
  rakamlar); gerisi Poppins (`--display`; `--sans` ve tarihsel token'lar ona
  çözülür; 400 gövde, 600 etiket/düğme). Biennale lisanslanırsa yalnız
  `layout.tsx`'teki yükleyici ve `--headline` yığını değişir. Poppins'te ok
  glifi yok: etiketin ardındaki ok `.arrow` ile çizilir. Etiketler cümle
  düzeninde; büyük harfli geniş aralık yalnız kart baskısında (`.eyebrow.caps`).
- **Malzeme:** kapsül düğme (`--r-btn: 999px`, basınca 0.97), cam kart,
  gerçek bulanıklık yalnız yüzen kromda (başlık, sekme çubuğu, sepet, arama).
- **Sahneler** (`scenes.ts`): ürünün arkasındaki ışık uygulamanın 14 sahne
  pigmentinden gelir; eski 12 **HUES** adı (`visuals.tsx`) birer sahneye
  çözülür. Her birinin `ink`'i kendi zeminine karşı AA'yı geçer.
- **Kontrast teste bağlı** (`tests/contrast.test.ts`): token'ları
  değiştirdiğinde bu test da geçmelidir. Peş peşe üç "sadeleştirme" geçişi bu
  değerleri sessizce AA altına düşürdüğü için eklendi.
- **Hareket:** `reveal-motion.tsx` yalnızca client'ta çalışır,
  `prefers-reduced-motion` altında hiç devreye girmez ve yalnız ekranın
  altındaki öğeleri gizler — JS yoksa hiçbir şey gizlenmez.
- **Admin paneli görünümü** (22 Eki 2026, operatör: "İnnexe geç"): `/admin`,
  Filllo'nun Innex serisinin tasarım sistemini izler; ölçülmüş tarif
  `docs/ADMIN-INNEX.md`. Gri zemin (`#EDEFF1`) üstünde iki beyaz kart
  (kenar çubuğu 15.5rem ve sayfa; köşe 12 px), 1 px çizgiler, mürekkep
  `#0C0E1B`, etiket grisi `#616367`, birincil mavi `#2F58F7` (Innex'in
  `#325CFF`'i gri zeminde AA'nın altında kaldığı için bir ton koyu), Inter
  yalnız admin layout'ta. Kenar çubuğu sakin: etkin satır gri, grup rengi
  yok; menünün beş grup rengi (`src/components/admin/ui/hues.ts`) yalnız
  Genel bakış ve rapor kartlarının ikon kutularında. Tutar ve kodlar
  `NUMERIC_STYLE` (Inter tablo rakamı), karakter karakter okunan kimlik ve
  Markdown `CODE_STYLE` (sistem eş genişlikli). Düzenler (23 Eki 2026):
  rakamlar KPI şeridinde referansıyla, kayıt sayfaları üç bölge (tutar
  kartı + sekmeler: sipariş, karaoke rezervasyonu, müşteri), liste araç
  çubuğu tek satır, ürün ve menü satırı hızlı bakış çekmecesi (`?gor=`);
  `docs/ADMIN.md` "Innex düzenleri". 21 Eki'deki AkmanOS teması lafmaliyet'te kaldı. Değerler `src/app/admin/layout.tsx` `--admin-*`;
  yukarıdaki site kuralları panele uygulanmaz, panel de siteyi değiştirmez
  (`docs/BRAND.md` "Admin paneli görünümü").
- **Admin arayüz kütüphaneleri:** panel yalnız üç paket kullanabilir, yalnız
  `src/components/admin/**` ve `src/app/admin/**` içinde:
  `lucide-react` (ikonlar), `react-aria-components` ve
  `@internationalized/date` (palet, tarih alanı, combobox gibi yalnız
  etkileşimde yüklenen yaprak bileşenler). Kurulu olanlar: `lucide-react`,
  `react-aria-components`, `@internationalized/date`. Tarih paketi tarih
  alanlarıyla geldi (UI-14): React Aria onu kilit dosyasına zaten dolaylı
  getiriyordu, artık doğrudan bağımlılık. Takvim ve saat pencereleri
  `ui/overlay.ts`'in kapsayıcısına çizilir (açık diyalog ya da panelin portal
  düğümü); `UNSTABLE_portalContainer` ve `UNSAFE_PortalProvider` yalnız orada
  geçer, oradaki anahtar bozulursa yerel tarih kutuları kalır. Her biri
  `package.json`'da tam sürüme sabit (`^` yok), kilit dosyasında tek kopya;
  yükseltme ayrı bir PR'dır ve sürüm en az 14 günlük olur. İkonları yalnız `ui/icons.tsx`
  import eder: her ikon orada bir kez adlandırılır, `AdminIcon` 18 px, 1.75
  çizgi, `aria-hidden` çizer; sayfa onu `@/components/admin/ui/icons`'tan
  alır, kit'in `ui/index.ts`'inden değil (oradan her sayfaya lucide girer).
  React Aria ve tarih paketi yalnız `"use client"` dosyalarda, React Aria alt
  yoldan (`react-aria-components/ListBox`). Sunucuda çizilen kit dosyaları
  (`data-table`, `status-tabs`, `pagination`, `badge`, `detail`, `styles`,
  `forms.tsx`) bunlara uzanmaz; `/admin/kasa`'ya kütüphane kodu girmez, her
  admin rotasına en fazla 8 KB gz eklenir (ölçüm PR gövdesinde). Radix, cmdk
  ve shadcn yok: `components.json` silindi, `shadcn add` `globals.css`'teki
  marka token'larının üstüne yazardı. Bekçiler: ESLint
  `no-restricted-imports` ve `tests/admin-ui-deps.test.ts`.

## Güvenlik Kuralları

1. **Admin cookie:** HMAC SHA256 imzalı, httpOnly, `sameSite=lax`, 7 gün TTL
2. **Kimlik karşılaştırması constant-time** (`crypto.timingSafeEqual`)
3. **Server-side validation Zod ile** — parse edilmeden mutation yok
4. **Tüm mutation'lar server action** (`"use server"`), FormData üzerinden
5. **revalidatePath** her mutation sonrası
6. **Ödeme tutarı asla client'tan gelmez** — backend DB fiyatından doğrular
7. **Webhook'lar** `x-signature` → HMAC SHA256 timing-safe compare
8. **Idempotency:** `payment_transactions.provider_ref` unique constraint
9. **PII:** Logging'de email/telefon maskelenmeli
10. **`DATABASE_URL` SADECE server-side** — asla `NEXT_PUBLIC_*` ile expose edilmez
11. **Veri erişimi yalnız `src/lib/db` üzerinden** — ham SQL'i çağrı noktalarına yayma
12. **Mesafeli satış onayı zorunlu.** Ödeme adımındaki onay kutusu ön işaretli olamaz; `startCheckoutAction` onaysız siparişi reddeder ve onayı (tarih, IP, tarayıcı, belge sürümü) `orders."legalConsent"` JSONB kolonuna yazar — sanal POS / chargeback delili
13. **Yasal kimlik uydurulmaz.** `src/lib/legal/entity.ts` içinde MERSİS / ticaret sicil / KEP / IBAN bilinmiyorsa **boş bırakılır**; boş token içeren tablo satırı render edilmeden düşürülür. Sahte numara yazmak yerine satırı gizle
14. **NACE / faaliyet kodu sitede yayımlanmaz** — yalnızca iç kayıt
15. **SEO içeriği veriye dayanır.** Yeni bir rehber/landing sayfası açmadan önce
    Semrush (TR veritabanı) ile hacim ve zorluk doğrulanır; hedef küme
    `docs/SEO.md` tablosuna işlenir. Hacimsiz sayfa açılmaz
16. **JSON-LD tek yerden basılır** — `<JsonLd>` (`src/lib/seo/json-ld.tsx`).
    `JSON.stringify` `<` karakterini kaçırmaz; veritabanından gelen bir ürün
    adı script etiketini kapatabilir. Ham `dangerouslySetInnerHTML` ile ld+json
    yazma
17. **Ödeme sağlayıcısı fail-closed** — `PAYMENT_PROVIDER` tanımsızsa ya da
    üretimde `mock` ise uygulama başlamayı reddeder. Mock, para almadan
    siparişi `paid` yapar
18. **Rıza olmadan ölçüm yok** — Consent Mode v2 varsayılanları GTM'den önce
    basılır, rızaya bağlı her sinyal `denied` başlar. Yeni bir etiket veya
    piksel eklerken bunu baypas etme
19. **Ticari e-posta için açık rıza** (6563) — onay kutusu ön işaretli olamaz,
    onayın tarihi/IP'si/hangi metne verildiği kaydedilir ve her iletide tek
    tıkla çıkış bulunur. İşlemsel e-posta (sipariş, kargo, parola) bu kapsamda
    **değildir**; onlara "abonelikten çık" koymak yanıltıcı olur
20. **Eşzamanlılık altındaki sayaçlar SQL'de artar** — stok, promosyon kullanımı
    ve giriş denemesi. JS'te oku-değiştir-yaz, tam da yarışın olduğu anda yazım
    kaybeder
21. **Gıda işletmesi sağlık iddiası yapamaz** — "zayıflatır", "önler",
    "tedavi eder", "detoks" gibi ifadeler `tests/guides.test.ts` tarafından
    reddedilir. Ölçülü ifade + tıbbi tavsiye olmadığı notu
22. **Saat ve tarih köşkün saatiyle** (`Europe/Istanbul`, sabit UTC+3).
    Sunucu (Vercel) UTC'dir: `getDay()`, `getMonth()`,
    `toISOString().slice(0, 10)` 00:00–03:00 arası **dünü** verir. Kullan:
    `istanbulDay` / `istanbulClock` (`src/lib/mobile/*`), panelden gelen
    `datetime-local` için `parsePublishInstant` / `normalizePublishInstant`
23. **`RETURNS TABLE` / `SETOF` SQL fonksiyonu → `rpcRows()`.** `rpc()` tek
    hücre okur; tablo döndüren fonksiyonda kayıt *dizesi* gelir ve iş sessizce
    boş çalışır (doğum günü cron'u böyle aylarca kimseyi kutlamadı).
    `tests/db-rpc-table-functions.test.ts` tutar
24. **Admin formundan gelen tutar → `parseMoneyInput()`**
    (`src/lib/utils/format.ts`). `parseFloat(s.replace(",", "."))` yasak:
    `"1.250,00"`'ı 1,25 okur
25. **Para hareketinden önce doğrula.** POS'a iade (`provider.refund`) ancak
    `refundRefusal()` boş dönünce çağrılır; defter reddi paradan sonra gelirse
    ikisi kalıcı olarak ayrışır
26. **İstekten gelen yönlendirme hedefi** (`?next=`, `back` alanı) yalnız
    `sameSitePath()`'ten geçerek izlenir
27. **`"use server"` dosyasındaki her `export` herkese açık bir POST ucudur.**
    Oraya yardımcı fonksiyon koyma (2FA'yı kapatan `freshEnrollment` böyle
    açıktaydı); her action kendi oturum + rol kontrolünü yapar — `proxy.ts`
    yalnız sayfa yönlendirmesidir, yetki kontrolü değil
28. **Kart verisi saklanmaz** (operatör kararı, 23 Eyl ve 15 Eki 2026). Kart
    web'de checkout sayfasının kendisinde (`/odeme`) girilir - operatör, 16
    Eki 2026: _"kart girerken başka sayfaya vs atmasın"_; bu, kartın yalnız
    `/odeme/paynkolay`'da girildiği eski kararın bilinçli tersidir
    (`docs/PAYNKOLAY.md` §15.5). Uygulama aynı `/odeme/paynkolay` sayfasını
    açmaya devam eder. Kart `/odeme`'de yerli bir POST formunda
    (`action="/odeme/paynkolay"`), kontrolsüz alanlarda durur: Server
    Action'a, serileşen React state'ine, depolamaya, loga ve adrese girmez;
    sunucu onu aynı istekte yalnızca PayNkolay'a (`/Vpos/v1/Payment`)
    iletir. Veritabanına, loga, dosyaya yazılmaz; hata yanıtı kart
    numarasını ve CVV'yi geri basmaz (`/odeme`'ye yalnız sabit kodla döner).
    `/odeme` belgesi kendi nonce CSP'siyle, GTM'siz ve üçüncü taraf betiksiz
    sunulur (`src/proxy.ts`, `src/lib/security/checkout-csp.ts`). Kart
    alanları yalnız beş dosyada geçer (`paynkolay-card.ts`, `paynkolay.ts`,
    `paynkolay-page.ts`, `odeme/paynkolay/route.ts`, `odeme/card-payment.tsx`)
    ve bu dosyalar DB/store import etmez. Kayıtlı kart **PayNkolay'da** durur
    (operatör, 15 Eki 2026; `docs/PAYNKOLAY.md` §16): biz yalnız rastgele
    11 karakterlik üye anahtarını (`customers."cardUserKey"`) tutarız, token
    tarayıcıya gitmez, kaydetme kutusu işaretsiz gelir, hesap kapanınca
    kartlar POS'tan silinir. `CardStorageCardRegister` (kart numarasıyla
    ödemesiz saklama) kullanılmaz; ortak ödeme sayfasında `customerKey` boş;
    şemada kart alanı yok; ödeme kaydında kart sahibinin adı tutulmaz. `tests/saved-cards.test.ts` + `tests/paynkolay-card-page.test.ts`
    tutar. Ödeme sayfası sitenin genel CSP'si dışındadır ve kendi, daha dar
    CSP'sini gönderir (üçüncü taraf betik yok, `frame-ancestors 'none'`); kart
    denemesi IP ve sipariş başına sınırlıdır (`card-payment-*`)
29. **Ödenmemiş sipariş POS'a sorulmadan iptal edilmez.** Süpürme ve yeni
    ödemenin eski denemeyi bırakması `cancelUnpaidOrder` → `lookupPayment`
    (`PaymentList`) üzerinden geçer; POS'a ulaşılamaması "ödenmedi" sayılmaz.
    `/odeme/donus`'ta iptal yapılmaz: o POST oturum çerezi taşımaz, herhangi
    bir sipariş kimliği için taklit edilebilir
30. **Giriş denemesi kimlik bilgisi denetlenmeden önce ayrılır**
    (`reserveLoginAttempt` → `reserve_auth_attempt`). "Önce sor, sonra
    doğrula, sonra say" sırası paralel isteklerde tavanı aşar. Admin oturumu
    her istekte hesaptan yeniden okunur (`getAdminSession`); token'daki parmak
    izi parola ya da hesap değişince eski çerezleri geçersiz kılar

## Çalışma Kuralları (Claude için)

- **Dil:** Kullanıcı ile **Türkçe** konuş. Kod ve commit mesajı **İngilizce**.
- **PR akışı:** Her özellik için ayrı PR, draft aç. CI yeşil olmadan merge etme.
- **Admin form akışı:** Yeni ürün → `ProductWizard mode="wizard"`; düzenleme →
  aynı bileşen `mode="tabs"`. Yeni alan eklerken **5 yer** güncellenir:
  `AdminProduct` (store), seed, `ProductInput`, `product-schema.ts`,
  `product-wizard.tsx` (alan `FIELD_STEP`'e de girer, yoksa reddi özet
  adımında açılır; `admin-product-wizard` testi tutar). Alan CSV ile de
  gelecekse `product-import-core.ts` (sütun) ve `product-import.ts` (plan).
  Sihirbaz elle gönderir (`useNoResetSubmit`, `noValidate` + kendi adım
  denetimi); `<form action>`'a geri dönme. Skill: `add-admin-resource`
- **Oluşturma sihirbazları** (22 Eki 2026): yeni kayıt açan uzun formlar
  adım adım (`src/components/admin/ui/wizard.tsx`: `useWizard` +
  `WizardFrame`; `ActionForm` tabanlı formlar için `WizardActionForm`):
  fatura, elle sipariş, promosyon, kampanya e-postası, menü kalemi,
  uygulama gönderisi; düzenleme sayfaları tek sayfa (`mode: "page"`).
  Adımlar aynı formun içindedir (sonrakiler `hidden`), tek gönderim,
  sunucu denetimi değişmez. Yeni bir uzun oluşturma formu da bu kitle
  yazılır; ayrıntı `docs/ADMIN.md` "Oluşturma sihirbazları"
- **Server action pattern:** Zod parse → store call → revalidatePath →
  redirect. Skill: `server-action-pattern`
- **Migration:** `db/migrations/YYYYMMDDHHMMSS_aciklama.sql`, ardından
  **mutlaka** `npm run db:bundle` ve üretilen dosyaları commit'le. Uygulama
  migration'ı kendisi uygular (`ensureSchemaFresh`, her sorgudan önce
  `_migrations`'ı pakete karşı kontrol eder) — ama yalnızca **bundle'daki**
  migration'ları görür. `db:bundle` unutulursa ne uygulama ne CLI onu görür.
  Deploy'da elle `db:migrate` gerekmez. Skill: `new-migration`
- **Para birimleri:** Tüm fiyatlar **minor unit** (kuruş) `priceMinor: number`;
  UI'da `formatTRY()` ile render edilir
- **Görsel değişiklik yaptıysan** sayfaları gerçekten render edip bak; layout
  hataları (çakışma, taşma) gözle yakalanır, testle değil
- **Ön yüz işi** (tasarım, sayfa, bileşen, CSS, form) → skill
  `frontend-redesign` + `docs/FRONTEND-SINIR.md`. Arka yüz dosyasına dokunmak
  gerekiyorsa önce kullanıcıya söyle, ayrı PR aç
- **Skill'ler** `.claude/skills/` altında; liste, kaynak ve lisanslar
  `docs/SKILLS.md`. Dışarıdan alınanlarda (`frontend-design`,
  `frontend-design-principles`, `copywriting`, `cro`, `emails`, `social`,
  `referrals`, `seo-audit`) başlarındaki "Bu projede" bölümü geçerlidir;
  pazarlama bağlamı `.claude/product-marketing.md`. Panelde yeni bir alan:
  `build-admin-panel` (gerçek tarayıcıyla doğrulama dahil)
- **Açık bulgular** `docs/AUDIT.md` §8 "Açık"ta; biri üzerinde çalışırken
  oradan sil ve "Düzeltilenler" tablosuna testiyle birlikte taşı

## Yapılmayacaklar

- **PayNkolay canlıda (15 Eki 2026).** Anahtarlar Vercel production'da,
  kurulum `docs/PAYNKOLAY.md` §13, sitedeki kart formu §15. §12'deki canlı
  ölçüm listesinin çoğu sandbox'ta kapandı (§12.1); açık kalanlar orada.
  İlk gerçek kartlı ödeme operatörün işidir. Ödeme akışına
  dokunurken iki tuzağı unutma: `PAYNKOLAY_SUCCESS_URL` **ve**
  `PAYNKOLAY_FAIL_URL` ikisi de `/odeme/donus` olmalıdır (PayNkolay sonucu
  form-POST eder), ve `PAYMENT_PROVIDER` her ortamda tanımlı olmalıdır
- **Kartı bizde saklama.** Operatör kararı: kart bilgisi bizde saklanmaz
  (kural 28); kayıtlı kart yalnız PayNkolay'da. Kart numarasını yazan,
  loglayan bir yol, kart alanlarını dört dosyanın dışına taşımak ya da
  `CardStorageCardRegister` bu kararın değişmesini ister, önce kullanıcıya
  sor
- **Canlı anahtarlarla çekim denemesi yapma** — test hostu
  (`PAYNKOLAY_BASE_URL`) dışında gerçek kartla deneme operatörün işidir
- **PayNkolay webhook'u ARAMA.** Sunucudan sunucuya bildirim yok
  (`docs/PAYNKOLAY.md` §4); ödeme kararı `PaymentList` sorgusundan verilir
- **Mail** Resend üzerinden çıkar (`docs/EMAIL-RESEND.md`); gönderen adresi
  panelden değişir, anahtar hiçbir dosyada durmaz. **SMS** hâlâ MVP dışı
- **Ticari e-postayı İYS kapısının dışından gönderme** (22 Eki 2026):
  kampanya ve doğum günü e-postası yalnız İYS'de ONAY görünen adrese ve son
  İYS ret kontrolü 3 iş gününden yeniyken gider (`src/lib/iys`, aktarım elle:
  `/admin/iys`); ayrıntı ve operatör kılavuzu `docs/IYS.md`
- **Multi-language** MVP dışı (sadece TR)
- Auth sağlayıcısını değiştirme işine kullanıcıdan onay almadan başlama
- **`/api/mobile/v1` uçlarının sözleşmesini kırma** — alan silme/yeniden
  adlandırma, zorunlu yeni alan, kimlik yöntemi değişikliği yok. Sahadaki
  `lafmobil` sürümleri bu uçlara bağlı; ayrıntı yukarıda "Mobil Uygulama"
  başlığında

## Sık Karşılaşılan Hatalar

- **`npm ci` lockfile drift:** Yeni paket ekledikten sonra `npm install`
  çalıştır, `package-lock.json` değişikliğini commit et
- **Hash router'da hydration mismatch:** `LaffogatoApp` mount-öncesi
  `PageHome`'u render eder; hash'i `useEffect`'te okur. Bunu bozma
- **Server action'dan client state'e dönüş yok:** Sepet temizleme
  `/odeme/basarili`'deki `ClearCart` component'iyle yapılır
- **Tam sayfa ekran görüntüsü boş bölümler gösterir:** scroll reveal yalnız
  görünür alana girince çözülür; önce sayfayı gezdir, sonra çek
