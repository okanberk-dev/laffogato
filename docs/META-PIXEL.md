# Meta Pixel ("LAF Pixel") - 25 Ekim 2026

> **Durum: kodda hazır, hukuki metinler TASLAK.** Dört belgenin metni (Çerez
> Politikası, KVKK Aydınlatma Metni, Gizlilik Politikası, Açık Rıza Metni)
> avukat okumasını bekliyor; sorular `docs/LEGAL-REDLINES-2026-09.md` §35.3'te.
> Birleştirmeden önce okuma isteniyorsa pikseli
> `NEXT_PUBLIC_META_PIXEL_ID=` (boş) ile kapalı tut: kod ve metinler yerinde
> kalır, hiçbir şey yüklenmez.

Amaç: karaoke rezervasyonlarını ölçmek ve Meta reklamlarını gerçek
rezervasyona göre optimize etmek; ikinci olarak mağaza siparişlerini ölçmek.

## 1. Kurallar

| Kural | Nerede tutulur |
|---|---|
| Piksel kimliği `NEXT_PUBLIC_META_PIXEL_ID`; tanımlı değilse `1433246991545596` ("LAF Pixel"); **boş değer pikseli kapatır** | `metaPixelId` (`src/lib/consent/meta-pixel.ts`) |
| Yalnızca `laffogato.net` ve `www.laffogato.net`; önizleme ve localhost'ta çalışmaz | `META_PIXEL_HOSTS`, `metaPixelHostAllowed` |
| Yalnızca pazarlama kategorisine **açık rıza** verildiyse yüklenir. Onay yokken Meta'ya hiçbir istek gitmez (betik de inmez) | `trackPixel` her çağrıda çerezi okur |
| Hukuki metinler pikseli anlatmıyorsa yüklenmez | `META_PIXEL_IN_LEGAL_TEXTS` (`src/lib/legal/meta.ts`) |
| `/admin` ve ödeme formu (`/odeme`, tam yol) hiç çalışmaz; `/odeme/basarili`, `/odeme/donus` dahil diğer `/odeme/*` sayfaları çalışır | `pixelDocumentAllowed`; kural `ConsentScripts` ile aynı, belgenin **yüklendiği** yola göre |
| `fbq('set','autoConfig',false,ID)` `init`'ten önce; otomatik PageView ve geçmiş değişikliği PageView'ü kapalı | `grantMetaPixel`, `installStub` |
| Olay parametrelerinde kişisel veri yok: yalnız `content_ids`, `content_name`, `content_type`, `contents`, `currency`, `value`, `num_items`; e-posta ya da telefon gibi görünen metin düşer | `sanitizePixelParams`, `PixelParams` tipi |
| Rıza geri alınınca `fbq('consent','revoke')` ve `_fbp` / `_fbc` silinir (üst alan adlarında da) | `revokeMetaPixel` |

## 2. Rıza altyapısı

- Çerez `laffogato_cookie_consent`, sürüm **2** (`CONSENT_VERSION`). Sürüm,
  sitenin çalıştırdığı etiketlerin şekline bağlıdır: `consentVersionFor(google,
  meta)` = 1 (etiket yok), 2 (Meta Pixel), 3 (Google), 4 (ikisi). Bir şekil
  başka bir şeklin numarasını **hiç** kullanmaz; böylece eski bir "evet" yeni
  bir etiketi açamaz. Bu PR'dan önce banta cevap veren herkese pazarlama
  kategorisi yeniden sorulur.
- Banner ve panel: pazarlama anahtarı piksel kimliği varken görünür, analitik
  anahtarı yalnız GTM varken (`consentCategories`). Piksel varken banner
  "sitede reklam çerezi yok" demez; Meta Pixel'i ve yurt dışı aktarımı adıyla
  söyler (`bannerSentence`, `marketingBody`).
- `pushConsentUpdate` kararı `laffogato:consent-updated` olayıyla `window`'a da
  yayar (gtag olmasa da). `<MetaPixel />` bu olayı dinler: evet gelince o
  sayfa için bir PageView, hayır gelince `revokeMetaPixel`.

## 3. Olaylar

Ortak: `content_type: "product"`, `currency: "TRY"`, `value` lira (KDV dahil).

