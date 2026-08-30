# L'Affogato

İstanbul Tuzla'daki L'Affogato kafesinin kurumsal sitesi, online mağazası ve
yönetim paneli.

**Next.js 16** (App Router) · **React 19** · **Tailwind v4** · **TypeScript** ·
**Postgres** (bugün Neon'da) — uygulama Vercel'de barındırılır. Sağlayıcıya
özel bağımlılık yok; taşınma bağlantı dizesi değişikliğidir.

| Taraf       | Ne var                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Müşteri** | 12 kategorili kafe menüsü, online mağaza, ürün detayı, sepet, üye checkout, üye hesabı (sipariş geçmişi, adresler, favoriler, promosyonlar) |
| **Rehber**  | Arama verisine dayalı 5 uzun içerik — `/rehber`                                                                                             |
| **Hukuk**   | 24 sözleşme ve politika — `/hukuk`, tek kaynaktan doldurulan yasal kimlikle                                                                 |
| **Admin**   | Ürün / menü / kategori / sipariş / müşteri / promosyon / içerik yönetimi, stok hareketleri, ciro raporları, olay kaydı, RBAC, TOTP 2FA      |
| **Ödeme**   | Sağlayıcı bağımsız soyutlama; sanal POS **iyzico** (Checkout Form), geliştirmede mock. Üretimde mock'a düşmez — açıkça reddeder             |
| **Rıza**    | Consent Mode v2 (KVKK) · mesafeli satış onayı kanıtla · 6563 bülten onayı ve tek tıkla çıkış                                                |

---

## Kurulum

```bash
npm install
cp .env.example .env.local     # değerleri doldur
npm run db:migrate             # şemayı kur (DATABASE_URL gerekir)
npm run dev                    # http://localhost:3000
```

Veritabanı kurulumu, sağlayıcı geçmişi ve taşıma yordamı: **[docs/DATABASE.md](docs/DATABASE.md)**

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
  legal/                 Yasal kimlik (tek kaynak) · 24 sözleşme · render · meta
  consent/               Çerez rızası durumu + Consent Mode v2 bootstrap
  newsletter/            6563 onay kaydı + tek tıkla çıkış
  seo/                   site sabitleri · yapısal veri · sayfa SEO · rehber
db/migrations/           Sıralı SQL migration'lar
docs/                    DATABASE.md · SEO.md · AUDIT.md · PROMPT.md
tests/                   Vitest
```

### Bilmeye değer beş tasarım kararı

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

**4. Eşzamanlılık altındaki her sayaç SQL'de artar.** Stok, promosyon kullanımı,
giriş denemesi. JavaScript'te oku-değiştir-yaz, tam da yarışın olduğu anda —
aynı ürüne iki sipariş, son hakka iki checkout, bir brute-force — yazım
kaybeder; kaybedilen yazım da her zaman yanlış tarafa çalışır. `db/migrations`
altındaki `claim_order_stock`, `release_order_stock`, `redeem_promo`,
`adjust_product_stock` ve `record_auth_failure` bunun için var.

**5. Ölçüm rızaya bağlıdır.** Google Tag Manager yüklenir, ama Consent Mode v2
varsayılanları konteynerden **önce** basılır ve rızaya bağlı her sinyal `denied`
başlar. Bant ve tercih merkezi bunları yalnızca açık seçimle yükseltir; rıza,
verildiği kadar kolay geri alınır (footer → "Çerez Tercihleri").

---

## Ortam değişkenleri

`.env.example` referanstır. Zorunlular:

| Değişken                         | Ne için                                             |
| -------------------------------- | --------------------------------------------------- |
| `DATABASE_URL`                   | Postgres bağlantısı (**yalnızca server-side**)      |
| `NEXT_PUBLIC_SITE_URL`           | Kanonik site adresi                                 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin girişi                                        |
| `ADMIN_SESSION_SECRET`           | İmzalı cookie anahtarı (≥32 karakter)               |
| `PAYMENT_PROVIDER`               | `mock` \| `iyzico`                                  |
| `PAYMENT_WEBHOOK_SECRET`         | Webhook imza doğrulaması                            |

iyzico kullanılacaksa ayrıca `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`,
`IYZICO_BASE_URL` ve `IYZICO_CALLBACK_URL`.

> **iyzico henüz canlıya alınmadı.** Sağlayıcı kodu hazır ve derleniyor; sandbox
> testi ve canlı anahtarlar sonraya bırakıldı — ayrıntı ve açılış kontrol
> listesi için [docs/AUDIT.md](docs/AUDIT.md) §5. O zamana kadar
> `PAYMENT_PROVIDER=mock` ile yalnızca geliştirmede çalışılır; üretimde mock
> reddedilir.

> **`IYZICO_CALLBACK_URL` webhook adresi değildir.** iyzico ödeme bitince
> müşterinin **tarayıcısını** oraya POST eder; değer `https://…/odeme/donus`
> olmalıdır. Webhook (`/api/webhooks/payment`) iyzico panelinde ayrıca tanımlanır
> ve imzası `PAYMENT_WEBHOOK_SECRET` ile doğrulanır.

`DATABASE_URL` ve servis anahtarları **asla** `NEXT_PUBLIC_*` ile expose edilmez.

---

## Belgeler

| Belge                                    | İçerik                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| **[CLAUDE.md](CLAUDE.md)**               | Mimari kararlar, güvenlik kuralları, çalışma alışkanlıkları              |
| **[docs/DATABASE.md](docs/DATABASE.md)** | Kurulum, sağlayıcı geçmişi, taşıma yordamı, migration akışı, sürücü seçimi |
| **[docs/SEO.md](docs/SEO.md)**           | Teknik + içerik SEO, anahtar kelime haritası, yeni sayfa kontrol listesi |
| **[docs/AUDIT.md](docs/AUDIT.md)**       | Eylül 2026 denetimi: 71 bulgu, ne düzeltildi, ne açık kaldı              |
| **[docs/PROMPT.md](docs/PROMPT.md)**     | Ürün spec'i ve MVP kapsamı                                               |
| **[AGENTS.md](AGENTS.md)**               | Bu Next.js sürümüne özgü uyarı                                           |
