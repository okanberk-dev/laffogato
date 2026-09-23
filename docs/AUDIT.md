# Denetim — Eylül 2026

Sitenin tamamı on boyutta (güvenlik, doğruluk, ödeme, mevzuat, SEO,
erişilebilirlik, performans, UX, Next.js uyumu, ölü kod) denetlendi. Ham bulgular
çatışmalı doğrulamadan geçirildi: her iddia, çürütmeye çalışan ayrı bir okuma ile
karşılaştırıldı ve yalnızca ayakta kalanlar buraya alındı.

> **Durum:** Denetim partisi ve sonrasında yapılanlar canlıda. `main` doğrudan
> production'a deploy oluyor (`laffogato.net`), migration'lar da uygulamanın
> kendisi tarafından uygulanıyor — bkz. §6. Bekleyen tek operasyonel iş
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
verilmesi kadar kolay olmak zorunda. Bootstrap çerezi tarayıcıda okur —
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
| TOTP 2FA sırları **process içi Map'te** — yeni instance'ta 2FA sessizce devre dışı (fail-open)  | `admin_2fa` tablosu; DB'ye ulaşılamazsa `has2FA` **throw eder**                              |
| Giriş kilidi de process içi Map'ti: saldırgana **her cold start'ta 5 hak**                      | `auth_attempts` tablosu + atomik `record_auth_failure`                                       |
| Müşteri girişinde **hiç rate limit yoktu**                                                      | Aynı sayaç; 2FA kodu ve promosyon önizlemesi de bağlandı                                     |
| POS iade çağrısının hatası yutuluyor, admin'e **"iade edildi"** deniyordu                       | Önce POS çağrılıyor; başarısızsa iade hiç kaydedilmiyor                                      |
| Offer fiyatı **tam liraya yuvarlanıyordu** — ₺184,90 ürün Google'a ₺185 olarak yayımlanıyordu   | Fiyat kuruş biriminden üretiliyor; `priceLabel()` kuruşu koruyor                             |
| Yüklenen ürün görselleri **base64 olarak her sayfanın RSC payload'ına** giriyordu               | `/gorsel/...` rotalarından, önbelleklenebilir şekilde                                        |
| Server action gövde limiti 1 MB'ta: **3+ fotoğraflı ürün sessizce kaydedilmiyordu**             | `bodySizeLimit: "12mb"`                                                                      |
| Admin'deki "arama motorlarına aç" anahtarı **hiçbir şey yapmıyordu**                            | `robots.ts` ve `sitemap.ts` artık okuyor                                                     |
| Çalışmayan rezervasyon formu, JSON-LD ve meta'da **var olan hizmet gibi** duyuruluyordu         | `acceptsReservations: false`; buton `tel:` bağlantısı                                        |
| `/ziyaret` ve `/hikayemiz` **admin ayarlarını yok sayıyordu**                                   | İki sayfa da ana sayfayla aynı yükleyiciyi kullanıyor                                        |
| Ayarlardaki SEO başlığı, OG görseli ve hero görseli **hiçbir yerde okunmuyordu**                | Üçü de bağlandı                                                                              |
| **Parola sıfırlama yoktu** — dört yayımlanmış belge varmış gibi anlatıyordu                     | `/uye/sifremi-unuttum` + `/uye/sifre-sifirla`                                                |
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
- Boş veritabanına iki demo sipariş yazılıyordu — canlıda da. ₺740 uydurma ciro
  ve iki uydurma müşteri. Artık `SEED_DEMO_ORDERS=1` arkasında.

**Yapısal veri**

- Veritabanı kesintisinde menünün tamamı JSON-LD'de **0₺** olarak
  yayımlanıyordu (fiyatlar "—" render edilir, eski ayrıştırıcı bunu 0 yapıyordu).
- Stokta olmayan ürün `InStock` ilan ediliyordu.
- Kargo ücreti listede ₺29, ürün sayfasında ₺49, checkout'ta gerçek değerdi.
- `openingHoursSpecification` derleme zamanı sabitiydi; panelden değişen saat
  Google'a hiç ulaşmıyordu.
- FAQ'daki posta kodu (34953) sitenin geri kalanıyla (34940) çelişiyordu.
- `inLanguage` geçersiz BCP-47 değeri taşıyordu (`tr_TR`).
- `robots.txt`'te bot-özel gruplar disallow listesini iptal ediyordu: yirmi bot
  `/admin`, `/api`, `/odeme` ve `/uye`'ye davet ediliyordu.

