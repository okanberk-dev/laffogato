# BRAND - L'Affogato marka kimliği

> Bu belge **web sitesinin** görsel kimliğidir ve tek kaynağı
> `src/app/globals.css` içindeki `:root` bloğudur. Buradaki her değer oradan
> okunmuştur; ikisi çelişirse **globals.css doğrudur** ve bu belge güncellenir.
>
> **Roast (11 Kas 2026, operatör).** Talimat: _"siteyi tamamen
> https://coffee-beans-swart.vercel.app/ bu sitedeki gibi landingleri diğer
> sayfaları yap, three js vs. ne varsa kullan, aynı birebir yap ve bizde daha
> fazla özellik olduğu için de bize uyarlayarak yap."_ Site o sayfanın
> **görünümünü** aldı: krem zemin, mürekkep, dolu düğme, koyu bant ve footer
> için **tek bir espresso**, sıcak dolgu olarak amber, başlıkta Abril Fatface
> ve metinde Plus Jakarta Sans, kaydırmayla ilerleyen bir three.js girişi ve
> iki three.js bandı. **Dosyası, metni ve kodu kopyalanmadı**: oranları,
> yazısı, rengi ve hareketi ölçüldü, konular (çekirdek, dökülen espresso,
> affogato kupası) canlı çizildi. Tasarım kaydı `docs/REDESIGN-ROAST.md`.
> Site artık lafmobil'in paletini izlemez (5 Kas 2026'dan beri). Panel
> (`/admin`) bu değişiklikten etkilenmez. Güncel değerler aşağıdaki
> §0'dadır; §1-§4'te onlarla çelişen eski değerler (porselen, kafe-perakende)
> tarihçedir. 5 Kas 2026 kafe-perakende düzeni ve önceki paletler §9'da.
>
> **Yolculuk (17 Kas 2026, operatör).** Talimat: _"sitede aşağıdaki promptu
> uygula ve kahveciye uygun hale getir sonra maine gönder"_ ("alpha project"
> build promptu). Anasayfanın girişi, kaydırmanın oynattığı 120 karelik bir
> filmdir: kavrulmuş çekirdek yığınının içinden bardaki affogatoya. Girişteki
> three.js çekirdeğinin yerini aldı; sayfanın geri kalanı ve diğer sayfalar
> Roast'tır. Sitede Instrument Sans ve Instrument Serif italikle yazılan tek
> yer burasıdır. Tasarım kaydı `docs/JOURNEY.md`, özet §0'ın sonunda.
>
> Nöbetçi testler: `tests/brand-theme.test.ts` (paletin kaymasını engeller) ve
> `tests/contrast.test.ts` (okunabilirliği engeller). Önceki (Köşk) palet §9'da.

---

## 0. Roast (11 Kas 2026) - güncel değerler

Tasarım kaydı **`docs/REDESIGN-ROAST.md`**: referans sayfanın ölçüleri, ana
sayfanın bölüm bölüm karşılığı, hareket takımı ve canlı çizimler oradadır.
Bu bölüm değerleri ve rolleri verir. Token **adları değişmedi**; `--green-*`
ailesi bugün espressodur.

| Token                  | Değer                 | Rol                                                                 |
| ---------------------- | --------------------- | ------------------------------------------------------------------- |
| `--bg`                 | `#faf7f2`             | Krem sayfa zemini (referansın tuvali); saf beyaz zemin yok.         |
| `--bg-warm`            | `#fdfcf9`             | Beyaza yakın içerik bandı.                                          |
| `--bg-stone`           | `#f0eae1`             | Taş: bölge ayırıcı, çökük yüzey.                                    |
| `--bg-cream`           | `#f7efe2`             | Krem kart ve ödül bölümlerinin yıkaması.                            |
| `--surface`            | `#ffffff`             | Kart, modal, alan.                                                  |
| `--ink`                | `#23120b`             | Espresso mürekkep (zeminde 16.90:1). `--ink-soft` `#57463d` (8.37:1), `--ink-mute` `#6b5a50` (6.13:1); `--ink-quiet` `#9a8c82` yalnız süs ve nokta (3.05:1, metin değil). |
| `--green-cta`          | `#23120b`             | **Aynı espresso**, eski adlarıyla: her dolu düğme ve yüzen sipariş düğmesi (krem etiket 16.90:1). `--green`, `--brand`, `--green-brand`, `--green-house` (koyu bant), `--bg-espresso`, `--hero-green` ve yeni `--roast` aynı değerdir. Basılı hâl `--green-cta-pressed` / `--roast-raise` `#3a241a`. |
| `--green-uplift`       | `#4a3327`             | Koyu bandın içindeki kart ve süsler.                                |
| `--green-light`        | `#efe6da`             | Açık kum yıkaması; `--green-mint` `#e9dfd2` koyu zeminde üst etiket (13.72:1). |
| `--night`              | `#23120b`             | Footer zemini: espressonun kendisi. `--night-raise` `#2f1c13` hap ve kart, `--night-line` `#4a372c` çizgi, metin `--night-ink` / `-soft` / `-mute` (16.90 · 11.31 · 7.27:1; `-mute` kabarık hapta 6.52:1). En koyu adım `--bg-espresso-deep` `#170b06`. |
| `--amber`              | `#de853a`             | **Amber** (= `--accent-on-dark`): tek sıcak düğmenin dolgusu (`.btn-amber`; üstünde espresso 6.47:1, üzerine gelince `--amber-raise` `#e2934d` 7.32:1) ve **koyu zeminde** vurgu metni (espressoda 6.47:1). Krem üstünde 2.61:1: orada metin olamaz. |
| `--accent`             | `#a35019`             | **Karamel**: amberin krem üstünde metin olarak okunan hâli (zeminde 5.28:1, beyazda 5.65:1, taşta 4.72:1): bağlantı, vurgu kelimesi, üzerine gelme. `--accent-deep` `#6f350d` basılı hâl, `--accent-soft` `#fbead9` yıkama. Koyu zeminde kullanılmaz (3.20:1). |
| `--gold-soft`          | `#cba258`             | **Yalnız ödül**: damga, kademe, ödül düğmesi (üstünde mürekkep 7.61:1); metin altını `--gold` `#765923` (6.10:1). Değişmedi. |
| `--matcha`             | `#1d6d56`             | Sitede kalan **tek yeşil**: olumlu durum ("açık", "stokta", "kaydedildi"; zeminde 5.82:1). Marka rengi değildir; başka hiçbir token bu değeri taşımaz. |
| `--rose`               | `#c82014`             | Hata ve "son adet" (5.35:1). "Kapalı" kırmızı yazılmaz: sakin mürekkep. |

