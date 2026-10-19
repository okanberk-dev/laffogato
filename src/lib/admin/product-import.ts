import "server-only";

import { createHash } from "node:crypto";

import { sceneColumns } from "@/lib/backdrop/scene";
import { parseMoneyInput, priceLabel } from "@/lib/utils/format";
import { KDV_RATE_CHOICES } from "@/lib/utils/kdv";

import { parseCsv, type CsvRecord } from "./csv";
import {
  countRows,
  importColumnFor,
  parseActiveCell,
  parseCountCell,
  PRODUCT_IMPORT_CELL_MAX,
  PRODUCT_IMPORT_EXAMPLE_SKU,
  PRODUCT_IMPORT_MAX_BYTES,
  PRODUCT_IMPORT_MAX_COLUMNS,
  PRODUCT_IMPORT_MAX_ROWS,
  PRODUCT_IMPORT_STOCK_NOTE,
  PRODUCT_IMPORT_WRITE_BUDGET_MS,
  type ImportColumn,
  type ImportCounts,
  type ImportRowStatus,
  type ImportRowView,
} from "./product-import-core";
import {
  MONEY_INPUT_ERROR,
  PRODUCT_DESC_MAX_LENGTH,
  PRODUCT_SKU_MAX_LENGTH,
  productFormSchema,
  variantFloorError,
  variantsBelowFloor,
} from "./product-schema";
import {
  adjustStock,
  createProduct,
  getProduct,
  listCategories,
  listProductsForImport,
  NO_BACKDROP,
  patchProductFromImport,
  type AdminCategory,
  type BackdropColumns,
  type ProductImportPatch,
  type ProductImportView,
  type ProductInput,
  type ShopCategoryId,
} from "./store";
import { foldTr } from "./text-fold";

/**
 * Product CSV import, server half: read the uploaded file, plan every row
 * against the catalogue as it stands (nothing written), then apply the
 * valid rows. The column rules are in product-import-core.ts.
 *
 * - Every row is checked with the wizard's own schema (productFormSchema):
 *   the same trims, length caps, price floor, money reading
 *   (parseMoneyInput: "129,90" and "129.90") and KDV rule.
 * - Stock on an existing product moves by a delta through `adjustStock`
 *   (the `adjust_product_stock` SQL function plus a stock move noted "CSV
 *   içe aktarma"), never by overwriting the column: an order taken between
 *   the read and the write keeps its decrement.
 * - The preview's plan has a fingerprint. The import plans again from the
 *   same file and the fresh catalogue and refuses to write when the
 *   fingerprint differs, so what is written is what the operator saw.
 * - File contents are never logged.
 */

export interface ImportContext {
  products: readonly ProductImportView[];
  categories: readonly AdminCategory[];
}

/** The catalogue a plan is made against. */
export async function loadImportContext(): Promise<ImportContext> {
  const [products, categories] = await Promise.all([
    listProductsForImport(),
    listCategories(),
  ]);
  return { products, categories };
}

type CreateInput = Omit<ProductInput, keyof BackdropColumns>;

export type PlannedAction =
  | { kind: "create"; input: CreateInput }
  | {
      kind: "update";
      id: string;
      patch: ProductImportPatch;
      stockDelta: number;
      catChanged: boolean;
    };

/** The optional fields an empty cell clears on an existing product. */
export type ClearedField = "compareAtPrice" | "taxRatePct" | "brand" | "weight";

export interface PlannedRow {
  view: ImportRowView;
  /** Null for a refused or unchanged row: nothing to write. */
  action: PlannedAction | null;
  /** Stored values this row's empty cells will clear (counted in a notice). */
  clears?: ClearedField[];
}

export type ImportPlan =
  | {
      ok: true;
      rows: PlannedRow[];
      counts: ImportCounts;
      notices: string[];
      hash: string;
    }
  | { ok: false; error: string };

