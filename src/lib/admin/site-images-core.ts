/**
 * The site's photographs the panel can change (operator, 22 Kas 2026:
 * "sitedeki görselleri panelden de yönetebiliyor olalım"; the karaoke
 * page's photo "admin panelden de değiştirilebilir olsun").
 *
 * Pure and client-safe: the panel's list and the public pages read the same
 * slots. Each slot names where it shows, the photograph bundled with the
 * site (shown while the panel has none) and the text a screen reader hears.
 * Rows live in `site_images` (keyed by `key`); src/lib/admin/site-images.ts
 * reads and writes them, src/lib/seo/site-data.ts `getSiteImages()` gives
 * the pages a resolved `{ src, alt }` per slot.
 *
 * A new slot: add it here, then read `images[key]` where the page draws it.
 * Never rename a key that has rows: the uploaded picture is found by it.
 */

export interface SiteImageSlot {
  key: string;
  /** The panel's group heading. */
  group: string;
  /** What the panel calls it ("Menü sayfasının üst fotoğrafı"). */
  label: string;
  /** Where on the site it shows, for the panel's hint. */
  where: string;
  /** The bundled photograph (public/…), shown with no upload. */
  fallback: string;
  /** The bundled alt text; "" = decorative. */
  alt: string;
  /** The shape the slot crops to, for the panel's hint ("16:9"). */
  ratio: string;
}

export const SITE_IMAGE_GROUPS = [
  "Sayfa açılışları",
  "Karaoke",
  "Anasayfa",
  "Ziyaret ve hikâye",
  "Menü panelleri",
] as const;

