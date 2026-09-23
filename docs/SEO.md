# SEO

Bu belge sitenin arama görünürlüğü için nasıl kurulduğunu ve yeni bir sayfa
eklerken neyi güncellemek gerektiğini anlatır. Anahtar kelime rakamları
**Semrush, Türkiye veritabanı** (Eylül 2026) - tahmin değil, ölçüm.

---

## 1. Tek kaynak: `src/lib/seo/site.ts`

Marka adı, NAP (name-address-phone), sosyal hesaplar, OG görseli, doğrulama
token'ları ve anahtar kelime çekirdeği burada. Aşağıdaki her şey buradan türer:

| Tüketici                                                | Nereden okur                     |
| ------------------------------------------------------- | -------------------------------- |
| `metadataBase`, varsayılan `title`/`description`        | `src/app/layout.tsx`             |
| JSON-LD (`Organization`, `LocalBusiness`, `WebSite`, …) | `src/lib/seo/structured-data.ts` |
| Sayfa başlıkları ve açıklamaları                        | `src/lib/seo/pages.ts`           |
| `sitemap.xml`                                           | `src/app/sitemap.ts`             |
| `robots.txt`                                            | `src/app/robots.ts`              |
| `llms.txt` / `llms-full.txt`                            | `public/` (elle güncellenir)     |

**Adres, telefon veya e-posta değişirse** `site.ts` ile birlikte
`src/lib/legal/entity.ts`, `src/lib/admin/store.ts` içindeki `defaultSettings()`
ve `public/llms*.txt` de güncellenmeli. `tests/seo-site.test.ts` ve
`tests/domain.test.ts` bu tutarlılığı bozulunca kırmızıya döner.

---

## 2. Teknik SEO - yerleşik olanlar

**Indeksleme**

- `robots.ts` üretim dışı deploy'larda (`VERCEL_ENV !== production`) tüm siteyi
  kapatır - preview URL'leri canlı domain ile yarışmaz.
- `/admin`, `/api`, `/uye`, `/odeme` crawl dışı.
- Yapay zekâ tarayıcıları (GPTBot, ClaudeBot, PerplexityBot, Google-Extended…)
  **açık** bırakıldı; `llms.txt` onlar için derlenmiş özet sunar.

**Canonical**

Her genel sayfa `alternates.canonical` verir. SPA bölümleri (`#menu`, `#shop`)
ile gerçek route'lar (`/menu`, `/magaza`) aynı içeriği gösterdiği için canonical
her zaman **gerçek route'u** işaret eder.

**Yapısal veri**

| Tip                                                 | Nerede                 | Not                                       |
| --------------------------------------------------- | ---------------------- | ----------------------------------------- |
| `Organization`                                      | ana sayfa `@graph`     | `legalName`, `taxID` vergi levhasından    |
| `LocalBusiness` (`CafeOrCoffeeShop` + `Restaurant`) | ana sayfa              | NAP + `openingHoursSpecification` + `geo` |
| `WebSite` + `SearchAction`                          | ana sayfa              | sitelinks arama kutusu                    |
| `Menu` / `MenuSection` / `MenuItem`                 | ana sayfa + `/menu`    | canlı menüden üretilir                    |
| `Product` + `Offer`                                 | `/magaza/urun/[slug]`  | fiyat, stok durumu, kargo, iade           |
| `FAQPage`                                           | ana sayfa + her rehber | `src/lib/seo/faq.ts` ve rehber `faq[]`    |
| `Article` + `Recipe`                                | `/rehber/[slug]`       | `guide-structured-data.ts`                |
| `BreadcrumbList`                                    | her derin route        | kökten **bu** sayfaya giden yol           |
| `ItemList` / `SiteNavigationElement`                | ana sayfa              | bölüm listesi                             |

> **Breadcrumb ≠ navigasyon.** Ana sayfa kökün kendisidir; breadcrumb'ı yoktur.
> Daha önce ana sayfada "Ana Sayfa › Menü › Mağaza › Hikaye › Ziyaret" tek bir
> yolmuş gibi yayımlanıyordu - bu düzeltildi, yerine `SiteNavigationElement`
> geldi.

**Sitemap önceliği**

| Aralık  | Ne                            |
| ------- | ----------------------------- |
| 1.0     | ana sayfa                     |
| 0.95    | `/menu`                       |
| 0.9     | `/magaza`, kategori sayfaları |
| 0.8     | ürün detayları, `/rehber`     |
| 0.75    | rehber sayfaları              |
| 0.6-0.7 | `/hikayemiz`, `/ziyaret`      |
| 0.4-0.5 | `/hukuk` ve belgeler          |

---

## 3. İçerik SEO - `/rehber`

Sitenin en büyük kaçırılmış fırsatı, markanın kendi terimlerinin Türkiye'de
yüksek hacimli ve **düşük zorlukta** olmasıydı. `/rehber` bu boşluğu kapatır.

| Sayfa                       | Hedef küme                                                                         | Aylık hacim | KD    |
| --------------------------- | ---------------------------------------------------------------------------------- | ----------- | ----- |
| `affogato-nedir`            | affogato · **dondurmalı kahve** · affogato nedir/tarifi/nasıl yapılır/nasıl okunur | ~27.000     | 10-27 |
| `matcha-nedir`              | matcha nedir · matcha latte · matcha faydaları · matcha nasıl yapılır              | ~53.000     | 13-25 |
| `espresso-cesitleri`        | flat white · türk kahvesi · cortado · espresso nedir                               | ~78.000     | 14-38 |
| `san-sebastian-cheesecake`  | san sebastian cheesecake                                                           | ~18.000     | 20    |
| `yenilebilir-kahve-fincani` | yenilebilir kahve fincanı/bardak                                                   | ~800        | 17-35 |

