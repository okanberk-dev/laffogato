# Backend ↔ Frontend Bağlantı Audit'i (güncel `main`)

**Tarih:** 2026-06-20
**Audit edilen commit:** `main` (f4611f1)
**Kapsam:** Veri katmanı, müşteri SPA + checkout, müşteri üyeliği, admin paneli, ödeme/webhook yaşam döngüsü.
**Yöntem:** Statik kod incelemesi (195 kaynak dosya) + 3 paralel keşif ajanı + kritik dikişlerin firsthand okunması.

> Not: Bu rapor, yazıldığı tarihteki `main` dalına göredir. Önceki audit, o
> `main`'den 84 commit eski (bellek-içi store dönemi) koda göreydi ve
> geçersizdir; bu sürüm onun yerini alır.
>
> **2026-08-26 güncellemesi.** Rapordan bu yana veri katmanı Supabase'den
> `pg` sürücüsüyle doğrudan Postgres'e taşındı: `src/lib/supabase/*` ve
> `db/migrations/*` artık yok, yerlerini `src/lib/db/*` ve
> `db/migrations/*` aldı. Bulguların kendisi geçerliliğini korur; yalnızca
> dosya adları değişti. **G3 (müşteri sayfalarında DB hatasına dayanıklılık)
> kapandı** — `src/lib/db/health.ts` + `publicRead()` ile bozulma davranışı
> uygulandı; ayrıntı `CLAUDE.md` → "Veritabanı Kesintisinde Davranış".
> G1, G2, G4–G7 açık. Ayrıca franchise modülü üründen çıkarıldı;
> aşağıdaki şema ve tablolarda geçen `franchise_*` artıkları geçersizdir.

---

## 0. Önem Derecesi Lejantı

| Seviye             | Anlamı                                            |
| ------------------ | ------------------------------------------------- |
| 🔴 **Kritik**      | Üretimde para/sipariş kaybı veya güvenlik açığı   |
| 🟠 **Yüksek**      | Önemli işlevsel kopukluk / dağıtım riski          |
| 🟡 **Orta**        | Tutarsızlık / yanıltıcı UX                        |
| 🟢 **Bilgi / İyi** | Doğru kurgulanmış bağlantı veya bilinçli MVP-dışı |

---

## 1. Yönetici Özeti

Önceki audit'in çekirdek kopuklukları **`main`'de çözülmüş** durumda. Mimari artık sağlam ve "gerçek e-ticaret" seviyesinde:

- **Veri katmanı gerçek DB:** `src/lib/admin/store.ts` artık Supabase/Postgres üzerinden çalışıyor (`getSupabaseAdmin`, service-role, lazy singleton). 8 migration, boş tabloda idempotent seeding.
- **Sunucu-taraflı fiyatlandırma:** Checkout client fiyatına **güvenmiyor**; `resolveOrderLines` ürün/varyant fiyatını DB'den çözüyor, client farkını `priceAdjusted` ile flag'liyor.
- **Atomik stok:** `claim_order_stock` RPC ile hep-ya-hiç; oversell imkansız.
- **KDV/Kargo ayarlardan:** `computeOrderTotals` tek kaynak; KDV fiyata dahil (bilgi amaçlı ayrıştırma), kargo indirim-sonrası net üzerinden.
- **Webhook artık aynı DB'ye yazıyor:** `payment_transactions` + `orders.status` (HMAC doğrulamalı, unique-index ile idempotent).
- **Müşteri üyeliği:** HMAC imzalı cookie, **sipariş öncesi e-posta doğrulaması zorunlu**, wishlist/adres/sipariş geçmişi DB'li.
- **Admin:** 21 bölüm; tüm mutasyonlar `requireRole` (RBAC) + Zod + `revalidatePath` + audit log.
- **Ayar→site bağlantısı:** Ürün, menü, hero slider, reels, basın, hikaye, franchise, site metni, iletişim/saatler hep DB/ayar kaynaklı.

**Geriye kalan asıl bağlantı boşluğu** ödeme tahsilatıdır: checkout, ödeme başlatmadan (sanal POS yönlendirmesi yapmadan) doğrudan "başarılı" sayfasına gidiyor — bu bilinçli (POS sağlayıcısı henüz seçilmedi) ama uçtan uca döngü kapalı değil. Yanında birkaç küçük güvenlik/UX/dayanıklılık iyileştirmesi var.

