// L'Affogato — content data

export const BRAND = {
  heritage: "Bologna, 1987",
  imported: "Italia → İstanbul, 2026",
  tag: "Drink it. Eat the cup.",
  italian: "Caffè · Gelato · Dolci",
  signature: "But first, Affogato",
};

export interface MenuItem {
  name: string;
  desc: string;
  price: string;
  tags?: string[];
  hue: string;
}

export interface MenuCategory {
  title: string;
  sub: string;
  italian: string;
  note: string;
  items: MenuItem[];
}

export const MENU: Record<string, MenuCategory> = {
  affogato: {
    title: "Affogato",
    sub: "Drink it. Eat the cup.",
    italian: "La firma della casa — 1987",
    note: "Tüm affogato'larımız yenilebilir waffle kupada servis edilir. Bittiğinde kaşığa gerek yok.",
    items: [
      { name: "Affogato Classico", desc: "Tek scoop fior di latte gelato, çift shot Sirena espresso, yenilebilir waffle kup. Orijinal Bolonya tarifi.", price: "130₺", tags: ["signature", "eat the cup"], hue: "cream" },
      { name: "Affogato Cioccolato", desc: "Bitter çikolata gelato, sıcak espresso, Modicano kakao kırığı, deniz tuzu.", price: "140₺", tags: ["vegan opt."], hue: "dark" },
      { name: "Affogato Nocciola", desc: "IGP Piemonte fındık gelato, espresso, kavrulmuş fındık kırığı.", price: "150₺", tags: ["nuts"], hue: "caramel" },
      { name: "Affogato Pistacchio", desc: "Bronte Sicilya pistacchio gelato, espresso, kandi pistacchio.", price: "160₺", tags: ["nuts", "IGP"], hue: "pistachio" },
      { name: "Affogato Matcha", desc: "Uji matcha latte üzerine fior di latte gelato. Yeni sezon — yaz 2026.", price: "155₺", tags: ["new"], hue: "matcha" },
      { name: "Affogato Strawberry", desc: "Çilek soslu gelato, fresh strawberry, espresso. Maltepe Park özel.", price: "155₺", tags: ["new", "limited"], hue: "strawberry" },
    ],
  },
  matcha: {
    title: "Matcha Bar",
    sub: "Uji ceremonial grade",
    italian: "Il banco matcha",
    note: "Japonya Uji'dan ceremonial grade matcha. Her bardağı taşıma odasında dövüyoruz.",
    items: [
      { name: "Matcha Latte", desc: "Bambu çırpıcıyla dövülmüş Uji matcha, ipeksi süt. Sıcak veya buzlu.", price: "120₺", tags: ["hot/cold"], hue: "matcha" },
      { name: "Strawberry Matcha Latte", desc: "Taze çilek püresi katmanı, Uji matcha, soğuk süt. Cam bardakta.", price: "140₺", tags: ["signature", "iced"], hue: "strawberry" },
      { name: "Matcha Tonic", desc: "Matcha shot, Akdeniz toniği, portakal kabuğu, buz küresi.", price: "130₺", tags: ["iced"], hue: "matcha" },
      { name: "Matcha Affogato", desc: "Bardakta matcha latte üzerine fior di latte gelato — burada veya yenilebilir kupta.", price: "155₺", tags: ["signature"], hue: "matcha" },
      { name: "Hojicha Latte", desc: "Kavrulmuş Japon yeşil çayı, süt, akasya balı. Kafein hafif.", price: "110₺", tags: ["caffeine-light"], hue: "caramel" },
    ],
  },
  espresso: {
    title: "Espresso & Coffee",
    sub: "Dalla macchina",
    italian: "Bar İtalyani",
    note: "18g in, 36g out, 27 saniye. Tek-origin Sirena harmanımız her sabah taze kavrulur.",
    items: [
      { name: "Espresso", desc: "Tek shot Sirena. Klasik İtalyan stili, 30ml.", price: "80₺", hue: "dark" },
      { name: "Americano", desc: "Doppio espresso, sıcak su, ince crema.", price: "90₺", hue: "dark" },
      { name: "Cappuccino", desc: "Espresso, 180ml süt, yoğun mikroköpük. Tradizione.", price: "110₺", hue: "cream" },
      { name: "Latte", desc: "İpeksi süt, ristretto, ince köpük katmanı.", price: "120₺", hue: "cream" },
      { name: "Affogato", desc: "Bardakta klasik — fior di latte üzerine sıcak espresso. (Edible kup için ayrı menüde.)", price: "130₺", tags: ["signature"], hue: "caramel" },
      { name: "Mocha", desc: "Bitter çikolata sosu, espresso, ipeksi süt, kakao tozu.", price: "140₺", hue: "dark" },
      { name: "White Mocha", desc: "Beyaz çikolata sosu, espresso, süt, vanilla şanti.", price: "150₺", hue: "cream" },
      { name: "Filter Coffee", desc: "Günün el yapımı filtre kahvesi. Baristaya origin sor.", price: "110₺", hue: "dark" },
    ],
  },
  cold: {
    title: "Cold Bar",
    sub: "Buzlu içecekler",
    italian: "Il banco freddo",
    note: "Maltepe Park yazları için soğuk içecek menüsü — Mart'tan Ekim'e.",
    items: [
      { name: "Cold Brew Sirena", desc: "24 saat yavaş demleme, tek buz küresi üzerinde.", price: "120₺", tags: ["iced"], hue: "dark" },
      { name: "Espresso Tonic", desc: "Akdeniz toniği, çift shot, portakal yağı, buz.", price: "140₺", tags: ["iced"], hue: "caramel" },
      { name: "Iced Latte", desc: "Doppio ristretto, soğuk süt, vanilya isteğe bağlı.", price: "120₺", tags: ["iced"], hue: "cream" },
      { name: "Shakerato", desc: "Espresso, buz, esmer şeker — meringue köpüğe shake'lendi.", price: "130₺", tags: ["iced"], hue: "dark" },
      { name: "Iced Strawberry Matcha", desc: "Çilek püresi, Uji matcha, soğuk süt, taze çilek.", price: "140₺", tags: ["iced", "signature"], hue: "strawberry" },
      { name: "Iced Affogato", desc: "Cold brew yenilebilir kup içinde fior di latte üzerine masada dökülür.", price: "155₺", tags: ["iced", "eat the cup"], hue: "caramel" },
    ],
  },
  gelato: {
    title: "Gelato & Dolci",
    sub: "Dal banco",
    italian: "Dolci della casa",
    note: "Her sabah 06:00'da çevrilen taze gelato. Maltepe'deki yerel mandıradan günlük süt.",
    items: [
      { name: "Single scoop", desc: "Bir tat — fior di latte, stracciatella, nocciola, pistacchio, fondente, matcha.", price: "95₺", hue: "cream" },
      { name: "Double scoop", desc: "İki tat, bardakta veya kornet.", price: "160₺", hue: "caramel" },
      { name: "Tiramisù della casa", desc: "Mascarpone, savoiardi, Sirena espresso, Modicano kakao.", price: "180₺", hue: "dark" },
      { name: "Bombolone alla crema", desc: "Brioche hamuru, vanilya pastry cream dolgu.", price: "120₺", tags: ["hot"], hue: "cream" },
      { name: "Cannolo Siciliano", desc: "Çıtır kabuk, koyun ricottası, kandi portakal, pistacchio.", price: "140₺", hue: "pistachio" },
      { name: "Cantucci & Vin Santo", desc: "Badem biskoti, küçük Vin Santo kadeh.", price: "210₺", tags: ["pairing"], hue: "caramel" },
    ],
  },
};