**Neden bu beşi:** hepsi menüde gerçekten olan bir ürüne bağlanıyor. Satmadığımız
bir şey için içerik üretmiyoruz - arama trafiği ile ticari niyet arasında bağ
kurulamayan sayfa, sıralansa bile işe yaramaz.

**Türkçe arama davranışına dair iki kritik gözlem** (içerikte kullanıldı):

1. `affogato`nun halk ağzındaki karşılığı **"dondurmalı kahve"** (2.400/ay) ve
   varyantlarıyla birlikte ~5.000/ay daha. İki adın aynı şey olduğu metinde
   açıkça yazılır.
2. `matcha` çok sık **"macha"** (8.100/ay) ve **"maça"** (3.600/ay) olarak
   yazılıyor. Bu yazımlar metinde bir kez, doğal biçimde geçer.

### Yeni rehber eklerken

1. Semrush ile kümeyi doğrula (`phrase_these`, `phrase_related`, TR veritabanı).
   Hacim ve zorluk olmadan sayfa açma.
2. İçeriği `src/lib/seo/guide-content.ts` içine `GuideSource` şeklinde ekle.
3. `src/lib/seo/guides.ts` içindeki `ORDER` dizisine slug'ı koy.
4. `src/lib/seo/guide-nav.ts` içine footer bağlantısını ekle.
5. `npm test` - `tests/guides.test.ts` meta uzunluklarını, iç bağlantı
   geçerliliğini, sağlık iddiası olmadığını ve footer ile registry'nin
   uyumunu denetler.

Sitemap ve JSON-LD otomatik; ayrıca dokunmak gerekmez.

### İçerik kuralları

- İlk paragraf soruyu **doğrudan** cevaplar (40-60 kelime). "Bu yazıda ele
  alacağız" gibi girizgâh yok - featured snippet bunu almaz.
- H2'ler gerçek arama sorgusu biçiminde; en az üçü soru.
- Her sayfada en az bir **tablo** (Google tabloyu snippet olarak alır).
- **Sağlık iddiası yasak.** "Zayıflatır", "önler", "tedavi eder", "detoks" gibi
  ifadeler `build-guides.mjs` ve `tests/guides.test.ts` tarafından reddedilir.
- Rakip marka adı övücü/kıyaslayıcı biçimde kullanılmaz.
- Gövde 1.200-1.800 kelime. Daha kısası ince içerik, daha uzunu şişkin.

---

## 4. Yerel SEO

`tuzla kafe` / `tuzla cafe` (590/ay), `tuzla kahvaltı` (1.000/ay),
`tuzla gezilecek yerler` (1.300/ay), `pendik kafe` (1.300/ay) kümesi
`/ziyaret` sayfasının ve `LocalBusiness` verisinin işi.

Yapılmış olanlar: tam NAP, `geo` koordinatları, `openingHoursSpecification`,
`hasMap`, `publicTransitClosestStop`, `amenityFeature`, yakınlık bilgisi
(Marmaray 6 dk, Sabiha Gökçen 15 dk) ve yerel yer imi ("Menemenci Cumhur'un
yanı" - insanlar tarifi böyle veriyor).

**Kod dışında kalan, sizin yapmanız gerekenler:**

- Google Business Profile kaydı - NAP birebir `site.ts` ile aynı olmalı.
- Apple Business Connect, Yandex İşletmem.
- Foursquare / TripAdvisor / Zomato tutarlılığı.
- Google Search Console + Bing Webmaster doğrulaması → token'ları
  `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` vb. env değişkenlerine gir.

---

## 5. Ölçüm

| Env değişkeni                              | Ne için                                      |
| ------------------------------------------ | -------------------------------------------- |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`     | Search Console                               |
| `NEXT_PUBLIC_BING_VERIFICATION`            | Bing Webmaster                               |
| `NEXT_PUBLIC_YANDEX_VERIFICATION`          | Yandex Webmaster                             |
| `NEXT_PUBLIC_PINTEREST_VERIFICATION`       | Pinterest                                    |
| `NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION` | Meta domain doğrulama                        |
| `NEXT_PUBLIC_GTM_ID`                       | Google Tag Manager (GA4 dâhil tüm etiketler) |

Boş bırakılan doğrulama token'ı için Next.js meta etiketini hiç basmaz.

> **Çerez rızası uygulanmıştır.** Analitik ve pazarlama çerezleri KVKK
> kapsamında açık rıza ister. Consent Mode v2 varsayılanları GTM
> konteynerinden **önce** `<head>` içinde basılır ve rızaya bağlı her sinyal
> `denied` başlar; `src/components/laffogato/cookie-consent.tsx` bandı ve
> tercih merkezini, footer'daki "Çerez Tercihleri" düğmesi de geri almayı
> sağlar. Yani GTM yüklense bile rıza verilmeden hiçbir etiket ölçüm yapamaz.
> Bunu `tests/consent.test.ts` kilitler.

---

## 6. Kontrol listesi - yeni sayfa eklerken

- [ ] `generateMetadata` ya da `metadata`: `title`, `description`,
      `alternates.canonical`
- [ ] OG + Twitter kartı (layout'tan miras alınanları yeniden bildir -
      `openGraph` segmentler arası **sığ** birleşir)
- [ ] Sayfaya uygun JSON-LD + `BreadcrumbList`
- [ ] `sitemap.ts` içine giriş (dinamikse otomatik)
- [ ] Gizli kalması gerekiyorsa `robots.ts` disallow listesi
- [ ] Tek bir `h1`, ardından atlamayan başlık hiyerarşisi
- [ ] Görsellerde anlamlı `alt` (dekoratifse `alt=""`)
- [ ] İç bağlantı: en az bir ilgili sayfadan buraya link
