/**
 * The plain-text half of every message.
 *
 * Not optional decoration: a `text/html` part with no `text/plain` sibling is
 * one of the cheapest spam signals there is, and it is the only version some
 * clients (and every screen reader in plain-text mode) will show. Each body
 * carries the same `[FIELD]`s as its HTML twin, so `renderEmail` fills both
 * from one set of values and `assertFilled` guards both.
 *
 * Same voice as the templates: "siz" (the two karaoke messages and the two
 * account-deletion messages: "sen"), sentence case, no shouting.
 */

// The address, hours and phone are Ayarlar's (`venue.ts`), as in the HTML
// footer.
const SIGNATURE = `-
L'Affogato · Coffee Italiano
[KOSK_ADRES]
[KOSK_SAAT] · [TELEFON]
laffogato.net · @laffogatto`;

/**
 * 6563: the withdrawal has to be as easy as the consent was to give. The two
 * legal links mirror the HTML footer, spelled out because a text client has
 * nothing to hide a URL behind.
 *
 * The first line is the sender's registered title and MERSİS number. The
 * general rule (Ticari İletişim Yönetmeliği m.6, "adı veya unvanı") is met by
 * the signature above; the rule for the CONTENT of a commercial electronic
 * message (m.8/1) asks a tacir for the ticaret unvanı and the MERSİS number
 * as well, so one quiet line carries both - under the address, as in the
 * HTML - and nothing more (operator, 8 Sep 2026: keep the foot short). Both
 * values come from `LEGAL_ENTITY` through `commonVars`, never typed here.
 */
const COMMERCIAL_FOOTER = `[UNVAN] · MERSİS: [MERSIS]

Bu iletiyi, kampanya ve etkinlik duyurularını e-posta ile almaya onay
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
// behind rather than three - `fillText` resolves the markers before it fills.

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
1. [ADIM_1_BASLIK] - [ADIM_1_METIN]
2. [ADIM_2_BASLIK] - [ADIM_2_METIN]
3. [ADIM_3_BASLIK] - [ADIM_3_METIN]
`;

