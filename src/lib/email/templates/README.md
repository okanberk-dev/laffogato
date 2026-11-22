# Mail şablonları

Yirmi dokuz gönderime hazır e-posta. Tek kolon 598 px, tablo tabanlı, bütün
stiller satır içi. E-posta tarafında JavaScript, harici CSS ve web fontu yok;
`<style>` bloğu yalnızca satır içi stillere ek (mobil kırılma + koyu tema),
tek başına gerekli değil.

Görünüm sitenindir (22 Kas 2026, operatör: _"mail tasarımlarını da siteyle
aynı yap ... estetik yap mailleri de öyle"_): Blue Bottle dilindeki sitenin
değerleri (`src/styles/foundation.css :root`, `docs/BRAND.md` §0 ve §10)
satır içi yazılır - bkz. "Palet". Düzen ve alan iskeleti 8 Eyl 2026'daki
spesifikasyondan kaldı. Dosyalar **bitmiş tasarımdır**; nöbetçi testler
(`tests/email-templates.test.ts`, `tests/brand-theme.test.ts`) 16 Kas
2026'da kalktı, aşağıdaki kurallar elle korunur. Şablonu değiştirdikten
sonra `/dev/mail/<ad>` ile açık ve koyu modda, telefon genişliğinde bak.

## Dosyalar

| Dosya                     | Tür               | Konu                                        |
| ------------------------- | ----------------- | ------------------------------------------- |
| eposta-dogrulama.html     | işlemsel          | L'Affogato - e-posta adresinizi doğrulayın  |
| sifre-sifirlama.html      | işlemsel          | L'Affogato - şifre sıfırlama                |
| bulten-onay.html          | işlemsel          | L'Affogato - bülten aboneliğinizi onaylayın |
| odeme-onaylandi.html      | işlemsel          | Ödemeniz onaylandı (#[SIPARIS_NO])          |
| siparis-kargoda.html      | işlemsel          | Siparişiniz kargoya verildi (#[SIPARIS_NO]) |
| siparis-hazir.html        | işlemsel          | Siparişin hazır (#[SIPARIS_NO])             |
| siparis-iptal.html        | işlemsel          | Siparişiniz iptal edildi (#[SIPARIS_NO])    |
| siparis-iade.html         | işlemsel          | İadeniz yapıldı (#[SIPARIS_NO])             |
| e-arsiv-fatura.html       | işlemsel          | e-Arşiv faturanız ([FATURA_REF]), PDF ekli  |
| hos-geldin.html           | ilişki            | L'Affogato'ya hoş geldiniz                  |
| karaoke-rezervasyon.html  | işlemsel          | Karaoke rezervasyonun onaylandı             |
| karaoke-iptal.html        | işlemsel          | Karaoke rezervasyonun iptal edildi          |
| karaoke-iptal-istegi.html | işlemsel          | Karaoke iptal isteğini aldık                |
| karaoke-saat-degisikligi.html | işlemsel      | Karaoke rezervasyonunun saati değişti       |
| sadakat-ikram.html        | işlemsel          | Kartınız doldu - bir içecek bizden          |
| hesap-silme-talebi.html   | işlemsel          | L'Affogato - hesap silme talebin alındı     |
| hesap-silindi.html        | işlemsel          | L'Affogato - hesabın silindi / kapatıldı    |
| franchise-basvuru.html    | işlemsel          | L'Affogato - franchise başvurunu aldık      |
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
bağlantısı olmadan **derlemez**, işlemsel şablonlara çıkış bağlantısı
**koydurmaz** (`render.ts`).

`franchise-basvuru` /franchise formunu dolduran kişinin aldığı alındıdır
(`sendFranchiseReceivedEmail`, `src/lib/franchise/notify.ts`): yalnız ilk
adı, şehir, yer durumu, yatırım aralığı ve başlangıç (formun kendi
seçenek etiketleri), başvurunun ücretsiz olduğu ve saklama süresi. Ekibin
notu ya da başvurunun durumu yazılmaz.

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
| `[KOSK_SAAT]` `[TELEFON]` `[TELEFON_TEL]` `[KOSK_ADRES]`                                                         | Ayarlar → Saatler / Genel (`venue.ts`); okunamazsa paketteki değer                                        |
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
| `[BELGE_OBF_URL]` `[BELGE_MSS_URL]` `[BELGE_SURUMLERI]` `[KARAOKE_SURUM_URL]`                                    | onaylanan sürümün sayfası (`/hukuk/<slug>?surum=`), yalnız sözleşme ekiyle (`BELGE_EKI`, `KARAOKE_BELGE_EKI`) |

## Görseller

Şablonların bütün sabit görselleri `public/email/` altında durur ve
**mutlak** adresle çağrılır: `https://laffogato.net/email/…`. Mail istemcisi
projedeki göreli yolu bilemez, önizleme ortamının adresi de alıcıya ulaşmaz;
adres bu yüzden `SITE.url` değil, kanonik alan adıdır. Hepsi
`scripts/gen-email-assets.mjs` ile üretilir (`node scripts/gen-email-assets.mjs`;
işaret `public/brand`'den, ikonlar Lucide'den).

```
public/email/
  laf-mark-charcoal.png           168×168, 56 (başlık) / 44 (footer) px basılır - kömür (#333333) karo
                                  üstünde beyaz L'Af ve #cba258 çekirdek. OPAK: Gmail'in koyu modu
                                  renkleri çevirir ama görselleri çevirmez; saydam siyah bir işaret koyu
                                  kartta kaybolurdu. Kömür footer'da karo bloğa karışır.
  check-success.png               112×112, 56 px - ödeme onayı rozeti: --success disk, beyaz tik (saydam köşe)
  stamp-sq-{full,empty}.png       96×96, 40 px - damga kartı hücreleri, kömür panelde: dolu = bant kare ve
                                  #b8893a çekirdek, boş = kesik çizgili kare (sitenin .stamp'ı)
  icons/<ad>-ink.png              96×96, 40-48 px - bant karo üstünde siyah çizgi ikon (açık yüzeyler; opak)
  icons/<ad>-white.png            96×96 - saydam zeminde beyaz çizgi ikon: kömür bloklarda, ve açık
                                  yüzeylerde koyu mod ikizi (em-only-dark; Gmail opak karoyu gösterir)
  (emekli, dosyası duruyor) logo-laf-tile, check-badge, stamp-{empty,full}, bean-*, icons/<ad>-{cream,
  espresso,gold,hero}, band-*, logo-laf-{espresso,cream,glint,gold}, mono-*, wave-success:
                                  gönderilmiş eski e-postalar hâlâ bu adreslere bağlandığı için silinmez,
                                  hiçbir şablon çağırmaz
```

İkon adları: bell · calendar · card · check · clock · cup · gift · mail ·
mic · phone · pin · qr · receipt · scooter · star · store · tag · users.

Kampanya görseli (`KAMPANYA_GORSEL_URL`) ise formdan gelen, barındırılmış
bir `https` görselidir; boşsa hero satırı düşer. Yeni bir sabit görsel
`public/email/`e girer ve deploy ile yayına çıkar - şablon deploy'dan önce
gönderilirse görsel kırık gelir. Her şablon en az bir `laffogato.net/email/`
varlığı çağırır (logo) ve çağırdığı her dosya diskte durur.

## Palet

22 Kas 2026'dan beri palet **sitenin** paletidir (`docs/BRAND.md` §0 ve
§10). Porselen ve yeşil (`#f7f3ed`, `#1d6d56`, `#17594a`, `#765923`,
`#e8c877` …) ve Köşk değerleri emeklidir; yeni öğe onları yazmaz.

| Rol                                    | Açık mod                                    | Koyu mod (sınıf)                    |
| -------------------------------------- | ------------------------------------------- | ----------------------------------- |
| Dış zemin                              | bant `#f6f6f3`                              | `#121212` (`em-bg`)                 |
| Kart                                   | `#ffffff`, çerçevesiz, köşe 0               | `#1a1a1a` (`em-card`)               |
| İç panel (kod kutusu, uygulama şeridi) | bant `#f6f6f3`                              | `#262626` (`em-panel`)              |
| Metin / ikincil                        | `#000000` / `#6c6864`                       | `#f2f2f2` / `#a6a6a6` (`em-t1/t3`)  |
| Çizgi / kural                          | `#dcdcd6` / `#000000`                       | `#3a3a3a` / `#8c8c8c` (`em-ln/rule`) |
| Dolu düğme                             | `#333333`, beyaz yazı                       | `#ffffff`, siyah (`em-btn`, `em-btn-t`) |
| Çerçeveli düğme                        | 1px `#333333`, siyah yazı                   | açık kenar ve yazı (`em-btn-o`, `em-t1`) |
| Koyu blok (koyu açılış, bilet, footer) | kömür `#333333`; içinde kutu `#1f1f1f`      | aynı                                |
| Koyu blokta metin                      | `#ffffff` / `#c6c6c6`, kural `#5c5c5c`      | aynı                                |
| Koyu blokta düğme                      | beyaz dolu (siyah yazı) ya da beyaz çerçeve | aynı                                |
| Durum ("onaylandı")                    | `#1f6b4a` / `#e9f0ed` (`em-ok`)             | `#9fd8bd` / `#173a2b`               |

Ölçülmüş oranlar `docs/BRAND.md` §10'da. Gri kömür zemine yazılmaz: koyu
blokta yalnız beyaz ve `#c6c6c6`.

**Yazı.** İki ses, sitenin sesleri; web fontu yüklenmez, yazı yüzü yoksa
sistemin groteski çizer:

- Başlık, etiket, kart başlığı, fiyat: `'Archivo','Helvetica Neue',
  Helvetica, Arial, sans-serif`, 400, `text-transform: uppercase`,
  `letter-spacing: 1.6px`. Açılış başlığı 28/36 (telefonda `em-h1` 24/32),
  bölüm başlığı 20/28, kart başlığı 16/22 ya da 14/20, etiket 12/16. Metin
  cümle düzeninde yazılır, büyük harfi CSS yapar.
- Cümle ve düğme: `'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI',
  Helvetica, Arial, sans-serif`, 400; gövde 16/24, alt başlık 18/26, küçük
  satır 14/22, dipnot 12/18.
- Kod (kupon, takip, fatura no): sistemin eş genişliklisi, 24/32, 4px aralık.

**Düğme.** Kare, 48px (13px 36px iç boşluk), Geist 16px, **cümle düzeninde**
("Siparişimi görüntüle"); tek çağrı `width="350"` ve telefonda tam satır.
Koddan ya da panelden gelen düğme yazısı (`BUTON_METIN`, `KAMPANYA_BUTON`)
da cümle düzeninde yazılır.

**Koyu mod - nasıl çalışır.** Her şablon AYNI `<style>` bloğunu taşır:

- Apple Mail, iOS Mail, Outlook for Mac `prefers-color-scheme`'i uygular;
  blok sınıfları koyu değerlere çevirir.
- Outlook.com ve Outlook uygulamaları yeniden boyadığı öğelere
  `data-ogsc` / `data-ogsb` koyar; aynı sınıflar bu seçicilerle de eşlenir.
- Gmail ikisini de uygulamaz, renkleri kendisi ters çevirir, görselleri
  çevirmez. Bu yüzden zemini gömülü görsel yoktur, logo ve açık yüzeydeki
  ikonlar opak karodur.

Sınıf, öğenin **üstünde durduğu yüzeye** göre konur: açık yüzeydeki metin,
çizgi ve zeminler sınıf taşır; kömür yüzeylerdeki öğeler taşımaz, iki modda
da okunur. Yeni bir öğe eklerken rengine karşılık gelen sınıfı da ver
(`em-t1` `#000000` için, `em-t3` `#6c6864` için vb.).

## Değiştirdikten sonra

```bash
npm run email:build   # templates.generated.ts'i tazeler (commit'lenir)
node scripts/gen-email-assets.mjs   # yalnız görsel değiştiyse
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
İndirim ve toplam ile onaylanan ÖBF ve MSS'nin sipariş bilgileriyle
doldurulmuş metnini ek olarak ve sürüm bağlantılarını taşır (`BELGE_EKI`, 21
Ekim 2026); ek kurulamazsa eski satır, ÖBF/MSS/cayma bağlantıları
(`BELGE_GUNCEL`). Ayrıntı `docs/EMAIL-RESEND.md` "Ek: onaylanan sözleşme".
