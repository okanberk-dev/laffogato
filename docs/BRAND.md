# BRAND - L'Affogato marka kimliği

> Bu belge **web sitesinin** görsel kimliğidir ve tek kaynağı
> `src/app/globals.css` içindeki `:root` bloğudur. Buradaki her değer oradan
> okunmuştur; ikisi çelişirse **globals.css doğrudur** ve bu belge güncellenir.
>
> Kaynak tasarım: `Laffogato Site.dc.html` (Claude Design, "Köşk" yönü,
> 5 Eyl 2026). Karar geçmişi ve nöbetçi testler: `tests/brand-theme.test.ts`
> (paletin kaymasını engeller) ve `tests/contrast.test.ts` (okunabilirliği
> engeller).
>
> **Mobil uygulama (`RiosenBeq/lafmobil`) ayrı bir palet dosyası tutar**
> (`src/theme/tokens.ts`). 2 Eyl 2026'da iki yüzey eşitlenmişti; Köşk yeniden
> tasarımı sonrası parite **kısmi**: yeşiller örtüşüyor, zemin krem → beyaz ve
> ikincil vurgu bordo → terracotta → yine bordo oldu ve artık uygulamanın
> değeriyle aynı. Uygulamayı da taşımak gerekirse
> değişecek dosya `lafmobil/src/theme/tokens.ts`.

---

## 1. Renk

### 1.1 Yüzeyler

| Token                | Değer     | Nerede                                                     |
| -------------------- | --------- | ---------------------------------------------------------- |
| `--bg`               | `#ffffff` | Sayfa zemini. Site beyaz üzerine kurulur.                  |
| `--bg-warm`          | `#f6f5f2` | Kart zemini, sakin bölüm şeridi, pasif buton hover'ı.      |
| `--bg-stone`         | `#f1eee8` | Çökük yüzey: ilerleme çubuğu yatağı, dolu saat kutusu.     |
| `--bg-cream`         | `#fbf9f4` | Uzun metin zemini (hukuk, rehber).                         |
| `--bg-espresso`      | `#143d2b` | **Ev yeşili.** Koyu bloklar, birincil buton, seçili durum. |
| `--bg-espresso-deep` | `#0e2c1f` | Yalnızca `--bg-espresso`'nun hover/basılı adımı.           |

### 1.1b Hero paleti

Operatörün 6 Eyl 2026'da verdiği referans tasarımın kendi beş jetonu. Sayfa
paletinden ayrı tutuldu: hero, sitede krem zemini ve ne altın ne bordo
olan bir başlık rengi taşıyan tek şerit.

| Token              | Değer     | Nerede                                             |
| ------------------ | --------- | -------------------------------------------------- |
| `--hero-cream`     | `#faf6ee` | Hero ve sayfa başlığı şeridinin zemini.            |
| `--hero-green`     | `#1e5b3f` | Hero diski, banner zemini, aktif nav altı çizgisi. |
| `--hero-cocoa`     | `#6b4423` | Display başlıklar (hero ve `PageHero`).            |
| `--hero-tile`      | `#f7ebdc` | Hero küçük ürün karesi.                            |
| `--hero-tile-deep` | `#ebd9c4` | Aktif karenin adet çubuğu.                         |

Ölçülmüş kontrast (`--hero-cream` üzerinde): cocoa **7.87:1**, green
**7.43:1**, `--ink` 15.71:1, `--ink-soft` 6.44:1. Hepsi AA gövde metnini de
geçer - devasa başlığın buna ihtiyacı yok ama `.hero-x-cta`'nın var.

Referans bir Starbucks konseptiydi: alınan **düzen ve renk muamelesi**dir.
Marka taşıyan hiçbir şey alınmadı - logo, kelime markası, ürünler ve
fotoğraflar L'Affogato'nun kendisinin. `tests/brand-theme.test.ts` o markanın
iki yeşilini yasaklar ve dosyada geçerlerse build'i düşürür.

`--bg-espresso` adı miras: heritage paletinde espresso kahvesiydi, 2 Eyl
2026'dan beri ev yeşili. Adı korundu çünkü ~40 kural ona bakıyor; anlamı
"koyu zemin".

