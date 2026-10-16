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

**Kampanya e-postası İYS'ye bağlı değil (8 Eyl 2026).** Yasal metinler onayın
İYS'ye kaydedileceğini ve gönderim öncesi İYS'den kontrol edileceğini söylüyor
(`legal/content.ts`); kodda İYS istemcisi yok. Kitle kuralı, üye çıkış jetonu,
tek tıkla çıkış (POST) ve gönderim defteri hazır (`docs/EMAIL-RESEND.md` §7);
İYS kaydı ve Resend ücretsiz planının günlük 100 e-posta sınırı (100'den
kalabalık kitleye göndermeden plan yükseltilmeli) açık. Bounce/şikâyet
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
formunun POS'a gidişi (CSP artık izin veriyor), `PaymentList` üretim ucu ve
dönüş hash'inin `CURRENCY_CODE` alanı.

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
| 🟡 | Üçüncü bağımsız inceleme (16 Eki 2026) arıza ve eşzamanlılık pencerelerinde yedi düşük dereceli kusur buldu, arızasız çalışmada hiçbiri yok: kasa −1'de satır yazıldıktan sonraki karşılama okuması hata verirse operatör hata görüyor, damga gitmiş oluyor, tekrar tıklama ikinci damgayı alıyordu; `redeemStamps` kaybedilen yarışın `redeem` satırını silemezse kuponsuz kart kalıyor ve sonraki her ayar gerçek ücretsiz içeceği onun için geri alıyordu; kupon ekleme hatasında önce kupon pasifleştirilip sonra satır siliniyordu (ikinci yazı düşerse harcanabilir yetim kupon, ilk yazı düşerse ölü kupon için yanmış damgalar); iptal edilen bir `redeem` satırının `unredeem` talebi satırdan uzun yaşayıp üyeye bedavaya kart kredisi veriyordu; eski talebi silen ayar, kuponu bu arada başka bir ayar geri almışsa talebi silip tek borca iki ücretsiz içecek yazdırıyordu; kasa −1'e çift tıklama iki satırı birlikte görünür bırakıyor, o anda çalışan bir ayar ücretsiz içeceği alıyordu | 16 Eki 2026 üçüncü inceleme düzeltmeleri: (1) kasa satırının kimliği `tillCorrectionId` ile ana defterin parmak izinden türer, aynı defteri okuyan iki tıklama aynı kimliği yazar ve birincil anahtar birini alır, kaybeden defteri yeniden okur: kasa düzeltmeleri hiç üst üste binmez. Karşılama okuması düşerse satır geri çekilir ve hata gösterilir; geri çekme de düşerse satır kalır ve tıklama başarılı döner (hata gösterip yeniden tıklatmak ikinci damgayı alırdı). Cevabı kaybolan ekleme hatadan önce geri alınır. **Bilinen pencere (belgelenmiş):** kasa düzeltmesi FARKLI bir yazarla (bozdurma, sipariş iadesi) yarışırsa satır geri çekilene kadar geçen milisaniyelerde o anda çalışan bir ayar aşımı görüp bir ücretsiz içeceği alabilir; kapatmak işlem ya da veritabanı fonksiyonu ister, havuz tek ifadeli olduğundan yapılmadı. (2) Telafi yazıları `attempt` ile üç kez denenir, hiç hata fırlatmaz. `redeemStamps` kaybettiği yarışta satırını silemezse kuponsuz kart kalır; ayar `abandonedCards` ile 2 dakikalık süre (`REDEEM_ROW_GRACE_MS`) geçince onu siler (uçuştaki bir bozdurma süreden gençtir, dokunulmaz; kupon ekleme duraklatılmış sorguyla denendi) ve süre dolmadan da hiçbir ayar kuponsuz kart için gerçek kuponu geri almaz (`couponlessCards` ayarın baktığı defterden çıkarılır). Reddedilen bozdurma dokunuşu kendisi de tetikleyicidir. (3) Hata yolunda sıra: önce `redeem` satırı silinir, sonra talebi, sonra kupon pasifleştirilir; satır silinemezse ikisi de olduğu gibi kalır (kupon kartı ayaktayken asla geri alınmaz), kupon pasifleştirilemezse yetim kural güvenlik ağıdır. (4) Ayar, `redeem` satırı olmayan `unredeem` talebini (`orphanClaimIds`) siler; bozdurma geri alması talebi de siler. (5) Her kupon geri alımından ve her eski talep silişinden sonra talep yeniden denetlenir (`restoreClaim`): kupon pasif, kullanılmamış ve kartı ayakta ama talep yoksa talep geri yazılır; iki taraftan biri her zaman son bakandır. **Politika (değiştirilmedi, kasıtlı):** yetim ve yarım kalmış geri almalar karşılama ne olursa olsun yapılır; elle silinen `redeem` satırı kuponu geri aldırır (iade yok). **Yeni sonuç:** yönetici bir ödül kuponunu elle silerse (`revokeCustomerCoupon`) kartı kuponsuz kalır ve süre sonunda damgaları geri verilir. Testler: `tests/mobile-loyalty-coverage.test.ts` ("review 5" blokları, 3000 vakalık özellik testi artık bir ile dört ardışık yazıyı (kesinti) de düşürür ve üç değişmezi daha denetler: kartın kuponu, talebin kartı, geri alınmış kuponun talebi; arıza çıkan adımlar süre sonrası iyileştirme adımından sonra da atlanmaz), `tests/mobile-loyalty-partial-core.test.ts` |
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
| 🟠 | Admin ekranları sipariş tablosunun tamamını her sütunuyla okuyordu (`listOrders()`): pano 5 satır için, sipariş listesi hepsini istemci bileşenine basarak, müşteriler ve raporlar birkaç sütun için (raporlar sayfa başına üç kez). 20 bin siparişte çağrı başına 596 ms ve 27 MB JSON | `listOrders` kaldırıldı. Pano `listRecentOrders(5)` (1 ms); liste 100'lük anahtar sayfaları (`?once=`, 3 ms, 0,14 MB; eski sayfalarda yeni sipariş yoklaması yok); müşteriler 6 sütun (67 ms); raporlar sütun izdüşümü, yalnız en çok satanlar `items` okur (~1,8 sn → ~0,28 sn) | `admin-order-reads` |
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

