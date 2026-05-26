# Laffogato — Proje Prompt'u

Bu doküman, ürünün ne olduğunu, kim için yapıldığını ve MVP'nin sınırlarını tanımlar. Tasarım handoff geldiğinde bu dokümanı genişleteceğiz.

## 1. Vizyon

Laffogato, bir kafe markasının online vitrinidir. İki temel kullanım vardır:

1. **Tanıtım sitesi** — Ziyaretçi kafeyi tanır, menüye bakar, konum/iletişim bulur.
2. **E-ticaret** — Müşteri ürünleri (paketli kahve, malzeme, hediye seti, vb.) online satın alır.

İleride şube online sipariş, masa rezervasyonu gibi modüller eklenebilir; ama MVP bunları kapsamaz.

## 2. Hedef Kullanıcılar

- **Ziyaretçi** (anonim): Menü ve hikaye sayfalarına bakar. Sepete ürün ekleyebilir, ödeme sırasında kayıt/giriş ister.
- **Müşteri** (kayıtlı): Sipariş geçmişini görür, adreslerini saklar, fatura indirir.
- **Admin** (kafe sahibi/çalışanı): Ürün, kategori, sipariş ve site ayarlarını yönetir.

## 3. MVP Kapsamı

### Müşteri tarafı (`/`)

- [ ] Ana sayfa — hero, öne çıkan ürünler, hakkımızda kısa
- [x] Ana sayfa — premium dark hero, marquee, signature affogato, matcha bar, shop teaser, reels, franchise teaser, press
- [x] Menü (`#menu` hash route) — sticky tab nav, 5 kategori × kalem, kafe MENU'sü artık admin'den yönetiliyor
- [x] Ürünler / Shop (`#shop`) — sidebar filter (kategori + fiyat slider + tag), Affogato Kit feature, trust badges, was-price strike
- [x] Ürün hızlı bakış modal (galeri yok ama varyant + detay var)
- [x] Sepet (CartDrawer) — kalemler, sil, toplam, kargo bilgisi, "Ödemeye geç"; localStorage'da kalıcı
- [x] Ödeme (`/odeme/basarili?ref=<id>`) — `placeOrderAction` ile gerçek sipariş yaratır, premium başarı sayfası, sepet otomatik temizlenir
- [x] Hikaye (`#story`) · Visit (`#visit`, interaktif rezervasyon kartı) · Reels (`#reels`, lightbox) · Franchise (`#franchise`, 3 paket + apply form)
- [ ] Hesabım — müşteri auth + sipariş geçmişi (önümüzdeki sprint)

### Admin tarafı (`/admin`)

- [x] Giriş (`/admin/giris`) — env-credentialed signed cookie (constant-time compare, 7 gün TTL). 2FA opsiyonel olarak sonra
- [x] Dashboard (`/admin`) — 5 stat kart (ürün, stoksuz, kategori, aktif sipariş, ciro), son siparişler, hızlı erişim
- [x] Ürünler (`/admin/urunler`) — liste (arama + filtre + sıralama), 5-step wizard ile yeni, tabs ile düzenle (slug/SKU/compareAt/cost/SEO/varyant/images)
- [x] Kategoriler (`/admin/kategoriler`) — Shop kategorileri CRUD + sıralama + ikon
- [x] **Menü** (`/admin/menu`) — Kafe menüsü (affogato/matcha/espresso/cold/gelato) kalem CRUD, tag editörü, sıralama
- [x] Siparişler (`/admin/siparisler`) — 7 durumlu dropdown ile güncelleme, kalem dökümü
- [x] Ayarlar (`/admin/ayarlar`) — kafe adı, slogan, telefon, email, adres, çalışma saatleri, mağaza açık toggle
- [ ] Görsel yükleme (Supabase Storage) — şu an URL alanı
- [ ] Bulk actions (toplu sil/aktif yap) — gelecek

### Auth

- [x] Admin: env-credentialed signed cookie (`ADMIN_EMAIL` + `ADMIN_PASSWORD` + HMAC SHA256 + `ADMIN_SESSION_SECRET`)
- [ ] Müşteri: Supabase Auth (Supabase bağlandığında)
- [ ] Admin 2FA (TOTP) — gelecek

### Ödeme

