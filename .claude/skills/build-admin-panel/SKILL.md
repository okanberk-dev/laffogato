---
name: build-admin-panel
description: Research, scope, build and verify a new admin panel area (a new section, a new entity, a new dashboard view) in the Laffogato admin at /admin, end to end. Use when the user asks to add or redesign an admin section, "admin paneline X ekle", "yönetim paneli", "backoffice", "panelde şunu yönet", or to research what the panel should manage. For a plain CRUD entity, add-admin-resource does the building; this skill is the research, scoping and real-browser verification around it.
---

# Admin paneline bir alan eklemek: araştır, kapsamı sor, kur, gerçekten doğrula

Yöntem, [Owais232/Admin-Panel-Skill-LLM-Models](https://github.com/Owais232/Admin-Panel-Skill-LLM-Models)
deposundaki `build-admin-panel` skill'inin altı aşamasından uyarlandı (o
depoda lisans yok; metin bizim, yöntem onların). Oradaki NestJS / REST /
CORS / ayrı panel projesi varsayımları burada geçerli değil: panelimiz aynı
Next.js uygulamasının içinde, veriyi sunucu bileşeni okur, yazımı server
action yapar. Aşağıdaki her adım bizim dosyalarımıza bağlı.

Bu skill şunlarla birlikte çalışır, onların yerine geçmez:
`add-admin-resource` (yeni CRUD varlığı: store + şema + action + sayfalar),
`server-action-pattern` (her mutation), `new-migration` (şema),
`docs/ADMIN.md` (panel davranışları), CLAUDE.md "Admin paneli görünümü" ve
"Admin arayüz kütüphaneleri".

## Aşama 1: Önce oku, sonra sor

Kod yazmadan önce neyin yönetileceğini koddan öğren. Rota listesi yetmez;
şunları oku:

1. **Veri katmanı.** Varlığın tipi ve okuyucusu `src/lib/**` altında
   (`src/lib/admin/store.ts` ya da alanın kendi `store.ts`'i). Hangi alanlar
   zorunlu, hangileri sistemin (sayaç, durum, zaman damgası; elle
   yazılmaz), hangi kolonda benzersizlik var (`db/schema.sql`), hangi sayaç
   SQL'de artıyor (CLAUDE.md kural 20). Şema tek kaynak `db/schema.sql`.
2. **Yetki.** Bölüm ve roller `src/lib/admin/roles.ts` (`AdminSection`,
   `sectionsFor`). Her action kendi `requireRole(<bölüm>)`'ünü çağırır;
   `proxy.ts` yalnız yönlendirmedir (kural 27). Yeni bölüm gerekiyorsa
   rollerin hangisinin göreceği bir kapsam sorusudur.
3. **İş kuralı action'da mı, kütüphanede mi?** Kural `*-core.ts`'te saf
   duruyorsa onu çağır, kopyalama. Web ve mobil aynı kuralı paylaşıyorsa
   (`karaoke-core`, `loyalty-core`) panel de aynı fonksiyona iner.
4. **Dışarıya etkisi.** Bu veri `/api/mobile/v1`'den uygulamaya mı gidiyor
   (`docs/API-MOBILE.md`, v1 yalnız ekleme), köşkün paneline mi
   (`docs/PANEL-*.md`, imzalı uçlar ve ping), e-postaya mı, faturaya mı
   (`docs/EARSIV.md`)? Panelde değişen bir alan bunlardan birini kırabilir.
5. **Önbellek.** Genel sayfalar `site-data.ts` önbelleğinden okur; panelde
   yazılan şeyin etiketini düşürmek gerekir (`src/lib/cache/tags.ts`,
   `revalidatePath`). Yazım sonrası sitede eski hâl görünüyorsa sebep budur.
6. **Görünüm kaynağı.** Panel StorageBox dilini izler (21 Kas 2026,
   Madame Coco Kenya paneli; tarif `docs/ADMIN-STORAGEBOX.md`, token'lar
   `src/app/admin/admin-theme.css`). Köşkün iç paneli (`RiosenBeq/lafmaliyet`) kendi AkmanOS
   temasında kaldı; desen için oraya değil tarife bak. Yeni bir desen icat etmeden önce
   kit'e bak: `src/components/admin/ui/` (`DataTable`, `StatusTabs`,
   `FilterBar`, `ActionMenu`, `ActionModal`, `Section`, `PageShell`,
   `Badge`, `Pagination`, `SavedViews`) ve `src/components/admin/forms.tsx`.
   Kütüphane sınırı: yalnız `lucide-react` (yalnız `ui/icons.tsx` üzerinden),
   `react-aria-components` ve `@internationalized/date`; Radix, cmdk,
   shadcn yok (`tests/admin-ui-deps.test.ts`).

## Aşama 2: Kapsamı kullanıcıya sor (varsayma)

Okuduktan sonra, kod yazmadan, şu kararları `AskUserQuestion` ile tek
seferde sor. Her birinin yanlış tahmini biten işi çöpe atar:

- **Arka yüz değişikliği kapsamda mı?** Yeni bir okuyucu, kolon ya da
  migration gerekiyorsa CLAUDE.md'nin ön yüz / arka yüz sınırına göre bu
  ayrı bir PR'dır. Kullanıcı yalnız görünüm istiyorsa mevcut okuyucularla
  ne yapılabildiğini açıkça söyle.
- **Hangi roller görecek, hangileri yazabilecek?** (sahip, yönetici,
  personel, kasiyer; `roles.ts`).
- **Hepsi mi, önce çekirdek mi?** Bulduğun alanları listele, kullanıcı
  seçsin. Varsayılan öneri: önce liste + detay + bir yazım, sonra gerisi.
