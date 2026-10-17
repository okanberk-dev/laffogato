// L'Affogato - content data

import { hourToLabel, type KaraokeFacts } from "./karaoke-today";
import type { SceneKey } from "./scenes";

export const BRAND = {
  heritage: "Italia, 1897",
  imported: "Italia → İstanbul, 2026",
  tag: "Drink it. Eat the cup.",
  italian: "Caffè · Gelato · Dolci",
  signature: "But first, Affogato",
};

export interface MenuItem {
  name: string;
  desc: string;
  /** Display price. When a second size exists this is the M (medium) price. */
  price: string;
  /** Large-size price. Present only for items sold in two sizes. */
  priceL?: string;
  tags?: string[];
  hue: string;
  /**
   * Public path to a product photo in public/menu/. The three matcha photos
   * came with the August menu; the rest are representative stock photos
   * (opaque 900 px squares, sources in docs/MENU-PHOTOS.md), and the menu
   * says so next to them ("Görseller temsilidir").
   */
  image?: string;
}

export interface MenuCategory {
  title: string;
  sub: string;
  italian: string;
  note: string;
  items: MenuItem[];
}

/**
 * Cafe menu - transcribed 1:1 from the L'Affogato printed menu (2026).
 * Two-size items carry `price` (M) and `priceL` (L); single-size items
 * only carry `price`.
 */