export interface Product {
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
}

export const PRODUCTS: Product[] = [
  { name: "Sirena — Espresso Blend", tag: "Whole Bean · 250g", price: "320₺", desc: "Brezilya doğal + Etiyopya yıkanmış. Kakao, kuru incir, esmer şeker.", cat: "beans", img: "caramel" },
  { name: "Notturna — Filter Lot", tag: "Whole Bean · 200g", price: "380₺", desc: "Kenya AA Nyeri. Frenk üzümü, bergamot, parlak asidite.", cat: "beans", img: "dark" },
  { name: "Edible Cups — 6 Box", tag: "Waffle Vessels", price: "240₺", desc: "Çıtır waffle kupları, içi yenilebilir glaze. Mekan ritüelini eve taşı.", cat: "gift", img: "cream" },
  { name: "Affogato Kit — For Two", tag: "Gift Box", price: "780₺", desc: "200g Sirena, fior di latte gelato, iki edible kup, porselen kaşık.", cat: "gift", img: "cream", featured: true },
  { name: "Uji Matcha — Ceremonial", tag: "Tin · 40g", price: "420₺", desc: "Japonya Uji bahçesi, ceremonial grade. Bambu chasen ile eşleştirilir.", cat: "pantry", img: "matcha" },
  { name: "Moka — Bialetti × L'Affogato", tag: "3-cup, brushed aluminium", price: "690₺", desc: "Özel L'Affogato amblemli moka pot.", cat: "gear", img: "dark" },
  { name: "Porcelain Cup Set", tag: "Espresso · Set of 2", price: "420₺", desc: "Bone china, L'Affogato cobogó desen, 60ml.", cat: "gear", img: "cream" },
  { name: "Bambu Chasen", tag: "Matcha çırpıcı", price: "320₺", desc: "80 dişli geleneksel bambu chasen, Nara'dan.", cat: "gear", img: "matcha" },
  { name: "Cotton Apron", tag: "Heavyweight canvas", price: "480₺", desc: "Deri boyun askısı, gravür L'Affogato amblemi.", cat: "merch", img: "dark" },
  { name: "Enamel Tumbler", tag: "350ml, double wall", price: "320₺", desc: "Vakum yalıtım, cortado boyu, dış benekli emaye.", cat: "merch", img: "cream" },
  { name: "Cantucci — Bronte Pistachio", tag: "Biscotti · 180g", price: "180₺", desc: "İki kez pişmiş, yavaş fırın. Vin Santo veya doppio ile.", cat: "pantry", img: "pistachio" },
];

