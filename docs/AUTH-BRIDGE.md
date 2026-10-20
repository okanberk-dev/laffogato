# AUTH-BRIDGE - site ile uygulamanın ortak üyeliği

> Bu belge `src/lib/supabase/**`, `src/lib/customer/supabase-*.ts`,
> `src/lib/mobile/auth*.ts`, `src/proxy.ts` ve `src/app/uye/actions.ts`'in
> neden böyle yazıldığını anlatır. Sözleşme `docs/API-MOBILE.md` §0'dadır;
> veri taşıma `docs/SUPABASE-GECIS.md`'dir - bu belge o işten bağımsızdır.

---

## 0. Karar

| Ne                                                        | Nerede                                               |
| --------------------------------------------------------- | ---------------------------------------------------- |
| **Kimlik** (kim olduğun: e-posta + parola, token, oturum) | **Supabase Auth** - tek proje, hem site hem uygulama |
| **Üye kaydı** (`customers`), sipariş, kupon, damga, para  | **Bu projenin Postgres'i** (`pg`, `src/lib/db`)      |

Supabase burada **yalnız kimliktir**. Hiçbir sipariş, fiyat ya da üye verisi
Supabase'e yazılmaz. Bu ayrımın sebebi `docs/DATABASE.md`'deki sağlayıcı
geçmişi ve `docs/API-MOBILE.md` §0 kuralı: sipariş ve paranın tek doğruluk
kaynağı Neon Postgres'tir.

Bir e-posta = bir üyelik. Sitede yıllar önce kayıt olan bir üye uygulamayı
kurduğunda **aynı `customers` satırına** iner; uygulamada kayıt olan bir üye
siteye Supabase parolasıyla girer.

## 1. Parçalar

```
src/lib/supabase/
  config.ts   → SUPABASE_URL · SUPABASE_PUBLISHABLE_KEY
                (istemci-güvenli; env yoksa herkese açık varsayılanlar)
  anon.ts     → getSupabaseAnonClient()  - durumsuz; yalnız bearer doğrulama
  server.ts   → createSupabaseServerClient() - çerez tabanlı (site oturumu)
  proxy.ts    → hasSupabaseSessionCookie() · updateSession() - token yenileme
src/proxy.ts  → 1) updateSession  2) admin çerez koruması (AYNEN)
src/lib/customer/
  supabase-link-plan.ts → planCustomerLink() vb. - SAF karar mantığı (test)
  supabase-bridge.ts    → ensureCustomerForSupabaseUser() · linkCustomerToSupabase()
                          · linkIdentityAfterReset()
src/lib/mobile/
  auth-core.ts → parseBearerToken() · classifyAuthError() - saf
  auth.ts      → requireMobileCustomer(request) - route'ların kapısı
  respond.ts   → apiError() · apiJson()
```

**Servis anahtarı yalnız `src/lib/supabase/admin.ts` tarafından okunur** -
kapatılan hesabın Supabase kimliğini silmek, burada sıfırlanan parolayı
Supabase'e yazmak (ve bağlanmamış satırın kimliğini bulmak) ve günlük cron'un
Supabase yoklaması için. `.env.example`'da adı geçer, değeri boştur;
`NEXT_PUBLIC_` öneki yoktur, yani tarayıcıya ya da uygulama paketine hiç
girmez. Anahtar tanımlı değilse işler atlanır ve kod eski, temkinli
davranışına döner (§5). Atlama artık sessiz değil: sunucu günlüğüne
`[supabase] password sync skipped` / `[deleteMe] identity skipped` nedeniyle
yazılır ve `/admin/ayarlar` sayfasının başında "Supabase servis anahtarı:
tanımlı / tanımlı değil" satırı durur (`hasServiceRole()`; yalnız varlık,
değer asla gösterilmez). Publishable anahtar ve proje URL'si herkese açıktır (tarayıcıya ve
uygulamaya verilmek için tasarlanmıştır) ve `.env.example`'da değerleriyle
durur; env boşsa `config.ts` aynı değerlere düşer, böylece env'siz bir preview
deploy da aynı projeye giriş yapabilir.

### Hangi anahtar: `SUPABASE_SECRET_KEY` önce (20 Eki 2026)