export const MENU: Record<string, MenuCategory> = {
  matcha: {
    title: "Matcha Bar",
    sub: "Strawberry Aşkı",
    italian: "Il banco matcha",
    note: "Ceremonial grade matcha, siparişten sonra çırpılır. Strawberry Aşkı üçlüsü sezon boyunca menüde.",
    items: [
      {
        name: "Matcha Latte",
        desc: "Çırpılmış matcha, ipeksi süt ve buz.",
        price: "215₺",
        hue: "matcha",
        image: "/menu/matcha-latte.webp",
      },
      {
        name: "Çilekli Matcha",
        desc: "Taze çilek katmanı üzerine matcha ve soğuk süt.",
        price: "245₺",
        tags: ["signature", "new"],
        hue: "rose",
        image: "/menu/strawberry-matcha.webp",
      },
      {
        name: "Matcha Affogato",
        desc: "Buzlu matcha latte üzerine bir top dondurma ve matcha tozu.",
        price: "245₺",
        tags: ["signature"],
        hue: "matcha",
        image: "/menu/matcha-affogato.webp",
      },
    ],
  },
  espresso: {
    title: "Espresso",
    sub: "Dalla macchina",
    italian: "Bar İtalyani",
    note: "Tüm espresso bazlı içecekler M ve L boy servis edilir. Alternatif süt ve ekstra shot mevcuttur.",
    items: [
      {
        name: "L'Affogato",
        desc: "Bir top dondurma üzerine sıcak espresso. Evin imzası.",
        price: "280₺",
        tags: ["signature"],
        hue: "caramel",
        image: "/menu/affogato.webp",
      },
      {
        name: "Espresso",
        desc: "Tek shot, yoğun crema. Klasik İtalyan usulü.",
        price: "110₺",
        priceL: "140₺",
        hue: "espresso",
        image: "/menu/espresso.webp",
      },
      {
        name: "Americano",
        desc: "Espresso ve sıcak su; ince crema katmanı.",
        price: "165₺",
        priceL: "185₺",
        hue: "espresso",
        image: "/menu/americano.webp",
      },
      {
        name: "Latte",
        desc: "Espresso üzerine buharlı süt ve ince köpük.",
        price: "195₺",
        priceL: "210₺",
        hue: "cream",
        image: "/menu/caffe-latte.webp",
      },
      {
        name: "Flat White",
        desc: "Çift ristretto ve yoğun mikroköpük; sütü az, kahvesi baskın.",
        price: "190₺",
        priceL: "200₺",
        hue: "cream",
        image: "/menu/flat-white.webp",
      },
      {
        name: "Mocha",
        desc: "Espresso, bitter çikolata sosu ve süt.",
        price: "245₺",
        priceL: "265₺",
        hue: "espresso",
        image: "/menu/mocha.webp",
      },
      {
        name: "Cappuccino",
        desc: "Espresso, buharlı süt ve bol köpük - eşit üç katman.",
        price: "195₺",
        priceL: "210₺",
        hue: "cream",
        image: "/menu/cappuccino.webp",
      },
      {
        name: "Espresso Macchiato",
        desc: "Espresso üzerine bir dokunuş süt köpüğü.",
        price: "115₺",
        hue: "espresso",
        image: "/menu/espresso-macchiato.webp",
      },
      {
        name: "İspanyol Latte",
        desc: "Yoğunlaştırılmış sütle hazırlanan tatlı latte.",
        price: "250₺",
        priceL: "270₺",
        hue: "caramel",
        image: "/menu/spanish-latte.webp",
      },
      {
        name: "Cortado",
        desc: "Espresso ve eşit ölçüde ılık süt.",
        price: "200₺",
        hue: "caramel",
        image: "/menu/cortado.webp",
      },
      {
        name: "Beyaz Çikolatalı Mocha",
        desc: "Beyaz çikolata sosu, espresso ve süt.",
        price: "245₺",
        priceL: "265₺",
        hue: "cream",
        image: "/menu/white-chocolate-mocha.webp",
      },
      {
        name: "Karamel Latte",
        desc: "Karamel şurubu, espresso ve buharlı süt.",
        price: "245₺",
        priceL: "265₺",
        hue: "caramel",
        image: "/menu/caramel-latte.webp",
      },
      {
        name: "Tuzlu Karamel Latte",
        desc: "Tuzlu karamel sosu, espresso ve süt.",
        price: "245₺",
        priceL: "265₺",
        hue: "caramel",
        image: "/menu/salted-caramel-latte.webp",
      },
      {
        name: "Toffeenut Latte",
        desc: "Fındıklı toffee şurubu, espresso ve buharlı süt.",
        price: "250₺",
        priceL: "270₺",
        tags: ["nuts"],
        hue: "caramel",
        image: "/menu/toffee-nut-latte.webp",
      },
      {
        name: "Balkabağı Latte",
        desc: "Balkabağı ve tarçın-zencefil baharatı, espresso, süt.",
        price: "250₺",
        priceL: "270₺",
        hue: "dawn",
        image: "/menu/pumpkin-latte.webp",
      },
      {
        name: "Türk Kahvesi",
        desc: "Bol köpüklü, geleneksel usul Türk kahvesi.",
        price: "130₺",
        priceL: "150₺",
        hue: "espresso",
        image: "/menu/turkish-coffee.webp",
      },
      {
        name: "Filtre Kahve",
        desc: "Günün demlemesi. Origin için baristaya sorun.",
        price: "165₺",
        priceL: "185₺",
        hue: "espresso",
        image: "/menu/filter-coffee.webp",
      },
    ],
  },
  "ice-coffee": {
    title: "Soğuk Kahve",
    sub: "Buzlu kahveler",
    italian: "Caffè freddo",
    note: "Buzlu kahvelerin tamamı M ve L boy hazırlanır.",
    items: [
      {
        name: "Buzlu Chai",
        desc: "Baharatlı chai demlemesi, buz üzerine.",
        price: "210₺",
        priceL: "225₺",
        tags: ["iced"],
        hue: "dawn",
        image: "/menu/iced-chai.webp",
      },
      {
        name: "Buzlu Americano",
        desc: "Espresso, soğuk su ve buz.",
        price: "165₺",
        priceL: "185₺",
        tags: ["iced"],
        hue: "espresso",
        image: "/menu/iced-americano.webp",
      },
      {
        name: "Buzlu Caffè Latte",
        desc: "Espresso, soğuk süt ve buz.",
        price: "195₺",
        priceL: "210₺",
        tags: ["iced"],
        hue: "cream",
        image: "/menu/iced-caffe-latte.webp",
      },
      {
        name: "Buzlu Caffè Mocha",
        desc: "Bitter çikolata sosu, espresso ve soğuk süt.",
        price: "245₺",
        priceL: "265₺",
        tags: ["iced"],
        hue: "espresso",
        image: "/menu/iced-mocha.webp",
      },
      {
        name: "Buzlu Beyaz Çikolatalı Mocha",
        desc: "Beyaz çikolata sosu, espresso ve soğuk süt.",
        price: "245₺",
        priceL: "265₺",
        tags: ["iced"],
        hue: "cream",
        image: "/menu/iced-white-mocha.webp",
      },
      {
        name: "Buzlu Tuzlu Karamel Latte",
        desc: "Tuzlu karamel, espresso, soğuk süt ve buz.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "caramel",
        image: "/menu/iced-salted-caramel-latte.webp",
      },
      {
        name: "Buzlu Toffeenut Latte",
        desc: "Toffee-fındık şurubu, espresso ve soğuk süt.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced", "nuts"],
        hue: "caramel",
        image: "/menu/iced-toffee-nut-latte.webp",
      },
      {
        name: "Buzlu Balkabağı Latte",
        desc: "Balkabağı baharatı, espresso ve soğuk süt.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "dawn",
        image: "/menu/iced-pumpkin-latte.webp",
      },
      {
        name: "Buzlu İspanyol Latte",
        desc: "Yoğunlaştırılmış süt, espresso ve buz.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "caramel",
        image: "/menu/iced-spanish-latte.webp",
      },
      {
        name: "Cold Brew",
        desc: "Uzun süre soğuk demlenmiş kahve; yumuşak ve düşük asitli.",
        price: "200₺",
        priceL: "220₺",
        tags: ["iced"],
        hue: "espresso",
        image: "/menu/cold-brew.webp",
      },
      {
        name: "Çıtır Latte",
        desc: "Karamelize çıtır katmanlı buzlu latte.",
        price: "250₺",
        tags: ["iced", "new"],
        hue: "caramel",
        image: "/menu/crunchy-latte.webp",
      },
    ],
  },
  cold: {
    title: "Soğuk İçecekler",
    sub: "Soğuk içecekler",
    italian: "Bevande fredde",
    note: "Kahvesiz serinleticiler - limonata, soda ve günlük sürpriz karışım.",
    items: [
      {
        name: "Sürpriz İçecek",
        desc: "Baristanın günlük sürpriz karışımı.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced", "new"],
        hue: "rose",
        image: "/menu/surprise-drink.webp",
      },
      {
        name: "Cool Lime",
        desc: "Limon, nane ve soda ile ferahlatıcı buzlu içecek.",
        price: "200₺",
        priceL: "220₺",
        tags: ["iced"],
        hue: "pistachio",
        image: "/menu/cool-lime.webp",
      },
      {
        name: "L'Af Limon",
        desc: "Ev yapımı limonata.",
        price: "180₺",
        tags: ["iced"],
        hue: "gold",
        image: "/menu/lemonade.webp",
      },
      {
        name: "Soda",
        desc: "Soğuk maden suyu.",
        price: "80₺",
        hue: "sky",
        image: "/menu/soda.webp",
      },
      {
        name: "Su",
        desc: "0,5 lt içme suyu.",
        price: "60₺",
        hue: "stone",
        image: "/menu/water.webp",
      },
    ],
  },
  hot: {
    title: "Sıcak İçecekler",
    sub: "Sıcak içecekler",
    italian: "Bevande calde",
    note: "Kahvesiz sıcaklar - çikolata, salep ve çay.",
    items: [
      {
        name: "Chai Latte",
        desc: "Baharatlı chai ve buharlı süt.",
        price: "235₺",
        priceL: "250₺",
        hue: "dawn",
        image: "/menu/chai-latte.webp",
      },
      {
        name: "Sıcak Çikolata",
        desc: "Sıcak sütle çırpılmış bitter çikolata.",
        price: "230₺",
        priceL: "250₺",
        hue: "espresso",
        image: "/menu/hot-chocolate.webp",
      },
      {
        name: "Beyaz Sıcak Çikolata",
        desc: "Beyaz çikolata ve sıcak süt.",
        price: "245₺",
        priceL: "265₺",
        hue: "cream",
        image: "/menu/white-hot-chocolate.webp",
      },
      {
        name: "Karamelli Sıcak Çikolata",
        desc: "Karamel soslu sıcak çikolata.",
        price: "245₺",
        priceL: "265₺",
        hue: "caramel",
        image: "/menu/caramel-hot-chocolate.webp",
      },
      {
        name: "Salep",
        desc: "Tarçınla servis edilen geleneksel salep.",
        price: "245₺",
        priceL: "265₺",
        hue: "cream",
      },
      {
        name: "Çay",
        desc: "Demlik çay.",
        price: "60₺",
        priceL: "90₺",
        hue: "gold",
        image: "/menu/turkish-tea.webp",
      },
    ],
  },
  frappe: {
    title: "Frappe",
    sub: "Buzla çırpılmış",
    italian: "Frappè",
    note: "Tamamı buzla çırpılır, yoğun köpüklü servis edilir.",
    items: [
      {
        name: "Frappe",
        desc: "Buzla çırpılmış klasik frappe.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "caramel",
        image: "/menu/frappe.webp",
      },
      {
        name: "Espresso Frappe",
        desc: "Espresso, süt ve buz; yoğun köpüklü.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "espresso",
        image: "/menu/espresso-frappe.webp",
      },
      {
        name: "Mocha Frappe",
        desc: "Çikolata soslu buzlu frappe.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "espresso",
        image: "/menu/mocha-frappe.webp",
      },
      {
        name: "Karamel Frappe",
        desc: "Karamel soslu buzlu frappe.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "caramel",
        image: "/menu/caramel-frappe.webp",
      },
    ],
  },
  smoothie: {
    title: "Smoothie",
    sub: "Meyve & süt",
    italian: "Frullati",
    note: "Taze meyve ve sütle çırpılır. Alternatif süt talep edilebilir.",
    items: [
      {
        name: "Yaban Mersini",
        desc: "Yaban mersini ve sütle çırpılmış smoothie.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "bougainvillea",
        image: "/menu/blueberry-smoothie.webp",
      },
      {
        name: "Mango",
        desc: "Mango püresi ve süt.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "gold",
        image: "/menu/mango-smoothie.webp",
      },
      {
        name: "Elma",
        desc: "Yeşil elma smoothie.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "pistachio",
        image: "/menu/apple-smoothie.webp",
      },
      {
        name: "Protein Shake",
        desc: "Protein tozu, süt ve muz.",
        price: "270₺",
        tags: ["iced"],
        hue: "warm",
        image: "/menu/protein-shake.webp",
      },
    ],
  },
  frozen: {
    title: "Frozen",
    sub: "Meyveli frozen",
    italian: "Granite",
    note: "Meyve püresi ve buzla hazırlanan frozen serisi.",
    items: [
      {
        name: "Çilek",
        desc: "Çilek ve buzun frozen kıvamı.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "rose",
        image: "/menu/strawberry-frozen.webp",
      },
      {
        name: "Frambuaz",
        desc: "Ahududulu frozen.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "bougainvillea",
        image: "/menu/raspberry-frozen.webp",
      },
      {
        name: "Çarkıfelek",
        desc: "Çarkıfelek meyveli frozen.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "gold",
      },
      {
        name: "Ananas",
        desc: "Ananaslı frozen.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "gold",
      },
    ],
  },
  "ice-tea": {
    title: "Soğuk Çay",
    sub: "Buzlu çay",
    italian: "Tè freddo",
    note: "Buz ve taze meyve dilimiyle servis edilir.",
    items: [
      {
        name: "Limonlu Soğuk Çay",
        desc: "Limonlu buzlu çay.",
        price: "245₺",
        priceL: "265₺",
        tags: ["iced"],
        hue: "gold",
        image: "/menu/lemon-iced-tea.webp",
      },
      {
        name: "Şeftalili Soğuk Çay",
        desc: "Şeftalili buzlu çay.",
        price: "245₺",
        priceL: "265₺",
        tags: ["iced"],
        hue: "dawn",
        image: "/menu/peach-iced-tea.webp",
      },
    ],
  },
  dessert: {
    title: "Tatlılar",
    sub: "Vitrinden",
    italian: "Dolci della casa",
    note: "Günlük hazırlanır; vitrindeki çeşitler mevsime göre değişebilir.",
    items: [
      {
        name: "Donostia (L'Af Özel)",
        desc: "Evin özel San Sebastian dilimi.",
        price: "160₺",
        tags: ["signature"],
        hue: "caramel",
        image: "/menu/donostia-cheesecake.webp",
      },
      {
        name: "San Sebastian",
        desc: "Yüksek ateşte pişmiş, ortası akışkan cheesecake.",
        price: "290₺",
        hue: "caramel",
        image: "/menu/san-sebastian-cheesecake.webp",
      },
      {
        name: "Yaban Mersinli San Sebastian",
        desc: "Yaban mersinli San Sebastian cheesecake.",
        price: "295₺",
        hue: "bougainvillea",
        image: "/menu/blueberry-san-sebastian.webp",
      },
      {
        name: "L'Af Mango",
        desc: "Mangolu evin özel pastası.",
        price: "270₺",
        hue: "gold",
        image: "/menu/mango-cake.webp",
      },
      {
        name: "L'Af Kahve",
        desc: "Kahveli evin özel pastası.",
        price: "290₺",
        hue: "espresso",
        image: "/menu/coffee-cake.webp",
      },
      {
        name: "L'Af Antep Fıstığı",
        desc: "Antep fıstıklı evin özel pastası.",
        price: "300₺",
        tags: ["nuts"],
        hue: "pistachio",
        image: "/menu/pistachio-cake.webp",
      },
      {
        name: "Çilek Magnolia",
        desc: "Çilekli magnolia, bisküvi kırığıyla.",
        price: "240₺",
        hue: "rose",
        image: "/menu/strawberry-magnolia.webp",
      },
      {
        name: "Muz Magnolia",
        desc: "Muzlu magnolia, bisküvi kırığıyla.",
        price: "240₺",
        hue: "gold",
        image: "/menu/banana-magnolia.webp",
      },
      {
        name: "Lotus Magnolia",
        desc: "Lotus bisküvili magnolia.",
        price: "250₺",
        hue: "caramel",
        image: "/menu/lotus-magnolia.webp",
      },
      {
        name: "Marlenka",
        desc: "Ballı katmanlı Marlenka dilimi.",
        price: "270₺",
        hue: "gold",
        image: "/menu/marlenka-honey-cake.webp",
      },
      {
        name: "Klasik Spoonful",
        desc: "Kaşık kaşık kremalı klasik tatlı.",
        price: "220₺",
        hue: "cream",
        image: "/menu/classic-spoonful.webp",
      },
      {
        name: "Frambuazlı Cheesecake",
        desc: "Frambuaz soslu cheesecake.",
        price: "260₺",
        hue: "bougainvillea",
        image: "/menu/raspberry-cheesecake.webp",
      },
      {
        name: "Limonlu Cheesecake",
        desc: "Limonlu cheesecake.",
        price: "260₺",
        hue: "gold",
        image: "/menu/lemon-cheesecake.webp",
      },
      {
        name: "Brownie",
        desc: "Yoğun çikolatalı brownie.",
        price: "280₺",
        hue: "espresso",
        image: "/menu/brownie.webp",
      },
      {
        name: "Cookie Aşkı (Dondurmalı)",
        desc: "Sıcak cookie üzerine bir top dondurma.",
        price: "290₺",
        tags: ["signature"],
        hue: "caramel",
        image: "/menu/cookie-ice-cream.webp",
      },
      {
        name: "Tiramisu",
        desc: "Mascarpone, kedidili ve espresso.",
        price: "280₺",
        hue: "espresso",
        image: "/menu/tiramisu.webp",
      },
    ],
  },
  snack: {
    title: "Atıştırmalıklar",
    sub: "Yanında",
    italian: "Spuntini",
    note: "Sandviçler günlük hazırlanır; barlar paketli olarak sunulur.",
    items: [
      {
        name: "Karabuğday Simit",
        desc: "Karabuğday unlu simit.",
        price: "90₺",
        hue: "warm",
        image: "/menu/simit.webp",
      },
      {
        name: "Rosbeef Sandviç",
        desc: "Rosbif, taze yeşillik ve sos.",
        price: "390₺",
        hue: "warm",
        image: "/menu/roast-beef-sandwich.webp",
      },
      {
        name: "Hindi Fümeli Sandviç",
        desc: "Hindi füme, kaşar ve taze yeşillik.",
        price: "350₺",
        hue: "warm",
        image: "/menu/smoked-turkey-sandwich.webp",
      },
      {
        name: "Çıtır Granola Bar (Kenya)",
        desc: "Çıtır granola bar.",
        price: "150₺",
        hue: "caramel",
        image: "/menu/granola-bar.webp",
      },
      {
        name: "Hindistan Cevizli Bar",
        desc: "Hindistan cevizli bar.",
        price: "90₺",
        hue: "cream",
        image: "/menu/coconut-bar.webp",
      },
      {
        name: "Kakao Protein Bar",
        desc: "Kakaolu protein bar.",
        price: "90₺",
        hue: "espresso",
        image: "/menu/cocoa-protein-bar.webp",
      },
      {
        name: "Koska Fındık",
        desc: "Fındıklı Koska bar.",
        price: "90₺",
        tags: ["nuts"],
        hue: "caramel",
        image: "/menu/hazelnuts.webp",
      },
    ],
  },
  extras: {
    title: "Ekstralar",
    sub: "Ekstralar",
    italian: "Aggiunte",
    note: "Her içeceğe eklenebilir.",
    items: [
      {
        name: "Şurup",
        desc: "Dilediğiniz içeceğe ilave aroma şurubu.",
        price: "50₺",
        hue: "stone",
      },
      {
        name: "Ekstra Shot",
        desc: "İçeceğinize ek espresso shot.",
        price: "50₺",
        hue: "espresso",
        image: "/menu/extra-shot.webp",
      },
      {
        name: "Alternatif Süt",
        desc: "Yulaf, badem veya laktozsuz süt seçeneği.",
        price: "25₺",
        hue: "cream",
        image: "/menu/alternative-milk.webp",
        // Almond is one of the three: the warning has to reach whoever picks it.
        tags: ["nuts"],
      },
    ],
  },
};

