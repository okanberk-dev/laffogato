# Tasarım uygulama planı: panelde iş listesi ve yan bölme (F)

Design lab oturumu, 5 Kasım 2026 (`.claude/skills/design-lab`). Lab ve
önizleme silindi; bu belge kararın tek kaydıdır. Panel bu oturumda
değişmedi; uygulama ayrı bir iştir ve kendi PR'ında yapılır.

## Özet

- **Kapsam:** sayfa düzeni. Kenar çubuğu, Genel bakış (`/admin`),
  Siparişler (`/admin/siparisler`) ve sipariş sayfası
  (`/admin/siparisler/[id]`).
- **Brief:** sahip ve yönetici, masaüstü (1280 px ve üstü), rahat yoğunluk.
  Sorunlar: çok kalabalık, öncelik belirsiz. İşler: bekleyen işi görmek,
  günün parasını görmek, siparişi ilerletmek. Görsel dil Innex, değişmedi
  (`docs/ADMIN-INNEX.md`).
- **Denenenler:** A önce iş, B liste ve yan bölme, C sıkı, D satır içi +
  çekmece + aşamalı açılım, E sakin yüzey.
- **Kazanan:** F. Operatör "parçaları birleştir" dedi: **A'nın iş listesi +
  B'nin yan bölmesi**. F değişiklik istenmeden onaylandı.
- **Ana fikir:** her ekran "şu an senin işin ne" ile açılır. İş, sayfa
  değiştirmeden yan bölmede biter. Ekranda tek dolu düğme olur.

## Kararlar, ekran ekran

### Kenar çubuğu (B)

- **Masaüstü (`lg` ve üstü):** 60 px **ikon şeridi**. Etiket `title` ve
  `aria-label`'da durur; grup arası 1 px ayraç. Etkin satırın zemini
  `--admin-primary-soft`, ikonu `--admin-primary`.
- **Sayaç rozeti:** yalnız iş bekleyen yerde olur (Siparişler, Faturalar,
  Stok). Zemini kırmızı (`--admin-danger`), yazısı beyaz.
- **Açık kalan konu:** şerit bugünkü "Dar menü" ayarının
  (`docs/ADMIN.md` "Dar menü ve Sıkı görünüm") varsayılan olmasıdır. Ayar
  kalır, geniş menüye dönmek isteyen döner. Uygulamadan önce operatöre
  sorulur: varsayılan dar mı olacak, yalnız Siparişler'de mi?
- **Telefon:** alt çubuk aynen kalır (`ui/bottom-bar.tsx`).

### Genel bakış (B'nin bölmesi + A'nın listesi)

- **İki sütun.**
  - Solda **Bugünün parası**: büyük net ciro (34 px), geçen haftanın aynı
    günü bu saate kadar referansı, 14 günlük çubuk grafik, altında üç
    hücre (sipariş, açık, karaoke).
  - Sağda **"N iş seni bekliyor"**: A'nın satırları. Solda tona göre 4 px
    çizgi, başlık ve tek satır ayrıntı, varsa tutar ve eylem düğmesi. İlk
    satırın düğmesi dolu mavi, diğerleri çerçeveli. Satıra tıklamak
    siparişi açar.
- **Listenin kaynakları:** dikkat isteyen siparişler (iade bekliyor),
  faturası son gününde olanlar, barda 15 dakikayı geçen kafe siparişi,
  kargoya hazır koliler. Sıra: para borcu, yasal süre, bekleyen misafir,
  kargo.
- **Kalkanlar:** KPI şeridinin beş hücresi ikiye iner (para solda, iş
  sağda). "Dikkat isteyen" ve "Stokta yok" hücreleri listeye ya da altındaki
  tek satıra taşınır. Personel ciro görmez (D1): personele sol sütun
  çizilmez, liste tam genişlikte gelir.

### Siparişler (yan bölme + A'nın grupları)

- **Solda liste.**
  - Dokuz durum çipi yerine dört grup: **Senden bekleyen**, **Yolda**,
    **Ödeme bekleyen**, **Bitti**. Satırda dokuz durum hâlâ okunur; grubu
    açınca dokuzlu süzgeç "Tüm durumlar" altında durur.
  - Satır: no, ad, varsa uyarı hapı ("18 dk bekliyor", "İade bekliyor",
    "Fatura son gün"), kalemler ve kanal, sağda tutar ve sıradaki adımın
    adı.