### 1.2 Mürekkep

| Token               | Değer     | Nerede                                       |
| ------------------- | --------- | -------------------------------------------- |
| `--ink`             | `#201c17` | Başlıklar ve gövde metni.                    |
| `--ink-soft`        | `#5f594e` | İkincil gövde, açıklama satırları.           |
| `--ink-mute`        | `#746b5d` | Küçük etiketler, alan başlıkları, meta.      |
| `--ink-line`        | `#ebe7de` | Kart kenarlığı, ince ayraç.                  |
| `--ink-line-strong` | `#e1dcd1` | Girdi kenarlığı, çerçeveli buton, pasif hap. |

`--ink-mute` prototipte `#8c8375`. Beyaz üzerinde 3.74:1 ölçtüğü - yani AA
altında kaldığı - için bir adım koyulaştırıldı. Bu, tasarımdan bilerek
ayrılan iki değerden biri.

### 1.3 Yeşil

| Token          | Değer     | Nerede                                                |
| -------------- | --------- | ----------------------------------------------------- |
| `--green`      | `#1e7c4b` | Beyaz üzerinde metin taşıyan yeşil: bölüm etiketleri. |
| `--green-mint` | `#a9d3b5` | Koyu yeşil blok içinde etiket.                        |
| `--green-mist` | `#cfe3d5` | Koyu yeşil blok içinde gövde metni.                   |
| `--matcha`     | `#1e7c4b` | Olumlu durum: "stokta". `--green` ile aynı değer.     |

`--matcha` ile `--rose` arasındaki **ton açısı farkı 159°**. Bu tesadüf değil:
"stokta" ile "son 2 kaldı" bir zamanlar aynı sıcak kırmızı ailesindeydi ve bir
bakışta ayırt edilemiyordu. `tests/contrast.test.ts` bu farkı >60° olarak
zorunlu tutar.

### 1.4 Altın - ödül sesi

| Token         | Değer     | Nerede                                               |
| ------------- | --------- | ---------------------------------------------------- |
| `--gold`      | `#8a6526` | Beyaz üzerinde metin taşıyan altın; odak halkası.    |
| `--gold-deep` | `#6b4e1a` | Basılı adım, hukuk bağlantısı.                       |
| `--gold-soft` | `#e8d3a4` | **Dolgu.** Ödül CTA'sı, seviye rozeti, sepet sayacı. |
| `--gold-ink`  | `#3b2a0f` | `--gold-soft` üzerine yazılan metin (11.52:1).       |

Altın yalnızca **ödül** anlamına gelir: damga kartı, kupon, "siparişi onayla".
Dekoratif kullanılmaz.

### 1.5 Bordo - vurgu, tricolore'nin kırmızısı

| Token              | Değer     | Nerede                                                             |
| ------------------ | --------- | ------------------------------------------------------------------ |
| `--accent`         | `#84233c` | Aktif nav altı çizgisi, başlıkta tek vurgu kelimesi, üyelik bloğu. |
| `--accent-deep`    | `#4a0f1e` | Basılı adım, en koyu bordo zemin.                                  |
| `--accent-soft`    | `#f6e9ec` | Çok hafif gül zemin.                                               |
| `--accent-on-dark` | `#efb9c6` | Koyu zemin üzerinde bordo metin.                                   |

Operatör talimatı, 7 Eyl 2026: _"italya bayrağı renklerini kullan … bunlara
yakışan bordo ekle"_. Yeşil ve beyaz sitede zaten vardı; bu, bayrağın
kırmızısının bordoya derinleştirilmiş hâli - ev yeşilinin üstüne bağırmak
yerine onunla oturması için.

Bu değerler **yeni değil**: `lafmobil`'in `accent.burgundy`,
`burgundyDeep` ve `bg.accentSubtle` jetonlarının aynısı. Köşk redesign'ının
açtığı palet farkını kapatıyor ve uygulamanın `tricolore` dizisini
(`['#235347', '#FAF9F6', '#84233C']`) sitenin yeşil / kâğıt / vurgu üçlüsüyle
birebir aynı hâle getiriyor.