/** Customer-facing product variant (a subset of AdminProductVariant). */
export interface ProductVariant {
  id: string;
  name: string;
  /** Price delta on top of the base price, in major units (₺). Can be negative. */
  priceDelta: number;
  /** Remaining stock for this variant; undefined = not tracked. */
  stock?: number;
  isActive?: boolean;
}

export interface Product {
  /** Stable AdminProduct id (e.g. "prd-001"). Optional because seed data
      in this file isn't persisted with an id; populated by listShopProducts. */
  id?: string;
  name: string;
  tag: string;
  price: string;
  /** Optional original/was price for striked-out display. */
  compareAtPrice?: string;
  desc: string;
  cat: string;
  img: string;
  featured?: boolean;
  isNew?: boolean;
  /** Allergen tags in the menu's vocabulary ("nuts"), seeded onto the product
      row. The app draws its nut warning from `tags` and nothing else, so a
      product that carries an allergen says so here. */
  tags?: string[];
  /** The product's own KDV rate (whole %), seeded onto the product row when
      its category's default would be wrong: the edible cup box is food (1%)
      though it sits under "gift" (20%). src/lib/utils/kdv.ts. */
  taxRatePct?: number;

  // ── Rich fields (populated by listShopProducts; absent on static seed) ──
  /** URL-safe slug for the product detail page (/magaza/urun/<slug>). */
  slug?: string;
  /** Stock keeping unit. */
  sku?: string;
  /** External image gallery URLs. The card/PDP uses these when present. */
  images?: string[];
  /** Remaining stock. 0 = out of stock; undefined = not tracked. */
  stock?: number;
  /** Low-stock threshold for the "son N adet" urgency badge. */
  lowStockThreshold?: number;
  /** Approximate shipping weight (grams). */
  weightGrams?: number;
  /** The maker's name as the panel holds it ("Sirena"); '' or absent = none. */
  brand?: string;
  /** Tasting notes from the panel ("Kakao", "Kuru incir"); absent = none. */
  notes?: string[];
  /** Selectable variants (size, grind, etc.). */
  variants?: ProductVariant[];
  /** Base price in minor units (kuruş) for precise client-side math. */
  priceMinor?: number;
  /** Compare-at price in minor units (kuruş). */
  compareAtPriceMinor?: number;
  /** Admin-authored meta title for the PDP; falls back to the product name. */
  seoTitle?: string;
  /** Admin-authored meta description; falls back to the product blurb. */
  seoDescription?: string;
}

