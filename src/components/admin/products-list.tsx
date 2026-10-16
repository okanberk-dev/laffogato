"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  bulkProductsAction,
  deleteProductAction,
  type BulkActionState,
} from "@/app/admin/urunler/actions";
import type { AdminCategory, AdminProduct } from "@/lib/admin/store";

import {
  BulkActionBar,
  RowCheckbox,
  SelectAllCheckbox,
  useSelection,
} from "./bulk";
import { DeleteRowForm } from "./delete-row-form";
import { formatTRY } from "./forms";

interface Props {
  products: AdminProduct[];
  categories: AdminCategory[];
  labelByCat: Record<string, string>;
}

const initialBulkState: BulkActionState = {};

/** 40×40 product thumbnail: the first uploaded photo, or a placeholder icon
    when the product only has a gradient/hue surface (no real photo yet). */
function ProductThumb({ src, alt }: { src?: string; alt: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="h-10 w-10 shrink-0 rounded-md object-cover ring-1 ring-neutral-200"
      />
    );
  }
  return (
    <div
      className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-neutral-100 text-neutral-300 ring-1 ring-neutral-200"
      aria-hidden="true"
      title="Görsel yok"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <path d="m21 15-5-5L6 19" />
      </svg>
    </div>
  );
}

export function ProductsList({ products, categories, labelByCat }: Props) {
  const [state, formAction, pending] = useActionState(
    bulkProductsAction,
    initialBulkState,
  );
  // A completed bulk action closes the bar once (bulk.tsx useSelection).
  const selection = useSelection({ resetOn: state.ok });

  const ids = products.map((p) => p.id);
  const idsCsv = selection.ids.join(",");

  const flash = state.ok
    ? `${OP_LABEL[state.ok.op] ?? state.ok.op}: ${state.ok.updated} ürün güncellendi.`
    : state.error;

  return (
    <>
      {flash && (
        <div
          className={`mb-3 rounded-md border px-3 py-2 text-sm ${
            state.error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {flash}
        </div>
      )}

      {products.length === 0 ? (
        <p className="text-sm text-neutral-500">Bu filtreyle ürün yok.</p>
      ) : (
        <>
          {/* Mobile card view (<md) */}
          <ul className="flex flex-col gap-3 md:hidden">
            {products.map((p) => {
              const isSelected = selection.has(p.id);
              const stockTone =
                p.stock === 0
                  ? "text-red-600"
                  : p.stock <= p.lowStockThreshold
                    ? "text-amber-700"
                    : "text-neutral-700";
              return (
                <li
                  key={p.id}
                  className={`rounded-xl border bg-white p-4 shadow-sm transition-colors ${
                    isSelected
                      ? "border-neutral-900"
                      : "border-[var(--admin-border)]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <RowCheckbox
                      id={p.id}
                      selection={selection}
                      label={p.name}
                    />
                    <ProductThumb src={p.images?.[0]} alt={p.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-neutral-900">
                            {p.name}
                          </div>
                          <div
                            className="mt-1 text-[10px] tracking-[0.2em] text-neutral-500 uppercase"
                            style={{ fontFamily: "var(--mono), monospace" }}
                          >
                            {p.tag}{" "}
                            {p.variants.length > 0 &&
                              `· ${p.variants.length} varyant`}
                          </div>
                        </div>
                        <div
                          className="shrink-0 text-right text-sm"
                          style={{ fontFamily: "var(--mono), monospace" }}
                        >
                          {formatTRY(p.priceMinor)}
                          {p.compareAtPriceMinor > p.priceMinor && (
                            <div className="text-[10px] text-neutral-400 line-through">
                              {formatTRY(p.compareAtPriceMinor)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className="text-neutral-500"
                          style={{ fontFamily: "var(--mono), monospace" }}
                        >
                          {p.sku}
                        </span>
                        <span className="text-neutral-400">·</span>
                        <span className="text-neutral-700">
                          {labelByCat[p.cat] ?? p.cat}
                        </span>
                        <span className="text-neutral-400">·</span>
                        <span
                          className={stockTone}
                          style={{ fontFamily: "var(--mono), monospace" }}
                        >
                          {p.stock} stok
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {p.isActive ? (
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-green-700 uppercase">
                            Aktif
                          </span>
                        ) : (
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] tracking-[0.18em] text-neutral-500 uppercase">
                            Pasif
                          </span>
                        )}
                        {p.featured && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-amber-700 uppercase">
                            Öne çıkan
                          </span>
                        )}
                        {p.isNew && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-blue-700 uppercase">
                            Yeni
                          </span>
                        )}
                        {p.stock === 0 && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-red-700 uppercase">
                            Stoksuz
                          </span>
                        )}
                        {p.stock > 0 && p.stock <= p.lowStockThreshold && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-amber-700 uppercase">
                            Düşük stok
                          </span>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={`/admin/urunler/${p.id}/duzenle`}
                          className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-full border border-[var(--admin-border)] px-3 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                        >
                          Düzenle
                        </Link>
                        <DeleteRowForm
                          action={deleteProductAction}
                          id={p.id}
                          confirmMessage={`"${p.name}" ürününü silmek istediğine emin misin? Bu işlem geri alınamaz.`}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Desktop table view (≥md) */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b border-[var(--admin-border)] text-left text-[10px] tracking-[0.22em] text-neutral-500 uppercase"
                  style={{ fontFamily: "var(--mono), monospace" }}
                >
                  <th className="py-3 pr-3">
                    <SelectAllCheckbox ids={ids} selection={selection} />
                  </th>
                  <th className="py-3 pr-3">Ürün</th>
                  <th className="pr-3">SKU</th>
                  <th className="pr-3">Kategori</th>
                  <th className="pr-3 text-right">Fiyat</th>
                  <th className="pr-3 text-right">Stok</th>
                  <th className="pr-3">Durum</th>
                  <th className="text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const stockTone =
                    p.stock === 0
                      ? "text-red-600"
                      : p.stock <= p.lowStockThreshold
                        ? "text-amber-700"
                        : "text-neutral-700";
                  const isSelected = selection.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-neutral-100 align-top transition-colors last:border-b-0 ${
                        isSelected ? "bg-neutral-50" : "hover:bg-neutral-50/60"
                      }`}
                    >
                      <td className="py-3 pr-3 align-middle">
                        <RowCheckbox
                          id={p.id}
                          selection={selection}
                          label={p.name}
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <ProductThumb src={p.images?.[0]} alt={p.name} />
                          <div className="min-w-0">
                            <div className="font-medium text-neutral-900">
                              {p.name}
                            </div>
                            <div
                              className="text-[10px] tracking-[0.2em] text-neutral-500 uppercase"
                              style={{ fontFamily: "var(--mono), monospace" }}
                            >
                              {p.tag}{" "}
                              {p.variants.length > 0 &&
                                `· ${p.variants.length} varyant`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td
                        className="pr-3 text-xs text-neutral-500"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {p.sku}
                      </td>
                      <td className="pr-3 text-neutral-700">
                        {labelByCat[p.cat] ?? p.cat}
                      </td>
                      <td
                        className="pr-3 text-right"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {formatTRY(p.priceMinor)}
                        {p.compareAtPriceMinor > p.priceMinor && (
                          <div className="text-[10px] text-neutral-400 line-through">
                            {formatTRY(p.compareAtPriceMinor)}
                          </div>
                        )}
                      </td>
                      <td
                        className={`pr-3 text-right ${stockTone}`}
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        {p.stock}
                      </td>
                      <td className="pr-3">
                        <div className="flex flex-wrap gap-1">
                          {p.isActive ? (
                            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-green-700 uppercase">
                              Aktif
                            </span>
                          ) : (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] tracking-[0.18em] text-neutral-500 uppercase">
                              Pasif
                            </span>
                          )}
                          {p.featured && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-amber-700 uppercase">
                              Öne çıkan
                            </span>
                          )}
                          {p.isNew && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-blue-700 uppercase">
                              Yeni
                            </span>
                          )}
                          {p.stock === 0 && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-red-700 uppercase">
                              Stoksuz
                            </span>
                          )}
                          {p.stock > 0 && p.stock <= p.lowStockThreshold && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] tracking-[0.18em] text-amber-700 uppercase">
                              Düşük stok
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/urunler/${p.id}/duzenle`}
                            className="inline-flex items-center justify-center rounded-full border border-[var(--admin-border)] px-3 py-1.5 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]"
                          >
                            Düzenle
                          </Link>
                          <DeleteRowForm
                            action={deleteProductAction}
                            id={p.id}
                            confirmMessage={`"${p.name}" ürününü silmek istediğine emin misin? Bu işlem geri alınamaz.`}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <form action={formAction}>
        <input type="hidden" name="ids" value={idsCsv} />
        <BulkActionBar selection={selection} pending={pending}>
          <button
            type="submit"
            name="op"
            value="activate"
            disabled={pending}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] disabled:opacity-40"
          >
            Aktif yap
          </button>
          <button
            type="submit"
            name="op"
            value="deactivate"
            disabled={pending}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] disabled:opacity-40"
          >
            Pasif yap
          </button>
          <div className="flex items-center gap-1">
            <select
              name="value"
              defaultValue=""
              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700 focus:border-[var(--admin-primary)] focus:outline-none"
            >
              <option value="" disabled>
                Kategoriye taşı…
              </option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              name="op"
              value="set_category"
              disabled={pending}
              className="rounded-full bg-[var(--admin-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--admin-primary-hover)] disabled:opacity-40"
            >
              Taşı
            </button>
          </div>
          <button
            type="submit"
            name="op"
            value="delete"
            disabled={pending}
            onClick={(e) => {
              if (
                !confirm(
                  `${selection.count} ürünü silmek istediğine emin misin? Bu işlem geri alınamaz.`,
                )
              ) {
                e.preventDefault();
              }
            }}
            className="rounded-full border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:border-red-600 hover:bg-red-600 hover:text-white disabled:opacity-40"
          >
            Sil
          </button>
        </BulkActionBar>
      </form>
    </>
  );
}

const OP_LABEL: Record<string, string> = {
  activate: "Aktif yapıldı",
  deactivate: "Pasif yapıldı",
  delete: "Silindi",
  set_category: "Kategori değiştirildi",
};
