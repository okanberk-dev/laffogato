# Neon → Supabase geçişi - çalıştırılabilir yordam

> Bu belge tek bir soruya cevaptır: **siteyi, mobil uygulamanın zaten
> kullandığı Supabase projesine (`wvivcgctebyxojtyidfg`) nasıl güvenle
> taşırız?** Buradaki her teknik iddia bu depoda ya koddan ya canlı uçtan
> ÖLÇÜLDÜ; kaynak her bölümde belirtiliyor.
>
> **Durum (23 Eyl 2026):** bu yordam **uygulanmadı** (`src/lib/legal/entity.ts`
> `dbProvider` bugün `"Neon"`) ve varsayılan Neon'da kalmaktır
> ([DATABASE.md](DATABASE.md) başı). Yalnız operatör açıkça isterse ve §0'daki
> ön koşul yazılı olarak doğrulanırsa uygulanır.

## 0. Önce oku: bu yol bir kez denendi ve site bir ay kapalı kaldı

[DATABASE.md](DATABASE.md) "Sağlayıcı geçmişi" bölümündeki koşul geçerlidir:
ücretsiz Supabase planı **organizasyon başına 2 aktif proje** verir ve dolu
slot yüzünden L'Affogato'nun projesi bir kez kaldırıldı. Geçişten önce yazılı
olarak doğrulanacak tek şey:

> `wvivcgctebyxojtyidfg` projesinin bulunduğu organizasyon ücretli planda mı,
> değilse o organizasyonda bu proje **kalıcı** mı?

(Karşılaştırma için ölçüm: bu makinenin MCP erişimindeki DİĞER organizasyon
"free" planda ve tam 2 projeyle dolu - sınır gerçek ve bugün de yürürlükte.
`wvivcgctebyxojtyidfg`'nin organizasyonu ayrı bir hesapta; planı DOĞRULANMADI.)

Proje bugün canlı ve sağlıklı (auth ucu cevap veriyor, publishable anahtar
geçerli - bu oturumda doğrulandı). Ama "bugün canlı" ile "plan gereği kalıcı"
aynı şey değil.

**Uyku koruması (17 Eki 2026).** Ücretsiz plandaki proje 7 gün veritabanı
etkinliği görmezse duraklatılır ve duraklamış proje uygulamada da sitede de
her girişi reddeder. Bu yüzden `/api/cron/daily` her sabah ilk iş olarak
servis rolüyle auth yönetim API'sinden tek kullanıcılık bir sayfa ister
(`keepSupabaseAwake`, `src/lib/supabase/admin.ts`): `auth.users` üzerinde
gerçek bir okuma; yanıt okunmadan atılır. `/auth/v1/health` veritabanına
inmediği için yetmez. Sonuç cron yanıtındaki `keepalive.ping`'dir (`ok` ·
`failed` · `skipped`; servis anahtarı, yani `SUPABASE_SECRET_KEY` ya da eski
`SUPABASE_SERVICE_ROLE_KEY` yoksa `skipped`). Bu
yalnız duraklamayı önler, yukarıdaki 2 proje sınırı yüzünden kaldırılmayı
değil. Pro planda duraklama yoktur; orada adım silinebilir.

**Yoklama görünür (20 Eki 2026).** `CRON_SECRET` Vercel'de "sensitive"
olduğu için cron elle çağrılamaz; sonucu yalnız yanıt gövdesinde kalıyordu.
Artık her yoklamanın sonucu (`ok` · `failed` · `skipped` ve ISO zamanı;
anahtar ve yanıt gövdesi asla) Neon'daki tek satırlık `supabase_keepalive`
tablosuna yazılır: son deneme ve son başarı, tek bir upsert ile
(`recordSupabaseKeepalive`, `src/lib/admin/supabase-keepalive.ts`). Kayıt
cron'un işlerinden sonra, 5 sn sınırıyla yazılır; yazılamazsa günlüğe sınıfı
düşer (SQLSTATE, ulaşılamıyor, süre), cron ve yoklamanın sonucu etkilenmez
(yanıtta `keepalive.recorded`). Sahibin Ayarlar sayfasındaki Sistem durumu
kartında "Supabase uyanık tutma: son başarılı ping <tarih>" satırı durur;
son başarı İstanbul takvimiyle 3 günden eskiyse, son deneme başarısızsa ya da
tablo kurulalı 2 günden fazla olduğu hâlde hiç kayıt yoksa (cron hiç
çalışmıyor) uyarı renginde, ve o zaman Genel bakış'ta da belirir
(`docs/ADMIN.md`).

