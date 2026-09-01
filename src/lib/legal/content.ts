/**
 * Hukuki belge içeriği — HAM METİN.
 *
 * Şirket bilgisi geçen her yerde `{{TOKEN}}` yer tutucusu kullanılır; gerçek
 * değerler `./entity.ts` içinde tek noktada tutulur ve `./documents.ts`
 * tarafından doldurulur. Değeri bilinmeyen bir token (MERSİS, ticaret sicil,
 * KEP, IBAN) içeren tablo satırı render edilmeden düşürülür — bu yüzden bu
 * tokenlar YALNIZCA tablo değerlerinde kullanılabilir.
 *
 * Metinleri düzenlerken: markdown işareti kullanmayın, yapıyı
 * paragraphs / bullets / ordered / table alanlarıyla kurun.
 */

export interface LegalDocSource {
  slug: string;
  title: string;
  shortTitle: string;
  category: string;
  summary: string;
  references?: string[];
  sections: Array<{
    heading: string;
    paragraphs?: string[];
    ordered?: string[];
    bullets?: string[];
    table?: { key: string; value: string }[];
  }>;
}

export const LEGAL_CONTENT: LegalDocSource[] = [
  {
    "slug": "on-bilgilendirme-formu",
    "title": "Ön Bilgilendirme Formu",
    "shortTitle": "Ön Bilgilendirme",
    "category": "Sipariş",
    "summary": "Mesafeli Sözleşmeler Yönetmeliği uyarınca, {{SITE}} üzerinden sipariş vermeden önce satıcı bilgileri, ürünün nitelikleri, vergiler dâhil toplam bedel, ödeme ve teslimat koşulları ile cayma hakkı konusunda tüketiciyi bilgilendiren zorunlu formdur.",
    "references": [
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
      "Mesafeli Sözleşmeler Yönetmeliği (Resmî Gazete: 27.11.2014, Sayı: 29188) — m.5 ön bilgilendirme yükümlülüğü, m.9 cayma hakkı, m.12 cayma bildirimi, m.15 cayma hakkının istisnaları",
      "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun",
      "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İleti Yönetim Sistemi — İYS)",
      "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik",
      "6698 sayılı Kişisel Verilerin Korunması Kanunu — m.4 genel ilkeler, m.5-6 işleme şartları, m.9 yurt dışına aktarım, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliği",
      "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ",
      "Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik",
      "6098 sayılı Türk Borçlar Kanunu — m.117 temerrüt",
      "6102 sayılı Türk Ticaret Kanunu — m.1524 internet sitesi yükümlülüğü",
      "5464 sayılı Banka Kartları ve Kredi Kartları Kanunu",
      "6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun",
      "5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun",
      "5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu",
      "Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği",
      "5846 sayılı Fikir ve Sanat Eserleri Kanunu",
      "6769 sayılı Sınai Mülkiyet Kanunu",
      "213 sayılı Vergi Usul Kanunu",
      "6100 sayılı Hukuk Muhakemeleri Kanunu — m.193 delil sözleşmesi"
    ],
    "sections": [
      {
        "heading": "1. Formun Amacı, Konusu ve Hukuki Niteliği",
        "paragraphs": [
          "Bu Ön Bilgilendirme Formu, {{LEGAL_NAME}} ({{BRAND}} markası ile faaliyet gösterir; bundan sonra SATICI olarak anılacaktır) tarafından {{SITE_URL}} adresinde işletilen internet sitesi ve online mağaza (bottega) üzerinden mesafeli olarak satışa sunulan mal ve hizmetlere ilişkin olarak, siparişi veren tüketicinin (bundan sonra ALICI olarak anılacaktır) sipariş vermeden ve herhangi bir ödeme yükümlülüğü altına girmeden önce bilgilendirilmesi amacıyla, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri uyarınca düzenlenmiştir.",
          "Form, Mesafeli Sözleşmeler Yönetmeliği'nin ön bilgilendirmeye ilişkin hükmünde sayılan tüm bilgi kalemlerini kapsamakta olup, ALICI'nın okuyup anladığını elektronik ortamda ayrı bir onay kutucuğu ile teyit etmesi, Mesafeli Satış Sözleşmesi'nin kurulmasının ön şartıdır. ALICI bu formu onaylamadığı sürece sipariş süreci tamamlanamaz ve ödeme adımına geçilemez.",
          "Bu form tek başına bir satış sözleşmesi değildir; sözleşme öncesi bilgilendirme belgesidir. Taraflar arasındaki hak ve yükümlülükler, ALICI tarafından ayrıca onaylanacak Mesafeli Satış Sözleşmesi ile kurulur. Formda yer alan bilgiler ile Mesafeli Satış Sözleşmesi arasında tüketici aleyhine bir çelişki bulunması hâlinde, tüketici lehine olan hüküm uygulanır.",
          "Bu formda yer alan hiçbir hüküm, tüketicinin 6502 sayılı Kanun ve ilgili mevzuattan doğan emredici haklarını sınırlandıracak, ortadan kaldıracak veya tüketiciyi bu haklarından feragat ettirecek şekilde yorumlanamaz."
        ]
      },
      {
        "heading": "2. Satıcı (Hizmet Sağlayıcı) Bilgileri",
        "paragraphs": [
          "Mesafeli Sözleşmeler Yönetmeliği ile Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik uyarınca satıcıya ilişkin tanıtıcı bilgiler aşağıda yer almaktadır. ALICI, sözleşme ilişkisinin her aşamasında bu bilgilere {{SITE_URL}} adresinden ve aşağıdaki iletişim kanallarından ulaşabilir."
        ],
        "table": [
          {
            "key": "Ticaret unvanı",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Kısa unvan",
            "value": "{{SHORT_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Merkez ve iş yeri adresi",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Vergi dairesi",
            "value": "{{TAX_OFFICE}}"
          },
          {
            "key": "Vergi kimlik numarası (VKN)",
            "value": "{{TAX_NO}}"
          },
          {
            "key": "Vergi türü",
            "value": "{{TAX_TYPE}}"
          },
          {
            "key": "Faaliyete başlama tarihi",
            "value": "{{STARTED_AT}}"
          },
          {
            "key": "Ana faaliyet kodu (NACE)",
            "value": "{{NACE}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil numarası",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "Banka",
            "value": "{{BANK}}"
          },
          {
            "key": "IBAN",
            "value": "{{IBAN}}"
          },
          {
            "key": "Instagram",
            "value": "{{IG}}"
          },
          {
            "key": "TikTok",
            "value": "{{TIKTOK}}"
          },
          {
            "key": "YouTube",
            "value": "{{YOUTUBE}}"
          },
          {
            "key": "Sosyal medya kullanıcı adı",
            "value": "{{HANDLE}}"
          }
        ]
      },
      {
        "heading": "3. Alıcı, Fatura ve Teslimat Bilgileri",
        "paragraphs": [
          "ALICI'ya, faturaya ve teslimata ilişkin bilgiler; ALICI'nın {{SITE}} üzerinde oluşturduğu üye hesabında kayıtlı ve sipariş adımında seçtiği/güncellediği verilerden otomatik olarak alınır. Bu bilgiler sipariş özeti ekranında ve ödeme öncesindeki son onay ekranında ALICI'ya bir bütün hâlinde gösterilir; sipariş tamamlandıktan sonra ALICI'nın e-posta adresine gönderilen sipariş onay iletisinde ve üye hesabındaki sipariş detay sayfasında kalıcı olarak yer alır.",
          "Sipariş özetinde ALICI'ya gösterilen ve bu formun ayrılmaz bir parçası sayılan bilgi kalemleri aşağıdaki gibidir. Formun bu bölümünde sabit bir değer yer almaz; her sipariş için ilgili sipariş kaydındaki güncel değerler geçerlidir."
        ],
        "bullets": [
          "Ad ve soyad (tüzel kişi alıcılarda ticaret unvanı)",
          "Teslimat adresi: ülke, il, ilçe, mahalle, cadde/sokak, bina ve iç kapı numarası, posta kodu",
          "Fatura adresi (teslimat adresinden farklı olabilir) ve tüzel kişi alıcılarda vergi dairesi ile vergi kimlik numarası",
          "İletişim telefonu ve doğrulanmış e-posta adresi",
          "Sipariş numarası, sipariş tarihi ve saati",
          "Teslim alacak kişi bilgisi (ALICI'dan farklı ise) ve varsa kuryeye iletilecek teslimat notu"
        ]
      },
      {
        "heading": "4. Sözleşme Konusu Mal ve Hizmetin Temel Nitelikleri",
        "paragraphs": [
          "Sözleşme konusu mal veya hizmetin türü, adı, adedi, varyantı (ağırlık, öğütüm derecesi, renk, beden gibi), marka ve modeli, tüm vergiler dâhil satış fiyatı ile varsa indirim öncesi referans fiyatı; ürün detay sayfasında, sepet ekranında ve ödeme öncesindeki sipariş özetinde ALICI'ya gösterilir. Bu bilgiler her sipariş için ilgili sipariş kaydında saklanır ve bu formun ayrılmaz parçasıdır.",
          "{{BRAND}} online mağazasında satışa sunulan ürün grupları ve bu gruplara ilişkin temel nitelik bilgileri aşağıda özetlenmiştir. Ürünlerin tanıtım görselleri temsilîdir; el yapımı ve doğal ürünlerde renk, doku ve desen bakımından makul ölçüde farklılık bulunabilir. Bu farklılıklar tek başına ayıp teşkil etmez; ancak ürünün vaat edilen temel niteliklerini karşılamaması hâlinde ALICI'nın ayıplı maldan doğan hakları saklıdır."
        ],
        "bullets": [
          "Kavrulmuş kahve çekirdeği: menşe, harman/tek çiftlik bilgisi, kavurma profili, kavurma tarihi, net ağırlık ve öğütüm seçeneği (çekirdek veya belirtilen demleme yöntemine göre öğütülmüş) ürün sayfasında belirtilir.",
          "Yenilebilir waffle kupa (edible cup): gıda ürünüdür; içindekiler, alerjen uyarıları, net miktar, son tüketim tarihi ve saklama koşulu ürün sayfasında ve ambalaj üzerinde yer alır.",
          "Gelato kiti ve kiler ürünleri (pistacchio kreması, şuruplar): içindekiler listesi, alerjen bilgisi, net miktar, parti numarası, tavsiye edilen tüketim tarihi ve saklama/soğuk zincir koşulları belirtilir.",
          "Kahve ekipmanı (moka pot, değirmen, tamper): malzeme, kapasite/ölçü, üretici veya ithalatçı bilgisi, varsa garanti süresi ve kullanım kılavuzu bilgisi ürün sayfasında yer alır.",
          "Marka ürünleri (fincan, önlük, tote çanta): malzeme bileşimi, ölçü/beden, yıkama ve bakım talimatı belirtilir.",
          "Kafe menüsünde yer alan içecek ve tatlılar, işletme içinde sunulan hizmetler olup online mağaza üzerinden mesafeli satışa konu edilmez; menü sayfası yalnızca tanıtım ve bilgilendirme amacı taşır."
        ]
      },
      {
        "heading": "5. Toplam Bedel, Vergiler ve Ek Masraf Kalemleri",
        "paragraphs": [
          "{{SITE}} üzerinde gösterilen tüm fiyatlar Türk Lirası (TRY) cinsinden ve Katma Değer Vergisi dâhil olarak belirtilir. Uygulanan KDV oranı, ürün grubuna göre yürürlükteki vergi mevzuatına uygun şekilde hesaplanır; fiziksel ürünlerde güncel oran %20'dir. Vergi oranlarında mevzuat değişikliği olması hâlinde, sipariş tarihinde yürürlükte olan oran uygulanır.",
          "ALICI'nın ödeyeceği toplam bedel; ürünlerin vergiler dâhil satış bedelleri toplamından varsa promosyon kodu/indirim tutarı düşülerek, üzerine varsa kargo veya kurye ücreti eklenmek suretiyle hesaplanır. Hesaplamanın her bir kalemi sepet ekranında ve ödeme öncesindeki sipariş özetinde ayrı ayrı gösterilir. Sipariş özetinde gösterilen tutar dışında ALICI'dan herhangi bir ad altında ilave ücret talep edilmez.",
          "Fiyatlar, ALICI tarafından siparişin onaylandığı an itibarıyla bağlayıcıdır. Sipariş onayından sonra yapılan fiyat değişiklikleri, tamamlanmış siparişe uygulanmaz. Bariz yazım/sistem hatasından kaynaklanan ve tüketicinin de kolayca fark edebileceği açık fiyat hatalarında SATICI durumu derhâl ALICI'ya bildirir; ALICI dilerse siparişi doğru bedel üzerinden sürdürebilir, dilerse siparişi bedelsiz olarak iptal edebilir ve tahsil edilmiş tutar iade edilir."
        ],
        "table": [
          {
            "key": "Para birimi",
            "value": "Türk Lirası (TRY)"
          },
          {
            "key": "Fiyat gösterimi",
            "value": "Tüm vergiler dâhil"
          },
          {
            "key": "KDV oranı (fiziksel ürün)",
            "value": "%20"
          },
          {
            "key": "Kargo — 500 TL ve üzeri sipariş",
            "value": "Ücretsiz"
          },
          {
            "key": "Kargo — 500 TL altı sipariş",
            "value": "39 TL"
          },
          {
            "key": "İstanbul içi motokurye",
            "value": "89 TL"
          },
          {
            "key": "Ek masraf",
            "value": "Sipariş özetinde gösterilenler dışında ek masraf yoktur"
          }
        ]
      },
      {
        "heading": "6. Ödeme Şekli, 3D Secure, Taksit ve Ön Provizyon",
        "paragraphs": [
          "Ödeme, {{SITE}} üzerindeki ödeme adımında ALICI'nın seçtiği yöntemle yapılır. Kart ile yapılan ödemeler, 6493 sayılı Kanun kapsamında yetkilendirilmiş ödeme kuruluşu veya banka sanal POS altyapısı üzerinden alınır. Kart numarası, son kullanma tarihi ve güvenlik kodu (CVV/CVC) gibi kart verileri SATICI'nın sunucularında hiçbir aşamada saklanmaz; bu veriler doğrudan PCI-DSS uyumlu ödeme altyapısı tarafından işlenir. SATICI'nın sipariş kaydında yalnızca kartın son dört hanesi, kart markası, işlem referans numarası ve işlem sonucu tutulur.",
          "Kart ile yapılan işlemlerde 3D Secure (kart hamilinin bankası tarafından yürütülen ek kimlik doğrulama) uygulanır. 3D Secure doğrulamasının tamamlanmadığı işlemlerde sipariş oluşturulmaz. Bankanın veya ödeme kuruluşunun işlemi reddetmesi, limit yetersizliği, kartın e-ticarete kapalı olması gibi hâllerde sipariş kurulmamış sayılır ve ALICI'ya ekranda gerekçe ile birlikte bilgi verilir.",
          "Taksitli ödeme imkânı, kartın ait olduğu bankanın ve ödeme kuruluşunun o tarihte sunduğu taksit seçenekleriyle sınırlıdır. Taksit sayısı, varsa vade farkı ve taksit tutarı ödeme ekranında ALICI'ya açıkça gösterilir; ALICI'nın seçimi olmadan taksitlendirme yapılmaz. Banka tarafından kart hamiline tanınan ek taksit, erteleme veya puan kampanyaları banka ile kart hamili arasındaki ilişkiye tabidir ve SATICI bu kampanyaların uygulanmasından sorumlu değildir.",
          "Bazı işlemlerde, sipariş kesinleşmeden önce kart limitinde ön provizyon (bloke) uygulanabilir. Ön provizyon bir tahsilat değildir; sipariş onaylandığında satışa dönüştürülür, sipariş kurulmaz veya iptal edilirse çözülür. Ön provizyonun kart hesabına yansıma süresi bankanın iç süreçlerine bağlıdır.",
          "Havale/EFT seçeneğinin sunulduğu hâllerde ALICI, sipariş numarasını açıklama alanına yazarak ödeme yapar. Havale/EFT ile ödenen siparişlerde hazırlık süresi, ödemenin SATICI hesabına geçtiğinin teyit edildiği tarihte başlar. Belirtilen süre içinde ödemesi ulaşmayan siparişler otomatik olarak iptal edilir; bu iptal ALICI aleyhine herhangi bir bedel doğurmaz."
        ],
        "bullets": [
          "Kredi kartı ve banka kartı (3D Secure ile)",
          "Sunulduğu ölçüde taksitli kart ödemesi (vade farkı ödeme ekranında gösterilir)",
          "Sunulduğu ölçüde havale/EFT",
          "Yabancı para cinsinden kartlarla yapılan ödemelerde kur ve işlem masrafı, kartı düzenleyen bankanın tarifesine tabidir"
        ]
      },
      {
        "heading": "7. Teslimat Şekli, Taşıyıcı Firma ve Teslimat Masrafı",
        "paragraphs": [
          "Sipariş konusu ürünler, ALICI'nın sipariş sırasında bildirdiği teslimat adresine, aşağıda belirtilen taşıyıcılar aracılığıyla gönderilir. Teslimat masrafı, bu formun 5. maddesindeki tarifeye göre hesaplanır ve tarifede ücretsiz olduğu belirtilen hâller dışında ALICI'ya aittir; tutar sipariş özetinde ayrı bir kalem olarak gösterilir.",
          "Kargo takip numarası, ürün taşıyıcıya teslim edildiğinde ALICI'nın e-posta adresine gönderilir ve üye hesabındaki sipariş detay sayfasında görüntülenir. ALICI veya adına teslim alacak kişi, teslim sırasında paketi taşıyıcı yetkilisinin yanında kontrol etmeli; ezilme, ıslanma, açılmış bant veya soğuk zincir ihlali şüphesi varsa paketi teslim almadan taşıyıcıya tutanak tutturmalı ve durumu {{EMAIL}} adresine bildirmelidir. Tutanak tutulmadan teslim alınan hasarlı gönderilerde de ALICI'nın ayıplı maldan doğan yasal hakları saklıdır; tutanak yalnızca ispat kolaylığı sağlar.",
          "ALICI'nın adreste bulunmaması nedeniyle teslim edilemeyen gönderilerde taşıyıcı ihbar bırakır ve gönderi, taşıyıcının kendi tarifesinde öngörülen süre boyunca şubede bekletilir. Bu süre içinde teslim alınmayan gönderiler SATICI'ya iade edilir; bu durumda SATICI, ALICI ile iletişime geçerek yeniden gönderim veya siparişin iptali konusunda mutabakat sağlar."
        ],
        "table": [
          {
            "key": "Türkiye geneli",
            "value": "Yurtiçi Kargo"
          },
          {
            "key": "KKTC ve yurt dışı",
            "value": "Aras Kargo"
          },
          {
            "key": "İstanbul içi hızlı teslimat",
            "value": "Motokurye"
          },
          {
            "key": "Teslimat masrafı",
            "value": "Tarifeye göre ALICI'ya aittir; 500 TL ve üzeri siparişlerde ücretsizdir"
          },
          {
            "key": "Teslim yeri",
            "value": "ALICI'nın sipariş sırasında bildirdiği adres"
          },
          {
            "key": "Teslim alabilecek kişi",
            "value": "ALICI veya ALICI'nın bildirdiği üçüncü kişi"
          }
        ]
      },
      {
        "heading": "8. Siparişin Kurulması, Üyelik Şartı ve Sipariş Akışı",
        "paragraphs": [
          "{{SITE}} üzerinden sipariş verilebilmesi için ALICI'nın e-posta adresi doğrulanmış bir üye hesabına sahip olması gerekir. Bu şart; sipariş, fatura, kargo ve iade bildirimlerinin doğru adrese ulaşmasını, sipariş geçmişinin ALICI tarafından erişilebilir olmasını ve kart dolandırıcılığına karşı asgari güvenlik seviyesinin sağlanmasını amaçlar.",
          "Sipariş süreci aşağıdaki adımlardan oluşur. ALICI, ödeme adımına gelmeden önceki her aşamada sepetinde değişiklik yapabilir, ürün çıkarabilir, adet ve varyant güncelleyebilir; girdiği bilgilerdeki hataları düzeltebilir ve siparişi tamamlamadan süreçten çıkabilir."
        ],
        "ordered": [
          "Ürünün seçilmesi ve sepete eklenmesi; sepette adet, varyant ve ara toplamın görüntülenmesi.",
          "Üye girişi veya e-posta doğrulamalı hesap oluşturma.",
          "Teslimat ve fatura adresinin girilmesi veya kayıtlı adreslerden seçilmesi.",
          "Teslimat yönteminin seçilmesi ve kargo/kurye ücretinin hesaplanması.",
          "Varsa promosyon kodunun girilmesi ve indirimin sepete yansıtılması.",
          "Sipariş özetinin gösterilmesi: ürünler, birim ve toplam bedeller, vergiler, kargo ücreti, indirim ve genel toplam.",
          "Bu Ön Bilgilendirme Formu ile Mesafeli Satış Sözleşmesi'nin okunması ve her biri için ayrı onay kutucuğunun işaretlenmesi.",
          "Ödeme bilgilerinin girilmesi ve 3D Secure doğrulamasının tamamlanması.",
          "Ödemenin başarılı olması hâlinde sipariş kaydının oluşturulması ve sipariş numarasının ekranda gösterilmesi.",
          "Sipariş onay e-postasının, bu formun ve sözleşmenin onaylanan sürümüyle birlikte ALICI'nın e-posta adresine gönderilmesi."
        ]
      },
      {
        "heading": "9. İfa (Teslim) Süresi ve Gecikme Hâlinde Tüketicinin Hakları",
        "paragraphs": [
          "Sipariş konusu mal, ödemenin onaylandığı tarihten itibaren en geç 30 (otuz) gün içinde ALICI'ya veya ALICI'nın bildirdiği kişiye teslim edilir. Bu süre yasal azami süre olup, SATICI olağan koşullarda siparişleri iş günleri içinde 1-3 iş gününde hazırlar ve taşıyıcıya teslim eder; İstanbul içi motokurye teslimatları aynı gün veya ertesi iş günü içinde gerçekleştirilir. Ürün sayfasında daha kısa bir hazırlık süresi belirtilmişse o süre esas alınır.",
          "Hafta sonu, resmî tatil günleri ve taşıyıcının kabul saatleri sonrasında verilen siparişlerde hazırlık süresi takip eden ilk iş gününde başlar. Taze kavrulan kahve gibi siparişe göre hazırlanan ürünlerde hazırlık süresi ürün sayfasında ayrıca belirtilir.",
          "SATICI'nın malı süresi içinde teslim etmemesi hâlinde ALICI sözleşmeyi feshedebilir. Sözleşmenin feshi hâlinde SATICI, tahsil edilen tüm ödemeleri (varsa teslimat masrafları dâhil) fesih bildiriminin ulaştığı tarihten itibaren en geç 14 (on dört) gün içinde ALICI'ya iade eder. ALICI'nın 6098 sayılı Türk Borçlar Kanunu'nun temerrüde ilişkin hükümlerinden ve 6502 sayılı Kanun'dan doğan diğer talep hakları saklıdır.",
          "Sipariş edilen ürünün stokta bulunmadığının sonradan anlaşılması hâlinde SATICI durumu derhâl ve en geç 3 (üç) iş günü içinde ALICI'ya bildirir; ALICI'nın açık onayı olmaksızın farklı bir ürün gönderilmez. Bu hâlde tahsil edilen bedel, bildirim tarihinden itibaren en geç 14 (on dört) gün içinde ALICI'ya iade edilir."
        ]
      },
      {
        "heading": "10. Cayma Hakkı: Süre, Başlangıç Anı ve Kullanım Yöntemi",
        "paragraphs": [
          "ALICI, Mesafeli Sözleşmeler Yönetmeliği uyarınca, hiçbir gerekçe göstermeksizin ve cezai şart ödemeksizin 14 (on dört) gün içinde sözleşmeden cayma hakkına sahiptir. Cayma hakkının kullanılması için bu süre içinde SATICI'ya yazılı olarak veya kalıcı veri saklayıcısı ile bildirimde bulunulması yeterlidir; bildirimin süresi içinde gönderilmiş olması, süreye uyulduğunun kabulü için yeterlidir.",
          "Cayma süresinin başlangıç anı aşağıdaki gibidir. Hizmet ifasına ilişkin sözleşmelerde süre, sözleşmenin kurulduğu gün başlar.",
          "Cayma bildirimi, aşağıdaki kanallardan herhangi biri ile yapılabilir. SATICI, kendisine ulaşan cayma bildirimini derhâl kayda alır ve teyidini ALICI'ya kalıcı veri saklayıcısı ile (e-posta yoluyla) gönderir. ALICI'nın bildirimi için Yönetmelik ekindeki örnek cayma formunu kullanma zorunluluğu yoktur; açık bir irade beyanı yeterlidir."
        ],
        "ordered": [
          "Tek parça hâlinde teslim edilen mallarda: ALICI'nın veya bildirdiği üçüncü kişinin malı teslim aldığı gün.",
          "Birden fazla parçadan oluşan mallarda: son parçanın teslim alındığı gün.",
          "Belirli bir süre boyunca düzenli teslimatı öngören sözleşmelerde: ilk teslimatın alındığı gün."
        ],
        "bullets": [
          "E-posta: {{EMAIL}} (sipariş numarası ve cayılan ürün belirtilerek)",
          "Üye hesabındaki sipariş detay sayfasında yer alan iade/cayma talebi formu",
          "Telefon: {{PHONE}} (sözlü başvuru, ALICI'ya e-posta ile yazılı olarak teyit edilir)",
          "Posta: {{ADDRESS}} adresine yazılı bildirim"
        ]
      },
      {
        "heading": "11. Cayma Hakkının Kullanılamayacağı Hâller",
        "paragraphs": [
          "Mesafeli Sözleşmeler Yönetmeliği'nin cayma hakkının istisnalarını düzenleyen hükmü uyarınca, aşağıdaki ürün ve hizmetlerde cayma hakkı kullanılamaz. Bu istisnalar tüketici aleyhine genişletilemez; aşağıda sayılmayan ürünlerde cayma hakkı tam olarak geçerlidir.",
          "SATICI, cayma hakkının bulunmadığı ürünleri ürün detay sayfasında ve sepet ekranında açıkça işaretler; ALICI bu bilgilendirmeyi sipariş özetinde de görür. Cayma hakkının kullanılamayacağı hâller, ürünün ayıplı çıkması durumunda ALICI'nın ayıplı maldan doğan haklarını ortadan kaldırmaz."
        ],
        "bullets": [
          "Çabuk bozulabilen veya son kullanma tarihi geçebilecek gıda ürünleri: yenilebilir waffle kupa, gelato kiti, soğuk zincir gerektiren ürünler ve benzeri.",
          "Tesliminden sonra ambalajı, bandı, mührü veya koruyucu folyosu açılmış olan ve iadesi sağlık/hijyen açısından uygun olmayan ürünler: açılmış kahve paketleri, açılmış pistacchio kreması ve şuruplar, ağızla temas eden ekipman parçaları.",
          "Tüketicinin istekleri veya kişisel ihtiyaçları doğrultusunda hazırlanan kişiye özel ürünler: isim/mesaj baskılı fincan, önlük veya tote çanta; talebe göre özel öğütülen veya özel harmanlanan kahve.",
          "Tesliminden sonra başka ürünlerle karışan ve doğası gereği ayrıştırılması mümkün olmayan ürünler.",
          "Belirli bir tarihte veya dönemde yapılması gereken, ağırlama ve eğlence amaçlı hizmetler: kahve tadım atölyesi, barista eğitimi, rezervasyonlu etkinlik ve benzeri tarihli hizmetler.",
          "Elektronik ortamda anında ifa edilen ve tüketiciye anında teslim edilen gayri maddi ürünler (dijital tarif kitapçığı, dijital hediye kodu gibi), ALICI'nın önceden onayı alınarak ifaya başlanmışsa."
        ]
      },
      {
        "heading": "12. Cayma Sonrası İade Usulü, İade Kargo Masrafı ve Geri Ödeme",
        "paragraphs": [
          "ALICI, cayma bildirimini yaptığı tarihten itibaren 10 (on) gün içinde malı SATICI'ya veya SATICI'nın yetkilendirdiği kişiye geri göndermekle yükümlüdür. Malın, faturası, kutusu, standart aksesuarları ve varsa hediye ürünleriyle birlikte, ticari değerini yitirmeden ve yeniden satılabilirliğini engellemeyecek şekilde iade edilmesi gerekir. Ürünün ALICI'nın malın niteliğine ve işleyişine uygun olmayan kullanımından kaynaklanan değer kaybından ALICI sorumludur; olağan muayene ve deneme kapsamındaki kullanım bu nitelikte sayılmaz.",
          "SATICI, iade için aşağıda belirtilen anlaşmalı taşıyıcıyı bildirmiştir. ALICI iadeyi bu taşıyıcı ile ve verilen iade kodu ile gönderdiğinde iade kargo bedeli SATICI tarafından karşılanır. ALICI'nın bu taşıyıcı yerine başka bir taşıyıcıyı tercih etmesi hâlinde, aradaki fark ALICI'ya ait olur. Ürünün ayıplı olması, yanlış ürün gönderilmesi veya kargoda hasar görmesi hâllerinde iade kargo bedeli her hâlükârda SATICI'ya aittir.",
          "SATICI, cayma bildiriminin kendisine ulaştığı tarihten itibaren 14 (on dört) gün içinde, ALICI'nın ödediği toplam bedeli ve varsa ALICI'yı borç altına sokan kıymetli evrakı iade eder; teslimat masrafları da bu iadeye dâhildir. Geri ödeme, ALICI'nın satın alırken kullandığı ödeme aracına uygun şekilde ve ALICI'ya hiçbir masraf yüklenmeksizin tek seferde yapılır. Kart ile yapılan ödemelerde tutarın kart hesabına yansıma süresi, ilgili banka veya ödeme kuruluşunun süreçlerine bağlıdır; taksitli işlemlerde bankalar iadeyi taksit sayısına göre yansıtabilir. Bu süreler SATICI'nın kontrolü dışında olup, SATICI iade talimatını yasal süre içinde vermekle yükümlüdür."
        ],
        "table": [
          {
            "key": "İade bildirim süresi",
            "value": "Teslimden itibaren 14 gün"
          },
          {
            "key": "Malı geri gönderme süresi",
            "value": "Cayma bildiriminden itibaren 10 gün"
          },
          {
            "key": "SATICI'nın geri ödeme süresi",
            "value": "Cayma bildiriminden itibaren 14 gün"
          },
          {
            "key": "Anlaşmalı iade taşıyıcısı",
            "value": "Yurtiçi Kargo (iade kodu ile ücretsiz)"
          },
          {
            "key": "İade adresi",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "İade bildirim adresi",
            "value": "{{EMAIL}}"
          }
        ]
      },
      {
        "heading": "13. Ayıplı Mal, Garanti ve Tüketicinin Seçimlik Hakları",
        "paragraphs": [
          "Teslim edilen malın ayıplı çıkması hâlinde ALICI, 6502 sayılı Tüketicinin Korunması Hakkında Kanun kapsamında; satılanı geri vererek sözleşmeden dönme, satılanı alıkoyup ayıp oranında bedelden indirim isteme, aşırı masraf gerektirmediği takdirde ücretsiz onarım isteme veya ayıpsız misli ile değiştirilmesini isteme haklarından birini seçebilir. SATICI, ALICI'nın tercih ettiği bu talebi yerine getirmekle yükümlüdür.",
          "Ayıp ihbarının, ayıbın fark edilmesinden itibaren makul sürede {{EMAIL}} adresine sipariş numarası, ayıbı gösteren fotoğraf veya video ve varsa taşıyıcı tutanağı ile birlikte yapılması, sürecin hızlanmasını sağlar. Ancak ihbarın gecikmesi, ALICI'nın yasal haklarını tek başına ortadan kaldırmaz.",
          "Garanti belgesi ile satılan ekipman ürünlerinde, üretici veya ithalatçı tarafından düzenlenen garanti belgesi ürünle birlikte gönderilir. Garanti süresi, garanti kapsamı ve yetkili servis bilgileri belgede yer alır. Gıda ürünlerinde garanti yerine son tüketim tarihi, parti numarası ve saklama koşulu bilgisi geçerlidir; bu bilgiler ambalaj üzerinde bulunur."
        ]
      },
      {
        "heading": "14. Gıda Ürünlerine İlişkin Özel Bilgilendirme, Alerjen ve Saklama Koşulları",
        "paragraphs": [
          "Gıda niteliğindeki ürünler; 5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu ile Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği hükümlerine uygun olarak etiketlenir. İçindekiler listesi, alerjen bileşenler, net miktar, parti numarası, tavsiye edilen tüketim veya son tüketim tarihi ve saklama koşulları hem ürün detay sayfasında hem de ambalaj üzerinde belirtilir.",
          "Ürünlerimizin üretildiği ve paketlendiği tesiste süt ve süt ürünleri, gluten içeren tahıllar, sert kabuklu yemişler (özellikle antep fıstığı ve fındık), yumurta ve soya bulunmaktadır. Çapraz bulaşma riski tamamen ortadan kaldırılamadığından, gıda alerjisi veya intoleransı bulunan ALICI'ların satın almadan önce ürün sayfasındaki alerjen bilgisini dikkatle incelemesi ve tereddüt hâlinde sipariş öncesinde {{EMAIL}} adresinden veya {{PHONE}} numarasından bilgi alması önemle tavsiye edilir.",
          "Soğuk zincir gerektiren ürünler yalıtımlı ambalaj ve soğutucu ile gönderilir; teslim alındıktan sonra ürün sayfasında belirtilen sıcaklıkta muhafaza edilmelidir. Kavrulmuş kahve çekirdekleri serin, kuru ve doğrudan güneş ışığı almayan bir ortamda, ağzı kapalı ambalajında saklanmalıdır. Ürünlerin ALICI tarafından uygun olmayan koşullarda saklanmasından kaynaklanan bozulmalar ayıp kapsamında değerlendirilmez.",
          "Online mağazada alkollü içecek ve tütün ürünü satışı yapılmamaktadır; 4207 sayılı Tütün Ürünlerinin Zararlarının Önlenmesi ve Kontrolü Hakkında Kanun kapsamındaki ürünler {{BRAND}} online mağazasının kapsamı dışındadır."
        ]
      },
      {
        "heading": "15. Fatura, Belge Düzeni ve Promosyon Kodları",
        "paragraphs": [
          "213 sayılı Vergi Usul Kanunu ve ilgili tebliğler uyarınca düzenlenen fatura, siparişin tamamlanmasının ardından ALICI'nın sipariş sırasında bildirdiği fatura bilgileri esas alınarak düzenlenir ve ALICI'nın doğrulanmış e-posta adresine elektronik ortamda iletilir; ayrıca üye hesabındaki sipariş detay sayfasından indirilebilir. Fatura bilgilerinin doğruluğundan ALICI sorumludur.",
          "Promosyon kodları, kampanya sayfasında veya kodun tanıtıldığı iletide belirtilen geçerlilik süresi, asgari sepet tutarı, ürün/kategori kapsamı ve kullanım adedi sınırlarına tabidir. Kodun sağladığı indirim, sepet ekranında ve sipariş özetinde ayrı bir kalem olarak gösterilir. Aksi belirtilmedikçe promosyon kodları birleştirilemez ve nakde çevrilemez.",
          "Cayma hakkının kullanılması hâlinde geri ödeme, ALICI'nın fiilen ödediği tutar üzerinden yapılır. Kısmi iadelerde, kampanya koşulu (örneğin asgari sepet tutarı) kalan üründe artık sağlanmıyorsa indirim orantılı olarak düşülerek hesaplanır; hesaplama yöntemi iade bildiriminde ALICI'ya kalem kalem açıklanır."
        ]
      },
      {
        "heading": "16. Ödeme Güvenliği, İtiraz (Chargeback) ve Şüpheli İşlem",
        "paragraphs": [
          "Ödeme işlemleri, 5464 sayılı Banka Kartları ve Kredi Kartları Kanunu ile 6493 sayılı Kanun hükümlerine tabi banka veya ödeme kuruluşu altyapısı üzerinden gerçekleştirilir. Site ile ödeme altyapısı arasındaki tüm veri trafiği TLS ile şifrelenir. Kart verileri SATICI tarafından saklanmaz, görüntülenmez ve üçüncü kişilerle paylaşılmaz.",
          "ALICI, kartıyla yapıldığını kabul etmediği bir işlem için kartını düzenleyen bankaya itiraz (chargeback) başvurusunda bulunabilir. Böyle bir başvuru hâlinde SATICI, banka veya ödeme kuruluşunun talebi üzerine; sipariş kaydı, onay tarihi ve saati, IP adresi, tarayıcı bilgisi, 3D Secure doğrulama sonucu, kargo teslim kaydı ve yazışma kayıtlarından oluşan belgeleri sunar. Bu belge paylaşımı, itiraz sürecinin yürütülmesi ve SATICI'nın hukuki yükümlülüğü kapsamındadır.",
          "Kart dolandırıcılığı şüphesi doğuran işlemlerde SATICI, siparişi geçici olarak beklemeye alabilir ve kart hamilinden makul doğrulama talep edebilir. Doğrulamanın sağlanamaması hâlinde sipariş iptal edilir ve tahsil edilmiş tutar gecikmeksizin iade edilir. Bu tedbir yalnızca dolandırıcılığın önlenmesi amacıyla ve ölçülü biçimde uygulanır; ALICI'ya ek bir bedel yüklemez.",
          "ALICI'nın ödeme yükümlülüğünü yerine getirmemesi ve temerrüde düşmesi hâlinde SATICI'nın 6098 sayılı Türk Borçlar Kanunu'nun temerrüt hükümlerinden doğan hakları saklıdır. Buna karşılık, teslim edilmemiş bir sipariş nedeniyle ALICI'dan cezai şart talep edilmez."
        ]
      },
      {
        "heading": "17. Kişisel Verilerin Korunması ve Ticari Elektronik İletiler",
        "paragraphs": [
          "Sipariş sürecinde işlenen kimlik, iletişim, teslimat adresi, sipariş ve işlem güvenliği verileri; 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusu sıfatıyla {{LEGAL_NAME}} tarafından, sözleşmenin kurulması ve ifası, hukuki yükümlülüklerin yerine getirilmesi ve meşru menfaat hukuki sebeplerine dayanılarak, Kanun'un genel ilkelerine uygun biçimde ve amaçla bağlantılı, sınırlı ve ölçülü olarak işlenir. Ayrıntılı bilgi için Aydınlatma Metni ve Gizlilik Politikası'na {{SITE_URL}} adresinden ulaşabilirsiniz.",
          "Veriler; siparişin teslimi amacıyla kargo ve kurye şirketleriyle, ödemenin alınması amacıyla banka ve ödeme kuruluşlarıyla, işlemsel e-postaların gönderimi amacıyla e-posta altyapı sağlayıcısıyla ve mevzuattan doğan yükümlülükler kapsamında yetkili kamu kurum ve kuruluşlarıyla paylaşılabilir. Barındırma ve veri tabanı hizmetleri nedeniyle yurt dışına aktarım söz konusu olduğunda, Kanun'un yurt dışına aktarıma ilişkin hükmünde öngörülen şartlara uyulur.",
          "ALICI, Kanun'un ilgili kişinin haklarını düzenleyen hükmü kapsamındaki taleplerini, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'e uygun olarak {{EMAIL}} adresine veya {{ADDRESS}} adresine yazılı olarak iletebilir. Başvurular en geç 30 (otuz) gün içinde sonuçlandırılır.",
          "Kampanya, tanıtım ve pazarlama içerikli ticari elektronik iletiler; 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik uyarınca yalnızca ALICI'nın önceden açık onayı ile ve İleti Yönetim Sistemi (İYS) üzerinden kaydedilerek gönderilir. Sipariş onayı, kargo bildirimi, iade ve fatura bilgilendirmesi gibi işlemsel iletiler bu onay kapsamı dışındadır ve sözleşmenin ifası için gönderilir. ALICI, ticari elektronik ileti onayını her zaman ve ücretsiz olarak, iletideki ret bağlantısı, İYS veya {{EMAIL}} adresi üzerinden geri alabilir."
        ]
      },
      {
        "heading": "18. Şikâyet, İtiraz ve Uyuşmazlıkların Çözümü",
        "paragraphs": [
          "ALICI, sipariş, teslimat, iade veya ürünle ilgili her türlü talep, öneri ve şikâyetini {{EMAIL}} adresine, {{PHONE}} numarasına veya {{ADDRESS}} adresine iletebilir. SATICI, kendisine ulaşan başvuruları kayda alır, en geç 3 (üç) iş günü içinde geri dönüş yapar ve çözüm sürecinin her aşamasında ALICI'yı bilgilendirir. Sosyal medya hesapları ({{HANDLE}}) üzerinden gelen mesajlar da kayda alınmakla birlikte, resmî başvuru kanalı e-posta ve yazılı bildirimdir.",
          "SATICI ile çözülemeyen uyuşmazlıklarda ALICI, 6502 sayılı Tüketicinin Korunması Hakkında Kanun uyarınca, her yıl Ticaret Bakanlığınca yeniden değerleme oranında güncellenen parasal sınırlar çerçevesinde; kendi yerleşim yerindeki veya tüketici işleminin yapıldığı yerdeki İlçe/İl Tüketici Hakem Heyetine ya da Tüketici Mahkemesine başvurabilir. Parasal sınırlar ve başvuru usulüne ilişkin güncel bilgilere Ticaret Bakanlığının resmî kaynaklarından ulaşılabilir.",
          "ALICI ayrıca Ticaret Bakanlığının e-Devlet üzerinden erişilen Tüketici Bilgi Sistemi aracılığıyla elektronik ortamda başvuru yapabilir. Bu formda yer alan hiçbir hüküm, ALICI'nın tüketici hakem heyetine veya tüketici mahkemesine başvurma hakkını sınırlandıramaz.",
          "Bu formdan ve mesafeli satış ilişkisinden doğan uyuşmazlıklarda Türk hukuku uygulanır."
        ]
      },
      {
        "heading": "19. Kalıcı Veri Saklayıcısı, Onay Kaydı ve Delil Sözleşmesi",
        "paragraphs": [
          "Bu Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi, ALICI tarafından onaylandığı sürümüyle birlikte, sipariş onay e-postasının ekinde kalıcı veri saklayıcısı olarak ALICI'ya gönderilir ve ALICI'nın üye hesabındaki sipariş detay sayfasından süresiz olarak görüntülenebilir ve indirilebilir. ALICI, bu belgeleri kendi cihazına kaydedebilir veya çıktısını alabilir.",
          "Onay anında, ispat kolaylığı sağlamak ve ödeme kuruluşu ile banka nezdindeki itiraz süreçlerinde kullanılmak üzere aşağıdaki kayıtlar sipariş kaydına yazılır ve değiştirilemez olay kaydında (audit log) saklanır.",
          "Taraflar; SATICI'nın sistem, sunucu ve veri tabanı kayıtlarının, e-posta gönderim kayıtlarının, ödeme kuruluşu ve banka işlem kayıtlarının ile taşıyıcı teslim kayıtlarının, 6100 sayılı Hukuk Muhakemeleri Kanunu'nun delil sözleşmesine ilişkin hükmü uyarınca bağlayıcı delil teşkil edeceğini kabul eder. Bu hüküm, ALICI'nın aksini ispat etme hakkını ve tüketici mevzuatından doğan haklarını ortadan kaldırmaz."
        ],
        "bullets": [
          "Onaylanan belgelerin adı ve sürüm numarası",
          "Onay tarihi ve saati (sunucu saati)",
          "ALICI'nın onay anındaki IP adresi",
          "Tarayıcı ve cihaz bilgisi (user agent)",
          "Üye hesabı kimliği ve sipariş numarası",
          "3D Secure doğrulama sonucu ve ödeme işlem referans numarası"
        ]
      },
      {
        "heading": "20. Mücbir Sebep",
        "paragraphs": [
          "Doğal afet, yangın, sel, salgın hastalık, savaş, seferberlik, grev ve lokavt, kamu otoritesinin işlem veya kararları, altyapı ve iletişim kesintileri, taşıyıcı kaynaklı ülke çapında aksaklıklar gibi tarafların kontrolü dışında gelişen ve öngörülemeyen hâller mücbir sebep sayılır.",
          "Mücbir sebep hâlinde SATICI, durumu ve beklenen süreyi gecikmeksizin ALICI'ya bildirir. Bu hâlde ALICI dilerse siparişin beklemesini kabul edebilir, dilerse siparişi iptal ederek ödediği bedelin iadesini talep edebilir. İade, talebin SATICI'ya ulaşmasından itibaren en geç 14 (on dört) gün içinde yapılır.",
          "Mücbir sebep, SATICI'yı yalnızca bu sebebin doğrudan etkilediği yükümlülükler bakımından ve etkinin sürdüğü süre boyunca sorumluluktan kurtarır; SATICI'nın genel sorumluluğunu ortadan kaldırmaz."
        ]
      },
      {
        "heading": "21. Formun Geçerliliği, Güncellenmesi ve Tüketici Beyanı",
        "paragraphs": [
          "Bu form, {{SITE}} üzerinde yayımlandığı sürüm itibarıyla geçerlidir. Fiyat, kargo tarifesi ve kampanya bilgileri gibi değişebilir unsurlar bakımından, her sipariş için ALICI'nın onayladığı andaki sipariş özeti ve o an yürürlükte olan form sürümü esas alınır. Formda yapılacak değişiklikler geriye etkili olmaz; onaylanmış siparişlere, onay anındaki sürüm uygulanmaya devam eder.",
          "Sepette bekletilen ürünlerin fiyat ve stok durumu, sipariş onaylanana kadar bağlayıcı değildir; bağlayıcılık, ALICI'nın siparişi onaylayıp ödemenin başarıyla tamamlandığı anda doğar.",
          "ALICI, bu Ön Bilgilendirme Formunu sipariş vermeden ve ödeme yükümlülüğü doğuran işlemi tamamlamadan önce okuduğunu; sözleşme konusu mal veya hizmetin temel niteliklerini, tüm vergiler dâhil toplam satış fiyatını ve ödeme şeklini, teslimat şeklini, taşıyıcıyı, teslimat masrafının kime ait olduğunu, ifa süresini, cayma hakkının varlığını, süresini, başlangıç anını ve kullanım usulünü, cayma hakkının kullanılamayacağı hâlleri, iade koşullarını ve şikâyet başvuru yollarını açık, anlaşılır ve internet ortamına uygun şekilde öğrendiğini kabul, beyan ve taahhüt eder.",
          "ALICI bu formu onayladığında, sipariş verdiği takdirde ödeme yükümlülüğü altına gireceğini bildiğini de kabul etmiş olur."
        ],
        "table": [
          {
            "key": "Belge adı",
            "value": "Ön Bilgilendirme Formu"
          },
          {
            "key": "Yayımlandığı adres",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Satıcı",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Başvuru ve iletişim",
            "value": "{{EMAIL}} · {{PHONE}}"
          },
          {
            "key": "Onay şekli",
            "value": "Ödeme adımında ayrı onay kutucuğu ile elektronik onay"
          }
        ]
      }
    ]
  },
  {
    "slug": "mesafeli-satis-sozlesmesi",
    "title": "Mesafeli Satış Sözleşmesi",
    "shortTitle": "Mesafeli Satış",
    "category": "Sipariş",
    "summary": "{{BRAND}} çevrimiçi mağazasından verilen siparişlerde Satıcı ile Alıcı arasında elektronik ortamda kurulan mesafeli satış sözleşmesinin tam metni: taraflar, ödeme, teslimat, cayma hakkı, ayıplı mal ve uyuşmazlık çözümü.",
    "references": [
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
      "Mesafeli Sözleşmeler Yönetmeliği (Resmî Gazete: 27.11.2014, Sayı: 29188)",
      "6098 sayılı Türk Borçlar Kanunu",
      "6102 sayılı Türk Ticaret Kanunu",
      "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun",
      "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İYS - İleti Yönetim Sistemi)",
      "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik",
      "6698 sayılı Kişisel Verilerin Korunması Kanunu",
      "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ",
      "Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik",
      "5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun",
      "5464 sayılı Banka Kartları ve Kredi Kartları Kanunu",
      "6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun",
      "213 sayılı Vergi Usul Kanunu",
      "5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu",
      "Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği",
      "5846 sayılı Fikir ve Sanat Eserleri Kanunu",
      "6769 sayılı Sınai Mülkiyet Kanunu",
      "6100 sayılı Hukuk Muhakemeleri Kanunu",
      "4207 sayılı Tütün Ürünlerinin Zararlarının Önlenmesi ve Kontrolü Hakkında Kanun"
    ],
    "sections": [
      {
        "heading": "1. Taraflar",
        "paragraphs": [
          "İşbu Mesafeli Satış Sözleşmesi (Sözleşme), aşağıda kimlik ve iletişim bilgileri yer alan SATICI ile, {{SITE_URL}} adresinde yayımlanan çevrimiçi mağaza (bottega) üzerinden elektronik ortamda sipariş veren ALICI arasında, aşağıda belirtilen hüküm ve şartlar çerçevesinde elektronik ortamda kurulmuştur.",
          "SATICI, {{BRAND}} markasını işleten tüzel kişidir. Sözleşme metninde geçen {{BRAND}} ibaresi, SATICI'ya ait tescilli marka ve ticari işletme adını ifade eder; hukuki sorumluluk her hâlükârda {{LEGAL_NAME}} tüzel kişiliğine aittir.",
          "ALICI; sipariş sırasında üyelik hesabında beyan ettiği ad-soyad, T.C. kimlik numarası (talep edilmesi hâlinde), teslimat ve fatura adresi, telefon numarası ve e-posta adresi ile tanımlanan gerçek veya tüzel kişidir. ALICI, sipariş formunda ve üyelik kaydında beyan ettiği bilgilerin doğru, güncel ve eksiksiz olduğunu; bu bilgilerin hatalı, eksik veya güncel olmaması nedeniyle doğacak teslimat gecikmesi, teslim edilememe, yanlış kişiye teslim ve ek kargo masraflarından bizzat sorumlu olduğunu kabul eder.",
          "SATICI'nın işbu Sözleşme kapsamındaki tüm bildirimleri, ALICI'nın hesabında kayıtlı e-posta adresine ve/veya {{SITE_URL}} üzerindeki hesap paneline yapılır. ALICI'nın SATICI'ya yönelteceği tüm bildirim, talep, şikâyet ve cayma beyanları {{EMAIL}} adresine veya {{ADDRESS}} adresine yapılabilir."
        ],
        "table": [
          {
            "key": "Satıcı Ticaret Unvanı",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Kısa Unvan",
            "value": "{{SHORT_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Adres",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "Web Sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Vergi Dairesi",
            "value": "{{TAX_OFFICE}}"
          },
          {
            "key": "Vergi Kimlik No",
            "value": "{{TAX_NO}}"
          },
          {
            "key": "Vergi Türü",
            "value": "{{TAX_TYPE}}"
          },
          {
            "key": "Faaliyet Kodu (NACE)",
            "value": "{{NACE}}"
          },
          {
            "key": "İşe Başlama Tarihi",
            "value": "{{STARTED_AT}}"
          },
          {
            "key": "MERSİS No",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret Sicil No",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "KEP Adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "Banka",
            "value": "{{BANK}}"
          },
          {
            "key": "IBAN",
            "value": "{{IBAN}}"
          },
          {
            "key": "Instagram",
            "value": "{{IG}}"
          },
          {
            "key": "TikTok",
            "value": "{{TIKTOK}}"
          },
          {
            "key": "YouTube",
            "value": "{{YOUTUBE}}"
          }
        ]
      },
      {
        "heading": "2. Tanımlar",
        "paragraphs": [
          "İşbu Sözleşme'nin uygulanmasında ve yorumlanmasında aşağıdaki kavramlar, karşılarında yazılı anlamları ifade eder. Burada tanımlanmayan kavramlar için 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği'ndeki tanımlar esas alınır."
        ],
        "table": [
          {
            "key": "Bakanlık",
            "value": "T.C. Ticaret Bakanlığı"
          },
          {
            "key": "Kanun",
            "value": "6502 sayılı Tüketicinin Korunması Hakkında Kanun"
          },
          {
            "key": "Yönetmelik",
            "value": "Mesafeli Sözleşmeler Yönetmeliği (RG: 27.11.2014, S: 29188)"
          },
          {
            "key": "Hizmet",
            "value": "Bir ücret veya menfaat karşılığında yapılan ya da yapılması taahhüt edilen, mal sağlama dışındaki her türlü tüketici işleminin konusu"
          },
          {
            "key": "Mal",
            "value": "Alışverişe konu taşınır eşya; işbu Sözleşme kapsamında kavrulmuş kahve çekirdeği, yenilebilir waffle kupa, gelato kiti, kahve ekipmanı, marka ürünleri ve kiler ürünleri gibi fiziksel ürünler"
          },
          {
            "key": "Satıcı",
            "value": "Ticari veya mesleki faaliyetleri kapsamında tüketiciye mal sunan {{LEGAL_NAME}}"
          },
          {
            "key": "Alıcı",
            "value": "Bir mal veya hizmeti ticari ya da mesleki olmayan amaçlarla edinen, kullanan veya yararlanan gerçek ya da tüzel kişi (Tüketici)"
          },
          {
            "key": "Site",
            "value": "SATICI'ya ait {{SITE_URL}} adresindeki internet sitesi ve buna bağlı çevrimiçi mağaza"
          },
          {
            "key": "Sipariş Veren",
            "value": "Bir mal veya hizmeti Site üzerinden talep eden gerçek ya da tüzel kişi"
          },
          {
            "key": "Taraflar",
            "value": "SATICI ve ALICI'nın birlikte anılması"
          },
          {
            "key": "Sözleşme",
            "value": "SATICI ile ALICI arasında elektronik ortamda akdedilen işbu Mesafeli Satış Sözleşmesi"
          },
          {
            "key": "Kalıcı Veri Saklayıcısı",
            "value": "ALICI'nın kendisine gönderilen bilgiyi bu bilginin amacına uygun olarak makul bir süre incelemesine elverecek şekilde kaydedilmesini ve değiştirilmeden kopyalanmasını sağlayan ve bu bilgiye aynen ulaşılmasına imkân veren kısa mesaj, elektronik posta, internet, disk, CD, DVD, hafıza kartı ve benzeri her türlü araç veya ortam"
          },
          {
            "key": "Ön Bilgilendirme Formu",
            "value": "Yönetmelik'in ön bilgilendirmeye ilişkin hükümleri uyarınca ALICI'ya sözleşme kurulmadan önce sunulan ve ALICI tarafından ayrı bir onay kutucuğu ile onaylanan bilgilendirme metni"
          },
          {
            "key": "Sipariş Onayı",
            "value": "Ödemenin başarıyla tamamlanmasının ardından ALICI'nın e-posta adresine gönderilen ve siparişin SATICI tarafından kabul edildiğini bildiren elektronik ileti"
          },
          {
            "key": "Minor Unit (Kuruş)",
            "value": "Site üzerindeki fiyatların teknik olarak saklandığı en küçük para birimi; 1 TRY = 100 kuruş"
          }
        ]
      },
      {
        "heading": "3. Sözleşmenin Konusu ve Kapsamı",
        "paragraphs": [
          "İşbu Sözleşme'nin konusu; ALICI'nın SATICI'ya ait {{SITE_URL}} internet sitesi üzerinden elektronik ortamda siparişini verdiği, nitelikleri ve satış fiyatı Site'de ve Ön Bilgilendirme Formu'nda belirtilen malın satışı ve teslimi ile ilgili olarak, 6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince Tarafların hak ve yükümlülüklerinin belirlenmesidir.",
          "İşbu Sözleşme, SATICI'nın yalnızca {{SITE_URL}} üzerinden yürüttüğü uzaktan (mesafeli) mal satışını kapsar. SATICI'nın {{ADDRESS}} adresindeki fiziki işletmesinde yüz yüze gerçekleştirilen kafe hizmetleri, masada servis, yerinde tüketim ve benzeri işlemler mesafeli sözleşme niteliğinde olmadığından işbu Sözleşme kapsamı dışındadır.",
          "Site üzerinde yer alan kafe menüsü yalnızca bilgilendirme amaçlıdır ve tek başına bir satış icabı oluşturmaz. Satın alma yükümlülüğü doğuran işlem, çevrimiçi mağaza (bottega) üzerinden sepete eklenen ürünler için ödeme adımının tamamlanmasıyla kurulur.",
          "ALICI, işbu Sözleşme'yi kabul etmekle; sipariş konusu malın temel nitelikleri, tüm vergiler dâhil satış fiyatı, ödeme şekli, teslimat koşulları, kargo bedeli, cayma hakkının kullanım şartları ve süresi, cayma hakkının kullanılamayacağı hâller, şikâyet ve itiraz başvuru mercileri ile SATICI'nın açık kimlik ve iletişim bilgileri hususlarında Yönetmelik'in ön bilgilendirmeye ilişkin hükümleri uyarınca açık, anlaşılır ve internet ortamına uygun şekilde bilgilendirildiğini; bu bilgileri okuduğunu, anladığını ve elektronik ortamda teyit ettiğini kabul, beyan ve taahhüt eder.",
          "Siparişin verilebilmesi için ALICI'nın {{SITE_URL}} üzerinde bir üyelik hesabı oluşturması ve hesabına ait e-posta adresini doğrulaması zorunludur. E-posta doğrulaması tamamlanmamış hesaplardan sipariş verilemez. Bu koşul, sipariş sahibinin kimliğinin doğrulanması, sahtecilik girişimlerinin önlenmesi ve sipariş bildirimlerinin ulaştırılabilmesi amacıyla getirilmiştir."
        ]
      },
      {
        "heading": "4. Sözleşme Konusu Mal, Fiyat ve Ödeme Bilgileri",
        "paragraphs": [
          "Sözleşme konusu mal veya malların cinsi, türü, miktarı, marka ve modeli, rengi, varyantı, birim fiyatı, adedi, tüm vergiler dâhil toplam satış bedeli, kargo bedeli, varsa uygulanan promosyon kodu indirimi ve genel toplam; sipariş sırasında ALICI'ya gösterilen sipariş özetinde, ALICI tarafından onaylanan Ön Bilgilendirme Formu'nda ve Sipariş Onayı e-postasında ayrı ayrı yer alır. Bu belgeler işbu Sözleşme'nin ayrılmaz eki ve tamamlayıcı parçasıdır.",
          "Site'de belirtilen tüm fiyatlar Türk Lirası (TRY) cinsinden olup, aksi açıkça belirtilmedikçe %20 oranındaki Katma Değer Vergisi dâhildir. Fiyatlar teknik altyapıda kuruş (minor unit) olarak saklanır ve arayüzde Türk Lirası biçiminde gösterilir. Vergi oranlarında mevzuat değişikliği olması hâlinde güncel oran uygulanır ve bu durum Site üzerinde gösterilir.",
          "SATICI, Site üzerindeki listeleme fiyatlarını, kampanyaları ve promosyon kodlarını dilediği zaman güncelleme hakkını saklı tutar. Ancak ALICI'nın siparişini onayladığı ve ödemesini tamamladığı an itibarıyla geçerli olan fiyat, o sipariş bakımından bağlayıcıdır; sipariş sonrasında yapılan fiyat değişiklikleri kurulmuş sözleşmeyi etkilemez.",
          "Sistemsel, teknik veya dizgi kaynaklı bariz fiyat hatası (örneğin ürünün maliyetiyle açıkça bağdaşmayan, ortalama bir tüketicinin dahi hata olduğunu anlayabileceği bir tutar) bulunması hâlinde SATICI, durumu tespit ettiği anda ALICI'yı derhâl bilgilendirir ve siparişi iptal ederek tahsil edilen bedelin tamamını herhangi bir kesinti yapılmaksızın en geç 14 (on dört) gün içinde iade eder. Bu durum, ALICI'nın Kanun'dan doğan diğer haklarını ortadan kaldırmaz."
        ],
        "table": [
          {
            "key": "Para Birimi",
            "value": "Türk Lirası (TRY)"
          },
          {
            "key": "KDV Oranı",
            "value": "%20 (fiyatlara dâhildir)"
          },
          {
            "key": "Kargo Bedeli",
            "value": "500 TL ve üzeri siparişlerde ücretsiz; 500 TL altındaki siparişlerde 39 TL"
          },
          {
            "key": "İstanbul İçi Motokurye",
            "value": "89 TL"
          },
          {
            "key": "Türkiye Geneli Kargo",
            "value": "Yurtiçi Kargo"
          },
          {
            "key": "KKTC / Yurt Dışı",
            "value": "Aras Kargo"
          },
          {
            "key": "Azami Teslim Süresi",
            "value": "Siparişin kurulmasından itibaren 30 (otuz) gün"
          },
          {
            "key": "Cayma Hakkı Süresi",
            "value": "Malın teslim alınmasından itibaren 14 (on dört) gün"
          }
        ]
      },
      {
        "heading": "5. Ön Bilgilendirme ve Sözleşmenin Kurulması",
        "paragraphs": [
          "ALICI, ödeme adımına geçmeden önce Ön Bilgilendirme Formu'nun ve işbu Mesafeli Satış Sözleşmesi'nin tam metnine Site üzerinden erişir. Her iki belge, ALICI tarafından okunup incelenebilecek şekilde ayrı ayrı görüntülenir ve indirilebilir.",
          "ALICI, ödeme adımında yer alan ve varsayılan olarak işaretsiz gelen ayrı bir onay kutucuğunu kendi iradesiyle işaretleyerek Ön Bilgilendirme Formu'nu ve işbu Sözleşme'yi okuduğunu, anladığını ve kabul ettiğini beyan eder. Bu kutucuk işaretlenmeden ödeme adımı tamamlanamaz ve sipariş oluşturulamaz.",
          "Onay işlemi anında; onay tarihi ve saati (saniye hassasiyetinde), ALICI'nın bağlandığı IP adresi, tarayıcı ve cihaz bilgisi (user-agent), üyelik hesabı kimliği ve onaylanan belgelerin sürüm numarası sipariş kaydına yazılır. Bu kayıtlar, SATICI'nın ön bilgilendirme yükümlülüğünü yerine getirdiğinin ispatı bakımından tutulur ve talep hâlinde ALICI ile paylaşılır.",
          "Sözleşme, ödemenin ilgili ödeme kuruluşu veya banka nezdinde başarıyla tamamlanması ve siparişin SATICI sistemine düşmesi anında kurulur. Sözleşme'nin bir örneği, Ön Bilgilendirme Formu ve sipariş özeti ile birlikte kalıcı veri saklayıcısı niteliğindeki e-posta yoluyla ALICI'nın kayıtlı e-posta adresine gönderilir; ayrıca ALICI'nın üyelik hesabındaki sipariş detay sayfasından süresiz olarak erişilebilir durumda tutulur.",
          "Ödeme adımına ulaşılmış ancak ödeme tamamlanmamış (terk edilmiş sepet) hâllerde Sözleşme kurulmuş sayılmaz ve Taraflar arasında herhangi bir borç ilişkisi doğmaz."
        ]
      },
      {
        "heading": "6. Genel Hükümler",
        "ordered": [
          "ALICI, {{SITE_URL}} üzerinde sözleşme konusu malın temel nitelikleri, tüm vergiler dâhil satış fiyatı, ödeme şekli ve teslimata ilişkin ön bilgileri okuyup bilgi sahibi olduğunu ve elektronik ortamda gerekli teyidi verdiğini; Yönetmelik uyarınca kendisine sunulması gereken adres, siparişi verilen ürünlere ait temel özellikler, ürünlerin vergiler dâhil fiyatı, ödeme ve teslimat bilgilerini doğru ve eksiksiz olarak edindiğini kabul, beyan ve taahhüt eder.",
          "Sözleşme konusu mal, ALICI'dan başka bir kişiye veya kuruluşa teslim edilecek ise, teslim edilecek kişi veya kuruluşun teslimatı kabul etmemesinden SATICI sorumlu tutulamaz. ALICI, siparişte üçüncü bir kişiyi teslim alacak kişi olarak göstermesi hâlinde, bu kişinin ad-soyad, adres ve iletişim bilgilerini paylaşma konusunda gerekli hukuki yetkiye sahip olduğunu beyan eder.",
          "SATICI, sözleşme konusu malı sağlam, eksiksiz, siparişte belirtilen niteliklere uygun ve varsa garanti belgeleri, kullanım kılavuzları ile birlikte teslim etmekle yükümlüdür. Gıda niteliğindeki ürünler, soğuk zincir gereksinimi bulunanlar dâhil, 5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu ile ilgili ikincil mevzuata uygun şekilde ambalajlanır ve sevk edilir.",
          "Sözleşme konusu mal, siparişin kurulmasından itibaren yasal 30 (otuz) günlük azami süreyi aşmamak kaydıyla, Site'de ve Ön Bilgilendirme Formu'nda belirtilen süre içinde ALICI'ya veya ALICI'nın gösterdiği adresteki kişi/kuruluşa teslim edilir. SATICI'nın bu süre içinde edimini yerine getirmemesi durumunda ALICI, Sözleşme'yi feshetme hakkına sahiptir; bu hâlde tahsil edilen tüm ödemeler ve varsa ALICI'yı borç altına sokan belgeler fesih bildiriminin SATICI'ya ulaşmasından itibaren en geç 14 (on dört) gün içinde ALICI'ya iade edilir.",
          "SATICI, haklı bir sebebe dayanmak, en geç Sözleşme'den doğan ifa yükümlülüğünün süresi dolmadan ALICI'yı bilgilendirmek ve açıkça onayını almak kaydıyla, eşit kalite ve fiyatta farklı bir ürünü tedarik edebilir. ALICI'nın açık onayı alınmadan muadil ürün gönderilmez.",
          "Sipariş konusu malın stokta bulunmadığının veya tedarik edilemeyeceğinin sipariş sonrasında anlaşılması hâlinde SATICI, durumu öğrendiği tarihten itibaren 3 (üç) iş günü içinde ALICI'yı yazılı olarak veya kalıcı veri saklayıcısı ile bilgilendirir; ALICI'nın tercihine göre siparişi kısmen veya tamamen iptal eder ve tahsil edilen bedeli bildirim tarihinden itibaren en geç 14 (on dört) gün içinde, hiçbir kesinti yapılmaksızın ve ALICI'yı herhangi bir masraf altına sokmaksızın iade eder.",
          "Herhangi bir nedenle mal bedeli ödenmez veya banka ya da ödeme kuruluşu kayıtlarında iptal edilirse, SATICI'nın malı teslim yükümlülüğü sona erer. Ödemenin ödeme kuruluşu tarafından reddedilmesi, iptal edilmesi veya geri çekilmesi hâlinde sipariş otomatik olarak iptal edilir ve ALICI'ya bilgi verilir.",
          "Malın tesliminden sonra ALICI'ya ait kredi kartının, banka kartının veya ödeme aracının ALICI'nın kusurundan kaynaklanmayan bir şekilde yetkisiz kişilerce hukuka aykırı olarak kullanıldığının tespit edilmesi ve bu nedenle ilgili banka veya finans kuruluşunun mal bedelini SATICI'ya ödememesi hâlinde, ALICI teslim edilmiş malı 3 (üç) gün içinde SATICI'ya iade etmekle yükümlüdür. Bu hâlde iade kargo giderleri SATICI'ya aittir.",
          "SATICI, sipariş ve ödeme işlemlerinde 5464 sayılı Banka Kartları ve Kredi Kartları Kanunu ile ilgili mevzuat çerçevesinde sahtecilik ve dolandırıcılık riskine karşı kontroller uygular. Şüpheli işlem tespiti hâlinde SATICI, ALICI'dan kimlik ve kart sahipliğine ilişkin makul doğrulama talep edebilir; doğrulama sağlanamazsa siparişi iptal ederek bedeli iade eder. Bu kontrol, ALICI'nın Kanun'dan doğan haklarını sınırlamaz.",
          "SATICI, mücbir sebepler veya nakliyeyi engelleyen olağanüstü durumlar nedeniyle sözleşme konusu malı süresi içinde teslim edemez ise, durumu öğrendiği tarihten itibaren 3 (üç) gün içinde ALICI'ya yazılı olarak veya kalıcı veri saklayıcısı ile bildirir. Bu hâlde ALICI, siparişin iptal edilmesini, sözleşme konusu malın varsa emsali ile değiştirilmesini veya engel ortadan kalkana kadar teslimatın ertelenmesini talep edebilir. Siparişin iptali hâlinde tahsil edilen bedel en geç 14 (on dört) gün içinde iade edilir.",
          "ALICI, malı teslim aldığı anda ambalajın bütünlüğünü, ürünün görünür hasar ve eksik içerik bakımından durumunu kargo görevlisi huzurunda kontrol etmekle mükelleftir. Hasarlı veya ezik ambalajlı paketler teslim alınmayarak kargo firması yetkilisine tutanak tutturulmalı ve bu durum {{EMAIL}} adresine bildirilmelidir. Bu kontrolün yapılmamış olması, ALICI'nın gizli ayıba ve 6502 sayılı Kanun'un ayıplı mala ilişkin hükümlerinden doğan haklarına başvurmasına engel teşkil etmez.",
          "Teslim alınan mala ilişkin hasar ve kayıp riski, malın ALICI'ya veya ALICI'nın belirlediği üçüncü kişiye fiziken teslim edildiği anda ALICI'ya geçer. ALICI'nın, SATICI'nın önerdiği kargo firmaları dışında kendi belirlediği bir taşıyıcı ile gönderim talep etmesi hâlinde, malın taşıyıcıya teslim edilmesiyle risk ALICI'ya geçer.",
          "ALICI, {{SITE_URL}} üzerindeki üyelik hesabının kullanıcı adı ve şifresinin gizliliğinden bizzat sorumludur. Şifreler geri döndürülemez biçimde (bcrypt algoritması ile) özetlenerek saklanır ve SATICI dâhil hiç kimse tarafından açık metin olarak görüntülenemez. ALICI, hesabına yetkisiz erişim şüphesi duyduğunda derhâl şifresini değiştirmeli ve {{EMAIL}} adresine bildirimde bulunmalıdır.",
          "ALICI, Site'yi ve çevrimiçi mağazayı yalnızca hukuka uygun amaçlarla kullanacağını; otomatik veri toplama araçları (bot, crawler, scraper) ile sisteme yük bindirmeyeceğini, sahte sipariş oluşturmayacağını, promosyon kodlarını kötüye kullanmayacağını ve üçüncü kişilerin haklarını ihlal etmeyeceğini kabul eder. Bu yükümlülüğün ihlali hâlinde SATICI, ilgili hesabı askıya alma ve doğan zararlarını talep etme hakkını saklı tutar.",
          "Taraflar arasındaki tüm elektronik yazışmalar, sipariş kayıtları, ödeme işlem kayıtları, sunucu ve erişim kayıtları (log), onay kutucuğu kayıtları ile yönetici işlemlerine ilişkin değiştirilemez olay kayıtları (audit log), 6100 sayılı Hukuk Muhakemeleri Kanunu'nun delil sözleşmesine ilişkin hükmü uyarınca Taraflar arasında kesin ve bağlayıcı delil niteliğindedir.",
          "İşbu Sözleşme'nin herhangi bir hükmünün kısmen veya tamamen geçersiz sayılması, diğer hükümlerin geçerliliğini etkilemez; geçersiz hüküm, Tarafların ortak amacına en yakın ve mevzuata uygun bir hükümle ikame edilmiş sayılır. Tüketici mevzuatının emredici hükümlerine aykırı düşen, tüketici aleyhine haksız şart niteliğindeki hükümler ise hiçbir hâlde uygulanmaz ve yazılmamış sayılır."
        ]
      },
      {
        "heading": "7. Ödeme Şekli, Sanal POS ve 3D Secure",
        "paragraphs": [
          "Site üzerinden verilen siparişlerin bedeli, SATICI'nın anlaşmalı olduğu banka veya 6493 sayılı Kanun kapsamında faaliyet gösteren yetkili ödeme kuruluşunun sanal POS altyapısı üzerinden, kredi kartı veya banka kartı ile çevrimiçi olarak tahsil edilir. SATICI, ödeme altyapısını sağlayıcıdan bağımsız bir soyutlama katmanı üzerinden yürütür; sağlayıcı değişikliği hâlinde ödeme sayfasında güncel sağlayıcı bilgisi gösterilir.",
          "Kart bilgileri (kart numarası, son kullanma tarihi, CVV/CVC güvenlik kodu) hiçbir aşamada SATICI'nın sunucularında, veri tabanında veya kayıt sistemlerinde tutulmaz, işlenmez ve saklanmaz. Bu bilgiler doğrudan PCI-DSS sertifikalı ödeme altyapısına, uçtan uca şifreli bağlantı üzerinden iletilir. SATICI'ya yalnızca işlemin sonucu (başarılı/başarısız), maskelenmiş kart numarasının son dört hanesi, kart şeması, taksit sayısı ve sağlayıcı işlem referansı döner.",
          "Kart ile yapılan ödemelerde, ilgili bankanın ve kart şemasının desteklediği ölçüde 3D Secure doğrulaması uygulanır. 3D Secure adımında ALICI, kartını veren bankanın ekranına yönlendirilir ve doğrulama bankanın kendi sistemi üzerinden gerçekleştirilir. Doğrulamanın başarısız olması hâlinde işlem tamamlanmaz ve sipariş oluşmaz.",
          "Ödeme sonucunun SATICI sistemine bildirimi, ödeme kuruluşunun sunucu-sunucu bildirimi (webhook) ile yapılır. Bu bildirimler HMAC-SHA256 imza doğrulaması ile kontrol edilir; imzası geçersiz bildirimler reddedilir. Aynı işlem referansına ait mükerrer bildirimler benzersizlik kısıtı ile engellenerek çift tahsilat ve çift sipariş oluşumu önlenir (idempotens).",
          "Bazı işlemlerde banka tarafından ön provizyon (blokaj) uygulanabilir. Ön provizyon, tutarın kart limitinden geçici olarak ayrılmasıdır ve tahsilat anlamına gelmez. Sipariş iptal edilirse ön provizyon çözülür; bloke tutarın kart hesabına yansıma süresi tamamen ilgili bankanın iç işleyişine bağlıdır ve bu süreden SATICI sorumlu tutulamaz.",
          "Taksitli ödeme imkânı, ALICI'nın kartını veren bankanın kampanya ve politikalarına bağlıdır. Taksit sayısına göre bankaca uygulanan vade farkı, komisyon veya ek masraflar ALICI ile bankası arasındaki kart sözleşmesinin konusu olup, ödeme sayfasında gösterilen taksitli toplam tutar bu farkı içerebilir. Bankaların düzenlediği ek taksit, erteleme, puan, mil ve benzeri kampanyaların yürütücüsü ilgili banka olup, bu kampanyalardan doğan uyuşmazlıklarda muhatap ALICI'nın bankasıdır.",
          "Havale veya EFT ile ödeme seçeneğinin sunulduğu hâllerde, ödemeye ilişkin banka ve hesap bilgileri sipariş adımında ve Sipariş Onayı e-postasında ALICI'ya bildirilir. Açıklama alanına sipariş numarasının yazılmaması nedeniyle eşleştirilemeyen ödemelerden kaynaklanan gecikmelerden SATICI sorumlu değildir.",
          "İade işlemleri, tahsilatın yapıldığı ödeme yöntemi üzerinden ve aynı karta yapılır. SATICI'nın iade talimatını ödeme kuruluşuna iletmesinden sonra tutarın ALICI'nın kart ekstresine veya hesabına yansıma süresi banka süreçlerine bağlıdır; SATICI bu bankasal yansıma süresinden sorumlu tutulamaz. SATICI, kendi yükümlülüğü olan iade talimatını mevzuatta öngörülen 14 (on dört) günlük süre içinde vermekle yükümlüdür.",
          "ALICI'nın bankası nezdinde ödeme itirazı (chargeback) başlatması hâlinde SATICI, sipariş kaydı, onay kutucuğu kayıtları (tarih, IP, tarayıcı bilgisi, belge sürümü), kargo takip ve teslim kayıtları ile yazışma kayıtlarını ilgili banka veya ödeme kuruluşuna delil olarak sunar. İtiraz süreci ALICI'nın Kanun'dan doğan cayma ve ayıplı mal haklarını kullanmasına engel değildir; ancak aynı bedelin hem chargeback hem de doğrudan iade yoluyla mükerrer olarak iadesi hâlinde SATICI'nın sebepsiz zenginleşme hükümlerine dayalı talep hakkı saklıdır."
        ]
      },
      {
        "heading": "8. Fatura ve Belgelendirme",
        "paragraphs": [
          "SATICI, 213 sayılı Vergi Usul Kanunu ve ilgili tebliğler uyarınca her sipariş için elektronik arşiv (e-Arşiv) fatura düzenler. Fatura, sipariş sırasında ALICI'nın beyan ettiği fatura bilgileri esas alınarak tanzim edilir.",
          "Fatura, siparişin onaylanmasını takiben ALICI'nın kayıtlı e-posta adresine elektronik ortamda gönderilir ve ayrıca ALICI'nın üyelik hesabındaki sipariş detay sayfasından indirilebilir. ALICI, e-Arşiv faturanın elektronik ortamda iletilmesine ve kâğıt nüsha gönderilmemesine muvafakat eder; talep etmesi hâlinde faturanın kâğıt çıktısı da gönderilir.",
          "Kurumsal (tüzel kişi) fatura talebinde ALICI; ticaret unvanı, vergi dairesi ve vergi kimlik numarası bilgilerini sipariş anında eksiksiz beyan etmekle yükümlüdür. Fatura kesildikten sonra vergi mükellefiyet bilgisi değişikliği talepleri, mevzuatın izin verdiği ölçüde ve ancak fatura iptali/yeniden düzenleme prosedürü çerçevesinde karşılanabilir.",
          "Cayma hakkının kullanılması veya iade hâlinde, kurumsal faturalı satışlarda ALICI'nın iade faturası düzenlemesi gerekir. Bireysel (nihai tüketici) satışlarda ise ürünle birlikte gönderilen fatura nüshasının üzerindeki iade bölümünün doldurulup imzalanarak ürünle beraber SATICI'ya iletilmesi gerekir; e-Arşiv fatura hâllerinde SATICI, iade işlemini kendi sistemlerinde belgelendirir ve ALICI'dan ek bir belge talep etmez.",
          "Faturanın ALICI'ya ulaşmaması veya kaybolması hâlinde ALICI, {{EMAIL}} adresine yapacağı talep ile faturanın yeniden gönderilmesini isteyebilir. SATICI, mevzuatta öngörülen saklama süreleri boyunca fatura kayıtlarını muhafaza eder."
        ]
      },
      {
        "heading": "9. Teslimat, Kargo ve Teslim Şartları",
        "paragraphs": [
          "Sözleşme konusu mal, ALICI'nın sipariş sırasında bildirdiği teslimat adresine, SATICI'nın anlaşmalı kargo firmaları aracılığıyla teslim edilir. Teslimat, siparişin kurulmasından itibaren yasal 30 (otuz) günlük azami süreyi aşmamak kaydıyla, ürün sayfasında ve sipariş özetinde belirtilen tahmini süre içinde gerçekleştirilir.",
          "Sipariş, ödemenin onaylandığı iş günü içinde hazırlanmaya başlanır. Hafta sonu, resmî tatil ve dinî bayram günlerinde kargo firmalarının çalışma takvimine bağlı olarak teslimat süreleri uzayabilir; bu günler tahmini teslim süresi hesabında dikkate alınmaz.",
          "Gıda niteliğindeki ürünler (kavrulmuş kahve çekirdeği, yenilebilir waffle kupa, gelato kiti, pistacchio kreması, şuruplar ve benzeri kiler ürünleri) tazelik ve gıda güvenliği gözetilerek, uygun ambalaj ve gerektiğinde yalıtımlı taşıma çözümleriyle sevk edilir. Sıcaklığa duyarlı ürünlerde SATICI, mevsim ve destinasyon koşullarına göre sevkiyat gününü ALICI'yı bilgilendirerek belirleyebilir.",
          "ALICI'ya, kargo firmasına teslim anında kargo takip numarası e-posta ile bildirilir. ALICI, bu numara ile gönderisinin durumunu ilgili kargo firmasının sisteminden takip edebilir.",
          "Kargo firmasının adreste bulunamama nedeniyle bıraktığı bildirime rağmen ALICI'nın malı ilgili şubeden mevzuatta ve kargo firmasının kurallarında öngörülen bekleme süresi içinde teslim almaması ve gönderinin SATICI'ya iade dönmesi hâlinde, ALICI ile iletişime geçilir. Yeniden gönderim talep edilmesi durumunda ikinci gönderim bedeli ALICI'ya aittir. ALICI'nın yeniden gönderim istememesi hâlinde sipariş iptal edilerek mal bedeli iade edilir.",
          "SATICI, aynı siparişte yer alan ürünleri tedarik ve stok durumuna göre birden fazla parça hâlinde ayrı ayrı sevk edebilir. Kısmi sevkiyat hâlinde ALICI'dan ek kargo bedeli talep edilmez ve her parti için ayrı kargo takip numarası bildirilir.",
          "Teslimat adresinin Türkiye Cumhuriyeti sınırları dışında olması hâlinde, varış ülkesinde doğabilecek gümrük vergileri, harçlar, ithalat kısıtlamaları ve benzeri yükümlülükler ALICI'nın sorumluluğundadır. Gıda ürünlerinin bazı ülkelere girişinin yasak veya izne tabi olması nedeniyle gümrükte imha veya iade edilmesi hâlinde SATICI sorumlu tutulamaz."
        ],
        "table": [
          {
            "key": "Türkiye Geneli",
            "value": "Yurtiçi Kargo"
          },
          {
            "key": "KKTC ve Yurt Dışı",
            "value": "Aras Kargo"
          },
          {
            "key": "İstanbul İçi Hızlı Teslimat",
            "value": "Motokurye - 89 TL"
          },
          {
            "key": "Kargo Ücreti (500 TL altı)",
            "value": "39 TL"
          },
          {
            "key": "Kargo Ücreti (500 TL ve üzeri)",
            "value": "Ücretsiz"
          },
          {
            "key": "Yasal Azami Teslim Süresi",
            "value": "30 (otuz) gün"
          }
        ]
      },
      {
        "heading": "10. Cayma Hakkı",
        "paragraphs": [
          "ALICI, hiçbir hukuki ve cezai sorumluluk üstlenmeksizin ve hiçbir gerekçe göstermeksizin, malı teslim aldığı tarihten itibaren 14 (on dört) gün içinde Sözleşme'den cayma hakkına sahiptir. Cayma hakkı, Mesafeli Sözleşmeler Yönetmeliği'nin cayma hakkına ilişkin hükümleri uyarınca kullanılır.",
          "Sürenin başlangıcı bakımından; tek sipariş konusu olup ayrı ayrı teslim edilen mallarda son malın, birden fazla parçadan oluşan mallarda son parçanın, belirli bir süre boyunca düzenli teslimatı yapılan mallarda ise ilk malın teslim alındığı gün esas alınır. Cayma süresinin son gününün resmî tatile denk gelmesi hâlinde süre, takip eden ilk iş günü mesai bitiminde sona erer.",
          "SATICI, ALICI'nın cayma hakkını kullandığına ilişkin bildirimin kendisine ulaştığı tarihten itibaren 14 (on dört) gün içinde, teslimat masrafları da dâhil olmak üzere tahsil ettiği tüm ödemeleri, ALICI'nın satın alırken kullandığı ödeme aracına uygun bir şekilde ve ALICI'ya herhangi bir masraf veya yükümlülük getirmeksizin tek seferde iade eder.",
          "ALICI, cayma hakkını kullandığına ilişkin bildirimi yönelttiği tarihten itibaren 10 (on) gün içinde malı SATICI'ya veya SATICI'nın yetkilendirdiği kişiye geri göndermekle yükümlüdür.",
          "Cayma hakkının kullanılması hâlinde iade gönderiminin, Ön Bilgilendirme Formu'nda belirtilen anlaşmalı kargo firması ile yapılması hâlinde iade kargo bedeli SATICI tarafından karşılanır. ALICI'nın iadeyi anlaşmalı kargo firması dışında bir taşıyıcı ile göndermesi hâlinde iade masrafı ALICI'ya ait olur ve SATICI bu masrafı üstlenmekle yükümlü tutulamaz.",
          "ALICI, cayma süresi içinde malı, işleyişine, teknik özelliklerine ve kullanım talimatlarına uygun bir şekilde kullanmakla yükümlüdür. Bu çerçevede yapılan olağan muayene ve deneme sınırlarının aşılması sonucu malın değerinde meydana gelen değişiklikten ALICI sorumludur. Malın olağan kullanımı sonucu oluşan değer kaybı ise ALICI'ya yüklenemez.",
          "İade edilen mal; kutusu, ambalajı, varsa standart aksesuarları, hediye ürünleri ve fatura nüshası ile birlikte, eksiksiz ve hasarsız olarak gönderilmelidir. Promosyon veya kampanya kapsamında verilen hediye ürünün iade edilmemesi hâlinde, hediyenin güncel liste bedeli iade tutarından mahsup edilebilir.",
          "Kampanya eşiğine (örneğin ücretsiz kargo limitine) bağlı olarak yapılan alışverişlerde kısmi iade sonucu sepet tutarının eşiğin altına düşmesi hâlinde, kampanya kapsamında karşılanmış olan kargo bedeli iade tutarından mahsup edilebilir. Bu husus sipariş öncesinde Ön Bilgilendirme Formu'nda ALICI'ya bildirilir."
        ],
        "bullets": [
          "Cayma bildirimi, cayma süresi dolmadan önce açık ve anlaşılır bir şekilde SATICI'ya yöneltilmelidir.",
          "Bildirim, {{SITE_URL}} adresindeki üyelik hesabı içinde yer alan sipariş detay sayfasındaki iade talebi formu ile yapılabilir.",
          "Bildirim, {{EMAIL}} adresine gönderilecek bir elektronik posta ile yapılabilir.",
          "Bildirim, {{ADDRESS}} adresine gönderilecek yazılı bir beyanla (iadeli taahhütlü posta dâhil) yapılabilir.",
          "Bildirim, {{PHONE}} numarası aranarak sözlü olarak iletilebilir; bu hâlde SATICI, talebi kayıt altına alarak ALICI'ya yazılı teyit gönderir.",
          "Cayma hakkının kullanılması için Ön Bilgilendirme Formu ekindeki örnek cayma formunun kullanılması zorunlu değildir; ALICI cayma iradesini serbest metinle de açıklayabilir.",
          "SATICI, cayma bildiriminin kendisine ulaştığını ALICI'ya gecikmeksizin teyit eder."
        ]
      },
      {
        "heading": "11. Cayma Hakkının Kullanılamayacağı Haller",
        "paragraphs": [
          "Mesafeli Sözleşmeler Yönetmeliği'nin cayma hakkının istisnalarını düzenleyen hükümleri uyarınca, aşağıda sayılan ürün ve işlemlerde ALICI cayma hakkını kullanamaz. Bu istisnalar, ALICI'nın ayıplı mala ilişkin haklarını hiçbir şekilde ortadan kaldırmaz; ayıplı çıkan üründe ALICI her hâlükârda 6502 sayılı Kanun'un kendisine tanıdığı seçimlik haklara sahiptir."
        ],
        "bullets": [
          "Fiyatı finansal piyasalardaki dalgalanmalara bağlı olarak değişen ve SATICI'nın kontrolünde olmayan mal veya hizmetlere ilişkin sözleşmeler.",
          "ALICI'nın istekleri veya kişisel ihtiyaçları doğrultusunda hazırlanan mallar; örneğin ALICI'nın talebiyle özel öğütüm derecesinde hazırlanan kahve, isim/mesaj baskılı fincan, önlük veya tote çanta gibi kişiselleştirilmiş ürünler.",
          "Çabuk bozulabilen veya son kullanma tarihi geçebilecek mallar; örneğin gelato kiti bileşenleri, taze kavrulmuş kahve ve soğuk zincir gerektiren ürünler.",
          "Tesliminden sonra ambalaj, bant, mühür veya paket gibi koruyucu unsurları açılmış olan mallardan, iadesi sağlık ve hijyen açısından uygun olmayanlar; örneğin ağzı açılmış kahve paketleri, açılmış pistacchio kreması ve şurup şişeleri, ambalajı açılmış yenilebilir waffle kupa.",
          "Tesliminden sonra başka ürünlerle karışan ve doğası gereği ayrıştırılması mümkün olmayan mallar.",
          "Malın tesliminden sonra ambalajın açılmış olması hâlinde maddi ortamda sunulan dijital içerikler ile ses veya görüntü kayıtları, kitaplar ve yazılım programları.",
          "Belirli bir tarihte veya dönemde yapılması gereken, konaklama, eşya taşıma, araba kiralama, yiyecek-içecek tedariki ve eğlence veya dinlenme amacıyla yapılan boş zamanın değerlendirilmesine ilişkin sözleşmeler; örneğin belirli bir tarihe ait kafe rezervasyonu, tadım etkinliği veya barista atölyesi biletleri.",
          "Cayma hakkı süresi sona ermeden önce, ALICI'nın onayı ile ifasına başlanan hizmetlere ilişkin sözleşmeler.",
          "Elektronik ortamda anında ifa edilen hizmetler ile ALICI'ya anında teslim edilen gayrimaddi mallar; örneğin e-posta ile anında iletilen dijital hediye çeki kodları."
        ]
      },
      {
        "heading": "12. Temerrüt Hükümleri ve Hukuki Sonuçları",
        "paragraphs": [
          "ALICI'nın kredi kartı ile yapmış olduğu işlemlerde temerrüde düşmesi hâlinde, kart sahibi ALICI ile kartı veren banka arasındaki kredi kartı sözleşmesi çerçevesinde faiz ve temerrüt faizi ödeyeceğini kabul eder. Bu durumda ilgili banka hukuki yollara başvurabilir; doğacak masraf ve avukatlık ücretini ALICI'dan talep edebilir. SATICI, ALICI ile bankası arasındaki bu ilişkinin tarafı değildir.",
          "ALICI'nın borcundan dolayı temerrüde düşmesi hâlinde, SATICI'nın 6098 sayılı Türk Borçlar Kanunu'nun temerrüde ilişkin hükümleri (özellikle m.117 ve devamı) çerçevesindeki hakları saklıdır. SATICI, borcun ifasını isteyebileceği gibi, uygun bir süre vererek Sözleşme'den dönme hakkını da kullanabilir.",
          "SATICI'nın temerrüdü hâlinde ise ALICI, malın teslim edilmemesi nedeniyle Sözleşme'yi feshedebilir; bu hâlde SATICI, fesih bildiriminin kendisine ulaşmasından itibaren en geç 14 (on dört) gün içinde tahsil ettiği tüm ödemeleri ve varsa ALICI'yı borç altına sokan belgeleri iade eder. SATICI'nın kendi temerrüdünden doğan sorumluluğu, tüketici mevzuatının emredici hükümleri saklı kalmak kaydıyla, hiçbir şekilde sınırlandırılamaz veya bertaraf edilemez.",
          "İade edilmesi gereken tutarların yasal süre içinde iade edilmemesi hâlinde, gecikilen süre için ilgili mevzuatta öngörülen kanuni faiz uygulanır.",
          "Tarafların temerrüde ilişkin bu hükümleri, ALICI'nın tüketici sıfatıyla sahip olduğu haklardan feragat ettiği anlamına gelmez; tüketicinin yasal haklarını sınırlayan veya ortadan kaldıran her türlü yorum geçersizdir."
        ]
      },
      {
        "heading": "13. Ayıplı Mal ve Tüketicinin Seçimlik Hakları",
        "paragraphs": [
          "Teslim edilen malın, taraflarca kararlaştırılmış olan örnek ya da modele uygun olmaması, objektif olarak sahip olması gereken özellikleri taşımaması, ambalajında, etiketinde, tanıtma ve kullanma kılavuzunda yer alan veya SATICI tarafından bildirilen niteliklere aykırı olması hâlinde mal ayıplı sayılır. Reklam ve ilanlarda yer alan özellikler de bu kapsamda değerlendirilir.",
          "Malın ayıplı olması hâlinde ALICI, 6502 sayılı Tüketicinin Korunması Hakkında Kanun uyarınca aşağıdaki seçimlik haklardan birini kullanmakta serbesttir. ALICI'nın bu haklardan hangisini kullanacağı kendi tercihine bağlıdır ve SATICI bu tercihi sınırlayamaz.",
          "ALICI'nın ücretsiz onarım veya malın ayıpsız misli ile değiştirilmesi taleplerinin, SATICI'ya iletilmesinden itibaren azami otuz iş günü içinde yerine getirilmesi zorunludur. Bu süre içinde talebin karşılanmaması hâlinde ALICI, diğer seçimlik haklarını kullanabilir.",
          "Ayıplı maldan sorumluluk, malın ALICI'ya teslim tarihinden itibaren mevzuatta öngörülen zamanaşımı süresi boyunca devam eder. Ayıbın gizlenmesi veya ağır kusur ya da hile ile gizlenmiş olması hâlinde zamanaşımı süresi uygulanmaz.",
          "Gıda ürünlerinde, ambalajda beyan edilen son kullanma veya tavsiye edilen tüketim tarihinin, teslim anında makul bir tüketim süresine imkân vermeyecek kadar yakın olması hâlinde ALICI, ürünü ayıplı sayarak seçimlik haklarını kullanabilir. SATICI, gıda ürünlerini son kullanma tarihine makul süre bulunacak şekilde sevk etmeyi taahhüt eder.",
          "Ambalajı hasarlı, içeriği eksik veya siparişten farklı ürün teslim alınması hâlinde ALICI, durumu teslim tarihinden itibaren makul süre içinde {{EMAIL}} adresine bildirmelidir. SATICI, incelemesini yaparak ürünün ayıpsız misli ile değiştirilmesi veya bedel iadesi yönünde çözüm sunar ve bu hâllerde iade kargo bedelini üstlenir."
        ],
        "ordered": [
          "Satılanı geri vermeye hazır olduğunu bildirerek sözleşmeden dönme, yani satış bedelinin iadesini isteme hakkı.",
          "Satılanı alıkoyup ayıp oranında satış bedelinden indirim isteme hakkı.",
          "Aşırı bir masraf gerektirmediği takdirde, bütün masrafları SATICI'ya ait olmak üzere satılanın ücretsiz onarılmasını isteme hakkı.",
          "İmkân varsa, satılanın ayıpsız bir misli ile değiştirilmesini isteme hakkı."
        ]
      },
      {
        "heading": "14. Gıda Güvenliği, Alerjen Bilgisi ve Ürün Kullanımı",
        "paragraphs": [
          "SATICI'nın çevrimiçi mağazasında satışa sunulan gıda ürünleri, 5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu ile Türk Gıda Kodeksi mevzuatına uygun şekilde tedarik edilir, ambalajlanır ve etiketlenir.",
          "Ürün etiketlerinde ve ürün detay sayfalarında; içindekiler listesi, alerjen uyarıları, net miktar, üretim ve son kullanma tarihi ile saklama koşulları Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği'ne uygun olarak yer alır.",
          "Gluten, süt ve süt ürünleri, yumurta, sert kabuklu meyveler (fındık, badem, antep fıstığı vb.), soya ve benzeri alerjen içerebilecek ürünlerde ilgili uyarılar ürün sayfasında belirtilir. Aynı üretim ve paketleme hattında alerjen içeren ürünlerin işlenmesi nedeniyle çapraz bulaşma ihtimali bulunabileceği hususu ürün sayfasında ayrıca bildirilir. Gıda alerjisi veya intoleransı bulunan ALICI'ların satın alma öncesinde ürün etiketini ve ürün sayfasındaki bilgileri dikkatle incelemeleri önemle tavsiye olunur.",
          "Yenilebilir waffle kupa, gelato kiti ve benzeri ürünler, ambalajında belirtilen saklama sıcaklığı ve tüketim talimatlarına uygun kullanılmalıdır. Ambalajında belirtilen saklama koşullarına aykırı muhafaza edilen ürünlerde meydana gelen bozulmadan SATICI sorumlu tutulamaz.",
          "Kahve ekipmanı (moka pot, değirmen, tamper vb.) ürünleri, beraberinde gönderilen kullanım kılavuzuna ve üretici talimatlarına uygun kullanılmalıdır. Kullanım hatasından, amacı dışında kullanımdan veya yetkisiz müdahaleden kaynaklanan arızalar garanti kapsamı dışındadır.",
          "SATICI, hiçbir ürününde 4207 sayılı Tütün Ürünlerinin Zararlarının Önlenmesi ve Kontrolü Hakkında Kanun kapsamına giren tütün ve tütün mamulü satışı yapmaz; ayrıca çevrimiçi mağaza üzerinden alkollü içecek satışı gerçekleştirilmez.",
          "SATICI'nın ürünlerine ilişkin Site'de yer alan tat notları, aroma tarifleri ve kullanım önerileri bilgilendirme amaçlıdır; sağlık beyanı, tıbbi tavsiye veya tedavi edici etki iddiası içermez."
        ]
      },
      {
        "heading": "15. Kişisel Verilerin İşlenmesi ve Ticari Elektronik İleti",
        "paragraphs": [
          "SATICI, işbu Sözleşme'nin kurulması ve ifası kapsamında elde ettiği kişisel verileri, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun genel ilkelere ilişkin hükmü (m.4) ve işleme şartlarına ilişkin hükümleri (m.5 ve m.6) çerçevesinde, hukuka ve dürüstlük kurallarına uygun, doğru ve gerektiğinde güncel, belirli, açık ve meşru amaçlar için, işlendikleri amaçla bağlantılı, sınırlı ve ölçülü olarak işler. Bu kapsamda SATICI veri sorumlusu sıfatını haizdir.",
          "Sipariş sürecinde işlenen kişisel veriler; kimlik (ad-soyad), iletişim (e-posta, telefon, teslimat ve fatura adresi), müşteri işlem (sipariş içeriği, tutar, sipariş geçmişi, iade ve talep kayıtları), finans (maskelenmiş kart bilgisi, işlem referansı, tahsilat kaydı) ve işlem güvenliği (IP adresi, tarayıcı bilgisi, oturum kayıtları, onay kayıtları) kategorilerindedir. Bu verilerin işlenmesi, sözleşmenin kurulması ve ifası ile SATICI'nın hukuki yükümlülüklerini yerine getirmesi hukuki sebeplerine dayanır.",
          "Kişisel veriler; kargo ve lojistik hizmet sağlayıcılarına (teslimat amacıyla), banka ve ödeme kuruluşlarına (tahsilat, iade ve itiraz süreçleri amacıyla), e-fatura ve muhasebe hizmet sağlayıcılarına (yasal yükümlülük amacıyla), işlemsel e-posta altyapı sağlayıcısına (sipariş bildirimleri amacıyla) ile yetkili kamu kurum ve kuruluşlarına, mevzuatta öngörülen sınırlar dâhilinde aktarılabilir.",
          "Barındırma, veri tabanı ve e-posta gönderim altyapılarının sunucularının yurt dışında bulunması nedeniyle kişisel veriler yurt dışına aktarılabilir. Bu aktarımlar, 6698 sayılı Kanun'un yurt dışına aktarıma ilişkin hükmü (m.9) uyarınca öngörülen şartlar sağlanarak gerçekleştirilir.",
          "Veri güvenliği bakımından SATICI, 6698 sayılı Kanun'un veri güvenliğine ilişkin hükmü (m.12) uyarınca idari ve teknik tedbirler alır: şifreler geri döndürülemez biçimde özetlenir (bcrypt), yönetici erişimi TOTP tabanlı iki aşamalı doğrulama ile korunur, veri tabanında satır düzeyi güvenlik (RLS) politikaları uygulanır, tüm yönetici mutasyonları değiştirilemez olay kaydına (audit log) yazılır ve veriye erişim yetki matrisi ile sınırlandırılır.",
          "ALICI, 6698 sayılı Kanun'un ilgili kişinin haklarını düzenleyen hükmü (m.11) kapsamındaki taleplerini, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'de öngörülen usule uygun olarak {{EMAIL}} adresine veya {{ADDRESS}} adresine iletebilir. SATICI, başvuruları niteliğine göre en kısa sürede ve en geç 30 (otuz) gün içinde ücretsiz olarak sonuçlandırır.",
          "Kişisel veriler, ilgili mevzuatta öngörülen veya işlendikleri amaç için gerekli olan süre kadar muhafaza edilir; sürenin sona ermesiyle Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik hükümleri uyarınca silinir, yok edilir veya anonim hâle getirilir.",
          "SATICI, 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ile Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik uyarınca, ALICI'ya ticari elektronik ileti göndermeden önce onayını alır ve bu onayı İleti Yönetim Sistemi'ne (İYS) kaydeder. Sipariş onayı, kargo bildirimi, iade bilgilendirmesi, fatura iletimi ve benzeri işlemsel iletiler ticari elektronik ileti kapsamında olmayıp, onaydan bağımsız olarak gönderilir. ALICI, ticari elektronik ileti almayı her zaman ve ücretsiz olarak reddedebilir.",
          "Kişisel verilerin işlenmesine ilişkin ayrıntılı bilgi, SATICI'nın {{SITE_URL}} adresinde yayımlanan Aydınlatma Metni, Gizlilik Politikası, Çerez Politikası ve Kişisel Verilerin Korunması ve İşlenmesi Politikası'nda yer almaktadır. İşbu Sözleşme, anılan belgelerin yerine geçmez; onları tamamlar.",
          "SATICI, 5651 sayılı Kanun kapsamında yer sağlayıcı yükümlülüklerine uygun olarak trafik ve erişim kayıtlarını mevzuatta öngörülen süre boyunca tutar ve yetkili mercilerin talebi hâlinde ilgili mevzuat çerçevesinde paylaşır."
        ]
      },
      {
        "heading": "16. Fikri ve Sınai Mülkiyet Hakları",
        "paragraphs": [
          "{{SITE_URL}} adresinde yer alan tüm tasarım, metin, görsel, illüstrasyon, fotoğraf, video, ikon, yazılım kodu, veri tabanı yapısı, ürün açıklamaları ve marka hikâyesi içerikleri üzerindeki tüm fikri haklar, 5846 sayılı Fikir ve Sanat Eserleri Kanunu kapsamında korunmakta olup {{LEGAL_NAME}}'ne veya usulüne uygun lisans verenlere aittir.",
          "{{BRAND}} markası, logosu, ambalaj tasarımları ve ayırt edici işaretleri 6769 sayılı Sınai Mülkiyet Kanunu kapsamında korunmaktadır. Bu işaretlerin SATICI'nın önceden yazılı izni olmaksızın kullanılması, çoğaltılması, taklit edilmesi veya karıştırılmaya yol açacak şekilde kullanılması yasaktır.",
          "ALICI, Site'deki içerikleri yalnızca kişisel ve ticari olmayan amaçlarla görüntüleyebilir. İçeriklerin kopyalanması, çoğaltılması, yeniden yayımlanması, işlenmesi, dağıtılması, otomatik araçlarla toplanması (scraping) veya ticari amaçla kullanılması SATICI'nın yazılı izni olmaksızın mümkün değildir.",
          "ALICI'nın ürün değerlendirmesi, yorum, fotoğraf veya video şeklinde Site'ye veya SATICI'nın {{HANDLE}} kullanıcı adlı sosyal medya hesaplarına gönderdiği içerikler bakımından ALICI, bu içerikleri SATICI'nın tanıtım amacıyla kullanmasına, çoğaltmasına ve yayımlamasına münhasır olmayan bir kullanım izni verdiğini kabul eder. ALICI bu izni dilediği zaman {{EMAIL}} adresine bildirimde bulunarak geri alabilir.",
          "Malın satın alınması, ALICI'ya yalnızca o malın mülkiyetini kazandırır; ürün üzerindeki marka, tasarım veya diğer sınai haklar üzerinde ALICI'ya herhangi bir hak devri anlamına gelmez."
        ]
      },
      {
        "heading": "17. Mücbir Sebep",
        "paragraphs": [
          "Sözleşme'nin imzalandığı tarihte mevcut olmayan veya öngörülemeyen, Tarafların kontrolleri dışında gelişen, ortaya çıkmasıyla Taraflardan birinin ya da her ikisinin de Sözleşme ile yüklendikleri borç ve sorumluluklarını kısmen veya tamamen yerine getirmelerini imkânsızlaştıran hâller mücbir sebep olarak kabul edilir.",
          "Mücbir sebebin devamı süresince Tarafların edimlerini yerine getirememesi temerrüt sayılmaz ve bu nedenle herhangi bir tazminat sorumluluğu doğmaz.",
          "Mücbir sebebe maruz kalan Taraf, durumu öğrendiği tarihten itibaren 3 (üç) gün içinde diğer Tarafa yazılı olarak veya kalıcı veri saklayıcısı ile bildirmekle yükümlüdür.",
          "Mücbir sebep hâlinin 30 (otuz) günden uzun sürmesi hâlinde, Taraflardan her biri Sözleşme'yi tek taraflı olarak feshedebilir. Bu hâlde SATICI, tahsil ettiği bedeli fesih tarihinden itibaren en geç 14 (on dört) gün içinde ALICI'ya iade eder.",
          "Mücbir sebep hâlinin varlığı, SATICI'yı ALICI'dan tahsil ettiği bedeli iade etme yükümlülüğünden kurtarmaz."
        ],
        "bullets": [
          "Doğal afetler: deprem, sel, yangın, fırtına, salgın hastalık ve pandemi ilanları.",
          "Savaş, seferberlik, terör olayları, iç karışıklık ve genel grev.",
          "Yetkili mercilerin karar veya uygulamaları: ithalat-ihracat yasakları, gümrük kısıtlamaları, sokağa çıkma yasakları, kamu düzenine ilişkin tedbirler.",
          "Ulaşım ve lojistik altyapısının kesintiye uğraması, kargo firmalarının faaliyetlerinin durması.",
          "Elektrik, iletişim veya internet altyapısında ülke çapında yaşanan uzun süreli kesintiler, siber saldırılar ve barındırma sağlayıcısı kaynaklı yaygın hizmet kesintileri.",
          "Tedarik zincirinde SATICI'nın kontrolü dışında oluşan ve öngörülemeyen hammadde temin edilememesi hâlleri."
        ]
      },
      {
        "heading": "18. Şikâyet, Uyuşmazlık Çözümü ve Tüketici Hakem Heyeti",
        "paragraphs": [
          "ALICI, siparişine ilişkin her türlü soru, talep ve şikâyetini öncelikle {{EMAIL}} adresine veya {{PHONE}} numarasına iletebilir. SATICI, kendisine ulaşan başvuruları kayıt altına alır ve makul süre içinde sonuçlandırarak ALICI'yı bilgilendirir. Bu aşama zorunlu bir dava şartı olmayıp, ALICI'nın doğrudan yasal başvuru yollarına gitmesine engel değildir.",
          "İşbu Sözleşme'den doğan uyuşmazlıklarda ALICI, Ticaret Bakanlığınca her yıl Aralık ayında yeniden değerleme oranına göre belirlenen ve ilan edilen parasal sınırlar dâhilinde, kendi yerleşim yerinin bulunduğu veya tüketici işleminin yapıldığı yerdeki Tüketici Hakem Heyetine başvurabilir.",
          "Anılan parasal sınırların üzerindeki uyuşmazlıklarda ALICI, Tüketici Mahkemelerine; tüketici mahkemesi bulunmayan yerlerde ise Asliye Hukuk Mahkemelerine (tüketici mahkemesi sıfatıyla) başvurabilir. ALICI'nın kendi yerleşim yeri mahkemesinde dava açma hakkı saklıdır.",
          "Güncel parasal sınırlara ve başvuru usullerine ilişkin bilgilere Ticaret Bakanlığının resmî internet sitesi ile Tüketici Bilgi Sistemi (TÜBİS) üzerinden ulaşılabilir. Tüketici Hakem Heyetine başvurular e-Devlet üzerinden de yapılabilmektedir.",
          "SATICI, tüketici hakem heyeti ve mahkeme süreçlerinde ALICI'ya ait sipariş, ödeme, teslimat ve onay kayıtlarını talep hâlinde ilgili mercie sunar.",
          "Uyuşmazlığın taraflarca sulh yoluyla veya arabuluculuk kurumu aracılığıyla çözümlenmesi hususunda Tarafların anlaşma hakkı saklı olup, bu yollara başvurulması ALICI'nın tüketici hakem heyetine veya tüketici mahkemesine başvurma hakkını ortadan kaldırmaz."
        ]
      },
      {
        "heading": "19. Delil Sözleşmesi ve Kayıtların İspat Gücü",
        "paragraphs": [
          "Taraflar, işbu Sözleşme'den doğabilecek her türlü uyuşmazlıkta, SATICI'nın kendi bilgi işlem sistemlerinde ve veri tabanında tuttuğu elektronik kayıtların, 6100 sayılı Hukuk Muhakemeleri Kanunu'nun delil sözleşmesini düzenleyen 193. maddesi uyarınca kesin ve bağlayıcı delil teşkil edeceğini kabul ederler.",
          "Bu delil sözleşmesi, ALICI'nın tüketici sıfatıyla sahip olduğu ispat kolaylıklarını ve kendi delillerini sunma hakkını ortadan kaldırmaz; ALICI her türlü delili ileri sürmekte serbesttir. Söz konusu elektronik kayıtların manipüle edildiğine veya hatalı olduğuna dair ALICI tarafından ileri sürülen iddiaların aksinin ispatı imkânı saklıdır.",
          "SATICI, kayıtların bütünlüğünü sağlamak amacıyla yönetici tarafından yapılan tüm veri değişikliklerini, işlemi yapan kullanıcı, işlem türü, tarih-saat ve değişiklik içeriği ile birlikte değiştirilemez (append-only) olay kaydına yazar. Bu kayıtlar silinemez ve geriye dönük değiştirilemez."
        ],
        "bullets": [
          "Sipariş kaydı: sipariş numarası, kalem bazında ürün, adet, birim fiyat, indirim ve toplam tutar.",
          "Elektronik onay kaydı: Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi onay tarihi ve saati, IP adresi, tarayıcı ve cihaz bilgisi, onaylanan belge sürüm numarası.",
          "Ödeme kaydı: ödeme kuruluşu işlem referansı, maskelenmiş kart bilgisi, taksit sayısı, işlem sonucu ve varsa iade işlem kaydı.",
          "İletişim kaydı: sipariş onayı, kargo bildirimi, fatura iletimi ve iade bilgilendirmesi gibi işlemsel e-posta gönderim kayıtları.",
          "Teslimat kaydı: kargo firması, gönderi takip numarası, teslim tarihi ve teslim alan bilgisi.",
          "Sistem kayıtları: sunucu erişim ve olay günlükleri ile yönetici mutasyonlarına ilişkin değiştirilemez olay kaydı (audit log)."
        ]
      },
      {
        "heading": "20. Yürürlük, Elektronik Onay ve Sözleşme Sürümü",
        "paragraphs": [
          "İşbu Sözleşme, yukarıda yer alan 20 (yirmi) maddeden ibaret olup, ALICI tarafından ödeme adımında elektronik ortamda ayrı bir onay kutucuğu işaretlenmek suretiyle okunup kabul edildikten ve ödemenin başarıyla tamamlanmasının ardından yürürlüğe girmiştir.",
          "Sözleşme'nin bir örneği, Ön Bilgilendirme Formu ve sipariş özeti ile birlikte kalıcı veri saklayıcısı niteliğindeki e-posta yoluyla ALICI'ya iletilir. ALICI, dilediği zaman {{SITE_URL}} adresindeki üyelik hesabından sipariş detay sayfası üzerinden Sözleşme'nin kendi siparişine ait sürümüne erişebilir, görüntüleyebilir ve indirebilir.",
          "SATICI, mevzuat değişiklikleri veya ticari uygulamalarındaki güncellemeler nedeniyle işbu Sözleşme metninde değişiklik yapma hakkını saklı tutar. Ancak yapılan değişiklikler geriye etkili değildir; her sipariş bakımından, siparişin verildiği anda yürürlükte olan ve ALICI tarafından onaylanan sürüm bağlayıcıdır. Bu nedenle her sipariş kaydında onaylanan belge sürüm numarası ayrıca saklanır.",
          "Sözleşme metninin güncel hâli her zaman {{SITE_URL}} adresinde kamuya açık ve ücretsiz olarak erişilebilir durumda tutulur. SATICI, 6102 sayılı Türk Ticaret Kanunu'nun internet sitesine ilişkin düzenlemeleri ile 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik kapsamında bilgi verme yükümlülüklerini Site üzerinden yerine getirir.",
          "İşbu Sözleşme Türkçe olarak düzenlenmiştir. Farklı bir dilde çeviri sunulması hâlinde, çeviri ile Türkçe metin arasında çelişki bulunursa Türkçe metin esas alınır.",
          "İşbu Sözleşme'nin uygulanmasında Türk hukuku uygulanır. ALICI ve SATICI, Sözleşme'nin tüm hükümlerini okuduklarını, anladıklarını ve serbest iradeleriyle kabul ettiklerini beyan ederler."
        ],
        "table": [
          {
            "key": "Belge Adı",
            "value": "Mesafeli Satış Sözleşmesi"
          },
          {
            "key": "Belge Sahibi",
            "value": "{{LEGAL_NAME}} ({{BRAND}})"
          },
          {
            "key": "Yayım Adresi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Onay Yöntemi",
            "value": "Ödeme adımında ayrı onay kutucuğu (varsayılan işaretsiz)"
          },
          {
            "key": "Saklanan Onay Verileri",
            "value": "Onay tarihi ve saati, IP adresi, tarayıcı/cihaz bilgisi, üyelik hesabı kimliği, belge sürüm numarası"
          },
          {
            "key": "İletim Yöntemi",
            "value": "Kalıcı veri saklayıcısı (e-posta) ve üyelik hesabı sipariş detay sayfası"
          },
          {
            "key": "İletişim",
            "value": "{{EMAIL}} - {{PHONE}}"
          }
        ]
      }
    ]
  },
  {
    "slug": "iade-ve-cayma",
    "title": "İptal, İade ve Cayma Hakkı",
    "shortTitle": "İade ve Cayma",
    "category": "Sipariş",
    "summary": "Mesafeli Sözleşmeler Yönetmeliği kapsamında {{SITE}} üzerinden verilen siparişlerin iptali, 14 günlük cayma hakkının kullanımı, ürün iadesi, geri ödeme süreleri ve cayma hakkının istisnalarının adım adım açıklandığı uygulama belgesidir.",
    "references": [
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
      "Mesafeli Sözleşmeler Yönetmeliği (Resmî Gazete: 27.11.2014, Sayı: 29188) — m.5 ön bilgilendirme yükümlülüğü, m.9 cayma hakkı, m.12 cayma bildirimi, m.15 cayma hakkının istisnaları",
      "6098 sayılı Türk Borçlar Kanunu — m.117 temerrüt",
      "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun",
      "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik",
      "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İleti Yönetim Sistemi — İYS)",
      "5464 sayılı Banka Kartları ve Kredi Kartları Kanunu",
      "6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun",
      "6698 sayılı Kişisel Verilerin Korunması Kanunu — m.4 genel ilkeler, m.5-6 işleme şartları, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliği",
      "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ",
      "Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik",
      "5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu",
      "Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği",
      "213 sayılı Vergi Usul Kanunu",
      "6102 sayılı Türk Ticaret Kanunu — m.1524 internet sitesi yükümlülüğü",
      "5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun",
      "6100 sayılı Hukuk Muhakemeleri Kanunu — m.193 delil sözleşmesi",
      "5846 sayılı Fikir ve Sanat Eserleri Kanunu",
      "6769 sayılı Sınai Mülkiyet Kanunu"
    ],
    "sections": [
      {
        "heading": "1. Belgenin Amacı, Kapsamı ve Tanımlar",
        "paragraphs": [
          "Bu belge, {{BRAND}} markasıyla {{SITE_URL}} adresinde işletilen çevrimiçi mağaza (bottega) üzerinden kurulan mesafeli satış sözleşmelerinde siparişin iptali, cayma hakkının kullanılması, ürünün iadesi ve bedelin geri ödenmesi süreçlerini adım adım düzenler. Amaç, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ile Mesafeli Sözleşmeler Yönetmeliği'nin tüketiciye tanıdığı hakların, tüketicinin ek bir hukuki yardıma ihtiyaç duymadan uygulayabileceği somut bir prosedüre dönüştürülmesidir.",
          "Belge, Satıcı ile Alıcı arasındaki mesafeli satış sözleşmesinin ve Ön Bilgilendirme Formu'nun ayrılmaz bir ekidir. Bu belgede yer alan hiçbir hüküm, tüketicinin 6502 sayılı Kanun ve ilgili mevzuattan doğan emredici haklarını sınırlandıracak, ortadan kaldıracak veya tüketiciyi bu haklarından feragat ettirecek biçimde yorumlanamaz. Bu belge ile mevzuat arasında bir çelişki bulunması hâlinde tüketici lehine olan hüküm uygulanır.",
          "Belgede geçen süreler aksi belirtilmedikçe takvim günü olarak hesaplanır. Sürenin son gününün resmî tatile denk gelmesi hâlinde süre, takip eden ilk iş günü sonunda dolar. Sürelerin başlangıcına ilişkin ispat yükü Satıcı'ya aittir."
        ],
        "bullets": [
          "Satıcı / Şirket: {{LEGAL_NAME}} (kısaca {{SHORT_NAME}}); {{BRAND}} markasının sahibi ve işleticisi olan tüzel kişi.",
          "Marka: {{BRAND}}; Satıcı'nın kahve ve gelato bar işletmesi ile çevrimiçi mağazasında kullandığı ticari ad.",
          "Site: {{SITE_URL}} adresinde yayımlanan internet sitesi ve buna bağlı çevrimiçi mağaza (bottega).",
          "Alıcı / Tüketici: Ticari veya mesleki olmayan amaçlarla hareket ederek Site üzerinden mal veya hizmet edinen gerçek ya da tüzel kişi.",
          "Sipariş: Alıcı'nın Site üzerinde sepetini onaylayıp ödeme adımını tamamlamasıyla oluşan ve benzersiz bir sipariş numarası ile kayıt altına alınan talep.",
          "Cayma Hakkı: Tüketicinin, mesafeli sözleşmelerde hiçbir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden dönme hakkı.",
          "İade Formu: Alıcı'nın cayma iradesini ve iade edeceği kalemleri bildirdiği, üye panelinden veya {{EMAIL}} adresine e-posta ile iletilebilen belge.",
          "Kalıcı Veri Saklayıcısı: Alıcı'ya gönderilen bilgiyi, bu bilginin amacına uygun süre boyunca değiştirilmeden saklamaya ve aynen çoğaltmaya elverişli ortam (e-posta, PDF, üye paneli kaydı).",
          "İade Onay Kodu: İade talebi Satıcı'ca kayda alındığında üretilen ve kargo paketinin üzerine yazılması gereken takip numarası."
        ]
      },
      {
        "heading": "2. Satıcı, İade Yetkilisi ve İletişim Bilgileri",
        "paragraphs": [
          "İptal, iade, cayma ve değişim taleplerinin tamamı aşağıdaki iletişim kanalları üzerinden karşılanır. Yazılı başvurular için tek ve resmî elektronik posta adresi {{EMAIL}}'dir; başka bir adrese yapılan bildirimler Satıcı'ya ulaşmış sayılmaz. Sosyal medya hesapları üzerinden iletilen mesajlar bilgilendirme amaçlıdır ve resmî cayma bildirimi yerine geçmez."
        ],
        "table": [
          {
            "key": "Ticaret unvanı",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Kısa unvan",
            "value": "{{SHORT_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Merkez ve iade adresi",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta (iade, iptal, müşteri hizmetleri)",
            "value": "{{EMAIL}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Vergi dairesi",
            "value": "{{TAX_OFFICE}}"
          },
          {
            "key": "Vergi kimlik numarası",
            "value": "{{TAX_NO}}"
          },
          {
            "key": "Vergi türü",
            "value": "{{TAX_TYPE}}"
          },
          {
            "key": "Faaliyet kodu (NACE)",
            "value": "{{NACE}}"
          },
          {
            "key": "Faaliyete başlama tarihi",
            "value": "{{STARTED_AT}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil numarası",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "Banka",
            "value": "{{BANK}}"
          },
          {
            "key": "IBAN",
            "value": "{{IBAN}}"
          },
          {
            "key": "Instagram",
            "value": "{{IG}} ({{HANDLE}})"
          },
          {
            "key": "TikTok",
            "value": "{{TIKTOK}} ({{HANDLE}})"
          },
          {
            "key": "YouTube",
            "value": "{{YOUTUBE}} ({{HANDLE}})"
          }
        ]
      },
      {
        "heading": "3. Sipariş İptali: Kargoya Verilmeden Önce",
        "paragraphs": [
          "Cayma hakkından ayrı olarak, siparişiniz henüz kargoya teslim edilmemişse basit bir iptal talebiyle süreci sonlandırabilirsiniz. İptal, ürünün geri gönderilmesini gerektirmediği için hem sizin hem Satıcı'nın lehine olan en hızlı çözümdür ve iade kargo masrafı doğurmaz.",
          "Siparişinizin bulunduğu aşamayı üye panelinizdeki sipariş detay ekranından görebilirsiniz. Sistem, siparişi Ödeme Bekliyor, Ödendi, Hazırlanıyor, Kargoya Verildi, Tamamlandı, İptal Edildi ve İade Edildi durumlarından biriyle etiketler. İptal talebi, sipariş Kargoya Verildi durumuna geçmeden önce iletildiğinde koşulsuz kabul edilir.",
          "Sipariş kargoya verildikten sonra iptal talebi teknik olarak işleme alınamaz; bu aşamadan sonra bu belgenin 4. ve 5. maddelerinde düzenlenen cayma hakkı prosedürü uygulanır. Kargodaki gönderiyi teslim almayı reddetmeniz hâlinde ürün Satıcı'ya iade edilir ve talebiniz cayma bildirimi olarak değerlendirilir."
        ],
        "ordered": [
          "Üye hesabınıza giriş yapıp Siparişlerim bölümünden ilgili siparişi açın ve mevcut sipariş durumunu kontrol edin.",
          "Sipariş durumu Ödeme Bekliyor, Ödendi veya Hazırlanıyor ise sipariş detay ekranındaki iptal talebi seçeneğini kullanın; bu seçenek yoksa {{EMAIL}} adresine sipariş numaranızı yazarak iptal talebinizi iletin.",
          "İptalin tamamını mı yoksa yalnızca belirli kalemleri mi istediğinizi belirtin; kısmi iptalde iptal edilmeyen kalemler için sipariş normal akışında devam eder.",
          "Talebiniz aynı iş günü içinde, mesai saatleri dışında iletilmişse takip eden ilk iş günü içinde incelenir ve sonucu e-posta ile bildirilir.",
          "İptal onaylandığında sipariş İptal Edildi durumuna alınır, tahsil edilen tutarın tamamı için ödeme kuruluşuna iade talimatı verilir ve varsa düşülen stok geri yüklenir.",
          "Kullandığınız promosyon kodu, tam iptal hâlinde tek kullanımlık değilse hesabınıza yeniden tanımlanır; tek kullanımlık kampanya kodlarında yerine eşdeğer bir kod tanımlanır.",
          "Ödeme henüz ön provizyon aşamasındaysa provizyon serbest bırakılır; bu durumda kartınızdan tahsilat gerçekleşmemiş olur ve bloke tutar bankanızın sürecine göre çözülür."
        ]
      },
      {
        "heading": "4. Cayma Hakkı: Süre ve Sürenin Başlangıç Anı",
        "paragraphs": [
          "Mesafeli Sözleşmeler Yönetmeliği'nin cayma hakkını düzenleyen 9. maddesi uyarınca tüketici, hiçbir gerekçe göstermeksizin ve cezai şart ödemeksizin on dört (14) gün içinde sözleşmeden cayma hakkına sahiptir. Cayma hakkının kullanılması için Satıcı'ya bu süre içinde bildirimde bulunulması yeterlidir; ürünün 14 gün içinde iade edilmiş olması aranmaz.",
          "Satıcı, cayma hakkına ilişkin bilgilendirme yükümlülüğünü gereği gibi yerine getirmezse tüketici cayma hakkını kullanmak için 14 günlük süreyle bağlı değildir. Bu süre, mevzuatta öngörüldüğü şekilde uzar ve gerekli bilgilendirmenin yapıldığı tarihten itibaren yeniden işlemeye başlar."
        ],
        "bullets": [
          "Tek parça mal alımında süre, malın Alıcı'ya veya Alıcı'nın bildirdiği üçüncü kişiye teslim edildiği gün başlar. Örnek: tek başına sipariş edilen bir moka pot için süre, kuryenin teslimatı gerçekleştirdiği gün işlemeye başlar.",
          "Birden fazla kalemin ayrı ayrı teslim edildiği siparişlerde süre, son ürünün teslim alındığı gün başlar. Örnek: kavrulmuş kahve çekirdeği ile el değirmeninin ayrı kolilerde ve farklı günlerde ulaştığı bir siparişte süre, ikinci kolinin teslim edildiği gün başlar.",
          "Birden fazla parçadan oluşan ve parçaları ayrı gönderilen tek bir ürün söz konusu ise süre, son parçanın teslim alındığı gün başlar. Örnek: gövdesi ve seramik aparatı ayrı gönderilen bir gelato kiti.",
          "Belirli bir süre boyunca düzenli teslimat yapılan aboneliklerde süre, ilk teslimatın yapıldığı gün başlar. Örnek: aylık kahve çekirdeği aboneliğinde ilk paketin teslim tarihi.",
          "Hizmet sunumuna ilişkin sözleşmelerde süre, sözleşmenin kurulduğu gün başlar.",
          "Sipariş ödemesi alındıktan sonra ancak henüz teslimat gerçekleşmeden de cayma hakkı kullanılabilir; bu hâlde ürün gönderilmez ve bedel iade edilir."
        ]
      },
      {
        "heading": "5. Cayma Hakkının Kullanılması: Adım Adım Prosedür",
        "paragraphs": [
          "Cayma bildirimi için özel bir şekil şartı yoktur; yazılı olarak veya kalıcı veri saklayıcısı ile Satıcı'ya iletilmiş olması yeterlidir. Aşağıdaki adımlar, sürecin en hızlı ve izlenebilir biçimde tamamlanmasını sağlamak için tanımlanmıştır ve tüketicinin serbest biçimde bildirim yapma hakkını sınırlamaz."
        ],
        "ordered": [
          "Cayma iradenizi 14 günlük süre içinde Satıcı'ya iletin. Bunun için üye panelinizdeki Siparişlerim ekranından ilgili siparişi açıp iade talebi oluşturabilir veya {{EMAIL}} adresine e-posta gönderebilirsiniz. Dilerseniz {{PHONE}} numarasını arayarak yönlendirme alabilirsiniz; ancak telefonla yapılan görüşme tek başına yazılı bildirim yerine geçmediğinden görüşme sonunda bildiriminizi e-posta ile teyit etmenizi öneririz.",
          "Bildiriminizde bu belgenin 6. maddesinde sayılan bilgileri eksiksiz iletin. Eksik bilgi hâlinde Satıcı sizinle iletişime geçer; bilgi eksikliği cayma hakkının kullanıldığı tarihi geriye almaz, bildiriminizin Satıcı'ya ulaştığı tarih esas alınır.",
          "Bildiriminizi aldığımıza dair otomatik teyit e-postasını bekleyin. Bu e-posta, talebinize atanan İade Onay Kodu'nu, iade adresini ve anlaşmalı kargo firmasının gönderi kodunu içerir. Teyit e-postası en geç bir iş günü içinde iletilir; ulaşmaması hâlinde e-postanızın istenmeyen klasörünü kontrol edip {{EMAIL}} adresine yazın.",
          "Ürünü iade için hazırlayın. Ürünü, aksesuarlarını, hediye olarak gönderilen tamamlayıcı kalemlerini, kullanım kılavuzunu, garanti belgesini ve varsa orijinal kutusunu eksiksiz biçimde toplayın. Orijinal kutu ambalajın kendisi ürünün bir parçası olduğundan üzerine kargo bandı yapıştırmayın, üzerine yazı yazmayın.",
          "Paketleme yapın. Ürünü, taşıma sırasında zarar görmeyecek biçimde dış koli içine yerleştirin; cam fincan, cezve ve seramik kalemler için dolgu malzemesi kullanın. Fatura veya e-arşiv fatura çıktısı ile doldurduğunuz İade Formu'nu paketin içine koyun ve İade Onay Kodu'nu kolinin dışına okunaklı biçimde yazın.",
          "Kargoya verin. Türkiye içi gönderiler için Yurtiçi Kargo, KKTC ve yurt dışı gönderiler için Aras Kargo anlaşmalı taşıyıcılarımızdır. Teyit e-postasındaki gönderi kodu ile en yakın şubeden ücretsiz gönderim yapabilirsiniz; İstanbul içi teslimatlarda motokurye ile geri alım talep edebilirsiniz. İade masrafının kime ait olduğu bu belgenin 9. maddesinde düzenlenmiştir.",
          "Ürünü, cayma bildirimini gönderdiğiniz tarihten itibaren on (10) gün içinde kargoya verin. Bu süre içinde gönderim yapılmaması hâlinde cayma hakkı kullanılmamış sayılabilir; gecikme kaçınılmaz ise durumu {{EMAIL}} adresine bildirin.",
          "Gönderi takip numaranızı saklayın ve dilerseniz {{EMAIL}} adresine iletin. Kargonun Satıcı'ya ulaşmasına kadar geçen sürede taşıyıcıdan kaynaklanan sorunlarda takip numarası ile hızlıca çözüm üretilir.",
          "Ürün tarafımıza ulaştıktan sonra en geç iki iş günü içinde inceleme yapılır ve sonucu e-posta ile bildirilir. Kabul edilen iadelerde geri ödeme, bu belgenin 10. maddesindeki usule göre başlatılır.",
          "Geri ödemenin kartınıza veya hesabınıza yansımasını takip edin; öngörülen sürede yansımaması hâlinde işlem tarihi ve sipariş numaranızla {{EMAIL}} adresine yazın."
        ]
      },
      {
        "heading": "6. İade Formunda ve Cayma Bildiriminde Yer Alması Gereken Bilgiler",
        "paragraphs": [
          "Aşağıdaki bilgiler, iade talebinizin doğru siparişle eşleştirilmesi ve geri ödemenin gecikmeden başlatılabilmesi için gereklidir. Bilgilerin bir kısmının eksik olması talebinizi geçersiz kılmaz; yalnızca işlem süresini uzatabilir.",
          "İade Formu'nun hazır sürümüne üye panelinizdeki sipariş detay ekranından ulaşabilir, çıktı alarak doldurabilir veya aynı bilgileri düz metin hâlinde e-posta gövdesine yazabilirsiniz."
        ],
        "bullets": [
          "Sipariş numarası ve sipariş tarihi.",
          "Alıcı adı, soyadı ve sipariş sırasında kullandığınız e-posta adresi.",
          "İletişim telefonu (kargo ve geri alım koordinasyonu için).",
          "İade edilecek ürünlerin adı, varsa varyant bilgisi (öğütüm derecesi, boyut, renk) ve adedi.",
          "Cayma iradesinin açık beyanı: gerekçe belirtmek zorunlu değildir, ancak ürün geliştirme için isteğe bağlı bir iade nedeni seçebilirsiniz.",
          "Talebin türü: bedel iadesi mi, aynı ürünle değişim mi, farklı varyantla değişim mi istendiği.",
          "Ürünün teslim alındığı tarih (kargo teslim tarihi).",
          "Ayıp, hasar veya yanlış ürün iddiası varsa durumu gösteren fotoğraflar ve varsa kargo hasar tespit tutanağının bir örneği.",
          "Ödeme havale veya EFT ile yapılmışsa geri ödemenin yapılacağı banka hesabına ait IBAN ve hesap sahibinin adı soyadı; hesap sahibinin sipariş sahibiyle aynı kişi olması zorunludur.",
          "Kredi veya banka kartı ile yapılan ödemelerde banka hesabı bilgisi istenmez; iade her hâlde ödemenin yapıldığı karta yapılır."
        ]
      },
      {
        "heading": "7. Cayma Hakkının Kullanılamayacağı Ürün ve Hizmetler",
        "paragraphs": [
          "Mesafeli Sözleşmeler Yönetmeliği'nin cayma hakkının istisnalarını düzenleyen 15. maddesi uyarınca, niteliği gereği iadesi mümkün olmayan bazı ürün ve hizmetlerde cayma hakkı kullanılamaz. Aşağıdaki liste, {{BRAND}} ürün gamı için bu istisnaların somutlaştırılmış hâlidir ve sipariş öncesinde Ön Bilgilendirme Formu ile ayrıca dikkatinize sunulur.",
          "Bu istisnalar yalnızca cayma hakkına ilişkindir. Ürünün ayıplı, bozuk, yanlış veya eksik gönderilmiş olması hâlinde tüketicinin 6502 sayılı Kanun'dan doğan seçimlik hakları her hâlükârda saklıdır ve aşağıdaki listedeki hiçbir kalem bu hakları ortadan kaldırmaz."
        ],
        "bullets": [
          "Çabuk bozulabilen veya son kullanma tarihi geçebilecek gıda ürünleri. Örnek: taze üretim gelato ve gelato kitinin soğuk zincirle gönderilen bileşenleri, kısa raf ömürlü taze pistacchio kreması partileri, günlük üretim pasticceria kalemleri.",
          "Tesliminden sonra ambalajı, bandı, mührü veya koruyucu folyosu açılmış olan, sağlık ve hijyen açısından iadesi uygun olmayan ürünler. Örnek: mührü açılmış pistacchio kreması kavanozu, kapağı açılmış şurup şişesi, koruyucu bandı sökülmüş kahve çekirdeği paketi.",
          "Doğrudan tüketime yönelik olarak üretilen ve tekrar satışa sunulması gıda güvenliği bakımından mümkün olmayan yenilebilir ürünler. Örnek: yenilebilir waffle kupa (edible cup) setleri; ambalajı açılmamış olsa dahi taşıma koşulları doğrulanamadığından ambalaj bütünlüğü bozulmuş gönderiler.",
          "Tüketicinin istekleri veya kişisel ihtiyaçları doğrultusunda hazırlanan, kişiye özel üretilen ürünler. Örnek: üzerine isim veya tarih işlenmiş fincan ve önlük, özel harman talebiyle kavrulan ve talep edilen inceliğe göre öğütülen kahve, hediye paketine özel mesaj baskısı yapılan setler.",
          "Belirli bir tarihte veya dönemde yapılması gereken, konaklama, yiyecek-içecek tedariki ve eğlence amaçlı hizmetler. Örnek: köşkte belirli gün ve saate ayrılan masa rezervasyonu, tarihli barista atölyesi veya tadım etkinliği katılım biletleri.",
          "Fiyatı finansal piyasalardaki dalgalanmalara bağlı olarak değişen ve Satıcı'nın kontrolünde olmayan mal veya hizmetler.",
          "Elektronik ortamda anında ifa edilen ve tüketiciye anında teslim edilen gayrimaddi ürünler. Örnek: satın alma sonrası indirme bağlantısı açılan dijital demleme rehberi veya e-hediye çeki kodunun görüntülenmiş olması.",
          "Cayma hakkı süresi içinde ifasına tüketicinin onayı ile başlanan hizmetler. Örnek: talebiniz üzerine kişiselleştirilerek kavrum programına alınmış özel sipariş partisi."
        ]
      },
      {
        "heading": "8. İade Edilen Ürünün Durumu ve Satılabilirlik Ölçütü",
        "paragraphs": [
          "Tüketici, cayma süresi içinde malı, işleyişine, teknik özelliklerine ve kullanım talimatlarına uygun bir şekilde kullandığı takdirde meydana gelen değişiklik ve bozulmalardan sorumlu değildir. Bir ürünün niteliğini, özelliklerini ve çalışma biçimini anlamak amacıyla makul ölçüde denenmesi kullanım sayılmaz; mağazada yapılabilecek türden bir inceleme her zaman serbesttir.",
          "Buna karşılık, ürünün makul deneme sınırını aşacak biçimde kullanılması sonucunda değerinde bir azalma meydana gelmişse Satıcı, bu değer azalmasını geri ödemeden mahsup etme hakkını saklı tutar. Mahsup yapılan hâllerde mahsubun gerekçesi, dayandığı tespit ve tutarın hesaplanma yöntemi Alıcı'ya yazılı olarak bildirilir; Alıcı bu bildirime itiraz edebilir.",
          "Satılabilirlik ölçütü şu şekilde uygulanır: ürün, kalite kontrolden geçtikten sonra yeni ürün olarak yeniden satışa sunulabilecek durumda ise iade koşulsuz kabul edilir. Yeniden satışa uygun olmayan hâllerde durum fotoğraflarla belgelenerek Alıcı'ya bildirilir."
        ],
        "bullets": [
          "Kabul edilir: kutusu dikkatlice açılmış, denenmiş ancak kullanılmamış ekipman (moka pot, tamper, el değirmeni); ambalajı açılmamış kahve çekirdeği; etiketleri sökülmemiş tekstil ürünleri (önlük, tote çanta).",
          "Kabul edilir: ürünün doğru olup olmadığını anlamak için kısa süre denenen ve üzerinde iz bırakmayan seramik veya cam kalemler.",
          "Kabul edilmez: demleme yapılmış, içinde kahve tortusu, su izi veya kireç kalıntısı bulunan ekipman.",
          "Kabul edilmez: öğütülmüş, ambalajı açılmış veya bir kısmı tüketilmiş kahve çekirdeği paketi.",
          "Kabul edilmez: yıkanmış, ütülenmiş, kullanılmış veya üzerinde koku, leke ya da evcil hayvan tüyü bulunan tekstil ürünleri.",
          "Kabul edilmez: kırık, çizik, ezik veya eksik parçalı olarak gönderilen ürünler; ancak hasarın taşıma sırasında oluştuğu kargo tutanağı ile belgelenirse bu madde uygulanmaz ve 14. madde devreye girer.",
          "Kısmi kabul: setin bir kalemi kullanılmış, diğerleri kullanılmamışsa kullanılmayan kalemlerin bedeli iade edilir; set indirimi uygulanmışsa iade tutarı, kalan kalemlerin liste fiyatı esas alınarak yeniden hesaplanır ve hesaplama Alıcı'ya gösterilir."
        ]
      },
      {
        "heading": "9. İade Kargo Masrafının Kime Ait Olduğu",
        "paragraphs": [
          "Cayma hakkının kullanılmasında iade masrafının kime ait olacağı, Ön Bilgilendirme Formu'nda açıkça belirtilmiştir. {{BRAND}}, iadelerin anlaşmalı taşıyıcı üzerinden yapılması hâlinde masrafı doğrudan üstlenir; Alıcı'nın kargo şubesinde peşin ödeme yapmasına gerek yoktur.",
          "Alıcı'nın anlaşmalı taşıyıcı dışında bir firmayı tercih etmesi hâlinde gönderim bedeli Alıcı tarafından karşılanır ve bu tutar, anlaşmalı taşıyıcı tarifesini aşan kısmı bakımından Satıcı'dan talep edilemez. Ayıplı, yanlış veya eksik ürün gönderimlerinde ise hangi taşıyıcı kullanılırsa kullanılsın masrafın tamamı Satıcı'ya aittir ve belgelenmesi hâlinde Alıcı'ya geri ödenir.",
          "Karşı ödemeli (gönderi bedeli alıcıya ait) olarak gönderilen ve önceden mutabık kalınmayan iadeler teslim alınmayabilir; bu hâlde Alıcı ile iletişime geçilerek çözüm üretilir ve bu durum tek başına iade talebinin reddi anlamına gelmez."
        ],
        "table": [
          {
            "key": "Cayma hakkı — anlaşmalı taşıyıcı ile iade",
            "value": "Masraf Satıcı'ya aittir; gönderi kodu ile ücretsiz gönderilir."
          },
          {
            "key": "Cayma hakkı — anlaşmalı olmayan taşıyıcı ile iade",
            "value": "Masraf Alıcı'ya aittir."
          },
          {
            "key": "Ayıplı, bozuk veya kusurlu ürün",
            "value": "Gidiş-dönüş tüm taşıma ve montaj masrafları Satıcı'ya aittir."
          },
          {
            "key": "Yanlış ürün veya yanlış varyant gönderimi",
            "value": "Tüm masraflar Satıcı'ya aittir; doğru ürün ek ücretsiz gönderilir."
          },
          {
            "key": "Eksik gönderim (kalem veya aksesuar eksiği)",
            "value": "Eksik kalem masrafsız tamamlanır; iade istenirse masraf Satıcı'ya aittir."
          },
          {
            "key": "Kargoda hasar (tutanaklı)",
            "value": "Tüm masraflar Satıcı'ya aittir; ürün yenisiyle değiştirilir veya bedel iade edilir."
          },
          {
            "key": "Değişim talebi — Alıcı kaynaklı (beden, varyant, fikir değişikliği)",
            "value": "İlk gönderi masrafı Satıcı'ya, iade gönderisi anlaşmalı taşıyıcı ile ücretsizdir; yeni ürünün sevkiyatı ücretsiz yapılır."
          },
          {
            "key": "İstanbul içi motokurye ile geri alım",
            "value": "Cayma hâlinde Satıcı karşılar; Alıcı'nın adreste bulunmaması nedeniyle tekrarlanan geri alımlarda ek çıkış bedeli Alıcı'ya yansıtılabilir."
          },
          {
            "key": "KKTC ve yurt dışı iadeleri",
            "value": "Anlaşmalı taşıyıcı üzerinden Satıcı karşılar; gümrük vergi ve harçları ilgili ülke mevzuatına tabidir."
          }
        ]
      },
      {
        "heading": "10. Geri Ödeme: Kanal Bazında Süreler ve Usul",
        "paragraphs": [
          "Cayma bildiriminizin Satıcı'ya ulaştığı tarihten itibaren on dört (14) gün içinde, teslimat masrafları da dâhil olmak üzere tahsil edilen toplam bedelin tamamı iade edilir. Geri ödeme, ödemenin yapıldığı kanala ve ödeme aracına uygun şekilde, Alıcı'ya hiçbir masraf yüklenmeksizin tek seferde gerçekleştirilir.",
          "Satıcı, geri ödemeyi ödeme kuruluşuna 14 günlük süre içinde talimatlandırmakla yükümlüdür. Tutarın kart hesabına veya banka hesabına fiilen yansıması, ilgili bankanın ve kart kuruluşunun kendi işlem takvimine bağlıdır ve Satıcı'nın kontrolü dışındadır. Kredi kartına yapılan iadelerde bankaların iadeyi karta yansıtma süresi uygulamada genellikle 7-10 iş günü sürer; bazı bankalarda tutar, bir sonraki ekstre döneminde görünür hâle gelir.",
          "Taksitli işlemlerde bankalar iade tutarını, işlemin taksit sayısına bağlı olarak aynı sayıda taksit hâlinde karta yansıtabilir. Bu, bankanın kendi uygulamasından kaynaklanır ve Satıcı, tutarın tamamını tek seferde ödeme kuruluşuna aktarmakla yükümlülüğünü yerine getirmiş sayılır. Ön provizyon aşamasındaki işlemlerde tahsilat yapılmadığından iade değil, provizyon iptali uygulanır ve bloke tutar bankanızın sürecine göre çözülür."
        ],
        "table": [
          {
            "key": "Kredi kartı (tek çekim)",
            "value": "İade aynı karta yapılır; Satıcı 14 gün içinde talimatlandırır, bankanın karta yansıtma süresi genellikle 7-10 iş günüdür."
          },
          {
            "key": "Kredi kartı (taksitli)",
            "value": "İade aynı karta yapılır; banka tutarı taksitler hâlinde yansıtabilir, toplam tutar değişmez."
          },
          {
            "key": "Banka kartı",
            "value": "İade karta bağlı hesaba yapılır; bankaya göre 7-10 iş günü içinde hesaba geçer."
          },
          {
            "key": "Havale / EFT",
            "value": "İade yalnızca sipariş sahibi ile aynı ada kayıtlı banka hesabına yapılır; farklı isimli hesaba ödeme yapılmaz. Hesap bilgisi tarafımıza ulaştıktan sonra 3 iş günü içinde gönderilir."
          },
          {
            "key": "Ön provizyon aşamasındaki işlem",
            "value": "Tahsilat yapılmadığından provizyon serbest bırakılır; bloke çözülme süresi bankaya bağlıdır."
          },
          {
            "key": "Hediye çeki / dijital kod ile ödenen kısım",
            "value": "Aynı tutarda ve kalan geçerlilik süresi korunarak yeni bir hediye çeki olarak hesabınıza tanımlanır; nakde çevrilmez."
          },
          {
            "key": "Promosyon kodu ile sağlanan indirim",
            "value": "İndirim tutarı ödenmiş bir bedel olmadığından nakden iade edilmez; iade, fiilen tahsil edilen tutar üzerinden yapılır."
          },
          {
            "key": "Kapıda ödeme (uygulanan siparişlerde)",
            "value": "İade, Alıcı ile aynı ada kayıtlı banka hesabına havale ile yapılır."
          },
          {
            "key": "Kısmi iade",
            "value": "İade edilen kalemlerin fiilen ödenen bedeli iade edilir; hesaplama 11. maddeye göre yapılır ve Alıcı'ya yazılı olarak gösterilir."
          }
        ]
      },
      {
        "heading": "11. Kısmi İade, Ücretsiz Kargo Eşiği ve Promosyon Kodlarının Etkisi",
        "paragraphs": [
          "Bir siparişin yalnızca bir kısmını iade etmeniz mümkündür. Kısmi iadede geri ödenecek tutar, iade edilen kalemlerin sipariş anında fiilen ödenen bedelleri esas alınarak hesaplanır. Sepet geneline uygulanan bir indirim varsa, indirim kalemlerin ödenen bedelleri oranında dağıtılarak iade tutarı belirlenir; böylece hiçbir kalem indirimsiz fiyatı üzerinden iade edilmiş sayılmaz.",
          "Sipariş tutarı 500 TL ve üzerinde olduğu için kargo ücretsiz uygulanmış, kısmi iade sonrasında kalan sipariş tutarı bu eşiğin altına düşmüşse, ilk gönderiye ait 39 TL'lik standart kargo bedeli geri ödemeden mahsup edilebilir. Bu mahsup yalnızca Alıcı'nın kendi tercihiyle yaptığı cayma veya değişim taleplerinde uygulanır; ayıplı, yanlış, eksik veya hasarlı ürün nedeniyle yapılan iadelerde hiçbir şekilde uygulanmaz.",
          "Siparişin tamamının iade edilmesi hâlinde teslimat masrafı da dâhil tahsil edilen tutarın tamamı iade edilir ve kargo mahsubu yapılmaz. Tüm fiyatlar ve iade hesaplamaları KDV dâhil tutarlar üzerinden yapılır; ürünlere uygulanan KDV oranı %20'dir ve iade edilen tutar KDV'yi de kapsar."
        ],
        "bullets": [
          "Örnek: 620 TL tutarında, ücretsiz kargo eşiğini geçtiği için kargo bedeli alınmamış bir siparişte 260 TL'lik bir kalem iade edilirse kalan tutar 360 TL olur ve eşik bozulur; bu hâlde 39 TL kargo bedeli iade tutarından mahsup edilerek 221 TL geri ödenir.",
          "Örnek: Aynı siparişte iade nedeni ürünün ayıplı çıkması ise mahsup yapılmaz ve 260 TL'nin tamamı iade edilir.",
          "Sepete uygulanan yüzdesel promosyon kodlarında indirim, iade edilen kalemin payına düşen oranda geri ödemeden düşülür; kod hesabınızda kalan sipariş için geçerliliğini korur.",
          "Belirli bir sepet tutarına bağlı promosyon kodu, kısmi iade sonrası kalan tutar kod koşulunu artık sağlamıyorsa, koddan doğan indirim farkı geri ödemeden mahsup edilir ve hesaplama size gösterilir.",
          "Hediye olarak eklenen tamamlayıcı ürünler, iade nedeniyle kampanya koşulu ortadan kalkıyorsa iade paketine dâhil edilmelidir; gönderilmemesi hâlinde ürünün liste bedeli geri ödemeden mahsup edilebilir.",
          "İstanbul içi motokurye ile yapılan 89 TL'lik teslimatlarda tam iade hâlinde bu bedel de iade edilir; kısmi iadede teslimat fiilen gerçekleştiği için iade edilmez.",
          "Mahsup edilen her kalem geri ödeme bildiriminde ayrı satır olarak gösterilir; hesaplamaya itiraz etmek için {{EMAIL}} adresine yazabilirsiniz."
        ]
      },
      {
        "heading": "12. Ayıplı, Yanlış veya Eksik Ürün: Tüm Masraflar Satıcıda",
        "paragraphs": [
          "Teslim edilen ürünün ambalajında, etiketinde, tanıtma ve kullanma kılavuzunda ya da reklamlarında yer alan niteliklere aykırı olması, tüketicinin makul olarak beklediği faydaları azaltan veya ortadan kaldıran maddi, hukuki ya da ekonomik eksiklikler içermesi hâlinde ürün ayıplıdır. Ayıplı mal hâlinde 6502 sayılı Tüketicinin Korunması Hakkında Kanun'un tanıdığı seçimlik haklardan dilediğinizi kullanabilirsiniz.",
          "Ayıplı, yanlış veya eksik gönderim hâllerinde iade kargo bedeli, yeniden gönderim bedeli, gerekiyorsa kurulum ve sökme masrafları da dâhil olmak üzere tüm masraflar Satıcı'ya aittir. Bu hâllerde ürünün orijinal ambalajının bulunmaması veya ambalajın açılmış olması iade hakkınızı etkilemez.",
          "Yanlış ürün gönderimi veya sipariş kaleminin eksik teslimi tespit edildiğinde, doğru ürün stokta ise öncelikli sevkiyat kuyruğuna alınarak ek ücret alınmaksızın gönderilir; stokta yoksa bedelin tamamı iade edilir. Süreç boyunca hiçbir aşamada sizden ek ödeme talep edilmez."
        ],
        "bullets": [
          "Seçimlik hak: Satılanın ayıpsız bir misli ile değiştirilmesini isteme.",
          "Seçimlik hak: Ücretsiz onarım isteme (onarılabilir nitelikteki ekipman ürünlerinde).",
          "Seçimlik hak: Ayıp oranında bedel indirimi isteme.",
          "Seçimlik hak: Sözleşmeden dönerek ödenen bedelin iadesini isteme.",
          "Bildirim: Ayıbı fark ettiğinizde makul süre içinde {{EMAIL}} adresine bildirmeniz süreci hızlandırır; ancak bildirimde bulunmamış olmanız yasal haklarınızı ortadan kaldırmaz.",
          "Belgeleme: Ürünün ve varsa etiket ile parti numarasının fotoğrafı, gıda ürünlerinde ambalaj üzerindeki son tüketim tarihi görüntüsü değerlendirmeyi hızlandırır.",
          "Gıda güvenliği: Gıda ürünlerinde bozulma şüphesi varsa ürünü tüketmeyin, mümkünse üretim ve parti bilgisini koruyacak şekilde saklayın ve derhal bize bildirin.",
          "Ekspertiz: Ayıbın varlığına ilişkin uyuşmazlıklarda Satıcı, ürünü teknik incelemeye gönderebilir; inceleme süresi 5 iş gününü aşarsa bu süre size bildirilir ve talebiniz hâlinde bedel iadesi öne alınır."
        ]
      },
      {
        "heading": "13. Değişim (Ürün Takası) Süreci",
        "paragraphs": [
          "Değişim, mevzuattan doğan bir zorunluluk değil, {{BRAND}}'nun tüketiciye sunduğu ek bir kolaylıktır. Cayma hakkınızı kullanmak yerine, ürünü aynı ürünün farklı bir varyantıyla veya bedel farkını tamamlayarak başka bir ürünle değiştirmeyi tercih edebilirsiniz. Değişim talebinde bulunmanız, cayma hakkınızdan feragat ettiğiniz anlamına gelmez; süreç içinde her zaman bedel iadesine dönebilirsiniz.",
          "Değişim talepleri, cayma hakkı süresi olan 14 gün içinde iletilmelidir ve değişime konu ürünün bu belgenin 8. maddesindeki satılabilirlik ölçütünü karşılaması gerekir. Cayma hakkının kullanılamayacağı ürünlerde değişim de yalnızca ürünün ayıplı olması hâlinde mümkündür."
        ],
        "ordered": [
          "Üye panelinden veya {{EMAIL}} adresinden değişim talebi oluşturun; talep açıklamasında mevcut ürünü ve almak istediğiniz yeni ürün ile varyantını belirtin.",
          "Talebiniz incelenir ve yeni ürünün stok durumu teyit edilir. Stokta değilse tahmini tedarik süresi bildirilir; beklemek istemezseniz talebiniz bedel iadesine dönüştürülür.",
          "Bedel farkı hesaplanır. Yeni ürün daha pahalıysa aradaki fark için güvenli ödeme bağlantısı gönderilir; daha ucuzsa aradaki fark 10. maddedeki usule göre ödeme kanalınıza iade edilir.",
          "Değişime konu ürünü, İade Onay Kodu ile birlikte anlaşmalı taşıyıcıya teslim edin; Türkiye içi gönderilerde Yurtiçi Kargo, KKTC ve yurt dışı gönderilerde Aras Kargo kullanılır.",
          "Ürün tarafımıza ulaştıktan sonra iki iş günü içinde kalite kontrolü yapılır ve sonucu size bildirilir.",
          "Kontrol olumluysa yeni ürün, bedel farkı gerekiyorsa ödemenin alınmasının ardından aynı gün veya takip eden ilk iş günü kargoya verilir; yeni gönderi için sizden ilave kargo bedeli alınmaz.",
          "Ayıplı ürün nedeniyle yapılan değişimlerde bedel farkı, kalite kontrol ve kargo dâhil tüm süreç ücretsizdir ve ürün öncelikli sevkiyat kuyruğuna alınır.",
          "Değişim tamamlandığında sipariş kaydınıza yeni ürün bilgisi işlenir ve gerekiyorsa 213 sayılı Vergi Usul Kanunu uyarınca düzeltici belge düzenlenerek e-posta ile iletilir."
        ]
      },
      {
        "heading": "14. Hasarlı Teslimat ve Kargo Hasar Tespit Tutanağı: 24 Saat Kuralı",
        "paragraphs": [
          "Gönderiler taşıyıcıya sağlam, eksiksiz ve ambalajı kapalı biçimde teslim edilir. Teslim aldığınız kolinin ezik, yırtık, ıslak veya açılmış olması hâlinde ürünü kargo görevlisinin yanında kontrol etmenizi ve hasar tespit ettiğinizde tutanak tutturmanızı önemle öneririz. Tutanak, hasarın taşıma sırasında oluştuğunu gösteren en güçlü delildir ve süreci ciddi biçimde hızlandırır.",
          "Hasarlı ürünü teslim aldıysanız, durumu tercihen teslimattan itibaren 24 saat içinde {{EMAIL}} adresine bildirin. Bu 24 saatlik süre, hızlı çözüm ve taşıyıcı nezdinde tazminat sürecinin başlatılabilmesi için öngörülmüş operasyonel bir hedef süredir; hak düşürücü değildir. Bu süre içinde bildirim yapamamış olmanız, cayma hakkınızı veya ayıplı mala ilişkin yasal haklarınızı ortadan kaldırmaz.",
          "Hasar bildirimi kabul edildiğinde ürün masrafsız olarak yenisiyle değiştirilir; ürün stokta yoksa bedelin tamamı, teslimat masrafı dâhil olmak üzere iade edilir. Bu hâllerde iade kargo bedeli ve varsa ek masrafların tamamı Satıcı'ya aittir."
        ],
        "ordered": [
          "Teslimat sırasında kolinin dış görünümünü kontrol edin; ezik, yırtık, ıslaklık veya bant sökülmesi varsa kargo görevlisinden paketi birlikte açmasını isteyin.",
          "Ürün hasarlıysa teslim almayı reddedin veya kargo görevlisi ile birlikte hasar tespit tutanağı düzenletin; tutanağın bir nüshasını mutlaka alın.",
          "Tutanak düzenlenemediyse paketi ve ürünü açma anından itibaren fotoğraf ve mümkünse video ile belgeleyin; kargo etiketinin ve barkodun görüneceği kareler çekin.",
          "Tercihen 24 saat içinde {{EMAIL}} adresine sipariş numaranızı, tutanağı veya görselleri ve kısa bir açıklama gönderin.",
          "Hasarlı ürünü ve ambalajını, inceleme tamamlanana kadar atmayın; taşıyıcı nezdindeki hasar dosyası için gerekli olabilir.",
          "Talebiniz en geç iki iş günü içinde sonuçlandırılır; sonuç, yenisiyle değişim veya bedel iadesi seçenekleriyle birlikte size yazılı olarak bildirilir.",
          "Yeni ürün gönderimi veya bedel iadesi, tercihinize göre derhal başlatılır; taşıyıcı ile yürütülecek tazminat süreci Satıcı tarafından takip edilir ve bu süreç sizin çözümünüzü bekletmez."
        ]
      },
      {
        "heading": "15. Soğuk Zincir, Kısa Raf Ömürlü ve Gıda Ürünlerinde Özel Kurallar",
        "paragraphs": [
          "Gelato, gelato kiti bileşenleri, yenilebilir waffle kupa ve benzeri sıcaklığa duyarlı ürünler, 5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu ile Türk Gıda Kodeksi mevzuatı çerçevesinde, yalıtımlı ambalaj ve soğutucu jel paketleriyle soğuk zincir korunarak sevk edilir. Bu ürünlerde teslimat, ürünün niteliği gereği belirli gün ve saat aralıklarında planlanır.",
          "Soğuk zincir ürünlerinde gıda güvenliği nedeniyle, teslim edilen ürün Satıcı'ya geri alınarak yeniden satışa sunulamaz. Bu nedenle bu ürünler bakımından cayma hakkı, Mesafeli Sözleşmeler Yönetmeliği'nin cayma hakkının istisnalarını düzenleyen hükmü uyarınca kullanılamaz. Ancak ürünün bozuk, erimiş, soğuk zinciri kırılmış veya son tüketim tarihi geçmiş olarak teslim edilmesi hâlinde bu bir ayıp hâlidir ve bedelin tamamı iade edilir ya da ürün yenisiyle değiştirilir.",
          "Alerjen bilgileri, bileşen listesi, saklama koşulları ve tüketim önerileri ürün sayfasında ve ambalaj etiketinde Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği'ne uygun biçimde sunulur. Bilinen bir gıda alerjiniz varsa sipariş öncesinde bileşen listesini incelemenizi ve tereddüt hâlinde {{PHONE}} numarasından bize danışmanızı öneririz."
        ],
        "bullets": [
          "Teslimat adresinde bulunmanız zorunludur; soğuk zincir gönderileri komşuya, kapıcıya veya güvenliğe bırakılmaz.",
          "Adreste bulunulmaması nedeniyle teslim edilemeyen soğuk zincir gönderilerinde ürün gıda güvenliği gerekçesiyle imha edilir; bu hâlde bedel iadesi yapılamaz. Teslimat saatinizi değiştirmek için kurye çıkışından önce {{PHONE}} numarasından bize ulaşın.",
          "Ürünü teslim aldığınızda jel paketlerin soğukluğunu ve ambalaj bütünlüğünü kontrol edin; erime, sızıntı veya sıcaklık artışı belirtisi varsa fotoğraflayıp aynı gün {{EMAIL}} adresine bildirin.",
          "Bozuk veya soğuk zinciri kırılmış ürünü tüketmeyin; ürünü iade için geri göndermeniz istenmez, fotoğraf ve parti bilgisiyle yapılan bildirim yeterlidir.",
          "Kısa raf ömürlü ürünlerde iade yerine doğrudan yeniden gönderim veya bedel iadesi uygulanır; tercih size aittir.",
          "Ambalajı açılmamış, oda sıcaklığında saklanabilen kuru gıda ürünlerinde (kavrulmuş çekirdek, şurup, kavanoz ürünler) cayma hakkı, mühür ve ambalaj bütünlüğü korunmuş olmak kaydıyla kullanılabilir.",
          "Kahve çekirdeğinin öğütülmüş olarak talep edilmesi ürünün kişiselleştirilmesi anlamına geldiğinden, öğütülerek gönderilen paketlerde cayma hakkı kullanılamaz; ürünün ayıplı olması hâli saklıdır."
        ]
      },
      {
        "heading": "16. İade Adresi, Paketleme ve Gönderi Kuralları",
        "paragraphs": [
          "İadeler yalnızca aşağıdaki adrese kabul edilir. Bu adres dışındaki bir noktaya gönderilen iadeler tarafımıza ulaşmayabilir ve bu durumdan doğan gecikme ve kayıplardan Satıcı sorumlu tutulamaz. Gönderi öncesinde İade Onay Kodu almış olmanız, paketin doğru sipariş kaydıyla eşleştirilmesini sağlar."
        ],
        "bullets": [
          "Ürünü orijinal kutusuyla birlikte, kutunun kendisini dış ambalaj olarak kullanmadan gönderin; orijinal kutu ürünün parçası sayılır.",
          "Cam, seramik ve porselen kalemleri (fincan, cezve, sürahi) balonlu naylon veya kâğıt dolgu ile sarın.",
          "Elektrikli veya mekanik ekipmanı (değirmen, tamper) aksesuarları, vidaları ve kılavuzuyla birlikte eksiksiz gönderin.",
          "Tekstil ürünlerini (önlük, tote) etiketleri sökülmemiş ve yıkanmamış olarak, ambalajında gönderin.",
          "Birden fazla siparişe ait ürünleri tek pakette göndermeyin; her sipariş için ayrı İade Onay Kodu ve ayrı paket kullanın.",
          "Kargo fişini veya takip numarasını, iade süreci tamamlanana kadar saklayın.",
          "Ürün Satıcı'ya ulaşana kadar taşıma riski, anlaşmalı taşıyıcı ile yapılan gönderilerde Satıcı üzerindedir; anlaşmalı olmayan taşıyıcı tercih edilmişse gönderi kaybı riskinin taşıyıcıya karşı takibi gönderici sıfatıyla Alıcı'ya aittir, bu hâlde Satıcı süreçte destek olur."
        ],
        "table": [
          {
            "key": "İade adresi",
            "value": "{{LEGAL_NAME}} — {{ADDRESS}}"
          },
          {
            "key": "Paket üzerine yazılacak bilgi",
            "value": "İade Onay Kodu ve sipariş numarası"
          },
          {
            "key": "Türkiye içi anlaşmalı taşıyıcı",
            "value": "Yurtiçi Kargo (gönderi kodu teyit e-postasında iletilir)"
          },
          {
            "key": "KKTC ve yurt dışı anlaşmalı taşıyıcı",
            "value": "Aras Kargo"
          },
          {
            "key": "İstanbul içi geri alım",
            "value": "Motokurye ile adresten alım (randevulu)"
          },
          {
            "key": "Paket içine konulacak belgeler",
            "value": "Fatura veya e-arşiv fatura çıktısı ve doldurulmuş İade Formu"
          },
          {
            "key": "İnceleme süresi",
            "value": "Ürünün tarafımıza ulaşmasından itibaren en geç 2 iş günü"
          },
          {
            "key": "İade başvuru ve bilgi kanalı",
            "value": "{{EMAIL}} · {{PHONE}}"
          }
        ]
      },
      {
        "heading": "17. İade Talebinin Takibi, Statüler ve Bildirimler",
        "paragraphs": [
          "İade talebiniz oluşturulduğu andan geri ödemenin tamamlanmasına kadar her aşamada üye panelinizden izlenebilir. Her statü değişikliği ayrıca işlemsel e-posta ile bildirilir; bu e-postalar ticari elektronik ileti niteliğinde olmadığından İleti Yönetim Sistemi (İYS) onayınızdan bağımsız olarak gönderilir ve bunlara ilişkin bir ret hakkı doğmaz.",
          "Sistem üzerindeki her statü değişikliği, işlemi yapan yönetici, tarih ve saat bilgisiyle birlikte değiştirilemez olay kaydına (audit log) yazılır. Bu kayıtlar, uyuşmazlık hâlinde 6100 sayılı Hukuk Muhakemeleri Kanunu anlamında delil olarak kullanılır."
        ],
        "table": [
          {
            "key": "Talep Alındı",
            "value": "Cayma veya iade bildiriminiz sisteme kaydedildi; İade Onay Kodu ve gönderi kodu e-posta ile iletildi."
          },
          {
            "key": "Kargo Bekleniyor",
            "value": "Ürünü anlaşmalı taşıyıcıya teslim etmeniz bekleniyor (bildirimden itibaren 10 gün)."
          },
          {
            "key": "Yolda",
            "value": "Gönderi taşıyıcıya teslim edildi ve tarafımıza ulaşması bekleniyor."
          },
          {
            "key": "İncelemede",
            "value": "Ürün depoya ulaştı; kalite kontrol ve satılabilirlik incelemesi yapılıyor (en geç 2 iş günü)."
          },
          {
            "key": "Onaylandı",
            "value": "İade kabul edildi; geri ödeme talimatı ödeme kuruluşuna iletiliyor."
          },
          {
            "key": "Geri Ödeme Başlatıldı",
            "value": "Ödeme kuruluşuna talimat verildi; bankaya bağlı olarak kart hesabına yansıması genellikle 7-10 iş günü sürer."
          },
          {
            "key": "Tamamlandı",
            "value": "Geri ödeme tamamlandı ve sipariş kaydı İade Edildi durumuna alındı."
          },
          {
            "key": "Reddedildi",
            "value": "İade, gerekçesi ve dayanağı yazılı olarak bildirilerek kabul edilmedi; ürün masrafsız olarak adresinize geri gönderilir ve karara itiraz edebilirsiniz."
          }
        ]
      },
      {
        "heading": "18. Kredi Kartı İtirazı (Chargeback), Ön Provizyon ve Ödeme Kuruluşu Süreçleri",
        "paragraphs": [
          "Site üzerindeki ödemeler, 6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun kapsamında faaliyet gösteren, Türkiye Cumhuriyet Merkez Bankası tarafından yetkilendirilmiş bir ödeme kuruluşu veya banka sanal POS altyapısı üzerinden alınır. Kart bilgileri Satıcı sistemlerinde tutulmaz; ödeme adımı 3D Secure doğrulaması ve PCI-DSS uyumlu altyapı üzerinden yürütülür.",
          "5464 sayılı Banka Kartları ve Kredi Kartları Kanunu kapsamında kart hamilinin bankasına yaptığı itiraz (chargeback) süreçleri banka ile kart hamili arasında yürür. Satıcı, bankadan veya ödeme kuruluşundan gelen bilgi taleplerini sipariş kaydı, teslimat belgesi, sözleşme onay kaydı ve iletişim geçmişi ile eksiksiz yanıtlar.",
          "Bir iade talebini önce bizimle çözmeye çalışmanızı öneririz; doğrudan başlatılan itiraz süreçleri bankalar nezdinde 30 günü aşabilirken, doğrudan yapılan iade talebimiz aynı gün ödeme kuruluşuna iletilebilmektedir. Aynı işlem için hem tarafımıza iade başvurusu yapıp hem banka nezdinde itiraz süreci başlatılması, mükerrer iade riskini önlemek amacıyla süreçlerin birleştirilmesini gerektirir; bu durumu {{EMAIL}} adresine bildirmenizi rica ederiz."
        ],
        "bullets": [
          "Ön provizyon: Sipariş anında karttan tahsilat yerine tutar bloke edilebilir; sipariş hazırlandığında tahsilata dönüşür, iptal hâlinde provizyon serbest bırakılır ve tahsilat gerçekleşmez.",
          "Provizyon iptali ile iade farkı: Provizyon iptalinde kartınıza para gelmez, yalnızca kullanılabilir limitiniz serbest kalır; tahsil edilmiş işlemlerde ise gerçek bir geri ödeme yapılır.",
          "Taksitli işlemin iadesi: Banka, iade tutarını taksit yapısına uygun biçimde yansıtabilir; toplam iade tutarında değişiklik olmaz.",
          "Mükerrer ödeme: Aynı sipariş için birden fazla tahsilat oluşmuşsa, fazla tahsilat tespit edildiği anda re-sen iade edilir ve size bildirilir.",
          "Şüpheli işlem: Kartın sahibi olmayan kişilerce kullanıldığına dair kuvvetli şüphe bulunan işlemlerde sipariş, kart hamilinin korunması amacıyla iptal edilerek bedel karta iade edilir.",
          "Kayıt: Sipariş onayı sırasında Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'ne verdiğiniz onayın tarihi, saati, IP adresi, tarayıcı bilgisi ve belge sürümü sipariş kaydına işlenir; bu kayıtlar itiraz süreçlerinde ödeme kuruluşuna sunulur.",
          "Belge: Geri ödeme tamamlandığında 213 sayılı Vergi Usul Kanunu uyarınca gerekli düzeltici belge düzenlenir ve e-posta ile iletilir."
        ]
      },
      {
        "heading": "19. Rezervasyon, Atölye ve Etkinlik Katılımlarının İptali",
        "paragraphs": [
          "{{BRAND}}, Tuzla'daki tarihi köşkte masa rezervasyonu, barista atölyesi ve tadım etkinliği gibi belirli tarih ve saate bağlı hizmetler sunabilmektedir. Belirli bir tarihte veya dönemde yapılması gereken yiyecek-içecek tedariki ile eğlence ve boş zaman değerlendirme amaçlı hizmetler, Mesafeli Sözleşmeler Yönetmeliği'nin cayma hakkının istisnalarını düzenleyen hükmü kapsamında olup bu hizmetlerde cayma hakkı kullanılamaz.",
          "Cayma hakkı bulunmamakla birlikte, {{BRAND}} operasyonel esneklik sağlamak amacıyla aşağıdaki iptal ve devir kolaylıklarını sunar. Bu kolaylıklar sözleşmeden doğan ek haklardır ve hizmetin hiç sunulmaması, gereği gibi sunulmaması veya Satıcı'dan kaynaklanan iptal hâllerinde tüketicinin yasal haklarını sınırlamaz."
        ],
        "bullets": [
          "Etkinlik tarihinden en az 48 saat önce iletilen iptal taleplerinde ödenen bedelin tamamı iade edilir.",
          "Etkinlik tarihine 24-48 saat kala iletilen iptallerde bedel, aynı değerde ve 6 ay geçerli bir hediye çeki olarak hesabınıza tanımlanır.",
          "Etkinlik tarihine 24 saatten az kalan iptallerde ve katılım sağlanmayan rezervasyonlarda, hazırlık ve tahsis edilen kontenjan nedeniyle bedel iadesi yapılamaz; ancak katılım hakkınızı bir başkasına devredebilirsiniz.",
          "Katılımcı devri, etkinlik başlangıcından önce {{EMAIL}} adresine yeni katılımcının adı ve iletişim bilgisi yazılarak ücretsiz yapılır.",
          "Etkinliğin Satıcı tarafından iptal edilmesi veya tarihinin değiştirilmesi hâlinde bedelin tamamı iade edilir veya tercihiniz doğrultusunda yeni tarihe aktarılır; bu tercih size aittir.",
          "Mücbir sebeplerle (doğal afet, resmî makam kararı, altyapı kesintisi) yapılan iptallerde bedel, kesintisiz olarak iade edilir.",
          "Hediye çeki veya kupon ile alınan katılım haklarında iade, aynı araçla ve kalan geçerlilik süresi korunarak yapılır."
        ]
      },
      {
        "heading": "20. Şikâyet Kanalları, Tüketici Hakem Heyeti ve Uyuşmazlıkların Çözümü",
        "paragraphs": [
          "İade ve cayma süreçlerine ilişkin her türlü şikâyet, itiraz ve talebinizi öncelikle doğrudan bize iletmenizi rica ederiz. Başvurularınız kayıt altına alınır, size bir başvuru numarası verilir ve en geç on beş (15) gün içinde sonuçlandırılarak yazılı olarak yanıtlanır.",
          "Doğrudan çözüm sağlanamaması hâlinde 6502 sayılı Tüketicinin Korunması Hakkında Kanun uyarınca, her yıl Ticaret Bakanlığınca yeniden değerleme oranında güncellenen parasal sınırlara göre yerleşim yerinizin veya tüketici işleminin yapıldığı yerin İlçe/İl Tüketici Hakem Heyetine ya da Tüketici Mahkemesine başvurabilirsiniz. Parasal sınırlar ve başvuru usulüne ilişkin güncel bilgi Ticaret Bakanlığı tarafından yayımlanır.",
          "Hakem heyetine başvuru, Tüketici Bilgi Sistemi (TÜBİS) üzerinden elektronik olarak veya ilgili kaymakamlık ile ticaret il müdürlüğüne şahsen yapılabilir. Bu belgede yer alan hiçbir hüküm, tüketicinin hakem heyetine veya mahkemeye başvurma hakkını sınırlandırmaz; Satıcı, hakem heyeti kararlarına uyacağını beyan eder."
        ],
        "ordered": [
          "Talebinizi sipariş numaranız ve varsa görsellerle birlikte {{EMAIL}} adresine gönderin veya {{PHONE}} numarasından bize ulaşın.",
          "Başvurunuz kayıt altına alınır ve size başvuru numarası ile birlikte teyit e-postası gönderilir.",
          "Talep incelenir; gerekirse ek bilgi veya belge istenir ve ürün teknik incelemeye alınır.",
          "Sonuç, gerekçesiyle birlikte en geç 15 gün içinde e-posta ile bildirilir.",
          "Sonuçtan memnun kalmazsanız aynı kanaldan yeniden değerlendirme talep edebilirsiniz; talebiniz farklı bir yetkili tarafından incelenir.",
          "Çözüm sağlanamazsa parasal sınırlara göre yetkili Tüketici Hakem Heyetine veya Tüketici Mahkemesine başvurabilirsiniz.",
          "Elektronik ticaret mevzuatına ilişkin şikâyetlerinizi Ticaret Bakanlığının e-ticaret şikâyet kanalları üzerinden de iletebilirsiniz."
        ]
      },
      {
        "heading": "21. Kayıt, Delil, Kişisel Veriler ve Belgenin Güncellenmesi",
        "paragraphs": [
          "İade ve cayma süreçlerinde işlenen kişisel verileriniz (ad, soyad, iletişim bilgileri, sipariş ve teslimat bilgileri, ödeme aracına ilişkin sınırlı bilgi ve banka hesabı bilgisi), 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 4. maddesindeki genel ilkelere uygun olarak, sözleşmenin kurulması ve ifası ile hukuki yükümlülüklerin yerine getirilmesi hukuki sebeplerine dayanılarak işlenir. Ayrıntılı bilgi için Aydınlatma Metni'ni inceleyebilirsiniz.",
          "6698 sayılı Kanun'un 11. maddesinde sayılan haklarınıza ilişkin taleplerinizi, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'e uygun şekilde {{EMAIL}} adresine iletebilirsiniz; başvurularınız en geç otuz (30) gün içinde sonuçlandırılır. Ticari ve hukuki zorunluluklar sona erdiğinde veriler, Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik uyarınca silinir, yok edilir veya anonim hâle getirilir.",
          "Taraflar, iade ve cayma süreçlerine ilişkin sistem kayıtlarının, işlemsel e-postaların, üye paneli kayıtlarının, değiştirilemez olay kaydının (audit log) ve ödeme kuruluşu kayıtlarının 6100 sayılı Hukuk Muhakemeleri Kanunu'nun 193. maddesi anlamında delil niteliğinde olduğunu kabul eder. Bu delil sözleşmesi, tüketicinin kendi delillerini sunma ve karşı delil gösterme hakkını ortadan kaldırmaz.",
          "Bu belge, mevzuat değişiklikleri ve operasyonel gereklilikler doğrultusunda güncellenebilir. Her güncelleme, sürüm numarası ve yürürlük tarihiyle birlikte {{SITE_URL}} adresinde yayımlanır. Siparişinize, sipariş anında yürürlükte olan ve onayladığınız sürüm uygulanır; sonraki değişiklikler geçmiş siparişleriniz aleyhine sonuç doğurmaz."
        ],
        "bullets": [
          "Saklama: Sipariş, fatura ve iade kayıtları, vergi ve ticaret mevzuatının öngördüğü yasal saklama süreleri boyunca muhafaza edilir.",
          "Güvenlik: Veriler Türkiye Cumhuriyeti sınırları içinde ve şifrelenmiş altyapıda tutulur; üyelik parolaları geri döndürülemez biçimde hash'lenir, yönetici erişimi iki aşamalı doğrulama (TOTP 2FA) ile korunur.",
          "İzlenebilirlik: İade sürecindeki her yönetici işlemi, işlemi yapan kişi ve zaman damgasıyla birlikte değiştirilemez olay kaydına yazılır.",
          "Ticari ileti: İade süreçlerine ilişkin bilgilendirmeler işlemsel nitelikte olup 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun kapsamında ticari elektronik ileti sayılmaz.",
          "Fikri haklar: Bu belgenin metni, {{BRAND}} marka unsurları ve site içerikleri 5846 sayılı Fikir ve Sanat Eserleri Kanunu ile 6769 sayılı Sınai Mülkiyet Kanunu kapsamında korunmaktadır.",
          "Yürürlük: Belge, {{SITE_URL}} adresinde yayımlandığı tarihte yürürlüğe girer ve Ön Bilgilendirme Formu ile Mesafeli Satış Sözleşmesi'nin ayrılmaz eki niteliğindedir.",
          "İletişim: Bu belgeye ilişkin her türlü soru için {{EMAIL}} adresine yazabilir veya {{PHONE}} numarasını arayabilirsiniz."
        ]
      }
    ]
  },
  {
    "slug": "teslimat-ve-kargo",
    "title": "Teslimat ve Kargo Koşulları",
    "shortTitle": "Teslimat",
    "category": "Sipariş",
    "summary": "{{BRAND}} bottega siparişlerinin hazırlık süresini, sipariş kesim saatini, bölgelere göre teslim sürelerini, kargo ücretlerini, soğuk zincir gönderimlerini ve teslimat sırasında tarafların hak ve yükümlülüklerini düzenleyen koşullardır.",
    "references": [
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
      "Mesafeli Sözleşmeler Yönetmeliği (Resmî Gazete: 27.11.2014, Sayı: 29188) — m.5 ön bilgilendirme yükümlülüğü, m.9 cayma hakkı, m.12 cayma bildirimi, m.15 cayma hakkının istisnaları",
      "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun",
      "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İleti Yönetim Sistemi — İYS)",
      "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik",
      "6098 sayılı Türk Borçlar Kanunu — m.117 temerrüt",
      "6102 sayılı Türk Ticaret Kanunu — m.1524 internet sitesi yükümlülüğü ve taşıma işleri hükümleri",
      "6698 sayılı Kişisel Verilerin Korunması Kanunu — m.4 genel ilkeler, m.5-6 işleme şartları, m.9 yurt dışına aktarım, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliği",
      "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ",
      "5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun",
      "5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu",
      "Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği",
      "213 sayılı Vergi Usul Kanunu — sevk irsaliyesi ve fatura düzenine ilişkin hükümler",
      "6100 sayılı Hukuk Muhakemeleri Kanunu — m.193 delil sözleşmesi",
      "Posta Hizmetleri Kanunu ve Posta Sektörüne İlişkin Yetkilendirme Yönetmeliği kapsamında yetkilendirilmiş kargo hizmet sağlayıcılarına ilişkin mevzuat"
    ],
    "sections": [
      {
        "heading": "1. Amaç, Kapsam ve Tanımlar",
        "paragraphs": [
          "İşbu Teslimat ve Kargo Koşulları, {{LEGAL_NAME}} tarafından {{BRAND}} markası altında {{SITE_URL}} adresindeki online mağaza (bottega) üzerinden satışa sunulan fiziksel ürünlerin hazırlanması, paketlenmesi, taşıyıcıya teslim edilmesi ve alıcıya ulaştırılması süreçlerini düzenler. Metin, Mesafeli Sözleşmeler Yönetmeliği kapsamındaki ön bilgilendirme yükümlülüğünün ayrılmaz bir parçasıdır ve Ön Bilgilendirme Formu ile Mesafeli Satış Sözleşmesi ile birlikte yorumlanır.",
          "Bu koşullar yalnızca bottega üzerinden verilen ve fiziksel sevkiyat gerektiren siparişler için geçerlidir. {{ADDRESS}} adresindeki işletmede yerinde tüketilen kafe menüsü ürünleri ile işletmeden elden teslim alınan ürünler bu metnin kargo hükümlerine tabi değildir.",
          "Bu metin ile Mesafeli Satış Sözleşmesi arasında çelişki bulunması hâlinde, tüketici lehine olan hüküm uygulanır. Metnin hiçbir hükmü, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ile tüketiciye tanınan hakları sınırlandıracak, ortadan kaldıracak veya tüketiciyi bu haklardan feragat ettirecek şekilde yorumlanamaz.",
          "Sipariş verilebilmesi için e-posta adresi doğrulanmış bir üye hesabının bulunması zorunludur. Teslimat bildirimleri, kargo takip bilgileri ve teslimat sürecine ilişkin tüm yazışmalar bu hesapta kayıtlı iletişim bilgileri üzerinden yürütülür."
        ],
        "bullets": [
          "SATICI / GÖNDERİCİ: {{LEGAL_NAME}} ({{SHORT_NAME}}), {{BRAND}} markasının işletmecisi tüzel kişi.",
          "ALICI: Bottega üzerinden ürün satın alan gerçek veya tüzel kişi; tüketici sıfatını haiz gerçek kişiler bakımından 6502 sayılı Kanun hükümleri öncelikle uygulanır.",
          "BOTTEGA: {{SITE_URL}} adresinde yer alan online mağaza bölümü.",
          "TAŞIYICI: Siparişin alıcıya ulaştırılması amacıyla SATICI tarafından belirlenen ve yetkilendirilmiş kargo hizmeti sağlayan firma ya da motokurye hizmeti sağlayıcısı.",
          "İŞ GÜNÜ: Cumartesi, Pazar ve Türkiye Cumhuriyeti resmî tatil günleri ile yarım gün çalışılan resmî arife günlerinin öğleden sonrası hariç olmak üzere, hafta içi çalışma günü.",
          "SİPARİŞ KESİM SAATİ (CUT-OFF): Bir siparişin aynı iş günü içinde hazırlığa alınabilmesi için ödemesinin onaylanmış olması gereken en son saat.",
          "HAZIRLIK SÜRESİ: Ödemenin onaylanmasından siparişin paketlenip taşıyıcıya fiilen teslim edilmesine kadar geçen süre.",
          "TRANSİT SÜRE: Gönderinin taşıyıcıya teslim edilmesinden alıcıya ulaştırılmasına kadar geçen taşıma süresi.",
          "SOĞUK ZİNCİR: Isıya duyarlı ürünlerin üretimden teslimata kadar belirlenen sıcaklık aralığında tutulmasını sağlayan yalıtımlı paketleme ve sevkiyat yöntemi.",
          "TESLİMAT ADRESİ: ALICI tarafından sipariş sırasında girilen ve gönderinin ulaştırılacağı açık posta adresi."
        ]
      },
      {
        "heading": "2. Satıcı ve Gönderici Bilgileri",
        "paragraphs": [
          "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik uyarınca gönderilerin göndericisi ve satış sözleşmesinin tarafı olan tüzel kişiye ilişkin tanıtıcı bilgiler aşağıdadır. Tüm gönderiler aşağıdaki unvan ve adres üzerinden düzenlenir; kargo etiketinde ve sevk belgelerinde gönderici olarak bu bilgiler yer alır."
        ],
        "table": [
          {
            "key": "Ticaret unvanı",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Kısa unvan",
            "value": "{{SHORT_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Sevkiyat ve iade adresi",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Vergi dairesi",
            "value": "{{TAX_OFFICE}}"
          },
          {
            "key": "Vergi kimlik numarası (VKN)",
            "value": "{{TAX_NO}}"
          },
          {
            "key": "Vergi türü",
            "value": "{{TAX_TYPE}}"
          },
          {
            "key": "Faaliyete başlama tarihi",
            "value": "{{STARTED_AT}}"
          },
          {
            "key": "Ana faaliyet kodu (NACE)",
            "value": "{{NACE}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil numarası",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "Banka",
            "value": "{{BANK}}"
          },
          {
            "key": "IBAN",
            "value": "{{IBAN}}"
          },
          {
            "key": "Instagram",
            "value": "{{IG}}"
          },
          {
            "key": "TikTok",
            "value": "{{TIKTOK}}"
          },
          {
            "key": "YouTube",
            "value": "{{YOUTUBE}}"
          },
          {
            "key": "Sosyal medya kullanıcı adı",
            "value": "{{HANDLE}}"
          }
        ]
      },
      {
        "heading": "3. İş Günü Tanımı, Sipariş Kesim Saati ve Ödemenin Onaylanması",
        "paragraphs": [
          "Bu metinde geçen tüm süreler, aksi açıkça belirtilmedikçe iş günü olarak hesaplanır. Cumartesi, Pazar günleri ile resmî tatil günleri hazırlık ve transit sürelerinin hesabına dâhil edilmez. Dinî ve millî bayramlar ile bayram arifelerinde kargo firmalarının çalışma düzeni değişebileceğinden, bu dönemlerde teslim süreleri {{SITE}} üzerinde ayrıca duyurulur.",
          "Sürelerin işlemeye başlaması, siparişin verilmiş olmasına değil, ödemenin ilgili ödeme kuruluşu veya banka tarafından başarıyla onaylanmasına bağlıdır. 3D Secure doğrulaması tamamlanmamış, ön provizyonu alınmış ancak satışa dönüştürülmemiş veya bankaca askıya alınmış işlemlerde hazırlık süresi başlamaz. Ödeme onayı, sipariş kaydına onay tarihi ve saati ile birlikte işlenir.",
          "Bir iş gününde sipariş kesim saatine kadar ödemesi onaylanan siparişler aynı iş günü içinde hazırlığa alınır. Kesim saatinden sonra, hafta sonunda veya resmî tatilde onaylanan siparişler, takip eden ilk iş günü hazırlığa alınmış sayılır.",
          "Stok, ödemenin onaylandığı anda düşülür. Nadir de olsa aynı ürünün eş zamanlı satışı nedeniyle stok uyuşmazlığı yaşanması hâlinde SATICI durumu en geç bir iş günü içinde {{EMAIL}} üzerinden ALICI'ya bildirir; ALICI dilerse siparişin kalan kısmının gönderilmesini, dilerse siparişin tamamının iptalini talep edebilir. İptal hâlinde tahsil edilen tutarın tamamı, teslim masrafları dâhil olmak üzere iade edilir."
        ],
        "table": [
          {
            "key": "Sipariş kesim saati (hafta içi)",
            "value": "14.00 (TSİ)"
          },
          {
            "key": "Kesim saatinden sonraki siparişler",
            "value": "Takip eden ilk iş gününde hazırlığa alınır"
          },
          {
            "key": "Hafta sonu ve resmî tatil siparişleri",
            "value": "Takip eden ilk iş gününde hazırlığa alınır"
          },
          {
            "key": "Soğuk zincir ürünlerin sevk günleri",
            "value": "Pazartesi, Salı ve Çarşamba (gönderinin hafta sonu yolda kalmaması için)"
          },
          {
            "key": "İstanbul içi motokurye kesim saati",
            "value": "Hafta içi 15.00 (TSİ) — aynı gün teslim"
          },
          {
            "key": "Süre başlangıcı",
            "value": "Ödemenin banka veya ödeme kuruluşunca onaylandığı an"
          }
        ]
      },
      {
        "heading": "4. Hazırlık Süresi ve Ürün Gruplarına Göre Sevk Planı",
        "paragraphs": [
          "Hazırlık süresi, ürün grubunun niteliğine göre değişir. Kahve çekirdekleri tazelik esasına göre siparişe yakın tarihte kavrulur ve kavrumdan sonra dinlendirilerek paketlenir; bu nedenle çekirdek ürünlerin hazırlık süresi rafta hazır bekleyen ekipman veya marka ürünlerine kıyasla daha uzun olabilir.",
          "Yenilebilir waffle kupa ve gelato kiti gibi gıda ürünleri, tazelik ve gıda güvenliği gerekçesiyle stoktan değil, sipariş üzerine üretim planına alınarak hazırlanır. Bu ürünler, gönderinin hafta sonu boyunca kargo şubesinde beklememesi amacıyla yalnızca haftanın ilk üç iş gününde sevk edilir.",
          "Aynı siparişte farklı hazırlık sürelerine sahip ürünlerin bulunması hâlinde SATICI, siparişi kural olarak tek gönderide ve en uzun hazırlık süresine göre sevk eder. ALICI'nın talebi veya soğuk zincir gerekliliği nedeniyle siparişin birden fazla gönderiye bölünmesi hâlinde ALICI'dan ilave kargo bedeli talep edilmez; her gönderi için ayrı takip numarası bildirilir.",
          "Ürün detay sayfasında bir ürün için özel hazırlık süresi belirtilmişse, o ürün bakımından ilgili sayfada gösterilen süre esas alınır. Bu metindeki süreler tahminî olup hiçbir hâlde işbu metnin 6. maddesinde düzenlenen yasal azami otuz günlük ifa süresini aşamaz."
        ],
        "table": [
          {
            "key": "Kavrulmuş kahve çekirdeği",
            "value": "1-3 iş günü (siparişe yakın kavrum ve dinlendirme)"
          },
          {
            "key": "Yenilebilir waffle kupa (edible cup)",
            "value": "2-4 iş günü — yalnızca Pazartesi-Çarşamba sevk"
          },
          {
            "key": "Gelato kiti",
            "value": "2-4 iş günü — soğuk zincir, yalnızca Pazartesi-Çarşamba sevk"
          },
          {
            "key": "Kiler ürünleri (pistacchio kreması, şuruplar)",
            "value": "1-2 iş günü"
          },
          {
            "key": "Kahve ekipmanı (moka pot, değirmen, tamper)",
            "value": "1-2 iş günü"
          },
          {
            "key": "Marka ürünleri (fincan, önlük, tote)",
            "value": "1-2 iş günü"
          },
          {
            "key": "Karma sipariş",
            "value": "Siparişteki en uzun hazırlık süresi esas alınır"
          }
        ]
      },
      {
        "heading": "5. Teslimat Bölgeleri ve Tahminî Teslim Süreleri",
        "paragraphs": [
          "Aşağıdaki tabloda yer alan süreler, hazırlık süresi ile transit sürenin toplamını ifade eder ve iş günü olarak hesaplanır. Süreler tahminî olup taşıyıcı firmanın operasyonel yoğunluğuna, teslimat adresinin bulunduğu ilçe ve mahalleye, hava koşullarına ve bayram dönemlerine göre değişebilir.",
          "Köy, mezra, organize sanayi bölgesi, askerî bölge, adalar ve dağıtım şubesi bulunmayan yerleşim yerlerinde taşıyıcı firmalar kapıya teslim yerine en yakın şubeden teslim uygulaması yapabilir. Bu durumda ALICI, gönderiyi ilgili şubeden teslim alır ve taşıyıcı tarafından kendisine bu yönde bilgilendirme yapılır.",
          "Kampanya dönemleri, yeni ürün lansmanları ve yoğun bayram trafiğinde süreler bir ila iki iş günü uzayabilir. Böyle dönemlerde güncel süreler ürün sayfalarında ve sepet ekranında ayrıca gösterilir.",
          "Teslim süresinin bu tabloda gösterilen aralığı aşması, tek başına ALICI'ya sözleşmeyi fesih hakkı vermez; ancak 6. maddede düzenlenen yasal azami ifa süresinin aşılması hâlinde ALICI'nın fesih ve iade hakları saklıdır."
        ],
        "table": [
          {
            "key": "İstanbul içi — motokurye",
            "value": "Hafta içi 15.00'a kadar verilen ve stoktan karşılanan siparişlerde aynı gün"
          },
          {
            "key": "İstanbul içi — kargo",
            "value": "1-2 iş günü"
          },
          {
            "key": "Marmara Bölgesi, Ankara ve İzmir",
            "value": "1-3 iş günü"
          },
          {
            "key": "Diğer iller (Türkiye geneli)",
            "value": "2-5 iş günü"
          },
          {
            "key": "Uzak ilçe, köy ve dağıtım şubesi bulunmayan yerleşimler",
            "value": "3-7 iş günü"
          },
          {
            "key": "Kuzey Kıbrıs Türk Cumhuriyeti (KKTC)",
            "value": "5-10 iş günü (gümrük işlem süresi hariç)"
          },
          {
            "key": "Yurt dışı",
            "value": "7-21 iş günü (gümrük işlem süresi hariç)"
          },
          {
            "key": "Yasal azami ifa süresi",
            "value": "Her hâlükârda siparişin kurulduğu tarihten itibaren 30 gün"
          }
        ]
      },
      {
        "heading": "6. Yasal Azami Otuz Günlük İfa Süresi ve Sürenin Aşılması Hâlinde Alıcının Hakları",
        "paragraphs": [
          "Mesafeli Sözleşmeler Yönetmeliği uyarınca SATICI, sipariş konusu ürünü, sözleşmenin kurulduğu tarihten itibaren en geç otuz gün içinde ALICI'ya teslim etmekle yükümlüdür. Bu süre emredici nitelikte olup, işbu metinde yer alan tahminî teslim süreleri hiçbir şekilde bu azami süreyi uzatmaz.",
          "SATICI, otuz günlük sürenin aşılacağını öngördüğü anda ALICI'yı {{EMAIL}} üzerinden ve sipariş detay sayfası üzerinden bilgilendirir; gecikmenin gerekçesini ve öngörülen yeni teslim tarihini bildirir. Bu bildirim, ALICI'nın aşağıdaki haklarını kullanmasına engel oluşturmaz ve tek başına süre uzatımı anlamına gelmez.",
          "Teslimin otuz gün içinde gerçekleşmemesi hâlinde ALICI, sözleşmeyi feshetme hakkına sahiptir. Fesih bildirimi {{EMAIL}} adresine yazılı olarak veya üye hesabındaki sipariş detay sayfası üzerinden yapılabilir; bildirim için özel bir şekil şartı aranmaz.",
          "Sözleşmenin feshi hâlinde SATICI, fesih bildiriminin kendisine ulaştığı tarihten itibaren en geç on dört gün içinde, teslim masrafları da dâhil olmak üzere tahsil edilen tüm ödemeleri, ALICI'nın ödeme sırasında kullandığı araca uygun bir şekilde ve ALICI'ya hiçbir masraf yüklemeden iade eder. Kredi kartı ile yapılan ödemelerde tutarın karta yansıma süresi bankanın iç işleyişine bağlı olup bu süre SATICI'nın kontrolünde değildir; SATICI iade talimatını yasal süre içinde vermekle yükümlüdür.",
          "Teslimatın gecikmesi nedeniyle ALICI'nın 6098 sayılı Türk Borçlar Kanunu'nun temerrüde ilişkin hükümlerinden ve 6502 sayılı Tüketicinin Korunması Hakkında Kanun'dan doğan tazminat ve diğer talep hakları saklıdır."
        ],
        "ordered": [
          "Siparişi feshetmeksizin makul bir ek süre tanıyarak teslimatın gerçekleşmesini bekleme.",
          "Sözleşmeyi feshederek siparişi iptal etme ve ödediği bedelin tamamının iadesini talep etme.",
          "Fesih hâlinde ürün bedeli ile birlikte ödediği kargo veya kurye bedelinin de iadesini talep etme.",
          "İadenin on dört günlük yasal süre içinde yapılmaması hâlinde tüketici hakem heyetine veya tüketici mahkemesine başvurma.",
          "Gecikmeden doğan zararları bakımından genel hükümler çerçevesinde tazminat talep etme."
        ]
      },
      {
        "heading": "7. Kargo ve Teslimat Ücretleri",
        "paragraphs": [
          "Kargo ve teslimat ücretleri, sepet ekranında ve ödeme öncesindeki sipariş özetinde ayrı bir kalem olarak, vergiler dâhil şekilde gösterilir. ALICI'dan, sipariş özetinde gösterilen tutar dışında herhangi bir ad altında ilave teslimat bedeli talep edilmez. Uygulanan KDV oranı fiziksel ürünlerde %20'dir.",
          "Ücretsiz kargo eşiğinin hesabında, promosyon kodu ve indirimler düşüldükten sonra kalan ürün bedeli toplamı esas alınır; kargo bedelinin kendisi bu hesaba dâhil edilmez. Ücretsiz kargo eşiğini aşan bir siparişin sonradan kısmen iade edilmesi ve kalan tutarın eşiğin altına düşmesi hâlinde, ALICI'dan geriye dönük kargo bedeli talep edilmez.",
          "Soğuk zincir gerektiren gönderilerde kullanılan yalıtımlı kutu, jel akü ve kuru buz malzemeleri için ALICI'dan ayrıca bir bedel alınmaz; bu maliyet ilgili kargo bedeline dâhildir.",
          "KKTC ve yurt dışı gönderilerinde taşıma bedeli; gönderinin desi/ağırlık değeri, varış ülkesi ve seçilen taşıma hizmetine göre sipariş anında hesaplanır ve ödeme öncesinde ALICI'ya net tutar olarak gösterilir. Bu bedel yalnızca taşıma hizmetini kapsar; gümrük vergi, resim ve harçları 16. maddede düzenlendiği şekilde ALICI'nın sorumluluğundadır.",
          "Ücret tarifesinde yapılacak değişiklikler yalnızca ileriye etkili olarak uygulanır; değişiklik tarihinden önce kurulmuş siparişlere, sipariş anında geçerli olan tarife uygulanır."
        ],
        "table": [
          {
            "key": "500 TL ve üzeri siparişler (Türkiye geneli)",
            "value": "Ücretsiz"
          },
          {
            "key": "500 TL altı siparişler (Türkiye geneli)",
            "value": "39 TL"
          },
          {
            "key": "İstanbul içi motokurye (aynı gün)",
            "value": "89 TL"
          },
          {
            "key": "KKTC gönderileri",
            "value": "Sipariş anında desi ve varış noktasına göre hesaplanır"
          },
          {
            "key": "Yurt dışı gönderileri",
            "value": "Sipariş anında desi ve varış ülkesine göre hesaplanır"
          },
          {
            "key": "Soğuk zincir paketleme bedeli",
            "value": "Ücretsiz — kargo bedeline dâhildir"
          },
          {
            "key": "Siparişin birden fazla gönderiye bölünmesi",
            "value": "İlave kargo bedeli alınmaz"
          },
          {
            "key": "Para birimi ve vergi",
            "value": "Türk Lirası (TRY), KDV dâhil (%20)"
          }
        ]
      },
      {
        "heading": "8. Anlaşmalı Kargo Firmaları ve Taşıyıcının Belirlenmesi",
        "paragraphs": [
          "SATICI, gönderilerini aşağıdaki anlaşmalı taşıyıcılar aracılığıyla sevk eder. Taşıyıcı, teslimat bölgesine ve ürün grubunun niteliğine göre SATICI tarafından belirlenir. Mesafeli Sözleşmeler Yönetmeliği uyarınca, cayma hakkının kullanılması hâlinde iade gönderiminde kullanılacak anlaşmalı taşıyıcı da bu maddede gösterilen firmalardır.",
          "ALICI, sipariş sırasında anlaşmalı taşıyıcılar dışında bir taşıyıcı ile gönderim talep edemez. Ancak ALICI'nın kendi tercih ettiği bir taşıyıcı ile gönderim konusunda SATICI ile ayrıca yazılı olarak anlaşması hâlinde, gönderiye ilişkin risk ve masraflar bakımından 18. madde hükümleri uygulanır.",
          "Anlaşmalı taşıyıcının ilgili bölgede hizmet verememesi, hizmetini durdurması veya gönderinin niteliği gereği farklı bir taşıyıcı kullanılmasının zorunlu olması hâlinde SATICI, ALICI aleyhine sonuç doğurmamak ve ilave bedel talep etmemek kaydıyla eşdeğer hizmet veren başka bir taşıyıcı belirleyebilir. Bu durumda ALICI'ya kargo takip bilgisi ile birlikte taşıyıcı değişikliği bildirilir.",
          "Taşıma sırasında meydana gelen gecikme, hasar ve kayıplar bakımından SATICI'nın ALICI'ya karşı sorumluluğu 18. maddede düzenlenmiştir; SATICI'nın taşıyıcıya rücu hakkı saklıdır."
        ],
        "table": [
          {
            "key": "Yurtiçi Kargo",
            "value": "Türkiye geneli standart ve soğuk zincir gönderileri"
          },
          {
            "key": "Aras Kargo",
            "value": "KKTC ve yurt dışı gönderileri"
          },
          {
            "key": "Motokurye hizmeti",
            "value": "İstanbul içi aynı gün teslimat"
          },
          {
            "key": "İade gönderilerinde anlaşmalı taşıyıcı",
            "value": "Yurtiçi Kargo (Türkiye içi iadeler)"
          },
          {
            "key": "Taşıyıcı seçimi",
            "value": "Teslimat bölgesi ve ürün niteliğine göre SATICI belirler"
          }
        ]
      },
      {
        "heading": "9. Soğuk Zincir, Kuru Buz ve Isıya Duyarlı Ürünler",
        "paragraphs": [
          "Gelato kiti, yenilebilir waffle kupa ve benzeri ısıya duyarlı gıda ürünleri, 5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu ile ilgili gıda mevzuatı çerçevesinde soğuk zincir koşullarında hazırlanır ve sevk edilir. Bu ürünler yalıtımlı strafor veya karton kutu içinde, jel akü ya da kuru buz ile birlikte gönderilir.",
          "Soğuk zincir gönderileri, gönderinin hafta sonu boyunca kargo hattında beklememesi amacıyla yalnızca Pazartesi, Salı ve Çarşamba günleri sevk edilir. Perşembe günü kesim saatinden sonra verilen soğuk zincir siparişleri, takip eden haftanın ilk sevk gününde gönderilir. Bu kısıt, ürünün gıda güvenliği açısından uygun koşullarda teslim edilmesini sağlamak amacını taşır ve ALICI'ya sipariş öncesinde ürün sayfasında bildirilir.",
          "Kuru buz kullanılan gönderilerde, kuru buz tehlikeli madde sınıfında yer aldığından bazı taşıyıcı firmalar ve bazı varış noktaları bakımından taşıma kısıtı uygulanabilir. SATICI, bu kısıt nedeniyle sevk edilemeyen siparişleri ALICI'ya bildirir ve ALICI'nın talebi doğrultusunda siparişi iptal ederek bedelin tamamını iade eder.",
          "Soğuk zincir gönderileri niteliği gereği KKTC ve yurt dışına sevk edilemez. Bu ürünler yalnızca Türkiye içi teslimat adreslerine gönderilebilir; sipariş ekranında uygun olmayan teslimat bölgesi seçildiğinde ilgili ürün sepete eklenemez.",
          "Soğuk zincir gönderileri, Mesafeli Sözleşmeler Yönetmeliği'nin cayma hakkının istisnalarını düzenleyen hükümleri kapsamında, çabuk bozulabilen veya son kullanma tarihi geçebilecek mallar ile tesliminden sonra ambalajı açıldığında sağlık ve hijyen bakımından iadesi uygun olmayan mallar arasında değerlendirilebilir. Bu husus ürün sayfasında ve Ön Bilgilendirme Formu'nda ayrıca belirtilir."
        ],
        "bullets": [
          "Isıya duyarlı ürünler yalıtımlı kutu içinde, jel akü veya kuru buz eşliğinde sevk edilir.",
          "Sevk günleri Pazartesi, Salı ve Çarşamba ile sınırlıdır; Perşembe ve Cuma günleri soğuk zincir sevkiyatı yapılmaz.",
          "ALICI, soğuk zincir gönderilerini teslim aldıktan sonra gecikmeksizin uygun saklama koşullarına almakla yükümlüdür; ürün sayfasında ve ambalaj üzerinde belirtilen saklama sıcaklığı esastır.",
          "Kargo şubesinden teslim alınacak soğuk zincir gönderilerinde bekleme süresi, ürün niteliği gereği en fazla bir iş günüdür; ALICI'ya bu husus takip bildiriminde ayrıca hatırlatılır.",
          "Alerjen bilgileri, içindekiler listesi, net miktar, parti numarası ve son tüketim tarihi, Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği'ne uygun olarak ürün ambalajında yer alır.",
          "Soğuk zincirin ALICI'nın kusuru dışında bir nedenle kırılması ve ürünün teslim anında bozulmuş olması hâlinde ALICI, 6502 sayılı Kanun'un ayıplı mala ilişkin hükümlerinden doğan seçimlik haklarını kullanabilir.",
          "Kuru buz içeren paketlerin açılması sırasında doğrudan temastan kaçınılması gerektiğine ilişkin uyarı, ambalaj üzerinde ve kutu içi bilgilendirme kartında yer alır."
        ]
      },
      {
        "heading": "10. Kırılabilir, Hassas ve Ağır Ürünlerin Paketlenmesi",
        "paragraphs": [
          "Cam fincan, cam sürahi, seramik ürünler, moka pot ve el değirmeni gibi kırılabilir ya da darbeye hassas ürünler, taşıma sırasında zarar görmemeleri için çok katmanlı koruma ile paketlenir. Ürün önce iç ambalajında sabitlenir, ardından darbe emici malzeme ile sarılarak dış koliye yerleştirilir ve boşluklar dolgu malzemesi ile doldurulur.",
          "Kırılabilir ürün içeren gönderilerin dış ambalajı üzerinde kırılabilir ürün uyarı etiketi bulunur ve taşıyıcı firmaya bu yönde bildirim yapılır. Ancak bu etiket, taşıyıcının özen yükümlülüğünü ortadan kaldırmaz.",
          "Ağırlık veya hacim itibarıyla tek koliye sığmayan siparişler birden fazla koli ile sevk edilebilir. Bu durumda her koli ayrı takip numarası ile izlenir ve ALICI'ya kaç parça gönderi bekleyeceği bildirilir. ALICI'dan ilave kargo bedeli talep edilmez.",
          "SATICI, ambalaj malzemelerinde geri dönüştürülebilir ve gıda ile temasa uygun malzeme kullanmayı esas alır. Ambalaj tercihleri, ürünün güvenli teslimatını tehlikeye atmayacak şekilde belirlenir."
        ],
        "bullets": [
          "İç ambalaj: ürünün orijinal kutusu veya markalı koruyucu kılıf.",
          "Darbe emici katman: hava yastığı, köpük profil veya oluklu mukavva sargı.",
          "Dış koli: ürün boyutuna uygun, köşe takviyeli ve gerektiğinde çift duvarlı koli.",
          "Boşluk dolgusu: kâğıt dolgu veya geri dönüştürülebilir dolgu malzemesi.",
          "Dış etiketleme: kırılabilir ürün uyarısı, yön oku ve gerektiğinde soğuk zincir uyarısı.",
          "Sıvı ürünlerde (şurup, krema) kapak güvenliği için ilave sızdırmazlık bandı ve ayrı poşetleme uygulanır.",
          "Kahve çekirdekleri, aroma kaybını önlemek amacıyla tek yönlü valfli ambalajda sevk edilir."
        ]
      },
      {
        "heading": "11. Teslimat Adresinin Doğruluğu ve Hatalı veya Eksik Adresin Sonuçları",
        "paragraphs": [
          "Teslimat adresinin, alıcı adının ve iletişim bilgilerinin eksiksiz, güncel ve doğru girilmesi ALICI'nın sorumluluğundadır. Adres bilgisi; il, ilçe, mahalle, cadde/sokak, bina ve daire numarası ile posta kodunu içerecek şekilde açık olarak girilmelidir. Cep telefonu numarası, taşıyıcının teslimat öncesi bilgilendirme yapabilmesi için zorunludur.",
          "Sipariş onaylandıktan sonra adres değişikliği talepleri, gönderi taşıyıcıya teslim edilmeden önce {{EMAIL}} adresine veya {{PHONE}} numarasına iletildiği takdirde imkânlar ölçüsünde karşılanır. Gönderi taşıyıcıya teslim edildikten sonra adres değişikliği taşıyıcının uygulamasına bağlıdır ve SATICI bu değişikliğin gerçekleşeceğini taahhüt edemez.",
          "İş yeri, otel, hastane, üniversite yerleşkesi, kışla ve benzeri kurumsal adreslere yapılan gönderilerde teslimat, ilgili kurumun kendi teslim alma prosedürüne göre yapılır. Bu tür adreslerde gönderinin kurum içi dağıtımından SATICI sorumlu tutulamaz.",
          "Adres bilgisinin ALICI tarafından hatalı, eksik veya yanıltıcı girilmesi nedeniyle gönderinin teslim edilememesi hâlinde doğan ilave taşıma masrafları ALICI'ya aittir. Bu hüküm yalnızca ALICI'nın kusurundan kaynaklanan hâller için geçerli olup, SATICI'nın veya taşıyıcının hatasından kaynaklanan yanlış adres sevkiyatlarında hiçbir ilave bedel talep edilmez ve gönderi masrafsız olarak doğru adrese yönlendirilir."
        ],
        "ordered": [
          "Adres hatası tespit edildiğinde SATICI, ALICI ile {{EMAIL}} ve/veya {{PHONE}} üzerinden iletişime geçer ve doğru adresi teyit etmeye çalışır.",
          "Gönderi henüz taşıyıcıya teslim edilmemişse adres düzeltilir ve sevkiyat ilave bedel alınmaksızın doğru adrese yapılır.",
          "Gönderi yoldaysa taşıyıcı nezdinde adres değişikliği talep edilir; taşıyıcının kabul etmemesi hâlinde gönderi SATICI'ya iade edilir.",
          "SATICI'ya iade edilen gönderi, ALICI'nın talebi hâlinde doğru adrese yeniden sevk edilir; ALICI'nın kusurundan kaynaklanan iadelerde yeniden gönderim kargo bedeli ALICI'ya aittir ve tutar sevkiyat öncesinde bildirilir.",
          "ALICI yeniden gönderim istemez ve siparişi iptal ederse, ürün bedeli ile ilk gönderime ilişkin teslim masrafları 14. madde hükümleri çerçevesinde iade edilir.",
          "Hatanın SATICI veya taşıyıcıdan kaynaklandığı hâllerde tüm ilave masraflar SATICI tarafından karşılanır."
        ]
      },
      {
        "heading": "12. Teslim Alacak Kişi, Kimlik İbrazı ve Vekâleten Teslim",
        "paragraphs": [
          "Gönderi kural olarak, sipariş sırasında belirtilen alıcı adına ve teslimat adresinde teslim edilir. Taşıyıcı firma, teslim sırasında kimlik ibrazı talep edebilir; kimlik ibraz edilmemesi hâlinde taşıyıcı teslimatı gerçekleştirmeyebilir.",
          "Alıcının adreste bulunmaması hâlinde gönderi, aynı adreste bulunan ve teslim almaya ehil bir kişiye (aile bireyi, birlikte yaşayan kişi, iş yeri çalışanı, apartman görevlisi) teslim edilebilir. Bu şekilde yapılan teslimat, ALICI'ya yapılmış teslimat hükmündedir. ALICI, apartman görevlisine veya komşuya teslim edilmesini istemiyorsa bu tercihini sipariş notunda belirtmelidir; belirtilmesi hâlinde taşıyıcıya bu yönde talimat iletilir.",
          "Alkollü içecek veya on sekiz yaşından küçüklere satışı mevzuatla sınırlanmış ürün bulunan gönderiler bakımından teslim alacak kişinin on sekiz yaşını doldurmuş olması zorunludur; taşıyıcı bu hâllerde kimlik kontrolü yapar. Bottega ürün yelpazesinde 4207 sayılı Tütün Ürünlerinin Zararlarının Önlenmesi ve Kontrolü Hakkında Kanun kapsamında satışı kısıtlanan ürün bulunmamaktadır.",
          "Kurumsal alıcılar bakımından teslimat, alıcı kurumun yetkilendirdiği kişiye yapılır. Kurum adına düzenlenen faturalarda vergi kimlik numarası ve vergi dairesi bilgisinin sipariş sırasında eksiksiz girilmesi 213 sayılı Vergi Usul Kanunu uyarınca zorunludur.",
          "Hediye siparişlerinde, gönderinin üçüncü bir kişiye teslim edilmesi ALICI'nın talimatı ile gerçekleşir; bu durumda sözleşmeden doğan haklar ALICI'ya ait olmaya devam eder ve cayma hakkı ALICI tarafından kullanılır."
        ],
        "bullets": [
          "Teslim alacak kişi: sipariş sahibi veya aynı adreste bulunan teslim almaya ehil kişi.",
          "Kimlik ibrazı: taşıyıcı firma tarafından talep edilebilir; ibraz edilmemesi teslimatı engelleyebilir.",
          "Komşuya veya apartman görevlisine teslim edilmemesi talebi sipariş notunda belirtilmelidir.",
          "Yaş sınırı bulunan ürünlerde on sekiz yaş kontrolü zorunludur.",
          "Kurumsal teslimatlarda kurum yetkilisine teslim esastır; fatura bilgileri sipariş anında eksiksiz girilmelidir.",
          "Hediye gönderilerinde sözleşmeden doğan haklar sipariş sahibinde kalır.",
          "Teslim anında taşıyıcı tarafından alınan imza veya elektronik teslim kaydı, teslimatın gerçekleştiğine dair delil teşkil eder; ALICI'nın aksini ispat hakkı saklıdır."
        ]
      },
      {
        "heading": "13. Teslim Sırasında Kontrol Yükümlülüğü ve Hasar Tespit Tutanağı",
        "paragraphs": [
          "ALICI'nın veya teslim alan kişinin, gönderiyi teslim almadan önce dış ambalajı gözle kontrol etmesi önerilir. Ezik, yırtık, ıslanmış, açılmış, bandı kopmuş veya soğuk zincir gönderilerinde belirgin şekilde ısınmış görünen paketler teslim alınmadan önce taşıyıcı görevlisi ile birlikte tutanak altına alınmalıdır.",
          "Hasarlı görünen bir gönderinin teslim alınmak istenmemesi hâlinde, taşıyıcı görevlisinden hasar tespit tutanağı düzenlenmesi talep edilmeli ve tutanağın bir nüshası teslim alan kişide kalmalıdır. Tutanağın bir kopyasının en kısa sürede {{EMAIL}} adresine iletilmesi, sürecin hızla sonuçlandırılmasını sağlar.",
          "Dış ambalajda görünür bir hasar bulunmamakla birlikte ürünün ambalaj açıldıktan sonra hasarlı olduğunun anlaşılması hâlinde ALICI, durumu tercihen teslimden itibaren üç gün içinde, ambalaj ve ürün fotoğraflarıyla birlikte {{EMAIL}} adresine bildirmelidir. Bu süre bir hak düşürücü süre olmayıp, taşıyıcı nezdindeki tazmin sürecinin başlatılabilmesi için önerilen bildirim süresidir.",
          "Hasar tespit tutanağı düzenlenmemiş veya bildirim önerilen süre içinde yapılmamış olması, ALICI'nın 6502 sayılı Tüketicinin Korunması Hakkında Kanun'un ayıplı mala ilişkin hükümlerinden doğan seçimlik haklarını ortadan kaldırmaz. SATICI, bu tür hâllerde de somut olayın koşullarını değerlendirerek çözüm üretir.",
          "Hasarlı veya eksik teslimatın tespiti hâlinde SATICI, ALICI'nın tercihine göre ürünü ücretsiz olarak yeniler, ayıp oranında bedel indirimi yapar veya sözleşmeden dönülmesi hâlinde ödenen bedeli teslim masrafları dâhil olmak üzere iade eder. Bu hâllerde iade gönderisinin kargo bedeli SATICI tarafından karşılanır."
        ],
        "ordered": [
          "Teslim anında dış ambalajı kontrol edin; ezik, yırtık, ıslaklık veya açılma izi olup olmadığına bakın.",
          "Hasar tespit ederseniz gönderiyi teslim almadan taşıyıcı görevlisinden hasar tespit tutanağı düzenlemesini isteyin ve tutanağın bir nüshasını alın.",
          "Tutanağın fotoğrafını veya kopyasını, sipariş numaranızla birlikte {{EMAIL}} adresine iletin.",
          "Ambalaj açıldıktan sonra fark edilen hasarlarda ürünün, ambalajın ve varsa kargo etiketinin fotoğraflarını çekin.",
          "Bildiriminizi tercihen teslimden itibaren üç gün içinde {{EMAIL}} adresine veya {{PHONE}} numarasına iletin.",
          "SATICI, bildirimi aldıktan sonra en geç üç iş günü içinde size dönüş yapar ve çözüm seçeneklerini bildirir.",
          "Ürünün yenilenmesi tercih edildiğinde yeni gönderi, stok durumuna göre en kısa sürede ve ilave bedel alınmaksızın sevk edilir."
        ]
      },
      {
        "heading": "14. Teslim Edilemeyen Gönderiler, Şube Bekleme Süresi ve Satıcıya İade",
        "paragraphs": [
          "Taşıyıcı firma, teslimat adresinde alıcıya ulaşamaması hâlinde kural olarak en az iki teslim denemesi yapar. İkinci denemenin de sonuçsuz kalması hâlinde gönderi, bölgedeki dağıtım şubesinde ALICI adına bekletilir ve ALICI'ya taşıyıcı tarafından bilgilendirme yapılır.",
          "Şubede bekleme süresi standart gönderilerde üç iş günü, soğuk zincir gönderilerinde ürün niteliği gereği en fazla bir iş günüdür. Bu süre içinde teslim alınmayan gönderiler taşıyıcı tarafından SATICI'ya iade edilir.",
          "Gönderinin SATICI'ya iade edilmesi, siparişin kendiliğinden iptal edildiği anlamına gelmez. SATICI, iadenin kendisine ulaşmasından sonra en geç iki iş günü içinde ALICI ile {{EMAIL}} üzerinden iletişime geçerek yeniden gönderim veya iptal tercihini sorar.",
          "Soğuk zincir gönderilerinin şubede bekleme süresini aşması hâlinde ürünün gıda güvenliği açısından yeniden sevki mümkün olmayabilir. Bu durumda SATICI, ALICI'yı bilgilendirir; teslim alınamamanın ALICI'nın kusurundan kaynaklanmadığı hâllerde ürün ücretsiz olarak yenilenir.",
          "ALICI'nın gönderiyi haklı bir neden olmaksızın teslim almaması, cayma hakkının kullanılması anlamına gelmez. ALICI'nın cayma hakkını kullanmak istemesi hâlinde, Mesafeli Sözleşmeler Yönetmeliği uyarınca on dört günlük süre içinde açık bir bildirimde bulunması gerekir; teslim alınmayan gönderilerde bu bildirim {{EMAIL}} adresine yapılabilir."
        ],
        "ordered": [
          "Taşıyıcı adreste en az iki teslim denemesi yapar ve her denemede ALICI'ya bildirimde bulunur.",
          "Gönderi, dağıtım şubesinde standart ürünlerde üç iş günü, soğuk zincir ürünlerinde en fazla bir iş günü bekletilir.",
          "Süre sonunda teslim alınmayan gönderi taşıyıcı tarafından SATICI'nın {{ADDRESS}} adresine iade edilir.",
          "SATICI, iadenin ulaşmasından itibaren iki iş günü içinde ALICI ile iletişime geçer.",
          "ALICI yeniden gönderim isterse, kendi kusurundan kaynaklanan iadelerde yeniden gönderim kargo bedeli tahsil edilir ve tutar önceden bildirilir.",
          "ALICI siparişi iptal etmek isterse ya da cayma hakkını kullanırsa, ürün bedeli ile ilk gönderime ilişkin teslim masrafları on dört gün içinde ödeme aracına uygun şekilde iade edilir.",
          "ALICI'ya on beş gün içinde ulaşılamaması hâlinde SATICI, ALICI'yı bilgilendirerek siparişi iptal eder ve tahsil edilen tutarı iade eder."
        ]
      },
      {
        "heading": "15. Kargo Takip Numarası, Bildirimler ve Teslimat İletişimi",
        "paragraphs": [
          "Gönderi taşıyıcıya teslim edildiğinde, ALICI'nın üye hesabında kayıtlı e-posta adresine kargo takip numarasını, taşıyıcı firmayı ve tahminî teslim aralığını içeren bir bildirim gönderilir. Aynı bilgiler, üye hesabındaki sipariş detay sayfasından her zaman görüntülenebilir.",
          "Sipariş yaşam döngüsü boyunca ALICI'ya; sipariş alındı, ödeme onaylandı, hazırlanıyor, kargoya verildi ve teslim edildi aşamalarında bilgilendirme yapılır. Bu bildirimler siparişin ifasına ilişkin işlemsel iletiler olup, 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ile Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik anlamında ticari elektronik ileti niteliği taşımaz; bu nedenle İleti Yönetim Sistemi (İYS) üzerinden ayrıca onay aranmaz.",
          "Kampanya, indirim ve yeni ürün duyurusu içeren pazarlama amaçlı iletiler ise ticari elektronik ileti niteliğindedir ve yalnızca ALICI'nın önceden açık onayı alınarak, İYS'ye kaydedilmek suretiyle gönderilir. ALICI bu onayı her zaman ve gerekçe göstermeksizin geri alabilir.",
          "İşlemsel e-postalar Resend altyapısı üzerinden iletilir. E-postaların istenmeyen posta klasörüne düşmesi ihtimaline karşı ALICI'nın {{EMAIL}} adresini güvenli gönderen listesine eklemesi önerilir.",
          "Kargo takip bilgisi, taşıyıcı firmanın sistemine işlendikten sonra aktif hâle gelir; taşıyıcı sistemine işlenme süresi nedeniyle takip numarası birkaç saat boyunca sorgulanamayabilir. Takip numarasının aktifleşmemesi tek başına gönderinin sevk edilmediği anlamına gelmez."
        ],
        "bullets": [
          "Kargo takip numarası: kargoya veriliş bildirimi e-postasında ve sipariş detay sayfasında yer alır.",
          "Bildirim kanalları: e-posta ve üye hesabı sipariş detay sayfası.",
          "İşlemsel bildirimler için İYS onayı gerekmez; pazarlama iletileri için açık onay ve İYS kaydı zorunludur.",
          "Bildirim tercihleri üye hesabından her zaman güncellenebilir.",
          "Takip numarası ile sorgulama, ilgili taşıyıcı firmanın kendi takip sisteminden yapılır.",
          "Takip bilgisinde üç iş günü boyunca hareket görülmemesi hâlinde {{EMAIL}} adresine bildirim yapılması, kayıp araştırmasının başlatılmasını hızlandırır.",
          "Teslimat sırasında taşıyıcı tarafından yapılan SMS veya çağrı bildirimleri, taşıyıcı firmanın kendi hizmet standartlarına tabidir."
        ]
      },
      {
        "heading": "16. KKTC ve Yurt Dışı Gönderileri; Gümrük Vergi, Resim ve Harçları",
        "paragraphs": [
          "KKTC ve yurt dışı gönderilerinde taşıma bedeli, gönderinin ağırlık ve hacim değeri ile varış ülkesine göre sipariş anında hesaplanır ve ödeme öncesinde ALICI'ya vergiler dâhil net tutar olarak gösterilir.",
          "Yurt dışına yapılan gönderiler varış ülkesinin gümrük mevzuatına tabidir. Varış ülkesinde tahakkuk edebilecek ithalat vergileri, gümrük vergisi, katma değer vergisi, özel tüketim vergisi, gümrük müşavirliği ücreti, antrepo ve benzeri her türlü resim, harç ve masraf ALICI'nın sorumluluğundadır ve bu tutarlar sipariş bedeline dâhil değildir. SATICI bu tutarları önceden hesaplayamaz veya taahhüt edemez.",
          "Gümrük işlemleri sırasında ALICI'dan kimlik, vergi numarası veya ithalat beyanı gibi ek belge talep edilebilir. Bu belgelerin zamanında sunulmaması nedeniyle gönderinin gümrükte beklemesi, iade edilmesi veya imha edilmesi hâlinde doğan masraflar ALICI'ya aittir.",
          "Bazı ürünlerin belirli ülkelere ihracı veya ithali yasal olarak kısıtlanmış olabilir. Gıda ürünlerinin ithalinde varış ülkesinin gıda güvenliği mevzuatı uygulanır. ALICI, sipariş vermeden önce kendi ülkesinin ithalat kurallarını kontrol etmekle yükümlüdür.",
          "Gönderinin gümrük mevzuatına aykırılık nedeniyle varış ülkesince kabul edilmemesi ve SATICI'ya iade edilmesi hâlinde ürün bedeli ALICI'ya iade edilir; ancak gidiş ve dönüş taşıma bedelleri ile gümrükte doğan masraflar iade tutarından mahsup edilebilir. Bu mahsup, yalnızca gümrük engelinin ALICI'nın bilgi verme yükümlülüğünü yerine getirmemesinden kaynaklandığı hâllerde uygulanır.",
          "Soğuk zincir gerektiren ürünler, gümrük bekleme süreleri nedeniyle KKTC ve yurt dışına gönderilmez."
        ],
        "bullets": [
          "Taşıma bedeli sipariş anında hesaplanır ve ödeme öncesinde net tutar olarak gösterilir.",
          "Gümrük vergi, resim ve harçları ile müşavirlik ücretleri ALICI'ya aittir.",
          "Gönderiler DAP (Delivered at Place) esasına göre sevk edilir; gümrükleme yükümlülüğü ALICI'dadır.",
          "Gümrük işlem süreleri, tabloda gösterilen tahminî teslim sürelerine dâhil değildir.",
          "Varış ülkesinin ithalat kısıtlamalarını kontrol etmek ALICI'nın sorumluluğundadır.",
          "Yurt dışı gönderilerinde fatura, ihracat mevzuatına uygun şekilde düzenlenir ve gönderiye eklenir.",
          "Soğuk zincir ürünleri KKTC ve yurt dışına sevk edilmez."
        ]
      },
      {
        "heading": "17. Mücbir Sebep, Olağanüstü Hava Koşulları ve Hizmet Kesintileri",
        "paragraphs": [
          "Tarafların kontrolü dışında gelişen, öngörülemeyen ve kaçınılamayan olaylar mücbir sebep sayılır. Mücbir sebebin varlığı hâlinde SATICI, teslimat yükümlülüğünü ifa edemediği süre boyunca temerrüde düşmüş sayılmaz ve 6098 sayılı Türk Borçlar Kanunu'nun ilgili hükümleri uygulanır.",
          "SATICI, mücbir sebebin ortaya çıkmasından sonra makul en kısa sürede ALICI'yı durumdan, gecikmenin tahminî süresinden ve alternatif çözüm seçeneklerinden haberdar eder. Bildirim, üye hesabında kayıtlı e-posta adresine ve {{SITE}} üzerinde yayımlanan duyuru ile yapılır.",
          "Mücbir sebep durumunun otuz günü aşması hâlinde ALICI, sözleşmeyi feshetme ve ödediği bedelin tamamının iadesini talep etme hakkına sahiptir. Fesih hâlinde iade, bildirimin ulaşmasından itibaren en geç on dört gün içinde yapılır.",
          "Kar yağışı, sel, fırtına ve yoğun sis gibi olağanüstü hava koşullarında kargo firmaları belirli bölgelerde dağıtımı geçici olarak durdurabilir. Bu durumlarda gönderiler, koşulların normale dönmesinin ardından öncelikli olarak sevk edilir ve ALICI bilgilendirilir.",
          "Mücbir sebep hâlleri, ALICI'nın 6502 sayılı Tüketicinin Korunması Hakkında Kanun'dan doğan haklarını ortadan kaldırmaz; bu madde yalnızca gecikmeden doğan sorumluluk bakımından uygulanır."
        ],
        "bullets": [
          "Doğal afetler: deprem, sel, heyelan, yangın, fırtına ve şiddetli kar yağışı.",
          "Salgın hastalık, karantina ve kamu otoritesince getirilen dolaşım kısıtlamaları.",
          "Savaş, seferberlik, terör olayları ve sivil kargaşa.",
          "Genel grev, lokavt ve taşıma sektörünü etkileyen iş bırakma eylemleri.",
          "Kamu otoritesi kararları, gümrük uygulamalarındaki ani değişiklikler ve idari kapatmalar.",
          "Ülke genelini veya bölgeyi etkileyen elektrik, internet ve haberleşme altyapısı kesintileri.",
          "Taşıyıcı firmanın faaliyetini bütünüyle durdurması veya bölgesel dağıtımı askıya alması.",
          "Hammadde temininde yaşanan ve öngörülemeyen tedarik zinciri kesintileri."
        ]
      },
      {
        "heading": "18. Riskin ve Zilyetliğin Geçişi; Zayi ve Hasar Sorumluluğu",
        "paragraphs": [
          "Mesafeli Sözleşmeler Yönetmeliği uyarınca, taşıyıcı SATICI tarafından belirlendiği sürece, ürünün zayi ve hasarına ilişkin risk ALICI'ya veya ALICI'nın belirlediği üçüncü kişiye fiilen teslim edildiği ana kadar SATICI'ya aittir. Bu nedenle taşıma sırasında kaybolan veya hasar gören gönderilerden ALICI sorumlu tutulamaz.",
          "ALICI'nın, SATICI tarafından önerilen taşıyıcı dışında bir taşıyıcıyı kendi tercihiyle belirlemesi hâlinde risk, ürünün ilgili taşıyıcıya teslim edildiği anda ALICI'ya geçer. Bottega üzerinden verilen siparişlerde taşıyıcı kural olarak SATICI tarafından belirlendiğinden, bu istisna ancak tarafların ayrıca yazılı olarak anlaşması hâlinde uygulanır.",
          "Gönderinin taşıma sırasında kaybolduğunun anlaşılması hâlinde SATICI, taşıyıcı nezdinde kayıp araştırması başlatır. Araştırmanın sonuçlanmasını beklemeksizin, ALICI'nın tercihine göre ürün ücretsiz olarak yeniden gönderilir veya ödenen bedelin tamamı teslim masrafları dâhil olmak üzere iade edilir. SATICI'nın taşıyıcıya rücu hakkı saklıdır.",
          "Ürünün mülkiyeti, bedelin tamamının SATICI'ya ödenmesi ve ürünün ALICI'ya teslim edilmesi ile ALICI'ya geçer.",
          "SATICI'nın bu maddeden doğan sorumluluğunu tümüyle veya tüketici aleyhine olacak şekilde sınırlandıran hiçbir hüküm geçerli değildir."
        ]
      },
      {
        "heading": "19. Cayma Hakkı Kapsamında İade Gönderilerinde Kargo Düzeni",
        "paragraphs": [
          "ALICI, Mesafeli Sözleşmeler Yönetmeliği uyarınca, ürünü teslim aldığı tarihten itibaren on dört gün içinde hiçbir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden cayma hakkına sahiptir. Cayma bildirimi, süre dolmadan önce {{EMAIL}} adresine ya da üye hesabındaki sipariş detay sayfası üzerinden yapılabilir.",
          "SATICI, cayma hakkı kapsamındaki iade gönderileri için anlaşmalı taşıyıcı olarak Yurtiçi Kargo'yu belirlemiştir ve bu bilgi Ön Bilgilendirme Formu'nda da yer alır. İadenin anlaşmalı taşıyıcı ile ve SATICI'nın bildireceği iade kodu kullanılarak gönderilmesi hâlinde iade kargo bedeli SATICI tarafından karşılanır; ALICI'dan herhangi bir taşıma bedeli tahsil edilmez.",
          "ALICI'nın anlaşmalı taşıyıcı dışında bir taşıyıcı ile iade göndermeyi tercih etmesi hâlinde, SATICI yalnızca anlaşmalı taşıyıcı tarifesine denk gelen tutarı karşılamakla yükümlüdür; aradaki fark ALICI'ya ait olabilir.",
          "Cayma hakkının kullanılması hâlinde SATICI, cayma bildiriminin kendisine ulaşmasından itibaren en geç on dört gün içinde, ürün bedeli ile birlikte ALICI'nın ödediği teslim masraflarını da iade eder. İade edilecek teslim masrafı, standart gönderim seçeneğine karşılık gelen tutardır; ALICI'nın standart gönderim dışında ilave maliyetli bir teslimat seçeneğini (örneğin aynı gün motokurye) tercih etmiş olması hâlinde aradaki fark iade kapsamı dışında kalabilir.",
          "ALICI, cayma bildiriminden itibaren on gün içinde ürünü SATICI'nın {{ADDRESS}} adresine iade etmekle yükümlüdür. Ürünün, kutusu, ambalajı, varsa standart aksesuarları ile birlikte ve fatura eşliğinde eksiksiz gönderilmesi gerekir.",
          "Mesafeli Sözleşmeler Yönetmeliği'nin cayma hakkının istisnalarını düzenleyen hükümleri saklıdır. Çabuk bozulabilen veya son kullanma tarihi geçebilecek ürünler ile tesliminden sonra ambalajı açıldığında sağlık ve hijyen bakımından iadesi uygun olmayan ürünlerde cayma hakkı kullanılamaz; bu istisna ilgili ürünlerin sayfasında ve Ön Bilgilendirme Formu'nda açıkça belirtilir."
        ],
        "bullets": [
          "Cayma süresi: ürünün teslim alındığı tarihten itibaren 14 gün.",
          "Cayma bildirimi: {{EMAIL}} adresine e-posta veya üye hesabındaki sipariş detay sayfası üzerinden.",
          "Anlaşmalı iade taşıyıcısı: Yurtiçi Kargo — iade kodu ile gönderimde kargo bedeli SATICI'ya aittir.",
          "İade adresi: {{ADDRESS}}",
          "Ürünün SATICI'ya gönderilme süresi: cayma bildiriminden itibaren 10 gün.",
          "İade süresi: cayma bildiriminin ulaşmasından itibaren en geç 14 gün; ödeme aracına uygun şekilde.",
          "İade kapsamı: ürün bedeli ve standart teslim masrafı.",
          "İstisnalar: çabuk bozulabilen gıda ürünleri ile hijyen gereği iadesi uygun olmayan ürünler."
        ]
      },
      {
        "heading": "20. Kargo Süreçlerinde Kişisel Verilerin İşlenmesi",
        "paragraphs": [
          "Teslimatın gerçekleştirilebilmesi için ALICI'nın ad-soyad, teslimat adresi, cep telefonu numarası ve sipariş numarası bilgileri, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun sözleşmenin kurulması ve ifası ile veri sorumlusunun hukuki yükümlülüğünü yerine getirmesi hukuki sebeplerine dayanılarak işlenir ve anlaşmalı taşıyıcı firmalara aktarılır.",
          "Aktarım, yalnızca teslimatın gerçekleştirilmesi amacıyla ve amaçla sınırlı asgari veri ilkesi gözetilerek yapılır. Taşıyıcı firmalar, kendi faaliyetleri bakımından bağımsız veri sorumlusu sıfatını haizdir ve kendi aydınlatma yükümlülüklerini yerine getirir.",
          "Teslimat ve kargo kayıtları, 213 sayılı Vergi Usul Kanunu ile 6102 sayılı Türk Ticaret Kanunu'nda öngörülen saklama süreleri ve olası uyuşmazlıklarda ispat yükümlülüğü çerçevesinde saklanır; sürenin dolmasının ardından Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik uyarınca silinir, yok edilir veya anonim hâle getirilir.",
          "ALICI, 6698 sayılı Kanun'un ilgili kişinin haklarını düzenleyen hükümleri kapsamındaki taleplerini {{EMAIL}} adresine iletebilir. Başvurular, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca en geç otuz gün içinde sonuçlandırılır. Ayrıntılı bilgi için Aydınlatma Metni ve KVKK Başvuru Formu incelenmelidir."
        ],
        "bullets": [
          "Taşıyıcıya aktarılan veriler: ad-soyad, teslimat adresi, cep telefonu numarası, sipariş numarası ve gerektiğinde gönderi içeriği tanımı.",
          "Aktarım amacı: yalnızca gönderinin teslim edilmesi ve teslimat sürecine ilişkin bilgilendirme.",
          "Hukuki sebep: sözleşmenin kurulması ve ifası ile hukuki yükümlülüğün yerine getirilmesi.",
          "Yurt dışı gönderilerinde veriler, 6698 sayılı Kanun'un yurt dışına aktarıma ilişkin hükümlerine uygun olarak varış ülkesindeki taşıyıcı ve gümrük makamlarına aktarılabilir.",
          "Barındırma ve işlemsel e-posta altyapısı (Vercel, Supabase, Resend) kullanımından doğan aktarımlar Aydınlatma Metni'nde ayrıca açıklanmıştır.",
          "Teslimat verilerine erişim, yetkilendirilmiş yönetici hesaplarıyla sınırlıdır; yönetici erişimi TOTP tabanlı iki aşamalı doğrulama ile korunur ve tüm yönetici işlemleri değiştirilemez olay kaydına yazılır."
        ]
      },
      {
        "heading": "21. Teslimat Sorunlarında Başvuru, Şikâyet ve Uyuşmazlık Çözümü",
        "paragraphs": [
          "Teslimatla ilgili her türlü soru, talep ve şikâyet için öncelikle {{EMAIL}} adresine veya {{PHONE}} numarasına başvurulması, sorunun en hızlı şekilde çözülmesini sağlar. Başvurularda sipariş numarasının ve varsa kargo takip numarasının belirtilmesi süreci hızlandırır.",
          "SATICI, kendisine ulaşan teslimat şikâyetlerini kayıt altına alır ve en geç üç iş günü içinde ALICI'ya dönüş yapar. Taşıyıcı nezdinde araştırma gerektiren durumlarda süreç, taşıyıcı firmanın araştırma süresine bağlı olarak uzayabilir; bu hâlde ALICI ara bilgilendirme ile durumdan haberdar edilir.",
          "Tüketici sıfatını haiz ALICI, uyuşmazlığın çözümü için her yıl Ticaret Bakanlığınca yeniden değerleme oranında güncellenen parasal sınırlar çerçevesinde, yerleşim yerinin veya işlemin yapıldığı yerin İlçe/İl Tüketici Hakem Heyetine ya da Tüketici Mahkemesine başvurabilir. Bu başvuru hakkı, SATICI'ya doğrudan başvuru yapılmış olmasına bağlı değildir.",
          "Elektronik ticaret mevzuatından kaynaklanan konularda Ticaret Bakanlığının e-ticaret şikâyet kanalları; kişisel verilere ilişkin konularda ise Kişisel Verileri Koruma Kurumu nezdindeki şikâyet yolu açıktır.",
          "Taraflar, 6100 sayılı Hukuk Muhakemeleri Kanunu'nun delil sözleşmesine ilişkin hükümleri uyarınca; SATICI'nın sistem kayıtlarının, sipariş ve teslimat loglarının, e-posta yazışmalarının ve taşıyıcı firma kayıtlarının uyuşmazlıklarda delil teşkil edeceğini kabul eder. Bu hüküm, tüketicinin kendi delillerini sunma ve aksini ispat etme hakkını ortadan kaldırmaz."
        ],
        "ordered": [
          "Sipariş numaranız ve kargo takip numaranız ile {{EMAIL}} adresine yazın veya {{PHONE}} numarasını arayın.",
          "Hasar, eksik ürün veya yanlış ürün durumlarında fotoğraf ve varsa hasar tespit tutanağını başvurunuza ekleyin.",
          "SATICI en geç üç iş günü içinde dönüş yapar ve çözüm önerisini yazılı olarak bildirir.",
          "Taşıyıcı araştırması gerektiren durumlarda süreç boyunca ara bilgilendirme yapılır.",
          "Çözümden memnun kalmamanız hâlinde tüketici hakem heyetine veya tüketici mahkemesine başvurabilirsiniz.",
          "Kişisel verilere ilişkin taleplerinizi Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca {{EMAIL}} adresine iletebilirsiniz."
        ],
        "table": [
          {
            "key": "Müşteri hizmetleri e-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "İade ve gönderi adresi",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Instagram",
            "value": "{{IG}}"
          },
          {
            "key": "TikTok",
            "value": "{{TIKTOK}}"
          },
          {
            "key": "YouTube",
            "value": "{{YOUTUBE}}"
          },
          {
            "key": "Şikâyet yanıt süresi",
            "value": "En geç 3 iş günü"
          }
        ]
      },
      {
        "heading": "22. Yürürlük, Güncelleme ve Sürüm Bilgisi",
        "paragraphs": [
          "İşbu Teslimat ve Kargo Koşulları, {{SITE_URL}} adresinde yayımlandığı tarihte yürürlüğe girer ve Ön Bilgilendirme Formu ile Mesafeli Satış Sözleşmesi'nin ayrılmaz bir parçasını oluşturur.",
          "SATICI, mevzuat değişiklikleri, taşıyıcı anlaşmalarındaki güncellemeler, ürün yelpazesindeki değişiklikler veya operasyonel gereklilikler nedeniyle bu metni güncelleyebilir. Güncellenen metin {{SITE}} üzerinde yayımlandığı andan itibaren geçerli olur.",
          "Her siparişe, siparişin kurulduğu tarihte yürürlükte olan metin sürümü uygulanır. ALICI'nın ödeme adımında Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'ni ayrı bir onay kutucuğu ile onaylaması hâlinde; onay tarihi ve saati, IP adresi, tarayıcı bilgisi ve onaylanan belge sürümü sipariş kaydına yazılır ve uyuşmazlık hâlinde delil olarak kullanılır.",
          "Bu metnin herhangi bir hükmünün yetkili merci tarafından geçersiz sayılması hâlinde, diğer hükümler geçerliliğini korur; geçersiz hüküm yerine tarafların amacına en yakın ve tüketici lehine olan düzenleme uygulanır.",
          "Bu koşullara ilişkin her türlü soru ve görüş için {{EMAIL}} adresine yazabilir veya {{PHONE}} numarasından {{BRAND}} müşteri hizmetlerine ulaşabilirsiniz."
        ],
        "bullets": [
          "Metin, yayımlandığı tarihte yürürlüğe girer.",
          "Güncellemeler yalnızca ileriye etkilidir; tamamlanmış siparişlere uygulanmaz.",
          "Her siparişe, sipariş anında yürürlükte olan sürüm uygulanır.",
          "Onay kaydı: tarih, saat, IP adresi, tarayıcı bilgisi ve belge sürümü sipariş kaydında saklanır.",
          "Metnin güncel sürümü her zaman {{SITE_URL}} adresinde yayımlanır."
        ]
      }
    ]
  },
  {
    "slug": "odeme-kosullari",
    "title": "Ödeme Koşulları ve Sanal POS",
    "shortTitle": "Ödeme Koşulları",
    "category": "Ödeme & Güvenlik",
    "summary": "{{SITE}} üzerinden yapılan ödemelerin hangi yöntemlerle, hangi güvenlik önlemleriyle ve hangi banka/ödeme kuruluşu sanal POS altyapısı üzerinden alındığını; 3D Secure, taksit, iade, mükerrer çekim ve kart itirazı süreçlerini düzenler.",
    "references": [
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
      "Mesafeli Sözleşmeler Yönetmeliği (Resmî Gazete: 27.11.2014, 29188)",
      "5464 sayılı Banka Kartları ve Kredi Kartları Kanunu",
      "6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun",
      "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun",
      "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik",
      "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik",
      "6698 sayılı Kişisel Verilerin Korunması Kanunu",
      "Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik",
      "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ",
      "6098 sayılı Türk Borçlar Kanunu",
      "6102 sayılı Türk Ticaret Kanunu",
      "213 sayılı Vergi Usul Kanunu",
      "6100 sayılı Hukuk Muhakemeleri Kanunu",
      "5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun"
    ],
    "sections": [
      {
        "heading": "1. Amaç, Kapsam ve Taraflar",
        "paragraphs": [
          "Bu Ödeme Koşulları ve Sanal POS Metni ({{SHORT_NAME}} tarafından işletilen {{BRAND}} markalı {{SITE_URL}} adresli internet sitesi üzerinden) gerçekleştirilen tüm ödeme işlemlerinin hangi yöntemlerle kabul edildiğini, ödemenin teknik olarak hangi altyapı üzerinden alındığını, kart verisinin nasıl korunduğunu, iade ve itiraz süreçlerinin nasıl işlediğini düzenlemek amacıyla hazırlanmıştır.",
          "Metinde geçen SATICI ifadesi {{LEGAL_NAME}} tüzel kişiliğini, {{BRAND}} ifadesi bu tüzel kişiliğe ait ticari markayı, ALICI veya kullanıcı ifadesi ise {{SITE}} üzerinden sipariş veren gerçek veya tüzel kişiyi ifade eder.",
          "Bu metin, {{SITE}} üzerinde yayımlanan Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formu'nun ayrılmaz bir eki niteliğindedir. Ödeme adımına ilerleyen kullanıcı, bu metni okuduğunu ve içeriğini kabul ettiğini beyan eder. Bu metin, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ile Mesafeli Sözleşmeler Yönetmeliği'nin tüketici lehine emredici hükümlerini sınırlandıracak biçimde yorumlanamaz.",
          "Metin, kafe içinde nakit veya fiziki POS cihazı ile yapılan yüz yüze satışları değil, yalnızca {{SITE}} üzerinden yapılan uzaktan (mesafeli) satışları kapsar."
        ]
      },
      {
        "heading": "2. Tanımlar",
        "bullets": [
          "Sanal POS: Bankanın veya 6493 sayılı Kanun kapsamında faaliyet gösteren yetkili ödeme kuruluşunun, internet üzerinden kart ile ödeme kabul edilmesini sağlayan sanal satış noktası uygulaması.",
          "Ödeme Kuruluşu: 6493 sayılı Kanun uyarınca Türkiye Cumhuriyet Merkez Bankası tarafından yetkilendirilmiş, ödeme hizmeti sağlayan kuruluş.",
          "3D Secure: Kart hamilinin, kartı çıkaran banka tarafından ek bir doğrulama adımı (tek kullanımlık şifre, mobil uygulama onayı veya biyometrik doğrulama) ile kimliğinin teyit edildiği güvenli ödeme protokolü.",
          "Provizyon (otorizasyon): Kart limitinden işlem tutarının bloke edilerek ödemenin bankaca onaylanması işlemi.",
          "Ön provizyon: Tutarın kart limitinde bloke edildiği, ancak henüz Satıcı hesabına aktarılmadığı geçici otorizasyon.",
          "Provizyon kapama (capture): Ön provizyonla bloke edilen tutarın kesinleştirilerek tahsil edilmesi.",
          "Chargeback (kart itirazı / ters ibraz): Kart hamilinin bankasına başvurarak işleme itiraz etmesi ve tutarın kart kuruluşu kuralları çerçevesinde geri alınması süreci.",
          "Idempotency (tekillik): Aynı ödeme bildiriminin ağ tekrarları nedeniyle birden çok kez ulaşması hâlinde dahi siparişin yalnızca bir kez işlenmesini sağlayan teknik güvence.",
          "Minor unit (kuruş tabanı): Tüm fiyatların ondalık yuvarlama hatası doğurmaması için tam sayı kuruş cinsinden tutulması yöntemi.",
          "PCI-DSS: Kart verisinin işlenmesi, iletilmesi ve saklanmasına ilişkin uluslararası kart kuruluşlarınca belirlenen veri güvenliği standardı."
        ]
      },
      {
        "heading": "3. Satıcı ve Ödeme Altyapısı Künyesi",
        "paragraphs": [
          "Ödemenin muhatabı ve fatura düzenleyicisi aşağıdaki tüzel kişidir. Kart ekstrenizde görünecek üye iş yeri adı, bankanın kayıt biçimine göre {{BRAND}} veya {{SHORT_NAME}} olarak yer alabilir."
        ],
        "table": [
          {
            "key": "Ticaret unvanı",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Kısa unvan",
            "value": "{{SHORT_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "İş yeri adresi",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Vergi dairesi",
            "value": "{{TAX_OFFICE}}"
          },
          {
            "key": "Vergi kimlik numarası",
            "value": "{{TAX_NO}}"
          },
          {
            "key": "Vergi türü",
            "value": "{{TAX_TYPE}}"
          },
          {
            "key": "İşe başlama tarihi",
            "value": "{{STARTED_AT}}"
          },
          {
            "key": "Ana faaliyet kodu (NACE)",
            "value": "{{NACE}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil numarası",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          }
        ]
      },
      {
        "heading": "4. Fiyatlandırma, Para Birimi ve Vergiler",
        "paragraphs": [
          "{{SITE}} üzerinde yayımlanan tüm fiyatlar Türk Lirası (TRY) cinsindendir ve %20 oranındaki katma değer vergisi dâhil olarak gösterilir. Ürün sayfasında, sepette ve ödeme özetinde gördüğünüz tutarlar nihai tüketici fiyatlarıdır; kargo ücreti dışında ayrıca bir bedel eklenmez.",
          "Fiyatlar teknik olarak kuruş tabanında (minor unit) tam sayı biçiminde tutulur ve ekranda yalnızca gösterim amacıyla biçimlendirilir. Bu yöntem, ondalık yuvarlama farklarından doğan tutar uyuşmazlıklarını önler; bankaya iletilen tutar ile ekranda gördüğünüz tutar birebir aynıdır.",
          "Vergi oranlarında mevzuat değişikliği olması hâlinde yeni oran, yürürlüğe girdiği tarihten sonra oluşturulan siparişlere uygulanır; daha önce ödemesi tamamlanmış siparişlerin tutarı geriye dönük olarak değiştirilmez.",
          "Fiyat, kampanya ve stok bilgilerinde açık bir maddi hata (örneğin fiyatın virgül kayması nedeniyle olağan değerinin çok altında görünmesi) bulunması hâlinde Satıcı, siparişi onaylamadan önce durumu size bildirir ve dilerseniz siparişi ücretsiz iptal etme hakkını tanır. Bu durumda tahsil edilmiş bir tutar varsa iade edilir; bu hüküm, doğru fiyatla kurulmuş sözleşmelerden dönme hakkı vermez."
        ]
      },
      {
        "heading": "5. Kabul Edilen Ödeme Yöntemleri",
        "paragraphs": [
          "Aşağıdaki ödeme yöntemleri kabul edilir. Ödeme sayfasında hangi yöntemlerin aktif olduğu, sipariş tutarına, teslimat ülkesine ve ödeme kuruluşunun o andaki hizmet kapsamına göre değişebilir; nihai liste ödeme adımında gösterilir."
        ],
        "bullets": [
          "Kredi kartı: Visa, Mastercard ve Troy logolu, Türkiye'de veya yurt dışında ihraç edilmiş kredi kartları.",
          "Banka kartı (debit): Bakiye yeterliliği ve kartın internetten alışverişe açık olması koşuluyla.",
          "3D Secure ile doğrulanmış kart işlemleri: Kart hamilinin bankası tarafından ek doğrulama istenen güvenli akış.",
          "Taksitli ödeme: Yalnızca taksite uygun kredi kartlarında ve ödeme sayfasında gösterilen taksit adetleriyle.",
          "Havale / EFT / FAST: Satıcının banka hesabına yapılan doğrudan transfer.",
          "Dijital cüzdan ve mobil ödeme çözümleri: Ödeme kuruluşunun desteklediği ölçüde ödeme sayfasında sunulur.",
          "Hediye çeki ve mağaza kredisi: Satıcı tarafından düzenlenmiş, tek kullanımlık koda bağlı bakiyeler.",
          "Kapıda ödeme: Şu an için sunulmamaktadır; ileride sunulması hâlinde koşulları bu metinde ayrıca duyurulur."
        ]
      },
      {
        "heading": "6. Sipariş Tutarının Sunucu Tarafında Yeniden Hesaplanması",
        "paragraphs": [
          "Ödeme tutarı hiçbir koşulda tarayıcınızdan veya sepet verisinden gelen değerle bankaya iletilmez. Sepetiniz sunucuya yalnızca ürün kimlikleri, varyant seçimleri ve adetler olarak ulaşır; ödenecek tutar, sipariş anında veri tabanındaki güncel ürün ve varyant fiyatları esas alınarak sunucu tarafında yeniden hesaplanır.",
          "Bu hesaplama zinciri kırılmadan işletilir ve sonucunda oluşan tutar, ödeme isteğiyle birlikte sanal POS'a gönderilen tek geçerli tutardır. İstemci tarafında yapılan herhangi bir müdahale (fiyat alanının değiştirilmesi, indirim oranının elle düzenlenmesi, ağ isteğinin yeniden yazılması) sonucu değiştirmez; uyuşmazlık hâlinde sunucu kaydı esas alınır."
        ],
        "ordered": [
          "Sepetteki her kalem için ürün kaydı okunur; ürün pasifse veya stoktan kalkmışsa kalem sepetten düşülür ve size bildirilir.",
          "Varyant seçilmişse varyantın fiyat farkı (priceDeltaMinor) ürün fiyatına eklenir; pasif varyantlar reddedilir.",
          "Adet, stok miktarı ile karşılaştırılır; stok yetersizse sipariş oluşturulmaz ve uyarı gösterilir.",
          "Kalem tutarları kuruş tabanında toplanarak ara toplam bulunur.",
          "Varsa promosyon kodu sunucuda yeniden doğrulanır ve indirim ara toplamdan düşülür.",
          "Teslimat yöntemine göre kargo ücreti eklenir.",
          "KDV dâhil nihai tutar oluşturulur ve sipariş kaydına yazılır.",
          "Yalnızca bu nihai tutar üzerinden sanal POS'a ödeme isteği gönderilir."
        ]
      },
      {
        "heading": "7. Promosyon Kodu, Hediye Çeki ve İndirimlerin Doğrulanması",
        "paragraphs": [
          "Sepette girdiğiniz promosyon kodu, ödeme öncesinde sunucu tarafında yeniden doğrulanır. Doğrulama; kodun var olup olmadığını, aktiflik durumunu, geçerlilik tarih aralığını, asgari sepet tutarı koşulunu, toplam ve kişi başı kullanım limitini ve kodun hangi ürün veya kategorilerde geçerli olduğunu kapsar.",
          "Doğrulamayı geçemeyen kod, ödeme adımına taşınmaz; indirimsiz tutar üzerinden işlem yapılmadan önce size bildirim gösterilir ve onayınız beklenir. Bu sayede, kodun geçersiz olduğu hâllerde beklediğinizden yüksek bir tutarın kartınızdan çekilmesi engellenir.",
          "Hediye çeki ve mağaza kredisi bakiyeleri de aynı biçimde sunucuda tutulur ve harcandığı anda düşülür. Hediye çeki bakiyesi nakde çevrilemez; sipariş iptal veya iade edilirse, çekten kullanılan kısım kart iadesi olarak değil, hediye çeki bakiyesi olarak size geri yüklenir.",
          "Aynı siparişte birden fazla promosyon kodunun birlikte kullanılabilmesi, kodların tanımında açıkça izin verilmesine bağlıdır. Kampanya koşullarına aykırı, otomatik araçlarla veya kötüye kullanım amacıyla üretilmiş kod kullanımlarında Satıcı, siparişi iptal ederek tahsil edilen tutarı iade etme hakkını saklı tutar."
        ]
      },
      {
        "heading": "8. Kargo Ücretinin Ödemeye Yansıması",
        "paragraphs": [
          "Kargo ücreti, ödeme özetinde ayrı bir satır olarak gösterilir ve tahsil edilen toplam tutara dâhildir. Ücretin hesabında sepetin indirim sonrası ara toplamı esas alınır."
        ],
        "table": [
          {
            "key": "Türkiye geneli (500 TL ve üzeri sepet)",
            "value": "Ücretsiz"
          },
          {
            "key": "Türkiye geneli (500 TL altı sepet)",
            "value": "39 TL"
          },
          {
            "key": "İstanbul içi motokurye",
            "value": "89 TL"
          },
          {
            "key": "Türkiye içi taşıyıcı",
            "value": "Yurtiçi Kargo"
          },
          {
            "key": "KKTC ve yurt dışı taşıyıcı",
            "value": "Aras Kargo"
          }
        ]
      },
      {
        "heading": "9. Ödemenin Alındığı Altyapı ve Kart Verisinin Saklanmaması",
        "paragraphs": [
          "Kart ile yapılan ödemeler, {{SITE}} tarafından değil; 6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun uyarınca yetkilendirilmiş banka veya ödeme kuruluşunun sanal POS altyapısı üzerinden alınır. Kart bilgilerinizi girdiğiniz ekran, ödeme kuruluşunun kendi güvenli sayfası veya onun tarafından sağlanan yalıtılmış ödeme bileşenidir.",
          "Kart numarası, son kullanma tarihi, CVV/CVC güvenlik kodu ve 3D Secure şifresi {{SITE}} sunucularına hiçbir aşamada iletilmez, bu sunucularda işlenmez ve saklanmaz. Bu verileri Satıcı görmez; dolayısıyla Satıcının bu verileri paylaşması, kaybetmesi veya yeniden kullanması teknik olarak mümkün değildir.",
          "Kart verisinin güvenliğine ilişkin PCI-DSS standardına uygunluk, bu verileri işleyen ödeme kuruluşunun sorumluluğundadır. Satıcı, yalnızca PCI-DSS kapsamında geçerli uygunluğu bulunan kuruluşlarla çalışır ve entegrasyonu bu kuruluşun belirlediği güvenli yönteme göre kurar.",
          "Satıcının sistemlerinde ödeme işlemine ilişkin olarak yalnızca kart verisi niteliği taşımayan işlem üstverileri tutulur: ödeme sağlayıcı referans numarası, işlem durumu, tutar, para birimi, işlem zamanı, taksit adedi, 3D Secure doğrulama sonucu ve kart markası ile kart numarasının maskelenmiş son dört hanesi gibi kayıtlar. Bu kayıtlar mutabakat, iade ve itiraz süreçleri için gereklidir.",
          "Kart saklama (tokenizasyon) özelliği kullanıma sunulursa, kart bilgisi yine Satıcıda değil ödeme kuruluşunda saklanır ve Satıcıya yalnızca kart verisi içermeyen, tek başına ödeme yapmaya elverişli olmayan bir simge (token) iletilir. Bu özellik, açık onayınız olmadan devreye alınmaz ve üyelik hesabınızdan istediğiniz an kapatılabilir."
        ]
      },
      {
        "heading": "10. 3D Secure Doğrulama Akışı",
        "paragraphs": [
          "Kart ile yapılan ödemelerde, kartı çıkaran bankanın ve kart kuruluşu kurallarının izin verdiği ölçüde 3D Secure doğrulaması uygulanır. Doğrulamanın başarısız olduğu işlemler tamamlanmaz ve sipariş oluşmaz. Aşağıdaki akış, ödemenin uçtan uca nasıl ilerlediğini gösterir."
        ],
        "ordered": [
          "Sepetinizi onaylar, teslimat ve fatura bilgilerinizi doldurur, Ön Bilgilendirme Formu ile Mesafeli Satış Sözleşmesi'ni ayrı onay kutucuğuyla onaylarsınız.",
          "Sunucu, siparişi 'ödeme bekliyor' durumunda oluşturur ve nihai tutarı 6. maddedeki yöntemle yeniden hesaplar.",
          "Kart bilgileriniz, ödeme kuruluşunun güvenli ekranına doğrudan girilir; bu veri Satıcı sunucularından geçmez.",
          "Ödeme kuruluşu, kartın 3D Secure programına kayıtlı olup olmadığını sorgular ve sizi kartı çıkaran bankanın doğrulama ekranına yönlendirir.",
          "Bankanız, cep telefonunuza gönderilen tek kullanımlık şifre, mobil bankacılık onayı veya biyometrik doğrulama ile kimliğinizi teyit eder.",
          "Doğrulama başarılıysa banka, işleme ilişkin doğrulama sonucunu ödeme kuruluşuna iletir ve otorizasyon (provizyon) talebi oluşturulur.",
          "Provizyon onaylanırsa ödeme kuruluşu, sonucu hem tarayıcınıza hem de sunucumuza güvenli bildirim (webhook) ile iletir.",
          "Sunucu, gelen bildirimin imzasını HMAC-SHA256 yöntemiyle doğrular; imza geçersizse bildirim reddedilir ve sipariş durumu değiştirilmez.",
          "İmza geçerliyse sipariş 'ödendi' durumuna geçer, stok düşülür, sipariş onay e-postası gönderilir ve fatura süreci başlar.",
          "Doğrulama veya provizyon başarısızsa sipariş 'ödeme bekliyor' durumunda kalır, stok düşülmez ve size hata nedeni gösterilerek yeniden deneme imkânı sunulur."
        ]
      },
      {
        "heading": "11. Ön Provizyon ve Provizyon Kapama",
        "paragraphs": [
          "Bazı işlemlerde, özellikle stok teyidi veya dolandırıcılık kontrolü gerektiren hâllerde, tutar doğrudan tahsil edilmek yerine önce ön provizyon ile kart limitinizde bloke edilebilir. Ön provizyon, tutarın kartınızdan tahsil edildiği anlamına gelmez; yalnızca limitinizde geçici bir bloke oluşturur.",
          "Sipariş hazırlanmaya alındığında ön provizyon kapatılır (capture) ve tutar bu aşamada tahsil edilir. Kapama tutarı, hiçbir hâlde onayladığınız sipariş tutarını aşamaz; kalemlerden bir kısmının karşılanamaması hâlinde yalnızca karşılanan kalemler kadarlık kısım kapatılır ve fark bloke edilmeden çözülür.",
          "Sipariş iptal edilirse ön provizyon serbest bırakılır. Blokenin kart limitinize geri yansıması bankanızın iç işleyişine bağlıdır ve kart kuruluşu kurallarına göre birkaç iş günü sürebilir. Bu süre Satıcının denetiminde değildir; ancak Satıcı, serbest bırakma talimatının ödeme kuruluşuna iletildiğine dair kaydı talebiniz üzerine sizinle paylaşır.",
          "Ön provizyon uygulanan işlemlerde, blokenin oluştuğu ve kapatıldığı tarihler sipariş kaydında ayrı ayrı tutulur; sipariş detay sayfanızdan ve talebiniz üzerine {{EMAIL}} adresinden görüntülenebilir."
        ]
      },
      {
        "heading": "12. Taksit, Vade Farkı ve Banka Kampanyaları",
        "paragraphs": [
          "Taksitli ödeme yalnızca taksite uygun kredi kartlarında ve ödeme sayfasında o an gösterilen taksit seçenekleriyle mümkündür. Hangi kartın kaç taksit yapabileceği, kartı çıkaran bankanın ve kart kuruluşunun kurallarıyla belirlenir; Satıcının bu kuralları değiştirme yetkisi yoktur.",
          "Taksit seçeneğine vade farkı yansıtılıyorsa, vade farkı dâhil toplam tutar ve aylık taksit tutarı ödeme adımında, onayınız alınmadan önce açıkça gösterilir. Onayınız, gösterilen toplam tutar üzerinden verilmiş sayılır; ekranda gösterilmeyen hiçbir vade farkı sonradan talep edilmez.",
          "Bankaların kendi inisiyatifiyle sunduğu ek taksit, erteleme, puan, mil veya nakit iade kampanyalarının koşulları ve yürütülmesi tamamen ilgili bankanın sorumluluğundadır. Satıcı bu kampanyaların uygulanacağını taahhüt etmez; kampanyanın uygulanmaması hâlinde başvurunuzu kartınızı çıkaran bankaya yöneltmeniz gerekir. Bu hüküm, Satıcının kendi yürüttüğü kampanyalara ilişkin sorumluluğunu ortadan kaldırmaz.",
          "Taksitli bir siparişte iptal veya iade söz konusu olduğunda, iade tutarı karta tek seferde iade edilir; ancak bankanız iadeyi kalan taksitlerden mahsup ederek ekstrenize aylara yayılmış biçimde yansıtabilir. Bu, bankanın taksitli işlem muhasebesinden kaynaklanır ve Satıcının iade tutarını eksik gönderdiği anlamına gelmez.",
          "Bazı kart tipleri (banka kartları, ön ödemeli kartlar, kurumsal kartlar ve yabancı bankaların kartları) taksitli işleme kapalı olabilir. Bu durumda ödeme sayfasında yalnızca tek çekim seçeneği gösterilir."
        ]
      },
      {
        "heading": "13. Havale, EFT ve FAST ile Ödeme",
        "paragraphs": [
          "Havale/EFT seçeneğini seçmeniz hâlinde, siparişiniz 'ödeme bekliyor' durumunda oluşturulur ve transfer için gerekli hesap bilgileri sipariş özeti ekranında ve sipariş onay e-postasında tarafınıza bildirilir. Transferin açıklama alanına sipariş numaranızı yazmanız, ödemenizin otomatik eşleştirilmesi bakımından önemlidir.",
          "Havale/EFT ile ödenecek siparişler, oluşturulmalarından itibaren üç iş günü içinde ödenmezse otomatik olarak iptal edilir ve rezerve edilen stok serbest bırakılır. İptalden sonra ulaşan transferler, masraflar düşülmeksizin gönderen hesaba iade edilir.",
          "Transferin Satıcı hesabına eksik ulaşması hâlinde (aracı banka masrafları vb.) eksik kalan tutarı tamamlamanız istenir; tamamlanmadığı sürece sipariş hazırlanmaya alınmaz. Fazla ulaşan tutarlar, talebiniz beklenmeksizin gönderen hesaba iade edilir.",
          "Havale/EFT ile ödenen siparişlerde iade, kart iadesi olarak değil, ödemeyi yaptığınız hesaba banka transferi olarak gerçekleştirilir. Bu nedenle iade talebinizde hesap sahibinin adı ile IBAN bilgisini iletmeniz gerekir; üçüncü kişilere ait hesaplara iade yapılmaz."
        ],
        "table": [
          {
            "key": "Hesap sahibi",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Banka",
            "value": "{{BANK}}"
          },
          {
            "key": "IBAN",
            "value": "{{IBAN}}"
          },
          {
            "key": "Açıklama alanına yazılacak",
            "value": "Sipariş numaranız"
          },
          {
            "key": "Ödeme için tanınan süre",
            "value": "3 iş günü"
          }
        ]
      },
      {
        "heading": "14. Dijital Cüzdan ve Alternatif Ödeme Yöntemleri",
        "paragraphs": [
          "Ödeme kuruluşunun desteklemesi hâlinde dijital cüzdan ve mobil ödeme çözümleri ödeme sayfasında sunulur. Bu yöntemlerde de kart veya hesap bilgileriniz {{SITE}} sunucularına iletilmez; doğrulama ve tahsilat tamamen ilgili cüzdan sağlayıcısının ortamında gerçekleşir ve Satıcıya yalnızca işlem sonucu bildirilir.",
          "Dijital cüzdan üzerinden yapılan ödemelerde, cüzdan sağlayıcısının kendi kullanım koşulları ve gizlilik politikası da uygulanır. Cüzdan hesabınızın askıya alınması, bakiye yetersizliği veya sağlayıcı kaynaklı arıza hâllerinde işlem gerçekleşmez; bu hâllerde diğer ödeme yöntemleriyle yeniden deneyebilirsiniz.",
          "Alternatif ödeme yöntemleriyle yapılan işlemlerin iadesi, mevzuat ve kart kuruluşu kuralları gereği ödemenin yapıldığı kanala yapılır. Ödemeyi hangi yöntemle yaptıysanız iade de aynı yöntemle ve aynı hesaba gerçekleştirilir."
        ]
      },
      {
        "heading": "15. Başarısız Ödeme ve Yeniden Deneme",
        "paragraphs": [
          "Ödemenin başarısız olması hâlinde siparişiniz oluşmaz veya 'ödeme bekliyor' durumunda kalır; stok düşülmez ve hiçbir tutar tahsil edilmez. Size gösterilen hata mesajı, bankanın döndüğü sonuç koduna göre olabildiğince anlaşılır biçimde açıklanır; ancak güvenlik gereği bankalar red gerekçesini her zaman ayrıntılı bildirmez.",
          "Ödemenin başarısız olmasının başlıca nedenleri şunlardır: yetersiz limit veya bakiye, kartın internetten alışverişe kapalı olması, 3D Secure doğrulamasının zaman aşımına uğraması veya iptal edilmesi, yanlış girilen kart bilgileri, kartın yurt dışı işlemlere kapalı olması, bankanın risk kurallarınca işlemin reddedilmesi ve taksit seçeneğinin karta uygun olmaması.",
          "Aynı sipariş için yeniden deneme yapabilirsiniz. Yeniden denemede sipariş numarası korunur, tutar 6. maddedeki yöntemle yeniden hesaplanır ve yeni bir ödeme referansı üretilir. Arka arkaya çok sayıda başarısız denemede, dolandırıcılık korumaları gereği kısa süreli bekleme uygulanabilir.",
          "Başarısız denemelerde bankanız ekstrenizde geçici bir bloke gösterebilir. Provizyon alınamamış bir işlemde tahsilat yapılmadığı için bu bloke, bankanızın iç süreçlerine bağlı olarak kendiliğinden çözülür. Blokenin makul sürede çözülmemesi hâlinde {{EMAIL}} adresine yazmanız durumunda işlem kaydınızı sizinle paylaşır ve ödeme kuruluşu nezdinde takip başlatırız."
        ]
      },
      {
        "heading": "16. Mükerrer Çekim, Idempotency ve Tekillik Güvencesi",
        "paragraphs": [
          "Ödeme kuruluşundan gelen her başarılı ödeme bildirimi, sağlayıcının ürettiği tekil referans numarası ile birlikte kaydedilir. Bu referans, veri tabanında tekil (unique) kısıt altındadır; aynı referansla ikinci bir bildirim gelse dahi sipariş yalnızca bir kez 'ödendi' durumuna geçer, ikinci kayıt oluşturulmaz ve stok ikinci kez düşülmez.",
          "Bu tasarım, ağ kesintisi veya sağlayıcı tekrar denemesi nedeniyle aynı bildirimin birden çok kez ulaşması hâlinde bile mükerrer sipariş ve mükerrer stok hareketi oluşmasını engeller. Bildirim uçları imza doğrulaması yapar; imzası geçersiz bildirimler işleme alınmaz.",
          "Buna rağmen bankanız aynı tutarı iki kez tahsil etmişse (örneğin ödeme sayfasının yenilenmesi sonucu iki ayrı otorizasyon oluşmuşsa), fazla çekilen tutar tespit edildiği anda re'sen iade edilir; ayrıca talep etmeniz gerekmez. Tespit için ödeme kuruluşu kayıtları ile banka mutabakat dosyaları karşılaştırılır.",
          "Mükerrer çekim şüphesi taşıyan bir işlemi {{EMAIL}} adresine bildirmeniz hâlinde, başvurunuz kayda alınır ve inceleme sonucu tarafınıza yazılı olarak bildirilir. İncelemede sipariş numarası, işlem tarihi, tutar ve kart numarasının son dört hanesi yeterlidir; kartınızın tam numarasını, CVV kodunu veya şifrenizi hiçbir kanaldan bizimle paylaşmayınız."
        ]
      },
      {
        "heading": "17. Ödeme Öncesi Onay, Delil Kaydı ve Sözleşme Sürümü",
        "paragraphs": [
          "Ödeme adımında, Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi ayrı bir onay kutucuğu ile onaylanır. Bu kutucuk önceden işaretlenmiş olarak sunulmaz; onay vermeden ödeme adımına geçilemez. Onayladığınız metinlerin tam hâli sipariş onay e-postanıza eklenir ve üyelik hesabınızdan her zaman görüntülenebilir.",
          "Onayın hukuken kanıtlanabilir olması için, onay anına ilişkin şu kayıtlar sipariş kaydına yazılır: onay tarihi ve saati, IP adresi, tarayıcı bilgisi (user-agent) ve onaylanan belgelerin sürüm numarası. Bu kayıtlar, hangi metnin hangi sürümünü onayladığınızı sonradan tereddütsüz belirlemek için tutulur.",
          "Sipariş yalnızca e-posta adresi doğrulanmış üye hesabıyla verilebilir. Doğrulanmış e-posta adresi, sipariş onayı, ödeme bildirimi, kargo takibi ve iade yazışmalarının tebliğ adresi olarak kullanılır.",
          "Taraflar; sipariş kayıtlarının, ödeme sağlayıcı işlem kayıtlarının, sunucu günlüklerinin, değiştirilemez yönetici olay kayıtlarının (audit log) ve elektronik posta kayıtlarının, 6100 sayılı Hukuk Muhakemeleri Kanunu'nun delil sözleşmesine ilişkin hükmü (m.193) uyarınca kesin delil teşkil edeceğini kabul eder. Bu hüküm, tüketicinin kendi delillerini sunma ve karşı delil gösterme hakkını ortadan kaldırmaz."
        ]
      },
      {
        "heading": "18. Fatura ve e-Arşiv",
        "paragraphs": [
          "Ödemesi tamamlanan her sipariş için 213 sayılı Vergi Usul Kanunu ve ilgili tebliğler uyarınca e-arşiv fatura düzenlenir. Fatura, sipariş sırasında bildirdiğiniz fatura bilgileri esas alınarak kesilir ve doğrulanmış e-posta adresinize elektronik ortamda gönderilir; ayrıca sipariş kaydınızdan indirilebilir.",
          "Bireysel alıcılarda ad, soyad ve adres; kurumsal alıcılarda ticaret unvanı, vergi dairesi ve vergi kimlik numarası zorunludur. Bu bilgilerin eksik veya hatalı bildirilmesinden doğan fatura düzeltme yükü alıcıya aittir; düzeltme talebinizi {{EMAIL}} adresine iletmeniz hâlinde mevzuatın izin verdiği ölçüde düzeltme yapılır.",
          "Faturanın elektronik ortamda gönderilmesine onay vermiş sayılırsınız; matbu fatura talep etmeniz hâlinde talebiniz mevzuat çerçevesinde değerlendirilir.",
          "İade ve iptal hâllerinde, işlemin niteliğine göre iade faturası düzenlenir veya tarafınızdan iade faturası ya da imzalı iade beyanı istenir. Bu belge, iade tutarının bankaya iletilmesinin ön koşulu değildir; muhasebe kaydının tamamlanması amacıyla istenir."
        ]
      },
      {
        "heading": "19. İptal, Cayma ve İade Sürecinin Ödeme Ayağı",
        "paragraphs": [
          "Mesafeli Sözleşmeler Yönetmeliği uyarınca, kural olarak malı teslim aldığınız tarihten itibaren on dört gün içinde hiçbir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden cayma hakkına sahipsiniz (Yönetmelik m.9). Cayma bildiriminizi {{EMAIL}} adresine veya sitedeki cayma formu üzerinden iletebilirsiniz (Yönetmelik m.12).",
          "Cayma bildiriminin Satıcıya ulaşmasından itibaren on dört gün içinde, teslimat masrafları da dâhil olmak üzere tahsil edilen tutarın tamamı, ödemeyi yaptığınız araca ve aynı kanala iade edilir. İade işlemi için tarafınızdan herhangi bir masraf talep edilmez.",
          "İadenin sanal POS üzerinden ödeme kuruluşuna iletilmesi genellikle aynı iş günü içinde tamamlanır. Tutarın kart hesabınıza yansıması ise kartı çıkaran bankanın süreçlerine bağlıdır ve uygulamada iki ilâ on iş günü arasında sürebilir; kredi kartlarında iade, ekstre dönemine göre bir sonraki hesap özetinizde görünebilir. Bu süre bankadan kaynaklandığı için Satıcının denetiminde değildir; ancak iade talimatının iletildiğine dair kaydı talebiniz üzerine sizinle paylaşırız.",
          "Mesafeli Sözleşmeler Yönetmeliği'nin cayma hakkının istisnalarını düzenleyen hükmü (m.15) gereği; çabuk bozulabilen veya son kullanma tarihi geçebilecek gıda ürünlerinde, tesliminden sonra ambalajı açılmış olup iadesi sağlık ve hijyen açısından uygun olmayan ürünlerde ve tüketicinin istekleri doğrultusunda kişiselleştirilerek hazırlanan ürünlerde cayma hakkı kullanılamaz. Bu istisna, ayıplı mal hükümlerinden doğan haklarınızı ortadan kaldırmaz."
        ]
      },
      {
        "heading": "20. Kısmi İade ve Kısmi İptal",
        "paragraphs": [
          "Bir siparişin yalnızca bazı kalemlerini iade etmeniz mümkündür. Bu durumda iade tutarı, iade edilen kalemlerin KDV dâhil bedeli üzerinden hesaplanır ve sipariş kaydına kalem bazında işlenir; hangi kalemin ne zaman ve hangi tutarla iade edildiği kayıt altına alınır.",
          "Kısmi iadelerde, indirim veya promosyon kodu kullanılmışsa, indirim tutarı iade edilen kalemlere düşen oran kadar mahsup edilir. Böylece kalan siparişin indirimli tutarı korunur ve indirimden mükerrer yararlanma önlenir.",
          "Kargo ücreti, siparişin tamamının iadesi hâlinde iade edilir. Kısmi iadede, kalan kalemler ücretsiz kargo eşiğinin altına düşerse, kampanya koşulları gereği kargo bedeli iade tutarından mahsup edilebilir; bu mahsup iade özetinde açıkça gösterilir.",
          "Kısmi iadeler ödeme kuruluşuna ayrı işlemler olarak iletilir. Toplam iade tutarı, hiçbir hâlde tahsil edilen tutarı aşamaz; bu kontrol sunucu tarafında zorunlu kural olarak uygulanır."
        ]
      },
      {
        "heading": "21. Chargeback (Kart İtirazı) Süreci",
        "paragraphs": [
          "Kart hamili, işleme ilişkin bir itirazı olduğunda kartı çıkaran bankasına başvurarak ters ibraz (chargeback) süreci başlatabilir. Süreç, 5464 sayılı Banka Kartları ve Kredi Kartları Kanunu çerçevesinde ve uluslararası kart kuruluşlarının kurallarına göre yürütülür; süreleri ve sonuçları banka ile kart kuruluşu belirler.",
          "Satıcı, kendisine iletilen itirazlara ilişkin belgeleri kart kuruluşunun tanıdığı süre içinde ödeme kuruluşuna sunar. Bir itirazın haklı bulunması hâlinde tutar kart hamiline iade edilir; haksız bulunması hâlinde işlem geçerliliğini korur.",
          "İtiraz sürecine başvurmadan önce doğrudan {{EMAIL}} adresine yazmanızı öneririz. Çoğu uyuşmazlık (teslim edilmeyen sipariş, eksik kalem, mükerrer çekim, tanınmayan işlem adı) doğrudan iletişimle günler içinde çözülebilirken, banka itiraz süreci haftalar sürebilir."
        ],
        "bullets": [
          "İtiraz incelemesinde sizden istenebilecek bilgiler: sipariş numarası, işlem tarihi ve saati.",
          "Tahsil edilen tutar ve para birimi ile itiraza konu tutar.",
          "Kart markası ve kart numarasının yalnızca son dört hanesi (tam numara asla istenmez).",
          "Bankanızın işleme ilişkin ekstre veya işlem dökümü görüntüsü.",
          "İtirazın gerekçesi: teslim alınmadı, eksik/ayıplı teslim, mükerrer çekim, tutar farkı veya işlemin tanınmaması.",
          "İşlem tanınmıyorsa, kartın kaybolduğu veya çalındığına ilişkin bankaya bildirim tarihi.",
          "Kargo ile ilgili itirazlarda taşıyıcı takip numarası ve varsa teslim tutanağı."
        ]
      },
      {
        "heading": "22. Yurt Dışı Kart Kullanımı ve Döviz",
        "paragraphs": [
          "{{SITE}} üzerindeki tüm işlemler Türk Lirası (TRY) cinsinden gerçekleştirilir. Yurt dışında ihraç edilmiş bir kartla ödeme yapmanız hâlinde de bankaya iletilen tutar TRY'dir; kartınızın para birimine dönüşüm, kartı çıkaran banka veya kart kuruluşu tarafından kendi kur ve komisyon politikasına göre yapılır.",
          "Kur farkı, yurt dışı işlem komisyonu, sınır ötesi işlem ücreti ve benzeri kesintiler tamamen kartınızı çıkaran kuruluşun tarifesine tabidir ve Satıcının tahsilatına dâhil değildir. Bu nedenle ekstrenizde gördüğünüz tutar, sipariş özetindeki TRY tutarın kendi para biriminizdeki karşılığından farklı olabilir.",
          "İade hâllerinde Satıcı, tahsil edilen TRY tutarın tamamını iade eder. İade tarihindeki kur, ödeme tarihindeki kurdan farklı olabileceğinden kendi para biriminizde küçük bir fark oluşabilir; bu fark bankanızın kur uygulamasından kaynaklanır ve Satıcı tarafından eksik iade yapıldığı anlamına gelmez.",
          "Bazı yabancı kartlar, kartı çıkaran kuruluşun risk politikası gereği Türkiye'deki üye iş yerlerinde işlem yapmaya kapalı olabilir. Bu tür redler Satıcı kaynaklı değildir; alternatif bir kart veya ödeme yöntemi ile yeniden deneyebilirsiniz."
        ]
      },
      {
        "heading": "23. Ödeme Güvenliği ve Dolandırıcılık Kontrolü",
        "paragraphs": [
          "Satıcı, ödeme süreçlerinin güvenliği için 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun veri güvenliğine ilişkin yükümlülükleri (m.12) ile sektörde kabul görmüş teknik tedbirleri birlikte uygular. Uygulanan başlıca önlemler aşağıda sıralanmıştır."
        ],
        "bullets": [
          "Tüm site trafiği HTTPS/TLS ile şifrelenir; ödeme adımı yalnızca güvenli bağlantı üzerinden çalışır.",
          "Kart verisi Satıcı sistemlerine hiç girmediğinden, bu veriye yönelik bir sızıntı riski Satıcı tarafında oluşmaz.",
          "Ödeme bildirimleri (webhook) HMAC-SHA256 imzası ile doğrulanır ve karşılaştırma zamanlama saldırılarına kapalı yöntemle yapılır; imzası geçersiz bildirim 401 ile reddedilir.",
          "Tutar, promosyon ve stok doğrulaması yalnızca sunucuda yapılır; istemciden gelen hiçbir fiyat bilgisine güvenilmez.",
          "Veri tabanında satır düzeyinde güvenlik (RLS) etkindir; veriye yalnızca sunucu tarafı yetkili anahtarla erişilir.",
          "Yönetici hesapları TOTP tabanlı iki aşamalı doğrulama ile korunur; giriş denemelerine hız sınırı uygulanır.",
          "Tüm yönetici işlemleri, sonradan değiştirilemeyen olay kaydına (audit log) yazılır.",
          "Anormal sipariş örüntüleri (kısa sürede çok sayıda başarısız deneme, uyuşmayan fatura ve teslimat bilgileri, riskli tutar sıçramaları) manuel incelemeye alınabilir.",
          "İnceleme sonucunda dolandırıcılık şüphesi güçlenirse sipariş iptal edilir, tahsil edilmiş tutar iade edilir ve gerektiğinde yetkili mercilere bildirim yapılır.",
          "Şifreler bcrypt algoritmasıyla özetlenerek saklanır; düz metin parola hiçbir yerde tutulmaz."
        ]
      },
      {
        "heading": "24. Ödeme Verilerinin İşlenmesi ve Saklanması",
        "paragraphs": [
          "Ödeme işlemine ilişkin üstveriler, 6698 sayılı Kanun'un genel ilkeleri (m.4) ve işleme şartları (m.5) çerçevesinde; sözleşmenin kurulması ve ifası, hukuki yükümlülüklerin yerine getirilmesi ve meşru menfaat hukuki sebeplerine dayanılarak işlenir. Ayrıntılı bilgi, sitede yayımlanan Aydınlatma Metni ve Gizlilik Politikası'nda yer alır.",
          "Ödeme kayıtları, 213 sayılı Vergi Usul Kanunu ile 6102 sayılı Türk Ticaret Kanunu'nun defter ve belge saklama süreleri boyunca muhafaza edilir. Sürenin dolması hâlinde kayıtlar, Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik uyarınca silinir, yok edilir veya anonim hâle getirilir.",
          "Ödeme kuruluşu ile paylaşılan veriler, işlemin gerçekleştirilmesi için zorunlu olan asgari veriyle sınırlıdır. Kullanılan barındırma, veri tabanı ve işlemsel e-posta hizmetlerinin sunucularının yurt dışında bulunması hâlinde aktarım, 6698 sayılı Kanun'un yurt dışına aktarıma ilişkin hükmüne (m.9) uygun biçimde yapılır.",
          "Kişisel verilerinize ilişkin olarak 6698 sayılı Kanun'un ilgili kişinin haklarını düzenleyen hükmü (m.11) kapsamındaki taleplerinizi {{EMAIL}} adresine iletebilirsiniz. Başvurular, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca en geç otuz gün içinde sonuçlandırılır."
        ]
      },
      {
        "heading": "25. Ödeme Altyapısı Kesintileri ve Mücbir Sebep",
        "paragraphs": [
          "Banka, ödeme kuruluşu, kart kuruluşu veya barındırma sağlayıcısı kaynaklı kesinti, bakım ve arıza hâllerinde ödeme geçici olarak alınamayabilir. Bu durumda siparişiniz oluşmaz ve tahsilat yapılmaz; kesinti giderildiğinde işlemi yeniden deneyebilirsiniz.",
          "Kesintinin ödeme sırasında ortaya çıkması ve tutarın kartınızda bloke kalması hâlinde, bloke provizyon kapatılmadığı için bankanızca serbest bırakılır. Serbest bırakılmadığını düşünüyorsanız {{EMAIL}} adresine yazmanız üzerine işlem kaydınız incelenerek sonuç tarafınıza bildirilir.",
          "Doğal afet, yangın, salgın, siber saldırı, yaygın altyapı arızası, grev ve resmî makam kararları gibi mücbir sebep hâllerinde Satıcının edim yükümlülüğü, mücbir sebep süresince ve onunla sınırlı olmak üzere askıya alınır. Bu hâller, ödemesi alınmış bir siparişin karşılanamaması durumunda bedelin iade edilmesi yükümlülüğünü ortadan kaldırmaz.",
          "Satıcı, ödeme altyapısı sağlayıcısını değiştirme hakkını saklı tutar. Sağlayıcı değişikliği, halihazırda tamamlanmış işlemlerin iade ve itiraz süreçlerini etkilemez; bu işlemler eski sağlayıcının kayıtları üzerinden yürütülür."
        ]
      },
      {
        "heading": "26. Temerrüt ve Ödemenin Gerçekleşmemesi",
        "paragraphs": [
          "Kart ile yapılan ödemelerde tahsilat, sipariş oluşmadan önce gerçekleştiği için kural olarak bir alacak ilişkisi doğmaz. Ancak havale/EFT gibi sonradan ödeme yöntemlerinde, tanınan süre içinde ödeme yapılmaması hâlinde sipariş iptal edilir ve taraflar arasında sözleşme kurulmamış sayılır.",
          "Kart hamilinin, kartı çıkaran banka ile arasındaki kredi ilişkisinden doğan temerrüt sonuçları (gecikme faizi, akdi faiz vb.) münhasıran banka ile kart hamili arasındadır; Satıcı bu ilişkinin tarafı değildir ve bu nedenle Satıcıdan talepte bulunulamaz.",
          "Satıcının iade yükümlülüğünü mevzuatta öngörülen süre içinde yerine getirmemesi hâlinde tüketici, 6098 sayılı Türk Borçlar Kanunu'nun temerrüde ilişkin hükümleri (m.117 ve devamı) ile 6502 sayılı Kanun'un tanıdığı hakları kullanabilir."
        ]
      },
      {
        "heading": "27. Ödemeye İlişkin Başvuru, İletişim ve Uyuşmazlık Çözümü",
        "paragraphs": [
          "Ödeme, iade, mükerrer çekim ve fatura konularındaki tüm başvurularınızı aşağıdaki kanallardan iletebilirsiniz. Başvurunuzda sipariş numaranızı, işlem tarihini ve tutarı belirtmeniz süreci hızlandırır. Kart numaranızın tamamını, CVV kodunu, 3D Secure şifrenizi veya internet bankacılığı bilgilerinizi hiçbir kanaldan paylaşmayınız; Satıcı bu bilgileri hiçbir gerekçeyle talep etmez.",
          "Başvurularınız en geç üç iş günü içinde yanıtlanır; inceleme gerektiren hâllerde süreç ve sonuç yazılı olarak bildirilir.",
          "Uyuşmazlık hâlinde tüketiciler, her yıl Ticaret Bakanlığınca yeniden değerleme oranında güncellenen parasal sınırlar çerçevesinde yerleşim yerlerindeki veya işlemin yapıldığı yerdeki Tüketici Hakem Heyetlerine ya da Tüketici Mahkemelerine başvurabilir. Tüketici sıfatını taşımayan taraflar bakımından İstanbul (Anadolu) Mahkemeleri ve İcra Daireleri yetkilidir.",
          "Ödeme kuruluşu veya banka kaynaklı olduğu tespit edilen konularda başvurunuzu ilgili kuruluşa yönlendirmeniz gerekebilir; bu hâlde hangi kuruluşa, hangi bilgilerle başvurmanız gerektiği tarafınıza açıkça bildirilir."
        ],
        "table": [
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "Adres",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Instagram",
            "value": "{{IG}}"
          },
          {
            "key": "TikTok",
            "value": "{{TIKTOK}}"
          },
          {
            "key": "YouTube",
            "value": "{{YOUTUBE}}"
          },
          {
            "key": "Sosyal medya kullanıcı adı",
            "value": "{{HANDLE}}"
          }
        ]
      },
      {
        "heading": "28. Yürürlük, Değişiklik ve Sürümleme",
        "paragraphs": [
          "Bu metin, {{SITE_URL}} adresinde yayımlandığı tarihte yürürlüğe girer ve yürürlükte kaldığı sürece {{BRAND}} üzerinden yapılan tüm ödeme işlemlerine uygulanır.",
          "Satıcı, mevzuat değişiklikleri, ödeme altyapısındaki güncellemeler veya yeni ödeme yöntemlerinin eklenmesi hâllerinde bu metni güncelleyebilir. Güncellenen metin sitede yayımlandığı anda yürürlüğe girer; ancak yürürlüğe girdiği tarihten önce onayınızla kurulmuş sözleşmelere, o tarihte yürürlükte olan sürüm uygulanır.",
          "Her siparişte, o anda yürürlükte olan metin sürümü sipariş kaydına yazılır; böylece hangi koşullara tabi olduğunuz sonradan tereddütsüz belirlenebilir.",
          "Bu metnin herhangi bir hükmünün geçersiz veya uygulanamaz sayılması, diğer hükümlerin geçerliliğini etkilemez. Geçersiz sayılan hüküm, tarafların amacına en yakın ve tüketici lehine emredici hukuka uygun biçimde yorumlanır.",
          "Gerçek sanal POS entegrasyonu tamamlanana kadar ödeme adımı, gerçek bir tahsilat yapmayan test (mock) sağlayıcı ile çalışabilir. Bu dönemde ekranda açık uyarı gösterilir ve kartınızdan herhangi bir tutar tahsil edilmez."
        ]
      }
    ]
  },
  {
    "slug": "guvenli-alisveris",
    "title": "Güvenli Alışveriş ve Bilgi Güvenliği",
    "shortTitle": "Güvenli Alışveriş",
    "category": "Ödeme & Güvenlik",
    "summary": "{{BRAND}} online mağazasında kişisel verilerinizin ve ödeme işlemlerinizin hangi teknik ve idari tedbirlerle korunduğunu, kart bilgilerinizin neden hiçbir zaman tarafımızca saklanmadığını ve güvenli alışveriş için sizin alabileceğiniz önlemleri açıklar.",
    "references": [
      "6698 sayılı Kişisel Verilerin Korunması Kanunu (özellikle m.4 genel ilkeler, m.5-6 işleme şartları, m.9 yurt dışına aktarım, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliğine ilişkin yükümlülükler)",
      "Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik",
      "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ",
      "Kişisel Verileri Koruma Kurulu'nun veri ihlali bildirimine ilişkin ilke kararları",
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
      "Mesafeli Sözleşmeler Yönetmeliği (RG: 27.11.2014, 29188)",
      "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun",
      "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İleti Yönetim Sistemi - İYS)",
      "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik",
      "5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun",
      "5464 sayılı Banka Kartları ve Kredi Kartları Kanunu",
      "6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun",
      "5237 sayılı Türk Ceza Kanunu (bilişim sistemlerine yönelik suçlar ve verilerin hukuka aykırı olarak ele geçirilmesine ilişkin hükümler)",
      "6098 sayılı Türk Borçlar Kanunu",
      "6102 sayılı Türk Ticaret Kanunu",
      "6100 sayılı Hukuk Muhakemeleri Kanunu (m.193 delil sözleşmesi)",
      "5846 sayılı Fikir ve Sanat Eserleri Kanunu",
      "6769 sayılı Sınai Mülkiyet Kanunu",
      "213 sayılı Vergi Usul Kanunu",
      "PCI-DSS (Payment Card Industry Data Security Standard) - ödeme kuruluşu ve banka nezdinde uygulanan sektör standardı"
    ],
    "sections": [
      {
        "heading": "1. Amaç, Kapsam ve Tanımlar",
        "paragraphs": [
          "Bu Güvenli Alışveriş ve Bilgi Güvenliği Politikası, {{SITE_URL}} adresinde {{BRAND}} markasıyla yayımlanan internet sitesi ve online mağaza (bottega) üzerinden gerçekleştirilen üyelik, sipariş, ödeme ve teslimat süreçlerinde kişisel verilerin ve işlem güvenliğinin nasıl sağlandığını açıklamak amacıyla hazırlanmıştır. Politika, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun veri güvenliğine ilişkin yükümlülükleri düzenleyen hükümleri ile 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve ilgili ikincil mevzuat çerçevesinde uygulanır.",
          "Politika; site ziyaretçilerini, e-posta adresi doğrulanmış üye hesabı sahiplerini, sipariş veren tüketicileri, {{SHORT_NAME}} çalışanlarını ve Şirket adına veri işleyen tedarikçileri kapsar. Sitede yer alan üçüncü taraf bağlantıları (sosyal medya profilleri, harita servisleri, ödeme kuruluşunun kendi sayfaları) bu Politikanın kapsamı dışındadır; bu platformların kendi güvenlik ve gizlilik uygulamaları geçerlidir.",
          "Bu Politika, Gizlilik ve KVKK Aydınlatma Metni, Çerez Politikası, Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formu ile birlikte bir bütün oluşturur. Bir konu bu Politikada düzenlenmemişse, ilgili diğer belge ve yürürlükteki mevzuat hükümleri uygulanır."
        ],
        "bullets": [
          "Şirket / Satıcı / Veri Sorumlusu: {{LEGAL_NAME}} ({{SHORT_NAME}}).",
          "Marka: {{BRAND}} - Şirket tarafından işletilen kahve ve gelato bar ile online mağazanın ticari markasıdır.",
          "Site: {{SITE_URL}} adresinde yayımlanan internet sitesi ve buna bağlı tüm alt sayfalar.",
          "Kullanıcı: Siteyi ziyaret eden, üye olan veya sipariş veren gerçek kişi.",
          "Kişisel Veri: Kimliği belirli veya belirlenebilir gerçek kişiye ilişkin her türlü bilgi.",
          "İşlem Güvenliği: Verinin aktarımı, saklanması ve işlenmesi sırasında gizliliğini, bütünlüğünü ve erişilebilirliğini koruyan teknik ve idari tedbirlerin bütünü.",
          "Veri İhlali: Kişisel verilerin hukuka aykırı olarak başkaları tarafından elde edilmesi, ifşası, değiştirilmesi veya erişilemez hale gelmesi."
        ]
      },
      {
        "heading": "2. Veri Sorumlusu ve İşletme Bilgileri",
        "paragraphs": [
          "Bu Politika kapsamındaki tüm teknik ve idari tedbirlerden sorumlu veri sorumlusu ve satıcı, aşağıda kimlik bilgileri yer alan tüzel kişidir. Güvenlik konularındaki her türlü bildirim, ihbar ve talep aşağıdaki iletişim kanallarına yöneltilebilir."
        ],
        "table": [
          {
            "key": "Ticaret unvanı",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Kısa unvan",
            "value": "{{SHORT_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "İş yeri adresi",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Vergi dairesi",
            "value": "{{TAX_OFFICE}}"
          },
          {
            "key": "Vergi kimlik numarası",
            "value": "{{TAX_NO}}"
          },
          {
            "key": "Vergi türü",
            "value": "{{TAX_TYPE}}"
          },
          {
            "key": "Faaliyet kodu (NACE)",
            "value": "{{NACE}}"
          },
          {
            "key": "Faaliyete başlama tarihi",
            "value": "{{STARTED_AT}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil numarası",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "Banka",
            "value": "{{BANK}}"
          },
          {
            "key": "IBAN",
            "value": "{{IBAN}}"
          }
        ]
      },
      {
        "heading": "3. Bilgi Güvenliği Yönetim İlkelerimiz",
        "paragraphs": [
          "{{SHORT_NAME}}, bilgi güvenliğini tek seferlik bir kurulum değil, sürekli yürütülen bir yönetim süreci olarak ele alır. Sistem mimarisi, en az yetki, savunma derinliği ve varsayılan olarak güvenli yapılandırma ilkeleri gözetilerek tasarlanmıştır. Aşağıdaki ilkeler, bu Politikanın sonraki maddelerinde tarif edilen somut tedbirlerin dayanağını oluşturur."
        ],
        "ordered": [
          "En az yetki (least privilege): Her kullanıcı, uygulama bileşeni ve servis anahtarı, yalnızca görevini yerine getirmek için ihtiyaç duyduğu asgari yetkiye sahiptir. Yönetim panelindeki roller bu ilkeye göre ayrılmıştır.",
          "Savunma derinliği: Tek bir tedbire güvenilmez. Aktarım şifrelemesi, kimlik doğrulama, yetkilendirme, veri tabanı düzeyinde erişim kısıtı ve olay kaydı birbirini tamamlayan katmanlar olarak birlikte çalışır.",
          "Veri minimizasyonu: 6698 sayılı Kanun'un genel ilkeleri uyarınca, işlendiği amaç bakımından gerekli olmayan veri hiç toplanmaz. Ödeme kartı verisi bu ilkenin en belirgin uygulamasıdır: hiç toplanmaz, dolayısıyla hiç sızdırılamaz.",
          "Varsayılan olarak güvenli yapılandırma: Yeni eklenen her veri tabanı tablosunda satır düzeyi güvenlik açık ve varsayılan politika reddet olacak şekilde oluşturulur; yeni eklenen her yönetim ekranı rol kontrolüyle birlikte devreye alınır.",
          "Hesap verebilirlik: Yönetim panelinde gerçekleştirilen her veri değiştirici işlem, değiştirilemez bir olay kaydına yazılır; böylece bir olayın kim tarafından, ne zaman ve hangi kayıt üzerinde yapıldığı sonradan tespit edilebilir.",
          "Sürekli iyileştirme: Bağımlılıklar, güvenlik danışmanı raporları ve sağlayıcı uyarıları düzenli olarak gözden geçirilir; kritik güvenlik yamaları öncelikli olarak uygulanır.",
          "Tasarımda ve varsayılanda gizlilik: Yeni bir özellik geliştirilirken hangi kişisel verinin neden gerekli olduğu, ne kadar süreyle saklanacağı ve kimin erişeceği önceden kararlaştırılır."
        ]
      },
      {
        "heading": "4. Aktarım Güvenliği: TLS, HSTS ve Çerez Bayrakları",
        "paragraphs": [
          "Tarayıcınız ile sunucularımız arasındaki tüm trafik istisnasız şifrelidir. Site yalnızca HTTPS üzerinden yayımlanır; şifresiz HTTP üzerinden gelen istekler kalıcı yönlendirme ile şifreli kanala aktarılır. Adres çubuğunda kilit simgesini ve alan adının {{SITE}} olduğunu her zaman kontrol etmenizi öneririz."
        ],
        "bullets": [
          "Taşıma katmanı şifrelemesi TLS 1.2 ve üzeri sürümlerle sağlanır; güncel olmayan ve zayıf şifre takımları devre dışıdır. TLS sertifikaları otomatik olarak yenilenir ve süresi dolmadan değiştirilir.",
          "HSTS (HTTP Strict Transport Security) başlığı ile tarayıcıya, alan adımıza yalnızca şifreli bağlantı kurması talimatı verilir. Bu tedbir, araya girme (man-in-the-middle) ve protokol düşürme saldırılarına karşı koruma sağlar.",
          "Oturum ve kimlik çerezleri httpOnly bayrağıyla üretilir; bu sayede çerez içeriği tarayıcıdaki komut dosyaları tarafından okunamaz ve olası bir betik enjeksiyonu durumunda oturum çalınamaz.",
          "Çerezler sameSite bayrağıyla sınırlandırılır; başka bir siteden tetiklenen isteklerde oturum çerezinin gönderilmesi engellenerek siteler arası istek sahteciliği riski azaltılır.",
          "Kimlik doğrulama çerezleri secure bayrağıyla işaretlenir ve yalnızca şifreli bağlantı üzerinden iletilir.",
          "Sunucu yanıtlarına içerik türü koklamayı engelleyen, çerçeve içine gömülmeyi kısıtlayan ve yönlendiren bilgisinin sızmasını sınırlayan güvenlik başlıkları eklenir.",
          "Statik içerik ve sayfalar, sağlayıcının küresel dağıtım ağı üzerinden şifreli olarak sunulur; kaynak sunucuya doğrudan şifresiz erişim yoktur."
        ]
      },
      {
        "heading": "5. Üyelik, Kimlik Doğrulama ve Parola Güvenliği",
        "paragraphs": [
          "Online mağazadan sipariş verebilmek için e-posta adresi doğrulanmış bir üye hesabı gereklidir. Bu zorunluluk yalnızca operasyonel bir tercih değil, aynı zamanda sahte sipariş, kimlik taklidi ve ödeme sahteciliği riskini azaltan bir güvenlik tedbiridir.",
          "Parolanız hiçbir zaman düz metin olarak saklanmaz ve tarafımızca görülemez. Parolalar, her kayıt için ayrı ve rastgele üretilen bir tuz değeri ile birlikte bcrypt algoritması kullanılarak özetlenir (hash); veri tabanında yalnızca bu geri döndürülemez özet tutulur. Bu nedenle parolanızı unutmanız halinde size mevcut parolanız gönderilemez; yalnızca sıfırlama bağlantısı iletilebilir."
        ],
        "bullets": [
          "Kayıt sırasında verilen e-posta adresine benzersiz ve süreli bir doğrulama bağlantısı gönderilir; adres doğrulanmadan sipariş verilemez.",
          "Parola sıfırlama bağlantıları tek kullanımlıktır, kısa süre sonra geçersiz hale gelir ve kullanıldığında mevcut oturumlar sonlandırılabilir.",
          "Giriş yapıldığında oluşturulan oturum çerezi, sunucu tarafında tutulan gizli anahtar ile HMAC SHA-256 kullanılarak imzalanır. İmzası geçersiz veya süresi dolmuş bir çerez kabul edilmez; çerez içeriğinin istemci tarafında değiştirilerek yetki yükseltilmesi mümkün değildir.",
          "Oturumların sınırlı bir geçerlilik süresi vardır; süre dolduğunda yeniden kimlik doğrulaması istenir.",
          "Kimlik bilgisi karşılaştırmaları, işlem süresinden bilgi sızmasını önlemek için sabit zamanlı karşılaştırma fonksiyonlarıyla yapılır.",
          "E-posta adresleri karşılaştırma öncesinde küçük harfe normalleştirilir; böylece aynı hesap için farklı yazımlarla mükerrer kayıt ve karışıklık oluşması engellenir.",
          "Hesabınızın e-posta adresi, parolası veya iletişim bilgileri değiştiğinde bilgilendirme e-postası gönderilebilir; tanımadığınız bir değişiklik bildirimi alırsanız derhal {{EMAIL}} adresine yazmanızı rica ederiz."
        ]
      },
      {
        "heading": "6. Yönetici Erişiminde İki Aşamalı Doğrulama ve Rol Tabanlı Yetkilendirme",
        "paragraphs": [
          "Sipariş, müşteri ve ürün verilerine erişebilen yönetim paneli, internet üzerinden serbestçe erişilebilir bir alan değildir. Panelin tüm rotaları kimlik doğrulama katmanıyla korunur ve oturumu olmayan istekler giriş ekranına yönlendirilir.",
          "Yönetici hesaplarında parolaya ek olarak zaman tabanlı tek kullanımlık kod (TOTP) ile iki aşamalı doğrulama uygulanır. Kod, yöneticinin kendi cihazındaki kimlik doğrulayıcı uygulamada üretilir; SMS gibi araya girmeye daha açık kanallara bağımlı değildir. Parolası ele geçirilmiş bir yönetici hesabı, ikinci aşama olmadan panele erişemez."
        ],
        "bullets": [
          "Yetkiler owner, manager ve staff rolleri arasında ayrılmıştır. Her rol yalnızca görev alanına giren ekranları görür ve yalnızca o ekranlardaki işlemleri yapabilir.",
          "Olay kaydı (audit log) gibi denetim ekranları yalnızca en üst yetki seviyesine açıktır; operasyonel personel bu kayıtları göremez ve değiştiremez.",
          "Rol kontrolü yalnızca arayüzde menü gizleyerek değil, sunucu tarafındaki her işlemde yeniden doğrulanır; doğrudan adres yazarak yetkisiz bir ekrana ulaşmak mümkün değildir.",
          "Yönetici hesapları kişiye özeldir; hesap paylaşımı iç kurallarımızca yasaktır. Böylece olay kayıtlarındaki her işlem gerçek bir kişiye bağlanabilir.",
          "Görevden ayrılan veya görev değişikliği yaşayan personelin erişimi gecikmeksizin kaldırılır ya da yeni rolüne göre daraltılır.",
          "Yönetim paneli üzerinden yapılan işlemlerde müşteri verisine erişim, işin gerektirdiği ölçüyle sınırlıdır; toplu veri dışa aktarımı kısıtlıdır ve kayda tabidir.",
          "Personel, işe başlangıçta gizlilik taahhüdü verir ve kişisel verilerin korunması ile oltalama farkındalığı konusunda bilgilendirilir."
        ]
      },
      {
        "heading": "7. Giriş Denemesi Hız Sınırı ve Geçici Hesap Kilitleme",
        "paragraphs": [
          "Otomatik araçlarla parola deneme (kaba kuvvet) ve başka sitelerden sızmış parola listelerinin denenmesi (credential stuffing) saldırılarına karşı giriş uç noktalarında hız sınırlaması uygulanır.",
          "Yönetici girişinde, kısa bir zaman aralığı içinde art arda başarısız denemeler yapılması halinde hesap geçici olarak kilitlenir. Kilitleme süresi dolduğunda hesap kendiliğinden kullanılabilir hale gelir; kalıcı bir engelleme söz konusu değildir. Bu mekanizma, meşru kullanıcıyı hesabından tümüyle mahrum bırakmadan otomatik saldırıların maliyetini ekonomik olmaktan çıkarmayı hedefler."
        ],
        "bullets": [
          "Başarısız giriş denemeleri sayılır ve eşik aşıldığında ilgili hesap için geçici kilit devreye girer; kilit süresince doğru parola girilse dahi oturum açılmaz.",
          "Başarılı girişte sayaç sıfırlanır.",
          "Hata mesajları, hangi bilginin yanlış olduğunu (e-posta mı, parola mı) açık etmeyecek şekilde nötr tutulur; böylece geçerli hesapların keşfedilmesi zorlaştırılır.",
          "Sipariş oluşturma, parola sıfırlama ve doğrulama e-postası talebi gibi kaynak tüketen uç noktalarda da kötüye kullanımı engellemeye dönük sınırlamalar uygulanır.",
          "Barındırma sağlayıcısının altyapı düzeyindeki saldırı azaltma ve dağıtık hizmet dışı bırakma (DDoS) koruması, uygulama düzeyindeki bu tedbirlere ek bir katman oluşturur.",
          "Olağan dışı yoğunlukta başarısız giriş girişimi tespit edilirse ek doğrulama adımları devreye alınabilir."
        ]
      },
      {
        "heading": "8. Değiştirilemez Olay Kaydı (Append-Only Audit Log)",
        "paragraphs": [
          "Yönetim panelinde gerçekleştirilen veri değiştirici her işlem, yalnızca ekleme yapılabilen (append-only) bir olay kaydına yazılır. Bu kayıtlar arayüz üzerinden düzenlenemez ve silinemez; amaç, bir hata ya da kötüye kullanım şüphesi halinde olayın geriye dönük olarak eksiksiz izlenebilmesidir.",
          "Olay kaydı, 6698 sayılı Kanun'un veri güvenliğine ilişkin yükümlülükleri ile hesap verebilirlik ilkesinin uygulamadaki karşılığıdır. Aynı zamanda ödeme kuruluşu veya banka nezdinde yürütülecek bir itiraz ya da inceleme sürecinde sipariş geçmişinin doğruluğunu destekleyen delil niteliğindedir."
        ],
        "bullets": [
          "Kayda alınan bilgiler: işlemi yapan yönetici hesabının kimliği ve rolü, işlem türü (oluşturma, güncelleme, silme, durum değişikliği), etkilenen kaydın türü ve kimliği, işlem zamanı ve varsa açıklama alanı.",
          "Sipariş durumu değişiklikleri, iade ve kısmi iade işlemleri, stok düzeltmeleri, promosyon kodu tanımlamaları, fiyat ve ürün güncellemeleri ile ayar değişiklikleri kayda tabidir.",
          "Ödeme kartı numarası, güvenlik kodu ve parola gibi hassas veriler olay kaydına hiçbir koşulda yazılmaz.",
          "Stok hareketleri ayrıca ayrı bir hareket defterinde tutulur; her artış ve azalışın gerekçesi ve kaynağı görülebilir.",
          "Kayıtlara erişim yalnızca en üst yetki seviyesindeki hesaplara açıktır ve bu erişim de kendi içinde izlenebilir.",
          "Kayıtlar, ilgili mevzuatın öngördüğü saklama süreleri boyunca muhafaza edilir ve süre sonunda imha politikamıza uygun şekilde işlemden geçirilir."
        ]
      },
      {
        "heading": "9. Veri Tabanı Güvenliği, Satır Düzeyi Güvenlik ve Anahtar Yönetimi",
        "paragraphs": [
          "Müşteri, sipariş ve ürün verileri yönetilen bir PostgreSQL veri tabanında saklanır. Veri tabanı doğrudan internete açık değildir; erişim yalnızca uygulama sunucusu üzerinden ve şifreli bağlantı ile gerçekleşir.",
          "Tüm tablolarda satır düzeyi güvenlik (Row Level Security - RLS) etkindir ve varsayılan politika erişimi reddetmektir. Yani bir tabloya, açıkça izin veren bir politika tanımlanmadıkça hiçbir istemci erişemez. Tarayıcıdan taşınan anahtarlarla müşteri verisine ulaşılamaz."
        ],
        "bullets": [
          "Yüksek yetkili servis anahtarı yalnızca sunucu tarafında, ortam değişkeni olarak tutulur; istemciye gönderilen paketlere hiçbir şekilde dahil edilmez ve tarayıcıdan erişilebilir bir isim alanında yayımlanmaz.",
          "Veri tabanı ile konuşan tüm kod parçaları sunucuya özgüdür ve istemci tarafına derlenmesi teknik olarak engellenmiştir.",
          "Sorgular parametreli olarak çalıştırılır; kullanıcı girdisi doğrudan sorgu metnine gömülmez. Bu, SQL enjeksiyonu riskini yapısal olarak ortadan kaldırır.",
          "Veriler sağlayıcı tarafında disk üzerinde şifreli olarak saklanır (encryption at rest) ve şifreli kanal üzerinden aktarılır.",
          "Şema değişiklikleri sürüm kontrollü göç (migration) dosyalarıyla yapılır; yeni eklenen her tabloda satır düzeyi güvenlik ve erişim politikası aynı anda tanımlanır.",
          "Sır ve anahtarlar kaynak kod deposunda tutulmaz; sağlayıcının şifreli ortam değişkeni deposunda saklanır ve gerektiğinde döndürülür (rotasyon).",
          "Geliştirme ve üretim ortamları birbirinden ayrıdır; geliştirme ortamında gerçek müşteri verisi kullanılmaz."
        ]
      },
      {
        "heading": "10. Ödeme Güvenliği: Kart Verisi Tarafımızca İşlenmez",
        "paragraphs": [
          "Bu Politikanın en önemli maddesi şudur: {{SHORT_NAME}}, ödeme kartınızın numarasını, son kullanma tarihini, güvenlik kodunu (CVV/CVC) veya kart parolanızı hiçbir aşamada görmez, işlemez, kaydetmez ve saklamaz. Ödeme adımında kart bilgileriniz doğrudan lisanslı ödeme kuruluşunun ya da bankanın altyapısına, şifreli kanal üzerinden iletilir.",
          "Kart verisinin güvenliği ve PCI-DSS uyumluluğu, kart verisini fiilen işleyen ödeme kuruluşu ve banka nezdindeki sorumluluktur. Şirketimiz, 6493 sayılı Kanun kapsamında yetkilendirilmiş kuruluşlarla çalışmayı ve kart verisini kendi sistemlerine hiç almamayı temel güvenlik tercihi olarak benimsemiştir. Sistemimizde saklanmayan bir veri, sistemimizden sızdırılamaz.",
          "Ödeme sistemi sağlayıcı bağımsız bir soyutlama katmanı üzerinden çalışacak biçimde tasarlanmıştır. Gerçek sanal POS entegrasyonu devreye alındığında, bu Politikanın ödeme ile ilgili hükümleri seçilen kuruluşun adı ve teknik akışı belirtilerek güncellenir ve güncel sürüm {{SITE_URL}} adresinde yayımlanır."
        ],
        "bullets": [
          "Kart ile yapılan ödemelerde, kuruluşun ve kartı çıkaran bankanın desteklediği ölçüde 3D Secure ek doğrulama adımı uygulanır; işlem, banka tarafından telefonunuza iletilen tek kullanımlık kod veya bankacılık uygulaması onayı ile tamamlanır.",
          "Sistemimizde işleme dair yalnızca kartın son dört hanesi, kart markası, işlem tutarı, para birimi, işlem tarihi, sonuç kodu ve ödeme kuruluşunun ürettiği işlem referansı gibi kart verisi niteliği taşımayan bilgiler tutulur.",
          "Ödeme tutarı hiçbir zaman tarayıcıdan gelen değere göre belirlenmez. Sepetteki her kalemin fiyatı, sunucu tarafında ürün kaydından yeniden hesaplanır; kargo bedeli ve yüzde 20 KDV dahil nihai tutar sunucuda oluşturulur ve ödeme kuruluşuna bu tutar iletilir.",
          "Promosyon kodları sunucu tarafında doğrulanır; geçerlilik tarihi, kullanım limiti ve asgari sepet tutarı koşulları istemciden bağımsız olarak kontrol edilir.",
          "Taksitli işlemlerde taksit sayısı ve varsa vade farkı, ödeme adımında açıkça gösterilir; onaylamadığınız bir taksitlendirme uygulanmaz.",
          "Ön provizyon uygulanan hallerde tutar kartınızda bloke edilir ve satış tamamlanınca tahsilata dönüşür; sipariş karşılanamazsa provizyon çözülür ve bloke kaldırılır. Bloke çözümünün kart ekstrenize yansıma süresi bankanızın iş akışına bağlıdır.",
          "İade işlemleri, ödemenin yapıldığı karta ve aynı ödeme kanalı üzerinden gerçekleştirilir; nakit veya farklı bir hesaba iade yapılmaz. İade tutarının hesabınıza yansıması bankanızın süreçlerine tabidir.",
          "Kart hamilinin bankası nezdinde başlattığı ödeme itirazı (chargeback) süreçlerinde, sipariş kaydı, sözleşme onayı, teslimat belgesi ve olay kayıtları delil olarak ödeme kuruluşuna sunulur.",
          "Şüpheli işlem tespit edilirse sipariş, ilave doğrulama tamamlanana kadar bekletilebilir veya iptal edilerek bedeli iade edilebilir."
        ]
      },
      {
        "heading": "11. Sipariş Onayının Kayıt Altına Alınması",
        "paragraphs": [
          "Ödeme adımında, Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi ayrı bir onay kutucuğu ile onaylanır. Bu onay, Mesafeli Sözleşmeler Yönetmeliği'nin ön bilgilendirmeye ilişkin hükümleri gereğince, siparişin tamamlanmasından önce alınır ve teyidi elektronik ortamda kaydedilir.",
          "Onayın ispatına hizmet eden kayıtlar, 6100 sayılı Hukuk Muhakemeleri Kanunu'nun delil sözleşmesine ilişkin hükmü çerçevesinde taraflar arasında delil teşkil eder. Bu kayıtlar aynı zamanda ödeme kuruluşuna veya bankaya karşı yürütülen itiraz süreçlerinde kullanılır. İşbu hüküm, tüketicinin 6502 sayılı Kanun'dan doğan haklarını ve aksi yöndeki delilleri ileri sürme imkânını ortadan kaldırmaz."
        ],
        "bullets": [
          "Onay tarihi ve saati (sunucu zaman damgası).",
          "Onay anındaki IP adresi.",
          "Tarayıcı ve cihaz bilgisi (user-agent).",
          "Onaylanan Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'nin belge sürümü.",
          "Sipariş numarası, sipariş kalemleri, birim fiyatlar, kargo bedeli, KDV ve toplam tutar.",
          "Sipariş özeti ve sözleşme metni, sipariş sonrası kalıcı veri saklayıcısı niteliğinde e-posta ile ayrıca iletilir."
        ]
      },
      {
        "heading": "12. Webhook İmza Doğrulama ve Mükerrer İşlem Önleme",
        "paragraphs": [
          "Ödeme kuruluşunun ödeme sonucunu sistemimize bildirmek için kullandığı sunucudan sunucuya bildirim (webhook) uç noktası, kimliği doğrulanmamış isteklere kapalıdır. Bir ödemenin başarılı sayılması, yalnızca imzası doğrulanmış bir bildirimle veya sağlayıcı üzerinden yapılan doğrulama sorgusuyla mümkündür; tarayıcıdan gelen bir yönlendirme tek başına ödemenin gerçekleştiği anlamına gelmez.",
          "Bu tasarım, sahte ödeme bildirimi göndererek bedelsiz sipariş oluşturma girişimlerini ve şebeke tekrarı (replay) saldırılarını engellemeyi amaçlar."
        ],
        "ordered": [
          "Gelen her bildirimin gövdesi, yalnızca sunucuda tutulan gizli anahtar ile HMAC SHA-256 kullanılarak yeniden imzalanır.",
          "Hesaplanan imza ile isteğin başlığında gelen imza, sabit zamanlı karşılaştırma yöntemiyle kıyaslanır; böylece karşılaştırma süresinden bilgi sızması önlenir.",
          "İmza uyuşmazsa istek işlenmeden 401 yetkisiz yanıtıyla reddedilir ve olay kaydedilir.",
          "İmza geçerliyse, bildirimdeki sağlayıcı işlem referansı ödeme işlemleri tablosunda benzersizlik kısıtı ile kontrol edilir.",
          "Aynı referans daha önce işlenmişse bildirim yeniden uygulanmaz; yanıt başarılı döner ancak sipariş üzerinde ikinci bir değişiklik yapılmaz (idempotency).",
          "Yeni bir referans ise sipariş durumu güncellenir, stok düşülür ve tüm adımlar olay kaydına yazılır.",
          "Tutar, para birimi ve sipariş numarası bildirim ile sistemdeki kayıt arasında karşılaştırılır; uyuşmazlık halinde sipariş otomatik olarak ilerletilmez ve manuel incelemeye alınır."
        ]
      },
      {
        "heading": "13. Uygulama Katmanı Savunmaları ve Girdi Doğrulama",
        "paragraphs": [
          "Sunucuya ulaşan hiçbir veri güvenilir kabul edilmez. Form gönderimleri ve veri değiştirici tüm işlemler sunucu tarafında çalışır; her girdi, işlenmeden önce şema tabanlı doğrulamadan geçirilir. Doğrulamayı geçemeyen istek reddedilir ve hiçbir veri tabanı değişikliği yapılmaz."
        ],
        "bullets": [
          "Tip, uzunluk, biçim ve değer aralığı kontrolleri sunucuda yeniden yapılır; tarayıcıdaki doğrulama yalnızca kullanıcı deneyimi içindir ve güvenlik tedbiri sayılmaz.",
          "Kullanıcı tarafından girilen içerik ekrana basılırken kaçış işlemine tabi tutulur; siteler arası betik çalıştırma (XSS) riskine karşı çerçeve düzeyinde koruma ve içerik güvenlik başlıkları kullanılır.",
          "Veri değiştiren işlemler yalnızca ilgili uç noktalar üzerinden ve oturum doğrulamasıyla yapılır; sameSite çerez bayrağı ile siteler arası istek sahteciliği (CSRF) riski sınırlandırılır.",
          "Yönetim panelinde görsel yükleme yalnızca izin verilen görsel türleriyle sınırlıdır; dosyalar boyut sınırına tabidir ve yüklenen içerik çalıştırılabilir kod olarak sunulmaz.",
          "Yetkilendirme kontrolleri, kaydın kimliği tahmin edilerek başka bir kullanıcının verisine erişilmesini önleyecek şekilde her istekte nesne düzeyinde uygulanır.",
          "Hata sayfaları, yığın izi (stack trace), sorgu metni veya sunucu yapılandırması gibi bilgileri kullanıcıya göstermez.",
          "Üçüncü taraf bağımlılıklar sabit sürümlerle kilitlenir; güvenlik uyarısı bulunan paketler güncellenir ve sürekli tümleştirme boru hattında tip denetimi ve derleme kontrolü her değişiklikte çalıştırılır."
        ]
      },
      {
        "heading": "14. Günlük Kayıtları, İzleme ve Kişisel Verinin Maskelenmesi",
        "paragraphs": [
          "Sistem günlükleri, hataların teşhisi, kötüye kullanımın tespiti ve hizmet sürekliliğinin sağlanması amacıyla tutulur. Günlükler, 5651 sayılı Kanun kapsamındaki yükümlülükler ile 6698 sayılı Kanun'un veri minimizasyonu ilkesi birlikte gözetilerek yapılandırılır."
        ],
        "bullets": [
          "Parola, parola özeti, tek kullanımlık doğrulama kodu, oturum çerezi değeri ve kart bilgisi hiçbir günlüğe yazılmaz.",
          "E-posta adresi ve telefon numarası gibi iletişim verileri, günlük kayıtlarında maskelenerek tutulur.",
          "Günlüklere erişim yetkili personelle sınırlıdır ve saklama süresi, tutulma amacıyla sınırlı olacak şekilde belirlenir.",
          "Hata ve performans izleme çözümleri kullanıldığında, kişisel veri içerebilecek alanlar gönderim öncesinde temizlenecek şekilde yapılandırılır.",
          "Olağan dışı erişim ve hata yoğunluğu izlenir; kritik olaylarda yetkili personele uyarı iletilir.",
          "Çerezler ve benzeri teknolojiler hakkında ayrıntılı bilgi Çerez Politikası'nda yer alır; zorunlu olmayan çerezler açık rızanıza tabidir."
        ]
      },
      {
        "heading": "15. Yedekleme, Felaket Kurtarma ve İş Sürekliliği",
        "paragraphs": [
          "Verinin erişilebilirliği de gizliliği kadar önemli bir güvenlik unsurudur. Sipariş, müşteri ve ürün verileri barındırma ve veri tabanı sağlayıcısının yönetilen yedekleme altyapısıyla düzenli olarak yedeklenir; yedekler şifreli olarak saklanır ve erişimleri kısıtlıdır.",
          "Uygulama kodu sürüm kontrol sisteminde tutulur ve her yayın sürümlenmiş olarak dağıtılır. Bu sayede sorunlu bir yayın hızla önceki kararlı sürüme geri alınabilir. Bir kesinti halinde önceliğimiz, ödemesi alınmış siparişlerin kaybolmaması ve kayıtların bütünlüğünün korunmasıdır."
        ],
        "bullets": [
          "Yedeklerden geri dönüş süreçleri, ihtiyaç halinde ilgili sağlayıcının yönetim arayüzü üzerinden yürütülür.",
          "Yedeklere erişim yalnızca en üst yetki seviyesindeki hesaplara açıktır ve bu erişim kayda tabidir.",
          "Yayın öncesinde tip denetimi ve derleme kontrolleri otomatik olarak çalıştırılır; başarısız kontrol içeren değişiklik yayına alınmaz.",
          "Planlı bakım çalışmaları, mümkün olduğunca düşük yoğunluklu saatlerde yapılır ve gerekli hallerde site üzerinden duyurulur.",
          "Uzun süreli bir kesinti halinde sipariş ve teslimat durumunuz hakkında {{PHONE}} numarasından veya {{EMAIL}} adresinden bilgi alabilirsiniz.",
          "Kesinti nedeniyle siparişin karşılanamaması halinde, Mesafeli Sözleşmeler Yönetmeliği uyarınca bilgilendirilir ve ödediğiniz bedelin tamamı gecikmeksizin iade edilir."
        ]
      },
      {
        "heading": "16. Veri Saklama ve İmha",
        "paragraphs": [
          "Kişisel verileriniz, işlendikleri amaç için gerekli olan süre ile ilgili mevzuatta öngörülen zorunlu saklama sürelerinden hangisi uzunsa o süre boyunca muhafaza edilir. Süre sonunda veriler, Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik hükümlerine uygun olarak silinir, yok edilir veya anonim hale getirilir.",
          "Fatura, sipariş ve ödeme kayıtları 213 sayılı Vergi Usul Kanunu ile 6102 sayılı Türk Ticaret Kanunu uyarınca öngörülen sürelerle saklanır. Bu nedenle üyeliğinizi sonlandırmanız, mali ve hukuki saklama yükümlülüğüne tabi kayıtların derhal silinmesi sonucunu doğurmaz; bu kayıtlar yalnızca yükümlülük süresince ve sınırlı erişimle tutulur."
        ],
        "bullets": [
          "Üye hesabı verileri, hesap açık olduğu sürece ve kapatma talebinizden sonra yasal zamanaşımı süreleri gözetilerek saklanır.",
          "Pazarlama izinleri geri alındığında ilgili kayıt, iznin geri alındığının ispatı bakımından gerekli asgari veriyle sınırlı olarak tutulur.",
          "İmha işlemleri, geri döndürülemez yöntemlerle ve kayıt altına alınarak gerçekleştirilir.",
          "Yedeklerde bulunan veriler, yedek döngüsünün doğası gereği bir sonraki döngüde imha edilir; bu süre boyunca erişim yalnızca geri yükleme amacıyla ve kısıtlı yetkiyle mümkündür.",
          "Silme, yok etme ve anonim hale getirme talepleriniz için {{EMAIL}} adresine başvurabilirsiniz."
        ]
      },
      {
        "heading": "17. Veri İhlali Yönetimi ve Bildirim",
        "paragraphs": [
          "Tüm tedbirlere rağmen bir veri ihlali yaşanması halinde izlenecek süreç önceden tanımlanmıştır. 6698 sayılı Kanun'un veri güvenliğine ilişkin hükmü uyarınca, kişisel verilerin hukuka aykırı olarak başkaları tarafından elde edilmesi halinde Kişisel Verileri Koruma Kurulu'na en kısa sürede ve her hâlükârda ihlalin öğrenilmesinden itibaren yetmiş iki saat içinde bildirim yapılır.",
          "İlgili kişilere yapılacak bildirim, ihlalden etkilenen kişilerin belirlenmesini takiben makul olan en kısa sürede, doğrudan iletişim yoluyla ya da bu mümkün değilse Şirketin internet sitesinde yayımlanacak bir duyuru gibi uygun yöntemlerle gerçekleştirilir."
        ],
        "ordered": [
          "Tespit ve doğrulama: Şüpheli olay kayıt altına alınır, kapsamı ve gerçekliği teyit edilir.",
          "Sınırlama: Etkilenen bileşen izole edilir, sızdırılmış olabilecek anahtarlar ve oturumlar geçersiz kılınır, gerekiyorsa hizmet geçici olarak durdurulur.",
          "Değerlendirme: Hangi veri kategorilerinin, kaç ilgili kişinin ve hangi olası sonuçların söz konusu olduğu belirlenir.",
          "Kurul bildirimi: Yetmiş iki saatlik süre içinde Kişisel Verileri Koruma Kurulu'na bildirim yapılır; bilgiler o anda mevcut değilse gecikmeksizin tamamlanır.",
          "İlgili kişi bildirimi: Etkilenen kişilere, ihlalin niteliği, olası sonuçları, alınan tedbirler ve alabilecekleri önlemler açık ve sade bir dille bildirilir.",
          "Diğer bildirimler: Ödeme sürecine ilişkin bir olay söz konusu ise ödeme kuruluşu ve banka bilgilendirilir; suç teşkil eden bir fiil bulunması halinde yetkili makamlara başvurulur.",
          "Giderme ve ders çıkarma: Kök neden analizi yapılır, açık kapatılır, benzer risklerin tekrarını önleyecek kalıcı tedbirler alınır ve süreç yazılı olarak kayda geçirilir."
        ]
      },
      {
        "heading": "18. Sorumlu Açıklama (Responsible Disclosure) Programı",
        "paragraphs": [
          "Sistemlerimizde bir güvenlik açığı tespit ettiğinizi düşünüyorsanız, bulgunuzu kamuya açıklamadan önce {{EMAIL}} adresine bildirmenizi rica ederiz. Konu satırına Güvenlik Bildirimi yazmanız değerlendirmeyi hızlandırır.",
          "İyi niyetle, aşağıdaki kurallara uyarak yapılan bildirimlerde araştırmacı aleyhine hukuki süreç başlatmayı amaçlamayız; bildirimler gizli tutulur ve makul sürede yanıtlanır. Bu Politika, mevzuattan doğan hakları saklı tutar ve bir ödül taahhüdü içermez."
        ],
        "bullets": [
          "Bildiriminize açığı yeniden üretmek için gereken adımları, etkilenen adresi ve olası etkiyi ekleyin; ekran görüntüsü veya kısa bir video yardımcı olur.",
          "Yalnızca kendinize ait test hesapları üzerinde çalışın; başka kullanıcıların verisine erişmeye, veriyi indirmeye, değiştirmeye veya silmeye çalışmayın.",
          "Elde ettiğiniz kişisel verileri saklamayın, paylaşmayın ve doğrulama tamamlanır tamamlanmaz imha edin.",
          "Hizmeti aksatacak testlerden (hizmet dışı bırakma, kaba kuvvet, yoğun otomatik tarama, spam) kaçının.",
          "Sosyal mühendislik, personele veya kuryelere yönelik oltalama, fiziksel mekâna izinsiz erişim denemeleri kapsam dışıdır.",
          "Kapsam dışı diğer konular: yalnızca teorik olan ve sömürülebilirliği gösterilmeyen bulgular, üçüncü taraf platformlarına (sosyal medya, ödeme kuruluşu, kargo firması) ait sistemler, en iyi uygulama önerisi niteliğindeki başlık ve yapılandırma uyarıları, güncel olmayan tarayıcılara özgü sorunlar.",
          "Açık kapatılana kadar bulguyu üçüncü kişilerle paylaşmamanızı; sorunun giderilmesinin ardından, talebiniz halinde katkınıza teşekkür etmemizi kabul etmenizi rica ederiz."
        ]
      },
      {
        "heading": "19. Güvenli Alışveriş için Size Önerilerimiz",
        "paragraphs": [
          "Güvenlik ortak bir sorumluluktur. Sistemlerimizde alınan tedbirlerin etkili olabilmesi için hesabınızı ve cihazınızı sizin de korumanız gerekir. Aşağıdaki öneriler, {{BRAND}} hesabınızın güvenliğini doğrudan artırır."
        ],
        "ordered": [
          "Yalnızca sizin bildiğiniz, en az on iki karakterden oluşan, büyük-küçük harf, rakam ve sembol içeren güçlü bir parola belirleyin.",
          "{{BRAND}} hesabınız için başka hiçbir sitede kullanmadığınız benzersiz bir parola kullanın; bir sitede yaşanan sızıntı, aynı parolayı kullandığınız diğer hesapları da riske atar.",
          "Parolalarınızı tarayıcının parola yöneticisinde veya güvenilir bir parola yöneticisi uygulamasında saklayın; not defterine, e-postaya veya mesajlaşma uygulamasına yazmayın.",
          "Ortak veya paylaşılan bir cihazda (iş bilgisayarı, internet kafe, aile tableti) alışveriş yaptıysanız işiniz bittiğinde mutlaka çıkış yapın ve beni hatırla seçeneğini işaretlemeyin.",
          "Halka açık ve şifresiz kablosuz ağlarda ödeme yapmaktan kaçının; mümkünse kendi mobil veri bağlantınızı kullanın.",
          "Cihazınızın işletim sistemini, tarayıcınızı ve güvenlik yazılımlarınızı güncel tutun; bilinmeyen kaynaklardan uygulama yüklemeyin.",
          "Ödeme yapmadan önce adres çubuğunda kilit simgesini ve alan adının tam olarak {{SITE}} olduğunu doğrulayın; benzer yazılışlı alan adlarına dikkat edin.",
          "Bankanızın işlem bildirimi ve harcama limiti özelliklerini etkinleştirin; ekstrenizi düzenli kontrol edin ve tanımadığınız bir işlem görürseniz önce bankanızı arayın.",
          "Sipariş onay e-postalarını saklayın; sipariş numarası, iade ve destek taleplerinizde işinizi hızlandırır.",
          "Hesabınızda tanımadığınız bir hareket fark ederseniz derhal parolanızı değiştirin ve {{EMAIL}} adresinden bize bildirin."
        ]
      },
      {
        "heading": "20. Oltalama (Phishing) ve Sahte Site Uyarısı",
        "paragraphs": [
          "Şirketimiz sizden hiçbir koşulda; e-posta, SMS, telefon, WhatsApp veya sosyal medya mesajı yoluyla kart numarası, kart güvenlik kodu (CVV/CVC), kart parolası, hesap parolanız ya da bankanızın gönderdiği tek kullanımlık SMS doğrulama kodunu İSTEMEZ. Böyle bir talep gelirse bu bir dolandırıcılık girişimidir; bilgi vermeyin, bağlantıya tıklamayın ve durumu {{EMAIL}} adresine bildirin.",
          "Kimliğimizi taklit eden sahte internet siteleri ve sosyal medya hesapları oluşturulabilmektedir. Gerçek sitemiz yalnızca {{SITE_URL}} adresidir. Resmî sosyal medya hesaplarımızın kullanıcı adı her platformda {{HANDLE}} şeklindedir; bu isimden farklı yazılan hesaplar bize ait değildir."
        ],
        "bullets": [
          "Instagram: {{IG}}",
          "TikTok: {{TIKTOK}}",
          "YouTube: {{YOUTUBE}}",
          "Kargonuz gümrükte, adres bilgisi eksik, ek ödeme yapın türünde beklenmedik SMS ve e-postalardaki bağlantılara tıklamayın; kargo takibinizi daima sipariş onay e-postanızdaki resmî bağlantı üzerinden yapın.",
          "Sosyal medyada gerçekleştirilmeyen çekiliş, kupon veya aşırı indirim vaadiyle kart bilgisi isteyen hesaplara itibar etmeyin; kampanyalarımız {{SITE_URL}} adresinde duyurulur.",
          "Bize ait olduğunu iddia eden ve ödemeyi havale/EFT ile şahsi bir hesaba yönlendiren mesajlar sahtedir; ödemeler yalnızca sitemizdeki ödeme adımı üzerinden alınır.",
          "Sahte hesap veya site tespit ederseniz {{EMAIL}} adresine bildirmenizi rica ederiz; gerekli platform bildirimleri ve hukuki başvurular tarafımızca yapılır.",
          "Şüpheli bir işlem gerçekleştiyse önce kartınızı çıkaran bankaya, ardından bize başvurun; banka nezdinde işlem itirazı süreci başlatılabilir."
        ]
      },
      {
        "heading": "21. Tedarikçi ve Alt İşleyen Güvenliği",
        "paragraphs": [
          "Hizmetin sunulabilmesi için sınırlı sayıda ve belirli amaçla çalışılan tedarikçilerden yararlanılır. Her tedarikçi, sunduğu hizmetin gerektirdiği asgari veriye erişir; bu erişim sözleşmeyle sınırlandırılır ve gizlilik yükümlülüğüne bağlanır.",
          "Yurt dışında bulunan sağlayıcılara veri aktarımı söz konusu olduğunda, 6698 sayılı Kanun'un yurt dışına aktarıma ilişkin hükmünde öngörülen şartlara uygun hareket edilir. Ayrıntılar Gizlilik ve KVKK Aydınlatma Metni'nde yer alır."
        ],
        "table": [
          {
            "key": "Barındırma ve dağıtım",
            "value": "Site ve uygulama sunucusu barındırma, TLS sertifikası yönetimi, içerik dağıtım ağı ve altyapı düzeyinde saldırı azaltma."
          },
          {
            "key": "Veri tabanı",
            "value": "Yönetilen PostgreSQL hizmeti; satır düzeyi güvenlik açık, disk üzerinde şifreli saklama, yönetilen yedekleme."
          },
          {
            "key": "Ödeme kuruluşu / banka",
            "value": "Kart verisinin işlenmesi, 3D Secure doğrulaması, PCI-DSS uyumu ve iade/itiraz süreçleri ilgili kuruluşun sorumluluğundadır. Şirketimiz kart verisi tutmaz."
          },
          {
            "key": "İşlemsel e-posta",
            "value": "Üyelik doğrulama, sipariş onayı, kargo bildirimi ve parola sıfırlama e-postalarının iletimi."
          },
          {
            "key": "Kargo ve teslimat",
            "value": "Yurtiçi Kargo (Türkiye geneli), Aras Kargo (KKTC ve yurt dışı) ve İstanbul içi motokurye hizmeti; yalnızca teslimat için gerekli ad, adres ve telefon bilgisi paylaşılır."
          },
          {
            "key": "Muhasebe ve mali müşavirlik",
            "value": "Fatura düzenleme ve yasal defter yükümlülüklerinin yerine getirilmesi."
          },
          {
            "key": "Erişim ilkesi",
            "value": "Her tedarikçi yalnızca kendi hizmeti için gerekli asgari veriye erişir; erişim yetkileri düzenli olarak gözden geçirilir."
          }
        ]
      },
      {
        "heading": "22. Yasaklı Kullanım ve Sistem Güvenliğinin İhlali",
        "paragraphs": [
          "Site ve online mağaza yalnızca amacına uygun, kişisel kullanım için tasarlanmıştır. Aşağıdaki fiiller sözleşmeye aykırılık teşkil eder; ayrıca 5237 sayılı Türk Ceza Kanunu'nun bilişim sistemlerine yönelik suçlara ilişkin hükümleri kapsamında suç oluşturabilir. Bu tür fiillerin tespiti halinde ilgili hesap askıya alınır, gerekli görülürse yetkili makamlara başvurulur ve doğan zararların tazmini talep edilir."
        ],
        "bullets": [
          "Sisteme yetkisiz erişmek, erişmeye teşebbüs etmek, güvenlik tedbirlerini aşmaya çalışmak veya başkasına ait hesabı kullanmak.",
          "Otomatik araçlarla toplu veri kazıma (scraping), içerik kopyalama, fiyat ve stok verisini izinsiz sistematik olarak toplamak.",
          "Sisteme aşırı yük bindirerek hizmeti aksatmayı amaçlayan istekler göndermek.",
          "Zararlı yazılım, kötü amaçlı betik veya zafiyet sömürüsü içeren veri göndermek.",
          "Çalıntı kart veya başkasına ait kimlik bilgileriyle sipariş vermek, sahte iade veya sahte teslim edilmedi bildirimi yapmak.",
          "Promosyon kodlarını amacı dışında, mükerrer hesaplar açarak veya teknik yöntemlerle kötüye kullanmak.",
          "{{BRAND}} markasını, logosunu veya site içeriğini izinsiz kullanarak yanıltıcı sayfa, hesap veya uygulama oluşturmak; bu fiiller ayrıca 5846 sayılı Fikir ve Sanat Eserleri Kanunu ve 6769 sayılı Sınai Mülkiyet Kanunu kapsamında değerlendirilir."
        ]
      },
      {
        "heading": "23. Haklarınız ve Bize Ulaşma",
        "paragraphs": [
          "6698 sayılı Kanun'un ilgili kişinin haklarını düzenleyen hükmü uyarınca; kişisel verinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, silinmesini veya yok edilmesini isteme, bu işlemlerin aktarıldığı üçüncü kişilere bildirilmesini isteme, münhasıran otomatik sistemlerle analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme ve kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.",
          "Başvurularınızı, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'de öngörülen usule uygun olarak {{EMAIL}} adresine elektronik posta ile ya da {{ADDRESS}} adresine yazılı olarak iletebilirsiniz. Talepleriniz, niteliğine göre en kısa sürede ve her hâlükârda otuz gün içinde ücretsiz olarak sonuçlandırılır; işlemin ayrıca bir maliyet gerektirmesi hâlinde Kurulca belirlenen tarifedeki ücret talep edilebilir.",
          "Güvenlikle ilgili acil bildirimler için {{PHONE}} numaralı telefonumuzdan da bize ulaşabilirsiniz. Tüketici uyuşmazlıklarında, her yıl Ticaret Bakanlığınca yeniden değerleme oranında güncellenen parasal sınırlar çerçevesinde Tüketici Hakem Heyetlerine veya Tüketici Mahkemelerine başvurma hakkınız saklıdır."
        ],
        "table": [
          {
            "key": "Güvenlik ve KVKK başvuruları",
            "value": "{{EMAIL}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "Yazılı başvuru adresi",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          }
        ]
      },
      {
        "heading": "24. Sorumluluğun Sınırı ve Saklı Haklar",
        "paragraphs": [
          "{{SHORT_NAME}}, bu Politikada tarif edilen teknik ve idari tedbirleri, güncel teknolojik imkânlar ve makul ticari özen ölçüsünde uygular. Bununla birlikte hiçbir bilgi sisteminin mutlak güvenlik sağlayamayacağı bilinen bir gerçektir; bu Politika, mutlak güvenlik taahhüdü olarak yorumlanamaz.",
          "Bu hüküm, Şirketin kendi kusurundan, ağır ihmalinden veya kanundan doğan sorumluluğunu ortadan kaldırmaz. Tüketicinin 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve 6698 sayılı Kişisel Verilerin Korunması Kanunu'ndan doğan hakları ile emredici hükümlerden kaynaklanan talep hakları her hâlükârda saklıdır.",
          "Kullanıcının kendi cihazının güvenliğini sağlamaması, parolasını üçüncü kişilerle paylaşması veya oltalama girişimlerine bilgi vermesi nedeniyle doğan zararlarda, Şirketin sorumluluğu ancak kendi kusuru oranında söz konusu olur."
        ]
      },
      {
        "heading": "25. Yürürlük, Sürüm ve Güncelleme",
        "paragraphs": [
          "İşbu Güvenli Alışveriş ve Bilgi Güvenliği Politikası, {{SITE_URL}} adresinde yayımlandığı tarihte yürürlüğe girer ve yayımda kaldığı sürece geçerlidir.",
          "Mevzuat değişiklikleri, teknik altyapının gelişmesi ve özellikle gerçek sanal POS entegrasyonunun devreye alınması gibi durumlarda bu Politika güncellenebilir. Güncel sürüm her zaman {{SITE_URL}} adresinde erişilebilir; sürüm ve güncelleme tarihi belgenin üzerinde gösterilir.",
          "Esaslı nitelikteki değişiklikler, üyelerimize kayıtlı e-posta adresleri üzerinden veya site içi duyuru ile ayrıca bildirilir. Politikanın güncellenmesi, güncellemeden önce verilmiş siparişler bakımından tüketici aleyhine geriye etkili sonuç doğurmaz."
        ],
        "table": [
          {
            "key": "Belge adı",
            "value": "Güvenli Alışveriş ve Bilgi Güvenliği"
          },
          {
            "key": "Yayımlayan",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Yayım adresi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "İletişim",
            "value": "{{EMAIL}} - {{PHONE}}"
          }
        ]
      }
    ]
  },
  {
    "slug": "gizlilik-politikasi",
    "title": "Gizlilik Politikası",
    "shortTitle": "Gizlilik",
    "category": "Veri & Gizlilik",
    "summary": "{{LEGAL_NAME}} tarafından işletilen {{BRAND}} web sitesi ve kafe hizmetlerinde kişisel verilerinizin hangi amaçlarla işlendiğini, kimlere aktarıldığını, ne kadar süreyle saklandığını ve KVKK ile GDPR kapsamındaki haklarınızı açıklar.",
    "references": [
      "6698 sayılı Kişisel Verilerin Korunması Kanunu",
      "Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik",
      "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ",
      "Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ",
      "Veri Sorumluları Sicili Hakkında Yönetmelik",
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
      "Mesafeli Sözleşmeler Yönetmeliği (RG: 27.11.2014, 29188)",
      "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun",
      "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik",
      "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik",
      "5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun",
      "5464 sayılı Banka Kartları ve Kredi Kartları Kanunu",
      "6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun",
      "6098 sayılı Türk Borçlar Kanunu",
      "6102 sayılı Türk Ticaret Kanunu",
      "213 sayılı Vergi Usul Kanunu",
      "6100 sayılı Hukuk Muhakemeleri Kanunu",
      "5846 sayılı Fikir ve Sanat Eserleri Kanunu",
      "Avrupa Birliği Genel Veri Koruma Tüzüğü — (AB) 2016/679 (GDPR)"
    ],
    "sections": [
      {
        "heading": "1. Kapsam, Amaç ve Veri Sorumlusunun Kimliği",
        "paragraphs": [
          "Bu Gizlilik Politikası, {{BRAND}} markası altında faaliyet gösteren {{LEGAL_NAME}} (kısaca {{SHORT_NAME}} veya Şirket) tarafından; {{SITE_URL}} adresinde yayımlanan web sitesi ve online mağaza (bottega) üzerinden, {{ADDRESS}} adresindeki kafe işletmesinde ve markanın sosyal medya hesapları üzerinden yürütülen faaliyetler kapsamında elde edilen kişisel verilerin işlenmesine ilişkin esasları açıklamak amacıyla hazırlanmıştır.",
          "Şirket, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) anlamında veri sorumlusu sıfatını haizdir. Bu metin, aynı zamanda KVKK'nın aydınlatma yükümlülüğünü düzenleyen hükmü ve Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ uyarınca yapılan aydınlatmayı içerir. Avrupa Birliği'nde bulunan ilgili kişiler bakımından, (AB) 2016/679 sayılı Genel Veri Koruma Tüzüğü (GDPR) kapsamındaki ek bilgilendirmeler bu Politikanın ilgili maddesinde yer alır.",
          "Politika; web sitesi ziyaretçilerini, üye hesabı açan müşterileri, sipariş veren alıcı ve kargo alıcılarını, kafe ziyaretçilerini, kurumsal ve bayilik başvurusu yapan kişileri, tedarikçi ve iş ortağı çalışanlarını ve Şirkete herhangi bir kanaldan başvuran kişileri kapsar. Web sitesinde yer alabilecek üçüncü taraf bağlantıları (sosyal medya platformları, harita servisleri, ödeme kuruluşu sayfaları) bu Politikanın kapsamı dışındadır; bu platformların kendi gizlilik metinleri geçerlidir.",
          "{{BRAND}} online mağazasından sipariş yalnızca e-posta adresi doğrulanmış üye hesabıyla verilebildiğinden, sipariş sürecinde hesap verilerinin işlenmesi sözleşmenin kurulması ve ifası bakımından zorunludur."
        ],
        "table": [
          {
            "key": "Veri sorumlusu (ticaret unvanı)",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Kısa unvan",
            "value": "{{SHORT_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Adres",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "Web sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Vergi dairesi",
            "value": "{{TAX_OFFICE}}"
          },
          {
            "key": "Vergi kimlik numarası",
            "value": "{{TAX_NO}}"
          },
          {
            "key": "Vergi türü",
            "value": "{{TAX_TYPE}}"
          },
          {
            "key": "Faaliyet kodu (NACE)",
            "value": "{{NACE}}"
          },
          {
            "key": "İşe başlama tarihi",
            "value": "{{STARTED_AT}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil numarası",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          }
        ]
      },
      {
        "heading": "2. Tanımlar",
        "paragraphs": [
          "Bu Politikada geçen temel kavramlar, KVKK ve ilgili ikincil mevzuattaki anlamlarıyla kullanılmıştır."
        ],
        "bullets": [
          "Kişisel veri: Kimliği belirli veya belirlenebilir gerçek kişiye ilişkin her türlü bilgi.",
          "Özel nitelikli kişisel veri: Sağlık, biyometrik veri, din, ırk, etnik köken, siyasi düşünce, felsefi inanç, kılık kıyafet, dernek/vakıf/sendika üyeliği, ceza mahkûmiyeti ve güvenlik tedbirleriyle ilgili veriler ile cinsel hayata ilişkin veriler.",
          "İşleme: Kişisel verilerin elde edilmesi, kaydedilmesi, depolanması, muhafaza edilmesi, değiştirilmesi, yeniden düzenlenmesi, açıklanması, aktarılması, devralınması, elde edilebilir hâle getirilmesi, sınıflandırılması veya kullanılmasının engellenmesi gibi her türlü işlem.",
          "İlgili kişi: Kişisel verisi işlenen gerçek kişi; bu Politikada çoğunlukla siz olarak anılmaktadır.",
          "Veri sorumlusu: Kişisel verilerin işlenme amaçlarını ve vasıtalarını belirleyen, veri kayıt sisteminin kurulmasından ve yönetilmesinden sorumlu kişi; burada {{LEGAL_NAME}}.",
          "Veri işleyen: Veri sorumlusunun verdiği yetkiye dayanarak onun adına kişisel verileri işleyen gerçek veya tüzel kişi; örneğin bulut barındırma, e-posta gönderim ve kargo altyapısı sağlayıcıları.",
          "Açık rıza: Belirli bir konuya ilişkin, bilgilendirilmeye dayanan ve özgür iradeyle açıklanan rıza.",
          "Anonim hâle getirme: Kişisel verinin, başka verilerle eşleştirilse dahi hiçbir surette kimliği belirli veya belirlenebilir bir gerçek kişiyle ilişkilendirilemeyecek hâle getirilmesi.",
          "Kurul / Kurum: Kişisel Verileri Koruma Kurulu ve Kişisel Verileri Koruma Kurumu.",
          "Platform: {{SITE_URL}} adresinde yayımlanan web sitesi, online mağaza ve buna bağlı elektronik hizmetler."
        ]
      },
      {
        "heading": "3. İşlenen Kişisel Veri Kategorileri",
        "paragraphs": [
          "Şirket, KVKK'nın genel ilkeleri uyarınca yalnızca ilgili amaçla bağlantılı, sınırlı ve ölçülü veri işler. İşlenen veri kategorileri, sizinle kurulan ilişkinin türüne göre değişir; aşağıdaki tabloda yer alan her kategori her ilgili kişi bakımından işlenmez.",
          "Şirket, faaliyetleri gereği kural olarak özel nitelikli kişisel veri toplamaz. Ancak gıda ürünlerine ilişkin alerjen bilgisi veya özel beslenme tercihleri gibi bir bilgiyi kendi iradenizle bize iletmeniz hâlinde (örneğin sipariş notu alanında), bu bilgi yalnızca talebinizin karşılanması amacıyla ve açık rızanıza dayanılarak işlenir; ilgili siparişin tamamlanmasının ardından bu tür serbest metin notları düzenli olarak gözden geçirilerek silinir."
        ],
        "table": [
          {
            "key": "Kimlik verisi",
            "value": "Ad, soyad; fatura kurumsal ise şirket unvanı ve vergi kimlik bilgisi; iade/fatura süreçlerinde mevzuat gereği talep edilebilen kimlik doğrulama bilgileri."
          },
          {
            "key": "İletişim verisi",
            "value": "E-posta adresi, cep telefonu numarası, teslimat ve fatura adresi, sipariş bildirimlerinin gönderildiği iletişim kanalları."
          },
          {
            "key": "Hesap verisi (müşteri işlem)",
            "value": "Üyelik kaydı, kullanıcı adı/e-posta, bcrypt algoritmasıyla özetlenmiş parola, e-posta doğrulama durumu ve doğrulama zaman damgası, parola sıfırlama talepleri, kayıtlı adres defteri, favori/istek listesi, hesap tercihleri."
          },
          {
            "key": "Sipariş ve ödeme verisi",
            "value": "Sipariş numarası, sipariş tarihi, sepet içeriği (ürün, varyant, adet), birim ve toplam tutar (TRY, kuruş bazında), KDV tutarı, uygulanan promosyon kodu, kargo bedeli, ödeme yöntemi, taksit bilgisi, işlem durumu (başarılı/başarısız/iade), ödeme kuruluşundan dönen işlem referansı ve maskelenmiş kart bilgisi (ilk 6 - son 4 hane, kart markası)."
          },
          {
            "key": "Teslimat verisi",
            "value": "Alıcı adı, teslimat adresi ve adres tarifi, alıcı telefonu, kargo firması, gönderi takip numarası, teslim tarihi ve teslim alan bilgisi, teslimat notu."
          },
          {
            "key": "Kullanım ve teknik veri",
            "value": "IP adresi, tarayıcı türü ve sürümü (user-agent), işletim sistemi, cihaz türü, dil ve saat dilimi, oturum kimliği, ziyaret edilen sayfalar, gezinme yolu, yönlendiren adres (referrer), hata ve performans kayıtları, sunucu erişim logları."
          },
          {
            "key": "Pazarlama verisi",
            "value": "E-bülten aboneliği ve onay durumu, ticari elektronik ileti izninin kaynağı ve tarihi, İleti Yönetim Sistemi (İYS) kayıt bilgisi, ret (opt-out) talepleri, kampanya ve promosyon kodu kullanım geçmişi, segmentasyon amacıyla oluşturulan genel kategori bilgileri."
          },
          {
            "key": "Çerez ve benzeri teknoloji verisi",
            "value": "Zorunlu oturum ve sepet çerezleri, tercih çerezleri, izne bağlı analitik ve pazarlama çerezleri; yerel depolama (localStorage) üzerinde tutulan sepet ve arayüz tercihleri; çerez rıza kaydı (tercih, tarih, sürüm)."
          },
          {
            "key": "Güvenlik kamerası verisi",
            "value": "Kafe işletmesinin müşteriye açık alanlarında güvenlik amacıyla kaydedilen görüntü kaydı (ses kaydı alınmaz)."
          },
          {
            "key": "Mesafeli satış onay kaydı",
            "value": "Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'nin onaylandığı tarih ve saat, onay anındaki IP adresi, tarayıcı/cihaz bilgisi, onaylanan belge sürümü ve belge özeti; ayrıca çerez ve ticari ileti onaylarına ait benzer kayıtlar."
          },
          {
            "key": "İşlem güvenliği verisi",
            "value": "Giriş denemeleri ve başarısız giriş sayacı, hesap kilitleme kayıtları, yönetici hesaplarına ilişkin iki aşamalı doğrulama (TOTP) kayıtları, yönetici mutasyonlarının yazıldığı değiştirilemez olay kaydı (audit log), oturum tanımlayıcıları ve imzalı çerez bilgisi."
          },
          {
            "key": "Talep, şikâyet ve iade verisi",
            "value": "E-posta veya telefon yoluyla iletilen soru, talep, cayma bildirimi, ayıp ihbarı, iade ve değişim kayıtları, bunlara ilişkin yazışma içerikleri ve varsa gönderilen görseller."
          },
          {
            "key": "Kurumsal ilişki verisi",
            "value": "Bayilik/franchise, toptan satış, iş birliği ve tedarik başvurularında iletilen ad-soyad, unvan, şirket bilgisi, iletişim bilgileri ve başvuru içeriği."
          }
        ]
      },
      {
        "heading": "4. Kişisel Verilerin Toplanma Yöntemleri",
        "paragraphs": [
          "Kişisel verileriniz, aşağıda sayılan kanallar aracılığıyla kısmen otomatik, tamamen otomatik veya bir veri kayıt sisteminin parçası olmak kaydıyla otomatik olmayan yollarla toplanır. Toplama, doğrudan sizden veya sizin yönlendirmenizle üçüncü taraflardan gerçekleşir."
        ],
        "bullets": [
          "Elektronik formlar: Üyelik kaydı, e-posta doğrulama, giriş, parola sıfırlama, adres ekleme, sepet ve ödeme adımı formları ile iletişim, bayilik ve toptan satış başvuru formları.",
          "Sipariş ve ödeme akışı: Ödeme adımında verdiğiniz bilgiler ile ödeme kuruluşundan Şirkete dönen işlem sonucu, referans numarası ve maskelenmiş kart bilgisi.",
          "Çerezler ve benzeri teknolojiler: Zorunlu çerezler ile açık rızanıza bağlı analitik ve pazarlama çerezleri, piksel ve yerel depolama teknolojileri.",
          "Sunucu ve uygulama logları: Barındırma altyapısı ve uygulama katmanında otomatik olarak üretilen erişim, hata, güvenlik ve performans kayıtları.",
          "Kafe ziyareti: {{ADDRESS}} adresindeki işletmede yapılan satın alma ve rezervasyon işlemleri, masa/paket sipariş kayıtları ve güvenlik kamerası görüntüleri.",
          "İletişim kanalları: {{EMAIL}} adresine gönderdiğiniz e-postalar ve {{PHONE}} numarası üzerinden yürütülen görüşmeler kapsamında ilettiğiniz bilgiler.",
          "Sosyal medya: {{HANDLE}} kullanıcı adıyla yürütülen {{IG}}, {{TIKTOK}} ve {{YOUTUBE}} hesapları üzerinden gönderdiğiniz mesaj, yorum ve etiketlemeler; bu platformlarda paylaştığınız içeriklere ilişkin olarak platformların kendileri de bağımsız veri sorumlusudur.",
          "Üçüncü taraflar: Kargo firmalarından gelen teslimat durum bildirimleri, ödeme kuruluşundan gelen işlem ve itiraz (chargeback) bildirimleri, e-posta gönderim sağlayıcısından gelen teslim/açılma durum bilgileri ve yetkili kamu kurumlarından gelen bildirimler.",
          "Otomatik olmayan yollar: Kafe içinde doldurulan basılı formlar, kâğıt fiş/fatura süreçleri ve fiziksel evrak akışı."
        ]
      },
      {
        "heading": "5. İşleme Amaçları ve Hukuki Sebepler",
        "paragraphs": [
          "Kişisel verileriniz, KVKK'nın genel ilkelerini düzenleyen 4. maddesi ile işleme şartlarını düzenleyen 5. maddesine (özel nitelikli veriler bakımından 6. maddesine) uygun olarak, aşağıdaki amaçlar ve hukuki sebeplerle işlenir. Bir amacın birden fazla hukuki sebebe dayandığı hâllerde, tabloda esas alınan sebep belirtilmiştir.",
          "Meşru menfaat hukuki sebebine dayanılan hâllerde, Şirket her seferinde menfaat dengesi testi yaparak temel hak ve özgürlüklerinize zarar verilmemesini gözetir. Açık rızaya dayalı işlemelerde ise rızanızı vermemeniz veya geri almanız, temel hizmetlerden yararlanmanıza engel oluşturmaz."
        ],
        "table": [
          {
            "key": "Üyelik hesabının oluşturulması, e-posta adresinin doğrulanması ve hesabın yönetilmesi",
            "value": "Bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması (KVKK m.5/2-c)"
          },
          {
            "key": "Siparişin alınması, ödemenin tahsili, faturanın düzenlenmesi, ürünün hazırlanması ve kargoya verilmesi",
            "value": "Sözleşmenin kurulması veya ifası (KVKK m.5/2-c)"
          },
          {
            "key": "Cayma hakkı, iade, değişim, ayıplı ürün ve garanti taleplerinin karşılanması",
            "value": "Veri sorumlusunun hukuki yükümlülüğünü yerine getirmesi (KVKK m.5/2-ç); sözleşmenin ifası (m.5/2-c)"
          },
          {
            "key": "Fatura, e-arşiv fatura ve muhasebe kayıtlarının düzenlenmesi ile defter ve belgelerin saklanması",
            "value": "Kanunlarda açıkça öngörülmesi ve hukuki yükümlülük (KVKK m.5/2-a ve m.5/2-ç); 213 sayılı Vergi Usul Kanunu ve 6102 sayılı Türk Ticaret Kanunu"
          },
          {
            "key": "Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi onayının, onay tarihi, IP adresi, tarayıcı bilgisi ve belge sürümü ile birlikte kayda alınması",
            "value": "Hukuki yükümlülük (KVKK m.5/2-ç); 6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği"
          },
          {
            "key": "Ödeme işlemlerinin gerçekleştirilmesi, 3D Secure doğrulaması, ön provizyon, iade ve itiraz (chargeback) süreçlerinin yürütülmesi",
            "value": "Sözleşmenin ifası (KVKK m.5/2-c); hukuki yükümlülük (m.5/2-ç); 5464 ve 6493 sayılı Kanunlar"
          },
          {
            "key": "Dolandırıcılık ve kötüye kullanım tespiti, hesap güvenliğinin sağlanması, giriş denemelerinin sınırlandırılması",
            "value": "Veri sorumlusunun meşru menfaati (KVKK m.5/2-f); veri güvenliğine ilişkin hukuki yükümlülük (m.5/2-ç)"
          },
          {
            "key": "Sipariş durumu, kargo takibi ve işlemsel e-postaların gönderilmesi",
            "value": "Sözleşmenin ifası (KVKK m.5/2-c); 6563 sayılı Kanun kapsamında işlemsel iletiler için ayrıca ticari ileti onayı aranmaz"
          },
          {
            "key": "Talep, soru ve şikâyetlerin karşılanması, müşteri ilişkilerinin yürütülmesi",
            "value": "Sözleşmenin ifası (KVKK m.5/2-c); bir hakkın tesisi, kullanılması veya korunması (m.5/2-e)"
          },
          {
            "key": "Web sitesi ve mobil arayüzün çalışması, oturum ve sepet sürekliliğinin sağlanması",
            "value": "Sözleşmenin ifası ve meşru menfaat (KVKK m.5/2-c ve m.5/2-f); zorunlu çerezler için ayrıca rıza aranmaz"
          },
          {
            "key": "Analitik ölçüm, ziyaretçi davranışının istatistiksel olarak incelenmesi ve site performansının iyileştirilmesi",
            "value": "Açık rıza (KVKK m.5/1) — çerez izin panelinden verilen onay"
          },
          {
            "key": "E-bülten, kampanya, indirim ve yeni ürün duyurularının gönderilmesi",
            "value": "Açık rıza (KVKK m.5/1); 6563 sayılı Kanun ve Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik kapsamında İYS'ye kaydedilen onay"
          },
          {
            "key": "Promosyon kodlarının tanımlanması, kullanım koşullarının ve kötüye kullanımın denetlenmesi",
            "value": "Sözleşmenin ifası (KVKK m.5/2-c); meşru menfaat (m.5/2-f)"
          },
          {
            "key": "Kafe işletmesinin ve müşterilerin can ve mal güvenliğinin sağlanması amacıyla kamera kaydı",
            "value": "Meşru menfaat (KVKK m.5/2-f)"
          },
          {
            "key": "Yönetici işlemlerinin değiştirilemez olay kaydına yazılması, yetki ve erişim yönetimi",
            "value": "Veri güvenliğine ilişkin hukuki yükümlülük (KVKK m.5/2-ç); meşru menfaat (m.5/2-f)"
          },
          {
            "key": "Uyuşmazlıklarda delil sunulması, hukuki taleplerin takibi ve savunma hakkının kullanılması",
            "value": "Bir hakkın tesisi, kullanılması veya korunması için zorunlu olması (KVKK m.5/2-e)"
          },
          {
            "key": "Yetkili kamu kurum ve kuruluşlarının mevzuata uygun taleplerinin yanıtlanması",
            "value": "Kanunlarda açıkça öngörülmesi ve hukuki yükümlülük (KVKK m.5/2-a ve m.5/2-ç)"
          },
          {
            "key": "Bayilik, toptan satış ve iş birliği başvurularının değerlendirilmesi",
            "value": "Sözleşmenin kurulmasından önceki hazırlık aşaması (KVKK m.5/2-c); meşru menfaat (m.5/2-f)"
          }
        ]
      },
      {
        "heading": "6. Açık Rızaya Dayalı İşlemeler ve Rızanın Geri Alınması",
        "paragraphs": [
          "Şirket, hizmetin sunulması için zorunlu olan işlemeleri açık rızaya değil, yukarıdaki tabloda gösterilen diğer hukuki sebeplere dayandırır. Açık rıza yalnızca gerçekten rıza gerektiren, sınırlı sayıdaki işleme için alınır ve rızanın verilmemesi hizmetin reddi sonucunu doğurmaz.",
          "Açık rıza, verildiği anda tarih, kanal, metin sürümü ve teknik iz bilgileriyle birlikte kayıt altına alınır. Rızanızı dilediğiniz zaman, gelecek dönem için geçerli olmak üzere geri alabilirsiniz; geri alma, geri alma anına kadar hukuka uygun biçimde yapılmış işlemelerin geçerliliğini etkilemez."
        ],
        "ordered": [
          "Ticari ileti izninizi, her iletinin sonunda yer alan ret bağlantısıyla, İleti Yönetim Sistemi (İYS) üzerinden veya {{EMAIL}} adresine talep göndererek geri alabilirsiniz.",
          "Çerez tercihlerinizi, web sitesindeki çerez tercih panelinden dilediğiniz zaman değiştirebilirsiniz.",
          "Diğer açık rızalarınızı, hesabınızın tercihler bölümünden veya {{EMAIL}} adresine yazılı talebinizle geri alabilirsiniz.",
          "Ticari ileti izninin geri alınması talepleri mevzuatın öngördüğü süre içinde, en geç üç iş günü içinde işleme alınır."
        ],
        "bullets": [
          "Ticari elektronik ileti (e-bülten, kampanya, indirim ve yeni ürün duyuruları) gönderimi.",
          "Analitik ve pazarlama amaçlı çerezler ile benzer izleme teknolojilerinin kullanılması.",
          "Kişiselleştirilmiş içerik ve ürün önerisi sunulması amacıyla alışveriş geçmişinin analiz edilmesi.",
          "Sipariş notu alanında kendi iradenizle paylaştığınız alerjen veya özel beslenme bilgilerinin talebinizin karşılanması amacıyla işlenmesi.",
          "Yarışma, çekiliş ve etkinliklerde paylaştığınız görsel ve içeriklerin tanıtım amacıyla kullanılması."
        ]
      },
      {
        "heading": "7. Çocukların Kişisel Verileri",
        "paragraphs": [
          "Platform ve online mağaza 18 yaşını doldurmuş, fiil ehliyetine sahip kişilere yöneliktir. On sekiz yaşından küçükler üye hesabı açamaz, sipariş veremez ve ödeme yapamaz. Üyelik ve sipariş adımlarında bu şarta ilişkin beyan alınır.",
          "Şirket, 18 yaşından küçük bir kişiye ait verinin veli veya vasi onayı olmaksızın işlendiğini tespit ederse, ilgili hesabı kapatır ve söz konusu verileri gecikmeksizin, mevzuattan doğan saklama yükümlülükleri saklı kalmak kaydıyla siler veya yok eder.",
          "Çocuğunuza ait bir verinin Şirket tarafından işlendiğini düşünüyorsanız {{EMAIL}} adresine başvurabilirsiniz; başvuru öncelikli olarak incelenir.",
          "Kafe işletmesinde, çocukların ebeveynleri eşliğinde bulunduğu alanlarda güvenlik kamerası kayıtları dışında çocuklara yönelik ayrı bir veri toplama yapılmaz; markanın sosyal medya hesaplarında çocukların tanınabilir görüntüleri veli izni olmaksızın paylaşılmaz."
        ]
      },
      {
        "heading": "8. Kişisel Verilerin Aktarıldığı Taraf Kategorileri",
        "paragraphs": [
          "Kişisel verileriniz, yukarıda sayılan amaçlarla sınırlı olmak ve KVKK'nın aktarıma ilişkin hükümlerine uygun davranılmak kaydıyla aşağıdaki taraf kategorilerine aktarılır. Şirket, kişisel verilerinizi pazarlama amacıyla üçüncü kişilere satmaz, kiralamaz veya bağımsız veri sorumlusu sıfatıyla ticari amaçla devretmez.",
          "Veri işleyen sıfatıyla hizmet alınan her tedarikçiyle, KVKK'nın veri güvenliğine ilişkin hükümleri uyarınca yazılı sözleşme yapılır; bu sözleşmeler gizlilik, talimata uygun işleme, alt işveren kullanımına ilişkin sınırlar, ihlal bildirimi ve hizmet sonunda veriyi iade/imha yükümlülüklerini içerir."
        ],
        "table": [
          {
            "key": "Ödeme ve elektronik para kuruluşları, sanal POS hizmeti veren bankalar",
            "value": "Ödemenin alınması, 3D Secure doğrulaması, ön provizyon, taksitlendirme, iade ve itiraz süreçlerinin yürütülmesi. Kart numarasının tamamı Şirket sistemlerinde tutulmaz; kart verisi doğrudan PCI-DSS uyumlu ödeme altyapısında işlenir."
          },
          {
            "key": "Kargo ve kurye şirketleri",
            "value": "Gönderinin teslimi amacıyla alıcı adı, adresi ve telefonunun aktarılması; Türkiye geneli için Yurtiçi Kargo, KKTC ve yurt dışı gönderiler için Aras Kargo, İstanbul içi hızlı teslimat için motokurye hizmeti."
          },
          {
            "key": "Bulut barındırma ve altyapı sağlayıcıları",
            "value": "Web sitesinin yayımlanması ve verinin depolanması; uygulama katmanı için Vercel, veri tabanı katmanı için Supabase/PostgreSQL altyapısı (satır düzeyi güvenlik açık)."
          },
          {
            "key": "İşlemsel e-posta ve iletişim sağlayıcıları",
            "value": "Sipariş onayı, e-posta doğrulama, parola sıfırlama ve kargo bildirimlerinin gönderilmesi; bu amaçla Resend altyapısı kullanılır."
          },
          {
            "key": "Analitik ve ölçümleme sağlayıcıları",
            "value": "Açık rızanıza bağlı olarak site kullanımının istatistiksel ölçümü; mümkün olan hâllerde IP kısaltma ve takma adlaştırma uygulanır."
          },
          {
            "key": "Muhasebe, mali müşavirlik ve bağımsız denetim hizmeti sağlayıcıları",
            "value": "Fatura, defter ve mali kayıtların düzenlenmesi ile yasal beyanların hazırlanması."
          },
          {
            "key": "Hukuk ve danışmanlık hizmeti sağlayıcıları",
            "value": "Uyuşmazlıkların takibi, hukuki görüş alınması ve savunma hakkının kullanılması."
          },
          {
            "key": "Ticari elektronik ileti altyapısı ve İleti Yönetim Sistemi (İYS)",
            "value": "Ticari ileti onay ve ret kayıtlarının mevzuat gereği İYS'ye işlenmesi ve sorgulanması."
          },
          {
            "key": "Yetkili kamu kurum ve kuruluşları ile yargı mercileri",
            "value": "Kanunlarda öngörülen hâllerde ve usulüne uygun talep üzerine; örneğin mahkemeler, icra daireleri, Ticaret Bakanlığı, Gelir İdaresi Başkanlığı ve Kişisel Verileri Koruma Kurumu."
          },
          {
            "key": "Sigorta ve tahsilat hizmeti sağlayıcıları",
            "value": "Gönderi sigortası ve tahsil edilemeyen alacakların takibi bakımından, yalnızca gerekli asgari veriyle sınırlı olmak üzere."
          },
          {
            "key": "Şirket ortakları, yetkilileri ve yetkilendirilmiş personel",
            "value": "Görev ve yetki alanıyla sınırlı, bilmesi gereken ilkesine ve rol bazlı erişim denetimine tabi olarak."
          }
        ]
      },
      {
        "heading": "9. Yurt Dışına Aktarım",
        "paragraphs": [
          "Şirketin kullandığı bulut barındırma, e-posta gönderim ve analitik hizmetlerinin bir kısmı yurt dışında yerleşik sağlayıcılar tarafından sunulmakta olup, bu kapsamda kişisel verileriniz yurt dışında bulunan sunuculara aktarılabilmekte veya buralardan erişilebilmektedir.",
          "Yurt dışına aktarım, KVKK'nın kişisel verilerin yurt dışına aktarılmasını düzenleyen 9. maddesi çerçevesinde gerçekleştirilir. Aktarım, öncelikle Kurul tarafından yeterli korumaya sahip olduğu ilan edilen ülkelere; bunun bulunmadığı hâllerde ise mevzuatta öngörülen uygun güvencelerden birine (standart sözleşme, bağlayıcı şirket kuralları, taahhütname veya uluslararası sözleşme) dayanılarak yapılır. Bu güvencelerin sağlanamadığı istisnai durumlarda aktarım, mevzuatta öngörülen arızi hâllere veya ayrıca alınan açık rızanıza dayanır.",
          "Şirket, yurt dışına aktarımlarda veri minimizasyonunu gözetir; aktarılan veriyi hizmetin gerektirdiği asgari kapsamla sınırlar, aktarım kanallarını TLS ile şifreler ve sağlayıcılarla yazılı veri işleme sözleşmeleri akdeder.",
          "Yurt dışına aktarımın kapsamı, aktarılan veri kategorileri ve dayanılan güvence hakkında ayrıntılı bilgi almak için {{EMAIL}} adresine başvurabilirsiniz."
        ]
      },
      {
        "heading": "10. Saklama Süreleri ve İmha",
        "paragraphs": [
          "Kişisel verileriniz, işlendikleri amaç için gerekli olan süre boyunca ve her hâlde ilgili mevzuatta öngörülen asgari saklama süreleri kadar muhafaza edilir. Sürenin sona ermesi veya işleme sebebinin ortadan kalkması hâlinde veriler, Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik uyarınca resen veya talebiniz üzerine silinir, yok edilir ya da anonim hâle getirilir.",
          "Şirket, periyodik imha süreçlerini mevzuatın öngördüğü azami aralıklarla yürütür. Bir dava, soruşturma veya idari inceleme bulunması hâlinde ilgili veriler, süreç kesinleşene ve yasal zamanaşımı süreleri dolana kadar saklanmaya devam eder."
        ],
        "table": [
          {
            "key": "Üyelik hesabı ve hesap verileri",
            "value": "Üyelik devam ettiği sürece; hesabın kapatılmasından itibaren yasal zamanaşımı süresi boyunca sınırlı erişimle saklanır, ardından silinir."
          },
          {
            "key": "Sipariş, fatura ve muhasebe kayıtları",
            "value": "213 sayılı Vergi Usul Kanunu ve 6102 sayılı Türk Ticaret Kanunu uyarınca öngörülen yasal saklama süreleri boyunca (defter ve belgeler bakımından on yıla kadar)."
          },
          {
            "key": "Ödeme işlem kayıtları ve maskelenmiş kart bilgisi",
            "value": "İşlemin tamamlanmasından itibaren mali mevzuat ve itiraz (chargeback) süreçlerinin gerektirdiği süre boyunca; sonrasında imha edilir."
          },
          {
            "key": "Mesafeli satış onay kaydı (tarih, IP, tarayıcı, belge sürümü)",
            "value": "Sözleşmeden doğan uyuşmazlıklara ilişkin zamanaşımı süresi boyunca; delil niteliği taşıdığından sipariş kaydıyla birlikte saklanır."
          },
          {
            "key": "Teslimat ve kargo kayıtları",
            "value": "Teslimatın tamamlanmasından itibaren, iade ve ayıp ihbarı süreçlerinin gerektirdiği süre ile yasal zamanaşımı süresi boyunca."
          },
          {
            "key": "Talep, şikâyet ve iade yazışmaları",
            "value": "Talebin sonuçlandırılmasından itibaren yasal zamanaşımı süresi boyunca."
          },
          {
            "key": "Sunucu ve uygulama logları",
            "value": "5651 sayılı Kanun ve ikincil düzenlemelerinde öngörülen asgari süreler ile güvenlik ihtiyacının gerektirdiği süre boyunca; ardından silinir veya anonimleştirilir."
          },
          {
            "key": "Yönetici olay kaydı (audit log)",
            "value": "Değiştirilemez biçimde tutulur; güvenlik ve hesap verebilirlik amacıyla mevzuatın öngördüğü süre boyunca saklanır."
          },
          {
            "key": "Ticari elektronik ileti onay ve ret kayıtları",
            "value": "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik uyarınca onayın geçerli olduğu süre ve onayın geri alınmasından itibaren mevzuatta öngörülen süre boyunca."
          },
          {
            "key": "Çerez ve rıza kayıtları",
            "value": "Çerez türüne göre oturum süresi ile en fazla on iki ay arasında; rıza kayıtları ise ispat yükümlülüğü süresince saklanır."
          },
          {
            "key": "Güvenlik kamerası görüntüleri",
            "value": "Kayıt tarihinden itibaren kısa süreli olarak, kural olarak otuz günü aşmayacak şekilde; bu sürenin sonunda otomatik olarak üzerine yazılarak imha edilir. Bir olaya ilişkin kayıt, süreç sonuçlanana kadar ayrı olarak muhafaza edilebilir."
          },
          {
            "key": "Bayilik ve iş birliği başvuruları",
            "value": "Başvurunun olumsuz sonuçlanmasından itibaren en fazla iki yıl; olumlu sonuçlanırsa sözleşmesel ilişkinin saklama süresine tabi olur."
          }
        ]
      },
      {
        "heading": "11. Otomatik Karar Verme ve Profilleme",
        "paragraphs": [
          "Şirket, hakkınızda hukuki sonuç doğuran veya sizi benzer şekilde önemli ölçüde etkileyen, münhasıran otomatik sistemler aracılığıyla verilen kararlar almamaktadır. Sipariş, iade ve müşteri talepleriyle ilgili nihai değerlendirmeler insan incelemesine tabidir.",
          "Ödeme adımında ödeme kuruluşu ve kart çıkaran banka tarafından yürütülen risk ve dolandırıcılık kontrolleri ile 3D Secure doğrulaması sonucunda bir işlem otomatik olarak reddedilebilir. Bu kontroller ilgili kuruluşların kendi sistemleri ve kuralları uyarınca yürütülür; böyle bir durumda Şirketle {{EMAIL}} adresi üzerinden iletişime geçerek işlemin insan tarafından yeniden değerlendirilmesini talep edebilirsiniz.",
          "Açık rızanıza bağlı olarak, alışveriş geçmişiniz ve site içi gezinme verileriniz üzerinden ürün önerisi ve kampanya segmentasyonu yapılabilir. Bu profilleme, yalnızca pazarlama içeriğinin kişiselleştirilmesine yöneliktir; fiyatlandırmayı, sözleşme koşullarını veya hizmete erişiminizi etkilemez ve rızanızı geri aldığınızda durur.",
          "Hesap güvenliği amacıyla uygulanan otomatik kontroller (örneğin ardışık başarısız girişlerden sonra kısa süreli hesap kilitleme) sınırlı ve geçici tedbirlerdir; her hâlde {{EMAIL}} adresi üzerinden itiraz edebilir ve manuel inceleme talep edebilirsiniz."
        ]
      },
      {
        "heading": "12. Veri Güvenliği Tedbirleri",
        "paragraphs": [
          "Şirket, KVKK'nın veri güvenliğine ilişkin 12. maddesi uyarınca, kişisel verilerin hukuka aykırı olarak işlenmesini ve verilere hukuka aykırı erişilmesini önlemek ile verilerin muhafazasını sağlamak amacıyla uygun güvenlik düzeyini temin etmeye yönelik teknik ve idari tedbirleri alır. Aşağıdaki tedbirler, hâlihazırda uygulanan başlıca önlemlerdir."
        ],
        "bullets": [
          "Site genelinde HTTPS/TLS ile şifreli iletişim; oturum çerezlerinin httpOnly ve güvenli biçimde, HMAC-SHA256 ile imzalanarak kullanılması.",
          "Üye parolalarının hiçbir zaman düz metin olarak saklanmaması; bcrypt algoritmasıyla, tuzlanmış özet (hash) biçiminde tutulması.",
          "Yönetici erişiminin zaman tabanlı tek kullanımlık şifre (TOTP) ile iki aşamalı doğrulamaya bağlanması ve giriş denemelerinin hız sınırlamasıyla korunması.",
          "Rol bazlı erişim denetimi ve bilmesi gereken ilkesi; yönetici yetkilerinin görev alanına göre ayrıştırılması.",
          "Tüm yönetici mutasyonlarının, kim tarafından ne zaman yapıldığı bilgisiyle birlikte değiştirilemez olay kaydına (audit log) yazılması.",
          "Veri tabanı katmanında satır düzeyi güvenliğin (RLS) açık tutulması ve varsayılan olarak tüm erişimin reddedilmesi; ayrıcalıklı anahtarların yalnızca sunucu tarafında kullanılması.",
          "Kart verisinin Şirket sistemlerinde tutulmaması; ödeme işlemlerinin PCI-DSS uyumlu ödeme altyapısı üzerinden ve 3D Secure doğrulamasıyla gerçekleştirilmesi.",
          "Sunucu tarafı doğrulama: tüm form girdilerinin şema bazlı doğrulamadan geçirilmesi; tutar ve fiyat bilgilerinin istemciden gelen değere değil, sunucudaki kayıtlı değere göre hesaplanması.",
          "Ödeme bildirimlerinde imza doğrulaması ve mükerrer işlem koruması (idempotency) uygulanması.",
          "Düzenli yedekleme, yedeklerin şifrelenmesi ve geri dönüş testlerinin yapılması.",
          "Yazılım bağımlılıklarının güncel tutulması, güvenlik yamalarının takibi ve değişikliklerin sürüm denetimi ile gözden geçirmeden geçirilmesi.",
          "Kayıt ve raporlamalarda kişisel verinin maskelenmesi; e-posta ve telefon gibi verilerin log kayıtlarında açık biçimde tutulmaması ilkesi.",
          "Veri işleyenlerle yazılı gizlilik ve veri işleme sözleşmeleri akdedilmesi, çalışanlara düzenli farkındalık eğitimi verilmesi ve gizlilik taahhütnamesi alınması.",
          "Fiziksel güvenlik: kafe işletmesinde basılı belgelerin kilitli dolaplarda tutulması, imha edilecek evrakın kâğıt öğütücüyle yok edilmesi."
        ]
      },
      {
        "heading": "13. Çerezler ve Benzeri Teknolojiler",
        "paragraphs": [
          "Platformda; oturumun sürdürülmesi, sepetin korunması, güvenlik ve temel işlevlerin sağlanması için zorunlu çerezler ile açık rızanıza bağlı olarak tercih, analitik ve pazarlama çerezleri kullanılır. Zorunlu çerezler, hizmetin sunulabilmesi için teknik olarak gerekli olduğundan rızaya tabi değildir; diğer çerez kategorileri yalnızca çerez izin panelinden onay vermeniz hâlinde çalışır.",
          "Sepet içeriği ve arayüz tercihleri gibi bazı bilgiler, tarayıcınızın yerel depolama (localStorage) alanında cihazınızda tutulabilir. Bu veriler cihazınızdan silinerek her zaman kaldırılabilir.",
          "Çerez tercihlerinizi, çerez tercih panelinden dilediğiniz zaman değiştirebilir; tarayıcı ayarlarından çerezleri engelleyebilir veya silebilirsiniz. Zorunlu çerezlerin engellenmesi hâlinde üyelik girişi, sepet ve ödeme adımı gibi işlevler çalışmayabilir.",
          "Kullanılan çerezlerin adı, amacı, türü, süresi ve varsa üçüncü taraf sağlayıcısı, {{SITE_URL}} adresinde yayımlanan Çerez Politikası'nda ayrıntılı olarak listelenmiştir. Bu Politika, Çerez Politikası ile birlikte okunur; çerezler yoluyla elde edilen kişisel veriler bakımından bu metindeki tüm hak ve yükümlülükler geçerlidir."
        ]
      },
      {
        "heading": "14. İlgili Kişi Olarak Haklarınız",
        "paragraphs": [
          "KVKK'nın 11. maddesi uyarınca, veri sorumlusu sıfatıyla {{LEGAL_NAME}}'ye başvurarak kişisel verilerinizle ilgili aşağıdaki taleplerde bulunma hakkına sahipsiniz."
        ],
        "ordered": [
          "Kişisel verilerinizin işlenip işlenmediğini öğrenme.",
          "Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme.",
          "Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme.",
          "Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme.",
          "Kişisel verilerinizin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme.",
          "KVKK'nın 7. maddesinde öngörülen şartlar çerçevesinde kişisel verilerinizin silinmesini veya yok edilmesini isteme.",
          "Düzeltme, silme ve yok etme talepleriniz uyarınca yapılan işlemlerin, kişisel verilerinizin aktarıldığı üçüncü kişilere bildirilmesini isteme.",
          "İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme.",
          "Kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme."
        ]
      },
      {
        "heading": "15. Başvuru Yolu, Yanıt Süresi ve Şikâyet",
        "paragraphs": [
          "Yukarıdaki haklarınıza ilişkin taleplerinizi, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'de öngörülen usullere uygun olarak Şirkete iletebilirsiniz. Başvurunuzun geçerli sayılabilmesi için Türkçe olması ve aşağıdaki asgari bilgileri içermesi gerekir.",
          "Talebiniz, niteliğine göre en kısa sürede ve her hâlde başvurunun Şirkete ulaştığı tarihten itibaren otuz gün içinde sonuçlandırılır. İşlemin ayrıca bir maliyet gerektirmesi hâlinde Kurulca belirlenen tarifedeki ücret alınabilir; başvurunun Şirketin hatasından kaynaklandığı hâllerde alınan ücret iade edilir.",
          "Başvurunuzun reddedilmesi, verilen yanıtı yetersiz bulmanız veya süresinde yanıt verilmemesi hâlinde, yanıtı öğrendiğiniz tarihten itibaren otuz ve her hâlde başvuru tarihinden itibaren altmış gün içinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz. Kurula şikâyet yoluna gitmeden önce Şirkete başvuru yapılması zorunludur. Genel hükümlere göre tazminat talebinde bulunma hakkınız saklıdır."
        ],
        "bullets": [
          "Ad, soyad ve başvuru yazılı ise imza.",
          "Türkiye Cumhuriyeti vatandaşları için T.C. kimlik numarası; yabancılar için uyruk, pasaport numarası veya varsa kimlik numarası.",
          "Tebligata esas yerleşim yeri veya iş yeri adresi.",
          "Varsa bildirime esas elektronik posta adresi, telefon ve faks numarası.",
          "Talep konusunun açık biçimde belirtilmesi ve varsa konuya ilişkin bilgi ve belgelerin eklenmesi."
        ],
        "table": [
          {
            "key": "Yazılı başvuru",
            "value": "{{ADDRESS}} adresine ıslak imzalı dilekçenin şahsen teslimi veya noter aracılığıyla gönderimi."
          },
          {
            "key": "Elektronik posta ile başvuru",
            "value": "Sistemimizde kayıtlı bulunan e-posta adresinizden {{EMAIL}} adresine, konu kısmında talebin belirtilmesi suretiyle."
          },
          {
            "key": "Güvenli elektronik imza",
            "value": "Kayıtlı elektronik posta (KEP) adresi, güvenli elektronik imza veya mobil imza kullanılarak, mevzuatta öngörülen diğer yöntemlerle."
          },
          {
            "key": "Şirketin KEP adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "Yanıt süresi",
            "value": "En kısa sürede ve en geç otuz gün."
          },
          {
            "key": "Ücret",
            "value": "Kural olarak ücretsiz; işlemin ayrıca maliyet gerektirmesi hâlinde Kurulca belirlenen tarifedeki tutar."
          }
        ]
      },
      {
        "heading": "16. GDPR Kapsamındaki Ek Haklar",
        "paragraphs": [
          "Avrupa Birliği'nde bulunmanız ve verilerinizin işlenmesinin (AB) 2016/679 sayılı Genel Veri Koruma Tüzüğü (GDPR) kapsamına girmesi hâlinde, KVKK'dan doğan haklarınıza ek olarak aşağıdaki haklara sahipsiniz. Bu haklar da {{EMAIL}} adresine yapılacak başvuruyla kullanılır ve kural olarak bir ay içinde yanıtlanır.",
          "GDPR kapsamındaki işlemelerde dayandığımız hukuki sebepler, KVKK bölümündeki tabloya paralel biçimde sözleşmenin ifası, hukuki yükümlülük, meşru menfaat ve açık rızadır. Rızaya dayalı işlemelerde rızanızı dilediğiniz zaman geri alabilirsiniz."
        ],
        "bullets": [
          "Erişim hakkı: İşlenen kişisel verilerinize ve işlemeye ilişkin bilgilere erişme ve bunların bir kopyasını talep etme.",
          "Düzeltme hakkı: Yanlış veya eksik verilerin düzeltilmesini ve tamamlanmasını isteme.",
          "Silinme (unutulma) hakkı: Mevzuatta öngörülen şartların varlığı hâlinde verilerinizin silinmesini isteme.",
          "İşlemenin kısıtlanması hakkı: Verinin doğruluğuna itiraz ettiğiniz veya işlemenin hukuka aykırı olduğunu ileri sürdüğünüz hâllerde işlemenin sınırlandırılmasını isteme.",
          "Veri taşınabilirliği hakkı: Rızaya veya sözleşmeye dayanılarak otomatik yollarla işlenen verilerinizi yapılandırılmış, yaygın olarak kullanılan ve makine tarafından okunabilir bir biçimde alma ve teknik olarak mümkünse başka bir veri sorumlusuna aktarılmasını isteme.",
          "İtiraz hakkı: Meşru menfaate dayalı işlemelere ve doğrudan pazarlama amaçlı işlemelere itiraz etme; doğrudan pazarlamaya itiraz hâlinde işleme derhâl durdurulur.",
          "Otomatik karara tabi olmama hakkı: Hakkınızda hukuki sonuç doğuran, münhasıran otomatik işlemeye dayalı kararlara tabi tutulmama ve insan müdahalesi talep etme.",
          "Rızayı geri alma hakkı: Geri alma anına kadar yapılan işlemenin hukuka uygunluğunu etkilemeksizin, verdiğiniz rızayı geri alma.",
          "Denetim makamına şikâyet hakkı: Bulunduğunuz ülkedeki veri koruma denetim makamına şikâyette bulunma ve etkili yargısal başvuru yollarına gitme."
        ]
      },
      {
        "heading": "17. Ticari Elektronik İletiler ve İYS",
        "paragraphs": [
          "Kampanya, indirim, yeni ürün ve etkinlik duyuruları gibi ticari elektronik iletiler, yalnızca 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ile Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik uyarınca alınmış geçerli onayınız bulunması hâlinde gönderilir. Onaylar, mevzuat gereği İleti Yönetim Sistemi'ne (İYS) kaydedilir ve gönderim öncesinde İYS üzerinden kontrol edilir.",
          "Siparişinizin durumu, e-posta doğrulama, parola sıfırlama, kargo bildirimi, iade ve fatura bilgilendirmesi gibi işlemsel iletiler; sözleşmenin ifasına yönelik olduğundan ticari elektronik ileti kapsamında değildir ve ayrı onay aranmaksızın gönderilir. Bu iletilerin alınmaması, üyeliğin sonlandırılmasıyla mümkündür.",
          "Her ticari elektronik iletide gönderici olarak {{LEGAL_NAME}} kimliği, {{BRAND}} markası ve iletişim bilgileri yer alır; ayrıca ücretsiz ve kolay erişilebilir bir ret (abonelikten çıkma) imkânı sunulur. Ret bildiriminiz, mevzuatta öngörülen süre içinde, en geç üç iş günü içinde işleme alınır ve İYS kaydınız güncellenir.",
          "Ticari ileti onayınıza ilişkin kayıtlar (onay tarihi, kanalı, metni ve teknik iz bilgileri) ispat yükümlülüğü kapsamında mevzuatın öngördüğü süre boyunca saklanır."
        ]
      },
      {
        "heading": "18. Güvenlik Kamerası Aydınlatması",
        "paragraphs": [
          "{{ADDRESS}} adresindeki {{BRAND}} işletmesinde, can ve mal güvenliğinin sağlanması ile hırsızlık ve zarar verme olaylarının önlenmesi ve tespiti amacıyla güvenlik kamerası sistemi kullanılmaktadır. Bu işleme, KVKK'nın 5. maddesinde düzenlenen meşru menfaat hukuki sebebine dayanır.",
          "Kamera kayıtları yalnızca görüntü kaydından ibarettir; ses kaydı alınmaz. Kameralar; kasa alanı, giriş-çıkış noktaları ve müşteriye açık ortak alanlarla sınırlı olarak konumlandırılmış olup, tuvalet, soyunma alanı ve benzeri mahremiyetin yüksek olduğu yerlerde kamera bulunmaz.",
          "İzleme yapıldığına ilişkin bilgilendirme, işletme girişinde ve izlemenin yapıldığı alanlarda görünür biçimde yer alan katmanlı aydınlatma levhalarıyla sağlanır. Kayıtlara yalnızca yetkilendirilmiş sınırlı sayıda kişi, gerekçesi kayda geçirilerek erişebilir.",
          "Kayıtlar kural olarak otuz günü aşmayacak şekilde saklanır ve süre sonunda otomatik olarak üzerine yazılarak imha edilir. Bir olaya ilişkin kayıtlar, yetkili merciye sunulmak veya hukuki süreçte delil olarak kullanılmak üzere süreç sonuçlanana kadar ayrı olarak muhafaza edilebilir; bu kayıtlar mevzuata uygun talep hâlinde adli ve idari makamlarla paylaşılır."
        ]
      },
      {
        "heading": "19. Mesafeli Satış Onay Kaydı ve Delil Niteliği",
        "paragraphs": [
          "Online mağazadan verdiğiniz siparişlerde, ödeme adımında Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi ayrı bir onay kutucuğuyla onaylanır. Bu onay, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca sözleşmenin kurulması için zorunlu bir adımdır.",
          "Onay anında; onay tarihi ve saati, kullandığınız IP adresi, tarayıcı ve cihaz bilgisi ile onayladığınız belgelerin sürüm numarası ve içerik özeti sipariş kaydına yazılır. Bu kayıtlar, hangi metnin hangi anda onaylandığının ispatı amacıyla tutulur ve pazarlama amacıyla kullanılmaz.",
          "6100 sayılı Hukuk Muhakemeleri Kanunu'nun delil sözleşmesine ilişkin düzenlemesi çerçevesinde, taraflar arasındaki uyuşmazlıklarda Şirketin usulüne uygun tutulan elektronik kayıtları, sunucu logları, sipariş ve onay kayıtları delil olarak kabul edilir. Bu hüküm, tüketicinin 6502 sayılı Kanun ve ilgili mevzuattan doğan haklarını ve karşı delil sunma imkânını ortadan kaldırmaz.",
          "Bu kayıtlar, sözleşmeden doğan uyuşmazlıklara ilişkin zamanaşımı süresi boyunca saklanır; talebiniz hâlinde onayladığınız belgelerin ilgili sürümünün bir kopyası {{EMAIL}} adresi üzerinden tarafınıza iletilir."
        ]
      },
      {
        "heading": "20. Veri İhlali Bildirimi",
        "paragraphs": [
          "Şirket, işlenen kişisel verilerin kanuni olmayan yollarla başkaları tarafından elde edildiğini tespit etmesi hâlinde, KVKK'nın 12. maddesi ve Kurul kararları uyarınca durumu gecikmeksizin ilgili kişilere ve Kişisel Verileri Koruma Kurulu'na bildirir. Kurula bildirim, ihlalin öğrenilmesinden itibaren gecikmeksizin ve en geç yetmiş iki saat içinde yapılır.",
          "İlgili kişilere yapılacak bildirim; ihlalin ne zaman ve nasıl gerçekleştiği, hangi veri kategorilerinin etkilendiği, olası sonuçları, alınan ve alınması önerilen tedbirler ile başvurulabilecek iletişim noktasını içerir. Bildirim, iletişim adresinize doğrudan; buna ulaşılamadığı hâllerde {{SITE_URL}} adresinde yayımlanacak duyuru gibi uygun yöntemlerle yapılır.",
          "Şirket, ihlal şüphesi hâlinde derhâl olay müdahale sürecini başlatır; etkilenen sistemleri izole eder, oturumları ve gerektiğinde parolaları geçersiz kılar, ilgili kayıtların adli inceleme için korunmasını sağlar ve kök neden analizinin ardından tekrarı önleyecek tedbirleri uygular. Tüm ihlal süreçleri kayıt altına alınır.",
          "Veri güvenliğine ilişkin bir açık veya şüphe tespit ettiğinizde {{EMAIL}} adresine bildirimde bulunmanızı rica ederiz; bildirimler gizlilik içinde ve öncelikli olarak değerlendirilir."
        ]
      },
      {
        "heading": "21. Politikada Değişiklikler ve Yürürlük",
        "paragraphs": [
          "Şirket, mevzuattaki değişiklikler, Kurul kararları, kullanılan hizmet sağlayıcılardaki değişimler veya sunulan hizmetlerin kapsamındaki güncellemeler nedeniyle bu Gizlilik Politikası'nda değişiklik yapma hakkını saklı tutar.",
          "Güncellenen metin, {{SITE_URL}} adresinde yayımlandığı anda yürürlüğe girer ve yürürlük tarihi ile sürüm bilgisi metin üzerinde gösterilir. Politikanın önceki sürümleri, ispat ve şeffaflık amacıyla Şirket kayıtlarında saklanır; talep etmeniz hâlinde ilgili sürüm tarafınızla paylaşılır.",
          "Haklarınızı veya işleme faaliyetlerinin niteliğini esaslı biçimde etkileyen değişiklikler, yürürlüğe girmeden önce üye hesabınıza kayıtlı e-posta adresine bildirim yapılarak veya site üzerinde belirgin bir duyuruyla ayrıca bildirilir. Açık rıza gerektiren yeni bir işleme söz konusu olduğunda, rızanız ayrıca ve yeniden alınır.",
          "Bu Politika, Çerez Politikası, Üyelik Sözleşmesi, Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi ile birlikte bütün oluşturur. Metinler arasında çelişki bulunması hâlinde, kişisel verilerin korunmasına ilişkin konularda bu Politika esas alınır."
        ]
      },
      {
        "heading": "22. İletişim",
        "paragraphs": [
          "Bu Gizlilik Politikası'na, kişisel verilerinizin işlenmesine veya haklarınızın kullanımına ilişkin her türlü soru, talep ve bildiriminizi aşağıdaki kanallardan iletebilirsiniz. Kişisel veri taleplerinde başvurunuzun {{EMAIL}} adresine, konu satırında talebin niteliği belirtilerek gönderilmesi süreci hızlandırır.",
          "Sosyal medya hesaplarımız üzerinden gönderilen mesajlar, kimlik doğrulaması yapılamadığından resmî KVKK başvurusu olarak işleme alınmaz; bu tür talepleri lütfen yukarıdaki resmî kanallardan iletin."
        ],
        "table": [
          {
            "key": "Veri sorumlusu",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Adres",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta (KVKK başvuruları, müşteri hizmetleri, iade)",
            "value": "{{EMAIL}}"
          },
          {
            "key": "Web sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Instagram",
            "value": "{{IG}}"
          },
          {
            "key": "TikTok",
            "value": "{{TIKTOK}}"
          },
          {
            "key": "YouTube",
            "value": "{{YOUTUBE}}"
          },
          {
            "key": "Sosyal medya kullanıcı adı",
            "value": "{{HANDLE}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil numarası",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          }
        ]
      }
    ]
  },
  {
    "slug": "kvkk-aydinlatma-metni",
    "title": "KVKK Aydınlatma Metni",
    "shortTitle": "Aydınlatma Metni",
    "category": "Veri & Gizlilik",
    "summary": "6698 sayılı Kanun'un 10. maddesi uyarınca {{BRAND}} markası altında hangi kişisel verilerin, hangi amaçla ve hangi hukuki sebeple işlendiğini; kimlere aktarıldığını, ne kadar saklandığını ve ilgili kişinin haklarını açıklayan aydınlatma metnidir.",
    "references": [
      "6698 sayılı Kişisel Verilerin Korunması Kanunu (m.3 tanımlar, m.4 genel ilkeler, m.5 kişisel verilerin işlenme şartları, m.6 özel nitelikli kişisel verilerin işlenme şartları, m.7 silme/yok etme/anonim hale getirme, m.8 yurt içi aktarım, m.9 yurt dışına aktarım, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliğine ilişkin yükümlülükler, m.13 veri sorumlusuna başvuru, m.14 Kurula şikâyet, m.15 şikâyet üzerine inceleme)",
      "Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik",
      "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ",
      "Veri Sorumluları Sicili Hakkında Yönetmelik",
      "Yurt Dışına Kişisel Veri Aktarımı Hakkında Yönetmelik",
      "Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ",
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
      "Mesafeli Sözleşmeler Yönetmeliği (RG: 27.11.2014, 29188)",
      "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İleti Yönetim Sistemi - İYS)",
      "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik",
      "5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun",
      "5070 sayılı Elektronik İmza Kanunu",
      "213 sayılı Vergi Usul Kanunu",
      "6102 sayılı Türk Ticaret Kanunu",
      "6098 sayılı Türk Borçlar Kanunu",
      "5464 sayılı Banka Kartları ve Kredi Kartları Kanunu",
      "6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun",
      "5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu",
      "Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği",
      "4857 sayılı İş Kanunu",
      "4721 sayılı Türk Medeni Kanunu",
      "6100 sayılı Hukuk Muhakemeleri Kanunu"
    ],
    "sections": [
      {
        "heading": "1. Amaç ve Kapsam",
        "paragraphs": [
          "Bu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun (Kanun) 10. maddesi ile Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ uyarınca, veri sorumlusu sıfatıyla {{LEGAL_NAME}} ({{SHORT_NAME}}) tarafından hazırlanmıştır. Amacı, {{BRAND}} markası altında yürütülen faaliyetler kapsamında kişisel verilerinizin kim tarafından, hangi amaçlarla, hangi hukuki sebeplere dayanılarak işlendiğini; kimlere ve hangi amaçla aktarıldığını; ne kadar süreyle saklandığını ve Kanun'un 11. maddesi kapsamındaki haklarınızı kullanabileceğiniz yöntemleri açık, anlaşılır ve ulaşılabilir biçimde ortaya koymaktır.",
          "Aydınlatma yükümlülüğü, kişisel verinin elde edildiği sırada yerine getirilir ve ilgili kişinin açık rızasının alınıp alınmadığından bağımsızdır. Bu nedenle işbu metin, açık rızaya dayanan işleme faaliyetleri kadar, açık rıza dışındaki hukuki sebeplere dayanan işleme faaliyetlerini de kapsar. Aydınlatma metnini okumuş olmanız tek başına bir açık rıza beyanı anlamına gelmez; açık rıza gerektiren hâllerde rızanız, ilgili işlemin yapıldığı anda ayrı ve özgür iradeyle işaretlenen bir onay kutusu ile ayrıca alınır.",
          "Metnin kapsamına şu kanallar girer: {{SITE_URL}} adresinde yayımlanan internet sitesi ve bu site üzerinden işletilen online mağaza (bottega); site üzerinden oluşturulan üyelik hesapları; sipariş, ödeme, kargo, iade ve destek süreçleri; {{ADDRESS}} adresindeki fiziki kafe ve bar işletmesi; {{EMAIL}} adresine ve {{PHONE}} numarasına yapılan başvurular; {{HANDLE}} kullanıcı adıyla işletilen sosyal medya hesapları üzerinden kurulan iletişim; tedarik, satın alma ve insan kaynakları süreçleri.",
          "Bu metin genel niteliktedir. Belirli süreçlere özgü ek aydınlatmalar (örneğin çerez tercih paneli, ticari elektronik ileti onayı, işe alım başvuru formu, kamera kayıt bildirimi) ilgili kanalda ayrıca sunulur ve bu metni tamamlar."
        ]
      },
      {
        "heading": "2. Veri Sorumlusunun Kimliği",
        "paragraphs": [
          "Kanun'un 3. maddesi uyarınca kişisel verilerin işleme amaçlarını ve vasıtalarını belirleyen, veri kayıt sisteminin kurulmasından ve yönetilmesinden sorumlu olan gerçek veya tüzel kişi veri sorumlusudur. {{BRAND}}, {{LEGAL_NAME}} tarafından işletilen bir markadır; hukuki muhatabınız ve veri sorumlusu aşağıda kimliği verilen tüzel kişidir."
        ],
        "table": [
          {
            "key": "Veri sorumlusu (ticaret unvanı)",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Kısa unvan",
            "value": "{{SHORT_NAME}}"
          },
          {
            "key": "İşletilen marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Adres",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Vergi dairesi",
            "value": "{{TAX_OFFICE}}"
          },
          {
            "key": "Vergi kimlik numarası",
            "value": "{{TAX_NO}}"
          },
          {
            "key": "Vergi türü",
            "value": "{{TAX_TYPE}}"
          },
          {
            "key": "Faaliyet kodu (NACE)",
            "value": "{{NACE}}"
          },
          {
            "key": "İşe başlama tarihi",
            "value": "{{STARTED_AT}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil numarası",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "Instagram",
            "value": "{{IG}}"
          },
          {
            "key": "TikTok",
            "value": "{{TIKTOK}}"
          },
          {
            "key": "YouTube",
            "value": "{{YOUTUBE}}"
          }
        ]
      },
      {
        "heading": "3. Tanımlar",
        "paragraphs": [
          "Bu metinde geçen kavramlar, Kanun'un 3. maddesindeki tanımlarla aynı anlamı taşır."
        ],
        "bullets": [
          "Kişisel veri: Kimliği belirli veya belirlenebilir gerçek kişiye ilişkin her türlü bilgi.",
          "Özel nitelikli kişisel veri: Kişilerin ırkı, etnik kökeni, siyasi düşüncesi, felsefi inancı, dini, mezhebi veya diğer inançları, kılık ve kıyafeti, dernek, vakıf ya da sendika üyeliği, sağlığı, cinsel hayatı, ceza mahkûmiyeti ve güvenlik tedbirleriyle ilgili verileri ile biyometrik ve genetik verileri.",
          "İlgili kişi: Kişisel verisi işlenen gerçek kişi; bu metinde müşteri, üye, ziyaretçi, bülten abonesi, tedarikçi yetkilisi ve çalışan adayı olarak siz.",
          "Veri sorumlusu: İşleme amaçlarını ve vasıtalarını belirleyen, veri kayıt sisteminin kurulmasından ve yönetilmesinden sorumlu kişi; bu metinde {{LEGAL_NAME}}.",
          "Veri işleyen: Veri sorumlusunun verdiği yetkiye dayanarak onun adına kişisel veri işleyen kişi; örneğin barındırma, veri tabanı, e-posta gönderimi ve kargo altyapısı sağlayıcılarımız.",
          "Kişisel verilerin işlenmesi: Verilerin elde edilmesi, kaydedilmesi, depolanması, muhafazası, değiştirilmesi, yeniden düzenlenmesi, açıklanması, aktarılması, sınıflandırılması ya da kullanılmasının engellenmesi gibi her türlü işlem.",
          "Açık rıza: Belirli bir konuya ilişkin, bilgilendirmeye dayanan ve özgür iradeyle açıklanan rıza.",
          "İmha: Kişisel verilerin silinmesi, yok edilmesi veya anonim hale getirilmesi.",
          "Kurum ve Kurul: Kişisel Verileri Koruma Kurumu ve Kişisel Verileri Koruma Kurulu.",
          "İYS: 6563 sayılı Kanun kapsamında ticari elektronik ileti onaylarının saklandığı ve yönetildiği İleti Yönetim Sistemi."
        ]
      },
      {
        "heading": "4. Kişisel Verilerin İşlenmesine İlişkin Genel İlkeler",
        "paragraphs": [
          "Kanun'un 4. maddesi uyarınca kişisel verileriniz aşağıdaki ilkelere uygun olarak işlenir. Bu ilkeler, işbu metinde sayılan tüm amaç ve hukuki sebepler bakımından bağlayıcıdır; hiçbir işleme faaliyeti bu ilkelerin dışına çıkacak şekilde yürütülmez."
        ],
        "ordered": [
          "Hukuka ve dürüstlük kurallarına uygun olma: Veriler yalnızca bu metinde açıklanan amaçlarla ve ilgili kişinin makul beklentisini aşmayacak şekilde işlenir.",
          "Doğru ve gerektiğinde güncel olma: Üyelik hesabınızdaki iletişim ve adres bilgilerinizi güncelleme imkânı size sunulur; hatalı veri tespit edildiğinde düzeltilir.",
          "Belirli, açık ve meşru amaçlar için işlenme: Her veri kategorisi, bu metinde açıkça sayılmış bir amaca bağlıdır; sonradan bağdaşmayan bir amaç için kullanılmaz.",
          "İşlendikleri amaçla bağlantılı, sınırlı ve ölçülü olma: Sipariş için gerekmeyen veri talep edilmez; formlarda zorunlu alanlar asgari düzeyde tutulur.",
          "İlgili mevzuatta öngörülen veya işlendikleri amaç için gerekli olan süre kadar muhafaza edilme: Saklama süreleri işbu metnin ilgili maddesinde ve Kişisel Veri Saklama ve İmha Politikası'nda gösterilmiştir."
        ]
      },
      {
        "heading": "5. İlgili Kişi Grupları",
        "paragraphs": [
          "Bu metin, aşağıdaki ilgili kişi gruplarını kapsar. Bir kişi aynı anda birden fazla gruba dahil olabilir; bu hâlde her grup için öngörülen veri kategorileri, amaçlar ve hukuki sebepler birlikte uygulanır."
        ],
        "bullets": [
          "Müşteri: {{SITE_URL}} üzerinden sipariş veren, ödeme yapan, kargo teslimatı alan veya iade/cayma talebinde bulunan gerçek kişi.",
          "Üye: Sitede hesap oluşturan ve e-posta adresini doğrulayan kullanıcı. Online mağazadan sipariş yalnızca e-postası doğrulanmış üyelik hesabıyla verilebildiğinden, sipariş süreçleri üyelik verileriyle birlikte yürütülür.",
          "Ziyaretçi: Üye olmadan {{SITE_URL}} adresini görüntüleyen, menüyü inceleyen, sepet oluşturan ancak sipariş tamamlamayan kullanıcı.",
          "Bülten abonesi: Kampanya, yeni ürün ve etkinlik duyurularını almak üzere e-posta adresini paylaşan ve ticari elektronik ileti onayı veren kişi.",
          "Kafe ziyaretçisi: {{ADDRESS}} adresindeki fiziki işletmeye gelen, masa/rezervasyon talebi ileten, kafe içi ödeme yapan veya güvenlik kamerası görüş alanına giren kişi.",
          "Tedarikçi, iş ortağı ve bunların yetkilileri: Kahve çekirdeği, gelato ve gıda malzemesi, ambalaj, ekipman, lojistik ve hizmet tedarikçilerinin gerçek kişi temsilcileri ve irtibat kişileri.",
          "Çalışan adayı: {{EMAIL}} adresine veya kariyer kanallarına özgeçmiş ve başvuru ileten kişi.",
          "İletişime geçen üçüncü kişiler: Basın mensupları, franchise/iş birliği talebiyle başvuranlar, sosyal medya hesaplarımız üzerinden mesaj gönderenler ve yasal bildirim yapanlar."
        ]
      },
      {
        "heading": "6. İşlenen Kişisel Veri Kategorileri",
        "paragraphs": [
          "Aşağıda, her ilgili kişi grubu bakımından işlenen veri kategorileri ve bunlara giren tipik veriler gösterilmiştir. Bir gruba ilişkin verinin işlenmesi, o kişinin ilgili süreci fiilen kullanmasına bağlıdır; örneğin sipariş vermeyen bir ziyaretçinin teslimat adresi işlenmez."
        ],
        "bullets": [
          "Üye ve müşteri - Kimlik verisi: ad, soyad; fatura kurumsal ise şirket unvanı ve yetkili adı. Sipariş bazında talep edilmesi hâlinde T.C. kimlik numarası yalnızca vergi mevzuatının zorunlu kıldığı belge düzeni için işlenir.",
          "Üye ve müşteri - İletişim verisi: e-posta adresi, cep telefonu numarası, teslimat adresi, fatura adresi, il/ilçe bilgisi.",
          "Üye ve müşteri - Müşteri işlem verisi: sipariş numarası, sipariş tarihi, sepet içeriği (kavrulmuş kahve çekirdeği, yenilebilir waffle kupa, gelato kiti, moka pot/değirmen/tamper gibi ekipman, fincan/önlük/tote gibi marka ürünleri, pistacchio kreması ve şuruplar gibi kiler ürünleri), varyant ve öğütüm tercihi, adet, birim fiyat, indirim/promosyon kodu, KDV tutarı, kargo yöntemi ve ücreti, sipariş durumu, iade ve cayma talepleri, değişim kayıtları, sipariş notu.",
          "Üye ve müşteri - Finansal veri: ödeme yöntemi, işlem tutarı ve para birimi, banka/ödeme kuruluşu tarafından döndürülen işlem referans numarası, ödemenin başarılı/başarısız/iade sonucu, taksit adedi, iade ve chargeback kayıtları. Kart numarasının tamamı, son kullanma tarihi ve CVV/CVC gibi hassas kart verileri tarafımızca görülmez, kaydedilmez ve saklanmaz; bu veriler doğrudan PCI-DSS uyumlu ödeme kuruluşunun altyapısında işlenir. Tarafımıza yalnızca kartın ilk altı/son dört hanesi gibi maskeli bilgiler ve işlem sonucu iletilebilir.",
          "Üye ve müşteri - Hesap ve güvenlik verisi: üyelik kimliği, e-posta doğrulama durumu ve doğrulama zamanı, bcrypt algoritmasıyla özetlenmiş parola (parolanın açık hâli hiçbir aşamada saklanmaz), oturum ve giriş kayıtları, parola sıfırlama talepleri, başarısız giriş denemeleri ve hız sınırlama kayıtları.",
          "Üye ve müşteri - Hukuki işlem ve onay verisi: Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'ni onayladığınız ayrı onay kutusuna ilişkin kayıt; onay tarihi ve saati, IP adresi, tarayıcı ve cihaz bilgisi (user-agent) ile onaylanan belge sürümü. Bu kayıt, 6102 ve 6098 sayılı Kanunlar ile 6100 sayılı Hukuk Muhakemeleri Kanunu kapsamında ispat amacıyla tutulur.",
          "Ziyaretçi - İşlem güvenliği ve kullanım verisi: IP adresi, cihaz ve tarayıcı bilgisi, işletim sistemi, dil tercihi, ziyaret edilen sayfalar ve tıklama akışı, oturum süresi, yönlendiren adres (referrer), zorunlu ve tercihe bağlı çerez kayıtları, sepet ve tercih bilgisi (yerel depolamada tutulan sepet dahil), hata ve performans kayıtları.",
          "Bülten abonesi - Pazarlama verisi: e-posta adresi ve/veya cep telefonu numarası, ticari elektronik ileti onayının alındığı tarih, kanal ve İYS kaydı, gönderim/açılma/tıklanma ve abonelikten çıkma kayıtları, ilgi alanı ve segment bilgisi.",
          "Kafe ziyaretçisi - Fiziksel mekân güvenliği ve işlem verisi: kapalı devre kamera görüntüsü (girişte bildirim levhası bulunan alanlarda), rezervasyon/masa talebi kapsamında ad ve telefon numarası, kafe içi satış fişine bağlı işlem kayıtları, etkinlik katılım listeleri.",
          "Tedarikçi yetkilisi - Kimlik, iletişim ve ticari veri: ad, soyad, görev/unvan, kurumsal e-posta ve telefon, imza sirküleri ve yetki belgelerinde yer alan bilgiler, sözleşme, sipariş, irsaliye ve fatura kayıtları, banka hesap bilgisi (yalnızca ödemenin gerçekleştirilmesi amacıyla).",
          "Çalışan adayı - Özlük öncesi veri: ad, soyad, iletişim bilgileri, özgeçmişte yer alan eğitim ve iş deneyimi bilgileri, referans bilgileri, mülakat notları, başvurulan pozisyon. Özgeçmişinizde kendi inisiyatifinizle paylaştığınız ve pozisyon için gerekli olmayan veriler (fotoğraf, medeni hâl, sağlık bilgisi gibi) tarafımızca değerlendirmede kullanılmaz.",
          "İletişime geçen üçüncü kişiler - İletişim ve talep verisi: ad, e-posta/telefon, mesaj içeriği ve ekleri, sosyal medya kullanıcı adı ve mesaj geçmişi, talebin sonuçlandırılmasına ilişkin kayıtlar."
        ]
      },
      {
        "heading": "7. Kişisel Verilerin İşlenme Amaçları",
        "paragraphs": [
          "Kişisel verileriniz, aşağıda gruplandırılan amaçlarla ve her amacın gerektirdiği ölçüde işlenir. Bir veri kategorisi yalnızca kendisiyle bağlantılı amaç için kullanılır; örneğin siparişinizi tamamlamak üzere alınan teslimat adresi, açık rızanız olmaksızın pazarlama amacıyla kullanılmaz."
        ],
        "bullets": [
          "Üyelik ve hesap yönetimi: Üyelik kaydının oluşturulması, e-posta adresinin doğrulanması, oturum açma, parola sıfırlama, hesap güvenliğinin sağlanması, üyelik sözleşmesinden doğan yükümlülüklerin yerine getirilmesi ve hesabın kapatılması taleplerinin karşılanması.",
          "Sipariş ve sözleşme süreçlerinin yürütülmesi: Sepetin oluşturulması, stok ve fiyat doğrulaması, Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'nin sunulması ve onayın kayda alınması, siparişin oluşturulması, sipariş onayının kalıcı veri saklayıcısıyla iletilmesi ve sipariş durumunun güncellenmesi.",
          "Ödeme işlemlerinin gerçekleştirilmesi ve güvenliği: Ödemenin banka veya ödeme kuruluşu aracılığıyla tahsili, 3D Secure doğrulaması, ön provizyon ve provizyon kapama, taksitlendirme, ödeme sonucunun sipariş kaydına işlenmesi, mükerrer işlem ve dolandırıcılık riskinin önlenmesi, iade ve chargeback (ters ibraz) süreçlerinin yönetilmesi.",
          "Teslimat ve lojistik: Ürünün paketlenmesi, kargo firmasına teslim edilmesi (Türkiye geneli için Yurtiçi Kargo, KKTC ve yurt dışı gönderiler için Aras Kargo, İstanbul içi hızlı teslimat için motokurye), gönderi takip numarasının oluşturulması ve tarafınıza iletilmesi, teslimat sorunlarının çözülmesi.",
          "Faturalandırma ve mali yükümlülükler: 213 sayılı Vergi Usul Kanunu ve ilgili mevzuat uyarınca e-arşiv fatura/fiş düzenlenmesi, KDV'nin hesaplanması ve beyanı, muhasebe kayıtlarının tutulması, ticari defter ve belge saklama yükümlülüklerinin yerine getirilmesi.",
          "Müşteri hizmetleri ve talep yönetimi: {{EMAIL}} ve {{PHONE}} üzerinden gelen soru, şikâyet, ayıplı ürün ihbarı, cayma hakkı ve iade taleplerinin alınması, incelenmesi, sonuçlandırılması ve tarafınıza geri bildirim yapılması.",
          "Cayma hakkı ve iade süreçleri: Mesafeli Sözleşmeler Yönetmeliği kapsamındaki on dört günlük cayma hakkının kullanılması hâlinde bildirimin kayda alınması, ürünün geri alınması, bedelin ve teslimat masraflarının iadesi, cayma hakkı istisnası kapsamındaki ürünlerde durumun değerlendirilmesi ve tarafınıza gerekçeli bilgi verilmesi.",
          "Gıda güvenliği ve tüketici bilgilendirmesi: 5996 sayılı Kanun ve Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği kapsamında ürün içeriği, alerjen bilgisi, son tüketim tarihi ve saklama koşullarına ilişkin bilgilendirmelerin yapılması, gerektiğinde parti bazlı geri çağırma ve tüketici uyarısının ilgili müşterilere iletilmesi.",
          "Stok, ürün ve içerik yönetimi: Sipariş kaynaklı stok düşümü ve stok hareketlerinin kaydı, ürün ve menü içeriklerinin güncellenmesi, tükenen ürünlerin işaretlenmesi.",
          "Ticari iletişim ve pazarlama: Açık rızanıza ve İYS'de kayıtlı onayınıza dayalı olarak bülten, kampanya, yeni ürün ve etkinlik duyurularının gönderilmesi; iletişim tercihlerinizin yönetilmesi ve ret hakkının kolayca kullandırılması.",
          "Ölçümleme ve iyileştirme: Site kullanım istatistiklerinin toplanması, sayfa performansının ve hata oranlarının izlenmesi, ürün yelpazesinin ve kullanıcı deneyiminin geliştirilmesi. Bu amaçla mümkün olan hâllerde toplulaştırılmış veya anonim hale getirilmiş veriler kullanılır.",
          "Bilgi güvenliği ve suistimalin önlenmesi: Yetkisiz erişim girişimlerinin tespiti, giriş denemelerinin hız sınırlamasıyla engellenmesi, yönetici erişimlerinin iki aşamalı doğrulama (TOTP) ile korunması, tüm yönetici işlemlerinin değiştirilemez olay kaydına (audit log) yazılması, log kayıtlarının tutulması ve olay müdahalesi.",
          "Fiziksel mekân güvenliği: Kafe ve depo alanlarında can ve mal güvenliğinin sağlanması amacıyla, girişte bildirim levhası bulunan alanlarda kapalı devre kamera sistemiyle görüntü kaydı yapılması.",
          "Hukuki süreçlerin yönetimi: Uyuşmazlıkların çözümü, tüketici hakem heyeti ve mahkeme süreçlerinde savunma hakkının kullanılması, resmî kurum taleplerinin karşılanması, delil sözleşmesi kapsamındaki kayıtların muhafazası.",
          "Tedarik ve satın alma yönetimi: Tedarikçi ve iş ortaklarıyla sözleşme kurulması ve ifası, sipariş verilmesi, mal kabul, ödeme ve mutabakat süreçlerinin yürütülmesi.",
          "İşe alım süreçleri: Başvuruların değerlendirilmesi, mülakat planlanması, adaya geri bildirim yapılması ve adayın açık rızası hâlinde başvurunun ileride açılacak pozisyonlar için havuzda tutulması."
        ]
      },
      {
        "heading": "8. İşleme Amaçlarının Hukuki Sebepleri (KVKK m.5 ve m.6)",
        "paragraphs": [
          "Kişisel verileriniz, aşağıdaki tabloda her amaç için gösterilen hukuki sebeplere dayanılarak işlenir. Açık rıza, yalnızca başka bir hukuki sebebin bulunmadığı hâllerde ve ilgili işlemin yapıldığı anda ayrıca alınır; hizmetin sunulması açık rıza verilmesi şartına bağlanmaz."
        ],
        "table": [
          {
            "key": "Üyelik kaydı, e-posta doğrulaması, oturum ve parola yönetimi",
            "value": "KVKK m.5/2-c: Bir sözleşmenin (üyelik sözleşmesi) kurulması veya ifasıyla doğrudan doğruya ilgili olması"
          },
          {
            "key": "Sipariş oluşturma, sözleşme onayı, teslimat, iade ve cayma süreçleri",
            "value": "KVKK m.5/2-c: Mesafeli satış sözleşmesinin kurulması ve ifası için gerekli olması"
          },
          {
            "key": "Ödemenin tahsili, 3D Secure doğrulaması, iade ve chargeback yönetimi",
            "value": "KVKK m.5/2-c sözleşmenin ifası; ayrıca 5464 ve 6493 sayılı Kanunlar ile ödeme mevzuatı bakımından KVKK m.5/2-ç: Veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi için zorunlu olması"
          },
          {
            "key": "Fatura/fiş düzenlenmesi, muhasebe ve vergi kayıtlarının tutulması",
            "value": "KVKK m.5/2-a: Kanunlarda açıkça öngörülmesi ve KVKK m.5/2-ç: Hukuki yükümlülüğün yerine getirilmesi (213 sayılı Vergi Usul Kanunu, 6102 sayılı Türk Ticaret Kanunu)"
          },
          {
            "key": "Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'nin sunulması ve onay kaydının tutulması",
            "value": "KVKK m.5/2-a ve m.5/2-ç: 6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği'nin öngördüğü bilgilendirme ve ispat yükümlülüğü"
          },
          {
            "key": "Tüketici şikâyetlerinin yanıtlanması, hakem heyeti ve dava süreçleri",
            "value": "KVKK m.5/2-e: Bir hakkın tesisi, kullanılması veya korunması için veri işlemenin zorunlu olması"
          },
          {
            "key": "Gıda güvenliği bildirimleri, alerjen bilgilendirmesi ve ürün geri çağırma",
            "value": "KVKK m.5/2-a ve m.5/2-ç: 5996 sayılı Kanun ve Türk Gıda Kodeksi mevzuatı kapsamındaki yükümlülükler"
          },
          {
            "key": "Sahtecilik ve suistimalin önlenmesi, giriş denemelerinin sınırlanması, log ve olay kaydı tutulması",
            "value": "KVKK m.5/2-f: İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla veri sorumlusunun meşru menfaatleri için zorunlu olması; ayrıca KVKK m.12 kapsamındaki veri güvenliği yükümlülüğü"
          },
          {
            "key": "Zorunlu çerezler, oturum yönetimi ve sepetin korunması",
            "value": "KVKK m.5/2-c ve m.5/2-f: Hizmetin talep edilen şekilde sunulabilmesi ve altyapının güvenli çalışması"
          },
          {
            "key": "İsteğe bağlı analitik ve performans çerezleri",
            "value": "KVKK m.5/1: İlgili kişinin açık rızası (çerez tercih paneli üzerinden alınır ve her zaman geri alınabilir)"
          },
          {
            "key": "Ticari elektronik ileti (bülten, kampanya duyurusu) gönderimi",
            "value": "KVKK m.5/1 açık rıza ve 6563 sayılı Kanun kapsamında İYS'ye kaydedilen onay"
          },
          {
            "key": "Segmentasyon ve kişiselleştirilmiş kampanya sunumu",
            "value": "KVKK m.5/1: Açık rıza"
          },
          {
            "key": "Kafe ve depo alanlarında kapalı devre kamera kaydı",
            "value": "KVKK m.5/2-f: Can ve mal güvenliğinin sağlanmasına yönelik meşru menfaat (giriş noktalarında bildirim levhasıyla ayrıca aydınlatma yapılır)"
          },
          {
            "key": "Tedarikçi ve iş ortağı yetkililerinin verilerinin işlenmesi",
            "value": "KVKK m.5/2-c sözleşmenin kurulması ve ifası, m.5/2-ç mali mevzuattan doğan yükümlülükler ve m.5/2-f meşru menfaat"
          },
          {
            "key": "Çalışan adayı başvurularının değerlendirilmesi",
            "value": "KVKK m.5/2-c: İş sözleşmesinin kurulmasına yönelik görüşme sürecinin yürütülmesi; başvurunun havuzda saklanması için KVKK m.5/1 açık rıza"
          },
          {
            "key": "Resmî kurum ve yargı mercii taleplerinin karşılanması",
            "value": "KVKK m.5/2-a ve m.5/2-ç: Kanunlarda açıkça öngörülmesi ve hukuki yükümlülük"
          }
        ]
      },
      {
        "heading": "9. Açık Rızaya Dayalı İşleme ve Rızanın Geri Alınması",
        "paragraphs": [
          "Açık rıza, belirli bir konuya ilişkin, bilgilendirmeye dayanan ve özgür iradeyle açıklanan onaydır. Bu nedenle rızanız; genel nitelikte, önceden işaretlenmiş kutucuklarla veya sözleşmenin kurulmasının ön şartı hâline getirilerek alınmaz. Ticari elektronik ileti onayı vermemeniz, üyelik oluşturmanıza veya sipariş vermenize engel değildir.",
          "Açık rızaya dayanan işleme faaliyetlerimiz sınırlıdır ve aşağıda sayılmıştır. Bunların dışındaki faaliyetler, bu metnin ilgili maddesinde gösterilen ve açık rıza dışındaki hukuki sebeplere dayanır.",
          "Açık rızanızı dilediğiniz zaman, gerekçe göstermeksizin ve ücretsiz olarak geri alabilirsiniz. Geri alma talebi geleceğe etkilidir; geri alma anına kadar hukuka uygun olarak gerçekleştirilmiş işlemleri geçersiz kılmaz. Rızanın geri alınmasından sonra, veriye ilişkin başka bir hukuki sebep (örneğin mali mevzuattan doğan saklama yükümlülüğü) bulunmuyorsa veri, saklama ve imha politikamızdaki periyot içinde imha edilir."
        ],
        "bullets": [
          "Ticari elektronik ileti (e-posta bülteni ve varsa SMS) gönderimi; onay İYS'ye kaydedilir ve buradan da yönetilebilir.",
          "Zorunlu olmayan analitik, performans ve tercih çerezleri ile benzeri teknolojilerin kullanılması.",
          "Alışveriş geçmişine dayalı segmentasyon ve kişiselleştirilmiş kampanya önerileri.",
          "Değerlendirme sonuçlanmış olsa dahi çalışan adayı başvurusunun ileride açılacak pozisyonlar için aday havuzunda saklanması.",
          "Tarafınızca gönderilen ve kimliğinizi tanınabilir kılan görsel/işitsel içeriğin (örneğin ürün fotoğrafı veya video) sosyal medya hesaplarımızda paylaşılması.",
          "Rızanın geri alınması: {{EMAIL}} adresine talep göndererek, bültenlerin altındaki abonelikten çık bağlantısını kullanarak, üyelik hesabınızın iletişim tercihleri bölümünden veya çerez tercih panelinden."
        ]
      },
      {
        "heading": "10. Kişisel Verilerin Toplanma Yöntemleri",
        "paragraphs": [
          "Kişisel verileriniz, Kanun'un 5. ve 6. maddelerinde belirtilen işleme şartlarına dayanılarak, tamamen veya kısmen otomatik yollarla ya da bir veri kayıt sisteminin parçası olmak kaydıyla otomatik olmayan yollarla aşağıdaki kanallardan toplanır."
        ],
        "bullets": [
          "Elektronik formlar: {{SITE_URL}} üzerindeki üyelik, giriş, parola sıfırlama, sepet, ödeme, iletişim, iade/cayma ve bülten abonelik formları.",
          "Otomatik altyapı kayıtları: Sunucu ve uygulama log kayıtları, güvenlik ve hata kayıtları, oturum bilgileri, yönetici işlemlerine ilişkin olay kaydı.",
          "Çerezler ve benzeri teknolojiler: Tarayıcınıza yerleştirilen çerezler, yerel depolama (sepetin cihazınızda tutulması dahil) ve piksel/etiket teknolojileri.",
          "Ödeme altyapısı: Banka veya ödeme kuruluşundan dönen işlem sonucu, referans numarası ve maskeli kart bilgisi; 3D Secure doğrulama sonucu.",
          "Kargo ve teslimat kanalları: Kargo firmasından ve motokurye hizmet sağlayıcısından dönen gönderi durumu ve teslim kayıtları.",
          "Yazılı ve sözlü iletişim: {{EMAIL}} adresine gönderilen e-postalar, {{PHONE}} numarası üzerinden yapılan görüşmeler, {{ADDRESS}} adresine yapılan yazılı başvurular.",
          "Sosyal medya kanalları: {{IG}}, {{TIKTOK}} ve {{YOUTUBE}} hesapları üzerinden gönderdiğiniz mesaj ve yorumlar. Bu platformların kendi veri işleme faaliyetleri, ilgili platformun kendi politikalarına tabidir.",
          "Fiziki kanallar: Kafede doldurulan rezervasyon/etkinlik formları, kafe içi satış belgeleri, giriş noktalarında bildirim levhası bulunan alanlardaki kapalı devre kamera sistemi.",
          "Üçüncü kişilerden dolaylı toplama: Hediye/başkasına gönderim siparişlerinde alıcının ad, adres ve telefon bilgisi sipariş veren tarafından iletilir. Bu hâlde sipariş veren, alıcıyı bu metin hakkında bilgilendirmekle yükümlüdür; tarafımız, teslimatın gerektirdiği asgari veriyi işler."
        ]
      },
      {
        "heading": "11. Çerezler ve Benzeri Teknolojiler",
        "paragraphs": [
          "İnternet sitemizde, hizmetin sunulabilmesi ve deneyimin iyileştirilmesi amacıyla çerezler ve benzeri teknolojiler kullanılır. Çerezler işlevlerine göre ayrıştırılır ve zorunlu olmayan çerezler yalnızca açık rızanızla çalıştırılır.",
          "Çerez tercihlerinizi, siteye ilk girişte sunulan tercih paneli üzerinden veya daha sonra dilediğiniz zaman aynı panelden değiştirebilirsiniz. Tarayıcı ayarlarınızdan çerezleri silmeniz veya engellemeniz de mümkündür; ancak zorunlu çerezlerin engellenmesi hâlinde oturum açma, sepet ve ödeme gibi temel işlevler çalışmayabilir."
        ],
        "bullets": [
          "Zorunlu (teknik) çerezler: Oturum kimliği, güvenlik doğrulaması, yük dengeleme ve sepetin korunması için gereklidir. Hukuki sebebi sözleşmenin ifası ve meşru menfaattir; açık rıza aranmaz.",
          "Tercih çerezleri: Dil, görünüm ve daha önce yapılmış seçimlerin hatırlanmasını sağlar. Açık rızaya tabidir.",
          "Analitik/performans çerezleri: Sayfa görüntüleme, gezinme akışı ve hata oranlarının ölçülmesini sağlar; mümkün olduğunca toplulaştırılmış biçimde kullanılır. Açık rızaya tabidir.",
          "Pazarlama çerezleri: Kampanya etkinliğinin ölçülmesi ve ilgi alanına göre içerik sunulması amacıyla kullanılabilir. Yalnızca açık rızanızla çalıştırılır; rıza verilmediğinde yerleştirilmez.",
          "Yerel depolama: Sepet içeriği tarayıcınızın yerel depolama alanında tutulabilir. Bu veri cihazınızda kalır; siparişi tamamlamadığınız sürece sunucularımıza taşınmaz."
        ]
      },
      {
        "heading": "12. Kişisel Verilerin Aktarılması",
        "paragraphs": [
          "Kişisel verileriniz, Kanun'un 8. maddesinde öngörülen şartlar çerçevesinde ve yalnızca aşağıda gösterilen amaçlarla sınırlı olarak aktarılır. Aktarım her hâlde ölçülülük ilkesine uygun yapılır; alıcıya, amacın gerektirdiğinden fazla veri iletilmez. Kişisel verileriniz hiçbir koşulda satılmaz, kiralanmaz veya bu metinde gösterilmeyen bir amaçla üçüncü kişilerin serbest kullanımına açılmaz.",
          "Veri işleyen sıfatıyla hizmet aldığımız tedarikçilerle, Kanun'un 12. maddesi uyarınca veri işleme sözleşmeleri akdedilir; bu sözleşmelerde gizlilik, amaçla sınırlı işleme, alt işleyen kullanımının denetimi, güvenlik tedbirleri ve ihlal bildirimi yükümlülükleri düzenlenir."
        ],
        "table": [
          {
            "key": "Bankalar ve ödeme kuruluşları (sanal POS sağlayıcısı)",
            "value": "Ödemenin tahsili, 3D Secure doğrulaması, provizyon, iade ve chargeback süreçlerinin yürütülmesi. Hukuki sebep: KVKK m.5/2-c sözleşmenin ifası ve m.5/2-ç hukuki yükümlülük. Aktarılan veri: ad-soyad, iletişim bilgisi, sipariş ve tutar bilgisi."
          },
          {
            "key": "Kargo ve kurye firmaları (Türkiye geneli Yurtiçi Kargo, KKTC/yurt dışı Aras Kargo, İstanbul içi motokurye)",
            "value": "Ürünün teslim edilmesi, gönderi takibi ve teslimat sorunlarının çözülmesi. Hukuki sebep: KVKK m.5/2-c. Aktarılan veri: alıcı adı, teslimat adresi, telefon numarası, gönderi içerik/ağırlık bilgisi."
          },
          {
            "key": "Barındırma ve altyapı sağlayıcıları (Vercel - uygulama barındırma, Supabase/PostgreSQL - veri tabanı)",
            "value": "İnternet sitesinin ve veri tabanının çalıştırılması, yedeklenmesi ve güvenliğinin sağlanması. Hukuki sebep: KVKK m.5/2-c ve m.5/2-f. Veri tabanında satır düzeyi güvenlik (RLS) etkindir."
          },
          {
            "key": "İşlemsel e-posta sağlayıcısı (Resend)",
            "value": "Üyelik doğrulama, parola sıfırlama, sipariş onayı, kargo bilgilendirmesi ve iade bildirimlerinin iletilmesi. Hukuki sebep: KVKK m.5/2-c. Aktarılan veri: ad, e-posta adresi, ileti içeriği."
          },
          {
            "key": "Muhasebe, mali müşavirlik ve e-fatura/e-arşiv hizmet sağlayıcıları",
            "value": "Fatura ve fiş düzenlenmesi, defter ve beyan süreçleri. Hukuki sebep: KVKK m.5/2-a ve m.5/2-ç (213 sayılı Vergi Usul Kanunu, 6102 sayılı Türk Ticaret Kanunu)."
          },
          {
            "key": "Hukuk, denetim ve danışmanlık hizmeti alınan kişi ve kuruluşlar",
            "value": "Uyuşmazlıkların takibi, hukuki görüş alınması, uyum denetimlerinin yürütülmesi. Hukuki sebep: KVKK m.5/2-e hakkın tesisi ve korunması, m.5/2-f meşru menfaat."
          },
          {
            "key": "Yetkili kamu kurum ve kuruluşları ile yargı mercileri",
            "value": "Kanunlarda öngörülen bilgi ve belge taleplerinin karşılanması, tüketici hakem heyeti ve mahkeme süreçleri, denetim faaliyetleri. Hukuki sebep: KVKK m.5/2-a ve m.5/2-ç."
          },
          {
            "key": "İleti Yönetim Sistemi (İYS)",
            "value": "6563 sayılı Kanun uyarınca ticari elektronik ileti onaylarının kaydı, sorgulanması ve ret bildirimlerinin işlenmesi. Hukuki sebep: KVKK m.5/2-a ve m.5/2-ç."
          },
          {
            "key": "Gıda güvenliği kapsamında ilgili merciler ve tedarikçiler",
            "value": "Parti bazlı geri çağırma, tüketici uyarısı ve şikâyetin kaynağının araştırılması. Hukuki sebep: KVKK m.5/2-a ve m.5/2-ç (5996 sayılı Kanun ve Türk Gıda Kodeksi mevzuatı)."
          },
          {
            "key": "Sosyal medya platformları",
            "value": "Yalnızca sizin ilettiğiniz mesajların yanıtlanması ve açık rızanız hâlinde paylaştığınız içeriğin yayımlanması. Bu platformlarda gerçekleşen işleme faaliyetleri platformların kendi politikalarına tabidir."
          }
        ]
      },
      {
        "heading": "13. Kişisel Verilerin Yurt Dışına Aktarılması",
        "paragraphs": [
          "Hizmet altyapımızın bir kısmı (uygulama barındırma, veri tabanı, işlemsel e-posta gönderimi ve içerik dağıtım ağı) yurt dışında yerleşik hizmet sağlayıcılar tarafından sunulmaktadır. Bu nedenle kişisel verileriniz, teknik olarak yurt dışındaki sunucularda işlenebilir veya yurt dışına aktarılabilir.",
          "Yurt dışına aktarım, Kanun'un 9. maddesinde ve Yurt Dışına Kişisel Veri Aktarımı Hakkında Yönetmelik'te öngörülen sıralı mekanizmalara uygun olarak yapılır. Öncelikle aktarımın yapılacağı ülke, sektör veya uluslararası kuruluş hakkında Kurul tarafından verilmiş bir yeterlilik kararı bulunup bulunmadığı değerlendirilir. Yeterlilik kararının bulunmadığı hâllerde, aktarım Kanun'da sayılan uygun güvencelerden birinin sağlanması koşuluyla gerçekleştirilir.",
          "Uygun güvenceler kapsamında, Kurul tarafından ilan edilen standart sözleşme metni imzalanır ve söz konusu sözleşme, mevzuatta öngörülen süre içinde Kuruma bildirilir; şirketler topluluğu bakımından bağlayıcı şirket kuralları veya yazılı taahhütname yolları da mevzuatın izin verdiği ölçüde kullanılabilir. Yeterlilik kararı ve uygun güvencelerin bulunmadığı hâllerde aktarım, yalnızca Kanun'un 9. maddesinde sayılan arızi hâllerin varlığı hâlinde ve bu hâllerle sınırlı olarak yapılır; bu kapsamda açık rızaya dayalı aktarım, ilgili kişinin aktarımın olası risklerine ilişkin ayrıca bilgilendirilmesi üzerine alınan açık rızaya dayanır.",
          "Yurt dışına aktarım her hâlde asgari veri ilkesiyle yürütülür: barındırma ve e-posta altyapısı için ilgili sağlayıcıya yalnızca hizmetin sunulması için gereken veriler iletilir; ödeme kartı verileri tarafımızca aktarılmaz, doğrudan PCI-DSS uyumlu ödeme kuruluşunun altyapısında işlenir."
        ],
        "bullets": [
          "Aktarım gerekçeleri: Uygulama barındırma ve dağıtımı, veri tabanı hizmeti ve yedekleme, işlemsel e-posta gönderimi, hata ve performans izleme.",
          "Aktarılan veri kategorileri: Kimlik, iletişim, müşteri işlem, hesap/güvenlik ve işlem güvenliği verileri; ödeme kartının tam numarası ve güvenlik kodu hiçbir hâlde aktarılmaz.",
          "Güvence yöntemleri: Kurul yeterlilik kararı; yoksa standart sözleşme, bağlayıcı şirket kuralları veya taahhütname; bunların da bulunmadığı hâllerde Kanun'da sayılan arızi hâller.",
          "Ek teknik tedbirler: Aktarımda ve saklamada şifreleme, erişim yetkilerinin asgari yetki ilkesine göre sınırlanması, sağlayıcılarla veri işleme sözleşmesi akdedilmesi.",
          "Bilgi talebi hakkı: Hangi verinizin hangi ülkeye ve hangi güvenceyle aktarıldığını {{EMAIL}} adresine başvurarak öğrenebilirsiniz."
        ]
      },
      {
        "heading": "14. Saklama Süreleri ve İmha",
        "paragraphs": [
          "Kişisel verileriniz, ilgili mevzuatta bir süre öngörülmüşse bu süre boyunca; öngörülmemişse işlendikleri amaç için gerekli olan süre kadar saklanır. Süre sona erdiğinde veya işlemenin dayanağı ortadan kalktığında veriler, Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik uyarınca resen ya da talebiniz üzerine silinir, yok edilir veya anonim hale getirilir.",
          "Periyodik imha, Yönetmelik'te öngörülen azami aralığı aşmayacak şekilde altı ayda bir gerçekleştirilir. İmha işlemleri kayıt altına alınır ve bu kayıtlar, Yönetmelik uyarınca ayrıca saklanır. Yedekleme ortamlarında bulunan veriler, teknik olarak anında silinemediği hâllerde erişime kapatılır ve ilk yedek döngüsünde imha edilir.",
          "Saklama süreleri, Kişisel Veri Saklama ve İmha Politikası'nda süreç bazında ayrıntılı olarak gösterilmiştir. Başlıca süreler aşağıdaki gibidir."
        ],
        "table": [
          {
            "key": "Üyelik hesabı ve hesap güvenliği verileri",
            "value": "Üyelik devam ettiği sürece; hesabın kapatılması hâlinde, hukuki uyuşmazlık ihtimaline karşı Türk Borçlar Kanunu'ndaki genel zamanaşımı süresi boyunca sınırlı erişimle saklanır ve ardından imha edilir."
          },
          {
            "key": "Sipariş, sözleşme ve teslimat kayıtları",
            "value": "Sözleşmenin sona ermesinden itibaren Türk Borçlar Kanunu'ndaki genel zamanaşımı süresi boyunca; tüketici uyuşmazlığı doğması hâlinde süreç kesinleşene kadar."
          },
          {
            "key": "Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi onay kayıtları (tarih, IP, tarayıcı, belge sürümü)",
            "value": "İspat yükümlülüğü nedeniyle sipariş kayıtlarıyla aynı süre boyunca."
          },
          {
            "key": "Fatura, fiş ve muhasebe kayıtları",
            "value": "213 sayılı Vergi Usul Kanunu ve 6102 sayılı Türk Ticaret Kanunu'nda öngörülen defter ve belge saklama süreleri boyunca."
          },
          {
            "key": "Ödeme işlem kayıtları (maskeli kart bilgisi, işlem referansı, iade/chargeback)",
            "value": "Mali mevzuattaki saklama süresi ve ters ibraz itiraz süreleri dikkate alınarak; ödeme kuruluşu nezdindeki kayıtlar ilgili kuruluşun mevzuatına tabidir."
          },
          {
            "key": "Ticari elektronik ileti onay ve ret kayıtları",
            "value": "6563 sayılı Kanun ve Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik uyarınca onayın geri alınmasından itibaren mevzuatta öngörülen süre boyunca; ret kayıtları ise ispat amacıyla İYS üzerinde tutulur."
          },
          {
            "key": "Müşteri hizmetleri yazışmaları ve şikâyet kayıtları",
            "value": "Talebin sonuçlanmasından itibaren, ilgili tüketici uyuşmazlığına ilişkin zamanaşımı süresi boyunca."
          },
          {
            "key": "Çerez ve site kullanım kayıtları",
            "value": "Çerez türüne göre oturum sonuna kadar veya tercih panelinde belirtilen süre kadar; analitik veriler mümkün olan hâllerde toplulaştırılır veya anonim hale getirilir."
          },
          {
            "key": "Sunucu, uygulama ve güvenlik log kayıtları",
            "value": "Bilgi güvenliği amacıyla ve 5651 sayılı Kanun kapsamındaki yükümlülükler dikkate alınarak, güvenlik olaylarının incelenmesi için gerekli süre boyunca."
          },
          {
            "key": "Yönetici olay kaydı (audit log)",
            "value": "Değiştirilemez biçimde tutulur; hesap verebilirlik ve delil amacıyla ticari kayıtlarla aynı süre boyunca saklanır."
          },
          {
            "key": "Kapalı devre kamera görüntüleri",
            "value": "Kayıt tarihinden itibaren en fazla 30 gün; bu süre içinde bir olaya ilişkin inceleme veya resmî talep bulunması hâlinde ilgili kayıt, süreç sonuçlanana kadar ayrıca muhafaza edilir."
          },
          {
            "key": "Çalışan adayı başvuruları",
            "value": "Değerlendirme sürecinin sonuçlanmasından itibaren en fazla 1 yıl; açık rıza verilmişse aday havuzunda rızanın geri alınmasına kadar, aksi hâlde imha edilir."
          },
          {
            "key": "Tedarikçi ve iş ortağı kayıtları",
            "value": "Sözleşme ilişkisi süresince ve sona ermesinden itibaren mali mevzuat ile zamanaşımı sürelerinin uzun olanı boyunca."
          }
        ]
      },
      {
        "heading": "15. Özel Nitelikli Kişisel Veriler ve Alerjen Bildirimleri",
        "paragraphs": [
          "Faaliyetlerimiz kapsamında, kural olarak Kanun'un 6. maddesinde sayılan özel nitelikli kişisel veriler işlenmez. Üyelik, sipariş, ödeme, teslimat ve destek süreçlerinde sağlık, din, etnik köken, biyometrik veri gibi özel nitelikli veri talep edilmez; formlarımızda bu verilere ilişkin zorunlu alan bulunmaz.",
          "Bununla birlikte, gıda ürünü satan ve kafe işleten bir işletme olarak alerjen bilgisi hassas bir konudur. Ürün sayfalarımızda ve menümüzde alerjen bilgilendirmesi, Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği uyarınca ürün bazında yapılır; bu bilgilendirme, kişiye özgü bir veri işleme faaliyeti değildir.",
          "Sipariş notunda veya kafede sözlü olarak kendi inisiyatifinizle bir alerji ya da diyet kısıtı bildirmeniz hâlinde, bu beyan sağlık verisi niteliği taşıyabilir. Böyle bir bildirimi, yalnızca ilgili siparişin hazırlanması ve size doğru ürünün sunulması amacıyla, Kanun'un 6. maddesi kapsamında açık rızanıza dayanarak işleriz. Bu veri, siparişi hazırlayan asgari sayıda yetkiliyle sınırlı olarak görülür, pazarlama amacıyla kullanılmaz, profilleme girdisi yapılmaz ve siparişin tamamlanmasının ardından sipariş notundan silinir veya anonimleştirilir.",
          "Alerji bilgisini paylaşmak istemiyorsanız, sipariş öncesinde {{EMAIL}} veya {{PHONE}} üzerinden ürün içeriğini sorabilir ve kararınızı bu bilgiye göre verebilirsiniz. Üretim alanlarımızda çapraz bulaşma riski bulunduğundan, ciddi alerjisi olan tüketicilerimizin ürünü tüketmeden önce mutlaka bilgi almasını öneririz.",
          "Özgeçmişinizde veya bize gönderdiğiniz belgelerde talep edilmediği hâlde yer alan özel nitelikli veriler (sağlık raporu, adli sicil bilgisi, fotoğraf gibi) değerlendirmeye alınmaz; tespit edildiğinde ilk imha periyodunda silinir."
        ]
      },
      {
        "heading": "16. Çocukların Kişisel Verileri",
        "paragraphs": [
          "{{SITE_URL}} üzerinden sunulan üyelik ve alışveriş hizmetleri, fiil ehliyetine sahip kişilere yöneliktir. Onsekiz yaşından küçük kişilerin kendi adlarına üyelik oluşturması ve sipariş vermesi öngörülmemiştir; sipariş süreçlerinde ödeme, kendi adına kart kullanma yetkisine sahip kişiler tarafından gerçekleştirilir.",
          "Bir çocuğa ait kişisel verinin, veli veya vasinin onayı olmaksızın tarafımıza iletildiğini öğrendiğimizde, söz konusu veri gecikmeksizin ve saklama yükümlülüğü bulunmadığı sürece imha edilir. Bu yöndeki bildirimlerinizi {{EMAIL}} adresine iletebilirsiniz.",
          "Kafe içi etkinliklerimizde çocuklara ilişkin görüntü alınması gerekiyorsa, bu yalnızca veli veya vasinin ayrıca alınmış açık rızasıyla ve rızanın kapsamıyla sınırlı olarak yapılır."
        ]
      },
      {
        "heading": "17. Veri Güvenliğine İlişkin Alınan Tedbirler",
        "paragraphs": [
          "Kanun'un 12. maddesi uyarınca, kişisel verilerin hukuka aykırı olarak işlenmesini ve verilere hukuka aykırı erişilmesini önlemek ile verilerin muhafazasını sağlamak amacıyla uygun güvenlik düzeyini temin etmeye yönelik idari ve teknik tedbirler alınmaktadır. Alınan başlıca tedbirler aşağıda gösterilmiştir.",
          "Kişisel verilerin kanuni olmayan yollarla başkaları tarafından elde edildiğinin tespit edilmesi hâlinde, durum en kısa sürede ilgili kişiye ve Kurul'a bildirilir; bu kapsamda Kurul'un veri ihlali bildirimine ilişkin usul ve süreleri esas alınır."
        ],
        "bullets": [
          "Teknik: Tüm trafiğin TLS ile şifrelenmesi; veri tabanında satır düzeyi güvenlik (RLS) politikalarının etkin olması ve ayrıcalıklı anahtarların yalnızca sunucu tarafında tutulması.",
          "Teknik: Kullanıcı parolalarının bcrypt algoritmasıyla özetlenerek saklanması; parolaların açık metin olarak hiçbir aşamada kaydedilmemesi veya e-posta ile gönderilmemesi.",
          "Teknik: Yönetim paneline erişimin zaman tabanlı tek kullanımlık kod (TOTP) ile iki aşamalı doğrulamaya tabi tutulması; oturum çerezlerinin imzalanması, httpOnly ve sınırlı ömürle kullanılması.",
          "Teknik: Giriş denemelerine hız sınırlaması ve geçici kilitleme uygulanması; şüpheli erişim girişimlerinin loglanması ve incelenmesi.",
          "Teknik: Tüm yönetici mutasyonlarının değiştirilemez olay kaydına (audit log) yazılması; kim, ne zaman, hangi kaydı değiştirdi bilgisinin izlenebilir olması.",
          "Teknik: Ödeme kartı verilerinin sistemlerimize hiç girmemesi; ödemenin PCI-DSS uyumlu ödeme kuruluşu altyapısında ve 3D Secure doğrulamasıyla gerçekleştirilmesi.",
          "Teknik: Düzenli yedekleme, yedeklerin şifreli tutulması, güncelleme ve yama yönetimi, bağımlılık güvenlik taramaları.",
          "İdari: Erişimlerin görev tanımıyla sınırlı (asgari yetki) verilmesi, yetki envanterinin periyodik gözden geçirilmesi ve görevden ayrılmada erişimin derhâl kaldırılması.",
          "İdari: Kişisel veriye erişen personel ve hizmet sağlayıcılarla gizlilik taahhütnamesi ve veri işleme sözleşmesi akdedilmesi.",
          "İdari: Kişisel veri işleme envanteri ile Kişisel Veri Saklama ve İmha Politikası'nın tutulması ve güncel tutulması.",
          "İdari: Personelin kişisel verilerin korunması ve bilgi güvenliği konusunda düzenli olarak bilgilendirilmesi; veri ihlali müdahale sürecinin tanımlı olması.",
          "İdari: Yeni bir işleme faaliyeti veya yeni bir hizmet sağlayıcı devreye alınmadan önce veri koruma açısından değerlendirme yapılması."
        ]
      },
      {
        "heading": "18. Ticari Elektronik İletiler ve İYS",
        "paragraphs": [
          "Kampanya, indirim, yeni ürün ve etkinlik duyurularını içeren ticari elektronik iletiler, 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik uyarınca yalnızca önceden onayınız alınarak gönderilir. Onaylar İleti Yönetim Sistemi'ne (İYS) kaydedilir ve gönderim öncesinde İYS üzerinden doğrulanır.",
          "Sipariş onayı, ödeme bildirimi, kargo takibi, iade bilgilendirmesi, parola sıfırlama ve sözleşmesel değişiklik duyuruları gibi işlemsel bildirimler ticari elektronik ileti niteliğinde değildir; bunlar sözleşmenin ifası kapsamında, ayrı bir pazarlama onayına bağlı olmaksızın gönderilir ve bu bildirimlerden çıkmak mümkün değildir.",
          "Ticari elektronik ileti almayı dilediğiniz zaman ve ücretsiz olarak reddedebilirsiniz. Ret hakkınızı, iletinin içindeki bağlantı üzerinden, İYS üzerinden veya {{EMAIL}} adresine talep göndererek kullanabilirsiniz. Ret bildiriminiz, mevzuatta öngörülen süre içinde işleme alınır ve bu tarihten sonra tarafınıza ticari elektronik ileti gönderilmez."
        ]
      },
      {
        "heading": "19. Otomatik Sistemlerle Analiz ve Profilleme",
        "paragraphs": [
          "Hakkınızda, münhasıran otomatik sistemler vasıtasıyla analiz edilmek suretiyle aleyhinize hukuki sonuç doğuran veya sizi benzer şekilde önemli ölçüde etkileyen bir karar alınmaz. Üyelik başvurusunun kabulü, siparişin onayı veya iade talebinin sonuçlandırılması gibi kararlar insan değerlendirmesini içerir.",
          "Ödeme adımında, ödeme kuruluşu ve banka tarafından işletilen dolandırıcılık önleme (fraud) kontrolleri uygulanabilir; bu kontroller sonucunda bir işlem reddedilirse, işlemin neden reddedildiğine ilişkin bilgi ilgili kuruluşun kuralları çerçevesinde sınırlı olabilir. Böyle bir hâlde {{EMAIL}} adresine başvurarak konunun insan müdahalesiyle yeniden değerlendirilmesini talep edebilirsiniz.",
          "Açık rızanıza dayalı segmentasyon yapıldığında bu, yalnızca hangi kampanya içeriğini göreceğinizi etkiler; ürün fiyatları, kargo ücretleri veya iade hakkınız segmentasyona göre farklılaştırılmaz.",
          "Kanun'un 11. maddesi uyarınca, işlenen verilerin münhasıran otomatik sistemlerle analiz edilmesi suretiyle aleyhinize bir sonuç ortaya çıkması hâlinde buna itiraz etme hakkınız saklıdır."
        ]
      },
      {
        "heading": "20. İlgili Kişinin Hakları (KVKK m.11)",
        "paragraphs": [
          "Kanun'un 11. maddesi uyarınca, veri sorumlusu sıfatıyla {{SHORT_NAME}}'ye başvurarak aşağıdaki haklarınızı kullanabilirsiniz."
        ],
        "ordered": [
          "Kişisel verilerinizin işlenip işlenmediğini öğrenme.",
          "Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme.",
          "Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme.",
          "Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme.",
          "Kişisel verilerinizin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme.",
          "Kanun'un 7. maddesinde öngörülen şartlar çerçevesinde kişisel verilerinizin silinmesini veya yok edilmesini isteme.",
          "Düzeltme, silme ve yok etme talepleriniz uyarınca yapılan işlemlerin, kişisel verilerinizin aktarıldığı üçüncü kişilere bildirilmesini isteme.",
          "İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme.",
          "Kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme."
        ],
        "bullets": [
          "Bu hakların kullanılması, açık rızanızı geri alma hakkınızı ve ticari elektronik iletileri reddetme hakkınızı ortadan kaldırmaz; bunlar ayrıca ve her zaman kullanılabilir.",
          "Silme veya yok etme talebiniz, mali mevzuat veya zamanaşımı gibi bir saklama yükümlülüğü nedeniyle tamamen karşılanamıyorsa, hangi verinin hangi hukuki sebeple ve ne kadar süreyle saklanmaya devam edeceği gerekçesiyle birlikte tarafınıza bildirilir; bu veriler erişimi kısıtlanmış şekilde muhafaza edilir.",
          "Talebiniz üzerine yapılan işlemlerin sonucu, başvurunuzda belirttiğiniz yönteme uygun olarak yazılı veya elektronik ortamda tarafınıza iletilir."
        ]
      },
      {
        "heading": "21. Başvuru Yöntemi, Süreler ve Ücret",
        "paragraphs": [
          "Kanun'un 13. maddesi ile Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca haklarınıza ilişkin taleplerinizi aşağıdaki yöntemlerden biriyle iletebilirsiniz. Başvurunuzun Türkçe olması ve kimliğinizi tespite yarayan bilgileri içermesi gerekir.",
          "Başvurunuzda; ad, soyad ve başvuru yazılı ise imza, T.C. kimlik numarası (yabancılar için uyruk, pasaport numarası veya varsa kimlik numarası), tebligata esas yerleşim yeri veya iş yeri adresi, varsa bildirime esas elektronik posta adresi, telefon ve faks numarası ile talep konusunun bulunması zorunludur. Talebinize ilişkin bilgi ve belgeleri de eklemeniz, sürecin hızlanmasını sağlar.",
          "Başvurularınız, talebin niteliğine göre en kısa sürede ve her hâlde başvurunun tarafımıza ulaştığı tarihten itibaren en geç otuz gün içinde sonuçlandırılır. Bu süre, ek bilgi veya belge talep edilmesi hâlinde talebin karşılanmasıyla yeniden işlemeye başlayabilir. Kimliğinizin doğrulanamaması hâlinde, verilerin yetkisiz kişilerle paylaşılmaması amacıyla ek bilgi talep edilir.",
          "Başvurunuz kural olarak ücretsiz sonuçlandırılır. Ancak işlemin ayrıca bir maliyet gerektirmesi hâlinde, Kurulca belirlenen tarifedeki ücret talep edilebilir. Talebiniz tarafımız hatasından kaynaklanıyorsa, alınan ücret iade edilir.",
          "Başvurularınızı üçüncü bir kişi aracılığıyla yapmak istiyorsanız, özel yetkiyi içeren noter onaylı vekâletname sunulması gerekir. Genel vekâletnameler bu kapsamda yeterli kabul edilmez."
        ],
        "table": [
          {
            "key": "Yazılı başvuru (ıslak imzalı)",
            "value": "Şahsen veya noter aracılığıyla: {{ADDRESS}} - zarfın üzerine \"Kişisel Verilerin Korunması Kanunu Kapsamında Bilgi Talebi\" ibaresi yazılmalıdır."
          },
          {
            "key": "Kayıtlı elektronik posta (KEP)",
            "value": "{{KEP}}"
          },
          {
            "key": "Güvenli elektronik imza veya mobil imza ile",
            "value": "İmzalı başvuru dosyası {{EMAIL}} adresine gönderilebilir; e-postanın konu satırına \"KVKK Bilgi Talebi\" yazılmalıdır."
          },
          {
            "key": "Sistemimizde kayıtlı e-posta adresinizden",
            "value": "Daha önce tarafımıza bildirdiğiniz ve sistemimizde kayıtlı bulunan e-posta adresinizden {{EMAIL}} adresine gönderim."
          },
          {
            "key": "Telefon (yalnızca yönlendirme ve bilgilendirme)",
            "value": "{{PHONE}} - telefonla yapılan görüşme resmî başvuru yerine geçmez; talebiniz yazılı kanallardan biriyle iletilmelidir."
          },
          {
            "key": "Yanıt süresi",
            "value": "En kısa sürede ve her hâlde en geç otuz gün."
          },
          {
            "key": "Başvuru formu",
            "value": "{{SITE_URL}} adresindeki Veri Sahibi Başvuru Formu doldurularak kullanılabilir; formun kullanılması zorunlu değildir."
          }
        ]
      },
      {
        "heading": "22. Kurul'a Şikâyet Hakkı ve Süreleri",
        "paragraphs": [
          "Kanun'un 14. maddesi uyarınca, tarafımıza yaptığınız başvurunun reddedilmesi, verdiğimiz cevabı yetersiz bulmanız veya süresinde başvurunuza cevap verilmemesi hâllerinde; cevabı öğrendiğiniz tarihten itibaren otuz ve her hâlde başvuru tarihinden itibaren altmış gün içinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz.",
          "Kanun'un 14. maddesi gereğince, veri sorumlusuna başvuru yolu tüketilmeden Kurul'a şikâyet yoluna başvurulamaz. Bu nedenle, öncelikle bu metnin başvuru maddesinde gösterilen kanallardan biriyle tarafımıza başvurmanızı rica ederiz.",
          "Kanun'un 15. maddesi uyarınca Kurul, şikâyet üzerine yapacağı inceleme sonucunu ilgili kişiye bildirir; şikâyet tarihinden itibaren altmış gün içinde cevap verilmediği takdirde talep reddedilmiş sayılır. Kurul, resen öğrendiği ihlal iddialarını da inceleyebilir.",
          "Kişilik hakları ihlal edilenlerin genel hükümlere göre tazminat hakkı ile Kanun kapsamındaki suçlara ilişkin şikâyet hakkınız saklıdır. Ayrıca, tüketici sıfatıyla satın aldığınız ürün ve hizmetlere ilişkin uyuşmazlıklar bakımından, her yıl Ticaret Bakanlığınca yeniden değerleme oranında güncellenen parasal sınırlar çerçevesinde tüketici hakem heyetlerine veya tüketici mahkemelerine başvurabilirsiniz."
        ]
      },
      {
        "heading": "23. Aydınlatma Metninin Güncellenmesi ve Yürürlük",
        "paragraphs": [
          "{{SHORT_NAME}}, mevzuat değişiklikleri, Kurul kararları, yeni hizmet ve süreçlerin devreye alınması ya da altyapı sağlayıcılarında yaşanan değişiklikler nedeniyle bu Aydınlatma Metni'ni güncelleme hakkını saklı tutar. Güncel metin her zaman {{SITE_URL}} adresinde yayımlanır ve metnin üzerinde sürüm ile son güncelleme tarihi gösterilir.",
          "Kapsamlı değişiklikler (yeni bir işleme amacı eklenmesi, yeni bir alıcı grubuna aktarım başlatılması, saklama sürelerinin uzatılması gibi) hâlinde, üyelerimize kayıtlı e-posta adresleri üzerinden ayrıca bilgilendirme yapılır. Açık rıza gerektiren yeni bir faaliyet söz konusuysa, mevcut rızalar bu faaliyeti kapsamaz; rızanız ayrıca ve yeniden alınır.",
          "Bu metin, bir sözleşme değil bilgilendirme belgesidir; Kanun'dan doğan haklarınızı sınırlandırmaz, bu haklardan feragat ettiğiniz anlamına gelmez ve tüketici mevzuatından doğan haklarınızı etkilemez. Metnin herhangi bir hükmünün emredici mevzuata aykırı olduğunun tespiti hâlinde, o hüküm yerine ilgili mevzuat hükmü uygulanır; metnin geri kalanı yürürlükte kalır.",
          "Aydınlatma metninin uygulanmasına ilişkin her türlü soru, görüş ve talebinizi {{EMAIL}} adresine iletebilir; {{PHONE}} numarasından bilgi alabilir veya {{ADDRESS}} adresine yazılı olarak başvurabilirsiniz."
        ]
      }
    ]
  },
  {
    "slug": "kvkk-basvuru-formu",
    "title": "Veri Sahibi Başvuru Formu",
    "shortTitle": "Başvuru Formu",
    "category": "Veri & Gizlilik",
    "summary": "6698 sayılı Kanun'un 11. maddesi ve Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca ilgili kişilerin {{SHORT_NAME}}'ye nasıl başvuracağını, başvuruda yer alması zorunlu bilgileri, yanıt süresini ve şikâyet yolunu açıklayan rehber ve formdur.",
    "references": [
      "6698 sayılı Kişisel Verilerin Korunması Kanunu (özellikle m.4 genel ilkeler, m.5-6 işleme şartları, m.9 yurt dışına aktarım, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliğine ilişkin yükümlülükler, m.13-15 başvuru ve şikâyet)",
      "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ",
      "Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik",
      "Veri Sorumluları Sicili Hakkında Yönetmelik",
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
      "Mesafeli Sözleşmeler Yönetmeliği (RG: 27.11.2014, 29188)",
      "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İleti Yönetim Sistemi - İYS)",
      "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik",
      "5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun",
      "5070 sayılı Elektronik İmza Kanunu",
      "213 sayılı Vergi Usul Kanunu",
      "6098 sayılı Türk Borçlar Kanunu",
      "6102 sayılı Türk Ticaret Kanunu",
      "5464 sayılı Banka Kartları ve Kredi Kartları Kanunu",
      "6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun",
      "4721 sayılı Türk Medeni Kanunu (velayet ve vesayet hükümleri)",
      "6100 sayılı Hukuk Muhakemeleri Kanunu"
    ],
    "sections": [
      {
        "heading": "1. Amaç ve Kapsam",
        "paragraphs": [
          "Bu form ve rehber, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun (Kanun) 11. maddesinde sayılan haklarını kullanmak isteyen ilgili kişilerin, veri sorumlusu sıfatıyla {{LEGAL_NAME}}'ye ({{SHORT_NAME}}) yapacakları başvurunun usul ve esaslarını açıklamak amacıyla hazırlanmıştır.",
          "Kanun'un 13. maddesi ile Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca ilgili kişiler, Kanun'un uygulanmasıyla ilgili taleplerini yazılı olarak veya Kişisel Verilerin Korunması Kurulu'nun (Kurul) belirlediği diğer yöntemlerle veri sorumlusuna iletebilir. Bu rehber söz konusu düzenlemelerin şirketimizdeki uygulamasını gösterir.",
          "Rehberin kapsamı, {{BRAND}} markası altında yürütülen tüm faaliyetlerde işlenen kişisel verileri kapsar: {{SITE_URL}} adresinde yayımlanan internet sitesi ve online mağaza (bottega) üzerinden gerçekleştirilen üyelik, sipariş, ödeme, kargo, iade ve destek süreçleri; {{ADDRESS}} adresindeki fiziki işletmede sunulan kafe ve gelato bar hizmetleri; {{HANDLE}} kullanıcı adıyla işletilen sosyal medya hesapları üzerinden kurulan iletişimler; ticari elektronik ileti ve pazarlama faaliyetleri ile ziyaretçi, aday çalışan, tedarikçi ve iş ortağı temsilcisi verilerinin işlendiği süreçler.",
          "Bu form zorunlu bir şablon değildir; ilgili kişi dilerse Tebliğ'de aranan asgari bilgileri içeren serbest metinli bir dilekçe ile de başvurabilir. Ancak formun kullanılması, talebin doğru sınıflandırılmasını ve daha hızlı sonuçlandırılmasını sağlar.",
          "Bu belge hukuki danışmanlık niteliği taşımaz; ilgili kişinin Kanun'dan doğan haklarını sınırlandırmaz ve mevzuatta öngörülen başvuru yollarını daraltmaz."
        ]
      },
      {
        "heading": "2. Veri Sorumlusunun Kimliği ve İletişim Bilgileri",
        "paragraphs": [
          "Kanun'un 10. maddesi ve Tebliğ uyarınca başvurunun yöneltileceği veri sorumlusuna ilişkin künye bilgileri aşağıdadır. Başvurunuzu bu bilgiler üzerinden iletmeniz, kaydın doğru birime düşmesini ve süre hesabının doğru başlatılmasını sağlar."
        ],
        "table": [
          {
            "key": "Veri sorumlusu ticaret unvanı",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Kısa unvan",
            "value": "{{SHORT_NAME}}"
          },
          {
            "key": "İşletilen marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Adres (tebligata esas)",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Vergi dairesi",
            "value": "{{TAX_OFFICE}}"
          },
          {
            "key": "Vergi kimlik numarası",
            "value": "{{TAX_NO}}"
          },
          {
            "key": "Vergi türü",
            "value": "{{TAX_TYPE}}"
          },
          {
            "key": "Faaliyet kodu (NACE)",
            "value": "{{NACE}}"
          },
          {
            "key": "Faaliyete başlama tarihi",
            "value": "{{STARTED_AT}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil numarası",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "Instagram",
            "value": "{{IG}}"
          },
          {
            "key": "TikTok",
            "value": "{{TIKTOK}}"
          },
          {
            "key": "YouTube",
            "value": "{{YOUTUBE}}"
          }
        ]
      },
      {
        "heading": "3. İlgili Kişinin Kanun'un 11. Maddesindeki Hakları",
        "paragraphs": [
          "Kanun'un 11. maddesi uyarınca ilgili kişi olarak {{SHORT_NAME}}'ye başvurarak aşağıdaki taleplerde bulunabilirsiniz. Formun talep bölümünde bu haklardan hangisini veya hangilerini kullanmak istediğinizi belirtmeniz beklenir."
        ],
        "ordered": [
          "Kişisel verilerinizin işlenip işlenmediğini öğrenme.",
          "Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme.",
          "Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme.",
          "Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme.",
          "Kişisel verilerinizin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme.",
          "Kanun'un 7. maddesinde öngörülen şartlar çerçevesinde kişisel verilerinizin silinmesini veya yok edilmesini isteme.",
          "Düzeltme, silme veya yok etme talebiniz üzerine yapılan işlemlerin, kişisel verilerinizin aktarıldığı üçüncü kişilere bildirilmesini isteme.",
          "İşlenen verilerinizin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme.",
          "Kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme."
        ]
      },
      {
        "heading": "4. Kimler Başvuruda Bulunabilir",
        "paragraphs": [
          "Kanun'un 11. maddesindeki haklar kişiye sıkı sıkıya bağlı haklardır ve kural olarak kişisel verisi işlenen gerçek kişi tarafından bizzat kullanılır. Aşağıdaki hâllerde başvuru, ilgili kişi adına üçüncü bir kişi tarafından da yapılabilir."
        ],
        "bullets": [
          "İlgili kişinin bizzat başvurusu: Kişisel verisi işlenen gerçek kişi, kimliğini tevsik eden belge veya sistemde kayıtlı iletişim kanalı üzerinden doğrudan başvurur. Bu, esas ve tercih edilen yoldur.",
          "Vekil aracılığıyla başvuru: Başvurunun avukat veya vekil aracılığıyla yapılması hâlinde, KVKK kapsamında başvuru yapma ve yanıt alma yetkisini açıkça içeren noter onaylı vekâletnamenin bir örneği başvuruya eklenmelidir. Vekâletnamede bu yetkiye yer verilmemişse başvuru, ilgili kişi tarafından teyit edilene kadar sonuçlandırılamaz.",
          "Veli veya vasi aracılığıyla başvuru: Çocuklar adına velayet hakkı sahibi ebeveyn, kısıtlılar adına ise mahkemece atanmış vasi başvurabilir. Bu durumda velayet ilişkisini gösteren nüfus kayıt örneği veya vesayet kararının bir örneği talep edilir.",
          "Temsilci sıfatıyla başvuru: Vekâlet, velayet veya vesayet ilişkisini gösteren belgenin sunulmaması hâlinde başvuru, kimlik ve yetki doğrulaması yapılamadığı gerekçesiyle sonuçsuz bırakılabilir; bu durum ilgili kişiye gerekçesiyle bildirilir.",
          "Ölen kişiye ait veriler: Vefat etmiş bir kişiye ait kişisel verilere ilişkin talepler, mevzuat ve Kurul kararları çerçevesinde sınırlı olarak değerlendirilir. Bu tür başvurularda mirasçılık belgesi (veraset ilamı) ve talebin dayandığı hukuki menfaatin açıklanması istenir.",
          "Tüzel kişi başvuruları: Kanun yalnızca gerçek kişilerin kişisel verilerini korur. Tüzel kişilere ait bilgilere ilişkin talepler bu form kapsamında değil, genel iletişim kanallarımız üzerinden değerlendirilir; ancak tüzel kişi yetkilisinin ad-soyad, e-posta ve telefon gibi verileri bu form kapsamındadır."
        ]
      },
      {
        "heading": "5. Başvuru Kanalları",
        "paragraphs": [
          "Tebliğ uyarınca başvurunuzu aşağıdaki kanallardan biriyle iletebilirsiniz. Her kanalda, başvurunun {{SHORT_NAME}}'ye ulaştığı tarih, otuz günlük yanıt süresinin başlangıcı olarak esas alınır.",
          "Başvurunuzun konusunun zarfın veya e-postanın üzerinde açıkça belirtilmesi (örneğin Kişisel Verilerin Korunması Kanunu Kapsamında Bilgi Talebi ibaresi) kaydın doğru yönlendirilmesini hızlandırır."
        ],
        "table": [
          {
            "key": "Islak imzalı yazılı başvuru",
            "value": "Formu doldurup imzaladıktan sonra kimlik teyidine imkân verecek şekilde şahsen elden veya noter aracılığıyla {{ADDRESS}} adresine iletebilirsiniz."
          },
          {
            "key": "Sistemde kayıtlı e-posta ile",
            "value": "Daha önce {{SHORT_NAME}} sistemine üyelik, sipariş veya iletişim yoluyla bildirdiğiniz ve tarafımızca doğrulanmış e-posta adresinizden {{EMAIL}} adresine gönderim yapabilirsiniz."
          },
          {
            "key": "Kayıtlı elektronik posta (KEP) ile",
            "value": "{{KEP}}"
          },
          {
            "key": "Güvenli elektronik imza ile",
            "value": "5070 sayılı Elektronik İmza Kanunu kapsamında güvenli elektronik imza ile imzalanmış belgeyi {{EMAIL}} adresine gönderebilirsiniz."
          },
          {
            "key": "Mobil imza ile",
            "value": "Mobil imza ile imzalanmış başvuru belgesini {{EMAIL}} adresine iletebilirsiniz."
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}} numarası yalnızca sürecin işleyişi hakkında bilgi almak içindir; telefonla yapılan bildirimler geçerli bir KVKK başvurusu sayılmaz."
          },
          {
            "key": "Sosyal medya mesajları",
            "value": "{{IG}} ve diğer sosyal medya hesaplarımıza gönderilen mesajlar kimlik doğrulamasına elverişli olmadığından resmî başvuru kanalı değildir."
          }
        ]
      },
      {
        "heading": "6. Başvuruda Bulunması Zorunlu Bilgi ve Belgeler",
        "paragraphs": [
          "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca başvurunuzda aşağıdaki bilgilerin bulunması zorunludur. Eksik bilgi içeren başvurularda, eksikliğin giderilmesi için sizinle iletişime geçilir."
        ],
        "ordered": [
          "Ad, soyad ve başvuru yazılı ise imza.",
          "Türkiye Cumhuriyeti vatandaşları için T.C. kimlik numarası; yabancılar için uyruğu, pasaport numarası veya varsa kimlik numarası.",
          "Tebligata esas yerleşim yeri veya iş yeri adresi.",
          "Varsa bildirime esas elektronik posta adresi, telefon ve faks numarası.",
          "Talep konusunun açık ve anlaşılır biçimde belirtilmesi; hangi hakka ilişkin talepte bulunulduğunun gösterilmesi.",
          "Talebe konu kişisel verinin veya işleme faaliyetinin belirlenmesini sağlayacak açıklamalar (örneğin sipariş numarası, üyelik e-postası, işlem tarihi).",
          "Konuya ilişkin bilgi ve belgeler varsa bunların başvuruya eklenmesi.",
          "Başvuru vekil, veli veya vasi aracılığıyla yapılıyorsa temsil yetkisini gösteren belgenin örneği."
        ]
      },
      {
        "heading": "7. Başvuru Formunda Doldurulacak Alanlar",
        "paragraphs": [
          "Aşağıdaki alanlar, başvurunuzu iletirken doldurmanız beklenen bölümleri gösterir. Formu çıktı alarak elle doldurabilir veya aynı başlıkları içeren bir metin hazırlayarak elektronik ortamda iletebilirsiniz."
        ],
        "table": [
          {
            "key": "Ad - Soyad",
            "value": "Kimliğinizde yazdığı şekilde eksiksiz yazınız."
          },
          {
            "key": "T.C. kimlik numarası",
            "value": "11 haneli numara. Yabancı uyruklu iseniz uyruğunuzu, pasaport numaranızı veya varsa yabancı kimlik numaranızı yazınız."
          },
          {
            "key": "Tebligata esas adres",
            "value": "Yanıtın posta ile gönderilmesini istiyorsanız açık adres, ilçe ve il bilgisi."
          },
          {
            "key": "E-posta adresi",
            "value": "Varsa bildirime esas e-posta. Sistemimizde kayıtlı adresinizi yazmanız kimlik doğrulamasını hızlandırır."
          },
          {
            "key": "Telefon numarası",
            "value": "Varsa cep veya sabit telefon; yalnızca eksik bilgi tamamlaması için kullanılır."
          },
          {
            "key": "Şirketimizle ilişkiniz",
            "value": "Müşteri, üye, ziyaretçi, aday çalışan, tedarikçi/iş ortağı yetkilisi, eski müşteri, diğer seçeneklerinden uygun olanı işaretleyiniz."
          },
          {
            "key": "İlişkinin dönemi",
            "value": "Varsa üyelik tarihi, sipariş tarihi/numarası veya iletişim kurduğunuz tarih aralığı."
          },
          {
            "key": "Talep edilen hak",
            "value": "Bu belgenin 8. bölümündeki listeden bir veya birden fazla seçeneği işaretleyiniz."
          },
          {
            "key": "Talep açıklaması",
            "value": "Talebinizi konu, tarih ve ilgili kayıt bilgisiyle birlikte açık şekilde yazınız."
          },
          {
            "key": "Ekler",
            "value": "Kimlik teyidine ilişkin belge, vekâletname/velayet-vesayet belgesi, talebi destekleyen ekran görüntüsü, fatura, sipariş çıktısı vb."
          },
          {
            "key": "Yanıtın iletilmesini istediğiniz yol",
            "value": "Adrese posta ile, e-posta ile veya elden teslim seçeneklerinden birini belirtiniz."
          },
          {
            "key": "Başvuru tarihi ve imza",
            "value": "Yazılı başvurularda tarih ve ıslak imza; elektronik başvurularda güvenli elektronik imza veya mobil imza."
          }
        ]
      },
      {
        "heading": "8. Talep Konusu - Hak Seçim Listesi",
        "paragraphs": [
          "Aşağıdaki seçeneklerden talebinize uyan bir veya birden fazlasını işaretleyiniz ve seçtiğiniz her seçenek için açıklama alanında ayrıntı veriniz. Birden fazla hakka ilişkin talepler tek başvuruda birlikte iletilebilir."
        ],
        "ordered": [
          "Şirketiniz nezdinde kişisel verilerimin işlenip işlenmediğini öğrenmek istiyorum.",
          "Kişisel verilerim işleniyorsa hangi verilerin işlendiğine ilişkin bilgi talep ediyorum.",
          "Kişisel verilerimin işlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenmek istiyorum.",
          "Kişisel verilerimin yurt içinde aktarıldığı üçüncü kişileri öğrenmek istiyorum.",
          "Kişisel verilerimin yurt dışına aktarılıp aktarılmadığını, aktarılıyorsa aktarıldığı ülkeleri ve alıcı gruplarını öğrenmek istiyorum.",
          "Eksik veya yanlış işlendiğini düşündüğüm kişisel verilerimin düzeltilmesini talep ediyorum. (Doğru ve güncel bilgiyi açıklama alanında belirtiniz.)",
          "Kişisel verilerimin silinmesini veya yok edilmesini talep ediyorum.",
          "Düzeltme, silme veya yok etme işleminin, verilerimin aktarıldığı üçüncü kişilere bildirilmesini talep ediyorum.",
          "Münhasıran otomatik sistemlerle yapılan analiz sonucunda aleyhime doğan sonuca itiraz ediyorum. (Örneğin otomatik risk skorlaması veya kişiselleştirilmiş öneri sonucu.)",
          "Kişisel verilerimin kanuna aykırı işlenmesi nedeniyle uğradığım zararın giderilmesini talep ediyorum. (Zararı ve nedensellik bağını açıklayınız.)",
          "Ticari elektronik ileti almayı reddediyorum ve pazarlama amaçlı işlemenin durdurulmasını talep ediyorum. (Bu talep aynı zamanda İleti Yönetim Sistemi üzerinden de iletilebilir.)",
          "Üyelik hesabımın ve buna bağlı kişisel verilerin, mevzuattan doğan saklama yükümlülükleri saklı kalmak üzere kapatılmasını talep ediyorum."
        ]
      },
      {
        "heading": "9. Talebin Açıklanması ve Destekleyici Belgeler",
        "paragraphs": [
          "Talebinizin doğru, eksiksiz ve hızlı biçimde sonuçlandırılabilmesi için, hangi işleme faaliyetine veya hangi kayda ilişkin talepte bulunduğunuzu belirginleştiren bilgileri paylaşmanız önemlidir. Genel ve soyut ifadeler, kayıtlarımızda arama yapılmasını güçleştirmekte ve ek bilgi talebiyle sürecin uzamasına yol açmaktadır.",
          "Aşağıdaki bilgiler, {{BRAND}} süreçlerinde talebinizin kaydını bulmamızı sağlayan tipik ayırt edici verilerdir."
        ],
        "bullets": [
          "Online mağaza siparişleriyle ilgili talepler için: sipariş numarası, sipariş tarihi ve siparişte kullandığınız e-posta adresi.",
          "Üyelik ve hesap verileriyle ilgili talepler için: üyelik e-posta adresi ve hesabın açıldığı yaklaşık tarih.",
          "Kargo ve teslimat verileriyle ilgili talepler için: teslimat adresi bilgisi ve varsa kargo takip numarası.",
          "Ödeme süreçlerine ilişkin talepler için: işlem tarihi ve tutarı. Kart numarasının tamamını hiçbir kanalda paylaşmayınız; kart verileri şirketimizde saklanmaz, ödeme işlemleri yetkili ödeme kuruluşu altyapısı üzerinden yürütülür.",
          "Ticari elektronik iletilerle ilgili talepler için: iletinin geldiği e-posta adresi veya telefon numarası ve iletinin yaklaşık tarihi.",
          "Sosyal medya üzerinden yürütülen iletişime ilişkin talepler için: hesap kullanıcı adınız ve mesajlaşma tarihi.",
          "Fiziki işletme ziyaretine ilişkin talepler için: ziyaret tarihi ve yaklaşık saat aralığı.",
          "Talebi destekleyen ekran görüntüsü, fatura, e-posta çıktısı veya yazışma örnekleri."
        ]
      },
      {
        "heading": "10. Kimlik Doğrulama",
        "paragraphs": [
          "Kanun'un 12. maddesi kapsamındaki veri güvenliği yükümlülüğümüz gereği, kişisel verilere ilişkin bilgi ve belgeleri yalnızca kimliği doğrulanmış ilgili kişiye veya yetkili temsilcisine iletebiliriz. Bu nedenle başvurunuzda kimliğinizi tevsik edici asgari bilgileri sunmanız gerekir.",
          "Kimlik doğrulaması, mümkün olan en az veriyle ve Kanun'un 4. maddesindeki veri minimizasyonu ilkesine uygun biçimde yapılır."
        ],
        "bullets": [
          "Sistemimizde kayıtlı ve daha önce doğrulanmış e-posta adresinizden yapılan başvurularda, ek belge talep edilmeksizin eşleştirme yoluyla doğrulama yapılabilir.",
          "Islak imzalı yazılı başvurularda kimliğinizin teyidi için kimlik belgenizin ibrazı veya örneğinin sunulması istenebilir.",
          "Kimlik belgesi örneği sunulacaksa, talep için gerekli olmayan alanların (örneğin din hanesi, kan grubu, fotoğraf) karartılması önerilir; bu alanlar tarafımızca işlenmez.",
          "Şüphe hâlinde veya talebin hassas nitelikte veri içermesi hâlinde ek doğrulama adımı uygulanabilir; bu adım talebin niteliğiyle orantılı tutulur.",
          "Kimlik doğrulaması amacıyla alınan belgeler, yalnızca doğrulama amacıyla kullanılır ve başvuru dosyasında saklama süresi boyunca erişimi sınırlı biçimde muhafaza edilir.",
          "Kimliği doğrulanamayan başvurularda, üçüncü kişilerin verilerinin ifşa edilmemesi amacıyla talep sonuçlandırılmaz; bu durum gerekçesiyle başvurana bildirilir."
        ]
      },
      {
        "heading": "11. Başvurunun Değerlendirilmesi ve Yanıt Süresi",
        "paragraphs": [
          "Başvurunuz {{SHORT_NAME}} tarafından kayda alınır, talebin niteliğine göre ilgili birimlere yönlendirilir ve niteliğine göre en kısa sürede, her hâlde talebin tarafımıza ulaştığı tarihten itibaren en geç otuz gün içinde sonuçlandırılır.",
          "Otuz günlük süre, başvurunun Tebliğ'de aranan bilgileri içerecek şekilde tarafımıza ulaştığı tarihte başlar. Eksik bilgi nedeniyle ek bilgi talep edilmesi hâlinde bu husus başvurana bildirilir.",
          "Başvurunun sonuçlandırılması ayrıca bir maliyet gerektiriyorsa, Kurulca belirlenen tarifedeki ücret talep edilebilir. Bu durumda süre, ücretin tarafımıza ödendiği tarihten itibaren işlemeye devam eder."
        ],
        "ordered": [
          "Kayıt: Başvuru, geliş kanalı ve tarihi ile birlikte başvuru kütüğüne işlenir ve başvurana bir referans bilgisi verilir.",
          "Kimlik ve yetki doğrulama: İlgili kişi veya temsilci sıfatı teyit edilir; eksiklik varsa tamamlanması istenir.",
          "Kapsam belirleme: Talebin Kanun'un 11. maddesindeki hangi hakka ilişkin olduğu ve hangi işleme faaliyetlerini kapsadığı tespit edilir.",
          "Araştırma: İlgili sistem ve kayıtlar (üyelik, sipariş, ödeme, kargo, destek, pazarlama kayıtları) taranır; gerekli hâllerde veri işleyenlerden bilgi istenir.",
          "Hukuki değerlendirme: Talebin karşılanmasına engel bir saklama yükümlülüğü, üçüncü kişi hakkı veya istisna bulunup bulunmadığı değerlendirilir.",
          "Karar ve uygulama: Talep kabul edilirse gerekli teknik ve idari işlem gerçekleştirilir; kısmen kabul veya ret hâlinde gerekçe hazırlanır.",
          "Bildirim: Sonuç, en geç otuz gün içinde ilgili kişiye yazılı veya elektronik ortamda bildirilir.",
          "Kapanış: İşlem ve bildirim kayıtları, hesap verebilirlik ilkesi gereği başvuru dosyasında muhafaza edilir."
        ]
      },
      {
        "heading": "12. Başvuru Ücreti",
        "paragraphs": [
          "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca başvurunun yanıtlanması kural olarak ücretsizdir. Ancak işlemin ayrıca bir maliyet gerektirmesi hâlinde Kurulca belirlenen tarifedeki ücret alınabilir.",
          "Talebin şirketimizin hatasından kaynaklandığının anlaşılması hâlinde alınan ücret ilgili kişiye iade edilir.",
          "Ücret talep edilmesi hâlinde, tutar ve ödeme yöntemi başvurana önceden bildirilir; ödeme yapılmadan işlem başlatılmaz ve ilgili kişi bu aşamada başvurusundan vazgeçebilir."
        ],
        "table": [
          {
            "key": "İlk 10 sayfaya kadar",
            "value": "Yazılı yanıtlarda ilk on sayfaya kadar ücret alınmaz."
          },
          {
            "key": "10 sayfanın üzeri",
            "value": "On sayfanın üzerindeki her sayfa için Kurulca belirlenen tarife uyarınca sayfa başına ücret alınabilir."
          },
          {
            "key": "CD, flash bellek gibi kayıt ortamında yanıt",
            "value": "Yanıtın kayıt ortamında verilmesi hâlinde, kayıt ortamının maliyeti kadar ücret talep edilebilir."
          },
          {
            "key": "Elektronik ortamda yanıt",
            "value": "Yanıtın e-posta ile elektronik ortamda verilmesi hâlinde kural olarak ücret alınmaz."
          },
          {
            "key": "Ücretin iadesi",
            "value": "Başvurunun şirketimizin hatasından kaynaklandığı anlaşılırsa tahsil edilen ücret iade edilir."
          },
          {
            "key": "Ödeme bilgileri",
            "value": "{{IBAN}}"
          },
          {
            "key": "Banka",
            "value": "{{BANK}}"
          }
        ]
      },
      {
        "heading": "13. Yanıtın Veriliş Şekli ve Tebliği",
        "paragraphs": [
          "Başvurunuz kabul edilir veya gerekçesi açıklanarak reddedilir; sonuç, talebin niteliğine ve tercih ettiğiniz iletişim yoluna göre yazılı olarak veya elektronik ortamda tarafınıza iletilir.",
          "Yanıtta; talebe konu kişisel verilerin durumu, yapılan işlemler, karşılanamayan talep varsa gerekçesi ve Kurul'a şikâyet hakkına ilişkin bilgilendirme yer alır."
        ],
        "bullets": [
          "Yazılı yanıt, tebligata esas adresinize posta yoluyla gönderilir veya elden teslim edilir; elden teslimde teslim tutanağı düzenlenir.",
          "Elektronik yanıt, başvuruda bildirdiğiniz veya sistemimizde kayıtlı doğrulanmış e-posta adresinize {{EMAIL}} adresinden gönderilir.",
          "Hassas nitelikte veya hacimli içerik barındıran yanıtlarda, içeriğin korunması amacıyla şifreli dosya veya güvenli bağlantı kullanılabilir; erişim bilgisi ayrı kanaldan iletilir.",
          "Yanıtın üçüncü kişilere ait kişisel veri içermesi hâlinde, bu veriler maskelenerek veya çıkarılarak paylaşım yapılır.",
          "Yanıt tarihi, otuz günlük sürenin içinde kalacak şekilde belirlenir ve tebliğ kaydı başvuru dosyasında muhafaza edilir.",
          "Yanıtın tarafınıza ulaşmadığını düşünüyorsanız {{EMAIL}} adresinden veya {{PHONE}} numarasından süreç hakkında bilgi talep edebilirsiniz."
        ]
      },
      {
        "heading": "14. Başvurunun Reddedilebileceği veya Kapsam Dışı Kalabileceği Hâller",
        "paragraphs": [
          "Aşağıdaki hâllerde başvurunuz kısmen veya tamamen karşılanamayabilir. Bu durumda ret gerekçesi açıkça belirtilir; ret kararı, Kanun'daki diğer haklarınızı ve Kurul'a şikâyet hakkınızı ortadan kaldırmaz."
        ],
        "ordered": [
          "Başvuranın kimliğinin veya temsil yetkisinin doğrulanamaması; bu hâlde üçüncü kişilere ait verilerin ifşasını önlemek amacıyla talep sonuçlandırılmaz.",
          "Talebin diğer kişilerin hak ve özgürlüklerini engelleyecek nitelikte olması; örneğin üçüncü bir kişinin kişisel verilerinin paylaşılmasını gerektiren talepler.",
          "Talebin, ticari sır niteliğindeki bilgilerin veya iş süreçlerine ilişkin gizli bilgilerin açıklanmasını gerektirmesi.",
          "Kişisel verilerin, mevzuatta öngörülen bir saklama yükümlülüğü kapsamında tutulması; örneğin 213 sayılı Vergi Usul Kanunu ve ilgili mevzuat uyarınca fatura ve muhasebe kayıtlarının saklanması zorunluluğu.",
          "Bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması nedeniyle işlemenin gerekli olması ya da şirketimizin bir hukuki yükümlülüğünü yerine getirmesi için işlemenin zorunlu olması.",
          "Bir hakkın tesisi, kullanılması veya korunması için veri işlemenin zorunlu olması; örneğin devam eden bir uyuşmazlık veya iade/itiraz sürecine ilişkin kayıtlar.",
          "Talebin, suç işlenmesinin önlenmesi veya suç soruşturması yürütülmesi ile ilgili olması; ya da millî savunma, millî güvenlik, kamu güvenliği ve kamu düzenine ilişkin istisna kapsamına girmesi.",
          "Talebe konu verinin anonim hâle getirilmiş olması; anonim veriler kişisel veri niteliğini yitirdiğinden bu veriler üzerinde silme, düzeltme veya bilgi talebi hakkı kullanılamaz.",
          "Kişisel veri işlemenin, ilgili kişinin kendisi tarafından alenileştirilmiş olması veya Kanun'un 28. maddesinde sayılan istisna hâllerinden birinin bulunması.",
          "Talebin, kişisel veri niteliği taşımayan bilgilere ya da tüzel kişilere ait verilere ilişkin olması.",
          "Talebin konusunun anlaşılamaması ve verilen makul süre içinde talep edilen açıklamanın yapılmaması.",
          "Aynı konuda daha önce sonuçlandırılmış ve koşullarda değişiklik bulunmayan mükerrer başvurular."
        ]
      },
      {
        "heading": "15. Mükerrer, Orantısız ve Kötüye Kullanım Niteliğindeki Başvurular",
        "paragraphs": [
          "Şirketimiz her başvuruyu iyi niyet ve hesap verebilirlik ilkesiyle değerlendirir. Bununla birlikte, hakkın kötüye kullanılması niteliğindeki başvurular hukuk düzeni tarafından korunmaz.",
          "Bu kapsamda değerlendirilen başvurularda dahi ret kararı gerekçelendirilir ve ilgili kişinin Kurul'a şikâyet hakkı hatırlatılır; başvurunun tümüyle cevapsız bırakılması söz konusu değildir."
        ],
        "bullets": [
          "Aynı konuda, koşullarda esaslı bir değişiklik olmaksızın kısa aralıklarla tekrarlanan başvurularda, önceki yanıta atıf yapılarak bilgilendirme yapılabilir.",
          "Talebin kapsamının belirsiz veya aşırı geniş olması hâlinde, talebin somutlaştırılması için ilgili kişiden makul bir açıklama istenir.",
          "Açıkça sistemi meşgul etme, sürekli aynı veriyi talep etme veya şirket çalışanlarını rahatsız etme amacı taşıyan başvurular, hakkın kötüye kullanımı olarak değerlendirilebilir.",
          "Başka bir kişinin verilerine erişmek amacıyla yapılan, gerçeğe aykırı beyan içeren başvurular sonuçlandırılmaz; gerektiğinde ilgili mevzuat uyarınca hukuki yollara başvurulur.",
          "Ticari elektronik iletiye ilişkin ret talepleri, mükerrer başvuru değerlendirmesinden bağımsız olarak her hâlükârda derhâl işleme alınır ve mevzuatta öngörülen süre içinde uygulanır.",
          "Bu bölümdeki değerlendirmeler, ilgili kişinin Kanun'dan doğan haklarını sınırlamaz ve genel kural olan otuz günlük yanıt yükümlülüğünü ortadan kaldırmaz."
        ]
      },
      {
        "heading": "16. Kişisel Verilerin Korunması Kurulu'na Şikâyet",
        "paragraphs": [
          "Başvurunuzun reddedilmesi, verilen yanıtı yetersiz bulmanız veya süresinde yanıt verilmemesi hâllerinde Kişisel Verilerin Korunması Kurulu'na şikâyette bulunma hakkınız vardır.",
          "Kanun uyarınca, yanıtı öğrendiğiniz tarihten itibaren otuz gün ve her hâlde başvuru tarihinden itibaren altmış gün içinde Kurul'a şikâyette bulunabilirsiniz. Kurul'a şikâyet yoluna başvurabilmek için öncelikle veri sorumlusuna başvurma şartı aranır.",
          "Kurul'a şikâyet yolu, Kanun'un kişisel verilerin hukuka aykırı işlenmesi nedeniyle uğranılan zararın giderilmesine ilişkin genel hükümlere göre dava açma hakkınızı ortadan kaldırmaz."
        ],
        "ordered": [
          "Önce bu rehberdeki kanallardan biriyle {{SHORT_NAME}}'ye başvurunuzu iletin ve başvuru tarihini belgeleyin.",
          "Yanıtı bekleyin: Talebiniz en geç otuz gün içinde sonuçlandırılır.",
          "Yanıt yetersizse veya reddedilmişse, yanıtı öğrendiğiniz tarihten itibaren otuz gün içinde Kurul'a şikâyet başvurusu yapabilirsiniz.",
          "Süresinde yanıt verilmemişse, veri sorumlusuna başvuru tarihinden itibaren altmış günlük süre içinde Kurul'a şikâyette bulunabilirsiniz.",
          "Şikâyet başvurunuza, veri sorumlusuna yaptığınız başvuruyu ve varsa aldığınız yanıtı gösteren belgeleri eklemeniz beklenir.",
          "Genel hükümler uyarınca tazminat talebiniz için yargı yoluna başvurma hakkınız her hâlde saklıdır."
        ]
      },
      {
        "heading": "17. Başvuru Sürecinde İşlenen Kişisel Veriler ve Başvuru Kaydının Saklanması",
        "paragraphs": [
          "Başvurunuzu değerlendirebilmek için ilettiğiniz kimlik, iletişim ve talep içeriği verilerini, Kanun'un 5. maddesindeki hukuki yükümlülüğün yerine getirilmesi ile bir hakkın tesisi, kullanılması veya korunması hukuki sebeplerine dayanarak işleriz.",
          "Başvuru kayıtları; Kanun'un 12. maddesindeki güvenlik yükümlülüğü ve hesap verebilirlik ilkesi gereği, başvurunun sonuçlandırılmasının ardından ilgili mevzuatta öngörülen zamanaşımı süreleri boyunca sınırlı erişimle saklanır. Sürenin dolmasıyla birlikte Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik ve şirketimizin Saklama ve İmha Politikası uyarınca silinir, yok edilir veya anonim hâle getirilir.",
          "Başvuru sürecinde işlenen veriler, başvurunun değerlendirilmesi dışında hiçbir amaçla kullanılmaz; pazarlama, profilleme veya ticari elektronik ileti gönderimi amacıyla işlenmez."
        ],
        "table": [
          {
            "key": "İşlenen veri kategorileri",
            "value": "Kimlik (ad-soyad, T.C. kimlik numarası veya pasaport bilgisi), iletişim (adres, e-posta, telefon), müşteri işlem (sipariş/üyelik referansları), talep içeriği ve ekler."
          },
          {
            "key": "İşleme amacı",
            "value": "Başvurunun kayda alınması, kimlik doğrulaması, talebin araştırılması, sonuçlandırılması ve ilgili kişiye bildirilmesi."
          },
          {
            "key": "Hukuki sebep",
            "value": "Kanun'un 5. maddesi kapsamında hukuki yükümlülüğün yerine getirilmesi ve bir hakkın tesisi, kullanılması veya korunması için veri işlemenin zorunlu olması."
          },
          {
            "key": "Aktarım",
            "value": "Gerekli hâllerde hukuk danışmanlarımıza, yetkili kamu kurum ve kuruluşlarına ve talebin niteliğine göre sistem sağlayıcılarımıza (barındırma, veri tabanı ve işlemsel e-posta hizmetleri) sınırlı olarak aktarılabilir."
          },
          {
            "key": "Saklama süresi",
            "value": "Başvurunun sonuçlandırılmasından itibaren ilgili mevzuatta öngörülen zamanaşımı süreleri boyunca; sürenin sonunda periyodik imha ile silinir, yok edilir veya anonimleştirilir."
          },
          {
            "key": "Erişim yetkisi",
            "value": "Başvuru kayıtlarına yalnızca yetkilendirilmiş personel erişebilir; yönetici erişimleri çok faktörlü kimlik doğrulama ile korunur ve tüm işlemler değiştirilemez olay kaydına yazılır."
          },
          {
            "key": "Teknik tedbirler",
            "value": "Aktarımda ve saklamada şifreleme, yetki matrisi, erişim kaydı ve düzenli yedekleme; veri tabanı düzeyinde satır bazlı erişim kısıtları."
          }
        ]
      },
      {
        "heading": "18. Yürürlük, Güncelleme ve İletişim",
        "paragraphs": [
          "Bu rehber ve form, {{SITE_URL}} adresinde yayımlandığı tarihte yürürlüğe girer. Mevzuat değişiklikleri, Kurul kararları veya süreçlerimizdeki güncellemeler nedeniyle metin zaman zaman revize edilebilir; güncel sürüm her zaman aynı adreste yayımlanır.",
          "Güncelleme yapılması hâlinde, değişikliğin niteliğine göre üyelerimize e-posta yoluyla bilgilendirme yapılabilir. Başvurunuz, tarafımıza ulaştığı tarihte yürürlükte olan sürüm esas alınarak değerlendirilir.",
          "Başvuru sürecine, bu formun doldurulmasına veya kişisel verilerinizin işlenmesine ilişkin her türlü sorunuz için aşağıdaki kanallardan bize ulaşabilirsiniz."
        ],
        "table": [
          {
            "key": "Veri sorumlusu",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Başvuru adresi",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Sosyal medya",
            "value": "{{HANDLE}} - {{IG}} - {{TIKTOK}} - {{YOUTUBE}}"
          }
        ]
      }
    ]
  },
  {
    "slug": "veri-saklama-ve-imha-politikasi",
    "title": "Kişisel Veri Saklama ve İmha Politikası",
    "shortTitle": "Saklama ve İmha",
    "category": "Veri & Gizlilik",
    "summary": "{{SHORT_NAME}} tarafından {{BRAND}} markası altında işlenen kişisel verilerin hangi ortamlarda, hangi sebeple ve ne kadar süreyle saklandığını; süre sonunda hangi yöntemle silineceğini, yok edileceğini veya anonim hâle getirileceğini gösterir.",
    "references": [
      "6698 sayılı Kişisel Verilerin Korunması Kanunu",
      "Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik",
      "Veri Sorumluları Sicili Hakkında Yönetmelik",
      "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ",
      "Kişisel Verilerin Korunması Kurulu ilke kararları ve Kişisel Veri Güvenliği Rehberi",
      "213 sayılı Vergi Usul Kanunu",
      "6102 sayılı Türk Ticaret Kanunu",
      "6098 sayılı Türk Borçlar Kanunu",
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
      "Mesafeli Sözleşmeler Yönetmeliği (RG: 27.11.2014, 29188)",
      "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun",
      "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik",
      "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik",
      "5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun",
      "5464 sayılı Banka Kartları ve Kredi Kartları Kanunu",
      "6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun",
      "5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu",
      "6100 sayılı Hukuk Muhakemeleri Kanunu",
      "4857 sayılı İş Kanunu"
    ],
    "sections": [
      {
        "heading": "1. Amaç ve Kapsam",
        "paragraphs": [
          "Bu Kişisel Veri Saklama ve İmha Politikası (Politika), {{LEGAL_NAME}} ({{SHORT_NAME}}, Şirket veya veri sorumlusu) tarafından {{BRAND}} markası ve {{SITE_URL}} adresinde yayımlanan internet sitesi ile İstanbul Tuzla'daki fiziki işletme kapsamında işlenen kişisel verilerin saklanmasına ve imhasına ilişkin usul ve esasları belirlemek amacıyla hazırlanmıştır.",
          "Politika, 6698 sayılı Kişisel Verilerin Korunması Kanunu ile Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik uyarınca veri sorumlusunun hazırlamakla yükümlü olduğu saklama ve imha politikası niteliğindedir. Kanunun kişisel verilerin işlenmesine ilişkin genel ilkelerini düzenleyen hükmü gereğince kişisel veriler, ancak ilgili mevzuatta öngörülen veya işlendikleri amaç için gerekli olan süre kadar muhafaza edilir.",
          "Politikanın kapsamına, Şirketin tamamen veya kısmen otomatik olan ya da herhangi bir veri kayıt sisteminin parçası olmak kaydıyla otomatik olmayan yollarla işlediği tüm kişisel veriler girer. Bu veriler; internet sitesi üyeleri ve müşteriler, kafe ziyaretçileri, tedarikçi ve iş ortağı yetkilileri, çalışan adayları, çalışanlar ile Şirkete talep, şikâyet veya başvuru ileten üçüncü kişilere ait olabilir.",
          "Politika; Şirketin tüm birimlerini, çalışanlarını, Şirket adına kişisel veri işleyen veri işleyenleri ve bu kişilerin eriştiği tüm kayıt ortamlarını bağlar. Politikanın uygulanması, Şirketin Kişisel Verilerin İşlenmesi ve Korunması Politikası, Aydınlatma Metni, Çerez Politikası ve bilgi güvenliği prosedürleri ile birlikte bir bütün oluşturur; bir çelişki hâlinde Kanun ve ilgili mevzuat hükümleri esas alınır."
        ]
      },
      {
        "heading": "2. Hukuki Dayanak ve Politikanın Niteliği",
        "paragraphs": [
          "Bu Politika, aşağıda sayılan mevzuat başta olmak üzere yürürlükteki tüm ilgili düzenlemeler esas alınarak hazırlanmıştır. Politika, kişisel verilerin işlenmesine hukuki dayanak oluşturmaz; yalnızca hukuka uygun şekilde işlenen kişisel verilerin saklanma sürelerini ve süre sonunda uygulanacak imha yöntemlerini belirler."
        ],
        "bullets": [
          "6698 sayılı Kişisel Verilerin Korunması Kanunu ve ikincil düzenlemeleri.",
          "Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik.",
          "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ ile Veri Sorumluları Sicili Hakkında Yönetmelik.",
          "213 sayılı Vergi Usul Kanunu ve 6102 sayılı Türk Ticaret Kanununun defter, kayıt ve belge saklamaya ilişkin hükümleri.",
          "6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği.",
          "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun, Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik ile Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik.",
          "5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun ve ikincil düzenlemeleri.",
          "5464 sayılı Banka Kartları ve Kredi Kartları Kanunu ile 6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun.",
          "6098 sayılı Türk Borçlar Kanunu ve 6100 sayılı Hukuk Muhakemeleri Kanunu.",
          "5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu ile Türk Gıda Kodeksi kapsamındaki izlenebilirlik yükümlülükleri.",
          "4857 sayılı İş Kanunu ve sosyal güvenlik mevzuatının özlük dosyası ile belge saklamaya ilişkin hükümleri."
        ]
      },
      {
        "heading": "3. Tanımlar",
        "paragraphs": [
          "Bu Politikada geçen kavramlar, Kanun ve Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelikte tanımlandığı anlamda kullanılır."
        ],
        "table": [
          {
            "key": "Kişisel veri",
            "value": "Kimliği belirli veya belirlenebilir gerçek kişiye ilişkin her türlü bilgi."
          },
          {
            "key": "Özel nitelikli kişisel veri",
            "value": "Kanunda sınırlı sayıda sayılan; sağlık, biyometrik veri, din, üyelik bilgileri gibi işlenmesi ek koruma gerektiren veri türleri."
          },
          {
            "key": "Veri sorumlusu",
            "value": "Kişisel verilerin işlenme amaçlarını ve vasıtalarını belirleyen, veri kayıt sisteminin kurulmasından ve yönetilmesinden sorumlu olan {{LEGAL_NAME}}."
          },
          {
            "key": "Veri işleyen",
            "value": "Veri sorumlusunun verdiği yetkiye dayanarak onun adına kişisel veri işleyen gerçek veya tüzel kişi; örneğin barındırma, veri tabanı, e-posta gönderim, kargo ve muhasebe hizmeti sağlayıcıları."
          },
          {
            "key": "İlgili kişi",
            "value": "Kişisel verisi işlenen gerçek kişi; üyeler, müşteriler, ziyaretçiler, çalışan adayları ve diğer gerçek kişiler."
          },
          {
            "key": "İlgili kullanıcı",
            "value": "Verilerin teknik olarak depolanması, korunması ve yedeklenmesinden sorumlu kişi veya birim hariç olmak üzere, veri sorumlusunun organizasyonu içinde ya da veri sorumlusundan aldığı yetki ve talimat doğrultusunda kişisel verileri işleyen kişiler."
          },
          {
            "key": "Kayıt ortamı",
            "value": "Tamamen veya kısmen otomatik olan ya da herhangi bir veri kayıt sisteminin parçası olmak kaydıyla otomatik olmayan yollarla işlenen kişisel verilerin bulunduğu her türlü ortam."
          },
          {
            "key": "İmha",
            "value": "Kişisel verilerin silinmesi, yok edilmesi veya anonim hâle getirilmesi işlemlerinin ortak adı."
          },
          {
            "key": "Silme",
            "value": "Kişisel verilerin ilgili kullanıcılar için hiçbir şekilde erişilemez ve tekrar kullanılamaz hâle getirilmesi."
          },
          {
            "key": "Yok etme",
            "value": "Kişisel verilerin hiç kimse tarafından hiçbir şekilde erişilemez, geri getirilemez ve tekrar kullanılamaz hâle getirilmesi."
          },
          {
            "key": "Anonim hâle getirme",
            "value": "Kişisel verilerin başka verilerle eşleştirilse dahi hiçbir surette kimliği belirli veya belirlenebilir bir gerçek kişiyle ilişkilendirilemeyecek hâle getirilmesi."
          },
          {
            "key": "Periyodik imha",
            "value": "Kişisel verilerin işlenme şartlarının tamamının ortadan kalkması durumunda, bu Politikada belirtilen ve tekrar eden aralıklarla re'sen gerçekleştirilen silme, yok etme veya anonim hâle getirme işlemi."
          },
          {
            "key": "Maskeleme",
            "value": "Kişisel verinin belirli kısımlarının silinerek, yıldızlanarak veya kısaltılarak kimliği belirlenebilir olmaktan çıkarılması."
          },
          {
            "key": "Karartma",
            "value": "Fiziki veya görüntü kaydı niteliğindeki ortamlarda kişisel verinin geri döndürülemez biçimde okunamaz hâle getirilmesi."
          },
          {
            "key": "Olay kaydı (audit log)",
            "value": "Yönetici hesapları tarafından gerçekleştirilen veri değişikliklerinin, imha işlemleri dâhil olmak üzere, değiştirilemez biçimde tutulduğu kayıt."
          }
        ]
      },
      {
        "heading": "4. Veri Sorumlusuna İlişkin Bilgiler",
        "paragraphs": [
          "Bu Politika kapsamındaki tüm saklama ve imha faaliyetlerinin veri sorumlusu aşağıda bilgileri yer alan tüzel kişidir. {{BRAND}}, veri sorumlusunun işlettiği ticari markadır ve ayrı bir tüzel kişiliği bulunmamaktadır."
        ],
        "table": [
          {
            "key": "Ticaret unvanı",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Kısa unvan",
            "value": "{{SHORT_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Adres",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Vergi dairesi",
            "value": "{{TAX_OFFICE}}"
          },
          {
            "key": "Vergi kimlik numarası",
            "value": "{{TAX_NO}}"
          },
          {
            "key": "Vergi türü",
            "value": "{{TAX_TYPE}}"
          },
          {
            "key": "Faaliyet kodu",
            "value": "{{NACE}}"
          },
          {
            "key": "Faaliyete başlama tarihi",
            "value": "{{STARTED_AT}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil numarası",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "Instagram",
            "value": "{{IG}}"
          },
          {
            "key": "TikTok",
            "value": "{{TIKTOK}}"
          },
          {
            "key": "YouTube",
            "value": "{{YOUTUBE}}"
          }
        ]
      },
      {
        "heading": "5. Kayıt Ortamları",
        "paragraphs": [
          "Kişisel veriler, aşağıda sayılan elektronik ve fiziki kayıt ortamlarında, güvenliklerinin sağlanmasına yönelik teknik ve idari tedbirler alınarak muhafaza edilir. Yeni bir kayıt ortamı devreye alındığında bu liste güncellenir ve ortama ilişkin saklama süresi ile imha yöntemi belirlenir."
        ],
        "bullets": [
          "Uygulama veri tabanı: Müşteri hesapları, siparişler, ürün ve stok kayıtları, promosyon kullanımları ile olay kayıtlarının tutulduğu PostgreSQL veri tabanı. Satır bazlı güvenlik (RLS) etkin olup erişim yalnızca sunucu tarafındaki servis anahtarı ile gerçekleşir.",
          "Uygulama sunucuları ve barındırma ortamı: İnternet sitesinin çalıştığı bulut barındırma altyapısı ile bu altyapıda oluşan uygulama günlükleri, hata kayıtları ve isteğe ilişkin teknik kayıtlar.",
          "E-posta ve işlemsel ileti sağlayıcısı: Sipariş onayı, e-posta doğrulama, şifre sıfırlama ve bilgilendirme iletilerinin gönderildiği e-posta altyapısı ile gönderim kayıtları.",
          "Kurumsal e-posta kutuları: {{EMAIL}} adresine ulaşan talep, şikâyet, cayma bildirimi ve ilgili kişi başvurularının bulunduğu posta kutuları.",
          "Yedekleme ortamları: Veri tabanının şifreli anlık görüntüleri (snapshot) ve düzenli yedekleri ile bunların saklandığı bulut depolama alanları.",
          "Ödeme ve muhasebe kayıtları: Ödeme kuruluşu veya banka sanal POS altyapısından dönen işlem referansları, provizyon ve iade kayıtları ile mali müşavir nezdinde tutulan muhasebe kayıtları. Kart numarasının tamamı, son kullanma tarihi ve güvenlik kodu Şirket sistemlerinde hiçbir şekilde saklanmaz.",
          "Kâğıt ortam: Kafe işletmesinde düzenlenen fatura ve sevk belgeleri, sözleşme nüshaları, tedarikçi evrakı, çalışan ve çalışan adayı dosyaları ile kilitli dolaplarda muhafaza edilen diğer basılı belgeler.",
          "Kafe kamera kayıt cihazı: İşletme içinde ve girişinde güvenlik amacıyla konumlandırılan kameraların görüntülerinin kaydedildiği, fiziki erişimi kilitli alanla sınırlandırılmış kayıt cihazı ve diskleri.",
          "Taşınabilir ortamlar ve çalışan cihazları: Disk şifrelemesi etkin dizüstü bilgisayarlar ile istisnai hâllerde kullanılan taşınabilir bellekler. Kişisel verilerin bu ortamlarda kalıcı olarak tutulması yasaktır.",
          "Sosyal medya hesapları: {{HANDLE}} kullanıcı adıyla işletilen {{IG}}, {{TIKTOK}} ve {{YOUTUBE}} hesaplarına gelen mesaj ve yorumlar. Bu ortamlarda platform sağlayıcısının kendi saklama politikaları da geçerlidir."
        ]
      },
      {
        "heading": "6. Saklamayı Gerektiren Hukuki, Teknik ve Ticari Sebepler",
        "paragraphs": [
          "Kişisel veriler, Kanunda ve ilgili diğer mevzuatta öngörülen süreler ile işlendikleri amacın gerektirdiği süre boyunca saklanır. Saklamayı gerektiren başlıca sebepler aşağıda sayılmıştır."
        ],
        "ordered": [
          "213 sayılı Vergi Usul Kanunu uyarınca fatura, fiş, sevk irsaliyesi gibi vesikaların ve bunlara esas kayıtların, ilgili bulundukları takvim yılını izleyen yılın başından itibaren muhafaza edilmesi ve yetkili makamlara ibraz edilmesi yükümlülüğü.",
          "6102 sayılı Türk Ticaret Kanunu uyarınca ticari defterlerin, envanterlerin, finansal tabloların ve ticari yazışmaların belirlenen süre boyunca saklanması yükümlülüğü.",
          "6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği kapsamında ön bilgilendirme yükümlülüğünün, cayma hakkı bildirimlerinin, ayıplı mal ve hizmete ilişkin taleplerin ve zamanaşımı süresince doğabilecek uyuşmazlıkların ispatı ihtiyacı.",
          "6098 sayılı Türk Borçlar Kanunu kapsamındaki genel zamanaşımı süreleri boyunca sözleşmenin kurulduğunun, içeriğinin ve ifa edildiğinin ispatlanabilmesi gerekliliği.",
          "6100 sayılı Hukuk Muhakemeleri Kanunu uyarınca elektronik kayıtların delil olarak sunulabilmesi ve dava zamanaşımı süresince muhafaza edilmesi ihtiyacı.",
          "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik uyarınca ticari elektronik ileti onaylarının ve gönderim kayıtlarının, İleti Yönetim Sistemi (İYS) kayıtları dâhil olmak üzere saklanması yükümlülüğü.",
          "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik uyarınca sipariş ve sözleşmeye ilişkin kayıtların ve şikâyet süreçlerinin belgelenmesi yükümlülüğü.",
          "5651 sayılı Kanun ve ikincil düzenlemeleri kapsamında yer sağlayıcı sıfatıyla trafik bilgisinin belirlenen asgari süre boyunca muhafaza edilmesi ve bütünlüğünün korunması yükümlülüğü.",
          "5464 sayılı Banka Kartları ve Kredi Kartları Kanunu ile 6493 sayılı Kanun kapsamında ödeme işlemlerinin izlenebilirliği, itiraz ve ters ibraz (chargeback) süreçlerinin yürütülmesi ve ödeme kuruluşu ile mutabakat sağlanması ihtiyacı.",
          "5996 sayılı Kanun ve Türk Gıda Kodeksi mevzuatı kapsamında gıda ürünlerinde izlenebilirliğin sağlanması, alerjen bildirimi ve ürün geri çağırma süreçlerinin yürütülebilmesi gerekliliği.",
          "4857 sayılı İş Kanunu ve sosyal güvenlik mevzuatı uyarınca çalışan özlük dosyalarının tutulması ve ilgili belgelerin saklanması yükümlülüğü.",
          "6698 sayılı Kanun kapsamında aydınlatma yükümlülüğünün, açık rıza beyanlarının ve ilgili kişi başvurularına verilen yanıtların hesap verebilirlik ilkesi gereği ispatlanabilmesi ihtiyacı.",
          "Bilgi güvenliğinin sağlanması, yetkisiz erişim ve sahtecilik girişimlerinin tespiti ile olay müdahale süreçlerinin yürütülmesi amacıyla teknik kayıtların tutulması gerekliliği.",
          "Şirketin meşru menfaati kapsamında satış ve müşteri memnuniyeti süreçlerinin yönetilmesi, ancak bu menfaatin ilgili kişinin temel hak ve özgürlüklerine zarar vermemesi koşuluyla."
        ]
      },
      {
        "heading": "7. İmhayı Gerektiren Sebepler",
        "paragraphs": [
          "Kişisel veriler, aşağıdaki hâllerin varlığında re'sen veya ilgili kişinin talebi üzerine silinir, yok edilir ya da anonim hâle getirilir. İmha yükümlülüğü doğduğunda, verinin bulunduğu tüm kayıt ortamları için eşzamanlı olarak işlem başlatılır."
        ],
        "ordered": [
          "Kişisel verinin işlenmesine esas teşkil eden ilgili mevzuat hükümlerinin değiştirilmesi veya yürürlükten kaldırılması.",
          "Kişisel verinin işlenmesini veya saklanmasını gerektiren amacın ortadan kalkması.",
          "Kanunun kişisel veri işleme şartlarını düzenleyen hükümlerinde yer alan tüm şartların ortadan kalkması.",
          "Kişisel verinin yalnızca açık rızaya dayalı olarak işlendiği hâllerde ilgili kişinin açık rızasını geri alması.",
          "İlgili kişinin, Kanunun kendisine tanıdığı haklar çerçevesinde kişisel verilerinin silinmesi veya yok edilmesi yönündeki talebinin Şirketçe kabul edilmesi.",
          "Şirketin, ilgili kişi tarafından yapılan silme veya yok etme talebini reddetmesi, verdiği yanıtı yetersiz bulunması veya süresinde yanıt vermemesi üzerine ilgili kişinin Kurula şikâyette bulunması ve bu talebin Kurulca uygun bulunması.",
          "Kişisel verinin saklanmasını gerektiren azami sürenin dolmuş olması ve daha uzun süre saklamayı haklı kılan başka bir hukuki sebebin bulunmaması.",
          "Üyelik hesabının ilgili kişi tarafından kapatılması veya Şirketçe sözleşmeye aykırılık nedeniyle sona erdirilmesi ile hesaba bağlı verilerin işleme amacının ortadan kalkması.",
          "Çalışan adayının işe alım sürecinin olumsuz sonuçlanması ve adayın verisinin ileride değerlendirilmesine yönelik bir açık rızasının bulunmaması.",
          "Verinin hatalı, güncel olmayan veya işleme amacı bakımından gereksiz olduğunun tespit edilmesi ve düzeltilmesinin mümkün olmaması."
        ]
      },
      {
        "heading": "8. Veri Kategorileri Bazında Saklama ve İmha Süreleri",
        "paragraphs": [
          "Aşağıdaki tabloda, işlenen kişisel veri kategorileri ile bunlara uygulanan azami saklama süreleri gösterilmiştir. Süreler, aksi belirtilmedikçe ilgili işlemin gerçekleştiği ya da hukuki ilişkinin sona erdiği tarihten itibaren işlemeye başlar. Mali kayıtlarda süre, ilgili bulundukları takvim yılını izleyen yılın başından itibaren hesaplanır.",
          "Saklama süresinin dolmasının ardından veriler, en geç takip eden periyodik imha döneminde silinir, yok edilir veya anonim hâle getirilir. Hakkında devam eden bir uyuşmazlık, idari soruşturma, denetim veya yasal talep bulunan veriler, ilgili sürecin kesin olarak sonuçlanmasına ve varsa kanun yollarının tüketilmesine kadar hukuki saklama (legal hold) kaydı altına alınır ve bu süre boyunca imha edilmez."
        ],
        "table": [
          {
            "key": "Üyelik ve hesap verisi (ad, soyad, e-posta, telefon, şifre özeti, adres defteri, favori listesi)",
            "value": "Üyelik ilişkisinin devamı süresince; üyeliğin sona ermesinden itibaren 10 yıl. Şifreler geri döndürülemez özet (bcrypt) olarak tutulur, düz metin olarak hiçbir ortamda saklanmaz."
          },
          {
            "key": "E-posta doğrulama ve şifre sıfırlama jetonları",
            "value": "Jetonun geçerlilik süresi boyunca (azami 24 saat); kullanıldığında veya süresi dolduğunda otomatik olarak silinir."
          },
          {
            "key": "Sipariş, fatura ve mali kayıtlar (sipariş kalemleri, tutar, KDV, fatura bilgileri)",
            "value": "Vergi Usul Kanunu ve Türk Ticaret Kanunu uyarınca 10 yıl."
          },
          {
            "key": "Ödeme işlem kaydı (işlem referansı, provizyon ve iade kayıtları, maskelenmiş kart bilgisi, 3D Secure doğrulama sonucu)",
            "value": "10 yıl. Kart numarasının tamamı, son kullanma tarihi ve güvenlik kodu (CVV/CVC) hiçbir aşamada saklanmaz; kart verisi ödeme kuruluşunun PCI-DSS uyumlu ortamında işlenir."
          },
          {
            "key": "Mesafeli satış onay kaydı (Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi onayı, onay tarihi ve saati, IP adresi, tarayıcı bilgisi, belge sürümü)",
            "value": "Sözleşmenin ifasından itibaren 10 yıl; uyuşmazlık hâlinde uyuşmazlığın kesin olarak sonuçlanmasına kadar."
          },
          {
            "key": "Cayma hakkı, iade ve ayıplı mal talepleri ile ilgili kayıtlar",
            "value": "Talebin sonuçlandırılmasından itibaren 10 yıl."
          },
          {
            "key": "Kargo ve teslimat verisi (teslimat adresi, alıcı adı, telefon, takip numarası, teslim kaydı)",
            "value": "Teslimattan itibaren 10 yıl. Kargo firması nezdinde saklama, o firmanın kendi politikalarına ve mevzuata tabidir."
          },
          {
            "key": "İletişim, talep ve şikâyet kayıtları (e-posta yazışmaları, telefon notları, sosyal medya mesajları)",
            "value": "Talebin sonuçlandırılmasından itibaren 3 yıl; talebin bir sipariş uyuşmazlığına konu olması hâlinde ilgili sipariş kaydının saklama süresine tabidir."
          },
          {
            "key": "Ticari elektronik ileti (bülten) onay kaydı",
            "value": "Onayın geçerliliğinin sona erdiği tarihten itibaren 3 yıl; onayın geri alınması hâlinde ret kaydı, tekrar ileti gönderilmemesini sağlamak amacıyla bu süre boyunca tutulur."
          },
          {
            "key": "Ticari elektronik ileti gönderim kayıtları (gönderim tarihi, alıcı, içerik türü)",
            "value": "Gönderim tarihinden itibaren 1 yıl."
          },
          {
            "key": "Çerez ve site kullanım verisi (oturum, tercih, ölçümleme çerezleri)",
            "value": "Oturum çerezleri tarayıcı oturumunun sonunda; kalıcı çerezler çerez türüne göre azami 12 ay. Ayrıntılar Çerez Politikasında yer alır."
          },
          {
            "key": "Sunucu, uygulama ve güvenlik logları ile trafik bilgisi (IP adresi, zaman damgası, istek bilgileri)",
            "value": "5651 sayılı Kanun kapsamındaki asgari süreye uygun olarak 1 yıl; güvenlik olayına konu kayıtlar olayın incelenmesi tamamlanana kadar ayrıca muhafaza edilir."
          },
          {
            "key": "Kafe kamera kayıtları (görüntü)",
            "value": "30 gün. Süre sonunda kayıt cihazı tarafından otomatik olarak üzerine yazılır. Adli veya idari bir talebe konu görüntüler, ilgili süreç sonuçlanana kadar ayrı ve erişimi sınırlı ortamda saklanır."
          },
          {
            "key": "Çalışan adayı özgeçmişi ve işe alım süreci verisi",
            "value": "Başvuru tarihinden itibaren 1 yıl; adayın ileriye dönük değerlendirme için açık rızası bulunması hâlinde en fazla 2 yıl."
          },
          {
            "key": "Çalışan özlük verisi",
            "value": "İş ilişkisinin sona ermesinden itibaren 10 yıl; iş sağlığı ve güvenliği ile sosyal güvenlik mevzuatının daha uzun süre öngördüğü kayıtlar için ilgili mevzuattaki süre uygulanır."
          },
          {
            "key": "Olay kaydı (audit log) ve yönetici işlem kayıtları",
            "value": "İşlemin gerçekleştiği tarihten itibaren 10 yıl. Kayıtlar değiştirilemez (append-only) olarak tutulur."
          },
          {
            "key": "İlgili kişi başvuruları ve verilen yanıtlar",
            "value": "Başvurunun sonuçlandırılmasından itibaren 10 yıl; hesap verebilirlik ilkesi ve denetim yükümlülüğü gereği muhafaza edilir."
          },
          {
            "key": "İmha (silme, yok etme, anonimleştirme) kayıtları",
            "value": "İmha tarihinden itibaren en az 3 yıl; ilgili mevzuat daha uzun süre öngörürse bu süre uygulanır."
          },
          {
            "key": "Tedarikçi ve iş ortağı yetkilisi iletişim verisi",
            "value": "Sözleşme ilişkisinin sona ermesinden itibaren 10 yıl."
          },
          {
            "key": "Yedekleme ortamlarındaki kopyalar",
            "value": "Yedek saklama döngüsüne bağlı olarak azami 90 gün; döngü tamamlandığında yedek tümüyle geçersiz kılınır."
          }
        ]
      },
      {
        "heading": "9. Kişisel Verilerin Silinmesi, Yok Edilmesi ve Anonim Hâle Getirilmesi Yöntemleri",
        "paragraphs": [
          "Saklama süresi dolan veya işlenme şartları ortadan kalkan kişisel veriler, verinin bulunduğu kayıt ortamının niteliğine göre aşağıdaki yöntemlerden biri veya birkaçı ile imha edilir. Yöntem seçiminde verinin niteliği, hassasiyeti, işlenme amacı ve kayıt ortamının özellikleri dikkate alınır.",
          "Silme, verinin ilgili kullanıcılar bakımından erişilemez ve tekrar kullanılamaz hâle getirilmesini; yok etme, verinin hiç kimse tarafından geri getirilemeyecek şekilde ortadan kaldırılmasını; anonim hâle getirme ise verinin gerçek kişiyle ilişkilendirilebilirliğinin geri döndürülemez biçimde ortadan kaldırılmasını ifade eder."
        ],
        "bullets": [
          "Yazılımdan güvenli silme: Uygulama veri tabanındaki kişisel veri satırlarının kalıcı olarak silinmesi (hard delete) veya kişisel veri içeren alanların geri döndürülemez biçimde boşaltılması. Yalnızca görünürlüğü kapatan işaretleme (soft delete) tek başına silme sayılmaz; işaretlenen kayıtlar belirlenen süre içinde fiilen silinir.",
          "Erişim yetkisinin kaldırılması: Verinin fiilen silinemediği hâllerde ilgili kullanıcıların erişim yetkilerinin tümüyle kaldırılması, verinin ayrı ve erişimi kısıtlı bir alana taşınması ve yalnızca teknik saklamadan sorumlu personelin erişebilmesinin sağlanması.",
          "Veri tabanı sütun ve alan bazlı temizlik: Sipariş gibi mali sebeplerle saklanması zorunlu kayıtlarda, saklama gerekçesi bulunmayan kişisel alanların (örneğin serbest metin notlar, ikincil iletişim bilgileri) ayrıştırılarak silinmesi.",
          "Yedeklerden düşme: Silinen verinin bulunduğu yedek kopyaların, yedek saklama döngüsünün tamamlanmasıyla birlikte tümüyle geçersiz kılınması; bu süre içinde yedeklerin yalnızca sistem yöneticisi erişimine açık, şifreli ve salt geri yükleme amaçlı tutulması.",
          "Kriptografik silme: Şifreli olarak saklanan verilerde şifreleme anahtarının güvenli biçimde imha edilerek veriye erişimin matematiksel olarak imkânsız hâle getirilmesi.",
          "Fiziksel yok etme: Kâğıt ortamdaki belgelerin geri döndürülemeyecek şekilde evrak imha makinesinde küçük parçalara ayrılması; imhası mümkün olmayan belgelerde kişisel veri içeren bölümlerin geri döndürülemez biçimde karartılması.",
          "Manyetik ve optik ortamların yok edilmesi: Kullanımdan kaldırılan disk, bellek ve optik ortamların fiziksel olarak parçalanması, eritilmesi, yakılması veya manyetik alandan geçirilerek (degauss) okunamaz hâle getirilmesi; tutanakla kayıt altına alınması.",
          "Üzerine yazma: Kamera kayıt cihazında görüntülerin saklama süresi sonunda yeni kayıtlarla otomatik olarak üzerine yazılması; ayrıca özel yazılımlarla rastgele veri yazılarak eski kayıtların geri getirilemez hâle getirilmesi.",
          "Maskeleme: E-posta, telefon ve adres gibi alanların belirli kısımlarının geri döndürülemez biçimde yıldızlanarak veya kısaltılarak kimliği belirlenebilir olmaktan çıkarılması.",
          "Değişken çıkarma ve genelleştirme: Kimliği doğrudan belirleyen alanların (ad, soyad, e-posta, telefon, adres, müşteri numarası) veri kümesinden tümüyle çıkarılması; doğum tarihi gibi alanların yıl aralığına, adresin ilçe düzeyine indirgenmesi.",
          "Toplulaştırma (agregasyon): Analitik ve raporlama amacıyla verilerin bireysel kayıt düzeyinden çıkarılarak günlük ciro, kategori bazlı satış adedi veya ortalama sepet tutarı gibi toplu istatistiklere dönüştürülmesi.",
          "K-anonimlik ve türevleri: Anonimleştirilen veri kümelerinde her kayıt kombinasyonunun en az k adet kayıtla ayırt edilemez olmasının sağlanması; gerektiğinde l-çeşitlilik gibi ek yöntemlerle yeniden kimliklendirme riskinin azaltılması.",
          "Veri işleyene imha talimatı: Şirket adına veri işleyen taraflarda bulunan kopyaların imhası için yazılı talimat verilmesi ve imhanın gerçekleştiğinin veri işleyenden yazılı olarak teyit edilmesi."
        ]
      },
      {
        "heading": "10. Anonimleştirmenin Sınırları ve Yeniden Kimliklendirme Riskinin Yönetimi",
        "paragraphs": [
          "Anonim hâle getirilen veriler Kanun kapsamı dışında kalır; ancak anonimleştirmenin geri döndürülebilir olması hâlinde veri kişisel veri olmaya devam eder. Bu nedenle Şirket, anonimleştirme öncesinde her veri kümesi için yeniden kimliklendirme riski değerlendirmesi yapar.",
          "Değerlendirmede; veri kümesinin tekillik derecesi, dışarıdan erişilebilir başka veri kaynaklarıyla eşleştirilme olasılığı, kayıt sayısı ve alanların ayırt ediciliği dikkate alınır. Riskin kabul edilebilir düzeye indirilemediği hâllerde veri anonimleştirilmez, doğrudan silinir veya yok edilir.",
          "Anonimleştirilmiş veri kümeleri, kişisel veri içeren kaynak kümelerle aynı ortamda tutulmaz ve eşleştirmeye imkân verecek ara tablolar (eşleme anahtarları) anonimleştirme işleminin ardından yok edilir. Anonimleştirme yalnızca ürün ve satış performansının ölçülmesi, stok planlaması, menü geliştirme ve site kullanımının iyileştirilmesi gibi istatistiksel amaçlarla uygulanır.",
          "Tekilleştirilmiş kimlik yerine geçen takma ad (pseudonym) kullanımı tek başına anonimleştirme sayılmaz; takma adlı veriler kişisel veri olarak değerlendirilir ve bu Politikadaki saklama sürelerine tabidir."
        ]
      },
      {
        "heading": "11. Yedekleme Ortamlarındaki Kişisel Verilerin İmhası",
        "paragraphs": [
          "Aktif sistemlerden silinen kişisel verilerin, teknik olarak yedekleme ortamlarında bir süre daha bulunması mümkündür. Yedeklerden anlık olarak seçili kayıt silmek çoğu durumda teknik olarak mümkün olmadığından, bu ortamlardaki veriler için aşağıdaki usul uygulanır."
        ],
        "ordered": [
          "Aktif sistemden silinen kayıt, silme kaydı ile birlikte imha listesine işlenir ve yedeklerde bulunan kopyasının hangi tarihte döngüden düşeceği belirtilir.",
          "Yedekler şifreli olarak tutulur; yedeklere erişim yalnızca sistem yöneticisi yetkisiyle ve yalnızca felaketten geri dönüş amacıyla mümkündür. İlgili kullanıcıların yedeklere erişimi bulunmaz.",
          "Yedek saklama döngüsünün tamamlanmasıyla ilgili yedek kümesi tümüyle geçersiz kılınır ve böylece silinmiş kayıtların kopyaları da ortadan kalkar.",
          "Bir yedeğin geri yüklenmesi gerekirse, geri yükleme sonrasında imha listesindeki kayıtlar için silme işlemleri derhâl yeniden uygulanır; bu işlem geri yükleme prosedürünün zorunlu bir adımı olarak tanımlanmıştır.",
          "Yedeklerden geri yükleme ve sonrasında yapılan yeniden imha işlemleri tutanağa ve olay kaydına yazılır.",
          "İlgili kişiye verilen yanıtta, verisinin aktif sistemlerden silindiği, yedeklerde kalan kopyaların ise yedek döngüsünün tamamlanmasıyla ortadan kalkacağı ve bu süre boyunca yedeklere erişimin nasıl kısıtlandığı açıkça belirtilir."
        ]
      },
      {
        "heading": "12. Veri İşleyenler ve Yurt Dışına Aktarım Hâlinde İmha",
        "paragraphs": [
          "Şirket, faaliyetlerini yürütmek için barındırma, veri tabanı, işlemsel e-posta gönderimi, ödeme, kargo, muhasebe ve müşteri iletişimi alanlarında hizmet sağlayıcılarla çalışır. Bu taraflar Şirketin talimatları doğrultusunda ve yalnızca sözleşmede belirlenen amaçlarla kişisel veri işleyebilir.",
          "Veri işleyenlerle akdedilen sözleşmelerde; verinin yalnızca talimat doğrultusunda işlenmesi, Kanunun veri güvenliğine ilişkin hükmü uyarınca uygun teknik ve idari tedbirlerin alınması, alt işleyen kullanımının önceden bildirime tabi olması, hizmetin sona ermesi hâlinde verilerin Şirkete iadesi veya imhası ve imhanın yazılı olarak teyit edilmesi yükümlülükleri yer alır.",
          "Barındırma, veri tabanı ve işlemsel e-posta hizmetlerinin sunucuları yurt dışında bulunabilir. Bu hâllerde aktarım, Kanunun kişisel verilerin yurt dışına aktarılmasına ilişkin hükmü çerçevesinde ve mevzuatın öngördüğü aktarım mekanizmalarına uygun olarak gerçekleştirilir. Aktarılan verilerin imhası, bu Politikadaki sürelere ve veri işleyenle akdedilen sözleşmeye göre yürütülür.",
          "Şirket, veri işleyenler nezdindeki saklama sürelerini yılda en az bir kez gözden geçirir; hizmet sözleşmesinin sona ermesi hâlinde en geç 30 gün içinde verilerin iadesini veya imhasını talep eder ve imha teyidini dosyalar.",
          "Kargo firmaları ile mali müşavir gibi kendi hukuki yükümlülükleri kapsamında veri işleyen taraflar, kendi süreçleri bakımından veri sorumlusu sıfatını taşıyabilir. Bu tarafların kendi saklama süreleri Şirketin bu Politikadaki sürelerinden bağımsızdır ve ilgili kişi, bu taraflara doğrudan başvurabilir."
        ]
      },
      {
        "heading": "13. Periyodik İmha",
        "paragraphs": [
          "Kanunda ve ilgili mevzuatta kişisel verinin işlenme şartlarının tamamının ortadan kalkması hâlinde, veriler bu Politikada belirlenen aralıklarla re'sen silinir, yok edilir veya anonim hâle getirilir. Periyodik imha süresi mevzuatın öngördüğü azami süreye uygun olarak altı ay olarak belirlenmiştir.",
          "Buna göre periyodik imha işlemleri her yıl Haziran ve Aralık aylarının son iş haftasında gerçekleştirilir. Periyodik imha, tüm kayıt ortamları için eşzamanlı olarak planlanır ve tek bir imha dönemi kapsamında raporlanır."
        ],
        "ordered": [
          "Hazırlık: İmha döneminden önce, saklama süresi dolan veri kümeleri veri tabanı sorguları ve ortam envanteri üzerinden listelenir; hakkında hukuki saklama kaydı bulunan kayıtlar listeden çıkarılır.",
          "Doğrulama: Listelenen her kayıt kümesi için saklamayı gerektiren başka bir hukuki sebebin bulunup bulunmadığı kontrol edilir; tereddüt hâlinde hukuki görüş alınmadan imha yapılmaz.",
          "Yöntem seçimi: Her veri kümesi için bu Politikanın dokuzuncu bölümünde sayılan yöntemlerden uygun olanı belirlenir ve gerekçesi yazılır.",
          "Uygulama: İmha işlemleri, yetkilendirilmiş personel tarafından ve yönetici hesabına tanımlı çok faktörlü kimlik doğrulama (TOTP) ile giriş yapılarak yürütülür.",
          "Kâğıt ve fiziki ortam: Aynı dönemde imha edilmesi gereken basılı belgeler evrak imha makinesinde yok edilir ve iki personelin imzasını taşıyan tutanağa bağlanır.",
          "Veri işleyen bildirimi: Aynı verilerin bulunduğu veri işleyenlere imha talimatı iletilir ve teyitleri dosyalanır.",
          "Raporlama: Dönem sonunda; imha edilen veri kategorileri, kayıt sayısı, uygulanan yöntem, işlemi yapan kişi ve tarih bilgilerini içeren periyodik imha raporu düzenlenir ve Politikanın uygulanmasından sorumlu kişi tarafından onaylanır.",
          "Gözden geçirme: Rapor üzerinden, saklama sürelerinin ve otomatik imha kurallarının yeterliliği değerlendirilir; gerekirse bu Politika güncellenir."
        ]
      },
      {
        "heading": "14. İlgili Kişinin Talebi Üzerine Silme veya Yok Etme",
        "paragraphs": [
          "İlgili kişi, Kanunun kendisine tanıdığı haklar çerçevesinde kişisel verilerinin silinmesini veya yok edilmesini talep edebilir. Başvuru, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğde öngörülen usullere uygun olarak yazılı biçimde {{ADDRESS}} adresine ya da sisteme kayıtlı e-posta adresi üzerinden {{EMAIL}} adresine iletilebilir.",
          "Başvuruda ad, soyad, imza veya elektronik imza, Türkiye Cumhuriyeti vatandaşları için T.C. kimlik numarası, tebligata esas adres, varsa bildirime esas elektronik posta adresi ve talebin konusu açıkça yer almalıdır. Kimliği doğrulanamayan başvurularda Şirket, kimlik teyidi için ek bilgi talep edebilir; bu talep, yanıt süresini keser ve teyidin sağlandığı tarihte süre yeniden işlemeye başlar."
        ],
        "ordered": [
          "Şirket, talebi niteliğine göre en kısa sürede ve her hâlde talebin kendisine ulaştığı tarihten itibaren en geç 30 gün içinde sonuçlandırır. İşlem ayrıca bir maliyet gerektirmedikçe ücret alınmaz; maliyet gerektiren hâllerde Kurulca belirlenen tarifedeki ücret uygulanır.",
          "Talebe konu kişisel verinin işlenme şartlarının tamamı ortadan kalkmışsa veri silinir, yok edilir veya anonim hâle getirilir; sonuç ilgili kişiye yazılı olarak veya elektronik ortamda bildirilir.",
          "Kişisel verinin işlenme şartlarından herhangi biri devam ediyorsa talep gerekçesi açıklanarak reddedilebilir; ret kararı en geç 30 gün içinde ve gerekçeli olarak ilgili kişiye bildirilir.",
          "Kısmi imha mümkünse talep tümüyle reddedilmez; saklanması zorunlu olmayan alanlar silinerek yalnızca hukuki yükümlülük kapsamındaki asgari veri muhafaza edilir. Örneğin üyelik hesabı kapatılırken sipariş ve fatura kayıtları mali mevzuat gereği saklanmaya devam eder, ancak pazarlama tercihleri, favori listesi ve serbest metin notlar silinir.",
          "Talebe konu veri üçüncü kişilere aktarılmışsa, imha işlemi bu kişilere de bildirilir ve aynı işlemi yapmaları için gerekli talimat verilir.",
          "Yalnızca açık rızaya dayanan işleme faaliyetlerinde rızanın geri alınması hâlinde işleme derhâl durdurulur; geri alma, o tarihe kadar hukuka uygun biçimde gerçekleştirilmiş işlemeleri geçersiz kılmaz.",
          "Başvurusunun reddedilmesi, verilen yanıtı yetersiz bulması veya süresinde yanıt verilmemesi hâlinde ilgili kişi, yanıtı öğrendiği tarihten itibaren otuz ve her hâlde başvuru tarihinden itibaren altmış gün içinde Kişisel Verileri Koruma Kuruluna şikâyette bulunabilir.",
          "Ticari elektronik ileti almak istemeyen ilgili kişiler, iletilerdeki ret bağlantısını, İleti Yönetim Sistemini veya {{EMAIL}} adresini kullanarak onaylarını geri alabilir; ret kaydı, tekrar ileti gönderilmemesini sağlamak amacıyla mevzuatta öngörülen süre boyunca saklanır."
        ]
      },
      {
        "heading": "15. İmha Kayıtlarının Tutulması, Loglanması ve Denetimi",
        "paragraphs": [
          "Şirket, sildiği, yok ettiği veya anonim hâle getirdiği kişisel verilere ilişkin işlemleri kayıt altına alır ve bu kayıtları, başka hukuki yükümlülükler saklı kalmak kaydıyla en az üç yıl süreyle muhafaza eder. İmha kayıtları da kişisel veri içerdiği ölçüde bu Politikadaki ilkelere tabidir ve asgari düzeyde bilgi barındıracak şekilde oluşturulur.",
          "Yönetim paneli üzerinden gerçekleştirilen tüm veri değişiklikleri, imha işlemleri dâhil olmak üzere değiştirilemez (append-only) olay kaydına yazılır. Olay kaydına yalnızca sahip (owner) yetkisine sahip hesaplar erişebilir; kayıtların silinmesi veya değiştirilmesi sistemsel olarak engellenmiştir."
        ],
        "bullets": [
          "İmha kaydında yer alan asgari bilgiler: işlem tarihi ve saati, veri kategorisi, kayıt sayısı, imha gerekçesi, uygulanan yöntem, işlemi gerçekleştiren kişi ve onaylayan kişi.",
          "Kâğıt ortamdaki imhalar için ayrıca iki personelin imzasını taşıyan imha tutanağı düzenlenir ve fiziki dosyada saklanır.",
          "Periyodik imha dönemleri sonunda dönem raporu hazırlanır; rapor, Politikanın uygulanmasından sorumlu kişi tarafından incelenerek onaylanır.",
          "İlgili kişi talebi üzerine yapılan imhalarda, başvuru, verilen yanıt ve imha kaydı aynı dosyada ilişkilendirilerek tutulur.",
          "Otomatik imha kuralları (kamera kayıtlarının üzerine yazılması, jeton sürelerinin dolması, çerez ömürleri) için sistem tarafından üretilen kayıtlar dönemsel olarak örnekleme yöntemiyle doğrulanır.",
          "Yılda en az bir kez iç denetim yapılır; denetimde saklama sürelerine uyum, imha kayıtlarının bütünlüğü, erişim yetkileri ve veri işleyen teyitleri kontrol edilir. Tespit edilen uygunsuzluklar için düzeltici faaliyet planı oluşturulur ve takip edilir.",
          "Kurul veya diğer yetkili makamlarca talep edilmesi hâlinde imha kayıtları ve denetim çıktıları ibraz edilir."
        ]
      },
      {
        "heading": "16. Teknik ve İdari Tedbirler",
        "paragraphs": [
          "Şirket, Kanunun veri güvenliğine ilişkin hükmü uyarınca kişisel verilerin hukuka aykırı olarak işlenmesini ve verilere hukuka aykırı erişilmesini önlemek ile verilerin muhafazasını sağlamak amacıyla uygun güvenlik düzeyini temin etmeye yönelik aşağıdaki tedbirleri uygular. Bu tedbirler, saklama süresi boyunca ve imha anına kadar kesintisiz olarak yürütülür."
        ],
        "bullets": [
          "Teknik: Tüm veri trafiğinin TLS ile şifrelenmesi ve internet sitesinin yalnızca güvenli bağlantı üzerinden sunulması.",
          "Teknik: Veri tabanında satır bazlı güvenliğin (RLS) etkin olması, tüm tablolarda varsayılan reddetme politikasının uygulanması ve veri erişiminin yalnızca sunucu tarafındaki servis anahtarıyla gerçekleşmesi.",
          "Teknik: Kullanıcı şifrelerinin bcrypt ile geri döndürülemez biçimde özetlenmesi; düz metin şifre saklanmaması ve şifre sıfırlama jetonlarının kısa ömürlü olması.",
          "Teknik: Yönetici erişiminin zaman tabanlı tek kullanımlık parola (TOTP) ile çok faktörlü kimlik doğrulamaya bağlanması ve oturum çerezlerinin HMAC ile imzalanması.",
          "Teknik: Yönetici giriş denemelerinde hız sınırlama ve geçici kilitleme uygulanması, başarısız denemelerin kaydedilmesi.",
          "Teknik: Rol tabanlı yetkilendirme (sahip, yönetici, personel) ile en az yetki ilkesinin uygulanması ve yetkilerin görev değişikliğinde derhâl güncellenmesi.",
          "Teknik: Yedeklerin şifreli tutulması, yedek geri yükleme testlerinin dönemsel olarak yapılması ve yedek erişiminin sınırlandırılması.",
          "Teknik: Ödeme adımında 3D Secure doğrulamasının kullanılması, kart verisinin PCI-DSS uyumlu ödeme kuruluşu ortamında işlenmesi ve Şirket sistemlerinde tam kart numarası ile güvenlik kodunun hiçbir aşamada saklanmaması.",
          "Teknik: Ödeme bildirimlerinin imza doğrulamasına tabi tutulması ve mükerrer işlemlerin benzersiz işlem referansı ile engellenmesi.",
          "Teknik: Kayıt ve günlüklerde kişisel verilerin maskelenmesi, hata izleme çıktılarında e-posta ve telefon bilgilerinin kısaltılması.",
          "Teknik: Yazılım bağımlılıklarının güncel tutulması, güvenlik yamalarının gecikmeksizin uygulanması ve kod değişikliklerinin otomatik denetimden geçirilmesi.",
          "İdari: Kişisel verilere erişen personelin gizlilik taahhütnamesi imzalaması ve iş sözleşmelerinde veri koruma yükümlülüklerine yer verilmesi.",
          "İdari: Kişisel veri envanterinin tutulması ve yeni bir işleme faaliyeti başlamadan önce hukuki sebebin, saklama süresinin ve imha yönteminin belirlenmesi.",
          "İdari: Personele düzenli veri koruma ve bilgi güvenliği farkındalık eğitimi verilmesi.",
          "İdari: Veri işleyenlerle yazılı sözleşme akdedilmesi ve bu sözleşmelerde imha yükümlülüğüne yer verilmesi.",
          "İdari: Veri ihlali durumunda uygulanacak müdahale planının hazır tutulması; ihlalin öğrenilmesinden itibaren mevzuatta öngörülen süre içinde Kurula ve ilgili kişilere bildirim yapılması.",
          "İdari: Fiziki ortamdaki belgelerin kilitli dolaplarda saklanması, kamera kayıt cihazının erişimi sınırlı alanda konumlandırılması ve iş yerine giriş kontrolünün sağlanması."
        ]
      },
      {
        "heading": "17. Sorumluluk ve Görev Dağılımı",
        "paragraphs": [
          "Politikanın uygulanmasında görev alan unvanlar ve sorumlulukları aşağıda gösterilmiştir. Şirketin organizasyon yapısındaki değişiklikler hâlinde görevler yeniden dağıtılır ve bu bölüm güncellenir. Sorumluluk dağılımı, Şirketin veri sorumlusu sıfatından doğan hukuki sorumluluğunu ortadan kaldırmaz."
        ],
        "table": [
          {
            "key": "Şirket yetkilisi (kanuni temsilci)",
            "value": "Politikanın hazırlanmasını, yürürlüğe konulmasını ve güncellenmesini onaylar; gerekli kaynakları tahsis eder; Kanun ve ilgili mevzuata uyumdan nihai olarak sorumludur."
          },
          {
            "key": "Politikanın uygulanmasından sorumlu kişi (veri koruma sorumlusu)",
            "value": "Saklama sürelerinin takibini, periyodik imha planının hazırlanmasını ve raporlanmasını yürütür; ilgili kişi başvurularını koordine eder; iç denetimi planlar ve düzeltici faaliyetleri izler."
          },
          {
            "key": "Bilgi teknolojileri / sistem yöneticisi",
            "value": "Kayıt ortamlarının güvenliğini sağlar; imha işlemlerinin teknik olarak uygulanmasından, yedekleme ve geri yükleme süreçlerinden, erişim yetkilerinin tanımlanması ve kaldırılmasından sorumludur."
          },
          {
            "key": "Yazılım geliştirme sorumlusu",
            "value": "Otomatik imha kurallarını, saklama sürelerini uygulayan iş kurallarını ve olay kaydı altyapısını geliştirir; yeni bir veri alanı eklenirken saklama süresi ve imha yönteminin tanımlanmasını sağlar."
          },
          {
            "key": "Müşteri hizmetleri sorumlusu",
            "value": "{{EMAIL}} adresine ve sosyal medya hesaplarına ulaşan talepleri kayda alır, ilgili kişi başvurularını veri koruma sorumlusuna yönlendirir, yanıtların süresinde iletilmesini takip eder."
          },
          {
            "key": "Mağaza ve kafe operasyon sorumlusu",
            "value": "Kâğıt ortamdaki belgelerin güvenli saklanmasını ve süresi dolanların imhasını sağlar; kamera kayıt cihazının saklama süresi ayarını ve fiziki erişim kontrolünü denetler."
          },
          {
            "key": "Muhasebe ve mali işler sorumlusu",
            "value": "Mali mevzuat kapsamında saklanması zorunlu belgelerin sürelerini takip eder; süresi dolan mali belgelerin imhasını veri koruma sorumlusuyla birlikte planlar."
          },
          {
            "key": "İnsan kaynakları sorumlusu",
            "value": "Çalışan ve çalışan adayı verilerinin saklama sürelerini yönetir; işe alım süreci sonuçlanan adayların verilerinin süresinde imhasını sağlar."
          },
          {
            "key": "Tüm çalışanlar ve ilgili kullanıcılar",
            "value": "Politikaya ve verilen talimatlara uygun hareket eder; saklama süresi dolan veya gereksiz hâle gelen verileri tespit ettiğinde veri koruma sorumlusuna bildirir; kişisel veriyi yetkisiz ortamlara kopyalamaz."
          }
        ]
      },
      {
        "heading": "18. Politikanın Güncellenmesi, Yürürlüğü ve Saklanması",
        "paragraphs": [
          "Bu Politika, {{SITE_URL}} adresinde yayımlandığı tarihte yürürlüğe girer ve yürürlükte kaldığı sürece Şirketin tüm birimlerini bağlar. Politika, yılda en az bir kez gözden geçirilir.",
          "Mevzuatta değişiklik olması, Kişisel Verileri Koruma Kurulunun ilke kararları veya rehberlerinde güncelleme yapılması, Şirketin iş süreçlerinin ya da kullandığı teknik altyapının değişmesi hâllerinde Politika gecikmeksizin güncellenir. Güncellenen metin aynı adreste yayımlanır ve yayım tarihi ile sürüm bilgisi metinde gösterilir.",
          "Politikanın eski sürümleri, hangi dönemde hangi kuralların uygulandığının ispatlanabilmesi amacıyla en az beş yıl süreyle elektronik ortamda arşivlenir. Sipariş kayıtlarında, ilgili siparişin verildiği tarihte yürürlükte olan belge sürümü ayrıca kayıt altına alınır.",
          "Politika hükümleri ile Kanun ve ilgili mevzuat arasında bir uyumsuzluk bulunması hâlinde mevzuat hükümleri uygulanır. Politikanın bir hükmünün geçersiz sayılması diğer hükümlerin geçerliliğini etkilemez.",
          "Politika hakkındaki soru ve talepler {{EMAIL}} adresine, {{PHONE}} numarasına ya da {{ADDRESS}} adresine iletilebilir."
        ]
      }
    ]
  },
  {
    "slug": "cerez-politikasi",
    "title": "Çerez Politikası",
    "shortTitle": "Çerez Politikası",
    "category": "Veri & Gizlilik",
    "summary": "{{SITE_URL}} adresinde kullanılan çerezleri ve benzer teknolojileri, her bir çerezin adını, amacını, süresini ve rıza gerektirip gerektirmediğini, rıza yönetimini ve tarayıcı bazında çerez silme yollarını açıklayan politikadır.",
    "references": [
      "6698 sayılı Kişisel Verilerin Korunması Kanunu (özellikle m.4 genel ilkeler, m.5-6 işleme şartları, m.9 yurt dışına aktarım, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliğine ilişkin yükümlülükler)",
      "Kişisel Verileri Koruma Kurumu - Çerez Uygulamaları Hakkında Rehber",
      "Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik",
      "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ",
      "Veri Sorumluları Sicili Hakkında Yönetmelik",
      "5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun ve ilgili yönetmelikleri (trafik bilgisi saklama yükümlülüğü)",
      "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun",
      "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İleti Yönetim Sistemi - İYS)",
      "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik",
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
      "Mesafeli Sözleşmeler Yönetmeliği (RG: 27.11.2014, 29188)",
      "6098 sayılı Türk Borçlar Kanunu",
      "6102 sayılı Türk Ticaret Kanunu (m.1524 internet sitesi)",
      "213 sayılı Vergi Usul Kanunu",
      "5464 sayılı Banka Kartları ve Kredi Kartları Kanunu",
      "6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun",
      "5846 sayılı Fikir ve Sanat Eserleri Kanunu",
      "6769 sayılı Sınai Mülkiyet Kanunu",
      "6100 sayılı Hukuk Muhakemeleri Kanunu"
    ],
    "sections": [
      {
        "heading": "1. Amaç, Kapsam ve Veri Sorumlusunun Kimliği",
        "paragraphs": [
          "Bu Çerez Politikası, {{BRAND}} markasıyla faaliyet gösteren {{LEGAL_NAME}} ({{SHORT_NAME}}) tarafından işletilen {{SITE_URL}} internet sitesinde ve bu site üzerinden sunulan çevrim içi mağaza (bottega) hizmetlerinde kullanılan çerezleri ve çerezlere benzer teknolojileri açıklamak amacıyla hazırlanmıştır.",
          "Politika, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 10. maddesinde düzenlenen aydınlatma yükümlülüğünün çerezlere ilişkin bölümünü, Kişisel Verileri Koruma Kurumu'nun Çerez Uygulamaları Hakkında Rehberi'nde öngörülen şeffaflık standardını ve 5651 sayılı Kanun ile 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun kapsamındaki bilgilendirme gerekliliklerini birlikte karşılamak üzere düzenlenmiştir.",
          "Politikanın kapsamı, {{SITE}} alan adı ve alt alan adları altında sunulan tüm sayfalar ile bu sayfalara gömülü üçüncü taraf içeriklerdir. {{BRAND}} sosyal medya hesaplarına ({{HANDLE}}) ait platformlarda, ilgili platformun kendi çerez politikası uygulanır; bu platformların çerez uygulamaları üzerinde {{SHORT_NAME}} belirleyici değildir.",
          "Bu Politika, {{SHORT_NAME}} tarafından yayımlanan Gizlilik Politikası ve KVKK Aydınlatma Metni ile birlikte okunmalıdır. Çerezler yoluyla elde edilen verilerin işlenmesine ilişkin genel esaslar bakımından anılan metinler; çerezlerin teknik ayrıntıları, süreleri ve rıza durumu bakımından ise işbu Politika esas alınır."
        ],
        "table": [
          {
            "key": "Veri sorumlusu (ticaret unvanı)",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Kısa unvan",
            "value": "{{SHORT_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Adres",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Vergi dairesi",
            "value": "{{TAX_OFFICE}}"
          },
          {
            "key": "Vergi kimlik numarası",
            "value": "{{TAX_NO}}"
          },
          {
            "key": "Vergi türü",
            "value": "{{TAX_TYPE}}"
          },
          {
            "key": "Faaliyet kodu (NACE)",
            "value": "{{NACE}}"
          },
          {
            "key": "Faaliyete başlama tarihi",
            "value": "{{STARTED_AT}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil numarası",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          }
        ]
      },
      {
        "heading": "2. Tanımlar",
        "paragraphs": [
          "Bu Politikada geçen teknik ve hukuki kavramlar aşağıdaki anlamları taşır."
        ],
        "bullets": [
          "Çerez (cookie): Ziyaret ettiğiniz internet sitesi tarafından tarayıcınız aracılığıyla cihazınıza (bilgisayar, telefon, tablet) yerleştirilen ve site tarafından sonradan okunabilen küçük metin dosyasıdır.",
          "Birinci taraf çerez: Doğrudan {{SITE}} alan adı tarafından yerleştirilen çerezdir.",
          "Üçüncü taraf çerez: Sayfaya gömülü bir hizmet sağlayıcının (ölçümleme, reklam, video oynatıcı, ödeme kuruluşu gibi) kendi alan adı üzerinden yerleştirdiği çerezdir.",
          "Oturum çerezi: Tarayıcı penceresi kapatıldığında veya oturum sona erdiğinde cihazdan otomatik olarak silinen çerezdir.",
          "Kalıcı çerez: Belirlenmiş bir sona erme tarihine kadar veya kullanıcı tarafından silinene kadar cihazda kalan çerezdir.",
          "Zorunlu (teknik) çerez: Sitenin çalışması, güvenliği ve talep ettiğiniz hizmetin sunulabilmesi için mutlaka gerekli olan, devre dışı bırakılması hâlinde hizmetin sunulamadığı çerezdir.",
          "İlgili kişi: Çerez yoluyla elde edilen kişisel verisi işlenen gerçek kişi, yani sitemizi ziyaret eden sizsiniz.",
          "Açık rıza: Belirli bir konuya ilişkin, bilgilendirmeye dayanan ve özgür iradeyle açıklanan rızadır.",
          "Çerez tercih merkezi: Zorunlu olmayan çerez kategorilerini kategori bazında açıp kapatabildiğiniz, sitede her zaman erişilebilir olan yönetim ekranıdır.",
          "Çerez envanteri: Sitede fiilen kullanılan çerezlerin adını, tarafını, amacını, türünü, süresini ve hukuki sebebini gösteren, düzenli olarak güncellenen listedir."
        ]
      },
      {
        "heading": "3. Çerezler Nasıl Çalışır ve Hangi Benzer Teknolojileri Kullanıyoruz",
        "paragraphs": [
          "Bir çerez, tarayıcınız ile sunucumuz arasındaki her istekte otomatik olarak taşınan küçük bir ad-değer çiftidir. Sunucu, bu değeri okuyarak aynı tarayıcının daha önce yaptığı işlemleri (örneğin oturum açtığınızı veya sepetinize ürün eklediğinizi) tanıyabilir. Çerezler tek başlarına adınızı, adresinizi veya kart bilgilerinizi içermez; taşıdıkları değer çoğunlukla rastgele üretilmiş bir kimlik ya da imzalı bir oturum belirtecidir.",
          "Çerezlerin yanı sıra, aynı veya benzer işlevleri gören başka teknolojiler de kullanılmaktadır. Bu Politikada 'çerez' ifadesi, aksi belirtilmedikçe aşağıdaki teknolojilerin tümünü kapsayacak şekilde kullanılmıştır ve bunlara da çerezlerle aynı rıza kuralları uygulanır."
        ],
        "bullets": [
          "localStorage: Tarayıcının kalıcı yerel depolama alanıdır. Sepetiniz {{SITE}} üzerinde laffogato_cart_v1 anahtarıyla localStorage'da tutulur; bu veri sunucuya çerez gibi otomatik gönderilmez, yalnızca tarayıcınızda saklanır ve siparişi tamamladığınızda temizlenir.",
          "sessionStorage: Yalnızca açık sekme yaşadığı sürece veri tutan geçici depolama alanıdır. Form adımları arasında geçici durum saklamak için kullanılabilir; sekme kapandığında silinir.",
          "IndexedDB ve önbellek (Cache Storage): Tarayıcının daha büyük hacimli verileri ve statik dosyaları saklamasını sağlayan alanlardır. Sayfaların hızlı açılması amacıyla teknik nitelikte kullanılabilir.",
          "Piksel / web işaretçisi (web beacon): Sayfaya veya e-postaya gömülen, görünmez ve çok küçük bir görsel isteğidir. Bir sayfanın görüntülendiğini veya bir e-postanın açıldığını ölçmek için kullanılır. Ölçümleme ve pazarlama pikselleri yalnızca açık rızanız hâlinde çalıştırılır.",
          "Yazılım geliştirme kiti (SDK) ve etiket (tag): Üçüncü taraf hizmet sağlayıcıların ölçümleme veya reklam işlevlerini siteye ekleyen JavaScript kod parçalarıdır. Rızaya tabi etiketler, siz ilgili kategoriye onay vermeden yüklenmez.",
          "Sunucu tarafı kayıtlar (log): Talebinizi karşılayan sunucunun tuttuğu erişim kayıtlarıdır. Bunlar teknik olarak çerez değildir; ancak IP adresi gibi verileri içerdiğinden bu Politikada şeffaflık amacıyla belirtilmektedir.",
          "Cihaz parmak izi (fingerprinting): Cihaz ve tarayıcı özelliklerinin birleştirilmesiyle kullanıcı tanımaya dayanan tekniklerdir. {{SHORT_NAME}}, pazarlama veya profilleme amacıyla cihaz parmak izi tekniği kullanmaz."
        ]
      },
      {
        "heading": "4. Çerezleri Hangi Amaçlarla Kullanıyoruz",
        "paragraphs": [
          "{{SHORT_NAME}}, çerezleri yalnızca aşağıda sayılan belirli, açık ve meşru amaçlarla kullanır. Bu amaçlar, 6698 sayılı Kanun'un 4. maddesinde yer alan amaçla bağlantılı, sınırlı ve ölçülü olma ilkesi gözetilerek belirlenmiştir."
        ],
        "ordered": [
          "Sitenin temel işlevlerinin çalıştırılması: sayfa yönlendirmeleri, dil ve görüntüleme tercihleri, form gönderimlerinin doğru sayfaya iletilmesi.",
          "Alışveriş sepetinin oluşturulması ve korunması: seçtiğiniz ürünlerin, adetlerin ve varyantların siz siteden ayrılıp döndüğünüzde kaybolmaması.",
          "Üyelik oturumunun sürdürülmesi: e-posta adresi doğrulanmış üye hesabınızla giriş yaptığınızda her sayfada yeniden şifre girmenize gerek kalmaması.",
          "Sipariş ve ödeme akışının güvenli biçimde tamamlanması: ödeme adımında sepet ile siparişin eşleştirilmesi, 3D Secure yönlendirmesinden dönüşte oturumun kaybolmaması.",
          "Güvenliğin sağlanması: siteler arası istek sahteciliğine (CSRF) karşı koruma, oturum çalınmasının önlenmesi, giriş denemelerinin sınırlanması ve yönetici paneline yetkisiz erişimin engellenmesi.",
          "Yönetici paneli erişiminin ve iki aşamalı doğrulama (TOTP 2FA) akışının yürütülmesi.",
          "Çerez tercihlerinizin hatırlanması: her ziyarette çerez bandını yeniden görmemeniz ve verdiğiniz onayın ispatlanabilmesi.",
          "İstatistiksel ölçümleme: hangi sayfaların ne kadar görüntülendiği, hangi adımlarda ayrılma yaşandığı, site hızının ve hataların izlenmesi gibi toplu analizlerle site deneyiminin iyileştirilmesi.",
          "Pazarlama ve yeniden hedefleme: ilgi alanlarınıza uygun {{BRAND}} tanıtımlarının üçüncü taraf platformlarda gösterilmesi ve reklam performansının ölçülmesi.",
          "Hukuki yükümlülüklerin yerine getirilmesi ve uyuşmazlıklarda ispat: 5651 sayılı Kanun kapsamındaki kayıt yükümlülükleri ile mesafeli satış sözleşmesinin onay kaydına ilişkin delillerin oluşturulması."
        ]
      },
      {
        "heading": "5. Süre Bazında Çerez Türleri: Oturum ve Kalıcı Çerezler",
        "paragraphs": [
          "Çerezler, cihazınızda kalma sürelerine göre iki gruba ayrılır. Bu ayrım, verinin ne kadar süreyle saklandığını ve çerezi silmediğiniz takdirde ne zaman kendiliğinden sona ereceğini gösterir."
        ],
        "bullets": [
          "Oturum çerezleri: Tarayıcınızı kapattığınızda otomatik olarak silinir. Sepetin ödeme adımıyla eşleştirilmesi, siteler arası istek sahteciliğine karşı üretilen tek kullanımlık belirteçler ve ödeme kuruluşunun 3D Secure yönlendirmesi sırasında kullandığı geçici çerezler bu gruptadır.",
          "Kalıcı çerezler: Belirlenen sona erme tarihine kadar veya siz silene kadar cihazınızda kalır. Üyelik oturumunun 30 gün boyunca açık kalması, çerez tercihinizin 12 ay hatırlanması ve ölçümleme kimliklerinin belirli süre boyunca aynı ziyaretçiyi tanıması bu gruba örnektir.",
          "Süre üst sınırı: {{SHORT_NAME}}, birinci taraf kalıcı çerezlerin süresini amaç için gerekli olan en kısa süreyle sınırlar. Zorunlu olmayan hiçbir birinci taraf çerezi 12 aydan uzun süreyle ayarlanmaz; rızanız 12 ayda bir yenilenmek üzere yeniden sorulur.",
          "Süre uzatma: Bir kalıcı çerezin süresi, siz siteyi yeniden ziyaret ettiğinizde ilgili çerezin niteliğine göre yenilenebilir. Bu durum, çerezin sizde kalma süresini fiilen uzatabileceğinden aşağıdaki envanter tablolarında ayrıca belirtilmiştir.",
          "Erken sona erme: Oturumunuzu kapattığınızda, şifrenizi değiştirdiğinizde veya güvenlik gerekçesiyle tüm oturumlar sonlandırıldığında, kalıcı oturum çerezleri süresi dolmadan geçersiz kılınır."
        ]
      },
      {
        "heading": "6. Kaynak Bazında Çerez Türleri: Birinci Taraf ve Üçüncü Taraf Çerezler",
        "paragraphs": [
          "Çerezler, kimin tarafından yerleştirildiğine göre de sınıflandırılır. Bu ayrım, verinin kime ulaştığı ve hangi politikanın uygulanacağı bakımından belirleyicidir.",
          "Birinci taraf çerezler doğrudan {{SITE}} tarafından yerleştirilir ve yalnızca {{SHORT_NAME}} tarafından okunur. Üçüncü taraf çerezler ise sayfaya gömülü hizmet sağlayıcı tarafından kendi alan adı üzerinden yerleştirilir; bu çerezlerin içeriğine ilgili sağlayıcı da erişebilir ve söz konusu sağlayıcı kendi işleme faaliyeti bakımından ayrıca veri sorumlusu olabilir."
        ],
        "bullets": [
          "Birinci taraf zorunlu çerezler: Yönetici ve üye oturum çerezleri, iki aşamalı doğrulama bekleme çerezi, CSRF koruma çerezi ve çerez tercih çerezi. Bunlar {{SITE}} alan adına aittir.",
          "Birinci taraf tercih çerezleri: Görüntüleme ve arayüz tercihlerinizi saklayan çerezlerdir.",
          "Üçüncü taraf ölçümleme çerezleri: Google Analytics 4 tarafından yerleştirilen çerezlerdir. Yalnızca 'Analitik' kategorisine onay verdiğinizde yüklenir.",
          "Üçüncü taraf pazarlama çerezleri: Meta (Facebook/Instagram) ve Google Ads tarafından yerleştirilen çerezlerdir. Yalnızca 'Pazarlama' kategorisine onay verdiğinizde yüklenir.",
          "Gömülü içerik çerezleri: Sayfaya gömülü video veya sosyal medya içerikleri (örneğin {{YOUTUBE}} veya {{IG}} üzerinden gelen içerikler) oynatıldığında ilgili platform kendi çerezlerini yerleştirebilir. Bu içerikler, rıza vermediğiniz sürece tıklamayla açılan bir örtü (placeholder) arkasında tutulur.",
          "Ödeme kuruluşu çerezleri: Ödeme adımında bankanın veya ödeme kuruluşunun 3D Secure sayfasına yönlendirildiğinizde, ilgili kuruluş kendi oturum ve sahtekârlık önleme çerezlerini yerleştirir. Bu çerezler işlemin güvenliği için zorunludur ve rızaya tabi değildir."
        ]
      },
      {
        "heading": "7. Amaç Bazında Çerez Kategorileri ve Rıza Kuralı",
        "paragraphs": [
          "Sitede kullanılan çerezler dört amaç kategorisine ayrılmıştır. Kategori ayrımı, çerez bandındaki ve tercih merkezindeki seçeneklerle birebir aynıdır; bir kategoriye verdiğiniz onay yalnızca o kategorideki çerezleri kapsar.",
          "Zorunlu çerezler dışındaki tüm kategoriler açık rızanıza tabidir ve siz onay vermeden hiçbir analitik veya pazarlama çerezi cihazınıza yerleştirilmez, hiçbir ölçümleme veya reklam etiketi çalıştırılmaz. Bu, Kişisel Verileri Koruma Kurumu'nun Çerez Uygulamaları Hakkında Rehberi'nde benimsenen yaklaşımın gereğidir."
        ],
        "table": [
          {
            "key": "Zorunlu (teknik) çerezler",
            "value": "Amaç: sitenin çalışması, oturum yönetimi, sepet, güvenlik ve talep ettiğiniz hizmetin sunulması. Rıza: gerekmez. Kapatılamaz. Hukuki sebep: 6698 sayılı Kanun m.5/2 kapsamında sözleşmenin kurulması ve ifası, hukuki yükümlülük ve veri sorumlusunun meşru menfaati."
          },
          {
            "key": "Tercih (işlevsellik) çerezleri",
            "value": "Amaç: arayüz, görüntüleme ve gösterim tercihlerinizin hatırlanması. Rıza: gerekir. Kapatılabilir. Hukuki sebep: açık rıza (6698 sayılı Kanun m.5/1)."
          },
          {
            "key": "Analitik (performans) çerezleri",
            "value": "Amaç: ziyaret istatistikleri, sayfa performansı ve hata ölçümü yoluyla site deneyiminin iyileştirilmesi. Rıza: gerekir. Kapatılabilir. Hukuki sebep: açık rıza (6698 sayılı Kanun m.5/1)."
          },
          {
            "key": "Pazarlama (hedefleme) çerezleri",
            "value": "Amaç: ilgi alanına dayalı reklam gösterimi, yeniden hedefleme ve reklam dönüşümlerinin ölçülmesi. Rıza: gerekir. Kapatılabilir. Hukuki sebep: açık rıza (6698 sayılı Kanun m.5/1)."
          }
        ]
      },
      {
        "heading": "8. Zorunlu (Teknik) Çerezler Envanteri",
        "paragraphs": [
          "Aşağıdaki çerezler sitenin çalışması için zorunludur ve rızaya tabi değildir. Bu çerezlerin tamamı birinci taraftır, yani {{SITE}} alan adına aittir. Oturum çerezleri httpOnly ve SameSite=Lax nitelikleriyle, üretim ortamında ise Secure bayrağıyla ayarlanır; bu sayede çerez değerine tarayıcıdaki betikler erişemez ve çerez yalnızca şifreli bağlantı üzerinden taşınır."
        ],
        "table": [
          {
            "key": "laffogato_admin_session",
            "value": "Amaç: yönetici panelinde oturumun sürdürülmesi ve yetkilendirme (rol bazlı erişim). Taraf: birinci taraf. Tür: kalıcı, HMAC ile imzalı ve httpOnly. Süre: 7 gün (çıkış yapıldığında derhal silinir). Rıza: gerekmez, zorunlu."
          },
          {
            "key": "laffogato_admin_pending_2fa",
            "value": "Amaç: yönetici girişinde iki aşamalı doğrulama (TOTP) kodu beklenirken geçici kimlik taşınması. Taraf: birinci taraf. Tür: kısa ömürlü, imzalı ve httpOnly. Süre: 5 dakika (kod doğrulanınca silinir). Rıza: gerekmez, zorunlu."
          },
          {
            "key": "laffogato_customer_session",
            "value": "Amaç: e-posta adresi doğrulanmış üye hesabıyla açtığınız oturumun sürdürülmesi; sipariş verme, sipariş geçmişi, adres defteri ve favori listesine erişim. Taraf: birinci taraf. Tür: kalıcı, imzalı ve httpOnly. Süre: 30 gün (çıkış yapıldığında silinir). Rıza: gerekmez, zorunlu."
          },
          {
            "key": "laffogato_cart_v1 (localStorage)",
            "value": "Amaç: alışveriş sepetinizdeki ürün, adet ve varyant bilgisinin saklanması. Taraf: birinci taraf. Tür: teknik olarak çerez değil, tarayıcı yerel depolaması; sunucuya otomatik gönderilmez. Süre: siz silene veya sipariş tamamlanana kadar. Rıza: gerekmez, zorunlu."
          },
          {
            "key": "laffogato_csrf",
            "value": "Amaç: form ve sunucu eylemlerinde siteler arası istek sahteciliğine (CSRF) karşı koruma sağlayan tek kullanımlık belirtecin taşınması. Taraf: birinci taraf. Tür: oturum çerezi, httpOnly. Süre: tarayıcı kapatıldığında silinir. Rıza: gerekmez, zorunlu."
          },
          {
            "key": "laffogato_cookie_consent",
            "value": "Amaç: çerez bandında yaptığınız kategori seçimlerinin ve onay tarihinin saklanması; onayın ispatı ve bandın her ziyarette yeniden gösterilmemesi. Taraf: birinci taraf. Tür: kalıcı. Süre: 12 ay (süre sonunda rıza yeniden sorulur). Rıza: gerekmez, zorunlu (rızanın yönetimi için gereklidir)."
          },
          {
            "key": "Ödeme kuruluşu oturum çerezleri",
            "value": "Amaç: 3D Secure doğrulaması ve ödeme oturumunun güvenliği; sahtekârlık önleme. Taraf: üçüncü taraf (banka veya ödeme kuruluşu, ödeme adımına yönlendirildiğinizde). Tür: oturum çerezi. Süre: ödeme işlemi süresince. Rıza: gerekmez, işlemin güvenliği için zorunlu."
          },
          {
            "key": "Barındırma ve yük dengeleme çerezleri",
            "value": "Amaç: isteğin doğru sunucuya yönlendirilmesi, hız ve erişilebilirliğin sağlanması (Vercel altyapısı). Taraf: birinci taraf niteliğinde teknik çerez. Tür: oturum çerezi. Süre: oturum süresi. Rıza: gerekmez, zorunlu."
          }
        ]
      },
      {
        "heading": "9. Tercih (İşlevsellik) Çerezleri Envanteri",
        "paragraphs": [
          "Tercih çerezleri sitenin çalışması için zorunlu değildir; yalnızca deneyiminizi kişiselleştirir. Bu kategoriye onay vermezseniz site tüm işlevleriyle çalışmaya devam eder, ancak seçimleriniz bir sonraki ziyarette hatırlanmaz."
        ],
        "table": [
          {
            "key": "laffogato_ui_prefs",
            "value": "Amaç: menü ve mağaza listelerinde seçtiğiniz sıralama, görünüm (ızgara/liste) ve benzeri arayüz tercihlerinin hatırlanması. Taraf: birinci taraf. Tür: kalıcı. Süre: 6 ay. Rıza: gerekir."
          },
          {
            "key": "laffogato_notice_dismissed",
            "value": "Amaç: kapattığınız duyuru, kampanya veya bilgilendirme şeridinin tekrar gösterilmemesi. Taraf: birinci taraf. Tür: kalıcı. Süre: 3 ay. Rıza: gerekir."
          },
          {
            "key": "laffogato_recent_viewed",
            "value": "Amaç: son incelediğiniz ürünlerin listelenmesi ve ilgili ürün önerilerinin sunulması. Taraf: birinci taraf, tarayıcı yerel depolaması. Süre: 90 gün. Rıza: gerekir."
          }
        ]
      },
      {
        "heading": "10. Analitik (Performans) Çerezleri Envanteri",
        "paragraphs": [
          "Analitik çerezler, sitenin nasıl kullanıldığını toplu ve istatistiksel düzeyde anlamamızı sağlar. Bu kategoriye onay vermediğiniz sürece Google Analytics 4 etiketi sayfaya hiç yüklenmez ve aşağıdaki çerezler cihazınıza yerleştirilmez.",
          "Analitik ölçümlemede IP adresi kısaltma (anonimleştirme) etkin tutulur, reklam kişiselleştirme sinyalleri kapalıdır ve ölçümleme verisi tek başına kimliğinizi belirlemek amacıyla kullanılmaz. Bu hizmet yurt dışında yerleşik bir sağlayıcı tarafından sunulduğundan, verinin yurt dışına aktarılması söz konusudur; ayrıntı için bu Politikanın 17. maddesine bakınız."
        ],
        "table": [
          {
            "key": "_ga",
            "value": "Amaç: ziyaretçilerin birbirinden ayırt edilmesi için rastgele bir istemci kimliği üretilmesi (Google Analytics 4). Taraf: üçüncü taraf. Tür: kalıcı. Süre: 24 aya kadar; her ziyarette yenilenebilir. Rıza: gerekir."
          },
          {
            "key": "_ga_<ölçüm kimliği>",
            "value": "Amaç: oturum durumunun ve oturum sayacının tutulması; hangi sayfaların hangi sırayla görüntülendiğinin ölçülmesi (Google Analytics 4 mülk bazlı çerez). Taraf: üçüncü taraf. Tür: kalıcı. Süre: 24 aya kadar. Rıza: gerekir."
          },
          {
            "key": "_gid",
            "value": "Amaç: ziyaretçilerin gün bazında ayırt edilmesi ve günlük kullanım istatistiklerinin üretilmesi. Taraf: üçüncü taraf. Tür: kalıcı. Süre: 24 saat. Rıza: gerekir."
          },
          {
            "key": "_gat / _gat_gtag_*",
            "value": "Amaç: ölçümleme isteklerinin hızının sınırlanması (throttling) ve sunucu yükünün azaltılması. Taraf: üçüncü taraf. Tür: kısa ömürlü. Süre: 1 dakika. Rıza: gerekir."
          },
          {
            "key": "Sayfa performansı ölçümü (piksel)",
            "value": "Amaç: sayfa yüklenme süresi, hata oranı ve altyapı performansının toplu olarak izlenmesi. Taraf: barındırma sağlayıcısı üzerinden. Tür: çerezsiz ölçüm veya kısa ömürlü tanımlayıcı. Süre: oturum süresi. Rıza: gerekir."
          }
        ]
      },
      {
        "heading": "11. Pazarlama (Hedefleme) Çerezleri Envanteri",
        "paragraphs": [
          "Pazarlama çerezleri, {{BRAND}} tanıtımlarının ilgi alanlarınıza uygun biçimde üçüncü taraf platformlarda gösterilmesi ve bu tanıtımların sonuç verip vermediğinin ölçülmesi amacıyla kullanılır. Bu kategoriye onay vermediğiniz sürece Meta ve Google Ads etiketleri sayfaya yüklenmez ve aşağıdaki çerezler yerleştirilmez.",
          "Pazarlama kategorisine verdiğiniz onay, ticari elektronik ileti (e-posta, SMS) almaya rıza göstermeniz anlamına gelmez. Ticari elektronik iletiler 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik uyarınca ayrıca alınan onaya dayanır ve İleti Yönetim Sistemi'ne (İYS) kaydedilir. İki onay birbirinden bağımsızdır ve ayrı ayrı geri alınabilir."
        ],
        "table": [
          {
            "key": "_fbp",
            "value": "Amaç: Meta (Facebook/Instagram) reklamlarında tarayıcının tanınması, yeniden hedefleme ve dönüşüm ölçümü. Taraf: üçüncü taraf (Meta). Tür: kalıcı. Süre: 3 aya kadar. Rıza: gerekir."
          },
          {
            "key": "_fbc",
            "value": "Amaç: bir Meta reklamına tıklayarak siteye geldiğinizde tıklama kimliğinin saklanması ve reklamın sonuçlandırdığı işlemin ölçülmesi. Taraf: üçüncü taraf (Meta). Tür: kalıcı. Süre: 3 aya kadar. Rıza: gerekir."
          },
          {
            "key": "_gcl_au",
            "value": "Amaç: Google Ads dönüşüm ölçümü; reklam tıklamasının satışa dönüşüp dönüşmediğinin belirlenmesi. Taraf: üçüncü taraf (Google). Tür: kalıcı. Süre: 90 güne kadar. Rıza: gerekir."
          },
          {
            "key": "IDE / test_cookie",
            "value": "Amaç: Google reklam ağında ilgi alanına dayalı reklam gösterimi ve reklam etkileşiminin ölçülmesi; tarayıcının çerez desteğinin sınanması. Taraf: üçüncü taraf (Google). Tür: kalıcı ve kısa ömürlü. Süre: 13 aya kadar / 15 dakika. Rıza: gerekir."
          },
          {
            "key": "_ttp",
            "value": "Amaç: {{HANDLE}} hesabı üzerinden yürütülen TikTok tanıtımlarında dönüşüm ölçümü ve yeniden hedefleme. Taraf: üçüncü taraf (TikTok). Tür: kalıcı. Süre: 13 aya kadar. Rıza: gerekir."
          },
          {
            "key": "VISITOR_INFO1_LIVE / YSC",
            "value": "Amaç: sayfaya gömülü YouTube videolarının oynatılması, oynatma tercihlerinin ve izleme istatistiklerinin tutulması. Taraf: üçüncü taraf (Google/YouTube). Tür: kalıcı / oturum. Süre: 6 aya kadar / oturum süresi. Rıza: gerekir (video örtüsüne tıklandığında yüklenir)."
          }
        ]
      },
      {
        "heading": "12. Rıza Yönetimi: Çerez Bandı ve Tercih Merkezi",
        "paragraphs": [
          "Siteyi ilk kez ziyaret ettiğinizde, sayfanın kullanımını engellemeyen bir çerez bandı gösterilir. Bant, zorunlu olmayan çerezleri kabul etmeniz, tümünü reddetmeniz veya kategori bazında seçim yapmanız için eşit görünürlükte seçenekler sunar. 'Tümünü kabul et' ve 'Tümünü reddet' seçenekleri aynı düzeyde, aynı tıklama sayısıyla ve birbirine denk vurguyla sunulur.",
          "Bant kapatılana veya bir seçim yapılana kadar zorunlu çerezler dışında hiçbir çerez yerleştirilmez, hiçbir üçüncü taraf etiketi yüklenmez. Bandı seçim yapmadan kapatmanız reddetme olarak değerlendirilir.",
          "Hiçbir kategori kutucuğu önceden işaretli gelmez. Sessiz kalma, bandı görmezden gelme veya sitede gezinmeye devam etme rıza sayılmaz. Rıza yalnızca ilgili kategoriyi bilinçli olarak açmanızla verilmiş olur.",
          "Verdiğiniz onayın kapsamı, tarihi ve politika sürümü kayıt altına alınır; bu kayıt yalnızca rızanın varlığının ispatı amacıyla tutulur ve pazarlama amacıyla kullanılmaz."
        ],
        "ordered": [
          "İlk girişte bant görüntülenir ve zorunlu olmayan çerezler beklemeye alınır.",
          "Kategori bazında seçim yapar veya toplu kabul ya da toplu ret seçeneklerinden birini işaretlersiniz.",
          "Seçiminiz laffogato_cookie_consent çerezine yazılır ve 12 ay boyunca hatırlanır.",
          "Onay verdiğiniz kategorilere ait etiketler ancak bu andan itibaren yüklenir; onay vermediğiniz kategoriler hiç çalıştırılmaz.",
          "Tercihinizi dilediğiniz zaman sitenin alt bilgi bölümündeki 'Çerez Tercihleri' bağlantısından açacağınız tercih merkezinden değiştirebilir, verdiğiniz onayı aynı kolaylıkla geri alabilirsiniz.",
          "Onayı geri aldığınızda ilgili kategorideki çerezler bir sonraki sayfa yüklemesinde çalıştırılmaz; daha önce cihazınıza yerleştirilmiş üçüncü taraf çerezleri ise tarayıcı ayarlarınızdan silinebilir.",
          "12 aylık sürenin sonunda veya çerez envanterinde esaslı bir değişiklik olduğunda rızanız yeniden sorulur."
        ]
      },
      {
        "heading": "13. Zorunlu Çerezler Neden Kapatılamaz ve Çerezleri Engellerseniz Ne Olur",
        "paragraphs": [
          "Zorunlu çerezler, talep ettiğiniz hizmetin sunulabilmesi için teknik zorunluluk taşıdığından tercih merkezinden kapatılamaz. Bu çerezler pazarlama, profilleme veya ilgi alanı çıkarımı amacıyla kullanılmaz; işlevleri oturum, sepet ve güvenlikle sınırlıdır.",
          "Zorunlu çerezleri tarayıcı ayarlarınızdan tümüyle engellemeniz teknik olarak mümkündür; ancak bu durumda site beklendiği gibi çalışmaz. Aşağıda, engellemenin doğuracağı somut sonuçlar sıralanmıştır."
        ],
        "bullets": [
          "Üye hesabınıza giriş yapamaz, giriş yapsanız bile bir sonraki sayfada oturumunuz düşer; siparişin yalnızca e-posta adresi doğrulanmış üye hesabıyla verilebildiği için sipariş veremezsiniz.",
          "Sepetinize eklediğiniz ürünler sayfa değiştirdiğinizde veya siteye yeniden girdiğinizde kaybolur.",
          "Ödeme adımında 3D Secure doğrulamasından döndüğünüzde işlem sepetinizle eşleştirilemez; ödeme tamamlanmaz veya tamamlanmış ödeme siparişe bağlanamaz.",
          "Güvenlik belirteçleri taşınamayacağı için formlar ve sunucu eylemleri güvenlik hatasıyla reddedilir; iletişim ve iade talepleri gönderilemez.",
          "Çerez tercihiniz saklanamayacağı için çerez bandı her ziyarette yeniden gösterilir.",
          "Yönetici paneline erişim ve iki aşamalı doğrulama akışı çalışmaz.",
          "Buna karşılık analitik ve pazarlama çerezlerini reddetmeniz hâlinde site tüm işlevleriyle normal biçimde çalışmaya devam eder; yalnızca istatistik üretimi ve reklam ölçümü yapılmaz. Bu tercihiniz nedeniyle hizmetten yararlanmanız kısıtlanmaz, size farklı fiyat veya koşul uygulanmaz."
        ]
      },
      {
        "heading": "14. Tarayıcı Üzerinden Çerezleri Silme ve Engelleme",
        "paragraphs": [
          "Çerez tercih merkezine ek olarak, cihazınızdaki çerezleri doğrudan tarayıcınızın ayarlarından da silebilir, belirli siteler için engelleyebilir veya tümünü reddedecek şekilde yapılandırabilirsiniz. Menü adları tarayıcı sürümüne göre farklılık gösterebilir; aşağıdaki yollar güncel sürümler için geçerlidir.",
          "Tarayıcıdan yapılan silme işlemi, bu Politika kapsamındaki çerezlerin yanında diğer sitelere ait çerezleri de siler ve oturumlarınızın kapanmasına yol açabilir. Silme işlemi geçmişte toplanmış verinin sağlayıcı nezdinde silinmesi anlamına gelmez; bu tür talepler için 19. maddedeki başvuru yolunu kullanınız."
        ],
        "bullets": [
          "Google Chrome (masaüstü): Sağ üstteki üç nokta menüsü, Ayarlar, Gizlilik ve güvenlik, Üçüncü taraf çerezler / Tarama verilerini temizle. Buradan çerezleri silebilir veya üçüncü taraf çerezlerini engelleyebilirsiniz.",
          "Apple Safari (macOS): Menü çubuğunda Safari, Ayarlar (Tercihler), Gizlilik sekmesi, Web sitesi verilerini yönet ile tek tek silme; Tüm tanımlama bilgilerini engelle seçeneğiyle tümünü reddetme.",
          "Apple Safari (iOS/iPadOS): Ayarlar uygulaması, Safari, Geçmişi ve Web Sitesi Verilerini Sil; ayrıca Gelişmiş bölümünden Web Sitesi Verileri ile site bazında silme.",
          "Mozilla Firefox: Sağ üstteki menü, Ayarlar, Gizlilik ve Güvenlik, Çerezler ve Site Verileri, Verileri Temizle veya Verileri Yönet. Gelişmiş İzlenme Koruması bölümünden engelleme düzeyini seçebilirsiniz.",
          "Microsoft Edge: Sağ üstteki üç nokta menüsü, Ayarlar, Çerezler ve site izinleri, Çerezleri ve site verilerini yönet ve sil; Gözatma verilerini temizle bölümünden toplu silme.",
          "Google Chrome (Android): Üç nokta menüsü, Ayarlar, Gizlilik ve güvenlik, Tarama verilerini temizle.",
          "Gizli sekme (özel gezinme): Bu modda oluşturulan çerezler pencere kapatıldığında silinir; ancak zorunlu çerezler de silineceğinden oturumunuz her seferinde sıfırlanır.",
          "Üçüncü taraf reklam tercihleri: Google reklam ayarları ve Meta reklam tercihleri sayfaları üzerinden ilgi alanına dayalı reklam gösterimini ayrıca sınırlandırabilirsiniz."
        ]
      },
      {
        "heading": "15. Do Not Track (DNT) ve Global Privacy Control (GPC) Sinyalleri",
        "paragraphs": [
          "Do Not Track (DNT), tarayıcının site sunucusuna izlenmek istemediğinize dair bir başlık göndermesini sağlayan eski bir mekanizmadır. DNT için sektörde ortak ve bağlayıcı bir standart oluşmadığından, birçok site bu sinyali yok saymaktadır.",
          "{{SHORT_NAME}}, zorunlu olmayan tüm çerezleri zaten açık rızaya bağladığından, DNT sinyali gönderip göndermediğinizden bağımsız olarak siz onay vermeden hiçbir analitik veya pazarlama çerezi çalıştırılmaz. Bu nedenle DNT açık olsun ya da olmasın, izlenmeme yönündeki tercihiniz fiilen korunmaktadır.",
          "Global Privacy Control (GPC), kişisel verinin satılmaması veya paylaşılmaması yönündeki tercihi makine tarafından okunabilir biçimde ileten daha yeni bir sinyaldir. Tarayıcınız veya eklentiniz GPC sinyali gönderiyorsa, {{SHORT_NAME}} bu sinyali analitik ve pazarlama kategorileri bakımından reddetme beyanı olarak yorumlar; bu kategoriler varsayılan olarak kapalı kalır ve çerez bandında da kapalı görüntülenir.",
          "GPC sinyaline rağmen tercih merkezinden bilinçli olarak bir kategoriyi açmanız hâlinde, sonradan yapılan bu açık seçim esas alınır. Dilediğiniz an aynı yerden tekrar kapatabilirsiniz."
        ]
      },
      {
        "heading": "16. Üçüncü Taraf Hizmet Sağlayıcılar ve Kendi Politikaları",
        "paragraphs": [
          "Sitede yer alan üçüncü taraf çerezler, ilgili hizmet sağlayıcının kontrolündedir. Bu sağlayıcılar topladıkları veriyi kendi belirledikleri amaçlarla da işleyebilir ve bu kapsamda ayrıca veri sorumlusu sıfatını taşıyabilir. {{SHORT_NAME}}, bu sağlayıcıların kendi platformlarındaki işleme faaliyetleri üzerinde belirleyici değildir.",
          "Aşağıda, sitede kullanılan veya kullanılabilecek üçüncü taraf hizmetleri ve bunların hangi kategoriye girdiği gösterilmiştir. Her bir sağlayıcının güncel gizlilik ve çerez politikasını kendi internet sitesinden inceleyebilirsiniz."
        ],
        "table": [
          {
            "key": "Google Analytics 4 (Google Ireland/LLC)",
            "value": "Kategori: analitik. Kullanılan çerezler: _ga, _ga_*, _gid, _gat. IP kısaltma etkin, reklam kişiselleştirme kapalı. Yalnızca açık rıza ile yüklenir."
          },
          {
            "key": "Google Ads (Google Ireland/LLC)",
            "value": "Kategori: pazarlama. Kullanılan çerezler: _gcl_au, IDE, test_cookie. Dönüşüm ölçümü ve yeniden hedefleme. Yalnızca açık rıza ile yüklenir."
          },
          {
            "key": "Meta Platforms (Facebook/Instagram)",
            "value": "Kategori: pazarlama. Kullanılan çerezler: _fbp, _fbc. {{IG}} hesabı üzerinden yürütülen tanıtımların ölçümü. Yalnızca açık rıza ile yüklenir."
          },
          {
            "key": "TikTok",
            "value": "Kategori: pazarlama. Kullanılan çerez: _ttp. {{TIKTOK}} hesabı üzerinden yürütülen tanıtımların ölçümü. Yalnızca açık rıza ile yüklenir."
          },
          {
            "key": "YouTube (Google)",
            "value": "Kategori: pazarlama/gömülü içerik. Kullanılan çerezler: VISITOR_INFO1_LIVE, YSC. {{YOUTUBE}} kanalından gömülen videolar için. Video örtüsüne tıklanmadan yüklenmez."
          },
          {
            "key": "Vercel (barındırma)",
            "value": "Kategori: zorunlu. Sitenin yayınlanması, yönlendirme ve performans. Teknik oturum çerezleri kullanılabilir."
          },
          {
            "key": "Supabase (veri tabanı altyapısı)",
            "value": "Kategori: zorunlu. Ürün, sipariş ve hesap verilerinin saklandığı PostgreSQL altyapısı; satır düzeyi güvenlik (RLS) etkindir. Tarayıcınıza doğrudan çerez yerleştirmez."
          },
          {
            "key": "Resend (işlemsel e-posta)",
            "value": "Kategori: zorunlu. Sipariş onayı, kargo bildirimi, şifre sıfırlama gibi işlemsel e-postaların gönderimi. Sitede çerez yerleştirmez; e-posta açılma ölçümü yapılıyorsa ilgili e-postada belirtilir."
          },
          {
            "key": "Ödeme kuruluşu / sanal POS",
            "value": "Kategori: zorunlu. 3D Secure doğrulaması ve ödeme oturumu. Kart bilgileriniz {{SHORT_NAME}} sunucularında saklanmaz; ödeme sayfası PCI-DSS uyumlu kuruluş tarafından sunulur."
          },
          {
            "key": "Kargo firmaları",
            "value": "Kategori: zorunlu. Yurtiçi Kargo, Aras Kargo ve İstanbul içi motokurye takip bağlantıları. Takip bağlantısına tıkladığınızda ilgili firmanın kendi çerez politikası uygulanır."
          }
        ]
      },
      {
        "heading": "17. Çerezler Yoluyla İşlenen Kişisel Veriler, Hukuki Sebepler ve Aktarım",
        "paragraphs": [
          "Çerezler yoluyla, kimliğinizi doğrudan açık etmeyen ancak kişisel veri niteliği taşıyabilecek bilgiler işlenir. Bu veriler, tek başına veya diğer verilerle birleştirildiğinde sizi belirlenebilir kılabileceğinden 6698 sayılı Kanun kapsamında değerlendirilir.",
          "Zorunlu çerezler bakımından hukuki sebep, 6698 sayılı Kanun'un 5. maddesinin ikinci fıkrasında yer alan bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olma, veri sorumlusunun hukuki yükümlülüğünü yerine getirmesi ve ilgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla veri sorumlusunun meşru menfaati şartlarıdır. Bu şartların varlığı hâlinde ayrıca açık rıza aranmaz.",
          "Tercih, analitik ve pazarlama çerezleri bakımından tek hukuki sebep, 6698 sayılı Kanun'un 5. maddesinin birinci fıkrası uyarınca alınan açık rızanızdır. Rızanızı vermemeniz veya sonradan geri almanız hiçbir olumsuz sonuç doğurmaz.",
          "Çerezler yoluyla elde edilen veriler, yurt dışında yerleşik ölçümleme ve reklam sağlayıcılarının sunucularına aktarılabilir. Bu aktarım, 6698 sayılı Kanun'un 9. maddesi çerçevesinde ve ilgili kategoriye verdiğiniz açık rızaya ya da Kanun'un öngördüğü uygun güvenceleri sağlayan aktarım araçlarına (standart sözleşme, taahhütname veya bağlayıcı şirket kuralları gibi) dayanılarak gerçekleştirilir. Analitik ve pazarlama kategorilerine onay vermediğinizde bu kapsamda yurt dışına aktarım yapılmaz.",
          "Kart numarası, son kullanma tarihi ve güvenlik kodu gibi ödeme bilgileri çerezlerle işlenmez, {{SHORT_NAME}} sunucularında saklanmaz ve doğrudan PCI-DSS uyumlu ödeme kuruluşunun ortamında işlenir."
        ],
        "bullets": [
          "İşlem güvenliği verileri: IP adresi, oturum kimliği, imzalı oturum belirteci, CSRF belirteci, erişim ve işlem kayıtları.",
          "Cihaz ve bağlantı verileri: tarayıcı türü ve sürümü, işletim sistemi, ekran çözünürlüğü, dil ve saat dilimi bilgisi.",
          "Kullanım verileri: görüntülenen sayfalar, sitede geçirilen süre, tıklanan bağlantılar, siteye hangi kaynaktan (arama, sosyal medya, reklam) geldiğiniz.",
          "Alışveriş verileri: sepete eklenen ürünler, adet ve varyantlar, ödeme adımına ilerleme, sipariş tamamlama ya da terk etme.",
          "Tercih verileri: çerez kategorisi seçimleriniz, onay tarihi, onay verdiğiniz politika sürümü ve arayüz tercihleri.",
          "Onay ispat verileri: mesafeli satış sözleşmesi ve ön bilgilendirme formu onayına ilişkin tarih, IP adresi, tarayıcı bilgisi ve belge sürümü. Bu kayıt, çerez değil sipariş kaydının bir parçasıdır ve ispat amacıyla tutulur.",
          "Pazarlama ölçüm verileri: reklam tıklama kimliği, dönüşüm olayı ve yeniden hedefleme kitlesi üyeliği (yalnızca açık rıza hâlinde)."
        ]
      },
      {
        "heading": "18. Saklama Süreleri ve İmha",
        "paragraphs": [
          "Çerezler ve çerezler yoluyla elde edilen veriler, işlendikleri amaç için gerekli olan süre boyunca ve ilgili mevzuatta öngörülen asgari saklama süreleri gözetilerek saklanır. Süre sonunda veriler, Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik uyarınca silinir, yok edilir veya anonim hâle getirilir.",
          "Saklama sürelerinin belirlenmesinde, 5651 sayılı Kanun kapsamındaki trafik bilgisi saklama yükümlülüğü, 213 sayılı Vergi Usul Kanunu ve 6102 sayılı Türk Ticaret Kanunu'ndaki defter ve belge saklama süreleri ile 6098 sayılı Türk Borçlar Kanunu'ndaki zamanaşımı süreleri esas alınır.",
          "İmha işlemleri periyodik imha dönemlerinde yerine getirilir; tarayıcınızdaki çerezler ise ilgili çerezin süresi dolduğunda tarayıcı tarafından otomatik olarak silinir."
        ],
        "table": [
          {
            "key": "Oturum çerezleri",
            "value": "Tarayıcı kapatıldığında veya oturum sonlandırıldığında silinir."
          },
          {
            "key": "Üye oturum çerezi",
            "value": "En çok 30 gün; çıkış yapıldığında veya şifre değiştirildiğinde derhal geçersiz kılınır."
          },
          {
            "key": "Yönetici oturum çerezi",
            "value": "En çok 7 gün; iki aşamalı doğrulama bekleme çerezi 5 dakika."
          },
          {
            "key": "Çerez tercih kaydı",
            "value": "12 ay; süre sonunda rıza yeniden sorulur. Onayın ispatına ilişkin kayıt, ispat menfaati sona erene kadar saklanır."
          },
          {
            "key": "Analitik veriler",
            "value": "En çok 14 ay; süre sonunda toplulaştırılmış istatistiğe dönüştürülür veya silinir."
          },
          {
            "key": "Pazarlama ölçüm verileri",
            "value": "İlgili sağlayıcının politikasına göre en çok 13 ay; onay geri alındığında yeniden hedefleme kitlesinden çıkarılırsınız."
          },
          {
            "key": "Sunucu erişim kayıtları (log)",
            "value": "5651 sayılı Kanun ve ilgili mevzuatta öngörülen süre boyunca saklanır."
          },
          {
            "key": "Sipariş ve fatura kayıtları",
            "value": "Vergi Usul Kanunu ve Türk Ticaret Kanunu uyarınca öngörülen defter ve belge saklama süresi boyunca saklanır."
          }
        ]
      },
      {
        "heading": "19. İlgili Kişinin Hakları ve Başvuru Yolu",
        "paragraphs": [
          "6698 sayılı Kanun'un 11. maddesi uyarınca, çerezler yoluyla işlenen kişisel verilerinize ilişkin olarak veri sorumlusu {{LEGAL_NAME}}'ye başvurarak aşağıdaki haklarınızı kullanabilirsiniz.",
          "Başvurunuzu Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'de öngörülen usule uygun olarak, kimliğinizi tevsik eden bilgilerle birlikte {{ADDRESS}} adresine yazılı olarak veya sistemimizde kayıtlı e-posta adresiniz üzerinden {{EMAIL}} adresine iletebilirsiniz. Başvurularınız, talebin niteliğine göre en kısa sürede ve her hâlde otuz gün içinde ücretsiz olarak sonuçlandırılır; işlemin ayrıca bir maliyet gerektirmesi hâlinde Kurulca belirlenen tarifedeki ücret alınabilir.",
          "Başvurunuzun reddedilmesi, verilen yanıtı yetersiz bulmanız veya süresinde yanıt verilmemesi hâlinde, yanıtı öğrendiğiniz tarihten itibaren otuz ve her hâlde başvuru tarihinden itibaren altmış gün içinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz."
        ],
        "ordered": [
          "Kişisel verilerinizin işlenip işlenmediğini öğrenme.",
          "Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme.",
          "Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme.",
          "Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme.",
          "Kişisel verilerinizin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme.",
          "Kanun'un 7. maddesinde öngörülen şartlar çerçevesinde kişisel verilerinizin silinmesini veya yok edilmesini isteme.",
          "Düzeltme, silme ve yok etme işlemlerinin kişisel verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme.",
          "İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme.",
          "Kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme.",
          "Açık rızaya dayanan çerez kategorileri bakımından rızanızı dilediğiniz an, hiçbir gerekçe göstermeksizin ve ücretsiz olarak geri alma."
        ]
      },
      {
        "heading": "20. Çerez Envanterinin Güncellenmesi ve Denetim",
        "paragraphs": [
          "Sitede kullanılan çerezlerin listesi sabit değildir; yeni bir hizmet eklenmesi, bir sağlayıcının çerez adını veya süresini değiştirmesi ya da bir hizmetin kullanımdan kaldırılması hâlinde envanter değişir.",
          "{{SHORT_NAME}}, çerez envanterini düzenli aralıklarla ve her hâlde yeni bir üçüncü taraf hizmetin devreye alınmasından önce gözden geçirir. Gözden geçirmede, sitede fiilen yerleştirilen çerezler taranır; envanterde yer almayan bir çerez tespit edilirse ya envantere işlenir ya da kaldırılır.",
          "Yeni bir analitik veya pazarlama hizmeti eklendiğinde, ilgili çerezler siz yeniden onay verene kadar çalıştırılmaz. Kategori yapısında veya rızanın kapsamında esaslı bir değişiklik olduğunda çerez bandı yeniden gösterilerek rızanız tazelenir.",
          "Zorunlu çerezlerdeki teknik değişiklikler (örneğin çerez adının veya süresinin değişmesi) rıza gerektirmez; ancak bu Politika güncellenerek şeffaflık sağlanır."
        ],
        "bullets": [
          "Envanter taraması: yeni sürüm yayımlanmadan önce sitede yerleştirilen çerezlerin tespiti ve listeyle karşılaştırılması.",
          "Sağlayıcı gözden geçirmesi: kullanılan üçüncü taraf hizmetlerin gizlilik ve aktarım koşullarının yeniden değerlendirilmesi.",
          "Süre denetimi: zorunlu olmayan çerezlerin süresinin 12 ayı aşmadığının doğrulanması.",
          "Rıza kaydı denetimi: onay kayıtlarının eksiksiz ve doğru tutulduğunun kontrolü.",
          "Değişiklik kaydı: yönetici tarafından yapılan tüm içerik ve yapılandırma değişikliklerinin değiştirilemez olay kaydına (audit log) yazılması."
        ]
      },
      {
        "heading": "21. Politikanın Yürürlüğü ve Değişiklikler",
        "paragraphs": [
          "Bu Çerez Politikası, {{SITE_URL}} adresinde yayımlandığı tarihte yürürlüğe girer ve yayımda kaldığı sürece geçerlidir.",
          "{{SHORT_NAME}}, mevzuat değişiklikleri, Kişisel Verileri Koruma Kurulu kararları, kullanılan teknolojilerin değişmesi veya hizmet kapsamının genişlemesi hâlinde bu Politikada değişiklik yapma hakkını saklı tutar. Güncel metin her zaman {{SITE_URL}} adresinde yayımlanır ve güncelleme tarihi metnin başında gösterilir.",
          "Politikanın önceki sürümleri, hangi tarihte hangi metnin geçerli olduğunun ispatı bakımından saklanır. Rızanızı hangi sürüm yürürlükteyken verdiğiniz onay kaydınıza yazılır.",
          "Bu Politikada yapılan değişiklikler, tüketici sıfatıyla sahip olduğunuz ve 6502 sayılı Tüketicinin Korunması Hakkında Kanun ile Mesafeli Sözleşmeler Yönetmeliği'nden doğan haklarınızı sınırlandıracak veya ortadan kaldıracak şekilde yorumlanamaz."
        ]
      },
      {
        "heading": "22. İletişim",
        "paragraphs": [
          "Çerez uygulamalarımıza, bu Politikaya veya kişisel verilerinize ilişkin her türlü soru, talep ve şikâyetinizi aşağıdaki iletişim kanallarından bize iletebilirsiniz. Talepleriniz aynı kanallar üzerinden ve Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'de öngörülen süreler içinde yanıtlanır.",
          "Sosyal medya hesaplarımız üzerinden ilettiğiniz mesajlar, ilgili platformun altyapısında işlendiğinden resmî başvuru kanalı olarak kabul edilmez; kişisel veri taleplerinizi lütfen e-posta veya posta yoluyla iletiniz."
        ],
        "table": [
          {
            "key": "Unvan",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Adres",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil numarası",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "Instagram",
            "value": "{{IG}} ({{HANDLE}})"
          },
          {
            "key": "TikTok",
            "value": "{{TIKTOK}} ({{HANDLE}})"
          },
          {
            "key": "YouTube",
            "value": "{{YOUTUBE}} ({{HANDLE}})"
          }
        ]
      }
    ]
  },
  {
    "slug": "ticari-elektronik-ileti",
    "title": "Ticari Elektronik İleti ve İYS Aydınlatması",
    "shortTitle": "Ticari İleti",
    "category": "Veri & Gizlilik",
    "summary": "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik uyarınca {{SHORT_NAME}}'nin ileti onayını nasıl aldığını, İleti Yönetim Sistemi kaydını, iletilerin zorunlu unsurlarını ve ücretsiz ret hakkınızı açıklar.",
    "references": [
      "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun",
      "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (RG: 15.07.2015, 29417)",
      "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik",
      "Ticaret Bakanlığı'nın İleti Yönetim Sistemi'ne (İYS) ilişkin düzenleme, tebliğ ve duyuruları",
      "6698 sayılı Kişisel Verilerin Korunması Kanunu (özellikle m.4 genel ilkeler, m.5-6 işleme şartları, m.9 yurt dışına aktarım, m.10 aydınlatma yükümlülüğü, m.11 ilgili kişinin hakları, m.12 veri güvenliğine ilişkin yükümlülükler)",
      "Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik",
      "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ",
      "Kişisel Verilerin Korunması Kurulu'nun ticari elektronik iletiler ve açık rızaya ilişkin kararları",
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
      "Mesafeli Sözleşmeler Yönetmeliği (RG: 27.11.2014, 29188)",
      "5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun",
      "6102 sayılı Türk Ticaret Kanunu (m.1524 internet sitesi yükümlülüğü)",
      "6098 sayılı Türk Borçlar Kanunu",
      "6100 sayılı Hukuk Muhakemeleri Kanunu (m.193 delil sözleşmesi)",
      "213 sayılı Vergi Usul Kanunu",
      "5846 sayılı Fikir ve Sanat Eserleri Kanunu",
      "6769 sayılı Sınai Mülkiyet Kanunu"
    ],
    "sections": [
      {
        "heading": "1. Amaç, Kapsam ve Tanımlar",
        "paragraphs": [
          "Bu aydınlatma metni, {{BRAND}} markası altında {{SITE_URL}} adresinde faaliyet gösteren {{LEGAL_NAME}} tarafından size gönderilen ticari elektronik iletilere ilişkin usul ve esasları açıklamak amacıyla hazırlanmıştır. Metin, 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ile Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik hükümleri esas alınarak düzenlenmiştir.",
          "Amacımız, hangi iletilerin onayınıza tabi olduğunu, hangilerinin devam eden üyelik ve sipariş ilişkiniz gereği zaten göndermek zorunda olduğumuz işlemsel bildirimler olduğunu, onayınızı hangi yöntemle aldığımızı, bu onayın İleti Yönetim Sistemi'ne nasıl kaydedildiğini ve dilediğiniz an hiçbir gerekçe göstermeksizin ve ücret ödemeksizin nasıl vazgeçebileceğinizi şeffaf biçimde ortaya koymaktır.",
          "Bu metin, {{SITE_URL}} adresinde yayımlanan Gizlilik ve Kişisel Verilerin Korunması Politikası, Üyelik Sözleşmesi, Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi ile birlikte bir bütün oluşturur. Ticari elektronik ileti onayı ile 6698 sayılı Kanun anlamındaki açık rıza birbirinden farklı hukuki kurumlardır; ikisi arasındaki ilişki bu metnin ilerleyen bölümlerinde ayrıca açıklanmaktadır.",
          "Metinde geçen temel kavramlar aşağıdaki anlamlarda kullanılmıştır."
        ],
        "bullets": [
          "Hizmet sağlayıcı: Elektronik ticaret faaliyetinde bulunan gerçek veya tüzel kişiyi, bu metin bakımından {{LEGAL_NAME}} şirketini ifade eder.",
          "Alıcı: Ticari elektronik iletinin gönderildiği gerçek veya tüzel kişiyi, yani siz üyemizi, ziyaretçimizi veya kurumsal müşterimizi ifade eder.",
          "Ticari elektronik ileti: Telefon, çağrı merkezleri, faks, otomatik arama makineleri, akıllı ses kaydedici sistemler, elektronik posta, kısa mesaj hizmeti gibi vasıtalar kullanılarak elektronik ortamda gerçekleştirilen ve ticari amaçlarla gönderilen veri, ses ve görüntü içerikli iletileri ifade eder.",
          "Onay: Alıcının, kendisine ticari elektronik ileti gönderilmesine ilişkin olumlu irade beyanını ifade eder.",
          "Ret bildirimi: Alıcının, kendisine ticari elektronik ileti gönderilmesini reddetme iradesini ortaya koyan beyanını ifade eder.",
          "İYS: Ticaret Bakanlığı düzenlemeleri kapsamında kurulan ve ticari elektronik ileti onay ile ret kayıtlarının tutulduğu ulusal İleti Yönetim Sistemi'ni ifade eder.",
          "İşlemsel bildirim: Devam eden üyelik, sipariş, ödeme, teslimat veya mevzuattan doğan bilgi verme yükümlülüğü kapsamında gönderilen ve ticari elektronik ileti sayılmayan bildirimleri ifade eder.",
          "Marka: {{LEGAL_NAME}} tarafından işletilen {{BRAND}} markasını ve bu marka altındaki kafe ile çevrim içi mağaza (bottega) faaliyetlerini ifade eder."
        ]
      },
      {
        "heading": "2. Hizmet Sağlayıcının Kimliği ve İletişim Bilgileri",
        "paragraphs": [
          "6563 sayılı Kanun ve ilgili yönetmelikler uyarınca, size ticari elektronik ileti gönderen hizmet sağlayıcının kimliğini açık ve anlaşılır biçimde bilmeniz gerekir. Gönderdiğimiz her ticari elektronik iletide aşağıdaki künye bilgileri yer alır; ayrıca bu bilgiler {{SITE_URL}} adresinde sürekli olarak erişilebilir durumda tutulur.",
          "İleti onayınıza, ret talebinize veya bu metne ilişkin her türlü soru ve başvurunuzu aşağıdaki iletişim kanallarından tarafımıza iletebilirsiniz."
        ],
        "table": [
          {
            "key": "Hizmet sağlayıcı ticaret unvanı",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Kısa unvan",
            "value": "{{SHORT_NAME}}"
          },
          {
            "key": "İşletilen marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Adres (tebligata esas)",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Vergi dairesi",
            "value": "{{TAX_OFFICE}}"
          },
          {
            "key": "Vergi kimlik numarası",
            "value": "{{TAX_NO}}"
          },
          {
            "key": "Vergi türü",
            "value": "{{TAX_TYPE}}"
          },
          {
            "key": "Faaliyet kodu (NACE)",
            "value": "{{NACE}}"
          },
          {
            "key": "Faaliyete başlama tarihi",
            "value": "{{STARTED_AT}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil numarası",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "Instagram",
            "value": "{{IG}}"
          },
          {
            "key": "TikTok",
            "value": "{{TIKTOK}}"
          },
          {
            "key": "YouTube",
            "value": "{{YOUTUBE}}"
          }
        ]
      },
      {
        "heading": "3. Ticari Elektronik İletinin Tanımı ve Kullandığımız Kanallar",
        "paragraphs": [
          "Ticari elektronik ileti, ticari amaçla ve elektronik ortamda gönderilen her türlü veri, ses veya görüntü içerikli iletidir. Bir iletinin ticari elektronik ileti sayılması için mutlaka doğrudan satış amacı taşıması gerekmez; markanın tanıtımını, bilinirliğini, itibarını veya ürün ve hizmetlerinin pazarlanmasını amaçlayan içerikler de bu kapsamdadır.",
          "{{BRAND}} olarak size gönderebileceğimiz ticari elektronik iletiler; yeni sezon kahve çekirdeği duyuruları, sınırlı üretim gelato ve yenilebilir kupa lansmanları, indirim ve promosyon kodu kampanyaları, tadım etkinliği ve atölye davetleri, sadakat programı bildirimleri, kişiye özel ürün önerileri ile bülten içeriklerinden oluşur.",
          "Aşağıdaki tabloda, mevzuat kapsamında ticari elektronik ileti sayılan kanallar ile bu kanalları fiilen kullanma durumumuz gösterilmiştir. Kullanmadığımız bir kanalı ileride devreye almamız hâlinde, o kanal için ayrıca onayınızı alır ve İYS kaydını buna göre güncelleriz.",
          "Sosyal medya hesaplarımız ({{HANDLE}}) üzerinden yaptığımız kamuya açık paylaşımlar, belirli bir alıcıya yönlendirilmediği sürece ticari elektronik ileti kapsamında değerlendirilmez. Ancak bu hesaplar üzerinden size özel gönderilen doğrudan mesajların ticari içerik taşıması hâlinde, aynı onay ve ret kuralları uygulanır."
        ],
        "table": [
          {
            "key": "Elektronik posta (e-bülten, kampanya postası)",
            "value": "Kullanılıyor - onay ve İYS kaydı zorunlu"
          },
          {
            "key": "Kısa mesaj (SMS)",
            "value": "Kullanılabilir - onay ve İYS kaydı zorunlu"
          },
          {
            "key": "Sesli arama ve çağrı merkezi araması",
            "value": "Kullanılabilir - onay ve İYS kaydı zorunlu"
          },
          {
            "key": "Anlık mesajlaşma uygulamaları üzerinden pazarlama mesajı",
            "value": "Kullanılabilir - onay ve İYS kaydı zorunlu"
          },
          {
            "key": "Otomatik arama makinesi ve akıllı ses kaydedici sistem",
            "value": "Kullanılmıyor"
          },
          {
            "key": "Faks",
            "value": "Kullanılmıyor"
          },
          {
            "key": "Site içi bildirim ve tarayıcı push bildirimi",
            "value": "Yalnızca ayrı ve açık tercih vermeniz hâlinde"
          },
          {
            "key": "Sosyal medya kamuya açık paylaşımları",
            "value": "Ticari elektronik ileti kapsamında değil"
          }
        ]
      },
      {
        "heading": "4. Ticari Elektronik İleti Sayılmayan Bildirimler (İşlemsel İletiler)",
        "paragraphs": [
          "Devam eden üyelik ve sipariş ilişkiniz kapsamında size gönderdiğimiz bazı bildirimler, mevzuat gereği ticari elektronik ileti sayılmaz. Bu bildirimler sözleşmenin ifası, mevzuattan doğan bilgi verme yükümlülüğü veya hesap güvenliğiniz için zorunlu olduğundan, ticari ileti onayınızı geri almış olsanız dahi gönderilmeye devam eder.",
          "Bu bildirimler pazarlama amacı taşımaz, kampanya veya tanıtım içeriği barındırmaz ve yalnızca ilgili işlemle sınırlı bilgi içerir. Aşağıda, {{BRAND}} çevrim içi mağazasında karşılaşacağınız işlemsel bildirimlerin kapsamlı listesi yer almaktadır."
        ],
        "ordered": [
          "Üyelik oluşturma sırasında gönderilen e-posta doğrulama ve hesap aktivasyon bağlantısı; siparişin yalnızca e-postası doğrulanmış hesapla verilebilmesi nedeniyle bu ileti zorunludur.",
          "Sipariş alındı ve sipariş onayı bildirimi ile sipariş özeti; ürün, adet, birim fiyat, kargo bedeli, vergi ve toplam tutar bilgilerini içerir.",
          "Ödeme sonucuna ilişkin bildirimler; başarılı tahsilat, başarısız işlem, ön provizyon, taksitlendirme bilgisi ve 3D Secure doğrulama süreçlerine ilişkin bilgilendirmeler.",
          "Kargo ve teslimat bildirimleri; gönderinin kargoya teslim edildiği bilgisi, takip numarası, taşıyıcı firma bilgisi ve İstanbul içi motokurye teslimatına ilişkin randevu bildirimleri.",
          "Sipariş durumu değişikliği bildirimleri; hazırlanıyor, kargoya verildi, teslim edildi, kısmi iptal, tamamen iptal ve iade süreçlerine ilişkin durum güncellemeleri.",
          "Cayma hakkının kullanılmasına ilişkin bildirimler; cayma bildiriminin alındığına dair teyit, iade kargo yönlendirmesi ve iade bedelinin ödeme aracına iadesine ilişkin bilgilendirme.",
          "İade, ücret iadesi ve chargeback süreçlerine ilişkin bildirimler ile bankaya veya ödeme kuruluşuna yapılan itiraz süreçlerine dair bilgilendirmeler.",
          "Hesap güvenliğine ilişkin bildirimler; şifre sıfırlama bağlantısı, şifre değişikliği uyarısı, iki aşamalı doğrulama kodları, yeni cihazdan giriş uyarısı ve şüpheli işlem bildirimleri.",
          "Fatura ve belge iletimi; 213 sayılı Vergi Usul Kanunu ve ilgili tebliğler uyarınca düzenlenen e-arşiv fatura veya faturanın elektronik ortamda iletilmesi.",
          "Sözleşme, politika ve hizmet koşullarında yapılan değişikliklerin duyurulması ile mevzuatın öngördüğü diğer bilgi verme yükümlülüklerinin yerine getirilmesi.",
          "Gıda güvenliği kaynaklı ürün geri çağırma, parti bazlı uyarı veya alerjen bilgisine ilişkin düzeltme bildirimleri.",
          "Müşteri hizmetlerine ilettiğiniz talep, soru veya şikâyete verilen yanıtlar ile başlattığınız bir sürece ilişkin geri dönüşler."
        ]
      },
      {
        "heading": "5. Onay Esası ve Onay Aranmayan Sınırlı Hâller",
        "paragraphs": [
          "Kural, onay esasıdır: {{LEGAL_NAME}}, önceden onayınızı almaksızın size ticari elektronik ileti göndermez. Onay alınmaksızın gönderim yapılabilecek hâller mevzuatta sınırlı sayıda düzenlenmiştir ve tarafımızca dar yorumlanır.",
          "Önemle belirtiriz ki, onay alınması amacıyla dahi olsa size ticari elektronik ileti gönderilmez. Onayınızı yalnızca sizinle hâlihazırda kurulmuş bir temas noktası üzerinden, örneğin üyelik formu veya sipariş akışı içinde talep ederiz.",
          "Aşağıdaki hâllerde mevzuat gereği ayrıca onay aranmaz. Ancak bu hâllerin hiçbiri, ret hakkınızı ortadan kaldırmaz."
        ],
        "ordered": [
          "Kendinizle iletişime geçilmesi amacıyla iletişim bilgilerinizi vermeniz hâlinde, temin ettiğiniz mal veya hizmetlere ilişkin değişiklik, kullanım ve bakıma yönelik iletiler için ayrıca onay aranmaz. Örneğin satın aldığınız bir kahve değirmeninin bakım talimatındaki güncelleme bu kapsamdadır.",
          "Devam eden abonelik, üyelik veya ortaklık durumu ile tahsilat, borç hatırlatma, bilgi güncelleme, satın alma ve teslimat veya benzeri durumlara ilişkin bildirimler için önceden onay alınması zorunlu değildir.",
          "İlgili mevzuatla hizmet sağlayıcıya getirilen bilgi verme yükümlülüğünün yerine getirilmesi amacıyla gönderilen iletiler onay kapsamı dışındadır.",
          "Alıcının esnaf veya tacir olması hâlinde, mevzuat uyarınca önceden onay alınmaksızın ticari elektronik ileti gönderilebilir. Bu durumda dahi ret hakkı saklıdır, iletide ret imkânı sunulur ve ilgili kayıt İYS üzerinde tutulur.",
          "Yukarıdaki istisnalar kapsamındaki bir iletiye kampanya, indirim, promosyon kodu veya tanıtım içeriği eklenmesi hâlinde, ileti bütün olarak ticari elektronik ileti niteliği kazanır ve onay şartına tabi olur. Bu nedenle işlemsel bildirimlerimizde pazarlama içeriğine yer verilmez.",
          "Onayın varlığını ispat yükü bize aittir. Onayın alındığını ispatlayamadığımız hiçbir alıcıya ticari elektronik ileti gönderilmez."
        ]
      },
      {
        "heading": "6. Onayın Alınma Yöntemi ve Geçerlilik Şartları",
        "paragraphs": [
          "Onayınızı yazılı olarak veya her türlü elektronik iletişim aracıyla alabiliriz. Uygulamada onay, ağırlıklı olarak {{SITE_URL}} adresindeki üyelik formu, sipariş akışı ve bülten kayıt alanı üzerinden elektronik ortamda alınmaktadır.",
          "Onay alma sürecimiz, mevzuatın aradığı geçerlilik şartlarını karşılayacak biçimde tasarlanmıştır. Onay kutucuğu hiçbir koşulda önceden işaretli gelmez; onay vermemeniz, üye olmanıza, sipariş vermenize veya ödeme adımını tamamlamanıza engel teşkil etmez.",
          "Aşağıda, geçerli bir onay için uyguladığımız kurallar sıralanmıştır."
        ],
        "ordered": [
          "Onay, olumlu irade beyanınızla alınır. Sessiz kalmanız, formu doldurmanız veya siteyi kullanmaya devam etmeniz onay sayılmaz.",
          "Onay kutucuğu ön işaretli olarak sunulmaz; kutucuğu bizzat işaretlemeniz gerekir. Onay kutucuğu, Üyelik Sözleşmesi, Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi onaylarından ayrı ve bağımsızdır.",
          "Ticari ileti onayı, hizmetin sunulması veya siparişin tamamlanması şartına bağlanmaz. Onay vermeyen kullanıcı da tüm ürün ve hizmetlerimizden aynı koşullarla yararlanır.",
          "Onay metninde, iletiyi gönderecek hizmet sağlayıcının ticaret unvanı ile marka adı, onayın kapsamı ve iletilerin hangi kanallardan gönderileceği açıkça belirtilir.",
          "Onayda adınız, soyadınız ve onay verdiğiniz iletişim bilgisi yer alır. Farklı kanallar için ayrı kutucuklar sunulur; e-posta onayı otomatik olarak SMS veya arama onayı sayılmaz.",
          "Fiziksel ortamda alınan onaylarda, onay verenin imzası aranır. Kafede doldurulan üyelik veya bülten formları bu kapsamdadır.",
          "Onay alınmak üzere size ticari elektronik ileti gönderilmez; onay talebi ayrı bir ticari ileti biçiminde iletilemez.",
          "Her onay için onay metninin sürüm numarası, onay tarihi ve saati, IP adresi, tarayıcı ve cihaz bilgisi ile onayın alındığı kanal sistemsel olarak kaydedilir. Bu kayıtlar 6100 sayılı Hukuk Muhakemeleri Kanunu anlamında delil niteliği taşır.",
          "Onay ve ret süreçlerine ilişkin tüm yönetici işlemleri, değiştirilemez olay kaydına (audit log) yazılır ve geriye dönük olarak denetlenebilir.",
          "Onay alındıktan sonra, gönderime başlamadan önce onay kaydı İYS'ye yüklenir ve İYS onayı bekleyen kayıtlara ileti gönderilmez."
        ]
      },
      {
        "heading": "7. Onayın Kapsamı, Kanal Ayrımı ve Süresi",
        "paragraphs": [
          "Verdiğiniz onay, yalnızca onay metninde belirtilen kapsam, gönderici ve kanallarla sınırlıdır. Onayın kapsamı tarafımızca tek taraflı olarak genişletilemez; kapsam dışına çıkan bir gönderim için yeni ve ayrı bir onay talep edilir.",
          "Onayın belirli bir geçerlilik süresi öngörülmemiştir; onay, tarafınızdan geri alınana veya ret bildiriminde bulunulana kadar geçerliliğini korur. Bununla birlikte, uzun süredir hiçbir iletimizle etkileşime girmeyen alıcılar için gönderim sıklığını kendiliğimizden azaltır ve gerektiğinde onayın devamını teyit etmenizi isteriz.",
          "Onayın kapsamına ve yönetimine ilişkin esaslar aşağıdadır."
        ],
        "bullets": [
          "Onay yalnızca {{LEGAL_NAME}} ve işlettiği {{BRAND}} markası adına geçerlidir; grup şirketi, iş ortağı, tedarikçi veya üçüncü kişi markalar adına gönderim yapılmaz.",
          "Her iletişim kanalı için ayrı onay alınır ve İYS üzerinde ayrı kayıt tutulur; e-posta onayınız SMS veya sesli arama için onay yerine geçmez.",
          "Onay kapsamındaki içerikler; yeni ürün ve sezon duyuruları, kampanya ve promosyon kodları, sepette bırakılan ürün hatırlatmaları, kişiye özel ürün önerileri, tadım ve atölye etkinlik davetleri, doğum günü ve yıl dönümü teklifleri ile sadakat programı bildirimleridir.",
          "Memnuniyet anketi ve geri bildirim talepleri, içeriğinde tanıtım veya teşvik unsuru bulunması hâlinde ticari elektronik ileti kabul edilir ve yalnızca onaylı alıcılara gönderilir.",
          "Üyeliğinizi sonlandırmanız hâlinde ticari ileti onayınız da sona erer ve İYS kaydı ret olarak güncellenir; bu işlem için ayrıca talepte bulunmanız gerekmez.",
          "Onayınızı kısmen daraltabilirsiniz; örneğin yalnızca e-posta bültenini sürdürüp SMS gönderimlerini kapatmanız mümkündür.",
          "İletişim bilgilerinizi güncellemeniz hâlinde onay, güncellenen bilgi bakımından yeniden teyit edilir ve İYS kaydı buna göre düzenlenir.",
          "Onay kapsamı ile 6698 sayılı Kanun kapsamındaki açık rızanız birbirinden bağımsızdır; birinin geri alınması diğerini kendiliğinden ortadan kaldırmaz, ancak her iki talebiniz de tarafımızca ayrı ayrı işleme alınır."
        ]
      },
      {
        "heading": "8. İleti Yönetim Sistemi (İYS) Nedir, Neden Vardır",
        "paragraphs": [
          "İleti Yönetim Sistemi (İYS), Ticaret Bakanlığı düzenlemeleri kapsamında kurulmuş, ticari elektronik ileti onay ve ret kayıtlarının merkezî olarak tutulduğu ulusal bir sistemdir. Hizmet sağlayıcılar, aldıkları onayları bu sisteme kaydetmek ve gönderim öncesinde alıcının onay durumunu buradan kontrol etmekle yükümlüdür.",
          "İYS'nin varlık amacı, onay ve ret süreçlerini alıcının kontrolüne vermek, izinsiz gönderimleri denetlenebilir kılmak ve uyuşmazlık hâlinde tarafsız bir kayıt kaynağı oluşturmaktır. Böylece hangi markaya hangi kanaldan izin verdiğinizi tek bir yerden görebilir, tümünü veya bir kısmını tek hamlede kapatabilirsiniz.",
          "{{LEGAL_NAME}} olarak İYS yükümlülüklerimizi eksiksiz yerine getiririz. İYS'ye erişiminizi, sistemin resmî internet sitesi (iys.org.tr), mobil uygulaması veya e-Devlet üzerinden sağlayabilirsiniz.",
          "İYS'nin size sağladığı imkânlar aşağıda özetlenmiştir."
        ],
        "bullets": [
          "Hangi markaların size hangi kanaldan (e-posta, SMS, arama) ileti gönderme iznine sahip olduğunu tek ekranda görüntüleyebilirsiniz.",
          "Dilediğiniz markanın iznini dilediğiniz an, gerekçe göstermeksizin ve ücret ödemeksizin kapatabilirsiniz.",
          "Tüm markaların izinlerini topluca kapatarak ticari elektronik ileti almayı bütünüyle durdurabilirsiniz.",
          "Daha önce kapattığınız bir izni yeniden açabilir, kanal bazında yeniden düzenleyebilirsiniz.",
          "Onay veya ret işlemlerinizin tarih ve kaynak bilgisini görebilir, itiraz hâlinde bu kaydı delil olarak kullanabilirsiniz.",
          "İYS üzerinde kaydı bulunmayan veya reddedilmiş bir alıcıya hizmet sağlayıcı tarafından gönderim yapılması mevzuata aykırıdır ve şikâyet konusudur.",
          "İYS'ye erişim ve izin yönetimi işlemleri alıcı bakımından ücretsizdir."
        ]
      },
      {
        "heading": "9. Onayların İYS'ye Yüklenmesi ve Alıcının İYS Üzerindeki Hakları",
        "paragraphs": [
          "Sizden aldığımız her ticari elektronik ileti onayı, mevzuatın öngördüğü süre ve usule uygun biçimde İYS'ye yüklenir. Yükleme sırasında onayın alındığı tarih, kanal ve kaynak bilgisi sisteme aktarılır.",
          "İYS'ye yüklenmemiş bir onaya dayanarak gönderim yapılmaz. Aynı şekilde, İYS üzerinde ret olarak görünen bir alıcıya, elimizdeki kayıt onaylı görünse dahi ticari elektronik ileti gönderilmez; çelişki hâlinde İYS kaydı esas alınır ve kendi kaydımız buna göre düzeltilir.",
          "İYS üzerindeki haklarınız ve bu haklara ilişkin işleyiş aşağıda sıralanmıştır."
        ],
        "ordered": [
          "Onayınızın İYS'ye yüklenmesinin ardından, sistem üzerinden {{BRAND}} markasına verdiğiniz izni görüntüleme hakkına sahipsiniz.",
          "Yüklenen onaya itiraz edebilirsiniz. İtiraz hâlinde, onayın alındığına ilişkin sistem kaydımızı (tarih, saat, IP adresi, kanal ve onay metni sürümü) size sunar ve talebiniz doğrultusunda kaydı düzeltiriz.",
          "İzninizi İYS üzerinden doğrudan reddedebilirsiniz. Bu işlem için bizimle iletişime geçmeniz gerekmez; ret bilgisi sistem üzerinden tarafımıza yansır.",
          "İYS üzerinden yapılan ret işleminin sonucu, kendi veri tabanımızdaki iletişim tercihlerinize otomatik olarak işlenir ve gönderim listelerinden çıkarılırsınız.",
          "Ret işleminizden sonra, işlemsel bildirimler dışında hiçbir ticari elektronik ileti almazsınız; işlemsel bildirimler ise üyelik ve sipariş ilişkinizin gereği olarak devam eder.",
          "İYS üzerinde ret durumunuz varken tarafımızca ticari elektronik ileti gönderildiğini tespit ederseniz, {{EMAIL}} adresine bildirmeniz hâlinde durumu inceler, gönderim kaydını sizinle paylaşır ve gerekli düzeltmeyi yaparız.",
          "İzninizi dilediğiniz zaman İYS üzerinden yeniden açabilirsiniz; bu durumda onay kaydı güncellenir ve gönderime yeniden başlanır."
        ]
      },
      {
        "heading": "10. Gönderim Öncesi Kontrol ve Gönderim Disiplini",
        "paragraphs": [
          "Her ticari elektronik ileti gönderimi öncesinde, alıcı listesi İYS üzerindeki güncel onay ve ret kayıtlarıyla karşılaştırılır. Bu kontrolü geçmeyen hiçbir adres veya numara gönderim listesine dâhil edilmez.",
          "Gönderim süreçlerimiz, hatalı veya izinsiz gönderim riskini en aza indirecek şekilde teknik ve idari tedbirlerle desteklenmiştir. Aşağıda uyguladığımız gönderim disiplini adımları yer almaktadır."
        ],
        "ordered": [
          "Gönderim listesi, sistemimizdeki iletişim tercihleri kaydı ile İYS kaydının kesişimi alınarak oluşturulur; iki kayıt arasında uyumsuzluk varsa alıcı listeden çıkarılır.",
          "Kanal bazlı ayrım uygulanır; yalnızca e-posta onayı bulunan alıcı SMS gönderim listesine hiçbir şekilde eklenemez.",
          "Ret bildirimleri, gönderim kuyruğu oluşturulduktan sonra dahi kuyruğa yeniden uygulanır; ret bildirimi sonrası gönderim başlamamış iletiler kuyruktan düşürülür.",
          "Gönderim öncesinde ileti içeriği, zorunlu unsurları taşıyıp taşımadığı bakımından kontrol listesiyle denetlenir; künye veya ret bağlantısı eksik olan ileti gönderime çıkarılamaz.",
          "Test gönderimleri yalnızca şirket kontrolündeki kurumsal adreslere yapılır; gerçek alıcı listeleri test amacıyla kullanılmaz.",
          "Toplu gönderim yetkisi sınırlı sayıda yöneticiye tanımlanmıştır; bu yetkiye sahip hesaplar iki aşamalı doğrulama (TOTP) ile korunur.",
          "Her gönderimin kim tarafından, ne zaman ve hangi listeye yapıldığı değiştirilemez olay kaydına yazılır.",
          "Gönderim altyapısında oluşan hatalar, geri dönen (bounce) adresler ve şikâyet bildirimleri düzenli olarak incelenir; geçersiz veya sürekli hata veren adresler listeden çıkarılır."
        ]
      },
      {
        "heading": "11. İletilerin İçeriği ve Zorunlu Unsurlar",
        "paragraphs": [
          "Gönderdiğimiz her ticari elektronik iletide, mevzuatın aradığı zorunlu unsurlar eksiksiz olarak yer alır. Bu unsurlar, iletiyi kimin gönderdiğini tereddütsüz anlamanızı ve dilerseniz tek adımda vazgeçmenizi sağlar.",
          "İleti içeriği, ürün ve hizmetlerimize ilişkin doğru, güncel ve yanıltıcı olmayan bilgi içerir. İletilerde kullanılan görsel, metin ve tasarımlar üzerindeki haklar 5846 sayılı Fikir ve Sanat Eserleri Kanunu ile 6769 sayılı Sınai Mülkiyet Kanunu kapsamında korunmaktadır.",
          "İletilerimizde bulunan zorunlu ve standart unsurlar aşağıdaki tabloda gösterilmiştir."
        ],
        "table": [
          {
            "key": "Gönderen ticaret unvanı",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Gönderen marka adı",
            "value": "{{BRAND}}"
          },
          {
            "key": "Vergi kimlik numarası",
            "value": "{{TAX_NO}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Adres",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "E-posta iletilerinde konu alanı",
            "value": "İletinin ticari nitelikte olduğunu ve içeriğini anlaşılır biçimde yansıtır; yanıltıcı konu başlığı kullanılmaz"
          },
          {
            "key": "SMS iletilerinde gönderen başlığı",
            "value": "Markayı tanıtan sabit gönderici başlığı kullanılır"
          },
          {
            "key": "Sesli aramalarda kimlik bildirimi",
            "value": "Konuşmanın başında hizmet sağlayıcının unvanı ve aramanın ticari amacı bildirilir"
          },
          {
            "key": "Ret imkânı",
            "value": "Her iletide ücretsiz ve kolay erişilebilir ret bağlantısı veya ret numarası bulunur"
          },
          {
            "key": "Promosyon ve kampanya bilgisi",
            "value": "İndirim oranı, geçerlilik süresi ve varsa asgari sepet tutarı gibi koşullar iletide açıkça belirtilir"
          },
          {
            "key": "Fiyat gösterimi",
            "value": "Tüm fiyatlar Türk lirası cinsinden ve KDV dâhil olarak gösterilir"
          }
        ]
      },
      {
        "heading": "12. Gönderim Sıklığı, Zamanlaması ve İçerik İlkeleri",
        "paragraphs": [
          "Ticari elektronik iletileri, alıcıyı rahatsız etmeyecek makul sıklık ve saatlerde göndermeyi ilke edindik. Amacımız gelen kutunuzu doldurmak değil, gerçekten ilgilenebileceğiniz içerikleri sınırlı sayıda iletmektir.",
          "Kişiselleştirme yaparken, profilleme sonucunda sizin aleyhinize sonuç doğuracak veya sizi manipüle edecek uygulamalardan kaçınırız. İlgi alanı temelli öneriler yalnızca alışveriş geçmişiniz ve açıkça belirttiğiniz tercihler üzerinden oluşturulur.",
          "Uyguladığımız içerik ve gönderim ilkeleri aşağıdadır."
        ],
        "bullets": [
          "E-posta bülteni gönderimi olağan koşullarda ayda birkaç iletiyi aşmaz; yoğun kampanya dönemlerinde dahi makul sınırlar korunur.",
          "SMS ve sesli arama, yalnızca gerçekten önemli ve zamana duyarlı duyurular için kullanılır; gece saatlerinde SMS gönderimi ve arama yapılmaz.",
          "İletilerde acil karar vermeye zorlayan, gerçek dışı kıtlık veya süre baskısı yaratan ifadeler kullanılmaz.",
          "Kampanya koşulları eksiksiz belirtilir; indirimin geçerli olduğu ürün grubu, süre ve varsa asgari sepet tutarı iletide gösterilir.",
          "Karşılaştırmalı fiyat gösterimlerinde, indirim öncesi fiyat gerçekten uygulanmış fiyattır; yanıltıcı indirim gösterimi yapılmaz.",
          "Gıda ürünlerine ilişkin iletilerde, ürünün içerik ve alerjen bilgisine ulaşılabilecek ürün sayfasına bağlantı verilir; sağlık beyanı niteliğinde ifadelere yer verilmez.",
          "Kafe ve etkinlik davetlerinde tarih, saat, adres ve varsa katılım bedeli açıkça belirtilir.",
          "İletiler yalnızca Türkçe olarak gönderilir ve okunabilir, sade bir dil kullanılır.",
          "Ret talebinizin ardından, teknik gönderim kuyruğu nedeniyle çok kısa bir süre içinde ulaşabilecek son bir ileti dışında hiçbir ticari ileti gönderilmez."
        ]
      },
      {
        "heading": "13. Ret Hakkı: Ücretsiz, Kolay ve Gerekçesiz Vazgeçme",
        "paragraphs": [
          "Ticari elektronik ileti almayı reddetme hakkınız mevzuattan doğan vazgeçilmez bir haktır. Bu hakkı kullanmanız için herhangi bir gerekçe göstermeniz gerekmez, sizden hiçbir ad altında ücret talep edilmez ve hakkınızı kullanmanız zorlaştırılamaz.",
          "Daha önce onay vermiş olmanız, bu hakkınızı ortadan kaldırmaz. Onay alınmaksızın gönderim yapılabilen sınırlı hâllerde dahi, örneğin esnaf ve tacir alıcılar bakımından, ret hakkınız aynen geçerlidir.",
          "Ret hakkınıza ilişkin temel ilkeler aşağıda sıralanmıştır."
        ],
        "ordered": [
          "Ret bildiriminde bulunmak ücretsizdir. Ret için ücretli hat, ilave işlem bedeli veya abonelik şartı öngörülmez; yalnızca SMS ile ret gönderiminde operatörünüzün standart mesaj ücreti geçerli olabilir.",
          "Ret için gerekçe belirtmeniz istenmez. Ret ekranında gerekçe sorulması hâlinde bu alan zorunlu değildir ve boş bırakılabilir.",
          "Ret imkânı her ticari elektronik iletide yer alır; ret bağlantısı iletinin kolayca görülebilecek bir bölümünde ve okunabilir biçimde sunulur.",
          "Ret bağlantısına tıklamanız, hesabınıza giriş yapmanızı, şifre girmenizi veya ilave form doldurmanızı gerektirmez.",
          "Ret bildiriminin tarafımıza ulaşmasını takip eden üç iş günü içinde size ticari elektronik ileti gönderimi durdurulur.",
          "Ret talebiniz kanal bazında verilebilir; yalnızca SMS almayı reddedip e-posta bültenini sürdürmeniz mümkündür.",
          "Ret talebinizin ardından hesabınız kapatılmaz, üyeliğiniz sona ermez ve sipariş geçmişinizle diğer üyelik haklarınız aynen devam eder.",
          "Ret talebiniz, siparişleriniz ve hesabınızla ilgili işlemsel bildirimleri kapsamaz; bu bildirimler sözleşmenin ifası ve hesap güvenliğiniz için gönderilmeye devam eder.",
          "Ret talebinizin işleme alındığına dair bir teyit bildirimi tarafınıza iletilebilir; bu teyit ticari içerik taşımaz.",
          "Ret hakkınızı kullanmanız nedeniyle size farklı fiyat uygulanmaz, kampanyalardan yararlanmanız engellenmez ve hizmet kalitesinde ayrım yapılmaz."
        ]
      },
      {
        "heading": "14. Ret Bildirim Kanalları ve Üç İş Günü Kuralı",
        "paragraphs": [
          "Ret bildiriminizi aşağıdaki kanallardan dilediğiniz biriyle iletebilirsiniz. Hangi kanalı seçerseniz seçin, bildiriminiz aynı kayıt altına alınır ve aynı sürede işleme konulur.",
          "Ret bildiriminizin tarafımıza ulaştığı an sistemsel olarak kaydedilir. Bildirimin ulaşmasını takip eden üç iş günü içinde gönderim durdurulur; uygulamada bu işlem çoğunlukla aynı gün içinde tamamlanır. Üç iş günü hesabında hafta sonu ve resmî tatiller dikkate alınmaz.",
          "Ret bildiriminizin sonucunu, İYS üzerinden {{BRAND}} markasına ilişkin izin durumunuzu görüntüleyerek her zaman teyit edebilirsiniz. Gönderimin durmadığını fark etmeniz hâlinde {{EMAIL}} adresine bildirmeniz yeterlidir."
        ],
        "table": [
          {
            "key": "İleti içindeki ret bağlantısı",
            "value": "E-posta iletilerinin alt bölümünde yer alan abonelikten çık bağlantısına tıklamanız yeterlidir; giriş yapmanız veya form doldurmanız gerekmez"
          },
          {
            "key": "SMS ile ret",
            "value": "Gönderilen kısa mesajda belirtilen numaraya RET yazıp göndermeniz yeterlidir; operatörünüzün standart mesaj ücreti dışında bedel alınmaz"
          },
          {
            "key": "İYS üzerinden ret",
            "value": "İYS'nin resmî internet sitesi (iys.org.tr), mobil uygulaması veya e-Devlet üzerinden marka ve kanal bazında izin kapatabilirsiniz"
          },
          {
            "key": "Üyelik paneli",
            "value": "{{SITE_URL}} adresindeki hesabınızın iletişim tercihleri bölümünden kanal bazlı olarak kapatabilirsiniz"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "Posta / şahsen başvuru",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Sesli aramalarda ret",
            "value": "Arama sırasında sözlü olarak bildirmeniz yeterlidir; bildirim çağrı kaydına işlenir"
          },
          {
            "key": "İşleme alma süresi",
            "value": "Ret bildiriminin ulaşmasını takip eden üç iş günü içinde gönderim durdurulur"
          },
          {
            "key": "Ücret",
            "value": "Ret bildirimi ücretsizdir"
          }
        ]
      },
      {
        "heading": "15. Onay, Ret ve Gönderim Kayıtlarının Tutulması ve Saklanması",
        "paragraphs": [
          "Onayın alındığını ispat yükümlülüğü hizmet sağlayıcı olarak bize aittir. Bu nedenle onay, ret ve gönderim kayıtlarını mevzuatın öngördüğü süre ve kapsamda, güvenli biçimde saklarız.",
          "Kayıtlar, gerektiğinde Ticaret Bakanlığı'na sunulmak üzere muhafaza edilir. Saklama süresi dolan kayıtlar, {{SITE_URL}} adresinde yayımlanan Kişisel Veri Saklama ve İmha Politikası uyarınca periyodik imha süreçlerinde silinir, yok edilir veya anonim hâle getirilir.",
          "Kayıtlar üzerinde tutulan veriler ve saklama esasları aşağıdaki tabloda özetlenmiştir."
        ],
        "table": [
          {
            "key": "Onay kaydı içeriği",
            "value": "Ad, soyad, onay verilen iletişim bilgisi, onay kanalı, onay metni sürümü, onay tarihi ve saati, IP adresi, tarayıcı ve cihaz bilgisi"
          },
          {
            "key": "Onay kaydı saklama süresi",
            "value": "Onayın geçerli olduğu süre boyunca; onayın geri alınması hâlinde geri alma tarihinden itibaren mevzuatta öngörülen süre (asgari bir yıl)"
          },
          {
            "key": "Ret kaydı içeriği",
            "value": "Ret bildiriminin ulaştığı tarih ve saat, ret kanalı, reddedilen iletişim kanalı ve ret talebinin işleme alındığı zaman"
          },
          {
            "key": "Ret kaydı saklama süresi",
            "value": "Ret tarihinden itibaren mevzuatta öngörülen süre (asgari bir yıl); ret bilgisinin tekrar gönderimi önlemek amacıyla kalıcı tutulan bölümü asgari düzeydedir"
          },
          {
            "key": "Gönderim kaydı içeriği",
            "value": "İletinin içeriği, gönderim tarihi ve saati, gönderilen kanal, alıcı adresi ve teslim durumu"
          },
          {
            "key": "Gönderim kaydı saklama süresi",
            "value": "Gerektiğinde Bakanlığa sunulmak üzere mevzuatta öngörülen süre (asgari bir yıl)"
          },
          {
            "key": "İYS senkronizasyon kaydı",
            "value": "Onay ve ret kayıtlarının İYS'ye yüklenme ve İYS'den okunma zamanları ile sonuç bilgisi"
          },
          {
            "key": "Yönetici işlem kaydı",
            "value": "Liste oluşturma, gönderim başlatma, onay veya ret kaydı düzeltme işlemleri değiştirilemez olay kaydına yazılır"
          },
          {
            "key": "Kayıtların hukuki niteliği",
            "value": "6100 sayılı Hukuk Muhakemeleri Kanunu m.193 kapsamında delil niteliğindedir"
          }
        ]
      },
      {
        "heading": "16. Kişisel Verilerin İşlenmesi, Açık Rıza ve İleti Onayı İlişkisi",
        "paragraphs": [
          "Ticari elektronik ileti gönderimi, aynı zamanda kişisel verilerinizin işlenmesi anlamına gelir. Bu nedenle süreç, 6563 sayılı Kanun'un yanı sıra 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında da yürütülür. {{LEGAL_NAME}}, bu süreçte veri sorumlusu sıfatını taşır.",
          "6563 sayılı Kanun kapsamındaki ileti onayı ile 6698 sayılı Kanun kapsamındaki açık rıza birbirinden farklı hukuki kurumlardır. İleti onayı, iletinin gönderilebilmesinin şartıdır; açık rıza ise pazarlama amacıyla kişisel verinizin işlenmesinin hukuki sebebidir. Bu nedenle onay ve açık rıza, sipariş veya üyelik akışında ayrı ayrı ve bağımsız kutucuklarla alınır; hiçbiri diğerinin yerine geçmez.",
          "Ticari elektronik ileti sürecinde işlenen kişisel verileriniz, işleme amaçları ve haklarınıza ilişkin ayrıntılar {{SITE_URL}} adresinde yayımlanan Gizlilik ve Kişisel Verilerin Korunması Politikası ile Veri Sahibi Başvuru Formu metinlerinde yer alır.",
          "Bu kapsamda dikkate almanız gereken hususlar aşağıdadır."
        ],
        "bullets": [
          "İşlenen veriler: ad, soyad, e-posta adresi, cep telefonu numarası, onay ve ret kayıtları, gönderim ve etkileşim kayıtları ile alışveriş geçmişine dayalı ilgi alanı bilgileridir.",
          "İşleme amaçları: pazarlama iletişimi yürütmek, kampanya ve etkinlik duyurusu yapmak, içeriği ilgi alanınıza göre kişiselleştirmek ve mevzuattan doğan kayıt tutma yükümlülüklerini yerine getirmektir.",
          "Hukuki sebepler: pazarlama amaçlı işleme bakımından açık rızanız, kayıtların saklanması bakımından hukuki yükümlülüğün yerine getirilmesidir.",
          "Açık rızanızı dilediğiniz an geri alabilirsiniz; geri alma, geri alma anına kadar gerçekleştirilen işlemelerin hukuka uygunluğunu etkilemez.",
          "Açık rızanızın geri alınması hâlinde pazarlama amaçlı veri işlenmesi durdurulur; ancak ispat ve mevzuata uyum amacıyla tutulan onay ve ret kayıtları saklama süresi boyunca korunur.",
          "6698 sayılı Kanun'un 11. maddesindeki haklarınızı (bilgi talep etme, düzeltme, silme, aktarım yapılan üçüncü kişileri öğrenme, itiraz ve zararın giderilmesini talep etme) kullanmak için {{EMAIL}} adresine veya {{ADDRESS}} adresine başvurabilirsiniz.",
          "Başvurularınız, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca en geç otuz gün içinde sonuçlandırılır.",
          "Yalnızca ticari ileti almak istemiyorsanız, kişisel verilerinizin tümüyle silinmesini talep etmenize gerek yoktur; ret bildirimi bu amaç için yeterlidir ve daha hızlı sonuç verir."
        ]
      },
      {
        "heading": "17. Gönderim Altyapısı, Aktarım ve Veri Güvenliği",
        "paragraphs": [
          "Ticari elektronik ileti gönderimi ve ilgili kayıtların tutulması için bulut tabanlı hizmet sağlayıcılardan yararlanılmaktadır. Bu sağlayıcılar, yalnızca hizmetin ifası için gerekli asgari veriye erişir ve tarafımızla akdedilen sözleşmeler kapsamında veri işleyen sıfatıyla hareket eder.",
          "Yurt dışında sunucu bulunduran sağlayıcılara aktarım söz konusu olduğunda, 6698 sayılı Kanun'un yurt dışına aktarıma ilişkin hükümleri ile Kurul düzenlemeleri esas alınır; aktarım, öngörülen hukuki mekanizmalara ve gerekli hâllerde açık rızanıza dayanılarak gerçekleştirilir.",
          "Gönderim altyapısı ve alınan güvenlik tedbirleri aşağıdaki tabloda gösterilmiştir."
        ],
        "table": [
          {
            "key": "Barındırma altyapısı",
            "value": "Bulut tabanlı uygulama barındırma hizmeti; tüm trafik HTTPS ile şifrelenir"
          },
          {
            "key": "Veri tabanı",
            "value": "PostgreSQL tabanlı yönetilen veri tabanı; satır düzeyi güvenlik (RLS) etkin, erişim yalnızca sunucu tarafındaki yetkili servis üzerinden"
          },
          {
            "key": "E-posta gönderim sağlayıcısı",
            "value": "İşlemsel ve pazarlama e-postalarının iletimi için kullanılan e-posta altyapı hizmeti"
          },
          {
            "key": "İYS entegrasyonu",
            "value": "Onay ve ret kayıtlarının yüklenmesi ile gönderim öncesi sorgulama, İYS arayüzü üzerinden gerçekleştirilir"
          },
          {
            "key": "Erişim güvenliği",
            "value": "Yönetici hesapları TOTP tabanlı iki aşamalı doğrulama ile korunur; parolalar bcrypt ile özetlenerek saklanır"
          },
          {
            "key": "Yetkilendirme",
            "value": "Rol tabanlı erişim denetimi uygulanır; gönderim ve liste yönetimi yetkisi sınırlı role tanımlıdır"
          },
          {
            "key": "İzlenebilirlik",
            "value": "Tüm yönetici mutasyonları değiştirilemez olay kaydına yazılır"
          },
          {
            "key": "Veri minimizasyonu",
            "value": "Gönderim sağlayıcılarına yalnızca alıcı adresi ve ileti içeriği aktarılır; ödeme ve fatura verisi bu süreçte paylaşılmaz"
          },
          {
            "key": "İhlal bildirimi",
            "value": "Veri ihlali hâlinde Kurul'a ve ilgili kişilere mevzuatta öngörülen süre ve usulde bildirim yapılır"
          }
        ]
      },
      {
        "heading": "18. Veri Kaynağı ve Uygulamadığımız Yöntemler",
        "paragraphs": [
          "Ticari elektronik ileti gönderdiğimiz iletişim bilgileri, yalnızca doğrudan sizden, sizin bilginiz ve iradenizle temin edilir. Üyelik kaydı, sipariş akışı, bülten formu, kafede doldurulan fiziksel form ve etkinlik katılım kaydı başlıca kaynaklarımızdır.",
          "Aşağıda, mevzuata ve etik ilkelerimize aykırı bulduğumuz ve hiçbir koşulda başvurmadığımız yöntemler açıkça sayılmıştır. Bu taahhütler, {{LEGAL_NAME}} bakımından bağlayıcıdır."
        ],
        "ordered": [
          "Satın alınmış, kiralanmış veya üçüncü kişilerden devralınmış iletişim listelerine ticari elektronik ileti gönderilmez.",
          "İnternet üzerinden otomatik yöntemlerle toplanmış (kazınmış) e-posta adresi veya telefon numarası kullanılmaz.",
          "Rastgele üretilmiş numara veya adreslere toplu gönderim yapılmaz.",
          "Gönderen kimliğinin gizlendiği, taklit edildiği veya yanıltıcı biçimde gösterildiği iletiler gönderilmez.",
          "Yanıltıcı konu başlığı, sahte kişisel yanıt görünümü veya gerçek dışı aciliyet ifadeleri kullanılmaz.",
          "Ret bağlantısı çalışmayan, gizlenmiş, okunamayacak kadar küçük veya erişimi zorlaştırılmış ileti gönderilmez.",
          "Ret talebini işleme almadan önce ilave onay, anket doldurma veya hesap girişi gibi engeller konulmaz.",
          "Onay vermeyen kullanıcılara, onay almak amacıyla ticari elektronik ileti gönderilmez.",
          "Onay kapsamı dışındaki üçüncü kişi markalar adına veya onların ürünlerinin tanıtımı amacıyla gönderim yapılmaz.",
          "İletişim bilgileriniz, pazarlama amacıyla üçüncü kişilere satılmaz, kiralanmaz veya devredilmez.",
          "Küçüklere yönelik doğrudan pazarlama iletisi gönderilmez; hesap açılışında yaş beyanı esas alınır ve küçüklere ait olduğu tespit edilen kayıtlar gönderim listelerinden çıkarılır.",
          "Alkollü içecek, tütün ürünü veya reklamı mevzuatla sınırlandırılmış ürünlere ilişkin tanıtım içeriği ticari elektronik ileti yoluyla gönderilmez."
        ]
      },
      {
        "heading": "19. Şikâyet Mercileri, Denetim ve Yaptırımlar",
        "paragraphs": [
          "Ticari elektronik iletilere ilişkin bir sorun yaşadığınızda, öncelikle {{EMAIL}} adresinden bizimle iletişime geçmenizi rica ederiz. Talebinizi kayıt altına alır, gönderim kayıtlarını inceler ve sonucu size yazılı olarak bildiririz. Bu başvuru, yasal başvuru yollarına gitmenize engel değildir ve herhangi bir hakkınızdan feragat anlamına gelmez.",
          "İzinsiz ticari elektronik ileti gönderimi, 6563 sayılı Kanun kapsamında idari yaptırıma tabidir. Ticaret Bakanlığı denetim yetkisini haiz olup, mevzuata aykırılık hâlinde idari para cezası uygulanabilir.",
          "Başvurabileceğiniz merciler ve izlenecek yollar aşağıda sıralanmıştır."
        ],
        "ordered": [
          "Doğrudan bize başvuru: {{EMAIL}} adresi, {{PHONE}} numarası veya {{ADDRESS}} adresi üzerinden talebinizi iletebilirsiniz.",
          "İYS üzerinden ret: İzin durumunuzu marka ve kanal bazında kapatarak gönderimi kaynağında durdurabilirsiniz.",
          "Ticaret Bakanlığı'na şikâyet: İzinsiz veya ret sonrası devam eden gönderimlere ilişkin şikâyetinizi, e-Devlet üzerinden veya Bakanlığın ilgili elektronik başvuru sistemi aracılığıyla yapabilirsiniz.",
          "Şikâyet, kural olarak alıcının ikametgâhının bulunduğu yerdeki Ticaret İl Müdürlüğüne yapılır; ikametgâhı yurt dışında bulunanlar bakımından hizmet sağlayıcının merkezinin bulunduğu yer yetkilidir.",
          "Şikâyet başvurusu, mevzuatta öngörülen süreler içinde yapılmalıdır: ihlalin öğrenildiği tarihten itibaren üç ay ve her hâlde ihlalin gerçekleştiği tarihten itibaren bir yıl.",
          "Kişisel verilerinizin korunmasına ilişkin talepleriniz için önce veri sorumlusu sıfatıyla bize başvurmanız gerekir; başvurunuzun reddedilmesi, yetersiz yanıt verilmesi veya süresinde yanıt verilmemesi hâlinde Kişisel Verilerin Korunması Kurulu'na şikâyette bulunabilirsiniz.",
          "Tüketici işlemlerinden kaynaklanan uyuşmazlıklar bakımından, her yıl Ticaret Bakanlığınca yeniden değerleme oranında güncellenen parasal sınırlara göre Tüketici Hakem Heyetlerine veya Tüketici Mahkemelerine başvurabilirsiniz.",
          "Şikâyet süreçlerinde bize iletilen bilgi ve belgeler, yalnızca şikâyetin değerlendirilmesi amacıyla işlenir ve süreç sonunda saklama politikamıza uygun olarak imha edilir."
        ]
      },
      {
        "heading": "20. Yürürlük, Güncelleme ve İletişim",
        "paragraphs": [
          "Bu aydınlatma metni, {{SITE_URL}} adresinde yayımlandığı tarihte yürürlüğe girer ve ticari elektronik ileti alan tüm alıcılar bakımından geçerlidir. Metnin güncel sürümü her zaman aynı adreste erişilebilir durumda tutulur.",
          "Mevzuat değişiklikleri, Ticaret Bakanlığı ve Kişisel Verilerin Korunması Kurulu düzenlemeleri, İYS uygulamalarındaki değişiklikler veya süreçlerimizdeki güncellemeler nedeniyle metin zaman zaman revize edilebilir. Onayınızın kapsamını genişleten bir değişiklik yapılması hâlinde, yeni kapsam için ayrıca onayınız talep edilir; onay vermemeniz hâlinde mevcut onayınız değişmeksizin devam eder.",
          "Metnin bir hükmünün geçersiz sayılması, diğer hükümlerin geçerliliğini etkilemez. Bu metinde yer alan hiçbir hüküm, 6502 sayılı Tüketicinin Korunması Hakkında Kanun, 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun emredici hükümlerinden doğan haklarınızı sınırlandıracak veya ortadan kaldıracak biçimde yorumlanamaz.",
          "Ticari elektronik iletiler, ileti onayınız, ret talebiniz veya İYS kaydınıza ilişkin her türlü soru, talep ve şikâyetiniz için aşağıdaki kanallardan bize ulaşabilirsiniz."
        ],
        "table": [
          {
            "key": "Hizmet sağlayıcı",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Adres",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil numarası",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "Vergi dairesi ve numarası",
            "value": "{{TAX_OFFICE}} - {{TAX_NO}}"
          },
          {
            "key": "Sosyal medya",
            "value": "{{HANDLE}} - {{IG}} - {{TIKTOK}} - {{YOUTUBE}}"
          }
        ]
      }
    ]
  },
  {
    "slug": "kullanim-sartlari",
    "title": "Kullanım Şartları",
    "shortTitle": "Kullanım Şartları",
    "category": "Site & Üyelik",
    "summary": "{{BRAND}} internet sitesinin ve site üzerinden sunulan menü vitrini, online bottega, rezervasyon ve üyelik hizmetlerinin kullanımına ilişkin hak, yükümlülük, yasak ve sorumluluk esaslarını düzenleyen sözleşmesel metindir.",
    "references": [
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
      "Mesafeli Sözleşmeler Yönetmeliği (RG: 27.11.2014, 29188)",
      "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun",
      "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik (İYS — İleti Yönetim Sistemi)",
      "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik",
      "5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun",
      "6698 sayılı Kişisel Verilerin Korunması Kanunu",
      "Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik",
      "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ",
      "6098 sayılı Türk Borçlar Kanunu",
      "6102 sayılı Türk Ticaret Kanunu",
      "6100 sayılı Hukuk Muhakemeleri Kanunu",
      "5846 sayılı Fikir ve Sanat Eserleri Kanunu",
      "6769 sayılı Sınai Mülkiyet Kanunu",
      "5464 sayılı Banka Kartları ve Kredi Kartları Kanunu",
      "6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun",
      "5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu",
      "Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği",
      "213 sayılı Vergi Usul Kanunu",
      "4207 sayılı Tütün Ürünlerinin Zararlarının Önlenmesi ve Kontrolü Hakkında Kanun",
      "5237 sayılı Türk Ceza Kanunu"
    ],
    "sections": [
      {
        "heading": "1. Taraflar, Belgenin Konusu ve Kapsamı",
        "paragraphs": [
          "İşbu Kullanım Şartları (bundan sonra \"Şartlar\" olarak anılacaktır), {{SITE_URL}} adresinde yayımlanan {{BRAND}} internet sitesinin ve bu site üzerinden sunulan tüm dijital hizmetlerin kullanımına ilişkin usul ve esasları düzenlemek amacıyla hazırlanmıştır.",
          "Sitenin sahibi, içerik sağlayıcısı ve işletmecisi; {{ADDRESS}} adresinde mukim, {{TAX_OFFICE}} nezdinde {{TAX_NO}} vergi kimlik numarası ile kayıtlı {{LEGAL_NAME}} unvanlı limited şirkettir (bundan sonra \"Şirket\", \"{{SHORT_NAME}}\" veya \"Satıcı\" olarak anılacaktır). {{BRAND}}, Şirket tarafından işletilen kahve ve gelato bar işletmesinin ve bu işletmeye ait elektronik ticaret faaliyetinin ticari markasıdır. Şirketin ana faaliyet kodu {{NACE}} olup, işe başlama tarihi {{STARTED_AT}} olarak vergi dairesi kayıtlarında yer almaktadır.",
          "Siteyi herhangi bir amaçla ziyaret eden, sitede gezinen, üyelik hesabı oluşturan, bültene kaydolan, rezervasyon talebi ileten, yorum veya değerlendirme paylaşan ya da online mağaza (bottega) üzerinden sipariş veren her gerçek veya tüzel kişi (bundan sonra \"Kullanıcı\" veya \"Siz\") işbu Şartların tarafı sayılır ve burada düzenlenen hükümlerle bağlı olur.",
          "İşbu Şartlar; Gizlilik ve Kişisel Verilerin Korunması Politikası, Çerez Politikası, Ön Bilgilendirme Formu, Mesafeli Satış Sözleşmesi, İptal ve İade Koşulları, Teslimat ve Kargo Koşulları ile sitede yayımlanan diğer politika metinleriyle bir bütün oluşturur. Anılan metinler işbu Şartların ayrılmaz ekleri niteliğindedir.",
          "Belirli bir hizmete özgü metinler ile işbu Şartlar arasında çelişki bulunması hâlinde, o hizmete özgü metnin hükümleri öncelikle uygulanır. Her hâlükârda 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve ilgili mevzuatın tüketici lehine emredici hükümleri saklıdır; işbu Şartların hiçbir hükmü, tüketicinin kanundan doğan haklarını sınırlandıracak, ortadan kaldıracak veya kullanılmasını güçleştirecek biçimde yorumlanamaz."
        ]
      },
      {
        "heading": "2. Tanımlar",
        "paragraphs": [
          "İşbu Şartlarda geçen terimler aşağıdaki anlamları taşır. Burada tanımlanmayan terimler bakımından ilgili mevzuattaki tanımlar esas alınır."
        ],
        "bullets": [
          "Site: {{SITE_URL}} alan adı ve alt alan adları üzerinden erişilen, Şirkete ait internet sitesi ile buna bağlı tüm sayfa, arayüz, uygulama programlama arayüzü (API) ve dijital bileşenler.",
          "Şirket / Satıcı: {{LEGAL_NAME}} ({{SHORT_NAME}}).",
          "Marka: Şirket tarafından işletilen {{BRAND}} markası ile bu markaya ait tüm görsel, işitsel ve metinsel kimlik unsurları.",
          "Kullanıcı: Siteyi herhangi bir şekilde kullanan, üye olsun ya da olmasın her gerçek veya tüzel kişi.",
          "Üye: Sitede e-posta adresini doğrulayarak hesap oluşturan ve hesabı aktif durumda bulunan Kullanıcı.",
          "Tüketici: 6502 sayılı Kanun uyarınca ticari veya mesleki olmayan amaçlarla hareket eden gerçek veya tüzel kişi.",
          "Menü Vitrini: Kafe işletmesinde sunulan içecek, gelato ve yiyecek kalemlerinin tanıtım amacıyla listelendiği dijital bölüm.",
          "Bottega: Site üzerinden fiziksel ürün satışının yapıldığı online mağaza bölümü; kavrulmuş kahve çekirdeği, yenilebilir waffle kupa, gelato kiti, kahve ekipmanı, marka ürünleri ve kiler ürünlerini kapsar.",
          "Sipariş: Üyenin bottega üzerinden bir veya birden fazla ürünü satın almak amacıyla elektronik ortamda ilettiği talep.",
          "İçerik: Sitede yer alan her türlü metin, görsel, video, ses, illüstrasyon, ikon, yazılım kodu, arayüz tasarımı, veri tabanı, tarif, marka hikâyesi ve bunların düzenlenmiş hâli.",
          "Kullanıcı İçeriği: Kullanıcı tarafından siteye yüklenen ya da site aracılığıyla iletilen yorum, değerlendirme, puanlama, fotoğraf, soru, öneri ve benzeri her türlü içerik.",
          "Hizmet: Menü vitrini, bottega üzerinden satış, rezervasyon talebi iletimi, üyelik, sipariş takibi, bülten ve kampanya bildirimleri dâhil olmak üzere site üzerinden sunulan tüm dijital hizmetler.",
          "Kişisel Veri: 6698 sayılı Kişisel Verilerin Korunması Kanunu anlamında kimliği belirli veya belirlenebilir gerçek kişiye ilişkin her türlü bilgi.",
          "Mücbir Sebep: İşbu Şartların 15. maddesinde örneklenen, tarafların kontrolü dışında gelişen ve yükümlülüklerin ifasını imkânsız kılan ya da önemli ölçüde güçleştiren olaylar."
        ]
      },
      {
        "heading": "3. Şartların Kabulü ve Sözleşmenin Kurulması",
        "paragraphs": [
          "Siteye erişim sağlamanız, sitede gezinmeniz veya herhangi bir hizmetten yararlanmanız; işbu Şartları okuduğunuz, anladığınız ve kabul ettiğiniz anlamına gelir. Şartları kabul etmiyorsanız siteyi kullanmamanız gerekmektedir.",
          "Üyelik oluşturma adımında, kayıt formunda yer alan onay kutucuğunu işaretlemek suretiyle işbu Şartları ve Gizlilik ve Kişisel Verilerin Korunması Politikası'nı açıkça kabul etmiş sayılırsınız. Bu kabul, elektronik ortamda kurulan ve tarafları bağlayan bir sözleşme niteliğindedir.",
          "Sipariş verme adımında; Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi, işbu Şartlardan ayrı ve bağımsız bir onay kutucuğu ile onaylanır. Bu onay, işbu Şartların kabulünün yerine geçmez; iki kabul birbirinden bağımsızdır ve ayrı ayrı kayıt altına alınır.",
          "Elektronik ortamda verilen onaylara ilişkin olarak; onay tarihi ve saati, onayı veren hesabın kimlik bilgileri, IP adresi, tarayıcı ve cihaz bilgisi ile onaylanan belgenin sürüm numarası sistem kayıtlarına işlenir, ilgili sipariş kaydıyla ilişkilendirilir ve mevzuatta öngörülen süre boyunca saklanır.",
          "On sekiz yaşından küçük kişiler ile fiil ehliyeti bulunmayan veya sınırlı olan kişiler sitede üyelik hesabı oluşturamaz ve sipariş veremez. Bu durumdaki kişiler ancak veli veya vasilerinin bilgisi ve gözetimi dâhilinde hareket edebilir. Şirket, ehliyetsizlik şüphesi bulunan hesapları askıya alma hakkını saklı tutar."
        ]
      },
      {
        "heading": "4. Hizmetin Kapsamı ve Niteliği",
        "paragraphs": [
          "Şirket, site üzerinden aşağıda sayılan hizmetleri sunar. Hizmetlerin kapsamı; Şirketin ticari kararları, ürün mevcudiyeti ve mevzuat gereklilikleri doğrultusunda genişletilebilir, daraltılabilir veya sona erdirilebilir."
        ],
        "ordered": [
          "Menü Vitrini: {{BRAND}} kafe işletmesinde sunulan kahve, gelato ve yiyecek kalemlerinin tanıtımı. Menü vitrininde yer alan kalemler ve bunlara ilişkin fiyatlar bilgilendirme amaçlıdır; işletme içi satış bakımından bağlayıcı icap niteliği taşımaz ve site üzerinden sipariş edilemez.",
          "Bottega (Online Mağaza): Kavrulmuş kahve çekirdeği, yenilebilir waffle kupa, gelato kiti, kahve ekipmanı (moka pot, değirmen, tamper), marka ürünleri (fincan, önlük, tote çanta) ve kiler ürünlerinin (pistacchio kreması, şuruplar) mesafeli sözleşme kurulmak suretiyle satışı.",
          "Rezervasyon Talebi: İşletmede masa rezervasyonu için elektronik ortamda talep iletimi. Rezervasyon talepleri, Şirket tarafından e-posta veya telefon yoluyla teyit edilmedikçe kesinleşmez; talebin iletilmiş olması tek başına rezervasyon hakkı doğurmaz.",
          "Üyelik: E-posta doğrulamalı hesap oluşturma, adres defteri yönetimi, sipariş geçmişi görüntüleme, favori ürün listesi oluşturma ve sipariş durumu takibi.",
          "İşlemsel ve Ticari İletişim: Sipariş onayı, kargo bildirimi, iade süreci gibi işlemsel e-postalar ile açık rızası bulunan Kullanıcılara yönelik kampanya ve bülten iletileri.",
          "Marka İçeriği: Marka hikâyesi, kavurma notları, tarif ve demleme rehberleri, basında yer alan haberler ile görsel ve video içerikler."
        ],
        "bullets": [
          "Sitede yer alan ürün görselleri temsilîdir. El yapımı üretim, doğal hammadde ve kavurma partisi farklılıkları nedeniyle renk, doku ve görünümde makul ölçüde sapma bulunabilir; bu nitelikteki makul farklılıklar tek başına ayıp teşkil etmez.",
          "Gıda ürünlerine ilişkin bileşen, alerjen, besin değeri ve tüketim tarihi bilgileri; 5996 sayılı Kanun ile Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği uyarınca ürün sayfasında ve ambalaj üzerinde sunulur. Gıda alerjisi veya intoleransı bulunan Kullanıcıların sipariş öncesinde bu bilgileri incelemesi ve tereddüt hâlinde {{EMAIL}} adresinden Şirkete ulaşması gerekir.",
          "Sitede yayımlanan demleme, saklama ve kullanım önerileri genel nitelikte bilgilendirmedir; tıbbi, diyetetik veya sağlık tavsiyesi niteliği taşımaz.",
          "Stok bilgileri gerçek zamanlıya yakın olarak güncellenir; ancak eş zamanlı sipariş yoğunluğu nedeniyle nadiren stok tükenmesi yaşanabilir. Bu durumda Şirket, Mesafeli Sözleşmeler Yönetmeliği hükümleri çerçevesinde Kullanıcıyı gecikmeksizin bilgilendirir ve tahsil edilen bedeli iade eder.",
          "Ürün fiyatları Türk Lirası (TRY) cinsinden ve katma değer vergisi dâhil olarak gösterilir. Kargo bedeli sipariş özetinde ayrıca belirtilir.",
          "İşletmede 4207 sayılı Tütün Ürünlerinin Zararlarının Önlenmesi ve Kontrolü Hakkında Kanun kapsamındaki düzenlemeler uygulanır; site üzerinden tütün ürünü ve alkollü içecek satışı yapılmaz."
        ]
      },
      {
        "heading": "5. Üyelik Hesabı ve Hesap Güvenliği",
        "paragraphs": [
          "Bottega üzerinden sipariş verilebilmesi için e-posta adresi doğrulanmış, aktif bir üyelik hesabı zorunludur. Üyelik ücretsizdir ve herhangi bir abonelik bedeli içermez.",
          "Üyelik başvurusunda beyan edilen ad, soyad, e-posta adresi, telefon numarası ve adres bilgilerinin doğru, güncel ve eksiksiz olması Kullanıcının sorumluluğundadır. Yanlış veya eksik bilgi nedeniyle teslimatın gerçekleşmemesinden ya da gecikmesinden Şirket sorumlu tutulamaz.",
          "Hesap şifreleri, geri döndürülemez bir özet (bcrypt) algoritmasıyla saklanır ve Şirket personeli dâhil hiç kimse tarafından açık metin olarak görüntülenemez. Buna rağmen şifrenin gizliliğinin korunması, güçlü bir şifre seçilmesi ve şifrenin üçüncü kişilerle paylaşılmaması Kullanıcının yükümlülüğündedir.",
          "Hesabınıza yetkisiz erişim sağlandığını fark etmeniz veya bundan şüphelenmeniz hâlinde, gecikmeksizin {{EMAIL}} adresine bildirimde bulunmanız gerekir. Bildirim yapılıncaya kadar hesap üzerinden gerçekleştirilen işlemler Kullanıcı tarafından yapılmış sayılır; Şirketin kendi kusurundan kaynaklanan hâller bu kapsamın dışındadır."
        ],
        "bullets": [
          "Bir gerçek kişi adına yalnızca bir üyelik hesabı açılabilir. Kampanya veya promosyon kodlarından haksız yarar sağlamak amacıyla mükerrer hesap açılması yasaktır.",
          "Hesabın üçüncü kişilere devredilmesi, kiralanması, satılması veya ortak kullanıma açılması yasaktır.",
          "Kullanıcı, üyeliğini dilediği zaman ve gerekçe göstermeksizin hesap ayarları üzerinden ya da {{EMAIL}} adresine ileteceği talep ile sonlandırabilir. Üyeliğin sonlandırılması, devam eden siparişlerden doğan hak ve yükümlülükleri ortadan kaldırmaz.",
          "213 sayılı Vergi Usul Kanunu, 6102 sayılı Türk Ticaret Kanunu ve tüketici mevzuatı uyarınca saklanması zorunlu olan fatura, sipariş ve işlem kayıtları; üyelik sonlandırılsa dahi kanuni saklama süreleri boyunca muhafaza edilir.",
          "Şirket; işbu Şartların ihlali, sahtecilik şüphesi, ödeme sistemlerinin kötüye kullanılması veya yargı mercilerince verilmiş bir karar bulunması hâlinde hesabı geçici olarak askıya alabilir ya da kalıcı olarak kapatabilir. Askıya alma veya kapatma kararı, mümkün olan hâllerde gerekçesiyle birlikte Kullanıcıya bildirilir."
        ]
      },
      {
        "heading": "6. Sipariş, Fiyatlandırma ve Ödemeye İlişkin Genel Kurallar",
        "paragraphs": [
          "Bottega üzerinden verilen siparişlerde satıcı sıfatı {{LEGAL_NAME}} unvanlı şirkete aittir. Sipariş süreci mesafeli sözleşme niteliğinde olup, ayrıntılı hükümler Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'nde düzenlenmiştir.",
          "Ödeme adımında Kullanıcı; Ön Bilgilendirme Formu'nu ve Mesafeli Satış Sözleşmesi'ni, işbu Şartlardan ayrı bir onay kutucuğu ile onaylar. Bu onay olmaksızın sipariş tamamlanamaz. Mesafeli Sözleşmeler Yönetmeliği uyarınca siparişin ödeme yükümlülüğü doğurduğu husus, sipariş butonunda açık ve anlaşılır biçimde belirtilir.",
          "Sipariş tutarı hiçbir koşulda yalnızca istemci tarafından iletilen veriye dayanılarak hesaplanmaz. Sepette gösterilen ürün, adet, birim fiyat, indirim, kargo ve vergi tutarları; ödeme işlemi başlatılmadan önce sunucu tarafında veri tabanındaki güncel kayıtlarla yeniden doğrulanır. Uyumsuzluk tespit edilmesi hâlinde işlem durdurulur ve Kullanıcı bilgilendirilir.",
          "Ödeme işlemleri, 6493 sayılı Kanun kapsamında faaliyet gösteren yetkili ödeme kuruluşları ve/veya banka sanal POS altyapıları üzerinden gerçekleştirilir. Kart bilgileri Şirket sistemlerinde saklanmaz, işlenmez ve görüntülenmez; ilgili veriler doğrudan PCI-DSS uyumlu ödeme altyapısına iletilir.",
          "Kart ile yapılan ödemelerde, kartı çıkaran kuruluşun desteklemesi hâlinde 3D Secure doğrulaması uygulanır. 5464 sayılı Banka Kartları ve Kredi Kartları Kanunu kapsamındaki taksitlendirme, ön provizyon, iptal, iade ve ters ibraz (chargeback) süreçleri; ilgili banka ve ödeme kuruluşunun kuralları ile mevzuat çerçevesinde yürütülür.",
          "Şirket; sahtecilik şüphesi, kart sahibinin itirazı, ödemenin tamamlanmaması veya risk kurallarının tetiklenmesi hâllerinde siparişi kabul etmeme, iptal etme ya da ek doğrulama talep etme hakkını saklı tutar. Bu durumda tahsil edilmiş bir bedel varsa, aynı ödeme yöntemi üzerinden ve mevzuatta öngörülen süre içinde iade edilir.",
          "Cayma hakkı, iade ve değişim süreçleri Mesafeli Sözleşmeler Yönetmeliği hükümleri çerçevesinde İptal ve İade Koşulları metninde ayrıntılı olarak düzenlenmiştir. Çabuk bozulabilen veya son kullanma tarihi geçebilecek gıda ürünleri ile ambalajı açılmış hijyenik ürünler bakımından Yönetmelikte öngörülen cayma hakkı istisnaları uygulanır."
        ],
        "table": [
          {
            "key": "Para birimi",
            "value": "Türk Lirası (TRY)"
          },
          {
            "key": "KDV oranı",
            "value": "%20 (gösterilen fiyatlara dâhildir)"
          },
          {
            "key": "Kargo — 500 TL ve üzeri sipariş",
            "value": "Ücretsiz"
          },
          {
            "key": "Kargo — 500 TL altı sipariş",
            "value": "39 TL"
          },
          {
            "key": "İstanbul içi motokurye",
            "value": "89 TL"
          },
          {
            "key": "Türkiye geneli teslimat",
            "value": "Yurtiçi Kargo"
          },
          {
            "key": "KKTC ve yurt dışı teslimat",
            "value": "Aras Kargo"
          }
        ]
      },
      {
        "heading": "7. Sitenin Kullanımına İlişkin Yasaklar",
        "paragraphs": [
          "Kullanıcı; siteyi yalnızca hukuka, ahlaka, dürüstlük kuralına ve işbu Şartlara uygun amaçlarla kullanmayı kabul eder. Aşağıda sayılan fiiller açıkça yasaktır. Bu fiiller, 5237 sayılı Türk Ceza Kanunu'nun bilişim sistemlerine ilişkin hükümleri başta olmak üzere çeşitli mevzuat hükümleri kapsamında suç teşkil edebilir."
        ],
        "ordered": [
          "Şirket, yukarıdaki yasakların ihlali hâlinde; ihlali sonlandırmaya yönelik teknik tedbirler almak, ilgili IP adresine erişimi kısıtlamak, hesabı askıya almak veya kapatmak, uğradığı zararın tazminini talep etmek ve yetkili adli ile idari makamlara başvurmak dâhil olmak üzere tüm kanuni haklarını kullanabilir.",
          "Alınan teknik tedbirler, mümkün olduğu ölçüde ihlalin niteliğiyle orantılı ve süreyle sınırlı biçimde uygulanır; tedbirin gerekçesi talep hâlinde ilgiliye bildirilir.",
          "Bir güvenlik açığı tespit etmeniz hâlinde, açığı kötüye kullanmaksızın ve üçüncü kişilerle paylaşmaksızın {{EMAIL}} adresine bildirmeniz beklenir. İyi niyetli ve sorumlu bildirimler Şirket tarafından hukuki takibe konu edilmez."
        ],
        "bullets": [
          "Sitede yer alan verilerin; otomatik veri toplama araçları (crawler, scraper, bot, örümcek yazılım, ekran kazıma betikleri) kullanılarak sistematik biçimde kopyalanması, çekilmesi, indekslenmesi veya çoğaltılması. Arama motorlarının robots.txt dosyasında izin verilen alanlardaki olağan indeksleme faaliyeti bu yasağın dışındadır.",
          "Ürün kataloğunun, fiyat listelerinin, menü içeriğinin, görsellerin veya veri tabanının tamamının ya da nicelik veya nitelik bakımından önemli bir bölümünün izinsiz olarak çıkarılması, yeniden kullanılması veya üçüncü kişilere aktarılması.",
          "Sipariş, rezervasyon, üyelik, yorum veya iletişim formlarının otomasyon araçlarıyla toplu olarak doldurulması; sahte, gerçeğe aykırı ya da başkasına ait kimlik bilgileriyle hesap açılması.",
          "Sitenin kaynak kodunun, istemci tarafı yazılımının veya arayüz bileşenlerinin tersine mühendisliğe tabi tutulması, kaynak koda dönüştürülmesi (decompile), ayrıştırılması (disassemble) veya bunlardan türev eser meydana getirilmesi.",
          "Sitenin, sunucuların, veri tabanının veya ağ altyapısının işleyişini engellemeye ya da bozmaya yönelik hizmet dışı bırakma (DoS/DDoS) saldırıları, aşırı istek gönderimi, yük testi, sızma testi ve benzeri fiillerin Şirketin önceden alınmış yazılı izni olmaksızın gerçekleştirilmesi.",
          "Güvenlik önlemlerinin, erişim kontrollerinin, oturum doğrulama mekanizmalarının, istek hız sınırlarının, CAPTCHA ve benzeri korumaların aşılması veya aşılmasına teşebbüs edilmesi.",
          "Başka bir Kullanıcının hesabına yetkisiz erişim sağlanması, oturum bilgilerinin ele geçirilmesi ya da kimlik avı (phishing) amaçlı içerik oluşturulması.",
          "Zararlı yazılım, virüs, truva atı, solucan, mantık bombası ya da sistemin bütünlüğünü tehdit eden herhangi bir kod parçasının siteye yüklenmesi veya site aracılığıyla iletilmesi.",
          "Sitenin, Şirketin ya da markanın itibarına zarar verecek biçimde kullanılması; {{BRAND}} markasının izinsiz olarak reklam metni, anahtar kelime, alan adı, sosyal medya hesabı veya uygulama adı olarak kullanılması.",
          "Site üzerinden izinsiz ticari elektronik ileti gönderimi, reklam yapılması, üçüncü taraf ürün veya hizmetlerinin pazarlanması ya da zincirleme ileti dolaştırılması.",
          "Kampanya, promosyon kodu, kupon veya hediye çeki mekanizmalarının amacı dışında kullanılması; mükerrer hesap, sahte adres ya da otomasyon yoluyla haksız yarar sağlanması.",
          "Sitede yer alan telif, marka, tasarım veya sahiplik bildirimlerinin kaldırılması, gizlenmesi ya da değiştirilmesi.",
          "Sitenin, Şirketin yazılı izni olmaksızın çerçeveleme (framing), gömme (embedding), yansıtma (mirroring) veya kazıma yoluyla başka bir platformda yeniden yayımlanması.",
          "Sitenin, üçüncü kişilerin kişilik haklarını, kişisel verilerini veya fikri mülkiyet haklarını ihlal edecek biçimde kullanılması."
        ]
      },
      {
        "heading": "8. Kullanıcı Tarafından Üretilen İçerik ve Yorum Kuralları",
        "paragraphs": [
          "Site üzerinde ürün değerlendirmesi, puanlama, soru ve benzeri Kullanıcı İçeriği paylaşılabilir. Kullanıcı İçeriğinin hukuka uygunluğundan ve doğruluğundan, içeriği oluşturan Kullanıcı sorumludur.",
          "Kullanıcı; paylaştığı içerik üzerinde tasarruf yetkisine sahip olduğunu, içeriğin üçüncü kişilerin fikri mülkiyet, kişilik ve kişisel verilerin korunmasına ilişkin haklarını ihlal etmediğini beyan ve taahhüt eder.",
          "Kullanıcı; paylaştığı içeriğin Şirket tarafından site içinde, {{HANDLE}} kullanıcı adıyla işletilen sosyal medya hesaplarında ve pazarlama materyallerinde yayımlanması, çoğaltılması, işlenmesi ve umuma iletilmesi için Şirkete bedelsiz, devredilebilir ve alt lisans verilebilir bir kullanım hakkı tanır. Bu izin içeriğin Kullanıcıya ait mülkiyetini ortadan kaldırmaz; Kullanıcı içeriğinin kaldırılmasını her zaman talep edebilir ve talep makul süre içinde yerine getirilir.",
          "Şirket, Kullanıcı İçeriğini yayımlamak zorunda değildir. Yayımlanan içerikler; hakaret, istenmeyen içerik (spam) ve ürünle ilgisiz paylaşımlara karşı otomatik ve/veya insan denetimine tabi tutulabilir."
        ],
        "ordered": [
          "Kurallara aykırı bulunan içerik yayımlanmaz; yayımlanmışsa kaldırılır. Şirket, kaldırma gerekçesini talep hâlinde ilgili Kullanıcıya bildirir.",
          "Tekrarlanan ihlallerde Kullanıcının yorum yapma yetkisi askıya alınabilir ya da hesabı kapatılabilir.",
          "Bir içeriğin haklarınızı ihlal ettiğini düşünüyorsanız, işbu Şartların 12. maddesinde düzenlenen bildirim usulüne göre başvurabilirsiniz."
        ],
        "bullets": [
          "Hakaret, sövme, tehdit, taciz, nefret söylemi, ayrımcılık ya da şiddeti teşvik eden ifadeler içeren yorumlar yayımlanmaz.",
          "Gerçeğe aykırı, yanıltıcı ya da rakip lehine veya aleyhine manipülasyon amacı taşıyan değerlendirmeler kaldırılır.",
          "Satın alınmamış ürüne ilişkin sahte deneyim beyanı, ücret veya menfaat karşılığı yazılmış yorumlar ile aynı içeriğin mükerrer paylaşımı yasaktır.",
          "Üçüncü kişilere ait kişisel veri (ad-soyad, telefon, adres, e-posta, görüntü) içeren paylaşımlar, ilgili kişinin açık rızası olmaksızın yapılamaz.",
          "Reklam, tanıtım, bağlantı yönlendirmesi, referans kodu veya ticari teklif içeren yorumlar yayımlanmaz.",
          "Ürünlerin hastalıkları önlediği veya tedavi ettiği yönünde sağlık beyanı içeren ifadeler, gıda mevzuatına aykırılık nedeniyle kaldırılır.",
          "Telif hakkıyla korunan metin, görsel veya video içeriğinin hak sahibinin izni olmaksızın paylaşılması yasaktır.",
          "Yorumlarda kişinin kendi sağlık verisi dâhil özel nitelikli kişisel verilerini paylaşmaması önerilir."
        ]
      },
      {
        "heading": "9. Fikri ve Sınai Mülkiyet Hakları",
        "paragraphs": [
          "Sitede yer alan tüm İçerik; 5846 sayılı Fikir ve Sanat Eserleri Kanunu ile 6769 sayılı Sınai Mülkiyet Kanunu kapsamında korunmakta olup, hak sahibi {{LEGAL_NAME}} ya da Şirkete usulüne uygun lisans veren üçüncü kişilerdir.",
          "{{BRAND}} markası ve logosu, ambalaj ve etiket tasarımları, tipografik kimlik, ürün fotoğrafları, illüstrasyonlar, video içerikleri, metinler, tarif ve demleme rehberleri ile sitenin arayüz tasarımı ve yazılım kodu Şirkete aittir.",
          "Sitenin ve içeriğinin bütünü ile veri tabanı, 5846 sayılı Kanun kapsamında veri tabanı yapımcısının hakları bakımından da korunmaktadır. Veri tabanının tamamının veya nicelik ya da nitelik bakımından önemli bir bölümünün izinsiz çıkarılması ve yeniden kullanılması yasaktır.",
          "Kullanıcıya tanınan hak; siteyi kişisel ve ticari olmayan amaçlarla, tarayıcı üzerinden görüntülemek ve teknik olarak zorunlu geçici kopyayı oluşturmakla sınırlı, münhasır olmayan, devredilemez ve geri alınabilir bir kullanım lisansından ibarettir.",
          "İçeriğin kopyalanması, çoğaltılması, yayımlanması, işlenmesi, temsili, umuma iletilmesi, dağıtılması veya bunlardan türev eser meydana getirilmesi; Şirketin önceden alınmış yazılı izni olmaksızın yapılamaz. Sitede üçüncü kişilere ait marka veya içerik kullanılmışsa, bunlara ilişkin haklar ilgili sahiplerine aittir.",
          "İzinsiz kullanım hâlinde Şirket; 5846 sayılı Kanun ve 6769 sayılı Kanun kapsamında tecavüzün durdurulması, önlenmesi ve giderilmesi ile maddi ve manevi tazminat dâhil tüm hukuki ve cezai yollara başvurma hakkını saklı tutar."
        ]
      },
      {
        "heading": "10. Bağlantı (Link) Verme Politikası ve Üçüncü Taraf Bağlantılar",
        "paragraphs": [
          "Siteye bağlantı verilmesi, aşağıdaki koşulların tamamının sağlanması hâlinde ayrıca izin alınmasına gerek olmaksızın serbesttir. Koşullardan herhangi birinin ihlali hâlinde Şirket, bağlantının kaldırılmasını talep etme hakkını saklı tutar."
        ],
        "ordered": [
          "Sitede, Şirketin kontrolünde olmayan üçüncü taraf internet sitelerine bağlantılar yer alabilir. Bu bağlantılar yalnızca kolaylık sağlama amaçlıdır; ilgili sitelerin içeriği, gizlilik uygulamaları ve güvenliği bakımından Şirketin denetim yetkisi ve sorumluluğu bulunmamaktadır.",
          "Üçüncü taraf sitelere yönlendirildiğinizde, o sitenin kendi kullanım şartları ve gizlilik politikası geçerli olur; bu metinleri incelemeniz tavsiye edilir.",
          "Sitede yer alan sosyal medya bağlantıları ({{IG}}, {{TIKTOK}}, {{YOUTUBE}}) ilgili platformların kendi kural, politika ve veri işleme uygulamalarına tabidir.",
          "Şirket, hukuka aykırılığından haberdar olduğu üçüncü taraf bağlantılarını gecikmeksizin siteden kaldırır."
        ],
        "bullets": [
          "Bağlantı; sitenin ana sayfasına ya da doğrudan ilgili içerik sayfasına, sayfanın tamamı görüntülenecek şekilde verilmelidir.",
          "Bağlantı; çerçeveleme (framing), doğrudan gömme (inline linking) ya da içeriğin kaynağını gizleyecek başka bir teknikle verilemez.",
          "Bağlantı, Şirket ile bağlantı veren site arasında ortaklık, sponsorluk, onay veya iş birliği bulunduğu izlenimi yaratmamalıdır.",
          "Bağlantının yer aldığı sitede hukuka aykırı, yanıltıcı, müstehcen, nefret söylemi içeren ya da marka itibarını zedeleyen içerik bulunmamalıdır.",
          "{{BRAND}} markası veya logosu, bağlantı metninde ya da görselinde Şirketin yazılı izni olmaksızın değiştirilerek kullanılamaz.",
          "Bağlantıya ilişkin izin talepleriniz ve marka kullanım başvurularınız {{EMAIL}} adresine iletilebilir."
        ]
      },
      {
        "heading": "11. 5651 Sayılı Kanun Kapsamındaki Sıfat ve Barındırma Bilgisi",
        "paragraphs": [
          "Şirket, kendi ürettiği ve yayımladığı içerikler bakımından 5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun anlamında içerik sağlayıcı sıfatını haizdir ve bu içeriklerden sorumludur.",
          "Kullanıcılar tarafından siteye yüklenen yorum, değerlendirme ve benzeri Kullanıcı İçeriği bakımından Şirket, anılan Kanun anlamında yer sağlayıcı konumundadır. Şirketin, barındırdığı Kullanıcı İçeriğini kontrol etme veya hukuka aykırı bir faaliyetin söz konusu olup olmadığını araştırma yönünde genel bir yükümlülüğü bulunmamaktadır. Bununla birlikte Şirket, hukuka aykırılıktan haberdar edilmesi hâlinde ilgili içeriği yayından kaldırmakla yükümlüdür.",
          "Site altyapısı bulut tabanlı barındırma hizmeti sağlayıcıları üzerinde çalışmakta; veri tabanı hizmeti, satır düzeyi güvenlik (RLS) politikaları etkin biçimde ayrı bir sağlayıcı nezdinde yürütülmektedir. İşlemsel e-posta gönderimi için üçüncü taraf bir e-posta altyapı sağlayıcısından hizmet alınmaktadır. Barındırma ve altyapı sağlayıcılarına ilişkin güncel bilgiye {{EMAIL}} adresine yapılacak başvuru ile ulaşılabilir.",
          "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ile Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik uyarınca Şirket; kendi mal ve hizmetlerini kendi elektronik ticaret ortamında satan hizmet sağlayıcı sıfatıyla faaliyet göstermektedir. Şirket, üçüncü kişilere ait mal veya hizmetlerin satışına aracılık etmemektedir.",
          "6102 sayılı Türk Ticaret Kanunu'nun internet sitesine ilişkin hükümleri ile elektronik ticaret mevzuatı uyarınca yayımlanması gereken tanıtıcı bilgiler, işbu Şartların 20. maddesindeki iletişim tablosunda ve sitenin ilgili bölümlerinde erişime açık tutulur."
        ]
      },
      {
        "heading": "12. Şikâyet, İhbar ve İçerik Kaldırma Bildirimi",
        "paragraphs": [
          "Sitede yer alan bir içeriğin haklarınızı ihlal ettiğini veya hukuka aykırı olduğunu düşünüyorsanız, aşağıdaki bilgileri içeren bir bildirimi {{EMAIL}} adresine iletebilirsiniz. Bildirim tarafımıza ulaştığı andan itibaren makul süre içinde değerlendirilir."
        ],
        "ordered": [
          "Bildirimde bulunan kişinin adı, soyadı veya unvanı ile iletişim bilgileri (e-posta adresi ve telefon numarası).",
          "Şikâyete konu içeriğin sitedeki tam adresi (URL) ve içeriği tanımlamaya yeterli açıklama.",
          "İhlalin niteliği: telif hakkı ihlali, marka ihlali, kişilik hakkı ihlali, kişisel veri ihlali, gerçeğe aykırı beyan veya diğer hukuka aykırılık.",
          "Hak sahipliğini ya da menfaat ilişkisini gösterir bilgi ve varsa belgeler.",
          "Talebin açıkça ifade edilmesi: içeriğin kaldırılması, düzeltilmesi ya da erişime engellenmesi.",
          "Bildirimde yer alan bilgilerin doğru olduğuna ilişkin beyan."
        ],
        "bullets": [
          "Şirket bildirimi inceler; hukuka aykırılığı açık olan içerikleri gecikmeksizin yayından kaldırır ve mümkün olan hâllerde içeriği paylaşan Kullanıcıyı bilgilendirir.",
          "Değerlendirme sonucunda talebin reddedilmesi hâlinde ret gerekçesi, bildirimde bulunana yazılı olarak iletilir.",
          "5651 sayılı Kanun kapsamında içeriğin çıkarılması ve erişimin engellenmesi için yargı yoluna başvurma hakkınız her hâlükârda saklıdır.",
          "Kişisel verilerinize ilişkin talepleriniz için, 6698 sayılı Kanun ve Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ çerçevesinde Gizlilik ve Kişisel Verilerin Korunması Politikası'nda belirtilen usulü izlemeniz gerekir; bu talepler başvuru tarihinden itibaren en geç otuz gün içinde sonuçlandırılır.",
          "Ürün, sipariş, teslimat ve iade süreçlerine ilişkin şikâyetleriniz için {{PHONE}} numaralı telefondan veya {{EMAIL}} adresinden müşteri hizmetlerine ulaşabilirsiniz.",
          "Tüketici sıfatıyla yaptığınız başvurular, sonucundan bağımsız olarak tüketici hakem heyetlerine veya tüketici mahkemelerine başvuru hakkınızı ortadan kaldırmaz."
        ]
      },
      {
        "heading": "13. Hizmet Sürekliliği, Bakım ve Sistem Değişiklikleri",
        "paragraphs": [
          "Şirket, sitenin kesintisiz ve hatasız çalışması için makul teknik ve idari çabayı gösterir; ancak internet ortamının doğası gereği kesintisiz erişim taahhüdünde bulunmaz.",
          "Planlı bakım çalışmaları, mümkün olan hâllerde düşük trafikli saatlerde yapılır ve önemli kesintiler öncesinde sitede duyurulur. Acil güvenlik yamaları ve kritik müdahaleler önceden duyuru yapılmaksızın uygulanabilir.",
          "Şirket; sitenin tasarımını, işlevlerini, menü ve ürün kataloğunu, fiyatlandırmayı ve teknik altyapısını dilediği zaman değiştirme, sınırlandırma veya kaldırma hakkını saklı tutar. Bu değişiklikler, değişiklik tarihinden önce kurulmuş sözleşmelerden doğan hakları etkilemez.",
          "Kullanıcının internet bağlantısı, cihazı, işletim sistemi veya tarayıcısından kaynaklanan erişim sorunlarından Şirket sorumlu değildir. Sitenin güncel tarayıcı sürümleriyle kullanılması önerilir."
        ],
        "bullets": [
          "Sistem kesintisi nedeniyle tamamlanamayan siparişlerde tahsilat gerçekleşmişse, bedel aynı ödeme yöntemi üzerinden iade edilir.",
          "Kesinti sırasında iletilen rezervasyon talepleri, teyit edilmedikçe geçerli sayılmaz.",
          "Şirket, kötüye kullanım veya güvenlik tehdidi tespiti hâlinde belirli IP adresleri ya da bölgelerden erişimi geçici olarak kısıtlayabilir.",
          "Şirket, teknik altyapı sağlayıcılarını (barındırma, veri tabanı, e-posta ve ödeme hizmetleri) önceden bildirimde bulunmaksızın değiştirebilir; bu değişiklik veri güvenliği standartlarını düşürecek biçimde yapılamaz.",
          "Yönetim paneline erişim çok faktörlü kimlik doğrulama (TOTP) ile korunur ve tüm yönetici işlemleri değiştirilemez olay kaydına (audit log) yazılır."
        ]
      },
      {
        "heading": "14. Sorumluluğun Sınırlandırılması",
        "paragraphs": [
          "Şirket, site üzerinden satılan ürünlerin ayıplı olmasından 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve ilgili mevzuat çerçevesinde sorumludur. İşbu maddede yer alan sınırlamalar tüketici mevzuatından doğan sorumluluğu ortadan kaldırmaz; tüketicinin ayıplı mala ilişkin seçimlik hakları, cayma hakkı, iade ve tazminat hakları saklıdır.",
          "Şirketin kastından veya ağır kusurundan kaynaklanan zararlar ile ölüm, yaralanma ya da sağlığın bozulmasından doğan zararlar bakımından sorumluluğu sınırlandıran hiçbir hüküm geçerli değildir.",
          "Şirket; sitenin kullanımından doğan ve öngörülemeyen, dolaylı nitelikteki kâr kaybı, iş kaybı, itibar kaybı veya veri kaybı gibi zararlardan, kendisine atfedilebilir bir kusur bulunmadıkça sorumlu tutulamaz.",
          "Sitede yayımlanan demleme, saklama, tarif ve kullanım önerileri genel bilgilendirme amaçlıdır. Ürün ambalajında ve ürün sayfasında yer alan alerjen ve kullanım uyarılarının okunmaması ya da ürünün öngörülen kullanım amacı dışında kullanılması nedeniyle doğan zararlardan Kullanıcı sorumludur.",
          "Kullanıcı İçeriğinden ve üçüncü taraf internet sitelerinin içeriğinden Şirket sorumlu değildir; hukuka aykırılıktan haberdar edilmesi hâlindeki kaldırma yükümlülüğü saklıdır.",
          "Kullanıcının işbu Şartları ihlal etmesi nedeniyle Şirketin üçüncü kişilere ya da idari makamlara karşı bir ödeme yapmak zorunda kalması hâlinde, Şirketin ilgili Kullanıcıya rücu hakkı saklıdır.",
          "6098 sayılı Türk Borçlar Kanunu'nun temerrüde ilişkin hükümleri saklı olmak üzere, tarafların yükümlülüklerini yerine getirmemesi hâlinde genel hükümler uygulanır."
        ]
      },
      {
        "heading": "15. Mücbir Sebep",
        "paragraphs": [
          "Tarafların kontrolü dışında gelişen, öngörülemeyen ve kaçınılmaz nitelikteki olaylar mücbir sebep sayılır. Mücbir sebep hâlinde, etkilenen tarafın ilgili yükümlülüğü mücbir sebebin devamı süresince askıya alınır ve bu süre boyunca temerrüt oluşmaz."
        ],
        "ordered": [
          "Mücbir sebepten etkilenen taraf, durumu ve tahmini süresini diğer tarafa gecikmeksizin bildirir.",
          "Mücbir sebep otuz günden uzun sürerse, taraflardan her biri sözleşmeyi tazminat ödemeksizin feshedebilir.",
          "Fesih hâlinde, ifa edilmemiş edimlere ilişkin olarak tahsil edilmiş bedeller Kullanıcıya iade edilir.",
          "Mücbir sebep, sipariş edilmiş ancak teslim edilememiş ürünün bedelinin iadesi yükümlülüğünü ortadan kaldırmaz."
        ],
        "bullets": [
          "Deprem, sel, yangın, fırtına ve benzeri doğal afetler.",
          "Salgın hastalık, karantina ve bunlara ilişkin resmî tedbirler.",
          "Savaş, seferberlik, terör eylemleri, halk ayaklanması ve iç karışıklık.",
          "Genel grev, lokavt ve iş yavaşlatma eylemleri.",
          "Kamu otoritelerinin faaliyeti durduran veya sınırlayan kararları ile ithalat ve ihracat kısıtlamaları.",
          "Uzun süreli elektrik, internet altyapısı veya telekomünikasyon kesintileri; barındırma, veri tabanı ya da ödeme altyapısı sağlayıcılarının geniş çaplı hizmet kesintileri.",
          "Kargo ve lojistik hizmetlerinin ülke genelinde durması veya önemli ölçüde aksaması.",
          "Şirketin makul güvenlik önlemlerine rağmen önlenemeyen geniş çaplı siber saldırılar.",
          "Hammadde tedarik zincirinde yaşanan ve Şirketin kusurundan kaynaklanmayan olağanüstü kesintiler."
        ]
      },
      {
        "heading": "16. Devir Yasağı, Bölünebilirlik, Feragat ve Sözleşmenin Bütünlüğü",
        "paragraphs": [
          "Kullanıcı, işbu Şartlardan doğan hak ve yükümlülüklerini Şirketin yazılı onayı olmaksızın üçüncü kişilere devredemez, temlik edemez veya bunlar üzerinde herhangi bir tasarrufta bulunamaz.",
          "Şirket; birleşme, bölünme, tür değiştirme, ticari işletme devri veya benzeri yapısal işlemler hâlinde işbu Şartlardan doğan hak ve yükümlülüklerini halefine devredebilir. Bu devir Kullanıcının kazanılmış haklarını ihlal edemez; devir hâlinde Kullanıcı sitede duyuru ve/veya e-posta yoluyla bilgilendirilir.",
          "İşbu Şartların herhangi bir hükmünün yetkili bir mahkeme veya idari merci tarafından geçersiz, uygulanamaz ya da haksız şart sayılması hâlinde, bu durum diğer hükümlerin geçerliliğini etkilemez. Geçersiz sayılan hüküm, tarafların amacına en yakın ve hukuka uygun hükümle değiştirilmiş sayılır.",
          "Şirketin işbu Şartlardan doğan herhangi bir hakkını kullanmaması veya kullanmakta gecikmesi, o haktan feragat ettiği anlamına gelmez. Bir hakkın kısmen kullanılması, aynı ya da diğer hakların ileride kullanılmasını engellemez.",
          "İşbu Şartlar ve ekleri, konusuna ilişkin olarak taraflar arasındaki anlaşmanın tamamını oluşturur ve bu konudaki önceki tüm sözlü veya yazılı beyan, yazışma ve mutabakatların yerine geçer. Şirket personeli tarafından yapılan ve işbu Şartlara aykırı sözlü beyanlar Şirketi bağlamaz.",
          "Başlıklar yalnızca kolaylık amacıyla konulmuş olup, hükümlerin yorumunda esas alınmaz."
        ]
      },
      {
        "heading": "17. Şartlarda Değişiklik, Sürüm Yönetimi ve Yürürlük",
        "paragraphs": [
          "Şirket; mevzuat değişiklikleri, hizmet kapsamındaki güncellemeler, teknik altyapı değişiklikleri veya ticari gereklilikler nedeniyle işbu Şartlarda tek taraflı değişiklik yapma hakkını saklı tutar.",
          "Güncellenen Şartlar, sitede yayımlandığı anda yürürlüğe girer. Kullanıcı aleyhine sonuç doğuran esaslı değişiklikler, yürürlük tarihinden makul süre önce sitede duyurulur ve üyelere kayıtlı e-posta adresleri üzerinden bildirilir.",
          "Değişikliğin yürürlüğe girmesinden sonra siteyi kullanmaya devam etmeniz, güncel Şartları kabul ettiğiniz anlamına gelir. Değişiklikleri kabul etmiyorsanız üyeliğinizi sonlandırabilirsiniz; bu durum, sonlandırma tarihinden önce doğmuş haklarınızı etkilemez.",
          "Her sipariş bakımından, siparişin verildiği tarihte yürürlükte olan Şartlar ile onaylanan Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi sürümü geçerlidir. Onaylanan belge sürümü, onay tarihi ve saati, IP adresi ile tarayıcı bilgisi sipariş kaydına işlenir ve talep hâlinde Kullanıcıya iletilir.",
          "İşbu Şartların önceki sürümlerine ilişkin talepleriniz için {{EMAIL}} adresine başvurabilirsiniz.",
          "İşbu Şartlar, sitede yayımlandığı tarihte yürürlüğe girer ve yeni bir sürümle değiştirilinceye kadar yürürlükte kalır."
        ]
      },
      {
        "heading": "18. Uygulanacak Hukuk, Uyuşmazlıkların Çözümü ve Delil Sözleşmesi",
        "paragraphs": [
          "İşbu Şartlara ve site üzerinden kurulan tüm hukuki ilişkilere Türk hukuku uygulanır.",
          "Tüketici sıfatını haiz Kullanıcılar; 6502 sayılı Tüketicinin Korunması Hakkında Kanun uyarınca, her yıl Ticaret Bakanlığınca yeniden değerleme oranında güncellenen parasal sınırlar çerçevesinde, uyuşmazlık konusuna göre İlçe veya İl Tüketici Hakem Heyetlerine ya da Tüketici Mahkemelerine başvurabilir. Başvuru; tüketicinin yerleşim yerindeki ya da tüketici işleminin yapıldığı yerdeki hakem heyetine veya mahkemeye yapılabilir. Tüketicinin bu seçimlik hakkı hiçbir biçimde sınırlandırılamaz.",
          "Tüketici sıfatını haiz olmayan Kullanıcılar ile Şirket arasındaki uyuşmazlıklarda İstanbul Anadolu Mahkemeleri ve İcra Daireleri yetkilidir. Bu hüküm tüketici işlemleri bakımından uygulanmaz.",
          "Taraflar, uyuşmazlığın dostane yollarla çözümü için öncelikle {{EMAIL}} adresi üzerinden iyi niyetli görüşme yürütmeyi kabul eder. Bu husus, yargı yoluna veya tüketici hakem heyetine başvurmak için ön şart teşkil etmez.",
          "6100 sayılı Hukuk Muhakemeleri Kanunu'nun delil sözleşmesine ilişkin hükümleri uyarınca taraflar; Şirketin veri tabanı kayıtlarının, sunucu ve sistem günlüklerinin, sipariş ve ödeme kayıtlarının, elektronik onay kayıtlarının (IP adresi, tarih-saat, belge sürümü), değiştirilemez olay kaydının (audit log) ve elektronik yazışmaların uyuşmazlık hâlinde delil teşkil edeceğini kabul eder. Bu hüküm, tüketicinin karşı delil sunma hakkını ve kanunda öngörülen delil serbestisini ortadan kaldırmaz."
        ]
      },
      {
        "heading": "19. Kişisel Verilerin Korunması ve Ticari Elektronik İletiler",
        "paragraphs": [
          "Kişisel verileriniz; 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusu sıfatıyla {{LEGAL_NAME}} tarafından, hukuka ve dürüstlük kurallarına uygun olma, doğru ve güncel olma, belirli, açık ve meşru amaçlar için işlenme, işlendikleri amaçla bağlantılı, sınırlı ve ölçülü olma ve mevzuatta öngörülen süre kadar muhafaza edilme ilkelerine uygun olarak işlenir.",
          "Verilerinizin işlenme amaçları, hukuki sebepleri, aktarıldığı taraflar, saklama süreleri ve yurt dışına aktarıma ilişkin ayrıntılı açıklamalar; Gizlilik ve Kişisel Verilerin Korunması Politikası ile Aydınlatma Metni'nde yer almaktadır. Verilerin silinmesi, yok edilmesi ve anonim hâle getirilmesi süreçleri, Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik uyarınca yürütülür.",
          "Kanunun ilgili kişinin haklarını düzenleyen hükümleri uyarınca; verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, eksik veya yanlış işlenmiş verilerin düzeltilmesini, silinmesini veya yok edilmesini isteme, işlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme ve kanuna aykırı işleme nedeniyle uğradığınız zararın giderilmesini talep etme haklarına sahipsiniz. Başvurularınızı, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'de öngörülen usule uygun olarak {{EMAIL}} adresine iletebilirsiniz; talepleriniz en geç otuz gün içinde sonuçlandırılır.",
          "Kampanya, indirim ve bülten içerikli ticari elektronik iletiler; 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ile Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik uyarınca yalnızca önceden onayınızın bulunması hâlinde gönderilir. Onaylar İleti Yönetim Sistemi'ne (İYS) kaydedilir.",
          "Ticari elektronik ileti almayı dilediğiniz zaman ücretsiz olarak reddedebilirsiniz. Ret hakkınızı; iletide yer alan bağlantı üzerinden, İYS üzerinden ya da {{EMAIL}} adresine bildirim yaparak kullanabilirsiniz. Sipariş onayı, kargo bildirimi ve iade süreci gibi işlemsel iletiler sözleşmenin ifasına ilişkin olduğundan onay kapsamı dışındadır.",
          "Veri güvenliği kapsamında; şifreler geri döndürülemez özet algoritmasıyla saklanır, yönetici erişimi çok faktörlü kimlik doğrulama ile korunur, veri tabanında satır düzeyi güvenlik politikaları uygulanır, tüm yönetici işlemleri değiştirilemez olay kaydına yazılır ve kayıtlarda kişisel verilerin maskelenmesine yönelik tedbirler alınır."
        ]
      },
      {
        "heading": "20. İletişim ve İşletme Bilgileri",
        "paragraphs": [
          "İşbu Şartlara, siparişlerinize, iade ve şikâyet süreçlerinize ve kişisel verilerinize ilişkin tüm başvurularınızı aşağıdaki iletişim kanalları üzerinden iletebilirsiniz. Yazılı başvurular için geçerli tek elektronik posta adresi {{EMAIL}} adresidir; bu adres dışındaki kanallardan iletilen başvurular usulüne uygun sayılmayabilir."
        ],
        "table": [
          {
            "key": "Ticaret unvanı",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Kısa unvan",
            "value": "{{SHORT_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "İş yeri adresi",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Vergi dairesi",
            "value": "{{TAX_OFFICE}}"
          },
          {
            "key": "Vergi kimlik numarası",
            "value": "{{TAX_NO}}"
          },
          {
            "key": "Vergi türü",
            "value": "{{TAX_TYPE}}"
          },
          {
            "key": "Ana faaliyet kodu (NACE)",
            "value": "{{NACE}}"
          },
          {
            "key": "İşe başlama tarihi",
            "value": "{{STARTED_AT}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil numarası",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "IBAN",
            "value": "{{IBAN}}"
          },
          {
            "key": "Banka",
            "value": "{{BANK}}"
          },
          {
            "key": "Instagram",
            "value": "{{IG}}"
          },
          {
            "key": "TikTok",
            "value": "{{TIKTOK}}"
          },
          {
            "key": "YouTube",
            "value": "{{YOUTUBE}}"
          },
          {
            "key": "Sosyal medya kullanıcı adı",
            "value": "{{HANDLE}}"
          }
        ]
      }
    ]
  },
  {
    "slug": "uyelik-sozlesmesi",
    "title": "Üyelik Sözleşmesi",
    "shortTitle": "Üyelik",
    "category": "Site & Üyelik",
    "summary": "{{SITE_URL}} adresinde işletilen {{BRAND}} çevrimiçi mağazasına üye olan kullanıcı ile {{LEGAL_NAME}} arasındaki üyelik ilişkisinin kurulmasını, hesap güvenliğini, tarafların hak ve yükümlülüklerini, askıya alma ve fesih hâllerini düzenleyen sözleşmedir.",
    "references": [
      "4721 sayılı Türk Medeni Kanunu",
      "6098 sayılı Türk Borçlar Kanunu",
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
      "Mesafeli Sözleşmeler Yönetmeliği (Resmî Gazete: 27.11.2014, sayı 29188)",
      "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun",
      "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik",
      "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik",
      "6698 sayılı Kişisel Verilerin Korunması Kanunu",
      "Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik",
      "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ",
      "5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun",
      "6100 sayılı Hukuk Muhakemeleri Kanunu",
      "7201 sayılı Tebligat Kanunu",
      "6102 sayılı Türk Ticaret Kanunu",
      "213 sayılı Vergi Usul Kanunu",
      "5846 sayılı Fikir ve Sanat Eserleri Kanunu",
      "6769 sayılı Sınai Mülkiyet Kanunu",
      "5464 sayılı Banka Kartları ve Kredi Kartları Kanunu",
      "6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun",
      "5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu"
    ],
    "sections": [
      {
        "heading": "1. Taraflar",
        "paragraphs": [
          "İşbu Üyelik Sözleşmesi (Sözleşme), bir tarafta aşağıda kimlik ve iletişim bilgileri yer alan {{LEGAL_NAME}} ile diğer tarafta {{SITE_URL}} adresinde yayımlanan internet sitesi üzerinden üyelik hesabı oluşturan gerçek kişi (Üye) arasında, elektronik ortamda kurulmuştur.",
          "{{LEGAL_NAME}}, ticari faaliyetlerini {{BRAND}} markası altında yürütmekte olup, işbu Sözleşme'de kısaca {{SHORT_NAME}} veya Şirket olarak anılacaktır. Üye, üyelik formunu doldurup onay adımını tamamlamakla Sözleşme'nin tamamını okuduğunu, anladığını ve hükümleriyle bağlı olduğunu kabul eder.",
          "Sözleşme, Üye'nin elektronik onayı ile kurulur; ayrıca ıslak imza aranmaz. Onay anına ilişkin tarih, saat, IP adresi, tarayıcı bilgisi ve onaylanan belge sürümü Şirket sistemlerinde kayıt altına alınır."
        ],
        "table": [
          {
            "key": "Ticaret unvanı",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Kısa unvan",
            "value": "{{SHORT_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Adres",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Vergi dairesi",
            "value": "{{TAX_OFFICE}}"
          },
          {
            "key": "Vergi kimlik numarası",
            "value": "{{TAX_NO}}"
          },
          {
            "key": "Vergi türü",
            "value": "{{TAX_TYPE}}"
          },
          {
            "key": "Faaliyet kodu (NACE)",
            "value": "{{NACE}}"
          },
          {
            "key": "İşe başlama tarihi",
            "value": "{{STARTED_AT}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil numarası",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          }
        ]
      },
      {
        "heading": "2. Tanımlar",
        "paragraphs": [
          "İşbu Sözleşme'de geçen terimler, aşağıda gösterilen anlamları taşır. Tanımlarda kullanılan tekil ifadeler çoğulu, çoğul ifadeler tekili de kapsar."
        ],
        "table": [
          {
            "key": "Şirket / Satıcı",
            "value": "{{LEGAL_NAME}} ({{SHORT_NAME}})"
          },
          {
            "key": "Marka",
            "value": "Şirket'in kahve ve gelato bar ile çevrimiçi mağaza faaliyetlerini yürüttüğü {{BRAND}} markası"
          },
          {
            "key": "Site",
            "value": "{{SITE_URL}} alan adı ve alt alan adları üzerinden yayımlanan internet sitesi ile buna bağlı mobil arayüzler"
          },
          {
            "key": "Bottega",
            "value": "Site üzerindeki çevrimiçi mağaza bölümü; kavrulmuş kahve çekirdeği, yenilebilir waffle kupa, gelato kiti, kahve ekipmanı, marka ürünleri ve kiler ürünlerinin satışa sunulduğu alan"
          },
          {
            "key": "Üye",
            "value": "Site'de kendi adına hesap oluşturan, on sekiz yaşını doldurmuş ve fiil ehliyetine sahip gerçek kişi"
          },
          {
            "key": "Üyelik Hesabı",
            "value": "Üye'ye özgü e-posta adresi ve şifre ile erişilen, sipariş geçmişi, adres defteri ve tercihlerin tutulduğu kişisel alan"
          },
          {
            "key": "Doğrulanmış Hesap",
            "value": "Üye'nin e-posta adresine gönderilen bağlantı veya kod aracılığıyla adres sahipliğinin teyit edildiği üyelik hesabı"
          },
          {
            "key": "Hizmet",
            "value": "Şirket'in Site üzerinden sunduğu üyelik, katalog görüntüleme, sepet, sipariş oluşturma, sipariş takibi ve destek hizmetlerinin bütünü"
          },
          {
            "key": "Mesafeli Satış Sözleşmesi",
            "value": "Üye'nin sipariş adımında ayrıca onayladığı, ürün satışına ilişkin sözleşme"
          },
          {
            "key": "Ön Bilgilendirme Formu",
            "value": "Mesafeli Sözleşmeler Yönetmeliği uyarınca sipariş öncesi Üye'ye sunulan bilgilendirme metni"
          },
          {
            "key": "Kişisel Veri",
            "value": "6698 sayılı Kişisel Verilerin Korunması Kanunu'nda tanımlanan, kimliği belirli veya belirlenebilir gerçek kişiye ilişkin her türlü bilgi"
          },
          {
            "key": "İYS",
            "value": "Ticari elektronik ileti onaylarının saklandığı ve yönetildiği İleti Yönetim Sistemi"
          },
          {
            "key": "Minor Unit",
            "value": "Fiyatların sistemde kuruş cinsinden tam sayı olarak tutulması esası; arayüzde Türk lirası biçiminde gösterilir"
          }
        ]
      },
      {
        "heading": "3. Sözleşmenin Konusu ve Kapsamı",
        "paragraphs": [
          "İşbu Sözleşme'nin konusu; Üye'nin Site üzerinde üyelik hesabı oluşturması, bu hesabı kullanması ve Şirket'in sunduğu Hizmet'ten yararlanması sürecinde tarafların karşılıklı hak ve yükümlülüklerinin belirlenmesidir.",
          "Sözleşme, üyelik ilişkisinin çerçevesini düzenler; belirli bir ürünün satışına ilişkin hüküm doğurmaz. Ürün satışı, Üye'nin sipariş adımında Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi'ni ayrı bir onay kutucuğuyla onaylaması üzerine kurulur ve o sözleşmelerin hükümlerine tabidir.",
          "Site'de yayımlanan Gizlilik ve Kişisel Verilerin Korunması Politikası, Çerez Politikası, Ticari Elektronik İleti Aydınlatma ve Onay Metni, Teslimat ve Kargo Koşulları, İptal ve İade Politikası ile Kullanım Koşulları işbu Sözleşme'nin ayrılmaz ekleri niteliğindedir. Bu metinler ile Sözleşme arasında çelişki bulunması hâlinde, tüketici lehine olan hüküm uygulanır."
        ],
        "bullets": [
          "Sözleşme kapsamı, Site'nin bilgi amaçlı bölümleri ile Bottega üzerinden yürütülen çevrimiçi satış faaliyetini kapsar.",
          "Kafe içinde yüz yüze gerçekleştirilen satışlar mesafeli sözleşme niteliğinde olmadığından işbu Sözleşme kapsamı dışındadır.",
          "Şirket'in kurumsal veya toplu satış anlaşmaları ayrı yazılı sözleşmelere tabi olup, bu Sözleşme onları ikame etmez."
        ]
      },
      {
        "heading": "4. Üyeliğin Kurulması ve E-posta Doğrulaması",
        "paragraphs": [
          "Üyelik, Üye'nin Site'deki kayıt formunu doldurması, işbu Sözleşme ile Gizlilik ve Kişisel Verilerin Korunması Politikası'nı onaylaması ve e-posta adresini doğrulaması ile tamamlanır. Doğrulama tamamlanmadan hesap sınırlı statüde kalır.",
          "Doğrulama, Üye'nin kayıt sırasında bildirdiği e-posta adresine gönderilen bağlantı veya tek kullanımlık kod ile yapılır. Doğrulama bağlantısı sınırlı süre için geçerlidir; süresi dolduğunda Üye, hesap ayarlarından yeni doğrulama e-postası talep edebilir.",
          "SİPARİŞ VERME YETKİSİ YALNIZCA E-POSTA ADRESİ DOĞRULANMIŞ HESAPLARA TANINIR. Doğrulanmamış hesaplar katalogda gezinebilir ve sepet oluşturabilir; ancak ödeme adımına geçemez. Bu kısıtlama, hatalı adrese gönderilen sipariş bildirimlerini, kimlik yanıltmasını ve ödeme sahteciliğini önlemeye yöneliktir."
        ],
        "ordered": [
          "Üye, ad ve soyadı, geçerli bir e-posta adresi ve kendi belirlediği şifre ile kayıt formunu doldurur.",
          "Üye, işbu Sözleşme'yi ve aydınlatma metnini ayrı onay kutucuklarıyla onaylar; ticari elektronik ileti onayı bu adımda zorunlu tutulmaz ve isteğe bağlıdır.",
          "Sistem, bildirilen adrese doğrulama e-postası gönderir; bu e-posta işlemsel nitelikte olup ticari elektronik ileti sayılmaz.",
          "Üye, bağlantıya tıklayarak veya kodu girerek adres sahipliğini teyit eder ve hesap Doğrulanmış Hesap statüsüne geçer.",
          "Doğrulama sonrası Üye, adres defteri, favori listesi ve sipariş geçmişi gibi üyelik özelliklerinin tamamına erişir.",
          "Üye, dilerse hesap ayarlarından e-posta adresini değiştirebilir; yeni adres de aynı doğrulama sürecine tabidir ve doğrulama tamamlanana kadar sipariş yetkisi askıya alınır."
        ]
      },
      {
        "heading": "5. Üyelik Şartları, Yaş ve Fiil Ehliyeti",
        "paragraphs": [
          "Üyelik, on sekiz yaşını doldurmuş ve 4721 sayılı Türk Medeni Kanunu ile 6098 sayılı Türk Borçlar Kanunu anlamında fiil ehliyetine sahip gerçek kişilere açıktır. Üye, kayıt olmakla bu şartları taşıdığını beyan eder.",
          "Şirket, gerçek yaşı doğrulamak amacıyla kimlik belgesi talep etme yükümlülüğü altında değildir; ancak hesabın yaş şartını taşımayan bir kişi tarafından kullanıldığına dair somut belirti bulunması hâlinde hesabı askıya alma ve gerekli görülürse kapatma hakkını saklı tutar.",
          "Yaş şartını taşımayan bir kişi tarafından oluşturulduğu tespit edilen hesaba ilişkin kişisel veriler, yasal saklama yükümlülükleri saklı kalmak kaydıyla gecikmeksizin silinir veya anonim hâle getirilir.",
          "Tüzel kişiler adına kayıt yapılmak istenmesi hâlinde, kaydı gerçekleştiren gerçek kişi, tüzel kişiyi temsile yetkili olduğunu beyan eder ve yetkisiz temsilden doğan sorumluluk kendisine aittir. Kurumsal faturalı satışlarda vergi kimlik numarası ve vergi dairesi bilgisi ödeme adımında talep edilir."
        ]
      },
      {
        "heading": "6. Üyenin Beyan ve Taahhütleri",
        "paragraphs": [
          "Üye, üyelik hesabını dürüstlük kuralına uygun şekilde ve yürürlükteki mevzuat çerçevesinde kullanacağını kabul, beyan ve taahhüt eder."
        ],
        "ordered": [
          "Kayıt ve sipariş sırasında verdiği ad, soyad, e-posta, telefon, teslimat ve fatura adresi bilgilerinin doğru, güncel ve kendisine ait olduğunu; bu bilgilerde değişiklik olması hâlinde hesabını gecikmeksizin güncelleyeceğini kabul eder.",
          "Başkasının kimlik, iletişim veya ödeme bilgilerini kendi bilgisiymiş gibi kullanmayacağını; üçüncü kişi adına sipariş vermesi hâlinde bunun ilgili kişinin bilgisi ve rızası dâhilinde olduğunu taahhüt eder.",
          "Tek bir gerçek kişi olarak yalnızca bir aktif hesap tutacağını; kampanya, kupon veya ücretsiz kargo eşiklerinden mükerrer yararlanmak amacıyla çoklu hesap açmayacağını kabul eder.",
          "Site'ye otomatik veri toplama araçları, robot, örümcek, kazıyıcı yazılım veya benzeri otomatik yöntemlerle Şirket'in yazılı izni olmaksızın erişmeyeceğini; Site'nin altyapısına orantısız yük bindiren işlemler yapmayacağını taahhüt eder.",
          "Site'nin güvenlik önlemlerini aşmaya, kaynak kodunu tersine mühendislikle çözmeye, zararlı yazılım yüklemeye veya başka kullanıcıların hesaplarına yetkisiz erişmeye teşebbüs etmeyeceğini kabul eder.",
          "Site'de yayımlanan içeriği, ürün görsellerini, metinleri ve marka unsurlarını Şirket'in izni olmaksızın çoğaltmayacağını, ticari amaçla kullanmayacağını veya yeniden yayımlamayacağını kabul eder.",
          "Ürün değerlendirmesi, yorum veya benzeri içerik paylaşması hâlinde; hakaret, iftira, ayrımcılık, nefret söylemi, kişisel veri ifşası, yanıltıcı sağlık beyanı veya üçüncü kişilerin haklarını ihlal eden ifade kullanmayacağını taahhüt eder.",
          "Satın aldığı ürünleri kendi ihtiyacı için edindiğini; gıda ürünlerinin izinsiz olarak yeniden satışı ve dağıtımı hususunda 5996 sayılı Veteriner Hizmetleri, Bitki Sağlığı, Gıda ve Yem Kanunu ile ilgili mevzuattan doğan sorumluluğun kendisine ait olduğunu kabul eder.",
          "Ödeme adımında kullandığı kartın kendisine ait veya kullanım yetkisine sahip olduğu bir kart olduğunu; yetkisiz kart kullanımından doğacak hukuki ve cezai sorumluluğun kendisine ait olacağını beyan eder.",
          "İşbu maddeye aykırılık nedeniyle Şirket'in veya üçüncü kişilerin uğrayacağı doğrudan zararları tazmin edeceğini kabul eder."
        ]
      },
      {
        "heading": "7. Hesap Güvenliği ve Şifre Sorumluluğu",
        "paragraphs": [
          "Üyelik hesabı kişiye özeldir ve devredilemez. Üye, şifresini gizli tutmakla, üçüncü kişilerle paylaşmamakla ve tahmin edilmesi güç bir şifre seçmekle yükümlüdür.",
          "Şirket, üyelik şifrelerini açık metin olarak saklamaz. Şifreler bcrypt algoritmasıyla, kullanıcıya özgü tuz değeri kullanılarak özetlenir (hash) ve yalnızca bu özet değer veri tabanında tutulur. Bu nedenle Şirket personeli dâhil hiç kimse Üye'nin ham şifresini görüntüleyemez; unutulan şifre için yapılabilecek tek işlem sıfırlama bağlantısı göndermektir.",
          "Şirket çalışanları hiçbir koşulda Üye'den telefon, e-posta, kısa mesaj veya sosyal medya üzerinden şifre, kart numarası, kartın güvenlik kodu veya tek kullanımlık doğrulama kodu talep etmez. Bu yönde bir talep alan Üye'nin işleme cevap vermeksizin {{EMAIL}} adresine bildirimde bulunması beklenir.",
          "Hesabın Üye'nin kusuru sonucu üçüncü kişilerce kullanılmasından doğan sonuçlardan Üye sorumludur. Buna karşılık, Şirket'in kendi sistemlerinden kaynaklanan bir güvenlik ihlali söz konusu olduğunda sorumluluk Şirket'e aittir ve Şirket, kişisel veri ihlali hâlinde 6698 sayılı Kanun uyarınca Kişisel Verileri Koruma Kurulu'na ve ilgili kişilere bildirim yükümlülüğünü yerine getirir."
        ],
        "bullets": [
          "Şifre sıfırlama bağlantıları tek kullanımlıktır ve sınırlı süre sonunda geçersiz hâle gelir.",
          "Ardışık başarısız giriş denemelerinde hesap, kaba kuvvet saldırılarına karşı geçici olarak kilitlenir.",
          "Yönetim paneline erişim, zaman tabanlı tek kullanımlık parola (TOTP) ile iki aşamalı doğrulamaya tabidir ve tüm yönetici işlemleri değiştirilemez olay kaydına yazılır.",
          "Veri tabanı erişimi satır düzeyi güvenlik (RLS) politikalarıyla kısıtlanmıştır; uygulama dışından doğrudan okuma engellenir.",
          "Site ile tarayıcı arasındaki tüm trafik TLS ile şifrelenir.",
          "Üye, hesabına yetkisiz erişimden şüphelenmesi hâlinde derhâl şifresini değiştirmeli ve durumu {{EMAIL}} adresine veya {{PHONE}} numarasına bildirmelidir."
        ]
      },
      {
        "heading": "8. Ödeme Bilgileri ve Kart Verilerinin Saklanmaması",
        "paragraphs": [
          "Ödeme işlemleri, 6493 sayılı Ödeme ve Menkul Kıymet Mutabakat Sistemleri, Ödeme Hizmetleri ve Elektronik Para Kuruluşları Hakkında Kanun uyarınca faaliyet gösteren lisanslı ödeme kuruluşları ile bankaların sanal POS altyapıları üzerinden yürütülür.",
          "Üye'nin kart numarası, son kullanma tarihi ve güvenlik kodu Şirket sunucularına kaydedilmez; bu veriler doğrudan ödeme kuruluşunun PCI-DSS uyumlu ortamına iletilir. Şirket'in sipariş kaydında yalnızca işlem referansı, tutar, taksit bilgisi, sonuç kodu ve kartın son dört hanesi gibi işlemi izlemeye yarayan sınırlı veriler tutulur.",
          "Kart işlemlerinde, kart hamilinin kimliğinin doğrulanmasına yönelik 3D Secure akışı uygulanır. Ön provizyon, taksitlendirme, iade ve itiraz (chargeback) süreçleri, 5464 sayılı Banka Kartları ve Kredi Kartları Kanunu ile ödeme kuruluşunun kuralları çerçevesinde işletilir.",
          "Ödeme tutarı hiçbir koşulda yalnızca tarayıcıdan gelen veriye göre belirlenmez; sipariş tutarı sunucu tarafında ürün kayıtlarındaki güncel fiyat, vergi ve kargo bilgileri üzerinden yeniden hesaplanır. Ödeme bildirimlerinde tekrarlı işlem oluşmasını önlemek için sağlayıcı referansı üzerinde tekillik kısıtı uygulanır."
        ]
      },
      {
        "heading": "9. Üyeliğin Sağladığı Haklar ve Avantajlar",
        "paragraphs": [
          "Doğrulanmış hesabı bulunan Üye, aşağıdaki üyelik özelliklerinden yararlanır. Bu özellikler Hizmet'in bir parçası olup, Şirket bunların kapsamını makul gerekçelerle ve önceden duyurmak suretiyle değiştirebilir."
        ],
        "bullets": [
          "Sipariş geçmişi: Üye, geçmiş siparişlerini, sipariş numarasını, sipariş kalemlerini, tutarları ve güncel durumunu hesabından görüntüleyebilir; kargo takip numarasına buradan erişebilir.",
          "Adres defteri: Birden fazla teslimat ve fatura adresi kaydedilebilir, adreslere isim verilebilir ve varsayılan adres seçilebilir. Böylece her siparişte adres bilgisi yeniden girilmez.",
          "Favori listesi: İlgi duyulan ürünler favorilere eklenebilir; stoğa dönen ürünler için Üye'nin talebi hâlinde bilgilendirme yapılabilir.",
          "Kişiye özel kupon ve kampanyalar: Şirket, üyelik geçmişine bağlı olarak Üye'ye özel indirim kodları tanımlayabilir. Kuponların geçerlilik süresi, asgari sepet tutarı ve kapsam dışı ürünler kupon tanımında gösterilir.",
          "Sepetin korunması: Tamamlanmayan sepet içeriği, Üye tekrar giriş yaptığında makul bir süre boyunca korunur. Sepette yer alan ürünlerin fiyat ve stok bilgisi ödeme anındaki güncel değerler üzerinden yeniden doğrulanır.",
          "Sipariş belgeleri: Sipariş özetleri, fatura ve iade belgeleri hesap üzerinden görüntülenebilir ve indirilebilir.",
          "Destek: Sipariş ve üyelikle ilgili talepler için {{EMAIL}} adresi ile {{PHONE}} numarası üzerinden destek kanalı sağlanır."
        ]
      },
      {
        "heading": "10. Şirketin Hak ve Yükümlülükleri",
        "paragraphs": [
          "Şirket, Site'yi ve üyelik altyapısını mevcut hâliyle, ticari hayatın olağan akışına uygun özen içinde çalışır durumda tutmayı taahhüt eder."
        ],
        "ordered": [
          "Şirket, Site üzerinde satışa sunduğu ürünlere ilişkin temel nitelikleri, vergiler dâhil satış fiyatını, teslimat ve kargo koşullarını, cayma hakkını ve şikâyet başvuru kanallarını Mesafeli Sözleşmeler Yönetmeliği'nin ön bilgilendirmeye ilişkin hükümleri uyarınca sipariş öncesinde Üye'ye sunar.",
          "Şirket, ürünlere ilişkin gıda etiketleme mevzuatı kapsamındaki içerik ve alerjen bilgilerini ürün sayfasında gösterir; süt, fındık, fıstık, gluten gibi alerjen içerebilecek ürünlerde uyarıya yer verir.",
          "Şirket, teknik bakım, altyapı güncellemesi veya güvenlik gereği Hizmet'i geçici olarak durdurabilir; planlı kesintileri mümkün olduğunca önceden Site üzerinden duyurur.",
          "Şirket, kişisel verileri 6698 sayılı Kanun'un genel ilkelerine uygun şekilde, belirli, açık ve meşru amaçlarla, sınırlı ve ölçülü olarak işler ve veri güvenliğine ilişkin idari ve teknik tedbirleri alır.",
          "Şirket, mevzuattan doğan bilgi verme ve saklama yükümlülüklerini yerine getirir; yetkili merci taleplerine mevzuatın öngördüğü çerçevede yanıt verir.",
          "Şirket, ürün fiyatlarını, kampanyaları ve kargo koşullarını ileriye etkili olarak değiştirme hakkını saklı tutar. Onaylanmış ve ödemesi alınmış siparişlerin koşulları bu değişikliklerden etkilenmez.",
          "Şirket, açık maddi hata sonucu yanlış gösterilen fiyat veya stok bilgisinde, Üye'yi gecikmeksizin bilgilendirmek ve tahsil edilmiş bedeli iade etmek kaydıyla siparişi iptal edebilir; Üye dilerse doğru fiyat üzerinden siparişi sürdürebilir.",
          "Şirket, Site'de üçüncü kişilere ait bağlantılara yer verebilir; bu sitelerin içeriğinden ve gizlilik uygulamalarından sorumlu değildir."
        ]
      },
      {
        "heading": "11. Hesabın Askıya Alınması ve Erişimin Kısıtlanması",
        "paragraphs": [
          "Şirket, aşağıdaki hâllerde üyelik hesabını geçici olarak askıya alabilir veya belirli işlevlere erişimi kısıtlayabilir. Askıya alma, ölçülülük ilkesi gözetilerek ve gerekçe bildirilerek uygulanır."
        ],
        "ordered": [
          "Hesaba yetkisiz erişim şüphesi, olağan dışı giriş hareketliliği veya sızdırılmış kimlik bilgisi kullanıldığına dair belirti bulunması.",
          "Ödeme kuruluşu veya banka tarafından işlemin sahtecilik şüphesiyle işaretlenmesi ya da tekrarlayan ters ibraz (chargeback) bildirimi yapılması.",
          "Aynı gerçek kişiye ait çoklu hesaplar üzerinden kampanya, kupon veya ücretsiz kargo eşiklerinin kötüye kullanıldığının tespiti.",
          "Site'nin işleyişine, güvenliğine veya diğer kullanıcıların haklarına zarar veren teknik davranışların saptanması.",
          "Üye tarafından paylaşılan içeriğin hukuka aykırı olduğunun tespiti veya bu yönde yetkili merciden bildirim gelmesi.",
          "İşbu Sözleşme'nin altıncı maddesinde sayılan taahhütlere aykırılık teşkil eden bir kullanımın belirlenmesi."
        ],
        "bullets": [
          "Askıya alma kararı ve gerekçesi, Üye'nin kayıtlı e-posta adresine bildirilir.",
          "Üye, bildirimden itibaren {{EMAIL}} adresine yazılı itirazda bulunabilir; itiraz makul sürede incelenir ve sonucu Üye'ye bildirilir.",
          "Askıya alma sebebi ortadan kalktığında hesap gecikmeksizin yeniden açılır.",
          "Askıya alma, Üye'nin ödemesi tamamlanmış ve teslim bekleyen siparişlerine ilişkin haklarını ortadan kaldırmaz; bu siparişler mevzuata uygun şekilde tamamlanır veya bedeli iade edilir."
        ]
      },
      {
        "heading": "12. Üyeliğin Üye Tarafından Sona Erdirilmesi",
        "paragraphs": [
          "Üye, üyeliğini dilediği zaman, gerekçe göstermeksizin ve herhangi bir bedel ödemeksizin sona erdirebilir. Bu hak, üyeliğin kurulmasındaki kolaylıkla eşdeğer kolaylıkta kullanılabilecek şekilde sunulur.",
          "Hesap kapatma talebi, hesap ayarları bölümündeki ilgili seçenek üzerinden veya {{EMAIL}} adresine gönderilecek bir talep ile iletilebilir. Talebin Üye'nin kayıtlı e-posta adresinden gelmesi, kimlik teyidi bakımından esas alınır.",
          "Hesap kapatma talebi alındığında; devam eden bir sipariş, tamamlanmamış bir iade veya çözülmemiş bir uyuşmazlık varsa, Şirket bu süreçlerin tamamlanmasını takiben kapatma işlemini uygular ve durumu Üye'ye bildirir.",
          "Üyeliğin sona ermesi, sona erme tarihinden önce kurulmuş satış sözleşmelerinden doğan hakları etkilemez. Üye, teslim aldığı ürünlere ilişkin cayma hakkını, ayıplı mal hükümlerinden doğan seçimlik haklarını ve garanti haklarını üyeliği kapansa dahi mevzuatta öngörülen süreler içinde kullanabilir."
        ]
      },
      {
        "heading": "13. Üyelik Sona Erdiğinde Verilerin Akıbeti",
        "paragraphs": [
          "Üyeliğin sona ermesi hâlinde Şirket, kişisel verileri Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik ile kendi saklama ve imha politikası çerçevesinde işleme alır.",
          "İşleme amacı ortadan kalkan ve herhangi bir hukuki saklama yükümlülüğüne tabi olmayan veriler silinir, yok edilir veya anonim hâle getirilir. Anonim hâle getirilen veriler, kimliği belirlenebilir hiçbir unsur içermeyecek biçimde istatistiksel amaçlarla kullanılabilir.",
          "Buna karşılık, mevzuattan doğan saklama yükümlülüğü bulunan kayıtlar, üyelik kapansa dahi ilgili süreler boyunca sınırlı erişimle muhafaza edilir. Bu kapsamda özellikle 213 sayılı Vergi Usul Kanunu ve 6102 sayılı Türk Ticaret Kanunu uyarınca fatura ve ticari defter kayıtları, 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ile ilgili yönetmelikler uyarınca sipariş ve elektronik ileti onay kayıtları, 5651 sayılı Kanun uyarınca trafik kayıtları saklanır.",
          "Saklama yükümlülüğü kapsamında tutulan veriler, yalnızca yükümlülüğün gereğini yerine getirmek ve olası bir uyuşmazlıkta delil olarak kullanmak amacıyla işlenir; pazarlama amacıyla kullanılmaz. Süre dolduğunda ilk periyodik imha döneminde silinir, yok edilir veya anonim hâle getirilir."
        ],
        "bullets": [
          "Adres defteri, favori listesi ve site içi tercihler hesap kapatıldığında erişime kapatılır.",
          "Ticari elektronik ileti onayı bulunuyorsa, hesabın kapatılmasıyla birlikte ret kaydı İYS üzerine işlenir ve gönderim durdurulur.",
          "Sipariş ve fatura kayıtları, kişiselleştirilmiş pazarlamadan ayrıştırılarak yasal saklama süresi boyunca tutulur.",
          "Üye, 6698 sayılı Kanun'un ilgili kişinin haklarını düzenleyen hükmü uyarınca verilerinin silinmesini ayrıca talep edebilir; başvuru {{EMAIL}} adresine iletilir ve Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca en geç otuz gün içinde sonuçlandırılır."
        ]
      },
      {
        "heading": "14. Şirket Tarafından Fesih",
        "paragraphs": [
          "Şirket, işbu Sözleşme'yi aşağıdaki hâllerde feshedebilir. Fesih hakkı, ölçülülük ilkesi gözetilerek ve mümkün olduğunca önce uyarı yapılarak kullanılır.",
          "Haklı sebebe dayanmayan fesihlerde Şirket, Üye'ye kayıtlı e-posta adresi üzerinden en az otuz gün önceden bildirimde bulunur ve bu süre içinde Üye'nin sipariş geçmişi ile belgelerini indirmesine imkân tanır.",
          "Fesih, Üye'nin ödemesi tamamlanmış siparişlerinden doğan haklarını ve tüketici mevzuatından kaynaklanan taleplerini ortadan kaldırmaz."
        ],
        "ordered": [
          "Üye'nin altıncı maddedeki taahhütlerine ağır veya tekrarlayan biçimde aykırı davranması ve uyarıya rağmen aykırılığı sürdürmesi.",
          "Üyelik bilgilerinin gerçeğe aykırı olduğunun veya başka bir kişinin kimlik bilgileriyle hesap açıldığının tespiti.",
          "Ödeme sahteciliği, kart kötüye kullanımı veya sistematik ters ibraz suistimalinin belirlenmesi.",
          "Site'nin güvenliğini veya diğer kullanıcıların verilerini tehdit eden davranışlarda bulunulması.",
          "Yetkili idari veya adli merci tarafından hesabın kapatılmasına ilişkin bir karar verilmesi.",
          "Şirket'in çevrimiçi mağaza faaliyetini tümüyle sona erdirmesi; bu hâlde tüm üyeler makul süre önceden bilgilendirilir."
        ]
      },
      {
        "heading": "15. Kişisel Verilerin Korunması",
        "paragraphs": [
          "{{LEGAL_NAME}}, üyelik ilişkisi kapsamında işlenen kişisel veriler bakımından 6698 sayılı Kişisel Verilerin Korunması Kanunu anlamında veri sorumlusudur.",
          "Kişisel veriler; üyelik hesabının oluşturulması ve yönetilmesi, sipariş ve teslimat süreçlerinin yürütülmesi, ödeme işlemlerinin gerçekleştirilmesi, müşteri destek taleplerinin karşılanması, hukuki yükümlülüklerin yerine getirilmesi ve bilgi güvenliğinin sağlanması amaçlarıyla, Kanun'un veri işleme şartlarını düzenleyen hükümlerine dayanılarak işlenir.",
          "Verilerin işlenmesine ilişkin ayrıntılı bilgi; işlenen veri kategorileri, hukuki sebepler, aktarım yapılan taraflar, saklama süreleri ve ilgili kişinin hakları Site'de yayımlanan Gizlilik ve Kişisel Verilerin Korunması Politikası ile Aydınlatma Metni'nde yer alır.",
          "Barındırma, veri tabanı ve işlemsel e-posta hizmetleri nedeniyle kişisel verilerin yurt dışında bulunan sunuculara aktarılması söz konusu olabilir. Bu aktarımlar, Kanun'un yurt dışına aktarıma ilişkin hükmü çerçevesinde ve uygun güvencelerle gerçekleştirilir; ayrıntılar aydınlatma metninde açıklanır.",
          "İlgili kişi sıfatıyla Üye, Kanun'un ilgili kişinin haklarını düzenleyen hükmünde sayılan taleplerini {{EMAIL}} adresine veya {{ADDRESS}} adresine yazılı olarak iletebilir. Başvurular, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ uyarınca en geç otuz gün içinde sonuçlandırılır."
        ]
      },
      {
        "heading": "16. Bülten Aboneliği ve Ticari Elektronik İleti Onayı",
        "paragraphs": [
          "Üyelik ile ticari elektronik ileti onayı birbirinden bağımsızdır. Üye, üyeliğini sürdürürken bülten aboneliğinden çıkabileceği gibi, bülten onayı vermeksizin de üyeliğini kesintisiz kullanabilir. Ticari elektronik ileti onayı hiçbir şekilde üyeliğin veya sipariş verebilmenin önkoşulu değildir.",
          "Ticari elektronik iletiler, 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik uyarınca yalnızca önceden alınan onaya dayanılarak gönderilir. Onay ve ret kayıtları İleti Yönetim Sistemi (İYS) üzerine işlenir.",
          "Onayın kapsamı, veriliş biçimi, ret hakkının kullanımı ve İYS üzerinden yapılabilecek işlemlere ilişkin ayrıntılı düzenleme Site'de yayımlanan Ticari Elektronik İleti Aydınlatma ve Onay Metni'nde yer alır; işbu madde o metne atıf yapar.",
          "Üye, onayını dilediği zaman ve bedelsiz olarak geri alabilir. Ret bildirimi, her iletide yer alan bağlantı üzerinden, hesap ayarlarından, İYS üzerinden veya {{EMAIL}} adresine gönderilecek bir talep ile yapılabilir. Ret talebi, mevzuatta öngörülen süre içinde işleme alınır."
        ],
        "bullets": [
          "Sipariş onayı, ödeme bildirimi, kargo takip bilgisi, şifre sıfırlama ve e-posta doğrulama iletileri işlemsel niteliktedir; ticari elektronik ileti sayılmaz ve bülten onayı geri alınsa dahi gönderilmeye devam eder.",
          "Kampanya, indirim, yeni ürün duyurusu ve etkinlik davetleri ticari elektronik iletidir ve yalnızca onay veren üyelere gönderilir.",
          "Üye'nin sosyal medya hesaplarımızı ({{HANDLE}}) takip etmesi, ticari elektronik ileti onayı anlamına gelmez.",
          "İşlemsel e-postalar için hizmet sağlayıcı altyapısı kullanılır; gönderim kayıtları ispat amacıyla saklanır."
        ]
      },
      {
        "heading": "17. Fikri ve Sınai Mülkiyet Hakları",
        "paragraphs": [
          "Site'de yer alan tasarım, arayüz, kaynak kodu, metin, fotoğraf, illüstrasyon, video, ses ve sair içerik üzerindeki haklar 5846 sayılı Fikir ve Sanat Eserleri Kanunu kapsamında korunmakta olup, aksi belirtilmedikçe {{LEGAL_NAME}}'ne veya lisans veren üçüncü kişilere aittir.",
          "{{BRAND}} ibaresi, logo, ambalaj tasarımı ve ayırt edici işaretler 6769 sayılı Sınai Mülkiyet Kanunu kapsamında korunan marka ve tasarım unsurlarıdır. Bu unsurların Şirket'in yazılı izni olmaksızın kullanılması, benzerinin oluşturulması veya tescil ettirilmesi yasaktır.",
          "Üyelik, Üye'ye Site içeriğini yalnızca kişisel ve ticari olmayan amaçlarla görüntüleme yönünde sınırlı, münhasır olmayan, devredilemez bir kullanım imkânı tanır. Bu imkân, içerik üzerinde herhangi bir mülkiyet hakkı doğurmaz.",
          "Üye'nin Site'ye yüklediği yorum, değerlendirme, fotoğraf ve benzeri içerikler bakımından Üye, bu içeriğin kendisine ait olduğunu veya kullanım hakkını haiz olduğunu beyan eder ve Şirket'e söz konusu içeriği Site ile Şirket'in {{IG}}, {{TIKTOK}} ve {{YOUTUBE}} adreslerindeki resmî hesaplarında yayımlama, çoğaltma ve yayma yönünde bedelsiz, dünya çapında ve devredilebilir bir kullanım hakkı tanır. Üye, bu izni ileriye etkili olarak geri alabilir."
        ]
      },
      {
        "heading": "18. Hizmetin Sürekliliği, Bakım ve Mücbir Sebep",
        "paragraphs": [
          "Şirket, Site'nin kesintisiz ve hatasız çalışacağını mutlak biçimde taahhüt etmez; ancak makul teknik ve idari önlemlerle sürekliliği sağlamayı ve kesintileri en kısa sürede gidermeyi üstlenir.",
          "Planlı bakım çalışmaları, mümkün olduğunca düşük yoğunluklu saatlerde yapılır ve Site üzerinden önceden duyurulur. Plansız kesintilerde Şirket, sorunu gidermek için gecikmeksizin harekete geçer.",
          "Mücbir sebep hâllerinde tarafların yükümlülükleri, engel ortadan kalkıncaya kadar askıya alınır. Mücbir sebep süresi makul bir süreyi aşarsa, taraflar Sözleşme'yi tazminatsız feshedebilir. Ödemesi alınmış ancak teslim edilememiş siparişlerin bedeli bu hâlde Üye'ye iade edilir."
        ],
        "bullets": [
          "Doğal afet, yangın, salgın hastalık ve olağanüstü hâl ilanı.",
          "Genel elektrik veya internet altyapısında yaşanan ülke çapında kesintiler.",
          "Barındırma, veri tabanı, e-posta veya ödeme altyapısı sağlayıcılarında meydana gelen ve Şirket'in kontrolü dışında kalan arızalar.",
          "Yetkili mercilerin idari kararları, ithalat veya gümrük kısıtlamaları.",
          "Kargo şirketlerinin faaliyetlerini durduran grev, lokavt veya ulaşım engelleri.",
          "Şirket'in gerekli güvenlik önlemlerini almasına rağmen gerçekleşen kapsamlı siber saldırılar."
        ]
      },
      {
        "heading": "19. Sorumluluğun Kapsamı ve Sınırı",
        "paragraphs": [
          "Şirket, kendi kusurundan kaynaklanan zararlardan mevzuat çerçevesinde sorumludur. İşbu maddedeki hiçbir hüküm, Şirket'in kastından veya ağır ihmalinden doğan sorumluluğunu kaldırmaz; tüketicinin 6502 sayılı Tüketicinin Korunması Hakkında Kanun'dan doğan haklarını sınırlandırmaz veya ortadan kaldırmaz.",
          "Şirket, Üye'nin kendi kusuruyla şifresini üçüncü kişilerle paylaşması, cihazının güvenliğini sağlamaması veya yanlış adres bilgisi girmesi gibi hâllerde doğan zararlardan sorumlu tutulamaz.",
          "Site üzerinde bağlantı verilen üçüncü kişi platformlarının içeriğinden, güvenliğinden ve gizlilik uygulamalarından Şirket sorumlu değildir.",
          "Ürünlerin ayıplı olması hâlinde Üye, 6502 sayılı Kanun'un ayıplı mala ilişkin hükümlerinde öngörülen seçimlik haklarını kullanabilir; mesafeli sözleşmelerde cayma hakkı ise Mesafeli Sözleşmeler Yönetmeliği'nin cayma hakkına ilişkin hükümleri uyarınca on dört gün içinde gerekçe göstermeksizin kullanılabilir. Çabuk bozulabilen veya son kullanma tarihi geçebilecek gıda ürünleri ile ambalajı açılmış hijyenik ürünler bakımından anılan Yönetmelik'te düzenlenen cayma hakkı istisnaları saklıdır; bu istisnalar ürün sayfasında ve Ön Bilgilendirme Formu'nda açıkça belirtilir."
        ]
      },
      {
        "heading": "20. Sözleşme Değişiklikleri ve Bildirim",
        "paragraphs": [
          "Şirket, mevzuat değişiklikleri, hizmet kapsamındaki gelişmeler veya teknik gereklilikler nedeniyle işbu Sözleşme'de değişiklik yapabilir. Değişiklikler yalnızca ileriye etkili sonuç doğurur; geçmişte kurulmuş satış sözleşmelerine uygulanmaz.",
          "Üye aleyhine sonuç doğurabilecek esaslı değişiklikler, yürürlüğe girmeden en az on beş gün önce Üye'nin kayıtlı e-posta adresine bildirilir ve Site'de duyurulur. Yalnızca yazım düzeltmesi, iletişim bilgisi güncellemesi veya mevzuata uyum amaçlı zorunlu değişiklikler bu bildirim süresine tabi değildir.",
          "Üye, değişikliği kabul etmemesi hâlinde üyeliğini bedelsiz olarak sona erdirebilir. Bildirim tarihinden sonra hesabın kullanılmaya devam edilmesi, değişikliklerin kabul edildiği anlamına gelir.",
          "Sözleşme'nin her sürümü bir sürüm numarası ve yürürlük tarihiyle yayımlanır. Sipariş anında yürürlükte olan sürüm, o siparişe ilişkin olarak sipariş kaydına işlenir ve arşivlenir; Üye, kendisine uygulanan sürüme her zaman erişebilir."
        ]
      },
      {
        "heading": "21. Delil Sözleşmesi",
        "paragraphs": [
          "Taraflar, işbu Sözleşme'den doğabilecek uyuşmazlıklarda Şirket'in defter, kayıt ve belgeleri ile bilgisayar, sunucu ve veri tabanı kayıtlarının 6100 sayılı Hukuk Muhakemeleri Kanunu'nun delil sözleşmesine ilişkin hükmü uyarınca kesin delil teşkil edeceğini kabul eder.",
          "Bu hüküm, Üye'nin kendi delillerini sunma hakkını ve tüketici sıfatına bağlı yasal ispat imkânlarını ortadan kaldırmaz. Üye, karşı delil göstermekte serbesttir.",
          "Delil olarak kabul edilen kayıtlar, değiştirilemez biçimde ve erişim izleri kayıt altına alınarak tutulur; yönetici tarafından yapılan tüm veri değişiklikleri ayrı bir olay kaydına yazılır."
        ],
        "bullets": [
          "Üyelik kaydı ve e-posta doğrulama kayıtları.",
          "Sözleşme onaylarına ilişkin tarih, saat, IP adresi, tarayıcı bilgisi ve belge sürümü kayıtları.",
          "Sipariş, sepet, fiyat ve stok hareketi kayıtları.",
          "Ödeme kuruluşundan alınan işlem referansları ve sonuç bildirimleri.",
          "İşlemsel e-posta gönderim kayıtları ve İYS onay ile ret kayıtları.",
          "Sunucu erişim kayıtları ve yönetici işlem kayıtları."
        ]
      },
      {
        "heading": "22. Bildirimler ve Tebligat Adresi",
        "paragraphs": [
          "Taraflar arasındaki bildirimler kural olarak elektronik ortamda yapılır. Üye'nin hesabında kayıtlı e-posta adresi, işbu Sözleşme kapsamındaki bildirimler bakımından geçerli tebligat adresi olarak kabul edilir.",
          "Şirket'e yapılacak bildirimler {{EMAIL}} adresine elektronik posta yoluyla veya {{ADDRESS}} adresine yazılı olarak iletilir. Acil hâllerde {{PHONE}} numarası üzerinden iletişim kurulabilir; ancak telefon görüşmesi tek başına yazılı bildirim yerine geçmez.",
          "Üye, kayıtlı e-posta adresini ve diğer iletişim bilgilerini güncel tutmakla yükümlüdür. Güncel olmayan adres nedeniyle bildirimin ulaşmamasından doğan sonuçlardan Üye sorumludur; bu hâlde bildirim, kayıtlı adrese gönderildiği anda yapılmış sayılır.",
          "Resmî tebligat gerektiren hâllerde 7201 sayılı Tebligat Kanunu hükümleri ile ilgili mevzuat uygulanır."
        ]
      },
      {
        "heading": "23. Devir, Bölünebilirlik ve Feragat",
        "paragraphs": [
          "Üye, işbu Sözleşme'den doğan hak ve yükümlülüklerini Şirket'in yazılı onayı olmaksızın üçüncü kişilere devredemez; üyelik hesabı satılamaz, kiralanamaz veya paylaşıma açılamaz.",
          "Şirket, işletmenin veya ilgili faaliyet kolunun devri, birleşme ya da yeniden yapılanma hâlinde Sözleşme'yi ve buna bağlı hakları devralan tüzel kişiye devredebilir. Bu durumda Üye'ye önceden bilgi verilir ve Üye üyeliğini bedelsiz sona erdirme hakkına sahiptir.",
          "Sözleşme'nin herhangi bir hükmünün kısmen veya tamamen geçersiz sayılması, diğer hükümlerin geçerliliğini etkilemez. Geçersiz hükmün yerine, tarafların amacına en yakın ve mevzuata uygun düzenleme uygulanır.",
          "Taraflardan birinin Sözleşme'den doğan bir hakkını kullanmaması veya geç kullanması, o haktan feragat ettiği anlamına gelmez.",
          "Ödeme yükümlülüğünün geç yerine getirilmesi hâlinde 6098 sayılı Türk Borçlar Kanunu'nun temerrüde ilişkin hükümleri uygulanır; tüketici işlemlerinde temerrüt faizi ve şartları bakımından tüketici mevzuatının koruyucu hükümleri saklıdır."
        ]
      },
      {
        "heading": "24. Uygulanacak Hukuk, Uyuşmazlıkların Çözümü ve Yetki",
        "paragraphs": [
          "İşbu Sözleşme Türk hukukuna tabidir ve Türk hukukuna göre yorumlanır.",
          "Üye'nin tüketici sıfatını haiz olduğu uyuşmazlıklarda, 6502 sayılı Tüketicinin Korunması Hakkında Kanun uyarınca, her yıl Ticaret Bakanlığınca yeniden değerleme oranında güncellenen parasal sınırlar çerçevesinde Tüketici Hakem Heyetleri veya Tüketici Mahkemeleri görevlidir. Başvuru, Üye'nin yerleşim yerindeki veya işlemin yapıldığı yerdeki hakem heyetine ya da mahkemeye yapılabilir.",
          "Üye'nin tüketici sıfatını taşımadığı hâllerde İstanbul Anadolu Mahkemeleri ve İcra Daireleri yetkilidir.",
          "Taraflar, yargı yoluna başvurmadan önce uyuşmazlığın {{EMAIL}} adresi üzerinden iyi niyetle çözülmesi için makul çaba göstermeyi kabul eder. Bu madde, tarafların yasal başvuru yollarına doğrudan gitme hakkını sınırlamaz.",
          "Şirket'in Site üzerinden sunduğu hizmetlere ilişkin şikâyetler, Ticaret Bakanlığı'nın tüketici şikâyet kanalları üzerinden de iletilebilir."
        ]
      },
      {
        "heading": "25. Yürürlük ve Sözleşmenin Saklanması",
        "paragraphs": [
          "İşbu Sözleşme, Üye'nin üyelik formundaki onay kutucuğunu işaretleyip kaydı tamamlamasıyla süresiz olarak yürürlüğe girer ve taraflardan birinin Sözleşme'de öngörülen usullerle feshine kadar geçerliliğini korur.",
          "Sözleşme'nin onaylanan sürümü, onay tarihi ve saati, IP adresi ile tarayıcı bilgisi Şirket sistemlerinde saklanır. Üye, kendisine uygulanan sürümün bir örneğini {{EMAIL}} adresine başvurarak talep edebilir.",
          "Sözleşme'nin güncel metni her zaman {{SITE_URL}} adresinde erişilebilir durumda tutulur; Üye Sözleşme'yi yazdırabilir veya elektronik ortamda saklayabilir.",
          "Sözleşme'nin dili Türkçedir. Bilgilendirme amacıyla başka bir dilde çeviri sunulması hâlinde, uyuşmazlık durumunda Türkçe metin esas alınır."
        ]
      },
      {
        "heading": "26. İletişim",
        "paragraphs": [
          "Üyelik, sipariş, iade, kişisel verilerin korunması ve diğer tüm başvurular için aşağıdaki iletişim kanalları kullanılabilir. Yazılı başvuruların kayıt altına alınabilmesi bakımından e-posta yolu tercih edilmelidir.",
          "Sosyal medya hesaplarımız yalnızca tanıtım ve topluluk iletişimi amacıyla kullanılır; resmî başvurular, şikâyetler ve kişisel veri talepleri bu kanallar üzerinden işleme alınmaz."
        ],
        "table": [
          {
            "key": "Ticaret unvanı",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Adres",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Instagram",
            "value": "{{IG}}"
          },
          {
            "key": "TikTok",
            "value": "{{TIKTOK}}"
          },
          {
            "key": "YouTube",
            "value": "{{YOUTUBE}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "MERSİS numarası",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil numarası",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "Banka",
            "value": "{{BANK}}"
          },
          {
            "key": "IBAN",
            "value": "{{IBAN}}"
          }
        ]
      }
    ]
  },
  {
    "slug": "fikri-mulkiyet",
    "title": "Fikri Mülkiyet ve Telif Hakları",
    "shortTitle": "Fikri Mülkiyet",
    "category": "Site & Üyelik",
    "summary": "{{SITE_URL}} adresinde yayımlanan tüm metin, görsel, video, yazılım ve veri tabanı içeriği ile {{BRAND}} markasına ilişkin hakların sahipliğini, kullanıcılara tanınan sınırlı lisansı, yasaklanan kullanımları ve hak ihlali bildirim usulünü düzenleyen politikadır.",
    "references": [
      "5846 sayılı Fikir ve Sanat Eserleri Kanunu",
      "6769 sayılı Sınai Mülkiyet Kanunu",
      "5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun",
      "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun",
      "Elektronik Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hakkında Yönetmelik",
      "Ticari İletişim ve Ticari Elektronik İletiler Hakkında Yönetmelik",
      "6102 sayılı Türk Ticaret Kanunu (haksız rekabete ilişkin hükümler ve m.1524)",
      "6098 sayılı Türk Borçlar Kanunu",
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
      "Mesafeli Sözleşmeler Yönetmeliği (Resmî Gazete: 27.11.2014, sayı 29188)",
      "6698 sayılı Kişisel Verilerin Korunması Kanunu",
      "Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik",
      "Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ",
      "6100 sayılı Hukuk Muhakemeleri Kanunu (m.193 delil sözleşmesi)",
      "5237 sayılı Türk Ceza Kanunu",
      "Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği",
      "Edebiyat ve Sanat Eserlerinin Korunmasına İlişkin Bern Sözleşmesi",
      "Sınai Mülkiyetin Himayesine Mahsus Milletlerarası Bir İttihat İhdas Edilmesine Dair Paris Sözleşmesi"
    ],
    "sections": [
      {
        "heading": "1. Amaç, Kapsam ve Taraflar",
        "paragraphs": [
          "İşbu Fikri Mülkiyet ve Telif Hakları Politikası (Politika), {{SITE_URL}} adresinde yayımlanan internet sitesi, bu site üzerinden erişilen çevrimiçi mağaza (bottega), kafe menüsü, mobil görünüm, e-posta bültenleri, basın materyalleri ve {{HANDLE}} kullanıcı adıyla işletilen sosyal medya hesapları üzerinden yayımlanan içeriklere ilişkin fikri ve sınai mülkiyet haklarının sahipliğini, kullanım koşullarını ve ihlal hâlinde uygulanacak usulü düzenlemek amacıyla hazırlanmıştır.",
          "Politika'da geçen Şirket ifadesi, ticaret unvanı {{LEGAL_NAME}} olan ve ticari faaliyetlerini {{BRAND}} markası altında yürüten tüzel kişiyi; Site ifadesi {{SITE_URL}} adresindeki internet sitesi ile bağlı tüm alt alan adlarını ve dijital mecraları; Kullanıcı ifadesi Site'yi ziyaret eden, üye olan veya sipariş veren gerçek ya da tüzel kişiyi ifade eder.",
          "Site'yi ziyaret eden veya herhangi bir şekilde içeriğine erişen her Kullanıcı, işbu Politika'yı okuduğunu, anladığını ve hükümleriyle bağlı olduğunu kabul etmiş sayılır. Politika, Üyelik Sözleşmesi ile Mesafeli Satış Sözleşmesi'nin ayrılmaz eki niteliğindedir; bu belgeler arasında fikri mülkiyet konusunda çelişki bulunması hâlinde işbu Politika hükümleri uygulanır.",
          "İşbu Politika, Kullanıcı'nın 6502 sayılı Tüketicinin Korunması Hakkında Kanun ile Mesafeli Sözleşmeler Yönetmeliği'nden doğan haklarını hiçbir şekilde sınırlamaz; satın alınan fiziksel ürünlere ilişkin ayıp, cayma ve iade hakları saklıdır."
        ],
        "table": [
          {
            "key": "Hak sahibi ticaret unvanı",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Kısa unvan",
            "value": "{{SHORT_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Adres",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "Vergi dairesi",
            "value": "{{TAX_OFFICE}}"
          },
          {
            "key": "Vergi kimlik no",
            "value": "{{TAX_NO}}"
          },
          {
            "key": "MERSİS no",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil no",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          }
        ]
      },
      {
        "heading": "2. Tanımlar",
        "paragraphs": [
          "İşbu Politika'da kullanılan kavramlar, aksi açıkça belirtilmedikçe aşağıdaki anlamları taşır. Tanımlanmayan kavramlar bakımından 5846 sayılı Fikir ve Sanat Eserleri Kanunu ile 6769 sayılı Sınai Mülkiyet Kanunu'ndaki tanımlar esas alınır."
        ],
        "table": [
          {
            "key": "Eser",
            "value": "Sahibinin hususiyetini taşıyan ve ilim, edebiyat, musiki, güzel sanatlar veya sinema eserleri olarak sayılan her nevi fikir ve sanat ürünü"
          },
          {
            "key": "Site İçeriği",
            "value": "Site'de yer alan metin, başlık, ürün açıklaması, menü tarifi, blog yazısı, fotoğraf, illüstrasyon, ikon, animasyon, video, ses kaydı, tipografi düzeni, arayüz tasarımı, kaynak kodu ve veri tabanı dâhil tüm unsurlar"
          },
          {
            "key": "Marka Unsurları",
            "value": "{{BRAND}} adı, logo, kelime ve şekil markaları, slogan, ambalaj ve etiket tasarımı, kurumsal renk ve tipografi sistemi, alan adı ve sosyal medya kullanıcı adı"
          },
          {
            "key": "Kullanıcı İçeriği",
            "value": "Kullanıcı tarafından Site'ye veya Şirket'in sosyal medya hesaplarına yüklenen yorum, değerlendirme, puanlama, fotoğraf, video, soru-cevap ve benzeri her türlü içerik"
          },
          {
            "key": "Sınırlı Lisans",
            "value": "İşbu Politika'nın 8'inci maddesinde tanımlanan; kişisel, ticari olmayan, devredilemez, alt lisansa konu edilemez ve her an geri alınabilir görüntüleme izni"
          },
          {
            "key": "Otomatik Erişim",
            "value": "Robot, örümcek (crawler), kazıyıcı (scraper), betik, veri madenciliği aracı veya benzeri otomatik yöntemlerle Site'ye erişim ve içerik toplama"
          },
          {
            "key": "İhlal Bildirimi",
            "value": "Site İçeriği'nin veya Marka Unsurları'nın izinsiz kullanıldığı ya da üçüncü kişi haklarının Site'de ihlal edildiği iddiasıyla {{EMAIL}} adresine yapılan yazılı başvuru"
          }
        ]
      },
      {
        "heading": "3. Hak Sahipliği ve Korunan Unsurlar",
        "paragraphs": [
          "Site İçeriği'nin ve Marka Unsurları'nın tamamı üzerindeki fikri ve sınai mülkiyet hakları, aksi açıkça belirtilmedikçe {{LEGAL_NAME}}'ne aittir veya Şirket, hak sahiplerinden aldığı geçerli lisanslar çerçevesinde bu içerikleri kullanma yetkisine sahiptir.",
          "Site'ye erişim, üyelik oluşturma, sipariş verme veya ürün satın alma; Site İçeriği veya Marka Unsurları üzerinde Kullanıcı'ya herhangi bir mülkiyet, ortak hak sahipliği, devir ya da işbu Politika'da açıkça tanımlanan Sınırlı Lisans dışında bir kullanım hakkı sağlamaz. Fiziksel bir ürünün satın alınması, o ürün üzerindeki mülkiyeti devreder; ürün üzerinde yer alan marka, tasarım, ambalaj görseli ve tarif üzerindeki fikri haklar Şirket'te kalmaya devam eder.",
          "Şirket'in fikri mülkiyet hakları, tescile bağlı olsun ya da olmasın doğar ve korunur. Tescilsiz unsurlar bakımından da 5846 sayılı Kanun'dan doğan eser sahipliği hakları ile 6102 sayılı Türk Ticaret Kanunu'nun haksız rekabete ilişkin hükümleri (m.54 vd.) uygulanır."
        ],
        "bullets": [
          "Metin içerikleri: ana sayfa ve kategori metinleri, marka hikâyesi anlatımı, kavurma notları, tadım profilleri, hazırlama önerileri, sıkça sorulan sorular, hukuki belge metinleri ve e-posta şablonları.",
          "Ürün açıklamaları: çekirdek menşei, işleme yöntemi, kavurma derecesi, aroma notları, kullanım talimatı, saklama koşulu ve alerjen bilgilendirmesinin özgün ifade biçimi.",
          "Menü ve tarifler: affogato, matcha, espresso, soğuk kahve ve gelato kategorilerindeki kalemlerin adlandırması, tarif kompozisyonu, servis sunum tarifi ve menü düzeni.",
          "Görsel unsurlar: ürün fotoğrafları, mekân ve kavurma atölyesi fotoğrafları, illüstrasyonlar, vektörel çizimler, ikon seti, yenilebilir kupa (edible cup) ve matcha bardağı görselleştirmeleri, arka plan dokuları.",
          "Hareketli içerik: tanıtım videoları, reels formatındaki kısa videolar, animasyonlar, geçiş efektleri ve bunların ses kuşağı ile kurgusu.",
          "Yazılım: Site'nin ön yüz ve arka yüz kaynak kodu, bileşen kütüphanesi, tasarım token'ları, stil sayfaları, yönetim paneli, sipariş ve stok akış mantığı ile bunların dokümantasyonu.",
          "Veri tabanı: ürün, kategori, menü, kampanya ve içerik kayıtlarının seçilme, dizilme ve düzenlenme biçimi ile veri tabanının yapısı.",
          "Marka unsurları: {{BRAND}} adı ve yazım biçimi, logo, ambalaj ve etiket tasarımı, kurumsal renk paleti, tipografi sistemi ve \"Drink it. Eat the cup.\" sloganı.",
          "Ayırt edici mekân sunumu: kafe iç mekân düzeni, servis ekipmanı seçimi ve sunum estetiğinin bütünsel görünümü (ticari takdim şekli)."
        ]
      },
      {
        "heading": "4. Yasal Dayanak",
        "paragraphs": [
          "Site İçeriği ve Marka Unsurları, aşağıda belirtilen ulusal ve uluslararası mevzuat çerçevesinde korunmaktadır. Koruma, herhangi bir bildirim, tescil veya telif işareti kullanımı şartına bağlı olmaksızın eserin meydana getirilmesiyle birlikte kendiliğinden doğar."
        ],
        "ordered": [
          "5846 sayılı Fikir ve Sanat Eserleri Kanunu: Site'deki metinler ilim ve edebiyat eseri, bilgisayar programları ve bunların hazırlık tasarımları ilim ve edebiyat eseri, fotoğraf ve illüstrasyonlar güzel sanat eseri, video ve reels içerikleri sinema eseri niteliğindedir. Şirket, eser sahibinin mali haklarına (işleme, çoğaltma, yayma, temsil ve işaret, ses ve/veya görüntü nakline yarayan araçlarla umuma iletim) ve manevi haklarına (umuma arz, adın belirtilmesi, eserde değişiklik yapılmasını men etme) dayanır.",
          "5846 sayılı Kanun'un veri tabanlarına ilişkin hükümleri: Site'deki kayıtların seçilmesi ve düzenlenmesindeki özgünlük derlenmiş eser korumasından, veri tabanının oluşturulması için yapılan esaslı yatırım ise veri tabanı yapımcısının sui generis korumasından yararlanır. Veri tabanının önemli bir kısmının izinsiz kopyalanması, aktarılması veya yeniden kullanılması bu koruma kapsamında hukuka aykırıdır.",
          "6769 sayılı Sınai Mülkiyet Kanunu: {{BRAND}} markası ve logosu marka hukuku korumasından; ambalaj, etiket ve arayüz tasarımları tasarım korumasından yararlanır. Kanun'un 7'nci maddesi uyarınca marka sahibinin izni olmaksızın markanın aynısının veya karıştırılma ihtimali doğuracak derecede benzerinin ticaret alanında kullanılması yasaktır; 29'uncu madde bu fiilleri marka hakkına tecavüz olarak tanımlar.",
          "6102 sayılı Türk Ticaret Kanunu: Marka, tanıtım vasıtası, ticaret unvanı veya iş ürünlerinin karıştırılmaya yol açacak biçimde kullanılması ile başkasının iş ürünlerinden yetkisiz yararlanma, haksız rekabet teşkil eder ve ayrıca dava konusu edilebilir.",
          "5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun: İçerik ve yer sağlayıcıların sorumluluğu ile hukuka aykırı içeriğin yayından çıkarılması usulüne dayanak oluşturur.",
          "6098 sayılı Türk Borçlar Kanunu: Fikri haklara yönelik ihlaller aynı zamanda haksız fiil teşkil edebilir; maddi ve manevi tazminat talepleri bu Kanun hükümlerine göre de ileri sürülebilir.",
          "Edebiyat ve Sanat Eserlerinin Korunmasına İlişkin Bern Sözleşmesi ile Sınai Mülkiyetin Himayesine Mahsus Milletlerarası Bir İttihat İhdas Edilmesine Dair Paris Sözleşmesi: Türkiye'nin taraf olduğu bu sözleşmeler uyarınca koruma, Türkiye sınırlarıyla sınırlı olmaksızın taraf ülkelerde de geçerlidir."
        ]
      },
      {
        "heading": "5. Marka, Logo ve Slogan Hakları",
        "paragraphs": [
          "{{BRAND}} adı, bu adın özgün yazım ve tipografik biçimi, logo, amblem, ambalaj ve etiket tasarımları ile \"Drink it. Eat the cup.\" sloganı, Şirket'in ayırt edici işaretleridir ve {{LEGAL_NAME}}'nin münhasır kullanımındadır.",
          "Şirket, marka başvuru ve tescil süreçlerini Türk Patent ve Marka Kurumu nezdinde yürütmektedir. Tescil süreci tamamlanmamış işaretler bakımından dahi, ilk kullanım ve maruf hâle getirme yoluyla kazanılmış haklar ile haksız rekabet hükümlerinden doğan koruma saklıdır. Şirket, tescil durumu hakkında bilgi talep eden üçüncü kişilere {{EMAIL}} adresi üzerinden güncel bilgi sağlar.",
          "Marka Unsurları'nın; Şirket'in yazılı izni olmaksızın ticaret alanında kullanılması, ürün veya hizmet tanıtımında yer verilmesi, arama motoru reklamlarında anahtar kelime olarak satın alınması, işletme adı, ticaret unvanı, ürün adı veya sosyal medya kullanıcı adı olarak benimsenmesi yasaktır.",
          "{{BRAND}} adını veya bu ada karıştırılma ihtimali doğuracak derecede benzer ifadeleri içeren alan adlarının (her uzantıda) tescil edilmesi, satın alınması, satışa çıkarılması veya kullanılması; keza sosyal medya platformlarında marka adını çağrıştıran kullanıcı adlarının açılması, marka hakkına tecavüz ve haksız rekabet oluşturur. Şirket bu tür alan adları ve hesaplar bakımından ilgili tescil kuruluşu, platform ve uyuşmazlık çözüm mekanizmaları nezdinde devir ve iptal talebinde bulunma hakkını saklı tutar."
        ],
        "bullets": [
          "Marka adını içeren alan adı tescili ve alan adı ticareti (domain squatting) yapılamaz.",
          "Marka adı, üçüncü kişilerin ürünlerinin kaynağı veya kalitesi hakkında yanıltıcı izlenim yaratacak biçimde kullanılamaz.",
          "Şirket ile bayilik, franchise, tedarik, iş ortaklığı veya sponsorluk ilişkisi bulunduğu izlenimi yaratacak beyanlarda bulunulamaz; böyle bir ilişki yalnızca yazılı sözleşmeyle kurulur.",
          "Marka Unsurları, üçüncü kişi ürün ve hizmetlerinin ambalajında, etiketinde, menüsünde, tabelasında veya reklam materyalinde kullanılamaz.",
          "Marka Unsurları, hukuka aykırı, yanıltıcı, aşağılayıcı ya da markanın itibarını zedeleyici içeriklerle yan yana getirilemez.",
          "Yalnızca haber verme, eleştiri, karşılaştırma veya dürüstlük kuralına uygun tanıtıcı kullanım amacıyla ve markanın kaynak gösterme işlevini zedelemeyecek ölçüde yapılan atıflar bu yasakların dışındadır."
        ]
      },
      {
        "heading": "6. Yazılım, Kaynak Kodu ve Veri Tabanı Hakları",
        "paragraphs": [
          "Site'nin çalışmasını sağlayan yazılım; ön yüz bileşenleri, sunucu tarafı iş mantığı, yönetim paneli, veri modeli, uygulama programlama arayüzleri, betikler, yapılandırma dosyaları ve teknik dokümantasyon dâhil olmak üzere bir bütün olarak 5846 sayılı Kanun kapsamında eser niteliğindedir ve Şirket'in mali hak sahipliğindedir.",
          "Kullanıcı'nın Site'yi tarayıcı üzerinden görüntülemesi sırasında oluşan geçici teknik kopyalar dışında; yazılımın çoğaltılması, dağıtılması, kiralanması, kamuya sunulması, kaynak koduna dönüştürülmesi, tersine mühendisliğe tabi tutulması, işlenmesi veya bunlardan türev eser oluşturulması yasaktır. Ancak birlikte çalışabilirliğin sağlanması amacıyla mevzuatın açıkça izin verdiği hâller saklıdır.",
          "Site'nin ürün, kategori, menü, fiyat, stok ve içerik kayıtlarından oluşan veri tabanı, Şirket'in esaslı yatırımı sonucu oluşturulmuştur. Veri tabanının tamamının veya nicelik ya da nitelik bakımından önemli bir bölümünün kopyalanması, aktarılması, yeniden kullanılması veya sistematik biçimde önemsiz bölümlerinin tekrar tekrar alınması suretiyle veri tabanının normal kullanımına aykırı davranılması yasaktır.",
          "Site'nin güvenlik önlemlerini, erişim sınırlarını, oturum doğrulamasını, hız sınırlarını (rate limit) veya bot koruma mekanizmalarını aşmaya, devre dışı bırakmaya ya da bunlara müdahale etmeye yönelik her türlü girişim yasaktır ve duruma göre 5237 sayılı Türk Ceza Kanunu'nun bilişim sistemlerine karşı suçlara ilişkin hükümleri kapsamında değerlendirilebilir."
        ]
      },
      {
        "heading": "7. Görsel, Fotoğraf, Video ve Tarif İçerikleri",
        "paragraphs": [
          "Site'de ve {{HANDLE}} hesaplarında yayımlanan tüm fotoğraf, illüstrasyon, ürün görseli, mekân çekimi, video ve reels içerikleri Şirket tarafından veya Şirket adına üretilmiştir. Bu içeriklerin izinsiz indirilmesi, yeniden yayımlanması, filigranının kaldırılması, kırpılması, renk ve kompozisyonunun değiştirilmesi ya da başka bir eserle birleştirilmesi eser sahibinin hem mali hem de manevi haklarına tecavüz teşkil eder.",
          "Menü kalemlerine ait tarifler, hazırlama yöntemleri, oran ve sıralamalar ile bunların özgün anlatım biçimi Şirket'in ticari sırrı ve fikri ürünüdür. Tariflerin ticari amaçla çoğaltılması, başka bir işletmenin menüsünde kullanılması veya yayına konu edilmesi yasaktır. Bir tarifin salt içeriğindeki malzeme listesinin fikri hak korumasından yararlanmadığı hâllerde dahi, tarifin anlatım biçimi, adlandırması ve sunum konsepti korunmaya devam eder.",
          "Ürün açıklamalarında yer alan içindekiler, alerjen uyarıları, net miktar, menşe ve saklama koşulu bilgileri, Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği kapsamındaki zorunlu bilgilendirme yükümlülüğünün gereğidir. Bu bilgilerin kanuni bilgilendirme amacıyla aktarılması serbest olmakla birlikte, açıklama metinlerinin özgün ifade biçiminin kopyalanması telif ihlali oluşturur.",
          "Sosyal medya platformlarının kendi kullanım koşulları çerçevesinde sağladığı gömme (embed), paylaşma ve yeniden paylaşma (repost) işlevlerinin, içeriğe müdahale edilmeksizin ve kaynak bağlantısı korunarak kullanılması bu maddedeki yasakların kapsamı dışındadır."
        ]
      },
      {
        "heading": "8. Kullanıcıya Tanınan Sınırlı Kullanım Lisansı",
        "paragraphs": [
          "Şirket, işbu Politika'ya uyulması kaydıyla Kullanıcı'ya; Site İçeriği'ni yalnızca kişisel ve ticari olmayan amaçlarla görüntülemesi için münhasır olmayan, devredilemez, alt lisansa konu edilemez, coğrafi olarak sınırsız ancak süre bakımından her an geri alınabilir bir kullanım lisansı tanır.",
          "Bu lisans, Site'nin normal kullanımı çerçevesinde sayfaların tarayıcıda görüntülenmesini, tek nüsha halinde kişisel arşiv için yazdırılmasını veya cihaza kaydedilmesini, sipariş onayı ve fatura gibi belgelerin saklanmasını kapsar. Lisans, bunun ötesinde hiçbir kullanım hakkı vermez.",
          "Sınırlı Lisans, Şirket'in herhangi bir gerekçe göstermeksizin ve önceden bildirimde bulunmaksızın geri alınabileceği bir izindir. Politika'ya aykırı bir kullanım tespit edilmesi hâlinde lisans kendiliğinden sona erer ve Kullanıcı, kendisinde bulunan tüm kopyaları imha etmekle yükümlü hâle gelir.",
          "5846 sayılı Kanun'un iktibas, haber verme, eleştiri ve kişisel kullanım gibi hâllere ilişkin serbestlik hükümleri saklıdır. Bu kapsamda yapılan alıntılarda kaynağın ve eser sahibinin açıkça belirtilmesi, alıntının amacın haklı kıldığı ölçüyü aşmaması ve eserin normal kullanımına zarar vermemesi gerekir."
        ],
        "bullets": [
          "İzin verilen: Site'nin kişisel amaçla görüntülenmesi ve gezinilmesi.",
          "İzin verilen: Bir ürün veya sayfanın bağlantısının (URL) sosyal medyada ya da mesajlaşma uygulamalarında paylaşılması.",
          "İzin verilen: Sipariş özeti, fatura, kargo bildirimi ve hukuki belgelerin kişisel arşiv için indirilmesi ve yazdırılması.",
          "İzin verilen: Haber, eleştiri, akademik çalışma veya tüketici değerlendirmesi kapsamında, kaynak gösterilerek ve ölçülü biçimde kısa alıntı yapılması.",
          "İzin verilmeyen: İçeriğin toplu indirilmesi, arşivlenmesi, yeniden yayımlanması veya başka bir platformda tekrar sunulması.",
          "İzin verilmeyen: İçeriğin ücretli, reklam destekli veya üyelik gerektiren herhangi bir hizmette kullanılması.",
          "İzin verilmeyen: Telif, marka veya sahiplik bildirimlerinin, filigranların ya da meta verilerin kaldırılması veya değiştirilmesi."
        ]
      },
      {
        "heading": "9. Yasaklanan Kullanımlar",
        "paragraphs": [
          "Aşağıda sayılan fiiller, Sınırlı Lisans'ın kapsamı dışında olup Şirket'in fikri ve sınai mülkiyet haklarına tecavüz, haksız rekabet ve sözleşmeye aykırılık teşkil eder. Sayım örnekleyicidir; burada yer almayan ancak hak ihlali doğuran kullanımlar da yasaktır."
        ],
        "ordered": [
          "Site İçeriği'nin tamamının veya bir bölümünün çoğaltılması, kopyalanması, çoğaltılmış nüshalarının dağıtılması, satılması, kiralanması veya ödünç verilmesi.",
          "İçeriğin işlenmesi, uyarlanması, çevrilmesi, yeniden düzenlenmesi veya bunlardan türev eser meydana getirilmesi ve bu türev eserin yayımlanması.",
          "Site'nin tasarımının, sayfa düzeninin, renk ve tipografi sisteminin, gezinme yapısının veya arayüz akışının bütün olarak taklit edilmesi suretiyle karıştırılma ihtimali yaratılması.",
          "Site'nin veya sayfalarının çerçeveleme (framing), gömme (inline linking), yansıtma (mirroring) veya proxy yoluyla başka bir sitenin parçasıymış gibi sunulması; Şirket'in içeriğinin başka bir markanın kimliği altında gösterilmesi.",
          "Site'ye robot, örümcek, kazıyıcı, betik veya benzeri otomatik araçlarla erişilmesi; içeriğin, ürün ve fiyat bilgilerinin sistematik biçimde toplanması (scraping) ve derlenmesi.",
          "Site'den elde edilen verilerin fiyat karşılaştırma, pazar araştırması, ürün kataloğu oluşturma veya rakip fiyatlandırma amacıyla ticari olarak kullanılması.",
          "İçeriğin metin ve veri madenciliğine (text and data mining) tabi tutulması ile yapay zekâ, makine öğrenmesi veya büyük dil modeli sistemlerinin eğitilmesi, ince ayarı, doğrulanması ya da bir veri kümesine dâhil edilmesi amacıyla toplu olarak çekilmesi veya işlenmesi.",
          "Marka Unsurları'nı içeren veya bunlara karıştırılma ihtimali doğuracak derecede benzeyen alan adlarının tescil edilmesi, kullanılması veya devredilmesi; sosyal medya hesabı açılması.",
          "Marka Unsurları'nın arama motoru reklamlarında anahtar kelime olarak satın alınması ya da meta etiketlerinde, gizli metinlerde veya yapılandırılmış verilerde yanıltıcı biçimde kullanılması.",
          "Site İçeriği kullanılarak Şirket'in ürün ve hizmetleriyle rekabet eden bir ürün, hizmet, uygulama, katalog ya da veri kümesi oluşturulması.",
          "Telif, marka, sahiplik ve kaynak bildirimlerinin; filigranların, imzaların, dosya meta verilerinin veya haklar yönetimi bilgilerinin kaldırılması, gizlenmesi ya da tahrif edilmesi.",
          "Site'nin teknik koruma önlemlerinin, erişim denetimlerinin, robots.txt yönergelerinin veya hız sınırlarının aşılması; sunucu altyapısına orantısız yük bindirilmesi.",
          "Site İçeriği'nin, Şirket ile bağlantılı olduğu veya Şirket tarafından onaylandığı izlenimi yaratacak biçimde kullanılması.",
          "Site İçeriği'nin hukuka aykırı, yanıltıcı, karalayıcı ya da markanın itibarını zedeleyici bir bağlamda sunulması."
        ]
      },
      {
        "heading": "10. Otomatik Erişim, Veri Madenciliği ve Yapay Zekâ Eğitimi",
        "paragraphs": [
          "{{LEGAL_NAME}}, Site İçeriği'nin metin ve veri madenciliği ile yapay zekâ modellerinin eğitimi amacıyla kullanılmasına ilişkin haklarını açıkça ve kayıtsız şartsız saklı tutar. İşbu madde, hak sahibinin bu yöndeki iradesinin makine tarafından okunabilir ve yazılı biçimde açık beyanı niteliğindedir.",
          "Site'nin robots.txt dosyasında ve sayfa üstbilgilerinde yer alan yönergeler ile bu maddedeki beyanlar, ayrım gözetilmeksizin tüm otomatik erişim araçlarını, arama motoru dışı tarayıcıları ve model eğitimi amacıyla veri toplayan sistemleri bağlar. Bu yönergelere aykırı erişim, yetkisiz erişim sayılır.",
          "Şirket, arama motorlarının Site'yi yalnızca dizine ekleme ve arama sonuçlarında bağlantı gösterme amacıyla taramasına, bu amaçla sınırlı olmak üzere ve teknik yönergelere uyulması kaydıyla izin verir. Bu izin, taranan içeriğin model eğitiminde veya üretken yanıtlarda içeriğin yerine geçecek biçimde kullanılmasını kapsamaz.",
          "Metin ve veri madenciliği ya da model eğitimi amacıyla Site İçeriği'ni kullanmak isteyen gerçek veya tüzel kişiler, {{EMAIL}} adresine yazılı olarak başvurabilir. Kullanım ancak Şirket ile ayrı bir yazılı lisans sözleşmesi imzalanması hâlinde mümkündür.",
          "Şirket, otomatik erişim tespit ettiği IP adreslerini, ağ bloklarını, kullanıcı aracılarını (user agent) ve hesapları önceden bildirimde bulunmaksızın engelleme; teknik önlem alma ve hukuki yollara başvurma hakkını saklı tutar. Bu kapsamda tutulan trafik ve güvenlik kayıtları, 5651 sayılı Kanun ve ilgili mevzuattaki süreler boyunca saklanır ve 6698 sayılı Kanun'a uygun olarak işlenir."
        ]
      },
      {
        "heading": "11. Kullanıcı İçeriği ve Şirket'e Verilen Lisans",
        "paragraphs": [
          "Kullanıcı, Site'ye veya Şirket'in sosyal medya hesaplarına yüklediği yorum, değerlendirme, puanlama, fotoğraf, video ve benzeri Kullanıcı İçeriği üzerindeki hak sahipliğini korur. Şirket, Kullanıcı İçeriği üzerinde mülkiyet hakkı iddia etmez.",
          "Kullanıcı, Kullanıcı İçeriği'ni yüklemekle birlikte Şirket'e; bu içeriği Site'de, kampanya ve tanıtım materyallerinde, e-posta bültenlerinde, basın kitinde ve {{HANDLE}} sosyal medya hesaplarında yayımlaması, çoğaltması, yayması, umuma iletmesi, biçimlendirme ve boyutlandırma amacıyla teknik olarak işlemesi için münhasır olmayan, dünya çapında geçerli, bedelsiz, devredilebilir ve alt lisans verilebilir bir kullanım lisansı verir.",
          "Bu lisans, Kullanıcı İçeriği'nin anlamını, bağlamını veya bütünlüğünü bozacak değişiklikler yapma yetkisi vermez. Kullanıcı, adının veya kullanıcı adının belirtilmesini ya da belirtilmemesini talep edebilir; talep {{EMAIL}} adresine iletilir.",
          "Kullanıcı, içeriğini Site'den kaldırdığında veya {{EMAIL}} adresine talepte bulunduğunda, Şirket bu içeriğin yayımını makul süre içinde durdurur. Ancak talebin ulaşmasından önce üçüncü kişilerce yapılmış paylaşımlar, basılı olarak üretilmiş materyaller ve arşiv kopyaları bakımından Şirket'in teknik olarak geri alma imkânı bulunmayabilir. Kanuni saklama yükümlülükleri ile devam eden uyuşmazlıklara ilişkin kayıtlar saklı kalır.",
          "Kullanıcı İçeriği'nin işlenmesinde kişisel veri niteliği taşıyan unsurlar bakımından 6698 sayılı Kişisel Verilerin Korunması Kanunu ile Şirket'in Aydınlatma Metni ve Gizlilik Politikası uygulanır."
        ],
        "bullets": [
          "Kullanıcı, yüklediği içeriğin kendisine ait olduğunu veya gerekli tüm izinlere sahip olduğunu taahhüt eder.",
          "Kullanıcı, içerikte yer alan üçüncü kişilerin görüntü ve ses kaydına ilişkin rızalarını aldığını beyan eder.",
          "Üçüncü kişilerin telif, marka, kişilik hakkı veya ticari sırlarını ihlal eden içerik yüklenemez.",
          "Hakaret, nefret söylemi, ayrımcılık, müstehcenlik, şiddete teşvik veya suç işlemeye yönlendirme içeren içerik yüklenemez.",
          "Sağlık beyanı niteliğinde, tıbbi tedavi vaat eden veya gıda mevzuatına aykırı iddialar içeren yorumlar yayımlanmayabilir.",
          "Ücret, indirim veya karşılık alınarak yazılan değerlendirmelerde bu ilişki açıkça belirtilmelidir; aksi hâlde içerik yayımdan kaldırılabilir.",
          "Şirket, hukuka veya işbu Politika'ya aykırı Kullanıcı İçeriği'ni önceden bildirim şartı olmaksızın yayımdan kaldırma veya erişime kapatma hakkını saklı tutar.",
          "Kullanıcı İçeriği'nden doğan hukuki ve cezai sorumluluk, içeriği yükleyen Kullanıcı'ya aittir."
        ]
      },
      {
        "heading": "12. Üçüncü Taraf Hakları, Lisanslı Bileşenler ve Bağlantılar",
        "paragraphs": [
          "Site'de, üçüncü kişilere ait olup Şirket'in geçerli lisanslar çerçevesinde kullandığı bileşenler bulunabilir. Bu bileşenler üzerindeki haklar ilgili hak sahiplerine aittir ve bunların kullanımı, ilgili lisans koşullarına tabidir. Söz konusu bileşenlerin işbu Politika kapsamındaki Site İçeriği'ne dâhil edilmesi, üzerlerinde Şirket'e ait bir hak sahipliği iddiası anlamına gelmez.",
          "Şirket, kullandığı açık kaynak yazılım kütüphanelerinin lisans koşullarına uygunluğu bakımından bir envanter tutar; lisans metinlerini ve atıf yükümlülüklerini muhafaza eder. Bir açık kaynak bileşenin lisans metnine erişim talebi {{EMAIL}} adresine iletilebilir.",
          "Site'de üçüncü taraf internet sitelerine bağlantı verilebilir. Bu bağlantılar yalnızca kolaylık amacıyla sunulmuştur; bağlantı verilen sitelerin içeriğinden, fikri mülkiyet uyumundan ve gizlilik uygulamalarından Şirket sorumlu değildir. Şirket, hukuka aykırı içerik barındırdığı bildirilen bağlantıları kaldırır.",
          "Şirket, üçüncü kişilerin fikri mülkiyet haklarına saygı gösterir. Site'de yer alan bir içeriğin üçüncü kişi haklarını ihlal ettiğini düşünen hak sahipleri, işbu Politika'nın 13'üncü maddesindeki usule göre başvurabilir."
        ],
        "table": [
          {
            "key": "Barındırma",
            "value": "Bulut barındırma sağlayıcısı; altyapı yazılımları kendi lisanslarına tabidir"
          },
          {
            "key": "Veri tabanı",
            "value": "PostgreSQL tabanlı yönetilen veri tabanı hizmeti; satır düzeyi güvenlik etkin"
          },
          {
            "key": "İşlemsel e-posta",
            "value": "Sipariş, üyelik ve bildirim e-postalarının iletimi için e-posta altyapı sağlayıcısı"
          },
          {
            "key": "Ödeme altyapısı",
            "value": "Ödeme kuruluşu veya banka sanal POS altyapısı; ilgili kuruluşun marka ve yazılım hakları kendisine aittir"
          },
          {
            "key": "Kargo",
            "value": "Yurtiçi Kargo, Aras Kargo ve İstanbul içi motokurye hizmet sağlayıcıları; unvan ve logoları kendilerine aittir"
          },
          {
            "key": "Yazı tipleri",
            "value": "Lisanslı veya açık lisanslı yazı tipi aileleri; lisans koşulları yazı tipi sağlayıcısına aittir"
          },
          {
            "key": "Açık kaynak bileşenler",
            "value": "Ön yüz ve arka yüz kütüphaneleri; ilgili açık kaynak lisans metinleri saklanır ve talep hâlinde paylaşılır"
          }
        ]
      },
      {
        "heading": "13. Hak İhlali Bildirimi ve Değerlendirme Usulü",
        "paragraphs": [
          "Site'de yayımlanan bir içeriğin fikri mülkiyet haklarını ihlal ettiğini düşünen hak sahipleri veya yetkili temsilcileri, {{EMAIL}} adresine e-posta göndererek ya da {{ADDRESS}} adresine yazılı bildirim yaparak başvurabilir. Başvuru için ayrıca {{PHONE}} numarasından yönlendirme alınabilir.",
          "Bildirimin usulüne uygun sayılabilmesi için aşağıdaki bilgilerin eksiksiz olarak sunulması gerekir. Eksik bildirimlerde Şirket, eksikliğin tamamlanmasını talep eder ve değerlendirme süresi eksikliğin giderildiği tarihte başlar.",
          "Şirket, usulüne uygun bildirimi aldığı tarihten itibaren en geç üç iş günü içinde başvuruyu kayda alarak başvurana bir alındı bildirimi gönderir; bildirimi en geç yedi iş günü içinde sonuçlandırır. Açık ve tartışmasız ihlallerde içerik, değerlendirme tamamlanmadan tedbiren yayımdan kaldırılabilir.",
          "Şirket'in içeriği yayımdan kaldırması, ihlalin varlığının kabulü anlamına gelmez ve tarafların yargı yoluna başvurma haklarını ortadan kaldırmaz. Şirket, kötüniyetli veya dayanaksız bildirimler nedeniyle uğradığı zararları talep etme hakkını saklı tutar."
        ],
        "ordered": [
          "Başvuranın adı, soyadı veya ticaret unvanı, adresi, telefon numarası ve e-posta adresi.",
          "Başvuran hak sahibi değilse, temsil yetkisini gösteren vekâletname veya yetki belgesi.",
          "İhlal edildiği iddia edilen eserin, markanın veya tasarımın tanımı; varsa tescil, başvuru ya da yayım bilgileri.",
          "Hak sahipliğini gösteren belgeler: ilk yayım tarihi, kaynak dosya, sözleşme, tescil belgesi veya benzeri deliller.",
          "İhlalin gerçekleştiği içeriğin Site üzerindeki tam adresi (URL) ve mümkünse ekran görüntüsü.",
          "İhlalin ne şekilde gerçekleştiğine dair açıklama ve talep edilen işlem (içeriğin kaldırılması, düzeltilmesi veya kaynak gösterilmesi).",
          "Başvuranın, kullanımın hak sahibi tarafından yetkilendirilmediğine ve mevzuatın izin verdiği hâllerden birine girmediğine dair beyanı.",
          "Bildirimde yer alan bilgilerin doğru olduğuna, aksi hâlde doğacak hukuki sorumluluğun kabul edildiğine dair beyan ve imza (elektronik ortamda ad-soyad beyanı)."
        ],
        "bullets": [
          "Alındı bildirimi: usulüne uygun başvurunun ulaşmasından itibaren en geç üç iş günü.",
          "Sonuçlandırma: en geç yedi iş günü; teknik veya hukuki inceleme gerektiren hâllerde başvurana gerekçe bildirilerek bir defaya mahsus yedi iş günü ek süre.",
          "Tedbiren kaldırma: açık ihlal hâlinde derhâl, değerlendirme sonucu beklenmeksizin.",
          "Sonuç bildirimi: alınan karar, gerekçesi ve varsa karşı bildirim hakkı başvurana yazılı olarak iletilir.",
          "Kayıt: her bildirim, karar ve uygulanan işlem tarih, saat ve işlemi yapan yönetici bilgisiyle birlikte değiştirilemez olay kaydına (audit log) yazılır."
        ]
      },
      {
        "heading": "14. Karşı Bildirim ve İtiraz",
        "paragraphs": [
          "İçeriği yayımdan kaldırılan Kullanıcı veya içerik sahibi, kaldırma bildiriminin kendisine ulaşmasından itibaren on beş gün içinde {{EMAIL}} adresine karşı bildirimde bulunabilir. Karşı bildirim, içeriğin hukuka uygun olduğuna dair gerekçe ve delilleri içermelidir.",
          "Karşı bildirimde; içerik sahibinin kimlik ve iletişim bilgileri, kaldırılan içeriğin adresi, içeriğin kendisine ait olduğuna veya kullanım hakkına sahip olduğuna ilişkin açıklama ile bu beyanın doğruluğunun sorumluluğunun kabul edildiğine dair ifade yer alır.",
          "Şirket, karşı bildirimi en geç yedi iş günü içinde inceler. İnceleme sonucunda ihlal iddiasının dayanaksız olduğu kanaatine varılırsa içerik yeniden yayımlanır ve durum ilk başvurana bildirilir. Taraflar arasındaki uyuşmazlığın devam etmesi hâlinde Şirket, yargı kararı verilinceye kadar içeriği erişime kapalı tutabilir.",
          "Şirket, bu maddedeki usulü uygularken taraflar arasında hakem sıfatıyla hareket etmez; yalnızca kendisine iletilen bilgi ve belgeler ışığında, hizmet sağlayıcı sıfatıyla makul bir değerlendirme yapar. Tarafların genel hükümlere göre dava açma hakları her hâlükârda saklıdır."
        ]
      },
      {
        "heading": "15. İçeriğin Yayından Çıkarılması ve Kanuni Usul",
        "paragraphs": [
          "5846 sayılı Fikir ve Sanat Eserleri Kanunu, dijital iletim yoluyla gerçekleştirilen hak ihlallerinde özel bir usul öngörmektedir. Kanun'un ek 4'üncü maddesi uyarınca; hakları ihlal edilen eser sahibi, önce içerik sağlayıcısına başvurarak ihlale konu eserin üç gün içinde yayından kaldırılmasını isteyebilir. Talebin yerine getirilmemesi hâlinde Cumhuriyet savcısına başvurularak, yirmi dört saat içinde içeriğe erişimin engellenmesi istenebilir.",
          "5651 sayılı Kanun kapsamında Şirket, kendi hazırladığı içerik bakımından içerik sağlayıcı; Kullanıcı İçeriği bakımından ise yer sağlayıcı konumundadır. Şirket, yer sağladığı içeriği kontrol etmek veya hukuka aykırı bir faaliyetin söz konusu olup olmadığını araştırmakla yükümlü değildir; ancak hukuka aykırılıktan haberdar edildiğinde teknik olarak imkân bulunduğu ölçüde içeriği yayından kaldırır.",
          "Kişilik haklarının ihlali iddiasıyla yapılan başvurularda 5651 sayılı Kanun'un ilgili hükümleri, fikri haklara yönelik ihlallerde ise 5846 sayılı Kanun'un ek 4'üncü maddesindeki usul öncelikle uygulanır. Her iki hâlde de Şirket, mahkeme, hâkim ve Bilgi Teknolojileri ve İletişim Kurumu kararlarını gecikmeksizin yerine getirir.",
          "Şirket, yayından kaldırılan içeriğe ilişkin kayıtları, kaldırma tarihi ve gerekçesiyle birlikte mevzuatta öngörülen süreler boyunca saklar; bu kayıtları yalnızca yetkili merci talebi üzerine paylaşır."
        ]
      },
      {
        "heading": "16. Basın, Influencer ve İş Ortakları İçin Kullanım İzni",
        "paragraphs": [
          "Basın mensupları, içerik üreticileri, iş ortakları ve etkinlik organizatörleri, {{BRAND}} markasına ve Site İçeriği'ne ilişkin görsel ve metinleri, aşağıdaki koşullara uymak kaydıyla haber, tanıtım ve editoryal amaçlarla kullanabilir. Bu izin, ayrı bir yazılı sözleşme bulunmadıkça ticari reklam kullanımını kapsamaz.",
          "Basın kiti; onaylı logo dosyaları, yüksek çözünürlüklü ürün ve mekân fotoğrafları, marka hikâyesi özeti ve künye bilgilerini içerir. Basın kiti talepleri {{EMAIL}} adresine iletilir; talepler makul süre içinde yanıtlanır.",
          "Influencer ve içerik üreticileriyle yapılan iş birliklerinde; işbirliğinin bedelli olup olmadığı, sağlanan ayni menfaatler ve içerik onay süreci yazılı olarak belirlenir. Bedelli veya karşılıklı menfaat içeren paylaşımlarda, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ile ticari reklam mevzuatı uyarınca iş birliği ilişkisinin açıkça ve okunabilir biçimde belirtilmesi zorunludur.",
          "İş birliği kapsamında üretilen içeriklerde marka adının {{BRAND}} biçiminde, sosyal medya etiketlerinin ise {{HANDLE}} kullanıcı adıyla doğru yazılması gerekir. Yanlış yazım veya yanıltıcı etiketleme hâlinde Şirket düzeltme talep edebilir."
        ],
        "bullets": [
          "Görseller kırpılabilir ancak içerikleri değiştirilemez; filtre, üzerine yazı veya logo eklenerek marka kimliği bozulamaz.",
          "Fotoğraf kullanımında telif künyesi olarak {{BRAND}} adı belirtilir ve mümkünse {{SITE_URL}} adresine bağlantı verilir.",
          "Basın görselleri, üçüncü kişilere satılamaz, stok görsel bankalarına yüklenemez ve alt lisansa konu edilemez.",
          "Marka, siyasi kampanya, dini içerik, alkol ve tütün ürünleri tanıtımı ya da yasa dışı faaliyetlerle ilişkilendirilecek biçimde kullanılamaz.",
          "Menü kalemlerinin fiyatı, içeriği ve bulunabilirliği yayın tarihinde teyit edilmelidir; güncel olmayan bilgiden Şirket sorumlu değildir.",
          "Kafe içinde ticari nitelikte fotoğraf ve video çekimi, diğer misafirlerin görüntü hakları ve işletme düzeni gözetilerek önceden yazılı izne tabidir.",
          "Verilen izin süre ve mecra bakımından sınırlandırılabilir; Şirket, marka itibarını zedeleyen kullanımlarda izni geri alabilir."
        ]
      },
      {
        "heading": "17. Marka Kullanım Rehberi Özeti",
        "paragraphs": [
          "Marka Unsurları'nın izin verilen hâllerde kullanımı, marka bütünlüğünü koruyacak biçimde yapılmalıdır. Aşağıdaki kurallar rehberin özetidir; ayrıntılı kılavuz ve onaylı dosyalar {{EMAIL}} adresinden talep edilebilir.",
          "Marka adı, cümle içinde her zaman {{BRAND}} biçiminde ve kesme işareti korunarak yazılır. Tümü küçük harfle, tümü büyük harfle veya kesme işareti kaldırılarak yazılması, marka adının çoğul ya da fiil hâlinde çekimlenmesi kabul edilmez.",
          "Sosyal medya etiketlemelerinde kullanıcı adı {{HANDLE}} biçimindedir. Resmî hesaplar {{IG}}, {{TIKTOK}} ve {{YOUTUBE}} adreslerinde yer alır; bunların dışındaki hesaplar Şirket'e ait değildir."
        ],
        "bullets": [
          "Logo, yalnızca Şirket tarafından sağlanan onaylı dosyalardan kullanılır; yeniden çizilemez, vektörü bozulamaz.",
          "Logonun en-boy oranı korunur; yatay ya da dikey olarak esnetilemez, eğilemez, döndürülemez.",
          "Logoya gölge, dış çizgi, degrade, doku veya üç boyutlu efekt eklenemez; renkleri değiştirilemez.",
          "Logonun çevresinde, kılavuzda belirtilen asgari boşluk bırakılır; başka logo, metin veya grafikle birleştirilmez.",
          "Logo, okunabilirliği bozacak yoğunlukta arka planlar üzerine yerleştirilmez; kılavuzdaki tek renk ve negatif varyantlar kullanılır.",
          "\"Drink it. Eat the cup.\" sloganı, yalnızca Şirket'in kendi ürün ve iletişiminde kullanılır; üçüncü kişiler bu sloganı ürün, hizmet veya kampanya başlığı olarak kullanamaz.",
          "Marka adı, üçüncü kişilere ait ürün ambalajı, menü, tabela ya da hizmet adında bileşen olarak yer alamaz.",
          "Marka adı ve logosu, Şirket ile resmî bir bağ bulunduğu izlenimi yaratacak biçimde kartvizit, imza bloğu veya kurumsal materyalde kullanılamaz."
        ]
      },
      {
        "heading": "18. Yaptırımlar ve Hukuki Sonuçlar",
        "paragraphs": [
          "İşbu Politika'ya aykırılık tespit edilmesi hâlinde Şirket, ihlalin ağırlığına ve tekrarına göre kademeli olarak tedbir uygular. Uygulanan tedbirler, Şirket'in dava ve tazminat haklarını ortadan kaldırmaz veya sınırlamaz.",
          "Fikri haklara tecavüz hâlinde 5846 sayılı Fikir ve Sanat Eserleri Kanunu uyarınca tecavüzün ref'i, men'i ve tazminat davaları açılabilir. Anılan Kanun'un 68'inci maddesi, izinsiz kullanım hâlinde hak sahibine, sözleşme yapılmış olsaydı istenebilecek bedelin üç katına kadar tazminat talep etme imkânı tanır. Aynı Kanun'un 71'inci maddesi manevi ve mali haklara tecavüz fiilleri için cezai yaptırım öngörür.",
          "Marka hakkına tecavüz hâlinde 6769 sayılı Sınai Mülkiyet Kanunu uyarınca tecavüzün tespiti, durdurulması, giderilmesi, tecavüz oluşturan ürünlere el konulması, maddi ve manevi tazminat ile itibar tazminatı talep edilebilir; anılan Kanun'un 30'uncu maddesi marka hakkına tecavüz suçları bakımından cezai sorumluluk düzenler.",
          "Haksız rekabet teşkil eden fiiller bakımından 6102 sayılı Türk Ticaret Kanunu'nun ilgili hükümlerine göre tespit, men, eski hâle iade ve tazminat talepleri ileri sürülebilir. Ayrıca 6098 sayılı Türk Borçlar Kanunu uyarınca haksız fiil sorumluluğu doğabilir.",
          "Şirket, ihlal nedeniyle uğradığı doğrudan zararlar ile ihlalin tespiti, delillendirilmesi ve takibi için yaptığı makul masrafları (bilirkişi, noter tespiti, avukatlık ücreti dâhil) talep etme hakkını saklı tutar. Kullanıcı'nın Politika'ya aykırı davranışı nedeniyle Şirket'e üçüncü kişilerce yöneltilen taleplerde, Kullanıcı'nın rücu sorumluluğu saklıdır."
        ],
        "ordered": [
          "Uyarı: İhlalin niteliği ve düzeltme için tanınan süre belirtilerek yazılı uyarı gönderilir.",
          "İçeriğin kaldırılması: İhlale konu içerik yayımdan kaldırılır veya erişime kapatılır.",
          "Erişim kısıtlaması: İlgili IP adresi, ağ bloğu, cihaz veya kullanıcı aracısı teknik olarak engellenir.",
          "Hesap tedbirleri: Üyelik hesabı geçici olarak askıya alınır veya ağır ve tekrarlanan ihlallerde kapatılır.",
          "Noter ihtarnamesi: Kullanımın durdurulması ve zararın tazmini talebiyle ihtarname keşide edilir.",
          "Delil tespiti: İhlalin sabitlenmesi amacıyla mahkemeden delil tespiti ve ihtiyati tedbir talep edilir.",
          "Hukuk davası: Tecavüzün ref'i, men'i, maddi ve manevi tazminat ile itibar tazminatı davaları açılır.",
          "Cezai süreç: Suç teşkil eden fiiller bakımından Cumhuriyet başsavcılığına şikâyette bulunulur.",
          "Platform ve alan adı başvuruları: İlgili sosyal medya platformlarına ve alan adı tescil kuruluşlarına kaldırma, iptal ve devir başvurusu yapılır."
        ]
      },
      {
        "heading": "19. Sorumluluk Sınırı ve Beyanlar",
        "paragraphs": [
          "Şirket, Site İçeriği'ni güncel, doğru ve eksiksiz tutmak için makul özeni gösterir. Bununla birlikte, üçüncü kişilerce Site'ye yüklenen Kullanıcı İçeriği'nin fikri mülkiyet uyumu bakımından önceden denetim yükümlülüğü bulunmaz; ihlal bildirimi üzerine işbu Politika'daki usule göre hareket eder.",
          "Şirket'in bu maddedeki sorumluluk sınırlamaları; Şirket'in kastından, ağır kusurundan ve tüketici mevzuatı ile diğer emredici hükümlerden doğan sorumluluğunu hiçbir şekilde ortadan kaldırmaz. Tüketici sıfatını haiz Kullanıcı'nın 6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği'nden doğan hakları saklıdır.",
          "Şirket'in işbu Politika kapsamındaki bir hakkını kullanmaması veya geç kullanması, o haktan feragat ettiği anlamına gelmez. Politika hükümlerinden birinin geçersiz sayılması, diğer hükümlerin geçerliliğini etkilemez; geçersiz hüküm, tarafların amacına en yakın geçerli hükümle ikame edilir.",
          "Kullanıcı, işbu Politika'ya aykırı davranışı nedeniyle üçüncü kişilerin Şirket'e yönelttiği talepler bakımından Şirket'i tazmin etmeyi kabul eder. Bu yükümlülük, Kullanıcı'nın kusuru oranında geçerlidir."
        ]
      },
      {
        "heading": "20. Uygulanacak Hukuk, Yetki ve Delil Sözleşmesi",
        "paragraphs": [
          "İşbu Politika'nın yorumunda ve uygulanmasında Türk hukuku uygulanır.",
          "Politika'dan doğan uyuşmazlıklarda İstanbul Anadolu Mahkemeleri ve İcra Daireleri yetkilidir. Ancak Kullanıcı'nın tüketici sıfatını haiz olduğu hâllerde; tüketici, kendi yerleşim yerindeki veya işlemin yapıldığı yerdeki tüketici hakem heyetlerine ya da tüketici mahkemelerine başvurabilir. Tüketici hakem heyetlerinin görev alanına ilişkin parasal sınırlar, her yıl Ticaret Bakanlığınca yeniden değerleme oranında güncellenir.",
          "Fikri ve sınai haklara ilişkin uyuşmazlıklarda, ihtisas mahkemesi bulunan yerlerde Fikri ve Sınai Haklar Hukuk ve Ceza Mahkemeleri; bulunmayan yerlerde bu sıfatla görevlendirilen mahkemeler görevlidir.",
          "6100 sayılı Hukuk Muhakemeleri Kanunu'nun 193'üncü maddesi uyarınca taraflar; Şirket'in sunucu, uygulama ve güvenlik kayıtlarının, olay kaydının (audit log), e-posta yazışmalarının, erişim ve IP kayıtlarının, ekran görüntülerinin ve elektronik onay kayıtlarının uyuşmazlıklarda kesin delil teşkil edeceğini kabul eder. Bu hüküm, Kullanıcı'nın karşı delil sunma hakkını ortadan kaldırmaz.",
          "Politika, Türkçe olarak düzenlenmiştir. Başka bir dile çevrilmesi hâlinde çeviri yalnızca bilgilendirme amaçlıdır; çelişki hâlinde Türkçe metin esas alınır."
        ]
      },
      {
        "heading": "21. Yürürlük, Güncelleme ve Sürüm",
        "paragraphs": [
          "İşbu Politika, {{SITE_URL}} adresinde yayımlandığı tarihte yürürlüğe girer ve yeni bir sürüm yayımlanıncaya kadar geçerliliğini korur.",
          "Şirket, mevzuat değişiklikleri, iş süreçlerindeki gelişmeler veya hizmet kapsamının genişlemesi hâlinde Politika'yı tek taraflı olarak güncelleyebilir. Güncellenen metin Site'de yayımlandığı anda yürürlük kazanır; esaslı değişikliklerde üyelere e-posta yoluyla ayrıca bilgilendirme yapılır.",
          "Politika'nın önceki sürümleri, sürüm numarası ve yürürlük tarihiyle birlikte arşivlenir. Kullanıcı, sipariş veya üyelik anında yürürlükte olan sürümün bir örneğini {{EMAIL}} adresine talep göndererek edinebilir.",
          "Kullanıcı'nın güncelleme sonrasında Site'yi kullanmaya devam etmesi, yürürlükteki sürümü kabul ettiği anlamına gelir. Tüketici aleyhine sonuç doğuran değişiklikler, kurulmuş sözleşmelere geçmişe etkili olarak uygulanmaz."
        ]
      },
      {
        "heading": "22. İletişim ve Başvuru Kanalları",
        "paragraphs": [
          "Fikri mülkiyet hakları, lisans talepleri, basın kiti istekleri, ihlal bildirimleri ve karşı bildirimler dâhil olmak üzere işbu Politika'ya ilişkin tüm başvurular aşağıdaki kanallardan yapılabilir. Başvurular, Şirket'in kayıt sistemine alınır ve yazılı olarak yanıtlanır.",
          "Kişisel verilerin korunmasına ilişkin talepler için 6698 sayılı Kanun ve Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ kapsamındaki usul uygulanır; bu tür başvurular en geç otuz gün içinde sonuçlandırılır.",
          "Şirket'e ait resmî sosyal medya hesapları yalnızca aşağıda listelenenlerdir. Bu hesaplar dışında {{BRAND}} adını kullanan hesaplar Şirket ile ilişkili değildir ve bu hesapların paylaşımlarından Şirket sorumlu tutulamaz."
        ],
        "table": [
          {
            "key": "Ticaret unvanı",
            "value": "{{LEGAL_NAME}}"
          },
          {
            "key": "Marka",
            "value": "{{BRAND}}"
          },
          {
            "key": "Adres",
            "value": "{{ADDRESS}}"
          },
          {
            "key": "E-posta",
            "value": "{{EMAIL}}"
          },
          {
            "key": "Telefon",
            "value": "{{PHONE}}"
          },
          {
            "key": "İnternet sitesi",
            "value": "{{SITE_URL}}"
          },
          {
            "key": "Instagram",
            "value": "{{IG}}"
          },
          {
            "key": "TikTok",
            "value": "{{TIKTOK}}"
          },
          {
            "key": "YouTube",
            "value": "{{YOUTUBE}}"
          },
          {
            "key": "Sosyal medya kullanıcı adı",
            "value": "{{HANDLE}}"
          },
          {
            "key": "Vergi dairesi / VKN",
            "value": "{{TAX_OFFICE}} / {{TAX_NO}}"
          },
          {
            "key": "Vergi türü",
            "value": "{{TAX_TYPE}}"
          },
          {
            "key": "Faaliyet kodu (NACE)",
            "value": "{{NACE}}"
          },
          {
            "key": "İşe başlama tarihi",
            "value": "{{STARTED_AT}}"
          },
          {
            "key": "MERSİS no",
            "value": "{{MERSIS}}"
          },
          {
            "key": "Ticaret sicil no",
            "value": "{{TRADE_REGISTRY}}"
          },
          {
            "key": "KEP adresi",
            "value": "{{KEP}}"
          },
          {
            "key": "Banka",
            "value": "{{BANK}}"
          },
          {
            "key": "IBAN",
            "value": "{{IBAN}}"
          }
        ]
      }
    ]
  }
];
