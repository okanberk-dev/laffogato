# Proje skill'leri (`.claude/skills/`)

Claude Code bu klasördeki her skill'i oturum başında tanır ve konusu gelince
kendiliğinden yükler. Kendi yazdıklarımız projenin iş akışıdır; dışarıdan
alınanlar (22 Ekim 2026, operatörün isteğiyle) olduğu gibi kopyalandı ve her
birinin başına **"Bu projede"** bölümü eklendi: o bölüm skill'in geri
kalanından önce gelir ve projenin kurallarıyla (CLAUDE.md, `docs/BRAND.md`,
`docs/IYS.md`, `docs/FRONTEND-SINIR.md`) çatışan yerleri kapatır.

## Bizim yazdıklarımız

| Skill | Ne için |
|---|---|
| `add-admin-resource` | Panele yeni bir CRUD varlığı |
| `server-action-pattern` | Her mutation: Zod → store → revalidate → redirect |
| `new-migration` | Şema değişikliği + `db:bundle` |
| `seed-db` | Yerel test verisi |
| `frontend-redesign` | Müşteri arayüzü, arka yüze dokunmadan |
| `design-1-1-fidelity` | SPA'nın tasarım kaynağına sadakati |
| `build-admin-panel` | Panelde yeni bir alan: araştır, kapsamı sor, kur, **gerçek tarayıcıyla doğrula** (`scripts/admin-crawl.mjs`) |

`build-admin-panel`'in yöntemi
[Owais232/Admin-Panel-Skill-LLM-Models](https://github.com/Owais232/Admin-Panel-Skill-LLM-Models)
deposundaki altı aşamadan uyarlandı. O depoda lisans olmadığı için metin
kopyalanmadı; yöntem bizim dosyalarımıza bağlanarak yeniden yazıldı. Tarama
betiği giriş yapar (iki adımlı doğrulama açıksa `ADMIN_TOTP_SECRET` ile kodu
üretir), `/admin`'den her panel sayfasını gezer, konsol hatalarını, sayfa
hatalarını ve 4xx/5xx istekleri toplar, gördüğü her iç bağlantıyı yoklar ve
Genel bakış'ın ekran görüntüsünü alır. Form göndermez.

## Dışarıdan alınanlar

| Skill | Kaynak | Lisans | Neden |
|---|---|---|---|
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills) `skills/frontend-design` @ `dbd4588` | Apache 2.0 | Tasarım planı → gözden geçir → kur → eleştir süreci, arayüz yazımı |
| `frontend-design-principles` | [joshuadavidthomas/agent-skills](https://github.com/joshuadavidthomas/agent-skills) @ `516dee7` | MIT | Gösterime çıkmadan kontroller, anti-desenler, durumlar |
| `copywriting` | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) @ `e85f3cb` | MIT | Sayfa ve ürün metni |
| `cro` | aynı | MIT | Sayfa ve form dönüşümü (öneri) |
| `emails` | aynı | MIT | Kampanya ve yaşam döngüsü e-postası (İYS kapısıyla) |
| `social` | aynı | MIT | Instagram / TikTok içeriği |
| `referrals` | aynı | MIT | Davet ve yorum programı (kurallar operatörün) |
| `seo-audit` | aynı | MIT | Teknik ve yerel SEO denetimi |

`aso` (App Store / Google Play listelemesi) uygulamanın deposunda:
`RiosenBeq/lafmobil` `.claude/skills/aso`.

Pazarlama paketinin 50'yi aşkın skill'inden yalnız bunlar alındı: geri
kalanların çoğu SaaS'a yöneliktir (deneme süresi, paywall, churn, soğuk
e-posta, B2B satış) ya da projenin kurallarıyla çatışır (`popups`, `sms`,
`cold-email`, `ads`). `product-marketing` bilerek alınmadı: depoyu tarayıp
`.agents/` altında BRAND.md ile yarışan ikinci bir marka belgesi yazıyor.
Onun yerine pazarlama skill'lerinin okuduğu bağlam dosyası elle tutulur:
`.claude/product-marketing.md` (yalnız kaynak dosyalara işaret eder).

Alınırken her dosya baştan sona okundu. Bulunanlar ve "Bu projede"
bölümlerinin kapattıkları:

- Gizli metin, komut enjeksiyonu yok.
- **Dış ağ işlemleri:** `social` dinleme tarifleri (curl, brew/apt,
  tarayıcı oturumu, Apify ile kazıma), `cro` veri zenginleştirme
  (HubSpot, Clay, Apollo), `emails` araç kılavuzları (Resend MCP ile
  doğrudan gönderim **İYS kapısını atlar**), `seo-audit` Search Console
  işlemleri. Hepsi kullanıcı açıkça istemeden yapılmaz.
- **Kural çatışmaları:** rıza olmadan ölçüm (çerez rızasını "sürtünme" diye
  ele alma, ısı haritası, açılma pikseli), sağlık iddiasına kayan kalıplar,
  uydurma sosyal kanıt ve sahte aciliyet, işlemsel e-postada pazarlama,
  çok dilli SEO, Semrush'sız yeni sayfa, sadakat ödüllerini yeniden
  tasarlamak.
- Kaynak pazarlama deposunun kök `CLAUDE.md`'si alınmadı: her oturumda
  GitHub'dan sürüm dosyası çekmeyi ve `git pull` yapmayı söylüyor.

## Güncelleme

Dışarıdan alınan bir skill kendiliğinden güncellenmez. Yeni sürüm almak ayrı
bir PR'dır: kaynağı yeniden indir, değişen dosyaları baştan sona oku, "Bu
projede" bölümünü koru, bu tablodaki commit'i güncelle. Lisans dosyası
(`LICENSE` / `LICENSE.txt`) her klasörde kalır.