**Erişilebilirlik** — hepsi aynı biçimde: fare ve gözle çalışıyor, başka
hiçbir şeyle çalışmıyordu.

- Sepet çekmecesi, ürün modalı, arama katmanı ve mobil filtre sayfası odağı
  içeri almıyor, Tab'ı tutmuyor, kapanınca odağı geri vermiyordu. Çekmece ve
  sayfa kapalıyken DOM'da kaldığı için düğmeleri ekran dışında sekme sırasındaydı
  ve `aria-modal` kalıcı duyuruluyordu — ekran okuyucu sitenin her sayfasında
  bir diyalog açık sanıyordu.
- Sepete ekleme, reddedilen promosyon kodu ve başarısız giriş yalnızca piksel
  değiştiriyordu.
- Mega menü yalnızca hover ile açılıyordu; `aria-expanded` klavyede hiç `true`
  olamıyordu.
- Hesap menüsü `change` olayında yönlendiren bir `<select>`'ti — birkaç
  tarayıcıda ok tuşuyla gezerken her seçenekte tetiklenir — ve odak halkası
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
- Oturum çerezi 30 gün boyunca saf taşıyıcıydı; parola değiştirmek — biri
  oturumunun çalındığından şüphelenince yaptığı tek şey — hiçbir çerezi
  geçersiz kılmıyordu.
- Site hiçbir güvenlik başlığı göndermiyordu: CSP, HSTS, nosniff, çerçeveleme
  kuralı, hiçbiri.

**Performans**

- 351 KB'lık PNG, 40 px'lik logo için CSS mask olarak her sayfada iniyordu —
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
- Promosyon kodu önizlemesi kimlik doğrulamasız ve sınırsızdı — kod
  numaralandırma için çalışan bir kâhin.
- Menü kalemine panelden fotoğraf eklemek imkânsızdı: alan yalnızca `public/`
  altındaki bir yolu kabul ediyor, girilen https adresini sessizce siliyordu.

---

## 5. Açık kalanlar

> **Güncelleme (6 Eyl 2026):** sanal POS kararı **PayNkolay** oldu; üretimde
> kullanılan sağlayıcı odur. Aşağıdaki iyzico bölümü o günkü durumun kaydı
> olarak duruyor — güncel kurulum, hash formülleri, açılış kontrol listesi ve
> "PayNkolay webhook göndermez" kuralı için `docs/PAYNKOLAY.md`. Aşağıdaki iki
> tuzaktan ikincisi (`PAYMENT_PROVIDER` her ortamda tanımlı olmalı) sağlayıcıdan
> bağımsız olarak geçerlidir.

**iyzico canlıya alınmadı — sonraya bırakıldı.** Sağlayıcı kodu, imza şeması,
Checkout Form akışı, tarayıcı dönüşü (`/odeme/donus`), imzalı webhook ve iade
çağrısı yazıldı ve derleniyor; ama sandbox'ta uçtan uca denenmedi ve canlı
anahtarlar tanımlanmadı. Bu bilinçli bir sıra: ödeme, geri kalan her şey
oturduktan sonra açılacak.

Açmak için gereken, kodda değil ortam değişkenlerinde:

```
PAYMENT_PROVIDER=iyzico
IYZICO_API_KEY=...
IYZICO_SECRET_KEY=...
IYZICO_BASE_URL=https://sandbox-api.iyzipay.com   # önce sandbox
IYZICO_CALLBACK_URL=https://laffogato.net/odeme/donus
PAYMENT_WEBHOOK_SECRET=...                        # iyzico panelindekiyle aynı
```

İki tuzak, ikisi de bu denetimde bulundu:

1. `IYZICO_CALLBACK_URL` **webhook adresi değildir**. iyzico oraya müşterinin
   _tarayıcısını_ POST eder; webhook adresi verilirse müşteri ödemeden sonra
   401 JSON görür. Sunucudan sunucuya bildirim iyzico panelinde ayrıca
   tanımlanır ve `/api/webhooks/payment` adresine gider.
2. `PAYMENT_PROVIDER` **her ortamda tanımlı olmalı**. Tanımsız bırakmak artık
   sessizce mock'a düşmüyor, üretimde açıkça hata veriyor — çünkü mock, para
   almadan siparişi `paid` yapar.

