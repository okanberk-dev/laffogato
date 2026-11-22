---
name: frontend-redesign
description: Change the customer-facing UI (pages, components, CSS, forms) without touching the backend or breaking the lafmobil app. Use for any frontend / design / görünüm / tasarım / arayüz / sayfa yenileme / "ön yüzü değiştir" / "siteyi yeniden tasarla" work under src/components/laffogato, src/app/**/page.tsx, src/styles/*.css, globals.css, or any *-form.tsx.
---

# Ön yüz yeniden tasarımı - arka yüze dokunmadan

Tam sınır: **`docs/FRONTEND-SINIR.md`**. Görünümün değerleri ve kuralları:
**`docs/BRAND.md` §0** (21 Kas 2026'dan beri; değiştirirken §8). Bu skill
ikisinin iş akışı.

## Başlamadan

1. `docs/FRONTEND-SINIR.md` §1'i oku: hangi dosya ön yüz, hangisi arka yüz,
   hangi hukuki asgariler görünümle değişmez.
2. Değiştireceğin sayfada form varsa §2 tablosundan o formun action'ını ve
   alan adlarını not et.
3. `docs/BRAND.md` §0'ı oku (renk, ölçülmüş kontrast, yazı, kontroller,
   yerleşim, referans politikası). Kod ile belge çelişirse kod doğrudur:
   değerlerin tek kaynağı `src/styles/foundation.css :root`.

## Yaparken: sınır

- **Arka yüz dosyalarına dokunma:** `src/lib/**`, `src/app/**/actions.ts`,
  `src/app/**/route.ts`, `src/app/api/**`, `src/proxy.ts`, `db/**`,
  `scripts/**`, `next.config.ts`, `vercel.json`, `docs/API-MOBILE.md`,
  `src/app/admin/**`. Gerçekten gerekiyorsa dur, kullanıcıya söyle, ayrı PR
  aç.
- **Form alanlarının `name`'ini koru.** Formu yeniden yazarken input'ları
  kopyala, adlarını değiştirme; gizli input'ları (`items`, `next`, `back`,
  `token`, `addressId`, `productId`) düşürme.
- **Onay kutuları işaretsiz başlar** - `legalConsent`, `acceptedTerms`,
  `marketing`, `newsletter`, `consent`. Sabit `defaultChecked` / `checked`
  yok; kontrollü kutu (`checked={ticks.x}`) işaretsiz bir durumdan başlar
  (`docs/FRONTEND-SINIR.md` §2).
- **Sepet anahtarı** `laffogato_cart_v1` ve `items` JSON biçimi aynı kalır.
  Görünüm için saklanan satıra alan ekleme; gösterilecek bilgi (fotoğraf
  gibi) ürün listesinden `productId` ile bulunur.
- **Yönlendirme parametrelerini karşıla:** `/?cart=…`, `/?hesap=silindi`,
  `/odeme?error=…`, `/uye/giris?next=…` (§5).
- **Dışarıdan çağrılan yolları yeniden adlandırma** (§6): e-posta linkleri,
  `/odeme/donus`, `/gorsel/**`, `/hukuk/[slug]`, `/masa/[code]`, `/api/**`.
- Veri için var olan önbellekli okuyucuları kullan: `loadAppProps` ya da
  `src/lib/seo/site-data.ts` (`getSiteSettings`, `listSite*`,
  `getSiteProductBySlug`, ...). `getPublicSettings` ve `store.ts`'in
  `list*` / `get*` okuyucuları her görüntülemede veritabanını uyandırır;
  genel sayfada kullanma (`docs/FRONTEND-SINIR.md` §4). Bileşende
  `@/lib/db` import etme; istemci bileşeninde `server-only` modül import
  etme - `*-core.ts` / `*-utils.ts` kardeşini al.
- Hash router hydration kuralı (CLAUDE.md → "Sık Karşılaşılan Hatalar").

## Yaparken: tasarım sistemi

- **Token'lar yalnız `src/styles/foundation.css :root`'ta:** `--bg`,
  `--band`, `--surface`, `--ink`, `--muted`, `--charcoal`,
  `--charcoal-deep`, `--on-dark`, `--on-dark-muted`, `--line`,
  `--line-strong`, `--error`, `--success` (ödeme sayfasının kart şeması
  işaretleri için `--scheme-*`). Çağrı noktasına hex yazma; bir tonun saydam
  hâli `color-mix(in srgb, var(--token) N%, transparent)`. Emekli adlar
  (`--green-*`, `--accent*`, `--amber`, `--matcha`, `--rose`, `--gold*`,
  `--bg-*`, `--frost*`, `--glass-*`) tanımsızdır: kullanan kural sessizce
  düşer.
- **Gri kömür zemine yazılmaz.** `--muted` beyazda 5.5:1, bantta 5.1:1,
  kömürde 2.3:1. Koyu zeminde (kömür blok `.section--dark`, footer, film)
  yazı `--on-dark` ya da `--on-dark-muted`; koyu blok `data-ground="dark"`
  ya da `.on-dark` taşır, klavye odağı da beyaza döner. Renk yalnız durum
  söyler (`--error`, `--success`); vurgu rengi yok.
- **Yazı `.t-*` sınıflarıyla, yeni boyut icat etme.** Archivo (`--headline`;
  geniş, 400, büyük harf CSS'le, `--track` aralık): `.t-display` bölüm
  başlığı 24/32, telefonda 20/28 (`.t-display--xl` büyüğü), `.t-title` kart
  başlığı ve `.t-nav` 16/22, `.t-label` / `.t-kicker` 12/24, `.t-price`
  14/20. Geist (`--sans`): `.t-body` 16/22, `.t-small` 14/20, `.t-micro`
  12/16, gri `.t-muted`. Başlık hiç kalın olmaz; işaretleme cümle düzeninde
  kalır. Eski `.h1`, `.h2`, `.section-title`, `.h3`, `.eyebrow`, `.lede`
  aynı seslere çözülür ama yeni işaretlemede `.t-*` kullan.
- **Kontroller hazır:** `.btn` (en az 48px, kare, 1px kömür kenar, etiket
  Geist 16px, ok yok) ve dolu `.btn-dark` (karar verilmiş eylem), çağrı
  `.btn-wide` (350px, telefonda tam satır), `.btn-block`, koyu zeminde
  `.btn-light`, `.btn-sm`. Eski `.btn-primary`, `.btn-ink`, `.btn-amber`
  `.btn-dark`'a, `.btn-ghost` / `.btn-outline` kenarlı düğmeye çözülür;
  yenisinde kullanma. Ayrıca `.chip` (hap; yalnız hızlı bağlantı ve kategori
  çipleri), `.tag`, `.icon-btn` (`--boxed`), `.link-u`, `.input` /
  `.select` / `.textarea` (48px, 16px). Yerleşim `.wrap`, `.section`
  (`--band`, `--dark`), `.section-head`, medya `.media` + `.ratio-*`.
- **Malzeme:** kare köşe; gölge, bulanıklık ve degrade yok (tek istisna
  anasayfa filminin alt gölgesi).
- **CSS'in yeri:** kural ait olduğu alanın dosyasına girer:
  `src/styles/foundation.css`, `chrome.css`, `sections.css`, `home.css`,
  `catalog.css`, `pages.css`, `karaoke.css`, `checkout.css`, `account.css`.
  `src/app/globals.css` yalnız içe aktarım, panelin geri alma kuralları ve
  baskı kurallarıdır; oraya site kuralı yazma.
- **Hukuki asgariler kalır** (`docs/FRONTEND-SINIR.md` §1 "Hukuki
  asgariler"): sözleşme ve ön bilgilendirme metinleri 16px, iOS için 16px
  alanlar, çerez kartının hidrasyon öncesi gizleme kuralı, üstü çizili
  fiyatın yanında indirim günleri.
- **Yeni bir değer ya da kontrast çifti** WCAG formülüyle elle ölçülür
  (metin 4.5:1, büyük metin ve kontrol sınırı 3:1) ve `docs/BRAND.md`
  §0.2'ye yazılır: bunu tutan test yok. Görünüm operatörün kararıdır; bir
  değeri değiştirmeden önce sor.

## Referanslar: dil alınır, varlık alınmaz

Operatör bir referans site verdiğinde (21 Kas 2026: Blue Bottle ve Good Boy
Bob) alınan **dildir**: yerleşim, yazı ölçeği ve işlenişi, boşluklar,
bileşenler, etkileşimler. Referans şirketin **varlıkları alınmaz**: logosu,
işaretleri, fotoğrafları, filmleri, metinleri ve lisanslı yazı yüzleri.
Operatör "birebir" dese de varlığın yerine bizim ya da lisanslı olanı koy ve
bunu söyle. Lisanslı bir yazı yüzü web lisansı alınmadan eklenmez; yazı
yüzü yalnız `src/app/layout.tsx`'te değişir. Her yeni fotoğraf ve film ya
bizimdir ya lisanslıdır, künyesi `docs/MEDIA-LICENSES.md`'ye yazılır.
Ayrıntı: `docs/BRAND.md` §0.6.

## Form başka dosyaya taşındıysa

`docs/FRONTEND-SINIR.md` §2 tablosundaki ilgili satırın **yalnız form
dosyası sütununu** güncelle. Alan listesine dokunma: o liste action'ın
okuduğu alanlardır ve ancak arka yüz değişince değişir. (16 Kas 2026'ya
kadar bunu `tests/frontend-form-contract.test.ts` tutuyordu; artık koşmuyor,
karşılaştırmayı sen yaparsın.)

## Bitirmeden

```bash
npm run typecheck
npm run lint -- --max-warnings=0
NODE_ENV=production npm run build
git diff --stat origin/main -- src/lib src/app/api db scripts src/proxy.ts 'src/app/**/actions.ts' 'src/app/**/route.ts'
```

Son komut boş dönmeli. `npm test` yok (`tests/` 16 Kas 2026'da kalktı);
yalnız kayıtlı kart ekranlarına (`card-payment.tsx`,
`/uye/hesap/kartlarim`) dokunduysan `npm run test:saved-cards`'ı yerel
Postgres'e karşı koş (`tests/saved-cards/README.md`).

Sonra değişen sayfaları gerçekten render edip bak (Playwright,
`executablePath: '/opt/pw-browsers/chromium'`; 360, 768, 1024 ve 1280px ile
geniş ekran: çakışma, taşma, yatay kaydırma) ve en az bir kez uçtan uca dene:
ürün → sepet → ödeme (onay kutusu işaretsiz mi?) → giriş (`?next=` ile
ödemeye dönüyor mu?) → favori ekle/çıkar.
