# Sıradaki Session Brief'i — "Admin'de Tam Kontrol"

> Bu dosyayı yeni bir Claude Code session'ına **olduğu gibi yapıştır**. Geçmişi bilmeyen bir Claude için tüm bağlamı toparlıyor.

---

## Bağlam (oku)

**Repo:** `RiosenBeq/laffogato` · **Branch:** `claude/inspiring-cori-3JcFV` (kullan, her özellik için ayrı PR aç, draft, merge'ü kullanıcı yapacak).

**Şu an çalışan:**
- Premium Next.js 16 müşteri sitesi (`/`), 1:1 Claude Design handoff
- Admin paneli (`/admin`): auth + dashboard + ürünler (wizard + Zod) + cafe menüsü + kategoriler + siparişler + ayarlar
- Sepet (localStorage'da kalıcı) → checkout → sipariş oluşturma + stok düşümü → admin/siparişler'de görünür
- Müşteri tarafı admin store'dan beslenir (compareAt strike-through dahil)
- CI: GitHub Actions, her PR'da typecheck + build
- Bellek-içi store (`src/lib/admin/store.ts`). Supabase migration yazıldı ama henüz uygulanmadı (free-tier limit)

**Detaylı durum:** `CLAUDE.md` ve `docs/PROMPT.md` oku. **Bu projeye özgü skill'ler:** `.claude/skills/` altında:
- `add-admin-resource` — yeni CRUD entity ekleme şablonu (8 adımlı)
- `server-action-pattern` — Zod + revalidate + redirect kalıbı
- `design-1-1-fidelity` — müşteri SPA'sını design'a sadık tutma
- `new-migration` — Supabase migration formatı (Supabase bağlanınca)
- `seed-db` — test verisi yükleme (Supabase bağlanınca)

**Çalışma kuralları:**
- Kullanıcıyla **Türkçe** konuş. Kod, dosya adı, identifier, commit mesajı **İngilizce**
- Her özellik için **ayrı PR**. Draft aç, kullanıcı merge edecek. CI yeşil olmadan merge etme
- `npm run typecheck` + `npm run build` her commit'ten önce temiz olmalı
- Migration / DB / Vercel / sanal POS dokunmadan önce kullanıcıya **onay sor**

---

## Hedef

**Admin panelde tam kontrol.** Şu an temel CRUD var ama gerçek bir e-ticaret operatörünün ihtiyacı olan ileri özellikler eksik. Aşağıdaki listeden öncelikle 1–5'i bitir, sonra 6–10'a geç. Her biri **ayrı PR** olsun.

### A · Operasyonel kontrol (öncelikli)

1. **Görsel yükleme** — `src/components/admin/product-wizard.tsx` Adım 4'te şu an satır-satır URL alıyor. Bunun yerine drag-and-drop dosya yükleme ekle. Supabase Storage entegre edilmediyse şimdilik **base64 inline** veya **`/public/uploads`** kullan (in-memory store'da string'i tut). Çoklu görsel + sıralama + thumbnail seçimi. Pattern: client'ta resize + base64, server action'da kabul edip `images: string[]`'e ekle.
2. **Toplu işlemler** — `/admin/urunler`, `/admin/menu`, `/admin/siparisler` listelerinde checkbox + "Seçilenleri sil / aktif yap / pasif yap / kategori değiştir". Server action `bulkUpdateProducts(ids[], op)` gibi.
3. **Sipariş yönetimi v2** — `/admin/siparisler/[id]` detay sayfası: müşteri adres + iletişim, kalem-bazlı durum, içsel not alanı, iade başlat, fiş yazdırma. Status dropdown yerine actions: "Hazırlamaya başla", "Kargoya ver", "Tamamlandı", "İptal et + iade".
4. **Stok hareketleri kaydı** — `AdminStockMove { productId, delta, reason, by, at }`. Her sipariş, manuel düzeltme veya iade bir hareket. Admin "Stok hareketleri" sekmesinde görür. Düşüm zaten `placeOrder`'da var; sadece log ekle.
5. **Ayarlar v2** — Kafe ayarlarını alt sekmelere böl: Genel (ad/slogan/iletişim) · Saatler (gün-bazlı `Record<DayOfWeek, {open, close}>`) · Vergi (KDV %) · Kargo (ücretsiz eşiği + ücretli) · SEO (site title, og:image, sitemap toggle) · Bildirim (admin email).

### B · Müşteri tabanı (ikincil)

6. **Müşteri auth** — Supabase Auth bağlandığında müşteri login. Şimdilik: misafir checkout'ta email/phone topla, `customer_orders_by_email` ile geçmiş.
7. **Müşteri listesi** — `/admin/musteriler` — emaillere göre gruplanmış sipariş geçmişi, lifetime value, son sipariş tarihi.
8. **Promo kod sistemi** — `AdminPromo { code, discount: 'pct' | 'fixed', value, minSubtotal, usageLimit, expiresAt, isActive }`. Sepette uygula. `add-admin-resource` skill'ini kullan.

### C · İleri özellikler

9. **Analytics dashboard** — `/admin/raporlar` — günlük/haftalık/aylık ciro grafiği (basit SVG line chart), en çok satan 5 ürün, conversion (sipariş/ziyaret oranı placeholder).
10. **Rol-bazlı yetki** — şu an tek admin. `AdminUser { email, role: 'owner' | 'manager' | 'staff' }`. Owner her şeyi, manager ürün+menu+sipariş, staff sadece sipariş. `getAdminSession()`'a role ekle, sayfaları role gate'le.

### D · Güvenlik sertleştirme (her zaman)

11. **Login rate limit** — son 5 dk'da 5 başarısız → 1 dk lockout. IP + email başına. In-memory map yeterli (Supabase'e geçince Redis).
12. **2FA (TOTP)** — admin için. `otplib` kütüphanesi. QR code üret → kullanıcı taraısın → giriş'te 6 haneli kod.
13. **Audit log** — `AdminAuditLog { actor, action, entity, entityId, payload, at }`. Her server action'dan sonra `logAudit(...)`. Admin "Olay kaydı" sekmesinde okuma-only liste.

---

## Çalışma akışı

Her madde için:

1. **Plan modu** (gerekirse) — büyük değişiklikler için (örn. madde 6 — müşteri auth) önce `ExitPlanMode` ile bir plan üret, kullanıcı onaylasın
2. **Skill'leri kullan** — `add-admin-resource`, `server-action-pattern`, `design-1-1-fidelity` repo'da hazır. Yeni resource ekliyorsan ilkini, mutation yazıyorsan ikincisini açıkla
3. **Branch sync** — başlamadan: `git fetch origin main && git rebase origin/main`
4. **Küçük PR** — her madde tek PR. Açıklayıcı title (`feat(admin): bulk actions on products list`). Draft aç. PR body'sinde test akışı yaz
5. **Build temiz** — `npx tsc --noEmit && npm run build` (CI env'leriyle). CI yeşil bekle
6. **Geri bildirim** — kullanıcı merge sonrası ne demek istediği belirsizse sor

## Yapma

- **Supabase'i otomatik bağlama** — kullanıcı şu an istemiyor (free-tier limit). Madde 6'da auth gerekiyorsa **önce kullanıcıya sor**
- **Vercel'e otomatik deploy** — kullanıcı manuel yapacak
- **Sanal POS'a gerçek API key girme** — sağlayıcı seçimi yapılmadı
- **Müşteri SPA'sının tasarımını değiştirme** — `design-1-1-fidelity` skill'ine sadık kal
- **CLAUDE.md'yi büyük değişiklikler olmadan güncelleme** — onaltıncı bir PR olarak doc-only commit gereksiz
- **Bellek-içi store'a "kalıcılık" hack'i ekleme** (JSON file, vb.) — Supabase'i bekle. Sadece daily limit'leri zorlamayacak in-memory yeterli

## Çıkış kriteri

- Madde 1–5 main'e merge edildiğinde "operasyonel kontrol" tamam
- Madde 6–8 ile müşteri tabanı katmanı
- 9–10 ile rol + raporlar
- 11–13 ile güvenlik

Hepsi bitince Vercel deploy'a geçiş veya sanal POS entegrasyonuna karar süreci.

---

## İlk komut (kullanıcı session'a ne yazsın)

```
Aşağıdaki dosyayı okuduğun gibi 1. maddeyle (Görsel yükleme) başla. Önce
mevcut ProductWizard'ın Adım 4'üne bak, sonra teknik yaklaşımı kısaca
özetleyip onay iste, sonra implement et. Migration ya da Supabase
gerektiren bir şey çıkarsa bana danış.

docs/NEXT_SESSION.md
```

Veya başka bir maddeden başlamak istiyorsan:
```
docs/NEXT_SESSION.md'i oku. <X> numaralı maddeyle başla, planını paylaş,
onayımdan sonra implement et.
```
