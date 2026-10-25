/**
 * Rehber içeriği - HAM VERİ.
 *
 * Semrush (Türkiye) arama verisine göre yazıldı; hangi sayfanın hangi kümeyi
 * hedeflediği `guides.ts` başındaki tabloda. Metinleri düzenlerken markdown
 * işareti kullanmayın - yapı paragraphs / bullets / ordered / table alanlarıyla
 * kurulur ve sayfa bunları doğrudan render eder.
 *
 * GENERATED - düzenlemek için scratchpad'deki build-guides.mjs akışını kullanın
 * ya da elle düzenleyip `npm test` ile doğrulayın.
 */

import { CHAI_LATTE_GUIDE } from "./guide-content-chai-tea-latte";
import { COLD_BREW_GUIDE } from "./guide-content-cold-brew-nedir";
import { FRAPPE_GUIDE } from "./guide-content-frappe-nedir";
import { SPANISH_LATTE_GUIDE } from "./guide-content-spanish-latte-nedir";
import { TIRAMISU_GUIDE } from "./guide-content-tiramisu-tarifi";
import { YENILEBILIR_BARDAK_GUIDE } from "./guide-content-yenilebilir-kahve-fincani";

export interface GuideSource {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  primaryKeyword: string;
  keywords: string[];
  readingMinutes: number;
  updatedAt: string;
  sections: Array<{
    heading: string;
    paragraphs?: string[];
    ordered?: string[];
    bullets?: string[];
    table?: { key: string; value: string }[];
  }>;
  faq: { q: string; a: string }[];
  recipe?: {
    name: string;
    description: string;
    prepMinutes: number;
    yield: string;
    ingredients: string[];
    steps: string[];
    /** Recipe category as Google reads it: "Tatlı", "İçecek". */
    category: string;
    /** The cuisine the dish comes from: "İtalyan", "Japon", "Bask". */
    cuisine: string;
  };
  related: string[];
  /**
   * The photograph at the top of the page, in Recipe/Article data and on the
   * link card. Optional in the type so a draft compiles; tests/guides.test.ts
   * requires one on every published guide.
   */
  image?: GuideImage;
}

/**
 * A guide's photograph: a 3:2 WebP in public/rehber/, cut and toned the same
 * way for every guide (docs/SEO.md "Rehber fotoğrafları"). `credit` names the
 * photographer of a stock photo; our own photographs carry none.
 */
export interface GuideImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  credit?: { name: string; url: string; source: "Unsplash"; photoUrl: string };
}

