"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import {
  bulkMenuAction,
  deleteMenuItemAction,
  type BulkMenuActionState,
} from "@/app/admin/menu/actions";
import type { AdminMenuItem, MenuCategoryKey } from "@/lib/admin/store";

import { BulkActionBar, RowCheckbox, SelectAllCheckbox, useSelection } from "./bulk";
import { DangerButton, formatTRY } from "./forms";

interface Props {
  itemsByCategory: Record<MenuCategoryKey, AdminMenuItem[]>;
  categoryKeys: MenuCategoryKey[];
  categoryLabels: Record<MenuCategoryKey, string>;
}

const initialBulkState: BulkMenuActionState = {};

export function MenuList({
  itemsByCategory,
  categoryKeys,
  categoryLabels,
}: Props) {
  const selection = useSelection();
  const [state, formAction, pending] = useActionState(
    bulkMenuAction,
    initialBulkState,
  );
  const lastFlash = useRef<string>("");

  useEffect(() => {
    if (state.ok && state.ok.updated >= 0) {
      const flashKey = `${state.ok.op}:${state.ok.updated}:${Date.now()}`;
      if (flashKey !== lastFlash.current) {
        lastFlash.current = flashKey;
        selection.clear();
      }
    }
  }, [state, selection]);

  const idsCsv = selection.ids.join(",");
  const flash = state.ok
    ? `${OP_LABEL[state.ok.op] ?? state.ok.op}: ${state.ok.updated} kalem güncellendi.`
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

      <div className="flex flex-col gap-6">
        {categoryKeys.map((key) => {
          const items = itemsByCategory[key];
          const ids = items.map((it) => it.id);
          return (
            <div
              key={key}
              className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-neutral-100 pb-3">
                <div className="flex items-end gap-3">
                  <SelectAllCheckbox
                    ids={ids}
                    selection={selection}
                    label={`${categoryLabels[key]} — tümünü seç`}
                  />
                  <div>
                    <div
                      className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {items.length} kalem
                    </div>
                    <h2
                      className="text-2xl"
                      style={{
                        fontFamily: "var(--serif), 'Playfair Display', serif",
                        fontStyle: "italic",
                        fontWeight: 500,
                      }}
                    >
                      {categoryLabels[key]}
                    </h2>
                  </div>
                </div>
                <Link
                  href={`/admin/menu/yeni?cat=${key}`}
                  className="text-xs text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline"
                >
                  + Bu kategoriye ekle
                </Link>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Bu kategoride kalem yok.
                </p>
              ) : (
                <>
                {/* Mobile cards */}
                <ul className="flex flex-col gap-3 md:hidden">
                  {items.map((it) => {
                    const isSelected = selection.has(it.id);
                    return (
                      <li
                        key={it.id}
                        className={`rounded-lg border p-3 ${
                          isSelected ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <RowCheckbox id={it.id} selection={selection} label={it.name} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-medium text-neutral-900">{it.name}</div>
                                <div className="line-clamp-2 text-xs text-neutral-500">{it.desc}</div>
                              </div>
                              <div className="shrink-0 text-right text-sm" style={{ fontFamily: "var(--mono), monospace" }}>
                                {formatTRY(it.priceMinor)}
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1">
                              <span
                                className="text-[10px] text-neutral-500"
                                style={{ fontFamily: "var(--mono), monospace" }}
                              >
                                Sıra {String(it.sortOrder).padStart(2, "0")}
                              </span>
                              {it.isActive ? (
                                <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-green-700">
                                  Aktif
                                </span>
                              ) : (
                                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                                  Gizli
                                </span>
                              )}
                              {it.tags.map((t) => (
                                <span
                                  key={t}
                                  className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-neutral-600"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Link
                                href={`/admin/menu/${it.id}/duzenle`}
                                className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-full border border-neutral-200 px-3 text-xs text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
                              >
                                Düzenle
                              </Link>
                              <form action={deleteMenuItemAction}>
                                <input type="hidden" name="id" value={it.id} />
                                <DangerButton type="submit" className="text-xs">
                                  Sil
                                </DangerButton>
                              </form>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="text-left text-[10px] uppercase tracking-[0.22em] text-neutral-500"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      <th className="py-2 pr-3 w-8" />
                      <th className="py-2 pr-3">Sıra</th>
                      <th className="pr-3">Kalem</th>
                      <th className="pr-3">Etiket</th>
                      <th className="pr-3 text-right">Fiyat</th>
                      <th className="pr-3">Durum</th>
                      <th className="text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => {
                      const isSelected = selection.has(it.id);
                      return (
                        <tr
                          key={it.id}
                          className={`border-t border-neutral-100 ${
                            isSelected ? "bg-neutral-50" : ""
                          }`}
                        >
                          <td className="py-3 pr-3 align-middle">
                            <RowCheckbox
                              id={it.id}
                              selection={selection}
                              label={it.name}
                            />
                          </td>
                          <td
                            className="py-3 pr-3 text-neutral-500"
                            style={{ fontFamily: "var(--mono), monospace" }}
                          >
                            {String(it.sortOrder).padStart(2, "0")}
                          </td>
                          <td className="pr-3">
                            <div className="font-medium text-neutral-900">
                              {it.name}
                            </div>
                            <div className="line-clamp-1 max-w-md text-xs text-neutral-500">
                              {it.desc}
                            </div>
                          </td>
                          <td className="pr-3">
                            {it.tags.length === 0 ? (
                              <span className="text-xs text-neutral-400">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {it.tags.map((t) => (
                                  <span
                                    key={t}
                                    className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-neutral-600"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td
                            className="pr-3 text-right"
                            style={{ fontFamily: "var(--mono), monospace" }}
                          >
                            {formatTRY(it.priceMinor)}
                          </td>
                          <td className="pr-3">
                            {it.isActive ? (
                              <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-green-700">
                                Aktif
                              </span>
                            ) : (
                              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                                Gizli
                              </span>
                            )}
                          </td>
                          <td className="text-right">
                            <div className="flex justify-end gap-2">
                              <Link
                                href={`/admin/menu/${it.id}/duzenle`}
                                className="inline-flex items-center justify-center rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
                              >
                                Düzenle
                              </Link>
                              <form action={deleteMenuItemAction}>
                                <input type="hidden" name="id" value={it.id} />
                                <DangerButton type="submit" className="text-xs">
                                  Sil
                                </DangerButton>
                              </form>
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
            </div>
          );
        })}
      </div>

      <form action={formAction}>
        <input type="hidden" name="ids" value={idsCsv} />
        <BulkActionBar selection={selection} pending={pending}>
          <button
            type="submit"
            name="op"
            value="activate"
            disabled={pending}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:border-neutral-900 hover:text-neutral-900 disabled:opacity-40"
          >
            Aktif yap
          </button>
          <button
            type="submit"
            name="op"
            value="deactivate"
            disabled={pending}
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:border-neutral-900 hover:text-neutral-900 disabled:opacity-40"
          >
            Gizle
          </button>
          <div className="flex items-center gap-1">
            <select
              name="value"
              defaultValue=""
              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700 focus:border-neutral-900 focus:outline-none"
            >
              <option value="" disabled>
                Kategoriye taşı…
              </option>
              {categoryKeys.map((k) => (
                <option key={k} value={k}>
                  {categoryLabels[k]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              name="op"
              value="set_category"
              disabled={pending}
              className="rounded-full bg-neutral-200 px-3 py-1.5 text-xs text-neutral-800 hover:bg-neutral-300 disabled:opacity-40"
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
                  `${selection.count} kalemi silmek istediğine emin misin?`,
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
  deactivate: "Gizlendi",
  delete: "Silindi",
  set_category: "Kategori değiştirildi",
};