Terracotta'nın gerektirdiği "beyaz metin AA altında" istisnası onunla birlikte
gitti: `--accent` üzerine beyaz **9.18:1**, her boyutta yeterli.

**Tehlike:** `#84233c` ile ev yeşilleri neredeyse aynı parlaklıkta
(`--hero-green` ile **1.15:1**). Biri diğerinin üstüne **asla** yazılmaz; koyu
zeminde `--accent-on-dark` kullanılır. `tests/contrast.test.ts` bunu tutar.

Bordo **kıt** kullanılır. Birincil eylem rengi değildir; birincil eylem ev
yeşilidir.

**Tricolore çizgisi.** `.tricolore` sınıfı bir başlığın altına 42×3px'lik üç
duraklı bir çizgi çizer: yeşil · kırık beyaz · bordo. Bayrağın kendisi değil -
bir kahve sitesinde gerçek bayrak dil seçici gibi okunur; ince çizgi miras
gibi okunur. Duraklar bu paletin kendi renkleri, bayrağın primerleri değil.

### 1.6 Durum

| Token      | Değer     | Anlam                         |
| ---------- | --------- | ----------------------------- |
| `--matcha` | `#1e7c4b` | Olumlu - stokta, açık, onaylı |
| `--rose`   | `#c5435a` | Uyarı - az kaldı, hata        |

`--rose` **durum** rengidir, marka değil. Vurgu bordo olunca ikisi hue olarak
yakınlaştı (4.8°); onları ayıran şey ton değil **değer** ve **ağırlık**:
`--rose` küçük metinde parlak bir alarm ("● Son 2 adet", "Sil"), bordo derin
bir marka dolgusu. Aralarındaki 1.85:1 parlaklık farkını `contrast.test.ts`
korur; kimse birini sessizce diğerine eşitleyemez.

### 1.7 Ölçülmüş kontrast

Aşağıdaki oranlar `globals.css`'ten okunup hesaplandı. WCAG AA: normal metin
4.5:1, büyük metin (≥24px veya ≥19px bold) 3:1.

| Mürekkep                   | Zemin                   | Oran     |
| -------------------------- | ----------------------- | -------- |
| `--ink` #201c17            | `--bg` #ffffff          | 16.94:1  |
| `--ink-soft` #5f594e       | `--bg` #ffffff          | 6.94:1   |
| `--ink-mute` #746b5d       | `--bg` #ffffff          | 5.25:1   |
| `--ink-mute` #746b5d       | `--bg-warm` #f6f5f2     | 4.81:1   |
| `--green` #1e7c4b          | `--bg` #ffffff          | 5.20:1   |
| `--gold` #8a6526           | `--bg` #ffffff          | 5.29:1   |
| `--rose` #c5435a           | `--bg` #ffffff          | 4.86:1   |
| `--accent` #84233c         | `--bg-cream` #fbf9f4    | 8.73:1   |
| `--accent-deep` #4a0f1e    | `--bg-cream` #fbf9f4    | 14.48:1  |
| `--green-mint` #a9d3b5     | `--bg-espresso` #143d2b | 7.32:1   |
| `--green-mist` #cfe3d5     | `--bg-espresso` #143d2b | 9.01:1   |
| `--gold-soft` #e8d3a4      | `--bg-espresso` #143d2b | 8.25:1   |
| `--accent-on-dark` #efb9c6 | `--bg-espresso` #143d2b | 7.17:1   |
| `--accent-on-dark` #efb9c6 | `--hero-green` #1e5b3f  | 4.74:1   |
| `--accent` #84233c         | `--bg-espresso` #143d2b | 1.32:1 ✗ |
| `--accent` #84233c         | `--hero-green` #1e5b3f  | 1.15:1 ✗ |

Dolgu üzerine metin:

| Dolgu                   | Beyaz metin | `--ink` metin |
| ----------------------- | ----------- | ------------- |
| `--bg-espresso` #143d2b | 12.12:1     | 1.40:1        |
| `--green` #1e7c4b       | 5.20:1      | 3.26:1        |
| `--gold` #8a6526        | 5.29:1      | 3.20:1        |
| `--accent` #84233c      | 9.18:1      | 1.85:1        |
| `--accent-deep` #4a0f1e | 15.24:1     | 1.11:1        |
| `--gold-soft` #e8d3a4   | 1.47:1 ✗    | 11.52:1       |

