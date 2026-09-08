/**
 * The plain-text half of every message.
 *
 * Not optional decoration: a `text/html` part with no `text/plain` sibling is
 * one of the cheapest spam signals there is, and it is the only version some
 * clients (and every screen reader in plain-text mode) will show. Each body
 * carries the same `[FIELD]`s as its HTML twin, so `renderEmail` fills both
 * from one set of values and `assertFilled` guards both.
 *
 * Same voice as the templates: "siz", sentence case, no shouting.
 */

const SIGNATURE = `—
L'Affogato · Coffee Italiano
Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1, Tuzla / İstanbul
Her gün 09:00 – 01:00 · +90 536 429 09 19
laffogato.net · @laffogatto`;

/** 6563: the withdrawal has to be as easy as the consent was to give. */
const COMMERCIAL_FOOTER = `Bu iletiyi, kampanya ve etkinlik duyurularını e-posta ile almaya onay
verdiğiniz için alıyorsunuz. Onayınızı istediğiniz zaman geri çekebilirsiniz:
[ABONELIK_CIKIS_URL]

NEXTGEN YAZILIM EĞİTİM İNŞAAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ
Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1, Tuzla/İstanbul, Türkiye`;

export const EMAIL_TEXT = {
  "eposta-dogrulama": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

L'Affogato hesabınızı oluşturduğunuz için teşekkür ederiz. Sipariş
verebilmeniz için e-posta adresinizi doğrulamamız gerekiyor:

[DOGRULAMA_URL]

Bağlantı 24 saat geçerlidir. Bu hesabı siz oluşturmadıysanız bu e-postayı
yok sayabilirsiniz.

${SIGNATURE}`,

  "sifre-sifirlama": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

Hesabınız için şifre sıfırlama talebi aldık. Yeni şifrenizi aşağıdaki
bağlantıdan belirleyebilirsiniz:

[SIFIRLAMA_URL]

Bağlantı bir saat geçerlidir ve yalnızca bir kez kullanılabilir. Bu talebi
siz yapmadıysanız hiçbir şey yapmanıza gerek yok — mevcut şifreniz değişmez.

${SIGNATURE}`,

  "siparis-alindi": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

Siparişinizi aldık. Ödemeniz onaylandığı anda hazırlamaya başlıyoruz.

Sipariş No: #[SIPARIS_NO]

[KALEMLER]

Ara toplam: [ARA_TOPLAM]
Kargo: [KARGO]
Toplam: [TOPLAM]
(KDV dâhil · 500,00 ₺ üzeri siparişlerde kargo ücretsiz)

Siparişiniz: [SIPARIS_URL]

Sipariş sırasında onayladığınız belgeler — kalıcı veri saklayıcısı olarak
saklamanız için:
[BELGELER]

${SIGNATURE}`,

  "odeme-onaylandi": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

Ödemeniz alındı ve siparişiniz onaylandı — hazırlanmaya başlandı.

Sipariş No: #[SIPARIS_NO]

[KALEMLER]

Ödenen toplam: [TOPLAM]

[DAMGA_HEDEFI] damgada bir içecek bizden — bu siparişle bir damga daha
kazandınız.

Sipariş durumu: [SIPARIS_URL]

Sipariş sırasında onayladığınız belgeler:
[BELGELER]

${SIGNATURE}`,

  "hos-geldin": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

L'Affogato'ya hoş geldiniz. Yenilebilir waffle kupada Sirena espresso ve
fior di latte gelato — imza ritüelimiz. Tuzla'da 200 yıllık, Rum'lardan
kalma restore bir köşkte sizi bekliyoruz.

Menü — 12 kategori: [MENU_URL]
Mağaza (500,00 ₺ üzeri kargo ücretsiz): laffogato.net/magaza
Ziyaret — her gün 09:00 – 01:00: laffogato.net/ziyaret

Hesabınız: [HESAP_URL]

${SIGNATURE}`,

  "bulten-kampanya": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

[KAMPANYA_BASLIK]

[KAMPANYA_METIN]

Size özel kod: [KUPON_KODU]
Son kullanma: [SON_KULLANIM]

Ayın seçkisi:
- [URUN_1_AD] — [URUN_1_NOT] · [URUN_1_FIYAT]
- [URUN_2_AD] — [URUN_2_NOT] · [URUN_2_FIYAT]
- [URUN_3_AD] — [URUN_3_NOT] · [URUN_3_FIYAT]

[KAMPANYA_BUTON]: [KAMPANYA_URL]

${SIGNATURE}

${COMMERCIAL_FOOTER}`,

  "karaoke-rezervasyon": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

Karaoke saatiniz ayrıldı. Girişte kodunuzu söylemeniz yeterli.

Rezervasyon kodu: [KARAOKE_KOD]
Tarih: [KARAOKE_TARIH]
Saat: [KARAOKE_SAAT]
Kişi: [KARAOKE_KISI]

Yol tarifi:
https://www.google.com/maps/search/?api=1&query=40.8165716,29.3032493

Planınız değişirse rezervasyonunuzu uygulamadan iptal edebilir ya da bizi
arayabilirsiniz: +90 536 429 09 19

${SIGNATURE}`,

  "sadakat-ikram": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

Kartınız doldu — [DAMGA_HEDEFI] damga tamamlandı ve bir içecek bizden.

Ödül: [ODUL_BASLIGI]
Kupon kodu: [KUPON_KODU]
Son kullanma: [SON_KULLANIM]

Kuponunuz hesabınızda hazır: [HESAP_URL]

${SIGNATURE}`,

  "mobil-uygulama": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

L'Affogato uygulaması yayında. Damga kartınız, ikramlarınız ve karaoke
rezervasyonunuz artık telefonunuzda.

App Store: [APP_STORE_URL]
Google Play: [PLAY_STORE_URL]

Uygulamayı kurmak istemezseniz sorun değil — hesabınız laffogato.net
üzerinde aynı şekilde çalışıyor.

${SIGNATURE}

${COMMERCIAL_FOOTER}`,

  "dogum-gunu": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

Doğum gününüz kutlu olsun — bugün bir kahve bizden.

Kupon kodu: [KUPON_KODU]
Son kullanma: [SON_KULLANIM]
(Doğum gününüzde aktifleşir · 7 gün geçerli)

Menüye göz atın: [MENU_URL]

${SIGNATURE}

${COMMERCIAL_FOOTER}`,
} as const;

export type EmailTextName = keyof typeof EMAIL_TEXT;
