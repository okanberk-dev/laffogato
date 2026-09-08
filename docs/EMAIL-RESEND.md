# EMAIL-RESEND — hangi e-posta nereden çıkıyor

> Bu belge `src/lib/email/send.ts`, `/admin/ayarlar → E-posta` sekmesi ve
> Supabase Auth'un şablonlarını bir arada anlatır. Ortak üyeliğin nasıl
> çalıştığı `docs/AUTH-BRIDGE.md`'dedir; bu belge yalnız **mesajın kendisiyle**
> ilgilenir.

---

## 0. İki yol var, ikisi de aynı Resend hesabını kullanır

Site ile uygulama **tek bir Supabase projesini** kimlik için paylaşır
(`docs/AUTH-BRIDGE.md` §0). Ama e-postayı ikisi aynı yerden göndermez:

| Mesaj                                            | Kim gönderir                  | Nasıl                     |
| ------------------------------------------------ | ----------------------------- | ------------------------- |
| Sipariş alındı · Ödeme onaylandı                 | Site (`src/lib/email/send.ts`) | Resend **HTTP API**       |
| Sitede kayıt → e-posta doğrulama                 | Site                          | Resend HTTP API           |
| Sitede "şifremi unuttum"                         | Site                          | Resend HTTP API           |
| **Uygulamada kayıt → doğrulama**                 | **Supabase Auth**             | **Resend SMTP**           |
| **Uygulamada "şifremi unuttum"**                 | **Supabase Auth**             | **Resend SMTP**           |
| Üye e-posta adresini değiştirdi                  | Supabase Auth                 | Resend SMTP               |

İkisini de yapılandırmak gerekir. Yalnız birini yaparsan yarısı sessizce
çalışmaz: sitenin e-postaları sunucu günlüğüne düşer, uygulamanınkiler
Supabase'in kendi gönderenimden İngilizce olarak çıkar ve saatte birkaç
mesajdan sonra hiç çıkmaz.

---

## 1. Alan adı doğrulaması (ikisi için de ön koşul)

Resend, hesapta **doğrulanmamış** bir alan adından hiçbir şey göndermez.
`laffogato.net` Resend'de kayıtlı (bölge `eu-west-1`, açılış/tıklama takibi
kapalı — şifre sıfırlama bağlantısının üçüncü bir yönlendiriciden geçmesi
istenmiyor). Doğrulanması için DNS'e şu üç kayıt girilmeli:

| Tür     | Ad                  | Değer                                                   | TTL  |
| ------- | ------------------- | ------------------------------------------------------- | ---- |
| `TXT`   | `resend._domainkey` | Resend panelindeki DKIM değeri (`p=MIGfMA0…` ile başlar) | Auto |
| `MX`    | `send`              | `feedback-smtp.eu-west-1.amazonses.com` (öncelik 10)     | 60   |
| `TXT`   | `send`              | `v=spf1 include:amazonses.com ~all`                      | 60   |

Kayıtlar girildikten sonra Resend → Domains → `laffogato.net` → **Verify**.
Yayılma birkaç dakika ile birkaç saat arası sürer.

> Doğrulama bitene kadar gönderilen her mesaj `403 … domain is not verified`
> ile döner. `/admin/ayarlar → E-posta → Test gönder` bu cümleyi olduğu gibi
> gösterir; tahmin etmeye gerek yok.

---

## 2. Site tarafı — Vercel ortam değişkenleri

`laffogato` projesinde (Vercel → Settings → Environment Variables):

| Anahtar          | Ortam                            | Not                                        |
| ---------------- | -------------------------------- | ------------------------------------------ |
| `RESEND_API_KEY` | Production · Preview · Development | Resend API anahtarı. **Yalnız sunucuda.**  |
| `EMAIL_FROM`     | (isteğe bağlı)                   | `L'Affogato <siparis@laffogato.net>` biçiminde |

