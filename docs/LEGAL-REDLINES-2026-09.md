# Hukuki metin düzeltmeleri - avukat okuması için (Eylül 2026)

> **Durum: TASLAK - avukat onayı bekliyor.**
> Bu belge yayımdaki hiçbir hukuki metni değiştirmez. `src/lib/legal/content.ts`,
> `src/lib/legal/entity.ts` ve `src/lib/legal/nav.ts` bu turda **olduğu gibi
> bırakıldı**. Aşağıdaki her öneri, avukat okuyup onaylamadan koda geçmez.
> Onaydan sonraki uygulama sırası §2'dedir.

Hazırlayan: kod denetimi (yapay zekâ destekli), 24 Eylül 2026.
Bu belge hukuki görüş değildir; metnin koddaki gerçekle nerede ayrıştığını
gösterir ve her ayrışma için bir karşı öneri sunar. Karar avukatındır.

---

## 0. Bu belge nedir, nasıl okunur

**Kaynak.** `RiosenBeq/laffogato` deposu, `main` dalı, `aa8ef87` (24 Eyl 2026).
Hukuki metinlerin tamamı tek dosyadadır: `src/lib/legal/content.ts`
(15.597 satır, 25 belge). Aşağıdaki satır numaraları o dosyanın bu
sürümüne aittir. Metinlerde `{{BRAND}}`, `{{ADDRESS}}` gibi yer tutucular
geçer; değerleri `src/lib/legal/entity.ts` doldurur.

**Canlı ölçüm (24 Eyl 2026, yalnız GET).**

- `https://laffogato.net/hukuk/odeme-kosullari`, `/on-bilgilendirme-formu`,
  `/mesafeli-satis-sozlesmesi`, `/gizlilik-politikasi`, `/iade-ve-cayma`:
  beşinde de "iyzico" geçiyor, "PayNkolay" hiç geçmiyor. Yani aşağıdaki
  hatalar yayımdaki metinlerde de var (panelden yayımlanmış bir üzerine
  yazma bunları örtmüyor).
- Aynı gün sitenin güvenlik başlığı (`Content-Security-Policy`) ödeme
  formunun gönderilebileceği adresleri yalnızca
  `https://paynkolay.nkolayislem.com.tr` ve
  `https://paynkolaytest.nkolayislem.com.tr` olarak sayıyor; iyzico adresi
  yok. Canlı ödeme akışı PayNkolay'a gidiyor.
- Uygulamanın çevrimdışı kopyası (`RiosenBeq/lafmobil`,
  `src/data/legal.seed.json`, 1 Eylül 2026 sürümü) aynı metni taşıyor:
  içinde 195 kez "iyzico" geçiyor. Üye ödeme onayını bu kopyayı görerek de
  verebiliyor.

**Kodlar.** Her düzeltmenin bir kodu var:

| Kod | Konu | Bölüm |
|---|---|---|
| R1 (Ö1-Ö18) | Ödeme altyapısı: iyzico yerine PayNkolay | §3 |
| R2 (D1-D9) | Puan modeli yerine damga modeli | §4 |
| R3 (C1-C4) | Reklam tanımlayıcısı, push tokeni, çökme kaydı | §5 |
| R4 (K1-K2) | Konum | §6 |
| R5 (Q1-Q5) | Kamera ve karekod; fA'L kamerası; kasa kodu | §7 |
| R6 (KS1-KS2) | Kafe siparişi ve cayma hakkı (COMP-3b) | §8 |
| R7 (V1-V3) | Veri işleyenler: Supabase, Geliver, taşıyıcılar | §9 |
| R8 (F1) | Kaldırılmış bayilik ve toptan satış formları | §10 |
| R9 (E1) | Fatura: e-Arşiv ve "e-posta ile iletilir" | §11 |
| R10 | Posta kodu 34940 | §12 |
| R11 (T1) | Uzun tireler | §13 |
| Y1 | fA'L yapay zekâ alıcısı: OpenAI yerine Anthropic (17 Eki 2026, metin kodda değişti) | §15 |
| Y2 | KDV oranı ürüne göre (17 Eki 2026); köşkün gıdası %10, kargo ayrı %20 kalem, metinler kural yazar (18 Eki 2026, operatör kararı, metin kodda değişti) | §16 |
| Y3 | Masa ve grup rezervasyonu kalktı; rezervasyon yalnız karaoke odası (17 Eki 2026, metin kodda değişti) | §17 |

**Ek A** (belgenin sonunda) etkilenen **her cümleyi** belge belge, satır
numarası ve kodu ile, **birebir** gösterir. Yalnız ad değişikliği (Ö1) ve
tire düzeltmesi (T1) gereken cümlelerde önerilen cümle de orada tam yazılıdır;
diğerlerinde önerilen metin bu gövdedeki ilgili kodda verilmiştir.

**Tire gösterimi.** Bu belgede uzun tire karakteri kullanılmaz (tek çizgi
kuralı). Mevcut metinden birebir aktarılan cümlelerde U+2014 uzun tire
`[U+2014]`, U+2013 orta tire `[U+2013]` olarak yazılmıştır; bunun dışında
alıntılar harfi harfine aynıdır.

---

## 1. Özet

| Kod | Metin ne diyor | Kodda ne var | Etkilenen | Öncelik |
|---|---|---|---|---|
| R1 | Ödemeyi iyzico alır; sonuç imzalı webhook ile gelir; taksit, ön provizyon, dijital cüzdan, kısmi iade, kart saklama vardır | Sanal POS PayNkolay; webhook yok, sonuç sunucudan sorgulanır; taksit, ön provizyon, cüzdan ve kart saklama yok; kısmi iade POS'ta reddediliyor | 316 cümle, 21 belge | **Yüksek**: ödeme adımında onaylanan iki belge (Ön Bilgilendirme, Mesafeli Satış) bu cümleleri taşıyor |
| R2 | Alışverişten ve kafede QR okutarak puan kazanılır, puanla ödenir, iadede puan geri yüklenir | Puan yok. Damga: ödenmiş uygulama kafe siparişi başına 1, kasada personel eklemesi; dolan kart ücretsiz içecek kuponu | 460 cümle, 21 belge | **Yüksek**: yanıltıcı ticari uygulama riski (TKHK md. 61) |
| R3 | IDFA/AAID, push tokeni, çökme ve kullanım kayıtları işlenir; R10 reklam tanımlayıcısı rızası | Uygulama bunların hiçbirini toplamıyor; izleme beyanı `NSPrivacyTracking: false` | 84 cümle, 15 belge | **Orta-yüksek**: KVKK m.10 aydınlatmanın doğruluğu, mağaza gizlilik beyanıyla tutarlılık |
| R4 | Yaklaşık konum izni istenir; R11 konuma dayalı kampanya rızası | Uygulama konum izni istemiyor, konum kütüphanesi yok | 57 cümle, 15 belge | **Orta-yüksek** |
| R5 | Kamera yalnız kafede QR okutmak için; yeni metinlerde "Uygulama kamera izni istemez" | Uygulama QR okumuyor, kasada gösterilen kasa kodunu personel okuyor; kamera ve fotoğraf yalnız fA'L'da isteniyor ve bu hiçbir belgede yazmıyor | 131 cümle, 20 belge | **Yüksek**: "kamera istemez" cümlesi bugün yanlış |
| R6 | Kafe menüsü yalnızca tanıtım amaçlıdır; site veya uygulama üzerinden sipariş verilemez, ödeme alınmaz (özet) | Uygulamadan kafe siparişi (gel-al, kurye, ileri saat) alınıyor ve ödeniyor; İade ve Cayma'da kafe maddesi yok | 12 cümle, 5 belge; 1 yeni madde | **Yüksek** |
| R7 | Alıcı listelerinde Supabase ve Geliver yok; taşıyıcı sabit "Yurtiçi / Aras" | Kimlik Supabase Auth'ta; kargo Geliver üzerinden alınıyor, taşıyıcı teklife göre değişiyor | 48 cümle, 19 belge; ayrıca 5 tabloya yeni satır | **Yüksek**: KVKK m.10 alıcı grupları, m.9 yurt dışı aktarım |
| R8 | Bayilik ve toptan satış başvuru formlarından veri toplanır | Franchise sayfası ve formu 22 Haz 2026'da, tabloları 26 Ağu 2026'da kaldırıldı; sitede iletişim formu da yok | 12 cümle, 3 belge | Düşük |
| R9 | Fatura e-posta ile iletilir ve sipariş detayından indirilir | Kodda e-Arşiv entegrasyonu, fatura e-postası ve fatura indirme yok | 24 cümle, 9 belge | **Orta** |
| R10 | Adreste posta kodu yok | Doğru posta kodu 34940 (vergi levhası) | 1 alan, 25 belge | Düşük |
| R11 | 106 uzun tire, 1 orta tire | Operatörün tek çizgi kuralı | 105 cümle, 12 belge | Düşük (biçim) |

Toplam: 25 belgenin 25'i değişiyor (R10 adresi her belgede basılıyor);
Ek A'da 1.080 cümle listelidir.

---

## 2. Onaydan sonra uygulama sırası

Bu adımlar avukat onayından **sonra**, ayrı bir PR'da yapılır.

1. **`entity.ts`.**
   - `address` alanına `postalCode: "34940"` eklenir ve `LEGAL_ADDRESS_LINE`
     "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1, 34940 Tuzla/İstanbul,
     Türkiye" basacak biçimde güncellenir (R10). Aynı satır JSON-LD'de
     (`src/lib/seo/structured-data.ts`, `address.name`) de basılır.
   - Yeni yer tutucu `{{AUTH_PROVIDER}}` = "Supabase" (R7/V1). Gerekçe
     `{{DB_PROVIDER}}` ile aynı: sağlayıcı değişirse onlarca pasajdan birini
     unutmak yanlış bir KVKK beyanı bırakır.
   - İsteğe bağlı: `{{PAYMENT_PROVIDER}}` = "PayNkolay" ve ödeme hizmeti
     sağlayıcısının ticaret unvanı için ayrı bir alan (R1). Unvan bilinmiyorsa
     **boş bırakılır**; boş yer tutucu içeren tablo satırı basılmaz (sitenin
     13. kuralı: yasal kimlik uydurulmaz).
2. **`content.ts`.** Bu belgedeki onaylı öneriler uygulanır.
3. **Tarihler.**
   - R10 adresi 25 belgenin hepsinde bastığı için **her belge değişir**.
     Ön Bilgilendirme ve Mesafeli Satış da değiştiği için `meta.ts`'teki
     `LEGAL_UPDATED` onay gününe taşınır; bu, ödeme onayının kaydettiği sürümü
     de değiştirir (`legalConsent.version`), doğrusu da budur.
   - Tek tek `updatedAt` alanları (bugün on belgede "5, 22 ve 23 Eylül") yeni
     `LEGAL_UPDATED` gününden eski kalacağı için silinir ya da aynı güne
     çekilir; `tests/legal-dates.test.ts` içindeki beklenen tablo buna göre
     güncellenir (test, hiçbir belgenin `LEGAL_UPDATED`'ten eski tarih
     taşımasına izin vermez).
4. **Panel kontrolü.** `/admin` hukuk ekranında yayımlanmış bir üzerine
   yazma (`legal_docs`, `isPublished = true`) varsa kodlanmış metni örter.
   24 Eylül ölçümünde beş belgede örtme görülmedi; diğer yirmi belge de
   yayından önce kontrol edilmeli.
5. **Dışa aktarım.** `npm run legal:export -- <lafmobil>/src/data/legal.seed.json`
   ile uygulamanın çevrimdışı kopyası yenilenir ve `lafmobil`'de ayrı bir
   commit olarak alınır. `scripts/legal-export.mjs` satır 92'deki başlık
   dizesi bir uzun tire taşıyor ve bu dize uygulamanın deposuna yazılıyor;
   aynı PR'da tireye çevrilmeli (uygulamanın tek çizgi kuralı).
6. **Kapı.** Web: `npm run typecheck`, `npm run lint`, `npx vitest run`,
   `NODE_ENV=production npm run build`. Uygulama: `legal-seed.test.ts`
   (damga programı ve üretilmiş kopya kontrolleri) dâhil tüm testler.

---

## 3. R1 - Ödeme altyapısı: iyzico yerine PayNkolay

> **Ek (15 Eki 2026) - kart akışı değişti.** Operatör kararıyla kart artık
> PayNkolay'ın sayfasında değil, **sitenin kendi ödeme sayfasında** girilir;
> sunucu onu aynı istekte yalnızca PayNkolay'a iletir, hiçbir yere yazmaz,
> müşteri doğrudan bankanın 3D ekranına gider (`docs/PAYNKOLAY.md` §15).
> Aşağıdaki önerilerde "kart bilgileri hiçbir aşamada Satıcı sunucularından
> geçmez" anlamındaki her cümle bu yüzden **yanlış** olur. Önerilen karşılık:
> "Kart numarası, son kullanma tarihi ve güvenlik kodu {{SITE}} üzerindeki
> ödeme sayfasında girilir ve şifreli bağlantıyla yalnızca ödeme kuruluşu
> PayNkolay'a (N Kolay Ödeme ve Elektronik Para Kuruluşu A.Ş.) iletilir;
> Satıcı bu bilgileri kaydetmez, saklamaz ve kayıt sistemlerine yazmaz.
> Ödeme, kartı veren bankanın 3D Secure ekranında onaylanır." PCI DSS
> yükümlülüğünün kime ait olduğu cümleleri de buna göre gözden geçirilmeli.
> iyzico 15 Eki 2026'da koddan tamamen kaldırıldı.

### 3.1 Neden

Metinlerde 370 kez "iyzico", hiç "PayNkolay" geçmiyor. Sanal POS sağlayıcısı
PayNkolay'dır ve iyzico üretimde kullanılmıyor. Sağlayıcı değişikliği yalnız
bir ad değişikliği değil: iyzico'ya özgü olup PayNkolay'da **bulunmayan** beş
işleyiş metinlerde taahhüt olarak duruyor (imzalı webhook, taksit, ön
provizyon, dijital cüzdan, kart saklama) ve bir işleyiş (kısmi iade) bugün
POS tarafından yapılamıyor.

### 3.2 Koddaki kanıt

| İddia | Kanıt |
|---|---|
| Üretim sağlayıcısı PayNkolay | `src/lib/payment/index.ts`: `case "iyzico"` dalının yorumu "Üretimde kullanılmıyor (PayNkolay seçildi)". Site `CLAUDE.md`: "Sanal POS **PayNkolay** ... iyzico modülü duruyor ama üretimde kullanılmıyor". Canlı CSP `form-action` yalnız PayNkolay adreslerini sayıyor (§0). |
| Barındırılan ödeme sayfası; kart verisi sunucuya girmez | `src/lib/payment/paynkolay.ts` başlık yorumu; `docs/PAYNKOLAY.md` §0. Ödeme formu, sitenin kendi ara sayfası `/odeme/paynkolay` üzerinden PayNkolay'ın `/Vpos` adresine gönderilir (iyzico'daki gibi "yalıtılmış çerçeve" yoktur). |
| 3D Secure her ödemede | `docs/PAYNKOLAY.md` §8 "Karar: `use3D` her zaman `"true"`"; ara sayfanın imzası `use3D`'nin boşaltılmasını engelliyor (§14.1). |
| Webhook yok; sonuç sunucudan sorgulanır | `docs/PAYNKOLAY.md` §4 "PayNkolay'da webhook YOK"; `paynkolay.ts` `verifyWebhook` her çağrıda hata fırlatır; `confirmReturn` karar için PayNkolay İşlem Doğrulama Servisi'ne sunucudan sorar ve `STATUS = SUCCESS` ile tutar eşleşmesini arar. |
| Taksit yok | `docs/PAYNKOLAY.md` §9: `instalments` "Gönderilmiyor (v1'de taksit yok)". |
| Ön provizyon yok | `docs/PAYNKOLAY.md` §9: `transactionType` = `SALES` ("ön provizyon için `PRESALES`; kullanmıyoruz"). |
| Kart saklama yok | Site `CLAUDE.md` kural 28; `docs/PAYNKOLAY.md` §9.1 "kart saklama v1 kapsamı dışında", `customerKey` boş gönderilir; `tests/saved-cards.test.ts`. |
| İade: aynı gün iptal, sonrası iade; kısmi iade reddedilir | `paynkolay.ts` `refund()`: işlem günü bugünse `cancel`, değilse `refund`; tutar işlem tutarından farklıysa "kısmi iade desteklenmiyor" hatası. Panelde kısmi iade denemesi "Ödeme sağlayıcısı iadeyi reddetti" ile döner (`src/app/admin/siparisler/actions.ts`). |
| Saklanan ödeme verisi | `payment_transactions` satırı: sağlayıcı referansı, durum, tutar, para birimi, işlem günü ve `raw` alanında PayNkolay doğrulama servisinin döndürdüğü kayıt (`paynkolay.ts` `raw: { ..., transaction: row }`). `docs/PAYNKOLAY.md` §2'ye göre bu kayıt maskeli kart numarası (`CARD_NUMBER`), **kart sahibinin adı** (`CARD_HOLDER_NAME`), kartı veren banka (`CARD_BANK_NAME`), taksit sayısı ve 3D bilgisi içerir. |
| Test (mock) sağlayıcı üretimde çalışamaz | `index.ts`: üretimde `PAYMENT_PROVIDER` yoksa ya da `mock` ise uygulama başlamayı reddeder (site kural 17). |

### 3.3 Öneriler

Aşağıdaki "Mevcut" cümleleri örnektir; her kodun geçtiği cümlelerin tamamı
Ek A'dadır.

#### Ö1 - Yalnız ad değişikliği (90 cümle)

Cümle, sağlayıcının adı dışında doğruysa yalnız ad değişir. Kural:

| Mevcut | Önerilen |
|---|---|
| iyzico | PayNkolay |
| iyzico'nun / iyzico'ya / iyzico'dan / iyzico'yu / iyzico'da | PayNkolay'ın / PayNkolay'a / PayNkolay'dan / PayNkolay'ı / PayNkolay'da |
| ödeme kuruluşu iyzico (ve "ödeme kuruluşu" ifadesinin aynı cümledeki diğer geçişleri) | ödeme hizmeti sağlayıcısı PayNkolay |

"Ödeme kuruluşu" ifadesinin değişmesinin nedeni Ö2'dedir. Başka bir kod
taşımayan 77 Ö1 cümlesinin önerilen hâli Ek A'da bu kuralla tam yazılmıştır;
diğer 13'ünde ad değişikliği, yanındaki kodun önerisine eklenir.

Örnek (Ön Bilgilendirme Formu, satır 544):

- Mevcut: "Satın alma işlemleri uygulama mağazası üzerinden değil, iyzico ödeme altyapısı üzerinden gerçekleştirilir; uygulama mağazaları satış ilişkisinin tarafı değildir."
- Önerilen: "Satın alma işlemleri uygulama mağazası üzerinden değil, PayNkolay ödeme altyapısı üzerinden gerçekleştirilir; uygulama mağazaları satış ilişkisinin tarafı değildir."

Not: Mesafeli satış onayında ödeme hizmeti sağlayıcısının adını ayrı bir
yer tutucuya (`{{PAYMENT_PROVIDER}}`) bağlamak, `{{DB_PROVIDER}}` gibi, bir
sonraki sağlayıcı değişikliğinde 370 yerin elle taranmasını önler. Bu
durumda Türkçe ek sorunu çıkmaması için cümleler eksiz kurulmalıdır ("ödeme
hizmeti sağlayıcısı {{PAYMENT_PROVIDER}} altyapısı üzerinden").

#### Ö2 - Lisans beyanı (31 cümle)

Metinler iyzico için "6493 sayılı Kanun kapsamında yetkilendirilmiş ödeme
kuruluşu", "BDDK/TCMB tarafından yetkilendirilmiş" diyor. PayNkolay'ı sunan
tüzel kişinin unvanı ve lisans türü (ödeme kuruluşu mu, banka mı) bu
depoda **hiçbir kaynakta yazmıyor**; bu belge onu tahmin etmez.

- Mevcut (Mesafeli Satış Sözleşmesi, satır 967): "iyzico, 6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun kapsamında faaliyet gösteren, BDDK/TCMB tarafından yetkilendirilmiş bir ödeme kuruluşudur."
- Önerilen: "Ödeme hizmeti, [PAYNKOLAY HİZMETİNİ SUNAN TÜZEL KİŞİNİN TİCARET UNVANI] tarafından PayNkolay markasıyla sunulmaktadır." Unvan ve lisans türü imzalı üye iş yeri sözleşmesinden okunup yazılana kadar lisans cümlesi **çıkarılır**; diğer cümlelerde "yetkilendirilmiş ödeme kuruluşu olan iyzico" yerine "ödeme hizmeti sağlayıcısı PayNkolay" yazılır.
- Gerekçe: "ödeme hizmeti sağlayıcısı" 6493'teki üst kavramdır; sağlayıcının banka ya da ödeme kuruluşu olmasından bağımsız olarak doğrudur. Yanlış lisans beyanı ise sağlayıcı hakkında gerçeğe aykırı bilgi olur.

#### Ö3 - Ödeme sayfası (46 cümle)

- Mevcut (Ödeme Koşulları, satır 4003): "Ödeme adımında, iyzico Checkout Form akışı kullanılır: sepetinizi onayladıktan sonra iyzico'nun barındırdığı güvenli ödeme sayfasına yönlendirilirsiniz veya bu sayfa, {{SITE}} üzerinde yalıtılmış bir çerçeve içinde açılır."
- Önerilen: "Ödeme adımında, sepetinizi onayladıktan sonra PayNkolay'ın barındırdığı güvenli ödeme sayfasına yönlendirilirsiniz. Kart bilgilerinizi bu sayfaya girersiniz; mobil uygulamada bu sayfa cihazınızın tarayıcı penceresinde açılır."
- Diğer cümlelerde "iyzico Checkout Form ekranı", "iyzico Ödeme Formu" yerine "PayNkolay ödeme sayfası" yazılır. "Yalıtılmış çerçeve" ifadesi hiçbir yerde kalmaz (PayNkolay akışında çerçeve yok).

#### Ö4 - PCI-DSS (29 cümle)

- Mevcut (Üyelik Sözleşmesi, satır 10652): "Kart verilerinin güvenliğine ilişkin PCI-DSS yükümlülüğü iyzico'ya aittir."
- Önerilen: "Kart numarası, son kullanma tarihi ve güvenlik kodu yalnızca PayNkolay ödeme sayfasında girilir ve PayNkolay altyapısında işlenir; Şirket bu verilere hiçbir aşamada erişmez ve bunları saklamaz."
- Gerekçe: Kart verisinin sunucuya girmediği kodla kanıtlı (§3.2). "PCI-DSS yükümlülüğü iyzico'ya aittir" cümlesi ise üçüncü kişiyle aradaki sözleşmesel sorumluluk paylaşımını tüketiciye karşı beyan ediyor; PayNkolay sözleşmesindeki paylaşım görülmeden aynı cümle kurulmamalı. Avukat sözleşmeyi görürse cümleyi geri koyabilir.

#### Ö5 - 3D Secure (47 cümle)

- Mevcut (Kullanım Şartları, satır 10017): "3D Secure doğrulaması iyzico tarafından yürütülür."
- Önerilen: "Her kartlı ödemede 3D Secure doğrulaması uygulanır; doğrulama, PayNkolay ödeme sayfası üzerinden kartı veren bankanın ekranında yapılır."
- Ödeme Koşulları §11'deki adım adım anlatım (satır 4018-4024: "iyzico, kartın 3D Secure programına kayıtlı olup olmadığını sorgular ...") yerine: "1. PayNkolay ödeme sayfası açılır ve kart bilgileriniz doğrudan bu sayfaya girilir. 2. Bankanızın doğrulama ekranında tek kullanımlık kod veya bankacılık uygulaması onayıyla işlemi doğrularsınız. 3. PayNkolay sizi siteye veya uygulamaya geri yönlendirir. 4. Sunucumuz sonucu PayNkolay'a ayrıca sorar (Ö6); yalnızca ödeme başarılıysa ve tahsil edilen tutar sipariş tutarıyla aynıysa sipariş ödenmiş sayılır."
- "iyzico'nun ve kartı çıkaran bankanın desteklediği ölçüde 3D Secure" (satır 4527) yerine "her kartlı ödemede 3D Secure".

#### Ö6 - Ödeme sonucunun teyidi: webhook yok (33 cümle)

Bu, metinlerdeki en somut teknik yanlıştır. Ödeme Koşulları satır 4190:
"iyzico'dan gelen ödeme bildirimleri (webhook) HMAC-SHA256 imzası ile doğrulanır ve karşılaştırma zamanlama saldırılarına kapalı yöntemle yapılır; imzası geçersiz bildirim 401 ile reddedilir."
PayNkolay webhook göndermez; ödeme bildirimi diye bir istek hiç gelmez.

- Mevcut (Mesafeli Satış Sözleşmesi, satır 970): "Ödeme sonucunun SATICI sistemine bildirimi, iyzico'nun sunucu-sunucu bildirimi (webhook) ile yapılır. Bu bildirimler HMAC-SHA256 imza doğrulaması ile kontrol edilir; imzası geçersiz bildirimler reddedilir. İmzası doğrulanan bildirimlerde dahi işlem sonucu, sipariş kesinleştirilmeden önce iyzico'ya yeniden sorularak teyit edilir. Aynı işlem referansına ait mükerrer bildirimler benzersizlik kısıtı ile engellenerek çift tahsilat ve çift sipariş oluşumu önlenir (idempotens)."
- Önerilen: "Ödemenin sonucu, tarayıcının veya uygulamanın döndürdüğü bilgiyle değil, SATICI sunucusunun PayNkolay işlem doğrulama servisine doğrudan yaptığı sorguyla teyit edilir. Sipariş yalnızca bu sorgu ödemenin başarılı olduğunu ve tahsil edilen tutarın sipariş tutarıyla aynı olduğunu gösterdiğinde ödenmiş sayılır. Aynı işlem referansı ikinci kez kaydedilemez; bu nedenle aynı ödeme iki siparişi kapatamaz."
- Güvenli Alışveriş §12 başlığı "Webhook İmza Doğrulama ve Mükerrer İşlem Önleme" yerine "Ödeme Sonucunun Teyidi ve Mükerrer İşlem Önleme"; o bölümün iyzico webhook adımları (satır 4558-4567) yukarıdaki paragrafla değiştirilir.
- Ödemesi tamamlanmamış görünen sipariş için eklenebilecek doğru cümle: "Ödeme sayfasından siteye dönülmeden tarayıcı kapanırsa, SATICI siparişi iptal etmeden önce ödemenin durumunu PayNkolay'a sorar; ödeme alınmışsa sipariş ödenmiş olarak işlenir." (`docs/PAYNKOLAY.md` §14.6/2, `lookupPayment`.)
- Gizlilik Politikası satır 5084'teki "ödeme kuruluşu iyzico'dan gelen işlem ve itiraz (chargeback) bildirimleri" yerine "PayNkolay işlem doğrulama servisinden alınan işlem sonucu; itirazlarda bankanın ve PayNkolay'ın ilettiği bilgiler".

#### Ö7 - Saklanan ödeme verisi (9 cümle) - KVKK açısından önemli

Metinler SATICI'nın yalnızca kartın son dört hanesini, kart markasını,
işlem referansını ve sonucunu tuttuğunu söylüyor. PayNkolay doğrulama servisinin
döndürdüğü kayıt olduğu gibi saklanıyor ve **kart sahibinin adını** ve
kartı veren bankanın adını da içeriyor (§3.2).

- Mevcut (Ödeme Koşulları, satır 4006): "Satıcının sistemlerinde ödeme işlemine ilişkin olarak yalnızca kart verisi niteliği taşımayan işlem üstverileri tutulur: iyzico işlem referans numarası, işlem durumu, tutar, para birimi, işlem zamanı, taksit adedi, 3D Secure doğrulama sonucu ve kart markası ile kart numarasının maskelenmiş son dört hanesi gibi kayıtlar."
- Önerilen: "Satıcının sistemlerinde ödeme işlemine ilişkin olarak PayNkolay işlem referans kodu, işlem durumu, tahsil edilen tutar, para birimi ve işlem tarihi ile PayNkolay işlem doğrulama servisinin döndürdüğü kayıt tutulur. Bu kayıt maskelenmiş kart numarasını, kart sahibinin adını, kartı veren bankanın adını, taksit sayısını ve 3D doğrulama bilgisini içerebilir; kartın tam numarası, son kullanma tarihi ve güvenlik kodu hiçbir aşamada tutulmaz."
- Karar gerektiren nokta: kart sahibinin adını saklamak bir amaca hizmet etmiyorsa (iade ve itiraz için işlem referansı yeterli olabilir) **kodda** kayıttan çıkarılması veri en aza indirme ilkesine (KVKK m.4/2-ç) daha uygundur. O durumda yukarıdaki cümleden "kart sahibinin adını" çıkarılır. Bu bir mühendislik değişikliğidir; metin, hangisi seçilirse onu söylemelidir.

#### Ö8 - Taksit (21 cümle)

- Mevcut (Ödeme Koşulları, satır 4041): "Taksitli ödeme yalnızca taksite uygun kredi kartlarında ve iyzico ödeme sayfasında o an gösterilen taksit seçenekleriyle mümkündür."
- Önerilen: "Ödemeler tek çekim olarak alınır; taksit seçeneği sunulmamaktadır. Kartınızı veren bankanın kendi uygulamasıyla sonradan yaptığı taksitlendirme, banka ile aranızdaki ilişkiye tabidir."
- Ödeme Koşulları §13'ün (satır 4039-4045) taksit ve vade farkı paragrafları çıkarılır; banka kampanyalarına ilişkin 4043. satır (bankanın kendi puan, mil kampanyaları) korunabilir.
- Doğrulanacak: canlı PayNkolay ödeme sayfasında taksit seçeneği görünmediği, operatör tarafından bir kez gözle teyit edilmeli (kod taksit alanını hiç göndermiyor).

#### Ö9 - Ön provizyon (13 cümle)

- Mevcut (Ödeme Koşulları §12, satır 4033): "Sipariş hazırlanmaya alındığında ön provizyon iyzico üzerinden kapatılır (capture) ve tutar bu aşamada tahsil edilir."
- Önerilen: §12 başlığı "Tahsilat Anı" olur ve tek paragraf kalır: "Tutar, ödeme sayfasında işlemi onayladığınız anda tahsil edilir; ön provizyon (tutarı önce bloke edip sonra tahsil etme) yöntemi kullanılmaz. Sipariş sonradan iptal edilirse tahsil edilen tutar iade edilir (bkz. İade ve Cayma)."
- İade ve Cayma satır 1395 ("Ödeme henüz ön provizyon aşamasındaysa provizyon serbest bırakılır ...") çıkarılır.

#### Ö10 - İade (63 cümle)

- Mevcut (Mesafeli Satış Sözleşmesi, satır 974): "İade ve kısmi iade işlemleri, tahsilatın yapıldığı ödeme yöntemi üzerinden ve aynı karta olmak üzere iyzico API'sı aracılığıyla gerçekleştirilir."
- Önerilen: "İade, PayNkolay'ın iptal ve iade hizmeti üzerinden, ödemenin yapıldığı karta yapılır. Ödemeyle aynı gün yapılan iadeler işlemin iptali, sonraki günlerde yapılanlar iade işlemi olarak bankaya iletilir; tutarın kart hesabına yansıma süresi bankaya bağlıdır."
- **Kısmi iade - karar gerektiriyor.** Metinler kısmi iadenin karta yapıldığını söylüyor. Bugün POS entegrasyonu kısmi tutarı reddediyor (§3.2). Tüketicinin, siparişin bir kaleminden caydığında o kalemin bedelini 14 gün içinde alma hakkı ise kanundan doğar ve entegrasyona bağlı değildir. İki seçenek:
  - (a) Operatör kısmi iadeyi PayNkolay üye iş yeri panelinden elle yapabildiğini teyit ederse: metin "kısmi iadeler de ödemenin yapıldığı karta yapılır" olarak kalır (yalnız ad değişir).
  - (b) Teyit edilemezse: "Siparişin bir kısmının iadesinde iade tutarı ödemenin yapıldığı karta iade edilir; bunun teknik olarak mümkün olmadığı istisnai hâllerde ALICI'ya bilgi verilir ve iade tutarı, ALICI'nın kendi adına kayıtlı olarak bildireceği banka hesabına aynı süre içinde havale veya EFT ile ödenir." Bu yol ALICI'dan IBAN almayı gerektirir; aydınlatma metinlerine "iade için bildirilen banka hesap bilgisi" veri kategorisi eklenmelidir.
- Sipariş iptali (İade ve Cayma satır 1392) için: "... tahsil edilen tutarın tamamı için PayNkolay üzerinden iade işlemi başlatılır" (tam iade entegrasyonla yapılabiliyor).

#### Ö11 - Dijital cüzdan ve sağlayıcının hizmet kapsamına bağlanan yöntemler (4 cümle)

- Mevcut (Ödeme Koşulları, satır 4082): "iyzico'nun desteklemesi hâlinde dijital cüzdan ve mobil ödeme çözümleri ödeme sayfasında sunulur."
- Önerilen: Ödeme Koşulları §15 (Dijital Cüzdan) çıkarılır; §5'teki liste gerçeğe indirilir: "Kabul edilen ödeme yöntemleri: Visa, Mastercard ve Troy logolu kredi kartları ile internetten alışverişe açık banka kartları; PayNkolay ödeme sayfası üzerinden, 3D Secure ile ve tek çekim." Havale/EFT (§14) kodda bir ödeme yöntemi olarak bulunmuyor ve banka/IBAN alanları boş olduğu için tablosu zaten basılmıyor; §14'ün tamamının çıkarılması önerilir. (Kart markalarının PayNkolay sözleşmesindeki listeyle aynı olduğu operatörce teyit edilmeli.)

#### Ö12 - Mükerrer tahsilat (3 cümle)

- Mevcut (İade ve Cayma, satır 1834): "Aynı sipariş için birden fazla tahsilat oluşmuşsa, fazla tahsilat tespit edildiği anda iyzico üzerinden re'sen iade edilir ve size bildirilir."
- Mevcut (Şikâyet ve Uyuşmazlık, satır 14034): "... fazla tahsil edilen tutar için iade talimatı iyzico üzerinden en geç 2 iş günü içinde verilir ..."
- Mevcut (Ödeme Koşulları, satır 4112): "Tespit için iyzico işlem kayıtları ile banka mutabakat dosyaları karşılaştırılır."
- Kodda mükerrer tahsilatı otomatik tespit eden ya da banka mutabakat dosyası okuyan bir iş **yok**; tespit ve iade elle yapılır. Önerilen: "Aynı sipariş için birden fazla tahsilat oluştuğu tespit edilirse fazla tahsil edilen tutar, tespit tarihinden itibaren en geç 2 iş günü içinde ödemenin yapıldığı karta iade edilir ve size bildirilir." Bu, operatörün **elle** tutabileceği bir süreyse kalır; değilse süre çıkarılır. 4112. satır çıkarılır.

#### Ö13 - Risk ve dolandırıcılık kontrolü (4 cümle)

- Mevcut (Satış Politikası, satır 3638): "... iyzico tarafından sağlanan otomatik risk değerlendirmesi uygulanır."
- Önerilen: "... ödeme hizmeti sağlayıcısı ve kartı veren banka tarafından yürütülen risk ve dolandırıcılık kontrolleri uygulanabilir." (PayNkolay'ın ayrıca bir risk skorlaması yapıp yapmadığı bu depoda doğrulanamadı; cümle bu yüzden "uygulanabilir" diye kurulur.)

#### Ö14 - Test (mock) sağlayıcı cümlesi (1 cümle): çıkarılır

- Mevcut (Ödeme Koşulları, satır 4279): "iyzico entegrasyonu canlıya alınana kadar ödeme adımı, gerçek bir tahsilat yapmayan test (mock) sağlayıcı ile çalışabilir. Bu dönemde ekranda açık uyarı gösterilir ve kartınızdan herhangi bir tutar tahsil edilmez."
- Önerilen: **Çıkarılır.** Üretimde test sağlayıcısı çalışamaz (§3.2).

#### Ö15 - "POS işlemlerinin tamamı bottega siparişidir" cümlesi

Satış Politikası satır 3414. Bu cümle kafe siparişleriyle ilgili olduğu için
R6'da ele alındı: bkz. §8.3 KS1.

#### Ö16 - Ödeme sayfasının çerezleri (8 cümle)

- Mevcut (Çerez Politikası, satır 8635): "Amaç: iyzico Checkout Form sayfasında ödeme oturumunun güvenliği, 3D Secure doğrulaması ve sahtekârlık önleme."
- Önerilen: "Amaç: PayNkolay ödeme sayfasında ödeme oturumunun güvenliği ve 3D Secure doğrulaması." Taraf: "üçüncü taraf (PayNkolay ve kartı veren banka, ödeme sayfasına yönlendirildiğinizde)". Bu çerezlerin adı ve süresi PayNkolay'ın kendi politikasına tabidir; envanterde ad yazılmaz (bugün de yazmıyor).

#### Ö17 - Rezervasyon ön ödemesinin çevrim içi alınması (3 cümle)

- Mevcut (Kafe Hizmet Koşulları, satır 14462): "Ön ödeme, işletmede nakit veya kart ile ya da çevrim içi olarak iyzico altyapısı üzerinden tahsil edilebilir ve her hâlükârda hizmet bedeline mahsup edilir."
- Kodda rezervasyon (karaoke dâhil) için çevrim içi ödeme yok: `docs/API-MOBILE.md` `POST /karaoke/reservations` rezervasyonu `requested` durumunda açar ve bir ödeme adımı içermez; masa ve grup rezervasyonu için ise hiç çevrim içi akış yok. Önerilen: "Ön ödeme istenmesi hâlinde işletmede nakit veya kart ile tahsil edilir ve hizmet bedeline mahsup edilir." Satır 14481 ve 14577'deki çevrim içi ön ödeme ve iadesi ifadeleri buna göre çıkarılır.

#### Ö18 - Kart saklama (1 cümle)

- Mevcut (Ödeme Koşulları, satır 4007): "Kart saklama (tokenizasyon) özelliği kullanıma sunulursa, kart bilgisi yine Satıcıda değil iyzico nezdinde saklanır ..."
- Önerilen: "Kart saklama özelliği sunulmamaktadır; her ödemede kart bilgileri PayNkolay ödeme sayfasında yeniden girilir." (Site kural 28; site `CLAUDE.md` "Sanal POS" satırı: "kart saklanmaz".)

#### Başlıklar

Başlığı değişen bölümler (beşinde "iyzico" geçiyor, altıncısı ön provizyonu anıyor):

| Satır | Mevcut başlık | Önerilen |
|---|---|---|
| 310 | 7. Ödeme Şekli, iyzico Altyapısı, 3D Secure, Taksit ve Ödül Puanı | 7. Ödeme Şekli, PayNkolay Altyapısı ve 3D Secure |
| 965 | 7. Ödeme Şekli, iyzico Sanal POS ve 3D Secure | 7. Ödeme Şekli, PayNkolay Sanal POS ve 3D Secure |
| 3514 | 15. Ödeme Altyapısı ve iyzico | 15. Ödeme Altyapısı ve PayNkolay |
| 4000 | 10. Ödemenin iyzico Üzerinden Alınması ve Kart Verisinin Saklanmaması | 10. Ödemenin PayNkolay Üzerinden Alınması ve Kart Verisinin Saklanmaması |
| 4520 | 10. Ödeme Güvenliği: Kart Verisi iyzico Altyapısında Kalır | 10. Ödeme Güvenliği: Kart Verisi PayNkolay Altyapısında Kalır |
| 1823 | 20. Ödeme Altyapısı, Kredi Kartı İtirazı (Chargeback) ve Ön Provizyon | 20. Ödeme Altyapısı ve Kredi Kartı İtirazı (Chargeback) |

#### Tutulmamış bir söz

Şirket Bilgileri satır 13600 şunu taahhüt ediyor: "... ödeme kuruluşunun
değişmesi hâlinde yeni kuruluşun ticaret unvanı bu sayfada ve
/hukuk/odeme-kosullari adresindeki Ödeme Koşulları ve Sanal POS belgesinde
ayrıca duyurulur." Sağlayıcı değişti, duyuru yapılmadı. Bu PR o sözü yerine
getirir; yeni unvan Ö2'deki boşluğa yazılmalıdır.

---

## 4. R2 - Puan modeli yerine damga modeli

### 4.1 Neden

21 belge, kaldırılmış bir puan programını anlatıyor: alışverişten ve "kafede
QR kod okutarak" puan kazanılır, puan "sipariş bedelinden düşülerek" ödeme
aracı gibi kullanılır, iadede "puan geri yüklenir". Yürürlükteki program
damga esaslıdır ve bunların hiçbiri yoktur. Ödül Programı Kuralları
(`odul-programi`, 23 Eylül 2026) ile Üyelik Sözleşmesi, Mobil Uygulama
Koşulları ve Kafe Hizmet Koşulları damga modelini zaten doğru anlatıyor; diğer
belgeler onlarla çelişiyor. Çelişkide "tüketici lehine olan hüküm uygulanır"
kuralı, var olmayan bir puan hakkının talep edilmesine kapı açar.

### 4.2 Koddaki kanıt

| Gerçek | Kanıt |
|---|---|
| Damga defteri: kazanım (+1), ödül (-hedef), geri alma (-1); başka hareket yok | `src/lib/mobile/loyalty-core.ts` (`LoyaltyStamp.kind: "earn" \| "redeem" \| "reversal"`) |
| Ödenmiş uygulama kafe siparişi başına 1 damga; mağaza ve site siparişi damga kazandırmaz | `src/lib/mobile/loyalty.ts` `onOrderPaid`; `docs/API-MOBILE.md` (`stampsToEarn` kafe sepetinde 1, mağazada 0) |
| Hedef varsayılan 6 (panelden 3-20) | `loyalty-core.ts` `STAMP_TARGET = 6` ve yorumu |
| Ödül: ücretsiz içecek kuponu (sabit tutar, süreli, kafe siparişi) | `src/lib/mobile/free-drink.ts`, `loyalty-core.ts` `freeDrinkRewardFor` |
| Puanla ödeme yok | Sipariş gövdesinde (`docs/API-MOBILE.md` `POST /orders`) puan alanı yok; indirim yalnız kupon veya promosyon kodu |
| İptal ve iadede damga geri alınır; iptalde kupon geri verilir | `loyalty.ts` `onOrderReversed`; `src/lib/admin/store.ts` `transitionOrder` (iptal: `releaseOrderInventory` kuponu sahibine döndürür, `reverseLoyalty` damgayı geri alır) |
| Kasada damga: personel kasa kodunu kamerayla okutur, kodu yazar ya da e-postayı girer; işlem başına 1-5 damga | `src/lib/mobile/counter.ts` (`MIN_COUNTER_STAMPS = 1`, `MAX_COUNTER_STAMPS = 5`); `src/app/admin/kasa/till-console.tsx` ("Kamera ile okut", "Kodu yaz", "E-posta ile") |

### 4.3 Standart metin blokları

Aşağıdaki üç blok, puan anlatan bölümlerin yerine konur. Ödül Programı
Kuralları'nın kendi cümlelerinden türetildi; yeni bir taahhüt eklemez.

**Blok D-A - sözleşme ve politika belgeleri için ("Sadakat (Damga) Programı")**

> 1. {{BRAND}} sadakat programı damga esaslıdır. Mobil uygulama üzerinden
>    verilen ve ödemesi tamamlanan her kafe siparişi bir damga kazandırır;
>    kafede kasada personel tarafından da damga eklenebilir. Online mağaza
>    (kargo) siparişleri ve internet sitesinden verilen siparişler damga
>    kazandırmaz.
> 2. Kart, Ödül Programı Kuralları'nda belirtilen sayıda damgayla dolar ve
>    üyenin talebiyle bir ücretsiz içecek kuponuna çevrilir. Kupon yalnızca
>    kafe siparişlerinde, tanımlandığı andaki üst tutar ve süre içinde
>    kullanılabilir; nakde çevrilemez, devredilemez ve aynı siparişte bir
>    promosyon koduyla birleştirilemez.
> 3. Programda puan yoktur. Sipariş bedeli damga ile ödenemez; damganın
>    kendi başına parasal bir karşılığı yoktur.
> 4. Siparişin iptali, iadesi veya cayma hakkının kullanılması hâlinde o
>    siparişten kazanılan damga geri alınır. Sipariş iptal edilirse
>    siparişte kullanılan kupon hesaba geri tanımlanır. Kuponla karşılanan
>    kısım için hiçbir hâlde nakit ödeme yapılmaz; fiilen ödenen tutar
>    ödemenin yapıldığı karta iade edilir.
> 5. Programın bütün kuralları {{SITE_URL}}/hukuk/odul-programi adresindeki
>    Ödül Programı Kuralları'ndadır.

**Blok D-B - aydınlatma ve gizlilik belgeleri için ("Sadakat (Damga) Programı Kapsamında Veri İşleme")**

> Sadakat programı kapsamında üyelik kimliğiniz (e-posta adresi), damga
> hareketleriniz (kazanım, geri alma, ödül), hareketin kaynağı (uygulama
> siparişi veya kasa), kasada işlemi yapan personelin kimliği, hesabınıza
> tanımlanan ücretsiz içecek, kilometre taşı ve davet kuponları ile son 365
> gündeki ödenmiş sipariş sayınızdan hesaplanan kademeniz işlenir. Kasada
> damga eklenirken uygulamanın gösterdiği kasa kodunun yalnızca özet (hash)
> değeri, geçerlilik süresi ve kullanıldığı an kaydedilir. Hukuki sebep:
> sözleşmenin kurulması ve ifası (KVKK m.5/2-c). Program konum verisi,
> reklam tanımlayıcısı veya cihaz kamerası kullanmaz; harcama geçmişine
> dayalı profilleme programın parçası değildir.

**Blok D-C - saklama ve imha politikası için**

> Damga hareketleri, bağlı olduğu sipariş kaydının saklama süresine tabidir;
> kasada eklenen damgalar ve düzeltmeleri de aynı süreyle saklanır. Kasa kodu
> kayıtları, kullanıldıktan veya süresi dolduktan bir gün sonra, bir sonraki
> kasa işleminde silinir. Hesap kapatıldığında damga hareketleri hesaptan
> koparılır (bkz. Hesap Silme).

Kanıt (D-B, D-C): `odul-programi` §20 (satır 11468-11471) aynı veri
listesini veriyor; kasa kodu için `src/lib/mobile/counter.ts` ("Only its
sha256 reaches the database", `COUNTER_TOKEN_TTL_SECONDS = 120`,
`STALE_AFTER_MS` bir gün, silme "on the redeem path"); hesap kapatma için
`hesap-silme` satır 11072.

### 4.4 Alt kodlar

| Kod | Ne | Öneri |
|---|---|---|
| D1 | Başlığı "Ödül Puanı", "Ödül ve Puan Programı" olan bölümün tamamı (on-bilgilendirme §17, mesafeli §8, iade-ve-cayma §12, satış politikası §20, ödeme koşulları §8, gizlilik §15, KVKK §13, kullanım şartları §6, veri saklama §10, açık rıza §14 (R9), şikâyet §12 ilgili kısmı) | Bölüm, belgenin türüne göre D-A, D-B veya D-C bloğuyla **bütünüyle** değiştirilir. Ek A'da bu bölümlerin her cümlesi D1 ile işaretlidir. |
| D2 | Puanla ödeme, puanın bedelden düşülmesi, kalan tutarın kartla ödenmesi | Çıkarılır. Gerekirse yerine: "Ücretsiz içecek kuponu kullanılmışsa kuponun karşıladığı tutar sipariş özetinde ayrı bir indirim kalemi olarak gösterilir." |
| D3 | İadede "puan geri yüklenir" | D-A madde 4 ile değiştirilir. |
| D4 | "Kafede QR okutarak puan kazanma" | Uygulamanın işlev listelerinde: "sadakat kartının (damga) takibi ve kafede kasa koduyla damga eklenmesi". Ayrıca bkz. Q1. |
| D5 | "Ödül Puanı" tanımları | "Damga: Kartta bir hâne dolduran, kendi başına parasal karşılığı bulunmayan sayısal kayıt; ayrıntı Ödül Programı Kuralları'nda." (odul-programi satır 11228 tanımı) |
| D6 | Veri kategorisi olarak puan bakiyesi, puan hareketleri ve harcama geçmişi özeti | "damga hareketleri (kazanım, geri alma, ödül) ve kuponlar" (D-B). "Harcama geçmişi özeti" program için işlenmiyor; çıkarılır. |
| D7 | Puanın kötüye kullanımı | Kavram korunur, sözcük değişir: "damga ve kupon". Ödül Programı §15 ile aynı liste. |
| D8 | Kişiye özel puan, puan çarpanı, alışveriş alışkanlığı analizi (Açık Rıza R9) | Kodda böyle bir işleme yok; Ödül Programı §20 da "profilleme programın parçası değildir" diyor. **R9 rıza kalemi kaldırılır**; Açık Rıza Metni §6 özet tablosundaki R9 satırı ve §14'ün tamamı çıkarılır. İleride yapılırsa yeni bir rıza metniyle eklenir. |
| D9 | Diğer terim geçişleri ("ödül ve puan programı", "puan takibi") | "sadakat (damga) programı", "damga kartı takibi". Banka kampanyalarına ilişkin "puan, mil" geçişleri (bankanın kendi puanı) değişmez. |

Örnekler:

- D2, Mevcut (Ön Bilgilendirme Formu, satır 506): "Kullanılan puanın karşılığı, vergiler dâhil toplam bedelden ayrı bir indirim kalemi olarak düşülür ve kalan tutar iyzico üzerinden tahsil edilir."
  Önerilen: bölüm D-A ile değişir; bu cümle kalmaz.
- D3, Mevcut (Mesafeli Satış Sözleşmesi, satır 1045): "Sipariş bedelinin bir kısmının ödül puanı ile karşılanmış olması hâlinde iade, işbu Sözleşme'nin ödül puanlarına ilişkin maddesindeki esaslara göre yapılır: puan ile karşılanan kısım ALICI'nın üyelik hesabına puan olarak geri yüklenir, kart ile tahsil edilen Türk Lirası kısım ise iyzico üzerinden aynı karta iade edilir."
  Önerilen: "Siparişte ücretsiz içecek kuponu kullanılmışsa iade, Sözleşme'nin sadakat programına ilişkin maddesine göre yapılır: kuponla karşılanan kısım için nakit ödeme yapılmaz, ALICI'nın fiilen ödediği tutar PayNkolay üzerinden ödemenin yapıldığı karta iade edilir."
- D5, Mevcut (İade ve Cayma, satır 1293): "Ödül Puanı / Puan: Alışverişlerden ve kafe ziyaretlerinde okutulan QR kodundan kazanılan, sonraki siparişlerde indirim olarak kullanılabilen sayısal değer; para değildir, nakde çevrilemez ve devredilemez."
  Önerilen: "Damga: Mobil uygulamadan ödenen kafe siparişlerinden ve kafede kasada eklenen damgalardan oluşan, kendi başına parasal karşılığı olmayan sayısal kayıt; kart dolunca ücretsiz içecek kuponuna çevrilir."

### 4.5 Ödül Programı Kuralları'nın kendi iki açığı

Ödül Programı (23 Eylül 2026) damga modelini doğru anlatıyor ama kasa
işleyişinde koddan geri kalmış iki cümle taşıyor. Aynı PR'da düzeltilmesi
önerilir.

- **D-EK1 - Kasada işlem başına damga sayısı.**
  Mevcut (satır 11324): "İşlem başına 1 damga (Şirket'in takdirinde)".
  Kod: kasa ekranı tek okutmada 1 ile 5 arasında damga verebiliyor
  (`STAMP_CHOICES = [1, 2, 3, 4, 5]`, `MAX_COUNTER_STAMPS = 5`).
  Önerilen: "İşlem başına 1 damga; aynı hesapta birden fazla içecek
  alındığında personel tek işlemde en fazla 5 damga ekleyebilir (Şirket'in
  takdirinde)." Operatör kasada fiilen kaç damga verildiğini teyit etmeli;
  kural "her zaman 1" ise değişecek olan metin değil koddur.
- **D-EK2 - Kasa damgasının yolu.**
  Mevcut (satır 11335): "Kasa Damgası, personel tarafından Şirket'in yönetim panelinden Katılımcı'nın üyelik e-posta adresi seçilerek eklenir."
  Kod: üç yol var ve varsayılanı kasa kodu. Önerilen: "Kasa Damgası,
  personel tarafından Şirket'in yönetim panelinden eklenir. Bunun için
  Katılımcı, Uygulama'daki kasa kodunu (iki dakika geçerli, tek kullanımlık
  karekod ve sekiz karakterlik kod) personele gösterir; personel kodu
  kasadaki cihazın kamerasıyla okutur ya da elle girer. Kod okunamazsa
  damga, Katılımcı'nın üyelik e-posta adresi girilerek de eklenebilir."
  Aynı düzeltme Kafe Hizmet Koşulları satır 14651 ("damga kasada, personel
  tarafından üyelik e-posta adresiniz seçilerek eklenir"), Üyelik Sözleşmesi
  satır 10679 ve Mobil Uygulama Koşulları satır 11866 için de geçerlidir.
  Uygulamanın damga kazanmak amacıyla kameraya erişmediğini söyleyen cümle **doğrudur**
  ve kalır (kamerayı personelin cihazı kullanıyor).

---

## 5. R3 - Reklam tanımlayıcısı (IDFA/AAID), push tokeni, çökme kayıtları

### 5.1 Neden ve kanıt

On beş belge, uygulamanın IDFA/AAID reklam tanımlayıcısı, anlık bildirim
(push) tokeni, çökme ve ekran/tıklama kayıtları işlediğini söylüyor; Açık
Rıza Metni bunun için R10 rıza kalemi tanımlıyor. Aynı konuda daha yeni dört
belge (Üyelik Sözleşmesi, Mobil Uygulama Koşulları, Kafe Hizmet Koşulları,
Ödül Programı) tam tersini ve doğrusunu söylüyor; örneğin Kafe Hizmet
Koşulları satır 14634: "Uygulama; reklam tanımlayıcısı (IDFA/AAID), anlık bildirim (push) tokeni, konum, kamera ve çökme (crash) kaydı işlemez."
(Bu cümlenin yalnız "kamera" kısmı bugün yanlıştır; bkz. R5.) Belgeler
birbiriyle çelişiyor.

Kanıt (`RiosenBeq/lafmobil`):

- `app.json`: iOS gizlilik bildirimi `NSPrivacyTracking: false`,
  `NSPrivacyTrackingDomains: []`; Android'de istenen tek izin
  `POST_NOTIFICATIONS`.
- `package.json`: izleme izni (App Tracking Transparency), reklam,
  analitik veya çökme raporlama kütüphanesi yok.
- Push tokeni: uygulamada `getExpoPushTokenAsync` veya
  `getDevicePushTokenAsync` çağrısı yok; sitenin kodunda ve veritabanında
  push tokeni tutan tablo yok. Bildirimler cihazda planlanan yerel
  hatırlatmalardır (`src/lib/notifications.ts`).
- Uygulamanın sunucuya gönderdiği başlıklar yalnızca `Accept`,
  `Content-Type` ve oturum için `Authorization` (`src/data/api.ts`).
  Sunucu doğal olarak IP adresini ve cihazın işletim sisteminin eklediği
  tarayıcı kimliğini (user-agent) görür.

### 5.2 Öneriler

- **C1 - IDFA/AAID (37 cümle).** Her geçiş çıkarılır. Tek doğru cümle,
  aydınlatma belgelerine eklenir: "Uygulama cihazın reklam tanımlayıcısına
  (iOS'ta IDFA, Android'de AAID) erişmez ve izleme (App Tracking
  Transparency) izni istemez; uygulamada reklam veya ölçümleme kiti
  bulunmaz."
  Örnek, Mevcut (KVKK Aydınlatma Metni, satır 5857): "Mobil uygulama kullanıcısı - Cihaz ve uygulama verisi: cihaz tanımlayıcıları (iOS'ta IDFA, Android'de AAID), push bildirim tokeni, uygulama sürümü, işletim sistemi ve sürümü, cihaz modeli ve dil ayarı, çökme (crash) ve performans kayıtları, uygulama içi ekran görüntüleme ve tıklama akışı."
  Önerilen: "Mobil uygulama kullanıcısı - Bağlantı verisi: sunucumuza yapılan isteklerde IP adresi, cihazın işletim sisteminin eklediği istemci bilgisi (user-agent) ve isteğin zamanı. Uygulama reklam tanımlayıcısı, anlık bildirim tokeni, çökme kaydı veya ekran ve tıklama kaydı toplamaz."
- **C2 - Push tokeni ve push iletimi (43 cümle).** Çıkarılır; yerine: "Hatırlatmalar
  cihazınızda planlanır; uygulama sunucuya anlık bildirim (push) tokeni
  göndermez ve sunucudan anlık bildirim gönderilmez." Push tokenine dayanan
  saklama satırları (Gizlilik satır 5393, KVKK 6256, Veri Saklama 7852, 7950,
  8063, 8162, 8276, Üyelik 10772) çıkarılır. Apple ve Google bildirim
  servislerinin alıcı olarak sayıldığı yerler (Gizlilik 5277, KVKK 6126,
  Ticari İleti 9714, Şirket Bilgileri 12998) yerel bildirim bu servislerden
  geçmediği için çıkarılır; uygulama mağazalarının dağıtım rolü kalır.
  Pazarlama amaçlı push bildirimi için tanımlanan R8 rızası da bugün
  karşılıksızdır (Açık Rıza satır 6673, 6801); avukat R8'in de kalkıp
  kalkmayacağına karar vermeli.
- **C3 - Çökme ve kullanım kayıtları (14 cümle).** Uygulama için çıkarılır.
  Sunucunun kendi erişim ve hata kayıtları (web tarafı) doğrudur ve kalır.
- **C4 - R10 rıza kalemi (5 cümle).** Açık Rıza Metni §6 tablosundaki R10
  satırı ve §15'in R10 kısmı kaldırılır; §4'teki amaç listesinden "mobil
  uygulamada reklam tanımlayıcısı kullanımı" çıkarılır.

---

## 6. R4 - Konum

- **Kanıt.** Uygulamada konum kütüphanesi (`expo-location`) yok,
  `app.json`'da konum izni tanımı yok. Mobil Uygulama Koşulları satır 11812
  ("İstenmez [U+2014] tek şube bulunduğundan konuma bağlı bir işlev yoktur") ve
  Üyelik Sözleşmesi satır 10706 doğru.
- **K1 (57 cümle).** "En yakın şube", "teslimat bölgesi önerisi",
  "yaklaşık konum izni" geçen her cümle çıkarılır; aydınlatma belgelerine
  şu cümle konur: "Uygulama konum izni istemez; tek şube bulunduğundan
  konuma bağlı bir işlev yoktur ve teslimat adresi üyenin kendi adres
  defterinden seçilir." (Üyelik Sözleşmesi satır 10706'nın cümlesi.)
  Örnek, Mevcut (Gizlilik Politikası, satır 5046): "Yalnızca cihaz izni vermeniz hâlinde, en yakın şubenin gösterilmesi ve teslimat adresi önerisi amacıyla işlenen yaklaşık konum bilgisi."
  Önerilen: satır (5044-5046 "Konum verisi (izne bağlı)") tablodan çıkarılır.
- **K2 - R11 rıza kalemi (4 cümle).** "Yaklaşık konuma dayalı kampanya"
  rızası kaldırılır: Açık Rıza §6 tablosundaki R11 satırı, §15'in R11 kısmı
  ve §19'daki "Reklam tanımlayıcısı ve yaklaşık konum kayıtlarının silinmesi"
  satırı. Açık Rıza §15 böylece bütünüyle boşalır; başlığı ve numarası
  kaldırılır.
- Konum sözcüğünün "yer sağlayıcı konumundadır" ve güvenlik kameralarının
  "konumlandırılması" gibi geçişleri bu konuyla ilgisizdir ve değişmez
  (Ek A'da listelenmez).

---

## 7. R5 - Kamera ve karekod: kafede QR okutma yok, fA'L kamerası var

### 7.1 Neden

İki ayrı yanlış var ve birbirinin tersi:

- **Eski metinler** (on sekiz belge) uygulamanın "kafede QR kod okutarak puan
  kazanmak" için kamera istediğini söylüyor. Uygulamada karekod okuyucu yok.
- **Yeni metinler** (Üyelik Sözleşmesi, Mobil Uygulama Koşulları, Kafe Hizmet
  Koşulları) "Uygulama kamera izni istemez", "fotoğraf ve dosya izni
  istemez", "Talep edilen tek izin bildirim iznidir" diyor. Bu da bugün
  yanlış: fA'L özelliği kamera ve fotoğraf izni istiyor. Mağaza gizlilik
  formları (App Store "App Privacy", Google Play "Data safety") bu
  beyanlarla tutarlı doldurulmalı.

### 7.2 Koddaki kanıt (`RiosenBeq/lafmobil`)

- `app.json` `expo-image-picker` eklentisi:
  `cameraPermission`: "fA'L için içeceğinin fotoğrafını çekebilmen içindir.
  Fotoğraf cihazında işlenir; yalnız yapay zekâ yorumunu açıkça onaylarsan
  yorum için gönderilir ve saklanmaz." `photosPermission` aynı metinle
  galeri için. `microphonePermission: false`.
- `app.json` iOS: `NSPhotoLibraryAddUsageDescription`: "fA'L Story görselini
  Fotoğraflar'a kaydedebilmen içindir."
- Kamerayı açan tek kod `src/app/fal.tsx` (`requestCameraPermissionsAsync`,
  `launchCameraAsync`, `launchImageLibraryAsync`). Yapay zekâ yorumu yalnız
  sunucu açıkken ve üye R12 onayını verdikten sonra; aksi hâlde fal cihazda,
  hazır cümlelerden kurulur ve fotoğraf cihazdan çıkmaz (dosyanın başlık
  yorumu). Sunucu tarafı bugün **kapalıdır** (karar 177; `OPENAI_API_KEY` ve
  `FAL_AI_ENABLED` bekliyor); R12 metni Açık Rıza §15/A'da zaten var.
  (17 Eki 2026 notu: sağlayıcı Anthropic oldu; anahtar `ANTHROPIC_API_KEY`,
  alıcı Anthropic, PBC. Ayrıntı §15.)
- Kasada damga için karekodu **uygulama gösterir, personel okur**: site
  `src/lib/mobile/counter.ts` (iki dakikalık, tek kullanımlık kasa kodu;
  veritabanına yalnız özeti yazılır) ve `src/app/admin/kasa/`.

### 7.3 Standart cihaz izinleri tablosu (Q2)

Gizlilik Politikası §14, KVKK Aydınlatma §12, Mobil Uygulama Koşulları §9,
Kafe Hizmet Koşulları §13, Üyelik Sözleşmesi §11 ve Çerez Politikası §15'teki
izin anlatımları bu tabloyla değiştirilir:

| İzin veya veri | Durum | Amaç ve sınır |
|---|---|---|
| Bildirim | İstenir, isteğe bağlı | Yalnızca üyenin uygulamada kendi açtığı hatırlatmaların cihazda gösterilmesi. Hatırlatmalar cihazda planlanır; sunucudan anlık bildirim gönderilmez. |
| Kamera | Yalnızca fA'L'da, üye fotoğraf çekmeyi seçtiğinde | İçecek fotoğrafının fA'L için çekilmesi. |
| Fotoğraf arşivinden seçme | Yalnızca fA'L'da, üye galeriden seçmeyi seçtiğinde | fA'L fotoğrafının seçilmesi. |
| Fotoğraflara kaydetme | Yalnızca üye fA'L Story görselini paylaşım ekranından cihazına kaydetmeyi seçtiğinde | Görselin cihazın fotoğraf arşivine eklenmesi. |
| Konum, mikrofon, rehber | İstenmez | - |
| Reklam tanımlayıcısı (IDFA/AAID) | Okunmaz; izleme izni istenmez | - |
| Anlık bildirim (push) tokeni | Oluşturulmaz, sunucuya gönderilmez | - |
| Çökme ve kullanım kayıtları | Toplanmaz | - |

Tablonun altına konacak paragraf:

> fA'L özelliğinde çektiğiniz veya seçtiğiniz fotoğraf cihazınızda işlenir
> ve şirketimize gönderilmez. Yalnızca falın yapay zekâ ile yorumlanmasına
> Açık Rıza Metni'nin R12 bölümü uyarınca ayrıca ve açıkça onay verirseniz,
> fotoğraf küçültülmüş ve meta verilerinden arındırılmış hâliyle yorumun
> üretilmesi için aktarılır ve saklanmaz. Kafede damga için uygulama
> kameranızı kullanmaz: kasada, uygulamanın gösterdiği kasa kodunu
> personel kendi cihazıyla okutur.

### 7.4 Alt kodlar

| Kod | Ne | Öneri |
|---|---|---|
| Q1 | Uygulamanın işlev listelerinde "kafede QR okutarak puan kazanma" (ör. Gizlilik satır 5454, KVKK 6064, Kullanım Şartları 9939) | "menü görüntüleme, kafe ve mağaza siparişi, üyelik, sadakat kartının (damga) takibi ve kafede kasa koduyla damga eklenmesi, karaoke rezervasyonu talebi, fA'L ve cihazda planlanan hatırlatmalar" |
| Q2 | Kamera ve fotoğraf izninin anlatıldığı her yer | §7.3 tablosu ve paragrafı. Mobil Uygulama Koşulları satır 11794 ("Talep edilen tek izin bildirim iznidir") ve 11795 ("Uygulama; kamera, konum, mikrofon, rehber, fotoğraf ve dosya izni istemez ...") bu tabloyla çelişen iki cümledir ve değişir. |
| Q3 | Karekod okutulmadığını ve kasa damgasının yalnızca e-posta adresi seçilerek eklendiğini söyleyen cümleler (Üyelik 10679, Ödül Programı 11335-11336, Mobil Uygulama 11866, Kafe Hizmet 14651) | Bkz. D-EK2 (§4.5): kasa kodu yolu eklenir. Uygulamanın damga için kamera kullanmadığını söyleyen kısım doğrudur, kalır. |
| Q4 | Karekodun çoğaltılması veya paylaşılması yoluyla kötüye kullanım | "Kasa kodunun başkasıyla paylaşılması veya çoğaltılması" |
| Q5 | Fikri Mülkiyet satır 12262 ve 12316: "kafede kullanılan QR kart ve masa görselleri" | Sitedeki self-servis QR kartı 22 Haz 2026'da kaldırıldı (commit `e88f2b0`). Kafede basılı bir karekod materyali varsa kalır; yoksa çıkarılır. **Operatör teyidi gerekir.** |

Örnek, Mevcut (Gizlilik Politikası, satır 5462): "Kamera izni: Yalnızca kafede puan kazanımı ve kampanya doğrulaması için QR kod okunmasında kullanılır; kamera görüntüsü kaydedilmez, sunucuya gönderilmez ve saklanmaz."
Önerilen: "Kamera ve fotoğraf izni: Yalnızca fA'L özelliğinde, fotoğraf çekmeyi veya galeriden seçmeyi siz başlattığınızda istenir; fotoğraf cihazınızda işlenir ve sunucuya gönderilmez. Yapay zekâ yorumu yalnızca Açık Rıza Metni R12 onayınızla yapılır. Uygulama karekod okumaz."

---

## 8. R6 - Kafe siparişi ve cayma hakkı (COMP-3b)

### 8.1 Neden

Beş belge, kafe menüsünün "yalnızca tanıtım ve bilgilendirme amacı"
taşıdığını, "site veya uygulama üzerinden sipariş verilemez, ödeme alınmaz"
dediğini söylüyor. 1 Eylül 2026'dan beri uygulamadan kafe siparişi
(gel-al, kurye ile teslim, ileri bir saate planlı) alınıyor ve kartla
ödeniyor. Ayrıca İptal, İade ve Cayma belgesinde kafe siparişine özgü bir
madde yok; uygulamanın ödeme ekranındaki cayma bilgisi ise bir iptal hakkı
tanıyor ("Siparişin hazırlanmaya başlamadan önce iptal edilebilir") ve bu
hakkın hangi yoldan kullanılacağı hiçbir belgede yazmıyor.

### 8.2 Koddaki kanıt

- `docs/API-MOBILE.md` §3 `POST /orders`: `kind` = `cafe`,
  `fulfillment` = `pickup | delivery`, `scheduledFor`; sipariş sunucuda
  fiyatlanır ve PayNkolay'a gönderilir.
- `lafmobil` `src/i18n/screens/checkout.ts` satır 127: "Hazırlanarak sunulan
  yiyecek ve içeceklerde cayma hakkı yoktur. Siparişin hazırlanmaya
  başlamadan önce iptal edilebilir."
- Uygulamada ve mobil API'de üyenin kendisinin iptal edebileceği bir uç yok
  (`src/app/api/mobile/v1/orders/**` yalnızca sipariş oluşturma, okuma ve
  ödeme bağlantısı sunar). İptali personel panelden yapar; iptal edilince
  kupon geri verilir ve damga geri alınır (`src/lib/admin/store.ts`
  `transitionOrder`), tahsil edilen tutar panelden iade edilir.
- Sitede kafe siparişi yok: menü sayfası 22 Haz 2026'dan beri yalnız
  görüntüleme (commit `e88f2b0`, "view-only menu").

### 8.3 KS1 - Kafe menüsünü yalnızca bilgilendirme sayan cümleler (12 cümle)

| Belge, satır | Mevcut | Önerilen |
|---|---|---|
| Ön Bilgilendirme, 261 | "Kafe menüsünde yer alan içecek ve tatlılar, işletme içinde sunulan hizmetler olup online mağaza üzerinden mesafeli satışa konu edilmez; internet sitesindeki menü sayfası ile mobil uygulamadaki menü ekranı yalnızca tanıtım ve bilgilendirme amacı taşır." | "Kafe menüsündeki içecek ve tatlılar, yalnızca mobil uygulama üzerinden, kafeden gel-al veya kurye ile teslim edilmek üzere sipariş edilebilir; bu siparişler de işbu Form'a tabidir ve cayma hakkı bakımından 12. maddedeki istisna uygulanır. İnternet sitesindeki menü sayfası yalnızca bilgilendirme amacı taşır; sitede kafe siparişi alınmaz." |
| Mesafeli Satış, 874 | "Web sitesi veya mobil uygulama üzerinde yer alan kafe menüsü yalnızca bilgilendirme amaçlıdır ve tek başına bir satış icabı oluşturmaz." | "İnternet sitesindeki kafe menüsü yalnızca bilgilendirme amaçlıdır. Kafe menüsündeki ürünler mobil uygulama üzerinden sipariş edildiğinde bu sipariş işbu Sözleşme'ye tabidir." (Satır 873'teki "fiziki işletmesinde yüz yüze" gerçekleştirilen hizmetler istisnası doğrudur, kalır.) |
| Teslimat ve Kargo, 1927 | "... yerinde sunulan ve yerinde tüketilen kafe menüsü ürünleri, mesafeli sözleşme kapsamında olmadığından bu metnin kargo ve teslimat hükümlerine tabi değildir; ..." | Cümle korunur, sonuna eklenir: "Mobil uygulama üzerinden verilen ve kurye ile teslim edilen kafe siparişleri de bu metnin kargo hükümlerine tabi değildir; bu siparişlerin iptal ve iadesi İptal, İade ve Cayma belgesinin kafe siparişlerine ilişkin maddesinde düzenlenir." |
| Satış Politikası, 3412-3413 | "{{SITE}} ve mobil uygulama üzerinde yer alan kafe menüsü yalnızca tanıtım amaçlıdır. Menüde görünen içecek ve tatlılar için site veya uygulama üzerinden sipariş verilemez, ödeme alınmaz ve rezervasyon yapılmaz. ... Online ödeme yalnızca bottega bölümünde listelenen fiziksel ürünler için alınır." | "{{SITE}} üzerindeki kafe menüsü yalnızca tanıtım amaçlıdır; sitede kafe siparişi alınmaz. Kafe menüsündeki ürünler mobil uygulama üzerinden gel-al veya kurye ile teslim için sipariş edilebilir ve ödemesi PayNkolay üzerinden alınır. Sitedeki menü fiyatları bilgilendirme amacıyla yayımlanır; kafede yerinde satışta işletmedeki güncel fiyat, uygulama siparişinde sipariş anında uygulamada gösterilen fiyat esas alınır. Karaoke odası rezervasyon talebi sitede ve uygulamada iletilebilir; bu talep için çevrim içi ödeme alınmaz." |
| Satış Politikası, 3414 | "... iyzico sanal POS altyapısı üzerinden alınan işlemlerin tamamı, fiziksel ürün sevkiyatı ile sonuçlanan bottega siparişlerinden oluşur." | "... PayNkolay sanal POS üzerinden alınan işlemler, bottega siparişleri ile mobil uygulamadan verilen kafe siparişlerinden oluşur." |
| Satış Politikası, 3415 | "Kafede yapılan alışverişte mobil uygulamadan QR kod okutularak ödül puanı kazanılması bir online satış işlemi değildir; ..." | "Kafede kasada yapılan alışverişte, uygulamanın gösterdiği kasa koduyla damga eklenmesi bir online satış işlemi değildir; kafe içi ödeme işletmede yüz yüze tahsil edilir." |
| Şirket Bilgileri, 12820 | "... kafe menüsü üzerinden internet aracılığıyla sözleşme kurulmaz, bu nedenle menü kalemleri bakımından mesafeli satış hükümleri uygulanmaz." | "Kafede yerinde yapılan satışlar mesafeli sözleşme değildir. Kafe menüsündeki ürünler mobil uygulamadan sipariş edildiğinde mesafeli satış hükümleri uygulanır; cayma hakkının istisnası için İptal, İade ve Cayma belgesine bakınız." |
| Şirket Bilgileri, 12860 | "... bilgilendirme amaçlı kafe menüsü ve marka içerikleri ile sözleşme kurulmasına imkân veren online mağaza. Kafe menüsü sayfalarında yer alan fiyatlar yalnızca bilgilendirme amaçlıdır ve mesafeli satış konusu değildir; mesafeli satış yalnızca online mağaza üzerinden verilen siparişler bakımından söz konusudur." | "... sitede bilgilendirme amaçlı kafe menüsü ve marka içerikleri ile online mağaza; mobil uygulamada ayrıca kafe siparişi. Mesafeli satış, online mağaza siparişleri ile mobil uygulamadan verilen kafe siparişleri bakımından söz konusudur." |

(Tablodaki uzun alıntılar kısaltılmıştır, "..." işaretli; tam cümleler Ek A'dadır.)

### 8.4 KS2 - İptal, İade ve Cayma'ya eklenecek yeni madde

Önerilen başlık ve yer: "7/A. Mobil Uygulamadan Verilen Kafe Siparişleri"
(7. madde, cayma istisnalarından hemen sonra; numara avukatın tercihine
göre).

> 1. Bu madde, {{BRAND}} mobil uygulaması üzerinden verilen ve kafede
>    hazırlanarak gel-al veya kurye ile teslim edilen yiyecek ve içecek
>    siparişlerine (kafe siparişleri) uygulanır. İleri bir saate planlanan
>    kafe siparişleri de bu kapsamdadır.
> 2. Kafe siparişleri, hazırlanarak sunulan ve çabuk bozulabilen yiyecek ve
>    içeceklerin belirli bir zamanda tedarikine ilişkin olduğundan, Mesafeli
>    Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca cayma hakkı
>    kullanılamaz. Bu husus sipariş öncesinde ödeme ekranında ayrıca
>    gösterilir.
> 3. Kafe siparişi, hazırlanmaya başlanmadan önce iptal edilebilir. İptal
>    talebi {{PHONE}} numarası aranarak veya kafede personele iletilir;
>    ayrıca {{EMAIL}} adresine yazılabilir. Hazırlanmaya başlanmış bir
>    siparişin iptali Satıcı'nın takdirindedir.
> 4. İptal edilen kafe siparişinin tahsil edilen bedelinin tamamı, bu
>    belgenin 10. maddesindeki usulle ödemenin yapıldığı karta iade edilir.
>    Siparişte kullanılan kupon hesaba geri tanımlanır ve siparişten
>    kazanılan damga geri alınır.
> 5. Teslim edilen ürünün ayıplı, yanlış veya eksik olması hâlinde
>    6502 sayılı Kanun'dan doğan seçimlik haklarınız saklıdır. Durumu
>    teslimden sonra gecikmeksizin {{PHONE}} numarasına veya kafede
>    personele bildirmeniz, ürünün yeniden hazırlanmasını veya bedelinin
>    iadesini hızlandırır.

Avukata üç not:

- Yönetmelik m.15'in hangi bentlerinin (çabuk bozulabilen mallar;
  belirli bir tarihte yapılması gereken yiyecek-içecek tedariki)
  anılacağı avukatın takdirindedir; mevcut Ön Bilgilendirme satır 422 ve
  İade ve Cayma satır 1463 bu iki kavramı zaten kullanıyor.
- Madde 3'teki iptal kanalı bir **süreç taahhüdüdür**: operatör, açık
  olduğu saatlerde telefonla gelen iptali panelden işleyebileceğini teyit
  etmelidir. Uygulamada kendi kendine iptal düğmesi yoktur ve bu madde
  öyle bir düğme vaat etmez.
- Kurye ile teslim edilen kafe siparişlerinde teslimatı kimin yaptığı
  (kendi kuryesi mi, bir kurye firması mı) bu depoda yazmıyor; bir kurye
  firması kullanılıyorsa R7 alıcı listelerine eklenmelidir.

---

## 9. R7 - Veri işleyenler: Supabase (kimlik), Geliver ve taşıyıcılar

### 9.1 V1 - Supabase (üyelik kimliği)

**Neden.** Site ve uygulamanın ortak üyelik girişi Supabase Auth ile
yapılıyor. Hukuki metinlerde "Supabase" **hiç geçmiyor** (0 sonuç); alıcı ve
yurt dışı aktarım listelerinde kimlik doğrulama hizmeti yok.

**Kanıt.**

- `docs/AUTH-BRIDGE.md` §0: "Kimlik (kim olduğun: e-posta + parola, token,
  oturum) | Supabase Auth - tek proje, hem site hem uygulama".
- Kayıtta Supabase'e giden bilgiler: e-posta, parola (Supabase parolanın
  özetini tutar) ve üye bilgisi alanlarında ad-soyad (`full_name`),
  telefon, koşulların kabul anı (`terms_accepted_at`), ticari ileti onay
  anı (`marketing_consent_at`) (`lafmobil` `src/lib/supabase/session.ts`;
  site `src/lib/customer/supabase-bridge.ts`).
- Sitede Supabase oturum çerezleri (`sb-<proje>-auth-token`, parçalı
  olarak `.0`, `.1`) kullanılıyor (`src/lib/supabase/proxy.ts`); Çerez
  Politikası §8 envanterinde yoklar.
- Supabase projesinin sunucu bölgesi bu depoda doğrulanamadı
  (`docs/SUPABASE-GECIS.md` bölgenin panelden okunacağını söylüyor).
  Proje Türkiye dışındaki bir bölgedeyse (panelden teyit edilmeli) bu,
  KVKK m.9 kapsamında bir yurt dışı aktarımdır; bölge ve sağlayıcının
  sözleşme tarafı (veri işleme sözleşmesi) avukata sunulmalıdır.

**Öneri.**

1. `entity.ts`'e `authProvider: "Supabase"` ve `{{AUTH_PROVIDER}}`
   yer tutucusu eklenir.
2. Aşağıdaki listelere satır ya da ibare eklenir:

| Belge, yer | Eklenecek |
|---|---|
| Gizlilik §8 alıcı tablosu (satır 5245-5312) | Yeni satır: "Kimlik doğrulama hizmeti sağlayıcısı ({{AUTH_PROVIDER}})" / "Site ve mobil uygulamada ortak üyelik girişinin sağlanması: e-posta adresi, parolanın özeti, ad-soyad, telefon, koşulların ve ticari ileti onayının kabul anı, oturum belirteçleri ve giriş kayıtları (IP adresi dâhil). Sipariş, ödeme, damga ve adres bilgisi bu sağlayıcıya gönderilmez." |
| Gizlilik §9 yurt dışı (satır 5319) | Hizmet listesine "kimlik doğrulama (üyelik girişi)" |
| KVKK §14 aktarım tablosu (satır 6104-6156) | Yukarıdaki satır; hukuki sebep KVKK m.5/2-c |
| KVKK §15 yurt dışı (satır 6164, 6170) | "üyelik kimlik doğrulaması ({{AUTH_PROVIDER}})" |
| Açık Rıza R6 (satır 6762, 6769, 6771) | Altyapı listesine "üyelik kimlik doğrulaması için {{AUTH_PROVIDER}}" |
| Veri Saklama §14 (satır 8237) | Sağlayıcı listesine "kimlik doğrulama ({{AUTH_PROVIDER}})" |
| Ön Bilgilendirme §20 (satır 564), Mesafeli Satış §16 (satır 1124) | Alıcı listesine "üyelik girişinin sağlanması amacıyla kimlik doğrulama hizmeti sağlayıcısı {{AUTH_PROVIDER}} ile" |
| Şirket Bilgileri §6 (satır 12959 ve sonrası), Güvenli Alışveriş §22 (satır 4725 ve sonrası), Mobil Uygulama Koşulları §16 (satır 11926), Kullanım Şartları §15 (satır 10192), Üyelik Sözleşmesi §17 ve §20 (satır 10802, 10843) | Altyapı sağlayıcı listelerine "{{AUTH_PROVIDER}} (üyelik kimlik doğrulaması)" |
| Çerez Politikası §8 zorunlu çerezler (satır 8597 ve sonrası) | Yeni satır: "sb-...-auth-token (ve .0, .1 parçaları)" / "Amaç: site ve uygulama için ortak üyelik girişinin sürdürülmesi ve oturum belirtecinin yenilenmesi. Taraf: birinci taraf ({{SITE}} alan adında). Tür ve süre: [tarayıcıda okunup yazılmalı]. Rıza: gerekmez, zorunlu." |

Not: `@supabase/ssr` oturum çerezinin süresi ve bayrakları bu turda
ölçülmedi; tablo satırı yazılmadan önce tarayıcıda bir kez okunmalı.

### 9.2 V2 - Geliver ve taşıyıcılar (34 cümle)

**Neden.** Metinler taşıyıcıyı sabit yazıyor: "Türkiye geneli için Yurtiçi
Kargo, KKTC ve yurt dışı gönderiler için Aras Kargo". Kargo bugün Geliver
kargo platformu üzerinden, gönderi anında kabul edilen teklife göre seçilen
bir taşıyıcıyla alınıyor; "Geliver" hiçbir metinde geçmiyor.

**Kanıt.** `docs/API-MOBILE.md` §3.1: "Köşk ... kargoyu **Geliver** üzerinden
satın alır"; `shipment.carrier` "teklif kabul edilene kadar null" (örnek
değer "Sürat Kargo"). `docs/GELIVER.md`: Geliver, gönderi durumunu sitenin
`/api/webhooks/geliver` ucuna bildirir. Panelde taşıyıcı serbest metin
("Yurtiçi Kargo, Aras, MNG…", `src/components/admin/order-detail.tsx`).
Gönderi Geliver'da oluşturulduğu için alıcının adı, adresi ve telefonu
Geliver'a ve seçilen taşıyıcıya iletilir (site Geliver'ı çağırmaz; gönderiyi
personel Geliver'da oluşturur, `docs/GELIVER.md` "Tek yön").

**Öneri.**

- Alıcı listeleri (Gizlilik satır 5255-5257, KVKK satır 6109-6111 ve
  Güvenli Alışveriş satır 4759): "Kargo gönderi platformu Geliver
  ([GELİVER TİCARET UNVANI]) ve gönderiyi taşıyan kargo firması: gönderinin
  oluşturulması, taşınması ve takibi amacıyla alıcı adı, teslimat adresi ve
  telefon numarası; gönderi takip bilgisi Geliver'dan sitemize bildirilir."
- Taşıyıcının adıyla yapılan taahhütler (Ön Bilgilendirme satır 339-343,
  Mesafeli Satış 917-921 ve 1015-1019, Teslimat ve Kargo §8, Ödeme
  Koşulları 3990-3994, Kullanım Şartları 10052-10056, Şirket Bilgileri
  13007-13011 ve 13113-13117, Satış Politikası 3672, Şikâyet 14010, Gıda
  Güvenliği 15160): "Gönderiler, Geliver üzerinden gönderi anında seçilen
  anlaşmalı kargo firmasıyla taşınır; gönderiyi taşıyan firmanın adı ve
  takip numarası kargo bildiriminde ve sipariş ekranında gösterilir."
- İade gönderileri ("Yurtiçi Kargo (iade kodu ile ücretsiz)", Ön
  Bilgilendirme 454; İade ve Cayma 1424, 1679, 1747-1751; Teslimat ve
  Kargo 2240, 2441, 2450): **operatör teyidi gerekir.** Yurtiçi Kargo ile
  anlaşmalı bir iade kodu gerçekten varsa bu cümleler kalır; yoksa "İade
  gönderisinin hangi kargo firmasıyla ve hangi kodla yapılacağı, iade
  talebiniz kabul edildiğinde e-posta ile bildirilir; cayma hâlinde iade
  kargo bedeli Satıcı'ya aittir" yazılır.
- "İstanbul içi motokurye" geçen yerlerde kurye hizmetinin kim tarafından
  verildiği operatörce teyit edilmeli (bkz. §8.4 üçüncü not).

### 9.3 V3 - Diğer sağlayıcılar (kontrol sonucu)

Uygulamada ve sitede başka bir üçüncü taraf veri alıcısı bulunmadı:
uygulamada analitik, çökme raporlama, reklam veya uzaktan güncelleme
(`expo-updates`) kütüphanesi yok; sitede adı geçen Vercel, {{DB_PROVIDER}}
(bugün Neon), Resend, Google (analitik, rızaya bağlı) ve OpenAI (R12,
kapalı) metinlerde zaten var. (17 Eki 2026: R12 alıcısı artık Anthropic,
PBC; OpenAI metinlerden çıktı, §15.)

---

## 10. R8 - Kaldırılmış bayilik ve toptan satış başvuru formları

**Kanıt.** Franchise sayfası, başvuru formu ve panel ekranları 22 Haziran
2026'da kaldırıldı (commit `e88f2b0`, "Franchise - removed completely
(customer + admin)"); franchise tabloları 26 Ağustos 2026'da silindi
(`db/migrations/20260826120000_drop_franchise_tables.sql`, commit
`446b438`). Sitede toptan satış ya da genel iletişim formu da yok
(`src/app` altında böyle bir sayfa veya eylem yok); iletişim e-posta ve
telefonla.

**Öneri (F1).** Formlardan veri toplandığını söyleyen dört tablo satırı
çıkarılır ve ilgili ibareler düzeltilir:

| Belge, satır | Mevcut | Önerilen |
|---|---|---|
| Gizlilik, 5066 | "Bayilik/franchise, toptan satış, iş birliği ve tedarik başvurularında iletilen ad-soyad, unvan, şirket bilgisi, iletişim bilgileri ve başvuru içeriği." | "E-posta yoluyla iletilen iş birliği ve tedarik tekliflerindeki ad-soyad, unvan, şirket bilgisi, iletişim bilgileri ve teklif içeriği." |
| Gizlilik, 5076 | "... ödeme adımı formları ile iletişim, bayilik ve toptan satış başvuru formları." | "... ödeme adımı formları." |
| Gizlilik, 5205 | "Bayilik, toptan satış ve iş birliği başvurularının değerlendirilmesi" | "E-posta ile iletilen iş birliği ve tedarik tekliflerinin değerlendirilmesi" |
| Gizlilik, 5388 | "Bayilik ve iş birliği başvuruları" | "İş birliği ve tedarik teklifleri" (saklama süresi aynı kalır) |
| Gizlilik, 4895 | "... kurumsal ve bayilik başvurusu yapan kişileri, ..." | "... iş birliği teklifinde bulunan kişileri, ..." |
| KVKK, 5835 | "Basın mensupları, franchise/iş birliği talebiyle başvuranlar, ..." | "Basın mensupları, iş birliği teklifiyle başvuranlar, ..." |
| Şirket Bilgileri, 12873 | "Marka hikâyesi, ziyaret bilgileri, basın içerikleri ve franchise başvuru bilgilerinin yayımlanması." | "Marka hikâyesi, ziyaret bilgileri ve basın içeriklerinin yayımlanması." |
| Şirket Bilgileri, 13356 | "Basın, iş birliği ve franchise talepleri" | "Basın ve iş birliği talepleri" |
| Şirket Bilgileri, 13493 (başlık) | "15. Kurumsal Satış, Franchise ve Basın İletişimi" | "15. Kurumsal Satış ve Basın İletişimi" |
| Şirket Bilgileri, 13497, 13501, 13513 | Franchise başvuru bilgileri, başvuru ücreti alınmadığı, "Franchise başvuruları" satırı | Çıkarılır. |

("..." işaretli alıntılar kısaltılmıştır; tam cümleler Ek A'dadır.)

Değişmeyenler: Satış Politikası'nın toptan ve kurumsal taleplerin e-posta
ile ayrı sözleşmeye yönlendirildiğini söyleyen hükümleri (satır 3467-3475,
3666), Ödül Programı satır 11263, Fikri Mülkiyet satır 12294 ve Şikâyet
satır 14162. Bunlar bir form değil politika anlatıyor ve doğrudur.

---

## 11. R9 - Fatura: e-Arşiv ve "e-posta ile iletilir"

**Neden.** Dokuz belge, faturanın müşterinin e-posta adresine elektronik
ortamda iletildiğini ve sitedeki veya uygulamadaki sipariş detayından
indirilebildiğini söylüyor. Bu iki işlev yok.

**Kanıt.** Kodda e-Arşiv entegratörü veya fatura üreten bir modül yok;
e-posta şablonlarında fatura eki ya da fatura bağlantısı yok
(`src/lib/email/templates/`); site üye sayfalarında (`src/app/uye`) ve
uygulamada fatura indirme yok (uygulamanın arayüz sözlüğünde, `src/i18n`,
"fatura" sözcüğü hiç geçmiyor).

**Öneri (E1, 24 cümle).** Fatura düzenleme yükümlülüğü (213 sayılı VUK)
yerinde kalır; iletim yolu yazılmaz ya da operatörün bugünkü fiilî
uygulaması yazılır.

- Mevcut (Mesafeli Satış Sözleşmesi, satır 995): "Fatura, siparişin onaylanmasını takiben ALICI'nın kayıtlı e-posta adresine elektronik ortamda gönderilir ve ayrıca ALICI'nın web sitesi veya mobil uygulamadaki üyelik hesabının sipariş detay sayfasından indirilebilir."
- Önerilen: "Fatura, 213 sayılı Vergi Usul Kanunu ve ilgili mevzuata uygun olarak düzenlenir ve ALICI'ya [BUGÜNKÜ İLETİM YOLU: örneğin ürünle birlikte kâğıt olarak / talep üzerine e-posta ile] iletilir."
- Her sipariş için e-Arşiv fatura düzenlendiğini söyleyen cümleler (Mesafeli Satış 994, Ödeme Koşulları 4128, Ödül Programı 11452, Şirket Bilgileri 13451, 13475): Şirket e-Arşiv mükellefiyse doğrudur ve kalır; değilse "fatura" olarak genelleştirilir. **Bu, mali müşavirin teyit edeceği bir vergisel durumdur**; bu belge onu varsaymaz.
- Faturanın sipariş detayından veya üye panelinden indirilebildiğini söyleyen ifadeler (Ön Bilgilendirme 497, Mesafeli Satış 995, Ödeme Koşulları 4128, Garanti 3099, Şirket Bilgileri 13451, Şikâyet 14040) e-Arşiv altyapısı ve indirme ekranı kurulana kadar çıkarılır.
- "e-Arşiv fatura hâllerinde SATICI, iade işlemini kendi sistemlerinde belgelendirir" (Mesafeli Satış 997) mali müşavir teyidine bağlı olarak kalabilir.

---

## 12. R10 - Posta kodu 34940

**Kanıt.** Site `CLAUDE.md` adres satırı: "34940 Tuzla / İstanbul -
vergi levhasıyla doğrulandı". Uygulama `CLAUDE.md` §3.2b: "Doğru posta
kodu **34940**". Sitenin kendi sayfaları zaten 34940 basıyor
(`src/components/laffogato/chrome.tsx`, `src/components/laffogato/data.ts`).
`entity.ts` adres nesnesinde posta kodu alanı yok, bu yüzden hukuki
metinlerdeki `{{ADDRESS}}` onu basmıyor.

**Öneri.** `entity.ts`: `address.postalCode: "34940"`; `LEGAL_ADDRESS_LINE`
çıktısı "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1, 34940
Tuzla/İstanbul, Türkiye". `{{ADDRESS}}` 25 belgenin hepsinde 97 kez
geçtiği için bu değişiklik her belgenin tarihini değiştirir (§2/3); bu
yüzden bu PR'a katıldı (ayrı yapılsaydı iki kez tarih atılırdı). Tebligat
adresi olarak basıldığı için avukatın bir kez okuması yeterlidir.

---

## 13. R11 - Uzun tireler

**Kural.** Operatörün 22 Eylül 2026 kararı: tek çizgi, tire (`-`). Uzun tire
(U+2014) ve orta tire (U+2013) kullanılmaz.

**Sayım.** `LEGAL_CONTENT` gövdesinde 106 uzun tire ve 1 orta tire, toplam
107; hepsi 105 cümlede. 106 uzun tirenin tamamı iki yanı boşluklu
(" [U+2014] ") ve cümle içi ara söz işlevinde; 46'sı kaynakça satırlarında
("Mesafeli Sözleşmeler Yönetmeliği (...) [U+2014] m.5 ..."). Orta tire bir saat
aralığında: "Hafta içi 09.00[U+2013]18.00 arası" (Şikâyet, satır 13789).

**Öneri (T1).** " [U+2014] " yerine " - ", "[U+2013]" yerine "-". Anlam
değişmez; Ek A'da her cümlenin önerilen hâli tam yazılıdır. Aynı PR'da iki
kod dışı dize de tireye çevrilmeli: `entity.ts` `TOKENS.NACE` (bugün hiçbir
belgede basılmıyor) ve `scripts/legal-export.mjs` satır 92'deki başlık
(uygulamanın `legal.seed.json` dosyasına yazılıyor).

---

## 14. Avukata ve operatöre açık sorular

| # | Soru | Kime | Neden gerekli |
|---|---|---|---|
| 1 | PayNkolay hizmetini sunan tüzel kişinin ticaret unvanı ve lisans türü | Operatör (üye iş yeri sözleşmesi) | Ö2; Şirket Bilgileri 13600'daki duyuru sözü |
| 2 | PayNkolay üye iş yeri panelinden kısmi iade yapılabiliyor mu | Operatör | Ö10 (a) ya da (b) |
| 3 | Kart sahibinin adı ödeme kaydında saklansın mı | Avukat + yazılım | Ö7; veri en aza indirme |
| 4 | Canlı ödeme sayfasında taksit seçeneği görünüyor mu | Operatör (bir kez gözle) | Ö8 |
| 5 | Mükerrer tahsilatta "en geç 2 iş günü" elle tutulabilir mi | Operatör | Ö12 |
| 6 | Kasada tek işlemde kaç damga veriliyor | Operatör | D-EK1 |
| 7 | Kafede basılı karekod materyali var mı | Operatör | Q5 |
| 8 | Kafe siparişinin telefonla iptalini açık saatlerde işleyebilecek mi; kurye teslimatını kim yapıyor | Operatör | KS2 madde 3; V2 |
| 9 | Supabase projesinin bölgesi, sözleşme tarafı ve KVKK m.9 kapsamında yurt dışı aktarım dayanağı (standart sözleşme ve Kurul'a bildirim dâhil) | Avukat + operatör | V1 |
| 10 | Geliver'ın ticaret unvanı ve veri işleme sözleşmesi; Yurtiçi Kargo ile anlaşmalı iade kodu var mı | Operatör | V2 |
| 11 | Şirket e-Arşiv mükellefi mi; faturalar bugün müşteriye nasıl iletiliyor | Mali müşavir | E1 |
| 12 | R8 (pazarlama amaçlı push bildirimi) rıza kalemi, sunucudan push gönderilmediği için kalkmalı mı | Avukat | C2 |
| 13 | fA'L yapay zekâ yorumu (R12) açılmadan önceki avukat okuması | Avukat | Q2 paragrafı R12'ye atıf yapıyor; R12 metninin kendisi bu belgenin kapsamı dışında. 17 Eki 2026'da alıcı Anthropic, PBC oldu: okunacak metin ve sorular §15'te |

---

## 15. Y1 - fA'L yapay zekâ alıcısı: OpenAI yerine Anthropic (17 Eki 2026)

> **Durum: metin kodda değişti, avukat okuması bekliyor.** Bu bölüm, yukarıdaki
> Eylül listesinden farklı olarak metni **değiştiren** PR'ın avukat notudur
> (dal `feat/fal-anthropic`). Yapay zekâ yorumu (`FAL_AI_ENABLED`) avukat onayı ve
> §15.5'teki adımlar tamamlanmadan açılmaz.
>
> **19 Eki 2026:** avukat turu yok (operatör kararı, 18 Eki 2026). Yurt dışına
> aktarım metinleri, R12'nin saklama cümleleri ve fA'L'ın kod kapısı §15.6'da;
> Y1-3, Y1-4, Y1-6 ve Y1-10 orada kapandı.
>
> **27 Eki 2026: bu bölüm tarihçedir.** fA'L ve yapay zekâ yorumu uygulamadan
> kalktı (App Review 4.3(b)); R12 ve Anthropic metinlerden çıktı (§36).

### 15.1 Neden

Operatör kararı (17 Eki 2026): fA'L'ın yapay zekâ yorumu OpenAI yerine
Anthropic'in Claude API'si ile yapılacak. R12, fotoğrafın bu amaçla işlenmesi
ve sağlayıcıya gönderilmesi için alınan açık rızadır (KVKK m.5/1; m.3'e göre
açık rıza belirli bir konuya ilişkin ve bilgilendirmeye dayanır). Alıcı bu
bilginin parçasıdır: alıcı değişince metin de, rızanın kendisi de yenilenmek
zorunda; OpenAI'ye gönderim için verilmiş bir "evet" Anthropic'e gönderim için
kullanılamaz.

**Yurt dışına aktarım: KVKK m.9 (7499 sayılı Kanun'la değişik, 1 Haziran
2024'ten beri).** R12 rızası işlemenin şartıdır, ama bu aktarımın m.9 dayanağı
olamaz:

- Yeterlilik kararı yoksa aktarım, m.5 ve m.6 şartlarından biri (burada R12)
  **ve** m.9/4'teki uygun güvencelerden biriyle yapılır. Anthropic için
  uygulanabilir olanı Kurul'un ilan ettiği standart sözleşmedir (m.9/4-c):
  veri sorumlusundan veri işleyene aktarım için "Standart Sözleşme - 2" (Kurul
  kararı 04.06.2024, 2024/959). ABD için yayımlanmış bir yeterlilik kararı
  bulunamadı (17 Eki 2026 araması; avukat teyit etmeli).
- Standart sözleşme, imzaların tamamlanmasından itibaren beş iş günü içinde
  Kurum'a bildirilir (m.9/5; Yönetmelik m.14/5: fiziki olarak, KEP ile ya da
  Kurul'un belirlediği yolla, bugün Standart Sözleşme Bildirim Modülü). Kurum'un
  5 Şubat 2025 duyurusuna göre metne yalnız seçimlik ve alternatif maddelerde
  dokunulur, Türkçe metin imzalanır ve imzacının yetki belgesi sunulur.
- Açık rızaya dayalı aktarım (m.9/6-a: olası riskler anlatılarak alınan rıza)
  yalnız **arızi** aktarım içindir. Yönetmelik m.16/1: "Düzenli olmayan, tek
  veya birkaç sefer gerçekleşen, süreklilik arz etmeyen ve olağan faaliyet
  akışı içinde bulunmayan aktarımlar arızi niteliktedir." fA'L'da fotoğraf,
  özellik açıkken her yorum isteğinde Anthropic'e gider: aktarım düzenli ve
  olağan akışın içindedir, arızi değildir. Bu yüzden standart sözleşme olmadan
  özellik açılamaz; R12 rızası onun yerini tutmaz.
- Anthropic bu metni imzalamazsa bu aktarım için m.9'da başka bir yol
  görünmüyor (bağlayıcı şirket kuralları bir şirketler topluluğu içindir,
  taahhütname Kurul izni ister). O durumda özellik kapalı kalır. Bu
  değerlendirme avukatındır (Y1-1).

Kaynaklar: Kanun m.9'un Kurum'daki resmî İngilizce çevirisi
(kvkk.gov.tr/Icerik/6649); Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin
Usul ve Esaslar Hakkında Yönetmelik (RG 10.07.2024, 32598); Kurum duyuruları
kvkk.gov.tr/Icerik/7938 (standart sözleşme metinleri), /8043 (bildirim modülü)
ve /8170 (standart sözleşmede dikkat edilecekler).

Metinler buna göre düzeltildi (§15.3'teki son üç satır): R12 ve Aydınlatma §15
artık aktarımın arızi olmadığını ve standart sözleşmeye dayandığını söylüyor;
Gizlilik Politikası §9'daki genel cümle açık rızayı arızi hâllerden biri olarak
anıyor (Çerez Politikası zaten böyle diyordu).

### 15.2 Koddaki güvenceler

- Fotoğraf yalnız metinlerin andığı alıcıya gider: `src/lib/mobile/fal-core.ts`
  `FAL_DISCLOSED_PROVIDER = "anthropic"`. Ortam değişkeniyle OpenAI seçilse
  bile özellik kapalı kalır (`falAiEnabled`). `tests/legal-fal-recipient.test.ts`
  metinlerin bu sağlayıcının unvanını (`Anthropic, PBC`) andığını ve başka
  sağlayıcının adının geçmediğini tutar. Fotoğrafı gönderen tek fonksiyon
  (`src/lib/mobile/fal.ts` `readCupWithAI`) da metinlerin anmadığı bir
  sağlayıcıya hiçbir şey göndermez: route'un denetimine ek ikinci kilit
  (`tests/mobile-fal-provider.test.ts`).
- Sunucu, üyenin rıza sayfasında hangi metni gördüğünü bilemez: uygulama
  `POST /fal/consent`'e `GET`'te aldığı sürümü geri yollar ve rıza sayfasındaki
  dört satır uygulamanın kendi metnidir (lafmobil `src/i18n/screens/fal.ts`,
  bugün "OpenAI'ye (ABD)"). OpenAI diyen bir uygulama sürümü, özellik açılınca
  yeni sürüme "evet" kaydettirebilir; bu yüzden §15.5 adım 4 ve Y1-9.
- Rıza sürümü alıcıyı adlandırır: `2026-10-17-anthropic` (önceki sürüm
  `2026-09-23`, alıcı OpenAI). Eski sürümle verilmiş rıza sayılmaz; uygulama
  `GET /fal/consent` yanıtında `granted: false` görür ve rızayı yeniden sorar.
  Daha önce "hayır" demiş üyeye de bir kez sorulur, çünkü sürüm değişti.
  `tests/mobile-fal-consent.test.ts` tutar.
- Sağlayıcıya giden veri değişmedi: küçültülmüş, meta verisi silinmiş fotoğraf
  ve kimliksiz not (seviye, ziyaret sıklığı kelimesi, varsa her zamanki içecek).
  Ad, e-posta, telefon ve üye no gitmez. Sunucu kayıtlarına (log) yalnız durum
  kodu, durma sebebi ya da hata sınıfı yazılır; fotoğraf, talimat, üye bilgisi
  ve anahtar yazılmaz.
- OpenAI'ye istek `store: false` ile gidiyordu. Anthropic'in Messages API'sinde
  böyle bir anahtar yok; R12'deki "yanıtı saklamaması talimatıyla iletilir"
  sözü bu yüzden çıktı.

### 15.3 Değişen cümleler

Satır numaraları `src/lib/legal/content.ts`'in bu PR'daki hâline aittir. Üç
belgenin "Son güncelleme" tarihi 17 Ekim 2026 oldu; `LEGAL_UPDATED` (ödeme
onayının kaydettiği sürüm) değişmedi.

| Belge | Satır | Mevcut (16 Eki 2026) | Yeni |
|---|---|---|---|
| Gizlilik Politikası, kamera ve fotoğraf izni | 4953 | "... yapay zekâ hizmet sağlayıcısına iletilir ve saklanmaz." | "... iletilir ve şirketimizce saklanmaz." |
| Gizlilik Politikası, alıcı tablosu ("Yapay zekâ hizmet sağlayıcısı") | 5191 | "... OpenAI, L.L.C.'ye (ABD) aktarılması; fotoğraf saklanmaz, ..." | "... Anthropic, PBC'ye (ABD) aktarılması; fotoğraf şirketimizce saklanmaz, ..." |
| Gizlilik Politikası, cihaz izinleri | 5386 | "... R12 bölümü uyarınca aktarılır ve saklanmaz." | "... aktarılır ve şirketimizce saklanmaz." |
| KVKK Aydınlatma §9 | 5949 | "... OpenAI, L.L.C.'ye (ABD) kimliksiz bir özetle ..." | "... Anthropic, PBC'ye (ABD) kimliksiz bir özetle ..." |
| KVKK Aydınlatma §12 | 5997 | "... OpenAI, L.L.C.'ye (ABD) aktarılır ve şirketimizce saklanmaz ..." | "... Anthropic, PBC'ye (ABD) aktarılır ..." |
| KVKK Aydınlatma §15 | 6111 | "... içecek fotoğrafının OpenAI, L.L.C.'ye (ABD) aktarılması ..." | "... Anthropic, PBC'ye (ABD) aktarılması ..." |
| KVKK Aydınlatma §15, alıcılar ve bilinen konumlar | 6119 | "... yalnızca açık rızanızla OpenAI, L.L.C. (ABD)." | "... yalnızca açık rızanızla Anthropic, PBC (ABD)." |
| Açık Rıza, rıza tablosu (R12) | 6589 | "OpenAI (ABD) altyapısına aktarılır; fotoğraf saklanmaz." | "Anthropic, PBC (ABD) altyapısına aktarılır; fotoğraf şirketimizce saklanmaz." |
| Açık Rıza §11 (R6), kullanılan altyapılar | 6652 | "... onayınız hâlinde OpenAI." | "... onayınız hâlinde Anthropic, PBC." |
| Açık Rıza §15/A (R12), 2. paragraf | 6707 | "... OpenAI, L.L.C. (Amerika Birleşik Devletleri) tarafından sağlanan yapay zekâ hizmetine gönderilir." | "... Anthropic, PBC (Amerika Birleşik Devletleri) tarafından sağlanan yapay zekâ hizmetine gönderilir." |
| Açık Rıza §15/A (R12), 3. paragraf | 6708 | "Fotoğraf şirketimizce saklanmaz; yalnızca yorumun üretildiği istek süresince işlenir ve hizmet sağlayıcıya yanıtı saklamaması talimatıyla iletilir. Hizmet sağlayıcının kötüye kullanımın önlenmesi amacıyla kendi politikaları uyarınca sınırlı süreli kayıt tutabileceğini bildiririz." | "Fotoğraf şirketimizce saklanmaz; yalnızca yorumun üretildiği istek süresince işlenir. Hizmet sağlayıcının iletilen verileri, kötüye kullanımın önlenmesi ve güvenlik gibi amaçlarla, kendi ticari hizmet koşulları ve politikalarında belirlenen süre boyunca saklayabileceğini bildiririz." |
| Açık Rıza §15/A (R12), alıcı | 6716 | "Alıcı: OpenAI, L.L.C. (Amerika Birleşik Devletleri), veri işleyen sıfatıyla." | "Alıcı: Anthropic, PBC (Amerika Birleşik Devletleri), veri işleyen sıfatıyla." |
| Gizlilik Politikası §9, yurt dışına aktarım (m.9, §15.1) | 5244 | "Bu güvencelerin sağlanamadığı istisnai durumlarda aktarım, mevzuatta öngörülen arızi hâllere veya ayrıca alınan açık rızanıza dayanır." | "Bu güvencelerin sağlanamadığı istisnai durumlarda aktarım, yalnızca arızi nitelikte olması kaydıyla, mevzuatta sayılan hâllerden birine, örneğin aktarımın olası riskleri hakkında bilgilendirildikten sonra ayrıca vereceğiniz açık rızaya dayanabilir." |
| KVKK Aydınlatma §15, fA'L cümlesinin ardı (m.9, §15.1) | 6111 | (yok, eklendi) | "Açık rızanız bu işlemenin şartıdır; aktarım ise her yorum isteğinde tekrarlandığından arızi nitelikte değildir, bu nedenle yalnızca açık rızaya dayanmaz ve Kanun'un 9. maddesindeki uygun güvencelerden Kurul tarafından ilan edilen standart sözleşmeye dayandırılır." |
| Açık Rıza §15/A (R12), aktarım paragrafı (m.9, §15.1) | 6711 | "Yurt dışına aktarım, Kanun'un 9. maddesi uyarınca hizmet sağlayıcıyla akdedilen standart sözleşme gibi uygun güvencelere dayandırılır." | "Bu aktarım her yorum isteğinde tekrarlandığından arızi nitelikte değildir; bu nedenle yurt dışına aktarım yalnızca bu onaya dayanmaz, Kanun'un 9. maddesi uyarınca hizmet sağlayıcıyla akdedilen ve Kurul tarafından ilan edilen standart sözleşmeye dayandırılır." |

### 15.4 Avukata sorular

| # | Soru | Neden |
|---|---|---|
| Y1-1 | Anthropic, PBC ile "Standart Sözleşme - 2" (veri sorumlusundan veri işleyene) Türkçe metniyle ve değiştirilmeden imzalandı mı, imzaların tamamlanmasından itibaren beş iş günü içinde Kurum'a bildirildi mi (m.9/5, Yönetmelik m.14/5)? Anthropic imzalamazsa bu aktarım için m.9'da başka bir yol var mı (§15.1)? | Aktarım arızi olmadığı için R12 rızası m.9 dayanağı olamaz (m.9/6, Yönetmelik m.16/1). Bu olmadan özellik açılmaz. |
| Y1-2 | Anthropic'in Ticari Hizmet Koşulları (17 Haziran 2025'ten beri yürürlükte; anthropic.com/legal/commercial-terms) AEA, İsviçre ve Birleşik Krallık dışındaki müşteriler için sözleşme tarafını "Anthropic, PBC" olarak sayar ve Veri İşleme Ekini (DPA) atıfla sözleşmeye katar; Claude API belgeleri API'de Anthropic'in veri işleyen olduğunu söyler (platform.claude.com/docs/en/manage-claude/api-and-data-retention). Bu, metindeki "veri işleyen sıfatıyla" ifadesini ve KVKK m.12'nin veri işleme sözleşmesini karşılıyor mu? | R12 "Alıcı" maddesi; KVKK m.12. |
| Y1-3 | Saklama: R12 sağlayıcının saklamasını genel anlatıyor ("kendi ticari hizmet koşulları ve politikalarında belirlenen süre"). Anthropic'in ticari saklama politikası (privacy.claude.com, makale 7996866, 1 Temmuz 2026) API girdi ve çıktılarının alındıktan ya da üretildikten sonra 30 gün içinde silindiğini; Kullanım Politikası denetiminde işaretlenen içeriğin 2 yıla, sınıflandırma puanlarının 7 yıla kadar saklandığını; yasa gerektirirse daha uzun saklanabileceğini; sıfır veri saklamanın (ZDR) ayrı anlaşma istediğini söyler. Bu süreler metne yazılmalı mı? Süre yazılmadı. | KVKK m.10 aydınlatmanın doğruluğu. |
| Y1-4 | Eğitim: metinler, sağlayıcının verileri model eğitiminde kullanıp kullanmadığını söylemiyor. Ticari Hizmet Koşulları'nın B maddesine göre Anthropic, hizmetlerden gelen müşteri içeriğiyle model eğitemez; istisna, müşterinin kendisinin açtığı "Development Partner Mode" programıdır (Service-Specific Terms) ve kapalı kalmalıdır. Bu bir güvence olarak metne eklenmeli mi? | Söz verilmedi; karar avukatın. |
| Y1-5 | Altı belgedeki "aktarılır ve saklanmaz" cümleleri sağlayıcıyı adlandırmadığı için değişmedi: Güvenli Alışveriş (4491), Veri Saklama ve İmha Politikası (8036), Çerez Politikası (8640), Kullanım Şartları (9787), Mobil Uygulama Koşulları (11646), Kafe Hizmet Koşulları (14471). Bunlar da "şirketimizce saklanmaz" diye netleşmeli mi? | Sağlayıcı kendi koşullarına göre saklayabilir; yalın "saklanmaz" onun adına söz gibi okunabilir. |
| Y1-6 | KVKK Aydınlatma §14 aktarım tablosunda yapay zekâ hizmet sağlayıcısı satırı yok (alıcı §9, §12 ve §15'te anılıyor; eksik OpenAI döneminden kalma). Önerilen satır: anahtar "Yapay zekâ hizmet sağlayıcısı Anthropic, PBC (yalnızca açık rızanızla)"; değer "fA'L özelliğinde falın yapay zekâ ile yorumlanması. Aktarılan veri: küçültülmüş ve meta verileri arındırılmış içecek fotoğrafı ile üyelik seviyesi, ziyaret sıklığı ve varsa her zamanki içecek. İşleme şartı: açık rıza (KVKK m.5/1; Açık Rıza Metni R12). Yurt dışına aktarım: Kurul tarafından ilan edilen standart sözleşme (KVKK m.9/4-c)." Aktarım arızi olmadığından satır açık rızayı m.9 dayanağı olarak anmamalı (§15.1). | KVKK m.10 alıcı grupları. |
| Y1-7 | Daha önce rıza veren üyelere alıcının değiştiği ayrıca söylenmeli mi? Uygulama rızayı zaten yeniden soruyor; R12'ye "önceki sürümde alıcı OpenAI, L.L.C. idi" notu eklenebilir. Eklenmedi. | Şeffaflık. |
| Y1-8 | Rıza kaydı üye ve özellik başına tek satırdır: üye yeni metne "evet" deyince 23 Eyl rızasının kaydı (sürüm ve zaman) yenisiyle değişir. OpenAI yolu canlıda hiç açılmadıysa kaybolan bir ispat yoktur; açıldıysa eski kayıtlar ayrıca saklanmalı. Operatör kontrolü (salt okuma): `select count(*) from feature_consents where feature = 'fal-ai' and version = '2026-09-23';` ve `select count(*) from fal_readings where model like 'gpt-%';` | Rızanın ispatı veri sorumlusundadır. |
| Y1-9 | Rıza sayfasındaki dört satır uygulamanın kendi metnidir ve bugün fotoğrafın "OpenAI'ye (ABD)" gönderildiğini, "yorumdan sonra saklanmaz" olduğunu söyler. Uygulama `POST /fal/consent`'e `GET`'te aldığı sürümü yolladığı için bu eski sayfa, özellik açılınca `2026-10-17-anthropic` rızası kaydettirir. OpenAI diyen bir sürüm üyelere (mağaza, TestFlight, iç dağıtım) hiç verildi mi? Verildiyse §15.5 adım 4'teki sürüm kapısı yeterli mi? | Bilgilendirmeye dayanmayan rıza geçerli değildir (KVKK m.3); sunucu üyenin hangi metni gördüğünü bilemez. |
| Y1-10 | Ticari Elektronik İleti metnindeki (9513) "gerekli hâllerde açık rızanıza dayanılarak" ifadesi açık rızayı arızi aktarımla sınırlamıyor. Çerez Politikası (8723) ve düzeltilen Gizlilik §9 gibi yazılmalı mı? fA'L'dan bağımsız, bu PR'da değişmedi. | KVKK m.9/6. |

### 15.5 Açma sırası (operatör)

1. Avukat §15.3 cümlelerini ve §15.4 sorularını okur, onaylar.
2. Anthropic, PBC ile "Standart Sözleşme - 2" (veri sorumlusundan veri
   işleyene) Türkçe metniyle ve değiştirilmeden imzalanır; imzaların
   tamamlanmasından itibaren beş iş günü içinde Kurum'a bildirilir (Standart
   Sözleşme Bildirim Modülü ya da KEP; Y1-1). Bu adım olmadan özellik açılmaz:
   aktarım arızi olmadığı için R12 rızası bunun yerine geçmez (§15.1).
3. Panel kontrolü: `/admin/hukuk`'ta bu üç belgeden biri için yayımlanmış bir
   üzerine yazma varsa kodlanmış metni örter ve hâlâ OpenAI diyebilir; varsa
   kaldırılır ya da güncellenir.
4. Uygulama (`RiosenBeq/lafmobil`): rıza sayfasındaki satır ve gizlilik satırı
   (`src/i18n/screens/fal.ts`, bugün "OpenAI'ye (ABD) ... saklanmaz") Anthropic'i
   adlandıracak ve "saklanmaz" sözünü bizimle sınırlayacak biçimde ("L'Affogato'da
   saklanmaz") güncellenir; hukuki kopya yeniden üretilir
   (`npm run legal:export -- ../lafmobil/src/data/legal.seed.json`, sonra
   lafmobil'de `node scripts/legal-split.js`); `docs/API-MOBILE.md` kopyalanır. Sunucu üyenin
   hangi rıza metnini gördüğünü bilemez (Y1-9): OpenAI diyen bir sürüm üyelere
   hiç verildiyse `/admin/mobil/ayarlar`'da `minSupportedAppVersion`, Anthropic
   diyen ilk sürüme yükseltilmeden özellik açılmaz.
5. Açılış PR'ı `src/lib/mobile/fal-safeguard.ts`'e standart sözleşmenin imza günü,
   bildirim günü ve bildirim makbuzunu yazar (19 Eki 2026'dan beri kod kapısı: kayıt
   boşken aşağıdaki değişkenler özelliği açmaz, §15.6). Sonra Vercel production:
   `ANTHROPIC_API_KEY` (Sensitive) ve `FAL_AI_ENABLED=true` yeter; `FAL_AI_PROVIDER=anthropic` açıkça yazılabilir (boşken de Anthropic
   seçilir), `ANTHROPIC_FAL_MODEL` isteğe bağlı. Kullanılmayan bir
   `OPENAI_API_KEY` varsa silinir. Ardından yeniden deploy.
6. Kontrol: `GET /api/mobile/v1/bootstrap` yanıtında `app.fal.ai: true`;
   `GET /api/mobile/v1/fal/consent` yanıtında `fal-core.ts` `FAL_CONSENT_VERSION`
   (19 Eki 2026'dan beri `2026-10-19-anthropic`; açılış PR'ı onu kendi gününe taşır).
   Sonra e-postası doğrulanmış bir test üyesiyle uygulamadan bir gerçek yorum:
   sonuçta "Yapay zekâ ile yorumlandı" görünür ve Vercel kayıtlarında `[fal]`
   satırı yoktur. Bu kod Anthropic'e hiç gerçek çağrı yapılmadan yazıldı ve her
   başarısızlık sessizce cihaz falına düşer: `[fal] anthropic status 400`, `401`,
   `404` ya da `no reading` görülürse `FAL_AI_ENABLED` geri alınır.

### 15.6 Yurt dışına aktarım metinleri bugünkü duruma göre (19 Eki 2026)

> **Durum: metin ve kod değişti (dal `feat/legal-kvkk-transfers`).** Avukat turu
> yok: operatör kararı (18 Eki 2026) "avukata sorma, sen karar ver, araştır ve
> doğru olanı yap". Kararlar aşağıda dayanaklarıyla yazılı; §15.4'teki Y1-3,
> Y1-4, Y1-6 ve Y1-10 burada kapandı.

**Neden.** Site canlı ve altyapının tamamı yurt dışında: barındırma Vercel Inc.
(ABD; sunucu işlevleri Frankfurt, `vercel.json` `fra1`), veri tabanı Neon (Databricks,
Inc. / Neon, LLC; ABD; proje bölgesi `aws-us-east-2`, Ohio), üyelik girişi Supabase
Pte. Ltd. (Singapur; proje adresi AWS `ap-southeast-1` aralığında, 19 Eki 2026 DNS ve
`ip-ranges.json` ile doğrulandı), e-posta Resend (Plus Five Five, Inc.; ABD; gönderim
bölgesi `eu-west-1`, İrlanda). Kurul hiçbir ülke için yeterlilik kararı vermedi ve
bu sağlayıcıların hiçbiriyle Kurul'un standart sözleşmesi imzalı değil. Metinler
ise "standart sözleşme metni imzalanır ve ... Kurum'a bildirilir" diyor, R6'da yurt
dışına aktarım için bir rıza kalemi sunuyor ("onay vermezseniz hizmet yurt içi
imkânlarla yürütülür" - yurt içi bir seçenek yok), Google'ın etiket yöneticisini,
ölçümünü ve karaoke bildirimlerinin düştüğü Gmail kutusunu alıcı sayıyordu. Bu PR
metinleri bugünkü gerçeğe çeker, gerçeği de metinlere: Google aktarımları
sözleşmeyle değil kaldırılarak çözülür.

**Hukuki dayanak.**

- 6698 s. KVKK m.9/1 ve m.9/4 (7499 s. Kanun'la değişik, 1.6.2024): yeterlilik kararı
  yoksa aktarım, m.5/m.6 şartı **ve** m.9/4'teki uygun güvencelerden biriyle yapılır;
  bir şirket için bu, Kurul'un ilan ettiği standart sözleşmedir (m.9/4-c). m.9/4-a
  ("uluslararası sözleşme niteliğinde olmayan anlaşma") yalnız kamu kurumları
  arasındadır; Gizlilik §9 onu saymayı bıraktı. m.9/5: standart sözleşme imzaların
  tamamlanmasından itibaren beş iş günü içinde Kurum'a bildirilir.
- KVKK m.9/6-a: olası riskler anlatılarak alınan açık rıza, güvence
  sağlanamıyorsa ve aktarım **arızi** ise kullanılabilir. Kişisel Verilerin Yurt
  Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik (RG 10.07.2024,
  32598) m.16/1: düzenli olmayan, tek veya birkaç sefer gerçekleşen, süreklilik arz
  etmeyen ve olağan faaliyet akışı içinde bulunmayan aktarım arızidir. Barındırma,
  veri tabanı, giriş ve e-posta aktarımları her sayfa açılışında, girişte, siparişte
  ve e-postada tekrarlanır: arızi değildir, rıza bunları taşıyamaz. Bu yüzden R6 rıza
  kalemi kalktı (numarası not olarak durur, R7-R12 atıfları bozulmaz).
- Yönetmelik m.4/1-e ve Kurum'un Yurt Dışına Aktarım Rehberi (Ocak 2025) s.16:
  yurt dışındaki bir sağlayıcının bulutunda saklama ve oradan erişim de aktarımdır;
  kişisel bir Gmail kutusunda tutulan karaoke bildirimleri böyle bir aktarımdır.
- KVKK m.10/1-c ve Kurul İlke Kararı 18.02.2026, 2026/347 (RG 24.03.2026, 33203):
  aydınlatma, verinin kimlere ve hangi amaçla aktarılabileceğini söyler; metinler
  genel, eksik, yanıltıcı ya da yanlış olamaz (örnek: olmayan bir yurt dışı aktarımı
  anlatmak); başka bir işleme şartı varken rıza metni sunulmaz. Bu yüzden her alıcı
  şirketi, ülkesi, sunucu yeri ve imza durumuyla yazılır; artık yapılmayan aktarımlar
  (Google etiketleri, Gmail kutusu) metinlerden çıkar; "dayandırılır" yerine, imza
  bitene kadar "dayandırılacaktır" yazılır.
- Kurum'un "Yurt Dışına Aktarım" sayfası (kvkk.gov.tr/Icerik/2053, 18.10.2026):
  "Yeterli korumanın bulunduğu ülkeler" başlığı altında "Bu konuda Kurul tarafından
  henüz bir belirleme yapılmamıştır."
- Google: Google Ads Data Processing Terms (v8.0) Türk hukuku, Türk standart sözleşmesi
  ya da KVKK maddesi içermez; Türk standart sözleşmeleri yalnız Google Cloud veri
  işleme ekinde (Cloud ve Workspace, Türkiye'de faturalanan müşteriler) vardır, Tag
  Manager ve Analytics'i kapsamaz. Karar (OP-SS2-PROVIDERS): Google sözleşmeyle değil
  çıkarılarak çözülür; etiketler bir Google standart sözleşmesi imzalanıp bildirilene
  kadar kapalı.
- fA'L (ASK-FAL-1, OP-FAL-OFF): fotoğrafın işlenme şartı açık rızadır (m.5/1); aktarım
  her yorumda tekrarlandığından arızi değildir ve ayrıca standart sözleşme ister
  (m.9/4-c). Kanun aktarımın imzayla başlamasına izin verir (Rehber s.57); biz daha
  katı olanı seçtik: bildirim makbuzu alınmadan fotoğraf gönderilmez; bu, bildirimsiz
  aktarım riskini (m.18/1-d; 2026 için 90.308 - 1.806.177 TL) de kapatır.
  Anthropic'in ticari saklama politikası (privacy.claude.com, makale 7996866):
  API girdi ve çıktıları 30 gün içinde silinir; güvenlik sistemlerince işaretlenen
  içerik 2 yıla, sınıflandırma puanları 7 yıla kadar tutulur; Ticari Hizmet Koşulları
  §B: Anthropic müşteri içeriğiyle model eğitemez. Sıfır veri saklama anlaşması yok;
  metin 30 günü yazar.

**Kararlar.**

| Karar | Ne yapıldı |
| --- | --- |
| ASK-O-4 | KVKK Aydınlatma §15 ve Gizlilik §9: aktarımlar standart sözleşmeye "dayandırılacaktır", imza süreci sürüyor, her sözleşme beş iş günü içinde bildirilir ve tarihiyle §15'e yazılır; bu sürekli aktarımlar rızaya dayandırılmaz; tek seferlik arızi bir aktarım yalnız m.9/6'daki hâllerde ve riskler anlatılarak. Alıcılar satırı her sağlayıcıyı şirketi, ülkesi, sunucu yeri ve "imza sürecinde" ile anar. Güvence yöntemi tek: standart sözleşme. R6 rıza kalemi kalktı, numarası "rıza istenmez" notu olarak durur. |
| ASK-FAL-1 | R12: Anthropic'in 30 gün, 2 yıl, 7 yıl saklama ve eğitim yasağı cümleleri; "yalnızca bu onaya dayanmaz: onayınız aktarımın işleme şartıdır"; "Anthropic, PBC ile imzalanacak ve" (imza yok, "akdedilen" yanlıştı); "Bu sözleşme imzalanıp Kurum'a bildirilmeden fotoğrafınız yapay zekâ hizmetine gönderilmez." KVKK Aydınlatma §8 ve §6'daki "aktarım yalnızca açık rızanıza dayanır" cümlesi düzeldi; §14'e Anthropic satırı girdi (Y1-6). R12 kaydı: onay, fotoğraf gönderilmeden önce açılan ayrı pencereden verilir, pencere özetler ve metnin tamamına bağlanır, "hayır" aynı kolaylıktadır; uygulama sürümü kaydedilmez. Metin "Bilgilendirmeyi okudum, anladım." kutusunu vaat etmez: `POST /fal/consent` yalnız `{ version }` alır ve sahadaki uygulamada kutu yok; kutu uygulama PR'ında gelir, metin onsuz da doğru kalır (`tests/legal-fal-recipient.test.ts`). Rıza sürümü `2026-10-19-anthropic`; 17 Eki rızaları sayılmaz, uygulama yeniden sorar. |
| OP-FAL-OFF | Kod kapısı: `src/lib/mobile/fal-safeguard.ts` (imza günü, bildirim günü, makbuz) boşken `falAiEnabled` ve fotoğrafı gönderen tek fonksiyon `readCupWithAI` ortam ne derse desin kapalı (`tests/mobile-fal-safeguard.test.ts`). |
| OP-SS2-PROVIDERS | Google etiketleri kapalı: `layout.tsx`'teki `GTM-KZ2QCHTT` varsayılanı gitti; `src/lib/legal/meta.ts` `GOOGLE_TAGS_IN_LEGAL_TEXTS = false` iken `NEXT_PUBLIC_GTM_ID` dolu olsa da GTM yüklenmez; çerez bandı yalnız zorunlu ve tercih çerezlerini sorar, gösterilmeyen kategoriye "evet" yazılmaz (`tests/site-tags-off.test.ts`). Metinler "İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz" der; R5 "bugün veri işlenmediğinden rıza istenmez" notu oldu. Harita gömmesi `system-site-settings` PR'ında bağlantıya döner; o güne kadar §15 onu "Google LLC (ABD; standart sözleşme bulunmadığından kaldırılacaktır)" diye anar (`tests/legal-kvkk-transfers.test.ts` gömme kalkınca cümlenin de kalkmasını ister). |
| OP-SS2-MAP-LINK | Harita gömmesi kalktı (paket 7d): "Haritayı göster" Google Haritalar'ı yeni sekmede açan bir bağlantı, sayfada çerçeve yok. Gizlilik §9, KVKK Aydınlatma §14 ve §15 (gerekçe, alıcı, giriş paragrafı) ve Çerez Politikası (gömülü içerik paragrafı, Google Haritalar satırı, yurt dışı paragrafı) haritayı aktarım olarak saymaz; bağlantıyla Google'a tarafımızca veri aktarılmadığını yazar (KVKK m.9, 2026/347: olmayan aktarım listelenmez). Belgelerin günü zaten 19 Ekim 2026; `LEGAL_UPDATED` değişmedi (`tests/legal-kvkk-transfers.test.ts`). |
| OP-KARAOKE-MAILBOX | `20261019160000_karaoke_notify_company_mailbox.sql` Gmail adresini bir kez temizler (bildirim genel iletişim adresine, şirketin Türkiye'deki kutusuna düşer); 26 Eyl migration'ı artık bir kez çalışır (paket her yeni migration'da baştan uygulanınca adresi ve saatlik ücreti geri yazıyordu); seed boş; KVKK §14 satırı kurumsal kutu (Türkiye) der. Ekip e-postaları da (yeni sipariş, hesap silme talebi) kişisel bir kutuya gitmez: `resolveStaffRecipients` Gmail, Hotmail, iCloud gibi alan adlarını her kaynaktan (env yöneticisi, panel hesabı, ek adres, operasyon adresi) atlar, Ayarlar → Bildirimler onları kaydetmez, `.env.example` Gmail adresini bırakır (`tests/staff-notice-consumer-mailbox.test.ts`). |
| OP-REGIONS | Neon bölgesi `aws-us-east-2` (Ohio, ABD; 18 Eki 2026'da Neon projesinden okundu), Supabase Singapur (DNS + AWS aralığı, 19 Eki 2026), Vercel Frankfurt (`vercel.json`), Resend İrlanda (`docs/EMAIL-RESEND.md`). Şirket ve bölge `entity.ts`'te `dbRecipient` ve `authRecipient` (token `{{DB_RECIPIENT}}`, `{{AUTH_RECIPIENT}}`); sağlayıcı adıyla aynı anda değişir ve boş olamaz, çünkü boş token alıcılar satırının tamamını düşürür (`tests/legal-kvkk-transfers.test.ts`). |

**Sürüm ve tarih.** Altı belge kendi gününü taşır: Gizlilik Politikası, KVKK
Aydınlatma Metni, Açık Rıza Metni, Kişisel Veri Saklama ve İmha Politikası, Çerez
Politikası, Ticari Elektronik İleti ve İYS Aydınlatması "Son güncelleme: 19 Ekim
2026". `LEGAL_UPDATED` (ödeme onayının kaydettiği sürüm) ve `KARAOKE_LEGAL_UPDATED`
değişmedi; ödeme belgeleri değişmedi. R12 rıza sürümü `2026-10-19-anthropic`
(`FAL_CONSENT_TEXT_DAY`). PR başka bir İstanbul gününde birleşirse bu altı tarih ve
`FAL_CONSENT_TEXT_DAY` birleşme gününe taşınır; o gün `LEGAL_UPDATED` daha ileri bir
güne taşınmışsa belgeler kendi tarihini bırakır (`tests/legal-dates.test.ts`).

**Değişen cümleler.** Eski metin `dec7f05`'teki hâlidir. Alıcılar satırındaki iki yeni
token `entity.ts`'ten dolar: `{{DB_RECIPIENT}}` = "Databricks, Inc. / Neon, LLC; ABD;
sunucu bölgesi ABD, Ohio", `{{AUTH_RECIPIENT}}` = "Supabase Pte. Ltd.; Singapur; proje
bölgesi Singapur" (`dbProvider` ve `authProvider` ile birlikte değişir, boş olamaz).

| Belge | Eski | Yeni |
| --- | --- | --- |
| Gizlilik Politikası | ; web sitesinde analitik çerezlere izin vermeniz hâlinde sayfa görüntüleme ve gezinme yolu gibi kullanım istatistikleri. | ; internet sitemizde bugün analitik etiket kullanılmadığından sayfa görüntüleme ve gezinme yolu gibi kullanım istatistikleri toplanmaz. |
| Gizlilik Politikası | Zorunlu oturum ve sepet çerezleri, tercih çerezleri, izne bağlı analitik ve pazarlama çerezleri; | Zorunlu oturum ve sepet çerezleri ile izne bağlı tercih çerezleri (internet sitemizde bugün analitik veya pazarlama çerezi kullanılmaz); |
| Gizlilik Politikası | Çerezler ve benzeri teknolojiler: Web sitesinde zorunlu çerezler ile açık rızanıza bağlı analitik ve pazarlama çerezleri, piksel ve yerel depolama teknolojileri; | Çerezler ve benzeri teknolojiler: Web sitesinde zorunlu çerezler, açık rızanıza bağlı tercih çerezleri ve yerel depolama (internet sitemizde bugün analitik veya reklam etiketi kullanılmaz; analitik ve pazarlama çerezleri ile piksel yerleştirilmez); |
| Gizlilik Politikası | Web sitesinde analitik ve pazarlama amaçlı çerezler ile benzer izleme teknolojilerinin kullanılması; mobil uygulamada ölçümleme kiti ve reklam tanımlayıcısı kullanılmaz. | Web sitesinde tercih çerezlerinin kullanılması. İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz; analitik ve pazarlama çerezleri için bugün veri işlenmediğinden rıza istenmez. Mobil uygulamada ölçümleme kiti ve reklam tanımlayıcısı kullanılmaz. |
| Gizlilik Politikası | Açık rızanıza bağlı olarak web sitesi kullanımının istatistiksel ölçümü; mümkün olan hâllerde IP kısaltma ve takma adlaştırma uygulanır. Web sitesi etiketlerini Google Etiket Yöneticisi (GTM) ile yönetir; GTM betiği sayfa yüklenirken çalışır ve bu sırada IP adresiniz ve tarayıcı bilgileriniz Google'a ulaşır. Onay modu gereği, çerez izin panelinde bir seçim yapana kadar analitik ve pazarlama amaçlı tüm sinyaller 'reddedildi' olarak ayarlanır. Mobil uygulamada analitik veya çökme raporlama hizmeti kullanılmaz. | İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz: Google Etiket Yöneticisi (GTM), Google Analytics ve reklam etiketleri yüklenmez ve bu amaçla hiçbir sağlayıcıya veri aktarılmaz. Bu hizmetler ileride kullanılmak istenirse önce bu Politika ve Çerez Politikası güncellenir; analitik ve pazarlama çerezleri yalnızca çerez panelinde vereceğiniz açık rızayla çalışır. Mobil uygulamada analitik veya çökme raporlama hizmeti kullanılmaz. |
| Gizlilik Politikası | Şirketin kullandığı bulut barındırma, veri tabanı, kimlik doğrulama (üyelik girişi), e-posta gönderim ve analitik hizmetlerinin bir kısmı yurt dışında yerleşik sağlayıcılar tarafından sunulmakta olup, bu kapsamda kişisel verileriniz yurt dışında bulunan sunuculara aktarılabilmekte veya buralardan erişilebilmektedir. | Şirketin kullandığı bulut barındırma, veri tabanı, kimlik doğrulama (üyelik girişi) ve e-posta gönderim hizmetleri yurt dışında yerleşik sağlayıcılar tarafından sunulmaktadır; bu nedenle kişisel verileriniz yurt dışında bulunan sunuculara aktarılmakta ve buralardan erişilebilmektedir. Ziyaret sayfasındaki haritayı göstermeyi seçmeniz hâlinde tarayıcınız Google'a bağlanır. İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz. Her sağlayıcının adı, ülkesi ve standart sözleşmenin durumu KVKK Aydınlatma Metni'nin 15. bölümünde yazılıdır. |
| Gizlilik Politikası | Yurt dışına aktarım, KVKK'nın kişisel verilerin yurt dışına aktarılmasını düzenleyen 9. maddesi çerçevesinde gerçekleştirilir. Aktarım, öncelikle Kurul tarafından yeterli korumaya sahip olduğu ilan edilen ülkelere; bunun bulunmadığı hâllerde ise mevzuatta öngörülen uygun güvencelerden birine (standart sözleşme, bağlayıcı şirket kuralları, taahhütname veya uluslararası sözleşme) dayanılarak yapılır. Bu güvencelerin sağlanamadığı istisnai durumlarda aktarım, yalnızca arızi nitelikte olması kaydıyla, mevzuatta sayılan hâllerden birine, örneğin aktarımın olası riskleri hakkında bilgilendirildikten sonra ayrıca vereceğiniz açık rızaya dayanabilir. | Aktarım yapılan ülkelerin hiçbiri hakkında Kurul'un verdiği bir yeterlilik kararı yoktur; bu nedenle aktarımlar KVKK'nın 9. maddesinin dördüncü fıkrası uyarınca Kurul tarafından ilan edilen standart sözleşmeye (veri sorumlusundan veri işleyene) dayandırılacaktır. Bu sözleşmeleri sağlayıcılarla imzalama sürecimiz devam etmektedir; hangi sağlayıcıyla imzalandığı ve Kurum'a bildirildiği KVKK Aydınlatma Metni'nin 15. bölümünde yazılır. Bu aktarımlar süreklilik taşıdığından açık rızanıza dayandırılmaz; tek seferlik bir aktarım gerekirse, yalnızca arızi nitelikte olması kaydıyla ve olası riskler size ayrıca anlatılarak, o aktarımdan önce ayrı bir onay istenir. |
| Gizlilik Politikası | Platformda; oturumun sürdürülmesi, sepetin korunması, güvenlik ve temel işlevlerin sağlanması için zorunlu çerezler ile açık rızanıza bağlı olarak tercih, analitik ve pazarlama çerezleri kullanılır. Zorunlu çerezler, hizmetin sunulabilmesi için teknik olarak gerekli olduğundan rızaya tabi değildir; diğer çerez kategorileri için onay modu (Google Consent Mode v2) kullanılır: web sitesi etiketlerini Google Etiket Yöneticisi (GTM) ile yönetir, GTM betiği sayfa yüklenirken çalışır ve tercih, analitik ve pazarlama amaçlı depolama izinleri siz çerez izin panelinden onay verene kadar 'reddedildi' olarak başlar; bu kategoriler yalnızca onay vermeniz hâlinde etkinleşir. | Platformda; oturumun sürdürülmesi, sepetin korunması, güvenlik ve temel işlevlerin sağlanması için zorunlu çerezler ile açık rızanıza bağlı olarak tercih çerezleri kullanılır. Zorunlu çerezler, hizmetin sunulabilmesi için teknik olarak gerekli olduğundan rızaya tabi değildir; tercih çerezleri yalnızca çerez panelinden onay vermeniz hâlinde etkinleşir. İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz: Google Etiket Yöneticisi (GTM) yüklenmez, analitik ve pazarlama çerezleri yerleştirilmez ve çerez paneli bu kategorileri sormaz. |
| KVKK Aydınlatma Metni | Yurt Dışına Kişisel Veri Aktarımı Hakkında Yönetmelik | Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik (RG: 10.07.2024, 32598) |
| KVKK Aydınlatma Metni | adresindeki fiziki işletmeye gelen, karaoke odası rezervasyonu yapan | adresindeki fiziki işletmeye gelen, internet sitesi veya mobil uygulama üzerinden, üye olarak ya da üye olmadan karaoke odası rezervasyonu yapan |
| KVKK Aydınlatma Metni | fotoğraf cihazınızda kaldığı sürece tarafımızca işlenmez, fA'L yapay zekâ yorumu için aktarım yalnızca açık rızanıza (KVKK m.5/1, Açık Rıza Metni R12) dayanır. | fotoğraf cihazınızda kaldığı sürece tarafımızca işlenmez; fA'L yapay zekâ yorumu için fotoğrafın işlenmesi ve aktarılması açık rızanıza (KVKK m.5/1, Açık Rıza Metni R12) dayanır; yurt dışına aktarımda ayrıca Kurul tarafından ilan edilen standart sözleşme uygulanır. |
| KVKK Aydınlatma Metni | İsteğe bağlı analitik ve performans çerezleri / KVKK m.5/1: İlgili kişinin açık rızası (çerez tercih paneli üzerinden alınır ve her zaman geri alınabilir) | İsteğe bağlı tercih çerezleri / KVKK m.5/1: İlgili kişinin açık rızası (çerez tercih paneli üzerinden alınır ve her zaman geri alınabilir). İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz; analitik, performans ve pazarlama çerezleri için bugün veri işlenmediğinden rıza istenmez. |
| KVKK Aydınlatma Metni | fA'L fotoğrafı cihazınızda kaldığı sürece tarafımızca işlenmez; yapay zekâ yorumu için aktarım KVKK m.5/1 ve m.9 kapsamındaki açık rızanıza (Açık Rıza Metni R12) dayanır. | fA'L fotoğrafı cihazınızda kaldığı sürece tarafımızca işlenmez; yapay zekâ yorumu için fotoğrafın işlenmesi ve yurt dışına aktarılması KVKK m.5/1 uyarınca açık rızanıza (Açık Rıza Metni R12) dayanır; yurt dışına aktarım ayrıca Kanun'un 9. maddesinin dördüncü fıkrası uyarınca Kurul tarafından ilan edilen standart sözleşmeye dayandırılır. |
| KVKK Aydınlatma Metni | Zorunlu olmayan analitik, performans ve tercih çerezleri ile benzeri teknolojilerin kullanılması. | Zorunlu olmayan tercih çerezlerinin kullanılması. İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz; analitik, performans ve pazarlama çerezleri için bugün veri işlenmediğinden rıza istenmez. |
| KVKK Aydınlatma Metni | Çerezler ve benzeri teknolojiler: Tarayıcınıza yerleştirilen çerezler, yerel depolama (sepetin cihazınızda tutulması dahil) ve piksel/etiket teknolojileri. | Çerezler ve benzeri teknolojiler: Tarayıcınıza yerleştirilen çerezler ve yerel depolama (sepetin cihazınızda tutulması dahil). İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz; piksel veya ölçümleme etiketi yüklenmez. |
| KVKK Aydınlatma Metni | Çerezler işlevlerine göre ayrıştırılır ve zorunlu olmayan çerezler yalnızca açık rızanızla çalıştırılır. | Çerezler işlevlerine göre ayrıştırılır ve zorunlu olmayan çerezler yalnızca açık rızanızla çalıştırılır. İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz; bu nedenle aşağıdaki analitik/performans ve pazarlama çerezleri yerleştirilmez ve çerez tercih paneli bu kategorileri sormaz. |
| KVKK Aydınlatma Metni | Analitik/performans çerezleri: Sayfa görüntüleme, gezinme akışı ve hata oranlarının ölçülmesini sağlar; mümkün olduğunca toplulaştırılmış biçimde kullanılır. Açık rızaya tabidir. | Analitik/performans çerezleri: Sayfa görüntüleme, gezinme akışı ve hata oranlarının ölçülmesini sağlar; mümkün olduğunca toplulaştırılmış biçimde kullanılır. Açık rızaya tabidir. Bugün kullanılmaz. |
| KVKK Aydınlatma Metni | Pazarlama çerezleri: Kampanya etkinliğinin ölçülmesi ve ilgi alanına göre içerik sunulması amacıyla kullanılabilir. Yalnızca açık rızanızla çalıştırılır; rıza verilmediğinde yerleştirilmez. | Pazarlama çerezleri: Kampanya etkinliğinin ölçülmesi ve ilgi alanına göre içerik sunulması amacıyla kullanılabilir. Yalnızca açık rızanızla çalıştırılır; rıza verilmediğinde yerleştirilmez. Bugün kullanılmaz. |
| KVKK Aydınlatma Metni | Üyelik kimlik doğrulama hizmeti sağlayıcısı | Üyelik kimlik doğrulama hizmeti sağlayıcısı ({{AUTH_PROVIDER}}) |
| KVKK Aydınlatma Metni, §14 aktarım tablosu | (yok; açık madde Y1-6) | Yeni satır "Yapay zekâ hizmet sağlayıcısı Anthropic, PBC (ABD, yalnızca açık rızanızla)": "fA'L özelliğinde falın yapay zekâ ile yorumlanması. Aktarılan veri: küçültülmüş ve meta verileri arındırılmış içecek fotoğrafı ile üyelik seviyesi, yaklaşık ziyaret sıklığı ve varsa her zamanki içecek; ad, e-posta, telefon ve üye numarası aktarılmaz. Hukuki sebep: KVKK m.5/1 açık rıza (Açık Rıza Metni R12). Yurt dışına aktarım: Kurul tarafından ilan edilen standart sözleşme (KVKK m.9/4-c); sözleşme imzalanıp Kurum'a bildirilmeden fotoğraf gönderilmez." |
| KVKK Aydınlatma Metni, §14 aktarım tablosu | Muhasebe ve mali müşavirlik hizmeti sağlayıcıları ile kullanılması hâlinde elektronik fatura hizmet sağlayıcıları / Fatura ve fiş düzenlenmesi, defter ve beyan süreçleri. Hukuki sebep: KVKK m.5/2-a ve m.5/2-ç (213 sayılı Vergi Usul Kanunu, 6102 sayılı Türk Ticaret Kanunu). | Elektronik fatura hizmet sağlayıcısı Paraşüt (Paraşüt Yazılım Teknolojileri A.Ş., Türkiye) ile muhasebe ve mali müşavirlik hizmeti sağlayıcıları / Faturanın (e-Arşiv fatura veya e-fatura) Paraşüt üzerinden düzenlenmesi, fiş düzenlenmesi, defter ve beyan süreçleri. Paraşüt bu verileri veri işleyen sıfatıyla, yalnızca faturanın düzenlenmesi ve saklanması için işler. Aktarılan veri: faturadaki ad-soyad veya ticaret unvanı, fatura adresi, kurumsal faturada vergi dairesi ve vergi kimlik numarası, faturanın iletildiği e-posta adresi, satın alınan ürün veya hizmet, tutar ve KDV. Hukuki sebep: KVKK m.5/2-a ve m.5/2-ç (213 sayılı Vergi Usul Kanunu, 6102 sayılı Türk Ticaret Kanunu). |
| Gizlilik Politikası, §8 aktarım tablosu | Muhasebe, mali müşavirlik ve bağımsız denetim hizmeti sağlayıcıları / Fatura, defter ve mali kayıtların düzenlenmesi ile yasal beyanların hazırlanması. | Elektronik fatura hizmet sağlayıcısı Paraşüt (Paraşüt Yazılım Teknolojileri A.Ş., Türkiye) ile muhasebe, mali müşavirlik ve bağımsız denetim hizmeti sağlayıcıları / Faturanın (e-Arşiv fatura veya e-fatura) Paraşüt üzerinden düzenlenmesi, defter ve mali kayıtların düzenlenmesi ile yasal beyanların hazırlanması. Paraşüt bu verileri veri işleyen sıfatıyla işler; ayrıntı KVKK Aydınlatma Metni'nin 14. ve 15. bölümlerindedir. |
| KVKK Aydınlatma Metni | Karaoke rezervasyon bildirimlerinin ulaştığı ekip e-posta kutusunun e-posta hizmeti sağlayıcısı | Karaoke rezervasyon bildirimlerinin ulaştığı kurumsal e-posta kutusunun barındırma hizmeti sağlayıcısı (Türkiye) |
| KVKK Aydınlatma Metni | Bu bildirimler şu anda Google'ın e-posta hizmetinde (Gmail) tutulan bir e-posta kutusuna iletilmektedir. | Bildirim e-postası Resend üzerinden gönderilir ve şirketimizin Türkiye'de barındırılan kurumsal e-posta kutusunda tutulur. |
| KVKK Aydınlatma Metni | Google (etiket yönetimi, analitik ölçüm ve harita hizmetleri) / İnternet sitesinin etiket yönetimi altyapısı (Google Tag Manager) her sayfa görüntülemesinde yüklenir ve bu sırada IP adresiniz ile tarayıcı bilginiz Google'a ulaşır. Analitik ölçüm etiketleri yalnızca çerez tercih panelinde analitik çerezlere izin vermeniz hâlinde, harita (Google Haritalar) yalnızca ziyaret sayfasında 'Haritayı göster' seçeneğini kullandığınızda çalışır. Hukuki sebep: etiket yönetimi bakımından KVKK m.5/2-f meşru menfaat; analitik ölçüm bakımından KVKK m.5/1 açık rıza; haritanın gösterilmesi bakımından talebiniz üzerine hizmetin sunulması (KVKK m.5/2-c). | Google LLC (harita hizmeti) / İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz: Google Etiket Yöneticisi (Google Tag Manager) ve Google Analytics yüklenmez. Ziyaret sayfasındaki harita (Google Haritalar) yalnızca 'Haritayı göster' seçeneğini kullandığınızda yüklenir; bu sırada IP adresiniz ve tarayıcı bilginiz Google'a ulaşır. Hukuki sebep: talebiniz üzerine hizmetin sunulması (KVKK m.5/2-c). Google ile standart sözleşme bulunmadığından bu gömülü harita kaldırılacak, yerine Google Haritalar'a bağlantı verilecektir. |
| KVKK Aydınlatma Metni | Açık rızanız bu işlemenin şartıdır; aktarım ise her yorum isteğinde tekrarlandığından arızi nitelikte değildir, bu nedenle yalnızca açık rızaya dayanmaz ve Kanun'un 9. maddesindeki uygun güvencelerden Kurul tarafından ilan edilen standart sözleşmeye dayandırılır. | Açık rızanız bu işlemenin şartıdır; aktarım ise her yorum isteğinde tekrarlandığından arızi nitelikte değildir, bu nedenle yalnızca açık rızaya dayanmaz ve Kanun'un 9. maddesindeki uygun güvencelerden Kurul tarafından ilan edilen standart sözleşmeye dayandırılır. Bu sözleşme Anthropic, PBC ile imzalanıp Kurum'a bildirilmeden fotoğrafınız yapay zekâ hizmetine gönderilmez. |
| KVKK Aydınlatma Metni | Hizmet altyapımızın bir kısmı (uygulama barındırma, PostgreSQL veri tabanı, üyelik kimlik doğrulaması, e-posta gönderimi ve karaoke rezervasyon bildirimlerinin ulaştığı ekip e-posta kutusu, mobil uygulama mağaza dağıtımı, internet sitesinin etiket yönetimi, izninize bağlı analitik ölçüm ve talebinize bağlı harita gösterimi ile içerik dağıtım ağı) yurt dışında yerleşik hizmet sağlayıcılar tarafından sunulmaktadır. Uygulama barındırma hizmetinin sunucu işlevleri Almanya'da (Frankfurt), e-posta gönderim hizmeti İrlanda'daki bölgede çalışır. Bu nedenle kişisel verileriniz, teknik olarak yurt dışındaki sunucularda işlenebilir veya yurt dışına aktarılabilir. | Hizmet altyapımızın bir kısmı (uygulama barındırma ve içerik dağıtım ağı, PostgreSQL veri tabanı, üyelik kimlik doğrulaması, e-posta gönderimi ile talebinize bağlı harita gösterimi) yurt dışında yerleşik hizmet sağlayıcılar tarafından sunulmaktadır. Uygulama barındırma hizmetinin sunucu işlevleri Almanya'da (Frankfurt), e-posta gönderim hizmeti İrlanda'daki bölgede çalışır; veri tabanının ve üyelik girişinin sunucu bölgeleri aşağıdaki alıcılar satırında yazılıdır. Bu nedenle kişisel verileriniz yurt dışındaki sunucularda işlenir ve yurt dışına aktarılır. Uygulama mağazaları (App Store ve Google Play) uygulamayı mağaza hesabınız kapsamında kendi adlarına dağıtır; bu kanalla tarafımızca kişisel veri aktarılmaz (14. bölüm). İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz. |
| KVKK Aydınlatma Metni | Yurt dışına aktarım, Kanun'un 9. maddesinde ve Yurt Dışına Kişisel Veri Aktarımı Hakkında Yönetmelik'te öngörülen sıralı mekanizmalara uygun olarak yapılır. Öncelikle aktarımın yapılacağı ülke, sektör veya uluslararası kuruluş hakkında Kurul tarafından verilmiş bir yeterlilik kararı bulunup bulunmadığı değerlendirilir. Yeterlilik kararının bulunmadığı hâllerde, aktarım Kanun'da sayılan uygun güvencelerden birinin sağlanması koşuluyla gerçekleştirilir. | Kanun'un 9. maddesi ve Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik yurt dışına aktarımı sıralı mekanizmalara bağlar. Öncelikle aktarımın yapılacağı ülke, sektör veya uluslararası kuruluş hakkında Kurul tarafından verilmiş bir yeterlilik kararı bulunup bulunmadığına bakılır. Yeterlilik kararının bulunmadığı hâllerde aktarım, Kanun'da sayılan uygun güvencelerden birinin sağlanmasını gerektirir. |
| KVKK Aydınlatma Metni | Uygun güvenceler kapsamında, Kurul tarafından ilan edilen standart sözleşme metni imzalanır ve söz konusu sözleşme, mevzuatta öngörülen süre içinde Kuruma bildirilir; şirketler topluluğu bakımından bağlayıcı şirket kuralları veya yazılı taahhütname yolları da mevzuatın izin verdiği ölçüde kullanılabilir. Yeterlilik kararı ve uygun güvencelerin bulunmadığı hâllerde aktarım, yalnızca Kanun'un 9. maddesinde sayılan arızi hâllerin varlığı hâlinde ve bu hâllerle sınırlı olarak yapılır; bu kapsamda açık rızaya dayalı aktarım, ilgili kişinin aktarımın olası risklerine ilişkin ayrıca bilgilendirilmesi üzerine alınan açık rızaya dayanır. | Aktarım yapılan ülkelerin hiçbiri hakkında Kurul'un verdiği bir yeterlilik kararı bulunmadığından, bu aktarımlar Kanun'un 9. maddesinin dördüncü fıkrası uyarınca Kurul tarafından ilan edilen standart sözleşmeye (veri sorumlusundan veri işleyene) dayandırılacaktır. Bu sözleşmeleri aşağıda sayılan sağlayıcılarla imzalama sürecimiz devam etmektedir; her sözleşme imzaların tamamlanmasından itibaren beş iş günü içinde Kurum'a bildirilir ve hangi sağlayıcıyla hangi tarihte imzalandığı bu bölümde yazılır. Bu aktarımlar her sayfa açılışında, girişte, siparişte ve e-postada tekrarlandığından arızi değildir ve açık rızanıza dayandırılmaz. Tek seferlik, arızi bir aktarım gerekirse yalnızca Kanun'un 9. maddesinin altıncı fıkrasındaki hâllerde ve açık rızaya dayanacaksa olası riskler size ayrıca anlatılarak yapılır. |
| KVKK Aydınlatma Metni | mobil uygulama mağaza dağıtımı, internet sitesinde etiket yönetimi, izninize bağlı analitik ölçüm ve talebinize bağlı harita gösterimi, sunucu tarafında hata ve performans izleme. | Aktarım gerekçeleri: Uygulama barındırma ve dağıtımı (içerik dağıtım ağı ile sunucu tarafındaki hata ve performans kayıtları dâhil), PostgreSQL veri tabanı hizmeti ve yedekleme, üyelik kimlik doğrulaması, e-posta gönderimi ile kesinleşen karaoke rezervasyonlarının ve ödeme uyarılarının ekibimize bildirilmesi, talebinize bağlı harita gösterimi. |
| KVKK Aydınlatma Metni | Alıcılar ve bilinen konumlar: uygulama barındırma Vercel (sunucu işlevleri Almanya, Frankfurt); e-posta gönderimi Resend (gönderim bölgesi İrlanda); etiket yönetimi, izninize bağlı analitik ölçüm, talebinize bağlı harita gösterimi ve karaoke rezervasyon bildirimlerinin ulaştığı ekip e-posta kutusu Google; PostgreSQL veri tabanı {{DB_PROVIDER}}; üyelik kimlik doğrulaması için kimlik doğrulama hizmeti sağlayıcısı; fA'L yapay zekâ yorumu için yalnızca açık rızanızla Anthropic, PBC (ABD). | Alıcılar ve bilinen konumlar (standart sözleşmenin durumu her alıcının yanında yazılıdır): uygulama barındırma, içerik dağıtım ağı ve sunucu hata ve performans kayıtları Vercel Inc. (ABD; sunucu işlevleri Almanya, Frankfurt; imza sürecinde); e-posta gönderimi Resend (Plus Five Five, Inc.; ABD; gönderim bölgesi İrlanda; imza sürecinde); PostgreSQL veri tabanı {{DB_PROVIDER}} ({{DB_RECIPIENT}}; imza sürecinde); üyelik kimlik doğrulaması {{AUTH_PROVIDER}} ({{AUTH_RECIPIENT}}; imza sürecinde); fatura düzenlenmesi Paraşüt Yazılım Teknolojileri A.Ş. (Türkiye; veriler ona yurt içinde aktarılır; Paraşüt kendi altyapı tedarikçilerinin yurt içinde veya yurt dışında bulunabileceğini bildirdiğinden, fatura verisinin hangi ülkede barındırıldığı Paraşüt'ün yazılı beyanıyla bu satıra yazılacaktır); talebinize bağlı harita gösterimi Google LLC (ABD; standart sözleşme bulunmadığından kaldırılacaktır); fA'L yapay zekâ yorumu için yalnızca açık rızanızla ve standart sözleşme imzalanıp Kurum'a bildirildikten sonra Anthropic, PBC (ABD). |
| KVKK Aydınlatma Metni | internet sitesi ziyaretlerinde IP adresi, tarayıcı bilgisi ve izninize bağlı olarak kullanım verisi. | internet sitesi ziyaretlerinde IP adresi ve tarayıcı bilgisi. |
| KVKK Aydınlatma Metni | Güvence yöntemleri: Kurul yeterlilik kararı; yoksa standart sözleşme, bağlayıcı şirket kuralları veya taahhütname; bunların da bulunmadığı hâllerde Kanun'da sayılan arızi hâller. | Güvence yöntemi: Kurul tarafından ilan edilen standart sözleşme (veri sorumlusundan veri işleyene); her sağlayıcı için imza ve bildirim durumu yukarıdaki alıcılar satırında yazılıdır. Bu aktarımlar için bağlayıcı şirket kuralları, taahhütname veya açık rıza kullanılmaz. |
| Açık Rıza Metni | ticari elektronik ileti (kampanya e-postaları ve bülten), internet sitesinde pazarlama çerezleri, yurt dışına aktarım, görsel içerikte yer alma ve fA'L yapay zekâ yorumu gibi | ticari elektronik ileti (kampanya e-postaları ve bülten), görsel içerikte yer alma ve fA'L yapay zekâ yorumu gibi |
| Açık Rıza Metni | kayıt formundaki veya hesap ayarlarındaki kutucuk, çerez panelindeki seçenek, fA'L ekranındaki onay ya da kafede alınan yazılı beyan. | kayıt formundaki veya hesap ayarlarındaki kutucuk, fA'L ekranındaki onay ya da kafede alınan yazılı beyan. |
| Açık Rıza Metni | Bu metnin önceki sürümlerinde yer alan R1, R3, R4, R8, R9, R10 ve R11 kalemleri için bugün veri işlenmediğinden rıza istenmez; ilgili bölümlerde bu durum açıklanmıştır ve başka belgelerdeki atıflar bozulmasın diye bölüm ve kalem numaraları korunmuştur. R6 için bugün ayrı bir onay kutucuğu bulunmaz (bkz. 11. bölüm). | Bu metnin önceki sürümlerinde yer alan R1, R3, R4, R5, R8, R9, R10 ve R11 kalemleri için bugün veri işlenmediğinden rıza istenmez; ilgili bölümlerde bu durum açıklanmıştır ve başka belgelerdeki atıflar bozulmasın diye bölüm ve kalem numaraları korunmuştur. R6 kalemi kaldırılmıştır: yurt dışına aktarım için açık rıza istenmez (bkz. 11. bölüm). |
| Açık Rıza Metni | R5 - Çerez tabanlı reklam ve yeniden hedefleme (yalnızca internet sitesi) / Çerez kimliği, tarayıcı bilgisi, ziyaret edilen sayfalar; amaç: çerez panelinde Pazarlama çerezlerini kabul etmeniz hâlinde, internet sitesinde üçüncü taraf reklam platformlarında ilgi alanına dayalı reklam ve yeniden hedefleme ile reklam ölçümlemesi.", / "R6 - Gerektiğinde yurt dışına aktarım / Yukarıdaki amaçlarla sınırlı veriler; amaç: uygun güvencelerin sağlanamadığı istisnai hâllerde yurt dışındaki hizmet sağlayıcılara aktarım. | (kaldırıldı) |
| Açık Rıza Metni, §10 (R5) | Başlık "10. R5 - Çerez Tabanlı Reklam ve Yeniden Hedefleme", dört paragraf ("Bu onayı vermeniz hâlinde, {{SITE}} üzerinde pazarlama ve reklam amaçlı çerezler ... çalıştırılır." ve devamı) ve dört madde (işlenen veriler, alıcılar, süre, rıza vermezseniz) | Başlık "10. R5 - Çerez Tabanlı Reklam ve Yeniden Hedefleme: Yürütülmemektedir"; paragraflar: "Bu metnin önceki sürümlerinde internet sitesinde pazarlama ve reklam amaçlı çerezler ile yeniden hedefleme (R5) için açık rıza öngörülmüştü. İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz: Google Etiket Yöneticisi ve reklam etiketleri yüklenmez, pazarlama çerezleri yerleştirilmez ve çerez paneli bu kategoriyi sormaz; bu nedenle bu kalem için rıza istenmez." / "Mobil uygulamada çerez kullanılmaz; uygulamada reklam veya ölçümleme kiti bulunmaz ve uygulama cihazınızın reklam tanımlayıcısına erişmez." / "Zorunlu çerezler ve tercih çerezleri bu kalemin konusu değildir; çerezlerin ayrıntılı listesi ve süreleri için Çerez Politikası'na bakınız." / "Böyle bir faaliyet ileride yürütülmek istenirse, 22. bölüm uyarınca sizden ayrıca açık rıza alınır." Maddeler kalktı. |
| Açık Rıza Metni, §11 (R6) | Başlık "11. R6 - Kişisel Verilerin Yurt Dışına Aktarılması", dört paragraf ("Şirketimiz, altyapı hizmetlerini yurt dışında yerleşik sağlayıcılardan alabilmektedir. ...", "Uygulamamız şudur: Aktarımı öncelikle bu uygun güvencelere dayandırırız; ...", "Bu onayı (R6), yalnızca yeterlilik kararının bulunmadığı ... böyle bir durumda ilgili veri yurt dışına aktarılmaz ve hizmet yurt içi imkânlarla yürütülür. ...", "Yurt dışına aktarımın risklerini şeffaf biçimde bildiririz: ...") ve altı madde (aktarım amacı, kullanılan başlıca altyapılar, aktarılan veri kategorileri, alıcı grupları, kart bilgileri, rıza vermezseniz) | Başlık "11. R6 - Kişisel Verilerin Yurt Dışına Aktarılması (rıza istenmez)"; paragraflar: "Bu metnin önceki sürümlerinde yer alan R6 onayı kaldırılmıştır; yurt dışına aktarım için açık rızanızı istemiyoruz." / "İnternet sitesinin ve mobil uygulamanın barındırılması, veri tabanı, üyelik girişi ve e-posta gönderimi için yurt dışındaki sağlayıcılara yapılan aktarımlar her sayfa açılışında, girişte, siparişte ve e-postada tekrarlanır; arızi olmadıkları için Kanun'un 9. maddesi uyarınca açık rızaya dayandırılamazlar. Bu aktarımların dayanağı ve her sağlayıcının ülkesi KVKK Aydınlatma Metni'nin 15. bölümünde yazılıdır." / "Tek seferlik, arızi bir aktarım ihtiyacı doğarsa olası riskler size ayrıca anlatılarak o aktarımdan önce ayrı bir onay istenir. fA'L yapay zekâ yorumu için verilen onay R12 bölümünde ayrıca düzenlenmiştir." Maddeler kalktı (kart bilgisi KVKK Aydınlatma §14 ve §15'te anlatılmaya devam eder). |
| Açık Rıza Metni | Yalnızca ileti almayı onaylayıp pazarlama çerezi, fA'L yapay zekâ yorumu veya görsel içerik onaylarını vermemeniz mümkündür. | Yalnızca ileti almayı onaylayıp fA'L yapay zekâ yorumu veya görsel içerik onaylarını vermemeniz mümkündür. |
| Açık Rıza Metni | İnternet sitesindeki analiz çerezleri yalnızca çerez panelinde verdiğiniz onayla çalışır (bkz. 10. bölüm). | İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz; analiz çerezleri yerleştirilmez (bkz. 10. bölüm). |
| Açık Rıza Metni | Hizmet sağlayıcının iletilen verileri, kötüye kullanımın önlenmesi ve güvenlik gibi amaçlarla, kendi ticari hizmet koşulları ve politikalarında belirlenen süre boyunca saklayabileceğini bildiririz. | Hizmet sağlayıcı Anthropic, PBC, yayımladığı ticari veri saklama politikasına göre ilettiğimiz fotoğrafı ve ürettiği yanıtı en geç 30 gün içinde siler; içerik, kullanım politikasına aykırılık şüphesiyle otomatik olarak işaretlenirse 2 yıla kadar, bu işaretlemeye ilişkin güvenlik puanları 7 yıla kadar ve kanunen gerekli hâllerde daha uzun süre saklanabilir. Anthropic, PBC sözleşme gereği bu içeriği yapay zekâ modellerini eğitmek için kullanamaz. |
| Açık Rıza Metni | Bu aktarım her yorum isteğinde tekrarlandığından arızi nitelikte değildir; bu nedenle yurt dışına aktarım yalnızca bu onaya dayanmaz, Kanun'un 9. maddesi uyarınca hizmet sağlayıcıyla akdedilen ve Kurul tarafından ilan edilen standart sözleşmeye dayandırılır. Aktarımın yapıldığı ülkede veri koruma düzeyinin Türkiye'dekiyle aynı olmayabileceğini, yetkili makamların erişim yetkilerinin farklı olabileceğini hatırlatırız. | Bu aktarım her yorum isteğinde tekrarlandığından arızi nitelikte değildir; bu nedenle yurt dışına aktarım yalnızca bu onaya dayanmaz: onayınız aktarımın işleme şartıdır, aktarım ayrıca Kanun'un 9. maddesinin dördüncü fıkrası uyarınca Anthropic, PBC ile imzalanacak ve Kurul tarafından ilan edilen standart sözleşmeye dayandırılır. Bu sözleşme imzalanıp Kurum'a bildirilmeden fotoğrafınız yapay zekâ hizmetine gönderilmez. Aktarımın yapıldığı ülkede veri koruma düzeyinin Türkiye'dekiyle aynı olmayabileceğini, yetkili makamların erişim yetkilerinin farklı olabileceğini hatırlatırız. |
| Açık Rıza Metni | Bildirdiğiniz bir yorumun kaydı incelenmek üzere doksan gün saklanır ve ardından silinir. | Bildirdiğiniz bir yorumun kaydı incelenmek üzere doksan gün saklanır ve ardından silinir. Hizmet sağlayıcı fotoğrafı ve yanıtı kendi politikasına göre en geç 30 gün içinde siler; işaretlenen içerik 2 yıla kadar saklanabilir. |
| Açık Rıza Metni | Pazarlama iletileri (kampanya ve bülten e-postaları), internet sitesinde ilgi alanına dayalı reklamlar, onaya bağlı görsel içerikler ve fA'L'ın yapay zekâ yorumu. | Pazarlama iletileri (kampanya ve bülten e-postaları), onaya bağlı görsel içerikler ve fA'L'ın yapay zekâ yorumu. |
| Açık Rıza Metni | Çerez tabanlı reklam için: Sitedeki çerez yönetim panelinden pazarlama çerezlerini kapatabilir, ayrıca tarayıcınızın ayarlarından mevcut çerezleri silebilirsiniz. | Çerezler için: Sitedeki çerez yönetim panelinden tercih çerezlerine verdiğiniz onayı kapatabilir, ayrıca tarayıcınızın ayarlarından mevcut çerezleri silebilirsiniz. |
| Açık Rıza Metni | Pazarlama çerezlerinin kapatılması | Çerez onayının kapatılması |
| Açık Rıza Metni | Onayınızı geri çektiğinizde kayıt silinmez, geri çekme anı kayda işlenir; kayıt, onayın varlığının ispatı için geri çekme tarihinden itibaren üç yıl saklanır. | Onayınızı geri çektiğinizde kayıt silinmez, geri çekme anı kayda işlenir; kayıt, onayın varlığının ispatı için geri çekme tarihinden itibaren üç yıl saklanır. Onay, fA'L ekranında fotoğraf gönderilmeden önce açılan ayrı bir pencereden verilir; pencere fotoğrafın nereye gönderildiğini özetler ve bu metnin tamamına bağlantı verir. Onay vermemek de aynı kolaylıktadır; bu durumda falınız cihazınızda yorumlanır. |
| Veri Saklama ve İmha Politikası | üyelik kimlik doğrulaması, işlemsel e-posta gönderimi (Resend) | üyelik kimlik doğrulaması ({{AUTH_PROVIDER}}), işlemsel e-posta gönderimi (Resend), yalnızca fA'L yapay zekâ yorumuna açık rıza verilmesi hâlinde yapay zekâ hizmeti (Anthropic, PBC) |
| Veri Saklama ve İmha Politikası | Barındırma, veri tabanı, üyelik kimlik doğrulaması, işlemsel e-posta ve mobil uygulama dağıtımı hizmetlerinin sunucuları yurt dışında bulunabilir. Bu hâllerde aktarım, Kanunun kişisel verilerin yurt dışına aktarılmasına ilişkin hükmü çerçevesinde ve mevzuatın öngördüğü aktarım mekanizmalarına uygun olarak gerçekleştirilir. | Barındırma, veri tabanı, üyelik kimlik doğrulaması, işlemsel e-posta ve mobil uygulama dağıtımı hizmetlerinin sunucuları yurt dışındadır. Bu aktarımlar Kanunun 9. maddesi uyarınca Kurul tarafından ilan edilen standart sözleşmeye dayandırılacaktır; sağlayıcılarla imzalama süreci devam etmektedir ve her sözleşmenin imza ve bildirim durumu KVKK Aydınlatma Metni'nin 15. bölümünde yazılır. |
| Çerez Politikası | Sitede etiketler Google Etiket Yöneticisi (Google Tag Manager) üzerinden yönetilir. Etiket yöneticisinin kendisi her sayfada yüklenir; rızaya tabi etiketlere ise siz ilgili kategoriye onay verene kadar Google İzin Modu (Consent Mode) üzerinden 'reddedildi' sinyali iletilir ve Google'ın ölçümleme ve reklam etiketleri bu durumda cihazınıza analitik veya pazarlama çerezi yazmaz. | İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz; Google Etiket Yöneticisi (Google Tag Manager) yüklenmez. Etiket yöneticisi ileride kullanılırsa rızaya tabi etiketlere, siz ilgili kategoriye onay verene kadar Google İzin Modu (Consent Mode) üzerinden 'reddedildi' sinyali iletilir. |
| Çerez Politikası | İstatistiksel ölçümleme: hangi sayfaların ne kadar görüntülendiği, hangi adımlarda ayrılma yaşandığı, site hızının ve hataların izlenmesi gibi toplu analizlerle site deneyiminin iyileştirilmesi. / Pazarlama ve yeniden hedefleme: ilgi alanlarınıza uygun {{BRAND}} tanıtımlarının üçüncü taraf platformlarda gösterilmesi ve reklam performansının ölçülmesi. | (kaldırıldı) |
| Çerez Politikası | {{SHORT_NAME}}, çerezleri yalnızca aşağıda sayılan belirli, açık ve meşru amaçlarla kullanır. Bu amaçlar, 6698 sayılı Kanun'un 4. maddesinde yer alan amaçla bağlantılı, sınırlı ve ölçülü olma ilkesi gözetilerek belirlenmiştir. | {{SHORT_NAME}}, çerezleri yalnızca aşağıda sayılan belirli, açık ve meşru amaçlarla kullanır. Bu amaçlar, 6698 sayılı Kanun'un 4. maddesinde yer alan amaçla bağlantılı, sınırlı ve ölçülü olma ilkesi gözetilerek belirlenmiştir. İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz; istatistiksel ölçümleme, pazarlama ve yeniden hedefleme amaçlarıyla çerez kullanılmaz. |
| Çerez Politikası | Üçüncü taraf ölçümleme çerezleri: Google Analytics 4 tarafından yerleştirilen çerezlerdir. Yalnızca 'Analitik' kategorisine onay verdiğinizde yerleştirilir. / Üçüncü taraf pazarlama çerezleri: Google reklam hizmetlerinin (Google Ads) kullanılması hâlinde bu hizmetin yerleştirdiği çerezlerdir. Yalnızca 'Pazarlama' kategorisine onay verdiğinizde yerleştirilir. Meta (Facebook/Instagram) ve TikTok reklam etiketleri sitede yüklenmez. | Üçüncü taraf ölçümleme ve pazarlama çerezleri: İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz; Google Analytics, Google Ads, Meta (Facebook/Instagram) ve TikTok etiketleri yüklenmez ve bu çerezler yerleştirilmez. |
| Çerez Politikası | Sitede kullanılan çerezler dört amaç kategorisine ayrılmıştır. Kategori ayrımı, çerez bandındaki ve tercih merkezindeki seçeneklerle birebir aynıdır; bir kategoriye verdiğiniz onay yalnızca o kategorideki çerezleri kapsar. | Çerezler dört amaç kategorisine ayrılır; bir kategoriye verdiğiniz onay yalnızca o kategorideki çerezleri kapsar. Çerez bandı ve tercih merkezi yalnızca sitede kullanılan kategorileri sorar. |
| Çerez Politikası | Etiketleri yöneten Google Etiket Yöneticisi ise her sayfada yüklenir; siz onay verene kadar ölçümleme ve reklam etiketlerine Google İzin Modu üzerinden 'reddedildi' sinyali iletilir (bkz. 17. madde). | İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz: Google Etiket Yöneticisi yüklenmez, analitik ve pazarlama çerezleri yerleştirilmez ve çerez bandı ile tercih merkezi yalnızca zorunlu ve tercih çerezlerini gösterir. Aşağıdaki tabloda bu iki kategori, ileride kullanılırlarsa uygulanacak kuralla birlikte gösterilmiştir; o durumda bu Politika güncellenir ve onayınız ayrıca istenir (bkz. 17. madde). |
| Çerez Politikası | Amaç: ziyaret istatistikleri, sayfa performansı ve hata ölçümü yoluyla site deneyiminin iyileştirilmesi. Rıza: gerekir. Kapatılabilir. Hukuki sebep: açık rıza (6698 sayılı Kanun m.5/1). | Amaç: ziyaret istatistikleri, sayfa performansı ve hata ölçümü yoluyla site deneyiminin iyileştirilmesi. Rıza: gerekir. Kapatılabilir. Hukuki sebep: açık rıza (6698 sayılı Kanun m.5/1). Bugün kullanılmaz; çerez paneli bu kategoriyi sormaz. |
| Çerez Politikası | Amaç: ilgi alanına dayalı reklam gösterimi, yeniden hedefleme ve reklam dönüşümlerinin ölçülmesi. Rıza: gerekir. Kapatılabilir. Hukuki sebep: açık rıza (6698 sayılı Kanun m.5/1). | Amaç: ilgi alanına dayalı reklam gösterimi, yeniden hedefleme ve reklam dönüşümlerinin ölçülmesi. Rıza: gerekir. Kapatılabilir. Hukuki sebep: açık rıza (6698 sayılı Kanun m.5/1). Bugün kullanılmaz; çerez paneli bu kategoriyi sormaz. |
| Çerez Politikası | Sitede bugün tercih kategorisine bağlı bir birinci taraf çerez kullanılmamaktadır; bu kategoriye ilişkin seçiminiz, Google İzin Modu'nda işlevsellik ve kişiselleştirme amaçlı depolama sinyalleri olarak etiketlere iletilir. | Sitede bugün tercih kategorisine bağlı bir çerez kullanılmamaktadır ve sitede etiket de yüklenmediğinden bu kategoriye verdiğiniz onay bugün yalnızca laffogato_cookie_consent çerezine kaydedilir; ileride bu kategoride bir çerez kullanılırsa önce bu envanter güncellenir. |
| Çerez Politikası | Analitik çerezler, sitenin nasıl kullanıldığını toplu ve istatistiksel düzeyde anlamamızı sağlar. Aşağıdaki envanter, sitede kullanılan ve kullanılması hâlinde devreye girecek analitik çerezleri gösterir; ilgili ölçümleme hizmeti devreye alınmadığı sürece bu çerezlerin hiçbiri cihazınıza yerleştirilmez. Bu kategoriye onay vermediğiniz sürece Google İzin Modu'nda analitik depolama izni 'reddedildi' olarak kalır ve aşağıdaki çerezler cihazınıza yerleştirilmez. | Analitik çerezler, sitenin nasıl kullanıldığını toplu ve istatistiksel düzeyde anlamaya yarar. İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz; aşağıdaki çerezlerin hiçbiri bugün yerleştirilmez ve çerez paneli bu kategoriyi sormaz. Envanter, ölçümleme hizmeti ileride devreye alınırsa kullanılacak çerezleri gösterir; o durumda bu Politika güncellenir ve çerezler yalnızca açık rızanızla yerleştirilir. |
| Çerez Politikası | Bu hizmet yurt dışında yerleşik bir sağlayıcı tarafından sunulduğundan, verinin yurt dışına aktarılması söz konusudur; ayrıntı için bu Politikanın 18. maddesine bakınız. | Bu hizmet yurt dışında yerleşik bir sağlayıcı tarafından sunulduğundan, ancak bu aktarım için Kanun'un 9. maddesindeki güvence sağlandıktan sonra devreye alınabilir (bkz. 18. madde). |
| Çerez Politikası | Pazarlama çerezleri, {{BRAND}} tanıtımlarının ilgi alanlarınıza uygun biçimde üçüncü taraf platformlarda gösterilmesi ve bu tanıtımların sonuç verip vermediğinin ölçülmesi amacıyla kullanılır. Aşağıdaki envanter, kullanılan ve kullanılması hâlinde devreye girecek pazarlama çerezlerini gösterir; ilgili reklam hizmeti devreye alınmadığı sürece bu çerezler yerleştirilmez. Bu kategoriye onay vermediğiniz sürece Google İzin Modu'nda reklam depolama, reklam amaçlı kullanıcı verisi ve reklam kişiselleştirme izinleri 'reddedildi' olarak kalır ve aşağıdaki çerezler cihazınıza yerleştirilmez. | Pazarlama çerezleri, {{BRAND}} tanıtımlarının ilgi alanlarınıza uygun biçimde üçüncü taraf platformlarda gösterilmesi ve bu tanıtımların sonuç verip vermediğinin ölçülmesi amacıyla kullanılabilir. İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz; aşağıdaki çerez bugün yerleştirilmez ve çerez paneli bu kategoriyi sormaz. Envanter, reklam hizmeti ileride devreye alınırsa kullanılacak çerezi gösterir; o durumda bu Politika güncellenir ve çerez yalnızca açık rızanızla yerleştirilir. |
| Çerez Politikası | Pazarlama onayı vermemiş olsanız da siteye bir Google reklamına tıklayarak geldiyseniz, reklam tıklama kimliği cihazınıza çerez olarak yazılmaz, ancak site içi bağlantıların adreslerinde taşınabilir. | (kaldırıldı) |
| Çerez Politikası | Siz bir seçim yapana kadar zorunlu çerezler dışında hiçbir çerez yerleştirilmez. Etiketleri yöneten Google Etiket Yöneticisi bu sırada da yüklenir; ancak Google İzin Modu sinyalleri, güvenlik amaçlı depolama dışında 'reddedildi' olarak başlar. | Siz bir seçim yapana kadar zorunlu çerezler dışında hiçbir çerez yerleştirilmez; internet sitemizde bugün Google Etiket Yöneticisi ve başka bir ölçümleme veya reklam etiketi yüklenmez. |
| Çerez Politikası | Seçiminiz Google İzin Modu sinyalleriyle etiketlere hemen iletilir; onay verdiğiniz kategorilerin çerezleri ancak bu andan itibaren yerleştirilir, onay vermediğiniz kategorilerin çerezleri hiç yerleştirilmez. | Onay verdiğiniz kategorilerin çerezleri ancak bu andan itibaren yerleştirilir, onay vermediğiniz kategorilerin çerezleri hiç yerleştirilmez; etiket yöneticisi ileride kullanılırsa seçiminiz Google İzin Modu sinyalleriyle etiketlere de iletilir. |
| Çerez Politikası | ; Google Etiket Yöneticisi'nin her sayfada yüklenmesine ilişkin 17. maddedeki açıklama saklıdır. | ; internet sitemizde bugün analitik veya reklam etiketi zaten kullanılmaz. |
| Çerez Politikası | Kategori: etiket yönetimi; rızanızdan bağımsız olarak her sayfada yüklenir. Sitedeki ölçümleme ve reklam etiketlerini yönetir ve verdiğiniz veya vermediğiniz onayı Google İzin Modu (Consent Mode v2) sinyalleriyle bu etiketlere iletir; siz bir seçim yapana kadar güvenlik amaçlı depolama dışındaki tüm sinyaller 'reddedildi' olarak ayarlanır. Yükleme sırasında tarayıcınız Google'ın sunucusuna bağlandığından Google, IP adresinizi, tarayıcı bilginizi ve isteğin {{SITE}} üzerinden geldiğini görebilir. Kart bilgilerinin girildiği ödeme sayfasında yüklenmez. | Kategori: etiket yönetimi. İnternet sitemizde bugün kullanılmaz ve yüklenmez: Google ile Kurul tarafından ilan edilen standart sözleşme bulunmadığından, ancak böyle bir sözleşme imzalanıp Kurum'a bildirildikten sonra devreye alınabilir. Kullanılırsa her sayfada yüklenir, Google IP adresinizi ve tarayıcı bilginizi görebilir ve verdiğiniz veya vermediğiniz onay Google İzin Modu (Consent Mode v2) sinyalleriyle etiketlere iletilir. Kart bilgilerinin girildiği ödeme sayfasında hiçbir hâlde yüklenmez. |
| Çerez Politikası | Kategori: analitik. Kullanılan çerezler: _ga, _ga_*. Pazarlama onayınız yoksa reklam kişiselleştirme sinyali 'reddedildi' olarak iletilir. Google Etiket Yöneticisi üzerinden yönetilir; çerezler yalnızca açık rızanızla yerleştirilir. | Kategori: analitik. Bugün kullanılmaz. Kullanılırsa çerezler: _ga, _ga_*; Google Etiket Yöneticisi üzerinden yönetilir ve çerezler yalnızca açık rızanızla yerleştirilir. |
| Çerez Politikası | Kategori: pazarlama. Kullanılması hâlinde çerez: _gcl_au. Dönüşüm ölçümü ve yeniden hedefleme. Çerezler yalnızca açık rızanızla yerleştirilir; onay vermediyseniz bir Google reklamından gelişinize ilişkin tıklama kimliği çerez yerine site içi bağlantıların adreslerinde taşınabilir. | Kategori: pazarlama. Bugün kullanılmaz. Kullanılırsa çerez: _gcl_au; dönüşüm ölçümü ve yeniden hedefleme için ve yalnızca açık rızanızla yerleştirilir. |
| Çerez Politikası | Düğmeye bastığınızda tarayıcınız Google'a bağlanır; Google, IP adresinizi ve tarayıcı bilginizi görebilir ve kendi çerezlerini yerleştirebilir. Bu işleme Google'ın kendi politikasına tabidir. | Düğmeye bastığınızda tarayıcınız Google'a bağlanır; Google, IP adresinizi ve tarayıcı bilginizi görebilir ve kendi çerezlerini yerleştirebilir. Bu işleme Google'ın kendi politikasına tabidir. Google ile standart sözleşme bulunmadığından bu gömülü harita kaldırılacak, yerine Google Haritalar'a bağlantı verilecektir. |
| Çerez Politikası | Çerezler yoluyla elde edilen veriler, yurt dışında yerleşik ölçümleme ve reklam sağlayıcılarının sunucularına aktarılabilir. Bu aktarım, 6698 sayılı Kanun'un 9. maddesi çerçevesinde; ilgili ülke, sektör veya uluslararası kuruluş bakımından Kişisel Verileri Koruma Kurulunca verilmiş bir yeterlilik kararı bulunması hâlinde bu karara, bulunmaması hâlinde ise Kanun'da sayılan uygun güvencelerden birine (standart sözleşme, taahhütname veya bağlayıcı şirket kuralları gibi) dayanılarak gerçekleştirilir. Bu yolların hiçbirinin bulunmadığı hâllerde aktarım, yalnızca Kanun'un aradığı arızi nitelikteki istisnalar kapsamında ve aktarımın risklerine ilişkin bilgilendirme üzerine vereceğiniz açık rızaya dayanabilir. Analitik ve pazarlama kategorilerine onay vermediğinizde bu kategorilerin çerezleri yerleştirilmez; ancak Google Etiket Yöneticisi her sayfada yüklendiğinden, bu yükleme sırasında IP adresiniz ve tarayıcı bilginiz onay durumunuzdan bağımsız olarak yurt dışında yerleşik Google'ın sunucularına ulaşır. | İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz; bu nedenle çerezler yoluyla yurt dışındaki ölçümleme veya reklam sağlayıcılarına veri aktarılmaz. Bu hizmetler ileride kullanılırsa, ilgili sağlayıcıyla 6698 sayılı Kanun'un 9. maddesi uyarınca Kurul tarafından ilan edilen standart sözleşme imzalanıp Kurum'a bildirilmeden devreye alınmaz; bu aktarımlar her sayfa açılışında tekrarlanacağından arızi değildir ve açık rızaya dayandırılmaz. Ziyaret sayfasındaki haritayı göstermeyi seçtiğinizde tarayıcınız yurt dışında yerleşik Google'ın sunucularına bağlanır; Google ile standart sözleşme bulunmadığından bu gömülü harita kaldırılacaktır. |
| Ticari Elektronik İleti ve İYS Aydınlatması | aktarım, öngörülen hukuki mekanizmalara ve gerekli hâllerde açık rızanıza dayanılarak gerçekleştirilir. | aktarım, Kanun'un 9. maddesi uyarınca Kurul tarafından ilan edilen standart sözleşmeye dayandırılacaktır; sözleşmelerin imza ve bildirim durumu KVKK Aydınlatma Metni'nin 15. bölümünde yazılır. Açık rızanıza yalnızca arızi bir aktarımda ve olası riskler size ayrıca anlatıldıktan sonra başvurulur. |

**Bilerek değişmeyenler.**

- Mesafeli Satış Sözleşmesi, Ödeme Koşulları, Güvenli Alışveriş, Üyelik Sözleşmesi,
  Mobil Uygulama Kullanım Koşulları, Şirket ve İletişim Bilgileri ile Şikâyet ve
  Uyuşmazlık Çözümü'ndeki genel yurt dışı aktarım cümleleri ("m.9 çerçevesinde ...
  gerçekleştirilir/yürütülür") bu PR'da değişmedi: ödeme belgelerini değiştirmek
  `LEGAL_UPDATED`'ı taşır (günde bir) ve bu cümleler ayrıntıyı KVKK Aydınlatma
  §15'e bırakır. İmzalar tamamlanınca `legal-kvkk-transfer-mechanism-named` onları da
  "standart sözleşmeye dayanır" diye netleştirir; o güne kadar Aydınlatma §15 tek
  kaynaktır.
- "Mobil uygulama mağaza dağıtımı" §15'in aktarım listelerinden çıktı: mağazalar
  uygulamayı mağaza hesabı bakımından kendi adlarına dağıtır (bağımsız veri
  sorumlusu, §14) ve biz onlara bu kanalla veri göndermeyiz; §15 bunu bir cümleyle
  söyler. İçerik dağıtım ağı ve sunucu hata ve performans kayıtları Vercel'indir ve
  alıcılar satırında Vercel'in yanında yazılır; ayrı bir izleme hizmeti yok
  (`package.json`'da Sentry ya da benzeri yok). 2026/347: listelenen her gerekçenin
  adı yazılı bir alıcısı var (`tests/legal-kvkk-transfers.test.ts`).
- Paraşüt (operatör, 19 Eki 2026: e-faturalar Paraşüt'ten kesiliyor) KVKK
  Aydınlatma §14'te ve Gizlilik §8'de veri işleyen olarak adıyla yazılır; "kullanılması
  hâlinde" kalktı (KVKK m.10/1-c, 2026/347: alıcı grubu eksiksiz ve kesin). Paraşüt
  Türkiye'de yerleşik, aktarım yurt içinde (KVKK m.8). Kendi aydınlatma metni
  altyapı tedarikçilerinin "yurt içi veya yurt dışında" bulunabileceğini ve yurt
  dışındaki hâkim hissedarını alıcı sayar, fatura verisinin nerede barındırıldığını
  ise söylemez (parasut.com, 19 Eki 2026). Bu yüzden §15 Paraşüt'ü konumu yazılı
  beyanla eklenecek bir alıcı olarak anar; yurt dışındaysa Paraşüt standart sözleşme
  listesine girer.
- Tercih çerezi kategorisi bantta kaldı (karar metni). Sitede bugün bu kategoriye
  bağlı bir çerez yok; Çerez Politikası §9 bunu açıkça söyler. Bandın tamamen
  kalkması ayrı bir karar.
- Uygulamanın kendi fA'L rıza sayfası (lafmobil, "Bilgilendirmeyi okudum, anladım."
  kutusu, `app-fal-consent-and-seed`) bu PR'da değil. Özellik kod kapısıyla kapalı
  olduğundan bugün kimse rıza sayfasını görmez.

**Operatöre.**

1. Birleştirmeden önce, Neon SQL editöründe salt okuma (OP-17):
   `select model, count(*) from fal_readings group by model;`
   `select model, count(*) from fal_reports group by model;`
   `select version, count(*) from feature_consents where feature = 'fal-ai' group by version;`
   `claude-` ile başlamayan bir model varsa (OpenAI yorumu) birleştirme durur ve
   R12'ye OpenAI notu eklenir (ASK-FAL-1 b).
2. Birleşme günü: Vercel'de `NEXT_PUBLIC_GTM_ID`'yi Production ve Preview'dan sil
   (OP-22). Kod onu artık okumuyor (`GOOGLE_TAGS_IN_LEGAL_TEXTS`), silmek temizliktir.
3. Ayarlar → Genel'deki iletişim adresinin (`settings.email`) şirket alan adında
   olduğunu (info@nextgenlab.com.tr) ya da Ayarlar → Karaoke'ye
   karaoke@nextgenlab.com.tr gibi bir kurumsal adres yazıldığını doğrula;
   `/admin/kullanicilar`, Ayarlar → Bildirimler ve `ADMIN_EMAIL`'de sipariş
   bildirimi alan Gmail veya yurt dışındaki başka bir kişisel kutu kalmasın
   (kod bilinen kişisel alan adlarını artık atlar; kurumsal alan adının nerede
   barındırıldığını ise adresten okuyamaz).
   Kurumsal kutu Gmail'e eklenmez, Gmail'e yönlendirilmez. Gmail'deki eski karaoke
   bildirimlerini (/admin/karaoke'de olduklarını kontrol ettikten sonra, çöp kutusu
   dahil) sil ve tarihini KVKK klasörüne yaz.
4. 31 Ekim 2026'ya kadar Vercel Inc., Resend (Plus Five Five, Inc.), Neon
   (Databricks, Inc. / Neon, LLC) ve Supabase Pte. Ltd.'den değiştirilmemiş Türkçe
   Standart Sözleşme 2'yi iste (OP-SS2-PROVIDERS); her imzadan sonra beş iş günü
   içinde Kurum'a bildir, makbuzu sakla (OP-SS2-NOTIFY). Her imza `legal-kvkk-transfer-mechanism-named`
   PR'ında o sağlayıcının "imza sürecinde"sini tarihli cümleye çevirir.
5. Neon ve Supabase panellerinde bölgeyi ve faturadaki şirketi teyit et (OP-REGIONS);
   farklıysa §15'teki alıcılar satırı düzeltilir.
   - Paraşüt'ten yazılı olarak iste: fatura verisinin (e-Arşiv, e-fatura, müşteri
     kartları) barındırıldığı ülke ve sağlayıcı, alt işleyen listesi ve KVKK m.12
     veri işleme sözleşmesi. Türkiye ise §15'teki Paraşüt parçası "Türkiye'de
     barındırılır" olur; yurt dışındaysa Paraşüt 4. adımdaki standart sözleşme
     listesine girer ve satır "imza sürecinde" olur.
6. fA'L'ı açmak: §15.5 ve OP-FAL-OFF'taki beş koşul tamamlanınca açılış PR'ı
   `fal-safeguard.ts`'i (imza günü, bildirim günü, makbuz) doldurur, R12'deki
   "imzalanacak ve"yi tarihli cümleye çevirir ve `FAL_CONSENT_TEXT_DAY`'i taşır;
   ancak ondan sonra Production'da `FAL_AI_ENABLED=true` yazılır.
7. Hukuki metin kopyası uygulamaya (`npm run legal:export -- ../lafmobil/src/data/legal.seed.json`)
   ve `docs/API-MOBILE.md` lafmobil'e taşınır (RECONCILED özeti güncellenir).

---


## 16. Y2 - KDV oranı ürüne göre (17 Eki 2026)

> **Durum (18 Eki 2026): karar verildi, metin ve kod değişti.** Operatör
> kararı: avukat ve mali müşavir turu yok; birincil kaynaklar araştırıldı ve
> karar verildi (§16.3, §16.4). Dal `feat/legal-kdv-rates-and-invoice-lines`.
> 17 Ekim'deki ilk sürüm `feat/kdv-per-product` (§16.1, §16.2) tarihçe olarak
> duruyor. Fiyatlar ve tahsil edilen tutarlar hiçbir adımda değişmedi;
> değişen, fiyatın içindeki KDV'nin nasıl ayrıldığı ve metinlerin bunu nasıl
> söylediğidir.

### 16.1 Neden

Operatör kararı (17 Eki 2026): KDV oranı ürüne göre olacak ve panelden
düzenlenecek. Karaoke odası %20, kafe menüsünden verilen sipariş %10, kahve
çekirdeği gibi paketli ürünler %1. Araştırma (17 Eki 2026, birincil
kaynaklarla; kod `src/lib/utils/kdv.ts`):

- 3065 sayılı KDV Kanunu m.28; BKK 2007/13033'e ekli (I) sayılı liste %1,
  (II) sayılı liste %10, diğerleri %20 (Cumhurbaşkanı Kararı 7346, RG 7 Tem
  2023, yürürlük 10 Tem 2023).
- Kafe ve lokanta hizmetleri (II) sayılı listenin 24. sırasıdır. KDV GUT
  III/B-2.4'e (Tebliğ Seri No 51, RG 27 Nis 2024, yürürlük 1 May 2024)
  göre işletmede hazırlanan ya da dışarıdan alınan gıdanın, yerinde ya da
  paket, gel-al, telefon veya internet siparişiyle satışı %10'dur. Alkollü
  içecek %20'dir; köşk alkol satmıyor.
- Kavrulmuş ve öğütülmüş kahve (GTİP 09.01), kahve ekstraktı (21.01) ve
  paketli gıdaların çoğu, Cumhurbaşkanı Kararı 5189'dan (RG 13 Şub 2022) beri
  (I) sayılı listededir: %1.
- Ekipman, gıda dışındaki hediyelik ve marka ürünleri ile karaoke odası
  kiralaması iki listede de yoktur: %20. Oran malın cinsine bağlıdır, hediye
  olarak satılmasına değil: mağazanın "Hediye" kategorisindeki yenilebilir
  kup kutusu (waffle kupu, GTİP 19.05) gıdadır, %1. Bu ürüne migration ve
  seed kendi oranını (%1) verir; kategori varsayılanı %20 kalır.
- Satıcının alıcıdan aldığı kargo ya da kurye bedeli, teslimin matrahına
  girer (KDV K. m.24/a): taşıdığı ürünün oranına tabidir. Farklı oranlı
  ürünler bir arada gönderildiğinde bedel tutarlarıyla orantılı paylaştırılır.
  Bu paylaştırma yaygın uygulamadır; kanunda yazılı bir kural değildir.
  (18 Eki 2026'da değişti: kargo ayrı kalem, %20; §16.3 Y2-2. Bent harfi de
  düzeltildi: taşıma giderleri m.24/a'dadır, m.24/b ambalaj, sigorta ve
  komisyon içindir.)
- (18 Eki 2026'da değişti) Kahve çekirdeği ve paketli gıda için %1 kararı
  da kalktı: köşk kafeterya işletmesi olduğu için sattığı bütün gıda %10
  (§16.3 Y2-1).

Metinler ise "fiziksel ürünlerde %20", "kargo hizmet bedelinde KDV %20" ve
"yüzde 20 KDV" diyordu. Bu, %1'lik kahve ve %10'luk menü için yanlıştı.

### 16.2 Değişen cümleler

Satır numaraları `src/lib/legal/content.ts`'in bu PR'daki hâline aittir. Ön
Bilgilendirme Formu ile Mesafeli Satış Sözleşmesi ödeme onayında
onaylanan belgelerdir. Bu yüzden `LEGAL_UPDATED` (onayın kaydettiği sürüm)
16 Ekim'den 17 Ekim 2026'ya taşındı. Bu tarih kendi tarihi olmayan her
belgenin "Son güncelleme" satırıdır. Karaoke belgesinin sürümü ayrıdır ve
değişmedi.

| Belge | Satır | Mevcut (16 Eki 2026) | Yeni |
|---|---|---|---|
| Ön Bilgilendirme Formu, fiyat ve vergiler | 268 | "... fiziksel ürünlerde güncel oran %20'dir." | "... ürünün türüne bağlıdır: kahve çekirdeği, öğütülmüş kahve ve diğer paketli gıda ürünlerinde %1, kafe menüsündeki yiyecek ve içeceklerde %10, ekipman ile gıda dışındaki hediyelik ve marka ürünlerinde %20'dir; gıda içeren hediye kutu ve setlerinde oran, içindeki ürünlere göre belirlenir. Kargo veya kurye bedeli, gönderilen ürünlerin satış bedelinin parçasıdır ve onların KDV oranına tabidir. Her kalemin KDV oranı ve tutarı faturada gösterilir." |
| Ön Bilgilendirme Formu, tablo | 283-284 | "KDV oranı (fiziksel ürün)": "%20" | "KDV oranı": "Ürüne göre %1, %10 veya %20 (fiyatlara dâhil)" |
| Mesafeli Satış Sözleşmesi, fiyat | 882 | "... aksi açıkça belirtilmedikçe %20 oranındaki Katma Değer Vergisi dâhildir." | "... ürünün türüne göre %1, %10 veya %20 oranındaki Katma Değer Vergisi dâhildir (kahve çekirdeği ve paketli gıda ürünlerinde %1, kafe menüsündeki yiyecek ve içeceklerde %10, ekipman ile gıda dışındaki hediyelik ve marka ürünlerinde %20; gıda içeren hediye kutu ve setlerinde içindeki ürünlere göre)." |
| Mesafeli Satış Sözleşmesi, tablo | 903 | "KDV Oranı": "%20 (fiyatlara dâhildir)" | "Ürüne göre %1, %10 veya %20 (fiyatlara dâhildir)" |
| Teslimat ve Kargo, ücretler | 2125 | "Kargo ve teslimat hizmet bedeline uygulanan katma değer vergisi oranı %20'dir; ürünlere uygulanan KDV oranı ise ..." | "Ürünlere uygulanan KDV oranı ... hesaplanır. Kargo ve teslimat bedeli, gönderilen ürünün satış bedelinin bir parçasıdır ve o ürünün KDV oranına tabidir; farklı oranlı ürünler birlikte gönderildiğinde bedel, ürün tutarlarıyla orantılı olarak paylaştırılır." |
| Teslimat ve Kargo, özet | 2158 | "(kargo hizmet bedelinde KDV %20)" | "(kargo bedeli, gönderilen ürünün KDV oranına tabidir)" |
| Satış Politikası, fiyat | 3417 | "... %20 oranındaki katma değer vergisi dâhil ..." | "... ürünün türüne göre %1, %10 veya %20 oranındaki katma değer vergisi dâhil ..." |
| Satış Politikası, tablo | 3445 | "%20 (fiyatlara dâhil)" | "Ürüne göre %1, %10 veya %20 (fiyatlara dâhil)" |
| Ödeme Koşulları, fiyat | 3835 | "... %20 oranındaki katma değer vergisi dâhil ..." | "... ürünün türüne göre %1, %10 veya %20 oranındaki katma değer vergisi dâhil ..." |
| Güvenli Alışveriş, tutarın hesabı | 4428 | "... kargo veya kurye bedeli ve yüzde 20 KDV dahil nihai tutar ..." | "... kargo veya kurye bedeli eklenerek KDV dahil nihai tutar ..." |
| Şirket Bilgileri, fiyatlar | 12750 | "... uygulanan KDV oranı yüzde 20'dir" | "... uygulanan KDV oranı ürüne göre yüzde 1, 10 veya 20'dir" |
| Şirket Bilgileri, tablo | 12918 | "Yüzde 20 (fiyatlara dahil)" | "Ürüne göre yüzde 1, 10 veya 20 (fiyatlara dahil)" |
| Şirket Bilgileri, fatura tablosu | 13322 | "Yüzde 20" | "Ürüne ve hizmete göre yüzde 1, 10 veya 20" |
| Şikâyet ve Uyuşmazlık, tutarın hesabı | 13849 | "... ürün kaydındaki güncel fiyat, geçerli promosyon kodu veya kupon, KDV oranı (%20) ve ..." | "... ürün kaydındaki KDV dahil güncel fiyat, geçerli promosyon kodu veya kupon ve ..." (oran tutarı oluşturmaz: fiyatlar KDV dahildir, oran yalnız içindeki KDV'yi ayırır) |

Değişmeyenler: Karaoke Odası Rezervasyonu belgesi oran söylemiyor ("tüm
vergiler dahil"). Kullanım Şartları'ndaki "KDV oranı: Gösterilen fiyatlara
dâhildir" doğru kaldı.

### 16.3 Sorular ve kararlar (18 Eki 2026)

Operatör kararı 18 Ekim 2026: "avukata sorma, sen karar ver, araştır ve
doğru olanı yap". Aşağıdaki sorular avukat ya da mali müşavir yerine birincil
kaynaklarla (mevzuat.gov.tr, resmigazete.gov.tr, gib.gov.tr özelgeleri)
araştırılarak karara bağlandı. Dayanak her satırda; ayrıntı §16.4.

| # | Soru (17 Eki 2026) | Karar (18 Eki 2026) | Dayanak |
|---|---|---|---|
| Y2-1 | Mağazada kargoyla satılan paketli kahve %1 mi, %10 mu? Kasada satılan paket kahve? | Köşk kafeterya (yeme-içme) işletmesi; sattığı bütün gıda %10: kasada, gel-al, kurye, masa ve internetten kargoyla gönderilen paket kahve, matcha, cantucci ve yenilebilir kup dahil. %1 hiçbir üründe kullanılmaz. Kod varsayılanı `beans` ve `pantry` 10. | KDV GUT III/B-2.4.1 (Tebliğ Seri No 51, RG 27.04.2024, Örnek 1 ve "internet üzerinden sipariş suretiyle adrese gönderme ... tüm satışlar da aynı mahiyettedir"); BKK 2007/13033 (II) sayılı liste 24. sıra; KDV K. m.8/2 |
| Y2-2 | Kargo ve kurye bedeli ürünün oranıyla mı, ayrı %20 hizmet olarak mı? | Ayrı kalem, %20 (taşıma hizmeti, genel oran). Ücret siparişte ayrı satırda gösteriliyor ve taşımayı dışarıdan bir firma yapıyor. Ücretsiz kargoda satır yok. Eski siparişlere de uygulanır: fatura kargoya verme anında kesilir ve 18 Ekim 2026'ya kadar e-Arşiv kesilmedi. | KDV K. m.24/a; GİB özelgeleri 32391 (Balıkesir VDB, 21.03.2017), 28945 (İzmir VDB, 14.04.2021), 32558 (Balıkesir VDB, 09.04.2015); MSY m.5/1-d |
| Y2-3 | Karışık hediye kutusu (Affogato Seti) ve yalnız gıda olan kutu hangi oranda? | Gıda ile gıda dışı ürün tek fiyatla bir aradaysa set %20 (Affogato Seti); yalnız gıdadan oluşan kutu %10 (Yenilebilir Kup). Set bileşenlerine bölünmez. | KDV GUT III/B-1.3; GİB özelgeleri 32094 (İstanbul VDB, 20.08.2024), 32968 |
| Y2-4 | Metin oranları örnekle sayıyor; panel başka oran verebiliyor. Kural mı yazılsın, "toplam değişmez" denilsin mi? | Metin oranı saymaz, kuralı yazar: her ürün ve hizmet yürürlükteki oranına tabi, her kalemin oranı ve tutarı faturada. Sipariş özetindeki KDV dahil toplam sonradan oran değişse de değişmez (fark köşkün). Paneldeki varsayılan alanları serbest sayı yerine seçim (0, 1, 10, 20 ve kayıtlı farklı değer). | MSY m.5/1-d; KDV K. m.2/1, m.10, m.28; KDV GUT III/B-1.2.3 |
| Y2-5 | Onay sürümü değişti; uygulamanın çevrimdışı kopyası yenilenmeli. | Yenilenir: `lafmobil` `npm run legal:export` (uygulama PR'ı app-legal-seed-kdv-wording). | §13 |
| Kupon | Kupon bir ürünü tamamen karşılarsa ya da ödül kuponuysa faturada nasıl gösterilir? | Promosyon kodu ve hediye kuponu (HG, DG, HD, DY) iskontodur, satırlara orantılı düşülür. Ödül kuponu (damga SD, kilometre taşı KT, davet DV) ve ürünlerin tamamını karşılayan kupon iskonto değildir: ürün faturada tam fiyatla, kupon ödeme aracı olarak. Panel sipariş sayfası ve CSV bu dökümü gösterir. | KDV K. m.20/1, m.25/a, m.27/1; KDV GUT III/A-6.1; GİB özelgeleri 31994, 32079 |

Ürün ürün inceleme (OP-KDV-PRODUCT-REVIEW). Karar: "Operatör kararı 18 Ekim
2026: araştırıldı, avukat/mali müşavir turu yok". GTİP'ler bağlayıcı tarife
bilgisi alınmadan bizim sınıflandırmamızdır; oranı değiştirmezler.

| Ürün id | Ad | Oran | GTİP | Dayanak | Karar | Tarih |
|---|---|---|---|---|---|---|
| prd-0001 | Sirena - Espresso Harmanı (kavrulmuş kahve çekirdeği) | %10 | 0901.21 | KDV GUT III/B-2.4.1 | Operatör kararı 18 Ekim 2026: araştırıldı, avukat/mali müşavir turu yok | 18.10.2026 |
| prd-0002 | Notturna - Filtre Lotu (kavrulmuş kahve çekirdeği) | %10 | 0901.21 | KDV GUT III/B-2.4.1 | Operatör kararı 18 Ekim 2026: araştırıldı, avukat/mali müşavir turu yok | 18.10.2026 |
| prd-0003 | Yenilebilir Kup - 6'lı Kutu (waffle; ürünün kendi oranı) | %10 | 1905.32 | KDV GUT III/B-2.4.1 | Operatör kararı 18 Ekim 2026: araştırıldı, avukat/mali müşavir turu yok | 18.10.2026 |
| prd-0004 | Affogato Seti - İki Kişilik (kahve, gelato, iki kup, porselen kaşık; tek fiyat) | %20 | karışık set | KDV GUT III/B-1.3; özelge 32094 | Operatör kararı 18 Ekim 2026: araştırıldı, avukat/mali müşavir turu yok | 18.10.2026 |
| prd-0005 | Uji Matcha - Seremoni Sınıfı (yeşil çay tozu) | %10 | 0902.10 | KDV GUT III/B-2.4.1 | Operatör kararı 18 Ekim 2026: araştırıldı, avukat/mali müşavir turu yok | 18.10.2026 |
| prd-0006 | Moka - Bialetti × L'Affogato (alüminyum mutfak eşyası) | %20 | 7615.10 | KDV K. m.28, listelerde yok | Operatör kararı 18 Ekim 2026: araştırıldı, avukat/mali müşavir turu yok | 18.10.2026 |
| prd-0007 | Porselen Fincan Seti | %20 | 6911.10 | KDV K. m.28, listelerde yok | Operatör kararı 18 Ekim 2026: araştırıldı, avukat/mali müşavir turu yok | 18.10.2026 |
| prd-0008 | Bambu Chasen (bambudan mutfak eşyası) | %20 | 4419 | KDV K. m.28, listelerde yok | Operatör kararı 18 Ekim 2026: araştırıldı, avukat/mali müşavir turu yok | 18.10.2026 |
| prd-0009 | Pamuk Önlük (pamuklu kanvas önlük, mesleki giysi; ürünün kendi oranı) | %10 | 6211.42.10 | BKK 2007/13033 (II) liste 5. sıra; özelge 32621 | Operatör kararı 18 Ekim 2026: araştırıldı, avukat/mali müşavir turu yok | 18.10.2026 |
| prd-0010 | Emaye Bardak (vakum yalıtımlı bardak) | %20 | 9617.00 | KDV K. m.28, listelerde yok | Operatör kararı 18 Ekim 2026: araştırıldı, avukat/mali müşavir turu yok | 18.10.2026 |
| prd-0011 | Cantucci - Bronte Pistachio (tatlı bisküvi) | %10 | 1905.31 | KDV GUT III/B-2.4.1 | Operatör kararı 18 Ekim 2026: araştırıldı, avukat/mali müşavir turu yok | 18.10.2026 |

Menünün bütün kalemleri %10, karaoke odası %20, kargo ve kurye ücreti %20.
İleride eklenecek tişört, bez çanta ve her türlü çanta kendi oranıyla %10
((II) sayılı liste 5. ve 8. sıra); gıda ile gıda dışı ürünü tek fiyatla
birleştiren her set %20.

### 16.4 Değişen cümleler ve kod (18 Eki 2026)

**Sürüm.** Ön Bilgilendirme Formu ile Mesafeli Satış Sözleşmesi değiştiği
için `LEGAL_UPDATED` (onayın kaydettiği sürüm, kendi tarihi olmayan her
belgenin "Son güncelleme" satırı) 18 Ekim'den yayım gününe, **19 Ekim
2026**'ya taşındı. Bir İstanbul gününde bu etiketi taşıyan en çok bir PR
birleşir (18 Ekim'i mesafeli satış seti aldı, §18); PR daha geç bir gün
birleşirse etiket o güne çekilir. Karaoke belgesinin sürümü ayrıdır ve
değişmedi.

**Hukuki dayanak (özet).**

- Gıda %10: KDV GUT III/B-2.4.1 (Seri No 51 ile eklenen paragraflar, RG
  27.04.2024, yürürlük 1.5.2024). Kafeterya işletmesinin burada yapılan ya da
  dışarıdan alınan gıdayı içeride ya da dışarıda tüketilmek üzere satışı
  %10; internetten adrese gönderme ve gel-al satışları da aynı mahiyettedir.
  Fazla gösterilen KDV ödenir (KDV K. m.8/2): şüphede yüksek oran vergi
  açısından güvenli taraftır.
- Kargo ayrı %20: KDV K. m.24/a (teslim alanın gösterdiği yere kadar satıcının
  yaptığı taşıma giderleri matraha dahildir) yalnız taşıma malın bedeline
  dahil edilip tek tutar gösterildiğinde malın oranına katılır (özelge
  32558); taşıma ayrıştırılınca ya da dışarıdan hizmet alımıyla yapılınca
  genel oranda vergilenir (özelge 32391, 28945). Ücret ön bilgilendirmede
  ayrıca bildirilir (MSY m.5/1-d).
- Kural yazımı ve toplamın sabitliği: oranları Cumhurbaşkanı belirler (KDV K.
  m.28); vergiyi doğuran olay teslim, nakliyeciye tevdi ya da ondan önce
  kesilen fatura anıdır (m.2/1, m.10). Ödeme ile kargo arasında oran
  değişirse e-Arşiv fatura kargoya verme anındaki oranla, aynı KDV dahil
  toplamla kesilir; sipariş satırındaki oran damgası bilgi amaçlıdır. İadede
  ilk teslimdeki oran kullanılır (KDV GUT III/B-1.2.3).
- Kupon: iskonto ancak aynı faturada gösterilir ve ticari teamüle uygunsa
  matrahtan düşülür (KDV K. m.25/a; GUT III/A-6.1; özelge 31994); önceki
  alışverişlerden kazanılan puan ya da bedava ürün iskonto değildir (özelge
  32079); bedelsiz işlemde matrah emsal bedeldir (m.27/1).

**Değişen cümleler.** Satır numaraları `src/lib/legal/content.ts`'in bu
PR'daki hâline aittir.

| Belge | Satır | Mevcut (18 Eki 2026) | Yeni |
|---|---|---|---|
| Ön Bilgilendirme Formu, 6. fiyat ve vergiler | 268 | "Uygulanan KDV oranı yürürlükteki vergi mevzuatına göre ürünün türüne bağlıdır: kahve çekirdeği, öğütülmüş kahve ve diğer paketli gıda ürünlerinde %1, kafe menüsündeki yiyecek ve içeceklerde %10, ekipman ile gıda dışındaki hediyelik ve marka ürünlerinde %20'dir; gıda içeren hediye kutu ve setlerinde oran, içindeki ürünlere göre belirlenir. Kargo veya kurye bedeli, gönderilen ürünlerin satış bedelinin parçasıdır ve onların KDV oranına tabidir. Her kalemin KDV oranı ve tutarı faturada gösterilir. Vergi oranlarında mevzuat değişikliği olması hâlinde, sipariş tarihinde yürürlükte olan oran uygulanır." | "Uygulanan KDV oranı, yürürlükteki vergi mevzuatına göre her ürünün ve hizmetin tabi olduğu orandır. Kargo veya kurye bedeli faturada ayrı bir kalem olarak gösterilir ve taşıma hizmetinin tabi olduğu oranda KDV içerir. Her kalemin KDV oranı ve tutarı faturada gösterilir. Sipariş özetinde gösterilen KDV dâhil toplam bedel, sonradan vergi oranı değişse de değişmez." (paragrafın ilk cümlesi aynı) |
| Ön Bilgilendirme Formu, tablo "KDV oranı" | 284 | "Ürüne göre %1, %10 veya %20 (fiyatlara dâhil)" | "Ürünün tabi olduğu yasal oran (fiyatlara dâhil, faturada kalem kalem gösterilir)" |
| Mesafeli Satış Sözleşmesi, 4. fiyat | 886 | "... ürünün türüne göre %1, %10 veya %20 oranındaki Katma Değer Vergisi dâhildir (kahve çekirdeği ve paketli gıda ürünlerinde %1, kafe menüsündeki yiyecek ve içeceklerde %10, ekipman ile gıda dışındaki hediyelik ve marka ürünlerinde %20; gıda içeren hediye kutu ve setlerinde içindeki ürünlere göre)." | "... her ürünün yürürlükteki mevzuata göre tabi olduğu oranda Katma Değer Vergisi dâhildir; her kalemin KDV oranı ve tutarı faturada gösterilir." |
| Mesafeli Satış Sözleşmesi, 4. fiyat | 886 | "Vergi oranlarında mevzuat değişikliği olması hâlinde güncel oran uygulanır ve bu durum Site üzerinde gösterilir." | "Sipariş özetinde gösterilen KDV dâhil toplam bedel, sonradan vergi oranı değişse de değişmez." (ÖBF ile çelişki kalktı) |
| Mesafeli Satış Sözleşmesi, tablo "KDV Oranı" | 907 | "Ürüne göre %1, %10 veya %20 (fiyatlara dâhildir)" | "Ürünün tabi olduğu yasal oran (fiyatlara dâhil)" |
| Teslimat ve Kargo, ücretler | 2120 | "Kargo ve teslimat bedeli, gönderilen ürünün satış bedelinin bir parçasıdır ve o ürünün KDV oranına tabidir; farklı oranlı ürünler birlikte gönderildiğinde bedel, ürün tutarlarıyla orantılı olarak paylaştırılır." | "Kargo ve teslimat bedeli faturada ürünlerden ayrı bir kalem olarak gösterilir ve taşıma hizmetinin tabi olduğu oranda KDV içerir." |
| Teslimat ve Kargo, özet tablo | 2147 | "(kargo bedeli, gönderilen ürünün KDV oranına tabidir)" | "(kargo bedeli faturada ayrı kalem olarak gösterilir)" |
| Satış Politikası, 14. fiyatlandırma | 3389 | "... ürünün türüne göre %1, %10 veya %20 oranındaki katma değer vergisi dâhil ..." | "... ürünün tabi olduğu oranda katma değer vergisi dâhil ..." |
| Satış Politikası, 14. fiyatlandırma | 3394 | "Vergi oranlarında mevzuat değişikliği olması hâlinde yeni oran, yürürlüğe girdiği tarihten sonra oluşturulan siparişlere uygulanır; ödemesi tamamlanmış siparişlerin tutarı geriye dönük olarak değiştirilmez." | "Sipariş özetinde gösterilen KDV dâhil toplam bedel, sonradan vergi oranı değişse de değişmez; ödemesi tamamlanmış siparişlerin tutarı geriye dönük olarak değiştirilmez." (aynı çelişki, X-KDV-RATECHANGE: oran sipariş günüyle değil teslimle belirlenir) |
| Satış Politikası, tablo "KDV oranı" | 3417 | "Ürüne göre %1, %10 veya %20 (fiyatlara dâhil)" | "Ürünün tabi olduğu yasal oran (fiyatlara dâhil)" |
| Ödeme Koşulları, 4. fiyatlandırma | 3803 | "... ürünün türüne göre %1, %10 veya %20 oranındaki katma değer vergisi dâhil ..." | "... ürünün tabi olduğu oranda katma değer vergisi dâhil ..." |
| Ödeme Koşulları, 4. fiyatlandırma | 3805 | "Vergi oranlarında mevzuat değişikliği olması hâlinde yeni oran, yürürlüğe girdiği tarihten sonra oluşturulan siparişlere uygulanır; daha önce ödemesi tamamlanmış siparişlerin tutarı geriye dönük olarak değiştirilmez." | "Sipariş özetinde gösterilen KDV dâhil toplam bedel, sonradan vergi oranı değişse de değişmez; daha önce ödemesi tamamlanmış siparişlerin tutarı geriye dönük olarak değiştirilmez." |
| Şirket Bilgileri, fiyatlar | 12721 | "Tüm fiyatlar KDV dahil olarak gösterilir; uygulanan KDV oranı ürüne göre yüzde 1, 10 veya 20'dir" | "Tüm fiyatlar KDV dahil olarak gösterilir; uygulanan KDV oranı ürünün tabi olduğu yasal orandır" |
| Şirket Bilgileri, tablo | 12889 | "Ürüne göre yüzde 1, 10 veya 20 (fiyatlara dahil)" | "Ürünün tabi olduğu yasal oran (fiyatlara dahil)" |
| Şirket Bilgileri, fatura tablosu | 13293 | "Ürüne ve hizmete göre yüzde 1, 10 veya 20" | "Ürünün ve hizmetin tabi olduğu yasal oran" |

Bilerek değişmeyenler: Şikâyet ve Uyuşmazlık Çözümü §11 ("ürün kaydındaki
KDV dahil güncel fiyat, geçerli promosyon kodu veya kupon ve ...") doğru
(Y2-4 c). Karaoke Odası Rezervasyonu belgesi oran saymıyor. Kullanım
Şartları'ndaki "KDV oranı: Gösterilen fiyatlara dâhildir" doğru.

**Kod (aynı deploy).**

- `src/lib/utils/kdv.ts`: `LEGAL_TAX_RATES.beans` ve `.pantry` 10; yeni
  anahtar `shipping` 20 (panelde "Kargo ve kurye ücreti"; kayıtlı satırda
  yoksa 20 okunur). `kdvBreakdown` kargoyu satırlara paylaştırmaz, kendi
  oranında ayrı tutar olarak ekler. `invoiceKdvBreakdown` ödül kuponunu
  matrahtan düşmez (fatura dökümü); `orderKdvBreakdown` ve uygulamanın
  `taxBreakdown`'ı üyenin ödediği tutarın içindeki KDV'dir (satır toplamı =
  `totalMinor`).
- `orders."shippingTaxRatePct"`: sipariş yazılırken kargo oranı damgalanır;
  eski siparişte NULL, 20 okunur (`20261019150100_order_shipping_tax_rate.sql`).
- `20261019150000_cafe_food_rate_10.sql` (bir kez): prd-0003 1 ise 10,
  prd-0009 oransız, merch ve Pamuk Önlük ise 10, `orders.items`'ta 1 damgalı
  her satır 10 (sıra ve toplamlar aynı; satıştaki %1 kaybolmaz: her sipariş
  için bir olay kaydı satırı, `system`, `kdv_rate_corrected`, sipariş no ve
  %1 olan kalemler), `settings."taxRates"`'ta `beans` ve
  `pantry` yalnız 1 ise 10 (eski Vergi sekmesi her alanı eski varsayılanla
  doldurup hepsini kaydediyordu; o 1 de kodundu). Diğer anahtarlar değişmez.
- Panel: Ayarlar > Vergi alanları seçim; ipuçları yukarıdaki kurala göre.
  Sipariş sayfasının KDV tablosu ve sipariş CSV'si ödül kuponlu siparişte
  fatura dökümünü verir ve "Ödül kuponu <kod>: <tutar> ödeme olarak düşülür,
  KDV matrahından düşülmez." yazar.

**Operatöre.**

- Ayarlar > Vergi: "Mağaza: kahve çekirdeği" ve "Mağaza: kiler (gıda)" %10
  mı, kontrol et (OP-01). Migration kayıtlı 1'i bir kez 10'a çeker; başka
  bir değer kayıtlıysa onu ezmez, %10 seç ve kaydet.
- Ürünler: Yenilebilir Kup ve Pamuk Önlük kendi oranı %10 mu, kontrol et
  (migration yalnız kodun yazdığı değeri düzeltir).
- Deploy'dan sonra `GET https://laffogato.net/api/mobile/v1/shop`: prd-0001,
  0002, 0003, 0005, 0009, 0011 `taxRatePct` 10, diğerleri 20 olmalı.
- %1 ile kesilmiş bir fatura ya da kasada %1 departmanıyla satılmış gıda
  varsa mali müşavire ilet (VUK m.371 pişmanlık; OP-31). Faturalar Paraşüt'ten
  kesildiği için (19 Ekim 2026) oranı düzeltilen siparişlerin listesi Olay
  kaydı'nda: Kim "system", Kayıt türü Sipariş, İşlem Güncelleme; siparişin
  Zaman çizelgesi de "KDV oranı %1'den %10'a düzeltildi" yazar.
- e-Arşiv'de: ödül kuponlu ya da kuponun ürünlerin tamamını karşıladığı
  siparişte ürün tam fiyatla, ödeme şekli kupon; kısmi promosyon ve hediye
  kuponunda satır iskontosu. Kargo ve kurye ücreti ayrı %20 satır.
- Uygulamanın çevrimdışı hukuk kopyası (`lafmobil` `src/data/legal.seed.json`)
  `npm run legal:export` ile yenilenmeli (app-legal-seed-kdv-wording) ve
  `docs/API-MOBILE.md` uygulama deposuna bayt bayt kopyalanmalı (RECONCILED).

## 17. Y3 - Masa ve grup rezervasyonu kalktı; rezervasyon yalnız karaoke odası (17 Eki 2026)

> **Durum: metin kodda değişti, avukat okuması bekliyor.**
> Dal `feat/legal-no-table-reservation`. Karaoke odasının ön ödeme, iptal,
> iade ve cayma kuralları değişmedi.

### 17.1 Neden

Operatör kararı (17 Eki 2026, site #132): kafe masa ve grup rezervasyonu
almıyor. Rezervasyon yalnız karaoke odası için yapılır; sitede ve uygulamada
çevrim içi, ön ödemeli. /ziyaret'teki rezervasyon kartı, SSS'teki telefonla
rezervasyon sorusu ve llms.txt satırı #132'de kalktı. Hukuki metinler ise hâlâ
telefonla ve e-postayla masa rezervasyonu, masa tutma süresi, grup
rezervasyonu, minimum harcama, kapora, ücretsiz iptal süreleri ve no-show
kaydı vaat ediyordu.

### 17.2 Sürüm ve onay

- Ödeme onayındaki iki belge (Ön Bilgilendirme Formu, Mesafeli Satış
  Sözleşmesi) değişmedi. `LEGAL_UPDATED` zaten 17 Ekim 2026 (§16). Aynı gün
  yapılan değişiklik bu revizyonun içinde kalır; belgelere ayrı tarih
  verilmedi (tarih yalnız revizyondan sonraki bir günde değişen belgeye
  verilir, `tests/legal-dates.test.ts`). Değişen belgelerin "Son güncelleme"
  satırı zaten 17 Ekim 2026.
- Karaoke belgesinde tek cümle değişti (§1: masa rezervasyonuna ve eski
  başlığa atıf). Belgenin kendi sürümü olduğu için `KARAOKE_LEGAL_UPDATED`
  ve belgenin tarihi 16'dan 17 Ekim 2026'ya taşındı. Bundan sonraki karaoke
  rezervasyonlarının onayı 17 Ekim 2026'yı kaydeder; önceki rezervasyonların
  kaydı olduğu gibi kalır. Yeniden onay akışı yok: onay her rezervasyonda
  ödemeden önce alınır.
- Üyelik onayı sürüm kaydetmez; ticari ileti onayının metin sürümü
  (`ticari-elektronik-ileti@17 Ekim 2026`) değişmedi.
- Uygulamanın çevrimdışı kopyası lafmobil'de `legal:export` ve
  `scripts/legal-split.js` ile yenilenir (ayrı PR, site PR'ından sonra).

### 17.3 Kafe Hizmet Koşulları: yapı

- Başlık "Kafe Hizmet ve Rezervasyon Koşulları" yerine "Kafe Hizmet
  Koşulları"; adres `/hukuk/kafe-hizmet-kosullari` aynı. Başlık ayrıca Satış
  Politikası, Şirket Bilgileri (iki yer), Karaoke belgesi §1 ve
  `public/llms-full.txt`'te değişti; /hukuk dizini ve uygulama başlığı
  belgeden okur. Footer bu belgeyi listelemiyor; e-postalarda geçmiyor.
- Eski §5-§9 (telefon ve e-postayla masa rezervasyonu, masa tutma süresi,
  grup rezervasyonu, minimum harcama, ön ödeme, iptal, no-show) yerine tek
  madde: "5. Karaoke Odası Rezervasyonu". İçindeki karaoke cümleleri eski §5
  ve §8'den aynen geldi, yalnız masa atıfları çıktı: kanallar, 30 dakikalık
  ön kayıt, ödemeyle kesinleşme, üyeliksiz rezervasyon, talep modu, veri
  cümlesi, ret ve ayrımcılık yasağı, 2 saat kuralı ve gelmeme, MSY m.15/1-g,
  işletme iptalinde tam iade (3 gün bildirim, 14 gün iade), tablo satırları.
- Eski §8 ve §9'daki etkinlik korumaları (süresinde yapılmayan iptalde ve
  katılmamada yalnız gerçek zararın mahsubu, kalem bazında açıklama, zarar
  yoksa tam iade, cezai şart yok) etkinlik maddesine (yeni §6) tek paragraf
  olarak taşındı.
- Eski §10-§27 artık §6-§23. İç atıflar: §1 "5, 8 ve 9" yerine "5"; "11, 12
  ve 14" yerine "7, 8 ve 10"; §4 "8. madde" yerine "5. ve 6. maddeler";
  rehber hayvan atfı "16" yerine "12". Diğer belgeler bu belgenin madde
  numarasına atıf yapmıyor.
- Bilerek değişmeyenler: §22 şikâyet ("Hizmete, rezervasyona ...") ve delil
  ("rezervasyon kayıtları"), §23 sürüm geçişi ("Önceden onaylanmış ve
  yürürlükteki rezervasyonlara, rezervasyonun onaylandığı tarihte yürürlükte
  olan sürüm uygulanır"). Üçü karaoke için doğru; sonuncusu bugüne kadar
  telefonla onaylanmış masa rezervasyonlarını eski metinde tutar. KVKK
  Aydınlatma Metni'nde karaoke işleme amacının hukuki sebebi ("KVKK m.5/2-c:
  Rezervasyona ilişkin sözleşmenin kurulması ...") karaoke satırıdır, kaldı.

### 17.4 Değişen cümleler

Satır numaraları `src/lib/legal/content.ts`'in bu PR'daki hâline aittir.

| Belge | Satır | Mevcut | Yeni |
|---|---|---|---|
| İptal, İade ve Cayma, istisna örneği | 1462 | "Örnek: köşkte belirli gün ve saate ayrılan masa rezervasyonu veya karaoke odası rezervasyonu, tarihli barista atölyesi ..." | "Örnek: köşkte belirli gün ve saate ayrılan karaoke odası rezervasyonu, tarihli barista atölyesi ..." |
| İptal, İade ve Cayma, §21 başlığı | 1799 | "21. Rezervasyon, Atölye ve Etkinlik Katılımlarının İptali; Karaoke Odası Rezervasyonu" | "21. Atölye ve Etkinlik Katılımlarının İptali; Karaoke Odası Rezervasyonu" |
| İptal, İade ve Cayma, §21 | 1802 | "... köşkte masa rezervasyonu, karaoke odası rezervasyonu, barista atölyesi ve tadım etkinliği gibi ..." | "... köşkte karaoke odası rezervasyonu, barista atölyesi ve tadım etkinliği gibi ..." |
| İptal, İade ve Cayma, §21 | 1809 | "... katılım sağlanmayan rezervasyonlarda ..." | "... katılım sağlanmayan etkinlik kayıtlarında ..." |
| Satış Politikası | 3360 | "Sitede kafe siparişi, paket servis veya masa rezervasyonu hizmeti sunulmamaktadır. ... Kafe Hizmet ve Rezervasyon Koşulları'nda düzenlenir ..." | "Sitede kafe siparişi veya paket servis hizmeti sunulmamaktadır. ... Kafe Hizmet Koşulları'nda düzenlenir ..." |
| Ödeme Koşulları | 3746 | "...; masa rezervasyonu, grup rezervasyonu, atölye ve etkinlikler için çevrim içi kapora veya ön ödeme alınmaz." | "...; atölye ve etkinlikler için çevrim içi kapora veya ön ödeme alınmaz." |
| Gizlilik Politikası | 4989 | "... işletmede yapılan satın alma ve rezervasyon işlemleri, masa/paket sipariş kayıtları ..." | "... işletmede yapılan satın alma işlemleri, masa/paket sipariş kayıtları ..." (masa siparişi QR ile masaya sipariştir, kaldı; karaoke verisi kendi satırında) |
| KVKK Aydınlatma, ilgili kişi | 5758 | "Kafe ziyaretçisi: ... fiziki işletmeye gelen, masa/rezervasyon talebi ileten, kafe içi ödeme yapan ..." | "Kafe ziyaretçisi: ... fiziki işletmeye gelen, karaoke odası rezervasyonu yapan, kafe içi ödeme yapan ..." |
| KVKK Aydınlatma, veri kategorisi | 5778 | "... (girişte bildirim levhası bulunan alanlarda), rezervasyon/masa talebi kapsamında ad ve telefon numarası, kafe içi satış fişine ..." | "... (girişte bildirim levhası bulunan alanlarda), kafe içi satış fişine ..." (karaoke verisi: 5785, değişmedi) |
| KVKK Aydınlatma, toplama yöntemi | 5971 | "Fiziki kanallar: Kafede doldurulan rezervasyon/etkinlik formları, ..." | "Fiziki kanallar: Kafede doldurulan etkinlik formları, ..." |
| Kullanım Şartları, tanım | 9763 | "... belirli gün ve saat için ayrılması; masa rezervasyonları ise yalnızca telefonla alınır." | "... belirli gün ve saat için ayrılması." |
| Kullanım Şartları, §15 | 10005 | "Kesinti sırasında iletilen rezervasyon talepleri, teyit edilmedikçe geçerli sayılmaz." | "Kesinti sırasında iletilen karaoke odası rezervasyon talepleri, teyit edilmedikçe geçerli sayılmaz." |
| Şirket Bilgileri, kafe | 12674 | "Kafe içi hizmet, rezervasyon, grup ziyareti ve işletme kuralları /hukuk/kafe-hizmet-kosullari adresindeki Kafe Hizmet ve Rezervasyon Koşulları belgesinde düzenlenmiştir; ..." | "Kafe içi hizmet ve işletme kuralları /hukuk/kafe-hizmet-kosullari adresindeki Kafe Hizmet Koşulları belgesinde, karaoke odası rezervasyonu /hukuk/karaoke-odasi-rezervasyon adresindeki Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'nde düzenlenmiştir; ..." |
| Şirket Bilgileri, tablo | 12706 | "Rezervasyon ve etkinlik iletişimi" | "Karaoke rezervasyonu ve etkinlik iletişimi" |
| Şirket Bilgileri, belge listesi | 13057 | "Kafe Hizmet ve Rezervasyon Koşulları" | "Kafe Hizmet Koşulları" |
| Karaoke belgesi, §1 (`content-karaoke.ts`) | 46 | "Kafede yerinde sunulan yiyecek-içecek hizmeti ve masa rezervasyonu bu belgenin değil Kafe Hizmet ve Rezervasyon Koşulları'nın konusudur." | "Kafede yerinde sunulan yiyecek-içecek hizmeti bu belgenin değil Kafe Hizmet Koşulları'nın konusudur." |
| Kafe Hizmet, başlık | 14107 | "Kafe Hizmet ve Rezervasyon Koşulları" | "Kafe Hizmet Koşulları" |
| Kafe Hizmet, özet | 14111 | "... yiyecek-içecek hizmetine, masa rezervasyonuna, karaoke odası rezervasyonuna, ..." | "... yiyecek-içecek hizmetine, karaoke odası rezervasyonuna, ..." |
| Kafe Hizmet, §1 | 14140 | "İşbu Kafe Hizmet ve Rezervasyon Koşulları ... yiyecek-içecek hizmetine, masa rezervasyonuna, karaoke odası rezervasyonuna, ..." | "İşbu Kafe Hizmet Koşulları ... yiyecek-içecek hizmetine, karaoke odası rezervasyonuna, ..." |
| Kafe Hizmet, §1 | 14142 | "... yiyecek-içecek hizmeti alan, masa rezervasyonu talebinde bulunan, işletmede düzenlenen ..." | "... yiyecek-içecek hizmeti alan, işletmede düzenlenen ..." |
| Kafe Hizmet, §1 | 14143 | "... yerinde sunulan hizmete, masa rezervasyonuna, karaoke odası rezervasyonuna, ... bu Koşulların 5, 8 ve 9. maddelerindeki karaoke hükümlerinde ... işbu Koşulların 11, 12 ve 14. maddeleri uygulanır" | "... yerinde sunulan hizmete, karaoke odası rezervasyonuna, ... bu Koşulların 5. maddesindeki karaoke hükümlerinde ... işbu Koşulların 7, 8 ve 10. maddeleri uygulanır" |
| Kafe Hizmet, §2 | 14155 | "Rezervasyon: Belirli bir tarih ve saat aralığı için, belirli sayıda kişi adına masa tahsis edilmesine yönelik talep ve bu talebin İşletme tarafından onaylanması." | "Rezervasyon: Karaoke odasının belirli bir gün ve saat aralığı için ayrılması." |
| Kafe Hizmet, §2 | 14156 | "Rezervasyon Onayı: İşletmenin, talebi kabul ettiğini tarih, saat, kişi sayısı ve varsa özel koşulları belirterek elektronik posta, telefon veya (karaoke odası talepleri için) mobil uygulamadaki bildirim kutusu yoluyla bildirdiği teyit." | "Rezervasyon Onayı: Talep olarak iletilen karaoke odası rezervasyonunu İşletmenin kabul ettiğini tarih, saat ve kişi sayısını belirterek elektronik posta ve mobil uygulamadaki bildirim kutusu yoluyla bildirdiği teyit. Çevrim içi ödenen rezervasyon ise ödemenin onaylanmasıyla kendiliğinden kesinleşir." |
| Kafe Hizmet, §2 | - | Tanımlar: "Masa Tutma Toleransı", "No-Show", "Grup Rezervasyonu", "Minimum Harcama" | Silindi |
| Kafe Hizmet, §2 | 14158 | "Ön Ödeme (Kapora): Grup rezervasyonu veya özel etkinlik için, rezervasyonun kesinleşmesi amacıyla ..." | "Ön Ödeme (Kapora): Özel etkinlik için, katılımın kesinleşmesi amacıyla ..." |
| Kafe Hizmet, §3 | 14174 | "İşletme, bu kısıtları rezervasyon aşamasında şeffaf biçimde bildirmeyi ..." | "İşletme, bu kısıtları talep hâlinde şeffaf biçimde bildirmeyi ..." |
| Kafe Hizmet, §4 | 14237 | "... ilgili tarihe ait onaylı rezervasyonlar için Misafirlere ... bilgi verilir; alınmış ön ödeme varsa 8. maddede düzenlenen esaslara göre iade edilir ..." | "... ilgili tarihe ait karaoke odası rezervasyonları ve etkinlik kayıtları için Misafirlere ... bilgi verilir; alınmış ödeme varsa 5. ve 6. maddelerde düzenlenen esaslara göre iade edilir ..." |
| Kafe Hizmet, §4 | 14244 | "Geçici kapanışlarda onaylı rezervasyon sahiplerine {{PHONE}} ... bilgi verilir." | "Geçici kapanışlarda karaoke odası rezervasyonu veya etkinlik kaydı bulunan Misafirlere {{PHONE}} ... bilgi verilir." |
| Kafe Hizmet, §5 başlığı | 14248 | "5. Rezervasyon Talebi, Onayı ve Doğrulanması" | "5. Karaoke Odası Rezervasyonu" |
| Kafe Hizmet, §5 | 14250 | (yok) | "İşletmede masa ve grup rezervasyonu alınmaz. Rezervasyon yalnızca karaoke odası için yapılır; karaoke odası rezervasyonuna bu madde ile Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi uygulanır." |
| Kafe Hizmet, §5 | 14251 | "Karaoke odası, masa rezervasyonundan ayrı olarak, {{BRAND}} mobil uygulaması ... iptal, iade ve gelmeme kuralları 8. maddede ve Karaoke Odası ... düzenlenmiştir. Bu Koşulların grup rezervasyonu, minimum harcama ve ön ödeme hükümleri (7. madde) masa rezervasyonlarına ilişkindir ve karaoke odası rezervasyonları bakımından uygulanmaz." | "Karaoke odası, {{BRAND}} mobil uygulaması ... iptal, iade ve gelmeme kuralları bu maddede ve Karaoke Odası ... düzenlenmiştir." (arası aynen) |
| Kafe Hizmet, §5 | 14253 | "İşletme, doluluk, masa kapasitesi, personel durumu, ..." | "İşletme, doluluk, personel durumu, ..." |
| Kafe Hizmet, §5 (eski §8) | 14254 | "Karaoke odası rezervasyonunda iptal ve iade kuralı bunlardan ayrıdır ve şudur: ..." | "Karaoke odası rezervasyonunda iptal ve iade kuralı şudur: ..." (2 saat kuralı, gelmeme, MSY m.15/1-g aynen) |
| Kafe Hizmet, eski §5 | - | "Masa rezervasyonu; {{PHONE}} ... veya {{EMAIL}} ... talep edilebilir ...", "Rezervasyon, talebin İşletme tarafından açıkça onaylanmasıyla kurulur ...", "Rezervasyonlar, onayda belirtilen kişi adına ...", altı adımlı rezervasyon listesi | Silindi (karaoke onayı ve ödemeyle kesinleşme 14251'de zaten var) |
| Kafe Hizmet, eski §6 | - | Masa tutma toleransı (15 dakika), gecikme, masa kullanım süresi, masa tercihi, bahçe masası (5 paragraf) | Silindi |
| Kafe Hizmet, eski §7 | - | Grup rezervasyonu (8 kişi), minimum harcama, ön ödeme, kişi sayısı azalması (5 paragraf, 5 madde imi) | Silindi |
| Kafe Hizmet, eski §8 | - | Masa 2 saat ücretsiz iptal, grup 48 saat, etkinlik atfı, "iptal teyitle hüküm ifade eder", işletme kaynaklı iptalde tüm ön ödemelerin iadesi; tablo: "Standart masa rezervasyonu", "Grup rezervasyonu", "Özel etkinlik / tasting - iptal" | Silindi; karaoke paragrafları ve karaoke, iptal kanalları, işletme kaynaklı iade süresi satırları §5'e taşındı |
| Kafe Hizmet, eski §9 | - | No-show kaydı, tekrarlanan no-show, mazeret, no-show kayıtlarının saklanması | Silindi; etkinlik cümlesi §6'ya taşındı |
| Kafe Hizmet, §6 (eski §10) | 14279 | (eski §8 ve §9'da) "Süresinde yapılmayan iptallerde ... gerçek maliyeti ön ödemeden mahsup edilebilir ... cezai şart uygulanmaz." ve "Ön ödeme alınmış grup rezervasyonları ile özel etkinliklerde no-show hâlinde ..." | "Süresinde yapılmayan iptallerde ve etkinliğe katılınmadığında, İşletmenin o kayıt için fiilen yaptığı ve başka şekilde değerlendiremediği hazırlık giderleri ön ödemeden mahsup edilebilir. Mahsup edilen tutar, her hâlükârda İşletmenin fiilen uğradığı zararla sınırlıdır ve talep hâlinde Misafire kalem bazında yazılı olarak açıklanır; kalan tutar iade edilir. Zararın gerçekleşmediği veya belgelenemediği hâllerde ön ödemenin tamamı iade edilir. Götürü nitelikte, zarara bağlı olmayan cezai şart uygulanmaz." |
| Kafe Hizmet, §8 (eski §12) | 14336 | "Grup rezervasyonu ve özel etkinlik ön ödemeleri ile masa rezervasyonları için çevrim içi ödeme alınmaz." | "Özel etkinlik ön ödemeleri için çevrim içi ödeme alınmaz." |
| Kafe Hizmet, §12 (eski §16) | 14473 | "... bu talebinizi rezervasyon aşamasında bildirmeniz, uygun masanın ayrılabilmesi için gereklidir." | "... bu talebinizi geldiğinizde personele bildirmeniz, uygun masanın ayrılabilmesi için gereklidir." |
| Kafe Hizmet, §13 (eski §17) | 14484 | "Mama sandalyesi, bebek bezi değiştirme imkânı gibi talepleriniz rezervasyon aşamasında bildirilmesi hâlinde, mevcut imkânlar ölçüsünde ..." | "Mama sandalyesi, bebek bezi değiştirme imkânı gibi talepleriniz, mevcut imkânlar ölçüsünde ..." |
| Kafe Hizmet, §20 (eski §24) | 14581 | "... bu hususu rezervasyon aşamasında {{PHONE}} numarasından bildirmeniz rica olunur." | "... bu hususu ziyaretinizden önce {{PHONE}} numarasından bildirmeniz rica olunur." |
| Kafe Hizmet, §20 | 14583 | "... 16. maddede belirtildiği üzere ..." | "... 12. maddede belirtildiği üzere ..." |

### 17.5 Avukata sorular

> Y3-2, Y3-3, Y3-4 ve Y3-6 19 Ekim 2026'da avukat turu olmadan karara
> bağlandı (operatör kararı, 18 Eki 2026): §17.6.

| # | Soru | Neden |
|---|---|---|
| Y3-1 | Başlık "Kafe Hizmet Koşulları" oldu, adres aynı kaldı. Uygun mu? | Belgede rezervasyon olarak yalnız karaoke kaldı; karaokenin kendi sözleşmesi var. |
| Y3-2 | Karaoke kuralları hem Kafe Hizmet Koşulları §5'te (özet) hem karaoke sözleşmesinde duruyor; karaoke sözleşmesi §1 "iptal, iade ve gelmeme kuralları yalnız bu belgeyle belirlenir" diyor. §5 bir atfa indirilsin mi? | İki yerde aynı kural, ileride ayrışma riski. |
| Y3-3 | Etkinlik iptali iki belgede farklı: Kafe Hizmet §6 tablosu 7 gün / 72 saat, İptal, İade ve Cayma §21 48 / 24 saat. Hangisi geçerli? (Bu PR'dan önce de böyleydi.) | Tüketici lehine olan uygulanır; metin tek olmalı. |
| Y3-4 | Eski §8'deki "iptal ve değişiklik talepleriniz İşletme tarafından teyit edildiği anda hüküm ifade eder" cümlesi kalktı. Karaoke iptalinin zamanı artık yalnız karaoke sözleşmesine bağlı (kendi kendine iptal anında; telefonla iptal). Telefonla iptal için ayrı kural gerekir mi? | 2 saat sınırında telefonla iptalin anı. |
| Y3-5 | Bugüne kadar telefonla onaylanmış ileri tarihli masa rezervasyonu varsa §23 (sürüm geçişi) onları eski metinde tutar. Operatör bunları tek tek arayıp teyit etmeli mi? | Geçiş dönemi. |
| Y3-6 | Erişim (§20) ve evcil hayvan (§12) cümleleri "ziyaretinizden önce telefonla bildirin, erişimi en kolay masa ayrılabilir" diyor. Bu bir rezervasyon vaadi sayılır mı? | Rezervasyon yok, ama makul düzenleme kalmalı (5378 s. Kanun). |
| Y3-7 | KVKK'da "Kafe ziyaretçisi" grubu "karaoke odası rezervasyonu yapan" kişiyi de sayıyor; üyeliksiz karaoke rezervasyonu yapanlar ayrı bir ilgili kişi grubu olarak yazılsın mı? | Veri kategorisi zaten ayrı ("Üye ve üyeliksiz rezervasyon yapan kişi"). |

### 17.6 Y3 kararları: karaoke kuralları tek belgede, etkinlik iptali tek kuralda, işletme iptali nedenli, talep usulü kalktı (19 Eki 2026)

> **Durum: metin kodda değişti.** Dal `feat/legal-karaoke-terms`.
> Operatör kararı (18 Eki 2026): avukat turu yok; §17.5'teki Y3-2, Y3-3,
> Y3-4 ve Y3-6 aşağıdaki dayanaklarla karara bağlandı. Aynı dal 3b'nin hukuk
> düzeltmelerini de taşır (0 saat, son an, %0 ya da %100, ön ödeme kilidi).

**Sürüm.** Karaoke belgesi değişti (§7, §8, §10): `KARAOKE_LEGAL_UPDATED`
ve belgenin tarihi 17 Ekim'den 19 Ekim 2026'ya taşındı; bundan sonraki
karaoke onayları 19 Ekim 2026'yı kaydeder. Kafe Hizmet Koşulları, İptal,
İade ve Cayma Hakkı, Kişisel Veri Saklama ve İmha Politikası ve Kullanım
Şartları kendi tarihini (19 Ekim 2026) aldı (`tests/legal-dates.test.ts`).
Ödeme onayındaki iki belge değişmedi, `LEGAL_UPDATED` 18 Ekim 2026'da kaldı.
Aynı İstanbul gününde `KARAOKE_LEGAL_UPDATED`'i taşıyan ikinci bir PR
birleştirilmez (D-SAME-DAY). Uygulamanın çevrimdışı kopyası lafmobil'de
yenilenir (ayrı PR).

**Kararlar.**

- Y3-2: Kafe Hizmet §5'teki karaoke özeti kalktı. Karaoke odasının bedel,
  ödeme, kesinleşme, cayma, iptal, iade, gelmeme ve işletme iptali kuralları
  yalnız Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet
  Sözleşmesi'nde durur; Kafe §1, §4, §5, İptal İade ve Cayma §21 ve Veri
  Saklama tablosu ona atıf yapar. "Götürü bir koşul" nitelendirmesi silindi,
  yerine "cezai şart değildir" yazılmadı.
- Y3-3: Etkinlik iptali tek kural, İptal İade ve Cayma §21'de: başlangıçtan
  en az 48 saat önce tam iade; 48 saatten az, en az 24 saat kala (tam 24
  saat dâhil) tam iade ya da başka tarihe aktarım; 24 saatten az kala ve
  katılmamada yalnız belgeli hazırlık gideri düşülür, gider yoksa tam iade;
  devir başlangıca kadar ücretsiz; işletme iptalinde seçim misafirin. Süreler
  başlangıç saatinden sayılır. Mevcut kayıtlara da uygulanır (lehe). Kafe §6
  atıf yapar; eski 7 gün / 72 saat tablosu ve mahsup paragrafı kalktı.
- Y3-4: Karaoke §7'ye iptal anı maddesi: telefonda görüşme anı, yanıtlanmayan
  aramada telefonda görünen arama saati (aynı gün teyitle), e-postada
  gönderme anı. Tam son an (varsayılan kuralda tam 2 saat kala) süresinde
  sayılır; kod son anı ve sayfaların yazdığı dakikanın tamamını süreye sayar
  (`karaokeFreeCancelEnd`, #166). Panelde "Misafir iptal istedi" nedeni kanal ve
  istek anıyla kaydedilir, rezervasyonun kendi kuralı istek anına göre
  uygulanır.
- Y3-6: Kafe §20 erişim bildirimi masa rezervasyonu değildir; erişimi en
  kolay masa bildirilen geliş saatinden 15 dakika tutulur, doluysa ilk
  boşalan uygun masa verilir; notta ad ve geliş saati dışında bir şey
  yazılmaz, not ertesi gün imha edilir. §5'e "Bu kural, 20. maddede
  düzenlenen erişim ihtiyacına yönelik ön bildirimi kapsamaz." eklendi.
- ASK-OTH-3: Karaoke §8: işletme yalnız haklı sebeple iptal eder; bildirim
  öğrenir öğrenmez ve en geç 3 gün içinde, rezervasyon saatinden önce;
  24 saatten az kalmışsa ve telefon kayıtlıysa ayrıca arama; iade bildirimden
  en geç 14 gün içinde karta, iptalle birlikte başlatılır; süreler her
  nedende uygulanır; tazminat hakları saklı. §7'ye geç iptal ve gelmemede
  tam kaybı sınırlayan koşullar yazıldı (rezervasyon misafirin adına durur,
  kod devredilebilir, saat başkasına verilirse tamamı iade). Telafi cümlesi
  (OP-KARAOKE-GOODWILL) panel işiyle birlikte gelir (karaoke-make-good-and-resale).
- ASK-OTH-3-CFG: Karaoke §7 ve §10 saat ve yüzde yazmaz; rezervasyon
  özetinde gösterilen son ücretsiz iptal anına ve geç iptal tutarına atıf
  yapar. Böylece panelden yayımlanan bir düzenleme eski rakamlarla kalıp bir
  rezervasyonun kendi kuralıyla çelişemez. Onay e-postası son ücretsiz iptal
  anını ayrıca yazar. "ve ekindeki belgede" ifadesi e-posta eki (ASK-DURABLE)
  yayına girdiği PR'da eklenir; o güne kadar ek yok.
- OP-KARAOKE-PREPAY: Talep usulünü anlatan iki cümle (Kafe §5, Kullanım
  Şartları tanım) kalktı: ödeme alamayan eski uygulama sürümü rezervasyon
  yapamaz, güncelleme ister. Panel ön ödemenin kapatılmasını reddeder;
  kilitten önce kapalı kaydedilmiş değer de açık okunur (`getSettings`).

**Değişen cümleler.** Satır numaraları `src/lib/legal/content.ts`'in bu
PR'daki hâline aittir (karaoke belgesi: `content-karaoke.ts`).

| Belge | Satır | Mevcut | Yeni |
|---|---|---|---|
| Kafe Hizmet, §1 | 14125 | "Rezervasyon talebinde bulunulması, rezervasyon onayının kabul edilmesi, mobil uygulamadan kafe siparişi verilmesi veya işletmede hizmet alınması işbu Koşulların okunduğu ve kabul edildiği anlamına gelir." | "Bu Koşulları işletme girişinde ve {{SITE_URL}}/hukuk/kafe-hizmet-kosullari adresinde inceleyebilirsiniz." |
| Kafe Hizmet, §1 | 14126 | "... iptal, iade ve gelmeme kuralları yalnızca Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'nde ve bu Koşulların 5. maddesindeki karaoke hükümlerinde düzenlenir." | "... iptal, iade ve gelmeme kuralları yalnızca Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'nde düzenlenir." |
| Kafe Hizmet, §4 | 14220 | "... alınmış ödeme varsa 5. ve 6. maddelerde düzenlenen esaslara göre iade edilir ..." | "... alınmış ödeme varsa Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi ile 6. maddede düzenlenen esaslara göre iade edilir ..." |
| Kafe Hizmet, §5 | 14233 | "İşletmede masa ve grup rezervasyonu alınmaz. Rezervasyon yalnızca karaoke odası için yapılır; karaoke odası rezervasyonuna bu madde ile Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi uygulanır." | "İşletmede masa ve grup rezervasyonu alınmaz. Bu kural, 20. maddede düzenlenen erişim ihtiyacına yönelik ön bildirimi kapsamaz. Rezervasyon yalnızca karaoke odası için yapılır; karaoke odası rezervasyonuna Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi uygulanır, bu madde yalnızca rezervasyon kanallarını açıklar." |
| Kafe Hizmet, §5 | 14234 | "Çevrim içi ödeme geçici olarak kapalıysa veya rezervasyon mobil uygulamanın eski bir sürümünden verilirse rezervasyon yalnızca talep olarak iletilir; bu hâlde üyelik girişi ve doğrulanmış bir e-posta adresi gerekir, talep İşletme personeli onaylayana kadar yalnızca bir taleptir, onay veya iptal kararı e-posta ve uygulamadaki bildirim kutusu ile bildirilir ve bedel işletmede ödenir." | "Mobil uygulamanın ödeme alamayan eski bir sürümünden rezervasyon yapılamaz; bu durumda uygulamanızı güncellemeniz istenir." |
| Kafe Hizmet, §5 | 14234 | "Karaoke odası rezervasyonunun iptal, iade ve gelmeme kuralları bu maddede ve Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'nde düzenlenmiştir." | "Karaoke odası rezervasyonunun bedeli, ödemesi, kesinleşmesi, cayma hakkının bulunmaması, iptal, iade ve gelmeme kuralları ile İşletmenin rezervasyonu karşılayamaması hâlinde yapılacak iade yalnızca, rezervasyon sırasında onayladığınız Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'nde (/hukuk/karaoke-odasi-rezervasyon) düzenlenir." |
| Kafe Hizmet, §5 | 14235 | "Rezervasyon talebi sırasında ad-soyad, iletişim telefonu ve elektronik posta adresi istenir." | "Rezervasyon sırasında ad-soyad ve elektronik posta adresi, internet sitesinden yapılan rezervasyonlarda ayrıca cep telefonu istenir." (uygulama üyesinin rezervasyonunda telefon yok: `karaoke-core.ts`) |
| Kafe Hizmet, §5 | - | "Karaoke odası rezervasyonunda iptal ve iade kuralı şudur: Rezervasyon saatine 2 saatten fazla varken ... Karaoke odasında 2 saatten az kala yapılan iptallerde ve gelinmediğinde iade yapılmaması, hizmet bedelinin iade edilmediği götürü bir koşuldur; ... (Mesafeli Sözleşmeler Yönetmeliği m.15/1-g)." | Silindi |
| Kafe Hizmet, §5 | - | "Karaoke odası rezervasyonunu işletme karşılayamazsa ödediğiniz tutarın tamamı iade edilir. Durumu öğrendiğimiz tarihten itibaren en geç 3 gün içinde ..." | Silindi (karaoke §8'de) |
| Kafe Hizmet, §5 tablosu | - | "Karaoke odası - iptal ve iade", "İptal kanalları", "İşletme kaynaklı iptalde iade süresi" | Tablo silindi |
| Kafe Hizmet, §6 | 14242 | "Program içeriği, süresi, kontenjanı, kişi başı bedeli ve iptal koşulları duyuru metninde ve katılım onayında ayrı ayrı belirtilir." | "Program içeriği, süresi, kontenjanı ve kişi başı bedeli duyuru metninde ve katılım onayında belirtilir; iptal ve iade esasları İptal, İade ve Cayma Hakkı metninin 21. maddesindedir." |
| Kafe Hizmet, §6 | 14244 | "İşbu maddede ve katılım onayında belirlenen süreler içinde yapılan iptallerde ödediğiniz bedel, aşağıdaki esaslara göre iade edilir." | "İptallerde ödediğiniz bedel, İptal, İade ve Cayma Hakkı metninin 21. maddesindeki süre ve esaslara göre iade edilir." |
| Kafe Hizmet, §6 | - | "Süresinde yapılmayan iptallerde ve etkinliğe katılınmadığında, ... Götürü nitelikte, zarara bağlı olmayan cezai şart uygulanmaz." | Silindi (aynı kural İptal İade ve Cayma §21'de) |
| Kafe Hizmet, §6 | 14246 | "Katılımcı değişikliği, etkinlik tarihinden en az yirmi dört (24) saat önce yazılı olarak bildirilmesi kaydıyla ücretsiz yapılabilir." | "Katılımcı değişikliği, etkinlik başlangıcından önce yazılı olarak (elektronik posta dâhil) bildirilmesi kaydıyla ücretsiz yapılabilir." |
| Kafe Hizmet, §6 tablosu | 14251 | "Etkinlik iptali - 7 gün ve daha önce bildirim", "Etkinlik iptali - 72 saat ile 7 gün arası bildirim", "Etkinlik iptali - 72 saatten kısa süre kala bildirim", "Katılımcı değişikliği" (dört satır) | "Etkinlik iptali ve katılımcı devri: Süreler ve iade esasları İptal, İade ve Cayma Hakkı metninin 21. maddesindedir; katılım onayında lehinize farklı bir koşul yazıyorsa o uygulanır." ("İşletme kaynaklı iptal" ve "Cayma hakkı" satırları kaldı) |
| Kafe Hizmet, §20 | 14535 | "Tekerlekli sandalye kullanımı, ... bu hususu ziyaretinizden önce {{PHONE}} numarasından bildirmeniz rica olunur. Böylece erişimi en kolay masa tahsis edilebilir ve personel önceden hazırlık yapabilir." | "Tekerlekli sandalye kullanımı, refakatçi ihtiyacı, işitme veya görme engeline ilişkin özel bir düzenleme gereksiniminiz varsa bunu ziyaretinizden önce {{PHONE}} numarasından bildirmenizi rica ederiz. Bu bildirim bir masa rezervasyonu değildir; erişim ihtiyacınıza yönelik makul düzenleme olarak erişimi en kolay masayı bildirdiğiniz geliş saatinden itibaren 15 dakika boyunca sizin için boş tutar, masa o sırada doluysa ilk boşalan uygun masayı size ayırır ve personelimizi önceden hazırlarız. Bildiriminiz için yalnızca adınızı ve geliş saatinizi not alırız; notta bildiriminizin nedenini ve sağlık durumunuza ilişkin hiçbir ayrıntıyı yazmayız ve bu notu ziyaretinizin ertesi günü imha ederiz. Önceden bildirmeden gelirseniz de erişimi en kolay boş masayı size gösterir, gereken desteği sağlarız." |
| İptal, İade ve Cayma, §21 | 1808 | "Karaoke odası rezervasyonu bundan ayrıdır: ... Bu hizmette de cayma hakkı yoktur (...); bunun yerine sözleşmeyle şu koşul tanınır. Rezervasyon saatine 2 saatten fazla varken ... Karaoke iadeleri her zaman ödenen tutarın tamamıdır, kısmi iade yapılmaz ... ayrıntılar Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'ndedir." | "Karaoke odası rezervasyonu bundan ayrıdır: ödemesi rezervasyon sırasında PayNkolay üzerinden çevrim içi alınır, rezervasyon ödemenin onaylanmasıyla kesinleşir ve bu hizmette de cayma hakkı yoktur (Mesafeli Sözleşmeler Yönetmeliği m.15/1-g). Karaoke odası rezervasyonunun iptal, iade ve gelmeme kuralları yalnızca Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'nde düzenlenir; bu belgenin aşağıdaki 48 ve 24 saatlik iptal ve devir kolaylıkları karaoke odası rezervasyonuna uygulanmaz." |
| İptal, İade ve Cayma, §21 | 1812 | "Etkinlik tarihinden en az 48 saat önce iletilen iptal taleplerinde ödenen bedelin tamamı iade edilir." | "Etkinliğin başlangıç saatinden en az 48 saat önce iletilen iptal taleplerinde ödenen bedelin tamamı iade edilir." |
| İptal, İade ve Cayma, §21 | 1813 | "Etkinlik tarihine 24-48 saat kala iletilen iptallerde, tercihinize göre ..." | "Etkinliğin başlangıç saatine 48 saatten az, en az 24 saat kala (tam 24 saat dâhil) iletilen iptallerde, tercihinize göre ödenen bedelin tamamı iade edilir veya katılım hakkınız kontenjan bulunan başka bir tarihe aktarılır." |
| İptal, İade ve Cayma, §21 | 1814 | "Etkinlik tarihine 24 saatten az kalan iptallerde ve katılım sağlanmayan etkinlik kayıtlarında, hazırlık ve tahsis edilen kontenjan nedeniyle bedel iadesi yapılamaz; ancak katılım hakkınızı bir başkasına devredebilirsiniz." | "Etkinliğin başlangıç saatine 24 saatten az kala yapılan iptallerde ve katılım sağlanmayan etkinlik kayıtlarında, Satıcı'nın o kayıt için fiilen yaptığı ve başka şekilde değerlendiremediği hazırlık giderleri ödenen bedelden düşülür ve kalan tutar iade edilir; düşülen tutar talep hâlinde kalem kalem yazılı olarak açıklanır, böyle bir gider yoksa veya belgelenemiyorsa bedelin tamamı iade edilir. Dilerseniz katılım hakkınızı ücretsiz olarak bir başkasına devredebilirsiniz." |
| İptal, İade ve Cayma, §21 | 1816 | "Etkinliğin Satıcı tarafından iptal edilmesi veya tarihinin değiştirilmesi hâlinde bedelin tamamı iade edilir veya tercihiniz doğrultusunda yeni tarihe aktarılır; bu tercih size aittir." | "Etkinliğin Satıcı tarafından iptal edilmesi veya tarihinin değiştirilmesi hâlinde, tercihinize göre katılım hakkınız yeni tarihe aktarılır, eşdeğer bir etkinliğe katılımınız sağlanır ya da ödediğiniz bedelin tamamı en geç 14 gün içinde iade edilir; bu tercih size aittir." |
| Veri Saklama, karaoke satırı | 7815 | "... ileri tarihli rezervasyonlar iptal edilir; saatine 2 saatten fazla olan ödenmiş rezervasyonların tutarı karta iade edilir, 2 saatten az kalanlarda ise iade yapılmaz ve rezervasyon olduğu gibi kalır; kayıtlarda ad silinir ..." | "... ileri tarihli rezervasyonlar iptal edilir; ödenmiş rezervasyonların iadesi Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'nin 10. maddesine göre yapılır; kayıtlarda ad silinir ..." |
| Kullanım Şartları, tanım | 9727 | "Çevrim içi ödeme geçici olarak kapalıysa veya Mobil Uygulamanın eski bir sürümünden verilirse rezervasyon yalnızca talep olarak iletilir ve Şirket onaylamadıkça kesinleşmez; onay e-posta ve Mobil Uygulamadaki bildirim listesi ile iletilir." | "Mobil Uygulamanın ödeme alamayan eski bir sürümünden rezervasyon yapılamaz; bu durumda uygulamanın güncellenmesi istenir." |
| Karaoke, §7 madde 1 | 105 | "Rezervasyon saatine 2 saatten fazla varken iptal ederseniz ödediğiniz tutarın tamamı kartınıza iade edilir. İptali ... kendiniz yapabilir ya da bizi arayarak yaptırabilirsiniz." | "Rezervasyon özetinde gösterilen son ücretsiz iptal anına kadar (bu an dâhil) iptal ederseniz ödediğiniz tutarın tamamı kartınıza iade edilir. İptali hesabınızdaki Karaoke rezervasyonlarım bölümünden, e-postanızdaki kişiye özel bağlantıdan ya da mobil uygulamadan kendiniz yapabilir ya da bizi arayarak veya {{EMAIL}} adresine yazarak yaptırabilirsiniz." |
| Karaoke, §7 madde 2 | 106 | (yok) | "Bizi arayarak yaptırdığınız iptalde görüşmenin yapıldığı an, e-postayla bildirdiğiniz iptalde e-postanızın gönderildiği an iptal anı sayılır. Aramanız yanıtlanamazsa telefonumuzda görünen arama saatiniz iptal anı sayılır; bu durumda iptal isteğinizi aynı gün e-postayla ya da yeniden arayarak iletmeniz yeterlidir. Telefonla verdiğiniz iptal isteğini aynı gün e-postayla teyit ederiz." |
| Karaoke, §7 madde 3-6 | 107-110 | "Rezervasyon saatine 2 saatten az kala yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz." | "Bu andan sonra, rezervasyon saati gelmeden yapılan iptallerde özette geç iptal için gösterilen tutar iade edilir; iptal ettiğiniz saat başka bir misafire satılırsa o saat için sizde kalan tutar da iade edilir." / "Özette geç iptalde iade gösterilmiyorsa bu andan sonra ücret iadesi yapılmaz ve rezervasyon sizin adınıza durur; gelemeyecekseniz rezervasyon kodunuzu bir başkasına verebilirsiniz. Gelemeyeceğinizi ve kodunuzu kimseye vermediğinizi bize bildirirseniz odayı o saat için başka bir misafire verebiliriz." / "Rezervasyona gelinmediğinde ücret iadesi yapılmaz; gelmediğiniz ya da iptal edemediğiniz bir saati başka bir misafire verirsek ödediğiniz tutarın tamamını iade ederiz." / "Son ücretsiz iptal anı ve geç iptalde iade edilecek tutar rezervasyon onay e-postanızda da yazılıdır. Rezervasyonunuza ödemeden önce onayladığınız süre ve iade tutarı uygulanır; bunlarda sonradan yapılan değişiklikler rezervasyonunuzu etkilemez." |
| Karaoke, §8 | 118 | "Rezervasyonunuzu arıza, geçici kapanış, mücbir sebep veya başka bir nedenle karşılayamazsak, Mesafeli Sözleşmeler Yönetmeliği m.16/4 uyarınca durumu öğrendiğimiz tarihten itibaren en geç 3 gün içinde size e-postayla bildiririz ve ödediğiniz tutarın tamamını bildirimden itibaren en geç 14 gün içinde ödemeyi yaptığınız karta iade ederiz. İade, iptalle birlikte PayNkolay üzerinden hemen başlatılır." | "Rezervasyonunuzu yalnızca haklı bir sebeple (oda veya ekipman arızası, köşkün geçici olarak kapanması, mücbir sebep veya benzeri haklı bir sebep) iptal ederiz. Bu durumda size durumu öğrenir öğrenmez ve en geç 3 gün içinde e-postayla bildiririz; durumu rezervasyon saatinden önce öğrenmişsek bildirimi rezervasyon saatinden önce yapar, rezervasyonunuza 24 saatten az kalmışsa ve telefon numaranız kayıtlıysa ayrıca sizi ararız. Ödediğiniz tutarın tamamını bildirimden itibaren en geç 14 gün içinde ödemeyi yaptığınız karta iade ederiz; iade, iptalle birlikte PayNkolay üzerinden hemen başlatılır. Bu süreler Mesafeli Sözleşmeler Yönetmeliği m.16/4'teki en uzun sürelerdir ve iptalin her nedeninde uygulanır. Kanundan doğan tazminat haklarınız saklıdır." |
| Karaoke, §10 | 131 | "Hesabınızı kapatırsanız gelecek tarihli karaoke rezervasyonlarınız iptal edilir; rezervasyon saatine 2 saatten fazla olan ödenmiş rezervasyonların tutarının tamamı ... Rezervasyon saatine 2 saatten az kalan ödenmiş rezervasyonlar için 7. maddedeki kural geçerlidir: ücret iadesi yapılmaz ve rezervasyon olduğu gibi kalır. ..." | "Hesabınızı kapatırsanız gelecek tarihli karaoke rezervasyonlarınız iptal edilir. Rezervasyon özetinde gösterilen son ücretsiz iptal anına kadar (bu an dâhil) kapatılan hesaplarda ödenmiş rezervasyonların tutarının tamamı ödemenin yapıldığı karta iade edilir; iade o anda tamamlanamazsa İşletme iadeyi en geç 14 gün içinde ayrıca yapar. Bu andan sonra kapatılan hesaplarda 7. maddedeki geç iptal kuralı uygulanır; geç iptalde iade gösterilmeyen rezervasyon olduğu gibi kalır. Hesabınızın kapatılmasını bizden talep ederseniz bu süreler talebinizin kaydedildiği ana göre hesaplanır. Üye olmadan, yalnız aynı e-posta adresiyle yapılmış rezervasyonlar hesabın kapatılmasından etkilenmez." |

**Panel ve e-posta (metin değil, davranış).** Karaoke §7 ve §8'in söz
verdiklerini kod yapar:

- Ödenmiş rezervasyonun personel iptalinde neden sabit listeden seçilir:
  arıza, kapanış, mücbir sebep, işletmeden kaynaklanan başka bir sebep,
  misafir iptal istedi, saat başka misafire verildi
  (`src/lib/mobile/karaoke-cancel-cause.ts`). Kod, kanal ve istek anı
  denetim kaydına yazılır; personelin notu e-postaya gitmez. İşletme
  nedenlerinde e-posta nedeni ve özrü yazar, tamamının iade edildiğini
  söyler; iptal anında çıkar (MSY m.16/4 yazılı bildirim). Rezervasyona 24
  saatten az kalmışsa ve telefon kayıtlıysa panel "Rezervasyona 24 saatten
  az kaldı: misafiri ara." der.
- "Misafir iptal istedi": kanal (telefon, e-posta) ve istek anı (köşk saati;
  ileri bir an ve rezervasyondan önceki bir an reddedilir) zorunlu.
  Rezervasyonun kendi kuralı istek anına göre uygulanır: süre içindeyse tam
  iade ve "İsteğin üzerine" e-postası; süre geçmiş ve geç iptalde iade yoksa
  rezervasyon iptal edilmez, `late_guest_request` kaydı ve "rezervasyonun
  senin adına duruyor" e-postası; iade yetkisi olan kişi "Yine de tamamını
  iade et" diyebilir. İstek rezervasyon saati geldikten sonra geldiyse
  e-postadaki kural cümlesi "Rezervasyon saatin gelmişti; saati gelmiş bir
  rezervasyonda ücret iadesi yapılmaz." olur (geç iptal payı yalnız saatten
  önceki iptallere uygulanır, §7). Akşam bittikten sonra kaydedilen istek
  (misafir ertesi sabah arar) yalnız `late_guest_request` kaydına girer
  (`ended: true`), e-posta gitmez (karar D7) ve panel bunu söyler. Köşkün onaylamadığı ödenmiş rezervasyon
  (saat başka onaylı rezervasyonda, onay yarım kaldı) hiç söz verilmemiş
  sayılır: istek ne zaman gelmiş olursa olsun tamamı iade edilir (MSY m.16/4,
  TBK m.136). Panel istek anını pencere açıldığı an olarak doldurur, sayfanın
  çizildiği an olarak değil (`karaokeRequestDefault`).
- Onay e-postası son ücretsiz iptal anını yazar ("Son ücretsiz iptal: 30
  Ekim 2026, 18:00.", §7). Süre rezervasyon yapılırken zaten geçmişse geçmiş
  bir an yazmaz, "rezervasyonu yaptığın sırada süresi geçmişti, her iptal geç
  iptal sayılır" der (web özeti gibi).
- Geçmiş rezervasyonun sayfası "Faturalanacak tutar (KDV %20 dahil)" satırını
  gösterir: ödenen eksi iade edilen (ASK-KAR-KDV; KDV K. m.10, VUK m.231/5).

**Bilerek değişmeyenler.**

- Kafe Hizmet §2 "Misafir" tanımındaki "rezervasyon talebinde bulunan" ve §5
  "İşletme, ... rezervasyon talebini kabul etmeme hakkını saklı tutar"
  paragrafı: talep usulünü değil genel bir talebi anlatır, karar metni
  ikisini de korur.
- Karaoke §9 ("kısmi iade yapılmaz"): panel yalnız %0 ya da %100 kabul
  ettiği sürece doğru. %1-99 açıldığı gün §9 karaoke-make-good-and-resale
  PR'ında değişir.
- Ödeme Koşulları ve Hesap Silme metinlerindeki "2 saat" cümleleri: her
  rezervasyon 2 saat / %0 ile yapıldığı sürece doğru (uygulama kilidi,
  `KARAOKE_POLICY_APP_VERSION` null); kilit açılmadan önce yeniden yazılır
  (`tests/karaoke-cancel-policy-doc.test.ts`).
- Kafe §6 "İşletme kaynaklı iptal" ve "Cayma hakkı" tablo satırları: §21 ile
  aynı seçenekleri yazar.

**Hukuki dayanak.**

- TBK m.21/1, m.23; TKHK m.5/4; Haksız Şartlar Yönetmeliği m.6/3: aynı kural
  iki belgede iki farklı biçimde durursa düzenleyen aleyhine yorumlanır;
  misafirin onayladığı tek belge karaoke sözleşmesidir (MSY m.5/2). Kafe
  koşullarının yalnız işletmeye girmekle kabul edilmiş sayılması da genel
  işlem koşulu olarak yazılmamış sayılırdı (TBK m.21/1): yerine metnin nerede
  görülebileceği yazıldı.
- TKHK m.4/2, m.5/4; TBK m.182/3; Haksız Şartlar Yön. EK-1 (d); MSY
  m.15/1-g: etkinlik iptalinde lehe okuma tek kural oldu, kesinti fiilî
  zararla sınırlı.
- TBK m.4/2 (kıyasen), TKHK m.48/4, MSY m.11/1 ve m.20/1: telefonla iptal
  görüşme anında, e-postayla iptal gönderme anında hüküm doğurur; istek anı
  ve kanalı kayda geçer. Tam son an süresinde sayılır (TKHK m.5/4).
- MSY m.16/4; Haksız Şartlar Yön. m.5/4, EK-1 (ç), (d), (e); TBK m.112,
  m.136, m.325/2 (kıyasen): işletme iptali haklı sebebe bağlı, 3 gün bildirim
  ve 14 gün iade her nedende; geç iptalde tam kayıp kod devri ve yeniden
  satışta tam iadeyle sınırlı.
- 5378 s. Kanun m.3/1-j, m.4/A; 6701 s. Kanun m.4/1-f, m.5; KVKK m.4/2-ç,
  m.6: erişim bildirimi makul düzenlemedir, sağlık verisi işlenmez.
- MSY m.4/1-e, m.5/1, m.7/1; TKHK m.48/2: ön bilgi ve sözleşme onayı
  alınmayan talep usulü kalktı.

## 18. Y4 - Mesafeli satış 2026: 14 gün iade, ücretsiz iade kargosu, arabuluculuk, yalnız Türkiye (18 Eki 2026)

> **Durum: metin kodda değişti.** Dal `feat/legal-distance-sales-2026`.
> Avukat turu yok: operatör kararı (18 Eki 2026) _"avukata sorma sen karar
> ver, araştır ve doğru olanı yap"_. Kararlar ve dayanakları aşağıda; her
> değişen cümle eski ve yeni hâliyle §18.3'te.

### 18.1 Neden ve dayanak

Mesafeli Sözleşmeler Yönetmeliği (MSY) 24.05.2025 tarihli ve 32909 sayılı
Resmî Gazete'deki değişiklikle yeniden yazıldı; geçici m.1 uyarınca değişen
m.5/1-g, m.12 ve m.13/1 1 Ocak 2026'dan beri uygulanıyor. Metinler eski
kuralı anlatıyordu ve mağazanın yapmadığı şeyleri (KKTC ve yurt dışına
gönderim) vaat ediyordu. Birincil kaynaklar (mevzuat.gov.tr, 18 Eki 2026):

- **MSY m.13/1:** tüketici malı cayma bildiriminden itibaren **on dört gün**
  içinde geri gönderir (eskiden on gün).
- **MSY m.12/5 ve m.5/1-g:** ön bilgilendirme satıcının iade için öngördüğü
  taşıyıcıyı söyler; satıcı taşıyıcı belirtmediyse tüketiciden iade
  masrafına ilişkin hiçbir bedel istenemez.
- **MSY m.12/1, m.12/4, m.14/1:** teslim masrafı dahil tahsil edilen bütün
  ödemeler, tüketiciye masraf yüklenmeden tek seferde iade edilir; kısmi
  iadede sonradan kargo bedeli kesmek bu kurala aykırıdır.
- **MSY m.13/2:** tüketici malı işleyişine, teknik özelliklerine ve kullanım
  talimatlarına uygun kullanmasından doğan değişiklik ve bozulmalardan
  sorumlu değildir. "Yeniden satılabilirlik", kutu ve fatura şartı ve
  kullanılmış ürünü "kabul etmemek" bu sınırı aşar (TKHK m.48/4, MSY m.9/1).
- **MSY m.15/1-c, ç:** istisnalar dar yorumlanır: kapalı kutudaki yenilebilir
  waffle kup ve kapalı paketteki kavrulmuş kahve "çabuk bozulabilen" değildir;
  ambalajı açılınca sağlık ve hijyen istisnasına girer.
- **MSY m.5/1-k ve TKHK m.73/A** (7251 s. Kanun m.59 ile eklendi): tüketici
  mahkemesinde dava açmadan önce arabulucuya başvurmak dava şartıdır; tüketici
  hakem heyetinin görevine giren uyuşmazlıklar bunun dışındadır.
- **MSY m.6/2-b:** teslimata ilişkin kısıtlar siparişten önce söylenir. Ödeme
  formunda ülke yok; mağaza yalnız Türkiye içine gönderiyor.
- **Elektronik Ticaret Aracı Hizmet Sağlayıcı ve Elektronik Ticaret Hizmet
  Sağlayıcılar Hakkında Yönetmelik** (RG 29.12.2022, 32058) m.34, metinlerin
  andığı 2015 tarihli yönetmeliği (RG 26.08.2015, 29457) yürürlükten kaldırdı.
- **MSY m.5/2:** ön bilgilendirme sözleşmenin parçasıdır; ÖBF §1 tek sayfalık
  ödeme akışını olduğu gibi anlatır.

### 18.2 Kararlar

| Karar | Ne | Neden |
|---|---|---|
| ASK-OTH-2 (3) | Malı geri gönderme süresi 14 gün; kutu ve fatura istenmez; ölçüt MSY m.13/2; İade ve Cayma §8'deki "Kabul edilmez" listesi ve "satılabilirlik ölçütü" kalkar; hediye ürün iade edilmezse mahsup "güncel liste bedeli" değil siparişteki satış fiyatıdır | Alıcı aldığından fazlasını geri ödemez |
| ASK-OTH-2 (4), OP-RETURN-CARRIER | ÖBF'de iade taşıyıcısı adlandırılmaz; iade kargo bedeli hiçbir hâlde istenmez: iade kodu ücretsiz, başka kargoyla gönderilen iadenin belgeli bedeli geri ödenir, karşı ödemeli iade teslim alınır, kısmi iadede kargo kesilmez, yol riski satıcıdadır | Geliver her gönderide firmayı ayrı seçtiği için tek firma adı doğru olmazdı (m.12/5) |
| ASK-OTH-2 (5) | Çabuk bozulabilen ürün: gelato ve soğuk zincir gerektiren diğer ürünler; açılmış yenilebilir kup kutusu hijyen istisnasına; İade ve Cayma §7'deki "ambalajı açılmamış olsa dahi" waffle kupa maddesi kalkar, §17 ve Teslimat ve Kargo §9 kapalı kutudaki waffle kupu istisnadan çıkarır | m.15 dar yorumlanır |
| X-MEDIATION | ÖBF §21 ve MSS §19 arabuluculuk şartını söyler | m.5/1-k, TKHK m.73/A |
| X-TERRITORY | KKTC ve yurt dışı satırları, gümrük paragrafları ve Teslimat ve Kargo §16 kalkar; §16 "Teslimat Bölgesi" olur (numara korunur) | Yapılmayan gönderim vaat edilmez (m.6/2-b) |
| X-ETHS-TITLE | Yönetmeliğin adı 32 yerde (23 belge) güncel adla | 2015 yönetmeliği mülga |
| X-OBF-FLOW | ÖBF §1: "ALICI bu formu onaylamadıkça sipariş verilemez ve ödeme alınmaz." | Tek sayfalık ödeme: ayrı bir "ödeme adımı" yok |
| X-LEGAL-VERSIONS (geçici) | Ödeme onayı e-postası ve üye sipariş sayfası bağlantıları "kalıcı veri saklayıcısı" diye anmaz; "bağlantılar belgelerin güncel metnini açar" der | Bağlantı güncel metni açar, onaylanan sürümü değil (MSY m.4/1-c); kalıcı kopya ayrı PR (legal-versions-durable-copy) |

`LEGAL_UPDATED` 17 Ekim'den **18 Ekim 2026**'ya taşındı (ÖBF ve MSS
değişti; günde tek böyle PR, D-SAME-DAY). `content.ts`'teki 25 belgenin
hepsi aynı gün değiştiği için (yönetmelik adı 23'ünde, kayıtlı kart metni
Hesap Silme ve Kafe Hizmet Koşulları'nda, §19) belgelerin kendi tarihleri
kalktı; set yeniden tek tarih taşır. Karaoke belgesinin sürümü ayrıdır ve
değişmedi.

### 18.3 Değişen cümleler

Yönetmelik adı (her yerde aynı değişiklik, tabloda tekrar edilmedi):
"Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında
Yönetmelik" yerine "Elektronik Ticaret Aracı Hizmet Sağlayıcı ve Elektronik
Ticaret Hizmet Sağlayıcılar Hakkında Yönetmelik"; 32 yer, 23 belge (Hesap
Silme ve Kafe Hizmet Koşulları bu yönetmeliği anmıyor).

Paragraf uzunsa yalnız değişen cümleler gösterilir.

| Belge | Bölüm | Mevcut (17 Eki 2026) | Yeni |
|---|---|---|---|
| Ön Bilgilendirme Formu | 1. Formun Amacı, Konusu ve Hukuki Niteliği | ALICI bu formu onaylamadığı sürece sipariş süreci tamamlanamaz ve ödeme adımına geçilemez. | ALICI bu formu onaylamadıkça sipariş verilemez ve ödeme alınmaz. |
| Ön Bilgilendirme Formu | 12. Cayma Hakkının Kullanılamayacağı Hâller | Çabuk bozulabilen veya son kullanma tarihi geçebilecek gıda ürünleri: yenilebilir waffle kupa, gelato kiti, soğuk zincir gerektiren ürünler ve benzeri. | Çabuk bozulabilen veya son kullanma tarihi cayma ve iade süreleri içinde geçebilecek gıda ürünleri: gelato ve soğuk zincir gerektiren diğer ürünler (Affogato Seti'ndeki gelato dahil). |
| Ön Bilgilendirme Formu | 12. Cayma Hakkının Kullanılamayacağı Hâller | Tesliminden sonra ambalajı, bandı, mührü veya koruyucu folyosu açılmış olan ve iadesi sağlık/hijyen açısından uygun olmayan ürünler: açılmış kahve paketleri, açılmış pistacchio kreması ve şuruplar, ağızla temas eden ekipman parçaları. | Tesliminden sonra ambalajı, bandı, mührü veya koruyucu folyosu açılmış olan ve iadesi sağlık/hijyen açısından uygun olmayan ürünler: açılmış kahve paketleri, açılmış yenilebilir kup kutusu, açılmış pistacchio kreması ve şuruplar, ağızla temas eden ekipman parçaları. |
| Ön Bilgilendirme Formu | 13. Cayma Sonrası İade Usulü, İade Kargo Masrafı ve Geri Ödeme | ALICI, cayma bildirimini yaptığı tarihten itibaren 10 (on) gün içinde malı SATICI'ya veya SATICI'nın yetkilendirdiği kişiye geri göndermekle yükümlüdür. Malın, faturası, kutusu, standart aksesuarları ve varsa hediye ürünleriyle birlikte, ticari değerini yitirmeden ve yeniden satılabilirliğini engellemeyecek şekilde iade edilmesi gerekir. Ürünün ALICI'nın malın niteliğine ve işleyişine uygun olmayan kullanımından kaynaklanan değer kaybından ALICI sorumludur; olağan muayene ve deneme kapsamındaki kullanım bu nitelikte sayılmaz. | ALICI, cayma bildirimini yaptığı tarihten itibaren 14 (on dört) gün içinde malı SATICI'ya veya SATICI'nın yetkilendirdiği kişiye geri göndermekle yükümlüdür. ALICI malı, standart aksesuarları ve varsa kampanya kapsamında verilen hediye ürünleriyle birlikte geri gönderir; faturanın geri gönderilmesi gerekmez. ALICI, cayma süresi içinde malı işleyişine, teknik özelliklerine ve kullanım talimatlarına uygun şekilde kullanması sonucu oluşan değişiklik ve bozulmalardan sorumlu değildir; yalnız bunun dışındaki kullanımdan doğan değer kaybından sorumludur. |
| Ön Bilgilendirme Formu | 13. Cayma Sonrası İade Usulü, İade Kargo Masrafı ve Geri Ödeme | İade gönderisinin hangi kargo firmasıyla ve hangi kodla yapılacağı, cayma bildirimi SATICI'ya ulaştığında ALICI'ya e-posta ile bildirilir. ALICI iadeyi bildirilen kargo firması ile ve verilen iade kodu ile gönderdiğinde iade kargo bedeli SATICI tarafından karşılanır. ALICI'nın bildirilen kargo firması yerine başka bir firmayı tercih etmesi hâlinde, aradaki fark ALICI'ya ait olur. Ürünün ayıplı olması, yanlış ürün gönderilmesi veya kargoda hasar görmesi hâllerinde iade kargo bedeli her hâlükârda SATICI'ya aittir. | İade kodu, cayma bildirimi SATICI'ya ulaştığında ALICI'ya e-posta ile bildirilir. Bu formda iade için bir taşıyıcı adlandırılmadığından iade kargo bedeli ALICI'dan talep edilmez: iade koduyla yapılan gönderinin bedelini SATICI öder; ALICI iadeyi başka bir kargo firmasıyla gönderirse belgelediği gönderim bedeli SATICI tarafından ALICI'ya geri ödenir ve karşı ödemeli gönderilen iadeler de teslim alınır. Ürünün ayıplı olması, yanlış ürün gönderilmesi veya kargoda hasar görmesi hâllerinde de iade kargo bedeli SATICI'ya aittir. ALICI'nın belgelediği gönderim bedeli, ürün bedelinin iadesinden ayrı olarak ve belgenin SATICI'ya ulaşmasından itibaren 14 (on dört) gün içinde, ALICI'nın kendi adına kayıtlı olarak bildireceği banka hesabına havale veya EFT ile ödenir; karta yapılan iade karttan tahsil edilen tutarı aşamadığından bu bedel karta iade edilmez. |
| Ön Bilgilendirme Formu | 13. Cayma Sonrası İade Usulü, İade Kargo Masrafı ve Geri Ödeme | Cayma bildiriminden itibaren 10 gün | Cayma bildiriminden itibaren 14 gün |
| Ön Bilgilendirme Formu | 13. Cayma Sonrası İade Usulü, İade Kargo Masrafı ve Geri Ödeme | Kargo firması ve iade kodu cayma bildiriminden sonra e-posta ile bildirilir; iade kodu ile gönderimde iade kargo bedeli SATICI'ya aittir | İade kodu cayma bildiriminden sonra e-posta ile bildirilir; iade kargo bedeli ALICI'dan talep edilmez |
| Ön Bilgilendirme Formu | 21. Şikâyet, İtiraz ve Uyuşmazlıkların Çözümü | SATICI ile çözülemeyen uyuşmazlıklarda ALICI, 6502 sayılı Tüketicinin Korunması Hakkında Kanun uyarınca, her yıl Ticaret Bakanlığınca yeniden değerleme oranında güncellenen parasal sınırlar çerçevesinde; kendi yerleşim yerindeki veya tüketici işleminin yapıldığı yerdeki İlçe/İl Tüketici Hakem Heyetine ya da Tüketici Mahkemesine başvurabilir. | SATICI ile çözülemeyen uyuşmazlıklarda ALICI, her yıl Ticaret Bakanlığınca ilan edilen parasal sınırlar içinde yerleşim yerindeki veya tüketici işleminin yapıldığı yerdeki tüketici hakem heyetine; bu sınırların üzerindeki uyuşmazlıklarda ise 6502 sayılı Kanun'un 73/A maddesi uyarınca dava açmadan önce arabulucuya başvurmak şartıyla tüketici mahkemesine başvurabilir. |
| Mesafeli Satış Sözleşmesi | 10. Teslimat, Kargo ve Teslim Şartları | Kafe siparişlerine işbu maddenin kargo firmasına, kargo takip numarasına, kargo ücretine ve yurt dışı teslimata ilişkin hükümleri uygulanmaz; kurye ücreti sipariş özetinde ayrıca gösterilir. | Kafe siparişlerine işbu maddenin kargo firmasına, kargo takip numarasına ve kargo ücretine ilişkin hükümleri uygulanmaz; kurye ücreti sipariş özetinde ayrıca gösterilir. |
| Mesafeli Satış Sözleşmesi | 10. Teslimat, Kargo ve Teslim Şartları | Teslimat adresinin Türkiye Cumhuriyeti sınırları dışında olması hâlinde, varış ülkesinde doğabilecek gümrük vergileri, harçlar, ithalat kısıtlamaları ve benzeri yükümlülükler ALICI'nın sorumluluğundadır. Gıda ürünlerinin bazı ülkelere girişinin yasak veya izne tabi olması nedeniyle gümrükte imha veya iade edilmesi hâlinde SATICI sorumlu tutulamaz. | (silindi) |
| Mesafeli Satış Sözleşmesi | 11. Cayma Hakkı | ALICI, cayma hakkını kullandığına ilişkin bildirimi yönelttiği tarihten itibaren 10 (on) gün içinde malı SATICI'ya veya SATICI'nın yetkilendirdiği kişiye geri göndermekle yükümlüdür. | ALICI, cayma hakkını kullandığına ilişkin bildirimi yönelttiği tarihten itibaren 14 (on dört) gün içinde malı SATICI'ya veya SATICI'nın yetkilendirdiği kişiye geri göndermekle yükümlüdür. |
| Mesafeli Satış Sözleşmesi | 11. Cayma Hakkı | Cayma hakkının kullanılması hâlinde iade gönderimi, Ön Bilgilendirme Formu'nda belirtilen anlaşmalı kargo firması ile yapıldığında iade kargo bedeli SATICI tarafından karşılanır ve ALICI'dan hiçbir masraf talep edilmez. Ön Bilgilendirme Formu'nda iade için herhangi bir taşıyıcı belirtilmemiş olması ya da belirtilen taşıyıcının ALICI'nın bulunduğu yerde şubesi bulunmaması hâlinde de iade masrafı ALICI'dan talep edilemez. Yalnızca, iade için anlaşmalı taşıyıcı usulüne uygun şekilde bildirilmiş ve erişilebilir olduğu hâlde ALICI'nın kendi tercihiyle başka bir taşıyıcıyı kullanması durumunda, aradaki masraf farkı ALICI'ya ait olur. | Cayma hakkının kullanılması hâlinde iade kargo bedeli ALICI'dan talep edilmez. Ön Bilgilendirme Formu'nda iade için bir taşıyıcı adlandırılmamıştır; SATICI cayma bildirimi üzerine ALICI'ya e-posta ile bir iade kodu gönderir ve bu kodla yapılan gönderinin bedelini öder. ALICI iadeyi başka bir kargo firmasıyla gönderirse belgelediği gönderim bedeli SATICI tarafından geri ödenir; karşı ödemeli gönderilen iadeler de teslim alınır. ALICI'nın belgelediği gönderim bedeli, ürün bedelinin iadesinden ayrı olarak ve belgenin SATICI'ya ulaşmasından itibaren 14 (on dört) gün içinde, ALICI'nın kendi adına kayıtlı olarak bildireceği banka hesabına havale veya EFT ile ödenir; karta yapılan iade karttan tahsil edilen tutarı aşamadığından bu bedel karta iade edilmez. |
| Mesafeli Satış Sözleşmesi | 11. Cayma Hakkı | ALICI, cayma süresi içinde malı, işleyişine, teknik özelliklerine ve kullanım talimatlarına uygun bir şekilde kullanmakla yükümlüdür. Bu çerçevede yapılan olağan muayene ve deneme sınırlarının aşılması sonucu malın değerinde meydana gelen değişiklikten ALICI sorumludur. Malın olağan kullanımı sonucu oluşan değer kaybı ise ALICI'ya yüklenemez. | ALICI, cayma süresi içinde malı işleyişine, teknik özelliklerine ve kullanım talimatlarına uygun şekilde kullanması sonucu meydana gelen değişiklik ve bozulmalardan sorumlu değildir; yalnız bu çerçevenin dışındaki kullanımdan doğan değer kaybından sorumludur. |
| Mesafeli Satış Sözleşmesi | 11. Cayma Hakkı | İade edilen mal; kutusu, ambalajı, varsa standart aksesuarları ve hediye ürünleri ile birlikte, eksiksiz ve hasarsız olarak gönderilmelidir. Promosyon veya kampanya kapsamında verilen hediye ürünün iade edilmemesi hâlinde, hediyenin güncel liste bedeli iade tutarından mahsup edilebilir. | İade edilen mal, varsa standart aksesuarları ve kampanya kapsamında verilen hediye ürünleriyle birlikte gönderilir. Promosyon veya kampanya kapsamında verilen hediye ürünün iade edilmemesi hâlinde, hediyenin sipariş tarihindeki satış fiyatı iade tutarından mahsup edilebilir. |
| Mesafeli Satış Sözleşmesi | 11. Cayma Hakkı | Kampanya eşiğine (örneğin ücretsiz kargo limitine) bağlı olarak yapılan alışverişlerde kısmi iade sonucu sepet tutarının eşiğin altına düşmesi hâlinde, kampanya kapsamında karşılanmış olan kargo bedeli iade tutarından mahsup edilebilir. Bu husus sipariş öncesinde Ön Bilgilendirme Formu'nda ALICI'ya bildirilir. | Kampanya eşiğine (örneğin ücretsiz kargo limitine) bağlı olarak yapılan alışverişlerde kısmi iade sonucu sepet tutarı eşiğin altına düşse de iade tutarından kargo bedeli mahsup edilmez ve ALICI'dan sonradan kargo bedeli istenmez. |
| Mesafeli Satış Sözleşmesi | 12. Cayma Hakkının Kullanılamayacağı Haller | Çabuk bozulabilen veya son kullanma tarihi geçebilecek mallar; örneğin gelato kiti bileşenleri, taze kavrulmuş kahve ve soğuk zincir gerektiren ürünler. | Çabuk bozulabilen veya son kullanma tarihi cayma ve iade süreleri içinde geçebilecek mallar; örneğin gelato ve soğuk zincir gerektiren diğer ürünler. |
| Mesafeli Satış Sözleşmesi | 19. Şikâyet, Uyuşmazlık Çözümü ve Tüketici Hakem Heyeti | Uyuşmazlığın taraflarca sulh yoluyla veya arabuluculuk kurumu aracılığıyla çözümlenmesi hususunda Tarafların anlaşma hakkı saklı olup, bu yollara başvurulması ALICI'nın tüketici hakem heyetine veya tüketici mahkemesine başvurma hakkını ortadan kaldırmaz. | Tüketici mahkemesinde dava açmadan önce arabulucuya başvurmak 6502 sayılı Kanun'un 73/A maddesi uyarınca zorunludur; tüketici hakem heyetinin görevine giren uyuşmazlıklarda bu şart aranmaz. |
| İptal, İade ve Cayma Hakkı | 5. Cayma Hakkının Kullanılması: Adım Adım Prosedür | Bu yanıt, İade Onay Kodu'nu, iade adresini ve iade gönderisinin hangi kargo firmasıyla ve hangi kodla yapılacağını içerir. | Bu yanıt, İade Onay Kodu'nu, iade adresini ve iade gönderisi için iade kodunu içerir. |
| İptal, İade ve Cayma Hakkı | 5. Cayma Hakkının Kullanılması: Adım Adım Prosedür | Ürünü, aksesuarlarını, hediye olarak gönderilen tamamlayıcı kalemlerini, kullanım kılavuzunu, garanti belgesini ve varsa orijinal kutusunu eksiksiz biçimde toplayın. Orijinal kutu ambalajın kendisi ürünün bir parçası olduğundan üzerine kargo bandı yapıştırmayın, üzerine yazı yazmayın. | Ürünü, standart aksesuarlarını ve varsa kampanya kapsamında gönderilen hediye ürünleri bir araya getirin; kutusunun, kullanım kılavuzunun, garanti belgesinin veya faturanın gönderilmesi gerekmez. Ürünü orijinal kutusuyla gönderecekseniz kutunun üzerine kargo bandı yapıştırmamanızı ve yazı yazmamanızı öneririz. |
| İptal, İade ve Cayma Hakkı | 5. Cayma Hakkının Kullanılması: Adım Adım Prosedür | İade gönderisinin hangi kargo firmasıyla ve hangi kodla yapılacağı Satıcı'nın yanıtında bildirilir; cayma hâlinde bu usulle yapılan iade gönderisinin bedeli Satıcı'ya aittir. İade masrafının kime ait olduğu bu belgenin 9. maddesinde düzenlenmiştir. | İade kodu Satıcı'nın yanıtında bildirilir; iade kargo bedeli sizden talep edilmez. Ayrıntı bu belgenin 9. maddesindedir. |
| İptal, İade ve Cayma Hakkı | 5. Cayma Hakkının Kullanılması: Adım Adım Prosedür | Ürünü, cayma bildirimini gönderdiğiniz tarihten itibaren on (10) gün içinde kargoya verin; bu süre Mesafeli Sözleşmeler Yönetmeliği'nin tüketicinin malı geri gönderme yükümlülüğünü düzenleyen hükmünden gelir. | Ürünü, cayma bildirimini gönderdiğiniz tarihten itibaren on dört (14) gün içinde kargoya verin; bu süre Mesafeli Sözleşmeler Yönetmeliği'nin tüketicinin malı geri gönderme yükümlülüğünü düzenleyen hükmünden gelir. |
| İptal, İade ve Cayma Hakkı | 5. Cayma Hakkının Kullanılması: Adım Adım Prosedür | Kabul edilen iadelerde geri ödeme, bu belgenin 10. maddesindeki usule göre başlatılır; siparişte kupon veya promosyon kodu kullanıldıysa bunun iadeye etkisi 10., 11. ve 12. maddelerde düzenlenmiştir. | Geri ödeme, bu belgenin 10. maddesindeki usule göre başlatılır; siparişte kupon veya promosyon kodu kullanıldıysa bunun iadeye etkisi 10., 11. ve 12. maddelerde düzenlenmiştir. |
| İptal, İade ve Cayma Hakkı | 7. Cayma Hakkının Kullanılamayacağı Ürün ve Hizmetler | Örnek: mührü açılmış pistacchio kreması kavanozu, kapağı açılmış şurup şişesi, koruyucu bandı sökülmüş kahve çekirdeği paketi. | Örnek: mührü açılmış pistacchio kreması kavanozu, kapağı açılmış şurup şişesi, koruyucu bandı sökülmüş kahve çekirdeği paketi, kutusu açılmış yenilebilir waffle kupa seti. |
| İptal, İade ve Cayma Hakkı | 7. Cayma Hakkının Kullanılamayacağı Ürün ve Hizmetler | Doğrudan tüketime yönelik olarak üretilen ve tekrar satışa sunulması gıda güvenliği bakımından mümkün olmayan yenilebilir ürünler. Örnek: yenilebilir waffle kupa (edible cup) setleri; ambalajı açılmamış olsa dahi taşıma koşulları doğrulanamadığından ambalaj bütünlüğü bozulmuş gönderiler. | (silindi) |
| İptal, İade ve Cayma Hakkı | 8. İade Edilen Ürünün Durumu ve Satılabilirlik Ölçütü | İade Edilen Ürünün Durumu ve Satılabilirlik Ölçütü | İade Edilen Ürünün Durumu |
| İptal, İade ve Cayma Hakkı | 8. İade Edilen Ürünün Durumu ve Satılabilirlik Ölçütü | Buna karşılık, ürünün makul deneme sınırını aşacak biçimde kullanılması sonucunda değerinde bir azalma meydana gelmişse Satıcı, bu değer azalmasını geri ödemeden mahsup etme hakkını saklı tutar. Mahsup yapılan hâllerde mahsubun gerekçesi, dayandığı tespit ve tutarın hesaplanma yöntemi Alıcı'ya yazılı olarak bildirilir; Alıcı bu bildirime itiraz edebilir. | (silindi) |
| İptal, İade ve Cayma Hakkı | 8. İade Edilen Ürünün Durumu | (yoktu) | Buna karşılık, ürünün işleyişine, teknik özelliklerine veya kullanım talimatlarına aykırı kullanılması sonucunda değerinde bir azalma meydana gelmişse Satıcı, bu değer azalmasını geri ödemeden mahsup edebilir. Mahsup yapılan hâllerde mahsubun gerekçesi, dayandığı tespit ve tutarın hesaplanma yöntemi Alıcı'ya yazılı olarak bildirilir; Alıcı bu bildirime itiraz edebilir. |
| İptal, İade ve Cayma Hakkı | 8. İade Edilen Ürünün Durumu ve Satılabilirlik Ölçütü | Satılabilirlik ölçütü şu şekilde uygulanır: ürün, kalite kontrolden geçtikten sonra yeni ürün olarak yeniden satışa sunulabilecek durumda ise iade koşulsuz kabul edilir. Yeniden satışa uygun olmayan hâllerde durum fotoğraflarla belgelenerek Alıcı'ya bildirilir. | (silindi) |
| İptal, İade ve Cayma Hakkı | 8. İade Edilen Ürünün Durumu | (yoktu) | İade edilir: kutusu açılmış, incelenmiş, denenmiş ya da cayma süresi içinde işleyişine ve kullanım talimatlarına uygun kullanılmış ekipman, seramik, cam ve tekstil ürünleri; bu kullanımdan doğan değişiklikler için kesinti yapılmaz. |
| İptal, İade ve Cayma Hakkı | 8. İade Edilen Ürünün Durumu ve Satılabilirlik Ölçütü | Kabul edilir: kutusu dikkatlice açılmış, denenmiş ancak kullanılmamış ekipman (moka pot, tamper, el değirmeni); ambalajı açılmamış kahve çekirdeği; etiketleri sökülmemiş tekstil ürünleri (önlük, tote çanta). | (silindi) |
| İptal, İade ve Cayma Hakkı | 8. İade Edilen Ürünün Durumu | (yoktu) | Kesinti yapılabilir: ürünün kullanım talimatlarına aykırı kullanımından doğan değer kaybı (örneğin bulaşık makinesinde yıkanmaması gereken bir ürünün makinede yıkanması); kesinti yukarıdaki usulle bildirilir. |
| İptal, İade ve Cayma Hakkı | 8. İade Edilen Ürünün Durumu ve Satılabilirlik Ölçütü | Kabul edilir: ürünün doğru olup olmadığını anlamak için kısa süre denenen ve üzerinde iz bırakmayan seramik veya cam kalemler. | (silindi) |
| İptal, İade ve Cayma Hakkı | 8. İade Edilen Ürünün Durumu | (yoktu) | Cayma hakkı yoktur: ambalajı açılmış kahve paketleri ve iadesi sağlık ve hijyen açısından uygun olmayan diğer ürünler, çabuk bozulabilen gıdalar ve kişiye özel hazırlanan ürünler (bkz. 7. madde). |
| İptal, İade ve Cayma Hakkı | 8. İade Edilen Ürünün Durumu ve Satılabilirlik Ölçütü | Kabul edilmez: demleme yapılmış, içinde kahve tortusu, su izi veya kireç kalıntısı bulunan ekipman. | (silindi) |
| İptal, İade ve Cayma Hakkı | 8. İade Edilen Ürünün Durumu ve Satılabilirlik Ölçütü | Kabul edilmez: öğütülmüş, ambalajı açılmış veya bir kısmı tüketilmiş kahve çekirdeği paketi. | (silindi) |
| İptal, İade ve Cayma Hakkı | 8. İade Edilen Ürünün Durumu ve Satılabilirlik Ölçütü | Kabul edilmez: yıkanmış, ütülenmiş, kullanılmış veya üzerinde koku, leke ya da evcil hayvan tüyü bulunan tekstil ürünleri. | (silindi) |
| İptal, İade ve Cayma Hakkı | 8. İade Edilen Ürünün Durumu ve Satılabilirlik Ölçütü | Kabul edilmez: kırık, çizik, ezik veya eksik parçalı olarak gönderilen ürünler; ancak hasarın taşıma sırasında oluştuğu kargo tutanağı ile belgelenirse bu madde uygulanmaz ve 16. madde devreye girer. | Taşıma hasarı: ürün kırık, çizik, ezik veya eksik parçalı ulaştıysa ve hasar taşıma sırasında oluştuysa 16. madde uygulanır. |
| İptal, İade ve Cayma Hakkı | 8. İade Edilen Ürünün Durumu ve Satılabilirlik Ölçütü | Kısmi kabul: setin bir kalemi kullanılmış, diğerleri kullanılmamışsa kullanılmayan kalemlerin bedeli iade edilir; set indirimi uygulanmışsa iade tutarı, kalan kalemlerin liste fiyatı esas alınarak yeniden hesaplanır ve hesaplama Alıcı'ya gösterilir. | Setler: setin bir kısmı iade edilirse iade tutarı, iade edilen kalemlerin set fiyatı içindeki payına göre hesaplanır ve hesaplama Alıcı'ya gösterilir. |
| İptal, İade ve Cayma Hakkı | 9. İade Kargo Masrafının Kime Ait Olduğu | Cayma hakkının kullanılmasında iade masrafının kime ait olacağı, Ön Bilgilendirme Formu'nda açıkça belirtilmiştir. Bu belgede anlaşmalı taşıyıcı, Satıcı'nın iade talebinize verdiği yanıtta bildirdiği kargo firmasıdır. {{BRAND}}, iadelerin anlaşmalı taşıyıcı üzerinden yapılması hâlinde masrafı doğrudan üstlenir; Alıcı'nın kargo şubesinde peşin ödeme yapmasına gerek yoktur. | Ön Bilgilendirme Formu'nda iade için bir taşıyıcı adlandırılmamıştır; bu nedenle Mesafeli Sözleşmeler Yönetmeliği'nin 12. maddesinin beşinci fıkrası uyarınca iade masrafına ilişkin hiçbir bedel Alıcı'dan talep edilmez. {{BRAND}}, cayma bildiriminize verdiği yanıtta bir iade kodu gönderir; bu kodla yapılan gönderinin bedelini doğrudan üstlenir, kargo şubesinde ödeme yapmanız gerekmez. |
| İptal, İade ve Cayma Hakkı | 9. İade Kargo Masrafının Kime Ait Olduğu | Alıcı'nın anlaşmalı taşıyıcı dışında bir firmayı tercih etmesi hâlinde gönderim bedeli Alıcı tarafından karşılanır ve bu tutar, anlaşmalı taşıyıcı tarifesini aşan kısmı bakımından Satıcı'dan talep edilemez. Ayıplı, yanlış veya eksik ürün gönderimlerinde ise hangi taşıyıcı kullanılırsa kullanılsın masrafın tamamı Satıcı'ya aittir ve belgelenmesi hâlinde Alıcı'ya geri ödenir. | Alıcı iadeyi başka bir kargo firmasıyla gönderirse belgelediği gönderim bedeli Satıcı tarafından geri ödenir. Ayıplı, yanlış veya eksik ürün gönderimlerinde de masrafın tamamı Satıcı'ya aittir ve belgelenmesi hâlinde Alıcı'ya geri ödenir. Belgelenen gönderim bedeli, ürün bedelinin iadesinden ayrı olarak ve belgenin Satıcı'ya ulaşmasından itibaren 14 (on dört) gün içinde, Alıcı'nın kendi adına kayıtlı olarak bildireceği banka hesabına havale veya EFT ile ödenir; karta yapılan iade karttan tahsil edilen tutarı aşamadığından bu bedel karta iade edilmez. |
| İptal, İade ve Cayma Hakkı | 9. İade Kargo Masrafının Kime Ait Olduğu | Karşı ödemeli (gönderi bedeli alıcıya ait) olarak gönderilen ve önceden mutabık kalınmayan iadeler teslim alınmayabilir; bu hâlde Alıcı ile iletişime geçilerek çözüm üretilir ve bu durum tek başına iade talebinin reddi anlamına gelmez. | Karşı ödemeli (gönderi bedeli alıcıya ait) olarak gönderilen iadeler de teslim alınır; gönderi bedelini Satıcı öder. |
| İptal, İade ve Cayma Hakkı | 9. İade Kargo Masrafının Kime Ait Olduğu | Cayma hakkı - anlaşmalı taşıyıcı ile iade | Cayma hakkı - iade koduyla iade |
| İptal, İade ve Cayma Hakkı | 9. İade Kargo Masrafının Kime Ait Olduğu | Masraf Satıcı'ya aittir; gönderi kodu ile ücretsiz gönderilir. | Masraf Satıcı'ya aittir; iade koduyla ücretsiz gönderilir. |
| İptal, İade ve Cayma Hakkı | 9. İade Kargo Masrafının Kime Ait Olduğu | Cayma hakkı - anlaşmalı olmayan taşıyıcı ile iade | Cayma hakkı - başka bir kargo firmasıyla iade |
| İptal, İade ve Cayma Hakkı | 9. İade Kargo Masrafının Kime Ait Olduğu | Masraf Alıcı'ya aittir. | Belgelediğiniz gönderim bedeli, belge ulaştıktan sonra 14 gün içinde kendi adınıza kayıtlı banka hesabına ödenir. |
| İptal, İade ve Cayma Hakkı | 9. İade Kargo Masrafının Kime Ait Olduğu | İlk gönderi masrafı Satıcı'ya, iade gönderisi anlaşmalı taşıyıcı ile ücretsizdir; yeni ürünün sevkiyatı ücretsiz yapılır. | İlk gönderi masrafı Satıcı'ya, iade gönderisi ücretsizdir; yeni ürünün sevkiyatı ücretsiz yapılır. |
| İptal, İade ve Cayma Hakkı | 11. Kısmi İade, Ücretsiz Kargo Eşiği ve Promosyon Kodlarının Etkisi | Sipariş tutarı ücretsiz kargo eşiğine ulaştığı için kargo ücretsiz uygulanmış, kısmi iade sonrasında kalan sipariş tutarı bu eşiğin altına düşmüşse, sipariş anında geçerli olan standart kargo bedeli geri ödemeden mahsup edilebilir. Bu mahsup yalnızca Alıcı'nın kendi tercihiyle yaptığı cayma veya değişim taleplerinde uygulanır; ayıplı, yanlış, eksik veya hasarlı ürün nedeniyle yapılan iadelerde hiçbir şekilde uygulanmaz. | Sipariş tutarı ücretsiz kargo eşiğine ulaştığı için kargo ücretsiz uygulanmışsa, kısmi iade sonrasında kalan sipariş tutarı bu eşiğin altına düşse de geri ödemeden kargo bedeli mahsup edilmez ve sizden sonradan kargo bedeli istenmez. Bu kural, iade nedeni ne olursa olsun uygulanır. |
| İptal, İade ve Cayma Hakkı | 11. Kısmi İade, Ücretsiz Kargo Eşiği ve Promosyon Kodlarının Etkisi | Örnek (rakamlar yalnızca açıklama içindir): ücretsiz kargo eşiğinin 500 TL, standart kargo bedelinin 50 TL olduğu varsayımıyla, kargo bedeli alınmamış 620 TL tutarındaki bir siparişte 260 TL'lik bir kalem iade edilirse kalan tutar 360 TL olur ve eşik bozulur; bu hâlde 50 TL kargo bedeli iade tutarından mahsup edilerek 210 TL geri ödenir. | Örnek (rakamlar yalnızca açıklama içindir): ücretsiz kargo eşiğinin 500 TL, standart kargo bedelinin 50 TL olduğu varsayımıyla, kargo bedeli alınmamış 620 TL tutarındaki bir siparişte 260 TL'lik bir kalem iade edilirse kalan tutar 360 TL olur ve eşiğin altına düşer; bu hâlde de kargo bedeli mahsup edilmez ve 260 TL'nin tamamı geri ödenir. |
| İptal, İade ve Cayma Hakkı | 11. Kısmi İade, Ücretsiz Kargo Eşiği ve Promosyon Kodlarının Etkisi | Örnek: Aynı siparişte iade nedeni ürünün ayıplı çıkması ise mahsup yapılmaz ve 260 TL'nin tamamı iade edilir. | (silindi) |
| İptal, İade ve Cayma Hakkı | 11. Kısmi İade, Ücretsiz Kargo Eşiği ve Promosyon Kodlarının Etkisi | Hediye olarak eklenen tamamlayıcı ürünler, iade nedeniyle kampanya koşulu ortadan kalkıyorsa iade paketine dâhil edilmelidir; gönderilmemesi hâlinde ürünün liste bedeli geri ödemeden mahsup edilebilir. | Hediye olarak eklenen tamamlayıcı ürünler, iade nedeniyle kampanya koşulu ortadan kalkıyorsa iade paketine dâhil edilmelidir; gönderilmemesi hâlinde ürünün sipariş tarihindeki satış fiyatı geri ödemeden mahsup edilebilir. |
| İptal, İade ve Cayma Hakkı | 15. Değişim (Ürün Takası) Süreci | Değişim talepleri, cayma hakkı süresi olan 14 gün içinde iletilmelidir ve değişime konu ürünün bu belgenin 8. maddesindeki satılabilirlik ölçütünü karşılaması gerekir. | Değişim talepleri, cayma hakkı süresi olan 14 gün içinde iletilmelidir; değişime konu ürünün durumu bu belgenin 8. maddesine göre değerlendirilir. |
| İptal, İade ve Cayma Hakkı | 17. Soğuk Zincir, Kısa Raf Ömürlü ve Gıda Ürünlerinde Özel Kurallar | (yoktu) | Kutusu açılmamış yenilebilir waffle kupa setleri bu istisnaya girmez; kutusu açılmış setler sağlık ve hijyen istisnasına girer (7. madde). |
| İptal, İade ve Cayma Hakkı | 18. İade Adresi, Paketleme ve Gönderi Kuralları | Ürünü orijinal kutusuyla birlikte, kutunun kendisini dış ambalaj olarak kullanmadan gönderin; orijinal kutu ürünün parçası sayılır. | Ürünün orijinal kutusunu göndermeniz gerekmez; kutuyla gönderecekseniz kutunun kendisini dış ambalaj olarak kullanmayın. |
| İptal, İade ve Cayma Hakkı | 18. İade Adresi, Paketleme ve Gönderi Kuralları | Ürün Satıcı'ya ulaşana kadar taşıma riski, anlaşmalı taşıyıcı ile yapılan gönderilerde Satıcı üzerindedir; anlaşmalı olmayan taşıyıcı tercih edilmişse gönderi kaybı riskinin taşıyıcıya karşı takibi gönderici sıfatıyla Alıcı'ya aittir, bu hâlde Satıcı süreçte destek olur. | Ürün Satıcı'ya ulaşana kadar taşıma riski Satıcı üzerindedir. Alıcı iadeyi başka bir kargo firmasıyla gönderdiyse ve gönderi kaybolur ya da hasar görürse, Alıcı gönderi belgesini ilettiğinde geri ödeme yapılır; taşıyıcıya karşı takibi Satıcı üstlenir, Alıcı bunun için gereken belgeyi verir. |
| İptal, İade ve Cayma Hakkı | 18. İade Adresi, Paketleme ve Gönderi Kuralları | İade kargo firması ve gönderi kodu | İade kodu |
| İptal, İade ve Cayma Hakkı | 19. İade Talebinin Takibi, Statüler ve Bildirimler | Ürünü anlaşmalı taşıyıcıya teslim etmeniz bekleniyor (bildirimden itibaren 10 gün). | Ürünü iade koduyla kargoya vermeniz bekleniyor (bildirimden itibaren 14 gün). |
| İptal, İade ve Cayma Hakkı | 19. İade Talebinin Takibi, Statüler ve Bildirimler | Ürün depoya ulaştı; kalite kontrol ve satılabilirlik incelemesi yapılıyor (en geç 2 iş günü). | Ürün depoya ulaştı; inceleme yapılıyor (en geç 2 iş günü). |
| Teslimat ve Kargo Koşulları | 5. Teslimat Bölgeleri ve Tahminî Teslim Süreleri | Kuzey Kıbrıs Türk Cumhuriyeti (KKTC) | (silindi) |
| Teslimat ve Kargo Koşulları | 5. Teslimat Bölgeleri ve Tahminî Teslim Süreleri | 5-10 iş günü (gümrük işlem süresi hariç) | (silindi) |
| Teslimat ve Kargo Koşulları | 5. Teslimat Bölgeleri ve Tahminî Teslim Süreleri | Yurt dışı | (silindi) |
| Teslimat ve Kargo Koşulları | 5. Teslimat Bölgeleri ve Tahminî Teslim Süreleri | 7-21 iş günü (gümrük işlem süresi hariç) | (silindi) |
| Teslimat ve Kargo Koşulları | 7. Kargo ve Teslimat Ücretleri | KKTC ve yurt dışı teslimat adresleri için ayrı bir taşıma tarifesi uygulanmaz; bu gönderilerde de taşıma bedeli olarak, ödeme öncesinde sipariş özetinde gösterilen kargo ücreti esas alınır. Bu bedel yalnızca taşıma hizmetini kapsar; gümrük vergi, resim ve harçları 16. maddede düzenlendiği şekilde ALICI'nın sorumluluğundadır. | (silindi) |
| Teslimat ve Kargo Koşulları | 7. Kargo ve Teslimat Ücretleri | KKTC ve yurt dışı gönderileri | (silindi) |
| Teslimat ve Kargo Koşulları | 7. Kargo ve Teslimat Ücretleri | Ayrı tarife uygulanmaz; ödeme ekranında gösterilen kargo ücreti esas alınır (gümrük vergi, resim ve harçları hariç) | (silindi) |
| Teslimat ve Kargo Koşulları | 8. Anlaşmalı Kargo Firmaları ve Taşıyıcının Belirlenmesi | Cayma hakkının kullanılması hâlinde iade gönderisinin hangi kargo firmasıyla ve hangi iade koduyla yapılacağı, cayma bildiriminin SATICI'ya ulaşmasından sonra ALICI'ya e-posta ile bildirilir. | Cayma hakkının kullanılması hâlinde iade gönderisinin iade kodu, cayma bildiriminin SATICI'ya ulaşmasından sonra ALICI'ya e-posta ile bildirilir; iade kargo bedeli ALICI'dan talep edilmez (19. madde). |
| Teslimat ve Kargo Koşulları | 9. Soğuk Zincir, Kuru Buz ve Isıya Duyarlı Ürünler | Soğuk zincir gönderileri niteliği gereği KKTC ve yurt dışına sevk edilemez. Bu ürünler yalnızca Türkiye içi teslimat adreslerine gönderilebilir. Soğuk zincir ürünü içeren bir sipariş KKTC veya yurt dışındaki bir teslimat adresiyle verilirse SATICI, ALICI'yı bilgilendirir; ALICI'nın tercihine göre sipariş soğuk zincir ürünü çıkarılarak gönderilir ve bu ürünün bedeli iade edilir ya da sipariş iptal edilerek tahsil edilen tutarın tamamı iade edilir. | (silindi) |
| Teslimat ve Kargo Koşulları | 9. Soğuk Zincir, Kuru Buz ve Isıya Duyarlı Ürünler | (yoktu) | Kutusu açılmamış yenilebilir waffle kupa setleri ve kapalı paketteki kavrulmuş kahve bu kapsamda sayılmaz. |
| Teslimat ve Kargo Koşulları | 16. KKTC ve Yurt Dışı Gönderileri; Gümrük Vergi, Resim ve Harçları | 16. KKTC ve Yurt Dışı Gönderileri; Gümrük Vergi, Resim ve Harçları | (silindi) |
| Teslimat ve Kargo Koşulları | 16. Teslimat Bölgesi | (yoktu) | 16. Teslimat Bölgesi |
| Teslimat ve Kargo Koşulları | 16. KKTC ve Yurt Dışı Gönderileri; Gümrük Vergi, Resim ve Harçları | KKTC ve yurt dışı gönderilerinde ayrı bir taşıma tarifesi uygulanmaz; taşıma bedeli olarak, ödeme öncesinde sipariş özetinde vergiler dâhil gösterilen kargo ücreti esas alınır. | (silindi) |
| Teslimat ve Kargo Koşulları | 16. Teslimat Bölgesi | (yoktu) | Online mağaza siparişleri yalnızca Türkiye içindeki teslimat adreslerine gönderilir; KKTC'ye ve yurt dışına gönderim yapılmaz. |
| Teslimat ve Kargo Koşulları | 16. KKTC ve Yurt Dışı Gönderileri; Gümrük Vergi, Resim ve Harçları | Yurt dışına yapılan gönderiler varış ülkesinin gümrük mevzuatına tabidir. Varış ülkesinde tahakkuk edebilecek ithalat vergileri, gümrük vergisi, katma değer vergisi, özel tüketim vergisi, gümrük müşavirliği ücreti, antrepo ve benzeri her türlü resim, harç ve masraf ALICI'nın sorumluluğundadır ve bu tutarlar sipariş bedeline dâhil değildir. SATICI bu tutarları önceden hesaplayamaz veya taahhüt edemez. | (silindi) |
| Teslimat ve Kargo Koşulları | 16. KKTC ve Yurt Dışı Gönderileri; Gümrük Vergi, Resim ve Harçları | Gümrük işlemleri sırasında ALICI'dan kimlik, vergi numarası veya ithalat beyanı gibi ek belge talep edilebilir. Bu belgelerin zamanında sunulmaması nedeniyle gönderinin gümrükte beklemesi, iade edilmesi veya imha edilmesi hâlinde doğan masraflar ALICI'ya aittir. | (silindi) |
| Teslimat ve Kargo Koşulları | 16. KKTC ve Yurt Dışı Gönderileri; Gümrük Vergi, Resim ve Harçları | Bazı ürünlerin belirli ülkelere ihracı veya ithali yasal olarak kısıtlanmış olabilir. Gıda ürünlerinin ithalinde varış ülkesinin gıda güvenliği mevzuatı uygulanır. ALICI, sipariş vermeden önce kendi ülkesinin ithalat kurallarını kontrol etmekle yükümlüdür. | (silindi) |
| Teslimat ve Kargo Koşulları | 16. KKTC ve Yurt Dışı Gönderileri; Gümrük Vergi, Resim ve Harçları | Gönderinin gümrük mevzuatına aykırılık nedeniyle varış ülkesince kabul edilmemesi ve SATICI'ya iade edilmesi hâlinde ürün bedeli ALICI'ya iade edilir; ancak gidiş ve dönüş taşıma bedelleri ile gümrükte doğan masraflar iade tutarından mahsup edilebilir. Bu mahsup, yalnızca gümrük engelinin ALICI'nın bilgi verme yükümlülüğünü yerine getirmemesinden kaynaklandığı hâllerde uygulanır. | (silindi) |
| Teslimat ve Kargo Koşulları | 16. KKTC ve Yurt Dışı Gönderileri; Gümrük Vergi, Resim ve Harçları | Soğuk zincir gerektiren ürünler, gümrük bekleme süreleri nedeniyle KKTC ve yurt dışına gönderilmez. | (silindi) |
| Teslimat ve Kargo Koşulları | 16. KKTC ve Yurt Dışı Gönderileri; Gümrük Vergi, Resim ve Harçları | Taşıma bedeli sipariş anında hesaplanır ve ödeme öncesinde net tutar olarak gösterilir. | (silindi) |
| Teslimat ve Kargo Koşulları | 16. KKTC ve Yurt Dışı Gönderileri; Gümrük Vergi, Resim ve Harçları | Gümrük vergi, resim ve harçları ile müşavirlik ücretleri ALICI'ya aittir. | (silindi) |
| Teslimat ve Kargo Koşulları | 16. KKTC ve Yurt Dışı Gönderileri; Gümrük Vergi, Resim ve Harçları | Gönderiler DAP (Delivered at Place) esasına göre sevk edilir; gümrükleme yükümlülüğü ALICI'dadır. | (silindi) |
| Teslimat ve Kargo Koşulları | 16. KKTC ve Yurt Dışı Gönderileri; Gümrük Vergi, Resim ve Harçları | Gümrük işlem süreleri, tabloda gösterilen tahminî teslim sürelerine dâhil değildir. | (silindi) |
| Teslimat ve Kargo Koşulları | 16. KKTC ve Yurt Dışı Gönderileri; Gümrük Vergi, Resim ve Harçları | Varış ülkesinin ithalat kısıtlamalarını kontrol etmek ALICI'nın sorumluluğundadır. | (silindi) |
| Teslimat ve Kargo Koşulları | 16. KKTC ve Yurt Dışı Gönderileri; Gümrük Vergi, Resim ve Harçları | Yurt dışı gönderilerinde gümrük işlemleri için gereken belgeler ilgili mevzuata uygun şekilde düzenlenir. | (silindi) |
| Teslimat ve Kargo Koşulları | 16. KKTC ve Yurt Dışı Gönderileri; Gümrük Vergi, Resim ve Harçları | Soğuk zincir ürünleri KKTC ve yurt dışına sevk edilmez. | (silindi) |
| Teslimat ve Kargo Koşulları | 19. Cayma Hakkı Kapsamında İade Gönderilerinde Kargo Düzeni | Cayma hakkı kapsamındaki iade gönderisinin hangi kargo firmasıyla ve hangi iade koduyla yapılacağı, cayma bildiriminin SATICI'ya ulaşmasından sonra ALICI'ya e-posta ile bildirilir. İadenin SATICI'nın bildirdiği kargo firması ile ve bildirilen iade kodu kullanılarak gönderilmesi hâlinde iade kargo bedeli SATICI tarafından karşılanır; ALICI'dan herhangi bir taşıma bedeli tahsil edilmez. | Cayma hakkı kapsamındaki iade gönderisinin iade kodu, cayma bildiriminin SATICI'ya ulaşmasından sonra ALICI'ya e-posta ile bildirilir. İade koduyla yapılan gönderinin bedeli SATICI tarafından karşılanır; ALICI'dan herhangi bir taşıma bedeli tahsil edilmez. |
| Teslimat ve Kargo Koşulları | 19. Cayma Hakkı Kapsamında İade Gönderilerinde Kargo Düzeni | ALICI'nın SATICI'nın bildirdiği kargo firması dışında bir taşıyıcı ile iade göndermeyi tercih etmesi hâlinde, SATICI yalnızca bildirilen kargo firmasının tarifesine denk gelen tutarı karşılamakla yükümlüdür; aradaki fark ALICI'ya ait olabilir. | ALICI iadeyi başka bir taşıyıcı ile gönderirse de iade masrafı ALICI'dan talep edilmez; ALICI'nın belgelediği gönderim bedeli SATICI tarafından geri ödenir. Belgelenen gönderim bedeli, ürün bedelinin iadesinden ayrı olarak ve belgenin SATICI'ya ulaşmasından itibaren 14 (on dört) gün içinde, ALICI'nın kendi adına kayıtlı olarak bildireceği banka hesabına havale veya EFT ile ödenir; karta yapılan iade karttan tahsil edilen tutarı aşamadığından bu bedel karta iade edilmez. |
| Teslimat ve Kargo Koşulları | 19. Cayma Hakkı Kapsamında İade Gönderilerinde Kargo Düzeni | İade edilecek teslim masrafı, standart gönderim seçeneğine karşılık gelen ve ALICI'dan tahsil edilen tutardır; ALICI'nın standart gönderim dışında ilave maliyetli bir teslimat seçeneğini tercih etmiş olması hâlinde aradaki fark iade kapsamı dışında kalabilir. | (silindi) |
| Teslimat ve Kargo Koşulları | 19. Cayma Hakkı Kapsamında İade Gönderilerinde Kargo Düzeni | ALICI, cayma bildiriminden itibaren on gün içinde ürünü SATICI'nın {{ADDRESS}} adresine iade etmekle yükümlüdür. Ürünün, kutusu, ambalajı ve varsa standart aksesuarları ile birlikte eksiksiz gönderilmesi gerekir; fatura nüshasının da ürünle birlikte gönderilmesi önerilir. | ALICI, cayma bildiriminden itibaren on dört gün içinde ürünü SATICI'nın {{ADDRESS}} adresine iade etmekle yükümlüdür. Ürün, varsa standart aksesuarlarıyla birlikte gönderilir; kutusunun veya faturasının gönderilmesi gerekmez. |
| Teslimat ve Kargo Koşulları | 19. Cayma Hakkı Kapsamında İade Gönderilerinde Kargo Düzeni | İade gönderisi: kargo firması ve iade kodu cayma bildiriminden sonra e-posta ile bildirilir; bildirilen firma ve kodla gönderimde kargo bedeli SATICI'ya aittir. | İade gönderisi: iade kodu cayma bildiriminden sonra e-posta ile bildirilir; iade kargo bedeli ALICI'dan talep edilmez. |
| Teslimat ve Kargo Koşulları | 19. Cayma Hakkı Kapsamında İade Gönderilerinde Kargo Düzeni | Ürünün SATICI'ya gönderilme süresi: cayma bildiriminden itibaren 10 gün. | Ürünün SATICI'ya gönderilme süresi: cayma bildiriminden itibaren 14 gün. |
| Teslimat ve Kargo Koşulları | 19. Cayma Hakkı Kapsamında İade Gönderilerinde Kargo Düzeni | İade kapsamı: ürün bedeli ve standart teslim masrafı. | İade kapsamı: ürün bedeli ve tahsil edilen teslim masrafı. |
| Teslimat ve Kargo Koşulları | 20. Kargo Süreçlerinde Kişisel Verilerin İşlenmesi | Yurt dışı gönderilerinde veriler, 6698 sayılı Kanun'un yurt dışına aktarıma ilişkin hükümlerine uygun olarak varış ülkesindeki taşıyıcı ve gümrük makamlarına aktarılabilir. | (silindi) |
| Satış Politikası ve Kısıtlı Ürünler | 25. Teslimat Bölgesi, KKTC ve Yurt Dışı Satış Kısıtları | Teslimat Bölgesi, KKTC ve Yurt Dışı Satış Kısıtları | Teslimat Bölgesi |
| Satış Politikası ve Kısıtlı Ürünler | 25. Teslimat Bölgesi, KKTC ve Yurt Dışı Satış Kısıtları | Kuzey Kıbrıs Türk Cumhuriyeti veya yurt dışı teslimat talebiniz varsa siparişten önce {{EMAIL}} adresine yazmanız gerekir; teslimatın yapılıp yapılamayacağı ve koşulları size ayrıca bildirilir. | (silindi) |
| Satış Politikası ve Kısıtlı Ürünler | 25. Teslimat Bölgesi, KKTC ve Yurt Dışı Satış Kısıtları | Ayrıca kabul edilen yurt dışı ve KKTC gönderilerinde varış ülkesinin gümrük mevzuatı geçerlidir. Gümrük vergisi, harç, işlem ücreti ve varsa yerel vergiler alıcıya aittir ve sipariş tutarına dâhil değildir. Bu bedeller kargo firması veya gümrük idaresi tarafından doğrudan alıcıdan tahsil edilir. | (silindi) |
| Satış Politikası ve Kısıtlı Ürünler | 25. Teslimat Bölgesi | (yoktu) | Bottega yalnızca Türkiye içindeki teslimat adreslerine gönderim yapar; KKTC'ye ve yurt dışına gönderim yapılmaz. |
| Satış Politikası ve Kısıtlı Ürünler | 25. Teslimat Bölgesi, KKTC ve Yurt Dışı Satış Kısıtları | Bazı ülkeler gıda ürünlerinin ithalatına sınırlama getirmektedir. Kahve, yenilebilir kupa, gelato kiti ve kiler ürünlerinin varış ülkesine girişinin mümkün olup olmadığını sipariş öncesinde kontrol etmek alıcının sorumluluğundadır. Ürünün gümrükte alıkonulması veya imha edilmesi hâlinde, bu durum Satıcının kusurundan kaynaklanmadıkça ürün bedelinin iadesi talep edilemez; varış ülkesinde doğan gümrük gideri ve iade taşıma masrafı alıcıya aittir. Bu hüküm, cayma hakkının usulüne uygun kullanıldığı hâllerde standart teslimat bedelinin iadesine ilişkin emredici mevzuat hükümlerini etkilemez. | (silindi) |
| Satış Politikası ve Kısıtlı Ürünler | 25. Teslimat Bölgesi, KKTC ve Yurt Dışı Satış Kısıtları | Yurt dışı gönderilerde cayma hakkınız saklıdır; ancak iade gönderim masrafı ve gümrük giderleri, cayma hakkının kullanıldığı hâllerde Mesafeli Sözleşmeler Yönetmeliğindeki esaslara göre belirlenir ve ilgili masrafların kime ait olacağı Ön Bilgilendirme Formunda açıkça gösterilir. | (silindi) |
| Satış Politikası ve Kısıtlı Ürünler | 25. Teslimat Bölgesi, KKTC ve Yurt Dışı Satış Kısıtları | Ambargo, yaptırım veya ihracat kısıtlaması bulunan ülkelere gönderim yapılmaz. Böyle bir adres girilmesi hâlinde sipariş onaylanmaz ve tahsil edilen bedel iade edilir. | (silindi) |
| Ödeme Koşulları ve Sanal POS | 9. Kargo Ücretinin Ödemeye Yansıması | Ödeme adımında gösterilen kargo ücreti, teslimatın Satıcı tarafından üstlenilen kısmını kapsar. KKTC ve yurt dışı gönderilerde varış ülkesinde doğabilecek gümrük vergisi, ithalat harcı ve benzeri kamusal yükler tarife dışıdır ve mevzuat gereği alıcıya aittir; bu bedeller Satıcı tarafından tahsil edilmez. | Ödeme adımında gösterilen kargo ücreti teslimatın tamamını kapsar; teslimat için ayrıca bir bedel istenmez. |
| Ödeme Koşulları ve Sanal POS | 21. İptal, Cayma ve İade Sürecinin Ödeme Ayağı | Cayma hâlinde iade için kullanılacak kargo şirketi iade talebiniz kabul edildiğinde bildirilir; bildirilen anlaşmalı taşıyıcı ile yapılan iadelerde taşıma bedeli sizden talep edilmez. | Cayma hâlinde iade kodu iade talebiniz alındığında e-postayla bildirilir; iade için taşıma bedeli hiçbir hâlde sizden talep edilmez. |
| Ödeme Koşulları ve Sanal POS | 22. Kısmi İade ve Kısmi İptal | Kısmi iadede, kalan kalemler ücretsiz kargo eşiğinin altına düşerse, kampanya koşulları gereği kargo bedeli iade tutarından mahsup edilebilir; bu mahsup iade özetinde açıkça gösterilir. Ayıplı, eksik veya hatalı gönderilen kalemlerin iadesinde ise böyle bir mahsup yapılmaz ve kargo bedeli Satıcı tarafından karşılanır. | Kısmi iadede, kalan kalemler ücretsiz kargo eşiğinin altına düşse de iade tutarından kargo bedeli mahsup edilmez. Ayıplı, eksik veya hatalı gönderilen kalemlerin iadesinde kargo bedeli Satıcı tarafından karşılanır. |
| Şirket ve İletişim Bilgileri | 4. Faaliyet Konusu ve Sitede Sunulan Hizmetler | Türkiye'de yerleşik tüketiciler ile sitede belirtilen kapsamda yurt dışı alıcılar | Türkiye'de yerleşik tüketiciler; online mağaza yalnızca Türkiye içindeki adreslere gönderim yapar |

### 18.4 Operatöre

Metin artık şunu taahhüt ediyor; uygulama operatörün işidir (MSY m.20/1:
kayıtlar 3 yıl):

- Her cayma bildirimine **1 iş günü içinde ücretsiz bir iade kodu** e-postayla
  gönder (Geliver'de gönderici müşteri, alıcı köşk; Geliver sunmuyorsa kargo
  firmasının alıcı ödemeli iade kodu).
- Geri ödemeyi cayma bildirimi ulaştıktan sonra **en geç 14 gün** içinde,
  ürün bedeli ve alınmış teslim ücretiyle birlikte ödemenin yapıldığı karta
  tek seferde yap (m.12/4).
- Müşteri başka bir kargoyla gönderip fişini iletirse ödediği iade kargo
  bedelini, kendi adına kayıtlı olarak bildirdiği banka hesabına fiş sana
  ulaştıktan sonra en geç 14 gün içinde havale veya EFT ile öde. Bu ödeme
  panelde iade olarak girilmez: karttan alınanın tamamı iade edildiyse
  panel ve PayNkolay fazlasını reddeder (iade tahsil edilen tutarı aşamaz).
  Fişi ve dekontu sipariş notuna yaz.
- Karşı ödemeli gelen iadeyi teslim al, bedelini öde. Kısmi iadede kargo
  bedeli kesme. Başka firmayla gönderilip yolda kaybolan iadede fişe göre
  geri öde, takibi kargo firmasıyla sen yap. Hiçbir yazışmada iade kargo
  ücreti isteme.
- Sipariş notuna iade kodunu, ödenen bedelleri ve tarihleri yaz.
- Panelde Ön Bilgilendirme Formu veya Mesafeli Satış Sözleşmesi için
  yayımlanmış bir metin varsa sitede o görünür, bu metin değil: Hukuk
  ekranında "Varsayılana döndür" ile kodlanmış metne dön.

### 18.5 Bilerek değişmeyenler

- ÖBF §22'deki "kalıcı bağlantıları" ve başlığı: onaylanan sürümün kalıcı
  kopyası ayrı PR'ın işi (legal-versions-durable-copy); bugün sürüm ve onay
  tarihi siparişte saklanıyor, bu doğru.
- İade ve Cayma §17 ile Teslimat ve Kargo §9'un waffle kupu soğuk zincirle
  gönderilen ürünler arasında sayan sevkiyat cümleleri: ürün ve sevkiyat
  bilgisi ayrı PR'ın işi; burada yalnız cayma istisnasından çıkarıldı.
- Giden kargo için "anlaşmalı kargo firması" (Geliver gönderi başına firma
  seçer): iadeyle ilgisi yok.
- Şikâyet ve Uyuşmazlık Çözümü'ndeki "Yurt dışından veya KKTC'den yapılan
  başvurular": başvuru yurt dışından gelebilir, gönderim yapılmaz.
- İade ve Cayma §11'deki sepet tutarına bağlı promosyon kodu farkının
  mahsubu: kargo bedeli değil, indirim farkıdır.
- Uygulamanın çevrimdışı hukuk kopyası (`lafmobil` `src/data/legal.seed.json`)
  `npm run legal:export` ile yenilenmeli (uygulama PR'ı
  app-legal-seed-distance-sales).

### 18.6 Başka kargoyla gönderilen iadenin bedeli nasıl ödenir (doğrulama, 18 Eki 2026)

Metin "belgelediği gönderim bedeli geri ödenir" diyor ama nasıl ödendiğini
söylemiyordu. Karta iade bunu taşıyamaz: siparişin tamamından caymada
karttan alınanın hepsi zaten iade edilir; `refundRefusal` defteri tahsil
edilen tutarla sınırlar ("İade tutarı kalan bakiyeyi aşıyor") ve PayNkolay
ödemeden fazlasını iade etmez. Geriye müşterinin banka hesabı kalıyordu;
oysa bildirimler banka hesabını yalnız "kısmi iadenin karta yapılamadığı
istisnai hâl" için işlediğini söylüyordu.

**Karar:** bu bedel ürün bedelinin iadesinden ayrı, belge satıcıya
ulaştıktan sonra 14 gün içinde, alıcının kendi adına kayıtlı olarak
bildirdiği banka hesabına havale veya EFT ile ödenir; karta iade edilmez.
Banka hesabı bilgisini işleyen her bildirim bu amacı da sayar.

**Hukuki dayanak:**

- **MSY m.12/5** (RG 24.05.2025-32909 m.2 ile, 1.1.2026'dan beri): "Satıcının
  ön bilgilendirmede iade için herhangi bir taşıyıcıyı belirtmediği durumda
  ise tüketiciden iade masrafına ilişkin herhangi bir bedel talep
  edilemez." Tüketici bedeli kendisi ödediyse geri verilir. Yönetmelik bu
  ödeme için ayrı bir süre koymadığından metin m.12'deki 14 günlük geri
  ödeme süresini belgenin ulaştığı günden işletir (belge cayma
  bildiriminden sonra gelebilir).
- **KVKK m.4/2-c, ç ve m.10/1-b; Aydınlatma Yükümlülüğünün Yerine
  Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ m.5:** veri
  belirli ve açık amaçla işlenir, amaç işlemeden önce bildirilir. IBAN bu
  ödeme için de işlendiğinden amaç aydınlatmada yazılır; işleme yalnız
  müşteri başka kargo seçip bedeli istediğinde doğar (ölçülülük).
- **Ödeme Koşulları §22:** "Toplam iade tutarı, hiçbir hâlde tahsil edilen
  tutarı aşamaz" doğru kalır: gönderim bedeli bir iade değil, ayrı bir
  ödemedir (§14).

| Belge | Bölüm | Eklenen veya değişen |
|---|---|---|
| Ön Bilgilendirme Formu | 13 (paragraf ve tablo) | Ödeme cümlesi (§18.3'teki satır); yeni tablo satırı "Başka bir kargo firmasıyla gönderilen iadenin bedeli" |
| Ön Bilgilendirme Formu | 20 | "kısmi iadenin karta yapılamadığı istisnai hâllerde iade için **veya iadeyi başka bir kargo firmasıyla gönderen ALICI'ya belgelediği gönderim bedelinin ödenmesi için** bildirilen banka hesap bilgisi" |
| Mesafeli Satış Sözleşmesi | 11 | Ödeme cümlesi (§18.3'teki satır) |
| Mesafeli Satış Sözleşmesi | 16 | Finans verisinde aynı ek |
| İptal, İade ve Cayma Hakkı | 6 | IBAN maddesi "ya da iadeyi başka bir kargo firmasıyla gönderip belgelediğiniz gönderim bedelinin ödenmesini istediğinizde" hâlini de sayar |
| İptal, İade ve Cayma Hakkı | 9 (paragraf ve tablo) | Ödeme cümlesi; tablo değeri (§18.3'teki satırlar) |
| İptal, İade ve Cayma Hakkı | 10 (tablo) | Yeni satır "Başka bir kargo firmasıyla gönderilen iadenin gönderim bedeli" |
| İptal, İade ve Cayma Hakkı | 23 | Banka hesap bilgisinde aynı amaç |
| Teslimat ve Kargo Koşulları | 19 | Ödeme cümlesi (§18.3'teki satır) |
| Garanti ve Ayıplı Mal | 24 | "veya belgelenen iade gönderim bedelinin ödenmesi için" |
| Ödeme Koşulları | 14 | "Banka hesabına transfer yalnızca iki hâlde ...": kısmi iade istisnası ve gönderim bedeli; karta neden yapılmadığı, 14 gün; "üçüncü kişilere ait hesaplara ödeme yapılmaz" |
| Ödeme Koşulları | 26 | IBAN cümlesi iki amacı sayar, "yalnızca bu ödemenin yapılması amacıyla" |
| Gizlilik Politikası | 3 (tablo) | Talep ve iade verisinde aynı amaç |
| KVKK Aydınlatma Metni | 6 ve 7 | Finansal veride aynı amaç; "Cayma hakkı ve iade süreçleri" amacına "belgelediğiniz gönderim bedelinin ödenmesi" |
| Veri Saklama ve İmha Politikası | 8 (tablo) | Banka hesap bilgisi satırı iki hâli sayar; "Yalnızca bu ödemenin yapılması ve ispatı amacıyla" |
| Mobil Uygulama Kullanım Koşulları | 21 | Banka hesap bilgisinde aynı amaç |

Test: `tests/legal-docs.test.ts` "a documented return shipping cost is paid
back".

## 19. Y5 - Kayıtlı kart metinleri kaldırıldı (18 Eki 2026)

> **Durum: metin ve kod kapısı aynı dalda değişti** (`feat/legal-distance-sales-2026`).
> Avukat turu yok (operatör kararı, 18 Eki 2026). Kaldırılan her pasaj
> §19.4'te olduğu gibi duruyor: kayıtlı kart açılırsa oradan geri gelir.

### 19.1 Neden ve dayanak

Kart saklama hiç açılmadı (kural 28; PayNkolay yetkisi 16 Eki 2026'da
istendi). Buna rağmen 14 belgede 42 cümle "kart saklama özelliği
açıldığında" diye başlayıp kayıtlı kartı, üye anahtarını, PayNkolay'dan
alınan son dört haneyi ve kart adını, hesap kapanınca PayNkolay'dan silmeyi
ve anahtarın saklama süresini anlatıyordu.

- **Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar
  Hakkında Tebliğ m.5/1-g, j** (RG 10.03.2018): aydınlatmada gündeme gelmesi
  muhtemel başka amaçlar için işlenebileceği kanaatini uyandıran ifade ve
  eksik, yanıltıcı, yanlış bilgi kullanılmaz. Açılmamış bir hizmetin veri
  kategorisini ve saklama süresini anlatmak bu sınırı aşar.
- **Aynı Tebliğ m.5/1-a, b:** kişisel veri işlenen her durumda, amaç
  değiştiğinde işlemeden önce aydınlatma yapılır. Kayıtlı kart açılırsa
  metin o gün, ilk karttan önce yayımda olmalı.
- **KVKK m.4/2-ç, m.10/1:** veri amaçla bağlantılı, sınırlı ve ölçülü işlenir.
  Kart saklama kapalıyken uygulama siparişi ve üye karaoke ödemesi her üyeye
  rastgele bir PayNkolay anahtarı üretip `customers."cardUserKey"`'e
  yazıyordu; hiçbir amaca hizmet etmiyordu.
- **MSY m.5/1-f, m.5/2:** ödeme bilgileri ön bilgilendirmenin ve sözleşmenin
  parçasıdır; sunulmayan bir ödeme yolunu (kayıtlı kart) ÖBF ve MSS'de saymak
  sözleşmeyi yanlış anlatır.

**Karar (ASK-CARD-TEXT):** 42 pasaj kalkar. Yalnız bir cümleyle kalan
paragraflarda belge kendi sesiyle kartın sonraki ödemeler için
kaydedilmediğini, PayNkolay'dan da saklanmasının istenmediğini yazar. Metin
kayıtlı kartı anlatmadıkça sunucu kart saklamayı açmaz ve anahtar üretmez.

### 19.2 Kod kapısı

- `src/lib/legal/meta.ts` `SAVED_CARDS_IN_LEGAL_TEXTS = false`.
  `src/lib/payment/index.ts` kart saklamayı ancak
  `PAYNKOLAY_CARD_STORAGE` açık **ve** bu sabit `true` iken açar: değişken tek
  başına hiçbir şeyi açmaz.
- Uygulama siparişi (`src/lib/mobile/orders.ts`) ve üye karaoke ödemesi
  (`src/lib/mobile/karaoke-payment.ts`) anahtarı yalnız
  `provider.cardStorageEnabled` iken üretir; web ödemesi zaten böyleydi.
  `/api/mobile/v1` yanıtları değişmedi (`/me` anahtarı hiç taşımadı).
- Üretilmiş anahtarlar `db/migrations/20261018200000_clear_unused_card_user_keys.sql`
  ile bir kez boşaltılır (`updatedAt` değişmez). Ön şart: operatör
  Production'da `PAYNKOLAY_CARD_STORAGE`'ın hiç açık olmadığını teyit eder
  (OP-28). Bir kez bile açık olduysa önce her anahtar için PayNkolay'da kart
  listesi okunur, kart çıkarsa silinir (`deleteAllSavedCards`), sonra kolon
  boşaltılır. Doğrulandı (18 Eki 2026): Vercel ortam listesinde
  `PAYNKOLAY_CARD_STORAGE` hiçbir ortamda (production, preview, development)
  tanımlı değil; kart saklama hiç açılmadı.
- Testler: `tests/legal-docs.test.ts` sabit `false` iken hiçbir belgede
  "kart saklama", "kayıtlı kart", "üye anahtarı", "müşteri anahtarı",
  "sonraki ödemeler için kaydet" geçmesine izin vermez;
  `tests/saved-cards.test.ts`, `tests/card-key-gate-*.test.ts`,
  `tests/card-user-key-clear-migration.test.ts`.

### 19.3 Değişen cümleler

Paragraf uzunsa yalnız değişen cümleler gösterilir.

| Belge | Bölüm | Mevcut (17 Eki 2026) | Yeni |
|---|---|---|---|
| Ön Bilgilendirme Formu | 7. Ödeme Şekli, PayNkolay Altyapısı ve 3D Secure | Kart saklama özelliği açıldığında, üye olan ALICI ödeme sayfasındaki "Bu kartı sonraki ödemeler için kaydet" kutucuğunu işaretleyerek kartını kaydedebilir; kutucuk işaretsiz başlar, kart kaydetmek isteğe bağlıdır ve işaretlenmedikçe hiçbir kart kaydedilmez. Bu özellik açılana kadar hiçbir kart kaydedilmez. Kayıtlı kart SATICI tarafından değil, PayNkolay'ın kart saklama hizmeti tarafından saklanır; SATICI yalnızca PayNkolay'ın kayıtlı kartları üyeyle eşleştirmek için kullandığı 11 karakterlik rastgele bir üye anahtarını tutar. Bu anahtar T.C. kimlik numarası veya telefon numarası değildir ve içinde kişisel bir bilgi barındırmaz; kartla ilgili başka hiçbir bilgi SATICI'nın veri tabanına eklenmez. Ödeme sayfasında kayıtlı kart, son dört hanesi, kart markası veya kartı veren banka ve karta verilen ad ile listelenir. Kayıtlı kartla yapılan ödemelerde de 3D Secure doğrulaması uygulanır. Üye, kayıtlı kartını ödeme sayfasından her zaman silebilir; üyelik hesabı silinirken SATICI önce üyeye ait kayıtlı kartların silinmesini PayNkolay'dan ister. | Kart bilgileri sonraki ödemeler için kaydedilmez: SATICI kart bilgisi saklamaz, PayNkolay'dan da kartın saklanmasını istemez; her ödemede kart bilgileri yeniden girilir. |
| Ön Bilgilendirme Formu | 7. Ödeme Şekli, PayNkolay Altyapısı ve 3D Secure | Üyeler için isteğe bağlı kayıtlı kart (kart saklama özelliği açıldığında; kart PayNkolay'ın kart saklama hizmetinde saklanır, kayıtlı kartla ödemede de 3D Secure uygulanır) | (silindi) |
| Ön Bilgilendirme Formu | 9. Siparişin Kurulması, Üyelik Şartı ve Sipariş Akışı | Kart bilgilerinin {{SITE}} üzerindeki güvenli ödeme sayfasında girilmesi (mobil uygulamada bu sayfa cihazın tarayıcı penceresinde açılır; kart saklama özelliği açıldığında üye, kayıtlı kartını da seçebilir) ve ödemenin kartı veren bankanın 3D Secure ekranında onaylanması; sipariş toplamı kupon veya promosyonla sıfıra iniyorsa bu adım uygulanmaz. | Kart bilgilerinin {{SITE}} üzerindeki güvenli ödeme sayfasında girilmesi (mobil uygulamada bu sayfa cihazın tarayıcı penceresinde açılır) ve ödemenin kartı veren bankanın 3D Secure ekranında onaylanması; sipariş toplamı kupon veya promosyonla sıfıra iniyorsa bu adım uygulanmaz. |
| Ön Bilgilendirme Formu | 20. Kişisel Verilerin Korunması ve Ticari Elektronik İletiler | Sipariş sürecinde işlenen kimlik, iletişim, teslimat adresi, sipariş, ödeme işlem kaydı (maskelenmiş kart numarası ve kartı veren banka dâhil; kartın tam numarası, son kullanma tarihi ve güvenlik kodu hariç) ve işlem güvenliği verileri ile, kart saklama özelliği açıldığında kayıtlı kart kullanan üyelerde PayNkolay'ın kartları üyeyle eşleştirmek için kullandığı rastgele üye anahtarı ve kısmi iadenin karta yapılamadığı istisnai hâllerde iade için bildirilen banka hesap bilgisi; 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusu sıfatıyla {{LEGAL_NAME}} tarafından, sözleşmenin kurulması ve ifası, hukuki yükümlülüklerin yerine getirilmesi ve meşru menfaat hukuki sebeplerine dayanılarak, Kanun'un genel ilkelerine uygun biçimde ve amaçla bağlantılı, sınırlı ve ölçülü olarak işlenir. | Sipariş sürecinde işlenen kimlik, iletişim, teslimat adresi, sipariş, ödeme işlem kaydı (maskelenmiş kart numarası ve kartı veren banka dâhil; kartın tam numarası, son kullanma tarihi ve güvenlik kodu hariç) ve işlem güvenliği verileri ile kısmi iadenin karta yapılamadığı istisnai hâllerde iade için bildirilen banka hesap bilgisi; 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusu sıfatıyla {{LEGAL_NAME}} tarafından, sözleşmenin kurulması ve ifası, hukuki yükümlülüklerin yerine getirilmesi ve meşru menfaat hukuki sebeplerine dayanılarak, Kanun'un genel ilkelerine uygun biçimde ve amaçla bağlantılı, sınırlı ve ölçülü olarak işlenir. |
| Mesafeli Satış Sözleşmesi | 7. Ödeme Şekli, PayNkolay Sanal POS ve 3D Secure | Kart saklama özelliği açıldığında, üyelik hesabı bulunan ALICI, ödeme sayfasında varsayılan olarak işaretsiz gelen “Bu kartı sonraki ödemeler için kaydet” kutucuğunu işaretleyerek kartını kaydedebilir; kutucuk işaretlenmedikçe hiçbir kart kaydedilmez ve bu özellik sipariş verilmesinin koşulu değildir. Özellik açılana kadar kart kaydedilmez. Kaydedilen kart SATICI tarafından değil, PayNkolay'ın kart saklama hizmeti tarafından saklanır; SATICI yalnızca PayNkolay'ın kayıtlı kartları üyeyle eşleştirmek için kullandığı 11 karakterlik rastgele bir üye anahtarını tutar. Bu anahtar T.C. kimlik numarası veya telefon numarası değildir ve kişisel veri içermez. Ödeme sayfasında kayıtlı kart; son dört hanesi, kart markası veya kartı veren banka ve kartın takma adıyla listelenir. Kayıtlı kartla yapılan ödemelerde de 3D Secure doğrulaması zorunludur. ALICI kayıtlı kartını ödeme sayfasından dilediği zaman silebilir; üyelik hesabı silinirken SATICI, önce o üyeye ait kayıtlı kartların silinmesini PayNkolay'dan ister. Kartla ilgili olarak SATICI'nın veri tabanına üye anahtarı dışında hiçbir bilgi eklenmez. | Kart bilgileri sonraki ödemeler için kaydedilmez: SATICI kart bilgisi saklamaz, PayNkolay'dan da kartın saklanmasını istemez; her ödemede kart bilgileri yeniden girilir. |
| Mesafeli Satış Sözleşmesi | 16. Kişisel Verilerin İşlenmesi ve Ticari Elektronik İleti | Sipariş sürecinde işlenen kişisel veriler; kimlik (ad-soyad), iletişim (e-posta, telefon, teslimat ve fatura adresi), müşteri işlem (sipariş içeriği, tutar, sipariş geçmişi, harcama geçmişi, sadakat programı damga hareketleri ve kuponlar, iade ve talep kayıtları), finans (maskelenmiş kart numarası, kartı veren banka, işlem referansı, tahsilat kaydı; kart saklama özelliği açıldığında kartını kaydetmeyi seçen üyeler için PayNkolay'ın kayıtlı kartları eşleştirmede kullandığı rastgele üye anahtarı; kısmi iadenin karta yapılamadığı istisnai hâllerde iade için bildirilen banka hesap bilgisi) ve işlem güvenliği (IP adresi, tarayıcı bilgisi, oturum kayıtları, onay kayıtları) kategorilerindedir. | Sipariş sürecinde işlenen kişisel veriler; kimlik (ad-soyad), iletişim (e-posta, telefon, teslimat ve fatura adresi), müşteri işlem (sipariş içeriği, tutar, sipariş geçmişi, harcama geçmişi, sadakat programı damga hareketleri ve kuponlar, iade ve talep kayıtları), finans (maskelenmiş kart numarası, kartı veren banka, işlem referansı, tahsilat kaydı; kısmi iadenin karta yapılamadığı istisnai hâllerde iade için bildirilen banka hesap bilgisi) ve işlem güvenliği (IP adresi, tarayıcı bilgisi, oturum kayıtları, onay kayıtları) kategorilerindedir. |
| İptal, İade ve Cayma Hakkı | 20. Ödeme Altyapısı ve Kredi Kartı İtirazı (Chargeback) | Kart saklama özelliği açıldığında, üyeler ödeme sayfasındaki 'Bu kartı sonraki ödemeler için kaydet' kutusunu kendileri işaretleyerek (kutu işaretsiz gelir) kartlarını kaydedebilir; kayıtlı kart PayNkolay'ın kart saklama hizmetinde tutulur, Satıcı yalnızca rastgele üretilmiş 11 karakterlik bir üye anahtarı saklar ve kayıtlı kartla ödemede de 3D Secure zorunludur. Bu özellik açılana kadar hiçbir kart kaydedilmez. | Kart, sonraki ödemeler için PayNkolay nezdinde de kaydedilmez. |
| Ödeme Koşulları ve Sanal POS | 2. Tanımlar | Kayıtlı kart: Kart saklama özelliği açıldığında üyenin ödeme sayfasında isteğiyle kaydettiği ve PayNkolay'ın kart saklama hizmetinde saklanan kart; Satıcı bu kartın numarasını, son kullanma tarihini veya güvenlik kodunu saklamaz. | (silindi) |
| Ödeme Koşulları ve Sanal POS | 5. Kabul Edilen Ödeme Yöntemleri | Kayıtlı kart (kart saklama özelliği açıldığında; isteğe bağlı, yalnızca üyeler için): 10. maddede açıklandığı üzere PayNkolay'ın kart saklama hizmetinde kaydettiğiniz kartla ödeme; bu ödemede de 3D Secure doğrulaması yapılır. | (silindi) |
| Ödeme Koşulları ve Sanal POS | 10. Ödemenin PayNkolay Üzerinden Alınması ve Kart Verisinin Saklanmaması | Kart saklama özelliği açıldığında, üyeler ödeme sayfasındaki 'Bu kartı sonraki ödemeler için kaydet' kutusunu işaretleyerek kartlarını kaydedebilir; kutu işaretsiz gelir, kartınızı kaydetmeniz zorunlu değildir ve siz işaretlemedikçe hiçbir kart kaydedilmez. Bu özellik açılana kadar hiçbir kart kaydedilmez ve her ödemede kart bilgileri yeniden girilir. Kayıtlı kart Satıcı tarafından değil, PayNkolay'ın kart saklama hizmetinde saklanır. Satıcı yalnızca PayNkolay'ın kartları üyeyle eşleştirmek için kullandığı, rastgele üretilmiş 11 karakterlik bir üye anahtarı tutar; bu anahtar T.C. kimlik numaranız veya telefon numaranız değildir ve kişisel bilgi içermez. Ödeme sayfasında kayıtlı kart; son dört hanesi, kart markası veya kartı veren banka ve verdiğiniz ad ile listelenir. Kayıtlı kartla ödemede de 3D Secure doğrulaması yapılır. Kayıtlı kartınızı ödeme sayfasından dilediğiniz zaman silebilirsiniz; üyelik hesabınız silindiğinde Satıcı, önce PayNkolay'dan hesabınıza ait kayıtlı kartların silinmesini ister. | Kart bilgileriniz sonraki ödemeler için kaydedilmez: Satıcı kart bilgisi saklamaz, PayNkolay'dan da kartınızın saklanmasını istemez; her ödemede kart bilgilerinizi yeniden girersiniz. |
| Ödeme Koşulları ve Sanal POS | 11. 3D Secure Doğrulama Akışı | Kart saklama özelliği açıldığında, üyeyseniz kayıtlı kartlarınızdan birini seçebilir veya işaretsiz gelen 'Bu kartı sonraki ödemeler için kaydet' kutusunu işaretleyerek kartınızı kaydedebilirsiniz. | (silindi) |
| Ödeme Koşulları ve Sanal POS | 11. 3D Secure Doğrulama Akışı | Ödeme sayfasından doğrudan kartı veren bankanın 3D Secure doğrulama ekranına geçersiniz; kayıtlı kartla ödemede de bu adım uygulanır. | Ödeme sayfasından doğrudan kartı veren bankanın 3D Secure doğrulama ekranına geçersiniz. |
| Ödeme Koşulları ve Sanal POS | 26. Ödeme Verilerinin İşlenmesi ve Saklanması | Kart saklama özelliği açıldığında kartını kaydetmeyi seçen üyeler için Satıcı yalnızca PayNkolay'ın kayıtlı kartları üyeyle eşleştirmek için kullandığı rastgele üye anahtarını tutar. | (silindi) |
| Güvenli Alışveriş ve Bilgi Güvenliği | 10. Ödeme Güvenliği: PayNkolay Altyapısı ve Kart Verisinin Saklanmaması | Sistemlerimizde kartın tam numarası, son kullanma tarihi ve güvenlik kodu hiçbir hâlde tutulmaz; kart saklama özelliği açıldığında ve kartınızı kendi tercihinizle kaydetmeniz hâlinde kart, Şirket tarafından değil PayNkolay'ın kart saklama hizmeti tarafından saklanır (bkz. aşağıdaki kayıtlı kart açıklaması). | Sistemlerimizde kartın tam numarası, son kullanma tarihi ve güvenlik kodu hiçbir hâlde tutulmaz; kartınız sonraki ödemeler için PayNkolay nezdinde de kaydedilmez. |
| Güvenli Alışveriş ve Bilgi Güvenliği | 10. Ödeme Güvenliği: PayNkolay Altyapısı ve Kart Verisinin Saklanmaması | Kayıtlı kart (kart saklama özelliği açıldığında; isteğe bağlı, yalnızca üyeler için): Ödeme sayfasındaki 'Bu kartı sonraki ödemeler için kaydet' kutusu varsayılan olarak işaretsizdir; kutuyu işaretlemedikçe hiçbir kart kaydedilmez ve bu özellik açılana kadar da kart kaydedilmez. Kutuyu işaretlerseniz kartınız Şirket tarafından değil, PayNkolay'ın kart saklama hizmeti tarafından saklanır. Şirket yalnızca, PayNkolay'ın kayıtlı kartlarınızı üyelik hesabınızla eşleştirmek için kullandığı, rastgele üretilmiş 11 karakterlik bir üye anahtarını tutar; bu anahtar T.C. kimlik numaranız veya telefon numaranız değildir ve kişisel bilgi içermez. Ödeme sayfasında kayıtlı kart; son dört hanesi, kart markası veya kartı veren banka ve verdiğiniz ad ile listelenir. Kayıtlı kartla yapılan ödemelerde de 3D Secure doğrulaması uygulanır. Kayıtlı kartınızı ödeme sayfasından dilediğiniz zaman silebilirsiniz; üyelik hesabınız silindiğinde Şirket, önce PayNkolay'dan hesabınıza ait kayıtlı kartların silinmesini ister. | (silindi) |
| Güvenli Alışveriş ve Bilgi Güvenliği | 17. Veri Saklama ve İmha | Kart saklama özelliği açıldığında ve kayıtlı kart özelliğini kullandıysanız, PayNkolay'ın kayıtlı kartlarınızı eşleştirmek için kullandığı müşteri anahtarı hesabınız açık olduğu sürece tutulur; hesabınız silindiğinde bu anahtar silinir ve PayNkolay'dan kayıtlı kartlarınızın silinmesi talep edilir. | (silindi) |
| Güvenli Alışveriş ve Bilgi Güvenliği | 22. Tedarikçi ve Alt İşleyen Güvenliği | PayNkolay (N Kolay Ödeme ve Elektronik Para Kuruluşu A.Ş.); kartlı ödemenin işlenmesi, 3D Secure doğrulaması için kartı veren bankaya yönlendirme, ödeme sonucunun doğrulanması, iptal ve iade işlemleri ile kart saklama özelliği açıldığında üyenin kendi tercihiyle kaydettiği kartların saklanması. | PayNkolay (N Kolay Ödeme ve Elektronik Para Kuruluşu A.Ş.); kartlı ödemenin işlenmesi, 3D Secure doğrulaması için kartı veren bankaya yönlendirme, ödeme sonucunun doğrulanması, iptal ve iade işlemleri. |
| Gizlilik Politikası | 3. İşlenen Kişisel Veri Kategorileri | Üyelik kaydı, kullanıcı adı/e-posta, parolanızın özeti (hash; sitede bcrypt algoritmasıyla, kimlik doğrulama hizmeti sağlayıcısında o sağlayıcının kendi yöntemiyle), e-posta doğrulama durumu ve doğrulama zaman damgası, parola sıfırlama talepleri, kayıtlı adres defteri, favori/istek listesi, isteğe bağlı olarak eklediğiniz doğum tarihi, kaydettiğiniz 'her zamanki' içecek tercihi, hesap tercihleri, ödeme sayfasındaki kayıtlı kart özelliği için üyeliğinize atanan rastgele 11 karakterlik müşteri anahtarı (T.C. kimlik numaranızı, telefon numaranızı veya başka bir kişisel bilginizi içermez; kayıtlı kartın kendisi Şirkette tutulmaz) ile davet kodunuz ve sizi davet eden üyenin kaydı. | Üyelik kaydı, kullanıcı adı/e-posta, parolanızın özeti (hash; sitede bcrypt algoritmasıyla, kimlik doğrulama hizmeti sağlayıcısında o sağlayıcının kendi yöntemiyle), e-posta doğrulama durumu ve doğrulama zaman damgası, parola sıfırlama talepleri, kayıtlı adres defteri, favori/istek listesi, isteğe bağlı olarak eklediğiniz doğum tarihi, kaydettiğiniz 'her zamanki' içecek tercihi, hesap tercihleri ile davet kodunuz ve sizi davet eden üyenin kaydı. |
| Gizlilik Politikası | 5. İşleme Amaçları ve Hukuki Sebepler | Kartlı ödemenin ödeme hizmeti sağlayıcısı PayNkolay üzerinden 3D Secure doğrulamasıyla tahsil edilmesi, ödeme sonucunun PayNkolay'a sorularak teyit edilmesi, iade ve itiraz (chargeback) süreçlerinin yürütülmesi; kayıtlı kart özelliği açıldığında, bu özelliği seçen üyeler için kayıtlı kart hizmetinin sunulması | Kartlı ödemenin ödeme hizmeti sağlayıcısı PayNkolay üzerinden 3D Secure doğrulamasıyla tahsil edilmesi, ödeme sonucunun PayNkolay'a sorularak teyit edilmesi, iade ve itiraz (chargeback) süreçlerinin yürütülmesi |
| Gizlilik Politikası | 8. Kişisel Verilerin Aktarıldığı Taraf Kategorileri | Kayıtlı kart özelliği açıldığında: özellik isteğe bağlıdır ve yalnızca üyelere sunulur; ödeme sayfasındaki 'Bu kartı sonraki ödemeler için kaydet' kutusu işaretsiz gelir ve siz işaretlemedikçe hiçbir kart kaydedilmez. Kayıtlı kartı Şirket değil PayNkolay'ın kart saklama hizmeti saklar; Şirket yalnızca PayNkolay'ın kartları üyeliğinizle eşleştirmek için kullandığı rastgele 11 karakterlik müşteri anahtarını tutar ve kartı kaydetmeyi veya kayıtlı kartla ödemeyi seçtiğinizde bu anahtarı PayNkolay'a iletir; kartla ilgili başka hiçbir bilgi Şirketin veri tabanına eklenmez. Kayıtlı kartlarınız ödeme sayfasında son dört haneleri, kart markası veya kartı veren banka ve karta verdiğiniz adla listelenir; kayıtlı kartla yapılan ödemede de 3D Secure doğrulaması uygulanır. Kayıtlı kartı ödeme sayfasından dilediğiniz zaman silebilirsiniz; hesabınız kapatılırken Şirket önce PayNkolay'dan size ait kayıtlı kartların silinmesini ister. | Kart bilgileriniz sonraki ödemeler için PayNkolay nezdinde de kaydedilmez. |
| Gizlilik Politikası | 10. Saklama Süreleri ve İmha | Kayıtlı kart müşteri anahtarı (kayıtlı kart özelliği açıldığında) | (silindi) |
| Gizlilik Politikası | 10. Saklama Süreleri ve İmha | Üyelik devam ettiği sürece. Kayıtlı bir kartı ödeme sayfasından dilediğiniz zaman silebilirsiniz; hesabınız kapatıldığında anahtar silinir ve Şirket, PayNkolay'dan size ait kayıtlı kartların silinmesini ister. | (silindi) |
| Gizlilik Politikası | 14. Mobil Uygulama, Cihaz İzinleri ve Uygulama Mağazaları | Hesabın kapatılmasıyla biriken damgalar ve kullanılmamış kuponlar sona erer; kayıtlı kart özelliği açıksa Şirket ayrıca PayNkolay'dan size ait kayıtlı kartların silinmesini ister (ayrıntı: {{SITE_URL}}/hukuk/hesap-silme). | Hesabın kapatılmasıyla biriken damgalar ve kullanılmamış kuponlar sona erer (ayrıntı: {{SITE_URL}}/hukuk/hesap-silme). |
| KVKK Aydınlatma Metni | 6. İşlenen Kişisel Veri Kategorileri | Kart saklama özelliği açıldığında, kartını kaydetmeyi seçen üyelerin kartı PayNkolay'ın kart saklama hizmetinde saklanır; tarafımızca yalnızca PayNkolay'ın kayıtlı kartları üyeyle eşleştirmek için kullandığı, kişisel bilgi taşımayan rastgele 11 karakterlik bir üye anahtarı tutulur. | Kart, sonraki ödemeler için PayNkolay nezdinde de kaydedilmez. |
| KVKK Aydınlatma Metni | 7. Kişisel Verilerin İşlenme Amaçları | Ödeme işlemlerinin gerçekleştirilmesi ve güvenliği: Ödemenin ödeme hizmeti sağlayıcısı PayNkolay aracılığıyla tek çekim olarak tahsili (taksit ve ön provizyon uygulanmaz; tutar, ödemeyi onayladığınız anda tahsil edilir); kart bilgilerinin {{SITE}} üzerindeki güvenli ödeme sayfasında alınması ve kaydedilmeden, şifreli bağlantıyla yalnızca PayNkolay'a iletilmesi; kartı veren bankanın ekranında 3D Secure doğrulaması; kart saklama özelliği açıldığında, kartını kaydetmeyi seçen üyelerde kayıtlı kartların PayNkolay'ın kart saklama hizmeti üzerinden gösterilmesi, kullanılması ve silinmesi; ödeme sonucunun sunucumuzdan PayNkolay işlem doğrulama servisine sorularak teyit edilmesi ve sipariş kaydına işlenmesi; tutarın tamamı kupon veya promosyonla karşılanan siparişlerin kart ödemesi olmaksızın kapatılması; mükerrer işlemin önlenmesi, kart denemelerinin sınırlanması ve dolandırıcılık riskinin önlenmesi; iptal, iade, kısmi iade ve ters ibraz (chargeback) süreçlerinin yönetilmesi. | Ödeme işlemlerinin gerçekleştirilmesi ve güvenliği: Ödemenin ödeme hizmeti sağlayıcısı PayNkolay aracılığıyla tek çekim olarak tahsili (taksit ve ön provizyon uygulanmaz; tutar, ödemeyi onayladığınız anda tahsil edilir); kart bilgilerinin {{SITE}} üzerindeki güvenli ödeme sayfasında alınması ve kaydedilmeden, şifreli bağlantıyla yalnızca PayNkolay'a iletilmesi; kartı veren bankanın ekranında 3D Secure doğrulaması; ödeme sonucunun sunucumuzdan PayNkolay işlem doğrulama servisine sorularak teyit edilmesi ve sipariş kaydına işlenmesi; tutarın tamamı kupon veya promosyonla karşılanan siparişlerin kart ödemesi olmaksızın kapatılması; mükerrer işlemin önlenmesi, kart denemelerinin sınırlanması ve dolandırıcılık riskinin önlenmesi; iptal, iade, kısmi iade ve ters ibraz (chargeback) süreçlerinin yönetilmesi. |
| KVKK Aydınlatma Metni | 8. İşleme Amaçlarının Hukuki Sebepleri (KVKK m.5 ve m.6) | Ödemenin ödeme hizmeti sağlayıcısı PayNkolay aracılığıyla tahsili, 3D Secure doğrulaması, kart saklama özelliği açıldığında üyenin talebiyle kayıtlı kart hizmeti, iptal, iade ve ters ibraz (chargeback) yönetimi | Ödemenin ödeme hizmeti sağlayıcısı PayNkolay aracılığıyla tahsili, 3D Secure doğrulaması, iptal, iade ve ters ibraz (chargeback) yönetimi |
| KVKK Aydınlatma Metni | 10. Kişisel Verilerin Toplanma Yöntemleri | Ödeme altyapısı: {{SITE}} üzerindeki güvenli ödeme sayfasında girdiğiniz kart bilgileri (kaydedilmeden yalnızca PayNkolay'a iletilir); ödeme hizmeti sağlayıcısı PayNkolay'ın işlem doğrulama servisine sunucumuzdan yapılan sorgu ile alınan işlem sonucu, referans kodu ve maskelenmiş kart bilgisi; kart saklama özelliği açıldığında, kartını kaydetmeyi seçen üyeler için ödeme sayfasında gösterilmek üzere PayNkolay'ın kart saklama hizmetinden alınan kartın son dört hanesi, kartı veren banka veya kart markası ve kart takma adı; itirazlarda bankanın ve PayNkolay'ın ilettiği bilgiler. | Ödeme altyapısı: {{SITE}} üzerindeki güvenli ödeme sayfasında girdiğiniz kart bilgileri (kaydedilmeden yalnızca PayNkolay'a iletilir); ödeme hizmeti sağlayıcısı PayNkolay'ın işlem doğrulama servisine sunucumuzdan yapılan sorgu ile alınan işlem sonucu, referans kodu ve maskelenmiş kart bilgisi; itirazlarda bankanın ve PayNkolay'ın ilettiği bilgiler. |
| KVKK Aydınlatma Metni | 14. Kişisel Verilerin Aktarılması | Ödemenin tek çekim olarak tahsili, kartı veren bankanın ekranında 3D Secure doğrulaması, ödeme sonucunun PayNkolay işlem doğrulama servisinden sorgulanması, iptal, iade ve ters ibraz (chargeback) süreçlerinin yürütülmesi ve kart saklama özelliği açıldığında kartını kaydetmeyi seçen üyeler için kart saklama hizmeti. | Ödemenin tek çekim olarak tahsili, kartı veren bankanın ekranında 3D Secure doğrulaması, ödeme sonucunun PayNkolay işlem doğrulama servisinden sorgulanması, iptal, iade ve ters ibraz (chargeback) süreçlerinin yürütülmesi. |
| KVKK Aydınlatma Metni | 14. Kişisel Verilerin Aktarılması | Aktarılan veri: kart üzerindeki ad, kart numarası, son kullanma tarihi ve güvenlik kodu (tarafımızca kaydedilmeden, yalnızca ödeme işlemi için), ödeme isteğinin gönderildiği IP adresi, sipariş numarası, tutar ve para birimi; kart saklama özelliği açıldığında kartını kaydetmeyi seçen üyeler için üye anahtarı ve kart takma adı. | Aktarılan veri: kart üzerindeki ad, kart numarası, son kullanma tarihi ve güvenlik kodu (tarafımızca kaydedilmeden, yalnızca ödeme işlemi için), ödeme isteğinin gönderildiği IP adresi, sipariş numarası, tutar ve para birimi. |
| KVKK Aydınlatma Metni | 16. Saklama Süreleri ve İmha | Kart saklama özelliği açıldığında ve kartını kaydetmeyi seçen üyelerde üye anahtarı üyelik süresince tutulur; kayıtlı kartlarınızı ödeme sayfasında dilediğiniz zaman silebilirsiniz ve hesabınız kapatıldığında önce kayıtlı kartlarınızın silinmesi PayNkolay'dan istenir. | (silindi) |
| Veri Sahibi Başvuru Formu | 9. Talebin Açıklanması ve Destekleyici Belgeler | Kayıtlı kartlara ilişkin talepler için (kart saklama özelliği açıldığında): Kart saklama üyeler için isteğe bağlıdır ve kart, yalnızca ödeme sayfasındaki kartı kaydetme kutusunu siz işaretlerseniz kaydedilir; kutu işaretsiz gelir. Kayıtlı kartlar şirketimizde değil, PayNkolay'ın kart saklama hizmetinde tutulur; şirketimiz yalnızca kartlarınızı üyeliğinizle eşleştirmeye yarayan, T.C. kimlik veya telefon numaranızı ve başka kişisel veri içermeyen, rastgele üretilmiş bir üye anahtarını saklar. Kayıtlı bir kartı ödeme sayfasından istediğiniz zaman silebilirsiniz; üyeliğinizin silinmesi hâlinde şirketimiz önce kayıtlı kartlarınızın silinmesini PayNkolay'dan ister. Bu özellik açılana kadar hiçbir kart kaydedilmez. | (silindi) |
| Kişisel Veri Saklama ve İmha Politikası | 5. Kayıt Ortamları | Kart saklama özelliği açıldığında üyenin isteğe bağlı olarak kaydettiği kartlar Şirket nezdinde değil, PayNkolay'ın kart saklama hizmetinde tutulur; Şirket yalnızca bu kartları üyeyle eşleştirmeye yarayan rastgele bir müşteri anahtarını tutar. | (silindi) |
| Kişisel Veri Saklama ve İmha Politikası | 8. Veri Kategorileri Bazında Saklama ve İmha Süreleri | Kayıtlı kart müşteri anahtarı (üyenin ödeme işlemi sırasında rastgele üretilen; T.C. kimlik numarası, telefon numarası veya başka bir kişisel bilgi içermeyen 11 karakterlik anahtar) | (silindi) |
| Kişisel Veri Saklama ve İmha Politikası | 8. Veri Kategorileri Bazında Saklama ve İmha Süreleri | Üyelik ilişkisi süresince saklanır. Anahtar, Kart saklama özelliği açıldığında kayıtlı kartları üyeyle eşleştirmek için PayNkolay'a iletilir; özellik açılmadan önce hiçbir kart kaydedilmez. Kayıtlı kartların kendisi Şirket nezdinde değil, PayNkolay'ın kart saklama hizmetinde tutulur; ödeme sayfasında gösterilen kartın son dört hanesi, kartı veren banka veya kart markası ve kart takma adı da PayNkolay'dan alınır ve Şirket tarafından saklanmaz. Kart ancak üyenin ödeme sayfasındaki "Bu kartı sonraki ödemeler için kaydet" kutusunu işaretlemesiyle kaydedilir; kayıtlı kartla ödemede de 3D Secure doğrulaması yapılır. Üye kayıtlı bir kartı ödeme sayfasından dilediği zaman silebilir. Üyelik hesabı kapatıldığında önce PayNkolay'dan üyeye ait kayıtlı kartların silinmesi istenir, ardından anahtar silinir. | (silindi) |
| Kişisel Veri Saklama ve İmha Politikası | 16. İlgili Kişinin Talebi Üzerine Silme veya Yok Etme | Hesap kapatıldığında PayNkolay'dan üyeye ait kayıtlı kartların silinmesi istenir ve kartları üyeyle eşleştiren müşteri anahtarı silinir. | (silindi) |
| Kişisel Veri Saklama ve İmha Politikası | 18. Teknik ve İdari Tedbirler | Teknik: Kart numarası, son kullanma tarihi ve güvenlik kodunun {{SITE}} üzerindeki güvenli ödeme sayfasında girilmesi ve şifreli bağlantıyla Şirket sunucusu üzerinden aynı işlemde yalnızca PayNkolay'a iletilmesi; bu bilgilerin Şirket sistemlerinde hiçbir aşamada kaydedilmemesi, saklanmaması ve kayıtlara (log) yazılmaması; ödeme sayfasında üçüncü taraf betik çalıştırılmaması ve sayfanın başka bir sitenin içine yerleştirilememesi; kart denemelerinin sipariş başına ve bağlantı başına sınırlandırılması; kayıtlı kartla yapılanlar dâhil her kartlı ödemede kartı veren bankanın 3D Secure ekranında doğrulama yapılması. | Teknik: Kart numarası, son kullanma tarihi ve güvenlik kodunun {{SITE}} üzerindeki güvenli ödeme sayfasında girilmesi ve şifreli bağlantıyla Şirket sunucusu üzerinden aynı işlemde yalnızca PayNkolay'a iletilmesi; bu bilgilerin Şirket sistemlerinde hiçbir aşamada kaydedilmemesi, saklanmaması ve kayıtlara (log) yazılmaması; ödeme sayfasında üçüncü taraf betik çalıştırılmaması ve sayfanın başka bir sitenin içine yerleştirilememesi; kart denemelerinin sipariş başına ve bağlantı başına sınırlandırılması; her kartlı ödemede kartı veren bankanın 3D Secure ekranında doğrulama yapılması. |
| Üyelik Sözleşmesi | 8. Ödeme Bilgileri ve Kart Verilerinin Saklanmaması | Kart saklama özelliği açıldığında, Üye ödeme sayfasında kartını sonraki ödemeler için kaydetmeyi seçebilir. Bu özellik isteğe bağlıdır ve yalnızca üyelere sunulur; 'Bu kartı sonraki ödemeler için kaydet' kutusu işaretsiz gelir ve Üye işaretlemedikçe hiçbir kart kaydedilmez. Kayıtlı kart Şirket tarafından değil, PayNkolay'ın kart saklama hizmeti tarafından saklanır; Şirket'in veri tabanında kart bilgisi tutulmaz, yalnızca PayNkolay'ın kartları Üye ile eşleştirmek için kullandığı, rastgele üretilmiş 11 karakterlik bir üye anahtarı bulunur. Bu anahtar kimlik numarası veya telefon numarası değildir ve Üye'ye ilişkin başka bir bilgi içermez. Ödeme sayfasında kayıtlı kart son dört hanesi, kart markası veya kartı veren banka ve takma adıyla listelenir; kayıtlı kartla yapılan ödemelerde de 3D Secure uygulanır. Üye kayıtlı kartını ödeme sayfasından dilediği zaman silebilir. Hesap kapatılırken Şirket önce PayNkolay'dan Üye'nin kayıtlı kartlarının silinmesini ister. Kart saklama özelliği açılana kadar hiçbir kart kaydedilmez. | Kart bilgileri sonraki ödemeler için kaydedilmez: Şirket kart bilgisi saklamaz, PayNkolay'dan da Üye'nin kartının saklanmasını istemez; her ödemede kart bilgileri yeniden girilir. |
| Üyelik Sözleşmesi | 14. Üyeliğin Üye Tarafından Sona Erdirilmesi | Kart saklama özelliği açıldığında, hesap kapatılırken Şirket önce PayNkolay'dan Üye'nin kayıtlı kartlarının silinmesini ister. | (silindi) |
| Hesap Silme ve Üyelik Sonlandırma Prosedürü | 5. Hesap Kapatıldığında Hemen Silinen Veriler | Kayıtlı kartlarınız: kart saklama özelliği açık olduğu dönemde ödeme sayfasında kartınızı kaydetmeyi seçtiyseniz, kartınız bizde değil, ödeme hizmeti sağlayıcısı PayNkolay'ın kart saklama hizmetinde tutulur. Hesap kapatılırken Satıcı önce PayNkolay'dan üyeliğinize ait kayıtlı kartların silinmesini ister; ardından kartları üyeliğinizle eşleştirmek için tuttuğumuz rastgele müşteri anahtarını siler. Bu anahtar T.C. kimlik numaranızı, telefon numaranızı veya başka bir kişisel veriyi içermez. PayNkolay'a o anda ulaşılamasa da hesap kapatılır; kayıtlı kartlarınızın silinip silinmediğini {{EMAIL}} adresinden sorabilirsiniz. | (silindi) |
| Mobil Uygulama Kullanım Koşulları | 12. Uygulama Üzerinden Sipariş ve Ödeme | Kart saklama özelliği açıldığında, üyeler ödeme sayfasında isteğe bağlı olarak 'Bu kartı sonraki ödemeler için kaydet' kutusunu işaretleyebilir; kutu işaretsiz gelir ve işaretlenmediği sürece kart kaydedilmez. Kayıtlı kart Şirket tarafından değil, PayNkolay'ın kart saklama hizmetinde tutulur; Şirket yalnızca PayNkolay'ın kartları üyeyle eşleştirmek için kullandığı, rastgele üretilmiş ve kimlik veya telefon numarası içermeyen bir üye anahtarını saklar. Ödeme sayfasında kayıtlı kart son dört hanesi, kart markası veya bankası ve takma adıyla listelenir; kayıtlı kartla ödemede de 3D Secure zorunludur, üye kayıtlı kartını ödeme sayfasında dilediği zaman silebilir ve hesabını sildiğinde Şirket önce PayNkolay'dan kayıtlı kartlarının silinmesini ister. Bu özellik açılana kadar hiçbir kart kaydedilmez. | Kart bilgileri sonraki ödemeler için kaydedilmez: Şirket kart bilgisi saklamaz, PayNkolay'dan da üyenin kartının saklanmasını istemez; her ödemede kart bilgileri yeniden girilir. |
| Mobil Uygulama Kullanım Koşulları | 17. Uygulamanın Kaldırılması ve Hesabın Silinmesi | Hesabın silinmesiyle birlikte biriken damgalar ve kullanılmamış ücretsiz içecek hakkı sona erer; kart saklama özelliği açıksa Şirket üyenin kayıtlı kartlarının silinmesini önce PayNkolay'dan ister; adres defteri ve tercihler erişime kapatılır, ticari elektronik ileti onayı bulunuyorsa ret kaydı İYS üzerine işlenir. | Hesabın silinmesiyle birlikte biriken damgalar ve kullanılmamış ücretsiz içecek hakkı sona erer; adres defteri ve tercihler erişime kapatılır, ticari elektronik ileti onayı bulunuyorsa ret kaydı İYS üzerine işlenir. |
| Şirket ve İletişim Bilgileri | 7. Ödeme Altyapısı ve Ödeme Bilgileri | Kart saklama özelliği açıldığında ve yalnızca üyenin açık tercihiyle kaydedilen kart, Şirkette değil PayNkolay'ın kart saklama hizmetinde tutulur; Şirket kartı değil, yalnızca üyeyi PayNkolay nezdindeki kartlarla eşleştiren rastgele bir anahtarı saklar. Bu özellik açılana kadar hiçbir kart kaydedilmez. | Kart, sonraki ödemeler için PayNkolay nezdinde de kaydedilmez. |
| Kafe Hizmet Koşulları | 8. Ödeme Yöntemleri, Fiş ve Fatura | Kart saklama özelliği açıldığında, yalnızca üyeler için ve isteğe bağlı olarak sunulur: ödeme sayfasındaki 'Bu kartı sonraki ödemeler için kaydet' kutusu başlangıçta işaretsizdir ve işaretlenmedikçe hiçbir kart kaydedilmez. Kayıtlı kart İşletme tarafından değil, PayNkolay'ın kart saklama hizmetinde saklanır; İşletme yalnızca PayNkolay'ın kartları üyeyle eşleştirmek için kullandığı rastgele bir üye anahtarını tutar. Ödeme sayfasında kayıtlı kart son dört hanesi, kart markası veya kartı veren banka ve takma adıyla gösterilir; kayıtlı kartla ödemede de 3D Secure zorunludur, kayıtlı kartı ödeme sayfasından dilediğiniz zaman silebilirsiniz ve hesabınız silindiğinde İşletme önce PayNkolay'dan kayıtlı kartlarınızın silinmesini ister. Bu özellik açılana kadar hiçbir kart kaydedilmez. | Kart bilgileriniz sonraki ödemeler için kaydedilmez: İşletme kart bilgisi saklamaz, PayNkolay'dan da kartınızın saklanmasını istemez. |

### 19.4 Kayıtlı kart açılırsa geri gelecek metin

Her madde: belge, bölüm, bugünkü metin; altında kaldırılan pasaj olduğu gibi.
Tablo satırları (anahtar ve değer) ayrı maddedir.

1. **Ön Bilgilendirme Formu**, 7. Ödeme Şekli, PayNkolay Altyapısı ve 3D Secure. Bugün: “Kart bilgileri sonraki ödemeler için kaydedilmez: SATICI kart bilgisi saklamaz, PayNkolay'dan da kartın saklanmasını istemez; her ödemede kart bilgileri yeniden girilir.”

   > Kart saklama özelliği açıldığında, üye olan ALICI ödeme sayfasındaki "Bu kartı sonraki ödemeler için kaydet" kutucuğunu işaretleyerek kartını kaydedebilir; kutucuk işaretsiz başlar, kart kaydetmek isteğe bağlıdır ve işaretlenmedikçe hiçbir kart kaydedilmez. Bu özellik açılana kadar hiçbir kart kaydedilmez. Kayıtlı kart SATICI tarafından değil, PayNkolay'ın kart saklama hizmeti tarafından saklanır; SATICI yalnızca PayNkolay'ın kayıtlı kartları üyeyle eşleştirmek için kullandığı 11 karakterlik rastgele bir üye anahtarını tutar. Bu anahtar T.C. kimlik numarası veya telefon numarası değildir ve içinde kişisel bir bilgi barındırmaz; kartla ilgili başka hiçbir bilgi SATICI'nın veri tabanına eklenmez. Ödeme sayfasında kayıtlı kart, son dört hanesi, kart markası veya kartı veren banka ve karta verilen ad ile listelenir. Kayıtlı kartla yapılan ödemelerde de 3D Secure doğrulaması uygulanır. Üye, kayıtlı kartını ödeme sayfasından her zaman silebilir; üyelik hesabı silinirken SATICI önce üyeye ait kayıtlı kartların silinmesini PayNkolay'dan ister.

2. **Ön Bilgilendirme Formu**, 7. Ödeme Şekli, PayNkolay Altyapısı ve 3D Secure. Bugün: pasaj yok (madde ya da satır silindi)

   > Üyeler için isteğe bağlı kayıtlı kart (kart saklama özelliği açıldığında; kart PayNkolay'ın kart saklama hizmetinde saklanır, kayıtlı kartla ödemede de 3D Secure uygulanır)

3. **Ön Bilgilendirme Formu**, 9. Siparişin Kurulması, Üyelik Şartı ve Sipariş Akışı. Bugün: “Kart bilgilerinin {{SITE}} üzerindeki güvenli ödeme sayfasında girilmesi (mobil uygulamada bu sayfa cihazın tarayıcı penceresinde açılır) ve ödemenin kartı veren bankanın 3D Secure ekranında onaylanması; sipariş toplamı kupon veya promosyonla sıfıra iniyorsa bu adım uygulanmaz.”

   > Kart bilgilerinin {{SITE}} üzerindeki güvenli ödeme sayfasında girilmesi (mobil uygulamada bu sayfa cihazın tarayıcı penceresinde açılır; kart saklama özelliği açıldığında üye, kayıtlı kartını da seçebilir) ve ödemenin kartı veren bankanın 3D Secure ekranında onaylanması; sipariş toplamı kupon veya promosyonla sıfıra iniyorsa bu adım uygulanmaz.

4. **Ön Bilgilendirme Formu**, 20. Kişisel Verilerin Korunması ve Ticari Elektronik İletiler. Bugün: “Sipariş sürecinde işlenen kimlik, iletişim, teslimat adresi, sipariş, ödeme işlem kaydı (maskelenmiş kart numarası ve kartı veren banka dâhil; kartın tam numarası, son kullanma tarihi ve güvenlik kodu hariç) ve işlem güvenliği verileri ile kısmi iadenin karta yapılamadığı istisnai hâllerde iade için bildirilen banka hesap bilgisi; 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusu sıfatıyla {{LEGAL_NAME}} tarafından, sözleşmenin kurulması ve ifası, hukuki yükümlülüklerin yerine getirilmesi ve meşru menfaat hukuki sebeplerine dayanılarak, Kanun'un genel ilkelerine uygun biçimde ve amaçla bağlantılı, sınırlı ve ölçülü olarak işlenir.”

   > Sipariş sürecinde işlenen kimlik, iletişim, teslimat adresi, sipariş, ödeme işlem kaydı (maskelenmiş kart numarası ve kartı veren banka dâhil; kartın tam numarası, son kullanma tarihi ve güvenlik kodu hariç) ve işlem güvenliği verileri ile, kart saklama özelliği açıldığında kayıtlı kart kullanan üyelerde PayNkolay'ın kartları üyeyle eşleştirmek için kullandığı rastgele üye anahtarı ve kısmi iadenin karta yapılamadığı istisnai hâllerde iade için bildirilen banka hesap bilgisi; 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusu sıfatıyla {{LEGAL_NAME}} tarafından, sözleşmenin kurulması ve ifası, hukuki yükümlülüklerin yerine getirilmesi ve meşru menfaat hukuki sebeplerine dayanılarak, Kanun'un genel ilkelerine uygun biçimde ve amaçla bağlantılı, sınırlı ve ölçülü olarak işlenir.

5. **Mesafeli Satış Sözleşmesi**, 7. Ödeme Şekli, PayNkolay Sanal POS ve 3D Secure. Bugün: “Kart bilgileri sonraki ödemeler için kaydedilmez: SATICI kart bilgisi saklamaz, PayNkolay'dan da kartın saklanmasını istemez; her ödemede kart bilgileri yeniden girilir.”

   > Kart saklama özelliği açıldığında, üyelik hesabı bulunan ALICI, ödeme sayfasında varsayılan olarak işaretsiz gelen “Bu kartı sonraki ödemeler için kaydet” kutucuğunu işaretleyerek kartını kaydedebilir; kutucuk işaretlenmedikçe hiçbir kart kaydedilmez ve bu özellik sipariş verilmesinin koşulu değildir. Özellik açılana kadar kart kaydedilmez. Kaydedilen kart SATICI tarafından değil, PayNkolay'ın kart saklama hizmeti tarafından saklanır; SATICI yalnızca PayNkolay'ın kayıtlı kartları üyeyle eşleştirmek için kullandığı 11 karakterlik rastgele bir üye anahtarını tutar. Bu anahtar T.C. kimlik numarası veya telefon numarası değildir ve kişisel veri içermez. Ödeme sayfasında kayıtlı kart; son dört hanesi, kart markası veya kartı veren banka ve kartın takma adıyla listelenir. Kayıtlı kartla yapılan ödemelerde de 3D Secure doğrulaması zorunludur. ALICI kayıtlı kartını ödeme sayfasından dilediği zaman silebilir; üyelik hesabı silinirken SATICI, önce o üyeye ait kayıtlı kartların silinmesini PayNkolay'dan ister. Kartla ilgili olarak SATICI'nın veri tabanına üye anahtarı dışında hiçbir bilgi eklenmez.

6. **Mesafeli Satış Sözleşmesi**, 16. Kişisel Verilerin İşlenmesi ve Ticari Elektronik İleti. Bugün: “Sipariş sürecinde işlenen kişisel veriler; kimlik (ad-soyad), iletişim (e-posta, telefon, teslimat ve fatura adresi), müşteri işlem (sipariş içeriği, tutar, sipariş geçmişi, harcama geçmişi, sadakat programı damga hareketleri ve kuponlar, iade ve talep kayıtları), finans (maskelenmiş kart numarası, kartı veren banka, işlem referansı, tahsilat kaydı; kısmi iadenin karta yapılamadığı istisnai hâllerde iade için bildirilen banka hesap bilgisi) ve işlem güvenliği (IP adresi, tarayıcı bilgisi, oturum kayıtları, onay kayıtları) kategorilerindedir.”

   > Sipariş sürecinde işlenen kişisel veriler; kimlik (ad-soyad), iletişim (e-posta, telefon, teslimat ve fatura adresi), müşteri işlem (sipariş içeriği, tutar, sipariş geçmişi, harcama geçmişi, sadakat programı damga hareketleri ve kuponlar, iade ve talep kayıtları), finans (maskelenmiş kart numarası, kartı veren banka, işlem referansı, tahsilat kaydı; kart saklama özelliği açıldığında kartını kaydetmeyi seçen üyeler için PayNkolay'ın kayıtlı kartları eşleştirmede kullandığı rastgele üye anahtarı; kısmi iadenin karta yapılamadığı istisnai hâllerde iade için bildirilen banka hesap bilgisi) ve işlem güvenliği (IP adresi, tarayıcı bilgisi, oturum kayıtları, onay kayıtları) kategorilerindedir.

7. **İptal, İade ve Cayma Hakkı**, 20. Ödeme Altyapısı ve Kredi Kartı İtirazı (Chargeback). Bugün: “Kart, sonraki ödemeler için PayNkolay nezdinde de kaydedilmez.”

   > Kart saklama özelliği açıldığında, üyeler ödeme sayfasındaki 'Bu kartı sonraki ödemeler için kaydet' kutusunu kendileri işaretleyerek (kutu işaretsiz gelir) kartlarını kaydedebilir; kayıtlı kart PayNkolay'ın kart saklama hizmetinde tutulur, Satıcı yalnızca rastgele üretilmiş 11 karakterlik bir üye anahtarı saklar ve kayıtlı kartla ödemede de 3D Secure zorunludur. Bu özellik açılana kadar hiçbir kart kaydedilmez.

8. **Ödeme Koşulları ve Sanal POS**, 2. Tanımlar. Bugün: pasaj yok (madde ya da satır silindi)

   > Kayıtlı kart: Kart saklama özelliği açıldığında üyenin ödeme sayfasında isteğiyle kaydettiği ve PayNkolay'ın kart saklama hizmetinde saklanan kart; Satıcı bu kartın numarasını, son kullanma tarihini veya güvenlik kodunu saklamaz.

9. **Ödeme Koşulları ve Sanal POS**, 5. Kabul Edilen Ödeme Yöntemleri. Bugün: pasaj yok (madde ya da satır silindi)

   > Kayıtlı kart (kart saklama özelliği açıldığında; isteğe bağlı, yalnızca üyeler için): 10. maddede açıklandığı üzere PayNkolay'ın kart saklama hizmetinde kaydettiğiniz kartla ödeme; bu ödemede de 3D Secure doğrulaması yapılır.

10. **Ödeme Koşulları ve Sanal POS**, 10. Ödemenin PayNkolay Üzerinden Alınması ve Kart Verisinin Saklanmaması. Bugün: “Kart bilgileriniz sonraki ödemeler için kaydedilmez: Satıcı kart bilgisi saklamaz, PayNkolay'dan da kartınızın saklanmasını istemez; her ödemede kart bilgilerinizi yeniden girersiniz.”

   > Kart saklama özelliği açıldığında, üyeler ödeme sayfasındaki 'Bu kartı sonraki ödemeler için kaydet' kutusunu işaretleyerek kartlarını kaydedebilir; kutu işaretsiz gelir, kartınızı kaydetmeniz zorunlu değildir ve siz işaretlemedikçe hiçbir kart kaydedilmez. Bu özellik açılana kadar hiçbir kart kaydedilmez ve her ödemede kart bilgileri yeniden girilir. Kayıtlı kart Satıcı tarafından değil, PayNkolay'ın kart saklama hizmetinde saklanır. Satıcı yalnızca PayNkolay'ın kartları üyeyle eşleştirmek için kullandığı, rastgele üretilmiş 11 karakterlik bir üye anahtarı tutar; bu anahtar T.C. kimlik numaranız veya telefon numaranız değildir ve kişisel bilgi içermez. Ödeme sayfasında kayıtlı kart; son dört hanesi, kart markası veya kartı veren banka ve verdiğiniz ad ile listelenir. Kayıtlı kartla ödemede de 3D Secure doğrulaması yapılır. Kayıtlı kartınızı ödeme sayfasından dilediğiniz zaman silebilirsiniz; üyelik hesabınız silindiğinde Satıcı, önce PayNkolay'dan hesabınıza ait kayıtlı kartların silinmesini ister.

11. **Ödeme Koşulları ve Sanal POS**, 11. 3D Secure Doğrulama Akışı. Bugün: pasaj yok (madde ya da satır silindi)

   > Kart saklama özelliği açıldığında, üyeyseniz kayıtlı kartlarınızdan birini seçebilir veya işaretsiz gelen 'Bu kartı sonraki ödemeler için kaydet' kutusunu işaretleyerek kartınızı kaydedebilirsiniz.

12. **Ödeme Koşulları ve Sanal POS**, 11. 3D Secure Doğrulama Akışı. Bugün: “Ödeme sayfasından doğrudan kartı veren bankanın 3D Secure doğrulama ekranına geçersiniz.”

   > Ödeme sayfasından doğrudan kartı veren bankanın 3D Secure doğrulama ekranına geçersiniz; kayıtlı kartla ödemede de bu adım uygulanır.

13. **Ödeme Koşulları ve Sanal POS**, 26. Ödeme Verilerinin İşlenmesi ve Saklanması. Bugün: pasaj yok (madde ya da satır silindi)

   > Kart saklama özelliği açıldığında kartını kaydetmeyi seçen üyeler için Satıcı yalnızca PayNkolay'ın kayıtlı kartları üyeyle eşleştirmek için kullandığı rastgele üye anahtarını tutar.

14. **Güvenli Alışveriş ve Bilgi Güvenliği**, 10. Ödeme Güvenliği: PayNkolay Altyapısı ve Kart Verisinin Saklanmaması. Bugün: “Sistemlerimizde kartın tam numarası, son kullanma tarihi ve güvenlik kodu hiçbir hâlde tutulmaz; kartınız sonraki ödemeler için PayNkolay nezdinde de kaydedilmez.”

   > Sistemlerimizde kartın tam numarası, son kullanma tarihi ve güvenlik kodu hiçbir hâlde tutulmaz; kart saklama özelliği açıldığında ve kartınızı kendi tercihinizle kaydetmeniz hâlinde kart, Şirket tarafından değil PayNkolay'ın kart saklama hizmeti tarafından saklanır (bkz. aşağıdaki kayıtlı kart açıklaması).

15. **Güvenli Alışveriş ve Bilgi Güvenliği**, 10. Ödeme Güvenliği: PayNkolay Altyapısı ve Kart Verisinin Saklanmaması. Bugün: pasaj yok (madde ya da satır silindi)

   > Kayıtlı kart (kart saklama özelliği açıldığında; isteğe bağlı, yalnızca üyeler için): Ödeme sayfasındaki 'Bu kartı sonraki ödemeler için kaydet' kutusu varsayılan olarak işaretsizdir; kutuyu işaretlemedikçe hiçbir kart kaydedilmez ve bu özellik açılana kadar da kart kaydedilmez. Kutuyu işaretlerseniz kartınız Şirket tarafından değil, PayNkolay'ın kart saklama hizmeti tarafından saklanır. Şirket yalnızca, PayNkolay'ın kayıtlı kartlarınızı üyelik hesabınızla eşleştirmek için kullandığı, rastgele üretilmiş 11 karakterlik bir üye anahtarını tutar; bu anahtar T.C. kimlik numaranız veya telefon numaranız değildir ve kişisel bilgi içermez. Ödeme sayfasında kayıtlı kart; son dört hanesi, kart markası veya kartı veren banka ve verdiğiniz ad ile listelenir. Kayıtlı kartla yapılan ödemelerde de 3D Secure doğrulaması uygulanır. Kayıtlı kartınızı ödeme sayfasından dilediğiniz zaman silebilirsiniz; üyelik hesabınız silindiğinde Şirket, önce PayNkolay'dan hesabınıza ait kayıtlı kartların silinmesini ister.

16. **Güvenli Alışveriş ve Bilgi Güvenliği**, 17. Veri Saklama ve İmha. Bugün: pasaj yok (madde ya da satır silindi)

   > Kart saklama özelliği açıldığında ve kayıtlı kart özelliğini kullandıysanız, PayNkolay'ın kayıtlı kartlarınızı eşleştirmek için kullandığı müşteri anahtarı hesabınız açık olduğu sürece tutulur; hesabınız silindiğinde bu anahtar silinir ve PayNkolay'dan kayıtlı kartlarınızın silinmesi talep edilir.

17. **Güvenli Alışveriş ve Bilgi Güvenliği**, 22. Tedarikçi ve Alt İşleyen Güvenliği. Bugün: “PayNkolay (N Kolay Ödeme ve Elektronik Para Kuruluşu A.Ş.); kartlı ödemenin işlenmesi, 3D Secure doğrulaması için kartı veren bankaya yönlendirme, ödeme sonucunun doğrulanması, iptal ve iade işlemleri.”

   > PayNkolay (N Kolay Ödeme ve Elektronik Para Kuruluşu A.Ş.); kartlı ödemenin işlenmesi, 3D Secure doğrulaması için kartı veren bankaya yönlendirme, ödeme sonucunun doğrulanması, iptal ve iade işlemleri ile kart saklama özelliği açıldığında üyenin kendi tercihiyle kaydettiği kartların saklanması.

18. **Gizlilik Politikası**, 3. İşlenen Kişisel Veri Kategorileri. Bugün: “Üyelik kaydı, kullanıcı adı/e-posta, parolanızın özeti (hash; sitede bcrypt algoritmasıyla, kimlik doğrulama hizmeti sağlayıcısında o sağlayıcının kendi yöntemiyle), e-posta doğrulama durumu ve doğrulama zaman damgası, parola sıfırlama talepleri, kayıtlı adres defteri, favori/istek listesi, isteğe bağlı olarak eklediğiniz doğum tarihi, kaydettiğiniz 'her zamanki' içecek tercihi, hesap tercihleri ile davet kodunuz ve sizi davet eden üyenin kaydı.”

   > Üyelik kaydı, kullanıcı adı/e-posta, parolanızın özeti (hash; sitede bcrypt algoritmasıyla, kimlik doğrulama hizmeti sağlayıcısında o sağlayıcının kendi yöntemiyle), e-posta doğrulama durumu ve doğrulama zaman damgası, parola sıfırlama talepleri, kayıtlı adres defteri, favori/istek listesi, isteğe bağlı olarak eklediğiniz doğum tarihi, kaydettiğiniz 'her zamanki' içecek tercihi, hesap tercihleri, ödeme sayfasındaki kayıtlı kart özelliği için üyeliğinize atanan rastgele 11 karakterlik müşteri anahtarı (T.C. kimlik numaranızı, telefon numaranızı veya başka bir kişisel bilginizi içermez; kayıtlı kartın kendisi Şirkette tutulmaz) ile davet kodunuz ve sizi davet eden üyenin kaydı.

19. **Gizlilik Politikası**, 5. İşleme Amaçları ve Hukuki Sebepler. Bugün: “Kartlı ödemenin ödeme hizmeti sağlayıcısı PayNkolay üzerinden 3D Secure doğrulamasıyla tahsil edilmesi, ödeme sonucunun PayNkolay'a sorularak teyit edilmesi, iade ve itiraz (chargeback) süreçlerinin yürütülmesi”

   > Kartlı ödemenin ödeme hizmeti sağlayıcısı PayNkolay üzerinden 3D Secure doğrulamasıyla tahsil edilmesi, ödeme sonucunun PayNkolay'a sorularak teyit edilmesi, iade ve itiraz (chargeback) süreçlerinin yürütülmesi; kayıtlı kart özelliği açıldığında, bu özelliği seçen üyeler için kayıtlı kart hizmetinin sunulması

20. **Gizlilik Politikası**, 8. Kişisel Verilerin Aktarıldığı Taraf Kategorileri. Bugün: “Kart bilgileriniz sonraki ödemeler için PayNkolay nezdinde de kaydedilmez.”

   > Kayıtlı kart özelliği açıldığında: özellik isteğe bağlıdır ve yalnızca üyelere sunulur; ödeme sayfasındaki 'Bu kartı sonraki ödemeler için kaydet' kutusu işaretsiz gelir ve siz işaretlemedikçe hiçbir kart kaydedilmez. Kayıtlı kartı Şirket değil PayNkolay'ın kart saklama hizmeti saklar; Şirket yalnızca PayNkolay'ın kartları üyeliğinizle eşleştirmek için kullandığı rastgele 11 karakterlik müşteri anahtarını tutar ve kartı kaydetmeyi veya kayıtlı kartla ödemeyi seçtiğinizde bu anahtarı PayNkolay'a iletir; kartla ilgili başka hiçbir bilgi Şirketin veri tabanına eklenmez. Kayıtlı kartlarınız ödeme sayfasında son dört haneleri, kart markası veya kartı veren banka ve karta verdiğiniz adla listelenir; kayıtlı kartla yapılan ödemede de 3D Secure doğrulaması uygulanır. Kayıtlı kartı ödeme sayfasından dilediğiniz zaman silebilirsiniz; hesabınız kapatılırken Şirket önce PayNkolay'dan size ait kayıtlı kartların silinmesini ister.

21. **Gizlilik Politikası**, 10. Saklama Süreleri ve İmha. Bugün: pasaj yok (madde ya da satır silindi)

   > Kayıtlı kart müşteri anahtarı (kayıtlı kart özelliği açıldığında)

22. **Gizlilik Politikası**, 10. Saklama Süreleri ve İmha. Bugün: pasaj yok (madde ya da satır silindi)

   > Üyelik devam ettiği sürece. Kayıtlı bir kartı ödeme sayfasından dilediğiniz zaman silebilirsiniz; hesabınız kapatıldığında anahtar silinir ve Şirket, PayNkolay'dan size ait kayıtlı kartların silinmesini ister.

23. **Gizlilik Politikası**, 14. Mobil Uygulama, Cihaz İzinleri ve Uygulama Mağazaları. Bugün: “Hesabın kapatılmasıyla biriken damgalar ve kullanılmamış kuponlar sona erer (ayrıntı: {{SITE_URL}}/hukuk/hesap-silme).”

   > Hesabın kapatılmasıyla biriken damgalar ve kullanılmamış kuponlar sona erer; kayıtlı kart özelliği açıksa Şirket ayrıca PayNkolay'dan size ait kayıtlı kartların silinmesini ister (ayrıntı: {{SITE_URL}}/hukuk/hesap-silme).

24. **KVKK Aydınlatma Metni**, 6. İşlenen Kişisel Veri Kategorileri. Bugün: “Kart, sonraki ödemeler için PayNkolay nezdinde de kaydedilmez.”

   > Kart saklama özelliği açıldığında, kartını kaydetmeyi seçen üyelerin kartı PayNkolay'ın kart saklama hizmetinde saklanır; tarafımızca yalnızca PayNkolay'ın kayıtlı kartları üyeyle eşleştirmek için kullandığı, kişisel bilgi taşımayan rastgele 11 karakterlik bir üye anahtarı tutulur.

25. **KVKK Aydınlatma Metni**, 7. Kişisel Verilerin İşlenme Amaçları. Bugün: “Ödeme işlemlerinin gerçekleştirilmesi ve güvenliği: Ödemenin ödeme hizmeti sağlayıcısı PayNkolay aracılığıyla tek çekim olarak tahsili (taksit ve ön provizyon uygulanmaz; tutar, ödemeyi onayladığınız anda tahsil edilir); kart bilgilerinin {{SITE}} üzerindeki güvenli ödeme sayfasında alınması ve kaydedilmeden, şifreli bağlantıyla yalnızca PayNkolay'a iletilmesi; kartı veren bankanın ekranında 3D Secure doğrulaması; ödeme sonucunun sunucumuzdan PayNkolay işlem doğrulama servisine sorularak teyit edilmesi ve sipariş kaydına işlenmesi; tutarın tamamı kupon veya promosyonla karşılanan siparişlerin kart ödemesi olmaksızın kapatılması; mükerrer işlemin önlenmesi, kart denemelerinin sınırlanması ve dolandırıcılık riskinin önlenmesi; iptal, iade, kısmi iade ve ters ibraz (chargeback) süreçlerinin yönetilmesi.”

   > Ödeme işlemlerinin gerçekleştirilmesi ve güvenliği: Ödemenin ödeme hizmeti sağlayıcısı PayNkolay aracılığıyla tek çekim olarak tahsili (taksit ve ön provizyon uygulanmaz; tutar, ödemeyi onayladığınız anda tahsil edilir); kart bilgilerinin {{SITE}} üzerindeki güvenli ödeme sayfasında alınması ve kaydedilmeden, şifreli bağlantıyla yalnızca PayNkolay'a iletilmesi; kartı veren bankanın ekranında 3D Secure doğrulaması; kart saklama özelliği açıldığında, kartını kaydetmeyi seçen üyelerde kayıtlı kartların PayNkolay'ın kart saklama hizmeti üzerinden gösterilmesi, kullanılması ve silinmesi; ödeme sonucunun sunucumuzdan PayNkolay işlem doğrulama servisine sorularak teyit edilmesi ve sipariş kaydına işlenmesi; tutarın tamamı kupon veya promosyonla karşılanan siparişlerin kart ödemesi olmaksızın kapatılması; mükerrer işlemin önlenmesi, kart denemelerinin sınırlanması ve dolandırıcılık riskinin önlenmesi; iptal, iade, kısmi iade ve ters ibraz (chargeback) süreçlerinin yönetilmesi.

26. **KVKK Aydınlatma Metni**, 8. İşleme Amaçlarının Hukuki Sebepleri (KVKK m.5 ve m.6). Bugün: “Ödemenin ödeme hizmeti sağlayıcısı PayNkolay aracılığıyla tahsili, 3D Secure doğrulaması, iptal, iade ve ters ibraz (chargeback) yönetimi”

   > Ödemenin ödeme hizmeti sağlayıcısı PayNkolay aracılığıyla tahsili, 3D Secure doğrulaması, kart saklama özelliği açıldığında üyenin talebiyle kayıtlı kart hizmeti, iptal, iade ve ters ibraz (chargeback) yönetimi

27. **KVKK Aydınlatma Metni**, 10. Kişisel Verilerin Toplanma Yöntemleri. Bugün: “Ödeme altyapısı: {{SITE}} üzerindeki güvenli ödeme sayfasında girdiğiniz kart bilgileri (kaydedilmeden yalnızca PayNkolay'a iletilir); ödeme hizmeti sağlayıcısı PayNkolay'ın işlem doğrulama servisine sunucumuzdan yapılan sorgu ile alınan işlem sonucu, referans kodu ve maskelenmiş kart bilgisi; itirazlarda bankanın ve PayNkolay'ın ilettiği bilgiler.”

   > Ödeme altyapısı: {{SITE}} üzerindeki güvenli ödeme sayfasında girdiğiniz kart bilgileri (kaydedilmeden yalnızca PayNkolay'a iletilir); ödeme hizmeti sağlayıcısı PayNkolay'ın işlem doğrulama servisine sunucumuzdan yapılan sorgu ile alınan işlem sonucu, referans kodu ve maskelenmiş kart bilgisi; kart saklama özelliği açıldığında, kartını kaydetmeyi seçen üyeler için ödeme sayfasında gösterilmek üzere PayNkolay'ın kart saklama hizmetinden alınan kartın son dört hanesi, kartı veren banka veya kart markası ve kart takma adı; itirazlarda bankanın ve PayNkolay'ın ilettiği bilgiler.

28. **KVKK Aydınlatma Metni**, 14. Kişisel Verilerin Aktarılması. Bugün: “Ödemenin tek çekim olarak tahsili, kartı veren bankanın ekranında 3D Secure doğrulaması, ödeme sonucunun PayNkolay işlem doğrulama servisinden sorgulanması, iptal, iade ve ters ibraz (chargeback) süreçlerinin yürütülmesi.”

   > Ödemenin tek çekim olarak tahsili, kartı veren bankanın ekranında 3D Secure doğrulaması, ödeme sonucunun PayNkolay işlem doğrulama servisinden sorgulanması, iptal, iade ve ters ibraz (chargeback) süreçlerinin yürütülmesi ve kart saklama özelliği açıldığında kartını kaydetmeyi seçen üyeler için kart saklama hizmeti.

29. **KVKK Aydınlatma Metni**, 14. Kişisel Verilerin Aktarılması. Bugün: “Aktarılan veri: kart üzerindeki ad, kart numarası, son kullanma tarihi ve güvenlik kodu (tarafımızca kaydedilmeden, yalnızca ödeme işlemi için), ödeme isteğinin gönderildiği IP adresi, sipariş numarası, tutar ve para birimi.”

   > Aktarılan veri: kart üzerindeki ad, kart numarası, son kullanma tarihi ve güvenlik kodu (tarafımızca kaydedilmeden, yalnızca ödeme işlemi için), ödeme isteğinin gönderildiği IP adresi, sipariş numarası, tutar ve para birimi; kart saklama özelliği açıldığında kartını kaydetmeyi seçen üyeler için üye anahtarı ve kart takma adı.

30. **KVKK Aydınlatma Metni**, 16. Saklama Süreleri ve İmha. Bugün: pasaj yok (madde ya da satır silindi)

   > Kart saklama özelliği açıldığında ve kartını kaydetmeyi seçen üyelerde üye anahtarı üyelik süresince tutulur; kayıtlı kartlarınızı ödeme sayfasında dilediğiniz zaman silebilirsiniz ve hesabınız kapatıldığında önce kayıtlı kartlarınızın silinmesi PayNkolay'dan istenir.

31. **Veri Sahibi Başvuru Formu**, 9. Talebin Açıklanması ve Destekleyici Belgeler. Bugün: pasaj yok (madde ya da satır silindi)

   > Kayıtlı kartlara ilişkin talepler için (kart saklama özelliği açıldığında): Kart saklama üyeler için isteğe bağlıdır ve kart, yalnızca ödeme sayfasındaki kartı kaydetme kutusunu siz işaretlerseniz kaydedilir; kutu işaretsiz gelir. Kayıtlı kartlar şirketimizde değil, PayNkolay'ın kart saklama hizmetinde tutulur; şirketimiz yalnızca kartlarınızı üyeliğinizle eşleştirmeye yarayan, T.C. kimlik veya telefon numaranızı ve başka kişisel veri içermeyen, rastgele üretilmiş bir üye anahtarını saklar. Kayıtlı bir kartı ödeme sayfasından istediğiniz zaman silebilirsiniz; üyeliğinizin silinmesi hâlinde şirketimiz önce kayıtlı kartlarınızın silinmesini PayNkolay'dan ister. Bu özellik açılana kadar hiçbir kart kaydedilmez.

32. **Kişisel Veri Saklama ve İmha Politikası**, 5. Kayıt Ortamları. Bugün: pasaj yok (madde ya da satır silindi)

   > Kart saklama özelliği açıldığında üyenin isteğe bağlı olarak kaydettiği kartlar Şirket nezdinde değil, PayNkolay'ın kart saklama hizmetinde tutulur; Şirket yalnızca bu kartları üyeyle eşleştirmeye yarayan rastgele bir müşteri anahtarını tutar.

33. **Kişisel Veri Saklama ve İmha Politikası**, 8. Veri Kategorileri Bazında Saklama ve İmha Süreleri. Bugün: pasaj yok (madde ya da satır silindi)

   > Kayıtlı kart müşteri anahtarı (üyenin ödeme işlemi sırasında rastgele üretilen; T.C. kimlik numarası, telefon numarası veya başka bir kişisel bilgi içermeyen 11 karakterlik anahtar)

34. **Kişisel Veri Saklama ve İmha Politikası**, 8. Veri Kategorileri Bazında Saklama ve İmha Süreleri. Bugün: pasaj yok (madde ya da satır silindi)

   > Üyelik ilişkisi süresince saklanır. Anahtar, Kart saklama özelliği açıldığında kayıtlı kartları üyeyle eşleştirmek için PayNkolay'a iletilir; özellik açılmadan önce hiçbir kart kaydedilmez. Kayıtlı kartların kendisi Şirket nezdinde değil, PayNkolay'ın kart saklama hizmetinde tutulur; ödeme sayfasında gösterilen kartın son dört hanesi, kartı veren banka veya kart markası ve kart takma adı da PayNkolay'dan alınır ve Şirket tarafından saklanmaz. Kart ancak üyenin ödeme sayfasındaki "Bu kartı sonraki ödemeler için kaydet" kutusunu işaretlemesiyle kaydedilir; kayıtlı kartla ödemede de 3D Secure doğrulaması yapılır. Üye kayıtlı bir kartı ödeme sayfasından dilediği zaman silebilir. Üyelik hesabı kapatıldığında önce PayNkolay'dan üyeye ait kayıtlı kartların silinmesi istenir, ardından anahtar silinir.

35. **Kişisel Veri Saklama ve İmha Politikası**, 16. İlgili Kişinin Talebi Üzerine Silme veya Yok Etme. Bugün: pasaj yok (madde ya da satır silindi)

   > Hesap kapatıldığında PayNkolay'dan üyeye ait kayıtlı kartların silinmesi istenir ve kartları üyeyle eşleştiren müşteri anahtarı silinir.

36. **Kişisel Veri Saklama ve İmha Politikası**, 18. Teknik ve İdari Tedbirler. Bugün: “Teknik: Kart numarası, son kullanma tarihi ve güvenlik kodunun {{SITE}} üzerindeki güvenli ödeme sayfasında girilmesi ve şifreli bağlantıyla Şirket sunucusu üzerinden aynı işlemde yalnızca PayNkolay'a iletilmesi; bu bilgilerin Şirket sistemlerinde hiçbir aşamada kaydedilmemesi, saklanmaması ve kayıtlara (log) yazılmaması; ödeme sayfasında üçüncü taraf betik çalıştırılmaması ve sayfanın başka bir sitenin içine yerleştirilememesi; kart denemelerinin sipariş başına ve bağlantı başına sınırlandırılması; her kartlı ödemede kartı veren bankanın 3D Secure ekranında doğrulama yapılması.”

   > Teknik: Kart numarası, son kullanma tarihi ve güvenlik kodunun {{SITE}} üzerindeki güvenli ödeme sayfasında girilmesi ve şifreli bağlantıyla Şirket sunucusu üzerinden aynı işlemde yalnızca PayNkolay'a iletilmesi; bu bilgilerin Şirket sistemlerinde hiçbir aşamada kaydedilmemesi, saklanmaması ve kayıtlara (log) yazılmaması; ödeme sayfasında üçüncü taraf betik çalıştırılmaması ve sayfanın başka bir sitenin içine yerleştirilememesi; kart denemelerinin sipariş başına ve bağlantı başına sınırlandırılması; kayıtlı kartla yapılanlar dâhil her kartlı ödemede kartı veren bankanın 3D Secure ekranında doğrulama yapılması.

37. **Üyelik Sözleşmesi**, 8. Ödeme Bilgileri ve Kart Verilerinin Saklanmaması. Bugün: “Kart bilgileri sonraki ödemeler için kaydedilmez: Şirket kart bilgisi saklamaz, PayNkolay'dan da Üye'nin kartının saklanmasını istemez; her ödemede kart bilgileri yeniden girilir.”

   > Kart saklama özelliği açıldığında, Üye ödeme sayfasında kartını sonraki ödemeler için kaydetmeyi seçebilir. Bu özellik isteğe bağlıdır ve yalnızca üyelere sunulur; 'Bu kartı sonraki ödemeler için kaydet' kutusu işaretsiz gelir ve Üye işaretlemedikçe hiçbir kart kaydedilmez. Kayıtlı kart Şirket tarafından değil, PayNkolay'ın kart saklama hizmeti tarafından saklanır; Şirket'in veri tabanında kart bilgisi tutulmaz, yalnızca PayNkolay'ın kartları Üye ile eşleştirmek için kullandığı, rastgele üretilmiş 11 karakterlik bir üye anahtarı bulunur. Bu anahtar kimlik numarası veya telefon numarası değildir ve Üye'ye ilişkin başka bir bilgi içermez. Ödeme sayfasında kayıtlı kart son dört hanesi, kart markası veya kartı veren banka ve takma adıyla listelenir; kayıtlı kartla yapılan ödemelerde de 3D Secure uygulanır. Üye kayıtlı kartını ödeme sayfasından dilediği zaman silebilir. Hesap kapatılırken Şirket önce PayNkolay'dan Üye'nin kayıtlı kartlarının silinmesini ister. Kart saklama özelliği açılana kadar hiçbir kart kaydedilmez.

38. **Üyelik Sözleşmesi**, 14. Üyeliğin Üye Tarafından Sona Erdirilmesi. Bugün: pasaj yok (madde ya da satır silindi)

   > Kart saklama özelliği açıldığında, hesap kapatılırken Şirket önce PayNkolay'dan Üye'nin kayıtlı kartlarının silinmesini ister.

39. **Hesap Silme ve Üyelik Sonlandırma Prosedürü**, 5. Hesap Kapatıldığında Hemen Silinen Veriler. Bugün: pasaj yok (madde ya da satır silindi)

   > Kayıtlı kartlarınız: kart saklama özelliği açık olduğu dönemde ödeme sayfasında kartınızı kaydetmeyi seçtiyseniz, kartınız bizde değil, ödeme hizmeti sağlayıcısı PayNkolay'ın kart saklama hizmetinde tutulur. Hesap kapatılırken Satıcı önce PayNkolay'dan üyeliğinize ait kayıtlı kartların silinmesini ister; ardından kartları üyeliğinizle eşleştirmek için tuttuğumuz rastgele müşteri anahtarını siler. Bu anahtar T.C. kimlik numaranızı, telefon numaranızı veya başka bir kişisel veriyi içermez. PayNkolay'a o anda ulaşılamasa da hesap kapatılır; kayıtlı kartlarınızın silinip silinmediğini {{EMAIL}} adresinden sorabilirsiniz.

40. **Mobil Uygulama Kullanım Koşulları**, 12. Uygulama Üzerinden Sipariş ve Ödeme. Bugün: “Kart bilgileri sonraki ödemeler için kaydedilmez: Şirket kart bilgisi saklamaz, PayNkolay'dan da üyenin kartının saklanmasını istemez; her ödemede kart bilgileri yeniden girilir.”

   > Kart saklama özelliği açıldığında, üyeler ödeme sayfasında isteğe bağlı olarak 'Bu kartı sonraki ödemeler için kaydet' kutusunu işaretleyebilir; kutu işaretsiz gelir ve işaretlenmediği sürece kart kaydedilmez. Kayıtlı kart Şirket tarafından değil, PayNkolay'ın kart saklama hizmetinde tutulur; Şirket yalnızca PayNkolay'ın kartları üyeyle eşleştirmek için kullandığı, rastgele üretilmiş ve kimlik veya telefon numarası içermeyen bir üye anahtarını saklar. Ödeme sayfasında kayıtlı kart son dört hanesi, kart markası veya bankası ve takma adıyla listelenir; kayıtlı kartla ödemede de 3D Secure zorunludur, üye kayıtlı kartını ödeme sayfasında dilediği zaman silebilir ve hesabını sildiğinde Şirket önce PayNkolay'dan kayıtlı kartlarının silinmesini ister. Bu özellik açılana kadar hiçbir kart kaydedilmez.

41. **Mobil Uygulama Kullanım Koşulları**, 17. Uygulamanın Kaldırılması ve Hesabın Silinmesi. Bugün: “Hesabın silinmesiyle birlikte biriken damgalar ve kullanılmamış ücretsiz içecek hakkı sona erer; adres defteri ve tercihler erişime kapatılır, ticari elektronik ileti onayı bulunuyorsa ret kaydı İYS üzerine işlenir.”

   > Hesabın silinmesiyle birlikte biriken damgalar ve kullanılmamış ücretsiz içecek hakkı sona erer; kart saklama özelliği açıksa Şirket üyenin kayıtlı kartlarının silinmesini önce PayNkolay'dan ister; adres defteri ve tercihler erişime kapatılır, ticari elektronik ileti onayı bulunuyorsa ret kaydı İYS üzerine işlenir.

42. **Şirket ve İletişim Bilgileri**, 7. Ödeme Altyapısı ve Ödeme Bilgileri. Bugün: “Kart, sonraki ödemeler için PayNkolay nezdinde de kaydedilmez.”

   > Kart saklama özelliği açıldığında ve yalnızca üyenin açık tercihiyle kaydedilen kart, Şirkette değil PayNkolay'ın kart saklama hizmetinde tutulur; Şirket kartı değil, yalnızca üyeyi PayNkolay nezdindeki kartlarla eşleştiren rastgele bir anahtarı saklar. Bu özellik açılana kadar hiçbir kart kaydedilmez.

43. **Kafe Hizmet Koşulları**, 8. Ödeme Yöntemleri, Fiş ve Fatura. Bugün: “Kart bilgileriniz sonraki ödemeler için kaydedilmez: İşletme kart bilgisi saklamaz, PayNkolay'dan da kartınızın saklanmasını istemez.”

   > Kart saklama özelliği açıldığında, yalnızca üyeler için ve isteğe bağlı olarak sunulur: ödeme sayfasındaki 'Bu kartı sonraki ödemeler için kaydet' kutusu başlangıçta işaretsizdir ve işaretlenmedikçe hiçbir kart kaydedilmez. Kayıtlı kart İşletme tarafından değil, PayNkolay'ın kart saklama hizmetinde saklanır; İşletme yalnızca PayNkolay'ın kartları üyeyle eşleştirmek için kullandığı rastgele bir üye anahtarını tutar. Ödeme sayfasında kayıtlı kart son dört hanesi, kart markası veya kartı veren banka ve takma adıyla gösterilir; kayıtlı kartla ödemede de 3D Secure zorunludur, kayıtlı kartı ödeme sayfasından dilediğiniz zaman silebilirsiniz ve hesabınız silindiğinde İşletme önce PayNkolay'dan kayıtlı kartlarınızın silinmesini ister. Bu özellik açılana kadar hiçbir kart kaydedilmez.


### 19.5 Açma sırası (kayıtlı kart açılırsa)

`docs/PAYNKOLAY.md` §16 "Açma anahtarı": aynı PR'da §19.4'teki metinler
`content.ts`'e geri gelir (tarihler ve `LEGAL_UPDATED` yayın gününe),
`SAVED_CARDS_IN_LEGAL_TEXTS = true` olur ve `tests/legal-docs.test.ts`'teki
kural ters çevrilir; PR yayına girer; ancak sonra Vercel'de
`PAYNKOLAY_CARD_STORAGE=on` yapılır. Uygulamadaki iki metin
(`tr.checkout.cardHint`, `tr.addresses.cardNotStored`) aynı sürümde
izler.

## 20. Y6 - Hesap silme talebi: 30 gün, Kurul süreleri, kanallar, karaoke süresi (18 Eki 2026)

> **Durum: metin kodda değişti.** Operatör kararı (18 Eki 2026): avukat
> turu yok, karar birincil kaynaklarla verildi (aşağıda "Hukuki dayanak").
> Dal `feat/legal-account-deletion-followup`. #145'in (web'de hesap
> silme ekibe talep olarak gider) devamı.

### 20.1 Neden

#145'ten sonra web'de hesabı üyenin talebi üzerine ekip siler, uygulama
anında silmeyi korur. Üç boşluk kalmıştı: `hesap-silme` ertelenen silmede
cevap süresini ve Kurul'a şikâyetin sürelerini söylemiyordu; Kullanım Şartları "hesap
ayarları üzerinden" kapatmadan, Mobil Uygulama Koşulları yalnız e-postadan
söz ediyordu. Ayrıca panel, talebi kapatırken karaoke iptal kuralını kapanış
anına göre uyguluyordu: ekibin gecikmesi üyenin iade süresini kısaltıyordu.
Kod artık kuralı talep anında karara bağlıyor (`closureJudgedAt`); §8 bunu
Site talebi için söylüyor.

### 20.2 Sürüm ve onay

- Ödeme onayındaki belgeler (Ön Bilgilendirme Formu, Mesafeli Satış
  Sözleşmesi) ve karaoke belgesi bu PR'da değişmedi; `LEGAL_UPDATED`
  (§18 ile 18 Ekim 2026) ve `KARAOKE_LEGAL_UPDATED` (17 Ekim 2026)
  yerinde kaldı.
- Değişen üç belge (`hesap-silme`, Kullanım Şartları, Mobil Uygulama
  Koşulları) zaten setin 18 Ekim 2026 sürümünü taşıyor; kendi tarihleri
  gerekmez (`tests/legal-dates.test.ts`).
- Uygulamanın çevrimdışı kopyası (`lafmobil` `src/data/legal.seed.json`)
  ayrı uygulama PR'ında `legal:export` ile yenilenir.

### 20.3 Değişen cümleler

Satır numaraları `src/lib/legal/content.ts`'in ilk taslağına aittir
(parantezde `main` c8805f5); §18-§19 birleştikten sonra birkaç satır kaydı.

| Belge | Satır | Mevcut | Yeni |
|---|---|---|---|
| Hesap Silme, §4 (ertelenen silme) | 10887 (10881) | "... Site'den verdiğiniz talep ise açık kalır ve sipariş tamamlanınca uygulanır." | "... Site'den verdiğiniz talep ise açık kalır ve sipariş tamamlanınca uygulanır. Bu durumda da talebiniz otuz gün içinde yanıtlanır; silmenin hangi süreç nedeniyle ertelendiği ve ne zaman uygulanacağı size bildirilir." |
| Hesap Silme, §8 (karaoke) | 10971 (10966) | "... Saatine 2 saatten az kalan ödenmiş rezervasyonlarda iade yapılmaz ve rezervasyon olduğu gibi kalır." | "... Saatine 2 saatten az kalan ödenmiş rezervasyonlarda iade yapılmaz ve rezervasyon olduğu gibi kalır. Site'deki hesap silme sayfasından verdiğiniz talepte bu süre talebinizin kaydedildiği ana, talepten sonra yaptığınız bir rezervasyonda ise hesabınızın silindiği ana göre hesaplanır; talebiniz sırasında iade alacak olan bir rezervasyonun saati hesabınız silinmeden geçerse, oda kullanılmadıysa iade yine yapılır." |
| Hesap Silme, §11 | 10994 (10989) | "Başvurunuzun otuz gün içinde sonuçlandırılmaması veya cevabın yetersiz bulunması hâlinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunma hakkınız saklıdır." | "Başvurunuzun reddedilmesi, verilen cevabın yetersiz bulunması veya otuz gün içinde cevap verilmemesi hâllerinde, cevabı öğrendiğiniz tarihten itibaren otuz gün ve her hâlde başvuru tarihinden itibaren altmış gün içinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz." |
| Kullanım Şartları, §7 | 9833 (9830) | "Kullanıcı, üyeliğini dilediği zaman ve gerekçe göstermeksizin hesap ayarları üzerinden ya da {{EMAIL}} adresine ileteceği talep ile sonlandırabilir. Üyeliğin sonlandırılması, ..." | "Kullanıcı, üyeliğini dilediği zaman ve gerekçe göstermeksizin sonlandırabilir: Mobil Uygulama'daki hesap silme seçeneği, devam eden bir sipariş yoksa hesabı hemen kapatır; Site'deki hesap silme sayfasından ({{SITE_URL}}/uye/hesap/sil) veya {{EMAIL}} adresine iletilen talep en geç otuz gün içinde sonuçlandırılır. Üyeliğin sonlandırılması, ..." (devamı aynen) |
| Mobil Uygulama Koşulları, §17 | 11821 (11813) | "...; ayrıca {{EMAIL}} adresine gönderilecek bir talep ile de hesap kapatılabilir." | "...; ayrıca Site'deki hesap silme sayfasından ({{SITE_URL}}/uye/hesap/sil) veya {{EMAIL}} adresine gönderilecek bir talep ile de hesabın silinmesi istenebilir; bu talepler en geç otuz gün içinde sonuçlandırılır." |

Hesap Silme §5'teki kayıtlı kart maddesi ve Mobil Uygulama Koşulları §17'nin
dördüncü paragrafındaki "kart saklama özelliği açıksa ..." ibaresi §19 (Y5,
#150) ile zaten kalktı; bu PR'ın taslağındaki §5 silmesi o yüzden düştü. `hesap-silme` §6 ve §8'deki "2 saat" kuralı, uygulama kilidi
(`KARAOKE_POLICY_APP_VERSION`) kapalıyken her rezervasyon için doğrudur;
kilidi açan PR bu cümleleri karaoke sözleşmesine yönlendirir.

### 20.4 Hukuki dayanak

| Konu | Dayanak | Karar |
|---|---|---|
| Ertelenen silmede de 30 gün içinde cevap | 6698 s. KVKK m.13/2; Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ m.6; Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik m.12/1 | Talep en geç otuz günde sonuçlandırılır; devam eden sipariş silmeyi ertelese de cevap bu süre içinde verilir ve ertelemenin gerekçesi ile uygulanacağı zaman bildirilir (kısmi ret gerekçeli olur). |
| Kurul'a şikâyet süreleri | 6698 s. KVKK m.14/1 | Ret, yetersiz cevap veya süresinde cevap verilmemesi hâlinde cevabı öğrenmeden itibaren otuz, her hâlde başvurudan itibaren altmış gün: kanundaki sözle yazıldı. |
| Her kanal ve süresi | KVKK m.11/1-e, m.13/1; Tebliğ m.5 (yazılı, KEP, kayıtlı e-posta, başvuruya yönelik uygulama); Apple App Store Review Guidelines 5.1.1(v); Google Play hesap silme şartı | Uygulamadaki silme anında (Apple), Site'deki talep sayfası Google Play'in istediği web silme yolu ve Tebliğ'in "uygulama" kanalı, e-posta ve posta açık; web yolları otuz gün içinde sonuçlanır. |
| Kayıtlı kart maddesi | Operatör kararı (kural 28, 23 Eyl ve 15 Eki 2026); KVKK m.4/2 (doğruluk) | Kart hiç saklanmadığı için anlatılan işlem yoktur; madde §19 (Y5) ile kaldırıldı, bu PR yeniden eklemez. |
| Karaoke süresi talep anından | 6502 s. TKHK m.4/2 (koşullar tüketici aleyhine değiştirilemez), m.5/4 (belirsizlik tüketici lehine); 6098 s. TBK m.4/2 (kıyasen) | Üyenin talebi kaydedildiği an iptal beyanı sayılır; ekibin gecikmesi süreyi kısaltmaz. Talepten sonra yapılan rezervasyon kapanış anından hesaplanır: talep var olmayan bir rezervasyonu kapsayamaz, üye onu kapanışa kadar kendisi iptal edebilir (yapıldığı andan hesaplamak her kapanışta, oda kullanılmış olsa da, tam iade demekti). Saati kapanıştan önce geçen rezervasyonda oda kullanıldıysa ödeme kalır (hizmet ifa edilmiştir), kullanılmadıysa iade edilir; bunu personel kaydeder. Site talebi açıkken üye hesabı uygulamadan silerse aynı talep karşılanmış olur ve kural yine talep anından işler (üye bekleseydi alacağı iadeyi kendi silmesiyle kaybetmez); saati geçen rezervasyonda odayı soracak kimse olmadığından iade personelin kararına kalır. Kural yalnız Site talebi için yazıldı: e-postayla gelen talebin anı panelde henüz kaydedilmiyor. |

## 21. Y7 - Menü bilgisi: kalem başına alerjen, fiyat listesinin tarihi, içeriği tutmayan fotoğraflar (18 Eki 2026)

> **Durum: metin kodda değişti.** Dal `feat/legal-menu-food-info`. Operatör
> kararı (18 Eki 2026): _"avukata sorma, sen karar ver, araştır ve doğru
> olanı yap"_; avukat turu yok, karar ve dayanak aşağıda. Kararlar
> OP-ALLERGEN-BOARD, OP-PRICE-LISTS, OP-MENU-PHOTOS, ASK-OTH-1.

### 21.1 Neden ve dayanak

- **Alerjen.** Toplu tüketim yerinde ambalajsız gıdanın adı ve Ek-1'deki
  alerjenleri menü, yazı tahtası, broşür benzeri araçlarla kolayca görülebilir
  ve okunabilir şekilde sunulur (TGK Gıda Etiketleme ve Tüketicileri
  Bilgilendirme Yönetmeliği m.15/5; mevcut işletmeler için Geçici m.1,
  31.12.2019). Uzaktan iletişim araçlarıyla satışta bu bilgi satın almadan
  önce erişilebilir olur (m.17/3); uygulamadan verilen kafe siparişi bu
  kapsamdadır. Ek-1 on dört grup sayar. Menüde kalem başına alerjen yoktu;
  §7 ise bağlayıcı bilginin "menü kartında ya da mobil uygulamanın ürün
  detay ekranında" olduğunu söylüyordu ve böyle bir liste yoktu (TKHK m.61-62
  doğruluk). "Baristaya danış" tek başına m.15/5'in yazılı aracı değildir.
  https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=7&MevzuatNo=23282&MevzuatTertip=5
- **Fiyat listesinin tarihi.** Listede tüm vergiler dahil satış fiyatı ve
  satış fiyatının uygulanmaya başlandığı tarih bulunur (Fiyat Etiketi
  Yönetmeliği m.5/2-c, d; para birimi m.9/4). Yiyecek-içecek işyerinde liste
  girişte ve masalarda bulunur, masadaki liste karekodla sunulabilir (m.8/1,
  m.8/2); masa karekodu `/masa/<kod>`'u, yani menüyü açar.
  https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=7&MevzuatNo=19819&MevzuatTertip=5
- **Fotoğraf.** Reklam doğru olmalı, malın bileşimi hakkında yanıltan görsel
  içeremez; dipnot görselle çelişeni düzeltemez (TKHK m.61, m.62, m.8/2;
  Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği m.7/5-a, m.18/6-7,
  m.29/2-a). Yapay zekâ kullanımı belirtilir (m.18/8, 1.8.2026'dan beri);
  menü kalemi için yapay zekâ görseli hiç kullanılmayarak bu yükümlülük doğmaz.
  https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6502.pdf

### 21.2 Kararlar

1. Her kalemin içerdiği Ek-1 grupları panelden girilir (`menu_items.allergens`,
   on dört anahtarlık kapalı liste). Hiçbir kutu işaretli değilse bilgi
   **girilmemiş** sayılır ve menüde yazmaz; "içermez" yalnız açıkça
   işaretlenince yazar. Alerjisi olan misafir için "yazmıyor" ile "yok"
   ayrı tutulur. Bilgi koddan ya da kalem adından tahmin edilmez.
2. Kart "Alerjenler: gluten, süt" der; uygulama aynı alanı `GET /menu`'den
   isteğe bağlı `allergens` olarak alır (v1 ekleme). Çapraz temas uyarısı her
   kalem için geçerli kalır.
3. Menünün altında "Fiyatlarımıza KDV dahildir · Fiyatların uygulanmaya
   başladığı tarih: <gün ay yıl>". Kararın taslağındaki "geçerlilik tarihi"
   yerine yönetmeliğin kendi sözü kullanıldı: "geçerlilik tarihi" bir bitiş
   tarihi gibi okunur. Tarihi operatör Ayarlar > Vergi'den girer; bugünden
   sonraki gün reddedilir; boşsa yalnız KDV cümlesi yazar.
4. İçeriği kalemle çelişen fotoğraflar kalkar. Karardaki sekiz kaleme,
   aynı ölçütle (kalemde olmayan kuruyemiş) mnu-0061 L'Af Kahve ve mnu-0078
   Kakao Protein Bar eklendi: on fotoğraf.
5. Menü bandındaki "Cölyak için baristaya bildirin, pirinç bisküvili
   alternatif hazırlarız" sözü kalktı. Ortak mutfakta glutensiz bir
   alternatif vaadi, bu belgenin §9'uyla ("hiçbir ürünümüz belirli bir
   alerjenden tamamen arındırılmış olarak taahhüt edilemez") ve glutensiz
   beyanın şartlarıyla çelişir; yerine "Çölyak ya da ciddi bir alerjin varsa
   baristaya söyle." geldi.

### 21.3 Değişen cümleler

Satır numaraları `src/lib/legal/content.ts`'in bu PR'daki hâline aittir.

| Belge | Satır | Mevcut | Yeni |
|---|---|---|---|
| Gıda Güvenliği ve Alerjen, §7 | 14984 | "... Ambalajsız olarak toplu tüketime sunulan gıdalarda ise bilgi; menüde, ürün kartında, {{SITE_URL}} adresindeki ürün sayfasında, {{BRAND}} mobil uygulamasının ürün detay ekranında veya personel aracılığıyla tüketiciye aktarılır." | "... Ambalajsız olarak toplu tüketime sunulan gıdalarda ise bilgi, menüde ve köşkte asılı alerjen tablosunda her kalem için yazılı olarak verilir; personel aynı bilgiyi siparişten önce ayrıca sözlü olarak da aktarır." |
| Gıda Güvenliği ve Alerjen, §7 | 14985 | "Aşağıdaki tablo, mevzuatta sayılan alerjen gruplarının {{BRAND}} ürün ve menü yelpazesindeki olası karşılığını göstermektedir. Tablo yol gösterici niteliktedir; her ürün için bağlayıcı olan bilgi, o ürünün etiketinde, menü kartında ya da mobil uygulamanın ürün detay ekranında yer alan güncel bileşen listesidir." | "Aşağıdaki tablo, mevzuatta sayılan alerjen gruplarının {{BRAND}} ürün ve menü yelpazesindeki olası karşılığını gösterir ve yol gösterici niteliktedir. Kafe menüsündeki her kalemin içerdiği alerjen grupları, {{SITE_URL}}/menu adresindeki menüde kalemin yanında ve köşkte asılı alerjen tablosunda yazılıdır; bu bilginin henüz yazılmadığı bir kalemin alerjenlerini personel siparişten önce bildirir. Ön ambalajlı ürünlerde bağlayıcı bilgi, ürünün etiketindeki güncel bileşen listesidir." |
| Site, /menu "Alerjenler" bandı (`menu-page.tsx`, hukuki metin değil) | - | "Süt, gluten, kuruyemiş, soya - mutfağımızda çapraz temas olabilir. Cölyak için baristaya bildirin, pirinç bisküvili alternatif hazırlarız." | "Ürünün içerdiği alerjenler kartında yazar; yazmıyorsa siparişten önce baristaya sor. Mutfağımızda süt, gluten, kuruyemiş ve soya ile çapraz temas olabilir. Çölyak ya da ciddi bir alerjin varsa baristaya söyle." ve belgeye bağlantı |
| Site, /menu, kategori sayfaları, /masa (hukuki metin değil) | - | (yok) | "Fiyatlarımıza KDV dahildir · Fiyatların uygulanmaya başladığı tarih: <gün ay yıl>" ve her kartta "Alerjenler: ..." |

### 21.4 Sürüm

- Gıda Güvenliği belgesi ödeme onayının belgelerinden değil:
  `LEGAL_UPDATED` ve `KARAOKE_LEGAL_UPDATED` değişmedi (D-SAME-DAY bu PR'a
  uygulanmaz). Belge kendi tarihini aldı: 19 Ekim 2026
  (`tests/legal-dates.test.ts`). PR başka bir gün birleşirse tarih o güne
  çekilir.
- Uygulamanın çevrimdışı kopyası (lafmobil `legal.seed.json`) ayrı bir
  uygulama PR'ında yeniden dışa aktarılır; uygulama metni `GET /legal`'dan
  okur.

### 21.5 Operatöre

1. 23 Ekim 2026'ya kadar 82 kalem × 14 grup tablosunu tedarikçi etiketlerinden
   hazırla (şurup, sos, süt seçeneği ve süsleme dahil), köşkte kasanın
   yanında okunur bir panoya as, altına çapraz temas cümlesini yaz,
   baristalara göster.
2. Aynı tabloyla `/admin/menu`'de her kalemi aç, Alerjenler kutularını
   işaretle (hiçbirini içermiyorsa yalnız "Hiçbirini içermez"). Sayfanın
   başındaki sayaç kaç kalem kaldığını söyler. Tarif ya da tedarikçi değişince
   aynı gün güncelle.
3. Ayarlar > Vergi > Menü fiyat listesi: fiyatların uygulanmaya başladığı
   günü gir; köşkün her girişine ve her masaya KDV dahil, aynı tarihli basılı
   liste koy, karekodlu masada isteyene basılı liste ver; servis, masa ya da
   kuver ücreti alma. Fiyat değiştiği gün tarihi ve listeleri yenile.
4. 22 rawpixel ve 6 StockSnap kaynak sayfasını yapay zekâ işareti için
   tarayıcıda aç (geliştiricinin 37 kaynağında işaret yok,
   `docs/MENU-PHOTOS.md`); 30 Kasım 2026'ya kadar stok fotoğrafları barın kendi
   fotoğraflarıyla değiştir, boşalan on kalemden başla.

### 21.6 Bilerek değişmeyenler

- §7'nin 14 satırlık tablosu (alerjen gruplarının yelpazedeki olası
  karşılığı) yol gösterici olarak kaldı. Kararın ara çözümü olan 82 × 14
  tablo §7'ye eklenmedi: operatörün tablosu henüz gelmedi ve alerjen bilgisi
  uydurulmaz. Kalem başına veri panelden girildikçe menüde görünür; §7'nin
  yeni cümlesi her iki hâli de doğru anlatır.
- Uygulama kalem başına alerjeni gösterince (lafmobil `app-menu-allergens`)
  §7'ye "ve mobil uygulamada" eklenir.
- "Görseller temsilidir" notu (`menu-photo-note.tsx`) aynen kaldı: sunum
  farkı için yeterli.

## 22. Y8 - Ödeme sayfasında ön bilgilendirme ve kayıt onayı (19 Eki 2026)

> **Durum: kodda değişti.** Dal `feat/legal-checkout-preinfo`. Operatör
> kararı (18 Eki 2026): avukat turu yok, karar birincil kaynaklarla verildi
> (ASK-OTH-2, OP-RETURN-CARRIER; aşağıda "Hukuki dayanak"). Sözleşme
> metinleri (`content.ts`) değişmedi; `LEGAL_UPDATED` (18 Ekim 2026) ve
> `KARAOKE_LEGAL_UPDATED` yerinde kaldı. Değişen, ödeme sayfasının ve kayıt
> formunun kendi cümleleri ve yazı boyutu. **Açık:** Kullanım Şartları §1 ve
> §3 kayıt kutusunu hâlâ Gizlilik Politikası'na bağlıyor; ayrı arka yüz PR'ı
> (§22.6).

### 22.1 Neden

Ödeme sayfası sipariş satırlarını ve toplamı yalnız yan özette gösteriyordu;
özet telefonda kapalı açılır. Cayma şartları yalnız bağlantıdaki belgedeydi,
ÖBF ve MSS genel metin olarak yeni sekmede açılıyordu, ön bilgilendirme
yazıları 12-15 px idi ve teslimat satırı "Türkiye geneli" diyordu. Kayıt
formu aydınlatma metnini "kabul" ettiriyordu.

### 22.2 Değişen cümleler

| Yer | Mevcut | Yeni |
|---|---|---|
| Ödeme, 1. adım, teslimat satırı | Türkiye geneli | Yalnız Türkiye içindeki adreslere gönderiyoruz |
| Ödeme, 2. adım, kartın hemen üstü: "Siparişin" (her genişlikte açık) | (yoktu) | Her satır "<ürün> · <varyant> × <adet>   <tutar>", ardından "Kargo   <tutar \| Ücretsiz>", varsa "İndirim · <kod>   −<tutar>", "Toplam (KDV dahil)   <tutar>" ve tek, soluk satır "KDV dahil: %1 · 9,16₺, %20 · 214,15₺" |
| Ödeme, 2. adım, "Siparişin"in altı: "Cayma hakkın" | (yoktu) | Kargo siparişlerinde ürünü teslim aldığın günden itibaren 14 gün içinde gerekçe göstermeden cayabilirsin; teslimattan önce de cayabilirsin. Bildirimini {{EMAIL}} adresine yazman yeterli. Ürünü bildiriminden sonraki 14 gün içinde geri gönder: sana e-postayla göndereceğimiz iade koduyla gönderirsen ücret ödemezsin, başka bir kargoyla gönderirsen ödediğin ücreti geri öderiz. Çabuk bozulabilen gıdalarda (gelato gibi soğuk zincir gerektiren ürünler), ambalajı açılmış olup iadesi sağlık ve hijyen açısından uygun olmayan ürünlerde (açılmış kahve paketi, yenilebilir kup kutusu, krema, şurup) ve isteğine göre öğütülen ya da kişiye özel hazırlanan ürünlerde cayma hakkı yoktur. Ürün ayıplı, bozuk, eksik veya yanlış gelirse yasal hakların her hâlükârda saklıdır. (ardından "İptal, iade ve cayma" bağlantısı) |
| Ödeme, 2. adım, "Ödemeden önce okuyabilirsin:" | Ön Bilgilendirme Formu, Mesafeli Satış Sözleşmesi, İptal, iade ve cayma (üçü de yeni sekmede) | Ön Bilgilendirme Formu, Mesafeli Satış Sözleşmesi: sayfada bir panelde açılır (değiştirici tuşla yine yeni sekmede); "İptal, iade ve cayma" cayma notunun altına taşındı |
| ÖBF ve MSS paneli, başı: "Bu siparişin bilgileri" | (yoktu) | Alıcı, E-posta, Telefon, Teslimat adresi, her ürün "Ürün n: <ürün> · <varyant> × <adet>: <tutar> (KDV dahil)", Kargo, İndirim ("Yok" ya da "−<tutar> (<kod>)"), Toplam (KDV dahil), Toplamdaki KDV, Ödeme yöntemi "Kart, tek çekim (PayNkolay, 3D Secure)" (tutar sıfırsa "Ödeme alınmaz: tutarın tamamı indirimle karşılanır"), Tarih (köşkün günü, "19 Ekim 2026"); ardından belgenin /hukuk'taki metni |
| Ödeme, yan özet | Toplam (KDV dahil) | Altına "KDV dahil: %<oran> · <tutar>, ..." satırı |
| Üye ol, onay kutusu | Kullanım Şartları ve Gizlilik Politikası'nı (KVKK aydınlatma metni dahil) okudum, kabul ediyorum. | Kullanım Şartları'nı okudum, kabul ediyorum. |
| Üye ol, kutunun altı (kutusuz) | (yoktu) | Kişisel verilerinin nasıl işlendiğini Gizlilik Politikası ve KVKK Aydınlatma Metni'nde okuyabilirsin. |

Yazı boyutu (`globals.css`, px):

| Kural | Mevcut | Yeni |
|---|---|---|
| `.co-docs` (belge listesi) | 13,5 | 16 |
| `.co-docs-seller` (satıcı satırı) | 12 | 16 |
| `.checkout-consent label` (iki onay kutusu) | 13,5 | 16 |
| `.checkout-consent-note` (onayın kaydı notu) | 12 | 16 |
| `.co-ship-method`, `.co-ship-method-meta` (teslimat satırı) | 14, 13 | 16 |
| `.co-accepted` (kabul edilen kartlar) | 13 | 16 |
| `.co-brief`, `.co-withdrawal`, panel gövdesi (yeni) | - | 16 (başlıklar 18-20) |
| `/hukuk` `.legal-section p`, `.legal-bullets li`, `.legal-ordered li` | 15 | 16 |
| `/hukuk` `.legal-table`, `.legal-table th` | 14, 13 | 16 |

### 22.3 Kararlar

- **Tutarlar:** ekrandaki tutarlar, sunucu sepeti fiyatladığında (reddedilen
  denemenin bıraktığı sipariş, fiyat onayı) onun teklifi (`quote`). Sipariş
  açılırken sunucu başka bir toplam bulursa banka sorulmaz, yeni tutar
  gösterilir ve müşteri yeniden onaylar (docs/PAYNKOLAY.md §15.5 adım 3);
  "Siparişin", yan özet ve düğmenin yanındaki toplam aynı sayıyı okur.
- **KDV notu:** her satırın siparişe damgalanacak oranı (`productTaxRate`,
  `shopLineItems`'ın kuralı). Bir satırın oranı bilinmiyorsa ya da satırlar
  gösterilen toplamı tutmuyorsa not çıkmaz, "KDV dahil" kalır; ödenen tutar
  değişmez. Kargo ücreti ürünlere paylaştırılmaz: `taxRates.shipping`
  oranında (varsayılan %20) ayrı kalemdir, sipariş sayfasının fişi gibi
  (kdv-rates-and-invoice-lines, §16).
- **Panel:** belge /hukuk/[slug] ile aynı okunur (`findLegalDoc` +
  `getPublishedLegalOverride`), panelde yayımlanmış metin varsa o. Metin
  sunucuda çizilir; 25 belgelik kayıt tarayıcı paketine girmez. "Bu
  siparişin bilgileri" sayfada kurulur, siparişle saklanmaz: dolu kopyanın
  siparişle ve onay e-postasıyla saklanması legal-versions-durable-copy
  PR'ının işi.
- **Cayma notu** kararın metnini aynen yazar; e-posta `LEGAL_ENTITY.email`.

### 22.4 Bilerek değişmeyenler

- Sözleşme metinleri (`content.ts`): 14 günlük iade, ücretsiz iade kodu,
  yalnız Türkiye ve istisnalar §18 (Y4) ile zaten yazılı.
- `src/app/uye/actions.ts`'teki ret cümlesi "Devam etmek için kullanım
  şartları ve gizlilik politikasını kabul etmelisin." ve
  `src/lib/customer/store.ts`'teki aynı ret cümlesi: arka yüz
  dosyaları ön yüz PR'ında değişmez (CLAUDE.md, ön yüz ↔ arka yüz sınırı).
  Kutu `required` olduğu için tarayıcı bu cümleyi neredeyse hiç göstermez.
  Ayrı PR: "Devam etmek için Kullanım Şartları'nı kabul etmelisin."
- Uygulamanın kayıt ve giriş ekranı: lafmobil `app-auth-footer-privacy-wording`.
- Kart formunun içindeki küçük yazılar (güvenlik notu, ödeme altyapısı
  satırı): kart dosyalarına dokunulmadı (kural 28); ön bilgilendirme değil.

### 22.5 Hukuki dayanak

| Konu | Dayanak | Karar |
|---|---|---|
| Sipariş ve cayma kartın üstünde, her genişlikte açık | Mesafeli Sözleşmeler Yönetmeliği m.6/2-a (a, d, g, h bentleri); 6563 s. Kanun m.4/1-a; Elektronik Ticaret Aracı Hizmet Sağlayıcı ve Elektronik Ticaret Hizmet Sağlayıcılar Hakkında Yönetmelik (RG 29.12.2022-32058) m.8/1-b | Temel nitelikler, vergiler ve teslim masrafı dahil toplam, cayma şartları ve cayma hakkının olmadığı hâller, ödeme bilgileri girilmeden ve ödeme yükümlülüğünden hemen önce bir bütün olarak ayrıca gösterilir. Telefonda kapalı açılan yan özet bunu sağlamadığı için ayrı ve katlanmayan blok. |
| Teslimat kısıtı | MSY m.6/2-b | Gönderim yalnız Türkiye içindeki adreslere; sipariş vermeden önce teslimat adımında yazılır. |
| ÖBF ve MSS bu siparişin bilgileriyle | MSY m.5/1, m.5/2, m.7/1 (ispat satıcıda); ETHS Yön. m.8/1-ç, d | Ön bilgilendirme sözleşmeye özgüdür; ödeme sayfasından açılan belge alıcı, adres, satırlar, toplam, ödeme yöntemi ve tarihle dolu açılır, sayfa terk edilmez (yazılan kart kalır). Saklama ayrı PR. |
| 16 px | MSY m.6/1 (en az on iki punto); 1 pt = 1/72 inç, 1 CSS px = 1/96 inç | 12 pt = 16 CSS px; ekran için resmî bir çevirme yok, bu yüzden en az 16 px. Ödeme sayfasının notları, onay kutuları, yeni bloklar, panel ve /hukuk metinleri. |
| İade kargo bedeli istenmez | MSY m.12/5, m.5/1-g (RG 24.05.2025-32909, yürürlük 1.1.2026); m.12/1, m.12/4, m.14/1 | Taşıyıcı adlandırılmadığı için not "iade koduyla gönderirsen ücret ödemezsin, başka kargoyla gönderirsen ödediğin ücreti geri öderiz" der (OP-RETURN-CARRIER). |
| İstisnalar dar | MSY m.15/1-b, c, ç | Çabuk bozulan: gelato ve soğuk zincir; ambalajı açılınca hijyen: kahve paketi, yenilebilir kup kutusu, krema, şurup; isteğe göre öğütülen ve kişiye özel ürün. Kapalı kutu ve paket istisna değildir. |
| KDV tutarı | KDV Kanunu m.24/a (ayrı gösterilen taşıma ayrı kalem, özelge 32391), m.25/a (faturadaki iskonto matraha girmez) | Not toplamın içindeki KDV'yi oran oran yazar, satırların damgalanacak oranından; iskonto satırlara paylaştırılır, kargo kendi oranında (%20) ayrı kalemdir (§16). Bilgi amaçlıdır, tutarı değiştirmez. |
| Kayıtta aydınlatma kabul ettirilmez | 6698 s. KVKK m.10; Kurul İlke Kararı 18.02.2026, 2026/347 (RG 24.03.2026-33203) | Aydınlatma bir bilgilendirmedir; ondan onay ya da "kabul" istenmez, açık rıza ve sözleşme metinleriyle tek kutuda birleştirilmez. Kutu yalnız Kullanım Şartları'nı kabul eder; Gizlilik Politikası ve KVKK Aydınlatma Metni kutusuz bir satırda okunacak metin olarak gösterilir. `acceptedTerms` alanı ve işaretsiz başlaması aynen kalır. Kullanım Şartları'nın aynı kararla çelişen iki cümlesi ayrı PR'da düzelir (§22.6). |

### 22.6 Açık: Kullanım Şartları kayıt kutusunu hâlâ Gizlilik Politikası'na bağlıyor

Kayıt formu artık yalnız Kullanım Şartları'nı kabul ettiriyor, ama kutuyla
kabul edilen Kullanım Şartları'nın iki cümlesi Gizlilik Politikası'nı hâlâ
kabulün ve sözleşmenin parçası sayıyor. Sayfa ile metin çelişiyor ve metin
§22.5'teki karara (KVKK m.10, Kurul İlke Kararı 2026/347) aykırı. Cümleler
`src/lib/legal/content.ts`'te (arka yüz); bu ön yüz PR'ında değişmez.

| Yer | Mevcut | Yeni (ayrı PR) |
|---|---|---|
| Kullanım Şartları §1, 4. paragraf | "İşbu Şartlar; Gizlilik ve Kişisel Verilerin Korunması Politikası, Çerez Politikası, Ön Bilgilendirme Formu, ... ile sitede yayımlanan diğer politika metinleriyle bir bütün oluşturur. Anılan metinler işbu Şartların ayrılmaz ekleri niteliğindedir." | "İşbu Şartlar; Ön Bilgilendirme Formu, Mesafeli Satış Sözleşmesi, İptal ve İade Koşulları, Teslimat ve Kargo Koşulları, Mobil Uygulama Kullanım Koşulları (/hukuk/mobil-uygulama-kosullari) ve Sadakat (Damga) Programı Kuralları (/hukuk/odul-programi) ile bir bütün oluşturur. Anılan metinler işbu Şartların ayrılmaz ekleri niteliğindedir. Gizlilik ve Kişisel Verilerin Korunması Politikası, KVKK Aydınlatma Metni ve Çerez Politikası kişisel verilerin nasıl işlendiğini anlatan bilgilendirme metinleridir; işbu Şartların eki değildir ve kabul edilmez." |
| Kullanım Şartları §3, 2. paragraf | "Üyelik oluşturma adımında, kayıt formunda yer alan onay kutucuğunu işaretlemek suretiyle işbu Şartları ve Gizlilik ve Kişisel Verilerin Korunması Politikası'nı açıkça kabul etmiş sayılırsınız. ..." | "Üyelik oluşturma adımında, kayıt formunda yer alan onay kutucuğunu işaretlemek suretiyle işbu Şartları açıkça kabul etmiş sayılırsınız. Gizlilik ve Kişisel Verilerin Korunması Politikası ile KVKK Aydınlatma Metni bilgilendirme amaçlıdır; kabul edilmez ve bu kutucuğun kapsamında değildir. ..." (cümlenin geri kalanı aynen) |
| `src/app/uye/actions.ts` ve `src/lib/customer/store.ts`, ret cümlesi | "Devam etmek için kullanım şartları ve gizlilik politikasını kabul etmelisin." | "Devam etmek için Kullanım Şartları'nı kabul etmelisin." |

Ayrı PR'ın notları:

- Kullanım Şartları `CHECKOUT_CONSENT_DOCS`'ta değil: `LEGAL_UPDATED`
  yerinde kalır, yalnız belgenin kendi `updatedAt`'i o günün İstanbul
  tarihine taşınır (`tests/legal-dates.test.ts`).
- `feat/legal-karaoke-terms` de Kullanım Şartları'na dokunuyor (başka
  paragraflar, kendi `updatedAt`'i); sonra birleşen tarihi uzlaştırır.
- Uygulamanın kayıt ekranı ve paketlenmiş hukuk metni lafmobil'de ayrı
  (`app-auth-footer-privacy-wording`).
- O PR birleşince `tests/register-consent.test.ts`'teki koşullu kontrol
  kesin bir kontrole döner ve bu alt bölüm "Düzeltilenler"e taşınır.

## 23. Y9 - Mağaza: paketli gıda etiketi ve tarihli indirim (19 Eki 2026)

> **Durum: kodda değişti.** Dal `feat/legal-shop-label-and-discount`
> (X-TGK-SHOP, X-DISCOUNT, karar OP-COMPARE-AT). Operatör kararı (18 Eki
> 2026): avukat turu yok, karar birincil kaynaklarla verildi. Sözleşme
> metinleri (`content.ts`) değişmedi; `LEGAL_UPDATED` ve
> `KARAOKE_LEGAL_UPDATED` yerinde kaldı. ÖBF §5'in ürün sayfasında
> verildiğini söylediği etiket bilgileri artık ürünün kendi alanlarından
> gelir.

### 23.1 Neden

- Ürün modelinde açıklama, kargo ağırlığı ve tek bir `nuts` etiketi
  vardı; içindekiler, 14 alerjen grubu, net miktar, saklama koşulu,
  işletmeci, kayıt numarası, menşe ve beslenme bildirimi yoktu.
- "Eski fiyat" panelde serbestçe, tarihsiz yazılıyordu; Bambu Chasen 750 TL
  satışta, üstü çizili 999 TL ve "%25 indirim" rozetiyle, bitişi olmadan
  gösteriliyordu.

### 23.2 Kararlar

- **Etiket alanları** (`src/lib/shop/food-label.ts`): net miktar,
  içindekiler, beslenme bildirimi, saklama koşulu, kullanım talimatı, menşe
  ülkesi, gıda işletmecisinin adı ve adresi, işletme kayıt / onay numarası;
  alerjenler menünün 14 Ek-1 grubu ve üç durumuyla (girilmedi / hiçbiri /
  gruplar). Hiçbiri tahmin edilmez: her ürün boş başlar, operatör ambalajdan
  yazar. Son tüketim tarihi alınmaz (m.17/2-a onu satın almadan önce
  istemez; ambalajda durur). Kayıtlı kuruyemiş uyarısı (uygulamanın
  okuduğu `nuts`), "Sert kabuklu meyveler" işaretlenmeden girilen
  gruplarla sessizce düşmez: kayıt, menü formundaki gibi hangisinin doğru
  olduğunu sorar; uyarı yalnız "Kuruyemiş uyarısını kaldır" seçilince
  kalkar.
- Gıda rafındaki üründe m.9/1'in satın almadan önce verilmesi gereken
  bilgilerinden biri eksikse sayfa "siparişten önce bize sor" satırını
  tutar ve eksikleri sayar (m.17/2-a'nın "başka uygun araç" yolu): net
  miktar, içindekiler, alerjenler, besin değerleri, saklama koşulu, menşe
  ülkesi, üretici ya da ithalatçı, işletme kayıt numarası. Kullanım
  talimatı yalnız gerektiğinde verildiği için (m.9/1-ı) satırı tutmaz;
  kahve çekirdeği beslenme bildiriminden muaftır (m.19/3, Ek-14). Satır,
  hepsi girildiğinde kalkar; yalnız içindekiler ve alerjenler girildiğinde
  kalkması, net miktarı, saklama koşulunu ve işletmeciyi ne sayfada ne
  adı verilen bir yolda bırakırdı.
- **CSV içe aktarma** (21 Eki 2026, `feat/product-food-label-fields`):
  ürün CSV'si `allergens` ve sekiz etiket sütununu okur. Alerjen hücresi
  Ek-1 gruplarını adıyla ya da anahtarıyla alır, "yok" hiçbirini
  içermez demektir; listede olmayan bir ad ("fıstık": yer fıstığı mı Antep
  fıstığı mı) satırı reddeder, tahmin edilmez. Boş etiket hücresi kayıtlı
  değeri korur: şablondan hazırlanan bir stok dosyası ambalajdan elle
  yazılmış etiketleri silmez; bir alanı silmek ürün formunun işidir.
  Kuruyemiş uyarısı formdaki kuralla aynı: sert kabuklu meyveler onu
  ekler, onu düşürecek liste reddedilir.
- **İndirim** (`src/lib/shop/discount.ts`): eski fiyat yalnız başlangıç ve
  bitiş günüyle kaydedilir; başlangıçtan önceki 10 İstanbul gününde bu
  ürünün çevrim içi satış fiyatı geçmişindeki en düşük fiyata eşit değilse
  reddedilir ve doğru tutar söylenir. Fiyat geçmişi her fiyat değişikliğinde
  veritabanı tetikleyicisiyle yazılır (köşk fiyatı esas alınmaz, m.14/5);
  geçmişi 10 günü kapsamayan üründe indirim en erken hangi gün
  başlayabileceği söylenerek reddedilir; yeni ürüne eski fiyat girilmez.
- Yeni indirim bugün başlar: ileri tarihli başlangıçta düşürülen fiyat
  rozetsiz uygulanır ve kendi 10 gününe girer, geriye tarihli başlangıç da
  olmayan bir indirim günü ilan eder. Süren indirim kendi başlangıcıyla
  yeniden kaydedilebilir; süren, şu an sayfada görünen indirimdir. Eski
  fiyat fiyatla birlikte yazılır: stok reddiyle fiyatı yazılmayan kayıt
  eski fiyatı ve başlangıç gününü de yazmaz (yazsaydı sonraki kayıt,
  fiyatın düşmediği günleri indirim günü diye gösterirdi). Biten indirim
  formda boş açılır; bitmeden açılmış bir formdan aynen geri gelirse kayıt
  onu siler ve ürünün öteki alanlarını yazar (her indirim bittiği için
  aksi, ürünün her sonraki kaydını reddederdi).
- Fiyat farkı olan varyantı bulunan üründe eski fiyat reddedilir: geçmiş
  ürün fiyatını tutar, varyantınkini değil.
- Tarihsiz, tarih aralığı dışındaki ya da satış fiyatından yüksek olmayan
  eski fiyat hiçbir yüzeyde gösterilmez (ürün sayfası, hızlı bakış, kart,
  öne çıkan set, "İndirimde" süzgeci, Google verisi, paylaşım kartı, `GET
  /api/mobile/v1/shop`). Migration tarihsiz eski fiyatları 0 yapar
  (OP-COMPARE-AT'in Bambu Chasen adımı, bütün ürünlerde). CSV içe aktarma
  eski fiyatı yalnız aynen bırakır ya da siler; eski fiyatı olan üründe
  fiyatı ona ya da üstüne çıkaran satırı, formdaki gibi, aynı satırda eski
  fiyat silinmedikçe reddeder (yükseltilip sonra indirilen fiyat eski
  rozeti ve başlangıç gününü 10 gün denetimi olmadan geri getirirdi).
- Uygulama (`compareAtPriceMinor` v1'de zorunlu sayı, 0 = indirim yok)
  tarihleri isteğe bağlı yeni alanlarla alır; tarihli rozeti çizen sürüm
  asgari sürüm olana kadar operatör ürünlere eski fiyat girmez.

### 23.3 Değişen cümleler

Sözleşme metni değişmedi. Yeni müşteri cümleleri:

| Yer | Mevcut | Yeni |
|---|---|---|
| Ürün sayfası ve hızlı bakış, üstü çizili fiyatın altı | (yoktu) | İndirim <gün ay yıl> - <gün ay yıl> tarihleri arasında geçerli |
| Mağaza kartı, fiyatın altı | (yoktu) | İndirim <gün> <ay kısaltması> - <gün> <ay kısaltması> |
| Ürün detayları, alerjenler girilmiş ve hiçbiri yok | (yoktu) | 14 alerjen grubunun hiçbirini içermez |
| Ürün detayları, etiketin bir kısmı girilmiş | (yoktu) | Etiket bilgisi: <eksikler, ör. "Net miktar, saklama koşulu ve işletme kayıt numarası"> için siparişten önce bize sor: <e-posta> ya da <telefon> |

### 23.4 Operatöre

- Bambu Chasen'in ve diğer ürünlerin eski fiyatı migration ile 0 olur;
  uygulamanın tarihli rozeti yayına girip asgari sürüm ona çekilene kadar
  eski fiyat girme (OP-COMPARE-AT).
- Paketli gıdaların etiketini (`/admin/urunler` → Temel bilgi → Alerjen ve
  Gıda etiketi) ambalajdan aynen gir; tedarikçi ya da tarif değişince aynı
  gün güncelle.

### 23.5 Hukuki dayanak

- TGK Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği m.9/1
  (zorunlu bilgiler a-j), m.17/2-a (uzaktan satışta (e) hariç hepsi satın
  alma tamamlanmadan önce), m.17/2-b (hepsi teslimde), Ek-1 (14 grup).
- Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği m.14/1 (indirimden
  önceki fiyat, başlangıç ve bitiş tarihleri), m.14/3 (mal satışında
  başlangıçtan önceki 10 günün en düşük fiyatı; RG 1/7/2026-33297,
  yürürlük 1/8/2026), m.14/5 (yalnız indirimin yapıldığı kanalın fiyatı).
- Fiyat Etiketi Yönetmeliği m.11/1 (indirimli satışta etikette ve listede
  indirimli fiyat, indirimden önceki fiyat ve indirim; ispat satıcıda).

## 24. Y10 - Fatura e-Arşiv olarak e-postayla, kurumsal fatura bilgisi e-postayla, karaoke faturası; İşlem Rehberi; meslek odası (20 Ekim 2026)

> **Durum: kodda değişti.** Dal `feat/legal-invoice-and-company-info`.
> Operatör kararı (18 Ekim 2026): avukat ve mali müşavir turu yok, karar
> birincil kaynaklarla verildi (ASK-INVOICE, ASK-KAR-KDV, OP-KEP-CHAMBER,
> D-ISLEM-DURABLE). Operatör (19 Ekim 2026): şirket faturalarını zaten
> elektronik olarak düzenliyor. `LEGAL_UPDATED` ve `KARAOKE_LEGAL_UPDATED`
> **20 Ekim 2026** (§24.4). Bu bölüm §11'deki R9 (E1) önerisinin yerine
> geçer.

### 24.1 Neden

- Şirket Bilgileri §14 faturanın yalnız "talep üzerine" e-postayla
  gönderildiğini, MSS §9 ise e-postaya "muvafakat" ve "talep edilirse kâğıt
  çıktı" diyordu. Fatura alıcıya verilir (VUK m.229) ve şirket her faturasını
  elektronik olarak düzenleyip e-postayla gönderiyor; kargodaki koliye ayrı
  irsaliye konmuyor.
- Şirket Bilgileri §14 kurumsal fatura bilgisinin "sipariş öncesinde"
  girilmesini istiyordu; ödeme adımında bunun için alan yok
  (`src/app/odeme/actions.ts`). Satış Politikası §24 ve Teslimat ve Kargo
  zaten "siparişten sonra e-postayla" diyor.
- Karaoke §12 faturanın ne zaman, hangi tutar için düzenlendiğini
  söylemiyordu.
- Elektronik ticaret yönetmeliğinin istediği "işlem rehberi" yoktu (içerik
  ÖBF §9 ve §22'ye dağılmıştı); Şirket Bilgileri'nde meslek odası satırı
  yoktu.

### 24.2 Değişen cümleler

| Yer | Mevcut | Yeni |
|---|---|---|
| MSS §9, 2. paragraf, 2. cümle | Faturanın elektronik ortamda düzenlenmesi hâlinde ALICI, faturanın kayıtlı e-posta adresine elektronik ortamda iletilmesine muvafakat eder; talep etmesi hâlinde faturanın kâğıt çıktısı da gönderilir. | Fatura e-Arşiv fatura olarak düzenlenir ve ALICI'nın sipariş sırasında bildirdiği e-posta adresine elektronik ortamda iletilir. Kargoyla gönderilen siparişlerde faturanın kâğıt çıktısı irsaliye yerine geçer ve ürünle birlikte gönderilir. |
| ÖBF §16, 1. paragraf | Siparişe ilişkin fatura, 213 sayılı Vergi Usul Kanunu ve ilgili mevzuata uygun olarak, ALICI'nın sipariş sırasında bildirdiği bilgiler esas alınarak düzenlenir ve ALICI'ya iletilir. Sipariş sırasında bildirilen bilgilerin doğruluğundan ALICI sorumludur. | Siparişe ilişkin fatura, 213 sayılı Vergi Usul Kanunu ve ilgili mevzuata uygun olarak, ALICI'nın sipariş sırasında bildirdiği bilgiler esas alınarak e-Arşiv fatura olarak düzenlenir ve ALICI'nın sipariş sırasında bildirdiği e-posta adresine elektronik ortamda iletilir. Kargoyla gönderilen siparişlerde faturanın kâğıt çıktısı irsaliye yerine geçer ve ürünle birlikte gönderilir. Sipariş sırasında bildirilen bilgilerin doğruluğundan ALICI sorumludur. |
| Şirket Bilgileri §14, 1. paragraf | Tüm satışlar için 213 sayılı Vergi Usul Kanunu ve ilgili tebliğler uyarınca fatura düzenlenir. Fatura türü, Şirketin mükellefiyet durumuna ve mevzuata göre belirlenir. Fatura talepleriniz ve fatura örneği isteğiniz için {{EMAIL}} adresine başvurabilirsiniz. | İnternet sitesi ve mobil uygulama üzerinden ödenen siparişler ile karaoke odası rezervasyonları için 213 sayılı Vergi Usul Kanunu ve ilgili tebliğler uyarınca elektronik fatura düzenlenir: e-Arşiv fatura, e-Fatura kullanıcısı olan alıcılara e-Fatura. e-Arşiv fatura siparişte veya rezervasyonda bildirdiğiniz e-posta adresine gönderilir. Faturanız e-postanıza ulaşmadıysa ya da faturanızla ilgili bir talebiniz varsa {{EMAIL}} adresine yazabilirsiniz. |
| Şirket Bilgileri §14, 2. paragraf (baş) | Kurumsal fatura talep ediyorsanız ticaret unvanı, vergi dairesi ve vergi kimlik numarasını sipariş öncesinde eksiksiz girmeniz gerekir; | Kurumsal fatura istiyorsanız ticaret unvanı, vergi dairesi ve vergi kimlik numarasını sipariş numaranızla birlikte, siparişten sonra ve ürün kargoya verilmeden önce {{EMAIL}} adresine iletmeniz gerekir; fatura bu bilgilerle düzenlenir, e-Fatura kullanıcısıysanız e-Fatura olarak; (cümlenin geri kalanı aynı) |
| Şirket Bilgileri §14, tablo "Fatura türü" | Mevzuata uygun fatura (türü Şirketin mükellefiyet durumuna göre belirlenir) | e-Arşiv fatura; e-Fatura kullanıcısı olan alıcılara e-Fatura |
| Şirket Bilgileri §14, tablo "Fatura iletim yöntemi" | Fatura örneği talebi üzerine {{EMAIL}} adresi üzerinden | e-Arşiv fatura olarak düzenlenir ve siparişte bildirdiğiniz e-posta adresine gönderilir (kargoyla gönderilen siparişlerde ürün kargoya verildiği anda, diğer siparişlerde ve karaoke odası rezervasyonlarında teslimden ya da hizmetin verildiği günden itibaren en geç 7 gün içinde); e-Fatura, e-Fatura sistemi üzerinden iletilir |
| Şirket Bilgileri §14, tablo (yeni satır) "Koliyle gönderilen belge" | (yoktu) | Faturanın kâğıt çıktısı; irsaliye yerine geçer ve ürünle birlikte gönderilir |
| Karaoke koşulları §12 (tek paragraf) | Ödenen bedel için fatura mevzuata uygun olarak düzenlenir; faturanızın bir örneğini {{EMAIL}} adresinden talep edebilirsiniz. İptal ve iade hâlinde gerekli düzeltme belgesi düzenlenir. | Ödediğiniz tutar hizmet gününe kadar ön ödeme niteliğindedir. Fatura, e-Arşiv fatura olarak rezervasyon gününden itibaren en geç 7 gün içinde düzenlenir ve rezervasyonda bildirdiğiniz e-posta adresine gönderilir. İptalde size iade edilen tutar faturalanmaz; iade edilmeyen tutar karaoke odası hizmet bedeli olarak faturalanır. Ödediğiniz KDV dâhil tutar, rezervasyon ile hizmet günü arasında vergi oranı değişse de değişmez. |
| Şirket Bilgileri §2, tablo (iki yeni satır) | (yoktu) | "Kayıtlı olunan meslek odası": `{{CHAMBER}}`; "Meslek odasının davranış kuralları": `{{CHAMBER_RULES_URL}}`. İkisi de boş: satırlar basılmaz (§24.5) |
| Şirket Bilgileri §9, belge tablosu (yeni satır) | (yoktu) | "İşlem Rehberi": /hukuk/islem-rehberi |
| Site altı, Yasal sütunu | (yoktu) | İşlem rehberi (yedinci bağlantı, İptal, İade & Cayma'nın ardından) |
| Panel, yazdırılan sipariş fişi | Bu fiş mali belge değildir. | İnternetten ödenen siparişte ve havale ile ödenen manuel siparişte: "Bu fiş mali belge değildir. Faturan elektronik olarak e-postana gönderilir." Manuel siparişte nakit ya da kasadaki kart cihazında: "Bu fiş mali belge değildir. Mali belgen kasadan verilen fiştir." Ödenmemiş siparişte, e-postasız siparişte, ödeme yolu kayıtlı olmayan manuel siparişte ve "Diğer" ödemede (yol bilinmiyor, kasa fişi de olabilir) yalnız ilk cümle. |

### 24.3 Yeni belge: İşlem Rehberi (`/hukuk/islem-rehberi`)

Kategori "Sipariş", belgelerin "siz" dili, on iki bölüm: 1. Bu Rehber Ne
Anlatır, 2. Sipariş Vermeden Önce, 3. İnternet Sitesinde Sipariş Adımları
(dokuz adım, sayfadaki düğme adlarıyla), 4. Mobil Uygulamada Sipariş, 5.
Karaoke Odası Rezervasyonu (altı adım), 6. Girdiğiniz Bilgileri Görme ve
Düzeltme, 7. Sözleşmenin Kurulması, 8. Sözleşme Metninin Saklanması ve Size
Ulaşması, 9. Fatura, 10. Siparişten Sonra: İptal, Cayma ve İade, 11. Şikâyet
ve Uyuşmazlık Çözümü, 12. İletişim. İçerik ÖBF §9, §21 ve §22'den, MSS
§5'ten (sözleşmenin kurulması) ve karaoke koşullarından alındı; o belgeler
değişmedi.

§8'in ilk paragrafı D-ISLEM-DURABLE kararının metnidir, durable-copy yayına
girene kadar aynen kalır:

> Siparişte onayladığınız Ön Bilgilendirme Formu ve Mesafeli Satış
> Sözleşmesi'nin hangi sürümü olduğu, onay tarihi ve saatiyle birlikte
> siparişinizin kaydında saklanır. O sürümün metnini {{EMAIL}} adresine
> sipariş numaranızla yazarak isteyebilirsiniz; sipariş onayı e-postanızdaki
> bağlantılar belgelerin güncel metnini açar.

durable-copy bu paragrafı onaylanan metnin eki ve sürüm bağlantısı cümlesiyle
değiştirir.

Bilerek yazılmayanlar: masaya sipariş (uygulamanın masa ekranı henüz
yayında değil; AASA `/masa/*` talep etmez), kayıtlı kart (kural 28). §11 yalnız
yasal uyuşmazlık yollarını sayar (hakem heyeti, zorunlu arabuluculuk,
mahkeme, TÜBİS); başka bir çözüm kuruluşu adlandırılmaz.

### 24.4 Sürüm

- `LEGAL_UPDATED` 19 Ekim 2026'dan **20 Ekim 2026**'ya: ÖBF ve MSS değişti,
  ödeme onayının kaydettiği sürüm taşınır. 19 Ekim 2026 #163'ün (KDV, §16.4)
  etiketi; aynı İstanbul gününde ikinci bir taşıyıcı birleşmez (D-SAME-DAY).
  Bu PR daha geç bir gün birleşirse etiket o güne çekilir.
- `KARAOKE_LEGAL_UPDATED` 19 Ekim 2026'dan **20 Ekim 2026**'ya: karaoke §12
  değişti. 19 Ekim 2026 #170'in (§17.6) etiketi; aynı kural.
- 19 Ekim 2026'yı kendi tarihi olarak taşıyan on belge (İade ve Cayma,
  Gizlilik, KVKK Aydınlatma, Açık Rıza, Veri Saklama, Çerez, Ticari İleti,
  Kullanım Şartları, Kafe Hizmet Koşulları, Gıda Güvenliği) yeni revizyondan
  önceki bir gün basamayacağı için (`tests/legal-dates.test.ts`) kendi
  tarihini bıraktı ve setin gününü okur. Şirket Bilgileri ve İşlem Rehberi de
  setin gününde.

### 24.5 Operatöre

- **Fatura içeriği (e-Arşiv, internet satışı).** Paraşüt'te internet satışı
  faturasında VUK GT 509 IV.2.4.5'in istediği alanlar dolu olmalı: "Bu satış
  internet üzerinden yapılmıştır." ibaresi, web adresi (laffogato.net), ödeme
  şekli ve tarihi, kargoda taşıyıcının unvanı ve VKN'si, gönderim tarihi ve
  iade bölümü.
- **Koliye giren belge.** Kargo siparişinde fatura koli taşıyıcıya verildiği
  anda saat ve dakikasıyla düzenlenir; kâğıt çıktıya "İrsaliye yerine
  geçer." yazılır, imzalanır ve koliye konur (509 V.5.2). Paneldeki "Sipariş
  Fişi" bunun yerine geçmez.
- **Karaoke.** Her gün, önceki günün rezervasyonları için e-Arşiv fatura:
  satır "Karaoke odası, <gün> <saat>, <süre> saat" (gelinmediyse ", gelinmedi",
  geç iptalde ", geç iptal"), tutar ödenen eksi iade edilen (rezervasyon
  sayfasındaki "Faturalanacak tutar"), KDV %20. Fatura kesilmeden yapılan tam
  iade için belge yok. Fatura kesildikten sonra iade olursa tüketiciye KDV'si
  ayrı gösterilen gider makbuzu, mükellefe iade faturası; KDV düzeltmesi
  (KDV K. m.35) o ayın beyannamesinde.
- **Kurumsal fatura.** E-postayla gelen unvan, vergi dairesi ve VKN
  kargodan önce faturaya işlenir; alıcı e-Fatura kullanıcısıysa e-Fatura
  düzenlenir.
- **Meslek odası ve KEP (31 Ekim 2026'ya kadar).** Şirketin oda kayıt ya da
  faaliyet belgesinden kayıtlı olduğu oda ve odanın meslek kuralları
  sayfasının adresi; KEP adresi (yoksa BTK yetkili bir KEP sağlayıcısından).
  Üç değer `src/lib/legal/entity.ts`'e (`chamber`, `chamberRulesUrl`, `kep`)
  girer; satırlar o zaman basılır ve Şirket Bilgileri'nin tarihi o gün olur.
  Tahminle yazılmaz.
- **Uygulama.** lafmobil'in çevrimdışı kopyası (`legal:export`) ayrı PR'da
  (app-legal-seed-invoice); İşlem Rehberi paketlenen belgelerden değil,
  dizinde görünür.

### 24.6 Bilerek değişmeyenler

- ÖBF §9 ve §22: sipariş adımları ve onay kaydı sözleşmenin parçası olarak
  yerinde kaldı; İşlem Rehberi onları özetler, yerine geçmez.
- MSS §9'un kurumsal fatura paragrafı ("fatura düzenlenmeden önce {{EMAIL}}
  adresine") ve iade faturası paragrafı: yeni kuralla zaten uyumlu.
- Ödeme Koşulları §20, Satış Politikası §24, Teslimat ve Kargo'nun kurumsal
  teslimat cümleleri: fatura bilgisini siparişten sonra e-postayla alıyorlar.
- Şirket Bilgileri §15'teki "Kurumsal siparişlerde fatura, sipariş öncesinde
  bildirilen ticaret unvanı..." maddesi: sepet dışı, yazılı teklifle yürüyen
  toplu satış içindir.
- Ödeme formuna kurumsal fatura alanı eklenmedi (form sözleşmesi ve mobil
  sözleşme değişmez).

### 24.7 Hukuki dayanak

| Konu | Dayanak | Karar |
|---|---|---|
| Fatura alıcıya verilir, 7 gün | 213 s. VUK m.229, m.231/5; m.353 (belge düzenine aykırılık) | Fatura e-postayla gönderilir, talebe bırakılmaz; kargoda koli taşıyıcıya verildiği anda, diğer siparişlerde teslimden ve hizmetten itibaren en geç 7 gün içinde. |
| Her fatura elektronik | VUK GT 509 IV.2.4.3 (GT 573 ve 589 ile değişik): 1.1.2026'dan beri bilanço esasındaki mükellefin her faturası e-Arşiv; GT 509 V. bölüm: e-Fatura kayıtlı alıcıya e-Fatura | Tüketiciye e-Arşiv fatura; e-Fatura kullanıcısı kurumsal alıcıya e-Fatura. Şirket Paraşüt ile düzenliyor (operatör, 19 Ekim 2026); müşteri metinlerinde sağlayıcı adı geçmez, KVKK metinleri onu alıcı olarak sayar. |
| İnternet satışında iletim ve koli belgesi | VUK m.230/5; VUK GT 509 IV.2.4.5, V.5.2 | e-Arşiv fatura elektronik ortamda iletilir; malın yanında sevk irsaliyesi ya da irsaliye yerine geçen e-Arşiv fatura çıktısı bulunur. Seçilen: çıktı, "İrsaliye yerine geçer." ibaresi ve imzayla. |
| Kurumsal fatura bilgisi | VUK m.230 (faturada alıcının unvanı ve vergi numarası) | Ödeme adımına alan eklenmez; bilgi sipariş numarasıyla, siparişten sonra ve kargodan önce e-postayla alınır (Satış Politikası §24 ile aynı kural). |
| Karaoke ön ödemesi | 3065 s. KDV K. m.10/a-b, m.35; KDV GUT I/A-11.1; GİB özelgesi 29823 (ön ödeme fatura kesilmedikçe vergiyi doğurmaz); VUK m.231/5 | Ödeme hizmet gününe kadar avanstır; fatura rezervasyon gününden itibaren en geç 7 gün içinde köşkte kalan tutar için (%20) kesilir; iade edilen tutar faturalanmaz. Güven orta: karaoke için doğrudan özelge yok, kafeterya içi oyun hizmeti özelgelerinden kıyas (33087, 32291). |
| Fiş mali belge değildir | VUK m.229, m.233 | Panel fişi fatura ya da ÖKC fişi gibi görünmez; gerçek belgenin nereden geldiğini söyler (ödeme yoluna göre e-posta ya da kasa fişi). |
| İşlem rehberi | Elektronik Ticaret Aracı Hizmet Sağlayıcı ve Elektronik Ticaret Hizmet Sağlayıcılar Hakkında Yönetmelik (RG 29.12.2022-32058) m.7/1; Mesafeli Sözleşmeler Yönetmeliği m.5/6, m.20/1 | Ana sayfadan (site altı) ulaşılan /hukuk/islem-rehberi: sözleşmenin kurulması için teknik adımlar, giriş hatalarını görme ve düzeltme araçları, sözleşme metninin saklanıp saklanmadığı ve ne kadar erişilebildiği (sürüm ve onay anı siparişle en az 3 yıl, metin e-postayla istenir), uyuşmazlık yolları (hakem heyeti, zorunlu arabuluculuk, TÜBİS). |
| Meslek odası | Aynı yönetmelik m.5/1-c; 6563 s. Kanun m.3/1-a | Oda ve davranış kuralları satırı Şirket Bilgileri'nde, değer belgeden gelene kadar basılmaz (kural 13: yasal kimlik uydurulmaz). |

## 25. Y11 - Onaylanan metnin kalıcı kopyası: her gösterilen sürüm saklanır, onay e-postası doldurulmuş metni ek olarak taşır (21 Ekim 2026)

> **Durum: kodda değişti.** Dal `feat/legal-durable-copy`. Operatör kararı
> (18 Ekim 2026): avukat turu yok, karar birincil kaynaklarla verildi
> (ASK-DURABLE, ASK-OTH-2, D-VERSIONS-TABLE, D-ISLEM-DURABLE). Yalnız İşlem
> Rehberi'nin metni değişti; tarihi **21 Ekim 2026** (§25.4). ÖBF, MSS ve
> karaoke sözleşmesi değişmedi: `LEGAL_UPDATED` ve `KARAOKE_LEGAL_UPDATED`
> 20 Ekim 2026'da kalır.

### 25.1 Neden

- Onay kaydı yalnız bir sürüm ETİKETİ tutuyordu ("20 Ekim 2026"). Aynı gün
  yayımlanan iki metin (kodlu metin ve panel metni, ya da aynı gün birleşen
  iki PR) aynı etiketi taşıyabiliyordu; hangisinin onaylandığı ispat
  edilemezdi (D-SAME-DAY bu yüzden vardı).
- Onay e-postası ve sipariş sayfası yalnız güncel /hukuk sayfalarına
  bağlanıyordu ("bağlantılar belgelerin güncel metnini açar"). Onaylanan
  metin, değiştirilmeden saklanabilecek biçimde tüketiciye verilmiyordu
  (kalıcı veri saklayıcısı).

### 25.2 Ne değişti (kod)

- Gösterilen her metin (kodlu ve panel) kanonik biçimiyle SHA-256 anahtarıyla
  `legal_doc_versions` tablosunda saklanır; tablo yalnız eklenir, satırın
  hash'i metninkiyle tutmazsa veritabanı satırı reddeder. Onay kaydı sürüm
  etiketinin yanına her belgenin hash'ini yazar (`legalConsent.textHashes`):
  web ve uygulama ödemesi, karaoke rezervasyonu.
- `odeme-onaylandi` ve `karaoke-rezervasyon` e-postaları, onaylanan
  belgelerin o sürümünü sipariş ya da rezervasyon bilgileriyle doldurulmuş
  tek bir HTML dosyası olarak ekler (`siparis-<NO>-on-bilgilendirme-ve-sozlesme.html`,
  `karaoke-sozlesme-<KOD>.html`); dosya 16 px, satır içi CSS, harici kaynak ve
  betik yok, yazdırmaya uygun.
- Aynı sürüm `/hukuk/<slug>?surum=<16 hane>` adresinde değişmeden okunur
  (indekslenmez). Üye sipariş sayfasından ve karaoke rezervasyonunun kişiye
  özel bağlantısından aynı dosya indirilir.
- Hiçbir onayın okumadığı kodlu metinler (KVKK, İşlem Rehberi, alt bilgideki
  politikalar) deploy'dan sonraki ilk okumada değil, en geç bir gün içinde
  günlük cron'la ya da o belgeye dokunan panel işlemiyle saklanır
  (`docs/DATABASE.md`, "Gösterilen hukuk metinleri"). Onaylanan metinler
  onayın kendisiyle saklanır.

### 25.3 Değişen cümleler

| Yer | Mevcut | Yeni |
|---|---|---|
| İşlem Rehberi §8, 1. paragraf | Siparişte onayladığınız Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'nin hangi sürümü olduğu, onay tarihi ve saatiyle birlikte siparişinizin kaydında saklanır. O sürümün metnini {{EMAIL}} adresine sipariş numaranızla yazarak isteyebilirsiniz; sipariş onayı e-postanızdaki bağlantılar belgelerin güncel metnini açar. | Siparişte onayladığınız Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'nin o günkü metni siparişinizin bilgileriyle doldurulmuş olarak sipariş onayı e-postanızın ekinde size gönderilir ve üye hesabınızdaki sipariş sayfasından da indirilebilir. Aynı sürüm, e-postadaki bağlantıdan değişmeden okunabilir ve en az 11 yıl saklanır. |
| İşlem Rehberi §8, 2. paragraf, son cümle | Karaoke odası rezervasyonunda onayladığınız belgelerin sürümü ve onay anı rezervasyon kaydınızda saklanır; o sürümün metnini aynı yolla rezervasyon kodunuzla isteyebilirsiniz. | Karaoke odası rezervasyonunda onayladığınız Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'nin o günkü metni rezervasyonunuzun bilgileriyle doldurulmuş olarak rezervasyon onayı e-postanızın ekinde size gönderilir; aynı sürüm e-postadaki bağlantıdan değişmeden okunabilir ve en az 11 yıl saklanır. |
| İşlem Rehberi §8, 3. paragraf (inceleme R5) | (yoktu) | Ek oluşturulamadığı için onay e-postanızda bu metin yer almazsa ya da siparişiniz veya rezervasyonunuz 21 Ekim 2026'dan önce verildiyse, onayladığınız sürümün metnini sipariş numaranızla ya da rezervasyon kodunuzla {{EMAIL}} adresine yazarak isteyebilirsiniz; size e-postayla gönderilir. |
| `odeme-onaylandi` e-postası (siz), belgeler satırı | Sipariş sırasında onayladığınız belgeler (bağlantılar belgelerin güncel metnini açar): Ön Bilgilendirme Formu · Mesafeli Satış Sözleşmesi · İptal, İade ve Cayma Hakkı | Sipariş sırasında onayladığınız Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'nin, sipariş bilgilerinizle doldurulmuş tam metni bu e-postanın ekindedir. Aynı sürüme şu bağlantıdan da ulaşabilirsiniz: Ön Bilgilendirme Formu · Mesafeli Satış Sözleşmesi (iki sürüm bağlantısı) · İptal, İade ve Cayma Hakkı (güncel metin; inceleme R9 ile geri geldi). Ek oluşturulamazsa eski satır aynen kalır. |
| `karaoke-rezervasyon` e-postası (sen), ödenmiş rezervasyon | ... Rezervasyon sayfandan görebilir ve iptal edebilirsin. Tüm koşullar. | ... Rezervasyon sayfandan görebilir ve iptal edebilirsin. Onayladığın Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'nin, rezervasyon bilgilerinle doldurulmuş tam metni bu e-postanın ekinde. Aynı sürümü buradan da okuyabilirsin: (sürüm bağlantısı). Ek oluşturulamazsa "Tüm koşullar" bağlantısı kalır. |
| Üye sipariş sayfası (sen), "Sözleşmeler ve onay kaydı" | (yoktu) | Siparişini verirken onayladığın belgelerin o günkü metni. Sipariş onayı e-postanın ekinde de gönderilir; ekte yoksa buradan indirebilirsin. [Belgeleri indir] (yalnız dosya oluşturulabiliyorsa; inceleme B ve R5) |
| Üye sipariş sayfası (sen), dosya oluşturulamıyorsa (21 Ekim 2026'dan önceki sipariş ya da saklanmamış metin) | (yoktu) | Onayladığın belgelerin sipariş günündeki metnini istersen sipariş numaranla {{EMAIL}} adresine yaz, sana e-postayla gönderelim. |
| Karaoke rezervasyon sayfası (imzalı bağlantı, sen) | (yoktu) | [Onayladığın sözleşmenin metnini indir] |

§8'in 3. paragrafı inceleme R5'le (21 Ekim 2026) eklendi: ek, oluşturulamadığında
e-postayı bekletmemek için düşer (`docs/EMAIL-RESEND.md`, "Ek: onaylanan
sözleşme") ve bu PR'dan önceki onaylarda saklanmış metin yoktur; iki durumda
da e-postayla isteme yolu açık kalır. 1. paragraf (D-ISLEM-DURABLE) kelimesi
kelimesine aynen kaldı.

§8'in 2. paragrafındaki karaoke cümlesi kararın metninde yoktu; 1. paragraf
değişince "aynı yolla" (e-postayla isteme) karşılıksız kaldığı için, karaoke
rezervasyonunun da aldığı eki söyleyen aynı kalıpta yazıldı. Bu PR'dan önceki
siparişlerin onay kaydında hash yoktur: onlara ek gitmez, eski cümle (ve
e-postayla isteme yolu) onlar için geçerli kalır.

### 25.4 Sürüm

- İşlem Rehberi kendi `updatedAt`'ini alır: **21 Ekim 2026**
  (`src/lib/legal/content.ts`; `tests/legal-dates.test.ts`). #180 setin
  tarihini 20 Ekim 2026 yaptığı için bu PR bir sonraki gün olan 21 Ekim 2026'yı
  taşır; daha geç bir gün birleşirse tarih o güne çekilir.
- `LEGAL_UPDATED` ve `KARAOKE_LEGAL_UPDATED` değişmedi: onaylanan belgelerin
  metni aynı.
- **D-SAME-DAY bu PR'la bitti.** Kural (ÖBF/MSS'yi ya da karaoke sözleşmesini
  değiştiren en fazla bir PR aynı İstanbul gününde birleşir) bir etiketin iki
  metni taşımasını önlemek içindi. Artık her onay, gösterilen metnin hash'ini
  etiketin yanında tutuyor ve metin saklanıyor; aynı günün etiketini taşıyan
  iki metin hash'leriyle ayrılır. Etiket yayın gününü göstermeye devam eder.
  Kuralın geçmişi §16.4, §17.6, §18, §24.4'te olduğu gibi kalır.

### 25.5 Operatöre

- Yayından sonraki ilk gerçek siparişte ödeme onayı e-postasının ekini aç
  (Gmail ve bir kurumsal posta kutusu): dosya açılmalı, sipariş bilgileri ve
  iki belgenin tam metni görünmeli, e-postadaki iki sürüm bağlantısı aynı
  metni açmalı. Bazı kurumsal e-posta geçitleri HTML eki ayıklar; o durumda
  sürüm bağlantısı ve üye sayfasındaki indirme ispat olarak kalır.
- Bir onay itirazında (chargeback, tüketici şikâyeti) siparişin onay
  kaydındaki `textHashes` değeri ve `/hukuk/<slug>?surum=<ilk 16 hane>`
  sayfası, siparişte onaylanan metnin kendisidir.
- Uygulamanın çevrimdışı hukuk kopyası (lafmobil `legal.seed.json`) İşlem
  Rehberi'nin yeni metnini bir sonraki `npm run legal:export` ile alır.

### 25.6 Bilerek değişmeyenler

- ÖBF §22 ("kalıcı bağlantıları ... e-postada ALICI'ya gönderilir") ve MSS
  §21 ("bağlantıları ... e-postada yer alır"): doğru kalıyor (e-postada
  bağlantılar var, artık sürüm bağlantısı); ek eklendiği için yanlış olmuyor.
  Değiştirmek onay sürümünü taşırdı.
- Karaoke sözleşmesi §7 ("son ücretsiz iptal anı ve geç iptalde iade edilecek
  tutar rezervasyon onay e-postanızda da yazılıdır") doğru; "ve ekindeki
  belgede" eki yazılmadı, sözleşmenin sürümünü taşımamak için.
- Ek kampanya (toplu) e-postalarına hiç eklenmez; yalnız tekil gönderimde.

### 25.7 Hukuki dayanak

| Konu | Dayanak | Karar |
|---|---|---|
| Onaylanan metnin kalıcı veri saklayıcısıyla verilmesi | 6502 s. TKHK m.4/1 (sözleşme ve ön bilgilendirme kalıcı veri saklayıcısıyla), m.48/4; Mesafeli Sözleşmeler Yönetmeliği m.4/1-c (kalıcı veri saklayıcısı: bilgiyi değiştirilmeden saklamaya ve erişmeye imkân veren araç), m.6/1, m.5/6 (ön bilgilendirmenin ispat yükü satıcıda) | Bağlantı tek başına yetmez: doldurulmuş metin e-postanın ekinde gider, sipariş sayfasından indirilir, değişmez sürüm bağlantısı kalır (ASK-DURABLE). |
| Kayıtların saklanması | MSY m.20/1 (3 yıl); Veri Saklama ve İmha Politikası "Mesafeli satış onay kaydı: sözleşmenin ifasından itibaren 10 yıl" | Metin, ona atıf yapan en yeni onaydan itibaren en az 11 × 366 gün saklanır (`legal-doc-versions` kuralı, `legal_doc_versions_retention`). |
| Sözleşme metninin saklanıp saklanmadığı ve erişimi | Elektronik Ticaret Aracı Hizmet Sağlayıcı ve Elektronik Ticaret Hizmet Sağlayıcılar Hakkında Yönetmelik m.7/1, m.8/1-d | İşlem Rehberi §8 bunu söyler (D-ISLEM-DURABLE). |
| Kişisel veri | 6698 s. KVKK m.4/2-d | Saklanan metinler kamuya açık hukuk metinleridir, kişisel veri yoktur; ekteki sipariş bilgileri yalnız alıcının kendi e-postasına ve oturumdaki sahibine gider. |

## 26. Y12 - Karaoke: işletmenin geç iptalinde telafi, yeniden satılan saatin iadesi, %1-99 açıldı (21 Ekim 2026)

> **Durum: metin ve kod değişti.** Dal `feat/legal-karaoke-make-good-and-resale`.
> Operatör kararı (18 Eki 2026): avukat turu yok; OP-KARAOKE-GOODWILL,
> ASK-OTH-3-CFG, D-KAR-1-99 ve OP-KARAOKE-CFG-DECISION aşağıdaki
> dayanaklarla uygulandı.

### 26.1 Sürüm

Karaoke belgesi değişti (§8, §9): `KARAOKE_LEGAL_UPDATED` (`meta.ts`; belgenin
`updatedAt`'i bu sabittir) yayın günü olarak **21 Ekim 2026**. 20 Ekim'i
§24 (#180) aldı; bu PR kalıcı kopya PR'ından (#193, §25) sonra, 21 Ekim'de
birleşir. Kalıcı kopya onaylanan metnin özetini de kaydettiği için
D-SAME-DAY kalktı. Birleşme günü 21 Ekim değilse altı yer o güne taşınır:
`KARAOKE_LEGAL_UPDATED`, aşağıdaki dört belgenin `updatedAt`'i
(`content.ts`) ve `tests/legal-dates.test.ts`.

Kişisel Veri Saklama ve İmha Politikası, KVKK Aydınlatma Metni, Gizlilik
Politikası ve Ödeme Koşulları'nın metni değiştiği için kendi tarihleri de
21 Ekim 2026 (`updatedAt`): /hukuk ve uygulamadaki "son güncelleme" satırı
doğru kalır. Ödeme onayındaki iki belge (ÖBF, MSS) değişmedi,
`LEGAL_UPDATED` 20 Ekim 2026'da kaldı. Uygulamanın çevrimdışı kopyası lafmobil'de yenilenir (ayrı
PR). `KARAOKE_POLICY_APP_VERSION` null kaldı (OP-KARAOKE-CFG-DECISION):
kuralı her karaoke ekranında sunucudan okuyan uygulama sürümü iki mağazada
yayında değil; canlı kural 2 saat / %0.

### 26.2 Değişen cümleler

| Belge | Yer | Mevcut | Yeni |
|---|---|---|---|
| Karaoke, §8 | 2. paragraf | (yok) | "İptali, sizin için ücretsiz iptal süresinin bittiği andan sonra yapmak zorunda kalırsak, nedeni doğal afet, resmî makam kararı veya bölgesel elektrik ya da su kesintisi gibi elimizde olmayan bir sebep (mücbir sebep) değilse ve rezervasyonunuzda geç iptalde iade edilmeyen bir tutar varsa, iadeye ek olarak bu tutar kadar bir telafi veririz: dilerseniz aynı uzunlukta ücretsiz bir karaoke saati, dilerseniz bu tutarın kendi adınıza kayıtlı banka hesabınıza ödenmesi. Ücretsiz saati iptal tarihinden itibaren 6 ay içinde {{PHONE}} numarasını arayarak veya {{EMAIL}} adresine yazarak boş bir saat için ayırtabilirsiniz; ödemeyi seçerseniz banka hesap bilginizi {{EMAIL}} adresine yazmanızdan itibaren en geç 14 gün içinde yaparız." |
| Karaoke, §9 | 1. paragraf | "Her iade PayNkolay üzerinden, ödemenin yapıldığı karta ve ödenen tutarın tamamı olarak yapılır; kısmi iade yapılmaz. İadenin hesabınıza yansıma süresi bankanıza bağlıdır." | "Her iade PayNkolay üzerinden ödemenin yapıldığı karta yapılır. Tutarın tamamının iadesi iptalle birlikte başlatılır; ödediğiniz tutarın bir kısmı iade ediliyorsa bu tutar en geç 14 gün içinde kartınıza iade edilir. İadenin hesabınıza yansıma süresi bankanıza bağlıdır." |
| Veri Saklama, §8 tablosu | banka hesap satırının anahtarı | "İade için bildirilen banka hesap bilgisi (kısmi iadenin ödemenin yapıldığı karta yapılmasının teknik olarak mümkün olmadığı istisnai hâllerde veya başka bir kargo firmasıyla gönderilen iadenin gönderim bedelinin ödenmesinde alıcının kendi adına kayıtlı hesap bilgisi)" | aynı anahtar + "; karaoke telafisi için bildirilen banka hesap bilgisi" (değer aynı) |
| KVKK Aydınlatma, §6 | karaoke rezervasyon verisi | "... ödenen ve iade edilen tutar, ödemenin PayNkolay işlem referansı ve zamanı, rezervasyon notunuz, ..." | "... ödenen ve iade edilen tutar, ödemenin PayNkolay işlem referansı ve zamanı, rezervasyonunuzu geç iptal etmek zorunda kalırsak verdiğimiz telafi (tutarı, ücretsiz saatin son günü, ücretsiz saat olarak mı yoksa ödeme olarak mı kullanıldığı ve ödeme tarihi), rezervasyon notunuz, ..." |
| KVKK Aydınlatma, §6 | aynı madde, hukuki sebepten önce | (yok) | "Telafinin banka hesabınıza ödenmesini seçerseniz e-postayla bildirdiğiniz kendi adınıza kayıtlı banka hesap bilgisi yalnızca bu ödeme için kullanılır; rezervasyon kaydına yazılmaz, ödemenin belgesiyle muhasebe kayıtlarında saklanır." |
| Gizlilik Politikası, §3 | "Karaoke rezervasyon verisi" satırı | "... ödemenin PayNkolay referansı ve zamanı, uygulanıyorsa üyelik kademenize göre indirim; ..." | "... ödemenin PayNkolay referansı ve zamanı, rezervasyonunuzu geç iptal etmek zorunda kalırsak verdiğimiz telafinin tutarı ve nasıl kullanıldığı (telafinin banka hesabınıza ödenmesini seçerseniz bildirdiğiniz banka hesap bilgisi yalnızca bu ödeme için kullanılır ve rezervasyon kaydına yazılmaz), uygulanıyorsa üyelik kademenize göre indirim; ..." |
| Rezervasyon kuralı (ödeme öncesi cümle, `karaokeCancellationRules`, yalnız %1-99) | geç iptal cümlesi | "Rezervasyon saatine H saatten az kala yapılan iptallerde ödediğin tutarın %P'si kartına iade edilir; rezervasyona gelinmediğinde ücret iadesi yapılmaz." | "Rezervasyon saatine H saatten az kala yapılan iptallerde ödediğin tutarın %P'si en geç 14 gün içinde kartına iade edilir; rezervasyona gelinmediğinde ücret iadesi yapılmaz. Geç iptal ettiğin saat başka bir misafire satılırsa o saat için sende kalan tutar da kartına iade edilir." (bu kuralla yapılmış rezervasyon yok: panel %1-99'u bu PR'a kadar kabul etmiyordu, canlıda uygulama kilidi hâlâ kapalı) |
| Ödeme Koşulları, §14 | 2. paragraf | "Banka hesabına transfer yalnızca iki hâlde, sizin adınıza kayıtlı banka hesabına ödeme yapmak için Satıcı tarafından kullanılır: 22. maddede açıklanan istisnai hâlde iade tutarının ödenmesi ve iadeyi başka bir kargo firmasıyla gönderdiğinizde belgelediğiniz gönderim bedelinin ödenmesi. Karta yapılan iade karttan tahsil edilen tutarı aşamadığından gönderim bedeli karta iade edilmez; belgenin Satıcı'ya ulaşmasından itibaren 14 (on dört) gün içinde, ürün bedelinin iadesinden ayrı olarak ödenir. Bu hâllerde bildirdiğiniz hesap sahibinin adı ve IBAN bilgisi yalnızca bu ödemenin yapılması amacıyla işlenir; üçüncü kişilere ait hesaplara ödeme yapılmaz." | "Banka hesabına transfer yalnızca üç hâlde, sizin adınıza kayıtlı banka hesabına ödeme yapmak için Satıcı tarafından kullanılır: 22. maddede açıklanan istisnai hâlde iade tutarının ödenmesi, iadeyi başka bir kargo firmasıyla gönderdiğinizde belgelediğiniz gönderim bedelinin ödenmesi ve karaoke odası rezervasyonunuzu ücretsiz iptal süresinin bitmesinden sonra iptal etmek zorunda kalırsak, Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'nin 8. maddesindeki telafinin, ödemeyi seçmeniz hâlinde, ödenmesi. Karta yapılan iade karttan tahsil edilen tutarı aşamadığından gönderim bedeli karta iade edilmez; belgenin Satıcı'ya ulaşmasından itibaren 14 (on dört) gün içinde, ürün bedelinin iadesinden ayrı olarak ödenir. Karaoke telafisi, banka hesap bilginizi e-postayla bildirmenizden itibaren en geç 14 (on dört) gün içinde ödenir. Bu hâllerde bildirdiğiniz hesap sahibinin adı ve IBAN bilgisi yalnızca bu ödemenin yapılması amacıyla işlenir; üçüncü kişilere ait hesaplara ödeme yapılmaz." |
| KVKK Aydınlatma, §7 | "Karaoke odası rezervasyonu:" maddesi | "... rezervasyonun iptali ve iadenin yapılması, rezervasyon bağlantısının e-postayla gönderilmesi, ..." | "... rezervasyonun iptali ve iadenin yapılması, rezervasyonunuzu ücretsiz iptal süresinin bitmesinden sonra iptal etmek zorunda kalırsak telafi olarak ücretsiz bir saatin ayrılması ya da telafi tutarının bildireceğiniz, kendi adınıza kayıtlı banka hesabına ödenmesi, rezervasyon bağlantısının e-postayla gönderilmesi, ..." |
| KVKK Aydınlatma, §8 tablosu | karaoke satırının anahtarı | "Karaoke odası rezervasyonunun alınması, ödemesinin tahsili, ekibe bildirilmesi, onay, iptal ve iade bildirimi" | "Karaoke odası rezervasyonunun alınması, ödemesinin tahsili, ekibe bildirilmesi, onay, iptal ve iade bildirimi, rezervasyonunuzu ücretsiz iptal süresinin bitmesinden sonra iptal etmek zorunda kalırsak telafi olarak ücretsiz bir saatin ayrılması ya da telafi tutarının kendi adınıza kayıtlı banka hesabına ödenmesi" (değer aynı: KVKK m.5/2-c) |
| Gizlilik Politikası, §5 tablosu | karaoke satırının anahtarı | "Karaoke odası rezervasyonunun alınması, ödemesinin tahsili, iptali ve iadesi ile rezervasyonla ilgili sizinle iletişim kurulması" | "Karaoke odası rezervasyonunun alınması, ödemesinin tahsili, iptali ve iadesi, rezervasyonunuzu ücretsiz iptal süresinin bitmesinden sonra iptal etmek zorunda kalırsak telafi olarak ücretsiz bir saatin ayrılması ya da telafi tutarının kendi adınıza kayıtlı banka hesabına ödenmesi ile rezervasyonla ilgili sizinle iletişim kurulması" (değer aynı: KVKK m.5/2-c) |
| E-posta, işletme iptali (sen) | para satırından sonra | (yok) | "Ayrıca sana [tutar] tutarında bir telafi veriyoruz: istersen aynı uzunlukta ücretsiz bir karaoke saati ([son gün] tarihine kadar bizi arayarak ya da bu e-postayı yanıtlayarak boş bir saat için ayırtabilirsin), istersen bu tutarın kendi adına kayıtlı banka hesabına ödenmesi (bu e-postayı yanıtlayıp IBAN'ını yaz, 14 gün içinde öderiz)." |
| E-posta, telafi saatinin onayı (sen) | ödeme satırı | "Ödemeyi köşkte yaparsın. ..." | "Bu saat, [kod] rezervasyonun için verdiğimiz telafidir. Bu saat için senden ödeme alınmaz. Planın değişirse [süre] rezervasyon sayfandan iptal edebilirsin; telafin o zaman geri gelir." (kural kimseye iptal izni vermiyorsa: "... Planın değişirse bizi ara: [telefon].") |
| E-posta, yeniden satış iadesi (sen) | para satırı, pay daha önce iade edildiyse | (yok) | "Geç iptal ettiğin saat başka bir misafire satıldığı için sende kalan tutardan [tutar] daha kartına iade edildi; yansıması bankana göre birkaç iş günü sürebilir." |
| E-posta, başlamadan iptal edilen telafi saati (sen) | para satırından sonra | (yok) | İşletme iptalindeki telafi cümlesi, yeniden açılan telafinin tutarı ve son günüyle: "Ayrıca sana [tutar] tutarında bir telafi veriyoruz: istersen aynı uzunlukta ücretsiz bir karaoke saati ([son gün] tarihine kadar ...), istersen bu tutarın kendi adına kayıtlı banka hesabına ödenmesi (...)." |
| E-posta, pay ve yeniden satış iadesi birlikte (sen) | para satırı | (yok; "Rezervasyonundaki geç iptal kuralına göre [tutar] kartına iade edildi" toplamı yalnız kurala bağlıyordu) | "Rezervasyonundaki geç iptal kuralına göre ve geç iptal ettiğin saat başka bir misafire satıldığı için [tutar] kartına iade edildi; yansıması bankana göre birkaç iş günü sürebilir." |

### 26.3 Kararlar ve kod

- **Telafi kimde doğar.** Personelin ödenmiş rezervasyonu iptalinde neden
  `ariza`, `kapanis` ya da `diger` ise, iptal anı rezervasyonun kendi son
  ücretsiz iptal anından (#166: o dakikanın sonu dâhil; eski satırda
  başlangıç eksi 2 saat) sonraysa ve misafirin o anda geç iptalde
  kaybedeceği tutar sıfırdan büyükse: telafi = o tutar (2 saat / %0
  kuralında ödenen tutarın tamamı; %P'de ödenenin kalan kısmı; %100'de
  yok), son gün = iptal günü (İstanbul) + 6 takvim ayı (TBK m.92/3).
  `mucbir`, `misafir` ("Yine de tamamını iade et" dâhil) ve `yeniden`
  telafi doğurmaz. Geç iptal kuralı kime bağlıysa geç telafi de onadır
  (Haksız Şartlar Yön. EK-1 (ç); inceleme R3, orkestratör kararı A, 21 Ekim
  2026): köşkün henüz onaylamadığı ödenmiş rezervasyonun misafiri de süre
  geçince kendi iptalini yapamadığı için (2 saat / %0) telafi doğar; geç
  iptal payı olan kuralda böyle bir rezervasyon misafir geç iptal etse de
  tamamen iade edildiğinden telafi doğmaz. Telafi iadenin ilk adımıyla birlikte
  yazılır, POS iadeyi reddederse geri alınır; yanıtsız iade sonradan
  kaydedilince telafi e-postası o zaman gider (`karaoke-make-good-core.ts`).
- **İki eylem, biri diğerini kapatır.** İade yetkisi olan kişi iptal
  edilmiş rezervasyonun sayfasında "Telafi saati ver" (boş bir gün ve
  saat; aynı süre, aynı misafir; toplam 0, `paymentStatus: "none"`,
  onaylı, `channel: "staff"`, not "Telafi: KRK-…", `makeGoodFor` eski kod;
  çakışma kısıtı geçerli, açık rezervasyon tavanına sayılmaz; misafire
  "Bu saat için senden ödeme alınmaz." onayı) ya da "Telafi ödendi" (havale
  günü, tutar ve not; tutar tam telafi kadar olmalı, koşullar "bu tutarın
  ... ödenmesi" der; ileri tarih reddedilir) seçer.
  Telafi saati tek SQL ifadesinde yazılır (`karaoke_give_make_good_hour`,
  telafi edilen rezervasyonun satır kilidi altında): telafi kullanılmış
  sayılır ve saat yazılır ya da hiçbiri olmaz; araya giren bir rezervasyon
  (23P01) telafiyi açık bırakır. "Telafi ödendi" tek koşullu yazımdır. İkisi
  aynı anda basılırsa yalnız biri kazanır (gerçek Postgres testi). IBAN
  veritabanına yazılmaz; IBAN ya da kart numarası taşıyan bir not (gruplar
  boşluk, NBSP, nokta, eğik çizgi, alt çizgi ya da tireyle ayrılmış da
  olsa, "hesap 12345678" gibi bir hesap numarası da) reddedilir, çünkü not
  10 yıl değişmeden saklanan olay kaydına girer; dekont muhasebede durur.
  Havale notu rezervasyon sayfasının geçmişinde yalnız iade yetkisi olana
  görünür (onay kaydının IP'si gibi). POS iadeyi reddederse telafi geri
  alınma yazımının kendisinde silinir (ayrı bir yazım yok). Ücretsiz
  saat son günden sonra verilmez; para seçeneğinin son günü yoktur. Telafi
  saati başlamadan iptal edilirse telafi yeniden açılır (saatin iptali ve
  telafinin açılması da tek ifade, `karaoke_release_make_good_hour`); saat
  başladıktan sonra iptal edilirse açılmaz. Telafi saatini misafirin kendi
  iptalinin artık kabul edilmediği süre içinde yalnız iade yetkisi olan
  kişi iptal edebilir (inceleme A2: Personel'in iptali kullanılmış telafiyi
  yeniden açardı; panel bu iptali gerekçesiyle kapalı çizer); hesap
  kapanışı da saatin kendi kuralına bağlıdır (inceleme A4), o süre içinde
  saat durur ve köşke telafi saati olarak bildirilir. Başlamadan iptal
  edilen telafi saatinin iptal e-postası yeniden açılan telafinin tutarını
  ve son gününü yazar (inceleme R4). Her adım denetim
  kaydında (`make_good_hour_given`, `make_good_hour`, `make_good_paid`,
  `make_good_reopened`).
- **KDV.** Telafi saatinin sayfası "Emsal bedel ₺X (saatlik ücret ₺Y x N
  saat, KDV %20 dahil), KDV köşkçe beyan edilir. Misafirden para alınmaz."
  der; faturalanacak tutar satırı bu saatte çıkmaz.
- **Yeniden satış iadesi.** Rezervasyon onaylandığında (ödemesiyle ya da
  köşkte ödenecekse personelin onayıyla; telafi saati satış sayılmaz, 0 TL'ye
  ayrılan saat de: %100 ORO indirimiyle köşk o saatten para almadı, mahsup
  edilecek bir yarar yok, TBK m.325/2 kıyasen; orkestratör kararı, operatörün
  yetki devriyle, 21 Ekim 2026) aynı
  gündeki, saatleri çakışan, iptal edilmiş ve geç iptalde pay tutulmuş
  rezervasyonlar için her saat, o saati en son geç iptal etmiş
  rezervasyona bir kez sayılır (`resoldHours`). Hesap satırın kilidi
  altında SQL'de (`karaoke_charge_resold_hours`, kural 20): aynı saat iki
  kez bildirilse ya da iki ödeme aynı anda gelse de bir kez sayılır.
  Yuvarlama: iade = round(tutulan pay x sayılan saat / saat), her seferinde
  toplam olarak hesaplanır ve yarım kuruş yukarı yuvarlanır; böylece
  parçaların toplamı tutulan paya tam eşittir ve onu hiç aşmaz (ör. 3
  saatte 1.001 kuruş: 334, 333, 334). Satıştan hemen sonra, misafirin onay
  e-postasından önce hesaplanır. Rezervasyon `refunding` olur, ekibe "Geç
  iptal edilen saat yeniden satıldı" e-postası gider, personel tutarı
  PayNkolay panelinden iade edip "Elle iade edildi" ile kaydeder. Daha önce
  elle iade edilen kısım `refundSettledMinor`'da durur ve yeniden
  istenmez. "Elle iade edildi" penceresinin gösterdiği tutarı gönderir ve
  kayıt yalnız o tutarla yapılır: sayfa açıldıktan sonra bir saat daha
  satıldıysa kayıt reddedilir ("tutar değişti, sayfayı yenile") ve büyüyen
  tutar borç olarak kalır; tutarı göndermeyen basış da kaydedilmez. Her
  elle iade kendi tutarı ve anıyla ayrı bir adım olarak tutulur
  (`refundSteps`): Gün sonu her adımı kendi gününde yazar, sonraki bir
  satış önceki günün iadesini silmez. POS'a otomatik kısmi iade gönderilmez
  (docs/PAYNKOLAY.md §3.2). Raporlar daha önce iade edileni iadesi bekleyen
  saymaz.
- **%1-99 açıldı (D-KAR-1-99).** Panel 0-100 arası tam sayıyı kabul eder;
  24 saatten uzun pencerede en az %50 sınırı ve %0'da en çok 24 saat sınırı
  kalır. Canlıda kural hâlâ 2 saat / %0: uygulama kilidi
  (`KARAOKE_POLICY_APP_VERSION` null) açılmadıkça başka kural kaydedilmez.

### 26.4 Bilerek değişmeyenler

- Ödeme Koşulları ve Hesap Silme'deki karaoke "2 saat" ve "kısmi iade
  yapılmaz" cümleleri: her rezervasyon 2 saat / %0 ile yapıldığı sürece
  doğru; uygulama kilidi açılmadan önce yeniden yazılır
  (`tests/karaoke-cancel-policy-doc.test.ts`). Ödeme Koşulları'nda bu PR
  yalnız §14'ün banka hesabına transfer paragrafını değiştirdi (26.2).
- Karaoke §7: yeniden satış iadesini zaten vaat ediyordu ("iptal ettiğiniz
  saat başka bir misafire satılırsa o saat için sizde kalan tutar da iade
  edilir"); kod şimdi bunu yapıyor.

### 26.5 Hukuki dayanak

| Konu | Dayanak | Karar |
|---|---|---|
| Geç işletme iptalinde telafi | Tüketici Sözleşmelerindeki Haksız Şartlar Hakkında Yönetmelik m.5/1, EK-1 (ç) (RG 17.06.2014, 29033); 6502 s. TKHK m.6/2 | Misafirin geç vazgeçmesi saatin bedeline mal oluyorsa, köşkün aynı geç vazgeçmesi de misafire benzer bir tazminat verir; yalnız aynî karşılık (saat) kullanamayan misafire boş kalacağı için para seçeneği de var. |
| Mücbir sebep dışarıda | 6098 s. TBK m.136/1-2 | Borçlunun sorumlu tutulamayacağı imkânsızlıkta borç sona erer ve yalnız alınan edim geri verilir; doğal afet, resmî makam kararı, bölgesel elektrik ya da su kesintisinde tam iade var, telafi yok. |
| 6 ay | 6098 s. TBK m.92/3 | Ay olarak belirlenen süre son ayın karşılık gelen gününde, o gün yoksa ayın son gününde dolar; telafi saatinin son günü böyle hesaplanır. |
| Telafi saatinin KDV'si | 3065 s. KDV Kanunu m.5, m.27/1 | Vergiye tabi bir hizmetten karşılıksız yararlandırma hizmet sayılır, matrah emsal bedeldir: panel saatlik ücret x saati gösterir, köşk beyan eder. Para olarak ödenen telafi bir teslimin ya da hizmetin bedeli değil, sözleşmeden doğan bir tazminattır; KDV'nin konusuna girmez (KDV K. m.1/1). İkisi de mali müşavirle teyit edilir (26.6). |
| Yeniden satılan saatin payı | 6098 s. TBK m.325/2 (kıyasen); Haksız Şartlar Yön. EK-1 (d) | Başka biçimde kullanmakla elde edilen yarar bedelden indirilir: geç iptal edilip yeniden satılan saat için tutulan pay iade edilir; her saat bir kez. |
| Kısmi iade 14 gün | Mesafeli Sözleşmeler Yönetmeliği m.16/4 (kıyasen), TKHK m.4/2 | Tam iade iptalle POS'tan başlar; elle yapılan kısmi iade en geç 14 günde karta; ön bilgi cümlesi bunu yazar. |
| Banka hesap bilgisi | 6698 s. KVKK m.4/2-ç, m.5/2-c, m.10; Aydınlatma Yükümlülüğü Tebliği m.4 | Telafi ödemesi için bildirilen hesap bilgisi aydınlatma metninde ve gizlilik politikasında adıyla geçer, yalnız bu ödeme için kullanılır, rezervasyon kaydına ve olay kaydına yazılmaz; saklama süresi iade için bildirilen hesap bilgisiyle aynı satırda. |

### 26.6 Operatöre

- Telafi saati verdiğin ay o saati emsal bedeli üzerinden %20 KDV ile
  beyannameye al (KDV K. m.5, m.27/1); para olarak ödenen telafiyi KDV'siz
  tazminat olarak havale dekontuyla kaydet. İkisini mali müşavirle teyit et.
- Telafi ödemesinde misafirin IBAN'ı yalnız e-postada ve dekontta kalır;
  panele, nota ya da başka bir dosyaya yazma.
- Kuralı sunucudan okuyan uygulama sürümü (lafmobil 1.1.0) iki mağazada
  yayınlanınca: önce Ayarlar > Mobil uygulama'da en düşük desteklenen
  sürümü yükselt, sonra `KARAOKE_POLICY_APP_VERSION`'ı o sürüme yazan PR'ı
  aç (Ödeme Koşulları ve Hesap Silme cümleleri aynı PR'da). O güne kadar
  %1-99 kaydedilemez.

## 27. Y13 - Karaoke verisinin saklama süresi, imha kaydı, ticari yazışma (21 Ekim 2026)

> **Durum: kodda değişti.** Dal `feat/legal-retention-and-till`. Operatör
> kararı (18 Ekim 2026): avukat ve mali müşavir turu yok, karar birincil
> kaynaklarla verildi (ASK-RETENTION, OP-RETENTION-APPLY, D-CORRESPONDENCE).
> `LEGAL_UPDATED` ve `KARAOKE_LEGAL_UPDATED` değişmedi; yalnız Veri Saklama ve
> İmha Politikası kendi tarihini taşır (§27.4).

### 27.1 Neden

- Veri Saklama §8'in karaoke satırı üye olmadan yapılan rezervasyonun ad,
  soyad, e-posta ve telefonu için "kendiliğinden silme veya anonimleştirme
  süresi henüz belirlenmemiştir" diyordu; onay kaydı satırı "kendiliğinden
  işleyen bir silme düzeni henüz tanımlı değildir" diyordu. Veri yalnız
  amacın gerektirdiği süre tutulur ve sebep bitince silinir (X-KAR-RETENTION).
- Periyodik imha yalnız rapor üretiyordu ve bir imha çalıştırması iz
  bırakmıyordu (X-RETENTION-APPLY).
- İletişim satırı her yazışmaya üç yıl veriyordu; sipariş, iade, rezervasyon,
  fatura ve ödeme yazışması ticari mektuptur ve on yıl saklanır
  (D-CORRESPONDENCE). Etkinlik ve atölye kaydı için satır yoktu
  (X-EVENT-PROOF).

### 27.2 Değişen cümleler (Veri Saklama ve İmha Politikası §8, tablo)

| Satır | Mevcut | Yeni |
|---|---|---|
| Karaoke rezervasyon kayıtları (değer) | Üyelik ilişkisi süresince saklanır. Üyelik hesabı kapatıldığında ileri tarihli rezervasyonlar iptal edilir; ödenmiş rezervasyonların iadesi Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'nin 10. maddesine göre yapılır; kayıtlarda ad silinir ve üyelik e-posta adresi kimliği belirlenemeyen benzersiz bir yer tutucuyla değiştirilir. Rezervasyon formunda ayrıca iletişim için yazılmış e-posta adresi ve telefon numarası hesap kapatma işlemiyle kendiliğinden silinmez; bu bilgiler ilgili kişinin talebi üzerine 16. bölüm uyarınca silinir. Üye olmadan yapılan rezervasyonlarda ad, soyad, e-posta adresi ve telefon numarası yalnızca rezervasyon kaydında tutulur; bu kayıtlar için kendiliğinden silme veya anonimleştirme süresi henüz belirlenmemiştir ve bu bilgiler ilgili kişinin talebi üzerine, ödeme ve onay kaydına ilişkin yasal saklama yükümlülükleri saklı kalmak kaydıyla 16. bölüm uyarınca değerlendirilir. | Üyelik ilişkisi süresince saklanır. Üyelik hesabı kapatıldığında ileri tarihli rezervasyonlar iptal edilir; ödenmiş rezervasyonların iadesi Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi'nin 10. maddesine göre yapılır; kayıtlarda ad silinir ve üyelik e-posta adresi kimliği belirlenemeyen benzersiz bir yer tutucuyla değiştirilir. Rezervasyon formunda ayrıca iletişim için yazılmış e-posta adresi ve telefon numarası hesap kapatma işlemiyle kendiliğinden silinmez; bu bilgiler ilgili kişinin talebi üzerine 16. bölüm uyarınca, en geç ise bu satırda belirtilen sürenin sonunda silinir. Üye olmadan yapılan rezervasyonlarda ad, soyad, e-posta adresi ve telefon numarası yalnızca rezervasyon kaydında tutulur; bu bilgiler ile tüm rezervasyonlarda iletişim için yazılan e-posta adresi, telefon numarası ve not, rezervasyon tarihinden itibaren 3 yıl sonra, takip eden ilk periyodik imha döneminde silinir. Rezervasyonun kodu, tarihi, saati, süresi, kişi sayısı, tutarı ile ödeme ve iade kayıtları ödeme işlem kayıtlarının saklama süresince (10 yıl) tutulur ve bu sürenin sonunda rezervasyon kaydı tümüyle silinir. Hakkında uyuşmazlık bulunan kayıt, uyuşmazlık kesin olarak sonuçlanana kadar saklanır. |
| Karaoke odası onay kaydı (değer) | Rezervasyon kaydında tutulur ve Mesafeli Sözleşmeler Yönetmeliği m.20 uyarınca en az 3 yıl saklanır; bu kayıt için kendiliğinden işleyen bir silme düzeni henüz tanımlı değildir. Uyuşmazlık hâlinde uyuşmazlığın kesin olarak sonuçlanmasına kadar saklanır. | Rezervasyon kaydında tutulur ve Mesafeli Sözleşmeler Yönetmeliği m.20 uyarınca en az 3 yıl saklanır. Onay kaydındaki IP adresi ve tarayıcı veya uygulama bilgisi rezervasyon tarihinden itibaren 3 yıl sonra, takip eden ilk periyodik imha döneminde silinir; onayın tarihi, onaylanan belgeler ve sürümleri rezervasyon kaydıyla birlikte kalır. Uyuşmazlık hâlinde uyuşmazlığın kesin olarak sonuçlanmasına kadar saklanır. |
| Etkinlik ve atölye kayıtları (kayıt yaptıranın adı ve iletişim bilgisi, katılımcı sayısı, ödeme bilgisi, ön bilgilendirme ve onay yazışması) (yeni satır, karaoke onay kaydı satırının ardından) | (yoktu) | Kayıt ve onay yazışmaları ticari yazışma olarak, yazışmanın yapıldığı takvim yılının bitiminden itibaren 10 yıl saklanır (6102 sayılı Türk Ticaret Kanunu m.82) ve takip eden ilk periyodik imha döneminde silinir. Alerjen ve diyet bilgisi yazılı olarak istenmez; telefonla veya girişte bildirildiğinde ad yazılmadan katılımcı sırasıyla not alınır ve not etkinlik bitince imha edilir. |
| İletişim, talep ve şikâyet kayıtları (e-posta yazışmaları, telefon notları, sosyal medya mesajları) (değer) | Talebin sonuçlandırılmasından itibaren 3 yıl; talebin bir sipariş uyuşmazlığına konu olması hâlinde ilgili sipariş kaydının saklama süresine tabidir. | Bir sipariş, iade, rezervasyon, fatura veya ödemeyle ilgili e-posta ve yazılı mesajlar ticari yazışma olarak, yazışmanın yapıldığı takvim yılının bitiminden itibaren 10 yıl saklanır (6102 sayılı Türk Ticaret Kanunu m.82) ve takip eden ilk periyodik imha döneminde silinir. Bir işlemle ilgisi olmayan genel soru ve mesajlar ile telefon notları talebin sonuçlandırılmasından itibaren 3 yıl saklanır; talep bir uyuşmazlığa konu olursa uyuşmazlık kesin olarak sonuçlanana kadar saklanır. |
| İmha (silme, yok etme, anonimleştirme) kayıtları (değer, son cümle; inceleme R1) | Kayıt, yetkili personelin yürüttüğü imhalar için tutulur; sistem tarafından otomatik yürütülen imhalar için ayrı bir kayıt oluşturulmaz. | Yetkili personelin yürüttüğü imhalar için imha kaydı tutulur. Sistem tarafından otomatik yürütülen her periyodik imha çalışması da, kişisel veri içermeyen bir kayıt olarak değiştirilemez olay kaydına yazılır ve 10 yıl saklanır; bu kayıt çalışmanın tarih ve saatini, her kural için veri kategorisini, saklama süresi sınırını, eşleşen ve imha edilen kayıt sayısını gösterir. |
| §17, 1. paragraf, 2. cümle (inceleme R1) | Saklama süresi dolan kayıtların otomatik görevle silinmesi ve üyenin kendi hesabını kapatması gibi sistem tarafından yürütülen işlemler için ayrı bir imha kaydı oluşturulmaz; bu işlemlerin kapsamı ve süreleri bu Politikada ve Hesap Silme belgesinde yazılıdır. | Saklama süresi dolan kayıtların otomatik görevle silinmesi veya alanlarının boşaltılması da kayıt altına alınır: uygulanan her periyodik imha çalışması için sistem, çalışmanın tarih ve saatini, her kuralın veri kategorisini ve saklama süresi sınırını, eşleşen ve imha edilen kayıt sayısını içeren, kişisel veri taşımayan bir kaydı değiştirilemez olay kaydına yazar; bu kayıt on yıl saklanır. Üyenin kendi hesabını kapatması için ayrı bir imha kaydı oluşturulmaz; bu işlemin kapsamı ve süreleri bu Politikada ve Hesap Silme belgesinde yazılıdır. |
| §17, ilk madde (sonuna eklendi; inceleme R1) | İmha kaydında yer alan asgari bilgiler: işlem tarihi ve saati, veri kategorisi, kayıt sayısı, imha gerekçesi, uygulanan yöntem, işlemi gerçekleştiren kişi ve onaylayan kişi. | (aynı cümle, ardından) Otomatik imhalarda işlemi gerçekleştiren sistemdir; imha gerekçesi (saklama süresinin dolması) ve yöntem (silme veya alanların boşaltılması) ilgili kuralın bu Politikadaki tanımından anlaşılır, onay ise dönem raporunun onaylanmasıyla verilir. |

### 27.3 Kod

- `db/migrations/20261021090000_karaoke_guest_retention.sql`:
  `karaoke_reservations."retentionHold"` (boşsa imha engellenmez) ve iki
  fonksiyon. `karaoke_guest_retention` misafirin adını ve adresini
  (`anon-<id>@anon.local`), her rezervasyonun iletişim adresini, telefonunu,
  notunu ve onaydaki `ip` ile `userAgent`'ı temizler; satırı silmez.
  `karaoke_reservation_retention` satırı siler. Süzgeç: `date <
  left(p_cutoff, 10)` (silmede rezervasyon günü, `paidAt` ve `refundedAt`'in
  en geç olanı; inceleme M2), `"paymentStatus"` `pending` ya da `refunding`
  değil, panelin hâlâ borçlu saydığı rezervasyon değil (ödenmiş ve iptal
  edilmiş ya da onaylanmamış; M1), `payment_transactions`'ta cevabı gelmemiş
  `refunding` iade talebi yok (M3), `"retentionHold" = ''`. Gün olmayan ya da
  bir yıldan yakın bir sınır hata verir (R5). Temizlenmiş satır ikinci kez
  sayılmaz.
- `src/lib/retention.ts`: `karaoke-guest-data` (3 × 366 gün) ve
  `karaoke-reservations` (11 × 366 gün) kuralları; `basis` cümleleri yukarıdaki
  yeni karaoke satırından birebir (`tests/mobile-retention.test.ts`). Sınır
  köşkün saatiyle yazılır (CLAUDE.md kural 22).
- İmha kaydı: uygulanan her çalıştırma `audit_logs`'a tek satır yazar (actor
  `system`, action `bulk_delete`, entity `retention`, kayıt no çalıştırmanın
  anı, kural başına yöntem (`delete` silindi, `clear` alanlar boşaltıldı) ve
  sayılar); rapor modu hiçbir şey yazmaz. Olay kaydında "Periyodik
  imha" olarak görünür. Ayrıntı `docs/DATABASE.md` "Periyodik imha".

### 27.4 Sürüm

- Veri Saklama ve İmha Politikası kendi tarihini taşır: **21 Ekim 2026**
  (`updatedAt`, `src/lib/legal/content.ts`). 20 Ekim 2026 setin günü olarak
  #180 ile kullanıldı; bu PR 21 Ekim'de ya da sonra birleşir, daha geç
  birleşirse tarih o güne çekilir.
- `LEGAL_UPDATED` ve `KARAOKE_LEGAL_UPDATED` değişmez: ödeme ve karaoke
  onayında gösterilen belgeler değişmedi.

### 27.5 Operatöre

- **İmhayı açmak (OP-18).** Önce rapor: `curl -s -H "Authorization: Bearer
  $CRON_SECRET" https://laffogato.net/api/cron/retention`. Sayıları oku
  (`karaoke-guest-data` ve `karaoke-reservations` bugün 0 olmalı: ilk
  rezervasyonlar 2026'da). Sonra Production'da `RETENTION_APPLY=destroy`,
  redeploy, bir kez daha çağır; yanıt `"applied": true` ve `"recorded": true`
  demeli, Olay kaydında "Periyodik imha" satırı görünmeli. İlk imha
  raporunun JSON'u KVKK klasörüne.
- **Hukuki saklama.** Uyuşmazlık, şikâyet ya da resmî talep olan karaoke
  rezervasyonunda `"retentionHold"` nedeniyle doldurulur, iş bitince
  boşaltılır (SQL `docs/DATABASE.md`'de).
- **Etkinlik ve atölye.** Kayıt ve onay e-postaları kurumsal kutuda on yıl
  kalır; alerjen ve diyet bilgisi yazılı istenmez, girişte ad yazmadan sırayla
  not alınır ve not etkinlik bitince yok edilir.
- **Yazışma.** Sipariş, iade, rezervasyon, fatura ve ödeme yazışmaları kutuda
  yazıldığı yılın sonundan itibaren on yıl kalır; işlemle ilgisiz mesajlar ve
  telefon notları üç yıl. Şüphede on yıl.
- **Uygulama.** lafmobil'in çevrimdışı kopyası `legal:export` ile (ayrı PR).

### 27.6 Bilerek değişmeyenler

- Gizlilik Politikası ("Talep, şikâyet ve iade yazışmaları"), KVKK Aydınlatma
  ("Müşteri hizmetleri yazışmaları ve şikâyet kayıtları") ve Hesap Silme
  ("Tüketici başvuru ve uyuşmazlık yazışmaları") özet satırları "zamanaşımı
  süresi boyunca" diyor; Veri Saklama tablosu bunu artık açar, çelişki yok.
- Hesap Silme'nin karaoke maddesi iletişim bilgisinin ve notun hesap
  kapatmada "kayıtta kaldığını" söyler; Veri Saklama artık en geç üç yılda
  silindiğini söyler. İkisi birlikte doğrudur.
- `payment_transactions`'taki karaoke ödeme satırları için ayrı bir imha
  kuralı yok (on yıllık asgari süre; en erken 2036'da gerekir).

### 27.7 Hukuki dayanak

| Konu | Dayanak | Karar |
|---|---|---|
| Süre ve imha | 6698 s. KVKK m.4/2-d (amaç için gerekli süre kadar muhafaza), m.7/1 (sebep kalkınca resen silme) | Misafirin kimliği, her rezervasyonun iletişim bilgisi ve onayın IP ile tarayıcı bilgisi rezervasyon tarihinden 3 yıl sonra; rezervasyon kaydı 11 yıl sonra. |
| Periyodik imha | Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik (RG 28.10.2017-30224) m.11/1-2 (ilk periyodik imhada, aralık altı ayı geçemez) | Süre dolduktan sonraki ilk periyodik imhada; iş her gün koşar. |
| İmha kaydı | Aynı yönetmelik m.7/3 (tüm işlemler kayıt altına alınır, kayıtlar en az üç yıl saklanır) | Her uygulanan çalıştırma `audit_logs`'a veri içermeyen tek satır; olay kaydı on yıl, append-only. |
| Onay kaydı | Mesafeli Sözleşmeler Yönetmeliği (RG 27.11.2014-29188) m.20/1 (bilgi ve belgeler üç yıl saklanır) | Onay kaydının kendisi (an, belgeler, sürüm) rezervasyonla kalır; IP ve tarayıcı bilgisi üç yıl sonra çıkar. |
| Ödeme kaydı ve ticari yazışma | 6102 s. TTK m.82/1-b,c (alınan ve gönderilen ticari mektuplar), m.82/5 (on yıl), m.82/6 (süre takvim yılının bitişiyle başlar) | Rezervasyon kaydı 11 × 366 günde silinir: yıl sonundan başlayan on yılı her durumda kapsar. İşlemle ilgili yazışma on yıl, ilgisiz mesaj üç yıl. |
| Hukuki saklama | KVKK m.5/2-e (bir hakkın tesisi, kullanılması veya korunması için zorunlu olması) | Uyuşmazlık, şikâyet ya da resmî talep olan kayıt `"retentionHold"` ile imhadan çıkar. |

## 28. Y14 - Kasada damga yalnız üyenin kendi kasa koduyla (21 Ekim 2026)

> **Durum: kodda değişti.** Dal `feat/legal-retention-and-till`. Operatör
> kararı (18 Ekim 2026): avukat turu yok (ASK-LOYALTY). `LEGAL_UPDATED`
> değişmedi; değişen altı belge kendi tarihini taşır (§28.4).

### 28.1 Neden

- Kasada damga, üyenin uygulamasındaki kasa kodu (QR ya da 8 karakter)
  okunamazsa kasiyerin elle yazdığı üyelik e-posta adresiyle de veriliyordu;
  üyenin müşteri sayfasında da yönetici gerekçesiz "+1 damga" verebiliyordu.
  Elle yazılan e-posta, üyenin kendisini göstermediği bir tanımlamadır
  (X-LOYALTY). Karar: kasada damga yalnız üyenin kendi koduyla; e-posta yolu
  kalkar; müşteri sayfasında yalnız gerekçeli yönetici düzeltmesi kalır.
- Metinler e-posta yolunu yedi yerde anlatıyordu. Spec Gizlilik ve KVKK
  metinlerindeki beş yeri satır numarasıyla verdi (eski numaralar 4959, 4989,
  5397, 5966, 6018); aynı yolu anlatan Gizlilik §5 amaç satırı, Üyelik
  Sözleşmesi §10, Sadakat Programı Kuralları §2, §7 ve §20, Mobil Uygulama
  Koşulları §11 ve Kafe Hizmet Koşulları §10 da aynı karara göre düzeltildi:
  aksi hâlde sözleşmeler kasanın artık reddettiği bir yolu vaat ederdi.

### 28.2 Değişen cümleler

Spec cümleleri birebir uygulandı; spec'te olmayan yerlerde aynı cümleler
belgenin kendi diliyle (Üye, Katılımcı) kullanıldı.

| Yer | Mevcut | Yeni |
|---|---|---|
| Gizlilik §3, tablo "Sadakat (damga) programı verisi" (son cümle; spec 4959) | Kasada damga eklenirken yetkili personele adınız, maskelenmiş e-posta adresiniz (adres personel tarafından elle yazılmışsa tam adres) ve kart durumunuz gösterilir. | Kasada damga eklenirken yetkili personele adınız, maskelenmiş e-posta adresiniz ve kart durumunuz gösterilir. |
| Gizlilik §4, "Kafe ziyareti" (spec 4989) | ... kasada personelin uygulamanızdaki kasa kodunu okutarak ya da elle girerek veya üyelik e-posta adresinizi girerek eklediği damga kayıtları ve güvenlik kamerası görüntüleri. | ... kasada personelin uygulamanızdaki kasa kodunu okutarak ya da elle girerek eklediği damga kayıtları ve güvenlik kamerası görüntüleri. |
| Gizlilik §5, amaç tablosu anahtarı (spec'te yok) | Kafede kasa kodu okutularak veya üyelik e-posta adresi girilerek damga eklenmesi ile damga ve kuponların kötüye kullanımının önlenmesi | Kafede kasa kodu okutularak ya da girilerek damga eklenmesi ile damga ve kuponların kötüye kullanımının önlenmesi |
| Gizlilik §15, 1. paragraf (spec 5397) | ... Kasa kodunu personel kasadaki cihazla veya kasa yetkisi verilmiş kendi uygulamasıyla okutur ya da kodu elle girer; kod okunamazsa damga kasada üyelik e-posta adresiniz girilerek de eklenebilir. Bu sırada yetkili personele adınız, maskelenmiş e-posta adresiniz (adres personel tarafından elle yazılmışsa tam adres) ve kart durumunuz gösterilir; damgayı ekleyen personelin hesabı kayda geçer. ... | ... Kasa kodunu personel kasadaki cihazla veya kasa yetkisi verilmiş kendi uygulamasıyla okutur ya da kodu elle girer. Kasada damga yalnızca uygulamanızın gösterdiği kasa koduyla eklenir; kod okunamazsa personel kodun 8 karakterini elle girer, e-posta adresinizle damga eklenmez. Kasada eksik işlenen bir damga, üyelik e-posta adresinizden ilettiğiniz talep üzerine yetkili yönetici tarafından düzeltilebilir; düzeltme damga hareketlerinize kayıt olarak işlenir ve talebiniz üzerine iletilen tarihli dökümde yer alır. Kasada damga eklenirken yetkili personele adınız, maskelenmiş e-posta adresiniz ve kart durumunuz gösterilir; damgayı ekleyen personelin hesabı kayda geçer. ... |
| KVKK Aydınlatma §10, "Sadakat programı kanalları" (spec 5966) | ... kafede kasada, uygulamanın gösterdiği kasa kodu okutularak ya da girilerek veya üyelik e-posta adresi girilerek eklenen damga kayıtları. | ... kafede kasada, uygulamanın gösterdiği kasa kodu okutularak ya da girilerek eklenen damga kayıtları. |
| KVKK Aydınlatma §13, "Kasada damga" (spec 6018) | Kod okunamazsa damga, üyelik e-posta adresiniz girilerek de eklenebilir. | Kod okunamazsa personel kodun 8 karakterini elle girer; e-posta adresinizle damga eklenmez. |
| Üyelik Sözleşmesi §10, 2. paragraf (spec'te yok) | ... personele gösterir, personel kodu okur veya elle girer; kod okunamazsa damga Üye'nin üyelik e-posta adresi girilerek de eklenebilir. ... | ... personele gösterir, personel kodu okur ya da kod okunamazsa kodun 8 karakterini elle girer; Üye'nin e-posta adresiyle damga eklenmez. Kasada eksik işlenen bir damga, Üye'nin üyelik e-posta adresinden ilettiği talep üzerine yetkili yönetici tarafından düzeltilebilir; düzeltme damga hareketlerine kayıt olarak işlenir ve Üye'nin talebi üzerine iletilen tarihli dökümde yer alır. ... |
| Sadakat Programı Kuralları §2, tanım "Kasa Damgası" (spec'te yok) | Kafede personel tarafından, Katılımcı'nın kasa kodu okunarak veya üyelik e-posta adresi girilerek hesaba eklenen damga | Kafede personel tarafından, Katılımcı'nın kasa kodu okunarak ya da elle girilerek hesaba eklenen damga |
| Sadakat Programı Kuralları §7, 1. paragraf (spec'te yok) | Kod okunamazsa damga, Katılımcı'nın üyelik e-posta adresi girilerek de eklenebilir. | Kod okunamazsa personel kodun 8 karakterini elle girer; Katılımcı'nın e-posta adresiyle damga eklenmez. |
| Sadakat Programı Kuralları §14, yeni 3. paragraf, geri almanın iki paragrafından sonra (spec'te yok) | (yoktu) | Kasada eksik işlenen bir damga, Katılımcı'nın üyelik e-posta adresinden ilettiği talep üzerine yetkili yönetici tarafından düzeltilebilir; düzeltme Damga Defteri'ne yazılır. |
| Sadakat Programı Kuralları §20, 1. paragraf (spec'te yok) | ... maskelenmiş e-posta adresi ve kart durumu gösterilir (e-posta ile ekleme yolunda personel adresi kendisi yazar); damgayı ekleyen personelin hesabı kayda geçer. | ... maskelenmiş e-posta adresi ve kart durumu gösterilir; damgayı ekleyen personelin hesabı kayda geçer. |
| Mobil Uygulama Koşulları §11 (spec'te yok) | ... personele gösterilir; personel kodu okutur veya elle girer, kod okunamazsa Üye'nin e-posta adresini seçerek de damga ekleyebilir. | ... personele gösterilir; personel kodu okutur ya da kod okunamazsa kodun 8 karakterini elle girer; Üye'nin e-posta adresiyle damga eklenmez. |
| Kafe Hizmet Koşulları §10 (spec'te yok) | ... personel kendi cihazıyla okur veya girer; kod okunamazsa damga üyelik e-posta adresiniz seçilerek de eklenebilir. ... | ... personel kendi cihazıyla okur ya da kod okunamazsa kodun 8 karakterini elle girer; e-posta adresinizle damga eklenmez. ... |
| Kafe Hizmet Koşulları §10 (spec'te yok) | Kasada damga eklenebilmesi için üyeliğinizin doğrulanması gerekir; doğrulama, uygulamada gösterdiğiniz kasa kodu veya üyelik e-posta adresiniz üzerinden yapılır. | Kasada damga eklenebilmesi için üyeliğinizin doğrulanması gerekir; doğrulama yalnızca uygulamada gösterdiğiniz kasa koduyla yapılır. Kasada eksik işlenen bir damga, üyelik e-posta adresinizden ilettiğiniz talep üzerine yetkili yönetici tarafından düzeltilebilir; düzeltme damga hareketlerinize kayıt olarak işlenir ve talebiniz üzerine iletilen tarihli dökümde yer alır. |

Gizlilik §15'te spec cümlesi bir cümle başladığı için önündeki "; " ". "
oldu; aradaki düzeltme cümlesinden sonra "Bu sırada" belirsiz kalacağından
"Kasada damga eklenirken" yazıldı (aynı belgenin §3'teki ifadesi).

İnceleme R3: spec'in "düzeltme damga hareketlerinizde görünür" ifadesi üyeye
açık bir damga hareketi ekranı vaat ediyordu; böyle bir ekran yok, üye tarihli
dökümü talep üzerine alır (Sadakat Programı §14, §21). Bu yüzden Gizlilik ve
Kafe Hizmet'te "düzeltme damga hareketlerinize kayıt olarak işlenir ve
talebiniz üzerine iletilen tarihli dökümde yer alır.", Üyelik'te aynı anlam
üçüncü kişiyle, Sadakat §14'te "düzeltme Damga Defteri'ne yazılır." yazıldı.

### 28.3 Kod

- Kasa (`/admin/kasa`): "E-posta ile" sekmesi kalktı; kod sekmesinin altında
  "QR okunmuyorsa üyeden kodun altındaki 8 karakteri söylemesini iste.";
  sayfanın açıklaması "E-postayla damga verilmez." der. Eylem (`KINDS =
  ['token', 'code']`) `kind: "email"`'i "E-postayla damga verilmiyor. Üyeden
  uygulamadaki kasa kodunu (QR ya da 8 karakterlik kod) göstermesini iste."
  ile reddeder; üye araması ve tekrar penceresi kalktı.
- `redeemCounterToken` `email`'i `email_refused` ile, hiçbir şey okumadan ya da
  yazmadan reddeder; tür değeri ve `Kasa · e-posta` not öneki eski satırlar
  için kalır. `not_found`: "Kod bulunamadı. Kodu kontrol et ya da üyeden yeni
  QR göstermesini iste." Uygulamanın `POST /staff/stamp`'ı zaten yalnız
  `token` ve `code` alıyordu, sözleşme değişmedi.
- Müşteri sayfası: düğme "Damga düzelt (+1)", rol `customers` (sahip,
  yönetici); en az 10 karakterlik sebep zorunlu ("Düzeltme sebebini yaz:
  üyenin kendi talebi ve nasıl doğrulandığı (ör. QR okunmadı, üye kayıtlı
  e-postasından yazdı)."), defter notu `Düzeltme · ` ile başlar.

### 28.4 Sürüm

- Kendi tarihini taşıyan belgeler, **21 Ekim 2026**: Gizlilik Politikası, KVKK
  Aydınlatma Metni, Üyelik Sözleşmesi, Sadakat (Damga) Programı Kuralları,
  Mobil Uygulama Koşulları, Kafe Hizmet Koşulları (`updatedAt`,
  `src/lib/legal/content.ts`). `LEGAL_UPDATED` ve `KARAOKE_LEGAL_UPDATED`
  değişmez.
- Bildirim (inceleme R4, orkestratörün operatör yetkisiyle verdiği karar):
  kasada elle yazılan e-postayla damga yolu kaldırıldı. Bu, Üyelik Sözleşmesi
  §22 anlamında üye aleyhine esaslı bir değişiklik ve Sadakat Programı §12 ile
  §23 anlamında Katılımcı aleyhine sonuç doğuran bir değişiklik sayılmadı: her
  damga üyenin kendi koduyla alınabilir (kamera okumazsa kod elle girilir),
  kasada kaçan damga üyenin kendi kayıtlı e-postasından ilettiği talep üzerine
  düzeltilir, damga değeri, ödül ve eşikler değişmez. Değişiklik ayrıca
  mevzuata uyum içindir (KVKK m.12/1), Üyelik §22 bunu on beş günlük süreden
  ayırır. On beş günlük bekleme uygulanmadı; değişiklik yayın günü
  uygulamada duyurulur ve üyelere kısa bir bilgilendirme e-postası gider
  (§28.5).

### 28.5 Operatöre

- **Kasa ekibi.** Bu PR yayına girdiği gün: e-postayla damga yok. QR
  okunmuyorsa üye kodun altındaki 8 karakteri söyler, kasiyer "Kodu yaz"
  sekmesine girer. Telefonu çalışmayan üyeye "uygulamadan ya da kayıtlı
  e-postanızdan bize yazın, yönetici ekler" denir.
- **Yönetici.** Eksik damga: üyenin müşteri sayfası, "Damga düzelt (+1)", sebep
  (kimin istediği ve nasıl doğrulandığı). Talep üyenin kayıtlı adresinden
  gelmeli.
- **Duyuru ve e-posta (yayın günü).** Uygulama duyurusu: "Kasada damga
  artık yalnızca uygulamandaki kasa koduyla (QR ya da 8 karakter) eklenir."
  Üyelere kısa bilgilendirme e-postası (işlemsel bilgilendirme, ticari ileti
  değildir): "Kasada damga artık yalnızca uygulamandaki kasa koduyla (QR ya
  da altındaki 8 karakter) eklenir; e-posta adresinle damga eklenmez. Kasada
  bir damgan eksik kaldıysa kayıtlı e-posta adresinden bize yaz, yönetici
  düzeltsin. Damga sayın, ödüllerin ve eşikler değişmedi."
- **Uygulama.** lafmobil'in çevrimdışı kopyası `legal:export` ile; ayrıca
  `docs/API-MOBILE.md` §17 "Kasa tarafı" ve §21 `kind` satırı değişti
  (lafmobil kopyası ve `RECONCILED`).

### 28.6 Bilerek değişmeyenler

- Uygulamanın `POST /staff/stamp` uçu ve iletileri (`not_found` için
  uygulamanın kendi cümlesi "Kod bulunamadı. Üyeden kartını yeniden açmasını
  iste.") aynen kalır.
- Sadakat Programı §21'deki "eksik damga elle tanımlanır" cümlesi zaten
  düzeltmeyi anlatır.
- Eski olay kaydı satırlarındaki `kind: "email"` ve eski defter satırlarının
  `Kasa · e-posta` notu silinmez; o günün kaydıdır.

### 28.7 Hukuki dayanak

| Konu | Dayanak | Karar |
|---|---|---|
| Kasada üyenin tanımlanması | KVKK Kurul İlke Kararı 2026/266 (RG 28.02.2026; uyum 28.02.2027'ye uzadı, 2026/1491) - program kararı ASK-LOYALTY'nin dayanağı; bu PR'da kararın kendi metni doğrulanamadı (RG PDF'i taranmış görüntü) | Kasada damga yalnız üyenin uygulamasının ürettiği tek kullanımlık kodla; elle yazılan e-posta reddedilir. |
| Doğruluk ve güvenlik | 6698 s. KVKK m.4/2-b (doğru ve gerektiğinde güncel olma), m.12/1 (hukuka aykırı işlemeyi önleme, uygun güvenlik düzeyi için teknik ve idari tedbir) | Yanlış adrese yazılan damga ve üyenin bilgisi olmadan adının kullanılması önlenir; düzeltme yalnız yetkili yöneticide, gerekçesi kayıtta. |
| Sözleşme ve veri işleme şartı | KVKK m.5/2-c | Damga işlemi sözleşmenin ifası olarak sürer; değişen yalnız tanımlamanın yolu. |

## 29. Yönetici çerezleri yalnız /admin yolunda (21 Ekim 2026)

> **Durum: kodda değişti.** Dal `fix/admin-gtm-isolation` (docs/AUDIT.md
> §13). Teknik bir envanter düzeltmesi; avukat turu yok. `LEGAL_UPDATED`
> değişmedi; Çerez Politikası kendi tarihini taşır (**21 Ekim 2026**).

### 29.1 Neden

Yönetici oturum ve iki aşamalı doğrulama çerezleri bütün siteye
(`path=/`) yazılıyordu. Artık yalnız yönetici paneli adreslerine (`/admin`)
gönderilirler; tarayıcının iki kopyayı ayırabilmesi için adları da değişti
(`src/lib/admin/session-cookie.ts`). Çerez Politikası §8 envanteri çerezin
gerçek adını taşımalı.

### 29.2 Değişen satırlar

| Yer | Mevcut | Yeni |
|---|---|---|
| Çerez Politikası §8, tablo anahtarı | `laffogato_admin_session` | `laffogato_panel_session` |
| Aynı satır, "Tür" | kalıcı, HMAC ile imzalı ve httpOnly. | kalıcı, HMAC ile imzalı ve httpOnly; yalnızca yönetici paneli adreslerine (/admin) gönderilir. |
| Çerez Politikası §8, tablo anahtarı | `laffogato_admin_pending_2fa` | `laffogato_panel_2fa` |
| Aynı satır, "Tür" | kısa ömürlü, imzalı ve httpOnly. | kısa ömürlü, imzalı ve httpOnly; yalnızca yönetici paneli adreslerine (/admin) gönderilir. |

### 29.3 Operatöre

- **Uygulama.** lafmobil'in çevrimdışı kopyası `legal:export` ile güncellenir
  (yalnız Çerez Politikası değişti).
- Eski adlı çerezler, yöneticinin panele ilk girişinde silinir ve oturum yeni
  ada taşınır; kimse yeniden giriş yapmak zorunda kalmaz.

## 30. Y15 - Sipariş durumu için telefon bildirimi (push), bildirim jetonu ve "Siparişin hazır" e-postası (22 Ekim 2026)

> **Durum: kodda değişti, avukat okuması bekliyor.** Dal
> `claude/brave-cannon-ctlv3a`. Özellik kodu aynı dalda (`src/lib/push/*`,
> `POST /api/mobile/v1/devices`, `customer_devices`, `docs/API-MOBILE.md`
> §23). `LEGAL_UPDATED` **22 Ekim 2026**'ya taşındı (§30.4). Aynı gün açılan iki
> hukuk dalı (İYS, e-Arşiv) bunun ardından §31 / Y16 ve §32 / Y17 olarak gelir.

### 30.1 Neden

- Yirmi bir belgede yaklaşık elli beş cümle, uygulamanın sunucudan anlık
  bildirim (push) almadığını, bildirim jetonu oluşturmadığını ve sunucuya
  göndermediğini, Apple veya Google'ın bildirim servislerine veri
  aktarılmadığını, bildirim izninin yalnızca cihazda planlanan
  hatırlatmalar için istendiğini söylüyordu (R3 C2, §5.2: 24 Eylül 2026'da
  doğruydu). Bu dalda kod değişiyor: üye izin verirse sunucu, üyenin kendi
  siparişlerinin durumunu telefonuna anlık bildirim olarak gönderiyor. Bu
  cümleler bırakılsaydı aydınlatma, yapılan işlemenin tam tersini söylerdi.
- **KVKK m.10 ve Aydınlatma Tebliği m.5:** yeni bir veri (cihaza özgü
  bildirim jetonu ve platform), yeni bir amaç (sipariş durumu bildirimi),
  yeni alıcılar (Expo, Apple, Google) ve yeni bir saklama kuralı işleme
  başlamadan önce anlatılmalı. "İşlenmez" diyen bir aydınlatma, işlenen veri
  bakımından aydınlatma sayılmaz; mağaza gizlilik beyanlarıyla da çelişir.
- **KVKK m.9:** bildirim metni ve jeton Expo'nun anlık bildirim hizmetinden
  (650 Industries, Inc., ABD; Google Cloud üzerinde ABD'de) geçerek iOS'ta
  Apple Push Notification service (Apple Inc., ABD), Android'de Firebase
  Cloud Messaging (Google LLC, ABD) ile telefona ulaşır. Bu, diğer
  sağlayıcılar gibi sürekli bir yurt dışına aktarımdır; metinler onu aynı
  kalıpla yazar: standart sözleşmeye "dayandırılacaktır", "imza sürecinde"
  (`tests/legal-kvkk-transfers.test.ts` şimdiki zaman kipine izin vermez).
- **6563:** bildirimler yalnızca üyenin kendi siparişinin aşamasını söyler,
  kampanya veya teşvik içermez: işlemsel iletidir, ticari elektronik ileti
  değildir; onay ve İYS gerekmez, ret bağlantısı konmaz (CLAUDE.md kural 19).
  Pazarlama içerikli push yapılmaz: Açık Rıza Metni R8 "Yürütülmemektedir"
  olarak kalır, yalnız o bölümdeki olgusal cümleler düzeltildi.

### 30.2 Ne değişti (kod), metinlerin anlattığı davranış

- **Ne zaman sorulur:** uygulama bildirim iznini ilk açılışta istemez.
  Üye sipariş verdikten sonra ödeme sonucu ve sipariş takip ekranlarında
  "Siparişin hazır olunca haber verelim mi?" seçeneği çıkar; işletim
  sisteminin izin penceresi yalnızca bu seçeneğe dokunulunca açılır. Cihazda
  planlanan yerel hatırlatmalar (günlük hatırlatmalar, köşkün açılış
  bildirimi, karaoke hatırlatmaları) aynen kalır; sunucuya bir şey gitmez.
- **Ne işlenir:** izin verilirse uygulama Expo'dan cihaza özgü bildirim
  jetonunu (APNs veya FCM cihaz jetonundan türetilen Expo push token) alır
  ve oturumlu üyelik isteğiyle sunucuya bildirir. Sunucu jetonu, üyelik
  e-posta adresini, platformu (iOS / Android; isteğin istemci bilgisinden)
  ve kayıt ve son yenilenme zamanını tutar. Reklam tanımlayıcısı, konum,
  rehber yok.
- **Ne için:** yalnızca üyenin kendi siparişlerinin durumu: kafe siparişi
  hazırlanmaya başladı, gel-al siparişi tezgâhta hazır, kurye siparişi
  kuryeyle yola çıktı, mağaza kolisi kargoya verildi, ödenmiş sipariş iptal
  edildi. Ödeme onayı (e-postayla gelir), masaya getirilen sipariş ve kasada
  girilen sipariş için gönderilmez. Bildirim yalnızca sipariş numarasını ve
  aşama cümlesini taşır ("#10234 numaralı siparişin hazır, tezgâhta seni
  bekliyor."); ad, adres, telefon, ürün ve tutar yok. Expo'ya giden ileti
  ayrıca sipariş ekranının bağlantısını (sipariş kimliğiyle) taşır.
- **Denetim:** uygulamanın Bildirimler ekranındaki ve sitenin
  `/uye/hesap/bildirimler` sayfasındaki sipariş durumu tercihi
  (`orderUpdates`) bu bildirimleri kapatır; işletim sisteminin bildirim
  ayarı da durdurur. Aşamalar uygulama içindeki bildirim listesinde her
  durumda görünür.
- **Yeni işlemsel e-posta:** gel-al siparişi hazır olduğunda üyenin hiçbir
  cihazına telefon bildirimi ulaştırılamadıysa (izin yok, eski sürüm, cihaz
  yok) ve tercih kapalı değilse siparişin e-posta adresine bir kez
  "Siparişin hazır" e-postası gider. İşlemsel, ret bağlantısız.
- **Saklama:** jeton oturum kapatılınca (uygulama sunucudan silmesini
  ister), hesap kapatılınca veya silinince ve Apple / Google Expo üzerinden
  jetonun artık bir cihaza ulaşmadığını bildirince hemen; 180 gün
  yenilenmeyen jeton periyodik imhada silinir (`src/lib/retention.ts`
  `push-devices`, dayanak cümlesi Veri Saklama §9'dan birebir). Expo'dan
  okunan teslim sonuçları jetonu en fazla 24 saat tutar.
- **Köşk paneli:** barista bar ekranından bir uygulama kafe siparişini
  ilerletebilir (panel siteyi çağırır, site olay kaydına panel kullanıcısının
  adını yazar); panele giden veri değişmedi (ad ve sipariş satırları). Hiçbir
  hukuk metni sipariş durumunu kimin değiştirdiğini ya da panelin ne
  aldığını anlatmadığı için metne bir şey eklenmedi.

### 30.3 Değişen cümleler

Belgelerin kendi dili korundu (ALICI / SATICI, Üye, Kullanıcı, "siz");
yalnız gerçeğe uymayan kısım değişti. Uzun alıntılarda değişmeyen kısım
"..." ile kısaltıldı. Yeni terim "bildirim jetonu" (Veri Saklama cümlesiyle
aynı); eski "token / belirteç / gönderim adresi" sözcükleri yalnız
değişen cümlelerde kalktı.

| Belge, yer | Mevcut | Yeni |
|---|---|---|
| Ön Bilgilendirme Formu §17, cihaz izinleri paragrafı | Uygulama ALICI'dan yalnızca şu cihaz izinlerini isteyebilir: ALICI'nın uygulamada kendisinin açtığı hatırlatmaların cihazda gösterilmesi için bildirim izni; | Uygulama ALICI'dan yalnızca şu cihaz izinlerini isteyebilir: ALICI'nın uygulamada kendisinin açtığı hatırlatmaların ve sipariş verdikten sonra istemesi hâlinde kendi siparişlerinin durumuna ilişkin bildirimlerin cihazda gösterilmesi için bildirim izni; |
| Ön Bilgilendirme Formu §17, bildirimler paragrafı | Uygulama sunucudan anlık bildirim (push) almaz; uygulamanın gösterdiği hatırlatmalar, ALICI'nın uygulamada kendisinin açtığı ve cihazda planlanan hatırlatmalardır. Uygulama sunucuya anlık bildirim tokeni göndermez. Sipariş durumu uygulamanın sipariş ekranlarında gösterilir; ödeme onayı e-postası tüm siparişler için, kargo, iptal ve iade e-postaları ise yalnızca online mağaza (kargo) siparişleri için gönderilir; | Uygulamanın gösterdiği hatırlatmalar, ALICI'nın uygulamada kendisinin açtığı ve cihazda planlanan hatırlatmalardır. ALICI sipariş verdikten sonra uygulamanın sunduğu seçenekle bildirim izni verirse, SATICI sunucusundan cihaza yalnızca ALICI'nın kendi siparişlerinin durumuna ilişkin anlık bildirimler (push) gönderilir: kafe siparişinin hazırlanmaya başlaması, gel-al siparişinin tezgâhta hazır olması, kurye siparişinin kuryeyle yola çıkması, online mağaza siparişinin kargoya verilmesi ve ödenmiş bir siparişin iptal edilmesi. Bu amaçla uygulama, cihaza özgü bildirim jetonunu SATICI sunucusuna gönderir; bildirim yalnızca sipariş numarasını ve aşamayı içerir. ALICI bu bildirimleri uygulamadaki Bildirimler ekranında veya internet sitesindeki hesabının Bildirim tercihleri sayfasında sipariş durumu tercihini kapatarak ya da cihaz ayarlarından durdurabilir. Sipariş durumu ayrıca uygulamanın sipariş ekranlarında gösterilir; ödeme onayı e-postası tüm siparişler için, kargo, iptal ve iade e-postaları ise yalnızca online mağaza (kargo) siparişleri için gönderilir; gel-al siparişi hazır olduğunda bu bildirim ALICI'nın hiçbir cihazına ulaştırılamamışsa ve ALICI sipariş durumu tercihini kapatmamışsa bir kez 'Siparişin hazır' e-postası gönderilir; |
| Ön Bilgilendirme Formu §19, paylaşılan taraflar | işlemsel e-postaların gönderimi amacıyla e-posta altyapı sağlayıcısı Resend ile, barındırma hizmeti kapsamında Vercel ile, | işlemsel e-postaların gönderimi amacıyla e-posta altyapı sağlayıcısı Resend ile, ALICI'nın izin vermesi hâlinde sipariş durumu bildirimlerinin cihaza iletilmesi amacıyla anlık bildirim hizmeti sağlayıcısı Expo (650 Industries, Inc.) ve bildirimi cihaza ulaştıran Apple Push Notification service (Apple Inc.) veya Firebase Cloud Messaging (Google LLC) ile, barındırma hizmeti kapsamında Vercel ile, |
| Ön Bilgilendirme Formu §19, paylaşılan taraflar (yurt dışı) | Barındırma, veri tabanı ve kimlik doğrulama hizmetleri nedeniyle yurt dışına aktarım söz konusu olduğunda | Barındırma, veri tabanı, kimlik doğrulama ve anlık bildirim hizmetleri nedeniyle yurt dışına aktarım söz konusu olduğunda |
| Ön Bilgilendirme Formu §19, mobil uygulama verisi | izleme izni istemez; anlık bildirim (push) tokeni oluşturmaz ve sunucuya göndermez; çökme veya ekran ve tıklama kaydı toplamaz; konum izni istemez. | izleme izni istemez; anlık bildirim (push) jetonunu yalnızca ALICI sipariş durumu bildirimlerine izin verdiğinde oluşturur ve SATICI sunucusuna gönderir; çökme veya ekran ve tıklama kaydı toplamaz; konum izni istemez. |
| Ön Bilgilendirme Formu §19, ticari ileti paragrafı | Mobil uygulama sunucudan anlık bildirim (push) almaz; uygulamanın gösterdiği hatırlatmalar ALICI'nın kendisinin açtığı ve cihazda planlanan hatırlatmalardır. | Mobil uygulamaya sunucudan yalnızca, ALICI'nın izin vermesi hâlinde, kendi siparişlerinin durumuna ilişkin işlemsel anlık bildirimler (push) gönderilir; kampanya veya tanıtım içerikli anlık bildirim gönderilmez. Uygulamanın gösterdiği hatırlatmalar ALICI'nın kendisinin açtığı ve cihazda planlanan hatırlatmalardır. |
| Mesafeli Satış Sözleşmesi §16, yurt dışına aktarım | Barındırma (Vercel), PostgreSQL veri tabanı ({{DB_PROVIDER}}) ve e-posta gönderim (Resend) altyapılarının sunucularının yurt dışında bulunması nedeniyle | Barındırma (Vercel), PostgreSQL veri tabanı ({{DB_PROVIDER}}), e-posta gönderim (Resend) ve mobil uygulamaya sipariş durumu bildirimi iletimi (Expo, Apple Push Notification service ve Firebase Cloud Messaging) altyapılarının sunucularının yurt dışında bulunması nedeniyle |
| Mesafeli Satış Sözleşmesi §16, mobil uygulama verisi | Uygulama cihazın reklam tanımlayıcısına (iOS'ta IDFA, Android'de AAID) erişmez ve izleme izni istemez; anlık bildirim (push) tokeni oluşturmaz ve sunucuya göndermez, çökme kaydı toplamaz. | Uygulama cihazın reklam tanımlayıcısına (iOS'ta IDFA, Android'de AAID) erişmez, izleme izni istemez ve çökme kaydı toplamaz; anlık bildirim (push) jetonunu yalnızca üye sipariş durumu bildirimlerine izin verdiğinde oluşturur ve SATICI sunucusuna gönderir. |
| Mesafeli Satış Sözleşmesi §16, bildirim izni | Bildirim izni yalnızca üyenin uygulamada kendisi açtığı hatırlatmaların cihazda gösterilmesi için, kamera | Bildirim izni yalnızca üyenin uygulamada kendisi açtığı hatırlatmaların ve sipariş verdikten sonra kendisinin istediği sipariş durumu bildirimlerinin cihazda gösterilmesi için, kamera |
| Mesafeli Satış Sözleşmesi §16, ticari elektronik ileti paragrafı | Mobil uygulamaya sunucudan anlık bildirim (push) gönderilmez; uygulamadaki hatırlatmalar üyenin kendi açtığı ve cihazda planlanan hatırlatmalardır, uygulama içi bildirim kutusunda gösterilen sipariş durumu ve sadakat programı (damga ve kupon) bilgileri ise işlemsel niteliktedir. | Mobil uygulamaya sunucudan yalnızca, üyenin izin vermesi hâlinde, kendi siparişlerinin durumuna ilişkin anlık bildirimler (push) gönderilir; uygulamadaki hatırlatmalar üyenin kendi açtığı ve cihazda planlanan hatırlatmalardır; bu anlık bildirimler ile uygulama içi bildirim kutusunda gösterilen sipariş durumu ve sadakat programı (damga ve kupon) bilgileri işlemsel niteliktedir. |
| Mesafeli Satış Sözleşmesi §16, ticari elektronik ileti paragrafı (son cümle) | hatırlatmalar ayrıca cihaz ayarlarından veya uygulama içinden kapatılabilir. | hatırlatmalar ve sipariş durumu bildirimleri ayrıca cihaz ayarlarından veya uygulama içinden kapatılabilir. |
| İptal, İade ve Cayma Hakkı §13 | Mobil uygulamaya sunucudan anlık bildirim (push) gönderilmez; iade sürecine ilişkin gelişmeler e-posta ile bildirilir. | İade sürecine ilişkin gelişmeler e-posta ile bildirilir; mobil uygulamaya izin vermeniz hâlinde gönderilen anlık bildirimler (push) yalnızca siparişin aşamalarını ve ödenmiş bir siparişin iptal edildiğini bildirir, iade sürecinin aşamalarını kapsamaz. |
| İptal, İade ve Cayma Hakkı §19 | yalnızca onayınıza bağlı olarak gönderilir. Mobil uygulamaya sunucudan anlık bildirim (push) gönderilmez. | yalnızca onayınıza bağlı olarak gönderilir. Mobil uygulamaya izin vermeniz hâlinde gönderilen anlık bildirimler (push) yalnızca siparişin aşamalarını ve ödenmiş bir siparişin iptal edildiğini bildirir; iade sürecinin aşamaları bu yolla bildirilmez. |
| İptal, İade ve Cayma Hakkı §23, ticari ileti | kampanya içerikli iletiler yalnızca onayınıza bağlı gönderilir. Sunucudan anlık bildirim (push) gönderilmez. | kampanya içerikli iletiler yalnızca onayınıza bağlı gönderilir. İzin vermeniz hâlinde mobil uygulamaya gönderilen sipariş durumu anlık bildirimleri (push) de işlemsel niteliktedir ve iade sürecinin aşamalarını kapsamaz. |
| İptal, İade ve Cayma Hakkı §23, mobil uygulama | ; uygulama reklam tanımlayıcısı, anlık bildirim (push) tokeni veya çökme kaydı toplamaz. | ; uygulama reklam tanımlayıcısı veya çökme kaydı toplamaz, anlık bildirim (push) jetonunu ise yalnızca sipariş durumu bildirimlerine izin vermeniz hâlinde sunucumuza gönderir. |
| Teslimat ve Kargo Koşulları §15, 3. paragraf | Uygulama sunucuya anlık bildirim (push) tokeni göndermez ve sunucudan anlık bildirim gönderilmez; bu nedenle sipariş aşamalarına ilişkin bilgiler ve kampanya içerikleri push bildirim olarak iletilmez. | ALICI sipariş verdikten sonra uygulamanın sunduğu seçenekle izin verirse, siparişin kargoya verildiği ve ödenmiş bir siparişin iptal edildiği ayrıca cihaza anlık bildirim (push) olarak gönderilir; bunun için uygulama cihaza özgü bildirim jetonunu sunucuya iletir ve bildirim yalnızca sipariş numarasını ve aşamayı içerir. Kampanya içerikleri push bildirim olarak iletilmez. ALICI bu bildirimleri uygulamanın Bildirimler ekranındaki veya web sitesindeki hesabının Bildirim tercihleri sayfasındaki sipariş durumu tercihini kapatarak ya da cihazın bildirim ayarlarından durdurabilir; sipariş aşamaları uygulama içindeki bildirimler ekranında gösterilmeye devam eder. |
| Teslimat ve Kargo Koşulları §15, madde 'Bildirim kanalları' | Bildirim kanalları: e-posta, web sitesindeki üye hesabı sipariş detay sayfası ile mobil uygulamanın sipariş detay ve bildirimler ekranları; sunucudan anlık bildirim (push) gönderilmez. | Bildirim kanalları: e-posta, web sitesindeki üye hesabı sipariş detay sayfası ile mobil uygulamanın sipariş detay ve bildirimler ekranları; ALICI izin verirse kargoya verilme ve ödenmiş siparişin iptali ayrıca mobil uygulamaya anlık bildirim (push) olarak gönderilir. |
| Teslimat ve Kargo Koşulları §20, aktarımlar | Barındırma, veri tabanı ve işlemsel e-posta altyapısı (Vercel, {{DB_PROVIDER}} (PostgreSQL), Resend) kullanımından doğan aktarımlar | Barındırma, veri tabanı, işlemsel e-posta ve anlık bildirim altyapısı (Vercel, {{DB_PROVIDER}} (PostgreSQL), Resend, Expo ile Apple ve Google bildirim servisleri) kullanımından doğan aktarımlar |
| Satış Politikası ve Kısıtlı Ürünler §10, cihaz izinleri | bildirim izni yalnızca uygulamada kendi açtığınız hatırlatmaların cihazınızda gösterilmesi için; kamera, | bildirim izni yalnızca uygulamada kendi açtığınız hatırlatmaların ve sipariş verdikten sonra istemeniz hâlinde siparişinizin durumuna ilişkin bildirimlerin cihazınızda gösterilmesi için; kamera, |
| Satış Politikası ve Kısıtlı Ürünler §10, bildirimler | Uygulamanın bildirim kutusunda gösterilen sipariş durumu bildirimleri işlemsel niteliktedir ve ticari ileti sayılmaz. Uygulama sunucuya anlık bildirim (push) tokeni göndermez ve sunucudan anlık bildirim gönderilmez; cihazınızda gösterilen bildirimler, uygulamada kendi açtığınız ve cihazınızda planlanan hatırlatmalardır. | Uygulamanın bildirim kutusunda gösterilen sipariş durumu bildirimleri ile izin vermeniz hâlinde cihazınıza anlık bildirim (push) olarak gönderilen sipariş durumu bildirimleri işlemsel niteliktedir ve ticari ileti sayılmaz. Anlık bildirim için uygulama cihazınıza özgü bildirim jetonunu sunucumuza gönderir; bu bildirimler yalnızca kendi siparişlerinizin durumunu bildirir. Bunların dışında cihazınızda gösterilen bildirimler, uygulamada kendi açtığınız ve cihazınızda planlanan hatırlatmalardır. |
| Ödeme Koşulları ve Sanal POS §16, cihaz izinleri | Uygulama, yalnızca kendi açtığınız hatırlatmaların cihazınızda gösterilmesi için bildirim izni; | Uygulama, yalnızca kendi açtığınız hatırlatmaların ve sipariş verdikten sonra istemeniz hâlinde siparişinizin durumuna ilişkin bildirimlerin cihazınızda gösterilmesi için bildirim izni; |
| Ödeme Koşulları ve Sanal POS §16, bildirimler | Ödeme onayı e-postası her sipariş için, iade ve kargo e-postaları online mağaza siparişleri için hizmetin ifası kapsamında gönderilir. Uygulama sunucudan anlık bildirim (push) almaz; uygulamadaki hatırlatmalar cihazınızda planlanır. | Ödeme onayı e-postası her sipariş için, iade ve kargo e-postaları online mağaza siparişleri için hizmetin ifası kapsamında gönderilir; ödeme onayı anlık bildirim (push) olarak gönderilmez. İzin vermeniz hâlinde uygulamaya yalnızca siparişinizin hazırlanmaya başlaması, hazır olması, yola çıkması, kargoya verilmesi ve ödenmiş siparişin iptal edilmesi anlık bildirim olarak gönderilir; bu bildirimler tutar veya ödeme bilgisi içermez. Uygulamadaki hatırlatmalar cihazınızda planlanır. |
| Ödeme Koşulları ve Sanal POS §26, hizmet sağlayıcılar | Barındırma hizmeti Vercel, veri tabanı hizmeti {{DB_PROVIDER}} (PostgreSQL) ve işlemsel e-posta hizmeti Resend üzerinden alınmaktadır; | Barındırma hizmeti Vercel, veri tabanı hizmeti {{DB_PROVIDER}} (PostgreSQL), işlemsel e-posta hizmeti Resend ve mobil uygulamaya sipariş durumu bildirimi iletimi Expo ile Apple ve Google bildirim servisleri üzerinden alınmaktadır; |
| Ödeme Koşulları ve Sanal POS §26, mobil uygulama verisi | erişmez, anlık bildirim (push) tokeni oluşturmaz, çökme veya kullanım kaydı toplamaz ve konum izni istemez. | erişmez, çökme veya kullanım kaydı toplamaz ve konum izni istemez; anlık bildirim (push) jetonu yalnızca sipariş durumu bildirimlerine izin vermeniz hâlinde alınır ve bu bildirimler tutar veya ödeme bilgisi içermez. |
| Güvenli Alışveriş ve Bilgi Güvenliği §14, cihaz izinleri | Bildirim izni yalnızca uygulamada kendi açtığınız hatırlatmaların cihazınızda gösterilmesi için istenir; hatırlatmalar cihazda planlanır ve sunucudan anlık bildirim gönderilmez. | Bildirim izni yalnızca uygulamada kendi açtığınız hatırlatmaların ve sipariş verdikten sonra istemeniz hâlinde siparişinizin durumuna ilişkin bildirimlerin cihazınızda gösterilmesi için istenir; hatırlatmalar cihazda planlanır, sunucudan ise yalnızca sipariş durumu anlık bildirimleri gönderilir ve bunlar sipariş numarası ile sipariş aşaması dışında bilgi içermez. |
| Güvenli Alışveriş ve Bilgi Güvenliği §17, madde | Mobil uygulama sunucuya anlık bildirim (push) belirteci göndermez; hatırlatmalar cihazınızda planlanır, bu nedenle sunucuda bildirim belirteci saklanmaz. | Hatırlatmalar cihazınızda planlanır ve sunucuda saklanmaz. Sipariş durumu bildirimlerine izin vermeniz hâlinde sunucuda tutulan bildirim jetonu, uygulamada oturumu kapattığınızda, üyelik hesabınız kapatıldığında veya silindiğinde ya da Apple veya Google jetonun artık bir cihaza ulaşmadığını bildirdiğinde hemen; uygulama jetonu 180 gün boyunca yenilemezse periyodik imhada silinir. |
| Güvenli Alışveriş ve Bilgi Güvenliği §22, tablo 'Uygulama mağazaları' ve yeni satır | App Store ve Google Play; mobil uygulamanın dağıtımı ve sürüm yayını. Uygulamadaki hatırlatmalar cihazınızda planlanır; sunucudan anlık bildirim gönderilmez. | App Store ve Google Play; mobil uygulamanın dağıtımı ve sürüm yayını. Uygulamadaki hatırlatmalar cihazınızda planlanır. + yeni satır 'Mobil uygulama anlık bildirimleri': Expo (650 Industries, Inc.); izin vermeniz hâlinde sipariş durumu bildirimlerinin Apple Push Notification service (Apple Inc.) veya Firebase Cloud Messaging (Google LLC) aracılığıyla cihazınıza iletilmesi. Bu sağlayıcılara yalnızca cihazınıza özgü bildirim jetonu ile sipariş numarasını ve aşamayı içeren bildirim iletilir; adınız, adresiniz, telefon numaranız, ürünler ve tutarlar gönderilmez. |
| Gizlilik Politikası §3, tablo 'Mobil uygulama ve cihaz verisi' ve yeni satır | Anlık bildirim (push) tokeni oluşturulmaz ve sunucuya gönderilmez; çökme (crash) ve kullanım kaydı toplanmaz. | Çökme (crash) ve kullanım kaydı toplanmaz. + yeni satır 'Mobil uygulama bildirim jetonu (izne bağlı)': Sipariş verdikten sonra uygulamanın sunduğu 'Siparişin hazır olunca haber verelim mi?' seçeneğiyle bildirim izni verirseniz, uygulamanın anlık bildirim hizmeti Expo'dan (650 Industries, Inc., ABD) alınan ve Apple Push Notification service veya Firebase Cloud Messaging cihaz jetonundan türetilen, cihazınıza özgü bildirim jetonu; jetonu üyeliğinizle ilişkilendiren üyelik e-posta adresiniz, cihazın platformu (iOS veya Android; isteğin istemci bilgisinden okunur) ve jetonun kaydedildiği ve en son yenilendiği zaman. Jeton yalnızca kendi siparişlerinizin durumunu bildirmek için kullanılır; reklam tanımlayıcısı, konum veya rehber bilgisi işlenmez. |
| Gizlilik Politikası §4, 'Mobil uygulama' | Uygulama çökme kaydı, reklam tanımlayıcısı, anlık bildirim (push) tokeni veya konum verisi toplamaz; | Uygulama çökme kaydı, reklam tanımlayıcısı veya konum verisi toplamaz; sipariş durumu bildirimlerine izin vermeniz hâlinde cihazınıza özgü bildirim jetonu uygulama tarafından sunucumuza gönderilir; |
| Gizlilik Politikası §5, amaç tablosu, yeni satır | (yoktu) | Anahtar: İzin vermeniz hâlinde kendi siparişlerinizin durumuna ilişkin bildirimlerin mobil uygulamaya anlık bildirim (push) olarak gönderilmesi; gel-al siparişiniz hazır olduğunda bu bildirim hiçbir cihazınıza ulaştırılamamışsa bunun bir kez e-postayla bildirilmesi. Değer: Sözleşmenin kurulması veya ifasıyla doğrudan ilgili olma (KVKK m.5/2-c); bildirim izni işletim sistemi üzerinden sizin seçiminizle verilir; işlemsel bildirimler ticari elektronik ileti kapsamında değildir |
| Gizlilik Politikası §8, tablo 'E-posta gönderim sağlayıcısı' | sipariş ve ödeme bildirimleri, kargo, iptal ve iade bildirimleri, | sipariş ve ödeme bildirimleri, gel-al siparişinizin hazır olduğu bilgisi telefon bildirimiyle ulaştırılamadığında gönderilen 'Siparişin hazır' e-postası, kargo, iptal ve iade bildirimleri, |
| Gizlilik Politikası §8, tablo 'Uygulama dağıtım platformları' ve yeni satır | Mobil uygulamanın App Store ve Google Play üzerinden dağıtılması. Uygulama sunucudan anlık bildirim (push) almaz; hatırlatmalar cihazınızda planlanır ve bu amaçla Apple veya Google bildirim servislerine veri aktarılmaz. ... | Mobil uygulamanın App Store ve Google Play üzerinden dağıtılması. Hatırlatmalar cihazınızda planlanır ve bu amaçla veri aktarılmaz; sipariş durumu bildirimleri mağaza kanalıyla değil, aşağıdaki anlık bildirim hizmeti sağlayıcıları üzerinden iletilir. ... + yeni satır 'Anlık bildirim hizmeti sağlayıcıları (yalnızca bildirim izni vermeniz hâlinde)': Kendi siparişlerinizin durumuna ilişkin bildirimlerin mobil uygulamaya iletilmesi; bu amaçla bildirimin başlığı ve metni, bildirime dokunduğunuzda açılacak sipariş ekranının bağlantısı ve cihazınıza özgü bildirim jetonu, uygulamanın anlık bildirim hizmeti Expo (650 Industries, Inc., ABD; Google Cloud üzerinde ABD'de barındırılır) üzerinden iOS cihazlarda Apple Push Notification service (Apple Inc., ABD), Android cihazlarda Firebase Cloud Messaging (Google LLC, ABD) aracılığıyla cihazınıza ulaştırılır. Bildirim yalnızca sipariş numarasını ve aşamayı içerir; adınız, e-posta adresiniz, adresiniz, telefon numaranız, ürünler ve tutarlar bu sağlayıcılara gönderilmez. Yurt dışına aktarım 9. bölümde açıklanmıştır. |
| Gizlilik Politikası §9, 1. paragraf | Şirketin kullandığı bulut barındırma, veri tabanı, kimlik doğrulama (üyelik girişi) ve e-posta gönderim hizmetleri yurt dışında yerleşik sağlayıcılar tarafından sunulmaktadır; | Şirketin kullandığı bulut barındırma, veri tabanı, kimlik doğrulama (üyelik girişi), e-posta gönderim ve mobil uygulamaya sipariş durumu bildirimi iletim hizmetleri yurt dışında yerleşik sağlayıcılar tarafından sunulmaktadır; |
| Gizlilik Politikası §10, saklama tablosu, yeni satır | (yoktu) | Anahtar: Mobil uygulama bildirim jetonu. Değer: Uygulamada oturumu kapattığınızda, üyelik hesabınız kapatıldığında veya silindiğinde ya da Apple veya Google jetonun artık bir cihaza ulaşmadığını bildirdiğinde hemen silinir; uygulama jetonu 180 gün boyunca yenilemezse periyodik imhada silinir. Expo'dan okunan teslim sonuçları jetonu en fazla 24 saat tutar. |
| Gizlilik Politikası §14, madde 'Bildirim izni' | Bildirim izni: İsteğe bağlıdır ve yalnızca uygulamada kendi açtığınız hatırlatmaların cihazınızda gösterilmesi için kullanılır. Hatırlatmalar cihazda planlanır; sunucudan anlık bildirim (push) gönderilmez ve anlık bildirim tokeni oluşturulmaz. İzni cihaz ayarlarından kapatabilirsiniz. | Bildirim izni: İsteğe bağlıdır ve iki amaçla kullanılır: uygulamada kendi açtığınız hatırlatmaların cihazınızda gösterilmesi ve istemeniz hâlinde kendi siparişlerinizin durumuna ilişkin anlık bildirimlerin (push) gösterilmesi. Uygulama bildirim iznini ilk açılışta istemez; siparişinizi verdikten sonra ödeme sonucu ve sipariş takip ekranlarında 'Siparişin hazır olunca haber verelim mi?' seçeneğini sunar ve işletim sisteminin izin penceresi yalnızca bu seçeneğe dokunduğunuzda açılır. Hatırlatmalar cihazda planlanır; hangi hatırlatmanın açık olduğu sunucuya bildirilmez. İzin verirseniz uygulama, cihazınıza özgü bildirim jetonunu oturum açtığınız üyelik hesabınız üzerinden sunucumuza gönderir ve size yalnızca şu aşamalarda bildirim gönderilir: kafe siparişinin hazırlanmaya başlaması, gel-al siparişinin tezgâhta hazır olması, kurye siparişinin kuryeyle yola çıkması, online mağaza siparişinin kargoya verilmesi ve ödenmiş bir siparişin iptal edilmesi. Ödeme onayı e-postayla iletilir; siparişin masanıza getirilmesi ve kasada girilen siparişler için anlık bildirim gönderilmez. Bildirim yalnızca sipariş numarasını ve aşamayı bildiren cümleyi içerir (örneğin '#10234 numaralı siparişin hazır, tezgâhta seni bekliyor.'); adınız, adresiniz, telefon numaranız, ürünler ve tutarlar yazılmaz. Pazarlama içerikli anlık bildirim gönderilmez. Bu bildirimleri uygulamadaki Bildirimler ekranında veya sitede hesabınızın Bildirim tercihleri sayfasında sipariş durumu tercihini kapatarak ya da cihaz ayarlarından durdurabilirsiniz; sipariş aşamaları uygulama içindeki bildirim listesinde görünmeye devam eder. Gel-al siparişiniz hazır olduğunda bu bildirim cihazlarınızın hiçbirine ulaştırılamamışsa (izin verilmemişse, uygulama sürümü bu bildirimi desteklemiyorsa veya kayıtlı cihaz yoksa) siparişin e-posta adresine bir kez 'Siparişin hazır' e-postası gönderilir; sipariş durumu tercihini kapattıysanız bu e-posta da gönderilmez. Hukuki sebep: KVKK m.5/2-c; bu bildirimler ve e-posta işlemseldir, ticari elektronik ileti sayılmaz ve abonelikten çıkma bağlantısı içermez. İzni cihaz ayarlarından kapatabilirsiniz. |
| Gizlilik Politikası §19 | Mobil uygulama sunucudan anlık bildirim (push) almaz ve bu kanaldan ticari ileti gönderilmez; cihazınızda gösterilen bildirimler yalnızca uygulamada sizin açtığınız ve cihazınızda planlanan hatırlatmalardır; | Mobil uygulamaya sunucudan yalnızca, izin vermeniz hâlinde, kendi siparişlerinizin durumuna ilişkin işlemsel anlık bildirimler (push) gönderilir ve bu kanaldan ticari ileti gönderilmez; cihazınızda gösterilen diğer bildirimler yalnızca uygulamada sizin açtığınız ve cihazınızda planlanan hatırlatmalardır; |
| KVKK Aydınlatma Metni §6, 'Mobil uygulama kullanıcısı - Bağlantı verisi' ve yeni madde | ... uygulamada reklam veya ölçümleme kiti bulunmaz, uygulama anlık bildirim tokeni, çökme kaydı veya ekran ve tıklama kaydı toplamaz. ... | ... uygulamada reklam veya ölçümleme kiti bulunmaz, uygulama çökme kaydı veya ekran ve tıklama kaydı toplamaz. ... + yeni madde: Mobil uygulama kullanıcısı - Bildirim jetonu (yalnızca bildirim izni vermeniz hâlinde): uygulamanın anlık bildirim hizmeti Expo'dan (650 Industries, Inc., ABD) alınan ve Apple Push Notification service veya Firebase Cloud Messaging cihaz jetonundan türetilen, cihazınıza özgü bildirim jetonu; jetonu üyeliğinizle ilişkilendiren üyelik e-posta adresiniz, cihazın platformu (iOS veya Android; isteğin istemci bilgisinden okunur) ve jetonun kaydedildiği ve en son yenilendiği zaman. Jeton yalnızca kendi siparişlerinizin durumuna ilişkin anlık bildirimler için kullanılır. Hukuki sebep: KVKK m.5/2-c sözleşmenin kurulması veya ifasıyla doğrudan ilgili olma; bildirim izni işletim sistemi üzerinden sizin seçiminizle verilir. |
| KVKK Aydınlatma Metni §6, 'Mobil uygulama kullanıcısı - İzne bağlı cihaz erişimi' | bildirim izni (yalnızca uygulamada kendi açtığınız hatırlatmaların cihazınızda gösterilmesi için; hatırlatmalar cihazda planlanır ve sunucudan anlık bildirim gönderilmez); | bildirim izni (yalnızca uygulamada kendi açtığınız hatırlatmaların ve siparişinizi verdikten sonra istemeniz hâlinde kendi siparişlerinizin durumuna ilişkin anlık bildirimlerin cihazınızda gösterilmesi için; hatırlatmalar cihazda planlanır, sunucudan yalnızca sipariş durumu bildirimleri gönderilir); |
| KVKK Aydınlatma Metni §7, 'Sipariş ve sözleşme süreçlerinin yürütülmesi' | sipariş onayının kalıcı veri saklayıcısıyla iletilmesi ve sipariş durumunun güncellenmesi. | sipariş onayının kalıcı veri saklayıcısıyla iletilmesi, sipariş durumunun güncellenmesi ve izin vermeniz hâlinde sipariş durumunun mobil uygulamaya anlık bildirimle iletilmesi. |
| KVKK Aydınlatma Metni §8, tablo 'Mobil uygulama bildirimleri ve uygulama içi bilgilendirmeler' | Uygulama sunucudan anlık bildirim (push) almaz ve anlık bildirim tokeni oluşturulmaz; bildirim izni yalnızca uygulamada kendi açtığınız hatırlatmaların cihazınızda planlanıp gösterilmesi için kullanılır. Sipariş durumu, ödeme sonucu, kargo hareketi ve damga hareketlerine ilişkin uygulama içi bilgilendirmeler için KVKK m.5/2-c sözleşmenin ifası; | Bildirim izni uygulamada kendi açtığınız hatırlatmaların cihazınızda planlanıp gösterilmesi ve istemeniz hâlinde kendi siparişlerinizin durumuna ilişkin anlık bildirimlerin (push) gösterilmesi için kullanılır. Sipariş durumu, ödeme sonucu, kargo hareketi ve damga hareketlerine ilişkin uygulama içi bilgilendirmeler, bildirim jetonunun işlenmesi, sipariş durumu anlık bildirimleri ve gel-al siparişinin hazır olduğunu bildiren e-posta için KVKK m.5/2-c sözleşmenin kurulması veya ifasıyla doğrudan ilgili olma; |
| KVKK Aydınlatma Metni §9, anlık bildirim maddesi | uygulama şu anda sunucudan anlık bildirim almaz, böyle bir gönderim başlatılırsa yalnızca ayrıca vereceğiniz onayla yapılır. | uygulamaya bugün sunucudan yalnızca, izin vermeniz hâlinde, kendi siparişlerinizin durumuna ilişkin işlemsel anlık bildirimler gönderilir; tanıtım içerikli bir gönderim başlatılırsa yalnızca ayrıca vereceğiniz onayla yapılır. |
| KVKK Aydınlatma Metni §10, 'Mobil uygulama' | Uygulama konum, reklam tanımlayıcısı, anlık bildirim tokeni veya çökme kaydı toplamaz. | Uygulama konum, reklam tanımlayıcısı veya çökme kaydı toplamaz; sipariş durumu bildirimlerine izin vermeniz hâlinde cihazınıza özgü bildirim jetonu uygulama tarafından sunucumuza gönderilir. |
| KVKK Aydınlatma Metni §12, 4. paragraf | Uygulama sunucuya anlık bildirim tokeni veya cihaz kaydı göndermediğinden, uygulamanın kaldırılması üzerine sunucumuzda silinmesi gereken bir cihaz verisi oluşmaz. | Sipariş durumu bildirimlerine izin verdiyseniz sunucumuzda tutulan bildirim jetonu, uygulamada oturumu kapattığınızda hemen silinir; uygulamayı oturumu kapatmadan kaldırırsanız jeton, Apple veya Google jetonun artık bir cihaza ulaşmadığını bildirdiğinde, en geç ise uygulama jetonu 180 gün boyunca yenilemediğinde periyodik imhada silinir. |
| KVKK Aydınlatma Metni §12, madde 'Bildirimler' | Bildirimler: Uygulama sunucuya anlık bildirim (push) tokeni göndermez ve sunucudan anlık bildirim gönderilmez. Bildirim izni yalnızca uygulamada kendi açtığınız hatırlatmaların cihazınızda planlanıp gösterilmesi için kullanılır; sipariş durumu ve damga hareketleri uygulama içindeki bildirimler ekranında gösterilir. | Bildirimler: Uygulama bildirim iznini ilk açılışta istemez; siparişinizi verdikten sonra ödeme sonucu ve sipariş takip ekranlarında 'Siparişin hazır olunca haber verelim mi?' seçeneğini sunar ve işletim sisteminin izni yalnızca bu seçeneğe dokunduğunuzda istenir. İzin verirseniz uygulama, anlık bildirim hizmeti Expo'dan cihazınıza özgü bildirim jetonunu alır ve oturum açtığınız üyelik hesabınız üzerinden sunucumuza gönderir; sunucumuzda jeton, üyelik e-posta adresiniz, cihazın platformu (iOS veya Android) ve jetonun kaydedildiği ve en son yenilendiği zaman tutulur. Jeton yalnızca kendi siparişlerinizin durumuna ilişkin işlemsel bildirimler için kullanılır: kafe siparişinin hazırlanmaya başlaması, gel-al siparişinin tezgâhta hazır olması, kurye siparişinin kuryeyle yola çıkması, online mağaza siparişinin kargoya verilmesi ve ödenmiş bir siparişin iptal edilmesi. Ödeme onayı e-postayla iletilir; siparişin masanıza getirilmesi ve kasada girilen siparişler için anlık bildirim gönderilmez. Bildirim yalnızca sipariş numarasını ve aşamayı içerir (örneğin '#10234 numaralı siparişin hazır, tezgâhta seni bekliyor.'); adınız, adresiniz, telefon numaranız, ürünler ve tutarlar yazılmaz. Bildirim ve jeton, Expo üzerinden Apple Push Notification service veya Firebase Cloud Messaging aracılığıyla cihazınıza ulaştırılır (14. ve 15. bölüm). Pazarlama içerikli anlık bildirim gönderilmez. Bu bildirimleri uygulamadaki Bildirimler ekranında veya sitede hesabınızın Bildirim tercihleri sayfasında sipariş durumu tercihini kapatarak ya da cihaz ayarlarından durdurabilirsiniz; sipariş durumu ve damga hareketleri uygulama içindeki bildirimler ekranında gösterilmeye devam eder. Gel-al siparişiniz hazır olduğunda bu bildirim cihazlarınızın hiçbirine ulaştırılamamışsa ve sipariş durumu tercihini kapatmadıysanız siparişin e-posta adresine bir kez 'Siparişin hazır' e-postası gönderilir. Hukuki sebep: KVKK m.5/2-c; bu bildirimler ve e-posta işlemseldir, 6563 sayılı Kanun anlamında ticari elektronik ileti sayılmaz. Hatırlatmalar cihazınızda planlanır ve sunucumuza bildirilmez. |
| KVKK Aydınlatma Metni §14, tablo 'Mobil uygulama dağıtım altyapısı' ve yeni satır | Uygulamanın dağıtımı ve güncellenmesi. Uygulama sunucudan anlık bildirim almadığından bildirim içeriği veya bildirim tokeni bu kanalla aktarılmaz. ... | Uygulamanın dağıtımı ve güncellenmesi. Bildirim içeriği ve bildirim jetonu bu kanalla aktarılmaz; sipariş durumu bildirimleri aşağıdaki anlık bildirim hizmeti sağlayıcıları üzerinden iletilir. ... + yeni satır 'Anlık bildirim hizmeti sağlayıcıları: Expo (650 Industries, Inc., ABD), Apple Push Notification service (Apple Inc., ABD) ve Firebase Cloud Messaging (Google LLC, ABD) (yalnızca bildirim izni vermeniz hâlinde)': Kendi siparişlerinizin durumuna ilişkin işlemsel bildirimlerin mobil uygulamaya iletilmesi: bildirim Expo'nun anlık bildirim hizmeti (Google Cloud üzerinde ABD'de barındırılır) üzerinden iOS cihazlarda Apple Push Notification service, Android cihazlarda Firebase Cloud Messaging aracılığıyla cihazınıza ulaştırılır; Expo'dan teslim sonucu (bildirimin kabul edildiği veya cihazın artık kayıtlı olmadığı) okunur. Aktarılan veri: cihazınıza özgü bildirim jetonu, bildirimin başlığı ve sipariş numarasını ve aşamayı içeren metni ile bildirime dokunduğunuzda açılacak sipariş ekranının bağlantısı; adınız, e-posta adresiniz, adresiniz, telefon numaranız, ürünler ve tutarlar aktarılmaz. Hukuki sebep: KVKK m.5/2-c. Yurt dışına aktarım: 15. bölüm. |
| KVKK Aydınlatma Metni §15, 2. paragraf (altyapı) | Hizmet altyapımızın bir kısmı (uygulama barındırma ve içerik dağıtım ağı, PostgreSQL veri tabanı, üyelik kimlik doğrulaması ve e-posta gönderimi) yurt dışında | Hizmet altyapımızın bir kısmı (uygulama barındırma ve içerik dağıtım ağı, PostgreSQL veri tabanı, üyelik kimlik doğrulaması, e-posta gönderimi ve mobil uygulamaya anlık bildirim iletimi) yurt dışında |
| KVKK Aydınlatma Metni §15, 2. paragraf (mağazalar) | bu kanalla tarafımızca kişisel veri aktarılmaz (14. bölüm). | bu kanalla tarafımızca kişisel veri aktarılmaz (14. bölüm). Sipariş durumu anlık bildirimleri ise mağaza kanalıyla değil, aşağıda sayılan anlık bildirim hizmeti üzerinden Apple ve Google'ın bildirim servislerine iletilir. |
| KVKK Aydınlatma Metni §15, 4. paragraf | siparişte ve e-postada tekrarlandığından arızi değildir | siparişte, e-postada ve anlık bildirimde tekrarlandığından arızi değildir |
| KVKK Aydınlatma Metni §15, 5. paragraf | barındırma, veri tabanı, kimlik doğrulama ve e-posta altyapısı için ilgili sağlayıcıya yalnızca hizmetin sunulması için gereken veriler iletilir. | barındırma, veri tabanı, kimlik doğrulama, e-posta ve anlık bildirim altyapısı için ilgili sağlayıcıya yalnızca hizmetin sunulması için gereken veriler iletilir; anlık bildirim sağlayıcılarına yalnızca bildirim jetonu, bildirimin metni ve bildirime dokunulduğunda açılacak sipariş ekranının bağlantısı iletilir. |
| KVKK Aydınlatma Metni §15, 'Aktarım gerekçeleri' | e-posta gönderimi ile kesinleşen karaoke rezervasyonlarının ve ödeme uyarılarının ekibimize bildirilmesi. | e-posta gönderimi ile kesinleşen karaoke rezervasyonlarının ve ödeme uyarılarının ekibimize bildirilmesi ve izin vermeniz hâlinde sipariş durumu anlık bildirimlerinin mobil uygulamaya iletilmesi. |
| KVKK Aydınlatma Metni §15, 'Alıcılar ve bilinen konumlar' | üyelik kimlik doğrulaması {{AUTH_PROVIDER}} ({{AUTH_RECIPIENT}}; imza sürecinde); fatura düzenlenmesi | üyelik kimlik doğrulaması {{AUTH_PROVIDER}} ({{AUTH_RECIPIENT}}; imza sürecinde); sipariş durumu anlık bildirimlerinin iletilmesi Expo (650 Industries, Inc.; ABD; sunucu bölgesi ABD, Google Cloud; imza sürecinde), bildirimin iOS cihazlara ulaştırılması Apple Inc. (ABD; Apple Push Notification service; imza sürecinde) ve Android cihazlara ulaştırılması Google LLC (ABD; Firebase Cloud Messaging; imza sürecinde); fatura düzenlenmesi |
| KVKK Aydınlatma Metni §15, 'Aktarılan veri kategorileri' | internet sitesi ziyaretlerinde IP adresi ve tarayıcı bilgisi. Kart bilgileri PayNkolay'a | internet sitesi ziyaretlerinde IP adresi ve tarayıcı bilgisi; anlık bildirim sağlayıcılarına yalnızca bildirim jetonu, sipariş numarasını ve aşamayı içeren bildirim metni ve sipariş ekranının bağlantısı. Kart bilgileri PayNkolay'a |
| KVKK Aydınlatma Metni §16, saklama tablosu, yeni satır | (yoktu) | Anahtar: Mobil uygulama bildirim jetonu (yalnızca bildirim izni vermeniz hâlinde). Değer: Uygulamada oturumu kapattığınızda, üyelik hesabınız kapatıldığında veya silindiğinde ya da Apple veya Google jetonun artık bir cihaza ulaşmadığını bildirdiğinde hemen silinir; uygulama jetonu 180 gün boyunca yenilemezse periyodik imhada silinir. Expo'dan okunan teslim sonuçları jetonu en fazla 24 saat tutar. |
| KVKK Aydınlatma Metni §20 | Mobil uygulama sunucudan anlık bildirim (push) almaz. Siparişinizin durumu, | Mobil uygulamaya sunucudan yalnızca, izin vermeniz hâlinde, kendi siparişlerinizin durumuna ilişkin işlemsel anlık bildirimler (push) gönderilir; pazarlama içerikli anlık bildirim gönderilmez. Siparişinizin durumu, |
| Açık Rıza Metni §5, 'İşlemsel bildirimler' | ya da hesabınızda güvenlikle ilgili bir işlem yapıldığı yönündeki e-posta ve uygulama içi bildirimler pazarlama amacı taşımadığından | ya da hesabınızda güvenlikle ilgili bir işlem yapıldığı yönündeki e-posta ve uygulama içi bildirimler ile izin vermeniz hâlinde telefonunuza gönderilen sipariş durumu anlık bildirimleri pazarlama amacı taşımadığından |
| Açık Rıza Metni §13 (R8), 1. paragraf | Bugün uygulama anlık bildirim (push) tokeni oluşturmaz ve sunucuya göndermez, sunucudan size anlık bildirim gönderilmez ve bu amaçla Apple veya Google'ın bildirim iletim servislerine veri aktarılmaz; bu nedenle bu kalem için rıza istenmez ve onay kutucuğu bulunmaz. | Bugün mobil uygulamaya pazarlama içerikli anlık bildirim gönderilmez. Uygulama, yalnızca siparişinizi verdikten sonra izin vermeniz hâlinde, kendi siparişlerinizin durumunu bildirmek için cihazınıza özgü bildirim jetonunu sunucumuza gönderir ve bu işlemsel bildirimler Expo ile Apple veya Google'ın bildirim iletim servisleri üzerinden cihazınıza iletilir; bu jeton ve servisler pazarlama amacıyla kullanılmaz. Bu nedenle bu kalem için rıza istenmez ve onay kutucuğu bulunmaz. |
| Açık Rıza Metni §13 (R8), 3. paragraf | İşlemsel bildirimler, yani siparişinizin durumu, ödeme sonucu ve hesap güvenliğine ilişkin bildirimler bu metnin konusu dışındadır (bkz. 5. bölüm). | İşlemsel bildirimler, yani siparişinizin durumu (izin vermeniz hâlinde telefonunuza anlık bildirim olarak gönderilenler dâhil), ödeme sonucu ve hesap güvenliğine ilişkin bildirimler bu metnin konusu dışındadır (bkz. 5. bölüm). |
| Açık Rıza Metni rızayı geri almanın sonuçları tablosu, 'İşlemsel bildirimler' | Etkilenmez. Sipariş, ödeme, kargo, damga ve güvenlik bildirimleri e-posta ile ve uygulama içindeki bildirim kutusunda iletilmeye devam eder. | Etkilenmez. Sipariş, ödeme, kargo, damga ve güvenlik bildirimleri e-posta ile ve uygulama içindeki bildirim kutusunda, izin verdiyseniz sipariş durumu bildirimleri ayrıca telefonunuza anlık bildirim olarak iletilmeye devam eder. |
| Kişisel Veri Saklama ve İmha Politikası §5, yeni kayıt ortamı | (yoktu) | Anlık bildirim hizmeti: Mobil uygulamaya sipariş durumu bildirimlerinin iletildiği Expo anlık bildirim hizmeti (650 Industries, Inc.) ile bildirimi cihaza ulaştıran Apple Push Notification service ve Firebase Cloud Messaging. Cihaz çevrim dışıysa bildirim, iletilmek üzere en fazla bildirimin geçerlilik süresi (en çok 24 saat) boyunca bekletilir; bu sağlayıcıların kendi kayıtları kendi koşullarına tabidir. Bildirim jetonları uygulama veri tabanında tutulur. |
| Kişisel Veri Saklama ve İmha Politikası §8, saklama tablosu, yeni satır | (yoktu) | Anahtar: Mobil uygulama bildirim jetonu (Expo'dan alınan cihaza özgü jeton, üyelik e-posta adresi, cihazın platformu, kayıt ve son yenilenme zamanı) ve bildirim teslim sonuçları. Değer: Jeton 9. bölümdeki kurala göre silinir: oturum kapatıldığında, üyelik hesabı kapatıldığında veya silindiğinde ya da Apple veya Google jetonun artık bir cihaza ulaşmadığını bildirdiğinde hemen; uygulama jetonu 180 gün boyunca yenilemezse periyodik imhada. Expo'dan okunan teslim sonuçları (bildirimin kabul edildiği veya cihazın artık kayıtlı olmadığı) jetonu en fazla 24 saat tutar ve ardından silinir. |
| Kişisel Veri Saklama ve İmha Politikası §9, bildirim maddesi (üç madde) | Hatırlatmalar cihazda planlanır; uygulama sunucuya anlık bildirim (push) tokeni göndermez ve sunucudan anlık bildirim gönderilmez. Bu nedenle sunucu tarafında bildirim tokeni saklanmaz. | Hatırlatmalar cihazda planlanır ve sunucuda saklanmaz. Üye siparişini verdikten sonra uygulamanın sunduğu seçenekle bildirim izni verirse, uygulama Expo'dan aldığı cihaza özgü bildirim jetonunu sunucuya gönderir; sunucuda jeton, üyelik e-posta adresi, cihazın platformu (iOS veya Android) ve jetonun kaydedildiği ve en son yenilendiği zaman tutulur ve jeton yalnızca üyenin kendi siparişlerinin durumuna ilişkin anlık bildirimler için kullanılır. / (yeni madde) Mobil uygulamanın bildirim jetonu: oturum kapatıldığında, üyelik hesabı kapatıldığında veya silindiğinde ya da Apple veya Google jetonun artık bir cihaza ulaşmadığını bildirdiğinde hemen; uygulama jetonu 180 gün boyunca yenilemezse periyodik imhada silinir. / (yeni madde) Bildirimin Expo'ya teslim edildiğine ilişkin kayıt ve Expo'dan okunan teslim sonucu (bildirimin kabul edildiği veya cihazın artık kayıtlı olmadığı) jetonu en fazla 24 saat tutar ve ardından silinir. |
| Kişisel Veri Saklama ve İmha Politikası §14, 1. paragraf | ödeme hizmeti (N Kolay Ödeme ve Elektronik Para Kuruluşu A.Ş., PayNkolay), mobil uygulama dağıtımı, | ödeme hizmeti (N Kolay Ödeme ve Elektronik Para Kuruluşu A.Ş., PayNkolay), mobil uygulamaya sipariş durumu anlık bildirimlerinin iletilmesi (Expo, 650 Industries, Inc.; bildirimi cihaza ulaştıran Apple Inc. ve Google LLC bildirim servisleri), mobil uygulama dağıtımı, |
| Kişisel Veri Saklama ve İmha Politikası §14, 3. paragraf | Barındırma, veri tabanı, üyelik kimlik doğrulaması, işlemsel e-posta ve mobil uygulama dağıtımı hizmetlerinin sunucuları yurt dışındadır. | Barındırma, veri tabanı, üyelik kimlik doğrulaması, işlemsel e-posta, anlık bildirim ve mobil uygulama dağıtımı hizmetlerinin sunucuları yurt dışındadır. |
| Çerez Politikası §11 | Mobil uygulamada sunucudan anlık bildirim (push) gönderilmez; uygulama yalnızca sizin açtığınız hatırlatmaları cihazınızda planlanmış bildirim olarak gösterir. Pazarlama kategorisine verdiğiniz onay bu hatırlatmalarla ilgili değildir; | Mobil uygulamada sunucudan pazarlama içerikli anlık bildirim (push) gönderilmez; sunucudan yalnızca, izin vermeniz hâlinde, siparişinizin durumuna ilişkin işlemsel anlık bildirimler gönderilir ve uygulama sizin açtığınız hatırlatmaları cihazınızda planlanmış bildirim olarak gösterir. Pazarlama kategorisine verdiğiniz onay bu bildirimler ve hatırlatmalarla ilgili değildir; |
| Çerez Politikası §15, madde 'Bildirimler' | Bildirimler: Bildirim izni isteğe bağlıdır ve yalnızca uygulamada kendi açtığınız hatırlatmaların cihazınızda gösterilmesi için kullanılır. Hatırlatmalar cihazınızda planlanır; uygulama sunucuya anlık bildirim (push) tokeni göndermez ve sunucudan anlık bildirim gönderilmez. Bildirim iznini cihaz ayarlarından her zaman kapatabilirsiniz. | Bildirimler: Bildirim izni isteğe bağlıdır ve yalnızca uygulamada kendi açtığınız hatırlatmaların ve sipariş verdikten sonra istemeniz hâlinde kendi siparişlerinizin durumuna ilişkin anlık bildirimlerin (push) cihazınızda gösterilmesi için kullanılır. Hatırlatmalar cihazınızda planlanır. Sipariş durumu bildirimleri için uygulama cihazınıza özgü bildirim jetonunu sunucumuza gönderir; bu jeton çerez değildir, tarayıcıda tutulmaz ve ölçüm veya pazarlama amacıyla kullanılmaz. Bildirim iznini cihaz ayarlarından her zaman kapatabilirsiniz. |
| Çerez Politikası §17, tablo, yeni satır | (yoktu) | Anahtar: Expo, Apple Push Notification service ve Firebase Cloud Messaging (mobil uygulama sipariş bildirimleri). Değer: Kategori: çerez değildir. Mobil uygulamada, izin vermeniz hâlinde, siparişinizin durumuna ilişkin anlık bildirimlerin cihazınıza iletilmesi: bildirim Expo'nun anlık bildirim hizmeti (650 Industries, Inc., ABD) üzerinden iOS cihazlarda Apple Push Notification service (Apple Inc.), Android cihazlarda Firebase Cloud Messaging (Google LLC) aracılığıyla ulaştırılır. Sitede veya uygulamada çerez yerleştirmez; bu hizmetlere yalnızca cihazınıza özgü bildirim jetonu ile sipariş numarasını ve aşamayı içeren bildirim iletilir. |
| Ticari Elektronik İleti ve İYS Aydınlatması §1, tanım 'Uygulama hatırlatması' | kampanya iletileri onayınıza bağlıdır. Mobil uygulamaya sunucudan anlık bildirim (push) gönderilmez. | kampanya iletileri onayınıza bağlıdır. Mobil uygulamaya sunucudan pazarlama içerikli anlık bildirim (push) gönderilmez; izin vermeniz hâlinde yalnızca kendi siparişlerinizin durumuna ilişkin işlemsel anlık bildirimler gönderilir. |
| Ticari Elektronik İleti ve İYS Aydınlatması §3, kanal tablosu 'Mobil uygulama anlık bildirimi (push)' | Kullanılmıyor - uygulamaya sunucudan anlık bildirim gönderilmez | Ticari ileti için kullanılmıyor - uygulamaya sunucudan yalnızca, izin vermeniz hâlinde, kendi siparişlerinizin durumuna ilişkin işlemsel anlık bildirim gönderilir (4. bölüm) |
| Ticari Elektronik İleti ve İYS Aydınlatması §4, 2. paragraf | Bildirimler e-posta ile ya da mobil uygulamayı kullanıyorsanız uygulama içindeki bildirim listesinde iletilir; uygulamaya sunucudan anlık bildirim (push) gönderilmez. | Bildirimler e-posta ile ya da mobil uygulamayı kullanıyorsanız uygulama içindeki bildirim listesinde iletilir; izin vermeniz hâlinde siparişinizin durumuna ilişkin bildirimler ayrıca telefonunuza anlık bildirim (push) olarak gönderilir. |
| Ticari Elektronik İleti ve İYS Aydınlatması §4, liste, yeni 6. madde | (yoktu) | Gel-al siparişinizin hazır olduğunu bildiren e-posta; yalnızca bu bilgi telefonunuza anlık bildirim olarak ulaştırılamadığında ve sipariş durumu tercihinizi kapatmadıysanız, sipariş başına bir kez gönderilir. |
| Ticari Elektronik İleti ve İYS Aydınlatması §7 | Mobil uygulamaya sunucudan anlık bildirim (push) gönderilmez. Uygulamadaki günlük hatırlatmalar | Mobil uygulamaya sunucudan pazarlama içerikli anlık bildirim (push) gönderilmez; izin vermeniz hâlinde gönderilen sipariş durumu bildirimleri işlemseldir ve bu onayın kapsamı dışındadır. Uygulamadaki günlük hatırlatmalar |
| Ticari Elektronik İleti ve İYS Aydınlatması §12, 2. paragraf (ilk cümle) | Mobil uygulamaya sunucudan anlık bildirim (push) gönderilmez ve uygulama sunucuya anlık bildirim tokeni göndermez. | Mobil uygulamaya sunucudan pazarlama içerikli anlık bildirim (push) gönderilmez; uygulama sunucuya yalnızca, sipariş durumu bildirimlerine izin vermeniz hâlinde, cihazınıza özgü bildirim jetonunu gönderir ve bu jeton yalnızca kendi siparişlerinizin durumunu bildirmek için kullanılır. |
| Ticari Elektronik İleti ve İYS Aydınlatması §12, 2. paragraf (son cümle) | Sunucudan anlık bildirim ileride sunulursa, tanıtım içerikli olanlar için ayrıca onayınız alınır ve bu metin güncellenir. | Tanıtım içerikli anlık bildirim ileride sunulursa, bunun için ayrıca onayınız alınır ve bu metin güncellenir. |
| Ticari Elektronik İleti ve İYS Aydınlatması §12, cihaz bildirim izni | yalnızca hatırlatmaları veya kafenin açılışında haber verilmesini kendiniz istediğinizde cihazınızın işletim sistemi tarafından sorulur; | yalnızca hatırlatmaları, kafenin açılışında haber verilmesini veya siparişinizi verdikten sonra siparişinizin durumunun bildirilmesini kendiniz istediğinizde cihazınızın işletim sistemi tarafından sorulur; |
| Ticari Elektronik İleti ve İYS Aydınlatması §12, uygulamanın kaldırılması | hatırlatmalar sunucuda tutulmadığından tarafımızda silinecek bir bildirim kaydı bulunmaz. | hatırlatmalar sunucuda tutulmaz. Sipariş durumu bildirimleri için sunucuda tutulan bildirim jetonu, uygulamada oturumu kapattığınızda hemen; uygulamayı oturumu kapatmadan kaldırdıysanız Apple veya Google jetonun artık bir cihaza ulaşmadığını bildirdiğinde, en geç ise uygulama jetonu 180 gün boyunca yenilemezse periyodik imhada silinir. |
| Ticari Elektronik İleti ve İYS Aydınlatması §12, hatırlatmalar | Hatırlatmalar cihazınızda planlanır; uygulama sunucuya anlık bildirim (push) tokeni göndermez ve sunucudan anlık bildirim gönderilmez. Bildirim tercihleriniz hesabınızda, hatırlatma tercihiniz ise yalnızca cihazınızda tutulur. | Hatırlatmalar cihazınızda planlanır; sunucudan yalnızca, izin vermeniz hâlinde, sipariş durumu anlık bildirimleri gönderilir. Bildirim tercihleriniz (sipariş durumu tercihi dâhil) hesabınızda, hatırlatma tercihiniz ise yalnızca cihazınızda tutulur. |
| Ticari Elektronik İleti ve İYS Aydınlatması §12, izinler | bildirim izni yalnızca sizin açtığınız hatırlatmaların ve kafenin açılışında haber verilmesini istemeniz hâlinde bu bildirimin cihazınızda gösterilmesi için; | bildirim izni yalnızca sizin açtığınız hatırlatmaların, kafenin açılışında haber verilmesini istemeniz hâlinde bu bildirimin ve siparişinizi verdikten sonra istemeniz hâlinde siparişinizin durumuna ilişkin anlık bildirimlerin cihazınızda gösterilmesi için; |
| Ticari Elektronik İleti ve İYS Aydınlatması §15 | Uygulama reklam tanımlayıcısı, anlık bildirim (push) tokeni, konum, çökme kaydı veya ekran ve tıklama kaydı toplamaz; | Uygulama reklam tanımlayıcısı, konum, çökme kaydı veya ekran ve tıklama kaydı toplamaz; sipariş durumu bildirimleri için alınan bildirim jetonu ticari ileti süreçlerinde kullanılmaz; |
| Ticari Elektronik İleti ve İYS Aydınlatması §19, tablo 'Uygulama hatırlatmaları' | Uygulama hatırlatmaları: Hatırlatmalar cihazınızda planlanır ve gösterilir; sunucudan anlık bildirim (push) gönderilmediğinden Apple veya Google bildirim servislerine bildirim tokeni ya da bildirim içeriği aktarılmaz | Uygulama hatırlatmaları ve sipariş bildirimleri: Hatırlatmalar cihazınızda planlanır ve gösterilir. Ticari ileti anlık bildirim (push) olarak gönderilmez; yalnızca izin vermeniz hâlinde gönderilen işlemsel sipariş durumu bildirimleri için cihazınıza özgü bildirim jetonu ve bildirim içeriği (sipariş numarası ve aşama) Expo'nun anlık bildirim hizmeti (650 Industries, Inc., ABD) ile Apple Push Notification service (Apple Inc., ABD) veya Firebase Cloud Messaging (Google LLC, ABD) üzerinden cihazınıza iletilir; bu jeton ticari ileti gönderiminde kullanılmaz |
| Ticari Elektronik İleti ve İYS Aydınlatması §20 | Mobil uygulama reklam tanımlayıcısına, anlık bildirim (push) tokenine veya konum bilgisine erişmez; | Mobil uygulama reklam tanımlayıcısına veya konum bilgisine erişmez; sipariş durumu bildirimleri için alınan bildirim jetonu pazarlama amacıyla kullanılmaz; |
| Kullanım Şartları §5, 'Cihaz izinleri - bildirim' | Cihaz izinleri - bildirim: Bildirim izni, uygulamanın ilk açılışında değil, yalnızca hatırlatmaları veya kafenin açılışında haber verilmesini siz istediğinizde istenir; Mobil Uygulamaya sunucudan anlık bildirim (push) gönderilmez. | Cihaz izinleri - bildirim: Bildirim izni, uygulamanın ilk açılışında değil, yalnızca hatırlatmaları, kafenin açılışında haber verilmesini veya siparişinizi verdikten sonra siparişinizin durumunun bildirilmesini siz istediğinizde istenir; Mobil Uygulamaya sunucudan yalnızca, izin vermeniz hâlinde, kendi siparişlerinizin durumuna ilişkin anlık bildirimler (push) gönderilir. |
| Kullanım Şartları §11, altyapı | E-posta gönderimi Resend altyapısı, ödeme işlemleri ise PayNkolay altyapısı üzerinden gerçekleştirilir. | E-posta gönderimi Resend altyapısı, Mobil Uygulamaya sipariş durumu anlık bildirimlerinin iletimi Expo ile Apple ve Google bildirim servisleri, ödeme işlemleri ise PayNkolay altyapısı üzerinden gerçekleştirilir. |
| Kullanım Şartları §19, mobil uygulama verisi | Mobil Uygulama reklam tanımlayıcısına (IDFA/AAID) erişmez, izleme izni istemez; anlık bildirim (push) tokeni, konum, çökme ve kullanım kaydı toplamaz. | Mobil Uygulama reklam tanımlayıcısına (IDFA/AAID) erişmez, izleme izni istemez; konum, çökme ve kullanım kaydı toplamaz; anlık bildirim (push) jetonunu yalnızca sipariş durumu bildirimlerine izin vermeniz hâlinde sunucumuza gönderir. |
| Kullanım Şartları §19, ticari ileti | aynı onay rejimine tabidir; Mobil Uygulamaya sunucudan anlık bildirim (push) gönderilmez. | aynı onay rejimine tabidir; Mobil Uygulamaya sunucudan pazarlama içerikli anlık bildirim (push) gönderilmez, izin vermeniz hâlinde gönderilen sipariş durumu bildirimleri ise işlemseldir ve bu onaya tabi değildir. |
| Üyelik Sözleşmesi §11, 'Bildirim izni' | Bildirim izni: yalnızca Üye'nin Uygulama'da kendi açtığı, cihazda planlanan hatırlatmaların gösterilmesi için istenir; sunucudan anlık bildirim (push) gönderilmez. | Bildirim izni: yalnızca Üye'nin Uygulama'da kendi açtığı, cihazda planlanan hatırlatmaların ve Üye'nin sipariş verdikten sonra istemesi hâlinde kendi siparişlerinin durumuna ilişkin anlık bildirimlerin (push) gösterilmesi için istenir; sunucudan pazarlama içerikli anlık bildirim gönderilmez. |
| Üyelik Sözleşmesi §15 | Mobil Uygulama'daki hatırlatmalar cihazda planlandığından, sunucuda push bildirim tokeni veya cihaz eşleşme kaydı tutulmaz. | Mobil Uygulama'daki hatırlatmalar cihazda planlanır ve sunucuda tutulmaz; Üye'nin sipariş durumu bildirimleri için sunucuda tutulan bildirim jetonları hesap kapatıldığında hemen silinir. |
| Üyelik Sözleşmesi §17, işlem güvenliği | Uygulama; reklam tanımlayıcısı (IDFA/AAID), konum ve anlık bildirim (push) tokeni işlemez; hatırlatmalar cihazda planlanır ve sunucuya bildirilmez. | Uygulama; reklam tanımlayıcısı (IDFA/AAID) ve konum işlemez; hatırlatmalar cihazda planlanır ve sunucuya bildirilmez. Üye sipariş durumu bildirimlerine izin verirse cihaza özgü bildirim jetonu, üyelik e-posta adresi, cihazın platformu ve jetonun kaydedildiği ve yenilendiği zaman işlenir. |
| Üyelik Sözleşmesi §17, yurt dışı | işlemsel e-posta (Resend) ve ödeme (PayNkolay) hizmetleri nedeniyle kişisel verilerin yurt dışında bulunan sunuculara aktarılması söz konusu olabilir. | işlemsel e-posta (Resend), anlık bildirim (Expo ile Apple ve Google bildirim servisleri) ve ödeme (PayNkolay) hizmetleri nedeniyle kişisel verilerin yurt dışında bulunan sunuculara aktarılması söz konusu olabilir. |
| Üyelik Sözleşmesi §17, bildirimler | Mobil Uygulama sunucudan cihaza anlık bildirim (push) göndermez. Uygulamada gösterilen hatırlatmalar | Şirket, Üye'nin izin vermesi hâlinde yalnızca Üye'nin kendi siparişlerinin durumuna ilişkin işlemsel anlık bildirimleri (push) sunucudan cihaza gönderir; pazarlama içerikli anlık bildirim gönderilmez. Uygulamada gösterilen hatırlatmalar |
| Üyelik Sözleşmesi §17, cihaz düzeyinde bildirim izni | Cihaz düzeyinde bildirim izninin kapatılması, Uygulama'nın cihazda planladığı hatırlatmaları durdurur; | Cihaz düzeyinde bildirim izninin kapatılması, Uygulama'nın cihazda planladığı hatırlatmaları ve sipariş durumu anlık bildirimlerini durdurur; |
| Üyelik Sözleşmesi §20, sağlayıcı arızaları | işlemsel e-posta (Resend) veya ödeme (PayNkolay) altyapısı sağlayıcılarında | işlemsel e-posta (Resend), anlık bildirim (Expo ile Apple ve Google bildirim servisleri) veya ödeme (PayNkolay) altyapısı sağlayıcılarında |
| Hesap Silme ve Üyelik Sonlandırma Prosedürü §5, yeni madde | (yoktu) | Mobil uygulamanın bildirim jetonları: sipariş durumu bildirimleri için kayıtlı cihazlarınızın bildirim jetonları silinir. |
| Mobil Uygulama Kullanım Koşulları §9, 1. paragraf | bildirim izni (hatırlatmalar için), | bildirim izni (hatırlatmalar ve Kullanıcı'nın istediği sipariş durumu bildirimleri için), |
| Mobil Uygulama Kullanım Koşulları §9, tablo 'Bildirim izni' | Kullanıcı hatırlatmaları açtığında veya kafenin açılışında bildirim istediğinde istenir; bu bildirimlerin cihazda gösterilebilmesi içindir. Bildirimler cihazda planlanır, sunucudan gönderilmez | Kullanıcı hatırlatmaları açtığında, kafenin açılışında bildirim istediğinde veya sipariş verdikten sonra siparişinin hazır olunca haber verilmesini istediğinde istenir; bu bildirimlerin cihazda gösterilebilmesi içindir. Hatırlatmalar cihazda planlanır ve sunucudan gönderilmez; sipariş durumu bildirimleri sunucudan gönderilir (10. madde) |
| Mobil Uygulama Kullanım Koşulları §9, tablo 'Anlık bildirim (push) tokeni' | Anlık bildirim (push) tokeni: İşlenmez - Uygulama sunucudan anlık bildirim göndermez, bu nedenle cihaza ait bir gönderim adresi saklanmaz | Anlık bildirim (push) jetonu: Yalnızca Kullanıcı sipariş durumu bildirimlerine izin verdiğinde işlenir - Expo'dan alınan cihaza özgü jeton, Üye'nin e-posta adresi, cihazın platformu ve jetonun kaydedildiği ve en son yenilendiği zamanla sunucuda tutulur; yalnızca Kullanıcı'nın kendi siparişlerinin durumuna ilişkin bildirimler için kullanılır (10. madde) |
| Mobil Uygulama Kullanım Koşulları §10, 1. paragraf | Uygulama, sunucudan cihaza anlık bildirim (push) göndermez. Cihazda gösterilen bildirimler, Kullanıcı'nın | Uygulama'ya sunucudan yalnızca, Kullanıcı'nın izin vermesi hâlinde, Kullanıcı'nın kendi siparişlerinin durumuna ilişkin işlemsel anlık bildirimler (push) gönderilir; bunların kapsamı aşağıdaki paragrafta açıklanmıştır ve pazarlama içerikli anlık bildirim gönderilmez. Cihazda gösterilen diğer bildirimler, Kullanıcı'nın |
| Mobil Uygulama Kullanım Koşulları §10, yeni 2. paragraf | (yoktu) | Sipariş durumu bildirimleri: Uygulama bildirim iznini ilk açılışta istemez; Kullanıcı sipariş verdikten sonra ödeme sonucu ve sipariş takip ekranlarında 'Siparişin hazır olunca haber verelim mi?' seçeneğini sunar ve işletim sisteminin izni yalnızca Kullanıcı bu seçeneğe dokunduğunda istenir. İzin verilirse Uygulama, anlık bildirim hizmeti Expo'dan (650 Industries, Inc., ABD) cihaza özgü bildirim jetonunu alır ve oturum açılmış üyelik hesabı üzerinden Şirket sunucusuna gönderir. Bildirim yalnızca şu aşamalarda gönderilir: kafe siparişinin hazırlanmaya başlaması, gel-al siparişinin tezgâhta hazır olması, kurye siparişinin kuryeyle yola çıkması, online mağaza siparişinin kargoya verilmesi ve ödenmiş bir siparişin iptal edilmesi. Ödeme onayı e-postayla iletilir; siparişin masaya getirilmesi ve kasada girilen siparişler için anlık bildirim gönderilmez. Bildirim yalnızca sipariş numarasını ve aşamayı içerir; ad, adres, telefon, ürün ve tutar bilgisi yazılmaz. Bildirim, Expo üzerinden iOS cihazlarda Apple Push Notification service, Android cihazlarda Firebase Cloud Messaging aracılığıyla cihaza ulaştırılır. Kullanıcı bu bildirimleri Uygulama'daki Bildirimler ekranında veya internet sitesindeki hesabının Bildirim tercihleri sayfasında sipariş durumu tercihini kapatarak ya da cihazın bildirim ayarlarından durdurabilir; sipariş aşamaları Uygulama içindeki bildirim kutusunda görünmeye devam eder. Gel-al siparişi hazır olduğunda bu bildirim Kullanıcı'nın hiçbir cihazına ulaştırılamamışsa ve sipariş durumu tercihi kapatılmamışsa, siparişin e-posta adresine bir kez 'Siparişin hazır' e-postası gönderilir. Bu bildirimler ve e-posta işlemseldir; ticari elektronik ileti sayılmaz. Jeton, Kullanıcı Uygulama'da oturumu kapattığında, üyelik hesabı kapatıldığında veya silindiğinde ya da Apple veya Google jetonun artık bir cihaza ulaşmadığını bildirdiğinde hemen, Uygulama jetonu 180 gün boyunca yenilemezse periyodik imhada silinir. |
| Mobil Uygulama Kullanım Koşulları §10, son paragraf | Cihazın işletim sistemi ayarlarından bildirimlerin kapatılması yalnızca hatırlatmaları durdurur; | Cihazın işletim sistemi ayarlarından bildirimlerin kapatılması hatırlatmaları ve sipariş durumu anlık bildirimlerini durdurur; |
| Mobil Uygulama Kullanım Koşulları §10, örnekler | İşlemsel e-posta örnekleri: ödeme onaylandı (sipariş özeti ve sözleşme bağlantılarıyla), şifre sıfırlama, e-posta doğrulama. | (yeni madde) Anlık bildirim (push) örnekleri: kafe siparişinin hazırlanmaya başladığı, gel-al siparişinin hazır olduğu, kurye siparişinin yola çıktığı, mağaza siparişinin kargoya verildiği ve ödenmiş siparişin iptal edildiği bildirimi; yalnızca Kullanıcı izin verdiyse gönderilir. / İşlemsel e-posta örnekleri: ödeme onaylandı (sipariş özeti ve sözleşme bağlantılarıyla), gel-al siparişi hazır (telefon bildirimi ulaştırılamadığında), şifre sıfırlama, e-posta doğrulama. |
| Mobil Uygulama Kullanım Koşulları §16, 2. paragraf | işlemsel e-postalar Resend üzerinden gönderilmekte; ödeme işlemleri N Kolay | işlemsel e-postalar Resend üzerinden gönderilmekte; sipariş durumu anlık bildirimleri Expo'nun anlık bildirim hizmeti (650 Industries, Inc.) üzerinden Apple Push Notification service (Apple Inc.) ve Firebase Cloud Messaging (Google LLC) aracılığıyla iletilmekte; ödeme işlemleri N Kolay |
| Mobil Uygulama Kullanım Koşulları §16, 1. madde | Hatırlatmalar, işletim sisteminin kendi yerel bildirim zamanlayıcısıyla gösterilir; üçüncü taraf bir anlık bildirim (push) servisi kullanılmaz ve cihaza ait bir gönderim tokeni işlenmez. | Hatırlatmalar, işletim sisteminin kendi yerel bildirim zamanlayıcısıyla gösterilir ve bunlar için üçüncü taraf bir anlık bildirim (push) servisi kullanılmaz. Sipariş durumu bildirimleri için Uygulama, Expo'nun bildirim kütüphanesiyle cihaza özgü bildirim jetonunu yalnızca Kullanıcı izin verdiğinde alır ve Şirket sunucusuna iletir; bildirim Expo'nun anlık bildirim hizmeti üzerinden Apple Push Notification service veya Firebase Cloud Messaging aracılığıyla cihaza ulaşır. |
| Mobil Uygulama Kullanım Koşulları §21, 2. paragraf | ile isteklerin sunucuya ulaşmasıyla oluşan işlem güvenliği kayıtları (IP adresi, cihazın işletim sisteminin eklediği istemci bilgisi, istek zamanı) işlenir. | ile isteklerin sunucuya ulaşmasıyla oluşan işlem güvenliği kayıtları (IP adresi, cihazın işletim sisteminin eklediği istemci bilgisi, istek zamanı) ve Kullanıcı sipariş durumu bildirimlerine izin verdiyse cihaza özgü bildirim jetonu ile cihazın platformu işlenir. |
| Mobil Uygulama Kullanım Koşulları §21, 3. paragraf | Uygulama; reklam tanımlayıcısı (IDFA/AAID), anlık bildirim (push) tokeni, konum, mikrofon, rehber ve çökme (crash) kaydı işlemez. | Uygulama; reklam tanımlayıcısı (IDFA/AAID), konum, mikrofon, rehber ve çökme (crash) kaydı işlemez; anlık bildirim (push) jetonunu yalnızca Kullanıcı sipariş durumu bildirimlerine izin verdiğinde işler (9. ve 10. madde). |
| Fikri Mülkiyet ve Telif Hakları §13, tablo | Uygulamadaki hatırlatmalar cihazın işletim sisteminin yerel bildirim özelliğiyle gösterilir; sunucudan anlık bildirim (push) gönderilmez. İşletim sistemlerinin ve markalarının hakları sağlayıcılarına aittir | Uygulamadaki hatırlatmalar cihazın işletim sisteminin yerel bildirim özelliğiyle gösterilir; sipariş durumu anlık bildirimleri (push) Expo anlık bildirim hizmeti ile Apple Push Notification service ve Firebase Cloud Messaging üzerinden iletilir. İşletim sistemlerinin, bu hizmetlerin ve markalarının hakları sağlayıcılarına aittir |
| Şirket ve İletişim Bilgileri §6, madde | Mobil uygulama, reklam tanımlayıcısına (IDFA/AAID), konuma veya mikrofona erişmez; bildirim tokeni ile çökme kaydı toplamaz ve sunucudan anlık bildirim (push) göndermez. | Mobil uygulama, reklam tanımlayıcısına (IDFA/AAID), konuma veya mikrofona erişmez ve çökme kaydı toplamaz; uygulamaya sunucudan yalnızca, kullanıcının izin vermesi hâlinde, kendi siparişlerinin durumuna ilişkin anlık bildirimler (push) gönderilir ve bu amaçla cihaza özgü bildirim jetonu sunucuda tutulur. |
| Şirket ve İletişim Bilgileri §6, tablo, yeni satır | (yoktu) | Anahtar: Mobil uygulama anlık bildirimleri. Değer: Expo (650 Industries, Inc.) - izin verilmesi hâlinde sipariş durumu bildirimlerinin Apple Push Notification service (Apple Inc.) veya Firebase Cloud Messaging (Google LLC) üzerinden cihaza iletilmesi |
| Şirket ve İletişim Bilgileri §11 | Mobil uygulama sunucudan anlık bildirim (push) göndermez; uygulamadaki hatırlatmalar cihazınızda planlanır, | Mobil uygulamaya sunucudan yalnızca, izin vermeniz hâlinde, siparişinizin durumuna ilişkin anlık bildirimler (push) gönderilir; uygulamadaki hatırlatmalar cihazınızda planlanır, |
| Şikâyet ve Uyuşmazlık Çözümü §11, cihaz izinleri | hatırlatmaların gösterilmesi için bildirim izni, | hatırlatmaların ve istemeniz hâlinde sipariş durumu bildirimlerinin gösterilmesi için bildirim izni, |
| Şikâyet ve Uyuşmazlık Çözümü §11, 'Bildirimler' | Bildirimler: Uygulamadaki hatırlatmalar cihazınızda planlanır ve sunucudan anlık bildirim (push) gönderilmez; bu hatırlatmaları cihaz ayarlarından ve uygulama içi bildirim tercihlerinden kapatabilirsiniz. | Bildirimler: Uygulamadaki hatırlatmalar cihazınızda planlanır; sunucudan yalnızca, izin vermeniz hâlinde, siparişinizin durumuna ilişkin anlık bildirimler (push) gönderilir. Bu hatırlatmaları ve bildirimleri cihaz ayarlarından ve uygulama içi bildirim tercihlerinden kapatabilirsiniz. |
| Şikâyet ve Uyuşmazlık Çözümü §13, yurt dışı | Barındırma (Vercel), veri tabanı - {{DB_PROVIDER}} (PostgreSQL) - ve işlemsel e-posta (Resend) hizmetleri ile | Barındırma (Vercel), veri tabanı - {{DB_PROVIDER}} (PostgreSQL) -, işlemsel e-posta (Resend) ve anlık bildirim (Expo ile Apple ve Google bildirim servisleri) hizmetleri ile |
| Şikâyet ve Uyuşmazlık Çözümü §13, mobil uygulama | Mobil uygulama, reklam tanımlayıcısına (IDFA/AAID) ve konuma erişmez; anlık bildirim (push) tokeni ile çökme kaydı toplamaz. | Mobil uygulama, reklam tanımlayıcısına (IDFA/AAID) ve konuma erişmez ve çökme kaydı toplamaz; anlık bildirim (push) jetonu yalnızca sipariş durumu bildirimlerine izin vermeniz hâlinde işlenir. |
| Şikâyet ve Uyuşmazlık Çözümü §14 | Mobil uygulama sunucudan anlık bildirim (push) göndermez; uygulamadaki hatırlatmalar cihazınızda planlanır. Tanıtım, | Mobil uygulamaya sunucudan tanıtım içerikli anlık bildirim (push) gönderilmez; yalnızca izin vermeniz hâlinde siparişinizin durumuna ilişkin işlemsel anlık bildirimler gönderilir ve uygulamadaki hatırlatmalar cihazınızda planlanır. Tanıtım, |
| Şikâyet ve Uyuşmazlık Çözümü §14, kapatma | Hatırlatmaları cihazınızın bildirim ayarlarından veya uygulama içi bildirim tercihlerinizden kapatabilirsiniz; | Hatırlatmaları ve sipariş durumu bildirimlerini cihazınızın bildirim ayarlarından veya uygulama içi bildirim tercihlerinizden kapatabilirsiniz; |
| Kafe Hizmet Koşulları §8, bildirimler | Uygulama sunucudan anlık bildirim (push) göndermez; kampanya ve duyurular uygulama içinde gösterilir. | Uygulamaya sunucudan yalnızca, izin vermeniz hâlinde, siparişinizin durumuna ilişkin işlemsel anlık bildirimler (push) gönderilir; kampanya ve duyurular anlık bildirim olarak gönderilmez, uygulama içinde gösterilir. |
| Kafe Hizmet Koşulları §8, mobil uygulama verisi | anlık bildirim (push) tokeni oluşturmaz ve sunucuya göndermez; konum bilgisi almaz; | anlık bildirim (push) jetonunu yalnızca sipariş durumu bildirimlerine izin vermeniz hâlinde sunucuya gönderir; konum bilgisi almaz; |
| Kafe Hizmet Koşulları §8, 'Bildirim izni' | Bildirim izni: yalnızca uygulamada kendi açtığınız hatırlatmaların cihazda gösterilmesi. Uygulama sunucudan anlık bildirim göndermez. | Bildirim izni: yalnızca uygulamada kendi açtığınız hatırlatmaların ve sipariş verdikten sonra istemeniz hâlinde siparişinizin durumuna ilişkin anlık bildirimlerin cihazda gösterilmesi. Sunucudan pazarlama içerikli anlık bildirim gönderilmez. |

### 30.4 Sürüm

- `LEGAL_UPDATED` 20 Ekim 2026'dan **22 Ekim 2026**'ya: Ön Bilgilendirme
  Formu (§17, §19) ve Mesafeli Satış Sözleşmesi (§16) değişti, ödeme
  onayının kaydettiği sürüm taşınır (`meta.ts`, `CHECKOUT_CONSENT_DOCS`).
  Onay ayrıca metnin özetini (`textHashes`) kaydettiği için aynı günün başka
  bir etiket taşıyıcısıyla karışmaz (§25).
- 21 Ekim 2026'yı kendi tarihi olarak taşıyan on belge (İşlem Rehberi,
  Ödeme Koşulları, Gizlilik, KVKK Aydınlatma, Veri Saklama, Çerez, Üyelik,
  Sadakat Programı, Mobil Uygulama Koşulları, Kafe Hizmet Koşulları)
  yeni revizyondan önceki bir gün basamayacağı için (`tests/legal-dates.test.ts`)
  kendi tarihini bıraktı ve setin gününü okur. İşlem Rehberi ile Sadakat
  Programı'nın metni bu dalda değişmedi; yalnız basılan tarihleri 22 Ekim
  2026 oldu (20 Ekim'deki emsal, §24.4).
- `KARAOKE_LEGAL_UPDATED` değişmedi (21 Ekim 2026): karaoke sözleşmesinde
  push iddiası yok (`content-karaoke.ts` okundu).
- Testler: `legal-dates` (yeni etiket, beklenen tablo yalnız karaoke),
  `legal-consent-version` (etiketin gün sayısı), `legal-version-core`
  (tarih farkının özeti değiştirdiğini sınayan örnek 22'den 23 Ekim'e,
  çünkü 22 artık kodlanmış gün), `legal-karaoke-make-good` ve `mobile-legal`
  (Ödeme Koşulları ve Çerez'in tarihi artık `LEGAL_UPDATED`),
  `legal-kvkk-transfers` (Expo, Apple Inc. ve Google LLC alıcı satırında
  durumlarıyla; Google LLC yalnız bir kez ve yalnız FCM olarak; harita yok;
  Veri Saklama §14'te Google yalnız bildirim taşıyıcısı).

### 30.5 Bilerek değişmeyenler

- Satış Politikası §28 ("kampanya, indirim veya yeni ürün duyurusu içeren
  anlık bildirim (push) göndermez"), Açık Rıza §3 tanımı ve §8 R2 ("pazarlama
  içerikli anlık (push) bildirim bugün gönderilmemektedir"), R8 başlığı
  ("Yürütülmemektedir"), Açık Rıza §22 (push'a genişletme örneği): hâlâ
  doğru.
- Üyelik §7 ("şirket çalışanları ... push bildirim ... üzerinden şifre ...
  talep etmez"): doğru.
- İşlev listeleri ("... fA'L ve cihazda planlanan hatırlatmalar işlevlerini
  sunar"): sınırlayıcı değil, "yalnızca" demiyor.
- Çerez Politikası §18: çerezle yapılan aktarımı anlatır; push çerez
  değildir, §17'ye satır eklendi.
- İYS ve e-Arşiv cümleleri (paralel dallar §30, §31): dokunulmadı; Ticari
  Elektronik İleti metninde yalnız push iddiası taşıyan cümleler değişti.
- Hukuk metinlerinin hiçbiri köşk panelini anlatmıyor (§30.2 son madde).

### 30.6 Avukata ve operatöre (açık)

| # | Soru veya iş | Neden |
|---|---|---|
| Y15-1 | Expo (650 Industries, Inc.) ile veri işleme sözleşmesi (DPA) ve Kurul'un ilan ettiği Standart Sözleşme (veri sorumlusundan veri işleyene) Türkçe metniyle imzalanmalı; imzaların tamamlanmasından itibaren **beş iş günü** içinde Kurum'a bildirilmeli (KVKK m.9/5, Yönetmelik m.14/5). Metin bugün "imza sürecinde" diyor: operatör süreci gerçekten başlatmadıysa cümle yanlıştır. | m.9/4-c; diğer sağlayıcılarla aynı durum. |
| Y15-2 | **Apple (APNs) ve Google (FCM):** metin, talimat gereği bunları da "imza sürecinde" sayıyor. Apple ve Google'ın KVKK standart sözleşmesi imzalayıp imzalamayacağı bilinmiyor; Google'ın Türkçe standart sözleşmesi olmadığı için analitik etiketleri kaldırılmıştı (§15.6). Bu ayak bizim aktarımımız mı (APNs anahtarı ve FCM projesi bizim), Expo'nun alt işleyeni mi (o hâlde Expo ile veri işleyenden veri işleyene sözleşme yeterli mi), yoksa başka bir güvence mi? Güvence yoksa bu aktarım m.9 karşısında dayanaksızdır; fA'L'da olduğu gibi (§15) özelliğin canlıda açılması buna bağlanmalı mı? | m.9/4, m.9/6 (arızi değil, rızaya dayandırılamaz); Kurul İlke Kararı 2026/347. |
| Y15-3 | VERBİS kaydı güncellenmeli: yeni veri kategorisi (cihaz bildirim jetonu ve platform), alıcı grupları (Expo, Apple, Google), yabancı ülkelere aktarım, saklama süresi (180 gün tavanı). | Veri Sorumluları Sicili Yönetmeliği. |
| Y15-4 | Mağaza gizlilik beyanları (App Store "App Privacy", Google Play "Data safety") jetonu ve amacını (uygulama işlevi, sipariş bildirimi) yansıtacak şekilde güncellenmeli; lafmobil `docs/COMPLIANCE.md` ile eşitlenmeli. | Mağaza kuralları; metinle beyan çelişmemeli. |
| Y15-5 | Aydınlatma işlemeden önce yapılmalı: bu metinler, izni isteyen uygulama sürümü yayına girmeden yayımlanmalı; "Siparişin hazır olunca haber verelim mi?" ekranından KVKK Aydınlatma §12'ye bağlantı verilmesi önerilir (lafmobil işi). | Aydınlatma Tebliği m.5/1-b. |
| Y15-6 | Hukuki sebep olarak KVKK m.5/2-c seçildi; işletim sisteminin izni metinde "seçiminiz" olarak geçer, açık rıza olarak sunulmaz. Uygun mu, yoksa m.5/2-f (meşru menfaat) ayrıca anılmalı mı? | Kurul'un "rıza istenmemesi gereken yerde rıza istenmez" yaklaşımı (Açık Rıza §5). |
| Y15-7 | "Siparişin hazır" e-postası işlemsel sayıldı (6563 s. Kanun m.6; Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik m.7, onay aranmayan hâller: devam eden sipariş ilişkisine dair bilgilendirme; madde ve fıkra numarası avukatça doğrulanmalı) ve ret bağlantısı taşımaz. Teyit. | Kural 19; yanıltıcı ret bağlantısı konmaz. |
| Y15-8 | Expo'nun kendi saklama süreleri (bildirim ve teslim kayıtları, sunucu günlükleri) DPA'dan doğrulanmalı; metin yalnız bizim tuttuğumuz teslim sonuçları için 24 saat ve bildirimin geçerlilik süresi için en çok 24 saat diyor, sağlayıcıların kendi kayıtlarını kendi koşullarına bırakıyor. | KVKK m.10 saklama bilgisinin doğruluğu. |
| Y15-9 | Operatör: lafmobil'in çevrimdışı hukuk kopyası `npm run legal:export -- <lafmobil>/src/data/legal.seed.json` ile yenilenmeli (onay sürümü 22 Ekim 2026). | §2 adım 5. |
| Y15-10 | Sitedeki `/uye/hesap/bildirimler` tercihi "Sipariş güncellemeleri" adını ve "Sipariş alındı, kargoya verildi, teslim edildi e-postaları." açıklamasını taşıyor; metinler onu "sipariş durumu tercihi" diye anıyor ve telefon bildirimlerini ve "Siparişin hazır" e-postasını kapattığını söylüyor. Sitedeki etiketin uygulamadaki "Sipariş durumu" ile ve gerçek etkisiyle eşitlenmesi önerilir (ön yüz işi). | Metin ile ekran aynı şeyi söylemeli. |

### 30.7 Hukuki dayanak

| Konu | Dayanak | Karar |
|---|---|---|
| Aydınlatmanın doğruluğu ve zamanı | 6698 s. KVKK m.10; Aydınlatma Tebliği m.4, m.5 | "Jeton işlenmez / push yok" cümleleri kaldırıldı; veri, amaç, alıcı, aktarım ve saklama işlemeden önce yazıldı. |
| İşleme şartı | KVKK m.5/2-c | Sipariş durumunun bildirilmesi sözleşmenin ifasıyla doğrudan ilgili; izin işletim sisteminde üyenin seçimi. |
| Yurt dışına aktarım | KVKK m.9/4-c, m.9/5; Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik m.14 | Expo, Apple, Google alıcı olarak adlandırıldı; standart sözleşmeye "dayandırılacaktır", "imza sürecinde"; rızaya dayandırılmaz (arızi değil). |
| Ticari ileti ayrımı | 6563 s. Kanun m.6; Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik m.7 (onay aranmayan hâller) | Push ve "Siparişin hazır" e-postası işlemsel; pazarlama push'u yok, R8 rızası istenmez. |
| Saklama ve imha | KVKK m.7; Silme, Yok Etme veya Anonim Hale Getirme Yönetmeliği | Jeton olay anında silinir; 180 gün tavanı periyodik imhada; teslim sonuçları 24 saat. |

## 31. Y16 - İYS: onaylar 3 iş günü içinde İYS'ye, gönderim yalnız İYS'de kayıtlı onaya (22 Ekim 2026)

> **Durum: kodda değişti.** Dal `work/iys`. Metinler İYS'yi anlatıyordu ama
> hiçbir kod İYS'ye kayıt yapmıyor, ret bildirmiyor ya da İYS'yi kontrol
> etmiyordu (docs/AUDIT.md, "Kampanya e-postası İYS'ye bağlı değil"). Artık
> yapıyor (docs/IYS.md); metinler bunun gerçek hâline, özellikle sürelere
> göre düzeltildi. Yalnız gerçeğe uymayan ya da süresi belirsiz kalan
> cümleler değişti. Ödeme belgelerinin (ÖBF, MSS) İYS cümlesi ("bu onayı
> İYS'ye kaydeder") artık doğru, onlar değişmedi. Değişen dört belge aynı
> gün §30'un taşıdığı **22 Ekim 2026** tarihini okur; İYS Aydınlatması bu
> tarihi kendi sabitiyle taşır (§31.4). Avukat okuması bekler.

### 31.1 Neden

- Yönetmelik (Ticari İletişim ve Ticari Elektronik İletiler Hakkında
  Yönetmelik, 2020 değişikliği): İYS dışında alınan onay 3 iş günü içinde
  İYS'ye kaydedilir, kaydedilmeyen onaya dayanılamaz; hizmet sağlayıcıya
  ulaşan ret 3 iş günü içinde gönderimi durdurur ve 3 iş günü içinde İYS'ye
  bildirilir; alıcı reddi İYS üzerinden de yapabilir.
- 250.000'den az adresi olan hizmet sağlayıcı İYS API'sini kendisi
  çağıramaz (entegratör ya da İYS Web'den elle yükleme). Operatörün
  entegratörü yok: aktarım bugün **elle**. Panel (`/admin/iys`) neyin, ne
  zamana kadar yükleneceğini söyler ve İYS'nin sütun sırasıyla dosyayı verir.
- Kod bunu kendisi zorlar: İYS'de kayıtlı olmayan adrese kampanya ve doğum
  günü e-postası gitmez (`campaign_email_audience`,
  `birthday_greeting_audience`); son İYS ret kontrolü 3 iş gününden eskiyse
  hiç ticari e-posta gitmez. Bize ulaşan ret sitede anında uygulanır,
  İYS'ye bildirimi elle yüklemeyle en geç 3 iş günü içinde yapılır. Bu
  yüzden "alındığı anda ... İYS kaydına işlenir" gibi cümleler süresiyle
  yazıldı.

### 31.2 Değişen cümleler

| Yer | Mevcut | Yeni | Neden |
|---|---|---|---|
| Satış Politikası §28, 5. paragraf | Her ticari iletide reddetme hakkınızı kolayca kullanabileceğiniz bir bağlantı bulunur; ret talebiniz gecikmeksizin işleme alınır ve İYS üzerinden de kaydedilir. | Her ticari iletide reddetme hakkınızı kolayca kullanabileceğiniz bir bağlantı bulunur; ret talebiniz gecikmeksizin işleme alınır ve en geç üç iş günü içinde İYS'ye de bildirilir. | "Gecikmeksizin" İYS kaydını da kapsıyor okunabiliyordu; İYS'ye bildirim elle ve 3 iş günü içinde. |
| Şikâyet ve Uyuşmazlık §14, 3. paragraf (son cümle) | Ret talebiniz alındığı anda uygulanır ve İYS kaydına işlenir. | Ret talebiniz alındığı anda uygulanır ve en geç üç iş günü içinde İYS kaydına işlenir. | İYS kaydı anında değil; aynı belgenin §6 tablosu zaten "hedef en geç 3 iş günü" diyor. |
| Mobil Uygulama Koşulları §17, 4. paragraf | ... adres defteri ve tercihler erişime kapatılır, ticari elektronik ileti onayı bulunuyorsa ret kaydı İYS üzerine işlenir. ... | ... adres defteri ve tercihler erişime kapatılır, İYS'ye kaydedilmiş bir ticari elektronik ileti onayı bulunuyorsa ret kaydı en geç üç iş günü içinde İYS üzerine işlenir. ... | İYS'ye henüz yüklenmemiş bir onayın reddi İYS'ye gönderilmez (yüklenecek onay iptal edilir); süre eklendi. (Bu cümle §19'da da alıntılanıyor; orası o günün kaydıdır.) |
| Ticari Elektronik İleti ve İYS Aydınlatması §9, 1. paragraf | ... onayın veya retin kaynağı, IP adresi, tarayıcı veya uygulama bilgisi, onay metni sürümü ve zamanıyla birlikte kayıt altına alınır. ... | ... onayın veya retin kaynağı, varsa IP adresi ile tarayıcı veya uygulama bilgisi, onay metni sürümü ve zamanıyla birlikte kayıt altına alınır. ... | İYS'den okunan bir retin (ve yönetici düzeltmesinin) kişiye ait IP'si ve tarayıcısı yoktur; kayıt bunları boş tutar. |
| Ticari Elektronik İleti ve İYS Aydınlatması §9, yeni 3. paragraf | (yoktu) | Sitemiz veya mobil uygulamamız üzerinden verdiğiniz onay, verildiği tarihten itibaren en geç üç iş günü içinde İYS'ye kaydedilir; İYS'ye kaydedilmemiş bir onaya dayanılarak ticari elektronik ileti gönderilmez. İletideki bağlantıdan veya hesabınızdaki iletişim tercihlerinden yaptığınız ret sistemimizde anında uygulanır; bize ulaşan her ret bildirimi, ulaştığı tarihten itibaren en geç üç iş günü içinde İYS'ye bildirilir. | Belgenin özeti onayın nasıl kayda alındığını anlatacağını söylüyor; İYS'ye kayıt ve bildirim süresi hiçbir yerde yazmıyordu. |
| Ticari Elektronik İleti ve İYS Aydınlatması §10, yeni 2. madde | (yoktu) | Gönderim listesine yalnızca onayı İYS'ye kaydedilmiş adresler alınır. Ticari elektronik ileti, İYS'deki kayıtlar son üç iş günü içinde kontrol edilmişse gönderilir; bu kontrolde İYS üzerinden yapıldığı görülen ret bildirimleri sistemimizde de ret olarak işlenir ve o adreslere ileti gönderilmez. | "Gönderim Öncesi Kontrol" bölümü İYS kontrolünü anlatmıyordu; kod artık bunu zorluyor. |

### 31.3 Bilerek değişmeyenler

Ek A'daki İYS cümlelerinin geri kalanı koda göre doğru oldu ve
değişmedi. Özellikle:

- MSS §16 ("onayını alır ve bu onayı İYS'ye kaydeder"), Teslimat §15 ("İYS
  kaydı zorunludur"), Satış Politikası §28 1. paragraf ("İYS'ye kaydedilerek
  yapılır"), Şirket Bilgileri §11 ve Şikâyet §14 1. paragraf (aynı), Kafe
  Hizmet §18: gönderim artık yalnız İYS'de kayıtlı onaya yapılıyor.
- Gizlilik §8 tablo ve §19, KVKK §14 tablo ve §20, Mobil §10 ve §24, Veri
  Saklama §6: İYS'ye işleme ve sorgulama yapılıyor ("mevzuatın gerektirdiği
  hâllerde" kalıbı korundu).
- KVKK Başvuru Formu §15 ("üç iş günü içinde gönderim durdurulur ve ret
  bildirimi İYS'ye iletilir"), Şikâyet §6 tablo ("hedef en geç 3 iş günü"),
  Açık Rıza §8: süreleriyle doğru.
- İYS Aydınlatması §8 ("Hizmet sağlayıcılar ... kaydetmek ve ... kontrol
  etmekle yükümlüdür"): mevzuatın tarifi; §9 2. paragraf ("İYS dâhil
  herhangi bir kanaldan ret ... öğrendiğimizde ... kendi kaydımız ret
  yönünde düzeltilir"): İYS listesinin yüklenmesiyle yapılıyor.
- İşlemsel iletiye ilişkin cümleler (İade ve Cayma §19, Teslimat §15):
  işlemsel e-posta İYS kapısından geçmez.

### 31.4 Sürüm

- Değişen belgeler: Ticari Elektronik İleti ve İYS Aydınlatması, Satış
  Politikası, Şikâyet ve Uyuşmazlık Çözümü, Mobil Uygulama Koşulları. Aynı
  gün §30 setin tarihini (`LEGAL_UPDATED`) **22 Ekim 2026**'ya taşıdığı için
  dördü de bu tarihi okur; bu bölüm `LEGAL_UPDATED`'ı ve
  `KARAOKE_LEGAL_UPDATED`'ı değiştirmez. Aynı günün iki metni karıştırılmaz:
  gösterilen her metin özetiyle saklanır (§25).
- İYS Aydınlatması tarihini kendi sabitiyle taşır ve bu tarih, her ticari
  ileti onayıyla kaydedilen metin sürümüdür (`COMMERCIAL_CONSENT_UPDATED`,
  `src/lib/legal/meta.ts`; `COMMERCIAL_CONSENT_TEXT_VERSION` =
  `ticari-elektronik-ileti@22 Ekim 2026`). Önceden sürüm `LEGAL_UPDATED`'ı
  izliyordu: belge yalnız kendisi değiştiğinde de sürüm artık değişir.
  Bilinen sınır: 22 Ekim 2026'da §30'un yayını ile bu bölümün yayını
  arasında verilen onaylar da aynı etiketi taşır (metin farkı yalnız İYS
  sürecini anlatan paragraflardadır, onayın kapsamı değişmedi); hangi
  metnin gösterildiği o günün saklanan metin özetinden okunur.
- `tests/legal-iys.test.ts` yeni cümleleri tutar ve eskilerin geri
  gelmesini engeller.

### 31.5 Operatöre

- **İYS kaydı.** Markanın İYS'ye kaydı (hs.iys.org.tr) ve günlük iş
  `docs/IYS.md`'de. Yayından sonra İYS'ye kaydedilmemiş hiçbir onaya ticari
  e-posta gitmez: mevcut onaylar "eski onay" olarak listelenir ve İYS onları
  3 iş günü sınırı yüzünden reddedebilir (H467).
- **E-postayla ya da telefonla gelen ret.** Aynı gün panelde işlenmeli
  (üyede Müşteriler → tercihler, abonede Aboneler → Pasifleştir): İYS
  bildiriminin 3 iş günlük süresi panelde işlendiği andan sayılır, yasal
  süre ise retin ulaştığı andan.
- **Uygulama.** lafmobil'in çevrimdışı kopyası `legal:export` ile
  güncellenir (Mobil Uygulama Koşulları ve İYS Aydınlatması değişti).

### 31.6 Avukata sorular

1. Üyenin onay tarihi olarak, onay kutusunun işaretlendiği an ile e-posta
   doğrulamasının daha geç olanı İYS'ye yükleniyor (bülten aboneliği zaten
   doğrulama anında tarihleniyor). Uygun mu?
2. Bu özellikten önce alınan ve İYS'ye hiç yüklenmemiş onaylar: İYS'nin
   reddettiği adresler yeniden onay verene kadar kampanya almaz. Yeniden
   onay istemenin izinli yolu (site ve uygulama içi çağrı; ilk iletinin
   onay istemek için gönderilmesi) nasıl olmalı?
3. Retin İYS'deki `source` değeri: bağlantıdan HS_EPOSTA, siteden HS_WEB,
   uygulamadan HS_MOBIL, yönetici kararıyla HS_KARAR seçildi. İYS'nin
   "kaynak sonradan değiştirilemez" kuralıyla çelişip çelişmediği İYS'ye
   sorulmalı.
4. İYS kontrolü (izin listesinin yüklenmesi ya da "yeni ret yok" beyanı) 3
   iş günü geçerli sayılıyor; tatiller sayılmıyor (süremiz hep yasal
   süreden kısa). Yeterli mi?

## 32. Y17 - e-Arşiv fatura Paraşüt üzerinden siteden kesilir; üye faturayı sipariş sayfasından indirir (22 Ekim 2026)

> **Durum: kodda değişti.** Dal `work/invoice`. Kod: `src/lib/invoice/`,
> runbook `docs/EARSIV.md`. Avukat turu yok; yalnız gerçek olmayan ya da
> eksik kalan cümleler düzeltildi. Ön Bilgilendirme Formu ve Mesafeli Satış
> Sözleşmesi değişmedi (cümleleri doğru kaldı), `LEGAL_UPDATED` taşınmadı;
> karaoke sözleşmesi değişmedi, `KARAOKE_LEGAL_UPDATED` taşınmadı. Değişen
> dört belge kendi tarihini taşır: İşlem Rehberi, Şirket ve İletişim
> Bilgileri, KVKK Aydınlatma Metni, Kafe Hizmet Koşulları (**22 Ekim 2026**).

### 32.1 Neden

Online siparişlerin e-Arşiv faturası Paraşüt'te elle kesiliyordu; teslimden
itibaren 7 gün içinde kesilmeyen fatura kesilmemiş sayılır (VUK m.231/5).
Site artık faturayı Paraşüt API'si üzerinden kendisi keser: kargo kolisi
kargoya verilince (çıktısı paketin içine, irsaliye yerine geçer), kafe
siparişi (gel-al, masa, kurye) teslimden sonra, ödenmiş karaoke
rezervasyonu saat bittikten sonra; PDF müşterinin siparişteki e-posta
adresine gider ve üye siparişinde sipariş sayfasından indirilebilir.
Kurumsal fatura otomasyonun dışındadır: yönetici, e-postayla gelen talepte
siparişi fatura kesilmeden önce "elle kesilecek" diye işaretler.

Metinlerdeki fatura cümleleri (§24.2'deki liste ve haritadaki bütün
"fatura" geçişleri) tek tek bu davranışa karşı okundu. Doğru kalanlar
değişmedi: ÖBF §16, MSS §9, Ödeme Koşulları §20, Teslimat ve Kargo,
Satış Politikası §24, Şikâyet ve Uyuşmazlık, karaoke sözleşmesi §12 ve
Şirket Bilgileri §14 tablosu. Ödül Programı §18 ve Mobil Uygulama
Koşulları'ndaki "kuponla karşılanan tutar faturada indirim olarak yer
alır" cümleleri muhasebeciye açık sorudur (§32.4); otomasyon ödül kuponlu
siparişi kesmez, elle kesilmek üzere işaretler, bu yüzden metin bu turda
değişmedi.

### 32.2 Değişen cümleler

| Yer | Mevcut | Yeni |
|---|---|---|
| İşlem Rehberi §9, 1. paragraf (sona eklendi) | (yoktu) | Üye olarak verdiğiniz bir siparişin faturası hesabınızdaki sipariş sayfasında gösteriliyorsa, onu oradan da indirebilirsiniz. |
| İşlem Rehberi §9, 2. paragraf | Kurumsal fatura istiyorsanız ticaret unvanı, vergi dairesi ve vergi kimlik numarasını sipariş numaranızla birlikte, siparişten sonra ve ürün kargoya verilmeden önce {{EMAIL}} adresine iletin; ... | Kurumsal fatura istiyorsanız ticaret unvanı, vergi dairesi ve vergi kimlik numarasını sipariş numaranızla birlikte, siparişten sonra ve fatura düzenlenmeden önce (kargoyla gönderilen siparişlerde ürün kargoya verilmeden, diğer siparişlerde teslimden önce) {{EMAIL}} adresine iletin; ... |
| Şirket Bilgileri §14, 1. paragraf (2. cümleden sonra eklendi) | (yoktu) | Üye olarak verdiğiniz bir siparişin e-Arşiv faturası hesabınızdaki sipariş sayfasında gösteriliyorsa, onu oradan da indirebilirsiniz. |
| Şirket Bilgileri §14, 2. paragraf | ... siparişten sonra ve ürün kargoya verilmeden önce {{EMAIL}} adresine iletmeniz gerekir; ... | ... siparişten sonra ve fatura düzenlenmeden önce (kargoyla gönderilen siparişlerde ürün kargoya verilmeden, diğer siparişlerde teslimden önce) {{EMAIL}} adresine iletmeniz gerekir; ... |
| Kafe Hizmet Koşulları §8, 5. paragraf | Ödeme karşılığında, 213 sayılı Vergi Usul Kanunu ve ilgili mevzuat uyarınca ödeme kaydedici cihaz fişi düzenlenir ve Misafire verilir. Fatura talebiniz hâlinde, ... | Kasada yapılan ödeme karşılığında, 213 sayılı Vergi Usul Kanunu ve ilgili mevzuat uyarınca ödeme kaydedici cihaz fişi düzenlenir ve Misafire verilir. Mobil uygulamadan verilip çevrim içi ödenen kafe siparişleri için ise e-Arşiv fatura düzenlenir ve siparişte bildirilen e-posta adresine gönderilir (İşlem Rehberi, 9. bölüm). Kasada ödemede fatura talebiniz hâlinde, ... |
| Kafe Hizmet Koşulları §8, tablo "Yasal belge" | Ödeme kaydedici cihaz fişi; talep hâlinde fatura | Kasada ödemede ödeme kaydedici cihaz fişi, talep hâlinde fatura; çevrim içi ödenen siparişte e-Arşiv fatura |
| KVKK Aydınlatma §14, Paraşüt satırı, "Aktarılan veri" | Aktarılan veri: faturadaki ad-soyad veya ticaret unvanı, fatura adresi, kurumsal faturada vergi dairesi ve vergi kimlik numarası, faturanın iletildiği e-posta adresi, satın alınan ürün veya hizmet, tutar ve KDV. | Aktarılan veri: faturadaki ad-soyad veya ticaret unvanı, fatura adresi (il, ilçe ve siparişteki adres metni), kurumsal faturada vergi dairesi ve vergi kimlik numarası, faturanın iletildiği e-posta adresi, sipariş veya rezervasyon numarası ve tarihi, satın alınan ürün veya hizmet, tutar, KDV ve ödeme tarihi. Nihai tüketiciye düzenlenen faturada telefon numarası ve T.C. kimlik numarası aktarılmaz. |

Gerekçeler: kurumsal bilginin "kargoya verilmeden önce" gelmesi kafe
siparişinde anlamsızdı (kafe siparişi kargoya verilmez, faturası teslimde
kesilir). Kafe koşulları her ödemeye ÖKC fişi vaat ediyordu; çevrim içi
ödenen siparişin belgesi e-Arşiv faturadır. KVKK §14, Paraşüt'e giden
veriyi eksik sayıyordu: site sipariş/rezervasyon numarasını ve tarihini,
ödeme tarihini de gönderir; telefon ve TCKN göndermez (alıcının vergi
numarası alanına GİB'in nihai tüketici yer tutucusu `11111111111` yazılır,
kişisel veri değildir).

### 32.3 Hukuki dayanak

- VUK m.231/5: fatura malın teslimi veya hizmetin yapıldığı tarihten
  itibaren azami 7 gün içinde düzenlenir.
- VUK Genel Tebliği 509, e-Arşiv internet satışı: "internet_sale" bilgileri
  (adres, ödeme şekli, ödeme aracısı, ödeme tarihi) ve mal gönderiminde
  taşıyıcının unvanı ve VKN'si; kâğıt çıktı irsaliye yerine geçer.
- KVKK m.10 ve Aydınlatma Tebliği m.5: aktarılan veri kategorileri.

### 32.4 Muhasebeciye açık kalanlar (metin değişmedi)

Ayrıntılı liste `docs/EARSIV.md` "Muhasebeciye açık sorular": ödül
kuponunun faturada indirim mi ödeme aracı mı olduğu (Ödül Programı §18,
Mobil Uygulama Koşulları), nihai tüketici yer tutucusu `11111111111`,
köşkün kendi kuryesinde `shipment` bloğuna şirketin kendi unvanı ve VKN'si,
cüzdanla ve sıfır tutarla ödenen siparişin belgesi, faturadan sonraki
iadede gider pusulası ya da iade faturası.

### 32.5 Operatöre

- Metinler kodla birlikte yayımlanır; lafmobil'in çevrimdışı kopyası
  `legal:export` ile güncellenir (İşlem Rehberi, Şirket Bilgileri, KVKK,
  Kafe Hizmet Koşulları).

## 33. Y18 - Birleştirme sonrası inceleme: bildirim jetonu, fatura zamanı ve Resend satırları kodun yaptığını söylüyor (22 Ekim 2026)

> **Durum: kodda değişti, avukat okuması bekliyor.** Dal
> `claude/brave-cannon-ctlv3a`. §30-§32 birleştirildikten sonra metinler
> kodla cümle cümle yeniden karşılaştırıldı; vaat edip yapılmayan ya da
> eksik söylenen beş yer düzeltildi. Belgelerin tarihi zaten **22 Ekim
> 2026**; `LEGAL_UPDATED` ve `COMMERCIAL_CONSENT_UPDATED` taşınmadı.
> Uygulama tarafı: lafmobil karar 328 (jeton yalnız karttaki evetten sonra).

### 33.1 Neden

- **Jeton yalnız evetten sonra.** Metinler jetonun yalnız "Siparişin hazır
  olunca haber verelim mi?" sorusuna evet denince gönderildiğini
  söylüyordu; uygulama ise izin hatırlatmalar ya da karaoke hatırlatıcısı
  için zaten verilmişse jetonu sorusuz gönderiyordu. Kod düzeltildi
  (lafmobil karar 328); metinlerde yalnız "işletim sisteminin izin penceresi
  yalnızca bu seçeneğe dokunduğunuzda açılır" cümlesi yanlış kaldı (izni
  hatırlatmalar ve ödenmiş karaoke rezervasyonunun hatırlatması da sorar).
- **Oturumu kapatınca silme.** Metinler jetonun oturum kapatılınca "hemen"
  silindiğini koşulsuz söylüyordu. Silme isteği en iyi çabadır: telefon o
  sırada çevrim dışıysa ya da oturum uygulama tarafından kendiliğinden
  kapatılmışsa istek gönderilemez ve jeton, aynı telefonda başka bir üye
  oturum açana, Apple veya Google jetonun öldüğünü bildirene ya da 180 gün
  dolana kadar kalır.
- **Teslim sonuçları 24 saat.** Expo'dan okunan teslim sonuçlarının jetonu
  "en fazla 24 saat" tuttuğu yazıyordu; temizlik günlük işte yapılır ve
  15 dakikadan genç kayıtlar o gün okunamaz. Kod, okuma başarısız olsa da
  satırları o gün temizler; metin üst sınırı "48 saat" olarak söyler.
- **Kurumsal fatura bilgisinin süresi.** Metin "diğer siparişlerde
  teslimden önce" diyordu; kafe siparişinin faturası gel-al'da sipariş
  "Hazır" olunca, kuryede kuryeye verilince, en geç ödemeden 3 saat sonra
  kesilir (`docs/EARSIV.md` §2).
- **Resend satırları.** e-Arşiv faturanın PDF'i Resend üzerinden fatura
  e-postasıyla gider; Gizlilik ve KVKK §14 Resend satırları gönderilen
  e-postaları sayarken fatura e-postasını ve PDF'teki fatura adresini
  anmıyordu.

### 33.2 Değişen cümleler

| Yer | Mevcut | Yeni |
|---|---|---|
| Gizlilik, "Bildirim izni" | Uygulama bildirim iznini ilk açılışta istemez; siparişinizi verdikten sonra ödeme sonucu ve sipariş takip ekranlarında 'Siparişin hazır olunca haber verelim mi?' seçeneğini sunar ve işletim sisteminin izin penceresi yalnızca bu seçeneğe dokunduğunuzda açılır. ... İzin verirseniz uygulama, ... | Uygulama bildirim iznini ilk açılışta istemez; işletim sisteminin izin penceresi yalnızca bir hatırlatmayı açtığınızda, ödenmiş karaoke odası rezervasyonunuzun hatırlatması için ya da siparişinizi verdikten sonra ödeme sonucu ve sipariş takip ekranlarında sunulan 'Siparişin hazır olunca haber verelim mi?' seçeneğine dokunduğunuzda açılır. ... Hatırlatmalar için verdiğiniz izin bildirim jetonunun sunucumuza gönderilmesine yol açmaz: jeton yalnızca bu seçeneğe dokunup izin verdiğinizde gönderilir (izin daha önce verilmişse pencere yeniden açılmaz, dokunmanız yeterlidir). Bu seçenekte izin verirseniz uygulama, ... |
| KVKK §12, "Bildirimler" | ... seçeneğini sunar ve işletim sisteminin izni yalnızca bu seçeneğe dokunduğunuzda istenir. İzin verirseniz uygulama, ... | ... işletim sisteminin izni yalnızca bir hatırlatmayı açtığınızda, ödenmiş karaoke odası rezervasyonunuzun hatırlatması için ya da ... seçeneğine dokunduğunuzda istenir. Hatırlatmalar için verdiğiniz izin bildirim jetonunun sunucumuza gönderilmesine yol açmaz; jeton yalnızca bu seçeneğe dokunup izin verdiğinizde gönderilir (izin daha önce verilmişse yeniden sorulmaz, dokunmanız yeterlidir). Bu seçenekte izin verirseniz uygulama, ... |
| Mobil Uygulama Koşulları, "Sipariş durumu bildirimleri" | ... seçeneğini sunar ve işletim sisteminin izni yalnızca Kullanıcı bu seçeneğe dokunduğunda istenir. | ... seçeneğini sunar. Bildirim jetonu yalnızca Kullanıcı bu seçeneğe dokunup izin verdiğinde gönderilir; hatırlatmalar için önceden verilmiş izin tek başına jetonun gönderilmesine yol açmaz ve bu durumda işletim sistemi izni yeniden sormaz. |
| Gizlilik ve KVKK, saklama tablosunun jeton satırı (iki yer) | Uygulamada oturumu kapattığınızda, üyelik hesabınız kapatıldığında ... hemen silinir. ... Expo'dan okunan teslim sonuçları jetonu en fazla 24 saat tutar. | Üyelik hesabınız kapatıldığında veya silindiğinde ya da Apple veya Google jetonun artık bir cihaza ulaşmadığını bildirdiğinde hemen silinir. Uygulamada oturumu kapattığınızda uygulama jetonun silinmesini ister ve jeton o anda silinir; telefon o sırada sunucumuza ulaşamıyorsa ya da oturum uygulama tarafından kendiliğinden kapatılmışsa bu istek gönderilemez ve jeton, aynı telefonda başka bir üye oturum açana ya da bu hâllerden biri gerçekleşene kadar kalır, bu sürede o telefona siparişlerinizin durum bildirimi gidebilir. Uygulama jetonu 180 gün boyunca yenilemezse jeton periyodik imhada silinir. Expo'dan okunan teslim sonuçları jetonu en fazla 48 saat tutar. |
| Güvenli Alışveriş, KVKK §12, Ticari Elektronik İleti, Veri Saklama (jeton satırı ve teslim sonucu satırı), Mobil Uygulama Koşulları (son cümleler) | ... oturumu kapattığınızda ... hemen ...; ... en fazla 24 saat ... | Aynı kural: silme isteği sunucuya ulaştığında hemen; ulaşamazsa (çevrim dışı ya da kendiliğinden kapanan oturum) başka bir üye oturum açana, jeton ölene ya da 180 gün dolana kadar; teslim sonuçları en fazla 48 saat. Veri Saklama'nın jeton satırı `src/lib/retention.ts` `push-devices` kuralının dayanak cümlesidir. |
| İşlem Rehberi §9 ve Şirket Bilgileri §14 (kurumsal fatura) | (kargoyla gönderilen siparişlerde ürün kargoya verilmeden, diğer siparişlerde teslimden önce) | (kargoyla gönderilen siparişlerde ürün kargoya verilmeden; kafe siparişlerinde sipariş teslime hazır olmadan veya kuryeye verilmeden ve her durumda ödemeden itibaren üç saat içinde) |
| Gizlilik, Resend satırı | ... (gönderilen e-postalar listesi) ... kodları). | Listeye "düzenlenen e-Arşiv faturanın PDF ekiyle gönderildiği fatura e-postası" eklendi; aktarılan veriye "fatura e-postasında faturanın PDF hâli ve üzerindeki fatura adresi". |
| KVKK §14, Resend satırı | ... bildirimlerinin; ... ileti içeriği; | ... bildirimlerinin ve e-Arşiv faturanın (PDF eki ile); ... ileti içeriği (fatura e-postasında faturanın PDF hâli ve fatura adresi dahil); |

### 33.3 Kodda değişenler (metnin anlattığı davranış)

- lafmobil: jeton yalnız karttaki evetten sonra gider (`laf.push.optin.v1`);
  izin başka bir şey için verilmişse kart yine sorar, basınca sistem
  penceresi açılmaz. Çıkış, kaydı süren jetonu POST yanıtlandıktan sonra
  bir kez daha geri alır (karar 328).
- Site: `checkPushReceipts` okuma başarısız olsa da seçilen satırların
  jetonunu o gün temizler.
- Site: İYS kuyruğu (`iys_recipients`, `iys_events`) rızanın bitiminden 3
  yıl sonra periyodik imhada silinir (`iys_retention`, onay ve ret
  kayıtlarının yayımlanmış süresi; İYS'de hâlâ ONAY görünen ya da İYS'ye
  bildirilmemiş reddi olan adres kalır).

### 33.4 Bilerek değişmeyenler

- Expo'nun `collapseId` / `tag` alanlarını cihaza taşıyıp taşımadığı bu
  ortamdan doğrulanamadı (`docs/API-MOBILE.md` §23 "yeni aşama eskisinin
  yerine geçer"); hukuk metinleri bunu vaat etmiyor, metin değişmedi.
  Push açıldığında cihazda denenecek (operatöre).

### 33.5 Avukata

- "Hemen" yerine koşullu silme anlatımı: telefon çevrim dışıyken çıkışta
  jetonun bir süre kalması ve o sürede eski üyenin sipariş bildiriminin o
  telefona gidebilmesi açıkça yazıldı. Yeterli mi, yoksa sunucu tarafında
  ek bir önlem (ör. jetonun belirli bir süre kullanılmamasında
  kendiliğinden düşürülmesi) mi beklenir?

## 34. Y19 - Uygulamanın bildirim kutusu damga hareketlerini listelemez (22 Ekim 2026)

> **Durum: kodda değişti, avukat okuması bekliyor.** Dal
> `claude/brave-cannon-ctlv3a`. `docs/AUDIT.md` §8'de açık kalan bulgu
> (PR #196 incelemesi, 21 Ekim 2026). Belgelerin tarihi zaten **22 Ekim
> 2026**; `LEGAL_UPDATED` ve `COMMERCIAL_CONSENT_UPDATED` taşınmadı.

### 34.1 Neden

Uygulamanın Bildirimler ekranı (`GET /api/mobile/v1/notifications`,
`src/lib/mobile/notifications.ts`) son 30 günün sipariş aşamalarını,
yayındaki duyuruları, ödül hazırsa bir kaydı, karaoke kararlarını ve
kilometre taşı hediyelerini listeler. Tek tek damgalar orada değil, damga
kartında görünür. KVKK Aydınlatma Metni iki yerde, Açık Rıza Metni bir
yerde damga hareketlerinin bildirim kutusunda gösterildiğini söylüyordu.
Mobil Uygulama Koşulları'nın örnek listesi (sipariş durumu, ödülün hazır
olması, kilometre taşı hediyesi, duyurular) zaten doğruydu.

### 34.2 Değişen cümleler

| Yer | Mevcut | Yeni |
|---|---|---|
| KVKK §12, "Mobil Uygulamaya İlişkin Ek Aydınlatma", bildirimler paragrafı | ... sipariş durumu ve damga hareketleri uygulama içindeki bildirimler ekranında gösterilmeye devam eder. | ... sipariş durumu uygulama içindeki bildirimler ekranında, damgalarınız uygulamadaki damga kartınızda gösterilmeye devam eder. |
| KVKK §20, "Ticari Elektronik İletiler ve İYS" | ... damga kazanımı ve tanımlanan kuponlar gibi işlemsel bilgiler uygulama içindeki bildirimler ekranında ve gerektiğinde e-posta ile iletilir; | ... damga kazanımı ve tanımlanan kuponlar gibi işlemsel bilgiler uygulamanın ilgili ekranlarında (sipariş durumu, ödülünüzün hazır olması ve kilometre taşı hediyeleri ayrıca bildirimler ekranında; damgalar damga kartınızda) ve gerektiğinde e-posta ile iletilir; |
| Açık Rıza Metni §13, "R8 - Push Bildirim Yoluyla Pazarlama" tablosu | Etkilenmez. Sipariş, ödeme, kargo, damga ve güvenlik bildirimleri e-posta ile ve uygulama içindeki bildirim kutusunda, ... | Etkilenmez. Sipariş, ödeme, kargo, damga ve güvenlik bilgilendirmeleri e-posta ile ve uygulamada (sipariş durumu ve ödülünüzün hazır olması bildirim kutusunda, damgalarınız damga kartınızda), ... |

`tests/legal-docs.test.ts` "what the app's inbox shows" tutar.

### 34.3 Bilerek değişmeyenler

- Mesafeli Satış Sözleşmesi'nin "uygulama içi bildirim kutusunda gösterilen
  sipariş durumu ve sadakat programı (damga ve kupon) bilgileri işlemsel
  niteliktedir" cümlesi bir nitelendirmedir (ödülün hazır olması kaydı
  damga ve kupon bilgisidir); ödeme onay belgesi olduğu için dokunulmadı.
- Açık Rıza Metni'nin kapsam dışı sayımı ("damganızın kartınıza işlendiği
  ... uygulama içi bildirimler") bir vaat değil, onayın kapsamını çizer.

## 35. Y20 - Meta Pixel: Çerez Politikası, KVKK Aydınlatma, Gizlilik ve Açık Rıza metinleri (25 Ekim 2026)

> **Durum: TASLAK - avukat okuması bekliyor.** Kodda değişti: site, yalnızca
> pazarlama çerezine açık rıza veren ziyaretçide Meta Pixel ("LAF Pixel")
> yüklüyor (`docs/META-PIXEL.md`). Dört belgenin metni bu yüzden değişti ve
> her biri kendi günüyle **25 Ekim 2026** taşıyor
> (`META_PIXEL_LEGAL_UPDATED`); `LEGAL_UPDATED` (22 Ekim 2026) ve ödeme
> adımının sürümü taşınmadı, çünkü ödemede onaylanan belgelerden hiçbiri
> değişmedi. Pikseli koda bağlayan bayrak `META_PIXEL_IN_LEGAL_TEXTS`
> (`src/lib/legal/meta.ts`); `NEXT_PUBLIC_META_PIXEL_ID` boş bırakılırsa piksel
> kapanır, metinler değişmeden kalır.

### 35.1 Neden

19 Ekim 2026'dan beri dört belge (Gizlilik, KVKK Aydınlatma, Açık Rıza, Çerez
Politikası) "İnternet sitemizde bugün analitik veya reklam etiketi kullanılmaz"
diyordu. Meta Pixel eklenince bu cümle yanlış oldu. Hâlâ doğru olan ve
yazılan: analitik etiket ve Google'ın reklam etiketleri (Etiket Yöneticisi,
Analytics, Ads) kullanılmaz; Meta Pixel yalnızca pazarlama kategorisine açık
rıza verilince çalışır.

### 35.2 Değişen yerler

| Belge | Yer | Ne oldu |
|---|---|---|
| Çerez Politikası | §3 (SDK ve etiket), §4 (amaçlar), §6 (üçüncü taraf çerezler), §7 (kategoriler), §11 (envanter), §12 (rıza yönetimi), §14 (DNT), §17 (hizmet listesi), §18 (hukuki sebep ve aktarım), §19 (süreler) | "Etiket yok" cümleleri "Google'ın etiketi yok, Meta Pixel yalnızca rızayla" oldu. §11'e `_fbp` ve `_fbc` satırları (90 gün, rıza gerekir, geri alınca silinir) ve pikselin ne ölçtüğü ile neyi göndermediği eklendi. §17'ye "Meta Pixel (Meta Platforms Ireland Ltd.)" satırı eklendi. Google `_gcl_au` satırı "bugün yerleştirilmez" diye işaretlendi. |
| KVKK Aydınlatma Metni | §8 (hukuki sebep), §9 (açık rıza), §10 (toplanma yöntemleri), §11 (çerezler), §15 (yurt dışına aktarım) | Pazarlama çerezi için hukuki sebep olarak açık rıza, amaç olarak reklam ölçümü ve yeniden hedefleme; §15'e Meta Platforms Ireland Ltd. alıcı olarak, aktarılan veriler, güvence yöntemi ve "bunun tek istisnası" cümlesi eklendi. |
| Gizlilik Politikası | §3, §4, §6, §8 (alıcılar), §9 (yurt dışına aktarım), §13 (çerezler) | Aynı değişiklikler kısaltılmış biçimde; "Analitik ve ölçümleme sağlayıcıları" satırı "Analitik, ölçümleme ve reklam sağlayıcıları" oldu ve Meta'yı sayıyor. |
| Açık Rıza Metni | §6 (özet tablo), §9 (R3 ve R4 notu), §10 (R5), §11 (R6) | **R5 geri geldi**: "Çerez Tabanlı Reklam ve Yeniden Hedefleme (Meta Pixel)" artık yürütülen bir rıza kalemi; tabloya satır eklendi. R6 başlığı "(Meta Pixel dışında rıza istenmez)" oldu. |
| Veri Saklama ve İmha Politikası | §8 (çerez satırı) | Meta çerezleri en çok 90 gün. |

`tests/legal-kvkk-transfers.test.ts` ve `tests/legal-dates.test.ts` yeni
durumu tutar.

### 35.3 Avukata sorular (karar avukatındır)

1. **Yurt dışı aktarımın dayanağı (en önemlisi).** Aynı belgeler, 19 Ekim
   2026'da Google için, her sayfa açılışında tekrarlanan bir aktarımın
   "arızi" olmadığını ve Kanun m.9 uyarınca açık rızaya
   dayandırılamayacağını, standart sözleşme imzalanıp Kurum'a bildirilmeden
   devreye alınamayacağını yazıyor (§15.6 ve bu belgenin ilgili bölümü). Meta
   Pixel her sayfa görüntülemesinde aynı yapıda bir aktarım yapar. Taslak,
   aktarımı çerez panelinde verilen açık rızaya dayandırıyor ve §15 ile Açık
   Rıza §11'de bunu "tek istisna" olarak yazıyor. Bu, o belgelerin kendi
   önceki çözümlemesiyle çelişiyor olabilir. Seçenekler: (a) açık rıza
   dayanağını avukat uygun bulursa metin olduğu gibi kalır; (b) Meta ile Kurul
   standart sözleşmesi imzalanıp bildirilene kadar `META_PIXEL_IN_LEGAL_TEXTS`
   `false` kalır ve piksel hiç açılmaz; (c) yalnızca tarayıcı tarafı yerine,
   kimlik bilgisi göndermeyen bir sunucu tarafı ölçüme geçilir.
2. **Sorumluluk ayrımı.** Pikselde Meta ve site birlikte veri sorumlusu
   sayılabilir (AB'de Fashion ID kararı). Metin, Meta'nın verileri "kendi
   gizlilik politikası çerçevesinde" işlediğini söylüyor; ortak sorumluluk
   ve Meta'nın veri işleme şartlarına atıf gerekiyor mu?
3. **Çerez süreleri.** `_fbp` ve `_fbc` için "en çok 90 gün" Meta'nın güncel
   belgesine göre yazıldı; avukat ve operatör Meta'nın geliştirici
   belgesinden doğrulamalı. Meta'nın kendi sistemindeki saklama için "13 ay"
   önceki genel şablondan kaldı, Meta'dan teyit edilmeli.
4. **Açık rızanın biçimi.** Panelde pazarlama anahtarının açıklaması Meta'yı,
   amacı, yurt dışı aktarımı ve geri alma yolunu adıyla söylüyor
   (`src/components/laffogato/cookie-consent.tsx`, `marketingBody`). Bu metin
   açık rıza için yeterli bilgilendirme mi? Anahtar önceden işaretli gelmez,
   "Yalnızca zorunlu" ve "Tümünü kabul et" aynı vurguda.
5. **Rızanın yenilenmesi.** Çerez rıza sürümü 1'den 2'ye çıktı; bu sürümden
   önce çerez bandına cevap veren herkese pazarlama kategorisi yeniden
   soruluyor (180 günlük çerez, `consentVersionFor`).
6. **Aydınlatma zamanı.** Aydınlatma Tebliği m.5/1-b: bildirim, işlemeden
   önce. Metinler bu PR ile aynı anda yayına çıkar; ama `main`'e birleştirilen
   değişiklik avukat okumasından önce canlıya gidebilir. Birleştirmeden önce
   okuma isteniyorsa `NEXT_PUBLIC_META_PIXEL_ID=` (boş) ile piksel kapalı
   tutulur.
7. **Dönüşümler API'si** (ikinci PR, henüz yok): sunucudan Purchase gönderilirse
   Meta'ya yine IP ve tarayıcı bilgisi gider; yalnızca rezervasyon sırasında
   pazarlama onayı olanlar için gönderilir ve onay durumu rezervasyon kaydına
   yazılır. Bu da aydınlatma ve saklama metnine girer.

### 35.4 Bilerek değişmeyenler

- Mobil uygulamaya ilişkin cümleler ("reklam tanımlayıcısı ve ölçümleme kiti
  kullanılmaz"): Meta Pixel yalnızca internet sitesinde çalışır.
- "Haritayı göster" bağlantısı ve Google Haritalar cümlesi.
- Kart bilgilerinin girildiği ödeme sayfası: pikselin yüklenmediği sayfa
  olarak anıldı, o sayfanın metinleri değişmedi.

## 36. Y21 - App Review 4.3(b) ve 5.1.1(v): fA'L yerine Kahve Modu, R12 kalktı, kayıtta telefon isteğe bağlı, ödenmemiş sipariş hesap kapatmayı durdurmaz (27 Ekim 2026)

> **Durum: metin kodda değişti, avukat okuması bekliyor.** Operatör, uygulama
> tarafının devir notundaki önerilen cümlelerin hemen uygulanmasına ve `main`'e
> birleştirilmesine izin verdi; avukat metni sonradan okur. Devir notu
> lafmobil deposunda `docs/site-handoff/APP-TO-SITE-2026-10-27.md` (bölüm
> (a), (b), (c) ve (g) 4. madde); reddin kaydı aynı depoda
> `docs/APP-REVIEW-2026-10-27.md` (bölüm 3, bulgu 1 ve 4). `LEGAL_UPDATED`
> ve ticari ileti metninin sürümü (`COMMERCIAL_CONSENT_UPDATED`) **27 Ekim
> 2026** oldu.

### 36.1 Neden

App Review 27 Ekim 2026'da iOS uygulamasını iki gerekçeyle reddetti:
Guideline 4.3(b) (fal, astroloji ve benzeri: konu fA'L'ın kahve falı ekranı
ve isteğe bağlı yapay zekâ yorumuydu) ve 5.1.1(v) (kayıtta zorunlu telefon).
Uygulama fA'L'ı kaldırdı (lafmobil karar 330): yerine **Kahve Modu** geldi.
Üye günün kahve modunu (herkese aynı, ya da kendi seçtiği başka bir mod) kendi
içeceğinin fotoğrafına yazdırır ve bir Story görseli oluşturur. Fotoğraf
yalnızca cihazda işlenir, L'Affogato'ya ya da başka bir yere gönderilmez,
yapay zekâ yoktur, fotoğrafa bakılmaz. Telefon kayıtta isteğe bağlı oldu
(karar 329); yalnızca teslimat adresinde (kurye, kargo) istenir.

Uygulama sitenin hukuk metinlerini içinde gösterir ve mağaza formundaki
Gizlilik Politikası adresi aynı metindir. Metinler hâlâ fA'L'ı, "falın yapay
zekâ ile yorumlanması"nı, Anthropic, PBC'yi, R12 rızasını ve "mobil
uygulamadan kayıt olunduğunda telefon"u anlatıyordu. Bu yüzden uygulama yeniden
gönderilmeden önce metinler değişti.

Ayrıca App Review öncesi taramanın 4. bulgusu: ödenmemiş bir sipariş varken
uygulama içinden hesap silme reddediliyordu (409 `orders_in_progress`) ve
inceleme notu inceleyiciye ödeme sayfasında durabileceğini söylüyor. Kod
artık ödeme adımında bırakılmış siparişleri silme sırasında iptal ediyor
(`cancelUnpaidOrdersOfClosingAccount`, `deleteMe`); metinler de bunu söyler.

### 36.2 Devir notundaki cümle çiftleri (a) ve (b)

Devir notunun **A1-A51** ve **B1-B5** maddelerindeki her "Bugün:" cümlesi
`src/lib/legal/content.ts`'te bulundu ve "Öneri:" cümlesiyle **birebir**
değiştirildi; eski ve yeni cümlelerin tamamı devir notunda yazılıdır, burada
tekrarlanmaz. Eşleştirme, depoya eklenmeyen bir betikle yapıldı: 56 maddenin
her biri kaynakta tam bir kez bulundu; metinde `{{BRAND}}` yer tutucusu
olan yerlerde (devir notunda "L'Affogato" diye basılmış) yer tutucu korundu.
"Silinir" diyen maddeler (A8, A9-A10, A19, A24-A25, A26, A27) elle
silindi: Gizlilik §6 R12 maddesi ve §8 "Yapay zekâ hizmet sağlayıcısı"
satırı; KVKK Aydınlatma §9 R12 maddesi, §14 Anthropic satırı, §15'in fA'L
paragrafı ve alıcılar listesinin Anthropic öğesi.

| Belge | Maddeler |
|---|---|
| Ön Bilgilendirme Formu | A1 (§18), A2 (§20) |
| Mesafeli Satış Sözleşmesi | A3 (§2), A4 (§16), B4 (§1) |
| İptal, İade ve Cayma Hakkı | A5 (§1) |
| Gizlilik Politikası | A6-A12 (§3, §4, §6, §8, §14), B1 (§8) |
| KVKK Aydınlatma Metni | A13-A28 (§5, §6, §7, §8, §9, §12, §14, §15, §19), B2 (§6), B3 (§14) |
| Ticari Elektronik İleti ve İYS Aydınlatması | A29-A32 (§1, §13, §20) |
| Kullanım Şartları | A33-A35 (§4, §5, §21), B5 (§7, devir notunda "isteğe bağlı netleştirme"; uygulandı) |
| Üyelik Sözleşmesi | A36-A39 (§11, §17) |
| Mobil Uygulama Kullanım Koşulları | A40-A45 (§4, §9, §21) |
| Şirket ve İletişim Bilgileri | A46-A47 (§4, §6) |
| Kafe Hizmet Koşulları | A48-A51 (§2, §9) |

Devir notunun "değişmez" dediği iki cümle aynen kaldı: Üyelik Sözleşmesi §6
1. madde ("Kayıt ve sipariş sırasında verdiği ...") ve KVKK Aydınlatma §6 2.
madde (iletişim verisi kategorisi).

### 36.3 Devir notunda olmayan belgeler: aynı ilkeyle

Uygulamanın paketli kopyası 27 belgenin yalnız 14'ünün gövdesini taşıdığı
için devir notu şu yerleri saymıyordu; devir notunun dediği gibi aynı ilkeyle
düzeltildi (fA'L yerine Kahve Modu; yapay zekâ yorumu, R12, yapay zekâ
sağlayıcısı ve "Bu yorumu bildir" kalkar; fotoğraf için "yalnızca cihazda
işlenir, gönderilmez"; kamera cümlesine masadaki QR eklenir; telefon için
"verildiyse"):

| Belge | Yer | Ne oldu |
|---|---|---|
| Satış Politikası | §2 (tanım), §11 (cihaz izinleri) | fA'L yerine Kahve Modu; fotoğraf cihazda işlenir, gönderilmez; kamera ayrıca masadaki QR için (görüntü kaydedilmez, yalnız masa kodu iletilir). |
| Ödeme Koşulları | §16 (iki paragraf) | Aynı. |
| Güvenli Alışveriş | §14 (iki paragraf), §22 (Supabase satırı) | Aynı; R12 ve yapay zekâ aktarımı cümlesi kalktı. §22: "ad-soyad, telefon" yerine "ad-soyad, mobil uygulamadan kayıt olurken verildiyse telefon". |
| Açık Rıza Metni | §3, §4, §6, §8, §11, §15, 15/A, §16, §17, §18, §20 | Ayrıntı 36.4'te. |
| Veri Saklama ve İmha Politikası | §5, §8 (üç satır), §9 (iki paragraf), §14, §15 | §5 telefon "verildiyse"; §8 satırları 36.4'te; §9 Kahve Modu ve masadaki QR; §14 veri işleyenler listesinden "yalnızca fA'L yapay zekâ yorumuna açık rıza verilmesi hâlinde yapay zekâ hizmeti (Anthropic, PBC)" kalktı; §15 günlük imha görevinin listesinde "fA'L kullanım ve bildirim kayıtları" yerine "mobil uygulamadan kaldırılan yapay zekâ fotoğraf yorumu özelliğinden kalan kullanım ve bildirim kayıtları". |
| Çerez Politikası | §15 (üç paragraf) | Kahve Modu; R12 ve aktarım cümlesi kalktı; kamera ayrıca masadaki QR için. |
| Hesap Silme | §4, §6 | §4 için 36.5; §6'daki iki madde fA'L adını taşımadan "27 Ekim 2026'da mobil uygulamadan kaldırılan yapay zekâ fotoğraf yorumu özelliği" diye anılır, kural aynen kalır. |
| Kullanım Şartları | §7 | 36.5. |
| Mobil Uygulama Kullanım Koşulları | §17 | 36.5. |
| Üyelik Sözleşmesi | §14 | 36.5. |
| Fikri Mülkiyet | §7 | "kamera (fA'L fotoğrafı ve personel kasa ekranı)" yerine "kamera (Kahve Modu fotoğrafı, masadaki QR koduyla sipariş ve personel kasa ekranı)". |
| Şikâyet ve Uyuşmazlık | §12, §13 | Kahve Modu; fotoğraf cihazda kalır; kamera ayrıca masadaki QR için. |

### 36.4 R12 ve fA'L'ın kayıtları (devir notu (c))

**Açık Rıza Metni.** R12 bölümü (15/A, "fA'L Yapay Zekâ Yorumu İçin
Fotoğrafın İşlenmesi ve Yurt Dışına Aktarılması") metinden çıktı; §6
özet tablosunun R12 satırı da. R7-R11'in numaraları değişmedi; R12 son kalem
olduğu için numara boşluğu oluşmadı. Devir notunun isteğe bağlı bıraktığı
"R12 ... 27 Ekim 2026'dan itibaren uygulanmaz" satırı **eklenmedi**: metin
fA'L adını hiç anmasın diye (avukat isterse eklenir, soru 1). R12'ye ya da
fA'L ekranına işaret eden yerler de çıktı:

- §4 ("ticari elektronik ileti ..., görsel içerikte yer alma ve fA'L yapay zekâ
  yorumu gibi") artık "ticari elektronik ileti (kampanya e-postaları ve
  bülten) ve görsel içerikte yer alma gibi".
- §6: onayın verildiği yerler arasında "fA'L ekranındaki onay" yerine
  "çerez panelindeki Pazarlama çerezleri anahtarı" (tablodaki R5 satırının
  kendi söylediği yer; 25 Ekim'de eksik kalmıştı).
- §8 son cümle: "fA'L yapay zekâ yorumu veya görsel içerik onaylarını" yerine
  "görsel içerik onayını".
- §11 (R6) son cümle "fA'L yapay zekâ yorumu için verilen onay R12 bölümünde
  ayrıca düzenlenmiştir." silindi.
- §15: kamera ve fotoğraf izni Kahve Modu ve masadaki QR için; "15/A.
  bölümdeki onayı vermediğiniz sürece" kalktı.
- §16 tablosu "Yalnızca etkilenen alan": "ve fA'L'ın yapay zekâ yorumu"
  kalktı.
- §17: örnek "fA'L'da fotoğraf çekmeyi" yerine "Kahve Modu'nda fotoğraf
  çekmeyi"; "pazarlama ve fA'L yapay zekâ yorumu (R12) onaylarının" yerine
  "pazarlama onaylarının"; tercihlerin göründüğü yerlerden "fA'L yapay zekâ
  yorumu onayınız fA'L ekranında" kalktı.
- §18: "fA'L yapay zekâ yorumu onayınızı (R12) fA'L ekranından geri
  çekebilirsiniz" kalktı.
- §20: "fA'L yapay zekâ yorumu onayının (R12) kaydı aşağıda ayrıca
  açıklanmıştır." cümlesi ve "fA'L yapay zekâ yorumu onayı (R12): ..." maddesi
  silindi.

**Saklanan rızalar.** Site PR'ı `db/migrations/20261027120000_retire_fal_ai_consents.sql`
ile 27 Ekim 2026'da hâlâ geçerli olan R12 rızalarına (`feature_consents`,
`feature = 'fal-ai'`) o günün `revokedAt`'ini yazar; satır silinmez (rıza
kaydı ispattır) ve geri çekmeden üç yıl sonra imha kuralıyla düşer
(`src/lib/retention.ts`). Yapay zekâ yolu üretimde hiç açılmadığından satır
beklenmez.

**Veri Saklama ve İmha Politikası §8.** Üç satır silinmedi, daraltıldı:
yeni kayıt oluşmaz, eski kayıtların süresi kalır. `src/lib/retention.ts`'in
alıntıladığı süre cümleleri (`tests/mobile-retention.test.ts`) harfi harfine
korundu.

- Anahtar: "27 Ekim 2026'da mobil uygulamadan kaldırılan yapay zekâ fotoğraf
  yorumu özelliği (içecek fotoğrafı, üretilen yorum ve kullanım kaydı)".
  Değer: "Özellik kaldırıldığından 27 Ekim 2026'dan itibaren yeni kayıt
  oluşturulmaz. Fotoğraf saklanmaz; üretilen yorum, kullanıcı onu
  bildirmedikçe saklanmaz (bildirimler için bir sonraki satır). Daha önce
  oluşmuş kullanım kayıtlarının (yorumun istendiği gün, fincanın görülüp
  görülmediği ve model adı) süresi değişmez: kullanım kaydı günlük sınırın
  uygulanması için doksan gün saklanır ve ardından silinir."
- Anahtar: "Aynı özelliğin yorum bildirimleri (bildirilen yorumun metni,
  bildirim sebebi ve model adı)". Değer: "Bildirim tarihinden itibaren 90 gün
  saklanır ve ardından silinir; fotoğraf bildirime girmez. Özellik
  kaldırıldığından 27 Ekim 2026'dan itibaren yeni bildirim alınmaz."
- Anahtar: "Özellik bazlı açık rıza kayıtları (aynı özelliğin yapay zekâ
  yorumu için verilen onay; rıza metninin sürümü, onay ve geri çekme
  zamanı)". Değer: süre cümlesi aynen, ardından "Özellik kaldırıldığından 27
  Ekim 2026'dan itibaren yeni onay alınmaz; o gün hâlâ geçerli olan onaylar
  aynı gün geri çekilmiş olarak işaretlenmiştir ve süreleri bu tarihten
  itibaren işler."

**Yapay zekâ sağlayıcısı.** Gizlilik Politikası, KVKK Aydınlatma Metni ve Veri
Saklama'da Anthropic, PBC artık alıcı ya da veri işleyen olarak geçmez; hiçbir
kodlu metin Anthropic'i ya da OpenAI'yi anmaz. Öbür sağlayıcılar (Vercel,
Resend, Neon, Supabase, Expo, Apple, Google, Paraşüt, Meta) aynen kaldı.

### 36.5 Hesap kapatma: ödenmemiş sipariş (devir notu (g) 4. madde)

Dört metin "devam eden bir sipariş varken hesap kapatılmaz" diyordu. Kural
kaldı; ödeme adımında bırakılmış sipariş için istisna eklendi. Kod da böyle
çalışır: `deleteMe` önce üyenin `pending_payment` siparişlerini ödeme
kuruluşuna sorup iptal eder (ödenmiş çıkan iptal edilmez), sonra sayar;
panelden girilen manuel sipariş (`source = 'manual'`) iptal edilmez ve
kapatmayı bekletir. Bu yüzden metin "yalnız ödenmiş sipariş bekletir" demez,
"ödeme adımında ödemesi tamamlanmamış sipariş devam eden sipariş sayılmaz"
der.

- Üyelik Sözleşmesi §14, mevcut cümleden sonra: "Ödeme adımında ödemesi
  tamamlanmamış bir sipariş devam eden sipariş sayılmaz; hesap kapatılırken
  iptal edilir ve kapatmayı ertelemez."
- Hesap Silme §4, ilk cümleden sonra: "Ödeme adımında ödemesi tamamlanmamış
  bir sipariş devam eden sipariş sayılmaz: silme sırasında iptal edilir ve
  silmeyi ertelemez; iptalden önce ödemenin durumu ödeme kuruluşundan sorulur
  ve ödemesinin alındığı anlaşılan sipariş iptal edilmez."
- Mobil Uygulama Kullanım Koşulları §17, mevcut cümleden sonra: "Ödeme
  adımında ödemesi tamamlanmamış bir sipariş devam eden sipariş sayılmaz;
  silme sırasında iptal edilir."
- Kullanım Şartları §7: "... hesap silme seçeneği, devam eden bir sipariş
  yoksa hesabı hemen kapatır (ödeme adımında ödemesi tamamlanmamış
  siparişler devam eden sipariş sayılmaz ve bu sırada iptal edilir); ..."

### 36.6 Tarihler

- `LEGAL_UPDATED` 22 Ekim 2026'dan **27 Ekim 2026**'ya: ödeme adımında
  onaylanan iki belge (Ön Bilgilendirme Formu, Mesafeli Satış Sözleşmesi)
  değişti. Bu andan sonraki siparişlerin onay kaydı bu sürümü yazar.
- `COMMERCIAL_CONSENT_UPDATED` **27 Ekim 2026**: Ticari Elektronik İleti
  metni değişti; yeni ticari ileti onayları
  `ticari-elektronik-ileti@27 Ekim 2026` sürümünü kaydeder.
- 25 Ekim 2026'dan beri kendi gününü taşıyan dört belge (Çerez Politikası,
  KVKK Aydınlatma, Gizlilik, Açık Rıza; `META_PIXEL_LEGAL_UPDATED`, §35)
  setin gününe döndü: basılan tarih setin revizyonundan önce olamaz.
- `KARAOKE_LEGAL_UPDATED` (21 Ekim 2026) değişmedi: karaoke belgesi
  değişmedi.

### 36.7 Avukata sorular (karar avukatındır)

1. **R12'nin yerinde tek satır.** Devir notu, avukat isterse 15/A'nın yerinde
   "R12 (fA'L yapay zekâ yorumu), özellik uygulamadan kaldırıldığı için 27
   Ekim 2026'dan itibaren uygulanmaz." satırının kalabileceğini söylüyor.
   Eklenmedi (metin fA'L'ı anmasın, App Review). Rıza vermiş üye (üretimde
   beklenmiyor) için bu satır ya da ayrı bir bildirim gerekir mi?
2. **Saklama satırları.** Kaldırılan özelliğin kayıtları "yeni kayıt yok, eski
   süre işler" diye kaldı ve özelliğin adı yerine "yapay zekâ fotoğraf yorumu
   özelliği" yazıldı. Satırlar tümüyle kaldırılıp kayıtlar tek seferde mi imha
   edilmeli (devir notu (c) iki yolu da açık bırakıyor)?
3. **Kahve Modu cümleleri.** Metinler fotoğraf için "yalnızca cihazda
   işlenir, gönderilmez" der, cihaz için "saklanmaz" demez (seçicinin
   önbellek kopyası ve Story dosyası en iyi çabayla silinir; Android'in kırpma
   ara dosyasına uygulama ulaşamaz). Kahve Modu hiçbir yerde "eğlence amaçlı"
   diye anlatılmaz (fal uygulamalarının sesi; App Review taraması bulgu 6).
   Yeterli mi?
4. **Masadan sipariş.** Kamera cümlelerine masadaki QR eklendi (16 Ekim
   2026'dan beri kamera onun için de açılıyor, metinler söylemiyordu).
   Belgelerin işlev listelerine (tanımlar) "masadan sipariş" eklensin mi?
   Devir notu bunu avukata bırakıyor; eklenmedi.
5. **Hesap kapatma.** Ödeme kuruluşuna ulaşılamazsa ödenmemiş sipariş iptal
   edilemez ve kapatmayı bekletir (sipariş süpürme kuralının süresi dolana
   kadar); panelden girilen manuel sipariş de bekletir. Metin bunları ayrıca
   saymıyor. Sayılmalı mı?
6. **B5.** Kullanım Şartları §7'deki "isteğe bağlı netleştirme" uygulandı
   ("ad, soyad ve e-posta adresi ile, verildiyse telefon numarası ve adres
   bilgileri").

### 36.8 Bilerek değişmeyenler

- Ön Bilgilendirme §12, Mesafeli Satış §12 ve İade ve Cayma §7 ile §21'deki
  "eğlence" sözü (MSY m.15/1-g'nin sözü, karaoke odası ve etkinlikler için)
  ve karaoke belgesinin aynı cümlesi: Kahve Modu ile ilgisi yok.
- Fikri Mülkiyet §10-§11'deki "yapay zekâ" (site içeriğinin yapay zekâ
  eğitiminde kullanılmasının yasağı).
- Kod yorumlarındaki tarihçe satırları (`content.ts`'te belge başlarındaki
  19 Ekim 2026 notları gibi).
- `docs/API-MOBILE.md` §20 ve uçlar: bu PR'ın hukuk akışı dışında.

### 36.9 Yeniden göndermeden önce (operatör)

Panelden yayımlanmış bir hukuk metni (`/admin/hukuk/<slug>`, boş olmayan
gövdeyle) kodlu metnin yerine geçer: hem sitede (`getPublishedLegalOverride`)
hem uygulamanın açtığı metinde (`src/lib/mobile/legal.ts`). Bu bölümde
değişen 20 belgeden biri için yayımlanmış bir üzerine yazma varsa, fA'L'lı
eski metin yayında kalır ve bu PR'ın değişikliği görünmez. Yayından sonra,
App Store'a yeniden göndermeden önce: panelde bu belgelerin hiçbirinde
yayımlanmış üzerine yazma olmadığına ya da varsa fA'L, R12, Anthropic ve
yapay zekâ yorumu geçmediğine bakılır; canlıda `/hukuk/gizlilik-politikasi`,
`/hukuk/kvkk-aydinlatma-metni` ve `/hukuk/mobil-uygulama-kosullari`
sayfalarında "fA'L" aranır (sonuç boş olmalı).

`tests/legal-fal-recipient.test.ts` artık tersini tutar: kod fotoğrafı
hiçbir yere göndermez (`falAiEnabled()` hep `false`), hiçbir kodlu metin
Anthropic'i, OpenAI'yi, fA'L'ı, fal sözünü, R12'yi, 15/A'yı ya da "Bu yorumu
bildir"i anmaz, Kahve Modu cümleleri "eğlence" demez ve cihaz için
"saklanmaz" vaat etmez, Kahve Modu fA'L'ın geçtiği her belgede geçer,
kamera cümleleri masadaki QR'ı anar ve saklama satırları yeni kayıt
olmadığını söyleyip eski süreleri korur. `tests/legal-kvkk-transfers.test.ts`
(R12'siz özet tablo, 15/A'sız başlıklar, Anthropic'siz alıcılar),
`tests/legal-account-deletion.test.ts` (ödenmemiş sipariş),
`tests/legal-dates.test.ts` ve `tests/legal-consent-version.test.ts` (27
Ekim 2026) yeni durumu tutar.

## Ek A - Cümle cümle düzeltme listesi

Bu ek, depoya eklenmeyen geçici bir betikle `src/lib/legal/content.ts` dosyasından (web `main` @ `aa8ef87`) üretildi; satır numaraları o sürüme aittir. Her satır: dosyadaki satır numarası, bölüm, kod(lar), mevcut cümle birebir ve öneri. Kodu yalnızca **Ö1** (ad değişikliği) ve/veya **T1** (tire) olan cümlelerde önerilen cümle tam yazılmıştır; diğerlerinde öneri, gövdedeki ilgili koddadır. Tablo hücresi olan metinlerde (anahtar/değer) cümle, hücrenin tamamıdır. Uzun tire `[U+2014]`, orta tire `[U+2013]` olarak gösterilmiştir.

Toplam **1080** cümle, **25** belge.

<details>
<summary><b>Ön Bilgilendirme Formu</b> (<code>on-bilgilendirme-formu</code>) - 84 cümle</summary>

Kod dağılımı: D2 24, D1 21, D3 12, Ö1 10, T1 9, D9 8, Ö5 6, Q1 3, V2 3, Ö3 3, D4 2, D6 2, E1 2, K1 2, Q2 2, V1 2, Ö10 2, Ö2 2, Ö8 2, C1 1, C2 1, D5 1, D8 1, KS1 1, Ö4 1, Ö6 1, Ö7 1


**(belge başı)**

- Satır 52 · `T1`
  - Mevcut: "Mesafeli Sözleşmeler Yönetmeliği (Resmî Gazete: 27.11.2014, Sayı: 29188) [U+2014] m.5 ön bilgilendirme yükümlülüğü, m.9 cayma hakkı, m.15 cayma hakkının istisnaları"
  - Önerilen: "Mesafeli Sözleşmeler Yönetmeliği (Resmî Gazete: 27.11.2014, Sayı: 29188) - m.5 ön bilgilendirme yükümlülüğü, m.9 cayma hakkı, m.15 cayma hakkının istisnaları"
- Satır 54 · `T1`
  - Mevcut: "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İleti Yönetim Sistemi [U+2014] İYS)"
  - Önerilen: "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İleti Yönetim Sistemi - İYS)"
- Satır 56 · `T1`
  - Mevcut: "6698 sayılı Kişisel Verilerin Korunması Kanunu [U+2014] m.4 genel ilkeler, m.5-6 işleme şartları, m.9 yurt dışına aktarım, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliği"
  - Önerilen: "6698 sayılı Kişisel Verilerin Korunması Kanunu - m.4 genel ilkeler, m.5-6 işleme şartları, m.9 yurt dışına aktarım, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliği"
- Satır 61 · `T1`
  - Mevcut: "6098 sayılı Türk Borçlar Kanunu [U+2014] m.117 temerrüt"
  - Önerilen: "6098 sayılı Türk Borçlar Kanunu - m.117 temerrüt"
- Satır 62 · `T1`
  - Mevcut: "6102 sayılı Türk Ticaret Kanunu [U+2014] m.1524 internet sitesi yükümlülüğü"
  - Önerilen: "6102 sayılı Türk Ticaret Kanunu - m.1524 internet sitesi yükümlülüğü"
- Satır 71 · `T1`
  - Mevcut: "6100 sayılı Hukuk Muhakemeleri Kanunu [U+2014] m.193 delil sözleşmesi"
  - Önerilen: "6100 sayılı Hukuk Muhakemeleri Kanunu - m.193 delil sözleşmesi"

**2. Tanımlar**

- Satır 135 · `D5`
  - Mevcut: "Ödül puanı"
  - Öneri: §4.4 D5.

**5. Sözleşme Konusu Mal ve Hizmetin Temel Nitelikleri**

- Satır 261 · `KS1`
  - Mevcut: "Kafe menüsünde yer alan içecek ve tatlılar, işletme içinde sunulan hizmetler olup online mağaza üzerinden mesafeli satışa konu edilmez; internet sitesindeki menü sayfası ile mobil uygulamadaki menü ekranı yalnızca tanıtım ve bilgilendirme amacı taşır."
  - Öneri: §8.3 KS1.

**6. Toplam Bedel, Vergiler ve Ek Masraf Kalemleri**

- Satır 268 · `D2`
  - Mevcut: "ALICI'nın ödeyeceği toplam bedel; ürünlerin vergiler dâhil satış bedelleri toplamından varsa promosyon kodu/indirim tutarı ile kullanılan ödül puanı karşılığı tutar düşülerek, üzerine varsa kargo veya kurye ücreti eklenmek suretiyle hesaplanır."
  - Öneri: §4.4 D2.
- Satır 269 · `D2`
  - Mevcut: "ALICI'nın ödül programı kapsamında kazandığı puanları kullanmayı seçmesi hâlinde, kullanılan puanın karşılığı tutar sipariş özetinde ayrı bir indirim kalemi olarak gösterilerek vergiler dâhil toplam bedelden düşülür ve yalnızca kalan tutar tahsil edilir."
  - Öneri: §4.4 D2.
- Satır 269 · `D2` `D3`
  - Mevcut: "Puan bir para birimi veya ödeme aracı değildir; nakde çevrilemez ve puanla karşılanan kısım için para iadesi yapılmaz."
  - Öneri: §4.4 D2, §4.4 D3.
- Satır 269 · `D9`
  - Mevcut: "Puanın siparişi tamamen karşıladığı hâllerde kart ile ek tahsilat yapılmaz."
  - Öneri: §4.4 D9.
- Satır 286 · `D2`
  - Mevcut: "Ödül puanı ile ödeme"
  - Öneri: §4.4 D2.
- Satır 288 · `D2`
  - Mevcut: "Kullanılan puanın karşılığı, toplam bedelden indirim olarak düşülür"
  - Öneri: §4.4 D2.
- Satır 291 · `T1`
  - Mevcut: "Kargo [U+2014] 500 TL ve üzeri sipariş"
  - Önerilen: "Kargo - 500 TL ve üzeri sipariş"
- Satır 295 · `T1`
  - Mevcut: "Kargo [U+2014] 500 TL altı sipariş"
  - Önerilen: "Kargo - 500 TL altı sipariş"

**7. Ödeme Şekli, iyzico Altyapısı, 3D Secure, Taksit ve Ödül Puanı**

- Satır 310 · `Ö8` `Ö5` `D1` `D9`
  - Mevcut: "7. Ödeme Şekli, iyzico Altyapısı, 3D Secure, Taksit ve Ödül Puanı"
  - Öneri: §3.3 Ö8, §3.3 Ö5, §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 312 · `Ö2`
  - Mevcut: "Kart ile yapılan ödemeler, 6493 sayılı Kanun kapsamında yetkilendirilmiş ödeme kuruluşu olan iyzico'nun sanal POS altyapısı üzerinden alınır."
  - Öneri: §3.3 Ö2.
- Satır 312 · `Ö3`
  - Mevcut: "Ödeme adımı iyzico'nun Checkout Form ekranında açılır; kart numarası, son kullanma tarihi ve güvenlik kodu (CVV/CVC) gibi kart verileri hiçbir aşamada SATICI'nın sunucularından geçmez ve SATICI tarafından saklanmaz."
  - Öneri: §3.3 Ö3.
- Satır 312 · `Ö4`
  - Mevcut: "Bu veriler doğrudan iyzico tarafından işlenir ve PCI-DSS yükümlülüğü iyzico'ya aittir."
  - Öneri: §3.3 Ö4.
- Satır 312 · `Ö7`
  - Mevcut: "SATICI'nın sipariş kaydında yalnızca kartın son dört hanesi, kart markası, iyzico işlem referans numarası ve işlem sonucu tutulur."
  - Öneri: §3.3 Ö7.
- Satır 313 · `Ö5`
  - Mevcut: "Kart ile yapılan işlemlerde 3D Secure ek kimlik doğrulaması, kartı veren banka ile birlikte iyzico tarafından yürütülür."
  - Öneri: §3.3 Ö5.
- Satır 313 · `Ö1`
  - Mevcut: "Bankanın veya iyzico'nun işlemi reddetmesi, limit yetersizliği, kartın e-ticarete kapalı olması gibi hâllerde sipariş kurulmamış sayılır ve ALICI'ya ekranda gerekçe ile birlikte bilgi verilir."
  - Önerilen: "Bankanın veya PayNkolay'ın işlemi reddetmesi, limit yetersizliği, kartın e-ticarete kapalı olması gibi hâllerde sipariş kurulmamış sayılır ve ALICI'ya ekranda gerekçe ile birlikte bilgi verilir."
- Satır 314 · `Ö6`
  - Mevcut: "Ödemenin sonucu, iyzico tarafından gönderilen imzalı bildirim (webhook) ile SATICI sistemine iletilir ve her bildirim iyzico'ya yeniden sorularak teyit edilir."
  - Öneri: §3.3 Ö6.
- Satır 315 · `Ö8`
  - Mevcut: "Taksitli ödeme imkânı, kartın ait olduğu bankanın iyzico üzerinden o tarihte sunduğu taksit seçenekleriyle sınırlıdır; taksit sayısı ve şartları kartı veren bankaya bağlıdır."
  - Öneri: §3.3 Ö8.
- Satır 317 · `D1` `D9`
  - Mevcut: "ALICI, ödeme adımında ödül puanını kullanmayı seçebilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 317 · `Ö1` `D1` `D2`
  - Mevcut: "Bu hâlde kullanılan puanın karşılığı toplam bedelden düşülür ve iyzico üzerinden yalnızca kalan tutar tahsil edilir."
  - Öneri: §3.3 Ö1, §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 317 · `D1` `D2` `D3`
  - Mevcut: "Puanla karşılanan kısım için kart provizyonu alınmaz; iade hâlinde bu kısım para olarak değil, kullanıldığı miktarda puan olarak ALICI'nın hesabına geri yüklenir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 318 · `Ö1`
  - Mevcut: "Mobil uygulama üzerinden verilen siparişlerde de ödeme aynı şekilde iyzico üzerinden alınır; uygulama mağazası (App Store, Google Play) üzerinden satın alma yapılmaz ve uygulama mağazaları satış ilişkisinin tarafı değildir."
  - Önerilen: "Mobil uygulama üzerinden verilen siparişlerde de ödeme aynı şekilde PayNkolay üzerinden alınır; uygulama mağazası (App Store, Google Play) üzerinden satın alma yapılmaz ve uygulama mağazaları satış ilişkisinin tarafı değildir."
- Satır 322 · `Ö5` `Ö3`
  - Mevcut: "Kredi kartı ve banka kartı (iyzico Checkout Form üzerinden, 3D Secure ile)"
  - Öneri: §3.3 Ö5, §3.3 Ö3.
- Satır 324 · `D1` `D2`
  - Mevcut: "Ödül puanı ile kısmi veya tam ödeme (kalan tutar kart ile tahsil edilir)"
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.

**8. Teslimat Şekli, Taşıyıcı Firma ve Teslimat Masrafı**

- Satır 339 · `V2`
  - Mevcut: "Yurtiçi Kargo"
  - Öneri: §9.2 V2.
- Satır 343 · `V2`
  - Mevcut: "Aras Kargo"
  - Öneri: §9.2 V2.

**9. Siparişin Kurulması, Üyelik Şartı ve Sipariş Akışı**

- Satır 369 · `D6`
  - Mevcut: "Aynı üyelik hesabı hem internet sitesinde hem de mobil uygulamada geçerlidir; sepet, sipariş geçmişi ve ödül puanı bakiyesi iki kanalda ortaktır."
  - Öneri: §4.4 D6.
- Satır 377 · `D2`
  - Mevcut: "Varsa ödül puanının kullanılması ve puan karşılığı indirimin sepete yansıtılması."
  - Öneri: §4.4 D2.
- Satır 378 · `D2`
  - Mevcut: "Sipariş özetinin gösterilmesi: ürünler, birim ve toplam bedeller, vergiler, kargo ücreti, indirimler, kullanılan puan ve genel toplam."
  - Öneri: §4.4 D2.
- Satır 380 · `Ö5` `Ö3`
  - Mevcut: "Ödeme bilgilerinin iyzico Checkout Form ekranında girilmesi ve 3D Secure doğrulamasının tamamlanması."
  - Öneri: §3.3 Ö5, §3.3 Ö3.
- Satır 381 · `Ö1`
  - Mevcut: "Ödemenin iyzico tarafından teyit edilmesi hâlinde sipariş kaydının oluşturulması ve sipariş numarasının ekranda gösterilmesi."
  - Önerilen: "Ödemenin PayNkolay tarafından teyit edilmesi hâlinde sipariş kaydının oluşturulması ve sipariş numarasının ekranda gösterilmesi."

**13. Cayma Sonrası İade Usulü, İade Kargo Masrafı ve Geri Ödeme**

- Satır 436 · `Ö10`
  - Mevcut: "Geri ödeme, ALICI'nın satın alırken kullandığı ödeme aracına uygun şekilde ve ALICI'ya hiçbir masraf yüklenmeksizin tek seferde yapılır; kart ile yapılan ödemelerde iade ve kısmi iade işlemleri iyzico üzerinden, ödemenin yapıldığı karta gerçekleştirilir."
  - Öneri: §3.3 Ö10.
- Satır 437 · `D2` `D3`
  - Mevcut: "Siparişte ödül puanı kullanılmışsa, cayma veya iade hâlinde puanla karşılanan kısım nakit olarak değil, kullanıldığı miktarda puan olarak ALICI'nın hesabına geri yüklenir; Türk Lirası olarak ödenen kısım ise ödemenin yapıldığı kanala iade edilir."
  - Öneri: §4.4 D2, §4.4 D3.
- Satır 437 · `D3`
  - Mevcut: "Kısmi iadelerde puan ve para kalemleri iade edilen ürünün bedeli oranında paylaştırılır ve hesaplama iade bildiriminde kalem kalem gösterilir."
  - Öneri: §4.4 D3.
- Satır 437 · `D2`
  - Mevcut: "İade edilen ürün nedeniyle kazanılmış olan puanlar ise geri alınır."
  - Öneri: §4.4 D2.
- Satır 454 · `V2`
  - Mevcut: "Yurtiçi Kargo (iade kodu ile ücretsiz)"
  - Öneri: §9.2 V2.
- Satır 466 · `Ö1`
  - Mevcut: "iyzico üzerinden, ödemenin yapıldığı karta"
  - Önerilen: "PayNkolay üzerinden, ödemenin yapıldığı karta"
- Satır 469 · `D2`
  - Mevcut: "Puanla ödenen kısım"
  - Öneri: §4.4 D2.
- Satır 471 · `D3`
  - Mevcut: "Kullanıldığı miktarda ALICI'nın hesabına puan olarak geri yüklenir"
  - Öneri: §4.4 D3.

**16. Fatura, Belge Düzeni ve Promosyon Kodları**

- Satır 497 · `E1`
  - Mevcut: "213 sayılı Vergi Usul Kanunu ve ilgili tebliğler uyarınca düzenlenen fatura, siparişin tamamlanmasının ardından ALICI'nın sipariş sırasında bildirdiği fatura bilgileri esas alınarak düzenlenir ve ALICI'nın doğrulanmış e-posta adresine elektronik ortamda iletilir; ayrıca internet sitesindeki ve mobil uygulamadaki sipariş detay ekranından indirilebilir."
  - Öneri: §11 E1.
- Satır 497 · `E1`
  - Mevcut: "Fatura bilgilerinin doğruluğundan ALICI sorumludur."
  - Öneri: §11 E1.
- Satır 499 · `D2` `D3`
  - Mevcut: "Puanla karşılanan kısım puan olarak geri yüklenir."
  - Öneri: §4.4 D2, §4.4 D3.

**17. Ödül Puanı Programı: Kazanım, Kullanım ve İade**

- Satır 503 · `D1` `D9`
  - Mevcut: "17. Ödül Puanı Programı: Kazanım, Kullanım ve İade"
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 505 · `D1` `D4` `Q1`
  - Mevcut: "{{BRAND}} ödül programı kapsamında ALICI, {{SITE}} ve {{BRAND}} mobil uygulaması üzerinden yaptığı alışverişlerden ve kafede QR kod okutarak gerçekleştirdiği ziyaretlerden puan kazanabilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §7.4 Q1.
- Satır 505 · `D1` `D2`
  - Mevcut: "Puan kazanımı ve kullanımı üyeliğe bağlıdır; puanlar yalnızca kazanan üyenin hesabına işlenir, başka bir hesaba devredilemez ve üçüncü kişilere satılamaz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 506 · `D1` `D2` `D3`
  - Mevcut: "Puan bir para birimi, ödeme aracı veya elektronik para değildir; nakde çevrilemez ve karşılığında para iadesi talep edilemez."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 506 · `D1` `D2`
  - Mevcut: "Puan yalnızca {{SITE}} ve mobil uygulama üzerinden verilen siparişlerde indirim olarak kullanılabilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 506 · `Ö1` `D1` `D2`
  - Mevcut: "Kullanılan puanın karşılığı, vergiler dâhil toplam bedelden ayrı bir indirim kalemi olarak düşülür ve kalan tutar iyzico üzerinden tahsil edilir."
  - Öneri: §3.3 Ö1, §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 507 · `D1` `D9`
  - Mevcut: "Puan kazanım oranı, asgari kullanım eşiği, geçerlilik süresi ve kampanya kapsamı; ödül programı koşullarında, kampanya sayfasında ve mobil uygulamanın ödül ekranında duyurulur."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 507 · `D1` `D2`
  - Mevcut: "Programda yapılacak değişiklikler geriye etkili değildir; kazanılmış puanlara kazanıldıkları tarihte yürürlükte olan koşullar uygulanır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 507 · `D1` `D2`
  - Mevcut: "Üyeliğin sonlandırılması veya hesabın kapatılması hâlinde birikmiş puanlar sona erer."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 508 · `D1` `D2` `D3`
  - Mevcut: "Cayma hakkının kullanılması, iptal veya iade hâlinde siparişte kullanılan puan aynı miktarda ALICI'nın hesabına geri yüklenir; Türk Lirası olarak ödenen kısım ödemenin yapıldığı kanala iade edilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 508 · `D1` `D2`
  - Mevcut: "İade edilen ürün nedeniyle kazanılmış puanlar geri alınır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 508 · `D1` `D3`
  - Mevcut: "Kısmi iadelerde puan ve para kalemleri iade edilen ürünün bedeli oranında paylaştırılır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D3.
- Satır 512 · `D1` `D9`
  - Mevcut: "Puan kazanımı"
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 514 · `Q1`
  - Mevcut: "Online alışveriş ve kafede QR kod okutularak yapılan ziyaretler"
  - Öneri: §7.4 Q1.
- Satır 523 · `D1` `D9`
  - Mevcut: "Mümkün değildir; puan para veya ödeme aracı değildir"
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 531 · `D1` `D3`
  - Mevcut: "Kullanılan puan aynı miktarda hesaba geri yüklenir"
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D3.
- Satır 535 · `D1` `D2`
  - Mevcut: "Birikmiş puanlar sona erer"
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.

**18. Mobil Uygulama Üzerinden Sipariş, Cihaz İzinleri ve Bildirimler**

- Satır 543 · `D4` `Q1`
  - Mevcut: "Uygulama üzerinden menü görüntüleme, sipariş verme, üyelik işlemleri, ödül puanı takibi, kafede QR kod okutarak puan kazanma ve bildirim alma özellikleri sunulur."
  - Öneri: §4.4 D4, §7.4 Q1.
- Satır 544 · `Ö1`
  - Mevcut: "Satın alma işlemleri uygulama mağazası üzerinden değil, iyzico ödeme altyapısı üzerinden gerçekleştirilir; uygulama mağazaları satış ilişkisinin tarafı değildir."
  - Önerilen: "Satın alma işlemleri uygulama mağazası üzerinden değil, PayNkolay ödeme altyapısı üzerinden gerçekleştirilir; uygulama mağazaları satış ilişkisinin tarafı değildir."
- Satır 545 · `K1` `Q2`
  - Mevcut: "Uygulama; bildirim gönderimi, kafede QR kod okutulması için kamera erişimi ve teslimat ile şube önerisi için yaklaşık konum gibi cihaz izinleri talep edebilir."
  - Öneri: §6 K1, §7.3-7.4 Q2.
- Satır 546 · `D6`
  - Mevcut: "Uygulamanın cihazdan kaldırılması üyeliği sona erdirmez; üyelik, sipariş geçmişi ve ödül puanı {{SITE}} üzerinden kullanılmaya devam eder."
  - Öneri: §4.4 D6.

**19. Ödeme Güvenliği, İtiraz (Chargeback) ve Şüpheli İşlem**

- Satır 553 · `Ö2`
  - Mevcut: "Ödeme işlemleri, 5464 sayılı Banka Kartları ve Kredi Kartları Kanunu ile 6493 sayılı Kanun hükümlerine tabi ödeme kuruluşu iyzico'nun altyapısı üzerinden gerçekleştirilir."
  - Öneri: §3.3 Ö2.
- Satır 553 · `Ö1`
  - Mevcut: "İnternet sitesi ile mobil uygulamanın iyzico altyapısıyla arasındaki tüm veri trafiği TLS ile şifrelenir."
  - Önerilen: "İnternet sitesi ile mobil uygulamanın PayNkolay altyapısıyla arasındaki tüm veri trafiği TLS ile şifrelenir."
- Satır 554 · `Ö5`
  - Mevcut: "Böyle bir başvuru hâlinde SATICI, bankanın veya iyzico'nun talebi üzerine; sipariş kaydı, onay tarihi ve saati, IP adresi, tarayıcı veya uygulama sürümü bilgisi, 3D Secure doğrulama sonucu, kargo teslim kaydı ve yazışma kayıtlarından oluşan belgeleri sunar."
  - Öneri: §3.3 Ö5.

**20. Kişisel Verilerin Korunması ve Ticari Elektronik İletiler**

- Satır 564 · `Ö10` `V1`
  - Mevcut: "Veriler; siparişin teslimi amacıyla kargo ve kurye şirketleriyle, ödemenin alınması, iadesi ve itiraz süreçlerinin yürütülmesi amacıyla ödeme kuruluşu iyzico ve ilgili bankalarla, işlemsel e-postaların gönderimi amacıyla e-posta altyapı sağlayıcısı Resend ile, barındırma hizmeti kapsamında Vercel ile, veri tabanı hizmeti kapsamında {{DB_PROVIDER}} (PostgreSQL) ile ve mevzuattan doğan yükümlülükler kapsamında yetkili kamu kurum ve kuruluşlarıyla paylaşılabilir."
  - Öneri: §3.3 Ö10, §9.1 V1 (Supabase eklenir).
- Satır 564 · `V1`
  - Mevcut: "Barındırma ve veri tabanı hizmetleri nedeniyle yurt dışına aktarım söz konusu olduğunda, Kanun'un yurt dışına aktarıma ilişkin hükmünde öngörülen şartlara uyulur."
  - Öneri: §9.1 V1 (Supabase eklenir).
- Satır 565 · `C1` `C2` `K1` `Q2`
  - Mevcut: "Mobil uygulamanın kullanılması hâlinde ayrıca cihaz tanımlayıcıları (IDFA/AAID), push bildirim tokeni, uygulama sürümü, işletim sistemi bilgisi ve çökme (crash) kayıtları; ALICI'nın izin vermesi hâlinde yaklaşık konum ve QR kod okutulması amacıyla kamera erişimi işlenir."
  - Öneri: §5.2 C1, §5.2 C2, §6 K1, §7.3-7.4 Q2.
- Satır 565 · `D2` `D8`
  - Mevcut: "Ödül programı kapsamında puan bakiyesi ile puan kazanım ve kullanım geçmişi işlenir; harcama geçmişine dayalı profilleme ve kişiselleştirilmiş kampanya sunulması yalnızca ALICI'nın açık rızası ile yapılır ve bu rıza her zaman geri alınabilir."
  - Öneri: §4.4 D2, §4.4 D8.

**21. Şikâyet, İtiraz ve Uyuşmazlıkların Çözümü**

- Satır 573 · `D3`
  - Mevcut: "ALICI, sipariş, teslimat, iade, ödül puanı veya ürünle ilgili her türlü talep, öneri ve şikâyetini {{EMAIL}} adresine, {{PHONE}} numarasına veya {{ADDRESS}} adresine iletebilir."
  - Öneri: §4.4 D3.

**22. Kalıcı Veri Saklayıcısı, Onay Kaydı ve Delil Sözleşmesi**

- Satır 583 · `Ö1`
  - Mevcut: "Onay anında, ispat kolaylığı sağlamak ve iyzico ile banka nezdindeki itiraz süreçlerinde kullanılmak üzere aşağıdaki kayıtlar sipariş kaydına yazılır ve değiştirilemez olay kaydında (audit log) saklanır."
  - Önerilen: "Onay anında, ispat kolaylığı sağlamak ve PayNkolay ile banka nezdindeki itiraz süreçlerinde kullanılmak üzere aşağıdaki kayıtlar sipariş kaydına yazılır ve değiştirilemez olay kaydında (audit log) saklanır."
- Satır 584 · `Ö1`
  - Mevcut: "Taraflar; SATICI'nın sistem, sunucu ve veri tabanı kayıtlarının, e-posta gönderim kayıtlarının, iyzico ve banka işlem kayıtlarının ile taşıyıcı teslim kayıtlarının, 6100 sayılı Hukuk Muhakemeleri Kanunu'nun delil sözleşmesine ilişkin hükmü uyarınca bağlayıcı delil teşkil edeceğini kabul eder."
  - Önerilen: "Taraflar; SATICI'nın sistem, sunucu ve veri tabanı kayıtlarının, e-posta gönderim kayıtlarının, PayNkolay ve banka işlem kayıtlarının ile taşıyıcı teslim kayıtlarının, 6100 sayılı Hukuk Muhakemeleri Kanunu'nun delil sözleşmesine ilişkin hükmü uyarınca bağlayıcı delil teşkil edeceğini kabul eder."
- Satır 592 · `Ö5`
  - Mevcut: "3D Secure doğrulama sonucu ve iyzico işlem referans numarası"
  - Öneri: §3.3 Ö5.
- Satır 593 · `D9`
  - Mevcut: "Kullanılan ödül puanı miktarı ve puan sonrası tahsil edilen tutar"
  - Öneri: §4.4 D9.

**23. Fikri ve Sınai Mülkiyet Hakları ile Site İçeriğinin Kullanımı**

- Satır 600 · `T1`
  - Mevcut: "{{SITE_URL}} adresinde ve {{BRAND}} mobil uygulamasında yer alan tüm içerik [U+2014] metinler, ürün açıklamaları, fotoğraf ve görseller, illüstrasyonlar, video ve ses kayıtları, arayüz tasarımı ve yazılım [U+2014] 5846 sayılı Fikir ve Sanat Eserleri Kanunu kapsamında korunmaktadır. {{BRAND}} markası, logosu ve ayırt edici işaretleri ise 6769 sayılı Sınai Mülkiyet Kanunu kapsamındadır."
  - Önerilen: "{{SITE_URL}} adresinde ve {{BRAND}} mobil uygulamasında yer alan tüm içerik - metinler, ürün açıklamaları, fotoğraf ve görseller, illüstrasyonlar, video ve ses kayıtları, arayüz tasarımı ve yazılım - 5846 sayılı Fikir ve Sanat Eserleri Kanunu kapsamında korunmaktadır. {{BRAND}} markası, logosu ve ayırt edici işaretleri ise 6769 sayılı Sınai Mülkiyet Kanunu kapsamındadır."

**25. Formun Geçerliliği, Güncellenmesi ve Tüketici Beyanı**

- Satır 619 · `D3`
  - Mevcut: "ALICI, bu Ön Bilgilendirme Formunu sipariş vermeden ve ödeme yükümlülüğü doğuran işlemi tamamlamadan önce okuduğunu; sözleşme konusu mal veya hizmetin temel niteliklerini, tüm vergiler dâhil toplam satış fiyatını ve ödeme şeklini, teslimat şeklini, taşıyıcıyı, teslimat masrafının kime ait olduğunu, ifa süresini, cayma hakkının varlığını, süresini, başlangıç anını ve kullanım usulünü, cayma hakkının kullanılamayacağı hâlleri, iade koşullarını, ödül puanının kullanımı ve iadesine ilişkin esasları ile şikâyet başvuru yollarını açık, anlaşılır ve internet ortamına uygun şekilde öğrendiğini kabul, beyan ve taahhüt eder."
  - Öneri: §4.4 D3.

</details>

<details>
<summary><b>Mesafeli Satış Sözleşmesi</b> (<code>mesafeli-satis-sozlesmesi</code>) - 70 cümle</summary>

Kod dağılımı: D1 20, D2 19, D3 9, Ö1 8, E1 7, D9 6, Ö10 6, D4 5, D6 4, V2 4, D5 3, Q1 3, Ö6 3, Ö8 3, D7 2, KS1 2, Q2 2, Ö3 2, Ö5 2, Ö7 2, C1 1, C2 1, D8 1, K1 1, Q4 1, V1 1, Ö2 1, Ö4 1


**(belge başı)**

- Satır 658 · `Ö1` `D2`
  - Mevcut: "{{BRAND}} web sitesi ve mobil uygulamasından verilen siparişlerde Satıcı ile Alıcı arasında elektronik ortamda kurulan mesafeli satış sözleşmesi: taraflar, iyzico ile ödeme, ödül puanı, teslimat, cayma hakkı, ayıplı mal ve uyuşmazlık çözümü."
  - Öneri: §3.3 Ö1, §4.4 D2.

**2. Tanımlar**

- Satır 826 · `D5` `D4` `Q1`
  - Mevcut: "SATICI'nın iOS ve Android platformları için yayımladığı; menü görüntüleme, sipariş verme, üyelik, ödül puanı takibi, kafede QR okutarak puan kazanma ve bildirim işlevlerini sunan {{BRAND}} uygulaması"
  - Öneri: §4.4 D5, §4.4 D4, §7.4 Q1.
- Satır 831 · `D5` `D2`
  - Mevcut: "ALICI'nın çevrimiçi alışverişlerinden ve kafe ziyaretlerinden puan kazandığı, kazandığı puanları sonraki siparişlerinde indirim olarak kullanabildiği üyelik programı"
  - Öneri: §4.4 D5, §4.4 D2.
- Satır 834 · `D5`
  - Mevcut: "Puan"
  - Öneri: §4.4 D5.

**3. Sözleşmenin Konusu ve Kapsamı**

- Satır 874 · `KS1`
  - Mevcut: "Web sitesi veya mobil uygulama üzerinde yer alan kafe menüsü yalnızca bilgilendirme amaçlıdır ve tek başına bir satış icabı oluşturmaz."
  - Öneri: §8.3 KS1.
- Satır 874 · `KS1`
  - Mevcut: "Satın alma yükümlülüğü doğuran işlem, çevrimiçi mağaza (bottega) üzerinden sepete eklenen ürünler için ödeme adımının tamamlanmasıyla kurulur."
  - Öneri: §8.3 KS1.
- Satır 877 · `Ö1`
  - Mevcut: "Mobil uygulama üzerinden verilen siparişlerin bedeli, uygulama mağazası içi satın alma yöntemiyle değil, işbu Sözleşme'de belirtilen iyzico sanal POS altyapısı üzerinden tahsil edilir."
  - Önerilen: "Mobil uygulama üzerinden verilen siparişlerin bedeli, uygulama mağazası içi satın alma yöntemiyle değil, işbu Sözleşme'de belirtilen PayNkolay sanal POS altyapısı üzerinden tahsil edilir."

**4. Sözleşme Konusu Mal, Fiyat ve Ödeme Bilgileri**

- Satır 883 · `D9`
  - Mevcut: "Sözleşme konusu mal veya malların cinsi, türü, miktarı, marka ve modeli, rengi, varyantı, birim fiyatı, adedi, tüm vergiler dâhil toplam satış bedeli, kargo bedeli, varsa uygulanan promosyon kodu indirimi, varsa ödül puanı ile karşılanan tutar ve genel toplam; sipariş sırasında ALICI'ya gösterilen sipariş özetinde, ALICI tarafından onaylanan Ön Bilgilendirme Formu'nda ve Sipariş Onayı e-postasında ayrı ayrı yer alır."
  - Öneri: §4.4 D9.
- Satır 895 · `Ö3`
  - Mevcut: "iyzico (sanal POS ve Checkout Form)"
  - Öneri: §3.3 Ö3.
- Satır 900 · `D2`
  - Mevcut: "Kredi kartı veya banka kartı; varsa ödül puanı ile kısmi ödeme"
  - Öneri: §4.4 D2.
- Satır 917 · `V2`
  - Mevcut: "Yurtiçi Kargo"
  - Öneri: §9.2 V2.
- Satır 921 · `V2`
  - Mevcut: "Aras Kargo"
  - Öneri: §9.2 V2.

**5. Ön Bilgilendirme ve Sözleşmenin Kurulması**

- Satır 939 · `Ö6`
  - Mevcut: "Sözleşme, ödemenin iyzico altyapısı üzerinden başarıyla tamamlanması ve sonucun iyzico'ya yeniden sorularak teyit edilmesi ve siparişin SATICI sistemine düşmesi anında kurulur."
  - Öneri: §3.3 Ö6.

**6. Genel Hükümler**

- Satır 952 · `Ö1`
  - Mevcut: "Herhangi bir nedenle mal bedeli ödenmez veya banka ya da iyzico kayıtlarında iptal edilirse, SATICI'nın malı teslim yükümlülüğü sona erer."
  - Önerilen: "Herhangi bir nedenle mal bedeli ödenmez veya banka ya da PayNkolay kayıtlarında iptal edilirse, SATICI'nın malı teslim yükümlülüğü sona erer."
- Satır 952 · `Ö1`
  - Mevcut: "Ödemenin iyzico veya kartı veren banka tarafından reddedilmesi, iptal edilmesi veya geri çekilmesi hâlinde sipariş otomatik olarak iptal edilir ve ALICI'ya bilgi verilir."
  - Önerilen: "Ödemenin PayNkolay veya kartı veren banka tarafından reddedilmesi, iptal edilmesi veya geri çekilmesi hâlinde sipariş otomatik olarak iptal edilir ve ALICI'ya bilgi verilir."
- Satır 959 · `D2` `D7`
  - Mevcut: "ALICI, web sitesini, mobil uygulamayı ve çevrimiçi mağazayı yalnızca hukuka uygun amaçlarla kullanacağını; otomatik veri toplama araçları (bot, crawler, scraper) ile sisteme yük bindirmeyeceğini, sahte sipariş oluşturmayacağını, promosyon kodlarını ve ödül puanlarını kötüye kullanmayacağını ve üçüncü kişilerin haklarını ihlal etmeyeceğini kabul eder."
  - Öneri: §4.4 D2, §4.4 D7.

**7. Ödeme Şekli, iyzico Sanal POS ve 3D Secure**

- Satır 965 · `Ö5`
  - Mevcut: "7. Ödeme Şekli, iyzico Sanal POS ve 3D Secure"
  - Öneri: §3.3 Ö5.
- Satır 967 · `Ö2`
  - Mevcut: "Web sitesi veya mobil uygulama üzerinden verilen siparişlerin bedeli, SATICI'nın anlaşmalı olduğu ödeme kuruluşu iyzico'nun sanal POS altyapısı üzerinden, kredi kartı veya banka kartı ile çevrimiçi olarak tahsil edilir. iyzico, 6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun kapsamında faaliyet gösteren, BDDK/TCMB tarafından yetkilendirilmiş bir ödeme kuruluşudur."
  - Öneri: §3.3 Ö2.
- Satır 967 · `Ö3`
  - Mevcut: "Ödeme adımında ALICI, iyzico'nun Checkout Form ekranına yönlendirilir ve kart bilgilerini doğrudan bu ekrana girer."
  - Öneri: §3.3 Ö3.
- Satır 968 · `Ö4`
  - Mevcut: "Bu bilgiler doğrudan iyzico'nun PCI-DSS uyumlu altyapısına, uçtan uca şifreli bağlantı üzerinden iletilir; kart verisinin güvenliğine ilişkin PCI-DSS yükümlülüğü iyzico'ya aittir."
  - Öneri: §3.3 Ö4.
- Satır 968 · `Ö8` `Ö7`
  - Mevcut: "SATICI'ya yalnızca işlemin sonucu (başarılı/başarısız), maskelenmiş kart numarasının son dört hanesi, kart şeması, taksit sayısı ve iyzico işlem referansı döner."
  - Öneri: §3.3 Ö8, §3.3 Ö7.
- Satır 969 · `Ö5`
  - Mevcut: "Kart ile yapılan ödemelerde 3D Secure doğrulaması iyzico tarafından yürütülür."
  - Öneri: §3.3 Ö5.
- Satır 970 · `Ö6`
  - Mevcut: "Ödeme sonucunun SATICI sistemine bildirimi, iyzico'nun sunucu-sunucu bildirimi (webhook) ile yapılır."
  - Öneri: §3.3 Ö6.
- Satır 970 · `Ö6`
  - Mevcut: "İmzası doğrulanan bildirimlerde dahi işlem sonucu, sipariş kesinleştirilmeden önce iyzico'ya yeniden sorularak teyit edilir."
  - Öneri: §3.3 Ö6.
- Satır 972 · `Ö8`
  - Mevcut: "Taksitli ödeme imkânı ve sunulan taksit seçenekleri, ALICI'nın kartını veren bankanın kampanya ve politikalarına bağlıdır; iyzico ödeme ekranında gösterilen seçenekler ilgili banka tarafından belirlenir."
  - Öneri: §3.3 Ö8.
- Satır 973 · `Ö1`
  - Mevcut: "Web sitesi ve mobil uygulama üzerinde hâlihazırda sunulan tek ödeme yöntemi, iyzico sanal POS altyapısı üzerinden kredi kartı veya banka kartı ile çevrimiçi tahsilattır."
  - Önerilen: "Web sitesi ve mobil uygulama üzerinde hâlihazırda sunulan tek ödeme yöntemi, PayNkolay sanal POS altyapısı üzerinden kredi kartı veya banka kartı ile çevrimiçi tahsilattır."
- Satır 973 · `D2`
  - Mevcut: "Ödül puanı ile kısmi ödeme bu yöntemin tamamlayıcısı olup başlı başına bir ödeme aracı değildir."
  - Öneri: §4.4 D2.
- Satır 974 · `Ö10`
  - Mevcut: "İade ve kısmi iade işlemleri, tahsilatın yapıldığı ödeme yöntemi üzerinden ve aynı karta olmak üzere iyzico API'sı aracılığıyla gerçekleştirilir."
  - Öneri: §3.3 Ö10.
- Satır 974 · `Ö10`
  - Mevcut: "SATICI'nın iade talimatını iyzico'ya iletmesinden sonra tutarın ALICI'nın kart ekstresine veya hesabına yansıma süresi banka süreçlerine bağlıdır; SATICI bu bankasal yansıma süresinden sorumlu tutulamaz."
  - Öneri: §3.3 Ö10.
- Satır 975 · `Ö1`
  - Mevcut: "ALICI'nın bankası nezdinde ödeme itirazı (chargeback) başlatması hâlinde SATICI, sipariş kaydı, onay kutucuğu kayıtları (tarih, IP, tarayıcı bilgisi, belge sürümü), kargo takip ve teslim kayıtları ile yazışma kayıtlarını ilgili bankaya veya iyzico'ya delil olarak sunar."
  - Önerilen: "ALICI'nın bankası nezdinde ödeme itirazı (chargeback) başlatması hâlinde SATICI, sipariş kaydı, onay kutucuğu kayıtları (tarih, IP, tarayıcı bilgisi, belge sürümü), kargo takip ve teslim kayıtları ile yazışma kayıtlarını ilgili bankaya veya PayNkolay'a delil olarak sunar."

**8. Ödül Puanları ile Kısmi Ödeme ve Puan İadesi**

- Satır 979 · `D1` `D2`
  - Mevcut: "8. Ödül Puanları ile Kısmi Ödeme ve Puan İadesi"
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 981 · `D1` `D9`
  - Mevcut: "SATICI, üyelik hesabı bulunan ALICI'lar için bir ödül (puan) programı yürütür."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 981 · `D1` `D4` `Q1`
  - Mevcut: "ALICI; çevrimiçi mağazadan yaptığı alışverişlerden ve kafede mobil uygulama aracılığıyla QR kod okutmak suretiyle gerçekleştirdiği ziyaretlerden, web sitesinde ve mobil uygulamada ilan edilen kazanım oranları çerçevesinde puan kazanır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §7.4 Q1.
- Satır 981 · `D1` `D2`
  - Mevcut: "Kazanılan puanlar üyelik hesabına tanımlanır ve hesap panelinden görüntülenebilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 982 · `D1` `D9`
  - Mevcut: "Puan bir para birimi değildir; nakde çevrilemez, banka hesabına aktarılamaz, üçüncü kişilere devredilemez ve satılamaz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 982 · `D1` `D2`
  - Mevcut: "Puan yalnızca SATICI nezdinde, sonraki siparişlerde indirim olarak kullanılabilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 982 · `D1` `D2`
  - Mevcut: "Puan kullanımı üyeliğe bağlıdır; ALICI'nın üyelik hesabını kapatması hâlinde hesapta kalan puanlar sona erer ve bu nedenle ALICI lehine herhangi bir alacak doğmaz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 983 · `D1` `D2`
  - Mevcut: "ALICI, sipariş sırasında puanlarının tamamını veya bir kısmını kullanmayı tercih edebilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 983 · `D1` `D2`
  - Mevcut: "Kullanılan puanın karşılığı olan tutar, sipariş özetinde, Ön Bilgilendirme Formu'nda ve Sipariş Onayı e-postasında ayrı bir satır olarak gösterilir ve toplam sipariş bedelinden düşülür."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 983 · `Ö1` `D1` `D2`
  - Mevcut: "Puan düşüldükten sonra kalan Türk Lirası tutar, iyzico sanal POS altyapısı üzerinden kredi kartı veya banka kartı ile tahsil edilir."
  - Öneri: §3.3 Ö1, §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 983 · `D1` `D9`
  - Mevcut: "Fatura, vergi mevzuatı uyarınca puan indirimini de gösterecek şekilde düzenlenir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 984 · `Ö10` `D1` `D3`
  - Mevcut: "Cayma hakkının kullanılması, siparişin iptali, ayıplı mal nedeniyle sözleşmeden dönülmesi veya herhangi bir nedenle iade yapılması hâlinde; siparişte puan ile karşılanan kısım ALICI'nın üyelik hesabına puan olarak geri yüklenir, kart ile tahsil edilen Türk Lirası kısım ise ödemenin yapıldığı karta iyzico üzerinden iade edilir."
  - Öneri: §3.3 Ö10, §4.4 D1 (bölüm bütünüyle değişir), §4.4 D3.
- Satır 984 · `D1` `D3`
  - Mevcut: "Puan hiçbir hâlde nakit olarak iade edilmez; puanın geri yüklenmesi, ALICI'nın Türk Lirası olarak ödediği kısmın yasal süre içinde iadesine ilişkin yükümlülüğü ortadan kaldırmaz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D3.
- Satır 985 · `D1` `D3`
  - Mevcut: "Kısmi iadelerde puan ve Türk Lirası iade tutarları, iade edilen kalemlerin sipariş içindeki oranına göre orantılı olarak belirlenir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D3.
- Satır 985 · `D1` `D2` `D3`
  - Mevcut: "Geri yüklenen puanların geçerlilik süresi ilk kazanıldıkları tarihe göre işlemeye devam eder; iade işlemi puanlara yeni bir geçerlilik süresi kazandırmaz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 986 · `D1` `D2` `D3`
  - Mevcut: "İade edilen bir sipariş dolayısıyla daha önce kazanılmış puanlar, iade oranında ALICI'nın hesabından geri alınır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 986 · `D1` `D9`
  - Mevcut: "Geri alınacak puanın hesapta bulunmaması hâlinde bu tutar sonraki kazanımlardan mahsup edilir; ALICI'dan bu nedenle nakit ödeme talep edilmez."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 987 · `D1` `D2`
  - Mevcut: "SATICI, ödül programının kazanım oranlarını, kullanım kurallarını ve puanların geçerlilik sürelerini ileriye etkili olmak üzere değiştirme veya programı sonlandırma hakkını saklı tutar."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 987 · `D1` `D2`
  - Mevcut: "Değişiklikler web sitesi ve mobil uygulama üzerinden makul bir süre önce duyurulur; kurulmuş sipariş ilişkilerini ve o siparişlerde kullanılmış puanları etkilemez."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 988 · `D1` `D4` `D2` `D7` `Q4`
  - Mevcut: "Puanın hile, sahte sipariş, mükerrer hesap açma, QR kodun izinsiz çoğaltılması veya benzeri yollarla kazanıldığının tespiti hâlinde SATICI, ilgili puanları iptal etme ve gerektiğinde hesabı askıya alma hakkına sahiptir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §4.4 D2, §4.4 D7, §7.4 Q4.

**9. Fatura ve Belgelendirme**

- Satır 994 · `E1`
  - Mevcut: "SATICI, 213 sayılı Vergi Usul Kanunu ve ilgili tebliğler uyarınca her sipariş için elektronik arşiv (e-Arşiv) fatura düzenler."
  - Öneri: §11 E1.
- Satır 994 · `D9` `E1`
  - Mevcut: "Ödül puanı ile karşılanan tutar faturada indirim olarak gösterilir."
  - Öneri: §4.4 D9, §11 E1.
- Satır 994 · `E1`
  - Mevcut: "Fatura, sipariş sırasında ALICI'nın beyan ettiği fatura bilgileri esas alınarak tanzim edilir."
  - Öneri: §11 E1.
- Satır 995 · `E1`
  - Mevcut: "Fatura, siparişin onaylanmasını takiben ALICI'nın kayıtlı e-posta adresine elektronik ortamda gönderilir ve ayrıca ALICI'nın web sitesi veya mobil uygulamadaki üyelik hesabının sipariş detay sayfasından indirilebilir."
  - Öneri: §11 E1.
- Satır 995 · `E1`
  - Mevcut: "ALICI, e-Arşiv faturanın elektronik ortamda iletilmesine ve kâğıt nüsha gönderilmemesine muvafakat eder; talep etmesi hâlinde faturanın kâğıt çıktısı da gönderilir."
  - Öneri: §11 E1.
- Satır 997 · `E1`
  - Mevcut: "Cayma hakkının kullanılması veya iade hâlinde, kurumsal faturalı satışlarda ALICI'nın iade faturası düzenlemesi gerekir."
  - Öneri: §11 E1.
- Satır 997 · `E1`
  - Mevcut: "Bireysel (nihai tüketici) satışlarda ise ürünle birlikte gönderilen fatura nüshasının üzerindeki iade bölümünün doldurulup imzalanarak ürünle beraber SATICI'ya iletilmesi gerekir; e-Arşiv fatura hâllerinde SATICI, iade işlemini kendi sistemlerinde belgelendirir ve ALICI'dan ek bir belge talep etmez."
  - Öneri: §11 E1.

**10. Teslimat, Kargo ve Teslim Şartları**

- Satır 1015 · `V2`
  - Mevcut: "Yurtiçi Kargo"
  - Öneri: §9.2 V2.
- Satır 1019 · `V2`
  - Mevcut: "Aras Kargo"
  - Öneri: §9.2 V2.

**11. Cayma Hakkı**

- Satır 1045 · `Ö10` `D2` `D3`
  - Mevcut: "Sipariş bedelinin bir kısmının ödül puanı ile karşılanmış olması hâlinde iade, işbu Sözleşme'nin ödül puanlarına ilişkin maddesindeki esaslara göre yapılır: puan ile karşılanan kısım ALICI'nın üyelik hesabına puan olarak geri yüklenir, kart ile tahsil edilen Türk Lirası kısım ise iyzico üzerinden aynı karta iade edilir."
  - Öneri: §3.3 Ö10, §4.4 D2, §4.4 D3.

**16. Kişisel Verilerin İşlenmesi ve Ticari Elektronik İleti**

- Satır 1123 · `D2` `D3`
  - Mevcut: "Sipariş sürecinde işlenen kişisel veriler; kimlik (ad-soyad), iletişim (e-posta, telefon, teslimat ve fatura adresi), müşteri işlem (sipariş içeriği, tutar, sipariş geçmişi, harcama geçmişi, ödül puanı kazanım ve kullanım kayıtları, iade ve talep kayıtları), finans (maskelenmiş kart bilgisi, işlem referansı, tahsilat kaydı) ve işlem güvenliği (IP adresi, tarayıcı bilgisi, oturum kayıtları, onay kayıtları) kategorilerindedir."
  - Öneri: §4.4 D2, §4.4 D3.
- Satır 1124 · `Ö10` `V1`
  - Mevcut: "Kişisel veriler; kargo ve lojistik hizmet sağlayıcılarına (teslimat amacıyla), ödeme kuruluşu iyzico'ya ve bankalara (tahsilat, iade ve itiraz süreçleri amacıyla), e-fatura ve muhasebe hizmet sağlayıcılarına (yasal yükümlülük amacıyla), işlemsel e-posta altyapı sağlayıcısına (sipariş bildirimleri amacıyla) ile yetkili kamu kurum ve kuruluşlarına, mevzuatta öngörülen sınırlar dâhilinde aktarılabilir."
  - Öneri: §3.3 Ö10, §9.1 V1 (Supabase eklenir).
- Satır 1126 · `C1` `C2`
  - Mevcut: "Siparişin mobil uygulama üzerinden verilmesi hâlinde ayrıca; cihaz tanımlayıcıları (IDFA/AAID), anlık bildirim (push) tokeni, uygulama sürümü, işletim sistemi ve cihaz modeli ile çökme (crash) kayıtları işlenir."
  - Öneri: §5.2 C1, §5.2 C2.
- Satır 1126 · `D4` `D6` `K1` `Q2`
  - Mevcut: "ALICI'nın cihaz ayarlarından izin vermesi hâlinde yaklaşık konum verisi (en yakın şube ve teslimat bölgesi önerisi için) ve kafede puan kazanımına ilişkin QR kodun okunabilmesi için kamera erişimi kullanılır."
  - Öneri: §4.4 D4, §4.4 D6, §6 K1, §7.3-7.4 Q2.
- Satır 1126 · `Q2`
  - Mevcut: "Kamera görüntüsü kaydedilmez; yalnızca okunan QR kod verisi işlenir."
  - Öneri: §7.3-7.4 Q2.
- Satır 1127 · `D8` `D6`
  - Mevcut: "ALICI'nın alışveriş ve ödül puanı geçmişi kullanılarak kişiye özel kampanya, öneri veya segmentasyon yapılması (profilleme) yalnızca ALICI'nın açık rızasına dayanılarak gerçekleştirilir."
  - Öneri: §4.4 D8, §4.4 D6.
- Satır 1131 · `D3` `D6`
  - Mevcut: "Mobil uygulama üzerinden gönderilen anlık bildirimler, kampanya, indirim veya tanıtım içerdiğinde ticari elektronik ileti sayılır ve aynı onay rejimine tabidir; sipariş durumu, kargo, iade ve ödül puanı hareketi gibi işlemsel bildirimler ise bu kapsamda değildir."
  - Öneri: §4.4 D3, §4.4 D6.

**20. Delil Sözleşmesi ve Kayıtların İspat Gücü**

- Satır 1185 · `Ö8` `Ö10` `Ö7`
  - Mevcut: "Ödeme kaydı: iyzico işlem referansı, maskelenmiş kart bilgisi, taksit sayısı, işlem sonucu ve varsa iade işlem kaydı."
  - Öneri: §3.3 Ö8, §3.3 Ö10, §3.3 Ö7.
- Satır 1186 · `D4` `D3` `D6` `Q1`
  - Mevcut: "Ödül puanı kaydı: puan kazanım, kullanım, geri yükleme ve iptal hareketleri ile hareketin kaynağı (çevrimiçi sipariş veya kafede QR okutma)."
  - Öneri: §4.4 D4, §4.4 D3, §4.4 D6, §7.4 Q1.

**21. Yürürlük, Elektronik Onay ve Sözleşme Sürümü**

- Satır 1221 · `Ö1`
  - Mevcut: "iyzico"
  - Önerilen: "PayNkolay"

</details>

<details>
<summary><b>İptal, İade ve Cayma Hakkı</b> (<code>iade-ve-cayma</code>) - 63 cümle</summary>

Kod dağılımı: D2 20, D1 17, D3 15, Ö10 14, T1 10, D4 4, Q1 4, V2 4, D5 2, Q2 2, Ö1 2, C2 1, D6 1, D7 1, D8 1, D9 1, Ö12 1, Ö2 1, Ö3 1, Ö4 1, Ö5 1, Ö6 1, Ö8 1


**(belge başı)**

- Satır 1251 · `Ö10` `D3`
  - Mevcut: "{{SITE}} ve {{BRAND}} mobil uygulaması üzerinden verilen siparişlerin iptali, 14 günlük cayma hakkı, ürün iadesi, iyzico ile geri ödeme süreleri ve ödül puanı iadesinin adım adım açıklandığı uygulama belgesidir."
  - Öneri: §3.3 Ö10, §4.4 D3.
- Satır 1254 · `T1`
  - Mevcut: "Mesafeli Sözleşmeler Yönetmeliği (Resmî Gazete: 27.11.2014, Sayı: 29188) [U+2014] m.5 ön bilgilendirme yükümlülüğü, m.9 cayma hakkı, m.15 cayma hakkının istisnaları"
  - Önerilen: "Mesafeli Sözleşmeler Yönetmeliği (Resmî Gazete: 27.11.2014, Sayı: 29188) - m.5 ön bilgilendirme yükümlülüğü, m.9 cayma hakkı, m.15 cayma hakkının istisnaları"
- Satır 1255 · `T1`
  - Mevcut: "6098 sayılı Türk Borçlar Kanunu [U+2014] m.117 temerrüt"
  - Önerilen: "6098 sayılı Türk Borçlar Kanunu - m.117 temerrüt"
- Satır 1258 · `T1`
  - Mevcut: "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İleti Yönetim Sistemi [U+2014] İYS)"
  - Önerilen: "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İleti Yönetim Sistemi - İYS)"
- Satır 1261 · `T1`
  - Mevcut: "6698 sayılı Kişisel Verilerin Korunması Kanunu [U+2014] m.4 genel ilkeler, m.5-6 işleme şartları, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliği"
  - Önerilen: "6698 sayılı Kişisel Verilerin Korunması Kanunu - m.4 genel ilkeler, m.5-6 işleme şartları, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliği"
- Satır 1267 · `T1`
  - Mevcut: "6102 sayılı Türk Ticaret Kanunu [U+2014] m.1524 internet sitesi yükümlülüğü"
  - Önerilen: "6102 sayılı Türk Ticaret Kanunu - m.1524 internet sitesi yükümlülüğü"
- Satır 1269 · `T1`
  - Mevcut: "6100 sayılı Hukuk Muhakemeleri Kanunu [U+2014] m.193 delil sözleşmesi"
  - Önerilen: "6100 sayılı Hukuk Muhakemeleri Kanunu - m.193 delil sözleşmesi"

**1. Belgenin Amacı, Kapsamı ve Tanımlar**

- Satır 1285 · `D5` `D4` `D3` `Q1`
  - Mevcut: "Mobil Uygulama: App Store ve Google Play üzerinden dağıtılan {{BRAND}} uygulaması; menü görüntüleme, sipariş verme, üyelik, ödül puanı takibi, kafede QR kod ile puan kazanma, bildirim alma ve iade talebi oluşturma işlevlerini sunar."
  - Öneri: §4.4 D5, §4.4 D4, §4.4 D3, §7.4 Q1.
- Satır 1293 · `D5` `D4` `D2` `Q1`
  - Mevcut: "Ödül Puanı / Puan: Alışverişlerden ve kafe ziyaretlerinde okutulan QR kodundan kazanılan, sonraki siparişlerde indirim olarak kullanılabilen sayısal değer; para değildir, nakde çevrilemez ve devredilemez."
  - Öneri: §4.4 D5, §4.4 D4, §4.4 D2, §7.4 Q1.

**3. Sipariş İptali: Kargoya Verilmeden Önce**

- Satır 1392 · `Ö10`
  - Mevcut: "İptal onaylandığında sipariş İptal Edildi durumuna alınır, tahsil edilen tutarın tamamı için ödeme kuruluşu iyzico'ya iade talimatı verilir ve varsa düşülen stok geri yüklenir."
  - Öneri: §3.3 Ö10.
- Satır 1393 · `D2` `D3`
  - Mevcut: "Siparişte ödül puanı kullanılmışsa kullanılan puanın tamamı hesabınıza geri yüklenir; puan olarak ödenen kısım için TL iadesi yapılmaz (bkz."
  - Öneri: §4.4 D2, §4.4 D3.

**5. Cayma Hakkının Kullanılması: Adım Adım Prosedür**

- Satır 1424 · `V2`
  - Mevcut: "Türkiye içi gönderiler için Yurtiçi Kargo, KKTC ve yurt dışı gönderiler için Aras Kargo anlaşmalı taşıyıcılarımızdır."
  - Öneri: §9.2 V2.
- Satır 1427 · `D2` `D3`
  - Mevcut: "Kabul edilen iadelerde geri ödeme, bu belgenin 10. maddesindeki usule göre başlatılır; siparişte puan kullanıldıysa puan iadesi 12. maddeye göre yapılır."
  - Öneri: §4.4 D2, §4.4 D3.

**6. İade Formunda ve Cayma Bildiriminde Yer Alması Gereken Bilgiler**

- Satır 1449 · `D2` `D3`
  - Mevcut: "Siparişte ödül puanı kullandıysanız bunu ayrıca belirtmenize gerek yoktur; puan kullanımı sipariş kaydından tespit edilir ve iade hâlinde puan hesabınıza geri yüklenir."
  - Öneri: §4.4 D2, §4.4 D3.

**9. İade Kargo Masrafının Kime Ait Olduğu**

- Satır 1495 · `T1`
  - Mevcut: "Cayma hakkı [U+2014] anlaşmalı taşıyıcı ile iade"
  - Önerilen: "Cayma hakkı - anlaşmalı taşıyıcı ile iade"
- Satır 1500 · `T1`
  - Mevcut: "Cayma hakkı [U+2014] anlaşmalı olmayan taşıyıcı ile iade"
  - Önerilen: "Cayma hakkı - anlaşmalı olmayan taşıyıcı ile iade"
- Satır 1524 · `T1`
  - Mevcut: "Değişim talebi [U+2014] Alıcı kaynaklı (beden, varyant, fikir değişikliği)"
  - Önerilen: "Değişim talebi - Alıcı kaynaklı (beden, varyant, fikir değişikliği)"

**10. Geri Ödeme: Kanal Bazında Süreler ve Usul**

- Satır 1544 · `Ö1`
  - Mevcut: "Satıcı, geri ödemeyi ödeme kuruluşu iyzico'ya 14 günlük süre içinde talimatlandırmakla yükümlüdür."
  - Önerilen: "Satıcı, geri ödemeyi ödeme hizmeti sağlayıcısı PayNkolay'a 14 günlük süre içinde talimatlandırmakla yükümlüdür."
- Satır 1544 · `Ö10`
  - Mevcut: "İade ve kısmi iade işlemleri iyzico API'si üzerinden gerçekleştirilir ve iade kaydı, talebin onaylandığı gün oluşturulur."
  - Öneri: §3.3 Ö10.
- Satır 1544 · `Ö10`
  - Mevcut: "Tutarın kart hesabına veya banka hesabına fiilen yansıması, ilgili bankanın ve kart kuruluşunun kendi işlem takvimine bağlıdır ve Satıcı'nın kontrolü dışındadır. iyzico iade talimatını bankaya ilettikten sonra bankaların iadeyi karta yansıtma süresi uygulamada genellikle 7-10 iş günü sürer; bazı bankalarda tutar, bir sonraki ekstre döneminde görünür hâle gelir."
  - Öneri: §3.3 Ö10.
- Satır 1546 · `D2` `D3`
  - Mevcut: "Ödül puanı ile kısmen veya tamamen ödenen siparişlerde geri ödeme, puan ve TL bakımından ayrı ayrı yapılır: kullanılan puan hesabınıza geri yüklenir, TL olarak fiilen tahsil edilen kısım ise ödeme kanalınıza iade edilir."
  - Öneri: §4.4 D2, §4.4 D3.
- Satır 1546 · `D2`
  - Mevcut: "Puanla ödenen kısım için TL olarak ödeme yapılmaz."
  - Öneri: §4.4 D2.
- Satır 1552 · `Ö10`
  - Mevcut: "İade aynı karta iyzico üzerinden yapılır; Satıcı 14 gün içinde talimatlandırır, bankanın karta yansıtma süresi genellikle 7-10 iş günüdür."
  - Öneri: §3.3 Ö10.
- Satır 1557 · `Ö8` `Ö10`
  - Mevcut: "İade aynı karta iyzico üzerinden yapılır; banka tutarı taksitler hâlinde yansıtabilir, toplam tutar değişmez. Taksit seçenekleri kartı veren bankaya bağlıdır."
  - Öneri: §3.3 Ö8, §3.3 Ö10.
- Satır 1562 · `Ö10`
  - Mevcut: "İade, karta bağlı hesaba iyzico üzerinden yapılır; bankaya göre 7-10 iş günü içinde hesaba geçer."
  - Öneri: §3.3 Ö10.
- Satır 1580 · `D9`
  - Mevcut: "Ödül puanı ile ödenen kısım"
  - Öneri: §4.4 D9.
- Satır 1582 · `D3`
  - Mevcut: "Kullanılan puan, iade onayından sonra en geç 1 iş günü içinde hesabınıza geri yüklenir; puan TL olarak iade edilmez ve nakde çevrilmez."
  - Öneri: §4.4 D3.

**11. Kısmi İade, Ücretsiz Kargo Eşiği ve Promosyon Kodlarının Etkisi**

- Satır 1609 · `D3`
  - Mevcut: "Ödül puanı ile kısmen ödenen siparişlerin kısmi iadesinde, iade edilen kalemin payına düşen puan hesabınıza geri yüklenir; kalemin TL ile ödenen kısmı ödeme kanalınıza iade edilir."
  - Öneri: §4.4 D3.

**12. Ödül Puanı ve Puanla Ödenen Siparişlerin İadesi**

- Satır 1616 · `D1` `D2`
  - Mevcut: "12. Ödül Puanı ve Puanla Ödenen Siparişlerin İadesi"
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 1618 · `D1` `D4` `Q1`
  - Mevcut: "{{BRAND}} ödül programı kapsamında Alıcı, çevrimiçi mağazadan yaptığı alışverişlerden ve kafede okutulan QR kodu ile ziyaretlerinden puan kazanabilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §7.4 Q1.
- Satır 1618 · `D1` `D2`
  - Mevcut: "Kazanılan puanlar sonraki siparişlerde sepet tutarından indirim olarak kullanılabilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 1618 · `D1` `D2`
  - Mevcut: "Puan bir para birimi ya da elektronik para değildir; nakde çevrilemez, başka bir hesaba devredilemez ve puan karşılığı düşülen tutar için TL olarak geri ödeme yapılmaz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 1619 · `Ö10` `D1` `D2` `D3`
  - Mevcut: "Puanla kısmen veya tamamen ödenen bir siparişin iptali, cayma hakkının kullanılması ya da ürünün ayıplı, yanlış veya eksik çıkması hâlinde siparişte kullanılan puanlar hesabınıza geri yüklenir; bedelin TL olarak fiilen tahsil edilen kısmı ise ödemenin yapıldığı kanala, bu belgenin 10. maddesindeki usul ve sürelere göre iyzico üzerinden iade edilir."
  - Öneri: §3.3 Ö10, §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 1619 · `D1` `D3`
  - Mevcut: "Böylece iade sonunda hem puanınız hem de ödediğiniz tutar eksiksiz biçimde size dönmüş olur."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D3.
- Satır 1620 · `D1` `D2`
  - Mevcut: "Puanlar üyeliğe bağlıdır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 1620 · `D1` `D2`
  - Mevcut: "Üyeliğinizi kapatmanız hâlinde biriken puanlar sona erer ve sona eren puanlar için herhangi bir bedel veya tazminat talep edilemez."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 1620 · `D1` `D6`
  - Mevcut: "Puan bakiyeniz ile kazanım ve kullanım geçmişiniz üye panelinizden ve mobil uygulamadan görüntülenebilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D6.
- Satır 1623 · `D1` `D2` `D3`
  - Mevcut: "Tam iade: Siparişin tamamı iade edildiğinde kullanılan puanın tamamı geri yüklenir ve TL olarak ödenen tutarın tamamı ödeme kanalınıza iade edilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 1624 · `D1` `D3`
  - Mevcut: "Kısmi iade: İade edilen kalemin payına düşen puan geri yüklenir; kalemin TL ile ödenen kısmı ödeme kanalınıza iade edilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D3.
- Satır 1625 · `D1` `D2` `D3`
  - Mevcut: "Geri yükleme süresi: Puanlar, iade talebi onaylandığında en geç bir iş günü içinde hesabınıza yeniden tanımlanır ve üye panelinde ile mobil uygulamada görünür hâle gelir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 1626 · `D1` `D2`
  - Mevcut: "Geçerlilik: Geri yüklenen puanların geçerlilik süresi, kullanıldıkları tarihteki kalan süre korunarak devam eder."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 1627 · `D1` `D2`
  - Mevcut: "Kazanılan puanın geri alınması: İade edilen alışveriş nedeniyle hak kazanılan puanlar, alışveriş geri alındığı için bakiyenizden düşülür; bakiyenin yetersiz olması hâlinde bakiye sıfırlanır ve sizden ayrıca bir bedel talep edilmez."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 1628 · `D1` `D4` `D2` `D3` `Q1`
  - Mevcut: "Kafe ziyaretinde QR kod ile kazanılan puanlar, çevrimiçi sipariş iadelerinden etkilenmez."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §4.4 D2, §4.4 D3, §7.4 Q1.
- Satır 1629 · `D1` `D2`
  - Mevcut: "Fatura: Puanla ödenen siparişlerde fatura, fiilen tahsil edilen tutar üzerinden düzenlenir; puan indirimi belge üzerinde ayrı satır olarak gösterilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 1630 · `D1` `D2` `D7`
  - Mevcut: "Kötüye kullanım: Hileli işlem, sahte sipariş veya sistemin amacı dışında kullanılması hâlinde puanlar iptal edilebilir; bu durumda gerekçe yazılı olarak bildirilir ve karara itiraz edebilirsiniz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D7.

**13. Mobil Uygulama Üzerinden İptal ve İade Talepleri**

- Satır 1638 · `Ö10`
  - Mevcut: "Ürün bedelleri uygulama mağazası üzerinden tahsil edilmez; ödeme her hâlde iyzico altyapısı üzerinden alınır ve iade de aynı kanaldan yapılır."
  - Öneri: §3.3 Ö10.
- Satır 1644 · `Q2`
  - Mevcut: "Hasar veya ayıp iddiası varsa uygulamanın kamera erişimiyle doğrudan fotoğraf ekleyin; kamera izni yalnızca bu amaçla ve kafede QR kod okutmak için istenir, cihaz ayarlarından her zaman kaldırılabilir."
  - Öneri: §7.3-7.4 Q2.

**15. Değişim (Ürün Takası) Süreci**

- Satır 1679 · `V2`
  - Mevcut: "Değişime konu ürünü, İade Onay Kodu ile birlikte anlaşmalı taşıyıcıya teslim edin; Türkiye içi gönderilerde Yurtiçi Kargo, KKTC ve yurt dışı gönderilerde Aras Kargo kullanılır."
  - Öneri: §9.2 V2.

**18. İade Adresi, Paketleme ve Gönderi Kuralları**

- Satır 1739 · `T1`
  - Mevcut: "{{LEGAL_NAME}} [U+2014] {{ADDRESS}}"
  - Önerilen: "{{LEGAL_NAME}} - {{ADDRESS}}"
- Satır 1747 · `V2`
  - Mevcut: "Yurtiçi Kargo (gönderi kodu teyit e-postasında iletilir)"
  - Öneri: §9.2 V2.
- Satır 1751 · `V2`
  - Mevcut: "Aras Kargo"
  - Öneri: §9.2 V2.

**19. İade Talebinin Takibi, Statüler ve Bildirimler**

- Satır 1802 · `Ö10` `D3`
  - Mevcut: "İade kabul edildi; geri ödeme talimatı iyzico'ya iletiliyor ve kullanılan ödül puanı hesabınıza geri yükleniyor."
  - Öneri: §3.3 Ö10, §4.4 D3.
- Satır 1807 · `Ö10`
  - Mevcut: "iyzico'ya iade talimatı verildi; bankaya bağlı olarak kart hesabına yansıması genellikle 7-10 iş günü sürer."
  - Öneri: §3.3 Ö10.

**20. Ödeme Altyapısı, Kredi Kartı İtirazı (Chargeback) ve Ön Provizyon**

- Satır 1825 · `Ö2`
  - Mevcut: "Site ve mobil uygulama üzerindeki ödemeler, 6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun kapsamında yetkilendirilmiş ödeme kuruluşu olan iyzico altyapısı üzerinden alınır."
  - Öneri: §3.3 Ö2.
- Satır 1825 · `Ö3`
  - Mevcut: "Ödeme adımı iyzico'nun Checkout Form ekranında açılır; kart numarası, son kullanma tarihi ve CVV gibi kart verileri hiçbir aşamada Satıcı'nın sunucularından geçmez ve Satıcı tarafından saklanmaz."
  - Öneri: §3.3 Ö3.
- Satır 1825 · `Ö4` `Ö5`
  - Mevcut: "PCI-DSS yükümlülüğü iyzico'ya aittir ve 3D Secure doğrulaması iyzico tarafından yürütülür."
  - Öneri: §3.3 Ö4, §3.3 Ö5.
- Satır 1826 · `Ö6`
  - Mevcut: "Ödeme sonucuna ilişkin bildirimler iyzico'dan imzalı webhook ile alınır, imza doğrulanır ve sonuç iyzico'ya yeniden sorularak teyit edilir; böylece mükerrer veya sahte bildirim riski önlenir."
  - Öneri: §3.3 Ö6.
- Satır 1826 · `Ö10`
  - Mevcut: "İade ve kısmi iade işlemleri de iyzico API'si üzerinden gerçekleştirilir."
  - Öneri: §3.3 Ö10.
- Satır 1828 · `Ö10`
  - Mevcut: "Bir iade talebini önce bizimle çözmeye çalışmanızı öneririz; doğrudan başlatılan itiraz süreçleri bankalar nezdinde 30 günü aşabilirken, doğrudan yapılan iade talebiniz aynı gün iyzico'ya iletilebilmektedir."
  - Öneri: §3.3 Ö10.
- Satır 1834 · `Ö10` `Ö12`
  - Mevcut: "Mükerrer ödeme: Aynı sipariş için birden fazla tahsilat oluşmuşsa, fazla tahsilat tespit edildiği anda iyzico üzerinden re'sen iade edilir ve size bildirilir."
  - Öneri: §3.3 Ö10, §3.3 Ö12.
- Satır 1836 · `Ö1`
  - Mevcut: "Kayıt: Sipariş onayı sırasında Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'ne verdiğiniz onayın tarihi, saati, IP adresi, tarayıcı veya uygulama sürümü bilgisi ve belge sürümü sipariş kaydına işlenir; bu kayıtlar itiraz süreçlerinde iyzico'ya ve bankaya sunulur."
  - Önerilen: "Kayıt: Sipariş onayı sırasında Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'ne verdiğiniz onayın tarihi, saati, IP adresi, tarayıcı veya uygulama sürümü bilgisi ve belge sürümü sipariş kaydına işlenir; bu kayıtlar itiraz süreçlerinde PayNkolay'a ve bankaya sunulur."

**23. Kayıt, Delil, Kişisel Veriler ve Belgenin Güncellenmesi**

- Satır 1890 · `C2` `Q2`
  - Mevcut: "Mobil uygulama: İade talebi oluşturulurken uygulama sürümü, işletim sistemi bilgisi ve bildirim tokeni gibi teknik veriler, talebin işlenmesi ve bildirim gönderimi amacıyla sınırlı olarak işlenir; kamera erişimi yalnızca fotoğraf ekleme ve QR kod okuma için kullanılır ve cihaz ayarlarından kaldırılabilir."
  - Öneri: §5.2 C2, §7.3-7.4 Q2.
- Satır 1891 · `D2` `D8`
  - Mevcut: "Ödül programı: Puan bakiyesi, kazanım ve harcama geçmişi, üyeliğin ifası amacıyla işlenir; bu verilerin pazarlama amaçlı profilleme için kullanılması yalnızca açık rızanıza bağlıdır ve rızanızı her zaman geri alabilirsiniz."
  - Öneri: §4.4 D2, §4.4 D8.

</details>

<details>
<summary><b>Teslimat ve Kargo Koşulları</b> (<code>teslimat-ve-kargo</code>) - 22 cümle</summary>

Kod dağılımı: T1 14, V2 5, Ö1 2, KS1 1, Ö5 1, Ö9 1


**(belge başı)**

- Satır 1905 · `T1`
  - Mevcut: "Mesafeli Sözleşmeler Yönetmeliği (Resmî Gazete: 27.11.2014, Sayı: 29188) [U+2014] m.5 ön bilgilendirme yükümlülüğü, m.9 cayma hakkı, m.15 cayma hakkının istisnaları"
  - Önerilen: "Mesafeli Sözleşmeler Yönetmeliği (Resmî Gazete: 27.11.2014, Sayı: 29188) - m.5 ön bilgilendirme yükümlülüğü, m.9 cayma hakkı, m.15 cayma hakkının istisnaları"
- Satır 1907 · `T1`
  - Mevcut: "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İleti Yönetim Sistemi [U+2014] İYS)"
  - Önerilen: "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İleti Yönetim Sistemi - İYS)"
- Satır 1909 · `T1`
  - Mevcut: "6098 sayılı Türk Borçlar Kanunu [U+2014] m.117 temerrüt"
  - Önerilen: "6098 sayılı Türk Borçlar Kanunu - m.117 temerrüt"
- Satır 1910 · `T1`
  - Mevcut: "6102 sayılı Türk Ticaret Kanunu [U+2014] m.1524 internet sitesi yükümlülüğü ile taşıma işlerine ilişkin hükümler"
  - Önerilen: "6102 sayılı Türk Ticaret Kanunu - m.1524 internet sitesi yükümlülüğü ile taşıma işlerine ilişkin hükümler"
- Satır 1911 · `T1`
  - Mevcut: "6698 sayılı Kişisel Verilerin Korunması Kanunu [U+2014] m.4 genel ilkeler, m.5-6 işleme şartları, m.9 yurt dışına aktarım, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliği"
  - Önerilen: "6698 sayılı Kişisel Verilerin Korunması Kanunu - m.4 genel ilkeler, m.5-6 işleme şartları, m.9 yurt dışına aktarım, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliği"
- Satır 1918 · `T1`
  - Mevcut: "213 sayılı Vergi Usul Kanunu [U+2014] sevk irsaliyesi ve fatura düzenine ilişkin hükümler"
  - Önerilen: "213 sayılı Vergi Usul Kanunu - sevk irsaliyesi ve fatura düzenine ilişkin hükümler"
- Satır 1919 · `T1`
  - Mevcut: "6100 sayılı Hukuk Muhakemeleri Kanunu [U+2014] m.193 delil sözleşmesi"
  - Önerilen: "6100 sayılı Hukuk Muhakemeleri Kanunu - m.193 delil sözleşmesi"

**1. Amaç, Kapsam ve Tanımlar**

- Satır 1927 · `KS1`
  - Mevcut: "Bu koşullar yalnızca bottega üzerinden verilen ve fiziksel sevkiyat gerektiren siparişler için geçerlidir. {{ADDRESS}} adresindeki işletmede yerinde sunulan ve yerinde tüketilen kafe menüsü ürünleri, mesafeli sözleşme kapsamında olmadığından bu metnin kargo ve teslimat hükümlerine tabi değildir; kafe hizmetlerine ilişkin koşullar ayrı bir metinde düzenlenmiştir."
  - Öneri: §8.3 KS1.

**3. İş Günü Tanımı, Sipariş Kesim Saati ve Ödemenin Onaylanması**

- Satır 2037 · `Ö1`
  - Mevcut: "Sürelerin işlemeye başlaması, siparişin verilmiş olmasına değil, ödemenin ödeme hizmeti sağlayıcısı iyzico ve kartı veren banka tarafından başarıyla onaylanmasına bağlıdır."
  - Önerilen: "Sürelerin işlemeye başlaması, siparişin verilmiş olmasına değil, ödemenin ödeme hizmeti sağlayıcısı PayNkolay ve kartı veren banka tarafından başarıyla onaylanmasına bağlıdır."
- Satır 2037 · `Ö9` `Ö5`
  - Mevcut: "3D Secure doğrulaması iyzico tarafından yürütülür; 3D Secure doğrulaması tamamlanmamış, ön provizyonu alınmış ancak satışa dönüştürülmemiş veya bankaca askıya alınmış işlemlerde hazırlık süresi başlamaz."
  - Öneri: §3.3 Ö9, §3.3 Ö5.
- Satır 2061 · `T1`
  - Mevcut: "Hafta içi 15.00 (TSİ) [U+2014] aynı gün teslim"
  - Önerilen: "Hafta içi 15.00 (TSİ) - aynı gün teslim"
- Satır 2065 · `Ö1`
  - Mevcut: "Ödemenin iyzico ve kartı veren bankaca onaylandığı an"
  - Önerilen: "Ödemenin PayNkolay ve kartı veren bankaca onaylandığı an"

**4. Hazırlık Süresi ve Ürün Gruplarına Göre Sevk Planı**

- Satır 2084 · `T1`
  - Mevcut: "2-4 iş günü [U+2014] yalnızca Pazartesi-Çarşamba sevk"
  - Önerilen: "2-4 iş günü - yalnızca Pazartesi-Çarşamba sevk"
- Satır 2089 · `T1`
  - Mevcut: "2-4 iş günü [U+2014] soğuk zincir, yalnızca Pazartesi-Çarşamba sevk"
  - Önerilen: "2-4 iş günü - soğuk zincir, yalnızca Pazartesi-Çarşamba sevk"

**5. Teslimat Bölgeleri ve Tahminî Teslim Süreleri**

- Satır 2119 · `T1`
  - Mevcut: "İstanbul içi [U+2014] motokurye"
  - Önerilen: "İstanbul içi - motokurye"
- Satır 2124 · `T1`
  - Mevcut: "İstanbul içi [U+2014] kargo"
  - Önerilen: "İstanbul içi - kargo"

**7. Kargo ve Teslimat Ücretleri**

- Satır 2204 · `T1`
  - Mevcut: "Ücretsiz [U+2014] kargo bedeline dâhildir"
  - Önerilen: "Ücretsiz - kargo bedeline dâhildir"

**8. Anlaşmalı Kargo Firmaları ve Taşıyıcının Belirlenmesi**

- Satır 2227 · `V2`
  - Mevcut: "Yurtiçi Kargo"
  - Öneri: §9.2 V2.
- Satır 2231 · `V2`
  - Mevcut: "Aras Kargo"
  - Öneri: §9.2 V2.
- Satır 2240 · `V2`
  - Mevcut: "Yurtiçi Kargo (Türkiye içi iadeler)"
  - Öneri: §9.2 V2.

**19. Cayma Hakkı Kapsamında İade Gönderilerinde Kargo Düzeni**

- Satır 2441 · `V2`
  - Mevcut: "SATICI, cayma hakkı kapsamındaki iade gönderileri için anlaşmalı taşıyıcı olarak Yurtiçi Kargo'yu belirlemiştir ve bu bilgi Ön Bilgilendirme Formu'nda da yer alır."
  - Öneri: §9.2 V2.
- Satır 2450 · `V2` `T1`
  - Mevcut: "Anlaşmalı iade taşıyıcısı: Yurtiçi Kargo [U+2014] iade kodu ile gönderimde kargo bedeli SATICI'ya aittir."
  - Öneri: §9.2 V2, §13 T1. Tire düzeltmesi de uygulanır (T1).

</details>

<details>
<summary><b>Garanti ve Ayıplı Mal</b> (<code>garanti-ve-ayipli-mal</code>) - 18 cümle</summary>

Kod dağılımı: T1 17, E1 1


**(belge başı)**

- Satır 2555 · `T1`
  - Mevcut: "6502 sayılı Tüketicinin Korunması Hakkında Kanun [U+2014] ayıplı mal, tüketicinin seçimlik hakları, garanti belgesi ve satış sonrası hizmetler"
  - Önerilen: "6502 sayılı Tüketicinin Korunması Hakkında Kanun - ayıplı mal, tüketicinin seçimlik hakları, garanti belgesi ve satış sonrası hizmetler"
- Satır 2556 · `T1`
  - Mevcut: "6502 sayılı Kanun [U+2014] seçimlik hakların yerine getirilmesinde azami otuz iş günü kuralı ve garanti belgeli mallarda azami tamir süresi istisnası"
  - Önerilen: "6502 sayılı Kanun - seçimlik hakların yerine getirilmesinde azami otuz iş günü kuralı ve garanti belgeli mallarda azami tamir süresi istisnası"
- Satır 2557 · `T1`
  - Mevcut: "Garanti Belgesi Yönetmeliği [U+2014] garanti belgesi düzenlenmesi zorunlu ürünler, asgari garanti süresi ve azami onarım süresi"
  - Önerilen: "Garanti Belgesi Yönetmeliği - garanti belgesi düzenlenmesi zorunlu ürünler, asgari garanti süresi ve azami onarım süresi"
- Satır 2558 · `T1`
  - Mevcut: "Satış Sonrası Hizmetler Yönetmeliği [U+2014] yetkili servis istasyonları, yedek parça ve kullanım ömrü"
  - Önerilen: "Satış Sonrası Hizmetler Yönetmeliği - yetkili servis istasyonları, yedek parça ve kullanım ömrü"
- Satır 2560 · `T1`
  - Mevcut: "Mesafeli Sözleşmeler Yönetmeliği (Resmî Gazete: 27.11.2014, Sayı: 29188) [U+2014] m.5 ön bilgilendirme yükümlülüğü, m.9 cayma hakkı, m.15 cayma hakkının istisnaları"
  - Önerilen: "Mesafeli Sözleşmeler Yönetmeliği (Resmî Gazete: 27.11.2014, Sayı: 29188) - m.5 ön bilgilendirme yükümlülüğü, m.9 cayma hakkı, m.15 cayma hakkının istisnaları"
- Satır 2562 · `T1`
  - Mevcut: "6098 sayılı Türk Borçlar Kanunu [U+2014] m.117 temerrüt"
  - Önerilen: "6098 sayılı Türk Borçlar Kanunu - m.117 temerrüt"
- Satır 2563 · `T1`
  - Mevcut: "6100 sayılı Hukuk Muhakemeleri Kanunu [U+2014] m.193 delil sözleşmesi"
  - Önerilen: "6100 sayılı Hukuk Muhakemeleri Kanunu - m.193 delil sözleşmesi"
- Satır 2566 · `T1`
  - Mevcut: "6698 sayılı Kişisel Verilerin Korunması Kanunu [U+2014] m.4 genel ilkeler, m.5-6 işleme şartları, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliği"
  - Önerilen: "6698 sayılı Kişisel Verilerin Korunması Kanunu - m.4 genel ilkeler, m.5-6 işleme şartları, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliği"
- Satır 2570 · `T1`
  - Mevcut: "Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği [U+2014] alerjen bildirimi ve son tüketim tarihi"
  - Önerilen: "Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği - alerjen bildirimi ve son tüketim tarihi"
- Satır 2571 · `T1`
  - Mevcut: "213 sayılı Vergi Usul Kanunu [U+2014] fatura ve belge düzeni"
  - Önerilen: "213 sayılı Vergi Usul Kanunu - fatura ve belge düzeni"
- Satır 2572 · `T1`
  - Mevcut: "6102 sayılı Türk Ticaret Kanunu [U+2014] m.1524 internet sitesi"
  - Önerilen: "6102 sayılı Türk Ticaret Kanunu - m.1524 internet sitesi"

**8. Garanti Belgesi Düzenlenen Ürünler ve Garanti Süreleri**

- Satır 2777 · `T1`
  - Mevcut: "Garanti belgesi düzenlenir [U+2014] 24 ay üretim ve montaj hatalarına karşı garanti"
  - Önerilen: "Garanti belgesi düzenlenir - 24 ay üretim ve montaj hatalarına karşı garanti"
- Satır 2782 · `T1`
  - Mevcut: "Garanti belgesi düzenlenir [U+2014] 24 ay üretim ve montaj hatalarına karşı garanti"
  - Önerilen: "Garanti belgesi düzenlenir - 24 ay üretim ve montaj hatalarına karşı garanti"
- Satır 2787 · `T1`
  - Mevcut: "Garanti belgesi düzenlenir [U+2014] 24 ay üretim hatalarına karşı garanti"
  - Önerilen: "Garanti belgesi düzenlenir - 24 ay üretim hatalarına karşı garanti"
- Satır 2802 · `T1`
  - Mevcut: "Garanti belgesi düzenlenmez [U+2014] 6502 sayılı Kanun kapsamında 24 ay ayıplı mal sorumluluğu geçerlidir"
  - Önerilen: "Garanti belgesi düzenlenmez - 6502 sayılı Kanun kapsamında 24 ay ayıplı mal sorumluluğu geçerlidir"
- Satır 2807 · `T1`
  - Mevcut: "Garanti belgesi düzenlenmez [U+2014] 6502 sayılı Kanun kapsamında 24 ay ayıplı mal sorumluluğu geçerlidir"
  - Önerilen: "Garanti belgesi düzenlenmez - 6502 sayılı Kanun kapsamında 24 ay ayıplı mal sorumluluğu geçerlidir"
- Satır 2817 · `T1`
  - Mevcut: "Kısa raf ömürlü ürün [U+2014] teslim anındaki uygunluk ve ambalajda belirtilen tüketim tarihine kadar nitelik taahhüdü"
  - Önerilen: "Kısa raf ömürlü ürün - teslim anındaki uygunluk ve ambalajda belirtilen tüketim tarihine kadar nitelik taahhüdü"

**20. Ayıplı Malın İadesi, Kargo Masrafları ve Bedel İadesi**

- Satır 3099 · `E1`
  - Mevcut: "İade tamamlandığında iade faturası düzenlenerek kayıtlı e-posta adresinize iletilir ve {{SITE_URL}} üzerindeki üye hesabınızın sipariş detay ekranından görüntülenebilir."
  - Öneri: §11 E1.

</details>

<details>
<summary><b>Satış Politikası ve Kısıtlı Ürünler</b> (<code>satis-politikasi</code>) - 65 cümle</summary>

Kod dağılımı: D1 22, D2 13, D9 12, Ö1 8, D3 6, D6 6, KS1 5, Ö10 4, D4 3, Ö5 3, D5 2, E1 2, Q2 2, Ö2 2, Ö3 2, Ö6 2, D7 1, D8 1, K1 1, Q1 1, Q4 1, V2 1, Ö13 1, Ö4 1, Ö8 1


**(belge başı)**

- Satır 3183 · `Ö1` `D2`
  - Mevcut: "{{SITE}} ve {{BRAND}} mobil uygulaması üzerinden hangi ürünlerin satıldığını, hangilerinin satışa sunulmadığını; sipariş miktarı sınırlarını, fiyat ve stok kurallarını, iyzico ile ödeme, promosyon, hediye çeki ve ödül puanı koşullarını düzenler."
  - Öneri: §3.3 Ö1, §4.4 D2.

**1. Amaç, Kapsam ve Taraflar**

- Satır 3211 · `Ö1`
  - Mevcut: "Politika; tüketici sıfatıyla alışveriş yapan gerçek kişileri, kurumsal faturalı alım yapan tüzel kişileri, siteyi veya mobil uygulamayı kullanan ancak henüz sipariş vermemiş kişileri ve {{SHORT_NAME}} ile çalışan ödeme kuruluşu iyzico ile banka, kargo firması ve tedarikçileri ilgilendirir."
  - Önerilen: "Politika; tüketici sıfatıyla alışveriş yapan gerçek kişileri, kurumsal faturalı alım yapan tüzel kişileri, siteyi veya mobil uygulamayı kullanan ancak henüz sipariş vermemiş kişileri ve {{SHORT_NAME}} ile çalışan ödeme hizmeti sağlayıcısı PayNkolay ile banka, kargo firması ve tedarikçileri ilgilendirir."

**2. Tanımlar**

- Satır 3222 · `D5`
  - Mevcut: "Mobil Uygulama: {{BRAND}} adıyla iOS ve Android için yayımlanan; menü görüntüleme, sipariş, üyelik, ödül puanı takibi ve bildirim işlevlerini sunan uygulama."
  - Öneri: §4.4 D5.
- Satır 3231 · `Ö10` `Ö5` `Ö2`
  - Mevcut: "Ödeme Kuruluşu: 6493 sayılı Kanun kapsamında yetkilendirilmiş ödeme kuruluşu olan iyzico; kart ile yapılan ödemelerin tahsilatı, 3D Secure doğrulaması ve iadeleri iyzico altyapısı üzerinden yürütülür."
  - Öneri: §3.3 Ö10, §3.3 Ö5, §3.3 Ö2.
- Satır 3232 · `D5`
  - Mevcut: "Ödül Puanı: Bottega alışverişlerinden ve kafe ziyaretlerinden kazanılan; bir ödeme aracı olmayıp yalnızca {{SHORT_NAME}} ürünlerinde kullanılabilen indirim hakkı."
  - Öneri: §4.4 D5.

**7. Satışı Yapılmayan ve Yasaklı Ürün ile Hizmetler**

- Satır 3374 · `Ö1`
  - Mevcut: "Bu liste hem mevzuat gereklerini hem de ödeme kuruluşu iyzico ile kart şemalarının üye iş yeri kabul kurallarını yansıtır."
  - Önerilen: "Bu liste hem mevzuat gereklerini hem de ödeme hizmeti sağlayıcısı PayNkolay ile kart şemalarının üye iş yeri kabul kurallarını yansıtır."
- Satır 3395 · `D6`
  - Mevcut: "Abonelik kodu, oyun içi para, ön ödemeli kart, dijital cüzdan bakiyesi ve nakde çevrilebilir her türlü değer aracı; {{BRAND}} hediye çeki ve ödül puanı bu kapsamın dışındadır; her ikisi de nakde çevrilemez ve devredilemez."
  - Öneri: §4.4 D6.

**9. Kafe Menüsü ile Online Mağaza Arasındaki Ayrım**

- Satır 3412 · `KS1`
  - Mevcut: "{{SITE}} ve mobil uygulama üzerinde yer alan kafe menüsü yalnızca tanıtım amaçlıdır."
  - Öneri: §8.3 KS1.
- Satır 3413 · `KS1`
  - Mevcut: "Online ödeme yalnızca bottega bölümünde listelenen fiziksel ürünler için alınır."
  - Öneri: §8.3 KS1.
- Satır 3413 · `KS1`
  - Mevcut: "Kafe içi satışlar işletmede yüz yüze gerçekleştirilir ve bu politikanın online satışa ilişkin hükümlerine değil, doğrudan işletme içi satış kurallarına tabidir."
  - Öneri: §8.3 KS1.
- Satır 3414 · `KS1`
  - Mevcut: "Bu ayrım, ödeme kuruluşu nezdinde üye iş yerinin işlem hacminin kaynağının açık olması bakımından önem taşır: iyzico sanal POS altyapısı üzerinden alınan işlemlerin tamamı, fiziksel ürün sevkiyatı ile sonuçlanan bottega siparişlerinden oluşur."
  - Öneri: §8.3 KS1.
- Satır 3415 · `D4` `Q1` `KS1`
  - Mevcut: "Kafede yapılan alışverişte mobil uygulamadan QR kod okutularak ödül puanı kazanılması bir online satış işlemi değildir; bu işlem yalnızca puan kazanımını kaydeder, kafe içi ödeme işletmede yüz yüze tahsil edilir."
  - Öneri: §4.4 D4, §7.4 Q1, §8.3 KS1.

**10. Sipariş Verme Koşulları ve Üyelik**

- Satır 3422 · `D6`
  - Mevcut: "Aynı hesap her iki kanalda da geçerlidir; sepet, sipariş geçmişi, hediye çeki bakiyesi ve ödül puanı hesap üzerinden ortak biçimde görüntülenir."
  - Öneri: §4.4 D6.

**11. Mobil Uygulama Üzerinden Satış ve Uygulama Mağazası Koşulları**

- Satır 3434 · `Ö10` `Ö3`
  - Mevcut: "Ödeme, uygulama içinde açılan iyzico Ödeme Formu üzerinden yapılır; uygulama mağazasının sipariş bedeli üzerinde tahsilat, iade veya iptal yetkisi bulunmaz."
  - Öneri: §3.3 Ö10, §3.3 Ö3.
- Satır 3435 · `D4` `K1` `Q2`
  - Mevcut: "Uygulamanın belirli işlevleri cihaz izinlerine bağlıdır: bildirim izni sipariş durumu ve kampanya bildirimleri için, kamera izni kafede QR kod okutarak ödül puanı kazanmak için, yaklaşık konum izni ise en yakın işletmenin ve teslimat bölgesinin gösterilmesi için istenir."
  - Öneri: §4.4 D4, §6 K1, §7.3-7.4 Q2.
- Satır 3437 · `D6`
  - Mevcut: "Uygulamayı cihazınızdan kaldırmanız üyeliğinizi, devam eden siparişlerinizi, hediye çeki bakiyenizi veya ödül puanınızı sona erdirmez; bunlar hesabınıza bağlı olarak durmaya devam eder ve internet sitesi üzerinden kullanılabilir."
  - Öneri: §4.4 D6.

**14. Fiyatlandırma, Vergi ve Fiyat Gösterimi**

- Satır 3485 · `D9`
  - Mevcut: "Sepetten gelen fiyat bilgisi doğrulama amacıyla kullanılır; tahsil edilecek tutar her hâlükârda PostgreSQL veri tabanındaki güncel ürün fiyatı, geçerli promosyon, kullanılan ödül puanı ve kargo kuralı esas alınarak belirlenir."
  - Öneri: §4.4 D9.
- Satır 3485 · `Ö1`
  - Mevcut: "İstemciden gelen tutar hiçbir koşulda doğrudan iyzico'ya veya bankaya iletilmez."
  - Önerilen: "İstemciden gelen tutar hiçbir koşulda doğrudan PayNkolay'a veya bankaya iletilmez."
- Satır 3487 · `D2`
  - Mevcut: "Ödül puanı veya hediye çeki kullanılan siparişlerde ödeme özetinde ürün toplamı, uygulanan indirimler, puan karşılığı, hediye çeki mahsubu ve kargo ücreti ayrı ayrı gösterilir; kart ile tahsil edilecek nihai tutar onayınıza sunulur."
  - Öneri: §4.4 D2.

**15. Ödeme Altyapısı ve iyzico**

- Satır 3514 · `Ö1`
  - Mevcut: "15. Ödeme Altyapısı ve iyzico"
  - Önerilen: "15. Ödeme Altyapısı ve PayNkolay"
- Satır 3516 · `Ö2`
  - Mevcut: "Site ve mobil uygulama üzerindeki kart ödemeleri, 6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun kapsamında yetkilendirilmiş ödeme kuruluşu olan iyzico aracılığıyla alınır."
  - Öneri: §3.3 Ö2.
- Satır 3516 · `Ö1`
  - Mevcut: "Sanal POS hizmeti iyzico tarafından sağlanır; {{SHORT_NAME}} kendi adına kart tahsilatı yapmaz."
  - Önerilen: "Sanal POS hizmeti PayNkolay tarafından sağlanır; {{SHORT_NAME}} kendi adına kart tahsilatı yapmaz."
- Satır 3517 · `Ö3`
  - Mevcut: "Ödeme adımında iyzico Ödeme Formu açılır ve kart bilgileri doğrudan iyzico ortamına girilir."
  - Öneri: §3.3 Ö3.
- Satır 3517 · `Ö4`
  - Mevcut: "Kart verisinin güvenliğine ilişkin PCI-DSS yükümlülüğü iyzico'ya aittir."
  - Öneri: §3.3 Ö4.
- Satır 3518 · `Ö5`
  - Mevcut: "3D Secure doğrulaması iyzico tarafından yürütülür ve kartı veren bankanın doğrulama ekranı üzerinden tamamlanır."
  - Öneri: §3.3 Ö5.
- Satır 3519 · `Ö8`
  - Mevcut: "Taksit seçenekleri, taksit sayısı ve varsa vade farkı kartı veren bankanın ve iyzico'nun o dönemde sunduğu koşullara bağlıdır; bu seçenekler {{SHORT_NAME}} tarafından belirlenmez ve her kart için aynı seçeneklerin sunulacağı taahhüt edilmez."
  - Öneri: §3.3 Ö8.
- Satır 3520 · `Ö6`
  - Mevcut: "Ödeme sonucu, iyzico tarafından imzalı bildirim ile iletilir."
  - Öneri: §3.3 Ö6.
- Satır 3520 · `Ö6`
  - Mevcut: "Bildirimin imzası doğrulanır ve işlemin durumu iyzico'ya yeniden sorularak teyit edilir; sipariş yalnızca teyit edilen başarılı ödeme üzerine oluşturulur."
  - Öneri: §3.3 Ö6.
- Satır 3521 · `Ö10`
  - Mevcut: "İade ve kısmî iade işlemleri iyzico üzerinden, ödemenin alındığı karta yapılır."
  - Öneri: §3.3 Ö10.
- Satır 3523 · `D9`
  - Mevcut: "Hesaplama; veri tabanındaki güncel ürün fiyatı, geçerli promosyon, kullanılan hediye çeki ve ödül puanı ile kargo kuralı esas alınarak yapılır."
  - Öneri: §4.4 D9.

**17. Stok Yönetimi ve Stok Tükenmesi**

- Satır 3549 · `Ö10` `D2` `D3`
  - Mevcut: "İade, ödemenin alındığı yöntemle iyzico üzerinden yapılır ve bankanın hesabınıza yansıtma süresi saklı kalmak kaydıyla en geç on dört gün içinde gerçekleştirilir; siparişte ödül puanı kullanılmışsa puanla karşılanan kısım puan olarak geri yüklenir."
  - Öneri: §3.3 Ö10, §4.4 D2, §4.4 D3.

**18. Kampanya ve Promosyon Kodu Kuralları**

- Satır 3558 · `D9`
  - Mevcut: "Promosyon kodu ile ödül puanının aynı sepette birlikte kullanılıp kullanılamayacağı kampanya koşullarında ayrıca belirtilir."
  - Öneri: §4.4 D9.

**20. Ödül Puanı Programı Kuralları**

- Satır 3583 · `D1` `D9`
  - Mevcut: "20. Ödül Puanı Programı Kuralları"
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 3585 · `D1` `D9`
  - Mevcut: "{{BRAND}} ödül programı kapsamında bottega alışverişlerinden ve kafe ziyaretlerinden ödül puanı kazanılır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 3585 · `Q2`
  - Mevcut: "Kafedeki kazanım, mobil uygulamadaki kamera ile kasada gösterilen QR kodun okutulması yoluyla yapılır."
  - Öneri: §7.3-7.4 Q2.
- Satır 3585 · `D1` `D8`
  - Mevcut: "Kazanım oranları, puanın geçerlilik süresi ve varsa kampanya çarpanları program sayfasında ve uygulama içinde açıkça gösterilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D8.
- Satır 3586 · `D1` `D9`
  - Mevcut: "Ödül puanı bir ödeme aracı, elektronik para, menkul kıymet veya yatırım aracı değildir; yalnızca {{SHORT_NAME}} tarafından satılan ürünlerde kullanılabilen bir indirim hakkıdır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 3586 · `D1` `D2` `D3`
  - Mevcut: "Puan nakde çevrilemez, banka hesabına aktarılamaz, üçüncü kişilere devredilemez veya satılamaz ve karşılığında para iadesi talep edilemez."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 3587 · `D1` `D2`
  - Mevcut: "Puan, ödeme adımında indirim olarak uygulanır ve karşılığı sepet tutarından düşülür."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 3587 · `Ö1` `D1` `D2`
  - Mevcut: "Puanla karşılanmayan bakiye kart ile iyzico üzerinden ödenir."
  - Öneri: §3.3 Ö1, §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 3587 · `D1` `D2`
  - Mevcut: "Puanla karşılanan kısım fatura üzerinde indirim olarak gösterilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 3588 · `D1` `D9`
  - Mevcut: "Puan üyelik hesabına bağlıdır ve hesaptan bağımsız olarak kullanılamaz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 3588 · `D1` `D2`
  - Mevcut: "Hesabın kapatılması hâlinde kullanılmamış puanlar sona erer ve bunlar için herhangi bir bedel ödenmez."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 3588 · `D1` `D2`
  - Mevcut: "Hesabın Üyelik Sözleşmesine aykırılık nedeniyle askıya alınması hâlinde puan kullanımı da askıda kalır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 3589 · `D1` `D2` `D3`
  - Mevcut: "Puanla kısmen veya tamamen ödenen bir siparişin iadesi ya da cayma hakkının kullanılması hâlinde, puanla karşılanan kısım aynı tutarda puan olarak hesabınıza geri yüklenir; kart ile ödenen kısım ise ödemenin alındığı karta iade edilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 3589 · `D1` `D3`
  - Mevcut: "Geri yüklenen puanın geçerlilik süresi iade tarihinden itibaren yeniden işlemeye başlar."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D3.
- Satır 3590 · `D1` `D2` `D3`
  - Mevcut: "Bir siparişten kazanılan puanlar, o sipariş iade edildiğinde veya iptal edildiğinde geri alınır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 3591 · `D1` `D2`
  - Mevcut: "Satış politikası kapsamında, ödül puanının bu politikaya veya programın amacına aykırı biçimde kullanıldığının tespit edilmesi hâlinde kazanılmış puanlar iptal edilebilir, puan kullanımı durdurulabilir ve program üyeliği sona erdirilebilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 3592 · `D1` `D9`
  - Mevcut: "Program koşulları, kazanım oranları ve puanın geçerlilik süresi ileriye etkili olarak değiştirilebilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 3592 · `D1` `D2`
  - Mevcut: "Esaslı değişiklikler yürürlüğe girmeden makul bir süre önce duyurulur ve halihazırda kazanılmış puanların kullanım hakkı, duyurulan geçiş süresi içinde korunur."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.

**21. Kampanya, Kod, Hediye Çeki ve Ödül Puanının Kötüye Kullanımı**

- Satır 3597 · `D1` `D9`
  - Mevcut: "21. Kampanya, Kod, Hediye Çeki ve Ödül Puanının Kötüye Kullanımı"
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 3599 · `D1` `D3` `D6`
  - Mevcut: "Kötüye kullanım tespit edilen siparişlerde indirim ve kullanılan ödül puanı geri alınır, gerektiğinde puan bakiyesi iptal edilir, sipariş iptal edilir ve tahsil edilmiş tutar iade edilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D3, §4.4 D6.
- Satır 3610 · `D1` `D4` `Q4`
  - Mevcut: "Gerçek bir alışveriş veya kafe ziyareti olmaksızın QR kodun tekrar tekrar okutulması ya da üçüncü kişilerle paylaşılması yoluyla ödül puanı kazanılmaya çalışılması."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §7.4 Q4.
- Satır 3611 · `D1` `D6`
  - Mevcut: "Ödül puanı bakiyesinin ticari amaçla üçüncü kişilere devredilmesi, satılması veya nakde çevrilmeye çalışılması."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D6.
- Satır 3612 · `D1` `D9`
  - Mevcut: "Ödül puanı kazanımını artırmak amacıyla otomatik yazılım, betik veya değiştirilmiş uygulama sürümü kullanılması."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.

**22. Siparişi Reddetme ve Onaylamama Hakkı**

- Satır 3628 · `Ö5`
  - Mevcut: "Ödemenin banka veya iyzico tarafından reddedilmesi, provizyonun alınamaması ya da iyzico tarafından yürütülen 3D Secure doğrulamasının tamamlanmaması."
  - Öneri: §3.3 Ö5.
- Satır 3632 · `D7`
  - Mevcut: "Kampanya, promosyon kodu, hediye çeki veya ödül puanı mekanizmalarının kötüye kullanıldığının tespit edilmesi."
  - Öneri: §4.4 D7.

**23. Dolandırıcılık ve Risk Kontrolü**

- Satır 3638 · `Ö13`
  - Mevcut: "Kart ile yapılan ödemelerde, hem kart hamilinin hem de Satıcının korunması amacıyla, {{SHORT_NAME}} tarafından yürütülen kontrollere ek olarak iyzico tarafından sağlanan otomatik risk değerlendirmesi uygulanır."
  - Öneri: §3.3 Ö13.
- Satır 3656 · `D9`
  - Mevcut: "Ödül puanı kazanımının veya kullanımının otomatik araçlarla olağan dışı biçimde tetiklenmesi."
  - Öneri: §4.4 D9.

**24. Kurumsal Faturalı Satış**

- Satır 3665 · `E1`
  - Mevcut: "Faturalar elektronik ortamda düzenlenir ve siparişte belirtilen e-posta adresine iletilir."
  - Öneri: §11 E1.
- Satır 3665 · `E1`
  - Mevcut: "Fatura, kargo paketi içinde basılı olarak gönderilmez; bu uygulama hem kâğıt tüketimini azaltmakta hem de faturaya erişimi kolaylaştırmaktadır."
  - Öneri: §11 E1.

**25. Teslimat Bölgesi, KKTC ve Yurt Dışı Satış Kısıtları**

- Satır 3672 · `V2`
  - Mevcut: "Teslimat, Türkiye Cumhuriyeti sınırları içinde Yurtiçi Kargo ile; Kuzey Kıbrıs Türk Cumhuriyeti ve seçili yurt dışı adreslerine Aras Kargo ile; İstanbul içinde ayrıca motokurye ile yapılır."
  - Öneri: §9.2 V2.
- Satır 3677 · `Ö1`
  - Mevcut: "Yurt dışı kart ile yapılan ödemelerde tahsilat Türk Lirası üzerinden iyzico aracılığıyla yapılır; banka tarafından uygulanan döviz dönüşüm kuru ve komisyonlar {{SHORT_NAME}} tarafından belirlenmez ve tahsil edilmez."
  - Önerilen: "Yurt dışı kart ile yapılan ödemelerde tahsilat Türk Lirası üzerinden PayNkolay aracılığıyla yapılır; banka tarafından uygulanan döviz dönüşüm kuru ve komisyonlar {{SHORT_NAME}} tarafından belirlenmez ve tahsil edilmez."

**30. Uygulama, İhlal Bildirimi ve İletişim**

- Satır 3726 · `D9`
  - Mevcut: "Politika ihlali nedeniyle uygulanabilecek tedbirler; ilgili ürün kaydının kaldırılması, siparişin iptali, promosyon avantajının veya ödül puanının geri alınması, hesabın geçici kısıtlanması ve ağır hâllerde hesabın kapatılmasıdır."
  - Öneri: §4.4 D9.

**31. Politikanın Güncellenmesi, Yürürlük ve Sürümleme**

- Satır 3773 · `D6`
  - Mevcut: "Satılmayan ürün listesine ekleme yapılması, miktar sınırlarının değiştirilmesi ile kampanya ve ödül puanı kurallarının esaslı biçimde değiştirilmesi gibi tüketici açısından önem taşıyan değişiklikler, yürürlüğe girmeden makul bir süre önce sitede duyurulur; kayıtlı kullanıcılara ayrıca bilgilendirme e-postası gönderilir."
  - Öneri: §4.4 D6.

</details>

<details>
<summary><b>Ödeme Koşulları ve Sanal POS</b> (<code>odeme-kosullari</code>) - 98 cümle</summary>

Kod dağılımı: Ö1 20, D2 18, D1 14, D3 7, D9 7, Ö10 7, Ö3 7, Ö6 7, Ö5 6, Ö11 4, Ö2 4, Ö8 4, D4 3, E1 3, Ö9 3, D6 2, K1 2, Q1 2, V2 2, C1 1, C2 1, D5 1, D7 1, D8 1, Q2 1, Ö12 1, Ö14 1, Ö18 1, Ö4 1, Ö7 1


**(belge başı)**

- Satır 3786 · `Ö8` `Ö10` `Ö5` `Ö3` `Ö2` `D2` `D3`
  - Mevcut: "{{SITE}} ve {{BRAND}} mobil uygulamasındaki ödemelerin yetkili ödeme kuruluşu iyzico ile nasıl alındığını; Checkout Form akışını, 3D Secure, taksit, puanla kısmi ödeme, iade, mükerrer çekim ve kart itirazı süreçlerini düzenler."
  - Öneri: §3.3 Ö8, §3.3 Ö10, §3.3 Ö5, §3.3 Ö3, §3.3 Ö2, §4.4 D2, §4.4 D3.

**1. Amaç, Kapsam ve Taraflar**

- Satır 3812 · `Ö2`
  - Mevcut: "Kart ile yapılan ödemeler, 6493 sayılı Kanun kapsamında yetkilendirilmiş ödeme kuruluşu iyzico üzerinden alınır."
  - Öneri: §3.3 Ö2.
- Satır 3812 · `Ö1`
  - Mevcut: "Bu metinde ödeme kuruluşu denildiğinde iyzico anlaşılır; başka bir ödeme kuruluşu veya sanal POS sağlayıcısı kullanılmamaktadır."
  - Önerilen: "Bu metinde ödeme hizmeti sağlayıcısı denildiğinde PayNkolay anlaşılır; başka bir ödeme hizmeti sağlayıcısı veya sanal POS sağlayıcısı kullanılmamaktadır."

**2. Tanımlar**

- Satır 3820 · `Ö2`
  - Mevcut: "iyzico: Ödemelerin kabul edildiği, 6493 sayılı Kanun kapsamında faaliyet gösteren yetkili ödeme kuruluşu."
  - Öneri: §3.3 Ö2.
- Satır 3820 · `Ö10`
  - Mevcut: "Kart ile yapılan tüm tahsilat, iade ve kısmi iade işlemleri iyzico üzerinden yürütülür."
  - Öneri: §3.3 Ö10.
- Satır 3821 · `Ö3`
  - Mevcut: "Checkout Form: Kart bilgilerinin doğrudan iyzico ortamında girildiği, iyzico tarafından barındırılan güvenli ödeme sayfası."
  - Öneri: §3.3 Ö3.
- Satır 3831 · `D5` `D2`
  - Mevcut: "Ödül puanı: Üyelik hesabına bağlı olarak alışverişten veya kafe ziyaretinden kazanılan, yalnızca {{BRAND}} siparişlerinde indirim olarak kullanılabilen, para niteliği taşımayan ve nakde çevrilemeyen dijital puan."
  - Öneri: §4.4 D5, §4.4 D2.

**3. Satıcı (Üye İş Yeri) Künyesi**

- Satır 3837 · `Ö1`
  - Mevcut: "Kart ekstrenizde görünecek üye iş yeri adı, bankanın ve iyzico'nun kayıt biçimine göre {{BRAND}} veya {{SHORT_NAME}} olarak yer alabilir."
  - Önerilen: "Kart ekstrenizde görünecek üye iş yeri adı, bankanın ve PayNkolay'ın kayıt biçimine göre {{BRAND}} veya {{SHORT_NAME}} olarak yer alabilir."
- Satır 3898 · `Ö1`
  - Mevcut: "iyzico"
  - Önerilen: "PayNkolay"

**4. Fiyatlandırma, Para Birimi ve Vergiler**

- Satır 3906 · `Ö1`
  - Mevcut: "Bu yöntem, ondalık yuvarlama farklarından doğan tutar uyuşmazlıklarını önler; iyzico'ya iletilen tutar ile ekranda gördüğünüz tutar birebir aynıdır."
  - Önerilen: "Bu yöntem, ondalık yuvarlama farklarından doğan tutar uyuşmazlıklarını önler; PayNkolay'a iletilen tutar ile ekranda gördüğünüz tutar birebir aynıdır."

**5. Kabul Edilen Ödeme Yöntemleri**

- Satır 3914 · `Ö1`
  - Mevcut: "Kart ile yapılan ödemelerin tamamı iyzico sanal POS altyapısı üzerinden alınır."
  - Önerilen: "Kart ile yapılan ödemelerin tamamı PayNkolay sanal POS altyapısı üzerinden alınır."
- Satır 3914 · `Ö11`
  - Mevcut: "Ödeme sayfasında hangi yöntemlerin aktif olduğu, sipariş tutarına, teslimat ülkesine ve iyzico'nun o andaki hizmet kapsamına göre değişebilir; nihai liste ödeme adımında gösterilir."
  - Öneri: §3.3 Ö11.
- Satır 3919 · `Ö5`
  - Mevcut: "3D Secure ile doğrulanmış kart işlemleri: Kart hamilinin bankası tarafından ek doğrulama istenen güvenli akış; doğrulama iyzico tarafından yürütülür."
  - Öneri: §3.3 Ö5.
- Satır 3920 · `Ö8`
  - Mevcut: "Taksitli ödeme: Yalnızca taksite uygun kredi kartlarında ve iyzico ödeme sayfasında gösterilen taksit adetleriyle."
  - Öneri: §3.3 Ö8.
- Satır 3921 · `D2`
  - Mevcut: "Ödül puanı ile kısmi ödeme: Üyelik hesabınızdaki puanın, sipariş bedelinden düşülmesi suretiyle kullanılması; kalan tutar kart ile ödenir."
  - Öneri: §4.4 D2.
- Satır 3923 · `Ö11`
  - Mevcut: "Dijital cüzdan ve mobil ödeme çözümleri: iyzico'nun desteklediği ölçüde ödeme sayfasında sunulur."
  - Öneri: §3.3 Ö11.
- Satır 3926 · `Ö1`
  - Mevcut: "Uygulama mağazası (App Store, Google Play) üzerinden uygulama içi satın alma yöntemi kullanılmaz; mobil uygulamadaki ödemeler de iyzico üzerinden alınır."
  - Önerilen: "Uygulama mağazası (App Store, Google Play) üzerinden uygulama içi satın alma yöntemi kullanılmaz; mobil uygulamadaki ödemeler de PayNkolay üzerinden alınır."

**6. Sipariş Tutarının Sunucu Tarafında Yeniden Hesaplanması**

- Satır 3932 · `Ö1`
  - Mevcut: "Ödeme tutarı hiçbir koşulda tarayıcınızdan, mobil uygulamanızdan veya sepet verisinden gelen değerle iyzico'ya iletilmez."
  - Önerilen: "Ödeme tutarı hiçbir koşulda tarayıcınızdan, mobil uygulamanızdan veya sepet verisinden gelen değerle PayNkolay'a iletilmez."
- Satır 3933 · `Ö1`
  - Mevcut: "Bu hesaplama zinciri kırılmadan işletilir ve sonucunda oluşan tutar, ödeme isteğiyle birlikte iyzico'ya gönderilen tek geçerli tutardır."
  - Önerilen: "Bu hesaplama zinciri kırılmadan işletilir ve sonucunda oluşan tutar, ödeme isteğiyle birlikte PayNkolay'a gönderilen tek geçerli tutardır."
- Satır 3943 · `D2`
  - Mevcut: "Ödül puanı kullanıldıysa, puan karşılığı indirim bu tutardan düşülür ve kalan tutar kart ile tahsil edilecek tutar olarak belirlenir."
  - Öneri: §4.4 D2.
- Satır 3944 · `Ö1`
  - Mevcut: "Yalnızca bu nihai tutar üzerinden iyzico'ya ödeme isteği gönderilir."
  - Önerilen: "Yalnızca bu nihai tutar üzerinden PayNkolay'a ödeme isteği gönderilir."

**8. Ödül Puanı ile Kısmi Ödeme**

- Satır 3957 · `D1` `D9`
  - Mevcut: "8. Ödül Puanı ile Kısmi Ödeme"
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 3959 · `D1` `D4` `Q1`
  - Mevcut: "{{BRAND}} ödül programı kapsamında, üyelik hesabınızla yaptığınız alışverişlerden ve kafede QR okutarak gerçekleştirdiğiniz ziyaretlerden ödül puanı kazanırsınız."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §7.4 Q1.
- Satır 3959 · `D1` `D9`
  - Mevcut: "Kazanılan puan, üyelik hesabınıza bağlıdır; başka bir hesaba devredilemez, üçüncü kişilere satılamaz ve nakde çevrilemez."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 3960 · `D1` `D2`
  - Mevcut: "Ödül puanı bir ödeme aracı, elektronik para veya mevduat değildir; yalnızca {{BRAND}} siparişlerinde indirim olarak kullanılabilen dijital bir katılım hakkıdır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 3960 · `D1` `D9`
  - Mevcut: "Puanın kullanım oranı (kaç puanın kaç TL indirime karşılık geldiği), asgari kullanım eşiği ve bir siparişte kullanılabilecek azami puan miktarı ödül programı koşullarında ve ödeme adımında açıkça gösterilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 3961 · `D1` `D2`
  - Mevcut: "Puanla ödenen kısım, KDV dâhil sipariş bedelinden indirim olarak düşülür ve kart ile tahsil edilen tutar yalnızca kalan bakiyedir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 3961 · `D1` `D2`
  - Mevcut: "Puan karşılığı düşülen tutar, sipariş özetinde ve faturada ayrı bir satır olarak gösterilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 3961 · `D1` `D2`
  - Mevcut: "Puanla ödenen bir siparişte kart provizyonu, yalnızca kalan TL tutarı için oluşturulur."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 3962 · `D1` `D2` `D3`
  - Mevcut: "Siparişin iptali, cayma hakkının kullanılması veya iade hâlinde, puanla ödenen kısma karşılık gelen puan üyelik hesabınıza geri yüklenir; kart veya banka transferi ile ödenen TL kısmı ise ödemenin yapıldığı kanala iade edilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 3962 · `D1` `D3`
  - Mevcut: "Kısmi iadelerde puan, iade edilen kalemlere düşen oran kadar geri yüklenir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D3.
- Satır 3963 · `D1` `D9`
  - Mevcut: "Ödül puanı üyeliğe bağlı olduğundan, üyelik hesabının kullanıcı tarafından kapatılması veya ödül programı koşullarında öngörülen hâllerde sona ermesi durumunda birikmiş puan da sona erer ve bedele dönüştürülmez."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 3963 · `D1` `D2`
  - Mevcut: "Programın tamamen sonlandırılması hâlinde, sonlandırma makul bir süre önceden duyurulur ve o tarihe kadar puanlarınızı kullanma imkânı tanınır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 3964 · `D1` `D2` `D3`
  - Mevcut: "Puan kazanımı ve kullanımına ilişkin kayıtlar (kazanılan, harcanan, iade ile geri yüklenen puan ve tarihleri) üyelik hesabınızdan görüntülenebilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 3964 · `D1` `D2` `D7`
  - Mevcut: "Kötüye kullanım, sahte işlem veya iptal edilen sipariş üzerinden kazanılmış puanlar geri alınabilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D7.

**9. Kargo Ücretinin Ödemeye Yansıması**

- Satır 3990 · `V2`
  - Mevcut: "Yurtiçi Kargo"
  - Öneri: §9.2 V2.
- Satır 3994 · `V2`
  - Mevcut: "Aras Kargo"
  - Öneri: §9.2 V2.

**10. Ödemenin iyzico Üzerinden Alınması ve Kart Verisinin Saklanmaması**

- Satır 4000 · `Ö1`
  - Mevcut: "10. Ödemenin iyzico Üzerinden Alınması ve Kart Verisinin Saklanmaması"
  - Önerilen: "10. Ödemenin PayNkolay Üzerinden Alınması ve Kart Verisinin Saklanmaması"
- Satır 4002 · `Ö2`
  - Mevcut: "Kart ile yapılan ödemeler, {{SITE}} tarafından değil; 6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun uyarınca yetkilendirilmiş ödeme kuruluşu iyzico'nun sanal POS altyapısı üzerinden alınır."
  - Öneri: §3.3 Ö2.
- Satır 4003 · `Ö3`
  - Mevcut: "Ödeme adımında, iyzico Checkout Form akışı kullanılır: sepetinizi onayladıktan sonra iyzico'nun barındırdığı güvenli ödeme sayfasına yönlendirilirsiniz veya bu sayfa, {{SITE}} üzerinde yalıtılmış bir çerçeve içinde açılır."
  - Öneri: §3.3 Ö3.
- Satır 4003 · `Ö3`
  - Mevcut: "Kart bilgilerinizi girdiğiniz ekran her hâlde iyzico'nun kendi ortamıdır; Satıcının bu ekranın içeriğine erişimi yoktur."
  - Öneri: §3.3 Ö3.
- Satır 4005 · `Ö4`
  - Mevcut: "Kart verisinin işlenmesi, iletilmesi ve saklanmasına ilişkin PCI-DSS standardına uygunluk yükümlülüğü, bu verileri işleyen iyzico'ya aittir."
  - Öneri: §3.3 Ö4.
- Satır 4005 · `Ö1`
  - Mevcut: "Satıcı, entegrasyonu iyzico'nun belirlediği güvenli yönteme göre kurar ve kart verisini kendi sistemlerine hiç almaz."
  - Önerilen: "Satıcı, entegrasyonu PayNkolay'ın belirlediği güvenli yönteme göre kurar ve kart verisini kendi sistemlerine hiç almaz."
- Satır 4006 · `Ö8` `Ö5` `Ö7`
  - Mevcut: "Satıcının sistemlerinde ödeme işlemine ilişkin olarak yalnızca kart verisi niteliği taşımayan işlem üstverileri tutulur: iyzico işlem referans numarası, işlem durumu, tutar, para birimi, işlem zamanı, taksit adedi, 3D Secure doğrulama sonucu ve kart markası ile kart numarasının maskelenmiş son dört hanesi gibi kayıtlar."
  - Öneri: §3.3 Ö8, §3.3 Ö5, §3.3 Ö7.
- Satır 4007 · `Ö18`
  - Mevcut: "Kart saklama (tokenizasyon) özelliği kullanıma sunulursa, kart bilgisi yine Satıcıda değil iyzico nezdinde saklanır ve Satıcıya yalnızca kart verisi içermeyen, tek başına ödeme yapmaya elverişli olmayan bir simge (token) iletilir."
  - Öneri: §3.3 Ö18.

**11. 3D Secure Doğrulama Akışı**

- Satır 4013 · `Ö5`
  - Mevcut: "Kart ile yapılan ödemelerde, kartı çıkaran bankanın ve kart kuruluşu kurallarının izin verdiği ölçüde 3D Secure doğrulaması uygulanır ve bu doğrulama iyzico tarafından yürütülür."
  - Öneri: §3.3 Ö5.
- Satır 4017 · `D9`
  - Mevcut: "Sunucu, siparişi 'ödeme bekliyor' durumunda oluşturur ve nihai tutarı 6. maddedeki yöntemle yeniden hesaplar; ödül puanı kullandıysanız kart ile tahsil edilecek tutar buna göre belirlenir."
  - Öneri: §4.4 D9.
- Satır 4018 · `Ö3`
  - Mevcut: "iyzico Checkout Form açılır ve kart bilgileriniz doğrudan iyzico ortamına girilir; bu veri Satıcı sunucularından geçmez."
  - Öneri: §3.3 Ö3.
- Satır 4019 · `Ö5`
  - Mevcut: "iyzico, kartın 3D Secure programına kayıtlı olup olmadığını sorgular ve sizi kartı çıkaran bankanın doğrulama ekranına yönlendirir."
  - Öneri: §3.3 Ö5.
- Satır 4021 · `Ö5`
  - Mevcut: "Doğrulama başarılıysa banka, işleme ilişkin doğrulama sonucunu iyzico'ya iletir ve otorizasyon (provizyon) talebi oluşturulur."
  - Öneri: §3.3 Ö5.
- Satır 4022 · `Ö6`
  - Mevcut: "Provizyon onaylanırsa iyzico, sonucu hem tarayıcınıza veya mobil uygulamanıza hem de sunucumuza imzalı bildirim (webhook) ile iletir."
  - Öneri: §3.3 Ö6.
- Satır 4024 · `Ö6`
  - Mevcut: "İmza geçerli olsa dahi sonuç tek başına esas alınmaz: sunucu, işlem referansıyla iyzico'ya yeniden sorarak ödemenin gerçekten başarılı olduğunu ve tutarın sipariş tutarıyla uyuştuğunu teyit eder."
  - Öneri: §3.3 Ö6.
- Satır 4025 · `D2` `E1`
  - Mevcut: "Teyit olumluysa sipariş 'ödendi' durumuna geçer, stok düşülür, ödül puanı işlenir, sipariş onay e-postası gönderilir ve fatura süreci başlar."
  - Öneri: §4.4 D2, §11 E1.
- Satır 4026 · `D2`
  - Mevcut: "Doğrulama, provizyon veya teyit başarısızsa sipariş 'ödeme bekliyor' durumunda kalır, stok düşülmez, puan harcanmaz ve size hata nedeni gösterilerek yeniden deneme imkânı sunulur."
  - Öneri: §4.4 D2.

**12. Ön Provizyon ve Provizyon Kapama**

- Satır 4033 · `Ö9`
  - Mevcut: "Sipariş hazırlanmaya alındığında ön provizyon iyzico üzerinden kapatılır (capture) ve tutar bu aşamada tahsil edilir."
  - Öneri: §3.3 Ö9.
- Satır 4034 · `Ö9`
  - Mevcut: "Bu süre Satıcının denetiminde değildir; ancak Satıcı, serbest bırakma talimatının iyzico'ya iletildiğine dair kaydı talebiniz üzerine sizinle paylaşır."
  - Öneri: §3.3 Ö9.

**13. Taksit, Vade Farkı ve Banka Kampanyaları**

- Satır 4041 · `Ö8`
  - Mevcut: "Taksitli ödeme yalnızca taksite uygun kredi kartlarında ve iyzico ödeme sayfasında o an gösterilen taksit seçenekleriyle mümkündür."
  - Öneri: §3.3 Ö8.

**15. Dijital Cüzdan ve Alternatif Ödeme Yöntemleri**

- Satır 4082 · `Ö11`
  - Mevcut: "iyzico'nun desteklemesi hâlinde dijital cüzdan ve mobil ödeme çözümleri ödeme sayfasında sunulur."
  - Öneri: §3.3 Ö11.
- Satır 4082 · `Ö11`
  - Mevcut: "Bu yöntemlerde de kart veya hesap bilgileriniz {{SITE}} sunucularına iletilmez; doğrulama ve tahsilat tamamen iyzico ile ilgili cüzdan sağlayıcısının ortamında gerçekleşir ve Satıcıya yalnızca işlem sonucu bildirilir."
  - Öneri: §3.3 Ö11.

**16. Mobil Uygulama Üzerinden Ödeme**

- Satır 4090 · `D4` `D6` `Q1`
  - Mevcut: "Uygulama üzerinden menüyü görüntüleyebilir, sipariş verebilir, üyelik hesabınızı yönetebilir, ödül puanı bakiyenizi takip edebilir ve kafede QR okutarak puan kazanabilirsiniz."
  - Öneri: §4.4 D4, §4.4 D6, §7.4 Q1.
- Satır 4091 · `Ö3`
  - Mevcut: "Uygulama içindeki ödemeler de aynı biçimde iyzico Checkout Form üzerinden alınır."
  - Öneri: §3.3 Ö3.
- Satır 4091 · `Ö3`
  - Mevcut: "Uygulama mağazasının kendi uygulama içi satın alma altyapısı kullanılmaz; kart bilgileriniz uygulamaya değil, iyzico'nun güvenli ödeme ekranına girilir ve Satıcı sunucularından geçmez."
  - Öneri: §3.3 Ö3.
- Satır 4093 · `D4` `K1` `Q2`
  - Mevcut: "Uygulama, ödeme ve sipariş süreçleri için cihaz izinlerine ihtiyaç duyabilir: sipariş ve teslimat bildirimleri için bildirim izni, kafede puan kazanımı ve kupon okutma için kamera (QR) izni, teslimat adresi önerisi için yaklaşık konum izni."
  - Öneri: §4.4 D4, §6 K1, §7.3-7.4 Q2.
- Satır 4094 · `D6`
  - Mevcut: "Uygulamanın cihazınızdan kaldırılması, o ana kadar oluşmuş sipariş, ödeme, fatura ve puan kayıtlarını sona erdirmez; bu kayıtlara {{SITE_URL}} adresinden üyelik hesabınızla erişmeye devam edebilirsiniz."
  - Öneri: §4.4 D6.

**17. Başarısız Ödeme ve Yeniden Deneme**

- Satır 4101 · `D2`
  - Mevcut: "Ödemenin başarısız olması hâlinde siparişiniz oluşmaz veya 'ödeme bekliyor' durumunda kalır; stok düşülmez, ödül puanı harcanmış sayılmaz ve hiçbir tutar tahsil edilmez."
  - Öneri: §4.4 D2.
- Satır 4101 · `Ö1`
  - Mevcut: "Size gösterilen hata mesajı, iyzico ve bankanın döndüğü sonuç koduna göre olabildiğince anlaşılır biçimde açıklanır; ancak güvenlik gereği bankalar red gerekçesini her zaman ayrıntılı bildirmez."
  - Önerilen: "Size gösterilen hata mesajı, PayNkolay ve bankanın döndüğü sonuç koduna göre olabildiğince anlaşılır biçimde açıklanır; ancak güvenlik gereği bankalar red gerekçesini her zaman ayrıntılı bildirmez."
- Satır 4103 · `Ö1`
  - Mevcut: "Yeniden denemede sipariş numarası korunur, tutar 6. maddedeki yöntemle yeniden hesaplanır ve iyzico nezdinde yeni bir işlem referansı üretilir."
  - Önerilen: "Yeniden denemede sipariş numarası korunur, tutar 6. maddedeki yöntemle yeniden hesaplanır ve PayNkolay nezdinde yeni bir işlem referansı üretilir."
- Satır 4104 · `Ö9`
  - Mevcut: "Blokenin makul sürede çözülmemesi hâlinde {{EMAIL}} adresine yazmanız durumunda işlem kaydınızı sizinle paylaşır ve iyzico nezdinde takip başlatırız."
  - Öneri: §3.3 Ö9.

**18. Mükerrer Çekim, Idempotency ve Tekillik Güvencesi**

- Satır 4110 · `Ö6`
  - Mevcut: "iyzico'dan gelen her başarılı ödeme bildirimi, iyzico'nun ürettiği tekil işlem referans numarası ile birlikte kaydedilir."
  - Öneri: §3.3 Ö6.
- Satır 4110 · `D2`
  - Mevcut: "Bu referans, veri tabanında tekil (unique) kısıt altındadır; aynı referansla ikinci bir bildirim gelse dahi sipariş yalnızca bir kez 'ödendi' durumuna geçer, ikinci kayıt oluşturulmaz, stok ikinci kez düşülmez ve puan ikinci kez işlenmez."
  - Öneri: §4.4 D2.
- Satır 4111 · `Ö6`
  - Mevcut: "Bu tasarım, ağ kesintisi veya iyzico'nun bildirimi yeniden denemesi nedeniyle aynı bildirimin birden çok kez ulaşması hâlinde bile mükerrer sipariş ve mükerrer stok hareketi oluşmasını engeller."
  - Öneri: §3.3 Ö6.
- Satır 4111 · `Ö6`
  - Mevcut: "Bildirim uçları imza doğrulaması yapar; imzası geçersiz bildirimler işleme alınmaz ve her bildirimin sonucu ayrıca iyzico'ya yeniden sorularak teyit edilir."
  - Öneri: §3.3 Ö6.
- Satır 4112 · `Ö12`
  - Mevcut: "Tespit için iyzico işlem kayıtları ile banka mutabakat dosyaları karşılaştırılır."
  - Öneri: §3.3 Ö12.

**19. Ödeme Öncesi Onay, Delil Kaydı ve Sözleşme Sürümü**

- Satır 4122 · `Ö1`
  - Mevcut: "Taraflar; sipariş kayıtlarının, iyzico işlem kayıtlarının, sunucu günlüklerinin, değiştirilemez yönetici olay kayıtlarının (audit log) ve elektronik posta kayıtlarının, 6100 sayılı Hukuk Muhakemeleri Kanunu'nun delil sözleşmesine ilişkin hükmü (m.193) uyarınca delil teşkil edeceğini kabul eder."
  - Önerilen: "Taraflar; sipariş kayıtlarının, PayNkolay işlem kayıtlarının, sunucu günlüklerinin, değiştirilemez yönetici olay kayıtlarının (audit log) ve elektronik posta kayıtlarının, 6100 sayılı Hukuk Muhakemeleri Kanunu'nun delil sözleşmesine ilişkin hükmü (m.193) uyarınca delil teşkil edeceğini kabul eder."

**20. Fatura ve e-Arşiv**

- Satır 4128 · `E1`
  - Mevcut: "Ödemesi tamamlanan her sipariş için 213 sayılı Vergi Usul Kanunu ve ilgili tebliğler uyarınca e-arşiv fatura düzenlenir."
  - Öneri: §11 E1.
- Satır 4128 · `E1`
  - Mevcut: "Fatura, sipariş sırasında bildirdiğiniz fatura bilgileri esas alınarak kesilir ve doğrulanmış e-posta adresinize elektronik ortamda gönderilir; ayrıca sipariş kaydınızdan indirilebilir."
  - Öneri: §11 E1.
- Satır 4131 · `D9`
  - Mevcut: "Ödül puanı ile ödenen kısım fatura üzerinde indirim olarak gösterilir; fatura tutarı, tahsil edilen TL bedeli ile puan indirimini ayrı ayrı yansıtacak biçimde düzenlenir."
  - Öneri: §4.4 D9.
- Satır 4132 · `Ö10`
  - Mevcut: "Bu belge, iade tutarının iyzico üzerinden gönderilmesinin ön koşulu değildir; muhasebe kaydının tamamlanması amacıyla istenir."
  - Öneri: §3.3 Ö10.

**21. İptal, Cayma ve İade Sürecinin Ödeme Ayağı**

- Satır 4140 · `Ö10`
  - Mevcut: "Kart ile yapılan ödemelerin iadesi ve kısmi iadesi, iyzico API'si üzerinden ilgili işlem referansına bağlanarak gerçekleştirilir."
  - Öneri: §3.3 Ö10.
- Satır 4140 · `D3`
  - Mevcut: "Ödül puanı ile ödenen kısım ise karta iade edilmez; bu kısma karşılık gelen puan üyelik hesabınıza geri yüklenir."
  - Öneri: §4.4 D3.
- Satır 4142 · `Ö10`
  - Mevcut: "İadenin iyzico'ya iletilmesi genellikle aynı iş günü içinde tamamlanır."
  - Öneri: §3.3 Ö10.

**22. Kısmi İade ve Kısmi İptal**

- Satır 4150 · `D3`
  - Mevcut: "Ödül puanı kullanılmışsa, puan da aynı oranda hesabınıza geri yüklenir ve kalan kısım için kart iadesi yapılır."
  - Öneri: §4.4 D3.
- Satır 4152 · `Ö10`
  - Mevcut: "Kısmi iadeler iyzico API'si üzerinden ayrı işlemler olarak iletilir ve her biri kendi iade referansıyla kaydedilir."
  - Öneri: §3.3 Ö10.

**23. Chargeback (Kart İtirazı) Süreci**

- Satır 4159 · `Ö1`
  - Mevcut: "Satıcı, kendisine iletilen itirazlara ilişkin belgeleri kart kuruluşunun tanıdığı süre içinde iyzico aracılığıyla sunar."
  - Önerilen: "Satıcı, kendisine iletilen itirazlara ilişkin belgeleri kart kuruluşunun tanıdığı süre içinde PayNkolay aracılığıyla sunar."

**24. Yurt Dışı Kart Kullanımı ve Döviz**

- Satır 4176 · `Ö1`
  - Mevcut: "Yurt dışında ihraç edilmiş bir kartla ödeme yapmanız hâlinde de iyzico üzerinden bankaya iletilen tutar TRY'dir; kartınızın para birimine dönüşüm, kartı çıkaran banka veya kart kuruluşu tarafından kendi kur ve komisyon politikasına göre yapılır."
  - Önerilen: "Yurt dışında ihraç edilmiş bir kartla ödeme yapmanız hâlinde de PayNkolay üzerinden bankaya iletilen tutar TRY'dir; kartınızın para birimine dönüşüm, kartı çıkaran banka veya kart kuruluşu tarafından kendi kur ve komisyon politikasına göre yapılır."

**25. Ödeme Güvenliği ve Dolandırıcılık Kontrolü**

- Satır 4189 · `Ö1`
  - Mevcut: "Kart verisi yalnızca iyzico ortamında işlendiğinden Satıcı sistemlerine hiç girmez; bu veriye yönelik bir sızıntı riski Satıcı tarafında oluşmaz."
  - Önerilen: "Kart verisi yalnızca PayNkolay ortamında işlendiğinden Satıcı sistemlerine hiç girmez; bu veriye yönelik bir sızıntı riski Satıcı tarafında oluşmaz."
- Satır 4190 · `Ö6`
  - Mevcut: "iyzico'dan gelen ödeme bildirimleri (webhook) HMAC-SHA256 imzası ile doğrulanır ve karşılaştırma zamanlama saldırılarına kapalı yöntemle yapılır; imzası geçersiz bildirim 401 ile reddedilir."
  - Öneri: §3.3 Ö6.
- Satır 4191 · `Ö6`
  - Mevcut: "İmzası doğrulanan her bildirimin sonucu, işlem referansıyla iyzico'ya yeniden sorularak teyit edilir; teyit edilmeyen bildirim siparişin durumunu değiştirmez."
  - Öneri: §3.3 Ö6.
- Satır 4192 · `D9`
  - Mevcut: "Tutar, promosyon, ödül puanı ve stok doğrulaması yalnızca sunucuda yapılır; istemciden gelen hiçbir fiyat bilgisine güvenilmez."
  - Öneri: §4.4 D9.
- Satır 4197 · `D2`
  - Mevcut: "Anormal sipariş örüntüleri (kısa sürede çok sayıda başarısız deneme, uyuşmayan fatura ve teslimat bilgileri, riskli tutar sıçramaları, olağan dışı puan kullanımı) manuel incelemeye alınabilir."
  - Öneri: §4.4 D2.

**26. Ödeme Verilerinin İşlenmesi ve Saklanması**

- Satır 4205 · `D2` `D8`
  - Mevcut: "Ödül programı kapsamındaki puan ve harcama geçmişi de bu kapsamda işlenir; bu verilerin kişiye özel kampanya üretimi amacıyla profilleme yoluyla işlenmesi ise yalnızca açık rızanıza dayanır ve rızanızı her zaman geri alabilirsiniz."
  - Öneri: §4.4 D2, §4.4 D8.
- Satır 4207 · `Ö1`
  - Mevcut: "iyzico ile paylaşılan veriler, işlemin gerçekleştirilmesi için zorunlu olan asgari veriyle sınırlıdır."
  - Önerilen: "PayNkolay ile paylaşılan veriler, işlemin gerçekleştirilmesi için zorunlu olan asgari veriyle sınırlıdır."
- Satır 4208 · `C1` `C2` `K1`
  - Mevcut: "Mobil uygulama kullanımında ayrıca cihaz tanımlayıcıları (IDFA/AAID), push bildirim tokeni, uygulama sürümü, işletim sistemi bilgisi ve çökme (crash) kayıtları işlenebilir; yaklaşık konum verisi yalnızca izin vermeniz hâlinde işlenir."
  - Öneri: §5.2 C1, §5.2 C2, §6 K1.

**27. Ödeme Altyapısı Kesintileri ve Mücbir Sebep**

- Satır 4215 · `Ö1`
  - Mevcut: "Banka, iyzico, kart kuruluşu, barındırma veya veri tabanı sağlayıcısı kaynaklı kesinti, bakım ve arıza hâllerinde ödeme geçici olarak alınamayabilir."
  - Önerilen: "Banka, PayNkolay, kart kuruluşu, barındırma veya veri tabanı sağlayıcısı kaynaklı kesinti, bakım ve arıza hâllerinde ödeme geçici olarak alınamayabilir."
- Satır 4218 · `Ö10`
  - Mevcut: "Böyle bir değişiklik bu metnin güncellenmesi ve sitede duyurulması suretiyle yürürlüğe girer; değişiklik, halihazırda tamamlanmış işlemlerin iade ve itiraz süreçlerini etkilemez ve bu işlemler iyzico kayıtları üzerinden yürütülmeye devam eder."
  - Öneri: §3.3 Ö10.

**29. Ödemeye İlişkin Başvuru, İletişim ve Uyuşmazlık Çözümü**

- Satır 4232 · `D3`
  - Mevcut: "Ödeme, iade, ödül puanı, mükerrer çekim ve fatura konularındaki tüm başvurularınızı aşağıdaki kanallardan iletebilirsiniz."
  - Öneri: §4.4 D3.
- Satır 4235 · `Ö1`
  - Mevcut: "iyzico veya banka kaynaklı olduğu tespit edilen konularda başvurunuzu ilgili kuruluşa yönlendirmeniz gerekebilir; bu hâlde hangi kuruluşa, hangi bilgilerle başvurmanız gerektiği tarafınıza açıkça bildirilir."
  - Önerilen: "PayNkolay veya banka kaynaklı olduğu tespit edilen konularda başvurunuzu ilgili kuruluşa yönlendirmeniz gerekebilir; bu hâlde hangi kuruluşa, hangi bilgilerle başvurmanız gerektiği tarafınıza açıkça bildirilir."

**30. Yürürlük, Değişiklik ve Sürümleme**

- Satır 4279 · `Ö14`
  - Mevcut: "iyzico entegrasyonu canlıya alınana kadar ödeme adımı, gerçek bir tahsilat yapmayan test (mock) sağlayıcı ile çalışabilir."
  - Öneri: §3.3 Ö14 (çıkarılır).

</details>

<details>
<summary><b>Güvenli Alışveriş ve Bilgi Güvenliği</b> (<code>guvenli-alisveris</code>) - 48 cümle</summary>

Kod dağılımı: D9 9, Ö1 9, D2 6, Ö6 5, D4 4, Ö3 4, D6 3, D7 3, Ö5 3, Q1 2, Q4 2, Ö10 2, Ö4 2, C3 1, D3 1, D5 1, K1 1, Q2 1, V2 1, Ö2 1, Ö7 1


**(belge başı)**

- Satır 4290 · `Ö1`
  - Mevcut: "{{BRAND}} web sitesi ve mobil uygulamasında kişisel verilerinizin ve ödeme işlemlerinizin hangi tedbirlerle korunduğunu, kart bilgilerinizin neden iyzico altyapısında kalıp bizde saklanmadığını ve güvenli alışveriş için alabileceğiniz önlemleri açıklar."
  - Önerilen: "{{BRAND}} web sitesi ve mobil uygulamasında kişisel verilerinizin ve ödeme işlemlerinizin hangi tedbirlerle korunduğunu, kart bilgilerinizin neden PayNkolay altyapısında kalıp bizde saklanmadığını ve güvenli alışveriş için alabileceğiniz önlemleri açıklar."

**1. Amaç, Kapsam ve Tanımlar**

- Satır 4319 · `D9`
  - Mevcut: "Bu Güvenli Alışveriş ve Bilgi Güvenliği Politikası, {{SITE_URL}} adresinde {{BRAND}} markasıyla yayımlanan internet sitesi, online mağaza (bottega) ve iOS ile Android için yayımlanan {{BRAND}} mobil uygulaması üzerinden gerçekleştirilen üyelik, sipariş, ödeme, ödül puanı ve teslimat süreçlerinde kişisel verilerin ve işlem güvenliğinin nasıl sağlandığını açıklamak amacıyla hazırlanmıştır."
  - Öneri: §4.4 D9.
- Satır 4320 · `D9`
  - Mevcut: "Politika; site ve uygulama ziyaretçilerini, e-posta adresi doğrulanmış üye hesabı sahiplerini, sipariş veren tüketicileri, ödül puanı programına katılan üyeleri, {{SHORT_NAME}} çalışanlarını ve Şirket adına veri işleyen tedarikçileri kapsar."
  - Öneri: §4.4 D9.
- Satır 4332 · `D5` `D2`
  - Mevcut: "Ödül Puanı: Alışveriş ve kafe ziyaretleri karşılığında üye hesabına tanımlanan, yalnızca indirim olarak kullanılabilen, para niteliği taşımayan ve nakde çevrilemeyen dijital puandır."
  - Öneri: §4.4 D5, §4.4 D2.

**3. Bilgi Güvenliği Yönetim İlkelerimiz**

- Satır 4415 · `Ö1`
  - Mevcut: "Ödeme kartı verisi bu ilkenin en belirgin uygulamasıdır: kart verisi iyzico altyapısında kalır, bizde hiç toplanmaz, dolayısıyla bizden hiç sızdırılamaz."
  - Önerilen: "Ödeme kartı verisi bu ilkenin en belirgin uygulamasıdır: kart verisi PayNkolay altyapısında kalır, bizde hiç toplanmaz, dolayısıyla bizden hiç sızdırılamaz."

**5. Üyelik, Kimlik Doğrulama ve Parola Güvenliği**

- Satır 4441 · `D9`
  - Mevcut: "Online mağazadan sipariş verebilmek ve ödül puanı biriktirebilmek için e-posta adresi doğrulanmış bir üye hesabı gereklidir."
  - Öneri: §4.4 D9.
- Satır 4441 · `D7`
  - Mevcut: "Bu zorunluluk yalnızca operasyonel bir tercih değil, aynı zamanda sahte sipariş, kimlik taklidi, puan kötüye kullanımı ve ödeme sahteciliği riskini azaltan bir güvenlik tedbiridir."
  - Öneri: §4.4 D7.
- Satır 4452 · `D9`
  - Mevcut: "Ödül puanı üyeliğe bağlıdır ve devredilemez; hesabınızın kapatılması halinde birikmiş puan sona erer."
  - Öneri: §4.4 D9.
- Satır 4452 · `D4` `Q1`
  - Mevcut: "Kafede QR okutarak puan kazanma işlemi yalnızca oturum açmış uygulama üzerinden yapılır ve her QR kodu süreli ve tek kullanımlıktır."
  - Öneri: §4.4 D4, §7.4 Q1.
- Satır 4453 · `D2`
  - Mevcut: "Puan bakiyenizde tanımadığınız bir hareket görürseniz parolanızı değiştirip {{EMAIL}} adresine bildirin; şüpheli puan hareketleri incelenirken ilgili puanlar geçici olarak dondurulabilir."
  - Öneri: §4.4 D2.

**9. Veri Tabanı Güvenliği, Erişim Kısıtı ve Anahtar Yönetimi**

- Satır 4506 · `D9`
  - Mevcut: "Müşteri, sipariş, puan ve ürün verileri, {{DB_PROVIDER}} (PostgreSQL) üzerinde barındırılan yönetilen bir PostgreSQL veri tabanında saklanır; uygulama bu veri tabanına standart PostgreSQL sürücüsü ile bağlanır."
  - Öneri: §4.4 D9.

**10. Ödeme Güvenliği: Kart Verisi iyzico Altyapısında Kalır**

- Satır 4520 · `Ö1`
  - Mevcut: "10. Ödeme Güvenliği: Kart Verisi iyzico Altyapısında Kalır"
  - Önerilen: "10. Ödeme Güvenliği: Kart Verisi PayNkolay Altyapısında Kalır"
- Satır 4522 · `Ö3`
  - Mevcut: "Sanal POS hizmeti iyzico'dan alınır; ödeme adımı iyzico'nun Checkout Form ekranında açılır ve kart bilgileriniz doğrudan iyzico'nun şifreli altyapısına iletilir."
  - Öneri: §3.3 Ö3.
- Satır 4523 · `Ö4` `Ö2`
  - Mevcut: "Kart verisinin güvenliği ve PCI-DSS uyumluluğu, kart verisini fiilen işleyen iyzico ile kartı çıkaran banka nezdindeki sorumluluktur. iyzico, 6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun kapsamında yetkilendirilmiş bir ödeme kuruluşudur."
  - Öneri: §3.3 Ö4, §3.3 Ö2.
- Satır 4524 · `Ö5`
  - Mevcut: "3D Secure doğrulaması iyzico tarafından yürütülür."
  - Öneri: §3.3 Ö5.
- Satır 4524 · `Ö6`
  - Mevcut: "Ödeme sonucu bize imzalı bildirim (webhook) ile ulaşır ve sonuç ayrıca iyzico'ya yeniden sorularak teyit edilir; yalnızca teyit edilen ödemeler siparişi ilerletir."
  - Öneri: §3.3 Ö6.
- Satır 4524 · `Ö1`
  - Mevcut: "Mobil uygulama üzerinden verilen siparişlerde de ödeme aynı iyzico akışıyla alınır; uygulama mağazası içi satın alma yöntemi kullanılmaz."
  - Önerilen: "Mobil uygulama üzerinden verilen siparişlerde de ödeme aynı PayNkolay akışıyla alınır; uygulama mağazası içi satın alma yöntemi kullanılmaz."
- Satır 4527 · `Ö5`
  - Mevcut: "Kart ile yapılan ödemelerde, iyzico'nun ve kartı çıkaran bankanın desteklediği ölçüde 3D Secure ek doğrulama adımı uygulanır; işlem, banka tarafından telefonunuza iletilen tek kullanımlık kod veya bankacılık uygulaması onayı ile tamamlanır."
  - Öneri: §3.3 Ö5.
- Satır 4528 · `Ö7`
  - Mevcut: "Sistemimizde işleme dair yalnızca kartın son dört hanesi, kart markası, işlem tutarı, para birimi, işlem tarihi, sonuç kodu ve iyzico'nun ürettiği işlem referansı gibi kart verisi niteliği taşımayan bilgiler tutulur."
  - Öneri: §3.3 Ö7.
- Satır 4529 · `Ö1`
  - Mevcut: "Sepetteki her kalemin fiyatı, sunucu tarafında ürün kaydından yeniden hesaplanır; kargo bedeli ve yüzde 20 KDV dahil nihai tutar sunucuda oluşturulur ve iyzico'ya bu tutar iletilir."
  - Önerilen: "Sepetteki her kalemin fiyatı, sunucu tarafında ürün kaydından yeniden hesaplanır; kargo bedeli ve yüzde 20 KDV dahil nihai tutar sunucuda oluşturulur ve PayNkolay'a bu tutar iletilir."
- Satır 4530 · `D6`
  - Mevcut: "Promosyon kodları ve ödül puanı kullanımı sunucu tarafında doğrulanır; geçerlilik tarihi, kullanım limiti, asgari sepet tutarı ve puan bakiyesi istemciden bağımsız olarak kontrol edilir."
  - Öneri: §4.4 D6.
- Satır 4531 · `Ö1` `D2`
  - Mevcut: "Ödül puanıyla ödenen kısım sipariş bedelinden düşülür ve iyzico'ya yalnızca kalan TL tutar için ödeme talimatı verilir."
  - Öneri: §3.3 Ö1, §4.4 D2.
- Satır 4531 · `D9`
  - Mevcut: "Puan para değildir, nakde çevrilemez ve üçüncü kişilere devredilemez."
  - Öneri: §4.4 D9.
- Satır 4532 · `D2` `D3`
  - Mevcut: "İade halinde, siparişin puanla karşılanan kısmı hesabınıza puan olarak geri yüklenir; TL olarak tahsil edilen kısım ödemenin yapıldığı karta ve aynı kanal üzerinden iade edilir."
  - Öneri: §4.4 D2, §4.4 D3.
- Satır 4535 · `Ö10`
  - Mevcut: "İade ve kısmi iade işlemleri iyzico API'si üzerinden, ödemenin yapıldığı karta ve aynı ödeme kanalı ile gerçekleştirilir; nakit veya farklı bir hesaba iade yapılmaz."
  - Öneri: §3.3 Ö10.
- Satır 4536 · `Ö1`
  - Mevcut: "Kart hamilinin bankası nezdinde başlattığı ödeme itirazı (chargeback) süreçlerinde, sipariş kaydı, sözleşme onayı, teslimat belgesi ve olay kayıtları delil olarak iyzico'ya sunulur."
  - Önerilen: "Kart hamilinin bankası nezdinde başlattığı ödeme itirazı (chargeback) süreçlerinde, sipariş kaydı, sözleşme onayı, teslimat belgesi ve olay kayıtları delil olarak PayNkolay'a sunulur."

**11. Sipariş Onayının Kayıt Altına Alınması**

- Satır 4544 · `Ö3`
  - Mevcut: "Onayın ispatına hizmet eden bu kayıtlar, 6100 sayılı Hukuk Muhakemeleri Kanunu'nun delil sözleşmesine ilişkin hükmü çerçevesinde taraflar arasında delil olarak kullanılabilir ve iyzico'ya veya bankaya karşı yürütülen itiraz süreçlerinde ibraz edilir."
  - Öneri: §3.3 Ö3.
- Satır 4551 · `D9`
  - Mevcut: "Sipariş numarası, sipariş kalemleri, birim fiyatlar, kullanılan ödül puanı, kargo bedeli, KDV ve toplam tutar."
  - Öneri: §4.4 D9.

**12. Webhook İmza Doğrulama ve Mükerrer İşlem Önleme**

- Satır 4558 · `Ö6`
  - Mevcut: "iyzico'nun ödeme sonucunu sistemimize bildirmek için kullandığı sunucudan sunucuya bildirim (webhook) uç noktası, kimliği doğrulanmamış isteklere kapalıdır."
  - Öneri: §3.3 Ö6.
- Satır 4558 · `Ö6`
  - Mevcut: "Bir ödemenin başarılı sayılması, yalnızca imzası doğrulanmış bir bildirim ve bu bildirimin ardından iyzico'ya yapılan doğrulama sorgusu ile mümkündür; tarayıcıdan veya uygulamadan gelen bir yönlendirme tek başına ödemenin gerçekleştiği anlamına gelmez."
  - Öneri: §3.3 Ö6.
- Satır 4565 · `Ö6`
  - Mevcut: "İmza geçerliyse, bildirimdeki iyzico işlem referansı ödeme işlemleri tablosunda benzersizlik kısıtı ile kontrol edilir."
  - Öneri: §3.3 Ö6.
- Satır 4567 · `Ö6`
  - Mevcut: "Sonuç, iyzico'ya yeniden sorularak teyit edilir; teyit edilmeyen hiçbir bildirim siparişi ödenmiş duruma geçirmez."
  - Öneri: §3.3 Ö6.
- Satır 4568 · `D2`
  - Mevcut: "Yeni ve teyit edilmiş bir referans ise sipariş durumu güncellenir, stok düşülür, varsa ödül puanı işlenir ve tüm adımlar olay kaydına yazılır."
  - Öneri: §4.4 D2.

**14. Mobil Uygulama Güvenliği**

- Satır 4590 · `D4` `Q1`
  - Mevcut: "{{BRAND}} mobil uygulaması; menü görüntüleme, sipariş verme, üyelik, ödül puanı takibi, kafede QR okutarak puan kazanma ve bildirim alma işlevlerini sunar."
  - Öneri: §4.4 D4, §7.4 Q1.
- Satır 4591 · `Ö3`
  - Mevcut: "Ödeme adımı iyzico'nun güvenli ekranında açılır; uygulama mağazası üzerinden satın alma yapılmaz."
  - Öneri: §3.3 Ö3.
- Satır 4591 · `K1` `Q2`
  - Mevcut: "Uygulamanın cihazınızda talep ettiği izinler (bildirim, kamera, konum) yalnızca ilgili özellik kullanıldığında istenir ve her biri cihaz ayarlarından geri alınabilir."
  - Öneri: §6 K1, §7.3-7.4 Q2.
- Satır 4596 · `D9`
  - Mevcut: "Kırılmış (jailbreak veya root) cihazlarda işletim sisteminin uygulamalar arası yalıtımı zayıflar; oturum bilgisi ve ödül puanı hesabınız bu tür cihazlarda ek risk altındadır."
  - Öneri: §4.4 D9.
- Satır 4602 · `D4` `Q4`
  - Mevcut: "Kafede puan kazanmak için okutulan QR kodları süreli ve tek kullanımlıktır; sosyal medyada paylaşılan veya size bilinmeyen bir kişi tarafından gönderilen QR kodlarını okutmayın."
  - Öneri: §4.4 D4, §7.4 Q4.

**15. Günlük Kayıtları, İzleme ve Kişisel Verinin Maskelenmesi**

- Satır 4615 · `C3`
  - Mevcut: "Mobil uygulamada çökme (crash) ve hata kayıtları, uygulama sürümü ile işletim sistemi bilgisi kararlılığı artırmak amacıyla toplanabilir; bu kayıtlarda kart bilgisi, parola ve bildirim belirteci taşınmaz."
  - Öneri: §5.2 C3.

**16. Yedekleme, Felaket Kurtarma ve İş Sürekliliği**

- Satır 4624 · `D9`
  - Mevcut: "Sipariş, müşteri, puan ve ürün verileri {{DB_PROVIDER}} (PostgreSQL) tarafında sunulan yönetilen yedekleme altyapısıyla düzenli olarak yedeklenir; yedekler şifreli olarak saklanır ve erişimleri kısıtlıdır."
  - Öneri: §4.4 D9.

**17. Veri Saklama ve İmha**

- Satır 4645 · `D6`
  - Mevcut: "Ödül puanı bakiyesi ve puan hareketleri, üyelik devam ettiği sürece tutulur; hesabın kapatılmasıyla puan sona erer ve bakiye kaydı yalnızca ispat ve muhasebe yükümlülüğünün gerektirdiği ölçüde saklanır."
  - Öneri: §4.4 D6.

**18. Veri İhlali Yönetimi ve Bildirim**

- Satır 4665 · `Ö1`
  - Mevcut: "Diğer bildirimler: Ödeme sürecine ilişkin bir olay söz konusu ise iyzico ve ilgili banka bilgilendirilir; suç teşkil eden bir fiil bulunması halinde yetkili makamlara başvurulur."
  - Önerilen: "Diğer bildirimler: Ödeme sürecine ilişkin bir olay söz konusu ise PayNkolay ve ilgili banka bilgilendirilir; suç teşkil eden bir fiil bulunması halinde yetkili makamlara başvurulur."

**19. Sorumlu Açıklama (Responsible Disclosure) Programı**

- Satır 4681 · `Ö1`
  - Mevcut: "Kapsam dışı diğer konular: yalnızca teorik olan ve sömürülebilirliği gösterilmeyen bulgular, üçüncü taraf platformlarına (sosyal medya, iyzico, uygulama mağazaları, kargo firması) ait sistemler, en iyi uygulama önerisi niteliğindeki başlık ve yapılandırma uyarıları, güncel olmayan tarayıcı ve işletim sistemi sürümlerine özgü sorunlar."
  - Önerilen: "Kapsam dışı diğer konular: yalnızca teorik olan ve sömürülebilirliği gösterilmeyen bulgular, üçüncü taraf platformlarına (sosyal medya, PayNkolay, uygulama mağazaları, kargo firması) ait sistemler, en iyi uygulama önerisi niteliğindeki başlık ve yapılandırma uyarıları, güncel olmayan tarayıcı ve işletim sistemi sürümlerine özgü sorunlar."

**21. Oltalama (Phishing), Sahte Site ve Sahte Uygulama Uyarısı**

- Satır 4718 · `D6`
  - Mevcut: "Puanınızın sona ereceği, hesabınızın kapanacağı ya da hediye puan tanımlandığı iddiasıyla sizi acele ettiren ve bağlantıya tıklatmaya çalışan mesajlar tipik oltalama yöntemidir; puan bakiyenizi yalnızca uygulama içinden veya {{SITE_URL}} adresinden kontrol edin."
  - Öneri: §4.4 D6.

**22. Tedarikçi ve Alt İşleyen Güvenliği**

- Satır 4744 · `Ö10` `Ö4` `Ö5` `Ö3`
  - Mevcut: "iyzico; kart verisinin işlenmesi, Checkout Form ekranı, 3D Secure doğrulaması, PCI-DSS uyumu ile iade ve itiraz süreçleri iyzico ve ilgili banka sorumluluğundadır. Şirketimiz kart verisi tutmaz."
  - Öneri: §3.3 Ö10, §3.3 Ö4, §3.3 Ö5, §3.3 Ö3.
- Satır 4759 · `V2`
  - Mevcut: "Yurtiçi Kargo (Türkiye geneli), Aras Kargo (KKTC ve yurt dışı) ve İstanbul içi motokurye hizmeti; yalnızca teslimat için gerekli ad, adres ve telefon bilgisi paylaşılır."
  - Öneri: §9.2 V2.

**23. Yasaklı Kullanım ve Sistem Güvenliğinin İhlali**

- Satır 4776 · `D2` `D7`
  - Mevcut: "Bu tür fiillerin tespiti halinde ilgili hesap askıya alınır, haksız kazanılan ödül puanları iptal edilir, gerekli görülürse yetkili makamlara başvurulur ve doğan zararların tazmini talep edilir."
  - Öneri: §4.4 D2, §4.4 D7.
- Satır 4784 · `D4` `D7` `Q4`
  - Mevcut: "Promosyon kodlarını veya ödül puanı programını amacı dışında, mükerrer hesaplar açarak, QR kodlarını çoğaltarak ya da teknik yöntemlerle kötüye kullanmak."
  - Öneri: §4.4 D4, §4.4 D7, §7.4 Q4.

</details>

<details>
<summary><b>Gizlilik Politikası</b> (<code>gizlilik-politikasi</code>) - 68 cümle</summary>

Kod dağılımı: D2 12, D1 11, K1 9, D6 8, C2 6, D3 6, D4 6, Q2 6, C3 5, F1 5, C1 4, D8 4, D9 4, Ö10 4, Ö5 4, Q1 3, Ö3 3, Ö7 3, T1 2, Ö1 2, Ö2 2, Ö4 2, Ö6 2, Ö8 2, Ö9 2, D5 1, D7 1, V1 1, V2 1, Ö13 1


**(belge başı)**

- Satır 4886 · `T1`
  - Mevcut: "Avrupa Birliği Genel Veri Koruma Tüzüğü [U+2014] (AB) 2016/679 (GDPR)"
  - Önerilen: "Avrupa Birliği Genel Veri Koruma Tüzüğü - (AB) 2016/679 (GDPR)"

**1. Kapsam, Amaç ve Veri Sorumlusunun Kimliği**

- Satır 4895 · `D9` `F1`
  - Mevcut: "Politika; web sitesi ve mobil uygulama kullanıcılarını, üye hesabı açan müşterileri, sipariş veren alıcı ve kargo alıcılarını, ödül ve puan programına katılan müşterileri, kafe ziyaretçilerini, kurumsal ve bayilik başvurusu yapan kişileri, tedarikçi ve iş ortağı çalışanlarını ve Şirkete herhangi bir kanaldan başvuran kişileri kapsar."
  - Öneri: §4.4 D9, §10 F1.

**2. Tanımlar**

- Satır 4973 · `D5` `D2`
  - Mevcut: "Ödül (puan) programı: {{BRAND}} üyelerinin alışverişten ve kafe ziyaretinden puan kazandığı, kazanılan puanı sonraki alışverişlerinde indirim olarak kullanabildiği sadakat programı."
  - Öneri: §4.4 D5, §4.4 D2.

**3. İşlenen Kişisel Veri Kategorileri**

- Satır 5001 · `Ö8` `Ö10` `Ö7` `D2` `D3`
  - Mevcut: "Sipariş numarası, sipariş tarihi, sipariş kanalı (web sitesi, mobil uygulama veya kafe), sepet içeriği (ürün, varyant, adet), birim ve toplam tutar (TRY, kuruş bazında), KDV tutarı, uygulanan promosyon kodu, puanla karşılanan tutar, kargo bedeli, ödeme yöntemi, taksit bilgisi, işlem durumu (başarılı/başarısız/iade), ödeme kuruluşu iyzico'dan dönen işlem referansı ve maskelenmiş kart bilgisi (ilk 6 - son 4 hane, kart markası). Kart numarasının tamamı, son kullanma tarihi ve CVV bilgisi Şirket sistemlerine hiçbir aşamada girmez."
  - Öneri: §3.3 Ö8, §3.3 Ö10, §3.3 Ö7, §4.4 D2, §4.4 D3.
- Satır 5011 · `C3`
  - Mevcut: "IP adresi, tarayıcı türü ve sürümü (user-agent), işletim sistemi ve sürümü, cihaz türü, dil ve saat dilimi, oturum kimliği, ziyaret edilen sayfa ve uygulama ekranları, gezinme yolu, yönlendiren adres (referrer), hata ve performans kayıtları, sunucu erişim logları."
  - Öneri: §5.2 C3.
- Satır 5041 · `C1` `C2`
  - Mevcut: "Reklam ve ölçümleme amaçlı cihaz tanımlayıcıları (iOS için IDFA, Android için AAID), uygulama örneği kimliği, push bildirim tokeni ve bildirim izni durumu, uygulama sürümü, işletim sistemi ve sürümü, cihaz modeli ve dil ayarı, çökme (crash) ve hata ayıklama kayıtları."
  - Öneri: §5.2 C1, §5.2 C2.
- Satır 5044 · `K1`
  - Mevcut: "Konum verisi (izne bağlı)"
  - Öneri: §6 K1.
- Satır 5046 · `K1`
  - Mevcut: "Yalnızca cihaz izni vermeniz hâlinde, en yakın şubenin gösterilmesi ve teslimat adresi önerisi amacıyla işlenen yaklaşık konum bilgisi. İzin verilmemesi hâlinde uygulamanın diğer işlevleri kullanılabilir."
  - Öneri: §6 K1.
- Satır 5049 · `Q2`
  - Mevcut: "Kamera erişimi (QR okuma)"
  - Öneri: §7.3-7.4 Q2.
- Satır 5051 · `D4` `Q2`
  - Mevcut: "Kafede puan kazanımı ve kampanya doğrulaması için QR kodun okunması amacıyla, yalnızca izin vermeniz hâlinde kullanılan kamera erişimi. Kamera görüntüsü kaydedilmez, sunucuya aktarılmaz ve saklanmaz; yalnızca okunan QR kodun içerdiği kod değeri işlenir."
  - Öneri: §4.4 D4, §7.3-7.4 Q2.
- Satır 5054 · `D6`
  - Mevcut: "Ödül ve puan programı verisi"
  - Öneri: §4.4 D6.
- Satır 5056 · `D2` `D3`
  - Mevcut: "Üyeliğe bağlı puan bakiyesi, puan hareketleri (kazanım, harcama, iptal, iade ile geri yükleme, süre sonu), puanın kazanıldığı işlem ve kanal, harcama geçmişi ve program kapsamında tanımlanan kademe/kampanya bilgileri."
  - Öneri: §4.4 D2, §4.4 D3.
- Satır 5066 · `F1`
  - Mevcut: "Bayilik/franchise, toptan satış, iş birliği ve tedarik başvurularında iletilen ad-soyad, unvan, şirket bilgisi, iletişim bilgileri ve başvuru içeriği."
  - Öneri: §10 F1.

**4. Kişisel Verilerin Toplanma Yöntemleri**

- Satır 5076 · `F1`
  - Mevcut: "Elektronik formlar: Web sitesi ve mobil uygulamadaki üyelik kaydı, e-posta doğrulama, giriş, parola sıfırlama, adres ekleme, sepet ve ödeme adımı formları ile iletişim, bayilik ve toptan satış başvuru formları."
  - Öneri: §10 F1.
- Satır 5077 · `Ö7`
  - Mevcut: "Sipariş ve ödeme akışı: Ödeme adımında verdiğiniz bilgiler ile ödeme kuruluşu iyzico'dan Şirkete dönen işlem sonucu, referans numarası ve maskelenmiş kart bilgisi."
  - Öneri: §3.3 Ö7.
- Satır 5080 · `C2` `C3` `K1` `Q2`
  - Mevcut: "Mobil uygulama: Uygulamayı indirip kullanmanız hâlinde, uygulama tarafından otomatik olarak üretilen cihaz ve sürüm bilgileri, çökme kayıtları, push bildirim tokeni ile cihaz ayarlarından verdiğiniz bildirim, konum ve kamera izinleri kapsamında elde edilen veriler."
  - Öneri: §5.2 C2, §5.2 C3, §6 K1, §7.3-7.4 Q2.
- Satır 5081 · `D4` `D6`
  - Mevcut: "Kafe ziyareti: {{ADDRESS}} adresindeki işletmede yapılan satın alma ve rezervasyon işlemleri, masa/paket sipariş kayıtları, kasada veya mobil uygulamayla okutulan QR kod üzerinden puan kazanım işlemleri ve güvenlik kamerası görüntüleri."
  - Öneri: §4.4 D4, §4.4 D6.
- Satır 5084 · `Ö6`
  - Mevcut: "Üçüncü taraflar: Kargo firmalarından gelen teslimat durum bildirimleri, ödeme kuruluşu iyzico'dan gelen işlem ve itiraz (chargeback) bildirimleri, e-posta gönderim sağlayıcısından gelen teslim/açılma durum bilgileri, push bildirim altyapısından gelen iletim durumu ve yetkili kamu kurumlarından gelen bildirimler."
  - Öneri: §3.3 Ö6.

**5. İşleme Amaçları ve Hukuki Sebepler**

- Satır 5120 · `Ö9` `Ö10` `Ö5`
  - Mevcut: "Ödemenin ödeme kuruluşu iyzico üzerinden tahsil edilmesi, 3D Secure doğrulaması, ön provizyon, iade ve itiraz (chargeback) süreçlerinin yürütülmesi"
  - Öneri: §3.3 Ö9, §3.3 Ö10, §3.3 Ö5.
- Satır 5147 · `T1`
  - Mevcut: "Açık rıza (KVKK m.5/1) [U+2014] çerez izin panelinden verilen onay"
  - Önerilen: "Açık rıza (KVKK m.5/1) - çerez izin panelinden verilen onay"
- Satır 5159 · `D2` `D3`
  - Mevcut: "Ödül (puan) programı kapsamında puan kazandırılması, bakiyenin takibi, puanın indirim olarak kullanılması ve iade hâlinde geri yüklenmesi"
  - Öneri: §4.4 D2, §4.4 D3.
- Satır 5164 · `D4` `D7` `Q1`
  - Mevcut: "Kafede QR kod okutularak puan kazanımının doğrulanması ve kötüye kullanımın önlenmesi"
  - Öneri: §4.4 D4, §4.4 D7, §7.4 Q1.
- Satır 5168 · `C3`
  - Mevcut: "Mobil uygulamanın kurulması, çalıştırılması, sürüm uyumluluğunun sağlanması ile çökme ve hata kayıtlarının incelenerek kararlılığın artırılması"
  - Öneri: §5.2 C3.
- Satır 5182 · `K1`
  - Mevcut: "Yaklaşık konum bilgisiyle en yakın şubenin gösterilmesi ve teslimat adresi önerisi sunulması"
  - Öneri: §6 K1.
- Satır 5183 · `K1`
  - Mevcut: "Açık rıza (KVKK m.5/1) ve cihaz konum izni"
  - Öneri: §6 K1.
- Satır 5205 · `F1`
  - Mevcut: "Bayilik, toptan satış ve iş birliği başvurularının değerlendirilmesi"
  - Öneri: §10 F1.

**6. Açık Rızaya Dayalı İşlemeler ve Rızanın Geri Alınması**

- Satır 5220 · `K1` `Q2`
  - Mevcut: "Mobil uygulamaya ilişkin bildirim, konum ve kamera izinlerini cihazınızın işletim sistemi ayarlarından dilediğiniz zaman kapatabilir; uygulamayı cihazınızdan kaldırarak da bu izinleri sonlandırabilirsiniz."
  - Öneri: §6 K1, §7.3-7.4 Q2.
- Satır 5226 · `C1`
  - Mevcut: "Analitik ve pazarlama amaçlı çerezler, mobil uygulamadaki ölçümleme SDK'ları ve cihaz tanımlayıcıları (IDFA/AAID) ile benzer izleme teknolojilerinin kullanılması."
  - Öneri: §5.2 C1.
- Satır 5227 · `D2` `D8`
  - Mevcut: "Kişiselleştirilmiş içerik ve ürün önerisi sunulması amacıyla alışveriş geçmişinin, puan ve harcama hareketlerinin analiz edilmesi (profilleme)."
  - Öneri: §4.4 D2, §4.4 D8.
- Satır 5228 · `K1`
  - Mevcut: "Mobil uygulamada yaklaşık konum bilgisinin en yakın şubenin gösterilmesi amacıyla işlenmesi."
  - Öneri: §6 K1.

**8. Kişisel Verilerin Aktarıldığı Taraf Kategorileri**

- Satır 5250 · `Ö1`
  - Mevcut: "Ödeme kuruluşu iyzico ve sanal POS hizmeti veren bankalar"
  - Önerilen: "Ödeme hizmeti sağlayıcısı PayNkolay ve sanal POS hizmeti veren bankalar"
- Satır 5252 · `Ö9` `Ö8` `Ö10` `Ö4` `Ö5` `Ö3` `Ö2` `Ö7`
  - Mevcut: "Ödemenin tahsili, 3D Secure doğrulaması, ön provizyon, taksitlendirme, iade, kısmi iade ve itiraz süreçlerinin yürütülmesi. Ödeme sayfası iyzico'nun Checkout Form altyapısında açılır; kart numarası, son kullanma tarihi ve CVV bilgisi hiçbir aşamada Şirket sunucularından geçmez ve saklanmaz. PCI-DSS yükümlülüğü, 6493 sayılı Kanun kapsamında yetkilendirilmiş ödeme kuruluşu olan iyzico'ya aittir; Şirkete yalnızca işlem sonucu, referans numarası ve maskelenmiş kart bilgisi döner."
  - Öneri: §3.3 Ö9, §3.3 Ö8, §3.3 Ö10, §3.3 Ö4, §3.3 Ö5, §3.3 Ö3, §3.3 Ö2, §3.3 Ö7.
- Satır 5257 · `V2`
  - Mevcut: "Gönderinin teslimi amacıyla alıcı adı, adresi ve telefonunun aktarılması; Türkiye geneli için Yurtiçi Kargo, KKTC ve yurt dışı gönderiler için Aras Kargo, İstanbul içi hızlı teslimat için motokurye hizmeti."
  - Öneri: §9.2 V2.
- Satır 5277 · `C2`
  - Mevcut: "Mobil uygulamanın App Store ve Google Play üzerinden dağıtılması ile işlemsel ve izne bağlı pazarlama bildirimlerinin cihazınıza iletilmesi amacıyla, bildirim tokeni ve iletilecek mesaj içeriğiyle sınırlı olarak. Uygulama mağazaları, indirme ve mağaza hesabınıza ilişkin veriler bakımından kendi gizlilik politikaları çerçevesinde bağımsız veri sorumlusudur."
  - Öneri: §5.2 C2.
- Satır 5282 · `C3`
  - Mevcut: "Açık rızanıza bağlı olarak web sitesi ve mobil uygulama kullanımının istatistiksel ölçümü ile çökme kayıtlarının incelenmesi; mümkün olan hâllerde IP kısaltma ve takma adlaştırma uygulanır."
  - Öneri: §5.2 C3.

**9. Yurt Dışına Aktarım**

- Satır 5319 · `C2` `V1`
  - Mevcut: "Şirketin kullandığı bulut barındırma, veri tabanı, e-posta gönderim, push bildirim ve analitik hizmetlerinin bir kısmı yurt dışında yerleşik sağlayıcılar tarafından sunulmakta olup, bu kapsamda kişisel verileriniz yurt dışında bulunan sunuculara aktarılabilmekte veya buralardan erişilebilmektedir."
  - Öneri: §5.2 C2, §9.1 V1 (Supabase eklenir).

**10. Saklama Süreleri ve İmha**

- Satır 5388 · `F1`
  - Mevcut: "Bayilik ve iş birliği başvuruları"
  - Öneri: §10 F1.
- Satır 5393 · `C2`
  - Mevcut: "Mobil uygulama cihaz verileri ve push bildirim tokeni"
  - Öneri: §5.2 C2.
- Satır 5403 · `D6`
  - Mevcut: "Ödül ve puan programı kayıtları"
  - Öneri: §4.4 D6.
- Satır 5405 · `D6`
  - Mevcut: "Üyelik devam ettiği sürece; hesabın kapatılmasıyla puan bakiyesi sona erer, puan hareketlerine ilişkin kayıtlar ise mali mevzuat ve yasal zamanaşımı süreleri boyunca saklanır."
  - Öneri: §4.4 D6.

**11. Otomatik Karar Verme ve Profilleme**

- Satır 5413 · `Ö5` `Ö13`
  - Mevcut: "Ödeme adımında ödeme kuruluşu iyzico ve kart çıkaran banka tarafından yürütülen risk ve dolandırıcılık kontrolleri ile 3D Secure doğrulaması sonucunda bir işlem otomatik olarak reddedilebilir."
  - Öneri: §3.3 Ö5, §3.3 Ö13.
- Satır 5414 · `D2` `D8`
  - Mevcut: "Açık rızanıza bağlı olarak, alışveriş geçmişiniz, puan ve harcama hareketleriniz ile site ve uygulama içi gezinme verileriniz üzerinden ürün önerisi ve kampanya segmentasyonu yapılabilir."
  - Öneri: §4.4 D2, §4.4 D8.
- Satır 5414 · `D8`
  - Mevcut: "Bu profilleme, yalnızca pazarlama içeriğinin kişiselleştirilmesine yöneliktir; fiyatlandırmayı, sözleşme koşullarını, puan kazanım oranını veya hizmete erişiminizi etkilemez ve rızanızı geri aldığınızda durur."
  - Öneri: §4.4 D8.

**12. Veri Güvenliği Tedbirleri**

- Satır 5430 · `Ö4` `Ö5` `Ö3` `Ö2`
  - Mevcut: "Kart verisinin Şirket sistemlerinde hiçbir aşamada tutulmaması; ödemenin, 6493 sayılı Kanun kapsamında yetkilendirilmiş ödeme kuruluşu iyzico'nun PCI-DSS uyumlu Checkout Form altyapısı üzerinden ve 3D Secure doğrulamasıyla gerçekleştirilmesi."
  - Öneri: §3.3 Ö4, §3.3 Ö5, §3.3 Ö3, §3.3 Ö2.
- Satır 5432 · `Ö6`
  - Mevcut: "Ödeme bildirimlerinin imzalı webhook ile alınması, imza doğrulaması yapılması, işlem sonucunun iyzico'ya yeniden sorularak teyit edilmesi ve mükerrer işlem koruması (idempotency) uygulanması."
  - Öneri: §3.3 Ö6.

**13. Çerezler ve Benzeri Teknolojiler**

- Satır 5446 · `C1`
  - Mevcut: "Mobil uygulamada tarayıcı çerezleri kullanılmaz; bunların yerine yazılım geliştirme kitleri (SDK), uygulama içi yerel depolama ve cihaz tanımlayıcıları (iOS için IDFA, Android için AAID) kullanılır."
  - Öneri: §5.2 C1.
- Satır 5446 · `K1` `Q2`
  - Mevcut: "Ölçümleme ve pazarlama amaçlı tanımlayıcılar yalnızca izin vermeniz hâlinde çalışır; bu izinler ile bildirim, konum ve kamera izinleri cihazınızın işletim sistemi ayarlarından dilediğiniz zaman değiştirilebilir veya kapatılabilir."
  - Öneri: §6 K1, §7.3-7.4 Q2.

**14. Mobil Uygulama, Cihaz İzinleri ve Uygulama Mağazaları**

- Satır 5454 · `D4` `Q1`
  - Mevcut: "{{BRAND}} mobil uygulaması iOS ve Android için yayımlanmakta olup, uygulama üzerinden menünün görüntülenmesi, sipariş verilmesi, üyelik işlemleri, ödül ve puan takibi, kafede QR kod okutularak puan kazanılması ve bildirim alınması mümkündür."
  - Öneri: §4.4 D4, §7.4 Q1.
- Satır 5455 · `Ö1`
  - Mevcut: "Uygulama üzerinden verilen siparişlerin ödemesi, uygulama mağazası içi satın alma yöntemiyle değil, web sitesindekiyle aynı şekilde ödeme kuruluşu iyzico üzerinden alınır."
  - Önerilen: "Uygulama üzerinden verilen siparişlerin ödemesi, uygulama mağazası içi satın alma yöntemiyle değil, web sitesindekiyle aynı şekilde ödeme hizmeti sağlayıcısı PayNkolay üzerinden alınır."
- Satır 5455 · `Ö3`
  - Mevcut: "Kart bilgileriniz iyzico'nun Checkout Form ekranında girilir; Şirket sunucularından geçmez ve saklanmaz."
  - Öneri: §3.3 Ö3.
- Satır 5457 · `C2`
  - Mevcut: "Uygulamayı cihazınızdan kaldırdığınızda cihazda tutulan yerel veriler silinir ve push bildirim tokeni geçersiz hâle gelir."
  - Öneri: §5.2 C2.
- Satır 5457 · `D6`
  - Mevcut: "Uygulamanın kaldırılması tek başına üyeliğinizin sona ermesi anlamına gelmez; hesabınızın ve buna bağlı puan bakiyenizin kapatılmasını istiyorsanız {{EMAIL}} adresine başvurabilirsiniz."
  - Öneri: §4.4 D6.
- Satır 5461 · `K1`
  - Mevcut: "Konum izni: Yalnızca yaklaşık konum düzeyinde ve en yakın şubenin gösterilmesi ile teslimat adresi önerisi amacıyla kullanılır; sürekli arka plan konum takibi yapılmaz."
  - Öneri: §6 K1.
- Satır 5462 · `D4` `Q2`
  - Mevcut: "Kamera izni: Yalnızca kafede puan kazanımı ve kampanya doğrulaması için QR kod okunmasında kullanılır; kamera görüntüsü kaydedilmez, sunucuya gönderilmez ve saklanmaz."
  - Öneri: §4.4 D4, §7.3-7.4 Q2.
- Satır 5463 · `C1`
  - Mevcut: "Cihaz tanımlayıcıları: Ölçümleme ve pazarlama amaçlı IDFA/AAID tanımlayıcıları yalnızca izin vermeniz hâlinde işlenir; izni cihaz ayarlarından geri alabilirsiniz."
  - Öneri: §5.2 C1.
- Satır 5464 · `C3`
  - Mevcut: "Çökme ve performans kayıtları: Uygulamanın kararlılığının artırılması amacıyla, cihaz modeli, işletim sistemi sürümü ve hata yığını gibi teknik verilerle sınırlı olarak işlenir."
  - Öneri: §5.2 C3.

**15. Ödül ve Puan Programı Kapsamında Veri İşleme**

- Satır 5469 · `D1` `D9`
  - Mevcut: "15. Ödül ve Puan Programı Kapsamında Veri İşleme"
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 5471 · `D1` `D4` `D2` `Q1`
  - Mevcut: "Ödül programı kapsamında, online mağazadan yapılan alışverişlerden ve kafe ziyaretlerinde QR kod okutulması yoluyla puan kazanılır; kazanılan puanlar sonraki alışverişlerde indirim olarak kullanılabilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §4.4 D2, §7.4 Q1.
- Satır 5471 · `D1` `D2`
  - Mevcut: "Program üyeliğe bağlıdır ve puanlar yalnızca puanı kazanan hesapta geçerlidir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 5472 · `D1` `D2` `D3`
  - Mevcut: "Bu kapsamda puan bakiyesi, puan hareketleri (kazanım, harcama, iptal, iade nedeniyle geri yükleme ve süre sonu) ile kazanım ve harcama geçmişi işlenir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 5473 · `D1` `D2` `D8`
  - Mevcut: "Puan ve harcama geçmişinizin kişiselleştirilmiş kampanya ve ürün önerisi sunmak amacıyla analiz edilmesi (profilleme) yalnızca açık rızanıza dayanır; rızanızı vermemeniz veya geri almanız puan kazanmanıza ve kullanmanıza engel olmaz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D8.
- Satır 5474 · `D1` `D9`
  - Mevcut: "Puan bir para birimi değildir; nakde çevrilemez, başka bir hesaba devredilemez ve üçüncü kişilere satılamaz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 5474 · `D1` `D2`
  - Mevcut: "Puanla karşılanan tutar, siparişin bedelinden düşülür."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 5474 · `Ö10` `D1` `D2` `D3`
  - Mevcut: "Siparişin iadesi hâlinde, puanla karşılanan kısım hesabınıza puan olarak geri yüklenir; ödeme kanalıyla ödenen tutar ise iyzico üzerinden aynı ödeme kanalına iade edilir."
  - Öneri: §3.3 Ö10, §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 5475 · `D1` `D6`
  - Mevcut: "Üyeliğinizin sona ermesi veya hesabınızın kapatılması hâlinde puan bakiyeniz sona erer."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D6.
- Satır 5475 · `D1` `D6`
  - Mevcut: "Puan hareketlerine ilişkin kayıtlar, mali mevzuattan ve olası uyuşmazlıklardan doğan yükümlülükler nedeniyle yasal saklama süreleri boyunca muhafaza edilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D6.
- Satır 5475 · `D1` `D9`
  - Mevcut: "Programın koşulları ve puan kazanım oranları, {{SITE_URL}} adresinde yayımlanan program kuralları çerçevesinde güncellenebilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.

**19. Ticari Elektronik İletiler ve İYS**

- Satır 5562 · `D3` `D6`
  - Mevcut: "Siparişinizin durumu, e-posta doğrulama, parola sıfırlama, kargo bildirimi, iade, fatura bilgilendirmesi ve puan hareketlerinize ilişkin bilgilendirme gibi işlemsel iletiler; sözleşmenin ifasına yönelik olduğundan ticari elektronik ileti kapsamında değildir ve ayrı onay aranmaksızın gönderilir."
  - Öneri: §4.4 D3, §4.4 D6.

</details>

<details>
<summary><b>KVKK Aydınlatma Metni</b> (<code>kvkk-aydinlatma-metni</code>) - 75 cümle</summary>

Kod dağılımı: D2 15, D4 14, D1 13, Q1 13, D6 11, C2 9, Q2 8, C1 7, K1 7, D3 6, D8 5, Ö10 5, D9 4, Ö4 4, C3 3, Ö3 3, Ö5 3, Ö6 3, Ö8 3, D7 2, V1 2, V2 2, Ö1 2, Ö13 2, Ö9 2, F1 1, Ö2 1, Ö7 1


**1. Amaç ve Kapsam**

- Satır 5709 · `D3`
  - Mevcut: "Metnin kapsamına şu kanallar girer: {{SITE_URL}} adresinde yayımlanan internet sitesi ve bu site üzerinden işletilen online mağaza (bottega); iOS ve Android platformları için yayımlanan {{BRAND}} mobil uygulaması; internet sitesi ve mobil uygulama üzerinden oluşturulan üyelik hesapları ile ödül/puan programı; sipariş, ödeme, kargo, iade ve destek süreçleri; {{ADDRESS}} adresindeki fiziki kafe ve bar işletmesi; {{EMAIL}} adresine ve {{PHONE}} numarasına yapılan başvurular; {{HANDLE}} kullanıcı adıyla işletilen sosyal medya hesapları üzerinden kurulan iletişim; tedarik, satın alma ve insan kaynakları süreçleri."
  - Öneri: §4.4 D3.

**3. Tanımlar**

- Satır 5799 · `C2`
  - Mevcut: "Veri işleyen: Veri sorumlusunun verdiği yetkiye dayanarak onun adına kişisel veri işleyen kişi; örneğin barındırma, PostgreSQL veri tabanı, işlemsel e-posta gönderimi, mobil bildirim iletimi ve kargo altyapısı sağlayıcılarımız."
  - Öneri: §5.2 C2.

**5. İlgili Kişi Grupları**

- Satır 5828 · `D4` `D6` `Q1`
  - Mevcut: "Mobil uygulama kullanıcısı: {{BRAND}} mobil uygulamasını iOS veya Android cihazına kuran; uygulama üzerinden menüyü görüntüleyen, sipariş veren, üyelik hesabını kullanan, puan bakiyesini takip eden, QR kod okutan veya bildirim alan kişi."
  - Öneri: §4.4 D4, §4.4 D6, §7.4 Q1.
- Satır 5829 · `D4` `D2` `Q1`
  - Mevcut: "Ödül programı katılımcısı: Online alışverişten veya kafede QR kod okutarak puan kazanan ve kazandığı puanı sonraki siparişlerinde indirim olarak kullanan üye."
  - Öneri: §4.4 D4, §4.4 D2, §7.4 Q1.
- Satır 5835 · `F1`
  - Mevcut: "İletişime geçen üçüncü kişiler: Basın mensupları, franchise/iş birliği talebiyle başvuranlar, sosyal medya hesaplarımız üzerinden mesaj gönderenler ve yasal bildirim yapanlar."
  - Öneri: §10 F1.

**6. İşlenen Kişisel Veri Kategorileri**

- Satır 5846 · `D2` `D3`
  - Mevcut: "Üye ve müşteri - Müşteri işlem verisi: sipariş numarası, sipariş tarihi, sepet içeriği (kavrulmuş kahve çekirdeği, yenilebilir waffle kupa, gelato kiti, moka pot/değirmen/tamper gibi ekipman, fincan/önlük/tote gibi marka ürünleri, pistacchio kreması ve şuruplar gibi kiler ürünleri), varyant ve öğütüm tercihi, adet, birim fiyat, indirim/promosyon kodu, siparişte kullanılan puan tutarı, KDV tutarı, kargo yöntemi ve ücreti, sipariş durumu, iade ve cayma talepleri, değişim kayıtları, sipariş notu."
  - Öneri: §4.4 D2, §4.4 D3.
- Satır 5847 · `Ö8` `Ö10`
  - Mevcut: "Üye ve müşteri - Finansal veri: ödeme yöntemi, işlem tutarı ve para birimi, ödeme kuruluşu iyzico tarafından döndürülen işlem referans numarası, ödemenin başarılı/başarısız/iade sonucu, taksit adedi, iade, kısmi iade ve chargeback kayıtları."
  - Öneri: §3.3 Ö8, §3.3 Ö10.
- Satır 5847 · `Ö4`
  - Mevcut: "Kart numarasının tamamı, son kullanma tarihi ve CVV/CVC gibi hassas kart verileri tarafımızca görülmez, kaydedilmez ve saklanmaz; bu veriler doğrudan PCI-DSS uyumlu ödeme kuruluşu iyzico'nun altyapısında işlenir."
  - Öneri: §3.3 Ö4.
- Satır 5856 · `D4` `D2` `Q1`
  - Mevcut: "Üye ve müşteri - Ödül ve puan verisi: puan bakiyesi, puan kazanım ve kullanım hareketleri, hareketin kaynağı (online sipariş, kafe ziyareti, QR okutma), kazanım ve kullanım tarihi, siparişte puanla ödenen tutar, kampanya veya kademe bilgisi ile harcama geçmişi özeti."
  - Öneri: §4.4 D4, §4.4 D2, §7.4 Q1.
- Satır 5857 · `C1` `C2`
  - Mevcut: "Mobil uygulama kullanıcısı - Cihaz ve uygulama verisi: cihaz tanımlayıcıları (iOS'ta IDFA, Android'de AAID), push bildirim tokeni, uygulama sürümü, işletim sistemi ve sürümü, cihaz modeli ve dil ayarı, çökme (crash) ve performans kayıtları, uygulama içi ekran görüntüleme ve tıklama akışı."
  - Öneri: §5.2 C1, §5.2 C2.
- Satır 5857 · `C1`
  - Mevcut: "Hukuki sebep: uygulamanın çalıştırılması ve kararlılığı bakımından KVKK m.5/2-c ve m.5/2-f; reklam tanımlayıcısının pazarlama amacıyla kullanılması ile zorunlu olmayan uygulama içi ölçümleme bakımından KVKK m.5/1 açık rıza."
  - Öneri: §5.2 C1.
- Satır 5858 · `D4` `D6` `K1` `Q2`
  - Mevcut: "Mobil uygulama kullanıcısı - İzne bağlı cihaz verisi: yaklaşık konum bilgisi (yalnızca izin verirseniz; en yakın şubenin ve teslimat seçeneklerinin gösterilmesi için, sürekli konum takibi yapılmaksızın) ve kamera erişimi (yalnızca kafede puan kazanmak üzere QR kod okutulduğu anda; kamera görüntüsü kaydedilmez ve sunucularımıza aktarılmaz)."
  - Öneri: §4.4 D4, §4.4 D6, §6 K1, §7.3-7.4 Q2.
- Satır 5858 · `D4` `Q1`
  - Mevcut: "Hukuki sebep: KVKK m.5/1 açık rıza (cihaz izni); QR ile puan kazanımı bakımından ayrıca KVKK m.5/2-c sözleşmenin ifası."
  - Öneri: §4.4 D4, §7.4 Q1.

**7. Kişisel Verilerin İşlenme Amaçları**

- Satır 5869 · `Ö6` `Ö9` `Ö8` `Ö10` `Ö3` `Ö13`
  - Mevcut: "Ödeme işlemlerinin gerçekleştirilmesi ve güvenliği: Ödemenin ödeme kuruluşu iyzico aracılığıyla tahsili, ödeme sayfasının iyzico Checkout Form üzerinde açılması, 3D Secure doğrulaması, provizyon ve provizyon kapama, taksitlendirme, ödeme sonucunun imzalı webhook ile alınıp iyzico'ya yeniden sorularak teyit edilmesi ve sipariş kaydına işlenmesi, mükerrer işlem ve dolandırıcılık riskinin önlenmesi, iade, kısmi iade ve chargeback (ters ibraz) süreçlerinin yönetilmesi."
  - Öneri: §3.3 Ö6, §3.3 Ö9, §3.3 Ö8, §3.3 Ö10, §3.3 Ö3, §3.3 Ö13.
- Satır 5870 · `V2`
  - Mevcut: "Teslimat ve lojistik: Ürünün paketlenmesi, kargo firmasına teslim edilmesi (Türkiye geneli için Yurtiçi Kargo, KKTC ve yurt dışı gönderiler için Aras Kargo, İstanbul içi hızlı teslimat için motokurye), gönderi takip numarasının oluşturulması ve tarafınıza iletilmesi, teslimat sorunlarının çözülmesi."
  - Öneri: §9.2 V2.
- Satır 5883 · `D4` `C3` `Q1`
  - Mevcut: "Mobil uygulamanın sunulması ve yönetilmesi: Uygulamanın cihazınıza uygun sürümde çalıştırılması, oturumun sürdürülmesi, uygulama içi menü, sipariş ve puan işlevlerinin sunulması, sürüm güncellemelerinin uygulanması, çökme ve performans sorunlarının giderilmesi, izin verdiğiniz ölçüde bildirim gönderilmesi ve QR okutma özelliğinin çalıştırılması."
  - Öneri: §4.4 D4, §5.2 C3, §7.4 Q1.
- Satır 5884 · `D4` `D2` `D3` `D7` `Q1`
  - Mevcut: "Ödül ve puan programının yürütülmesi: Puan kazanımının program kurallarına göre hesaplanması ve kaydedilmesi, kafede QR kod okutma yoluyla ziyaret puanı verilmesi, puan bakiyesinin gösterilmesi, puanın sipariş bedelinden düşülerek indirim olarak kullandırılması, iade ve cayma hâlinde puanın hesabınıza geri yüklenmesi, program kurallarının ve suistimal girişimlerinin denetlenmesi."
  - Öneri: §4.4 D4, §4.4 D2, §4.4 D3, §4.4 D7, §7.4 Q1.

**8. İşleme Amaçlarının Hukuki Sebepleri (KVKK m.5 ve m.6)**

- Satır 5904 · `Ö10` `Ö5`
  - Mevcut: "Ödemenin ödeme kuruluşu iyzico aracılığıyla tahsili, 3D Secure doğrulaması, iade ve chargeback yönetimi"
  - Öneri: §3.3 Ö10, §3.3 Ö5.
- Satır 5978 · `C3`
  - Mevcut: "Mobil uygulamanın çalıştırılması, oturum yönetimi, sürüm ve çökme kayıtları"
  - Öneri: §5.2 C3.
- Satır 5985 · `D6`
  - Mevcut: "İşlemsel bildirimler (sipariş durumu, ödeme sonucu, kargo hareketi, puan kazanımı) için KVKK m.5/2-c sözleşmenin ifası; kampanya ve duyuru niteliğindeki bildirimler için KVKK m.5/1 açık rıza ve 6563 sayılı Kanun kapsamındaki onay"
  - Öneri: §4.4 D6.
- Satır 5988 · `K1` `Q2`
  - Mevcut: "Cihaz izinleri: yaklaşık konum ve QR okuma amaçlı kamera erişimi"
  - Öneri: §6 K1, §7.3-7.4 Q2.
- Satır 5993 · `C1`
  - Mevcut: "Reklam tanımlayıcısı (IDFA/AAID) ve zorunlu olmayan uygulama içi ölçümleme"
  - Öneri: §5.2 C1.
- Satır 5997 · `D2`
  - Mevcut: "Ödül/puan programının yürütülmesi, puan kazanımı ve puanla ödeme"
  - Öneri: §4.4 D2.
- Satır 5999 · `D2` `D3`
  - Mevcut: "KVKK m.5/2-c: Ödül programına katılım ve üyelik sözleşmesinin ifası; puanla ödenen tutarın iade hâlinde geri yüklenmesi bakımından ayrıca m.5/2-ç ve m.5/2-e"
  - Öneri: §4.4 D2, §4.4 D3.
- Satır 6002 · `D2` `D8`
  - Mevcut: "Puan ve harcama geçmişine dayalı profilleme ve kişiselleştirilmiş kampanya sunumu"
  - Öneri: §4.4 D2, §4.4 D8.
- Satır 6004 · `D6`
  - Mevcut: "KVKK m.5/1: Açık rıza. Rızanın verilmemesi veya geri alınması puan kazanımınızı ve puan bakiyenizi etkilemez."
  - Öneri: §4.4 D6.

**9. Açık Rızaya Dayalı İşleme ve Rızanın Geri Alınması**

- Satır 6017 · `D6`
  - Mevcut: "Mobil uygulamada kampanya, indirim, yeni ürün ve etkinlik duyurusu içeren push bildirimlerin gönderilmesi; sipariş, ödeme, teslimat ve puan hareketlerine ilişkin işlemsel bildirimler bu kapsamda değildir."
  - Öneri: §4.4 D6.
- Satır 6018 · `K1` `Q2`
  - Mevcut: "Mobil uygulamada yaklaşık konum verisinin işlenmesi ve QR kod okutmak için kamera erişimi; bu izinler cihaz izni olarak alınır ve cihaz ayarlarından her zaman geri alınabilir."
  - Öneri: §6 K1, §7.3-7.4 Q2.
- Satır 6019 · `C1`
  - Mevcut: "Reklam tanımlayıcılarının (IDFA/AAID) ve zorunlu olmayan uygulama içi ölçümleme/pazarlama SDK'larının kullanılması."
  - Öneri: §5.2 C1.
- Satır 6024 · `D2` `D8`
  - Mevcut: "Puan ve harcama geçmişine dayalı profilleme yapılması ve buna göre kişiselleştirilmiş kampanya sunulması."
  - Öneri: §4.4 D2, §4.4 D8.

**10. Kişisel Verilerin Toplanma Yöntemleri**

- Satır 6036 · `C2` `C3` `K1` `Q1`
  - Mevcut: "Mobil uygulama: Uygulama üzerinden doldurduğunuz formlar ve gerçekleştirdiğiniz işlemler; uygulamanın çalışması sırasında otomatik olarak oluşan cihaz, sürüm, çökme ve performans kayıtları; izin verdiğiniz hâlde yaklaşık konum ve QR okuma verileri; bildirim gönderilebilmesi için oluşturulan push bildirim tokeni."
  - Öneri: §5.2 C2, §5.2 C3, §6 K1, §7.4 Q1.
- Satır 6037 · `D4` `D6` `Q1`
  - Mevcut: "Ödül programı kanalları: Online siparişten otomatik olarak oluşan puan kayıtları ile kafede QR kod okutularak oluşturulan ziyaret ve puan kayıtları."
  - Öneri: §4.4 D4, §4.4 D6, §7.4 Q1.
- Satır 6038 · `Ö6` `Ö7`
  - Mevcut: "Ödeme altyapısı: Ödeme kuruluşu iyzico'dan ve kartı veren bankadan dönen işlem sonucu, referans numarası ve maskeli kart bilgisi; 3D Secure doğrulama sonucu ile imzalı webhook bildirimleri."
  - Öneri: §3.3 Ö6, §3.3 Ö7.

**11. Çerezler ve Benzeri Teknolojiler**

- Satır 6051 · `C1` `K1` `Q2`
  - Mevcut: "Bildirim, konum ve kamera izinleri ile reklam tanımlayıcısının kullanımına ilişkin tercihlerinizi uygulama içi gizlilik tercihleri ekranından ve cihazınızın işletim sistemi ayarlarından her zaman değiştirebilirsiniz."
  - Öneri: §5.2 C1, §6 K1, §7.3-7.4 Q2.

**12. Mobil Uygulamaya İlişkin Ek Aydınlatma**

- Satır 6064 · `D4` `Q1`
  - Mevcut: "iOS ve Android platformları için yayımlanan {{BRAND}} mobil uygulaması; menü görüntüleme, sipariş verme, üyelik yönetimi, ödül/puan takibi, kafede QR kod okutarak puan kazanma ve bildirim alma işlevlerini sunar."
  - Öneri: §4.4 D4, §7.4 Q1.
- Satır 6065 · `Ö5`
  - Mevcut: "Uygulama içi satın alma yöntemi kullanılmaz; siparişlerinizin ödemesi, internet sitesinde olduğu gibi ödeme kuruluşu iyzico altyapısı üzerinden ve 3D Secure doğrulamasıyla gerçekleştirilir."
  - Öneri: §3.3 Ö5.
- Satır 6066 · `K1` `Q2`
  - Mevcut: "Cihaz izinleri (bildirim, konum, kamera) uygulamanın kurulumunda değil, ilgili özelliğin ilk kez kullanıldığı anda istenir."
  - Öneri: §6 K1, §7.3-7.4 Q2.
- Satır 6067 · `C2`
  - Mevcut: "Uygulamanın kaldırılması push bildirim tokeninin geçersizleşmesi sonucunu doğurur ve bu token ilk periyodik imha döneminde silinir."
  - Öneri: §5.2 C2.
- Satır 6072 · `C1`
  - Mevcut: "Cihaz ve uygulama verisi: cihaz tanımlayıcıları (iOS'ta IDFA, Android'de AAID), uygulama sürümü, işletim sistemi ve sürümü, cihaz modeli ve dil ayarı."
  - Öneri: §5.2 C1.
- Satır 6072 · `C1`
  - Mevcut: "Hukuki sebep: KVKK m.5/2-c hizmetin sunulması ve m.5/2-f meşru menfaat (uyumluluk ve hata giderme); reklam tanımlayıcısının pazarlama amacıyla kullanılması hâlinde KVKK m.5/1 açık rıza."
  - Öneri: §5.2 C1.
- Satır 6073 · `C2`
  - Mevcut: "Push bildirim tokeni: bildirim iletilebilmesi için cihazınıza atanan tekil değer."
  - Öneri: §5.2 C2.
- Satır 6075 · `K1`
  - Mevcut: "Yaklaşık konum verisi: yalnızca izin vermeniz hâlinde ve en yakın şubenin ile teslimat seçeneklerinin gösterilmesi amacıyla işlenir; arka planda sürekli konum takibi yapılmaz ve konum geçmişi tutulmaz."
  - Öneri: §6 K1.
- Satır 6076 · `D4` `Q2`
  - Mevcut: "Kamera erişimi: yalnızca kafede puan kazanmak üzere QR kod okutulduğunda etkinleşir; kamera görüntüsü kaydedilmez, sunucularımıza aktarılmaz ve yalnızca QR kodun içeriği okunur."
  - Öneri: §4.4 D4, §7.3-7.4 Q2.

**13. Ödül ve Puan Programı Kapsamında Veri İşleme**

- Satır 6081 · `D1` `D9`
  - Mevcut: "13. Ödül ve Puan Programı Kapsamında Veri İşleme"
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 6083 · `D1` `D4` `D2` `Q1`
  - Mevcut: "{{BRAND}} ödül programı kapsamında, internet sitesi ve mobil uygulama üzerinden yaptığınız alışverişlerden ve kafede QR kod okutularak kaydedilen ziyaretlerden puan kazanabilir, kazandığınız puanları sonraki siparişlerinizde indirim olarak kullanabilirsiniz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §4.4 D2, §7.4 Q1.
- Satır 6084 · `D1` `D9`
  - Mevcut: "Puan bir para birimi değildir; nakde çevrilemez, başka bir hesaba devredilemez ve üyelik hesabınızın kapatılması hâlinde sona erer."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 6084 · `D1` `D2`
  - Mevcut: "Puanla ödediğiniz tutar sipariş bedelinden düşülür."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 6084 · `Ö10` `D1` `D3`
  - Mevcut: "Siparişin iadesi veya cayma hakkının kullanılması hâlinde, kullandığınız puan hesabınıza geri yüklenir; bedelin Türk lirası olarak ödenen kısmı ise ödemenin yapıldığı kanala, yani iyzico üzerinden kartınıza iade edilir."
  - Öneri: §3.3 Ö10, §4.4 D1 (bölüm bütünüyle değişir), §4.4 D3.
- Satır 6085 · `D1` `D2` `D8`
  - Mevcut: "Programın yürütülmesi için yapılan veri işleme ile bu verilerin pazarlama amacıyla analiz edilmesi birbirinden ayrılır: puan kazanımı, bakiye takibi ve puanla ödeme sözleşmenin ifasına dayanır; harcama alışkanlığınıza göre kişiselleştirilmiş kampanya sunulması ise yalnızca açık rızanızla yapılır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D8.
- Satır 6085 · `D1` `D6`
  - Mevcut: "Rızanızı geri almanız puan kazanımınızı ve mevcut bakiyenizi etkilemez."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D6.
- Satır 6088 · `D1` `D4` `D2` `Q1`
  - Mevcut: "Puan ve ödül verisi: puan bakiyesi, kazanılan ve harcanan puan hareketleri, hareketin kaynağı (online sipariş, kafe ziyareti, QR okutma), kazanım ve kullanım tarihi, kampanya veya kademe bilgisi."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §4.4 D2, §7.4 Q1.
- Satır 6089 · `D1` `D8`
  - Mevcut: "Programın yürütülmesi ve puan hesabının doğruluğu bakımından hukuki sebep KVKK m.5/2-c; bu verilerin segmentasyon ve profilleme amacıyla analiz edilmesi bakımından KVKK m.5/1 açık rıza."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D8.
- Satır 6090 · `D1` `D4` `Q1`
  - Mevcut: "QR ile kafede puan kazanma: QR kodun okutulduğu şube, tarih ve saat ile eşleşen üyelik kimliği."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §7.4 Q1.
- Satır 6090 · `Q2`
  - Mevcut: "Kamera erişimi yalnızca okutma anında kullanılır ve görüntü kaydedilmez."
  - Öneri: §7.3-7.4 Q2.
- Satır 6091 · `D1` `D9`
  - Mevcut: "Puana ilişkin işlemsel bildirimler (puan kazanımı, kullanımı ve sona erme uyarısı) sözleşmenin ifası kapsamında gönderilir; kampanya ve indirim duyuruları ise ticari elektronik ileti niteliğindedir ve yalnızca onayınızla gönderilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 6092 · `D1` `D4` `D7` `D6` `Q1`
  - Mevcut: "Suistimalin önlenmesi: Aynı işlemden mükerrer puan kazanımı, sahte QR okutma ve program kurallarının kötüye kullanılması hâllerinin tespiti için puan hareketleri incelenebilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §4.4 D7, §4.4 D6, §7.4 Q1.
- Satır 6093 · `D1` `D6`
  - Mevcut: "Puan kayıtları, üyelik devam ettiği sürece; üyeliğin sona ermesinden sonra ise uyuşmazlık ihtimaline karşı genel zamanaşımı süresi boyunca sınırlı erişimle saklanır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D6.

**14. Kişisel Verilerin Aktarılması**

- Satır 6104 · `Ö1`
  - Mevcut: "Ödeme kuruluşu iyzico ve kartı veren banka"
  - Önerilen: "Ödeme hizmeti sağlayıcısı PayNkolay ve kartı veren banka"
- Satır 6106 · `Ö9` `Ö8` `Ö10` `Ö4` `Ö5` `Ö3` `Ö2`
  - Mevcut: "Ödemenin tahsili, ödeme sayfasının iyzico Checkout Form üzerinde sunulması, 3D Secure doğrulaması, provizyon, taksitlendirme, iade, kısmi iade ve chargeback süreçlerinin yürütülmesi. iyzico, 6493 sayılı Kanun kapsamında faaliyet gösteren yetkili bir ödeme kuruluşudur. Hukuki sebep: KVKK m.5/2-c sözleşmenin ifası ve m.5/2-ç hukuki yükümlülük. Aktarılan veri: ad-soyad, iletişim bilgisi, sipariş ve tutar bilgisi. Kart numarası, son kullanma tarihi ve CVV bilgisi tarafımızca görülmediğinden aktarılmaz; bu veriler doğrudan iyzico altyapısına girilir ve PCI-DSS yükümlülüğü iyzico'ya aittir."
  - Öneri: §3.3 Ö9, §3.3 Ö8, §3.3 Ö10, §3.3 Ö4, §3.3 Ö5, §3.3 Ö3, §3.3 Ö2.
- Satır 6109 · `V2`
  - Mevcut: "Kargo ve kurye firmaları (Türkiye geneli Yurtiçi Kargo, KKTC/yurt dışı Aras Kargo, İstanbul içi motokurye)"
  - Öneri: §9.2 V2.
- Satır 6126 · `C2`
  - Mevcut: "Uygulamanın dağıtımı ve güncellenmesi ile izin verdiğiniz bildirimlerin cihazınıza iletilmesi. Aktarılan veri: push bildirim tokeni ve bildirim içeriği. Hukuki sebep: işlemsel bildirimler için KVKK m.5/2-c; ticari nitelikli bildirimler için KVKK m.5/1 açık rıza. Uygulama mağazası hesabınıza ilişkin veriler mağaza işletmecisinin kendi politikalarına tabidir ve tarafımızca erişilmez."
  - Öneri: §5.2 C2.

**15. Kişisel Verilerin Yurt Dışına Aktarılması**

- Satır 6164 · `C2` `V1`
  - Mevcut: "Hizmet altyapımızın bir kısmı (uygulama barındırma, PostgreSQL veri tabanı, işlemsel e-posta gönderimi, mobil uygulama mağaza dağıtımı ve push bildirim iletimi ile içerik dağıtım ağı) yurt dışında yerleşik hizmet sağlayıcılar tarafından sunulmaktadır."
  - Öneri: §5.2 C2, §9.1 V1 (Supabase eklenir).
- Satır 6167 · `Ö4`
  - Mevcut: "Yurt dışına aktarım her hâlde asgari veri ilkesiyle yürütülür: barındırma, veri tabanı, e-posta ve bildirim altyapısı için ilgili sağlayıcıya yalnızca hizmetin sunulması için gereken veriler iletilir; ödeme kartı verileri tarafımızca aktarılmaz, doğrudan PCI-DSS uyumlu ödeme kuruluşu iyzico'nun altyapısında işlenir."
  - Öneri: §3.3 Ö4.
- Satır 6170 · `C2` `V1`
  - Mevcut: "Aktarım gerekçeleri: Uygulama barındırma ve dağıtımı, PostgreSQL veri tabanı hizmeti ve yedekleme, işlemsel e-posta gönderimi, mobil uygulama mağaza dağıtımı ve push bildirim iletimi, hata ve performans izleme."
  - Öneri: §5.2 C2, §9.1 V1 (Supabase eklenir).
- Satır 6171 · `D9`
  - Mevcut: "Aktarılan veri kategorileri: Kimlik, iletişim, müşteri işlem, ödül/puan, hesap-güvenlik, cihaz-uygulama ve işlem güvenliği verileri; ödeme kartının tam numarası ve güvenlik kodu hiçbir hâlde aktarılmaz."
  - Öneri: §4.4 D9.

**16. Saklama Süreleri ve İmha**

- Satır 6208 · `Ö1`
  - Mevcut: "Mali mevzuattaki saklama süresi ve ters ibraz itiraz süreleri dikkate alınarak; ödeme kuruluşu iyzico nezdindeki kayıtlar ilgili kuruluşun kendi mevzuatına tabidir."
  - Önerilen: "Mali mevzuattaki saklama süresi ve ters ibraz itiraz süreleri dikkate alınarak; ödeme hizmeti sağlayıcısı PayNkolay nezdindeki kayıtlar ilgili kuruluşun kendi mevzuatına tabidir."
- Satır 6251 · `D6`
  - Mevcut: "Ödül ve puan kayıtları"
  - Öneri: §4.4 D6.
- Satır 6253 · `D2`
  - Mevcut: "Üyelik devam ettiği sürece; üyeliğin sona ermesi hâlinde puanlar geçerliliğini yitirir ve puan hareketi kayıtları, program kaynaklı uyuşmazlık ihtimaline karşı Türk Borçlar Kanunu'ndaki genel zamanaşımı süresi boyunca sınırlı erişimle saklanır. Puanla ödenen tutara ilişkin kayıtlar, ilgili sipariş ve fatura kayıtlarının saklama süresine tabidir."
  - Öneri: §4.4 D2.
- Satır 6256 · `C2`
  - Mevcut: "Mobil uygulama verileri (cihaz tanımlayıcısı, push bildirim tokeni, uygulama sürümü)"
  - Öneri: §5.2 C2.

**19. Veri Güvenliğine İlişkin Alınan Tedbirler**

- Satır 6297 · `Ö6` `Ö4`
  - Mevcut: "Teknik: Ödeme kartı verilerinin sistemlerimize hiç girmemesi; ödemenin PCI-DSS uyumlu ödeme kuruluşu iyzico'nun altyapısında ve 3D Secure doğrulamasıyla gerçekleştirilmesi; ödeme sonucunun imzalı webhook ile alınması ve her hâlde iyzico'ya yeniden sorularak teyit edilmesi."
  - Öneri: §3.3 Ö6, §3.3 Ö4.
- Satır 6304 · `Q2`
  - Mevcut: "Teknik: Mobil uygulamada sunucuyla tüm iletişimin TLS ile şifrelenmesi, oturum belirteçlerinin cihazın güvenli alanında (Keychain/Keystore) saklanması, cihaz izinlerinin yalnızca ilgili özellik ilk kez kullanıldığında istenmesi ve kamera görüntüsünün QR okuma dışında hiçbir amaçla işlenmemesi."
  - Öneri: §7.3-7.4 Q2.

**20. Ticari Elektronik İletiler ve İYS**

- Satır 6312 · `D3` `D6`
  - Mevcut: "Siparişinizin durumu, ödeme sonucu, kargo hareketi, iade süreci ve puan kazanımı/kullanımı gibi işlemsel bildirimler sözleşmenin ifası kapsamındadır ve ticari elektronik ileti sayılmaz."
  - Öneri: §4.4 D3, §4.4 D6.

**21. Otomatik Sistemlerle Analiz ve Profilleme**

- Satır 6320 · `Ö3` `Ö13`
  - Mevcut: "Ödeme adımında, ödeme kuruluşu iyzico ve kartı veren banka tarafından işletilen dolandırıcılık önleme (fraud) kontrolleri uygulanabilir; bu kontroller sonucunda bir işlem reddedilirse, işlemin neden reddedildiğine ilişkin bilgi ilgili kuruluşun kuralları çerçevesinde sınırlı olabilir."
  - Öneri: §3.3 Ö3, §3.3 Ö13.
- Satır 6322 · `D2`
  - Mevcut: "Ödül programında puan kazanımı ve puanla ödeme, önceden duyurulan program kurallarına göre otomatik olarak hesaplanır; bu hesaplama kişiliğinize yönelik bir değerlendirme içermez."
  - Öneri: §4.4 D2.
- Satır 6322 · `D2` `D8`
  - Mevcut: "Puan ve harcama geçmişinize dayalı profilleme yalnızca açık rızanızla yapılır ve rızanızı geri almanız puan bakiyenizi etkilemez."
  - Öneri: §4.4 D2, §4.4 D8.

</details>

<details>
<summary><b>Açık Rıza Metni</b> (<code>acik-riza-metni</code>) - 82 cümle</summary>

Kod dağılımı: K1 17, D2 15, D9 15, C1 14, D1 13, D6 9, D4 7, Q1 7, C2 6, D3 6, C4 5, D8 5, Q2 5, D5 4, K2 4, V1 3, Ö1 2, Ö3 2, Ö5 2, C3 1, Ö2 1, Ö4 1


**(belge başı)**

- Satır 6420 · `D9`
  - Mevcut: "6698 sayılı Kanun uyarınca {{SHORT_NAME}}'nin web sitesi ve mobil uygulamada hangi işlemler için açık rızanıza başvurduğunu, rızanın nasıl verilip geri çekileceğini, vermemeniz hâlinde hizmetin ve puan kazanmanızın etkilenmediğini açıklar."
  - Öneri: §4.4 D9.

**1. Amaç ve Kapsam**

- Satır 6450 · `D9`
  - Mevcut: "Metnin kapsamı, {{SITE_URL}} adresinde yayımlanan internet sitesi ve online mağaza, iOS ve Android için yayımlanan {{BRAND}} mobil uygulaması, üyelik hesabı, ödül ve puan programı, sipariş ve teslimat süreçleri, müşteri iletişim kanalları, {{BRAND}} kafesinin İstanbul Tuzla'daki fiziki işletmesi ve {{HANDLE}} kullanıcı adıyla yürütülen kurumsal sosyal medya hesapları bakımından geçerlidir."
  - Öneri: §4.4 D9.
- Satır 6451 · `D2` `D3`
  - Mevcut: "Aşağıda 16. bölümde açıkça belirtildiği üzere, açık rıza vermemeniz veya verdiğiniz rızayı geri çekmeniz hâlinde üyeliğiniz, mobil uygulamayı kullanmanız, ödül programına katılıp puan kazanmanız ve puanınızı harcamanız, sipariş verme, ödeme, teslimat, fatura, iade ve cayma hakkı süreçleriniz ile müşteri hizmetleri desteğiniz hiçbir şekilde etkilenmez."
  - Öneri: §4.4 D2, §4.4 D3.

**3. Tanımlar**

- Satır 6539 · `D5` `D6`
  - Mevcut: "Kimliği belirli veya belirlenebilir gerçek kişiye ilişkin her türlü bilgi (ad, e-posta, telefon, adres, sipariş geçmişi, puan bakiyesi, çerez kimliği, cihaz tanımlayıcısı, IP adresi gibi)."
  - Öneri: §4.4 D5, §4.4 D6.
- Satır 6584 · `D5` `D4` `Q1`
  - Mevcut: "{{BRAND}} adına iOS ve Android için yayımlanan, menü görüntüleme, sipariş, üyelik, ödül puanı takibi, karekod ile kafede puan kazanma ve bildirim işlevlerini sunan uygulama."
  - Öneri: §4.4 D5, §4.4 D4, §7.4 Q1.
- Satır 6587 · `C1`
  - Mevcut: "Cihaz tanımlayıcısı ve reklam tanımlayıcısı"
  - Öneri: §5.2 C1.
- Satır 6589 · `C1`
  - Mevcut: "Mobil cihazlarda uygulamaların erişebildiği, çerez yerine geçen kimlikler; iOS'ta IDFA, Android'de AAID olarak adlandırılır ve cihaz ayarlarından sıfırlanabilir veya kapatılabilir."
  - Öneri: §5.2 C1.
- Satır 6592 · `C2`
  - Mevcut: "Push bildirim tokeni"
  - Öneri: §5.2 C2.
- Satır 6597 · `D5`
  - Mevcut: "Ödül puanı"
  - Öneri: §4.4 D5.
- Satır 6599 · `D5` `D2`
  - Mevcut: "Alışveriş ve kafe ziyaretleri karşılığında üyelik hesabınıza tanımlanan, indirim olarak kullanılabilen dijital puan; para değildir, nakde çevrilemez ve üçüncü kişiye devredilemez."
  - Öneri: §4.4 D5, §4.4 D2.

**4. Açık Rızanın Unsurları**

- Satır 6609 · `D8` `C1` `K1`
  - Mevcut: "Belirli bir konuya ilişkin olma: Rızanız, tek ve genel bir onay olarak değil; pazarlama amaçlı profilleme, ticari elektronik ileti, push bildirim yoluyla pazarlama, reklam çerezleri, mobil uygulamada reklam tanımlayıcısı kullanımı, yaklaşık konuma dayalı kampanya, ödül programı kapsamında kişiye özel puan ve kampanya önerisi, yurt dışına aktarım ve görsel içerikte yer alma gibi her bir amaç için ayrı ayrı alınır."
  - Öneri: §4.4 D8, §5.2 C1, §6 K1.
- Satır 6611 · `D9`
  - Mevcut: "Özgür iradeyle açıklanma: Rıza vermemeniz hâlinde sizi bir hizmetten mahrum bırakan, ek ücret uygulayan, siparişinizi geciktiren, puan kazanmanızı engelleyen veya üyeliğinizi kısıtlayan hiçbir sonuç doğmaz."
  - Öneri: §4.4 D9.

**5. Açık Rıza Gerektirmeyen İşlemler - Bu Metinle Neyi Onaylamıyorsunuz**

- Satır 6621 · `D4` `D2` `D3` `Q1`
  - Mevcut: "Sözleşmenin kurulması veya ifası: Üyelik hesabınızın oluşturulması, sipariş alınması, ödeme işleminin yürütülmesi, kargo veya motokurye ile teslimat, ödül programına katıldıysanız puan bakiyenizin hesaplanması, karekod ile kazandığınız puanın hesabınıza işlenmesi ve puanınızın indirim olarak kullandırılması, iade ve cayma hakkı taleplerinin karşılanması."
  - Öneri: §4.4 D4, §4.4 D2, §4.4 D3, §7.4 Q1.
- Satır 6623 · `D6`
  - Mevcut: "Bir hakkın tesisi, kullanılması veya korunması: Uyuşmazlık, tüketici hakem heyeti başvurusu, dava veya icra takibi hâlinde ilgili sipariş, ödeme, puan ve yazışma kayıtlarının zamanaşımı süresince muhafazası."
  - Öneri: §4.4 D6.
- Satır 6624 · `C3`
  - Mevcut: "Meşru menfaat: Sitenin, mobil uygulamanın ve ödeme adımlarının güvenliği, dolandırıcılık ve kötüye kullanımın önlenmesi, sunucu kayıtlarının tutulması, uygulamanın hatalarının giderilmesi amacıyla çökme (crash) kayıtlarının incelenmesi, hizmetin sürekliliğine ilişkin zorunlu teknik çerezler ile sipariş onayı, kargo takip numarası, şifre sıfırlama gibi işlemsel elektronik iletiler."
  - Öneri: §5.2 C3.
- Satır 6625 · `D9`
  - Mevcut: "İşlemsel push bildirimleri: Siparişinizin hazırlandığı, kargoya verildiği veya teslim edildiği, ödemenizin alındığı, puanınızın hesabınıza işlendiği ya da hesabınızda güvenlikle ilgili bir işlem yapıldığı yönündeki bildirimler pazarlama amacı taşımadığından bu metnin konusu dışındadır; bunlar için ayrı bir pazarlama onayı aranmaz."
  - Öneri: §4.4 D9.

**6. Açık Rızanıza Başvurduğumuz İşlemlerin Özeti**

- Satır 6673 · `C2`
  - Mevcut: "Push bildirim tokeni, uygulama sürümü, işletim sistemi bilgisi; amaç: mobil uygulama üzerinden kampanya, yeni ürün ve etkinlik duyurusu gönderilmesi."
  - Öneri: §5.2 C2.
- Satır 6676 · `D8`
  - Mevcut: "R9 - Ödül programı kapsamında alışveriş alışkanlığı analizi ve kişiye özel puan/kampanya önerisi"
  - Öneri: §4.4 D8.
- Satır 6678 · `D4` `D2` `D8` `Q1`
  - Mevcut: "Puan kazanma ve harcama geçmişi, kafe ziyaret sıklığı, karekod okutma kayıtları, sipariş içerikleri; amaç: size özel puan çarpanı, kişiye özel kampanya ve ödül önerisi sunulması."
  - Öneri: §4.4 D4, §4.4 D2, §4.4 D8, §7.4 Q1.
- Satır 6681 · `C1` `C4`
  - Mevcut: "R10 - Mobil uygulamada reklam tanımlayıcısı kullanımı"
  - Öneri: §5.2 C1, §5.2 C4.
- Satır 6683 · `C1`
  - Mevcut: "Reklam tanımlayıcısı (IDFA/AAID), cihaz modeli, işletim sistemi ve uygulama sürümü; amaç: uygulama içi ve uygulama dışı reklamların ilgi alanına göre gösterilmesi ve ölçümlenmesi."
  - Öneri: §5.2 C1.
- Satır 6686 · `K1` `K2`
  - Mevcut: "R11 - Yaklaşık konuma dayalı kampanya"
  - Öneri: §6 K1, §6 K2.
- Satır 6688 · `K1`
  - Mevcut: "Cihaz izniyle elde edilen yaklaşık konum (ilçe veya semt düzeyi); amaç: kafeye yakınken geçerli kampanyaların ve şube bilgisinin gösterilmesi."
  - Öneri: §6 K1.

**7. R1 - Pazarlama Amaçlı Profilleme ve Segmentasyon**

- Satır 6702 · `D3`
  - Mevcut: "Segmentler yalnızca hangi kampanya iletisinin size gösterileceğini belirler; ürün fiyatınızı, kargo ücretinizi, iade hakkınızı, puan kazanma oranınızı veya sipariş önceliğinizi olumsuz yönde değiştirmez."
  - Öneri: §4.4 D3.

**8. R2 - Ticari Elektronik İleti (E-posta ve SMS)**

- Satır 6725 · `D3`
  - Mevcut: "Sipariş onayı, ödeme bildirimi, kargo takip numarası, puan işlenmesi, iade süreci ve şifre sıfırlama gibi işlemsel iletiler gönderilmeye devam eder; bunlar ticari elektronik ileti niteliğinde olmadığından onaya tabi değildir."
  - Öneri: §4.4 D3.

**9. R3 ve R4 - Alışveriş Alışkanlığı Analizi ve Kişiselleştirilmiş Ürün Önerisi**

- Satır 6738 · `Ö1`
  - Mevcut: "İşlenmeyen veriler: Kart numarası, son kullanma tarihi ve güvenlik kodu gibi ödeme aracı bilgileri hiçbir analizde kullanılmaz; bu veriler şirketimizin sistemlerinde hiçbir aşamada tutulmaz, yalnızca ödeme kuruluşu iyzico'nun altyapısında işlenir."
  - Önerilen: "İşlenmeyen veriler: Kart numarası, son kullanma tarihi ve güvenlik kodu gibi ödeme aracı bilgileri hiçbir analizde kullanılmaz; bu veriler şirketimizin sistemlerinde hiçbir aşamada tutulmaz, yalnızca ödeme hizmeti sağlayıcısı PayNkolay'ın altyapısında işlenir."

**10. R5 - Çerez Tabanlı Reklam ve Yeniden Hedefleme**

- Satır 6749 · `C4`
  - Mevcut: "Uygulamada aynı işlev, yazılım geliştirme kitleri (SDK) ve cihaz tanımlayıcıları aracılığıyla yerine getirilir; bu kullanım bu onayın değil, 15. bölümde açıklanan R10 onayının konusudur ve izin yönetimi ayrıca cihazınızın ayarlarından yapılır."
  - Öneri: §5.2 C4.
- Satır 6753 · `C1`
  - Mevcut: "İşlenen veriler: Çerez ve reklam kimliği, IP adresi, tarayıcı ve işletim sistemi bilgisi, cihaz türü, ziyaret edilen sayfalar ve tıklama verisi, siteye yönlendiren kaynak."
  - Öneri: §5.2 C1.

**11. R6 - Kişisel Verilerin Yurt Dışına Aktarılması**

- Satır 6762 · `C2` `V1`
  - Mevcut: "İnternet sitesi ve mobil uygulama sunucularının barındırılması ve dağıtımı, PostgreSQL veri tabanı, işlemsel e-posta gönderimi, bildirim iletimi ile reklam ve ölçümleme hizmetleri bu kapsamdadır."
  - Öneri: §5.2 C2, §9.1 V1 (Supabase eklenir).
- Satır 6764 · `D9`
  - Mevcut: "Bu onayı vermemeniz, siteyi veya mobil uygulamayı kullanmanıza, sipariş vermenize, puan kazanmanıza veya siparişinizin teslim edilmesine engel değildir; böyle bir durumda ilgili veri yurt dışına aktarılmaz ve hizmet yurt içi imkânlarla yürütülür."
  - Öneri: §4.4 D9.
- Satır 6769 · `Ö2` `V1`
  - Mevcut: "Kullanılan başlıca altyapılar: Barındırma ve dağıtım için Vercel, veri tabanı için {{DB_PROVIDER}} (PostgreSQL), işlemsel ve toplu e-posta gönderimi için Resend, ödeme işlemleri için 6493 sayılı Kanun kapsamında yetkilendirilmiş ödeme kuruluşu iyzico."
  - Öneri: §3.3 Ö2, §9.1 V1 (Supabase eklenir).
- Satır 6770 · `D6`
  - Mevcut: "Aktarılan veri kategorileri: Kimlik ve iletişim bilgileri, üyelik, puan ve sipariş kayıtları, işlem güvenliği kayıtları, çerez ve cihaz bilgileri."
  - Öneri: §4.4 D6.
- Satır 6771 · `V1`
  - Mevcut: "Alıcı grupları: Barındırma ve dağıtım sağlayıcıları, PostgreSQL veri tabanı sağlayıcısı, e-posta ve bildirim gönderim sağlayıcıları, onaya bağlı olarak reklam ve analiz platformları."
  - Öneri: §9.1 V1 (Supabase eklenir).
- Satır 6772 · `Ö1`
  - Mevcut: "Aktarılmayan veriler: Kart numarası, son kullanma tarihi ve güvenlik kodu gibi ödeme aracı bilgileri şirketimizce hiçbir aşamada tutulmadığından şirketimiz tarafından yurt dışına aktarılmaz; bu bilgiler doğrudan iyzico altyapısında işlenir."
  - Önerilen: "Aktarılmayan veriler: Kart numarası, son kullanma tarihi ve güvenlik kodu gibi ödeme aracı bilgileri şirketimizce hiçbir aşamada tutulmadığından şirketimiz tarafından yurt dışına aktarılmaz; bu bilgiler doğrudan PayNkolay altyapısında işlenir."
- Satır 6773 · `D9`
  - Mevcut: "Rıza vermezseniz: Hizmet, uygun güvencelere dayanan aktarımlar ve yurt içi kaynaklarla sunulmaya devam eder; üyeliğiniz, siparişiniz veya puanınız etkilenmez."
  - Öneri: §4.4 D9.

**13. R8 - Push Bildirim Yoluyla Pazarlama**

- Satır 6797 · `D6`
  - Mevcut: "Siparişinizin durumu, ödeme sonucu, kargo hareketi, puanınızın hesabınıza işlenmesi ve hesap güvenliğine ilişkin bildirimler, sözleşmenin ifası ve meşru menfaat kapsamında gönderilir; bu onayı vermeseniz veya geri çekseniz dahi almaya devam edersiniz."
  - Öneri: §4.4 D6.
- Satır 6798 · `C2`
  - Mevcut: "Uygulamayı cihazınızdan kaldırdığınızda bildirim tokeniniz geçersiz hâle gelir ve kullanılamaz duruma düşer."
  - Öneri: §5.2 C2.
- Satır 6801 · `C2`
  - Mevcut: "İşlenen veriler: Push bildirim tokeni, cihaz platformu ve modeli, işletim sistemi sürümü, uygulama sürümü, bildirim izin durumu, bildirimin gönderilme ve açılma kaydı, dil ve saat dilimi tercihi."
  - Öneri: §5.2 C2.
- Satır 6805 · `D2`
  - Mevcut: "Rıza vermezseniz: Uygulama tüm işlevleriyle çalışmaya devam eder; menüyü görüntüler, sipariş verir, puan kazanır ve harcarsınız."
  - Öneri: §4.4 D2.

**14. R9 - Ödül Programı Kapsamında Alışveriş Alışkanlığı Analizi ve Kişiye Özel Puan veya Kampanya Önerisi**

- Satır 6810 · `D1` `D9`
  - Mevcut: "14. R9 - Ödül Programı Kapsamında Alışveriş Alışkanlığı Analizi ve Kişiye Özel Puan veya Kampanya Önerisi"
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 6812 · `D1` `D4` `D2` `Q1`
  - Mevcut: "{{BRAND}} ödül ve puan programında, online alışverişlerinizden ve kafede karekod okutarak gerçekleştirdiğiniz ziyaretlerden puan kazanır, kazandığınız puanı sonraki alışverişlerinizde indirim olarak kullanabilirsiniz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §4.4 D2, §7.4 Q1.
- Satır 6812 · `D1` `D2`
  - Mevcut: "Puanın kazanılması, bakiyenizin hesaplanması ve indirim olarak kullandırılması üyelik ilişkisinin ifasına dayanır; bunun için ayrıca açık rıza aranmaz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 6813 · `D1` `D2` `D8`
  - Mevcut: "Bu onay (R9), yalnızca puan ve harcama geçmişinizin, size özel puan çarpanı, kişiye özel kampanya ve ödül önerisi oluşturmak amacıyla otomatik yöntemlerle analiz edilmesini kapsar."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D8.
- Satır 6813 · `D1` `D9`
  - Mevcut: "Örneğin sık ziyaret ettiğiniz saat aralığına uygun bir çift puan kampanyasının veya düzenli aldığınız ürüne özel bir ödülün size sunulması bu kapsamdadır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 6814 · `D1` `D9`
  - Mevcut: "Öneriler yalnızca ek fayda sağlar; standart puan kazanma oranınızı düşürmez, mevcut puanınızı eksiltmez ve size diğer müşterilerden farklı bir ürün fiyatı uygulanmasına yol açmaz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 6815 · `D1` `D9`
  - Mevcut: "Puanın hukuki niteliği bakımından: Ödül puanı para değildir, nakde çevrilemez, üçüncü kişiye devredilemez ve bu metin kapsamındaki onaylar puanın kazanılmasının veya kullanılmasının şartı değildir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 6815 · `D1` `D2` `D3`
  - Mevcut: "Puanla ödenen bir siparişin iadesi hâlinde puan hesabınıza geri yüklenir; bedelin nakit veya kart ile ödenen kısmı ise ödemenin yapıldığı kanala iade edilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 6818 · `D1` `D4` `D2` `Q1`
  - Mevcut: "İşlenen veriler: Puan kazanma ve harcama hareketleri, puan bakiyesi ve son kullanma tarihleri, karekod okutma kayıtları ile ziyaret tarih ve saatleri, sipariş kalemleri ve tutarları, kampanya ve promosyon kodu kullanımı, ziyaret sıklığı."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §4.4 D2, §7.4 Q1.
- Satır 6821 · `D1` `D2` `D8`
  - Mevcut: "Aktarım: Yalnızca barındırma ve PostgreSQL veri tabanı hizmeti aldığımız işleyicilere; puan ve harcama profilleri üçüncü kişilere satılmaz, kiralanmaz veya ticari amaçla devredilmez."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D8.
- Satır 6822 · `D1` `D6`
  - Mevcut: "Puan bakiyesi ve hareket kayıtları, üyeliğiniz sürdüğü ve mevzuat gerektirdiği sürece saklanmaya devam eder."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D6.
- Satır 6823 · `D1` `D2`
  - Mevcut: "Rıza vermezseniz: Ödül programına katılmaya, alışverişten ve kafe ziyaretinden puan kazanmaya, puanınızı indirim olarak kullanmaya standart koşullarla devam edersiniz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 6823 · `D1` `D9`
  - Mevcut: "Yalnızca size özel puan veya kampanya önerisi gösterilmez; herkese açık genel kampanyalardan aynı şekilde yararlanırsınız."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.

**15. R10 ve R11 - Mobil Uygulamada Reklam Tanımlayıcısı ve Yaklaşık Konuma Dayalı Kampanya**

- Satır 6828 · `C4` `K1` `K2`
  - Mevcut: "15. R10 ve R11 - Mobil Uygulamada Reklam Tanımlayıcısı ve Yaklaşık Konuma Dayalı Kampanya"
  - Öneri: §5.2 C4, §6 K1, §6 K2.
- Satır 6830 · `C1`
  - Mevcut: "Mobil uygulamada çerez kullanılmadığından, reklam ve ölçümleme işlevleri yazılım geliştirme kitleri (SDK) ve işletim sisteminin sağladığı reklam tanımlayıcıları üzerinden yürütülür."
  - Öneri: §5.2 C1.
- Satır 6830 · `C1` `C4`
  - Mevcut: "Reklam tanımlayıcısı kullanımı onayı (R10), bu tanımlayıcının reklamların ilgi alanınıza göre gösterilmesi ve reklam performansının ölçülmesi amacıyla işlenmesini kapsar."
  - Öneri: §5.2 C1, §5.2 C4.
- Satır 6831 · `K1` `K2`
  - Mevcut: "Yaklaşık konuma dayalı kampanya onayı (R11), cihazınızın konum izni açıkken elde edilen ilçe veya semt düzeyindeki yaklaşık konum bilgisinin, size yakın kampanyaların ve kafe bilgisinin gösterilmesi amacıyla işlenmesini kapsar."
  - Öneri: §6 K1, §6 K2.
- Satır 6831 · `K1`
  - Mevcut: "Kesin konum takibi yapılmaz, konum geçmişiniz çıkarılmaz ve uygulama kapalıyken arka planda konumunuz izlenmez."
  - Öneri: §6 K1.
- Satır 6833 · `Q2`
  - Mevcut: "Uygulamanın kamera erişimi bu onayların konusu değildir."
  - Öneri: §7.3-7.4 Q2.
- Satır 6833 · `K1` `Q2`
  - Mevcut: "Kamera yalnızca karekod okutmak için ve siz o işlemi başlattığınızda kullanılır; kamera görüntüsü kaydedilmez, saklanmaz ve reklam veya konum amacıyla kullanılmaz."
  - Öneri: §6 K1, §7.3-7.4 Q2.
- Satır 6834 · `C1` `K1` `Q2`
  - Mevcut: "İzinlerinizi her zaman geri alabilirsiniz: Cihaz ayarlarından uygulamanın konum ve kamera iznini kapatabilir, reklam tanımlayıcınızı sıfırlayabilir veya kişiselleştirilmiş reklamları işletim sistemi düzeyinde tamamen devre dışı bırakabilirsiniz."
  - Öneri: §5.2 C1, §6 K1, §7.3-7.4 Q2.
- Satır 6837 · `C1` `C4`
  - Mevcut: "R10 kapsamında işlenen veriler: Reklam tanımlayıcısı (iOS'ta IDFA, Android'de AAID), cihaz modeli ve platformu, işletim sistemi ve uygulama sürümü, uygulama içi görüntüleme ve tıklama olayları, reklam ölçümleme olayları."
  - Öneri: §5.2 C1, §5.2 C4.
- Satır 6838 · `K1` `K2`
  - Mevcut: "R11 kapsamında işlenen veriler: Cihaz izniyle elde edilen yaklaşık konum (ilçe veya semt düzeyi) ve konumun elde edildiği zaman bilgisi."
  - Öneri: §6 K1, §6 K2.
- Satır 6840 · `C1` `K1`
  - Mevcut: "Saklama: Reklam tanımlayıcısı ve yaklaşık konum kayıtları, rızanız süresince ve geri çekmenizden itibaren en geç doksan gün içinde silinmek üzere; ölçümleme çıktıları kimliğinizle ilişkilendirilemeyecek biçimde toplulaştırılarak saklanabilir."
  - Öneri: §5.2 C1, §6 K1.
- Satır 6842 · `D4` `D2` `Q1`
  - Mevcut: "Rıza vermezseniz: Uygulama tüm işlevleriyle çalışmaya devam eder; menü görüntüleme, sipariş, üyelik, karekod ile puan kazanma ve puan harcama etkilenmez."
  - Öneri: §4.4 D4, §4.4 D2, §7.4 Q1.
- Satır 6842 · `K1`
  - Mevcut: "Yalnızca reklamlar ilgi alanınıza göre kişiselleştirilmez ve konuma özel kampanya gösterilmez."
  - Öneri: §6 K1.

**16. Açık Rıza Vermemenin Sonuçları - Rıza Hizmet Şartı Değildir**

- Satır 6870 · `D6`
  - Mevcut: "Rıza vermemeniz veya rızanızı geri çekmeniz nedeniyle hakkınızda olumsuz bir kayıt oluşturulmaz, hizmet kalitesi düşürülmez, puan kazanma oranınız değiştirilmez, ek ücret talep edilmez ve size farklı bir fiyat uygulanmaz."
  - Öneri: §4.4 D6.
- Satır 6884 · `D9`
  - Mevcut: "Ödül programına katılım ve puan kazanma"
  - Öneri: §4.4 D9.
- Satır 6886 · `D4` `D2` `Q1`
  - Mevcut: "Etkilenmez. Alışverişten ve karekod ile kafe ziyaretinden puan kazanmaya, puanı indirim olarak kullanmaya standart koşullarla devam edersiniz."
  - Öneri: §4.4 D4, §4.4 D2, §7.4 Q1.
- Satır 6891 · `Ö5` `Ö3`
  - Mevcut: "Etkilenmez. Ödeme, iyzico Checkout Form üzerinden ve 3D Secure doğrulaması iyzico tarafından yürütülerek tamamlanır."
  - Öneri: §3.3 Ö5, §3.3 Ö3.
- Satır 6911 · `D2` `D3`
  - Mevcut: "Etkilenmez. 6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği'nden doğan haklarınız aynen geçerlidir; puanla ödenen kısım iade hâlinde puan olarak geri yüklenir."
  - Öneri: §4.4 D2, §4.4 D3.
- Satır 6921 · `D9`
  - Mevcut: "Etkilenmez. Sipariş, ödeme, kargo, puan ve güvenlik bildirimleri e-posta ve push bildirim olarak gönderilmeye devam eder."
  - Öneri: §4.4 D9.
- Satır 6926 · `D9` `K1`
  - Mevcut: "Kişiselleştirilmiş kampanya, puan ve ürün önerileri, pazarlama iletileri ve pazarlama amaçlı push bildirimler, ilgi alanına dayalı reklamlar, konuma özel kampanyalar ve onaya bağlı görsel içerikler."
  - Öneri: §4.4 D9, §6 K1.

**17. Açık Rızanın Nasıl Verildiği**

- Satır 6942 · `K1` `Q2`
  - Mevcut: "Mobil uygulamada bildirim, konum ve kamera izinleri işletim sisteminin kendi izin ekranları üzerinden ayrıca alınır."
  - Öneri: §6 K1, §7.3-7.4 Q2.
- Satır 6942 · `C1` `K1`
  - Mevcut: "Bu cihaz izinleri teknik bir erişim iznidir; uygulama içinde verilen pazarlama, reklam tanımlayıcısı ve konuma dayalı kampanya onaylarının yerine geçmez."
  - Öneri: §5.2 C1, §6 K1.

**18. Açık Rızanın Geri Çekilmesi**

- Satır 6955 · `D6` `C1` `C2` `K1` `Q2`
  - Mevcut: "Ayrıca cihazınızın ayarlarından bildirim, konum ve kamera izinlerini kapatabilir, reklam tanımlayıcınızı sıfırlayabilir veya uygulamayı cihazınızdan kaldırabilirsiniz; uygulamanın kaldırılması bildirim tokeninizi geçersiz kılar ancak üyelik ve puan kayıtlarınızı kendiliğinden silmez."
  - Öneri: §4.4 D6, §5.2 C1, §5.2 C2, §6 K1, §7.3-7.4 Q2.

**19. Geri Çekmenin Sonuçları ve Süreler**

- Satır 6969 · `D6`
  - Mevcut: "Örneğin sipariş ve fatura kayıtları vergi mevzuatı gereği, puan hareketleri üyelik ilişkisinin ifası ve ihtilafların çözümü için, rıza ve ret kayıtları ise ispat yükümlülüğü nedeniyle saklanır."
  - Öneri: §4.4 D6.
- Satır 6992 · `C1` `K1`
  - Mevcut: "Reklam tanımlayıcısı ve yaklaşık konum kayıtlarının silinmesi"
  - Öneri: §5.2 C1, §6 K1.
- Satır 6997 · `D6`
  - Mevcut: "Profilleme, puan önerisi ve ürün önerisi kayıtlarının silinmesi"
  - Öneri: §4.4 D6.

**22. Rıza Kapsamının Değişmesi ve Yeniden Rıza Alınması**

- Satır 7047 · `K1`
  - Mevcut: "Yeni bir veri kategorisinin işlenmeye başlanması, örneğin yaklaşık konum yerine kesin konum verisinin pazarlama amacıyla kullanılmak istenmesi."
  - Öneri: §6 K1.
- Satır 7050 · `D9`
  - Mevcut: "Profilleme veya ödül puanı önerisi yönteminin niteliğinin esaslı biçimde değişmesi, örneğin otomatik karar verme kapsamına giren bir uygulamaya geçilmesi."
  - Öneri: §4.4 D9.

**24. Veri Güvenliği**

- Satır 7079 · `Ö3`
  - Mevcut: "Ödeme güvenliği: Ödeme sayfası iyzico Checkout Form üzerinde açılır; kart numarası, son kullanma tarihi ve güvenlik kodu hiçbir aşamada sitemizin veya uygulamamızın sunucularından geçmez ve saklanmaz."
  - Öneri: §3.3 Ö3.
- Satır 7079 · `Ö4` `Ö5`
  - Mevcut: "PCI-DSS yükümlülüğü iyzico'ya aittir, 3D Secure doğrulaması iyzico tarafından yürütülür."
  - Öneri: §3.3 Ö4, §3.3 Ö5.

</details>

<details>
<summary><b>Veri Sahibi Başvuru Formu</b> (<code>kvkk-basvuru-formu</code>) - 2 cümle</summary>

Kod dağılımı: D3 1, Ö2 1


**1. Amaç ve Kapsam**

- Satır 7190 · `D3`
  - Mevcut: "Rehberin kapsamı, {{BRAND}} markası altında yürütülen tüm faaliyetlerde işlenen kişisel verileri kapsar: {{SITE_URL}} adresinde yayımlanan internet sitesi, online mağaza (bottega) ve iOS ile Android için yayımlanan {{BRAND}} mobil uygulaması üzerinden gerçekleştirilen üyelik, sipariş, ödeme, kargo, iade, ödül/puan programı ve destek süreçleri; {{ADDRESS}} adresindeki fiziki işletmede sunulan kafe ve gelato bar hizmetleri; {{HANDLE}} kullanıcı adıyla işletilen sosyal medya hesapları üzerinden kurulan iletişimler; ticari elektronik ileti ve pazarlama faaliyetleri ile ziyaretçi, aday çalışan, tedarikçi ve iş ortağı temsilcisi verilerinin işlendiği süreçler."
  - Öneri: §4.4 D3.

**9. Talebin Açıklanması ve Destekleyici Belgeler**

- Satır 7463 · `Ö2`
  - Mevcut: "Kart numarasının tamamını hiçbir kanalda paylaşmayınız; kart verileri şirketimizde saklanmaz, ödeme işlemleri, 6493 sayılı Kanun kapsamında yetkilendirilmiş ödeme kuruluşu iyzico altyapısı üzerinden yürütülür."
  - Öneri: §3.3 Ö2.

</details>

<details>
<summary><b>Kişisel Veri Saklama ve İmha Politikası</b> (<code>veri-saklama-ve-imha-politikasi</code>) - 42 cümle</summary>

Kod dağılımı: D1 11, D6 9, C2 7, D2 5, D3 5, D4 4, K1 4, C1 3, Q1 3, Q2 3, C3 2, D9 2, Ö1 2, Ö10 2, Ö3 2, Ö4 2, Ö5 2, D5 1, V1 1, Ö6 1, Ö9 1


**3. Tanımlar**

- Satır 7847 · `D5`
  - Mevcut: "Ödül puanı"
  - Öneri: §4.4 D5.
- Satır 7852 · `C2`
  - Mevcut: "Push bildirim tokeni"
  - Öneri: §5.2 C2.
- Satır 7859 · `C1`
  - Mevcut: "Mobil işletim sistemi tarafından sağlanan ve kullanıcının cihaz ayarlarından sınırlandırabildiği reklam tanımlayıcıları (IDFA/AAID) ile uygulama kurulum tanımlayıcısı."
  - Öneri: §5.2 C1.

**5. Kayıt Ortamları**

- Satır 7945 · `D6`
  - Mevcut: "Uygulama veri tabanı: Müşteri hesapları, siparişler, ürün ve stok kayıtları, promosyon kullanımları, ödül puanı hareketleri ile olay kayıtlarının tutulduğu, {{DB_PROVIDER}} (PostgreSQL) altyapısında barındırılan veri tabanı."
  - Öneri: §4.4 D6.
- Satır 7950 · `C2`
  - Mevcut: "Push bildirim tokeni deposu: Mobil uygulamaya bildirim iletilebilmesi için tutulan cihaz tokenleri, bildirim izni durumu, uygulama sürümü ve işletim sistemi bilgisi ile bildirim gönderim kayıtları."
  - Öneri: §5.2 C2.
- Satır 7951 · `C3`
  - Mevcut: "Mobil uygulama tanılama ortamı: Uygulamanın kararlılığını izlemek amacıyla toplanan çökme (crash) kayıtları, hata izleri ve temel cihaz bilgileri; bu ortamda kişisel veri asgari düzeyde tutulur."
  - Öneri: §5.2 C3.
- Satır 7953 · `Ö9` `Ö10` `Ö5`
  - Mevcut: "Ödeme ve muhasebe kayıtları: Ödeme hizmeti sağlayıcısı iyzico altyapısından dönen işlem referansları, provizyon, 3D Secure sonucu ve iade kayıtları ile mali müşavir nezdinde tutulan muhasebe kayıtları."
  - Öneri: §3.3 Ö9, §3.3 Ö10, §3.3 Ö5.
- Satır 7953 · `Ö3`
  - Mevcut: "Ödeme sayfası iyzico'nun Checkout Form ekranında açılır; kart numarası, son kullanma tarihi ve güvenlik kodu hiçbir aşamada Şirket sunucularından geçmez ve saklanmaz."
  - Öneri: §3.3 Ö3.

**6. Saklamayı Gerektiren Hukuki, Teknik ve Ticari Sebepler**

- Satır 7978 · `D2` `D3`
  - Mevcut: "Ödül puanı programı kapsamında kazanılan ve harcanan puanların, puanla yapılan indirimlerin ve iade hâlinde puan geri yüklemesinin ispatlanabilmesi ile program kurallarına uyumun gösterilebilmesi gerekliliği."
  - Öneri: §4.4 D2, §4.4 D3.

**8. Veri Kategorileri Bazında Saklama ve İmha Süreleri**

- Satır 8026 · `Ö4`
  - Mevcut: "10 yıl. Kart numarasının tamamı, son kullanma tarihi ve güvenlik kodu (CVV/CVC) hiçbir aşamada saklanmaz; kart verisi iyzico'nun PCI-DSS uyumlu ortamında işlenir ve PCI-DSS yükümlülüğü iyzico'ya aittir."
  - Öneri: §3.3 Ö4.
- Satır 8058 · `D4` `D2` `Q1`
  - Mevcut: "Ödül puanı programı verisi (puan bakiyesi, kazanma ve harcama hareketleri, karekod ile kafede puan kazanma kayıtları)"
  - Öneri: §4.4 D4, §4.4 D2, §7.4 Q1.
- Satır 8060 · `D3` `D6`
  - Mevcut: "Puan bakiyesi üyelik ilişkisinin devamı süresince saklanır; hesabın kapanmasıyla bakiye sona erer, puan nakde çevrilemez ve devredilemez. Gerçekleşmiş puan hareketleri, bağlı olduğu sipariş ve iade kayıtlarının ispatı için 10 yıl saklanır."
  - Öneri: §4.4 D3, §4.4 D6.
- Satır 8063 · `C2`
  - Mevcut: "Push bildirim tokeni ve bildirim tercihleri (cihaz tokeni, izin durumu, uygulama sürümü, işletim sistemi bilgisi)"
  - Öneri: §5.2 C2.
- Satır 8068 · `C1`
  - Mevcut: "Cihaz tanımlayıcıları (IDFA/AAID) ve uygulama ölçümleme verisi"
  - Öneri: §5.2 C1.
- Satır 8073 · `C3`
  - Mevcut: "Mobil uygulama çökme (crash) ve tanılama kayıtları"
  - Öneri: §5.2 C3.
- Satır 8098 · `K1`
  - Mevcut: "Yaklaşık konum verisi (kullanıcı izin verirse)"
  - Öneri: §6 K1.
- Satır 8100 · `K1`
  - Mevcut: "Yalnızca ilgili işlem anında ve oturum süresince işlenir; oturumun sonunda saklanmaz. Konum geçmişi tutulmaz."
  - Öneri: §6 K1.

**9. Mobil Uygulamaya İlişkin Özel Saklama ve İmha Kuralları**

- Satır 8156 · `D4` `Q1`
  - Mevcut: "{{BRAND}} mobil uygulaması, App Store ve Google Play üzerinden iOS ve Android cihazlara kurulabilen; menü görüntüleme, sipariş verme, üyelik yönetimi, ödül puanı takibi, kafede karekod (QR) ile puan kazanma ve bildirim alma işlevlerini sunar."
  - Öneri: §4.4 D4, §7.4 Q1.
- Satır 8156 · `Ö1`
  - Mevcut: "Uygulama üzerinden verilen siparişlerin ödemesi de iyzico altyapısı üzerinden gerçekleştirilir; uygulama mağazası içi satın alma kullanılmaz."
  - Önerilen: "Uygulama üzerinden verilen siparişlerin ödemesi de PayNkolay altyapısı üzerinden gerçekleştirilir; uygulama mağazası içi satın alma kullanılmaz."
- Satır 8161 · `C1`
  - Mevcut: "Cihaz tanımlayıcıları (IDFA/AAID) yalnızca kullanıcının izin verdiği süre boyunca işlenir; izin geri alındığında ilgili kayıtlar silinir veya anonim hâle getirilir."
  - Öneri: §5.2 C1.
- Satır 8162 · `C2`
  - Mevcut: "Push bildirim tokeni; bildirim izninin kaldırılması, uygulamanın cihazdan silinmesi ya da tokenin geçersiz kılınması hâlinde sunucu tarafında silinir."
  - Öneri: §5.2 C2.
- Satır 8163 · `Q2`
  - Mevcut: "Kamera erişimi yalnızca karekod okuma anında ve kullanıcının izniyle kullanılır; karekod görüntüsü veya kamera görüntüsü kaydedilmez, yalnızca okunan işleme ilişkin kayıt tutulur."
  - Öneri: §7.3-7.4 Q2.
- Satır 8164 · `K1`
  - Mevcut: "Konum verisi yalnızca kullanıcı izin verirse ve en yakın şubenin gösterilmesi amacıyla yaklaşık düzeyde işlenir; konum geçmişi tutulmaz."
  - Öneri: §6 K1.
- Satır 8167 · `D6`
  - Mevcut: "Uygulamanın cihazdan kaldırılması tek başına üyeliği sona erdirmez; üyelik, sipariş geçmişi ve puan bakiyesi hesap kapatılıncaya kadar bu Politikadaki sürelere tabi olarak saklanmaya devam eder."
  - Öneri: §4.4 D6.

**10. Ödül Puanı Programı Verilerinin Saklanması ve İmhası**

- Satır 8172 · `D1` `D9`
  - Mevcut: "10. Ödül Puanı Programı Verilerinin Saklanması ve İmhası"
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 8174 · `D1` `D2`
  - Mevcut: "Ödül puanı programı kapsamında üyeler, alışverişlerinden ve kafe ziyaretlerinden puan kazanır ve bu puanları sonraki alışverişlerinde indirim olarak kullanabilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 8174 · `D1` `D9`
  - Mevcut: "Puan bir para birimi değildir; nakde çevrilemez, devredilemez ve üyelik hesabına bağlıdır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 8175 · `Ö10` `D1` `D2` `D3`
  - Mevcut: "Puanla ödenen bir siparişin iadesi hâlinde kullanılan puan hesaba geri yüklenir; bedelin para ile ödenen kısmı, ödemenin yapıldığı kanala iyzico üzerinden iade edilir."
  - Öneri: §3.3 Ö10, §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 8175 · `D1` `D3` `D6`
  - Mevcut: "Bu nedenle puan hareketleri, ilgili sipariş ve iade kayıtlarıyla birlikte ispat amacıyla saklanır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D3, §4.4 D6.
- Satır 8178 · `D1` `D4` `D2` `Q1`
  - Mevcut: "Puan kazanma ve harcama hareketleri (tarih, tutar, ilgili sipariş veya karekod işlemi) mali ve sözleşmesel ispat gerekliliği nedeniyle bağlı olduğu sipariş kaydının saklama süresine tabidir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §4.4 D2, §7.4 Q1.
- Satır 8179 · `D1` `D6`
  - Mevcut: "Puan bakiyesi üyelik ilişkisi süresince tutulur; hesabın kapanmasıyla bakiye sona erer ve yalnızca gerçekleşmiş hareketlerin ispat için gerekli kaydı saklanır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D6.
- Satır 8180 · `D1` `D6`
  - Mevcut: "Bu durum kazanılmış puan bakiyesini etkilemez."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D6.
- Satır 8181 · `D1` `D4` `Q2`
  - Mevcut: "Karekod ile kafede puan kazanma işlemlerinde işlem zamanı, işletme noktası ve puan tutarı kaydedilir; karekod veya kamera görüntüsü saklanmaz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §7.3-7.4 Q2.
- Satır 8182 · `D1` `D6`
  - Mevcut: "Puan bakiyesine yönelik manuel yönetici müdahaleleri (puan ekleme, düşme veya düzeltme) gerekçesiyle birlikte değiştirilemez olay kaydına yazılır ve olay kaydı saklama süresine tabidir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D6.
- Satır 8183 · `D1` `D6`
  - Mevcut: "Puan hareketlerinden üretilen istatistikler, kimliği belirlenebilir alanlar çıkarılarak toplulaştırılmış biçimde saklanabilir; bu veriler anonim hâle geldikleri ölçüde bu Politikanın saklama sürelerine tabi değildir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D6.

**11. Kişisel Verilerin Silinmesi, Yok Edilmesi ve Anonim Hâle Getirilmesi Yöntemleri**

- Satır 8207 · `C2`
  - Mevcut: "Cihaz üzerindeki verinin silinmesi: Mobil uygulamanın yerel deposunda tutulan oturum, sepet ve önbellek verisinin çıkış, uygulama verisi temizleme veya uygulamanın kaldırılması ile silinmesi; buna bağlı push bildirim tokeninin sunucu tarafında geçersiz kılınarak kayıttan düşürülmesi."
  - Öneri: §5.2 C2.

**14. Veri İşleyenler ve Yurt Dışına Aktarım Hâlinde İmha**

- Satır 8237 · `Ö1` `C2` `V1`
  - Mevcut: "Şirket, faaliyetlerini yürütmek için barındırma (Vercel), veri tabanı ({{DB_PROVIDER}} üzerinde barındırılan PostgreSQL), işlemsel e-posta gönderimi (Resend), ödeme hizmeti (iyzico), mobil uygulama dağıtımı ile push bildirim iletimi, kargo, muhasebe ve müşteri iletişimi alanlarında hizmet sağlayıcılarla çalışır."
  - Öneri: §3.3 Ö1, §5.2 C2, §9.1 V1 (Supabase eklenir).

**16. İlgili Kişinin Talebi Üzerine Silme veya Yok Etme**

- Satır 8276 · `D3` `D6`
  - Mevcut: "Üyelik hesabının kapatılması hâlinde ödül puanı bakiyesi sona erer ve puan nakde çevrilmez; buna karşılık gerçekleşmiş puan hareketleri, bağlı olduğu sipariş ve iade kayıtlarının ispatı amacıyla ilgili saklama süresince muhafaza edilir."
  - Öneri: §4.4 D3, §4.4 D6.
- Satır 8276 · `C2`
  - Mevcut: "Mobil uygulamaya ilişkin bildirim tokeni ve cihaz tanımlayıcıları ise talep üzerine gecikmeksizin silinir."
  - Öneri: §5.2 C2.

**18. Teknik ve İdari Tedbirler**

- Satır 8308 · `Ö4` `Ö5` `Ö3`
  - Mevcut: "Teknik: Ödeme adımının iyzico Checkout Form ekranında açılması, 3D Secure doğrulamasının iyzico tarafından yürütülmesi, kart verisinin iyzico'nun PCI-DSS uyumlu ortamında işlenmesi ve Şirket sistemlerinde tam kart numarası, son kullanma tarihi ile güvenlik kodunun hiçbir aşamada saklanmaması."
  - Öneri: §3.3 Ö4, §3.3 Ö5, §3.3 Ö3.
- Satır 8309 · `Ö6`
  - Mevcut: "Teknik: Ödeme bildirimlerinin imzalı webhook ile alınarak imza doğrulamasına tabi tutulması, işlem sonucunun iyzico'ya yeniden sorularak teyit edilmesi ve mükerrer işlemlerin benzersiz işlem referansı ile engellenmesi."
  - Öneri: §3.3 Ö6.
- Satır 8312 · `K1` `Q2`
  - Mevcut: "Teknik: Mobil uygulamada oturum jetonlarının cihazın güvenli anahtar deposunda (Keychain/Keystore) tutulması, sunucu iletişiminin sertifika doğrulamalı TLS ile yapılması ve bildirim, konum, kamera gibi cihaz izinlerinin yalnızca ilgili işlev için ve kullanıcı onayıyla istenmesi."
  - Öneri: §6 K1, §7.3-7.4 Q2.

</details>

<details>
<summary><b>Çerez Politikası</b> (<code>cerez-politikasi</code>) - 28 cümle</summary>

Kod dağılımı: Ö16 8, Ö3 4, Ö5 4, D2 3, D4 3, D9 3, Ö1 3, C1 2, K1 2, Q1 2, Q2 2, Ö2 2, Ö4 2, C2 1, C3 1, D6 1, V2 1, Ö10 1


**4. Çerezleri Hangi Amaçlarla Kullanıyoruz**

- Satır 8528 · `D2`
  - Mevcut: "Üyeliğe bağlı ödül ve puan programının yürütülmesi: kazandığınız puanların hesabınıza işlenmesi, puan bakiyenizin gösterilmesi ve puanın indirim olarak kullanıldığı sipariş akışında oturumun sürdürülmesi."
  - Öneri: §4.4 D2.

**5. Süre Bazında Çerez Türleri: Oturum ve Kalıcı Çerezler**

- Satır 8544 · `Ö5` `Ö16`
  - Mevcut: "Sepetin ödeme adımıyla eşleştirilmesi, siteler arası istek sahteciliğine karşı üretilen tek kullanımlık belirteçler ve iyzico'nun 3D Secure yönlendirmesi sırasında kullandığı geçici çerezler bu gruptadır."
  - Öneri: §3.3 Ö5, §3.3 Ö16.

**6. Kaynak Bazında Çerez Türleri: Birinci Taraf ve Üçüncü Taraf Çerezler**

- Satır 8564 · `Ö5` `Ö3` `Ö2` `Ö16`
  - Mevcut: "Ödeme kuruluşu çerezleri: Ödeme adımında, 6493 sayılı Kanun kapsamında yetkilendirilmiş ödeme kuruluşu olan iyzico'nun Checkout Form sayfasına ve buradan bankanızın 3D Secure sayfasına yönlendirilirsiniz; iyzico ve ilgili banka kendi oturum ve sahtekârlık önleme çerezlerini yerleştirir."
  - Öneri: §3.3 Ö5, §3.3 Ö3, §3.3 Ö2, §3.3 Ö16.

**8. Zorunlu (Teknik) Çerezler Envanteri**

- Satır 8599 · `Ö16`
  - Mevcut: "Bu çerezlerin büyük bölümü birinci taraftır, yani {{SITE}} alan adına aittir; yalnızca ödeme adımında, iyzico'nun ve kartınızı veren bankanın kendi zorunlu oturum ve güvenlik çerezleri devreye girer."
  - Öneri: §3.3 Ö16.
- Satır 8633 · `Ö16`
  - Mevcut: "iyzico ödeme oturumu çerezleri"
  - Öneri: §3.3 Ö16.
- Satır 8635 · `Ö5` `Ö3` `Ö16`
  - Mevcut: "Amaç: iyzico Checkout Form sayfasında ödeme oturumunun güvenliği, 3D Secure doğrulaması ve sahtekârlık önleme. Taraf: üçüncü taraf (iyzico ve kartı veren banka, ödeme adımına yönlendirildiğinizde). Tür: oturum çerezi. Süre: ödeme işlemi süresince. Rıza: gerekmez, işlemin güvenliği için zorunlu."
  - Öneri: §3.3 Ö5, §3.3 Ö3, §3.3 Ö16.

**11. Pazarlama (Hedefleme) Çerezleri Envanteri**

- Satır 8706 · `D9`
  - Mevcut: "Kampanya, indirim veya tanıtım içeren push bildirimler ticari elektronik ileti sayılır ve ayrıca alınan onaya dayanır; sipariş durumu, teslimat, puan kazanımı ve güvenlik uyarısı gibi işlemsel bildirimler ise ticari elektronik ileti değildir."
  - Öneri: §4.4 D9.

**15. Mobil Uygulamada Çerez Kullanılmaması: SDK, Cihaz Tanımlayıcıları ve İzin Yönetimi**

- Satır 8797 · `D4` `Q1`
  - Mevcut: "Uygulama; menü görüntüleme, sipariş verme, üyelik, ödül ve puan takibi, kafede QR okutarak puan kazanma ve bildirim işlevlerini yerine getirebilmek için çerez yerine yazılım geliştirme kitlerini (SDK), cihaz tanımlayıcılarını ve cihazın yerel depolama alanlarını kullanır."
  - Öneri: §4.4 D4, §7.4 Q1.
- Satır 8798 · `Ö1`
  - Mevcut: "Ödeme adımında açılan iyzico sayfası da bu kapsamdadır."
  - Önerilen: "Ödeme adımında açılan PayNkolay sayfası da bu kapsamdadır."
- Satır 8799 · `D4` `Q1`
  - Mevcut: "İzin vermemeniz hâlinde yalnızca ilgili işlev (örneğin QR ile puan kazanma veya bildirim) çalışmaz; uygulamanın diğer işlevleri kullanılabilir olmaya devam eder."
  - Öneri: §4.4 D4, §7.4 Q1.
- Satır 8802 · `C1`
  - Mevcut: "Cihaz tanımlayıcıları: iOS'ta reklam tanımlayıcısı (IDFA) ve Android'de reklam kimliği (AAID) yalnızca ölçümleme veya pazarlama iznini vermeniz hâlinde kullanılır. iOS'ta bu erişim ayrıca işletim sisteminin uygulama takibi izni ekranına tabidir; izin vermezseniz tanımlayıcı okunmaz."
  - Öneri: §5.2 C1.
- Satır 8803 · `C2`
  - Mevcut: "Bildirim tokeni: Push bildirim gönderilebilmesi için cihazınıza ait bildirim tokeni ve uygulama örneği kimliği tutulur."
  - Öneri: §5.2 C2.
- Satır 8804 · `C3`
  - Mevcut: "Teknik ve çökme (crash) kayıtları: Uygulama sürümü, işletim sistemi sürümü, cihaz modeli ve hata kayıtları uygulamanın çalışması ile kararlılığının sağlanması amacıyla işlenir."
  - Öneri: §5.2 C3.
- Satır 8805 · `D6`
  - Mevcut: "Yerel depolama: Oturum belirteci, sepet içeriği, puan bakiyesinin son görüntülenen hâli ve arayüz tercihleri cihazınızda saklanır."
  - Öneri: §4.4 D6.
- Satır 8806 · `D4` `Q2`
  - Mevcut: "Kamera erişimi: Kafede QR okutarak puan kazanmak istediğinizde yalnızca o işlem sırasında ve yalnızca QR okuma amacıyla kamera erişimi istenir; görüntü kaydedilmez ve saklanmaz."
  - Öneri: §4.4 D4, §7.3-7.4 Q2.
- Satır 8807 · `K1`
  - Mevcut: "Konum: Yaklaşık konum yalnızca izin vermeniz hâlinde ve en yakın şubenin gösterilmesi gibi sınırlı amaçlarla kullanılır; arka planda sürekli konum takibi yapılmaz."
  - Öneri: §6 K1.
- Satır 8808 · `D2`
  - Mevcut: "Ödül ve puan verileri: Kazandığınız ve kullandığınız puanlar ile harcama geçmişiniz çerezlerle değil, üyelik hesabınıza bağlı olarak sunucuda tutulur."
  - Öneri: §4.4 D2.
- Satır 8809 · `Ö1`
  - Mevcut: "Uygulama içinde mağaza üzerinden satın alma yapılmaz; ödemeler iyzico altyapısı üzerinden alınır."
  - Önerilen: "Uygulama içinde mağaza üzerinden satın alma yapılmaz; ödemeler PayNkolay altyapısı üzerinden alınır."
- Satır 8810 · `C1` `K1` `Q2`
  - Mevcut: "İzin yönetimi: iOS'ta Ayarlar uygulamasından {{BRAND}} bölümüne, Android'de Ayarlar, Uygulamalar, {{BRAND}}, İzinler yoluna girerek bildirim, konum ve kamera izinlerini açıp kapatabilir; reklam tanımlayıcısını sıfırlayabilir veya kişiselleştirilmiş reklamı kapatabilirsiniz."
  - Öneri: §5.2 C1, §6 K1, §7.3-7.4 Q2.

**17. Üçüncü Taraf Hizmet Sağlayıcılar ve Kendi Politikaları**

- Satır 8827 · `Ö3` `Ö16`
  - Mevcut: "Ödeme adımında sayfa, ödeme kuruluşu iyzico'nun barındırdığı Checkout Form ekranında açılır ve iyzico bu ekranda kendi çerezlerini yerleştirir."
  - Öneri: §3.3 Ö3, §3.3 Ö16.
- Satır 8863 · `D9`
  - Mevcut: "Kategori: zorunlu. Ürün, sipariş, üyelik ve puan verilerinin saklandığı, {{DB_PROVIDER}} üzerinde barındırılan PostgreSQL veri tabanı; erişim yalnızca sunucu tarafındaki yetkili servisle sınırlıdır ve bağlantı şifrelidir. Tarayıcınıza doğrudan çerez yerleştirmez."
  - Öneri: §4.4 D9.
- Satır 8868 · `D9`
  - Mevcut: "Kategori: zorunlu. Sipariş onayı, kargo bildirimi, puan bilgilendirmesi ve şifre sıfırlama gibi işlemsel e-postaların gönderimi. Sitede çerez yerleştirmez; e-posta açılma ölçümü yapılıyorsa ilgili e-postada belirtilir."
  - Öneri: §4.4 D9.
- Satır 8871 · `Ö1`
  - Mevcut: "iyzico (ödeme kuruluşu / sanal POS)"
  - Önerilen: "PayNkolay (ödeme hizmeti sağlayıcısı / sanal POS)"
- Satır 8873 · `Ö4` `Ö5` `Ö3` `Ö2` `Ö16`
  - Mevcut: "Kategori: zorunlu. Ödeme sayfası iyzico'nun Checkout Form ekranında açılır; iyzico kendi oturum, güvenlik ve sahtekârlık önleme çerezlerini yerleştirir ve 3D Secure doğrulamasını yürütür. Kart numarası, son kullanma tarihi ve CVV bilgisi hiçbir aşamada {{SHORT_NAME}} sunucularından geçmez ve saklanmaz; PCI-DSS yükümlülüğü iyzico'ya aittir. iyzico, 6493 sayılı Kanun kapsamında yetkilendirilmiş ödeme kuruluşudur."
  - Öneri: §3.3 Ö4, §3.3 Ö5, §3.3 Ö3, §3.3 Ö2, §3.3 Ö16.
- Satır 8878 · `V2`
  - Mevcut: "Kategori: zorunlu. Yurtiçi Kargo, Aras Kargo ve İstanbul içi motokurye takip bağlantıları. Takip bağlantısına tıkladığınızda ilgili firmanın kendi çerez politikası uygulanır."
  - Öneri: §9.2 V2.

**18. Çerezler Yoluyla İşlenen Kişisel Veriler, Hukuki Sebepler ve Aktarım**

- Satır 8890 · `Ö4` `Ö16`
  - Mevcut: "Kart numarası, son kullanma tarihi ve güvenlik kodu (CVV) gibi ödeme bilgileri çerezlerle işlenmez, {{SHORT_NAME}} sunucularından geçmez ve saklanmaz; bu bilgiler doğrudan PCI-DSS uyumlu ödeme kuruluşu iyzico'nun ortamında işlenir."
  - Öneri: §3.3 Ö4, §3.3 Ö16.
- Satır 8890 · `Ö10`
  - Mevcut: "İade ve kısmi iade işlemleri de iyzico üzerinden yürütülür."
  - Öneri: §3.3 Ö10.
- Satır 8900 · `D2`
  - Mevcut: "Ödül programı verileri: kazanılan ve kullanılan puanlar ile buna bağlı harcama geçmişi."
  - Öneri: §4.4 D2.

</details>

<details>
<summary><b>Ticari Elektronik İleti ve İYS Aydınlatması</b> (<code>ticari-elektronik-ileti</code>) - 23 cümle</summary>

Kod dağılımı: C2 5, D2 4, D4 3, D8 3, K1 3, Q1 3, Q2 3, C1 2, D3 2, D5 2, D9 2, Ö10 2, D6 1, Ö2 1, Ö4 1, Ö5 1, Ö8 1, Ö9 1


**1. Amaç, Kapsam ve Tanımlar**

- Satır 9128 · `D5` `D4` `Q1`
  - Mevcut: "Mobil uygulama: iOS ve Android işletim sistemleri için yayımlanan ve menü görüntüleme, sipariş, üyelik yönetimi, ödül puanı takibi ile kafede QR okutarak puan kazanma işlevlerini sunan {{BRAND}} uygulamasını ifade eder."
  - Öneri: §4.4 D5, §4.4 D4, §7.4 Q1.
- Satır 9130 · `D5` `D2`
  - Mevcut: "Ödül (puan) programı: Alışverişten ve kafe ziyaretinden puan kazanmanızı ve kazanılan puanı indirim olarak kullanmanızı sağlayan sadakat programını ifade eder."
  - Öneri: §4.4 D5, §4.4 D2.

**3. Ticari Elektronik İletinin Tanımı ve Kullandığımız Kanallar**

- Satır 9216 · `D8`
  - Mevcut: "{{BRAND}} olarak size gönderebileceğimiz ticari elektronik iletiler; yeni sezon kahve çekirdeği duyuruları, sınırlı üretim gelato ve yenilebilir kupa lansmanları, indirim ve promosyon kodu kampanyaları, tadım etkinliği ve atölye davetleri, ödül ve puan programına ilişkin teşvik edici duyurular, kişiye özel ürün önerileri ile bülten içeriklerinden oluşur."
  - Öneri: §4.4 D8.

**4. Ticari Elektronik İleti Sayılmayan Bildirimler (İşlemsel İletiler)**

- Satır 9270 · `Ö9` `Ö8` `Ö5`
  - Mevcut: "Ödeme sonucuna ilişkin bildirimler; ödeme kuruluşumuz iyzico tarafından yürütülen tahsilat sürecinde başarılı tahsilat, başarısız işlem, ön provizyon, taksitlendirme bilgisi ve iyzico'nun yürüttüğü 3D Secure doğrulama adımlarına ilişkin bilgilendirmeler."
  - Öneri: §3.3 Ö9, §3.3 Ö8, §3.3 Ö5.
- Satır 9274 · `Ö10`
  - Mevcut: "İade, ücret iadesi ve chargeback süreçlerine ilişkin bildirimler; iade ve kısmi iade işlemleri iyzico üzerinden yürütüldüğünden, tutarın ödeme aracınıza iadesine ve bankaya veya iyzico'ya yapılan itiraz süreçlerine dair bilgilendirmeler bu kapsamdadır."
  - Öneri: §3.3 Ö10.
- Satır 9275 · `D4` `D3` `D6` `Q1`
  - Mevcut: "Ödül ve puan programına ilişkin işlem bildirimleri; bir alışverişten veya kafede QR okutarak yaptığınız ziyaretten puan kazandığınız, puanınızın siparişte kullanıldığı, iade nedeniyle puanın hesabınıza geri yüklendiği ya da puan bakiyenizin güncellendiği bilgisi."
  - Öneri: §4.4 D4, §4.4 D3, §4.4 D6, §7.4 Q1.

**7. Onayın Kapsamı, Kanal Ayrımı ve Süresi**

- Satır 9331 · `D8`
  - Mevcut: "Onay kapsamındaki içerikler; yeni ürün ve sezon duyuruları, kampanya ve promosyon kodları, sepette bırakılan ürün hatırlatmaları, kişiye özel ürün önerileri, tadım ve atölye etkinlik davetleri, doğum günü ve yıl dönümü teklifleri ile ödül ve puan programına ilişkin teşvik edici duyurulardır."
  - Öneri: §4.4 D8.

**13. Mobil Uygulama ve Push Bildirimleri**

- Satır 9491 · `D4` `D2` `Q1`
  - Mevcut: "Uygulama üzerinden menüyü görüntüleyebilir, sipariş verebilir, üyeliğinizi yönetebilir, ödül puanlarınızı takip edebilir ve kafede QR kod okutarak puan kazanabilirsiniz."
  - Öneri: §4.4 D4, §4.4 D2, §7.4 Q1.
- Satır 9493 · `D3`
  - Mevcut: "Buna karşılık siparişinizin alındığı, ödemenizin sonuçlandığı, siparişinizin hazırlandığı veya kargoya verildiği, iade sürecinizin ilerlediği, hesabınıza yeni bir cihazdan giriş yapıldığı ya da bir alışverişten veya kafe ziyaretinden puan kazandığınız bilgisini veren push bildirimleri işlemsel bildirimdir; pazarlama içeriği taşımadıkları sürece ticari elektronik ileti sayılmaz ve ticari ileti onayınızı geri almış olsanız dahi gönderilmeye devam edebilir."
  - Öneri: §4.4 D3.
- Satır 9497 · `D9`
  - Mevcut: "Push bildirimi izni, uygulamayı ilk kullanımınızda cihazınızın işletim sistemi tarafından sorulur; izin vermemeniz uygulamayı kullanmanıza, sipariş vermenize veya puan kazanmanıza engel değildir."
  - Öneri: §4.4 D9.
- Satır 9499 · `D9`
  - Mevcut: "Ödül ve puan programına ilişkin çift puan kampanyası, puan yükseltme teklifi ve puanın kullanım süresinin dolmasına yaklaşıldığını hatırlatan teşvik içerikli duyurular ticari elektronik iletidir; yalnızca onaylı alıcılara gönderilir."
  - Öneri: §4.4 D9.
- Satır 9502 · `C2`
  - Mevcut: "Uygulamayı cihazınızdan kaldırmanız hâlinde push bildirimi gönderimi fiilen sona erer; bildirim tokeniniz geçersiz hâle geldiğinde gönderim kayıtlarımızdan silinir."
  - Öneri: §5.2 C2.
- Satır 9503 · `C2`
  - Mevcut: "Push bildirimi gönderebilmek için cihaz bildirim tokeni, uygulama sürümü, işletim sistemi ve cihaz dili gibi teknik veriler işlenir; bu veriler yalnızca bildirimin iletilmesi ve tercihlerinizin yönetilmesi amacıyla kullanılır."
  - Öneri: §5.2 C2.
- Satır 9504 · `C1`
  - Mevcut: "Mobil uygulamada çerez yerine yazılım geliştirme kitleri (SDK) ve cihaz tanımlayıcıları (IDFA / AAID) kullanılır; bu tanımlayıcılara ilişkin izinler cihaz ayarlarından yönetilir ve tanımlayıcı dilediğiniz an sıfırlanabilir."
  - Öneri: §5.2 C1.
- Satır 9505 · `K1` `Q2`
  - Mevcut: "Uygulamanın istediği izinler amaçla sınırlıdır: bildirim izni bildirim gönderimi, kamera izni yalnızca QR kod okuma, konum izni ise yalnızca izin vermeniz hâlinde en yakın şubenin gösterilmesi amacıyla kullanılır."
  - Öneri: §6 K1, §7.3-7.4 Q2.
- Satır 9507 · `Ö10`
  - Mevcut: "Uygulama içinden yapılan satın almalarda ödeme, mağaza içi satın alma yöntemiyle değil iyzico üzerinden alınır; bu nedenle ödeme ve iade bildirimleri iyzico süreçlerine göre iletilir."
  - Öneri: §3.3 Ö10.

**17. Kişisel Verilerin İşlenmesi, Açık Rıza ve İleti Onayı İlişkisi**

- Satır 9657 · `D2`
  - Mevcut: "İşlenen veriler: ad, soyad, e-posta adresi, cep telefonu numarası, onay ve ret kayıtları, gönderim ve etkileşim kayıtları, alışveriş geçmişine dayalı ilgi alanı bilgileri ile ödül programı kapsamındaki puan ve harcama geçmişidir."
  - Öneri: §4.4 D2.
- Satır 9658 · `C1` `C2` `K1` `Q2`
  - Mevcut: "Mobil uygulama kullanmanız hâlinde ayrıca cihaz tanımlayıcıları (IDFA / AAID), push bildirim tokeni, uygulama sürümü, işletim sistemi bilgisi, uygulama çökme (crash) kayıtları ve yalnızca izin vermeniz hâlinde yaklaşık konum bilgisi ile QR kod okuma sırasında kamera erişimi söz konusu olur."
  - Öneri: §5.2 C1, §5.2 C2, §6 K1, §7.3-7.4 Q2.
- Satır 9661 · `D2` `D8`
  - Mevcut: "Puan ve harcama geçmişinizin size özel teklif ve segment oluşturmak amacıyla profilleme yoluyla işlenmesi açık rızanıza tabidir; açık rıza vermemeniz hâlinde ödül programından yararlanmaya devam eder, yalnızca kişiselleştirilmiş teklif almazsınız."
  - Öneri: §4.4 D2, §4.4 D8.

**19. Gönderim Altyapısı, Aktarım ve Veri Güvenliği**

- Satır 9714 · `C2`
  - Mevcut: "Mobil uygulama bildirimleri, Apple ve Google'ın işletim sistemi düzeyindeki bildirim servisleri üzerinden iletilir; bu servislere yalnızca cihaz bildirim tokeni ve bildirim içeriği aktarılır"
  - Öneri: §5.2 C2.
- Satır 9719 · `Ö4` `Ö2`
  - Mevcut: "Ödemeler, 6493 sayılı Kanun kapsamında yetkilendirilmiş ödeme kuruluşu iyzico üzerinden alınır; kart numarası, son kullanma tarihi ve CVV gibi kart verileri hiçbir aşamada sunucularımızdan geçmez ve saklanmaz, PCI-DSS yükümlülüğü iyzico'ya aittir"
  - Öneri: §3.3 Ö4, §3.3 Ö2.

**20. Veri Kaynağı ve Uygulamadığımız Yöntemler**

- Satır 9769 · `C2` `K1`
  - Mevcut: "Cihaz tanımlayıcılarınız, push bildirim tokeniniz veya konum bilginiz reklam ağlarına ya da üçüncü kişi pazarlamacılara satılmaz ve aktarılmaz."
  - Öneri: §5.2 C2, §6 K1.
- Satır 9773 · `Q2`
  - Mevcut: "QR kod okuma için verdiğiniz kamera izni yalnızca okuma anında kullanılır; görüntü kaydedilmez, saklanmaz ve pazarlama amacıyla işlenmez."
  - Öneri: §7.3-7.4 Q2.

</details>

<details>
<summary><b>Kullanım Şartları</b> (<code>kullanim-sartlari</code>) - 68 cümle</summary>

Kod dağılımı: D2 22, D1 17, D3 10, D9 9, T1 7, D4 6, Q2 5, D6 4, D7 4, Ö1 4, D5 3, K1 3, Q1 3, Q4 2, V2 2, Ö10 2, Ö2 2, Ö3 2, C1 1, C2 1, D8 1, V1 1, Ö4 1, Ö5 1, Ö6 1, Ö9 1


**(belge başı)**

- Satır 9862 · `T1`
  - Mevcut: "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İYS [U+2014] İleti Yönetim Sistemi)"
  - Önerilen: "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İYS - İleti Yönetim Sistemi)"

**1. Taraflar, Belgenin Konusu ve Kapsamı**

- Satır 9887 · `D9`
  - Mevcut: "Siteyi veya mobil uygulamayı herhangi bir amaçla ziyaret eden, indiren, kuran, bunlarda gezinen, üyelik hesabı oluşturan, bültene kaydolan, rezervasyon talebi ileten, ödül puan programına katılan, yorum veya değerlendirme paylaşan ya da online mağaza (bottega) üzerinden sipariş veren her gerçek veya tüzel kişi (bundan sonra "Kullanıcı" veya "Siz") işbu Şartların tarafı sayılır ve burada düzenlenen hükümlerle bağlı olur."
  - Öneri: §4.4 D9.
- Satır 9888 · `D9`
  - Mevcut: "İşbu Şartlar; Gizlilik ve Kişisel Verilerin Korunması Politikası, Çerez Politikası, Ön Bilgilendirme Formu, Mesafeli Satış Sözleşmesi, İptal ve İade Koşulları, Teslimat ve Kargo Koşulları, Mobil Uygulama Kullanım Koşulları (/hukuk/mobil-uygulama-kosullari) ve Ödül ve Puan Programı Kuralları (/hukuk/odul-programi) ile sitede yayımlanan diğer politika metinleriyle bir bütün oluşturur."
  - Öneri: §4.4 D9.

**2. Tanımlar**

- Satır 9910 · `D5` `D2`
  - Mevcut: "Ödül Programı: Üyelerin alışveriş ve kafe ziyaretleri karşılığında puan kazandığı ve kazanılan puanı indirim olarak kullanabildiği sadakat programı."
  - Öneri: §4.4 D5, §4.4 D2.
- Satır 9911 · `D5` `D2`
  - Mevcut: "Puan: Ödül Programı kapsamında Üye hesabına tanımlanan, para birimi ya da elektronik para niteliği taşımayan, nakde çevrilemeyen ve yalnızca Platform üzerinden indirim olarak kullanılabilen sayısal değer."
  - Öneri: §4.4 D5, §4.4 D2.
- Satır 9912 · `D5` `D4` `Q2`
  - Mevcut: "QR Kod: Kafe ziyaretlerinde puan kazanımını sağlamak amacıyla işletmede sunulan ve Mobil Uygulamanın kamera erişimi ile okunan iki boyutlu karekod."
  - Öneri: §4.4 D5, §4.4 D4, §7.3-7.4 Q2.

**3. Şartların Kabulü ve Sözleşmenin Kurulması**

- Satır 9926 · `D9`
  - Mevcut: "Programın ayrıntılı kuralları Ödül ve Puan Programı Kuralları (/hukuk/odul-programi) metninde düzenlenmiştir."
  - Öneri: §4.4 D9.

**4. Hizmetin Kapsamı ve Niteliği**

- Satır 9939 · `D4` `Q1`
  - Mevcut: "Mobil Uygulama: iOS ve Android cihazlar için yayımlanan {{BRAND}} uygulaması üzerinden menü görüntüleme, sipariş verme, üyelik yönetimi, ödül puanı takibi, QR kod ile kafede puan kazanma ve bildirim alma."
  - Öneri: §4.4 D4, §7.4 Q1.
- Satır 9940 · `D2`
  - Mevcut: "Ödül Programı: Alışveriş ve kafe ziyaretleri karşılığında puan kazanma ve kazanılan puanı sonraki alışverişlerde indirim olarak kullanma imkânı."
  - Öneri: §4.4 D2.
- Satır 9940 · `D9`
  - Mevcut: "Puan kazanım oranları, geçerlilik süreleri ve kullanım sınırları Ödül ve Puan Programı Kuralları (/hukuk/odul-programi) metninde düzenlenmiştir."
  - Öneri: §4.4 D9.
- Satır 9942 · `D6`
  - Mevcut: "Üyelik: E-posta doğrulamalı hesap oluşturma, adres defteri yönetimi, sipariş geçmişi görüntüleme, favori ürün listesi oluşturma, puan bakiyesi görüntüleme ve sipariş durumu takibi."
  - Öneri: §4.4 D6.

**5. Mobil Uygulamanın Kullanımı**

- Satır 9961 · `Ö1`
  - Mevcut: "Tüm ödemeler, işbu Şartların 8. maddesinde düzenlendiği şekilde iyzico altyapısı üzerinden gerçekleştirilir."
  - Önerilen: "Tüm ödemeler, işbu Şartların 8. maddesinde düzenlendiği şekilde PayNkolay altyapısı üzerinden gerçekleştirilir."
- Satır 9965 · `T1`
  - Mevcut: "Cihaz izinleri [U+2014] bildirim: Push bildirim gönderimi için bildirim izni istenir."
  - Önerilen: "Cihaz izinleri - bildirim: Push bildirim gönderimi için bildirim izni istenir."
- Satır 9965 · `D9`
  - Mevcut: "İzin verilmemesi hâlinde sipariş durumu ve puan bildirimleri yalnızca uygulama içi ve e-posta yoluyla iletilir."
  - Öneri: §4.4 D9.
- Satır 9966 · `D4` `Q2` `T1`
  - Mevcut: "Cihaz izinleri [U+2014] kamera: Kafede QR kod ile puan kazanımı için kamera erişimi istenir."
  - Öneri: §4.4 D4, §7.3-7.4 Q2, §13 T1. Tire düzeltmesi de uygulanır (T1).
- Satır 9966 · `Q2`
  - Mevcut: "Kamera yalnızca QR okuma anında ve bu amaçla kullanılır; görüntü kaydı yapılmaz."
  - Öneri: §7.3-7.4 Q2.
- Satır 9967 · `K1` `T1`
  - Mevcut: "Cihaz izinleri [U+2014] konum: En yakın şubenin gösterilmesi ve konuma bağlı kampanyalar için yaklaşık konum izni istenebilir."
  - Öneri: §6 K1, §13 T1. Tire düzeltmesi de uygulanır (T1).
- Satır 9967 · `K1`
  - Mevcut: "Konum izni tamamen isteğe bağlıdır ve verilmemesi hâlinde diğer işlevler çalışmaya devam eder."
  - Öneri: §6 K1.
- Satır 9970 · `D6`
  - Mevcut: "Uygulamanın kaldırılması tek başına üyelik hesabını kapatmaz, puan bakiyesini sıfırlamaz ve devam eden siparişlerden doğan hak ve yükümlülükleri sona erdirmez."
  - Öneri: §4.4 D6.

**6. Ödül ve Puan Programı**

- Satır 9975 · `D1` `D9`
  - Mevcut: "6. Ödül ve Puan Programı"
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 9977 · `D1` `D4` `D2` `Q1`
  - Mevcut: "Üyeler; bottega üzerinden yaptıkları alışverişler ve Mobil Uygulama ile okutulan QR kod aracılığıyla gerçekleştirdikleri kafe ziyaretleri karşılığında puan kazanır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §4.4 D2, §7.4 Q1.
- Satır 9978 · `D1` `D9`
  - Mevcut: "Puan; para, elektronik para, ödeme aracı veya menkul kıymet niteliği taşımaz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 9978 · `D1` `D9`
  - Mevcut: "Puan nakde çevrilemez, başka hesaplara devredilemez, satılamaz, hediye edilemez ve üçüncü kişilere aktarılamaz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 9978 · `D1` `D2`
  - Mevcut: "Puanın tek kullanım biçimi, Platform üzerindeki alışverişlerde indirim olarak kullanılmasıdır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 9979 · `D1` `D2`
  - Mevcut: "Puanla ödenen tutar, sipariş özetinde ve faturada indirim olarak gösterilir ve toplam bedelden düşülür."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 9979 · `D1` `D9`
  - Mevcut: "Bir siparişte kullanılabilecek azami puan miktarı ile puanın geçerlilik süresi Ödül ve Puan Programı Kuralları (/hukuk/odul-programi) metninde belirtilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 9980 · `D1` `D2` `D3`
  - Mevcut: "Kısmen veya tamamen puanla ödenen bir siparişin iptali, cayma hakkının kullanılması ya da iadesi hâlinde; kullanılan puan Üye hesabına geri yüklenir, bedelin Türk Lirası olarak ödenen kısmı ise ödemenin yapıldığı yöntem üzerinden iade edilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 9980 · `D1` `D2` `D3`
  - Mevcut: "Puan karşılığı indirimden yararlanılan tutar için ayrıca nakit iade yapılmaz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 9981 · `D1` `D2`
  - Mevcut: "Üyelik hesabının Kullanıcı tarafından kapatılması ya da işbu Şartların ihlali nedeniyle kalıcı olarak kapatılması hâlinde, hesapta biriken puanlar herhangi bir tazminat yükümlülüğü doğurmaksızın sona erer."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 9982 · `D1` `D2`
  - Mevcut: "Programın sonlandırılması hâlinde, Üyelere birikmiş puanlarını kullanmaları için makul bir süre tanınır ve bu husus sitede duyurulur ile kayıtlı e-posta adreslerine bildirilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 9985 · `D1` `D3`
  - Mevcut: "Puan kazanımı yalnızca ödemesi tamamlanmış ve iade edilmemiş siparişler ile fiilen gerçekleşen kafe ziyaretleri için geçerlidir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D3.
- Satır 9986 · `D1` `D2` `D3`
  - Mevcut: "İptal edilen, iade edilen veya ödemesi gerçekleşmeyen siparişlerden kazanılmış puanlar geri alınır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 9987 · `D1` `D4` `Q1`
  - Mevcut: "QR kod ile puan kazanımı, işletmede sunulan güncel karekodun Mobil Uygulama üzerinden okutulmasıyla yapılır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §7.4 Q1.
- Satır 9987 · `Q4`
  - Mevcut: "Karekodun kopyalanması, çoğaltılması, ekran görüntüsünün paylaşılması veya otomasyonla toplu okutulması yasaktır."
  - Öneri: §7.4 Q4.
- Satır 9988 · `D1` `D2` `D7`
  - Mevcut: "Sahte hesap, mükerrer hesap, otomasyon aracı ya da başka bir yolla haksız puan kazanımı tespit edilmesi hâlinde Şirket; ilgili puanları iptal edebilir, hesabı askıya alabilir veya kapatabilir ve uğradığı zararın tazminini talep edebilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D7.
- Satır 9989 · `D1` `D6`
  - Mevcut: "Puan bakiyesi ve puan hareketleri, üyelik hesabı üzerinden ve Mobil Uygulamada görüntülenebilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D6.
- Satır 9990 · `D1` `D2` `D8`
  - Mevcut: "Puan ve harcama geçmişinin kişiselleştirilmiş kampanya sunumu amacıyla analiz edilmesi, ancak açık rızanızın bulunması hâlinde gerçekleştirilir; rıza dilediğiniz zaman geri alınabilir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D8.

**7. Üyelik Hesabı ve Hesap Güvenliği**

- Satır 10002 · `D2` `D7`
  - Mevcut: "Kampanya, promosyon kodu veya ödül puanlarından haksız yarar sağlamak amacıyla mükerrer hesap açılması yasaktır."
  - Öneri: §4.4 D2, §4.4 D7.
- Satır 10004 · `D2`
  - Mevcut: "Üyeliğin sonlandırılması, devam eden siparişlerden doğan hak ve yükümlülükleri ortadan kaldırmaz; hesapta biriken puanlar ise sona erer."
  - Öneri: §4.4 D2.

**8. Sipariş, Fiyatlandırma ve Ödemeye İlişkin Genel Kurallar**

- Satır 10014 · `D2`
  - Mevcut: "Sepette gösterilen ürün, adet, birim fiyat, indirim, kullanılan puan, kargo ve vergi tutarları; ödeme işlemi başlatılmadan önce sunucu tarafında veri tabanındaki güncel kayıtlarla yeniden doğrulanır."
  - Öneri: §4.4 D2.
- Satır 10015 · `Ö2`
  - Mevcut: "Ödeme işlemleri, 6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun kapsamında faaliyet gösteren ve yetkili ödeme kuruluşu olan iyzico altyapısı üzerinden gerçekleştirilir."
  - Öneri: §3.3 Ö2.
- Satır 10015 · `Ö3`
  - Mevcut: "Ödeme adımında Kullanıcı, iyzico tarafından sunulan Checkout Form ekranına yönlendirilir."
  - Öneri: §3.3 Ö3.
- Satır 10016 · `Ö4`
  - Mevcut: "Bu verilere ilişkin PCI-DSS uyum yükümlülüğü iyzico'ya aittir."
  - Öneri: §3.3 Ö4.
- Satır 10017 · `Ö5`
  - Mevcut: "3D Secure doğrulaması iyzico tarafından yürütülür."
  - Öneri: §3.3 Ö5.
- Satır 10017 · `Ö9` `Ö10` `Ö3`
  - Mevcut: "5464 sayılı Banka Kartları ve Kredi Kartları Kanunu kapsamındaki ön provizyon, iptal, iade ve ters ibraz (chargeback) süreçleri; ilgili banka ve iyzico kuralları ile mevzuat çerçevesinde yürütülür."
  - Öneri: §3.3 Ö9, §3.3 Ö10, §3.3 Ö3.
- Satır 10018 · `Ö10`
  - Mevcut: "İade ve kısmi iade işlemleri iyzico arayüzü ve uygulama programlama arayüzü (API) üzerinden başlatılır; bedelin karta yansıma süresi kartı çıkaran bankanın işlem takvimine bağlıdır."
  - Öneri: §3.3 Ö10.
- Satır 10018 · `Ö6`
  - Mevcut: "Ödeme sonuçları iyzico tarafından imzalı bildirim (webhook) ile iletilir; Şirket her bildirimi doğruladıktan sonra işlem durumunu iyzico'ya yeniden sorarak teyit eder ve mükerrer işlemi önleyecek tekillik kontrolünü uygular."
  - Öneri: §3.3 Ö6.
- Satır 10021 · `D2` `D3`
  - Mevcut: "Cayma bildiriminin Şirkete ulaşmasından itibaren on dört (14) gün içinde, tahsil edilen toplam bedel ve varsa tüketiciyi borç altına sokan belgeler, tüketiciye herhangi bir masraf yüklenmeksizin ve ödemenin yapıldığı yöntemle iade edilir; siparişte puan kullanılmışsa kullanılan puan aynı süre içinde hesaba geri yüklenir."
  - Öneri: §4.4 D2, §4.4 D3.
- Satır 10036 · `Ö2`
  - Mevcut: "iyzico (yetkili ödeme kuruluşu)"
  - Öneri: §3.3 Ö2.
- Satır 10039 · `T1`
  - Mevcut: "Kargo [U+2014] 500 TL ve üzeri sipariş"
  - Önerilen: "Kargo - 500 TL ve üzeri sipariş"
- Satır 10043 · `T1`
  - Mevcut: "Kargo [U+2014] 500 TL altı sipariş"
  - Önerilen: "Kargo - 500 TL altı sipariş"
- Satır 10052 · `V2`
  - Mevcut: "Yurtiçi Kargo"
  - Öneri: §9.2 V2.
- Satır 10056 · `V2`
  - Mevcut: "Aras Kargo"
  - Öneri: §9.2 V2.

**9. Platformun Kullanımına İlişkin Yasaklar**

- Satır 10066 · `D2` `D7`
  - Mevcut: "Şirket, yukarıdaki yasakların ihlali hâlinde; ihlali sonlandırmaya yönelik teknik tedbirler almak, ilgili IP adresine erişimi kısıtlamak, hesabı askıya almak veya kapatmak, haksız kazanılmış puanları iptal etmek, uğradığı zararın tazminini talep etmek ve yetkili adli ile idari makamlara başvurmak dâhil olmak üzere tüm kanuni haklarını kullanabilir."
  - Öneri: §4.4 D2, §4.4 D7.
- Satır 10082 · `D4` `D7` `Q4`
  - Mevcut: "Kampanya, promosyon kodu, kupon, hediye çeki ya da ödül puanı mekanizmalarının amacı dışında kullanılması; mükerrer hesap, sahte adres, karekod çoğaltma ya da otomasyon yoluyla haksız yarar sağlanması."
  - Öneri: §4.4 D4, §4.4 D7, §7.4 Q4.

**13. 5651 Sayılı Kanun Kapsamındaki Sıfat ve Barındırma Bilgisi**

- Satır 10150 · `Ö1`
  - Mevcut: "İşlemsel e-posta gönderimi Resend altyapısı, ödeme işlemleri ise iyzico altyapısı üzerinden gerçekleştirilir."
  - Önerilen: "İşlemsel e-posta gönderimi Resend altyapısı, ödeme işlemleri ise PayNkolay altyapısı üzerinden gerçekleştirilir."

**14. Şikâyet, İhbar ve İçerik Kaldırma Bildirimi**

- Satır 10174 · `D3`
  - Mevcut: "Ürün, sipariş, teslimat, iade ve puan süreçlerine ilişkin şikâyetleriniz için {{PHONE}} numaralı telefondan veya {{EMAIL}} adresinden müşteri hizmetlerine ulaşabilirsiniz."
  - Öneri: §4.4 D3.

**15. Hizmet Sürekliliği, Bakım ve Sistem Değişiklikleri**

- Satır 10187 · `D2` `D3`
  - Mevcut: "Sistem kesintisi nedeniyle tamamlanamayan siparişlerde tahsilat gerçekleşmişse, bedel aynı ödeme yöntemi üzerinden iade edilir; kullanılan puan hesaba geri yüklenir."
  - Öneri: §4.4 D2, §4.4 D3.
- Satır 10192 · `Ö1` `V1`
  - Mevcut: "Şirket, teknik altyapı sağlayıcılarını (Vercel barındırma, {{DB_PROVIDER}} PostgreSQL veri tabanı, Resend e-posta ve iyzico ödeme hizmetleri dâhil) önceden bildirimde bulunmaksızın değiştirebilir; bu değişiklik veri güvenliği standartlarını düşürecek biçimde yapılamaz."
  - Öneri: §3.3 Ö1, §9.1 V1 (Supabase eklenir).

**17. Mücbir Sebep**

- Satır 10217 · `D2` `D3`
  - Mevcut: "Fesih hâlinde, ifa edilmemiş edimlere ilişkin olarak tahsil edilmiş bedeller Kullanıcıya iade edilir ve kullanılan puanlar hesaba geri yüklenir."
  - Öneri: §4.4 D2, §4.4 D3.

**20. Uygulanacak Hukuk, Uyuşmazlıkların Çözümü ve Delil Sözleşmesi**

- Satır 10263 · `D6`
  - Mevcut: "6100 sayılı Hukuk Muhakemeleri Kanunu'nun delil sözleşmesine ilişkin hükümleri uyarınca taraflar; Şirketin veri tabanı kayıtlarının, sunucu ve sistem günlüklerinin, sipariş, ödeme ve puan hareketi kayıtlarının, elektronik onay kayıtlarının (IP adresi, tarih-saat, belge sürümü, uygulama sürümü), değiştirilemez olay kaydının (audit log) ve elektronik yazışmaların uyuşmazlık hâlinde delil teşkil edeceğini kabul eder."
  - Öneri: §4.4 D6.

**21. Kişisel Verilerin Korunması ve Ticari Elektronik İletiler**

- Satır 10271 · `C1` `C2` `K1` `Q2`
  - Mevcut: "Mobil Uygulamanın kullanımı kapsamında ayrıca; cihaz tanımlayıcıları (IDFA/AAID), push bildirim tokeni, uygulama sürümü, işletim sistemi ve cihaz modeli bilgisi, çökme (crash) ve hata kayıtları, izin verilmesi hâlinde yaklaşık konum bilgisi ile QR kod okuma sırasında kullanılan kamera erişimine ilişkin veriler işlenebilir."
  - Öneri: §5.2 C1, §5.2 C2, §6 K1, §7.3-7.4 Q2.
- Satır 10271 · `Q2`
  - Mevcut: "Kamera yalnızca karekod okuma anında kullanılır; görüntü kaydedilmez ve saklanmaz."
  - Öneri: §7.3-7.4 Q2.
- Satır 10272 · `D2`
  - Mevcut: "Ödül Programı kapsamında puan bakiyesi, puan kazanım ve kullanım hareketleri ile harcama geçmişi işlenir."
  - Öneri: §4.4 D2.
- Satır 10276 · `D3`
  - Mevcut: "Sipariş onayı, kargo bildirimi, iade süreci ve puan kazanım teyidi gibi işlemsel bildirimler sözleşmenin ifasına ilişkin olduğundan ticari elektronik ileti sayılmaz ve onay kapsamı dışındadır."
  - Öneri: §4.4 D3.

**22. İletişim ve İşletme Bilgileri**

- Satır 10283 · `D2` `D3`
  - Mevcut: "İşbu Şartlara, siparişlerinize, iade ve şikâyet süreçlerinize, ödül puanlarınıza ve kişisel verilerinize ilişkin tüm başvurularınızı aşağıdaki iletişim kanalları üzerinden iletebilirsiniz."
  - Öneri: §4.4 D2, §4.4 D3.
- Satır 10316 · `T1`
  - Mevcut: "{{BRAND}} [U+2014] App Store ve Google Play"
  - Önerilen: "{{BRAND}} - App Store ve Google Play"
- Satır 10356 · `Ö1`
  - Mevcut: "iyzico"
  - Önerilen: "PayNkolay"

</details>

<details>
<summary><b>Üyelik Sözleşmesi</b> (<code>uyelik-sozlesmesi</code>) - 19 cümle</summary>

Kod dağılımı: Q2 3, Ö1 3, V1 2, Ö3 2, Ö4 2, Ö6 2, C2 1, D5 1, Q1 1, Q3 1, T1 1, Ö10 1, Ö2 1, Ö5 1, Ö8 1, Ö9 1


**2. Tanımlar**

- Satır 10536 · `D5`
  - Mevcut: "Puan"
  - Öneri: §4.4 D5.
- Satır 10541 · `Q1`
  - Mevcut: "Karekod (QR)"
  - Öneri: §7.4 Q1.

**8. Ödeme Bilgileri ve Kart Verilerinin Saklanmaması**

- Satır 10651 · `Ö2`
  - Mevcut: "Ödeme işlemleri, 6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun kapsamında faaliyet gösteren ve yetkilendirilmiş ödeme kuruluşu olan iyzico üzerinden yürütülür."
  - Öneri: §3.3 Ö2.
- Satır 10652 · `Ö3`
  - Mevcut: "Ödeme adımı, iyzico'nun Checkout Form ekranında açılır."
  - Öneri: §3.3 Ö3.
- Satır 10652 · `Ö4`
  - Mevcut: "Üye'nin kart numarası, son kullanma tarihi ve güvenlik kodu (CVV) hiçbir aşamada Şirket'in sunucularından geçmez ve Şirket tarafından saklanmaz; bu veriler doğrudan iyzico'nun PCI-DSS uyumlu ortamına iletilir."
  - Öneri: §3.3 Ö4.
- Satır 10652 · `Ö4`
  - Mevcut: "Kart verilerinin güvenliğine ilişkin PCI-DSS yükümlülüğü iyzico'ya aittir."
  - Öneri: §3.3 Ö4.
- Satır 10653 · `Ö5`
  - Mevcut: "Kart hamilinin kimliğinin doğrulanmasına yönelik 3D Secure akışı iyzico tarafından yürütülür."
  - Öneri: §3.3 Ö5.
- Satır 10654 · `Ö10`
  - Mevcut: "İade ve kısmi iade işlemleri iyzico API'si üzerinden gerçekleştirilir."
  - Öneri: §3.3 Ö10.
- Satır 10654 · `Ö9` `Ö8` `Ö3`
  - Mevcut: "Ön provizyon, taksitlendirme ve itiraz (chargeback) süreçleri, 5464 sayılı Banka Kartları ve Kredi Kartları Kanunu ile iyzico'nun kuralları çerçevesinde işletilir."
  - Öneri: §3.3 Ö9, §3.3 Ö8, §3.3 Ö3.
- Satır 10655 · `Ö6`
  - Mevcut: "Ödeme sonucu bildirimleri imzalı webhook ile Şirket sistemlerine iletilir ve sipariş kapatılmadan önce sonuç iyzico'ya yeniden sorularak teyit edilir."
  - Öneri: §3.3 Ö6.

**10. Sadakat (Damga) Programı**

- Satır 10679 · `Q3`
  - Mevcut: "Üye'den bu işlem için karekod okutması istenmez; Uygulama damga kazanmak amacıyla kamera kullanmaz."
  - Öneri: §7.4 Q3 ve §4.5 D-EK2.

**11. Mobil Uygulama**

- Satır 10699 · `Ö1`
  - Mevcut: "Ödeme, işbu Sözleşme'nin sekizinci maddesinde açıklandığı şekilde iyzico üzerinden yapılır."
  - Önerilen: "Ödeme, işbu Sözleşme'nin sekizinci maddesinde açıklandığı şekilde PayNkolay üzerinden yapılır."
- Satır 10705 · `Q2`
  - Mevcut: "Kamera erişimi: Uygulama kamera izni istemez; damga kazanımı için karekod okutulmaz."
  - Öneri: §7.3-7.4 Q2.
- Satır 10707 · `Q2`
  - Mevcut: "Fotoğraf ve dosya erişimi: profil görseli yüklenmesi veya destek talebine belge eklenmesi hâlinde, yalnızca ilgili işlem sırasında kullanılır."
  - Öneri: §7.3-7.4 Q2.

**15. Üyelik Sona Erdiğinde Verilerin Akıbeti**

- Satır 10772 · `C2`
  - Mevcut: "Mobil Uygulama'ya ait push bildirim tokeni ve cihaz eşleşme kaydı hesap kapatıldığında silinir; uygulamanın cihazdan kaldırılması hâlinde token ayrıca geçersiz hâle gelir."
  - Öneri: §5.2 C2.

**17. Kişisel Verilerin Korunması**

- Satır 10799 · `Q2` `T1`
  - Mevcut: "Uygulama; reklam tanımlayıcısı (IDFA/AAID), konum, kamera ve anlık bildirim (push) tokeni işlemez [U+2014] hatırlatmalar cihazda planlanır ve sunucuya bildirilmez."
  - Öneri: §7.3-7.4 Q2, §13 T1. Tire düzeltmesi de uygulanır (T1).
- Satır 10802 · `Ö1` `V1`
  - Mevcut: "Barındırma (Vercel), veri tabanı ({{DB_PROVIDER}} üzerinde çalışan PostgreSQL), işlemsel e-posta (Resend) ve ödeme (iyzico) hizmetleri nedeniyle kişisel verilerin yurt dışında bulunan sunuculara aktarılması söz konusu olabilir."
  - Öneri: §3.3 Ö1, §9.1 V1 (Supabase eklenir).

**20. Hizmetin Sürekliliği, Bakım ve Mücbir Sebep**

- Satır 10843 · `Ö1` `V1`
  - Mevcut: "Barındırma (Vercel), veri tabanı ({{DB_PROVIDER}} üzerinde çalışan PostgreSQL), işlemsel e-posta (Resend) veya ödeme (iyzico) altyapısı sağlayıcılarında meydana gelen ve Şirket'in kontrolü dışında kalan arızalar."
  - Öneri: §3.3 Ö1, §9.1 V1 (Supabase eklenir).

**23. Delil Sözleşmesi**

- Satır 10880 · `Ö6`
  - Mevcut: "iyzico'dan alınan işlem referansları, imzalı bildirim kayıtları ve sonuç sorgulama yanıtları."
  - Öneri: §3.3 Ö6.

</details>

<details>
<summary><b>Hesap Silme ve Üyelik Sonlandırma Prosedürü</b> (<code>hesap-silme</code>) - 3 cümle</summary>

Kod dağılımı: T1 3


**(belge başı)**

- Satır 11004 · `T1`
  - Mevcut: "6698 sayılı Kişisel Verilerin Korunması Kanunu [U+2014] m.7 silme, yok etme ve anonim hâle getirme, m.11 ilgili kişinin hakları"
  - Önerilen: "6698 sayılı Kişisel Verilerin Korunması Kanunu - m.7 silme, yok etme ve anonim hâle getirme, m.11 ilgili kişinin hakları"
- Satır 11008 · `T1`
  - Mevcut: "213 sayılı Vergi Usul Kanunu [U+2014] fatura ve defter kayıtlarının saklanması"
  - Önerilen: "213 sayılı Vergi Usul Kanunu - fatura ve defter kayıtlarının saklanması"
- Satır 11009 · `T1`
  - Mevcut: "6102 sayılı Türk Ticaret Kanunu [U+2014] ticari defterlerin saklanması"
  - Önerilen: "6102 sayılı Türk Ticaret Kanunu - ticari defterlerin saklanması"

</details>

<details>
<summary><b>Sadakat (Damga) Programı Kuralları</b> (<code>odul-programi</code>) - 3 cümle</summary>

Kod dağılımı: E1 1, Q2 1, Q3 1


**7. Kafede Kasada Damga Eklenmesi**

- Satır 11336 · `Q3`
  - Mevcut: "Katılımcı'dan bu işlem için Uygulama üzerinden karekod okutması istenmez."
  - Öneri: §7.4 Q3 ve §4.5 D-EK2.
- Satır 11336 · `Q2`
  - Mevcut: "Uygulama, damga kazanmak amacıyla Katılımcı'nın kamerasına erişmez ve herhangi bir karekod okuyucu içermez; kafede karekod okutularak damga kazanma yöntemi bulunmamaktadır."
  - Öneri: §7.3-7.4 Q2.

**18. Vergi, Fatura ve Bedelin Gösterimi**

- Satır 11452 · `E1`
  - Mevcut: "Şirket, 213 sayılı Vergi Usul Kanunu ve ilgili tebliğler uyarınca her sipariş için elektronik arşiv (e-Arşiv) fatura düzenler; kuponla karşılanan tutar faturada indirim olarak yer alır."
  - Öneri: §11 E1.

</details>

<details>
<summary><b>Mobil Uygulama Kullanım Koşulları</b> (<code>mobil-uygulama-kosullari</code>) - 28 cümle</summary>

Kod dağılımı: Q2 7, T1 6, Ö1 3, D5 2, Q1 2, Ö2 2, Ö6 2, D2 1, V1 1, Ö10 1, Ö3 1, Ö4 1, Ö5 1, Ö8 1


**2. Tanımlar**

- Satır 11659 · `D5`
  - Mevcut: "Ödül Puanı"
  - Öneri: §4.4 D5.
- Satır 11664 · `Q1`
  - Mevcut: "QR Kod"
  - Öneri: §7.4 Q1.
- Satır 11666 · `D5` `Q2`
  - Mevcut: "Kafede sunulan, Uygulama'nın kamerası ile okutularak ziyarete bağlı Ödül Puanı kazanılmasını sağlayan iki boyutlu kod"
  - Öneri: §4.4 D5, §7.3-7.4 Q2.
- Satır 11686 · `Ö2`
  - Mevcut: "6493 sayılı Kanun kapsamında yetkilendirilmiş ödeme kuruluşu olan iyzico"
  - Öneri: §3.3 Ö2.

**7. Uygulama Mağazası Koşulları**

- Satır 11768 · `Ö1`
  - Mevcut: "Ödemeler, işbu Koşullar'ın on ikinci maddesinde açıklandığı üzere iyzico altyapısı üzerinden alınır."
  - Önerilen: "Ödemeler, işbu Koşullar'ın on ikinci maddesinde açıklandığı üzere PayNkolay altyapısı üzerinden alınır."

**9. Cihaz İzinleri ve Amaçları**

- Satır 11794 · `Q2`
  - Mevcut: "Talep edilen tek izin bildirim iznidir; izin verilmemesi hâlinde yalnızca hatırlatmalar gösterilmez, Uygulama'nın diğer bölümleri çalışmaya devam eder."
  - Öneri: §7.3-7.4 Q2.
- Satır 11795 · `Q2`
  - Mevcut: "Uygulama; kamera, konum, mikrofon, rehber, fotoğraf ve dosya izni istemez ve cihazın reklam tanımlayıcısına (iOS için IDFA, Android için AAID) erişmez."
  - Öneri: §7.3-7.4 Q2.
- Satır 11806 · `Q2`
  - Mevcut: "Kamera erişimi"
  - Öneri: §7.3-7.4 Q2.
- Satır 11807 · `Q1` `T1`
  - Mevcut: "İstenmez [U+2014] Uygulama'da karekod okuyucu bulunmaz"
  - Öneri: §7.4 Q1, §13 T1. Tire düzeltmesi de uygulanır (T1).
- Satır 11812 · `T1`
  - Mevcut: "İstenmez [U+2014] tek şube bulunduğundan konuma bağlı bir işlev yoktur"
  - Önerilen: "İstenmez - tek şube bulunduğundan konuma bağlı bir işlev yoktur"
- Satır 11815 · `Q2`
  - Mevcut: "Fotoğraf ve dosya erişimi"
  - Öneri: §7.3-7.4 Q2.
- Satır 11816 · `T1`
  - Mevcut: "İstenmez [U+2014] Uygulama'ya dosya yüklenmez"
  - Önerilen: "İstenmez - Uygulama'ya dosya yüklenmez"
- Satır 11820 · `T1`
  - Mevcut: "İşlenmez [U+2014] izleme izni istenmez, reklam kiti kullanılmaz"
  - Önerilen: "İşlenmez - izleme izni istenmez, reklam kiti kullanılmaz"
- Satır 11825 · `T1`
  - Mevcut: "İşlenmez [U+2014] Uygulama sunucudan anlık bildirim göndermez, bu nedenle cihaza ait bir gönderim adresi saklanmaz"
  - Önerilen: "İşlenmez - Uygulama sunucudan anlık bildirim göndermez, bu nedenle cihaza ait bir gönderim adresi saklanmaz"
- Satır 11840 · `T1`
  - Mevcut: "Toplanmaz [U+2014] Uygulama'da çökme kaydı gönderen bir bileşen bulunmaz"
  - Önerilen: "Toplanmaz - Uygulama'da çökme kaydı gönderen bir bileşen bulunmaz"

**11. Sadakat (Damga) Programı**

- Satır 11866 · `Q2`
  - Mevcut: "Damga kazanmak için karekod okutulmaz; Uygulama bu amaçla kamera kullanmaz."
  - Öneri: §7.3-7.4 Q2.

**12. Uygulama Üzerinden Sipariş ve Ödeme**

- Satır 11882 · `Ö2`
  - Mevcut: "Ödeme işlemleri, 6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun kapsamında yetkilendirilmiş ödeme kuruluşu olan iyzico üzerinden yürütülür."
  - Öneri: §3.3 Ö2.
- Satır 11882 · `Ö3`
  - Mevcut: "Ödeme adımı, iyzico'nun Checkout Form ekranında açılır."
  - Öneri: §3.3 Ö3.
- Satır 11883 · `Ö4`
  - Mevcut: "Bu veriler doğrudan iyzico'nun PCI-DSS uyumlu ortamına iletilir; kart verilerinin güvenliğine ilişkin PCI-DSS yükümlülüğü iyzico'ya aittir."
  - Öneri: §3.3 Ö4.
- Satır 11884 · `Ö5`
  - Mevcut: "Kart hamilinin kimliğinin doğrulanmasına yönelik 3D Secure akışı iyzico tarafından yürütülür."
  - Öneri: §3.3 Ö5.
- Satır 11884 · `Ö8`
  - Mevcut: "Taksit seçenekleri kartı veren bankaya bağlıdır ve banka ile iyzico tarafından belirlenir; Şirket taksit sayısını ve vade farkını tek başına tayin etmez."
  - Öneri: §3.3 Ö8.
- Satır 11884 · `Ö10`
  - Mevcut: "İade ve kısmi iade işlemleri iyzico'nun uygulama programlama arayüzü üzerinden gerçekleştirilir."
  - Öneri: §3.3 Ö10.
- Satır 11885 · `Ö6`
  - Mevcut: "Ödeme sonucu, iyzico tarafından imzalı bildirim (webhook) ile Şirket sistemlerine iletilir; bildirimin imzası doğrulanır ve işlemin durumu iyzico'ya yeniden sorularak teyit edilir."
  - Öneri: §3.3 Ö6.
- Satır 11889 · `Ö1`
  - Mevcut: "Uygulama, Mağaza'ların uygulama içi satın alma sistemini kullanmaz; ödeme her hâlde iyzico üzerinden alınır."
  - Önerilen: "Uygulama, Mağaza'ların uygulama içi satın alma sistemini kullanmaz; ödeme her hâlde PayNkolay üzerinden alınır."

**16. Üçüncü Taraf SDK'ları, Kütüphaneler ve Altyapı**

- Satır 11926 · `Ö1` `V1`
  - Mevcut: "Uygulama ve arka uç hizmetleri Vercel altyapısında barındırılmakta; veriler {{DB_PROVIDER}} (PostgreSQL) üzerinde tutulmakta; işlemsel e-postalar Resend üzerinden gönderilmekte; ödeme işlemleri iyzico üzerinden yürütülmektedir."
  - Öneri: §3.3 Ö1, §9.1 V1 (Supabase eklenir).

**17. Uygulamanın Kaldırılması ve Hesabın Silinmesi**

- Satır 11943 · `D2`
  - Mevcut: "Hesabın silinmesiyle birlikte kullanılmamış Ödül Puanları sona erer, adres defteri ve tercihler erişime kapatılır, ticari elektronik ileti onayı bulunuyorsa ret kaydı İYS üzerine işlenir."
  - Öneri: §4.4 D2.

**21. Kişisel Verilerin Korunması ve Gizlilik**

- Satır 11987 · `Q2`
  - Mevcut: "Uygulama; reklam tanımlayıcısı (IDFA/AAID), anlık bildirim (push) tokeni, konum, kamera, mikrofon, rehber, fotoğraf ve çökme (crash) kaydı işlemez."
  - Öneri: §7.3-7.4 Q2.

**24. Uygulanacak Hukuk, Uyuşmazlıkların Çözümü ve Delil Sözleşmesi**

- Satır 12025 · `Ö6`
  - Mevcut: "iyzico'dan alınan işlem referansları ile imzalı ödeme sonuç bildirimleri."
  - Öneri: §3.3 Ö6.

</details>

<details>
<summary><b>Fikri Mülkiyet ve Telif Hakları</b> (<code>fikri-mulkiyet</code>) - 14 cümle</summary>

Kod dağılımı: D4 4, D2 3, D9 3, D6 2, D7 2, Q4 2, Q5 2, D5 1, K1 1, Q2 1, V2 1, Ö1 1, Ö2 1, Ö3 1


**1. Amaç, Kapsam ve Taraflar**

- Satır 12137 · `D9`
  - Mevcut: "İşbu Fikri Mülkiyet ve Telif Hakları Politikası (Politika), {{SITE_URL}} adresinde yayımlanan internet sitesi, iOS ve Android platformlarında yayımlanan {{BRAND}} mobil uygulaması, bunlar üzerinden erişilen çevrimiçi mağaza (bottega), kafe menüsü, ödül ve puan programı, e-posta bültenleri, basın materyalleri ve {{HANDLE}} kullanıcı adıyla işletilen sosyal medya hesapları üzerinden yayımlanan içeriklere ilişkin fikri ve sınai mülkiyet haklarının sahipliğini, kullanım koşullarını ve ihlal hâlinde uygulanacak usulü düzenlemek amacıyla hazırlanmıştır."
  - Öneri: §4.4 D9.

**2. Tanımlar**

- Satır 12232 · `D5` `D2`
  - Mevcut: "Alışveriş ve kafe ziyaretlerinden puan kazanılmasını ve kazanılan puanların indirim olarak kullanılmasını sağlayan; adlandırması, kurgusu ve görselleriyle Şirket'e ait olan sadakat programı"
  - Öneri: §4.4 D5, §4.4 D2.

**3. Hak Sahipliği ve Korunan Unsurlar**

- Satır 12259 · `D9`
  - Mevcut: "Yazılım: Site'nin ve Uygulama'nın ön yüz, mobil istemci ve arka yüz kaynak kodu, bileşen kütüphanesi, tasarım token'ları, stil sayfaları, yönetim paneli, sipariş, stok ve ödül puanı akış mantığı ile bunların dokümantasyonu."
  - Öneri: §4.4 D9.
- Satır 12262 · `D4` `Q5`
  - Mevcut: "Ödül ve puan programı unsurları: programın adlandırması, kural kurgusu, seviye ve rozet tasarımları, kafede kullanılan QR kart ve masa görselleri ile program iletişim metinleri."
  - Öneri: §4.4 D4, §7.4 Q5.
- Satır 12263 · `D6`
  - Mevcut: "Veri tabanı: ürün, kategori, menü, kampanya, ödül puanı ve içerik kayıtlarının seçilme, dizilme ve düzenlenme biçimi ile veri tabanının yapısı."
  - Öneri: §4.4 D6.

**6. Yazılım, Kaynak Kodu ve Veri Tabanı Hakları**

- Satır 12305 · `D6`
  - Mevcut: "Site'nin ve Uygulama'nın ürün, kategori, menü, fiyat, stok, ödül puanı ve içerik kayıtlarından oluşan PostgreSQL veri tabanı, Şirket'in esaslı yatırımı sonucu oluşturulmuştur."
  - Öneri: §4.4 D6.

**7. Mobil Uygulama, Uygulama Mağazaları ve Cihaz İçi Kullanım**

- Satır 12314 · `Ö1`
  - Mevcut: "Uygulama içinden verilen siparişlerin ödemesi, mağaza içi satın alma yöntemiyle değil, iyzico altyapısı üzerinden yapılır; iyzico'nun marka, logo ve yazılım hakları kendisine aittir."
  - Önerilen: "Uygulama içinden verilen siparişlerin ödemesi, mağaza içi satın alma yöntemiyle değil, PayNkolay altyapısı üzerinden yapılır; PayNkolay'ın marka, logo ve yazılım hakları kendisine aittir."
- Satır 12315 · `K1` `Q2`
  - Mevcut: "Uygulama'nın kamera (QR okuma), bildirim ve konum gibi cihaz izinlerine erişimi, yalnızca Kullanıcı'nın cihaz ayarlarından verdiği izin çerçevesinde ve ilgili özelliğin sunulması amacıyla gerçekleşir."
  - Öneri: §6 K1, §7.3-7.4 Q2.
- Satır 12316 · `D9`
  - Mevcut: "Uygulama üzerinden sunulan ödül ve puan programı, Şirket'in kendi kurguladığı bir sadakat mekanizmasıdır."
  - Öneri: §4.4 D9.
- Satır 12316 · `D4` `D2` `Q5`
  - Mevcut: "Puanlar bir ödeme aracı ya da para değildir, nakde çevrilemez; programın adlandırması, kuralları, seviye ve rozet tasarımları ile kafede kullanılan QR görselleri işbu Politika kapsamında korunan unsurlardandır."
  - Öneri: §4.4 D4, §4.4 D2, §7.4 Q5.
- Satır 12323 · `D4` `D2` `D7` `Q4`
  - Mevcut: "Ödül ve puan programının otomatik araçlar, öykünücü ortamlar, sahte hesaplar ya da QR kodlarının çoğaltılması yoluyla manipüle edilmesi yasaktır; tespit hâlinde puanlar iptal edilebilir."
  - Öneri: §4.4 D4, §4.4 D2, §4.4 D7, §7.4 Q4.

**10. Yasaklanan Kullanımlar**

- Satır 12376 · `D4` `D7` `Q4`
  - Mevcut: "Ödül ve puan programının otomatik araçlar, sahte hesaplar ya da QR kodlarının çoğaltılması yoluyla manipüle edilmesi ve bu yolla haksız indirim elde edilmesi."
  - Öneri: §4.4 D4, §4.4 D7, §7.4 Q4.

**13. Üçüncü Taraf Hakları, Lisanslı Bileşenler ve Bağlantılar**

- Satır 12436 · `Ö3` `Ö2`
  - Mevcut: "iyzico; 6493 sayılı Kanun kapsamında yetkilendirilmiş ödeme kuruluşu. Ödeme, iyzico Checkout Form üzerinde tamamlanır; kart bilgileri Şirket sunucularından geçmez ve saklanmaz. iyzico'nun marka ve yazılım hakları kendisine aittir"
  - Öneri: §3.3 Ö3, §3.3 Ö2.
- Satır 12451 · `V2`
  - Mevcut: "Yurtiçi Kargo, Aras Kargo ve İstanbul içi motokurye hizmet sağlayıcıları; unvan ve logoları kendilerine aittir"
  - Öneri: §9.2 V2.

</details>

<details>
<summary><b>Şirket ve İletişim Bilgileri</b> (<code>sirket-bilgileri</code>) - 53 cümle</summary>

Kod dağılımı: D9 9, D2 7, F1 6, E1 5, V2 4, Ö3 4, KS1 3, Ö2 3, Ö4 3, C2 2, D3 2, D4 2, K1 2, Q1 2, Q2 2, Ö1 2, Ö10 2, Ö5 2, C3 1, D6 1, Ö6 1, Ö8 1


**1. Amaç, Kapsam ve Yasal Dayanak**

- Satır 12719 · `D9`
  - Mevcut: "Sayfa; {{SITE_URL}} adresinde yayımlanan internet sitesini ve iOS ile Android için yayımlanan {{BRAND}} mobil uygulamasını, bunlar üzerinden erişilen kafe menüsünü ve online mağaza (bottega) üzerinden yapılan fiziksel ürün satışlarını, üyelik, ödül ve puan programı, sipariş süreçlerini, ödeme ve teslimat işleyişini ve bunlarla bağlantılı iletişim kanallarını kapsar."
  - Öneri: §4.4 D9.
- Satır 12720 · `D9`
  - Mevcut: "Burada yer alan bilgiler, sitede yayımlanan diğer hukuki metinlerin ayrılmaz bir parçası olup Ön Bilgilendirme Formu, Mesafeli Satış Sözleşmesi, Üyelik Sözleşmesi, Kullanım Şartları, Mobil Uygulama Kullanım Koşulları, Ödül ve Puan Programı Kuralları, Ödeme Koşulları ve Sanal POS, İptal, İade ve Cayma Hakkı, Teslimat ve Kargo Koşulları, Garanti ve Ayıplı Mal, Çerez Politikası, Gizlilik Politikası, KVKK Aydınlatma Metni ile Kişisel Veri Saklama ve İmha Politikası belgeleriyle birlikte bir bütün oluşturur."
  - Öneri: §4.4 D9.

**3. İşletme Adresi, Kafe Bilgisi ve Çalışma Saatleri**

- Satır 12820 · `KS1`
  - Mevcut: "Kafede sunulan ürünlerin fiyatları yalnızca yerinde satışa ilişkindir; kafe menüsü üzerinden internet aracılığıyla sözleşme kurulmaz, bu nedenle menü kalemleri bakımından mesafeli satış hükümleri uygulanmaz."
  - Öneri: §8.3 KS1.

**4. Faaliyet Konusu ve Sitede Sunulan Hizmetler**

- Satır 12860 · `KS1`
  - Mevcut: "Site ve mobil uygulama üzerinden sunulan hizmetler iki ayrı akıştan oluşur: bilgilendirme amaçlı kafe menüsü ve marka içerikleri ile sözleşme kurulmasına imkân veren online mağaza."
  - Öneri: §8.3 KS1.
- Satır 12860 · `KS1`
  - Mevcut: "Kafe menüsü sayfalarında yer alan fiyatlar yalnızca bilgilendirme amaçlıdır ve mesafeli satış konusu değildir; mesafeli satış yalnızca online mağaza üzerinden verilen siparişler bakımından söz konusudur."
  - Öneri: §8.3 KS1.
- Satır 12861 · `Ö1`
  - Mevcut: "{{BRAND}} mobil uygulaması, App Store ve Google Play üzerinden ücretsiz olarak indirilir; uygulama içi satın alma bulunmaz, ürün bedelleri her hâlükârda ödeme kuruluşu iyzico üzerinden tahsil edilir."
  - Önerilen: "{{BRAND}} mobil uygulaması, App Store ve Google Play üzerinden ücretsiz olarak indirilir; uygulama içi satın alma bulunmaz, ürün bedelleri her hâlükârda ödeme hizmeti sağlayıcısı PayNkolay üzerinden tahsil edilir."
- Satır 12861 · `K1` `Q2`
  - Mevcut: "Uygulamanın bazı işlevleri, cihaz izinlerinin verilmesini gerektirebilir; bildirim, yaklaşık konum ve QR kod okuma için kamera erişimi izinleri kullanıcı tarafından her zaman cihaz ayarlarından verilebilir veya geri alınabilir."
  - Öneri: §6 K1, §7.3-7.4 Q2.
- Satır 12862 · `D4` `D2` `Q1`
  - Mevcut: "Ödül ve puan programı kapsamında üyeler, online mağazadan yaptıkları alışverişlerden ve mobil uygulamadaki QR kodu kafede okutmak suretiyle gerçekleştirdikleri ziyaretlerden puan kazanır ve bu puanları sonraki siparişlerinde indirim olarak kullanabilir."
  - Öneri: §4.4 D4, §4.4 D2, §7.4 Q1.
- Satır 12862 · `D9`
  - Mevcut: "Puan bir ödeme aracı veya para değildir; nakde çevrilemez, devredilemez ve üyeliğe bağlıdır."
  - Öneri: §4.4 D9.
- Satır 12862 · `D2`
  - Mevcut: "Hesabın kapatılması hâlinde birikmiş puanlar sona erer."
  - Öneri: §4.4 D2.
- Satır 12862 · `D9`
  - Mevcut: "Programın işleyişi, kazanım ve kullanım kuralları /hukuk/odul-programi adresindeki Ödül ve Puan Programı Kuralları belgesinde düzenlenmiştir."
  - Öneri: §4.4 D9.
- Satır 12873 · `F1`
  - Mevcut: "Marka hikâyesi, ziyaret bilgileri, basın içerikleri ve franchise başvuru bilgilerinin yayımlanması."
  - Öneri: §10 F1.
- Satır 12875 · `D4` `D6` `Q1`
  - Mevcut: "Mobil uygulamada QR kod okutularak kafe ziyaretinde puan kazanma ve puan bakiyesinin takibi."
  - Öneri: §4.4 D4, §4.4 D6, §7.4 Q1.
- Satır 12876 · `D2`
  - Mevcut: "Ödül ve puan programı: alışveriş ve kafe ziyaretinden puan kazanma ve kazanılan puanları sepette indirim olarak kullanma."
  - Öneri: §4.4 D2.
- Satır 12909 · `D9`
  - Mevcut: "Ödül ve puan programı"
  - Öneri: §4.4 D9.
- Satır 12911 · `D9`
  - Mevcut: "Üyeliğe bağlıdır; puan para değildir, nakde çevrilemez ve devredilemez"
  - Öneri: §4.4 D9.

**6. Barındırma ve Altyapı Sağlayıcıları**

- Satır 12971 · `C2` `C3` `K1` `Q2`
  - Mevcut: "Mobil uygulamada cihaz tanımlayıcısı, bildirim tokeni, uygulama sürümü, işletim sistemi bilgisi ve çökme (crash) kayıtları işlenebilir; yaklaşık konum ile kamera erişimi yalnızca kullanıcı izin verdiği takdirde ve ilgili işlev için kullanılır."
  - Öneri: §5.2 C2, §5.2 C3, §6 K1, §7.3-7.4 Q2.
- Satır 12983 · `D9`
  - Mevcut: "{{DB_PROVIDER}} (PostgreSQL) - üyelik, sipariş, ürün, stok, puan ve olay kaydı verilerinin saklanması; veri tabanına yalnızca sunucu tarafındaki uygulama katmanı erişir"
  - Öneri: §4.4 D9.
- Satır 12998 · `C2`
  - Mevcut: "Apple ve Google tarafından işletilen mobil bildirim servisleri - bildirim tokeni üzerinden iletim"
  - Öneri: §5.2 C2.
- Satır 13003 · `Ö4` `Ö2`
  - Mevcut: "iyzico - 6493 sayılı Kanun kapsamında faaliyet izni bulunan ödeme kuruluşu; kart verisi doğrudan iyzico'nun PCI-DSS uyumlu sistemine iletilir"
  - Öneri: §3.3 Ö4, §3.3 Ö2.
- Satır 13007 · `V2`
  - Mevcut: "Yurtiçi Kargo"
  - Öneri: §9.2 V2.
- Satır 13011 · `V2`
  - Mevcut: "Aras Kargo"
  - Öneri: §9.2 V2.
- Satır 13020 · `E1`
  - Mevcut: "e-Arşiv fatura altyapısı üzerinden yetkili entegratör / mali müşavirlik hizmeti"
  - Öneri: §11 E1.

**7. Ödeme Altyapısı ve Ödeme Bilgileri**

- Satır 13027 · `Ö2`
  - Mevcut: "Ödemeler, 6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun uyarınca faaliyet izni bulunan ödeme kuruluşu iyzico tarafından sağlanan sanal POS altyapısı üzerinden alınır."
  - Öneri: §3.3 Ö2.
- Satır 13027 · `Ö3`
  - Mevcut: "Ödeme adımı, iyzico'nun Checkout Form ekranında açılır ve ödeme bu ekranda tamamlanır."
  - Öneri: §3.3 Ö3.
- Satır 13027 · `Ö4`
  - Mevcut: "Kart numarası, son kullanma tarihi ve CVV gibi kart verileri hiçbir aşamada Şirketin sunucularından geçmez, Şirket tarafından saklanmaz ve Şirket personeli tarafından görüntülenemez; kart verisi doğrudan iyzico'nun sistemine iletilir ve PCI-DSS yükümlülüğü iyzico'ya aittir."
  - Öneri: §3.3 Ö4.
- Satır 13028 · `Ö5` `Ö3`
  - Mevcut: "Kartlı ödemelerde 5464 sayılı Banka Kartları ve Kredi Kartları Kanunu ve ilgili düzenlemeler çerçevesinde 3D Secure doğrulaması uygulanır; doğrulama sürecini iyzico kartı veren banka ile birlikte yürütür."
  - Öneri: §3.3 Ö5, §3.3 Ö3.
- Satır 13029 · `Ö6`
  - Mevcut: "Ödeme sonucu, iyzico tarafından imzalı bildirim (webhook) ile Şirkete iletilir ve bildirimin geçerliliği doğrulandıktan sonra işlemin durumu iyzico'ya yeniden sorularak teyit edilir; sipariş yalnızca bu teyit üzerine ödemesi alınmış sayılır."
  - Öneri: §3.3 Ö6.
- Satır 13029 · `Ö10`
  - Mevcut: "İade ve kısmi iade işlemleri de iyzico'nun uygulama programlama arayüzü (API) üzerinden, ödemenin yapıldığı karta yapılır."
  - Öneri: §3.3 Ö10.
- Satır 13030 · `D2`
  - Mevcut: "Ödül ve puan programı kapsamında kazanılan puanların siparişte kullanılması hâlinde, puana karşılık gelen tutar sipariş bedelinden düşülür ve karttan yalnızca kalan tutar tahsil edilir."
  - Öneri: §4.4 D2.
- Satır 13030 · `D2` `D3`
  - Mevcut: "Siparişin iptali, iadesi veya cayma hakkının kullanılması hâlinde puanla karşılanan kısım puan olarak üye hesabına geri yüklenir, karttan tahsil edilen tutar ise ödemenin yapıldığı kanala iade edilir."
  - Öneri: §4.4 D2, §4.4 D3.
- Satır 13030 · `D9`
  - Mevcut: "Puan hiçbir hâlde nakden ödenmez."
  - Öneri: §4.4 D9.
- Satır 13039 · `Ö8`
  - Mevcut: "Banka kartı ve kredi kartı ile iyzico sanal POS üzerinden tek çekim; banka ve kampanya koşullarına göre taksitli ödeme"
  - Öneri: §3.3 Ö8.
- Satır 13049 · `Ö2`
  - Mevcut: "iyzico - 6493 sayılı Kanun kapsamında faaliyet izni bulunan ödeme kuruluşu"
  - Öneri: §3.3 Ö2.
- Satır 13053 · `Ö3`
  - Mevcut: "Ödeme, iyzico Checkout Form ekranında tamamlanır"
  - Öneri: §3.3 Ö3.
- Satır 13062 · `Ö4`
  - Mevcut: "Şirket tarafından saklanmaz ve Şirketin sunucularından geçmez; iyzico'nun PCI-DSS uyumlu sisteminde işlenir"
  - Öneri: §3.3 Ö4.
- Satır 13090 · `Ö10`
  - Mevcut: "İade ve kısmi iade iyzico API'si üzerinden, ödemenin yapıldığı karta gerçekleştirilir"
  - Öneri: §3.3 Ö10.
- Satır 13093 · `D2`
  - Mevcut: "Puanla ödenen kısım"
  - Öneri: §4.4 D2.
- Satır 13095 · `D2` `D3`
  - Mevcut: "Sipariş bedelinden düşülür; iade hâlinde puan olarak üye hesabına geri yüklenir, nakde çevrilmez"
  - Öneri: §4.4 D2, §4.4 D3.

**8. Teslimat ve Kargo Bilgileri**

- Satır 13113 · `V2`
  - Mevcut: "Yurtiçi Kargo"
  - Öneri: §9.2 V2.
- Satır 13117 · `V2`
  - Mevcut: "Aras Kargo"
  - Öneri: §9.2 V2.

**9. Sözleşmeler, Bilgilendirme Belgeleri ve Belge Sürümleri**

- Satır 13201 · `D9`
  - Mevcut: "Ödül ve Puan Programı Kuralları"
  - Öneri: §4.4 D9.

**11. Müşteri Hizmetleri Kanalları ve Yanıt Süresi Taahhüdü**

- Satır 13356 · `F1`
  - Mevcut: "Basın, iş birliği ve franchise talepleri"
  - Öneri: §10 F1.

**14. Faturalama, e-Arşiv ve Vergisel Bilgiler**

- Satır 13451 · `E1`
  - Mevcut: "Tüm satışlar için 213 sayılı Vergi Usul Kanunu ve ilgili tebliğler uyarınca fatura düzenlenir."
  - Öneri: §11 E1.
- Satır 13451 · `E1`
  - Mevcut: "Bireysel alıcılara e-Arşiv fatura, mükellef alıcılara talep ve kayıt durumuna göre e-Fatura veya e-Arşiv fatura kesilir."
  - Öneri: §11 E1.
- Satır 13451 · `E1`
  - Mevcut: "Fatura, sipariş sırasında bildirdiğiniz kayıtlı e-posta adresine elektronik olarak iletilir; ayrıca üye hesabınızdaki sipariş detayından erişilebilir."
  - Öneri: §11 E1.
- Satır 13475 · `E1`
  - Mevcut: "e-Arşiv fatura (bireysel) / e-Fatura (kayıtlı mükellef alıcılar)"
  - Öneri: §11 E1.

**15. Kurumsal Satış, Franchise ve Basın İletişimi**

- Satır 13493 · `F1`
  - Mevcut: "15. Kurumsal Satış, Franchise ve Basın İletişimi"
  - Öneri: §10 F1.
- Satır 13497 · `F1`
  - Mevcut: "Sitede yayımlanan franchise başvuru bilgileri tanıtım ve ön görüşme amaçlıdır; kendi başına bir icap, franchise verme taahhüdü veya sözleşme öncesi bağlayıcı yükümlülük doğurmaz."
  - Öneri: §10 F1.
- Satır 13501 · `F1`
  - Mevcut: "Şirket, franchise veya bayilik süreci kapsamında hiçbir aşamada başvuru ücreti, dosya bedeli veya ön ödeme talep etmez."
  - Öneri: §10 F1.
- Satır 13513 · `F1`
  - Mevcut: "Franchise başvuruları"
  - Öneri: §10 F1.

**16. Sahte Site, Kimlik Avı ve Güvenlik Açığı Bildirimi**

- Satır 13547 · `Ö5` `Ö3`
  - Mevcut: "Ödeme, yalnızca site ve mobil uygulama içindeki ödeme adımında iyzico Checkout Form ekranında ve bankanın 3D Secure ekranında istenir; harici bir bağlantı üzerinden ödeme talep edilmez."
  - Öneri: §3.3 Ö5, §3.3 Ö3.

**17. Yürürlük, Güncelleme ve Belge Sürümü**

- Satır 13600 · `Ö1`
  - Mevcut: "Ödeme hizmeti iyzico tarafından sağlanmakta olup, ödeme kuruluşunun değişmesi hâlinde yeni kuruluşun ticaret unvanı bu sayfada ve /hukuk/odeme-kosullari adresindeki Ödeme Koşulları ve Sanal POS belgesinde ayrıca duyurulur."
  - Önerilen: "Ödeme hizmeti PayNkolay tarafından sağlanmakta olup, ödeme hizmeti sağlayıcısının değişmesi hâlinde yeni sağlayıcının ticaret unvanı bu sayfada ve /hukuk/odeme-kosullari adresindeki Ödeme Koşulları ve Sanal POS belgesinde ayrıca duyurulur."

</details>

<details>
<summary><b>Şikâyet ve Uyuşmazlık Çözümü</b> (<code>sikayet-ve-uyusmazlik</code>) - 71 cümle</summary>

Kod dağılımı: T1 21, D1 12, D2 11, D3 8, D9 7, Ö10 6, D6 4, Ö1 4, D4 3, D5 3, Q1 3, Ö5 3, E1 2, K1 2, Q2 2, V2 2, Ö3 2, Ö4 2, C1 1, C2 1, Ö12 1, Ö2 1, Ö6 1, Ö8 1, Ö9 1


**(belge başı)**

- Satır 13643 · `T1`
  - Mevcut: "Mesafeli Sözleşmeler Yönetmeliği (Resmî Gazete: 27.11.2014, Sayı: 29188) [U+2014] m.5 ön bilgilendirme yükümlülüğü, m.9 cayma hakkı, m.15 cayma hakkının istisnaları"
  - Önerilen: "Mesafeli Sözleşmeler Yönetmeliği (Resmî Gazete: 27.11.2014, Sayı: 29188) - m.5 ön bilgilendirme yükümlülüğü, m.9 cayma hakkı, m.15 cayma hakkının istisnaları"
- Satır 13646 · `T1`
  - Mevcut: "6100 sayılı Hukuk Muhakemeleri Kanunu [U+2014] m.193 delil sözleşmesi"
  - Önerilen: "6100 sayılı Hukuk Muhakemeleri Kanunu - m.193 delil sözleşmesi"
- Satır 13648 · `T1`
  - Mevcut: "6098 sayılı Türk Borçlar Kanunu [U+2014] m.117 temerrüt"
  - Önerilen: "6098 sayılı Türk Borçlar Kanunu - m.117 temerrüt"
- Satır 13649 · `T1`
  - Mevcut: "6102 sayılı Türk Ticaret Kanunu [U+2014] m.1524 internet sitesi yükümlülüğü"
  - Önerilen: "6102 sayılı Türk Ticaret Kanunu - m.1524 internet sitesi yükümlülüğü"
- Satır 13650 · `T1`
  - Mevcut: "6698 sayılı Kişisel Verilerin Korunması Kanunu [U+2014] m.4 genel ilkeler, m.5 ve m.6 işleme şartları, m.9 yurt dışına aktarım, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliğine ilişkin yükümlülükler"
  - Önerilen: "6698 sayılı Kişisel Verilerin Korunması Kanunu - m.4 genel ilkeler, m.5 ve m.6 işleme şartları, m.9 yurt dışına aktarım, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliğine ilişkin yükümlülükler"
- Satır 13654 · `T1`
  - Mevcut: "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İleti Yönetim Sistemi [U+2014] İYS)"
  - Önerilen: "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İleti Yönetim Sistemi - İYS)"

**1. Belgenin Amacı, Kapsamı ve Tanımlar**

- Satır 13671 · `D9`
  - Mevcut: "Bu belge, {{SITE_URL}} adresinde yayımlanan {{BRAND}} internet sitesi ve online mağazası (bottega) ile iOS ve Android için yayımlanan {{BRAND}} mobil uygulaması üzerinden ürün satın alan, üyelik oluşturan, ödül puanı programına katılan, kafe hizmetlerinden yararlanan veya herhangi bir şekilde bizimle iletişime geçen kişilerin şikâyet, itiraz ve talepleriyle ilgili olarak {{LEGAL_NAME}} tarafından benimsenen usul ve esasları düzenler."
  - Öneri: §4.4 D9.
- Satır 13680 · `D5`
  - Mevcut: "Şikâyet: Ürün, sipariş, teslimat, ödeme, üyelik, ödül puanı, mobil uygulama, iletişim, kişisel veri işleme veya kafe hizmetine ilişkin memnuniyetsizlik, itiraz veya düzeltme talebi içeren her türlü bildirim."
  - Öneri: §4.4 D5.
- Satır 13683 · `D5` `D2`
  - Mevcut: "Ödül Puanı: Alışveriş ve kafe ziyaretlerinden kazanılan, sonraki alışverişlerde indirim olarak kullanılabilen, üyeliğe bağlı ve para niteliği taşımayan puan."
  - Öneri: §4.4 D5, §4.4 D2.
- Satır 13683 · `D5`
  - Mevcut: "Ödül puanı nakde çevrilemez ve devredilemez."
  - Öneri: §4.4 D5.

**3. Şikâyet Kanalları ve Yanıt Süresi Taahhütlerimiz**

- Satır 13782 · `T1`
  - Mevcut: "E-posta [U+2014] {{EMAIL}}"
  - Önerilen: "E-posta - {{EMAIL}}"
- Satır 13787 · `T1`
  - Mevcut: "Telefon [U+2014] {{PHONE}}"
  - Önerilen: "Telefon - {{PHONE}}"
- Satır 13789 · `T1`
  - Mevcut: "Hafta içi 09.00[U+2013]18.00 arası canlı yanıt. Görüşme sırasında çözülemeyen konularda aynı gün kayıt açılır ve referans numarası e-posta ile iletilir."
  - Önerilen: "Hafta içi 09.00-18.00 arası canlı yanıt. Görüşme sırasında çözülemeyen konularda aynı gün kayıt açılır ve referans numarası e-posta ile iletilir."
- Satır 13792 · `T1`
  - Mevcut: "Üye paneli [U+2014] {{SITE_URL}} hesabım / destek bölümü"
  - Önerilen: "Üye paneli - {{SITE_URL}} hesabım / destek bölümü"
- Satır 13802 · `T1`
  - Mevcut: "Mobil uygulama [U+2014] uygulama içi destek ekranı"
  - Önerilen: "Mobil uygulama - uygulama içi destek ekranı"
- Satır 13804 · `D6`
  - Mevcut: "{{BRAND}} mobil uygulamasındaki destek bölümünden anında kayıt ve referans numarası; sipariş, üyelik ve ödül puanı kaydınız talebe otomatik bağlanır, uygulama sürümü ve cihaz bilgisi de kayda eklenir. Hedef ilk dönüş 1 iş günü. Uygulama mağazasına (App Store, Google Play) bırakılan değerlendirmeler şikâyet kanalı değildir; kaydın açılabilmesi için bildiriminizi bu ekrandan veya {{EMAIL}} adresinden iletmeniz gerekir."
  - Öneri: §4.4 D6.
- Satır 13807 · `T1`
  - Mevcut: "Sosyal medya [U+2014] {{IG}}"
  - Önerilen: "Sosyal medya - {{IG}}"
- Satır 13812 · `T1`
  - Mevcut: "Sosyal medya [U+2014] {{TIKTOK}} ve {{YOUTUBE}}"
  - Önerilen: "Sosyal medya - {{TIKTOK}} ve {{YOUTUBE}}"
- Satır 13817 · `T1`
  - Mevcut: "Yazılı başvuru [U+2014] {{ADDRESS}}"
  - Önerilen: "Yazılı başvuru - {{ADDRESS}}"

**4. Şikâyet Başvurusunda Bizden İstenen ve Sizden Beklenen Bilgiler**

- Satır 13852 · `V2`
  - Mevcut: "Kargo takip numarası: Yurtiçi Kargo, Aras Kargo veya İstanbul içi motokurye gönderilerinde teslimat sürecinin izlenebilmesi için."
  - Öneri: §9.2 V2.
- Satır 13853 · `D2`
  - Mevcut: "Ödül puanı kullanıldıysa: Siparişte kullanılan puan tutarı ve puanla ödenen kısım."
  - Öneri: §4.4 D2.
- Satır 13853 · `D2` `D3`
  - Mevcut: "Puanla kısmen ödenen siparişlerde iade hesabı, puan ve TL kısmı ayrı ayrı yapılır."
  - Öneri: §4.4 D2, §4.4 D3.

**6. Şikâyet Türlerine Göre Hedef Çözüm Süreleri**

- Satır 13929 · `Q1`
  - Mevcut: "Mobil uygulama kaynaklı teknik sorunlar (kurulum, güncelleme, bildirim, QR okutma)"
  - Öneri: §7.4 Q1.
- Satır 13934 · `D3`
  - Mevcut: "Ödül puanı kazanımı, kullanımı ve iadeye bağlı puan geri yüklemesi"
  - Öneri: §4.4 D3.
- Satır 13936 · `D6`
  - Mevcut: "Hedef: 2 iş günü içinde puan hareket kaydı incelemesi; haklı bulunması hâlinde puan aynı gün hesabınıza işlenir."
  - Öneri: §4.4 D6.

**7. Eskalasyon Basamakları**

- Satır 13961 · `T1`
  - Mevcut: "Birinci basamak [U+2014] Müşteri Deneyimi ekibi: İlk incelemeyi yapan ekiptir."
  - Önerilen: "Birinci basamak - Müşteri Deneyimi ekibi: İlk incelemeyi yapan ekiptir."
- Satır 13962 · `T1`
  - Mevcut: "İkinci basamak [U+2014] Operasyon sorumlusu: Ürün kalitesi, stok, paketleme ve kargo süreçlerine ilişkin uyuşmazlıklarda devreye girer; tedarikçi ve kargo firması nezdindeki araştırmayı yürütür, standart yetkiyi aşan çözümlere karar verir."
  - Önerilen: "İkinci basamak - Operasyon sorumlusu: Ürün kalitesi, stok, paketleme ve kargo süreçlerine ilişkin uyuşmazlıklarda devreye girer; tedarikçi ve kargo firması nezdindeki araştırmayı yürütür, standart yetkiyi aşan çözümlere karar verir."
- Satır 13963 · `T1`
  - Mevcut: "Üçüncü basamak [U+2014] Şirket yetkilisi: Ödeme uyuşmazlıkları, tutar itirazları, tekrar eden şikâyetler ve maddi sonucu yüksek talepler bu basamakta ele alınır."
  - Önerilen: "Üçüncü basamak - Şirket yetkilisi: Ödeme uyuşmazlıkları, tutar itirazları, tekrar eden şikâyetler ve maddi sonucu yüksek talepler bu basamakta ele alınır."
- Satır 13964 · `T1`
  - Mevcut: "Dördüncü basamak [U+2014] Yazılı nihai yanıt ve yol gösterme: Anlaşma sağlanamazsa, size gerekçeli nihai yanıtımızı, dayandığımız sözleşme ve mevzuat hükümlerini ve başvurabileceğiniz merciler ile başvuru usullerini içeren yazılı bir bildirim gönderilir."
  - Önerilen: "Dördüncü basamak - Yazılı nihai yanıt ve yol gösterme: Anlaşma sağlanamazsa, size gerekçeli nihai yanıtımızı, dayandığımız sözleşme ve mevzuat hükümlerini ve başvurabileceğiniz merciler ile başvuru usullerini içeren yazılı bir bildirim gönderilir."
- Satır 13965 · `T1`
  - Mevcut: "Beşinci basamak [U+2014] Bağımsız merciler: Bu belgenin ilgili bölümlerinde açıklanan tüketici hakem heyeti, tüketici mahkemesi, arabuluculuk, Ticaret Bakanlığı, Kişisel Verileri Koruma Kurulu, banka/ödeme kuruluşu itiraz mekanizmaları ve Türkiye Bankalar Birliği Müşteri Şikayetleri Hakem Heyeti devreye girer."
  - Önerilen: "Beşinci basamak - Bağımsız merciler: Bu belgenin ilgili bölümlerinde açıklanan tüketici hakem heyeti, tüketici mahkemesi, arabuluculuk, Ticaret Bakanlığı, Kişisel Verileri Koruma Kurulu, banka/ödeme kuruluşu itiraz mekanizmaları ve Türkiye Bankalar Birliği Müşteri Şikayetleri Hakem Heyeti devreye girer."

**8. Sunulan Çözüm Seçenekleri**

- Satır 13978 · `D2` `D3`
  - Mevcut: "Ödül puanının geri yüklenmesi: Puanla kısmen veya tamamen ödenen bir siparişin iptali, iadesi veya cayma hakkının kullanılması hâlinde, siparişte kullanılan puan hesabınıza geri yüklenir; bedelin TL olarak ödenen kısmı ödemenin yapıldığı kanala iade edilir."
  - Öneri: §4.4 D2, §4.4 D3.
- Satır 13978 · `D3`
  - Mevcut: "Puan nakde çevrilmez ve puanın geri yüklenmesi TL iadesi yerine geçmez."
  - Öneri: §4.4 D3.

**10. Kargo, Teslimat ve Hasarlı Paket Şikâyetleri**

- Satır 14010 · `V2`
  - Mevcut: "Gönderilerimiz Türkiye geneli için Yurtiçi Kargo, KKTC ve yurt dışı için Aras Kargo, İstanbul içi hızlı teslimatlar için motokurye ile yapılır."
  - Öneri: §9.2 V2.

**11. Ödeme, Kart ve Ücret İtirazına İlişkin Şikâyetler**

- Satır 14026 · `Ö2`
  - Mevcut: "Ödeme işlemleri, 5464 sayılı Banka Kartları ve Kredi Kartları Kanunu ile 6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun kapsamında yetkilendirilmiş ödeme kuruluşu olan iyzico aracılığıyla gerçekleştirilir."
  - Öneri: §3.3 Ö2.
- Satır 14026 · `Ö3`
  - Mevcut: "Ödeme adımında iyzico'nun Checkout Form ekranı açılır; kart numarası, son kullanma tarihi ve CVV/CVC gibi kart verileri hiçbir aşamada {{LEGAL_NAME}} sunucularından geçmez, tarafımızca görülmez ve saklanmaz."
  - Öneri: §3.3 Ö3.
- Satır 14026 · `Ö4` `Ö5`
  - Mevcut: "Kart verisinin güvenliğine ilişkin PCI-DSS yükümlülüğü iyzico'ya aittir; 3D Secure doğrulaması da iyzico tarafından yürütülür."
  - Öneri: §3.3 Ö4, §3.3 Ö5.
- Satır 14027 · `Ö1` `D9`
  - Mevcut: "Sipariş toplamı, sunucu tarafında ürün kaydındaki güncel fiyat, geçerli promosyon kodu, kullandığınız ödül puanı, KDV oranı (%20) ve kargo bedeli (500 TL üzeri ücretsiz, altında 39 TL; İstanbul içi motokurye 89 TL) esas alınarak yeniden hesaplanır ve tahsil edilecek tutar iyzico'ya bu hesap üzerinden bildirilir."
  - Öneri: §3.3 Ö1, §4.4 D9.
- Satır 14028 · `Ö8` `Ö10` `Ö5`
  - Mevcut: "Sipariş, ürün, teslimat, cayma ve iade kararının muhatabı satıcı olarak {{LEGAL_NAME}}'dir; ödeme işleminin teknik olarak gerçekleştirilmesi, 3D Secure doğrulaması, işlem kaydının tutulması ve tarafımızca verilen iade talimatının bankaya iletilmesi ödeme kuruluşu iyzico'nun sorumluluğundadır; kartın limiti, taksitlendirme, provizyon blokesinin çözülmesi, iadenin ekstreye yansıma süresi ve kart hamili itirazı (chargeback) süreci ise kartı veren bankanın işleyişine tabidir."
  - Öneri: §3.3 Ö8, §3.3 Ö10, §3.3 Ö5.
- Satır 14028 · `Ö1`
  - Mevcut: "Hangi aşamada olursa olsun, sizi kurumlar arasında dolaştırmayız: başvurunuzu bize ilettiğinizde iyzico ve kartı veren banka nezdindeki takibi biz yürütür, sonucu size yazılı olarak bildiririz."
  - Önerilen: "Hangi aşamada olursa olsun, sizi kurumlar arasında dolaştırmayız: başvurunuzu bize ilettiğinizde PayNkolay ve kartı veren banka nezdindeki takibi biz yürütür, sonucu size yazılı olarak bildiririz."
- Satır 14029 · `Ö6`
  - Mevcut: "Ödeme sonucu bize iyzico tarafından gönderilen imzalı webhook bildirimiyle ulaşır ve her bildirim, işlemin durumu iyzico'ya yeniden sorularak teyit edilir; aynı bildirimin tekrarı benzersiz işlem referansı sayesinde mükerrer kayıt oluşturmaz."
  - Öneri: §3.3 Ö6.
- Satır 14030 · `Ö9`
  - Mevcut: "Sipariş iptal edilirse veya tahsilata dönüştürülmezse blokenin çözülmesi kartı veren bankanın işleyişine bağlıdır ve tarafımızca hızlandırılamaz; ancak blokenin çözülmesi için gerekli talimatın iyzico üzerinden verildiğine ilişkin kaydı talebiniz hâlinde sizinle paylaşırız."
  - Öneri: §3.3 Ö9.
- Satır 14031 · `Ö5`
  - Mevcut: "Yetkisiz işlem iddialarında ilgili sipariş kaydı, IP adresi, işlem zamanı ve iyzico nezdindeki 3D Secure doğrulama kaydı incelenir; sonuç bankanızla paylaşılmak üzere size yazılı olarak verilir."
  - Öneri: §3.3 Ö5.
- Satır 14034 · `Ö10` `Ö12`
  - Mevcut: "Mükerrer çekim: Aynı sipariş için birden fazla tahsilat tespit edilirse, fazla tahsil edilen tutar için iade talimatı iyzico üzerinden en geç 2 iş günü içinde verilir ve talimat kaydı sizinle paylaşılır."
  - Öneri: §3.3 Ö10, §3.3 Ö12.
- Satır 14036 · `Ö10`
  - Mevcut: "Bu yansıma takvimi bankanızın uygulamasıdır; iade talimatının bizce iyzico üzerinden verildiği tarih kayıtlarımızda görünür."
  - Öneri: §3.3 Ö10.
- Satır 14037 · `Ö10`
  - Mevcut: "Geri ödeme süresi: İade ve kısmi iade işlemleri iyzico üzerinden yapılır."
  - Öneri: §3.3 Ö10.
- Satır 14038 · `Ö1`
  - Mevcut: "Böyle bir itirazda bulunmanız hâlinde, sipariş kaydı, iyzico işlem referansı, teslimat kanıtı ve yazışma geçmişi bankanın talebi üzerine tarafımızca sunulur."
  - Önerilen: "Böyle bir itirazda bulunmanız hâlinde, sipariş kaydı, PayNkolay işlem referansı, teslimat kanıtı ve yazışma geçmişi bankanın talebi üzerine tarafımızca sunulur."
- Satır 14040 · `E1`
  - Mevcut: "Fatura ve belge talepleri: 213 sayılı Vergi Usul Kanunu kapsamında düzenlenen e-arşiv faturanız sipariş sonrası e-posta ile iletilir ve üye panelinizden yeniden indirilebilir."
  - Öneri: §11 E1.
- Satır 14040 · `E1`
  - Mevcut: "Fatura bilgilerindeki hatalar bildirim üzerine mevzuatın izin verdiği usulle düzeltilir."
  - Öneri: §11 E1.
- Satır 14041 · `Ö1`
  - Mevcut: "Ödeme altyapısı: Sanal POS hizmetimiz iyzico üzerinden sağlanır."
  - Önerilen: "Ödeme altyapısı: Sanal POS hizmetimiz PayNkolay üzerinden sağlanır."
- Satır 14042 · `Ö10` `D2` `D3`
  - Mevcut: "Ödül puanı ile kısmen ödenen siparişler: İade hâlinde puanla ödenen kısım puan olarak hesabınıza geri yüklenir, TL olarak ödenen kısım ise iyzico üzerinden ödemenin yapıldığı karta iade edilir."
  - Öneri: §3.3 Ö10, §4.4 D2, §4.4 D3.
- Satır 14042 · `D2`
  - Mevcut: "Puanın TL karşılığının nakit veya havale olarak ödenmesi talep edilemez."
  - Öneri: §4.4 D2.
- Satır 14043 · `Ö10`
  - Mevcut: "Mobil uygulamadan verilen siparişler: Uygulama üzerinden yapılan satın almalarda ödeme, uygulama mağazasının (App Store, Google Play) ödeme sistemi üzerinden değil, iyzico altyapısıyla alınır; bu nedenle ödeme ve iade taleplerinizin muhatabı uygulama mağazası değil, satıcı olarak bizizdir."
  - Öneri: §3.3 Ö10.

**12. Mobil Uygulama ve Ödül Puanı Programına İlişkin Şikâyetler**

- Satır 14048 · `D1` `D9`
  - Mevcut: "12. Mobil Uygulama ve Ödül Puanı Programına İlişkin Şikâyetler"
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 14050 · `D1` `D4` `Q1`
  - Mevcut: "Uygulama üzerinden menüyü görüntüleyebilir, sipariş verebilir, üyeliğinizi yönetebilir, ödül puanınızı takip edebilir, kafede QR okutarak puan kazanabilir ve bildirim alabilirsiniz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §7.4 Q1.
- Satır 14051 · `D1` `D9`
  - Mevcut: "Uygulamayı cihazınızdan dilediğiniz zaman kaldırabilirsiniz; kaldırma, üyeliğinizi ve birikmiş ödül puanınızı kendiliğinden sona erdirmez, üyelik sonlandırma talebiniz için Üyelik Sözleşmesi'ndeki usul uygulanır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 14052 · `D1` `D4` `K1` `Q2`
  - Mevcut: "Uygulama, yalnızca izin verdiğiniz ölçüde cihaz özelliklerine erişir: bildirim gönderimi için bildirim izni, kafede puan kazanmak üzere QR kodu okutmak için kamera izni, size en yakın şubeyi göstermek için yaklaşık konum izni."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §6 K1, §7.3-7.4 Q2.
- Satır 14053 · `D1` `D2`
  - Mevcut: "Ödül puanı programı kapsamında alışverişlerinizden ve kafe ziyaretlerinizden puan kazanır, puanınızı sonraki siparişlerinizde indirim olarak kullanabilirsiniz."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.
- Satır 14053 · `D1` `D9`
  - Mevcut: "Puan bir ödeme aracı veya para değildir; nakde çevrilemez, devredilemez ve üyeliğinize bağlıdır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 14056 · `D1` `D4` `D6` `Q1`
  - Mevcut: "Puanın hesaba işlenmemesi: Alışveriş veya QR okutma sonrası puanın hesabınıza yansımadığı bildirimlerinde sipariş kaydı ile puan hareket kaydı karşılaştırılır; hata bizden kaynaklanıyorsa puan geriye dönük olarak işlenir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D4, §4.4 D6, §7.4 Q1.
- Satır 14057 · `D1` `D2` `D3`
  - Mevcut: "Puanın hatalı harcanması: Onayınız dışında puan kullanıldığı iddialarında hesap erişim kayıtları incelenir; haklı bulunması hâlinde puan geri yüklenir."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 14058 · `D1` `D9`
  - Mevcut: "Puanın sona ermesi: Üyelik hesabınızın kapatılması hâlinde birikmiş puan sona erer ve bedele dönüştürülemez."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 14058 · `D1` `D9`
  - Mevcut: "Puanın geçerlilik süresi öngörülmüşse, süre dolmadan makul bir süre önce uygulama içi bildirim veya e-posta ile hatırlatma yapılır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D9.
- Satır 14059 · `D1` `D2` `D3`
  - Mevcut: "İade hâlinde puan: Puanla kısmen veya tamamen ödenen siparişin iadesinde kullanılan puan hesabınıza geri yüklenir; iade edilen alışverişten kazanılmış puanlar ise geri alınır."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2, §4.4 D3.
- Satır 14060 · `D1` `D2`
  - Mevcut: "Program koşullarının değişmesi: Kazanım oranlarında veya kullanım koşullarında tüketici aleyhine esaslı bir değişiklik yapılırsa, değişiklik yürürlüğe girmeden önce uygulama içinde ve kayıtlı e-posta adresinize bildirilir; değişiklik, önceden kazanılmış puanların kullanımını ortadan kaldıracak şekilde geriye yürütülmez."
  - Öneri: §4.4 D1 (bölüm bütünüyle değişir), §4.4 D2.

**13. Kişisel Verilere İlişkin Başvuru ve Şikâyetler**

- Satır 14078 · `T1`
  - Mevcut: "Barındırma (Vercel), veri tabanı [U+2014] {{DB_PROVIDER}} (PostgreSQL) [U+2014] ve işlemsel e-posta (Resend) hizmetleri ile ödeme işlemlerinin yürütülmesi kapsamında yurt dışına veri aktarımı söz konusu olabilir; bu aktarımlar KVKK m.9 çerçevesinde ve Aydınlatma Metni'nde açıklandığı şekilde yürütülür."
  - Önerilen: "Barındırma (Vercel), veri tabanı - {{DB_PROVIDER}} (PostgreSQL) - ve işlemsel e-posta (Resend) hizmetleri ile ödeme işlemlerinin yürütülmesi kapsamında yurt dışına veri aktarımı söz konusu olabilir; bu aktarımlar KVKK m.9 çerçevesinde ve Aydınlatma Metni'nde açıklandığı şekilde yürütülür."
- Satır 14081 · `C1` `C2` `K1` `Q2`
  - Mevcut: "Mobil uygulamayı kullanmanız hâlinde cihaz tanımlayıcıları (IDFA/AAID), push bildirim tokeni, uygulama sürümü, işletim sistemi bilgisi ve çökme (crash) kayıtları işlenir; yaklaşık konum ve QR okutma için kamera erişimi yalnızca cihaz izni vermeniz hâlinde ve verdiğiniz izinle sınırlı olarak kullanılır."
  - Öneri: §5.2 C1, §5.2 C2, §6 K1, §7.3-7.4 Q2.
- Satır 14082 · `D2`
  - Mevcut: "Ödül puanı programı kapsamında puan kazanım ve kullanım hareketleriniz ile harcama geçmişiniz işlenir; bu veriler üyeliğin ifası ve programın yürütülmesi için kullanılır."
  - Öneri: §4.4 D2.
- Satır 14083 · `Ö4`
  - Mevcut: "Kart verileriniz ödeme kuruluşu iyzico'nun PCI-DSS uyumlu altyapısında işlenir; {{LEGAL_NAME}} kart numarası, son kullanma tarihi ve CVV/CVC bilgisini hiçbir aşamada görmez ve saklamaz."
  - Öneri: §3.3 Ö4.

**14. Ticari Elektronik İleti ve Reklam Şikâyetleri**

- Satır 14089 · `D3` `D6`
  - Mevcut: "Sipariş onayı, kargo bilgilendirmesi, iade bildirimi, şifre sıfırlama, ödül puanı hareketinizin bildirimi gibi işlemsel iletiler ticari elektronik ileti sayılmaz ve onaya bağlı değildir."
  - Öneri: §4.4 D3, §4.4 D6.

**18. Ticaret Bakanlığı ve Diğer İdari Şikâyet Yolları**

- Satır 14152 · `T1`
  - Mevcut: "Ticaret Bakanlığı [U+2014] elektronik ticaret ve ticari elektronik ileti şikâyetleri: 6563 sayılı Kanun ve Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik kapsamındaki yükümlülüklere aykırılık iddiaları için."
  - Önerilen: "Ticaret Bakanlığı - elektronik ticaret ve ticari elektronik ileti şikâyetleri: 6563 sayılı Kanun ve Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik kapsamındaki yükümlülüklere aykırılık iddiaları için."

**20. Yetkili Mahkeme, İcra Daireleri, Uygulanacak Hukuk ve Delil**

- Satır 14175 · `Ö3`
  - Mevcut: "6100 sayılı Hukuk Muhakemeleri Kanunu'nun m.193 hükmü çerçevesinde taraflar, tüketici sıfatını haiz olmayan kişiler bakımından; sipariş kayıtları, ödeme işlem kayıtları, sunucu ve erişim kayıtları (log), e-posta yazışmaları, sözleşme onay kayıtları (onay tarihi, IP adresi, tarayıcı bilgisi, belge sürümü), yönetici olay kayıtları (audit log), mobil uygulama olay ve sürüm kayıtları, ödeme kuruluşu iyzico nezdindeki işlem kayıtları ve kargo takip verilerinin uyuşmazlıkta delil teşkil edeceğini kabul eder."
  - Öneri: §3.3 Ö3.

</details>

<details>
<summary><b>Kafe Hizmet ve Rezervasyon Koşulları</b> (<code>kafe-hizmet-kosullari</code>) - 26 cümle</summary>

Kod dağılımı: T1 10, Q2 3, Ö1 3, Ö17 3, Ö10 2, Ö2 2, D9 1, E1 1, Q3 1, Ö3 1, Ö4 1, Ö5 1, Ö6 1


**(belge başı)**

- Satır 14301 · `T1`
  - Mevcut: "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İYS [U+2014] İleti Yönetim Sistemi)"
  - Önerilen: "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İYS - İleti Yönetim Sistemi)"

**7. Grup Rezervasyonları, Minimum Harcama ve Ön Ödeme**

- Satır 14462 · `Ö17`
  - Mevcut: "Ön ödeme, işletmede nakit veya kart ile ya da çevrim içi olarak iyzico altyapısı üzerinden tahsil edilebilir ve her hâlükârda hizmet bedeline mahsup edilir."
  - Öneri: §3.3 Ö17.

**8. Rezervasyonun İptali ve Değişikliği**

- Satır 14481 · `Ö10` `Ö17`
  - Mevcut: "İşletme kaynaklı sebeplerle (kapasite hatası, teknik arıza, personel yetersizliği, geçici kapanış) rezervasyonun karşılanamaması hâlinde, alınmış tüm ön ödemeler kesintisiz ve en geç on dört (14) gün içinde, ödemenin yapıldığı yöntemle iade edilir; çevrim içi yapılmış ön ödemelerde iade iyzico üzerinden ödemenin yapıldığı karta gerçekleştirilir."
  - Öneri: §3.3 Ö10, §3.3 Ö17.
- Satır 14485 · `T1`
  - Mevcut: "Standart masa rezervasyonu [U+2014] ücretsiz iptal"
  - Önerilen: "Standart masa rezervasyonu - ücretsiz iptal"
- Satır 14489 · `T1`
  - Mevcut: "Grup rezervasyonu [U+2014] ücretsiz iptal"
  - Önerilen: "Grup rezervasyonu - ücretsiz iptal"
- Satır 14493 · `T1`
  - Mevcut: "Özel etkinlik / tasting [U+2014] iptal"
  - Önerilen: "Özel etkinlik / tasting - iptal"

**10. Özel Etkinlik, Tasting Masası ve Atölye Koşulları**

- Satır 14528 · `T1`
  - Mevcut: "Etkinlik iptali [U+2014] 7 gün ve daha önce bildirim"
  - Önerilen: "Etkinlik iptali - 7 gün ve daha önce bildirim"
- Satır 14532 · `T1`
  - Mevcut: "Etkinlik iptali [U+2014] 72 saat ile 7 gün arası bildirim"
  - Önerilen: "Etkinlik iptali - 72 saat ile 7 gün arası bildirim"
- Satır 14536 · `T1`
  - Mevcut: "Etkinlik iptali [U+2014] 72 saatten kısa süre kala bildirim"
  - Önerilen: "Etkinlik iptali - 72 saatten kısa süre kala bildirim"

**12. İşletmede Ödeme Yöntemleri, Fiş ve Fatura**

- Satır 14577 · `Ö2` `Ö17`
  - Mevcut: "Grup rezervasyonu ve özel etkinlikler için talep edilen ön ödemeler ile web sitesi ve mobil uygulama üzerinden yapılan ödemeler, 6493 sayılı Kanun kapsamında yetkilendirilmiş ödeme kuruluşu olan iyzico altyapısı üzerinden tahsil edilir."
  - Öneri: §3.3 Ö2, §3.3 Ö17.
- Satır 14577 · `Ö3`
  - Mevcut: "Ödeme sayfası iyzico'nun Checkout Form ekranında açılır; kart numarası, son kullanma tarihi ve güvenlik kodu (CVV) gibi kart verileri hiçbir aşamada İşletmenin sunucularından geçmez ve İşletme tarafından saklanmaz."
  - Öneri: §3.3 Ö3.
- Satır 14577 · `Ö4` `Ö5`
  - Mevcut: "Kart verilerinin güvenliğine ilişkin PCI-DSS yükümlülüğü iyzico'ya aittir; 3D Secure doğrulaması da iyzico tarafından yürütülür."
  - Öneri: §3.3 Ö4, §3.3 Ö5.
- Satır 14578 · `Ö6`
  - Mevcut: "Çevrim içi ödemelerin sonucu, iyzico tarafından imzalı bildirim (webhook) ile İşletmeye iletilir ve her bildirim iyzico'ya yeniden sorularak teyit edilir; teyit edilmeyen bir bildirim, ödemenin alındığı veya rezervasyonun kesinleştiği anlamına gelmez."
  - Öneri: §3.3 Ö6.
- Satır 14578 · `Ö10`
  - Mevcut: "İade ve kısmi iade işlemleri de iyzico üzerinden, ödemenin yapıldığı karta gerçekleştirilir."
  - Öneri: §3.3 Ö10.
- Satır 14580 · `E1`
  - Mevcut: "Elektronik fatura veya elektronik arşiv fatura düzenlenmesi hâlinde, belge bildirdiğiniz elektronik posta adresine gönderilir."
  - Öneri: §11 E1.
- Satır 14596 · `Ö2`
  - Mevcut: "iyzico (6493 sayılı Kanun kapsamında yetkili ödeme kuruluşu)"
  - Öneri: §3.3 Ö2.
- Satır 14600 · `Ö1`
  - Mevcut: "iyzico üzerinden, ödemenin yapıldığı karta"
  - Önerilen: "PayNkolay üzerinden, ödemenin yapıldığı karta"

**13. Mobil Uygulama, Uygulama Mağazası Koşulları ve Cihaz İzinleri**

- Satır 14624 · `D9`
  - Mevcut: "İşbu Koşulların kafe hizmetine ilişkin hükümleri, uygulama üzerinden yapılan rezervasyon ve puan işlemleri bakımından da uygulanır."
  - Öneri: §4.4 D9.
- Satır 14625 · `Ö1`
  - Mevcut: "Uygulama içinde uygulama mağazası üzerinden satın alma yapılmaz; ödemeler her hâlükârda iyzico altyapısı üzerinden gerçekleştirilir."
  - Önerilen: "Uygulama içinde uygulama mağazası üzerinden satın alma yapılmaz; ödemeler her hâlükârda PayNkolay altyapısı üzerinden gerçekleştirilir."
- Satır 14634 · `Q2`
  - Mevcut: "Uygulama; reklam tanımlayıcısı (IDFA/AAID), anlık bildirim (push) tokeni, konum, kamera ve çökme (crash) kaydı işlemez."
  - Öneri: §7.3-7.4 Q2.
- Satır 14638 · `Q2` `T1`
  - Mevcut: "Kamera izni: istenmez [U+2014] damga kazanmak için karekod okutulmaz."
  - Öneri: §7.3-7.4 Q2, §13 T1. Tire düzeltmesi de uygulanır (T1).
- Satır 14639 · `T1`
  - Mevcut: "Konum izni: istenmez [U+2014] tek şube bulunduğundan konuma bağlı bir işlev yoktur."
  - Önerilen: "Konum izni: istenmez - tek şube bulunduğundan konuma bağlı bir işlev yoktur."
- Satır 14640 · `Q2`
  - Mevcut: "Medya ve dosya izni: sipariş özeti veya fişin cihaza kaydedilmesi."
  - Öneri: §7.3-7.4 Q2.

**14. Sadakat Programı: Damga ve Ücretsiz İçecek Kuponu**

- Satır 14651 · `Q3`
  - Mevcut: "Kafede damga kazanmak için karekod okutmanız gerekmez ve uygulama bu amaçla kameranıza erişmez; damga kasada, personel tarafından üyelik e-posta adresiniz seçilerek eklenir."
  - Öneri: §7.4 Q3 ve §4.5 D-EK2.
- Satır 14664 · `Ö1`
  - Mevcut: "Kuponun karşıladığı tutar hesap tutarından düşülür; kalan tutar nakit, kart veya çevrim içi ödemelerde iyzico altyapısı üzerinden tahsil edilir ve düzenlenen yasal belgede indirim ayrıca gösterilir."
  - Önerilen: "Kuponun karşıladığı tutar hesap tutarından düşülür; kalan tutar nakit, kart veya çevrim içi ödemelerde PayNkolay altyapısı üzerinden tahsil edilir ve düzenlenen yasal belgede indirim ayrıca gösterilir."

**26. Şikâyet, Öneri ve Uyuşmazlıkların Çözümü**

- Satır 14858 · `T1`
  - Mevcut: "{{EMAIL}} veya {{ADDRESS}} [U+2014] 30 gün içinde sonuçlandırılır"
  - Önerilen: "{{EMAIL}} veya {{ADDRESS}} - 30 gün içinde sonuçlandırılır"

</details>

<details>
<summary><b>Gıda Güvenliği ve Alerjen Bilgilendirmesi</b> (<code>gida-guvenligi-ve-alerjen</code>) - 7 cümle</summary>

Kod dağılımı: T1 5, D2 1, V2 1


**(belge başı)**

- Satır 14975 · `T1`
  - Mevcut: "Mesafeli Sözleşmeler Yönetmeliği (RG: 27.11.2014, 29188) [U+2014] özellikle ön bilgilendirmeye ilişkin m.5, cayma hakkına ilişkin m.9 ve cayma hakkı istisnalarına ilişkin m.15"
  - Önerilen: "Mesafeli Sözleşmeler Yönetmeliği (RG: 27.11.2014, 29188) - özellikle ön bilgilendirmeye ilişkin m.5, cayma hakkına ilişkin m.9 ve cayma hakkı istisnalarına ilişkin m.15"
- Satır 14976 · `T1`
  - Mevcut: "6698 sayılı Kişisel Verilerin Korunması Kanunu [U+2014] m.4 genel ilkeler, m.5 ve m.6 işleme şartları, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliği"
  - Önerilen: "6698 sayılı Kişisel Verilerin Korunması Kanunu - m.4 genel ilkeler, m.5 ve m.6 işleme şartları, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliği"
- Satır 14980 · `T1`
  - Mevcut: "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İleti Yönetim Sistemi [U+2014] İYS)"
  - Önerilen: "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İleti Yönetim Sistemi - İYS)"
- Satır 14986 · `T1`
  - Mevcut: "6100 sayılı Hukuk Muhakemeleri Kanunu [U+2014] özellikle delil sözleşmesine ilişkin m.193"
  - Önerilen: "6100 sayılı Hukuk Muhakemeleri Kanunu - özellikle delil sözleşmesine ilişkin m.193"

**4. Tedarikçi Seçimi, Mal Kabul ve Onaylı Tedarikçi Listesi**

- Satır 15132 · `D2`
  - Mevcut: "Performansın sipariş bazında izlenmesi: sıcaklık uygunsuzluğu, ambalaj hasarı, gecikme ve şikâyet sayısı puanlanır; eşiğin altına düşen tedarikçi askıya alınır."
  - Öneri: §4.4 D2.

**6. Soğuk Zincir, Sıcaklık Yönetimi ve Sevkiyat**

- Satır 15160 · `V2`
  - Mevcut: "Kahve çekirdeği, ekipman, marka ürünleri ve uygun kiler ürünleri ise oda sıcaklığında güvenle taşınabildiğinden Yurtiçi Kargo (Türkiye geneli) veya Aras Kargo (KKTC ve yurt dışı) ile gönderilir."
  - Öneri: §9.2 V2.

**17. Ürün Geri Çağırma ve Geri Toplama Prosedürü**

- Satır 15494 · `T1`
  - Mevcut: "Duyuru kanalı: {{HANDLE}} hesaplarımız üzerinden yapılan duyurular [U+2014] {{IG}}, {{TIKTOK}}, {{YOUTUBE}}."
  - Önerilen: "Duyuru kanalı: {{HANDLE}} hesaplarımız üzerinden yapılan duyurular - {{IG}}, {{TIKTOK}}, {{YOUTUBE}}."

</details>

