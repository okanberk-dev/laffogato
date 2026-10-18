import {
  DEFAULT_KARAOKE_CANCEL_POLICY,
  percentPossessive,
  type KaraokeCancelPolicy,
} from "@/lib/mobile/karaoke-time";

import type { LegalDocSource } from "./content";
import { KARAOKE_LEGAL_UPDATED } from "./meta";

/**
 * Karaoke Odası Ön Bilgilendirme Formu ve Hizmet Sözleşmesi - HAM METİN.
 *
 * Online ön ödemeli karaoke rezervasyonunun (operatör kararı, 16 Eki 2026)
 * ödeme öncesi onaylanan belgesi (`KARAOKE_CONSENT_DOCS`, `./meta`). Mevcut
 * belgelerin hiçbiri bu hizmeti taşımıyor: Mesafeli Satış Sözleşmesi mal
 * satışıyla sınırlı, Ön Bilgilendirme Formu kargo ve 14 günlük cayma üzerine
 * kurulu, Satış Politikası da ayrı bir belge sözü veriyor. Gerekçe ve madde
 * planı: scratchpad krk-legal.md §4.1 ve §4.2-A.
 *
 * TASLAK: avukat onayı bekliyor. Metin yalnız operatörün verdiği kararları
 * yazar (2 saat öncesine kadar tam iade, sonrası ve gelmeme iadesiz, ödemeyle
 * kendiliğinden kesinleşme, işletme iptalinde tam iade); karar verilmemiş
 * hiçbir kural (gecikme payı, tarih değişikliği, yeniden satışta iade)
 * eklenmedi. `content.ts`'ten ayrı dosyada durur, çünkü o dosyayı ayrı bir
 * hukuk PR'ı baştan yazıyor; buradaki tek bağ `LEGAL_CONTENT`'e eklenen bir
 * satırdır.
 *
 * `content.ts`'teki kurallar burada da geçerli: markdown yok, şirket bilgisi
 * `{{TOKEN}}` ile, değeri bilinmeyen token yalnız tablo değerinde.
 *
 * İptal ve iade kuralı (§7, §9, §10) panelden ayarlanır (P2a, 18 Eki 2026):
 * belge `karaokeRoomDocFor(policy)` ile o anki kuralla kurulur ve
 * yayımlanan metin `./karaoke-doc.ts`'ten gelir. Varsayılan kural (2 saat,
 * %0) bugünkü metni harfi harfine verir (`KARAOKE_ROOM_DOC`,
 * tests/karaoke-cancel-policy.test.ts); başka bir kural başka bir metindir
 * ve sürümü kuralın değiştiği güne taşınır (`karaokePolicyVersion`). Her
 * rezervasyon kendi kuralını saklar.
 */

/** §7 "Sizin İptaliniz ve Gelmeme": the policy's rule in the document's voice. */
function cancelBullets(p: KaraokeCancelPolicy): string[] {
  const { freeCancelHours: h, lateRefundPercent: pct } = p;
  const channels =
    "İptali hesabınızdaki Karaoke rezervasyonlarım bölümünden, e-postanızdaki kişiye özel bağlantıdan ya da mobil uygulamadan kendiniz yapabilir ya da bizi arayarak yaptırabilirsiniz.";
  const free =
    h > 0
      ? `Rezervasyon saatine ${h} saatten fazla varken iptal ederseniz ödediğiniz tutarın tamamı kartınıza iade edilir. ${channels}`
      : pct > 0
        ? `Bu rezervasyonda ücretsiz iptal süresi yoktur; rezervasyonu yaptıktan sonra yapacağınız her iptal geç iptal sayılır. ${channels}`
        : "Bu rezervasyonda ücretsiz iptal süresi yoktur; rezervasyonu yaptıktan sonra yapacağınız her iptal geç iptal sayılır.";
  const when =
    h > 0
      ? `Rezervasyon saatine ${h} saatten az kala`
      : "Rezervasyonu yaptıktan sonra";
  const late =
    pct === 0
      ? h > 0
        ? `${when} yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.`
        : "Geç iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz."
      : pct === 100
        ? `${when}, rezervasyon saatinden önce yapılan iptallerde de ödediğiniz tutarın tamamı kartınıza iade edilir; rezervasyona gelinmediğinde ücret iadesi yapılmaz.`
        : `${when}, rezervasyon saatinden önce yapılan iptallerde ödediğiniz tutarın ${percentPossessive(pct)} kartınıza iade edilir; rezervasyona gelinmediğinde ücret iadesi yapılmaz. Bu tutar kuruşa yuvarlanarak hesaplanır ve iptalden itibaren en geç 14 gün içinde ödemeyi yaptığınız karta iade edilir.`;
  return [
    free,
    late,
    "Saatler Türkiye saatiyle (İstanbul) hesaplanır.",
    "İptal ve sorularınız için: {{PHONE}} veya {{EMAIL}}.",
  ];
}