export interface Reel {
  caption: string;
  meta: string;
  accent: string;
}

export const REELS: Reel[] = [
  { caption: "How an affogato is born", meta: "0:24 · 12.4K", accent: "caramel" },
  { caption: "Strawberry matcha latte build", meta: "0:32 · 28.1K", accent: "strawberry" },
  { caption: "Eat the cup, no spoon required", meta: "0:18 · 21.0K", accent: "caramel" },
  { caption: "Uji matcha — Japan harvest", meta: "0:52 · 9.4K", accent: "matcha" },
  { caption: "Sirena single origin — Bologna roast", meta: "0:46 · 8.1K", accent: "dark" },
  { caption: "Behind the bar at golden hour", meta: "0:40 · 15.7K", accent: "caramel" },
  { caption: "Gelato batch #214 — fior di latte", meta: "0:28 · 9.3K", accent: "cream" },
  { caption: "Maltepe Park, opening week", meta: "0:36 · 31.6K", accent: "caramel" },
];

export const PRESS = [
  { name: "Monocle", quote: "The most considered new espresso bar in İstanbul." },
  { name: "Cereal", quote: "A small room that takes coffee as architecture." },
  { name: "Time Out İstanbul", quote: "The edible cup is the best 130₺ you can spend." },
  { name: "Condé Nast Traveler", quote: "“But first, affogato” — a worthy detour." },
];

