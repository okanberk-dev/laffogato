# Mail şablonları

On yedi gönderime hazır e-posta. Tek kolon 598 px, tablo tabanlı, bütün
stiller satır içi. E-posta tarafında JavaScript, harici CSS ve web fontu yok;
`<style>` bloğu yalnızca satır içi stillere ek (mobil kırılma + koyu tema),
tek başına gerekli değil.

Kaynak tasarım: Starbucks Rewards e-posta dili üzerine yazılan spesifikasyon
(8 Eyl 2026, kampanya e-postası işi). Düzen, boşluk, ikon-disk ve bant
dili oradan; renk ve yazı tipi `src/app/globals.css` tokenlarından — bkz.
"Palet". Dosyalar **bitmiş tasarımdır**: markup'ı yeniden çizmeden önce
`tests/email-templates.test.ts` ve `tests/brand-theme.test.ts`'in neyi
kilitlediğine bak.

## Dosyalar

| Dosya                     | Tür               | Konu                                          |
| ------------------------- | ----------------- | --------------------------------------------- |
| eposta-dogrulama.html     | işlemsel          | L'Affogato — e-posta adresinizi doğrulayın    |
| sifre-sifirlama.html      | işlemsel          | L'Affogato — şifre sıfırlama                  |
| siparis-alindi.html       | işlemsel          | Siparişiniz alındı (#[SIPARIS_NO])            |
| odeme-onaylandi.html      | işlemsel          | Ödemeniz onaylandı (#[SIPARIS_NO])            |
| hos-geldin.html           | ilişki            | L'Affogato'ya hoş geldiniz                    |
| karaoke-rezervasyon.html  | işlemsel          | Karaoke rezervasyonunuz onaylandı             |
| sadakat-ikram.html        | işlemsel          | Kartınız doldu — bir içecek bizden            |
| bulten-kampanya.html      | **ticari (6563)** | [KAMPANYA_BASLIK] — 3 ürün seçkisi + kod      |
| mobil-uygulama.html       | **ticari (6563)** | L'Affogato uygulaması yayında                 |
| dogum-gunu.html           | **ticari (6563)** | Doğum gününüz kutlu olsun — kahve bizden      |
| kampanya-duyuru.html      | **ticari (6563)** | [KAMPANYA_BASLIK] — genel duyuru              |
| kampanya-bonus-damga.html | **ticari (6563)** | [KAMPANYA_BASLIK] — bonus damga               |
| kampanya-happy-hour.html  | **ticari (6563)** | [KAMPANYA_BASLIK] — saat bandı                |
| kampanya-ikram.html       | **ticari (6563)** | [KAMPANYA_BASLIK] — üç adımda ikram           |
| kampanya-etkinlik.html    | **ticari (6563)** | [KAMPANYA_BASLIK] — etkinlik                  |
| kampanya-yeni-urun.html   | **ticari (6563)** | [KAMPANYA_BASLIK] — yeni ürün / ön erişim     |
| kampanya-indirim.html     | **ticari (6563)** | [KAMPANYA_BASLIK] — indirim                   |

Ticari onlu `data-commercial="1"` taşır. `renderEmail` bu onu çıkış
bağlantısı olmadan **derlemez**, işlemsel yediye çıkış bağlantısı
**koydurmaz** — ikisi de `tests/email-templates.test.ts`'te kilitli.

Konu satırı şablonun `data-subject`'idir ve `<title>` ile aynı olmak
zorundadır; `data-preheader` ön izleme metnidir (kampanya ailesinde
`[KAMPANYA_ALT]`, derleme betiği onu `preheader` alanına kopyalar).

### Kampanya ailesi

Yedi `kampanya-*` şablonu tek bir alan sözlüğünü paylaşır; yönetim paneli
(`/admin/bulten/kampanya`) hepsini aynı formdan doldurur, uygulama gönderisi
kancası `kampanya-duyuru`'yu kendiliğinden üretir. Konu `[KAMPANYA_BASLIK]`,
ön izleme `[KAMPANYA_ALT]`. `send.ts` aileyi `CAMPAIGN_TEMPLATES` ·
`renderCampaignMail` · `sendCampaignMail` ile, toplu gönderimi `deliverBatch`
ile sunar (`bulten-kampanya` da aileye dâhildir).

| Şablon               | Mod  | Ne için                       | Şablona özgü alanlar                                        |
| -------------------- | ---- | ----------------------------- | ----------------------------------------------------------- |
| kampanya-duyuru      | koyu | genel duyuru, gönderi kancası | —                                                           |
| kampanya-bonus-damga | koyu | bonus damga (damga şeridi)    | —                                                           |
| kampanya-happy-hour  | koyu | saat bandı                    | `ETKINLIK_SAAT` · `ETKINLIK_TARIH` · `ETKINLIK_YER`         |
| kampanya-ikram       | açık | üç adımda ikram               | `ADIM_1..3_BASLIK` · `ADIM_1..3_METIN`                      |
| kampanya-etkinlik    | koyu | etkinlik (kod kutusu yok)     | `ETKINLIK_YER` · `ETKINLIK_TARIH` · `ETKINLIK_SAAT`         |
| kampanya-yeni-urun   | açık | ön erişim (kod kutusu yok)    | `ADIM_1..3_BASLIK` · `ADIM_1..3_METIN`                      |
| kampanya-indirim     | açık | indirim                       | `INDIRIM_ORAN` · `INDIRIM_URUN`                             |

Ortak alanlar: `AD` · `KAMPANYA_EYEBROW` · `KAMPANYA_BASLIK` · `KAMPANYA_ALT`
· `KAMPANYA_METIN` · `KAMPANYA_BUTON` · `KAMPANYA_URL` — zorunlu;
`KAMPANYA_VURGU` · `KAMPANYA_GORSEL_URL` (+ `KAMPANYA_GORSEL_ALT`) ·
`KAMPANYA_TARIH` · `KAMPANYA_DIPNOT` · `KUPON_KODU` (+ `SON_KULLANIM`) —
isteğe bağlı, aşağıdaki bayraklarla düşer.

## Şablon dili

Üç şey var, fazlası yok (`src/lib/email/fill.ts`):

| Sözdizimi                              | Anlamı                           |
| -------------------------------------- | -------------------------------- |
| `[ALAN]`                               | değer; HTML tarafında kaçışlanır |
| `<!--IF:BAYRAK-->…<!--/IF:BAYRAK-->`   | koşullu bölüm                    |
| `<!--EACH:SATIR-->…<!--/EACH:SATIR-->` | her kalem için tekrarlanan satır |

Bayraklar `render.ts`'te hesaplanır; şablon yalnızca adını bilir:

| Bayrak      | Açık olduğu durum                        | Bölümle birlikte düşen alanlar               |
| ----------- | ---------------------------------------- | -------------------------------------------- |
| `APP_LINKS` | iki mağaza linki de tanımlı              | `APP_STORE_URL` · `PLAY_STORE_URL`           |
| `AD`        | ad boş değil ("Merhaba ," olmasın diye)  | `AD`                                         |
| `GORSEL`    | `KAMPANYA_GORSEL_URL` dolu               | `KAMPANYA_GORSEL_URL` · `KAMPANYA_GORSEL_ALT` |
| `KOD`       | `KUPON_KODU` dolu                        | `KUPON_KODU` · `SON_KULLANIM`                |
| `TARIH`     | `KAMPANYA_TARIH` dolu                    | `KAMPANYA_TARIH`                             |
| `DIPNOT`    | `KAMPANYA_DIPNOT` dolu                   | `KAMPANYA_DIPNOT`                            |
| `VURGU`     | `KAMPANYA_VURGU` dolu                    | `KAMPANYA_VURGU`                             |

Bayrak kapalıysa bölüm, içindeki alanlarla birlikte düşer; `assertFilled`
onları aramaz. Dolayısıyla isteğe bağlı bir alanı boş bırakmak serbesttir,
ama **açık** bir bölümün ikinci alanını boş bırakmak (kod var, son kullanma
yok) render hatasıdır — yarım bir vaat gönderilmez. Görselin alt metni
istisna: `renderCampaignMail` boş bırakılmış `KAMPANYA_GORSEL_ALT`'a
kampanya başlığını koyar.

## Alanlar ve kaynakları

| Alan                                                                                             | Nereden                                                                          |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `[AD]`                                                                                           | çağıranın `name` / `customerName`; kampanyada alıcı satırının adı                |
| `[DOGRULAMA_URL]` `[SIFIRLAMA_URL]`                                                              | `src/app/uye/actions.ts`                                                         |
| `[SIPARIS_NO]` kalemler `[ARA_TOPLAM]` `[KARGO]` `[TOPLAM]`                                      | `OrderEmailData` · `formatTRYMinor`                                              |
| `[SIPARIS_URL]` `[HESAP_URL]` `[MENU_URL]`                                                       | `SITE.url` + route (`render.ts` → `commonVars`)                                  |
| `[DAMGA_HEDEFI]`                                                                                 | `settings.mobileApp.loyalty.stampTarget`                                         |
| `[ODUL_BASLIGI]`                                                                                 | `currentFreeDrinkReward().title`                                                 |
| `[KUPON_KODU]` `[SON_KULLANIM]`                                                                  | sadakat / doğum günü: `CustomerCoupon`; kampanyada formdan (genel kod)           |
| `[KARAOKE_*]`                                                                                    | `KaraokeReservation`                                                             |
| `[KAMPANYA_EYEBROW]` `[KAMPANYA_BASLIK]` `[KAMPANYA_ALT]` `[KAMPANYA_METIN]` `[KAMPANYA_BUTON]` `[KAMPANYA_URL]` | kampanya formu (`campaign_emails.fields`) ya da uygulama gönderisi (`campaignFromPost`) |
| `[KAMPANYA_VURGU]` `[KAMPANYA_GORSEL_URL]` `[KAMPANYA_GORSEL_ALT]` `[KAMPANYA_TARIH]` `[KAMPANYA_DIPNOT]` | aynı form, isteğe bağlı — boşsa bölüm düşer                                      |
| `[ETKINLIK_*]` `[ADIM_n_*]` `[INDIRIM_*]`                                                        | aynı form, şablona göre                                                          |
| `[URUN_n_*]`                                                                                     | `bulten-kampanya` — çağıranın üç ürün seçkisi                                    |
| `[ABONELIK_CIKIS_URL]`                                                                           | `unsubscribeUrlFor(token)` → `/api/bulten/cikis?token=` — `renderEmail` otomatik |
| `[APP_STORE_URL]` `[PLAY_STORE_URL]`                                                             | `src/lib/mobile/app-store.ts` (env)                                              |

## Görseller

Şablonların bütün sabit görselleri `public/email/` altında durur ve
**mutlak** adresle çağrılır: `https://laffogato.net/email/…`. Mail istemcisi
projedeki göreli yolu bilemez, önizleme ortamının adresi de alıcıya ulaşmaz;
adres bu yüzden `SITE.url` değil, kanonik alan adıdır.

```
public/email/
  logo-laf-espresso.png · logo-laf-cream.png    600×486 kaynak, 200×162 basılır — çerçevesiz L'Af harfleri; açık kartta
                                                espresso, koyu mod medya sorgusu (`.em-logo-dark`) cream'i açar
  logo-laf-glint.gif                            400×324 kaynak, 200×162 basılır — koyu yeşil bant üstünde bir kez akan
                                                altın parıltı; ilk karesi düz cream mark (Outlook GIF oynatmaz, onu gösterir)
  logo-laf-gold.png                             600×486 — altın ton; şu an hiçbir şablon çağırmıyor, yedek
  mono-{cream,gold,golddeep}.png                57×102 kaynak, 19×34 basılır — alt bilgideki L'Af monogramı (şablonlar golddeep)
  bean-{cream,espresso,gold,golddeep}.png       66×176 kaynak, 8×22 basılır — tarih/etkinlik satırının önündeki çekirdek;
                                                koyu bantta gold, açık kartta golddeep
  band-{dark,light}-{top,bottom}.png            1196 px kaynak, 598 px basılır — organik bantlar
  stamp-{empty,full}.png                        96×96 kaynak, 40×40 basılır — damga kartı hücreleri
  check-badge.png · wave-success.png            ödeme onayı rozeti (56×56 basılır) / dalgası (598 px)
  icons/<ad>-{cream,espresso,gold,hero}.png     96×96 kaynak, 40–48 px basılır — disk ikonlar
```

Logo üç dosyadır: mail istemcisi bir maskeyi boyayamadığı için ton başına
ayrı dosya gerekir. 8 Eyl'de önce (commit `06b325d`) iki zeminde de okunan tek
bir rozet (`logo-laf.png`) denendi; aynı akşam (`72acf21`) rozet emekli edildi
ve yerini 200 px'lik çerçevesiz harflere bıraktı: açık kartlı sekiz şablon
espresso PNG'yi basar ve koyu modda cream'e geçer, koyu bantlı dokuz şablon
ise parıltılı GIF'i basar. `logo-laf.png` artık yok; `tests/brand-theme.test.ts`
her şablonun bu üçünden birini çağırdığını ve eski rozete dönmediğini doğrular.
Yeni bir renk tonu gerekirse yeni bir PNG üretilir, `tintColor` benzeri bir
yol yoktur.

İkon adları: bell · calendar · card · check · clock · cup · gift · mail ·
phone · pin · qr · receipt · scooter · star · store · tag · users.

Kampanya görseli (`KAMPANYA_GORSEL_URL`) ise formdan gelen, barındırılmış
bir `https` görselidir; boşsa hero satırı düşer. Yeni bir sabit görsel
`public/email/`e girer ve deploy ile yayına çıkar — şablon deploy'dan önce
gönderilirse görsel kırık gelir. `tests/brand-theme.test.ts` her şablonun
en az bir `laffogato.net/email/` varlığı çağırdığını ve çağırdığı her
dosyanın diskte olduğunu doğrular.

## Palet

Palet **sitenin** `globals.css` tokenlarıdır — uygulamanın Starbucks-ID
paleti (`#29623F` / `#D1C59B`) değil (spesifikasyon §8, 8 Eyl 2026).
Gerekçe: mailleri site gönderir, bağlantılar siteye iner ve
`tests/brand-theme.test.ts` mail HTML'ini sitenin tokenlarına kilitler
(`background:#143d2b` ve `color:#201c17` zorunlu; `#235347` ve emekli
terrakota yasak). Site 5–7 Eyl'de Köşk + tricolore paletine geçti; bordo
(`#84233c`) mailde **kullanılmaz**, dil yeşil + altın + krem.

| Rol                                         | Token                              | Değer                             |
| ------------------------------------------- | ---------------------------------- | --------------------------------- |
| Koyu mod zemin, koyu bant, CTA dolgusu      | `--bg-espresso` / `--brand`        | `#143d2b`                         |
| Koyu mod organik dalga / leke               | `--hero-green` (+ `--green`)       | `#1e5b3f` (`#1e7c4b`)             |
| Koyu modda eyebrow, tarih, altın vurgu, CTA | `--gold-soft`                      | `#e8d3a4`                         |
| Koyu modda CTA metni, vurgu metni           | `--bg-espresso`                    | `#143d2b`                         |
| Koyu modda gövde                            | beyaz / `--green-mist`             | `#ffffff` / `#cfe3d5`             |
| Açık mod kart zemini                        | `--bg`                             | `#ffffff`                         |
| Açık mod dış zemin / krem plaka             | `--hero-cream` / `--bg-cream`      | `#faf6ee` / `#fbf9f4`             |
| Krem plaka, ikon diski, teklif kutusu       | `--hero-tile` / `--hero-tile-deep` | `#f7ebdc` / `#ebd9c4`             |
| Açık modda başlık                           | `--bg-espresso`                    | `#143d2b`                         |
| Metin / ikincil / sessiz                    | `--ink` / `--ink-soft` / `--ink-mute` | `#201c17` / `#5f594e` / `#746b5d` |
| Açık modda altın metin (eyebrow, fiyat)     | `--gold` (`--gold-deep`)           | `#8a6526` (`#6b4e1a`)             |
| Açık modda fosforlu vurgu                   | `--green-mist` zemin + `--bg-espresso` metin | `#cfe3d5` + `#143d2b`   |
| Çizgiler                                    | `--ink-line` / `--ink-line-strong` | `#ebe7de` / `#e1dcd1`             |
| Altın hairline (teklif kutusu, kesikli)     | `--gold-soft`                      | `#e8d3a4`                         |
| Footer zemini                               | `--bg-warm`                        | `#f6f5f2`                         |
| Dış zemin (kartın arkası)                   | `--bg-stone`                       | `#f1eee8`                         |

Yazı: Montserrat yığını (`--sans`). Web fontu Gmail/Outlook'ta yüklenmez,
Helvetica/Arial'a düşer — ağırlık ve harf aralığı ayrımı taşıyor.
`tests/brand-theme.test.ts` bu dosyaları da okuyor: emekli palet geri
gelirse build düşer.

Koyu tema: `color-scheme` meta'sı istemcinin kendi kendine ters çevirmesini
engelliyor, `prefers-color-scheme` bloğu zeminleri markanın sıcak nötr
eksenine (`#14110d` / `#201c17` / `#2a251e`) çeviriyor. Blok satır içi
hexlere göre seçici kurar; yeni bir hex eklersen eşlemesini de ekle, yoksa
koyu temada o parça olduğu gibi kalır.

## Değiştirdikten sonra

```bash
npm run email:build   # templates.generated.ts'i tazeler (commit'lenir)
npm test -- email     # alan, 6563 ve palet nöbetçileri
npx vitest run tests/brand-theme.test.ts   # görsel varlıkları + palet
```

Tarayıcıda görmek için `npm run dev` sonrası
`/dev/mail/<dosya-adi>` (düz metin için `?format=text`) — yalnız geliştirmede,
production'da 404. Kampanya ailesi için örnek değerler `SAMPLE`'da; bir alanı
silip bölümün nasıl düştüğünü oradan görebilirsin.
