/**
 * Product CSV import: the columns, the limits, how a header and the small
 * cells are read, and the template. Client-safe (no Zod, no store): the
 * import page shows the same column list the server reads.
 *
 * The rules a row follows (product-import.ts applies them):
 *
 * - `sku` is the match key. A SKU the panel has updates that product, a new
 *   one creates a product. The same file twice creates nothing the second
 *   time and changes nothing.
 * - A column missing from the file never touches its field.
 * - An empty cell in a main column (name, category, price, stock, isActive,
 *   description, tag) keeps the product's value; a new product needs name,
 *   category, price and description.
 * - An empty cell in an optional column clears it: no was price, the
 *   category's KDV rate, no brand, weight not shown.
 * - Images are not imported.
 */

import { toCsv } from "./csv";
import { foldTr } from "./text-fold";

/** The largest file the import reads. */
export const PRODUCT_IMPORT_MAX_BYTES = 1024 * 1024;
/** The most data rows one file may hold (the header not counted). */
export const PRODUCT_IMPORT_MAX_ROWS = 500;
/** The largest stock or weight a cell may hold; a bigger one is a typo. */
export const PRODUCT_IMPORT_MAX_COUNT = 100_000;
/** Any cell longer than this is refused before it is read (description excepted). */
export const PRODUCT_IMPORT_CELL_MAX = 200;
/** The note on each stock move the import writes. */
export const PRODUCT_IMPORT_STOCK_NOTE = "CSV içe aktarma";

export type ImportColumn =
  | "sku"
  | "name"
  | "category"
  | "price"
  | "compareAtPrice"
  | "stock"
  | "taxRatePct"
  | "isActive"
  | "description"
  | "brand"
  | "weight"
  | "tag";

export interface ImportColumnSpec {
  key: ImportColumn;
  /** Who needs it: shown in the column table. */
  need: "always" | "new" | "optional";
  example: string;
  note: string;
  /** Other header spellings accepted (Turkish names, with or without spaces). */
  aliases: readonly string[];
}

/** The template's columns, in its order. */
export const PRODUCT_IMPORT_COLUMNS: readonly ImportColumnSpec[] = [
  {
    key: "sku",
    need: "always",
    example: "SIRE-00101",
    note: "Eşleştirme anahtarı. Panelde bu SKU varsa ürün güncellenir, yoksa yeni ürün açılır.",
    aliases: ["stokkodu", "urunkodu"],
  },
  {
    key: "name",
    need: "new",
    example: "Sirena Espresso Blend",
    note: "Ürün adı, 2-120 karakter.",
    aliases: ["ad", "urunadi", "isim"],
  },
  {
    key: "category",
    need: "new",
    example: "Kahve çekirdeği",
    note: "Panelde olan bir kategorinin adı ya da slug'ı (beans, gear...).",
    aliases: ["kategori"],
  },
  {
    key: "price",
    need: "new",
    example: "129,90",
    note: "KDV dahil satış fiyatı. 129,90 da 129.90 da olur; en az 0,01 TL.",
    aliases: ["fiyat", "satisfiyati"],
  },
  {
    key: "compareAtPrice",
    need: "optional",
    example: "149,90",
    note: "Eski fiyat. Boşsa indirim gösterilmez.",
    aliases: ["eskifiyat"],
  },
  {
    key: "stock",
    need: "optional",
    example: "24",
    note: "Adet. Var olan üründe aradaki fark stok hareketi olarak yazılır. Boşsa değişmez; yeni üründe 0.",
    aliases: ["stok", "adet"],
  },
  {
    key: "taxRatePct",
    need: "optional",
    example: "1",
    note: "KDV oranı (0, 1, 10, 20). Boşsa kategorinin oranı geçer.",
    aliases: ["kdv", "kdvorani"],
  },
  {
    key: "isActive",
    need: "optional",
    example: "evet",
    note: "evet / hayır (1 / 0, aktif / pasif da olur). Boşsa değişmez; yeni ürün pasif açılır.",
    aliases: ["aktif", "durum", "yayinda"],
  },
  {
    key: "description",
    need: "new",
    example: "Fındık ve kakao notalı, dengeli bir espresso harmanı.",
    note: "En fazla 2000 karakter. Satır sonu için hücreyi tırnak içine al.",
    aliases: ["aciklama", "desc"],
  },
  {
    key: "brand",
    need: "optional",
    example: "Sirena",
    note: "En fazla 40 karakter. Boşsa marka gösterilmez.",
    aliases: ["marka"],
  },
  {
    key: "weight",
    need: "optional",
    example: "250",
    note: "Gram. Ürün sayfasında görünür; boşsa gösterilmez.",
    aliases: ["agirlik", "gram", "weightgrams"],
  },
  {
    key: "tag",
    need: "optional",
    example: "Çekirdek · 250 g",
    note: "Kartta adın altındaki satır. Boşsa değişmez; yeni üründe kategorinin adı.",
    aliases: ["etiket", "altbaslik"],
  },
];

