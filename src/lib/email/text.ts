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

/**
 * 6563: the withdrawal has to be as easy as the consent was to give. The two
 * legal links mirror the HTML footer, spelled out because a text client has
 * nothing to hide a URL behind.
 *
 * The company's registered title used to close this block. The regulation
 * (Ticari İletişim Yönetmeliği m.6) asks for the service provider's "adı VEYA
 * unvanı", and the signature above already carries the name, the street
 * address and the phone — so the title was dropped to keep the foot short
 * (operator, 8 Sep 2026). It is still one click away, inside both linked
 * documents.
 */
const COMMERCIAL_FOOTER = `Bu iletiyi, kampanya ve etkinlik duyurularını e-posta ile almaya onay
verdiğiniz için alıyorsunuz. Onayınızı istediğiniz zaman geri çekebilirsiniz:
[ABONELIK_CIKIS_URL]

Ticari ileti aydınlatması: https://laffogato.net/hukuk/ticari-elektronik-ileti
KVKK aydınlatma metni: https://laffogato.net/hukuk/kvkk-aydinlatma-metni`;

// ── Kampanya ailesi ────────────────────────────────────────────────────────
//
// The seven `kampanya-*` layouts open and close the same way; what differs is
// the block between the highlight and the code box. The shared halves live
// here once. Every optional block carries its own line breaks INSIDE the
// `<!--IF:-->` markers, so a dropped block leaves exactly one blank line
// behind rather than three — `fillText` resolves the markers before it fills.

/** Eyebrow, title, subtitle, and the hero image when there is one. */
const CAMPAIGN_HEAD = `[KAMPANYA_EYEBROW]

[KAMPANYA_BASLIK]
[KAMPANYA_ALT]
<!--IF:GORSEL-->
Görsel: [KAMPANYA_GORSEL_URL]
<!--/IF:GORSEL-->`;

/** Greeting + body, then the marker-highlighted line when there is one. */
const CAMPAIGN_BODY = `
Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->, [KAMPANYA_METIN]
<!--IF:VURGU-->
[KAMPANYA_VURGU]
<!--/IF:VURGU-->`;

/** The gold-hairline code box. */
const CAMPAIGN_CODE = `<!--IF:KOD-->
Kod: [KUPON_KODU]
Son kullanma: [SON_KULLANIM]
<!--/IF:KOD-->`;

/** CTA, date line, footnote, the members-only note, signature, way out. */
const CAMPAIGN_TAIL = `
[KAMPANYA_BUTON]: [KAMPANYA_URL]
<!--IF:TARIH-->
[KAMPANYA_TARIH]
<!--/IF:TARIH--><!--IF:DIPNOT-->
[KAMPANYA_DIPNOT]
<!--/IF:DIPNOT-->
Yalnız L'Affogato üyelerine özel.

${SIGNATURE}

${COMMERCIAL_FOOTER}`;

/** The three-step "nasıl yararlanırım" list (ikram, yeni ürün). */
const CAMPAIGN_STEPS = `
Nasıl yararlanırım
1. [ADIM_1_BASLIK] — [ADIM_1_METIN]
2. [ADIM_2_BASLIK] — [ADIM_2_METIN]
3. [ADIM_3_BASLIK] — [ADIM_3_METIN]
`;

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

Sipariş sırasında onayladığınız belgeler — kalıcı veri saklayıcısı olarak
saklamanız için:
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
Yalnız L'Affogato üyelerine özel · Hesap başına bir kez

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

  // ── kampanya-* ──────────────────────────────────────────────────────────

  /** General announcement — also what an app post turns into. */
  "kampanya-duyuru": `${CAMPAIGN_HEAD}${CAMPAIGN_BODY}${CAMPAIGN_CODE}${CAMPAIGN_TAIL}`,

  /** Bonus stamps; the stamp-card row is imagery only, nothing to say here. */
  "kampanya-bonus-damga": `${CAMPAIGN_HEAD}${CAMPAIGN_BODY}${CAMPAIGN_CODE}${CAMPAIGN_TAIL}`,

  /** A time band: hour first, as the tiles read. */
  "kampanya-happy-hour": `${CAMPAIGN_HEAD}${CAMPAIGN_BODY}
Saat: [ETKINLIK_SAAT]
Tarih: [ETKINLIK_TARIH]
Yer: [ETKINLIK_YER]
${CAMPAIGN_CODE}${CAMPAIGN_TAIL}`,

  /** Three steps to the treat, then the code. */
  "kampanya-ikram": `${CAMPAIGN_HEAD}${CAMPAIGN_BODY}${CAMPAIGN_STEPS}${CAMPAIGN_CODE}${CAMPAIGN_TAIL}`,

  /** An event: place first; no code box on this layout. */
  "kampanya-etkinlik": `${CAMPAIGN_HEAD}${CAMPAIGN_BODY}
Yer: [ETKINLIK_YER]
Tarih: [ETKINLIK_TARIH]
Saat: [ETKINLIK_SAAT]
${CAMPAIGN_TAIL}`,

  /** Early access to a new product: the steps, no code box. */
  "kampanya-yeni-urun": `${CAMPAIGN_HEAD}${CAMPAIGN_BODY}${CAMPAIGN_STEPS}${CAMPAIGN_TAIL}`,

  /** A discount: the rate and the product before the greeting, as designed. */
  "kampanya-indirim": `${CAMPAIGN_HEAD}
İndirim: [INDIRIM_ORAN] · [INDIRIM_URUN]
${CAMPAIGN_BODY}${CAMPAIGN_CODE}${CAMPAIGN_TAIL}`,
} as const;

export type EmailTextName = keyof typeof EMAIL_TEXT;
