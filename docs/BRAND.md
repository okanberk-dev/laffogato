# BRAND - L'Affogato marka kimliği

> Bu belge **web sitesinin** görsel kimliğidir ve tek kaynağı
> `src/app/globals.css` içindeki `:root` bloğudur. Buradaki her değer oradan
> okunmuştur; ikisi çelişirse **globals.css doğrudur** ve bu belge güncellenir.
>
> **Kaynak: mobil uygulama.** 25 Eyl 2026 operatör talimatı: _"lafmobil
> reposu mobil uygulamanın reposu ve tasarımı apple'a uygun, sen de site
> tasarımını buna uygun olarak güncelle"_. Bu, lafmobil karar 31'i (c)
> seçeneğiyle kapattı: site uygulamanın **bütün** paletini, iki yazı sesini
> ve cam malzeme dilini aldı. Yazıda tek bir ayrışma var: 14 Eki 2026'dan
> beri site başlıkları Gabarito'yla, gerisini Poppins'le yazar (§2). Değerler o gün `lafmobil/src/theme/tokens.ts`
> (`porcelain`, DESIGN-GLASS §13) dosyasından okundu. Uygulama değişirse site
> aynı PR serisinde izler; değer tablosu lafmobil `docs/SITE-PALETTE-SYNC.md`.
>
> Nöbetçi testler: `tests/brand-theme.test.ts` (paletin kaymasını engeller) ve
> `tests/contrast.test.ts` (okunabilirliği engeller). Önceki (Köşk) palet §9'da.

---

## 1. Renk

### 1.1 Zeminler ve yüzeyler

| Token                | Değer     | Nerede                                                          |
| -------------------- | --------- | --------------------------------------------------------------- |
| `--bg`               | `#f7f3ed` | **Porselen.** Sayfa zemini; beyaz kart bunun üstünden kalkar.   |
| `--bg-warm`          | `#fbf8f4` | Açık şerit (uygulamanın `ground.top`), cam başlığın zemini.     |
| `--bg-stone`         | `#f2ece4` | Çökük yüzey: ilerleme yatağı, dolu saat kutusu.                 |
| `--bg-cream`         | `#f3eee0` | Uzun metin zemini, `.band-cream` ritim şeridi.                  |
| `--surface`          | `#ffffff` | Kart, liste grubu, girdi alanı.                                 |
| `--surface-sheet`    | `#fffdfa` | Alt sayfa (sheet) ve modal gövdesi.                             |
| `--bg-espresso`      | `#1d6d56` | **Ev yeşili** (adı miras, anlamı "koyu zemin"). Birincil dolgu. |
| `--bg-espresso-deep` | `#0c3b2d` | Yeşilin en koyu adımı: altbilgi degradesinin dibi.              |

Porselen beyaz değildir, bilerek: sıcak ve çok açık bir zemin, beyaz bir
kartın gölgesiz bile ayrılmasını sağlar (DESIGN-GLASS §13.3). Beyaz yalnız
yüzeydir - sayfa değil.

### 1.2 Cam

| Token             | Değer                                | Nerede                               |
| ----------------- | ------------------------------------ | ------------------------------------ |
| `--glass`         | `rgba(255, 255, 255, 0.72)`          | Cam kart (varsayılan).               |
| `--glass-raised`  | `rgba(255, 255, 255, 0.85)`          | Öne çıkan kart, açılır panel, sheet. |
| `--glass-control` | `rgba(255, 255, 255, 0.45)`          | Cam düğme, çip.                      |
| `--glass-chrome`  | `rgba(251, 248, 244, 0.78)`          | Yüzen krom: başlık, sekme çubuğu.    |
| `--glass-blur`    | `saturate(180%) blur(22px)`          | **Yalnız** yüzen kromda.             |
| `--rim`           | üstte beyaz dudak + altta ince gölge | Camın kenar ışığı.                   |

Gerçek bulanıklık (backdrop-filter) yalnızca içeriğin **üstünde yüzen**
parçalarda kullanılır - başlık, mobil sekme çubuğu, sepet paneli, arama.
Kartlar opak-benzeri cam olarak kalır: Apple HIG'in "malzeme hiyerarşisi",
ve kaydırmada yüzlerce bulanık kartın GPU faturası.