export const EMAIL_TEXT = {
  "eposta-dogrulama": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

L'Affogato hesabınızı oluşturduğunuz için teşekkür ederiz. Sipariş
verebilmeniz için e-posta adresinizi doğrulamamız gerekiyor:

[DOGRULAMA_URL]

Bağlantı 24 saat geçerlidir. Bu hesabı siz oluşturmadıysanız bu e-postayı
yok sayabilirsiniz.

${SIGNATURE}`,

  "bulten-onay": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

bu adres L'Affogato bültenine kaydedilmek istendi. Kampanya, yeni ürün ve
etkinlik duyurularını göndermeye başlamamız için onayınız gerekiyor:

[ONAY_URL]

Bağlantı 7 gün geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok
sayabilirsiniz: onaylanmayan adrese hiçbir kampanya e-postası gönderilmez.

${SIGNATURE}`,

  "sifre-sifirlama": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

Hesabınız için şifre sıfırlama talebi aldık. Yeni şifrenizi aşağıdaki
bağlantıdan belirleyebilirsiniz:

[SIFIRLAMA_URL]

Bağlantı bir saat geçerlidir ve yalnızca bir kez kullanılabilir. Bu talebi
siz yapmadıysanız hiçbir şey yapmanıza gerek yok - mevcut şifreniz değişmez.

${SIGNATURE}`,

  // The two account-deletion messages speak "sen", like /uye/hesap/sil
  // that sent the request.
  "hesap-silme-talebi": `Merhaba,

[TALEP_TARIHI] tarihinde hesabının silinmesini istedin. Talebin bize
ulaştı; en geç [SON_GUN] tarihine kadar sonuçlandırırız. Hesabını
çoğunlukla 3 iş günü içinde sileriz ve bittiğinde sana yeniden yazarız.
Devam eden bir siparişin varsa hesabını sipariş tamamlanınca sileriz.

Talebin: [TALEP_URL]

Siparişlerin ve fatura bilgilerin, vergi ve ticaret mevzuatının saklama
süresi boyunca saklanır. Fikrini değiştirirsen talebini aynı sayfadan geri
alabilirsin. Bu talebi sen göndermediysen sayfadan geri al ve şifreni
değiştir.

${SIGNATURE}`,

  "hesap-silindi": `Merhaba,

[SONUC_BASLIK]. L'Affogato hesabını kapattık: adın, telefonun, adreslerin,
favorilerin ve bildirim tercihlerin silindi; damgaların ve kullanılmamış
kuponların sona erdi. Siparişlerin ve fatura bilgilerin, vergi ve ticaret
mevzuatının saklama süresi boyunca bu e-posta adresinden ayrılarak saklanır.
<!--IF:KIMLIK_KALDI-->
Uygulamanın giriş kimliğinde duran e-posta adresin ve adın bu adımda
silinemedi; ekibimiz bunu ayrıca tamamlayacak.
<!--/IF:KIMLIK_KALDI-->
Neler silindi, neler saklanıyor: [PROSEDUR_URL]

Yeniden üye olmak istersen aynı adresle kaydolabilirsin; eski siparişlerin
ve damgaların yeni hesaba taşınmaz.

${SIGNATURE}`,

  "odeme-onaylandi": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

Ödemeniz alındı ve siparişiniz onaylandı - hazırlanmaya başlandı.

Sipariş No: #[SIPARIS_NO]

[KALEMLER]

Ara toplam: [ARA_TOPLAM]
<!--IF:KARGO_SATIRI-->Kargo: [KARGO]
<!--/IF:KARGO_SATIRI--><!--IF:INDIRIM_SATIRI-->İndirim: [INDIRIM]
<!--/IF:INDIRIM_SATIRI-->Ödenen toplam: [TOPLAM]
<!--IF:DAMGA-->
Bu siparişle [DAMGA_SAYISI] damga kazandınız; [DAMGA_HEDEFI] damgada bir
içecek bizden.
<!--/IF:DAMGA-->
Sipariş durumu: [SIPARIS_URL]
<!--IF:BELGE_EKI-->
Sipariş sırasında onayladığınız Ön Bilgilendirme Formu ve Mesafeli Satış
Sözleşmesi'nin, sipariş bilgilerinizle doldurulmuş tam metni bu e-postanın
ekindedir. Aynı sürüme şu bağlantıdan da ulaşabilirsiniz:
[BELGE_SURUMLERI]
Cayma hakkınız ve iade usulü (İptal, İade ve Cayma Hakkı):
https://laffogato.net/hukuk/iade-ve-cayma
<!--/IF:BELGE_EKI--><!--IF:BELGE_GUNCEL-->
Sipariş sırasında onayladığınız belgeler (bağlantılar belgelerin güncel
metnini açar):
[BELGELER]
<!--/IF:BELGE_GUNCEL-->
${SIGNATURE}`,

  // ── Order notices ───────────────────────────────────────────────────────
  //
  // The three mails the legal texts promise after the order: the tracking
  // number at hand-over, the seller's cancellation, the refund. Transactional
  // and nothing else - no app strip, no offer - so the foot is the short one.

  "e-arsiv-fatura": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

[FATURA_KONU] için e-Arşiv faturanız düzenlendi. Faturanın PDF hâli bu
e-postanın ekindedir.

Fatura numarası: [FATURA_NO]
Tarih: [FATURA_TARIHI]
Tutar (KDV dahil): [FATURA_TUTAR]

[BUTON_URL]

Faturanız 213 sayılı Vergi Usul Kanunu uyarınca elektronik ortamda
(e-Arşiv) düzenlendi. Üye siparişlerinizin faturasını hesabınızdaki sipariş
sayfasından da indirebilirsiniz. Faturanızla ilgili bir talebiniz varsa
bizi arayın: [TELEFON]

${SIGNATURE}`,

  "siparis-kargoda": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

#[SIPARIS_NO] numaralı siparişiniz kargoya verildi.

Kargo takip numarası: [TAKIP_NO]
<!--IF:FIRMA-->Taşıyıcı: [KARGO_FIRMASI]
<!--/IF:FIRMA--><!--IF:TAKIP_LINKI-->Kargo takip sayfası: [TAKIP_URL]
<!--/IF:TAKIP_LINKI-->
Takip numarası taşıyıcının sistemine işlendikten sonra sorgulanabilir; bu
birkaç saat sürebilir.

Siparişiniz: [SIPARIS_URL]

Tahminî teslim süresi teslimat bölgenize göre değişir; güncel tablo:
https://laffogato.net/hukuk/teslimat-ve-kargo

Paketi teslim alırken görevlinin yanında kontrol edin: ezilme, ıslanma ya
da açılmış bant görürseniz teslim almadan tutanak tutturun ve bizi arayın:
[TELEFON]

${SIGNATURE}`,

  // A pickup order ready at the counter, when no phone notification reached
  // any of the member's devices (src/lib/push/order-push.ts).
  "siparis-hazir": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

#[SIPARIS_NO] numaralı gel-al siparişin hazır. Köşke geldiğinde tezgâhta
sipariş numaranı söylemen yeterli.

Siparişin: [SIPARIS_URL]

Bu e-posta, uygulamada telefon bildirimine izin vermediğin ya da bildirim
telefonuna ulaşamadığı için gönderildi. Bu e-postayı ve telefon
bildirimlerini, uygulamadaki Bildirimler ekranında ya da hesabındaki
bildirim tercihlerinde "Sipariş durumu" anahtarıyla kapatabilirsin. Sorun
olursa bizi ara: [TELEFON]

${SIGNATURE}`,

  "siparis-iptal": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

#[SIPARIS_NO] numaralı siparişiniz iptal edildi.

[KALEMLER]

Sipariş toplamı: [TOPLAM]
<!--IF:ODEME_ALINDI-->
Bu sipariş için ödemeniz alınmıştı. Ödediğiniz tutar, ödemede kullandığınız
ödeme aracına iade edilir; iade yapıldığında size ayrıca e-posta
göndeririz. Tutarın hesabınıza yansıma süresi bankanıza bağlıdır.
<!--/IF:ODEME_ALINDI--><!--IF:ODEME_YOK-->
Kayıtlarımızda bu sipariş için alınmış bir ödeme görünmüyor. Bankanız
kartınıza bir ön provizyon (bloke) uyguladıysa, çözülme süresi bankanıza
bağlıdır.
<!--/IF:ODEME_YOK-->
Siparişiniz: [SIPARIS_URL]

Bir yanlışlık olduğunu düşünüyorsanız bizi arayın: [TELEFON]

${SIGNATURE}`,

  "siparis-iade": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

#[SIPARIS_NO] numaralı siparişiniz için [IADE_TUTARI] tutarında iade yaptık.

Bu iade: [IADE_TUTARI]
Bugüne kadar iade edilen: [TOPLAM_IADE]
Sipariş toplamı: [TOPLAM]
<!--IF:KARTA_IADE-->
İade, ödemede kullandığınız karta yapıldı. Tutarın kart ekstrenize ya da
hesabınıza yansıma süresi bankanıza bağlıdır; taksitli ödemelerde bankanız
iadeyi taksitler hâlinde yansıtabilir.
<!--/IF:KARTA_IADE-->
Siparişiniz: [SIPARIS_URL]

Tutar hesabınıza yansımazsa sipariş numaranızla bizi arayın:
[TELEFON]

${SIGNATURE}`,

  "hos-geldin": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

L'Affogato'ya hoş geldiniz. Yenilebilir waffle kupada Sirena espresso ve
fior di latte gelato - imza ritüelimiz. Tuzla'da 200 yıllık, Rum'lardan
kalma restore bir köşkte sizi bekliyoruz.

Menü - 12 kategori: [MENU_URL]
Mağaza (500,00 ₺ üzeri kargo ücretsiz): laffogato.net/magaza
Ziyaret ([KOSK_SAAT]): laffogato.net/ziyaret

Hesabınız: [HESAP_URL]

${SIGNATURE}`,

  "bulten-kampanya": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

[KAMPANYA_BASLIK]

[KAMPANYA_METIN]

Size özel kod: [KUPON_KODU]
Son kullanma: [SON_KULLANIM]

Ayın seçkisi:
- [URUN_1_AD] - [URUN_1_NOT] · [URUN_1_FIYAT]
- [URUN_2_AD] - [URUN_2_NOT] · [URUN_2_FIYAT]
- [URUN_3_AD] - [URUN_3_NOT] · [URUN_3_FIYAT]

[KAMPANYA_BUTON]: [KAMPANYA_URL]

${SIGNATURE}

${COMMERCIAL_FOOTER}`,

  // The redesigned HTML greets without the name; the two halves of one
  // message say the same thing. A booking paid online carries its receipt
  // and its cancellation terms (KARAOKE_ODENDI: the booking's own two
  // sentences, KARAOKE_IADE_KURALI / KARAOKE_GEC_KURALI); one paid at the
  // venue only how to cancel (KARAOKE_ODEME_MEKANDA), or, under a rule that
  // lets no member cancel, to call (KARAOKE_MEKAN_ARA); a free hour the köşk
  // gave to make good a late cancel, that nothing is paid for
  // (KARAOKE_TELAFI_SAATI, or _ARA). send.ts sets exactly one of them. A
  // paid booking then says where its terms are: the confirmed text
  // attached, with its version page (KARAOKE_BELGE_EKI), or, when no copy
  // could be attached, the terms' page (KARAOKE_BELGE_GUNCEL).
  // Both karaoke messages speak "sen", like the /karaoke page that took the
  // booking and the cancellation rule they quote.
  "karaoke-rezervasyon": `Merhaba,

Karaoke saatin ayrıldı. Girişte kodunu söylemen yeterli.

Rezervasyon kodu: [KARAOKE_KOD]
Tarih: [KARAOKE_TARIH]
Saat: [KARAOKE_SAAT]
Kişi: [KARAOKE_KISI]

Yol tarifi:
https://www.google.com/maps/search/?api=1&query=40.8165716,29.3032493

<!--IF:KARAOKE_ODENDI-->Ödenen: [KARAOKE_TUTAR] (KDV dahil).

[KARAOKE_IADE_KURALI]
[KARAOKE_GEC_KURALI]
Son ücretsiz iptal: [KARAOKE_SON_IPTAL].

Belirli bir tarihte sunulan eğlence hizmeti olduğu için cayma hakkı yoktur (MSY m.15/1-g).

Rezervasyon sayfandan görebilir ve iptal edebilirsin:
[KARAOKE_LINK]<!--/IF:KARAOKE_ODENDI--><!--IF:KARAOKE_BELGE_EKI-->

Onayladığın Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet
Sözleşmesi'nin, rezervasyon bilgilerinle doldurulmuş tam metni bu e-postanın
ekinde. Aynı sürümü buradan da okuyabilirsin:
[KARAOKE_SURUM_URL]<!--/IF:KARAOKE_BELGE_EKI--><!--IF:KARAOKE_BELGE_GUNCEL-->

Tüm koşullar:
https://laffogato.net/hukuk/karaoke-odasi-rezervasyon<!--/IF:KARAOKE_BELGE_GUNCEL--><!--IF:KARAOKE_ODEME_MEKANDA-->Ödemeyi köşkte yaparsın. Planın değişirse [KARAOKE_MEKAN_SURE]
rezervasyon sayfandan iptal edebilirsin.

Rezervasyon sayfan:
[KARAOKE_LINK]<!--/IF:KARAOKE_ODEME_MEKANDA--><!--IF:KARAOKE_MEKAN_ARA-->Ödemeyi köşkte yaparsın. Planın değişirse bizi ara: [TELEFON]

Rezervasyon sayfan:
[KARAOKE_LINK]<!--/IF:KARAOKE_MEKAN_ARA--><!--IF:KARAOKE_TELAFI_SAATI-->Bu saat, [KARAOKE_TELAFI_KOD] rezervasyonun için verdiğimiz telafidir. Bu saat için senden ödeme alınmaz.
Planın değişirse [KARAOKE_MEKAN_SURE] rezervasyon sayfandan iptal
edebilirsin; telafin o zaman geri gelir.

Rezervasyon sayfan:
[KARAOKE_LINK]<!--/IF:KARAOKE_TELAFI_SAATI--><!--IF:KARAOKE_TELAFI_SAATI_ARA-->Bu saat, [KARAOKE_TELAFI_KOD] rezervasyonun için verdiğimiz telafidir. Bu saat için senden ödeme alınmaz.
Planın değişirse bizi ara: [TELEFON]

Rezervasyon sayfan:
[KARAOKE_LINK]<!--/IF:KARAOKE_TELAFI_SAATI_ARA-->

${SIGNATURE}`,

  // The cancellation twin. Same shape, same greeting without a name: the
  // member is told who cancelled and why (their own cancel: KARAOKE_IPTAL_
  // GENEL; the köşk's, with its reason and an apology: KARAOKE_ISLETME;
  // their request taken by phone or e-mail: KARAOKE_ISTEK; the hour given
  // to another guest: KARAOKE_YENIDEN), what happened to their money (it
  // went back: KARAOKE_IADE, or "iade ettik" when we cancelled:
  // KARAOKE_TAM_IADE; a late cancel's share went back, or is owed and will:
  // KARAOKE_KISMI_IADE_EDILDI / KARAOKE_KISMI_IADE; the hour cancelled late
  // was sold again and what was kept for it went back: KARAOKE_SATIS_IADE,
  // or with the share in one refund: KARAOKE_KISMI_SATIS_IADE_EDILDI, or
  // after a late cancel that kept everything: KARAOKE_SATIS_IADE_EDILDI;
  // such a cancel itself, nothing refunded and the hours on sale:
  // KARAOKE_SATISA_ACILDI; none was taken: KARAOKE_ODEMESIZ), the make-good of a late köşk cancel
  // (KARAOKE_TELAFI, karaoke terms §8) and how to get another evening -
  // nothing to confirm, nothing to click. send.ts sets one opening and at
  // most one money line.
  "karaoke-iptal": `Merhaba,

<!--IF:KARAOKE_IPTAL_GENEL-->Karaoke rezervasyonun iptal edildi. Oda serbest bırakıldı.
<!--/IF:KARAOKE_IPTAL_GENEL--><!--IF:KARAOKE_ISLETME-->Rezervasyonunu biz iptal etmek zorunda kaldık: [KARAOKE_NEDEN]. Özür dileriz.
<!--/IF:KARAOKE_ISLETME--><!--IF:KARAOKE_ISTEK-->İsteğin üzerine karaoke rezervasyonunu iptal ettik.
<!--/IF:KARAOKE_ISTEK--><!--IF:KARAOKE_YENIDEN-->Karaoke rezervasyonun iptal edildi.
<!--/IF:KARAOKE_YENIDEN-->
İptal edilen rezervasyon: [KARAOKE_KOD]
Tarih: [KARAOKE_TARIH]
Saat: [KARAOKE_SAAT]
Kişi: [KARAOKE_KISI]

<!--IF:KARAOKE_IADE-->Ödediğin [KARAOKE_TUTAR] kartına iade edildi; yansıması bankana
göre birkaç iş günü sürebilir.

Son durum, rezervasyon sayfanda:
[KARAOKE_LINK]

<!--/IF:KARAOKE_IADE--><!--IF:KARAOKE_TAM_IADE-->Ödediğin [KARAOKE_TUTAR] tutarın tamamını kartına iade ettik; yansıması bankana göre birkaç iş günü sürebilir.

Son durum, rezervasyon sayfanda:
[KARAOKE_LINK]

<!--/IF:KARAOKE_TAM_IADE--><!--IF:KARAOKE_YENIDEN-->Rezervasyon saatini başka bir misafire verdiğimiz için ödediğin [KARAOKE_TUTAR] tutarın tamamını kartına iade ettik; yansıması bankana göre birkaç iş günü sürebilir.

Son durum, rezervasyon sayfanda:
[KARAOKE_LINK]

<!--/IF:KARAOKE_YENIDEN--><!--IF:KARAOKE_KISMI_IADE_EDILDI-->Rezervasyonundaki geç iptal kuralına göre [KARAOKE_TUTAR] kartına iade edildi;
yansıması bankana göre birkaç iş günü sürebilir.

Son durum, rezervasyon sayfanda:
[KARAOKE_LINK]

<!--/IF:KARAOKE_KISMI_IADE_EDILDI--><!--IF:KARAOKE_KISMI_SATIS_IADE_EDILDI-->Rezervasyonundaki geç iptal kuralına göre ve geç iptal ettiğin saat başka bir
misafire satıldığı için [KARAOKE_TUTAR] kartına iade edildi; yansıması
bankana göre birkaç iş günü sürebilir.

Son durum, rezervasyon sayfanda:
[KARAOKE_LINK]

<!--/IF:KARAOKE_KISMI_SATIS_IADE_EDILDI--><!--IF:KARAOKE_SATIS_IADE-->Geç iptal ettiğin saat başka bir misafire satıldığı için sende kalan tutardan
[KARAOKE_TUTAR] daha kartına iade edildi; yansıması bankana göre birkaç iş
günü sürebilir.

Son durum, rezervasyon sayfanda:
[KARAOKE_LINK]

<!--/IF:KARAOKE_SATIS_IADE--><!--IF:KARAOKE_SATIS_IADE_EDILDI-->Geç iptal ettiğin saat başka bir misafire satıldığı için o saat için ödediğin
[KARAOKE_TUTAR] kartına iade edildi; yansıması bankana göre birkaç iş günü
sürebilir.

Son durum, rezervasyon sayfanda:
[KARAOKE_LINK]

<!--/IF:KARAOKE_SATIS_IADE_EDILDI--><!--IF:KARAOKE_KISMI_IADE-->Rezervasyonundaki geç iptal kuralına göre [KARAOKE_TUTAR] kartına iade edilir.
İade yapılınca sana ayrıca haber veririz; yansıması bankana göre birkaç iş
günü sürebilir.

Son durum, rezervasyon sayfanda:
[KARAOKE_LINK]

<!--/IF:KARAOKE_KISMI_IADE--><!--IF:KARAOKE_SATISA_ACILDI-->Ücretsiz iptal süren geçtiği için rezervasyonundaki kurala göre ücret iadesi
yapılmadı. Saatlerini yeniden satışa açtık: saatlerinden biri başka bir
misafire satılırsa o saat için ödediğin tutarı en geç 14 gün içinde kartına
iade eder, sana ayrıca haber veririz.

Son durum, rezervasyon sayfanda:
[KARAOKE_LINK]

<!--/IF:KARAOKE_SATISA_ACILDI--><!--IF:KARAOKE_ODEMESIZ-->Bu rezervasyon için senden ödeme alınmadı.

<!--/IF:KARAOKE_ODEMESIZ--><!--IF:KARAOKE_TELAFI-->Ayrıca sana [KARAOKE_TELAFI_TUTAR] tutarında bir telafi veriyoruz: istersen aynı uzunlukta ücretsiz bir karaoke saati ([KARAOKE_TELAFI_SON] tarihine kadar bizi arayarak ya da bu e-postayı yanıtlayarak boş bir saat için ayırtabilirsin), istersen bu tutarın kendi adına kayıtlı banka hesabına ödenmesi (bu e-postayı yanıtlayıp IBAN'ını yaz, 14 gün içinde öderiz).

<!--/IF:KARAOKE_TELAFI-->Yeni bir saat ayırtmak için: https://laffogato.net/karaoke
Bir yanlışlık varsa bizi ara: [TELEFON]

${SIGNATURE}`,

  // A guest's late request, taken by phone or e-mail, that the booking's
  // rule refunds nothing for (ASK-Y3-4 (c)): the booking stands, and this
  // says what they can still do (karaoke terms §7). The late sentence is the
  // booking's own (KARAOKE_GEC_KURALI).
  "karaoke-iptal-istegi": `Merhaba,

İptal isteğini aldık. [KARAOKE_GEC_KURALI] Bu yüzden rezervasyonun senin adına duruyor; gelemeyeceksen rezervasyon kodunu bir başkasına verebilirsin, odayı o kullanır. Kodunu kimseye vermeyeceksen bu e-postayı yanıtlayarak bize yaz; odayı o saat için başka bir misafire verirsek ödediğin tutarın tamamını kartına iade ederiz.

Rezervasyon kodu: [KARAOKE_KOD]
Tarih: [KARAOKE_TARIH]
Saat: [KARAOKE_SAAT]
Kişi: [KARAOKE_KISI]

Rezervasyon sayfan:
[KARAOKE_LINK]

Bir yanlışlık varsa bizi ara: [TELEFON]

${SIGNATURE}`,

  // The staff moved the booking to another day or hour (operator, 27 Eki
  // 2026): the new evening, the old one, and exactly one payment line, as
  // send.ts `karaokeRescheduleFlags` sets it. A paid booking quotes its own
  // rule and its last free moment as the move recounted it
  // (`karaokeMovedDeadline`): from the booking, not from the new start,
  // since 28 Eki 2026, so the mail names the moment instead of saying the
  // clock follows the new hour.
  "karaoke-saat-degisikligi": `Merhaba,

Karaoke rezervasyonunu [KARAOKE_ESKI_TARIH] · [KARAOKE_ESKI_SAAT] yerine
[KARAOKE_TARIH] · [KARAOKE_SAAT] olarak güncelledik. Rezervasyon kodun ve
kişi sayın aynı; girişte kodunu söylemen yeterli.

Rezervasyon kodu: [KARAOKE_KOD]
Yeni tarih: [KARAOKE_TARIH]
Yeni saat: [KARAOKE_SAAT]
Kişi: [KARAOKE_KISI]
Önceki saat: [KARAOKE_ESKI_TARIH] · [KARAOKE_ESKI_SAAT]

<!--IF:KARAOKE_ODENDI-->Ödediğin [KARAOKE_TUTAR] yeni saat için geçerli; senden ayrıca ödeme istenmez.
İptal kuralın değişmedi:
[KARAOKE_IADE_KURALI]
[KARAOKE_GEC_KURALI]
Son ücretsiz iptal: [KARAOKE_SON_IPTAL].

<!--/IF:KARAOKE_ODENDI--><!--IF:KARAOKE_ODEME_MEKANDA-->Ödemeyi eskisi gibi köşkte yaparsın; tutar değişmedi.

<!--/IF:KARAOKE_ODEME_MEKANDA--><!--IF:KARAOKE_TELAFI_SAATI-->Bu saat, [KARAOKE_TELAFI_KOD] rezervasyonun için verdiğimiz telafidir; senden ödeme alınmaz.

<!--/IF:KARAOKE_TELAFI_SAATI-->Rezervasyon sayfan:
[KARAOKE_LINK]

Yeni saat sana uymuyorsa bizi ara: [TELEFON]

${SIGNATURE}`,

  "sadakat-ikram": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

Kartınız doldu - [DAMGA_HEDEFI] damga tamamlandı ve bir içecek bizden.

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

Uygulamayı kurmak istemezseniz sorun değil - hesabınız laffogato.net
üzerinde aynı şekilde çalışıyor.

${SIGNATURE}

${COMMERCIAL_FOOTER}`,

  "dogum-gunu": `Merhaba<!--IF:AD--> [AD]<!--/IF:AD-->,

Doğum gününüz kutlu olsun - bugün bir kahve bizden.

Kupon kodu: [KUPON_KODU]
Son kullanma: [SON_KULLANIM]
(Bugünden başlayarak 7 gün geçerli)

Menüye göz atın: [MENU_URL]

${SIGNATURE}

${COMMERCIAL_FOOTER}`,

  // ── kampanya-* ──────────────────────────────────────────────────────────

  /** General announcement - also what an app post turns into. */
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

  /**
   * Every message to the team (karaoke request, settings test, whatever
   * comes next): the rows arrive pre-formatted as one block, since the text
   * half has no loop.
   */
  "operasyon-bildirim": `[BILDIRIM_BASLIK]
[BILDIRIM_ALT]

[SATIRLAR_METIN]
<!--IF:NOT-->
[NOT_ETIKET]: [NOT]
<!--/IF:NOT-->
[BUTON_METIN]: [BUTON_URL]

[BILDIRIM_DIPNOT]

- L'Affogato paneli`,
} as const;

export type EmailTextName = keyof typeof EMAIL_TEXT;