`RESEND_API_KEY` yoksa kod hata vermez: mesajı sunucu günlüğüne yazar ve
`false` döner. Bu bilerek böyle — bir sipariş, onay maili gitmedi diye
kaybolmamalı. Ama o hâlde kimse doğrulama bağlantısını alamaz, yani bu
değişken üretimde **zorunludur**.

`NEXT_PUBLIC_` ön eki **kullanılmaz**. Anahtar tarayıcıya inerse hesabın
tamamı gitmiş demektir.

> Resend'in resmî Vercel entegrasyonu kuruluysa `RESEND_API_KEY`'i projeye
> kendisi enjekte eder; elle ikinci bir kopya eklemeye gerek yok.

### Gönderen adresi panelden değişir

`EMAIL_FROM` bir kaçış kapısıdır, birincil ayar değil. Sıralama:

1. **`/admin/ayarlar → E-posta`** — panelden, deploy gerekmeden
2. `EMAIL_FROM` — veritabanı olmayan bir dağıtım için
3. `L'Affogato <siparis@laffogato.net>` — koddaki varsayılan

Doğrulanmış alan adı DNS'te değiştiğinde adresin de değişmesi gerekir; bunun
için bir sürüm çıkmak zorunda kalmamak, panelin var oluş sebebidir
(`CLAUDE.md` — uygulamada güncelleme yapmadan değişebilmeli).

Aynı sekmedeki **Test gönder**, zinciri tek tıkla kanıtlar: anahtar var mı,
alan adı doğrulanmış mı, adres kabul ediliyor mu. Diğer bütün yollar bir
gönderim hatasını bilerek yutar, dolayısıyla sağlayıcının söylediği tek yer
burasıdır.

---

## 3. Uygulama tarafı — Supabase Auth SMTP

Uygulamanın kayıt ve şifre sıfırlama e-postalarını Supabase gönderir. Kendi
yerleşik göndericisi **üretim için değildir**: saatte birkaç mesajla
sınırlıdır ve `noreply@mail.app.supabase.io` adresinden İngilizce çıkar.

Supabase Dashboard → proje → **Authentication → Emails → SMTP Settings**:

