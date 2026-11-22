# Ön yüz ↔ arka yüz sınırı

> **Ne için:** Müşteri arayüzü baştan yeniden tasarlanacak. Bu belge, o işin
> arka yüze - veritabanına, ödemeye, siparişe, kimliğe ve **sahadaki mobil
> uygulamaya** (`RiosenBeq/lafmobil`) - dokunmadan yapılabilmesi için sınırı
> çizer. Kısa özeti `CLAUDE.md` → "Ön yüz ↔ arka yüz sınırı"nda.
>
> **Tek cümle:** Ön yüz işi *nasıl göründüğünü* değiştirir; *ne gönderdiğini,
> neyi okuduğunu ve nereye gittiğini* değiştirmez.
>
> **21 Kas 2026.** Son yeniden tasarım bu sınırla yapıldı: eski görünüm
> silindi, site Blue Bottle'ın dilinde, anasayfa bir filmle açılır
> (`CLAUDE.md` "Site görünümü", değerler ve kurallar `docs/BRAND.md` §0).
> §1'in arka yüz listesindeki hiçbir dosya değişmedi; §2'deki alan adları,
> §3'teki sepet biçimi ve §5'teki yönlendirmeler aynı kaldı.
>
> **Testler (16 Kas 2026).** `tests/` klasörü kaldırıldı; bu belgenin
> sözleşmesini tutan testler (`frontend-form-contract`, `checkout-consent`,
> `site-data-cache`, `public-pages-cached-reads`) ve token'ları tutan
> `contrast` ile `brand-theme` artık koşmuyor. Sözleşme bu belgeyle, elle ve
> kod incelemesiyle korunur; eski testler `git show 5d777bb:tests/<dosya>`
> ile okunur. Aşağıda kalan test adları tarihçedir.

---

## 1. Hangi dosya hangi tarafta

### Ön yüz - yeniden tasarımda serbestçe değişir