### Bulgu Özeti

| #   | Bulgu                                                                                                                           | Seviye        | Karar gerektirir mi?                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------- |
| G1  | Ödeme döngüsü kapalı değil — `createCheckoutSession` hiç çağrılmıyor, mock auto-confirm yok; sipariş `pending_payment`'ta kalır | 🟠 (bilinçli) | Evet — POS seçimi / mock onay politikası |
| G2  | İade `provider.refund()` çağırmıyor — yalnızca `orders.refunds`'a yazıyor                                                       | 🟠            | Evet — gerçek POS ile                    |
| G3  | Supabase env zorunlu; eksik/geçici DB hatasında graceful degradation yok → site 500/boş                                         | 🟠            | Hayır (güvenli fix var)                  |
| G4  | Promo "sessiz düşüş": preview'de geçerli kod, submit anında geçersizse sipariş indirimsiz geçer, uyarı yok                      | 🟡            | Hayır                                    |
| G5  | Ana sayfa hero'da saat/öne-çıkan ürün hardcoded (footer/Visit dinamik ama hero değil)                                           | 🟡            | Hayır                                    |
| G6  | `isShopOpen` checkout'ta kontrol edilmiyor — kapalıyken sipariş alınır                                                          | 🟡            | Hayır                                    |
| G7  | Sipariş/ödeme bildirim e-postaları bağlı değil (altyapı var, doğrulama maili çalışıyor)                                         | 🟢 (MVP-dışı) | Evet — Resend kurulumu                   |

---

## 2. Mimari Veri Akışı (güncel)

```
                ┌──────────────────────────────────────────────┐
                │  Supabase / Postgres  (service-role)         │
                │  products·categories·menu_items·orders·       │
                │  promos·stock_moves·settings·customers·       │
                │  payment_transactions·reels·press·story·      │
                │  franchise_*·site_content·newsletter·legal    │
                │  RPC: claim_order_stock (atomik)              │
                └───▲───────────────▲──────────────────▲────────┘
        READ (server│components)    │ READ+WRITE        │ WRITE
                    │  store.ts     │ (RBAC+Zod+        │ (HMAC+idempotent)
                    │               │  audit+reval)     │
   ┌────────────────┴──────┐  ┌─────┴──────────┐  ┌─────┴─────────────────┐
   │ Müşteri SPA            │  │ Admin paneli   │  │ Ödeme webhook'u       │
   │ app/page.tsx → props   │  │ /admin/* (21)  │  │ api/webhooks/payment  │
   │ products·menu·hero·    │  └────────────────┘  │ orders.status=paid    │
   │ reels·press·story·     │                       │ payment_transactions  │
   │ franchise·content·     │   ┌───────────────┐   └───────────▲───────────┘
   │ settings(saat/iletişim)│   │ Müşteri auth  │               │ ⚠ kimse
   └───────┬────────────────┘   │ HMAC cookie + │               │ tetiklemiyor
           │ checkout            │ e-posta doğru.│   ┌───────────┴───────────┐
           ▼                     └───────────────┘   │ PaymentProvider(mock) │
   odeme/actions.ts ─ placeOrder ─► resolveOrderLines │ createCheckoutSession │
   (sunucu fiyat + atomik stok + promo + KDV/kargo)   │   ⛔ ÇAĞRILMIYOR       │
           │                                          │ refund ⛔ ÇAĞRILMIYOR  │
           ▼ redirect                                 └───────────────────────┘
   /odeme/basarili  (sipariş "pending_payment" — ödeme alınmadan)
```

---

## 3. Çalışan Bağlantılar (🟢)

