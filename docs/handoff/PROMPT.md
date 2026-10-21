# Devir promptu: L'Affogato kalan işler (19 Ekim 2026)

Aşağıdaki iki prompt, GitHub'a bağlı bulut (Claude Code on the web) oturumlarında çalıştırılmak için yazıldı. Her biri kendi deposunda, ayrı bir oturumda çalışır; bir oturum öbür depoya geçmez. Önce **Prompt A**'yı `RiosenBeq/laffogato` deposunda başlat. **Prompt B**'yi `RiosenBeq/lafmobil` deposunda aynı anda başlatabilirsin: site işini bekleyen parçaları kendisi bekletir. Site tarafının kaynağı laffogato `main`'deki `docs/handoff/`, uygulama tarafınınki lafmobil `main`'deki `docs/site-handoff/`. İki depoya birden dokunan senkron (sözleşme kopyası, hukuk metni dışa aktarımı) yerel oturumda yapılır.

---

## Prompt A (repo: RiosenBeq/laffogato)

L'Affogato sitesinin (Next.js 16, Vercel, production YALNIZ `main`'den) kalan işlerini baştan sona bitir. Her paket için: build, bağımsız inceleme, düzeltme, PR, yeşil CI, squash merge, production kontrolü.

**Önce oku:** `CLAUDE.md`, `AGENTS.md`, sonra `docs/handoff/README.md`, `docs/handoff/brief-cloud.md`, `docs/handoff/queue.json`.

**Bağlam.** 17-19 Ekim'de yerel bir orkestrasyon oturumu admin paneli denetimini (Wave 1-2 ve Wave 3'ün sunucu tarafı), hukuk programının ilk PR'larını, karaoke sihirbazını, yeni sipariş zilini ve daha fazlasını merge etti (#127-#159; liste `docs/handoff/README.md`). Kalan iş `docs/handoff/queue.json`'da; her maddenin şartnamesi `docs/handoff/items/<slug>.md`'de ve madde kendi kaynağını gösteriyor:
- denetim planı `docs/handoff/audit-fix-plan.md`, bulgular `docs/handoff/audit-verified.json`;
- hukuk programı `docs/handoff/legal-final-program.json`, Türkçe rapor `docs/handoff/legal-report-tr.md`;
- admin UI v2 `docs/handoff/admin-ui-final-design.md` ve `docs/handoff/admin-ui-final-items.json`.

**Sıra.**
1. Açık PR kaldıysa onu bitir ve merge et.
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
- `/api/mobile/v1` yalnız eklemeli değişir. lafmobil'e push edemezsin: `docs/API-MOBILE.md` ya da hukuk metinleri değişirse PR'a "lafmobil senkronu gerekiyor" yaz ve bitiş özetinde listele.
- Hukuk: avukat ya da mali müşavir turu yok (işletme kararı, 18 Ekim). Güncel Türk mevzuatından karar ver, PR'da "Hukuki dayanak" yaz. `src/lib/legal/meta.ts` içindeki `LEGAL_UPDATED` ya da `KARAOKE_LEGAL_UPDATED`'ı değiştiren PR o günün (yayın gününün) tarihini taşır. 21 Ekim 2026'ya kadar bu PR'lardan en fazla biri aynı İstanbul gününde merge edilirdi (D-SAME-DAY) ve hukuk maddeleri bu yüzden birkaç güne yayılırdı; kural durable-copy PR'ıyla (legal-durable-copy, LEGAL-REDLINES §25) bitti: onay kaydı artık gösterilen her metnin hash'ini sürüm etiketinin yanında tutuyor ve metin `legal_doc_versions`'ta saklanıyor. Ertesi gün aynı oturuma "devam" yazılınca kaldığın yerden sürdür.
- Para: kart verisi saklanmaz ve loglanmaz (kural 28). Ulaşılamayan POS "ödenmedi" sayılmaz (kural 29). Canlı POS ve gerçek kart yok, yalnız PayNkolay sandbox.
- Metin: Türkçe arayüz, müşteriye "sen", uzun tire (U+2013, U+2014) yok. Commit mesajları İngilizce, son satır `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR açıklaması Türkçe: "Ne değişti / Neden / Test / Notlar / riskler", gerekiyorsa "Hukuki dayanak", son satır `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Yeni paket yok; yalnız UI v2'nin sabit sürümleri: `lucide-react@1.51.0`, `react-aria-components@1.21.1`, `@internationalized/date@3.12.4` (`npm install --save-exact`).
- Bilinen gerçekler: e-fatura Paraşüt ile kesiliyor. Neon bölgesi aws-us-east-2. Kart saklama hiç açılmadı.

