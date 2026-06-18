@AGENTS.md

# Laffogato — Kafe + E-ticaret Platformu

Bu dosya, Claude Code'un bu projede tutarlı çalışması için gerekli bağlamı içerir. Next.js'in bu sürümüne özgü kurallar için `AGENTS.md`'yi de oku.

## Proje Özeti

**Laffogato** (marka adı: **L'Affogato**) İstanbul Tuzla'da açılan kafenin kurumsal web sitesi + online mağazasıdır. Müşteri menüye bakar, ürün satın alır, ödeme yapar; admin paneli üzerinden ürün/menü/sipariş yönetimi tek yerden yapılır.

- **Stack:** Next.js 16 (App Router + Turbopack) · React 19 · Tailwind v4 · TypeScript · Zod
- **Deploy hedefi:** Vercel (Edge proxy + Node runtime API'ler)
- **Veri:** **Supabase (Postgres)** — `src/lib/admin/store.ts` + `src/lib/customer/store.ts` + `src/lib/admin/audit.ts` service-role client (`src/lib/supabase/server.ts`) üzerinden bağlanır. Tablo boşsa ilk istekte idempotent otomatik seed
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
      store.ts               → Supabase store (products, categories, menu, orders, promos, settings, hero)
      audit.ts               → Append-only audit log (audit_logs tablosu)
      product-schema.ts      → Zod schema for product form (coerce, validate, transform)
    customer/store.ts        → Müşteri hesapları (customers tablosu, bcrypt, adres/wishlist)
    payment/                 → PaymentProvider interface + MockPaymentProvider
    supabase/                → server.ts (lazy service-role client + TABLES) + counters.ts (next_seq RPC)
    utils/cn.ts, format.ts   → Genel yardımcılar
  types/database.ts          → Supabase'den auto-gen tipler (generate_typescript_types)
.claude/
  settings.json              → Permissions (Bash + GitHub MCP + Supabase MCP)
  skills/                    → Proje skill'leri (add-admin-resource, server-action-pattern, ...)
.github/workflows/ci.yml     → Typecheck + build her PR'da
supabase/
  migrations/                → SQL migration dosyaları (20260601120000_initial_schema uygulandı)
  seed/seed.sql              → Test verisi (app otomatik seed ediyor; bu dosya opsiyonel)
docs/
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
| `NEXT_PUBLIC_SUPABASE_URL` (veya `SUPABASE_URL`) | Supabase proje URL'i | Zorunlu (canlı) |
| `SUPABASE_SERVICE_ROLE_KEY` (veya `SUPABASE_SECRET_KEY`) | Server-side veri erişimi (RLS bypass) | Zorunlu (canlı) |
| `NEXT_PUBLIC_SITE_URL` | metadataBase | Local: `http://localhost:3000` |

**NODE_ENV asla manuel set edilmez.** Next.js kendi yönetir. CI bunu env'de tutmaz.

## Data Mimarisi

### Supabase (Postgres) — aktif

`src/lib/admin/store.ts` + `src/lib/customer/store.ts` + `src/lib/admin/audit.ts` + payment webhook — hepsi `src/lib/supabase/server.ts`'deki **lazy service-role client**'ı kullanır (RLS bypass, "server-only"). Eski Mongo doküman modeli **1:1** korundu: **camelCase quoted kolonlar** + iç-içe alanlar (`variants`, `items`, `refunds`, `addresses`, `weeklyHours`, …) **JSONB** + tarihler **ISO-8601 metin** (string sıralaması = kronolojik). Sıralı ID'ler (`prd-0001`, `orderNo` 10001+) `next_seq(counter_key)` RPC'siyle **atomik**. Tablo boşsa ilk istekte **idempotent seed** (upsert/ignoreDuplicates → yarış-güvenli). Build DB'ye bağlanmaz (lazy client + tüm veri sayfaları dynamic).

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

### Supabase (bağlı)

`supabase/migrations/20260601120000_initial_schema.sql` **uygulandı** (12 tablo + `next_seq` RPC, her tabloda RLS açık/deny-all → yalnız service-role erişir). Tablolar: products, categories, menu_items, orders, stock_moves, promos, settings, audit_logs, customers, shop_hero_slides, counters, payment_transactions.

Kalan/ileri adımlar:
- Auth'u Supabase Auth'a geçir (şu an admin env-cookie + müşteri bcrypt; ikisi de çalışıyor)
- Yeni tablo/kolon eklerken: yeni migration + RLS policy + `generate_typescript_types` ile `src/types/database.ts` güncelle

## Güvenlik Kuralları

1. **Admin cookie:** HMAC SHA256 imzalı, httpOnly, `sameSite=lax`, 7 gün TTL. Secret en az 32 karakter
2. **Kimlik karşılaştırması constant-time** (`crypto.timingSafeEqual`). Email lowercase normalize edilir
3. **Server-side validation Zod ile** — admin form input'ları parse edilmeden hiçbir mutation yapılmaz
4. **Tüm mutation'lar server action** (`"use server"` directive). FormData üzerinden gelir, client'tan tip bilgisi gelmez
5. **revalidatePath** her mutation sonrası — `/`, `/admin/*`, ilgili sayfa
6. **Ödeme tutarı asla client'tan gelmez.** Cart server'a fiyatları string olarak gönderir ama backend ürün adı match'iyle DB fiyatından doğrular (Supabase entegrasyonu sonrası)
7. **Webhook'lar** `x-signature` header → HMAC SHA256 timing-safe compare. Geçersiz → 401
8. **Idempotency:** Ödeme webhook'ları `payment_transactions.provider_ref` unique constraint ile tek seferde
9. **PII:** Logging'de email/telefon maskelenmeli (Sentry/log scrubber ileride)
10. **Service role key SADECE server-side** — `NEXT_PUBLIC_*` prefix'i asla servis role için kullanılmaz
11. **RLS her tabloda zorunlu** — Supabase migration zaten bunu varsayıyor. Yeni tablo eklerken policy unutma
12. **CI placeholder secrets** asla production'da kullanılmaz — `.env.local` ve Vercel env vars gerçek değerleri tutar

## Çalışma Kuralları (Claude için)

- **Dil:** Kullanıcı ile **Türkçe** konuş. Kod, identifier, dosya adı, commit mesajı **İngilizce**.
- **Branch:** `claude/inspiring-cori-3JcFV`. Her PR sonrası rebase et, force-with-lease push yap.
- **PR akışı:** Her özellik için ayrı PR. Draft aç, kullanıcı merge etsin. Webhook ile CI sonucunu izle, hata varsa düzelt.
- **Design 1:1:** Müşteri SPA'sı (`components/laffogato/*`) design handoff (`/tmp/design/cafe/project/`) ile birebir. Yeni özellik eklerken design'a sadık kal, sapma varsa kullanıcıya sor.
- **Admin form akışı:** Yeni ürün → `ProductWizard mode="wizard"` (5 adım); düzenleme → aynı bileşen `mode="tabs"`. Yeni alan eklerken **5 yer güncellenir:** `AdminProduct` (store), seed, `ProductInput`, `product-schema.ts` (Zod), `product-wizard.tsx` (UI). Skill: `add-admin-resource`
- **Server action pattern:** Zod parse → store call → revalidatePath → redirect. Skill: `server-action-pattern`
- **Migration:** `supabase/migrations/YYYYMMDDHHMMSS_aciklama.sql` formatında. Skill: `new-migration`
- **Test:** Build temiz olmalı. CI yeşil olmadan merge etme. UI değişikliği yaptıysan dev server'da göz ucuyla kontrol et
- **Para birimleri:** Tüm fiyatlar **minor unit** (kuruş) olarak `priceMinor: number`. UI'da `formatTRY()` ile render edilir
- **shadcn ekleme:** `npx shadcn@latest add <component>` ile (sandbox'ta registry erişimi yoksa skip). Manuel kopyalama yapma

## Yapılmayacaklar

- Henüz **Vercel'e deploy edilmedi** — env vars + URL kararı kullanıcıdan
- Henüz **sanal POS sağlayıcısı seçilmedi** — gerçek API key'leriyle entegrasyon yapma
- **Supabase bağlı (Postgres)** — admin auth hâlâ env-cookie, müşteri auth bcrypt; **auth'u Supabase Auth'a geçirme** isteğini kullanıcıdan onay almadan başlatma
- **Mail/SMS bildirimleri** MVP dışı (sonra Resend/Twilio)
- **Coupon/indirim kodu** MVP dışı (ama compareAt zaten var)
- **Multi-language** MVP dışı (sadece TR)
- **Misafir checkout** zaten çalışıyor; **müşteri auth + sipariş geçmişi** önümüzdeki sprintte

## Sık Karşılaşılan Hatalar

- **`_global-error` prerender + useContext null:** `.claude/settings.json`'da `NODE_ENV: development` set ederken `npm run build` çağrısında inline `NODE_ENV=production` geçmek gerekir. CI'da NODE_ENV manuel set EDİLMEZ — Next.js zaten yönetiyor
- **`npm ci` lockfile drift:** Yeni paket ekledikten sonra `npm install` çalıştır, `package-lock.json` değişikliğini commit et
- **Hash router'da hydration mismatch:** `LaffogatoApp` mount-öncesi `PageHome`'u render eder; hash'i `useEffect`'te okur. Bunu bozma
- **Server action'dan client state'e dönüş yok:** Sepet temizleme `/odeme/basarili`'deki `ClearCart` component'iyle yapılır (localStorage temizler)
