# EMAIL-RESEND - hangi e-posta nereden çıkıyor

> Bu belge `src/lib/email/send.ts`, `/admin/ayarlar → E-posta` sekmesi ve
> Supabase Auth'un şablonlarını bir arada anlatır. Ortak üyeliğin nasıl
> çalıştığı `docs/AUTH-BRIDGE.md`'dedir; bu belge yalnız **mesajın kendisiyle**
> ilgilenir.

---

## 0. İki yol var, ikisi de aynı Resend hesabını kullanır

Site ile uygulama **tek bir Supabase projesini** kimlik için paylaşır
(`docs/AUTH-BRIDGE.md` §0). Ama e-postayı ikisi aynı yerden göndermez:

| Mesaj                            | Kim gönderir                   | Nasıl               |
| -------------------------------- | ------------------------------ | ------------------- |
| Ödeme onaylandı (tek sipariş maili) | Site (`src/lib/email/send.ts`) | Resend **HTTP API** |
| Sitede kayıt → e-posta doğrulama | Site                           | Resend HTTP API     |
| Sitede "şifremi unuttum"         | Site                           | Resend HTTP API     |
| **Uygulamada kayıt → doğrulama** | **Supabase Auth**              | **Resend SMTP**     |
| **Uygulamada "şifremi unuttum"** | **Supabase Auth**              | **Resend SMTP**     |
| Üye e-posta adresini değiştirdi  | Supabase Auth                  | Resend SMTP         |
| **Uygulamada kodla giriş**       | **Supabase Auth**              | **Resend SMTP**     |

İkisini de yapılandırmak gerekir. Yalnız birini yaparsan yarısı sessizce
çalışmaz: sitenin e-postaları sunucu günlüğüne düşer, uygulamanınkiler
Supabase'in kendi gönderenimden İngilizce olarak çıkar ve saatte birkaç
mesajdan sonra hiç çıkmaz.

---

## 1. Alan adı doğrulaması (ikisi için de ön koşul)

Resend, hesapta **doğrulanmamış** bir alan adından hiçbir şey göndermez.
`laffogato.net` Resend'de kayıtlı (bölge `eu-west-1`, açılış/tıklama takibi
kapalı - şifre sıfırlama bağlantısının üçüncü bir yönlendiriciden geçmesi
istenmiyor). Doğrulanması için DNS'e şu üç kayıt girilmeli:

| Tür   | Ad                  | Değer                                                    | TTL  |
| ----- | ------------------- | -------------------------------------------------------- | ---- |
| `TXT` | `resend._domainkey` | Resend panelindeki DKIM değeri (`p=MIGfMA0…` ile başlar) | Auto |
| `MX`  | `send`              | `feedback-smtp.eu-west-1.amazonses.com` (öncelik 10)     | 60   |
| `TXT` | `send`              | `v=spf1 include:amazonses.com ~all`                      | 60   |

Kayıtlar girildikten sonra Resend → Domains → `laffogato.net` → **Verify**.
Yayılma birkaç dakika ile birkaç saat arası sürer.

**Durum: doğrulandı (8 Eyl 2026).** DNS Vercel'de (`ns1.vercel-dns.com`),
üç kayıt da `verified`, `siparis@laffogato.net`'ten gönderilen test mesajı
`delivered` döndü.

> Doğrulama bitene kadar gönderilen her mesaj `403 … domain is not verified`
> ile döner. `/admin/ayarlar → E-posta → Test gönder` bu cümleyi olduğu gibi
> gösterir; tahmin etmeye gerek yok.

### Doğrulama takılırsa: iki tuzak, ikisi de bu alan adında yaşandı

Kurulum yarım gün sürdü ve sebebi ikisi de **eski bir Resend kurulumundan
kalan** kayıtlardı. Bir dahakine ilk bakılacak yer burası:

1. **Selector'da birden fazla DKIM anahtarı.** `resend._domainkey` altında iki
   TXT vardı. Bir DKIM selector'ı **tam olarak bir** anahtara çözülmek
   zorundadır; ikisi birden varken doğrulayıcı hangisinin geçerli olduğunu
   seçemez ve doğrulama hiç sonuçlanmaz. Belirtisi karakteristik: Resend
   `failed` demez, `pending`de takılır - "baktım yanlış" değil, "karar
   veremiyorum". İki anahtarın ilk 41 karakteri de aynıdır (standart RSA-1024
   ASN.1 öneki), o yüzden göz kararı ayırt edilmez; 42. karakterden itibaren
   karşılaştır.
2. **Yanlış bölgeyi gösteren MX.** `send` MX'i `ap-northeast-1` diyordu, oysa
   alan adı `eu-west-1`'de. Resend bunu bir süre `verified` gösterdi - kendi
   kontrolü kaydın _varlığına_ bakıyor, değerine değil.

Teşhis için DNS'i **otoriteye** sor, önbelleğe değil; ara çözümleyiciler eski
değeri dakikalarca tutar:

```bash
node -e 'const d=require("dns");d.resolve4("ns1.vercel-dns.com",(e,ips)=>{
  const r=new d.Resolver();r.setServers(ips);
  r.resolveTxt("resend._domainkey.laffogato.net",(e,t)=>console.log(t.length,"DKIM kaydi"));
  r.resolveMx("send.laffogato.net",(e,m)=>console.log(m));})'
```

Bir kez `failed` görünmesi ölümcül değil: kayıtlar düzeltildikten sonra
**Verify**'ı tekrar tetiklemek yeni bir denetim turu başlatır ve geçer.

---

## 2. Site tarafı - Vercel ortam değişkenleri

`laffogato` projesinde (Vercel → Settings → Environment Variables):

| Anahtar          | Ortam                              | Not                                            |
| ---------------- | ---------------------------------- | ---------------------------------------------- |
| `RESEND_API_KEY` | Production · Preview · Development | Resend API anahtarı. **Yalnız sunucuda.**      |
| `EMAIL_FROM`     | (isteğe bağlı)                     | `L'Affogato <siparis@laffogato.net>` biçiminde |

`RESEND_API_KEY` yoksa kod hata vermez: mesajı sunucu günlüğüne yazar ve
`false` döner. Bu bilerek böyle - bir sipariş, onay maili gitmedi diye
kaybolmamalı. Ama o hâlde kimse doğrulama bağlantısını alamaz, yani bu
değişken üretimde **zorunludur**.

`NEXT_PUBLIC_` ön eki **kullanılmaz**. Anahtar tarayıcıya inerse hesabın
tamamı gitmiş demektir.

> Resend'in resmî Vercel entegrasyonu kuruluysa `RESEND_API_KEY`'i projeye
> kendisi enjekte eder; elle ikinci bir kopya eklemeye gerek yok.

### Gönderen adresi panelden değişir

`EMAIL_FROM` bir kaçış kapısıdır, birincil ayar değil. Sıralama:

1. **`/admin/ayarlar → E-posta`** - panelden, deploy gerekmeden
2. `EMAIL_FROM` - veritabanı olmayan bir dağıtım için
3. `L'Affogato <siparis@laffogato.net>` - koddaki varsayılan

Doğrulanmış alan adı DNS'te değiştiğinde adresin de değişmesi gerekir; bunun
için bir sürüm çıkmak zorunda kalmamak, panelin var oluş sebebidir
(`CLAUDE.md` - uygulamada güncelleme yapmadan değişebilmeli).

