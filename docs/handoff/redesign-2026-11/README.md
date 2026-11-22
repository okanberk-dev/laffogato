# Devir: 21-22 Kas 2026 yeniden tasarımı

Bu klasör, site görünümünü Blue Bottle diline taşıyan işin yarıda kalan
kısmını devralan oturum içindir. Neyin neden yapıldığı:
`qa/DECISIONS.md` (karar kaydı) ve `CLAUDE.md` "Site görünümü 21 Kas
2026'dan beri Blue Bottle'ın dilinde". Tasarım kuralları ve inceleme ölçütü:
`qa/DESIGN-SPEC.md`.

Dal: `claude/peaceful-ramanujan-3os0qj`. PR: bu dalın draft PR'ı (açıklamasında
özet). Taban: `4962da2` (işe başlanırken `main`).

## Durum

Bitti:

- Eski görünüm silindi (15k satırlık CSS, yolculuk filmi, three.js, çizimler,
  hareket bileşenleri, eski tasarım belgeleri, `design-1-1-fidelity`).
- Yeni dil kuruldu: `src/styles/foundation.css` (token, taban, tipografi,
  düğmeler, alanlar, hukuki asgariler) + alan dosyaları (`chrome`, `sections`,
  `home`, `catalog`, `pages`, `karaoke`, `checkout`, `account`).
- Bütün müşteri sayfaları yeni dilde: anasayfa filmi (`home-hero.tsx`),
  krom, mağaza, ürün sayfası, menü, hikâye, ziyaret, kampanyalar, rehber,
  hukuk, 404/hata, karaoke sihirbazı (yalnız CSS), ödeme ve üye alanı (CSS
  taşındı, görünüş yeniden yazıldı).
- Belgeler: `CLAUDE.md`, `docs/BRAND.md`, `docs/MEDIA-LICENSES.md` (yeni),
  `docs/SKILLS.md`, `docs/FRONTEND-SINIR.md`,
  `.claude/skills/frontend-redesign/SKILL.md`.
- Doğrulama: `npm run typecheck`, `npm run lint -- --max-warnings=0` temiz;
  CI benzeri kopyada `NODE_ENV=production npm run build` geçti; arka yüz sınır
  diff'i boş (`src/lib`, `src/app/api`, action, route, `src/proxy.ts`, `db`,
  `scripts`, `next.config.ts`, `vercel.json`, `src/app/admin` değişmedi).
- Taşma taraması (25 sayfa × 6 genişlik, `qa/overlap.cjs`): sayfa düzeyinde
  yatay taşma yok; tek gerçek çakışma (dar kartta ad + fiyat) düzeltildi.
  Raporun geri kalanı yanlış alarmdı: `sr-only` metinler, bilerek kayan
  satırlar (çipler, gün seçimi, kart sırası), kapalı SSS cevapları.
- Kod denetiminden doğrulanan bir bulgu düzeltildi: hukuki tablolar ve
  karaoke satıcı satırı 16px'in altına düşmüştü (MSY m.6/1).

**22 Kas 2026, devralan oturum:** aşağıdaki beş madde yapıldı. Bulguların
durumu `FINDINGS.md`'nin başında; denetlenen sayfalar, kod incelemesi ve ek
düzeltmeler PR açıklamasında. Dal `main` ile birleştirildi (admin
StorageBox ve şube işleri).

Kalan (sırayla; tarihçe):

1. `FINDINGS.md`'deki açık bulguları doğrula ve düzelt. Önce `[high]`'lar:
   mağaza slaytları (panelin `/admin/magaza-hero` slaytları) ilerlemiyor ve
   renkleri ters; anasayfa SSS bloğundaki rehber bağlantıları; krom ve
   anasayfa bulguları. Her bulgu ajan raporudur: koda ve ekrana bakarak
   doğrula, yanlışsa geç.
2. Hiç denetlenmeyen alanları denetle: katalog (mağaza, ürün sayfası, hızlı
   bakış, filtre paneli), menü ve `/masa/<kod>`, hikâye/ziyaret/kampanyalar,
   rehber/hukuk/küçük sayfalar (`/bulten/onay`, `/bulten/cikis`,
   `/uygulama/dogrula`, `/uye/sifremi-unuttum`), karaoke sihirbazı adım adım
   (telefonda alt çubuk alanları örtmemeli), ödeme (iki adım, belge paneli)
   ve üye sayfaları. Telefon (360, 390), tablet (768) ve masaüstü (1440).
