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
- [ ] Menü (`/menu`) — kafe içi menü kategorileri (görsel ağırlıklı, satın al butonu yok)
- [ ] Ürünler (`/urunler`) — satılan ürünler kataloğu, kategori filtresi, arama
- [ ] Ürün detay (`/urunler/[slug]`) — galeri, açıklama, varyant seçimi, sepete ekle
- [ ] Sepet (`/sepet`) — kalemler, miktar değiştir, toplam
- [ ] Ödeme (`/odeme`) — teslimat adresi, ödeme yöntemi seçimi, "sipariş ver" → mock provider
- [ ] Hesabım (`/hesabim`) — siparişler, profil, adresler
- [ ] İletişim (`/iletisim`) — adres, harita, form
- [ ] Hakkımızda (`/hakkimizda`)

### Admin tarafı (`/admin`)

- [ ] Giriş (`/admin/giris`) — email + şifre + opsiyonel 2FA (TOTP)
- [ ] Dashboard (`/admin`) — günlük sipariş, ciro, en çok satan
- [ ] Ürünler (`/admin/urunler`) — listele, oluştur, düzenle, sil, görsel yükle, stok güncelle
- [ ] Kategoriler (`/admin/kategoriler`) — CRUD + sıralama
- [ ] Siparişler (`/admin/siparisler`) — listele, durum güncelle (hazırlanıyor / kargolandı / tamamlandı / iptal), detay
- [ ] Ayarlar (`/admin/ayarlar`) — kafe bilgileri, çalışma saatleri, hero banner

### Auth

- Müşteri: Supabase Auth (email + şifre, magic link opsiyonel)
- Admin: aynı auth + `admin_users` tablosunda kayıtlı olma + 2FA (TOTP, ileride zorunlu)

### Ödeme

- `PaymentProvider` arayüzü + `MockPaymentProvider` (rastgele başarı/başarısızlık döndürür)
- Webhook endpoint'i (`/api/webhooks/payment`) — imza doğrulama + idempotent uygulama
- Sipariş durumu: `pending_payment` → `paid` → `preparing` → `shipped` → `completed` / `cancelled` / `refunded`

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