export const STORY = {
  founder: {
    name: "Eda Mancuso",
    role: "Founder & Roaster",
    bio: "Bolonyalı baba, İstanbullu anne. 1987'de büyükbabasının açtığı Bologna L'Affogato barını üçüncü kuşak olarak devraldı. 2026'da markayı doğduğu şehre, İstanbul'a getirdi.",
  },
  heritage: [
    { y: "1987", t: "Bologna · Via Galliera 21", d: "Giancarlo Mancuso ilk L'Affogato barını açar. Tek bar, tek ritüel, edible kup hâlâ ahşap kaşıkla servis ediliyor." },
    { y: "1994", t: "Edible cup ilk kez piyasada", d: "Mancuso ailesi waffle kupa edible glaze kaplamasını patentler. Bugün hâlâ aynı reçete." },
    { y: "2008", t: "Sicily — Bronte pistacchio anlaşması", d: "Üç aile çiftliği ile doğrudan tedarik. Bugün hâlâ aynı çiftlikler." },
    { y: "2026", t: "İstanbul · Maltepe Park", d: "Eda, marka teamül haklarıyla ilk yurt dışı şubeyi açar. İtalya dışındaki tek L'Affogato." },
  ],
};

export const LOCATION = {
  name: "L'Affogato — Maltepe Park",
  short: "Maltepe Park · İstanbul",
  address: ["Maltepe Park AVM", "Open-air rooftop teras", "Cevizli, Tugay Yolu Caddesi No:67", "Maltepe · İstanbul 34846"],
  hours: [
    ["Pazartesi — Perşembe", "10:00 — 23:00"],
    ["Cuma — Cumartesi", "10:00 — 24:00"],
    ["Pazar", "10:00 — 23:00"],
  ] as Array<[string, string]>,
  phone: "+90 216 459 30 60",
  email: "maltepe@laffogato.it",
  parent: "L'Affogato Italia · Via Galliera 21, Bologna",
};

export const FRANCHISE = {
  pitch: "1987'den beri Bologna'da; 2026'dan beri İstanbul'da. Şimdi sıra sizin şehrinizde.",
  stats: [
    { n: "39", l: "Yıl", d: "Bolonya'dan İstanbul'a." },
    { n: "12", l: "Koltuk", d: "Optimum mekan kapasitesi." },
    { n: "38m²", l: "Minimum", d: "Açılış metrekaresi." },
    { n: "14ay", l: "Geri dönüş", d: "Beklenen yatırım süresi." },
  ],
  packages: [
    {
      name: "Kiosk",
      area: "24–38 m²",
      seats: "6–10",
      invest: "Talep üzerine",
      monthly: "İletişim",
      ideal: "AVM teras, premium plaza",
      includes: ["Faema espresso makinesi", "Gelato vitrini (6 lezzet)", "Marka rehberi", "2 hafta açılış eğitimi", "Pazarlama kiti"],
    },
    {
      name: "Bottega",
      area: "40–80 m²",
      seats: "12–24",
      invest: "Talep üzerine",
      monthly: "İletişim",
      ideal: "Cadde, mahalle merkezi",
      includes: ["Tam menü ekipmanı", "Edible cup kapasitesi", "Probat 5kg kavurma", "4 hafta İtalya eğitimi", "Locale tasarımı"],
      featured: true,
    },
    {
      name: "Salone",
      area: "90–160 m²",
      seats: "40–80",
      invest: "Talep üzerine",
      monthly: "İletişim",
      ideal: "Premium AVM, butik otel",
      includes: ["Full bar + kokteyl", "Akşam servisi (Vin Santo)", "Özel mimari", "8 hafta Bologna eğitimi", "Marka yöneticisi"],
    },
  ],
  process: [
    { n: "01", t: "Başvuru", d: "Online form. Lokasyon, deneyim, hedef şehir." },
    { n: "02", t: "Görüşme", d: "Bologna ekibi ile video görüşme — 60 dakika." },
    { n: "03", t: "Yerinde keşif", d: "Maltepe Park'ı ziyaret, mekanı görmek." },
    { n: "04", t: "Anlaşma", d: "Franchise sözleşmesi, lokasyon onayı." },
    { n: "05", t: "Açılış", d: "Bologna'da 4 haftalık eğitim, açılış." },
  ],
};
