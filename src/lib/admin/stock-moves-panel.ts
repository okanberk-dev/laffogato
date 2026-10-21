// Client-safe (no server-only): the Stok page's ledger filters, its pages and
// what the manual correction form is told about each product.

import type { AdminTone } from "./tone";
import type { FilterField, FilterOption, FilterValues } from "./list-params";
import { istanbulDayStartIso } from "./order-filters";
import type {
  ProductPanelView,
  StockMoveFilter,
  StockMoveReason,
} from "./store";

export const STOCK_MOVES_PATH = "/admin/stok-hareketleri";

/** Moves per page. Every order line writes one, so the ledger grows fast. */
export const STOCK_MOVES_PAGE_SIZE = 100;

export const STOCK_REASON_LABEL: Record<StockMoveReason, string> = {
  order_placed: "Sipariş",
  order_cancelled: "İptal · stoğa geri",
  manual_adjust: "Manuel düzeltme",
  refund_restock: "İade · stoğa geri",
  seed: "Açılış",
};

/** Kit Badge tones (each ink clears AA on its ground), not hand-made chips. */
export const STOCK_REASON_TONE: Record<StockMoveReason, AdminTone> = {
  order_placed: "info",
  order_cancelled: "success",
  manual_adjust: "warning",
  refund_restock: "success",
  seed: "neutral",
};

const REASONS = Object.keys(STOCK_REASON_LABEL) as StockMoveReason[];

/**
 * The product dropdown's options. The audit log links a stock entry here
 * with `?productId=` (lib/admin/audit-view.ts); a product deleted since is
 * not in the list any more, so it gets an option of its own and its moves
 * stay findable.
 */
export function stockProductOptions(
  products: ReadonlyArray<Pick<ProductPanelView, "id" | "name">>,
  requested: string | undefined,
): FilterOption[] {
  const options = [...products]
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
    .map((p) => ({ value: p.id, label: p.name }));
  const id = (requested ?? "").trim();
  if (
    /^[A-Za-z0-9_-]{1,64}$/.test(id) &&
    !options.some((o) => o.value === id)
  ) {
    options.push({ value: id, label: `Silinmiş ürün (${id})` });
  }
  return options;
}

export function stockFilterFields(
  productOptions: readonly FilterOption[],
): FilterField[] {
  return [
    {
      type: "select",
      name: "productId",
      label: "Ürün",
      allLabel: "Tüm ürünler",
      options: productOptions,
    },
    {
      type: "select",
      name: "reason",
      label: "Sebep",
      options: REASONS.map((r) => ({ value: r, label: STOCK_REASON_LABEL[r] })),
    },
    { type: "date-range", label: "Tarih", from: "bas", to: "bit" },
  ];
}

/** The parsed filters as the store's query: days on the köşk's clock. */
export function stockMoveQuery(values: FilterValues): StockMoveFilter {
  const out: StockMoveFilter = {};
  if (values.productId) out.productId = values.productId;
  if (values.reason) out.reason = values.reason as StockMoveReason;
  if (values.bas) out.fromIso = istanbulDayStartIso(values.bas);
  if (values.bit) out.beforeIso = istanbulDayStartIso(values.bit, 1);
  return out;
}

/** What the correction form needs of a product: its stock and its variants' stock. */
export interface StockAdjustOption {
  id: string;
  name: string;
  stock: number;
  variants: Array<{
    id: string;
    name: string;
    stock: number;
    isActive: boolean;
  }>;
}

/**
 * A product for the correction form, and nothing else: the form is a client
 * component and the Stok page is open to Personel, while cost, prices and
 * photos belong to the Ürünler role (admin audit CAT-07).
 */
export function toStockAdjustOption(
  p: Pick<ProductPanelView, "id" | "name" | "stock" | "variants">,
): StockAdjustOption {
  return {
    id: p.id,
    name: p.name,
    stock: p.stock,
    variants: (p.variants ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      stock: v.stock,
      isActive: v.isActive,
    })),
  };
}
