# Devir promptu: L'Affogato kalan işler (19 Ekim 2026)

Aşağıdaki iki prompt, GitHub'a bağlı bulut (Claude Code on the web) oturumlarında çalıştırılmak için yazıldı. Önce **Prompt A**'yı `RiosenBeq/laffogato` deposunda çalıştır. **Prompt B**'yi `RiosenBeq/lafmobil` deposunda, A'nın ilgili site PR'ları merge edildikçe çalıştır. Her şeyin kaynağı laffogato `main` dalındaki `docs/handoff/` klasörü.

---

## Prompt A (repo: RiosenBeq/laffogato)

L'Affogato sitesinin (Next.js 16, Vercel, production YALNIZ `main`'den) kalan işlerini baştan sona bitir. Her paket için: build, bağımsız inceleme, düzeltme, PR, yeşil CI, squash merge, production kontrolü.

**Önce oku:** `CLAUDE.md`, `AGENTS.md`, sonra `docs/handoff/README.md`, `docs/handoff/brief-cloud.md`, `docs/handoff/queue.json`.

**Bağlam.** 17-19 Ekim'de yerel bir orkestrasyon oturumu admin paneli denetimini (Wave 1-2 ve Wave 3'ün sunucu tarafı), hukuk programının ilk PR'larını, karaoke sihirbazını, yeni sipariş zilini ve daha fazlasını merge etti (#127-#159; liste `docs/handoff/README.md`). Kalan iş `docs/handoff/queue.json`'da; her maddenin şartnamesi `docs/handoff/items/<slug>.md`'de ve madde kendi kaynağını gösteriyor:
- denetim planı `docs/handoff/audit-fix-plan.md`, bulgular `docs/handoff/audit-verified.json`;
- hukuk programı `docs/handoff/legal-final-program.json`, Türkçe rapor `docs/handoff/legal-report-tr.md`;
- admin UI v2 `docs/handoff/admin-ui-final-design.md` ve `docs/handoff/admin-ui-final-items.json`.