| Alan            | Değer                                   |
| --------------- | --------------------------------------- |
| Enable Custom SMTP | açık                                 |
| Host            | `smtp.resend.com`                       |
| Port            | `587`                                   |
| Username        | `resend`                                |
| Password        | Resend API anahtarı (Vercel'dekiyle aynı olabilir) |
| Sender email    | `siparis@laffogato.net`                 |
| Sender name     | `L'Affogato`                            |

Ardından **Authentication → Emails → Templates**. Üç şablonun Türkçe ve marka
uyumlu hâli bu depoda duruyor; içeriği olduğu gibi yapıştır:

- `docs/email/supabase-confirm-signup.html` → *Confirm signup*
- `docs/email/supabase-reset-password.html` → *Reset Password*
- `docs/email/supabase-change-email.html` → *Change Email Address*

Konu satırları:

- Confirm signup — `L'Affogato — e-posta adresini doğrula`
- Reset Password — `L'Affogato — şifre sıfırlama`
- Change Email — `L'Affogato — e-posta adresi değişikliği`

Şablonlar `src/lib/email/send.ts`'teki mesajlarla aynı tasarımı kullanır. Üye
ikisini de aynı markadan alıyor; biri değişirse diğeri de değişmeli.

---

## 4. Uygulamanın şifre sıfırlaması nereye iniyor

Kapandı. `resetPasswordForEmail` artık `redirectTo` veriyor ve bağlantı
uygulamanın **kendi ekranına** iniyor (`lafmobil · src/app/yeni-parola.tsx`,
`src/lib/supabase/auth-link.ts`). Kurtarma oturumu adresin `#` parçasından
okunuyor ve yeni parola `updateUser` ile Supabase'e yazılıyor.

Bunun çalışması için Supabase → Authentication → **URL Configuration →
Redirect URLs** listesinde şunun bulunması gerekir — **eklendi (8 Eyl)**:

```
laffogato://yeni-parola
```

> Geliştirme sırasında Expo Go ile denemek işe yaramaz: `Linking.createURL`
> özel şema tanımlıyken host'u boşaltır ve orada da `laffogato://yeni-parola`
> üretir, Expo Go'nun beklediği `exp://…/--/…` biçimini değil. Sıfırlama akışı
> yalnız development build ya da store build üzerinde denenebilir.

**Site tarafı buna göre ayarlandı.** İkisi tek üyeliği paylaştığı için
(`docs/AUTH-BRIDGE.md`) parolanın iki kopyası var: buradaki bcrypt özeti ve
Supabase'deki kimlik. Artık ikisi de değiştirilebiliyor, dolayısıyla:

- **Burada sıfırlanınca** `resetPasswordWithToken` yeni parolayı servis rolü
  anahtarıyla Supabase'e de yazıyor. Yoksa eski parola uygulamayı açmaya
  devam ederdi.
- **Uygulamada sıfırlanınca** Supabase yeni parolayı biliyor, buradaki özet
  eskide kalıyor. Sitedeki giriş, Supabase'in kabul ettiği parolayı görüp
  özeti ona uyduruyor (`adoptSupabasePassword`). Bu olmasaydı üye tam tersini
  yaşardı: yeni parola sitede reddedilir, eski parola çalışmaya devam ederdi.

Servis rolü anahtarı **yoksa** ilk madde çalışmaz, o yüzden ikinci madde de
devre dışı kalır: anahtar olmadan sitenin kendi kopyası tek yetkili sayılır
ve uyuşmazlık reddedilir (`hasSupabaseAdmin`). Yani `SUPABASE_SERVICE_ROLE_KEY`
tanımlıysa iki yön de kapalı; değilse uygulamada sıfırlama sitenin girişini
çözmez.

> Masaüstünde açılan bir uygulama sıfırlama postası hâlâ tamamlanamaz:
> bağlantı `laffogato://` şemasını taşır, tarayıcı bunu açamaz. Masaüstündeki
> üyenin yolu sitenin kendi "şifremi unuttum" akışıdır - o Resend'den çıkar,
> `?token=` ile gelir ve aynı parolayı iki yere birden yazar.

Kayıt doğrulama postası bilerek dokunulmadan bırakıldı: `signUp` bir
`emailRedirectTo` vermiyor, bağlantı Supabase'in **Site URL**'sine iniyor.
Uygulamanın şemasına çevrilseydi masaüstünde açan herkes için bozulurdu.
Site URL'nin `https://laffogato.net` olması gerekir; site oraya
`?dogrulandi=1` ile gelen üyeye doğrulamanın tuttuğunu söyler.

## 5. Mesajın kendisi — şablonlar

Sitenin gönderdiği on yedi mesajın markup'ı `src/lib/email/templates/*.html`
içinde durur; `send.ts` yalnızca alanları doldurur. Şablon dili, alan
listesi, görsellerin yeri ve paletin nereden geldiği o klasörün
`README.md`'sinde.

| Dosya                    | Ne yapar                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `templates/*.html`       | tasarımın kendisi; elle düzenlenen tek yer                                                |
| `templates.generated.ts` | derlenmiş string haritası — **commit'lenir**, elle düzenlenmez                            |
| `public/email/**`        | şablonların çağırdığı görseller (logo, bant, damga, ikon) — `https://laffogato.net/email/…` ile mutlak |
| `fill.ts`                | `[ALAN]`, `<!--IF:-->`, `<!--EACH:-->` ve HTML kaçışlama                                   |
| `render.ts`              | şablon + değer → `{subject, html, text}` + 6563 kontrolü + bayraklar (`AD`, `APP_LINKS`, `GORSEL`, `KOD`, `TARIH`, `DIPNOT`, `VURGU`) |
| `text.ts`                | her mesajın düz metin yarısı                                                              |

On yedi şablon:

| Şablon                                 | Tür               | Tetikleyen                                                            |
| -------------------------------------- | ----------------- | --------------------------------------------------------------------- |
| `eposta-dogrulama`                     | işlemsel          | sitede kayıt / adres değişikliği (`uye/actions.ts`, `admin/musteriler`) |
| `sifre-sifirlama`                      | işlemsel          | sitede "şifremi unuttum"                                              |
| `siparis-alindi`                       | işlemsel          | sipariş oluşturuldu (`odeme/actions.ts`, mobil `orders.ts`)           |
| `odeme-onaylandi`                      | işlemsel          | ödeme onaylandı (`admin/store.ts`)                                    |
| `hos-geldin`                           | ilişki            | `sendWelcomeEmail` hazır, çağıran yok                                 |
| `karaoke-rezervasyon`                  | işlemsel          | `sendKaraokeConfirmationEmail` hazır, çağıran yok                     |
| `sadakat-ikram`                        | işlemsel          | `sendLoyaltyRewardEmail` hazır, çağıran yok                           |
| `bulten-kampanya`                      | **ticari (6563)** | kampanya e-postası — 3 ürün seçkisi + kod                             |
| `mobil-uygulama`                       | **ticari (6563)** | uygulama duyurusu; mağaza linkleri tanımlı değilken hiç gönderilmez   |
| `dogum-gunu`                           | **ticari (6563)** | `sendBirthdayEmail` hazır, çağıran yok                                |
| `kampanya-duyuru` … `kampanya-indirim` | **ticari (6563)** | `/admin/bulten/kampanya` ve uygulama gönderisi kancası — bkz. §7      |

Şablon değiştirdikten sonra `npm run email:build` (ya da `npm run build` /
`npm run dev` — ikisi de kendiliğinden çalıştırır). Tarayıcıda görmek için
geliştirmede `/dev/mail/<dosya-adi>`.

**6563 ayrımı koda gömülü:** on ticari şablon — `bulten-kampanya`,
`mobil-uygulama`, `dogum-gunu` ve yedi `kampanya-*` — çıkış bağlantısı
olmadan derlenmez; kalan yedi işlemsel mesaja çıkış bağlantısı konulamaz.
`renderEmail` ikisini de reddeder, `tests/email-templates.test.ts` ikisini de
kilitler. Çıkış bağlantısı `unsubscribeUrlFor(token)` →
`/api/bulten/cikis?token=…`: mail istemcisinin RFC 8058 tek tık POST'u
sayfa açmadan token'ı harcar, insan aynı bağlantıdan `/bulten/cikis`
sayfasına yönlendirilir.

**Kampanya ailesi:** yedi `kampanya-*` şablonu tek alan sözlüğü paylaşır
(`KAMPANYA_*` zorunlular; görsel / kod / tarih / dipnot / vurgu blokları alanı
boşsa düşer). `send.ts` aileyi `CAMPAIGN_TEMPLATES` · `renderCampaignMail`
(senkron; önizleme ve test) · `sendCampaignMail` (tek alıcı, sağlayıcı
sonucuyla) ile, toplu gönderimi `deliverBatch` ile sunar: Resend
`/emails/batch`, çağrı başına en çok 100 ileti, `Idempotency-Key` başlığı
(`cmp-<kampanya>-b<parti>`) sayesinde yeniden deneme aynı kutuya iki kez
düşmez. Kim, kime, ne zaman gönderir — §7.

**Mağaza linkleri:** uygulama henüz yayında değil.
`NEXT_PUBLIC_APP_STORE_URL` ve `NEXT_PUBLIC_PLAY_STORE_URL` tanımlı değilken
maillerdeki uygulama şeridi tümüyle düşer — hiçbir yere gitmeyen buton
gönderilmez. İkisi de girildiğinde şerit kendiliğinden geri gelir; uygulama
duyurusu maili ise onlar olmadan hiç gönderilmez.

## 6. Sır saklama kuralı

API anahtarı bu depoda **hiçbir dosyada** durmaz — `.env.example`'da da,
belgede de, commit mesajında da. Anahtarın yeri Vercel'in ortam değişkenleri
ve Supabase'in SMTP kutusudur; ikisi de yazıldıktan sonra bir daha
okunamayacak şekilde saklar. Sızdığından şüphelenirsen Resend → API Keys'ten
o anahtarı sil, yenisini üret, iki yere de yeniden gir.

---

## 7. Kampanya e-postaları

Ticari ileti (6563) artık koddan çıkıyor: panel `/admin/bulten/kampanya`'da
bir kampanya yazar, kitleyi seçer, kendine test gönderir ve "Gönder" der.
Yayına giren bir mobil gönderi (`/admin/mobil/gonderiler`, "Yayınlanınca
pazarlama izni olan üyelere e-posta gönder" kutusu) aynı yoldan kendiliğinden
bir `kampanya-duyuru` kampanyası açar ve gönderiyi `emailCampaignId` ile
işaretler; sonraki kayıtlar bir daha mail çıkarmaz.

Motor `src/lib/email/campaigns.ts`; veri `campaign_emails` +
`campaign_email_sends`; şema ve dört plpgsql yardımcısı
`db/migrations/20260908150000_campaign_emails.sql`.

### Kime gider — kitle kuralı

Kural veritabanında **tek yerde** durur: `campaign_email_audience(p_audience,
p_pref)`. Paneldeki "N adrese gidecek" sayısı da kuyruk da aynı fonksiyonu
okur; ikisi birbirinden ayrı düşemez.

| Kitle        | Kaynak                   | Şart                                                                                                                                                      |
| ------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marketing`  | `customers`              | `isActive` · `emailVerified` · `notificationPrefs.<tercih> = true` · `marketing` tercihi için `marketingConsentAt` dolu · `@laffogato.local` (misafir) ve `@anon.local` (kapalı hesap) hariç |
| `newsletter` | `newsletter_subscribers` | `isActive` · `consentAt` dolu · `unsubToken` dolu (jetonsuz satıra çıkış bağlantısı kurulamaz, dolayısıyla mail de gitmez)                                |
| `both`       | ikisinin birleşimi       | aynı adres bir kez; üye satırı kazanır (çıkış bağlantısı hesabın tercihlerini kapatsın diye)                                                              |

`<tercih>`: `bulten-kampanya` şablonu `newsletter`, yedi `kampanya-*` şablonu
`marketing` tercihini okur (`prefForTemplate`).

### Jetonlar ve tek tıkla çıkış

Her alıcı satırı kendi çıkış bağlantısını taşır:
`https://laffogato.net/api/bulten/cikis?token=…`. Abonelerin jetonu zaten
vardı; üyeler için `customers."unsubToken"` eklendi ve kuyruğa alınırken
eksikse basılır (`ensureCustomerUnsubToken` tek satır için aynı işi yapar).
Bağlantı hem altbilgide hem `List-Unsubscribe` /
`List-Unsubscribe-Post: List-Unsubscribe=One-Click` başlıklarındadır.

- `POST /api/bulten/cikis?token=…` — RFC 8058: posta istemcisinin kendi
  "abonelikten çık" düğmesi buraya `List-Unsubscribe=One-Click` gönderir.
  Jeton harcanır, 200 düz metin döner. (Başlık daha önce yalnız GET'e cevap
  veren sayfayı gösteriyordu; düğme hiçbir şey yapmıyordu.)
- `GET /api/bulten/cikis?token=…` — 303 ile `/bulten/cikis?token=…`
  sayfasına; sayfa jetonu kendisi harcar ve sonucu anlatır.
- Jeton hangi listedense o satır kapanır **ve** aynı adresin öbür listesi de
  kapanır: abone jetonu → üyenin `marketing`/`newsletter` tercihleri kapanır,
  `marketingConsentAt` boşalır; üye jetonu → bülten satırı da pasifleşir.
  İki rıza kaydı bir daha ayrı düşmez (`src/lib/customer/unsubscribe.ts`).
- Uygulamanın `PATCH /me` ile `newsletter` tercihi artık siteyle aynı biçimde
  `newsletter_subscribers`'a da yazılır (`src/lib/mobile/me.ts`); daha önce
  uygulamadan abone olan üyenin listede satırı, dolayısıyla jetonu yoktu.

### Panel akışı

1. **Taslak** — şablon + alanlar + kitle. Alanlar `campaignFieldsSchema`'dan
   geçer (bilinmeyen anahtar düşer, uzunluk sınırı, `https` zorunlu). "Bana
   test gönder" tek gerçek gönderimdir: AD = Test, çıkış bağlantısı sahte
   (`?token=onizleme`), gönderim defterine yazılmaz.
2. **Gönder** — önce bir örnek alıcı derlenir; şablonun istediği bir alan
   eksikse burada, alanın adıyla patlar ve hiçbir satır kuyruğa girmez.
   Sonra `campaign_email_enqueue` kitleyi `campaign_email_sends`'e döker:
   her (kampanya, adres) çifti tek satır, 100'lük partiler (`batchNo`).
3. **Gönderim** — `runCampaignEmail`: parti al (`campaign_email_claim`,
   `for update skip locked`; 15 dakikadır `sending`'de kalmış satırlar ölü
   bir çalıştırıcıdan sayılır ve yeniden alınır), her satırı alıcının adı ve
   kendi çıkış bağlantısıyla derle, `POST /emails/batch`
   (`Idempotency-Key: cmp-<kampanya>-b<parti>`), `campaign_email_mark` ile
   tek ifadede işaretle. Partiler arası 200 ms; 429'da 1 s (varsa
   `Retry-After`) bekleyip **aynı anahtarla** en çok 3 kez yeniden dener.
   Süre dolunca (240 s) durum `sending` kalır; kalan partileri cron bitirir.
   Hiçbir e-posta çıkmadıysa kampanya `failed`, kısmi başarı `sent` +
   sayaçlar.
4. **Yeniden "Gönder"** güvenlidir: mevcut alıcılar atlanır (`on conflict do
   nothing`), `skipped` satırlar kuyruğa döner, yeni gelenler **yeni** parti
   numarası alır — bir parti numarası anahtarın parçasıdır ve bir adres
   kümesi için kullanılmış anahtar başka bir küme için tekrar kullanılmaz.
   Aynı anahtar aynı küme için tekrar gittiğinde Resend 24 saat içinde
   yinelemez.

### Cron ve `CRON_SECRET`

`vercel.json` → `crons`: `/api/cron/campaign-emails`, her gün `0 6 * * *`
(UTC; 09:00 İstanbul). Uç `Authorization: Bearer <CRON_SECRET>` bekler —
sabit zamanlı karşılaştırma; `CRON_SECRET` tanımsızsa 503, yanlışsa 401.
Vercel başlığı kendisi ekler; yapılacak tek şey ortam değişkenini tanımlamak
(`.env.example`). Görev `queued` / `sending` durumundaki her kampanyayı
kaldığı yerden, eskisi önce sürdürür; ortak süre 240 s.

### Emniyet kilitleri

- `RESEND_API_KEY` yoksa parti `skipped` işaretlenir, kampanya `failed` +
  `lastError: RESEND_API_KEY tanımlı değil.`; anahtar tanımlanınca "Gönder"
  aynı satırları yeniden kuyruğa alır, kimse iki kez almaz.
- `VERCEL_ENV` tanımlı ve `production` değilse gerçek gönderim reddedilir
  (`skipped` + `failed`): her bağlantı önizleme adresine işaret ederdi.
- `CAMPAIGN_EMAIL_DRY_RUN=1` — derle, `skipped` işaretle, HTTP yok.

### Resend sınırları

10 istek/sn; toplu uçta çağrı başına 100 mesaj; **ücretsiz planda günde 100
e-posta**. Motor parti başına en çok 100 mesaj gönderir ve partiler arasında
200 ms bekler; 100'den kalabalık bir kitleye göndermeden **önce** Resend planı
yükseltilmeli — yoksa ikinci parti 429/403 ile `failed` düşer ve o alıcılar
elle yeniden kuyruğa alınmadan (failed nihaidir) mail almaz. Bounce / şikâyet
bastırma listesi henüz yok (`docs/AUDIT.md` §5).