const COLUMN_LABEL: Record<ImportColumn, string> = {
  sku: "SKU",
  name: "Ad",
  category: "Kategori",
  price: "Fiyat",
  compareAtPrice: "Eski fiyat",
  stock: "Stok",
  taxRatePct: "KDV",
  isActive: "Aktif",
  description: "Açıklama",
  brand: "Marka",
  weight: "Ağırlık",
  tag: "Etiket",
};

/** The schema's field names, as the operator reads them in a row's reason. */
const FIELD_LABEL: Record<string, string> = {
  name: "Ad",
  sku: "SKU",
  tag: "Etiket",
  desc: "Açıklama",
  cat: "Kategori",
  price: "Fiyat",
  compareAtPrice: "Eski fiyat",
  taxRatePct: "KDV",
  brand: "Marka",
  weightGrams: "Ağırlık",
  stock: "Stok",
};

function normSku(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Kuruş as the text the schema reads back to the same kuruş ("129.90"). */
function minorText(minor: number): string {
  return (minor / 100).toFixed(2);
}

function short(text: string): string {
  return text.length > 40 ? `${text.slice(0, 39)}…` : text;
}

function rateLabel(rate: number | null): string {
  return rate === null ? "kategorinin oranı" : `%${rate}`;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** How the clear notice names each field, after a count ("3 üründe ..."). */
const CLEARED_LABEL: Record<ClearedField, string> = {
  compareAtPrice: "eski fiyat",
  taxRatePct: "ürünün kendi KDV oranı",
  brand: "marka",
  weight: "ağırlık",
};

/** Why an "Eski fiyat" cell with a new value is refused (see planRow). */
export const COMPARE_AT_CSV_ERROR =
  "Eski fiyat CSV ile girilmez: indirimi ürün formunda başlangıç ve bitiş tarihiyle gir. İndirimi bitirmek için hücreyi boş bırak.";

/** Why a price cell may not reach the product's stored "Eski fiyat" (see planRow). */
export function compareAtPriceFloorError(compareAtMinor: number): string {
  return `Fiyat, ürünün eski fiyatının (${priceLabel(compareAtMinor)}) altında kalmalı. Fiyatı yükseltmek için indirimi bitir: Eski fiyat hücresini boş bırak.`;
}

/** The KDV rates a CSV cell may set, besides the product's stored one. */
const KDV_CELL_ERROR =
  "KDV: 0, 1, 10 ya da 20 yaz. Boş hücre kategorinin oranını geçirir.";

/** A category cell: its slug, or its label read the Turkish way. */
function resolveCategory(
  cell: string,
  categories: readonly AdminCategory[],
): { ok: true; slug: ShopCategoryId } | { ok: false; error: string } {
  const bySlug = categories.find(
    (c) => c.slug.toLowerCase() === cell.toLowerCase(),
  );
  if (bySlug) return { ok: true, slug: bySlug.slug };
  const folded = foldTr(cell);
  const slugs = [
    ...new Set(
      categories.filter((c) => foldTr(c.label) === folded).map((c) => c.slug),
    ),
  ];
  if (slugs.length === 1) return { ok: true, slug: slugs[0] };
  if (slugs.length > 1) {
    return {
      ok: false,
      error: `"${short(cell)}" adında birden çok kategori var; slug'ını yaz (${slugs.join(", ")}).`,
    };
  }
  return {
    ok: false,
    error: `Kategori bulunamadı: "${short(cell)}". Panelde olan bir kategorinin adını ya da slug'ını yaz.`,
  };
}

/**
 * Plans every row of a file against the catalogue. Writes nothing.
 */
export function planProductImport(
  text: string,
  ctx: ImportContext,
): ImportPlan {
  const parsed = parseCsv(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const [header, ...data] = parsed.records;
  if (!header) return { ok: false, error: "Dosya boş." };
  if (header.cells.length > PRODUCT_IMPORT_MAX_COLUMNS) {
    return {
      ok: false,
      error: `Başlık satırında en fazla ${PRODUCT_IMPORT_MAX_COLUMNS} sütun olabilir; bu dosyada ${header.cells.length} var. Şablondaki sütunları kullan.`,
    };
  }

  const columns = new Map<ImportColumn, number>();
  const unknown: string[] = [];
  for (const [idx, cell] of header.cells.entries()) {
    const key = importColumnFor(cell);
    if (!key) {
      if (cell.trim()) unknown.push(short(cell.trim()));
      continue;
    }
    if (columns.has(key)) {
      return { ok: false, error: `"${key}" sütunu iki kez var; birini sil.` };
    }
    columns.set(key, idx);
  }
  if (!columns.has("sku")) {
    return {
      ok: false,
      error:
        "Dosyada sku sütunu yok. İlk satır şablondaki başlık satırı olmalı.",
    };
  }
  if (data.length === 0) {
    return { ok: false, error: "Dosyada başlık satırından başka satır yok." };
  }
  if (data.length > PRODUCT_IMPORT_MAX_ROWS) {
    return {
      ok: false,
      error: `Bir dosyada en fazla ${PRODUCT_IMPORT_MAX_ROWS} satır olabilir; bu dosyada ${data.length} var. Dosyayı böl.`,
    };
  }
  const notices: string[] = [];
  if (unknown.length > 0) {
    const named = unknown.slice(0, 10).join(", ");
    const more = unknown.length > 10 ? ` ve ${unknown.length - 10} sütun daha` : "";
    notices.push(`Tanımadığım sütunlar atlandı: ${named}${more}.`);
  }

  const bySku = new Map<string, ProductImportView[]>();
  for (const p of ctx.products) {
    const key = normSku(p.sku ?? "");
    if (!key) continue;
    bySku.set(key, [...(bySku.get(key) ?? []), p]);
  }
  const fileLines = new Map<string, number[]>();
  for (const rec of data) {
    const idx = columns.get("sku")!;
    const key = normSku(rec.cells[idx] ?? "");
    if (key) fileLines.set(key, [...(fileLines.get(key) ?? []), rec.line]);
  }

  const rows = data.map((rec) =>
    planRow(rec, columns, ctx, bySku, fileLines),
  );
  if (fileLines.has(PRODUCT_IMPORT_EXAMPLE_SKU)) {
    notices.push(
      `Şablondaki örnek satır (${PRODUCT_IMPORT_EXAMPLE_SKU}) dosyada duruyor. O ürünü istemiyorsan satırı sil.`,
    );
  }
  // Empty optional cells clear stored values: say how many, above the
  // table, so a file meant for stock alone does not wipe sale prices or
  // KDV rates unseen.
  const cleared = new Map<ClearedField, number>();
  for (const r of rows) {
    if (!r.action) continue;
    for (const f of r.clears ?? []) cleared.set(f, (cleared.get(f) ?? 0) + 1);
  }
  if (cleared.size > 0) {
    const parts = [...cleared].map(([f, n]) => `${n} üründe ${CLEARED_LABEL[f]}`);
    notices.push(
      `Boş hücreler yüzünden temizlenecek: ${parts.join(", ")}. Bunlara dokunmak istemiyorsan o sütunu dosyadan çıkar; olmayan sütun hiçbir şeyi değiştirmez.`,
    );
  }
  const hash = createHash("sha256")
    .update(JSON.stringify(rows.map((r) => [r.view, r.action])))
    .digest("hex")
    .slice(0, 32);
  return {
    ok: true,
    rows,
    counts: countRows(rows.map((r) => r.view)),
    notices,
    hash,
  };
}

function planRow(
  rec: CsvRecord,
  columns: ReadonlyMap<ImportColumn, number>,
  ctx: ImportContext,
  bySku: ReadonlyMap<string, ProductImportView[]>,
  fileLines: ReadonlyMap<string, number[]>,
): PlannedRow {
  /**
   * The trimmed cell, or undefined when the file has no such column or the
   * row stops before it (an editor that drops trailing empty cells must
   * not clear the optional fields at the end of the row).
   */
  const get = (key: ImportColumn): string | undefined => {
    const idx = columns.get(key);
    if (idx === undefined || idx >= rec.cells.length) return undefined;
    return rec.cells[idx].trim();
  };
  const sku = normSku(get("sku") ?? "");
  const nameCell = get("name");
  const refuse = (messages: string[], name = nameCell ?? ""): PlannedRow => ({
    view: {
      line: rec.line,
      sku: short(sku) || "-",
      name: short(name),
      status: "error",
      messages,
    },
    action: null,
  });

  const tooLong: string[] = [];
  for (const [key, idx] of columns) {
    const cap =
      key === "description" ? PRODUCT_DESC_MAX_LENGTH : PRODUCT_IMPORT_CELL_MAX;
    if ((rec.cells[idx] ?? "").trim().length > cap) {
      tooLong.push(`${COLUMN_LABEL[key]} çok uzun (en fazla ${cap} karakter).`);
    }
  }
  if (tooLong.length > 0) return refuse(tooLong, "");

  if (!sku) return refuse(["SKU boş."]);
  if (sku.length > PRODUCT_SKU_MAX_LENGTH) {
    return refuse([`SKU en fazla ${PRODUCT_SKU_MAX_LENGTH} karakter olabilir.`]);
  }
  const lines = fileLines.get(sku) ?? [];
  if (lines.length > 1) {
    return refuse([
      `Bu SKU dosyada birden çok satırda var (satır ${lines.join(", ")}). Birini sil.`,
    ]);
  }
  const matches = bySku.get(sku) ?? [];
  if (matches.length > 1) {
    return refuse([
      `Bu SKU panelde birden çok üründe var (${matches.map((m) => m.id).join(", ")}). Önce panelde düzelt.`,
    ]);
  }
  const existing = matches[0];

  const errors: string[] = [];
  const catCell = get("category");
  let cat: ShopCategoryId | undefined;
  if (catCell) {
    const found = resolveCategory(catCell, ctx.categories);
    if (found.ok) cat = found.slug;
    else errors.push(found.error);
  }
  const stockCell = get("stock");
  const stock = stockCell === undefined ? null : parseCountCell(stockCell);
  if (stock && !stock.ok) errors.push(`Stok: ${stock.error}`);
  const weightCell = get("weight");
  const weight = weightCell === undefined ? null : parseCountCell(weightCell);
  if (weight && !weight.ok) errors.push(`Ağırlık: ${weight.error}`);
  // "Eski fiyat" (Ticari Reklam Yön. m.14): a discount is saved only in the
  // product form, with its days and against the price history. A cell may
  // repeat the stored value (a file exported and sent back) or be emptied
  // to end the discount; any other value is refused for its row.
  const compareCell = get("compareAtPrice");
  const storedCompare = existing?.compareAtPriceMinor ?? 0;
  // True when the row ends the stored discount: an empty cell or a 0.
  let compareClears = compareCell === "" && storedCompare > 0;
  if (compareCell) {
    const minor = parseMoneyInput(compareCell);
    if (minor === null) {
      errors.push(`Eski fiyat: ${MONEY_INPUT_ERROR}`);
    } else if (minor === 0) {
      compareClears = storedCompare > 0;
    } else if (minor !== storedCompare) {
      errors.push(COMPARE_AT_CSV_ERROR);
    }
  }
  const activeCell = get("isActive");
  const active = activeCell === undefined ? null : parseActiveCell(activeCell);
  if (active === "invalid") errors.push("Aktif: evet ya da hayır yaz.");

  const priceCell = get("price");
  const descCell = get("description");
  const tagCell = get("tag");
  if (!existing) {
    const missing = [
      !nameCell && "ad",
      !catCell && "kategori",
      !priceCell && "fiyat",
      !descCell && "açıklama",
    ].filter(Boolean);
    if (missing.length > 0) {
      errors.push(`Yeni ürün için ${missing.join(", ")} gerekli.`);
    }
  }
  if (errors.length > 0) return refuse(errors, nameCell || existing?.name);

  const stockValue = stock?.ok ? stock.value : null;
  const weightValue = weight?.ok ? weight.value : null;
  const categoryLabel = (slug: string) =>
    ctx.categories.find((c) => c.slug === slug)?.label ?? slug;

  // The form the wizard would post for this row: the stored product (or
  // defaults), with the file's cells over it.
  const record: Record<string, string> = existing
    ? {
        name: existing.name,
        sku: existing.sku,
        slug: existing.slug,
        tag: existing.tag,
        desc: existing.desc,
        cat: existing.cat,
        price: minorText(existing.priceMinor),
        stock: String(existing.stock),
        weightGrams: String(existing.weightGrams ?? 0),
        taxRatePct:
          typeof existing.taxRatePct === "number"
            ? String(existing.taxRatePct)
            : "",
        brand: existing.brand ?? "",
      }
    : {
        sku,
        tag: categoryLabel(cat!),
        stock: "0",
        lowStockThreshold: "5",
        weightGrams: "0",
        img: "cream",
      };
  if (existing ? existing.isActive : false) record.isActive = "on";
  if (nameCell) record.name = nameCell;
  if (tagCell) record.tag = tagCell;
  if (descCell) record.desc = descCell;
  if (cat) record.cat = cat;
  if (priceCell) record.price = priceCell;
  const rateCell = get("taxRatePct");
  if (rateCell !== undefined) record.taxRatePct = rateCell;
  const brandCell = get("brand");
  if (brandCell !== undefined) record.brand = brandCell;
  if (weightCell !== undefined) record.weightGrams = String(weightValue ?? 0);
  if (stockValue !== null) record.stock = String(stockValue);
  if (active === true) record.isActive = "on";
  if (active === false) delete record.isActive;

  const checked = productFormSchema.safeParse({
    ...record,
    variants: "[]",
    images: "[]",
  });
  if (!checked.success) {
    const messages = [
      ...new Set(
        checked.error.issues.map((i) => {
          const field = FIELD_LABEL[String(i.path[0] ?? "")];
          return field ? `${field}: ${i.message}` : i.message;
        }),
      ),
    ];
    return refuse(messages, nameCell || existing?.name);
  }
  const d = checked.data;
  const storedRate =
    existing && typeof existing.taxRatePct === "number"
      ? existing.taxRatePct
      : null;
  // The panel stores any whole rate up to 100 for a future decree; a cell
  // takes today's rates or the one the product already has.
  if (
    rateCell !== undefined &&
    d.taxRatePct !== null &&
    d.taxRatePct !== storedRate &&
    !KDV_RATE_CHOICES.includes(d.taxRatePct)
  ) {
    return refuse([KDV_CELL_ERROR], d.name);
  }
  const view = (status: ImportRowStatus, messages: string[]): ImportRowView => ({
    line: rec.line,
    sku: short(sku),
    name: short(d.name),
    status,
    messages,
  });

  if (!existing) {
    const input: CreateInput = {
      name: d.name,
      slug: d.slug,
      sku: d.sku || sku,
      tag: d.tag,
      priceMinor: d.priceMinor,
      // A new product has no price history: never a compare-at price.
      compareAtPriceMinor: 0,
      costMinor: 0,
      desc: d.desc,
      cat: d.cat,
      img: d.img,
      images: [],
      tags: [],
      brand: d.brand,
      notes: [],
      stock: d.stock,
      lowStockThreshold: d.lowStockThreshold,
      weightGrams: d.weightGrams,
      taxRatePct: d.taxRatePct,
      featured: false,
      isNew: false,
      isActive: d.isActive,
      seoTitle: "",
      seoDescription: "",
      variants: [],
    };
    return {
      view: view("create", [
        [
          categoryLabel(d.cat),
          priceLabel(d.priceMinor),
          `stok ${d.stock}`,
          d.isActive ? "aktif" : "pasif",
        ].join(" · "),
      ]),
      action: { kind: "create", input },
    };
  }

  // A new price must keep every variant at 1 kuruş or more, like the wizard.
  const below = variantsBelowFloor(d.priceMinor, existing.variants ?? []);
  if (below.length > 0) return refuse(below.map((v) => variantFloorError(v.name)), d.name);

  // A stored compare-at price stays above the sale price, as in the form
  // (DISCOUNT_NOT_ABOVE_ERROR): a price lifted over it and lowered again
  // later would bring the old badge and start day back without the ten-day
  // check (Ticari Reklam Yön. m.14/1, m.14/3). A row that empties the cell
  // ends the discount and may raise the price with it.
  if (
    storedCompare > 0 &&
    !compareClears &&
    priceCell &&
    d.priceMinor !== existing.priceMinor &&
    d.priceMinor >= storedCompare
  ) {
    return refuse([compareAtPriceFloorError(storedCompare)], d.name);
  }

  // Only what the file speaks about is compared: a stored value the schema
  // would merely tidy (a trailing space) is not a change the file asked for.
  const patch: ProductImportPatch = {};
  const changes: string[] = [];
  const clears: ClearedField[] = [];
  if (nameCell && d.name !== existing.name) {
    patch.name = d.name;
    changes.push(`Ad: ${short(existing.name)} → ${short(d.name)}`);
  }
  if (tagCell && d.tag !== existing.tag) {
    patch.tag = d.tag;
    changes.push(`Etiket: ${short(existing.tag) || "yok"} → ${short(d.tag)}`);
  }
  if (descCell && d.desc !== existing.desc) {
    patch.desc = d.desc;
    changes.push("Açıklama değişiyor.");
  }
  if (cat && d.cat !== existing.cat) {
    patch.cat = d.cat;
    changes.push(
      `Kategori: ${categoryLabel(existing.cat)} → ${categoryLabel(d.cat)}`,
    );
  }
  if (priceCell && d.priceMinor !== existing.priceMinor) {
    patch.priceMinor = d.priceMinor;
    changes.push(
      `Fiyat: ${priceLabel(existing.priceMinor)} → ${priceLabel(d.priceMinor)}`,
    );
  }
  // Only clearing reaches here (a new value was refused above); the days
  // go with it.
  if (compareClears) {
    patch.compareAtPriceMinor = 0;
    patch.discountStartsAt = null;
    patch.discountEndsAt = null;
    if (compareCell === "") {
      clears.push("compareAtPrice");
      changes.push(
        `Eski fiyat temizlenecek (hücre boş): ${priceLabel(storedCompare)} → yok`,
      );
    } else {
      changes.push(`Eski fiyat: ${priceLabel(storedCompare)} → yok`);
    }
  }
  if (rateCell !== undefined && d.taxRatePct !== storedRate) {
    patch.taxRatePct = d.taxRatePct;
    if (rateCell === "") {
      clears.push("taxRatePct");
      changes.push(
        `KDV temizlenecek (hücre boş): ${rateLabel(storedRate)} → ${rateLabel(null)}`,
      );
    } else {
      changes.push(`KDV: ${rateLabel(storedRate)} → ${rateLabel(d.taxRatePct)}`);
    }
  }
  if (active !== null && d.isActive !== existing.isActive) {
    patch.isActive = d.isActive;
    changes.push(d.isActive ? "Durum: Pasif → Aktif" : "Durum: Aktif → Pasif");
  }
  const storedBrand = existing.brand ?? "";
  if (brandCell !== undefined && d.brand !== storedBrand) {
    patch.brand = d.brand;
    if (brandCell === "") {
      clears.push("brand");
      changes.push(`Marka temizlenecek (hücre boş): ${short(storedBrand)} → yok`);
    } else {
      changes.push(`Marka: ${short(storedBrand) || "yok"} → ${short(d.brand) || "yok"}`);
    }
  }
  const storedWeight = existing.weightGrams ?? 0;
  if (weightCell !== undefined && d.weightGrams !== storedWeight) {
    patch.weightGrams = d.weightGrams;
    const grams = (g: number) => (g > 0 ? `${g} g` : "gösterilmiyor");
    if (weightCell === "") {
      clears.push("weight");
      changes.push(
        `Ağırlık temizlenecek (hücre boş): ${grams(storedWeight)} → ${grams(0)}`,
      );
    } else {
      changes.push(`Ağırlık: ${grams(storedWeight)} → ${grams(d.weightGrams)}`);
    }
  }
  const stockDelta = stockValue === null ? 0 : d.stock - existing.stock;
  if (stockDelta !== 0) {
    if ((existing.variants ?? []).length > 0) {
      return refuse(
        [
          "Bu ürünün varyantları var; stoğunu ürün sayfasından ya da Stok ekranından değiştir.",
        ],
        d.name,
      );
    }
    changes.push(
      `Stok: ${existing.stock} → ${d.stock} (${signed(stockDelta)}, stok hareketi yazılır)`,
    );
  }

  if (changes.length === 0) {
    return { view: view("unchanged", []), action: null };
  }
  return {
    view: view("update", changes),
    action: {
      kind: "update",
      id: existing.id,
      patch,
      stockDelta,
      catChanged: patch.cat !== undefined,
    },
    clears,
  };
}

/** What the import wrote. */
export interface ImportOutcome {
  rows: ImportRowView[];
  counts: ImportCounts;
  createdIds: string[];
  updatedIds: string[];
  /** Stock moves written ("CSV içe aktarma"). */
  stockMoves: number;
  /** Writable rows left unwritten because the time ran out. */
  notStarted: number;
}

/** Why a row the time budget left out was not written. */
export const IMPORT_OUT_OF_TIME =
  "Süre yetmedi, bu satır yazılmadı. Aynı dosyayı yeniden önizleyip içe aktar: yazılanlar \"Değişiklik yok\" görünür.";

/** The scene columns again after a category change, as a wizard save would. */
async function sceneForCategory(
  id: string,
  cat: ShopCategoryId,
): Promise<Partial<BackdropColumns>> {
  const full = await getProduct(id);
  if (!full) return {};
  const photo = full.images?.[0] ?? "";
  return sceneColumns(
    {
      photo,
      hue: full.img,
      category: cat,
      backdrop: { kind: "keep" },
      vessel: { kind: "keep" },
    },
    { ...full, photo },
  );
}

/** A failure's kind for the server log: never its message, which may quote the file. */
function failureKind(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === "string") return code;
  return err instanceof Error ? err.name : "unknown";
}

/**
 * Writes the planned rows one by one: creates, field patches and stock
 * deltas. A row that fails is reported and the next one still runs; a
 * refused or unchanged row is not touched. No row is started once
 * `budgetMs` has passed since `startedAt`: the rest come back as not
 * written, so the answer and the audit row arrive before the platform
 * stops the function, and they list what was written.
 */
export async function applyProductImport(
  plan: Extract<ImportPlan, { ok: true }>,
  {
    actor,
    startedAt = Date.now(),
    budgetMs = PRODUCT_IMPORT_WRITE_BUDGET_MS,
    now = Date.now,
  }: {
    actor: string;
    startedAt?: number;
    budgetMs?: number;
    /** The clock (a seam for tests). */
    now?: () => number;
  },
): Promise<ImportOutcome> {
  const rows: ImportRowView[] = [];
  const createdIds: string[] = [];
  const updatedIds: string[] = [];
  let stockMoves = 0;
  let notStarted = 0;

  for (const { view, action } of plan.rows) {
    if (!action) {
      rows.push(view);
      continue;
    }
    if (now() - startedAt >= budgetMs) {
      notStarted += 1;
      rows.push({ ...view, status: "error", messages: [IMPORT_OUT_OF_TIME] });
      continue;
    }
    try {
      if (action.kind === "create") {
        const created = await createProduct({ ...NO_BACKDROP, ...action.input });
        createdIds.push(created.id);
        rows.push(view);
        continue;
      }

      let patched = false;
      if (Object.keys(action.patch).length > 0) {
        const patch: ProductImportPatch =
          action.catChanged && action.patch.cat
            ? {
                ...action.patch,
                ...(await sceneForCategory(action.id, action.patch.cat)),
              }
            : action.patch;
        if (!(await patchProductFromImport(action.id, patch))) {
          rows.push({
            ...view,
            status: "error",
            messages: ["Ürün bu arada silinmiş; yazılmadı."],
          });
          continue;
        }
        patched = true;
      }

      const messages = [...view.messages];
      if (action.stockDelta !== 0) {
        const moved = await adjustStock({
          productId: action.id,
          delta: action.stockDelta,
          note: PRODUCT_IMPORT_STOCK_NOTE,
          actor,
        });
        if (moved.ok) {
          stockMoves += 1;
        } else if (!patched) {
          rows.push({
            ...view,
            status: "error",
            messages: [...messages, `Stok yazılamadı: ${moved.error}`],
          });
          continue;
        } else {
          // The other fields are written; the row is still a failure the
          // operator must see among the errors, not a quiet "Güncellendi".
          updatedIds.push(action.id);
          rows.push({
            ...view,
            status: "error",
            messages: [
              ...messages,
              `Diğer alanlar yazıldı ama stok yazılamadı: ${moved.error}`,
            ],
          });
          continue;
        }
      }
      updatedIds.push(action.id);
      rows.push({ ...view, messages });
    } catch (err) {
      console.error("[product-import] a row could not be written:", failureKind(err));
      rows.push({
        ...view,
        status: "error",
        messages: [
          "Yazılamadı: veritabanı hatası. Sayfayı yenileyip bu ürünü kontrol et.",
        ],
      });
    }
  }

  return {
    rows,
    counts: countRows(rows),
    createdIds,
    updatedIds,
    stockMoves,
    notStarted,
  };
}

/** An uploaded file as text, or why it is refused. */
export type ImportFile =
  | { ok: true; text: string; fileName: string; notices: string[] }
  | { ok: false; error: string };

/**
 * Reads the `file` field: at most PRODUCT_IMPORT_MAX_BYTES, a .csv (or
 * .txt) name, UTF-8. A file that is not valid UTF-8 is what Excel's plain
 * "CSV" saves on a Turkish Windows (code page 1254); it is read that way,
 * with a notice to check the letters in the preview.
 */
export async function readImportFile(
  entry: FormDataEntryValue | null,
): Promise<ImportFile> {
  if (!entry || typeof entry === "string" || entry.size === 0) {
    return { ok: false, error: "Bir CSV dosyası seç." };
  }
  const fileName = entry.name.slice(0, 120);
  if (entry.size > PRODUCT_IMPORT_MAX_BYTES) {
    return { ok: false, error: "Dosya en fazla 1 MB olabilir. Dosyayı böl." };
  }
  if (!/\.(csv|txt)$/i.test(entry.name)) {
    return {
      ok: false,
      error:
        "Dosya .csv olmalı. Excel'de Farklı Kaydet > CSV UTF-8 (virgülle ayrılmış) seç.",
    };
  }
  const bytes = new Uint8Array(await entry.arrayBuffer());
  const notices: string[] = [];
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    try {
      text = new TextDecoder("windows-1254").decode(bytes);
      notices.push(
        "Dosya UTF-8 değildi; Türkçe Windows kodlamasıyla okundu. Harfleri önizlemede kontrol et; bir dahaki sefere CSV UTF-8 olarak kaydet.",
      );
    } catch {
      return {
        ok: false,
        error: "Dosya okunamadı. Excel'de CSV UTF-8 olarak kaydet.",
      };
    }
  }
  if (text.includes("\u0000")) {
    return {
      ok: false,
      error: "Bu bir metin dosyası değil. Excel'de CSV UTF-8 olarak kaydet.",
    };
  }
  return { ok: true, text, fileName, notices };
}