### 1.8 HUES - ürün yüzeyleri

`src/components/laffogato/visuals.tsx` içindeki 12 yüzey ayrı bir sistemdir:
menü ve mağaza kartlarının arkasındaki degradeler. Bir duvar dolusu kart bir
gelato tezgâhı gibi okunsun diye **kasıtlı olarak birbirinden farklıdırlar**;
`espresso` yüzeyinin koyu olması hata değil, o sistemin gereğidir. Her birinin
`ink`'i kendi degradesine karşı AA'yı geçer ve `tests/contrast.test.ts` bunu
hem tek tek hem de kümenin parlaklık yayılımı (>0.3) olarak kontrol eder.

---

## 2. Tipografi

**Tek aile: Montserrat.** Serif yok, script yok, mono yok. Ayrımı
ağırlık ve harf aralığı yapar. `next/font/google` ile self-host edilir
(`--font-jakarta`), Türkçe için `latin-ext` alt kümesiyle.

Tarihsel token'lar (`--serif`, `--serif-modern`, `--serif-display`,
`--script`, `--mono`) korundu ve hepsi `--sans`'a çözülür - bu dosyadaki ve
admin panelindeki yüzlerce çağrı yeri bozulmasın diye. **Yeni kodda
`--sans` kullan.** `--mono` artık "monospace" değil, "etiket/rakam sesi"
demektir: büyük harf, geniş aralık, tabular rakam.

| Sınıf        | Boyut                          | Ağırlık | Satır | Aralık             |
| ------------ | ------------------------------ | ------- | ----- | ------------------ |
| `.h-display` | `clamp(34px, 5.2vw, 68px)`     | 800     | 1.02  | -0.04em            |
| `.h1`        | `clamp(32px, 4.4vw, 60px)`     | 800     | 1.03  | -0.035em           |
| `.h2`        | `clamp(28px, 3.6vw, 48px)`     | 800     | 1.05  | -0.035em           |
| `.h3`        | `clamp(19px, 2vw, 24px)`       | 700     | 1.2   | -0.02em            |
| `.lede`      | `clamp(15.5px, 1.1vw, 16.5px)` | 400     | 1.65  | -0.005em           |
| gövde        | 16px                           | 400     | 1.55  | -                  |
| `.eyebrow`   | 11px                           | 700     | -     | 0.22em, büyük harf |

Ölçek Köşk yeniden tasarımında **yarıya indi**: eski display 120px'e kadar
çıkıyordu, prototipin en büyüğü 68px. Sayfaların poster gibi değil kafe sitesi
gibi okunmasını sağlayan şey bu.

`.script` artık bir yazı tipi değil, **başlıktaki vurgu kelimesi**:
`--accent` rengiyle, aynı ailede. Koyu zeminde `--accent-on-dark`'a döner.

Rakamlar site genelinde `font-variant-numeric: tabular-nums`. Fiyat, damga
sayısı, saat ve telefon akan metnin içinde geçiyor; her birinde yardımcı
sınıfa uzanmak yerine varsayılan bu.

**Tire:** Arayüz metninde uzun tire (U+2014) ve orta tire (U+2013) kullanılmaz, düz tire
(`-`) kullanılır. Bu API'nin döndüğü etiketler için de geçerlidir
(`hoursLabel`, `venue.hours[].value`) - uygulama bunları olduğu gibi bastığı
için değişiklik sunucudan gider, uygulama güncellemesi gerekmez.

---

## 3. Ölçü, yarıçap, gölge

```
--content        1280px      içerik genişliği
--content-wide   1480px
--content-narrow 880px       uzun metin
--gutter         clamp(16px, 4vw, 44px)

--r-sm   10px    küçük kontrol
--r-md   14px    girdi, saat kutusu, ikincil kart
--r-lg   22px    kart
--r-xl   28px    bölüm bloğu, hero çerçevesi
--r-btn  8px     buton (referans tasarım, 6 Eyl 2026)
--r-pill 999px   hap, rozet, sayaç, çip
```