### 1.3 Mürekkep

| Token               | Değer                    | Nerede                              |
| ------------------- | ------------------------ | ----------------------------------- |
| `--ink`             | `#211c18`                | Başlıklar ve gövde metni.           |
| `--ink-soft`        | `#564d46`                | İkincil gövde, açıklama satırları.  |
| `--ink-mute`        | `#675e56`                | Küçük etiket, meta, alan başlığı.   |
| `--ink-quiet`       | `#877d74`                | Yalnız yer tutucu ve pasif durum.   |
| `--ink-line`        | `rgba(33, 28, 24, 0.08)` | Kart kenarı, ince ayraç (hairline). |
| `--ink-line-strong` | `rgba(33, 28, 24, 0.14)` | Girdi kenarı, çerçeveli kontrol.    |

### 1.4 Yeşil - karar verilmiş olan

| Token             | Değer     | Nerede                                                    |
| ----------------- | --------- | --------------------------------------------------------- |
| `--green`         | `#1d6d56` | Birincil eylem, bağlantı, seçili durum, bölüm etiketi.    |
| `--green-pressed` | `#165543` | Basılı / hover adımı.                                     |
| `--green-mint`    | `#d3e2d9` | Koyu yeşil blok içinde etiket.                            |
| `--green-mist`    | `#e6efe9` | Olumlu bilgi kutusu zemini; koyu blokta gövde metni.      |
| `--matcha`        | `#1d6d56` | Olumlu durum: "stokta", "açık". `--green` ile aynı değer. |

Uygulamanın dilinde yeşil **kararı** taşır: seçilmiş, onaylanmış, gidilecek
yer. Birincil düğme her zaman yeşildir.

### 1.5 Bordo - imza yüzeyi

| Token              | Değer     | Nerede                                                  |
| ------------------ | --------- | ------------------------------------------------------- |
| `--accent`         | `#9d2543` | Başlıktaki tek vurgu kelimesi (`.script`), kadife blok. |
| `--accent-deep`    | `#520f1f` | Kadife degradesinin dibi, basılı adım.                  |
| `--accent-soft`    | `#f9e6ea` | Hata kutusu zemini, çok hafif gül.                      |
| `--accent-on-dark` | `#f6e9ec` | Koyu zemin üzerinde vurgu kelimesi.                     |

Kural: **ekran başına bir bordo yüzey** (uygulamada "velvet"). Anasayfada bu
sadakat (damga kartı) bloğudur. Bordo birincil eylem rengi değildir.

**Tehlike:** `#9d2543` ile ev yeşili neredeyse aynı parlaklıkta
(**1.21:1**). Biri diğerinin üstüne **asla** yazılmaz; koyu zeminde
`--accent-on-dark` kullanılır. `.script` bunu `--script-ink` değişkeniyle
kendiliğinden yapar - koyu bir blok yazarken `data-ground="dark"` eklemek
yeterli. `tests/contrast.test.ts` her iki kuralı da tutar.

### 1.6 Pirinç ve altın - ödül sesi

| Token         | Değer     | Nerede                                                      |
| ------------- | --------- | ----------------------------------------------------------- |
| `--gold-soft` | `#e8c877` | **Pirinç dolgu.** Damga, sepet sayacı, "Abone ol", rozet.   |
| `--gold-ink`  | `#2e2113` | Pirinç üzerine yazılan metin (9.65:1).                      |
| `--gold`      | `#765923` | Porselen üzerinde metin taşıyan altın (uygulamanın goldFg). |
| `--gold-deep` | `#5c4325` | Basılı adım.                                                |

Pirinç bir **yüzeydir**: üstüne mürekkep yazılır, kendisi porselen üzerinde
metin taşımaz (1.6:1). Anlamı ödüldür - damga kartı, kupon, abonelik.

### 1.7 Durum ve bilgi

| Token         | Değer     | Anlam                                  |
| ------------- | --------- | -------------------------------------- |
| `--matcha`    | `#1d6d56` | Olumlu - stokta, açık, onaylı          |
| `--rose`      | `#bb3b52` | Uyarı - az kaldı, hata metni           |
| `--info`      | `#3442b8` | Bilgi notu metni (uygulamanın kobaltı) |
| `--info-fill` | `#4858d2` | "Yeni" rozeti dolgusu (beyaz metin)    |