## 1. Neden bu geçiş küçük bir iş: veri katmanı sağlayıcı tanımıyor

`src/lib/db/index.ts` düz `pg` sürücüsüdür; sorgular adlandırılmış prepared
statement KULLANMAZ (pooler-güvenli) ve şema kilidi `pg_advisory_xact_lock`
ile tek işlem içindedir (transaction-pooler-güvenli, bkz. bootstrap.ts).
RLS endişesi de ölçülüp kapatıldı:

```
Supabase'de rol bayrakları (canlı sorgu, pg_roles):
  postgres      rolbypassrls = true   ← bağlantı dizesinin kullanıcısı
  service_role  rolbypassrls = true
  anon          rolbypassrls = false
```

Şemadaki her tablo (`_migrations` dahil) "RLS açık, policy yok"
durumundadır (sayı yazılmıyor, her yeni tabloyla eskir; tutan testler
aşağıda) ve `postgres` kullanıcısıyla bağlanan uygulama için
davranış Neon'dakiyle BİREBİR aynıdır: RLS baypas edilir, hiçbir sorgu boş
dönmez. Tek istisna `customer_milestone_rewards`'tı (RLS'siz yaratılmıştı,
`20261021050500_customer_milestone_rewards_rls.sql` kapattı). Yeni bir tablo
RLS'siz kalırsa `tests/db-rls.test.ts` (şemadan) ve
`tests/db-integration-schema-objects.test.ts` (gerçek Postgres'te) kırılır.

## 2. ⚠️ Tek gerçek tuzak: doğrudan bağlantı IPv6-yalnız, Vercel IPv6 konuşmaz

Bu oturumda ölçüldü:

```
db.wvivcgctebyxojtyidfg.supabase.co  →  A kaydı YOK, yalnızca AAAA (IPv6)
```

Vercel'in sunucusuz fonksiyonları dışarıya IPv6 açamaz. Yani Supabase
panelindeki **"Direct connection"** dizesi Vercel'de HİÇ bağlanamaz ve hata
"yanlış şifre" gibi değil, zaman aşımı gibi görünür - teşhisi saatler yiyen
türden.

**Kural: Vercel'e yalnızca "Transaction pooler" (Supavisor) dizesi konur:**

```
postgresql://postgres.wvivcgctebyxojtyidfg:<ŞİFRE>@aws-0-<bölge>.pooler.supabase.com:6543/postgres?sslmode=require
```

- Kullanıcı adı `postgres.<proje-ref>` biçimindedir (pooler kiracıyı bundan bulur).
- Bölgeyi Supabase paneli söyler (Project Settings → Database → Connection
  string → "Transaction pooler").

### 2b. İkinci tuzak: Supabase'in sertifika zinciri kendi köküne dayanır

Ölçüldü (SSLRequest + sistem-kök doğrulaması, üç pooler ucunda aynı):

```
aws-0-us-east-1.pooler.supabase.com:6543  → self signed certificate in certificate chain
aws-0-us-east-1.pooler.supabase.com:5432  → self signed certificate in certificate chain
aws-0-eu-central-1.pooler.supabase.com:6543 → self signed certificate in certificate chain
```

Yani sistem kökleriyle `rejectUnauthorized: true` **başarısız olur**. Kodun bu
duruma iki cevabı var (`src/lib/db/index.ts` ve aynı kurallarla
`scripts/db-migrate.mjs`):

1. **ZORUNLU - `DATABASE_SSL_CA`:** Supabase panelinden indirilen kök
   sertifikanın PEM içeriği bu env değişkenine konur; tam doğrulama o kökle
   yapılır. Bu olmadan Supabase'e HİÇBİR bağlantı kurulamaz - cutover'da değil,
   **ilk pooler bağlantısında** (yani §4 adım 2'de) gerekir.
   (Panel: Project Settings → Database → SSL Configuration → CA certificate.)
   26 Kas 2026'dan beri CA tanımlıysa her host'ta uygulanır ama sistem
   köklerinin YANINA eklenir (`src/lib/db/ssl-config.mjs`); Neon'a dönüşte
   env'in unutulmuş olması yine hiçbir şeyi bozmaz. (Önceden yalnız Supabase
   host'larında uygulanıyordu: Node'da `ca` tek başına sistem köklerinin
   YERİNE geçer, kapsamlama geri dönüşü korumak içindi.)
2. **Ek emniyet:** `*.supabase.co` / `*.pooler.supabase.com` host'larında TLS,
   `sslmode` yazılmasa bile (hatta `sslmode=disable` yazılsa bile) **zorla
   açılır** - Supavisor düz metin oturumu kabul ettiği için aksi, üretimi
   sessizce şifresiz taşımak olurdu. `sslmode=require` yazmaya devam etmek
   yine de iyi pratik: niyeti dizede görünür kılar.

`rejectUnauthorized: false` diye bir yol bilerek YOK: sağlık katmanı
(`client.ts`) bağlantı hatasını "veritabanı ulaşılamıyor" sayıp paket veriye
düşer - yanlış TLS yapılandırması 500 olarak değil, **"boş ama ayakta site"**
olarak görünür ve teşhisi geciktirir. Bu yüzden cutover'daki doğrulama kapısı
(aşağıda §4/6) atlanamaz.

## 3. Publishable anahtar bu iş İÇİN DEĞİL

Operatörün verdiği `sb_publishable_…` anahtarı **istemci** anahtarıdır: mobil
uygulamanın auth'u için doğru, veritabanı taşımak için yetkisiz. Taşıma için
gereken sır Supabase panelindeki **veritabanı şifresidir** (Project Settings →
Database). Bu şifre bu depoda YOKTUR ve olmamalıdır.

## 4. Yordam

Sıfır kesinti hedefiyle, adım adım:

1. **Ön koşul** - §0'daki plan/slot doğrulaması + pooler bağlantı dizesi elde.
2. **Şemayı kur (canlıya dokunmaz):** yerelde

   ```
   DATABASE_SSL_CA="$(cat prod-ca.pem)" \
   DATABASE_URL='<pooler-dizesi>' npm run db:migrate
   ```

   ya da `db/schema.sql`'i Supabase SQL Editor'a yapıştır. İkisi de
   idempotenttir ve `_migrations`'a ne uyguladığını yazar. (CA olmadan migrate
   §2b'deki zincir hatasıyla düşer - bu beklenen davranıştır, şifresiz
   bağlanmaya düşmez.)
