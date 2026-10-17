# Veritabanı - Postgres (Neon)

> **Durum (23 Eyl 2026):** canlı veri **Neon**'dadır ve varsayılan orada
> kalmaktır. 30 Ağu 2026'da veriyi mobil uygulamanın kimlik için kullandığı
> Supabase projesine taşıma hedefi yazılmıştı; 2 Eyl 2026'dan beri iki depo
> da Supabase'i **yalnız kimlik** için kullanır ve veri kararı "Neon, tek
> kaynak"tır (lafmobil `docs/INFRA.md` §1). Taşıma yalnız operatör açıkça
> isterse ve aşağıdaki ön koşul (ücretli plan ya da kalıcı proje slotu)
> yazılı olarak doğrulanırsa yapılır; çalıştırılabilir yordam
> **[SUPABASE-GECIS.md](SUPABASE-GECIS.md)**. Hukuki belgeler gerçeği söyler:
> `dbProvider` bugün `"Neon"` (aşağıda "Sağlayıcı adı" bölümü).

Proje **yönetilen bir Postgres** üzerinde çalışır. Kodda sağlayıcıya özel
bağımlılık yoktur; taşınma bağlantı dizesini değiştirmekten ibarettir.

## ⚠️ Sağlayıcı geçmişi - okumadan taşıma yapma

Bu proje **daha önce Supabase'deydi ve oradan taşındı.** Sebep bir tercih
değil, bir kesintiydi:

> Supabase'in ücretsiz planı organizasyon başına **2 aktif proje** ile
> sınırlıdır. İki slot da başka projelerle doluyken L'Affogato'nun projesi
> kaldırıldı; canlı sitedeki toplu HTTP 500'lerin ve **bir aylık kesintinin**
> sebebi buydu.

