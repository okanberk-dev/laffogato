// Client-safe site-content field registry (no server-only / no DB import).
// Both the admin editor (client) and the server data layer read this.

export type ContentKind = "text" | "textarea";

export interface ContentField {
  key: string;
  group: string;
  label: string;
  /** Where the text appears, in the operator's words (the editor's hint). */
  hint: string;
  kind: ContentKind;
  default: string;
  /**
   * An empty value is a choice, not a mistake: the home page hides its intro
   * band when the panel leaves it empty. Every other key is refused empty
   * (a cleared field used to blank /hikaye's lede and the app's founder card).
   */
  allowEmpty?: boolean;
}

/** Longest value a field takes; refused above it, never cut. */
export const CONTENT_LIMIT: Record<ContentKind, number> = {
  text: 200,
  textarea: 2000,
};

export const CONTENT_FIELDS: ContentField[] = [
  // ── Ana sayfa ──
  {
    key: "home.hero.eyebrow",
    group: "Ana sayfa",
    label: "Ana sayfa giriş etiketi",
    hint: "Slaytların altındaki tanıtım bandının üstündeki kısa satır. Boş bırakırsan çıkmaz.",
    kind: "text",
    default: "Bologna · 1897 → İstanbul · 2026",
    allowEmpty: true,
  },
  {
    key: "home.hero.lede",
    group: "Ana sayfa",
    label: "Ana sayfa giriş metni",
    hint: "Slaytların altındaki tanıtım bandı; ilk cümlesi kalın yazılır. Boş bırakırsan bant gizlenir.",
    kind: "textarea",
    default:
      "İtalya’dan ithal kahve barı konsepti. Tek-origin Sirena espresso’yu fior di latte gelato üzerine, 1994 patentli yenilebilir waffle kup içinde döküyoruz. Bittiğinde kaşığa gerek yok - kupu yiyorsunuz.",
    allowEmpty: true,
  },
  // ── Hikaye ──
  {
    key: "story.hero.lede",
    group: "Hikaye",
    label: "Hikaye sayfası giriş metni",
    hint: "Hikaye sayfasının başlığı altındaki açıklama.",
    kind: "textarea",
    default:
      "Üç kuşak Mancuso ailesi. Patentli bir kup. 39 yıldır değişmeyen tek bir ritüel. Şimdi İstanbul’da, Tuzla’da 200 yıllık bir Rum köşkünde.",
  },
  // Name and role sit next to the bio so the app's Hikâye screen
  // (GET /api/mobile/v1/story) reads one edited record. The website's story
  // page does not read these two (its founder line is part of the page), so
  // the labels say "yalnız uygulamada" (admin audit CON-14, decision D24).
  {
    key: "story.founder.name",
    group: "Hikaye",
    label: "Kurucu adı (yalnız uygulamada)",
    hint: "Uygulamanın Hikâye ekranındaki kurucu kartı. Sitedeki hikaye sayfası bu alanı göstermez.",
    kind: "text",
    default: "Eda Mancuso",
  },
  {
    key: "story.founder.role",
    group: "Hikaye",
    label: "Kurucu unvanı (yalnız uygulamada)",
    hint: "Uygulamanın Hikâye ekranındaki kurucu kartı. Sitedeki hikaye sayfası bu alanı göstermez.",
    kind: "text",
    default: "Founder & Roaster",
  },
  {
    key: "story.founder.bio",
    group: "Hikaye",
    label: "Kurucu biyografisi",
    hint: "Hikaye sayfasındaki kurucu bölümü ve uygulamanın kurucu kartı.",
    kind: "textarea",
    default:
      "İtalyan baba, İstanbullu anne. 1897'de büyük dedesinin açtığı L'Affogato barını dördüncü kuşak olarak devraldı. 2026'da markayı doğduğu şehre, İstanbul'a; Tuzla'da 200 yıllık, Rum'lardan kalma restore bir köşke getirdi.",
  },
];

export const CONTENT_GROUPS: string[] = [
  ...new Set(CONTENT_FIELDS.map((f) => f.group)),
];

export function contentDefaults(): Record<string, string> {
  return Object.fromEntries(CONTENT_FIELDS.map((f) => [f.key, f.default]));
}

/** What a Site Metinleri save writes. */
export interface ContentSavePlan {
  /** Keys whose text differs from the default: stored as overrides. */
  upserts: Record<string, string>;
  /**
   * Keys back on their default: the override row goes, so the default (and
   * any later change to it in code) reaches the site again. "Tümünü kaydet"
   * used to store every key, after which no default ever did.
   */
  deletes: string[];
  /** Refusals by key; nothing is written while there is one. */
  fieldErrors: Record<string, string>;
}

/**
 * The save of the Site Metinleri form, as a plan. Values are trimmed and
 * their line breaks normalised; an empty value is refused unless the field
 * allows it, an over-long one is refused (it used to be cut at 2000 with a
 * success message). Keys missing from the form are left as they are.
 */
export function planContentSave(
  form: Readonly<Record<string, string | undefined>>,
): ContentSavePlan {
  const plan: ContentSavePlan = { upserts: {}, deletes: [], fieldErrors: {} };
  for (const field of CONTENT_FIELDS) {
    const raw = form[field.key];
    if (typeof raw !== "string") continue;
    const value = raw.replace(/\r\n?/g, "\n").trim();
    const limit = CONTENT_LIMIT[field.kind];
    if (!value && !field.allowEmpty) {
      plan.fieldErrors[field.key] =
        "Bu metin boş kalamaz. Hazır metne dönmek için Varsayılana dön'e bas.";
    } else if (value.length > limit) {
      plan.fieldErrors[field.key] =
        `En fazla ${limit.toLocaleString("tr-TR")} karakter olabilir; şu an ${value.length.toLocaleString("tr-TR")}.`;
    } else if (value === field.default) {
      plan.deletes.push(field.key);
    } else {
      plan.upserts[field.key] = value;
    }
  }
  return plan;
}
