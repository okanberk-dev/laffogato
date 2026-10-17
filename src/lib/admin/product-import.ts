import "server-only";

import { createHash } from "node:crypto";

import { sceneColumns } from "@/lib/backdrop/scene";
import { priceLabel } from "@/lib/utils/format";

import { parseCsv, type CsvRecord } from "./csv";
import {
  countRows,
  importColumnFor,
  parseActiveCell,
  parseCountCell,
  PRODUCT_IMPORT_CELL_MAX,
  PRODUCT_IMPORT_MAX_BYTES,
  PRODUCT_IMPORT_MAX_ROWS,
  PRODUCT_IMPORT_STOCK_NOTE,
  type ImportColumn,
  type ImportCounts,
  type ImportRowStatus,
  type ImportRowView,
} from "./product-import-core";
import {
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

export interface PlannedRow {
  view: ImportRowView;
  /** Null for a refused or unchanged row: nothing to write. */
  action: PlannedAction | null;
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
    notices.push(`Tanımadığım sütunlar atlandı: ${unknown.join(", ")}.`);
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
        compareAtPrice:
          existing.compareAtPriceMinor > 0
            ? minorText(existing.compareAtPriceMinor)
            : "",
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
  const compareCell = get("compareAtPrice");
  if (compareCell !== undefined) record.compareAtPrice = compareCell;
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
      compareAtPriceMinor: d.compareAtPriceMinor,
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

  // Only what the file speaks about is compared: a stored value the schema
  // would merely tidy (a trailing space) is not a change the file asked for.
  const patch: ProductImportPatch = {};
  const changes: string[] = [];
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
  if (
    compareCell !== undefined &&
    d.compareAtPriceMinor !== existing.compareAtPriceMinor
  ) {
    patch.compareAtPriceMinor = d.compareAtPriceMinor;
    const was = (m: number) => (m > 0 ? priceLabel(m) : "yok");
    changes.push(
      `Eski fiyat: ${was(existing.compareAtPriceMinor)} → ${was(d.compareAtPriceMinor)}`,
    );
  }
  const storedRate =
    typeof existing.taxRatePct === "number" ? existing.taxRatePct : null;
  if (rateCell !== undefined && d.taxRatePct !== storedRate) {
    patch.taxRatePct = d.taxRatePct;
    changes.push(`KDV: ${rateLabel(storedRate)} → ${rateLabel(d.taxRatePct)}`);
  }
  if (active !== null && d.isActive !== existing.isActive) {
    patch.isActive = d.isActive;
    changes.push(d.isActive ? "Durum: Pasif → Aktif" : "Durum: Aktif → Pasif");
  }
  const storedBrand = existing.brand ?? "";
  if (brandCell !== undefined && d.brand !== storedBrand) {
    patch.brand = d.brand;
    changes.push(`Marka: ${short(storedBrand) || "yok"} → ${short(d.brand) || "yok"}`);
  }
  const storedWeight = existing.weightGrams ?? 0;
  if (weightCell !== undefined && d.weightGrams !== storedWeight) {
    patch.weightGrams = d.weightGrams;
    const grams = (g: number) => (g > 0 ? `${g} g` : "gösterilmiyor");
    changes.push(`Ağırlık: ${grams(storedWeight)} → ${grams(d.weightGrams)}`);
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
}

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
 * refused or unchanged row is not touched.
 */
export async function applyProductImport(
  plan: Extract<ImportPlan, { ok: true }>,
  { actor }: { actor: string },
): Promise<ImportOutcome> {
  const rows: ImportRowView[] = [];
  const createdIds: string[] = [];
  const updatedIds: string[] = [];
  let stockMoves = 0;

  for (const { view, action } of plan.rows) {
    if (!action) {
      rows.push(view);
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
        } else {
          messages.push(`Stok yazılamadı: ${moved.error}`);
          if (!patched) {
            rows.push({ ...view, status: "error", messages });
            continue;
          }
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

  return { rows, counts: countRows(rows), createdIds, updatedIds, stockMoves };
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