- **Sağda bölme.**
  - Seçilen sipariş: başlık (no, durum, saat, kanal), **"Sıradaki adım"
    bandı** (mavi yumuşak zemin, ne olacağını söyleyen cümle, tek dolu
    düğme), tutar kartı, kalemler.
  - "Tam sayfada aç" sipariş sayfasına gider.
- **Seçim adreste kalır:** `?gor=<id>`, ürün ve menüdeki hızlı bakışla
  aynı desen (`ui/quick-look.tsx`). Geri / ileri ve paylaşılan bağlantı
  çalışır.
- **Genişlik:** 1280 px altında bölme bugünkü gibi çekmeceye döner;
  telefonda satır sipariş sayfasını açar.

### Sipariş sayfası (aynı bölme + A'nın görünümü)

- **Solda dar liste:** 250 px, yalnız "Senden bekleyen". Satır: no, ad,
  altında uyarısı ya da sıradaki adımı.
- **Sağda, yukarıdan aşağı:**
  - Başlık.
  - **Sıradaki adım bandı**: bugünkü başlıktaki tek birincil eylemin yerini
    alır.
  - Yan yana tutar kartı (toplam, müşteri, ödeme, teslimat) ve kalemler
    (KDV dökümü bugünkü gibi kalemlerin altında).
  - Katlanan dört satır: **Müşteri ve adres**, **Ödeme ve iade**,
    **Fatura**, **Geçmiş**. Her satırın kapalıyken tek satır özeti görünür.
- **Bugünkü sekmelerle ilişkisi:** sekmeler (`?sekme=`) katlanan satırlara
  döner. `?sekme=` bağlantısı ilgili satırı **açık** getirir. Dikkat
  isteyen sipariş "Ödeme ve iade" açık gelir. `#odeme` gibi çapalar aynen
  çalışır.
- **Değişmeyen adres:** `/admin/siparisler/[id]` (e-posta bağlantıları,
  bar ekranı ve LafPOS buraya gelir).

## Değişecek dosyalar

Panel dosyaları:

- [ ] `src/components/admin/admin-sidebar.tsx`: ikon şeridi, yalnız iş
  bekleyen yerde sayaç, dar menü varsayılanı (operatör kararı).
- [ ] `src/app/admin/page.tsx` + `src/components/admin/dashboard/*`:
  iki sütun. `kpi-strip.tsx` sol sütuna iner; yeni `work-queue.tsx`
  (iş listesi).
- [ ] `src/app/admin/siparisler/page.tsx` + `src/components/admin/orders-list.tsx`:
  dört grup, uyarı hapları, satırda sıradaki adım, `?gor=` bölmesi.
- [ ] `src/app/admin/siparisler/[id]/page.tsx` + `src/components/admin/order-detail.tsx`:
  sıradaki adım bandı, katlanan bölümler, dar liste.
- [ ] Kit: `ui/next-step-band.tsx` (yeni; sipariş, karaoke rezervasyonu ve
  fatura da kullanır), `ui/quick-look.tsx` (kalıcı bölme kipi),
  `ui/detail-layout.tsx` (bölmeli düzen).

Arka yüz (CLAUDE.md sınırı; ayrıca söylenir):

- [ ] `src/lib/admin/order-filters.ts`: dört grubun süzgeci. "Senden
  bekleyen" = ödenmiş ve hazırlanmamış + kargoya hazır koli + dikkat
  işaretli + faturası son gününde. Saf fonksiyon, testli.
- [ ] `src/lib/admin/dashboard-core.ts`: iş listesinin sırası ve
  cümleleri (saf, testli). Veriyi okuyan yarı ayrı dosyada.
- [ ] Sunucu action'ları, form `name`'leri ve sipariş geçişleri
  (`transitionOrder`) **değişmez**. Bant ve satır düğmeleri bugünkü
  action'ları çağırır.

## Uygulama adımları

1. **Süzgeç ve sıra (saf):** `order-filters.ts`'e grup süzgeci,
   `dashboard-core.ts`'e iş listesi. Önce testler
   (`tests/admin-order-filters*.test.ts`, `tests/admin-dashboard*.test.ts`).
