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
];

export const CONTENT_GROUPS: string[] = [
  ...new Set(CONTENT_FIELDS.map((f) => f.group)),
];

export function contentDefaults(): Record<string, string> {
  return Object.fromEntries(CONTENT_FIELDS.map((f) => [f.key, f.default]));
}