| Akış                   | Kanıt                                                                                                                                         | Durum                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Veri katmanı → DB      | `supabase/server.ts` lazy singleton; `store.ts` `TABLES` map                                                                                  | ✅ Supabase             |
| Sunucu fiyatlandırma   | `store.ts` `resolveOrderLines` → `unitPriceMinor = product.priceMinor + variant.priceDeltaMinor`; client fiyatı yok sayılır, drift flag'lenir | ✅ Güvenli              |
| Atomik stok            | RPC `claim_order_stock` (`migrations/20260601130000`), hep-ya-hiç                                                                             | ✅ Oversell yok         |
| KDV/Kargo              | `utils/commerce.ts computeOrderTotals` (KDV dahil, kargo net üzerinden)                                                                       | ✅ Tek kaynak           |
| Promo iki-adım         | `previewPromoAction` (commit etmez) → `applyPromoCode` finalize'da re-validate + usage RPC                                                    | ✅ (G4 istisnası hariç) |
| Webhook → sipariş      | `api/webhooks/payment/route.ts` → `payment_transactions` insert + `orders.status='paid'` (`eq status pending_payment`)                        | ✅ Aynı DB              |
| Webhook güvenliği      | HMAC `x-signature` timing-safe (`mock.ts`), unique-index idempotency (23505)                                                                  | ✅                      |
| Müşteri auth           | `customer/auth.ts` HMAC cookie, timing-safe, deaktif hesap → çıkış                                                                            | ✅                      |
| E-posta doğrulama gate | `odeme/actions.ts:95-101` sipariş öncesi `emailVerified` zorunlu; e-posta server-authoritative                                                | ✅                      |
| Üyelik verisi          | wishlist/adres/sipariş geçmişi/bildirim tercihleri DB'li (`uye/actions.ts`, `customer/store.ts`)                                              | ✅                      |
| Ayar→site              | `page.tsx` settings.weeklyHours→Visit, iletişim→footer, free-shipping eşiği SPA'ya                                                            | ✅                      |
| İçerik CMS             | hero/reels/press/story/franchise/site-metni `listActive*` + `getSiteContent`                                                                  | ✅ DB                   |
| Admin RBAC             | her mutasyon `requireRole(section)` (`auth.ts`/`roles.ts`)                                                                                    | ✅                      |
| Admin doğrulama+audit  | Zod schema'lar + `logAudit` (32 entity × 13 aksiyon, append-only)                                                                             | ✅                      |

---

## 4. Geriye Kalan Bulgular

### 🟠 G1 — Ödeme döngüsü kapalı değil (createCheckoutSession orphan)

`placeOrderAction`, siparişi `pending_payment` oluşturup **doğrudan** `/odeme/basarili`'ye redirect ediyor (`odeme/actions.ts:142`). `getPaymentProvider().createCheckoutSession()` (`mock.ts:25`) **hiçbir yerden çağrılmıyor** (grep: yalnızca tanım). Mock'ta otomatik onay da yok → sipariş, admin `mark_paid` yapana kadar `pending_payment`'ta kalır. Webhook DB'ye bağlı ama mock'ta kimse tetiklemiyor.
**Etki:** Gerçek ödeme tahsil edilmiyor. (Bilinçli — sanal POS seçilmedi. Ama "uçtan uca bağlantı" açısından asıl açık nokta.)
**Karar gerekir:** POS sağlayıcısı (iyzico/PayTR) seçimi; ya da geliştirme/demo için "mock auto-confirm" (checkout sonrası siparişi otomatik `paid` yapan dev-only akış).

### 🟠 G2 — İade ödeme sağlayıcısını çağırmıyor

`refundOrderAction` → `store.refundOrder()` yalnızca `orders.refunds`'a yazıp gerekiyorsa `status='refunded'` yapıyor (`store.ts:~1596`). `getPaymentProvider().refund()` çağrılmıyor (grep: yok). Mock'ta zararsız; gerçek POS'ta para iade edilmez.

### 🟠 G3 — Supabase env zorunlu / graceful degradation yok

`getSupabaseAdmin()` env yoksa **throw** ediyor (`server.ts:24,37`); store helper'ları (`rows/one/check`) PostgrestError'ı yutmadan **throw** ediyor. Sayfalarda/komponentlerde try-catch veya fallback yok → env eksikse veya geçici DB hatasında müşteri sitesi ve admin **500/boş ekran**.
**Etki:** Vercel'de env'ler set edilmezse tüm site patlar; geçici DB kesintisi tüm sayfaları düşürür. Güvenli fix: kritik okuma yollarında error boundary / fallback.

### 🟡 G4 — Promo "sessiz düşüş"

