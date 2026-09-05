# PayNkolay sanal POS — entegrasyon sözleşmesi

Bu belge, iyzico yerine PayNkolay kullanma kararının teknik karşılığıdır.
Amacı, `src/lib/payment/provider.ts` içindeki `PaymentProvider` arayüzünün her
metodunun PayNkolay'da neye karşılık geldiğini **doğrulanmış** kaynaklarla
sabitlemek.

**Belgenin kuralı:** para akışı söz konusu; bu yüzden her madde ya
_doğrulandı_ (kaynak URL'si ile) ya da _**doğrulanamadı**_ olarak işaretli.
Doğrulanamayan hiçbir şey koda "kesin" gibi geçirilmez — canlı/test ortamında
ölçülür, ölçüm sonucu buraya yazılır. Belgenin sonundaki
[Canlı testte ölçülecekler](#12-canlı-testte-ölçülecekler) listesi tam olarak
bu açıkların dökümüdür.

Kullanılan kaynak: PayNkolay resmî entegrasyon dokümantasyonu,
<https://paynkolay.com.tr/entegrasyon/> (Eylül 2026'da okundu). Sayfa
başlıkları aşağıda tek tek anılıyor.

---

## 0. Mimari uyum — neden bu sağlayıcı bizim modelimize oturuyor

Barındırılan (hosted) form modeli: kart numarası, CVV ve son kullanma tarihi
**PayNkolay'ın kendi sayfasında** girilir. Bizim tarafımızdan gönderilen
alanların arasında kart alanı yoktur.

Bunun sonucu: **PAN hiçbir zaman bizim sunucumuza girmez** — iyzico
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

Eski `v1/Payment` yolu güncel dokümanda geçmiyor; form doğrudan `/Vpos`'a
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
| `hashData`              | Eski (v1, SHA-1) yanıt hash'i    | —                |
| `hashDataV2`            | Güncel yanıt hash'i              | —                |

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

### 1.3 Başarı ölçütü — en kritik madde

Doküman açıkça yazıyor:

> "İşlem sonucunun successURL sayfasına dönmesi işlemin başarılı olduğu
> anlamına gelmez."

ve

> "İşlem sonucunda size gönderilen Response Hash'i (hashDataV2) mutlaka
> kontrol ediniz."

Dokümanın verdiği başarı testi: `RESPONSE_CODE == 2` **ve** `AUTH_CODE`
dolu — boş, `0` veya `00` değil.

**Bizim kuralımız bundan daha katı olacak.** Dönüş parametreleri müşterinin
tarayıcısından gelir; müşteri onları değiştirebilir. `hashDataV2` doğrulaması
sahteciliği zorlaştırır ama tek başına yeterli saymıyoruz, çünkü:

- `CURRENCY_CODE` hash formülünde var ama **POST edilen alanlar arasında
  yok** (§1.1 tablosuna bak — doküman listelemiyor). Yani hash'i doğrularken
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

**Durum: doğrulandı** (üretim ucu hariç). Kaynak:
[İşlem Doğrulama Servisi](https://paynkolay.com.tr/entegrasyon/10-verification-service.php).

Doküman bu servisin amacını şöyle tarif ediyor: işlemin doğruluğunu ve paranın
gerçekten çekilip çekilmediğini kontrol etmek. Bizim `confirmReturn`'ün
dayanağı budur.

|             |                                                                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Uç (test)   | `POST https://paynkolaytest.nkolayislem.com.tr/Vpos/Payment/PaymentList`                                                                                        |
| Uç (üretim) | **doğrulanamadı** — doküman yazmıyor. Host değişimiyle `https://paynkolay.nkolayislem.com.tr/Vpos/Payment/PaymentList` olması beklenir; canlıda teyit edilecek. |
| Gövde       | `multipart/form-data`                                                                                                                                           |

İstek alanları:

| Alan            | Zorunlu | Biçim / açıklama                                             |
| --------------- | ------- | ------------------------------------------------------------ |
| `sx`            | evet    | **Listeleme sx'i** — satış sx'inden farklı (§7)              |
| `startDate`     | evet    | `DD.MM.YYYY`                                                 |
| `endDate`       | evet    | `DD.MM.YYYY`                                                 |
| `clientRefCode` | hayır   | Bizim referansımız; verilmezse aralıktaki tüm işlemler döner |
| `hashDatav2`    | evet    | Aşağıdaki formül                                             |

Hash:

```
sx | startDate | endDate | clientRefCode | merchantSecretKey
```

SHA-512 → Base64. (Alan adının dokümandaki yazımı `hashDatav2` — küçük `v`.
§11'deki nota bak.)

Yanıt alanları: `RESPONSE_CODE`, `REFERENCE_CODE`, `AUTH_CODE`, `STATUS`,
`TRANSACTION_AMOUNT`, `AUTHORIZATION_AMOUNT`, `CLIENT_REFERENCE_CODE`,
`TRANSACTION_TYPE`, `TRX_DATE`, `INSTALLMENT_COUNT`, `IS_3D`, `CARD_NUMBER`
(maskeli), `CARD_HOLDER_NAME`, `CARD_BANK_CODE`, `CARD_BANK_NAME`, `POS_TYPE`,
`TERMINAL_NAME`, `VALOR_DATE`, `OID`, `COMMISION`, `BANK_RESULT`.

`STATUS` değerleri — **karar bu alandan verilir**, doküman da bunu söylüyor
("işlemlerin başarılı olup olmadığını kontrol etmek için STATUS değerini
doğrulamalısınız"):

| `STATUS`  | Anlamı                                                    |
| --------- | --------------------------------------------------------- |
| `SUCCESS` | Onaylanmış işlem                                          |
| `ERROR`   | Başarısız işlem                                           |
| `NEW`     | Başlatılmış ama bitmemiş — para çekilmemiş, yarıda kalmış |

`TRANSACTION_TYPE`: `sales`, `cancel`, `refund` (dokümanın Türkçe
sürümünde ayrıca `refundp` = kısmi iade geçiyor; bkz. §3).

Kısıt: **bir sorguda en fazla bir aylık veri** çekilebiliyor. Bizim
kullanımımızda sorgu tek bir güne (sipariş tarihi) daraltılacağı için bu bir
engel değil.

Aynı `clientRefCode` ile birden çok işlem varsa hepsi döner — bu yüzden
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
| Uç (üretim) | **doğrulanamadı** — host değişimiyle `https://paynkolay.nkolayislem.com.tr/Vpos/v1/CancelRefundPayment` beklenir |
| Gövde       | `multipart/form-data`                                                                                            |

İstek alanları:

| Alan            | Zorunlu | Biçim / açıklama                                                                          |
| --------------- | ------- | ----------------------------------------------------------------------------------------- |
| `sx`            | evet    | **İptal sx'i** — satış ve listeleme sx'lerinden farklı (§7)                               |
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
Kısmi tutar geldiğinde, davranış canlı testte ölçülene kadar hata fırlatılır —
sessizce yanlış tutar iade etmektense reddetmek doğrudur.

---

## 4. Sunucudan sunucuya bildirim (webhook)

**Durum: doğrulandı — PayNkolay'da webhook YOK.**

Okunan sayfaların hiçbirinde sunucudan sunucuya bildirim, callback, IPN ya da
imzalı olay gönderimi geçmiyor:
[Ödeme Entegrasyon Servisleri](https://paynkolay.com.tr/entegrasyon/01-payment-integration-services.php),
[Ödeme Sonucu](https://paynkolay.com.tr/entegrasyon/06-payment-result.php),
[SSS](https://paynkolay.com.tr/entegrasyon/45-faq.php).
Akışın tamamı, tarayıcının `successUrl` / `failUrl`'e form-POST'u üzerine
kurulu. Doğrulama tarafında sunulan tek sunucu-sunucu mekanizması, **bizim
sorduğumuz** İşlem Doğrulama / Raporlama servisleridir (§2) — yani çekme
(pull), itme (push) değil.

Bunun iki sonucu var:

1. **`verifyWebhook` bu sağlayıcıda anlamsızdır.** İmzalanmış bir olay gelmediği
   için doğrulanacak bir şey yok. `PaymentProvider.verifyWebhook` şu an
   zorunlu bir metot; PayNkolay uygulaması bu metodu çağrıldığında **her zaman
   hata fırlatarak** karşılamalı ("PayNkolay webhook göndermez"). Fail-closed:
   sahte bir isteğin sipariş kapatmasına yol bırakmaz.
   - Alternatif, arayüzü `verifyWebhook?:` yapmak. `confirmReturn` zaten
     opsiyonel; simetri için tercih edilebilir. Bu, `provider.ts` ve
     `mock.ts`'i de ilgilendirdiği için ayrı bir karar — burada not düşülüyor.
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
`10.00`, `1.00` geçiyor — yani **daima iki ondalık basamak**.

Ondalık ayracı **nokta**dır, virgül değil. Binlik ayracı **yoktur**
(`1280.10`, `1.280,10` değil).

Hash'e giren değer, forma yazılan değerle **birebir aynı dize** olmak
zorunda: hash ham dize üzerinden hesaplanır, sayı olarak değil. `250.5` ile
`250.50` farklı hash üretir.

> **Kural (bizim taraf):** dönüşüm tek bir yerde yapılır —
> `minorToPaynkolayAmount(amountMinor: number): string`, `(minor / 100)`'ün
> **iki basamağa sabitlenmiş** hali (`toFixed(2)`). Üretilen dize hem
> `amount` alanına hem hash girdisine **aynı değişkenden** geçer; iki ayrı
> yerde formatlanmaz. Bu, CLAUDE.md'deki "para her zaman kuruş integer'dır,
> görüntüleme tek bir yardımcıdan geçer" kuralının ödeme tarafındaki
> karşılığıdır.

Yanıtta `TRANSACTION_AMOUNT` ve `AUTHORIZATION_AMOUNT` aynı biçimde
(`1.00`) dönüyor. Hash'e giren, **`AUTHORIZATION_AMOUNT`**'tır (§1.2) —
yani fiilen çekilen tutar. Bunu tekrar kuruşa çevirirken kayan nokta
kullanılmamalı; dizeyi noktadan bölüp integer aritmetiğiyle çevirmek gerekir.

**Doğrulanamadı:** taksitli işlemde `AUTHORIZATION_AMOUNT`'ın toplam tutar mı
yoksa taksit tutarı mı olduğu. Taksit v1'de kullanılmayacak; kullanılırsa
ölçülecek.

---

## 6. `rnd` biçimi ve zaman dilimi

**Durum: kısmen doğrulandı — çelişkili.**

| Kaynak                                                                                                        | `rnd` için söylediği                                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [01 — Ödeme Entegrasyon Servisleri](https://paynkolay.com.tr/entegrasyon/01-payment-integration-services.php) | "DateTime.Now ile işlem tarihini göndermeniz gerekmektedir", örnek `09-08-2021 15:24:22` (tire ayraçlı) |
| [02 — Örnek Form](https://paynkolay.com.tr/entegrasyon/02-example-form.php)                                   | `dd.mm.yyyy H:mm:ss` (nokta ayraçlı)                                                                    |
| [06 — Ödeme Sonucu](https://paynkolay.com.tr/entegrasyon/06-payment-result.php)                               | Dönen `RND` örnekleri epoch-ms: `1630051651137`, `1645700316156`                                        |

Yani doküman kendi içinde üç ayrı biçim gösteriyor. Çıkarılabilecek sağlam
sonuç: `rnd` **serbest bir dize**dir ve PayNkolay onu yalnızca hash'e girdi
olarak kullanır; biçimi doğrulamaz.

Zaman dilimi hiçbir yerde yazmıyor — **doğrulanamadı**. Türkiye saati
(Europe/Istanbul, UTC+3) varsayılacak.

> **Karar:** `rnd` olarak `dd.MM.yyyy HH:mm:ss` (nokta ayraçlı, `02` örnek
> formuyla aynı) üretilecek, Europe/Istanbul'a göre. Değer **sipariş başına
> bir kez** üretilir, `amount` gibi tek değişkenden hem forma hem hash'e
> geçer.
>
> Dönüşte hash doğrularken **gönderdiğimiz `rnd` değil, dönen `RND` alanı**
> kullanılacak — doküman örnekleri ikisinin farklı olabileceğini gösteriyor.

---

## 7. `sx`, `agentCode`, `merchantSecretKey` — hangisi sır?

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
kodudur (Token)") ve HTML formunun `hidden` alanı olarak tarayıcıya çıkar —
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

### 8.1 İki adımlı 3D tuzağı — `AUTOCOMPLETE`

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
> **ödendi saymaz** — bu, ayar yanlışsa sessizce ücretsiz sipariş üretmenin
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
| `amount`          | evet    | `minorToPaynkolayAmount(amountMinor)` — §5                                |
| `currencyCode`    | hayır   | `949` (TRY). Gönderilmezse TL varsayılıyor; yine de açıkça gönderilecek   |
| `successUrl`      | evet    | `PAYNKOLAY_SUCCESS_URL`                                                   |
| `failUrl`         | evet    | `PAYNKOLAY_FAIL_URL`                                                      |
| `rnd`             | evet    | §6                                                                        |
| `use3D`           | evet    | `"true"` — §8                                                             |
| `transactionType` | evet    | `SALES` (ön provizyon için `PRESALES`; kullanmıyoruz)                     |
| `cardHolderIP`    | evet    | `CheckoutInput.buyerIp`; IPv4 veya IPv6                                   |
| `customerKey`     | hayır   | `CheckoutInput.cardUserKey` — kart saklama için; yoksa **boş dize**       |
| `agentCode`       | hayır   | Gönderilmiyor — §7                                                        |
| `hashDataV2`      | evet    | §10                                                                       |
| `instalments`     | hayır   | Gönderilmiyor (v1'de taksit yok)                                          |

`clientRefCode` için doküman: "Her işlem için benzersiz olması önerilir".
Bizde bu **öneri değil zorunluluk** — §2'de anlatıldığı gibi doğrulama
sorgusu bu koda göre eşleştirme yapıyor.

### 9.1 `customerKey` ve kart saklama

[Hash İsteği](https://paynkolay.com.tr/entegrasyon/04-hash-request.php)
sayfasının notu: "Kart saklama hizmeti alınmıyorsa CS_CUSTOMER_KEY boş
olacaktır."

Yani `customerKey` kullanılmadığında hash dizesinde o konum **boş kalır** ve
ardışık iki boru işareti (`…|rnd||merchantSecretKey`) oluşur. Konum
atlanmaz — bu, hash'i sessizce bozan klasik hatadır.

**Doğrulanamadı:** alanın form üzerindeki gerçek adı. `01` numaralı sayfanın
parametre tablosunda `customerKey`, `14-save-card.php` sayfasında
`csCustomerKey`, `04-hash-request.php` notunda `CS_CUSTOMER_KEY` geçiyor.
Ayrıca saklanan kartın anahtarının **yanıtta hangi alanla döndüğü** hiçbir
sayfada yazmıyor — yani `ReturnConfirmation.cardUserKey`'i neyden
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

  (`digest("hex")` **değil** — Base64 doğrudan ham özetten alınır.)

Diğer servislerin hash formülleri aynı sayfada listeli ve bu belgede ilgili
bölümlerde tekrarlandı (§2, §3).

---

## 11. `PaymentProvider` eşleşme tablosu

| Arayüz üyesi                        | PayNkolay karşılığı                                                                                         | Not                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                              | `"paynkolay"`                                                                                               | —                                                                                                                                                                                                                                                                                                                                                              |
| `createCheckoutSession(input)`      | Doğrudan bir API çağrısı **yok**. `/Vpos`'a POST edilecek form alanları (§9) + `hashDataV2` (§10) üretilir. | Dönen `CheckoutSession`: `providerRef` = ürettiğimiz `clientRefCode`; `redirectUrl` = kendi tarafımızda barındırdığımız, alanları gizli input olarak taşıyıp otomatik submit eden ara sayfa; `expiresAt` = kendi belirlediğimiz süre. **PayNkolay bir oturum kimliği ya da son kullanma zamanı vermiyor** — bu üç alanın üçü de bizim ürettiğimiz değerlerdir. |
| `verifyWebhook(req)`                | **Karşılığı yok.** PayNkolay webhook göndermez (§4).                                                        | Çağrıldığında hata fırlatır (fail-closed). Terk edilen ödemeler için, `pending` siparişleri §2 servisiyle sorgulayan bir mutabakat işi gerekir — webhook'un yerini tutan tek şey odur.                                                                                                                                                                         |
| `refund(providerRef, amountMinor?)` | `POST /Vpos/v1/CancelRefundPayment` (§3)                                                                    | `providerRef` olarak PayNkolay'ın `REFERENCE_CODE`'u gerekir — bizim `clientRefCode`'umuz değil. İşlem aynı günse `type=cancel`, değilse `type=refund`. `trxDate` zorunlu; siparişten ya da §2 sorgusundan okunur. Kısmi iade **v1'de reddedilir** (§3.2).                                                                                                     |
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
   gerekiyor.

---

## 12. Canlı testte ölçülecekler

Bu belgede "doğrulanamadı" işaretli her madde, ilk test işleminde ölçülecek ve
sonucu buraya yazılacak:

1. Yanıtta `CURRENCY_CODE` POST ediliyor mu? Edilmiyorsa yanıt hash'ine hangi
   değer giriyor (`949`? boş?) — §1.3
2. Dönen `RND`, gönderdiğimiz `rnd` ile aynı mı, yoksa PayNkolay kendi epoch-ms
   değerini mi üretiyor? — §1.3, §6
3. Yanıtta `USE_3D` hangi yazımla dönüyor (`true` / `True`)? — §8
4. `AUTOCOMPLETE` ayarı hangi değerde; 3D sonrası işlem doğrudan `SUCCESS`
   oluyor mu, yoksa `NEW`'de mi kalıyor? — §8.1
5. Doğrulama ve iptal/iade servislerinin **üretim** uçları — §2, §3
6. Kısmi iade: `type=refund` küçük tutarla mı, `type=refundp` ile mi? — §3.2
7. "Aynı gün" (cancel/refund sınırı) hangi saat dilimine göre? — §3.1
8. Kart saklama alan adı (`customerKey` / `csCustomerKey`) ve saklanan kart
   anahtarının yanıttaki alan adı — §9.1
9. Hash alan adının büyük/küçük harf duyarlılığı — §11.1
10. Başarısız işlemde `failUrl`'e gelen `RESPONSE_CODE` değerleri (doküman
    yalnızca `2` = başarı diyor; hata kodları listesi
    [43-error-codes](https://paynkolay.com.tr/entegrasyon/43-error-codes.php)
    POS hata kodlarını veriyor, servis yanıt kodlarını değil)

Test kartları
([07-test-cards](https://paynkolay.com.tr/entegrasyon/07-test-cards.php)),
örn. Vakıfbank Visa `4029400000000001`, 05/2028, CVV `951`.

---

## 13. Ortam değişkenleri

Operatörün PayNkolay panelinden alıp (üye işyerini seçerek) dağıtım ortamına
girmesi gerekenler. `src/lib/payment/index.ts` içindeki `required()` deseni
korunacak: eksik değişkenle sağlayıcı **açılmaz**.

| Değişken                        | Sır mı?                   | Kaynak / açıklama                                                                                                                                                                                                                     |
| ------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PAYMENT_PROVIDER`              | hayır                     | `paynkolay`                                                                                                                                                                                                                           |
| `PAYNKOLAY_SX`                  | hayır (forma yazılır)     | Panel → "sx (Token)" — ödeme formu için                                                                                                                                                                                               |
| `PAYNKOLAY_SX_LIST`             | hayır                     | Panel → "sx List" — işlem doğrulama/raporlama için                                                                                                                                                                                    |
| `PAYNKOLAY_SX_CANCEL`           | hayır                     | Panel → "sx İptal" — iptal/iade için                                                                                                                                                                                                  |
| `PAYNKOLAY_MERCHANT_SECRET_KEY` | **EVET — tek gerçek sır** | Panel → "Merchant Secret Key". Yalnızca hash hesabına girer, hiçbir yere gönderilmez. Mobil pakete **asla** girmez.                                                                                                                   |
| `PAYNKOLAY_MERCHANT_NO`         | hayır                     | Yanıt hash'inin ilk alanı; yanıttan da geliyor ama beklenen değerle karşılaştırmak için ayrıca tutulur                                                                                                                                |
| `PAYNKOLAY_BASE_URL`            | hayır                     | `https://paynkolaytest.nkolayislem.com.tr` / `https://paynkolay.nkolayislem.com.tr`. Test-üretim farkı yalnızca host + anahtarlar olduğu için `NODE_ENV`'e değil bu değişkene bakılır (iyzico'daki `IYZICO_BASE_URL` deseniyle aynı). |
| `PAYNKOLAY_SUCCESS_URL`         | hayır                     | Tam URL; hash'e girdiği için forma yazılanla **birebir aynı dize** olmalı                                                                                                                                                             |
| `PAYNKOLAY_FAIL_URL`            | hayır                     | Aynı kural                                                                                                                                                                                                                            |

Kullanılmayacaklar: `PAYMENT_WEBHOOK_SECRET` (PayNkolay webhook göndermiyor,
§4), `PAYNKOLAY_AGENT_CODE` (bayi yok, §7).

---

## Kaynak listesi

- <https://paynkolay.com.tr/entegrasyon/> — doküman dizini
- <https://paynkolay.com.tr/entegrasyon/01-payment-integration-services.php> — uçlar, form alanları, `amount`/`rnd`/`sx`/`agentCode`
- <https://paynkolay.com.tr/entegrasyon/02-example-form.php> — örnek form ve alan değerleri
- <https://paynkolay.com.tr/entegrasyon/03-api-documentation.php> — non-3D dönüş davranışı, `currencyNumber`
- <https://paynkolay.com.tr/entegrasyon/04-hash-request.php> — istek hash formülleri (tüm servisler)
- <https://paynkolay.com.tr/entegrasyon/05-hash-response.php> — yanıt hash formülü
- <https://paynkolay.com.tr/entegrasyon/06-payment-result.php> — dönüş parametreleri, başarı ölçütü
- <https://paynkolay.com.tr/entegrasyon/07-test-cards.php> — test kartları
- <https://paynkolay.com.tr/entegrasyon/09-cancel-refund-payment.php> — iptal ve iade
- <https://paynkolay.com.tr/entegrasyon/10-verification-service.php> — işlem doğrulama servisi
- <https://paynkolay.com.tr/entegrasyon/14-save-card.php> — kart saklama
- <https://paynkolay.com.tr/entegrasyon/27-complete-payment.php> — iki adımlı 3D tamamlama
- <https://paynkolay.com.tr/entegrasyon/28-reporting-service.php> — raporlama servisi
- <https://paynkolay.com.tr/entegrasyon/43-error-codes.php> — POS hata kodları
- <https://paynkolay.com.tr/entegrasyon/45-faq.php> — sx/secret key nereden alınır, ortam URL'leri

---

## 14. Uygulama — kod nerede, hangi kararlar verildi

Sözleşme `src/lib/payment/paynkolay.ts` içinde uygulandı. Aşağıdakiler
belgenin yazıldığı andan sonra, kodu yazarken verilen kararlardır.

| Dosya                              | İşi                                                     |
| ---------------------------------- | ------------------------------------------------------- |
| `src/lib/payment/paynkolay.ts`     | Sağlayıcı, hash'ler, tutar dönüşümü, servis çağrıları   |
| `src/app/odeme/paynkolay/route.ts` | Ödeme formunu kuran ve kendiliğinden gönderen ara sayfa |
| `src/lib/payment/index.ts`         | `PAYMENT_PROVIDER=paynkolay` dalı                       |
| `tests/payment-paynkolay.test.ts`  | Hash vektörleri, tutar, dönüş teyidi, iade              |

### 14.1 Ara sayfa — `redirectUrl` ile form POST arasındaki fark

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
seçiliyor (§2). Eşleşen satır yoksa işlem başarısız sayılır — uydurulmuş bir
referans başkasının ödemesini kapatamasın.

Bunun yan faydası: `/odeme/donus` teyit edemediğinde bile müşteriyi kendi
siparişine gönderebiliyor — dönüşteki `CLIENT_REFERENCE_CODE` sipariş
kimliğinin ta kendisi.

### 14.3 `successUrl` / `failUrl` — ikisi de `/odeme/donus`

`PAYNKOLAY_FAIL_URL` de `/odeme/donus`'a bakar. Sebep: PayNkolay sonucu iki
adrese de **form-POST** ediyor; `/odeme/app-hata` bir sayfadır ve POST'a 405
döner — ödemesi geçmeyen müşterinin gördüğü son ekran o hata olurdu.
`confirmReturn` başarısız işlemi de sonuçlandırıp müşteriyi doğru yere
(uygulamaya ya da `/odeme?durum=basarisiz`) gönderiyor.

Çağıranın kendi dönüş adresindeki sorgu parametreleri (`?promo=dropped`,
`?orderId=…`) yapılandırılmış adrese taşınıyor. Oluşan dize hem forma hem
hash'e **aynı değişkenden** geçtiği için hash bozulmuyor.

### 14.4 Yanıt hash'i uyuşmazlığı ölümcül değil — sorgu ölümcül

`confirmReturn` yanıt hash'ini doğruluyor ama **uyuşmazlıkta doğrudan
reddetmiyor**; uyarı yazıp İşlem Doğrulama Servisi'ne soruyor. Gerekçe: hash
formülündeki `CURRENCY_CODE`'un yanıtta gelip gelmediği ölçülmedi (§1.3,
§12/1); tek dayanak yapılsaydı formül tutmadığı anda **gerçek ödemeler de**
reddedilirdi. Sorgu ise müşterinin ulaşamadığı bir kanaldan geliyor ve
sahtelenemiyor — karar oradan veriliyor.

Reddedilen durumlar: üye işyeri numarası bizimki değilse (sorgu bile
yapılmaz), sorguda karşılık yoksa, `STATUS ≠ SUCCESS` ise (`NEW` dahil, §8.1),
tutar okunamıyorsa, ya da tarayıcının getirdiği `AUTHORIZATION_AMOUNT`
sorgunun söylediğinden farklıysa.

### 14.5 İade — `TRX_DATE` sipariş satırında olmadığı için aranıyor

İptal/iade servisi işlemin tarihini zorunlu tutuyor ve sipariş şemasında öyle
bir kolon yok (§11.1). Bu yüzden `refund()` önce **Raporlama Servisi**'yle
(§2.1) `referenceCode` üzerinden işlemi buluyor; tarihi de tutarı da oradan
okuyor. Servis tek sorguda bir aydan uzun aralık kabul etmediği için arama
aylık pencerelerle en fazla 13 ay geriye gidiyor.

İşlem bulunamazsa ya da POS `responseCode ≠ 2` dönerse metot **fırlatıyor**,
`status: "failed"` dönmüyor: admin eylemi yalnızca fırlatılan hatayı
yakalıyor; dönmek, "iade edildi" yazan ama parayı göndermemiş bir kayıt
üretirdi.

### 14.6 Açık kalan iş kalemleri

1. **`form-action` CSP'si.** `next.config.ts` `form-action 'self'` gönderiyor;
   ara sayfanın POS'a POST'u tarayıcıda **engellenir**. Politikaya
   `https://paynkolay.nkolayislem.com.tr` ve
   `https://paynkolaytest.nkolayislem.com.tr` eklenmeden PayNkolay canlıya
   alınamaz.
2. **Mutabakat işi.** Webhook olmadığı için (§4) terk edilen ödemeleri ancak
   biz sorarak öğreniriz: `pending` siparişleri periyodik olarak §2 servisiyle
   sorgulayan bir job gerekiyor.
3. **`TRX_DATE` ve `REFERENCE_CODE` kolonları.** Sipariş satırına yazılırsa
   §14.5'teki geriye arama tamamen kalkar.