`--rose` **durum** rengidir, marka değil; bordodan daha parlak bir kırmızı
olarak kalır ki "son 2 adet" bir marka vurgusu gibi okunmasın. Porselen
üzerinde AA'yı geçmesi için 25 Eyl 2026'da `#c5435a`'dan bir adım
koyulaştırıldı (4.39 → 4.92:1).

### 1.8 Ölçülmüş kontrast

WCAG AA: normal metin 4.5:1, büyük metin (≥24px veya ≥19px kalın) 3:1.

| Mürekkep                   | Zemin                   | Oran     |
| -------------------------- | ----------------------- | -------- |
| `--ink` #211c18            | `--bg` #f7f3ed          | 15.27:1  |
| `--ink-soft` #564d46       | `--bg` #f7f3ed          | 7.46:1   |
| `--ink-mute` #675e56       | `--bg` #f7f3ed          | 5.74:1   |
| `--green` #1d6d56          | `--bg` #f7f3ed          | 5.63:1   |
| `--green` #1d6d56          | beyaz                   | 6.22:1   |
| `--gold` #765923           | `--bg` #f7f3ed          | 5.89:1   |
| `--accent` #9d2543         | `--bg` #f7f3ed          | 6.84:1   |
| `--rose` #bb3b52           | `--bg` #f7f3ed          | 4.92:1   |
| `--info` #3442b8           | `--bg` #f7f3ed          | 7.26:1   |
| `--green-mist` #e6efe9     | `--bg-espresso` #1d6d56 | 5.30:1   |
| `--accent-on-dark` #f6e9ec | `--bg-espresso` #1d6d56 | 5.27:1   |
| `--accent` #9d2543         | `--bg-espresso` #1d6d56 | 1.21:1 ✗ |

Dolgu üzerine metin:

| Dolgu                   | Metin           | Oran    |
| ----------------------- | --------------- | ------- |
| `--green` #1d6d56       | `#fbf8f4`       | 5.88:1  |
| `--accent` #9d2543      | beyaz           | 7.56:1  |
| `--accent-deep` #520f1f | beyaz           | 14.51:1 |
| `--gold-soft` #e8c877   | `--ink` #211c18 | 10.42:1 |
| `--info-fill` #4858d2   | beyaz           | 5.83:1  |

### 1.9 Sahneler - ürünün arkasındaki ışık

Uygulama her ürünü porselen üzerinde, **ürünün kendi renginden gelen** pastel
bir haleyle çizer (DESIGN-GLASS §6: "ışık üründen gelir"). Site aynı 14
sahneyi kullanır: `src/components/laffogato/scenes.ts` (`core` hale merkezi,
`mid`, `edge` porseline eridiği yer, `floor` ürünün durduğu bant). Aile
anahtarları API sözleşmesinin parçasıdır (`src/lib/backdrop/families.ts`).

Eski 12 `HUES` adı (`visuals.tsx`) korunur ve birer sahneye çözülür. Hepsi
açık olduğundan artık parlaklıkla değil **renkle** ayrışırlar;
`tests/contrast.test.ts` renk çemberini dolaştıklarını ve her birinin
mürekkebinin kendi zeminine karşı AA'yı geçtiğini tutar.

### 1.10 Tricolore çizgisi

Bölüm başlığının (`.section-title`) **altında** 40×4px'lik üç duraklı çizgi:
yeşil · kırık beyaz · bordo. Uygulamanın `TricoloreRule`'u - bayrak değil,
miras. Koyu zeminde `--tricolore-on-dark` (mint · krem · açık gül). Sayfa
başlığı etiketinin (`.page-hero-kicker`) önünde kısa hâli durur.

---

## 2. Tipografi

