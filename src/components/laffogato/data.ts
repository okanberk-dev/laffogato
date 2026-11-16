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
  /**
   * The TGK Ek-1 allergen groups the item contains, as the panel entered them
   * (src/lib/menu/allergens.ts); [] = none of the fourteen. Absent = not
   * entered yet: the bundled seed never carries them, since a guessed
   * allergen list is worse than none.
   */
  allergens?: string[];
}

export interface MenuCategory {
  title: string;
  sub: string;
  italian: string;
  note: string;
  items: MenuItem[];
}

/**
 * The cafe menu's category shells (title, strapline, note). The items live in
 * the database (`menu_items`, /admin/menu); nothing is bundled any more, so a
 * database outage shows empty categories rather than a stale price list.
 * Two-size items carry `price` (M) and `priceL` (L); single-size items
 * only carry `price`.
 */
export const MENU: Record<string, MenuCategory> = {
  matcha: {
    title: "Matcha Bar",
    sub: "Strawberry Aşkı",
    italian: "Il banco matcha",
    note: "Ceremonial grade matcha, siparişten sonra çırpılır. Strawberry Aşkı üçlüsü sezon boyunca menüde.",
    items: [],
  },
  espresso: {
    title: "Espresso",
    sub: "Dalla macchina",
    italian: "Bar İtalyani",
    note: "Tüm espresso bazlı içecekler M ve L boy servis edilir. Alternatif süt ve ekstra shot mevcuttur.",
    items: [],
  },
  "ice-coffee": {
    title: "Soğuk Kahve",
    sub: "Buzlu kahveler",
    italian: "Caffè freddo",
    note: "Buzlu kahvelerin tamamı M ve L boy hazırlanır.",
    items: [],
  },
  cold: {
    title: "Soğuk İçecekler",
    sub: "Soğuk içecekler",
    italian: "Bevande fredde",
    note: "Kahvesiz serinleticiler - limonata, soda ve günlük sürpriz karışım.",
    items: [],
  },
  hot: {
    title: "Sıcak İçecekler",
    sub: "Sıcak içecekler",
    italian: "Bevande calde",
    note: "Kahvesiz sıcaklar - çikolata, salep ve çay.",
    items: [],
  },
  frappe: {
    title: "Frappe",
    sub: "Buzla çırpılmış",
    italian: "Frappè",
    note: "Tamamı buzla çırpılır, yoğun köpüklü servis edilir.",
    items: [],
  },
  smoothie: {
    title: "Smoothie",
    sub: "Meyve & süt",
    italian: "Frullati",
    note: "Taze meyve ve sütle çırpılır. Alternatif süt talep edilebilir.",
    items: [],
  },
  frozen: {
    title: "Frozen",
    sub: "Meyveli frozen",
    italian: "Granite",
    note: "Meyve püresi ve buzla hazırlanan frozen serisi.",
    items: [],
  },
  "ice-tea": {
    title: "Soğuk Çay",
    sub: "Buzlu çay",
    italian: "Tè freddo",
    note: "Buz ve taze meyve dilimiyle servis edilir.",
    items: [],
  },
  dessert: {
    title: "Tatlılar",
    sub: "Vitrinden",
    italian: "Dolci della casa",
    note: "Günlük hazırlanır; vitrindeki çeşitler mevsime göre değişebilir.",
    items: [],
  },
  snack: {
    title: "Atıştırmalıklar",
    sub: "Yanında",
    italian: "Spuntini",
    note: "Sandviçler günlük hazırlanır; barlar paketli olarak sunulur.",
    items: [],
  },
  extras: {
    title: "Ekstralar",
    sub: "Ekstralar",
    italian: "Aggiunte",
    note: "Her içeceğe eklenebilir.",
    items: [],
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
      its category's default would be wrong: the edible cup box is food (10%)
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
  /** Compare-at price in minor units (kuruş). Set only while the discount runs. */
  compareAtPriceMinor?: number;
  /** The running discount's first and last instant (UTC ISO), beside the
      compare-at price only (Ticari Reklam Yön. m.14/1: the badge names them). */
  discountStartsAt?: string;
  discountEndsAt?: string;
  /** Packaged food label (src/lib/shop/food-label.ts); absent = not entered. */
  netQuantity?: string;
  ingredients?: string;
  nutrition?: string;
  storageConditions?: string;
  usageInstructions?: string;
  origin?: string;
  producer?: string;
  businessRegNo?: string;
  /** Ek-1 allergen keys (src/lib/menu/allergens.ts); [] = none of the
      fourteen; absent = not entered (then only the `nuts` tag speaks). */
  allergens?: string[];
  /** Admin-authored meta title for the PDP; falls back to the product name. */
  seoTitle?: string;
  /** Admin-authored meta description; falls back to the product blurb. */
  seoDescription?: string;
}

export const PRODUCTS: Product[] = [];

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
