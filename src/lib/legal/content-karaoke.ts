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
 * Karaoke rezervasyonunun bedel, ödeme, kesinleşme, cayma, iptal, iade,
 * gelmeme ve işletme iptali kuralları YALNIZ bu belgede durur (ASK-Y3-2, 19
 * Eki 2026); Kafe Hizmet Koşulları, İptal İade ve Cayma, Veri Saklama ve
 * Kullanım Şartları buraya atıf yapar. `content.ts`'ten ayrı dosyada durur;
 * buradaki tek bağ `LEGAL_CONTENT`'e eklenen bir satırdır.
 *
 * `content.ts`'teki kurallar burada da geçerli: markdown yok, şirket bilgisi
 * `{{TOKEN}}` ile, değeri bilinmeyen token yalnız tablo değerinde.
 *
 * İptal ve iade kuralının sayıları (ücretsiz iptal süresi, geç iptal iadesi)
 * panelden ayarlanır ve her rezervasyon kendi kuralını saklar (P2a). Metin bu
 * sayıları YAZMAZ, rezervasyon özetinde gösterilen son ücretsiz iptal anına
 * ve geç iptal tutarına atıf yapar (ASK-OTH-3-CFG): metin kurala göre
 * üretilseydi, panelden yayımlanan bir düzenleme eski rakamlarla kalıp bir
 * rezervasyonun kendi kuralıyla çelişebilirdi.
 */

/**
 * The coded document. `updatedAt` is `KARAOKE_LEGAL_UPDATED`, the version a
 * booking's consent records (tests/legal-dates.test.ts holds them equal).
 */
