@AGENTS.md

# Laffogato — Kafe + E-ticaret Platformu

Bu dosya, Claude Code'un bu projede tutarlı çalışması için gerekli bağlamı içerir. Next.js'in bu sürümüne özgü kurallar için `AGENTS.md`'yi de oku.

## Proje Özeti

**Laffogato** (marka adı: **L'Affogato**) İstanbul Maltepe Park'ta açılan kafenin kurumsal web sitesi + online mağazasıdır. Müşteri menüye bakar, ürün satın alır, ödeme yapar; admin paneli üzerinden ürün/menü/sipariş yönetimi tek yerden yapılır.

- **Stack:** Next.js 16 (App Router + Turbopack) · React 19 · Tailwind v4 · TypeScript · Zod
- **Deploy hedefi:** Vercel (Edge proxy + Node runtime API'ler)
- **Veri:** Şu an **bellek-içi store** (`src/lib/admin/store.ts`). Supabase entegrasyonu hazır ama bağlı değil — free-tier limit yüzünden ertelendi
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
      ayarlar/               → Kafe ayarları formu
      actions.ts             → Genel logout action
      layout.tsx             → Admin chrome (nav + user + logout)
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
      store.ts               → In-memory mutable store (products, categories, menu, orders, settings)
      product-schema.ts      → Zod schema for product form (coerce, validate, transform)
    payment/                 → PaymentProvider interface + MockPaymentProvider
    supabase/                → Hazır client/server factories + proxy (dormant, ileride swap)
    utils/cn.ts, format.ts   → Genel yardımcılar
  types/database.ts          → Supabase'den auto-gen edilecek tip placeholder
.claude/
  settings.json              → Permissions (Bash + GitHub MCP + Supabase MCP)
  skills/                    → Proje skill'leri (add-admin-resource, server-action-pattern, ...)
.github/workflows/ci.yml     → Typecheck + build her PR'da
supabase/
  migrations/                → SQL migration dosyaları (henüz uygulanmadı)
  seed/seed.sql              → Test verisi (henüz uygulanmadı)
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
| `NEXT_PUBLIC_SUPABASE_URL` / `..._ANON_KEY` | Supabase | Şimdilik placeholder |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin | Şimdilik placeholder |
| `NEXT_PUBLIC_SITE_URL` | metadataBase | Local: `http://localhost:3000` |

**NODE_ENV asla manuel set edilmez.** Next.js kendi yönetir. CI bunu env'de tutmaz.

## Data Mimarisi

### In-memory store (şu an)

`src/lib/admin/store.ts` — modül-scope mutable array'ler. Süreç restart'ında reset olur, Vercel serverless'te invocation arası kalmaz. Geliştirme/demo için yeterli. **API'si Supabase-swap-ready:** tüm fonksiyonlar async döner, parametre şekilleri DB'ye geçişe uygun.

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

### Supabase (henüz bağlı değil)

`supabase/migrations/20260525000000_initial_schema.sql` hazır. Bağlama adımları:
1. Yeni proje oluştur (free tier limit doluysa bir mevcut projeyi pause/sil)
2. `mcp__supabase__apply_migration` ile uygula
3. `seed/seed.sql`'i çalıştır
4. Store fonksiyonlarının gövdelerini Supabase çağrılarıyla swap et — UI değişmez
5. Auth'u Supabase Auth'a geçir (`src/lib/supabase/proxy.ts` dormant)

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
- Henüz **Supabase bağlı değil** — store fonksiyonlarını DB'ye geçirme isteğini kullanıcıdan onay almadan başlatma
- **Mail/SMS bildirimleri** MVP dışı (sonra Resend/Twilio)
- **Coupon/indirim kodu** MVP dışı (ama compareAt zaten var)
- **Multi-language** MVP dışı (sadece TR)
- **Misafir checkout** zaten çalışıyor; **müşteri auth + sipariş geçmişi** önümüzdeki sprintte

## Sık Karşılaşılan Hatalar

- **`_global-error` prerender + useContext null:** `.claude/settings.json`'da `NODE_ENV: development` set ederken `npm run build` çağrısında inline `NODE_ENV=production` geçmek gerekir. CI'da NODE_ENV manuel set EDİLMEZ — Next.js zaten yönetiyor
- **`npm ci` lockfile drift:** Yeni paket ekledikten sonra `npm install` çalıştır, `package-lock.json` değişikliğini commit et
- **Hash router'da hydration mismatch:** `LaffogatoApp` mount-öncesi `PageHome`'u render eder; hash'i `useEffect`'te okur. Bunu bozma
- **Server action'dan client state'e dönüş yok:** Sepet temizleme `/odeme/basarili`'deki `ClearCart` component'iyle yapılır (localStorage temizler)
