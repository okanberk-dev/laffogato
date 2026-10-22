// Client-safe, no I/O: the billing address of an e-Arşiv invoice, read out
// of an order's address text (docs/EARSIV.md "Fatura adresi").
//
// An order keeps its address as one block of text: the app writes
// "Evim - Ad Soyad, +90 …\nSokak …\nİlçe / İl 34940"
// (src/lib/mobile/order-address.ts), the web checkout keeps whatever the
// buyer typed. Paraşüt's e-Arşiv job refuses a buyer without a province and
// a district ("Alıcı il/ilçe adresi doldurulmalı"), so both are read out of
// the text here, tolerantly but never by guessing: a text where they cannot
// be told apart reads as `null` and the invoice waits for a person
// ("fatura ili/ilçesi okunamadı").
//
// What leaves for Paraşüt is the text with every phone number taken out
// (KVKK: the invoice carries no phone, docs/EARSIV.md "Giden veri").

/** The 81 provinces as GİB and the post write them. */
export const PROVINCES: readonly string[] = [
  "Adana",
  "Adıyaman",
  "Afyonkarahisar",
  "Ağrı",
  "Aksaray",
  "Amasya",
  "Ankara",
  "Antalya",
  "Ardahan",
  "Artvin",
  "Aydın",
  "Balıkesir",
  "Bartın",
  "Batman",
  "Bayburt",
  "Bilecik",
  "Bingöl",
  "Bitlis",
  "Bolu",
  "Burdur",
  "Bursa",
  "Çanakkale",
  "Çankırı",
  "Çorum",
  "Denizli",
  "Diyarbakır",
  "Düzce",
  "Edirne",
  "Elazığ",
  "Erzincan",
  "Erzurum",
  "Eskişehir",
  "Gaziantep",
  "Giresun",
  "Gümüşhane",
  "Hakkâri",
  "Hatay",
  "Iğdır",
  "Isparta",
  "İstanbul",
  "İzmir",
  "Kahramanmaraş",
  "Karabük",
  "Karaman",
  "Kars",
  "Kastamonu",
  "Kayseri",
  "Kilis",
  "Kırıkkale",
  "Kırklareli",
  "Kırşehir",
  "Kocaeli",
  "Konya",
  "Kütahya",
  "Malatya",
  "Manisa",
  "Mardin",
  "Mersin",
  "Muğla",
  "Muş",
  "Nevşehir",
  "Niğde",
  "Ordu",
  "Osmaniye",
  "Rize",
  "Sakarya",
  "Samsun",
  "Şanlıurfa",
  "Siirt",
  "Sinop",
  "Şırnak",
  "Sivas",
  "Tekirdağ",
  "Tokat",
  "Trabzon",
  "Tunceli",
  "Uşak",
  "Van",
  "Yalova",
  "Yozgat",
  "Zonguldak",
];

/** Everyday names that mean one province. */
const PROVINCE_ALIASES: Record<string, string> = {
  afyon: "Afyonkarahisar",
  maras: "Kahramanmaraş",
  urfa: "Şanlıurfa",
  antep: "Gaziantep",
  icel: "Mersin",
  izmit: "Kocaeli",
  adapazari: "Sakarya",
};

/**
 * Lower-case, Turkish letters folded to their plain Latin ones, every run of
 * anything else one space: "İSTANBUL" "istanbul" and "Istanbul" meet.
 */