Bölüm ritmi: `.section` = `clamp(44px, 6vw, 88px)` alt+üst. Anasayfa
bloklarında `.home-section` = **yalnız üst** - üst üste iki `.section` iki
boşluk bırakıyor ve aralar 176px'e çıkıyordu.

Gölgeler nötr siyahla değil **ev yeşiliyle** (20,61,43) tonlanır; beyaz
üzerindeki kartlar griye kaçmasın diye.

---

## 4. Bileşen dili

**Butonlar 8px yarıçaplı dikdörtgendir** (`--r-btn`), hap değil - referans
tasarımın buton dili. Hap yarıçapı (`--r-pill`) çipte, rozette, sayaçta ve
sepet balonunda kalır; oralar hap OLMALI, bu yüzden ikisi ayrı jeton.

| Sınıf          | Dolgu               | Metin           | Ne zaman                         |
| -------------- | ------------------- | --------------- | -------------------------------- |
| `.btn-primary` | `--bg-espresso`     | beyaz           | Sayfadaki birincil eylem         |
| `.btn-outline` | şeffaf, yeşil kenar | `--bg-espresso` | Yeşil dolgunun yanındaki ikincil |
| `.btn-ghost`   | şeffaf, ince kenar  | `--ink`         | Üçüncül                          |
| `.btn-light`   | beyaz               | `--bg-espresso` | Koyu blok içinde                 |
| `.btn-gold`    | `--gold-soft`       | `--gold-ink`    | Ödül: kupon, sipariş onayı       |

**Kartlar** `1px solid var(--ink-line)` + `--r-lg`, dolgu değil kenarlıkla
ayrılır. Hover'da kenarlık `--bg-espresso`'ya döner.

**Rozetler** 10px/700, `0.16em` aralık, hap. `--bg-espresso` (İMZA) veya
`--accent-deep` (YENİ - beyaz metin AA'yı `--accent` üzerinde geçmediği için
koyu adım).

**Etiket (eyebrow)** her bölüm başlığının üstünde: 11px/700, `0.22em`, büyük
harf. Beyaz zeminde `--green`, koyu yeşilde `--green-mint`, alan başlığı
olarak `.muted` ile `--ink-mute`.

**Başlık (header)** iki katlıdır ve `position: sticky`: koyu yeşil künye
şeridi (saatler, gel-al sözü, telefon, uygulama bağlantısı) üstte, beyaz nav
altta. Sabit/şeffaf değil - bu yüzden sayfalar kendi üst boşluklarıyla başlar.

---

### 4.1 Sayfa mobilyası

Referans tasarımın dili üç paylaşılan parçada toplanır. Yeni bir sayfa bunları
kullanır; kendi kopyasını çıkarmaz - bundan önce altı sayfada altı farklı
başlık ölçüsü vardı.

| Parça                          | Nerede                       | Ne yapar                                                             |
| ------------------------------ | ---------------------------- | -------------------------------------------------------------------- |
| `<PageHero>` (`page-hero.tsx`) | Anasayfa dışındaki her sayfa | Krem şerit, cocoa display başlık, sağda yeşil disk.                  |
| `.section-title`               | Sayfa içi blok başlığı       | Üstünde tricolore çizgisi olan h2.                                   |
| `.band-cream`                  | Uzun sayfalarda ritim        | Bölümü krem zemine alır; sayfa kâğıt → krem → kâğıt diye nefes alır. |
| `.promo-banner`                | Anasayfa, `/kampanyalar`     | Koyu zemin, üstünde yumuşak dalga, sağda tek beyaz hap.              |
| `.campaign-card`               | `/kampanyalar`               | 16:9 görsel + tür etiketi + başlık; panelin `app-content` yazısı.    |

`<HomeHeroSlider>` bunların büyük hâli: aynı krem şerit, aynı cocoa başlık,
ama diskin üstünde kesilmiş bir ürün fotoğrafı duruyor. Disk **elips**tir ve
kupa onun sol altından taşar; iç içe geçmiş iki merkez, "yuvarlak çerçeveli
fotoğraf" gibi okunur ve tasarımı öldürür.

