# Laffogato

Bir kafenin kurumsal sitesi + online mağazası. **Next.js 16** + **Supabase** + **Tailwind v4** üzerine kuruludur ve **Vercel**'de barındırılır.

## Hızlı Başlangıç

```bash
cp .env.example .env.local       # Değişkenleri doldur
npm install
npm run dev
```

Tarayıcıdan [http://localhost:3000](http://localhost:3000) açın.

## Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Production build |
| `npm run start` | Production sunucusu |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript tip kontrolü |
| `npm run format` | Prettier ile biçimlendir |

## Klasör Yapısı

```
src/
  app/                 → App Router (shop + admin route grupları)
  components/          → UI, shop, admin component'ları
  lib/
    supabase/          → Server/client/middleware factory'leri
    payment/           → PaymentProvider arayüzü + MockPaymentProvider
    validation/        → Zod şemaları
    utils/             → cn, format
  types/database.ts    → Supabase'den auto-generate edilen tipler
  proxy.ts             → Next.js proxy (eski "middleware") — auth + admin guard
supabase/
  migrations/          → SQL migration'lar
  seed/seed.sql        → Test verisi
docs/PROMPT.md         → Ürün spec'i + MVP kapsamı
.claude/               → Claude Code ayarları
```

Daha fazla detay için [`CLAUDE.md`](./CLAUDE.md) ve [`docs/PROMPT.md`](./docs/PROMPT.md).

## Deploy

Vercel'e bağla, env değişkenlerini gir, push'la:

```bash
git push origin claude/inspiring-cori-3JcFV
```

Build komutu: `npm run build`. Output: `.next`. Node runtime API route'lar için gerekli (`runtime = "nodejs"` payment webhook'unda işaretli).
