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
> ile döner. `/admin/ayarlar?sekme=email → Test gönder` bunu Türkçe söyler
> ("laffogato.net alan adı Resend'de doğrulanmamış…"; `resendErrorText`,
> `src/lib/email/send.ts`); tanınmayan bir red Türkçe bir giriş cümlesiyle ve
> sağlayıcının kendi sözüyle gelir. Ham yanıt sunucu günlüğündedir (adresler
> maskeli).

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
burasıdır. Test **kayıtlı** gönderenle gider; yukarıdaki form kaydedilmemiş
değişiklik taşırken düğme kapalıdır. Sonuç ne olursa olsun üstteki durum
bandı yeniden okunur. Resend'in doğrulanmamış dediği bir alan adındaki yeni
gönderen adresi kaydedilmeden önce onay ister (`senderDomainStatus`,
`src/lib/email/health.ts`, 3 sn sınırlı); Resend'e ulaşılamazsa sormadan
kaydedilir.

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

- `docs/email/supabase-confirm-signup.html` → _Confirm signup_ (**5 Kas
  2026'da değişti, yeniden yapıştır**: düğme artık
  `https://laffogato.net/uygulama/dogrula?token_hash={{ .TokenHash }}&type=email`
  adresine gider ve altında 6 haneli `{{ .Token }}` yazar. iPhone'da
  uygulama 1.1.1 ve sonrası bu adresi uygulamada açıp üyeyi içeri alır
  (en düşük sürüm 1.1.1 olunca, `src/lib/mobile/app-links.ts`); bilgisayar
  ya da uygulamasız telefon `/uygulama/dogrula` sayfasında düğmeyle
  doğrular; kod uygulamanın "E-postanı doğrula" ekranına yazılır.
  Yapıştırdıktan sonra bir test adresiyle uygulamadan kayıt ol, gelen
  e-postadaki düğmeyi ve kodu dene.)
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
kullanır (15 Eki 2026; 22 Kas 2026'dan beri sitenin dilinde, markanın
yeşiliyle): açık ve koyu modda okunur, logo yeşil başlık bandındaki
`https://laffogato.net/email/laf-mark-white.png` işaretidir. Görsel siteden
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
ve uyuşmazlık reddedilir (`hasSupabaseAdmin`). Yani servis anahtarı
(`SUPABASE_SECRET_KEY`, ya da yoksa eski `SUPABASE_SERVICE_ROLE_KEY`;
`docs/AUTH-BRIDGE.md` §1) tanımlıysa iki yön de kapalı; değilse uygulamada
sıfırlama sitenin girişini çözmez.

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

Sitenin gönderdiği yirmi beş mesajın markup'ı `src/lib/email/templates/*.html`
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

Yirmi sekiz şablon - her satırda **tetikleyici · izin sınıfı · idempotency**:

