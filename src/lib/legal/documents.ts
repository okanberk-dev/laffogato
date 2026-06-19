import { LEGAL_ENTITY } from "./entity";

export interface LegalSection {
  /** H2 başlık. */
  heading: string;
  /** Düz paragraflar (markdown'sız). */
  paragraphs?: string[];
  /** İsteğe bağlı sıralı liste. */
  ordered?: string[];
  /** İsteğe bağlı sırasız liste. */
  bullets?: string[];
  /** Anahtar/değer tablosu — kişisel bilgi tablolarında kullanılır. */
  table?: { key: string; value: string }[];
}

export interface LegalDoc {
  slug: string;
  title: string;
  shortTitle: string;
  /** Sayfanın altındaki son güncelleme tarihi. */
  updatedAt: string;
  /** Üst eyebrow (kategori). */
  category: string;
  /** H1'in altındaki kısa özet. */
  summary: string;
  /** Yasal dayanaklar. */
  references?: string[];
  sections: LegalSection[];
}

const UPDATED = "26 Mayıs 2026";
const A = LEGAL_ENTITY;
const ADDRESS_LINE = `${A.address.line1}, ${A.address.line2}, ${A.address.zip} ${A.address.district}/${A.address.city}, ${A.address.country}`;

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "kullanim-sartlari",
    title: "Kullanım Şartları",
    shortTitle: "Kullanım",
    updatedAt: UPDATED,
    category: "Site & Üyelik",
    summary:
      "L'Affogato web sitesini ve hesabını kullanan herkes için geçerli olan kurallar — üyelik, içerik kullanımı, sorumluluklar.",
    references: [
      "6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun",
      "5651 sayılı Internet Ortamında Yapılan Yayınların Düzenlenmesi Hakkında Kanun",
      "6098 sayılı Türk Borçlar Kanunu (genel hükümler)",
    ],
    sections: [
      {
        heading: "1. Taraflar",
        paragraphs: [
          `İşbu Kullanım Şartları, ${A.legalName} ("L'Affogato" veya "Şirket") ile sitedeki tüm hizmetlerden faydalanan ziyaretçi, kullanıcı ve üyeleri ("Kullanıcı") arasında geçerlidir.`,
          "Siteyi kullanarak işbu şartları kabul etmiş sayılırsınız. Şartları kabul etmiyorsanız siteyi kullanmamanızı rica ederiz.",
        ],
      },
      {
        heading: "2. Hizmetin tanımı",
        paragraphs: [
          "L'Affogato, Tuzla'da faaliyet gösteren bir kahve ve gelato bar işletmecisidir; aynı zamanda kavrulmuş kahve çekirdeği, yenilebilir waffle kupa, gelato kiti, ekipman ve marka ürünlerinin online satışını gerçekleştirir.",
          "Site üzerinden masa rezervasyonu, online sipariş, üyelik açılışı, sipariş takibi ve müşteri iletişim talepleri yönetilir.",
        ],
      },
      {
        heading: "3. Üyelik",
        bullets: [
          "Üyelik 18 yaşını doldurmuş gerçek kişiler tarafından oluşturulabilir.",
          "Üye, kayıt sırasında verdiği bilgilerin doğruluğundan ve güncelliğinden sorumludur.",
          "Üyelik şifresinin gizliliğinden ve hesabıyla yapılan tüm işlemlerden Üye sorumludur.",
          "L'Affogato; sahte bilgi, hileli işlem, kötüye kullanım veya yasaya aykırı kullanım tespit ettiği üyeliği önceden bildirimsiz kapatma hakkını saklı tutar.",
          "Üye, hesabını dilediği zaman üye paneli üzerinden kapatabilir.",
        ],
      },
      {
        heading: "4. Fikri mülkiyet",
        paragraphs: [
          "Site içeriği; metin, görsel, illüstrasyon, ses, video, marka, logo, slogan ve yazılım dahil olmak üzere L'Affogato'ya veya lisans sahibi üçüncü kişilere aittir.",
          'L\'Affogato, "Drink it. Eat the cup.", "L\'Affogato", marka logoları ve yenilebilir kup teknolojisi (1994 patenti) Mancuso ailesinin tescilli haklarıdır.',
          "Bu içerikler L'Affogato'nun açık yazılı izni olmaksızın kopyalanamaz, çoğaltılamaz, dağıtılamaz, yayımlanamaz, ticari amaçla kullanılamaz.",
        ],
      },
      {
        heading: "5. Kullanıcı yükümlülükleri",
        bullets: [
          "Siteyi yürürlükteki mevzuata, genel ahlaka ve kamu düzenine aykırı kullanmamak.",
          "Diğer kullanıcıların erişimini engellememek, hizmeti aksatmaya yönelik faaliyette bulunmamak (DoS, scraping, otomasyon vb.).",
          "Doğru bilgi vermek; kayıt bilgilerini güncel tutmak.",
          "Üçüncü kişilerin fikri mülkiyet, gizlilik ve kişilik haklarını ihlal eden içerik paylaşmamak.",
        ],
      },
      {
        heading: "6. Sorumluluğun sınırlandırılması",
        paragraphs: [
          "L'Affogato, sitenin kesintisiz, hatasız çalışacağını garanti etmez; ancak makul ölçüde sürekli hizmet sunmayı taahhüt eder.",
          "Site üzerinden verilen siparişlerde teslimat süreleri tahminidir; mücbir sebepler (afet, salgın, sınırlamalar, lojistik aksamalar) nedeniyle yaşanabilecek gecikmelerden L'Affogato sorumlu tutulamaz.",
          "Üçüncü taraf bağlantılar veya entegrasyonlar (ödeme sağlayıcı, kargo, sosyal medya) için ilgili tarafların kendi sözleşme ve gizlilik politikaları geçerlidir.",
        ],
      },
      {
        heading: "7. Değişiklikler",
        paragraphs: [
          "L'Affogato, işbu şartları gerektiğinde güncelleyebilir. Önemli değişiklikler üyelere e-posta ile bildirilir; küçük güncellemeler ise yalnızca bu sayfada yayımlanır.",
          "Şartların güncellenmesinden sonra siteyi kullanmaya devam etmeniz, güncel şartları kabul ettiğiniz anlamına gelir.",
        ],
      },
      {
        heading: "8. Uygulanacak hukuk & yetki",
        paragraphs: [
          "İşbu Kullanım Şartları Türkiye Cumhuriyeti kanunlarına tabidir. Doğabilecek uyuşmazlıklarda İstanbul (Anadolu) Mahkemeleri ve İcra Daireleri yetkilidir.",
          "Tüketici sıfatına sahip kullanıcılar, Tüketici Hakem Heyetlerine ve Tüketici Mahkemelerine başvuru hakkını saklı tutar.",
        ],
      },
      {
        heading: "9. İletişim",
        table: [
          { key: "Unvan", value: A.legalName },
          { key: "Adres", value: ADDRESS_LINE },
          { key: "Telefon", value: A.phone },
          { key: "E-posta", value: A.email },
          { key: "KEP", value: A.kep },
          { key: "MERSİS", value: A.mersisNo },
        ],
      },
    ],
  },

  {
    slug: "gizlilik-politikasi",
    title: "Gizlilik Politikası",
    shortTitle: "Gizlilik",
    updatedAt: UPDATED,
    category: "Veri & Gizlilik",
    summary:
      "Hangi kişisel verileri topladığımızı, neden topladığımızı, kiminle paylaştığımızı ve haklarınızı bu sayfada bulabilirsiniz.",
    references: [
      "6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK)",
      "AB 2016/679 sayılı GDPR (yalnızca AB'den ulaşan ziyaretçiler için)",
    ],
    sections: [
      {
        heading: "1. Genel",
        paragraphs: [
          `${A.legalName} ("L'Affogato"), kullanıcı gizliliğini önemser. Bu politika, web sitemiz, mobil uygulamamız ve fiziksel kafemiz aracılığıyla topladığımız kişisel verilerin nasıl işlendiğini açıklar.`,
          `Veri sorumlusu: ${A.dataController}.`,
        ],
      },
      {
        heading: "2. İşlenen veri kategorileri",
        table: [
          {
            key: "Kimlik",
            value: "Ad, soyad, doğum tarihi (opsiyonel).",
          },
          {
            key: "İletişim",
            value: "E-posta, telefon, teslimat adresi.",
          },
          {
            key: "Hesap",
            value:
              "Şifre özet değeri (hash; ham şifre saklanmaz), oturum çerezi, hesap tercihleri.",
          },
          {
            key: "Sipariş & ödeme",
            value:
              "Sipariş kalemleri, tutarı, kupon, fatura adresi. Kart bilgileri tamamen ödeme sağlayıcı üzerinde işlenir; bizde saklanmaz.",
          },
          {
            key: "Kullanım & teknik",
            value:
              "IP adresi, tarayıcı türü, oturum süresi, sayfa görüntülemeleri (Google Analytics 4 veya muadili anonim/agrega).",
          },
          {
            key: "Pazarlama",
            value: "Bülten tercihleri, açılış/tıklama metrikleri.",
          },
        ],
      },
      {
        heading: "3. İşleme amaçları & hukuki sebepler (KVKK m.5)",
        bullets: [
          "Sözleşmenin kurulması ve ifası: sipariş alma, teslimat, fatura kesimi — m.5/2-c.",
          "Hukuki yükümlülüklerin yerine getirilmesi: vergi, ticaret, e-arşiv fatura — m.5/2-ç.",
          "Meşru menfaatler: dolandırıcılığın önlenmesi, hizmet iyileştirme — m.5/2-f.",
          "Açık rıza: bülten, pazarlama, profilleme — m.5/1.",
        ],
      },
      {
        heading: "4. Aktarım",
        paragraphs: [
          "Kişisel verileriniz, hizmetin sunulması için gereken üçüncü taraflarla paylaşılır:",
        ],
        bullets: [
          "Ödeme sağlayıcı (sanal POS / iyzico / PayTR vb.) — kart doğrulama.",
          "Kargo şirketi — teslimat.",
          "Bulut hizmet sağlayıcı (MongoDB Atlas, Vercel) — barındırma; veriler AB veya Türkiye lokasyonunda saklanır.",
          "Yetkili kamu kurum ve kuruluşları — yasal talep halinde.",
          "Muhasebe / hukuk danışmanları — gizlilik sözleşmesi kapsamında.",
        ],
      },
      {
        heading: "5. Yurt dışına aktarım",
        paragraphs: [
          "Kullandığımız bulut sağlayıcıların bir kısmı (örn. MongoDB Atlas, Vercel) verileri AB veya ABD'de saklayabilir. Bu aktarımlar KVKK m.9 kapsamında açık rıza ve/veya yeterli koruma şartları altında gerçekleştirilir.",
        ],
      },
      {
        heading: "6. Saklama süreleri",
        bullets: [
          "Üyelik & sipariş verileri: hesap aktif olduğu sürece + Vergi Usul Kanunu gereği 10 yıl.",
          "Ödeme işlem kayıtları: yasal saklama süresi boyunca (5 yıl).",
          "Çerezler: oturum / 90 gün / 2 yıl — çerez politikasına bakınız.",
          "Pazarlama tercihleri: rıza geri çekilene kadar.",
        ],
      },
      {
        heading: "7. KVKK m.11 — Haklarınız",
        paragraphs: ["Veri sahibi olarak aşağıdaki haklara sahipsiniz:"],
        bullets: [
          "Kişisel verilerin işlenip işlenmediğini öğrenme.",
          "İşlenmişse buna ilişkin bilgi talep etme.",
          "İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme.",
          "Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme.",
          "Eksik veya yanlış işlenmişse düzeltilmesini isteme.",
          "KVKK'ya uygun olarak silinmesini veya yok edilmesini isteme.",
          "Düzeltme, silme veya yok etme işlemlerinin üçüncü kişilere bildirilmesini isteme.",
          "Otomatik sistemlerle yapılan analiz sonucunda aleyhinize bir sonuç çıkmasına itiraz etme.",
          "Hukuka aykırı işleme nedeniyle zarara uğramışsanız tazminat talep etme.",
        ],
      },
      {
        heading: "8. Başvuru",
        paragraphs: [
          `Haklarınızı kullanmak için ${A.legalEmail} adresine kimliğinizi doğrulayan bilgilerle başvurabilirsiniz. Başvurularınız Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ kapsamında en geç 30 gün içinde yanıtlanır.`,
          "Başvuru ücretsizdir; ancak yanıtın yazılı olarak verilmesi halinde 10 sayfayı aşan her sayfa için Kurul'ca belirlenen tarife uygulanabilir.",
        ],
      },
      {
        heading: "9. Güvenlik tedbirleri",
        bullets: [
          "Şifreler bcrypt ile hash'lenir; ham şifre saklanmaz.",
          "Yönetici erişimleri 2FA (TOTP) ile korunur.",
          "Veri tabanı, sektör standardı şifreleme (TLS 1.2+, at-rest encryption) ile erişilir.",
          "Erişim kayıtları (audit log) tüm yönetici işlemleri için tutulur.",
          "Güvenlik açıkları için sorumlu açıklama programımız vardır: " +
            A.legalEmail,
        ],
      },
      {
        heading: "10. İletişim",
        table: [
          { key: "Veri sorumlusu", value: A.dataController },
          { key: "Adres", value: ADDRESS_LINE },
          { key: "KVKK e-posta", value: A.legalEmail },
          { key: "KEP", value: A.kep },
        ],
      },
    ],
  },

  {
    slug: "mesafeli-satis-sozlesmesi",
    title: "Mesafeli Satış Sözleşmesi",
    shortTitle: "Mesafeli satış",
    updatedAt: UPDATED,
    category: "Sipariş",
    summary:
      "İşbu sözleşme, online sipariş süreçlerinde Satıcı ile Alıcı arasında elektronik ortamda kurulur ve siparişe ilişkin tüm hak ve yükümlülükleri düzenler.",
    references: [
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
      "Mesafeli Sözleşmeler Yönetmeliği (RG: 27.11.2014, 29188)",
    ],
    sections: [
      {
        heading: "1. Taraflar",
        table: [
          { key: "Satıcı", value: A.legalName },
          { key: "Adres", value: ADDRESS_LINE },
          { key: "MERSİS", value: A.mersisNo },
          { key: "Vergi", value: `${A.taxOffice} · ${A.taxNo}` },
          { key: "Telefon", value: A.phone },
          { key: "E-posta", value: A.email },
        ],
        paragraphs: [
          "Alıcı: siparişi veren tüketici. Ad, adres ve iletişim bilgileri sipariş onay e-postasında ve fatura üzerinde yer alır.",
        ],
      },
      {
        heading: "2. Sözleşmenin konusu",
        paragraphs: [
          "İşbu sözleşmenin konusu, Alıcı'nın laffogato.com.tr web sitesi üzerinden elektronik ortamda siparişini verdiği, aşağıda nitelikleri ve satış fiyatı belirtilen ürünün satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve yükümlülüklerinin saptanmasıdır.",
        ],
      },
      {
        heading: "3. Sözleşme konusu ürün",
        paragraphs: [
          "Ürünün cinsi, türü, miktarı, marka/modeli, satış bedeli ve ödeme şekli; ön bilgilendirme formu (ödeme sayfasındaki sipariş özeti) ve sipariş onay e-postası ile teyit edilen bilgilerden ibarettir.",
          "Tüm vergiler dahil satış fiyatı sipariş onay e-postasındaki toplam tutardır.",
        ],
      },
      {
        heading: "4. Genel hükümler",
        ordered: [
          "Alıcı, Satıcı'ya ait laffogato.com.tr web sitesinde sözleşme konusu ürünün temel nitelikleri, satış fiyatı ve ödeme şekli ile teslimata ilişkin ön bilgilendirmeleri okuyup bilgi sahibi olduğunu ve elektronik ortamda gerekli teyidi verdiğini beyan eder.",
          "Sözleşme konusu ürün, yasal 30 günlük süreyi aşmamak koşulu ile her bir ürün için Alıcı'nın yerleşim yerinin uzaklığına bağlı olarak ön bilgiler içinde açıklanan süre içinde Alıcı veya gösterdiği adresteki kişi ve/veya kuruluşa teslim edilir.",
          "Sözleşme konusu ürün, Alıcı'dan başka bir kişi/kuruluşa teslim edilecek ise, teslim edilecek kişi/kuruluşun teslimatı kabul etmemesinden Satıcı sorumlu tutulamaz.",
          "Satıcı, sözleşme konusu ürünün sağlam, eksiksiz, siparişte belirtilen niteliklere uygun ve varsa garanti belgeleri ve kullanım kılavuzları ile teslim edilmesinden sorumludur.",
          "Sözleşme konusu ürünün teslimatı için işbu sözleşmenin imzalı nüshasının Satıcı'ya ulaştırılmış olması ve bedelinin Alıcı'nın tercih ettiği ödeme şekli ile ödenmiş olması şarttır. Herhangi bir nedenle ürün bedeli ödenmez veya banka kayıtlarında iptal edilirse, Satıcı ürünün teslimi yükümlülüğünden kurtulmuş kabul edilir.",
          "Ürünün tesliminden sonra Alıcı'ya ait kredi kartının Alıcı'nın kusurundan kaynaklanmayan bir şekilde yetkisiz kişilerce haksız veya hukuka aykırı olarak kullanılması nedeni ile ilgili banka veya finans kuruluşu'nun ürün bedelini Satıcı'ya ödememesi halinde, Alıcı'nın kendisine teslim edilmiş olması kaydıyla ürünün 3 gün içinde Satıcı'ya gönderilmesi zorunludur. Bu takdirde nakliye giderleri Alıcı'ya aittir.",
          "Satıcı mücbir sebepler veya nakliyeyi engelleyen hava muhalefeti, ulaşımın kesilmesi gibi olağanüstü durumlar nedeni ile sözleşme konusu ürünü süresi içinde teslim edemez ise, durumu Alıcı'ya bildirmekle yükümlüdür. Bu takdirde Alıcı siparişin iptal edilmesini, sözleşme konusu ürünün varsa emsali ile değiştirilmesini ve/veya teslimat süresinin engelleyici durumun ortadan kalkmasına kadar ertelenmesini Satıcı'dan talep etme hakkına sahiptir. Alıcı'nın siparişi iptal etmesi halinde ödediği tutar 14 gün içinde kendisine nakden ve defaten ödenir.",
          "İşbu sözleşmenin uygulanmasında Tüketici Hakem Heyetleri ile Alıcı'nın veya Satıcı'nın yerleşim yerindeki Tüketici Mahkemeleri yetkilidir. Parasal sınır her yıl Bakanlıkça ilan edilir.",
          "Siparişin gerçekleşmesi durumunda Alıcı işbu sözleşmenin tüm koşullarını kabul etmiş sayılır.",
        ],
      },
      {
        heading: "5. Cayma hakkı",
        paragraphs: [
          "Alıcı, sözleşme konusu ürünün kendisine veya gösterdiği adresteki kişi/kuruluşa tesliminden itibaren 14 (on dört) gün içinde herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin cayma hakkına sahiptir.",
          "Cayma hakkı bildirimi yazılı olarak veya kalıcı veri saklayıcısı ile (e-posta) yapılır. Cayma hakkının kullanılabilmesi için bu süre içinde Satıcı'ya bildirimde bulunulması ve ürünün 5. maddedeki şartlar çerçevesinde iade edilebilir olması şarttır.",
          "Cayma hakkı bildiriminin yapılmasından itibaren 14 gün içinde ürün tüketiciye iade edilir; Satıcı ödemeleri 14 gün içinde tüketiciye nakden ve defaten iade etmekle yükümlüdür.",
        ],
      },
      {
        heading: "6. Cayma hakkı kullanılamayacak ürünler",
        paragraphs: [
          "Mesafeli Sözleşmeler Yönetmeliği m.15 uyarınca aşağıdaki ürünler için cayma hakkı kullanılamaz:",
        ],
        bullets: [
          "Çabuk bozulabilen veya son kullanma tarihi geçebilecek gıda ürünleri (taze gelato, açılmış kahve çekirdeği vb.).",
          "Tesliminden sonra ambalaj, bant, mühür, paket gibi koruyucu unsurları açılmış olan; iadesi sağlık ve hijyen açısından uygun olmayan ürünler (örn. iç kullanım amaçlı edible kup).",
          "Tüketiciye teslim edildikten sonra başka ürünlerle karışan ve doğası gereği ayrıştırılması mümkün olmayan ürünler.",
          "Tüketicinin istekleri veya açıkça onun kişisel ihtiyaçları doğrultusunda hazırlanan ürünler.",
          "Belirli bir tarihte veya dönemde ifa edilmesi gereken hizmetler (rezervasyon, etkinlik biletleri).",
        ],
      },
      {
        heading: "7. Temerrüt",
        paragraphs: [
          "Tarafların işbu sözleşmeden kaynaklanan edimlerini yerine getirmemesi durumunda 6098 sayılı Türk Borçlar Kanunu'nun 117. maddesi gereği temerrüt hükümleri uygulanır.",
          "Temerrüt halinde, herhangi bir tarafın edimini süresinde ve usulüne uygun olarak yerine getirmemesi durumunda diğer taraf ihtarda bulunabilir; uygun süre verebilir veya sözleşmeden dönebilir.",
        ],
      },
      {
        heading: "8. Yetkili mahkeme",
        paragraphs: [
          "İşbu sözleşmenin uygulanmasında, Sanayi ve Ticaret Bakanlığı'nca ilan edilen değere kadar Tüketici Hakem Heyetleri ile Alıcı'nın veya Satıcı'nın yerleşim yerindeki Tüketici Mahkemeleri yetkilidir.",
        ],
      },
      {
        heading: "9. Yürürlük",
        paragraphs: [
          "Alıcı tarafından elektronik ortamda verilen siparişin Satıcı tarafından kabul edildiğinin Alıcı'ya e-posta ile bildirilmesi anında işbu sözleşme yürürlüğe girer.",
        ],
      },
    ],
  },

  {
    slug: "iade-ve-cayma",
    title: "İade ve Cayma Hakkı",
    shortTitle: "İade",
    updatedAt: UPDATED,
    category: "Sipariş",
    summary:
      "14 gün içinde gerekçesiz cayma hakkınız var. Hangi ürünlere uygulanır, nasıl iade edersiniz, para iadesi ne zaman gelir — adım adım.",
    references: [
      "6502 sayılı Tüketicinin Korunması Hakkında Kanun",
      "Mesafeli Sözleşmeler Yönetmeliği m.9 — Cayma hakkı",
      "Mesafeli Sözleşmeler Yönetmeliği m.15 — Cayma hakkının istisnaları",
    ],
    sections: [
      {
        heading: "1. Cayma hakkı süresi",
        paragraphs: [
          "Ürünü teslim aldığınız tarihten itibaren 14 (on dört) gün içinde gerekçe göstermeden ve cezai şart ödemeden sözleşmeden cayabilirsiniz.",
          "Birden fazla ürünün ayrı ayrı teslim edildiği siparişlerde süre, son ürünün tesliminden itibaren başlar.",
        ],
      },
      {
        heading: "2. Cayma hakkını nasıl kullanırsınız?",
        ordered: [
          "Süre içinde " +
            A.email +
            " adresine e-posta atın; konuda sipariş numaranızı belirtin.",
          "Alternatif olarak üye panelinden iletişime geçin (Hesabım → Siparişlerim → ilgili sipariş).",
          "Ürünü orijinal ambalajı, etiketi ve aksesuarları ile birlikte 14 gün içinde anlaşmalı kargomuza teslim edin.",
          "Kargo şirketi ve iade adresi e-postada paylaşılır.",
        ],
      },
      {
        heading: "3. Cayma hakkı KULLANILAMAYACAK ürünler",
        paragraphs: [
          "Mesafeli Sözleşmeler Yönetmeliği m.15 uyarınca aşağıdaki ürünler için cayma hakkı bulunmaz:",
        ],
        bullets: [
          "Çabuk bozulabilen gıda ürünleri: taze hazırlanmış gelato, kuponla ödenen kafe içeceği.",
          "Açılmış kahve çekirdeği paketi: koruyucu mührü kırılmışsa hijyen açısından iade alınamaz.",
          "Açılmış yenilebilir kup (edible cup) paketleri: gıda hijyen kuralları gereği.",
          "Müşteriye özel hazırlanan ürünler: kişiselleştirilmiş hediye kutuları, isim baskılı kupalar.",
          "Tarih belirli rezervasyonlar ve etkinlik biletleri (örn. tasting masaları).",
        ],
      },
      {
        heading: "4. Para iadesi",
        paragraphs: [
          "Cayma talebi tarafımıza ulaştıktan sonra 14 gün içinde, ödemenin yapıldığı kanal üzerinden para iadeniz başlatılır.",
          "Kredi kartı: bankanıza bağlı olarak hesabınıza yansıması 7-10 iş günü sürebilir.",
          "Havale/EFT: iade banka hesabınız ile aynı isimde olmalıdır. Hesap bilgilerinizi e-posta ile bize iletmeniz gerekir.",
          "Sipariş bedeli iadesi tam olarak yapılır; kargo ücreti yalnızca iade ürün kusurluysa veya yanlış gönderildiyse iade edilir.",
        ],
      },
      {
        heading: "5. Kargo masrafı",
        paragraphs: [
          "Cayma hakkı kullanımında iade kargo masrafı, anlaşmalı kargo firmamızla (Yurtiçi Kargo) ücretsizdir.",
          "Anlaşmalı kargo dışı bir firma ile iade gönderirseniz kargo ücreti tarafınıza aittir.",
          "Ürün kusurlu veya yanlış gönderilmişse tüm kargo ücretleri L'Affogato tarafından karşılanır.",
        ],
      },
      {
        heading: "6. Ürünün durumu",
        bullets: [
          "Ürün; aldığınız ambalajda, satılabilir durumda, kullanılmamış olmalıdır.",
          "Etiket, garanti belgesi, kullanım kılavuzu, hediye paketi gibi tüm aksesuarlar iade edilmelidir.",
          "Ürünü incelemek için ambalajı açabilirsiniz; ancak ürün satılabilir niteliğini kaybedecek şekilde kullanılmış/yıpranmış ise iade kabul edilmeyebilir.",
        ],
      },
      {
        heading: "7. Kusurlu ürün",
        paragraphs: [
          "Teslimat sırasında veya sonrasında ürünü kusurlu bulursanız, 30 gün içinde " +
            A.email +
            " adresine fotoğraf ile birlikte bildirim yapın.",
          "Tüketicinin Korunması Hakkında Kanun m.11 kapsamında onarım, değişim, indirim veya iade haklarınızı kullanabilirsiniz.",
        ],
      },
      {
        heading: "8. Tüketici şikayet kanalları",
        bullets: [
          "L'Affogato müşteri hizmetleri: " + A.email + " · " + A.phone,
          "T.C. Ticaret Bakanlığı Tüketici Hakem Heyeti: tuketici.gov.tr",
          "İl/İlçe Tüketici Hakem Heyetleri (uyuşmazlık tutarına göre).",
          "Tüketici Mahkemeleri.",
        ],
      },
    ],
  },

  {
    slug: "cerez-politikasi",
    title: "Çerez Politikası",
    shortTitle: "Çerezler",
    updatedAt: UPDATED,
    category: "Veri & Gizlilik",
    summary:
      "Sitenin doğru çalışması için kullandığımız çerezler, neden kullanıldıkları ve nasıl kapatabileceğiniz.",
    references: [
      "6698 sayılı KVKK · m.10 aydınlatma yükümlülüğü",
      "Avrupa ePrivacy Direktifi (EU 2002/58/EC) — bilgi amaçlı",
    ],
    sections: [
      {
        heading: "1. Çerez nedir?",
        paragraphs: [
          "Çerez (cookie), web sitelerinin tarayıcınıza yerleştirdiği küçük metin dosyalarıdır. Çerezler sayesinde web sitesi sizi tanır; oturum, dil veya alışveriş sepeti gibi tercihlerinizi hatırlar.",
        ],
      },
      {
        heading: "2. Kullandığımız çerez türleri",
        table: [
          {
            key: "Zorunlu çerezler",
            value:
              "Sitenin temel işlevleri için gereklidir: oturum tutma (laffogato_customer_session, admin_session), sepet (laffogato_cart_v1), CSRF koruma. Rıza gerektirmez.",
          },
          {
            key: "Tercih çerezleri",
            value:
              "Dil, tema, görüntü tercihlerini hatırlar. Rıza isteğe bağlı.",
          },
          {
            key: "Analitik çerezler",
            value:
              "Sayfa görüntüleme, ziyaret süresi, demografi gibi anonim/agrega istatistikler. Google Analytics 4 veya muadili. Açık rıza şarttır.",
          },
          {
            key: "Pazarlama çerezleri",
            value:
              "Meta, Google Ads gibi reklam ağlarının dönüşüm takibi ve yeniden hedefleme amacıyla yerleştirdiği çerezler. Açık rıza şarttır.",
          },
        ],
      },
      {
        heading: "3. Çerez yönetimi",
        bullets: [
          "Tarayıcı ayarlarınızdan tüm çerezleri silebilir, belirli sitelere izin verebilirsiniz.",
          "Sitemize ilk girişinizde çerez bandırı üzerinden tercihinizi belirtebilir, dilediğiniz zaman değiştirebilirsiniz.",
          "Zorunlu çerezleri kapatmanız halinde sitenin bazı işlevleri (giriş yapma, sepet kullanma) çalışmaz.",
        ],
      },
      {
        heading: "4. Üçüncü taraf çerezleri",
        paragraphs: [
          "Ödeme sağlayıcı, kargo takip, embedded video ve sosyal medya gömüleri kendi çerezlerini yerleştirebilir. Bu çerezler için ilgili üçüncü tarafın gizlilik politikası geçerlidir.",
        ],
      },
      {
        heading: "5. Saklama süreleri",
        bullets: [
          "Oturum çerezi: tarayıcı kapatılınca silinir.",
          "Müşteri oturumu (laffogato_customer_session): 30 gün.",
          "Sepet (laffogato_cart_v1): tarayıcı localStorage; manuel silinene kadar.",
          "Analitik çerezler: 2 yıla kadar.",
          "Pazarlama çerezleri: 13 ay (KVKK Kurulu rehberi).",
        ],
      },
      {
        heading: "6. İletişim",
        paragraphs: [
          `Çerez kullanımıyla ilgili sorularınız için ${A.legalEmail} adresine yazabilirsiniz.`,
        ],
      },
    ],
  },

  {
    slug: "teslimat-ve-kargo",
    title: "Teslimat ve Kargo",
    shortTitle: "Teslimat",
    updatedAt: UPDATED,
    category: "Sipariş",
    summary:
      "Hangi sürede gelir, kargo ücreti var mı, hangi şehirlere ulaşır — sipariş öncesi bilmeniz gereken her şey.",
    sections: [
      {
        heading: "1. Hazırlık süresi",
        paragraphs: [
          "Siparişiniz, sipariş onayından itibaren 1-2 iş günü içinde hazırlanır ve kargoya verilir. Hafta sonu verilen siparişler Pazartesi günü işleme alınır.",
          "Hazırlık tamamlanınca size e-posta ile bildirim ve kargo takip numarası iletilir.",
        ],
      },
      {
        heading: "2. Teslim süresi",
        table: [
          {
            key: "İstanbul içi",
            value: "1 iş günü (motokurye opsiyonu mevcut)",
          },
          { key: "Marmara, Ankara, İzmir", value: "1-2 iş günü" },
          { key: "Diğer iller", value: "2-3 iş günü" },
          { key: "KKTC ve yurt dışı", value: "5-10 iş günü, anlaşmalı kargo" },
        ],
        paragraphs: [
          "Süreler tahminidir; kargo firması ve hava şartlarına göre değişebilir. Mücbir sebepler nedeniyle yaşanabilecek gecikmeler için Mesafeli Satış Sözleşmesi m.4/7 hükümleri geçerlidir.",
        ],
      },
      {
        heading: "3. Kargo ücreti",
        bullets: [
          "500₺ ve üzeri siparişlerde Türkiye geneli ücretsiz kargo.",
          "500₺ altı siparişlerde sabit 39₺ kargo ücreti.",
          "İstanbul içi aynı gün motokurye: 89₺ (sabah 11:00'a kadar verilen siparişler).",
          "KKTC ve yurt dışı: tutar sipariş anında hesaplanır.",
        ],
      },
      {
        heading: "4. Soğuk zincir teslimatı",
        paragraphs: [
          "Gelato kitleri ve dondurulmuş ürünler kuru buz ile +24 saat soğuk zinciri korunarak gönderilir.",
          "Bu ürünler yalnızca İstanbul içi motokurye ile teslim edilir; il dışına gönderilmez.",
          "Teslimat anında alıcının evde bulunması gerekir; alıcı yoksa ürün kafemize geri döner ve yeniden teslimat ücretsiz ayarlanır.",
        ],
      },
      {
        heading: "5. Anlaşmalı kargo firmaları",
        bullets: [
          "Yurtiçi Kargo (standart Türkiye geneli)",
          "Aras Kargo (KKTC + yurt dışı)",
          "Banabi / Getir (İstanbul içi hızlı)",
        ],
      },
      {
        heading: "6. Teslimat sorunları",
        paragraphs: [
          "Kargo gecikmesi, hasar veya kayıp yaşadığınızda 24 saat içinde " +
            A.email +
            " adresine fotoğraf ve sipariş numarası ile başvurun.",
          "Hasar tespiti halinde ürün ücretsiz değişim veya iade ile karşılanır.",
        ],
      },
    ],
  },

  {
    slug: "kvkk-aydinlatma-metni",
    title: "KVKK Aydınlatma Metni",
    shortTitle: "KVKK",
    updatedAt: UPDATED,
    category: "Veri & Gizlilik",
    summary:
      "6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) m.10 kapsamında veri sahibi aydınlatma metni.",
    references: ["6698 sayılı KVKK m.10"],
    sections: [
      {
        heading: "1. Veri sorumlusu",
        table: [
          { key: "Unvan", value: A.dataController },
          { key: "Adres", value: ADDRESS_LINE },
          { key: "Telefon", value: A.phone },
          { key: "E-posta", value: A.legalEmail },
          { key: "KEP", value: A.kep },
          { key: "MERSİS", value: A.mersisNo },
        ],
      },
      {
        heading: "2. İşlenen kişisel veri kategorileri",
        paragraphs: [
          "Faaliyetlerimizi sürdürebilmek için müşteri, ziyaretçi ve aday/çalışan gruplarına ait aşağıdaki kişisel veri kategorileri işlenebilmektedir:",
        ],
        bullets: [
          "Kimlik bilgileri (ad-soyad).",
          "İletişim bilgileri (e-posta, telefon, adres).",
          "Müşteri işlem bilgileri (sipariş, fatura, ödeme bilgileri özet).",
          "İşlem güvenliği bilgileri (IP, oturum çerezi, cihaz bilgisi).",
          "Pazarlama bilgileri (alışkanlık, bülten tercihi).",
          "Görsel veriler (yalnızca kafe içi güvenlik kamerası kayıtları, 30 gün saklanır).",
        ],
      },
      {
        heading: "3. Kişisel verilerin işlenme amaçları",
        bullets: [
          "Üyelik kaydının oluşturulması ve yönetimi.",
          "Sipariş alımı, hazırlığı, teslimatı ve sonrası destek.",
          "Faturalandırma, muhasebe ve yasal yükümlülükler.",
          "Müşteri memnuniyeti araştırmaları ve hizmet iyileştirme.",
          "Pazarlama ve tanıtım faaliyetleri (yalnızca açık rıza halinde).",
          "Hukuki yükümlülüklerin yerine getirilmesi.",
        ],
      },
      {
        heading: "4. Aktarılan taraflar",
        bullets: [
          "Yurt içi: ödeme sağlayıcı, kargo firması, muhasebe danışmanı, hukuk danışmanı, yetkili kamu kurumları.",
          "Yurt dışı: bulut hizmet sağlayıcı (MongoDB Atlas, Vercel) — AB/ABD lokasyonlarında saklama. KVKK m.9 kapsamında açık rıza ve/veya yeterli koruma şartları altında.",
        ],
      },
      {
        heading: "5. Kişisel veri toplama yöntemi ve hukuki sebep",
        paragraphs: [
          "Kişisel verileriniz; web sitesi, mobil uygulama, kafe ziyareti, e-posta, telefon, sosyal medya kanalları aracılığıyla otomatik ve otomatik olmayan yöntemlerle toplanır.",
          "Hukuki sebep, KVKK m.5/2-c (sözleşmenin kurulması/ifası), m.5/2-ç (hukuki yükümlülük), m.5/2-f (meşru menfaat) ve gerekli hallerde m.5/1 (açık rıza)'dır.",
        ],
      },
      {
        heading: "6. Veri sahibinin hakları (m.11)",
        paragraphs: [
          "Kanunun 11. maddesindeki haklarınızı kullanmak için " +
            A.legalEmail +
            " adresine yazılı başvuruda bulunabilirsiniz. Detaylar Gizlilik Politikası → Madde 7'de yer almaktadır.",
        ],
      },
    ],
  },
];

export function findLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
