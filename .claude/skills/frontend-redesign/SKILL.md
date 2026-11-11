---
name: frontend-redesign
description: Change the customer-facing UI (pages, components, CSS, forms) without touching the backend or breaking the lafmobil app. Use for any frontend / design / görünüm / tasarım / arayüz / sayfa yenileme / "ön yüzü değiştir" / "siteyi yeniden tasarla" work under src/components/laffogato, src/app/**/page.tsx, globals.css, or any *-form.tsx.
---

# Ön yüz yeniden tasarımı - arka yüze dokunmadan

Tam sınır: **`docs/FRONTEND-SINIR.md`**. Bu skill onun iş akışı.

## Başlamadan

1. `docs/FRONTEND-SINIR.md` §1'i oku: hangi dosya ön yüz, hangisi arka yüz.
2. Değiştireceğin sayfada form varsa §2 tablosundan o formun action'ını ve
   alan adlarını not et.

## Yaparken

- **Arka yüz dosyalarına dokunma:** `src/lib/**`, `src/app/**/actions.ts`,
  `src/app/**/route.ts`, `src/app/api/**`, `src/proxy.ts`, `db/**`,
  `scripts/**`, `next.config.ts`, `vercel.json`, `docs/API-MOBILE.md`.
  Gerçekten gerekiyorsa dur, kullanıcıya söyle, ayrı PR aç.
- **Form alanlarının `name`'ini koru.** Formu yeniden yazarken input'ları
  kopyala, adlarını değiştirme; gizli input'ları (`items`, `next`, `back`,
  `token`, `addressId`, `productId`) düşürme.
- **Onay kutuları işaretsiz başlar** - `legalConsent`, `acceptedTerms`,
  `marketing`, `newsletter`, `consent`. `defaultChecked` / `checked` yok.
- **Sepet anahtarı** `laffogato_cart_v1` ve `items` JSON biçimi aynı kalır.
- **Yönlendirme parametrelerini karşıla:** `/?cart=…`, `/?hesap=silindi`,
  `/odeme?error=…`, `/uye/giris?next=…` (§5).
- **Dışarıdan çağrılan yolları yeniden adlandırma** (§6): e-posta linkleri,
  `/odeme/donus`, `/gorsel/**`, `/hukuk/[slug]`, `/api/**`.
- Veri için var olan önbellekli okuyucuları kullan: `loadAppProps` ya da
  `src/lib/seo/site-data.ts` (`getSiteSettings`, `listSite*`,
  `getSiteProductBySlug`, ...). `getPublicSettings` ve `store.ts`'in
  `list*` / `get*` okuyucuları her görüntülemede veritabanını uyandırır;
  genel sayfada kullanma (`tests/public-pages-cached-reads.test.ts` reddeder,
  `docs/FRONTEND-SINIR.md` §4). Bileşende `@/lib/db` import etme; istemci
  bileşeninde `server-only` modül import etme - `*-core.ts` / `*-utils.ts`
  kardeşini al.
- Renk/token değişikliği `tests/contrast.test.ts` ve
  `tests/brand-theme.test.ts`'ten geçmeli; karamel (`--accent`) ile espresso
  üst üste yazılmaz, koyu zeminde vurgu `--accent-on-dark` (amber) ile yazılır.
- Hash router hydration kuralı (CLAUDE.md → "Sık Karşılaşılan Hatalar").

## Form başka dosyaya taşındıysa

`tests/frontend-form-contract.test.ts` içindeki ilgili satırın **yalnız
`forms` yolunu** güncelle. `fields` listesine dokunma - o liste action'ın
okuduğu alanlardır ve ancak arka yüz değişince değişir.

## Bitirmeden

```bash
npm run typecheck && npm test && npm run lint
NODE_ENV=production npm run build
git diff --stat origin/main -- src/lib src/app/api db scripts src/proxy.ts 'src/app/**/actions.ts' 'src/app/**/route.ts'
```

Son komut boş dönmeli. Sonra değişen sayfaları gerçekten render edip bak
(Playwright, `executablePath: '/opt/pw-browsers/chromium'`) ve en az bir kez
uçtan uca dene: ürün → sepet → ödeme (onay kutusu işaretsiz mi?) → giriş
(`?next=` ile ödemeye dönüyor mu?) → favori ekle/çıkar.