Sandbox'ta doğrulanacaklar: başarılı ödeme → sipariş `paid` + stok düşümü +
onay e-postası; başarısız ödeme → sipariş `pending_payment` kalır; kısmi iade →
iade defterine yazılır ama sipariş `refunded` olmaz; ve webhook ile tarayıcı
dönüşü aynı ödemeyi iki kez işlemez (`provider_ref` unique kısıtı).

**11 mağaza ürününün ve 2 hero slaydının görseli yok.** Bu bir kod hatası
değil, eksik içerik: ürün fotoğrafı çekilip panelden yüklenmeli. Yükleyici
artık çalışıyor ve görseller önbelleklenebilir bir adresten servis ediliyor;
eksik olan fotoğrafların kendisi. Bu ortamın giden bağlantısı görsel
sunucularını (Unsplash, Pexels, Wikimedia) engellediği için stok fotoğraf da
indirilemedi — kartlar bu yüzden markaya özgü SVG çizimlerle render ediliyor.

**SPA'nın beş sayfası tek client chunk'ta.** `pages.tsx` tek bir 2.900 satırlık
dosya; kod bölme için önce dosyanın kendisinin bölünmesi gerekiyor. Kazanç
gerçek ama düşük önemli bir bulgu için taşınan regresyon riski yüksek —
bilinçli olarak ertelendi.