Sepette `previewPromoAction` indirimi gösterir; submit'te `finalizeOrder` `applyPromoCode`'u tekrar çağırır, geçersizse `discountMinor=0` ile **sessizce** devam eder — müşteriye uyarı yok. Preview ile submit arasında kod biterse/limit dolarsa müşteri indirimi beklerken indirimsiz ödenir.
**Fix:** Finalize'da promo düşerse siparişi durdurup kullanıcıyı bilgilendir veya başarı sayfasında "promo uygulanamadı" notu göster.

### 🟡 G5 — Ana sayfa hero'da hardcoded değerler

`pages.tsx` hero istatistikleri ("Şube: Tuzla", "Açık 10:00–23:00", "Yeni: Strawberry Matcha") ve "Affogato Strawberry" 155₺ hızlı-ekle butonu hardcoded. Footer ve Visit sayfası `settings.weeklyHours`'tan dinamik; hero değil. Sunucu yine de yeniden fiyatlandırdığı için para riski yok ama admin saati/öne-çıkanı değiştirince hero eskir.
**Fix:** Hero saat/öne-çıkan ürünü `settings`/`getSiteContent`'ten besle.

### 🟡 G6 — `isShopOpen` checkout'ta kontrol edilmiyor

`settings.isShopOpen` var (admin'de toggle), ama `placeOrder` bakmıyor. Mağaza "kapalı"yken bile sipariş alınır.
**Fix:** `placeOrder` başında `isShopOpen` guard + müşteriye bildirim (eski Faz 0 fikriyle aynı, bu kez DB'li store'da).

### 🟢 G7 — Sipariş/ödeme bildirim e-postaları bağlı değil

`lib/email/send.ts` var ve **e-posta doğrulama** maili çalışıyor (Resend ayarlıysa gönderir, değilse log'a yazar). Ama sipariş-alındı/ödendi/iade e-postaları hiçbir yerden gönderilmiyor (`placeOrder`, webhook, refund). `CLAUDE.md`'de Mail/SMS açıkça MVP-dışı.
**Karar gerekir:** Resend kurulumu + şablonlar.

---

## 5. Önerilen Faz Planı (gerçek bulgulara göre)

**Faz A — Güvenli, karar gerektirmeyen sertleştirme (hemen yapılabilir):**

- G6: `placeOrder`'da `isShopOpen` guard + `/?cart=shop_closed` bildirimi.
- G4: Promo finalize'da düşerse kullanıcıyı bilgilendir (sessiz düşüşü kaldır).
- G3: Müşteri sayfalarında DB hatasına dayanıklılık (error boundary / fallback banner).
- G5: Hero saat/öne-çıkan değerlerini `settings`/içerikten besle.

**Faz B — Ödeme döngüsünü kapat (karar gerekir):**

- G1: `placeOrderAction` → `createCheckoutSession` → `redirectUrl`'e yönlendir. Mock için dev-only auto-confirm (siparişi `paid` yapan iç webhook çağrısı) ya da gerçek POS (iyzico/PayTR) entegrasyonu.
- G2: İade akışını `provider.refund()` ile bağla.

**Faz C — Bildirimler (karar gerekir):**

- G7: Resend ile sipariş-alındı / ödendi / kargo / iade e-postaları.

> Faz B ve C, `CLAUDE.md` gereği kullanıcı onayı + sağlayıcı/anahtar kararları gerektirir (POS seçilmedi; Resend ayarlı değil). Faz A güvenli ve bağımsızdır.

---

## 6. Ek: Audit Edilen Kritik Dosyalar

- Veri katmanı: `src/lib/admin/store.ts`, `src/lib/db/index.ts`, `src/lib/db/client.ts`, `src/lib/db/counters.ts`, `src/lib/utils/commerce.ts`, `db/migrations/*`
- Müşteri: `src/app/page.tsx`, `src/app/odeme/{actions.ts,page.tsx,checkout-wizard.tsx,basarili/*}`, `src/components/laffogato/{app,pages,ui,chrome}.tsx`, `src/app/uye/*`, `src/lib/customer/{auth,store}.ts`
- Ödeme: `src/lib/payment/{index,provider,mock}.ts`, `src/app/api/webhooks/payment/route.ts`
- Admin: `src/app/admin/*/actions.ts`, `src/lib/admin/{auth,roles,audit}.ts`
- Bildirim: `src/lib/email/send.ts`