3. Kod denetiminin yapılmayan boyutları: ön yüz sözleşmesi ve kaybolan
   işlevler (form alan adları, işaretsiz onay kutuları, sepet anahtarı,
   yönlendirme bildirimleri), erişilebilirlik, performans (film ne kadar
   iniyor, LCP), mantık hataları (`home-hero.tsx`, `chrome.tsx`, `ui.tsx`,
   `shop-page.tsx`), kalıntılar (TSX satır içi stillerde tanımsız eski
   token'lar, kuralı olmayan sınıflar, yeni CSS'te ölü kural).
4. Her düzeltme turundan sonra: typecheck, lint `--max-warnings=0`, production
   build, sınır diff'i boş, değişen sayfaları telefonda ve masaüstünde
   gerçekten görüntüle.
5. CI yeşil olunca operatörün isteğiyle `main`'e birleştir (operatör: _"bitince
   maine gönder"_, _"dikkatli ilerle lütfen"_).

## Yerel QA ortamı

Canlı veritabanına dokunma. Kendi kabında yerel bir Postgres kur:

```bash
apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql
pg_ctlcluster 16 main start
su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres';\"" && su postgres -c "createdb laf_dev"
```

`.env.local` (git'e girmez; değerler yalnız yereldir, gerçek sır değil):

```
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/laf_dev
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_SESSION_SECRET=local-design-qa-admin-secret-0123456789abcdef
ADMIN_EMAIL=owner@example.com
ADMIN_PASSWORD=local-design-qa-password
CUSTOMER_SESSION_SECRET=local-design-qa-customer-secret-0123456789
PAYMENT_PROVIDER=paynkolay
PAYNKOLAY_BASE_URL=http://127.0.0.1:4010
PAYNKOLAY_SX=sx-test
PAYNKOLAY_SX_LIST=sx-list-test
PAYNKOLAY_SX_CANCEL=sx-cancel-test
PAYNKOLAY_MERCHANT_SECRET_KEY=merchant-secret-test
PAYNKOLAY_MERCHANT_NO=123456
PAYNKOLAY_SUCCESS_URL=http://localhost:3000/odeme/donus
PAYNKOLAY_FAIL_URL=http://localhost:3000/odeme/donus
PAYNKOLAY_CHECKOUT_MODE=direct
CRON_SECRET=local-cron
```

Şema, örnek veri (16 menü kalemi, 8 ürün, bir test üyesi), oturum çerezi ve
sunucu:

```bash
set -a; . ./.env.local; set +a
node scripts/db-migrate.mjs
psql "$DATABASE_URL" -q -f docs/handoff/redesign-2026-11/qa/seed.sql
export QA_DIR=/tmp/laffogato-qa; mkdir -p $QA_DIR/qa
node docs/handoff/redesign-2026-11/qa/mint-session.cjs
npm run dev -- -p 3000
```

Araçlar (`qa/`; çıktıları `$QA_DIR` altına yaz):

- `shot.cjs <url> <çıktı> <gen> <yük> <mobil 0|1>`: tam sayfa görüntü + yatay
  taşma ve konsol hataları (`SHOW_COOKIE=1` çerez şeridini bırakır).
- `member.cjs <yol> <çıktı> <gen> <yük> <mobil> <sepet 0|1>`: test üyesi
  olarak (ödeme ve `/uye/*` için).
- `chunks.py <klasör> <ad> <parça-px> <ölçek> [en-çok]`: uzun görüntüyü
  okunur parçalara böler.
- `overlap.cjs [yol-parçası]`: 25 sayfa × 6 genişlikte taşma ve çakışma
  taraması (yanlış alarmlar yukarıda).
- `interact.cjs <QA_DIR>`: hızlı bakış, sepet, menü paneli, arama, mobil menü
  ve filtre paneli hallerinin görüntüsü.
- `ref-study.cjs`, `ref-shot.cjs`: referans sitelerin görüntüsünü almak için
  (ortamın ağı bu alan adlarına açık olmalı; görüntüler yalnız karşılaştırma
  içindir, depoya girmez).

Not: tam sayfa görüntüde sabit çubuklar (telefondaki ödeme ve karaoke alt
çubuğu) sayfanın ortasında görünür; bu bir görüntü yan etkisidir. Next.js'in
sol alttaki "N" rozeti de yalnız geliştirmede çıkar.