export const SITE_IMAGE_SLOTS: readonly SiteImageSlot[] = [
  // ── Sayfa açılışları ──
  {
    key: "hero.menu",
    group: "Sayfa açılışları",
    label: "Menü",
    where: "/menu sayfasının en üstündeki geniş fotoğraf",
    fallback: "/photos/hero-menu.webp",
    alt: "",
    ratio: "16:5 (telefonda 4:3)",
  },
  {
    key: "hero.shop",
    group: "Sayfa açılışları",
    label: "Mağaza",
    where: "/magaza'nın üstü (Mağaza vitrininde slayt yokken)",
    fallback: "/photos/hero-shop.webp",
    alt: "",
    ratio: "16:5 (telefonda 4:3)",
  },
  {
    key: "hero.story",
    group: "Sayfa açılışları",
    label: "Hikayemiz",
    where: "/hikayemiz sayfasının üstü",
    fallback: "/photos/hero-story.webp",
    alt: "",
    ratio: "16:5 (telefonda 4:3)",
  },
  {
    key: "hero.visit",
    group: "Sayfa açılışları",
    label: "Ziyaret",
    where: "/ziyaret sayfasının üstü",
    fallback: "/rehber/spanish-latte-nedir.webp",
    alt: "",
    ratio: "16:5 (telefonda 4:3)",
  },
  {
    key: "hero.campaigns",
    group: "Sayfa açılışları",
    label: "Kampanyalar",
    where: "/kampanyalar sayfasının üstü",
    fallback: "/rehber/tiramisu-tarifi.webp",
    alt: "",
    ratio: "16:5 (telefonda 4:3)",
  },
  {
    key: "hero.guides",
    group: "Sayfa açılışları",
    label: "Rehber",
    where: "/rehber sayfasının üstü",
    fallback: "/rehber/espresso-cesitleri.webp",
    alt: "",
    ratio: "16:5 (telefonda 4:3)",
  },
  {
    key: "hero.notfound",
    group: "Sayfa açılışları",
    label: "Sayfa bulunamadı (404)",
    where: "Var olmayan bir adrese gidildiğinde açılan sayfa",
    fallback: "/photos/facade-night.webp",
    alt: "",
    ratio: "Tam ekran (telefonda dik)",
  },
  // ── Karaoke ──
  {
    key: "karaoke.hero",
    group: "Karaoke",
    label: "Karaoke sayfasının açılışı",
    where: "/karaoke sayfasının en üstündeki fotoğraf",
    fallback: "/photos/hero-karaoke.webp",
    alt: "",
    ratio: "16:9",
  },
  {
    key: "karaoke.room",
    group: "Karaoke",
    label: "Oda",
    where: "/karaoke sayfasında odayı anlatan bölüm",
    fallback: "/photos/interior-chest.webp",
    alt: "Köşkün salonu",
    ratio: "4:5",
  },
  {
    key: "home.karaoke",
    group: "Karaoke",
    label: "Anasayfadaki karaoke bölümü",
    where: "Anasayfanın Karaoke odası bölümü",
    fallback: "/photos/hero-karaoke.webp",
    alt: "",
    ratio: "16:9",
  },
  // ── Anasayfa ──
  {
    key: "home.signature",
    group: "Anasayfa",
    label: "İmza içecek",
    where: 'Anasayfadaki "İçilir, sonra kupası yenir" bölümü',
    fallback: "/photos/affogato-cup.webp",
    alt: "Yenilebilir waffle kupta affogato",
    ratio: "Yatay, geniş",
  },
  {
    key: "home.app",
    group: "Anasayfa",
    label: "Uygulama bölümü",
    where: "Anasayfadaki L'Affogato uygulaması bölümü",
    fallback: "/photos/drinks-tray.webp",
    alt: "Köşkün terasında içecekler",
    ratio: "6:5",
  },
  {
    key: "home.visit.1",
    group: "Anasayfa",
    label: "Ziyaret, 1. fotoğraf",
    where: 'Anasayfadaki "Bizi ziyaret edin" sırası',
    fallback: "/photos/facade-day.webp",
    alt: "Köşkün gündüz cephesi",
    ratio: "4:3",
  },
  {
    key: "home.visit.2",
    group: "Anasayfa",
    label: "Ziyaret, 2. fotoğraf",
    where: 'Anasayfadaki "Bizi ziyaret edin" sırası',
    fallback: "/photos/terrace-wide.webp",
    alt: "Köşkün terası",
    ratio: "4:3",
  },
  {
    key: "home.visit.3",
    group: "Anasayfa",
    label: "Ziyaret, 3. fotoğraf",
    where: 'Anasayfadaki "Bizi ziyaret edin" sırası',
    fallback: "/photos/interior-mirror.webp",
    alt: "Köşkün içi",
    ratio: "4:3",
  },
  // ── Ziyaret ve hikâye ──
  {
    key: "visit.tuzla",
    group: "Ziyaret ve hikâye",
    label: "Tuzla köşkü kartı",
    where: "/ziyaret sayfasındaki Tuzla köşkü kartı",
    fallback: "/photos/facade-day.webp",
    alt: "Tuzla'daki restore ahşap köşk",
    ratio: "4:3",
  },
  {
    key: "visit.marina",
    group: "Ziyaret ve hikâye",
    label: "L'Affogato Marina kartı",
    where: "/ziyaret sayfasındaki Marina kartı (yüklenene kadar boş zemin)",
    fallback: "",
    alt: "L'Affogato Marina",
    ratio: "4:3",
  },
  {
    key: "visit.private",
    group: "Ziyaret ve hikâye",
    label: "Özel kiralama kartı",
    where: "/ziyaret sayfasındaki Özel kiralama kartı",
    fallback: "/photos/interior-chest.webp",
    alt: "Köşkün salonu",
    ratio: "4:3",
  },
  {
    key: "story.kosk",
    group: "Ziyaret ve hikâye",
    label: "Hikâye: köşk",
    where: "/hikayemiz sayfasındaki Köşk bölümünün büyük fotoğrafı",
    fallback: "/photos/facade-day.webp",
    alt: "Köşkün cephesi",
    ratio: "Dik",
  },
  {
    key: "story.founder",
    group: "Ziyaret ve hikâye",
    label: "Hikâye: kurucu",
    where: "/hikayemiz sayfasındaki kurucu bölümü",
    fallback: "/photos/interior-chest.webp",
    alt: "Köşkün salonu",
    ratio: "4:3",
  },
  // ── Menü panelleri ──
  {
    key: "nav.menu",
    group: "Menü panelleri",
    label: "Menü panelindeki fotoğraf",
    where: "Üst çubukta Menü'nün üstüne gelince açılan panel",
    fallback: "/menu/strawberry-matcha.webp",
    alt: "",
    ratio: "4:3",
  },
  {
    key: "nav.shop",
    group: "Menü panelleri",
    label: "Mağaza panelindeki fotoğraf",
    where: "Üst çubukta Mağaza'nın üstüne gelince açılan panel",
    fallback: "/menu/espresso.webp",
    alt: "",
    ratio: "4:3",
  },
  {
    key: "nav.visit",
    group: "Menü panelleri",
    label: "Ziyaret panelindeki fotoğraf",
    where: "Üst çubukta Ziyaret & keşfet'in üstüne gelince açılan panel",
    fallback: "/photos/facade-day.webp",
    alt: "",
    ratio: "4:3",
  },
];

export type SiteImageKey = (typeof SITE_IMAGE_SLOTS)[number]["key"];

/** What a page draws for one slot: an address ("" = no picture) and alt. */
export interface SiteImage {
  src: string;
  alt: string;
}

export type SiteImages = Record<string, SiteImage>;

export function findSiteImageSlot(key: string): SiteImageSlot | undefined {
  return SITE_IMAGE_SLOTS.find((s) => s.key === key);
}

/** The public path an uploaded slot is served at, with its content stamp. */
export function siteImagePath(key: string, version = ""): string {
  const path = `/gorsel/site/${encodeURIComponent(key)}`;
  return version ? `${path}?v=${encodeURIComponent(version)}` : path;
}

/** Every slot with its bundled photograph: what pages show without rows. */
export function bundledSiteImages(): SiteImages {
  const out: SiteImages = {};
  for (const s of SITE_IMAGE_SLOTS)
    out[s.key] = { src: s.fallback, alt: s.alt };
  return out;
}

/**
 * One slot from a resolved map, falling back to the bundled photograph: a
 * page never breaks on a key the map lacks (a deploy ahead of the cache).
 */
export function siteImage(
  images: SiteImages | undefined,
  key: string,
): SiteImage {
  const hit = images?.[key];
  if (hit) return hit;
  const slot = findSiteImageSlot(key);
  return { src: slot?.fallback ?? "", alt: slot?.alt ?? "" };
}