Neon'un ücretsiz planı **proje başına** kota verir ve limitlere takılmak veriyi
silmez (Neon'un kendi ifadesiyle: _"None of these limits delete your data."_),
yani aynı arıza Neon'da tekrarlanamaz.

**Supabase'e geri dönmek isteniyorsa** - ki mobil uygulamayla ortak kimlik için
iyi bir sebep var - geçişten önce şunun yazılı olarak doğrulanması gerekir:

1. Hedef Supabase organizasyonu **ücretli planda** mı, yoksa
2. Ücretsiz plandaysa, o organizasyonda **boş proje slotu** var mı ve
   L'Affogato'nun projesi başka bir proje uğruna kaldırılmayacak mı?

Bu doğrulanmadan taşıma, siteyi bir kez daha aynı şekilde kapatır. Karar
operatöründür; bu belge yalnızca bedelin ne olduğunu kayda geçirir.

## Supabase'e geçiş yordamı

Adım adım, ölçülmüş tuzaklarıyla (IPv6-yalnız doğrudan uç, pooler dizesi,
RLS-baypas doğrulaması, bcrypt içe aktarımı): **[SUPABASE-GECIS.md](SUPABASE-GECIS.md)**.

## Sağlayıcı adı hukuki belgelerde geçer

Sağlayıcının adı KVKK aydınlatma metni, gizlilik politikası, çerez politikası
ve veri işleyen listesi dâhil **35 hukuki pasajda** geçer. Bunlar bağlayıcı
beyandır. Bu yüzden ad düz metin değil, `{{DB_PROVIDER}}` token'ıdır ve tek
kaynağı `src/lib/legal/entity.ts` içindeki `dbProvider` alanıdır.

**Bu alan gerçeği izlemelidir.** Veri fiilen taşınmadan değeri değiştirmeyin:
belgede "Supabase" yazarken verinin Neon'da durması yanlış hukuki beyandır.
Taşıma sırasında `dbProvider` ile `DATABASE_URL` **aynı anda** değişir.

## Sürücü seçimi - neden `pg`

Veri katmanı, sağlayıcıya özel bir SDK yerine standart `pg` sürücüsünü
kullanır. Supabase'in Supavisor pooler'ı da, eski sağlayıcının pooled
endpoint'i de normal Postgres wire protokolü konuşur; aynı kod yerel bir
Postgres'te de çalışır.

Bunun iki somut faydası var:

1. **Taşınabilirlik.** Bu sitenin bir ay boyunca kapalı kalmasının sebebi,
   verinin tek bir sağlayıcının istemcisinin ve hesap limitinin arkasında
   olmasıydı. Artık taşınma, bağlantı dizesini değiştirmekten ibaret.
2. **Test edilebilirlik.** Sorgu katmanı gerçek bir Postgres'e karşı
   sınanabiliyor (`tests/db-integration.test.ts`) - JSONB gidiş-dönüşü,
   `on conflict` davranışı, SQLSTATE'ler ve fonksiyon çağrıları dâhil.

## Kurulum (tek seferlik)

> **Hangi sağlayıcı için:** aşağıdaki adımlar Supabase hedefi için
> yazılmıştır (taşıma kararı verilirse). Bugünkü Neon kurulumunda Neon
> panosundaki **pooled** (`-pooler`) bağlantı dizesi `DATABASE_URL`'e konur,
> `DATABASE_SSL_CA` boş kalır (yalnız Supabase host'larında uygulanır); şema
> adımı (4) ve env sırası aynıdır.

> **Sıra önemli: önce şemayı kur, sonra `DATABASE_URL`'i Vercel'e ekle.**
> Uygulama "tablo yok" hatasını (SQLSTATE `42P01`) _gerçek_ bir hata sayar ve
> haklı olarak 500 döndürür - bu bilinçli bir tercih, çünkü şema hatasını
> yedek veriyle gizlemek işi daha da kötüleştirir. Boş bir veritabanına
> bağlanmak siteyi bozar; hiç bağlanmamak bozmaz (pakete düşer). Yani şema
> hazır olmadan env değişkenini eklemeyin.

1. **Plan/slot doğrula** - hedef Supabase organizasyonu için
   [SUPABASE-GECIS.md §0](SUPABASE-GECIS.md) ön koşulunu geç. Bu adım
   atlanamaz: aynı sınır bu siteyi bir kez bir ay kapattı.

2. **Transaction pooler dizesini kopyala** - Supabase paneli → Project
   Settings → Database → Connection string → **"Transaction pooler"**
   (`postgresql://postgres.<ref>:<şifre>@aws-0-<bölge>.pooler.supabase.com:6543/postgres?sslmode=require`).

   **"Direct connection" dizesini KULLANMA:** o uç yalnızca IPv6 yayınlıyor ve
   Vercel fonksiyonları IPv6'ya çıkamıyor - hata "yanlış şifre" gibi değil,
   zaman aşımı gibi görünür (ölçüm: SUPABASE-GECIS.md §2).

3. **CA sertifikasını indir** - aynı sayfada SSL Configuration → CA
   certificate. PEM içeriği `DATABASE_SSL_CA` değişkenine konur; Supabase'in
   zinciri kendi köküne dayandığı için bu olmadan bağlantı hiç kurulmaz
   (SUPABASE-GECIS.md §2b).

4. **Şemayı kur.** İki yol var, ikisi de aynı sonucu verir:

   **a) Komut satırından (tercih edilen):**

   ```bash
   DATABASE_SSL_CA="$(cat prod-ca.pem)" \
   DATABASE_URL='postgresql://postgres.<ref>:...@...pooler.supabase.com:6543/postgres?sslmode=require' \
   npm run db:migrate
   ```

   `db/migrations/*.sql` dosyalarını sırayla, her dosyayı tek transaction içinde
   uygular ve uygulananları `_migrations` tablosunda tutar. Tekrar çalıştırmak
   güvenlidir.

   **b) Supabase SQL Editor'dan:** `db/schema.sql` dosyasının tamamını
   kopyalayıp panelin SQL Editor'ına yapıştır ve çalıştır. Bu dosya tüm
   migration'ların sıralı birleşimidir ve uygulananları `_migrations`'a
   yazdığı için sonradan `npm run db:migrate` çalıştırmak sorunsuzdur.
   (Dosya üretilir: `npm run db:bundle`.)

