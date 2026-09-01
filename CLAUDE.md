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
- **Veri:** **Postgres**, `pg` sürücüsüyle. Barındırma Neon'da ama koda özgü bir
  bağımlılık yok — bağlantı dizesi değişince başka bir Postgres'e taşınır.
  Kurulum: `docs/DATABASE.md`
- **Adres:** Postane Mah. 29 Ekim Cd. No: 28 (Menemenci Cumhur'un yanı),
  34940 Tuzla / İstanbul
- **Auth:** Admin için env-credentialed imzalı cookie (`ADMIN_EMAIL` +
  `ADMIN_PASSWORD` + HMAC SHA256) ve TOTP 2FA. Müşteri için bcrypt hesap
- **Ödeme:** Sağlayıcı bağımsız soyutlama (`src/lib/payment/`). Sanal POS
  **iyzico** (Checkout Form — kart verisi siteye hiç girmez); geliştirmede
  `MockPaymentProvider`
- **Dil:** Arayüz **Türkçe**. Kod, dosya adı, identifier, commit mesajı
  **İngilizce**

## Klasör Yapısı

```
src/
  app/
    page.tsx                 → Müşteri SPA entrysi (hash router: #home, #menu, ...)
    layout.tsx               → next/font ile 2 font (Hanken Grotesk + JetBrains Mono)
    globals.css              → Tüm design tokens + müşteri SPA stilleri
    menu/ magaza/ hikayemiz/ → Müşteri rotaları (SPA içeriğinin SEO'lu karşılıkları)
    ziyaret/ hukuk/
    odeme/                   → Checkout + placeOrderAction + /basarili
    uye/                     → Müşteri hesabı (giriş, kayıt, sipariş geçmişi,
                               adresler, favoriler, promosyonlar, bildirimler)
    admin/                   → Admin panel (proxy korumalı)
      urunler/ kategoriler/  → Shop ürünleri (wizard) + kategoriler
      menu/                  → Kafe menüsü
      siparisler/            → Sipariş listesi + detay + manuel sipariş
      musteriler/            → CRM-lite
      promosyon/ raporlar/   → Promosyon kodları · ciro raporları
      stok-hareketleri/      → Stok audit + manuel düzeltme
      olay-kaydi/            → Mutasyon audit log (owner-only)
      icerik/ hikaye/ basin/ → Site içeriği, hikaye zaman çizelgesi, basın
      magaza-hero/           → Mağaza hero slaytları
    hukuk/ bulten/ ayarlar/→ Hukuki metinler · bülten · ayarlar
      giris/ iki-asama/      → Login + 2FA akışı
      2fa-kurulum/
    rehber/                  → SEO rehber hub'ı + /rehber/[slug] (Article +
                               FAQPage + Recipe yapısal verisi)
    api/webhooks/payment/    → Sunucudan sunucuya ödeme bildirimi (HMAC)
    odeme/donus/             → Sanal POS'un MÜŞTERİYİ POST ettiği dönüş
                               (IYZICO_CALLBACK_URL burayı göstermeli)
    gorsel/                  → Yüklenen görsellerin önbelleklenebilir servisi
    bulten/cikis/            → Tek tıkla bülten aboneliğinden çıkış (6563)
    proxy.ts                 → Cookie-tabanlı admin guard
  components/
    laffogato/               → Müşteri SPA
      app.tsx                → Shell (cart, route, notice, settings)
      chrome.tsx             → Nav + Footer
      pages.tsx              → Sayfa gövdeleri
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
    payment/                 → PaymentProvider arayüzü + Mock/iyzico sağlayıcıları
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
                               guide-structured-data.ts · guide-nav.ts
    consent/                 → cookie.ts (rıza durumu) · script.ts (Consent Mode v2)
    newsletter/              → store.ts (6563 onay kaydı + tek tıkla çıkış)
    utils/                   → commerce.ts (vergi/kargo) · format.ts (priceLabel)
db/
  migrations/                → 18 SQL migration (`npm run db:migrate`)
  schema.sql                 → Üretilen tek dosyalık şema (`npm run db:bundle`)
scripts/                     → db-migrate.mjs · db-bundle.mjs
tests/                       → 30 vitest dosyası
docs/                        → DATABASE.md · SEO.md · PROMPT.md ·
                               AUDIT.md
```

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

CI her PR'da `npm run typecheck` + `npm run build` koşar.

Veritabanına dokunan testler (`tests/db-integration.test.ts`) yalnızca
`TEST_DATABASE_URL` verilince çalışır, aksi hâlde atlanır:

```bash
TEST_DATABASE_URL=postgres://user@host:5432/db npm test
```

## Env Variables

`.env.example` referans. Local için `.env.local` doldur:

| Değişken                         | Amaç                                               |
| -------------------------------- | -------------------------------------------------- |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin giriş kimliği                                |
| `ADMIN_SESSION_SECRET`           | Cookie HMAC anahtarı (≥32 karakter)                |
| `PAYMENT_PROVIDER`               | `mock` (varsayılan)                                |
| `PAYMENT_WEBHOOK_SECRET`         | Webhook HMAC anahtarı                              |
| `DATABASE_URL`                   | Postgres bağlantı dizesi (Neon'da pooled endpoint) |
| `NEXT_PUBLIC_SITE_URL`           | metadataBase                                       |

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

20 tablo + `next_seq` / `claim_order_stock` / `release_order_stock` /
`redeem_promo` / `release_promo_usage` / `adjust_product_stock` /
`record_auth_failure` fonksiyonları. Her biri, JavaScript'te yapılan bir
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
  `getPublicSettings()` yalnız sunum içindir.
- Mağaza bozulmada **boş** kalır, paketteki kurgusal ürünlere düşmez.

## Tasarım Sistemi

- **Renk:** `globals.css :root` tek kaynak. Dört kâğıt tonu (`--bg`,
  `--bg-warm`, `--bg-stone`, `--bg-cream`), espresso mürekkep ailesi, terracotta
  `--accent`, altın `--gold`, durum renkleri `--matcha` (olumlu) ve `--rose`
  (uyarı).
- **HUES** (`visuals.tsx`): ürün kartlarının ve illüstrasyonların arkasındaki 12
  yüzey. Her birinin `ink`'i kendi gradient'ine karşı AA'yı geçer.
- **Kontrast teste bağlı** (`tests/contrast.test.ts`): token'ları
  değiştirdiğinde bu test da geçmelidir. Peş peşe üç "sadeleştirme" geçişi bu
  değerleri sessizce AA altına düşürdüğü için eklendi.
- **Hareket:** `reveal-motion.tsx` yalnızca client'ta çalışır,
  `prefers-reduced-motion` altında hiç devreye girmez ve yalnız ekranın
  altındaki öğeleri gizler — JS yoksa hiçbir şey gizlenmez.

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
12. **Mesafeli satış onayı zorunlu.** Ödeme adımındaki onay kutusu ön işaretli olamaz; `placeOrderAction` onaysız siparişi reddeder ve onayı (tarih, IP, tarayıcı, belge sürümü) `orders."legalConsent"` JSONB kolonuna yazar — sanal POS / chargeback delili
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

## Çalışma Kuralları (Claude için)

- **Dil:** Kullanıcı ile **Türkçe** konuş. Kod ve commit mesajı **İngilizce**.
- **PR akışı:** Her özellik için ayrı PR, draft aç. CI yeşil olmadan merge etme.
- **Admin form akışı:** Yeni ürün → `ProductWizard mode="wizard"`; düzenleme →
  aynı bileşen `mode="tabs"`. Yeni alan eklerken **5 yer** güncellenir:
  `AdminProduct` (store), seed, `ProductInput`, `product-schema.ts`,
  `product-wizard.tsx`. Skill: `add-admin-resource`
- **Server action pattern:** Zod parse → store call → revalidatePath →
  redirect. Skill: `server-action-pattern`
- **Migration:** `db/migrations/YYYYMMDDHHMMSS_aciklama.sql`, ardından
  `npm run db:bundle`. Skill: `new-migration`
- **Para birimleri:** Tüm fiyatlar **minor unit** (kuruş) `priceMinor: number`;
  UI'da `formatTRY()` ile render edilir
- **Görsel değişiklik yaptıysan** sayfaları gerçekten render edip bak; layout
  hataları (çakışma, taşma) gözle yakalanır, testle değil

## Yapılmayacaklar

- **iyzico canlıya alınmadı, sonraya bırakıldı.** Kod hazır; sandbox testi ve
  canlı anahtarlar bekliyor. Açılış kontrol listesi `docs/AUDIT.md` §5'te.
  Ödeme akışında değişiklik yaparken oradaki iki tuzağı unutma:
  `IYZICO_CALLBACK_URL` tarayıcı dönüşüdür (webhook değil), ve
  `PAYMENT_PROVIDER` her ortamda tanımlı olmalıdır
- **iyzico canlı anahtarlarıyla test etme** — sandbox (`IYZICO_BASE_URL`) dışında
  gerçek çekim denemesi yapma
- **Mail/SMS bildirimleri** MVP dışı (sonra Resend/Twilio)
- **Multi-language** MVP dışı (sadece TR)
- Auth sağlayıcısını değiştirme işine kullanıcıdan onay almadan başlama

## Sık Karşılaşılan Hatalar

- **`npm ci` lockfile drift:** Yeni paket ekledikten sonra `npm install`
  çalıştır, `package-lock.json` değişikliğini commit et
- **Hash router'da hydration mismatch:** `LaffogatoApp` mount-öncesi
  `PageHome`'u render eder; hash'i `useEffect`'te okur. Bunu bozma
- **Server action'dan client state'e dönüş yok:** Sepet temizleme
  `/odeme/basarili`'deki `ClearCart` component'iyle yapılır
- **Tam sayfa ekran görüntüsü boş bölümler gösterir:** scroll reveal yalnız
  görünür alana girince çözülür; önce sayfayı gezdir, sonra çek