3. **Veriyi kopyala:** Neon hâlâ canlı kaynakken:
   ```
   pg_dump  "$NEON_URL"    --data-only --no-owner --no-privileges \
            --exclude-table=_migrations -Fc -f veri.dump
   pg_restore --data-only --no-owner --disable-triggers \
            -d "$SUPABASE_POOLER_URL" veri.dump
   ```
   `--disable-triggers` FK sırası derdini ortadan kaldırır; `postgres`
   kullanıcısı bunun için yeterlidir.
4. **Doğrula:** iki tarafta satır sayımı (`select count(*)` kritik tablolar:
   customers, orders, order_items, settings, products, app_*).
5. **Cutover (tek atomik değişiklik seti):**
   - Vercel'de `DATABASE_URL` → pooler dizesi
   - Vercel'de `DATABASE_SSL_CA` → Supabase kök sertifikasının PEM içeriği (§2b)
   - `src/lib/legal/entity.ts` → `dbProvider: "Supabase"` (35 hukuki pasaj
     kendiliğinden güncellenir; bkz. DATABASE.md - bu ikisi AYNI anda değişir,
     veri taşınmadan belge değişmez)
   - Redeploy
6. **Doğrulama kapısı - "sayfa açılıyor" YETMEZ:** sağlık katmanı DB
   hatasında paket veriye düştüğü için site, veritabanına hiç bağlanamazken de
   ayakta görünür. Kapı şudur:
   - Vercel fonksiyon loglarında bağlantı/TLS hatası OLMAMALI,
   - `/admin/giris` ile giriş yapılabilmeli (admin oturumu DB'siz çalışmaz),
   - bir test siparişi yazılıp `/admin/siparisler`'de görünmeli,
   - `/api/mobile/v1/app-content` panelden az önce yapılmış bir düzenlemeyi
     yansıtmalı (paket veri değil, canlı veri kanıtı).
   Dördü de geçmeden `dbProvider` değiştirilmez, Neon kapatılmaz.
7. **Geriye dönüş planı:** Vercel'de `DATABASE_URL`'i Neon'a geri almak tek
   adımdır; `DATABASE_SSL_CA`'yı silmek GEREKMEZ (sistem köklerinin yanına
   eklenir) ve Neon'daki veri cutover'dan sonra da silinmemiş olacak
   (bkz. adım 8).
