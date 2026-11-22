# BRAND - L'Affogato marka kimliği

> Bu belge **web sitesinin** görsel kimliğidir. Değerlerin tek kaynağı
> `src/styles/foundation.css` içindeki `:root` bloğu, yazı yüzlerininki
> `src/app/layout.tsx`'tir; buradaki her değer oradan okunmuştur. Belge ile
> kod çelişirse **kod doğrudur** ve bu belge güncellenir.
>
> **21 Kas 2026 (operatör).** Önceki görünüm bütünüyle silindi. Site
> bluebottlecoffee.com'un tasarım dilini birebir alır; anasayfa
> goodboybob.com'daki gibi tam ekran bir filmle açılır. Operatörün sözleri,
> neyin alınıp neyin alınmadığı, yazı yüzü ve görsel lisansı politikası
> §0.6'dadır. Güncel değerler §0'da, kullanım kuralları §1-§4'te, logo §5'te.
> Site lafmobil'in paletini izlemez (5 Kas 2026'dan beri). Panel (`/admin`)
> bu değişiklikten etkilenmedi (aşağıda "Admin paneli görünümü").
>
> **Tarihçe olanlar.** Porselen (25 Eyl 2026), kafe-perakende (5 Kas 2026),
> Roast (11 Kas 2026) ve yolculuk (17 Kas 2026) görünümleri §9 "Geçmiş"te
> kısaltılmış olarak durur; o dönemlerin kuralları (tricolore çizgisi,
> sahneler, çizimler, maskeden yükselen yazı, three.js çizimleri, yolculuk)
> artık uygulanmaz. "Admin paneli görünümü" bölümü 22-23 Eki 2026 metniyle
> aynen korunur: içindeki site sesi ("Plus Jakarta Sans / Abril Fatface") ve
> `tests/admin-ui-kit.test.ts` atfı tarihçedir. 21 Kas 2026'dan beri panelin
> site önizlemesi sitenin yeni seslerini (Geist, Archivo), basılı masa
> kartları Geist'i okur.
>
> **Nöbetçi test yok.** Paleti ve okunabilirliği tutan
> `tests/brand-theme.test.ts` ile `tests/contrast.test.ts`, `tests/`
> klasörüyle birlikte 16 Kas 2026'da kalktı. §0.2'deki oranlar elle
> hesaplandı; kurallar kod incelemesiyle korunur (§8).

---

## 0. 21 Kas 2026 - güncel değerler

Dil tek cümlede: beyaz sayfa ve kırık beyaz bant, siyah mürekkep ve tek gri,
her dolu kontrol ile footer için tek kömür; kare köşe, kılçizgi, gölge yok;
başlık, menü, fiyat ve etiket geniş bir groteskle aralıklı büyük harf, cümle
ve kontrol yansız bir groteskle.

### 0.1 Renk

| Token             | Değer                       | Rol                                                                                                                                                                |
| ----------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--bg`            | `#ffffff`                   | Sayfa zemini.                                                                                                                                                      |
| `--band`          | `#f6f6f3`                   | **Bant**: sırayla gelen bölümler (`.section--band`), duyuru satırı ve üst çubuk, ürün fotoğrafının zemini, fotoğrafsız kutu, sepet çekmecesi, seçili arama satırı. |
| `--surface`       | `#ffffff`                   | Kart, açılır panel, pencere, alan.                                                                                                                                 |
| `--ink`           | `#000000`                   | Metin, başlık, ikon, odak çizgisi.                                                                                                                                 |
| `--muted`         | `#6c6864`                   | **Tek gri**: ikincil satır, ipucu, meta, üstü çizili fiyat.                                                                                                        |
| `--charcoal`      | `#333333`                   | **Kömür**: her dolu kontrol (düğme, seçili çip, sepet sayacı, onay kutusu), seçim vurgusu, footer ve koyu bloklar.                                                 |
| `--charcoal-deep` | `#1f1f1f`                   | Dolu düğmenin üzerine gelme hâli.                                                                                                                                  |
| `--on-dark`       | `#ffffff`                   | Koyu zeminde metin, kenar ve odak çizgisi.                                                                                                                         |
| `--on-dark-muted` | `rgba(255, 255, 255, 0.72)` | Koyu zeminde ikincil satır (kömürün üstünde `#c6c6c6` okunur).                                                                                                     |
| `--line`          | `#dcdcd6`                   | Kılçizgi: satır arası, kutu çevresi, panel kenarı.                                                                                                                 |
| `--line-strong`   | `#333333`                   | Kontrol kenarı: düğme, çip, süzgeç etiketi, kutulu ikon düğmesi.                                                                                                   |
| `--error`         | `#b42318`                   | Hata metni ve kenarı. Durum rengidir, marka değil.                                                                                                                 |
| `--success`       | `#1f6b4a`                   | Olumlu durum ("kaydedildi", "onaylandı"). Durum rengidir, marka değil.                                                                                             |

`--scheme-*` değerleri, `/odeme`'deki kart şeması işaretlerinde
(`scheme-marks.tsx`) şemaların kendi renkleridir; başka yerde kullanılmaz.

### 0.2 Ölçülmüş kontrast

Oranlar 22 Kas 2026'da yukarıdaki hex değerlerinden WCAG 2.x göreli parlaklık
formülüyle hesaplandı. Saydam renk önce zeminine karıştırıldı; sonuç iki
haneye **aşağı** kesildi ki bir oran eşiğin üstüne yuvarlanmasın. Eşikler:
normal metin 4.5:1, büyük metin (24px ve üstü, ya da 18.66px ve üstü kalın)
3:1, bir kontrolün sınırı ve odak göstergesi 3:1 (WCAG 1.4.11).

**Açık zeminde metin**

| Metin                         | Beyazda (`--bg`) | Bantta (`--band`) | Nerede                                                      |
| ----------------------------- | ---------------- | ----------------- | ----------------------------------------------------------- |
| `--ink` `#000000`             | 21.00:1          | 19.39:1           | Bütün metin, üst çubuk                                      |
| `--muted` `#6c6864`           | 5.52:1           | 5.10:1            | İkincil satır, ipucu, meta                                  |
| `--charcoal` `#333333`        | 12.63:1          | 11.66:1           | Ödeme ve hesapta kömürle yazılan etiketler, damga rakamları |
| `--error` `#b42318`           | 6.57:1           | 6.07:1            | Alan hatası, hata bildirimi, durum etiketi                  |
| `--success` `#1f6b4a`         | 6.44:1           | 5.94:1            | Olumlu bildirim, durum etiketi                              |
| uyarı `#8a5a00` (token değil) | 5.92:1           | 5.47:1            | Karaoke'nin durum etiketi ve bildirimi (`karaoke.css`)      |

**Koyu zeminde ve yıkamada metin**

| Metin                         | Zemin                        | Oran    | Nerede                                    |
| ----------------------------- | ---------------------------- | ------- | ----------------------------------------- |
| `--on-dark` `#ffffff`         | `--charcoal` `#333333`       | 12.63:1 | Dolu düğme, seçili çip, footer, koyu blok |
| `--on-dark`                   | `--charcoal-deep` `#1f1f1f`  | 16.48:1 | Dolu düğmenin üzerine gelme hâli          |
| `--on-dark-muted` (`#c6c6c6`) | `--charcoal`                 | 7.39:1  | Footer notları, koyu bloktaki paragraf    |
| `#ffb4a8` (token değil)       | `--charcoal`                 | 7.42:1  | Footer'da bülten hatası (`chrome.css`)    |
| `--error`                     | kendi %10 yıkaması `#f8e9e8` | 5.57:1  | Kayıtlı kartlarda hata notu               |
| `--success`                   | kendi %10 yıkaması `#e9f0ed` | 5.56:1  | Kayıtlı kartlarda bilgi notu              |

Bütün metin çiftleri normal metnin eşiğini (4.5:1) geçer; büyük metin
eşiğine yaslanan çift yoktur. Koyu zeminde kömür (1.00:1), siyah (1.66:1) ve
`--muted` (2.28:1) metin olamaz.

**Metin olmayan**