Oranlar 11 Kas 2026'da `:root` değerlerinden, `tests/contrast.test.ts`'in
formülüyle (WCAG 2.1) hesaplandı; aynı test bu çiftleri AA'da (4.5:1) tutar.

- **Karamel ile espresso üst üste yazılmaz.** `--accent` koyu zeminlerde
  3.20-3.42:1'dir; orada vurgu `--accent-on-dark` (amber) ile yazılır.
  `.script` bunu `--script-ink` ile kendiliğinden yapar; koyu bir blok
  yazarken `data-ground="dark"` eklemek yeterlidir. Tersi de kuraldır: amber
  krem üstünde metin olmaz. (11 Kas 2026'ya kadar bu kural "bordo ile yeşil"
  diye yazılırdı.)
- **Yazı:** iki ses. Başlık **Abril Fatface** (`--headline`: tek kesim 400,
  büyük harf CSS'le, 20px ve üstü, asla cümle, asla kalın), gerisi **Plus
  Jakarta Sans** (`--display` = `--sans`; değişken 200-800). Kurallar §2'de.
  `--reward-serif` `--headline`'a çözülür; izleme `--tracking: -0.01em`.
- **Düğme:** tam hap (`--r-btn: 999px`), 44px (dokunma tabanı; `.btn-sm`
  36px, `.btn-lg` 52px), 12px kalın büyük harf, aralık `--caps-button`,
  basınca `scale(0.95)`. `.btn-primary` espresso dolu; `.btn-ghost` çerçeveli,
  üzerine gelince dolar; `.btn-outline` sakin çerçeveli; koyu zeminde
  `.btn-light` ve `.btn-glass-dark`; tek sıcak düğme `.btn-amber`; yalnız
  ödülde `.btn-gold`. Etiketin ardındaki ok çizilir (`.arrow`).
- **Yüzey:** kart 16px (`--r-card`), alan 10px, düğme ve çip tam hap.
  Gölgeler espresso tonludur (`rgba(35, 18, 11, …)`), asla siyah
  (`--shadow-card`, `--shadow-nav`, `--shadow-md`, `--shadow-lg`,
  `--shadow-frap`). `--glass-*` adları durur ve opaktır (`--glass-blur:
  none`); yarı saydam tek malzeme **buzlu krem**dir (`--frost`,
  `--frost-chrome`, `--frost-blur` 12px, `--frost-line`): üst çubuk ve buzlu
  kart (`.frost-card`). Bölüm mobilyası: kaydırma ipucu (`.scroll-hint`),
  yaprak gölgesi zemini (`/brand/roast-shadow.svg`). Hayalet rakam, üç
  nokta ve "Bölüm N:" sayacı 12 Kas 2026'da kalktı (bir kafe ziyaretçisine
  bölüm numarası bir şey söylemez; şablon gibi okunuyordu).
- **Üst çubuk:** sayfanın başında saydam; 30px kaydırınca buzlu krem olur
  (zemin %95 + 12px bulanıklık, `--shadow-nav`, taş ince çizgi) ve daralır:
  68 → 60 px, 768px'ten 84 → 64, 1024px'ten 96 → 68. İçerik 80rem, yan
  boşluk 24 · 40 · 56 px; bağlantılar 12px kalın büyük harf
  (`--caps-nav`). `backdrop-filter` yoksa çubuk opaktır.
- **Yüzen sipariş düğmesi** (`.frap`): sağ altta 56px espresso daire
  (`--green-cta`), espresso footer üstünde de seçilsin diye ince bir
  `--night-line` halkası, sayfanın en yüksek gölgesi (`--shadow-frap`);
  sepeti açar; telefonda (sekme çubuğu sepeti taşır) ve `/odeme`'de yok.
- **Footer:** üstte 6 Kas 2026'nın resimli bandı durur (`footer-night.tsx`:
  gece köşkü, artık aynı espressoda, krem ve amberle aydınlanır; üstünde
  yeşil yok), altında `--night` espresso zemin: küçük aralıklı büyük harf
  başlıklar, ambere ısınan sakin bağlantılar, satır aralarında ince
  çizgiler, hap biçiminde bülten alanı ve tek amber düğme. İçerik 80rem.