Supabase eski JWT anahtarlarını (`anon`, `service_role`) 2026 sonunda
kaldırıyor ve yerlerine `sb_publishable_…` / `sb_secret_…` anahtarlarını
koyuyor. İkisi de aynı servis rolünü verir. `admin.ts` önce
**`SUPABASE_SECRET_KEY`**'i okur (Vercel'de tanımlı); yalnız o tanımsız, boş
ya da yalnız boşluksa eski **`SUPABASE_SERVICE_ROLE_KEY`**'e düşer. Biri
yanlışsa öbürüne geçmez: tanımlı olan anahtar kullanılır, reddedilirse iş
`failed` olur ve günlüğe yazılır. İkisi de yoksa davranış bugünkünün aynısıdır
(`skipped`, günlükte iki adı da söyleyen neden). Eski anahtar Supabase
panelinden kapatıldıktan sonra Vercel'den silinebilir.

Ne doğrulandı ve nereden:

- **Gizli anahtar JWT değildir, yalnız `apikey` başlığında gider.** Supabase
  belgeleri: "Publishable and secret keys are short strings, not JWTs" ve
  "Send publishable and secret keys on the `apikey` header, not on
  `Authorization: Bearer`" (https://supabase.com/docs/guides/api/api-keys).
  Duyuru (https://github.com/orgs/supabase/discussions/29260): Authorization
  başlığına ya kullanıcının JWT'si konur ya da boş bırakılır; geriye uyum
  için yalnız değeri `apikey` ile birebir aynıysa kabul edilir. Bu yüzden
  `admin.ts`'in doğrudan çağrıları (`findSupabaseIdentityByEmail`,
  `keepSupabaseAwake`) yeni anahtarı **yalnız `apikey`** ile gönderir; eski
  JWT anahtarla bugünkü `apikey` + `Authorization: Bearer` çifti sürer
  (GoTrue rolü o JWT'den okur). Yalnız `apikey` taşıyan istek barındırılan
  platformda da çalışır: Supabase'in REST hızlı başlangıcı yeni anahtarı
  Authorization'sız gönderir (https://supabase.com/docs/guides/api/quickstart),
  ağ geçidi isteği anahtarın rolüne çevirir (secret → `service_role`).
- **supabase-js 2.117.1 iki biçimi de kabul eder.** `node_modules` içinde
  okundu: `createClient` `sb_secret_` anahtarını tanır (`isNewApiKey`,
  `src/lib/fetch.ts`; uyarı yok). Auth istemcisi her anahtarla `apikey` ve
  `Authorization: Bearer <anahtar>` gönderir (`_initSupabaseAuthClient`,
  `src/SupabaseClient.ts` 649-652; `dist/index.mjs` 841-845) ve
  `auth.admin.*` aynı başlıkları kullanır (`auth-js` `GoTrueClient.ts`
  440-445, `GoTrueAdminApi.ts` `deleteUser`): yeni anahtarla iki değer
  birebir aynı olduğu için yukarıdaki geriye uyum kuralına girer. Edge
  Functions için SDK bunu da yapmaz (`omitApiKeyAsBearer`). Supabase'in
  sunucu tarafı yönetici örneği istemciyi `autoRefreshToken: false`,
  `persistSession: false` ile kurar
  (https://supabase.com/docs/reference/javascript/admin-api); `admin.ts`
  bunlara `detectSessionInUrl: false`'u ekler, oturum tutmaz, yenilemez.
  İstemci anahtara bağlı önbelleklenir: anahtar değişirse yenisi kurulur.
- **Doğrulanamayan:** üretimde yeni anahtarla gerçek bir çağrı. Günlük cron
  (`CRON_SECRET` Vercel'de "sensitive", elle çağrılamaz) ilk sabah
  yoklamayı yeni anahtarla yapar. Testler: `tests/supabase-secret-key.test.ts`
  (yalnız yeni, yalnız eski, ikisi, hiçbiri; anahtar hiçbir günlükte ve
  sonuçta yok).

## 2. Uygulama → API: bearer token

```
Authorization: Bearer <Supabase access JWT>
      │
      ▼ parseBearerToken            (biçim bozuksa 401 unauthorized)
      ▼ supabase.auth.getUser(jwt)  (Supabase doğrular; yerelde JWT çözülmez)
      │     4xx → 401 unauthorized · ağ/5xx → 503 auth_unavailable
      ▼ ensureCustomerForSupabaseUser(user)
      │     e-posta normalize (trim + invariant küçük harf) → customers satırı
      │     yoksa OLUŞTUR (passwordHash "", emailVerified = !!email_confirmed_at)
      │     varsa supabaseUserId yaz, doğrulamayı yükselt, boş ad/telefonu doldur
      │     isActive=false → 403 account_disabled · DB ulaşılamıyor → 503 unavailable
      ▼ { ok: true, customer: PublicCustomer, user, supabaseUserId }
```

Route'lar tek satırla kullanır:

```ts
const auth = await requireMobileCustomer(request);
if (!auth.ok) return auth.response;
// auth.customer.email normalize edilmiştir
```

Neden token yerelde çözülmüyor: imza anahtarı gerekmez, iptal edilen bir
kullanıcı token süresi dolmadan reddedilir, ve JWT biçimi Supabase'in
değiştirebileceği bir ayrıntı olarak dışarıda kalır.

Satır ilk kez oluşturulurken ya da doğrulama bu anda yükselirken sitenin
**hoş geldin kuponu** aynı kuralla (idempotent, best-effort) verilir -
ikinci bir kural icat edilmedi.

## 3. Site girişi: önce Supabase, sonra bcrypt

`src/app/uye/actions.ts`:

- **loginAction**
  1. `signInWithPassword` (çerezli sunucu istemcisi). Başarılıysa
     `ensureCustomerForSupabaseUser` → satır eşle/oluştur → mevcut
     `setActiveCustomerSession` (sitenin imzalı çerezi) - yani site oturumu
     **değişmedi**, yalnız kimlik doğrulama Supabase'e taşındı.
  2. Supabase reddederse (henüz orada yok, parola farklı, servis kapalı)
     **mevcut bcrypt akışı AYNEN** çalışır.
  3. bcrypt başarılıysa ve satır hiç bağlanmamışsa **tek seferlik**
     `linkCustomerToSupabase` (`signUp` az önce kanıtlanan parolayla).
     Sonuç ne olursa olsun `supabaseLinkAttemptedAt` damgalanır; bir daha
     denenmez (`shouldAttemptSupabaseLink`).
- **registerAction**: mevcut kayıt akışı + aynı `signUp` köprüsü. Sitenin
  kendi doğrulama e-postası gitmeye devam eder; Supabase'in doğrulama
  e-postası `SITE.url + /uye/giris?dogrulandi=1`'e döner.
- **logoutAction**: Supabase `signOut` + sitenin mevcut çıkışı.

**Obfuscated user tuzağı:** "Confirm email" açıkken Supabase, var olan bir
adres için `signUp`'a rastgele id'li ve `identities: []` olan sahte bir
kullanıcı döner (üye sayımı yapılmasın diye). `linkableUserId` bu id'yi
**kaydetmez**; satır bağlanmamış kalır ve üye bir sonraki Supabase girişinde
gerçek id ile eşlenir.

## 4. `src/proxy.ts`: oturum yenileme

Server Component çerez yazamaz; süresi dolan access token tarayıcıda kalırdı.
`updateSession` her sayfa isteğinde (Supabase çerezi varsa) `getUser()`
çağırarak yenilemeyi tetikler ve dönen çerezleri hem isteğe hem yanıta yazar.
Admin koruması aynen durur; admin yönlendirmesine yenilenen çerezler
kopyalanır. `api/mobile` ve `api/webhooks` matcher dışındadır - biri bearer,
diğeri HMAC kullanır, yenilenecek çerezleri yoktur.

## 5. Sınırlar ve bilinçli boşluklar

- `DELETE /me`: Neon satırı anonimleştirilir ve hesap kapanır; Supabase
  kullanıcısı, dağıtımda `SUPABASE_SERVICE_ROLE_KEY` tanımlıysa **silinir**
  (`deleteSupabaseIdentity`, `src/lib/supabase/admin.ts`). Anahtar yoksa ya
  da silme başarısız olursa kimlik Supabase'de kalır, ama kapalı satır
  `supabaseUserId`'yi tutar ve `ensureCustomerForSupabaseUser` o kimliğe
  yeni üyelik açmaz (403 `account_disabled`). Ne olduğunu yanıttaki
  `identity` söyler (`deleted` · `skipped` · `failed`, `docs/API-MOBILE.md`
  §4); uygulama oturumu her durumda kapatır.
- **Bağlanmamış satırda sıfırlama (23 Eyl 2026'dan beri kapalı).**
  `supabaseUserId` boş bir satırda `resetPasswordWithToken`'ın aynası yazacak
  bir kimlik bulamaz; tek seferlik köprü denemesi "obfuscated user" tuzağına
  düşmüşse (§3) o adreste bir Supabase hesabı vardır ve sitede sıfırlanan
  parola orada eski kalırdı, yani uygulamaya ESKİ parolayla girilebilirdi.
  Artık `resetPasswordAction`, sıfırlama tamamlandıktan sonra
  `linkIdentityAfterReset`'i çağırır: GoTrue'nun `GET /admin/users?filter=`
  ucuyla (supabase-js `listUsers` bu parametreyi geçmiyor; Supabase
  panelinin arama kutusu aynı ucu kullanır) adresteki kimliği bulur, yalnız
  **birebir** adres eşleşmesini sayar (filtre `LIKE %…%`'dir ve `_` joker
  karakterdir), kimliği satıra bağlar, yeni parolayı oraya da yazar ve
  yazma doğrulanırsa `passwordMirroredAt`'i damgalar. Sıra: önce parola,
  sonra satırın hâlâ bağlanmamış olmasına koşullu bağlama.
  Bağlanmayan durumlar (bugünkü davranış sürer): anahtar yok (hiçbir şey
  okunmaz), adreste kimlik yok, kimlik Supabase'de **doğrulanmamış** (onu
  bağlamak sitedeki girişi de kilitlerdi: Supabase'in "doğrulanmadı" reddi
  `supabaseHoldsLatestPassword` yüzünden kesin sayılır), kimlik başka bir
  satırda zaten kayıtlı (kapatılmış hesabın kimliği, `identityRevoked`'un
  dayanağı), birden fazla eşleşme ya da Supabase'e ulaşılamaması. Hiçbiri
  sıfırlamayı geri almaz. Anahtar olmadan üretimde doğrulanamaz.
- Parola sıfırlama: iki akış da duruyor (uygulamada Supabase'inki, sitede
  `?token=`'li kendi akışımız) ama artık **iki kopya da güncelleniyor**.
  Sitede sıfırlama Supabase'e servis rolüyle yazıyor
  (`updateSupabasePassword`); uygulamada sıfırlanmışsa sitedeki giriş,
  Supabase'in kabul ettiği parolayı görüp bcrypt özetini ona uyduruyor
  (`adoptSupabasePassword`). Servis rolü anahtarı yoksa ilki çalışmadığı için
  ikincisi de kapalı kalır - sitenin kopyası tek yetkilidir ve uyuşmazlık
  reddedilir (`hasSupabaseAdmin`). Ayrıntı: `docs/EMAIL-RESEND.md` §4.
- Sitedeki bcrypt hash'lerinin Supabase'e toplu aktarımı (şifre sıfırlatmadan)
  ayrı bir iştir - `docs/SUPABASE-GECIS.md` §5.
- E-posta normalizasyonu iki tarafta da **invariant** küçük harftir
  (`normalizeEmail`); tr-TR `toLocaleLowerCase` kullanılmaz ("INFO@…" iki
  hesaba bölünmesin).

## 6. Testler

`tests/mobile-auth.test.ts` - saf parçalar: bearer ayrıştırma, hata
sınıflandırma, `apiError` gövdesi, `planCustomerLink` (oluştur / güncelle /
yok / devre dışı, hoş geldin kuponu anı, ad-telefon üzerine yazmama), tek
seferlik köprü kuralı, obfuscated user. Supabase ve veritabanına dokunan
kısımlar (`auth.ts`, `supabase-bridge.ts`) yalnız sarmalayıcıdır ve
entegrasyon ortamında elle doğrulanır.
