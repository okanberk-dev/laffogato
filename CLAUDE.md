@AGENTS.md

# Laffogato — Kafe + E-ticaret Platformu

Bu dosya, Claude Code'un bu projede tutarlı çalışması için gerekli bağlamı içerir. Next.js'in bu sürümüne özgü kurallar için `AGENTS.md`'yi de oku.

## Proje Özeti

**Laffogato**, bir kafenin kurumsal web sitesi ve e-ticaret platformudur. Müşteriler menüye göz atabilir, ürünleri sepete ekleyebilir, online ödeme yapabilir. Admin paneli üzerinden ürün/kategori/sipariş yönetimi tek yerden yapılır.

- Deployment hedefi: **Vercel** (Edge + Node runtime)
- Veritabanı + Auth: **Supabase** (Postgres + RLS + Storage)
- UI: **Next.js App Router + Tailwind v4 + shadcn/ui**
- Ödeme: **Sağlayıcı bağımsız soyutlama** (`src/lib/payment/provider.ts`). İlk entegrasyon henüz seçilmedi; arayüze plug-in edilecek (iyzico / PayTR / Stripe / vs.).
- Dil: **Türkçe** (arayüz + içerik). Kod ve commit mesajları İngilizce.

## Klasör Yapısı

```
src/
  app/
    (shop)/              → Müşteri tarafı (menü, ürünler, sepet, ödeme, hesabım)
    admin/               → Admin panel (ayrı layout + 2FA korumalı)
    api/                 → Route handlers (webhook, cart, orders)
  components/
    ui/                  → shadcn/ui primitive'leri
    shop/                → Müşteri tarafı komponentleri
    admin/               → Admin komponentleri
    layout/              → Header, Footer, Nav
  lib/
    supabase/            → Client/server/middleware factory'leri
    payment/             → PaymentProvider interface + mock implementasyon
    validation/          → Zod şemaları
    utils/               → Genel yardımcılar
  types/                 → Global TS tipleri (DB tipleri Supabase'den generate edilir)
  hooks/                 → React custom hook'lar
supabase/
  migrations/            → SQL migration dosyaları (timestamp_isim.sql)
  seed/                  → Test verileri (urunler, kategoriler)
docs/                    → Proje dokümantasyonu (PROMPT.md, mimari notlar)
.claude/                 → Claude Code ayarları (settings.json, vs.)
```

## Geliştirme Komutları

```bash
npm run dev         # Geliştirme sunucusu (http://localhost:3000)
npm run build       # Production build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run format      # Prettier yaz
```

## Veri Modeli (özet)

Tüm tablolar Supabase RLS politikaları ile korunur. Detaylı şema `supabase/migrations/` altındadır.

- `categories` — Ürün kategorileri (kahve, tatlı, atıştırmalık, vs.)
- `products` — Ürünler (slug, ad, açıklama, fiyat, görsel, stok, kategori_id, aktif)
- `product_variants` — Boy/şeker tercihi gibi varyantlar (opsiyonel)
- `orders` — Sipariş başlığı (kullanıcı_id, durum, toplam, adres)
- `order_items` — Sipariş kalemleri (sipariş_id, ürün_id, varyant_id, miktar, birim_fiyat)
- `payment_transactions` — Ödeme provider'ından dönen yanıtlar (idempotent)
- `admin_users` — Admin rolleri (user_id → role)
- `cafe_settings` — Tek satırlık ayar tablosu (çalışma saatleri, banner, vs.)

## Güvenlik Kuralları

1. **RLS her tabloda zorunludur.** Yeni migration eklerken `ENABLE ROW LEVEL SECURITY` + uygun politikalar şart.
2. **Service role key yalnızca server-side.** Client tarafında `NEXT_PUBLIC_SUPABASE_ANON_KEY` kullanılır.
3. **Admin route'ları Next.js proxy ile korunur** (`src/proxy.ts` — Next.js 16'da `middleware` yerine `proxy` ismi kullanılır). Sadece `admin_users` tablosunda yer alan kullanıcılar geçer.
4. **Ödeme tutarı asla client'tan gelmez.** Server, sipariş kalemlerinin DB fiyatından toplamı yeniden hesaplar.
5. **Webhook'lar imza doğrular** (`x-signature` header → HMAC SHA256). Doğrulanmayan istekler 401 döner.
6. **Idempotency:** Ödeme webhook'ları `payment_transactions.provider_ref` üzerinde unique constraint ile tek seferde uygulanır.
7. **Rate limit** kritik endpoint'lerde (`/api/orders`, `/api/webhooks/*`) middleware seviyesinde.
8. **CSRF:** Mutasyon API route'ları Next.js Server Actions veya `Origin` header kontrolü ile.
9. **PII:** Logging'de email/telefon maskelenmeli. Sentry/log servisleri için scrubber yazılır.
10. **Secrets** `.env.local` (gitignore'lı) + Vercel env vars. `.env.example` repo'da işaretçi olarak.

## Ödeme Soyutlaması

`PaymentProvider` arayüzü tek yerden tanımlanır (`src/lib/payment/provider.ts`):

```ts
interface PaymentProvider {
  createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession>
  verifyWebhook(req: Request): Promise<WebhookEvent>
  refund(transactionId: string, amount?: number): Promise<RefundResult>
}
```

Şu an `MockPaymentProvider` (test) kullanılıyor. Gerçek sağlayıcı eklenince `lib/payment/iyzico.ts` (veya benzeri) implement edip env üzerinden seçilecek.

## Çalışma Kuralları (Claude için)

- **Dil:** Kullanıcı ile Türkçe konuş. Kod, identifier, dosya adı, commit mesajı İngilizce.
- **Branch:** `claude/inspiring-cori-3JcFV` üzerinde geliştir. Push öncesi PR aç (draft).
- **Migration'lar:** SQL dosyası `supabase/migrations/YYYYMMDDHHMMSS_aciklama.sql` formatında. Önce dosyaya yaz, sonra Supabase MCP `apply_migration` ile uygula. Migration'ları geri-uyumlu tut, breaking change'i ayrı PR'da konuş.
- **Type üretimi:** Schema değişince `mcp__supabase__generate_typescript_types` ile `src/types/database.ts` güncelle.
- **shadcn ekleme:** `npx shadcn@latest add <component>` ile. Manuel kopyalama yapma.
- **Test:** Lighthouse + manual smoke testing. E2E için ileride Playwright eklenecek.
- **Yeni özellik:** Önce `docs/PROMPT.md`'deki MVP kapsamına uyduğunu doğrula. Kapsam dışıysa kullanıcıya sor.
- **Estetik:** Tasarım handoff geldiğinde token'lar `tailwind.config.ts` + `src/app/globals.css` üzerinden tanımlanır. Inline custom renk kullanma.

## Yapılmayacaklar

- Henüz tasarım handoff gelmedi → UI'ı detaylı stillemeyin, placeholder bırakın.
- Sanal POS sağlayıcısı seçilmedi → gerçek API key'leriyle entegrasyon henüz yapılmıyor, sadece interface.
- Mail/SMS bildirimleri MVP dışı (sonra Resend/Twilio eklenir).
- Coupon/indirim sistemi MVP dışı.
- Multi-language MVP dışı (sadece Türkçe).