- [x] `PaymentProvider` arayüzü + `MockPaymentProvider` (`src/lib/payment/`)
- [x] Webhook endpoint'i (`/api/webhooks/payment`) — HMAC SHA256 imza doğrulama, idempotent insert (`payment_transactions.provider_ref` unique)
- [x] Sipariş durum makinesi: `pending_payment` → `paid` → `preparing` → `shipped` → `completed` | `cancelled` | `refunded`
- [x] Stok düşümü `placeOrder` içinde atomik (önce tüm kalemler valide, sonra düşürme — partial write yok)
- [ ] Gerçek sanal POS sağlayıcısı (iyzico / PayTR / craftgate — kullanıcı seçimi bekleniyor)

## 4. MVP Dışı (sonraya)

- Kupon / indirim kodları
- Mail/SMS bildirimleri (Resend, Twilio)
- Çoklu dil (i18n)
- Çoklu şube / online masa siparişi
- Stok düşüm otomasyonu (manuel girilecek)
- Müşteri yorumları / puanlama
- Wishlist
- Misafir checkout (MVP'de zorunlu kayıt)
- Mobil uygulama
- Şube içi POS entegrasyonu

## 5. Mimari Karar Kayıtları

| Karar | Seçim | Gerekçe |
|-------|-------|---------|
| Framework | Next.js 16 (App Router) | Vercel native, Server Components ile DB erişimi temiz, SEO uyumlu |
| DB | Supabase Postgres | Auth + Storage + RLS aynı yerde, MCP entegrasyonu mevcut |
| UI | shadcn/ui + Tailwind v4 | Tasarım sistemine uyarlama kolay, kullandığın kadar bundle |
| Form | react-hook-form + zod | TS dostu, server-side aynı şema |
| State | URL + Server Components + cookie cart | Client store gereksiz, sepet auth'suz da çalışmalı |
| Payment | Provider abstraction | Sağlayıcı sonra seçilecek, kodun %95'i taşınabilir kalır |
| Deploy | Vercel | Edge middleware + ISR + native Next.js |

## 6. Sepet Stratejisi

- **Anonim sepet:** httpOnly cookie içinde `cart_token` (UUID). Sepet kalemleri `carts(token)` tablosunda. 30 gün TTL.
- **Login sonrası:** Cookie token'lı sepet kullanıcıya merge edilir (server action).
- **Stok kontrolü:** Sepete ekleme sırasında yumuşak; ödeme adımında tekrar doğrulama (DB row lock).

## 7. Sipariş Akışı (mutlu yol)

1. Müşteri sepeti onaylar → `/odeme`
2. Adres + ödeme yöntemi seçer → "Sipariş Ver"
3. Server: `orders` (status=`pending_payment`) + `order_items` oluşturur (fiyatlar DB'den)
4. Server: `PaymentProvider.createCheckoutSession` → `payment_url`
5. Müşteri sağlayıcının sayfasında ödemeyi tamamlar
6. Sağlayıcı webhook'u → imza doğrulanır → `payment_transactions` insert + `orders.status = paid`
7. Müşteri `/odeme/basarili?ref=…` sayfasına yönlenir → sipariş özeti
8. Admin paneli "Yeni Sipariş" olarak gösterir, admin durumu ilerletir

## 8. Performans & SEO

- Ürün ve menü sayfaları **SSG / ISR** (revalidate=60). Admin değişiklik yapınca `revalidatePath`.
- Görseller `next/image` + Supabase Storage CDN.
- `sitemap.xml` + `robots.txt` otomatik üretilir.
- Schema.org `Product` JSON-LD.

## 9. Test Verisi

İlk migration sonrası `supabase/seed/seed.sql` çalıştırılır:

- 4 kategori: Kahveler, Tatlılar, Atıştırmalıklar, Hediye Setleri
- 12 ürün (kategori başına 3'er): görsel placeholder + fiyat + açıklama
- 1 admin kullanıcısı (env'den oluşturulur — `SEED_ADMIN_EMAIL`)
- 1 örnek `cafe_settings` satırı

## 10. Açık Konular

- [ ] Sanal POS sağlayıcısı kararı (iyzico vs. PayTR vs. craftgate)
- [ ] Kargo entegrasyonu (sadece manuel takip mi, yoksa kargo API'si mi?)
- [ ] Fatura/e-arşiv entegrasyonu (gerekli mi?)
- [ ] KVKK aydınlatma metni + çerez bildirimi
- [ ] Tasarım handoff dosyaları gelince renk paleti, tipografi, ikon seti