export const KARAOKE_ROOM_DOC: LegalDocSource = {
  slug: "karaoke-odasi-rezervasyon",
  title: "Karaoke Odası Ön Bilgilendirme Formu ve Mesafeli Hizmet Sözleşmesi",
  shortTitle: "Karaoke Odası Koşulları",
  updatedAt: KARAOKE_LEGAL_UPDATED,
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
        "Rezervasyon özetinde gösterilen son ücretsiz iptal anına kadar (bu an dâhil) iptal ederseniz ödediğiniz tutarın tamamı kartınıza iade edilir. İptali hesabınızdaki Karaoke rezervasyonlarım bölümünden, e-postanızdaki kişiye özel bağlantıdan ya da mobil uygulamadan kendiniz yapabilir ya da bizi arayarak veya {{EMAIL}} adresine yazarak yaptırabilirsiniz.",
        "Bizi arayarak yaptırdığınız iptalde görüşmenin yapıldığı an, e-postayla bildirdiğiniz iptalde e-postanızın gönderildiği an iptal anı sayılır. Aramanız yanıtlanamazsa telefonumuzda görünen arama saatiniz iptal anı sayılır; bu durumda iptal isteğinizi aynı gün e-postayla ya da yeniden arayarak iletmeniz yeterlidir. Telefonla verdiğiniz iptal isteğini aynı gün e-postayla teyit ederiz.",
        "Bu andan sonra, rezervasyon saati gelmeden yapılan iptallerde özette geç iptal için gösterilen tutar iade edilir; iptal ettiğiniz saat başka bir misafire satılırsa o saat için sizde kalan tutar da iade edilir.",
        "Özette geç iptalde iade gösterilmiyorsa bu andan sonra ücret iadesi yapılmaz; gelemeyecekseniz rezervasyon kodunuzu bir başkasına verebilirsiniz. Rezervasyon saati gelmeden gelemeyeceğinizi bize bildirirseniz rezervasyonunuzu iptal eder ve saatlerini yeniden satışa açarız; bu durumda da ücret iadesi yapılmaz, ancak bu saatlerden biri başka bir misafire satılırsa o saat için ödediğiniz tutar en geç 14 gün içinde kartınıza iade edilir.",
        "Rezervasyona gelinmediğinde ücret iadesi yapılmaz; gelmediğiniz ya da iptal edemediğiniz bir saati başka bir misafire verirsek ödediğiniz tutarın tamamını iade ederiz.",
        "Son ücretsiz iptal anı ve geç iptalde iade edilecek tutar rezervasyon onay e-postanızda da yazılıdır. Rezervasyonunuza ödemeden önce onayladığınız süre ve iade tutarı uygulanır; bunlarda sonradan yapılan değişiklikler rezervasyonunuzu etkilemez.",
        "Saatler Türkiye saatiyle (İstanbul) hesaplanır.",
        "İptal ve sorularınız için: {{PHONE}} veya {{EMAIL}}.",
      ],
    },
    {
      heading: "8. İşletmenin İptali",
      paragraphs: [
        "Rezervasyonunuzu yalnızca haklı bir sebeple (oda veya ekipman arızası, köşkün geçici olarak kapanması, mücbir sebep veya benzeri haklı bir sebep) iptal ederiz. Bu durumda size durumu öğrenir öğrenmez ve en geç 3 gün içinde e-postayla bildiririz; durumu rezervasyon saatinden önce öğrenmişsek bildirimi rezervasyon saatinden önce yapar, rezervasyonunuza 24 saatten az kalmışsa ve telefon numaranız kayıtlıysa ayrıca sizi ararız. Ödediğiniz tutarın tamamını bildirimden itibaren en geç 14 gün içinde ödemeyi yaptığınız karta iade ederiz; iade, iptalle birlikte PayNkolay üzerinden hemen başlatılır. Bu süreler Mesafeli Sözleşmeler Yönetmeliği m.16/4'teki en uzun sürelerdir ve iptalin her nedeninde uygulanır. Kanundan doğan tazminat haklarınız saklıdır.",
        "İptali, sizin için ücretsiz iptal süresinin bittiği andan sonra yapmak zorunda kalırsak, nedeni doğal afet, resmî makam kararı veya bölgesel elektrik ya da su kesintisi gibi elimizde olmayan bir sebep (mücbir sebep) değilse ve rezervasyonunuzda geç iptalde iade edilmeyen bir tutar varsa, iadeye ek olarak bu tutar kadar bir telafi veririz: dilerseniz aynı uzunlukta ücretsiz bir karaoke saati, dilerseniz bu tutarın kendi adınıza kayıtlı banka hesabınıza ödenmesi. Ücretsiz saati iptal tarihinden itibaren 6 ay içinde {{PHONE}} numarasını arayarak veya {{EMAIL}} adresine yazarak boş bir saat için ayırtabilirsiniz; ödemeyi seçerseniz banka hesap bilginizi {{EMAIL}} adresine yazmanızdan itibaren en geç 14 gün içinde yaparız. Ayırttığınız ücretsiz saati, rezervasyon saatine 2 saatten fazla varken (saat, rezervasyon saatine 4 saatten az kala ayrıldıysa ayrıldığı andan itibaren 2 saat içinde ve rezervasyon saati gelmeden) rezervasyon sayfanızdan, bizi arayarak veya {{EMAIL}} adresine yazarak bırakabilirsiniz; bu durumda telafiniz yeniden açılır. Bu süreden sonra bırakılan ya da gelinmeyen ücretsiz saatte telafi kullanılmış sayılır.",
      ],
    },
    {
      heading: "9. İade Usulü",
      paragraphs: [
        "Her iade PayNkolay üzerinden ödemenin yapıldığı karta yapılır. Tutarın tamamının iadesi iptalle birlikte başlatılır; ödediğiniz tutarın bir kısmı iade ediliyorsa bu tutar en geç 14 gün içinde kartınıza iade edilir. İadenin hesabınıza yansıma süresi bankanıza bağlıdır.",
        "İade için sizden herhangi bir masraf istenmez.",
      ],
    },
    {
      heading: "10. Hesabın Kapatılması",
      paragraphs: [
        "Hesabınızı kapatırsanız gelecek tarihli karaoke rezervasyonlarınız iptal edilir. Rezervasyon özetinde gösterilen son ücretsiz iptal anına kadar (bu an dâhil) kapatılan hesaplarda ödenmiş rezervasyonların tutarının tamamı ödemenin yapıldığı karta iade edilir; iade o anda tamamlanamazsa İşletme iadeyi en geç 14 gün içinde ayrıca yapar. Bu andan sonra kapatılan hesaplarda 7. maddedeki geç iptal kuralı uygulanır; geç iptalde iade gösterilmeyen rezervasyon olduğu gibi kalır. Hesabınızın kapatılmasını bizden talep ederseniz bu süreler talebinizin kaydedildiği ana göre hesaplanır. Üye olmadan, yalnız aynı e-posta adresiyle yapılmış rezervasyonlar hesabın kapatılmasından etkilenmez.",
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
        "Ödediğiniz tutar hizmet gününe kadar ön ödeme niteliğindedir. Fatura, e-Arşiv fatura olarak rezervasyon gününden itibaren en geç 7 gün içinde düzenlenir ve rezervasyonda bildirdiğiniz e-posta adresine gönderilir. İptalde size iade edilen tutar faturalanmaz; iade edilmeyen tutar karaoke odası hizmet bedeli olarak faturalanır. Ödediğiniz KDV dâhil tutar, rezervasyon ile hizmet günü arasında vergi oranı değişse de değişmez.",
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