- **Canlı çizimler ve hareket:** §7.
- **Kapsam dışı (eski palette kaldı):** e-posta şablonları, bağlantı
  önizleme kartları, JSON-LD ikonları, `browserconfig.xml` karosu ve
  PayNkolay köprüsü hâlâ logo yeşili `#1d6d56` üstündeki eski palettedir;
  taşınmaları ayrı iştir ve `tests/brand-theme.test.ts` onları olduğu gibi
  tutar. Panel (`/admin`) kendi görünümündedir.

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

**İki ses: başlıkta Abril Fatface, metinde ve kontrolde Plus Jakarta Sans**
(operatör, 11 Kas 2026; referans sayfanın iki yazısı, `docs/REDESIGN-ROAST.md`).

- **Abril Fatface** (`--headline`, `--font-headline`) sayfa, bölüm ve kart
  başlıklarını (`.h-display`, `.h1`-`.h3`, `.section-title`, `.pdp-title`)
  ve gösterim rakamlarını (`.stat-n`) yazar. Şişman bir didone, **tek kesim:
  400**. Kuralları:
  - **Kalın yazılmaz.** `font-weight: 400`; 600 istenirse tarayıcı sahte
    kalın üretir ve harf bulanır, bu yüzden `html` `font-synthesis-weight:
    none` taşır.
  - **Gösterim yazısıdır:** 20px ve üstü, asla bir cümle. 20px'in altında
    kalan küçük başlık `--display` 700'e geçer.
  - **Büyük harf CSS'ledir** (`text-transform: uppercase`), elle yazılmaz:
    Türkçe büyük harf (i → İ, ı → I) `<html lang="tr">`'den gelir. `.h3`
    cümle düzeninde kalır (kartta 22px büyük harf bağırır).
  - **Türkçe satır aralığı.** Büyük harfler üstte (İ Ö Ü Ğ) ve altta (Ç Ş)
    işaret taşır; çok satırlı başlıklar referansın 0.86-0.92'si yerine
    0.96-1.0 ile dizilir. Yalnız işaret taşımadığı bilinen bir satır daha
    sıkı olabilir.
- **Plus Jakarta Sans** (`--display`, `--font-display`; değişken, 200-800)
  gövde, açıklama, etiket, düğme, çip, form ve hukuk metnini, ürün adlarını
  ve liste fiyatlarını yazar. Hiyerarşiyi **ağırlık** taşır: 400-500 gövde,
  600 etiket, 700 düğme ve üst etiket, 800 logo yazısı ve vurgu.

İkisi de `next/font/google` ile self-host edilir (`layout.tsx`), Türkçe
için `latin-ext` ile; Plus Jakarta Sans değişken olduğu için tek dosya bütün
ağırlıkları taşır. Tarihsel token'ların hepsi (`--sans`, `--serif`,
`--serif-modern`, `--serif-display`, `--script`, `--mono`) `--display`'e
çözülür; `--headline` kendi yığınıdır (Abril Fatface, sonra sistem
serifleri) ve `--reward-serif` ona çözülür. `tests/brand-theme.test.ts` iki
sesi, tek kesimi ve hangi sınıfın hangisini okuduğunu kilitler; Poppins,
Gabarito ve Inter'in bir yazı yığınına geri girmesini engeller.

| Sınıf           | Yazı / ağırlık        | Not                                                          |
| --------------- | --------------------- | ------------------------------------------------------------ |
| `.h-display`    | Abril 400             | 40-96px, büyük harf, satır 0.96, harf aralığı -0.025em       |
| `.h1`           | Abril 400             | 31-72px, büyük harf, satır 0.98                              |
| `.h2`           | Abril 400             | 26-52px, büyük harf, satır 1.0                               |
| `.h3`           | Abril 400             | 20-26px, **cümle düzeni**, satır 1.15                        |
| `.lede`         | Plus Jakarta Sans 400 | 15-17px / 1.65, `--ink-soft`, en çok 46ch                    |
| `.eyebrow`      | Plus Jakarta Sans 700 | 12px, **büyük harf**, aralık `--caps-kicker` 0.16em, mürekkep |
| `.btn`          | Plus Jakarta Sans 700 | 12px, büyük harf, aralık `--caps-button` 0.05em              |
| Menü bağlantısı | Plus Jakarta Sans 700 | 12px, büyük harf, aralık `--caps-nav` 0.12em                 |

**Uygulamadan ayrışma.** lafmobil başka bir çiftle yazar (Poppins gösterir,
Inter okutur - BRAND-IDENTITY §2). Site 11 Eki 2026'da tek ses Poppins'e,
14 Eki 2026'da Gabarito + Poppins çiftine, 5 Kas 2026'da yeniden tek ses
Poppins'e, 11 Kas 2026'da Abril Fatface + Plus Jakarta Sans'a operatör
kararıyla geçti; uygulamanın izlemesi ayrı bir karar ve lafmobil'de ayrı bir
iştir.

**Büyük harfli, aralıklı etiket dili geri geldi (11 Kas 2026).** Üst etiket
(`.eyebrow`), düğme ve menü bağlantısı 11-12px kalın büyük harfle, üç ayrı
aralıkla yazılır (`--caps-kicker` 0.16em, `--caps-button` 0.05em,
`--caps-nav` 0.12em). Büyük harf yine CSS'tedir; markup cümle düzeninde
kalır ("İmza ürün"). Etiket bir sözcüktür, bölüm numarası değil (12 Kas
2026). 25 Eyl - 11 Kas 2026 arasında etiketler cümle düzenindeydi.

`.script` bir yazı tipi değil, **başlıktaki vurgu kelimesi**: başlığın kendi
sesi (Abril Fatface), `--accent` rengi (karamel), koyu zeminde
`--accent-on-dark` (amber).