export const GUIDE_CONTENT: GuideSource[] = [
  {
    slug: "affogato-nedir",
    title: "Affogato nedir?",
    metaTitle: "Affogato Nedir? Dondurmalı Kahvenin Tarifi ve Püf Noktaları",
    metaDescription:
      "Affogato nedir, nasıl okunur, nasıl yapılır? Klasik oran, espresso sıcaklığı, evde adım adım tarif ve en sık yapılan hatalar tek sayfada. Hemen okuyun.",
    excerpt:
      "Affogato, bir top gelatonun üzerine taze espresso dökülerek servis edilen İtalyan tatlısıdır; Türkçede yaygın adıyla dondurmalı kahve. Tanımı, telaffuzu, klasik oranı ve evde yapımı bu rehberde.",
    primaryKeyword: "affogato nedir",
    keywords: [
      "affogato",
      "affogato nedir",
      "affogato ne demek",
      "affogato kahve",
      "affogato kahve nedir",
      "affogato tarifi",
      "affogato nasıl yapılır",
      "affogato nasıl okunur",
      "affogato nasıl içilir",
      "dondurmalı kahve",
      "dondurmalı sıcak kahve",
      "dondurmalı soğuk kahve",
      "dondurmalı espresso",
      "dondurmalı kahve ismi",
      "espresso dondurma",
      "kahve dondurma",
      "matcha affogato",
      "affogato al caffe",
    ],
    readingMinutes: 8,
    updatedAt: "2026-09-01",
    sections: [
      {
        heading: "Affogato ne demek?",
        paragraphs: [
          "Affogato, bir top sade gelatonun üzerine taze çekilmiş sıcak espresso dökülerek hazırlanan İtalyan tatlısıdır. Türkçede yaygın adıyla dondurmalı kahve olarak bilinir. Sıcak espresso dondurmayı kenarlarından eritir, ortada soğuk çekirdek kalır; kaşıkla yenir, kalan kısmı içilir. Tek malzemesi kahve ve dondurmadır.",
          "Tam adı affogato al caffè'dir. İtalyancada affogare boğmak demektir; yani \"kahvede boğulmuş\" anlamına gelir. İsim, dondurmanın espressonun altında kalışını birebir tarif eder. İtalya'da menülerde içecek bölümünde değil, tatlı (dolci) bölümünde yer alır. Bologna, Torino ve Milano'nun bar geleneğinde öğle yemeğinden sonra ayaküstü tüketilen bir kapanış tatlısıdır; espresso zaten masaya gelen bir şeydir, affogato onun tatlıya dönüşmüş halidir.",
          'Türkiye\'de aynı tarif birkaç adla dolaşır: menülerde affogato ya da affogato kahve, günlük konuşmada dondurmalı kahve. Kafede "dondurmalı sıcak kahve" diye sorulan, internette "dondurmalı espresso" veya "kahve dondurma" diye aranan şey de çoğunlukla budur; dondurmalı kahve ismi günlük dilde, affogato menü dilinde yaşar. Dondurmalı soğuk kahve ise ayrı bir kategoridir; aradaki farkı aşağıdaki tabloda bulacaksınız.',
        ],
      },
      {
        heading: "Affogato nasıl okunur?",
        paragraphs: [
          'Affogato "af-fo-GA-to" diye okunur; vurgu üçüncü heceye, GA\'ya düşer. İtalyancada çift f duraklamalı ve biraz uzun telaffuz edilir, sondaki o kapalı değil net bir o\'dur. Türkçede sık duyulan "afogato" ve "avokado"ya kayan söyleyişler yanlıştır.',
        ],
        table: [
          {
            key: "Yazılışı",
            value: "affogato (tam adı: affogato al caffè)",
          },
          {
            key: "Okunuşu",
            value: "af-fo-GA-to",
          },
          {
            key: "Vurgu",
            value: "Üçüncü hecede: GA",
          },
          {
            key: "Anlamı",
            value: "Boğulmuş; kahvede boğulmuş tatlı",
          },
          {
            key: "Sık yapılan hata",
            value: '"afogato" veya "affokato" demek',
          },
        ],
      },
      {
        heading: "Klasik affogato nasıl hazırlanır? Oran, sıcaklık, servis",
        paragraphs: [
          "Klasik affogato tarifi tek satırdır: bir top fior di latte gelato, üstüne tek ya da çift shot taze espresso. Fior di latte, yumurta ve vanilya içermeyen; süt, krema ve şekerden yapılan sade beyaz bazdır. Sade olması önemlidir, çünkü affogatoda tadı kuran taraf kahvedir; dondurma ona yağ, süt tatlılığı ve doku verir.",
          "İşin tamamı sıcaklık farkında biter. Bir yanda 88-93 santigrat aralığındaki suyla demlenmiş espresso, diğer yanda eksi 12 derece civarında servis edilen gelato vardır. Gelato, endüstriyel dondurmaya göre daha az hava içerir ve daha yüksek sıcaklıkta servis edilir; bu yüzden espressoyla temas ettiğinde çırpılmış dondurma gibi köpürüp dağılmaz, kremalı bir katman verir.",
          "Servis kabı geleneksel olarak küçük, kalın camdan bir kâse ya da ayaklı bardaktır. Kâsenin dar olması espressonun dondurmanın etrafından akıp dibe göllenmesini engeller. Yanında küçük bir kaşık gelir; affogato kaşıkla başlar, bardağı kaldırıp içmekle biter.",
        ],
        table: [
          {
            key: "Gelato miktarı",
            value: "Tek top, yaklaşık 50-60 g",
          },
          {
            key: "Espresso",
            value: "Tek shot 25-30 ml, çift shot 50-60 ml",
          },
          {
            key: "Demleme suyu sıcaklığı",
            value: "88-93 °C",
          },
          {
            key: "Espresso ekstraksiyon süresi",
            value: "25-30 saniye",
          },
          {
            key: "Gelato servis sıcaklığı",
            value: "Yaklaşık -12 °C (endüstriyel dondurma -18 °C)",
          },
          {
            key: "Servis kabı",
            value: "Küçük, kalın cam kâse veya ayaklı bardak",
          },
          {
            key: "Tüketim süresi",
            value: "Espresso döküldükten sonraki ilk 60-90 saniye",
          },
        ],
      },
      {
        heading: "Evde affogato nasıl yapılır? Adım adım",
        paragraphs: [
          "Evde affogato yapmanın tek zor tarafı zamanlamadır. Dondurmayı önce hazırlayıp kahveyi sonra çekmek gerekir; tersi yapıldığında espresso bardakta beklerken soğur ve yağ katmanı kırılır.",
        ],
        ordered: [
          "Servis bardağını 10 dakika önce buzluğa koyun. Soğuk cam, erimeyi belirgin biçimde geciktirir.",
          "Dondurmayı derin dondurucudan çıkarıp 1-2 dakika tezgâhta bekletin; taş gibi sert dondurma espressoyu emmez, kaydırır.",
          "Sade bir dondurma seçin: fior di latte, sade süt ya da yumurtasız vanilya. Bir top, yaklaşık 50-60 gram yeterlidir.",
          "Topu soğuttuğunuz bardağın ortasına koyun. Bardağın kenarına yaymayın; espressonun bir yerde toplanması gerekir.",
          "Espressoyu tam bu anda çekin: tek shot 25-30 ml, daha yoğun sevenler için çift shot 50-60 ml.",
          "Espressoyu dondurmanın tam tepesinden, ince ve tek bir akışla dökün. Kenardan dökerseniz kahve dibe iner, temas yüzeyi azalır.",
          "Hiç bekletmeden servis edin. Kaşıkla üstteki eriyen katmandan başlayın, dip kısmını içerek bitirin.",
        ],
      },
      {
        heading: "Espresso makinesi yoksa affogato yapılır mı?",
        paragraphs: [
          "Yapılır, ama espressonun yerini tutacak şey yoğun ve az miktarda olmalıdır. Affogatoyu ayakta tutan, 30 ml'lik küçük hacimde toplanmış güçlü bir kahvedir. Filtre kahveyi olduğu gibi dökerseniz elinizde sulanmış bir dondurma kalır.",
        ],
        bullets: [
          "Moka pot: En yakın alternatif. 3 kişilik moka potun ilk 40-50 ml'sini kullanın; sonuna doğru gelen kısım acılaşır.",
          "Aeropress: Az su, ince öğütüm ve kısa demlemeyle konsantre bir shot elde edilir; affogato için fazlasıyla yeterlidir.",
          "French press: Normal oranın iki katı kahve kullanıp 4 dakika demleyin, 40 ml kadarını ayırın. Telveyi süzmeye dikkat edin.",
          "Türk kahvesi: Sade pişirilmiş, köpüğü alınmış 40 ml kadarı işe yarar; telve dibe çöktükten sonra üstünden alın. Klasik tarif değildir ama Türkiye'de en kolay bulunan yoğun kahvedir.",
          "Instant espresso tozu: 1 tatlı kaşığını 30 ml kaynar suda eritmek acil durum çözümüdür; aroma taze çekilmiş kahvenin gerisinde kalır.",
        ],
      },
      {
        heading: "Affogato neden hemen içilmeli?",
        paragraphs: [
          "Affogato servis edildiği andan itibaren değişen bir tatlıdır; bekleyen affogato bozulmaz ama başka bir şeye dönüşür. Espresso dondurmayla temas ettiği saniyede yüzeyde ince bir eriyik katman oluşur ve bu katman ilerledikçe kahvenin yoğunluğu seyrelir. İlk kaşıkla son kaşık arasındaki fark, aynı bardakta üç ayrı tat yaşamanızı sağlar; ama bu üç aşama kısa sürer.",
        ],
        table: [
          {
            key: "0-20. saniye",
            value:
              "Sıcak-soğuk zıtlığı en keskin; kahvenin krema katmanı hâlâ üstte",
          },
          {
            key: "20-60. saniye",
            value: "İdeal aralık. Kremalı, dengeli, hem kaşıklanır hem içilir",
          },
          {
            key: "60-120. saniye",
            value: "Dondurmanın çoğu erimiş; tat sütlü ve tatlıya kayar",
          },
          {
            key: "2 dakikadan sonra",
            value:
              "Soğumuş, seyrelmiş bir sütlü kahve; affogato karakteri kaybolur",
          },
        ],
      },
      {
        heading: "Affogato yaparken en sık yapılan hatalar",
        bullets: [
          "Fazla dondurma koymak: İki üç top, espressonun tadını tamamen bastırır. Klasik oran tek toptur.",
          "Espressoyu önceden çekip bekletmek: Soğumuş espresso hem dondurmayı eritemez hem de acılaşır. Kahve en son çekilir.",
          "Tatlandırılmış, aromalı dondurma kullanmak: Karamelli, bisküvili, çikolatalı bazlar kahveyle yarışır. Sade baz seçin.",
          "Bardağı önceden soğutmamak: Oda sıcaklığındaki cam, erimeyi hızlandırır ve tüketim aralığını yarıya indirir.",
          "Espressoyu kenardan dökmek: Kahve dibe iner, dondurmayla teması azalır, tabakalanma bozulur.",
          "Şeker eklemek: Dondurma zaten şekerlidir. Şeker eklemek kahvenin acılık dengesini gereksiz yere siler.",
          "Fincanı ağzına kadar doldurmak: Küçük kâse, kaşık için de yer bırakmalıdır.",
        ],
      },
      {
        heading: "Affogato çeşitleri nelerdir?",
        paragraphs: [
          "Klasik tarif iki malzemeyle sınırlı olsa da bar geleneği içinde birkaç yerleşik varyasyon vardır. Ortak kural aynı kalır: sıcak ya da yoğun bir sıvı, tek top sade dondurmanın üzerine.",
        ],
        bullets: [
          "Matcha affogato: Espresso yerine buzlu matcha latte kullanılır; dondurma bu kez sıcakla değil yoğunlukla buluşur. Japonya'da Uji gibi bölgelerde harmanlanan ceremonial grade matcha, otsu ve tatlı dengesiyle süt bazlı dondurmaya iyi oturur.",
          "Pistacchio affogato: Sicilya fıstığı bazlı gelato üzerine espresso. Yağ oranı yüksek olduğu için daha geç erir, daha kremalı içilir.",
          "Nocciola (fındıklı) affogato: Fındık gelatosu espressonun kavrulmuş notalarını uzatır; Türkiye'de en kolay bulunan varyasyondur.",
          "Affogato al liquore: İtalya'da amaretto gibi likörlerle yapılan yetişkinlere yönelik versiyondur; alkolsüz klasik tariften ayrı tutulur ve her kafede bulunmaz.",
          "Yenilebilir kupada servis: Kâse yerine waffle hamurundan pişirilmiş, iç yüzeyi sızdırmaz kaplanmış kupa kullanılır. Tatlı bitince kap da yenir.",
        ],
      },
      {
        heading: "Affogato ile dondurmalı soğuk kahve arasındaki fark ne?",
        paragraphs: [
          "Karıştırılan içeceklerin hepsinde kahve ve dondurma vardır; farkı yaratan sıcaklık, karıştırma ve süt oranıdır. Affogato karıştırılmaz, süt eklenmez ve sıcak servis edilir.",
        ],
        table: [
          {
            key: "Affogato",
            value:
              "Tek top sade gelato + sıcak espresso. Karıştırılmaz, süt eklenmez. Tatlı sayılır, kaşıkla yenir.",
          },
          {
            key: "Dondurmalı soğuk kahve",
            value:
              "Soğuk kahve (cold brew veya iced americano) üzerine dondurma. Sıcaklık zıtlığı yoktur, erime yavaştır.",
          },
          {
            key: "Espresso milkshake",
            value:
              "Dondurma, süt ve espresso blenderda karıştırılır. Homojen, içilebilir, dokusu tamamen farklıdır.",
          },
          {
            key: "Iced latte",
            value:
              "Espresso + soğuk süt + buz. Dondurma hiç yoktur; tatlı değil içecektir.",
          },
          {
            key: "Affogato bardakta hazır satılan versiyon",
            value:
              "Önceden karıştırılıp dondurulmuş ürün. Sıcak-soğuk anını taşımadığı için klasik affogato sayılmaz.",
          },
        ],
      },
      {
        heading: "Affogatoda kafein ve kalori ne kadar?",
        paragraphs: [
          "Tek shot espresso ortalama 60-80 mg kafein içerir; çekirdeğe, öğütüme ve ekstraksiyona göre bu değer kaynağa göre değişir. Çift shotlu bir affogato bu durumda yaklaşık 120-160 mg kafeine karşılık gelir. Matcha affogatoda kafein kaynağı matchadır; iki gramlık bir servis için genellikle 40-70 mg aralığı verilir, yine harmana ve demleme oranına bağlıdır.",
          "Kalori tarafında hesabın neredeyse tamamını dondurma yapar. Sade espresso pratikte kalorisizdir; bir top süt bazlı gelato ise yaklaşık 100-150 kalori aralığındadır. Yani klasik bir affogato, porsiyon başına birçok klasik tatlının altında kalır; kesin değer kullanılan gelatoya göre değişir.",
          "Kahve ve matcha antioksidan bileşenler içerir ve ikisi de kafein kaynağıdır. Bu sayfadaki bilgiler genel bilgilendirme amaçlıdır, tıbbi tavsiye değildir; kafein hassasiyetiniz, hamilelik ya da kronik bir durumunuz varsa tüketim miktarını hekiminize danışın.",
        ],
      },
      {
        heading: "Türkiye'de affogato nerede içilir?",
        paragraphs: [
          "Affogato Türkiye'de son yıllarda üçüncü nesil kahvecilerin ve gelato barlarının menüsüne yerleşti; ancak klasik tarife sadık, tek top sade gelato ve taze çekilmiş espressoyla servis eden yer sayısı hâlâ sınırlı. Ayırt etmenin pratik yolu şudur: dondurma sade mi, espresso siparişten sonra mı çekiliyor, bardak küçük mü.",
          "İyi bir örnek şuna benzer: sade gelato, siparişten sonra çekilen espresso, küçük bir kâse. İstanbul Tuzla'da restore edilmiş bir Rum köşkünde hizmet veren L'Affogato bunu bir adım öteye taşıyıp yenilebilir waffle kupanın içinde tek top fior di latte gelatoyu çift shot espressoyla buluşturuyor; menüde buzlu matcha latte üzerine bir top dondurmayla hazırlanan Matcha Affogato da var. Nerede içerseniz içiniz, ölçüt aynı: espresso bardağa dökülür dökülmez masaya gelmeli.",
        ],
      },
    ],
    faq: [
      {
        q: "Affogato nedir, kısaca?",
        a: "Bir top sade gelatonun üzerine taze espresso dökülerek servis edilen İtalyan tatlısıdır. Türkçede dondurmalı kahve olarak bilinir; İtalyancada affogato al caffè, yani kahvede boğulmuş anlamına gelir.",
      },
      {
        q: "Affogato nasıl okunur?",
        a: '"af-fo-GA-to" biçiminde, vurgu üçüncü hecede. Çift f biraz uzun söylenir. "Afogato" ya da "affokato" söyleyişleri yanlıştır.',
      },
      {
        q: "Affogato kahve mi, tatlı mı?",
        a: "Affogato kahve nedir diye sorulduğunda kısa cevap tatlıdır: İtalya'da menülerin dolci bölümünde yer alır. Kaşıkla başlanır, kalan kahveli kısım içilerek bitirilir; yemek sonrası ayaküstü tüketilen bir kapanış tatlısı sayılır.",
      },
      {
        q: "Affogato nasıl içilir?",
        a: "Servis edildiği anda tüketilir. İlk kaşıklar üstteki eriyen katmandan alınır, ardından bardak kaldırılıp dipte toplanan kahveli kısım içilir. İdeal aralık espresso döküldükten sonraki ilk 60-90 saniyedir.",
      },
      {
        q: "Affogatoda hangi dondurma kullanılır?",
        a: "Klasik tercih fior di latte'dir: yumurtasız, vanilyasız; süt, krema ve şekerden yapılan sade beyaz baz. Aromalı ve tatlandırılmış dondurmalar kahvenin tadını bastırdığı için önerilmez.",
      },
      {
        q: "Espresso makinem yok, affogato yapabilir miyim?",
        a: "Evet. Moka pot, Aeropress, güçlü demlenmiş french press ya da sade Türk kahvesiyle 30-40 ml yoğun kahve elde edip kullanabilirsiniz. Önemli olan az hacimde yoğun kahve olmasıdır; filtre kahve fazla sulu kalır.",
      },
      {
        q: "Affogato ile dondurmalı soğuk kahve aynı şey mi?",
        a: "Değil. Affogatoda kahve sıcaktır ve sıcak-soğuk zıtlığı tarifin temelidir. Dondurmalı soğuk kahvede cold brew ya da iced americano kullanılır; erime yavaş olur, doku ve tat tamamen farklıdır.",
      },
      {
        q: "Affogatoda ne kadar kafein var?",
        a: "Tek shot espresso ortalama 60-80 mg kafein içerir; çift shotlu bir affogato yaklaşık 120-160 mg eder. Değerler çekirdeğe, öğütüme ve ekstraksiyona göre kaynaktan kaynağa değişir.",
      },
      {
        q: "Matcha affogato nedir?",
        a: "Espresso yerine buzlu matcha latte kullanılan varyasyondur; üzerine bir top dondurma gelir. Kahve içmeyenler için affogatonun doku ve sıcaklık oyununu koruyan alternatiftir.",
      },
      {
        q: "Affogato evde kaç dakikada hazırlanır?",
        a: "Bardağı soğutma süresi hariç yaklaşık 5 dakika. İşin tamamı espressoyu son anda çekmek ve hiç bekletmeden servis etmekten ibarettir.",
      },
    ],
    recipe: {
      category: "Tatlı",
      cuisine: "İtalyan",
      name: "Klasik Affogato al Caffè",
      description:
        "Tek top fior di latte gelato üzerine taze çekilmiş espresso ile hazırlanan klasik İtalyan tatlısı; Türkçe adıyla dondurmalı kahve.",
      prepMinutes: 5,
      yield: "1 porsiyon",
      ingredients: [
        "1 top (50-60 g) fior di latte veya sade süt gelato",
        "25-30 ml tek shot espresso (yoğun sevenler için 50-60 ml çift shot)",
        "İsteğe bağlı: 3-4 adet kavrulmuş fındık veya Antep fıstığı kırığı",
        "İsteğe bağlı: bir tutam rendelenmiş bitter çikolata",
      ],
      steps: [
        "Küçük cam servis bardağını 10 dakika buzlukta bekletin.",
        "Dondurmayı derin dondurucudan çıkarıp 1-2 dakika yumuşamaya bırakın.",
        "Soğuk bardağın ortasına tek top gelato koyun; kenarlara yaymayın.",
        "Espressoyu tam bu anda çekin, bekletmeyin.",
        "Sıcak espressoyu dondurmanın tepesinden ince ve tek bir akışla dökün.",
        "İsterseniz fındık kırığı veya bitter çikolata rendesi serpin.",
        "Kaşıkla hemen servis edin; ilk 60-90 saniye içinde tüketin.",
      ],
    },
    image: {
      src: "/rehber/affogato-nedir.webp",
      alt: "Tuzla'daki köşkün avlusunda tepside yenilebilir bardakta iki affogato ve espressoyu dökmek için iki küçük porselen sürahi",
      width: 1200,
      height: 800,
    },
    related: [
      "yenilebilir-kahve-fincani",
      "espresso-cesitleri",
      "matcha-nedir",
    ],
  },
  {
    slug: "matcha-nedir",
    title: "Matcha nedir?",
    metaTitle: "Matcha nedir? Dereceleri, tadı ve matcha latte tarifi",
    metaDescription:
      "Matcha nedir, içinde ne var, tadı nasıl? Ceremonial ve culinary farkı, 70-80 °C su kuralı ve adım adım matcha latte tarifi bu rehberde. Hemen okuyun.",
    excerpt:
      "Gölgede yetiştirilen yeşil çay yaprağının taş değirmende öğütülmüş tozu: matcha. Dereceleri, tadının nedenleri, doğru su sıcaklığı ve evde matcha latte tarifi.",
    primaryKeyword: "matcha nedir",
    keywords: [
      "matcha nedir",
      "matcha latte",
      "macha",
      "matcha faydaları",
      "maca nedir",
      "matcha nasıl yapılır",
      "matcha kahve",
      "maca latte",
      "matcha latte nedir",
      "matcha çayı nasıl yapılır",
      "maca içecek",
      "matcha latte tarifi",
      "matcha latte nasıl yapılır",
      "matcha içinde ne var",
      "iced matcha latte",
      "matcha tadı nasıl",
      "matcha fiyat",
      "ceremonial grade matcha",
      "culinary grade matcha",
      "strawberry matcha",
    ],
    readingMinutes: 7,
    updatedAt: "2026-09-01",
    sections: [
      {
        heading: "Matcha nedir?",
        paragraphs: [
          "Matcha, hasattan önce yaklaşık üç hafta gölgelenen yeşil çay yapraklarının damarlarından ve saplarından ayrılıp taş değirmende pudra inceliğinde öğütülmüş halidir. Normal çayda yaprak demlenir ve süzülüp atılır; matcha'da toz doğrudan suya çırpılır, yani yaprağın tamamı içilir. Rengi canlı, neredeyse floresan bir yeşildir.",
          "Türkçe aramalarda matcha sıkça 'macha' ya da 'maca' olarak da yazılır; üçü de aynı Japon çayını kasteder. Yalnız şu ayrımı not edin: Peru kökenli, bej renkli bir kök tozu olan maca ile matcha tamamen farklı iki üründür.",
          "Matcha'nın merkezi Japonya'dır. Kyoto yakınlarındaki Uji, Aichi'deki Nishio ve güneyde Kagoshima en bilinen üretim bölgeleridir. Gölgeleme dönemi yaprakta klorofili ve amino asitleri artırır, acılığı azaltır; matcha'nın rengi ve o kadife umami tadı büyük ölçüde bu üç haftanın sonucudur.",
        ],
      },
      {
        heading: "Matcha ile normal yeşil çay arasındaki fark nedir?",
        paragraphs: [
          "İkisi de aynı bitkiden, Camellia sinensis'ten gelir. Fark yetiştirme, işleme ve tüketme biçimindedir. Aşağıdaki tablo, matcha ile klasik demlik yeşil çayı (sencha) yan yana koyar.",
        ],
        table: [
          {
            key: "Yetiştirme",
            value:
              "Matcha hasattan yaklaşık 3 hafta önce gölge altına alınır; sencha güneşte büyür.",
          },
          {
            key: "İşleme",
            value:
              "Gölgelenen yaprak buharlanır, kurutulur, damar ve sapından ayrılır; bu ara ürüne tencha denir. Tencha öğütülünce matcha olur.",
          },
          {
            key: "Öğütme",
            value:
              "Geleneksel taş değirmen saatte yalnızca 30-40 gram toz verir; bu yüzden iyi matcha pahalıdır.",
          },
          {
            key: "Hazırlama",
            value:
              "Matcha çırpılır (süspansiyon), yeşil çay demlenir (infüzyon).",
          },
          {
            key: "Tüketim",
            value:
              "Matcha'da yaprağın tamamı yutulur; yeşil çayda yaprak süzülüp atılır.",
          },
          {
            key: "Tat",
            value:
              "Matcha yoğun, umami ve kremsi; sencha daha ince, otsu ve berrak.",
          },
        ],
      },
      {
        heading: "Matcha'nın içinde ne var?",
        paragraphs: [
          "Matcha içmek, çay yaprağını yutmak demek olduğu için bileşenler demlik çayına kıyasla daha yoğun alınır. Matcha'nın içinde ne var sorusunun pratik cevabı şu dört başlıkta toplanır:",
        ],
        bullets: [
          "L-teanin: gölgeleme döneminde artan bir amino asit. Matcha'nın tatlımsı umami tadının başlıca kaynağıdır.",
          "Kafein: bir servis matcha'da ortalama 60-70 mg civarında; miktar toz gramajına, hasada ve dereceye göre değişir.",
          "Katekinler (özellikle EGCG): yeşil çayda doğal olarak bulunan, antioksidan özellikleriyle bilinen bileşikler.",
          "Klorofil: gölgede artan yeşil pigment; matcha'nın canlı renginin sebebi.",
        ],
      },
      {
        heading: "Matcha sağlıklı mı, faydaları neler?",
        paragraphs: [
          "Matcha faydaları başlığıyla dolaşan iddiaların çoğu, içeriğinin izin verdiğinden fazlasını söyler. Güvenle söylenebilecek olan şu: matcha, antioksidan özellikleriyle bilinen katekinleri, L-teanin adlı amino asidi ve kafein içerir. Bunun ötesinde 'zayıflatır', 'detoks yapar', 'hastalık önler', 'tedavi eder' türü ifadeler bir içecek için doğru kurulmuş cümleler değildir ve bu sayfada yer almaz.",
          "Kafeine duyarlıysanız, hamileyseniz, düzenli ilaç kullanıyorsanız ya da bir sağlık sorununuz varsa tüketim miktarını hekiminize danışın. Bu rehber bilgilendirme amaçlıdır, tıbbi tavsiye değildir.",
        ],
      },
      {
        heading: "Matcha dereceleri: ceremonial, premium ve culinary farkı",
        paragraphs: [
          "Matcha ambalajlarındaki derece adları resmî bir sınıflandırma değil, sektörde yerleşmiş bir dildir. Yine de ne alacağınızı belirleyen en pratik ayrımdır: yaprağın hasat sırası, yaşı ve öğütme inceliği değişir.",
          "Matcha fiyatları da aynı sıralamayı izler: ceremonial grade en üstte, culinary grade en uygun bantta durur. Farkı yaratan üç şey var: ilk hasat yaprağının miktarı sınırlıdır, gölgeleme ek işçilik ve verim kaybı demektir, taş değirmen ise saatte yalnızca birkaç düzine gram toz verir. Bu yüzden çok ucuz etiketli bir 'ceremonial' kutu genellikle ya geç hasadı ya da makineyle hızlı öğütülmüş tozu işaret eder. Alırken dereceyi değil, ne yapacağınızı esas alın: yalnızca latte içecekseniz premium bant yeterlidir.",
        ],
        bullets: [
          "Rengi kontrol edin: sararmış ya da haki yeşil toz genelde bayat ya da geç hasattır.",
          "Ambalaj küçük olsun: 30-50 gramlık kutular, açıldıktan sonra tazeliğini koruyabileceğiniz gerçekçi miktardır.",
          "Üretim bölgesi ve hasat yılı yazıyorsa iyi işarettir; yalnızca 'Japon matcha' ibaresi çok az şey söyler.",
        ],
        table: [
          {
            key: "Ceremonial grade",
            value:
              "İlk hasadın (ichibancha) en genç yaprakları. Canlı, parlak yeşil; ipeksi doku, baskın umami, düşük acılık. Sade içmek için: geleneksel usucha ya da sıcak/soğuk sade matcha.",
          },
          {
            key: "Premium / latte grade",
            value:
              "Yine erken hasat ama daha geniş yaprak. Rengi biraz daha koyu, tadı biraz daha kuvvetli. Sütle içildiğinde arkada durmayacak kadar karakterli: matcha latte için ideal denge.",
          },
          {
            key: "Culinary grade",
            value:
              "Geç hasat, olgun yaprak. Mat, zeytin yeşiline çalan renk; belirgin tanen ve acılık. Fırın, dondurma, krema ve şuruplarda tadın kaybolmaması için kullanılır; sade içmek için uygun değildir.",
          },
        ],
      },
      {
        heading: "Matcha'nın tadı nasıl?",
        paragraphs: [
          "İyi bir matcha'nın tadı üç katmanda ilerler: önce yoğun ama tatlımsı bir umami, sonra taze biçilmiş ot ve deniz yosununu andıran bitkisel bir orta gövde, sonunda hafif tatlı, uzun süren bir bitiş. Ağızda su gibi değil, ince bir kremsi doku bırakır.",
          "İlk kez içenlerin büyük bölümü matcha'yı 'çok acı' bulur. Oysa acılık matcha'nın doğasında olan bir şey değil; çoğunlukla hazırlama ya da kalite kaynaklıdır. En sık görülen beş sebep şunlar:",
        ],
        table: [
          {
            key: "Kaynar suyla hazırlamak",
            value:
              "Katekinleri sertçe çeker, tadı yakar. Suyu 70-80 °C'ye indirin; kaynattıysanız 3-4 dakika bekleyin.",
          },
          {
            key: "Fazla toz kullanmak",
            value:
              "Servis başına 2 gram (yaklaşık 1 çay kaşığı tepeleme) yeterli. Daha fazlası acılığı katlar.",
          },
          {
            key: "Culinary grade'i sade içmek",
            value:
              "Tatlıda mükemmel çalışan toz, sade içildiğinde tanenli gelir. Sade için ceremonial'a geçin.",
          },
          {
            key: "Bayat matcha",
            value:
              "Açık kalmış, ışık görmüş toz saman gibi kokar ve düzleşir. Rengine ve açılış tarihine bakın.",
          },
          {
            key: "Kötü çırpma",
            value:
              "Topaklı matcha ağızda acı noktalar bırakır. Eleyin ve düzgün köpürtün.",
          },
        ],
      },
      {
        heading: "Matcha çayı nasıl yapılır? (sade matcha)",
        paragraphs: [
          "Sade matcha, latte'nin de temelidir. Önce bunu doğru yapın; süt sonra gelir.",
        ],
        ordered: [
          "2 gram matcha'yı (tepeleme 1 çay kaşığı) ince bir süzgeçten kaseye eleyin. Bu adım topaklanmayı baştan bitirir.",
          "Suyu kaynatıp 70-80 °C'ye düşürün. Termometreniz yoksa kaynayan suyu 3-4 dakika açık bekletin.",
          "60 ml suyu toz üzerine dökün.",
          "Bambu çırpıcıyla (chasen) kasenin dibine değmeden, bilekten hızlı 'W' hareketiyle 15-20 saniye çırpın. Chasen yoksa küçük bir süt köpürtücü ya da kapaklı kavanozda çalkalama işi görür.",
          "Yüzeyde ince, kalıcı bir köpük tabakası oluştuğunda hazırdır. Hemen için; beklerse toz dibe çöker.",
        ],
      },
      {
        heading: "Matcha latte nasıl yapılır?",
        paragraphs: [
          "Matcha latte, sade matcha'nın üzerine süt eklenmiş halidir. Kritik nokta sırayı bozmamak: matcha önce az suyla açılır, süt en sona kalır. Doğrudan süte toz atarsanız topaklanır ve tadı donuklaşır.",
        ],
        ordered: [
          "2 gram matcha'yı süzgeçten kupaya ya da kaseye eleyin.",
          "70-80 °C'de 60 ml suyu ekleyin ve pürüzsüz, köpüklü bir kıvam elde edene kadar 15-20 saniye çırpın.",
          "120-150 ml sütü ayrıca ısıtın; 60-65 °C yeterli, kaynatmayın.",
          "Sütü çırpılmış matcha'nın üzerine yavaşça ekleyin ve bir kez karıştırın.",
          "Tatlandırmak isterseniz şurubu ya da balı süte, matcha'ya değil sonradan ekleyin; böylece tozun dokusu bozulmaz.",
        ],
        bullets: [
          "Süt seçimi tadı belirgin biçimde değiştirir: tam yağlı inek sütü umami'yi yuvarlar, yulaf sütü tatlılığı öne çıkarır, badem sütü matcha'yı daha otsu bırakır.",
          "Matcha'nın kendi tatlılığını tanımadan şeker eklemeyin; çoğu kişi ilk denemeden sonra şekeri azaltıyor.",
          "Süt oranını 1:2 (matcha suyu : süt) civarında tutun. Daha fazla süt matcha'yı silikleştirir.",
        ],
      },
      {
        heading: "Iced matcha latte ve strawberry matcha nasıl yapılır?",
        paragraphs: [
          "Soğuk versiyonda tek kural şudur: matcha'yı önce sıcak değil, ılık ya da soğuk suyla açıp iyi çırpın, buzu ve sütü sonra ekleyin. Buzun üzerine toz atılırsa asla dağılmaz.",
        ],
        ordered: [
          "2 gram elenmiş matcha'yı 50-60 ml ılık (yaklaşık 40 °C) suyla pürüzsüz olana kadar çırpın.",
          "Uzun bir bardağı tepesine kadar buzla doldurun.",
          "150-180 ml soğuk sütü buzun üzerine dökün.",
          "Çırpılmış matcha'yı en üste yavaşça gezdirin; katmanlı görüntü böyle oluşur. İçmeden önce karıştırın.",
        ],
        bullets: [
          "Strawberry matcha: bardağın dibine ezilmiş çilek ya da şekeri azaltılmış çilek püresi koyun, üzerine buz ve süt, en üste matcha. Çileğin asidi matcha'nın otsu tarafını dengeler.",
          "Buz eridikçe içecek sulanır. Bunu telafi etmek için toz miktarını artırmayın; sütü ve suyu buzdolabı soğukluğunda kullanın, mümkünse bardağı da önceden soğutun.",
          "Sade soğuk matcha isterseniz sütü tamamen çıkarıp 200 ml soğuk su ve buzla için; yaz aylarında en temiz matcha tadı budur.",
        ],
      },
      {
        heading: "Matcha nasıl saklanır?",
        paragraphs: [
          "Matcha bir toz olduğu için oksijen, ışık, ısı ve neme çay yaprağından çok daha hızlı tepki verir. Yanlış saklanan iyi bir matcha birkaç hafta içinde ortalama bir matcha'ya döner.",
        ],
        bullets: [
          "Hava almayan, ışık geçirmeyen kapta saklayın; şeffaf kavanoz matcha için en kötü seçimdir.",
          "Açılmamış kutuyu buzdolabında tutabilirsiniz. Kullanmadan önce kutuyu oda sıcaklığına getirin, aksi halde kapağı açtığınızda yoğuşan nem toza girer.",
          "Açıldıktan sonra buzdolabına koymak yerine serin, karanlık bir dolapta tutmak çoğu ev kullanımı için daha pratiktir.",
          "Açıldıktan sonra 4-8 hafta içinde tüketin. Tat kaybı ani değil, yavaş bir donuklaşma biçiminde olur.",
          "Kaşığı her zaman kuru kullanın; tek bir damla su kutunun tamamını topaklandırabilir.",
          "Baharat rafından uzak tutun; matcha çevresindeki kokuları emer.",
        ],
      },
      {
        heading: "Matcha'da ne kadar kafein var?",
        paragraphs: [
          "Aşağıdaki değerler yaklaşıktır ve kaynağa göre değişir: hasat, toz gramajı, öğütme, demleme süresi ve çekirdek türü sonucu belirgin biçimde kaydırır. Tabloyu kesin ölçüm değil, kaba bir sıralama olarak okuyun.",
        ],
        bullets: [
          "Matcha'daki kafein tek başına gelmez; yanında L-teanin bulunur ve birçok kişi matcha'nın etkisini kahveye kıyasla daha yumuşak bulduğunu söyler. Bu kişisel bir deneyim tarifi, ölçülmüş bir tıbbi iddia değildir.",
          "Kafein alımınızı takip ediyorsanız hesaba servis sayısını katın: iki bardak matcha latte, iki shot espressoya yakın bir yerde durur.",
        ],
        table: [
          {
            key: "Matcha (2 g toz, 1 servis)",
            value: "Yaklaşık 60-70 mg",
          },
          {
            key: "Espresso (tek shot, ~30 ml)",
            value: "Yaklaşık 60-80 mg",
          },
          {
            key: "Filtre kahve (240 ml)",
            value: "Yaklaşık 90-100 mg",
          },
          {
            key: "Demlenmiş yeşil çay (240 ml)",
            value: "Yaklaşık 25-30 mg",
          },
          {
            key: "Siyah çay (240 ml)",
            value: "Yaklaşık 40-50 mg",
          },
        ],
      },
      {
        heading: "Matcha yaparken en sık yapılan hatalar",
        bullets: [
          "Kaynar su kullanmak. Acılığın bir numaralı sebebi budur; 70-80 °C aralığını atlamayın.",
          "Tozu elemeden kullanmak. Matcha depoda doğal olarak topaklanır; süzgeç 5 saniyelik bir iş, farkı devasa.",
          "Kaşıkla karıştırmak. Karıştırmak matcha'yı suya asmaz, sadece ıslatır. Chasen, köpürtücü ya da kapalı kavanozda çalkalama gerekir.",
          "Culinary grade tozu sade içmek. Tatlıda doğru olan toz, bardakta tanenli ve acı gelir.",
          "Matcha'yı doğrudan sütün içine dökmek. Süt tozu ıslatmakta suya göre çok daha kötüdür; önce suyla açın.",
          "Bardağı bekletmek. Matcha bir süspansiyondur; 2-3 dakika içinde dibe çöker. Hazırlar hazırlamaz için.",
          "Açık kutuda uzun süre saklamak. Altı ay önce açılmış bir kutu, ne kadar iyi marka olursa olsun artık aynı matcha değildir.",
        ],
      },
      {
        heading: "Matcha ile kahve bir arada olur mu?",
        paragraphs: [
          "Olur, ama aynı bardakta değil, aynı serviste. İtalyan bar geleneğinde affogato, bir top dondurmanın üzerine çift shot espresso dökülerek yapılır; sıcak espresso soğuk dondurmayı eritirken ortaya çıkan doku, kahvenin tek başına veremediği bir şeydir. Matcha versiyonu aynı mantığı tersten kurar: bu kez taban buzlu matcha latte, üzerine bir top dondurma gelir. Matcha'nın otsu ve umami tarafı, sütlü dondurmanın tatlılığıyla dengelenir.",
          "L'Affogato'nun Tuzla'daki barında bu iki uç aynı menüde duruyor: klasik imza L'Affogato'da fior di latte gelatonun üzerine çift shot Sirena espresso gidiyor, Matcha Affogato'da ise buzlu matcha latte'nin üzerine bir top dondurma. Matcha'yı ilk kez deneyecekseniz, sade matcha yerine bu ikinci yoldan başlamak genellikle daha yumuşak bir giriş oluyor.",
        ],
      },
    ],
    faq: [
      {
        q: "Matcha nedir, kısaca nasıl tarif edilir?",
        a: "Hasattan yaklaşık üç hafta önce gölgelenen yeşil çay yapraklarının damar ve saplarından ayrılıp taş değirmende toz haline getirilmiş halidir. Demlenip süzülmez; toz suya çırpılır ve yaprağın tamamı içilir.",
      },
      {
        q: "Matcha mı, macha mı, maca mı doğru yazım?",
        a: "Doğrusu matcha. Türkçe aramalarda 'macha' ve 'maca' yazımlarına sık rastlanır ve aynı ürün kastedilir. Ancak Peru kökenli maca kökü tozu bambaşka bir üründür, matcha ile ilgisi yoktur.",
      },
      {
        q: "Matcha'nın tadı nasıl, acı mı?",
        a: "İyi matcha umami ağırlıklı, otsu ve hafif tatlı bitişlidir; acı değildir. Acılık genellikle kaynar su, fazla toz, culinary grade tozu sade içmek ya da bayatlamış matcha kaynaklıdır.",
      },
      {
        q: "Matcha latte için su sıcaklığı kaç derece olmalı?",
        a: "70-80 °C. Kaynar su matcha'yı yakar ve acılaştırır. Termometre yoksa suyu kaynattıktan sonra 3-4 dakika açıkta bekletin.",
      },
      {
        q: "Bir bardak matcha latte için ne kadar toz gerekir?",
        a: "Servis başına yaklaşık 2 gram, yani tepeleme bir çay kaşığı. 60 ml suyla açılır, üzerine 120-150 ml süt eklenir.",
      },
      {
        q: "Ceremonial grade ile culinary grade matcha arasındaki fark nedir?",
        a: "Ceremonial grade ilk hasadın genç yapraklarından gelir; parlak yeşil, ipeksi ve az acıdır, sade içmek içindir. Culinary grade geç hasattır; daha mat, daha tanenli ve daha kuvvetlidir, tatlı ve fırın uygulamaları için kullanılır.",
      },
      {
        q: "Matcha'da kahveden daha mı çok kafein var?",
        a: "Genellikle hayır. Bir servis matcha yaklaşık 60-70 mg kafein içerir; tek shot espresso yaklaşık 60-80 mg, 240 ml filtre kahve ise 90-100 mg civarındadır. Değerler yaklaşıktır ve kaynağa göre değişir.",
      },
      {
        q: "Matcha nasıl saklanmalı ve ne kadar dayanır?",
        a: "Hava almayan, ışık geçirmeyen kapta, serin ve kuru bir yerde saklayın. Açılmamış kutu buzdolabında durabilir; açtıktan sonra 4-8 hafta içinde tüketmek en iyi tadı verir.",
      },
      {
        q: "Chasen yoksa matcha nasıl çırpılır?",
        a: "Küçük bir elektrikli süt köpürtücü iyi sonuç verir. Alternatif olarak tozu ve suyu kapaklı bir kavanozda 20-30 saniye çalkalayabilirsiniz. Her iki yöntemde de tozu önce elemek şart.",
      },
      {
        q: "Matcha sağlığa iyi gelir mi?",
        a: "Matcha antioksidan bileşikler, L-teanin ve kafein içerir. Bunun ötesindeki hastalık önleme veya tedavi iddiaları bu rehberde yer almaz; kafein duyarlılığı, gebelik veya ilaç kullanımı söz konusuysa hekiminize danışın. Bu içerik tıbbi tavsiye değildir.",
      },
    ],
    recipe: {
      category: "İçecek",
      cuisine: "Japon",
      name: "Matcha latte",
      description:
        "Ev şartlarında topaklanmadan, acılaşmadan hazırlanan klasik sıcak matcha latte. Kritik nokta sıra: matcha önce az suyla açılır, süt en sona eklenir.",
      prepMinutes: 5,
      yield: "1 bardak (yaklaşık 200 ml)",
      ingredients: [
        "2 g matcha (tepeleme 1 çay kaşığı, tercihen premium ya da ceremonial grade)",
        "60 ml su, 70-80 °C",
        "120-150 ml süt (tam yağlı inek sütü ya da yulaf sütü)",
        "İsteğe bağlı: 1 çay kaşığı bal ya da şurup",
      ],
      steps: [
        "Matcha'yı ince süzgeçten kaseye ya da kupaya eleyin; bu adım topaklanmayı önler.",
        "Suyu kaynatıp 70-80 °C'ye düşürün; termometre yoksa 3-4 dakika açıkta bekletin.",
        "60 ml suyu toz üzerine dökün ve bambu çırpıcı ya da süt köpürtücüyle 15-20 saniye, ince köpük oluşana kadar çırpın.",
        "Sütü ayrıca 60-65 °C'ye ısıtın; kaynatmayın.",
        "Sütü çırpılmış matcha'nın üzerine yavaşça ekleyip bir kez karıştırın.",
        "Tatlandıracaksanız balı ya da şurubu en son ekleyin ve hemen servis edin; matcha beklerse dibe çöker.",
      ],
    },
    image: {
      src: "/rehber/matcha-nedir.webp",
      alt: "Beyaz porselen fincanda yaprak desenli köpüğüyle sıcak matcha latte",
      width: 1600,
      height: 1067,
      credit: {
        name: "Jason Leung",
        url: "https://unsplash.com/@ninjason",
        source: "Unsplash",
        photoUrl:
          "https://unsplash.com/photos/white-ceramic-teacup-filled-of-matcha-tea-Z-hvocTfR_s",
      },
    },
    related: ["affogato-nedir", "espresso-cesitleri"],
  },
  {
    slug: "espresso-cesitleri",
    title: "Espresso bazlı kahveler",
    metaTitle: "Espresso Bazlı Kahveler: Tüm Farkları ve Oran Tablosu",
    metaDescription:
      "Cortado, flat white, latte, cappuccino, ristretto ve americano arasındaki farkı tek tabloda görün. Süt oranı, hacim, öğütüm inceliği ve seçim rehberi.",
    excerpt:
      "Espresso, ristretto, cortado, flat white, latte ve cappuccino aynı çekirdekten çıkar; farkı süt miktarı, köpük dokusu ve hacim yaratır. Hepsini tek karşılaştırma tablosunda topladık.",
    primaryKeyword: "espresso bazlı kahveler",
    keywords: [
      "espresso bazlı kahveler",
      "espresso nedir",
      "espresso çeşitleri",
      "cortado",
      "cortado nedir",
      "flat white",
      "flat white latte farkı",
      "cappuccino latte farkı",
      "ristretto nedir",
      "lungo nedir",
      "doppio",
      "macchiato nedir",
      "americano nedir",
      "mocha kahve",
      "türk kahvesi",
      "türk kahvesi espresso farkı",
      "italyan kahve",
      "kahve öğütüm inceliği",
      "moka pot espresso",
      "süt alternatifleri kahve",
      "yulaf sütü kahve köpürme",
      "mikroköpük nedir",
      "crema nedir",
      "kahve çeşitleri ve farkları",
    ],
    readingMinutes: 8,
    updatedAt: "2026-09-01",
    sections: [
      {
        heading: "Espresso nedir?",
        paragraphs: [
          "Espresso, ince öğütülmüş 7-9 gram kahvenin yaklaşık 9 bar basınç altında 25-30 saniyede 25-35 ml sıvıya dönüştürülmesiyle elde edilen yoğun kahvedir. Bir kahve türü değil, bir demleme yöntemidir. Üzerindeki fındık rengi crema, basınç altında çözünen karbondioksitin yağlarla birlikte köpük oluşturmasından gelir.",
          "Espresso bazlı kahvelerin tamamı bu tek çekirdek üzerine kurulur. Ekstra bir kahve türü yoktur; değişen şey suyun miktarı, sütün miktarı ve sütün dokusudur. Bir cortado ile bir latte arasındaki fark, aynı shot'ın 40 ml sütle mi yoksa 180 ml sütle mi buluştuğudur.",
          "Bu yüzden espresso çeşitleri arasında gezinirken isimleri ezberlemek yerine üç değişkeni okumak yeterli: kaç ml espresso, kaç ml süt, ne kadar köpük.",
        ],
      },
      {
        heading: "Espresso bazlı kahveler karşılaştırma tablosu",
        paragraphs: [
          "Aşağıdaki değerler İtalyan kahve geleneğinde ve üçüncü dalga kafelerde yaygın olarak kullanılan aralıklardır; her mekân kendi reçetesinde birkaç ml oynatabilir. Sıralama en yoğundan en hafife doğrudur.",
        ],
        table: [
          {
            key: "Ristretto",
            value:
              "7-9 g kahve, 15-20 ml sıvı · süt yok · yoğun crema · 20 ml toplam · demitasse · Daha tatlı, daha az acı, çok kısa bitiş",
          },
          {
            key: "Espresso",
            value:
              "7-9 g kahve, 25-35 ml sıvı · süt yok · 2-3 mm crema · 30 ml toplam · 60-90 ml demitasse · Yoğun, karamelize, keskin",
          },
          {
            key: "Lungo",
            value:
              "7-9 g kahve, 50-60 ml sıvı · süt yok · ince crema · 60 ml toplam · küçük fincan · Uzun ekstraksiyon, odunsu ve acımsı taraf belirgin",
          },
          {
            key: "Doppio",
            value:
              "14-18 g kahve, 50-60 ml sıvı · süt yok · kalın crema · 60 ml toplam · 90-120 ml fincan · Espresso profilinin iki katı gövde",
          },
          {
            key: "Macchiato",
            value:
              "1 shot (30 ml) · 10-15 ml süt · bir kaşık köpük · 40-50 ml toplam · demitasse · Espresso baskın, süt yalnızca keskinliği yuvarlar",
          },
          {
            key: "Cortado",
            value:
              "30-40 ml espresso · 30-40 ml süt · neredeyse köpüksüz, 3-4 mm · 60-90 ml toplam · küçük cam bardak · 1:1 denge, kahve hâlâ önde",
          },
          {
            key: "Flat White",
            value:
              "40-60 ml çift shot (sık sık ristretto) · 100-120 ml süt · 0,5 cm mikroköpük · 150-180 ml toplam · geniş ağızlı fincan · Kadifemsi doku, kahve baskın",
          },
          {
            key: "Cappuccino",
            value:
              "30-60 ml espresso · 60-70 ml süt · 1-1,5 cm sıkı köpük · 150-180 ml toplam · kulplu porselen · Köpüklü, hafif, kahve belirgin",
          },
          {
            key: "Latte",
            value:
              "30-60 ml espresso · 150-200 ml süt · yaklaşık 1 cm ince köpük · 220-300 ml toplam · uzun bardak veya büyük fincan · Yumuşak, sütlü, en hafif profil",
          },
          {
            key: "Mocha",
            value:
              "30-60 ml espresso · 120-150 ml süt + 15-20 g çikolata · köpük ya da krema · 200-250 ml toplam · uzun bardak · Tatlı, çikolatalı, tatlı yerine geçer",
          },
          {
            key: "Americano",
            value:
              "30-60 ml espresso · süt yok, 90-120 ml sıcak su · crema seyrelir · 150-180 ml toplam · kupa · Seyreltilmiş ama filtreye göre daha gövdeli",
          },
        ],
      },
      {
        heading: "Ristretto, lungo ve doppio arasındaki fark nedir?",
        paragraphs: [
          "Üçü de sütsüzdür ve aynı öğütümü kullanır; fark, aynı kahve yatağından ne kadar su geçirdiğinizdir. Ekstraksiyon sırasında önce asitler ve şekerler, sonra acı bileşikler çözünür. Bu sıralama üç içeceğin tadını doğrudan açıklar.",
          "Ristretto suyu erken keser: 15-20 ml'de durursunuz, dolayısıyla tatlı ve yoğun kalır, acılık düşüktür. Lungo tam tersi; 50-60 ml'ye kadar akıtırsınız ve ekstraksiyonun geç aşamasındaki acı bileşikler bardağa girer. Lungo'yu americano ile karıştırmayın: lungo'da fazladan su kahvenin içinden geçer, americano'da ise hazır espresso'nun üstüne eklenir.",
          "Doppio ise oran değil miktar meselesidir. 14-18 g kahveyle çift shot çekilir; oran espresso ile aynıdır, sadece porsiyon ikiye katlanır. Çift filtre sepetiyle çalışan kafelerde 'espresso' siparişi doppio olarak da gelebilir; emin değilseniz tek shot mu çift shot mu olduğunu sormak yeterli.",
        ],
        bullets: [
          "Ristretto: kısa akış, yüksek tatlılık, düşük acılık",
          "Lungo: uzun akış, artan acılık, daha ince gövde",
          "Doppio: iki kat kahve, iki kat sıvı, aynı oran",
          "Yaygın hata: lungo ile americano'yu eş saymak",
        ],
      },
      {
        heading: "Flat white, latte ve cappuccino farkı nedir?",
        paragraphs: [
          "En çok karıştırılan üçlü budur ve ayırt edici unsur sütün miktarından çok dokusudur. Cappuccino'da süt kuru ve hacimli köpükle bitirilir; kaşıkla alınabilecek 1-1,5 cm'lik bir tabaka oluşur ve bardağın toplam hacmi 150-180 ml civarında kalır. İtalya'da geleneksel olarak sabah içeceği sayılır.",
          "Flat white 1980'lerde Avustralya ve Yeni Zelanda kafe kültüründe yaygınlaştı. Aynı 150-180 ml hacimde servis edilir ama süt mikroköpük olarak buharlanır: gözle görülür kabarcık yoktur, süt boya kıvamında akar ve espressoyla homojen karışır. Birçok kafede flat white çift ristretto ile hazırlanır, bu yüzden aynı hacimde latte'ye göre kahve daha belirgindir.",
          "Latte ise en sütlü olanıdır. 220-300 ml'ye çıkan hacimde 150-200 ml süt bulunur, köpük tabakası incedir ve kahve arka planda kalır. Kahve tadını sevmeyip sıcak sütlü içecek isteyen için mantıklı seçim latte'dir; kahveyi arayan için flat white.",
        ],
        table: [
          {
            key: "Kahve algısı",
            value: "Flat white en yüksek, cappuccino orta, latte en düşük",
          },
          {
            key: "Süt dokusu",
            value:
              "Flat white mikroköpük (kabarcıksız), cappuccino sıkı ve hacimli köpük, latte ince köpük",
          },
          {
            key: "Toplam hacim",
            value:
              "Flat white 150-180 ml, cappuccino 150-180 ml, latte 220-300 ml",
          },
          {
            key: "Süt sıcaklığı",
            value:
              "Üçünde de yaklaşık 60-65 C hedeflenir; 70 C üzerinde süt genellikle pişmiş tat verir ve algılanan tatlılığı azalır",
          },
          {
            key: "Köken",
            value:
              "Cappuccino İtalya, flat white Avustralya/Yeni Zelanda, latte İtalyan kökenli ama bugünkü hâli Amerika'da yaygınlaştı",
          },
        ],
      },
      {
        heading: "Cortado nedir ve neden küçük cam bardakta gelir?",
        paragraphs: [
          "Cortado İspanyolcada 'kesilmiş' anlamına gelir; espressonun buharlanmış sütle 'kesilerek' asiditesinin yumuşatılmasını anlatır. Klasik oran 1:1'dir: 30-40 ml espresso, aynı miktar süt. Köpük neredeyse yoktur, sadece 3-4 mm'lik ince bir tabaka bırakılır.",
          "Cam bardak tercihi estetik değil işlevseldir. Cortado az sütle yapıldığı için katmanlar gözle takip edilebilir; barista sütün espressonun içine ne kadar girdiğini bardaktan görür. İnce cam ayrıca porselene göre ısıyı daha hızlı salar, böylece 60-90 ml'lik küçük içecek birkaç dakikada içilebilir sıcaklığa iner. Klasik servis kabı kalın tabanlı, kulpsuz küçük bardaktır.",
          "İspanya'da genellikle sade, Latin Amerika'da yoğunlaştırılmış sütle yapılan yerel varyantları vardır. Süt sevmeyen ama sade espressoyu sert bulanlar için en dengeli ara noktadır.",
        ],
      },
      {
        heading: "Macchiato nedir, cappuccino'dan farkı ne?",
        paragraphs: [
          "Macchiato İtalyancada 'lekelenmiş' demektir: tek shot espressonun üzerine yalnızca 10-15 ml süt ve bir kaşık köpük eklenir. Toplam hacim 40-50 ml'de kalır, yani cappuccino'nun yaklaşık üçte biri. Amaç sütlü bir içecek yapmak değil, espressonun keskin bitişini bir tık yuvarlamaktır.",
          "Menülerde 'caramel macchiato' benzeri adlarla geçen büyük bardaklı, bol sütlü içecekler ise hacim olarak klasik macchiato ile aynı şey değildir; sipariş verirken hangisini kastettiğinizi belirtmek karışıklığı önler.",
        ],
      },
      {
        heading: "Türk kahvesi ile espresso arasındaki fark nedir?",
        paragraphs: [
          "Türk kahvesi espresso ailesinin bir üyesi değildir; tamamen farklı bir demleme mantığı kullanır. Espresso basınçlı ekstraksiyondur ve kahve telvesi filtrede kalır. Türk kahvesinde ise kahve suyla birlikte cezvede kaynama noktasına yaklaştırılır, telve bardağa dökülür ve dipte çöker. Yani içerken katı parçacıkla temas edersiniz.",
          "Öğütüm inceliği de aynı değildir. Türk kahvesi pudra inceliğinde, espresso ondan belirgin biçimde kalın öğütülür. Çoğu espresso değirmeni Türk kahvesi inceliğine inemez; tersi de geçerlidir, Türk kahvesi öğütümüyle espresso makinesinde akış tıkanır.",
          "Köpük kavramı da farklıdır. Espressoda crema basınçtan doğan yağ-gaz emülsiyonudur; Türk kahvesinde köpük, ısınma sırasında yüzeye çıkan kabarcıkların yavaş dökümle korunmasıyla elde edilir. İkisi kimyasal olarak akraba değildir.",
        ],
        table: [
          {
            key: "Yöntem",
            value:
              "Espresso: 9 bar basınç, 25-30 sn · Türk kahvesi: cezvede yavaş ısıtma, 3-4 dk",
          },
          {
            key: "Öğütüm",
            value:
              "Espresso: ince · Türk kahvesi: pudra inceliğinde, belirgin şekilde daha ince",
          },
          {
            key: "Telve",
            value:
              "Espresso: filtrede kalır · Türk kahvesi: fincanda dibe çöker",
          },
          {
            key: "Servis",
            value:
              "Espresso: 30 ml demitasse, tek başına · Türk kahvesi: 60-70 ml fincan, su ve genellikle tatlı yanında",
          },
          {
            key: "Şeker",
            value:
              "Espresso: sonradan eklenir · Türk kahvesi: pişirmeden önce cezveye konur (sade, az, orta, şekerli)",
          },
        ],
      },
      {
        heading: "Süt alternatifleri hangi içecekte iyi çalışır?",
        paragraphs: [
          "Bitkisel sütlerin köpürme davranışını protein ve yağ oranı belirler. İnek sütünde protein, ısıtılırken hava kabarcıklarının etrafında dayanıklı bir zar kurar; bitkisel sütlerde bu görevi çoğunlukla üreticinin eklediği stabilizatörler üstlenir. Bu yüzden 'barista' etiketli versiyonlar klasik versiyonlardan çok daha iyi köpürür.",
        ],
        bullets: [
          "Yulaf sütü: en dengeli alternatif. Kremamsı gövdesi ve doğal tatlılığı sayesinde flat white ve cortado'da mikroköpük tutar; espressonun asiditesiyle kesilmez",
          "Soya sütü: proteini yüksek olduğu için hacimli köpük verir, cappuccino'da iyi sonuç alınır. Çok asidik ve çok sıcak espressoyla temasta kesilme riski vardır, sütü önce bardağa koymak bu riski azaltır",
          "Badem sütü: yağ oranı düşük, köpük çabuk söner. Latte ve iced içeceklerde iş görür, latte art için uygun değildir. Belirgin fındıksı tadı kahvenin önüne geçebilir",
          "Hindistan cevizi sütü: aromatik ve tatlı; mocha ve tatlı profilli içeceklerde işe yarar, sade cortado'da kahveyi bastırır",
          "Alerjen notu: soya, badem ve fındık bazlı sütler alerjen içerir; alerjiniz varsa sipariş sırasında mutlaka belirtin",
          "Genel kural: bitkisel sütü 60-65 C'yi aşmayacak şekilde buharlayın. Aşırı ısınma hem tadı yakar hem köpüğü çökertir",
        ],
      },
      {
        heading: "Kahve öğütüm inceliği tablosu",
        paragraphs: [
          "Yanlış öğütüm, kötü kahvenin en sık nedenidir. Basınç ne kadar yüksekse öğütüm o kadar ince, temas süresi ne kadar uzunsa o kadar kaba olmalıdır. Mikron değerleri değirmene ve kahveye göre değişir; parmak arası kontrolü pratikte daha güvenilirdir.",
        ],
        table: [
          {
            key: "Türk kahvesi",
            value:
              "En ince, pudra kıvamı · parmak arasında un gibi · 3-4 dk temas",
          },
          {
            key: "Espresso",
            value:
              "İnce, pudra şekeriyle ince tuz arası · topaklanabilir · 25-30 sn temas",
          },
          {
            key: "Moka pot",
            value: "Espressodan bir tık kaba · ince kum · 4-5 dk temas",
          },
          {
            key: "Filtre / V60",
            value: "Orta · deniz kumu kıvamı · 2,5-3,5 dk temas",
          },
          {
            key: "French press",
            value: "Kaba · iri deniz tuzu · 4 dk temas, sonra bastır",
          },
        ],
      },
      {
        heading: "Evde espresso makinesi yoksa ne yapılır?",
        paragraphs: [
          "Moka pot gerçek espresso üretmez; yaklaşık 1,5-2 bar basınçla çalışır, yani 9 barlık bir makinenin kabaca beşte biri. Ama doğru kullanıldığında cortado, flat white benzeri sütlü içecekler için yeterince yoğun bir baz verir. En yaygın hata, moka potu yüksek ateşte ve soğuk suyla başlatmaktır; ikisi de yanık tat üretir.",
        ],
        ordered: [
          "Alt hazneyi valfin hemen altına kadar sıcak suyla doldurun. Soğuk su, kahvenin ocakta uzun süre ısınmasına ve yanmasına yol açar",
          "Kahveyi filtre sepetine dökün, üstünü parmakla düzleyin ama bastırmayın. Moka potta tamping gerekmez, tıkanma yapar",
          "Öğütümü espressodan bir kademe kaba tutun; espresso inceliği bu basınçta akışı boğar",
          "Potu kısık-orta ateşe alın, kapağı açık bırakın ve akışı izleyin",
          "Kahve altın renkte ve yavaş akmalı. Fışkırma ve tıslama başladığında ocaktan alın",
          "Tabanı ıslak beze değdirerek pişmeyi durdurun, hemen bardağa alın",
          "Sütlü içecek yapacaksanız 60-70 ml moka kahvesini 60-70 ml buharlanmış sütle birleştirin; cortado'ya en yakın sonucu bu oran verir",
        ],
      },
      {
        heading: "Hangi içecek kime uygun?",
        paragraphs: [
          "Kahve çeşitleri ve farkları menüde karışık görünür; karar veremiyorsanız içecek adına değil, üç sorunun cevabına bakın: sütü seviyor musunuz, kahve tadının ne kadar önde olmasını istiyorsunuz, tatlı arıyor musunuz.",
        ],
        bullets: [
          "Süt sevmiyorsanız: espresso, doppio ya da americano. Espresso yoğun gelirse americano aynı kahveyi seyrelterek daha uzun sürede içmenizi sağlar",
          "Kahveyi öne çıkarmak istiyorsanız ama sütsüz içemiyorsanız: cortado veya flat white. Cortado daha küçük ve keskin, flat white daha kadifemsi",
          "Sütlü ve yumuşak istiyorsanız: latte veya cappuccino. Köpük dokusunu seviyorsanız cappuccino, düz ve sütlü istiyorsanız latte",
          "Tatlı arıyorsanız: mocha ya da bir top dondurmanın üzerine espresso döküldüğü affogato. İkincisi tatlı ve kahveyi tek serviste birleştirir",
          "Kafein hassasiyetiniz varsa: kahvenin kafein içerdiğini unutmayın; miktar çekirdeğe, öğütüme ve ekstraksiyona göre değişir. Tek shot espresso, hacmi küçük olduğu için bir kupa filtre kahveden genellikle daha az toplam kafein taşır. Bu bir sağlık tavsiyesi değildir; kişisel duyarlılığınız için hekiminize danışın",
          "Akşam içecekseniz: kafeinsiz alternatifler daha rahat bir tercih olur; salep, sıcak çikolata ya da bitki çayı bu grupta",
        ],
      },
      {
        heading: "L'Affogato'da espresso nasıl kullanılıyor?",
        paragraphs: [
          "Tuzla'daki 200 yıllık restore Rum köşkünde, İtalyan bar geleneğine sadık bir espresso hattı çalışıyor: sade Espresso, Cortado, Flat White, Cappuccino ve Latte aynı çekirdekten çekiliyor. İmza içecek olan L'Affogato ise espressoyu bir bardağa değil, yenilebilir waffle kupa içindeki tek top fior di latte gelatonun üzerine döküyor. Çift shot Sirena espresso sıcak, gelato soğuk; kupanın kendisi de yeniyor.",
          "Yani espresso bazlı içeceklerin listesindeki son adım burada bir kupa değil, tatlının kendisi oluyor.",
        ],
      },
    ],
    faq: [
      {
        q: "Espresso ile americano arasındaki fark nedir?",
        a: "Americano, hazır çekilmiş espressonun üzerine 90-120 ml sıcak su eklenerek yapılır. Kahve miktarı aynıdır, sadece seyreltilir. Lungo'dan farkı şudur: lungo'da fazladan su kahve yatağının içinden geçer ve ekstra bileşik çözer, americano'da su ekstraksiyondan sonra eklenir.",
      },
      {
        q: "Flat white ile latte arasındaki fark nedir?",
        a: "Flat white 150-180 ml hacimde, 100-120 ml mikroköpüklü sütle yapılır ve genellikle çift ristretto kullanır; kahve baskındır. Latte 220-300 ml'ye çıkar, 150-200 ml süt içerir ve kahve arka planda kalır. Fark hem hacimde hem süt dokusundadır.",
      },
      {
        q: "Cortado ne demek?",
        a: "İspanyolcada 'kesilmiş' anlamına gelir. Espressonun eşit miktarda buharlanmış sütle kesilerek asiditesinin yumuşatılmasını anlatır. Klasik oran 1:1'dir ve neredeyse köpüksüz servis edilir, toplam hacim 60-90 ml civarındadır.",
      },
      {
        q: "Ristretto espresso'dan daha mı sert?",
        a: "Tat olarak daha yoğun ama daha az acıdır. Su erken kesildiği için ekstraksiyonun geç aşamasındaki acı bileşikler bardağa girmez. Toplam kafein miktarı ise espressodan biraz daha düşük olma eğilimindedir; kesin değer kahveye ve reçeteye göre değişir.",
      },
      {
        q: "Cappuccino sabah mı içilir?",
        a: "İtalya'da geleneksel olarak öğleden önce tüketilir; yemek sonrası tercih genellikle sade espressodur. Bu bir kural değil, kültürel bir alışkanlıktır ve İtalya dışında geçerliliği yoktur.",
      },
      {
        q: "Türk kahvesi espresso bazlı bir içecek midir?",
        a: "Hayır. Espresso basınçlı ekstraksiyonla yapılır ve telve filtrede kalır; Türk kahvesi cezvede yavaş ısıtmayla demlenir ve telve fincanda kalır. Öğütüm inceliği, köpük oluşumu ve servis biçimi de farklıdır.",
      },
      {
        q: "Hangi bitkisel süt kahvede en iyi köpürür?",
        a: "Genel olarak barista serisi yulaf sütü en tutarlı sonucu verir; kremamsı gövdesiyle flat white ve cortado'da mikroköpük tutar. Soya sütü proteini yüksek olduğu için hacimli köpük verir ama asidik espressoyla kesilme riski taşır. Badem sütünün köpüğü çabuk söner.",
      },
      {
        q: "Moka pot ile espresso yapılır mı?",
        a: "Tam olarak değil. Moka pot yaklaşık 1,5-2 bar basınçla çalışır, espresso makinesi ise 9 bar. Sonuç crema'sız ve daha az yoğundur ama sütlü içecekler için yeterince güçlü bir baz sağlar. Sıcak suyla başlamak ve kısık ateşte pişirmek yanık tadı önler.",
      },
      {
        q: "Espresso'da ne kadar kafein var?",
        a: "Tek shot espressoda ortalama 60-80 mg civarında kafein bulunur; kesin değer çekirdek türüne, öğütüme, doza ve ekstraksiyona göre değişir. Hacmi küçük olduğu için bir kupa filtre kahveden genellikle daha az toplam kafein içerir. Bu bilgi tıbbi tavsiye değildir.",
      },
      {
        q: "Kahve sipariş ederken süt oranını nasıl söylerim?",
        a: "İçecek adı yerine oran söylemek en net yoldur: 'espresso kadar süt' cortado, 'az köpüklü ve sütü fazla' latte, 'ince mikroköpük, küçük fincan' flat white anlamına gelir. Baristalar bu tarifleri isimden daha kolay uygular.",
      },
    ],
    image: {
      src: "/rehber/espresso-cesitleri.webp",
      alt: "Koyu taş zemin üzerinde kreması belirgin bir fincan espresso, yukarıdan",
      width: 1600,
      height: 1067,
      credit: {
        name: "Matt Hoffman",
        url: "https://unsplash.com/@__matthoffman__",
        source: "Unsplash",
        photoUrl:
          "https://unsplash.com/photos/white-ceramic-mug-fill-with-coffee-IE-gdqEg45M",
      },
    },
    related: ["affogato-nedir", "matcha-nedir", "yenilebilir-kahve-fincani"],
  },
  {
    slug: "san-sebastian-cheesecake",
    title: "San Sebastian cheesecake",
    metaTitle: "San Sebastian Cheesecake: Tarifi, Sırları ve Farkları",
    metaDescription:
      "San Sebastian cheesecake nedir, neden üstü yanık ortası akışkan olur? Oranlar, fırın sıcaklığı, adım adım tarif ve yaygın hatalar bu rehberde. Hemen dene.",
    excerpt:
      "Bask bölgesinden çıkan, tabansız, yüksek sıcaklıkta pişen, üstü bilerek yanık ortası akışkan cheesecake. Oranlar, fırın ayarı, adım adım tarif ve sık yapılan hatalar.",
    primaryKeyword: "san sebastian cheesecake",
    keywords: [
      "san sebastian cheesecake",
      "san sebastian cheesecake nedir",
      "san sebastian cheesecake tarifi",
      "burnt cheesecake",
      "yanık cheesecake",
      "bask cheesecake",
      "basque burnt cheesecake",
      "donostia cheesecake",
      "san sebastian cheesecake kaç derecede pişer",
      "san sebastian cheesecake kaç dakika pişer",
      "new york cheesecake farkı",
      "akışkan cheesecake",
      "ev yapımı san sebastian cheesecake",
      "blueberry san sebastian cheesecake",
      "san sebastian cheesecake nasıl saklanır",
    ],
    readingMinutes: 8,
    updatedAt: "2026-09-01",
    sections: [
      {
        heading: "San Sebastian cheesecake nedir?",
        paragraphs: [
          "San Sebastian cheesecake, İspanya'nın Bask bölgesindeki Donostia-San Sebastián şehrinden çıkan, tabansız, 200-220 °C gibi yüksek sıcaklıkta kısa sürede pişirilen krem peynirli bir tatlıdır. Üstü bilerek koyu kahverengiye kadar karamelize edilir, ortası ise akışkan bırakılır. Dünyada 'burnt cheesecake' ya da 'yanık cheesecake' adıyla da bilinir.",
          "Tatlının kaynağı Donostia'nın eski şehir bölgesindeki pintxo barlarına, özellikle La Viña'ya dayanır; 1990'ların başından beri aynı biçimde, yüksek kenarlı fırın kağıdı serilmiş bir kalıpta, dilim dilim tezgâhta servis edilir. Bask mutfağında tatlı, restoranın gösterişli finali değil barın günlük parçasıdır: bu yüzden tarif sade, malzeme listesi kısa ve teknik tektir.",
          "Türkiye'de menülerde çoğu zaman şehrin Bask dilindeki adıyla, Donostia olarak da geçer. İkisi aynı tatlıdır; 'San Sebastian' İspanyolca, 'Donostia' Bask dilindeki karşılığıdır.",
        ],
      },
      {
        heading: "Neden üstü yanık oluyor?",
        paragraphs: [
          "Üstteki koyu renk kaza değil, tarifin kendisidir. Fırın 200 °C'nin üzerine çıktığında yüzeydeki şeker karamelize olur, aynı anda süt proteinleri ve şeker arasındaki Maillard tepkimesi devreye girer. Bu iki tepkime birlikte, kremanın düz tatlılığını kesen kavrulmuş, hafif tuzlu-karamel bir kabuk üretir.",
          "Burada kritik ayrım şudur: 'yanık' aranan şey koyu kahverengidir, siyah değil. Siyaha dönen, çatlayıp kömürleşen bir yüzey acı verir ve tatlının tamamını bozar. Doğru sonuç, üstü kestane rengi ile koyu kahve arası, kenarları biraz daha koyu, dokunduğunda hâlâ yumuşak bir kabuktur. Ağızda önce karamel, ardından krem peynirin ekşiliği gelmelidir.",
          "Kabuğun düzgün oluşması için üst ısının alttan güçlü olması işe yarar; ev fırınlarında çoğu kez son 5 dakikada kalıbı üst rafa almak yeterlidir.",
        ],
      },
      {
        heading: "Neden ortası akışkan kalıyor?",
        paragraphs: [
          "Akışkan merkez üç değişkenin sonucudur: çok az un veya nişasta, yüksek yağ oranı ve kısa pişirme süresi. Klasik cheesecake'lerde un ve nişasta yumurta proteinini destekleyip yapıyı sabitler; San Sebastian'da un miktarı peynir ağırlığının yalnızca yüzde 2-3'ü kadardır, bazı tariflerde hiç yoktur. Bağlayıcı azalınca iç kısım jel yerine krema kıvamında kalır.",
          "İkinci etken yağdır. Tam yağlı krem peynir ve en az yüzde 35 yağlı krema, yumurtanın pıhtılaşma sıcaklığını yükseltir ve pişerken suyunu bırakmasını yavaşlatır. Üçüncüsü süredir: kek 25-35 dakikada fırından çıkar, merkezdeki iç sıcaklık yaklaşık 65-70 °C'ye ulaştığında pişirme durur. Kalıp fırından alındıktan sonra artık ısı birkaç derece daha çalışmaya devam eder, buna 'carry-over' denir.",
          "Fırından çıktığında kekin ortası tabak gibi sarsıldığında oynuyorsa doğru noktadasınız. Tam sıkı görünen bir merkez, soğuduğunda kuru bir cheesecake demektir.",
        ],
      },
      {
        heading: "New York cheesecake'ten farkı ne?",
        paragraphs: [
          "İki tatlı da krem peynir temellidir ama pişirme mantıkları taban tabana zıttır. New York cheesecake düşük sıcaklıkta, benmari içinde, çatlamadan ve homojen pişmek için tasarlanmıştır; San Sebastian ise yüksek sıcaklıkta, bilerek eşitsiz pişer.",
        ],
        table: [
          {
            key: "Taban",
            value:
              "San Sebastian: yok. New York: bisküvi veya graham kraker tabanı",
          },
          {
            key: "Fırın sıcaklığı",
            value: "San Sebastian: 200-220 °C. New York: 150-160 °C",
          },
          {
            key: "Benmari",
            value:
              "San Sebastian: kullanılmaz. New York: neredeyse her zaman kullanılır",
          },
          {
            key: "Pişirme süresi",
            value: "San Sebastian: 25-35 dakika. New York: 60-90 dakika",
          },
          {
            key: "Doku",
            value:
              "San Sebastian: kenar sıkı, merkez akışkan. New York: baştan sona yoğun ve sıkı",
          },
          {
            key: "Üst yüzey",
            value:
              "San Sebastian: koyu kahverengi, karamelize, çatlaklı. New York: soluk, düz, çatlaksız hedeflenir",
          },
          {
            key: "Un/nişasta",
            value:
              "San Sebastian: yok denecek kadar az (%2-3). New York: belirgin miktarda nişasta veya un",
          },
          {
            key: "Dinlenme",
            value:
              "San Sebastian: buzdolabında 4-6 saat. New York: genelde bir gece",
          },
          {
            key: "Servis sıcaklığı",
            value:
              "San Sebastian: oda sıcaklığına yakın, 18-20 °C. New York: soğuk, buzdolabından çıkar çıkmaz",
          },
        ],
      },
      {
        heading: "Oranlar ne olmalı?",
        paragraphs: [
          "Tarifi ezberlemek yerine oranı akılda tutmak daha işe yarar. Krem peyniri 100 kabul edip diğer malzemeleri ona göre ölçeklerseniz kalıp boyutu değiştiğinde tarif bozulmaz.",
        ],
        table: [
          {
            key: "Krem peynir (tam yağlı)",
            value: "1000 g - temel oran, 100 kabul edilir",
          },
          {
            key: "Toz şeker",
            value: "350-400 g - peynirin %35-40'ı",
          },
          {
            key: "Krema (min. %35 yağ)",
            value: "450-500 ml - peynirin %45-50'si",
          },
          {
            key: "Yumurta (L boy)",
            value: "5-6 adet, yaklaşık 300 g",
          },
          {
            key: "Un",
            value: "20-30 g - peynirin %2-3'ü",
          },
          {
            key: "Tuz",
            value: "2-3 g - karameli dengeler",
          },
          {
            key: "Kalıp",
            value: "20-22 cm çapında, yüksek kenarlı kelepçeli kalıp",
          },
        ],
      },
      {
        heading: "San Sebastian cheesecake nasıl yapılır?",
        paragraphs: [
          "Tek kâse, tek kalıp, tek pişirme. Zorluk teknikte değil, sabırdadır: karışımı fazla çırpmamak ve keki erken kesmemek.",
        ],
        ordered: [
          "Krem peyniri, kremayı ve yumurtaları pişirmeden en az 1 saat önce buzdolabından çıkarın; hepsi oda sıcaklığında olmalı.",
          "Fırını 210 °C'ye ayarlayıp ısıtmaya bırakın. Fan varsa kapatın, alt-üst ısıtmayı seçin.",
          "20-22 cm kelepçeli kalıba iki kat fırın kâğıdını buruşturarak serin; kâğıt kalıp kenarını en az 5 cm aşmalı. Buruşuk kıvrımlar bu tatlının imzasıdır, düzeltmeye çalışmayın.",
          "Krem peyniri ve şekeri düşük devirde, pürüz kalmayana kadar 2-3 dakika karıştırın. Amaç hava katmak değil, homojen bir krema elde etmektir.",
          "Yumurtaları teker teker ekleyin, her birinde yalnızca karışana kadar çevirin. Fazla çırpmak kabarma ve ardından çökme yaratır.",
          "Kremayı ince bir şerit hâlinde dökerek karıştırın, tuzu ekleyin.",
          "Unu eleyerek son anda ekleyin ve spatulayla 15-20 saniye çevirin. Un ne kadar az çalışırsa merkez o kadar akışkan kalır.",
          "Karışımı ince telli süzgeçten geçirerek kalıba dökün; bu adım topakları ve iri hava kabarcıklarını alır.",
          "Kalıbı tezgâha 2-3 kez hafifçe vurup yüzeydeki kabarcıkları patlatın.",
          "Fırının orta rafında 25-35 dakika pişirin. Üstü koyu kahverengi olduğunda ve kalıbı salladığınızda merkezdeki 3-4 cm'lik alan hâlâ oynadığında çıkarın.",
          "Kalıpta, oda sıcaklığında 1-2 saat dinlendirin. Kek ortadan hafifçe çökecek; bu beklenen sonuçtur.",
          "Buzdolabında en az 4-6 saat, tercihen bir gece bekletin. Servisten 30-40 dakika önce çıkarın; 18-20 °C civarında, sıcak bıçakla kesin.",
        ],
      },
      {
        heading: "Fırın sıcaklığı ve süre nasıl ayarlanır?",
        paragraphs: [
          "Ev fırınlarının termostatları çoğu zaman 10-20 °C sapar. Süreye değil, renge ve merkezin hareketine bakın.",
        ],
        table: [
          {
            key: "Fırın sıcaklığı",
            value: "200-220 °C, fansız alt-üst ısıtma",
          },
          {
            key: "Süre (20 cm kalıp)",
            value: "25-35 dakika",
          },
          {
            key: "Süre (24 cm kalıp)",
            value:
              "30-40 dakika, karışım daha ince yayıldığı için renk erken gelir",
          },
          {
            key: "Merkez iç sıcaklığı",
            value: "yaklaşık 65-70 °C",
          },
          {
            key: "Çıkarma işareti",
            value:
              "üst koyu kahverengi, merkezde 3-4 cm'lik alan sallandığında oynuyor",
          },
          {
            key: "Oda sıcaklığında dinlenme",
            value: "1-2 saat",
          },
          {
            key: "Buzdolabında dinlenme",
            value: "en az 4-6 saat",
          },
          {
            key: "Servis sıcaklığı",
            value: "18-20 °C, buzdolabından 30-40 dakika önce çıkarılmış",
          },
        ],
      },
      {
        heading: "En sık yapılan hatalar neler?",
        bullets: [
          "Fazla un koymak: 1 kg peynire 100 g un ekleyen tarifler kek üretir, cheesecake değil. Oran %2-3'ü aşmamalı.",
          "Fırını düşük tutmak: 170-180 °C'de üst karamelize olmadan iç pişer; sonuç soluk renkli, sıkı bir tatlıdır.",
          "Soğuk malzeme kullanmak: buzdolabından çıkan krem peynir topaklanır, süzmeye rağmen doku pütürlü kalır.",
          "Yumurtaları fazla çırpmak: karışıma giren hava fırında şişer, çıkışta çöker ve içeride büyük boşluklar bırakır.",
          "Benmari kullanmak: nemli ortam kabuğu engeller; bu tarifte kuru sıcaklık şart.",
          "Erken kesmek: 1-2 saat sonra kesilen kek dağılır. Yapı buzdolabında oturur, fırında değil.",
          "Yağı düşük krema kullanmak: %30'un altındaki kremalar suyunu bırakır, merkez akışkan değil sulu olur.",
          "Kalıbı yağlayıp kâğıt sermemek: kenarlardaki karakteristik kıvrımlar oluşmaz, çıkarırken yüzey yırtılır.",
        ],
      },
      {
        heading: "Hangi varyasyonlar işe yarar?",
        paragraphs: [
          "Temel tarif dengeli olduğu için ekleme yaparken toplam sıvı ve yağ oranını bozmamak gerekir. Meyveli versiyonlarda meyvenin suyunu bırakması en büyük risktir.",
        ],
        bullets: [
          "Yaban mersinli (blueberry): dondurulmuş yaban mersini çözdürülmeden, unla hafifçe bulanarak karışıma katılır; böylece dibe çökmez ve suyunu geç bırakır.",
          "Antep fıstıklı: 80-100 g saf fıstık ezmesi krem peynirle birlikte karıştırılır. Ek şeker gerekmez, ezmenin kendisi tatlıdır.",
          "Kahveli: 15-20 ml sıcak espresso ya da 2 çay kaşığı çözünür kahve kremaya karıştırılıp eklenir; karamelize kabukla aynı yönde çalışır.",
          "Bitter çikolatalı: 100 g eritilmiş %70 çikolata karışımın üçte birine yedirilip mermer desen bırakacak şekilde çevrilir.",
          "Limon kabuğu rendesi: 1 limonun kabuğu, krem peynirin ekşiliğini öne çıkarır; şekeri 30-40 g azaltmak dengeyi korur.",
        ],
      },
      {
        heading: "Yanında ne içilir?",
        paragraphs: [
          "San Sebastian cheesecake yağ oranı yüksek, tatlılığı belirgin bir tatlıdır; yanına giden içecek onu yıkamalı, üstüne şeker eklememelidir. Bu yüzden sütlü ve şekerli kahveler yerine sade espresso ya da Americano daha iyi çalışır. Espressonun asiditesi kremanın ağırlığını keser, yanık kabuktaki karamel notasıyla aynı frekansta buluşur.",
          "İkinci güçlü eşleşme affogato'dur: sıcak espressonun altındaki soğuk gelato, cheesecake'in oda sıcaklığındaki dokusuyla üç ayrı sıcaklık katmanı kurar. Bologna'nın bar geleneğinde tatlı ve espresso zaten ayrı servis edilmez; ikisi aynı anda, ayakta içilir. Sade çayın da işi görür ama kabuktaki karamele eşlik etmez.",
          "L'Affogato'nun Tuzla'daki barında bu tatlı menüde San Sebastian ve Yaban Mersinli San Sebastian olarak yer alır; yanında imza L'Affogato ya da tek shot espresso ile denenebilir.",
        ],
      },
      {
        heading: "Nasıl saklanır ve dondurulabilir mi?",
        paragraphs: [
          "Buzdolabında, üstü hafifçe kapatılmış biçimde 3-4 gün dayanır. Sıkı streç film yüzeye yapışıp kabuğu yumuşatır; onun yerine kabın üstünü örtün ya da kapaklı bir saklama kabı kullanın. İkinci gün doku biraz daha oturur, çoğu kişi tadını o gün daha dengeli bulur.",
          "Dondurulabilir. Tamamen soğuduktan sonra dilimlenip her dilim ayrı ayrı fırın kâğıdı ve streçle sarılır, 1 aya kadar saklanır. Çözdürme buzdolabında, bir gecede yapılmalıdır; oda sıcaklığında hızlı çözdürmek su bırakmasına yol açar.",
          "Servis öncesi mutlaka 30-40 dakika dışarıda bekletin. Buzdolabı soğukluğunda krem peynirin yağı sertleşir ve tatlının en belirgin özelliği olan akışkan merkez hissedilmez.",
        ],
      },
    ],
    faq: [
      {
        q: "San Sebastian cheesecake ile burnt cheesecake aynı şey mi?",
        a: "Evet. Bask bölgesinin Donostia-San Sebastián şehrinden çıktığı için San Sebastian, üstü bilerek karamelize edildiği için burnt (yanık) cheesecake denir. Menülerde Donostia veya Bask cheesecake adıyla da geçer; tarif aynıdır.",
      },
      {
        q: "San Sebastian cheesecake kaç derecede pişer?",
        a: "200-220 °C arasında, fansız alt-üst ısıtmayla pişer. 20 cm kalıpta süre 25-35 dakikadır. Fırın termostatları sapabildiği için süreye değil, üst yüzeyin koyu kahverengiye dönmesine ve merkezin hâlâ oynamasına bakın.",
      },
      {
        q: "Ortası akışkan kalmazsa ne yapmalıyım?",
        a: "Genelde üç sebebi vardır: un fazla, fırın düşük ya da süre uzun. Unu peynir ağırlığının %2-3'üne indirin, sıcaklığı 210 °C'ye çıkarın ve merkezdeki 3-4 cm hâlâ sallanırken fırından alın.",
      },
      {
        q: "Üstü yanık olmalı derken ne kadar koyu olmalı?",
        a: "Kestane rengi ile koyu kahve arası bir ton hedeflenir, kenarlar biraz daha koyu olabilir. Siyaha dönen ve kömürleşen yüzey acı tat verir; o noktada renk artık karamelizasyon değil yanmadır.",
      },
      {
        q: "Benmari gerekiyor mu?",
        a: "Hayır. Benmari New York cheesecake'in tekniğidir ve nemli ortam yarattığı için üst yüzeyin karamelize olmasını engeller. San Sebastian cheesecake kuru ve yüksek sıcaklıkta, doğrudan fırın rafında pişer.",
      },
      {
        q: "Kaç saat dinlendirmek gerekiyor?",
        a: "Fırından çıkınca oda sıcaklığında 1-2 saat, ardından buzdolabında en az 4-6 saat. Yapı fırında değil soğurken oturur; erken kesilen kek dilim tutmaz ve dağılır.",
      },
      {
        q: "Hangi krem peynir ve krema kullanılmalı?",
        a: "Tam yağlı, yoğun kıvamlı krem peynir ve en az %35 yağlı krema kullanın. Light ürünler ve %30'un altındaki kremalar pişerken su bırakır; sonuç akışkan değil sulu bir merkez olur.",
      },
      {
        q: "Soğuk mu yoksa oda sıcaklığında mı servis edilir?",
        a: "Oda sıcaklığına yakın, yaklaşık 18-20 °C'de servis edilir. Buzdolabından çıkarıp 30-40 dakika beklettikten sonra kesin; soğukken yağ sertleşir ve akışkan doku fark edilmez.",
      },
      {
        q: "Yanına ne içilir?",
        a: "Sade espresso ya da Americano en iyi eşleşmelerdir; asidite kremanın ağırlığını keser. Tatlı ve kahveyi tek serviste birleştirmek isterseniz affogato da güçlü bir seçimdir.",
      },
      {
        q: "Dondurulabilir mi?",
        a: "Evet. Tamamen soğuduktan sonra dilimleyip her dilimi ayrı sararak 1 aya kadar dondurabilirsiniz. Çözdürmeyi buzdolabında bir gecede yapın; hızlı çözdürme su bırakmasına yol açar.",
      },
    ],
    recipe: {
      category: "Tatlı",
      cuisine: "Bask",
      name: "San Sebastian cheesecake (Bask usulü yanık cheesecake)",
      description:
        "Tabansız, 210 °C'de 30 dakikada pişen, üstü karamelize ortası akışkan klasik Bask cheesecake'i. 20-22 cm kelepçeli kalıp için.",
      prepMinutes: 20,
      yield: "20-22 cm kalıp, 10-12 dilim",
      ingredients: [
        "1000 g tam yağlı krem peynir, oda sıcaklığında",
        "380 g toz şeker",
        "6 adet L boy yumurta, oda sıcaklığında",
        "480 ml krema (en az %35 yağlı)",
        "25 g un, elenmiş",
        "3 g tuz",
        "1 çay kaşığı vanilya özütü (isteğe bağlı)",
      ],
      steps: [
        "Malzemeleri pişirmeden en az 1 saat önce buzdolabından çıkarın; hepsi oda sıcaklığında olsun.",
        "Fırını 210 °C'de, fansız alt-üst ısıtmada ısıtın.",
        "Kelepçeli kalıba iki kat fırın kâğıdını buruşturarak serin; kâğıt kalıp kenarını en az 5 cm aşsın.",
        "Krem peynir ile şekeri düşük devirde 2-3 dakika, pürüz kalmayana kadar karıştırın.",
        "Yumurtaları teker teker ekleyip her seferinde yalnızca karışana kadar çevirin.",
        "Kremayı ince şerit hâlinde dökerek karıştırın; tuzu ve isterseniz vanilyayı ekleyin.",
        "Elenmiş unu son anda ekleyip spatulayla 15-20 saniye çevirin.",
        "Karışımı ince telli süzgeçten geçirerek kalıba dökün, kalıbı tezgâha 2-3 kez hafifçe vurun.",
        "Orta rafta 25-35 dakika pişirin; üst koyu kahverengi olduğunda ve merkezdeki 3-4 cm hâlâ oynadığında çıkarın.",
        "Kalıpta oda sıcaklığında 1-2 saat dinlendirin, ortadan hafifçe çökmesi normaldir.",
        "Buzdolabında en az 4-6 saat, tercihen bir gece bekletin.",
        "Servisten 30-40 dakika önce çıkarın ve sıcak bıçakla dilimleyin.",
      ],
    },
    image: {
      src: "/rehber/san-sebastian-cheesecake.webp",
      alt: "Ahşap tahta üzerinde üstü koyu karamelize olmuş, dilimlenmiş San Sebastian cheesecake",
      width: 1600,
      height: 1067,
      credit: {
        name: "Luna Hu",
        url: "https://unsplash.com/@hyue",
        source: "Unsplash",
        photoUrl:
          "https://unsplash.com/photos/a-cheesecake-on-a-wooden-cutting-board-with-a-knife-Qv86wgHErmc",
      },
    },
    related: ["affogato-nedir", "espresso-cesitleri"],
  },
  // The signature cup (25 Ekim 2026 rewrite): the text lives in its own file;
  // the photograph is ours, cut from public/photos/affogato-cup.webp.
  {
    ...YENILEBILIR_BARDAK_GUIDE,
    image: {
      src: "/rehber/yenilebilir-kahve-fincani.webp",
      alt: "Yenilebilir waffle bardakta çikolata soslu gelato ve metal kaşık",
      width: 1200,
      height: 800,
    },
  },
  // 25 Ekim 2026: five guides written to the San Sebastian pattern, each in
  // its own file (docs/SEO.md §3 has the clusters and volumes).
  {
    ...TIRAMISU_GUIDE,
    image: {
      src: "/rehber/tiramisu-tarifi.webp",
      alt: "Koyu tabakta kakao ve çikolata talaşıyla kaplı, katları görünen bir dilim tiramisu",
      width: 1600,
      height: 1067,
      credit: {
        name: "Jay",
        url: "https://unsplash.com/@ja024",
        source: "Unsplash",
        photoUrl:
          "https://unsplash.com/photos/a-slice-of-tiramisu-cake-with-cocoa-and-chocolate-shavings-Rjc0kwgs1ps",
      },
    },
  },
  {
    ...COLD_BREW_GUIDE,
    image: {
      src: "/rehber/cold-brew-nedir.webp",
      alt: "Palmiye yaprağı gölgesi düşen masada buzlu bir bardak cold brew",
      width: 1600,
      height: 1067,
      credit: {
        name: "Blake Wisz",
        url: "https://unsplash.com/@blakewisz",
        source: "Unsplash",
        photoUrl:
          "https://unsplash.com/photos/selective-focus-photo-of-glass-of-brown-liquid-X6aY_j6JD_Y",
      },
    },
  },
  {
    ...FRAPPE_GUIDE,
    image: {
      src: "/rehber/frappe-nedir.webp",
      alt: "Ahşap masada krema ve karamel sosla tamamlanmış buzlu frappe",
      width: 1600,
      height: 1067,
      credit: {
        name: "Kari Shea",
        url: "https://unsplash.com/@karishea",
        source: "Unsplash",
        photoUrl:
          "https://unsplash.com/photos/brown-and-white-ice-cream-on-brown-wooden-table-1e5V69AQjgA",
      },
    },
  },
  {
    ...SPANISH_LATTE_GUIDE,
    image: {
      src: "/rehber/spanish-latte-nedir.webp",
      alt: "Uzun bardakta buzun üzerinde süte karışan espresso: buzlu bir latte",
      width: 1600,
      height: 1067,
      credit: {
        name: "Demi DeHerrera",
        url: "https://unsplash.com/@demidearest",
        source: "Unsplash",
        photoUrl:
          "https://unsplash.com/photos/glass-cup-filled-with-ice-latte-on-tabletop-L-sm1B4L1Ns",
      },
    },
  },
  {
    ...CHAI_LATTE_GUIDE,
    image: {
      src: "/rehber/chai-tea-latte.webp",
      alt: "Koyu zemin üzerinde metal kupada chai latte, yanında tarçın çubukları ve kakule",
      width: 1600,
      height: 1067,
      credit: {
        name: "Kamal Preet Kaur",
        url: "https://unsplash.com/@kamalpreetkaur",
        source: "Unsplash",
        photoUrl:
          "https://unsplash.com/photos/a-cup-of-coffee-sitting-on-top-of-a-table-hT_xR7_1YH8",
      },
    },
  },
];