| Şablon                                 | Tür               | Tetikleyici · idempotency                                                       |
| -------------------------------------- | ----------------- | ------------------------------------------------------------------------------- |
| `eposta-dogrulama`                     | işlemsel          | sitede kayıt / adres değişikliği (`uye/actions.ts`, `admin/musteriler`)         |
| `sifre-sifirlama`                      | işlemsel          | sitede "şifremi unuttum"                                                        |
| `odeme-onaylandi` | işlemsel | müşterinin kargoya kadar aldığı TEK sipariş maili: ödeme siparişi `paid`'e taşıdığında (`applyPaymentSucceeded`, elle "Ödendi"; ₺0 sipariş de) · `order_notice_emails` (sipariş, `paid`). Kalemler, toplam ve onaylanan ÖBF + MSS'nin doldurulmuş metni **ek olarak** (sürüm bağlantılarıyla); ek yoksa güncel metin bağlantıları - aşağıda "Ek: onaylanan sözleşme" |
| `siparis-kargoda`                      | işlemsel          | panelin kargo formu, "Kargoya ver", Geliver'ın teslim olayı · `order_notice_emails` (sipariş, `shipped:<numara özeti>`) |
| `siparis-hazir`                        | işlemsel          | gel-al kafe siparişi hazır (`shipped`) ve üyenin hiçbir telefonuna bildirim ulaşmadı (izin yok, eski uygulama, misafir); üyenin "Sipariş durumu" anahtarı kapalıysa gitmez (`src/lib/push/order-push.ts`, `docs/API-MOBILE.md` §23) · (sipariş, `ready`), yeniden gönderilmez |
| `siparis-iptal`                        | işlemsel          | `transitionOrder` iptali (toplu iptal de oradan geçer) · (sipariş, `cancelled`) |
| `siparis-iade`                         | işlemsel          | panel iadesi (`finalizeRefund`), sağlayıcı iadesi (`recordProviderRefund`) · (sipariş, `refund:<iade id>`) |
| `e-arsiv-fatura`                       | işlemsel          | e-Arşiv faturası Paraşüt'te resmileşince (`src/lib/invoice/run.ts`; kancalar, günlük cron, panelde "Şimdi çalıştır") · PDF ekli, kayıt başına bir kez: `invoices."emailedAt"` + `earsiv-<fatura kaydı>` anahtarı; hata olursa 5 kez geri çekilerek yeniden denenir. Ayrıntı `docs/EARSIV.md` |
| `hos-geldin`                           | ilişki            | `sendWelcomeEmail` hazır, **çağıran yok**                                       |
| `karaoke-rezervasyon`                  | işlemsel          | ödeme onaylandı (otomatik onay) ya da personel onayladı (`setReservationStatus`) · durum geçişi bir kez olur; ödenmişse makbuz + iki saat kuralı + imzalı rezervasyon bağlantısı + onaylanan karaoke sözleşmesinin doldurulmuş metni ek olarak |
| `karaoke-iptal`                        | işlemsel          | üye, misafir bağlantısı, personel ya da hesap kapanışı iptal etti · aynı geçiş kilidi; ödenmişse iade tutarı; personel iptalinde nedenle açılır |
| `karaoke-iptal-istegi`                 | işlemsel          | misafirin telefonla ya da e-postayla geç iptal isteği, kural iade vermiyor ve rezervasyon saati gelmiş: rezervasyon iptal edilmez (`notifyLateCancelRequest`; saatinden önceki istek `karaoke-iptal` ile iptal edilir, saat satışa açılır) · kilit yok, her panel kaydı bir istek |
| `karaoke-saat-degisikligi`             | işlemsel          | personel rezervasyonun tarihini / saatini değiştirdi (`rescheduleReservation`, panelde "Saati değiştir") · eski akşamla korumalı UPDATE: bir taşıma, bir mail; yeni ve eski saat, tek ödeme satırı (`karaokeRescheduleFlags`), yeni imzalı bağlantı |
| `sadakat-ikram`                        | işlemsel          | `sendLoyaltyRewardEmail` hazır, **çağıran yok**                                 |
| `hesap-silme-talebi`                   | işlemsel          | üye `/uye/hesap/sil`'den silme talebi gönderdi (`requestAccountDeletionAction`) · yalnız talep **açıldığında**, `account-deletion-<üye>-<talep anı>-member` |
| `hesap-silindi`                        | işlemsel          | ekip panelden "Hesabı sil" ile hesabı kapattı (`closeCustomerAccountAction`), kapanmadan önceki adrese · `account-deletion-<üye>-<talep anı>-closed`; giriş kimliği kaldıysa "kapatıldı" der |
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
Elle yeniden gönderilen `failed` satır, kopya çıkınca `resent` olur: aynı
e-postanın sonraki tetiği (aynı numaranın Geliver teslim olayı, tekrar eden
ödeme onayı) onu artık devralmaz, müşteriye ikinci bir kopya gitmez.
Fatura e-postası (22 Eki 2026'dan beri) bu kodun içinde, ama yalnız
`EARSIV_MODE=live` iken: site e-Arşiv faturayı Paraşüt API'siyle keser,
PDF'i Paraşüt'ten indirir ve `e-arsiv-fatura` şablonuyla, ek olarak,
siparişteki ya da rezervasyondaki e-posta adresine gönderir
(`docs/EARSIV.md`). İşlemseldir (VUK: fatura alıcıya ulaştırılır), çıkış
bağlantısı taşımaz; `@laffogato.local` / `@anon.local` adreslerine gitmez.
Kapalıyken (varsayılan) ya da `draft` modunda fatura eskisi gibi Paraşüt'te
elle kesilir ve oradan gönderilir; sözleşme metinleri ikisine de uyar
(`docs/LEGAL-REDLINES-2026-09.md` §24, §32).

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

**Mağaza linkleri:** iOS uygulaması App Store'da (1.1.0'dan beri); adresi
koda gömülü varsayılandır (`LIVE_APP_STORE_URL`, `src/lib/mobile/app-store.ts`;
`NEXT_PUBLIC_APP_STORE_URL` onu ezer). Google Play'de listeleme yok:
`NEXT_PUBLIC_PLAY_STORE_URL` boş. Maillerdeki uygulama şeridi iki düğmelik bir
çift olduğu için yalnız **ikisi de** varken basılır (`hasAppLinks()`); Play
adresi girilene kadar şerit tümüyle düşer - hiçbir yere gitmeyen buton
gönderilmez - ve uygulama duyurusu maili hiç gönderilmez. Play adresi Vercel'e
girildiğinde ikisi de kendiliğinden gelir.

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
bir kampanyayı sıra düzeltirken bütün üye tabanına yollamamak için;
`src/lib/admin/post-mail-default.ts`). İşaretliyken kayıt önce bir pencerede
sorar: pazarlama izni olan kaç üyeye gideceğini (kuyruğun okuduğu sayım)
yazar ve sayı geri yazılınca kaydeder, kampanya sayfasındaki "Gönder" gibi
(karar D15); sayılamazsa bunu söyler ve GÖNDER yazdırır
(`src/app/admin/mobil/gonderiler/post-mail-confirm.ts`). Kampanya sayfası gibi `newsletter`
yetkisi de ister (karar D27; yoksa kutu kapalıdır, action da göndermez). Ne
olduğunu kaydın toast'ı söyler (kuyruğa alındı, kimseye gitmedi, kuyruğa
alınamadı, gönderi yayında olmadığı için gitmedi); gönderi listesindeki
"E-posta" sütunu kampanyanın kendi durumunu gösterir.

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