export function foldPlace(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const PROVINCE_BY_FOLD: ReadonlyMap<string, string> = new Map([
  ...PROVINCES.map((p) => [foldPlace(p), p] as const),
  ...Object.entries(PROVINCE_ALIASES),
]);

/** The province a word names, in its official spelling; null when none. */
export function provinceOf(word: string): string | null {
  return PROVINCE_BY_FOLD.get(foldPlace(word)) ?? null;
}

/**
 * Words that end a street line and are never a district: "Bağdat Cad.
 * İstanbul" names no district.
 */
const NOT_A_DISTRICT = new Set([
  "mah",
  "mahalle",
  "mahallesi",
  "mh",
  "cad",
  "cadde",
  "caddesi",
  "cd",
  "sok",
  "sokak",
  "sokagi",
  "sk",
  "bulvar",
  "bulvari",
  "blv",
  "no",
  "kat",
  "daire",
  "d",
  "apt",
  "apartmani",
  "blok",
  "site",
  "sitesi",
  "turkiye",
  "merkez",
]);

/** A district candidate: one or two words of letters, not a street word. */
function districtWord(raw: string): string | null {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const words = text.split(" ");
  if (words.length > 2) return null;
  for (const w of words) {
    const f = foldPlace(w);
    if (!/^[a-z]{3,}$/.test(f) || NOT_A_DISTRICT.has(f)) return null;
  }
  if (provinceOf(text)) return null;
  return text;
}

/** "kadıköy" → "Kadıköy": the first letter of each word up, the rest down. */
function titleCase(value: string): string {
  return value
    .split(" ")
    .map((w) =>
      w
        ? w.charAt(0).toLocaleUpperCase("tr-TR") +
          w.slice(1).toLocaleLowerCase("tr-TR")
        : w,
    )
    .join(" ");
}

export interface DistrictCity {
  district: string;
  city: string;
}

/** One line's district and province, or null. */
function parseLine(line: string): DistrictCity | null {
  // Postcodes and a trailing country add nothing.
  const clean = line
    .replace(/\b\d{5}\b/g, " ")
    .replace(/\b(türkiye|turkiye|turkey)\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s,.;/-]+$/, "");
  if (!clean) return null;
  // "Kadıköy / İstanbul", "Kadıköy/İstanbul", "Kadıköy - İstanbul": the
  // province after the last separator, the word right before it the
  // district ("Atatürk Mah. Kadıköy / İstanbul").
  for (const sep of [/\s*\/\s*/, /\s+-\s+/]) {
    const pieces = clean.split(sep);
    if (pieces.length < 2) continue;
    const city = provinceOf(pieces[pieces.length - 1]);
    const before = (pieces[pieces.length - 2].split(",").pop() ?? "").trim();
    const district = districtWord(before.split(/\s+/).pop() ?? "");
    if (city && district) return { district: titleCase(district), city };
  }
  // "…, Kadıköy, İstanbul" or "… Kadıköy İstanbul": the last word a
  // province, the word (or comma part) before it the district.
  const parts = clean.split(/\s*,\s*/).filter(Boolean);
  const lastPart = parts.at(-1) ?? "";
  const asPart = provinceOf(lastPart);
  if (asPart && parts.length >= 2) {
    const district = districtWord(parts[parts.length - 2]);
    if (district) return { district: titleCase(district), city: asPart };
  }
  const words = clean.split(/[\s,]+/).filter(Boolean);
  if (words.length >= 2) {
    const city = provinceOf(words[words.length - 1]);
    const district = districtWord(words[words.length - 2]);
    if (city && district) return { district: titleCase(district), city };
  }
  return null;
}

/**
 * The district and province of an address text: each line from the last
 * up, the first that names both. Null when none does, or when two lines
 * name different places (a guess either way).
 */
export function parseDistrictCity(text: string): DistrictCity | null {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .reverse();
  let found: DistrictCity | null = null;
  for (const line of lines) {
    const hit = parseLine(line);
    if (!hit) continue;
    if (!found) {
      found = hit;
      continue;
    }
    if (
      foldPlace(hit.city) !== foldPlace(found.city) ||
      foldPlace(hit.district) !== foldPlace(found.district)
    ) {
      return null;
    }
  }
  return found;
}

/**
 * Phone numbers out of an address text (KVKK: no phone on the invoice):
 * "+90 532 123 45 67", "0532 123 4567", "5321234567", "(0212) 555 55 55".
 * A run of 10 or more digits with the usual separators goes; house numbers
 * and postcodes (5 digits) stay. Left-over separators are tidied.
 */
export function stripPhones(text: string): string {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/(?:\+\s*)?(?:\(?\d[\d\s().-]{8,}\d)/g, (m) =>
          m.replace(/\D/g, "").length >= 10 ? " " : m,
        )
        .replace(/\s*,\s*(?=,|$)/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/[\s,]+$/, "")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}