**İki ses: başlıkta Gabarito, metinde ve kontrolde Poppins** (operatör,
14 Eki 2026: _"sitede yapay zeka gibi duruyor, yazı tipleri poppins ve
biennale vs kullan"_).

- **Gabarito** (`--headline`) sayfa, bölüm ve kart başlıklarını
  (`.h-display`, `.h1`-`.h3`, `*-title`) ve gösterim rakamlarını (`.stat-n`,
  ürün sayfasının fiyatı, ödenecek tutar) yazar. Operatörün adını verdiği
  **Biennale**'nin (Latinotype) yerine durur: Biennale ücretlidir (web
  lisansı; tek kesit 29 $'dan, aile Fontspring'de 99,50 $'dan) ve lisansı
  yok. Gabarito (SIL OFL, Google Fonts) onun en yakın serbest akrabası:
  geometrik, geniş x-yüksekliği, başlık ve marka için çizilmiş, Türkçe
  işaretleri temiz. Adaylar sitenin başlıklarıyla çizilip karşılaştırıldı
  (Urbanist, Outfit, Red Hat Display, Syne, Jost, Kumbh Sans, Sora): Syne'nin
  Türkçe aksanları bozuk, Sora ve Urbanist Poppins'e fazla yakın. Lisans
  alınırsa Biennale `layout.tsx`'teki tek yükleyicide ve `--headline`
  yığınında Gabarito'nun yerine geçer, başka hiçbir yer değişmez.
- **Poppins** (`--display`; operatör, 11 Eki 2026: _"sitede poppins fontu
  olsun"_) gövde, açıklama, etiket, düğme, çip, form ve hukuk metnini,
  ürün adlarını ve liste fiyatlarını yazar. Poppins içinde hiyerarşiyi
  **ağırlık** taşır:

| Ağırlık       | Rol                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| 300 Light     | Büyük manifesto metni (anasayfa `.home-intro`) - tek yer                                                    |
| 400 Regular   | Gövde, `.lede`, açıklama, form metni                                                                        |
| 500 Medium    | Menü bağlantıları, ikincil etiket, küçük resim adı                                                          |
| 600 SemiBold  | `.h3`, düğme, `.eyebrow`, `.label`, çip                                                                     |
| 700 Bold      | `.h1`, `.h2`, kart başlığı, fiyat                                                                           |
| 800 ExtraBold | Gösterim anları: hero başlığı, `.h-display`, büyük rakamlar, manifesto ilk cümlesi, kampanya panosu başlığı |

Poppins'in altı kesimi (`--font-display`) ve Gabarito'nun üç kesimi
(600 · 700 · 800, `--font-headline`) `next/font/google` ile self-host edilir,
Türkçe için `latin-ext` ile. Tarihsel token'ların hepsi (`--sans`,
`--serif`, `--serif-modern`, `--serif-display`, `--script`, `--mono`)
`--display`'e çözülür; `--headline`'ın son yedeği de `--display`'dir, eksik
bir kesim sistem yazısına değil Poppins'e düşer. `tests/brand-theme.test.ts`
iki sesi ve hangi sınıfın hangisini okuduğunu kilitler, Inter'in bir yazı
yığınına geri girmesini engeller.

| Sınıf           | Ağırlık | Not                                              |
| --------------- | ------- | ------------------------------------------------ |
| `.h-display`    | 800     | Gabarito; negatif harf aralığı (-0.035em)        |
| `.hero-x-title` | 800     | Gabarito; -0.04em, satır aralığı 0.98            |
| `.h1`, `.h2`    | 700     | Gabarito                                         |
| `.h3`           | 600     | Gabarito                                         |
| `.lede`, gövde  | 400     | 16px / 1.6 - Poppins geniş, biraz daha ara ister |
| `.eyebrow`      | 600     | **Cümle düzeni**, yeşil, 13.5px                  |
| `.label`        | 600     | Form alanı başlığı, cümle düzeni                 |

**Uygulamadan ayrışma.** lafmobil iki sesle yazar ama başka bir çiftle
(Poppins gösterir, Inter okutur - BRAND-IDENTITY §2). Site 11 Eki 2026'da
tek sese, 14 Eki 2026'da Gabarito + Poppins çiftine operatör kararıyla geçti;
uygulamanın da izlemesi ayrı bir karar ve lafmobil'de ayrı bir iştir. Palet
ayrışmadı.

**Büyük harfli, geniş aralıklı etiket dili emekli.** Uygulama etiketleri
cümle düzeninde yazar; site de öyle. `.eyebrow.caps` yalnız kart baskısında kalır
(üyelik, seviye, damga kartı) - uygulamanın `eyebrow` rolü.

`.script` bir yazı tipi değil, **başlıktaki vurgu kelimesi**: başlığın kendi
sesi (Gabarito),
`--accent` rengi, koyu zeminde `--accent-on-dark`.

Rakamlar: Poppins'in (Google kesimi) `tnum` özelliği yok, rakamları
orantılı. Sitede yerinde sayan bir sayı yok; fiyatlar kutularına göre
hizalanır. `.tabular` yalnız yazı yüklenirken yedek yazıyı sabitler.

**Ok ve simgeler:** Poppins'te ok (→ ↗) ve simge glifi yok. Etiketin
ardındaki ok `.arrow` (dış bağlantı için `.arrow.out`) ile **çizilir**: kapı
oklarıyla aynı çizgi, `currentColor` ile maske - her düğme renginde etiketin
rengini alır. Markupta `→` kalır (CSS'siz okuyan için), boyanmaz. Diğer
simgeler (★ ✓) sistem yazısına düşer.

**Başlıkta nokta yok.** `h1`–`h3` ve başlıktaki vurgu kelimesi (`.script`)
noktayla bitmez: "Kahve hazır, sayfa değil", "Postane, Tuzla" (operatör, 26 Eyl
2026). Gövde metni noktalamasını korur; tescilli slogan "Drink it. Eat the
cup." kendi iç noktalarını korur. `tests/heading-punctuation.test.ts` tutar.

**Tire:** Arayüz metninde uzun tire (U+2014) ve orta tire (U+2013) kullanılmaz,
düz tire (`-`) kullanılır. Bu API'nin döndüğü etiketler için de geçerlidir.

---

## 3. Ölçü, yarıçap, gölge

```
--content        1280px      içerik genişliği
--content-wide   1480px
--content-narrow 880px       uzun metin
--gutter         clamp(16px, 4vw, 44px)

--r-sm     10px    küçük kontrol
--r-md     14px    girdi, bilgi kutusu
--r-panel  20px    panel, açılır menü
--r-lg     22px    kart
--r-card   28px    büyük kart, sheet (uygulamanın radius.card)
--r-xl     28px    bölüm bloğu
--r-btn    999px   düğme - kapsül
--r-pill   999px   çip, rozet, sayaç
```

**Gölgeler sıcak topraktır**: `#3B2A1E` (59,42,30), en fazla %12 - nötr siyah
porselende griye kaçar. `--shadow-glass` kart, `--shadow-lift` seçili /
basılabilir öğe, `--shadow-chrome` yüzen krom. Odak halkası `--ring`: 4px
yeşil, %18.

---

## 4. Bileşen dili

**Düğmeler kapsüldür** (`--r-btn: 999px`), 48px yüksek, Poppins 600. Basınca
`scale(0.97)` (uygulamanın `motion.pressScale`), yay eğrisiyle geri döner.

| Sınıf             | Dolgu             | Metin        | Ne zaman                           |
| ----------------- | ----------------- | ------------ | ---------------------------------- |
| `.btn-primary`    | `--green`         | `#fbf8f4`    | Sayfadaki birincil eylem           |
| `.btn-ink`        | `--ink`           | `#fbf8f4`    | Sepet / ödeme: ticari son adım     |
| `.btn-ghost`      | cam               | `--ink`      | İkincil                            |
| `.btn-outline`    | cam, yeşil etiket | `--green`    | Yeşilin yanındaki ikincil          |
| `.btn-gold`       | `--gold-soft`     | `--gold-ink` | Ödül: kupon, abonelik              |
| `.btn-light`      | beyaz             | `--green`    | Koyu blok içinde                   |
| `.btn-glass-dark` | beyaz %14 cam     | krem         | Kadife / yeşil blok içinde ikincil |

**Seçili durum** (çip, kategori, gün): opak beyaz + `--rim` + `--shadow-lift`

- uygulamanın "seçilen öne çıkar" dili. Birincil seçim (ör. saat) yeşil dolgu.

**Kartlar** cam: `--glass` + 1px `--ink-line` + `--rim` + `--shadow-glass`,
`--r-lg` ya da `--r-card`. Kenarlıkla değil ışıkla ayrılır.

**Gruplu liste** (saatler, SSS, hesap menüsü, sepet): iOS "inset grouped" -
tek beyaz kap, satırlar arası hairline.

**Başlık (header)**: tek kat, yapışkan cam (`--glass-chrome` + blur).
Kaydırınca hairline ve gölge belirir. 760px altında uygulamanın **sekme
çubuğu** yüzen cam kapsül olarak altta durur (Anasayfa, Menü, Mağaza, Sepet,
Hesabım); menü sayfası iOS ayarlar listesi gibi gruplu bir sheet'tir.

**Altbilgi**: uygulama ikonunun kendisi - `#23876a` → `#1d6d56` → `#0c3b2d`
radyal yeşil, krem L'Af, pirinç çekirdek. Üstte uygulama kartı ve bülten.

### 4.1 Sayfa mobilyası

| Parça                          | Nerede                   | Ne yapar                                                                      |
| ------------------------------ | ------------------------ | ----------------------------------------------------------------------------- |
| `<PageHero>` (`page-hero.tsx`) | Anasayfa dışı her sayfa  | Porselen panel, köşede sayfanın sahne ışığı, L'Af filigranı.                  |
| `.section-title`               | Sayfa içi blok başlığı   | Altında tricolore çizgisi olan h2.                                            |
| `.band-cream`                  | Uzun sayfalarda ritim    | Bölümü açık şeride alır.                                                      |
| `.seo-block`                   | Sayfa sonu SSS           | Gruplu liste SSS + rehber çipleri.                                            |
| `.auth-page` / `.auth-card`    | `/uye/*` giriş sayfaları | Porselen üzerinde tek cam kart, başında L'Af.                                 |
| `.nf-*`                        | 404 ve hata sınırı       | Harflerin içinden kahve yükselen L'Af (uygulamanın açılışı).                  |
| `.home-intro`                  | Anasayfa, hero'nun altı  | Panelin "Hero üst etiket" + "Hero açıklama" metni: ilk cümle 800, devamı 300. |
| `.hero-x-status`               | Anasayfa hero'su         | Canlı "Şu an açık · Kapanış 02:00"; /ziyaret'in saat satırıyla aynı kaynak.   |

`<PageHero scene="…">` her sayfaya kendi ışığını verir: menü latte, mağaza
karamel, kampanyalar narenciye, karaoke böğürtlen, hikaye kadife, ziyaret ev
yeşili, hukuk porselen, rehber matcha.

---

## 5. Logo - L'Af

Operatör, 25 Eyl 2026: _"logomuz L'Af"_. İşaret uygulama ikonunun
harfleridir: **L + kahve çekirdeği kesme işareti + A + f**. Vektör
`public/brand/`:

- `laf-mark.svg` - tek parça (maske, filigran, 404)
- `laf-letters.svg` + `laf-bean.svg` - iki renkli kullanım için ayrı katmanlar

`<LafMark tone="…">` (`brand-mark.tsx`) iki CSS maskesiyle boyar; tek dosya,
her zemin:

| Ton     | Harfler  | Çekirdek | Nerede                         |
| ------- | -------- | -------- | ------------------------------ |
| `duo`   | mürekkep | pirinç   | Başlık, giriş kartları, 404    |
| `ink`   | mürekkep | mürekkep | Sessiz kullanım                |
| `green` | yeşil    | pirinç   | Nötr zeminde marka anı         |
| `cream` | krem     | pirinç   | Yeşil bloklar - uygulama ikonu |

Uygulama ikonu (`public/brand/app-icon-*.png`, favicon, apple-icon): yeşil
zemin, krem harfler, pirinç çekirdek; maskelenebilir kesim işareti %80
dairenin içinde tutar. `global-error.tsx` stil dosyası yüklenmemiş olabileceği
için işareti satır içi SVG yolu olarak basar (`laf-paths.ts`).

İşaret çarpıtılmaz, döndürülmez, kontur eklenmez; çevresinde en az çekirdek
genişliği kadar boşluk bırakılır.

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

- Geçişler `--ease-out` = `cubic-bezier(0.2, 0.7, 0.2, 1)`; yerine oturan
  her şey (sheet, açılır panel) `--ease-spring` =
  `cubic-bezier(0.32, 0.72, 0, 1)`.
- Basma: `scale(var(--press-scale))` = 0.97, 120 ms.
- 404'te kahve harflerin içinden bir kez yükselir, buhar bir kez çıkar; her
  hareket beş saniyede biter (WCAG 2.2.2).
- Hero slaytı 7 sn'de döner; saati seçili küçük resmin altındaki ilerleme
  çizgisidir (animasyonu bitince slayt değişir, duraklatınca tam yerinde
  durur). Bir kontrole dokunulduğunda ya da sahne kaydırıldığında **kalıcı
  olarak** durur, imleç/odak üzerindeyken ve sekme arka plandayken duraklar,
  `prefers-reduced-motion` altında hiç başlamaz. Noktalar kaldırıldı: küçük
  resimler kontroldür.
- Hero'daki canlı "açık" noktası iki halka atar ve durur (4 sn, WCAG 2.2.2).
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
3. `globals.css` dışındaki yüzeyler CSS değişkeni çözemez ve paleti harfi
   harfine yazar - değiştirirsen hepsini güncelle: `src/app/manifest.ts`
   (PWA açılışı), `src/app/layout.tsx` (`themeColor`), `public/browserconfig.xml`,
   `src/app/global-error.tsx`, `src/app/opengraph-image.tsx` (bağlantı
   önizlemesi), `src/lib/email/templates/*.html` (işlemsel e-posta),
   `src/app/odeme/paynkolay/route.ts` (ödeme köprüsü).
4. Kaynak uygulamadır: bir değeri değiştirmeden önce `lafmobil/src/theme/tokens.ts`
   ile karşılaştır; ayrışma operatör kararı olmadan yapılmaz.
5. Bu belgeyi de güncelle.

---

## 9. Geçmiş

| Tarih       | Karar                                                                                                                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 Eyl 2026  | Site paleti uygulamanınkine eşitlendi.                                                                                                                                                                                                 |
| 5 Eyl 2026  | Köşk yeniden tasarımı: beyaz zemin, ev yeşili `#143d2b`.                                                                                                                                                                               |
| 6 Eyl 2026  | Referans tasarım: Montserrat, 8px dikdörtgen düğme.                                                                                                                                                                                    |
| 7 Eyl 2026  | Tricolore: vurgu bordo `#84233c` / `#4a0f1e` / `#f6e9ec`.                                                                                                                                                                              |
| 23 Eyl 2026 | Uygulama kendi paletine geçti (karar 149); site almadı.                                                                                                                                                                                |
| 25 Eyl 2026 | **Site uygulamayı izler** (karar 31, seçenek c): porselen `#f7f3ed`, yeşil `#1d6d56`, bordo `#9d2543`, pirinç `#e8c877`, Poppins + Inter, cam, kapsül. Logo L'Af.                                                                      |
| 11 Eki 2026 | **Tek ses Poppins** (operatör): Inter kalktı, gövde de Poppins; 300-800 altı kesim, gösterim anlarında 800. Anasayfa: slayt başına kendi metni, manifesto bandı, canlı açık/kapalı, çizilen oklar. Dök oyunu Cormorant yerine Poppins. |
| 14 Eki 2026 | **Başlıklar Gabarito** (operatör: "sitede yapay zeka gibi duruyor, yazı tipleri poppins ve biennale vs kullan"): Biennale lisanssız olduğu için en yakın serbest akrabası Gabarito başlıkları ve gösterim rakamlarını yazar (`--headline`); gövde, kontrol, ürün adı ve liste fiyatı Poppins'te kalır. |

Bağlantı önizlemesi (`opengraph-image.tsx`), JSON-LD ikonları
(`scripts/gen-icons.mjs` → `public/icon-*.png`) ve PayNkolay köprüsü de
uygulama paletine taşındı. Köşk yeşilinde kalan tek yüzey e-posta
şablonlarıdır: `#143d2b` bant görsellerine, logo glint GIF'ine (Outlook'un
gösterdiği ilk kare) ve rozetlere gömülü olduğundan HTML ancak görsellerle
birlikte taşınabilir. `tests/brand-theme.test.ts` o yüzeyi şimdilik
`#143d2b` üzerinde tutar.