export const PRODUCTS: Product[] = [
  {
    name: "Sirena - Espresso Harmanı",
    tag: "Çekirdek · 250 g",
    price: "320₺",
    desc: "Brezilya doğal + Etiyopya yıkanmış. Kakao, kuru incir, esmer şeker.",
    cat: "beans",
    img: "caramel",
  },
  {
    name: "Notturna - Filtre Lotu",
    tag: "Çekirdek · 200 g",
    price: "380₺",
    desc: "Kenya AA Nyeri. Frenk üzümü, bergamot, parlak asidite.",
    cat: "beans",
    img: "dark",
  },
  {
    name: "Yenilebilir Kup - 6'lı Kutu",
    tag: "Waffle kupları",
    price: "240₺",
    desc: "Çıtır waffle kupları, içi yenilebilir glaze. Mekan ritüelini eve taşı.",
    cat: "gift",
    img: "cream",
    // Bakery goods in a box (GTİP 19.05): list (I), 1%, not the gift 20%.
    taxRatePct: 1,
  },
  {
    name: "Affogato Seti - İki Kişilik",
    tag: "Hediye kutusu",
    price: "780₺",
    desc: "200 g Sirena, fior di latte gelato, iki yenilebilir kup, porselen kaşık.",
    cat: "gift",
    img: "cream",
    featured: true,
  },
  {
    name: "Uji Matcha - Seremoni Sınıfı",
    tag: "Teneke kutu · 40 g",
    price: "420₺",
    desc: "Japonya Uji bahçesi, seremoni sınıfı. Bambu chasen ile eşleştirilir.",
    cat: "pantry",
    img: "matcha",
  },
  {
    name: "Moka - Bialetti × L'Affogato",
    tag: "3 fincanlık, fırçalanmış alüminyum",
    price: "690₺",
    desc: "Özel L'Affogato amblemli moka pot.",
    cat: "gear",
    img: "dark",
  },
  {
    name: "Porselen Fincan Seti",
    tag: "Espresso · 2'li set",
    price: "420₺",
    desc: "Kemik porseleni, L'Affogato cobogó desen, 60 ml.",
    cat: "gear",
    img: "cream",
  },
  {
    name: "Bambu Chasen",
    tag: "Matcha çırpıcı",
    price: "320₺",
    desc: "80 dişli geleneksel bambu chasen, Nara'dan.",
    cat: "gear",
    img: "matcha",
  },
  {
    name: "Pamuk Önlük",
    tag: "Kalın kanvas",
    price: "480₺",
    desc: "Deri boyun askısı, gravür L'Affogato amblemi.",
    cat: "merch",
    img: "dark",
  },
  {
    name: "Emaye Bardak",
    tag: "350 ml, çift cidarlı",
    price: "320₺",
    desc: "Vakum yalıtım, cortado boyu, dış benekli emaye.",
    cat: "merch",
    img: "cream",
  },
  {
    name: "Cantucci - Bronte Pistachio",
    tag: "Biscotti · 180 g",
    price: "180₺",
    desc: "İki kez pişmiş, yavaş fırın. Vin Santo veya doppio ile.",
    cat: "pantry",
    img: "pistachio",
    tags: ["nuts"],
  },
];