| Olay | Ne zaman | value / num_items | eventID |
|---|---|---|---|
| `PageView` | her App Router rota değişikliği (yol ya da sorgu; karaoke sihirbazının `?adim=` adımı sayılmaz) ve onay verildiği an | - | - |
| `ViewContent` (karaoke) | `/karaoke` açıldığında | 1 saatlik liste ücreti / 1 | - |
| `AddToCart` (karaoke) | tarih + saat ilk kez seçilince (saat düğmesi ya da "Devam"), sayfa başına bir kez | o anki toplam (üye indirimi dahil) / saat | - |
| `InitiateCheckout` (karaoke) | "Rezervasyonu onayla ve X₺ öde" ile kayıt oluşunca, ödeme sayfasına gitmeden önce | kaydın `totalMinor`'u / saat | `checkout_<rezervasyonId>` |
| `Purchase` + `Schedule` (karaoke) | ödemesi doğrulanmış rezervasyonun sonuç sayfasında (`/rezervasyon?ref=..&odeme=basarili` ya da üyenin `/uye/hesap/karaoke/<id>?odeme=basarili`); sayfa yenilenince tekrar gitmez | bankanın tahsil ettiği (`paidMinor`) / saat; tutar 0 ise yalnız `Schedule` | `purchase_<rezervasyonKodu>` |
| `Contact` | herhangi bir `tel:` bağlantısına tıklanınca | - | - |
| `ViewContent` (mağaza) | ürün detay sayfası | birim fiyat / 1 | - |
| `AddToCart` (mağaza) | ürün kartı, hızlı bakış, ürün sayfası ("Sepete ekle", "Hemen satın al") ve ilgili ürünler | satırın tutarı / adet | - |
| `InitiateCheckout` (mağaza) | sepet çekmecesinde "Ödemeye geç" ve ürün sayfasında "Hemen satın al"; `/odeme`'ye tam sayfa yüklemesinden hemen önce | sepetin tutarı / adet | - |
| `Purchase` (mağaza) | `/odeme/basarili` sayfasında, ödemesi onaylanmış (`pending_payment` olmayan) siparişte; yenilenince tekrar gitmez | siparişin toplamı (kargo ve indirim dahil) | `purchase_<siparişNo>` |

Tekrar engeli: `fireOnce`, `localStorage["laffogato_meta_purchase_<kod>"]`
anahtarını **yalnız piksel olayı aldıysa** yazar.

Karaoke InitiateCheckout'un nasıl çalıştığı: ziyaretçi pazarlama izni verdiyse
`bookKaraokeAction` (`src/app/karaoke/actions.ts`) kartın sayfasına yönlendirmek
yerine `{ checkout: { id, valueMinor, hours, continueTo } }` döner; tarayıcı
önce olayı gönderir, sonra (300 ms) `continueTo`'ya gider. İzin yoksa eskisi
gibi `redirect` edilir; hata ve "tutar sıfır" yolları değişmedi.

## 4. Dosyalar

- `src/lib/consent/meta-pixel.ts`: yapılandırma, `trackPixel`, `fireOnce`,
  `revokeMetaPixel`, olay kurucuları (`karaokeParams`, `shopParams`,
  `karaokeConversion`, `orderConversion`)
- `src/components/laffogato/meta-pixel.tsx`: `<MetaPixel />` (rota PageView,
  rıza olayı, `tel:` Contact)
- `src/components/laffogato/pixel-events.tsx`: `<PixelConversion />`,
  `trackCartAdd`, `checkoutFromCart`
- `src/components/laffogato/cookie-consent.tsx`, `site-tags.tsx`,
  `src/lib/consent/cookie.ts`, `script.ts`: rıza
- `next.config.ts`: CSP (`script-src https://connect.facebook.net`,
  `connect-src https://www.facebook.com https://connect.facebook.net`)
- `tests/meta-pixel.test.ts`, `tests/site-tags-off.test.ts`,
  `tests/karaoke-web-action.test.ts`

## 5. Events Manager'da doğrulama ("Olayları test edin")

1. Meta Events Manager → **LAF Pixel** (1433246991545596) → **Olayları test
   edin** → **Tarayıcı olayları**. Web sitesi adresine `https://laffogato.net`
   yaz, **Web sitesini aç**. Reklam engelleyici kapalı olmalı.