**Kampanya e-postası İYS'ye bağlı değil (8 Eyl 2026).** Yasal metinler onayın
İYS'ye kaydedileceğini ve gönderim öncesi İYS'den kontrol edileceğini söylüyor
(`legal/content.ts`); kodda İYS istemcisi yok. Kitle kuralı, üye çıkış jetonu,
tek tıkla çıkış (POST) ve gönderim defteri hazır (`docs/EMAIL-RESEND.md` §7);
İYS kaydı, bounce/şikâyet bastırma listesi ve Resend ücretsiz planının günlük
100 e-posta sınırı (100'den kalabalık kitleye göndermeden plan yükseltilmeli)
açık.

---

## 6. Denetim sonrası yapılanlar

Denetim partisinden sonra, canlı siteye bakarken ya da kullanıcıdan bilgi
geldikçe eklenenler.

**MERSİS numarası yayımlandı.** `0734069467300012`, işletme sahibinin ibraz
ettiği ticaret sicil kaydından. Şirket Bilgileri tablosunda ve Organization
JSON-LD'sinde `identifier` olarak görünüyor. **Ticaret sicil / dosya numarası
işletme sahibinin tercihiyle yayımlanmıyor**, KEP adresi de henüz yok — ikisi de
boş bırakıldığı için ilgili tablo satırları hiç basılmıyor. (TTK m.39 ticari
belgelerde sicil numarasını da arar; yayımlanması istenirse `entity.ts` içinde
`tradeRegistryNo: "48639"` yazmak yeterli, gerisi otomatik.)

**Mobil hero sayfayı hapsediyordu.** Hero `100svh` yüksekliğindeydi ama alt tab
bar `position: fixed` ve hero'nun son 56 pikselini örtüyordu — yani kendi
kaydırma göstergesi barın arkasında kalıyor ve altında hiçbir şey görünmüyordu.
Telefonda gördüğün ilk ekran, devamı olmayan bir sayfa gibi duruyordu. Hero
artık barı, safe-area inset'ini ve bilinçli 40px'i çıkarıyor; her cihazda aynı
96px'lik bir sonraki bölüm kenarı görünüyor. Ayrıca widget'ın canvas'ına
`touch-action: pan-y` sabitlendi: vendor bundle three.js OrbitControls üzerine
kurulu ve OrbitControls bağlanırken `none` yazıyor — bugün `pan-y`'ye çekiyor,
ama bir yeniden derleme bunu geri alsa tam ekran hero telefonda kaydırılamaz
hâle gelirdi ve bunu telefon dışında fark etmenin yolu yok.

**Harita, sayfanın yazdığı adrese bakmıyordu.** Gömülü harita ve "Yol tarifi"
bağlantısı hâlâ `29 Ekim Cd.` adresini geocode ediyordu; sayfa Atatürk
Caddesi yazarken kendi tarif düğmesi başka bir yere yolluyordu. İşletme
sahibiyle teyit edildikten sonra düzeltildi — iki sokak adı arasında tahmin
yürütmek müşteriyi yanlış kapıya göndermek demek, ki bu tutarsızlıktan kötü.

**Canlıdaki iletişim bilgileri eskiydi.** `settings` satırı vergi levhası
gelmeden önce yazılmıştı; seed yalnızca tablo boşken yazdığı için footer her
sayfada `tuzla@laffogato.it` ve eski sokak adını gösteriyordu — `/hukuk` ise
yasal kimlikten okuduğu için doğrusunu. `20260901180000_settings_identity_backfill.sql`
bunu düzeltir; her kolona yalnızca hâlâ tam olarak eski değeri taşıyorsa
dokunur, yani sonradan panelden yazılmış bir şeye karışmaz.

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
   eksik değil — bilinçli. Build veritabanına hiç bağlanmaz.
2. `npm run db:bundle` çalıştırmayı unutmak **gerçek** bir hatadır: yeni
   migration bundle'a girmezse ne uygulama ne de CLI onu görür. Yeni migration
   yazdıktan sonra her zaman `npm run db:bundle` koş ve üretilen dosyaları
   commit'le.

### Sıradaki: veritabanı değişecek

Yeni bir veritabanına geçildiğinde ek bir iş yok: boş bir veritabanında
uygulama şemayı ilk sorguda kendisi kurar ve seed doğru varsayılanları yazar —
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

---

## 8. Backend + mobil parite denetimi — 23 Eyl 2026

Arka yüzün tamamı dört koldan yeniden okundu: (1) `lafmobil` uygulamasının
gerçekte gönderdiği/okuduğu her alan ile `/api/mobile/v1` kodunun karşılaştırması,
(2) mobil iş mantığı, (3) ödeme · sipariş · veritabanı katmanı · cron,
(4) admin kimliği · müşteri hesabı · bülten. Her bulgu koddan ikinci kez
doğrulandı; düzeltilenlerin her birinin yanında onu tutan test var.

**Parite sonucu:** iki depodaki `docs/API-MOBILE.md` bayt bayt aynıydı; çekirdek
akışlarda (sipariş, ödeme, profil, sadakat, karaoke, menü/mağaza) kırık alan
yok. Uygulamanın çağırdığı her uç sunucuda var (§18 Cüzdan ve §19 Hediye kartı
hariç — belge onları "henüz yok, 404 beklenir" diye yazıyor, uygulama 404'ü
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
| 🟡 | Mobil parite: panel 0–23 hatırlatma saati kaydediyordu, uygulama 08–21 dışını sessizce düşürüyordu | Panel 08–21'i zorlar, alan altında mesaj | `admin-reminder-hours` |
| 🟡 | Sipariş tekrarı, personel siparişi kapatınca 409 `ordering_closed` alıyordu | Tekrar, anahtarlardan önce | `mobile-order-idempotency` |
| 🟡 | `PATCH /me/addresses/{id}` `isDefault` yoksa varsayılan adresi düşürüyordu | Yoksa değişmez | `mobile-address-patch` |
| 🟡 | Ciro raporu: ayın 29–31'inde aylık görünüm bu ayı iki kez gösterip geçen ayı atlıyordu; günler UTC gece yarısında bölünüyordu | Ay adımı 1'inden; kovalar İstanbul saatine göre | `admin-revenue-buckets` |
| 🟡 | Sitedeki "Bugün" saatleri 00:00–03:00 arası dünün saatlerini gösteriyordu (sunucu UTC) | `istanbulDay()` | — |
| 🟡 | Promosyon bitişi `datetime-local` → UTC okunuyordu; 3 saat fazla geçerliydi | UTC anı olarak saklanır | `promo-schema` |
| 🟡 | Toplu "Hazırlanıyor" ödenmemiş siparişi ödenmiş sayıyordu (paidAt, damga, ciro) | Toplu işlemde ödenmemişler atlanır | `admin-order-guards` |
| 🟡 | Manuel sipariş stok ayırdıktan sonra hata verirse stok geri dönmüyordu | `placeOrder` gibi telafi | `admin-order-guards` |
| 🟡 | Hesap silme: kasa QR jetonları e-postayı tutuyordu, süresi dolmamışı hâlâ okutulabiliyordu | Anonimleşir + anında süresi dolar | `mobile-account-deletion` |
| 🟢 | Favori `back` alanıyla açık yönlendirme | `sameSitePath()` | `same-site-path` |
| 🟢 | Web siparişi, ödeme sağlayıcısı kontrol edilmeden oluşturulup e-postalanıyordu; kesirli adet 500'e düşüyordu | Sağlayıcı önce; adet tam sayı | `checkout-zero-total` |
| 🟢 | `/?hesap=silindi` hiçbir yerde karşılanmıyordu | Ana sayfa bildirimi | `frontend-form-contract` |
| 🟢 | Sabit "6 damga" mesajı (hedef 3–20 ayarlanabilir); hesap silmede UTC tarih; doğum günü kuponu web yedeği UTC ayı | Yapılandırılmış hedef; `istanbulClock` | `mobile-venue-clock` |
| 🟢 | `constantTimeEqual` uzunluk farkında erken dönüyordu (env admin parolasının uzunluğu sızıyordu); backend'de 7 lint uyarısı | SHA-256 sonra karşılaştırma; kullanılmayan importlar | — |
| 🟢 | Sözleşme belgesi koddan geri kalmıştı: §0 403 `email_unverified`, §3 preview hız sınırı 200 döner, §5 `kind`/`code`, §6 SWR yok, §7 403 | Belge koda eşitlendi (davranış değişmedi) | `api-contract-parity` |
| 🔴 | Admin oturumu geri alınamıyordu: çerez 7 gün e-posta ve rolü taşıyordu; pasifleştirme, rol düşürme, parola sıfırlama çerez bitene kadar işlemiyordu. TOTP kodu ±30 sn içinde tekrar kullanılabiliyor, 2FA kodsuz kapatılabiliyordu | Token'da kimlik bilgisinin anahtarlı parmak izi; hesap her istekte yeniden okunur. TOTP adımı harcanır (`admin_2fa."lastStep"`); 2FA'yı kapatmak güncel kod ister. **Deploy sonrası adminler bir kez yeniden girer** (eski 4 parçalı çerez reddedilir) | `admin-auth-sources`, `admin-2fa-enrollment`, `db-integration-audit` |
| 🔴 | Kaba kuvvet sınırı paralel isteklerle aşılıyordu (25 eşzamanlı denemenin 9'u geçiyordu) | `reserve_auth_attempt()`: deneme kimlik bilgisi denetlenmeden **önce**, satır kilidi altında sayılır; `admin-2fa` için IP'den bağımsız hesap tavanı. Sınıra takılan giriş `audit_logs`'a yazılmaz | `db-integration-audit`, `admin-login-audit` |
| 🔴 | 45 dakikalık süpürme ve dönüşü gelmeyen ödeme: POS'a sorulmadan iptal ediliyor, parası alınmış siparişin stoğu geri veriliyordu (PAYNKOLAY §14.6/2) | İptalden önce `lookupPayment` (`PaymentList`); `SUCCESS` → `applyPaymentSucceeded`. POS'a ulaşılamazsa bir gün dolana kadar iptal yok | `db-integration-payment-sweep`, `payment-paynkolay` |
| 🟠 | İade defteri ve üç tavan (`MAX_OPEN_ORDERS`, `KARAOKE_OPEN_CAP`, kasa jetonu hızı) JS'te oku-karar ver-yaz: eşzamanlı iki iade ikisi de POS'a gidebiliyordu | `reserve_order_refund` tek koşullu UPDATE (POS'tan **önce**, ret olursa `drop_order_refund`); tavanlar üye başına advisory lock'lu BEFORE INSERT tetikleyicileri | `db-integration-audit`, `atomic-caps-sql` |
| 🟠 | Bülten (6563): alt bilgi formu herkese herhangi bir adresi abone yaptırıyordu; admin çıkmış aboneyi eski onayla açabiliyordu; çıkış linki GET'te belirteci harcıyordu (e-posta tarayıcıları aboneliği bitiriyordu) | Çift onay (`/bulten/onay`, 7 gün), adres başına hız sınırı, panelde yalnız kapatma; çıkış bir **düğme** (POST) — RFC 8058 tek tık başlığı aynen duruyor | `newsletter-double-opt-in`, `db-integration-audit` |
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
duran iş: PayNkolay'ın canlı ölçüm listesi (`docs/PAYNKOLAY.md` §13) — köprü
formunun POS'a gidişi (CSP artık izin veriyor), `PaymentList` üretim ucu ve
dönüş hash'inin `CURRENCY_CODE` alanı.