/** §9 "İade Usulü". */
function refundMethod(p: KaraokeCancelPolicy): string {
  const partial = p.lateRefundPercent > 0 && p.lateRefundPercent < 100;
  return partial
    ? "İadeler PayNkolay üzerinden, ödemenin yapıldığı karta yapılır. Geç iptaldeki iade 7. maddedeki oranda, diğer bütün iadeler ödenen tutarın tamamı olarak yapılır. İadenin hesabınıza yansıma süresi bankanıza bağlıdır."
    : "Her iade PayNkolay üzerinden, ödemenin yapıldığı karta ve ödenen tutarın tamamı olarak yapılır; kısmi iade yapılmaz. İadenin hesabınıza yansıma süresi bankanıza bağlıdır.";
}

/** §10 "Hesabın Kapatılması". */
function accountClosure(p: KaraokeCancelPolicy): string {
  const { freeCancelHours: h, lateRefundPercent: pct } = p;
  const free =
    h > 0
      ? `rezervasyon saatine ${h} saatten fazla olan ödenmiş rezervasyonların tutarının tamamı ödemenin yapıldığı karta iade edilir. İade o anda tamamlanamazsa İşletme iadeyi en geç 14 gün içinde ayrıca yapar.`
      : "ödenmiş rezervasyonlara 7. maddedeki geç iptal kuralı uygulanır.";
  const late =
    h > 0
      ? pct === 0
        ? ` Rezervasyon saatine ${h} saatten az kalan ödenmiş rezervasyonlar için 7. maddedeki kural geçerlidir: ücret iadesi yapılmaz ve rezervasyon olduğu gibi kalır.`
        : ` Rezervasyon saatine ${h} saatten az kalan ödenmiş rezervasyonlar için 7. maddedeki geç iptal kuralı geçerlidir.`
      : pct === 0
        ? " Ücret iadesi yapılmaz ve rezervasyon olduğu gibi kalır."
        : "";
  return `Hesabınızı kapatırsanız gelecek tarihli karaoke rezervasyonlarınız iptal edilir; ${free}${late} Üye olmadan, yalnız aynı e-posta adresiyle yapılmış rezervasyonlar hesabın kapatılmasından etkilenmez.`;
}

/**
 * The document under a cancellation policy (Ayarlar > Karaoke). `updatedAt`:
 * the version it is shown under (`karaokePolicyVersion`); the coded
 * revision by default.
 */
export function karaokeRoomDocFor(
  policy: KaraokeCancelPolicy,
  updatedAt: string = KARAOKE_LEGAL_UPDATED,
): LegalDocSource {
  return {
    ...KARAOKE_ROOM_DOC_BASE,
    updatedAt,
    sections: KARAOKE_ROOM_DOC_BASE.sections.map((section) => {
      if (section.heading.startsWith("7. ")) {
        return { ...section, bullets: cancelBullets(policy) };
      }
      if (section.heading.startsWith("9. ")) {
        const [, ...rest] = section.paragraphs ?? [];
        return { ...section, paragraphs: [refundMethod(policy), ...rest] };
      }
      if (section.heading.startsWith("10. ")) {
        return { ...section, paragraphs: [accountClosure(policy)] };
      }
      return section;
    }),
  };
}

