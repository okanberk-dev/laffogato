# Denetim — Eylül 2026

Sitenin tamamı on boyutta (güvenlik, doğruluk, ödeme, mevzuat, SEO,
erişilebilirlik, performans, UX, Next.js uyumu, ölü kod) denetlendi. Ham bulgular
çatışmalı doğrulamadan geçirildi: her iddia, çürütmeye çalışan ayrı bir okuma ile
karşılaştırıldı ve yalnızca ayakta kalanlar buraya alındı.

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

---

## 6. Bu bulguları koruyan testler

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
