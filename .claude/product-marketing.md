# Ürün pazarlama bağlamı (L'Affogato)

Pazarlama skill'leri (`copywriting`, `cro`, `emails`, `social`, `referrals`,
`seo-audit`) önce bu dosyayı okur. Elle tutulur ve kasıtlı olarak kısadır:
**gerçeğin kendisi aşağıdaki kaynak dosyalardadır, buraya kopyalanmaz.** Bu
dosya ile kaynak çelişirse kaynak kazanır; bu dosyayı bir skill kendiliğinden
yeniden yazmaz, `.agents/` altına taşımaz (upstream `product-marketing`
skill'i bilerek kurulmadı: kodu tarayıp ikinci bir marka belgesi
üretiyordu).

## Ne

- **Tek şube**: Tuzla / İstanbul'da restore bir köşkte İtalyan kahve ve
  gelato barı; yanında online mağaza (kargo), karaoke odası rezervasyonu ve
  iOS / Android uygulaması (sipariş, damga kartı, davet kodu). Masa ya da
  grup rezervasyonu yok (yalnız karaoke).
- Ad, açıklama, hikâye, adres, telefon, saat, sosyal hesaplar, fiyat aralığı:
  `src/lib/seo/site.ts` (`SITE`) ve `src/lib/legal/entity.ts`. Menü ve
  fiyatlar veritabanından gelir; metne fiyat elle yazılmaz.
- Marka (renk, yazı, logo, malzeme, hareket): `docs/BRAND.md`. E-posta
  görünümü: `src/lib/email/templates/README.md`.

## Kime

- Tuzla ve çevresinde yaşayan, çalışan ve köşke gelen müşteri (B2C); online
  mağazadan paket kahve ve hediye alan müşteri; uygulamadan gel-al, masa ya
  da kurye siparişi veren üye. Personalar ve kitle verisi henüz yazılmadı:
  bir skill bunu sorduğunda operatöre sor, uydurma.

## Kanallar

- Site `laffogato.net` (yalnız Türkçe), uygulama (`RiosenBeq/lafmobil`;
  mağaza hesaplarının durumu lafmobil CLAUDE.md §8), sosyal hesaplar
  `SITE.social`, bülten ve kampanya e-postası (yalnız İYS kapısından), push
  bildirimi (yalnız işlemsel, `docs/API-MOBILE.md` §23).
- SEO hedef kümeleri ve ölçüm: `docs/SEO.md` (yeni sayfa ancak Semrush TR
  hacmiyle).

## Değişmez kurallar (CLAUDE.md "Güvenlik Kuralları")

- Ticari e-posta: açık rıza + İYS'de ONAY + tek tıkla çıkış (kural 19,
  `docs/IYS.md`). İşlemsel e-postada pazarlama yok. SMS yok.
- Rıza olmadan ölçüm ya da piksel yok (kural 18, Consent Mode v2).
- Gıda işletmesi sağlık iddiası yapamaz (kural 21, `tests/guides.test.ts`).
- Ödeme onay kutuları işaretsiz; fiyat istemciden gelmez; kart saklanmaz
  (kural 6, 12, 28).
- Uydurma rakam, yorum, ödül, aciliyet ve kıtlık yok; influencer
  paylaşımı "#reklam" / "#işbirliği" etiketli.
- Sadakat ve davet kuralları operatörün (`src/lib/mobile/loyalty-core.ts`,
  `src/lib/mobile/invite-code.ts`); değişiklik uygulama sözleşmesine
  dokunur.
- Arayüz metni Türkçe; uzun tire kullanılmaz.

## Öğrenilenler

Bir kampanyanın, testin ya da yayının sonucu buraya ancak operatör isterse,
tarih ve kaynağıyla tek satır olarak eklenir.
