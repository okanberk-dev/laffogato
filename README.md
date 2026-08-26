# L'Affogato

İstanbul Tuzla'daki L'Affogato kafesinin kurumsal sitesi ve online mağazası.

**Next.js 16** (App Router) · **React 19** · **Tailwind v4** · **TypeScript** ·
**Postgres** — Vercel'de barındırılır.

- Müşteri tarafı: menü, mağaza, ürün detayı, sepet, misafir veya üye checkout,
  üye hesabı (sipariş geçmişi, adresler, favoriler, promosyonlar)
- Admin tarafı: ürün / menü / kategori / sipariş / müşteri / promosyon / içerik
  yönetimi, stok hareketleri, ciro raporları, audit log, RBAC, TOTP 2FA

## Kurulum

```bash
npm install
cp .env.example .env.local     # değerleri doldur
npm run db:migrate             # şemayı kur (DATABASE_URL gerekir)
npm run dev                    # http://localhost:3000
```

Veritabanı kurulumunun ayrıntısı (Neon dâhil): **[docs/DATABASE.md](docs/DATABASE.md)**

## Komutlar

| Komut                | Ne yapar                                          |
| -------------------- | ------------------------------------------------- |
| `npm run dev`        | Geliştirme sunucusu                               |
| `npm run build`      | Production build                                  |
| `npm run typecheck`  | `tsc --noEmit`                                    |
| `npm test`           | Vitest                                            |
| `npm run lint`       | ESLint                                            |
| `npm run format`     | Prettier yazar                                    |
| `npm run db:migrate` | `db/migrations/*.sql` dosyalarını sırayla uygular |
| `npm run db:bundle`  | `db/schema.sql`'i migration'lardan yeniden üretir |

Veritabanına dokunan testler yalnızca `TEST_DATABASE_URL` verilince çalışır:

```bash
TEST_DATABASE_URL=postgres://user@host:5432/db npm test
```

## Yapı

```
src/app/          Rotalar — müşteri, üye, admin, webhook
src/components/   laffogato/ (müşteri arayüzü) · admin/ (panel)
src/lib/          db/ · admin/ · customer/ · payment/ · seo/ · utils/
db/migrations/    Sıralı SQL migration'lar
docs/             DATABASE.md · PROMPT.md · BACKEND_FRONTEND_AUDIT.md
tests/            Vitest
```

Mimari kararlar, güvenlik kuralları ve çalışma alışkanlıkları için
**[CLAUDE.md](CLAUDE.md)**.

## Ortam değişkenleri

`.env.example` referanstır. Zorunlular: `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
`ADMIN_SESSION_SECRET`, `PAYMENT_PROVIDER`, `PAYMENT_WEBHOOK_SECRET`,
`DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`.

`DATABASE_URL` **yalnızca server-side** okunur; asla `NEXT_PUBLIC_*` ile
expose edilmez.