### İYS kapısı (22 Eki 2026)

Yönetmelik: İYS dışında alınan onay 3 iş günü içinde İYS'ye kaydedilir,
kaydedilmeyen onaya dayanılamaz; ret 3 iş günü içinde İYS'ye bildirilir;
alıcı İYS'den de ret verebilir. Kapı iki yarıdır (`docs/IYS.md`):

- **Veritabanı.** Yukarıdaki tablonun her satırına bir şart daha eklenir:
  adres için `iys_recipients."iysStatus" = 'ONAY'` (operatör yüklemeyi
  onayladığında ya da İYS'nin izin listesi yüklendiğinde yazılır) ve adres
  için indirilmiş ama onaylanmamış bir RET (`iys_events`, `state =
  'exported'`) yok. `20261022180100_iys_send_gate.sql` kitle fonksiyonunu ve
  doğum günü e-postasının bayrağını yeniden tanımladı; sayım, kuyruk ve her
  partiden önceki yeniden okuma aynı fonksiyonu okuduğu için kuyruktaki bir
  adresin İYS durumu değişirse o adres partisinde `skipped` olur. İYS'de
  kayıtlı olmayan hiçbir adrese kampanya ya da doğum günü e-postası gitmez.
- **Uygulama.** Son İYS ret kontrolü (İYS izin listesinin yüklenmesi ya da
  operatörün "İYS'yi kontrol ettim, yeni ret yok" beyanı, `iys_state`) 3 iş
  gününden eskiyse hiç ticari e-posta gitmez (`src/lib/iys/gate.ts`):
  `queueCampaignEmail` kuyruğa almayı Türkçe bir gerekçeyle reddeder (önce
  İYS giden kutusunu eşitler); `runCampaignEmail` parti almaz, kampanya
  durumunu korur ve gerekçeyi `lastError`'a yazar, kontrol tazelenince cron
  ya da "Gönder" kaldığı yerden sürer; her partiden önce yeniden bakar.
  Zamanlanmış taslak zamanını korur, kontrolden sonraki ilk çalışmada
  kuyruğa girer. Doğum günü kuponu yine verilir, e-postası gitmez
  (`skippedIysCheck`).
- **İşlemsel e-posta** (sipariş, kargo, parola, doğrulama) kapıdan geçmez.

Kapı açıldığı gün mevcut onayların hiçbiri İYS'de kayıtlı görünmez: hepsi
`/admin/iys`'te "eski onay" olarak yüklenmeyi bekler ve İYS onları 3 iş günü
sınırı yüzünden reddedebilir (H467). O güne kadar kampanya kitlesi boştur.

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
   alanı "Gönder" adıyla reddeder. "Test gönder" tek gerçek gönderimdir:
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
| `/api/cron/daily` | 06:00 UTC (09:00 İstanbul) | Supabase yoklaması → kampanyalar → doğum günü → karaoke tutmaları → imha, sırayla |
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
programı `0 */3 * * *` (19 Ekim 2026'dan beri 3 saatte bir; her tur bir
Actions dakikası sayılıyor ve Neon'u uyandırıyor) olarak `/api/cron/campaign-emails`e vurur. Ama bu
**dakikası dakikasına değildir**: GitHub zamanlanmış işleri garanti etmez, yoğunlukta
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
| `/api/cron/daily`           | Vercel, `0 6 * * *` (UTC)                                         | önce Supabase yoklaması (`docs/SUPABASE-GECIS.md` §0), sonra aşağıdaki kampanya işi, doğum günü, karaoke tutmaları, en son imha      |
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
- **Geçmiş akşam:** saati geçmiş, köşkte ödenecek bir rezervasyonu panelden
  iptal etmek (müşteri gelmedi) mail göndermez (`setReservationStatus`
  `notify: false`, karar D7); saati geçmiş bir rezervasyon panelden
  onaylanmaz, onay maili de gitmez.
- **IDEMPOTENCY** `UPDATE`'in durum kilididir: satır bir kez geçer, ikinci
  basış yarışı kaybeder ve maile hiç ulaşmaz.
- Sağlayıcı hatası rezervasyonu **düşürmez** (sipariş mailindeki kalıp), ama
  panel bunu söyler: "Bilgilendirme e-postası GÖNDERİLEMEDİ - üyeye kendin
  ulaş." Log'da adres maskelidir (KVKK).

### Karaoke - online ön ödeme (16 Eki 2026)

Rezervasyon ödenince kendiliğinden `confirmed` olur ve `karaoke-rezervasyon`
**makbuz** olarak gider (`KARAOKE_ODENDI`): ödenen tutar, operatörün iki
cümlesi (28 Eki 2026'dan beri "Rezervasyonu yaptığın andan itibaren 2 saat
içinde, rezervasyon saati gelmeden iptal edersen ödediğin tutarın tamamı
kartına iade edilir." / "Rezervasyonu yaptığın andan 2 saat geçtikten sonra
yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.";
pencere rezervasyondan sonra sayılır ve en geç rezervasyon saatinden bir
dakika önce biter, `KARAOKE_REFUND_RULE` / `KARAOKE_NO_REFUND_RULE`,
LEGAL-REDLINES §37), son ücretsiz iptal anı ("Son ücretsiz iptal:
[KARAOKE_SON_IPTAL]."), cayma hakkı yokluğu (MSY m.15/1-g), rezervasyonun
imzalı sayfası (`[KARAOKE_LINK]`, `/rezervasyon?t=…`; misafir rezervasyonu
yalnız bununla yönetilir) ve koşulların tamamına bağlantı. İşletme iptalinde tam iade ve
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

**Rezervasyonun kendi kuralı (18 Eki 2026, P2a).** İptal kuralı panelden
ayarlanır (Ayarlar → Karaoke) ve her rezervasyon kendi kuralını saklar; mail
şablonu iki cümleyi artık sabit yazmaz, rezervasyonun kaydından alır:
`[KARAOKE_IADE_KURALI]` ve `[KARAOKE_GEC_KURALI]` (varsayılan 2 saat / %0
kuralında yukarıdaki iki cümlenin aynısı; 28 Eki 2026'dan önce yapılan
rezervasyon kendi sakladığı eski çifti yazar). Köşkte ödenecek rezervasyonda
`[KARAOKE_MEKAN_SURE]` sayfadan ne zamana kadar iptal edilebileceğini,
rezervasyonun yapıldığı kuralın sözleriyle söyler (`karaokeVenueCancelUntilOf`):
varsayılan kuralda "rezervasyonu yaptıktan sonraki 2 saat içinde, rezervasyon
saati gelmeden", geç iptal payı olan kuralda "rezervasyon saatinden önce", 28
Eki 2026'dan önce yapılmış rezervasyonda "rezervasyon saatine 2 saatten fazla
varken", köşkün verdiği ücretsiz telafi saatinde (`KARAOKE_TELAFI_SAATI`,
29 Eki 2026'dan beri saatin kendi kuralı) "rezervasyon saatine 2 saatten
fazla varken", başlangıca 4 saatten az kala verilen saatte "bu saat
ayrıldıktan sonraki 2 saat içinde, rezervasyon saati gelmeden";
hiçbir üye iptalinin kabul edilmediği kuralda bunun yerine `KARAOKE_MEKAN_ARA`
("bizi ara") gider. İptal maili iade edilen gerçek tutarı yazar: tamamı
(`KARAOKE_IADE`), geç iptal payı iade edildi (`KARAOKE_KISMI_IADE_EDILDI`) ya
da pay borçlu ve ekip elle iade edecek (`KARAOKE_KISMI_IADE`: tutar, "kartına
iade edilir", tarih sözü yok; ekip "Elle iade edildi" deyince ikinci mail
gider). Payı borçlu iptalde ekibe `sendKaraokeMoneyAlertEmail` ile "Geç iptal:
kısmi iade bekliyor" gider (`late-share-<ref>`). %0 kuralında geç misafir
isteğiyle iade olmadan iptal edilip saati satışa açılan rezervasyon (29 Eki
2026, LEGAL-REDLINES §37.8) `KARAOKE_SATISA_ACILDI` yazar ("ücret iadesi
yapılmadı. Saatlerini yeniden satışa açtık: ..."); saatlerinden biri satılıp
ekip o tutarı elle iade edince `KARAOKE_SATIS_IADE_EDILDI` ("o saat için
ödediğin X kartına iade edildi"; "geç iptal kuralına göre" demez, bu
rezervasyonda kural hiçbir şey vermedi), sonraki saatler
`KARAOKE_SATIS_IADE` ("... X daha").

**Personel iptalinin nedeni (19 Eki 2026, ASK-OTH-3 (c), ASK-Y3-4 (c)).**
Ödenmiş rezervasyonu panelden iptal eden kişi nedeni sabit listeden seçer
(`src/lib/mobile/karaoke-cancel-cause.ts`); yazdığı not yalnız denetim
kaydında kalır, maile hiçbir alan taşımaz. `karaoke-iptal` açılışı nedene
göre değişir: işletme nedeni (`ariza`, `kapanis`, `mucbir`, `diger`)
`KARAOKE_ISLETME` ("Rezervasyonunu biz iptal etmek zorunda kaldık:
[KARAOKE_NEDEN]. Özür dileriz.") ve `KARAOKE_TAM_IADE` ("... tutarın tamamını
kartına iade ettik"); bu mail MSY m.16/4'ün yazılı bildirimidir ve iptal
anında çıkar. Misafirin telefonla ya da e-postayla ilettiği istek
(`misafir`) `KARAOKE_ISTEK` ("İsteğin üzerine ..."); saatin başka misafire
verilmesi (`yeniden`) `KARAOKE_YENIDEN`. Üyenin kendi iptali bugünkü
sözleriyle kalır (`KARAOKE_IPTAL_GENEL`). Bir açılış ve en çok bir para
satırı (`karaokeCancellationFlags`). Misafirin geç isteğine kural iade
vermiyorsa: istek rezervasyon saatinden önceyse (kaydı sonra olsa da) rezervasyon iade
olmadan iptal edilir, saati satışa açılır ve `karaoke-iptal` gider
(`KARAOKE_ISTEK` + `KARAOKE_SATISA_ACILDI`, 29 Eki 2026); rezervasyon saati
geldiyse rezervasyon iptal edilmez ve `karaoke-iptal-istegi` gider:
rezervasyon onun adına durur. Akşam bittikten sonra kaydedilen istek yalnız
denetim kaydına girer, mail gitmez (karar D7). Onay maili son ücretsiz iptal anını yazar
(`[KARAOKE_SON_IPTAL]`, karaoke koşulları §7).

Personel rezervasyonu başka bir gün ya da saate taşıyınca (27 Ekim 2026,
operatör: "saati değiştirebilir yap, değişince de kişiye mail gitsin")
`karaoke-saat-degisikligi` gider: yeni tarih ve saat, üstü çizili eski saat
ve imzalı yeni bağlantı. Süre, kişi, ücret, ödeme ve rezervasyonun iptal
kuralı aynı kalır. Ödenmiş rezervasyonda mail "İptal kuralın değişmedi:"
der, rezervasyonun iki cümlesini ve yeniden hesaplanan son anı yazar ("Son
ücretsiz iptal: [KARAOKE_SON_IPTAL]."): son an rezervasyonun kendi kuralıyla
yeniden hesaplanır (`karaokeMovedDeadline`); 28 Eki 2026'dan beri yapılanda
rezervasyondan sayılır ve yeni saate göre uzamaz (en geç yeni başlangıçtan 1
dakika önce), daha önce yapılanda yeni başlangıçtan 2 saat öncedir. Mail bu
yüzden eskisi gibi "süreler yeni saate göre işler" demez. Tek bir ödeme
satırı: `KARAOKE_ODENDI`,
`KARAOKE_ODEME_MEKANDA` ya da `KARAOKE_TELAFI_SAATI`
(`karaokeRescheduleFlags`). Ayrıntı `docs/ADMIN.md` "Karaoke: saati değiştir".

### Karaoke - yeni talep bildirimi (operatöre)

Bir karaoke saati istendiği anda - uygulamadan (`POST /karaoke/reservations`)
ya da web `/karaoke` formundan (`bookKaraokeAction`) - köşke düz metin bir
**iç** e-posta gider (`sendKaraokeOperatorEmail`). Alıcı Ayarlar → Karaoke →
**Talep bildirimi e-postası** (`settings.karaokeNotifyEmail`); boşsa genel
iletişim adresi (`settings.email`). 19 Ekim 2026'dan beri boş: bildirim
şirketin Türkiye'de barındırılan kurumsal kutusuna gider. 26 Eyl 2026'da buraya
yazılan kişisel Gmail adresi misafirin adını, e-postasını, telefonunu ve notunu
Google'ın yurt dışındaki sunucularında tutuyordu (KVKK m.9; standart sözleşme
yok); `20261019160000_karaoke_notify_company_mailbox.sql` onu temizledi.
Buraya ya da Ayarlar → Bildirimler'e Gmail gibi yurt dışındaki kişisel bir
kutu yazılmaz; kurumsal kutu da Gmail'e yönlendirilmez ya da Gmail'den
okunmaz (aktarım geri gelir).

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
  adresi; küçük harfe çevrilir, her adres bir kez. Gmail, Hotmail, iCloud gibi
  kişisel bir kutuya hiçbir kaynaktan gitmez (`isConsumerMailbox`; sipariş
  bilgisi yurt dışındaki bir sunucuda kalırdı, KVKK m.9, LEGAL-REDLINES §15.6):
  panel böyle bir ek adresi ya da operasyon adresini kaydetmez, env veya panel
  hesabı böyleyse o hesap atlanır. Hesap silme talebi bildirimi de aynı
  kuralla gider. Kasiyerin düğmesi kasaya,
  diğerlerininki siparişe gider. Olay kaydı adresleri metin olarak yazmaz:
  sayı, eklenen/çıkarılan adet ve alan adları. E-postayı kapatmak ve açık
  bırakıp kimseye gitmeyecek bir alıcı listesi kaydetmek (aynı
  `resolveStaffRecipients` kuralıyla sayılır) onay ister.
- **İçerik (KVKK m.4 ölçülülük):** sipariş no, kanal, tür, teslimat ya da masa,
  planlı saat, ürünler (satırın barista notuyla: "· Not: şurupsuz"), toplam,
  ödeme yolu ve müşterinin **yalnız adı** (e-posta ya da telefona benzeyen "ad"
  düşer). Soyad, telefon, e-posta, adres yazılmaz; sipariş notu yalnız masa ve
  gel-al siparişinde (kurye notu kapı kodu taşır).
- Üyenin ya da panelin yazdığı metin şablon alanı sayılmaz: notta "[OK]",
  üründe "Kahve [250G]" olduğu gibi gider (`fill.ts` tek geçişte doldurur,
  eksik alan şablonun kendisinden aranır).

### Hesap silme talebi (ekibe ve üyeye, 18 Eki 2026)

Sitede hesap artık üyenin tıklamasıyla silinmez (operatör: "hesabı silme
sadece bize ulaşarak olsun"): `/uye/hesap/sil` ekibe talep gönderir, ekip
panelden kapatır. Uygulamadaki "Hesabımı sil" (`DELETE /api/mobile/v1/me`)
eskisi gibi anında siler.

- **Ekibe** (`src/lib/email/account-deletion-notice.ts`, `operasyon-bildirim`):
  talep açıldığında ve geri alındığında. Alıcılar `customers` yetkisi olan
  roller (sahip, yönetici; aktif panel kullanıcısı ve env yöneticileri, sipariş
  bildirimindeki kuralla) ve operasyon adresi, o boşsa sitenin genel adresi.
  Sipariş bildiriminin aç/kapa düğmesi ve rol listesi bunu etkilemez: KVKK
  başvurusu her durumda birine ulaşmalı. Tek toplu istek, anahtar
  `account-deletion-<üye>-<talep anı>-staff-opened|staff-withdrawn`.
  İçerik (KVKK m.4/2-ç): üye no, yalnız ad, maskeli adres, talep tarihi, son
  gün (talepten 30 gün) ve gerekçe **yazılıp yazılmadığı** - gerekçenin kendisi
  panelde.
- **Üyeye:** `hesap-silme-talebi` (talep alındı, son gün, geri alma yolu) ve
  ekip kapatınca `hesap-silindi`. İkisi de işlemsel: çıkış bağlantısı yok
  (kural 19).
- Gönderim talebi ya da kapanışı hiçbir zaman bozmaz; başarısızlık log'a
  maskeli adresle düşer, kapanışta panel bildirimine bir cümle ekler.
- **Talep açıkken ticari posta yok** (migration `20261018090100`): 6563
  m.8/3 rette üç iş günü verir, sitenin İleti onayı metni üyeliğin sona
  ermesini ret sayar; talep geldiği anda ret gibi işlenir.
  `campaign_email_audience` o adresi (üye satırı da bülten abonesi satırı
  da) kitleye almaz, sayım, kuyruk ve parti alma onu okur;
  `birthday_greeting_audience` mail bayrağını kapatır (kupon yine verilir).
  Onay kaydı değişmez: üye talebi geri alınca kitleye kendiliğinden döner.

### Emniyet kilitleri

- `RESEND_API_KEY` yoksa parti `skipped` işaretlenir, kampanya `failed` +
  `lastError: RESEND_API_KEY tanımlı değil.`; anahtar tanımlanınca "Gönder"
  aynı satırları yeniden kuyruğa alır, kimse iki kez almaz.
- `VERCEL_ENV` tanımlı ve `production` değilse gerçek gönderim reddedilir
  (`skipped` + `failed`): her bağlantı önizleme adresine işaret ederdi.
- `CAMPAIGN_EMAIL_DRY_RUN=1` - derle, `skipped` işaretle, HTTP yok.

### Ek: onaylanan sözleşme (21 Eki 2026)

Karar ASK-DURABLE: ödeme onayı (`odeme-onaylandi`) ve ödenmiş karaoke
rezervasyonunun onayı (`karaoke-rezervasyon`), müşterinin onayladığı
belgelerin **o sürümünü** sipariş ya da rezervasyon bilgileriyle doldurulmuş
tek bir HTML dosyası olarak taşır (`src/lib/legal/durable-copy.ts`):
`siparis-<NO>-on-bilgilendirme-ve-sozlesme.html`,
`karaoke-sozlesme-<KOD>.html`. Dosya onay kaydındaki hash'lerden
(`legalConsent.textHashes`) `legal_doc_versions` tablosundan okunur, bugünkü
metinden değil; satır içi CSS, 16 px, yazdırmaya uygun, görsel, font, betik
ya da bağlantı yok; içindeki her değer kaçışlanır.

- **Yalnız tekil gönderim.** `deliver()` Resend'in `/emails` ucuna
  `attachments: [{ filename, content: <base64> }]` ekler. Toplu uç
  (`deliverBatch`, `/emails/batch`, kampanyalar) mesajı alan alan kurar ve hiç
  ek taşımaz.
- **E-postayı geciktirmez, düşürmez.** İki onay ödeme dönüşünün içinde
  beklenir; ek dahil tek bir süreye sığar (`src/lib/email/budget.ts`
  `MAIL_BUDGET`): ödeme onayı her zamanki **9,5 sn** (4 sn, 1,5 sn ara, 4 sn),
  karaoke onayı **5,5 sn** (eskisi gibi tek 4 sn deneme ve ekin payı). Ekin
  payı **1,5 sn**'dir ve yükleyicinin modül yüklemesi de bu süreye dahildir
  (`durableCopyWithin`). Hiçbir deneme 1 sn'den az kala başlamaz, her deneme
  kalan süreyle kesilir, sığmayan ikinci deneme yapılmaz. Ek bu sürede
  kurulamazsa, onay kaydında hash yoksa (21 Ekim 2026'dan önceki ve manuel
  siparişler) ya da sürüm bulunamazsa e-posta eksiz ve eski cümleyle
  ("bağlantılar belgelerin güncel metnini açar") gider; log yalnız sipariş ya
  da rezervasyon kimliğini yazar (adres yok, kural 9). İşlem Rehberi §8 bu
  durumda metni e-postayla isteme yolunu söyler.
- **Bir ileti, bir anahtar.** Resend eki içeren iletiyi 4xx ile (429 ve 409
  hariç) reddederse aynı ileti eksiz, `<anahtar>-ek-yok` idempotency
  anahtarıyla, kalan süreye sığarsa bir kez daha gönderilir. **409 hiçbir
  zaman ret sayılmaz** (inceleme M1, 21 Eki 2026): `concurrent_idempotent_requests`
  aynı anahtarlı ilk isteğin hâlâ işlendiğini, `invalid_idempotent_request`
  ise o anahtarla gövdesi farklı bir isteğin (bir tetikte eksiz, sonrakinde
  ekli) 24 saat içinde **alındığını** söyler. İlki başarısız sayılır ve
  `-ek-yok` gönderilmez; ikincisi gönderilmiş sayılır (ileti çıktı, ikinci
  kopya gitmez). 5xx ve zaman aşımında da `-ek-yok` gönderilmez (ilk istek
  ulaşmış olabilir), sipariş bildirimi kendi yeniden deneme yolunu izler.
- **Cümle yalnız ek varken.** "...tam metni bu e-postanın ekindedir" bloğu
  (`BELGE_EKI`, karaokede `KARAOKE_BELGE_EKI`) yalnız gönderen ekin iletiye
  girdiğini söylediğinde VE sürüm bağlantıları doluysa açılır (`render.ts`);
  aksi hâlde eski satır (`BELGE_GUNCEL` / `KARAOKE_BELGE_GUNCEL`).
- **Aynı dosya** üye sipariş sayfasından
  (`/uye/hesap/siparislerim/<NO>/sozlesme`, yalnız oturumdaki sahibi) ve
  karaoke rezervasyonunun kişiye özel imzalı bağlantısından
  (`/rezervasyon/sozlesme?t=`) indirilir; başka herkese aynı 404. Okuma
  başarısız olursa sahibine `503` + `Retry-After: 30` (çıplak 500 değil).
  Sipariş sayfası "Belgeleri indir"i yalnız dosya kurulabiliyorsa gösterir;
  kurulamıyorsa e-postayla isteme cümlesini. İki yolun kendi CSP'si
  (`sandbox`) ve `Referrer-Policy: no-referrer` başlıkları `next.config.ts`
  ve `vercel.json`'da aynı değerle tekrarlanır: sitenin genel kuralları
  aynı başlığı önce koyduğu için route'un değeri tek başına tele çıkmaz
  (`tests/security-headers.test.ts`).
- **Ek, siparişin kendi anlık görüntüsünü basar.** Alıcı adı ve teslimat
  adresi sipariş verilirken onay kaydına yazılır (`legalConsent.buyer`);
  panelden sonradan düzeltilen satır e-postayla giden dosyayı ve indirileni
  değiştirmez. Karaoke dosyası rezervasyonun kendi son ücretsiz iptal anını
  basar; rezervasyon o andan sonra yapıldıysa yanına "rezervasyon
  yapıldığında geçmişti; her iptal geç iptal sayılır" yazar (onay
  e-postasının söylediği gibi).

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
