# Mail şablonları

Yirmi iki gönderime hazır e-posta. Tek kolon 598 px, tablo tabanlı, bütün
stiller satır içi. E-posta tarafında JavaScript, harici CSS ve web fontu yok;
`<style>` bloğu yalnızca satır içi stillere ek (mobil kırılma + koyu tema),
tek başına gerekli değil.

Kaynak tasarım: Starbucks Rewards e-posta dili üzerine yazılan spesifikasyon
(8 Eyl 2026, kampanya e-postası işi). Düzen, boşluk, ikon-disk ve bant
dili oradan; renk ve yazı tipi `src/app/globals.css` tokenlarından - bkz.
"Palet". Dosyalar **bitmiş tasarımdır**: markup'ı yeniden çizmeden önce
`tests/email-templates.test.ts` ve `tests/brand-theme.test.ts`'in neyi
kilitlediğine bak.

## Dosyalar

| Dosya                     | Tür               | Konu                                        |
| ------------------------- | ----------------- | ------------------------------------------- |
| eposta-dogrulama.html     | işlemsel          | L'Affogato - e-posta adresinizi doğrulayın  |
| sifre-sifirlama.html      | işlemsel          | L'Affogato - şifre sıfırlama                |
| bulten-onay.html          | işlemsel          | L'Affogato - bülten aboneliğinizi onaylayın |
| odeme-onaylandi.html      | işlemsel          | Ödemeniz onaylandı (#[SIPARIS_NO])          |
| siparis-kargoda.html      | işlemsel          | Siparişiniz kargoya verildi (#[SIPARIS_NO]) |
| siparis-iptal.html        | işlemsel          | Siparişiniz iptal edildi (#[SIPARIS_NO])    |
| siparis-iade.html         | işlemsel          | İadeniz yapıldı (#[SIPARIS_NO])             |
| hos-geldin.html           | ilişki            | L'Affogato'ya hoş geldiniz                  |
| karaoke-rezervasyon.html  | işlemsel          | Karaoke rezervasyonun onaylandı             |
| karaoke-iptal.html        | işlemsel          | Karaoke rezervasyonun iptal edildi          |
| sadakat-ikram.html        | işlemsel          | Kartınız doldu - bir içecek bizden          |
| bulten-kampanya.html      | **ticari (6563)** | [KAMPANYA_BASLIK] - 3 ürün seçkisi + kod    |
| mobil-uygulama.html       | **ticari (6563)** | L'Affogato uygulaması yayında               |
| dogum-gunu.html           | **ticari (6563)** | Doğum gününüz kutlu olsun - kahve bizden    |
| kampanya-duyuru.html      | **ticari (6563)** | [KAMPANYA_BASLIK] - genel duyuru            |
| kampanya-bonus-damga.html | **ticari (6563)** | [KAMPANYA_BASLIK] - bonus damga             |
| kampanya-happy-hour.html  | **ticari (6563)** | [KAMPANYA_BASLIK] - saat bandı              |
| kampanya-ikram.html       | **ticari (6563)** | [KAMPANYA_BASLIK] - üç adımda ikram         |
| kampanya-etkinlik.html    | **ticari (6563)** | [KAMPANYA_BASLIK] - etkinlik                |
| kampanya-yeni-urun.html   | **ticari (6563)** | [KAMPANYA_BASLIK] - yeni ürün / ön erişim   |
| kampanya-indirim.html     | **ticari (6563)** | [KAMPANYA_BASLIK] - indirim                 |
| operasyon-bildirim.html   | iç (ekibe)        | [BILDIRIM_KONU] - karaoke talebi, test, ... |

### Ekibe giden mailler

Köşkün kendi gelen kutusuna giden her ileti (yeni karaoke talebi, Ayarlar'daki
test e-postası ve bundan sonra eklenecek her iç bildirim) müşteri maillerinin
tasarımını kullanır: `operasyon-bildirim.html`. Etiket, başlık, alt başlık,
etiket/değer satırlarından oluşan beyaz kart (`<!--EACH:SATIRLAR-->`), isteğe
bağlı not (`<!--IF:NOT-->`) ve tek düğme. Kod tarafı `send.ts`
`sendOperatorNotice` / `renderOperatorNotice`; yeni bir iç bildirim için yeni
şablon çizilmez, bu fonksiyona satırlar verilir. Düz metin `<pre>` ile iç mail
gönderilmez.

Ticari onlu `data-commercial="1"` taşır. `renderEmail` bu onu çıkış
bağlantısı olmadan **derlemez**, işlemsel on ikiye çıkış bağlantısı
**koydurmaz** - ikisi de `tests/email-templates.test.ts`'te kilitli.

### Sipariş bildirimleri

`siparis-kargoda`, `siparis-iptal` ve `siparis-iade` hukuki metinlerin söz
verdiği üç e-postadır: taşıyıcıya teslimde kargo takip numarası, satıcının
iptali ve geri ödeme. Üçü de yalnız işlemseldir: uygulama şeridi, sosyal
medya satırı ya da teklif taşımaz. Kimin ne zaman alacağına
`src/lib/email/order-notices.ts` karar verir (yalnız mağaza siparişi, gerçek
bir adres; kafe siparişi hiçbirini almaz) ve her biri `order_notice_emails`
tablosundaki bir satırla **bir kez** gider: (sipariş, tür) birincil
anahtardır, tekrar eden bir Geliver olayı ya da ikinci kayıt 23505 alır ve
hiçbir şey göndermez. Başarısız bir gönderim satırı bırakır, bir sonraki
tetik yeniden dener.

Konu satırı şablonun `data-subject`'idir ve `<title>` ile aynı olmak
zorundadır; `data-preheader` ön izleme metnidir (kampanya ailesinde
`[KAMPANYA_ALT]`, derleme betiği onu `preheader` alanına kopyalar).

### Kampanya ailesi

Yedi `kampanya-*` şablonu tek bir alan sözlüğünü paylaşır; yönetim paneli
(`/admin/bulten/kampanya`) hepsini aynı formdan doldurur, uygulama gönderisi
kancası `kampanya-duyuru`'yu kendiliğinden üretir. Konu `[KAMPANYA_BASLIK]`,
ön izleme `[KAMPANYA_ALT]`. `send.ts` aileyi `CAMPAIGN_TEMPLATES` ·
`renderCampaignMail` · `sendCampaignMail` ile, toplu gönderimi `deliverBatch`
ile sunar (`bulten-kampanya` da aileye dâhildir). `mobil-uygulama` da
panelden gönderilir ama alan sözlüğünü paylaşmaz: sabit metinlidir, konusu
kendi `data-subject`'idir, `[DAMGA_HEDEFI]`'ni sunucu çözer
(`campaignServerVars`) ve iki mağaza linki tanımlanana kadar seçilemez.

| Şablon               | Mod  | Ne için                       | Şablona özgü alanlar                                |
| -------------------- | ---- | ----------------------------- | --------------------------------------------------- |
| kampanya-duyuru      | koyu | genel duyuru, gönderi kancası | -                                                   |
| kampanya-bonus-damga | koyu | bonus damga (damga şeridi)    | -                                                   |
| kampanya-happy-hour  | koyu | saat bandı                    | `ETKINLIK_SAAT` · `ETKINLIK_TARIH` · `ETKINLIK_YER` |
| kampanya-ikram       | açık | üç adımda ikram               | `ADIM_1..3_BASLIK` · `ADIM_1..3_METIN`              |
| kampanya-etkinlik    | koyu | etkinlik (kod kutusu yok)     | `ETKINLIK_YER` · `ETKINLIK_TARIH` · `ETKINLIK_SAAT` |
| kampanya-yeni-urun   | açık | ön erişim (kod kutusu yok)    | `ADIM_1..3_BASLIK` · `ADIM_1..3_METIN`              |
| kampanya-indirim     | açık | indirim                       | `INDIRIM_ORAN` · `INDIRIM_URUN`                     |

Ortak alanlar: `AD` · `KAMPANYA_EYEBROW` · `KAMPANYA_BASLIK` · `KAMPANYA_ALT`
· `KAMPANYA_METIN` · `KAMPANYA_BUTON` · `KAMPANYA_URL` - zorunlu;
`KAMPANYA_VURGU` · `KAMPANYA_GORSEL_URL` (+ `KAMPANYA_GORSEL_ALT`) ·
`KAMPANYA_TARIH` · `KAMPANYA_DIPNOT` · `KUPON_KODU` (+ `SON_KULLANIM`) -
isteğe bağlı, aşağıdaki bayraklarla düşer.

## Şablon dili

Üç şey var, fazlası yok (`src/lib/email/fill.ts`):

| Sözdizimi                              | Anlamı                           |
| -------------------------------------- | -------------------------------- |
| `[ALAN]`                               | değer; HTML tarafında kaçışlanır |
| `<!--IF:BAYRAK-->…<!--/IF:BAYRAK-->`   | koşullu bölüm                    |
| `<!--EACH:SATIR-->…<!--/EACH:SATIR-->` | her kalem için tekrarlanan satır |

Bayraklar `render.ts`'te hesaplanır; şablon yalnızca adını bilir:

| Bayrak        | Açık olduğu durum                       | Bölümle birlikte düşen alanlar                |
| ------------- | --------------------------------------- | --------------------------------------------- |
| `APP_LINKS`   | iki mağaza linki de tanımlı             | `APP_STORE_URL` · `PLAY_STORE_URL`            |
| `AD`          | ad boş değil ("Merhaba ," olmasın diye) | `AD`                                          |
| `GORSEL`      | `KAMPANYA_GORSEL_URL` dolu              | `KAMPANYA_GORSEL_URL` · `KAMPANYA_GORSEL_ALT` |
| `KOD`         | `KUPON_KODU` dolu                       | `KUPON_KODU` · `SON_KULLANIM`                 |
| `TARIH`       | `KAMPANYA_TARIH` dolu                   | `KAMPANYA_TARIH`                              |
| `DIPNOT`      | `KAMPANYA_DIPNOT` dolu                  | `KAMPANYA_DIPNOT`                             |
| `VURGU`       | `KAMPANYA_VURGU` dolu                   | `KAMPANYA_VURGU`                              |
| `TAKIP_LINKI` | `TAKIP_URL` dolu (Geliver'ın sayfası)   | `TAKIP_URL`                                   |
| `FIRMA`       | `KARGO_FIRMASI` dolu                    | `KARGO_FIRMASI`                               |

Üç bayrak alandan değil olaydan gelir ve çağıran verir
(`RenderInput.flags`): `ODEME_ALINDI` / `ODEME_YOK` (iptal edilen siparişte
ödeme alınmış mı; ikisi de kapalıysa e-posta ödeme hakkında hiçbir şey
söylemez) ve `KARTA_IADE` (iade POS üzerinden karta mı döndü). Alandan gelen
bayraklar çağıranınkini ezer; boş alanlı bir bölümü hiçbir çağıran açamaz.

Bayrak kapalıysa bölüm, içindeki alanlarla birlikte düşer; `assertFilled`
onları aramaz. Dolayısıyla isteğe bağlı bir alanı boş bırakmak serbesttir,
ama **açık** bir bölümün ikinci alanını boş bırakmak (kod var, son kullanma
yok) render hatasıdır - yarım bir vaat gönderilmez. Görselin alt metni
istisna: `renderCampaignMail` boş bırakılmış `KAMPANYA_GORSEL_ALT`'a
kampanya başlığını koyar.

## Alanlar ve kaynakları

| Alan                                                                                                             | Nereden                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `[AD]`                                                                                                           | çağıranın `name` / `customerName`; kampanyada alıcı satırının adı                                         |
| `[DOGRULAMA_URL]` `[SIFIRLAMA_URL]`                                                                              | `src/app/uye/actions.ts`                                                                                  |
| `[SIPARIS_NO]` kalemler `[ARA_TOPLAM]` `[KARGO]` `[TOPLAM]`                                                      | `OrderEmailData` · `formatTRYMinor`                                                                       |
| `[SIPARIS_URL]` `[HESAP_URL]` `[MENU_URL]`                                                                       | `SITE.url` + route (`render.ts` → `commonVars`)                                                           |
| `[DAMGA_HEDEFI]`                                                                                                 | `settings.mobileApp.loyalty.stampTarget`                                                                  |
| `[ODUL_BASLIGI]`                                                                                                 | `currentFreeDrinkReward().title`                                                                          |
| `[KUPON_KODU]` `[SON_KULLANIM]`                                                                                  | sadakat / doğum günü: `CustomerCoupon`; kampanyada formdan (genel kod)                                    |
| `[KARAOKE_*]`                                                                                                    | `KaraokeReservation` - `[KARAOKE_KOD]` rezervasyonun `id`'sidir (`krk-00042`), ayrı bir kod kolonu yoktur |
| `[KAMPANYA_EYEBROW]` `[KAMPANYA_BASLIK]` `[KAMPANYA_ALT]` `[KAMPANYA_METIN]` `[KAMPANYA_BUTON]` `[KAMPANYA_URL]` | kampanya formu (`campaign_emails.fields`) ya da uygulama gönderisi (`campaignFromPost`)                   |
| `[KAMPANYA_VURGU]` `[KAMPANYA_GORSEL_URL]` `[KAMPANYA_GORSEL_ALT]` `[KAMPANYA_TARIH]` `[KAMPANYA_DIPNOT]`        | aynı form, isteğe bağlı - boşsa bölüm düşer                                                               |
| `[ETKINLIK_*]` `[ADIM_n_*]` `[INDIRIM_*]`                                                                        | aynı form, şablona göre                                                                                   |
| `[URUN_n_*]`                                                                                                     | `bulten-kampanya` - çağıranın üç ürün seçkisi                                                             |
| `[ABONELIK_CIKIS_URL]`                                                                                           | `unsubscribeUrlFor(token)` → `/api/bulten/cikis?token=` - `renderEmail` otomatik                          |
| `[APP_STORE_URL]` `[PLAY_STORE_URL]`                                                                             | `src/lib/mobile/app-store.ts` (env)                                                                       |
| `[TAKIP_NO]` `[KARGO_FIRMASI]` `[TAKIP_URL]`                                                                     | siparişin `trackingNumber` · `carrier` (panelin kargo formu) · `trackingUrl` (Geliver, yalnız https)      |
| `[IADE_TUTARI]` `[TOPLAM_IADE]`                                                                                  | bu iade ve siparişteki iadelerin toplamı (`order.refunds`) · `formatTRYMinor`                             |

## Görseller

Şablonların bütün sabit görselleri `public/email/` altında durur ve
**mutlak** adresle çağrılır: `https://laffogato.net/email/…`. Mail istemcisi
projedeki göreli yolu bilemez, önizleme ortamının adresi de alıcıya ulaşmaz;
adres bu yüzden `SITE.url` değil, kanonik alan adıdır.

```
public/email/
  logo-laf-tile.png                             192×192, 76 (başlık) / 34 (alt bilgi) px basılır - uygulama ikonu:
                                                yeşil (#1d6d56) karo üstünde krem L'Af. OPAK: Gmail'in koyu modu
                                                renkleri ters çevirir ama görselleri çevirmez; saydam bir harf
                                                (eski espresso/cream çifti) ters çevrilmiş kartta kayboluyordu
  bean-{gold,golddeep}.png                      66×176 kaynak, 8×22 basılır - tarih satırının çekirdeği; açık kartta
                                                golddeep, koyu modda (`em-only-dark`) gold
  stamp-{empty,full}.png                        96×96 kaynak, 40×40 basılır - damga kartı hücreleri (opak disk)
  check-badge.png                               ödeme onayı rozeti (56×56, opak disk)
  icons/<ad>-{cream,espresso,gold,hero}.png     96×96 kaynak, 40-48 px basılır - opak disk ikonlar
  (emekli, dosyası duruyor) band-*, logo-laf-{espresso,cream,glint,gold}, mono-*, wave-success:
                                                zemini gömülü görsellerdi; gönderilmiş eski e-postalar hâlâ bu
                                                adreslere bağlandığı için silinmez, hiçbir şablon çağırmaz
```

Logo tek dosyadır: iki zeminde de okunan opak karo. Bantlar artık görsel
değil, kartın üst kenarında 8 px'lik bir HTML hücresidir (açık kartta yeşil,
koyu yeşil başlığın üstünde pirinç). `tests/email-templates.test.ts` hiçbir
şablonun zemini gömülü bir görsel çağırmadığını ve her şablonun karoyu
bastığını doğrular.

İkon adları: bell · calendar · card · check · clock · cup · gift · mail ·
phone · pin · qr · receipt · scooter · star · store · tag · users.

Kampanya görseli (`KAMPANYA_GORSEL_URL`) ise formdan gelen, barındırılmış
bir `https` görselidir; boşsa hero satırı düşer. Yeni bir sabit görsel
`public/email/`e girer ve deploy ile yayına çıkar - şablon deploy'dan önce
gönderilirse görsel kırık gelir. `tests/brand-theme.test.ts` her şablonun
en az bir `laffogato.net/email/` varlığı çağırdığını ve çağırdığı her
dosyanın diskte olduğunu doğrular.

## Palet

15 Eki 2026'dan beri palet **sitenin ve uygulamanın** paletidir (porselen,
ev yeşili, pirinç, sıcak mürekkep); Köşk değerleri (`#143d2b`, `#201c17`,
`#8a6526`, `#e8d3a4` …) emeklidir ve `tests/email-templates.test.ts` onları
yasaklar. Bordo yeşilin üstüne yazılmaz.

| Rol                                           | Açık mod                                                 | Koyu mod (sınıf)                                |
| --------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| Dış zemin                                     | `#f7f3ed`                                                | `#12100e` (`em-bg`)                             |
| Kart                                          | `#ffffff`                                                | `#1c1916` (`em-card`)                           |
| İç panel / teklif kutusu                      | `#faf6ee`                                                | `#27221d` (`em-panel`)                          |
| Alt bilgi                                     | `#f3eee6`                                                | `#171411` (`em-foot`)                           |
| Metin / ikincil / sessiz                      | `#211c18` / `#564d46` / `#6f655d`                        | `#f3ece3` / `#d3c9bd` / `#a99d91` (`em-t1/2/3`) |
| Altın metin (eyebrow, bağlantı, fiyat)        | `#765923`                                                | `#e8c877` (`em-tg`)                             |
| Yeşil metin (başlık, toplam)                  | `#17594a`                                                | `#8fd3b6` (`em-tb`)                             |
| Çizgi                                         | `#e8e0d4` / `#e3dbcf` / `#e8c877`                        | `#3a332c` (`em-ln`)                             |
| Düğme, üst çubuk                              | `#1d6d56` (beyaz yazı)                                   | aynı                                            |
| Tam koyu bölüm (koyu başlık, uygulama şeridi) | `#17594a` (beyaz, krem `#d4ebe1`, pirinç `#e8c877` yazı) | aynı                                            |
| Pirinç düğme                                  | `#e8c877` (yazı `#17594a`)                               | aynı                                            |

Tam koyu bölümler `#1d6d56` değil bir ton koyusu `#17594a`'dır: küçük pirinç
yazı `#1d6d56` üstünde 3,8:1'de kalıyordu (AA altı), `#17594a` üstünde 5:1.

Yazı: Poppins yığını (sitenin metin sesi). Web fontu Gmail/Outlook'ta
yüklenmez, sistem fontuna düşer.

**Koyu mod - nasıl çalışır.** Her şablon AYNI `<style>` bloğunu taşır
(`tests/email-templates.test.ts` birebir aynılığı doğrular):

- Apple Mail, iOS Mail, Outlook for Mac `prefers-color-scheme`'i uygular;
  blok sınıfları koyu değerlere çevirir.
- Outlook.com ve Outlook uygulamaları yeniden boyadığı öğelere
  `data-ogsc` / `data-ogsb` koyar; aynı sınıflar bu seçicilerle de eşlenir.
- Gmail ikisini de uygulamaz, renkleri kendisi ters çevirir, görselleri
  çevirmez. Bu yüzden zemini gömülü görsel yoktur ve logo opaktır.

Sınıf, öğenin **üstünde durduğu yüzeye** göre konur: açık bir yüzeydeki
metin ve zeminler sınıf taşır; yeşil ve pirinç yüzeylerdeki öğeler taşımaz,
iki modda da okunur. Yeni bir öğe eklerken rengine karşılık gelen sınıfı da
ver (`em-t1` `#211c18` için vb.); test, sınıfsız kalan bir eşlenen rengi
yakalar.

## Değiştirdikten sonra

```bash
npm run email:build   # templates.generated.ts'i tazeler (commit'lenir)
npm test -- email     # alan, 6563 ve palet nöbetçileri
npx vitest run tests/brand-theme.test.ts   # görsel varlıkları + palet
```

Tarayıcıda görmek için `npm run dev` sonrası
`/dev/mail/<dosya-adi>` (düz metin için `?format=text`) - yalnız geliştirmede,
production'da 404. Kampanya ailesi için örnek değerler `SAMPLE`'da; bir alanı
silip bölümün nasıl düştüğünü oradan görebilirsin.

**"Siparişiniz alındı" mailı yoktur** (16 Eki 2026, operatör: "sipariş maili
ödeme tam alınmadan gitmesin"; `siparis-alindi` şablonu kaldırıldı).
Müşterinin kargoya kadar aldığı tek sipariş maili `odeme-onaylandi`'dir:
ödeme siparişi `paid`'e taşıyınca (`notifyOrderPaid`, `order_notice_emails`
türü `paid`) bir kez gider; satırlar, Ara toplam, Kargo (masa siparişinde yok),
İndirim ve toplam ile ÖBF/MSS/cayma bağlantılarını taşır.
