// L'Affogato — content data

export const BRAND = {
  heritage: "Italia, 1987",
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
  /** Public path to a real product photo (transparent PNG/WebP). */
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
 * Cafe menu — transcribed 1:1 from the L'Affogato printed menu (2026).
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
        name: "Strawberry Matcha",
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
    title: "Espresso Based",
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
      },
      {
        name: "Espresso",
        desc: "Tek shot, yoğun crema. Klasik İtalyan usulü.",
        price: "110₺",
        priceL: "140₺",
        hue: "espresso",
      },
      {
        name: "Americano",
        desc: "Espresso ve sıcak su; ince crema katmanı.",
        price: "165₺",
        priceL: "185₺",
        hue: "espresso",
      },
      {
        name: "Latte",
        desc: "Espresso üzerine buharlı süt ve ince köpük.",
        price: "195₺",
        priceL: "210₺",
        hue: "cream",
      },
      {
        name: "Flat White",
        desc: "Çift ristretto ve yoğun mikroköpük; sütü az, kahvesi baskın.",
        price: "190₺",
        priceL: "200₺",
        hue: "cream",
      },
      {
        name: "Mocha",
        desc: "Espresso, bitter çikolata sosu ve süt.",
        price: "245₺",
        priceL: "265₺",
        hue: "espresso",
      },
      {
        name: "Cappuccino",
        desc: "Espresso, buharlı süt ve bol köpük — eşit üç katman.",
        price: "195₺",
        priceL: "210₺",
        hue: "cream",
      },
      {
        name: "Esp. Macchiato",
        desc: "Espresso üzerine bir dokunuş süt köpüğü.",
        price: "115₺",
        hue: "espresso",
      },
      {
        name: "Spanish Latte",
        desc: "Yoğunlaştırılmış sütle hazırlanan tatlı latte.",
        price: "250₺",
        priceL: "270₺",
        hue: "caramel",
      },
      {
        name: "Cortado",
        desc: "Espresso ve eşit ölçüde ılık süt.",
        price: "200₺",
        hue: "caramel",
      },
      {
        name: "White Choc. Mocha",
        desc: "Beyaz çikolata sosu, espresso ve süt.",
        price: "245₺",
        priceL: "265₺",
        hue: "cream",
      },
      {
        name: "Caramel Latte",
        desc: "Karamel şurubu, espresso ve buharlı süt.",
        price: "245₺",
        priceL: "265₺",
        hue: "caramel",
      },
      {
        name: "Salted Caramel Latte",
        desc: "Tuzlu karamel sosu, espresso ve süt.",
        price: "245₺",
        priceL: "265₺",
        hue: "caramel",
      },
      {
        name: "Toffeenut Latte",
        desc: "Fındıklı toffee şurubu, espresso ve buharlı süt.",
        price: "250₺",
        priceL: "270₺",
        tags: ["nuts"],
        hue: "caramel",
      },
      {
        name: "Pumpkin Spice Latte",
        desc: "Balkabağı ve tarçın-zencefil baharatı, espresso, süt.",
        price: "250₺",
        priceL: "270₺",
        hue: "dawn",
      },
      {
        name: "Türk Kahvesi",
        desc: "Bol köpüklü, geleneksel usul Türk kahvesi.",
        price: "130₺",
        priceL: "150₺",
        hue: "espresso",
      },
      {
        name: "Filtre Kahve",
        desc: "Günün demlemesi. Origin için baristaya sorun.",
        price: "165₺",
        priceL: "185₺",
        hue: "espresso",
      },
    ],
  },
  "ice-coffee": {
    title: "Ice Coffee",
    sub: "Buzlu kahveler",
    italian: "Caffè freddo",
    note: "Buzlu kahvelerin tamamı M ve L boy hazırlanır.",
    items: [
      {
        name: "Chai Tea",
        desc: "Baharatlı chai demlemesi, buz üzerine.",
        price: "210₺",
        priceL: "225₺",
        tags: ["iced"],
        hue: "dawn",
      },
      {
        name: "Iced Americano",
        desc: "Espresso, soğuk su ve buz.",
        price: "165₺",
        priceL: "185₺",
        tags: ["iced"],
        hue: "espresso",
      },
      {
        name: "Iced Caffè Latte",
        desc: "Espresso, soğuk süt ve buz.",
        price: "195₺",
        priceL: "210₺",
        tags: ["iced"],
        hue: "cream",
      },
      {
        name: "Iced Caffè Mocha",
        desc: "Bitter çikolata sosu, espresso ve soğuk süt.",
        price: "245₺",
        priceL: "265₺",
        tags: ["iced"],
        hue: "espresso",
      },
      {
        name: "Iced White Ch. Mocha",
        desc: "Beyaz çikolata sosu, espresso ve soğuk süt.",
        price: "245₺",
        priceL: "265₺",
        tags: ["iced"],
        hue: "cream",
      },
      {
        name: "Iced Salted Caramel Latte",
        desc: "Tuzlu karamel, espresso, soğuk süt ve buz.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "caramel",
      },
      {
        name: "Iced Toffeenut Latte",
        desc: "Toffee-fındık şurubu, espresso ve soğuk süt.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced", "nuts"],
        hue: "caramel",
      },
      {
        name: "Iced Pumpkin Spice Latte",
        desc: "Balkabağı baharatı, espresso ve soğuk süt.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "dawn",
      },
      {
        name: "Iced Spanish Latte",
        desc: "Yoğunlaştırılmış süt, espresso ve buz.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "caramel",
      },
      {
        name: "Cold Brew",
        desc: "Uzun süre soğuk demlenmiş kahve; yumuşak ve düşük asitli.",
        price: "200₺",
        priceL: "220₺",
        tags: ["iced"],
        hue: "espresso",
      },
      {
        name: "Çıtır Latte",
        desc: "Karamelize çıtır katmanlı buzlu latte.",
        price: "250₺",
        tags: ["iced", "new"],
        hue: "caramel",
      },
    ],
  },
  cold: {
    title: "Cold Drinks",
    sub: "Soğuk içecekler",
    italian: "Bevande fredde",
    note: "Kahvesiz serinleticiler — limonata, soda ve günlük sürpriz karışım.",
    items: [
      {
        name: "Surprise Drink",
        desc: "Baristanın günlük sürpriz karışımı.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced", "new"],
        hue: "rose",
      },
      {
        name: "Cool Lime",
        desc: "Limon, nane ve soda ile ferahlatıcı buzlu içecek.",
        price: "200₺",
        priceL: "220₺",
        tags: ["iced"],
        hue: "pistachio",
      },
      {
        name: "L'Af Limon",
        desc: "Ev yapımı limonata.",
        price: "180₺",
        tags: ["iced"],
        hue: "gold",
      },
      { name: "Soda", desc: "Soğuk maden suyu.", price: "80₺", hue: "sky" },
      { name: "Su", desc: "0,5 lt içme suyu.", price: "60₺", hue: "stone" },
    ],
  },
  hot: {
    title: "Hot Drinks",
    sub: "Sıcak içecekler",
    italian: "Bevande calde",
    note: "Kahvesiz sıcaklar — çikolata, salep ve çay.",
    items: [
      {
        name: "Chai Tea Latte",
        desc: "Baharatlı chai ve buharlı süt.",
        price: "235₺",
        priceL: "250₺",
        hue: "dawn",
      },
      {
        name: "Hot Chocolate",
        desc: "Sıcak sütle çırpılmış bitter çikolata.",
        price: "230₺",
        priceL: "250₺",
        hue: "espresso",
      },
      {
        name: "White Hot Chocolate",
        desc: "Beyaz çikolata ve sıcak süt.",
        price: "245₺",
        priceL: "265₺",
        hue: "cream",
      },
      {
        name: "Caramel Hot Chocolate",
        desc: "Karamel soslu sıcak çikolata.",
        price: "245₺",
        priceL: "265₺",
        hue: "caramel",
      },
      {
        name: "Salep",
        desc: "Tarçınla servis edilen geleneksel salep.",
        price: "245₺",
        priceL: "265₺",
        hue: "cream",
      },
      {
        name: "Tea",
        desc: "Demlik çay.",
        price: "60₺",
        priceL: "90₺",
        hue: "gold",
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
      },
      {
        name: "Espresso Frappe",
        desc: "Espresso, süt ve buz; yoğun köpüklü.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "espresso",
      },
      {
        name: "Mocha Frappe",
        desc: "Çikolata soslu buzlu frappe.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "espresso",
      },
      {
        name: "Caramel Frappe",
        desc: "Karamel soslu buzlu frappe.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "caramel",
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
        name: "Blueberry",
        desc: "Yaban mersini ve sütle çırpılmış smoothie.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "bougainvillea",
      },
      {
        name: "Mango",
        desc: "Mango püresi ve süt.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "gold",
      },
      {
        name: "Apple",
        desc: "Yeşil elma smoothie.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "pistachio",
      },
      {
        name: "Protein Shake",
        desc: "Protein tozu, süt ve muz.",
        price: "270₺",
        tags: ["iced"],
        hue: "warm",
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
        name: "Strawberry",
        desc: "Çilek ve buzun frozen kıvamı.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "rose",
      },
      {
        name: "Raspberry",
        desc: "Ahududulu frozen.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "bougainvillea",
      },
      {
        name: "Passionfruit",
        desc: "Çarkıfelek meyveli frozen.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "gold",
      },
      {
        name: "Pineapple",
        desc: "Ananaslı frozen.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "gold",
      },
    ],
  },
  "ice-tea": {
    title: "Ice Tea",
    sub: "Buzlu çay",
    italian: "Tè freddo",
    note: "Buz ve taze meyve dilimiyle servis edilir.",
    items: [
      {
        name: "Lemon Tea",
        desc: "Limonlu buzlu çay.",
        price: "245₺",
        priceL: "265₺",
        tags: ["iced"],
        hue: "gold",
      },
      {
        name: "Peach Tea",
        desc: "Şeftalili buzlu çay.",
        price: "245₺",
        priceL: "265₺",
        tags: ["iced"],
        hue: "dawn",
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
        name: "Donostia (L'Af Special)",
        desc: "Evin özel San Sebastian dilimi.",
        price: "160₺",
        tags: ["signature"],
        hue: "caramel",
      },
      {
        name: "San Sebastian",
        desc: "Yüksek ateşte pişmiş, ortası akışkan cheesecake.",
        price: "290₺",
        hue: "caramel",
      },
      {
        name: "Blueberry San Sebastian",
        desc: "Yaban mersinli San Sebastian cheesecake.",
        price: "295₺",
        hue: "bougainvillea",
      },
      {
        name: "L'Af Mango",
        desc: "Mangolu evin özel pastası.",
        price: "270₺",
        hue: "gold",
      },
      {
        name: "L'Af Coffee",
        desc: "Kahveli evin özel pastası.",
        price: "290₺",
        hue: "espresso",
      },
      {
        name: "L'Af Antep Fıstığı",
        desc: "Antep fıstıklı evin özel pastası.",
        price: "300₺",
        tags: ["nuts"],
        hue: "pistachio",
      },
      {
        name: "Çilek Magnolia",
        desc: "Çilekli magnolia, bisküvi kırığıyla.",
        price: "240₺",
        hue: "rose",
      },
      {
        name: "Muz Magnolia",
        desc: "Muzlu magnolia, bisküvi kırığıyla.",
        price: "240₺",
        hue: "gold",
      },
      {
        name: "Lotus Magnolia",
        desc: "Lotus bisküvili magnolia.",
        price: "250₺",
        hue: "caramel",
      },
      {
        name: "Marlenka",
        desc: "Ballı katmanlı Marlenka dilimi.",
        price: "270₺",
        hue: "gold",
      },
      {
        name: "Klasik Spoonful",
        desc: "Kaşık kaşık kremalı klasik tatlı.",
        price: "220₺",
        hue: "cream",
      },
      {
        name: "Frambuazlı Cheesecake",
        desc: "Frambuaz soslu cheesecake.",
        price: "260₺",
        hue: "bougainvillea",
      },
      {
        name: "Limonlu Cheesecake",
        desc: "Limonlu cheesecake.",
        price: "260₺",
        hue: "gold",
      },
      {
        name: "Brownie",
        desc: "Yoğun çikolatalı brownie.",
        price: "280₺",
        hue: "espresso",
      },
      {
        name: "Cookie Aşkı (Dondurmalı)",
        desc: "Sıcak cookie üzerine bir top dondurma.",
        price: "290₺",
        tags: ["signature"],
        hue: "caramel",
      },
      {
        name: "Tiramisu",
        desc: "Mascarpone, kedidili ve espresso.",
        price: "280₺",
        hue: "espresso",
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
      },
      {
        name: "Rosbeef Sandviç",
        desc: "Rosbif, taze yeşillik ve sos.",
        price: "390₺",
        hue: "warm",
      },
      {
        name: "Hindi Fümeli Sandviç",
        desc: "Hindi füme, kaşar ve taze yeşillik.",
        price: "350₺",
        hue: "warm",
      },
      {
        name: "Crunchy Granola Bar (Kenya)",
        desc: "Çıtır granola bar.",
        price: "150₺",
        hue: "caramel",
      },
      {
        name: "Hindistan Cevizli Bar",
        desc: "Hindistan cevizli bar.",
        price: "90₺",
        hue: "cream",
      },
      {
        name: "Kakao Protein Bar",
        desc: "Kakaolu protein bar.",
        price: "90₺",
        hue: "espresso",
      },
      {
        name: "Koska Fındık",
        desc: "Fındıklı Koska bar.",
        price: "90₺",
        tags: ["nuts"],
        hue: "caramel",
      },
    ],
  },
  extras: {
    title: "Extras",
    sub: "Ekstralar",
    italian: "Aggiunte",
    note: "Her içeceğe eklenebilir.",
    items: [
      {
        name: "Syrup",
        desc: "Dilediğiniz içeceğe ilave aroma şurubu.",
        price: "50₺",
        hue: "stone",
      },
      {
        name: "Extra Shot",
        desc: "İçeceğinize ek espresso shot.",
        price: "50₺",
        hue: "espresso",
      },
      {
        name: "Alternatif Süt",
        desc: "Yulaf, badem veya laktozsuz süt seçeneği.",
        price: "25₺",
        hue: "cream",
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
  /** Selectable variants (size, grind, etc.). */
  variants?: ProductVariant[];
  /** Base price in minor units (kuruş) for precise client-side math. */
  priceMinor?: number;
  /** Compare-at price in minor units (kuruş). */
  compareAtPriceMinor?: number;
}

export const PRODUCTS: Product[] = [
  {
    name: "Sirena — Espresso Blend",
    tag: "Whole Bean · 250g",
    price: "320₺",
    desc: "Brezilya doğal + Etiyopya yıkanmış. Kakao, kuru incir, esmer şeker.",
    cat: "beans",
    img: "caramel",
  },
  {
    name: "Notturna — Filter Lot",
    tag: "Whole Bean · 200g",
    price: "380₺",
    desc: "Kenya AA Nyeri. Frenk üzümü, bergamot, parlak asidite.",
    cat: "beans",
    img: "dark",
  },
  {
    name: "Edible Cups — 6 Box",
    tag: "Waffle Vessels",
    price: "240₺",
    desc: "Çıtır waffle kupları, içi yenilebilir glaze. Mekan ritüelini eve taşı.",
    cat: "gift",
    img: "cream",
  },
  {
    name: "Affogato Kit — For Two",
    tag: "Gift Box",
    price: "780₺",
    desc: "200g Sirena, fior di latte gelato, iki edible kup, porselen kaşık.",
    cat: "gift",
    img: "cream",
    featured: true,
  },
  {
    name: "Uji Matcha — Ceremonial",
    tag: "Tin · 40g",
    price: "420₺",
    desc: "Japonya Uji bahçesi, ceremonial grade. Bambu chasen ile eşleştirilir.",
    cat: "pantry",
    img: "matcha",
  },
  {
    name: "Moka — Bialetti × L'Affogato",
    tag: "3-cup, brushed aluminium",
    price: "690₺",
    desc: "Özel L'Affogato amblemli moka pot.",
    cat: "gear",
    img: "dark",
  },
  {
    name: "Porcelain Cup Set",
    tag: "Espresso · Set of 2",
    price: "420₺",
    desc: "Bone china, L'Affogato cobogó desen, 60ml.",
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
    name: "Cotton Apron",
    tag: "Heavyweight canvas",
    price: "480₺",
    desc: "Deri boyun askısı, gravür L'Affogato amblemi.",
    cat: "merch",
    img: "dark",
  },
  {
    name: "Enamel Tumbler",
    tag: "350ml, double wall",
    price: "320₺",
    desc: "Vakum yalıtım, cortado boyu, dış benekli emaye.",
    cat: "merch",
    img: "cream",
  },
  {
    name: "Cantucci — Bronte Pistachio",
    tag: "Biscotti · 180g",
    price: "180₺",
    desc: "İki kez pişmiş, yavaş fırın. Vin Santo veya doppio ile.",
    cat: "pantry",
    img: "pistachio",
  },
];

export const PRESS = [
  {
    name: "Monocle",
    quote: "The most considered new espresso bar in İstanbul.",
  },
  { name: "Cereal", quote: "A small room that takes coffee as architecture." },
  {
    name: "Time Out İstanbul",
    quote: "The edible cup is the best 130₺ you can spend.",
  },
  {
    name: "Condé Nast Traveler",
    quote: "“But first, affogato” — a worthy detour.",
  },
];

export const STORY = {
  founder: {
    name: "Eda Mancuso",
    role: "Founder & Roaster",
    bio: "İtalyan baba, İstanbullu anne. 1987'de büyükbabasının açtığı L'Affogato barını üçüncü kuşak olarak devraldı. 2026'da markayı doğduğu şehre, İstanbul'a getirdi.",
  },
  heritage: [
    {
      y: "1987",
      t: "Bologna · 1987",
      d: "Giancarlo Mancuso ilk L'Affogato barını açar. Tek bar, tek ritüel, edible kup hâlâ ahşap kaşıkla servis ediliyor.",
    },
    {
      y: "1994",
      t: "Edible cup ilk kez piyasada",
      d: "Mancuso ailesi waffle kupa edible glaze kaplamasını patentler. Bugün hâlâ aynı reçete.",
    },
    {
      y: "2008",
      t: "Sicily — Bronte pistacchio anlaşması",
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
  name: "L'Affogato — Tuzla",
  short: "Tuzla · İstanbul",
  address: [
    "Postane Mah. Atatürk Cad. No: 28 İç Kapı No: 1",
    "Menemenci Cumhur’un yanı",
    "34940 Tuzla / İstanbul",
  ],
  hours: [
    ["Pazartesi — Perşembe", "10:00 — 23:00"],
    ["Cuma — Cumartesi", "10:00 — 24:00"],
    ["Pazar", "10:00 — 23:00"],
  ] as Array<[string, string]>,
  /** Fixed query used for the map embed and directions links. Kept separate
   *  from `address` so editing the displayed lines cannot break geocoding. */
  mapsQuery: "L'Affogato, 29 Ekim Cd. No:28, 34940 Tuzla, İstanbul",
  landmark: "Menemenci Cumhur’un yanı",
  phone: "+90 216 459 30 60",
  email: "info@nextgenlab.com.tr",
  parent: "L'Affogato Italia · Via Galliera 21, Bologna",
};