/* ──────────────────────────────────────────────────────────────
   Home hero slider
   ────────────────────────────────────────────────────────────── */

/** What a slide's two buttons do. `PageHome` owns the handler map, so a slide
    can never point at a screen that does not exist. */
export type HomeSlideAction =
  | "menu"
  | "seasonMenu"
  | "signature"
  | "story"
  | "visit"
  | "karaoke";

/**
 * One of a slide's buttons: a known action code, or a link the panel has
 * already checked (a same-site path or an https URL; home-hero-core.ts
 * `safeSlideHref`). Never both.
 */
export type HomeSlideButton =
  | { label: string; action: HomeSlideAction; href?: undefined }
  | { label: string; href: string; action?: undefined };

export interface HomeSlide {
  /** The panel row's id; the bundled slides below have none. */
  id?: string;
  /** Small line above the headline - the product's qualifier, not a label. */
  kicker: string;
  /** Two lines of display type; the array IS the line break. A panel slide
      may leave the second line empty. */
  title: [string, string];
  text: string;
  /** A panel slide may have one button or none; the bundled ones have two. */
  primary?: HomeSlideButton;
  secondary?: HomeSlideButton;
  /** A cut-out product photograph, standing on its own light. */
  photo: string;
  alt: string;
  /**
   * Whose light the drink stands in - the app's scene family for it
   * (DESIGN-GLASS §6.2): a strawberry matcha glows pink, a matcha green;
   * the karaoke room's microphone stands in the room's berry light.
   */
  scene: SceneKey;
}

