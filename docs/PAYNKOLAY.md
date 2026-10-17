# PayNkolay sanal POS - entegrasyon sözleşmesi

Bu belge, iyzico yerine PayNkolay kullanma kararının teknik karşılığıdır.
Amacı, `src/lib/payment/provider.ts` içindeki `PaymentProvider` arayüzünün her
metodunun PayNkolay'da neye karşılık geldiğini **doğrulanmış** kaynaklarla
sabitlemek.

**Belgenin kuralı:** para akışı söz konusu; bu yüzden her madde ya
_doğrulandı_ (kaynak URL'si ile) ya da _**doğrulanamadı**_ olarak işaretli.
Doğrulanamayan hiçbir şey koda "kesin" gibi geçirilmez - canlı/test ortamında
ölçülür, ölçüm sonucu buraya yazılır. Belgenin sonundaki
[Canlı testte ölçülecekler](#12-canlı-testte-ölçülecekler) listesi tam olarak
bu açıkların dökümüdür.

Kullanılan kaynak: PayNkolay resmî entegrasyon dokümantasyonu,
<https://paynkolay.com.tr/entegrasyon/> (Eylül 2026'da okundu). Sayfa
başlıkları aşağıda tek tek anılıyor.

---

## 0. Mimari uyum - neden bu sağlayıcı bizim modelimize oturuyor

> **15 Eki 2026:** bu bölüm `hosted` modu anlatır. Üretimde `direct` mod
> çalışır: kart sitenin kendi sayfasında girilir ve sunucudan
> `/Vpos/v1/Payment`'a bir kez geçer (saklanmadan) - §15. "PAN sunucumuza
> girmez" ve "PCI yüzeyimiz değişmez" cümleleri yalnız `hosted` için doğrudur.

Barındırılan (hosted) form modeli: kart numarası, CVV ve son kullanma tarihi
**PayNkolay'ın kendi sayfasında** girilir. Bizim tarafımızdan gönderilen
alanların arasında kart alanı yoktur.

Bunun sonucu: **PAN hiçbir zaman bizim sunucumuza girmez** - iyzico
soyutlamasında `CheckoutInput.cardUserKey` yorumunda anlatılan aynı duruş
korunur. PCI yüzeyimiz değişmez.

> Uyarı: dokümantasyonda `POST /Vpos/Payment/CardStorageCardRegister` gibi
> `cardNumber` + `cvv` alan **doğrudan** uçlar da var
> ([Kart Saklama](https://paynkolay.com.tr/entegrasyon/14-save-card.php)).
> Bunları **kullanmıyoruz**; kullanmak PAN'ı sunucumuza sokar ve bütün PCI
> muafiyetimizi bitirir. Kart saklama, ödeme formuna `customerKey` geçirerek
> yapılır (bkz. §9).

Uçlar
([Ödeme Entegrasyon Servisleri](https://paynkolay.com.tr/entegrasyon/01-payment-integration-services.php),
[SSS](https://paynkolay.com.tr/entegrasyon/45-faq.php)):

| Ortam  | Ödeme formu action                              |
| ------ | ----------------------------------------------- |
| Test   | `https://paynkolaytest.nkolayislem.com.tr/Vpos` |
| Üretim | `https://paynkolay.nkolayislem.com.tr/Vpos`     |

(`direct` modun kullandığı `/Vpos/v1/Payment` §15'te.) Ortak ödeme sayfasının
formu doğrudan `/Vpos`'a
POST ediliyor.

---

## 1. successUrl / failUrl'e POST edilen alanlar ve yanıt hash'i

**Durum: doğrulandı.** Kaynak:
[Ödeme Sonucu](https://paynkolay.com.tr/entegrasyon/06-payment-result.php) ve
[Hash Yanıtı](https://paynkolay.com.tr/entegrasyon/05-hash-response.php).

### 1.1 Dönen alanlar

Non-3D işlemde `successUrl`/`failUrl` sayfasına form-POST edilenler:

| Alan                    | Açıklama                         | Doküman örneği   |
| ----------------------- | -------------------------------- | ---------------- |
| `RESPONSE_CODE`         | İşlem sonuç kodu                 | `2`              |
| `RESPONSE_DATA`         | Okunabilir sonuç mesajı          | `İşlem Başarılı` |
| `USE_3D`                | 3D kullanıldı mı                 | `false`          |
| `RND`                   | İşleme ait rastgele/zaman değeri | `1630051651137`  |
| `MERCHANT_NO`           | Üye işyeri numarası              | `400000001`      |
| `AUTH_CODE`             | Bankadan gelen provizyon kodu    | `S00586`         |
| `REFERENCE_CODE`        | PayNkolay işlem referansı        | `IKSIRPF102168`  |
| `CLIENT_REFERENCE_CODE` | Bizim gönderdiğimiz referans     | `42794212`       |
| `TIMESTAMP`             | İşlem zaman damgası              | `2021-08-27`     |
| `TRANSACTION_AMOUNT`    | İstekte gönderilen tutar         | `1.00`           |
| `AUTHORIZATION_AMOUNT`  | Fiilen çekilen tutar             | `1.00`           |
| `COMMISION`             | Komisyon tutarı                  | `0.00000000`     |
| `COMMISION_RATE`        | Komisyon oranı                   | `null`           |
| `INSTALLMENT`           | Taksit sayısı                    | `1`              |
| `hashData`              | Eski (v1, SHA-1) yanıt hash'i    | -                |
| `hashDataV2`            | Güncel yanıt hash'i              | -                |

3D işlemde aynı alanlara ek olarak `BANK_RESULT` (banka yanıtı) ve
`ERROR_CODE` (`0` = hata yok) geliyor.

### 1.2 Yanıt hash'i

Alan adı: **`hashDataV2`**. Formül
([Hash Yanıtı](https://paynkolay.com.tr/entegrasyon/05-hash-response.php)):

```
MERCHANT_NO | REFERENCE_CODE | AUTH_CODE | RESPONSE_CODE | USE_3D | RND
             | INSTALLMENT | AUTHORIZATION_AMOUNT | CURRENCY_CODE
             | MERCHANT_SECRET_KEY
```

- Ayraç: boru işareti `|`
- Girdi kodlaması: UTF-8
- Özet: **SHA-512**, **ham** (binary) özet
- Çıktı: ham özetin **Base64**'ü

Yani istek hash'i (§6) ile aynı algoritma, farklı alan listesi. Eski `hashData`
SHA-1'dir ve kullanılmayacaktır.

### 1.3 Başarı ölçütü - en kritik madde

Doküman açıkça yazıyor:

> "İşlem sonucunun successURL sayfasına dönmesi işlemin başarılı olduğu
> anlamına gelmez."

ve

> "İşlem sonucunda size gönderilen Response Hash'i (hashDataV2) mutlaka
> kontrol ediniz."

Dokümanın verdiği başarı testi: `RESPONSE_CODE == 2` **ve** `AUTH_CODE`
dolu - boş, `0` veya `00` değil.

**Bizim kuralımız bundan daha katı olacak.** Dönüş parametreleri müşterinin
tarayıcısından gelir; müşteri onları değiştirebilir. `hashDataV2` doğrulaması
sahteciliği zorlaştırır ama tek başına yeterli saymıyoruz, çünkü:

- `CURRENCY_CODE` hash formülünde var ama **POST edilen alanlar arasında
  yok** (§1.1 tablosuna bak - doküman listelemiyor). Yani hash'i doğrularken
  o alanı biz kendi tarafımızdan dolduruyoruz. Eksik/eşleşmeyen bir alan,
  doğrulamayı "her zaman başarısız" ya da daha kötüsü "gevşek" hale
  getirebilir.
- `RND` doküman örneklerinde epoch-ms (`1630051651137`) olarak dönüyor, oysa
  isteğe tarih-saat dizesi gönderiyoruz (§6). Yani dönen `RND`, gönderdiğimiz
  `rnd` ile **aynı olmayabilir**; hash'e dönen değeri birebir koymak gerekir.

Bu ikisi, hash doğrulamasını tek dayanak yapmayı riskli kılıyor.

> **Karar:** `confirmReturn`, siparişi **yalnızca** sunucudan sunucuya
> yapılan İşlem Doğrulama Servisi sorgusunun (§2) sonucuna göre "ödendi"
> sayar. Dönen parametreler; (a) `clientRefCode` ve `REFERENCE_CODE`'u
> öğrenmek, (b) hash + `RESPONSE_CODE`/`AUTH_CODE` ile ucuz bir ön eleme
> yapmak için kullanılır. Ön eleme geçse bile onay sorgudan gelir.

**Doğrulanamadı:** `CURRENCY_CODE`'un yanıtta gerçekten POST edilip
edilmediği ve dönen `RND`'nin gönderdiğimizle aynı olup olmadığı. İkisi de
canlı testte ölçülecek (§12).

---

## 2. İşlem doğrulama / sorgulama servisi

**Durum: doğrulandı** (üretim ucu dahil, 17 Eki 2026). Kaynak:
[İşlem Doğrulama Servisi](https://paynkolay.com.tr/entegrasyon/10-verification-service.php).

Doküman bu servisin amacını şöyle tarif ediyor: işlemin doğruluğunu ve paranın
gerçekten çekilip çekilmediğini kontrol etmek. Bizim `confirmReturn`'ün
dayanağı budur.

|             |                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------- |
| Uç (test)   | `POST https://paynkolaytest.nkolayislem.com.tr/Vpos/Payment/PaymentList`                            |
| Uç (üretim) | `POST https://paynkolay.nkolayislem.com.tr/Vpos/Payment/PaymentList` - **doğrulandı** (17 Eki 2026) |
| Gövde       | `multipart/form-data`                                                                               |

**Sorun giderme (canlıda ölçüldü, 17 Eki 2026).** Anahtar hatası "kayıt yok"
değildir; kod ikisini de hata sayar (kural 29) ve log satırı bakılacak
değişkenin **adını** yazar, değerini değil (`paymentListKeyRefusal`):

| `RESPONSE_DATA`                                | Bakılacak değişken               |
| ---------------------------------------------- | -------------------------------- |
| `"API : clientId veya token hatalı<clientId>"` | `PAYNKOLAY_SX_LIST` (liste sx'i) |
| `"API : hashData error"`                       | `PAYNKOLAY_MERCHANT_SECRET_KEY`  |

İlki işyerinin kimliğini geri bastığı için POS'un metni bu iki durumda loga
yazılmaz. Anahtar reddi `ERROR_CODE: ""` ve `LIST: null` ile geldi; bu yüzden
kodsuz bir yanıt yalnız metni yoksa ya da "kayıt bulunamadı" diyorsa boş liste
sayılır, başka her metin hatadır (`paymentListRows`).

İstek alanları:

| Alan            | Zorunlu | Biçim / açıklama                                             |
| --------------- | ------- | ------------------------------------------------------------ |
| `sx`            | evet    | **Listeleme sx'i** - satış sx'inden farklı (§7)              |
| `startDate`     | evet    | `DD.MM.YYYY`                                                 |
| `endDate`       | evet    | `DD.MM.YYYY`                                                 |
| `clientRefCode` | hayır   | Bizim referansımız; verilmezse aralıktaki tüm işlemler döner |
| `hashDatav2`    | evet    | Aşağıdaki formül                                             |

Hash:

```
sx | startDate | endDate | clientRefCode | merchantSecretKey
```

SHA-512 → Base64. (Alan adının dokümandaki yazımı `hashDatav2` - küçük `v`.
§11'deki nota bak.)

Yanıt alanları: `RESPONSE_CODE`, `REFERENCE_CODE`, `AUTH_CODE`, `STATUS`,
`TRANSACTION_AMOUNT`, `AUTHORIZATION_AMOUNT`, `CLIENT_REFERENCE_CODE`,
`TRANSACTION_TYPE`, `TRX_DATE`, `INSTALLMENT_COUNT`, `IS_3D`, `CARD_NUMBER`
(maskeli), `CARD_HOLDER_NAME`, `CARD_BANK_CODE`, `CARD_BANK_NAME`, `POS_TYPE`,
`TERMINAL_NAME`, `VALOR_DATE`, `OID`, `COMMISION`, `BANK_RESULT`.

`STATUS` değerleri - **karar bu alandan verilir**, doküman da bunu söylüyor
("işlemlerin başarılı olup olmadığını kontrol etmek için STATUS değerini
doğrulamalısınız"):

| `STATUS`  | Anlamı                                                    |
| --------- | --------------------------------------------------------- |
| `SUCCESS` | Onaylanmış işlem                                          |
| `ERROR`   | Başarısız işlem                                           |
| `NEW`     | Başlatılmış ama bitmemiş - para çekilmemiş, yarıda kalmış |

`TRANSACTION_TYPE`: `sales`, `cancel`, `refund` (dokümanın Türkçe
sürümünde ayrıca `refundp` = kısmi iade geçiyor; bkz. §3).

Kısıt: **bir sorguda en fazla bir aylık veri** çekilebiliyor. Bizim
kullanımımızda sorgu tek bir güne (sipariş tarihi) daraltılacağı için bu bir
engel değil.

Aynı `clientRefCode` ile birden çok işlem varsa hepsi döner - bu yüzden
`clientRefCode`'u sipariş başına **benzersiz** üretmek zorunludur ve dönen
listede `REFERENCE_CODE` ile eşleştirme yapılmalıdır.

### 2.1 Yakın akraba: Raporlama Servisi

[Raporlama Servisi](https://paynkolay.com.tr/entegrasyon/28-reporting-service.php)
neredeyse aynı işi sayfalama ile yapıyor:

- Uç (test): `POST .../Vpos/Payment/PfTransactionReportList`
- Alanlar: `sx`, `startDate`, `endDate`, `clientReferenceCode` (dikkat: **tam
  yazım**, doğrulama servisindeki `clientRefCode` değil), `referenceCode`,
  `pageCount`, `pageSize`, `hashDatav2`
- Hash: `sx | startDate | endDate | clientReferenceCode | referenceCode | merchantSecretKey`
- Yanıt alanları camelCase (`status`, `responseCode`, `authorizationAmount`, …)

Bizim `confirmReturn` için **doğrulama servisi** yeterli. Raporlama servisi,
mutabakat/geçmiş tarama işi çıkarsa kullanılacak yedek.

---

## 3. İptal ve iade servisi

**Durum: kısmen doğrulandı.** Kaynak:
[Ödeme İptal ve İade](https://paynkolay.com.tr/entegrasyon/09-cancel-refund-payment.php).

|             |                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| Uç (test)   | `POST https://paynkolaytest.nkolayislem.com.tr/Vpos/v1/CancelRefundPayment`                                      |
| Uç (üretim) | **doğrulanamadı** - host değişimiyle `https://paynkolay.nkolayislem.com.tr/Vpos/v1/CancelRefundPayment` beklenir |
| Gövde       | `multipart/form-data`                                                                                            |

İstek alanları:

| Alan            | Zorunlu | Biçim / açıklama                                                                          |
| --------------- | ------- | ----------------------------------------------------------------------------------------- |
| `sx`            | evet    | **İptal sx'i** - satış ve listeleme sx'lerinden farklı (§7)                               |
| `referenceCode` | evet    | PayNkolay referansı (`IKSIRPF…`), yanıttan gelen `REFERENCE_CODE`                         |
| `type`          | evet    | `cancel` \| `refund` (\| `refundp`, bkz. aşağı)                                           |
| `amount`        | evet    | İptalde orijinal tutar, iadede iade edilecek tutar; "çekim sırasında gönderilen formatta" |
| `trxDate`       | evet    | Orijinal işlem tarihi, **`yyyy.aa.gg`** (nokta ayraçlı)                                   |
| `hashDatav2`    | evet    | Aşağıdaki formül                                                                          |

Hash:

```
sx | referenceCode | type | amount | trxDate | merchantSecretKey
```

SHA-512 → Base64.

Başarı: yanıtta `responseCode == 2`.

### 3.1 `cancel` ile `refund` farkı

Doküman: **iptal yalnızca aynı gün** yapılan işlemler için; sonraki günler
**iade** kullanılır ve iadede `amount` gönderilmesi gerekir.

> Bu, `refund(providerRef, amountMinor?)` imzasında bir davranış getiriyor:
> sağlayıcı, işlemin tarihine bakıp aynı günse `cancel`, değilse `refund`
> seçmek zorunda. İşlem tarihi (`trxDate`) zaten iade çağrısının **zorunlu**
> alanı; onu ya siparişten ya da doğrulama servisinden (`TRX_DATE`) okuyacağız.
> "Aynı gün" tanımının hangi saat dilimine göre olduğu **doğrulanamadı**;
> Türkiye saati (Europe/Istanbul) varsayılacak ve canlıda ölçülecek.

### 3.2 Kısmi iade

**Durum: doğrulanamadı.**

- Güncel `09-cancel-refund-payment.php` sayfası `type` için yalnızca `cancel`
  ve `refund` sayıyor; "kısmi iade" ifadesi geçmiyor.
- Buna karşılık
  [İşlem Doğrulama Servisi](https://paynkolay.com.tr/entegrasyon/10-verification-service.php)
  sayfası `TRANSACTION_TYPE` değerleri arasında **`refundp` (kısmi iade
  işlemi)** sayıyor; PayNkolay'ın eski doküman setinde de `type=refundp`
  kısmi iade olarak anlatılıyordu.
- `refund` çağrısı zaten bir `amount` alıyor. Bu, `refund`'ın kendisinin
  kısmi tutarı kabul ettiğini **düşündürüyor** ama doküman bunu yazmıyor.

Yani kısmi iadenin `type=refund` + küçük `amount` ile mi, yoksa
`type=refundp` ile mi yapıldığı belirsiz. **Karar:** ilk sürümde `refund()`
yalnızca **tam iade**yi destekler (`amountMinor` verilmezse sipariş tutarı).
Kısmi tutar geldiğinde, davranış canlı testte ölçülene kadar hata fırlatılır -
sessizce yanlış tutar iade etmektense reddetmek doğrudur.

---

## 4. Sunucudan sunucuya bildirim (webhook)

**Durum: doğrulandı - PayNkolay'da webhook YOK.**

Okunan sayfaların hiçbirinde sunucudan sunucuya bildirim, callback, IPN ya da
imzalı olay gönderimi geçmiyor:
[Ödeme Entegrasyon Servisleri](https://paynkolay.com.tr/entegrasyon/01-payment-integration-services.php),
[Ödeme Sonucu](https://paynkolay.com.tr/entegrasyon/06-payment-result.php),
[SSS](https://paynkolay.com.tr/entegrasyon/45-faq.php).
Akışın tamamı, tarayıcının `successUrl` / `failUrl`'e form-POST'u üzerine
kurulu. Doğrulama tarafında sunulan tek sunucu-sunucu mekanizması, **bizim
sorduğumuz** İşlem Doğrulama / Raporlama servisleridir (§2) - yani çekme
(pull), itme (push) değil.

Bunun iki sonucu var:

1. **`verifyWebhook` bu sağlayıcıda anlamsızdır.** İmzalanmış bir olay gelmediği
   için doğrulanacak bir şey yok. `PaymentProvider.verifyWebhook` şu an
   zorunlu bir metot; PayNkolay uygulaması bu metodu çağrıldığında **her zaman
   hata fırlatarak** karşılamalı ("PayNkolay webhook göndermez"). Fail-closed:
   sahte bir isteğin sipariş kapatmasına yol bırakmaz.
   - Alternatif, arayüzü `verifyWebhook?:` yapmak. `confirmReturn` zaten
     opsiyonel; simetri için tercih edilebilir. Bu, `provider.ts` ve
     `mock.ts`'i de ilgilendirdiği için ayrı bir karar - burada not düşülüyor.
2. **Terk edilen ödeme sorunu bize kalıyor.** Müşteri 3D sayfasında ödeyip
   tarayıcıyı `successUrl`'e dönmeden kapatırsa, para çekilmiş ama siparişimiz
   `pending` kalmış olur. Webhook olmadığı için bunu ancak **biz sorarak**
   öğreniriz: `pending` siparişleri periyodik olarak İşlem Doğrulama
   Servisi'nden (§2) `clientRefCode` ile sorgulayan bir mutabakat işi (job)
   gerekiyor. Bu, PayNkolay'a geçişin getirdiği **yeni** bir iş kalemidir;
   iyzico'da webhook bunu kendiliğinden çözüyordu.

---

## 5. `amount` alanının biçimi

**Durum: doğrulandı.** Kaynak:
[Ödeme Entegrasyon Servisleri](https://paynkolay.com.tr/entegrasyon/01-payment-integration-services.php).

Dokümanın ifadesi: "Kuruş ayıracı olarak **. (nokta)** kullanılmalıdır."
Örnek: `1280.10`. Diğer sayfalardaki form örneklerinde `5.00`, `6.00`,
`10.00`, `1.00` geçiyor - yani **daima iki ondalık basamak**.

Ondalık ayracı **nokta**dır, virgül değil. Binlik ayracı **yoktur**
(`1280.10`, `1.280,10` değil).

Hash'e giren değer, forma yazılan değerle **birebir aynı dize** olmak
zorunda: hash ham dize üzerinden hesaplanır, sayı olarak değil. `250.5` ile
`250.50` farklı hash üretir.

> **Kural (bizim taraf):** dönüşüm tek bir yerde yapılır -
> `minorToPaynkolayAmount(amountMinor: number): string`, `(minor / 100)`'ün
> **iki basamağa sabitlenmiş** hali (`toFixed(2)`). Üretilen dize hem
> `amount` alanına hem hash girdisine **aynı değişkenden** geçer; iki ayrı
> yerde formatlanmaz. Bu, CLAUDE.md'deki "para her zaman kuruş integer'dır,
> görüntüleme tek bir yardımcıdan geçer" kuralının ödeme tarafındaki
> karşılığıdır.

Yanıtta `TRANSACTION_AMOUNT` ve `AUTHORIZATION_AMOUNT` aynı biçimde
(`1.00`) dönüyor. Hash'e giren, **`AUTHORIZATION_AMOUNT`**'tır (§1.2) -
yani fiilen çekilen tutar. Bunu tekrar kuruşa çevirirken kayan nokta
kullanılmamalı; dizeyi noktadan bölüp integer aritmetiğiyle çevirmek gerekir.

**Doğrulanamadı:** taksitli işlemde `AUTHORIZATION_AMOUNT`'ın toplam tutar mı
yoksa taksit tutarı mı olduğu. Taksit v1'de kullanılmayacak; kullanılırsa
ölçülecek.

---

## 6. `rnd` biçimi ve zaman dilimi

**Durum: kısmen doğrulandı - çelişkili.**

| Kaynak                                                                                                        | `rnd` için söylediği                                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [01 - Ödeme Entegrasyon Servisleri](https://paynkolay.com.tr/entegrasyon/01-payment-integration-services.php) | "DateTime.Now ile işlem tarihini göndermeniz gerekmektedir", örnek `09-08-2021 15:24:22` (tire ayraçlı) |
| [02 - Örnek Form](https://paynkolay.com.tr/entegrasyon/02-example-form.php)                                   | `dd.mm.yyyy H:mm:ss` (nokta ayraçlı)                                                                    |
| [06 - Ödeme Sonucu](https://paynkolay.com.tr/entegrasyon/06-payment-result.php)                               | Dönen `RND` örnekleri epoch-ms: `1630051651137`, `1645700316156`                                        |

Yani doküman kendi içinde üç ayrı biçim gösteriyor. Çıkarılabilecek sağlam
sonuç: `rnd` **serbest bir dize**dir ve PayNkolay onu yalnızca hash'e girdi
olarak kullanır; biçimi doğrulamaz.

Zaman dilimi hiçbir yerde yazmıyor - **doğrulanamadı**. Türkiye saati
(Europe/Istanbul, UTC+3) varsayılacak.

> **Karar:** `rnd` olarak `dd.MM.yyyy HH:mm:ss` (nokta ayraçlı, `02` örnek
> formuyla aynı) üretilecek, Europe/Istanbul'a göre. Değer **sipariş başına
> bir kez** üretilir, `amount` gibi tek değişkenden hem forma hem hash'e
> geçer.
>
> Dönüşte hash doğrularken **gönderdiğimiz `rnd` değil, dönen `RND` alanı**
> kullanılacak - doküman örnekleri ikisinin farklı olabileceğini gösteriyor.

---

## 7. `sx`, `agentCode`, `merchantSecretKey` - hangisi sır?

**Durum: doğrulandı.** Kaynak:
[SSS](https://paynkolay.com.tr/entegrasyon/45-faq.php),
[Ödeme Entegrasyon Servisleri](https://paynkolay.com.tr/entegrasyon/01-payment-integration-services.php).

SSS'nin ifadesi:

> "Size özel **sx (Token)**, **sx List**, **sx İptal** ve **Merchant Secret
> Key** değerlerinize Paynkolay panelinize giriş yaparak, ilgili üye
> işyerinizi seçerek ulaşabilirsiniz."

Yani **üç ayrı `sx`** var, her servis kendi `sx`'ini ister:

| Değer        | Kullanıldığı yer                                         |
| ------------ | -------------------------------------------------------- |
| `sx` (Token) | Ödeme formu (`/Vpos`)                                    |
| `sx List`    | İşlem Doğrulama (`/Vpos/Payment/PaymentList`), Raporlama |
| `sx İptal`   | İptal/İade (`/Vpos/v1/CancelRefundPayment`)              |

`sx` bir **giriş kodu/token**tır (doküman: "Web Servis için gerekli giriş
kodudur (Token)") ve HTML formunun `hidden` alanı olarak tarayıcıya çıkar -
yani **gizli değildir, gizli kalamaz**. Sahtecilik engeli `sx` değil,
`hashDataV2`dir.

`merchantSecretKey` **hiçbir zaman gönderilmez**; yalnızca hash hesabına girer.
**Tek gerçek sır budur.** CLAUDE.md kuralı 7 gereği ne mobil pakete ne de
tarayıcıya asla girmez; sunucuda `process.env`'de kalır.

`agentCode`: zorunlu değil, "bayi/alt acente üzerinden yapılan işlemler için"
kullanılan kod (örnek `7683323`). Tek şubeli, bayisiz bir işletme olduğumuz
için **gönderilmeyecek**. Gizli bir değer değildir ve hash formülünde yer
almaz.

---

## 8. `use3D` ve 3D akışının dönüş davranışı

**Durum: kısmen doğrulandı.**

`use3D` bir **dize**dir: `"true"` ya da boş
([01](https://paynkolay.com.tr/entegrasyon/01-payment-integration-services.php)).
`"true"` gönderilirse 3D formu gelir; gönderilmezse/boşsa non-3D işlenir
([03](https://paynkolay.com.tr/entegrasyon/03-api-documentation.php): "İşlem,
3D değilse ödeme alınır ve successURL sayfanıza response parametreleri
dönülür").

> **Karar:** `use3D` **her zaman `"true"`**. Türkiye'de kart hamili
> doğrulaması ve ters ibraz (chargeback) sorumluluğunun bankaya geçmesi buna
> bağlı; ayrıca `use3D` yanıt hash'inin girdilerinden biri olduğu için sabit
> tutmak doğrulamayı basitleştirir.

Yanıtta `USE_3D` alanı geri döner ve **hash'e girdiği için** dönen değer
birebir kullanılmalıdır (`"true"` / `"True"` / `true` farkı hash'i bozar).
Dokümanda büyük/küçük harf yazımı örnekte `false`/`true` küçük harf; **canlıda
ölçülecek**.

### 8.1 İki adımlı 3D tuzağı - `AUTOCOMPLETE`

[Ödeme Tamamlama Servisi](https://paynkolay.com.tr/entegrasyon/27-complete-payment.php)
sayfası kritik bir durumu anlatıyor: **`AUTOCOMPLETE` false ise**, 3D
doğrulamasından sonra ödeme **tamamlanmaz**; işlem "INCOMPLETE" durumunda
kalır ve `POST .../Vpos/v1/CompletePayment` (`Sx`, `ReferenceCode`) çağrısıyla
ayrıca kapatılmalıdır.

Bu, §2'deki `STATUS = NEW` ("başlatılmış ama bitmemiş, ödeme alınmamış,
complete payment metodu çağrılmamış") durumuyla birebir örtüşüyor.

**Doğrulanamadı:** `AUTOCOMPLETE`'in nerede ayarlandığı (form alanı mı, üye
işyeri paneli ayarı mı) ve varsayılan değeri. `CompletePayment` çağrısının
hash formülü de dokümanda yok.

> **Karar:** üye işyeri hesabı **tek adımlı (AUTOCOMPLETE = true)** olarak
> açılacak; operatörden PayNkolay panelinde bunu teyit etmesi istenecek. Yine
> de `confirmReturn`, doğrulama servisinden `STATUS = NEW` gördüğünde siparişi
> **ödendi saymaz** - bu, ayar yanlışsa sessizce ücretsiz sipariş üretmenin
> önündeki emniyet kilidi.

---

## 9. Ödeme formuna gönderilen alanların tam listesi

Kaynak:
[01](https://paynkolay.com.tr/entegrasyon/01-payment-integration-services.php),
[02](https://paynkolay.com.tr/entegrasyon/02-example-form.php).

| Alan              | Zorunlu | Bizim değerimiz                                                           |
| ----------------- | ------- | ------------------------------------------------------------------------- |
| `sx`              | evet    | `PAYNKOLAY_SX`                                                            |
| `clientRefCode`   | evet    | Sipariş başına benzersiz; **Türkçe karakter yok**, en fazla 1024 karakter |
| `amount`          | evet    | `minorToPaynkolayAmount(amountMinor)` - §5                                |
| `currencyCode`    | hayır   | `949` (TRY). Gönderilmezse TL varsayılıyor; yine de açıkça gönderilecek   |
| `successUrl`      | evet    | `PAYNKOLAY_SUCCESS_URL`                                                   |
| `failUrl`         | evet    | `PAYNKOLAY_FAIL_URL`                                                      |
| `rnd`             | evet    | §6                                                                        |
| `use3D`           | evet    | `"true"` - §8                                                             |
| `transactionType` | evet    | `SALES` (ön provizyon için `PRESALES`; kullanmıyoruz)                     |
| `cardHolderIP`    | evet    | `CheckoutInput.buyerIp`; IPv4 veya IPv6                                   |
| `customerKey`     | hayır   | `CheckoutInput.cardUserKey` - kart saklama için; yoksa **boş dize**       |
| `agentCode`       | hayır   | Gönderilmiyor - §7                                                        |
| `hashDataV2`      | evet    | §10                                                                       |
| `instalments`     | hayır   | Gönderilmiyor (v1'de taksit yok)                                          |

`clientRefCode` için doküman: "Her işlem için benzersiz olması önerilir".
Bizde bu **öneri değil zorunluluk** - §2'de anlatıldığı gibi doğrulama
sorgusu bu koda göre eşleştirme yapıyor.

### 9.1 `customerKey` ve kart saklama

[Hash İsteği](https://paynkolay.com.tr/entegrasyon/04-hash-request.php)
sayfasının notu: "Kart saklama hizmeti alınmıyorsa CS_CUSTOMER_KEY boş
olacaktır."

Yani `customerKey` kullanılmadığında hash dizesinde o konum **boş kalır** ve
ardışık iki boru işareti (`…|rnd||merchantSecretKey`) oluşur. Konum
atlanmaz - bu, hash'i sessizce bozan klasik hatadır.

**Doğrulanamadı:** alanın form üzerindeki gerçek adı. `01` numaralı sayfanın
parametre tablosunda `customerKey`, `14-save-card.php` sayfasında
`csCustomerKey`, `04-hash-request.php` notunda `CS_CUSTOMER_KEY` geçiyor.
Ayrıca saklanan kartın anahtarının **yanıtta hangi alanla döndüğü** hiçbir
sayfada yazmıyor - yani `ReturnConfirmation.cardUserKey`'i neyden
dolduracağımız belirsiz.

> **Karar:** kart saklama **v1 kapsamı dışında**. `customerKey` boş dize
> gönderilir (hash konumu korunarak), `confirmReturn` `cardUserKey`
> döndürmez. Kart saklama istenirse önce bu üç isim ve dönüş alanı canlıda
> ölçülür.

---

## 10. İstek hash'i (`hashDataV2`)

**Durum: doğrulandı.** Kaynak:
[Hash İsteği](https://paynkolay.com.tr/entegrasyon/04-hash-request.php).

```
sx | clientRefCode | amount | successUrl | failUrl | rnd | customerKey
   | merchantSecretKey
```

- Ayraç `|`, kodlama UTF-8, algoritma **SHA-512**, ham özetin **Base64**'ü.
- Dokümandaki PHP karşılığı:

  ```php
  $hashstr = $sx."|".$clientRefCode."|".$amount."|".$successUrl."|".$failUrl."|".$rnd."|".$customerKey."|".$merchantSecretKey;
  $hash = mb_convert_encoding($hashstr, 'UTF-8');
  $hashedBytes = hash("sha512", $hash, true);
  $HashDatav2 = base64_encode($hashedBytes);
  ```

  Node karşılığı:

  ```ts
  createHash("sha512").update(raw, "utf8").digest("base64");
  ```

  (`digest("hex")` **değil** - Base64 doğrudan ham özetten alınır.)

Diğer servislerin hash formülleri aynı sayfada listeli ve bu belgede ilgili
bölümlerde tekrarlandı (§2, §3).

---

## 11. `PaymentProvider` eşleşme tablosu

| Arayüz üyesi                        | PayNkolay karşılığı                                                                                         | Not                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                              | `"paynkolay"`                                                                                               | -                                                                                                                                                                                                                                                                                                                                                              |
| `createCheckoutSession(input)`      | Doğrudan bir API çağrısı **yok**. `/Vpos`'a POST edilecek form alanları (§9) + `hashDataV2` (§10) üretilir. | Dönen `CheckoutSession`: `providerRef` = ürettiğimiz `clientRefCode`; `redirectUrl` = kendi tarafımızda barındırdığımız, alanları gizli input olarak taşıyıp otomatik submit eden ara sayfa; `expiresAt` = kendi belirlediğimiz süre. **PayNkolay bir oturum kimliği ya da son kullanma zamanı vermiyor** - bu üç alanın üçü de bizim ürettiğimiz değerlerdir. |
| `verifyWebhook(req)`                | **Karşılığı yok.** PayNkolay webhook göndermez (§4).                                                        | Çağrıldığında hata fırlatır (fail-closed). Terk edilen ödemeler için, `pending` siparişleri §2 servisiyle sorgulayan bir mutabakat işi gerekir - webhook'un yerini tutan tek şey odur.                                                                                                                                                                         |
| `refund(providerRef, amountMinor?)` | `POST /Vpos/v1/CancelRefundPayment` (§3)                                                                    | `providerRef` olarak PayNkolay'ın `REFERENCE_CODE`'u gerekir - bizim `clientRefCode`'umuz değil. İşlem aynı günse `type=cancel`, değilse `type=refund`. `trxDate` zorunlu; siparişten ya da §2 sorgusundan okunur. Kısmi iade **v1'de reddedilir** (§3.2).                                                                                                     |
| `confirmReturn(params)`             | Dönüş POST'u ön eleme + `POST /Vpos/Payment/PaymentList` (§2) ile gerçek durum sorgusu                      | `status` yalnızca sorgunun `STATUS === "SUCCESS"` değerinden türetilir. `amountMinor` dönen parametreden değil, **sorgunun** `AUTHORIZATION_AMOUNT`'undan okunur. `NEW` ve `ERROR` → `failed`. `cardUserKey` v1'de doldurulmaz (§9.1).                                                                                                                         |

### 11.1 Uygulamada dikkat edilecek iki ayrıntı

1. **Hash alanının adı servisten servise değişiyor.** Ödeme formunda
   `hashDataV2` (büyük `V`), doğrulama/iptal/iade servislerinde `hashDatav2`
   (küçük `v`) yazılıyor. Sunucunun alan adını büyük/küçük harf duyarlı okuyup
   okumadığı **doğrulanamadı**; her uca dokümandaki yazımıyla gönderilecek.
2. **`refund` için `REFERENCE_CODE` saklanmalı.** Ödeme başarıyla
   kapandığında sipariş kaydına hem `clientRefCode` hem PayNkolay'ın
   `REFERENCE_CODE`'u ve `TRX_DATE`'i yazılmalı; iade bunlar olmadan
   yapılamaz. iyzico'da tek bir `paymentId` yetiyordu, burada üç alan
   gerekiyor. **Yapıldı (23 Eyl 2026):** `REFERENCE_CODE`
   `payment_transactions."providerRef"`'te, `TRX_DATE` `YYYY-MM-DD` olarak
   `payment_transactions."trxDate"`'te duruyor (§14.5).

---

## 12. Canlı testte ölçülecekler

Bu belgede "doğrulanamadı" işaretli her madde, ilk test işleminde ölçülecek ve
sonucu buraya yazılacak:

1. Yanıtta `CURRENCY_CODE` POST ediliyor mu? Edilmiyorsa yanıt hash'ine hangi
   değer giriyor (`949`? boş?) - §1.3
2. Dönen `RND`, gönderdiğimiz `rnd` ile aynı mı, yoksa PayNkolay kendi epoch-ms
   değerini mi üretiyor? - §1.3, §6
3. Yanıtta `USE_3D` hangi yazımla dönüyor (`true` / `True`)? - §8
4. `AUTOCOMPLETE` ayarı hangi değerde; 3D sonrası işlem doğrudan `SUCCESS`
   oluyor mu, yoksa `NEW`'de mi kalıyor? - §8.1
5. Doğrulama ve iptal/iade servislerinin **üretim** uçları - §2, §3
6. Kısmi iade: `type=refund` küçük tutarla mı, `type=refundp` ile mi? - §3.2
7. "Aynı gün" (cancel/refund sınırı) hangi saat dilimine göre? - §3.1
8. Kart saklama alan adı (`customerKey` / `csCustomerKey`) ve saklanan kart
   anahtarının yanıttaki alan adı - §9.1
9. Hash alan adının büyük/küçük harf duyarlılığı - §11.1
10. Başarısız işlemde `failUrl`'e gelen `RESPONSE_CODE` değerleri (doküman
    yalnızca `2` = başarı diyor; hata kodları listesi
    [43-error-codes](https://paynkolay.com.tr/entegrasyon/43-error-codes.php)
    POS hata kodlarını veriyor, servis yanıt kodlarını değil)

### 12.1 Ölçüldü (15 Eki 2026)

Canlı anahtarlar Vercel production'a girildi; para çekmeyen iki ölçüm yapıldı
(canlı `PaymentList` ve sandbox'ta test kartıyla `/Vpos/v1/Payment`):

- **§12/5 (kısmen):** canlı `PaymentList` ucu
  `https://paynkolay.nkolayislem.com.tr/Vpos/Payment/PaymentList`. Anahtarlar
  doğru: doğru sırla "Listelenecek kayıt bulunamadı", yanlış sırla
  "API : hashData error".
- **Yanıt biçimi:** `PaymentList` gövdesi
  `{"id":"","result":{…,"LIST":[…]},"error":null}` - satırlar `result.LIST`
  altında. Kayıt yoksa `LIST: null`, `ERROR_CODE: CORE0305`. Hash hatasında
  `result` bir JSON **dizesi**. Kod eskiden yalnız en üst seviyede dizi
  arıyordu; gerçek bir ödemede satırı bulamayıp ödemeyi reddederdi.
  `unwrapPaynkolayResult` / `paymentListRows` düzeltti; hash hatası artık
  "ödeme yok" değil, hata (kural 29).
- **Üye işyeri numarası sx'in başındaki sayı DEĞİL:** sandbox'ta
  `118591467|…` sx'li işyerinin `MERCHANT_NO`'su `400000273`. Panelden
  "Üye İşyeri No" ayrıca okunmalı. Yanlış girilirse eskiden her dönüş
  reddedilirdi; artık uyarı yazılır, karar sorgudan verilir (§14.4).
- **`/Vpos/v1/Payment` (sandbox):** düz JSON döner; başarıda
  `RESPONSE_CODE: 2`, `RESPONSE_DATA: "Ödeme hazırlık süreci başarılı."` ve
  `BANK_REQUEST_MESSAGE` içinde bankanın 3D formu (QNB simülatörü: göreli
  `action` + `frm.action = 'https://…'; frm.submit()` yapan satır içi betik).
  `rnd` `dd.MM.yyyy HH:mm:ss` kabul edildi; `customerKey` alanı gönderilmeden,
  hash'teki konumu boş bırakılarak çalıştı.

- **Dönüş POST'u (sandbox, API ile başlatılan 3D, 15 Eki 2026) - §12/1-4
  çözüldü:** `CURRENCY_CODE` gönderiliyor ve değeri **`"TRY"`** (949 değil);
  yanıt hash'i `"TRY"` ile birebir tuttu (`verifyPaynkolayReturnHash` gelen
  değeri kullandığı için doğru). `RND` gönderdiğimizden FARKLI, epoch-ms
  (`1792074787037`). `USE_3D` küçük harf `"true"`. `AUTO_COMPLETE: "true"`
  (tek adımlı; `NEW` tuzağı yok). Ek alanlar: `TRAN_ID` (kart saklandıysa
  saklı kartın kimliği), `CARD_BANK_CODE`, `PAYMENT_SYSTEM`,
  `MERCHANT_OID`, `ERROR_CODE: "00"`.

Test kartları
([07-test-cards](https://paynkolay.com.tr/entegrasyon/07-test-cards.php)),
örn. QNB Finansbank Visa `4155650100416111`, 01/2030, CVV `715` (16 Eki 2026'da
sandbox'ta 3D'ye kadar denendi; 3D simülatörü tek kullanımlık kodu sayfada
gösterir). Eski örnek Vakıfbank kartı (`4029400000000001`) güncel listede yok ve
sandbox `1001-` ile reddediyor. Üç `sx` anahtarı (ödeme, liste, iptal) sandbox'ta
birbirinden FARKLIdır: iptal/iade için ödeme `sx`'i kullanılırsa "İptal token
hatalı" döner.

---

## 13. Ortam değişkenleri

Operatörün PayNkolay panelinden alıp (üye işyerini seçerek) dağıtım ortamına
girmesi gerekenler. `src/lib/payment/index.ts` içindeki `required()` deseni
korunacak: eksik değişkenle sağlayıcı **açılmaz**.

| Değişken                        | Sır mı?                   | Kaynak / açıklama                                                                                                                                                                      |
| ------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PAYMENT_PROVIDER`              | hayır                     | `paynkolay`                                                                                                                                                                            |
| `PAYNKOLAY_SX`                  | hayır (forma yazılır)     | Panel → "sx (Token)" - ödeme formu için                                                                                                                                                |
| `PAYNKOLAY_SX_LIST`             | hayır                     | Panel → "sx List" - işlem doğrulama/raporlama için                                                                                                                                     |
| `PAYNKOLAY_SX_CANCEL`           | hayır                     | Panel → "sx İptal" - iptal/iade için                                                                                                                                                   |
| `PAYNKOLAY_MERCHANT_SECRET_KEY` | **EVET - tek gerçek sır** | Panel → "Merchant Secret Key". Yalnızca hash hesabına girer, hiçbir yere gönderilmez. Mobil pakete **asla** girmez.                                                                    |
| `PAYNKOLAY_MERCHANT_NO`         | hayır                     | Yanıt hash'inin ilk alanı; yanıttan da geliyor ama beklenen değerle karşılaştırmak için ayrıca tutulur                                                                                 |
| `PAYNKOLAY_BASE_URL`            | hayır                     | `https://paynkolaytest.nkolayislem.com.tr` / `https://paynkolay.nkolayislem.com.tr`. Test-üretim farkı yalnızca host + anahtarlar olduğu için `NODE_ENV`'e değil bu değişkene bakılır. |
| `PAYNKOLAY_SUCCESS_URL`         | hayır                     | Tam URL; hash'e girdiği için forma yazılanla **birebir aynı dize** olmalı                                                                                                              |
| `PAYNKOLAY_FAIL_URL`            | hayır                     | Aynı kural                                                                                                                                                                             |
| `PAYNKOLAY_CHECKOUT_MODE`       | hayır                     | `direct` (üretim, 15 Eki 2026) ya da `hosted`/boş - §15. Yalnız production'da `direct`; bu değişken olmadan kurulan ortam sessizce `hosted` çalışır.                                   |

Kullanılmayacaklar: `PAYMENT_WEBHOOK_SECRET` (PayNkolay webhook göndermiyor,
§4), `PAYNKOLAY_AGENT_CODE` (bayi yok, §7).

---

## Kaynak listesi

- <https://paynkolay.com.tr/entegrasyon/> - doküman dizini
- <https://paynkolay.com.tr/entegrasyon/01-payment-integration-services.php> - uçlar, form alanları, `amount`/`rnd`/`sx`/`agentCode`
- <https://paynkolay.com.tr/entegrasyon/02-example-form.php> - örnek form ve alan değerleri
- <https://paynkolay.com.tr/entegrasyon/03-api-documentation.php> - non-3D dönüş davranışı, `currencyNumber`
- <https://paynkolay.com.tr/entegrasyon/04-hash-request.php> - istek hash formülleri (tüm servisler)
- <https://paynkolay.com.tr/entegrasyon/05-hash-response.php> - yanıt hash formülü
- <https://paynkolay.com.tr/entegrasyon/06-payment-result.php> - dönüş parametreleri, başarı ölçütü
- <https://paynkolay.com.tr/entegrasyon/07-test-cards.php> - test kartları
- <https://paynkolay.com.tr/entegrasyon/09-cancel-refund-payment.php> - iptal ve iade
- <https://paynkolay.com.tr/entegrasyon/10-verification-service.php> - işlem doğrulama servisi
- <https://paynkolay.com.tr/entegrasyon/14-save-card.php> - kart saklama
- <https://paynkolay.com.tr/entegrasyon/27-complete-payment.php> - iki adımlı 3D tamamlama
- <https://paynkolay.com.tr/entegrasyon/28-reporting-service.php> - raporlama servisi
- <https://paynkolay.com.tr/entegrasyon/43-error-codes.php> - POS hata kodları
- <https://paynkolay.com.tr/entegrasyon/45-faq.php> - sx/secret key nereden alınır, ortam URL'leri

---

## 14. Uygulama - kod nerede, hangi kararlar verildi

Sözleşme `src/lib/payment/paynkolay.ts` içinde uygulandı. Aşağıdakiler
belgenin yazıldığı andan sonra, kodu yazarken verilen kararlardır.

| Dosya                               | İşi                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `src/lib/payment/paynkolay.ts`      | Sağlayıcı, hash'ler, tutar dönüşümü, servis çağrıları                                 |
| `src/app/odeme/paynkolay/route.ts`  | Ödeme sayfası: `direct`'te kart formu + POST, `hosted`'ta kendiliğinden gönderen form |
| `src/lib/payment/paynkolay-card.ts` | Kart doğrulama (Luhn, son kullanma, CVV, ad) - saf                                    |
| `src/lib/payment/paynkolay-page.ts` | Üç sayfanın HTML'i ve her birinin kendi CSP'si                                        |
| `src/lib/payment/index.ts`          | `PAYMENT_PROVIDER=paynkolay` dalı                                                     |
| `tests/payment-paynkolay.test.ts`   | Hash vektörleri, tutar, dönüş teyidi, iade                                            |

### 14.1 Ara sayfa - `redirectUrl` ile form POST arasındaki fark

`CheckoutSession` tek bir `redirectUrl` taşıyor ve mobil uygulama o adresi
`WebBrowser` ile açıyor: uygulama form POST edemez. PayNkolay ise
`/Vpos`'a POST bekliyor. Aradaki farkı **kendi ara sayfamız** kapatıyor:
form alanları base64url'lenip URL'ye konur, sayfa onları gizli input'lara
yazıp POS'a gönderir. Uygulama ve tarayıcı yine tek bir URL görür.

Yük ayrıca **HMAC-SHA256 ile imzalanıyor**. Gerekçesi: alanların çoğu zaten
`hashDataV2` ile korunuyor (tutarı değiştiren müşteriye PayNkolay hash
uyuşmazlığı döner) ama `currencyCode`, `transactionType` ve `use3D` o hash'in
**dışında**. İmza olmasa müşteri `use3D`'yi boşaltıp 3D'siz ödeyebilir ya da
`transactionType`'ı `PRESALES` yapıp tahsilatı askıda bırakabilirdi.

### 14.2 `clientRefCode` = sipariş kimliği

Ayrı bir referans üretilmedi: sipariş kimliği zaten sipariş başına benzersiz
ve ASCII (`ord-0284`). Aynı siparişin birden çok ödeme denemesi olabilir;
doğru satır, tarayıcının getirdiği **`REFERENCE_CODE`** ile eşleştirilerek
seçiliyor (§2). Eşleşen satır yoksa işlem başarısız sayılır - uydurulmuş bir
referans başkasının ödemesini kapatamasın.

Bunun yan faydası: `/odeme/donus` teyit edemediğinde bile müşteriyi kendi
siparişine gönderebiliyor - dönüşteki `CLIENT_REFERENCE_CODE` sipariş
kimliğinin ta kendisi.

**Karaoke rezervasyonu (16 Eki 2026).** Aynı POS ile ödenir; `clientRefCode`
rezervasyon kimliğidir (`krk-00042`) ve ödeme satırları `payment_transactions`'ta
`"orderId" = krk-…` ile durur. Hangisinin sipariş, hangisinin rezervasyon
olduğuna her yerde tek fonksiyon karar verir: `isKaraokeRef`
(`src/lib/mobile/karaoke-ref.ts`, bağımlılıksız; kart yolu da onu kullanır).
`/odeme/donus` POS'un teyit ettiği referansa bakarak dallanır (gönderilen alana
değil), rezervasyonu `applyKaraokePaymentSucceeded` ile işler ve dönüşte hiçbir
şeyi iptal etmez (kural 29). Ödenmemiş rezervasyonu `expireUnpaidReservations`
POS'a sorduktan sonra düşürür; iptal ve iadeler yalnız tam tutardır (§3.2).
Süresi geçmiş ya da iptal edilmiş rezervasyona gelen ödeme ve ikinci tahsilat
kendiliğinden iade edilir. Akışın tamamı `src/lib/mobile/karaoke-payment.ts`.

### 14.3 `successUrl` / `failUrl` - ikisi de `/odeme/donus`

`PAYNKOLAY_FAIL_URL` de `/odeme/donus`'a bakar. Sebep: PayNkolay sonucu iki
adrese de **form-POST** ediyor; `/odeme/app-hata` bir sayfadır ve POST'a 405
döner - ödemesi geçmeyen müşterinin gördüğü son ekran o hata olurdu.
`confirmReturn` başarısız işlemi de sonuçlandırıp müşteriyi doğru yere
(uygulamaya ya da `/odeme?durum=basarisiz`) gönderiyor.

Çağıranın kendi dönüş adresindeki sorgu parametreleri (`?promo=dropped`,
`?orderId=…`) yapılandırılmış adrese taşınıyor. Oluşan dize hem forma hem
hash'e **aynı değişkenden** geçtiği için hash bozulmuyor.

### 14.4 Yanıt hash'i uyuşmazlığı ölümcül değil - sorgu ölümcül

`confirmReturn` yanıt hash'ini doğruluyor ama **uyuşmazlıkta doğrudan
reddetmiyor**; uyarı yazıp İşlem Doğrulama Servisi'ne soruyor. Gerekçe: hash
formülündeki `CURRENCY_CODE`'un yanıtta gelip gelmediği ölçülmedi (§1.3,
§12/1); tek dayanak yapılsaydı formül tutmadığı anda **gerçek ödemeler de**
reddedilirdi. Sorgu ise müşterinin ulaşamadığı bir kanaldan geliyor ve
sahtelenemiyor - karar oradan veriliyor.

Reddedilen durumlar: sorguda karşılık yoksa, `STATUS ≠ SUCCESS` ise (`NEW`
dahil, §8.1), satır satış değilse (`TRANSACTION_TYPE` `CANCEL`/`REFUND`: aynı
gün iptal edilen satış, sandbox'ta aynı satırın `CANCEL`/`SUCCESS` olarak
yeniden yazılmasıyla görünüyor), tutar okunamıyorsa, ya da tarayıcının
getirdiği `AUTHORIZATION_AMOUNT` sorgunun söylediğinden farklıysa. Üye işyeri
numarası uyuşmazlığı 15 Eki 2026'dan beri yalnız uyarıdır (§12.1): sorgu
zaten bizim `sx List`'imizle yapılıyor.

### 14.5 İade - `TRX_DATE` ödeme satırından okunuyor, yoksa aranıyor

İptal/iade servisi işlemin tarihini zorunlu tutuyor. 23 Eyl 2026'dan beri
ödemeyi kapatan sorgunun (`confirmReturn`, süpürmedeki `lookupPayment`)
`TRX_DATE`'i `YYYY-MM-DD` olarak `payment_transactions."trxDate"`'e yazılıyor
(`20260923230200_payment_trx_date.sql`). Panelden iade bu günü ve satırdaki
tahsilat tutarını `refund()`'a verir; ikisi de okunursa servis hiç
aranmadan doğrudan iptal/iade isteği gider.

Kolon boşsa (kolondan önce yazılmış satır ya da günü okunamayan bir yanıt)
`refund()` eskisi gibi önce **Raporlama Servisi**'yle (§2.1) `referenceCode`
üzerinden işlemi buluyor; tarihi de tutarı da oradan okuyor. Servis tek
sorguda bir aydan uzun aralık kabul etmediği için bu yedek arama aylık
pencerelerle en fazla 13 ay geriye gidiyor.

İşlem bulunamazsa ya da POS `responseCode ≠ 2` dönerse metot **fırlatıyor**,
`status: "failed"` dönmüyor: admin eylemi yalnızca fırlatılan hatayı
yakalıyor; dönmek, "iade edildi" yazan ama parayı göndermemiş bir kayıt
üretirdi.

### 14.6 Açık kalan iş kalemleri

1. ~~**`form-action` CSP'si.**~~ **Çözüldü (23 Eyl 2026), 15 Eki 2026'da
   yerini §15'e bıraktı:** `/odeme/paynkolay` genel CSP'nin dışında ve her
   yanıtta kendi politikasını gönderiyor; genel `form-action` artık yalnız
   `'self'`. Eski not: `next.config.ts`
   `form-action`'a `https://paynkolay.nkolayislem.com.tr` ve
   `https://paynkolaytest.nkolayislem.com.tr` eklendi
   (`tests/security-headers.test.ts` başka host girmesini de reddeder).
   Canlı denemede bakılacak tek şey: Chrome form gönderiminden sonraki
   yönlendirmeleri de bu listeye göre denetler; POS sayfası başka bir hosta
   yönlendiriyorsa o host da eklenmeli.
2. ~~**Mutabakat işi.**~~ **Çözüldü (23 Eyl 2026).** Zamanlayıcı yok, ama iki
   yer iptalden önce §2 servisine soruyor (`PaynkolayPaymentProvider.lookupPayment`):
   45 dakikalık süpürme (`expireStalePendingOrders`) ve aynı üyenin yeni web
   ödemesi (`supersedeUnpaidWebOrders` - reddedilen karttan sonraki denemede
   kupon/stok geri gelsin diye). `SUCCESS` bulunursa ödeme
   `applyPaymentSucceeded` ile işlenir; POS'a ulaşılamazsa sipariş iptal
   edilmez (bir gün dolana kadar). Testler:
   `tests/db-integration-payment-sweep.test.ts`, `tests/payment-paynkolay.test.ts`.
3. ~~**`TRX_DATE` ve `REFERENCE_CODE` kolonları.**~~ **Çözüldü (23 Eyl
   2026).** `REFERENCE_CODE` zaten `payment_transactions."providerRef"`'teydi;
   `TRX_DATE` artık `payment_transactions."trxDate"`'te. Geriye arama yalnız
   kolonun boş olduğu eski satırlar için kaldı (§14.5). Testler:
   `tests/payment-paynkolay.test.ts` (iki yol), `tests/admin-refund-hint.test.ts`,
   `tests/db-integration-payment-sweep.test.ts`.

### 14.7 İkinci satışa karşı: yeniden açma kapıları ve kart sayfasının son bakışı (17 Eki 2026)

PayNkolay aynı `clientRefCode` ile ikinci bir satışı **kabul eder** (§2: "aynı
`clientRefCode` ile birden çok işlem varsa hepsi döner"). `applyPaymentSucceeded`
siparişi bir kez ilerletir, ama bu siparişi korur, kartı değil: ikinci tahsilat
elle iade bekler. Webhook yok (§4); ödeme yalnız `/odeme/donus`'ta ya da
süpürmede işlenir, dönüş her zaman gelmez (sekme kapanır, telefon bankanın
ekranında kilitlenir). Üç kapı ikinci satışı durdurur:

**1. Uygulama siparişini yeniden açmak** (`POST /api/mobile/v1/orders/{id}/payment`
ve `POST /orders`'ın `clientOrderId` tekrarı, ikisi de `replayAppOrder`).
`checkout-reopen` bütçesinden sonra, yeni oturumdan önce `checkPendingOrderPaid`
(web ödemesinin §15.5'te kullandığı kontrol) önceki denemeyi `lookupPayment` ile
sorar:

| POS'un cevabı               | Ne olur                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `SUCCESS`, tutar doğru      | Ödeme işlenir, oturum açılmaz: **409** `not_payable` (ya da tekrarda 201, `payment: null`) |
| `SUCCESS`, tutar farklı     | İnsan önüne düşer (`amount_mismatch`), sayfa açılmaz: **503** `payment_unavailable`        |
| Kayıt yok / `NEW` / `ERROR` | Yeni ödeme sayfası açılır (eskisi gibi)                                                    |
| POS'a ulaşılamadı           | Sayfa açılmaz: **503** `payment_unavailable`                                               |

Bütçeden sonra sorulur: önce sorulsaydı her istek bütçesiz bir `PaymentList`
çağrısı olurdu.

**2. Karaoke ödemesini yeniden açmak** (`reopenKaraokePayment`: uygulamanın
`POST /karaoke/reservations/{id}/payment`'ı, web'in "Ödemeyi tamamla"sı). POS
eskiden yalnız "ödendi" derse durduruyordu; artık sorulamazsa da, tutar farklıysa
da sayfa açılmaz (`payment_unknown` → mobilde **503** `payment_unavailable`,
web'de "odeme-dogrulanamadi" notu). Tutar farkı yalnız burada "bilinmiyor"
sayılır; süpürme ve iptal o rezervasyonu eskisi gibi serbest bırakır
(`askPosAboutHold`'un `onAmountMismatch` seçeneği).

**3. Kart sayfasının son bakışı** (`/odeme/paynkolay` POST,
`src/lib/payment/bridge-gate.ts`). İmzalı form ömrü boyunca geçerlidir; iki
sekme ya da bankanın sayfasından geri tuşu aynı formu ikinci kez gönderebilir.
`startDirectPayment`'tan hemen önce kayıt, imzalı yükün `clientRefCode`'uyla
okunur (`krk-` ise rezervasyon, `isKaraokeRef`):

| Kayıt                                         | Ne olur                                                                                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ödeme bekliyor                                | Satış başlar (eskisi gibi)                                                                                                                                   |
| Ödenmiş                                       | Satış başlamaz; **409** not sayfası ("kartından ikinci kez para çekilmedi") ve siparişe / rezervasyona bağlantı. `/odeme`'nin formu `/odeme/basarili`'ye 303 |
| İptal, süresi dolmuş, iade edilmiş, kayıt yok | Satış başlamaz; **409** not sayfası. `/odeme`'nin formu `?odeme=sure_doldu`                                                                                  |
| Okunamadı (veritabanı)                        | Satış başlamaz (alınan para hiçbir yere işlenemezdi); genel "Ödeme şu an başlatılamadı" hatası, `/odeme`'de `baslatilamadi`                                  |

Kart yolu yine store ya da veritabanı import etmez (kural 28): modül
`route.ts`'ten yalnız sipariş referansını alır, formu ve kartı görmez
(`tests/saved-cards.test.ts`). Son bakış POS'a **sormaz**: ilk ödemenin dönüşü
kaybolduysa kayıt hâlâ ödeme bekler görünür ve ikinci sekmedeki eski form yine
satış başlatabilir. Bu boşluk açık (`docs/AUDIT.md` §11 "Açık"); yeni sayfa
dağıtan iki kapı (1, 2) ve web ödemesinin yeniden kullanımı (§15.5) POS'a sorar.
Son bakış yalnız `direct` modun POST'unda var: `hosted` modda (§15, geri dönüş
yolu) GET formu kayda bakmadan PayNkolay'ın sayfasına gönderir.

Testler: `tests/mobile-order-idempotency.test.ts`,
`tests/mobile-checkout-reopen-route.test.ts`, `tests/mobile-order-payment.test.ts`,
`tests/karaoke-reopen-pos-gate.test.ts`, `tests/mobile-karaoke-prepay-routes.test.ts`,
`tests/paynkolay-card-page.test.ts`.

---

## 15. Sitede kart formu - `PAYNKOLAY_CHECKOUT_MODE=direct`

**Operatör kararı (15 Eki 2026):** _"site içerisinden direkt ödeme alınırsa
daha kolay olur, direk banka sayfası aşamasında atarsa"_ ve _"kart
bilgilerini saklamıyoruz"_. Müşteri kartını PayNkolay'ın ortak ödeme
sayfasında değil, **sitenin kendi ödeme sayfasında** girer ve oradan doğrudan
**bankanın 3D ekranına** gider. `hosted` mod (eski akış) kodda duruyor;
değişken boşsa o çalışır.

### 15.1 Akış

1. `createCheckoutSession` değişmedi: imzalı yük (`d` + `s`) ve
   `redirectUrl = /odeme/paynkolay?d=…&s=…`. Mobil sözleşme (`redirectUrl`)
   aynı; uygulama aynı adresi açar, mağaza güncellemesi gerekmez.
2. `GET /odeme/paynkolay` imzayı ve yaşı (`rnd`'den, en çok 30 dk -
   `DIRECT_FORM_MAX_AGE_MS`, 45 dk'lık süpürmenin altında) doğrular ve kart
   formunu çizer (`renderCardForm`).
3. `POST /odeme/paynkolay` (aynı sayfanın formu):
   aynı site (`Sec-Fetch-Site` / `Origin`) → imza + yaş → kart doğrulama
   (`parseCardForm`: Luhn, İstanbul ayına göre son kullanma, CVV, ad) →
   deneme sınırı → `startDirectPayment` → `POST /Vpos/v1/Payment`.
4. Başarıda yanıttaki `BANK_REQUEST_MESSAGE` müşteriye verilir
   (`bankChallengePage`); banka 3D'den sonra PayNkolay sonucu her zamanki
   gibi `/odeme/donus`'a POST eder ve karar `PaymentList`'ten verilir (§2).
   Ret ya da hata: form, POS'un mesajıyla yeniden çizilir; kart numarası ve
   CVV geri basılmaz.

`/Vpos/v1/Payment` alanları (sandbox'ta doğrulandı): `sx`, `clientRefCode`,
`successUrl`, `failUrl`, `amount`, `installmentNo=1`, `cardHolderName`,
`cardNumber`, `month` (`MM`), `year` (`YYYY`), `cvv`, `use3D=true`,
`transactionType=SALES`, `rnd`, `hashDatav2` (§10 ile aynı formül),
`environment=API`, `currencyNumber=949`, `cardHolderIP` (kartı gönderen
isteğin IP'si). Doküman canlı isteğin **sunucudan** gitmesini istiyor.

### 15.2 Kart nerede durur

Hiçbir yerde. Tarayıcı → (TLS) → bu sunucu → (TLS) → PayNkolay; sunucuda
yalnız o isteğin belleğinde. Veritabanı, log, dosya yok; kart saklama uçları
kullanılmaz, `customerKey` boş. Kart alanları yalnız `paynkolay-card.ts`,
`paynkolay.ts`, `paynkolay-page.ts`, `odeme/paynkolay/route.ts` ve (16 Eki
2026'dan beri, §15.5) `odeme/card-payment.tsx`'te geçer;
bu dosyalar DB/store import etmez, `console` çağrılarına kart girmez
(`tests/saved-cards.test.ts`). POS'un hata metni gösterilmeden ve loglanmadan
önce kart numarasına benzeyen diziler maskelenir. **Kart hash'lenmez:**
`hashDatav2` işlem alanlarını (sipariş, tutar, adresler, `rnd`) imzalar;
bankanın çekim için gerçek numarayı görmesi gerekir.

### 15.3 Güvenlik önlemleri

| Tehdit                                                   | Önlem                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formdaki üçüncü taraf betiğin kartı okuması (skimming)   | Sayfa sitenin genel CSP'sinin dışında (`next.config.ts` `CSP_SOURCE`) ve kendi CSP'sini gönderir: `default-src 'none'`, betik ve stil yalnız sayfanın kendi bloklarının SHA-256'sıyla, GTM ve dış kaynak yok                                                                                                                                             |
| Formun başka siteye gömülmesi (clickjacking)             | `frame-ancestors 'none'` + `X-Frame-Options: DENY`                                                                                                                                                                                                                                                                                                       |
| Kart denemesi (çalıntı kart listesini sitemizde sınamak) | 5 dakikalık pencerelerle: sipariş başına POS'a giden HER deneme önce sayılır (5, sonra 30 dk); adres başına yalnız POS'un reddettiği/yanıtlayamadığı denemeler sayılır (10, sonra 1 saat) - başarılıları saymak kafenin Wi-Fi'ını kilitliyordu. `card-payment-order` / `card-payment-ip`                                                                 |
| Yükteki `sx` + hash ile API'yi doğrudan çağırmak         | `direct` modda yük AES-256-GCM ile şifrelidir (`e1.` öneki); tarayıcı `sx`'i ve hash'i göremez, POS'a tek yol bu formdur. Şifreli yük yalnız `direct`'te, düz yük yalnız `hosted`'ta açılır                                                                                                                                                              |
| Aynı gün iptal edilmiş satışın "ödendi" sayılması        | `confirmReturn` yalnız `TRANSACTION_TYPE` boş ya da `sales` olan satırı kabul eder (§14.4)                                                                                                                                                                                                                                                               |
| Geri tuşuyla kartın yeniden görünmesi                    | Sayfa her gösterildiğinde (`pageshow`) kart numarası ve CVV silinir                                                                                                                                                                                                                                                                                      |
| Başka siteden kart POST'u                                | `Sec-Fetch-Site`/`Origin` aynı site değilse 403                                                                                                                                                                                                                                                                                                          |
| Tutarın / siparişin değiştirilmesi                       | Alanlar imzalı yükten gelir (HMAC) ve `hashDatav2` yeniden hesaplanıp karşılaştırılır                                                                                                                                                                                                                                                                    |
| 3D'siz ödeme                                             | `use3D` yükte `"true"` değilse istek gitmez                                                                                                                                                                                                                                                                                                              |
| Eski bağlantıyla geç ödeme                               | Yük 30 dk sonra reddedilir                                                                                                                                                                                                                                                                                                                               |
| Bankanın 3D formu                                        | Satır sonları normalleştirilip verilir (CRLF, tarayıcının özetiyle aynı bayt olsun diye); CSP yalnız o yanıttaki satır içi betiklerin ve tırnaklı/tırnaksız olay özniteliklerinin (çözülmüş) özetine (`'unsafe-hashes'`), `form-action https:`'e ve yalnız gömülü görsel/yazı tipine izin verir - ACS hostu bankaya göre değişir, düz `http:` engellenir |
| Önbellek                                                 | Her yanıt `Cache-Control: no-store`                                                                                                                                                                                                                                                                                                                      |

Bankanın 3D formunda öznitelikler tarayıcının ayrıştırma kuralıyla okunur.
Sandbox'ta Ziraat, Akbank, Denizbank ve ING'nin formu (EST tipi şablon)
`<body onload=document.forms["form"].submit()>` yazar: tırnaksız değerin
içindeki `"` değerin parçasıdır. Değeri ilk `"`'da kesen eski okuma özeti
bozuyordu; tarayıcı `onload`'u engelliyor, müşteri kartı yazdıktan sonra
beyaz sayfada kalıyordu (2026-10-16). Sayfa elle yazılmış bir okuyucuyla
değil, tarayıcıların kullandığı WHATWG ayrıştırıcısıyla (`parse5`) okunur:
tırnaksız değerler, Türkçe "İ", betik içindeki `<!--` kaçışları ve karakter
referansları tarayıcıyla aynı sonucu verir. Gövdenin başına (bankanın
gönderen betiğinden önce; tarayıcı gezinme başlayınca ayrıştırmayı
bırakıyor) bir bekleme notu eklenir; formun adresi mutlak https ise 8 sn
sonra bir "Bankanın sayfasına git" düğmesi belirir. Sayfa ayrılmaya
başlayınca not düğmeyi gizler, böylece 3D formu ikinci kez gönderilmez. Not
eklendikten sonra sayfa yeniden okunur; bankanın betik ve öznitelik listesi
değişmişse not eklenmez.

### 15.4 PCI DSS - operatörün bilmesi gereken

PayNkolay dokümanı: _"Bu yapıda kart bilgileri üye işyeri tarafından
alındığı için PCI DSS gereklilikleri üye işyerine aittir."_ Ortak ödeme
sayfasında (`hosted`) bu yük PayNkolay'daydı. `direct` modda:

- PayNkolay'ın üye işyeri için **API ile ödeme** yetkisini açmış olması
  gerekir; açık değilse `/Vpos/v1/Payment` reddeder ve müşteri formda hata
  görür. Geri dönüş: `PAYNKOLAY_CHECKOUT_MODE=hosted` + redeploy.
- PayNkolay yıllık bir PCI DSS öz değerlendirme anketi (SAQ) isteyebilir.
- Hukuki metinler 16 Eki 2026'da düzeltildi: kart sitenin ödeme sayfasında
  girilir, sunucudan aynı istekte yalnızca PayNkolay'a geçer, saklanmaz ve
  loglanmaz (`docs/LEGAL-REDLINES-2026-09.md` §3). PCI DSS sertifikası
  iddia edilmez.

### 15.5 Kart `/odeme`'de, tek sayfada (16 Eki 2026)

**Operatör kararı (16 Eki 2026):** _"checkout sihirbazını genel bilinen
e-ticaret siteleri gibi tasarla baştan kart girerken başka sayfaya vs
atmasın"_, _"lütfen kontrollü git ve hiçbir açık verme"_ ve sonra _"sipariş
verme tamamlama wizardını genel aynı oluştur hızlı ve güzel adımlarla yap ve
mobile uyumlu yap"_. CLAUDE.md kural 28'deki "kart alanları yalnız
`/odeme/paynkolay`'da" kararının bilinçli tersine çevrilmesidir; kuralın geri
kalanı aynen durur (kart saklanmaz, loglanmaz, PayNkolay dışında bir yere
gitmez, Server Action'a girmez).

Web'de 3 adımlı sihirbaz ve "kart bir sonraki sayfada" kalktı. `/odeme` tek
sayfa, istemci tarafında iki adım: **1 Teslimat** (adres + iletişim) → **2
Ödeme** (kart, kayıtlı kartlar, onaylar, öde). Adımlar arasında sayfa
yenilenmez; 2. adım tarayıcı geçmişine kendi kaydıyla girer (Geri tuşu 1.
adıma döner), görünür "Değiştir" de aynı işi yapar. Varsayılan adresi tam
olan üye doğrudan 2. adımda açılır. Sipariş özeti iki adımda da görünür
(masaüstünde yapışkan sağ sütun; telefonda üstte açılır "Sipariş özeti · ₺X"
çubuğu ve 2. adımda altta sabit ödeme çubuğu).

**Akış.**

1. "Siparişi onayla ve öde": tarayıcı adresi, iki onay kutusunu ve kartı
   (`cardFieldErrors`, `parseCardForm`'un aynısı ya da sıkısı) denetler.
2. `startCheckoutAction` (Server Action) yalnız AYRI bir formu okur
   (`items`, alıcı, adres, kod, `legalConsent`, yeniden kullanım alanları):
   siparişi açar ya da reddedilen denemenin bıraktığı siparişi yeniden
   kullanır, `createCheckoutSession`'dan `d`/`s`'yi çıkarıp döner. Kart bu
   isteğe hiç girmez (`tests/saved-cards.test.ts`).
3. Tutar düğmedekiyle aynıysa tarayıcı `d`/`s`'yi kartın **yerli** formuna
   (`<form method="post" action="/odeme/paynkolay">`, kontrolsüz alanlar,
   React state'i yok) yazar ve `form.submit()` eder; yanıt bankanın 3D
   sayfasıdır. Tutar farklıysa (panelde fiyat değişti, kod uygulanamadı)
   yeni tutar gösterilir ve müşteri yeniden basar (MSY m.6, m.8).
4. Tutar 0'sa sipariş `provider:"free"` ile kapanır, `/odeme/basarili`.

**Hatalar `/odeme`'ye sabit kodla döner.** `return=checkout` taşıyan POST'ta
bankaya gidemeyen her sonuç (kart hatası, ret, deneme sınırı, POS hatası,
süre, kayıtlı kart yok/seçim) `303 /odeme?odeme=<kod>[&alan=][&dk=]` olur:
`kart_hatali`, `reddedildi`, `cok_deneme`, `baslatilamadi`, `sure_doldu`,
`kart_yok`, `kart_secimi` (`src/lib/checkout/return-codes.ts`). POS'un
serbest metni, kartın bir parçası ya da sipariş adrese girmez. Sayfa 2.
adımda, "Ödeme tamamlanmadı" başlıklı `role="alert"` bir notla açılır;
adres seçimi ve bekleyen sipariş `sessionStorage`'dan geri gelir, kart
numarası ve CVV her dönüşte boştur (ad ve son kullanma da saklanmaz).
Uygulama yükünde (`successUrl`'de `app=1`) işaret yok sayılır; uygulamanın
ayrı sayfası kart, ret, sınır ve süre durumlarında eskisi gibi davranır.
**Bilinçli tek fark:** okunamayan (imzasız, bozuk ya da bu dağıtımın
anahtarıyla uyuşmayan) bir ödeme yükü eskiden `303 /odeme?error=payment` idi
- uygulamanın tarayıcısını boş sepetli web checkout'una atıyordu. Şimdi
`GET` ve `POST` o durumda 400 (sağlayıcı PayNkolay değilse 503) ile
"Ödeme sayfası açılamadı" notunu verir: "Uygulamaya dön" ve "Sitede ödemeye
dön". Yük okunamadığı için hangi sipariş olduğu bilinmez; not ikisini de
sunar.

**Belgenin kendi CSP'si.** `/odeme` sitenin genel CSP'sinin dışındadır
(`CSP_SOURCE`, yalnız tam bu yol) ve `src/proxy.ts` her istekte taze bir
nonce'la kendi politikasını gönderir: `script-src 'self' 'nonce-…'`,
betikte `'unsafe-inline'`/`'unsafe-eval'` yok, üçüncü taraf yok, `img-src
'self' data:` (uzak görsel yok), `connect-src
'self'`, `frame-src 'none'`, `form-action 'self'`, `frame-ancestors 'none'`,
`base-uri 'none'`, `object-src 'none'` (`src/lib/security/checkout-csp.ts`).
Next.js nonce'u isteğin `Content-Security-Policy` başlığından okur ve kendi
satır içi betiklerine basar; sayfa `force-dynamic`'tir. GTM, rıza betikleri
ve çerez bandı bu belgede hiç çizilmez (`site-tags.tsx`, `usePathname`;
kök layout `headers()` okumaz). Başka bir sayfadan istemci tarafı gezinmeyle
gelinirse belge o sayfanınkidir (GTM yüklenmiş olabilir): checkout
`performance.getEntriesByType("navigation")[0]`'ın yoluna bakar, `/odeme`
değilse kendini bir kez yeniden yükler ve o zamana kadar yalnız iskelet
çizer. Sitenin girişleri (`chrome.tsx` sepet düğmesi, ürün sayfasının "hemen
al"ı, sepet çekmecesi, e-posta doğrulama sayfası) tam sayfa yüklemesidir.

**Yeniden deneme aynı siparişi kullanır.** Tarayıcı sekmede yalnız
`{orderId, d, s, cartKey, createdAt}` ve sunucunun tutar teklifini tutar
(kart yok, kişisel veri yok). Eylem siparişi ancak hepsi tutarsa yeniden
kullanır, ve ESKİ yükü yeniden vermeden önce POS'a sorar
(`checkPendingOrderPaid`, `settlePendingFromProvider`'ın kısa zaman aşımlı
hâli): müşteri bankada ödemiş, dönüş POST'u kaybolmuş ve yeniden bastıysa
aynı sipariş ikinci kez çekilmesin. POS "ödendi" derse sipariş
`applyPaymentSucceeded` ile işlenir ve müşteri başarı sayfasına gider;
"ödenmedi" derse yük yeniden verilir; POS'a ulaşılamazsa (`unknown`) sipariş
yeniden KULLANILMAZ, yeni sipariş açılır (eskisini süpürme yine POS'a sorarak
ele alır). Yeniden kullanım için koşullar: yük doğrulanır ve en az 5 dk daha tazedir, `clientRefCode ===
orderId`, sipariş oturumdaki üyenindir, hâlâ `pending_payment`, web
siparişidir, tutarı yükün tutarına eşittir, sepet anahtarı ve sipariş
satırları gönderilenle aynıdır (`src/lib/checkout/reuse.ts`). Aksi hâlde
yeni sipariş açılır, eskisi `supersedeUnpaidWebOrders` ile bırakılır. Eylem
üye başına `checkout-start` bütçesiyle sınırlıdır (10 / 5 dk, sonra 10 dk).

**Beyaz sayfa yok.** Kart POST'unun yönlendirme olmayan her yanıtı metni ve
bir sonraki adımı olan bir sayfadır (`tests/checkout-return.test.ts`).
Okunamayan bir ödeme bağlantısı artık web checkout'una (boş sepetle)
yönlendirilmez; sayfa uygulamanındır ve "Uygulamaya dön" + "Sitede ödemeye
dön" diyen bir not gösterilir. "Bankaya yönlendiriliyorsun…" 30 sn içinde
(POS'un ödeme süresi sınırı olan 25 sn'den uzun) sayfa değişmezse düğmeyi
geri verir ve yeniden denemeyi söyler; eylem 30 sn'de yanıt vermezse aynısı; bfcache'ten (`pageshow`) dönüşte düğme açılır.
`/odeme/(checkout)/error.tsx` ve `loading.tsx` yalnız checkout sayfasını
sarar ("kartından para çekilmedi" der). `/odeme/basarili`, `/app-hata` ve
dönüş için `/odeme/error.tsx` paranın lafını etmez (ödemiş bir müşteri
orada olabilir): sayfayı yeniden dener, "Siparişlerim"e götürür.

**Tek sipariş maili ve sıfır tutar.** Müşteri kargoya kadar yalnız "ödemen
alındı" mailini alır (`notifyOrderPaid`, `order_notice_emails` türü `paid`):
satırlar, Ara toplam, Kargo, İndirim ve toplam birbirini tutar, ÖBF/MSS/cayma
bağlantıları kalır. Sağlayıcı 429/5xx verirse ya da ulaşılamazsa AYNI
istekte, aynı `Idempotency-Key` ile bir kez daha denenir (en çok 1,5 sn
bekleyerek); o da olmazsa kayıt serbest kalır ve bankanın dönüşü yeniden
gelirse (24 saat içinde) mail yeniden önerilir; talep tek seferlik kalır.
Tutarı sıfır olan sipariş kapanamazsa (`applyPaymentSucceeded` hata verirse)
"ödendi" denmez: hata gösterilir, kart çekilmedi, yeniden deneme yeni sipariş
açar.

**Kayıtlı kartlar** (`PAYNKOLAY_CARD_STORAGE=on` olmadan görünmez, §16):
sunucu bileşeni üyenin anahtarıyla 3 sn sınırla listeler; tarayıcıya yalnız
`{tranId, last4, bank, brand, alias}` gider, token gitmez. Seçim yerli
formda `cardChoice=<tranId>` olarak gider. "Sil" ödeme formunun DIŞINDA,
`type="button"` bir düğmedir, onay ister ve üyenin anahtarını sunucuda
oturumdan türeten, sınırlı (`card-delete`) bir Server Action'dan geçer.
Formun tek gönderme düğmesi ödeme düğmesidir: kart alanında Enter öder ya
da (onaylar boşken) hiçbir şey yapmaz.

---

## 16. Kayıtlı kart - kart PayNkolay'da durur

**Operatör kararı (15 Eki 2026):** _"kayıtlı kart olsun ama kart
detaylarını toplamayalım, PayNkolay'da kalsın"_. §9.1'deki "kart saklama v1
dışında" kararının yerini alır. Kart PayNkolay'ın kart saklama hizmetinde
durur; biz yalnız onu üyeyle eşleştiren anahtarı tutarız.

**Açma anahtarı:** `PAYNKOLAY_CARD_STORAGE=on`. PayNkolay kart saklamayı üye
işyerine ayrıca yetkiyle açar; operatör yetkiyi 16 Eki 2026'da istedi. Yetki
gelene kadar değişken boş kalır: yüke üye anahtarı girmez, kayıtlı kart
listesi, "kartımı kaydet" ve silme görünmez, POS'a `cs*` alanı gitmez. Yetki
gelince Vercel'de `on` yapılıp yeniden yayınlanır.

### 16.1 Ölçülen API (sandbox, Postman "Kart Saklama")

| İş               | Uç                                         | Alanlar                                                           | Hash                                                                 |
| ---------------- | ------------------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| Ödemede kaydet   | `POST /Vpos/v1/Payment`                    | kart alanları + `csCustomerKey`, `csAutoSave=true`, `csCardAlias` | `sx\|clientRefCode\|amount\|successUrl\|failUrl\|rnd\|csCustomerKey` |
| Listele          | `POST /Vpos/Payment/CardStorageCardList`   | `sx`, `customerKey`                                               | `sx\|customerKey`                                                    |
| Saklı kartla öde | `POST /Vpos/v1/Payment`                    | kart alanı YOK; `csCustomerKey`, `csToken`                        | ödemedekiyle aynı                                                    |
| Sil              | `POST /Vpos/Payment/CardStorageCardDelete` | `sx`, `customerKey`, `tranId` (boş), `token`                      | `sx\|customerKey\|tranId\|token`                                     |

Ölçülenler:

- **Anahtar en fazla 11 karakter** (`CORE0364`). Doküman TCKN/telefon
  öneriyor; **rastgele, opak 11 karakter (`[A-Z0-9]`) kabul edildi.** Bu
  yüzden PayNkolay'a üyenin kimliği ya da telefonu gitmez
  (`newPaynkolayMemberKey`).
- Kart, **3D onayından sonra** saklanıyor; dönüşte `TRAN_ID` geliyor.
- Liste yanıtı: `{ProcReturnCode:"00", Data:{totalcount, cards:{Card:{
CardFileds:{Detail:[{Token, TranId, Maskedpan:"41556501****6111",
CARDISSUER, CARDTYPE, CARDBRAND, CARD_ALIACE, EXP_DATE}]}}}}}`. Kart yoksa
  `ProcReturnCode:"02"`, "Gecerli Kart Yok".
- Saklı kartla ödemede de **3D isteniyor** (ters ibraz koruması sürer).
- Silme **yalnız `token` ile** çalıştı; yalnız `tranId` ile "Gecersiz Veri"
  döndü (Postman "biri yeter" diyor - yanlış).
- Liste ve silme, ödeme `sx`'iyle çalıştı.
- Üye işyerinin "kart saklama yetkisi" olmalı; yoksa `csAutoSave` sessizce
  bir şey saklamayabilir - ödeme yine geçer.

### 16.2 Bizdeki karşılığı

- Anahtar `customers."cardUserKey"`'de (sütun zaten vardı, hiç dolmamıştı).
  Üyenin ilk ödemesinde `ensureCardUserKey` üretir; karşılaştır-ve-yaz ile
  yazılır, aynı anda açılan iki ödeme tek anahtarda buluşur.
- Anahtar ödeme yükünde **imzalı** taşınır (`member`), formun alanlarına
  girmez: ortak ödeme sayfasında `customerKey` boş kalır.
- Kart sayfası: saklı kartlar maskeli (son 4), bankası, markası ve adıyla
  listelenir; **token tarayıcıya gitmez** - form kartı `TranId` ile seçer,
  sunucu token'ı üyenin listesinden bulur (başka üyenin kartı seçilemez).
  "Bu kartı sonraki ödemeler için kaydet" işaretsiz gelir. Her kartın
  yanında "Sil".
- Hesap kapanınca (`deleteMe`, web ve uygulama) önce PayNkolay'daki kartlar
  silinir, sonra anahtar temizlenir. POS'a ulaşılamazsa kapanış durmaz;
  anahtar elle temizlik için loglanır (kişisel veri değil).
- Ödeme kaydına (`payment_transactions.raw`) **kart sahibinin adı yazılmaz**
  (`withoutHolderName`; KVKK veri en aza indirme, hukuki metinler Ö7).
- `CardStorageCardRegister` (kart numarasıyla, ödemesiz saklama) hiçbir
  yerde çağrılmaz (`tests/saved-cards.test.ts`).
