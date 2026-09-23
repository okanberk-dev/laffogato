# Ön yüz ↔ arka yüz sınırı

> **Ne için:** Müşteri arayüzü baştan yeniden tasarlanacak. Bu belge, o işin
> arka yüze — veritabanına, ödemeye, siparişe, kimliğe ve **sahadaki mobil
> uygulamaya** (`RiosenBeq/lafmobil`) — dokunmadan yapılabilmesi için sınırı
> çizer. Kısa özeti `CLAUDE.md` → "Ön yüz ↔ arka yüz sınırı"nda.
>
> **Tek cümle:** Ön yüz işi *nasıl göründüğünü* değiştirir; *ne gönderdiğini,
> neyi okuduğunu ve nereye gittiğini* değiştirmez.

---

## 1. Hangi dosya hangi tarafta

### Ön yüz — yeniden tasarımda serbestçe değişir

| Yol                                              | Not                                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/components/laffogato/**`                    | Müşteri SPA'sı. Form içeren dosyalar için §2'ye bak (`ui.tsx`, `karaoke-booking.tsx`, `newsletter-form.tsx`) |
| `src/components/uye/**`, `src/components/customer/**` | Üye hesabı parçaları                                                               |
| `src/app/globals.css`                            | Token'lar `tests/contrast.test.ts` ve `tests/brand-theme.test.ts`'e bağlı               |
| Müşteri `page.tsx` / `layout.tsx` / `*-form.tsx` | **İşaretleme** serbest; veri çağrıları ve form alanları değil (§2, §4)                  |
| `public/**`                                      | Görseller, ikonlar                                                                      |

### Arka yüz — ön yüz PR'ında değişmez

| Yol                                   | Neden                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/lib/**`                          | Veri, fiyat, stok, ödeme, kimlik, e-posta, hukuk, mobil iş mantığı                           |
| `src/app/**/actions.ts`               | Server action'lar (`"use server"`) — her `export` herkese açık bir POST ucu                  |
| `src/app/**/route.ts`                 | API, webhook, cron, `/odeme/donus`, `/odeme/paynkolay`, `/gorsel/**`, `/bulten/cikis`       |
| `src/app/api/mobile/v1/**`            | **Mobil uygulamanın sözleşmesi** — sahadaki sürümler buna bağlı (`docs/API-MOBILE.md`)       |
| `src/proxy.ts`                        | Admin koruması + Supabase oturum yenileme                                                   |
| `db/**`, `scripts/**`                 | Migration'lar, şema paketi                                                                  |
| `next.config.ts`, `vercel.json`       | Güvenlik başlıkları (`tests/security-headers.test.ts`), cron'lar (`tests/vercel-crons.test.ts`) |
| `.github/workflows/**`                | CI ve saatlik kampanya tetikleyicisi                                                        |
| `docs/API-MOBILE.md`                  | İki depoda bayt bayt aynı; `lafmobil` tarafında SHA-256 ile kilitli                          |
| `src/app/admin/**`                    | Yönetim paneli ayrı bir yüzey; müşteri yeniden tasarımının kapsamı dışında                  |

Ön yüz işi sırasında bu listedeki bir dosyaya dokunmak **gerekiyorsa**, o
değişiklik ayrı bir PR'dır ve kendi testiyle gelir. "Tasarımı oturtmak için
action'daki alan adını değiştirdim" kabul edilen bir gerekçe değildir — formu
action'a uydur, tersini değil.

---

## 2. Form sözleşmesi — alan adları

Server action girdisini **ada göre** okur (`formData.get("legalConsent")`),
form onu `<input name="legalConsent">` ile verir. TypeScript bu bağı görmez,
build görmez; bir alanın adı değişir ya da gizli bir input düşerse site
sorunsuz derlenir ve:

- ödeme adımındaki onay kutusu hiç `"on"` gelmez → **her sipariş reddedilir**
  (`/odeme?error=consent`);
- kayıt formunda `acceptedTerms` gelmez → kimse üye olamaz;
- `items` gizli alanı düşer → sepet boş sayılır (`/?cart=empty`).

Bu yüzden bağ bir testte yazılı: **`tests/frontend-form-contract.test.ts`**.
Her satır "bu action şu alanları okur, şu dosyadaki form onları gönderir" der.

| Action                                          | Form dosyası                                          | Alanlar                                                                          |
| ----------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| `placeOrderAction`                              | `src/app/odeme/checkout-wizard.tsx`                   | `items` (JSON), `legalConsent`, `customerName`, `customerPhone`, `shippingAddress`, `promoCode` |
| `previewPromoAction`                            | `src/app/odeme/checkout-wizard.tsx`                   | `code`, `subtotal`                                                               |
| `registerAction`                                | `src/app/uye/kayit/register-form.tsx`                 | `email`, `name`, `phone`, `password`, `passwordConfirm`, `acceptedTerms`, `marketing`, `newsletter` |
| `loginAction`                                   | `src/app/uye/giris/login-form.tsx`                    | `email`, `password`, `next` (gizli; sayfa `?next=` ile açıldıysa — ödemeye/karaoke'ye geri döner) |
| `requestPasswordResetAction`                    | `src/app/uye/sifremi-unuttum/forgot-form.tsx`         | `email`                                                                          |
| `resetPasswordAction`                           | `src/app/uye/sifre-sifirla/reset-form.tsx`            | `token`, `password`, `passwordConfirm`                                           |
| `updateProfileAction`                           | `src/app/uye/hesap/profile-form.tsx`                  | `name`, `phone`, `birthday`                                                      |
| `changePasswordAction`                          | `src/app/uye/hesap/sifre/password-form.tsx`           | `currentPassword`, `newPassword`, `newPasswordConfirm`                           |
| `createAddressAction` / `updateAddressAction`   | `src/app/uye/hesap/adreslerim/address-form.tsx`       | `label`, `recipientName`, `phone`, `line1`, `line2`, `district`, `city`, `zip`, `isDefault` |
| `deleteAddressAction` / `setDefaultAddressAction` | `src/app/uye/hesap/adreslerim/page.tsx`             | `addressId`                                                                      |
| `toggleWishlistAction`                          | `src/components/laffogato/ui.tsx`, `…/favorilerim/page.tsx` | `productId`, `back` (yalnız site içi yol; dışarısı yok sayılır)            |
| `updateNotificationsAction`                     | `src/app/uye/hesap/bildirimler/notifications-form.tsx` | `orderUpdates`, `marketing`, `newsletter`                                       |
| `deleteAccountAction`                           | `src/app/uye/hesap/sil/delete-account-form.tsx`       | `confirmEmail`, `password`                                                       |
| `bookKaraokeAction`                             | `src/components/laffogato/karaoke-booking.tsx`        | `date`, `startHour`, `hours`, `guests`, `note`                                   |
| `subscribeNewsletterAction`                     | `src/components/laffogato/newsletter-form.tsx`        | `email`, `consent`                                                               |

**Formu başka bir dosyaya taşıdıysan** testteki `forms` yolunu güncelle — alan
listesine dokunmadan. Alan listesi yalnız action değiştiğinde değişir; o da
ayrı bir arka yüz PR'ıdır.

### `items` — sepetin sunucuya gidiş biçimi

```json
[{ "productId": "prd-0001", "variantId": "v-250g", "name": "…", "price": 245, "qty": 2 }]
```

`price` **lira** cinsindendir ve yalnız gösterim içindir: sunucu her satırı
veritabanı fiyatından yeniden hesaplar (`resolveOrderLines`), istemcinin
fiyatı yalnız "fiyat güncellendi" uyarısını tetikler. Tutarı ön yüzde
hesaplayıp sunucuya "bu kadar al" diye göndermek **yoktur** (Güvenlik kuralı 6).

### Onay kutuları ön işaretli olamaz

`legalConsent` (mesafeli satış, kural 12), `acceptedTerms`, `marketing`,
`newsletter` ve bülten `consent`'i (6563, kural 19) **işaretsiz başlar**. Aynı
test bunu da tutar: `defaultChecked`, `defaultChecked={true}` ve `checked`
reddedilir; başarısız bir gönderimden sonra ziyaretçinin kendi seçimini geri
yazan `defaultChecked={values.x}` serbesttir.

---

## 3. Sepet ve tarayıcı durumu

| Ne                     | Değer                                     | Kim okur/yazar                                                                  |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------------- |
| Sepet anahtarı         | `localStorage["laffogato_cart_v1"]`       | `app.tsx`, `product-detail.tsx`, `site-chrome.tsx`, `checkout-wizard.tsx`, `odeme/basarili/clear-cart.tsx` |
| Sepet temizleme        | `/odeme/basarili` içindeki `<ClearCart>`  | Server action client state'e dönemez; temizlik başarı sayfasında olur          |
| Çerez rızası           | `src/lib/consent/cookie.ts`               | `cookie-consent.tsx` — Consent Mode v2 sinyalleri buradan                       |

Anahtarın adını değiştirmek sahadaki her ziyaretçinin sepetini sessizce
boşaltır. Değişmesi gerekiyorsa eskiyi okuyup yeniye taşıyan bir geçiş yaz.

---

## 4. Veri okuma — sayfalar arka yüzden ne alır

- Müşteri sayfaları veriyi **`loadAppProps()`** (`src/lib/seo/app-props.ts`) ya
  da `src/lib/admin/store.ts`'in `list*` / `getPublicSettings()` okuyucularından
  alır. Yeni bir sayfa yeni bir sorgu yazmaz; var olan okuyucuyu çağırır.
- **Sunumda `getSettings()` değil `getPublicSettings()`.** Birincisi veritabanı
  yoksa fırlatır (ticari yollar için doğru davranış), ikincisi paketteki
  içerikle ayakta kalır (`CLAUDE.md` → "Veritabanı Kesintisinde Davranış").
- Bileşenler ve sayfalar **`@/lib/db`'yi doğrudan import etmez.**
- İstemci bileşeni (`"use client"`) `import "server-only"` taşıyan bir modülü
  import edemez — build kırılır. Saf mantık gerekiyorsa `*-core.ts` /
  `*-utils.ts` kardeşini kullan (`karaoke-core.ts`, `coupon-utils.ts`,
  `loyalty-core.ts`).
- Fiyat gösterimi `priceLabel()` / `formatTRY()` üzerinden; tüm tutarlar
  kuruş (`priceMinor`).
- JSON-LD yalnız `<JsonLd>` ile (kural 16). Ham `dangerouslySetInnerHTML` yok.
- `layout.tsx`'te `consent-bootstrap` betiği GTM'den **önce** kalır (kural 18).

---

## 5. Sunucunun gönderdiği yönlendirmeler — sayfalar karşılamalı

Action'lar sonucu URL'le bildirir. Yeniden tasarlanan sayfa bu parametreleri
okumaya devam etmezse müşteri "hiçbir şey olmadı" ekranında kalır.

| Yönlendirme                                           | Kaynak                          | Karşılayan                        |
| ----------------------------------------------------- | ------------------------------- | --------------------------------- |
| `/?cart=empty`                                        | `placeOrderAction`              | `src/app/page.tsx` bildirimi      |
| `/?cart=out_of_stock&item=…&available=…`              | `placeOrderAction`              | `src/app/page.tsx`                |
| `/?cart=qty_too_high&item=…&available=…`              | `placeOrderAction`              | `src/app/page.tsx`                |
| `/?cart=shop_closed`, `/?cart=not_found&item=…`       | `placeOrderAction`              | `src/app/page.tsx`                |
| `/odeme?error=consent`                                | `placeOrderAction`              | `src/app/odeme/page.tsx` (`CHECKOUT_NOTICES`) |
| `/odeme?error=payment`                                | POS `failureUrl`, `/odeme/donus`, `/odeme/paynkolay` | `src/app/odeme/page.tsx` (`CHECKOUT_NOTICES`) |
| `/odeme?verify=required`                              | `placeOrderAction`              | Sayfa doğrulama panelini üyenin durumundan zaten gösterir; parametre bilgi amaçlı |
| `/uye/giris?next=/odeme`                              | `placeOrderAction`              | `src/app/uye/giris/page.tsx`      |
| `/?hesap=silindi`                                     | `deleteAccountAction`           | ana sayfa                         |

`?cart=` gerekçelerinin, her `/odeme?error=` nedeninin, `?hesap=silindi`'nin
ve girişteki `?next=` taşımasının karşılandığını
`tests/frontend-form-contract.test.ts` doğrular.

---

## 6. Dışarıdan çağrılan yollar — adı değişmez

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
| `/uye/sifre-sifirla?token=`, `/uye/dogrula?token=`      | Parola sıfırlama ve e-posta doğrulama e-postaları          |
| `/uye/hesap/siparislerim/[orderNo]`, `/uye/hesap/sil`   | İşlemsel e-postalar, uygulama                              |
| `/hukuk/[slug]`                                         | E-postalar, uygulama (`GET /legal`), sözleşme metinleri    |
| `/gorsel/**`                                            | Uygulamanın ürün/menü görselleri (`image` alanı)           |
| `/magaza/urun/[slug]`, `/menu`, `/magaza`, `/rehber/**` | Arama motoru, sitemap, paylaşılan bağlantılar              |

---

## 7. Ön yüz PR'ı bitmeden

```bash
npm run typecheck
npm test                          # form sözleşmesi, kontrast, rota testleri dahil
npm run lint
NODE_ENV=production npm run build # ortamda NODE_ENV=development varsa build düşer
git diff --stat origin/main -- src/lib src/app/api db scripts src/proxy.ts 'src/app/**/actions.ts' 'src/app/**/route.ts'
```

Son komut **boş** dönmeli. Dönmüyorsa o değişiklik ön yüz PR'ının parçası
değildir: geri al ya da ayrı PR yap.

Ardından değişen sayfaları gerçekten render edip bak (CLAUDE.md → "Görsel
değişiklik yaptıysan"), en az bir kez uçtan uca: ürün → sepet → ödeme adımı
(onay kutusu işaretsiz başlıyor mu, işaretlenince sipariş geçiyor mu) → üye
girişi → favori ekle/çıkar.
