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
Redirect URLs** listesinde şunun bulunması gerekir - ekli:

```
laffogato://yeni-parola
```

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

## 5. Sır saklama kuralı

API anahtarı bu depoda **hiçbir dosyada** durmaz — `.env.example`'da da,
belgede de, commit mesajında da. Anahtarın yeri Vercel'in ortam değişkenleri
ve Supabase'in SMTP kutusudur; ikisi de yazıldıktan sonra bir daha
okunamayacak şekilde saklar. Sızdığından şüphelenirsen Resend → API Keys'ten
o anahtarı sil, yenisini üret, iki yere de yeniden gir.
