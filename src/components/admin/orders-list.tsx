"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  bulkOrdersAction,
  updateOrderStatusAction,
  type BulkOrderActionState,
} from "@/app/admin/siparisler/actions";
import type { AdminOrder, AdminOrderStatus } from "@/lib/admin/store";

import { BulkActionBar, RowCheckbox, SelectAllCheckbox, useSelection } from "./bulk";
import { formatDateTime, formatTRY } from "./forms";

interface Props {
  orders: AdminOrder[];
  statusOptions: Array<[AdminOrderStatus, string]>;
  statusTone: Record<AdminOrderStatus, string>;
}

const initialBulkState: BulkOrderActionState = {};

export function OrdersList({ orders, statusOptions, statusTone }: Props) {
  const selection = useSelection();
  const [state, formAction, pending] = useActionState(
    bulkOrdersAction,
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

  const ids = orders.map((o) => o.id);
  const idsCsv = selection.ids.join(",");
  const flash = state.ok
    ? `${state.ok.updated} sipariş güncellendi.`
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

      <div className="mb-3 flex items-center gap-3 rounded-md border border-neutral-200 bg-white px-4 py-2.5">
        <SelectAllCheckbox ids={ids} selection={selection} label="Tümünü seç" />
        <span
          className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
          style={{ fontFamily: "var(--mono), monospace" }}
        >
          {orders.length} sipariş
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {orders.map((o) => {
          const statusLabel =
            statusOptions.find(([k]) => k === o.status)?.[1] ?? o.status;
          const tone = statusTone[o.status];
          const isSelected = selection.has(o.id);
          return (
            <div
              key={o.id}
              className={`rounded-xl border bg-white p-6 shadow-sm ${
                isSelected ? "border-neutral-900" : "border-neutral-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="pt-1">
                    <RowCheckbox
                      id={o.id}
                      selection={selection}
                      label={`Sipariş ${o.orderNo}`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span
                        className="text-lg font-medium"
                        style={{ fontFamily: "var(--mono), monospace" }}
                      >
                        #{o.orderNo}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] ${tone}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-neutral-700">
                      {o.customerName}{" "}
                      <span className="text-neutral-400">·</span>{" "}
                      <span className="text-neutral-500">
                        {o.customerEmail}
                      </span>
                    </div>
                    <div
                      className="mt-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400"
                      style={{ fontFamily: "var(--mono), monospace" }}
                    >
                      {formatDateTime(o.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="text-xl"
                    style={{
                      fontFamily: "var(--serif), 'Playfair Display', serif",
                      fontStyle: "italic",
                      fontWeight: 500,
                    }}
                  >
                    {formatTRY(o.totalMinor)}
                  </div>
                  <div
                    className="text-[10px] uppercase tracking-[0.18em] text-neutral-400"
                    style={{ fontFamily: "var(--mono), monospace" }}
                  >
                    {o.items.length} kalem
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-neutral-100 pt-4">
                <ul className="grid gap-1 text-sm text-neutral-700">
                  {o.items.map((it, i) => (
                    <li key={i} className="flex justify-between">
                      <span>
                        {it.productName}{" "}
                        <span className="text-neutral-400">× {it.qty}</span>
                      </span>
                      <span style={{ fontFamily: "var(--mono), monospace" }}>
                        {formatTRY(it.unitPriceMinor * it.qty)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <form
                action={updateOrderStatusAction}
                className="mt-4 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4"
              >
                <input type="hidden" name="id" value={o.id} />
                <label
                  className="text-[10px] uppercase tracking-[0.22em] text-neutral-500"
                  style={{ fontFamily: "var(--mono), monospace" }}
                >
                  Durum güncelle
                </label>
                <select
                  name="status"
                  defaultValue={o.status}
                  className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm focus:border-neutral-900 focus:bg-white focus:outline-none"
                >
                  {statusOptions.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
                >
                  Kaydet
                </button>
              </form>
            </div>
          );
        })}
      </div>

      <form action={formAction}>
        <input type="hidden" name="ids" value={idsCsv} />
        <input type="hidden" name="op" value="set_status" />
        <BulkActionBar
          selection={selection}
          pending={pending}
          message={<span>Seçili siparişlerin durumunu birlikte güncelle:</span>}
        >
          <select
            name="value"
            defaultValue=""
            className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-700 focus:border-neutral-900 focus:outline-none"
          >
            <option value="" disabled>
              Yeni durum…
            </option>
            {statusOptions.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
          >
            Uygula
          </button>
        </BulkActionBar>
      </form>
    </>
  );
}