Aynı sekmedeki **Test gönder**, zinciri tek tıkla kanıtlar: anahtar var mı,
alan adı doğrulanmış mı, adres kabul ediliyor mu. Diğer bütün yollar bir
gönderim hatasını bilerek yutar, dolayısıyla sağlayıcının söylediği tek yer
burasıdır.

---

## 3. Uygulama tarafı - Supabase Auth SMTP

Uygulamanın kayıt ve şifre sıfırlama e-postalarını Supabase gönderir. Kendi
yerleşik göndericisi **üretim için değildir**: saatte birkaç mesajla
sınırlıdır ve `noreply@mail.app.supabase.io` adresinden İngilizce çıkar.

Supabase Dashboard → proje → **Authentication → Emails → SMTP Settings**:

| Alan               | Değer                                              |
| ------------------ | -------------------------------------------------- |
| Enable Custom SMTP | açık                                               |
| Host               | `smtp.resend.com`                                  |
| Port               | `587`                                              |
| Username           | `resend`                                           |
| Password           | Resend API anahtarı (Vercel'dekiyle aynı olabilir) |
| Sender email       | `siparis@laffogato.net`                            |
| Sender name        | `L'Affogato`                                       |

Ardından **Authentication → Emails → Templates**. Dört şablonun Türkçe ve marka
uyumlu hâli bu depoda duruyor; içeriği olduğu gibi yapıştır:

- `docs/email/supabase-confirm-signup.html` → _Confirm signup_
- `docs/email/supabase-reset-password.html` → _Reset Password_
- `docs/email/supabase-change-email.html` → _Change Email Address_
- `docs/email/supabase-magic-link.html` → _Magic Link_ (14 Eki 2026,
  lafmobil karar 316: uygulamanın "E-postama giriş kodu gönder"i
  `signInWithOtp` ile bunu tetikler). Şablon `{{ .Token }}` taşımak
  **zorunda**: Supabase'in varsayılanı yalnız bağlantı taşır, bağlantı
  telefonda Site URL'sine iner ve uygulamada oturum açmaz. Kodun uzunluğu
  Authentication → Email → "Email OTP Length" (uygulama 6-10 rakam kabul
  eder); ömrü "Email OTP Expiration" (3600 sn, değiştirme).

Konu satırları (tek çizgi, tire; 23 Eyl 2026'dan önce yapıştırılanlar uzun
tireyle yazılmıştı, şablonlarla birlikte bunları da güncelle):

- Confirm signup - `L'Affogato - e-posta adresini doğrula`
- Reset Password - `L'Affogato - şifre sıfırlama`
- Change Email - `L'Affogato - e-posta adresi değişikliği`
- Magic Link - `L'Affogato - giriş kodun`

Şablonlar sitenin e-postalarıyla aynı iskeleti ve aynı `<style>` bloğunu
kullanır (15 Eki 2026): açık ve koyu modda okunur, logo
`https://laffogato.net/email/logo-laf-tile.png` karosudur. Görsel siteden
gelir; şablonları **site deploy edildikten sonra** yapıştır. Üye ikisini de
aynı markadan alıyor; biri değişirse diğeri de değişmeli.

---

## 4. Uygulamanın şifre sıfırlaması nereye iniyor

Kapandı. `resetPasswordForEmail` artık `redirectTo` veriyor ve bağlantı
uygulamanın **kendi ekranına** iniyor (`lafmobil · src/app/yeni-parola.tsx`,
`src/lib/supabase/auth-link.ts`). Kurtarma oturumu adresin `#` parçasından
okunuyor ve yeni parola `updateUser` ile Supabase'e yazılıyor.

Bunun çalışması için Supabase → Authentication → **URL Configuration →
Redirect URLs** listesinde şunun bulunması gerekir - **eklendi (8 Eyl)**:

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

## 5. Mesajın kendisi - şablonlar

Sitenin gönderdiği yirmi iki mesajın markup'ı `src/lib/email/templates/*.html`
içinde durur; `send.ts` yalnızca alanları doldurur. Şablon dili, alan
listesi, görsellerin yeri ve paletin nereden geldiği o klasörün
`README.md`'sinde.

| Dosya                    | Ne yapar                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `templates/*.html`       | tasarımın kendisi; elle düzenlenen tek yer                                                                                            |
| `templates.generated.ts` | derlenmiş string haritası - **commit'lenir**, elle düzenlenmez                                                                        |
| `public/email/**`        | şablonların çağırdığı görseller (logo, bant, damga, ikon) - `https://laffogato.net/email/…` ile mutlak                                |
| `fill.ts`                | `[ALAN]`, `<!--IF:-->`, `<!--EACH:-->` ve HTML kaçışlama                                                                              |
| `render.ts`              | şablon + değer → `{subject, html, text}` + 6563 kontrolü + bayraklar (`AD`, `APP_LINKS`, `GORSEL`, `KOD`, `TARIH`, `DIPNOT`, `VURGU`, `TAKIP_LINKI`, `FIRMA`; çağırandan `ODEME_ALINDI` / `ODEME_YOK` / `KARTA_IADE`) |
| `text.ts`                | her mesajın düz metin yarısı                                                                                                          |

Yirmi iki şablon - her satırda **tetikleyici · izin sınıfı · idempotency**:

| Şablon                                 | Tür               | Tetikleyici · idempotency                                                       |
| -------------------------------------- | ----------------- | ------------------------------------------------------------------------------- |
| `eposta-dogrulama`                     | işlemsel          | sitede kayıt / adres değişikliği (`uye/actions.ts`, `admin/musteriler`)         |
| `sifre-sifirlama`                      | işlemsel          | sitede "şifremi unuttum"                                                        |
| `odeme-onaylandi` | işlemsel | müşterinin kargoya kadar aldığı TEK sipariş maili: ödeme siparişi `paid`'e taşıdığında (`applyPaymentSucceeded`, elle "Ödendi"; ₺0 sipariş de) · `order_notice_emails` (sipariş, `paid`). Kalemler, toplam ve ÖBF/MSS/cayma bağlantıları (kalıcı veri saklayıcısı) |
| `siparis-kargoda`                      | işlemsel          | panelin kargo formu, "Kargoya ver", Geliver'ın teslim olayı · `order_notice_emails` (sipariş, `shipped:<numara özeti>`) |
| `siparis-iptal`                        | işlemsel          | `transitionOrder` iptali (toplu iptal de oradan geçer) · (sipariş, `cancelled`) |
| `siparis-iade`                         | işlemsel          | panel iadesi (`finalizeRefund`), sağlayıcı iadesi (`recordProviderRefund`) · (sipariş, `refund:<iade id>`) |
| `hos-geldin`                           | ilişki            | `sendWelcomeEmail` hazır, **çağıran yok**                                       |
| `karaoke-rezervasyon`                  | işlemsel          | ödeme onaylandı (otomatik onay) ya da personel onayladı (`setReservationStatus`) · durum geçişi bir kez olur; ödenmişse makbuz + iki saat kuralı + imzalı rezervasyon bağlantısı |
| `karaoke-iptal`                        | işlemsel          | üye, misafir bağlantısı, personel ya da hesap kapanışı iptal etti · aynı geçiş kilidi; ödenmişse iade tutarı |
| `sadakat-ikram`                        | işlemsel          | `sendLoyaltyRewardEmail` hazır, **çağıran yok**                                 |
| `bulten-kampanya`                      | **ticari (6563)** | `sendCampaignMail` · 3 ürün seçkisi + kod · `cmp-<kampanya>-b<parti>`           |
| `mobil-uygulama`                       | **ticari (6563)** | `/admin/bulten/kampanya` "Uygulama duyurusu" · `cmp-<kampanya>-b<parti>` · mağaza linkleri olmadan seçilemez |
| `dogum-gunu`                           | **ticari (6563)** | günlük cron (`/api/cron/birthday`) · idempotency = kuponun kendisi              |
| `kampanya-duyuru` … `kampanya-indirim` | **ticari (6563)** | `/admin/bulten/kampanya`, zamanlama ve gönderi kancası - bkz. §7                |

**`mobil-uygulama` kampanya panelinde (23 Eyl 2026).** Şablon listesinde
"Uygulama duyurusu (sabit metin)" olarak durur: doldurulacak alanı yok, konu
şablonun kendi `data-subject`'i, `[DAMGA_HEDEFI]` senkron render'dan önce
`campaignServerVars()` ile mobil uygulama ayarlarından okunur, kitle yalnız
pazarlama izni olan üyelerdir. `NEXT_PUBLIC_APP_STORE_URL` ve
`NEXT_PUBLIC_PLAY_STORE_URL` ikisi de tanımlanana kadar panel seçeneği
gri gösterir, sunucu da taslağı, önizlemeyi, testi, kuyruğu ve gönderimi
reddeder (`campaignMailTemplateAvailable`). Linkler girildikten sonra bir
kampanya olarak zamanlanıp gönderilir; eski `sendAppAnnouncementEmail`
hâlâ çağıransızdır.

**Sipariş bildirimleri (23 Eyl 2026).** Hukuki metinler üç e-posta söz
veriyordu, hiçbiri gitmiyordu: taşıyıcıya teslimde kargo takip numarası
(Teslimat ve Kargo Politikası m.15), satıcının iptali ve geri ödeme.
Kimin ne zaman alacağı `src/lib/email/order-notices.ts`'te: yalnız mağaza
siparişi (kafe siparişi, gel-al ya da kurye, hiçbirini almaz), gerçek bir
adres (misafir ve kapatılmış hesap almaz); kargo e-postası ayrıca takip
numarası ve ödenmiş, geri alınmamış bir sipariş ister. Her bildirim önce
`order_notice_emails`'te (sipariş, tür) satırını **talep eder**; ikinci talep
23505 alır ve göndermez, yani tekrar eden Geliver olayı, iki kez kaydedilen
form ya da sağlayıcının yeniden bildirdiği iade ikinci bir e-posta
doğurmaz. Başarısız gönderim satırı `failed` olarak, sağlayıcının hatasıyla
bırakır (adresler maskelenir); bir sonraki tetik onu boş bir satır gibi
devralır ve yeniden dener. Resend'e `order-<sipariş>-<tür>` idempotency
anahtarı da gider. Sipariş sayfasının "E-postalar" bölümü bu satırları
listeler; "Yeniden gönder" (onaydan sonra) aynı e-postayı, hâlâ doğruysa,
`<tür>#resend-<n>` türüyle bir kez daha yollar (`resendOrderNotice`).
Fatura/e-arşiv e-postası bu işin dışında: avukat ve e-arşiv kararı bekliyor.

Şablon değiştirdikten sonra `npm run email:build` (ya da `npm run build` /
`npm run dev` - ikisi de kendiliğinden çalıştırır). Tarayıcıda görmek için
geliştirmede `/dev/mail/<dosya-adi>`.

**6563 ayrımı koda gömülü:** on ticari şablon - `bulten-kampanya`,
`mobil-uygulama`, `dogum-gunu` ve yedi `kampanya-*` - çıkış bağlantısı
olmadan derlenmez; kalan on iki işlemsel mesaja çıkış bağlantısı konulamaz.
`renderEmail` ikisini de reddeder, `tests/email-templates.test.ts` ikisini de
kilitler. Çıkış bağlantısı `unsubscribeUrlFor(token)` →
`/api/bulten/cikis?token=…`: mail istemcisinin RFC 8058 tek tık POST'u
sayfa açmadan token'ı harcar, insan aynı bağlantıdan `/bulten/cikis`
sayfasına yönlendirilir.

**Ticari altbilgide unvan ve MERSİS:** on ticari şablonun altbilgisinde,
adresin altında, tek sessiz satır - `[UNVAN] · MERSİS: [MERSIS]` (11 px, ayak
notunun soluk rengi); düz metin ikizinde `COMMERCIAL_FOOTER`'ın ilk satırı.
Ticari İletişim Yönetmeliği m.8/1 tacirin ticari elektronik iletisinin
içeriğinde ticaret unvanını ve MERSİS numarasını arar (m.6'nın "adı veya
unvanı"nı imza zaten karşılıyordu). Değerler `LEGAL_ENTITY`'den
`commonVars` ile gelir, şablona yazılmaz; işlemsel on iki mesajın ayağı kısa
kalır. Test: `%s names the sender's title and MERSİS in both halves`.

**Kampanya ailesi:** yedi `kampanya-*` şablonu tek alan sözlüğü paylaşır
(`KAMPANYA_*` zorunlular; görsel / kod / tarih / dipnot / vurgu blokları alanı
boşsa düşer). `send.ts` aileyi `CAMPAIGN_TEMPLATES` · `renderCampaignMail`
(senkron; önizleme ve test) · `sendCampaignMail` (tek alıcı, sağlayıcı
sonucuyla) ile, toplu gönderimi `deliverBatch` ile sunar: Resend
`/emails/batch`, çağrı başına en çok 100 ileti, `Idempotency-Key` başlığı
(`cmp-<kampanya>-b<parti>`) sayesinde yeniden deneme aynı kutuya iki kez
düşmez. Kim, kime, ne zaman gönderir - §7.

**Mağaza linkleri:** uygulama henüz yayında değil.
`NEXT_PUBLIC_APP_STORE_URL` ve `NEXT_PUBLIC_PLAY_STORE_URL` tanımlı değilken
maillerdeki uygulama şeridi tümüyle düşer - hiçbir yere gitmeyen buton
gönderilmez. İkisi de girildiğinde şerit kendiliğinden geri gelir; uygulama
duyurusu maili ise onlar olmadan hiç gönderilmez.

## 6. Sır saklama kuralı

API anahtarı bu depoda **hiçbir dosyada** durmaz - `.env.example`'da da,
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
işaretler; sonraki kayıtlar bir daha mail çıkarmaz. Kutu yalnız **yeni** bir
kampanya gönderisinde işaretli başlar; düzenlemede her zaman kapalıdır (eski
bir kampanyayı sıra düzeltirken bütün üye tabanına yollamamak için) ve
işaretlenirse kayıt düğmesi "tüm üyelere bir kez gidecek" diye bir kez daha
sorar (`src/lib/admin/post-mail-default.ts`).

Motor `src/lib/email/campaigns.ts`; veri `campaign_emails` +
`campaign_email_sends`; şema ve beş plpgsql fonksiyonu (kitle, sayım, kuyruk,
parti alma, işaretleme) `db/migrations/20260908150000_campaign_emails.sql`.
Kitle, kuyruk ve parti alma `20260908170000_campaign_email_reconsent.sql` ile
yeniden tanımlandı: onay parti alınırken yeniden okunur, sağlayıcıya verilen
parti `postedAt` ile kayda geçer, bültende üyeden onay kaydı aranır, parti
alma kampanya başına sıraya girer (kampanya satırı `for update`), işaretleme
yalnız kendi partisini kapatır (`p_claimed_at`), kuyruğa dönen satır yeni
parti numarası alır (hepsi aşağıda). Eski imzalar (üç argümanlı
`campaign_email_claim`, altı argümanlı `campaign_email_mark`) bir sürüm
boyunca uyumluluk için durdu, çünkü migration dağıtıldığı anda `after()`
içinde olan eski çalıştırıcı yeni fonksiyonu bilmiyordu.
`20260923230100_drop_legacy_campaign_email_overloads.sql` ikisini de düşürdü;
bugün yalnız dört argümanlı parti alma ve yedi argümanlı işaretleme var
(`tests/db-integration-schema-objects.test.ts` gerçek Postgres'te tutar).

### Kime gider - kitle kuralı

Kural veritabanında **tek yerde** durur: `campaign_email_audience(p_audience,
p_pref)`. Paneldeki "N adrese gidecek" sayısı da, kuyruk da, parti alma da
aynı fonksiyonu okur; üçü birbirinden ayrı düşemez.

| Kitle        | Kaynak                   | Şart                                                                                                                                                                                                                                                                                                            |
| ------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marketing`  | `customers`              | `isActive` · `emailVerified` · `notificationPrefs.<tercih> = true` · onay kaydı: `marketing` tercihi için `marketingConsentAt` dolu, `newsletter` tercihi için `newsletter_subscribers`'da aynı adrese ait aktif ve `consentAt` dolu satır · `@laffogato.local` (misafir) ve `@anon.local` (kapalı hesap) hariç |
| `newsletter` | `newsletter_subscribers` | `isActive` · `consentAt` dolu · `unsubToken` dolu (jetonsuz satıra çıkış bağlantısı kurulamaz, dolayısıyla mail de gitmez)                                                                                                                                                                                      |
| `both`       | ikisinin birleşimi       | aynı adres bir kez; üye satırı kazanır (çıkış bağlantısı hesabın tercihlerini kapatsın diye)                                                                                                                                                                                                                    |

`<tercih>`: `bulten-kampanya` şablonu `newsletter`, yedi `kampanya-*` şablonu
`marketing` tercihini okur (`prefForTemplate`).

**Bültende üyenin bayrağı tek başına yetmez.** `customers` tablosunda
`newsletter` tercihi için bir onay damgası yok (yalnız `marketingConsentAt`
var, o da `marketing` içindir); bültenin onay defteri `newsletter_subscribers`
(`consentAt` · `consentIp` · `consentText`) - sitenin hesap sayfası ile
uygulamanın `PATCH /me`'si tercih açılınca bu satırı yazar. Satırı olmayan
üye (bu yazım eklenmeden önce uygulamadan abone olan) tercihi yeniden açana
kadar kitle dışıdır. 6563'te ispat yükü göndericidedir; çıplak bir boolean o
yükü taşımaz.

**Şablon kitleyi sınırlar.** Yedi `kampanya-*` şablonu her iki yarısında
"Yalnız L'Affogato üyelerine özel" der; bu yüzden yalnız `marketing` kitlesine
gider - üye olmayan bir bülten abonesine "bu sana değil" yazan mail
yollanmaz. `bulten-kampanya` bu satırı taşımaz ve üç kitleye de gidebilir.
Kural `createCampaignEmail` / `updateCampaignEmail`'de (form da, gönderi
kancası da oradan geçer); panel formu kampanya şablonlarında kitle seçicisini
"Pazarlama izni olan üyeler"e kilitler.

### Jetonlar ve tek tıkla çıkış

Her alıcı satırı kendi çıkış bağlantısını taşır:
`https://laffogato.net/api/bulten/cikis?token=…`. Abonelerin jetonu zaten
vardı; üyeler için `customers."unsubToken"` eklendi ve kuyruğa alınırken
eksikse basılır (`ensureCustomerUnsubToken` tek satır için aynı işi yapar).
Bağlantı hem altbilgide hem `List-Unsubscribe` /
`List-Unsubscribe-Post: List-Unsubscribe=One-Click` başlıklarındadır.

- `POST /api/bulten/cikis?token=…` - RFC 8058: posta istemcisinin kendi
  "abonelikten çık" düğmesi buraya `List-Unsubscribe=One-Click` gönderir.
  Jeton harcanır, 200 düz metin döner. (Başlık daha önce yalnız GET'e cevap
  veren sayfayı gösteriyordu; düğme hiçbir şey yapmıyordu.) Uç proxy'nin
  dışında ve her giden başlıkta ilan ediliyor; her POST paylaşılan `max:1`
  havuzda üç sorguya kadar harcar. Bu yüzden kimlik denetimlerinin
  Postgres tabanlı sınırlayıcısından geçer (`rate-limit.ts`, amaç
  `unsubscribe`) - ve giriş gibi **başarısızlığı** sayar, isteği değil:
  yalnız hiçbir şeyle eşleşmeyen jeton (bilinmeyen ya da harcanmış) IP'nin
  kovasına yazılır, 5 dakikada 20 boş jeton 1 dakika 429 + `Retry-After`
  getirir; geçerli bir jeton hiç sayılmaz. Ayrım burada girişten önemli: tek
  tık POST'u kişinin cihazından değil posta sağlayıcısının ortak
  sunucularından gelir (Gmail, Yahoo, Outlook.com küçük bir çıkış havuzu
  kullanır) ve kampanyadan hemen sonra aynı sağlayıcıdan çıkışlar kümelenir;
  her isteği saymak yirminci kişinin yasal çıkışını (6563 m.8) reddederdi.
  Uydurma jeton seli yine IP başına pencerede ~20 sorguda kalır; engellenen
  istek iki rıza deposuna da dokunmaz. GET kendi başına veritabanına
  dokunmaz (yönlendirme), sınırlayıcıya girmez.
- `GET /api/bulten/cikis?token=…` - 303 ile `/bulten/cikis?token=…`
  sayfasına; sayfa jetonu kendisi harcar ve sonucu anlatır.
- Testler: `tests/api-unsubscribe-route.test.ts` (POST 200 / 429 / 500, GET
  303, jetonsuz istek depoya dokunmaz, geçerli jeton kovaya yazılmaz),
  `tests/api-cron-campaign-emails.test.ts` (`CRON_SECRET` kapısı).
- Jeton hangi listedense o satır kapanır **ve** aynı adresin öbür listesi de
  kapanır: abone jetonu → üyenin `marketing`/`newsletter` tercihleri kapanır,
  `marketingConsentAt` boşalır; üye jetonu → bülten satırı da pasifleşir.
  İki rıza kaydı bir daha ayrı düşmez (`src/lib/customer/unsubscribe.ts`).
- Uygulamanın `PATCH /me` ile `newsletter` tercihi artık siteyle aynı biçimde
  `newsletter_subscribers`'a da yazılır (`src/lib/mobile/me.ts`); daha önce
  uygulamadan abone olan üyenin listede satırı, dolayısıyla jetonu yoktu.

### Panel akışı

1. **Taslak** - şablon + alanlar + kitle. Alanlar `campaignFieldsSchema`'dan
   geçer (bilinmeyen anahtar düşer, uzunluk sınırı, `https` zorunlu);
   tarayıcı tarafında `required` yoktur - yarım taslak kaydedilir, eksik
   alanı "Gönder" adıyla reddeder. "Bana test gönder" tek gerçek gönderimdir:
   AD = Test, çıkış bağlantısı sahte ama üyelerinkiyle aynı yolda
   (`/api/bulten/cikis?token=onizleme` - başlıklar da aynı, uç ona 200
   "Bağlantı geçersiz" der), gönderim defterine yazılmaz. Alıcı yalnız
   oturumdaki hesap ya da `admin_users`'daki aktif bir hesap olabilir; başka
   bir adrese "Test yalnız panel kullanıcılarına gönderilir."
2. **Gönder** - önce bir örnek alıcı derlenir; şablonun istediği bir alan
   eksikse burada, alanın adıyla patlar ve hiçbir satır kuyruğa girmez.
   Sonra `campaign_email_enqueue` kitleyi `campaign_email_sends`'e döker:
   her (kampanya, adres) çifti tek satır, 100'lük partiler (`batchNo`).
   Kitle boşsa satır yoktur; kampanya 0 alıcıyla "Gönderildi" olarak kapanır
   (mesaj da bunu söyler).
3. **Gönderim** - `runCampaignEmail`: parti al (`campaign_email_claim`;
   15 dakikadır `sending`'de kalmış satırlar ölü bir çalıştırıcıdan sayılır
   ve yeniden alınır), her satırı alıcının adı ve kendi çıkış bağlantısıyla
   derle, partiyi `postedAt` ile **önce** kayda geç, sonra `POST
/emails/batch` (`Idempotency-Key: cmp-<kampanya>-b<parti>`),
   `campaign_email_mark` ile tek ifadede işaretle. Partiler arası 200 ms;
   429'da 1 s (varsa `Retry-After`) bekleyip **aynı anahtarla** en çok 3 kez
   yeniden dener. Süre dolunca (240 s) durum `sending` kalır; kalan partileri
   cron bitirir. Boş bir parti alma da bitiş değildir: `queued`/`sending`
   satır kaldıysa (başka bir çalıştırıcı bir partiyi tutuyordur) kampanya
   `sending` kalır ve onu bitiren kapatır. Hiçbir e-posta çıkmadıysa kampanya
   `failed`, kısmi başarı `sent` + sayaçlar.

   **İki çalıştırıcı aynı partiyi bölüşemez.** Panelin `after()`'ı ile 06:00
   cron'u çakışabilir, "Gönder"e iki kez basılabilir. `campaign_email_claim`
   bu yüzden işe kampanya satırını `for update` ile kilitleyerek başlar ve
   kilit ifadenin sonuna kadar durur: ikinci çalıştırıcı bekler, sonra ilkinin
   taze `sending` satırlarını görür ve **bir sonraki** partiyi alır (`skip
locked` kemer olarak kalır). Kilitsiz hâlde ikisi de en düşük partiyi
   okuyor, `skip locked` her birine ötekinin yetişemediği satırları veriyor ve
   ikisi de `cmp-<id>-b<n>`'yi yarım adres kümesiyle gönderiyordu - Resend
   ikinciyi reddeder (aynı anahtar, farklı içerik) ya da ilkinin işareti
   ikincinin hiç göndermediği satırları `sent` yapardı. İkinci kemer:
   `campaign_email_mark` yalnız kendi parti almasının `claimedAt` damgasını
   taşıyan satırları kapatır (`p_claimed_at`); bayat pencereyi aşıp partisini
   başkasına kaptıran bir çalıştırıcı işaretleyecek satır bulamaz.

4. **Yeniden "Gönder"** güvenlidir: mevcut alıcılar atlanır (`on conflict do
nothing`), `skipped` satırlar kuyruğa döner - ama yalnız kitle kuralının
   **hâlâ** adını verdiği alıcılar için ve kuralın o an verdiği biçimde (tür,
   ad, çıkış bağlantısı yeniden okunur; harcanıp yeniden basılmış bir jeton
   ölü bağlantıyla gitmez), gerisi `skipped` kalır ve satır nedenini söyler -
   ve **kuyruğa dönen satır yeni parti numarası alır**, yeni gelenler de
   ondan sonrakini. Bir parti numarası anahtarın parçasıdır ve bir adres
   kümesi için kullanılmış anahtar başka bir küme için tekrar kullanılmaz:
   parti alma tek bir satırı onay için atlayabildiğinden, `skipped` bir satır
   ötekiler için **gönderilmiş** bir partiye ait olabilir; eski numarasıyla
   dönse aynı anahtar başka bir kümeyle giderdi (pencere içinde 422 ile
   boşuna `failed`, pencere dışında ikinci teslim). Aynı anahtar aynı küme
   için tekrar gittiğinde Resend 24 saat içinde yinelemez.

### Kuyruk ile gönderim arasında onay geri çekilirse

Kuyruğa alınmak gönderilmek değildir: satırlar günlerce bekleyebilir
(anahtarsız gönderim, ücretsiz planda 100'den kalabalık kitle, süre dolması).
Bu yüzden `campaign_email_claim` her partiden **önce** kampanyanın bütün
`queued` (ve bayat `sending`) satırlarını kitle kuralına karşı yeniden okur:
üye satırı `campaign_email_audience('marketing', <tercih>)`'te, abone satırı
`('newsletter', <tercih>)`'te hâlâ adıyla ve jetonuyla duracak, satırın
taşıdığı bağlantıdaki jeton **o anki** jetonla aynı olacak. Bağlantıdan
çıkan (jeton silinir), uygulamada/sitede tercihi kapatan, hesabı kapanan,
bülten satırı pasifleşen ya da jetonu bu arada değişmiş olan herkes
`skipped` + `error: onay geri çekildi ya da kitle dışına çıktı` olur ve o
partide yer almaz; sayaçlar aynı ifadede tazelenir. Sağlayıcıya verilmiş
(`postedAt` dolu) bir satıra bu geçiş dokunmaz - o ya aynı anahtarla yeniden
alınır ya da aşağıdaki kuralla kapanır, asla yeniden derlenip gitmez.

Sınır: onay **parti alınırken** okunur (read committed - ifadenin kendi
anlık görüntüsü). Parti alındıktan sonraki saniyelerde, parti alma ifadesi
çalışırken kesinleşen ya da POST'tan hemen önce gelen bir çıkış o partiye
yetişmez; bir sonraki partiyi ve sonraki kampanyayı etkiler. Tek ifadelik bir
yeniden okumanın doğası budur; kapatılmaz, bilinir.

### Sağlayıcıya verilmiş ama işaretlenememiş parti - 22 saat kuralı

Sıra: parti `sending` → `postedAt` yazılır → `POST /emails/batch` → Resend
kabul eder → `campaign_email_mark` **düşer** (havuz kopar). Satırlar
`sending` + `postedAt` ile kalır, kampanya `failed`; cron `failed`'a
dokunmaz, "Yeniden gönder" operatörün elindedir. Bundan sonra
`campaign_email_claim` `postedAt`'e bakar:

Resend anahtarı **24 saat** tutar, kendi aldığı ilk istekten itibaren.
Eşik ise parti **alınırken** ölçülür (`POSTED_EXPIRES_MS`), POST ondan sonra
gelir - derleme, partiler arası bekleme, en çok üç 429 denemesi, üstelik
Resend'inki olmayan bir saatle. 23:58'de alınıp 24:01'de POST edilen parti
pencerenin dışına düşer ve iki kez giderdi. Bu yüzden çalıştırıcı kendine
**22 saat** tanır; 2 saat pay:

- `postedAt` **22 saatten genç**: satırlar bayat sayılınca (15 dk) yeniden
  alınır ve aynı anahtar aynı adres kümesiyle tekrar gider - Resend
  anahtarı tanır ve yinelemez. `postedAt` yeniden yazılmaz; ilk teslim anı
  geçerlidir.
- `postedAt` **22 saatten yaşlı**: Resend'in anahtar penceresi kapanmış ya da
  POST'a kadar kapanacaktır; aynı istek yeni bir istek sayılır ve 100 kişi
  ikinci kopyayı alırdı. Satır `failed` + `error: sağlayıcı yanıtı teyit
edilemedi` olur ve **bir daha gönderilmez**; teslim edilmiş olabilir,
  kararı Resend panosuna bakan bir insan verir. `failed` nihaidir, sonraki
  "Gönder" diriltmez.

Testler: `tests/campaign-emails.test.ts` ("consent between queue and send",
"a batch posted but never settled", "a consent-skipped row that comes back",
"settles only the rows of its own claim"), şeklin kendisi
`tests/campaign-emails-migration.test.ts`. Parti alma kilidi gerçek bir
PostgreSQL 16'da sınandı: iki eşzamanlı `campaign_email_claim`, 120 üye, 25
tur - inceleme kilitsiz sürümde 25/25 turda 0. partiyi ikiye bölmüştü;
kilitli sürümde 0/25, her turda biri 100 satırla 0. partiyi, öteki 20 satırla

1. partiyi aldı. (Bellek içi stub bu kilidi modelleyemez; testte kemer olan
   `claimedAt` kapsamı sabitlenir.)

### ⚠️ Cron sayısı deploy'u durdurabilir (22 Eyl 2026)

`vercel.json` üç cron ve saatlik bir program istiyordu. Vercel'in **Hobby**
planı en fazla **2 cron** ve **yalnız günlük** program veriyor - ve fazlasını
gördüğünde cron'u değil **deploy'u** reddediyor.

Sonuç: **16 Eyl - 22 Eyl arası üretime hiçbir şey çıkmadı.** Site ayakta
kaldı çünkü eski derlemeyi sunuyordu, bu yüzden kimse fark etmedi; ama
`main`'e merge edilen her şey (e-posta otomasyonu, alerjen yayını,
sözleşmenin §18/§19'u, panel sinyalleri) depoda bekledi.

Şimdi iki cron var:

| Yol | Program | Ne yapar |
|---|---|---|
| `/api/cron/daily` | 06:00 UTC (09:00 İstanbul) | kampanyalar → doğum günü → imha, sırayla |
| `/api/cron/campaign-emails` | 12:00 UTC (15:00 İstanbul) | zamanlanmış kampanyalar için ikinci geçiş |

> ⚠️ **Kanonik ad APEX: `https://laffogato.net`** (22 Eyl 2026 kararı).
> canonical, sitemap, og:url ve JSON-LD `@id`ler bunu yayımlar;
> `NEXT_PUBLIC_SITE_URL` de bu. Vercel'de **apex Production olmalı, `www`
> 308 ile apex'e gitmeli** - tersi kurulursa her canonical bir yönlendirme
> sekmesi yapar ve Search Console "yönlendiren sayfa" der.
>
> Yönlendirmeyi izlemeyen istemciler için 308 sessiz bir arızadır (400'ün
> altında, "başarılı" sayılır). Dışarıdan çağıran her şey - GitHub Actions
> işi, **Geliver webhook URL'i**, bir izleyici - `https://laffogato.net/…`
> ile yazılmalı; `curl` çağrılarına `--location-trusted` eklenmeli.
> Geliver kurulumu ve doğrulama planı: **`docs/GELIVER.md`**.

Aradaki boşluğu `.github/workflows/campaign-hourly.yml` **ücretsiz daraltır**:
programı `0 * * * *` olarak `/api/cron/campaign-emails`e vurur. Ama bu
**saatlik değildir**: GitHub zamanlanmış işleri garanti etmez, yoğunlukta
erteler ve atlar. Ölçüm (22-23 Eyl 2026, `gh run list`): turlar arası 2 ile
5,5 saat. Üstüne konan bir katman, tek bayrak direği değil; iş hiç çalışmasa
da Vercel'in 06:00 ve 12:00 UTC geçişleri alır. Hiçbir kampanya kaybolmaz,
yalnız gecikebilir. Panel bu yüzden zamanlanmış kampanya için "genelde birkaç
saat içinde" der ve belli bir sabah çıkacak gönderiyi birkaç saat öne kurmayı
önerir (karar campaign-cadence (a), 23 Eyl 2026).

**Saatlik hassasiyet gerekirse** iki yol var, ikisi de operatör kararı:
(b) dış bir zamanlayıcı (cron-job.org, Upstash QStash) aynı uca saatte bir
`Authorization: Bearer <CRON_SECRET>` ile `https://laffogato.net/api/cron/campaign-emails`
GET atar (hesabı operatör açar, secret'ı oraya o girer); (c) Vercel Pro'da
eski saatlik cron satırı geri konur (aşağıda).

> **Tek seferlik kurulum - yapıldı (22 Eyl 2026):** depo → Settings →
> Secrets and variables → Actions → `CRON_SECRET` tanımlı (`gh secret list`:
> 22 Eyl 2026 08:52 UTC) ve zamanlanmış çalışmalar başarıyla bitiyor. Değer
> Vercel'dekiyle **birebir aynı** kalmalı: Vercel'de değişirse burada da
> değiştirilir, yoksa iş 401 alır ve kırmızı yanar. Secret silinirse iş
> kendini atlar, kırmızı yanmaz.

**Plan yükseltilirse** (Pro: 40 cron, istediğin program): `vercel.json`'daki
eski üç satırlık listeyi geri koy - `/api/cron/birthday`,
`/api/cron/retention` ve saatlik `/api/cron/campaign-emails` rotalarının
üçü de **silinmedi**, yerlerinde duruyor. `tests/vercel-crons.test.ts`
içindeki iki sabiti de gevşetmek gerekir.

### Cron ve `CRON_SECRET`

`vercel.json` → `crons`, iki görev, ikisi de aynı kapıdan geçer
(`src/app/api/cron/_auth.ts`): `Authorization: Bearer <CRON_SECRET>`, sabit
zamanlı karşılaştırma; `CRON_SECRET` tanımsızsa **503**, yanlışsa 401.
Vercel başlığı kendisi ekler; yapılacak tek şey ortam değişkenini tanımlamak
(`.env.example`).

| Görev                       | Kim, ne sıklıkla                                                  | Ne yapar                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/cron/daily`           | Vercel, `0 6 * * *` (UTC)                                         | aşağıdaki kampanya işi, sonra doğum günü, en son imha                                                                                |
| `/api/cron/campaign-emails` | Vercel `0 12 * * *` (UTC) + GitHub Actions (2-5,5 saatte bir)     | (1) `scheduledAt`'i gelmiş taslakları kuyruğa alır, (2) `queued`/`sending` her kampanyayı kaldığı yerden sürdürür; ortak süre 240 s |
| `/api/cron/birthday`        | programda değil (işi `/api/cron/daily` yapar)                     | o günün doğum günleri: kupon herkese, kutlama yalnız izin verene                                                                     |

Kampanya işi ne kadar sık koşarsa zamanlamanın saati o kadar anlamlı olur;
boş bir kuyruk ucuzdur (tek `select`), bu yüzden sıklık maliyet getirmez.
Bugünkü sıklık yukarıdaki "birkaç saat" sınırıdır.

### Zamanlanmış kampanya - "özel günler"

Anneler Günü, yılbaşı, 14 Şubat, köşkün yıldönümü: ayrı bir "özel günler"
tablosu **yok** ve olmayacak. Eksik olan kampanya değil, zamanlamaydı.
Taslağa bir `scheduledAt` (panelde "Gönderim zamanı", `datetime-local`)
yazılır; zamanı geldikten sonraki ilk kampanya turu (genelde birkaç saat
içinde, yukarıda) zamanı gelmiş **taslakları** `queueCampaignEmail` ile
kuyruğa alır ve gerisi bu belgenin geri kalanında anlatılan boru hattıdır.

- Saat **İstanbul saatidir.** Alan zonesizdir, sunucu UTC'dedir; sunucunun
  saatiyle okunsa operatörün yazdığı 09:00 Tuzla'da 12:00 olurdu.
  `normalizeScheduledAt` zonesiz değere açıkça `+03:00` ekler (Türkiye 2016'dan
  beri yaz saati uygulamıyor).
- Okunamayan bir değer sessizce **boşa** döner: kimsenin seçmediği bir saatte
  ticari ileti çıkmaz.
- Kuyruğa alınamayan bir taslağın (şablonda boş zorunlu alan) zamanlaması
  **temizlenir** ve sebep `lastError`'a yazılır; her turda yeniden denenip
  duran bir kampanya olmaz, taslak operatörü bekler.
- Zamanlamadan vazgeçmek: alanı boşaltıp taslağı yeniden kaydet.

### Doğum günü - kupon ile mail aynı şey değildir

Operatörün sorusu ("üyelere doğum gününde mail gidiyor mu") 15 Eyl 2026'ya
kadar **hayır**dı: `sendBirthdayEmail` yazılmış ve çağıransızdı, kupon ise
yalnız üye `laffogato.net/uye/hesap/promosyonlar` sayfasını doğum günü AYINDA
açarsa doğuyordu - uygulamadan bakan üye ikisini de hiç görmüyordu.

Günlük cron ikisini ayırır:

|                  | Kupon                                                     | Kutlama maili                                                                      |
| ---------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Ne               | hesap hakkı, ileti değil                                  | ticari ileti (6563) - kutlama + %20 teklif                                         |
| Kime             | aktif + adresi doğrulanmış her üye, o gün doğum günü olan | yalnız `notificationPrefs.marketing` açık **ve** `marketingConsentAt` kayıtlı olan |
| Çıkış bağlantısı | -                                                         | zorunlu (`List-Unsubscribe`, `data-commercial="1"`)                                |

İzin vermemiş üye kuponunu yine alır, sessizce.

- **Takvim Tuzla'nındır:** `birthdayDaysFor` İstanbul duvar saatinden "AA-GG"
  üretir; 21:30 UTC'de İstanbul çoktan ertesi gündedir.
- **29 Şubat:** artık olmayan yılın 1 Mart'ında listeye `02-29` de eklenir.
- **IDEMPOTENCY kuponun kendisidir:** `grantBirthdayCouponToday` yalnız satırı
  YAZDIYSA kuponu döndürür (`hasBirthdayCouponThisYear` - üye başına yılda bir),
  `null` dönerse mail de gitmez. Cron iki kez koşsa da kimse iki kez
  kutlanmaz; ayrı bir defter yok.
- **Kupon süresi şablonla aynı gerçektir:** `BIRTHDAY.ttlDays = 7`. Şablon
  "7 gün geçerli" diyor, kupon da verildiği andan itibaren 7 gün yaşıyor. Eski
  hâl ay sonunda bitiyordu: 28'inde doğana 3 gün, 2'sinde doğana 29 gün.
  "Doğum gününüzde aktifleşir" cümlesi de kalktı - kupon yazıldığı anda
  aktiftir.
- Web'deki ay bazlı `maybeGrantBirthdayCoupon` yedek olarak durur ve aynı
  7 günü kullanır.

### Karaoke - onay ve iptal

`setReservationStatus` başarıyla `confirmed`'a geçtiğinde
`karaoke-rezervasyon`, `cancelled`'a geçtiğinde `karaoke-iptal` gider. İkisi
de **işlemsel**tir: üye odayı kendisi istedi, ona sonucu söyleniyor - izin
aranmaz, çıkış bağlantısı konmaz.

- **Rezervasyon kodu için yeni kolon yok:** `id` zaten benzersiz, sıralı ve
  okunur - `krk-00042`, mailde `KRK-00042`.
- **Tetikleyicinin tek çağıranı** panelin Onayla / İptal düğmeleridir; üye
  kendine mail attıramaz.
- **IDEMPOTENCY** `UPDATE`'in durum kilididir: satır bir kez geçer, ikinci
  basış yarışı kaybeder ve maile hiç ulaşmaz.
- Sağlayıcı hatası rezervasyonu **düşürmez** (sipariş mailindeki kalıp), ama
  panel bunu söyler: "Bilgilendirme e-postası GÖNDERİLEMEDİ - üyeye kendin
  ulaş." Log'da adres maskelidir (KVKK).

### Karaoke - online ön ödeme (16 Eki 2026)

Rezervasyon ödenince kendiliğinden `confirmed` olur ve `karaoke-rezervasyon`
**makbuz** olarak gider (`KARAOKE_ODENDI`): ödenen tutar, operatörün iki
cümlesi ("Rezervasyon saatine 2 saatten fazla varken iptal edersen…" / "…2
saatten az kala yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi
yapılmaz."), cayma hakkı yokluğu (MSY m.15/1-g), rezervasyonun imzalı sayfası
(`[KARAOKE_LINK]`, `/rezervasyon?t=…`; misafir rezervasyonu yalnız bununla
yönetilir) ve koşulların tamamına bağlantı. İşletme iptalinde tam iade ve
tahsilatın ayrıntısı (PayNkolay, tek çekim) mailde yok, bağlantılı belgede
(17 Eki 2026, metin kısaltma). Köşkte ödenen eski akışta
`KARAOKE_ODEME_MEKANDA` bölümü gider. İptalde `karaoke-iptal` iade tutarını
(`KARAOKE_IADE`) ya da ödeme alınmadığını (`KARAOKE_ODEMESIZ`) söyler. İki
mail de baştan sona "sen" der; ortak uygulama bloğu ("Köşk cebinizde") ailenin
"siz"iyle kalır.

Operatöre iki yeni iç mail: `sendKaraokePaidOperatorEmail` (ödendi ve
kesinleşti, `Idempotency-Key: karaoke-<id>-paid`; ödenmemiş rezervasyon için
"talep" maili gitmez) ve `sendKaraokeMoneyAlertEmail` (POS'un reddettiği ya da
yanıt vermediği iade, ikinci tahsilat, süresi dolmuş rezervasyona gelen ödeme,
tutar uyuşmazlığı; `karaoke-<id>-<olay>`).

### Karaoke - yeni talep bildirimi (operatöre)

Bir karaoke saati istendiği anda - uygulamadan (`POST /karaoke/reservations`)
ya da web `/karaoke` formundan (`bookKaraokeAction`) - köşke düz metin bir
**iç** e-posta gider (`sendKaraokeOperatorEmail`). Alıcı Ayarlar → Karaoke →
**Talep bildirimi e-postası** (`settings.karaokeNotifyEmail`, 26 Eyl 2026'dan
beri `bizimfutbol9@gmail.com`); boşsa genel iletişim adresi (`settings.email`).

- Müşteri maillerinin tasarımıyla gider (`operasyon-bildirim.html`, bkz.
  `src/lib/email/templates/README.md` "Ekibe giden mailler"); konu satırı
  tarih, saat, kişi ve rezervasyon kimliğini taşır, alt başlık "Web
  sitesinden" ya da "Uygulamadan" der.
- **Yanıt adresi üyedir** - operatör "Yanıtla"ya basınca talep edene yazar.
- `Idempotency-Key: karaoke-<id>-requested` - aynı istek yeniden denenirse
  ikinci kopya düşmez.
- Mail hatası rezervasyonu **düşürmez**: satır zaten yazılmış ve panelde
  görünür; hata log'a gider.

### Yeni sipariş bildirimi (ekibe, 15 Eki 2026)

Ödemesi onaylanan her sipariş (uygulama ve web; masa, gel-al, kurye, kargo)
için ekibe bir **iç** "Yeni sipariş" e-postası gider
(`src/lib/email/staff-order-notice{,-core}.ts`, `operasyon-bildirim.html`).

- **Tetik:** `applyPaymentSucceeded` siparişi `pending_payment`'tan `paid`'e
  taşıdığında, yanıt gittikten **sonra** (`after()`). Ödemeyi beklemez,
  bozamaz; hata log'a gider.
- **Bir kez:** `order_notice_emails` satırı (kind `staff-new`) gönderimden önce
  alınır; ikinci tetik satırı dolu bulur.
- **Gönderim:** bütün alıcılar **tek istekte** (`POST /emails/batch`, istek
  başına 100), `Idempotency-Key: order-<id>-staff-new-<alıcı listesinin özeti>-b<n>`
  (adres anahtara yazılmaz). 429, 5xx ya da bağlantı hatası aynı anahtarla iki
  kez daha denenir (1 sn, 2,5 sn; `Retry-After` en çok 3 sn beklenir).
  Hiçbir alıcıya ulaşılamazsa satır `failed` olarak bırakılır ve **aynı ödemenin** sonraki
  onayı (bankanın dönüşü, tekrar gelen webhook) maili yeniden dener - yalnız
  `paidAt`'ten sonraki **30 dakika** içinde. Daha uzun bir sağlayıcı kesintisinde
  sipariş panelden görülür; geç gelen "yeni sipariş" maili mutfağı yanıltır.
- **Alıcılar** (Ayarlar → Bildirimler, yalnız sahip): işaretli rollerdeki aktif
  panel kullanıcıları ve env yöneticileri, ek adresler (en çok 20) ve operasyon
  adresi; küçük harfe çevrilir, her adres bir kez. Kasiyerin düğmesi kasaya,
  diğerlerininki siparişe gider. Olay kaydı adresleri metin olarak yazmaz:
  sayı, eklenen/çıkarılan adet ve alan adları.
- **İçerik (KVKK m.4 ölçülülük):** sipariş no, kanal, tür, teslimat ya da masa,
  planlı saat, ürünler, toplam, ödeme yolu ve müşterinin **yalnız adı** (e-posta
  ya da telefona benzeyen "ad" düşer). Soyad, telefon, e-posta, adres yazılmaz;
  not yalnız masa ve gel-al siparişinde (kurye notu kapı kodu taşır).
- Üyenin ya da panelin yazdığı metin şablon alanı sayılmaz: notta "[OK]",
  üründe "Kahve [250G]" olduğu gibi gider (`fill.ts` tek geçişte doldurur,
  eksik alan şablonun kendisinden aranır).

### Emniyet kilitleri

- `RESEND_API_KEY` yoksa parti `skipped` işaretlenir, kampanya `failed` +
  `lastError: RESEND_API_KEY tanımlı değil.`; anahtar tanımlanınca "Gönder"
  aynı satırları yeniden kuyruğa alır, kimse iki kez almaz.
- `VERCEL_ENV` tanımlı ve `production` değilse gerçek gönderim reddedilir
  (`skipped` + `failed`): her bağlantı önizleme adresine işaret ederdi.
- `CAMPAIGN_EMAIL_DRY_RUN=1` - derle, `skipped` işaretle, HTTP yok.

### Resend sınırları

10 istek/sn; toplu uçta çağrı başına 100 mesaj; **ücretsiz planda günde 100
e-posta**. Motor parti başına en çok 100 mesaj gönderir ve partiler arasında
200 ms bekler; 100'den kalabalık bir kitleye göndermeden **önce** Resend planı
yükseltilmeli - yoksa ikinci parti 429/403 ile `failed` düşer ve o alıcılar
elle yeniden kuyruğa alınmadan (failed nihaidir) mail almaz. Bounce / şikâyet
bastırma listesi aşağıda.

### Bounce ve şikâyet bastırma (23 Eyl 2026 - operatör açana kadar kapalı)

Kalıcı geri dönen (Resend `email.bounced`, `bounce.type = Permanent`) ya da
alıcının spam olarak işaretlediği (`email.complained`) adres
`email_suppressions` tablosuna yazılır ve **ticari** postadan düşer:
`campaign_email_audience` (sayım, kuyruk, parti alma) ve doğum günü
tebrikinin mail bayrağı (`birthday_greeting_audience`, kupon yine verilir).
Sipariş, kargo ve parola e-postaları bu listeye hiç bakmaz. Kuyruğa girdikten
sonra bastırılan adres, partisi alınırken "kitle dışına çıktı" diye atlanır.

Yazan tek yer `POST /api/webhooks/resend`: Svix imzası (`svix-id`,
`svix-timestamp`, `svix-signature`; ham gövde üzerinden HMAC-SHA256, 5
dakikalık pencere) doğrulanmadan hiçbir şey yazılmaz; `RESEND_WEBHOOK_SECRET`
tanımsızken uç **503** döner. Adres loglanmaz, yanıtta da dönmez.

Açmak için (operatör):

1. Resend panelinde Webhooks → Add endpoint:
   `https://laffogato.net/api/webhooks/resend` (kanonik alan adı; `www` 308
   döner ve POST yönlendirmeyi izlemez), olaylar `email.bounced` +
   `email.complained`.
2. Panelin gösterdiği "Signing secret"i (`whsec_...`) Vercel'de
   `RESEND_WEBHOOK_SECRET` olarak tanımla (yalnız Production), yeniden dağıt.
3. Panelden bir test olayı gönder; yanıt `200` ve gövde
   `{"ok":true,"ignored":...}` ya da `{"ok":true,"suppressed":1,...}` olmalı.

Saklama: kayıt ticari ileti gönderim kaydının parçası sayılır; son olaydan
(`updatedAt`) itibaren 3 yıl (`src/lib/retention.ts` → `email-suppressions`).
Testler: `tests/resend-webhook.test.ts`,
`tests/db-integration-schema-objects.test.ts`.