| Öğe                 | Renk                              | Zemin                | Oran                    | Not                                                                                                                                                    |
| ------------------- | --------------------------------- | -------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kontrol kenarı      | `--line-strong` `#333333`         | beyaz                | 12.63:1                 | Düğme, çip, süzgeç etiketi                                                                                                                             |
| Odak çizgisi (2px)  | `--ink`; koyu zeminde `--on-dark` | beyaz · bant · kömür | 21.00 · 19.39 · 12.63:1 |                                                                                                                                                        |
| Alan kenarı         | `#b9b9b3` (token değil)           | beyaz                | 1.97:1                  | **3:1'in altında.** Alanı etiketi ve yeri tanıtır, odakta kenar siyaha döner (21:1); yükseltilmesi açık iş (panel aynı yerde `#898d94` ile 3:1 tutar). |
| Kılçizgi            | `--line` `#dcdcd6`                | beyaz · bant         | 1.37 · 1.27:1           | Yalnız ayırıcı; bir kontrolün tek sınırı olmaz.                                                                                                        |
| Bant ile beyaz      | `#f6f6f3`                         | beyaz                | 1.08:1                  | Zemin değişimi, sınır değil.                                                                                                                           |
| Ödeme sonucu rozeti | beyaz işaret                      | `--success`          | 6.44:1                  | `.order-done-badge`                                                                                                                                    |
| "Açık" noktası      | `#2f9e6a` (token değil)           | beyaz · kömür        | 3.37 · 3.74:1           | Süs: anlamı yanındaki sözcük taşır (`.open-line`).                                                                                                     |

Anasayfa filminin başlığı ve bağlantısı beyazdır ve karenin üstünde durur;
yüksekliğin alt %40'ında %42 siyahtan saydama inen gölge ve hafif bir yazı
gölgesi onu tutar. Oran kareye göre değiştiği için sabit bir değer verilemez:
yeni klip seçerken alt kısmı koyu ya da orta tonda olmalı.

### 0.3 Yazı

İki ses, ikisi de `next/font/google` ile kendi sunucumuzdan, Türkçe için
`latin-ext` ile (`src/app/layout.tsx`):

- **Archivo** (başlık sesi; `--headline`, değişken adı `--font-headline`):
  genişliği ve ağırlığı değişken bir grotesk. Sitede hep
  `font-variation-settings: "wdth" 118` (`--headline-wdth`), 400, büyük harf
  ve 1.6px harf aralığı (`--track`) ile yazılır.
- **Geist** (metin sesi; `--sans` = `--display` = `--serif`, değişken adı
  `--font-display`): değişken, yansız bir grotesk.
- `--mono`: sistemin eş genişlikli yazısı (promosyon kodu gibi karakter
  karakter okunan yerler).

next/font değişken adları (`--font-display`, `--font-headline`) eskisi gibi
kaldı, çünkü panelin site önizlemesi onları okur; panel kendi kökünde aynı
token'ları Inter'e yönlendirir (değişmedi).

