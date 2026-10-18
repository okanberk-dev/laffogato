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
formunun POS'a gidişi (CSP artık izin veriyor), `PaymentList` üretim ucu (17 Eki
2026'da canlıda doğrulandı, `docs/PAYNKOLAY.md` §2) ve dönüş hash'inin
`CURRENCY_CODE` alanı.

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

### Açık

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟡 | Admin girişinde hesap başına (adresten bağımsız) tavan yok: çok sayıda adresi olan biri (botnet, konut proxy'si) bir hesaba adres başına 5 / dk deneme yapabilir | Operatör kararı: hesap tavanı, adını bilen herkese o hesabı (kasiyer dahil) kilitletir. Önerilen: sahip ve yönetici hesaplarında 2FA'yı açmak (`/admin/2fa-kurulum`); 2FA adımının hesap tavanı zaten var |
| 🟢 | Admin çıkışı yalnız bu tarayıcının çerezini siler; daha önce kopyalanmış bir çerez 7 gün geçerli kalır (parola değişince düşer) | Sunucu tarafı iptal bir migration (oturum kimliği ya da hesap başına dönem) ister; ayrı PR |
| 🟢 | `/bulten/onay?token=` ve `/bulten/cikis?token=` da GTM yükleyen sayfalarda belirteci adreste taşıyor (sızan belirteçle başkası aboneliği onaylayabilir ya da bitirebilir) | Etkisi sıfırlama belirtecinden küçük; aynı `proxy.ts` deseni uygulanabilir, ayrı PR |
| 🟢 | `script-src` hâlâ `'unsafe-inline'` taşıyor | Kayıtlı karar (`next.config.ts`): nonce kök layout'u ve statik sayfaları dinamik yapar |
| 🟢 | `CUSTOMER_SESSION_SECRET` tanımsızsa müşteri çerezi admin anahtarıyla imzalanır. Bugün çapraz kullanım parmak izi ve biçim farkıyla reddediliyor, ama tek savunma bu | Operatör: Vercel'de ayrı, en az 32 karakterlik `CUSTOMER_SESSION_SECRET` tanımlamak (müşteriler bir kez yeniden giriş yapar) |
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

Not: el yapımı küçük düğmeler artık sınıflarının söylediği boyutta çizilir
(ör. sipariş listesinde "Ses kapalı" ve müşteri kartında "Düzenle" 11px);
kit düğmelerine taşınmaları kendi alanlarının PR'larında. Fişsiz bir admin
sayfası yazdırılınca telefon üst çubuğu da basılır; kenar çubuğu, üst çubuk
ve çekmecedeki `print:hidden` kabuk gezinme PR'ında.

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟠 | GTM konteynerini yayımlayabilen biri sitenin herkese açık sayfalarında hâlâ betik çalıştırır. Admin çerezi bütün köken için (`path=/`, `sameSite=lax`): oturumu açık bir yönetici aynı tarayıcıda siteyi gezerken o betik `/admin` sayfalarını çerezle okuyabilir ve server action çağırabilir (aynı köken, CSP `connect-src 'self'` izin verir) | Yukarıdaki düzeltme yalnız panelin kendi belgelerini GTM'siz yapar. Panele özel CSP (D34) de bunu kapatmaz: betik panelde değil sitede çalışır. Kapatan, panelin ayrı bir kökene (alt alan adı, yalnız o alana yazılan çerez) taşınması; ayrı karar ve arka yüz işi. O zamana kadar GTM yayın yetkisi dar tutulur, panel siteyi gezmekte kullanılmayan bir tarayıcı profilinde açılır |

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

Açık (katalog paketinin kalanı; adım 4 ve 5 aşağıda, "Katalog: stok ve tohumlar"):

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Menü ve vitrin tarafı: menü toplu kaydı kimlik, vitrin silme başlık yazmıyor (CAT-20), menü / kategori / vitrin "Vazgeç" (CAT-22), vitrin güncellemesi silinmiş slaytta (CAT-28), diğer katalog ekranlarının metni (CAT-24), toplu geri çağırmalar `withPanelCatch` (CAT-17) | Kendi dosyalarının PR'larında (5c, 5d) |

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

Açık (paket 4a'nın dışında kalan kısımlar):

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Üye sayfasında `<ul>` içinde `<div>`, "-" başlıklı işlem sütunları, 32 px başlık bağlantıları (PEO-20'nin kalanı); kampanya formunun hata kutusunda rol yok (PEO-09, `campaign-mail-form.tsx`) | Kendi dosyalarının PR'larında (4b üye sayfası, 4c kampanya ekranları) |

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

Karaoke sekmesi ve kaydı ayrı dosyalarda (`karaoke-tab.tsx`, `karaoke-actions.ts`;
karaoke iade kuralı işi onların üstüne kurulur).

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Panodaki "Ayarlar → E-posta" (SHE-24) ve Olay kaydındaki ayar satırlarının bağlantısı hâlâ `/admin/ayarlar` (karaoke panelininki paket 3a'da `?sekme=karaoke` oldu) | `?sekme=` hazır (`settingsTabHref`, kayıt kimliği "email-test" de E-posta'yı açar); bağlantılar kendi dosyalarının PR'larında (7b, 7c) |
| 🟢 | Panel içi bağlantıyla (kenar çubuğu) sayfadan çıkış kaydedilmemiş değişikliği sormuyor; uyarı yalnız sekme kapatma ve yenilemede | İstemci gezinmesini kesmek kabuk gezinme işi |
| 🟢 | Kitin `ActionForm`'u da yöntemsiz `<form>`: sayfa yüklenmeden basılırsa alanları adrese yazar (SS-F1'in kit kısmı) | Kit dosyası (`action-form.tsx`) bütün panel formlarını etkiler; bu paketin dışında |

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
| 🟢 | Pano kartı hâlâ eski okumayı (bugün + iade borçları) kullanıyor (KAR-07, pano kısmı) | `src/app/admin/page.tsx` paket 7b'nin; `loadKaraokeTodayCard` hazır |

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
| 🟢 | Hukuki metinler sitenin anında sildiğini söylüyordu | `hesap-silme` (§1-§4, §8: talep, 30 gün, geri alma, saklanan kayıtlar), Üyelik Sözleşmesi §14, KVKK başvuru formu, Gizlilik Politikası; dördü de 18 Ekim 2026 tarihli | `legal-account-deletion`, `legal-dates` |

Açık:

| Derece | Bulgu | Neden açık |
| --- | --- | --- |
| 🟢 | Kenar çubuğunda açık silme talebi sayısı yok | Kenar çubuğu kabuk gezinme PR'ında (1c) yeniden yazılıyor; Müşteriler bandı ve ekip e-postası şimdilik yeter |
| 🟢 | Uygulamanın hukuki metin kopyası (`lafmobil` `legal.seed.json`) eski metni taşır | Ayrı uygulama PR'ında yeniden dışa aktarılır; uygulama metni zaten `GET /legal`'dan okur |
