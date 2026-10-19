/**
 * The label of a packaged food in the shop (19 Oct 2026, X-TGK-SHOP).
 *
 * Packaged food sold at a distance carries every mandatory label item but
 * the date before the purchase is completed, and all of them at delivery
 * (TGK Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği m.17/2-a,
 * b). The items are those of m.9/1: the name (the product's own), the
 * ingredients with the quantity of a named one (b, ç), the Ek-1 allergens
 * (c; `allergens`, the menu's closed list in src/lib/menu/allergens.ts),
 * the net quantity (d), special storage or use conditions (f), the food
 * business operator's name and address (g), the registration number (ğ),
 * the country of origin (h), instructions for use where needed (ı) and the
 * nutrition declaration (j). The date (e) is printed on the pack.
 *
 * Each is the operator's text, copied from the label; '' is "not entered"
 * and is shown nowhere. Pure and client-safe: the panel form, the schema,
 * the store, both mappers and the product page read the same list.
 */

export const FOOD_LABEL_FIELDS = [
  {
    key: "netQuantity",
    label: "Net miktar",
    panel: "Net miktar",
    hint: "Ambalajdaki gibi: 250 g, 6 adet, 500 ml.",
    max: 60,
    multiline: false,
  },
  {
    key: "ingredients",
    label: "İçindekiler",
    panel: "İçindekiler",
    hint: "Etiketteki bileşen listesi, adı geçen bileşenin oranıyla (ör. %30 Antep fıstığı).",
    max: 2000,
    multiline: true,
  },
  {
    key: "nutrition",
    label: "Besin değerleri",
    panel: "Beslenme bildirimi",
    hint: "Etiketteki tablo, her satır ayrı: Enerji, yağ, doymuş yağ, karbonhidrat, şeker, protein, tuz (100 g için).",
    max: 1000,
    multiline: true,
  },
  {
    key: "storageConditions",
    label: "Saklama koşulu",
    panel: "Saklama koşulu",
    hint: "Ör. Serin ve kuru yerde, ağzı kapalı saklayın.",
    max: 300,
    multiline: false,
  },
  {
    key: "usageInstructions",
    label: "Kullanım",
    panel: "Kullanım talimatı",
    hint: "Yalnız talimat olmadan doğru kullanılamıyorsa.",
    max: 600,
    multiline: true,
  },
  {
    key: "origin",
    label: "Menşe",
    panel: "Menşe ülkesi",
    hint: "Ör. Kenya, Türkiye.",
    max: 120,
    multiline: false,
  },
  {
    key: "producer",
    label: "Üretici / ithalatçı",
    panel: "Gıda işletmecisi (ad ve adres)",
    hint: "Etikette adı geçen üretici, paketleyici ya da ithalatçı: unvanı ve adresi.",
    max: 300,
    multiline: true,
  },
  {
    key: "businessRegNo",
    label: "İşletme kayıt no",
    panel: "İşletme kayıt / onay numarası",
    hint: "Etiketteki işletme kayıt numarası ya da onay işareti.",
    max: 60,
    multiline: false,
  },
] as const;

export type FoodLabelKey = (typeof FOOD_LABEL_FIELDS)[number]["key"];

/**
 * The shop form's answer when the stored `nuts` tag (the app's nut warning)
 * meets entered groups without tree nuts: the form has no tag box, so the
 * way out is the tree-nut box or the warning's own "remove" box.
 */
export const SHOP_NUTS_TAG_ERROR =
  "Bu üründe kuruyemiş uyarısı var ama alerjenlerde “Sert kabuklu meyveler” işaretli değil: içeriyorsa onu da işaretle, içermiyorsa “Kuruyemiş uyarısını kaldır”ı seç.";

export const FOOD_LABEL_KEYS: readonly FoodLabelKey[] = FOOD_LABEL_FIELDS.map(
  (f) => f.key,
);

/** The text fields as a product row holds them. */
export type FoodLabelText = Record<FoodLabelKey, string>;

/** Every text field empty: a new product, and every row before the migration. */
export const EMPTY_FOOD_LABEL: Readonly<FoodLabelText> = Object.freeze(
  Object.fromEntries(FOOD_LABEL_KEYS.map((k) => [k, ""])) as FoodLabelText,
);

/**
 * The operator's text as stored: trimmed, spaces inside a line collapsed,
 * line breaks kept (an ingredient list or a nutrition table reads in
 * lines), blank lines dropped. Anything that is not a string is ''.
 */
export function tidyLabelText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** The fields a row carries, each tidied; a missing key (an old row) is ''. */
export function foodLabelOf(row: unknown): FoodLabelText {
  const source = (row ?? {}) as Partial<Record<FoodLabelKey, unknown>>;
  return Object.fromEntries(
    FOOD_LABEL_KEYS.map((k) => [k, tidyLabelText(source[k])]),
  ) as FoodLabelText;
}