Rakamlar: sitede yerinde sayan bir sayı yok; fiyatlar kutularına göre
hizalanır. `.tabular` ve `.eyebrow` tablo rakamı ister (`tnum`).

**Ok ve simgeler:** iki yazının da kullanmaya değer ok glifi yok. Etiketin
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
| `<PageHero>` (`page-hero.tsx`) | Anasayfa dışı her sayfa  | Porselen panel, köşede sahne ışığı, L'Af filigranı; `art` ile çizim (§6.1).   |
| `.section-title`               | Sayfa içi blok başlığı   | Altında tricolore çizgisi olan h2.                                            |
| `.band-cream`                  | Uzun sayfalarda ritim    | Bölümü açık şeride alır.                                                      |
| `.seo-block`                   | Sayfa sonu SSS           | Gruplu liste SSS + rehber çipleri.                                            |
| `.auth-page` / `.auth-card`    | `/uye/*` giriş sayfaları | Porselen üzerinde tek cam kart, başında L'Af.                                 |
| `.nf-*`                        | 404 ve hata sınırı       | Harflerin içinden kahve yükselen L'Af (uygulamanın açılışı).                  |
| `<HomeJourney>` (`journey/home-journey.tsx`) | Anasayfanın ilk ekranı   | Yolculuk (17 Kas 2026, `docs/JOURNEY.md`): krem ön yükleyici sayar ve yanarak açılır; sabitlenmiş sahnede kaydırmanın oynattığı film (çekirdek yığınından affogatoya, derinlik paralaksı), üç metin bloğu ("Çekirdekten başlar. / Kupada biter." …), iki cam kart, canlı açık/kapalı, "Menüyü keşfet", halka imleç. Anasayfanın tek girişi. 11-17 Kas 2026 arası buradaki Roast girişi ("UYAN / KAHVE HAZIR", `home-roast.tsx`) kaldırıldı. |
| `<RoastStage>` + `<RoastPause>` (`roast-stage.tsx`) | İki bant | Canlı three.js çizimi (`pour` · `affogato`; `bean` 17 Kas 2026'dan beri kullanılmıyor) ve durdur düğmesi; altında aynı konunun düz SVG çizimi (§7). |
| `.home-intro`                  | Anasayfa, A bandı        | Panelin "Hero üst etiket" + "Hero açıklama" metni: ilk cümle küçük başlık (Abril, büyük harf), devamı üç satıra kırpılır. |
| `.roast-status`                | Anasayfa girişi          | Canlı "Şu an açık · Kapanış 02:00"; /ziyaret'in saat satırıyla aynı kaynak.   |
| `.ghost-n` · `.frost-card` · `.dots-trio` · `.scroll-hint` | Bölüm açılışları | Referansın küçük parçaları: hayalet rakam, buzlu kart, üç nokta, kaydırma ipucu. |
| `.home-karaoke`                | Anasayfa, girişin altı   | Karaoke bandı: oda çizimi, panelin değerleri, bugünün boş saatleri.           |
| `<Illustration>`               | Çizim gereken her yer    | `public/illustrations/` dosyası, `alt=""` ve `aria-hidden` (§6.1).            |

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

### 6.1 Çizimler

Operatör, 17 Eki 2026: _"websitesine de birkaç görsel çizip görsel gereken
yerlere ekle"_. Fotoğrafı olmayan yerler (boş durumlar, fotoğrafsız kampanya
kartı, hikaye satırları, rehber kartları, bülten, menü araması) kendi çizimini
taşır.
Kurallar karaoke odası çiziminden gelir (`karaoke-room.webp`, uygulamayla aynı
dosya):

- Düz dolgu, 2 px espresso kontur, en çok altı renk: orman `#1E4031`, bordo
  `#6B1A2B`, krem `#FFF2E4`, pembe `#F59BBE`, fıstık `#9FCB82`, espresso
  `#2E1A12`. Gradyan, filtre ve saydamlık yok; zemin saydam, porselenin
  üstünde durur.
- Elle yazılmış SVG, her biri 15 KB altında, `public/illustrations/`; kayıt
  `illustration.tsx` (`ILLUSTRATIONS`). Sayfalar yalnız `<Illustration>` ile
  basar: `alt=""` ve `aria-hidden`, anlamı yanındaki başlık taşır.
- Bu altı renk yalnız çizimlerin içinde yaşar; düğme ve yazı `globals.css`
  token'larında kalır (`tests/brand-theme.test.ts`).
- L'Af işareti kol bandında, bilette, etikette durur, hiçbir zaman daire
  içinde değil: hesaptaki karaoke boş durumu bu yüzden yuvarlatılmış karedir.
  Çizimde yazı yok; tedarikçi adı da, bardağın neyden yapıldığına dair söz de
  girmez.
- Hero'nun dördüncü slaytı içecek değil, oda çiziminden kesilmiş mikrofondur
  (`karaoke-mic-cut.webp`, içeceklerin kesimleri gibi 581×942, saydam),
  böğürtlen ışığında.
- Her çizim ilk bakışta ne olduğunu söyler: boş sipariş listesi bir kafe
  fişidir (kağıt rulosu tuvalet kağıdı gibi okunuyordu); menüde sonuçsuz
  arama boş bir fincan tabağı, kaşık ve tek çekirdek, ürünü kalmamış kategori
  ise cam fanuslu boş bir kek standıdır ("Bu kategoride şu an ürün yok").