export const IMPORT_NEED_LABEL: Readonly<Record<ImportColumnSpec["need"], string>> = {
  always: "Zorunlu",
  new: "Yeni üründe zorunlu",
  optional: "İsteğe bağlı",
};

/** A header cell as a lookup key: Turkish letters folded, no spaces or marks. */
export function headerKey(raw: string): string {
  return foldTr(raw.trim())
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const HEADER_LOOKUP: ReadonlyMap<string, ImportColumn> = new Map(
  PRODUCT_IMPORT_COLUMNS.flatMap((c) =>
    [c.key, ...c.aliases].map((a) => [headerKey(a), c.key] as const),
  ),
);

/** The column a header cell names, or null for one the import does not read. */
export function importColumnFor(header: string): ImportColumn | null {
  return HEADER_LOOKUP.get(headerKey(header)) ?? null;
}

const TRUE_WORDS = new Set(["1", "evet", "e", "true", "yes", "y", "aktif", "acik", "var", "x"]);
const FALSE_WORDS = new Set(["0", "hayir", "h", "false", "no", "n", "pasif", "kapali", "yok"]);

/** An isActive cell: true, false, null when empty, or "invalid". */
export function parseActiveCell(raw: string): boolean | null | "invalid" {
  const word = headerKey(raw);
  if (!word) return null;
  if (TRUE_WORDS.has(word)) return true;
  if (FALSE_WORDS.has(word)) return false;
  return "invalid";
}

/**
 * A stock or weight cell: a whole number from 0 to PRODUCT_IMPORT_MAX_COUNT,
 * null when empty. No sign, no thousands dot, no decimal: "1.000" could be
 * a thousand or one, so it is refused, not guessed.
 */
export function parseCountCell(
  raw: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: true, value: null };
  if (!/^\d+$/.test(text)) {
    return {
      ok: false,
      error: "nokta, virgül ya da işaret olmadan tam sayı yaz (ör. 24).",
    };
  }
  const value = Number(text);
  if (value > PRODUCT_IMPORT_MAX_COUNT) {
    return {
      ok: false,
      error: `en fazla ${PRODUCT_IMPORT_MAX_COUNT.toLocaleString("tr-TR")} olabilir.`,
    };
  }
  return { ok: true, value };
}

/** What happens to a row: in the preview, and after the import ran. */
export type ImportRowStatus = "create" | "update" | "unchanged" | "error";

export interface ImportRowView {
  /** The file line the row starts on. */
  line: number;
  sku: string;
  name: string;
  status: ImportRowStatus;
  /** What changes, or why the row is refused. */
  messages: string[];
}

export type ImportCounts = Record<ImportRowStatus, number>;

export const IMPORT_STATUS_LABEL: Readonly<
  Record<"preview" | "done", Record<ImportRowStatus, string>>
> = {
  preview: {
    create: "Yeni",
    update: "Güncellenecek",
    unchanged: "Değişiklik yok",
    error: "Hata",
  },
  done: {
    create: "Eklendi",
    update: "Güncellendi",
    unchanged: "Değişmedi",
    error: "Hata",
  },
};

/** The answer the import page shows. */
export interface ProductImportState {
  phase: "idle" | "preview" | "done";
  /** The file was refused as a whole (too big, not CSV, no sku column). */
  error?: string;
  /** Things worth knowing that refuse nothing (a column skipped, an encoding guessed). */
  notices?: string[];
  fileName?: string;
  /** Fingerprint of the previewed plan; the import refuses a plan that changed since. */
  planHash?: string;
  rows?: ImportRowView[];
  counts?: ImportCounts;
}

export const EMPTY_IMPORT_STATE: ProductImportState = { phase: "idle" };

export function countRows(rows: readonly { status: ImportRowStatus }[]): ImportCounts {
  const counts: ImportCounts = { create: 0, update: 0, unchanged: 0, error: 0 };
  for (const r of rows) counts[r.status] += 1;
  return counts;
}

/**
 * The template: the header and one example row, `;` between cells (what
 * Excel with a Turkish locale reads), UTF-8 with a byte order mark so the
 * Turkish letters open right, CRLF line ends.
 */
export function productImportTemplate(exampleCategory: string): string {
  return toCsv(
    [
      PRODUCT_IMPORT_COLUMNS.map((c) => c.key),
      PRODUCT_IMPORT_COLUMNS.map((c) =>
        c.key === "category" ? exampleCategory : c.example,
      ),
    ],
    ";",
    { bom: true },
  );
}