| Sınıf                   | Ses                 | Boyut / satır                                      | Nerede                                                           |
| ----------------------- | ------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| `.t-display`            | Archivo             | 24/32px (768px altında 20/28)                      | Sayfa ve bölüm başlığı; eski `.h1`, `.h2`, `.section-title` aynı |
| `.t-display--xl`        | Archivo             | `clamp(28px, 3.4vw, 40px)` / 1.15                  | Tek büyük başlık                                                 |
| `.t-display--quiet`     | Geist, aralık 2.4px | 24/32px                                            | Ortalanmış sakin bölüm başlığı                                   |
| Film başlığı            | Archivo             | `clamp(24px, 2.6vw, 32px)` / 1.2                   | Anasayfa filmi (`.hero-film-title`)                              |
| `.t-title`              | Archivo             | 16/22px                                            | Kart başlığı; eski `.h3` aynı                                    |
| `.t-nav`                | Archivo             | 16/22px (1280-1439px'te 14px, aralık 1.2px)        | Üst çubuğun bağlantıları                                         |
| `.t-price`              | Archivo             | 14/20px, satır kırılmaz (kart başında kırılabilir) | Fiyat                                                            |
| `.t-label`, `.t-kicker` | Archivo             | 12/24px (eski `.eyebrow` 12/20)                    | Üst etiket, etiket, footer sütun başlığı                         |
| `.t-body`               | Geist               | 16/22px (`body` 16px / 1.5; `.lede` 16/24)         | Cümle                                                            |
| `.t-small`              | Geist               | 14/20px                                            | Küçük satır; `.t-muted` ile gri                                  |
| `.t-micro`              | Geist               | 12/16px                                            | Duyuru satırı, dipnot                                            |
| `.btn`                  | Geist               | 16/22px, cümle düzeni                              | Düğme etiketi                                                    |

Küçük istisnalar: durum etiketi (`.status-chip`) Archivo 11px, aralık 1.2px;
çerez kartının küçük başlıkları 13-14px; footer'daki "L'Affogato" yazısı
Archivo 600, 14px (başlık sesinin 400 olmayan tek yeri).

### 0.4 Kontroller

- **Düğme** (`.btn`): 48px yüksek, iç boşluk 12px 36px, 1px kömür kenar,
  köşe 0; beyaz zemin, siyah etiket, üzerine gelince kömür dolar.
  **`.btn-dark`** (= `.btn-primary`; eski adlar `.btn-ink`, `.btn-amber`):
  kömür dolu, beyaz etiket, üzerine gelince `--charcoal-deep`; sayfanın asıl
  eylemi, geri kalan eylemler çerçeveli `.btn`. **`.btn-light`** (= eski
  `.btn-glass-dark`): koyu zeminde saydam, beyaz kenarlı. **`.btn-wide`**: en
  az 350px, 768px altında tam satır. **`.btn-block`**: tam genişlik.
  **`.btn-sm`**: 36px, 14px. Eski
  adlar `.btn-ghost`, `.btn-outline`, `.btn-glass` çerçeveli beyaz düğmedir,
  `.btn-lg` 52px. Pasif düğme %45 opaklıktadır; bekleyen düğme `aria-busy`
  taşır ve üç nokta gösterir (`BusyDots`). Etiketlerde kalan çizili ok
  (`.arrow`) düğmede gizlenir: etiket zaten söyler.
- **Çip** (`.chip`): sitedeki tek hap biçimli kontrol. 36px, 1px kömür kenar,
  14px; seçiliyken ya da geçerli sayfadayken (`aria-pressed`, `aria-current`,
  `.is-active`) kömür dolu. Telefonun hızlı bağlantıları ve kategori çipleri.
- **Süzgeç etiketi** (`.tag`): kare, 32px, 12px (aramanın üst kategorileri).
- **İkon düğmesi** (`.icon-btn`): 44px kare dokunma alanı, 20px ikon, 1.3
  çizgi; `.icon-btn--boxed` 32px, 1px kömür kenarlı kutu (kapat, oklar).
- **Altı çizili bağlantı** (`.link-u`): 14px; çizgi 1px kalınlıkta ve 4px
  aşağıda, üzerine gelince 2px ("Tümünü gör", "Devamını oku").
- **Alan** (`.input`, `.select`, `.textarea`): 48px (metin alanı 112px), iç
  boşluk 12px 14px, 1px `#b9b9b3` kenar, köşe 0, 16px yazı; odakta kenar siyah
  ve içe 1px siyah çizgi, hatada `--error` kenar. Etiket 14px
  (`.field-label`), ipucu 14px gri (`.field-hint`), hata 14px `--error`
  (`.field-error`). Onay kutusu ve radyo 18px, `accent-color` kömür.
- **Odak:** 2px siyah çizgi, 2px dışarıda; koyu zeminde (`data-ground="dark"`,
  `.on-dark`, `.site-footer`) beyaz.

### 0.5 Yerleşim

| Token          | Değer                         | Anlam                                                         |
| -------------- | ----------------------------- | ------------------------------------------------------------- |
| `--gutter`     | `clamp(20px, 4.2vw, 60px)`    | Yan boşluk: telefonda 20px, geniş ekranda 60px                |
| `--section-y`  | `clamp(56px, 6.7vw, 96px)`    | Bölümün üst ve alt boşluğu                                    |
| `--content`    | `1320px`                      | İçerik genişliği (`.wrap`); uzun metin 880px (`.wrap-narrow`) |
| `--header-h`   | `84px`, 1024px altında `56px` | Üst çubuk                                                     |
| `--announce-h` | `32px`                        | Duyuru satırı                                                 |

- Bölüm başlığı ile içerik arası 32px (`.section-head`), bölüm sonundaki
  düğmenin üstü 48px (`.section-foot`).
- Kart sırası dört sütun, 24px aralık; mağaza ızgarası üç sütun (menü dört),
  48px satır ve 16px sütun aralığı; 1024px altında ikisi de iki sütun.
- Footer üstten 96px, alttan 36px (600px altında üstten 56px).
- **Kırılımlar.** 1280px: geniş gezinme ve açılır panel; altında hamburger ve
  tam boy sayfa. 1024px: çubuk 84px'ten 56px'e iner; altında hızlı bağlantı
  çipleri, kartın altındaki düğme, iki sütunlu ızgara, footer'ın tek sütunlu
  ana bölümü. 768px: telefon; başlık 20/28, geniş düğme tam satır, kartta
  fiyat başlığın üstünde, sayfa fotoğrafı 4:3, filmin dik kesimi. 600px:
  footer sütunları tek sütun. Ödeme ve üye alanından taşınan kurallarda ek
  kırılımlar kalır (540-960px).
- Sayfa yatay kaymaz (`body` `overflow-x: hidden`; alanlar `min-width: 0`).

### 0.6 Referanslar ve lisanslı yüzler

Operatörün sözleri, 21 Kas 2026 (verildiği gibi):

1. _"sitedeki tüm ölü cssleri sil ve sana tasarım verecğeim hatta tüm tasarım
   dosyalarını vs. temizle sna yeni tasarım örneği atacağım site ordan tek tek
   çekeceksin"_; seçtiği yol _"Sıfırla, iskelet kalsın"_.
2. _"burdaki herodaki videoyu birebir çek kullan https://goodboybob.com/ ve bu
   site tasarımını da birebir al bize uygun olan görselleri de çek marka
   belirtilmeyen premiuum olsun her şeyi birebir uyarla ve bizde olan
   özellikleri de bu tasarımlara göre yap https://bluebottlecoffee.com/us/eng
   ... tasarımdaki overlapler testler vs. yaptıktan sonra karaoke sayfasının
   wizardını falan ona göre ayarla ve mobil versiyonlarına da aşırı dikkat
   et."_
3. _"sen benim yaptığımı sil sana verdiğim sitelerdeki ile birebir git 1:1
   lütfen bendeki her tasarımı sil elementi verdiklerimden al ve onlarla
   uyumlu git olmayanlrı da sana attığım bluebotter sitesi ile uyumlu
   oluştur."_

**Alınan:** bluebottlecoffee.com'un tasarım **dili**: yerleşim, yazı ölçeği
ve yazının işlenişi (geniş groteskle aralıklı büyük harf başlık, yansız
groteskle cümle), boşluklar, bileşenler (duyuru satırı, logosu ortada üç
bölümlü çubuk ve açılır panel, kare düğmeler, kart ve kutu sıraları,
çekmeceler) ve etkileşimler. goodboybob.com'dan anasayfanın tam ekran film
düzeni: solda altta küçük başlık, sağda altta altı çizili bağlantı.
Referanslarda karşılığı olmayan özelliklerimiz (kafe menüsü, karaoke
sihirbazı, kampanyalar, rehberler, masa QR sayfası, üye alanı) aynı dille,
Blue Bottle'a uyumlu kuruldu (3. söz).

**Alınmayan ve neden:** referans şirketlerin varlıkları onlarındır. Good Boy
Bob'un hero filmleri, Blue Bottle'ın fotoğrafları, logosu ve şişe işareti,
metinleri ve lisanslı yazı yüzleri (Blue Bottle, Dinamo'nun ABC Marfa ve ABC
Diatype yüzlerini ticari lisansla kullanır) kopyalanmadı. Operatör videoyu
"birebir" istedi; o filmin hakkı sahibinde olduğu için aynı yerde lisanslı
stok film durur (§6). "Marka belirtilmeyen" isteği de böyle karşılandı:
filmde ve fotoğraflarda başka bir markanın adı ya da işareti yoktur. Politika
öncekilerle aynıdır: 11 Kas 2026'daki Roast referans sayfadan yalnız
oranları aldı, 17 Kas 2026'daki yolculuk filmi promptun son karesini başka
bir firmanın logosu olduğu için kullanmadı.

**Yazı yüzleri:** Archivo ve Geist açık lisanslıdır (SIL Open Font License
1.1) ve referansın yüzleriyle aynı yapıdadır: geniş bir grotesk ile yansız
bir grotesk. Lisanslı bir yüz (ABC Marfa, ABC Diatype ya da başka ticari bir
yüz) web lisansı satın alınmadan ve buraya yazılmadan eklenmez.

**Görseller:** sitedeki her fotoğraf ve film ya bizimdir ya lisanslıdır;
künyeleri `docs/MEDIA-LICENSES.md`'de. Bir referans siteden görsel, film ya
da metin çekilmez.

---

## 1. Renk

- **İki zemin.** Sayfa beyazdır; bant (`--band`) ikinci zemindir ve bölümleri
  sırayla taşır. Bant beyazdan yalnız 1.08:1 ayrılır: bir zemin değişimidir,
  kenar değil. Bir kutuyu ayırmak gerekiyorsa kılçizgi (`--line`) çizilir.
- **Tek mürekkep, tek gri.** Metin siyahtır, ikincil satır `--muted`. Başka
  gri metin yazılmaz; `--line` metin değildir.
- **Tek kömür.** Dolu olan her şey kömürdür: düğme, seçili çip, sepet sayacı,
  onay kutusu, `::selection`, footer ve koyu bloklar. Kömür bir eylemi ya da
  bir bloğu taşır, süs olmaz.
- **Koyu zeminde** metin yalnız `--on-dark` ve `--on-dark-muted`'tır. Koyu blok
  `data-ground="dark"` taşır; odak çizgisi orada beyaza döner.
- **Durum renkleri marka değildir.** `--error` hata, `--success` olumlu durum;
  metin, ince kenar ya da %10 yıkama
  (`color-mix(in srgb, var(--success) 10%, var(--surface))`) olarak
  kullanılır. Tek dolu kullanım ödeme sonucu rozetidir. "Kapalı" kırmızı
  yazılmaz: gri nokta ve sözcük.
- **Başka renk yok.** Krem, amber, karamel, espresso kahvesi, bordo, marka
  yeşili ve cam 21 Kas 2026'da emekli oldu; pirinç yalnız logonun çekirdeğinde
  kalır (§5). Rengi fotoğraf ve film taşır, arayüz taşımaz.
- **Saydamlık** `color-mix()` ile token'dan türetilir. Bugün elle yazılı
  birkaç `rgba()` kalır: perde (`rgba(0, 0, 0, 0.4)`: sepet, arama, filtre,
  hızlı bakış, çerez tercihleri), filmin alt gölgesi ve kontrolleri, footer'ın
  iki ayırıcı çizgisi, rehber fotoğrafının künye şeridi, vitrin noktaları.
  Tek degrade anasayfa filminin alt gölgesidir.

**Token dışında elle yazılmış değerler** (22 Kas 2026'da kodda; yenisi
eklenmez, dokunan iş onları token'a taşır):

| Değer                | Nerede                                                                         | Not           |
| -------------------- | ------------------------------------------------------------------------------ | ------------- |
| `#b9b9b3`            | Alan kenarı (`.input`, `.select`, `.textarea`; arama ve karaoke alanları)      | 1.97:1 (§0.2) |
| `#8a5a00`            | Karaoke'de uyarı tonu (`.status-chip.tone-warn`, `.karaoke-mine-notice--warn`) | 5.92:1        |
| `#ffb4a8`            | Footer'da bülten hatası                                                        | 7.42:1        |
| `#2f9e6a`            | "Açık" noktası (`.open-line.is-open::before`)                                  | Süs           |
| `#b8893a`, `#cba258` | Logonun çekirdeği (`chrome.css`)                                               | §5            |
| `#111112`, `#2c2c2e` | Hesap sayfasındaki çizilmiş telefon çerçevesi (`.app-phone`)                   | Süs           |

---

## 2. Tipografi

- **İki ses, iki rol.** Archivo bir şeyin adını söyler: sayfa ve bölüm
  başlığı, kart başlığı, menü bağlantısı, fiyat, üst etiket, rozet, durum
  etiketi. Geist cümleyi söyler: paragraf, düğme etiketi, form, hukuk metni,
  küçük satır. Düğme etiketi Geist'tir ve **cümle düzenindedir** ("Sepete
  ekle"), büyük harf değil.
- **Başlık sesi hep büyük harf, hep 400, hep aralıklı.** Büyük harf CSS'ledir
  (`text-transform: uppercase`), markup cümle düzeninde kalır; Türkçe büyük
  harf (i → İ, ı → I) `<html lang="tr">`'den gelir. Hiyerarşi ağırlıkla değil
  boyutla kurulur; tek istisna footer'daki "L'Affogato" yazısıdır (600).
  Genişlik her başlık sınıfında `--headline-wdth` ile verilir; başlık sesini
  sınıfsız yazan bir kural da
  `font-variation-settings: "wdth" var(--headline-wdth)` yazmalıdır, yoksa
  Archivo dar (100) çizilir.
- **Metin 400.** Ödeme ve üye alanından taşınan kurallarda 600-700 ağırlıklı
  küçük etiketler kalır (yerleşim korunarak taşındı); yeni yazılan kural
  ağırlıkla değil boyut ve sesle ayrışır.
- **Satır aralığı geniştir** (başlıkta 24/32): Türkçe büyük harflerin
  işaretleri (İ Ö Ü Ğ üstte, Ç Ş altta) sıkışmaz.
- **Rakamlar:** fiyat, saat ve sayaç `.tabular` (tablo ve hizalı rakam)
  taşır.
- **Başlıkta nokta yok.** `h1`-`h3` noktayla bitmez (operatör, 26 Eyl 2026);
  gövde metni noktalamasını korur, tescilli slogan "Drink it. Eat the cup."
  kendi iç noktalarını korur. Bunu tutan test 16 Kas 2026'da kalktı; kural
  elle korunur.
- **Tire:** arayüz metninde uzun tire (U+2014) ve orta tire (U+2013)
  kullanılmaz, düz tire (`-`) kullanılır. Bu, API'nin döndüğü etiketler için
  de geçerlidir.
- **Hukuki asgari ölçü:** ön bilgilendirme ve sözleşme metni en az 16px
  okunur (MSY m.6/1, 12 pt = 16 CSS px; `foundation.css` "Legal minimums":
  `.checkout-consent label`, `.checkout-consent-note`, `.legal-section p`,
  `.legal-bullets li`, `.legal-ordered li`, `.karaoke-preinfo`). Her form
  alanı 16px'tir (iOS Safari daha küçük alana odakta yakınlaşır). Tasarım
  bunları değiştirmez.

**Uygulamadan ayrışma.** lafmobil Poppins (gösterim) ve Inter (okuma) ile
yazar. Site 25 Eyl 2026'da onu izledi, sonra operatör kararlarıyla ayrıştı:
11 Eki 2026 tek ses Poppins, 14 Eki 2026 Gabarito ve Poppins, 5 Kas 2026
yeniden tek ses Poppins, 11 Kas 2026 Abril Fatface ve Plus Jakarta Sans
(17-21 Kas 2026 arası anasayfanın yolculuğunda ayrıca Instrument Sans ve
Instrument Serif), 21 Kas 2026 Archivo ve Geist. Uygulamanın izlemesi ayrı
bir karar ve lafmobil'de ayrı bir iştir.

---

## 3. Yüzey ve yerleşim

- **Kare köşe.** Kutu, düğme, alan, kart, çekmece ve pencere
  `border-radius: 0` taşır. İstisnalar: çip (hap) ile nokta, sayaç ve ödeme
  sonucu rozeti (daire).
- **Gölge, bulanıklık ve degrade yok.** Kutuyu kılçizgi ya da zemin değişimi
  ayırır. Alanın odak hâli içe 1px siyah çizgidir (`box-shadow: inset`),
  gölge değil. Tek degrade filmin alt gölgesi, tek yazı gölgesi film
  başlığının hafif gölgesidir.
- **Kılçizgi** satırları ve kutuları ayırır (`--line`, 1px); kontrolün kenarı
  kömürdür (`--line-strong`).
- **Fotoğraf kutusu** (`.media`): fotoğraf kutuyu doldurur
  (`object-fit: cover`; menü fotoğrafı kesilmesin diye `contain`). Fotoğraf
  yoksa kutu bant zemininde boş kalır, yerine çizim konmaz (`visuals.tsx`:
  `ProductSurface`, `MenuPlate`). Oranlar: `.ratio-5-4` (ürün kartı),
  `.ratio-1`, `.ratio-4-3`, `.ratio-3-2`, `.ratio-16-9`, `.ratio-6-5`.
- **Rozet** (`.badge`): fotoğrafın sağ üst köşesinde beyaz, 12px küçük
  etiket ("Yeni", "Öne çıkan", "Tükendi", "Son 3").
- **Ritim:** bölümler `--section-y` ile nefes alır; beyaz ve bant sırayla
  gelir (`.section--band`).

---

## 4. Bileşenler

| Parça                              | Dosya                                         | Ne yapar                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Duyuru satırı (`.announce`)        | `chrome.tsx`                                  | Çubuğun üstünde 32px bant, 12px: "Her siparişte damga topla \| Kampanyalar".                                                                                                                                                                                                                                                                                                                                                                                       |
| Üst çubuk (`.site-header`, `.nav`) | `chrome.tsx`, `chrome.css`                    | Bant zemininde, yapışkan; 84px (1024px altında 56px). Solda dört büyük harf bağlantı (Menü, Mağaza, Karaoke, Ziyaret & keşfet), ortada L'Af, sağda arama, hesap ve sepet (44px; sayaç kömür hap). Bağlantının altı çizilir: üzerine gelince, paneli açıkken ve geçerli sayfada.                                                                                                                                                                                    |
| Açılır panel (`.nav-panel`)        | `chrome.tsx`                                  | Yalnız 1280px ve üstünde, Menü, Mağaza ve Ziyaret & keşfet'in üzerine gelince: tam genişlik, beyaz, üstte ve altta kılçizgi; solda "Tüm …" bağlantısı ve üç sütun bağlantı, sağda 4:3 bir fotoğraf ve kapısı. Klavye, bağlantının yanındaki odakta görünen okla açar.                                                                                                                                                                                              |
| Telefonun gezinmesi                | `chrome.tsx`                                  | 1280px altında hamburger ve çubuğun altından tam boy beyaz sayfa (60px satırlar, kılçizgi, açılır alt listeler); 1024px altında çubuğun altında yana kayan çipler (Menü, Karaoke, Mağaza, Kampanyalar).                                                                                                                                                                                                                                                            |
| Footer (`.site-footer`)            | `chrome.tsx`                                  | Kömür zemin, beyaz yazı: işaret ve "L'Affogato" yazısı; dört sütun (Keşfet, Ziyaret, Üyelik, Kurumsal); bülten (alt çizgili alan ve ok; onay kutusu işaretsiz); sosyal hesaplar; kategori kapıları (Menüde, Mağazada); şirket bilgileri (ETHS m.5/1, 6563 m.3/1); alt satır. Kampanyalar ana menüde değildir: duyuru satırında, ziyaret panelinde, telefonun çiplerinde ve footer'da durur.                                                                        |
| `<PageHero>`                       | `page-hero.tsx`                               | Anasayfa dışındaki her sayfanın açılışı: geniş fotoğraf (3.2:1, en çok 560px; telefonda 4:3), altında beyazda üst etiket, büyük harf başlık ve bir paragraf. Fotoğrafsız sayfa (hukuk) yalnız başlıkla açılır. Props: `eyebrow`, `title`, `lede`, `image`, `children`.                                                                                                                                                                                             |
| Anasayfa filmi (`<HomeHero>`)      | `home-hero.tsx`, `home.css`                   | Çubuğun altında tam ekran film, sırayla üç klip; solda altta başlık, sağda altta bağlantı, 01/02/03 sayfalayıcı ve durdur düğmesi (§6, §7).                                                                                                                                                                                                                                                                                                                        |
| Ürün kartı (`<ProductCard>`)       | `ui.tsx`, `sections.css`                      | 5:4 fotoğraf bant zemininde, rozet; başlık ve fiyat aynı satırda (768px altında fiyat başlığın üstünde; menü kartının M / L fiyatları her genişlikte başlığın altında), altında küçük gri satır. İndirimde üstü çizili eski fiyat ve indirimin günleri (Ticari Reklam Yön. m.14/1). Üzerine gelince fotoğraf 1.03 büyür. Geniş ekranda kart hızlı bakışı açar; kartın altındaki kömür düğme ("Sepete ekle" ya da "Seçenekleri gör") yalnız 1024px altında görünür. |
| Izgaralar                          | `sections.css`, `catalog.css`                 | Kart sırası dört sütun (`.card-row`); mağaza üç, menü dört (`.product-grid`, `.product-grid--4`); 1024px altında iki.                                                                                                                                                                                                                                                                                                                                              |
| Bölüm kalıpları                    | `sections.css`                                | Split (bantta metin, kenara taşan fotoğraf), feature, dört kare kutu, çizgili liste, rakam sırası, galeri, yer kartları, gönderi kartları (kampanyalar), alıntı kartları, adım kartları, rehber kutuları.                                                                                                                                                                                                                                                          |
| Ürün sayfası                       | `product-detail.tsx`, `catalog.css`           | Solda yapışkan galeri, sağda satın alma sütunu: adet, "Sepete ekle \| fiyat" kömür düğmesi, "Hemen satın al", akordeonlar.                                                                                                                                                                                                                                                                                                                                         |
| Çekmeceler ve paneller             | `ui.tsx`, `search-overlay.tsx`, `catalog.css` | Sepet çekmecesi (sağdan, bant zemini, her satırda ürünün fotoğrafı), arama paneli (üstten, beyaz), filtre sayfası (her genişlikte sağdan), hızlı bakış; perde siyah %40.                                                                                                                                                                                                                                                                                           |
| Çerez kartı                        | `cookie-consent.tsx`, `chrome.css`            | Altta beyaz şerit, üstte kılçizgi; tercih penceresi beyaz, anahtarları kare. Daha önce karar vermiş ziyaretçide hidrasyondan önce gizlidir.                                                                                                                                                                                                                                                                                                                        |
| Durum etiketi (`.status-chip`)     | `karaoke.css`                                 | Kare, 24px, Archivo 11px; olumlu, uyarı ve kötü tonları kenar ve metin rengiyle.                                                                                                                                                                                                                                                                                                                                                                                   |
| Canlı açık/kapalı (`.open-line`)   | `chrome.css`                                  | Nokta ve sözcük, asla yalnız renk: açıkken yeşil nokta, kapalıyken gri.                                                                                                                                                                                                                                                                                                                                                                                            |

**Anasayfanın sırası** (21 Kas 2026): film; "Şimdi barda" (canlı menüden
dört kart, fotoğraflılar önde); imza bölümü ("İçilir, sonra kupası yenir");
"Kategoriler" (dört kutu); "Evde L'Affogato" (öne çıkan, yoksa espresso,
yoksa ilk çekirdek ürün); "Karaoke odası" (paneldeki değerler ve bugünün boş
saatleri); "L'Affogato uygulaması"; "Rehberler" (iki rehber); "Bizi ziyaret
edin" (fotoğraflar, adres, canlı açık satırı); SSS. Panelin anasayfa
slaytları (`/admin/anasayfa-hero`) sayfada çizilmez (yolculuk döneminde de
çizilmiyordu).

---

## 5. Logo - L'Af

Operatör, 25 Eyl 2026: _"logomuz L'Af"_. İşaret uygulama ikonunun
harfleridir: **L + kahve çekirdeği kesme işareti + A + f**. Vektör
`public/brand/`:

- `laf-mark.svg` - tek parça (panelin kenar çubuğu ve giriş sayfası,
  `.brand-mark` maskesiyle)
- `laf-letters.svg` + `laf-bean.svg` - iki renkli kullanım için ayrı katmanlar

`<LafMark tone="…">` (`brand-mark.tsx`, kuralları `chrome.css` `.laf-mark`)
işareti iki CSS maskesiyle boyar; tek dosya, her zemin. 21 Kas 2026'dan beri
iki görünümü vardır: açık zeminde siyah harf ve koyu pirinç çekirdek, kömür
footer'da beyaz harf ve pirinç çekirdek.

| Ton     | Harfler             | Çekirdek  | Nerede                                                                                                                        |
| ------- | ------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `duo`   | siyah (`--ink`)     | `#b8893a` | Üst çubuk (44px, 1024px altında 32px), giriş ve ödeme kartları, bülten, doğrulama ve hesap silme sayfaları, `/odeme/app-hata` |
| `green` | siyah               | `#b8893a` | `duo` ile aynı; adı çağrı noktası için kaldı (aramanın sonuçsuz durumu)                                                       |
| `ink`   | siyah               | siyah     | Arama çubuğu: tek renk, sessiz                                                                                                |
| `cream` | beyaz (`--on-dark`) | `#cba258` | Kömür footer (28px, yanında "L'Affogato" yazısı)                                                                              |

İki pirinç olmasının nedeni: markanın pirinci `#cba258` kömürde 5.32:1
okunur, ama beyazda 2.37:1'e, bantta 2.19:1'e düşer ve sararıp kaybolur.
Açık zeminde onun bir ton koyusu `#b8893a` durur (beyazda 3.14:1, bantta
2.90:1; kömürde ise 4.02:1'de kalırdı). Logo, WCAG'ın kontrast şartından
muaftır (logotip); oranlar bir kural değil, seçimin gerekçesidir. İki değer
token değildir, `chrome.css`'te yazılıdır.

Uygulama ikonu (`public/brand/app-icon-*.png`, favicon, apple-icon)
uygulamanındır ve değişmedi: yeşil zemin, krem harfler, pirinç çekirdek;
maskelenebilir kesim işareti %80 dairenin içinde tutar. `global-error.tsx`
stil dosyası yüklenmemiş olabileceği için işareti satır içi SVG yolu olarak
basar (`laf-paths.ts`): bant zemininde siyah harf ve `#b8893a` çekirdek.

İşaret çarpıtılmaz, döndürülmez, kontur eklenmez; çevresinde en az çekirdek
genişliği kadar boşluk bırakılır.

---

## 6. Fotoğraf ve film

**Bizim fotoğraflarımız.** `public/photos/*.webp`: köşkün kendi fotoğrafları
(cephe gündüz ve gece, iç mekân, teras, ürün); PNG olarak geldiler (10.56
MB) ve WebP q82'ye çevrildiler (1.28 MB). `public/menu/*.webp`: menü kareleri
(kaynakları `docs/MENU-PHOTOS.md`). `public/rehber/`: rehber fotoğrafları
(künyeleri `src/lib/seo/guide-content.ts`). Yeni fotoğraf aynı yolu izler:
WebP, kutunun ihtiyacı kadar büyük.

**Lisanslı stok (21 Kas 2026).** Kaynak Mixkit (mixkit.co), "Mixkit Stock
Video Free License": ticari kullanım serbest, künye gerekmez, tek başına stok
olarak yeniden dağıtılamaz.

- **Anasayfa filmi:** üç klip, `public/video/hero-{1,2,3}-{wide,tall}.mp4`,
  ve her kesimin ilk karesinden `.webp` afişi (q78). Kahvede dönen krema,
  espresso makinesinden yakın döküm, fincanda latte yaprağı; 7.4-8 sn. H.264,
  24 fps, ses yok, faststart; geniş kesim 1920×1080, dik kesim (telefon)
  720×1280.
- **Sayfa açılış fotoğrafları:** `public/photos/hero-menu.webp`,
  `hero-shop.webp`, `hero-story.webp`, `hero-karaoke.webp`; Mixkit
  kliplerinden alınmış kareler, 1920×1080, WebP q80.
- Klip numaraları, kesim noktaları ve kullanılmayan ("Restricted" lisanslı)
  klipler `docs/MEDIA-LICENSES.md`'de.

**Ağırlık.** İlk klip geniş ekranda 1.29 MB, telefonda 0.98 MB; sonraki klip,
oynayan klibin yarısında istenir. Üç klip birden 3.54 MB (geniş) ve 1.87 MB
(dik), afişler 9-85 KB. Yerini aldığı yolculuk filmi 1.44 MB ve 1.17 MB idi.
Klip eklemeden ya da çözünürlüğü artırmadan önce bu rakama ve Vercel kullanım
sınırına bak (`CLAUDE.md` "Vercel kullanım sınırı").

**Kullanım.** Sayfa açılışı 3.2:1 (telefonda 4:3), ürün kartı 5:4 bant
zemininde, menü kartının fotoğrafı kesilmeden (`contain`), açılır panelin
resmi 4:3. Referans sitelerin görselleri kullanılmaz (§0.6).

**Kalan iki çizim dosyası.** `public/illustrations/karaoke-room.webp` ve
`karaoke-mic-cut.webp` durur: panelin anasayfa slaytları
(`src/lib/admin/home-hero-core.ts`; `HOME_SLIDES`) ve karaoke paylaşım kartı
(`src/lib/seo/og-pages.tsx`) okur. Sitede çizilmezler. Öteki 30 çizim 21 Kas
2026'da silindi (§9).

---

## 7. Hareket

- **Geçiş:** `--ease` = `cubic-bezier(0.25, 0.46, 0.45, 0.94)`, `--dur` 0.2s
  (zemin, renk, kenar). Basınca küçülme yoktur.
- **Anasayfa filmi** (`home-hero.tsx`): sunucu ilk afişi basar; sayfanın en
  büyük boyaması odur ve ekran hiç boş kalmaz. Film hidrasyondan sonra ve
  yalnız şu koşullarda oynar: azaltılmış hareket istenmemişse, veri tasarrufu
  (Save-Data) açık değilse, film ekrandaysa (en az %15'i) ve sekme
  görünürse. Telefon (768px altı) dik kesimi alır. Klip bitince sıradaki
  gelir, slaytlar 0.9 sn'de opaklıkla karışır; sonraki klip oynayanın
  yarısında indirilir. Durdur düğmesi ("Videoyu durdur" / "Videoyu oynat")
  filmi de slaytların dönüşünü de durdurur (WCAG 2.2.2). Azaltılmış harekette
  ve veri tasarrufunda afiş kalır ve düğme çizilmez; tarayıcı kendiliğinden
  oynatmayı reddederse (düşük güç modu) afiş kalır.
- **Mağaza vitrini** (panelin mağaza slaytları, `shop-hero-slider.tsx`): 6.5
  sn'de döner; üzerine gelince ve odakta durur, durdur, önceki ve sonraki
  düğmeleri vardır; azaltılmış harekette dönmez.
- Ürün fotoğrafı üzerine gelince 0.6 sn'de 1.03 büyür; bekleme işareti
  (`BusyDots`) üç noktayı sırayla yakar.
- `prefers-reduced-motion: reduce` altında sitedeki bütün geçiş ve
  animasyonlar durur (`foundation.css`).
- three.js, kaydırmayla oynayan film, maskeden yükselen yazı ve kaydırma
  gözlemcisi yoktur (21 Kas 2026). `three` paketi kullanılmadan
  `package.json`'da durur: kaldırmak kilit dosyasını değiştirir, ayrı bir
  iştir. Hareketli bir çizimi geri getirmek operatör kararı ister.

---

## 8. Değiştirirken

1. **Değer yalnız `src/styles/foundation.css :root`'ta değişir.** Çağrı
   noktasına hex yazma; bir tonun saydam hâli
   `color-mix(in srgb, var(--token) N%, transparent)` ile türetilir. §1'deki
   elle yazılmış değerler borçtur: dokunan iş onları token'a taşır, yenisi
   eklenmez.
2. **Kontrastı ölç ve §0.2'yi güncelle.** 16 Kas 2026'dan beri bunu tutan
   test yok: yeni ya da değişen her metin ve zemin çifti WCAG 2.x formülüyle
   hesaplanır (metin 4.5:1, büyük metin 3:1, kontrol sınırı ve odak 3:1).
   Saydam renk zeminine karışmış hâliyle ölçülür.
3. **Yazı yüzü yalnız `src/app/layout.tsx`'te değişir** (`next/font/google`,
   `latin-ext`); `--font-display` ve `--font-headline` adları kalır. Lisanslı
   yüz §0.6'ya tabidir.
4. **CSS'in yeri.** `src/app/globals.css` yalnız içe aktarımları, panelin
   geri alma kurallarını ve baskı kurallarını taşır. Sitenin kuralları alan
   alan `src/styles/`'tadır: `foundation.css` (token, temel, yazı, kontrol,
   yerleşim, medya, hukuki asgari ölçüler), `chrome.css` (işaret, duyuru
   satırı, çubuk ve paneli, telefon sayfası, footer, çerez kartı),
   `sections.css`, `home.css`, `catalog.css`, `pages.css`, `karaoke.css`,
   `checkout.css`, `account.css`. Yeni kural ait olduğu alanın dosyasına
   girer.
5. **Tasarımla değişmeyenler:** hukuki asgari ölçüler (§2), çerez kartının
   hidrasyon öncesi gizleme kuralı, işaretsiz başlayan onay kutuları, form
   `name`'leri ve sepetin biçimi (`docs/FRONTEND-SINIR.md`).
6. **CSS değişkeni çözemeyen yüzeyler paleti harfi harfine yazar.** Yeni
   palette olanlar: `src/app/layout.tsx` (`themeColor` `#f6f6f3`, bant) ve
   `src/app/global-error.tsx` (bant zemin, siyah ve gri yazı, kömür düğme,
   `#b8893a` çekirdek). `src/app/manifest.ts` 22 Kas 2026'da hâlâ Roast'ın
   kremi `#faf7f2`'yi yazıyor: yeni palete taşınacak. Eski porselen
   paletinde (logo yeşili) kalan ve ayrı taşınacak olanlar: işlemsel e-posta
   (`src/lib/email/templates/*.html`), bağlantı önizlemeleri
   (`src/lib/seo/og-card.tsx`), ödeme köprüsü
   (`src/lib/payment/paynkolay-page.ts`), `public/browserconfig.xml`
   (`#1d6d56` karo), JSON-LD ikonları (`public/icon-*.png`). Uygulama ikonu
   (`public/brand/app-icon-*.png`) uygulamanındır ve site görünümüyle
   değişmez.
7. **Görünüm operatörün kararıdır.** Bir değeri ya da referansı değiştirmek
   operatör kararı ister; yeni bir referans site gelirse §0.6 geçerlidir: dil
   alınır, varlık alınmaz.
8. **Çiz ve bak.** Görsel değişiklikten sonra sayfaları gerçekten çiz (360,
   768, 1024 ve 1280px ile geniş ekran); çakışma, taşma ve yatay kaydırma
   gözle yakalanır. Tam sayfa ekran görüntüsünde sabit çubuklar sayfanın
   ortasında görünebilir: bu bir yakalama kusurudur.
9. Bu belgeyi de güncelle.

---

## Admin paneli görünümü (Innex, 22 Eki 2026)

Bu belgedeki palet ve yazı yalnız **müşteri sitesi** içindir. Yönetim paneli
(`/admin`) operatör kararıyla (22 Eki 2026: _"İnnexe geç"_) Filllo'nun
Dribbble'daki **Innex** otel yönetim paneli serisinin tasarım sistemini
izler; ölçülmüş tarif `docs/ADMIN-INNEX.md`'de. 21 Eki 2026'da alınan
lafmaliyet AkmanOS teması bırakıldı; köşkün arka ofis paneli
(`RiosenBeq/lafmaliyet`) kendi temasında kalır.

- **Yerleşim:** gri uygulama zemini `#edeff1`; kenar çubuğu ve sayfa onun
  üstünde iki ayrı beyaz kart (köşe 12 px, pencereye 8 px, aralarında
  12 px). Kenar çubuğu 15.5rem (`--admin-side`; dar menü 4rem). Sayfa
  kartının ilk şeridi üst çubuk (yol, arama alanı, köşk, sipariş zili; bir ögenin
  sekmeleri varsa altı çizili sekmeler); altında sayfa başlığı şeridi
  (18 px yarı kalın başlık, 13 px gri açıklama, sağda düğmeler, kart boyu
  1 px çizgi). İçerik kartın sol kenarından başlar; genişlik sınırı
  (`PageShell`) bloklara uygulanır. Telefonda kart yok: beyaz sayfa ve alt
  sekme çubuğu.
- **Renk:** beyaz yüzey, soluk kuyu `#f9fbfc` (tablo başlığı, iç kutu),
  gri `#f3f5f7` (etkin menü satırı, sayaç, segment rayı); çizgi `#e8e8e8`,
  satır ayracı `#f2f2f2`, ikincil düğme kenarı `#e3e3e3`; mürekkep
  `#0c0e1b`, gövde gri `#3d4048`, etiket gri `#616367` (gri zeminde
  5.2:1). Birincil mavi `#2f58f7`: Innex'in `#325cff`'inin bir ton koyusu,
  çünkü o gri zeminde 4.43:1 kalıyor. Bağlantı ve odak halkası da bu mavi.
- **Durum tonları** açık zemin üstünde renkli metin; Innex'in yeşil ve
  turuncu metni zemininde ~2:1 olduğu için koyulaştırıldı (tarif §4):
  yeşil `#15803d` / `#e1faed`, turuncu `#b45309` / `#fff2e6`, kırmızı metin
  `#b42318` / `#feebed` (düğme `#dc2626`), bilgi camgöbeği `#0b7392` /
  `#eaf8fd`, vurgu mor `#6d3fea` / `#f6f1ff`. Bilgi ve vurgu Innex'in
  camgöbeği ve moru: "Ödendi", "Hazırlanıyor" ve "Kargoda" üç mavi değil,
  üç ayrı renk kalsın diye.
- **Grup renkleri** (`ui/hues.ts`, `--admin-hue-*`) artık Innex'in renkli
  ikon kutuları: Genel bakış ve rapor şeritlerindeki 28 px kutu, "Yeni"
  menüsü. Kenar çubuğu, alt çubuk ve sayaçlar renksizdir (Innex: etkin satır
  gri, renkli çizgi ya da mavi vurgu yok).
- **Düzenler** (23 Eki 2026, `docs/ADMIN.md` "Innex düzenleri"): rakamlar
  tek kartlık KPI şeridinde, her biri bir referansla (değişim hapı yeşil
  iyi haber, kırmızı kötü haber); kayıt sayfaları üç bölge (başlık ve tek
  birincil eylem, solda kararı veren tutar kartı, sağda sekmeler; sipariş,
  karaoke rezervasyonu, müşteri); liste araç çubuğu tek satır; dönem ve
  görünüm seçimi segment denetimi (gri ray, seçili beyaz hap); ürün ve
  menü satırı sağdan açılan hızlı bakış çekmecesi (gri kap içinde beyaz
  işlem satırları, renkli ikon kutusu, `›`).
- **Yazı Inter** (`next/font/google`, yalnız `src/app/admin/layout.tsx`);
  panel kökünde sitenin yazı token'ları (`--headline`, `--display`,
  `--mono` ...) Inter'e yönlenir. Tutar ve kodlar Inter'in tablo rakamları
  (`NUMERIC_STYLE`); karakter karakter okunan kimlik, parmak izi, 2FA
  anahtarı ve Markdown sistemin eş genişlikli yazısında (`CODE_STYLE`).
  Panel içindeki site önizlemesi (`data-site-preview`) ve basılı masa
  kartları sitenin sesinde (11 Kas 2026'dan beri Plus Jakarta Sans / Abril
  Fatface) kalır.
- **Bileşenler:** düğme köşe 8 px, 14 px orta kalınlık, dokunmatikte 44,
  farede 36, "Sıkı görünüm"de 32 px; alan 40-44 px, kenarı `#898d94` (boş
  alan 3:1 ile bulunsun diye Innex'ten koyu); kart beyaz, 1 px çizgi,
  gölgesiz; tablo başlığı soluk kuyuda 13 px gri; durum rozeti köşe 6 px,
  22 px, 12 px; durum sekmeleri Innex'in kutu çipleri (etkin olan koyu
  kenarlı, sayaç gri); sayfa çubuğu gri ray üstünde beyaz kutu; açılır
  menü köşe 10 px ve hafif gölge; pencere karartması %20; ciro grafiği
  koyu mavi `#2132ba` çizgi, lavanta `#e3e7ff` dolgu, kesikli ızgara.
- Satırda tekrar eden küçük kontroller (↑ / ↓, tek başına ⋯, satırın metin
  eylemi) sakin: soluk mürekkep, en çok ince çizgi; dokunmatikte 44 px,
  fareyle 28-32 px (`ROW_CONTROL`; `docs/ADMIN.md` "Satır kontrolleri").
  Etiketler cümle düzeninde; büyük harf yalnız kenar çubuğunun grup
  etiketlerinde.

Değerler `src/app/admin/layout.tsx` (`adminFontStyle`, `--admin-*`) içinde;
`tests/admin-ui-kit.test.ts` temayı, her tonun ve grup renginin AA oranını
ve bölümlerin renginin menü grubuyla aynı olduğunu tutar. Sitenin paleti,
yazısı ve bu belgedeki kurallar değişmedi.

---

## 9. Geçmiş

| Tarih       | Karar                                                                                                                                                                                                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 Eyl 2026  | Site paleti uygulamanınkine eşitlendi.                                                                                                                                                                                                                                                                     |
| 5 Eyl 2026  | Köşk yeniden tasarımı: beyaz zemin, ev yeşili `#143d2b`.                                                                                                                                                                                                                                                   |
| 6 Eyl 2026  | Referans tasarım: Montserrat, 8px dikdörtgen düğme.                                                                                                                                                                                                                                                        |
| 7 Eyl 2026  | Tricolore: vurgu bordo `#84233c` / `#4a0f1e` / `#f6e9ec`.                                                                                                                                                                                                                                                  |
| 23 Eyl 2026 | Uygulama kendi paletine geçti (karar 149); site almadı.                                                                                                                                                                                                                                                    |
| 25 Eyl 2026 | **Porselen: site uygulamayı izler** (karar 31, seçenek c): porselen `#f7f3ed`, yeşil `#1d6d56`, bordo `#9d2543`, pirinç `#e8c877`, Poppins + Inter, cam, kapsül düğme. Logo L'Af.                                                                                                                          |
| 11 Eki 2026 | **Tek ses Poppins** (operatör): Inter kalktı. Anasayfada slayt başına metin, manifesto bandı, canlı açık/kapalı, çizilen oklar.                                                                                                                                                                            |
| 14 Eki 2026 | **Başlıklar Gabarito** (operatör: _"sitede yapay zeka gibi duruyor, yazı tipleri poppins ve biennale vs kullan"_): Biennale lisanssız olduğu için en yakın serbest akrabası; gövde Poppins'te kaldı.                                                                                                       |
| 17 Eki 2026 | **Çizimler ve karaoke** (operatör: _"websitesine de birkaç görsel çizip görsel gereken yerlere ekle"_): fotoğrafı olmayan yerlere elle çizilmiş SVG'ler ve `<PageHero art>`; anasayfada karaoke bandı, mikrofon slaytı, damga baskısı.                                                                     |
| 21 Eki 2026 | **Admin paneli AkmanOS** (operatör), akşam yumuşatıldı; müşteri sitesi değişmedi.                                                                                                                                                                                                                          |
| 22 Eki 2026 | **Admin paneli Innex** (operatör: _"İnnexe geç"_; yukarıda "Admin paneli görünümü"); müşteri sitesi değişmedi.                                                                                                                                                                                             |
| 23 Eki 2026 | **Admin paneli Innex düzenleri** (operatör: _"İnnex + diğer yerleri en profesyonel şekilde yap"_); müşteri sitesi değişmedi.                                                                                                                                                                               |
| 5 Kas 2026  | **Kafe-perakende** (operatör: _"starbucks tarzı istiyorum ... ama panel değil"_): krem `#f2f0eb`, logo yeşilinden dört yeşil, tek ses Poppins, yüzen sipariş düğmesi; lafmobil porseleninden bilinçli ayrışma.                                                                                             |
| 6 Kas 2026  | Sahibin brifleri: gece footer (resimli bant, `--night` `#181412`), anasayfada gece kahve vadisi (three.js) ve ikinci turu (kavrulmuş çekirdekler, vektör "L'Affogato" yazısı), köşkün gece fotoğrafında hero, "Evde L'Affogato", uygulama bölümü, başlıkta tam genişlik panel, 404'te tabela.              |
| 11 Kas 2026 | **Roast** (operatör: _"siteyi tamamen https://coffee-beans-swart.vercel.app/ bu sitedeki gibi landingleri diğer sayfaları yap, three js vs. ne varsa kullan, aynı birebir yap ..."_): krem ve tek espresso, Abril Fatface + Plus Jakarta Sans, three.js girişi ve iki three.js bandı; kahve vadisi kalktı. |
| 12 Kas 2026 | **Roast, ikinci geçiş** (operatör: _"ince ayar yap ve yapay zekaymış gibi gözükmesin"_): üç three.js çizimi eşyanın fotoğrafı olacak biçimde yeniden kuruldu; hayalet rakam, üç nokta ve "Bölüm N:" sayacı kalktı.                                                                                         |
| 17 Kas 2026 | **Yolculuk** (operatör: _"sitede aşağıdaki promptu uygula ve kahveciye uygun hale getir sonra maine gönder"_, "alpha project" build promptu): anasayfanın girişi kaydırmanın oynattığı film oldu; Roast girişi kalktı.                                                                                     |
| 21 Kas 2026 | **Blue Bottle dili ve film** (operatör, §0.6): önceki görünüm bütünüyle silindi; beyaz ve bant, siyah, tek gri, kömür, kare köşe, Archivo + Geist, anasayfada lisanslı stok film. Güncel değerler §0.                                                                                                      |

**11-21 Kas 2026: Roast ve yolculuk (tarihçe; 21 Kas 2026'ya kadar bu
belgenin §0'ıydı).** Krem zemin `#faf7f2` (beyaza yakın bant `#fdfcf9`, taş
`#f0eae1`, krem kart `#f7efe2`) ve beyaz yüzey; mürekkep, her dolu düğme, koyu
bant ve footer için tek espresso `#23120b` (token adları değişmemişti:
`--green-*` ailesi, `--brand`, `--bg-espresso` ve `--night` espressoya
çözülürdü; mürekkep adımları `#57463d`, `#6b5a50`). Amber `#de853a` tek sıcak
düğmenin dolgusu ve koyu zeminde vurguydu; karamel `#a35019` krem üstünde
vurgu metniydi (karamel ile espresso üst üste yazılmaz, amber krem üstünde
metin olmazdı). Pirinç `#cba258` yalnız ödülde, `--matcha` `#1d6d56` sitede
kalan tek yeşil (olumlu durum), `--rose` `#c82014` hata. Başlık Abril Fatface
(tek kesim 400, büyük harf, asla kalın), metin Plus Jakarta Sans; etiket,
düğme ve menü bağlantısı kalın aralıklı büyük harf. 16px kart, espresso tonlu
gölge (`rgba(35, 18, 11, …)`), tam hap düğme (44px, basınca 0.95), kaydırınca
buzlu kreme dönen üst çubuk, yüzen sipariş düğmesi (`.frap`), telefonda alt
sekme çubuğu, footer'ın üstünde resimli gece bandı (`footer-night.tsx`).
Hareket: girişte kaydırmayla ilerleyen three.js çekirdeği (17 Kas'a kadar),
iki three.js bandı (dökülen espresso, affogato) ve tek durdur düğmesi
(`<RoastStage>`, `<RoastPause>`), maskeden yükselen başlık (`<RevealText>`),
soldan çözülen üst etiket (`<ScrambleText>`), kaydırma gözlemcisi
(`<RevealMotion>`). 17 Kas 2026'dan sonra anasayfa yolculukla açıldı:
Blender'da çizilmiş 120 adımlık kaydırma filmi (çekirdek yığınının içinden
bardaki affogatoya; kesim başına 61 kare, beş pakette), derinlik haritasıyla
paralaks, yanarak açılan krem ön yükleyici, iki cam kart, halka imleç; yazısı
yalnız orada Instrument Sans ve Instrument Serif italikti. Kayıtları
`docs/REDESIGN-ROAST.md` ve `docs/JOURNEY.md` 21 Kas 2026'da silindi;
`git show 4962da2:docs/REDESIGN-ROAST.md`, `git show 4962da2:docs/JOURNEY.md`
ve o günkü bu belge `git show 4962da2:docs/BRAND.md` ile okunur.

**5-11 Kas 2026: kafe-perakende düzeni (tarihçe).** Operatör: _"sitenin
görselini ... starbucks tarzı istiyorum ... ama panel değil"_. Sıcak krem
zemin `#f2f0eb` (taş `#edebe9`, bant `#f9f8f6`, ödül kremi `#faf6ee`), beyaz
kart ve fısıltı gölgesi; logo yeşilinden türetilmiş, her birinin tek işi olan
dört yeşil (brand `#1d6d56` başlık ve yeşil metin, cta `#1f7a5c` dolu düğme ve
yüzen sipariş düğmesi, house `#173f35` koyu bant, uplift `#2a5a4d` bandın içi;
açık nane `#d5e8df`); 6 Kas'tan sonra gece espressosu footer (`--night`
`#181412`) ve üstünde resimli gece bandı; mürekkep `#211f1d` / `#5c5955`; bordo
vurgu `#9d2543` (yeşille üst üste yazılmazdı); pirinç `#cba258` yalnız ödülde.
Tek ses Poppins (başlık 600, ödül başlığında sistem serifi); düğme 50px hap,
basınca 0.95; kart 12px, katmanlı siyah-alfa gölge; cam, bulanıklık ve degrade
dolgu yoktu; başlık çubuğu düz beyazdı (64 · 72 · 83 · 99 px). Anasayfanın
girişi 6 Kas'tan sonra gece kahve vadisiydi (three.js, `home-valley.tsx`).
Renkler kopyalanmamış, logo yeşilinden türetilmişti.