- Dosyalar içerikten adlanmaz; `/illustrations/*` marka görselleri gibi bir
  gün tarayıcıda, bir hafta arka planda yenilenerek önbelleğe girer
  (`next.config.ts`). Aynı adla yeniden çizilen bir dosyanın eskisi bir gün
  daha görünebilir, sonraki ilk ziyarette arkada yenilenir.

`tests/site-illustrations.test.ts` boyutu, renkleri, konturu, `aria-hidden`'ı
ve her çizimin yerini tutar.

---

## 7. Hareket

- Geçişler `--ease-out` = `cubic-bezier(0.25, 0.46, 0.45, 0.94)`; yerine
  oturan her şey (sheet, açılır panel) `--ease-spring` =
  `cubic-bezier(0.32, 0.72, 0, 1)`; maskeden yükselen yazı `--ease-rise` =
  `cubic-bezier(0.16, 1, 0.3, 1)`.
- Basma: `scale(var(--press-scale))` = 0.95.
- **Üç canlı çizim** (11 Kas 2026; `<RoastStage kind>`, `roast-stage.tsx` →
  `roast-scene.ts`, three.js): girişte **çekirdek** (`bean`: kavrulmuş bir
  çekirdek uyanır, çatlar, espressoya dönüşür ve bir moka demliği olarak
  yerleşir; sayfa kaydırıldıkça ilerler, giriş 330vh, 640px'ten 360vh ve
  içeriği boyunca sabit), A bandında **dökülen espresso** (`pour`:
  portafiltreden yivli fincana), B bandında **affogato** (`affogato`: küçük
  sürahiden yenen kupadaki fior di latte'ye). Sitede beş saniyeden uzun
  süren hareket bunlardır, bu yüzden:
  - **bir fikrin çizimi değil, eşyanın fotoğrafıdır** (operatör, 12 Kas 2026:
    _"yapay zekaymış gibi gözükmesin"_). Parlama, yörünge çizgisi, kıvılcım,
    havada asılı toz ya da boncuk damla yoktur; iki bantta yalnız sıvı
    hareket eder (fincan tabağında durur, portafiltre asılıdır, akış titrer,
    köpük sürüklenir), yalnız girişin çekirdeği ve demliği havadadır.
    Malzemeler gerçeğidir: dokulu döküm alüminyum, krom çelik, bakalit, sırlı
    kil ve mat taş tabak, saten koyu kavrum, kenarından okunan şeffaf cam;
    espresso iki ince akışla dökülür, sürahi bir elin eğdiği kadar eğiktir.
    Kural ve gerekçesi `docs/REDESIGN-ROAST.md` "A photograph of things"
    (yolculuğun filmi de aynı kuralla çizildi: `docs/JOURNEY.md` §3);
  - her çizimin yanında bir **durdur düğmesi** vardır (`<RoastPause />`,
    "Hareketi durdur" / "Hareketi başlat", `aria-pressed`; 36px daire, 44px
    dokunma alanı). Tek anahtardır: biri basılınca üç çizim de durur, sonradan
    başlayan da durmuş başlar (WCAG 2.2.2). Çizim gerçekten çalışmıyorsa
    düğme de yoktur;
  - çizim **ekran dışındayken ve sekme gizliyken hiç çizilmez**;
    `prefers-reduced-motion` altında **tek durgun karedir**. Girişteki
    yolculuk kendi kendine oynamaz (kaydırmayı izler); azaltılmış harekette
    yanma, giriş animasyonu ve paralaksı yoktur;
  - three.js ilk yüklemede yoktur: yalnız `import()` ile, `load` olayından ve
    boş bir andan sonra gelir; bantların çizimi bant ekrana yaklaşınca başlar.
    WebGL 2 yoksa, "veri tasarrufu" açıksa ya da çizim henüz gelmediyse aynı
    yerde aynı konunun **düz SVG çizimi** durur; tuval ilk karesini çizince
    onun üstünde belirir. Yazı sunucuda basılır ve WebGL'i beklemez;
  - sayfanın kaydırmasını ve dokunuşu tutmaz (`pointer-events: none`; imleci
    yalnız dinler); telefonda gölge geçişi, imleç takibi ve uzak çekirdekler
    yoktur, piksel oranı 1.5'te sınırlıdır.
- **Maskeden yükselen başlık** (`<RevealText>`, `reveal-text.tsx`): başlığın
  her harfi (paragrafın her kelimesi) kendi satırının maskesinin içinden
  yükselir (1.15 sn, `--ease-rise`, harf başına 38 ms, kelime başına 14 ms).
  Yalnız `transform`: opaklıkla solma yoktur, çünkü sayfanın en büyük
  yazısını tarayıcının en büyük boyama kaydından saklardı. Maske, Türkçe büyük
  harflerin işaretleri (İ Ö Ü Ğ, Ç Ş) kesilmesin diye pay bırakır. Başlık
  ekran okuyucuya tek satır olarak okunur (`aria-label` ya da gizli kopya).
- **Çözülen üst etiket** (`<ScrambleText>`, `scramble-text.tsx`): etiket
  soldan sağa çözülür (harf başına 32 ms, her harf 260 ms döner). Sunucu
  bitmiş satırı basar; çözülürken ekran okuyucu gürültüyü değil bitmiş satırı
  alır.
- **Betik olmadan hiçbir şey gizlenmez.** Yazı varsayılan olarak boyanmıştır:
  sayfanın başındaki başlık CSS ile ilk kareden oynar (`rv-load`), ekranın
  altındakileri yalnız `<RevealMotion>` (client) silahlandırır
  (`will-reveal` → `is-in`). `.reveal` (+ `.r1`-`.r4`) düğme, kart ve
  görsel için aynı kuralla 18px yukarı süzülür. `<RevealMotion>` ayrıca harf
  harf bölünen başlığın kaybettiği harf aralığı düzeltmesini (kerning) geri
  koyar.
- Giriş ekranındaki canlı "açık" noktası **hareket etmez** (açıkken
  `--matcha`, kapalıyken sakin mürekkep; kırmızı değil).
- 404'te kahve harflerin içinden bir kez yükselir, buhar bir kez çıkar; her
  hareket beş saniyede biter (WCAG 2.2.2).
- Mağaza hero slaytı 7 sn'de döner; saati seçili küçük resmin altındaki
  ilerleme çizgisidir (animasyonu bitince slayt değişir, duraklatınca tam
  yerinde durur). Bir kontrole dokunulduğunda ya da sahne kaydırıldığında
  **kalıcı olarak** durur, imleç/odak üzerindeyken ve sekme arka plandayken
  duraklar, `prefers-reduced-motion` altında hiç başlamaz.
- Anasayfanın karaoke bandı gelirken oda çiziminin üstünden bir kez ışık
  geçer; sadakat bloğunun dolu damgaları sırayla bir kez basılır. İkisi de
  `prefers-reduced-motion` altında yerinde durur.
- `prefers-reduced-motion: reduce` altında tüm animasyon ve geçişler durur.

---

## 8. Değiştirirken

1. Renk **yalnız** `globals.css :root` içinde değişir. Çağrı noktasına hex
   yazma; bir tonun saydam hâli gerekiyorsa `color-mix(in srgb, var(--token)
   N%, transparent)` yaz, `rgba()` ile rengi yeniden yazma.
2. `npm test` çalıştır. `tests/contrast.test.ts` okunabilirliği,
   `tests/brand-theme.test.ts` paletin kaymasını tutar; ikisi de bilerek
   katıdır çünkü bu palet defalarca kaydı.
3. `globals.css` dışındaki yüzeyler CSS değişkeni çözemez ve paleti harfi
   harfine yazar. Sitenin zeminiyle birlikte değişenler: `src/app/manifest.ts`
   (PWA açılışı) ve `src/app/layout.tsx` (`themeColor`), ikisi de `#faf7f2`.
   Kendi (eski) paletinde kalan ve ayrı taşınacak olanlar: `public/browserconfig.xml`,
   `src/app/global-error.tsx`, `src/lib/seo/og-card.tsx` (bağlantı
   önizlemeleri: kök kart ve sayfa kartları paleti buradan alır),
   `src/lib/email/templates/*.html` (işlemsel e-posta),
   `src/lib/payment/paynkolay-page.ts` (ödeme köprüsü), `public/icon-*.png`.
4. Görünümün kaynağı `docs/REDESIGN-ROAST.md`'dir (11 Kas 2026); site artık
   uygulamanın paletini izlemez. Bir değeri değiştirmek operatör kararı ister.
5. three.js yalnız `roast-scene.ts`'te ve yalnız `import()` ile yüklenir;
   yeni bir canlı çizim `<RoastStage>` ile ve yanında `<RoastPause />` ile
   gelir.
6. Anasayfanın yolculuğu kendi kaydına bağlıdır (`docs/JOURNEY.md`): iki
   yüzü (Instrument Sans, Instrument Serif italik) yalnız orada kullanılır,
   kareleri tek tek dosya olarak değil paket olarak yüklenir.
7. Bu belgeyi de güncelle.

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

| Tarih       | Karar                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 Eyl 2026  | Site paleti uygulamanınkine eşitlendi.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 5 Eyl 2026  | Köşk yeniden tasarımı: beyaz zemin, ev yeşili `#143d2b`.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 6 Eyl 2026  | Referans tasarım: Montserrat, 8px dikdörtgen düğme.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 7 Eyl 2026  | Tricolore: vurgu bordo `#84233c` / `#4a0f1e` / `#f6e9ec`.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 23 Eyl 2026 | Uygulama kendi paletine geçti (karar 149); site almadı.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 25 Eyl 2026 | **Site uygulamayı izler** (karar 31, seçenek c): porselen `#f7f3ed`, yeşil `#1d6d56`, bordo `#9d2543`, pirinç `#e8c877`, Poppins + Inter, cam, kapsül. Logo L'Af.                                                                                                                                                                                                                                                                                                         |
| 11 Eki 2026 | **Tek ses Poppins** (operatör): Inter kalktı, gövde de Poppins; 300-800 altı kesim, gösterim anlarında 800. Anasayfa: slayt başına kendi metni, manifesto bandı, canlı açık/kapalı, çizilen oklar. Dök oyunu Cormorant yerine Poppins.                                                                                                                                                                                                                                    |
| 14 Eki 2026 | **Başlıklar Gabarito** (operatör: "sitede yapay zeka gibi duruyor, yazı tipleri poppins ve biennale vs kullan"): Biennale lisanssız olduğu için en yakın serbest akrabası Gabarito başlıkları ve gösterim rakamlarını yazar (`--headline`); gövde, kontrol, ürün adı ve liste fiyatı Poppins'te kalır.                                                                                                                                                                    |
| 17 Eki 2026 | **Çizimler ve karaoke** (operatör): anasayfada karaoke bandı ve dördüncü hero slaytı (mikrofon kesimi), sadakat bloğunda damga baskısı, fotoğrafı olmayan yerlere elle çizilmiş SVG'ler ve `<PageHero art>` (§6.1).                                                                                                                                                                                                                                                       |
| 21 Eki 2026 | **Admin paneli AkmanOS** (operatör): panel lafmaliyet'in açık temasını ve Geist'i aldı (yukarıda "Admin paneli görünümü"); müşteri sitesinin paleti ve yazısı değişmedi.                                                                                                                                                                                                                                                                                                  |
| 21 Eki 2026 | **Admin paneli yumuşatıldı** (operatör, akşam): zinc yerine sıcak taş, sıcak siyah mürekkep, menü gruplarına beş pastel renk, etkin satır siyah değil grubunun rengi; müşteri sitesi değişmedi.                                                                                                                                                                                                                                                                           |
| 22 Eki 2026 | **Admin paneli Innex** (operatör: "İnnexe geç"): gri zemin üstünde iki beyaz kart, Inter, mavi birincil, sakin kenar çubuğu, Innex bileşenleri (`docs/ADMIN-INNEX.md`); AkmanOS teması lafmaliyet'te kaldı, müşteri sitesi değişmedi.                                                                                                                                                                                                                                     |
| 23 Eki 2026 | **Admin paneli Innex düzenleri** (operatör: "İnnex + diğer yerleri en profesyonel şekilde yap"): KPI şeridi ve referanslar, üç bölgeli sipariş, karaoke rezervasyonu ve müşteri sayfaları, tek satırlık liste araç çubuğu, karaoke takvimi ve doluluk, rapor dönem karşılaştırması ve grafiği değiştiren kart sekmeleri, ürün ve menü hızlı bakış çekmecesi, Faturalar sayacı ve satır adımı, izin tablosu ve son giriş; müşteri sitesi değişmedi.                        |
| 5 Kas 2026  | **Kafe-perakende düzeni** (operatör: "starbucks tarzı istiyorum ... ama panel değil"): krem zemin `#f2f0eb`, logo yeşilinden türetilmiş dört yeşil (brand `#1d6d56`, cta `#1f7a5c`, house `#173f35`, uplift `#2a5a4d`), pirinç `#cba258` yalnız ödülde, tek ses Poppins (Gabarito emekli), 12px kart, katmanlı siyah-alfa gölge, cam ve degrade yok, 0.95 basış, yüzen sipariş düğmesi, koyu yeşil footer. lafmobil porseleninden bilinçli ayrışma (§0); panel değişmedi. |
| 6 Kas 2026  | **Gece footer** (sahibin brifi: resimli CTA bandı + koyu footer): ev yeşili gökyüzünde köşk silueti ve buharı samanyoluna dönen fincan, altında `--night` `#181412` espresso zemin, durum hapları, dört sütun (telefonda katlanır). Footer artık ev yeşili değil; ev yeşili bant rengi olarak kalır. |
| 6 Kas 2026  | **Kahve vadisi** (sahibin brifi: gece vadisi, three.js, "kahve çekirdekleri kullanabilirsin"): anasayfanın ilk ekranı sıra sıra kahve fidanlarının gece vadisi (beş yapraklı beyaz kahve çiçekleri, birkaç bordo kiraz, yerde ışıyan çekirdekler, yıldızlar, ışık hüzmeleri), önünde Poppins 600 sıkı "L'Affogato", serif iki satır, yuvarlak menü oku ve "Kaydır ve keşfet". Yazılar sunucuda çizilir ve WebGL'i beklemez; three.js yükten ve boş andan sonra ayrı bir parçayla gelir, WebGL yoksa CSS gece zemini kalır. Renkler `.valley`'nin `--valley-*` jetonlarından (yalnız ışık). Panel slaytları hemen altında, köşkün gece fotoğrafındaki bantta; ad ve serif satır vadiye taşındı. |
| 6 Kas 2026  | **Kahve vadisi, ikinci tur** (sahip: "menü kısmını çıkart ... kahve çekirdeği ekle ... L'Affogato yazısını estetik yap ... yeşil bordo beyaz"): vadinin altındaki içecek bandı (operatörün slaytları) anasayfadan kalktı, slaytlar panelde durur ve `/admin/anasayfa-hero` bunu söyler; canlı açık/kapalı satırı vadiye taşındı. Kavrulmuş çekirdekler öne çıktı (daha çok, daha büyük, havada süzülen ve düşenler), yapraklar küçük kaldı. İsim Poppins değil, uygulamanın logo yazısından düzgünleştirilmiş vektör maske (`public/brand/laffogato-wordmark.svg`), beyazdan kreme, yumuşak parıltı, soldan açılış (ilk harf baştan görünür, LCP beklemez). Renkler ev yeşili gece, bordo ufuk ışığı, beyaz çiçek ve yazı, bordo kiraz; pirinç yalnız çekirdek parıltısında. |
| 6 Kas 2026  | **Ana sayfa ve başlık** (sahibin brifleri): hero köşkün gece fotoğrafında, tam genişlikte "L'Affogato" ve önünde slaydın içeceği, sistem serifiyle bir satır, `--night`'a inen ve hiçbir yerde %66'nın altına düşmeyen karartma (slaytlar ve panel akışı aynı); "Evde L'Affogato" (mağazadan bir paket kahve, canlı üründen); uygulama bölümü (çizilmiş telefon, üç fayda kartı, `--bg-cream`); başlıkta Menü, Mağaza ve Ziyaret tam genişlikte açılan panel, kaydırınca krem bar; 404'te bahçede tabela; ödeme sayfalarında küçük ödeme çizimi. |
| 11 Kas 2026 | **Roast** (operatör: "siteyi tamamen coffee-beans-swart.vercel.app ... gibi ... yap, three js vs. ne varsa kullan"): krem zemin `#faf7f2`, mürekkep, dolu düğme, bant ve footer için tek espresso `#23120b` (token adları yerinde, `--green-*` ailesi artık espresso), amber `#de853a` dolgu ve koyu zeminde vurgu, karamel `#a35019` krem üstünde vurgu metni, `--matcha` tek yeşil (yalnız olumlu durum), Abril Fatface başlık + Plus Jakarta Sans metin (Poppins emekli), 16px kart, espresso tonlu gölge, buzlu krem üst çubuk, kaydırmayla ilerleyen three.js girişi (çekirdek) ve iki three.js bandı (dökülen espresso, affogato kupası); kahve vadisi kalktı. Tasarım kaydı `docs/REDESIGN-ROAST.md`; güncel değerler §0. |
| 12 Kas 2026 | **Roast, ikinci geçiş** (operatör: "ince ayar yap ve yapay zekaymış gibi gözükmesin"): üç three.js çizimi eşyanın fotoğrafı olacak biçimde yeniden kuruldu. Çekirdeğin içindeki altın ışık, turuncu yörünge çizgileri, kıvılcımlar, havadaki toz, asılı boncuk damlalar, kahverengi buhar, kalın karamel şerit ve espressoya sarılı beyaz "krema" kaldırıldı; yerine ıslak espresso gövdesi ve uçuş yönünde uzayan damlalar, dokulu döküm alüminyum demlik, krom portafiltre ve iki ince akış, espresso sırlı yivli fincan, kenarından okunan şeffaf cam sürahi ve tek ince akış geldi. İki bantta fincan ve sürahi artık kıpırdamaz. Stüdyo kameranın durduğu yanda koyu (metal metal gibi okunsun diye). `tests/home-roast.test.ts` "the scenes are photographs of things, not effects" tutar. |
| 17 Kas 2026 | **Yolculuk** (operatör: "sitede aşağıdaki promptu uygula ve kahveciye uygun hale getir", "alpha project" build promptu): anasayfanın girişi sabitlenmiş tek ekran oldu; kaydırmanın oynattığı 120 karelik film (Blender'da çizildi: çekirdek yığınının içinden bardaki bisküvi kupalı affogatoya, gece, ip ışıkları altında), derinlik haritasıyla paralaks, krem ön yükleyici ve yanma geçişi, kelime kelime gelen üç başlık, iki cam kart, halka imleç. Yazı Instrument Sans + Instrument Serif italik (yalnız burada). Üst çubuk resim üstünde tasarımın diline çevrilir. Kareler kesim başına beş pakette (5 istek). Roast girişi (`home-roast.tsx`) kaldırıldı. Kayıt `docs/JOURNEY.md`. |

**5 Kas - 11 Kas 2026: kafe-perakende düzeni (tarihçe; 11 Kas 2026'ya kadar
bu belgenin §0'ıydı).** Operatör: _"sitenin görselini ... starbucks tarzı
istiyorum ... ama panel değil"_. Site bir kahve perakende vitrininin yapısını
almıştı: sıcak krem zemin `#f2f0eb` (taş `#edebe9`, bant `#f9f8f6`, ödül kremi
`#faf6ee`), beyaz kart ve fısıltı gölgesi, logo yeşilinden türetilmiş ve her
birinin tek işi olan dört yeşil (brand `#1d6d56` başlık ve yeşil metin, cta
`#1f7a5c` dolu düğme ve yüzen sipariş düğmesi, house `#173f35` koyu bant, uplift
`#2a5a4d` bandın içi; açık nane `#d5e8df`), 6 Kas'tan beri gece espressosu
footer (`--night` `#181412`, `--night-raise` `#221d1a`, `--night-line`
`#3a332e`) ve üstünde resimli gece bandı, mürekkep `#211f1d` / `#5c5955`, bordo
vurgu `#9d2543` (yeşille üst üste yazılmazdı), pirinç `#cba258` yalnız ödülde.
Tek ses Poppins'ti (`--headline` de ona çözülürdü; başlık 600, ana başlık yeşil,
ödül başlığında sistem serifi); düğme 50px hap, gölgesiz, basınca 0.95; kart
12px, gölge katmanlı siyah-alfa, cam / bulanıklık / degrade dolgu yok; başlık
çubuğu düz beyaz (64 · 72 · 83 · 99 px), etkin bağlantının altında CTA yeşili
çubuk; anasayfanın girişi 6 Kas'tan beri gece kahve vadisiydi (three.js,
`home-valley.tsx`). Renkler kopyalanmamış, logo yeşilinden türetilmişti; başka
markanın yeşili hâlâ yasaktır (`tests/brand-theme.test.ts`). Bu düzen,
lafmobil'in porselen paletinden (karar 31 c, 25 Eyl 2026) operatör kararıyla
ayrışmıştı; Roast o ayrışmayı sürdürür.

Bağlantı önizlemesi (`opengraph-image.tsx`), JSON-LD ikonları
(`scripts/gen-icons.mjs` → `public/icon-*.png`) ve PayNkolay köprüsü de
uygulama paletine taşındı. E-posta şablonları da 15 Eki 2026'da taşındı:
zemini gömülü bant görselleri HTML çubuğa, logo çifti ile glint GIF'i tek
opak karoya döndü, böylece HTML rengi değişebildi; şablonlar artık açık ve
koyu modda okunur (`src/lib/email/templates/README.md` "Palet").
`tests/brand-theme.test.ts` mail HTML'ini bu palete kilitler.
