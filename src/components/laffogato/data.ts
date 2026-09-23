// L'Affogato - content data

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
        desc: "Espresso, buharlı süt ve bol köpük - eşit üç katman.",
        price: "195₺",
        priceL: "210₺",
        hue: "cream",
      },
      {
        name: "Espresso Macchiato",
        desc: "Espresso üzerine bir dokunuş süt köpüğü.",
        price: "115₺",
        hue: "espresso",
      },
      {
        name: "İspanyol Latte",
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
        name: "Beyaz Çikolatalı Mocha",
        desc: "Beyaz çikolata sosu, espresso ve süt.",
        price: "245₺",
        priceL: "265₺",
        hue: "cream",
      },
      {
        name: "Karamel Latte",
        desc: "Karamel şurubu, espresso ve buharlı süt.",
        price: "245₺",
        priceL: "265₺",
        hue: "caramel",
      },
      {
        name: "Tuzlu Karamel Latte",
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
        name: "Balkabağı Latte",
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
      },
      {
        name: "Buzlu Americano",
        desc: "Espresso, soğuk su ve buz.",
        price: "165₺",
        priceL: "185₺",
        tags: ["iced"],
        hue: "espresso",
      },
      {
        name: "Buzlu Caffè Latte",
        desc: "Espresso, soğuk süt ve buz.",
        price: "195₺",
        priceL: "210₺",
        tags: ["iced"],
        hue: "cream",
      },
      {
        name: "Buzlu Caffè Mocha",
        desc: "Bitter çikolata sosu, espresso ve soğuk süt.",
        price: "245₺",
        priceL: "265₺",
        tags: ["iced"],
        hue: "espresso",
      },
      {
        name: "Buzlu Beyaz Çikolatalı Mocha",
        desc: "Beyaz çikolata sosu, espresso ve soğuk süt.",
        price: "245₺",
        priceL: "265₺",
        tags: ["iced"],
        hue: "cream",
      },
      {
        name: "Buzlu Tuzlu Karamel Latte",
        desc: "Tuzlu karamel, espresso, soğuk süt ve buz.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "caramel",
      },
      {
        name: "Buzlu Toffeenut Latte",
        desc: "Toffee-fındık şurubu, espresso ve soğuk süt.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced", "nuts"],
        hue: "caramel",
      },
      {
        name: "Buzlu Balkabağı Latte",
        desc: "Balkabağı baharatı, espresso ve soğuk süt.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "dawn",
      },
      {
        name: "Buzlu İspanyol Latte",
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
      },
      {
        name: "Sıcak Çikolata",
        desc: "Sıcak sütle çırpılmış bitter çikolata.",
        price: "230₺",
        priceL: "250₺",
        hue: "espresso",
      },
      {
        name: "Beyaz Sıcak Çikolata",
        desc: "Beyaz çikolata ve sıcak süt.",
        price: "245₺",
        priceL: "265₺",
        hue: "cream",
      },
      {
        name: "Karamelli Sıcak Çikolata",
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
        name: "Çay",
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
        name: "Karamel Frappe",
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
        name: "Yaban Mersini",
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
        name: "Elma",
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
        name: "Çilek",
        desc: "Çilek ve buzun frozen kıvamı.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "rose",
      },
      {
        name: "Frambuaz",
        desc: "Ahududulu frozen.",
        price: "250₺",
        priceL: "270₺",
        tags: ["iced"],
        hue: "bougainvillea",
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
      },
      {
        name: "Şeftalili Soğuk Çay",
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
        name: "Donostia (L'Af Özel)",
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
        name: "Yaban Mersinli San Sebastian",
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
        name: "L'Af Kahve",
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
        name: "Çıtır Granola Bar (Kenya)",
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
      },
      {
        name: "Alternatif Süt",
        desc: "Yulaf, badem veya laktozsuz süt seçeneği.",
        price: "25₺",
        hue: "cream",
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

export interface HomeSlide {
  /** Small line above the headline - the product's qualifier, not a label. */
  kicker: string;
  /** Two lines of display type; the array IS the line break. */
  title: [string, string];
  text: string;
  primary: { label: string; action: HomeSlideAction };
  secondary: { label: string; action: HomeSlideAction };
  /** A cut-out product photograph, drawn over the green disc. */
  photo: string;
  alt: string;
}

/**
 * The home hero.
 *
 * Laid out to the reference the operator supplied (6 Eyl 2026): a cream band
 * under a white nav, an oversized cocoa headline on the left, and the drink
 * cut out and floated over a deep-green disc on the right, with the other two
 * drinks as thumbnails below the copy.
 *
 * The reference was a Starbucks concept, so what is copied is the LAYOUT and
 * the colour treatment. Everything with a trademark on it is L'Affogato's
 * own: the mark, the wordmark, the drinks and the photographs - the three
 * cut-outs are this café's own Matcha Bar shots.
 *
 * `-cut` rather than the plain files the menu cards use: those are square
 * 1024px canvases whose cup occupies a portrait 0.62 of the frame, so sizing
 * one to the hero's height made it half again as WIDE as the disc behind it
 * and buried the shape completely. The trimmed variants are the cup and
 * nothing else, which is also what lets it hang off the disc's lower edge
 * the way the reference does. Generated with `sharp().trim()`; the untrimmed
 * originals stay for the menu cards, which rely on the square canvas to line
 * their drinks up with each other.
 */
export const HOME_SLIDES: HomeSlide[] = [
  {
    kicker: "Strawberry Aşkı",
    title: ["Çilekli", "Matcha Latte"],
    text: "Taze çilek katmanının üzerine çırpılmış Uji matcha ve soğuk süt. Seramoni sınıfı matcha, siparişten sonra çırpılır; çilek ezmesi her sabah barda hazırlanır. Sezon boyunca menüde.",
    primary: { label: "Menüye göz at", action: "seasonMenu" },
    secondary: { label: "Sezonu gör", action: "menu" },
    photo: "/menu/strawberry-matcha-cut.webp",
    alt: "Çilekli matcha latte, buzlu bardakta",
  },
  {
    kicker: "İmza ürün",
    title: ["Matcha", "Affogato"],
    text: "Fior di latte gelatonun üzerine çırpılmış matcha, masanızda dökülür. 1994'te patentlenen ritüelin matcha hâli - içilir, sonra kupası yenir.",
    primary: { label: "Ürünü gör", action: "signature" },
    secondary: { label: "Hikayemiz", action: "story" },
    photo: "/menu/matcha-affogato-cut.webp",
    alt: "Matcha affogato, üzerinde gelato topu",
  },
  {
    kicker: "Her gün barda",
    title: ["Buzlu", "Matcha Latte"],
    text: "Çırpılmış matcha, ipeksi süt ve buz. Menünün en sade duranı, en çok içileni - köşkün terasında günün her saati.",
    primary: { label: "Menüye göz at", action: "menu" },
    secondary: { label: "Ziyaret bilgileri", action: "visit" },
    photo: "/menu/matcha-latte-cut.webp",
    alt: "Buzlu matcha latte, uzun bardakta",
  },
];

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
      "Köşkün üst katında özel karaoke odası. Gece 02:00'e kadar açığız - " +
      "grup rezervasyonu için bize ulaşın.",
  },
  /** Fixed query used for the map embed and directions links. Kept separate
   *  from `address` so editing the displayed lines cannot break geocoding. */
  mapsQuery: "L'Affogato, Atatürk Cad. No: 28, 34940 Tuzla, İstanbul",
  landmark: "Menemenci Cumhur’un yanı",
  phone: "+90 536 429 09 19",
  email: "info@nextgenlab.com.tr",
  parent: "L'Affogato Italia · Via Galliera 21, Bologna",
};