| Yol                                              | Not                                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/components/laffogato/**`                    | Müşteri SPA'sı. Form içeren dosyalar için §2'ye bak (`ui.tsx`, `karaoke-booking.tsx`, `newsletter-form.tsx`; footer'daki bülten formu `chrome.tsx`'in çizdiği `newsletter-form.tsx`'tir) |
| `src/components/uye/**`, `src/components/customer/**` | Üye hesabı parçaları                                                               |
| `src/styles/**`                                  | Sitenin bütün kuralları, alan alan (21 Kas 2026): `foundation.css` (`:root` token'ları, temel, `.t-*` yazı sınıfları, `.btn` ve diğer kontroller, yerleşim, medya, hukuki asgari ölçüler), `chrome.css`, `sections.css`, `home.css`, `catalog.css`, `pages.css`, `karaoke.css`, `checkout.css`, `account.css`. Değerler ve kurallar `docs/BRAND.md` §0 ve §8; aşağıdaki "Hukuki asgariler" tasarımla değişmez |
| `src/app/globals.css`                            | Yalnız içe aktarım (Tailwind, sonra `src/styles/*.css` sayfa sırasıyla), panelin geri alma kuralları (`[data-admin-root]`) ve baskı kuralları. Site kuralı ve token buraya yazılmaz; panel ve baskı kuralları olduğu gibi kalır |
| Müşteri `page.tsx` / `layout.tsx` / `*-form.tsx` | **İşaretleme** serbest; veri çağrıları ve form alanları değil (§2, §4)                  |
| `public/**`                                      | Görseller, ikonlar                                                                      |

#### Hukuki asgariler - görünümle değişmez

Yeni bir görünüm bunları olduğu gibi taşır. CSS'tekiler
`src/styles/foundation.css`'te durur:

- Ön bilgilendirme ve sözleşme metinleri en az 16px (MSY m.6/1, 12 punto):
  `.checkout-consent label`, `.checkout-consent-note`, `.legal-section p`,
  `.legal-bullets li`, `.legal-ordered li`, `.karaoke-preinfo`.
- Her form alanı 16px ya da büyük (iOS Safari küçük alana odaklanınca
  yakınlaşır).
- Karar vermiş ziyaretçide çerez kartı hidrasyondan önce gizlenir:
  `html[data-consent="set"] .cookie-banner[data-pending]` (özniteliği
  `src/lib/consent/script.ts`'in `CONSENT_SEEN` betiği yazar).

İşaretlemedekiler: üstü çizili fiyat yalnız indirimin günlerini yazan
satırla birlikte çizilir (Ticari Reklam Yön. m.14/1); menünün fiyat notu
(Fiyat Etiketi Yön. m.5/2) ve footer'daki şirket satırları (ETHS Yön. m.5/1,
6563 m.3/1) kalır.

### Arka yüz - ön yüz PR'ında değişmez

| Yol                                   | Neden                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/lib/**`                          | Veri, fiyat, stok, ödeme, kimlik, e-posta, hukuk, mobil iş mantığı                           |
| `src/app/**/actions.ts`               | Server action'lar (`"use server"`) - her `export` herkese açık bir POST ucu                  |
| `src/app/**/route.ts`                 | API, webhook, cron, `/odeme/donus`, `/odeme/paynkolay`, `/gorsel/**`, `/api/bulten/cikis`   |
| `src/app/api/mobile/v1/**`            | **Mobil uygulamanın sözleşmesi** - sahadaki sürümler buna bağlı (`docs/API-MOBILE.md`)       |
| `src/proxy.ts`                        | Admin koruması + Supabase oturum yenileme                                                   |
| `db/**`, `scripts/**`                 | Migration'lar, şema paketi                                                                  |
| `next.config.ts`, `vercel.json`       | Güvenlik başlıkları, cron'lar (16 Kas 2026'ya kadar `tests/security-headers.test.ts` ve `tests/vercel-crons.test.ts` tutuyordu) |
| `.github/workflows/**`                | CI ve saatlik kampanya tetikleyicisi                                                        |
| `docs/API-MOBILE.md`                  | İki depoda bayt bayt aynı; `lafmobil` tarafında SHA-256 ile kilitli                          |
| `src/app/admin/**`                    | Yönetim paneli ayrı bir yüzey; müşteri yeniden tasarımının kapsamı dışında                  |

Ön yüz işi sırasında bu listedeki bir dosyaya dokunmak **gerekiyorsa**, o
değişiklik ayrı bir PR'dır ve kendi doğrulamasıyla gelir. "Tasarımı oturtmak için
action'daki alan adını değiştirdim" kabul edilen bir gerekçe değildir - formu
action'a uydur, tersini değil.

---

## 2. Form sözleşmesi - alan adları

Server action girdisini **ada göre** okur (`formData.get("legalConsent")`),
form onu `<input name="legalConsent">` ile verir. TypeScript bu bağı görmez,
build görmez; bir alanın adı değişir ya da gizli bir input düşerse site
sorunsuz derlenir ve:

- ödeme adımındaki onay kutusu hiç `"on"` gelmez → **her sipariş reddedilir**
  (`/odeme?error=consent`);
- kayıt formunda `acceptedTerms` gelmez → kimse üye olamaz;
- `items` gizli alanı düşer → sepet boş sayılır (`/?cart=empty`).

Bu yüzden bağ aşağıdaki tabloda yazılı. Her satır "bu action şu alanları
okur, şu dosyadaki form onları gönderir" der. 16 Kas 2026'ya kadar
`tests/frontend-form-contract.test.ts` tutuyordu; test koşmadığı için tablo
elle korunur: formu yeniden yazan iş, her `name`'i ve gizli alanı bu tabloyla
ve action'ın `formData.get(...)` çağrılarıyla karşılaştırır.

| Action                                          | Form dosyası                                          | Alanlar                                                                          |
| ----------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| `startCheckoutAction` (16 Eki 2026'dan beri) | `src/app/odeme/checkout.tsx` (sipariş formu, kart YOK) | `items` (JSON), `legalConsent`, `customerName`, `customerPhone`, `shippingAddress`, `promoCode`, `reuseOrderId`, `reuseData`, `reuseSignature`, `reuseCartKey` |
| `previewPromoAction` | `src/app/odeme/checkout.tsx` | `code`, `subtotal` |
| `POST /odeme/paynkolay` (yerli form, action değil) | `src/app/odeme/card-payment.tsx` | `d`, `s`, `return=checkout`, `cardChoice`, `saveCard`, `cardAlias` + `CARD_FORM_FIELDS` |
| `registerAction`                                | `src/app/uye/kayit/register-form.tsx`                 | `email`, `name`, `phone`, `password`, `passwordConfirm`, `acceptedTerms`, `marketing`, `newsletter` |
| `loginAction`                                   | `src/app/uye/giris/login-form.tsx`                    | `email`, `password`, `next` (gizli; sayfa `?next=` ile açıldıysa - ödemeye/karaoke'ye geri döner) |
| `requestPasswordResetAction`                    | `src/app/uye/sifremi-unuttum/forgot-form.tsx`         | `email`                                                                          |
| `resetPasswordAction`                           | `src/app/uye/sifre-sifirla/reset-form.tsx`            | `token`, `password`, `passwordConfirm`                                           |
| `updateProfileAction`                           | `src/app/uye/hesap/profile-form.tsx`                  | `name`, `phone`, `birthday`                                                      |
| `changePasswordAction`                          | `src/app/uye/hesap/sifre/password-form.tsx`           | `currentPassword`, `newPassword`, `newPasswordConfirm`                           |
| `createAddressAction` / `updateAddressAction`   | `src/app/uye/hesap/adreslerim/address-form.tsx`       | `label`, `recipientName`, `phone`, `line1`, `line2`, `district`, `city`, `zip`, `isDefault` |
| `deleteAddressAction` / `setDefaultAddressAction` | `src/app/uye/hesap/adreslerim/page.tsx`             | `addressId`                                                                      |
| `deleteAccountSavedCardAction`                    | `src/app/uye/hesap/kartlarim/saved-card-list.tsx`   | `tranId`                                                                         |
| `toggleWishlistAction`                          | `src/components/laffogato/ui.tsx`, `…/favorilerim/page.tsx` | `productId`, `back` (yalnız site içi yol; dışarısı yok sayılır)            |
| `updateNotificationsAction`                     | `src/app/uye/hesap/bildirimler/notifications-form.tsx` | `orderUpdates`, `marketing`, `newsletter`                                       |
| `requestAccountDeletionAction` (18 Eki 2026'dan beri; site artık hesabı kendisi silmez, ekibe talep gider) | `src/app/uye/hesap/sil/deletion-request-form.tsx` | `reason` (isteğe bağlı, 500 karakter), `confirm` (işaretsiz başlar) |
| `withdrawAccountDeletionAction`                 | `src/components/uye/deletion-request-notice.tsx`      | alan yok (oturumdaki üyenin açık talebi)                                         |
| `bookKaraokeAction`                             | `src/components/laffogato/karaoke-booking.tsx`        | `date`, `startHour`, `hours`, `guests`, `note`, `contactName`, `contactEmail`, `contactPhone`, `guestFirstName`, `guestLastName`, `consentPreInfo`, `consentContract`, `consentKvkk` (üç kutu ayrı ve işaretsiz), `expectedFreeCancelHours`, `expectedLateRefundPercent` (kutunun yazdığı kural, sunucudan). Adımlı sihirbaz (18 Eki 2026) hydrate sonrası çizilir: sunucunun çizdiği sayfa bu alanların hepsiyle tek formdur; adres yalnız `?adim=` taşır, yazılanlar yalnız bu sekmede `sessionStorage["laffogato_karaoke_draft_v1"]`'de durur (kutular hiç), gönderince silinir |
| `subscribeNewsletterAction`                     | `src/components/laffogato/newsletter-form.tsx`        | `email`, `consent`                                                               |
| `confirmNewsletterAction`                       | `src/app/bulten/onay/page.tsx`                        | `token` (gizli) - bülten onayı bir **düğme**dir, bağlantı değil                   |
| `unsubscribeNewsletterAction`                   | `src/app/bulten/cikis/page.tsx`                       | `token` (gizli) - çıkış da düğmeyle; sayfa GET'te hiçbir şey harcamaz            |

**Bülten sayfalarında bağlantıyı "tek tık"a geri çevirme.** E-posta güvenlik
tarayıcıları (Outlook Safe Links, Gmail ön-getirme) iletideki her bağlantıyı
açar: GET'te abone eden bir onay sayfası tarayıcının ziyaretini "rıza"ya, GET'te
çıkaran bir sayfa da aboneliği robotun kararına çevirir (6563, `docs/AUDIT.md`
§8). Sayfa yalnız düğmeyi gösterir; posta istemcisinin kendi tek tık düğmesi
(RFC 8058, `/api/bulten/cikis`) sayfasız çalışmaya devam eder.

**Formu başka bir dosyaya taşıdıysan** tablodaki "Form dosyası" sütununu
güncelle - alan listesine dokunmadan. Alan listesi yalnız action değiştiğinde
değişir; o da ayrı bir arka yüz PR'ıdır.

### `items` - sepetin sunucuya gidiş biçimi

```json
[{ "productId": "prd-0001", "variantId": "v-250g", "name": "…", "price": 245, "qty": 2 }]
```

`price` **lira** cinsindendir ve yalnız gösterim içindir: sunucu her satırı
veritabanı fiyatından yeniden hesaplar (`resolveOrderLines`), istemcinin
fiyatı yalnız "fiyat güncellendi" uyarısını tetikler. Tutarı ön yüzde
hesaplayıp sunucuya "bu kadar al" diye göndermek **yoktur** (Güvenlik kuralı 6).

### Onay kutuları ön işaretli olamaz

Ödemenin iki belge kutusu (`consentPreInfo`, `consentContract`; mesafeli
satış, kural 12), `acceptedTerms`, `marketing`, `newsletter`, bülten
`consent`'i (6563, kural 19) ve Google ile gelen yeni üyenin onay sayfasındaki
kutular **işaretsiz başlar**. `legalConsent` artık kutu değil, gizli bir
alandır: yalnız iki belge kutusu da işaretlenince çizilir
(`checkout-consent.tsx`). Kutu sabit olarak işaretli yazılmaz:
`defaultChecked`, `defaultChecked={true}` ya da çıplak `checked` yoktur.
İşaretsiz başlayan bir durumdan okunan `checked={ticks.x}` (ödemenin iki
kutusu `NO_CHECKOUT_CONSENT`'ten başlar; karaokenin üç kutusu da öyle) ve
başarısız bir gönderimden sonra ziyaretçinin kendi seçimini geri yazan
`defaultChecked={values.x}` serbesttir. 16 Kas 2026'ya kadar
`tests/checkout-consent.test.ts` ve `tests/frontend-form-contract.test.ts`
tutuyordu; artık kod incelemesi tutar.

---

## 3. Sepet ve tarayıcı durumu

| Ne                     | Değer                                     | Kim okur/yazar                                                                  |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------------- |
| Sepet anahtarı         | `localStorage["laffogato_cart_v1"]`       | `app.tsx`, `product-detail.tsx`, `site-chrome.tsx`, `odeme/checkout.tsx`, `odeme/basarili/clear-cart.tsx` |
| Sepet temizleme        | `/odeme/basarili` içindeki `<ClearCart>`  | Server action client state'e dönemez; temizlik başarı sayfasında olur          |
| Çerez rızası           | `src/lib/consent/cookie.ts`               | `cookie-consent.tsx` - Consent Mode v2 sinyalleri buradan                       |

Anahtarın adını değiştirmek sahadaki her ziyaretçinin sepetini sessizce
boşaltır. Değişmesi gerekiyorsa eskiyi okuyup yeniye taşıyan bir geçiş yaz.

Görünüm için saklanan biçime alan eklenmez: 21 Kas 2026'dan beri sepet
çekmecesi her satırın fotoğrafını o an elindeki ürün listesinden `productId`
ile bulur (`ui.tsx` `CartDrawer`, `app.tsx` `products`); saklanan sepet ve
sunucuya giden `items` değişmedi.

---

## 4. Veri okuma - sayfalar arka yüzden ne alır

- Müşteri sayfaları veriyi **`loadAppProps()`** (`src/lib/seo/app-props.ts`) ya
  da `src/lib/seo/site-data.ts`'in önbellekli sunum okuyucularından
  (`getSiteSettings`, `listSite*`, `getSiteProductBySlug`, ...) alır; bunlar
  Data Cache'ten okur, sayfa görüntülemesi veritabanını uyandırmaz
  (`docs/DATABASE.md` "Uyanmalar ve önbellek"). Yeni bir sayfa yeni bir
  sorgu yazmaz; var olan okuyucuyu çağırır. Ürün listesini kendisi okuyan
  bir sayfa, bütün okumaları bittikten sonra onu `shopForRequest()`'ten
  geçirir: kesintiyi gören istek (giriş yapmış üye) boş mağaza gösterir.
  Ödeme, karaoke ve rezervasyon sayfaları önbellekli okuyucuyu kullanmaz
  (listeyi 16 Kas 2026'ya kadar `tests/site-data-cache.test.ts` tutuyordu).
- **Sunumda `getSettings()` değil `getSiteSettings()`.** Birincisi veritabanı
  yoksa fırlatır (ticari yollar için doğru davranış), ikincisi önbellekten ya
  da paketteki içerikle ayakta kalır (`CLAUDE.md` → "Veritabanı Kesintisinde
  Davranış"). `getPublicSettings()` ve `store.ts`'in `list*` okuyucuları da
  aynı yedeğe düşer ama her seferinde veritabanını okur: ödeme, karaoke ve
  uygulama API'si gibi canlı okuması gereken yollar içindir. Genel bir
  sayfa, kabuk ya da müşteri bileşeni onları import etmez (üyenin kendi
  sayfaları, `/uye/hesap/**`, kapsam dışı; 16 Kas 2026'ya kadar
  `tests/public-pages-cached-reads.test.ts` reddediyordu, artık kod
  incelemesi).
- Bileşenler ve sayfalar **`@/lib/db`'yi doğrudan import etmez.**
- İstemci bileşeni (`"use client"`) `import "server-only"` taşıyan bir modülü
  import edemez - build kırılır. Saf mantık gerekiyorsa `*-core.ts` /
  `*-utils.ts` kardeşini kullan (`karaoke-core.ts`, `coupon-utils.ts`,
  `loyalty-core.ts`).
- Fiyat gösterimi `priceLabel()` / `formatTRY()` üzerinden; tüm tutarlar
  kuruş (`priceMinor`).
- JSON-LD yalnız `<JsonLd>` ile (kural 16). Ham `dangerouslySetInnerHTML` yok.
- `layout.tsx`'te `consent-bootstrap` betiği GTM'den **önce** kalır (kural 18).

---

## 5. Sunucunun gönderdiği yönlendirmeler - sayfalar karşılamalı

Action'lar sonucu URL'le bildirir. Yeniden tasarlanan sayfa bu parametreleri
okumaya devam etmezse müşteri "hiçbir şey olmadı" ekranında kalır.

| Yönlendirme                                           | Kaynak                          | Karşılayan                        |
| ----------------------------------------------------- | ------------------------------- | --------------------------------- |
| `/?cart=empty`, `out_of_stock`, `qty_too_high`, `shop_closed`, `not_found` | Eski `placeOrderAction` (16 Eki 2026'dan beri checkout bunları sayfada, `startCheckoutAction`'ın `error.code === "cart"` yanıtıyla gösterir) | `src/app/page.tsx` bildirimi (eski bağlantılar için duruyor) |
| `/odeme?error=consent` | Eski bağlantılar (checkout onayı sayfada ister) | `src/lib/checkout/return-codes.ts` (`readCheckoutReturn`) |
| `/odeme?error=payment` | POS `failureUrl`, `/odeme/donus` | `src/lib/checkout/return-codes.ts` |
| `/odeme?odeme=<kod>[&alan=][&dk=]` | `/odeme/paynkolay` (`return=checkout`) | `src/lib/checkout/return-codes.ts` - yalnız sabit kodlar |
| `/odeme?verify=required` | `startCheckoutAction` | Sayfa doğrulama panelini üyenin durumundan zaten gösterir; parametre bilgi amaçlı |
| `/uye/giris?next=/odeme` | `startCheckoutAction`, `/odeme` kapısı | `src/app/uye/giris/page.tsx` |
| `/?hesap=silindi\|kapatildi`                          | Eski `deleteAccountAction` (18 Eki 2026'da kaldırıldı; site artık talep alır) | ana sayfa (`accountClosureNotice`, eski bağlantılar için duruyor): `silindi` yalnız Supabase giriş kimliği de silindiyse |
| `/bulten/onay?sonuc=tamam\|gecersiz\|hata`             | `confirmNewsletterAction`       | `src/app/bulten/onay/page.tsx`    |
| `/bulten/cikis?sonuc=tamam&adres=…`, `?sonuc=gecersiz\|hata` | `unsubscribeNewsletterAction` | `src/app/bulten/cikis/page.tsx` (`adres` maskeli: `a***@alan.com`) |

`?cart=` gerekçelerinin, her `/odeme?error=` nedeninin, `?hesap=` değerlerinin
ve girişteki `?next=` taşımasının karşılandığını yeniden tasarlanan sayfada
elle dene (16 Kas 2026'ya kadar `tests/frontend-form-contract.test.ts`
doğruluyordu).

---

## 6. Dışarıdan çağrılan yollar - adı değişmez

Bu URL'lere site dışından gelinir: gönderilmiş e-postalar, sanal POS, mobil
uygulama, arama motoru. Yeniden adlandırmak geri alınamaz şekilde kırar.

| Yol                                                     | Kim çağırır                                                |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| `/api/mobile/v1/**`                                     | `lafmobil` (sahadaki tüm sürümler)                         |
| `/odeme/donus`                                          | PayNkolay form-POST'u (`PAYNKOLAY_SUCCESS_URL` / `_FAIL_URL`) |
| `/odeme/paynkolay`, `/odeme/app-hata`                   | Ödeme akışı, uygulama derin bağlantısı                     |
| `/api/webhooks/payment`, `/api/webhooks/geliver`        | Ödeme sağlayıcısı, kargo                                   |
| `/api/cron/**`                                          | Vercel cron + GitHub Actions (`campaign-hourly.yml`)       |
| `/bulten/cikis`, `/api/bulten/cikis`                    | Her ticari e-postadaki tek tıkla çıkış                     |
| `/bulten/onay?token=`                                   | Bülten onay e-postası (çift onay, 7 gün geçerli)           |
| `/uye/sifre-sifirla?token=`, `/uye/dogrula?token=`      | Parola sıfırlama ve e-posta doğrulama e-postaları          |
| `/uye/hesap/siparislerim/[orderNo]`, `/uye/hesap/sil`   | İşlemsel e-postalar, uygulama, hukuki metinler; `/uye/hesap/sil` aynı zamanda Google Play'in web silme talebi sayfası (oturumsuz ziyaretçiye başvuru kanallarını gösterir) |
| `/hukuk/[slug]`                                         | E-postalar, uygulama (`GET /legal`), sözleşme metinleri    |
| `/gorsel/**`                                            | Uygulamanın ürün/menü görselleri (`image` alanı)           |
| `/magaza/urun/[slug]`, `/menu`, `/magaza`, `/rehber/**` | Arama motoru, sitemap, paylaşılan bağlantılar              |
| `/masa/[code]`                                          | Masalardaki basılı QR kartları (laminasyon - geri çağrılamaz); 5 Kas 2026'dan beri iOS evrensel bağlantısı (AASA `/masa/*`, `src/lib/mobile/app-links.ts`): uygulaması kurulu iPhone'da uygulama o masayla açılır. `noindex`, sitemap'te yok |

---

## 7. Ön yüz PR'ı bitmeden

```bash
npm run typecheck
npm run lint -- --max-warnings=0
NODE_ENV=production npm run build # ortamda NODE_ENV=development varsa build düşer
git diff --stat origin/main -- src/lib src/app/api db scripts src/proxy.ts 'src/app/**/actions.ts' 'src/app/**/route.ts'
```

Son komut **boş** dönmeli. Dönmüyorsa o değişiklik ön yüz PR'ının parçası
değildir: geri al ya da ayrı PR yap.

`npm test` yok: `tests/` 16 Kas 2026'da kaldırıldı, CI yalnız typecheck,
lint ve build koşar. Tek istisna kayıtlı kart: `/odeme`'nin kart alanına
(`card-payment.tsx`) ya da `/uye/hesap/kartlarim`'e dokunan iş
`npm run test:saved-cards`'ı yerel Postgres'e karşı koşar
(`tests/saved-cards/README.md`; CI'da değil). §2'nin tablosu, kutuların
işaretsiz başlaması ve §5'in yönlendirmeleri elle karşılaştırılır.

Ardından değişen sayfaları gerçekten render edip bak (CLAUDE.md → "Görsel
değişiklik yaptıysan"; 360, 768, 1024 ve 1280px ile geniş ekran,
`docs/BRAND.md` §8), en az bir kez uçtan uca: ürün → sepet → ödeme adımı
(onay kutusu işaretsiz başlıyor mu, işaretlenince sipariş geçiyor mu) → üye
girişi → favori ekle/çıkar.
