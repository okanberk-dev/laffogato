# Neon → Supabase geçişi — çalıştırılabilir yordam

> Bu belge tek bir soruya cevaptır: **siteyi, mobil uygulamanın zaten
> kullandığı Supabase projesine (`wvivcgctebyxojtyidfg`) nasıl güvenle
> taşırız?** Buradaki her teknik iddia bu depoda ya koddan ya canlı uçtan
> ÖLÇÜLDÜ; kaynak her bölümde belirtiliyor.

## 0. Önce oku: bu yol bir kez denendi ve site bir ay kapalı kaldı

[DATABASE.md](DATABASE.md) "Sağlayıcı geçmişi" bölümündeki koşul geçerlidir:
ücretsiz Supabase planı **organizasyon başına 2 aktif proje** verir ve dolu
slot yüzünden L'Affogato'nun projesi bir kez kaldırıldı. Geçişten önce yazılı
olarak doğrulanacak tek şey:

> `wvivcgctebyxojtyidfg` projesinin bulunduğu organizasyon ücretli planda mı,
> değilse o organizasyonda bu proje **kalıcı** mı?

Proje bugün canlı ve sağlıklı (auth ucu cevap veriyor, publishable anahtar
geçerli — bu oturumda doğrulandı). Ama "bugün canlı" ile "plan gereği kalıcı"
aynı şey değil.

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

Şemadaki 27 tablo "RLS açık, policy yok" durumundadır ve `postgres`
kullanıcısıyla bağlanan uygulama için davranış Neon'dakiyle BİREBİR aynıdır:
RLS baypas edilir, hiçbir sorgu boş dönmez.

## 2. ⚠️ Tek gerçek tuzak: doğrudan bağlantı IPv6-yalnız, Vercel IPv6 konuşmaz

Bu oturumda ölçüldü:

```
db.wvivcgctebyxojtyidfg.supabase.co  →  A kaydı YOK, yalnızca AAAA (IPv6)
```

Vercel'in sunucusuz fonksiyonları dışarıya IPv6 açamaz. Yani Supabase
panelindeki **"Direct connection"** dizesi Vercel'de HİÇ bağlanamaz ve hata
"yanlış şifre" gibi değil, zaman aşımı gibi görünür — teşhisi saatler yiyen
türden.

**Kural: Vercel'e yalnızca "Transaction pooler" (Supavisor) dizesi konur:**

```
postgresql://postgres.wvivcgctebyxojtyidfg:<ŞİFRE>@aws-0-<bölge>.pooler.supabase.com:6543/postgres?sslmode=require
```

- Kullanıcı adı `postgres.<proje-ref>` biçimindedir (pooler kiracıyı bundan bulur).
- `sslmode=require` kalsın: `poolConfig()` bunu görüp TLS'i tam doğrulamayla
  açar; pooler alan adları herkese açık kök sertifikayla imzalıdır.
- Bölgeyi Supabase paneli söyler (Project Settings → Database → Connection
  string → "Transaction pooler").

## 3. Publishable anahtar bu iş İÇİN DEĞİL

Operatörün verdiği `sb_publishable_…` anahtarı **istemci** anahtarıdır: mobil
uygulamanın auth'u için doğru, veritabanı taşımak için yetkisiz. Taşıma için
gereken sır Supabase panelindeki **veritabanı şifresidir** (Project Settings →
Database). Bu şifre bu depoda YOKTUR ve olmamalıdır.

## 4. Yordam

Sıfır kesinti hedefiyle, adım adım:

1. **Ön koşul** — §0'daki plan/slot doğrulaması + pooler bağlantı dizesi elde.
2. **Şemayı kur (canlıya dokunmaz):** yerelde
   `DATABASE_URL='<pooler-dizesi>' npm run db:migrate`
   ya da `db/schema.sql`'i Supabase SQL Editor'a yapıştır. İkisi de
   idempotenttir ve `_migrations`'a ne uyguladığını yazar.
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
   - `src/lib/legal/entity.ts` → `dbProvider: "Supabase"` (35 hukuki pasaj
     kendiliğinden güncellenir; bkz. DATABASE.md — bu ikisi AYNI anda değişir,
     veri taşınmadan belge değişmez)
   - Redeploy
6. **Donanım kontrolü:** `/`, `/menu`, `/admin/giris`, `/api/mobile/v1/app-content`
   ve bir test siparişi. Sipariş yazma çalışıyorsa geçiş bitti.
7. **Geriye dönüş planı:** Vercel'de `DATABASE_URL`'i Neon'a geri almak tek
   adımdır; Neon'daki veri cutover'dan sonra da silinmemiş olacak (bkz. adım 8).
8. **Söküm (en az 1 hafta sonra):** Neon projesi kapatılır,
   `NEON_DATABASE_URL` env zincirinden silinir (`src/lib/db/index.ts` +
   `scripts/db-migrate.mjs` — kod içi not zaten "cutover doğrulanınca sil" diyor).

## 5. Cutover'dan sonra: veri aynı projede, kimlik hâlâ iki sistem

Bu geçiş **veriyi** uygulamanın projesine taşır; üyelik hâlâ iki ayrı
sistemdir (site: bcrypt+çerez, uygulama: Supabase Auth). Ortak kimliğin
mevcut durumu ve seçenekleri:

- Uygulamanın Supabase auth'u ÇALIŞIYOR ve doğru yapılandırılmış (bu oturumda
  canlı uçtan doğrulandı: email+şifre açık, kayıt açık, e-posta doğrulaması
  zorunlu, sosyal sağlayıcılar kapalı).
- Site müşterileri `customers` tablosunda bcrypt(cost 10) hash ile duruyor.
  Supabase Auth, bcrypt hash'lerini **içe aktarmayı destekler**
  (auth.users.encrypted_password bcrypt biçimindedir) — yani site üyeleri
  şifre sıfırlatmadan taşınabilir. Bu ayrı, dikkat isteyen bir iştir ve bu
  belgeye değil kendi yordamına aittir; ön koşulu da bu geçiştir.
- O işe girmeden önce iki sistemin e-posta NORMALİZASYONU eşitlenmelidir
  (tr-TR küçük harf ↔ invariant küçük harf farkı "INFO@…" adresini iki ayrı
  hesaba böler) — bu düzeltme lafmobil tarafında ayrıca yürüyor.