**25 Eyl - 5 Kas 2026: porselen, uygulama paritesi (tarihçe; 21 Kas 2026'ya
kadar bu belgenin §1-§4'üydü).** Operatör (25 Eyl 2026): _"lafmobil ...
tasarımı apple'a uygun, sen de site tasarımını buna uygun olarak güncelle"_
(lafmobil karar 31, seçenek c). Porselen zemin `#f7f3ed` (açık şerit
`#fbf8f4`, taş `#f2ece4`, krem `#f3eee0`), beyaz yüzey ve `#fffdfa` sheet;
mürekkep `#211c18`, `#564d46`, `#675e56`, `#877d74`; yapı yeşili `#1d6d56`
birincil eylem ve bağlantı (basılı `#165543`); bordo `#9d2543` imza yüzeyi,
ekran başına bir (yeşille 1.21:1; üst üste yazılmazdı, koyu zeminde
`#f6e9ec`); pirinç dolgu `#e8c877` (üstünde `#2e2113`), altın metin `#765923`;
`--rose` `#bb3b52`, `--info` `#3442b8`. Cam malzeme (`--glass*`; gerçek
bulanıklık yalnız yüzen kromda), kapsül düğme 48px (basınca 0.97), kart köşesi
22-28px, sıcak toprak gölge `rgba(59, 42, 30, …)`, footer uygulama ikonunun
radyal yeşili (`#23876a` → `#1d6d56` → `#0c3b2d`). Bölüm başlığının altında
40×4px tricolore çizgisi (yeşil · kırık beyaz · bordo); ürünün arkasında
uygulamanın 14 sahne pigmentinden gelen ışık (`scenes.ts`; dosya bugün yalnız
panelin anasayfa slayt formunda ve veri türlerinde okunur, sitede çizilmez);
17 Eki 2026'dan sonra fotoğrafı olmayan yerlerde elle çizilmiş SVG'ler (altı
renk, 2px espresso kontur; `public/illustrations/`, `illustration.tsx`). Yazı
önce Poppins + Inter, 11 Eki'den tek ses Poppins, 14 Eki'den başlıkta
Gabarito.

**Eski palette kalan yüzeyler.** Bağlantı önizlemesi (`opengraph-image.tsx`,
`og-card.tsx`), JSON-LD ikonları (`scripts/gen-icons.mjs` →
`public/icon-*.png`) ve PayNkolay köprüsü porselen döneminde uygulama paletine
taşındı; e-posta şablonları 15 Eki 2026'da (zemini gömülü bantlar HTML
çubuğa, logo çifti ile glint GIF'i tek opak karoya döndü; şablonlar açık ve
koyu modda okunur, `src/lib/email/templates/README.md` "Palet"). Sonraki
görünüm değişikliklerinin hiçbiri onları taşımadı (§8).

