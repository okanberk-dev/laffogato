@AGENTS.md

# Laffogato — Kafe + E-ticaret Platformu

Bu dosya, Claude Code'un bu projede tutarlı çalışması için gerekli bağlamı içerir. Next.js'in bu sürümüne özgü kurallar için `AGENTS.md`'yi de oku.

## Proje Özeti

**Laffogato** (marka adı: **L'Affogato**) İstanbul Tuzla'da açılan kafenin kurumsal web sitesi + online mağazasıdır. Müşteri menüye bakar, ürün satın alır, ödeme yapar; admin paneli üzerinden ürün/menü/sipariş yönetimi tek yerden yapılır.

- **Stack:** Next.js 16 (App Router + Turbopack) · React 19 · Tailwind v4 · TypeScript · Zod
- **Deploy hedefi:** Vercel (Edge proxy + Node runtime API'ler)
- **Veri:** **Neon (serverless Postgres)** — `src/lib/admin/store.ts` + `src/lib/customer/store.ts` + `src/lib/admin/audit.ts`, `src/lib/db/index.ts`'deki lazy bağlantı üzerinden çalışır. Tablo boşsa ilk istekte idempotent otomatik seed. Kurulum: `docs/DATABASE.md`
- **Auth:** Admin için **env-credentialed signed cookie** (`ADMIN_EMAIL` + `ADMIN_PASSWORD` + HMAC SHA256). Müşteri auth henüz yok
- **Ödeme:** Sağlayıcı bağımsız soyutlama (`src/lib/payment/`). Şu an `MockPaymentProvider`; sanal POS sağlayıcısı henüz seçilmedi
- **Dil:** Arayüz **Türkçe**. Kod, dosya adı, identifier, commit mesajı **İngilizce**

## Mevcut Durum (PR'lar)

| PR | Konu |
|----|------|
| #1 | Premium kafe sitesi (design handoff 1:1) |
| #2 | ReelScene fix — design 1:1 hizalama |
| #3 | Admin panel (auth + CRUD, in-memory store) |
| #4 | Shop ↔ admin store wiring |
| #5 | Checkout → real order creation |
| #6 | Cart persistence + settings → footer |
| #7 | Stock decrement + out-of-stock toast |
| #8 | Cafe menu admin (5 kategori × ≈6 kalem) |
| #9 | Commerce-grade product editor (wizard, variants, SEO, Zod) |
| #10 | GitHub Actions CI (typecheck + build) |
| #12 | Wizard adım 4'te drag-and-drop görsel yükleme + client-side resize |
| #13 | Üç listede toplu işlemler (checkbox + sticky bar) |
| #14 | Sipariş detay sayfası v2 (state machine, per-item, not, iade, fiş) |
| #15 | Stok hareketleri kaydı + manuel düzeltme |
| #16 | Ayarlar v2 — 6 sekme (Genel / Saatler / Vergi / Kargo / SEO / Bildirim) |
| #17 | Misafir checkout'ta ad/e-posta/telefon/adres toplama + müşteri özetleri |
| #18 | Müşteri listesi + e-posta-bazlı sipariş geçmişi |
| #19 | Promosyon kodu sistemi (uçtan uca) |
| #20 | Analytics raporları — ciro grafiği + en çok satan 5 |
| #21 | RBAC — owner / manager / staff |
| #22 | Login rate limit (5 fail / 5 dk → 1 dk lockout) |
| #23 | TOTP 2FA (otplib + QR enrollment) |
| #24 | Audit log — append-only olay kaydı |

## Klasör Yapısı

```
src/
  app/
    page.tsx                 → Müşteri SPA entrysi (hash router: #home, #menu, ...)
    layout.tsx               → next/font ile 6 Google Font
    globals.css              → Tüm design tokens (styles.css + components.css birleşik)
    admin/                   → Admin panel route'ları (proxy korumalı)
      page.tsx               → Dashboard
      giris/                 → Login (env-credentialed)
      urunler/               → Shop ürünleri: liste + wizard (yeni) + tabs (düzenle)
      menu/                  → Kafe menüsü: 5 kategori × kalem CRUD
      kategoriler/           → Shop kategorileri CRUD
      siparisler/            → Sipariş listesi + durum güncelleme
      ayarlar/               → Kafe ayarları (6 sekme: Genel / Saatler / Vergi / Kargo / SEO / Bildirim)
      musteriler/            → Müşteri listesi + e-posta detayı (CRM-lite)
      promosyon/             → Promosyon kodları CRUD (cart-uygulanabilir)
      raporlar/              → Ciro grafiği + en çok satan 5 + AOV
      stok-hareketleri/      → Stok audit + manuel düzeltme formu
      olay-kaydi/            → Admin mutasyon audit log (owner-only)
      iki-asama/             → 2FA login akışı (pending cookie + 6 hane)
      2fa-kurulum/           → 2FA enrollment (QR + verify)
      actions.ts             → Genel logout action
      layout.tsx             → Admin chrome (nav + user + logout, RBAC-filtered)
    odeme/
      actions.ts             → placeOrderAction (sepet → sipariş)
      basarili/              → Sipariş başarılı sayfası + cart clear
    api/webhooks/payment/    → Payment provider webhook (HMAC doğrulamalı)
    proxy.ts                 → Cookie-tabanlı admin guard
  components/
    laffogato/               → Müşteri SPA (1:1 design)
      app.tsx                → LaffogatoApp shell (cart, route, notice, settings, menu)
      chrome.tsx             → Nav + Footer (footer settings prop'undan okur)
      pages.tsx              → 7 sayfa (home/menu/shop/story/visit/reels/franchise)
      ui.tsx                 → ProductCard, CartDrawer, ProductModal, CheckoutButton
      visuals.tsx            → Tüm SVG visuals (edible cup, matcha glass, bar render, ...)
      data.ts                → Statik seed (MENU, PRODUCTS, REELS, PRESS, STORY, LOCATION, FRANCHISE)
    admin/                   → Paylaşılan admin form primitives
      forms.tsx              → Field, TextInput, Select, Checkbox, Button, Card, PageHeader, formatTRY, formatDateTime
      product-wizard.tsx     → 5-step wizard / tabs (yeni + düzenle aynı bileşeni kullanır)
      product-form.tsx       → (deprecated, kaldırılabilir — wizard onun yerine geçti)
      category-form.tsx      → Shop kategori formu
      menu-item-form.tsx     → Kafe menü kalemi formu
  lib/
    admin/
      auth.ts                → signInAdmin, signOutAdmin, getAdminSession, signed cookie
      store.ts               → Veri katmanı (products, categories, menu, orders, promos, settings, hero)
      audit.ts               → Append-only audit log (audit_logs tablosu)
      product-schema.ts      → Zod schema for product form (coerce, validate, transform)
    customer/store.ts        → Müşteri hesapları (customers tablosu, bcrypt, adres/wishlist)
    payment/                 → PaymentProvider interface + MockPaymentProvider
    db/                      → index.ts (lazy Neon bağlantısı + getDb + TABLES) · client.ts (PostgREST-uyumlu sorgu kurucu) · sql.ts (saf SQL derleyici) · counters.ts (next_seq)
    utils/cn.ts, format.ts   → Genel yardımcılar
.claude/
  settings.json              → Permissions (Bash + GitHub MCP)
  skills/                    → Proje skill'leri (add-admin-resource, server-action-pattern, ...)
.github/workflows/ci.yml     → Typecheck + build her PR'da
db/
  migrations/                → SQL migration dosyaları (`npm run db:migrate` ile uygulanır)
scripts/db-migrate.mjs       → Migration runner (dosya başına tek transaction, `_migrations` tablosu)
docs/
  DATABASE.md                → Neon kurulumu + veri katmanı mimarisi
  PROMPT.md                  → Ürün spec'i + MVP scope
  NEXT_SESSION.md            → Yeni session'da admin tam kontrol için brief
```

## Geliştirme Komutları

```bash
npm run dev         # Geliştirme sunucusu (http://localhost:3000)
npm run build       # Production build
npm run typecheck   # tsc --noEmit
npm run format      # Prettier yaz
```

CI her PR'da `npm run typecheck` + `npm run build` koşar.

## Env Variables

`.env.example` referans. Local için `.env.local` doldur:

| Değişken | Amaç | Şu an |
|----------|------|-------|
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin giriş kimliği | Zorunlu |
| `ADMIN_SESSION_SECRET` | Cookie HMAC anahtarı (≥32 karakter rastgele) | Zorunlu |
| `PAYMENT_PROVIDER` | `mock` (varsayılan) | Zorunlu |
| `PAYMENT_WEBHOOK_SECRET` | Webhook HMAC anahtarı | Zorunlu |
| `DATABASE_URL` (veya `POSTGRES_URL`) | Neon Postgres bağlantı dizesi (pooled endpoint) | Zorunlu (canlı) |
| `NEXT_PUBLIC_SITE_URL` | metadataBase | Local: `http://localhost:3000` |

**NODE_ENV asla manuel set edilmez.** Next.js kendi yönetir. CI bunu env'de tutmaz.

## Data Mimarisi

### Neon (Postgres) — aktif

`src/lib/admin/store.ts` + `src/lib/customer/store.ts` + `src/lib/admin/audit.ts` + payment webhook — hepsi `src/lib/db/index.ts`'deki **lazy Neon bağlantısını** kullanır ("server-only"). Kod PostgREST sorgu kurucusuna göre yazıldığı için `src/lib/db/client.ts` aynı arayüzü parametreli SQL üzerinde yeniden üretir; `.from().select().eq()` çağrı noktaları değişmedi. Detay: `docs/DATABASE.md`. Eski Mongo doküman modeli **1:1** korundu: **camelCase quoted kolonlar** + iç-içe alanlar (`variants`, `items`, `refunds`, `addresses`, `weeklyHours`, …) **JSONB** + tarihler **ISO-8601 metin** (string sıralaması = kronolojik). Sıralı ID'ler (`prd-0001`, `orderNo` 10001+) `next_seq(counter_key)` fonksiyonuyla **atomik**. Tablo boşsa ilk istekte **idempotent seed** (upsert/ignoreDuplicates → yarış-güvenli). Build DB'ye bağlanmaz (lazy client + tüm veri sayfaları dynamic).

Entity'ler:
- **AdminProduct** (slug, sku, compareAt, cost, images, stock, lowStockThreshold, weight, SEO, variants, ...)
- **AdminProductVariant** (id, name, priceDeltaMinor, stock, sku, isActive)
- **AdminCategory** (5 sabit shop kategorisi: beans/gift/gear/merch/pantry)
- **AdminMenuItem** (5 sabit cafe kategori: affogato/matcha/espresso/cold/gelato)
- **AdminOrder** + **AdminOrderItem** (7 durum: pending_payment → paid → preparing → shipped → completed | cancelled | refunded)
- **AdminSettings** (singleton: name, tagline, phone, email, address, openingHours, isShopOpen)

Public read fonksiyonları:
- `listShopProducts()` — design'ın `Product` şeklinde aktif ürünler, compareAt dahil
- `listMenuForCustomer()` — design'ın MENU şeklinde aktif menü kalemleri, kategori meta'sı SEED_MENU'den

### Şema

`db/migrations/` altında 9 migration (19 tablo + `next_seq` / `claim_order_stock` / `increment_promo_usage` fonksiyonları). `npm run db:migrate` ile sırayla uygulanır; uygulananlar `_migrations` tablosunda tutulur, tekrar çalıştırmak güvenlidir.

Erişim tek bir owner bağlantısı üzerinden ve tamamen server-side olduğu için RLS satırları işlevsizdir (owner rolü RLS'i baypas eder) — savunma katmanı olarak bırakıldı. `anon` / `authenticated` / `service_role` rolleri Neon'da **yoktur**; migration'lara Supabase'e özgü `grant` satırı yazma.

Kalan/ileri adımlar:
- Auth şu an admin env-cookie + müşteri bcrypt; ikisi de çalışıyor

## Veritabanı Kesintisinde Davranış

Genel sayfalar DB'ye ulaşılamazsa pakette gelen içerikle ayakta kalır; ticari
yollar sesli başarısız olur. Ayrım `src/lib/db/health.ts`'te: SQLSTATE taşıyan
her hata gerçek hatadır ve maskelenmez, yalnız `status: 0` + boş `code`
(istek Postgres'e hiç ulaşmadı) bozulmaya uygundur.

- `publicRead()` **yalnızca** salt-okunur sunum verisi içindir.
- Fiyat, stok, yetki ya da siparişin verilebilirliği **asla** yedek veriden
  karar bağlanmaz — `getSettings()` (throw eden) ticari yollarda kalır,
  `getPublicSettings()` yalnız sunum içindir.
- Mağaza bozulmada **boş** kalır, paketteki kurgusal ürünlere düşmez.
- Detay: `docs/DATABASE.md`.

## Güvenlik Kuralları

1. **Admin cookie:** HMAC SHA256 imzalı, httpOnly, `sameSite=lax`, 7 gün TTL. Secret en az 32 karakter
2. **Kimlik karşılaştırması constant-time** (`crypto.timingSafeEqual`). Email lowercase normalize edilir
3. **Server-side validation Zod ile** — admin form input'ları parse edilmeden hiçbir mutation yapılmaz
4. **Tüm mutation'lar server action** (`"use server"` directive). FormData üzerinden gelir, client'tan tip bilgisi gelmez
5. **revalidatePath** her mutation sonrası — `/`, `/admin/*`, ilgili sayfa
6. **Ödeme tutarı asla client'tan gelmez.** Cart server'a fiyatları string olarak gönderir ama backend ürün adı match'iyle DB fiyatından doğrular
7. **Webhook'lar** `x-signature` header → HMAC SHA256 timing-safe compare. Geçersiz → 401
8. **Idempotency:** Ödeme webhook'ları `payment_transactions.provider_ref` unique constraint ile tek seferde
9. **PII:** Logging'de email/telefon maskelenmeli (Sentry/log scrubber ileride)
10. **`DATABASE_URL` SADECE server-side** — asla `NEXT_PUBLIC_*` prefix'iyle expose edilmez
11. **Veri erişimi yalnız `src/lib/db` üzerinden** — ham SQL'i çağrı noktalarına yayma; tanımlayıcılar orada doğrulanıyor, değerler orada parametreleniyor
12. **CI placeholder secrets** asla production'da kullanılmaz — `.env.local` ve Vercel env vars gerçek değerleri tutar

## Çalışma Kuralları (Claude için)

- **Dil:** Kullanıcı ile **Türkçe** konuş. Kod, identifier, dosya adı, commit mesajı **İngilizce**.
- **Branch:** `claude/inspiring-cori-3JcFV`. Her PR sonrası rebase et, force-with-lease push yap.
- **PR akışı:** Her özellik için ayrı PR. Draft aç, kullanıcı merge etsin. Webhook ile CI sonucunu izle, hata varsa düzelt.
- **Design 1:1:** Müşteri SPA'sı (`components/laffogato/*`) design handoff (`/tmp/design/cafe/project/`) ile birebir. Yeni özellik eklerken design'a sadık kal, sapma varsa kullanıcıya sor.
- **Admin form akışı:** Yeni ürün → `ProductWizard mode="wizard"` (5 adım); düzenleme → aynı bileşen `mode="tabs"`. Yeni alan eklerken **5 yer güncellenir:** `AdminProduct` (store), seed, `ProductInput`, `product-schema.ts` (Zod), `product-wizard.tsx` (UI). Skill: `add-admin-resource`
- **Server action pattern:** Zod parse → store call → revalidatePath → redirect. Skill: `server-action-pattern`
- **Migration:** `db/migrations/YYYYMMDDHHMMSS_aciklama.sql` formatında, `npm run db:migrate` ile uygulanır. Skill: `new-migration`
- **Test:** Build temiz olmalı. CI yeşil olmadan merge etme. UI değişikliği yaptıysan dev server'da göz ucuyla kontrol et
- **Para birimleri:** Tüm fiyatlar **minor unit** (kuruş) olarak `priceMinor: number`. UI'da `formatTRY()` ile render edilir
- **shadcn ekleme:** `npx shadcn@latest add <component>` ile (sandbox'ta registry erişimi yoksa skip). Manuel kopyalama yapma

## Yapılmayacaklar

- Henüz **Vercel'e deploy edilmedi** — env vars + URL kararı kullanıcıdan
- Henüz **sanal POS sağlayıcısı seçilmedi** — gerçek API key'leriyle entegrasyon yapma
- **Veritabanı Neon (Postgres)** — admin auth env-cookie, müşteri auth bcrypt; auth sağlayıcısı değiştirme işine kullanıcıdan onay almadan başlama
- **Mail/SMS bildirimleri** MVP dışı (sonra Resend/Twilio)
- **Coupon/indirim kodu** MVP dışı (ama compareAt zaten var)
- **Multi-language** MVP dışı (sadece TR)
- **Misafir checkout** zaten çalışıyor; **müşteri auth + sipariş geçmişi** önümüzdeki sprintte

## Sık Karşılaşılan Hatalar

- **`_global-error` prerender + useContext null:** `.claude/settings.json`'da `NODE_ENV: development` set ederken `npm run build` çağrısında inline `NODE_ENV=production` geçmek gerekir. CI'da NODE_ENV manuel set EDİLMEZ — Next.js zaten yönetiyor
- **`npm ci` lockfile drift:** Yeni paket ekledikten sonra `npm install` çalıştır, `package-lock.json` değişikliğini commit et
- **Hash router'da hydration mismatch:** `LaffogatoApp` mount-öncesi `PageHome`'u render eder; hash'i `useEffect`'te okur. Bunu bozma
- **Server action'dan client state'e dönüş yok:** Sepet temizleme `/odeme/basarili`'deki `ClearCart` component'iyle yapılır (localStorage temizler)