### Açık

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟡 | Admin girişinde hesap başına (adresten bağımsız) tavan yok: çok sayıda adresi olan biri (botnet, konut proxy'si) bir hesaba adres başına 5 / dk deneme yapabilir | Operatör kararı: hesap tavanı, adını bilen herkese o hesabı (kasiyer dahil) kilitletir. Önerilen: sahip ve yönetici hesaplarında 2FA'yı açmak (`/admin/2fa-kurulum`); 2FA adımının hesap tavanı zaten var |
| 🟢 | Admin çıkışı yalnız bu tarayıcının çerezini siler; daha önce kopyalanmış bir çerez 7 gün geçerli kalır (parola değişince düşer) | Sunucu tarafı iptal bir migration (oturum kimliği ya da hesap başına dönem) ister; ayrı PR |
| 🟢 | `/bulten/onay?token=` ve `/bulten/cikis?token=` da GTM yükleyen sayfalarda belirteci adreste taşıyor (sızan belirteçle başkası aboneliği onaylayabilir ya da bitirebilir) | Etkisi sıfırlama belirtecinden küçük; aynı `proxy.ts` deseni uygulanabilir, ayrı PR |
| 🟢 | `script-src` hâlâ `'unsafe-inline'` taşıyor | Kayıtlı karar (`next.config.ts`): nonce kök layout'u ve statik sayfaları dinamik yapar |
| 🟢 | `CUSTOMER_SESSION_SECRET` tanımsızsa müşteri çerezi admin anahtarıyla imzalanır. Bugün çapraz kullanım parmak izi ve biçim farkıyla reddediliyor, ama tek savunma bu | Operatör: Vercel'de ayrı, en az 32 karakterlik `CUSTOMER_SESSION_SECRET` tanımlamak (müşteriler bir kez yeniden giriş yapar) |
| 🟢 | `npm audit`: `source-map-js` (yüksek, yalnız derleme anında, saldırgan girdisi görmüyor) | Ulaşılamaz; `next`'in kendi bağımlılığıyla güncellenir |