/** The coded text, the rule sections filled by `karaokeRoomDocFor`. */
const KARAOKE_ROOM_DOC_BASE: LegalDocSource = {
  slug: "karaoke-odasi-rezervasyon",
  title: "Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi",
  shortTitle: "Karaoke Odası Koşulları",
  updatedAt: "17 Ekim 2026",
  category: "Sipariş",
  summary:
    "{{BRAND}} karaoke odasının web sitesi ve mobil uygulama üzerinden, ödemesi rezervasyon sırasında çevrim içi alınarak ayrılmasına ilişkin ön bilgilendirme ve hizmet sözleşmesidir: bedel, ödeme, rezervasyonun kesinleşmesi, cayma hakkının bulunmaması, iptal ve iade kuralları.",
  references: [
    "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
    "Mesafeli Sözleşmeler Yönetmeliği (RG: 27.11.2014, 29188)",
    "Tüketici Sözleşmelerindeki Haksız Şartlar Hakkında Yönetmelik",
    "6098 sayılı Türk Borçlar Kanunu",
    "213 sayılı Vergi Usul Kanunu",
    "6698 sayılı Kişisel Verilerin Korunması Kanunu",
  ],
  sections: [
    {
      heading: "1. Taraflar ve Konu",
      paragraphs: [
        'İşbu belge; {{ADDRESS}} adresinde mukim, {{TAX_OFFICE}} nezdinde {{TAX_NO}} vergi kimlik numarası ile kayıtlı {{LEGAL_NAME}} (bundan sonra "İşletme") ile {{SITE}} web sitesi veya {{BRAND}} mobil uygulaması üzerinden karaoke odası rezervasyonu yapan üye ya da üye olmadan rezervasyon yapan kişi (bundan sonra "Siz") arasında, karaoke odasının belirli bir gün ve saat aralığında kullanımına ilişkin mesafeli hizmet sözleşmesinin ön bilgilendirme formu ve sözleşme metnidir.',
        "Ön bilgilendirme, Mesafeli Sözleşmeler Yönetmeliği m.5 uyarınca sözleşmenin ayrılmaz parçasıdır. Rezervasyonun özeti ve aşağıdaki temel koşullar ödeme düğmesinin hemen üstünde ayrıca gösterilir; ödemeyi başlatmadan önce ön bilgilendirmeyi okuyup onayladığınızı ve sözleşmeyi kabul ettiğinizi iki ayrı onay kutusuyla, KVKK Aydınlatma Metni'ni okuduğunuzu da üçüncü bir kutuyla teyit edersiniz. Aydınlatma Metni'ni okuduğunuzu belirtmeniz bir bilgilendirmedir, açık rıza değildir.",
        "Kafede yerinde sunulan yiyecek-içecek hizmeti bu belgenin değil Kafe Hizmet Koşulları'nın konusudur. Karaoke odası rezervasyonunun iptal, iade ve gelmeme kuralları yalnız bu belgeyle belirlenir.",
      ],
    },
    {
      heading: "2. Hizmetin Temel Nitelikleri",
      bullets: [
        "Hizmet: {{BRAND}} köşkünün üst katındaki karaoke odasının seçtiğiniz gün ve saat aralığında yalnız sizin grubunuza ayrılması.",
        "Rezervasyon tam saat olarak yapılır. Günün ilk ve son saati, bir rezervasyonun en uzun süresi ve en fazla kaç gün sonrasına rezervasyon yapılabileceği rezervasyon ekranında gösterilir.",
        "Oda, ekranda gösterilen kapasiteye kadar kişi alır.",
        "Aynı anda en fazla iki açık rezervasyonunuz olabilir. Üye olmadan yapılan rezervasyonlarda bu sınır e-posta adresi ve telefon numarası başına ayrı ayrı uygulanır.",
        "Üye olmadan rezervasyon yapabilirsiniz: adınız, soyadınız, cep telefonunuz ve e-posta adresiniz yalnız bu rezervasyon için kaydedilir; sizin adınıza üyelik hesabı açılmaz.",
        "Rezervasyon kodunuz rezervasyon numaranızdır; girişte bu kodu söylemeniz yeterlidir.",
        "Oda bedeli yalnız odanın kullanımını kapsar. Kafeden ayrıca aldığınız yiyecek ve içecekler bu bedele dahil değildir ve ayrıca ödenir. Bunun dışında oda için ek bir ücret alınmaz.",
      ],
    },
    {
      heading: "3. Bedel",
      paragraphs: [
        "Bedel, saatlik oda ücreti ile seçtiğiniz saat sayısının çarpımıdır. Sadakat programının ilgili kademesindeki üyelere programda ilan edilen oranda indirim uygulanır. Ödenecek toplam tutar tüm vergiler dahil olarak, ödemeden önce rezervasyon özetinde gösterilir.",
        "Gösterilen tutar kesindir: rezervasyon anında hesaplanır ve kaydedilir, sonradan saatlik ücrette ya da indirim oranında yapılan değişiklik rezervasyonunuzu etkilemez.",
      ],
    },
    {
      heading: "4. Ödeme",
      paragraphs: [
        "Ödeme, rezervasyon sırasında kredi kartı veya banka kartıyla, PayNkolay sanal POS altyapısı üzerinden, bankanızın 3D Secure doğrulamasıyla tek çekim olarak alınır. Kart bilgileriniz İşletme tarafından saklanmaz.",
        "Ödeme sayfası açıldığı andan itibaren 30 dakika geçerlidir. Bu süre boyunca seçtiğiniz saatler sizin adınıza tutulur. Ödeme süresi içinde tamamlanmazsa rezervasyon düşer, saatler yeniden boşa çıkar ve kartınızdan çekim yapılmaz.",
        "Ödemenin sonucu PayNkolay'dan sorgulanarak teyit edilir. Teyit edilmeyen bir işlem, ödemenin alındığı ya da rezervasyonun kesinleştiği anlamına gelmez. Rezervasyonun süresi dolduktan sonra ulaşan bir ödeme, ya da aynı rezervasyon için ikinci kez alınan bir ödeme, tutarın tamamıyla kendiliğinden iade edilir.",
      ],
    },
    {
      heading: "5. Sözleşmenin Kurulması",
      paragraphs: [
        "Sözleşme, ödemenizin PayNkolay tarafından onaylanmasıyla kurulur ve rezervasyonunuz o anda kendiliğinden kesinleşir; ayrıca bir onay beklemeniz gerekmez. Kesinleşen rezervasyonun bilgileri, bu koşulların özeti ve rezervasyonunuzu görüp iptal edebileceğiniz kişiye özel bağlantı e-posta adresinize gönderilir. Üyeyseniz rezervasyon ayrıca hesabınızdaki Karaoke rezervasyonlarım bölümünde ve uygulamada görünür.",
        "Ödeme onaylanmadan rezervasyon kesinleşmez; ödemesi alınmamış bir rezervasyon İşletme tarafından da onaylanmaz.",
        "Ödeme düğmesine bastığınızda ödeme yükümlülüğü altına girersiniz.",
      ],
    },
    {
      heading: "6. Cayma Hakkı",
      paragraphs: [
        "Karaoke odası rezervasyonu, belirli bir tarih ve saatte sunulan, eğlence amaçlı boş zaman değerlendirme hizmetidir. Mesafeli Sözleşmeler Yönetmeliği m.15/1-(g) uyarınca bu sözleşmede 14 günlük cayma hakkınız bulunmamaktadır.",
        "Aşağıdaki iptal koşulları size ayrıca, sözleşmeyle tanınır.",
      ],
    },
    {
      heading: "7. Sizin İptaliniz ve Gelmeme",
      bullets: [
        "Rezervasyon saatine 2 saatten fazla varken iptal ederseniz ödediğiniz tutarın tamamı kartınıza iade edilir. İptali hesabınızdaki Karaoke rezervasyonlarım bölümünden, e-postanızdaki kişiye özel bağlantıdan ya da mobil uygulamadan kendiniz yapabilir ya da bizi arayarak yaptırabilirsiniz.",
        "Rezervasyon saatine 2 saatten az kala yapılan iptallerde ve rezervasyona gelinmediğinde ücret iadesi yapılmaz.",
        "Saatler Türkiye saatiyle (İstanbul) hesaplanır.",
        "İptal ve sorularınız için: {{PHONE}} veya {{EMAIL}}.",
      ],
    },
    {
      heading: "8. İşletmenin İptali",
      paragraphs: [
        "Rezervasyonunuzu arıza, geçici kapanış, mücbir sebep veya başka bir nedenle karşılayamazsak, Mesafeli Sözleşmeler Yönetmeliği m.16/4 uyarınca durumu öğrendiğimiz tarihten itibaren en geç 3 gün içinde size e-postayla bildiririz ve ödediğiniz tutarın tamamını bildirimden itibaren en geç 14 gün içinde ödemeyi yaptığınız karta iade ederiz. İade, iptalle birlikte PayNkolay üzerinden hemen başlatılır.",
      ],
    },
    {
      heading: "9. İade Usulü",
      paragraphs: [
        "Her iade PayNkolay üzerinden, ödemenin yapıldığı karta ve ödenen tutarın tamamı olarak yapılır; kısmi iade yapılmaz. İadenin hesabınıza yansıma süresi bankanıza bağlıdır.",
        "İade için sizden herhangi bir masraf istenmez.",
      ],
    },
    {
      heading: "10. Hesabın Kapatılması",
      paragraphs: [
        "Hesabınızı kapatırsanız gelecek tarihli karaoke rezervasyonlarınız iptal edilir; rezervasyon saatine 2 saatten fazla olan ödenmiş rezervasyonların tutarının tamamı ödemenin yapıldığı karta iade edilir. İade o anda tamamlanamazsa İşletme iadeyi en geç 14 gün içinde ayrıca yapar. Rezervasyon saatine 2 saatten az kalan ödenmiş rezervasyonlar için 7. maddedeki kural geçerlidir: ücret iadesi yapılmaz ve rezervasyon olduğu gibi kalır. Üye olmadan, yalnız aynı e-posta adresiyle yapılmış rezervasyonlar hesabın kapatılmasından etkilenmez.",
      ],
    },
    {
      heading: "11. Ayıplı Hizmet",
      paragraphs: [
        "Hizmetin ayıplı sunulması hâlinde (örneğin oda veya ekipman arızası nedeniyle sürenin kısalması) 6502 sayılı Kanun m.15 uyarınca hizmetin yeniden görülmesini, ayıp oranında bedelden indirim yapılmasını veya sözleşmeden dönmeyi seçebilirsiniz. Tazminat hakkınız saklıdır.",
      ],
    },
    {
      heading: "12. Fatura",
      paragraphs: [
        "Ödenen bedel için fatura mevzuata uygun olarak düzenlenir; faturanızın bir örneğini {{EMAIL}} adresinden talep edebilirsiniz. İptal ve iade hâlinde gerekli düzeltme belgesi düzenlenir.",
      ],
    },
    {
      heading: "13. Onay Kaydı ve Saklama",
      paragraphs: [
        "Ödemeden önce verdiğiniz onay; onay anı, onaylanan belgeler ve sürümleri, IP adresiniz ve tarayıcı veya uygulama bilgisiyle birlikte rezervasyon kaydınıza işlenir ve Mesafeli Sözleşmeler Yönetmeliği m.20 uyarınca en az 3 yıl saklanır. Ödeme kayıtları vergi mevzuatının öngördüğü süre boyunca saklanır.",
        "Kişisel verilerinizin işlenmesine ilişkin ayrıntılar KVKK Aydınlatma Metni'nde yer alır.",
      ],
    },
    {
      heading: "14. Şikâyet ve Uyuşmazlık",
      paragraphs: [
        "Şikâyetlerinizi {{EMAIL}} adresine iletebilirsiniz. Uyuşmazlıklarda, her yıl ilan edilen parasal sınırlar dahilinde Tüketici Hakem Heyetleri, bu sınırların üzerinde dava öncesi zorunlu arabuluculuk ve Tüketici Mahkemeleri yetkilidir. Ayrıntılar Şikâyet ve Uyuşmazlık Çözümü sayfasındadır.",
      ],
    },
    {
      heading: "15. Satıcı Bilgileri",
      table: [
        { key: "Unvan", value: "{{LEGAL_NAME}}" },
        { key: "Adres", value: "{{ADDRESS}}" },
        { key: "Vergi dairesi / no", value: "{{TAX_OFFICE}} / {{TAX_NO}}" },
        { key: "MERSİS numarası", value: "{{MERSIS}}" },
        { key: "Telefon", value: "{{PHONE}}" },
        { key: "E-posta", value: "{{EMAIL}}" },
      ],
    },
    {
      heading: "16. Yürürlük",
      paragraphs: [
        "İşbu belge, ödemeden önce onay kutusunu işaretlemeniz ve ödemenizin onaylanmasıyla birlikte yürürlüğe girer. Rezervasyonunuza, onayladığınız andaki sürüm uygulanır.",
      ],
    },
  ],
};

/**
 * The document under the default rule (2 hours, 0 %): the coded text, word
 * for word, and what `LEGAL_DOCS` and the admin's legal editor carry.
 */
export const KARAOKE_ROOM_DOC: LegalDocSource = karaokeRoomDocFor(
  DEFAULT_KARAOKE_CANCEL_POLICY,
);