**Sıra.**
1. Açık PR kaldıysa (#159 vb.) onu bitir ve merge et.
2. `queue.json`'da `handoffStatus` değeri `built-needs-review` olan dallar: dal GitHub'da duruyor, build raporu `docs/handoff/reports/<slug>-build.json`. Yeniden yazma. Bağımsız incelemeyi yap (`review` alanına göre: `adversarial` ise üç mercekle (para, erişim, gerileme) iddia listesi çıkar, sonra her mercek için tek doğrulayıcı iddiaları test ya da betikle çürütmeye çalışsın, yalnız ayakta kalanı testle düzelt; `security` ve `standard` ise tek dikkatli inceleme). Dalı `main` ile güncelle, draft PR aç, yeşil olunca merge et.
3. `partial-build` dallar: son commit `wip(...)`; build'i bitir, sonra 2. adımdaki gibi.
4. `todo` maddeler: `prio` sırasıyla ve `after` bağımlılıkları merge edildikten sonra.

**Kurallar** (`docs/handoff/brief-cloud.md` tam hali):
- Her PR'dan önce bulguyu güncel `main`'de yeniden doğrula; düzelmişse atla ve PR'da "Zaten düzelmiş / atlanan" altında yaz.
- Para, iade, stok, kupon, rıza ve hukuk PR'ları çürütmeye çalışan bağımsız incelemeden geçmeden merge edilmez. İnceleyen kodu yazan olmasın.
- Merge yalnız exact head'de "typecheck + test + build" ve Vercel yeşilken: `gh pr ready N` ve `gh pr merge N --squash --match-head-commit <sha>`. Sonra sıradaki PR'a `main`'i merge et (rebase ve force-push yok). `db/schema.sql` ve `src/lib/db/schema-sql.ts` elle birleştirilmez: `npm run db:bundle`. `docs/AUDIT.md` çakışmasında iki tarafın bölümleri de kalır. Migration adı `main`'deki en yeniden sonra sıralanmalı.
- Her merge'den sonra production'ın en yeni deployment'ı `main`'den gelmeli. Şu yollar 200 vermeli: `/`, `/odeme`, `/menu`, `/karaoke`, `/magaza`, `/admin/giris`, `/api/mobile/v1/shop`, `/api/mobile/v1/menu`.
- Önizlemeyi ya da eski deployment'ı ASLA production'a "promote" ya da "redeploy" etme. 18-19 Ekim'de bu yüzden eski kod 9,5 saat canlıda kaldı.
- Neon ücretsiz plan, en fazla 10 dal. Her merge'den sonra o PR'ın `preview/*` dalı silinmeli; `production` ve `vercel-dev`'e dokunma. Neon'a erişemiyorsan silinecek dalları bana yaz. Sınır dolunca Vercel kontrolü beklemede kalır.
- `/api/mobile/v1` yalnız eklemeli değişir. `docs/API-MOBILE.md` değişirse uygulama kopyası için Prompt B'ye not düş.
- Hukuk: avukat ya da mali müşavir turu yok (işletme kararı, 18 Ekim). Güncel Türk mevzuatından karar ver, PR'da "Hukuki dayanak" yaz. `src/lib/legal/meta.ts` içindeki `LEGAL_UPDATED` ya da `KARAOKE_LEGAL_UPDATED`'ı değiştiren en fazla bir PR aynı İstanbul gününde merge edilir ve o günün tarihini taşır.
- Para: kart verisi saklanmaz ve loglanmaz (kural 28). Ulaşılamayan POS "ödenmedi" sayılmaz (kural 29). Canlı POS ve gerçek kart yok, yalnız PayNkolay sandbox.
- Metin: Türkçe arayüz, müşteriye "sen", uzun tire (U+2013, U+2014) yok. Commit mesajları İngilizce, son satır `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR açıklaması Türkçe: "Ne değişti / Neden / Test / Notlar / riskler", gerekiyorsa "Hukuki dayanak", son satır `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Yeni paket yok; yalnız UI v2'nin sabit sürümleri: `lucide-react@1.51.0`, `react-aria-components@1.21.1`, `@internationalized/date@3.12.4` (`npm install --save-exact`).
- Bilinen gerçekler: e-fatura Paraşüt ile kesiliyor. Neon bölgesi aws-us-east-2. Kart saklama hiç açılmadı.

**Bitişte.**
- Her admin ekranının 390, 1024 ve 1280 px'te görsel taraması; taşma ve çakışmaları düzelt.
- Kullanılmayan dalları temizle.
- `queue.json` boşalınca `docs/handoff/README.md`'yi "tamamlandı" olarak güncelle.
- Bana kısa bir özet ver: merge edilen PR'lar, atlanan ya da zaten düzelmiş bulgular, açık kalanlar, benim yapmam gerekenler.

---

## Prompt B (repo: RiosenBeq/lafmobil)

L'Affogato uygulamasının (Expo) site ile senkron kalması gereken işlerini yap. Önce `CLAUDE.md` ve `AGENTS.md`'yi oku. Site deposundaki `docs/handoff/README.md`'nin "lafmobil follow-ups" bölümünü ve `docs/handoff/legal-final-program.json` içindeki `appPRs` listesini oku. Site deposuna erişimin yoksa bu dosyaları bana sor.

1. **Sözleşme senkronu:** Site `main`'indeki `docs/API-MOBILE.md`'yi bayt bayt `docs/API-MOBILE.md`'ye kopyala. `shasum -a 256 docs/API-MOBILE.md` ile yeni özeti `src/data/contract-sync.test.ts`'deki `RECONCILED`'a yaz. Bunu her site değişikliğinden sonra ayrı bir PR'la yap.
2. **Hukuk metinleri:** Site deposunda `npm run legal:export -- <lafmobil>/src/data/legal.seed.json`, ardından lafmobil'de `node scripts/legal-split.js`. Testler: `jest src/data`.
3. **Karaoke:** iptal kuralı sunucudan okunur (`cancellationRules`, rezervasyonun kendi `cancellableUntil`'i). Varsa `lateRefundPercent` ile geç iptalde iade payı gösterilir. Eski sabit "2 saat" cümleleri yalnız yedek olarak kalır. Bu sürüm asgari sürüm olunca site panelindeki kilit açılabilir: sitede `KARAOKE_POLICY_APP_VERSION`.
4. **Menü:** kalem başına alerjenler ve "Görseller temsilidir" notu. Mağaza: paketli gıda etiket alanları ve tarihli indirim rozeti, ilgili site PR'ları merge edildikten sonra.
5. **Diğer:** karaoke rezervasyon kodunu başkasına verme cümlesi; ödeme ve hukuk metni ekranlarındaki değişiklikler (`appPRs`).

**Kurallar:** API yalnız eklemeli; site PR'ı önce merge edilir; Türkçe "sen" dili, uzun tire yok; testler, typecheck ve lint yeşil olmadan merge yok; squash merge exact head ile. Bitişte kısa bir özet ver.