**Bitişte.**
- Her admin ekranının 390, 1024 ve 1280 px'te görsel taraması; taşma ve çakışmaları düzelt.
- Kullanılmayan dalları temizle.
- `queue.json` boşalınca `docs/handoff/README.md`'yi "tamamlandı" olarak güncelle.
- Bana kısa bir özet ver: merge edilen PR'lar, atlanan ya da zaten düzelmiş bulgular, açık kalanlar, lafmobil senkronu gereken PR'lar, benim yapmam gerekenler.

---

## Prompt B (repo: RiosenBeq/lafmobil)

L'Affogato uygulamasının (Expo) site ile senkron kalması gereken işlerini yap. Önce `CLAUDE.md` ve `AGENTS.md`'yi, sonra `docs/site-handoff/README.md`'yi oku. Site deposu (`RiosenBeq/laffogato`) private; ona erişimin yok ve gerekmiyor: gereken her şey `docs/site-handoff/` içinde (site `main` `c1b55c7`'den kopya).

**İş listesi:** `docs/site-handoff/legal-final-program.json` içindeki `appPRs` (`app-legal-sync-1`, `-2`, `-3`; her değişikliğin dosyası ve birebir Türkçe metni orada, gerekçesi `decisionsTr`'de). Alan adları ve davranış `docs/API-MOBILE.md`'de.

**Sıra.**
1. Sitesi zaten merge edilmiş ya da siteye bağlı olmayan kısımlar, şimdi ve ayrı bir PR'da (bekleyen parçaları içine katma):
   - Karaoke: iptal kuralı sunucudan okunur (`GET /karaoke/availability` `cancellationRules` ve `freeCancelHours`, olduğu gibi yazılır; rezervasyonun kendi `cancellableUntil`'i). Eski sabit "2 saat" cümleleri yalnız sunucu alanı yokken yedek olarak kalır. `lateRefundPercent` ve rezervasyon başına `refundMinor` sözleşmede henüz yok, okuma. `cancelOutcome`'un tam anı "geç" saymasını düzelt (`ASK-Y3-4`). Bu sürüm asgari sürüm olunca site panelindeki kilit açılabilir: PR'da sürüm numarasını yaz, sitedeki `KARAOKE_POLICY_APP_VERSION`'ı ben değiştireceğim.
   - Menü: kalem başına alerjenler (`app-menu-allergens`; alan yoksa "henüz girilmedi", `[]` ise "14 grubun hiçbiri") ve kalem ekranında "Görseller temsilidir" notu (`ASK-OTH-1`, MenuPhotoNote).
   - Siteye bağlı olmayan metinler: giriş ekranı alt metni (Kullanım Koşulları kabulü ile Gizlilik Politikası bilgilendirmesi ayrı; `app-auth-footer-privacy-wording`), fA'L bilgilendirme ekranı (`ASK-FAL-1`), cüzdan metinleri (`ASK-CARD-TEXT`, wallet).
2. `README.md`'deki "Site work still in the site queue" tablosunda bekleyen site işine bağlı değişiklikler o site işi merge edilene kadar bekler: ödeme metinleri (`withdrawalShop`, `cardHint`, `cardNotStored`, 16 pt), karaoke rezervasyon kodunu başkasına verme cümlesi (`karaoke-terms`), mağaza etiket alanları ve tarihli indirim rozeti, kasa kartı hata metni (`ASK-LOYALTY`). Merge olup olmadığını bilmiyorsan bana sor, tahmin etme.
3. DOKUNMA: `docs/API-MOBILE.md`, `src/data/contract-sync.test.ts` içindeki `RECONCILED`, `src/data/legal.seed.json`, `src/data/legal-index.seed.json`, `assets/legal/legal-docs.txt`. Bunlar iki depoya birden erişen yerel oturumda üretilir. Bir değişiklik bunlara bağlıysa PR'da "yerel senkron bekliyor" diye yaz.

**Kurallar:** API yalnız eklemeli; yeni bir sunucu alanı gerekiyorsa uydurma, bana yaz (önce site PR'ı merge edilir). Her PR `origin/main`'den dallanır (`feat/saved-cards-copy`'den değil). Türkçe "sen" dili, uzun tire (U+2013, U+2014) yok. Commit mesajları İngilizce, son satır `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR açıklaması Türkçe: "Ne değişti / Neden / Test / Notlar / riskler", son satır `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. `npm run typecheck`, `npx eslint src --max-warnings 0` ve `npm test` yeşil olmadan merge yok; merge `gh pr merge N --squash --match-head-commit <sha>` ile.

**Bitişte** kısa bir özet ver: merge edilen PR'lar, bekleyen site işleri yüzünden kalanlar, yerel senkron gereken dosyalar, asgari sürüm yapılacak uygulama sürümü.