**21 Kas 2026'da kalkanlar.** Dosyalar: `journey/` (film, çiziciler, kare
paketleri), `roast-stage.tsx`, `roast-scene.ts`, `reveal-text.tsx`,
`scramble-text.tsx`, `reveal-motion.tsx`, `footer-night.tsx`,
`menu-visuals.tsx`, `illustration.tsx` ve `public/illustrations/`'taki 30 SVG,
`payments-art.tsx`, `docs/REDESIGN-ROAST.md`, `docs/JOURNEY.md`,
`docs/journey/`, `.claude/skills/design-1-1-fidelity`,
`public/photos/affogato-tray.webp`, `public/brand/app-screen-campaigns.webp`;
`home-app-intro.tsx`, `home-take-home.tsx` ve `home-karaoke.tsx`
`home-page.tsx`'e katıldı. Kurallar: tricolore çizgisi, sahneler, çizimler,
maskeden yükselen yazı ve kaydırma gözlemcisi, three.js çizimleri ve durdur
düğmesi, yolculuk ve onun yazı yüzleri, buzlu krem çubuk, yüzen sipariş
düğmesi, telefonun alt sekme çubuğu, "karamel ile espresso" kuralı. Palet ve
kontrast testleri (`tests/brand-theme.test.ts`, `tests/contrast.test.ts`)
zaten 16 Kas 2026'da `tests/` ile kalkmıştı; eski hâlleri
`git show 5d777bb:tests/<dosya>` ile okunur.
