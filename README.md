# L'Affogato

İstanbul Tuzla'daki L'Affogato kafesinin kurumsal sitesi, online mağazası ve
yönetim paneli.

**Next.js 16** (App Router) · **React 19** · **Tailwind v4** · **TypeScript** ·
**Postgres (Neon)** — Vercel'de barındırılır.

| Taraf       | Ne var                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Müşteri** | 12 kategorili kafe menüsü, online mağaza, ürün detayı, sepet, üye checkout, üye hesabı (sipariş geçmişi, adresler, favoriler, promosyonlar) |
| **Rehber**  | Arama verisine dayalı 5 uzun içerik — `/rehber`                                                                                             |
| **Hukuk**   | 24 sözleşme ve politika — `/hukuk`, tek kaynaktan doldurulan yasal kimlikle                                                                 |
| **Admin**   | Ürün / menü / kategori / sipariş / müşteri / promosyon / içerik yönetimi, stok hareketleri, ciro raporları, olay kaydı, RBAC, TOTP 2FA      |
| **Ödeme**   | Sağlayıcı bağımsız soyutlama; sanal POS **iyzico** (Checkout Form), geliştirmede mock                                                       |

---

## Kurulum

```bash
npm install
cp .env.example .env.local     # değerleri doldur
npm run db:migrate             # şemayı kur (DATABASE_URL gerekir)
npm run dev                    # http://localhost:3000
```

Veritabanı kurulumunun ayrıntısı (Neon dâhil): **[docs/DATABASE.md](docs/DATABASE.md)**

> **Build hakkında:** Bu ortamda `NODE_ENV=development` set edilmişse
> `npm run build` `/_not-found` prerender'ında düşer. Doğrusu:
> `NODE_ENV=production npm run build`. CI bu değişkeni hiç set etmez.

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

---

## Yapı

```
src/app/                 Rotalar — müşteri, rehber, hukuk, üye, admin, webhook
src/components/
  laffogato/             Müşteri arayüzü (app · chrome · pages · ui ·
                         visuals · menu-visuals)
  admin/                 Panel bileşenleri
src/lib/
  db/                    pg havuzu · sorgu kurucu · SQL derleyici · sağlık
  admin/ · customer/     Veri katmanı ve iş kuralları
  payment/               PaymentProvider · MockPaymentProvider · IyzicoPaymentProvider
  legal/                 Yasal kimlik (tek kaynak) · 24 sözleşme · render
  seo/                   site sabitleri · yapısal veri · sayfa SEO · rehber
db/migrations/           Sıralı SQL migration'lar
docs/                    DATABASE.md · SEO.md · PROMPT.md · BACKEND_FRONTEND_AUDIT.md
tests/                   Vitest
```

### Bilmeye değer üç tasarım kararı

**1. Yasal kimlik tek kaynaktan gelir.** `src/lib/legal/entity.ts` vergi
levhasındaki bilgiyi tutar; sözleşme metinleri `{{TOKEN}}` yer tutucularıyla
yazılır ve render'da doldurulur. Değeri **bilinmeyen** bir alan (MERSİS, ticaret
sicil, KEP, IBAN) boş bırakılır ve o tablo satırı hiç basılmaz — site asla
uydurma bir sicil numarası yayımlamaz.

**2. Menü görselleri çizimdir, fotoğraf değil.** `menu-visuals.tsx` her içecek
ve tatlı ailesi için parametrik SVG üretir; kategori bazlı bir yönlendirici
hangi çizimin kullanılacağına karar verir. Gerçek fotoğraf eklendiğinde
(`image` alanı) çizimin yerini alır. Telif riski yok, boyut birkaç KB.

**3. Mesafeli satış onayı kanıtla saklanır.** Ödeme adımındaki onay kutusu ön
işaretli olamaz; sunucu onaysız siparişi reddeder ve onayı — tarih, IP, tarayıcı,
belge sürümü — `orders."legalConsent"` kolonuna yazar. Sanal POS incelemesinde
ve chargeback itirazında istenen kayıt budur.

---

## Ortam değişkenleri

`.env.example` referanstır. Zorunlular:

| Değişken                         | Ne için                                             |
| -------------------------------- | --------------------------------------------------- |
| `DATABASE_URL`                   | Neon Postgres bağlantısı (**yalnızca server-side**) |
| `NEXT_PUBLIC_SITE_URL`           | Kanonik site adresi                                 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin girişi                                        |
| `ADMIN_SESSION_SECRET`           | İmzalı cookie anahtarı (≥32 karakter)               |
| `PAYMENT_PROVIDER`               | `mock` \| `iyzico`                                  |
| `PAYMENT_WEBHOOK_SECRET`         | Webhook imza doğrulaması                            |

iyzico kullanılacaksa ayrıca `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`,
`IYZICO_BASE_URL`, `IYZICO_CALLBACK_URL`.

`DATABASE_URL` ve servis anahtarları **asla** `NEXT_PUBLIC_*` ile expose edilmez.

---

## Belgeler

| Belge                                                                | İçerik                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **[CLAUDE.md](CLAUDE.md)**                                           | Mimari kararlar, güvenlik kuralları, çalışma alışkanlıkları              |
| **[docs/DATABASE.md](docs/DATABASE.md)**                             | Neon kurulumu, migration akışı, sürücü seçimi                            |
| **[docs/SEO.md](docs/SEO.md)**                                       | Teknik + içerik SEO, anahtar kelime haritası, yeni sayfa kontrol listesi |
| **[docs/BACKEND_FRONTEND_AUDIT.md](docs/BACKEND_FRONTEND_AUDIT.md)** | Açık iş kalemleri ve bilinen boşluklar                                   |
| **[docs/PROMPT.md](docs/PROMPT.md)**                                 | Ürün spec'i ve MVP kapsamı                                               |
| **[AGENTS.md](AGENTS.md)**                                           | Bu Next.js sürümüne özgü uyarı                                           |