2. **Kit:**
   - `NextStepBand`: başlık, cümle, tek düğme; düğme bugünkü
     `ActionForm` / `ActionModal`'ı sarar.
   - `QuickLook`'a "kalıcı bölme" kipi: `xl` ve üstünde sağda sabit,
     altında bugünkü çekmece.
3. **Sipariş sayfası:** bant + katlanan bölümler; `?sekme=` → açık bölüm
   eşlemesi; dar liste `xl` ve üstünde.
4. **Siparişler:** dört grup + `?gor=` bölmesi. Kayıtlı görünümler ve
   liste araması aynen.
5. **Genel bakış:** iki sütun, iş listesi. Personelin görünümü (D1)
   ayrıca denenir.
6. **Kenar çubuğu:** ikon şeridi ve sayaçlar. Dar menü varsayılanı
   operatör onayından sonra.
7. Her adım `build-admin-panel` Aşama 5 ile doğrulanır: gerçek tarayıcı,
   1280 ve 390 px, giriş yapmış sahip ve personel.

## Bileşen API'si (yeni)

```ts
// ui/next-step-band.tsx
interface NextStepBandProps {
  title: string;        // "Sıradaki adım: kargoya ver"
  reason: string;       // ne olacağını söyleyen tek cümle
  action: ReactNode;    // bugünkü ActionForm / ActionModal düğmesi
}

// dashboard/work-queue.tsx
interface WorkItem {
  id: string;
  tone: "danger" | "warning" | "primary";
  title: string;        // "İade bekliyor"
  detail: string;       // "#10412 · ürün tükendi"
  amountMinor?: number;
  href: string;         // siparişin ?gor= ya da sayfası
  action?: ReactNode;   // yalnız ilki dolu
}
```

## Gerekli durumlar

- **Yükleniyor:** bölme açılırken iskelet (`loading.tsx` deseni); liste
  yerinde kalır.
- **Boş:** "Senden bekleyen iş yok" ve diğer grupların sayısı; Genel
  bakış'ta iş listesi yerine tek satır "Bekleyen iş yok".
- **Hata:** bölmede satır içi hata ve "Tekrar dene"; liste etkilenmez.
- **Devre dışı:** yetkisi olmayan rol için bant düğmesi yok, cümle kalır
  (ör. personel iade başlatamaz).
- **Doğrulama:** action'ların kendi reddi bugünkü toast ve form hatasıyla.

## Erişilebilirlik kontrol listesi

- [ ] İkon şeridinde her öğe `aria-label`; odakta görünür halka
  (`--admin-primary`/40).
- [ ] Bölme açılınca odak bölmenin başlığına; `Esc` kapatır (çekmece
  kipinde).
- [ ] Gruplar `role="tablist"`; ok tuşlarıyla gezinme.
- [ ] Katlanan bölümler `<details>`/`aria-expanded`.
- [ ] Kontrast: bant metni `--admin-primary-soft` üstünde AA
  (`tests/admin-ui-kit.test.ts`'e ekle).
- [ ] Dokunma hedefi 44 px, işaretçide 36 px.
- [ ] Klavye kısayolları (`docs/ADMIN.md`) bölmeli düzende de çalışır.

## Test kontrol listesi

- [ ] Grup süzgeci ve iş sırası birim testleri.
- [ ] `?sekme=` → açık bölüm eşlemesi testi.
- [ ] `tests/admin-ui-deps.test.ts` geçer (yeni paket yok).
- [ ] `/admin/kasa`'ya kütüphane kodu girmez; rota başına en çok 8 KB gz
  (ölçüm PR gövdesinde).
- [ ] Gerçek tarayıcı: `scripts/admin-crawl.mjs` konsol ve 4xx/5xx
  temiz.

## Tasarım token'ları

- Yeni token yok. Kullanılanlar: `--admin-primary`,
  `--admin-primary-soft`, `--admin-danger`, `--admin-warning`,
  `--admin-surface-2` (bölme zemini), `--admin-chart-fill` (grafik),
  `NUMERIC_STYLE`.
- Karar kalıcılaşınca `docs/ADMIN.md` "Innex düzenleri"ne yazılır.