5. **Vercel'de env değişkenlerini ayarla** - Vercel → proje → Settings →
   Environment Variables:

   | Değişken          | Değer                                  | Ortam                |
   | ----------------- | -------------------------------------- | -------------------- |
   | `DATABASE_URL`    | Transaction pooler dizesi (adım 2)     | Production + Preview |
   | `DATABASE_SSL_CA` | CA sertifikasının PEM içeriği (adım 3) | Production + Preview |

   `NEXT_PUBLIC_SUPABASE_*` değişkenleri bu veri katmanının konusu değildir -
   onlar kimlik (Auth) katmanına aittir ve mobil uygulama kullanır; site tarafı
   Supabase Auth'a geçtiğinde siteye de eklenirler.

6. **Yeniden deploy et ve SUPABASE-GECIS.md §4/6'daki doğrulama kapısından
   geç.** "Sayfa açılıyor" yetmez: sağlık katmanı DB hatasında pakete düşer,
   yanlış yapılandırma 500 değil "boş site" olarak görünür.

## Veri katmanı nasıl çalışıyor

Veri erişimi tamamen **server-only**. Bağlantı `src/lib/db/index.ts` içinde
tembel (lazy) bir singleton olarak kurulur - `next build` canlı kimlik bilgisi
olmadan da çalışır.

Kod, Supabase'in PostgREST sorgu kurucusuna göre yazılmıştı (~122 çağrı noktası,
sipariş/stok/ödeme yolları dahil). Bunları elle SQL'e çevirmek yerine aynı
arayüzü koruyan ince bir uyumluluk katmanı yazıldı:

