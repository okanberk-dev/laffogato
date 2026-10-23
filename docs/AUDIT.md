# Denetim - Eylül 2026

Sitenin tamamı on boyutta (güvenlik, doğruluk, ödeme, mevzuat, SEO,
erişilebilirlik, performans, UX, Next.js uyumu, ölü kod) denetlendi. Ham bulgular
çatışmalı doğrulamadan geçirildi: her iddia, çürütmeye çalışan ayrı bir okuma ile
karşılaştırıldı ve yalnızca ayakta kalanlar buraya alındı.

> **Durum:** Denetim partisi ve sonrasında yapılanlar canlıda. `main` doğrudan
> production'a deploy oluyor (`laffogato.net`), migration'lar da uygulamanın
> kendisi tarafından uygulanıyor - bkz. §6. Bekleyen tek operasyonel iş
> `PAYMENT_PROVIDER`'ın Vercel'de tanımlı olması (§5).

**Sonuç: 71 doğrulanmış bulgu.** Bunların 2'si kritik, 17'si yüksek, 34'ü orta,
18'i düşük önemdeydi. Bu belgenin yazıldığı sürümde **69'u düzeltildi**; kalan
2'si aşağıda "Açık" başlığı altında, neden açık bırakıldıklarıyla birlikte
duruyor.

> Bu belge, düzeltilen her şeyin **niçin** bir sorun olduğunu kaydeder. Aynı
> hatanın tekrar yazılmaması için çoğunun yanında onu yakalayan testin adı var.

---

## 0. Önem derecesi

| Derece    | Ölçüt                                                      |
| --------- | ---------------------------------------------------------- |
| 🔴 Kritik | Para kaybı, veri kaybı ya da kimlik doğrulama baypası      |
| 🟠 Yüksek | Kullanıcı işini göremiyor, ya da yanlış bilgi yayımlanıyor |
| 🟡 Orta   | Bozuk davranış, ama etrafından dolaşılabiliyor             |
| 🟢 Düşük  | Gereksiz yük, tutarsızlık, ölü kod                         |

---

## 1. Kritik

### Ödeme sağlayıcısı açık başarısız oluyordu

`PAYMENT_PROVIDER` tanımsızsa kod sessizce `mock` sağlayıcıya düşüyordu. Mock,
müşteriyi doğrudan `/odeme/donus?status=success` adresine yönlendirir; dönüş
rotası da siparişi `paid` yapar, stoğu düşer ve "ödemen alındı" e-postası
gönderir. Kasaya tek kuruş girmez ve hiçbir yerde hata görünmez.

Bu, en olası yanlış yapılandırmayla tetiklenir: iyzico anahtarları girilmiş ama
`PAYMENT_PROVIDER=iyzico` unutulmuş bir deploy. Üstelik sitenin kendi
sözleşmesi (`content.ts`) "mock sağlayıcı devredeyken ekranda açık uyarı
gösterilir" diyordu; öyle bir uyarı hiç yoktu.

**Düzeltme:** üretimde `mock` seçilirse ya da değişken hiç tanımlı değilse
`getPaymentProvider()` başlatmayı reddeder. Fail-closed.

### Rıza alınmadan Google Tag Manager yükleniyordu

GTM koşulsuz yükleniyordu; analitik ve pazarlama etiketleri ziyaretçiye hiç
sorulmadan çalışıyordu. Bu hem KVKK ihlali hem de footer'dan link verilen kendi
Çerez Politikamızın açık taahhüdüne aykırı: politika bir rıza bandı ve geri
alınabilir bir tercih merkezi vaat ediyordu; ikisi de kodda yoktu.

**Düzeltme:** Consent Mode v2 varsayılanları GTM konteynerinden **önce**,
`<head>` içinde satır içi çalışır ve rızaya bağlı her sinyal `denied` başlar.
Bant ve tercih merkezi bunları yalnızca açık seçimle yükseltir; footer'daki
"Çerez Tercihleri" düğmesi merkezi yeniden açar, çünkü rızanın geri alınması
verilmesi kadar kolay olmak zorunda. Bootstrap çerezi tarayıcıda okur -
sunucuda gömülseydi, statik olarak önbelleklenen layout bir ziyaretçinin
rızasını diğerine taşırdı. Test: `tests/consent.test.ts`.

---

## 2. Yüksek

| Bulgu                                                                                           | Düzeltme                                                                                     |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `magaza-hero` server action'larında **hiç yetki kontrolü yoktu**                                | Üçü de `requireRole("shopHero")` ile başlıyor                                                |
| Sipariş ID'leri sıralı; `/odeme/basarili/ord-0002` **başkasının siparişini** gösteriyordu       | Giriş yapmış müşterinin siparişi mi diye bakılıyor                                           |
| Webhook durumu doğrudan yazıyordu: idempotency kontrolü ve **ödeme onay e-postası atlanıyordu** | `applyPaymentSucceeded` üzerinden geçiyor                                                    |
| Kısmi iade **siparişin tamamını** `refunded` yapıyor, tutarı hiç kaydetmiyordu                  | `recordProviderRefund` deftere ekliyor, yalnız toplam tutara ulaşınca durumu değiştiriyor    |
| JSON-LD `</script>` kaçışı yapmıyordu (ürün adından **XSS**)                                    | Tek `<JsonLd>` bileşeni, `serializeJsonLd` ile kaçış                                         |
| Nav ve footer'daki iki menü linki **404** veriyordu (`/menu/affogato`, `/menu/gelato`)          | Dropdown gerçek rotalardan türetiliyor; test bunu koruyor                                    |
| İptal edilen sipariş **stoğu sonsuza dek kilitliyordu**                                         | `release_order_stock` + `stockReleasedAt` bekçisi                                            |
| Tek kullanımlık kupon ve promosyon **ödeme yapılmadan tükeniyordu**                             | İptalde geri veriliyor; ödenmeyen sipariş 45 dk sonra süpürülüyor                            |
| iyzico callback'i **imza doğrulamasına** düşüyordu: müşteri ödemeden sonra 401 JSON görüyordu   | `/odeme/donus` POST kabul ediyor, token'ı iyzico'ya soruyor, 303 ile başarı sayfasına atıyor |
| TOTP 2FA sırları **process içi Map'te** - yeni instance'ta 2FA sessizce devre dışı (fail-open)  | `admin_2fa` tablosu; DB'ye ulaşılamazsa `has2FA` **throw eder**                              |
| Giriş kilidi de process içi Map'ti: saldırgana **her cold start'ta 5 hak**                      | `auth_attempts` tablosu + atomik `record_auth_failure`                                       |
| Müşteri girişinde **hiç rate limit yoktu**                                                      | Aynı sayaç; 2FA kodu ve promosyon önizlemesi de bağlandı                                     |
| POS iade çağrısının hatası yutuluyor, admin'e **"iade edildi"** deniyordu                       | Önce POS çağrılıyor; başarısızsa iade hiç kaydedilmiyor                                      |
| Offer fiyatı **tam liraya yuvarlanıyordu** - ₺184,90 ürün Google'a ₺185 olarak yayımlanıyordu   | Fiyat kuruş biriminden üretiliyor; `priceLabel()` kuruşu koruyor                             |
| Yüklenen ürün görselleri **base64 olarak her sayfanın RSC payload'ına** giriyordu               | `/gorsel/...` rotalarından, önbelleklenebilir şekilde                                        |
| Server action gövde limiti 1 MB'ta: **3+ fotoğraflı ürün sessizce kaydedilmiyordu**             | `bodySizeLimit: "12mb"`                                                                      |
| Admin'deki "arama motorlarına aç" anahtarı **hiçbir şey yapmıyordu**                            | `robots.ts` ve `sitemap.ts` artık okuyor                                                     |
| Çalışmayan rezervasyon formu, JSON-LD ve meta'da **var olan hizmet gibi** duyuruluyordu         | `acceptsReservations: false`; buton `tel:` bağlantısı                                        |
| `/ziyaret` ve `/hikayemiz` **admin ayarlarını yok sayıyordu**                                   | İki sayfa da ana sayfayla aynı yükleyiciyi kullanıyor                                        |
| Ayarlardaki SEO başlığı, OG görseli ve hero görseli **hiçbir yerde okunmuyordu**                | Üçü de bağlandı                                                                              |
| **Parola sıfırlama yoktu** - dört yayımlanmış belge varmış gibi anlatıyordu                     | `/uye/sifremi-unuttum` + `/uye/sifre-sifirla`                                                |
| Bülten kaydı **açık rıza almıyordu** ve sitede hiçbir çıkış yolu yoktu (6563)                   | Ön işaretsiz onay kutusu, onay kaydı, tek tıkla `/bulten/cikis`                              |

---

## 3. Orta

**Ticaret ve para**

- Ödeme webhook'u tahsil edilen tutarı sipariş toplamıyla karşılaştırmıyordu:
  ₺500'lük siparişe ₺1 bildirimi geldiğinde sipariş `paid` oluyor ve müşteriye
  onay e-postası gidiyordu. Artık işlem kaydediliyor ama sipariş ilerlemiyor ve
  uyuşmazlık insan için sesli loglanıyor.
- Promosyon kullanım limiti ayrı bir okumada kontrol edilip ayrı bir yazımda
  artırılıyordu; son hakka yarışan iki checkout da geçiyordu. Artırım artık
  limiti kendi cümlesinde uyguluyor.
- Manuel stok düzeltmesi oku-değiştir-yaz'dı. Kaybedilen yazım **her zaman
  küçük olan** olduğu için sayaç yukarı sapıyordu; yukarı, fazla satışın yönü.
- Pano cirosu iade defterini hiç okumuyordu: geri verilen para ciro sayılıyordu.
- Ödenmemiş siparişe iade açılabiliyordu; iade yetkisi `staff` rolündeydi.
- Adedi 99'dan büyük satır **sessizce düşürülüyordu**: müşteri, istediğini
  içermeyen bir sepetin parasını ödüyordu.
- Boş veritabanına iki demo sipariş yazılıyordu - canlıda da. ₺740 uydurma ciro
  ve iki uydurma müşteri. Artık `SEED_DEMO_ORDERS=1` arkasında.

**Yapısal veri**

- Veritabanı kesintisinde menünün tamamı JSON-LD'de **0₺** olarak
  yayımlanıyordu (fiyatlar "-" render edilir, eski ayrıştırıcı bunu 0 yapıyordu).
- Stokta olmayan ürün `InStock` ilan ediliyordu.
- Kargo ücreti listede ₺29, ürün sayfasında ₺49, checkout'ta gerçek değerdi.
- `openingHoursSpecification` derleme zamanı sabitiydi; panelden değişen saat
  Google'a hiç ulaşmıyordu.
- FAQ'daki posta kodu (34953) sitenin geri kalanıyla (34940) çelişiyordu.
- `inLanguage` geçersiz BCP-47 değeri taşıyordu (`tr_TR`).
- `robots.txt`'te bot-özel gruplar disallow listesini iptal ediyordu: yirmi bot
  `/admin`, `/api`, `/odeme` ve `/uye`'ye davet ediliyordu.

**Erişilebilirlik** - hepsi aynı biçimde: fare ve gözle çalışıyor, başka
hiçbir şeyle çalışmıyordu.

- Sepet çekmecesi, ürün modalı, arama katmanı ve mobil filtre sayfası odağı
  içeri almıyor, Tab'ı tutmuyor, kapanınca odağı geri vermiyordu. Çekmece ve
  sayfa kapalıyken DOM'da kaldığı için düğmeleri ekran dışında sekme sırasındaydı
  ve `aria-modal` kalıcı duyuruluyordu - ekran okuyucu sitenin her sayfasında
  bir diyalog açık sanıyordu.
- Sepete ekleme, reddedilen promosyon kodu ve başarısız giriş yalnızca piksel
  değiştiriyordu.
- Mega menü yalnızca hover ile açılıyordu; `aria-expanded` klavyede hiç `true`
  olamıyordu.
- Hesap menüsü `change` olayında yönlendiren bir `<select>`'ti - birkaç
  tarayıcıda ok tuşuyla gezerken her seçenekte tetiklenir - ve odak halkası
  tamamen kaldırılmıştı.
- Kategori filtreleri arkalarında tabpanel olmadan `role="tablist"` iddia
  ediyor, seçili olanı hiç bildirmiyordu.
- Mağaza hero'su durdurulamıyor ve 6,5 saniyede bir "02 / 03" diye okunanın
  üstüne konuşuyordu.
- Ürün kartındaki iki düğme hover'a kadar `opacity: 0`'dı: klavye kullanıcısı
  görünmez iki kontrole sekiyordu.
- Skip link yalnızca SPA kabuğundaydı.

**Güvenlik**

- Admin giriş sayfası kimlik doğrulaması olmadan `ADMIN_EMAIL`'i basıyordu.
- 2FA kodunda brute-force koruması yoktu: ikinci faktör, arkasındaki paroladan
  ucuz hedefti.
- Oturum çerezi 30 gün boyunca saf taşıyıcıydı; parola değiştirmek - biri
  oturumunun çalındığından şüphelenince yaptığı tek şey - hiçbir çerezi
  geçersiz kılmıyordu.
- Site hiçbir güvenlik başlığı göndermiyordu: CSP, HSTS, nosniff, çerçeveleme
  kuralı, hiçbiri.

**Performans**

- 351 KB'lık PNG, 40 px'lik logo için CSS mask olarak her sayfada iniyordu -
  mask yalnızca alfa kanalını okur, rengi çöpe atar.
- 861 KB'lık three.js widget'ı ana sayfanın **ilk** öğesiydi, yani "görünür
  alana girince yükle" pratikte "hemen yükle" demekti.
- Mağaza hero'su üç slaydın üçünün de arka planını ilk boyamada indiriyordu.

---

## 4. Düşük

- Hiç import edilmeyen dört bağımlılık + kimsenin çağırmadığı bir `cn()`
  yardımcısı ve onun iki bağımlılığı.
- `public/` altında beş kullanılmayan Next.js starter SVG'si.
- `useReveal()` ölü koddu: CSS'te karşılığı olmayan bir sınıf ekliyor, buna
  rağmen sayfa başına 54+ eleman gözlemliyordu.
- 1,5 MB'lık hukuk metni, iki string sabiti için `/odeme` sunucu bundle'ına
  giriyordu.
- `/menu`, `/ziyaret`, `/hikayemiz` hiç göstermedikleri mağaza hero slaytlarını
  çekiyordu.
- Ana sayfa ve kategori sayfalarında `og:site_name` / `og:locale` kayboluyordu;
  ana sayfa üç farklı başlık yayımlıyordu.
- Ürün sayfasındaki OG etiketleri `property` yerine `name` ile basılıyordu, bu
  yüzden hiçbir Open Graph tüketicisi okumuyordu.
- `--accent` bağlantı rengi 13 px metinde 3,70:1 kontrasttaydı.
- `llms.txt` kendi yapısal verisini yanlış tarif ediyordu.
- Promosyon kodu önizlemesi kimlik doğrulamasız ve sınırsızdı - kod
  numaralandırma için çalışan bir kâhin.
- Menü kalemine panelden fotoğraf eklemek imkânsızdı: alan yalnızca `public/`
  altındaki bir yolu kabul ediyor, girilen https adresini sessizce siliyordu.

---

## 5. Açık kalanlar

**Sanal POS (tarihçe).** Bu bölüm yazılırken iyzico canlıya alınmayı
bekliyordu; 6 Eyl 2026'da karar **PayNkolay** oldu ve üretim sağlayıcısı odur
(iyzico modülü kodda duruyor, kullanılmıyor). Kurulum, hash formülleri ve
"PayNkolay webhook göndermez" kuralı `docs/PAYNKOLAY.md`'de: canlı ölçüm
listesi §12, ortam değişkenleri §13. O günün iki tuzağından biri sağlayıcıdan
bağımsız olarak geçerlidir: `PAYMENT_PROVIDER` her ortamda tanımlı olmalı;
tanımsız ya da `mock` bırakmak üretimde açıkça hata verir, çünkü mock para
almadan siparişi `paid` yapar.

**11 mağaza ürününün ve 2 hero slaydının görseli yok.** Bu bir kod hatası
değil, eksik içerik: ürün fotoğrafı çekilip panelden yüklenmeli. Yükleyici
artık çalışıyor ve görseller önbelleklenebilir bir adresten servis ediliyor;
eksik olan fotoğrafların kendisi. Bu ortamın giden bağlantısı görsel
sunucularını (Unsplash, Pexels, Wikimedia) engellediği için stok fotoğraf da
indirilemedi - kartlar bu yüzden markaya özgü SVG çizimlerle render ediliyor.

~~**SPA'nın beş sayfası tek client chunk'ta.**~~ 24 Eyl 2026'da kapandı - §6'ya
bak.

~~**Kampanya e-postası İYS'ye bağlı değil (8 Eyl 2026).**~~ 22 Eki 2026'da
kapandı - §6'ya bak. Açık kalan: Resend ücretsiz planının günlük 100 e-posta
sınırı (100'den kalabalık kitleye göndermeden plan yükseltilmeli). Bounce/şikâyet
bastırma listesi 23 Eyl 2026'da yazıldı (`email_suppressions`,
`/api/webhooks/resend`); `RESEND_WEBHOOK_SECRET` tanımlanıp uç Resend'e
kaydedilene kadar kapalıdır (`docs/EMAIL-RESEND.md` §7).

---

## 6. Denetim sonrası yapılanlar

Denetim partisinden sonra, canlı siteye bakarken ya da kullanıcıdan bilgi
geldikçe eklenenler.

**MERSİS numarası yayımlandı.** `0734069467300012`, işletme sahibinin ibraz
ettiği ticaret sicil kaydından. Şirket Bilgileri tablosunda ve Organization
JSON-LD'sinde `identifier` olarak görünüyor. **Ticaret sicil / dosya numarası
işletme sahibinin tercihiyle yayımlanmıyor**, KEP adresi de henüz yok - ikisi de
boş bırakıldığı için ilgili tablo satırları hiç basılmıyor. (TTK m.39 ticari
belgelerde sicil numarasını da arar; yayımlanması istenirse `entity.ts` içinde
`tradeRegistryNo: "48639"` yazmak yeterli, gerisi otomatik.)

**Mobil hero sayfayı hapsediyordu.** Hero `100svh` yüksekliğindeydi ama alt tab
bar `position: fixed` ve hero'nun son 56 pikselini örtüyordu - yani kendi
kaydırma göstergesi barın arkasında kalıyor ve altında hiçbir şey görünmüyordu.
Telefonda gördüğün ilk ekran, devamı olmayan bir sayfa gibi duruyordu. Hero
artık barı, safe-area inset'ini ve bilinçli 40px'i çıkarıyor; her cihazda aynı
96px'lik bir sonraki bölüm kenarı görünüyor. Ayrıca widget'ın canvas'ına
`touch-action: pan-y` sabitlendi: vendor bundle three.js OrbitControls üzerine
kurulu ve OrbitControls bağlanırken `none` yazıyor - bugün `pan-y`'ye çekiyor,
ama bir yeniden derleme bunu geri alsa tam ekran hero telefonda kaydırılamaz
hâle gelirdi ve bunu telefon dışında fark etmenin yolu yok.

**Harita, sayfanın yazdığı adrese bakmıyordu.** Gömülü harita ve "Yol tarifi"
bağlantısı hâlâ `29 Ekim Cd.` adresini geocode ediyordu; sayfa Atatürk
Caddesi yazarken kendi tarif düğmesi başka bir yere yolluyordu. İşletme
sahibiyle teyit edildikten sonra düzeltildi - iki sokak adı arasında tahmin
yürütmek müşteriyi yanlış kapıya göndermek demek, ki bu tutarsızlıktan kötü.

**Canlıdaki iletişim bilgileri eskiydi.** `settings` satırı vergi levhası
gelmeden önce yazılmıştı; seed yalnızca tablo boşken yazdığı için footer her
sayfada `tuzla@laffogato.it` ve eski sokak adını gösteriyordu - `/hukuk` ise
yasal kimlikten okuduğu için doğrusunu. `20260901180000_settings_identity_backfill.sql`
bunu düzeltir; her kolona yalnızca hâlâ tam olarak eski değeri taşıyorsa
dokunur, yani sonradan panelden yazılmış bir şeye karışmaz.

**SPA'nın beş sayfası artık ayrı chunk'larda (24 Eyl 2026).** `pages.tsx`
(2.568 satır) sayfa başına bir dosyaya bölündü: `home-page.tsx`,
`menu-page.tsx`, `shop-page.tsx`, `story-page.tsx`, `visit-page.tsx`; ortak
`PageProps` ve iki sayfanın kullandığı etiket sözlüğü `page-shared.ts`'te.
Sayfa gövdeleri satırı satırına aynı taşındı. `app.tsx` her sayfayı
`next/dynamic` ile yükler: her rota zaten kabuğu sabit bir `initialRoute` ile
yeniden kurduğu için bir ziyaret yalnız kendi sayfasının chunk'ını indirir.
`ssr` açık (sunucu sayfanın tamamını basar, chunk HTML'den önceden yüklenir) ve
bilerek `loading` yedeği yok - yedek, istemci geçişinde `<main>`'i
boşaltabilecek bir Suspense sınırı eklerdi; onsuz eski sayfa yenisi hazır
olana kadar yerinde kalır.

Ölçüm (`next build` + `next start`, sunucunun bastığı HTML'deki her
`/_next/static` betiği, gzip -9): önce her SPA rotası 765,7 KB ham / 232,4 KB
gzip; sonra `/` 729,1 / 224,5 · `/menu` 703,4 / 216,4 · `/magaza` 714,2 /
219,3 · `/hikayemiz` 722,9 / 222,8 · `/ziyaret` 711,1 / 217,8. Sunucunun
bastığı HTML yedi rotada (beş sayfa + `/menu/espresso`, `/magaza/cekirdek`)
bayt bayt aynı kaldı; tek fark her build'de değişen server action anahtarı.
Beş sayfa tarayıcıda hem doğrudan açılışta hem istemci geçişiyle gezildi:
hydration hatası yok, sepet, menü filtreleri ve ziyaret seçicileri çalışıyor.
Bir sayfayı statik olarak geri import etmek bölmeyi sessizce geri alır;
`tests/spa-page-chunks.test.ts` bunu tutar.

**Kampanya e-postası İYS'ye bağlandı (22 Eki 2026).** Yasal metinler onayın
İYS'ye kaydedileceğini, retlerin İYS'ye bildirileceğini ve gönderim öncesi
İYS'nin kontrol edileceğini söylüyordu; kodda hiçbiri yoktu. 250.000'den az
adresi olan hizmet sağlayıcı İYS API'sini entegratörsüz çağıramadığı için
aktarım bugün elle (İYS Web), ama kural kodda: `iys_recipients` ve
`iys_events` (giden kutusu) her onayı ve reti İYS'nin alanlarıyla, son
günüyle (3 iş günü, tatiller sayılmadan) tutar; `/admin/iys` neyin ne zamana
kadar yükleneceğini söyler, İYS'nin sütun sırasıyla dosyayı verir, yüklemeyi
ve İYS'nin reddini işler, İYS'nin izin listesini okuyup oradaki yeni retleri
sitede uygular (defter kaynağı `iys`). Kampanya kitlesi (sayım, kuyruk,
her partiden önceki yeniden okuma) ve doğum günü e-postası yalnız İYS'de
ONAY görünen adrese gider; son İYS ret kontrolü 3 iş gününden eskiyse hiç
ticari e-posta gitmez (`src/lib/iys/gate.ts`). Metinler sürelerine göre
düzeltildi (`docs/LEGAL-REDLINES-2026-09.md` §31). Operatörün işi:
`docs/IYS.md`.

### Migration'lar kendiliğinden uygulanır

Bunu belgelemeye değer, çünkü aksini varsaymak kolay: **deploy'da elle
`npm run db:migrate` çalıştırmak gerekmiyor.** `src/lib/db/bootstrap.ts`
içindeki `ensureSchemaFresh()` her sorgudan önce `_migrations` tablosunu
paketteki `MIGRATION_NAMES` listesiyle karşılaştırır; eksik varsa üretilen
`SCHEMA_SQL` bundle'ını advisory lock altında uygular. Bundle idempotenttir ve
neyi uyguladığını `_migrations`'a yazar, dolayısıyla sonradan koşturulan bir
CLI migration çakışma değil no-op olur.

İki sonucu var:

1. Vercel'in build komutunun (`next build`) migration çalıştırmıyor olması bir
   eksik değil - bilinçli. Build veritabanına hiç bağlanmaz.
2. `npm run db:bundle` çalıştırmayı unutmak **gerçek** bir hatadır: yeni
   migration bundle'a girmezse ne uygulama ne de CLI onu görür. Yeni migration
   yazdıktan sonra her zaman `npm run db:bundle` koş ve üretilen dosyaları
   commit'le.

### Sıradaki: veritabanı değişecek

Yeni bir veritabanına geçildiğinde ek bir iş yok: boş bir veritabanında
uygulama şemayı ilk sorguda kendisi kurar ve seed doğru varsayılanları yazar -
`defaultSettings()` zaten güncel e-posta ve adresi taşıyor. Yukarıdaki backfill
migration'ı o durumda hiçbir satır bulamaz ve sessizce no-op olur; kalması
zararsız, çünkü eski verinin taşındığı bir senaryoda hâlâ işe yarar.

Yalnızca `DATABASE_URL`'in yeni bağlantı dizesiyle güncellenmesi yeterli.

---

## 7. Bu bulguları koruyan testler

| Test                             | Neyi kilitliyor                                                             |
| -------------------------------- | --------------------------------------------------------------------------- |
| `tests/consent.test.ts`          | Rıza sinyalleri `denied` başlar; bootstrap GTM'den önce basılır             |
| `tests/consent-records.test.ts`  | Onaysız bülten kaydı yok; parola sıfırlama üyelik ifşa etmez                |
| `tests/structured-data.test.ts`  | `</script>` kaçışı, kuruşlu fiyat, stok durumu, rezervasyon iddiası         |
| `tests/security-headers.test.ts` | CSP script kaynakları, object/base-uri/form/frame kısıtları                 |
| `tests/commerce-guards.test.ts`  | Fiyat etiketi gidiş-dönüşü; iade yetkisi `staff`'ta değil                   |
| `tests/image-serving.test.ts`    | Data URL'ler önbelleklenebilir adrese çevrilir; içerik tipi taklit edilemez |
| `tests/payment-return.test.ts`   | Callback webhook'a bakmaz; dönüş POST kabul eder ve 303 yapar               |
| `tests/session-binding.test.ts`  | Parola değişince oturum parmak izi değişir                                  |
| `tests/route-paths.test.ts`      | Nav'daki her slug'ın gerçek bir rotası var                                  |
| `tests/contrast.test.ts`         | Küçük metin koyu accent'i kullanır                                          |
| `tests/legal-docs.test.ts`       | Checkout sabitleri 1,5 MB'lık kayıttan ayrı durur                           |
| `tests/spa-page-chunks.test.ts`  | Beş SPA sayfası `next/dynamic` ile ayrı chunk; hiçbiri statik import edilmez |
| `tests/db-integration-iys.test.ts` | İYS: eşitleme ONAY/RET üretir, ONAY üstüne ONAY ve RET üstüne RET yok; kitle, sayım, kuyruk, parti yeniden okuması ve doğum günü bayrağı yalnız İYS'de kayıtlı adres; İYS listesindeki yeni ret sitede uygulanır |
| `tests/campaign-emails.test.ts`  | İYS kontrolü eskiyken kampanya kuyruğa alınmaz, parti alınmaz, zamanlanmış taslak bekler |
| `tests/email-birthday-cron.test.ts` | İYS kontrolü eskiyken doğum günü kuponu verilir, e-postası gitmez |
| `tests/iys-core.test.ts`         | 3 iş günü (İstanbul saati, hafta sonu), İYS dosya biçimi, İYS listesinin okunması |
| `tests/admin-iys.test.ts`        | `/admin/iys` eylemleri ve dosya ucu rolü kendisi denetler; olay kaydında adres yok |
| `tests/legal-iys.test.ts`        | Metinler İYS'ye bildirimi "anında" değil 3 iş günü içinde der |

---

## 8. Backend + mobil parite denetimi - 23 Eyl 2026

Arka yüzün tamamı dört koldan yeniden okundu: (1) `lafmobil` uygulamasının
gerçekte gönderdiği/okuduğu her alan ile `/api/mobile/v1` kodunun karşılaştırması,
(2) mobil iş mantığı, (3) ödeme · sipariş · veritabanı katmanı · cron,
(4) admin kimliği · müşteri hesabı · bülten. Her bulgu koddan ikinci kez
doğrulandı; düzeltilenlerin her birinin yanında onu tutan test var.

**Parite sonucu:** iki depodaki `docs/API-MOBILE.md` bayt bayt aynıydı; çekirdek
akışlarda (sipariş, ödeme, profil, sadakat, karaoke, menü/mağaza) kırık alan
yok. Uygulamanın çağırdığı her uç sunucuda var (§18 Cüzdan ve §19 Hediye kartı
hariç - belge onları "henüz yok, 404 beklenir" diye yazıyor, uygulama 404'ü
"özellik kapalı" okuyor). Ayrışan dört şey bulundu, hepsi düzeltildi (aşağıda
🟠/🟡 işaretli mobil satırlar).

### Düzeltilenler

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🔴 | 2FA'lı hiçbir admin giriş yapamıyordu: `proxy.ts` `/admin/iki-asama`'yı tam oturum çereziyle koruyordu, o adımda yalnız bekleyen çerez var → sonsuz döngü | Adım proxy'den muaf; sayfa ve action bekleyen çerezi kendisi doğrular | `admin-proxy-2fa` |
| 🔴 | `rpc()` `RETURNS TABLE` fonksiyonları tek hücre okuyordu → kayıt *dizesi*. Doğum günü cron'u her gün boş kitleyle "başarılı" bitiyordu; giriş kilidi mesajı `NaN` sayıyordu | `rpcRows()` (`SELECT * FROM fn()`); şemadaki her tablo-döndüren fonksiyonun `rpc(` ile çağrılmadığını test tutar | `db-rpc-table-functions`, `db-client`, `db-sql` |
| 🔴 | İade: POS'a para iadesi **önce** gidiyor, defterin reddi (ödenmemiş, iptal, kalanı aşan tutar) **sonra** geliyordu | Kontroller tek saf fonksiyonda (`refundRefusal`), sağlayıcıdan önce | `admin-refund-guards` |
| 🟠 | Ödenmiş siparişe ikinci başarılı tahsilat "zararsız tekrar" sayılıp "ödemen alındı" yeniden gidiyordu | `duplicate_payment` olarak denetim kaydına düşer, e-posta gitmez | `payment-duplicate-charge` |
| 🟠 | İptal edilmiş ama ödenmiş sipariş hiç iade edilemiyordu (iptal diyaloğu "iade ayrıca başlatılır" diyor) | İade edilebilir; durum `cancelled` kalır | `admin-refund-guards` |
| 🟠 | `"1.250,00"` → `parseFloat` → **1,25 ₺** iade / kupon / promosyon | `parseMoneyInput()` Türkçe ve düz yazımı okur, belirsizi reddeder | `admin-refund-guards`, `promo-schema` |
| 🟠 | Personel tek tek ödenmiş sipariş iptal edebiliyordu (toplu iptal zaten iade yetkisi istiyordu) | Aynı kural tekil iptalde | `admin-refund-guards` |
| 🟠 | `freshEnrollment` bir server action'dı: oturumu olan herkes etkin 2FA'yı denetim kaydı bırakmadan kapatabiliyordu | Sayfaya taşındı; `startEnrollment` etkin kaydın üstüne yazmaz | `admin-2fa-enrollment` |
| 🟠 | Mobil: aynı `clientOrderId` ile tekrar, POS açılamayınca **201 + `payment: null`** dönüyordu (§3 bunu yalnız ₺0'a ayırır) → uygulama ödenmemiş siparişi verilmiş sanıyordu | Tekrar da ilk deneme gibi başarısız olur; sonraki deneme aynı siparişi açar | `mobile-order-idempotency` |
| 🟠 | Mobil: Supabase **429**'u 401 sayılıyordu → trafik anında üyeler oturumdan atılıyordu | 429/408 → 503 `auth_unavailable` | `mobile-auth` |
| 🟠 | Mobil parite: `GET /coupons` `cafeOnly` göndermiyordu; uygulama okuyordu → "Yalnızca kafe siparişlerinde" etiketi hiç çıkmıyordu | Alan eklendi (yalnız ekleme) + §5 | `mobile-me-mapper` |
| 🟠 | Giriş `?next=`'i okumuyordu: ödeme/karaoke'den girişe giden müşteri hesabına düşüp akıştan çıkıyordu | `next` form üzerinden taşınır, yalnız site içi yol izlenir | `frontend-form-contract` |
| 🟠 | Web: ₺0'lık sipariş (tam indirim) POS'a "0.00" gidiyor, asla tamamlanamıyordu | Yerinde `free` sağlayıcıyla kapanır (mobil yol gibi) | `checkout-zero-total` |
| 🟠 | Sipariş geçmişi e-postayla eşleşiyor, kayıt doğrulamadan önce oturum açıyor → admin'in elle girdiği siparişteki yabancının adı/telefonu/adresi görünüyordu | `memberOrders()`: doğrulanmamış e-postaya boş | `member-orders` |
| 🟡 | Reddedilen kartla dönen müşteri hiçbir mesaj görmüyordu (`?durum=basarisiz` okunmuyordu) | `?error=payment` | `frontend-form-contract` |
| 🟡 | Aynı siparişin damgası iki kez geri alınabiliyordu (eşzamanlı iade + iptal) | Geri alma satırının kimliği siparişten türer; PK ikinciyi reddeder | `mobile-loyalty-reversal` |
| 🟡 | Mobil parite: panel 0-23 hatırlatma saati kaydediyordu, uygulama 08-21 dışını sessizce düşürüyordu | Panel 08-21'i zorlar, alan altında mesaj | `admin-reminder-hours` |
| 🟡 | Sipariş tekrarı, personel siparişi kapatınca 409 `ordering_closed` alıyordu | Tekrar, anahtarlardan önce | `mobile-order-idempotency` |
| 🟡 | `PATCH /me/addresses/{id}` `isDefault` yoksa varsayılan adresi düşürüyordu | Yoksa değişmez | `mobile-address-patch` |
| 🟡 | Ciro raporu: ayın 29-31'inde aylık görünüm bu ayı iki kez gösterip geçen ayı atlıyordu; günler UTC gece yarısında bölünüyordu | Ay adımı 1'inden; kovalar İstanbul saatine göre | `admin-revenue-buckets` |
| 🟡 | Sitedeki "Bugün" saatleri 00:00-03:00 arası dünün saatlerini gösteriyordu (sunucu UTC) | `istanbulDay()` | - |
| 🟡 | Promosyon bitişi `datetime-local` → UTC okunuyordu; 3 saat fazla geçerliydi | UTC anı olarak saklanır | `promo-schema` |
| 🟡 | Toplu "Hazırlanıyor" ödenmemiş siparişi ödenmiş sayıyordu (paidAt, damga, ciro) | Toplu işlemde ödenmemişler atlanır | `admin-order-guards` |
| 🟡 | Manuel sipariş stok ayırdıktan sonra hata verirse stok geri dönmüyordu | `placeOrder` gibi telafi | `admin-order-guards` |
| 🟡 | Hesap silme: kasa QR jetonları e-postayı tutuyordu, süresi dolmamışı hâlâ okutulabiliyordu | Anonimleşir + anında süresi dolar | `mobile-account-deletion` |
| 🟢 | Favori `back` alanıyla açık yönlendirme | `sameSitePath()` | `same-site-path` |
| 🟢 | Web siparişi, ödeme sağlayıcısı kontrol edilmeden oluşturulup e-postalanıyordu; kesirli adet 500'e düşüyordu | Sağlayıcı önce; adet tam sayı | `checkout-zero-total` |
| 🟢 | `/?hesap=silindi` hiçbir yerde karşılanmıyordu | Ana sayfa bildirimi | `frontend-form-contract` |
| 🟢 | Sabit "6 damga" mesajı (hedef 3-20 ayarlanabilir); hesap silmede UTC tarih; doğum günü kuponu web yedeği UTC ayı | Yapılandırılmış hedef; `istanbulClock` | `mobile-venue-clock` |
| 🟢 | `constantTimeEqual` uzunluk farkında erken dönüyordu (env admin parolasının uzunluğu sızıyordu); backend'de 7 lint uyarısı | SHA-256 sonra karşılaştırma; kullanılmayan importlar | - |
| 🟢 | Sözleşme belgesi koddan geri kalmıştı: §0 403 `email_unverified`, §3 preview hız sınırı 200 döner, §5 `kind`/`code`, §6 SWR yok, §7 403 | Belge koda eşitlendi (davranış değişmedi) | `api-contract-parity` |
| 🔴 | Admin oturumu geri alınamıyordu: çerez 7 gün e-posta ve rolü taşıyordu; pasifleştirme, rol düşürme, parola sıfırlama çerez bitene kadar işlemiyordu. TOTP kodu ±30 sn içinde tekrar kullanılabiliyor, 2FA kodsuz kapatılabiliyordu | Token'da kimlik bilgisinin anahtarlı parmak izi; hesap her istekte yeniden okunur. TOTP adımı harcanır (`admin_2fa."lastStep"`); 2FA'yı kapatmak güncel kod ister. **Deploy sonrası adminler bir kez yeniden girer** (eski 4 parçalı çerez reddedilir) | `admin-auth-sources`, `admin-2fa-enrollment`, `db-integration-audit` |
| 🔴 | Kaba kuvvet sınırı paralel isteklerle aşılıyordu (25 eşzamanlı denemenin 9'u geçiyordu) | `reserve_auth_attempt()`: deneme kimlik bilgisi denetlenmeden **önce**, satır kilidi altında sayılır; `admin-2fa` için IP'den bağımsız hesap tavanı. Sınıra takılan giriş `audit_logs`'a yazılmaz | `db-integration-audit`, `admin-login-audit` |
| 🔴 | 45 dakikalık süpürme ve dönüşü gelmeyen ödeme: POS'a sorulmadan iptal ediliyor, parası alınmış siparişin stoğu geri veriliyordu (PAYNKOLAY §14.6/2) | İptalden önce `lookupPayment` (`PaymentList`); `SUCCESS` → `applyPaymentSucceeded`. POS'a ulaşılamazsa bir gün dolana kadar iptal yok | `db-integration-payment-sweep`, `payment-paynkolay` |
| 🟠 | İade defteri ve üç tavan (`MAX_OPEN_ORDERS`, `KARAOKE_OPEN_CAP`, kasa jetonu hızı) JS'te oku-karar ver-yaz: eşzamanlı iki iade ikisi de POS'a gidebiliyordu | `reserve_order_refund` tek koşullu UPDATE (POS'tan **önce**, ret olursa `drop_order_refund`); tavanlar üye başına advisory lock'lu BEFORE INSERT tetikleyicileri | `db-integration-audit`, `atomic-caps-sql` |
| 🟠 | Bülten (6563): alt bilgi formu herkese herhangi bir adresi abone yaptırıyordu; admin çıkmış aboneyi eski onayla açabiliyordu; çıkış linki GET'te belirteci harcıyordu (e-posta tarayıcıları aboneliği bitiriyordu) | Çift onay (`/bulten/onay`, 7 gün), adres başına hız sınırı, panelde yalnız kapatma; çıkış bir **düğme** (POST) - RFC 8058 tek tık başlığı aynen duruyor | `newsletter-double-opt-in`, `db-integration-audit` |
| 🟠 | Reddedilen karttan sonra tekrar deneme: ödenmemiş ilk sipariş tek kullanımlık kuponu ve stoğu 45 dk tutuyor, yeni sipariş kuponu uygulayamıyordu | Yeni web ödemesi üyenin kendi ödenmemiş web siparişlerini (POS'a sorduktan sonra) bırakır. `/odeme/donus`'ta yapılmadı: o POST'ta oturum çerezi yok, herhangi bir sipariş için taklit edilebilir | `checkout-retry-releases`, `db-integration-payment-sweep` |
| 🟠 | CSP `form-action 'self'` PayNkolay köprüsünün POS'a POST'unu engelliyordu (canlıya alma engeli, §14.6/1) | Test ve canlı PayNkolay hostları eklendi, başkası reddedilir | `security-headers` |
| 🟠 | Mobil sipariş okumaları (`GET /orders`, `/orders/{id}`, bildirimler) e-postayla eşleşiyor, doğrulamaya bakmıyordu | Doğrulanmamış üyeye boş liste / 404; bildirimde sipariş kaydı yok (biçim aynı) | `mobile-order-reads-verified` |
| 🟠 | Onaysız Supabase kullanıcısı ikinci istekten itibaren **kendi açtığı** satırdan kilitleniyordu (403 `email_unverified`) | Satır zaten bu kimliğe bağlıysa reddedilmez; hiçbir şey doğrulanmış sayılmaz | `mobile-auth` |
| 🟠 | lafmobil: `DELETE /me` 409 `orders_in_progress` genel hata metniyle gösteriliyordu; 403 `account_disabled` oturumu kapatmıyordu | Uygulama sunucunun cümlesini gösterir; `account_disabled`'da cihaz oturumu kapanır (lafmobil) | lafmobil `api.test`, `profile.test` |
| 🟡 | Davet: davet edenin kuponu hata verince davetli yeniden denemede ikinci kupon alıyordu | Verilen kuponlar davet satırına yazılır (`inviteeCouponId`/`inviterCouponId`); tekrar yalnız eksiği verir | `mobile-invite` |
| 🟡 | `transitionOrder` durumu koşulsuz yazıyordu: bayat ekrandan tıklama, süpürmenin iptal edip stoğunu geri verdiği siparişi diriltebiliyordu | Yazım okunan duruma koşullu; kaybederse "Sipariş bu arada değişti" | `mobile-order-reads-verified` |
| 🟡 | `ensureSchemaFresh` başarısız kontrolü örnek ömrü boyunca hatırlıyordu: soğuk başlangıçtaki tek bağlantı hatası, o deploy'un migration'larını uygulatmıyordu | 30 sn sonra yeniden dener (her sorguda değil) | `db-schema-freshness-retry` |
| 🟢 | lafmobil: RN 0.86 Jest preset'i native animasyon sürücüsünü taklit etmiyordu; bildirim (toast) bekleyen her test ekranı çökertiyordu (temiz kurulumda en az 21 test) | Testlerde JS sürücüsü; Reduce Motion'da yükleme noktaları ilk karede donmuş pozda | lafmobil `feedback.test` |

### Açık

§8'de açık madde kalmadı (23 Eyl 2026, ikinci geçiş). Kodda değil operatörde
duran iş: PayNkolay'ın canlı ölçüm listesi (`docs/PAYNKOLAY.md` §12) - köprü
formunun POS'a gidişi (CSP artık izin veriyor), `PaymentList` üretim ucu (17 Eki
2026'da canlıda doğrulandı, `docs/PAYNKOLAY.md` §2) ve dönüş hash'inin
`CURRENCY_CODE` alanı.

PR #196'nın incelemesinde bulunan, önceden var olan ve orada düzeltilmeyenler
(21 Eki 2026):

- 🟢 `audit-logs` imha kuralı 10 × 366 günü `createdAt`'ten sayıyor, takvim
  yılının bitişinden değil (TTK m.82/6). Bugün hiçbir satıra değmiyor (en eski
  satır 2026); kural ilk kez 2036'da işler.
- ~~🟢 Hukuk metinleri damga hareketlerinin bildirimler ekranında göründüğünü
  söylüyor~~ **Düzeltildi (22 Eki 2026):** KVKK §12, §20 ve Açık Rıza §13
  ekranın gösterdiğini söylüyor (sipariş durumu, ödülün hazır olması,
  kilometre taşı hediyeleri); damgalar damga kartında. Mobil Uygulama
  Koşulları'nın örnek listesi zaten doğruydu. LEGAL-REDLINES §34;
  `legal-docs` "what the app's inbox shows".

PR #189 (UI-13, köşk çipi) güvenlik incelemesinin main'de bulduğu, o PR'ın
değiştirmediği iki madde (21 Eki 2026), 22 Eki 2026'da düzeltildi:

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | P1: Canlı durum elle **Açık**'ken `placeAppOrder` planlı kafe siparişini `SCHEDULE_MAX_DAYS` (7) gün içindeki her saat için kabul ediyordu (`isCafeOpenNow` elle Açık'ta `at`'a bakmaz); maç gecesi için açılan köşk ertesi gün 04:00'e ödenmiş sipariş alabilirdi | `isCafeOpenForOrder` (`src/lib/mobile/venue.ts`): hemen sipariş elle durumla, planlı sipariş o saatte köşkün saatleriyle denetlenir; elle Kapalı planlıyı da durdurur (eskisi gibi). Hata kodu aynı (`cafe_closed`); uygulamanın saat ızgarası zaten saatlerden kurulur. `docs/API-MOBILE.md` §3 | `mobile-hours` |
| 🟢 | P2: her `venue_status` yazması `pub:site`'ı düşürüyordu; çipin her kaydı genel sayfaların bütün önbelleğini boşaltıyordu | Canlı duruma ayrı etiket `live:venue` (`src/lib/cache/tags.ts`); onu okuyan iki önbellek (zilin `panel-busy-inputs`'u, çipin `venue` işareti) onu da dinler, genel sayfalar dinlemez. `docs/DATABASE.md` temizleme komutu yedi etiket | `cache-write-tags`, `venue-status-patch`, `admin-change-marker`, `db-integration-venue-quick-security` |

## 9. Mobil denetim turu - 14 Eki 2026

lafmobil'in uygulama denetimi (`lafmobil/docs/AUDIT-APP-2026-10-14.md`,
karar 312) iki depo arasını da okudu: `src/lib/mobile/**`, `api/mobile/v1/**`
ve `docs/API-MOBILE.md` uygulamanın okuduğu alanlarla karşılaştırıldı.

### Düzeltilenler

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟠 | `POST /fal` günlük sınırı oku-sonra-yaz ile denetleniyordu; kayıt yalnız başarılı yorumdan sonra yazıldığı için aynı üyenin paralel istekleri `FAL_DAILY_LIMIT`'i aşıp her biri ücretli bir model çağrısı yapıyordu | Koltuk modelden önce SQL'de alınır: `reserve_fal_reading` (üye + İstanbul günü üstünde advisory lock, say, sınırın altındaysa ekle). Başarısız yorum koltuğu geri verir. Satırı id sırasıyla sıralamak yetmedi: gerçek Postgres'te altı paralel istekte dördüncüsü yaklaşık yirmi koşuda bir geçti | `mobile-fal-seat`, `db-integration-fal-seat`, `mobile-fal` |
| 🟡 | Yeniden açılan ödeme oturumları (`POST /orders/{id}/payment`, `clientOrderId` tekrarı) POS'a boş alıcı IP'si geçiriyordu (`cardHolderIP: 0.0.0.0`) | `replayAppOrder` isteğin IP'sini (`clientIp()`) taşır | `mobile-order-payment` |
| 🟡 | Kasa kodu alfabesi `L` içeriyordu; sözleşme (§17) ve kodun kendi yorumu "I/1/L yok" diyor | `L` çıktı; harf seçimi modulo sapmasız (reddetmeli örnekleme) | `mobile-counter` |
| 🟡 | `PATCH /me` `birthday` yalnız desenle doğrulanıyordu; `1990-13-45` gibi takvimde olmayan tarih kaydediliyor, doğum günü kuponu hiç tetiklenmiyordu | `isCalendarDate` | `mobile-me-mapper` |
| 🟢 | `docs/API-MOBILE.md` yedi yerde iki uygulamanın yaptığını söylemiyordu: hediye kartı `consentDocs` + `legalConsent` (§19), `invite.people[].rewarded` ve davet kuralları (§4, §5), karaoke çakışma kısıtı (§7), cüzdan/hediye kartı satırı (§12), `POST /fal`'ın 30 sn süresi (§0), kasa kodu alfabesi (§17) | Belge düzeltildi; lafmobil kopyası aynı (RECONCILED hash güncel) | `api-contract-parity`, lafmobil `contract-sync` |
| 🟡 | WS1-01 (15 Eki): `POST /fal` e-posta doğrulamasına bakmıyordu; her Supabase kaydına (onaysız da) bir üye satırı açıldığı için atılabilir adreslerle adres başına günde `FAL_DAILY_LIMIT` ücretli model çağrısı alınabiliyordu (özellik açıldığında) | Doğrulanmamış üyeye **403** `email_unverified`, koltuk ve model çağrısından önce; uygulama her retteki gibi falı cihazda okur (§20, yalnız ekleme) | `mobile-fal` |
| 🟡 | WS1-02 (15 Eki): Var olan siparişin ödeme oturumunu yeniden açmak (`POST /orders/{id}/payment` ve `clientOrderId` tekrarı) sınırsızdı; tek ödenmemiş siparişi olan bir üye döngüyle her istekte ödeme sağlayıcısına çağrı ve bir `payment_transactions` satırı açtırabiliyordu | Üye başına `reserve_auth_attempt` ile atomik bütçe (`checkout-reopen`: 5 dk içinde 8, sonra 10 dk); aşılınca **429** `rate_limited` + `Retry-After` (§3, yalnız ekleme). Yeni siparişin ilk oturumu sayılmaz | `mobile-order-idempotency`, `mobile-checkout-reopen-route` |
| 🟡 | WS1-03 (15 Eki): Uygulamanın promosyon kodu kâhini (`POST /promo/preview`, `/orders/preview` `promoCode`) "kontrol et, bak, ıskayı sonra yaz" sırasıyla sayıyordu; paralel gönderilen bir yığın denetimi hep birlikte geçip **her** tahmine cevap alıyordu, 15/pencere sınırı yalnız bekleyen istemciye işliyordu | Iska, cevaplanmadan **önce** `reserve_auth_attempt` ile atomik sayılır, tavanın ötesindeki iska "sınırlı" döner; gerçek kod sayılmaz (sepetini yeniden fiyatlayan üye kilitlenmez) ama yalnız kova açıkken cevaplanır, yoksa sınırlayıcı hangi tahminin gerçek olduğunu karşıtlıkla söylerdi. Biçim aynı | `mobile-promo-preview-limit` |
| 🟢 | WS1-04 (15 Eki): `POST /fal/report` doğrulanmamış adrese de açıktı ve günlük 10 sınırı kayıttan önce okunuyordu; atılabilir adreslerle ya da paralel yığınla panelin bildirim listesine serbest metin yığılabiliyordu | Doğrulanmamışa **403** `email_unverified` (ona yapay zekâ yorumu zaten verilmez, WS1-01); kayıttan sonra yeniden sayılır, sınırı aşan kendi satırını geri alır ve 429 döner (§20, yalnız ekleme) | `mobile-fal-report` |
| 🟠 | Var olan uygulama siparişinin ödemesini yeniden açmak (`POST /orders/{id}/payment`, `clientOrderId` tekrarı) POS'a sormadan yeni oturum açıyordu; PayNkolay aynı `clientRefCode` ile ikinci satışı kabul ettiği için dönüşü kaybolmuş bir ödeme ikinci kez çekiliyordu. Karaoke yeniden açması POS'a sorulamayınca ve tahsilat tutarı uyuşmayınca da yeni sayfa açıyordu (17 Eki 2026) | `replayAppOrder` bütçeden sonra, oturumdan önce `checkPendingOrderPaid` sorar: ödenmişse işlenir ve oturum açılmaz (409 `not_payable`), sorulamazsa ya da tutar farklıysa **503** `payment_unavailable` (§3, yalnız ekleme). `reopenKaraokePayment` aynı iki durumda `payment_unknown` (503, §7.1); süpürme ve iptal tutar farkını eskisi gibi ele alır. `docs/PAYNKOLAY.md` §14.7 | `mobile-order-idempotency`, `mobile-checkout-reopen-route`, `mobile-order-payment`, `karaoke-reopen-pos-gate`, `mobile-karaoke-prepay-routes` |

### Açık

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟡 | `/odeme/donus` POST dalı, `applyPaymentSucceeded` siparişi ilerletmemişken de uygulamaya `?status=success` veriyor | Bilerek bırakıldı: dönüş POS'un sonucunu söyler; "başarısız" demek parası çekilmiş üyeyi ikinci ödemeye iter. Uygulamanın sipariş ekranı sunucunun durumunu okur |
| 🟢 | `POST /orders/preview` kapalı mağazayı da fiyatlıyor; yalnız `POST /orders` 409 `shop_closed` veriyor | Ayrı PR: önizlemeye yeni bir ret eklemek sahadaki sürümlerin okuduğu bir davranış değişikliği |
| 🟢 | Sipariş adresi, kayıtlı adres ve `PATCH /me` telefonları yalnız uzunlukla doğrulanıyor; `normalizeTrPhone` kullanılmıyor | Ayrı PR: doğrulamayı sıkılaştırmak eski sürümlerin gönderdiğini reddedebilir, önce ölçülmeli |
| 🟢 | Davet ödülünün 150 TL alt sınırı kurye ücretini de içeren `totalMinor` ile ölçülüyor | Operatör kararı: alt sınır kurye ücretini sayar mı |
| 🟢 | Hangi kafe kategorilerinin özelleştirilemeyeceği yalnız uygulamada (`NON_CUSTOMIZABLE`); sunucu her satıra süt/şurup/shot ek ücretini uygular | Ayrı PR: uygulama bu kategorilerde özelleştirme göndermez, sunucu tarafı sertleştirme |
| 🟡 | Her ödenmiş uygulama kafe siparişi tutarına bakılmadan +1 damga kazanıyordu: tek başına 25₺'lik "Alternatif Süt" 6 kez sipariş edilip 280₺'lik ücretsiz içecek kuponu alınabiliyordu (WS1-05) | Operatör kararı (15 Eki 2026, "minimum sipariş tutarı 140 TL"): damga yalnız ürün tutarı en az 140₺ olan siparişe (`STAMP_MIN_ORDER_MINOR`, indirim düşülmüş, kurye hariç); `stampsToEarn` aynı kuralı söyler, değer `bootstrap.app.loyalty.stampMinOrderMinor` ile uygulamaya gider - `tests/mobile-loyalty.test.ts` |
| 🟢 | 140₺ alt sınırından sonra her sipariş tutarı ne olursa olsun tek damga kazanıyordu (1.000₺'lik sipariş = 140₺'lik sipariş) | Operatör kararı (15 Eki 2026, "140 TL'den 320 TL'ye kadar 1 tane sayılsın, damga toplam miktar ile hesaplansın"): başlayan her 320₺ bir damga (`STAMP_STEP_MINOR`, `stampsFor`); sipariş başına tek `earn` satırı, `delta` = damga sayısı; iade/iptal tamamını geri alır; `stampsToEarn`, `stampsEarned` ve `bootstrap.app.loyalty.stampStepMinor` aynı kuralı söyler - `tests/mobile-loyalty.test.ts`, `tests/mobile-loyalty-multi-stamp.test.ts`, `tests/mobile-order-preview-stamps.test.ts` |
| 🟡 | Kısmi iade damgaları geri almıyordu: yalnız tam iade/iptal ters kayıt yazıyordu ve tek bir `reversal` satırı siparişi tümden düşürüyordu; 1.000₺'lik sipariş (4 damga) 999₺ iade edilse de 4 damgayı tutuyordu | 16 Eki 2026 incelemesi: her iadeden sonra (panel, sağlayıcı webhook'u, iptal) hedef `stampsFor(ürün − iade edilen ürün)` yeniden hesaplanır (iade kaydı kurye payını ayırmadığı için iade önce ürüne yazılır, `min(iade, ürün)`); hedefin üstündeki her damga için siparişten ve damga sırasından türeyen kimlikle bir `reversal` satırı (−1) yazılır, yeniden deneme ve eşzamanlı iadeler birincil anahtarda birleşir; bakiye ve `stampsByOrder` ters kayıtları sipariş başına toplar |
| 🟡 | Ters kayıt, damgaları zaten harcanmış ödülleri bırakıyordu: kart dolup ücretsiz içecek kuponu alındıktan ya da kilometre taşı hediyesi verildikten sonra iptal edilen sipariş kuponu aktif bırakıyor, `available` 0'da kırpıldığı için borç görünmüyordu | 16 Eki 2026 incelemesi (c): `settleLoyaltyDebt` artık karşılanmayan her kart için en yeni KULLANILMAMIŞ sadakat kuponunu pasife alır ve `unredeem` satırı yazar; yeni ömür boyu sayının üstündeki kullanılmamış kilometre taşı hediyesi geri alınır, talep satırı silinir, taş dürüstçe yeniden kazanılabilir. Kullanılmış kupon kullanılmış kalır, borç sonraki damgalardan ödenir. Başka kaynaktan kuponlara dokunulmaz |
| 🟡 | Ödül geri alma fazla ve eksik çalışıyordu: operatör kart boyunu büyütünce (6 → 8) borç `hedef × kart − ömür boyu` ile hesaplandığı için hiçbir damga geri alınmadan, sonraki herhangi bir iade ya da iptal dürüstçe kazanılmış ücretsiz içecek kuponunu pasife alıyordu; öte yandan ödenmemiş bir siparişte tutulan kupon kullanılmış sayılıyordu ve sipariş iptal edilip kupon geri verildiğinde kimse yeniden hesaplamıyordu, iade edilen siparişin kuponu harcanabilir kalıyordu | 16 Eki 2026 ikinci inceleme: `reversalDebt` borcu hem güncel kart boyuyla hem her kartın kendi `redeem` maliyetiyle hesaplar, küçüğünü alır ve sipariş ters kayıtlarının geri aldığı damgadan (önceki `unredeem` maliyetleri düşülerek) fazlasına izin vermez; ters kayıt yoksa borç yoktur. `unredeem` satırı kartın kendi maliyetini taşır. `releaseOrderInventory` kişisel kupon geri verildiğinde `settleLoyaltyDebt` çağırır, böylece serbest kalan ücretsiz içecek ya da kilometre taşı hediyesi o an geri alınır |
| 🟡 | Ödül geri alma "ters kayıt bütçesi"yle çalışıyordu ve dört yerden kırıldı: borç 1 damga iken bütün bir kart (6) geri alınıp bütçe eksiye düşüyor, sonraki gerçek borç hiçbir şey geri almıyordu; kart 4'e küçültülüp 6'ya geri alınınca hiç damga geri almayan 1₺'lik iade dürüst kuponu pasife alıyordu; kart bozdurma ile iptal yarışınca bakiye kupon eklenmeden önce kontrol edildiği için karşılıksız kullanılmamış kupon kalıyordu; yalnız kurye ücreti iadesi damga alıyordu | 16 Eki 2026 üçüncü inceleme: bütçe kaldırıldı, tek değişmez `stampCoverage` = ömür boyu damga − ayakta duran kartların kendi `redeem` maliyeti. Damga geri alındığında, tutulan kupon geri verildiğinde ve kart bozdurulduğunda `nextFreeDrinkWithdrawal` en yeni kullanılmamış kuponu ve kendi kartını (kupon kimliği `freeDrinkCouponId(redeem)`) seçer, kart `unredeemId` ile tek seferde geri alınır. `redeemStamps` satırdan sonra ve kupondan sonra yeniden kontrol eder; `available` küçülen kartta da kart maliyetini aşmaz. İade önce kurye ücretinden düşülür. Testler: `tests/mobile-loyalty-coverage.test.ts` (dört tekrar, duraklatılmış sorguyla yarış, 3000 vakalık özellik testi) |
| 🟡 | Ödül geri alma iki yazıdan oluşuyordu (kartın `unredeem` satırı, sonra kuponun pasifleştirilmesi) ve araya giren bir hata ya da yarış kuponu kartsız bırakıyordu: ikinci yazı düşerse kart iade edilmiş görünüyor, kupon harcanabilir kalıyor ve hiçbir tetikleyici bunu toparlamıyordu (aynı 6 damga ikinci bir ücretsiz içecek alıyordu); kupon o sırada harcandıysa ve talep satırı silinemediyse harcanmış kupon iade edilmiş kartta kalıyordu; ödül öncesi kuponlar kartlara tarihle eşleştiğinden, `unredeem` satırı olan kartlar eşleştirmeden çıkarıldığı için iki eşzamanlı ayar aynı kuponu farklı kartlara bağlayıp birini sonsuza dek açıkta bırakıyordu; kasa "−1 düzeltmesi" hiç ayar çalıştırmıyordu (iki tıklama kapsanmamış ücretsiz içecek, kilometre taşı hediyesi geri alınmıyordu); `redeemStamps` kupon eklemesi işlenip yanıtı kaybolunca kart satırını silip kuponu aktif bırakıyordu | 16 Eki 2026 dördüncü inceleme: `nextFreeDrinkWithdrawal` yarım kalmış geri almayı (kartta `unredeem` var, kupon hâlâ aktif ve kullanılmamış) karşılama ne olursa olsun tamamlar; kartı olmayan (`redeem` satırı silinmiş) `cpn-stamp-` kuponu da alınır; kullanılmış kuponun kartındaki eski talep `staleFreeDrinkClaims` ile silinir. Her `settleLoyaltyDebt` bunları yapar, yani sıradaki iptal tekrarı, iade webhook'u, bozdurma, kupon geri verme ya da kasa düzeltmesi yeter. Eşleştirme TÜM kuponlar ve TÜM kartlar üzerinden, `unredeem` satırlarına bakmadan yapılır; geri alma başarısız olursa talep yalnız kupon gerçekten harcandıysa (`redeemedAt`) silinir. Kasa −1 yazıdan sonra karşılamayı yeniden okur (iki tıklama birlikte ücretsiz içeceği yutacaksa satırını geri çeker), sonra `settleLoyaltyDebt` çalıştırır (hatası düzeltmeyi bozmaz). `redeemStamps` hata yolunda kuponu kimliğiyle pasifleştirir, sonra kart satırını siler; kart satırının eklemesi yanıtsız kalırsa onu da siler. Testler: `tests/mobile-loyalty-coverage.test.ts` ("review 4" blokları; özellik testi artık vakaların ~%30'unda rastgele bir yazıyı, işlendikten önce ya da sonra, düşürür ve sıradaki tetikleyiciden sonra değişmezi denetler), `tests/mobile-loyalty-partial-core.test.ts` |
| 🟡 | Üçüncü bağımsız inceleme (16 Eki 2026) arıza ve eşzamanlılık pencerelerinde yedi düşük dereceli kusur buldu, arızasız çalışmada hiçbiri yok: kasa −1'de satır yazıldıktan sonraki karşılama okuması hata verirse operatör hata görüyor, damga gitmiş oluyor, tekrar tıklama ikinci damgayı alıyordu; `redeemStamps` kaybedilen yarışın `redeem` satırını silemezse kuponsuz kart kalıyor ve sonraki her ayar gerçek ücretsiz içeceği onun için geri alıyordu; kupon ekleme hatasında önce kupon pasifleştirilip sonra satır siliniyordu (ikinci yazı düşerse harcanabilir yetim kupon, ilk yazı düşerse ölü kupon için yanmış damgalar); iptal edilen bir `redeem` satırının `unredeem` talebi satırdan uzun yaşayıp üyeye bedavaya kart kredisi veriyordu; eski talebi silen ayar, kuponu bu arada başka bir ayar geri almışsa talebi silip tek borca iki ücretsiz içecek yazdırıyordu; kasa −1'e çift tıklama iki satırı birlikte görünür bırakıyor, o anda çalışan bir ayar ücretsiz içeceği alıyordu | 16 Eki 2026 üçüncü inceleme düzeltmeleri: (1) kasa satırının kimliği `tillCorrectionId` ile ana defterin parmak izinden türer, aynı defteri okuyan iki tıklama aynı kimliği yazar ve birincil anahtar birini alır, kaybeden defteri yeniden okur: kasa düzeltmeleri hiç üst üste binmez. Karşılama okuması düşerse satır geri çekilir ve hata gösterilir; geri çekme de düşerse satır kalır ve tıklama başarılı döner (hata gösterip yeniden tıklatmak ikinci damgayı alırdı). Cevabı kaybolan ekleme hatadan önce geri alınır. **Bilinen pencere (belgelenmiş):** kasa düzeltmesi FARKLI bir yazarla (bozdurma, sipariş iadesi) yarışırsa satır geri çekilene kadar geçen milisaniyelerde o anda çalışan bir ayar aşımı görüp bir ücretsiz içeceği alabilir; kapatmak işlem ya da veritabanı fonksiyonu ister, havuz tek ifadeli olduğundan yapılmadı. (2) Telafi yazıları `attempt` ile üç kez denenir, hiç hata fırlatmaz. `redeemStamps` kaybettiği yarışta satırını silemezse kuponsuz kart kalır; ayar `abandonedCards` ile 2 dakikalık süre (`REDEEM_ROW_GRACE_MS`) geçince onu siler (uçuştaki bir bozdurma süreden gençtir, dokunulmaz; kupon ekleme duraklatılmış sorguyla denendi) ve süre dolmadan da hiçbir ayar kuponsuz kart için gerçek kuponu geri almaz (`couponlessCards` ayarın baktığı defterden çıkarılır). Reddedilen bozdurma dokunuşu kendisi de tetikleyicidir. (3) Hata yolunda sıra: önce `redeem` satırı silinir, sonra talebi, sonra kupon pasifleştirilir; satır silinemezse ikisi de olduğu gibi kalır (kupon kartı ayaktayken asla geri alınmaz), kupon pasifleştirilemezse yetim kural güvenlik ağıdır. (4) Ayar, `redeem` satırı olmayan `unredeem` talebini (`orphanClaimIds`) siler; bozdurma geri alması talebi de siler. (5) Her kupon geri alımından ve her eski talep silişinden sonra talep yeniden denetlenir (`restoreClaim`): kupon pasif, kullanılmamış ve kartı ayakta ama talep yoksa talep geri yazılır; iki taraftan biri her zaman son bakandır. **Politika (değiştirilmedi, kasıtlı):** yetim ve yarım kalmış geri almalar karşılama ne olursa olsun yapılır; elle silinen `redeem` satırı kuponu geri aldırır (iade yok). **Yönetici "Sil" düğmesi (dördüncü inceleme):** `revokeCustomerCoupon` bir ödül (`loyalty`) ya da kilometre taşı (`milestone`) kuponunu artık SİLMEZ; kullanılmamışsa pasifleştirir (kartı kuponunu korur, damga dönmez), kullanılmış ya da zaten pasif olana dokunmaz (iade edilen ya da kullanılan kupon için ikinci bir ücretsiz içecek çıkmaz); panelde bunlar için düğme "Pasifleştir" olur, kullanılmış/pasif olanda hiç görünmez. Diğer kuponlar eskisi gibi silinir. Kuponu panel dışından (veritabanı düzenlemesiyle) silmek hâlâ kartı kuponsuz bırakır ve süre sonunda damgaları geri verir (elle silinen `redeem` satırının kuponu geri aldırmasının aynası). **Tek seferlik geçiş etkisi (belgelenmiş, korunmadı):** bu PR'dan önceki sürümde yazılmış, kapsanmamış bir `reversal` borcu olan eski bir defter (karşılama −1) ilk tetikleyicide kullanılmamış bir eski `cpn-NNNN` kuponunu geri alır. Eski kuponu "yalnız PR öncesi iadelerden dolayı" ayırmanın güvenli bir yolu yok: `reversal` satırı hangi sürümün yazdığını taşımaz, tarih eşiği ise dağıtım gününü bilmeden tahmindir ve PR sonrası gerçek iadelerde eski kuponu korurdu (`tests/mobile-loyalty-coverage.test.ts` eski kuponların geri alındığını sınar). Etki üyenin gerçek borcunun ödenmesidir (bir damga eksi bir ücretsiz içecek, damgalar karttan döner); dağıtımdan önce `stampCoverage < 0` olan üyeler `select` ile sayılıp gerekirse kuponları elle korunabilir.  Testler: `tests/mobile-loyalty-coverage.test.ts` ("review 5" blokları, 3000 vakalık özellik testi artık bir ile dört ardışık yazıyı (kesinti) de düşürür ve üç değişmezi daha denetler: kartın kuponu, talebin kartı, geri alınmış kuponun talebi; arıza çıkan adımlar süre sonrası iyileştirme adımından sonra da atlanmaz), `tests/mobile-loyalty-partial-core.test.ts` |
| 🟡 | Uygulamanın `GET /coupons` yanıtı geri alınmış (pasif) kuponu kullanılmamış ve süresi dolmamış gösteriyordu, ödeme adımı ise 'Bu kupon kapalı.' diyerek reddediyordu | `GET /coupons` artık `isActive: false` kuponları listeye koymaz (yönetici iptali gibi listeden düşer). Yanıt şekli değişmedi; docs/API-MOBILE.md §5 notu uygulama deposuyla birlikte güncellenmeli |

## 10. Hız turu (WP1) - 15 Eki 2026

Operatör: _"kötü niyetli kişilere karşı güvenlik önlemi al, güvenli ve hızlı
yap"_. Bu bölüm hız kolunun bulgularıdır: uygulamanın her açılışta okuduğu
mobil uçlar, sitenin genel sayfaları ve admin listeleri. Sayılar yerel
Postgres 16'da (`EXPLAIN ANALYZE`) ve `next build` çıktısında ölçüldü.

### Düzeltilenler

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟠 | Üye e-postasıyla tam eşleşen okumalar (`"col" = $1`) tablonun `lower(col)` indeksini kullanamıyordu: her bearer isteğindeki `customers` okuması, `/me` · `/orders` · `/notifications`'taki damga defteri, kuponlar, kasa kodları ve davetler tam tablo taraması yapıyordu (20 bin üye / 200 bin damgada üye başına 1,9 ms ve 20 ms) | Düz kolon indeksleri (`20261015060020_exact_email_indexes.sql`); sonuçlar aynı kalır. 0,12 ms ve 0,16 ms | `db-exact-email-indexes` |
| 🟠 | /karaoke tarayıcıya Zod'un tamamını gönderiyordu: rezervasyon formu iki fiyat hesabını `karaoke-core.ts`'ten alıyordu, o modül yüklenirken Zod şeması kuruyor. İlk yükleme JS'i 892 KB (244 KB gzip), diğer vitrin sayfaları ~590 KB | Fiyat hesabı bağımlılıksız `karaoke-quote.ts`'e taşındı, form yalnız onu ve `karaoke-core`'dan tipi alır. /karaoke 504 KB (153 KB gzip) | `client-bundle-weight` |
| 🟠 | Admin ekranları sipariş tablosunun tamamını her sütunuyla okuyordu (`listOrders()`): pano 5 satır için, sipariş listesi hepsini istemci bileşenine basarak, müşteriler ve raporlar birkaç sütun için (raporlar sayfa başına üç kez). 20 bin siparişte çağrı başına 596 ms ve 27 MB JSON | `listOrders` kaldırıldı. Pano `listRecentOrders(5)` (1 ms); liste 100'lük anahtar sayfaları (`?once=`, 3 ms, 0,14 MB; eski sayfalarda yeni sipariş yoklaması yok; 17 Eki 2026'dan beri süzgeçli, numaralı 50'lik sayfalar, §12); müşteriler 6 sütun (67 ms); raporlar sütun izdüşümü, yalnız en çok satanlar `items` okur (~1,8 sn → ~0,28 sn) | `admin-order-reads` |
| 🟡 | `GET /me` ayarlar satırını aynı istekte iki kez okuyordu (`buildMe` ve `getLoyalty`); havuz tek bağlantılı olduğu için her tur sırayla bekler | Ayarlar bir kez okunur, sadakat bloğuna verilir: `/me` 7 → 6 sorgu (kimlik okuması hariç). İstekler arası önbellek yok | `mobile-me-round-trips` |
| 🟠 | Üyenin karaoke rezervasyonları `ILIKE` ile aranıyordu; `lower("customerEmail")` indeksi ILIKE'ta seçilemez. Her `GET /notifications` ve rezervasyon listesi tabloyu tarıyordu (50 bin kayıtta 66 ms ve 47 ms) | `ieq` (`lower(col) = lower($1)`), tam eşleşme süzgeci aynen duruyor: 0,07 ms | `mobile-karaoke-reads` |
| 🟡 | Aynı istekte aynı sunum verisi birden çok kez okunuyordu: `getPublicSettings` (meta veri, sayfa gövdesi, yerleşim ve `not-found` sınırı), ürün sayfasında `getShopProductBySlug`, hukuk sayfasında `getPublishedLegalOverride` (meta + gövde) | `React.cache` ile istek başına tek okuma (Next 16 belgesinin veritabanı için önerdiği yol); istekler arası paylaşım yok, `getSettings` (ticari) önbelleksiz. Ölçülen sorgu sayısı: `/` 9 → 7, `/odeme` 3 → 1, ürün 5 → 3, hukuk 4 → 2 | `request-memo-loaders` |

## 11. Site güvenlik turu - 15 Eki 2026

Operatörün isteği (15 Eki 2026): _"kötü niyetli insanlara karşı güvenlik
önlemleri al"_. Bu bölüm sitenin `/api/mobile/v1` ve `src/lib/mobile`
dışındaki yüzünü kapsar: güvenlik başlıkları, admin girişi ve rolleri,
müşteri hesabı, e-posta gönderen açık formlar, sırlar ve bağımlılıklar.

### Düzeltilenler

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟠 | `npm audit --omit=dev`: `next@16.3.6` altı danışma taşıyordu (Image Optimization SSRF, SSG/ISR önbellek zehirlenmesi, metadata görsel rotalarında bilgi sızıntısı); `sharp@0.35.4` librsvg açığı taşıyordu ve panelin yüklediği her fotoğrafı (`backdrop/from-image.ts`) içeriğe bakarak çözüyor - bildirilen tür ne olursa olsun | `next@16.3.8`, `sharp@0.35.5` (yalnız yama sürümü). Kalan tek bulgu `source-map-js` (yalnız derleme anında, saldırgan girdisi görmüyor) | tüm paket + `next build` |
| 🟡 | Giriş, 2FA, parola sıfırlama, bülten ve kasa okutma bütçeleri IP'nin tamamıyla anahtarlanıyordu. Bir VPS ya da ev hattı bütün bir IPv6 /64 alır: son dört grubu değiştiren saldırgan her istekte yeni bir bütçe açıyordu. 2FA'yı kapatma adımı da yalnız adres başına sayıyordu | Anahtar IPv6'da /64'e indirilir (`rateLimitAddress`), IPv4-mapped adres IPv4 okunur; rıza kanıtı olarak saklanan IP değişmez. `disable2FAAction` girişteki hesap bütçesini (`admin-2fa-account`) de sayar | `rate-limit-keys`, `admin-2fa-enrollment` |
| 🟡 | E-posta gönderen açık formların yalnız hedef adres başına bütçesi vardı: bülten, kayıt, parola sıfırlama ve doğrulama yeniden gönderimi bir yabancılar listesine alan adımızdan, Resend'in (sipariş ve sıfırlama postasıyla paylaşılan) günlük kotasını tüketerek posta attırabiliyordu. Kayıt hiç sınırlı değildi (reddi "bu adres kayıtlı" der); doğrulama yeniden gönderimi sınırsızdı; sıfırlama kontrol-sonra-kaydet olduğu için paralel istekler sınırı aşıyordu ve IP + adres anahtarı kaynak değiştirerek aynı kutuyu doldurmaya izin veriyordu | Gönderen başına bütçe (`newsletter-signup-ip` 5/saat, `register-ip` ve `password-reset-ip` 10/30 dk), sıfırlama adres başına (IP'den bağımsız, 3/30 dk), yeniden gönderim hesap başına (3/15 dk); hepsi `reserveLoginAttempt` ile, bir şey aranmadan ya da gönderilmeden önce sayılır | `mail-form-budgets`, `newsletter-double-opt-in`, `rate-limit-keys` |
| 🟡 | Ödeme sayfasındaki promosyon önizlemesi (kimliksiz, "geçersiz kod" ya da gerçek indirim söyler) sınırı önce sorup yalnız ıskadan sonra yazıyordu: paralel gönderilen bir yığın, ilk ıskalama yazılmadan hepsi geçiyor, sınır bir betik için hiçbir şeyi tutmuyordu | `reserveLoginAttempt`: deneme aramadan önce sayılır; geçerli kod sayacı sıfırlamaz (bilinen bir kampanya kodu tahminlerin arasında sayacı temizleyemesin) | `promo-preview-budget` |
| 🟢 | `vercel.json` kenarda `next.config.ts`'ten farklı güvenlik başlıkları basıyordu (X-Frame-Options SAMEORIGIN / DENY, bir yıllık ve alt alan adı içermeyen HSTS, `payment=()` olmayan Permissions-Policy): bir yanıt aynı başlığın birbirini tutmayan iki kopyasını taşıyabiliyordu. Referrer-Policy `origin-when-cross-origin`'di; her yanıt `X-Powered-By: Next.js` diyordu | İki kaynak aynı değerleri basar, test anahtar anahtar karşılaştırır; `strict-origin-when-cross-origin`; `poweredByHeader: false`. CSP değişmedi; `next build` + `next start` ile 13 sayfa Chromium'da açıldı, CSP ihlali yok (tek kayıt `/karaoke`'de zod'un `new Function` yoklaması - yakalanıyor, zod JIT'siz devam ediyor) | `security-headers` |
| 🟢 | Şifre değiştirme ve hesap silme formları mevcut şifreyi sınırsız denetliyordu: oturum çerezini ele geçiren (ortak bilgisayar) şifreyi tahmin edip üyenin başka yerde de kullanabileceği parolayı öğrenebiliyordu; uygulama üyesinde her tahmin sunucularımızdan bir Supabase girişi | İkisi de giriş formunun bütçesini (`customer-login`) kullanır; doğru şifre sayacı temizler | `mail-form-budgets`, `site-account-deletion` |
| 🟡 | Parola sıfırlama bağlantısı belirteci sorgu dizesinde taşıyordu (`/uye/sifre-sifirla?token=…`) ve sayfa GTM yüklüyor: GA4'ün `page_location`'ı ve her pikselin `dl`'si adresi sorgu dizesiyle üçüncü tarafa bildirir; belirteç bir saat boyunca hesabı açar | `proxy.ts` belirteci yalnız bu yola, httpOnly ve belirtecin ömrü kadar bir çereze taşır ve sayfayı sorgu dizesi olmadan yeniden açar (303); sayfa çerezi okur, başarılı sıfırlama çerezi siler. E-postadaki bağlantı değişmedi. Chromium'da son adres ve `location.href` belirteçsiz | `reset-link-token`, `reset-action-links-identity` |
| 🟡 | Admin ve üye girişinin bütçesi yalnız adres + hesap başınaydı: tek bir adres sızdırılmış bir e-posta/parola listesini hesap hesap deneyebiliyor (credential stuffing) ya da tek parolayı bütün panel hesaplarına püskürtebiliyordu, hiç sınıra takılmadan; her reddedilen admin denemesi de bir `login_fail` denetim satırı yazıyordu | Önce adres başına, bütün hesaplar boyunca bütçe (`admin-login-ip` 20, `customer-login-ip` 30 / 5 dk, sonra 15 dk); başarı da sayılır (kendi hesabına girerek sayacı sıfırlamak olmasın) | `login-address-budget`, `rate-limit-keys` |
| 🟢 | 610 KB'lık `public/laffogato-pour.js` `max-age=0` ile servis ediliyor, her ana sayfa ziyaretinde yeniden doğrulanıyordu | Bir saat + bir gün arka planda yenileme. Günlük görsel kuralı değil: dosya aynı adla yerinde yeniden derleniyor (be2e506), uzun önbellek ziyaretçiyi eski derlemeye bağlardı. Yalnız `next.config.ts`'te; `vercel.json` ayrı bir değer basmaz | `security-headers` |
| 🟠 | Kart sayfası (`/odeme/paynkolay` POST) imzalı formun ikinci gönderiminde (iki sekme, bankanın sayfasından geri tuşu) ödenmiş siparişe ya da karaoke rezervasyonuna ikinci satış başlatıyordu; PayNkolay ikinciyi de kabul ediyor (17 Eki 2026) | Satıştan hemen önce kayıt imzalı referansla okunur (`src/lib/payment/bridge-gate.ts`, yalnız referans alır): ödeme beklemiyorsa ya da okunamıyorsa satış başlamaz, not sayfası siparişe ya da rezervasyona bağlanır. `docs/PAYNKOLAY.md` §14.7 | `paynkolay-card-page`, `saved-cards` |
| 🟢 | `/bulten/onay?token=` ve `/bulten/cikis?token=` (ikincisine `/api/bulten/cikis` da yönlendirir) GTM yükleyen sayfalarda belirteci adreste taşıyordu (sızan belirteçle başkası aboneliği onaylayabilir ya da bitirebilirdi) | Sıfırlama belirtecinin deseni (22 Eki 2026): `proxy.ts` belirteci yalnız o sayfaya, httpOnly ve bir saatlik bir çereze taşır, sayfayı belirteçsiz yeniden açar (303, yalnız GET/HEAD); sayfa çerezi okur, düğme çerezi siler (`src/lib/newsletter/link-token.ts`). E-postadaki bağlantılar ve posta istemcisinin tek tık POST'u (`/api/bulten/cikis`) değişmedi | `newsletter-link-token` |

### Açık

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟡 | Admin girişinde hesap başına (adresten bağımsız) tavan yok: çok sayıda adresi olan biri (botnet, konut proxy'si) bir hesaba adres başına 5 / dk deneme yapabilir | Operatör kararı: hesap tavanı, adını bilen herkese o hesabı (kasiyer dahil) kilitletir. Önerilen: sahip ve yönetici hesaplarında 2FA'yı açmak (`/admin/2fa-kurulum`); 2FA adımının hesap tavanı zaten var |
| 🟢 | Admin çıkışı yalnız bu tarayıcının çerezini siler; daha önce kopyalanmış bir çerez 7 gün geçerli kalır (parola değişince düşer) | Sunucu tarafı iptal bir migration (oturum kimliği ya da hesap başına dönem) ister; ayrı PR |
| 🟢 | `script-src` hâlâ `'unsafe-inline'` taşıyor | Kayıtlı karar (`next.config.ts`): nonce kök layout'u ve statik sayfaları dinamik yapar |
| 🟢 | ~~`CUSTOMER_SESSION_SECRET` tanımsızsa müşteri çerezi `ADMIN_SESSION_SECRET` ile imzalanır. Çapraz kullanım 21 Eki 2026'da kapandı (panel çerezi artık kendi türetilmiş anahtarıyla imzalanıyor, aşağıda "Panel: güvenlik ve CRUD turu"); iki sırrın ayrılması yine de önerilir~~ | **Kapandı (23 Eki 2026):** Vercel'de Production ve Preview'da 26 Mayıs 2026'dan beri tanımlı (Sensitive); iki sır zaten ayrı. Değiştirilmedi, üyelerin yeniden girişi tetiklenmedi |
| 🟢 | `npm audit`: `source-map-js` (yüksek, yalnız derleme anında, saldırgan girdisi görmüyor) | Ulaşılamaz; `next`'in kendi bağımlılığıyla güncellenir |
| 🟡 | Kart sayfasının satış öncesi bakışı POS'a sormaz, yalnız kaydı okur: ilk ödemenin dönüşü kaybolmuşsa sipariş hâlâ `pending_payment` görünür ve ikinci sekmedeki eski form yine satış başlatabilir. `hosted` modda (geri dönüş yolu) son bakış hiç yok | Her kart gönderiminde bir `PaymentList` çağrısı (5 sn'ye kadar gecikme, bütçe) ister; yeni sayfa dağıtan yeniden açma kapıları ve web ödemesinin yeniden kullanımı POS'a soruyor. Ayrı karar (`docs/PAYNKOLAY.md` §14.7) |

## 12. Admin sipariş yönetimi - 17 Eki 2026

Operatör: _"website admin panelinde sipariş iptal etme vs. gibi yapıları da
filament gibi ve çalışabilir yap"_. Sipariş listesi ve sipariş sayfası
paylaşılan admin kitine (`src/components/admin/ui`) taşındı: durum sekmeleri
sayılarıyla, süzgeç satırı, sıralanan sütunlar, numaralı sayfalar, satır
"⋯" menüsü, telefonda kartlar, toplu işlem modalı; sipariş sayfasında
bölümler, tek "sıradaki adım" düğmesi, işlem modalları ve toast. Her işlemin
kuralı tek saf fonksiyonda (`orderActions`, `src/lib/admin/order-actions.ts`):
menü onunla çizilir, sunucu işlemleri (`src/lib/admin/order-ops.ts`) aynı
fonksiyonu okudukları siparişle yeniden sorar. Yetkisiz işlem gizlenmez,
nedeniyle pasif çizilir. Migration
`20261017100000_admin_order_management.sql`.

### Düzeltilenler

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🔴 | İptalde stok iadesi önce `stockReleasedAt`'i işaretleyip sonra RPC'yi çağırıyordu: RPC düşerse sipariş iptal, işaret dolu, stok hiçbir zaman geri dönmüyordu (damga ve e-posta da). Tek başına "İptal" işaretlenen kalem iptalde atlanıyor, stoğu kayboluyordu | `release_order_inventory`: işaret ve stok tek SQL fonksiyonunda; her kalem geri vermediğini (`qty - restockedQty`) verir. Düşerse işaret boş kalır, sipariş sayfasında "Stoğu geri al". Kargo yoldaysa stok kararı zorunlu | `db-integration-admin-orders`, `admin-order-actions` |
| 🔴 | İade parası gittikten sonra `logAudit` atabiliyordu: operatör hata sayfası görüp yeniden deniyor, ikinci iade "kalan" olduğu için geçiyordu. Aynı modal iki kez gönderilebiliyordu | `safeAudit` (para hareketinden sonra asla atmaz); modal başına tek kullanımlık belirteç `reserve_order_refund_once`'ta, aynı belirteçli ikinci kayıt reddedilir | `admin-safe-audit`, `db-integration-admin-orders` |
| 🟠 | İade tavanı sipariş tutarıydı: POS ₺1 aldığında ₺500 iade istenebiliyordu | Tavan tahsil edilen tutar (başarılı ödeme satırlarının toplamı) | `admin-refund-guards`, `db-integration-admin-orders` |
| 🟠 | İade onayı her siparişte "sanal POS üzerinden" diyordu (cüzdan ve kasada ödenen siparişte de) | Hedef sunucuda belirlenir ve modalda yazar: Kart / Cüzdan / "Kayıt: para hareket etmez"; gösterilen hedef değiştiyse iade yapılmaz | `admin-order-actions`, `admin-refund-guards` |
| 🟠 | "Ödendi olarak işaretle" ödeme satırı yazmıyordu: 3-D Secure'da kalan kart ödemesi sonra gelince "zararsız tekrar" sayılıyordu | Önce POS'a sorulur (ulaşılamazsa işaretlenmez); `manual:<yöntem>` satırı yazılır, geç gelen kart ödemesi `duplicate_payment` olur; iadeler elle satırları atlar | `db-integration-admin-orders`, `admin-order-actions` |
| 🟠 | Eşleşmeyen ödemeler (yanlış tutar, iptal edilmiş siparişe ödeme, ikinci çekim) yalnız denetim satırındaydı | `orders.attention`: listede "Dikkat" süzgeci ve rozeti, sipariş sayfasında kırmızı bant; parası alınmış ama iade edilmemiş iptal `refund_due`, POS'un yanıt vermediği iade `refund_unknown` | `db-integration-admin-orders`, `admin-order-filters` |
| 🟠 | Personel ödenmiş siparişte "İptal et"i görüyor, tıklayınca reddediliyordu; toplu iptal personelin ödenmemiş siparişlerini de reddediyordu | Yetki sipariş başına: ödenmiş siparişin iptali iade yetkisi ister (tek tek ve toplu), ödenmemiş olanınki istemez; düğme nedeniyle pasif | `admin-refund-guards`, `admin-order-actions` |
| 🟠 | Admin iptali bekleyen kart siparişini POS'a sormuyordu | Önce `PaymentList`; ödeme görünürse iptal edilmez, POS'a ulaşılamazsa da (kural 29) | `admin-order-actions` |
| 🟠 | Ödenmemiş siparişte "Hazırlamaya başla" sessizce ödendi sayıyordu (paidAt, damga, e-posta) | Store'da reddedilir; açık "ödeme alındı" bayrağıyla "Ödendi olarak işaretle" + hazırla olarak çalışır | `admin-order-guards`, `admin-order-actions` |
| 🟡 | Manuel "Ödeme bekleniyor" siparişi 45 dakikalık süpürmede iptal ediliyordu | `orders.source = 'manual'`; süpürme ve web siparişi bırakma onu atlar (eski satırlar denetim kaydından doldurulur) | `admin-order-guards`, `db-integration-admin-orders` |
| 🟡 | Kargo formu her durumda açıktı; "Kargoya ver" numara istemiyordu | Kargoya ver = firma + zorunlu numara + durum, tek adım, e-posta sonucunu söyler; düzeltme yalnız yola çıkmış pakette | `admin-order-actions` |
| 🟡 | Kalem durumu sonucu kontrol edilmiyordu, iptal ve iade edilmiş siparişte değişiyordu; satır JS'te yeniden yazılıyordu | `set_order_item_status` yerinde yazar, canlı siparişte; seçim kaydedilmeyince eski değere döner | `admin-order-actions`, `db-integration-admin-orders` |
| 🟡 | Fişte indirim satırı yoktu; sipariş sayfasında kafe ayrıntısı (boy, süt, shot) görünmüyordu | İkisi de eklendi | `admin-order-detail` |
| 🟡 | Toplu işlem onaysızdı, boş seçimde Zod'un İngilizce mesajını gösteriyordu, denetim satırı sipariş kimliği taşımıyordu | Modal; iptal neden ve seçili sayıyı yazmayı ister; sipariş başına sonuç ve denetim satırı; Türkçe mesaj | `admin-order-actions`, `admin-order-guards` |
| 🟡 | Manuel siparişte artık geçerli olmayan promosyon kodu sessizce düşüyordu | Yönlendirme sonrası uyarı (adm_flash) | `admin-order-actions` |
| 🟡 | Başarısız sipariş e-postası iz bırakmıyordu | Satır `failed` ve hatasıyla kalır (adresler maskeli), sonraki tetik devralır; sipariş sayfasında "E-postalar" ve onaylı "Yeniden gönder" (`<tür>#resend-<n>`) | `order-notice-emails`, `payment-paid-mail` |

İnceleme (17 Eki 2026, aynı dal) şunları da buldu ve düzeltti:

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🔴 | POS iade isteğine yanıt vermeyince (zaman aşımı, kopan bağlantı) iade kaydı ve modalın belirteci geri alınıyor, ekran "hiçbir kayıt oluşturulmadı" diyordu; operatörün yeniden denemesi ikinci iadeyi POS'a gönderiyordu (iade gitmiş olabilirdi) | Yalnız POS'un kesin reddi (`PaymentRefusedError`) kaydı geri alır. Yanıtsız istekte kayıt kalır, müşteriye "iade edildi" gitmez, sipariş `refund_unknown` ile kırmızı banda düşer, tekrar deneme defterde reddedilir | `admin-order-actions`, `db-integration-admin-orders` |
| 🟠 | İptal ve diğer geçişler, kararın verildiği durumdan değil o an okunan durumdan yazılıyordu: POS kontrolü ile yazım arasında gelen ödeme, personelin "ödenmemiş" iptaliyle ödenmiş siparişi iade yetkisi ve "iade bekliyor" işareti olmadan iptal ettirebiliyordu | `transitionOrder(…, { expectStatus })`: yazım, kararın verildiği duruma koşullu | `admin-order-actions`, `db-integration-admin-orders` |
| 🟠 | "CSV indir" personele açıktı: 5.000 siparişe kadar her müşterinin adı, e-postası ve ödediği tutar dosyaya çıkıyordu (müşteri listesi ve raporlar personele kapalı) | Yalnız sahip ve yönetici (`mayExportOrders`); personelde düğme yok, rota 403 | `admin-order-csv` |
| 🟡 | Elle yeniden gönderilen başarısız e-posta satırı `failed` kalıyordu: aynı e-postanın sonraki tetiği (aynı numaranın Geliver teslim olayı) onu devralıp ikinci kopyayı gönderiyordu | Kopya çıkınca satır `resent` olur, sonraki tetik devralmaz | `db-integration-admin-orders` |
| 🟡 | Hiçbir kalemi stoğa dönemeyecek (katalog ürünü olmayan ya da tamamı geri alınmış) kargodaki sipariş iptal edilemiyordu: sunucu stok kararı istiyor, modal soruyu göstermiyordu | Karar yalnız stoğa dönecek kalem varken istenir (`hasStockToReturn`, modal ve sunucu aynı kural) | `admin-order-actions` |

## 13. Admin paneli denetimi - 17 Eki 2026

Paneli yedi alanda (kabuk, siparişler, karaoke, kişiler, katalog, içerik,
sistem) gezen denetimin bulguları çatışmalı doğrulamadan geçti. Düzeltmeler
konu konu ayrı PR'larla iner; her PR kendi alt başlığını buraya ekler.

### Kabuk: etiketler, düğme ve alan yazısı, odak, yazdırma

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟠 | GTM, rıza betikleri ve çerez bandı panelde de yükleniyordu. GTM konteynerini yayımlayabilen biri (Custom HTML etiketi sitenin CSP'sinden geçer) panelin kendi sayfalarında, müşteri adı, adresi ve telefonunun yanında, açık admin oturumuyla her server action'ı (iade, ayarlar) çağırabilirdi; konteynerde GA etiketi çalışıyorsa adres ve başlıkla birlikte müşteri e-postası da (`/admin/musteriler/[email]`) üçüncü tarafa gidiyordu; bant toast'ların ve toplu işlem çubuğunun üstündeydi | `site-tags.tsx`: ayrı panel belgesi koşulu (`/admin` ve altı, `/administrator` değil; yol kaçışları çözülerek okunur, `/%61dmin` de paneldir); karar, ödeme sayfasındaki gibi belgenin yüklendiği yoldan bir kez verilir. `isCheckoutPath` değişmedi. Panele özel dar bir CSP sonraki adım (karar D34). Sitedeki etiketin panele ulaşması kapanmadı: aşağıda "Açık" | `checkout-document` |
| 🟡 | Yazdırma kuralı kapsamsızdı: fişi olmayan her sayfa (pano, raporlar, sipariş listesi, `/hukuk/*` metinleri, menü) kâğıda boş çıkıyordu | Kural yalnız `[data-print-receipt]` taşıyan sayfada gerisini gizler (`body:where(:has([data-print-receipt])) *`, eski ağırlıkla); sipariş fişi ve masa kartları eskisi gibi tek başına basılır | `admin-root-css` |
| 🟢 | Paneldeki her `<button>` yazı boyutunu, kalınlığını, satır yüksekliğini ve pasif imlecini yok sayıyordu (sitenin katmansız `button { font: inherit; cursor: pointer }` sıfırlaması): aynı sınıflarla düğme 16px, bağlantı 14px çiziliyor, pasif düğme tıklanır görünüyordu | Admin kökünde `a` ve `button` için `font: revert-layer`; pasif düğme ve `aria-disabled` için `cursor: not-allowed`. İmleç geri alınmaz: Tailwind 4 düğmeye imleç koymaz, her düğme oka dönerdi | `admin-root-css` |
| 🟢 | Alanlar da boyut sınıflarını yok sayıyordu: masaüstünde her alan 16px, etiket ve düğmeler 14px | Alanlarda da `font: revert-layer`; `sm` (40rem) altında ve dokunmatik ekranda (`pointer: coarse`, yan çevrilmiş telefon) metin alanları 16px kalır (iOS yakınlaştırması), `min-width: 0` olduğu gibi | `admin-root-css` |
| 🟢 | Sitenin yeşil odak halkası ve halesi kitin halkasını eziyordu, odaklı alanda ikisi birden görünüyordu | Panelde tek halka: 2px espresso çizgi (`--admin-primary`, beyazda 12,46:1), gölge yok. Kitin %45 altın halkasına dönülmedi: beyazda 1,59:1, odak için gereken 3:1'in altında | `admin-root-css` |
| 🟠 | Sitedeki bir etiketin panele uzanma yolları (21 Eki 2026, aşağıdaki açık bulgunun kapanan kısmı): admin çerezi bütün köken için yazılıyordu (`path=/`), sitenin her isteğine, route handler'ına ve server action'ına gidiyordu; panel belgeleri sitenin CSP'siyle (`'unsafe-inline'` ve GTM serbest) sunuluyordu (karar D34 ertelenmişti) | Oturum ve 2FA çerezi yalnız `/admin` yoluna, yeni adlarla (`laffogato_panel_session`, `laffogato_panel_2fa`; `src/lib/admin/session-cookie.ts`). Ad değişti çünkü tarayıcı çerezi ad ve yol çiftiyle tutar, istek yolu taşımaz ve Next.js bir yanıtta bir ada tek Set-Cookie yazar: eski adla eski kopya ne ayırt edilir ne aynı yanıtta silinip yenisi yazılırdı. Geçiş: `/admin`'e gelen ilk sayfa görüntülemesinde proxy eski, geçerli imzalı oturumu kalan ömrüyle `/admin`'e taşır ve eskisini `path=/`'te siler (yeniden giriş yok); POST'ta (server action) yanıtın çerezlerine dokunmaz, isteğe taşır; giriş ve çıkış eski çerezleri kendileri siler. `/admin` dışında admin çereziyle doğrulanan uç yok (`/api/panel/karaoke` sunucudan sunucuya imzalı, çerezsiz). Panel belgeleri (giriş ve 2FA dahil, `/%61dmin` de) istek başına nonce'lu kendi CSP'sini alır: üçüncü taraf yok, `'unsafe-inline'` betik yok, `frame-ancestors 'none'` (`src/lib/security/admin-document.ts`, `src/proxy.ts`); sitenin politikası da kalır, ikisi birlikte uygulanır. X-Frame-Options DENY zaten her yoldaydı. Çerez Politikası §8 envanteri yeni adlarla (LEGAL-REDLINES §29) | `admin-cookie-path`, `admin-document` |

Not: el yapımı küçük düğmeler artık sınıflarının söylediği boyutta çizilir
(ör. sipariş listesinde "Ses kapalı" ve müşteri kartında "Düzenle" 11px);
kit düğmelerine taşınmaları kendi alanlarının PR'larında. Fişsiz bir admin
sayfası yazdırılınca telefon üst çubuğu da basılır; kenar çubuğu, üst çubuk
ve çekmecedeki `print:hidden` kabuk gezinme PR'ında.

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟠 | GTM konteynerini yayımlayabilen biri sitenin herkese açık sayfalarında hâlâ betik çalıştırır. Oturumu açık bir yönetici aynı tarayıcıda siteyi gezerken o betik `fetch("/admin/...")` ile panel sayfalarını okuyabilir ve server action çağırabilir: çerezin yolu (`/admin`) isteğin gittiği adresle eşleşir, isteği başlatan sayfayla değil, aynı köken ve `connect-src 'self'` buna izin verir. Kullanıcı tıklamasıyla açılan bir `window.open('/admin')` penceresine de aynı kökenden erişir. Gizli iframe yolu kapalı (`frame-ancestors 'none'`, X-Frame-Options DENY) | 21 Eki 2026'da kapananlar yukarıda (çerez yolu, panel CSP'si, çerçeve). Aynı köken içinde yol bir güvenlik sınırı değildir; kalan yolu ancak panelin ayrı bir kökene (alt alan adı, yalnız o alana yazılan çerez) taşınması kapatır: ayrı karar ve arka yüz işi. Bugün GTM kapalı (`siteTagManagerId` 19 Ekim 2026'dan beri boş döner), yol yalnız GTM yeniden açılırsa çalışır. O zamana kadar GTM yayın yetkisi dar tutulur, panel siteyi gezmekte kullanılmayan bir tarayıcı profilinde açılır. Ara önlem seçeneği (yapılmadı): girişte yalnız varlığı söyleyen, `path=/` bir işaret çerezi yazıp bu tarayıcıda site sayfalarında GTM'i hiç yüklememek |

### Kabuk: kit (okunabilirlik, tablo, süzgeç, modal, formlar)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟠 | Bir reddi kaydı da değiştiren işlemde (POS'a gidip yanıt alamayan karaoke iadesi: `refund_unknown`) sayfa yenilenince düğme kalkıyor, diyalog da onunla gidiyordu: "PayNkolay panelinden bak" cümlesi hiç görünmüyordu, toast da yoktu. Yarışı kaybeden bir onay da böyle sessizce kapanıyordu; düğme pasifleşip yeniden açılınca eski diyalog kendiliğinden açılıyordu | `ActionModal` son reddi tutar; diyalog kapatılmadan sayfadan kalkarsa red bir kez hata toast'ı olur (kapatılana kadar durur), yanıt ile sayfa güncellemesi hangi sırayla gelirse gelsin. Düğme pasifleşince `open` sıfırlanır | `admin-confirm-ui` |
| 🟠 | Sipariş ve karaoke tablosu 768-1366 px'te kartından genişti: satırın tek işlem girişi "⋯" yatay kaydırmanın arkasında, kaydırma çubuğu 50 satır aşağıdaydı; `sr-only` başlık metni kartın dışına taşıp bütün paneli yana kaydırıyordu | `DataTable`: "⋯" sütunu sağa sabit (`sticky right-0`), satırla aynı opak zeminle (beyaz, üzerine gelince, seçiliyken) ve solunda ince çizgiyle; kaydırma kutusu `relative`. Sütun kırpma alanların kendi PR'larında | `admin-ui-kit` |
| 🟡 | Etiket, ipucu, başlık üstü ve yer tutucu rengi (`--admin-text-mute` `#8A7A64`) AA'nın altındaydı: beyazda 4,16:1, sayfa zemininde 3,70:1, yer tutucu 2,41:1. Alan kenarı beyaz kartta 1,38:1'di, boş alan bulunmuyordu | Token `#74644F` (beyaz 5,71, zemin 5,08, `surface-2` 5,30, `neutral-soft` 4,86); yer tutucu tam token. Alanlara ayrı `--admin-border-field` `#9C8B70` (beyaz kartta 3,31:1, alan zemininde 3,07:1) | `admin-ui-kit` |
| 🟡 | Telefonda süzgeç hep açıktı: sipariş listesinde 658 px'lik form, ilk sipariş 1,3 ekran aşağıda | `md` altında ilk arama kutusu görünür, gerisi "Filtreler (n)" altında (`<details>`, JavaScript'siz de çalışır), biri seçiliyse açık; `md` ve üstünde satır eskisi gibi. 390 px'te form 160 px, ilk sipariş 475'te | `admin-filter-bar` |
| 🟡 | Toplu işlem çubuğu sayfa bağlantılarını örtüyordu: boşluk listenin içinde, sayfalamanın önündeydi ve sabit yükseklikteydi (telefonda çubuk 178-237 px) | Çubuk `ResizeObserver` ile ölçülür, aynı boşluk sayfanın en sonunda bırakılır; toast yığını da aynı ölçüyle çubuğun üstünde durur | `admin-ui-kit` |
| 🟢 | Sekme, sayfa, sıralama ve "Uygula" tıklamasından sonra eski liste hiçbir işaret vermeden duruyordu | "Uygula" geçişte `router.push` yapar ve "Uygulanıyor…" der; sekme, sayfa ve sıralama bağlantılarında `useLinkStatus` ile solan bir çizgi. Sayfa iskeleti (`admin/loading.tsx`) kabuk gezinme PR'ında | `admin-filter-bar`, `admin-ui-kit` |
| 🟢 | Toplu seçim kutuları 16 px tarayıcı mavisiydi (kurulu olmayan bir eklentinin sınıfları); sayfa hücreleri 40 px, toast kapatma 32 px'ti | Panelin 20 px espresso kutusu, 44 px dokunma alanında; sayfa hücresi ve toast kapatma 44 px | `admin-ui-kit` |

Kite eklenenler (alanlar kendi PR'larında kullanır):

- `useNoResetSubmit` ve `withPanelCatch` (`ui/submit.ts`, `action-form.tsx`'ten de
  dışa açık): React 19 `<form action>` reddedilen kayıtta yazılanı ve seçimleri
  sıfırlıyordu; form `onSubmit`'ten elle gönderilir, yanıt gelmeden ikinci
  gönderim düşer. `ActionForm` ve `ActionModal` bunu kullanır, `ActionForm`'a
  `beforeSubmit` eklendi.
- `Field as="fieldset"`: onay kutusu ya da yükleyici tutan alan `label` değil
  `fieldset`/`legend` olur; ipucuna dokunmak kutuyu değiştirmez. `Field`
  varsayılanı `label` kalır (içindeki alanın adı oradan gelir).
- `ActionModal` / `ConfirmButton` `ariaLabel` (satırda tekrar eden "Sil" için
  "Sil: <ad>"), başarılı işlemden sonra `admin:changed` olayı (kenar çubuğu
  rozetleri onu dinleyecek), tutar ve kodlar için `NUMERIC_STYLE`, Türkçe
  arama katlaması `foldTr` (`src/lib/admin/text-fold.ts`, SQL eşi
  `lower(translate(...))`).

### Katalog: ürün sihirbazı ve fiyat tabanları (paket 5a, 1-3. adımlar)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟠 | 0 TL fiyat, fiyatından büyük indirimli varyant ve 0 TL menü bardağı kabul ediliyordu; böyle bir sepetin toplamı 0 olup POS'a gitmeden "Ödendi" sayılıyordu, uygulamanın mağaza akışı eksi fiyat yayımlıyordu (CAT-05) | Satış fiyatı zorunlu ve en az 1 kuruş; her varyantın fiyatı + farkı en az 1 kuruş, adıyla "Varyantlar" altında reddedilir; menüde M fiyatı 0 olamaz (L boş, "-" ya da 0 tek boy demek). Eski fiyat ve maliyet boşsa 0 kalır. Sıfır toplamlı siparişin kapanışı (yüzde 100 promosyon) değişmedi | `admin-product-wizard`, `admin-catalog-money` |
| 🟠 | Reddedilen ürün kaydı kategoriyi, sahneyi, görsel tonunu ilk seçeneğe, Aktif / Öne çıkan kutularını eski hâline döndürüyordu; sonraki kayıt bunları yazıyordu (CAT-01) | Sihirbaz `useNoResetSubmit` ile elle gönderir; React'ın `<form action>` sıfırlaması yok | `admin-product-wizard` |
| 🟠 | 5. adımda "Ürünü kaydet" önceki adımda boş zorunlu alan varsa hiçbir şey yapmıyordu: tarayıcı gizli alanda uyarı gösteremiyor, gönderimi sessizce düşürüyordu (CAT-02) | Form `noValidate`; "Sonraki adım" ve kayıt önce alanları kendisi denetler, ilk sorunlu alanın adımını açar ve tarayıcının mesajını orada gösterir (varyant satırının görünen kopyasında); sunucu reddi de ilk reddedilen alanın adımını açar | `admin-product-wizard` |
| 🟡 | Alan hataları ipucu gibi görünüyordu (4,16:1 gri, rol yok, yalnız ad alanında `aria-invalid`); sihirbazda hata içeren adım belli değildi (CAT-09) | Her hata alanın altında ayrı satır: tehlike rengi, `role="alert"`, alana `aria-invalid` + `aria-describedby` (`markFieldErrors`), odak ilk hatalı alana; adım hapları ve düzenleme formundaki bölüm başlıkları hata içeren adımı işaretler; form hatası alt çubuğun üstünde `role="alert"` | `admin-product-wizard` |
| 🟡 | Alerjen ipucuna dokunmak fındık kutusunu değiştiriyordu: müşteri uyarısı sessizce kalkabiliyordu (SYS-M02) | Alerjen ve Yayın durumu `Field as="fieldset"` | `admin-product-wizard` |
| 🟢 | Kayıt sırasında atılan hata sayfayı hata ekranına çeviriyor, beş adımlık girişi siliyordu (CAT-17, sihirbaz) | `withPanelCatch`: hata yerinde "Bir hata oldu…" olarak görünür | `admin-product-wizard` |
| 🟢 | Otomatik SKU hep `-00001`'di (iki ürün aynı kodu alıyordu) ve Türkçe harfleri atıyordu ("Çay Bardağı" AYBA) (CAT-18) | SKU alanı boş başlar, sunucu ürünün sıra numarasıyla üretir; `src/lib/admin/sku.ts` Türkçe harfleri katlar (CAYB); kodu olmayan eski ürün düzenlenince kimliğinden kod alır | `admin-product-wizard` |
| 🟢 | Toplu silme ve güncelleme olay kaydına neye dokunduğunu yazmıyordu (CAT-20, ürünler) | Kayıt kimlikleri ve yazımdan önce okunan adları (ilk 100) taşır | `admin-product-wizard` |
| 🟢 | "Vazgeç" bağlantı içinde düğmeydi (CAT-22, sihirbaz) | Tek `Link`, `BUTTON.ghost` | `admin-product-wizard` |
| 🟢 | Sihirbazda İngilizce ve jargon ("override et", "was", "placeholder", "delta", "Δ", Pistachio, Rose, base64), özette kategori slug'ı (CAT-24, sihirbaz) | Sade Türkçe, "sen"; özette kategorinin adı | `admin-product-wizard` |
| 🟢 | Başka sekmede silinmiş ürünü kaydetmek "kaydedildi" diyor ve olay kaydı yazıyordu (CAT-28, ürünler) | "Bu ürün silinmiş; listeye dön." | `admin-product-wizard` |
| 🟢 | Adsız varyant satırı stoğu ve fiyatıyla birlikte sessizce düşüyordu (CAT-29) | "2. varyantın adını yaz ya da satırı sil." | `admin-product-wizard` |
| 🟢 | Ağırlık her yeni üründe 250 g "kargo için" başlıyordu ama müşteriye ve Google'a yayımlanıyordu; düşük stok ipucu mağazadaki "Son N adet" rozetini söylemiyordu (CAT-M02) | Ağırlık boş başlar (boş = gösterilmez), ipuçları nerede göründüklerini söyler. Metin avukat okumasından geçmeli | `admin-product-wizard` |

Ürün şemasına ad (120), SKU (40), etiket (80) ve açıklama (2000) için uzunluk
sınırı eklendi; CSV içe aktarma da aynı şemadan geçer.

Katalog paketinin kalanı kapandı: adım 4 ve 5 aşağıda, "Katalog: stok ve tohumlar"; liste tarafı (CAT-17, CAT-24) "Katalog: listeler"; menü ve vitrin formları "Katalog: menü, kategori ve vitrin formları".

Eklenen: **ürünleri CSV ile içe aktarma** (`/admin/urunler/ice-aktar`, ürün
listesinden bağlantı, yalnız `products` rolü; kural ve sütunlar
`src/lib/admin/product-import-core.ts`, okuma ve yazma `product-import.ts`).
Şablon UTF-8 + BOM, `;` ayraçlı. Dosya en fazla 1 MB ve 500 satır; ayraç
(`;` / `,`), BOM, CRLF ve tırnak depodaki RFC 4180 okuyucusuyla
(`src/lib/admin/csv.ts`) okunur, fiyat `129,90` da `129.90` da olur. Önce
önizleme (hiçbir şey yazılmaz, satır satır yeni / güncellenecek / değişiklik
yok / hata ve nedeni), sonra yalnız geçerli satırlar yazılır. SKU eşleştirme
anahtarıdır: aynı dosya ikinci kez hiçbir şeyi değiştirmez. Her satır sihirbazın
şemasından geçer (fiyat tabanı, uzunluk sınırları, KDV); var olan ürünün stoğu
fark olarak `adjustStock` ile ("CSV içe aktarma" notlu stok hareketi) değişir,
varyantlı ürünün stoğu buradan değişmez. İçe aktarma önizlemenin parmak izini
yeniden hesaplar; arada dosya ya da katalog değiştiyse yazmaz, yeni önizleme
gösterir. Her içe aktarma tek olay kaydı yazar (sayılar ve kimlikler, dosya
içeriği değil). Görseller içe aktarılmaz. Testler: `admin-csv-parse`,
`admin-product-import`.

Bağımsız inceleme sonrası (aynı PR): isteğe bağlı sütundaki boş hücre kayıtlı
değeri sildiği için önizleme her alanda "temizlenecek (hücre boş)" yazar ve
tablonun üstünde kaç üründe neyin temizleneceğini sayar (yalnız stok için
hazırlanmış bir dosya bütün eski fiyatları ve ürünlere özel KDV oranlarını
sessizce silebiliyordu). KDV hücresi yalnız 0, 1, 10, 20 ya da ürünün zaten
kayıtlı oranını alır (eski 18 / 8 reddedilir). Başlık en fazla 200 sütun.
İçe aktarma 90 saniyeden sonra yeni satıra başlamaz, kalanları "yazılmadı"
diye listeler (sayfa sınırı 120 sn; yanıt ve olay kaydı yine gelir). Alanları
yazılıp stoğu yazılamayan satır "Hata" sayılır. Şablonun örnek satırı pasif
açılır, dosyada kalırsa önizleme uyarır. Sihirbaz düzenlemede boşaltılan
SKU'nun kayıtlı kodu koruduğunu söyler (eskiden "kayıtta üretilir" diyordu).
Açık kalan risk: aynı dosya iki sekmede aynı anda içe aktarılırsa ve ikisi de
yeniden planlamayı ötekinin ilk yazımından önce bitirirse stok farkı iki kez
yazılır (pencere milisaniyeler; önizlemenin parmak izi geri kalan her durumu
yakalar).

### Siparişler: manuel sipariş, müşteri kartı, kasa (paket 2a)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟠 | Manuel sipariş hep "Kargo" paketiydi: kasadaki ya da telefonla alınan gel-al satış ancak uydurma bir takip numarasıyla kapanıyordu (e-postası olan müşteriye o numarayla "kargoya verildi" giderdi), ücretsiz kargo eşiğinin altında kargo ücreti ekleniyordu (ORD-01) | Formda "Teslimat": Gel-al (varsayılan, ücretsiz), Kurye (Ayarlar'daki kurye ücreti), Kargo (mağazanın kargo kuralı); seçim `finalizeOrder`'a gider. Gel-al ve kurye siparişi takip numarası istemeden "Hazır" ve "Tamamlandı" olur. Kargo ve kurye adres ister (karar D4) | `admin-manual-order`, `manual-order-schema`, `db-integration-admin-orders` |
| 🟠 | Reddedilen manuel sipariş müşteri bloğunu siliyor, durumu "Ödendi"ye döndürüyordu: "Ödeme bekleniyor" diye girilip stok reddi alan sipariş, ad yeniden yazılıp gönderilince kimsenin ödemediği bir ödenmiş sipariş oluyordu. Alan hatalarının çoğu görünmüyordu (ORD-03) | Form `useNoResetSubmit` + `withPanelCatch` ile elle gönderir; durum ve teslimat seçimi state. Her ret kendi alanının altında tehlike renginde, `role="alert"` ve `aria-describedby` ile; stok reddi ürün listesinin altında. Uzunluk sınırları alanlarda da var, her kuralın Türkçe mesajı var | `admin-manual-order`, `manual-order-schema`, `admin-order-actions` |
| 🟠 | Personel dahil her sipariş rolü, her durumdaki siparişin müşteri e-postasını, telefonunu ve adresini değiştirebiliyordu; olay kaydı yalnız "customer_delivery" diyordu. Üye geçmişi e-postayla okunduğu için bir yazım hatası siparişi adresi ve telefonuyla başka bir üyenin hesabına taşıyordu (ORD-16) | `orderDetailsRules` (`src/lib/admin/order-details.ts`): personel yalnız açık siparişte ad, telefon ve adresi düzeltir; e-posta yalnız sahip ya da yöneticinin, yalnız açık siparişte ve "E-postayı değiştir" onayıyla değişir. Kayıt, kuralın sorulduğu durum ve e-postaya koşullu yazılır; olay kaydı değişen her alanın eski ve yeni değerini tutar (karar D2). Siparişin damgası ya da üye kuponu o adrese yazıldıysa e-posta kimse için değişmez: iptal ve iade onları siparişin o anki e-postasıyla bulur, taşınan sipariş onları eski adreste bırakıyor, iade damgayı geri almıyordu (`orderEmailLedgerHeld`) | `admin-order-details`, `admin-order-actions`, `admin-order-detail`, `db-integration-admin-orders`, `db-integration-order-email-ledger` |
| 🟠 | Kasada "E-posta ile" her gönderimde damgayı yeniden veriyordu: yeşil fişten sonra adres alanda, "Damga ver" açık kalıyordu (ORD-13) | Aynı üyeye 3 dakika içinde ikinci kasa damgası reddedilir, ret "Tekrar ver" kutusunu açar; fişten sonra alan boşalır, "Damga ver" "Yeni işlem"e kadar kapalı (karar D6) | `admin-kasa` |
| 🟡 | Toplu seçim sekme, süzgeç, sıralama ve sayfa değişince kalıyordu: üç açık sipariş seçilip "Tamamlandı" sekmesinde "İptal et" basılınca ekranda olmayan üç sipariş iptal ediliyordu (ORD-07) | Liste adres satırıyla anahtarlanır (`key={JSON.stringify(sp)}`): her bağlantı yeni bir seçimle açılır | `admin-order-filters` |
| 🟡 | Yeni sipariş sorgusu, sesi ve bandı "Açık" sekmesinde de kapalıydı (ORD-09) | Süzgeçsiz, ilk sayfa, varsayılan sıralı "Açık" sekmesinde de çalışır; orada yalnız açık siparişleri sayar, arada kapanmış bir sipariş sekmenin gösteremeyeceği bir bant açmaz | `admin-order-filters`, `admin-order-signal`, `admin-order-reads` |
| 🟡 | Kasada damgalardan sonra olay kaydı atınca ya da bağlantı koptuğunda kasiyer panelin hata sayfasını görüyor, yeniden deniyordu (e-posta yolunda ikinci damga) (ORD-12) | Damgadan sonraki olay kaydı asla atmaz (adres loglanmaz); iki gönderim yolu da atılan hatayı "Damga verilmiş olabilir, üyenin kartını kontrol et." olarak gösterir, okutulan kod bir daha önerilmez | `admin-kasa` |
| 🟡 | Kod yakılıp damgalar yazıldıktan sonraki bir hata kasaya "Damga verilemedi. Tekrar dene." diyordu: QR'da tekrar "kullanıldı" yanıtı alıyor, e-posta yolunda damga ikinci kez yazılıyordu (ORD-M02) | `redeemCounterToken` yakmadan (ya da ilk damga isteğinden) sonraki her hatada `partial` sonucu, yazılan damga sayısıyla döner; kasa "verilmiş olabilir" der. Uygulamanın `/staff/stamp` ucu hatayı eskisi gibi yeniden fırlatır: yanıtı değişmedi | `mobile-counter`, `mobile-staff-stamp-route`, `admin-kasa` |
| 🟢 | "Ödendi" başlatılan manuel siparişte ödeme yöntemi ve ödeme satırı yoktu: nakit, kasadaki kart cihazı ve havale ayrılamıyordu (ORD-19) | Ödendi ya da Hazırlanıyor başlangıcı "Nasıl ödendi?" ister ve "Ödendi olarak işaretle"nin yazdığı `manual:<yöntem>` satırını siparişten sonra yazar; yazılamazsa sipariş durur, uyarı söyler. "Ödeme bekleniyor"da satır yok (karar D5) | `admin-manual-order`, `manual-order-schema`, `db-integration-admin-orders` |
| 🟢 | Manuel siparişin yanıtı yolda kaybolunca (bağlantı koptu, zaman aşımı) form dolu ve "Siparişi oluştur" açık kalıyordu: ikinci basış ikinci bir ödenmiş sipariş açıyor, stoğu iki kez düşüyor, ikinci ödeme satırını yazıyordu (doğrulayıcı C3) | Sayfa her açılışta bir deneme kimliği (`clientOrderId`) üretir, form her gönderimde onu yollar. Aynı kimlik yeniden gelince `createManualOrder` ilk siparişi döndürür; aynı anda gelen iki gönderimde benzersiz dizin (`orders_client_order_id_key`) ikinciyi durdurur, onun stoğu geri verilir. Operatör "zaten oluşturulmuştu" uyarısıyla o siparişe iner, ikinci olay kaydı yazılmaz | `admin-manual-order`, `manual-order-schema`, `admin-order-actions`, `db-integration-admin-orders` |
| 🟢 | Kenar çubuğu rozeti, pano ve "Açık" sekmesi farklı sayılar gösteriyordu (yoldaki paket rozette yoktu) (ORD-21) | Tek `OPEN_ORDER_STATUSES` (`order-filters.ts`): sekme, rozet (`countOpenOrders`) ve "Aktif sipariş" aynı kümeyi sayar. Rozetin "Açık" sekmesine bağlanması kabuk gezinme PR'ında | `admin-order-filters`, `admin-order-reads` |
| 🟢 | Rıza kaydının IP adresi ve tarayıcısı personele gösteriliyordu (ORD-29) | Müşteri görünümü olmayan rol "Kayıtlı" görür; kayıt değişmedi (karar D3). Sipariş sayfası başlık düğmelerine, liste her satırına rıza kaydı olmadan sipariş verir (`orderForClient`): istemci bileşenine giden her prop sayfanın RSC verisinde, yani kaynağında duruyordu (doğrulayıcı C2) | `admin-order-detail`, `admin-order-consent-payload` |
| 🟢 | Manuel formda stok hiç görünmüyordu, tükenmiş ürün seçilebiliyor, adet stoğa bakmıyordu (ORD-M03) | Seçeneklerde "(stok: N)", tükenen ürün ve varyant pasif, adet seçilenin stoğuyla sınırlı; sunucunun denetimi yine son söz | `admin-manual-order` |
| 🟢 | "Vazgeç" bağlantı içinde düğmeydi, her "Kaldır" aynı adı taşıyordu (ORD-18); formda gri `neutral-400` metin, "İçsel not", "opsiyonel", "SUMMER25" (ORD-05, ORD-26 form kısmı) | Tek `Link` (`BUTTON.ghost`); "1. satırı kaldır", tek satırda nedeniyle pasif; panel renkleri, "İç not", "isteğe bağlı", "YAZ25" | `admin-manual-order` |

### Siparişler: liste, sipariş sayfası, kasa okuyucu (paket 2b)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟢 | Sipariş tablosu (sabit "⋯" sütunundan sonra da) 768 ve 1024 px'te kartından 18-132 px genişti; uzun masa adı 1536 px'te Kanal sütununu 432 px'e çıkarıyordu (ORD-02 sütun kısmı) | No hücresi kırılır (işaretler ve tarih numaranın altına), Müşteri 12rem, xl altında hücreler `px-3`, Kanal 2xl'den itibaren ayrı sütun (14rem sınırlı), altında hapları müşterinin altında; masa hapı "Masa · Bahçe 5". Derlenmiş CSS ile ölçüldü: 768, 820, 1024, 1280, 1366 ve 1536 px'te tablo kartına eşit | `admin-orders-ui` |
| 🟢 | Kanal hapları ham Tailwind paletiyle ve satır kırarak çiziliyordu ("Masaya servis · Bahçe 5" üç satır) (ORD-22) | Kit `Badge` tonları (her mürekkep zemininde AA), tek satır, uzun ad kesilir ve `title`'da tam yazar | `admin-orders-ui` |
| 🟢 | "N yeni sipariş" bandı telefonda yapışkan üst çubuğun altına giriyordu (ORD-10); ses düğmesi "Ses kapalı/açık" yazısını değiştirirken `aria-pressed` da veriyordu (ORD-27) | Bant lg altında `top-[4.25rem]`; düğmenin adı sabit "Yeni sipariş sesi", durumu yalnız `aria-pressed` ve nokta söyler, 44 px. Tercih yeni sipariş uyarısıyla aynı yerden okunur (`sound-pref.ts`, #147) | `admin-orders-ui` |
| 🟢 | Telefonda toplu işlem çubuğu dört düğmeyle 237 px'e çıkıyordu (ORD-06 telefon kısmı); "Kargoda / Hazır" kurye ve masa siparişini dışarıda bırakıyordu (ORD-26) | sm altında dört düğme tek "Toplu işlem" menüsünde, çubuk tek satır (70 px). Çubuğun `backdrop-blur`'u kalktı: arka plan süzgeci çubuğu sabit konumlu alt öğelerin kapsayıcısı yapıyor, menü paneli ekranın 750 px altında açılıyordu. Adım "Hazır / yolda", modal her sipariş türünde ne olacağını söyler | `admin-orders-ui` |
| 🟢 | Boş listede çıkış yoktu, `?sayfa=9` "Bu süzgece uyan sipariş yok." derken altında "101-137 / 137" yazıyordu, telefonda sipariş numarası bağlantı gibi görünmüyordu (ORD-25) | Süzgeç varken "Filtreleri temizle" (sekme kalır), boş sekmede "Tüm siparişler", hiç sipariş yokken "+ Yeni sipariş"; son sayfanın ötesi süzgeçlerle son sayfaya yönlenir; kart numarası altı çizili, 44 px | `admin-orders-ui`, `admin-orders-ui-pages` |
| 🟢 | Sipariş sayfasının müşteri ve teslimat adresi kartları eski görünümdeydi, kayıt bir şey söylemiyordu; gel-al ve masa siparişinde "Teslimat adresi yok. Düzenle ile ekleyebilirsin." yazıyordu (ORD-11, ORD-05) | Müşteri kartı kit `Section` + `KeyValueGrid`, form `useHandPost` ile gönderir (ret yazılanı ve onay kutusunu korur, sayfa canlanmadan basılan Enter adrese yazmaz), kayıt toast verir. Adres Teslimat bölümünde ve formda yalnız kargo ve kurye siparişinde; gel-al ve masa siparişinin formu kayıtlı adresi aynen geri yollar, kayıt onu silmez | `admin-order-detail` |
| 🟢 | Telefonda kalem tablosu 520 px'ti, kalem durumu seçimi ekran dışındaydı (ORD-24) | sm altında ve kenar çubuğunun yanındaki dar lg-xl sütununda her kalem alt alta, durum seçimi altında; tablo sm'den (ve xl'den) zorunlu genişliksiz | `admin-order-detail` |
| 🟢 | E-posta ya da olay kaydı okunamayınca sayfa "Bu sipariş için e-posta kaydı yok." diyor, "Yeniden gönder" düğmeleri kayboluyordu (ORD-20; zaman çizelgesinin "Kayıt yok" kısmı doğrulamada çürüdü) | Okuma `{ rows, failed }` döner; "E-posta kaydı okunamadı, sayfayı yenile." ve zaman çizelgesinin üstünde "Olay kaydı okunamadı" notu | `admin-orders-ui-pages` |
| 🟢 | "Hazır - teslime hazır", kasada "opsiyonel", liste ve yeni sipariş başlığında "E-ticaret"; dikkat bandı personele kullanamadığı "Dikkat işaretini kaldır"ı söylüyordu (ORD-26); yeni sipariş sayfasında hap biçimli geri bağlantı ve gri metin, kasa fişi ham yeşil (ORD-22) | "Teslime hazır", "Not (isteğe bağlı)", başlık "Satış"; bant, işareti kaldıramayan role "Çözülmesi için bir yöneticiye haber ver." der; metin bağlantısı, ürün yoksa boş durum ("Ürün ekle" yalnız Ürünler'i açabilen rolde; personele "bir yöneticiye haber ver"), fiş panelin başarı tonunda | `admin-orders-ui`, `admin-orders-ui-pages` |
| 🟢 | Kasa kamerasının çerçevesi yatay kamerada (iPad, dizüstü) kutunun genişliğinden çiziliyordu: 340 px kutuda 523 px, okunan kare ekranda 294 px; çerçevenin içinde ama ortanın dışındaki QR okunmuyordu (ORD-14). "Yeniden dene" kamerayı hiç yeniden açmıyordu: hata yanıtı video ve tuvali kaldırıyordu | `reticleSize()`: okunan kare `object-fit: cover` ölçeğiyle ekrana taşınır, kutunun kısa kenarının %92'sini aşmaz; çerçeve okunan karenin içinde kalır. Okuyucu hata yanıtının altında gizli olarak takılı kalır, "Yeniden dene" onu açar | `till-scan-engine` |
| 🟢 | Yazdırılan sipariş fişi mali belge olmadığını söylemiyordu (hukuk kararı ASK-INVOICE, X-FIS) | Fişin altında tek satır: "Bu fiş mali belge değildir." Mali belge fatura / e-Arşiv faturadır (VUK m.229, VUK GT 509) ya da kasanın ÖKC fişi (VUK m.233). 20 Eki 2026'dan beri ikinci cümle ödeme yoluna göre: internetten ya da havaleyle ödenende "Faturan elektronik olarak e-postana gönderilir.", nakit ve kasadaki kart cihazında "Mali belgen kasadan verilen fiştir."; "Diğer" ödemede söz verilmez (`receiptInvoiceNote`) | `admin-order-detail` |
| 🟢 | Kit'e taşınan müşteri kartı formunun `action`'ı düşmüştü: action'sız ve method'suz form tarayıcının kendi GET'idir, ad, e-posta, telefon ve adres adrese yazılır (inceleme bulgusu) | Form React'in korumasını (`action`) yeniden taşır, gönderim yine onSubmit'ten; ret yazılanı korur | `admin-order-detail` |

### Katalog: stok ve tohumlar (paket 5a, 4-5. adımlar)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟠 | Ürün formu stoğu ve varyant stoğunu açıldığı andaki değerle yazıyordu: form açıkken gelen siparişin düşüşü kayıtta geri alınıyor, stok hareketi yazılmıyordu (CAT-03) | Form açılış anındaki stoğu da gönderir (`stockAtOpen`, varyant başına da); kayıt önce diğer alanları, sonra fiyat, varyant ve stoğu tek SQL fonksiyonunda (`save_product_variants`, satır kilidi altında) yazar ve stoğu yalnız formda yapılan değişiklik kadar oynatır, her değişikliği stok hareketi olarak ("Ürün formu") kaydeder. Eksiye düşecek değişiklik alanın altında, kayıtlı stokla reddedilir; fiyat, varyant ve stok değişmez; form yalnız hâlâ eksiye düşecek sayımın sonraki farkını kayıtlı stoktan ölçer, dokunulmamış varyant açılıştaki değerini korur (hepsini kayıtlıya çekmek, form açıkken satılan birimi geri satışa açıyordu). Açılan her form kendi belirtecini gönderir (`product_form_saves`): cevabı yazımdan sonra kaybolan kayıt (bağlantı koptu, sonraki adım hata verdi) yeniden gönderilince stok bir kez oynar, aynı formda yeniden değiştirilen sayım yalnız farkı kadar; yazımdan sonraki denetim kaydı `safeAudit` ile yazılır, başarılı kaydı hata cevabına çevirmez (eskiden aynı formu yeniden kaydetmek +50 girişi iki kez uyguluyordu) | `admin-catalog-stock`, `admin-product-wizard`, `db-integration-variant-stock` |
| 🟡 | Varyantlı ürünün toplamı varyantlardan ayrıydı: toplam 0 kalınca ürün "Stoksuz" görünüp siparişte düşüyordu, sipariş ön denetimi yalnız varyantı okuyordu, varyant stoğu hiçbir ekrandan düzeltilemiyordu (CAT-14) | Varyantlı ürünün toplamı aktif varyantlarından gelir: yeni üründe toplam, ilk varyantları alan üründe toplam onların toplamı; sonra her varyant değişikliği (aktifse) toplamı aynı fark kadar oynatır. Sihirbazda toplam salt okunur; aktif varyantlardan farklıysa (varyantsız satılan birim sonra Stok ekranında bir varyanttan da düşülünce toplam iki kez iner) sihirbaz işaretsiz "Toplamı aktif varyantlara eşitle" kutusunu gösterir ve kayıt toplamı onların stoğuna çeker, stok hareketiyle (`p_total_from_variants`). Ön denetim `claim_order_stock` gibi ürün toplamını da ister. Stok ekranı varyantlı ürünü varyantlarıyla listeler ve tek varyantı `adjust_variant_stock` ile düzeltir; `adjust_product_stock` varyantlı ürünü reddeder. Toplamı 0 kalmış varyantlı ürünler bir kez varyantlarının toplamını alır (stok hareketiyle); yalnız hiç stok hareketi ve sipariş satırı olmayanlar: satışla 0'a inmiş toplam tükenmiştir (varyantsız satılan birim varyantlardan düşmez), toplamla geri açılmaz | `admin-catalog-stock`, `admin-stock-adjust`, `db-integration-variant-stock` |
| 🟠 / 🟡 | Tablo boşken tohum: son ürünü, kategoriyi, menü kalemini, vitrin slaytını, hikaye dönemini, uygulama slaytını, duyuruyu ya da gönderiyi silmek bir sonraki soğuk başlangıçta paketteki satırları geri getiriyordu (satışa açık demo ürünler, "500₺ üzeri ücretsiz kargo", "Hafta sonu 24:00'e kadar", kasanın uygulamadığı yarı fiyat kampanyası); `setCounter` sayaçları geri sarıp silinmiş satırın kimliğini yeniden veriyordu (CAT-04, CON-01) | Her tohum bir veritabanında bir kez karar verir (`seedOnce`, `counters` içinde `seed:<tablo>` işareti); işaret varken boş tablo boş kalır. Katalog üretim derlemesinde hiç tohumlanmaz. `setCounter` `raise_counter` ile yalnız yükseltir. Kullanımdaki veritabanlarına işaretleri migration bir kez yazar | `admin-content-deletes`, `admin-seed-markers`, `db-integration-seed-markers` |

Migration: `20261017200000_variant_stock_adjust.sql`,
`20261017200100_seed_markers.sql`. Mağaza kartındaki hızlı "sepete ekle"
varyantlı ürünü varyantsız ekliyordu; böyle bir satır yalnız ürün toplamından
düşüp taban fiyattan satılıyordu (sunucu artık reddeder: "Sipariş satırı:
varyantlı ürün varyant ister" aşağıda). Toplam bu yüzden yeniden
hesaplanmaz, farkla oynar (satılan birimi satışa geri açmamak için). Kartın
varyantlı üründe hızlı ekleme yerine ürünü açması ayrı bir ön yüz işidir.

### Katalog: listeler (paket 5d, P2b)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Stok sayfası düzeltme formuna (istemci bileşeni) ürün satırlarının tamamını veriyordu: Personel her ürünün maliyetini, fotoğraflarını ve SEO alanlarını sayfa kaynağından okuyabiliyordu (CAT-07) | Form ürünün yalnız adını, stoğunu ve varyantlarının stoğunu alır (`toStockAdjustOption`); sayfa ürünleri fotoğrafsız ve maliyetsiz okur (`listProductsForPanel`) | `admin-catalog-lists` |
| 🟡 | Ürün ve menü listesi saklanan her fotoğrafı (2 MB'a kadar data URL, ürün başına 8) tarayıcıya gönderiyordu, ürün listesi her ilk fotoğrafı iki kez basıyordu; menü listesi hiç çizmediği fotoğrafı taşıyordu; Kategoriler ürün saymak için bütün fotoğrafları okuyordu (CAT-08) | Ürün listesinin satırı (`ProductListRow`) fotoğraf, maliyet, açıklama ve SEO taşımaz; küçük görsel `/gorsel/urun/<id>/0?v=...` adresinden gelir ve yalnız açık sayfanın ürünleri için okunur (`listProductThumbs`). Menü satırı fotoğrafsız (`MenuListRow`). Kategoriler sayıyı liste sütunlarından alır. Vitrin listesi 5c'de, `admin/loading.tsx` 1c'de geldi | `admin-catalog-lists` |
| 🟢 | Stok defteri en yeni 500 harekette duruyor, bunu söylemiyordu (CAT-16) | Toplam sayı ("Toplam N hareket"), sayfa başına 100 hareket ve sayfalar; ürün, sebep ve köşkün takvimiyle tarih aralığı süzgeci (`countStockMoves`, `listStockMoves` `offset`). Olay kaydından gelen silinmiş ürünün hareketleri kendi seçeneğiyle bulunur | `admin-catalog-lists` |
| 🟢 | Ürün araması İ, I ve ı'yı kaçırıyordu ("italyan" "İtalyan"ı bulmuyordu), kutu sorguyu noktalı i ile geri yazıyordu (CAT-19) | `includesTr`: iki yanda Türkçe katlama; kutu yazılanı gösterir | `admin-catalog-lists` |
| 🟢 | Ürün, menü ve stok listelerinde etiketsiz arama ve seçim kutuları, toplu "Kategoriye taşı" seçimi; her satırda adsız "Sil"; 10 px yazılı, 16 px boyunda "siparişe git" (CAT-23, liste kısmı) | Kit süzgeç çubuğu etiketli; toplu seçim "Taşınacak kategori"; satır düğmeleri "Sil: <ad>", "Pasif yap: <ad>", "Tükendi: <ad>"; menünün her kategorisinde "<Kategori>: tümünü seç", telefonda da başlığın yanında; "Siparişe git" 44 px | `admin-catalog-lists`, `admin-confirm-ui` |
| 🟢 | Elle seçilmiş neutral / red / amber renkler, sahte italik başlıklar, Poppins'le "mono" (CAT-26, liste kısmı); el yapımı haplar (CAT-11, liste kısmı); 10 px neutral-400 / 500 yazılar (CAT-21, liste kısmı) | Kit rozet tonları, `EYEBROW`, `NUMERIC_STYLE`, `BUTTON.*`, panelin yazı renkleri | `admin-catalog-lists` |
| 🟢 | Filament eksikleri (CAT-30): ürün listesinde sayfa, sekme, sıralanabilir başlık ve satırda Aktif / Pasif yoktu (silme diyaloğu "pasif yap" diyordu), süzgeç "Uygula"lı bir GET formuydu; menüde arama ve süzgeç yoktu; ürünün ve menü kaleminin kendi sayfası yoktu; beş adımlı sihirbaz bir yenilemede kayboluyordu | Ürünler: Tümü / Aktif / Pasif / Düşük stok / Stokta yok sekmeleri sayılarıyla, arama ve kategori, sıralanabilir başlıklar, sayfa başına 50, satır başına "⋯" (Görüntüle, Düzenle, Mağazada gör, Stok hareketleri, Aktif / Pasif yap, Sil); tek tık `setProductActiveAction` istenen durumu yazar (çift tık kendini geri almaz). Menü: Tümü / Satışta / Tükendi, arama ve kategori, tek tık "Tükendi" ve "⋯". Salt okunur sayfalar `/admin/urunler/[id]` ve `/admin/menu/[id]` (karar D37); düzenleme sayfasının izi onlara döner. Listenin kit öncesi adresleri (`?status=`, `?sort=`, `?cat=`; panonun stok kartları bunlarla bağlanır) bugünkü sekmeye, sıraya ve kategoriye yönlenir (`legacyProductsHref`). Sihirbaz bir şey değiştirilmişken sayfa yenilenir ya da kapanırsa sorar (`useUnsavedGuard`) | `admin-catalog-lists`, `admin-shell-nav` |
| 🟢 | Varyant stoğu listede görünmüyordu: tükenmiş 1 kg paket sağlıklı toplamın arkasında kalıyordu (CAT-14, liste kısmı) | Stok sütununda toplamın altında her varyantın stoğu, pasif varyant işaretli; ürün sayfasında varyant tablosu | `admin-catalog-lists` |
| 🟢 | Menü listesi etiketleri ham anahtarla gösteriyordu, lang=tr altında "SİGNATURE" (CAT-10, liste kısmı) | Türkçe: İmza, Yeni, Buzlu, Sert kabuklu yemiş; uygulamanın bilmediği kelime yazıldığı gibi, kesik çerçeveyle ve "uygulamada görünmez" notuyla | `admin-catalog-lists` |
| 🟢 | Toplu işlem sırasında atılan hata paneli hata ekranına çeviriyor, seçimi siliyordu (CAT-17, toplu çubuklar) | `bulkAnswer`: `withPanelCatch` ile "Bir hata oldu..." yerinde bildirim; çubuk elle gönderir (`useHandPost`), ilk istek dönmeden ikinci tık düşer | `admin-catalog-lists` |
| 🟢 | "Bu filtreyle ürün yok." süzgeç yokken de çıkıyordu; Stok sayfasının başlığı "Operasyon" diyordu, menüde "Satış" altında (CAT-24, liste kısmı) | Boş durum neden boş olduğunu söyler (henüz yok, süzgeç, sekme) ve çıkış yolunu verir; "Satış · Stok" | `admin-catalog-lists` |

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Panelin kendi bağlantısına ve ⌘K'ya basınca sihirbaz sormuyor (CAT-30, istemci gezinmesi) | Genel koruma geldi (UI-17, `ui/unsaved-guard.ts`) ama sihirbaza bağlanmadı: kancası (`unsaved-guard.ts`) kayıt defterine yazıyor, denetleyiciyi (bağlantı ve palet sorusu) tutmuyor. Tek tuşlar zaten çıkmıyor. Bağlamak kancanın `trackUnsavedGuard`'ının denetleyiciyi de tutması: sihirbazın `beforeunload`'una dokunmaz, ayrı iş |
| 🟢 | Ürün listesi her istekte ürünlerin liste sütunlarını okuyup sekme sayılarını, aramayı ve sayfayı bellekte hesaplıyor | Mağazada birkaç yüz ürün; sorguyu SQL'e taşımak beş sekmenin sayısını ayrı sorgular ister. Fotoğraf yalnız açık sayfa için okunur |

### Kişiler: promosyon, üye, kupon, damga, kullanıcılar, kampanya (paket 4a)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟠 | Promosyon düzenleme sayfası her açılışta çöküyordu: sunucu sayfası istemci formuna düz bir ok fonksiyonu veriyordu, React bunu geçiremez. Üyenin adres düzenleme sayfası da aynıydı (PEO-01, PEO-M01) | İkisi de `updatePromoAction.bind(null, id)` / `updateAddressAction.bind(null, id)`. Sunucu bileşeninde FormData alan, `"use server"` ile açılmayan her fonksiyonu yakalayan statik test | `admin-client-closures` |
| 🟠 | Reddedilen kayıt formu sıfırlıyordu (React 19 `<form action>`): yeni promosyon "Bu kod zaten kullanılıyor." deyince değer 10'a, limit 0'a (sınırsız), süre boşa döner, kod yeniden aktif olurdu; kupon "Tür"ü %'ye döner, yeniden yazılan 15 TL %15 olurdu; panel kullanıcısı Kasiyer'e dönerdi (PEO-02) | Üye, promosyon, kupon, damga, panel kullanıcısı ve kampanya test formları `useNoResetSubmit` ile elle gönderir; sayfada kalan başarı formu bir efektle boşaltır | `admin-people-forms` |
| 🟡 | Alan hataları ipucu gibi gri ve sessizdi; hata kutularında rol yoktu (PEO-09) | Her hata alanın altında tehlike renginde `role="alert"`, alana `aria-invalid` + `aria-describedby` ve odak (`markFieldErrors`); form hatası `role="alert"` kutusu (`form-feedback.tsx`) | `admin-people-forms` |
| 🟢 | Bir kayıt hatası sayfayı hata ekranına çeviriyordu; üye kaydı ve yeni kampanya taslağı toast'sız yönleniyordu; "Pasifleştir" başka sekmede silinmiş ya da bağlantıyla çıkmış aboneye de "Abone pasif" diyordu (PEO-16) | `withPanelCatch`; yönlenmeden önce `setAdminFlash`; `deactivateNewsletterSubscriber` yalnız aktif satırı pasifleştirir (zaten çıkmış abonenin çıkış tarihi panelin tıklamasına kaymaz) ve bir satır değişip değişmediğini döndürür | `admin-people-forms`, `admin-newsletter-actions`, `admin-people-store`, `admin-customer-actions`, `admin-campaign-mail-actions` |
| 🟢 | `updatePromo` okuduğu satırı `usageCount` ile birlikte geri yazıyordu: arada gelen kullanım kayboluyor, limitli kod limitini aşabiliyordu (PEO-M03) | Yalnız formdaki alanlar yazılır, satır `RETURNING *` ile döner | `admin-people-store` |
| 🟡 | Promosyon tutarlarında tavan yoktu: "50" yerine "5000" her sepeti 5.000 TL'ye kadar bedava yapıyor, çok büyük sayı Postgres 22003 ile formu düşürüyordu (PEO-06); kupon "Min. sepet"inde de (PEO-M02) | Sabit indirim en fazla 2.000 TL (kupon sınırıyla aynı), alt sepet en fazla 1.000.000 TL, kullanım limiti en fazla 1.000.000; "-5" ya da "abc" limit artık sınırsız sayılmaz, alanının altında reddedilir. Kupon kaydı hatası cevap olur | `promo-schema`, `admin-customer-actions` |
| 🟢 | Geçmiş son geçerlilik tarihi sessizce kabul ediliyordu: kod ve kupon doğduğu an ölüydü (PEO-24'ün bu kısmı) | Promosyon formu ve kupon tanımı geçmiş tarihi reddeder (bugün kupon için geçerli). Süresi dolmuş kodun kendi tarihi düzenlemede dokunulmadan kalabilir, kod kapalı kalır; ret mesajı "boş bırak" demez, çünkü boş süresi dolmuş kodu süresiz açar ve form bunu söyler | `promo-schema`, `admin-customer-actions`, `admin-catalog-actions`, `admin-people-forms` |
| 🟢 | Üye sayfasındaki "+1 damga" `orders` kapısıyla açıktı, istemcinin bağladığı her adrese, olmayan ya da kapalı hesaba damga yazıyordu; damgadan sonra düşen olay kaydı hata ekranı gösteriyordu (ORD-28) | `customers` kapısı, üye yoksa ya da kapalıysa red (kasanın denetimi), olay kaydı hatası adressiz loglanır, damga cevabı kalır | `admin-customer-actions` |
| 🟡 | Üye formu kampanya ve bülten iznini açabiliyor, panelden kapatılan iznin tarihi kalıyordu: kapat-aç üyeyi eski tarihle kampanya ve doğum günü kitlesine geri koyuyordu (PEO-04, karar D12) | `adminUpdateCustomer` kapalıdan açığa geçişi reddeder (`consent_grant`; eski sekmede açık kalan form da yakalanır), panelden kapatılan pazarlama izninin tarihi silinir, rıza defteri satırı `admin` kaynağıyla yazılır. Formda kapalı izin pasif çizilir ve gönderilmez; form onu `shownMarketing` / `shownNewsletter` ile bildirir, sunucu o anahtarda satırdaki değeri korur (sayfa açıkken üyenin verdiği izin panelin geri çekmesi sayılmaz, tarihi silinmez). Form ve üye sayfası izin tarihini gösterir. Metin avukat okumasından geçmeli | `admin-people-store`, `admin-customer-actions`, `admin-people-forms` |
| 🟡 | Kapatılan hesap Müşteriler'de gerçek adı ve telefonuyla "Üye / Pasif" görünüyor, adla aranınca bulunuyordu; "Hesabı sil" siparişlerin "anonim" kaldığını söylüyordu (PEO-M04, karar D13) | `deleted-…@anon.local` adresleri listeden ve sipariş özetinden çıkar; diyalog hesaptaki verinin silindiğini, siparişte faturadaki ad, telefon ve teslimat adresinin yasal saklama süresince kaldığını söyler. Siparişlerdeki ad avukat görüşü olmadan silinmez | `admin-people-store`, `admin-people-forms` |
| 🟡 | Telefonunu kaybeden kullanıcının 2FA'sı ancak SQL ile kapanıyordu; silinen hesabın 2FA kaydı kalıyor, aynı adresle açılan hesap eskisinin sırrını devralıyordu (PEO-07, SHE-10) | Kullanıcılar sayfasında "2FA açık / kapalı" rozeti ve sahip için "2FA'yı sıfırla" (`reset2FAAction`: `adminUsers` kapısı, adres yazılarak onay, sır içermeyen olay kaydı sıfırlamadan önce; kendi hesabında ve ortam değişkeni hesabında red). Hesap silinince 2FA kaydı da silinir, yeni hesap açılırken eskiden kalan kayıt düşer; bu silme başarısız olursa hesabın olay kaydı yine yazılır ve panel bunu söyler. Kurtarma kodları sonra (D40) | `admin-staff-actions`, `admin-people-forms` |
| 🟡 | Rol açıklaması Yönetici'nin iade, üye silme ve toplu e-posta yetkisini saklıyordu (PEO-22) | Açıklama sunucu kapılarının okuduğu matristen üretilir (`src/lib/admin/role-summary.ts`) | `admin-role-summary` |
| 🟡 | Kampanya bir `window.confirm` OK'iyle yüzlerce adrese gidiyordu; listede cevap satırla birlikte kayboluyordu; taslak "Sil" hiçbir şey söylemiyordu (PEO-08, karar D15) | `ActionModal`: alıcı sayısı açıklamada, onay için sayı (sayılamadıysa GÖNDER) yazılır; gönderim ve taslak silme `ActionResult` döner, cevap toast olur (boş kitle uyarı tonunda). `DeleteRowForm` kalktı | `admin-campaign-mail-actions`, `admin-people-forms` |
| 🟢 | "Vazgeç" bağlantı içinde düğmeydi, promosyonda "Durum" etiket içinde etiketti (PEO-20'nin bu iki formdaki kısmı) | Tek `Link`, `BUTTON.ghost`; onay kutusu grupları `Field as="fieldset"` | `admin-people-forms` |

Paket 4a'nın dışında kalan kısımlar 4b'de (üye sayfası) ve 4c'de (kampanya formu) kapandı.

### Kişiler: Müşteriler listesi ve üye sayfası (paket 4b)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Müşteriler her üye satırını (`select *`) ve her siparişi okuyup JavaScript'te birleştiriyor, bütün listeyi sayfaya iki kez yazıyordu (telefon kartları ve masaüstü tablosu); sayfalama, sıralanabilir başlık, sekme yoktu; kutucuklar farklı kapsamları sayıyordu (PEO-13) | Birleştirme, arama, sıralama ve sayfa SQL'de: `admin_customer_rows` (üye hesabı + sipariş özeti, `summarizeCustomers` kuralıyla: bekleyen ödeme ve iptal harcama değil, kapatılan hesap ve kasanın misafir adresi dışarıda), `admin_customer_page` (bir sayfa), `admin_customer_counts` (sekme başına). Sayfa kitte: sekmeler sayılarıyla (Tümü, Üyeler, Misafirler, Pasif), süzgeç çubuğu (arama, ticari ileti izni, e-posta doğrulaması), sıralanabilir başlıklar, numaralı sayfalar, satır menüsü, telefonda kart. Sekme rozeti, sayfa toplamı ve kutucuklar aynı cevabı (bu sekme, bu süzgeç) okur. Tüm tabloyu okuyan `listCustomers` / `listAllCustomers` kalktı | `admin-customer-list`, `db-integration-customer-list`, `admin-order-reads` |
| 🟡 | Arama "ismail" yazınca "İsmail"i bulmuyordu (yerelsiz `toLowerCase`) (PEO-05) | Aranan metin `foldTr` ile, sütunlar SQL'de `admin_fold_tr` (aynı harfler) ile katlanır; telefon rakamlarıyla da bulunur ("0532 …" yazınca "+90 532 …"); `%` ve `_` harf olarak aranır. Adlar her harmanlamada Türk alfabesi sırasıyla sıralanır (`admin_sort_tr`) | `admin-customer-list`, `db-integration-customer-list` |
| 🟡 | Üye sayfası neredeyse her e-postada 390 px telefondan genişti; "Doğrulanmış" rozeti kesiliyordu (PEO-03). Sadakat kartı da damga geçmişi satırı yüzünden kolonundan taşıyordu | Bütün kolon izleri `minmax(0, …)`, adresler her yerden kırılabilir, rozet adresin altına iner; yan kartların ızgarası ve damga geçmişi `grid-cols-1` (satır kısalır); iki kolon `xl`'den (kenar çubuğunun yanında `lg`'de yan kolon 232 px'ti). 390 / 1024 / 1280 px'te yatay taşma yok | `admin-customer-detail` |
| 🟡 | Gerçek bilgi `neutral-400` (2,59:1) ile yazılıydı: damga saatleri, davet durumları, boş liste cümleleri, doğrulama bağlantısı etiketi (PEO-10; ORD-05'in üye sayfası kısmı) | `--admin-text-soft` / `--admin-text`, büyük boş listelerde kitin `EmptyState`'i | `admin-customer-detail` |
| 🟢 | 9 px rozetler, `neutral-500` / `neutral-100` hapları (4,34:1), Tailwind paleti, hap bağlantılar, kare düğmeler (PEO-17, PEO-18) | Kitin `Badge`'i (10 px, AA tonlar), `--admin-*` jetonları, `BUTTON`, `KeyValueGrid`, `DataTable`; damga kutucukları 10 px | `admin-customer-list`, `admin-customer-detail` |
| 🟢 | Üye sayfasında `<ul>` içinde `<div>`, "-" başlıklı işlem sütunları, 32 px başlık bağlantıları; listede de "-" başlık (PEO-20'nin kalanı, ORD-27'nin bu kısmı) | Davetler `KeyValueGrid` + gerçek liste; kit tablosunun işlem sütunu "İşlemler" adını taşır; başlık bağlantıları 44 px kit düğmeleri | `admin-customer-detail`, `admin-customer-list` |
| 🟢 | "Lifetime value", ham ISO doğum günü (PEO-21'in bu kısmı) | "Toplam harcama", doğum günü gg.aa.yyyy | `admin-customer-detail`, `admin-customer-list` |
| 🟢 | Tarayıcı sekmesi ve geçmişi müşterinin e-postasını başlıkta taşıyordu (PEO-25, karar D14) | Başlık "Admin · Müşteri" | `admin-customer-detail` |
| 🟢 | "Sipariş" kutucuğu ile "Sipariş geçmişi (n)" farklı şeyler sayıyordu (PEO-26) | Kutucuk "Ödenen sipariş"; geçmişin üstünde "n sipariş · m ödenen" | `admin-customer-detail` |
| 🟢 | Sipariş geçmişi sınırsızdı ve elle yazılmış bir tabloydu (ORD-30'un üye sayfası kısmı) | Kit tablosunda en yeni 20 sipariş; fazlası "Tümünü gör" ile sipariş listesinde; kutucuklar bütün geçmişi üç sütundan sayar (`customerLifetimeOrders`) | `admin-customer-detail` |
| 🟢 | Hesap silme talebinin sekmesi, rozeti ve bandı (#145, #151) eski listenin JavaScript birleştirmesine bağlıydı | SQL listesine taşındı: `admin_customer_rows` üyenin `deletionRequestedAt`'ini taşır, `?filter=deletion` sekmesi (sayılı, sıralama ne olursa olsun en eski talep önce), satırda "Silme talebi" rozeti, altında son gün ya da "Süre doldu", bant süzgeçten bağımsız bütün açık talepleri sayar (`admin_customer_counts` en eski talebi döner); ekip e-postasının bağlantısı (`DELETION_ADMIN_PATH`) aynı | `admin-account-deletion-ui`, `db-integration-customer-list` |

Açık (paket 4b'nin dışında kalanlar):

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Üye sayfasının adresi hâlâ e-postayı taşıyor (`/admin/musteriler/<e-posta>`). "Siparişleri" ve "Tümünü gör"ün `?q=<e-posta>`'sı kalktı (list-search-no-url, aşağıda) | Opak kimlikli rota ayrı iş (karar D14); bütün bağlantıları değiştirir |
| 🟢 | Müşteri listesinde CSV dışa aktarma yok | Kişisel veri dışa aktarımı olay kaydının `export` eylemiyle gelir (7c) |
| 🟢 | Panodaki "Son siparişler" kartı hâlâ elle yazılmış tablo (ORD-30'un pano kısmı) | Pano PR'ında (7b) |

### İçerik: yasal belgeler ve site metinleri (paket 6a)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟠 | "Varsayılana döndür" tek tıkla, onaysız ve yanıtsız özel hukuk metnini siliyordu; metin (taslak dahil) geri gelmiyordu, olay kaydı yalnız `{ reset: true }` yazıyordu (CON-02) | Onay penceresi, `ActionResult` yanıtı. Yeni `legal_override_history` tablosu (migration `20261017210000`, yalnız ekleme, güncellenemez): `legal_doc_reset` metni aynı işlemde arşive alıp siler, `legal_doc_save` her kayıtta değişen eski metni arşive alır (karar D22). Arşiv listede ve düzenleyicide; "Önizle" ve "Geri yükle" (geri yükleme şu anki metni de arşive alır) | `admin-legal-actions`, `admin-legal-ui`, `db-integration-legal-history` |
| 🟠 | Hukuk ve Site Metinleri formları React 19 `<form action>` sıfırlamasıyla reddedilen kayıtta yazılanı siliyordu: tek uzun özet bütün Markdown gövdesini götürüyordu (CON-03, bu iki form) | İkisi de `ActionForm` (elle gönderim); red alanın altında | `admin-legal-ui`, `admin-site-content` |
| 🟡 | Düzenleyici yeni bir metne kodlu tarihi dolduruyordu: yeniden yazılan Mesafeli Satış metni dokunulmadan yayımlanınca siparişler kodlu metinle aynı sürümü kaydediyordu; sonraki düzenlemelerde de tarih kıpırdamıyordu (CON-M01) | Yeni metinde tarih boş başlar; yayımlanan tarihsiz metne kaydın İstanbul günü yazılır (sayfanın gösterdiği tarih = siparişin kaydettiği sürüm). Ödeme ve karaoke belgelerinde canlı metin değişirse tarih şu an kaydedilen sürümden sonra olmalı (iki ödeme belgesi tek sürümü paylaşır), canlı metin kodlu sürümden sonra tarihli olmalı; kayıttan sonraki sürüm, arşivden yeniden kurulan geçmişte iki belgenin başka bir metin çiftiyle kaydedildiyse reddedilir (sıfırlama, geri yükleme ya da geri alınan tarih eski etiketi yeniden boşa çıkarıyordu; iki ödeme belgesi birbirinin tarihini de görür). İçeriği değişmeyen kayıt hiçbir şey yazmaz, arşiv her metnin ne zaman göründüğünü tam söyler (karar D25). Düzenleyici siparişlerin kaydettiği sürümü gösterir | `legal-schema`, `legal-consent-history`, `admin-legal-actions`, `db-integration-legal-history` |
| 🟡 | Taslağın önizlemesi yoktu; "Önizle ↗" taslakta kodlu metni açıyordu (CON-10) | Yalnız sahibin açtığı `/admin/hukuk/<slug>/onizle` (taslak, kayıtlı metin ya da `?arsiv=` ile arşivdeki metin); listede "Taslağı önizle" ve "Yayındakini aç ↗" | `admin-legal-ui` |
| 🟡 | Hikaye, Basın ve Site Metinleri uzun metni sessizce kesiyordu (`.slice`, sonra "kaydedildi"); boş alıntı hikaye sayfasında boş tırnak çiziyordu (CON-15) | Her alanda `maxLength`; sınırı aşan değer alanın altında reddedilir (satır sonu tarayıcıdaki gibi bir sayılır); basın alıntısı zorunlu | `admin-story-press`, `admin-site-content` |
| 🟢 | Hukukta yürürlük tarihi serbest metindi: "26.05.2026" sayfada öyle görünüyor, sipariş kayıt gününü yazıyordu (CON-30) | Yalnız "26 Mayıs 2026" biçimi ya da boş | `legal-schema` |
| 🟢 | Site Metinleri'nde boşaltılan alan siteye ve uygulamaya boş gidiyordu, varsayılana dönüş yoktu (CON-13) | Hikaye ve kurucu alanları boş kaydedilmez; ana sayfa bandının iki alanı boş kalabilir (bandın kapatma yolu). Alan başına "Varsayılana dön"; varsayılanla aynı değer satırını siler, kodlu varsayılan yeniden siteye ulaşır (karar D23) | `admin-site-content`, `admin-site-content-store` |
| 🟢 | "Anında siteye yansır" kurucu adı ve unvanı için yanlıştı (yalnız uygulama okur); "Hero" etiketleri yanlış yeri gösteriyordu, ipuçları ham anahtardı (CON-14) | Etiketler "Ana sayfa giriş etiketi / metni", "(yalnız uygulamada)"; ipucu metnin nerede göründüğünü söyler (karar D24) | `admin-site-content` |
| 🟢 | Veritabanı hatasında Site Metinleri İngilizce iç mesaj gösteriyordu (CON-16) | "Kaydedilemedi. Biraz sonra tekrar dene." ya da ulaşılamayan veritabanı cümlesi; ayrıntı loga | `admin-site-content` |
| 🟢 | Basın uydurma atıfları (Monocle, Cereal) öneriyor, olmayan bir ana sayfa yerinden söz ediyordu (CON-17) | Nötr yer tutucular, "yalnız gerçekten yayımlanmış olanlar" | `admin-story-press` |
| 🟢 | Hukuk düzenleyicisinde tarih hatası hiç görünmüyordu, hatalar ipucu gibi griydi, başarı bildirimi yoktu, "Vazgeç" bağlantı içinde düğmeydi (CON-22) | Her alanda `FormFieldError`, `maxLength` 200 / 600 / 60 / 60.000, kayıt toast'ı (`setAdminFlash`), tek `Link` | `admin-legal-ui`, `admin-legal-actions` |
| 🟢 | Site Metinleri'nin yapışkan kayıt çubuğu zeminsizdi (CON-28) | Beyaz zemin, kenar ve gölge | `admin-site-content` |

Aynı PR'da gelenler: hukuk listesindeki durum hapları `Badge` (CON-07);
"Yayın durumu" kutusu `Field as="fieldset"` (CON-05); Markdown kutusu gerçek
eşaralıklı yazıyla ve alanın kendi boyutunda, iOS 16px korumasını ezmez
(CON-27); Hikaye ve Basın kart başlıkları h2, satırlar adlı grup, "Sil"
satırın adını taşır, Site Metinleri ve hukuk kayıt sonucu `role="alert"` /
toast (CON-23); boş Hikaye ve Basın listesi boş durum gösterir (CON-24);
"Story sayfası" ve hukuktaki "kodlu varsayılan" dili sadeleşti (CON-25).

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Kurucu unvanının varsayılanı İngilizce ("Founder & Roaster") (CON-25) | Varsayılan `STORY.founder` (`data.ts`, bu turda dokunulmayan dosya) ile eşit olmak zorunda (`mobile-story` testi, API-MOBILE §story); kaydedilmiş satır zaten onu örter. Operatör Site Metinleri'nden Türkçe unvanı yazabilir |
| 🟢 | Hikaye ve Basın'da satır başına "Kaydet" adını taşımıyor | `SubmitButton`'da `ariaLabel` yok (kabuk kiti); satır adlı `group` içinde |
| 🟢 | İki ödeme belgesi de panelden yayındayken birini varsayılana döndürmek ya da taslağa almak sürüm etiketini değiştirmeyebilir: daha yeni tarihli öteki belge sürümü taşır, aynı etiket o andan sonra başka bir metin çiftini gösterir | Bilerek reddedilmiyor: hazır metne dönüşe tarih verilemez, iki belge yayındayken hiçbir tarih sürümü ilerletemez ve ret varsayılana dönüşü kalıcı olarak kilitlerdi. Arşiv her metnin gösterildiği aralığı tam tutar (`updatedAt` → `archivedAt`), siparişin onay zamanıyla metin bulunur; kaydetme ve geri yükleme etiketi tekrar kullanamaz (`legal-consent-history`) |

### Sistem: Ayarlar (paket 7a)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Reddedilen kayıt sekmeyi sıfırlıyordu: "Online mağaza açık", "Yeni siparişte e-posta gönder", arama motoru anahtarı ve karaokede online ön ödeme sessizce yeniden AÇIK geliyor, yazılan her şey siliniyordu; operatör hatayı düzeltip kaydedince kapattığı anahtar açık kaydediliyordu (SYS-01, KAR-02) | Her sekme elle gönderir (`useNoResetSubmit` + `withPanelCatch`, `settings-ui.tsx`); başarı toast, ret düğmenin yanında `role="alert"` ve alanın altında (`aria-invalid`, odak ilk hatalı alana) | `admin-settings-form` |
| 🟡 | Kayıt hataları panelin hata sayfasına düşüyordu: "25.000.000" kargo ücreti integer sütunu taşırıyordu (22003), olay kaydı yazılamayınca kaydı tamamlanmış değişiklik hata gibi görünüyordu (SYS-02). KDV'nin kesirli oran kısmı #130'da kapanmıştı | Kargo, eşik, kurye ve karaoke saati en çok 1.000.000 TL (`MONEY_TOO_LARGE_ERROR`, alanın altında); kapasite ve hazırlık süresi yalnız rakam ("8.5" artık 8 değil); `ok()` `safeAudit` kullanır; istemcide atılan hata "Bir hata oldu…" olur | `admin-settings-actions` |
| 🟡 | Vergi sekmesi oranın sepete uygulandığını söylüyordu (SYS-03) | #130'dan sonra metin: fiyatlar KDV dahil, oran hiçbir fiyatı ya da toplamı değiştirmez, buradakiler kendi oranı olmayan ürün ve menü kalemlerinin varsayılanı, değişiklik verilmiş siparişin kaydını değiştirmez (karar D28; ürün başına oran ve satış anı kaydı #130'da) | `admin-settings-form` |
| 🟡 | Mağaza ve arama motoru anahtarının ipucuna dokunmak anahtarı değiştiriyordu (SYS-05) | `Field as="fieldset"` | `admin-settings-form` |
| 🟡 | Satışı, arama trafiğini ya da e-postayı durduran ayarlar düz "Kaydet"le uygulanıyordu (SYS-06) | Mağazayı kapatmak, siteyi arama motorlarına kapatmak, yeni sipariş e-postasını kapatmak ya da kimsenin almayacağı bir alıcı listesi (`resolveStaffRecipients` ile sayılır) ve Resend'in doğrulanmamış dediği bir alan adındaki yeni gönderen hiçbir şey yazmadan onay sorusu döner; onay aynı formu onaylanan anahtarla yeniden gönderir (karar D26) | `admin-settings-actions` |
| 🟡 | Kaydedilmemiş değişiklik işareti ve sayfadan çıkış uyarısı yoktu (SYS-07) | Form kendi varsayılanlarıyla (ya da son başarılı kaydıyla) karşılaştırılır: sekmede nokta, telefondaki seçimde "(kaydedilmedi)", satırda "Kaydedilmemiş değişiklik var.", `beforeunload` uyarısı | `admin-settings-form` |
| 🟡 | Sekmeler sekme değildi: ARIA yok, telefonda dört sekme ekran dışında, adres yok, her bağlantı Genel'e iniyordu (SYS-08, SHE-24, KAR-12'nin `?sekme` kısmı) | `role="tablist"`, ok tuşları, Home / End, tek sekme durağı; `sm` altında seçim kutusu; açık sekme `?sekme=` (sayfa okur, `replaceState` yazar). Test e-postasının düğmesi `?sekme=email` | `admin-settings-form` |
| 🟡 | Olay kaydı "kim mağazayı kapattı", "eski gönderen neydi" sorusunu cevaplamıyordu; her basış satır yazıyordu; test e-postası `update` olarak yazılıyordu (SYS-12) | Her sekme yalnız değişen anahtarların önce / sonra değerini yazar; değişiklik yoksa ne kayıt ne satır; test e-postası `send_test` | `admin-settings-actions` |
| 🟢 | Kayıt sonucu 12 px, duyurulmayan bir satırdı ve eski "kaydedildi" düzenlemeden sonra da duruyordu (SYS-18) | Toast + `role="alert"`; form yazılınca eski başarı satırı gider | `admin-settings-form` |
| 🟢 | Saatler: 14 adsız saat kutusu, yedi aynı "Kapalı" (SYS-19) | Her gün adıyla bir grup, "Pazartesi açılış" gibi adlar, kitin 44 px alanı | `admin-settings-form` |
| 🟢 | SEO sekmesi bütün sayfaları yönettiğini söylüyordu (SYS-20) | "Ana sayfa başlığı", "Ana sayfa paylaşım görseli"; tarama kapatmanın Google'daki sayfaları kaldırmadığı yazılı | `admin-settings-form` |
| 🟢 | Jargon ve yanlış metin: env adları, doküman yolu, "siz", gerçek görünen yer tutucu, "anında uygulanır" (uygulama 5 dakikaya kadar önbellekten okur), "üstündeyse" (kod `>=`) (SYS-21) | Sade Türkçe; dağıtım işi "Geliştiriciye ilet" diye; "uygulamaya birkaç dakika içinde yansır"; "bu tutara ulaşınca … 0 yazarsan kapalı" | `admin-settings-form`, `supabase-service-role-visibility` |
| 🟢 | "Test gönder" yazılan değil kayıtlı göndereni deniyordu, hata İngilizce geliyordu, bant yenilenmiyordu (SYS-23) | Gönderen formu kaydedilmemiş değişiklik taşırken düğme nedeniyle kapalı; Resend retleri Türkçe (`resendErrorText`); test her sonuçta `revalidatePath` | `email-sender`, `admin-settings-actions`, `admin-settings-form` |
| 🟢 | Genel sunucuda yalnız ad uzunluğunu denetliyordu (SYS-25) | zod: https görsel, geçerli e-posta, uzunluk sınırları (ad 80, slogan 160, telefon 40, adres 500), alan başına mesaj | `admin-settings-actions` |
| 🟢 | Ayarlar'da `neutral` / `emerald` / `rose` sınıfları, italik başlıklar, gri kayıt satırı (KAR-06, KAR-17, SYS-24 ayarlar kısmı) | Kit `Section`, ton jetonları, servis anahtarı ve e-posta bantları kit tonlarında | `admin-settings-form` |
| 🟢 | Ayar formları yöntemsizdi: sayfa yüklenmeden basılan "Kaydet" alanları GET ile adrese yazıyordu (`?notificationEmail=…&orderNotifyEmails=…`: adres çubuğu, geçmiş, istek kaydı; kural 9) ve `?sekme=` düşüyordu (doğrulayıcı SS-F1) | Her sekmenin formu `method="post"`: alanlar gövdede gider, Next eylem kimliği taşımayan POST'u sayfayı yeniden çizerek karşılar, açık sekme kalır. O basışta kayıt yine yapılmaz; kaydeden, sayfa yüklendikten sonraki basıştır | `admin-settings-form` |
| 🟢 | Genel'in yeni denetimi kayıtlı eski bir değeri de reddediyordu: http:// bir görsel ya da 40 karakteri aşan bir telefon yüzünden "Online mağaza açık" kapatılamıyordu (doğrulayıcı SS-F2) | Kayıtlı hâliyle geri gelen alan denetlenmez ve yazılmaz; yalnız değişen alanlar zod'dan geçer, düzenlenen eski değer yine reddedilir | `admin-settings-actions` |
| 🟢 | Değişiklik olmadan basılan E-posta "Kaydet" durum bandını artık yenilemiyordu: Resend'de alan adını doğrulayıp dönen operatör 2 dakikalık önbellek yüzünden kırmızı bandı görmeye devam ediyordu (doğrulayıcı SS-F3) | "Değişiklik yok" cevabı da bandı yeniden okur (`forgetEmailHealth`, `revalidatePath`); kayıt ve olay satırı yine yok | `admin-settings-actions` |
| 🟢 | Panel içi bağlantıyla (kenar çubuğu) ya da ⌘K ile sayfadan çıkış kaydedilmemiş değişikliği sormuyordu; uyarı yalnız sekme kapatma ve yenilemedeydi | `useUnsavedFlag` (UI-17): sekmelerin zaten tuttuğu "kaydedilmemiş" bilgisi korumaya verilir; başka bir sayfaya giden bağlantı ya da palet girişi sorar, aynı sayfadaki sekme bağlantıları (`?sekme=`) sormaz. Sayfanın kendi `beforeunload` dinleyicisi gitti, aynı soruyu koruma sorar. Test e-postası formu ayar değil: kirli sayılmaz | `admin-unsaved-guard`, `admin-unsaved-guard-hooks`, `admin-settings-form` |

Karaoke sekmesi ve kaydı ayrı dosyalarda (`karaoke-tab.tsx`, `karaoke-actions.ts`;
karaoke iade kuralı işi onların üstüne kurulur).

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Kitin `ActionForm`'u da yöntemsiz `<form>`: sayfa yüklenmeden basılırsa alanları adrese yazar (SS-F1'in kit kısmı) | Kit dosyası (`action-form.tsx`) bütün panel formlarını etkiler; bu paketin dışında |

### Sistem: pano ve raporlar (paket 7b)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Personel panoda dükkânın net cirosunu görüyordu; rol tablosu ciroyu (Raporlar) yalnız sahip ve yöneticiye açıyor (SHE-14) | Ciro kartı ve 14 günlük grafik yalnız `reports` rolüne (karar D1); personel için ciro hiç okunmuyor | `admin-dashboard` |
| 🟡 | Panodaki ciro telefonda da masaüstünde de kartından taşıyordu (SHE-06); Raporlar'daki tutarlar 1024-1279 px'te yan karta giriyordu (SYS-15) | Ortak `StatCard` (`components/admin/dashboard/stat-card.tsx`): `min-w-0`, kitin rakam boyu, tutar kartın genişliğine göre küçülür (`cqi`) ve kesilmez; Raporlar ızgarası 2 / 3 / 5 sütun. 390, 1024 ve 1280 px'te çizilip bakıldı | `admin-dashboard`, `admin-reports-period` |
| 🟡 | Ciro grafiği telefonda 5 px yazıyla okunmuyor, eksen etiketlerinin ₺'si her genişlikte kesiliyordu; etiketler 3,95:1; tutarlar yalnız fareyle; satışsız dönemde ₺0,01 basamakları (SYS-14) | Tutarlar SVG değil HTML: eksen sütunu en uzun etiketi kadar, çizim yanında sabit yükseklikte; yuvarlak basamaklar (₺40.000); `--admin-text-soft`; her dilimin tutarı grafiğin altında tabloda ("Tutarları tablo olarak göster", başlıklı); satış yoksa "Bu dönemde satış yok." | `admin-revenue-buckets` |
| 🟡 | Raporlar'da kartlar ve en çok satanlar "Son 30 gün" seçiliyken tüm zamanları sayıyordu; liste paraya göre sıralı, çubuğu adede göreydi; liste iadeleri düşmüyor, tamamen iade edilmiş siparişi de sayıyordu (SYS-16) | Dönem kartlara ve listeye de uygulanır (grafiğin dilimleri, köşkün gece yarısı; veritabanı dönemin başından bir gün önceden okunur). Liste iadeyi sipariş başına düşer: önce "İptal" satırlardan, kalanı ayakta kalan satırlardan orantılı; sıralama ve çubuk aynı tutar; sayfada "Bu dönemde, liste fiyatıyla; iadeler düşülmüş" (karar D31) | `admin-reports-period`, `admin-order-reads` |
| 🟢 | Selamlama ve tarih sunucunun UTC saatini okuyordu: 07:00-08:59 "İyi geceler", gece yarısından sonra dünün tarihi (SHE-15, KAR-M02) | `Europe/Istanbul` (`src/lib/admin/dashboard-core.ts`) | `admin-dashboard` |
| 🟢 | Pano eski görünümdeydi: eğik serif, `neutral` / `amber` / `rose` bantlar (SHE-17, pano kısmı); kartlar bağlantı değildi (SHE-31, pano kısmı); "Acil dolum" 0'ın altında duruyordu, "Shop kategorileri", e-postanın baş kısmıyla selam ("İyi günler, info.") (SHE-22) | Kit kartları ve ton jetonları; her kart saydığı listeyi açar (Açık sekmesi, Dikkat süzgeci, stokta yok, Raporlar); ipucu yalnız sayı bir şey isterken; ürün ve kategori sayısı kartları kalktı; adsız selam (karar D35). Widget'lar `src/components/admin/dashboard/` altında: duruma göre açık siparişler, azalan stok (personel için stok sayfasına), hızlı erişim, son siparişler, 14 günlük ciro (karar D38) | `admin-dashboard` |
| 🟢 | Son siparişler elle yazılmış bir tabloydu, ödeme durumu yoktu (ORD-30, pano kısmı) | Kit `DataTable`: telefonda kart, ödeme rozeti, tutar iadeler düşülmüş | `admin-dashboard` |
| 🟢 | Pano kartı "bir işlem bekliyor" sayısını eski okumadan (bugün ve iade borçları) alıyordu (KAR-07, pano kısmı) | `loadKaraokeTodayCard`: Dikkat sekmesinin kümesi | `admin-dashboard`, `admin-karaoke-attention` |
| 🟢 | E-posta denetimi takılan bir Resend'i süresiz bekliyor, ayarlar okunamayınca panoyu düşürüyordu (SHE-29); "Ayarlar → E-posta" Genel sekmesini açıyordu (SHE-24, pano kısmı) | `AbortSignal.timeout(3000)` (sonuç "bilinmiyor", bant yok); pano denetimin hatasını yakalar; bağlantı `?sekme=email` | `email-health`, `admin-dashboard` |
| 🟢 | Raporlar'da hep boş bir "Dönüşüm" kartı, bir analiz aracı bağlanınca kendiliğinden dolacağını söylüyordu (SYS-17, SYS-22); başlık üstü "Operasyon · İçgörüler" (menüde "Satış"); kit dışı renkler, 2,59:1 sıra numaraları, 30 px dönem bağlantıları (SYS-24, raporlar kısmı) | Kart kalktı (karar D32); "Satış"; kit kartları, ton jetonları, kitin sekmeleri (`StatusTabs`); karaoke kartında önce dönem, tüm zamanlar ayrıca yazılı | `admin-reports-period`, `admin-reports-ltv` |

### Sistem: olay kaydı (paket 7c)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Sayfa ve yayımlanmış imha politikası kaydı "değiştirilemez (append-only)" diyordu ama `audit_logs` düz bir tabloydu; uygulama RLS'i aşan sahip bağlantısıyla bağlanır, her UPDATE ve DELETE geçerdi (SYS-13, karar D30) | `20261019170000_audit_logs_append_only.sql`: UPDATE ve TRUNCATE P0001 ile reddedilir; DELETE yalnız `createdAt`'i yazılı ve on yıldan eski satırda geçer, damgasız satır silinmez. İmha (`src/lib/retention.ts`, 10 × 366 gün) aynen çalışır. `createdAt` uygulamanın yazdığı ISO metni olarak kaldı (süzgeçler ve sıralama metin karşılaştırır) | `audit-logs-append-only-migration`, `db-integration-audit-append-only` (CI) |
| 🟡 | Sipariş CSV'si müşteri adlarını, e-postalarını ve tutarları indiriyor, iz bırakmıyordu (ORD-15) | Yeni `export` işlemi ("Dışa aktarma", kendi tonu); dosya hazırlanınca `safeAudit` kimin, hangi süzgeçle, kaç satır aldığını yazar; satır yazılamazsa dosya yine gider, yanıt aynı | `admin-order-csv` |
| 🟡 | "Ayrıntı" sütunu iç adları basıyordu: `before.shippingFlatMinor`, `owner, manager`, `cancelled`, İngilizce gün kısaltmaları, test e-postasının alıcısı "Yeni", "Kayıt" sütununda ayar bölümü kayıt numarası gibi ("general"); süzgeçte hiç yazılmayan "Reel" (SYS-10) | Her alan adı parça parça Türkçe ("Önceki · Kargo ücreti"), roller, sipariş ve karaoke durumları, ayar ve uygulama ayarı bölümleri, günler, dışa aktarma süzgeçleri listenin kendi sözleriyle; test e-postasında "Alıcı"; ayar satırı kendi sekmesine bağlanır (`?sekme=`, "email-test" E-posta'yı açar; 7a'da açık kalan bağlantı); "Reel" süzgeçten çıktı | `admin-audit-log` |
| 🟡 | 1024-1279 px'te "Kim" 25 px'e, değerler 34 px'e sıkışıyordu, tek olay 565 px boyundaydı; telefonda 10 olay 2.931 px (SYS-11) | "Kim" sabit 12rem, uzun adres "…" ile kesilir ve tamamı başlıkta; alan adı değerin üstünde; listede ilk üç alan, kalanı "+n alan daha" ile olayın sayfasında; telefon kartı sade. 390, 1024 ve 1280 px'te çizilip bakıldı | `admin-audit-log` |
| 🟢 | Sayfalama, ayrıntı sayfası ve dışa aktarma yoktu: her ziyaret 500 olayı iki kez çiziyordu (~2,4 MB HTML); değerler 300 karakterde kesiliyor, saatler saniyesiz (SYS-09) | Sayfa başına 50 olay, sayım ve kit `Pagination` (süzgeçler korunur); her olayın kendi sayfası (`/admin/olay-kaydi/<id>`: saniyesiyle zaman, kayda ve geçmişine bağlantı, her alan kısaltılmadan, ham JSON); yalnız sahibe (`audit`) süzgeçli "CSV indir": rota oturumu ve rolü kendi denetler, en çok 5.000 satır, dışa aktarmanın başladığı ana kadar, formül güvenli hücreler, kendisi de bir `export` satırı yazar | `admin-audit-log`, `admin-audit-csv` |
| 🟢 | "Admin mutasyonlarının değiştirilemez tarihçesi", başlık üstü "Denetim", başlık "Olay Kaydı" (menüde "Sistem", "Olay kaydı") (SYS-22, olay kaydı kısmı) | Sade Türkçe açıklama; "Sistem", "Olay kaydı". "Değiştirilemez" sözü tetikleyici geldiği için kaldı | `admin-audit-log` |

### İçerik: uygulama ayarları, canlı durum, slayt, duyuru, gönderi (paket 6b)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Uygulama ayarlarının dokuz sekmesi ve Canlı durum, React 19 `<form action>` sıfırlamasıyla reddedilen kayıtta yazılanı siliyor, kutuları yeniden işaretliyordu (CON-03 ve KAR-02, bu formlar) | Sekmeler elle gönderir (`useNoResetSubmit` + `withPanelCatch`), Canlı durum `ActionForm`; red alanın altında, kayıt toast | `admin-app-config`, `admin-venue-status` |
| 🟡 | Slayt, duyuru ve gönderi formlarında bekleme yoktu, ikinci tıklama ikinci satırı açıyordu; boş başlıkta ve silinmiş satırda kayıt sessizce dönüyordu, hata sayfası formu götürüyordu (CON-04) | `ActionForm` + `SubmitButton` (yanıttan önce ikinci gönderim düşer); boş başlık, tarih olmayan başlangıç ya da bitiş, başlangıçtan önceki bitiş alanın altında reddedilir; silinmiş satır söylenir | `admin-mobile-content-actions` |
| 🟡 | "Üyelere e-posta" (gönderide "Yayında", ayarlarda "Bakım modu") bir etiketin içindeydi: uzun ipucuna dokunmak üye e-postasını kapatıyordu (CON-05) | `Field as="fieldset"`, ipucu `aria-describedby` | `admin-mobile-content-lists`, `admin-app-config` |
| 🟡 | Listeler saklanan UTC metnini yazıyor, yayın durumunu göstermiyordu; süresi dolmuş ya da planlı satır yayındaki gibi görünüyordu (CON-08) | Kit tablosu ve satır menüsü; uygulamanın okuduğu kuralla durum rozeti (Yayında, Planlandı, Süresi doldu, Kapalı, Tarih geçersiz), `?durum=` sekmeleri, tarihler İstanbul saatiyle. Tarih olmayan metin olduğu gibi ve rozetle görünür, liste çökmez | `admin-mobile-content-lists` |
| 🟡 | "Bakım modu" ve "En düşük desteklenen sürüm" onaysız kaydediliyordu (CON-12) | Bakımın açılması ve sürümün yükselmesi önce sorar; karar sunucuda, kayıtlı belgeye göre verilir. Sürüm onayı yalnız o sürüm için geçer ve yeni sürüm yazılarak verilir; mağaza adresi boşsa diyalog bunu söyler. Sekmede "Bakımda" rozeti (karar D26) | `admin-app-config` |
| 🟡 | İçerik ekranlarında AA altı gri ve kırmızı metin: "YAYINDA DEĞİL", tarih satırları, Canlı durum hatası (CON-07) | Panel token'ları ve kit rozetleri | `admin-mobile-content-lists`, `admin-venue-status`, `admin-app-config` |
| 🟢 | Gönderi listesi kuyruğa alınamayan ya da kimseye gitmeyen e-postaya da "e-posta gönderildi" diyordu; işaretli kutu yayında olmayan gönderide sessizce atlanıyordu (CON-09) | Sütun kampanyanın kendi durumunu okur (Taslak, Kuyrukta, Gönderildi · N alıcı, Gönderilemedi) ve kampanyaya bağlanır; gönderideki işaret tekrar gönderim kilidi olarak kalır. Yayında olmayan gönderide kayıt toast'ı e-postanın gitmediğini söyler | `admin-mobile-content-lists`, `admin-campaign-mail-actions` |
| 🟢 | Ayarlar sekmeleri sekme değildi, telefonda yedisi gizli bir şeritteydi, adres sekmeyi tutmuyordu (CON-20) | ARIA sekmeleri (oklar, Home, End), `?bolum=`, `sm` altında seçim kutusu | `admin-app-config` |
| 🟢 | Hatırlatma kimliği deseni tarayıcının v bayrağında geçersizdi; kimliksiz satır "Kaydedildi" altında kayboluyordu; hata satırı söylemiyordu (CON-21) | Kaçışlı desen; metni olan kimliksiz satır reddedilir; her mesaj "Hatırlatma n ·" ile başlar ve alanın altına düşer | `admin-app-config`, `admin-reminder-hours` |
| 🟢 | Kayıt sonucu okunmuyordu, satırlarda adsız "Sil" ve "Düzenle" (CON-23) | `role="status"` / `role="alert"`, "Sil: <başlık>", satır menüsü başlığı taşır | `admin-mobile-content-lists` |
| 🟢 | Yeni ve düzenleme sayfalarında geri dönüş, "Vazgeç" ve silme yoktu; fA'L listesi 200'de sessizce kesiliyordu (CON-24) | Geri bağlantısı ve "Vazgeç"; silme düzenleme başlığında, sonra listeye döner. fA'L sayıyı ve daha eski bildirim varsa bunu söyler | `admin-mobile-content-lists`, `admin-mobile-content-actions` |
| 🟢 | Ham zemin anahtarları, "(karar 20)", yöneticiyi sahibin Ayarlar sayfasına yollayan ipuçları, "hemen kalkar" (uygulama içeriği paylaşılan önbellekten okunur: `s-maxage=60` ve `stale-while-revalidate`) (CON-25, KAR-12) | Türkçe adlar; ipuçları fiyatı ve saatleri sahibin belirlediğini söyler; silme "birkaç dakika içinde kalkar" der | `admin-mobile-content-lists`, `admin-app-config`, `admin-mobile-content-actions` |
| 🟢 | Gönderinin üye e-postası `mobileApp` yetkisiyle çıkıyordu, kampanya sayfası ise `newsletter` ister (CON-26) | Gönderi e-postası iki yetkiyi de ister, sunucuda ve formda (karar D27). Alıcı kuralı değişmedi: yalnız ticari ileti onayı kayıtlı üyeler (`campaign_email_audience`, `marketing`) | `admin-campaign-mail-actions`, `admin-mobile-content-lists` |
| 🟢 | Sürüm alanı Türkçe iPhone'da virgüllü ondalık klavye açıyordu; "mono" alanlar Poppins'ti (CON-27) | `inputMode="text"`; Team ID ve parmak izlerinde gerçek eşaralıklı yazı (`NUMERIC_STYLE`) | `admin-app-config` |
| 🟢 | Gönderi e-postası bandı adreste duruyordu (`?eposta=`): yenileyince ve silmeden sonra geri geliyordu (CON-29) | Sonuç kaydın toast'ı (`setAdminFlash`, gerekirse uyarı tonu) | `admin-campaign-mail-actions` |
| 🟢 | Gönderinin üye e-postasını tarayıcının kendi onay kutusu soruyordu: "TÜM üyelere" diyor, kaç kişi olduğunu söylemiyordu, tek "Tamam" yetiyordu (formlar incelemesi, #148) | Kitin diyalog çerçevesinde soru: pazarlama izni olan üye sayısı (kuyruğun okuduğu sayım) ve sayı geri yazılınca açılan "Kaydet ve gönder"; sayılamazsa söyler ve GÖNDER yazdırır. Kampanya sayfasındaki "Gönder" ile aynı adım (karar D15); evet yalnız bir kaydı geçirir, reddedilen kayıt yeniden sorar | `admin-post-mail-confirm`, `admin-mobile-content-lists` |

Aynı PR'da gelenler: ayarlar ve Canlı durum kayıt çubukları kit token'larıyla,
bölüm başlıkları kitin `Section`'ı (italik değil) (KAR-06, KAR-17); satırlarda
"Düzenle" ve "Sil" kit satır menüsünde, haplar kit rozeti (CON-19). Kenar
çubuğunda giriş başına simge (CON-19) ve sayfa iskeleti `admin/loading.tsx`
(CON-24) kabuk gezinme PR'ında (#142) geldi.

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Raporlarda tarih aralığı, önceki döneme göre karşılaştırma, dışa aktarma ve kırılımlar (kanal, ödeme, kategori, saat) yok (SYS-17, özellik kısmı) | Ayrı bir özellik işi; gösterilen hiçbir rakam yanlış değil |

| 🟢 | Slayt, duyuru ve gönderide süresi dolan içerik için toplu aç/kapa yok (CON-24; sıra 21 Eki 2026'da ↑ / ↓ ile geldi, "Panel: güvenlik ve CRUD turu") | Toplu işlem bu turun dışında |

### Karaoke ve masalar (paket 3a)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Pano kartı "bir işlem bekliyor" sayısını yalnız bugünkü satırlardan ve iade borçlarından sayıyordu: dünden kalan, ödenmiş ama hiç onaylanmamış (para köşkte) rezervasyon ya da yarınki eski köşkte ödeme talebi Dikkat sekmesinde vardı, panoda yoktu (KAR-07) | `listKaraokeAttention` (`src/lib/mobile/karaoke.ts`): ödeme durumuna göre dört küçük okuma (`refunding`; `paid` ve talep ya da iptal; `pending`; `none` ve bugünden sonraki talep) ve ödenmiş taleplerin günlerindeki onaylı rezervasyonlar (saat başkasında mı). Dikkat sekmesi ve sayısı bunu okur; pano kartı için `loadKaraokeTodayCard` (`src/lib/admin/karaoke-today.ts`) hazır, panonun ona geçmesi paket 7b'de | `admin-karaoke-attention`, `admin-karaoke-pages` |
| 🟢 | Dikkat panelin en yeni 5000 satırından hesaplanıyordu: liste büyüdükçe eski bir iade borcu sekmeden düşecekti (KAR-25, Dikkat kısmı) | Dikkat kendi okumasıyla (yukarıda); okuma düşerse eski davranış (listenin satırları) | `admin-karaoke-attention`, `admin-karaoke-pages` |
| 🟢 | Saati geçmiş bir talep elle yazılmış bir POST ile onaylanıyor ve müşteriye onay e-postası gidiyordu; geçen haftanın köşkte ödenecek rezervasyonunu "İptal et" müşteriye günler sonra iptal e-postası atıyordu (KAR-13) | `confirmReservationAction` saati geçmiş rezervasyonu reddeder (ödemenin kendi onayı etkilenmez). Saati geçmiş, köşkte ödenecek rezervasyonun panelden iptali e-posta göndermez (`setReservationStatus` `notify: false`), olay kaydına `ended: true` yazar; diyalog ve geçmiş bunu söyler. Yeni durum yok, mobil API değişmedi (karar D7) | `admin-karaoke-actions`, `karaoke-ended-cancel`, `admin-karaoke-panel` |
| 🟢 | Rezervasyon sayfası geçmişi (olay kaydı) okunamayınca bütünüyle hata ekranına düşüyordu, para düğmeleri de onunla (KAR-15) | Geçmiş ayrı okunur; okunamazsa "Geçmiş okunamadı" ve satırın kendi anları görünür, düğmeler durur. Bırakılmış tutma o durumda "Ödenmedi" değil "Ödeme doğrulanamadı" olur ve PayNkolay'a bakmayı söyler (kural 29) | `admin-karaoke-pages` |
| 🟢 | Rezervasyon sayfasının geri bağlantısı sekmeyi ve süzgeçleri unutuyordu (KAR-20; boş durumdaki "Sıfırla" kısmı çürütüldü, süzgeç çubuğunda zaten var) | Liste adresi `?geri=` ile taşınır; yalnız karaoke listesinin kendisi kabul edilir (`sameSitePath`, kural 26) | `admin-karaoke-pages` |
| 🟢 | Kapıda sorulan kod listede 1280 px altında görünmüyordu, telefon kartında hiç yoktu; tablet dikeyde kişi sayısı kayboluyordu (KAR-11). Uzun bir e-posta tabloyu kartından taşırıyordu (KAR-03, sütun kısmı) | Kod ilk hücrede ve kartta; kişi ve süre `xl` altında ilk hücrede; müşteri sütununa en çok genişlik; uzun ödeme rozeti tabloda iki satıra kırılabilir, POS sütunu yalnız gizli referans. 768, 1024, 1280, 1366 px'te tablo kartına sığıyor | `admin-karaoke-pages` |
| 🟢 | Tutar, kod ve POS referansı orantılı Poppins'le yazılıyordu (KAR-18, karaoke kısmı) | `NUMERIC_STYLE` | `admin-karaoke-pages` |
| 🟢 | "Belgeler"de slug, "₺3.300,00, indirim ₺300,00", başlık üstü "Rezervasyon" (menüde "Satış"), "mekân" ile "köşk" karışık (KAR-21); "Ayarlar → Karaoke" Genel sekmesini açıyordu (KAR-12, bağlantı kısmı); telefonda uzun açıklama (KAR-10, açıklama kısmı) | Belgenin adı (`/hukuk/...` bağlantısı; kayıt slug'ı tutar), "Liste ₺3.300,00 · indirim ₺300,00", "Satış · Karaoke", "Köşkte ödeme"; bağlantı `?sekme=karaoke` (Ayarlar sekmeyi adresten açar); kısa açıklama | `admin-karaoke-pages` |
| 🟢 | Masa formu reddedilince yazılan adı siliyor, veritabanı hatasında panelin hata ekranına düşüyordu (KAR-14) | `ActionForm`: ret alanın altında, yazılan kalır; atılan hata "Bir hata oldu…". Yazımdan sonraki olay kaydı hata atmaz (`safeAudit`): kaydı yazılamayan yeni masa yine kendi sayfasını açar, ikinci basış aynı masayı ikinci kez eklemez | `admin-cafe-tables-actions`, `admin-cafe-tables-pages` |
| 🟢 | Masalar kartında 12 px bağlantılar ile 16 px düğmeler bir arada (KAR-05), her kartta aynı adlı düğmeler, "Kopyalandı" duyurulmuyordu (KAR-22), elle seçilmiş emerald / neutral rozet (KAR-17), formlarda geri yolu yoktu, tek kart yazdırılamıyordu (KAR-24) | Masalar kitte: Tümü / Aktif / Pasif sekmeleri, arama (ad ya da kod), satır başına "⋯" menüsü; yeni masa sayfası `/admin/masalar/[id]` (QR, bağlantı, bilgiler, tek boy düğmeler); her tekrarlanan düğme masanın adını taşır, kopyalama canlı bölgeyle duyurulur; kit rozeti; formlarda "← Masalar" ve "Vazgeç"; `yazdir?masa=<id>` tek kartı basar | `admin-cafe-tables-pages`, `admin-confirm-ui` |

Açık (paket 3a'nın dışında kalan):

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Karaoke listesi her istekte en çok 5000 satırı okuyup sekmeleri, sayıları ve sayfaları bellekte hesaplıyor (KAR-25, Dikkat dışı kısım) | Tek oda için yılda birkaç bin satır; sekme sorgularını ve sayfalamayı SQL'e taşımak beş sekmenin sayısını da ayrı sorgular ister. Sayfa sınıra gelince söylüyor; Dikkat artık sınırdan etkilenmiyor |

### Karaoke iptal ve iade kuralı panelden (paket 3b, P2a)

Operatör (17 Eki 2026): "para tutarı iade edilir kısmını da panelden ayarla".

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | İptal kuralı koddaydı (2 saat, geç iptalde iade yok); panelden değişemiyordu | Ayarlar → Karaoke (yalnız sahip): ücretsiz iptal 0-72 saat, geç iptalde iade %0-100, Türkçe zod mesajları, haksız şart sınırları (%0 iken en çok 24 saat; 24 saatten uzunsa ya da 0 saatse en az %50), iki cümlenin canlı önizlemesi, "yalnız bundan sonra yapılan rezervasyonlara" notu | `admin-karaoke-cancel-policy`, `karaoke-cancel-policy` |
| 🟡 | Kural değişseydi eski rezervasyonlar da yeni kuralla iptal ve iade edilirdi | Her rezervasyon kuralını, son tam iade anını ve gördüğü iki cümleyi saklar (`20261018130000_karaoke_cancel_policy.sql`; `NULL` = 2 / 0); süre, cümle, iade ve mail o kayıttan okunur. Onay kaydı gösterilen belge sürümünü yazar | `karaoke-late-cancel`, `karaoke-cancel-policy`, `db-integration-karaoke-prepay` |
| 🟡 | Kısmi iade POS'tan gidemiyor (PayNkolay yalnız tam iade) | Karar D9: %100 POS'tan tam iade (kural 29 geri alması aynı); %1-99 rezervasyonu iptal eder, payı `refunding` + `refundMinor` olarak borçlar, ekibe mail gider, panel yalnız "Elle iade edildi" sunar; köşk iptali her zaman tam iade | `karaoke-late-cancel`, `admin-karaoke-cancel-policy`, `db-integration-karaoke-prepay` |
| 🟢 | Ciro geç iptal payını bilmiyordu | İade edilen pay düşülür, kalan pay ciro; borçlu pay "iadesi bekleyen" | `admin-reports-ltv` |
| 🟡 | Ödenmiş ama köşkün hiç onaylamadığı rezervasyonda (saat başkasına geçti, onay yarım kaldı) üyenin geç iptali payı uygulardı | Geç iptal payı yalnız onaylı rezervasyonda; onaylanmamış ödenmiş rezervasyon tamamen iade edilir (MSY m.16/4, TBK m.136) | `karaoke-late-cancel` |
| 🟡 | Kural sayfa açıkken değişirse rezervasyon müşterinin görmediği kuralla kaydedilirdi | Web formu ve uygulama gösterdikleri kuralı `expectedCancelPolicy` ile gönderir; farklıysa **409** `policy_changed`, yeni kural gövdede, rezervasyon yazılmaz (`expectedTotalMinor` deseni) | `karaoke-late-cancel`, `karaoke-web-action`, `mobile-karaoke-prepay-routes`, `frontend-form-contract` |
| 🟢 | Karaoke koşullarının Yasal belgeler'de yayında bir düzenlemesi varken kural değişebiliyordu: sitede ve uygulamada düzenlenmiş eski metin görünür, onay ise kuralın kayıt gününü yazardı | Yayında düzenleme varken kural 2 saat / %0 dışına çekilemez, önce düzenleme yayından kaldırılır (tablo okunamazsa kayıt da olmaz); varsayılana dönüş ve kuralı değiştirmeyen kayıt serbest | `admin-karaoke-cancel-policy` |
| 🟡 | Son ücretsiz iptal anının kendisi (`cancellableUntil`, ör. 18:00:00) sunucuda geç sayılıyordu (`now < deadline`): sözleşme "tam iade alabileceği son an", karaoke koşulları "bu an dahil" der (ASK-Y3-4) | `withinFreeCancel` son anı ve sayfaların yazdığı dakikanın tamamını süreye sayar (`karaokeFreeCancelEnd`: 18:00 son an ise 18:00:59'a kadar tam iade, 18:01'den sonra geç iptal; başlangıç hiçbir zaman süreye girmez, `cancellableUntil` değeri değişmedi); üyenin, bağlantı sahibinin ve hesap kapanışının iptali aynı fonksiyondan geçer; ödeme öncesi kutu ve rezervasyon sayfası "son an: 30 Ekim 2026, 18:00." yazar ("öncesi" kalktı) ve saati 18:00 gösteren üyeye söz tutulur. Cümleler değişmedi (TKHK m.5/4: iki anlama gelen şart tüketici lehine okunur) | `karaoke-late-cancel`, `karaoke-cancel-policy`, `karaoke-prepay-rules`, `karaoke-wizard` |

Açık (paket 3b'nin dışında kalan):

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟡 | Yalnız 2 saat / %0 kaydedilebiliyor (uygulama kilidi) | Yayındaki uygulama sürümleri rezervasyon ayrıntısında ve iptal adımında kendi sabit cümlelerini yazıyor; kilit `KARAOKE_POLICY_APP_VERSION` ve en düşük sürümle açılır (lafmobil izleme PR'ı, API-MOBILE §7.1). Açmadan önce kuralı kendi cümleleriyle anan beş belge (`iade-ve-cayma`, `odeme-kosullari`, `veri-saklama-ve-imha-politikasi`, `hesap-silme`, `kafe-hizmet-kosullari`) karaoke belgesine yönlendirilmeli (`karaoke-cancel-policy-doc` testi tutar). Sitenin iki karaoke ekranı artık rezervasyonun kuralını yazıyor (aşağıda, KW) |

### Karaoke rezervasyon sihirbazı ve KDV satırı (KW, 18 Eki 2026)

Operatör (18 Eki 2026): "karaoke sayfasını da mobile ve masaüstüne uygun yap ödeme esnasında kdv dahil olan kısımda kdv miktarı otomatik yazsın ... oraya da bir wizard hazırla". Paket 3c (karaoke-refund-policy-web) bunun içinde. Yalnız ön yüz.

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟢 | Web rezervasyon sayfası ve ödeme öncesi kutu kuralı sabitlerden yazıyordu (3b'nin açık satırı) | Ödeme öncesi kutu sunucunun cümlelerini (`availability.cancellationRules`), son ücretsiz iptal anını tarih ve saatle (sayfa açıldığında o an geçmişse "ücretsiz iptal süresi geçti"), geç iptal payının tutarını yazar ve yazdığı sayıları geri yollar; rezervasyon sayfası kendi kaydındaki cümleleri, son anı (kendi gününde) ve iptalin ne getireceğini (tam, pay, yok, ret) sunucunun hesabıyla yazar; geç iptal reddinin bildirimi rezervasyonun cümlesi (`karaokeNoticeFor`). Ret adımında "Gelemeyeceksen rezervasyon kodunu bir başkasına verebilirsin; odayı o kullanır." | `karaoke-wizard`, `karaoke-prepay-rules`, `karaoke-web-action` |
| 🟢 | Toplamın yanında yalnız "%20 KDV dahil" yazıyordu, KDV tutarı yoktu | `kdvIncludedNote` (ön yüz, saf): oran sunucudan, tutar `kdvOfGross` ile kuruşa yuvarlanır: "%20 KDV dahil (KDV 166,67₺)"; oran yoksa yalnız "KDV dahil", %0'da "%0 KDV". Özet kartında, ödeme öncesi kutuda, Ödeme adımında, telefon çubuğunda ve rezervasyon sayfasında, küçük ve soluk | `karaoke-wizard`, `home-karaoke` |
| 🟢 | Rezervasyon tek uzun formdu; telefonda toplam ve düğme sayfanın sonundaydı | Beş adım (Tarih ve saat, Süre ve kişi, Bilgilerin, Özet ve onay, Ödeme; köşkte ödenen istekte dört), her adım geçmeden denetlenir, adım göstergesi `aria-current="step"` ve canlı bölge, tarayıcının geri tuşu bir adım geri (`?adim=`, kişisel veri yok), yenileme yazılanları tutar (bu sekmede, kutular hariç, gönderince silinir, reddedilen gönderimden sonra yeniden yazılır; adresin `?saat=`'i eski taslağın saatini ezer). Reddedilen gönderim kutuları boşaltmaz (elle gönderim, React'in form sıfırlaması yok); Geri bir önceki adıma gider, geri atlamadan sonra da. Masaüstünde özet yanda yapışkan, telefonda toplam ve düğmeler alt çubukta (sekme çubuğunun yerinde, güvenli alan payıyla). JavaScript'siz sayfa yine tek form | `karaoke-wizard`, `frontend-form-contract` |
| 🟢 | Satıcı satırında unvan ve vergi numarası yoktu (MSY m.5/1-b) | "Satıcı: {unvan} (L'Affogato), VKN {numara}, {adres}, {telefon}." (`LEGAL_ENTITY`'den sayfa verir; boşsa düşer) | `karaoke-wizard` |

### Kabuk: gezinme, arama, içerik haritası (paket 1c)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Kenar çubuğunda grup başlıkları, "Admin" etiketi ve rol adı `neutral-400` idi: beyazda 2,59:1 (SHE-05) | Panelin `--admin-text-soft` rengi (8,88:1) | `admin-shell-nav` |
| 🟡 | Veritabanı yanıt vermeyince oturum denetimi hata fırlatınca (paket 1d) layout bu hatayı yakalayamazdı: `admin/error.tsx` kendi bölümünün layout'unu yakalamaz, operatör sitenin hata sayfasına düşerdi (SHE-11, layout kısmı) | Layout `ADMIN_SESSION_UNAVAILABLE` hatasını (işaretinden ya da kodundan, `isAdminSessionUnavailable` gibi) yakalar, panel zeminini "Oturumun şu an doğrulanamıyor" bildirimiyle çizer; sayfa kendi hatasını panelin hata ekranına atar. Başka hata yine fırlar. 1d inene kadar uyur | `admin-shell-nav` |
| 🟢 | Kenar çubuğu sitenin yeşilini ve gri paleti kullanıyordu; Mobil Uygulama'nın altı girişi aynı telefon simgesini çiziyordu (SHE-18, CON-19); "Mağaza Hero" (SHE-22, menü kısmı) | Panel token'ları (etkin giriş `--admin-primary` üstünde `--admin-primary-soft`); bölümü paylaşan her girişin kendi simgesi (`NavItemDef.icon`); "Mağaza vitrini" | `admin-shell-nav`, `admin-karaoke-panel` |
| 🟢 | Telefondaki menü çekmecesi diyalog değildi: odak arkada kalıyor, Esc çalışmıyor, arkadaki sayfa geziliyordu; düğme `aria-expanded` taşımıyordu; menü düğmesi 36, kapatma 32 px'ti (SHE-13, SHE-M03) | Yerel modal `<dialog>` (`showModal`): Esc ve arka plan kapatır, odak açan düğmeye döner, arkadaki sayfa etkisiz ve kaymaz; düğmede `aria-expanded`, `aria-controls`, `aria-haspopup`; iki düğme 44 px. Ekran genişleyip masaüstüne geçince çekmece kapanır | `admin-shell-nav` |
| 🟢 | Fişsiz bir sayfa yazdırılınca kenar çubuğu, üst çubuk ve çekmece de basılıyordu (SHE-08, kabuk kısmı) | Üçünde `print:hidden`, içerik sütununda `print:pl-0` | `admin-shell-nav` |
| 🟢 | Kasiyer logoya ya da "Panele dön"e basınca `/admin`'den sessizce `/admin/kasa?denied=1`'e atılıyordu; 2FA kurulumuna giden tek bağlantı kasiyerin göremediği panodaydı (SHE-25) | Logo ve hata / 404 ekranlarındaki "Panele dön" rolün açılış sayfasına gider (`landingPathFor`, `PanelHomeLink`); `?denied=1` yalnız panoda değil, kabukta her açılış sayfasında bir kez uyarı toast'ı olur ve adresten silinir; hesap bloğunda her rol için "Güvenlik / 2FA" | `admin-shell-nav`, `admin-panel-shell` |
| 🟢 | Karaoke ve sipariş rozeti işlemden sonra bir dakikaya kadar eski sayıyı gösteriyordu (KAR-23) | Rozet `admin:changed` olayında hemen yeniden okur; okuma sürerken gelen değişiklik okuma bitince bir kez daha okunur | `admin-shell-nav` |
| 🟢 | Sipariş rozeti "Açık" sekmesini sayıp "Tümü"nü açıyordu (ORD-21, rozet kısmı) | Rozet satırın yanında kendi bağlantısı: `/admin/siparisler?durum=acik`, 24 px dokunma alanı | `admin-shell-nav` |
| 🟢 | Kenar çubuğunda bir girişe basınca sunucu yanıtlayana kadar hiçbir şey olmuyordu (SHE-12; CAT-08, PEO-23, CON-24 iskelet kısmı) | `admin/loading.tsx` sayfa iskeleti (azaltılmış harekette nabız yok); tıklanan girişte `useLinkStatus` ile solan çizgi | `admin-shell-nav` |
| 🟢 | Yanlış yazılmış ya da eskimiş bir `/admin` adresi sitenin 404'ünü, panelsiz gösteriyordu (SHE-20) | `admin/[...rest]/page.tsx` `notFound()` çağırır: panelin kendi 404'ü ("Bu sayfa ya da kayıt bulunamadı."); gerçek sayfalar ve CSV / QR uçları yine önce gelir | `admin-shell-nav` |
| 🟢 | Panelde genel arama, içerik haritası ve katlanır menü yoktu (SHE-31, P2b) | `/admin/ara` (karar D36): sipariş (numara, e-posta, ad, telefon), üye, ürün, menü ürünü, karaoke kodu; her bölüm rolün açabildiği bölüme bağlı (personel üye tablosunu hiç okumaz, kasiyer hiç sorgu göndermez), bölüm başına 5 sonuç ve listeye bağlantı, salt okuma, yeni dizin yok. Türkçe katlama SQL'de iki yanda (`foldLike`: `lower(translate(...))`; ILIKE "İsmail"i "ismail" ile bulmuyordu). Kutu POST eder (`adminSearchAction`, kalıcı adresi `/admin/ara`): yazılan e-posta ya da telefon adrese, tarayıcı geçmişine ve istek kayıtlarına düşmez (`?q=` düşürürdü); JavaScript'siz form sonuç sayfasına gönderilir ve sayfa yanıtla çizilir, JavaScript'le üst çubuktaki metin sonuç sayfasına bellekte geçer. Veritabanı yanıt vermezse "Arama şu an yapılamadı" der, kutudaki metin kalır; telefonda arama bağlantısı. İçerik haritası menü girişlerinden ("Siparişler / Ayrıntı", "Ürünler / Düzenle"); gruplar katlanır, seçim tarayıcıda kalır, açık sayfanın grubu hep açık. Üst çubukta aramadan sonra tek bir denetim yuvası (yeni sipariş uyarısı oraya) | `admin-search`, `db-integration-admin-search`, `db-sql`, `admin-shell-nav` |
| 🟢 | Arama sayfası `?denied=1`'i açılış adresine düz metinle ekliyordu: sorgusu olan bir açılış adresinde ikinci bir `?` olurdu (bugünküler sorgusuz, kırılmıyordu) | `withDenied()` (`URLSearchParams`). `requireRole`'daki aynısı (`src/lib/admin/auth.ts`, paket 1d'nin dosyası) yerinde kaldı | `admin-shell-nav` |
| 🟢 | Hata ekranındaki "Tekrar dene" `reset` ile yalnız çökeni yeniden çiziyordu: veritabanı tökezlemesinden sonra aynı ekran dönüyordu | Next 16.3'ün `retry`'ı: sayfa sunucudan yeniden istenir | `admin-shell-nav`, `admin-panel-shell` |

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Masaüstü üst çubuğu sayfayla kayar (telefondaki sabit kalır) | Sabit olsaydı sayfaların kendi yapışkan öğeleri (sipariş listesindeki yeni sipariş bandı `top-2`, kampanya sayfasının yan sütunu `top-6`) altında kalırdı; o dosyalar kendi alanlarının PR'larında |
| 🟢 | Aramada müşteri bölümü yalnız üye hesaplarını tarar; üye olmayan alıcı sipariş bölümünde adıyla bulunur. İçerik haritası kaydı adıyla değil "Ayrıntı" diye anar | Misafir müşterinin ayrı kaydı yok (müşteri listesi siparişlerden toplanır); kaydın adını haritaya taşımak her sayfanın veriyi kabuğa vermesini ister |

### Kabuk: giriş, 2FA ve oturum (paket 1d)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Veritabanı bir an tökezleyince panel kullanıcısı çıkış yapmış sayılıyordu: hesap sorgusu hatayı yutup "hesap yok" diyordu; sayfa giriş ekranına, kayıt sırasında form da yazılanlarla birlikte gidiyordu (SHE-11) | Oturum denetimi panel satırını hata fırlatan bir sorguyla okur (`auth.ts`; `users.ts` ve girişin acil durum yolu değişmedi). Okunamazsa `AdminSessionUnavailableError` (kod `ADMIN_SESSION_UNAVAILABLE`, `isAdminSessionUnavailable`) `getAdminSession` ve `requireRole`'dan geçer: sayfa panelin hata ekranına, panel işlemi formun kendi cevabına düşer, çerez kalır. Ortam değişkeni hesabının açık oturumu veritabanı yokken de sürer (yeni giriş veritabanı ister: 2FA kaydı okunamazsa giriş yapılmaz); aynı adresteki panel satırına verilmiş oturum "çıkış" değil "ulaşılamıyor" sayılır. Oturum yalnız denetlenen kimlik bilgisine verilir: panel parolasıyla yapılan girişe, şifre ya da 2FA adımında satır okunamadı veya arada pasifleştirildi diye aynı adresin ortam değişkeni kaydının oturumu verilmez (rol aynı olsa da; bekleyen 2FA çerezi kaynağı taşır). Giriş ve 2FA adımı "tamamlanamadı" der, `login_fail` yazılmaz. Kabuk (layout) bu hatayı yakalayıp bildirimle çizer (#142, paket 1c) | `admin-session-unavailable`, `admin-env-signin-outage`, `admin-login-form` |
| 🟡 | 2FA kurulum sayfası her açılışta yeni sır üretiyordu: yenileme, ikinci sekme ya da panoya gidip dönmek taranmış QR'ı geçersiz kılıyor, red mesajı telefonun saatini suçluyordu; "Vazgeç" de yeni QR gösteriyordu (SHE-09) | Taslak 15 dakika aynı gösterilir, sonra yenilenir. İki yazım da okunan satıra koşullu: başka sekmede açılan 2FA geri kapanmaz, aynı anda açılan sekmeler tek sırda buluşur. "Vazgeç" taslağı siler ve rolün açılış sayfasına gider; red mesajı yeniden taramayı söyler. `startEnrollment` yalnız sayfadan çağrılır | `admin-2fa-draft`, `db-integration-2fa-draft`, `admin-2fa-screens`, `admin-2fa-enrollment` |
| 🟢 | 2FA'yı kapatmak hiçbir şey söylemiyordu, sayfa yeni QR çiziyordu; hata `?hata=kod` ile adreste kalıp her yenilemede dönüyordu; kontroller kit dışıydı (SHE-26) | Kapatınca uyarı toast'ı ve rolün açılış sayfası; yanlış kod ve kilit tehlike toast'ı. Güncel kod şartı ve iki deneme bütçesi aynı. Açınca da toast ve açılış sayfası: başarı bağlantısı kasiyeri `/admin`'e, oradan da geri yolluyordu (SHE-25). Olay kayıtları `safeAudit` | `admin-2fa-screens` |
| 🟢 | Reddedilen girişte e-posta da siliniyordu (React 19 form sıfırlaması) (SHE-M01) | Form elle gönderilir (`useNoResetSubmit`); e-posta kalır, şifre temizlenip odaklanır | `admin-login-form` |
| 🟢 | Giriş, uzunluğu ve biçimi denetlenmeyen e-postayı deneme sayacının anahtarına ve olay kaydına yazıyordu (SHE-28) | 254 karakterden uzun ya da `@` içermeyen adres hiçbir şey sayılmadan ve yazılmadan reddedilir | `admin-login-form` |
| 🟢 | Yeniden girişte filtreler kayboluyordu: proxy `next`'e yalnız yolu yazıyor, sorguyu (ör. müşteri e-postası) giriş adresinin kendisinde bırakıyordu (SHE-30) | Sorgu `next`'in içinde, giriş adresinde başka parametre yok. Her `next` `adminNextPath`'ten geçer (`sameSitePath`, çözülmüş yol, yalnız panel, giriş adımları değil); 2FA adımı `next` yoksa rolün açılış sayfasına gider | `admin-proxy-2fa`, `admin-next-path`, `admin-login-form`, `admin-2fa-screens` |
| 🟢 | Çıkış, olay kaydı yazılamazsa (veritabanı yok) hata verip oturumu açık bırakıyordu (SHE-M02) | Önce çerez silinir, kayıt sonra `safeAudit` ile | `admin-logout` |
| 🟢 | Giriş sayfası unutulan şifre için "ortam değişkenlerine erişimi olan yöneticiye" yolluyordu ve başlığı yoktu; 2FA kod alanının adı yalnız yer tutucusuydu, yanlış kod okunmuyordu; ekranlar eski palette ve eğik serif başlıktaydı, "authenticator" yazıyordu (SHE-21, SHE-23, SHE-17, SHE-22, SHE-05) | "Şifreni unuttuysan işletme sahibinden sıfırlamasını iste."; `sr-only` başlık; kod alanında `aria-label`, hatada `role="alert"`; kit alanları, düğmeleri ve ton token'ları; "doğrulama uygulaması" | `admin-login-form`, `admin-2fa-screens` |
| 🟢 | 2FA sayfası "telefonunu kaybedersen önce buradan kapat" diyordu; kapatmak o telefondaki kodu ister (SHE-10 metni) | Metin sahibin Kullanıcılar sayfasındaki sıfırlamasını gösterir; tek sahip için veritabanı yolu `docs/DATABASE.md` "Panel: 2FA'lı telefon kaybolursa" | `admin-2fa-screens` |

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Oturum 7 gün sürer; çıkış yalnız o tarayıcının çerezini siler, kopyalanmış çerez süresi bitene kadar geçerli (SHE-27) | Karar D33: şimdilik değişmez. Parmak izi parola sıfırlama, pasifleştirme ve rol düşürmede oturumu zaten kapatır; çıkışta da kapatmak oturum sürümü kolonu (migration) ister |
| 🟢 | 2FA kurtarma kodları yok (SHE-10) | Karar D40: şema değişikliği, sonra. Şimdilik sahibin sıfırlaması ve veritabanı yolu |
| 🟢 | `requireRole` iptal edilmiş oturumu girişe `next` olmadan yollar (SHE-30'un isteğe bağlı kısmı) | Sunucu bileşeni sayfanın adresini bilmez. Eksik ve süresi dolmuş çerezi proxy zaten `next`'le yollar; bu yol yalnız pasifleştirilen ya da parolası sıfırlanan hesap için |

### Sipariş satırı: varyantlı ürün varyant ister (VL)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟠 | Aktif varyantı olan ürün `variantId`'siz satırla da satılıyordu: taban fiyattan ücretleniyor, birimi yalnız ürün toplamından düşüyordu (hiçbir varyant onu geri vermiyordu). Mağaza kartının hızlı "sepete ekle"si böyle satır gönderiyordu, manuel siparişteki "Varsayılan" seçeneği de | `resolveOrderLines` böyle satırı stok ayrılmadan, fiyat ve stok değişmeden reddeder (`not_found` + `variantRequired`; her çağıran `not_found`'u zaten karşılıyor). Web ödeme sayfası "<ürün> için bir seçenek seç. Sepetten çıkarıp ürün sayfasından seçerek yeniden ekle." der, panel ürün listesinin altında "<ürün> için bir varyant seç.", uygulama mevcut **400** `invalid_line` alır ("<ürün> için bir seçenek seç. Sepeti güncelle."; yeni hata kodu ya da durum kodu yok, uygulama onu `line_not_found` gibi sepete döndürür). Bütün varyantları pasif ürün varyantsız ürün gibi satılır: hiçbir yüzey (web, `/shop`, panel) pasif varyant sunmaz. Manuel siparişte "Varsayılan" kalktı: ürün seçilince stoktaki ilk varyantı gelir, ürünü yalnız varyantlarının stoğu satılabilir yapar | `order-variant-lines`, `checkout-action`, `admin-order-actions`, `admin-manual-order` |

Daha önce varyantsız satılmış birimlerin ayırdığı toplam için sihirbazın
"Toplamı aktif varyantlara eşitle" kutusu duruyor. Kartın varyantlı üründe
ürünü açması ön yüz işidir (paket 5b). Ret ondan bağımsızdır: varyantsız satır
nereden gelirse gelsin (kart, eski bir sepet, elle yazılmış istek) ödeme
sayfası onu adıyla reddeder, taban fiyattan satmaz. İki PR ayrı birleşir;
`order-variant-lines` testi bu belgede sunucu reddini hâlâ bekleyen bir
"Açık" satırı kalmasına izin vermez.

Uygulama (lafmobil, okundu, değişmedi): ürün sayfası her zaman bir varyant
gönderir (stoktaki ilki varsayılan), hızlı ekleme varyantlı ürünü açar. İki
yol yine varyantsız satır gönderebilir: "Tekrar sipariş" (`siparislerim.tsx`,
ürün o siparişten sonra varyant aldıysa) ve ürün varyant almadan önce sepete
girmiş satır. İkisi de artık `invalid_line` alır ve sepete döner; uygulamada
ayrı bir PR bu satırları baştan ürün sayfasına yönlendirmeli.

### Kişiler: web'de hesap silme ekibe talep olarak gider (18 Eki 2026)

Operatör kararı: "hesabı silme sadece bize ulaşarak olsun". Uygulamadaki
"Hesabımı sil" (`DELETE /api/mobile/v1/me`) değişmedi: Apple 5.1.1(v)
uygulama içi silmeyi ister, düzenlenmiş sektör dışındaki uygulamaya
müşteri hizmetleri yolu kapalı; Google Play hem uygulama içi yolu hem web
talep sayfasını ister (`/uye/hesap/sil` artık o sayfa).

| Derece | Değişiklik | Nasıl | Test |
| --- | --- | --- | --- |
| 🟠 | Site hesabı üyenin tıklamasıyla siliyordu (`deleteAccountAction`, herkese açık POST ucu) | Uç kalktı. `/uye/hesap/sil` talep gönderir: isteğe bağlı gerekçe (500 karakter), işaretsiz "Hesabımın silinmesini istiyorum". Talep satıra yazılır (`customers."deletionRequestedAt"`, migration `20261018090000`), tek SQL ifadesiyle bir kez açılır, üye başına günde 6 basış (`account-deletion`). Ekibe ve üyeye e-posta, olay kaydı (`actor: customer`, gerekçenin metni yazılmaz). Açık talep özet sayfasında da görünür, "Talebi geri al" ile kalkar (olay kaydı + ekibe e-posta). Oturumsuz ziyaretçi başvuru kanallarını görür; form yok, adres sorgulanmaz | `site-account-deletion`, `account-deletion-store`, `account-deletion-core`, `uye-account-deletion-page`, `frontend-form-contract`, `db-integration-account-deletion` |
| 🟡 | Panel talebi göremezdi | Müşteriler'de "Silme talebi · tarih" rozeti (30 gün geçince "süre doldu"), açık talep bandı ve `?filter=deletion` (en eski önce); üye sayfasında talep kartı (son gün, gerekçe) ve birincil "Hesabı sil". Kapanış `deleteMe` ile (DELETE /me ile aynı), talebi ve gerekçeyi de siler, olay kaydı talep tarihini yazar, üyeye "Hesabın silindi" (giriş kimliği kaldıysa "kapatıldı") gider; e-posta kapanışı bozmaz. Talep kartının "Hesabı sil"i gösterdiği talebi (`requestedAt`) gönderir: üye sekme açıkken talebi geri aldıysa, yenisini açtıysa ya da talep okunamıyorsa hesap kapatılmaz | `admin-account-deletion-ui`, `admin-customer-actions` |
| 🟡 | Talep açıkken üye kampanya ve doğum günü e-postası almaya devam ediyordu (eskiden silme anındaydı, şimdi kapanış 30 güne kadar sürebilir) | Talep ret gibi işlenir (6563 m.8/3; İleti onayı metni üyeliğin sona ermesini ret sayar): `campaign_email_audience` açık talepli adresi (üye ve bülten abonesi satırı) almaz, `birthday_greeting_audience` mail bayrağını kapatır, kupon kalır (migration `20261018090100`). Onay kaydı değişmez, talep geri alınınca kitleye döner | `account-deletion-store`, `db-integration-account-deletion` |
| 🟢 | Hukuki metinler sitenin anında sildiğini söylüyordu | `hesap-silme` (§1-§4, §8: talep, 30 gün, geri alma, saklanan kayıtlar), Üyelik Sözleşmesi §14, KVKK başvuru formu, Gizlilik Politikası; dördü de 18 Ekim 2026 tarihli. §14'ün "üyeliğin kurulmasındaki kolaylıkla eşdeğer kolaylık" sözü iki metinde de duruyor ve üyenin tek adımını (uygulamada onay, sitede talep) adıyla söylüyor: değişiklik üye aleyhine esaslı değil, §22'nin on beş günlük bildirimi gerekmez (TBK m.24 aleyhe tek yanlı değişikliği zaten yazılmamış sayar) | `legal-account-deletion`, `legal-dates` |

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Kenar çubuğunda açık silme talebi sayısı yok | Kenar çubuğu #142'de yeniden yazıldı, bu PR ona dokunmuyor; sayı ayrı küçük bir PR. Müşteriler bandı ve ekip e-postası şimdilik yeter |
| 🟢 | Uygulamanın hukuki metin kopyası (`lafmobil` `legal.seed.json`) eski metni taşır | Ayrı uygulama PR'ında yeniden dışa aktarılır; uygulama metni zaten `GET /legal`'dan okur |

### Formlar: sayfa yüklenmeden basılan Enter (FG)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟠 | Elle gönderilen 19 formun ne `action`'ı ne `method`'u vardı (`ActionForm`, `ActionModal`, `useNoResetSubmit` formları, kasa, sipariş notu, ödeme sayfasının sipariş formu). Sayfanın JavaScript'i yüklenmeden basılan Enter tarayıcının kendi gönderimiydi: sayfaya GET, bütün alanlar adres çubuğunda, geçmişte, vekil sunucuda ve istek kaydında. Yeni panel kullanıcısında `?email=…&password=…`, üye formunda telefon, kupon ve damga değerleri. Giriş formu #143'te düzelmişti (2c784cd), gerisi aynıydı | Kit `useHandPost` (`ui/submit.ts`) forma `action` ile `onSubmit`'i birlikte verir: React kendi korumasını (`action="javascript:..."`) çizer, erken Enter hiçbir şey göndermez; sayfa canlanınca onSubmit elle gönderir, React action'ı atlar (sıfırlama yok). React o erken basışı saklayıp sayfa canlanınca action'a verir: `replayByHand` onu da aynı kapıdan geçirir (yanıt beklenirken ikincisi düşer, üç sabırsız Enter tek kayıttır; `beforeSubmit` denetimi olan formda düşer). `ActionForm`, `ActionModal`, giriş, panel kullanıcıları, üye, promosyon, kupon, damga, doğrulama bağlantısı, kampanya testi, manuel sipariş, ürün sihirbazı ve içe aktarma bunu kullanır; kasa, sipariş notu ve ödeme sayfasının sipariş formu kendi işleyicisini action olarak taşır. `src/` altındaki her `<form>` artık `action` ya da `method` taşır; bilerek GET yapan süzgeçler `GET_FORMS`'ta gerekçesiyle | `form-native-submit`, `admin-action-form`, `admin-people-forms`, `admin-login-form`, `admin-product-wizard`, `admin-product-import`, `admin-manual-order`, `admin-cafe-tables-pages`, `admin-site-content`, `admin-legal-ui`, `checkout-consent` |

Liste süzgeçleri FG'de bilerek GET kalmıştı; arama kutularının metni artık
adrese yazılmıyor ve `GET_FORMS` boş (list-search-no-url, aşağıda).

Ayarlar sekmeleri `method="post"` ile kalır (paket 7a): erken basış gövdeyle
sayfaya POST'tur, adrese bir şey yazılmaz. Kart formları (`paynkolay-page.ts`,
`card-payment.tsx`) kendi `action`'lı POST'larıdır, dokunulmadı.

### Hukuk: mesafeli satış 2026 ve kayıtlı kart metni (18 Eki 2026)

Mesafeli Sözleşmeler Yönetmeliği'nin 1 Ocak 2026'da yürürlüğe giren
değişikliği (RG 24.05.2025-32909) ve hiç açılmamış kart saklamayı anlatan
metinler. Avukat turu yok (operatör, 18 Eki 2026); kararlar, dayanaklar ve
cümle cümle eski/yeni metin `docs/LEGAL-REDLINES-2026-09.md` §18-§19.

| Derece | Değişiklik | Nasıl | Test |
| --- | --- | --- | --- |
| 🟠 | Malı geri gönderme süresi 10 gündü (MSY m.13/1: 14 gün) | ÖBF, MSS, İade ve Cayma, Teslimat ve Kargo: 14 gün | `legal-docs` |
| 🟠 | İade kargosu "bildirilen firmayla" ücretsizdi, başka firmada fark alıcıdaydı; ÖBF taşıyıcı adlandırmıyordu (m.12/5: o zaman hiç bedel istenemez) | İade kargo bedeli hiçbir hâlde istenmez: ücretsiz iade kodu, başka kargonun belgeli bedeli geri ödenir, karşı ödemeli iade alınır, kısmi iadede kargo kesilmez, yol riski satıcıda | `legal-docs` |
| 🟠 | Kart saklama hiç açılmadan 14 belgede 42 cümle kayıtlı kartı ve üye anahtarını anlatıyordu; uygulama siparişi ve üye karaoke ödemesi her üyeye anahtar üretiyordu | Pasajlar kalktı ("kart sonraki ödemeler için kaydedilmez"); `SAVED_CARDS_IN_LEGAL_TEXTS = false` kart saklamayı değişkenden bağımsız kapalı tutar; anahtar yalnız `cardStorageEnabled` iken üretilir; üretilmişler migration `20261018200000` ile boşaltılır (OP-28 teyidinden sonra) | `legal-docs`, `saved-cards`, `card-key-gate-app-order`, `card-key-gate-karaoke`, `card-user-key-clear-migration` |
| 🟡 | İade "yeniden satılabilirlik", kutu ve fatura şartına bağlıydı; kullanılmış ürün "kabul edilmez" listesi vardı (m.13/2) | Ölçüt m.13/2; kutu ve fatura istenmez; kesinti yalnız talimata aykırı kullanımda, gerekçesiyle | `legal-docs` |
| 🟡 | Başka kargoyla gönderilen iadenin belgeli bedeli "geri ödenir" deniyor ama nasıl ödendiği yazmıyordu; tam caymada karta iade tahsil edileni aşamaz (`refundRefusal`, PayNkolay) ve bildirimler IBAN'ı yalnız kısmi iade istisnası için işliyordu | Bedel, belge ulaştıktan sonra 14 gün içinde alıcının kendi adına kayıtlı banka hesabına ödenir, karta değil; IBAN'ı sayan 11 bildirim ve KVKK amacı bu ödemeyi de sayar (LEGAL-REDLINES §18.6) | `legal-docs` |
| 🟡 | Arabuluculuk şartı (TKHK m.73/A) ön bilgilendirmede yoktu (m.5/1-k) | ÖBF §21 ve MSS §19 | `legal-docs` |
| 🟡 | KKTC ve yurt dışına gönderim, gümrük ve tarife anlatılıyordu; mağaza yalnız Türkiye'ye gönderiyor | Satırlar ve paragraflar kalktı; Teslimat ve Kargo §16 "Teslimat Bölgesi" | `legal-docs` |
| 🟢 | Mülga 2015 e-ticaret yönetmeliği adıyla anılıyordu (32 yer) | Güncel ad (RG 29.12.2022-32058) | `legal-docs` |
| 🟢 | Ödeme e-postası ve üye sipariş sayfası güncel metni açan bağlantıları "kalıcı veri saklayıcısı" diye anıyordu | "Bağlantılar belgelerin güncel metnini açar" (kalıcı kopya ayrı PR) | `consent-docs-wording` |
| 🟡 | Onaylanan sürümün kalıcı kopyası e-postada yoktu; onay kaydı yalnız sürüm etiketini tutuyordu, panel metni değişince onaylanan metin gösterilemeyebilirdi (X-LEGAL-VERSIONS, OTH-2, OTH-3) | 21 Ekim 2026 (legal-durable-copy, LEGAL-REDLINES §25): gösterilen her metin hash'iyle yalnız eklenen `legal_doc_versions`'ta; onay kaydı `textHashes` taşır; ödeme ve karaoke onay e-postası doldurulmuş metni HTML ek olarak taşır, `/hukuk/<slug>?surum=` aynı sürümü açar, üye sipariş sayfası ve karaoke bağlantısı indirir; panelin denetim satırı eski ve yeni hash'i yazar. İnceleme (21 Ekim 2026): 409 ret sayılmaz, iki onay ek dahil tek süreye sığar, ek alıcıyı siparişin anlık görüntüsünden basar, indirme yolları 503 ve kendi başlıklarıyla döner, imha bugün gösterilen metni korur | `legal-version-core`, `legal-durable-copy`, `legal-durable-copy-load`, `email-durable-copy`, `email-durable-copy-idempotency`, `legal-version-page`, `legal-durable-copy-routes`, `legal-consent-text-hashes`, `admin-legal-actions`, `db-integration-legal-versions`, `legal-dates`, `security-headers`, `mobile-retention`, `order-variant-lines` |

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | İade ve Cayma §17, Teslimat ve Kargo §9 waffle kupu soğuk zincirle gönderilen ürünler arasında sayıyor | Ürün ve sevkiyat bilgisi ayrı PR'ın; cayma istisnasından çıkarıldı |
| 🟢 | Uygulamanın hukuk kopyası (`lafmobil` `legal.seed.json`) eski metni taşır | Uygulama PR'ı (app-legal-seed-distance-sales) |

### Kişiler: silme talebinde karaoke süresi talep anından; metinler 30 günü ve Kurul sürelerini söyler (18 Eki 2026)

Karar ASK-Y3-4 (d) ve ACCOUNT-DELETION-WEB (operatör, 18 Eki 2026: avukat
turu yok). Ekibin gecikmesi üyenin iptal süresini kısaltmaz (TKHK m.4/2).
`/api/mobile/v1` sözleşmesi değişmedi (istek, yanıt, hata kodları aynı);
`DELETE /me` yalnız açık Site talebi olan üyede karaoke iadesini talep
anına göre verir (aşağıda, `docs/API-MOBILE.md` §7).

| Derece | Değişiklik | Nasıl | Test |
| --- | --- | --- | --- |
| 🟠 | Talebi kapatan "Hesabı sil" karaoke kuralını kapanış anına göre uyguluyordu: talepte süresinde olan ödenmiş rezervasyon, ekip saatine 2 saatten az kala kapatırsa iade almıyor, saati kapanıştan önce geçtiyse "geçmiş" sayılıp sessizce düşüyordu (para bizde, kimse habersiz) | Panel talebi `deleteMe` silmeden önce okur ve `deletionRequestedAt` olarak geçirir; `cancelKaraokeForClosedAccount` kuralı talep anında (talepten sonra yapılan rezervasyonda kapanış anında, `closureJudgedAt`) karara bağlar, iade ve damgalar kapanış anında. Saati talepten sonra geçen ödenmiş rezervasyon süzgeçten düşmez: iade edilir ve ekibe "Silme talebi sırasında süresinde olan ödenmiş rezervasyonun saati geçti" gider; diyalogda işaretsiz "Oda kullanıldı" kutusu işaretlenirse ödeme kalır (olay kaydına yazılır) | `account-deletion-karaoke-window`, `delete-me-karaoke-window`, `admin-customer-actions` |
| 🟡 | Site talebi açıkken üye hesabı uygulamadan silerse (`DELETE /me`) karaoke kuralı silme anına göre işliyordu: talepte süresinde olan ödenmiş rezervasyon, ekip gecikip üye saatine 2 saatten az kala uygulamadan silince iade almıyordu (`hesap-silme` §8 talep anını söylüyor) | `deleteMe`, çağıran talep vermezse üyenin açık talebini kendisi okur ve kuralı talep anında karara bağlar. Uygulamada odanın kullanılıp kullanılmadığını kimse işaretlemediği için saati talepten sonra geçen rezervasyon ne iade ne iptal edilir; ekibe "Üye hesabı uygulamadan kapattı" uyarısı gider (`roomUseUnknown`). Talep okunamazsa silme hata verir, kural kapanış anına düşmez | `delete-me-karaoke-window`, `account-deletion-karaoke-window` |
| 🟡 | Ekip ödenmiş karaoke rezervasyonunu talepte göremiyordu, ne zamana kadar kapatması gerektiğini bilmiyordu | Talep kartı ve ekip e-postası her ödenmiş rezervasyonu başlangıç saati ve talep anındaki iadesiyle (`tam iade`, `%50 iade`) sayar, "başlangıç saatinden önce kapat" der; e-posta rezervasyonları okuyamazsa bunu yazar ve yine gider | `admin-account-deletion-ui`, `account-deletion-staff-karaoke`, `account-deletion-core` |
| 🟢 | `hesap-silme` ertelenen silmede 30 günlük cevap süresini, Kurul'a şikâyetin sürelerini söylemiyordu; Kullanım Şartları §7 "hesap ayarları üzerinden" kapatma, Mobil Uygulama Koşulları §17 yalnız e-posta diyordu | §4 ertelemede de 30 gün içinde cevap (KVKK m.13/2), §8 Site talebinde karaoke süresi talep anından, §11 KVKK m.14/1 süreleri; Kullanım Şartları §7 ve Mobil Uygulama Koşulları §17 her kanalı ve süresini sayar, üçü de setin 18 Ekim 2026 sürümünde. Onay belgesi değişmedi (`LEGAL_UPDATED`, `KARAOKE_LEGAL_UPDATED` bu PR'da yerinde); §5'teki kart maddesi #150'yle zaten kalkmıştı. Cümleler: LEGAL-REDLINES §20 | `legal-account-deletion`, `legal-dates` |

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | E-posta veya postayla gelen silme talebinde karaoke kuralı hâlâ kapanış anına göre | Panelin kaydettiği tek talep anı Site'ninki; e-postayla gelen talebin anını "Hesabı sil" diyaloğuna yazdıracak alan ayrı bir PR. O zamana kadar ekip e-posta talebini ödenmiş rezervasyonun saatinden önce kapatır; `hesap-silme` §8 talep anı kuralını yalnız Site talebi için söyler |

### Katalog: mağaza ürün sayfası, kart, vitrin (paket 5b)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Ürün sayfası ve hızlı bakış rafa göre sabit satırlar basıyordu: her hediyeye "Gluten · süt · soya izi" ve "90 gün", her ekipmana "Bialetti × L'Affogato" ve "Garanti: 2 yıl", her çekirdeğe Sirena'nın kökeni ve tat notları; paneldeki marka ve tat notları okunmuyordu. Kargo eşiği Ayarlar ne derse desin "500₺" yazıyordu, eşik kapalıyken de; sayfa yasal metinlerin vermediği "14 gün koşulsuz iade"yi vaat ediyordu (CAT-M01, karar D19) | Satırlar ürünün kendi verisinden gelir (`product-facts.ts`): marka, tat notları, SKU, 0'dan büyük ağırlık, `nuts` alerjeni; sabit köken, tat, demleme, saklama, içerik, marka, garanti ve alerjen satırları kalktı, satırı olmayan üründe "Ürün detayları" çizilmez. Gıda raflarında (çekirdek, kiler, hediye) içindekiler, alerjen ve saklama bilgisi için sipariş öncesi Ayarlar'daki e-posta ve telefon adıyla verilir (TGK Etiketleme m.17/2-a). Kargo eşiği Ayarlar'dan gelir (ürün sayfası, mağaza vitrini ve güvence kutuları), 0'da hiç yazılmaz. İade metni cayma hakkının istisnalarını söyler (MSY m.15) | `storefront-product-facts` |
| 🟡 | Mağaza kartındaki hızlı "+" ve öne çıkan setin "Sepete ekle"si varyantlı ürünü varyantsız ekliyordu: satır taban fiyattan, yalnız ürün toplamından düşüyordu (5a'da bulundu) | `toCartItem` varyantlı üründe ürünün kendi aktif varyantı olmadan satır üretmez; kart böyle üründe "Seçenekleri gör" ile hızlı bakışı (yoksa ürün sayfasını) açar, öne çıkan set de; hızlı bakışın gövdesi ürüne göre anahtarlanır. Eski bir sepetten ya da elle yazılmış istekten gelen varyantsız satırı sunucu ayrıca reddeder (#144, "Sipariş satırı: varyantlı ürün varyant ister") | `storefront-variant-cart` |
| 🟢 | Hızlı bakışın ızgarası `1fr 1fr` idi: fotoğrafın 4/5 kutusu satırla büyüyor, uzun ayrıntı listesi 1280 px'te metin sütununu daraltıyordu; "Sepete ekle" panelin kesilen kenarının altında kalıyordu (bu turda görüldü) | Sütunlar `minmax(0, 1fr)`, fotoğraf sütun genişliğinde ve en az satır yüksekliğinde; metin sütunu panelin 92vh'sıyla sınırlı ve kayar, telefonda sayfa tek parça kayar | `storefront-product-facts` |
| 🟢 | Mağaza vitrininin fotoğrafı tırnaksız `url()` içindeydi: boşluk ya da parantez görseli düşürüyor, `");...;("` ile biten adres vitrine kendi CSS bildirimlerini ekliyordu (CAT-27'nin mağaza kısmı); panel önizlemesi canlı slaytı çizemiyordu (CAT-25'in mağaza kısmı) | `cssUrl()` (`css-url.ts`) adresi tırnaklar, tırnağı, ters bölüyü ve kontrol karakterlerini CSS kaçışıyla yazar; `Slide` dışa açıldı | `storefront-hero-slide` |
| 🟡 | Ürünün markası ve tat notları mağazaya ulaşmıyordu: `toDesignProduct` (`src/lib/admin/store.ts`) `brand` ve `notes`'u göndermiyordu; sayfa ikisini de hazır okuyordu (bu paketin açık listesindeydi) | #182'de kapandı (21 Eki 2026'da doğrulandı): `designProductBase` boş olmayan markayı kırpılmış, tat notlarını boşları atılmış olarak gönderir; mağaza listesi, ürün sayfası ve benzer ürünler aynı eşlemeyi önbellekli `ShopListing` (`toShopListing`, `site-data.ts`) üzerinden okur, ürün sayfası ve hızlı bakış "Marka" ve "Tat notları" satırlarını `product-facts.ts`'ten çizer. Uygulamanın `GET /shop` eşlemesi (`menu-mapper.ts`) iki alanı zaten gönderiyordu, sözleşme değişmedi | `shop-label-store`, `storefront-product-facts` |
| 🟡 | Paketli gıdada içindekiler, Ek-1 alerjenleri, net miktar ve saklama koşulu ürünün kendi alanı olarak yoktu; sayfa yalnız sipariş öncesi iletişimi gösteriyordu (TGK Etiketleme m.9/1, m.17/2-a). Alanlar geldikten sonra ürün CSV'si onları okumuyordu: etiket yalnız ürün formundan, ürün ürün girilebiliyordu | Alanlar #182'de geldi (21 Eki 2026'da doğrulandı): migration `20261019170200_product_food_label.sql` (`allergens` jsonb, menünün 14 Ek-1 grubu ve üç durumu; `ingredients`, `"netQuantity"`, `"storageConditions"`, `"usageInstructions"`, `producer`, `"businessRegNo"`, `origin`, `nutrition`), panelde 14 kutu ve "Gıda etiketi" (Temel bilgi adımı, `FIELD_STEP`), ürün sayfası ve hızlı bakış yalnız girileni çizer, `GET /shop` isteğe bağlı alanlarla. CSV içe aktarma artık `allergens` ve sekiz etiket sütununu okur (Türkçe başlıklar da): alerjen hücresi grupları adıyla ya da anahtarıyla alır, "yok" hiçbiri, tanımadığı ad satırı reddeder (tahmin yok); sert kabuklu meyveler `nuts` etiketini ekler, kayıtlı `nuts` uyarısını düşürecek liste reddedilir; boş etiket hücresi kayıtlı değeri korur (şablondan yapılmış bir stok dosyası etiketleri silmesin diye; silmek ürün formunun işi); uzun alanlar formun kendi sınırını kullanır (içindekiler 2000) | `admin-product-import` ("the food label columns"), `db-integration-product-food-label`, `shop-label-store`, `shop-label-actions`, `storefront-label-discount`, `admin-product-wizard` |

Açık (paket 5b'nin dışında kalan kısımlar):

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Panelde vitrin adresinin ve CTA'nın doğrulanması, panel önizlemesinin `Slide` + `cssUrl` kullanması (CAT-25, CAT-27'nin panel kısmı) | Paket 5c (catalog-forms) |

### Hukuk: menüde alerjen, fiyat listesinin tarihi, içeriği tutmayan fotoğraflar (18 Eki 2026)

Operatör kararı (18 Eki 2026): avukat turu yok, karar ve dayanak
`docs/LEGAL-REDLINES-2026-09.md` §21'de. Kararlar OP-ALLERGEN-BOARD,
OP-PRICE-LISTS, OP-MENU-PHOTOS, ASK-OTH-1.

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟠 | Kafe menüsünde kalem başına alerjen yoktu: sitede genel bir çapraz temas bandı, uygulamada yalnız `nuts` etiketi. Toplu tüketim yerinde her kalemin Ek-1 alerjenleri menüde ya da panoda yazılır (TGK Etiketleme Yön. m.15/5), uzaktan satışta satın almadan önce (m.17/3); Gıda Güvenliği belgesi var olmayan bir listeye atıf yapıyordu (X-TGK-MENU) | `menu_items.allergens` (jsonb; NULL = girilmedi, `[]` = hiçbiri, kapalı 14 anahtar, migration `20261018210100`). Panelde 14 kutu ve "Hiçbirini içermez"; hiçbir kutu işaretli değilse "girilmedi" kalır, "yok" sayılmaz. Sert kabuklu meyve `nuts` etiketini ekler, çelişen `nuts` reddedilir. Kalem kartında "Alerjenler: gluten, süt", `/admin/menu`'de girilmemiş kalem sayısı, `GET /menu`'de isteğe bağlı `allergens` (v1 ekleme, API-MOBILE §1). §7 nerede yazdığını söyler | `menu-allergens` (v1 alanı dahil), `menu-food-info-display`, `db-integration-menu-food-info` |
| 🟡 | Masa karekodunun açtığı `/masa/<kod>` fiyat listesi sayılır (Fiyat Etiketi Yön. m.8/2), ama fiyatların uygulanmaya başladığı tarih yoktu (m.5/2-d) (X-PRICE-LIST) | `settings."menuPricesEffectiveDate"` (İstanbul günü, migration `20261018210200`), Ayarlar > Vergi > Menü fiyat listesi; bugünden sonraki gün reddedilir. Menünün altında "Fiyatlarımıza KDV dahildir · Fiyatların uygulanmaya başladığı tarih: …" (/menu, kategori sayfaları, /masa) | `menu-price-list`, `menu-food-info-display` |
| 🟡 | On stok fotoğraf kalemde olmayanı gösteriyor ya da adındaki malzemeyi dışarıda bırakıyordu (kararın sekizi; yeniden bakışta mnu-0061 ve mnu-0078 kuruyemiş gösterdiği için eklendi); "Görseller temsilidir" bunu karşılamaz (TKHK m.61, m.62, m.8/2; Ticari Reklam Yön. m.7/5-a, m.18/6-7) (OTH-1) | Migration `20261018210000` onunu yalnız eski yolu taşıyorsa ve bir kez boşaltır; tohum da boş; `docs/MENU-PHOTOS.md` ev kuralı (yapay zekâ ya da rötuşlu görsel menü fotoğrafı olmaz), geliştiricinin yapay zekâ taraması (37 kaynak, işaret yok) | `menu-photos`, `db-integration-menu-photos` |

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟠 | 82 kalemin alerjenleri girilmedi; köşkte alerjen panosu ve tarihli basılı fiyat listesi | Operatörün işi (23 Ekim 2026): tablo tedarikçi etiketlerinden hazırlanır, panelde her kaleme girilir. Bilgi uydurulmaz: yanlış alerjen alerjisi olan misafir için gerçek risk |
| 🟡 | Uygulama kalem başına alerjeni ve fotoğraf notunu göstermiyor | lafmobil `app-menu-allergens` ve `app-menu-photo-note` (mağaza onayına bağlı); alan sözleşmede, eski sürümler bir şey kaybetmez |
| 🟢 | 22 rawpixel ve 6 StockSnap kaynağı yapay zekâ işareti için taranmadı (Ticari Reklam Yön. m.18/8) | Sayfalar bot korumalı, operatör tarayıcıda açar (23 Ekim 2026); diğer 37 kaynakta işaret yok (`docs/MENU-PHOTOS.md` Lisans). Kalıcı çözüm 30 Kasım 2026'ya kadar barın kendi fotoğrafları |

### Katalog: menü, kategori ve vitrin formları (paket 5c)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Mağaza vitrini formu çıplak `<form action>`'dı: çift tık iki slayt açıyordu; boş başlık (yalnız boşluk) yanıtsız dönüyor, React sıfırlaması düğme alanlarını, sırayı, temayı ve Aktif kutusunu siliyordu; düzenlemede boş başlık kaydediliyor, mağaza gri "Başlık" çiziyordu (CAT-13) | İşlemler `ActionResult` döner, form `ActionForm` (elle gönderim, yanıt gelmeden ikinci gönderim düşer); boş başlık eklemede de düzenlemede de alanın altında reddedilir | `admin-shop-hero` |
| 🟡 | Kategoriler sayfası mağazanın filtre çubuğunu yönettiğini söylüyordu ama mağaza sabit beş kategoriyi kodda tutar; beş slug da tohumda olduğu için "+ Yeni kategori" ancak ikiz açabiliyordu, paneldeki her kategori seçiminde "Çekirdek" iki kez çıkıyordu (CAT-06, karar D18) | Başka satırın taşıdığı slug eklemede ve düzenlemede alanın altında reddedilir; yeni sayfası yalnız boş slug'ları sunar, beşi de listedeyse form yerine bunu söyler. Metin sayfanın yalnız paneldeki adı ve sırayı belirlediğini söyler; mağazaya bağlamak bu turda yok (D18) | `admin-catalog-actions`, `admin-catalog-forms` |
| 🟡 | Menü etiketleri serbest metindi ("signature, new, iced, nuts, IGP"); uygulama dört kelime dışındakini sessizce atar, "fındık" ya da "nut" yazılan alerjen hiçbir müşteriye görünmüyordu (CAT-10, karar D21) | Dört kutu: İmza, Yeni, Buzlu, Sert kabuklu yemiş; işlem yalnız bu dördünü saklar (`menuTagsFromForm`, eski virgüllü liste de), #154'ün kuralı üstüne: Alerjenler'de sert kabuklu meyveler etiketi ekler, onsuz işaretli etiket reddedilir. Düzenleme, kayıtta silinecek tanımsız kelimeyi kayıttan önce adıyla söyler. Tohumlarda bu dördünden başka etiket yok; kodda yalnız `structured-data.ts`'in "vegan opt." dalı başka bir kelime okur (2c35333'ten beri tohumda yok, panel artık o kelimeyi kaydetmez; menü JSON-LD'sinin `suitableForDiet` alanı bu yüzden panelden açılamaz). Canlı veritabanında elle yazılmış bir kelime varsa o kalemin ilk kaydında düşer. API çıktısı ve `docs/API-MOBILE.md` değişmedi | `admin-catalog-actions`, `admin-catalog-forms` |
| 🟡 | Telefonda iki sütunlu fotoğraf kartında "Birincil yap" × düğmesini kartın dışına itiyordu: ikinci fotoğraf silinemiyordu (CAT-12) | Kart altı satırı kırılır, × sabit 44 px, "Birincil yap" kendi satırında; sütunlar ekranın değil alanın genişliğine göre (en az 9,5rem; menü formunun dar sütununda `md:grid-cols-4` 96 px kart yapıyordu) | `admin-catalog-forms` |
| 🟢 | Vitrin görseli ve düğme bağlantısı denetlenmiyordu, görsel tırnaksız CSS `url()` içine yazılıyordu: boşluk ya da parantezli adres görseli düşürüyor, `);position:fixed;...;(` ile biten adres mağaza vitrinine kendi CSS'ini ekliyordu (CAT-27, panel kısmı) | `src/lib/admin/shop-hero-schema.ts`: görsel ya panelin ürettiği yükleme ya da hiçbir karakteri `url()`'yi veya özniteliği bitiremeyecek biçimde yazılmış bir https adresi; düğme bağlantısı sitedeki bir yol, sayfadaki bir bölüm ya da https, yazısıyla birlikte (mağaza ikisini birlikte çizer). Panelde görsel `<img>`; mağaza tarafındaki tırnaklı `cssUrl()` 5b'nin işi, aynı değişiklik bu dalda da var | `admin-shop-hero`, `storefront-hero-slide` |
| 🟢 | Vitrin "Önizleme"si canlı slayta benzemiyordu: başka katman, eğik başka yazı, başka vurgu rengi, ne üst etiket ne düğme (CAT-25) | Mağazanın kendi `Slide`'ı, etkin ve yüklü, mağazanın çerçevesinde; `inert` ve `aria-hidden` (bağlantısı formdan çıkarmasın). Panelin `a`/`button` sıfırlaması `[data-site-preview]` içini bırakır (`:where` ile, ağırlık aynı), düğme mağazadaki gibi görünür | `admin-shop-hero`, `admin-root-css` |
| 🟢 | Silinmiş slaytı düzenlemek "kaydedildi" diyor, olay kaydı yazıyordu (CAT-28, vitrin) | "Bu slayt silinmiş; listeye dön.", olay kaydı yok | `admin-shop-hero` |
| 🟢 | Menü toplu kaydı neye dokunduğunu, vitrin silme hangi slaytı sildiğini yazmıyordu (CAT-20, menü ve vitrin) | Menü: kimlikler ve yazımdan önce okunan adlar (ilk 100, fotoğrafsız okuma `listMenuItemLabels`); vitrin: silmeden önce okunan başlık | `admin-catalog-actions`, `admin-shop-hero` |
| 🟢 | Menü fotoğraf yükleyicisi bir `<label>` içindeydi: başlığa, ipucuna ya da bağlantı satırına tıklamak dosya seçiciyi açıyor, bırakma alanı iki kez açıyordu (CAT-15) | `Field as="fieldset"` | `admin-catalog-forms` |
| 🟢 | Fotoğraf okları sağa sola taşıdığı hâlde "Yukarı / Aşağı taşı", her × yalnız "Sil" diye okunuyordu, bağlantı alanının adı yoktu (CAT-23, yükleyici) | "Sola taşı: görsel 2", "Sil: görsel 2", "Birincil yap: görsel 2"; bağlantı alanı "Görsel bağlantısı" | `admin-catalog-forms` |
| 🟢 | Menü, kategori ve iki vitrin formunda "Vazgeç" bağlantı içinde düğmeydi; mağaza vitrininde `history.back()` paneli terk edebiliyordu (CAT-22) | Tek `Link`, `BUTTON.ghost`; vitrinde listeye döner | `admin-catalog-forms`, `admin-shop-hero` |
| 🟢 | İngilizce ve jargon: "Shop · Hero slider", "Mağaza sidebar'ı", "Shop ürün filtresinde", "light seç", "altın script", "Limit doldu", Pistachio, Rose, başlık üstünde iç kimlik ("Düzenle · mnu-0003"), "… · Admin" ile "Admin · …" karışık sayfa başlıkları (CAT-24, formlar) | Sade Türkçe, "sen"; başlık üstünde bölüm adı; sayfa başlıkları "Admin · …" | `admin-shop-hero`, `admin-catalog-forms` |

Aynı PR'da gelenler: vitrin listesi yüklenen görseli `/gorsel/hero/<id>`
yolundan gösterir, her slaytın fotoğrafını sayfaya gömmez (CAT-08'in vitrin
kısmı); vitrin listesinde ve formunda el yapımı haplar kit düğmesi
(`BUTTON.*`, CAT-11), satır düğmeleri slaytın adını taşır. Anasayfa
slaytları paneli (#129) vitrin gibi kurulmuş ama zaten `ActionForm` ve
denetlenen şemayla geldi; ortak tek kusuru "Vazgeç"ti, o da düzeldi.
Kategoriler sayfasının açıklaması da yalnız metin olarak değişti (liste
5d'nin dosyası).

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Aynı anda iki sekmede aynı boş slug'la açılan iki kategori ikisi de geçebilir (`categories.slug` benzersiz değil) | Eski veritabanlarında ikiz satırlar var; benzersiz dizin önce onların temizlenmesini ister (migration + operatör kararı). Panel artık ikizi kendisi açmaz |
| 🟢 | Menü yükleyicisinin bağlantı yolu `http://` adresini kabul ediyor, kayıt onu sessizce siliyor (yalnız https saklanır) | Yükleyici ürünlerle ortak ve ürün şeması `http://` kabul ediyor; iki şemayı eşitlemek bu PR'ın dışında |

### Kabuk: Personelin açılış sayfası (admin UI v2, UI-3)

Karar D2 (admin UI v2, 18 Eki 2026): Personelin vardiyası açık siparişlerle
başlar. Sahip ve yönetici panoda (`/admin`), kasiyer kasada (`/admin/kasa`)
kalır; bölüm yetkileri (`SECTION_ROLES`) değişmedi.

| Derece | Değişiklik | Nasıl | Test |
| --- | --- | --- | --- |
| 🟢 | Personel girişte, 2FA adımından, 2FA kurulumundan ve "Panele dön"den panoya gidiyordu; panonun "Toplam ürün" ve "Kategori" kutuları vardiya işi değil | `landingPathFor("staff")` = `/admin/siparisler?durum=acik` (listenin "Açık" sekmesi). Sorgu girişte `next`'in içinde 2FA adımına geçer (`adminNextPath`), logo ve "Panele dön" aynı adrese gider, menüde Siparişler yanar | `admin-roles-matrix`, `admin-landing` |
| 🟢 | `requireRole` reddi `${landing}?denied=1` diye yazıyordu: sorgulu açılış adresinde ikinci `?` olurdu (`?durum=acik?denied=1`: bilinmeyen sekme, yani bütün siparişler, ve uyarı yok). Arama sayfası #142'de `withDenied`'a geçmişti, `auth.ts` aynı kalmıştı | `deniedPathFor(role)` (`roles.ts`, `withDenied` ile birleştirir); `requireRole`, arama sayfası ve arama işlemi onu kullanır. `src/` altında `?denied=`'i elle yazan satır kalmadı (testle) | `admin-roles-matrix`, `admin-landing` |
| 🟢 | Açılış artık bir liste: sekme, sıralama, sayfa ve süzgeç bağlantıları sayfanın parametrelerinden kurulduğu için `denied=1`'i taşıyacak, bir sonraki tıklamada "Bu sayfaya yetkin yok" yeniden çıkacaktı | `toSearchParams` (`list-params.ts`) tek seferlik `denied`'ı düşürür: kitin hiçbir bağlantısı ya da süzgeç formunun gizli alanı onu taşımaz | `admin-landing` |

### Kişiler: promosyon, bülten, kampanya ve kullanıcı listeleri (paket 4c)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Kampanya düzenleyicisinin yapışkan kaydet çubuğunun zemini yoktu: telefonda alanlar düğmenin ve cevap hapının altından görünerek geçiyor, dipnot sonraki kartın başlığının üstüne yazılıyordu (PEO-12); hata kutusunda rol yoktu (PEO-09'un bu formdaki kısmı) | Çubuk site metinleri formununki gibi kendi zeminini taşır (kenarlık, yüzey, gölge, iç boşluk); dipnot çubuğun dışında; cevap hap değil, `role="alert"` kutusu (`FormError`, `FormSuccess`). Form `useHandPost` ile gönderir (yanıt beklenirken ikinci tık düşer, ret yazılanı korur), `withPanelCatch` bir veritabanı hatasını düzenleyiciyi silen hata ekranı yerine cevap yapar | `admin-people-lists` |
| 🟢 | Bülten listesinde arama, sekme ve sayfa yoktu; telefonda işlemler ekranın dışındaydı; 6563 onay metni yalnız fareyle açılan ipucundaydı (PEO-14) | Kit listesi: sekmeler sayılarıyla (Tümü, Aktif, Onay bekliyor, Pasif), adres ya da adla Türkçe katlamalı arama, kaynak süzgeci, sıralanabilir başlıklar, 50'lik sayfalar, telefonda kart, satır menüsü (Onay kaydı, Pasifleştir, Sil). Her abonenin sayfası (`/admin/bulten/<kimlik>`, adres değil) onay zamanını, IP'sini ve onay verilen metni tam gösterir; onay bekleyende isteğin zamanını, IP'sini ve bağlantının süresini. Onay ve çıkış belirteçleri hiçbir yerde görünmez | `admin-people-lists` |
| 🟢 | Gönderim defteri ilk 200 alıcıda duruyor, sayılarını da o 200'den çıkarıyordu: 412 alıcılı kampanyada "Alıcı 412" yanında "Tümü · 200"; 200. satırdan sonrası bulunamıyordu (PEO-15) | Durum sekmeleri bütün kampanya üzerinden SQL sayımıyla (`countCampaignSends`, durum başına bir sayım, arama uygulanmış), adres ya da adla arama (SQL'de iki tarafta `translate` ile Türkçe katlama, `%` ve `_` harf olarak), 50'lik sayfalar (`listCampaignSendsPage`, başarısızlar yine önce), telefonda kart | `admin-campaign-sends` |
| 🟢 | Alt sayfalarda yükleme işareti ve geri yolu yoktu: listeden bir kayda basınca sunucu cevap verene kadar eski sayfa kalıyordu; kampanya oluşturma sayfası çıkmazdı; kampanya listesi taslak başına kitle sayısını birbiri ardınca bekliyordu (PEO-23) | Promosyon, bülten, kampanya, kullanıcılar ve müşteriler klasörlerinde `loading.tsx` panelin iskeletini gösterir (`admin/loading.tsx` yalnız bölüm değişince görünür); kampanya oluşturma, kampanya, promosyon yeni ve düzenle, üye düzenleme sayfalarının başında geri bağlantısı; kitle sayıları aynı anda sorulur (`campaignAudienceCounts`) | `admin-people-lists`, `admin-campaign-audience-counts` |
| 🟢 | Promosyon listesinde sekme, arama ve sıralama yoktu; bir kodun hangi siparişlerde kullanıldığı görünmüyordu (PEO-24'ün liste kısmı) | Sekmeler sayılarıyla (Aktif, Pasif, Süresi dolmuş, Limit doldu; sepetin denetim sırasıyla), kodla arama, Kod / Kullanım / Geçerlilik sıralaması, 50'lik sayfalar, telefonda kart. Her kodun sayfası nerede durduğunu ve nedenini, rakamlarını ve kodla verilen siparişlerin en yeni 20'sini gösterir (yalnız siparişleri açabilen role; satırda ad ya da e-posta yok). İçerik haritasında düzenleme sayfasının "Ayrıntı"sı kodun sayfasına bağlanır | `admin-people-lists`, `admin-promo-usage` |
| 🟢 | Kullanıcılar sayfası her hesap için açık bir düzenleme kartıydı: kimin hangi rolde olduğunu görmek için her parola kutusunun yanından geçiliyordu (P2b, karar D37) | Tablo (sekmeler Tümü, Aktif, Pasif; en yetkili rol önce), her hesabın kendi sayfası: bilgileri, rolünün açtığı bölümler, 2FA, hesabın formları. Sayfa adresle değil, adresten türeyen opak bir anahtarla bulunur (`adminUserKey`); sekme başlığında adres yok | `admin-people-lists` |
| 🟢 | Bülten ve kampanya ekranlarında Tailwind paleti: başarısız sayısı `neutral-400` ile (2,59:1), "İptal edildi" hapı 4,34:1, durum hapları kitin dışında; promosyon yeni ve düzenle sayfaları telefonda `px-6 py-10` (PEO-10, PEO-17, PEO-18'in bu ekranlardaki kısmı) | `--admin-text-soft`, sıfırdan büyük başarısız sayısı tehlike renginde, kitin `Badge`'i, `EmptyState`'i, `BUTTON`'ı; panelin tek sayfa boşluğu | `admin-people-lists` |
| 🟢 | "Footer", "Happy hour", operatöre ortam değişkeni adlarını gösteren uygulama bağlantısı cümlesi, "Bana test gönder" (PEO-21'in bu kısmı) | "Site altı", "Mutlu saat", "Uygulama duyurusu, uygulama App Store'da ve Google Play'de yayınlanıp iki mağaza bağlantısı da hazır olunca seçilebilir ve gönderilebilir.", "Test gönder" (her etkin panel hesabı alıcı olabilir) | `admin-people-lists` |

Açık (paket 4c'nin dışında kalanlar):

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Bülten onay kayıtlarının CSV dışa aktarımı yok | Kişisel veri dışa aktarımı olay kaydının `export` eylemiyle gelir (7c) |
| 🟢 | Gönderim sürerken defter ve sayılar kendiliğinden yenilenmez | Sayfa yenilenince güncellenir; canlı yoklama ayrı iş |

### Sistem: ayarların sitede ve e-postada ulaştığı yerler (paket 7d)

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Footer her sayfada sabit "Her gün 09:00 - 02:00" yazıyordu; anasayfanın bilgi bloğu (`SeoContent`) adresi, telefonu, e-postayı ve saati `SITE`'tan basıyordu; panelde silinen telefon ya da e-posta boş `tel:` / `mailto:` bağlantısı veriyordu (`??`) (SYS-M01) | `src/lib/seo/contact.ts`: `venueContact()` ve `footerSettings()`; on iki sayfa ve düzen footer'ını elle değil bununla kurar, saat satırları Ayarlar → Saatler'den (uygulamanın `hoursLabel` metni), boş alan `||` ile paketteki değere düşer. Bilgi bloğu aynı değerleri basar | `site-settings-reach` |
| 🟡 | /ziyaret'te "Ara" sabit numarayı arıyordu, "02:00 gece kapanış" ve başlıktaki "gece 02:00'e kadar" sabitti; 23 e-posta şablonu ve metin imzası saati, telefonu ve adresi elle yazıyordu; "Kafe adı" ve "Slogan" müşteriye hiç görünmediği hâlde öyle sanılıyordu (SYS-04) | Ziyaret: "Ara" paneldeki numara, kapanış istatistiği ve başlık saatlerden (tek tip haftada kapanış saati, değilse bugünün). E-posta: `[KOSK_SAAT]` `[TELEFON]` `[TELEFON_TEL]` `[KOSK_ADRES]` (`src/lib/email/venue.ts`), gönderimde Ayarlar'dan, okunamazsa paketteki değer; şablonlar yeniden derlendi. Ayarlar ipuçları her alanın nerede göründüğünü söyler, ad ve slogan "yalnız panel ve fiş". Doğum günü e-postası artık "masanızı ayıralım" demiyor (masa rezervasyonu yok) | `site-settings-reach`, `email-venue-footer`, `admin-campaign-mail-actions`, `admin-settings-form` |
| 🟡 | Footer'ın İletişim sütununda şirketin kimliği yoktu (ETHS Yön. m.5/1) | Ticaret unvanı, MERSİS, merkez adresi, (doluysa) KEP doğrudan `LEGAL_ENTITY`'den ve "Şirket bilgileri" bağlantısı (`/hukuk/sirket-bilgileri`) | `site-settings-reach` |
| 🟢 | "Haritayı göster" Google Haritalar'ı sayfanın içine çerçeveliyordu; Google ile standart sözleşme yok (KVKK m.9) | Bağlantı: Google Haritalar yeni sekmede açılır, sayfada çerçeve yok | `site-settings-reach` |
| 🟢 | Hukuk metinleri (Gizlilik §9, KVKK Aydınlatma §14-15, Çerez Politikası) haritanın düğmeyle sayfada yüklendiğini ve Google'a aktarım olduğunu anlatıyordu | Harita aktarım olarak sayılmıyor: §14 ve Çerez Politikası'ndaki Google Haritalar satırları kalktı, §15 gerekçe ve alıcıdan çıktı, metinler bağlantının yeni sekmede açıldığını yazar (`LEGAL-REDLINES` OP-SS2-MAP-LINK) | `legal-kvkk-transfers` |

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Anasayfa (`home-page.tsx` "gece 02:00'e kadar") ve `data.ts` karaoke metni ("Gece 02:00'e kadar açığız") saati hâlâ elle yazıyor; ziyaret sayfasında "Karaoke 12:00 - 24:00" ve "Mutfak 23:30'da kapanır" sabit | Anasayfa dosyası bu paketin dışında; mutfak saati Ayarlar'da bir alan değil |
| 🟢 | `hos-geldin` "500,00 ₺ üzeri kargo ücretsiz"i elle yazıyor; Supabase'in dört giriş e-postası (`docs/email/`) footer'ı sabit | Kargo eşiği bu bulgunun dışında; Supabase şablonları panele elle yapıştırılır, ayardan okuyamaz |

### Kabuk: menü beş grupta, sekmeler, kasiyerin üst çubuğu (admin UI v2, UI-5)

Hiçbir adres taşınmadı: birleştirme menüde ve kabukta. Bir öğe başka mevcut
sayfaları sekme olarak taşır; sayfalar kendi adresini, `requireRole`'ünü ve
formunu korur, yer imleri ve e-posta bağlantıları aynı yere iner.

| Derece | Değişiklik | Nasıl | Test |
| --- | --- | --- | --- |
| 🟢 | Sahibin menüsü altı grupta 29 girişti; aynı işin sayfaları dağınıktı (üç ayrı slayt yeri, Bülten ile Kampanya e-postası, Ürünler ile Kategoriler) | Beş grup (Bugün, Katalog, Pazarlama, İçerik, Yönetim): sahipte 21, yöneticide 18 öğe. Sekmeler rolüne göre süzülür, öğe ilk açık sekmesine gider (yöneticinin Ayarlar'ı Uygulama ayarları; tek sekme şerit çizmez). Şerit yalnız sekmenin kendi sayfasında, `/yeni` ve kayıt sayfalarında yok; ekmek kırıntısı ilk olmayan sekmeyi adlandırır ("Ürünler / Kategoriler / Yeni"). Her rol önceki adreslerinin tamamına, fazlasına değil, ulaşır (sahip 29, yönetici 25, personel 5, kasiyer 1); her admin sayfası bir öğeden ya da sekmeden ulaşılır. Eski adlar (`keywords`) palet için öğede durur | `admin-nav-ia`, `admin-shell-nav` |
| 🟢 | Kasiyerin tek sayfası için kenar çubuğu, menü düğmesi ve çekmece | Kasiyerde kenar çubuğu, menü düğmesi, çekmece yok; üst çubukta logo, sayfanın adı ve Hesap menüsü (Güvenlik / 2FA, Çıkış), içerik sola yaslı | `admin-shell-nav`, `admin-nav-ia` |
| 🟢 | Personelin beş girişi grup başlıkları altındaydı | Altı ve daha az öğe tek liste, başlıksız | `admin-nav-ia` |
| 🟢 | Klavyeyle menüyü atlamanın yolu yoktu (WCAG 2.4.1) | Kabuğun ilk bağlantısı "İçeriğe geç", içerik sarmalayıcısı `#admin-main` | `admin-nav-ia`, `admin-shell-nav` |
| 🟢 | Menü simgeleri dosyada el çizimiydi | lucide (`ui/icons.tsx`), menüde `nav-icon.tsx` üzerinden ayrı bir parçada (`next/dynamic`): kasiyerin Kasa'sı simge kodu indirmez. Her öğenin kendi simgesi | `admin-nav-ia`, `admin-karaoke-panel`, `admin-ui-deps` |

### Panel: liste aramaları adrese yazılmaz (list-search-no-url, 19 Eki 2026)

Kabuk gezinme incelemesinin (#142) gizlilik bulgusu. İstenen: panelin
ürettiği hiçbir adreste kişisel veriye benzeyen bir arama metni olmasın.

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Liste aramaları GET'ti: Siparişler, Müşteriler, Ürünler, Kafe menüsü, Karaoke, Bülten, gönderim defteri, Promosyon ve Masalarda yazılan e-posta ya da telefon `?q=` ile, Olay kaydında "Kim" ve "Kayıt no" adres çubuğuna, tarayıcı geçmişine, vekil sunuculara ve Vercel istek kaydına düşüyordu; sekme, sıralama ve sayfa bağlantıları, karaoke rezervasyon sayfasının geri bağlantısı (`?geri=`) ve CSV bağlantısı da taşıyordu | Kitin `FilterBar`'ı POST eder: `listSearchAction` (oturum ve listenin sayfasının bölümü denetlenir, kural 27) metni listenin yoluna bağlı, 10 dakikalık, httpOnly, sameSite=lax çerezde (`adm_q_<liste>`; kampanya defterinde o kampanyanın sayfasına bağlı) tutar ve listeye metinsiz adresle yönlendirir. Sekme, açılır listeler, tarih ve sıralama adreste kalır. Sayfa metni çerezden okur (`listSearchView`: `url` bağlantılar için, `view` liste için); adresteki bir metin hiç okunmaz. CSV dışa aktarımları (Siparişler, Olay kaydı) metni çerezden alır. "Sıfırla", arama çipinin × düğmesi ve boş listenin "Filtreleri temizle"si de gönderir ve metni unutur. `LIST_SEARCHES`'ta olmayan bir yol ya da kayıtsız bir arama kutusu `FilterBar`'da hata verir; JavaScript'siz form sayfaya POST eder, 303'ü izler. `src/` altında GET form kalmadı (`GET_FORMS` boş). Kayıtlı görünümler (UI-11) adresten kurulacağı için metni taşıyamaz | `admin-list-search`, `admin-filter-bar`, `admin-ui-kit`, `form-native-submit`, `admin-catalog-lists`, `admin-customer-list`, `admin-audit-log`, `admin-order-csv` |
| 🟢 | Müşteri satırındaki "Siparişleri", üye sayfasındaki "Tümünü gör" (`?q=<e-posta>`) ve Olay kaydındaki "Geçmişi" (`?entityId=<e-posta>`, üyenin ve panel kullanıcısının kaydı adresidir) kişinin adresini adrese yazıyordu | `ListSearchButton`: aynı listeye gider, metin gönderinin gövdesinde; kayıt türü adreste kalır. Panel kodunda bağlantıya metin koyan satır kalmadı (testle) | `admin-list-search`, `admin-customer-list`, `admin-customer-detail`, `admin-audit-log` |
| 🟢 | Eski bir yer imi ya da bağlantı `?q=` taşıyordu; oturum yoksa girişin `next`'i de | Proxy, listenin kendi yolundaki bir sayfa görüntülemesinde (GET/HEAD) metni çereze taşır ve listeyi metinsiz yeniden açar (303), şifre sıfırlama belirtecinin yolunu izler; giriş yönlendirmesi ondan sonra gelir. Formun kendi POST'una, listenin altındaki sayfalara ve benzer yollara dokunmaz | `admin-list-search`, `admin-proxy-2fa` |
| 🟢 | Paylaşılan köşk cihazında bir sonraki kişi öncekinin aramasını kutuda bulurdu | Çıkış (`signOutAdmin`) listelerin arama çerezlerini siler; kampanya defterininki 10 dakikada kendiliğinden düşer | `admin-list-search` |

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Arama çerezi tarayıcı başınadır: aynı listede iki sekmede ayrı arama yapılırsa son yazılan geçer | Metin adreste olmadığı için sekmeye bağlanamaz; uygulanan arama kutunun altındaki çipte görünür (docs/ADMIN.md "Listelerde arama") |
| 🟢 | Panel aramasının (`/admin/ara`) "listeye git" bağlantısı listeyi aramasız açar | Palet (UI-6) aynı yere `ListSearchButton` ile metni gönderebilir |

### Kabuk: ⌘K paleti (admin UI v2, UI-6)

Üst çubuğun arama kutusu paletin tetikleyicisi oldu. Palet yalnız okur: bir
sayfaya götürür ya da bu tarayıcının sipariş sesini açıp kapatır; hiçbir
Server Action'a uzanmaz.

| Derece | Değişiklik | Nasıl | Test |
| --- | --- | --- | --- |
| 🟢 | Menü sadeleşince eski adlar ("Mağaza Hero", "Kasa · damga", "kupon", "qr") kayboluyordu; bir kayda gitmek için arama sayfasına geçmek gerekiyordu | ⌘K / Ctrl K (alanın içinde de; Alt'la, Shift'le, IME'de ve başka bir diyalog açıkken değil) ya da Ara: Son açılanlar, Git (rolün menüsü ve sekmeleri, eski adlarıyla, Gün sonu), Oluştur (her biri sayfasının `requireRole`'üyle), Kayıtlar (2 harften, 200 ms sonra, `POST /admin/ara/sonuc`, eski istek iptal edilir) ve Komutlar. Eşleşme `foldTr` artı gevşek ASCII ("siparis" → Siparişler), sıra etiket başı > kelime başı > anahtar kelime > içinde geçen, eşitlikte Türkçe alfabe. JavaScript yoksa tetikleyici `/admin/ara` bağlantısıdır | `admin-palette-core`, `admin-shell-nav`, `admin-nav-ia` |
| 🟢 | Paylaşılan köşk cihazında bir sonraki kişi öncekinin açtığı kayıtları görebilirdi | Son açılanlar sekmenin `sessionStorage`'ında, hesap başına (`laf_admin_recent_v1:<anahtar>`; anahtar e-postanın `ADMIN_SESSION_SECRET` ile HMAC'inin 16 hex'i, e-posta sayfaya gitmez). Yalnız izinli kayıt sayfaları (müşteri, panel kullanıcısı, abone, olay kaydı asla); başlığında e-posta ya da 7 rakam olan kayıt tutulmaz; okurken rol yeniden sorulur. Çıkış listeyi action'dan önce siler; kasiyerde ne tetikleyici ne liste var | `admin-palette-core` |
| 🟢 | Oturum düşünce arama "sonuç yok" gibi görünebilirdi | 401 ya da proxy'nin girişe yönlendirmesi: "Oturumun kapandı." ve buraya dönen giriş bağlantısı; 503 ve diğerleri: "Arama şu an çalışmıyor."; 5'ten fazla sonuçta liste satırı "Listede ara" (aramasız liste: listeler aramayı adreste değil çerezde tutar, satır sonuçları listede gösterdiğini söylemez), "Tüm sonuçlar" satırı yok | `admin-palette-core` |
| 🟢 | Paket bütçesi | Her admin rotasına +2,4 KB gz (tetikleyici, kayıt ve kısayol; üst çubuğun eski arama formu çıktı); palet açılınca 44,97 KB gz (React Aria 40,60 + palet 4,37), `/admin/kasa`'da React Aria yok | `admin-ui-deps` |

### Kabuk: tek tuş kısayolları (admin UI v2, UI-8)

Karar D7: ⌘K / Ctrl K her rol için açık; tek tuşlar sahip, yönetici ve
personel için varsayılan açık, kasiyerde ve Kasa'da hiç yok.

| Derece | Değişiklik | Nasıl | Test |
| --- | --- | --- | --- |
| 🟢 | Yoğun saatte fareye uzanmadan listeye, aramaya ve yeni kayda gitmenin yolu yoktu | `/` listenin arama kutusu (FilterBar'ın ilk kutusu, `data-admin-search`), yoksa palet; `n` sayfanın "Yeni" bağlantısı (`data-admin-new`; 20 Ekim 2026'da hiçbir sayfa çizmiyor), yoksa paletin yalnız Oluştur'u; `?` kısayol listesi (yerli `<dialog>`); `g` ve 1,5 saniye içinde `b s k d m u r` rolün açabildiği sayfaya. Tuş `event.key`'den, Türkçe küçültmeyle; ikinci harfte ü/u, ş/s, ç/c, ö/o, ğ/g; `i` / `ı` boş. Paletin Komutlar'ında "Klavye kısayolları" | `admin-shortcuts`, `admin-palette-core` |
| 🟢 | Tek harfli kısayollar yazıyla, okutucuyla ve ekran okuyucuyla çakışabilir (WCAG 2.1.4) | Alanda (input, textarea, select, contenteditable), IME'de, açık bir `<dialog>`'da, ⌘/Ctrl/Alt/AltGr ile, betiğin gönderdiği tuşta, bir denetimin aldığı tuşta, kasiyerde ve `/admin/kasa`'da çalışmaz. Hesap bölümünde ve listede "Tek tuş kısayolları" anahtarı (bu tarayıcıda, `localStorage` try/catch içinde, varsayılan açık). `n` düğmeye basmaz, yalnız bağlantı açar. `aria-keyshortcuts` yalnız tuşlar çalışırken yazılır (sunucu çizmez): arama kutusunda `/`, ana bağlantıda `n`, kutu yoksa tetikleyicide `/` | `admin-shortcuts` |
| 🟢 | Paket bütçesi | Katman ayrı bir parça, sayfa hidrasyondan sonra ister, yalnız tek tuşlu rollerde: kasiyerin Kasa'sı onu hiç indirmez (ölçüm PR gövdesinde) | `admin-shortcuts` |

### Hukuk: fatura e-Arşiv olarak e-postayla, İşlem Rehberi, meslek odası (20 Eki 2026)

Kararlar ASK-INVOICE, ASK-KAR-KDV, OP-KEP-CHAMBER, D-ISLEM-DURABLE (operatör,
18 Eki 2026: avukat ve mali müşavir turu yok). Cümle cümle eski ve yeni metin
`docs/LEGAL-REDLINES-2026-09.md` §24'te.

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Şirket Bilgileri §14 faturayı yalnız "talep üzerine" e-postayla gönderiyor, MSS §9 e-postaya "muvafakat" istiyordu; şirket faturalarını elektronik olarak düzenleyip e-postayla gönderiyor ve koliye ayrı irsaliye koymuyor (X-INV-EARSIV, X-INV-IRSALIYE) | MSS §9, ÖBF §16 ve Şirket Bilgileri §14: e-Arşiv fatura sipariş e-postasına; kargoda faturanın kâğıt çıktısı irsaliye yerine geçer; e-Fatura kullanıcısına e-Fatura | `legal-docs` |
| 🟡 | Kurumsal fatura bilgisinin "sipariş öncesinde girilmesi" isteniyordu; ödeme adımında alan yok (X-INV-CORP) | Bilgi sipariş numarasıyla, siparişten sonra ve kargodan önce e-postayla | `legal-docs` |
| 🟢 | Karaoke §12 faturanın ne zaman ve hangi tutar için kesildiğini söylemiyordu (X-KAR-KDV) | Ödeme hizmet gününe kadar avans; fatura rezervasyon gününden itibaren 7 gün içinde, köşkte kalan tutar için | `legal-docs` |
| 🟡 | Ana sayfadan ulaşılan bir "işlem rehberi" yoktu (ETHS Yön. m.7/1, X-ETHS-ISLEM) | `/hukuk/islem-rehberi`: adımlar, düzeltme araçları, sözleşme metninin saklanması, uyuşmazlık yolları; site altında "İşlem rehberi" | `legal-docs` |
| 🟢 | Şirket Bilgileri'nde meslek odası ve davranış kuralları satırı yoktu (ETHS Yön. m.5/1-c, X-ETHS-ILETISIM) | `{{CHAMBER}}`, `{{CHAMBER_RULES_URL}}` satırları; değer belgeden gelene kadar boş ve basılmaz | `legal-docs` |
| 🟢 | Fişteki "mali belge değildir" satırı gerçek belgenin nereden geldiğini söylemiyordu (X-FIS, ikinci cümle) | Ödeme yoluna göre e-posta ya da kasa fişi; yolu bilinmeyen ("Diğer", kayıtsız) ödemede ikinci cümle yok | `admin-order-detail` |
| 🟢 | /hukuk'taki numaralı adımlar (ÖBF §9, İşlem Rehberi) numarasız basılıyordu: Tailwind'in temel stili `ol`'un listesini kapatıyor | `.legal-ordered { list-style: decimal }` | `legal-docs` |

Açık (operatörde): oda, kurallar adresi ve KEP değerleri (31 Eki 2026'ya
kadar, `entity.ts`); Paraşüt'te internet satışı ibareleri ve koliye giren
"İrsaliye yerine geçer." çıktısı (LEGAL-REDLINES §24.5).

### Kabuk: telefonda alt çubuk (admin UI v2, UI-7)

`lg` altında, menüsü olan her rol için (sahip, yönetici, personel) ekranın
altında en çok beş yuva. Yuvalar rolün kendi menüsünden gelir
(`bottom-bar-core.ts`): açılış sayfası başta, açılış değilse Genel bakış
sonda, altıncı öğe varsa beşinci yuva Tümü (çekmece). UI-13 Personel'e
Canlı durum ekleyince yuvalar kendiliğinden Siparişler, Karaoke, Kasa,
Canlı durum, Tümü olur.

| Derece | Değişiklik | Nasıl | Test |
| --- | --- | --- | --- |
| 🟢 | Telefonda her sayfa değişimi menü düğmesi, çekmece, öğe demekti | `ui/bottom-bar.tsx`: 44 px yuvalar, lucide simge (menünün tembel `nav-icon.tsx` parçasından) ve ad, menünün rozet sayıları (ikinci bir sorgu yok). Siparişler rozetin saydığı Açık sekmesini açar; açık sayfanın yuvası `aria-current`, çubukta olmayan sayfada Tümü yanar. Tümü çekmeceyi açar, kapanınca odak ona döner. Kasiyerde çubuk yok, kabuğu çubuk kodunu çalıştırmaz | `admin-bottom-bar`, `admin-landing` |
| 🟢 | Alt kenarda üst üste binme (çubuk, toplu işlem çubuğu, bildirimler, yeni sipariş kartları, kaydet çubukları, klavye) | Tek değişken: admin kökü `has-[[data-admin-tabbar]]` ile `--admin-bottom-inset`'i (3,5rem + `env(safe-area-inset-bottom)`) toplu işlem çubuğu yokken kurar; sayfa o kadar yukarıda biter. Bildirimler ve toplu işlem çubuğu onu kenar boşluğu olarak ekler, Site metinleri ve kampanya formunun kaydet çubukları 1rem üstünde durur, yeni sipariş kartları çubuğun üstüne oturur ve ev göstergesi payını ikinci kez eklemez. Çubuk toplu işlem çubuğu açıkken, bir `dialog` açıkken ve dokunmatik ekranda yazı alanı odaktayken çekilir (yalnız Tailwind sınıfları, dinleyici yok). `globals.css`'e kural eklenmedi | `admin-bottom-bar`, `admin-order-alerts-client` |
| 🟢 | Paket bütçesi | Her admin rotasına +1,0 KB gz (`/admin/siparisler` +0,96, `/admin/kasa` +0,99); lucide parçası değişmedi, `/admin/kasa`'nın rota parçalarında lucide yok | `admin-bottom-bar` |

### Kabuk: köşk çipi, Personel'e Canlı durum (admin UI v2, UI-13)

Karar D3: köşkteki vardiya odayı görür; açık, yoğun, kapalı ve boş masayı
Personel de söyler. Toplam masa Sahip ve Yönetici'de kalır, uygulamanın
slaytları, gönderileri ve ayarları (`mobileApp`) değişmedi. Güvenlik
incelemeli PR.

| Derece | Değişiklik | Nasıl | Test |
| --- | --- | --- | --- |
| 🟢 | Personel Canlı durum'u açamıyordu; akşam boyunca en sık değişen bilgi (açık mı, boş masa) yalnız Sahip ve Yönetici'deydi | Yeni bölüm `venue` (sahip, yönetici, personel; kasiyer yok): sayfa ve iki action `requireRole("venue")`, menü öğesi `venue`. Personel'in menüsü altı öğe, alt çubuğu Siparişler, Karaoke, Kasa, Canlı durum, Tümü; paletin Git'i ve rol özeti (`Canlı durum`) aynı | `admin-roles-matrix`, `admin-venue-status`, `admin-nav-ia`, `admin-bottom-bar`, `admin-palette-core`, `admin-role-summary` |
| 🟢 | Toplam masa Personel'e açılmamalı | Sayfada salt okunur (adı yok, gönderilmez); action Personel'in gönderdiği `totalTables`'ı yok sayar, kayıt `patchVenueStatus` ile toplamı hiç yazmaz; boş masa kayıtlı toplamı geçemez, denetim aynı `UPDATE`'in `WHERE`'inde (`"totalTables" >= $n`), arada toplamı düşüren kayıt da sayılır | `admin-venue-status`, `venue-status-patch`, `db-integration-venue-status` |
| 🟢 | Hızlı bir değişiklik başkasının Wi-Fi, gürültü, priz ya da notunu ezebilirdi (tüm satırı yazan upsert) | Üst çubuktaki çip (`saveVenueQuickAction`: kendi kapısı, Zod, olay kaydı satırı, `revalidatePath`) yalnız açık/kapalı seçimini ve boş masayı tek `UPDATE` ile yazar; satır yoksa varsayılanlarla `ON CONFLICT DO NOTHING`. Yoğun yalnız boş masayı 0 yapar | `admin-venue-status`, `venue-status-patch`, `db-integration-venue-status`, `admin-venue-quick`, `db-integration-venue-quick-security` |
| 🟡 | İnceleme F1: çipin Yoğun'u Otomatik ve boş masa 0 yazıyordu; elle Açık bir gecede saat dışında köşkü uygulamada kapatıyor (`placeAppOrder` `cafe_closed`), saat içinde elle Kapalı'yı kaldırıyordu | Yoğun yalnız `freeTables = 0` yazar (`quickPatchFor`), açık/kapalı aynı kalır, yine tek `UPDATE`; kutu, çip "Yoğun" dediğinde Yoğun'da açılır (`quickChoiceOf`, `venueChipState` ile aynı); + ile çıkış köşkün kayıtlı ayarına döner (`choiceAfterStep`), Otomatik'e değil; olay kaydı yalnız yazılanı söyler | `db-integration-venue-quick-findings`, `db-integration-venue-quick-security`, `admin-venue-quick`, `admin-venue-status` |
| 🟢 | İnceleme F2: sorgunun ucuz kapısı çerezdeki role bakıyordu; Personel'e yükseltilen bir kasiyer, sayfa ve hızlı kayıt ona açıkken, yeniden girene kadar (7 güne kadar) durumu göremiyordu | Rolü Canlı durum'u açmayan çerez imleç denetimine girmez ve imleç almaz, karar hesabındır (`panelSignal` ve zilin yolu gibi); kasiyer hesap okumasından sonra yine durum alamaz, durum ve ayar okunmaz | `db-integration-venue-quick-findings`, `db-integration-venue-quick-security`, `admin-venue-signal` |
| 🟢 | Çipin durumu dakikada bir veritabanından okunsaydı açık bir panel sekmesi Neon'u yine bütün gün uyanık tutardı (#185'in kapattığı) | Düzende okuma yok; çip rozetlerin yoluyla sorar (`venueSignal`): `venue` işareti `pub:site` ve `live:access` altında, imleç oturuma bağlı ve saatlerin köşkü bir sonraki açtığı ya da kapattığı dakikaya kadar geçerli (`nextOpenChangeAt`); arada cevap `{ unchanged: true }`, hesap ve durum okunmaz. Durum taşıyan cevap hesabı yeniden okur; cevapta yalnız beş alan (seçim, boş ve toplam masa, açık mı, kaydedildi mi), kişi bilgisi yok. Her `venue_status` yazması `pub:site`'ı düşürür | `admin-venue-signal`, `admin-change-marker`, `venue-status-patch` |
| 🟢 | Uygulamanın canlı durum cevabı | `GET /api/mobile/v1/live-status` ve `toLiveStatus` değişmedi; kısmi kayıttan sonra aynı on iki alan (§6), yalnız yazılan alanlar ve zaman değişir; 216 durumluk bir matriste cevap main'inkiyle bayt bayt aynı | `venue-status-patch`, `db-integration-venue-status`, `mobile-hours`, `venue-live-status-parity` |

### Kabuk: kaydedilmemiş değişiklik uyarısı (admin UI v2, UI-17)

Tarayıcı yalnız yenilemede, sekme kapanışında ve elle yazılan adreste sorar;
panelin kendi bağlantısı ve ⌘K istemci gezinmesidir, ona dokunmaz.
`ui/unsaved-guard.ts` dört formu korur: Ayarlar, Uygulama ayarları, yasal
belge düzenleyici ve kampanya e-postası (ürün sihirbazı kendi koruması ve
kayıt defteriyle kalır).

| Derece | Değişiklik | Nasıl | Test |
| --- | --- | --- | --- |
| 🟡 | Ayarlar, Uygulama ayarları, yasal belge ve kampanya formunda yazılan şey, bir kenar çubuğu bağlantısına ya da ⌘K'ya basınca sorulmadan gidiyordu | Form açılınca alanları `FormData` ile okunur (React'ın çizdiği hâl: kontrollü girdinin değeri, seçimin varsayılanı); operatörün değiştirdiği alanlardan biri (adıyla, `input` / `change` olayından) bundan farklıysa kaydedilmemiş sayılır. Sıra, dosya girdileri sayılmaz; aynı adın değerlerinin sırası sayılır; işaretsiz kutu "yok" olarak, boş yazıdan ayrılır. Yazılıp geri alınan değişiklik sayılmaz; sayfanın kendi kendine kıpırdattığı alan (yeniden doğrulamanın dokunulmamış girdiye getirdiği başkasının değeri, gizli bir sürüm alanı) düzenlemeden önce de sonra da sayılmaz (bağımsız inceleme F1). Kirliyken başka bir sayfaya giden bağlantıya basınca (`document`'te yakalama aşamasında, Next'in `<Link>`'inden önce), palette bir sayfa seçince ve tarayıcı yenilemede ya da kapanışta sorar: "Kaydedilmemiş değişiklikler var. Sayfadan çıkılsın mı?" | `admin-unsaved-guard`, `admin-unsaved-guard-hooks` |
| 🟢 | Sorulmaması gerekenler | ⌘, Ctrl, Shift, Alt ve orta tuş, `_self` dışında `target`, `download`, başka kaynak, `mailto:` / `tel:`, aynı sayfa (başka `?sekme=`, `#` atlaması, "İçeriğe geç"), paletin tetikleyicisi (bağlantı görünümlü düğme). Tarayıcı kendi sorusunu "evet"ten sonra bir saniye sormaz: düz bir bağlantı sayfayı gerçekten yüklerken iki kez sorulmaz | `admin-unsaved-guard` |
| 🟢 | Kaydın sonucu korumaya nasıl yansır | Reddedilen kayıtta form kirli kalır. Yazılan bir cevap (`message`, hata ve onay sorusu yok) gelince yollanan hâl kaydedilmiş sayılır; gönderilmiş ile yanıt gelene kadar yazılan ayrı tutulur (yanıtı beklerken yazılan kaydedilmemiştir). Yönlendiren kayıtlar (yasal belge, yeni kampanya) sayfayı bıraktığı için ne tıklama ne `beforeunload` olur, soru çıkmaz | `admin-unsaved-guard`, `admin-unsaved-guard-hooks` |
| 🟢 | Bir sayfada birden çok form var (Ayarlar'da sekme başına, Uygulama ayarları'nda dokuz): tek bağlantıya basınca tek soru | Tek bir dinleyici seti (tıklama, `beforeunload`, palet sorusu), sayfadaki her koruma için sayılır: tek soru, herhangi biri kirliyse. Son form çıkınca dinleyiciler kalkar; formu kalkmış sayfada kimse tutulmaz | `admin-unsaved-guard`, `admin-unsaved-guard-hooks` |
| 🟢 | Palet sayfa açarken sormuyordu | Tetikleyici bir sayfayı açmadan önce `window`'a iptal edilebilir `admin:leave` olayı gönderir (`mayOpenPage`); formu olan sayfada denetleyici dinler, sorar, "hayır"da iptal eder (palet açık kalır). Dinleyen yoksa cevap evet. Palet parçası 45 KB bütçesinde olduğu için koruma modülünü içe aktaramaz; palet artık yönlendiriciyi tutmaz, sayfayı tetikleyici açar | `admin-unsaved-guard`, `admin-palette-core` |
| 🟢 | Tek tuşlar (`g` ve harf) yalnız ürün sihirbazında sayfadan çıkmıyordu; dört form da kayıt defterinde | Dört form sihirbazın kayıt defterine (`trackUnsavedGuard`) yazar: UI-8'in `g` ve harf kuralı onlar için de geçerli, kısayol dosyası değişmedi | `admin-unsaved-guard`, `admin-shortcuts` |
| 🟢 | Paket bütçesi | Korumalı dört sayfaya ~1,6 KB gz; her rotaya tetikleyicide +77 B, palet parçasında -34 B (`esbuild` ile, `next build` ile ölçülmedi: orkestratörün kapısı) | `admin-unsaved-guard` |

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Tarayıcının Geri ve İleri düğmeleri ve Çıkış düğmesi kaydedilmemiş formu sormuyor | App Router sayfa yüklemeden gezinir (Geri'de tarayıcıda kanca yok); Çıkış bir form gönderimi, bağlantı değil: ikisini kesmek ayrı bir iş |
| 🟢 | Ürün sihirbazı kenar çubuğu bağlantısında ve palette sormuyor | Bkz. 5d'nin "Açık" tablosu |

### Kabuk: kayıtlı görünümler (admin UI v2, UI-11)

Siparişler listesinin süzgeç çubuğunda **Görünümler** menüsü. Görünüm
listenin adresinin bir parçasıdır (sekme, açılır listeler, sıralama) ve bu
tarayıcıda hesap ve liste başına durur; sunucuya, veritabanına ya da adrese
yeni bir şey yazılmaz.

| Derece | Değişiklik | Nasıl | Test |
| --- | --- | --- | --- |
| 🟢 | Sık açılan bir liste ("Masa siparişleri", "Kargoya verilecek") her seferinde sekme ve açılır listelerle yeniden kuruluyordu | FilterBar'a isteğe bağlı `views={{ key }}`: sayfa tarayıcıya gelince süzgeç çiplerinin satırının sonunda "Görünümler" (ActionMenu, details/summary). Kaydet bir pencereyle (ActionModal) ad sorar; kayıtlı görünüm, Sıfırla gibi aramayı da silen bir gönderiyle açılır; "Varsayılan yap" listeyi süzgeçsiz açılışta ziyaret başına bir kez o görünüme götürür (`router.replace`), listenin kendi "Tümü", "Sıfırla" ve çiplerine karışmaz, hatırlanan bir aramanın üstüne gelmez; sekiz görünüm menünün içinde kayar. Menünün parçası yüklenemezse (yeni sürüm parçayı değiştirdi, ağ koptu) `SavedViewsBoundary` onu çizmez; liste "Bu ekran yüklenemedi" ekranına düşmez. Önce yalnız Siparişler; diğer listeler UI-19 ve UI-20'de | `admin-saved-views`, `admin-saved-views-bar` |
| 🟢 | Paylaşılan köşk cihazında kayıtlı bir görünüm müşteri bilgisi saklayabilirdi | `q`, listenin arama kutuları, sayfa, `denied` ve `piiLike`'ın e-posta ya da telefon saydığı her ad ve değer (tarih de) atılır; okurken de aynı kurallardan geçer. Ad en çok 30 karakter, e-posta ya da telefon içeremez; liste başına 8 görünüm. Anahtar `laf_admin_views_v1:<HMAC>:<liste>`: paletin hesap anahtarı, layout'ta kök öğenin `data-admin-account`'ı (kasiyerde yok, e-posta sayfaya gitmez). Erişilemeyen depolama menüyü boş bırakır, kaydetme nedenini söyler | `admin-saved-views` |
| 🟢 | Çubuğun JavaScript'siz işaretlemesi değişmemeli | `views` olmadan ve hidrasyondan önce çubuğun sunucu işaretlemesi bayt bayt aynı (origin/main'deki dosyayla on dört durumda karşılaştırıldı). Test çiplerin işaretlemesini origin/main'den alınmış metinle, `views`'lı ve `views`'sız işaretlemeyi birbiriyle eşitler | `admin-saved-views`, `admin-saved-views-bar`, `admin-filter-bar` |
| 🟡 | İnceleme (F1): varsayılan görünüm gidiş-dönüşte geri geliyordu: "Tümü", bir sipariş, Geri. Next 16'nın geri önbelleği tek sayfa tuttuğu için Geri listeyi yeniden kurar, menü varsayılanı yeniden açıp operatörün süzgeçsiz geçmiş kaydının üstüne yazıyordu | Sekme açtığı varsayılanı `sessionStorage`'da not eder (`laf_admin_views_tab_v1:<hesap>:<liste>`, try/catch); aynı varsayılan o sekmede bir daha açılmaz, yeni seçilen bir varsayılan bir kez açılır. Not yazılamazsa varsayılan hiç açılmaz (her Geri'de yeniden açılmasın). Kalan uç: bir sekmede varsayılanın **ilk** açılışı bir Geri'ye denk gelebilir (sekme başına en çok bir kez) | `admin-saved-views` |
| 🟡 | İnceleme (F2): varsayılanın `router.replace`'i, menünün parçası gelmeden tıklanan bir sekmeyi ya da gönderilen "Uygula"yı iptal edebiliyordu (Next yarım kalan gezinmeyi düşürür) | Her zaman yüklenen yarıda (`ui/saved-views-key.ts`) `useTouchedSince`: çubuk tarayıcıda kurulduktan sonra sayfada ilk `pointerdown`, `keydown` ya da `submit` (yakalama evresi) not edilir; olduysa varsayılan o kurulumda açılmaz | `admin-saved-views`, `admin-saved-views-bar` |
| 🟢 | İnceleme (F3): yalnız bu tarayıcıyı değiştiren kaydet ve sil, ActionModal'ın başarısında `announceAdminChange()` ile kenar çubuğunun sayaçlarını ve panel sinyalini sunucudan yeniden okutuyordu (#185'in boşuna uyandırmama hedefine karşı iki veritabanı okuması) | ActionModal'a isteğe bağlı `announce` (varsayılan `true`, öbür bütün pencereler aynen duyurur); görünümlerin iki penceresi `announce={false}` verir | `admin-saved-views`, `admin-saved-views-bar`, `admin-ui-kit` |
| 🟢 | İnceleme (sertleştirme): süzgeç bir kara listeydi; listenin okumadığı bir ad (`musteri=Ayse+Yilmaz`), `/`, `_` ya da `,` ile bölünmüş bir telefon ve iki kez kodlanmış bir e-posta (`%2540`) saklanabiliyordu | Menü yalnız listenin kendi adlarını tutar (`viewRulesFor`: FilterBar'ın süzgeçleri, `durum` sekmesi, `sirala` ve `yon`); değer yalnız harf, rakam, `_` ve `-` taşır, art arda yedi rakam taşımaz. Okurken de aynı | `admin-saved-views-pii`, `admin-saved-views` |
| 🟢 | Paket bütçesi | Menü kendi parçasında (`next/dynamic`), yalnız `views` veren listede ve sayfa tarayıcıya gelince yüklenir: kendi kodu 3,1 KB gz (`next build --webpack`, incelemeden önce; esbuild tahmini incelemeden sonra 3,6 KB). FilterBar'ın kendi statik kodu yaklaşık 0,7 KB gz büyür (esbuild tahmini, ilk dokunuşun dinleyicisi dahil; yalnız kendi modülleri, react ve next dışarıda). FilterBar'ın statik içe aktarmaları bir listeyle sabit: menü, kuralları, depolaması, diyaloğu ve hiçbir arayüz kütüphanesi ona statik olarak girmez. Statik grafiğine yalnız anahtar yarısı (üç küçük modül: `ui/saved-views-key.ts`, `lib/admin/saved-views-key.ts`, `lib/admin/account-key.ts`) eklenir; hesap anahtarının biçimi kendi dosyasında durur (`palette-shell` oradan yeniden dışa aktarır), böylece paletin kabuk dosyası, roller ve gezinti eşleştirmesi çubuğun grafiğine girmez | `admin-saved-views`, `admin-saved-views-bar` |

### Kabuk: dar menü ve sıkı görünüm (admin UI v2, UI-9)

Tasarım §3.6, karar D10: rahat (44 px) görünüm her yerde varsayılan; sıkı
görünüm yalnız fare olan cihazda ve isteğe bağlı. Dizüstünde kenar çubuğu 64
px'lik bir simge sütununa katlanabilir. İkisi de bu tarayıcıda durur
(`localStorage`) ve sunucunun ilk çizimini değiştirmez.

| Derece | Değişiklik | Nasıl | Test |
| --- | --- | --- | --- |
| 🟢 | 1024 ve 1280 px'te 256 px'lik kenar çubuğu tablolardan yer alıyordu | Menünün üstünde « düğmesi (`aria-expanded`, `aria-controls`; katlanınca aynı düğme » olur, odak onda kalır) kenar çubuğunu 64 px'lik simge sütununa katlar: her bağlantının `aria-label`'ı (rozetin sayısı dahil), grup başlıkları yerine çizgi (katlanmış gruplar açık), hesap bölümü baş harfin arkasında. Genişlik tek değişken: layout'un kökünde `--admin-side` (16rem; kök `data-admin-rail="on"` taşıyınca 4rem); kenar çubuğu, üst çubuk, sekme şeridi, sayfanın sol kenarı ve toplu işlem çubuğu ondan okur. Tercih `laf_admin_rail_v1` ("collapsed" ya da başka bir şey), her erişim try/catch içinde, saf bir ayrıştırıcıdan geçer; depolama reddederse bu sekmede tutulur | `admin-rail-density`, `admin-shell-nav` |
| 🟢 | Simge sütununda adlar görünmez | Fareyle gelince ve klavye odağında (`focus-visible`; tıklamanın odağında değil) çıkan CSS ipucu: `fixed` (menünün kendi kaydırması kırpamaz), dikey yeri simgenin ortası (`--tip-y`, fare ya da odak gelince yazılır), sol dolgusu denetimin parçası (imleç ona geçebilir, WCAG 1.4.13). **Esc** o an fare altındaki ya da odaktaki denetimin ipucunu gizler (`data-tip-off`), fare ya da odak ayrılınca geri gelir. Kitaplık yok, birkaç satır betik | `admin-rail-density` |
| 🟢 | Satırlar ve kartlar bol; dizüstünde az kayıt sığıyor | Menüdeki "Sıkı görünüm" anahtarı (ya da paletin Komutlar'ı) kök öğeye `data-admin-density="compact"` yazar. Kitin sınıfları `pointer-fine:[[data-admin-density=compact]_&]:` ile yazılır (`ui/compact.ts`): tablo hücreleri `py-3` yerine `py-2`, `Card` ve `Section` `p-6` yerine `p-4` (bölüm başlığı gövdesine uyar), düğmeler, alanlar, onay kutusu, "⋯", sayfa hücreleri ve sekmeler 36 px (alanlar 34 px). Varsayılan sınıflar yerinde: 44 px testleri geçer. `globals.css`'e kural eklenmedi | `admin-rail-density`, `admin-ui-kit` |
| 🟢 | Dokunmatik ekranda sıkı görünüm hedefleri küçültmemeli (SHE-32) | Her sıkı sınıf `pointer-fine:` ile başlar; derlenince `@media (pointer: fine)` içinde, `[data-admin-density=compact]` torununda bir kural olur, dokunmatikte hiçbiri eşleşmez (testte derlenmiş CSS ve kaynak taraması). Anahtarın altında "Dokunmatik ekranda uygulanmaz." notu dokunmatikte çıkar | `admin-rail-density` |
| 🟢 | Hidrasyon uyuşmazlığı ve ilk çizimde sıçrama | Tercihler istemci tarafında (`useSyncExternalStore`, sunucu görüntüsü hep "geniş, rahat"); kök öğeye yazan `ViewPrefs` bir layout etkisi: kök öğe sunucuda bu öznitelikleri çizmez, React onlara sahip değil. Tercih kayıtlıysa yenilemede kenar çubuğu bir an geniş çizilir, hidrasyonda tek işlemde daralır (kenar çubuğunun içeriği, genişliği ve sayfanın sol kenarı aynı anda; hiçbir geçiş animasyonu yok); uygulama içi gezinmede kabuk kalıcıdır, sıçrama olmaz. Çıkışta öznitelikler kaldırılır | `admin-rail-density` |
| 🟢 | Palet 45 KB bütçesinde; yeni komut ona kod ekleyemez | "Sıkı görünüm" girdisi her sayfanın yüklediği `palette-shell.ts`'te; liste yalnız komutu bir `window` olayı olarak yollar (`runPaletteCommand`, "Klavye kısayolları" ile aynı yol), kabuğun `ViewPrefs`'i dinler, çevirir ve toast ile söyler. Listedeki iki dal tek dala indi: `palette.tsx` küçüldü | `admin-rail-density`, `admin-palette-core`, `admin-shortcuts` |
| 🟢 | Kasiyerin kabuğu | Kenar çubuğu, anahtar, düğme ve `ViewPrefs` yalnız tam menüde çizilir; kasiyerin tek sayfalık kabuğu tercihleri okumaz, kök öğeye yazmaz | `admin-rail-density` |
| 🟢 | Paket bütçesi | Her admin rotasına ~+1,9 KB gz (kabuğun statik grafiği, `esbuild` ile 13,7 → 15,6 KB gz: kenar çubuğu ~+4,0 KB ham, `view-prefs` ~+2,2 KB ham), listelerin kit kodu ~+0,1 KB gz; paletin tembel parçası ~-7 B gz. `next build` ile ölçülmedi (orkestratörün kapısı); kütüphane kodu eklenmedi, ikon yalnız tembel `nav-icon` parçasına (`Rows3`) | `admin-rail-density`, `admin-ui-deps` |

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Sıkı görünüm yalnız kitin sınıflarında; sayfaların kendi elle yazdığı 44 px düğmeler (onlarca yer) sıkılaşmaz | Sayfalar başka PR'ların; kite alınınca kendiliğinden sıkılaşır |

### Karaoke: işletmenin geç iptalinde telafi, yeniden satılan saatin iadesi, %1-99 (21 Eki 2026)

Hukuk programı OP-KARAOKE-GOODWILL, ASK-OTH-3-CFG, D-KAR-1-99,
OP-KARAOKE-CFG-DECISION (LEGAL-REDLINES §26). Migration
`20261020203619_karaoke_make_good.sql`.

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Misafir geç iptal ederse ödediğini kaybediyordu, köşk aynı geç anda iptal ederse yalnız iade ediyordu (Haksız Şartlar Yön. EK-1 (ç)) | `ariza`, `kapanis`, `diger` ile ücretsiz iptal anından sonra yapılan işletme iptali, geç iptalde tutulacak tutar kadar telafi yazar (6 ay içinde aynı uzunlukta ücretsiz saat ya da misafirin kendi hesabına ödeme); `mucbir`, `misafir`, `yeniden` yazmaz; reddedilen iade telafiyi geri alır; e-posta tutarı ve son günü söyler; panelde "Telafi saati ver" ve "Telafi ödendi" (iade yetkisi), biri diğerini kapatır; telafi saati başlamadan iptal edilirse telafi geri açılır | `karaoke-make-good`, `legal-karaoke-make-good`, `db-integration-karaoke-make-good` |
| 🟡 | Telafi saati iki ayrı yazımdı (telafiyi kullan, sonra saati yaz), telafi saatinin iptali de (saati iptal et, sonra telafiyi aç): arada düşen bir istek telafiyi saatsiz tüketirdi | `karaoke_give_make_good_hour` ve `karaoke_release_make_good_hour`: telafinin kullanımı ile saatin yazımı, saatin iptali ile telafinin yeniden açılması tek SQL ifadesinde; çakışan saat (23P01) hiçbir şey yazmaz, telafi açık kalır. "Telafi ödendi" ile aynı anda basılınca yalnız biri kazanır; saat başladıktan sonra iptal telafiyi açmaz | `db-integration-karaoke-make-good`, `karaoke-make-good` |
| 🟡 | Koşullar §7 geç iptal edilip yeniden satılan saatin payını iade ediyordu ama kod etmiyordu; bu yüzden panel %1-99'u kabul etmiyordu | Onaylanan her satış aynı gündeki geç iptal edilmiş rezervasyonların saatlerini sayar (her saat bir kez, en son geç iptal edene; `karaoke_charge_resold_hours` satır kilidiyle, aynı anda gelen iki ödemede de), satıştan hemen sonra ve onay e-postasından önce; tutulan pay `refunding` + ekibe e-postayla elle iadeye girer; panel %1-99'u kabul eder (uygulama kilidi açıldığında) | `karaoke-make-good`, `db-integration-karaoke-make-good`, `karaoke-cancel-policy`, `admin-karaoke-cancel-policy` |
| 🟡 | Elle iade kaydı yalnız `refunding` durumuna bağlıydı: okumayla yazım arasında satılan bir saat tutarı büyütürse büyüyen kısım ödenmeden "iade edildi" olurdu | Kayıt okunan `refundMinor`'a da bağlı; arada büyüdüyse reddedilir (raced) ve borç kalır. Daha önce elle iade edilen kısım `refundSettledMinor`'da kalır, son adım okunabilir | `karaoke-make-good`, `db-integration-karaoke-make-good` |
| 🟢 | Telafi ödemesinin notu olay kaydına giriyor, IBAN yazılabiliyordu | IBAN ya da kart numarası taşıyan not reddedilir; tabloda hesap bilgisi kolonu yok | `karaoke-make-good`, `db-integration-karaoke-make-good` |
| 🟢 | Ciro raporu, payı elle iade edilmiş ve sonra yeniden satış iadesi bekleyen rezervasyonda daha önce iade edileni "iadesi bekleyen" ve kasada kalan sayıyordu; Gün sonu yeniden satış iadesinin günü payı da o günün iadesi sayardı | `karaokeRevenueFrom` `refundSettledMinor`'ı iade edilmiş sayar; Gün sonu yalnız son adımı o günün iadesi yazar | `admin-reports-ltv`, `admin-day-close` |
| 🟡 | İnceleme (M1): "Elle iade edildi" basıldığı andaki tutarı kaydediyordu; sayfa açıldıktan sonra bir saat daha satılırsa kişinin iade ettiğinden fazlası "iade edildi" yazılıyor ve e-postayla bildiriliyordu | Pencere gösterdiği `refundMinor`'u gönderir (`settleFields`); pay yalnız o tutarla kaydedilir, değiştiyse ya da tutar gelmediyse `raced` ve açık bir uyarı | `db-integration-karaoke-make-good-money`, `karaoke-make-good`, `admin-karaoke-actions`, `admin-karaoke-panel` |
| 🟡 | İnceleme (M2, A1): IBAN/kart notu süzgeci NBSP, nokta, eğik çizgi, alt çizgi, çift boşluk, uzun tire ve " / " ayrımlarını ve "hesap 12345678"i kaçırıyordu; not 10 yıl silinmeyen olay kaydına giriyor ve geçmişte her Personel'e "Neden" olarak görünüyordu | Not NFKC ile katlanıp görünmez karakterlerden arındırılır, gruplar arasında üçe kadar ayırıcı tanınır, "hesap no" kuralı eklendi; havale notu geçmişte yalnız iade yetkisi olana görünür | `db-integration-karaoke-make-good-money`, `karaoke-make-good` |
| 🟢 | İnceleme (M3): bir payın elle iadesi, saati sonra yeniden satılınca Gün sonu'ndan düşüyordu (tek `refundedAt`) | Her elle iade kendi tutarı ve anıyla `refundSteps`'te; Gün sonu her adımı kendi gününde yazar, rezervasyonun geçmişi de | `db-integration-karaoke-make-good-money`, `admin-day-close`, `karaoke-make-good` |
| 🟢 | İnceleme (M4): %100 ORO indirimiyle 0 TL'ye ayrılan saat yeniden satış sayılıyordu | Toplamı 0 olan satış yeniden satış değildir (köşk o saatten para almadı, TBK m.325/2 kıyasen); köşkte ödenen rezervasyon sayılmaya devam eder | `db-integration-karaoke-make-good-money`, `karaoke-make-good` |
| 🟢 | İnceleme (M5): reddedilen POS iadesinde telafi, ödendi durumuna dönüşten sonra ayrı bir yazımla siliniyordu; arada gelen ikinci iptal (mücbir) açık telafi ve onu vaat eden e-postayla bitiyordu | Telafi geri dönüş yazımının içinde silinir; her ödenmiş iptalin ilk yazımı telafiyi tam bu iptalin kararıyla (ya da boş) yazar | `db-integration-karaoke-make-good-money`, `karaoke-make-good` |
| 🟢 | İnceleme (M6): "Telafi ödendi" telafiden büyük her tutarı kabul ediyordu ("20000" = ₺20.000) ve "25.000.000" hata sayfası veriyordu | Tutar tam telafi kadar olmalı; değilse `tutar` alan hatası, veritabanına gitmez | `db-integration-karaoke-make-good-money`, `karaoke-make-good` |
| 🟢 | İnceleme (A2, A4): Personel (iade yetkisi yok) ve hesap kapanışı, misafirin kendi iptalinin reddedildiği süre içinde telafi saatini iptal edip kullanılmış telafiyi yeniden açabiliyordu; telafi sonra parayla ödenebiliyordu | Sunucu bu iptali `free_hour_forbidden` ile, kendi cümlesiyle reddeder, panel düz İptal'i iade yetkisi gerekçesiyle kapalı çizer; hesap kapanışı saatin kendi kuralına bağlı, o süre içinde saat durur ve köşke telafi saati olarak (tutarıyla) bildirilir | `db-integration-karaoke-make-good-access`, `karaoke-make-good` |
| 🟢 | İnceleme (R1, R2): Ödeme Koşulları §14 banka hesabına transferi "yalnızca iki hâlde" sayıyordu; KVKK Aydınlatma §7 ve §8 ile Gizlilik Politikası §5 telafiyi amaç olarak saymıyordu | §14 üç hâli (karaoke telafisi dâhil, 14 günüyle) sayar; üç amaç listesi telafiyi adlandırır; Ödeme Koşulları'nın tarihi 21 Ekim 2026 | `legal-karaoke-make-good`, `legal-docs`, `legal-dates` |
| 🟢 | İnceleme (R3): köşkün henüz onaylamadığı ödenmiş rezervasyonun misafiri geç iptal kuralına bağlıyken köşkün geç iptali telafi doğurmuyordu | Geç iptal kuralı kime bağlıysa geç telafi de onadır (Haksız Şartlar Yön. EK-1 (ç), orkestratör kararı A) | `db-integration-karaoke-make-good-regression`, `karaoke-make-good` |
| 🟢 | İnceleme (R4): başlamadan iptal edilen telafi saatinin iptal e-postası yeniden açılan telafinin tutarını ve son gününü yazmıyordu | E-posta telafi cümlesini yeniden açılan telafinin tutarı ve son günüyle yazar | `db-integration-karaoke-make-good-regression`, `karaoke-make-good` |
| 🟢 | %1-99 cümlesi 14 günü ve yeniden satış iadesini yazmıyordu; koşullar §9 "kısmi iade yapılmaz" diyordu; pay ve yeniden satış birlikte iade edilince e-posta toplamı yalnız kurala bağlıyordu | Cümle "en geç 14 gün içinde" ve yeniden satış cümlesiyle; §9 kısmi iadeyi 14 günle yazar; e-postada pay ve yeniden satış birlikte adlandırılır | `karaoke-cancel-policy`, `legal-karaoke-make-good`, `karaoke-make-good` |

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Sisteme rezervasyon olarak girmeden köşkte nakit satılan saat yeniden satış sayılmaz | Panelde rezervasyon açma yok (backlog, D8); sistemdeki her onaylı satış sayılır. Böyle bir satış, karar metnindeki kalan risk gibi, personelin elle izlemesine kalır |
| 🟢 | Satışın yazımı ile yeniden satış hesabı arasında süreç düşerse (Vercel zaman aşımı) o satışın borcu yazılmaz | İkisi ayrı ifadeler; hesap satıştan hemen sonra ve e-postadan önce yapılıyor, pencere birkaç milisaniye. Kalıcı çözüm satışı ve hesabı tek SQL ifadesine almak (onay yolu bütünüyle SQL'e taşınır) |

### Kabuk: tarih alanları (admin UI v2, UI-14)

Karar D12: telefonda ve dokunmatik ekranda yerel tarih kutuları kalır;
fareli cihazda ve yalnız tarih alanına gelindiğinde React Aria takvimi
yüklenir. Liste süzgecinde altı hazır aralık (Bugün, Dün, Son 7 gün, Son 30
gün, Bu ay, Geçen ay) köşkün saatiyle, sunucuda çizilen düz bağlantılardır.

| Derece | Değişiklik | Nasıl | Test |
| --- | --- | --- | --- |
| 🟢 | İnceleme F1: kapatma anahtarı (`DATE_WIDGETS_ENABLED`) parçanın içinde okunuyordu; kapalıyken de parça indirilirdi | Anahtar hafif `widget-loader.ts`'te, `import()`'tan önce okunur | `admin-widget-loader` |
| 🟢 | İnceleme F2: hazır aralığa tıklamak için alana gelmek de takvimin parçasını indiriyordu | Yükleme yalnız tarih kutularına gelince ya da odak onlara düşünce | `admin-widget-loader` |
| 🟢 | İnceleme F3: takvim açıkken tek tuş kısayolları çalışıyordu | React Aria açılır penceresi (`[data-admin-portal] [role=dialog]`) de açık pencere sayılır | `admin-shortcuts` |
| 🟢 | Ölçüm (21 Eki 2026, `next build`, Turbopack): hiçbir admin rotasının ilk yüklemesinde React Aria ya da tarih paketi yok. `/admin/siparisler` (195,6 KB gz JS), `/admin/stok-hareketleri` (189,7), `/admin/siparisler/yeni` (282,3), `/admin/promosyon/yeni` (188,1) ve `/admin/kasa` (187,1) rotalarının `entryJSFiles` + `rootMainFiles` listesinde kütüphane parçası 0 KB; kural "her admin rotasına en fazla 8 KB" ilk yüklemede tutuyor | Bekçi: her `page`, `layout`, `loading`, `error`, `not-found` dosyasından statik değer importlarıyla ("use client" sınırını da geçerek) yürünür, React Aria ya da tarih paketine varan yol olmamalı; üç widget parçasına ve paletin listesine yalnız `import()` ile varılır | `admin-ui-deps` |

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Takvim parçası tasarımın 45 KB bütçesini aşıyor. Ölçüm (gzip -9, parça parça): tarih aralığı 110,4 KB gz (kendi 6,2 + tarih ve takvim 47,9 + React Aria çekirdeği 39,4 + Popover, Dialog, Button 16,9), tarih ve saat 110,7 KB gz (kendi 6,5 + aynı üç parça). Eski "84 KB" tek paket (esbuild) ölçümüydü; Turbopack'in gerçek parçaları büyük. Çekirdek ve Popover parçası seçici ve paletle ortak: biri indikten sonra ikinci tarih alanı 6,5 KB, seçiciden sonra takvim 54,1 KB | Yalnız fareli cihazda, tarih kutusuna gelince ve bir kez iner; ilk yüklemede yok (yukarıdaki ölçüm). Koddan ucuz kazanç yok (21 Eki 2026 denendi): importlar zaten alt yoldan, `I18nProvider` tek modül, iki tarih alanı ve seçici çekirdeği zaten tek parçada paylaşıyor, iki takvim (`Calendar`, `RangeCalendar`) React Aria'da tek modül. Kalan iki kaldıraç yapılandırma ister (`next.config.ts`, Turbopack `resolveAlias` ya da `rules`; `@react-aria/optimize-locales-plugin` bir webpack eklentisi, Turbopack çalıştırmaz): tr-TR ve en-US dışındaki dil sözlükleri ~17 KB gz (110 → ~93, kurulu parçadan sözlükler çıkarılarak ölçüldü); Gregoryen dışı takvimler ~10 KB ham (~3 KB gz), React Aria `DateField` `createCalendar`'ı statik içe aldığı için `createCalendar` prop'u onları düşürmez. İkisiyle de ~90 KB: React Aria çekirdeği (39,4 + 16,9) tek başına bütçeyi aşıyor, 45 KB React Aria ile ulaşılamaz; bütçe yeniden kararlaştırılmalı ya da widget değişmeli. Orkestratör kararı (21 Eki 2026): kabul |

### Hukuk: karaoke verisinin süresi, imha kaydı, ticari yazışma (21 Eki 2026)

Kararlar ASK-RETENTION, OP-RETENTION-APPLY, D-CORRESPONDENCE (operatör,
18 Eki 2026: avukat turu yok). Cümle cümle eski ve yeni metin
`docs/LEGAL-REDLINES-2026-09.md` §27'de, imhanın işleyişi ve kaydın yeri
`docs/DATABASE.md` "Periyodik imha"da.

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟠 | Üye olmadan karaoke rezervasyonu yapanın adı, e-postası ve telefonu ile her rezervasyonun iletişim adresi, telefonu ve notu için saklama süresi yoktu; Veri Saklama "henüz belirlenmemiştir" diyordu (X-KAR-RETENTION) | Rezervasyon gününden 3 yıl sonra misafirin adı silinir, adresi `anon-<id>@anon.local` olur, her rezervasyonun iletişim bilgisi, notu ve onaydaki IP ile tarayıcı bilgisi silinir; 11 yıl sonra satır silinir (`karaoke_guest_retention`, `karaoke_reservation_retention`). Açık ödeme (`pending`, `refunding`), panelin hâlâ borçlu saydığı rezervasyon (ödenmiş ve iptal ya da onaylanmamış), `payment_transactions`'ta cevapsız `refunding` talebi ve `"retentionHold"` atlanır; silme rezervasyon günü, ödeme ve iadenin en geç olanından sayılır; temizlenmiş satır ikinci kez sayılmaz, gün köşkün saatiyle kesilir, gün olmayan ya da bir yıldan yakın sınır hata verir (inceleme M1-M3, R5) | `db-integration-karaoke-retention`, `mobile-retention` |
| 🟡 | Periyodik imha çalıştırması hiçbir iz bırakmıyordu ve politika "ayrı bir kayıt oluşturulmaz" diyordu (Silme Yön. m.7/3) (X-RETENTION-APPLY, inceleme R1) | Uygulanan her çalıştırma `audit_logs`'a tek satır yazar (`system`, `bulk_delete`, `retention`, kural başına yöntem ve sayılar, `safeAudit`); politika §8 ve §17 bunu söyler; rapor modu hiçbir şey yazmaz; iki cron rotası da kaydı bırakır ve aynı satırı loglar; Olay kaydında "Periyodik imha", kural kural Türkçe | `api-cron-retention-record`, `mobile-retention`, `admin-audit-log`, `db-integration-karaoke-retention` |
| 🟢 | İletişim satırı sipariş ve ödeme yazışmasına da üç yıl veriyordu; etkinlik ve atölye kaydının satırı yoktu (D-CORRESPONDENCE, X-EVENT-PROOF) | İşlemle ilgili yazışma ticari yazışma olarak yıl sonundan itibaren 10 yıl (TTK m.82), ilgisiz mesaj ve telefon notu 3 yıl; "Etkinlik ve atölye kayıtları" satırı | `legal-docs`, `legal-dates` |

Açık (operatörde): Production'da `RETENTION_APPLY=destroy` (OP-18), önce bir
rapor çalıştırması okunduktan sonra (LEGAL-REDLINES §27.5).

### Hukuk ve kasa: damga yalnız üyenin kendi koduyla (21 Eki 2026)

Karar ASK-LOYALTY (operatör, 18 Eki 2026: avukat turu yok). Cümle cümle eski
ve yeni metin `docs/LEGAL-REDLINES-2026-09.md` §28'de.

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟠 | Kasada QR okunmazsa kasiyerin elle yazdığı üyelik e-postasıyla damga veriliyordu: üye kendini göstermeden adıyla işlem yapılıyordu (X-LOYALTY) | "E-posta ile" sekmesi kalktı, kod sekmesinde "QR okunmuyorsa..." ipucu; eylem `kind: "email"`'i kararlaştırılan cümleyle reddeder (üye araması ve tekrar penceresi kalktı); `redeemCounterToken` `email_refused` ile hiçbir şey okumadan ya da yazmadan reddeder; `not_found` yeni QR ister. `POST /staff/stamp` zaten yalnız `token` ve `code` alıyordu | `admin-kasa`, `mobile-counter`, `mobile-staff-stamp-route` |
| 🟡 | Müşteri sayfasındaki "+1 damga" gerekçesizdi | "Damga düzelt (+1)": rol `customers` (sahip, yönetici), en az 10 karakterlik sebep zorunlu, defter notu `Düzeltme · ` ile başlar | `admin-customer-actions`, `admin-people-forms` |
| 🟢 | Yedi hukuk metni kasada e-postayla damgayı anlatıyordu | Gizlilik, KVKK, Üyelik, Sadakat Programı, Mobil Uygulama ve Kafe Hizmet metinleri yalnız kasa kodunu ve yönetici düzeltmesini anlatır | `legal-docs`, `legal-dates` |

### Kabuk: aranabilir seçiciler (admin UI v2, UI-16)

Stok düzeltme ve elle sipariş formlarında ürün ve varyant seçicileri yazarak
aranır ("sire" Şire'yi, "findik" Fındık'ı bulur); sunucu ve JavaScript'siz
yol yerel `<select>` olarak kalır, adlar değişmedi.

| Derece | Değişiklik | Nasıl | Test |
| --- | --- | --- | --- |
| 🟢 | Ölçüm (21 Eki 2026, `next build`): seçici `/admin/siparisler/yeni` ve `/admin/stok-hareketleri` dahil hiçbir rotanın ilk yüklemesinde yok; parça yalnız `import("./combobox-picker")` ile iner | `combobox-picker` ve paletin listesi de "yalnız `import()` ile" bekçisinde; rota dosyalarından statik yürüyüş React Aria'ya varmaz (UI-14'teki satır) | `admin-ui-deps` |

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Seçici parçası tasarımın 35 KB bütçesini aşıyor. Ölçüm (gzip -9, parça parça): 77,5 KB gz (ComboBox 10,6 + ListBox 10,7 + React Aria çekirdeği 39,4 + Popover, Dialog, Button 16,9). Eski "64 KB" tek paket (esbuild) ölçümüydü. Çekirdek ve Popover parçası takvimle ortak: takvimden sonra seçici 21,3 KB | Yalnız seçiciye gelince ve bir kez iner; ilk yüklemede yok, Kasa hiçbir şey indirmez. Koddan ucuz kazanç yok (UI-14'teki satır). Dil sözlüklerini tr-TR ve en-US'e indirmek ~7 KB gz kazandırır (77 → ~71) ve `next.config.ts` ister; çekirdek tek başına (39,4 + 16,9) bütçeyi aştığı için 35 KB React Aria ile ulaşılamaz. Paletin ListBox'ı ayrı parçada (7,5 KB): ikisini de açan bunu iki kez indirir, Turbopack'in parça kararı. Orkestratör kararı (21 Eki 2026): kabul |

### Kabuk: lafmaliyet (AkmanOS) görünümü (21 Eki 2026)

Operatör kararı (21 Eki 2026): panel, kafenin arka ofis paneli lafmaliyet'in
AkmanOS açık temasıyla yeniden giydirildi; davranış, rotalar, form adları ve
eylemler değişmedi. Beyaz zemin, zinc-100 kartlar, siyah birincil, Geist;
kenar çubuğu 17.5rem, beyaz liste kutusu, ikon karoları, geniş ⌘K kutusu,
siyah etkin satır. Etiket tonu `#6b6b73` (AkmanOS'un `#71717a`'sı zinc-100
kartta AA'yı geçmiyordu). Testler: `tests/admin-ui-kit.test.ts` (tema, AA
zeminlerine zinc-100 eklendi), `tests/admin-root-css.test.ts`,
`tests/admin-rail-density.test.ts`, `tests/admin-shell-nav.test.ts`.
Ayrıntı: `docs/BRAND.md` "Admin paneli görünümü".

### Panel: güvenlik ve CRUD turu (21 Eki 2026)

Operatör: _"admin panel tasarımını geliştir ... kullanıcı kolay ekleyip
çıkarabileceği CRUD işlemleri düzgün olan bir şeyler yap ... güvenlik açığı
da varsa çözüp maine pushla"_. Bütün `"use server"` dışa aktarımları (132),
altı route handler, oturum, 2FA, roller, yüklemeler, XSS ve SQL yeniden
okundu: kritik ya da yüksek bulgu yok. Doğrulanan bir orta ve düşük
bulgular, CRUD boşlukları:

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | `CUSTOMER_SESSION_SECRET` tanımsızken müşteri çerezi `ADMIN_SESSION_SECRET` ile imzalanıyor ve üye adresi "\|" taşıyabiliyordu: `owner@laffogato.net\|owner` adresiyle açılan üyenin kendi çerezi (`email\|exp\|fp\|sig`) panelin `email\|role\|exp\|fp\|sig` imza denetimini geçiyordu (proxy ve yoklamaların "değişmedi" yanıtı); yalnız parmak izinde düşüyordu. §11'deki "biçim farkı" savunması bu yüzden yoktu | Panel oturum ve 2FA bekleme çerezleri `ADMIN_SESSION_SECRET`'tan bu amaç için türetilen anahtarla imzalanır (`src/lib/admin/session-key.ts`); bütün operatörler bir kez yeniden giriş yapar. Üye kaydı "\|" ve kontrol karakteri taşıyan adresi reddeder | `admin-session-key` (düzeltmesiz kırılır), `customer-email-shape` |
| 🟢 | 2FA kurulumundaki kod adımında deneme sınırı yoktu ve 2FA zaten açıkken canlı sırra karşı kod deniyordu | Girişin iki bütçesi (`admin-2fa`, `admin-2fa-account`) sayılır; 2FA açıksa hiçbir kod denenmez | `admin-2fa-screens` |
| 🟢 | Veritabanı kesintisinde giriş sınırlayıcısı açık kalıyor, break-glass env parolaları bütçesiz karşılaştırılıyordu | Deneme sayılamazsa (`uncounted`) hiçbir parola karşılaştırılmaz, yanıt "şu an tamamlanamadı"; zaten veritabanısız giriş tamamlanamıyordu | `admin-env-signin-outage` |
| 🟢 | Ürün içe aktarma şablonu ilk kategorinin adını CSV'ye olduğu gibi yazıyordu: yöneticinin `=HYPERLINK(…)` adlı kategorisi sahibin Excel'inde formül olarak çalışırdı | `csvField` = + - @ (ve sekme / CR) ile başlayan hücrenin başına ' koyar (sipariş CSV'sinin kuralı) | `admin-csv-parse` |
| 🟢 | `payment_transactions.raw.params` `withoutHolderName`'den geçmeden yazılıyordu (§8'den taşındı; belgelenen dönüş gövdesi adı taşımıyor) | Dönüşün kaydı, başarılı da reddedilen de, adı çıkarılmış parametreleri yazar (kaydedilen başarılı dönüştür) | `payment-paynkolay` (düzeltmesiz kırılır) |
| 🟢 | Sahip kendi hesabını silebiliyor, pasifleştirebiliyor ya da rolünü düşürebiliyordu: rol her istekte hesaptan okunduğu için daha düşük rol sayfayı hemen kapatıyor, pasifleştirmek ya da silmek kimsenin onayı olmadan oturumu kapatıyordu | Eylemler reddeder, satır nedeniyle kapalı çizilir; kendi satırı yalnız adı kaydeder, rol ve erişim kayıttaki gibi kalır (env ile girilmiş sahibin aynı adresli pasif satırı açılmaz) | `admin-staff-actions`, `admin-people-forms` |
| 🟢 | Panel sayfalarında React hydration uyarısı: kısayol katmanı sayfanın birincil bağlantısına ve arama kutusuna `aria-keyshortcuts`'u sayfa hydrate olmadan yazıyordu | İki öğe `suppressHydrationWarning` taşır | tarayıcı geçişi (konsol temiz) |
| 🟢 | Kenar menüsü 1280 × 800-900'de yalnız ilk üç grubu gösteriyordu; İçerik ve Yönetim sayfalarında açık sayfanın satırı görünmüyordu | Menü (sayfa değil) açık satırı görünür alana kaydırır | tarayıcı geçişi |
| 🟢 | Mağaza slaytları, uygulama slaytları, duyurular ve gönderiler listeden yayından kaldırılamıyordu (silme penceresi "Düzenle'den yayından al" diyordu); onların ve kafe menüsünün sırası kayıt kayıt elle yazılan sayıydı (§13 CAT-30'un sıra kısmı, CON-24'ün sıra kısmı) | Satırın ⋯ menüsünde "Yayına al / Yayından kaldır" (yalnız `isActive`, gönderide e-posta yok), satırın yanında ↑ / ↓ (10, 20, 30… yeniden numaralanır; menüde kategori içinde, liste süzülmüşken sayı); mağaza slaytları DataTable'a geçti | `admin-list-order`, `db-integration-list-order`, `admin-catalog-actions`, `admin-shop-hero` |
| 🟢 | Ürün, menü kalemi, promosyon, kategori ve iki slayt türünün kendi sayfasında Sil yoktu; uygulama içeriğinin Sil'i başlıkta ayrı duruyordu | Başlığın ⋯ menüsünde Sil (`then=list`: listeye döner, bildirim orada; liste adresi formdan alınmaz) | `admin-catalog-actions`, `admin-shop-hero`, `admin-confirm-ui` |
| 🟢 | Menü kalemini çoğaltmanın ve art arda kalem ya da masa girmenin yolu yoktu | Menü kaleminde "Kopyala" (`/admin/menu/yeni?kopya=`; kopya menüde görünmeden başlar), yeni menü kalemi ve masa formunda "Kaydet ve yenisini ekle"; Genel bakış'ta rolün "Yeni …" sayfaları (Hızlı ekle) | `admin-list-order`, `admin-catalog-actions`, `admin-cafe-tables-actions`, `admin-quick-create` |
| 🟢 | Uzun formlardan (menü kalemi, slaytlar, uygulama içeriği, promosyon) bir bağlantı yazılanı sormadan bırakıyordu | `GuardedActionForm` ve promosyon formunda `useUnsavedGuard` | `admin-unsaved-guard` |
| 🟢 | `db-integration-product-food-label` paylaşılan test veritabanında başka bir paketin sabit kimlikli ürünlerine (`prd-0001`…) denk gelip kırılıyordu | Test sayacı mevcut kimliklerin üstüne kaldırır (uygulamanın tohumu gibi, `raise_counter`) | kendisi |
| 🟢 | Sihirbazın sekmeli düzenleme başlıkları sahte italik serifti (CAT-26, sihirbaz kısmı); müşteri kartlarında, manuel siparişte, görsel yüklemede ve kayıt sayfalarında 10 px aralıklı büyük harf etiketler kalmıştı | Kitin başlık ve etiket yazısı (`CARD_TITLE`, `CARD_SUBTITLE`, `EYEBROW`, `LABEL`) | tarayıcı geçişi |

Açık (bu turda değişmedi):

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟠 | Panel sitenin kökeninde: sitedeki bir betik `fetch('/admin/…')` ile oturumlu operatör adına istek atabilir (§13, `src/lib/admin/session-cookie.ts`) | Ayrı alan adı (alt alan, yalnız-ana-makine çerezi) altyapı işi: DNS ve Vercel |
| 🟡 | 2FA isteğe bağlı | Operatör kararı (§11); durum hesap menüsünün "Güvenlik / 2FA" sayfasında ve Kullanıcılar'da. Genel bakış'a bir sürüm eklenen uyarı operatörün isteğiyle kaldırıldı (21 Eki 2026) |
| 🟢 | Çıkış kopyalanmış bir çerezi iptal etmez (7 gün) | Sunucu tarafı oturum sürümü bir migration ister (§11) |


### Panel: Innex görünümü ve düzenleri sonrası inceleme (#230, #231; 23 Eki 2026)

Operatör: _"Sen tüm hepsini yap maine yolla"_. #230 ve #231 birleştikten
sonra beş ayrı okuma yapıldı: faturalar, kayıt sayfaları, rakamlar, hızlı
bakış, kabuk ve takvim. Doğrulanan bulgular:

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Kesilmiş faturadan sonraki iade bir kez not ediliyor, hiçbir şey kapatmıyordu: Dikkat, Genel bakış ve yeni kenar rozeti onu sonsuza dek sayıyordu | "İade belgesini kestim" (satır adımı "Belgeyi kestim", kart, ⋯) belge numarasını yazıp kapatır; siparişin "Faturalı siparişte iade" işaretini kaldırmak da kapatır; sonraki iade yeniden açar (`refundNotedAt > refundHandledAt`). Migration `20261023100000` | `invoice-run`, `invoice-admin-actions`, `admin-invoice-row-step`, `db-integration-invoices` |
| 🟡 | Listenin ⋯ menüsü kimsenin görmediği taslak için "Faturayı kesinleştir" sunuyordu | ⋯ taslağın satırlarını Fatura sekmesinde açar | `admin-invoice-row-step` |
| 🟢 | Rozet, PDF e-postasından vazgeçilen kesilmiş faturaları saymıyordu (Dikkat sayıyordu) | `listAttentionInvoices` onları da verir, her satır bir kez | `db-integration-invoices` |
| 🟢 | PDF adımının erişilebilir adı "PDF" ile başlamıyordu (WCAG 2.5.3) | `aria-label="PDF indir: …"` | `admin-invoice-row-step` |
| 🟡 | Kural 29 tutması POS'a sorulmadan bırakılan karaoke rezervasyonunun tek talimatı Ödeme sekmesindeydi, sayfa Rezervasyon'da açılıyordu | Sayfa Ödeme'de açılır | `admin-karaoke-pages` |
| 🟡 | `DetailTabs` adresi Next'in geçmiş durumuyla yazıyordu: yönlendirici eski adresi tutup sonraki server action'da geri koyuyordu | `replaceState(null, …)`; sekme bağlantısı yalnız denetlenmiş dönüş yolunu taşır (ham `geri` asla), bozuk çapa atılmaz okunur | `admin-detail-tabs`, `admin-karaoke-pages` |
| 🟢 | "Fatura oluştur" Kalemler sekmesinde açılan sipariş sayfasına dönüyordu; taslak ve "Faturayı kesinleştir" görünmüyordu | Sihirbazın yönlendirmesi, geri ve vazgeç bağlantıları Fatura sekmesine (`invoiceCardHref`) | `invoice-wizard-action`, `admin-order-detail` |
| 🟢 | Müşteri sayfası `?sekme=`'yi okumuyordu | Diğer kayıt sayfaları gibi istenen sekmeyi çizer | `admin-customer-detail` |
| 🟢 | Hiç ödenmemiş iptal sipariş turuncu "Ödenmedi" çipi gösteriyordu | Rozetiyle aynı "Ödeme yok"; beklenen ödeme iki kez söylenmez | `admin-order-detail` |
| 🟡 | Raporlar, son dilimi yarım kalan dönemi önceki dönemin tamamıyla karşılaştırıyordu: düz satış her pazartesi sabahı ve ayın 1'inde kırmızı düşüş okunuyordu | Önceki dönem aynı noktada durur (`previousPeriodEnd`, köşkün saatiyle) | `admin-reports-compare` |
| 🟡 | "Barda en eskisi" ön siparişi ödemesinden ölçüyor, bar ekranının düşürdüğü siparişi sonsuza dek turuncu tutuyordu | Bar ekranının kuralı: planlı saatten, yoksa ödemeden; vakti gelmemiş beklemez, 24 saati geçen sayılmaz | `admin-dashboard` |
| 🟢 | "Bugünkü sipariş" raporda sayılanı sayıp iptaller dahil her ödenmişi açıyordu | Siparişler'e Ödeme → "Raporda sayılan"; kutu onu açar | `admin-order-reads`, `admin-dashboard` |
| 🟢 | Karaoke doluluğu geçen haftanın gelmeyenlerini (köşkte ödeme, akşamdan sonra iptal yazılan) düşürüyordu | `heldTheRoom` onları Gün sonu gibi sayar | `admin-karaoke-attention`, `admin-dashboard` |
| 🟡 | Hızlı bakış, açan satır listeden çıkınca (kendi "Pasif yap" / "Tükendi" adımı) adresi değiştiriyordu: liste geçmişe iki kez giriyor, sonraki Geri hiçbir şey yapmıyordu | Bu sayfanın bir satırı açtıysa Geri | `admin-quick-look` |
| 🟢 | Hızlı bakış tarihi geçmiş karşılaştırma fiyatını üstü çizili gösteriyordu | Listenin okuduğu canlı indirim (`liveCompareAtMinor`) | `admin-quick-look` |
| 🟢 | Menü kaleminin her kaydı olay kaydına "Alerjenler güncellendi" yazıyordu; köşkün yalnız L fiyatı adsızdı, listenin gösteremediği daha yeni değişiklik (toplu Tükendi) söylenmiyordu | Alerjen yalnız değişince; "L fiyatı ₺x" / "L boyu kalktı"; altında not | `admin-quick-look` |
| 🟢 | "Tümünü göster" odaktaki özetini gizleyip klavyeyi düşürüyordu; çekmece kapandıktan sonra gelen yanıt kaybolan bir yığına yazılıyordu; "Fiyatı değiştir" `lg` altında yapışkan çubuğun altına iniyordu | Özet "Daha az göster" olarak satırın sonunda kalır; yanıt panelin yığınına gider; `max-lg:scroll-mt-20` | `admin-quick-look` |
| 🟡 | Sonuçlar açıkken arama kutusu `invisible`'dı: kapanınca odak `<body>`'ye düşüyordu | `opacity-0`; odak kutuya döner | `admin-palette-core` |
| 🟡 | `?hafta=9999-12-27` haftası 9999'u aşıp sayfayı düşürüyordu; 0099 1999 okunuyordu | En çok beş yıl öteye; ötesi bu hafta | `admin-karaoke-calendar` |
| 🟢 | Arama kutusu `lg`'de dokunmatikte 36 px'ti (yatay iPad) | Dokunmatikte 44, farede 36 | `admin-palette-core` |
| 🟢 | Yana kayan satırlarda (durum sekmeleri, bölüm sekmeleri, parçalı denetim) odak halkası kaydırıcının kenarında kesiliyordu | `data-focus-inset`: halka denetimin içinde | `admin-ui-kit` |
| 🟢 | Alanlar açıkken araç çubuğunun uç grubu ilk satırda kalıyordu: klavye "Uygula"dan yukarı sıçrıyordu | Uç grup son satırda "Uygula"nın ardında | `admin-saved-views-bar` |
| 🟢 | Sayfalayıcıda geçerli sayfa gri rayda yalnız beyaz kutuydu (1.1:1) | Alan koyusu çerçeve (3:1) ve birincil mürekkep | `admin-ui-kit` |
| 🟢 | Takvim: 390 px'te uzun hafta adı oklara sığmıyordu; başka haftaya da "Bu hafta" deniyordu; üstüne gelince koyulaşan blok mürekkebi AA altına düşürüyordu | Telefonda üç harfli ay; "Bu hafta" yalnız bu hafta; gölgeyle kalkar | `admin-karaoke-calendar` |
| 🟢 | Liste ↔ Takvim geçişi listenin sekmesini ve süzgeçlerini sıfırlıyordu (tarif §3.7) | Takvimin her bağlantısı listenin parametrelerini taşır; yazılan arama çerezinde kalır | `admin-karaoke-calendar` |

**Ölçüm** (23 Eki 2026, `NODE_ENV=production next build`, Turbopack; her
admin rotasının `rootMainFiles` + `entryJSFiles` dosyaları, gzip -9, UI-14'ün
yöntemi). #230 öncesi `98c630e`, #231 sonrası `19c881b` ve bu incelemenin dört
dalı birleşmiş hâli karşılaştırıldı; 76 admin rotası:

| Rota | 98c630e | #231 sonrası | Dört dal sonrası |
| --- | --- | --- | --- |
| `/admin` | 212,0 | 212,5 | 212,6 |
| `/admin/siparisler` | 225,1 | 226,0 | 226,2 |
| `/admin/siparisler/[id]` | 222,5 | 224,4 | 224,5 |
| `/admin/kasa` | 215,8 | 216,2 | 216,4 |
| `/admin/mobil/karaoke` | 217,3 | 218,2 | 218,4 |
| `/admin/urunler` | 219,8 | 230,6 | 230,7 |
| `/admin/urunler/[id]` | 219,8 | 228,5 | 228,6 |
| `/admin/menu` | 225,3 | 228,8 | 228,9 |
| `/admin/ayarlar` | 229,6 | 231,2 | 231,3 |

- Dört dal hiçbir rotaya 0,2 KB'tan fazla eklemiyor.
- #231 iki ürün rotası dışında en çok 3,6 KB ekledi. `/admin/urunler`'in
  10,8 KB'ı modül modül: 6,6 KB lucide (ikon haritası 5,5 + ikon fabrikası
  1,1; hızlı bakış çekmecesi `AdminIcon`'u istemcide kullanıyor), kalanı
  çekmecenin kendi kodu. Kütüphane payı 8 KB sınırının altında.
- React Aria ve tarih paketi hiçbir admin rotasının ilk yüklemesinde yok.
- `/admin/kasa`'ya kütüphane kodu girmedi.

Açık (bilerek bırakıldı):

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Kullanıcılar'ın "Son giriş" sütunu hesap başına bir sorgu atıyor | Bugünkü hesap sayısında önemsiz; tek sorgu (`DISTINCT ON`) bir SQL fonksiyonu ister |
| 🟢 | `invoice_claim` her çalıştırmada fatura rozetinin önbellek etiketini düşürüyor | Veritabanını uyandırmaz (okuma yalnız panel açıkken); etiket sözleşmesini değiştirmek bayat rozet riski taşır |
| 🟢 | `AdminIcon`'u kullanan bir istemci bileşeni `ui/icons.tsx`'in bütün ikon haritasını (5,5 KB gz) rotaya getiriyor; 24 admin rotasında var (22'si #230'dan önce) | Kazanç yok (23 Eki 2026 incelendi): kenar çubuğunun menü ikonları (`admin-sidebar.tsx` → `nav-icon.tsx`, `next/dynamic`) aynı haritayı menüsü olan her admin sayfasında sonradan yükler. Haritayı ilk yüklemeden çıkarmak indirilen baytı azaltmaz, yalnız sırasını değiştirir; ikonları istemcide tek tek almak da `ui/icons.tsx`'in "her ikon bir kez adlandırılır" düzenini bozar |

### Panel: #233-#236 sonrası inceleme (23 Eki 2026)

Operatör: _"Başka unuttuğun ceya iyileştirilmesi gereken iş varsa yap"_.
Kayıtlı görünümler (#233), "Şu an aktif" (#234), Sistem durumu (#235) ve
boş veritabanı kurulumu (#236) birleştikten sonra iki bağımsız okuma
yapıldı. #233 ve #236'da bulgu yok. Doğrulanıp düzeltilenler:

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟡 | Neon API yavaş ya da sessizken sahibin Genel bakış ve Ayarlar sayfaları her açılışta 3 sn bekliyordu; başarısız yanıt tutulmuyor, aynı anda gelen istekler ayrı soruyordu | Başarısız yanıt bir dakika tutulur, eşzamanlı istekler tek soruyu paylaşır; Genel bakış uyarıyı kendi `Suspense` sınırında akıtır | `admin-neon-usage` |
| 🟢 | Anahtar tanımlıyken Neon yanıt vermeyince satır gri, kart "Her şey yolunda" kalıyordu: kota alarmı sessizce körleşiyordu | "Okunamadı" turuncu: kartı açar, Genel bakış'ta da görünür | `admin-neon-usage` |
| 🟢 | Dönem sonunu aşan tutulmuş yanıt yeni dönemde "Saatler doldu" diyebiliyordu | İyi yanıt dönem sonundan öte tutulmaz; geçmiş dönemin yanıtı okunamadı sayılır | `admin-neon-usage` |
| 🟢 | Yüzde yuvarlanıyordu: 79,6 saat yeşil "%80" yazıyordu | Aşağı yuvarlanır | `admin-neon-usage` |
| 🟢 | Etkinlik yazımı başarısız olunca dakikalık sınır kalkıyordu: veritabanı yokken her istek tek bağlantının arkasına bir yazım daha ekliyordu | Başarısızlıkta da dakika beklenir | `admin-activity` |
| 🟢 | Pasif, parolası / rolü değişmiş ya da Çıkış'a basmış hesap beş dakika "Şu an aktif" görünüyordu ("Pasif" rozetinin yanında) | `inPanelNow`: `isActive`, `updatedAt` ve en yeni `logout` kaydı (`lastSignOuts`); Çıkış kaydı küçük harfli adresle yazılır | `admin-activity`, `admin-people-lists`, `admin-audit-log` |
| 🟢 | Hesap silinirken biten bir istek etkinlik satırını geri yazabiliyordu; aynı adres yeniden açılınca eski etkinliği gösteriyordu | Kullanıcı oluşturulunca adresin etkinlik kaydı silinir | `admin-activity` |

Açık (bilerek bırakıldı):

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Etkinlik yazımı koşulsuz: yavaş bir yanıt başka bir sunucunun yazdığı daha yeni zamanı en çok kendi süresi kadar geri alabilir | Beş dakikalık pencerede önemsiz; koşullu upsert sorgu kurucuya yeni bir biçim ister |
| 🟢 | `isUpToDate`'in eksik tablo yakalaması işlem içinde 25P02'yi geri getirebilirdi | Ulaşılamaz: kilidin altında `to_regclass` tablonun var olduğunu az önce söylemiştir |

### Köşk paneli bağlantısı ve canlı hatalar (23 Eki 2026)

Operatör: köşk panelinin (`RiosenBeq/lafmaliyet`) denetiminden çıkan 14 madde
ve Vercel'in son 7 günlük çalışma hataları. Her madde ayrı PR (#240-#253),
`/api/panel/*` yalnız ekleme aldı, KVKK beyaz listesi değişmedi. Panelin
kendi tarafı ayrı oturumda yapılır; yeni alanlar PR gövdelerinde.

| Derece | Bulgu | Düzeltme | Test |
| --- | --- | --- | --- |
| 🟠 | `%5C` / `\` içeren yollar (`/karaoke%5C`, `/%5C%5C%5C`) pages-router aramasında MODULE_NOT_FOUND ile 500 veriyordu (~60 kayıt, 20-21 Eki) | `proxy.ts` `/api/*` dışında böyle bir yola düz 404 verir (yönlendirme yok); ikinci matcher statik dosyaları da kapsar. `/api/*` kendi sözleşmesinin hatasını vermeye devam eder (#244) | `proxy-backslash` |
| 🟡 | Supabase oturum yenilemesi Supabase çerezi olan her sayfada kimlik sunucusunu bekliyordu ("getUser timed out" 472 kayıt, 9-17 Eki); fra1 ↔ Singapur | Yenileme yalnız `/uye` altında (oturumu yalnız orası okur); zaman aşımında çerez silinmez ya da yeniden yazılmaz (#245) | `supabase-session-refresh`, `proxy-fast-path` |
| 🟡 | `DATABASE_URL`'siz bir üretim derlemesi yayına çıkıp bozulmuş içerikle çalıştı (15-17 Eki) | `VERCEL_ENV=production` iken `DATABASE_URL` yoksa derleme kırmızı (`scripts/check-build-env.mjs`, `vercel.json` `buildCommand` ve `prebuild`); önizleme, yerel, CI etkilenmez (#253) | `build-env-check` |
| 🟡 | Dağıtımdan önce açılmış sayfadaki Server Action ("Failed to find Server Action") müşteriye işe yaramayan "Tekrar dene" gösteriyordu; ödemede "bağlantı kurulamadı" diyordu | Hata sınırı ve ödeme bu hatayı adıyla tanır, "Sayfayı yenile" der; sepet ve teslimat taslağı yenilemede kalır (#251) | `stale-action` |
| 🟢 | Karaoke iadesinde POS reddi yöneticiye ham PayNkolay metniyle ("responseCode=0 Bu kayıt daha önce iptal edilmiştir..!") gidiyordu: yeniden deneme, iptal, uyarı e-postası, geçmiş satırı. Sipariş iadesi #225'te düzelmişti; Resend 422 test verisiydi | `refundAnswerForStaff` bilinen durumları cümleyle söyler, gerisini düşürür; ham metin günlükte ve olay kaydında kalır (#252) | `refund-answer`, `admin-karaoke-actions`, `admin-karaoke-panel`, `db-integration-karaoke-prepay` |
| 🟠 | Bar ekranı üyenin sipariş notunu ("Fındık alerjim var") ve satır notunu göstermiyordu | `toPanelOrder` `note` (yalnız masa ve gel-al, 300 karakter; kuryede "" - kapı kodu) ve satır `note` (200); sipariş sayfası ve personel e-postası satır notunu gösterir (#248) | `panel-orders-feed`, `db-integration-panel-feeds`, `staff-order-notice`, `admin-order-detail` |
| 🟡 | Bar ekranı okuması unutulmuş siparişlerle 201 satırı doldurup bugünkü siparişleri gizleyebiliyordu; `complete` süzülmüş listeden hesaplanıyordu | Unutulmuş kuralı sorguda alt sınır (`panelOrdersLiveSince`, `anyOf` `gte`); `complete` ham satır sayısından (#249) | `db-integration-panel-feeds` (250 + 250 unutulmuş), `panel-orders-feed`, `db-sql` |
| 🟡 | Kartı başarısız olup kasada nakit / kasa kartıyla "Ödendi" işaretlenen uygulama / web siparişi online satışta da sayılıyordu (ciro, KDV, tüketim iki kez) | `payment_transactions`'tan okunur; `manual:nakit` / `manual:kart` `counter` bloğuna (cafe, shop ve satırlardan çıkar); havale ve "Diğer" online kalır (#246) | `panel-sales-export`, `db-integration-panel-feeds` |
| 🟢 | Menü okumasında `now` okumadan sonra alınıyordu: toplu fiyat değişikliğinde panel eski fiyatı daha yeni sanabiliyordu | `now` okumadan önce (#242) | `panel-menu-link` |
| 🟢 | Panel, sitede tek boy olan kaleme L fiyatı yazarak kapatılmış boyu açabiliyordu | 409 `single_size`, hiçbir alan yazılmaz (#243) | `panel-menu-link` |
| 🟢 | Panelin menü okuması ve yazımı her kalemin fotoğrafını (2 MB'a kadar data URL) da okuyordu | `listMenuItemsForPanel` / `getMenuItemForPanel` yalnız sekiz sütun; yazım da yalnız onları döndürür (#241) | `panel-menu-columns`, `db-integration-panel-menu` |
| 🟢 | Karaoke okuması 2000 satırı aşarsa en yakın günleri düşürüyordu | Panel okuması erkenden geçe (`ascending`); kesilen uzak uç (#250) | `api-panel-karaoke-route`, `db-integration-karaoke-prepay` |
| 🟢 | Online kafe satırları süt, şurup ve ekstra shot seçimini düşürüyordu | `cafe.lines[]` `extraShots`, `milks`, `syrups` (yalnız sıfırdan büyükse) (#247) | `panel-sales-export`, `db-integration-panel-feeds` |
| 🟢 | Panelin okuduğu Paraşüt kayıtları (site ne açar, iadeyi kim keser) belgede yoktu | `docs/EARSIV.md` §9: site iade / iptal belgesi kesmez; panel gider faturalarını süzmeden (iptali listede ve listeden düşen kaydı yeniden okuyarak görür) ve gelen e-Faturaları `GET e_invoices`'tan okur, kurumsal alıcının iade e-Faturasını kural 5 ayırır; kategori işareti eklenmedi (nedeni §9.5) (#240) | `earsiv-panel-records` |

Açık (operatörün):

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟡 | Vercel'de `DATABASE_URL`'in Preview ortamında da tanımlı olduğu buradan doğrulanamadı | Ortam değişkenleri okunamıyor; derleme denetimi yalnız Production'ı zorlar |
| 🟢 | Supabase projesi Singapur, fonksiyonlar fra1, Neon us-east-2 | Bölge taşıması ayrı karar; Supabase'in JWT imzası asimetrik değilse `getClaims()` yine `getUser()`'a düşer |
| 🟢 | İki projenin `PARASUT_COMPANY_ID`'si aynı mı | Değerler okunamıyor (`docs/EARSIV.md` §9) |
| 🟡 | Panel, kurumsal alıcının gelen iade e-Faturasını (`IADE`) eksi tutarlı gider olarak açar | Panel tarafı (`lafmaliyet`), ayrı oturumda; kural `docs/EARSIV.md` §9.4 kural 5 |
| 🟢 | Panel 409 `single_size`'ı "Siteye ulaşılamadı" diye gösterir | Panel tarafı, ayrı oturumda; yanıt `docs/PANEL-MENU.md` hata tablosunda |
