// Client-safe site-content field registry (no server-only / no DB import).
// Both the admin editor (client) and the server data layer read this.

export type ContentKind = "text" | "textarea";

export interface ContentField {
  key: string;
  group: string;
  label: string;
  kind: ContentKind;
  default: string;
}

export const CONTENT_FIELDS: ContentField[] = [
  // ── Ana sayfa ──
  {
    key: "home.hero.eyebrow",
    group: "Ana sayfa",
    label: "Hero üst etiket",
    kind: "text",
    default: "Bologna · 1987 → İstanbul · 2026",
  },
  {
    key: "home.hero.lede",
    group: "Ana sayfa",
    label: "Hero açıklama",
    kind: "textarea",
    default:
      "İtalya’dan ithal kahve barı konsepti. Tek-origin Sirena espresso’yu fior di latte gelato üzerine, 1994 patentli yenilebilir waffle kup içinde döküyoruz. Bittiğinde kaşığa gerek yok — kupu yiyorsunuz.",
  },
  // ── Hikaye ──
  {
    key: "story.hero.lede",
    group: "Hikaye",
    label: "Hikaye hero açıklama",
    kind: "textarea",
    default:
      "Üç kuşak Mancuso ailesi. Patentli bir kup. 39 yıldır değişmeyen tek bir ritüel. Şimdi İstanbul’da, Tuzla’da 200 yıllık bir Rum köşkünde.",
  },
  {
    key: "story.founder.bio",
    group: "Hikaye",
    label: "Kurucu biyografisi",
    kind: "textarea",
    default:
      "İtalyan baba, İstanbullu anne. 1987'de büyükbabasının açtığı L'Affogato barını üçüncü kuşak olarak devraldı. 2026'da markayı doğduğu şehre, İstanbul'a; Tuzla'da 200 yıllık, Rum'lardan kalma restore bir köşke getirdi.",
  },
  // ── Franchise ──
  {
    key: "franchise.pitch",
    group: "Franchise",
    label: "Franchise sloganı",
    kind: "textarea",
    default: "1987'den beri İtalya'da; 2026'dan beri İstanbul'da. Şimdi sıra sizin şehrinizde.",
  },
  { key: "franchise.stat.1.value", group: "Franchise", label: "İstatistik 1 · değer", kind: "text", default: "39" },
  { key: "franchise.stat.1.label", group: "Franchise", label: "İstatistik 1 · etiket", kind: "text", default: "Yıl" },
  { key: "franchise.stat.1.desc", group: "Franchise", label: "İstatistik 1 · açıklama", kind: "text", default: "Bologna’dan İstanbul’a." },
  { key: "franchise.stat.2.value", group: "Franchise", label: "İstatistik 2 · değer", kind: "text", default: "12" },
  { key: "franchise.stat.2.label", group: "Franchise", label: "İstatistik 2 · etiket", kind: "text", default: "Koltuk" },
  { key: "franchise.stat.2.desc", group: "Franchise", label: "İstatistik 2 · açıklama", kind: "text", default: "Optimum mekan kapasitesi." },
  { key: "franchise.stat.3.value", group: "Franchise", label: "İstatistik 3 · değer", kind: "text", default: "38m²" },
  { key: "franchise.stat.3.label", group: "Franchise", label: "İstatistik 3 · etiket", kind: "text", default: "Minimum" },
  { key: "franchise.stat.3.desc", group: "Franchise", label: "İstatistik 3 · açıklama", kind: "text", default: "Açılış metrekaresi." },
  { key: "franchise.stat.4.value", group: "Franchise", label: "İstatistik 4 · değer", kind: "text", default: "14ay" },
  { key: "franchise.stat.4.label", group: "Franchise", label: "İstatistik 4 · etiket", kind: "text", default: "Geri dönüş" },
  { key: "franchise.stat.4.desc", group: "Franchise", label: "İstatistik 4 · açıklama", kind: "text", default: "Beklenen yatırım süresi." },
];

export const CONTENT_GROUPS: string[] = [...new Set(CONTENT_FIELDS.map((f) => f.group))];

export function contentDefaults(): Record<string, string> {
  return Object.fromEntries(CONTENT_FIELDS.map((f) => [f.key, f.default]));
}
