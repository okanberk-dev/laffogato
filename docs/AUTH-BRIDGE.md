# AUTH-BRIDGE — site ile uygulamanın ortak üyeliği

> Bu belge `src/lib/supabase/**`, `src/lib/customer/supabase-*.ts`,
> `src/lib/mobile/auth*.ts`, `src/proxy.ts` ve `src/app/uye/actions.ts`'in
> neden böyle yazıldığını anlatır. Sözleşme `docs/API-MOBILE.md` §0'dadır;
> veri taşıma `docs/SUPABASE-GECIS.md`'dir — bu belge o işten bağımsızdır.

---

## 0. Karar

| Ne                                                        | Nerede                                               |
| --------------------------------------------------------- | ---------------------------------------------------- |
| **Kimlik** (kim olduğun: e-posta + parola, token, oturum) | **Supabase Auth** — tek proje, hem site hem uygulama |
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
  anon.ts     → getSupabaseAnonClient()  — durumsuz; yalnız bearer doğrulama
  server.ts   → createSupabaseServerClient() — çerez tabanlı (site oturumu)
  proxy.ts    → hasSupabaseSessionCookie() · updateSession() — token yenileme
src/proxy.ts  → 1) updateSession  2) admin çerez koruması (AYNEN)
src/lib/customer/
  supabase-link-plan.ts → planCustomerLink() vb. — SAF karar mantığı (test)
  supabase-bridge.ts    → ensureCustomerForSupabaseUser() · linkCustomerToSupabase()
src/lib/mobile/
  auth-core.ts → parseBearerToken() · classifyAuthError() — saf
  auth.ts      → requireMobileCustomer(request) — route'ların kapısı
  respond.ts   → apiError() · apiJson()
```

**Service role anahtarı yalnız `src/lib/supabase/admin.ts` tarafından ve iki
iş için okunur** — kapatılan hesabın Supabase kimliğini silmek, ve burada
sıfırlanan parolayı Supabase'e yazmak. `.env.example`'da adı geçer, değeri
boştur; `NEXT_PUBLIC_` öneki yoktur, yani tarayıcıya ya da uygulama paketine
hiç girmez. Anahtar tanımlı değilse iki iş de sessizce atlanır ve kod eski,
temkinli davranışına döner (§5). Publishable anahtar ve proje URL'si herkese açıktır (tarayıcıya ve
uygulamaya verilmek için tasarlanmıştır) ve `.env.example`'da değerleriyle
durur; env boşsa `config.ts` aynı değerlere düşer, böylece env'siz bir preview
deploy da aynı projeye giriş yapabilir.

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
**hoş geldin kuponu** aynı kuralla (idempotent, best-effort) verilir —
ikinci bir kural icat edilmedi.

## 3. Site girişi: önce Supabase, sonra bcrypt

`src/app/uye/actions.ts`:

- **loginAction**
  1. `signInWithPassword` (çerezli sunucu istemcisi). Başarılıysa
     `ensureCustomerForSupabaseUser` → satır eşle/oluştur → mevcut
     `setActiveCustomerSession` (sitenin imzalı çerezi) — yani site oturumu
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
kopyalanır. `api/mobile` ve `api/webhooks` matcher dışındadır — biri bearer,
diğeri HMAC kullanır, yenilenecek çerezleri yoktur.

## 5. Sınırlar ve bilinçli boşluklar

- `DELETE /me` Supabase kullanıcısını **silmez** (service role yok). Neon
  satırı anonimleştirilir, uygulama oturumu kapatır. Supabase tarafındaki
  kullanıcının silinmesi ayrı bir operasyon görevidir (`docs/COMPLIANCE.md`,
  mobil repo).
- **Bağlanmamış satırda sıfırlama Supabase'e ulaşmaz.** `supabaseUserId` boş
  bir satır için aynasının yazacağı bir kimlik yoktur, dolayısıyla sitede
  sıfırlanan parola Supabase'de eski kalır ve o adresle uygulamaya ESKİ
  parolayla girilebilir. Pencere dardır: satırın bağlanmamış olması için tek
  seferlik köprü denemesinin "obfuscated user" tuzağına düşmüş olması gerekir
  (§3), yani o adreste zaten bir Supabase hesabı vardır. Satır, üyenin bir
  sonraki Supabase girişinde bağlanır ve o andan itibaren ayna çalışır.
  Kapatmanın yolu adresten Supabase kullanıcısı aramaktır; `auth.admin`'in JS
  istemcisi bunu sayfalayarak tüm kullanıcı listesini taramadan yapamıyor, o
  yüzden yapılmadı. `passwordMirroredAt` bu durumu boş bırakır, dolayısıyla
  sitedeki giriş köprüsü temkinli dalda kalır (§4).
- Parola sıfırlama: iki akış da duruyor (uygulamada Supabase'inki, sitede
  `?token=`'li kendi akışımız) ama artık **iki kopya da güncelleniyor**.
  Sitede sıfırlama Supabase'e servis rolüyle yazıyor
  (`updateSupabasePassword`); uygulamada sıfırlanmışsa sitedeki giriş,
  Supabase'in kabul ettiği parolayı görüp bcrypt özetini ona uyduruyor
  (`adoptSupabasePassword`). Servis rolü anahtarı yoksa ilki çalışmadığı için
  ikincisi de kapalı kalır — sitenin kopyası tek yetkilidir ve uyuşmazlık
  reddedilir (`hasSupabaseAdmin`). Ayrıntı: `docs/EMAIL-RESEND.md` §4.
- Sitedeki bcrypt hash'lerinin Supabase'e toplu aktarımı (şifre sıfırlatmadan)
  ayrı bir iştir — `docs/SUPABASE-GECIS.md` §5.
- E-posta normalizasyonu iki tarafta da **invariant** küçük harftir
  (`normalizeEmail`); tr-TR `toLocaleLowerCase` kullanılmaz ("INFO@…" iki
  hesaba bölünmesin).

## 6. Testler

`tests/mobile-auth.test.ts` — saf parçalar: bearer ayrıştırma, hata
sınıflandırma, `apiError` gövdesi, `planCustomerLink` (oluştur / güncelle /
yok / devre dışı, hoş geldin kuponu anı, ad-telefon üzerine yazmama), tek
seferlik köprü kuralı, obfuscated user. Supabase ve veritabanına dokunan
kısımlar (`auth.ts`, `supabase-bridge.ts`) yalnız sarmalayıcıdır ve
entegrasyon ortamında elle doğrulanır.