8. **Söküm (en az 1 hafta sonra):** Neon projesi kapatılır. Kodda
   kaldırılacak bir şey yok: uygulama da betikler de bağlantı dizesini yalnız
   `DATABASE_URL`'den okur (`src/lib/db/database-url.mjs`). Supabase'in
   Vercel entegrasyonunun yazdığı `POSTGRES_URL` ve eski `SUPABASE_DB_URL`
   adı bilerek okunmaz; `DATABASE_URL` yoksa site başka bir veritabanına
   bağlanmaz, kesintideki gibi pakete düşer ve `/api/health`
   `unconfigured` der ([DATABASE.md](DATABASE.md) "Bağlantı dizesi yalnız
   `DATABASE_URL`").

## 5. Cutover'dan sonra: veri aynı projede, kimlik hâlâ iki sistem

Bu geçiş **veriyi** uygulamanın projesine taşır; üyelik hâlâ iki ayrı
sistemdir (site: bcrypt+çerez, uygulama: Supabase Auth). Ortak kimliğin
mevcut durumu ve seçenekleri:

- Uygulamanın Supabase auth'u ÇALIŞIYOR ve doğru yapılandırılmış (bu oturumda
  canlı uçtan doğrulandı: email+şifre açık, kayıt açık, e-posta doğrulaması
  zorunlu, sosyal sağlayıcılar kapalı).
- Site müşterileri `customers` tablosunda bcrypt(cost 10) hash ile duruyor.
  Supabase Auth, bcrypt hash'lerini **içe aktarmayı destekler**
  (auth.users.encrypted_password bcrypt biçimindedir) - yani site üyeleri
  şifre sıfırlatmadan taşınabilir. Bu ayrı, dikkat isteyen bir iştir ve bu
  belgeye değil kendi yordamına aittir; ön koşulu da bu geçiştir.
- O işe girmeden önce iki sistemin e-posta NORMALİZASYONU eşitlenmelidir
  (tr-TR küçük harf ↔ invariant küçük harf farkı "INFO@…" adresini iki ayrı
  hesaba böler) - bu düzeltme lafmobil tarafında ayrıca yürüyor.

**Köprü (30 Ağu 2026, `claude/mobil-panel-v2`):** kimlik tarafı artık
kodda birleşik - `docs/AUTH-BRIDGE.md`. Özet:

- Site girişi **önce Supabase** (`signInWithPassword`), reddederse mevcut
  bcrypt akışı aynen; bcrypt başarısında tek seferlik `signUp` köprüsü
  (`customers."supabaseUserId"` / `"supabaseLinkAttemptedAt"`).
- Uygulama `Authorization: Bearer <Supabase JWT>` gönderir;
  `src/lib/mobile/auth.ts` → `supabase.auth.getUser(jwt)` → e-postayla
  `customers` satırı (yoksa oluşturulur). Tek üyelik: aynı e-posta, aynı satır.
- Supabase **yalnız kimliktir**; sipariş, kupon, damga ve para bu projenin
  Postgres'inde kalır. Service role anahtarı depoda yoktur.
- Bu köprü veri taşımaya (§4) bağlı değildir; iki sistem birleşene kadar
  bcrypt hash'leri yerinde durur, toplu aktarım ayrı iş olarak kalır.