2. Açılan sekmede çerez bandı çıkar. **Hiçbir olay gelmediğini** gör, sonra
   **Tümünü kabul et**: `PageView` düşer. Menüde başka bir sayfaya geç: ikinci
   bir `PageView`.
3. `/karaoke`: `ViewContent` (value 1000 TRY, ücret ayarına göre). Bir saat seç:
   `AddToCart` (bir kez). Sihirbazı bitirip "Rezervasyonu onayla ve ... öde":
   `InitiateCheckout`, Olay Kimliği `checkout_krk-...`. Ödemeden sonra sonuç
   sayfasında `Purchase` ve `Schedule`, Olay Kimliği `purchase_krk-...`, value
   ödenen tutar. Sayfayı yenile: bu ikisi **tekrar gelmez**.
4. Sayfadaki telefon bağlantısına dokun: `Contact`.
5. Mağazada bir ürün sayfası: `ViewContent`; "Sepete ekle": `AddToCart`; sepette
   "Ödemeye geç": `InitiateCheckout`; sipariş tamamlanınca `Purchase`,
   `purchase_<sipariş no>`.
6. Çerez tercihlerini aç (sayfa altı), Pazarlama'yı kapat, kaydet: yeni olay
   gelmez ve tarayıcıda `_fbp`, `_fbc` çerezleri silinir (Application →
   Cookies).
7. `/admin` ve `/odeme` (kart sayfası): bu sayfalarda hiç olay yoktur.

**Önizleme adresinde deneme.** Piksel önizlemede kapalıdır. Test Events'i bir
hazırlık adresinde denemek için o ortamın değişkenlerine
`NEXT_PUBLIC_META_PIXEL_HOSTS=<adres>` ekle; canlıya koyma.

**Canlı pikseli kirletme.** Yerelde denerken `NEXT_PUBLIC_META_PIXEL_ID` için
uydurma bir kimlik (örn. `1234567890123456`) ve
`NEXT_PUBLIC_META_PIXEL_HOSTS=localhost` kullan; olaylar gerçek pikseline
gitmez. Bu PR böyle denendi (karaoke akışı sahte ödeme sağlayıcısıyla uçtan
uca, mağaza ürün/sepet adımları).

## 6. Bilinen sınırlar

- Onay sayfa açıldıktan **sonra** verilirse o sayfanın `ViewContent`'i
  (karaoke ve ürün sayfası) bellekte bekler ve onay anında `PageView`'den
  hemen sonra gider (`trackPixelForPage`, 25 Ekim 2026; canlı denemede
  bulundu). Ziyaretçi o arada başka sayfaya geçtiyse bekleyen atılır. Sepete
  ekleme, ödemeye geçme ve satın alma bekletilmez.
- Bazı tarayıcı eklentileri ve izleyici engelleyiciler `fbevents.js` ile
  `facebook.com/tr` adreslerini engeller; bu ziyaretçilerden olay gelmez (25
  Ekim'deki Chrome profilinde de böyleydi). "Olayları test edin" ekranı için
  engelleyicisi olmayan bir tarayıcı profili kullan.
- Mağazada `Purchase` tarayıcı olayıdır: ödeme sayfaya dönülmeden onaylanırsa
  (kullanıcı sekmeyi kapatırsa) gitmez. Sunucu tarafı gönderim (aşağıda)
  bunu kapatır.
- `tel:` bağlantılarının hepsi `Contact` sayılır (sitede tek numara var).
- Event Match Quality düşük kalır: ad, e-posta, telefon bilerek gönderilmez.

## 7. İkinci PR (yapılmadı): Dönüşümler API'si

`Purchase`'ı ödeme onayında sunucudan da göndermek: aynı
`purchase_<rezervasyonKodu>` kimliğiyle (Meta tarayıcı ve sunucu kopyasını
birleştirir), yalnız rezervasyon sırasında ziyaretçinin pazarlama onayı varsa,
onay durumu rezervasyon kaydına yazılarak (yeni sütun, migration);
`META_CAPI_ACCESS_TOKEN` yoksa atlanır. Tarayıcıdaki `InitiateCheckout`
kimliği (`checkout_<id>`) buna hazır. Avukat sorusu 7 (§35.3) önce yanıtlanmalı.