/**
 * The home hero's bundled slides.
 *
 * Since 17 Oct 2026 the hero is edited at /admin/anasayfa-hero
 * (`home_hero_slides`). These four are what the site shows while the panel
 * has no live slide (an empty table, or the database out of reach), and what
 * the panel's "Varsayılanları içe aktar" copies in as editable rows.
 *
 * The app's product stage (lafmobil DESIGN-GLASS §4.4, §13): the drink cut
 * out and standing in a pastel halo of its own colour on porcelain, the name
 * large beside it, the other drinks as glass thumbnails under the copy.
 *
 * `-cut` rather than the plain files the menu cards use: those are square
 * 1024px canvases whose cup occupies a portrait 0.62 of the frame; the
 * trimmed variants are the cup and nothing else, so the stage can size the
 * drink by its height. Generated with `sharp().trim()`; the untrimmed
 * originals stay for the menu cards, which rely on the square canvas to line
 * their drinks up with each other.
 *
 * Every button goes where its label says: slide one's two labels used to be
 * swapped, and slide two's "Ürünü gör" opened the espresso page for a drink
 * that lives in the matcha bar.
 */
export const HOME_SLIDES: HomeSlide[] = [
  {
    kicker: "Sezon · Strawberry Aşkı",
    title: ["Çilekli", "Matcha Latte"],
    text: "Taze çilek katmanının üzerine çırpılmış Uji matcha ve soğuk süt. Seremoni sınıfı matcha siparişten sonra çırpılır; çilek ezmesi her sabah barda hazırlanır.",
    primary: { label: "Sezonu gör", action: "seasonMenu" },
    secondary: { label: "Tüm menü", action: "menu" },
    photo: "/menu/strawberry-matcha-cut.webp",
    alt: "Çilekli matcha latte, buzlu bardakta",
    scene: "strawberry",
  },
  {
    kicker: "İmza ürün",
    title: ["Matcha", "Affogato"],
    text: "Fior di latte gelatonun üzerine çırpılmış matcha, masanızda dökülür. 1994'te patentlenen ritüelin matcha hâli - içilir, sonra kupası yenir.",
    primary: { label: "Matcha barını gör", action: "seasonMenu" },
    secondary: { label: "Hikayemiz", action: "story" },
    photo: "/menu/matcha-affogato-cut.webp",
    alt: "Matcha affogato, üzerinde gelato topu",
    scene: "pistachio",
  },
  {
    kicker: "Her gün barda",
    title: ["Buzlu", "Matcha Latte"],
    text: "Çırpılmış matcha, ipeksi süt ve buz. Menünün en sade duranı, en çok içileni - köşkün terasında günün her saati.",
    primary: { label: "Menüye göz at", action: "menu" },
    secondary: { label: "Ziyaret bilgileri", action: "visit" },
    photo: "/menu/matcha-latte-cut.webp",
    alt: "Buzlu matcha latte, uzun bardakta",
    scene: "matcha",
  },
  /*
   * The one slide that is not a drink (operator's call, 17 Eki 2026: the home
   * page highlights the karaoke room). Its picture is the microphone alone,
   * cut out of the room drawing at the drinks' 581 x 942 (the edible-cup mic
   * with L'Af on its sleeve). The room's size and closing hour are the
   * panel's: `{kapasite}` and `{kapanis}` are filled by `slideText`.
   */
  {
    kicker: "Akşamları üst katta",
    title: ["Sahne", "senin"],
    text: "Gündüz kahve, akşam şarkı. Üst kattaki oda {kapasite} kişiye kadar, gece {kapanis} kadar senin.",
    primary: { label: "Saatini seç", action: "karaoke" },
    secondary: { label: "Ziyaret bilgileri", action: "visit" },
    photo: "/illustrations/karaoke-mic-cut.webp",
    alt: "Kupa biçiminde çizilmiş karaoke mikrofonu",
    scene: "berry",
  },
];

