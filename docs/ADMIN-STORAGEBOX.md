# Admin paneli: StorageBox görünümü (21 Kas 2026)

Operatör: _"laffogato admin panelini madamecoco reposundaki admin panel ile
aynı tarz tasarımda yap ... daha estetik güzel anlaşılır ve UI UX yönünden
güçlü olsun"_. Panel (`/admin`), Madame Coco Kenya'nın yönetim panelinin
(`RiosenBeq/madamecoco-kenya`, `DESIGN.md`) dilini aldı. O panel de
"StorageBox — SaaS Platform for E-Commerce Fulfillment" ekranlarından piksel
ölçülerek kurulmuştu. 22 Eki 2026'daki Innex görünümünün (`docs/ADMIN-INNEX.md`,
artık tarihçe) yerine geçer. Müşteri sitesi değişmedi (`docs/BRAND.md`).

Aynı gün operatör iki şey daha istedi: köşkün açık/kapalı durumu elle
seçilmesin, çalışma saatlerinden kendiliğinden gelsin (aşağıda "Köşk
durumu") ve üst çubuktaki arama "yapay zekâ gibi" durmasın, sade olsun
(aşağıda "Arama").

## Kısaca

Açık gri çerçevenin içinde **ince çizgili beyaz kartlar** (köşe 24), **hap
biçimli** her kontrol (düğme, alan, rozet, sekme), **lacivert-siyah** yazı,
**tek canlı mavi** birincil düğme, kenar çubuğunda etkin sayfa **koyu hap**.
Sayfa başlıkları, kart başlıkları ve büyük rakamlar **DM Sans 400**
(`.admin-display`), gerisi **Inter**.

## Nerede

| Parça                                                                     | Dosya                                                                                                                      |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Renk, köşe, yazı ölçeği token'ları; köşe eşlemesi; onay kutusu; seçim oku | `src/app/admin/admin-theme.css`                                                                                            |
| Yazı tipleri (Inter + DM Sans), çerçeve                                   | `src/app/admin/layout.tsx`                                                                                                 |
| Kenar çubuğu, üst çubuk, çekmece                                          | `src/components/admin/admin-sidebar.tsx`                                                                                   |
| Düğme, kart, kart başlığı, büyük rakam sınıfları                          | `src/components/admin/ui/styles.ts`                                                                                        |
| Form alanı, sayfa başlığı                                                 | `src/components/admin/forms.tsx`                                                                                           |
| Rozet ve tonlar                                                           | `ui/badge.tsx`, `ui/tone.ts`                                                                                               |
| Tablo, süzgeç çubuğu, sekmeler, segment, sihirbaz adımları                | `ui/data-table.tsx`, `ui/filter-bar.tsx`, `ui/status-tabs.tsx`, `ui/section-tabs.tsx`, `ui/segmented.tsx`, `ui/wizard.tsx` |
| Pano: rakam kartları, haftalık kartlar, grafik                            | `dashboard/kpi-strip.tsx`, `arc/arc.module.css`, `revenue-chart.tsx`                                                       |

Token'lar `[data-admin-root]` üstündedir; değerler yalnız panelde geçerli,
yalnız açık tema (koyu sistem teması paneli koyulaştırmaz).

## Renkler

| Token                   | Değer     | Kullanım                                                        |
| ----------------------- | --------- | --------------------------------------------------------------- |
| `--admin-bg`            | `#fafafa` | çerçevelerin dışı                                               |
| `--admin-canvas`        | `#f7f7f7` | sayfa çerçevesinin içi (kartların altı)                         |
| `--admin-frame-border`  | `#e9e9e9` | çerçevelerin 1 px kenarı                                        |
| `--admin-surface`       | `#ffffff` | kart, açılır kutu, pencere, alan, beyaz düğme                   |
| `--admin-surface-2`     | `#f2f2f5` | satırın üstüne gelince, nötr rozet, segmentin seçilisi, iç kuyu |
| `--admin-panel`         | `#ededf0` | gri hap: yuvarlak düğme, sessiz düğme, bölüm sekmelerinin rayı  |
| `--admin-card-border`   | `#ebebef` | kartın çok açık çizgisi                                         |
| `--admin-border-strong` | `#dbdbe1` | beyaz düğmenin, segmentin çerçevesi                             |
| `--admin-border-field`  | `#a3a5b2` | form alanının çerçevesi (aşağıda "Kararlar")                    |
| `--admin-text`          | `#1f212d` | başlık, rakam, tablo başlığı                                    |
| `--admin-text-soft`     | `#525361` | hücre, etiket, ikon                                             |
| `--admin-text-mute`     | `#636575` | ikincil satır, eksen, yer tutucu                                |
| `--admin-primary`       | `#122aff` | birincil düğme, bağlantı, odak halkası (`--admin-ring`)         |
| `--admin-inverse`       | `#1f212d` | etkin menü hapı, seçili onay kutusu, etkin sekme ve adım        |
| `--admin-count`         | `#e02d30` | bekleyen iş sayısının kırmızı hapı                              |
| `--admin-chart-line`    | `#5566f9` | grafik çizgisi; dolgu aynı rengin %30'dan %0'a geçişi           |

Rozet tonları: zemin kaynağın açık zemini (`#defde2`, `#eff2fe`,
`#fef4e8`, `#ffebeb`, `#f2f2f5`, `#f3effe`), yazı onun koyusu (`#0b7a3c`,
`#2c44d9`, `#a8540a`, `#c42626`, `#525361`, `#5b34d6`).

## Bileşenler

- **Çerçeve:** masaüstünde kenar çubuğu ve sayfa iki ayrı çerçeve: kenar
  çubuğu beyaz kart (köşe 24), sayfa `#f7f7f7` kanvas (köşe 28, 1440 px'ten
  32), ikisi de ince kenarlı, pencereye ve birbirine 8 px. Telefonda kanvas
  kenardan kenara, altta geçiş çubuğu.
- **Kenar çubuğu:** marka (36 px koyu daire, DM Sans ad), ince ayraç,
  gruplar (küçük büyük harf başlık, aralarında ince çizgi), hap satırlar
  (36 px; dokunmatikte 44), etkin satır koyu hap ve beyaz yazı, bekleyen iş
  kırmızı hapta. Altta gri hesap kartı (koyu daire içinde baş harf).
- **Üst çubuk:** kanvasın içinde, çizgisiz; solda konum (Bölüm › Sayfa),
  sağda arama kutusu ve sipariş zili (gri yuvarlak). Bir ögenin sekmeleri
  (Ürünler / Kategoriler gibi) altında gri rayda hap sekmeler, seçili beyaz.
- **Sayfa başlığı:** DM Sans 26-32 px, altında tek satır açıklama, sağda
  düğmeler; altında çizgi yok, 24-32 px boşluk.
- **Kart:** beyaz, çok açık 1 px çizgi, köşe 24, iç boşluk 24 (telefonda
  16), gölge yok. Kart başlığı DM Sans 18-22 px; sağındaki "Tümünü gör"
  küçük beyaz hap.
- **Düğmeler:** birincil mavi hap, ikincil beyaz hap ve ince çizgi, sessiz
  gri hap (`BUTTON.soft`), yuvarlak gri ikon düğmesi, tehlike beyaz hap ve
  kırmızı yazı. Basınca %98.
- **Form alanı:** beyaz hap (çok satırlıda köşe 16), odakta mavi kenar ve
  3 px yumuşak halka. Süzgeç çubuğundaki arama gri dolu hap. Onay kutusu
  köşe 7, seçiliyken koyu zemin ve beyaz işaret; seçim kutusunda ince ok.
- **Rozet:** tam yuvarlak, 24 px, noktasız; beş tondan biri.
- **Tablo:** başlık zeminsiz, 14 px orta kalın koyu yazı; satırlar ince
  çizgiyle ayrılır, üstüne gelince `--admin-surface-2`.
- **Durum sekmeleri** (Tümü, Açık, …): kanvasta beyaz haplar, seçili koyu
  hap; sayaç içinde küçük hap.
- **Sihirbaz adımları:** numaralı daire ve adın hapı; şimdiki koyu hap,
  geçilen mavi daire, bekleyen gri.
- **Pano:** her rakam kendi kartında (yuvarlak renkli ikon, ok, etiket,
  DM Sans büyük rakam, değişim hapı). Öncü rakam (bugünün net cirosu)
  iki kart genişliğinde (`KpiStrip lead`). Grafik yumuşak tek çizgi, solan
  dolgu, düz 1 px ızgara.

## Giriş ekranları

Operatör: _"giriş login sayfasını da estetik yap ve mobil de uyumlu yap"_.
Giriş (`/admin/giris`) ve iki adımlı doğrulama (`/admin/iki-asama`) aynı
iskeleti kullanır (`src/components/admin/auth-card.tsx`, Madame Coco'nun
giriş ekranı gibi):

- Açık gri çerçevenin üstünde işaret (koyu daire içinde L'Af) ve
  "L'Affogato · Yönetim", sağda "Siteye dön" gri hapı.
- Solda form kartı: "Yönetim paneli" çipi (kilit), DM Sans başlık
  ("Tekrar hoş geldin", "İki adımlı doğrulama"), tek satır açıklama, hap
  alanlar, tek mavi düğme, altında "Güvenli bağlantı · © yıl L'Affogato".
- Sağda (≥ 1024 px) köşkün gece cephesi (`public/photos/facade-night.webp`),
  alttan koyulaşan geçiş, "Köşkün bütün işleri tek ekranda." ve dört hap
  (Siparişler, Karaoke, Menü, Raporlar).
- Telefonda ve tablette fotoğraf formun üstünde kısa bir bant; yatay kaydırma
  yok (390 ve 360 px'te denendi). Fotoğraf iki öğenin CSS arka planıdır ve
  gizli olanınki indirilmez.
- Şifre alanında göz düğmesi (göster / gizle, `aria-pressed`) ve Caps Lock
  açıkken bir satır uyarı; doğru şifrenin reddedilmesinin iki yaygın
  sebebi. Alanın adı yalnız "Şifre" kalır (düğme etiketin dışında). Hatalı
  girişte e-posta yerinde kalır, şifre boşalır ve odaklanır (eskisi gibi).
- Kendi odak halkasını çizen alan (mavi kenar + 3 px yumuşak halka)
  panelin genel odak çizgisini almaz; haplarda çift halka oluyordu.

## Köşk durumu: saatlerden kendiliğinden

Operatör: _"köşk açık yoğun vs. durumunu da kaldır, belli aralık olan o
saatlerde otomatik çeksin"_.

- Üst çubuktaki köşk çipi ("Köşk: Açık / Yoğun / Kapalı", hızlı kayıt ve
  dakikalık yoklama) kaldırıldı: `venue-quick.tsx`, `venue-signal.ts`,
  `venue-quick-core.ts`, `saveVenueQuickAction`, `venueQuickSignalAction`.
- Açık/kapalı elle seçilmez. Canlı durum her kayıtta `manualOverride:
"auto"` yazar; migration `20261121120000_venue_open_by_hours.sql` kayıtlı
  satırı bir kez `auto`'ya döndürdü. Uygulamanın "Şu an açık"ı, kafe
  siparişi (`cafe_closed`) ve panel yalnız Ayarlar → Saatler'e bakar.
- Canlı durum sayfası açık/kapalıyı yalnız gösterir: şu anki durum, bir
  sonraki açılış ya da kapanış ("Kapanış 23:00", "Açılış yarın 09:00") ve
  haftanın saatleri; sahip "Saatleri düzenle" ile Ayarlar → Saatler'e gider.
  Masalar (boş / toplam) ve ortam (Wi-Fi, gürültü, priz, not) burada girilir.
- `/api/mobile/v1/live-status` değişmedi: alanlar aynı, `isOpen` zaten
  `manualOverride` + `weeklyHours` idi ve artık hep `auto`
  (`docs/API-MOBILE.md` §6 doğru kalır, lafmobil'e eşitleme gerekmez).
  Boş masa sayısı uygulamaya gitmeye devam eder; onu da kaldırmak
  uygulamanın sözleşmesini (lafmobil) ilgilendirir, ayrı bir iştir.

## Arama

Operatör: _"arama kısmını yapay zeka gibi yapma daha farklı yap basit yap"_.

- Üst çubukta geniş gri hap ve "Sipariş, müşteri ya da sayfa ara" satırı
  yerine küçük, beyaz, ince çizgili bir kutu: büyüteç ve "Ara". Telefonda
  yuvarlak gri büyüteç düğmesi.
- Açılan liste düz: başlıklar "Son açılanlar", "Sayfalar", "Oluştur",
  "Ayarlar içinde", kayıt türünün adı ("Siparişler"), "Tercihler"
  ("Komutlar" ve "Kayıtlar · …" değil); seçili satır gri, renkli vurgu ve
  odakta mavi parlama yok. Yer tutucu "Ara" ya da "Yeni kayıt türü" ("Ne
  oluşturulsun?" değil). ⌘K / Ctrl K aynen çalışır.

## Kararlar (kaynaktan bilinçli sapmalar)

- **Rozet yazısı koyu ton.** Kaynağın açık rozet yazıları (ör. `#25c166`
  `#defde2` üstünde 2.1:1) okunmuyordu; zemin kaynaktaki gibi, yazı koyusu.
- **Alan çerçevesi koyu.** Kaynak `#dbdbe1` çiziyor (beyazda 1.4:1); beyaz
  kartta boş bir alan kayboluyordu. `#a3a5b2` (2.5:1), işletim sisteminde
  "daha fazla karşıtlık" açıksa `#7d7f8c`.
- **İkincil gri bir ton koyu** (`#636575`, kaynakta `#717383`): gri
  haplarda da 4.5:1.
- **Kart çizgisi var** (kaynakta yok): beyaz kart `#f7f7f7` kanvasta
  parlak ekranda kayboluyordu.
- Sayfa düzenleri (üç bölgeli kayıt sayfaları, hızlı bakış çekmecesi,
  oluşturma sihirbazları, liste araç çubuğu) Innex döneminden aynen kaldı;
  yalnız görünüşleri değişti (`docs/ADMIN.md` "Innex düzenleri").

## Değiştirirken

- Renk ve ölçü token'dan (`var(--admin-…)`); bileşene onaltılık renk yazma.
- Kontrol haptır; kart ve kutu köşesi 24 / 16 (`rounded-xl` / `rounded-lg`
  panelde bu değerlere çevrilir).
- Ekranda tek mavi düğme; öbürleri ikincil ya da sessiz.
- Değişiklikten sonra 1440, 1280 ve 390 px'te gerçek tarayıcıda bak.