`<PageHero>`'in `title`'ı ya iki satırlık bir demet (satır sonunu dizinin
kendisi belirler) ya da tek bir dize alır. İkisi birden, çünkü demet iki zıt
yönde yanlıştı: başlığı veriden gelen sayfalar (bir rehber yazısının adı, bir
sözleşmenin başlığı) elle bölünemiyordu ve bileşeni geri çeviriyordu; demeti
kabul eden sayfalar ise sabit bir demeti her alt rotaya kopyalıyordu - sekiz
menü kategorisi URL'inin hepsi aynı h1'i basıyordu.

**Vurgu kelimesi zemine göre renk alır.** `.script` artık
`var(--script-ink, var(--accent))` okur; koyu zemin `--script-ink`'i
`--accent-on-dark` yapar. Koyu bir blok yazarken `data-ground="dark"` eklemek
yeterli. Önceden bu, koyu seçicilerin **listesiydi** ve liste eskimişti: iki
satır içi koyu bölüm ile `.guide-cta` listede yoktu, bordoya geçişte o üç
vurgu kelimesi görünmez oldu ve test yeşil kaldı. Liste bakım ister, değişken
istemez.

Disk ve fotoğraf tek bir `--disc` değişkeninden **piksel** olarak ölçülür.
Yüzdeyle denendi ve sessizce başarısız oldu: esnetilmiş bir grid öğesine karşı
yüzde yükseklik çözülmez, fotoğraf kendi 581×942 boyutuna düşer ve diski
tamamen yutar.

---

## 5. Logo

Tek kaynak: `public/logo-mark.png`, CSS maskesi olarak
(`.brand-mark`, `background-color: currentColor`). Tek varlık her zemine
boyanır - navda yeşil diskin içinde beyaz, altbilgide koyu yeşil üzerinde
beyaz. Renkli PNG kopyası tutulmaz.

Nav kilidi: 48px yeşil disk + 22px/800 "L'Affogato" + 9px/600 `0.3em`
"caffè italiano · 1987". 900px altında yazı düşer, disk kalır.

---

## 6. Fotoğraf

`public/photos/*.webp` - mekânın kendi fotoğrafları (cephe gündüz/gece, iç
mekân, teras, ürün). PNG olarak geldiler, 10.56 MB; WebP q82'de 1.28 MB.
Yeni fotoğraf eklerken aynı yolu izle: `public/menu/*.webp` de böyle.

Kullanım: hero slayt yarısı `object-fit: cover`, hikaye mozaiği
(lead 2×2 + dört destek), imza bloğunda 4/5 oranlı ikili, ziyaret sayfasında
16/11.

---

## 7. Hareket

- Geçişler `--ease-out` = `cubic-bezier(0.2, 0.7, 0.2, 1)`.
- Hero slaytı 7 sn'de döner; bir kontrole dokunulduğunda **kalıcı olarak**
  durur, imleç/odak üzerindeyken ve sekme arka plandayken duraklar,
  `prefers-reduced-motion` altında hiç başlamaz.
- `.reveal` yalnızca client'ta, yalnız ekranın altındaki öğelere uygulanır;
  JS yoksa hiçbir şey gizlenmez.
- `prefers-reduced-motion: reduce` altında tüm animasyon ve geçişler durur.

---

## 8. Değiştirirken

1. Renk **yalnız** `globals.css :root` içinde değişir. Çağrı noktasına hex
   yazma.
2. `npm test` çalıştır. `tests/contrast.test.ts` okunabilirliği,
   `tests/brand-theme.test.ts` paletin kaymasını tutar; ikisi de bilerek
   katıdır çünkü bu palet üç kez kaydı.
3. `globals.css` dışındaki dört yüzey CSS değişkeni çözemez ve paleti harfi
   harfine yazar - değiştirirsen dördünü de güncelle:
   `src/app/manifest.ts` (PWA açılışı), `src/app/layout.tsx` (`themeColor`),
   `src/app/opengraph-image.tsx` (bağlantı önizlemesi),
   `src/lib/email/send.ts` (işlemsel e-posta).
4. Bu belgeyi de güncelle.