/**
 * A slide's text with the karaoke room's facts filled in. Without them (a
 * page that did not load the settings) a sentence that would need one is
 * left out rather than printed with a guessed number.
 */
export function slideText(text: string, karaoke?: KaraokeFacts): string {
  const token = /\{(kapasite|kapanis)\}/;
  if (!token.test(text)) return text;
  if (!karaoke) {
    return (text.match(/[^.]+(?:\.|$)/g) ?? [text])
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence && !token.test(sentence))
      .join(" ");
  }
  return text
    .replaceAll("{kapasite}", String(karaoke.capacity))
    .replaceAll("{kapanis}", hourToLabel(karaoke.closeHour));
}

/**
 * Press quotes: only ones a publication actually gave, entered in /admin/basin
 * with their source. The four this array used to hold (Monocle, Cereal, Time
 * Out İstanbul, Condé Nast Traveler) were mock-up copy from the first design
 * implementation, attributed to real publications - they are switched off in
 * the database (20260923141000_retire_placeholder_press.sql) and no longer
 * seeded, and an empty list hides the section rather than drawing a heading
 * over nothing.
 */
export const PRESS: { name: string; quote: string }[] = [];

export const STORY = {
  founder: {
    name: "Eda Mancuso",
    role: "Founder & Roaster",
    bio: "İtalyan baba, İstanbullu anne. 1897'de büyük dedesinin açtığı L'Affogato barını dördüncü kuşak olarak devraldı. 2026'da markayı doğduğu şehre, İstanbul'a getirdi.",
  },
  heritage: [
    {
      y: "1897",
      t: "Bologna · 1897",
      d: "Giancarlo Mancuso ilk L'Affogato barını açar. Tek bar, tek ritüel, yenilebilir kup hâlâ ahşap kaşıkla servis ediliyor.",
    },
    {
      y: "1994",
      t: "Edible cup ilk kez piyasada",
      d: "Mancuso ailesi waffle kupa edible glaze kaplamasını patentler. Bugün hâlâ aynı reçete.",
    },
    {
      y: "2008",
      t: "Sicily - Bronte pistacchio anlaşması",
      d: "Üç aile çiftliği ile doğrudan tedarik. Bugün hâlâ aynı çiftlikler.",
    },
    {
      y: "2026",
      t: "İstanbul · Tuzla",
      d: "Eda, marka teamül haklarıyla ilk yurt dışı şubeyi açar. İtalya dışındaki tek L'Affogato.",
    },
  ],
};