| Dosya                    | Sorumluluk                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/db/sql.ts`      | Saf SQL derleyici - QuerySpec → parametreli SQL. Tanımlayıcılar katı bir desene karşı doğrulanır, değerler **her zaman** parametre olarak bağlanır. |
| `src/lib/db/client.ts`   | `.from().select().eq()...` zinciri, PostgREST sonuç şekliyle (`{ data, error, status, count }`).                                                    |
| `src/lib/db/index.ts`    | `pg` bağlantı havuzu + `getDb()` + `TABLES`.                                                                                                        |
| `src/lib/db/counters.ts` | `next_seq()` ile atomik sıra üretimi.                                                                                                               |

Korunan davranışlar (çağrı noktaları bunlara bağlı):

- Hatalar **fırlatılmaz, döndürülür** (`res.error`).
- `error.code` Postgres SQLSTATE'ini taşır - ödeme webhook'undaki ve müşteri/
  kupon kayıtlarındaki `23505` (unique violation) dalları çalışmaya devam eder.
- Mutasyonlar satır döndürmez; yalnız `.select()` zincirlenirse döndürür.
- Ulaşılamayan veritabanı `status: 0` + boş `code` olarak raporlanır - bu,
  "veritabanı kapalı" ile "sorgu reddedildi" ayrımını mümkün kılar.

Bu katmanın tamamı veritabanı olmadan test edilir: `tests/db-sql.test.ts` ve
`tests/db-client.test.ts` (45 test) üretilen SQL'i ve sonuç semantiğini doğrular.

### Tohum (seed) bir veritabanına bir kez yazılır

Store bir tabloyu ancak tablo boşken **ve** `counters` içinde
`seed:<tablo>` işareti yokken tohumlar (`seedOnce`, `src/lib/admin/store.ts`);
ilk karar işareti yazar. Böylece operatörün boşalttığı tablo (son ürün, son
vitrin slaytı, son duyuru) bir sonraki soğuk başlangıçta geri dolmaz (admin
denetimi CAT-04, CON-01, karar D17). Katalog (ürün, kategori, menü) üretim
derlemesinde (Vercel önizlemeleri dahil) hiç tohumlanmaz; ayarlar satırı
eksikse her zaman yazılır. Kullanımdaki her veritabanına işaretleri
`20261017200100_seed_markers.sql` bir kez yazdı. Sayaçlar `raise_counter` ile
yalnız yükselir (`setCounter`), silinmiş bir satırın kimliği yeniden
verilmez.

Bir geliştirme veritabanını yeniden tohumlamak için:
`delete from public.counters where id like 'seed:%';` (ve boşaltılacak
tablolar).

## Yeni migration

`db/migrations/YYYYMMDDHHMMSS_aciklama.sql` oluştur, sonra `npm run db:migrate`.
Detay için `new-migration` skill'i.

## Periyodik imha (KVKK)

Yayımlanan **Veri Saklama ve İmha Politikası** bağlayıcı bir taahhüttür: her
veri kategorisi için bir saklama süresi ve "periyodik imha işlemleri her yıl
Haziran ve Aralık aylarının son iş haftasında gerçekleştirilir" cümlesi. Uzun
süre bunu yapan hiçbir kod yoktu; `auth_attempts` - birincil anahtarı
`<amaç>::<IP>::<e-posta>` olan tablo - amacı beş dakikada tükenen bir sayaç
için sınırsız büyüdü. Bu hem tutulmamış bir taahhüt hem de veri
minimizasyonu ihlaliydi (KVKK m.4/2-d).

| Tablo                  | Sütun       | Süre       | Dayanak                                                                                                                    |
| ---------------------- | ----------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `auth_attempts`        | `updatedAt` | **7 gün**  | "…5651 sayılı Kanun kapsamındaki asgari süreye uygun olarak **1 yıl**…" - bu bir **tavan**; satırın amacı 5 dakikada biter |
| `campaign_email_sends` | `createdAt` | **3 yıl**  | Ticari İletişim Yönetmeliği - gönderim kaydı için **asgari** süre                                                          |
| `customer_consents`    | (fonksiyon) | **3 yıl**  | "onayın geçerliliğinin sona erdiği tarihten itibaren 3 yıl; ... ret kaydı ... bu süre boyunca" - aşağıya bak               |
| `email_suppressions`   | `updatedAt` | **3 yıl**  | Ticari ileti gönderim kaydı ("kayıt tarihinden itibaren 3 yıl"); son bounce/şikâyetten sayılır                            |
| `audit_logs`           | `createdAt` | **10 yıl** | "İşlemin gerçekleştiği tarihten itibaren 10 yıl… (append-only)" - **asgari**                                               |
| `counter_tokens`       | `expiresAt` | **1 gün**  | Jeton süresinin dolmasına bağlı otomatik imha; kalıcı kayıt `loyalty_stamps`'tir                                           |

Süreler **politikadan okunur, uydurulmaz**: `src/lib/retention.ts` içindeki
her kural, geldiği cümleyi `basis` alanında taşır ve
`tests/mobile-retention.test.ts` o cümle `src/lib/legal/content.ts`'ten
kaybolduğunda kırılır. Asgari (zorunlu) sürelerde yıl **366 gün** sayılır -
10 yıllık bir kayıt artık yıllar yüzünden bir gün erken imha edilemez.

### Çalıştırma - varsayılan **rapor modu**

`vercel.json` → `crons`: imha, `/api/cron/daily` içinde **son adım** olarak
koşar, her gün 06:00 UTC'de (09:00 İstanbul), kampanya ve doğum günü
adımlarından sonra: silen tek parça odur, bu yüzden en sonda. Vercel'in Hobby
planı iki cron ve yalnız günlük program verdiği için ayrı
`/api/cron/retention` rotası programda değildir; rota duruyor ve ücretli
planda kendi satırıyla geri konabilir (`docs/EMAIL-RESEND.md` §7). Kimlik
doğrulaması kampanya cron'unun aynısıdır (`CRON_SECRET`, sabit zamanlı
karşılaştırma, tanımsızsa 503).

**İmha geri alınamaz, bu yüzden opt-in'dir.** İş varsayılan olarak yalnızca
sayar ve ne silecek olduğunu kural kural yanıt gövdesinde bildirir. Gerçekten
silmesi için dağıtımda:

```
RETENTION_APPLY=destroy
```

Bu tam değer aranır - `1`, `true`, `yes` açmaz. **Önce birkaç gün kuru
çalıştırma yapın**, `totalMatched` sayılarını okuyun, sonra açın.

Yanıt gövdesi yalnızca **sayı** taşır; hiçbir anahtar, adres ya da IP ne
loglanır ne döndürülür (`auth_attempts.key` üçünü birden içerir).

### Rıza defteri (`customer_consents`)

Üyenin ticari ileti tercihinin (`marketing`, `newsletter`) **geçmişi**. Okuma
modeli yine `customers."notificationPrefs"` + `marketingConsentAt`'tir;
kampanya kitlesi ve `/me` onu okur, defteri hiçbir şey okumaz (mobil sözleşme
değişmedi). Defter, okuma modelinin tutamadığını tutar: her değişiklik bir
satır (adres, amaç, verildi/geri alındı, kaynak, üyenin kendi işlemiyse
isteğin IP'si ve tarayıcı/uygulama bilgisi, verilen onayın atıf yaptığı metin
sürümü, zaman: Ticari Elektronik İleti ve İYS Aydınlatması'nın "her onay
için" kaydedilir dediği alanlar). Eskiden
`marketing` kapatılınca `marketingConsentAt` silinir ve geriye hiçbir ret kaydı
kalmazdı.

Yazanlar (`src/lib/customer/consent-ledger.ts` → `appendConsentChanges`, her
biri kendi yazımı başarılı olduktan sonra): site kaydı (`site-signup`),
uygulamanın ilk girişi (`app-signup`, Supabase meta verisindeki onay), sitenin
hesap sayfası (`site-account`), `PATCH /me` (`app-account`), üye çıkış
bağlantısı (`unsubscribe-link`), üyeyi de kapatan bülten çıkışı
(`newsletter-unsubscribe`), panel müşteri formu (`admin`, IP'siz) ve hesap
kapatma (`account-deletion`, gerçek adresle; hesap-silme §7 "elektronik ileti
onay kayıtları" saklanır der). Defter yazımı **en iyi çaba**dır: tercih
değişikliği o anda yapılmıştır ve bir geri alma, geçmişi yazılamadı diye
başarısız olmamalı; hata maskeli adresle loglanır.

Satır güncellenemez (`customer_consents_no_update` tetikleyicisi). Tek
silme imhadır ve tek bir sütunla ifade edilemez: bir satır, aynı adres ve
amaç için kendisinden sonra (ya da kendisi olan) bir **geri alma** satırı 3
yıldan eskiyse gider (`customer_consents_retention`). Hâlâ geçerli bir onay
ne kadar eski olursa olsun kapsam dışıdır; üyeye giden postanın dayanağı
odur. Testler: `tests/consent-ledger.test.ts`,
`tests/db-integration-consent-ledger.test.ts`.

### Kapsam dışı - bilerek

`newsletter_subscribers` ret (opt-out) kayıtları **süpürülmez**: onları silmek
aynı adrese yeniden ticari ileti gönderilmesine yol açar, ki Yönetmelik ret
kaydını tam da bunun için 3 yıl tutturur. Sipariş, fatura ve ödeme kayıtları
da kapsam dışıdır (VUK/TTK saklama süreleri).

## Yedek

Ücretsiz planda otomatik yedek sınırlıdır. Düzenli olarak:

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%F).sql
```