- **Başkası adına kayıt:** panel bir üye adına kayıt açacaksa üyeyi
  mevcut müşterilerden mi seçer (combobox), yoksa yenisini mi açar? Üye
  kimliği Supabase'dir, `customers` satırı köprüyle bağlanır
  (`docs/AUTH-BRIDGE.md`); yeni üye açmak küçük bir iş değildir.
- **Görsel yükleme:** mevcut yükleyici (`image-upload.tsx`, `/gorsel/**`)
  mi, yoksa ilk sürümde yalnız mevcut görsellerden seçim mi?
- **Uygulamaya ya da köşk paneline yansıyacak mı?** Yansıyacaksa
  sözleşme belgesi aynı PR'da güncellenir.

## Aşama 3: Plan

- Sıra: (0) gerekiyorsa migration + `npm run db:bundle`, (1) store okuyucusu
  ve Zod şeması, (2) liste sayfası + detay + **bir** yazım, uçtan uca
  doğrulanmış, (3) kalan yazımlar, (4) gezinme: kenar menüsü
  (`admin-sidebar.tsx`), palet (`palette-core.ts`), kısayol
  (`shortcut-core.ts`) ve gerekiyorsa Genel bakış uyarısı.
- Yeni alanlı ürün formu ise CLAUDE.md'deki "5 yer" kuralı geçerli.
- Her yazım: Zod parse → store → `safeAudit` → `revalidatePath` (kural 3-5).
  Para alanı `parseMoneyInput()` (kural 24), tarih `Europe/Istanbul`
  (kural 22).

## Aşama 4: Kur, her adımda doğrula

- Her adımdan sonra `npm run typecheck` ve ilgili testler. Hata
  biriktirme.
- **Geliştirme sunucusu açıkken aynı klasörde `next build` çalıştırma:**
  `.next` önbelleği ezilir, sayfa 200 döner ama her JS parçası 404 olur ve
  panel "yükleniyor"da kalır; yetki hatası gibi görünür. Önce sunucuyu
  durdur ya da build'i ayrı klasörde al. Bu ortamda build:
  `NODE_ENV=production npm run build` (CLAUDE.md "Geliştirme Komutları").

## Aşama 5: Gerçekten doğrula ("derleniyor" yetmez)

1. **Yerel altyapı.** Postgres 16 ayakta olsun; `.env.example`'ı oku,
   `.env.local`'ı tahminle doldurma. Gerekli olanlar: `DATABASE_URL`,
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (≥32 karakter),
   `PAYMENT_PROVIDER=mock`, `PAYMENT_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`.
   Şema ilk sorguda kendiliğinden kurulur; test verisi için `seed-db`.
2. **İlk giriş.** Sahip hesabı ortam değişkenlerinden gelir, tohumlama
   gerekmez; iki adımlı doğrulama açılmışsa TOTP kodu gerekir. Personel
   hesapları Kullanıcılar'dan açılır.
3. **Tarayıcıyla gez.** `scripts/admin-crawl.mjs` (bu skill'in klasöründe)
   giriş yapar (e-posta + parola; `ADMIN_TOTP_SECRET` verilirse kodu
   kendisi üretir), `/admin`'den bağlantıları izleyerek her panel sayfasını
   açar, durum kodunu, konsol hatalarını, sayfa hatalarını ve 4xx/5xx
   istekleri toplar; sonra görülen her iç bağlantıyı yoklar; Genel
   bakış'ın tam sayfa görüntüsünü kaydeder:

   ```bash
   BASE_URL=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... \
     node .claude/skills/build-admin-panel/scripts/admin-crawl.mjs
   ```

   Playwright projede bağımlılık değildir; betik onu genel kurulumdan
   (`npm root -g`, bu ortamda `/opt/node-tools`) bulur, Chromium
   `/opt/pw-browsers`'tadır. CSV / QR / indirme / çıkış bağlantıları
   gezilmez.
4. **Bir yazım, arayüzden.** Yalnız GET yetmez: yeni alanda en az bir
   kaydı formdan oluştur ya da değiştir, toast'ı ve sonucu gör, olay
   kaydına düştüğünü kontrol et.
5. **İki genişlik.** 390 px dokunmatik ve 1280 px; yatay taşma, üst üste
   binme, 44 px dokunma hedefi (CLAUDE.md "Görsel değişiklik yaptıysan").
   Ekran görüntüsünü gözle incele: düzen hataları testle değil gözle
   yakalanır.
6. **Testler.** Kit testleri (`tests/admin-*.test.ts`) ve varsa
   `TEST_DATABASE_URL` ile gerçek Postgres testi.

## Aşama 6: Yayın

- Akış: taslak PR → yerel kapılar (typecheck, `eslint --max-warnings=0`,
  tam `vitest run` gerçek Postgres'le, build) → squash merge "(#N)".
  Vercel `main`'den yayınlar; migration'ı uygulama kendisi uygular
  (`ensureSchemaFresh`), elle `db:migrate` gerekmez.
- **Kod yayını veri yaratmaz.** Yeni bölüm için bir ayar, rol ya da kayıt
  gerekiyorsa (ör. yeni bir personel hesabı, bir ortam değişkeni) bu ayrı
  bir adımdır ve kullanıcıya açıkça söylenir; Vercel değişkeni değişince
  yeniden yayın gerekir.
- Yayından sonra canlı sitede `/api/health` ve Vercel çalışma zamanı
  hatalarına bak. Canlı panelde yazım denemesini kullanıcı yapar: üretim
  verisine test kaydı yazma.