export const LOCATION = {
  name: "L'Affogato - Tuzla",
  short: "Tuzla · İstanbul",
  /** Display lines. The landmark is directions, not address - it lives on
      `landmark` below and on /ziyaret's own directions block. */
  address: [
    "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1",
    "34940 Tuzla / İstanbul",
  ],
  hours: [["Her gün", "09:00 - 02:00"]] as Array<[string, string]>,
  /**
   * Karaoke room on the upper floor of the köşk.
   *
   * Worth stating on the site as well as in the app: the 09:00-02:00 window is
   * an evening business as much as a coffee one, and the karaoke room is the
   * reason to come after dinner rather than before it.
   */
  karaoke: {
    available: true,
    title: "Karaoke odası",
    body:
      "Köşkün üst katında özel karaoke odası. Gece 02:00'e kadar açığız; " +
      "odayı karaoke sayfasından ayırtabilirsin.",
  },
  /** Fixed query used for the map embed and directions links. Kept separate
   *  from `address` so editing the displayed lines cannot break geocoding. */
  mapsQuery: "L'Affogato, Atatürk Cad. No: 28, 34940 Tuzla, İstanbul",
  landmark: "Menemenci Cumhur’un yanı",
  phone: "+90 536 429 09 19",
  email: "info@nextgenlab.com.tr",
  parent: "L'Affogato Italia · Via Galliera 21, Bologna",
};