## Veritabanı ulaşılamazsa ne oluyor

Eski davranış: tek bir bağlantı hatası **her sayfayı HTTP 500** yapıyordu.
Üretimde bu bir ay sürdü. Artık genel (public) sayfalar pakette gelen içerikle
ayakta kalır; ticari yollar ise sesli şekilde başarısız olur.

Ayrım `src/lib/db/health.ts` içinde yapılır ve tek bir sinyale dayanır:
Postgres'e ulaşan her hata bir **SQLSTATE** taşır. SQLSTATE yoksa istek hiç
ulaşmamıştır (`status: 0`, boş `code`) - yalnız bu durum bozulmaya (degrade)
uygundur. Hatalı kolon, kısıt ihlali, kimlik doğrulama reddi gibi gerçek hatalar
**maskelenmez**, eskisi gibi hata verir.

| Alan                                  | Ulaşılamazken                                                        |
| ------------------------------------- | -------------------------------------------------------------------- |
| Ana sayfa, hikaye, ziyaret            | Pakette gelen içerikle render edilir                                 |
| Kafe menüsü                           | Yapı gösterilir, **fiyatlar `-`** (bayat fiyat göstermek yerine)     |
| Mağaza                                | **Boş** - asla paketteki kurgusal ürünlere düşmez                    |
| Ürün detay                            | "Şu an gösteremiyoruz" (404 değil - gerçek URL'ler deindekslenmesin) |
| Yasal metinler                        | Paketteki asıl metin (DB yalnız override tutar)                      |
| Ayarlar                               | Varsayılanlar, **`isShopOpen: false`**                               |
| Ödeme                                 | "Şu an sipariş alamıyoruz" kapısı                                    |
| Üye oturumu                           | Çıkış yapmış sayılır (fail-closed)                                   |
| Admin panel, tüm mutasyonlar, webhook | **Hata verir** - bozulma yok                                         |

Ziyaretçiye durumu açıklayan bir bant gösterilir; ayrıca her düşüş
`[db-degraded]` etiketiyle sunucu loglarına yazılır, böylece arıza görünmez
kalmaz.

**Bu davranışı genişletirken kural:** `publicRead()` yalnızca salt-okunur,
sunumsal veriler için kullanılır. Bir fiyat, stok, yetki ya da siparişin
verilebilir olup olmadığı **asla** yedek veriden karar bağlanmaz.

Seed yardımcıları artık reddedilen promise'i önbelleğe almıyor
(`memoizeUntilRejected`): eskiden tek bir hata o sunucu örneğini kalıcı olarak
bozuyor, düzelme için yeniden deploy gerekiyordu.

## Supabase'e taşıma - sırası önemli

Kod hazır (düz `pg`, adsız parametreli sorgular, işlem kapsamlı advisory lock).
Eksik olan tek şey bağlantı dizesi ve verinin kendisi.

1. **Slot/plan doğrula** - yukarıdaki uyarı. Bu adım atlanırsa gerisi anlamsız.
2. **Bağlantı dizesini al** - Supabase panosu → Project Settings → Database →
   Connection string. Pooler (`:6543`, transaction mode) ya da session pooler
   (`:5432`) ikisi de çalışır; şema kurucu artık işlem kapsamlı kilit
   kullandığı için transaction pooler'da da güvenlidir.
3. **Şemayı kur** - `DATABASE_URL='<supabase>' npm run db:migrate`, ya da
   `db/schema.sql` dosyasını Supabase SQL Editor'a yapıştır.
4. **Veriyi taşı** - Neon'dan `pg_dump --data-only --no-owner`, Supabase'e
   `psql`. Sıra: önce şema (3), sonra veri.
5. **Doğrula** - satır sayıları iki tarafta eşit mi? Özellikle `orders`,
   `customers`, `order_items`, `loyalty_*`.
6. **Aynı anda:** `dbProvider` alanını `"Supabase"` yap **ve** Vercel'deki
   `DATABASE_URL`'i değiştir, sonra deploy et.

Kodda eski sağlayıcıya özel bir değişken yoktur: `src/lib/db/index.ts`
`DATABASE_URL` → `POSTGRES_URL` → `SUPABASE_DB_URL`, `scripts/db-migrate.mjs`
`DATABASE_URL` → `POSTGRES_URL` okur. Cutover'da kaldırılacak bir yedek dize
kalmadı.

Neon projesini **hemen silme.** Birkaç gün elde tut; geri dönmek gerekirse tek
yapılacak şey bağlantı dizesini geri almak olsun.
